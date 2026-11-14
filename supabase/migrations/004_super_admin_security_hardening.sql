-- ============================================================================
-- Campus Blood Connect (Netrokona University)
-- Migration 004: Super Admin & Role Authorization Security Hardening
-- Safe to run multiple times (idempotent) on an already-migrated database.
-- ============================================================================

-- 1. Fix SECURITY DEFINER trigger checks (never trust current_user inside SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_active BOOLEAN;
  v_admin_count INTEGER;
BEGIN
  -- Allow privileged service_role calls or direct SQL Editor / migration sessions (no API user JWT)
  IF COALESCE(auth.role(), '') = 'service_role'
     OR (auth.uid() IS NULL AND COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated')) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to modify profile records.';
  END IF;

  SELECT role, is_active
  INTO v_caller_role, v_caller_active
  FROM public.profiles
  WHERE id = auth.uid();

  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    IF v_caller_role IS DISTINCT FROM 'super_admin' OR v_caller_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Only active super administrators can modify user roles or account active status.';
    END IF;

    -- Prevent demoting or suspending the last active super_admin
    IF OLD.role = 'super_admin' AND OLD.is_active = true
       AND (NEW.role IS DISTINCT FROM 'super_admin' OR NEW.is_active IS DISTINCT FROM true) THEN
      SELECT COUNT(*) INTO v_admin_count
      FROM public.profiles
      WHERE role = 'super_admin' AND is_active = true AND id <> OLD.id;

      IF v_admin_count < 1 THEN
        RAISE EXCEPTION 'Cannot demote or suspend the last active Super Admin.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_donor_details_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_active BOOLEAN;
  v_is_privileged_session BOOLEAN;
BEGIN
  v_is_privileged_session :=
    COALESCE(auth.role(), '') = 'service_role'
    OR (auth.uid() IS NULL AND COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated'));

  IF auth.uid() IS NOT NULL THEN
    SELECT role, is_active
    INTO v_caller_role, v_caller_active
    FROM public.profiles
    WHERE id = auth.uid();
  END IF;

  IF NEW.blood_group IS DISTINCT FROM OLD.blood_group THEN
    IF COALESCE(v_caller_role, 'student') = 'student' AND NOT v_is_privileged_session THEN
      NEW.verification_status := 'pending';
    END IF;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NOT v_is_privileged_session
     AND OLD.user_id = auth.uid() THEN
    IF NOT (NEW.blood_group IS DISTINCT FROM OLD.blood_group AND NEW.verification_status = 'pending') THEN
      RAISE EXCEPTION 'Security restriction: You cannot approve or reject your own donor verification status.';
    END IF;
  END IF;

  IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status OR NEW.total_donations IS DISTINCT FROM OLD.total_donations) THEN
    IF NOT v_is_privileged_session
       AND (COALESCE(v_caller_role, 'student') NOT IN ('moderator', 'super_admin') OR COALESCE(v_caller_active, false) = false) THEN
      IF NOT (NEW.blood_group IS DISTINCT FROM OLD.blood_group AND NEW.verification_status = 'pending' AND NEW.total_donations = OLD.total_donations) THEN
        RAISE EXCEPTION 'Only authorized moderators or administrators can verify donors or modify donation totals.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Harden RLS helper functions and profiles UPDATE policy
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.is_my_account_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_active FROM public.profiles WHERE id = auth.uid()), false);
$$;

DROP POLICY IF EXISTS "Users update own profile or super_admin updates any" ON public.profiles;
CREATE POLICY "Users update own profile or super_admin updates any"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_super_admin())
  WITH CHECK (
    public.is_super_admin()
    OR (
      auth.uid() = id
      AND role = public.get_my_role()
      AND is_active = public.is_my_account_active()
    )
  );

-- 3. Harden admin_update_user_role so missing targets never silently affect 0 rows
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_target_user_id UUID,
  p_new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_admin_count INTEGER;
  v_previous_role TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Super Admin role required.';
  END IF;

  IF p_new_role NOT IN ('student', 'moderator', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role.';
  END IF;

  SELECT role INTO v_previous_role FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user profile not found.';
  END IF;

  IF p_target_user_id = v_actor AND p_new_role <> 'super_admin' THEN
    SELECT COUNT(*) INTO v_admin_count FROM public.profiles WHERE role = 'super_admin' AND is_active = true;
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last active Super Admin.';
    END IF;
  END IF;

  UPDATE public.profiles SET role = p_new_role WHERE id = p_target_user_id;

  INSERT INTO public.admin_logs (actor_id, action, target_table, target_id, details)
  VALUES (
    v_actor,
    'role_updated',
    'profiles',
    p_target_user_id::text,
    jsonb_build_object('previous_role', v_previous_role, 'new_role', p_new_role)
  );
END;
$$;

-- 4. Server/Database-backed Role Verification RPC for /admin and /moderator routes
CREATE OR REPLACE FUNCTION public.verify_user_role(
  p_allowed_roles TEXT[]
)
RETURNS TABLE (
  authorized BOOLEAN,
  role TEXT,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((p.is_active AND p.role = ANY(p_allowed_roles)), false) AS authorized,
    p.role,
    p.is_active
  FROM public.profiles p
  WHERE p.id = auth.uid()
  UNION ALL
  SELECT false, NULL::TEXT, false
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_account_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_role(TEXT[]) TO authenticated;
