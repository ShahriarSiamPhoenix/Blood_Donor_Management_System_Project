-- ============================================================================
-- Campus Blood Connect (Netrokona University)
-- Migration 002: Row Level Security (RLS) Policies & Secure RPC Functions
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- HELPER SECURITY FUNCTIONS
-- ----------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('moderator', 'super_admin') AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS POLICIES
-- ----------------------------------------------------------------------------

-- 1. DEPARTMENTS
DROP POLICY IF EXISTS "Public can view active departments" ON public.departments;
CREATE POLICY "Public can view active departments"
  ON public.departments FOR SELECT
  USING (is_active = true OR public.is_super_admin());

DROP POLICY IF EXISTS "Super admins manage departments" ON public.departments;
CREATE POLICY "Super admins manage departments"
  ON public.departments FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 2. PROFILES (Never publicly selectable; protects phone, email, student_id)
DROP POLICY IF EXISTS "Users read own profile or staff read all" ON public.profiles;
CREATE POLICY "Users read own profile or staff read all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_moderator_or_admin());

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

-- 3. DONOR DETAILS
DROP POLICY IF EXISTS "Users read own donor details or staff read all" ON public.donor_details;
CREATE POLICY "Users read own donor details or staff read all"
  ON public.donor_details FOR SELECT
  USING (auth.uid() = user_id OR public.is_moderator_or_admin());

DROP POLICY IF EXISTS "Users update own donor details or staff manage" ON public.donor_details;
CREATE POLICY "Users update own donor details or staff manage"
  ON public.donor_details FOR UPDATE
  USING (auth.uid() = user_id OR public.is_moderator_or_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_moderator_or_admin());

-- 4. VERIFICATION REQUESTS
DROP POLICY IF EXISTS "Users view own verifications or staff view all" ON public.verification_requests;
CREATE POLICY "Users view own verifications or staff view all"
  ON public.verification_requests FOR SELECT
  USING (auth.uid() = user_id OR public.is_moderator_or_admin());

DROP POLICY IF EXISTS "Users submit own verification requests" ON public.verification_requests;
CREATE POLICY "Users submit own verification requests"
  ON public.verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Staff review verification requests (not own)" ON public.verification_requests;
CREATE POLICY "Staff review verification requests (not own)"
  ON public.verification_requests FOR UPDATE
  USING (public.is_moderator_or_admin() AND user_id <> auth.uid())
  WITH CHECK (public.is_moderator_or_admin() AND user_id <> auth.uid());

-- 5. BLOOD REQUESTS
-- Note: Public visitors use get_public_blood_requests() RPC which masks raw personal phone numbers.
-- Direct table SELECT is restricted to the requester, authenticated verified users, or staff.
DROP POLICY IF EXISTS "Authorized users read blood requests" ON public.blood_requests;
CREATE POLICY "Authorized users read blood requests"
  ON public.blood_requests FOR SELECT
  USING (
    auth.uid() = requester_id
    OR public.is_moderator_or_admin()
    OR (
      auth.uid() IS NOT NULL
      AND status IN ('verified', 'donor_found', 'completed')
    )
  );

DROP POLICY IF EXISTS "Authenticated users create blood requests" ON public.blood_requests;
CREATE POLICY "Authenticated users create blood requests"
  ON public.blood_requests FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND requester_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Requesters edit/cancel own pending or staff manage all" ON public.blood_requests;
CREATE POLICY "Requesters edit/cancel own pending or staff manage all"
  ON public.blood_requests FOR UPDATE
  USING (
    (auth.uid() = requester_id AND status IN ('pending', 'verified'))
    OR public.is_moderator_or_admin()
  )
  WITH CHECK (
    (
      auth.uid() = requester_id
      AND status IN ('pending', 'cancelled')
    )
    OR public.is_moderator_or_admin()
  );

-- 6. DONATION HISTORY
DROP POLICY IF EXISTS "Donors read own history or staff read all" ON public.donation_history;
CREATE POLICY "Donors read own history or staff read all"
  ON public.donation_history FOR SELECT
  USING (auth.uid() = donor_id OR public.is_moderator_or_admin());

DROP POLICY IF EXISTS "Staff insert donation history" ON public.donation_history;
CREATE POLICY "Staff insert donation history"
  ON public.donation_history FOR INSERT
  WITH CHECK (public.is_moderator_or_admin());

DROP POLICY IF EXISTS "Super admin manages donation history" ON public.donation_history;
CREATE POLICY "Super admin manages donation history"
  ON public.donation_history FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 7. CONTACT REQUESTS
DROP POLICY IF EXISTS "Participants or staff view contact requests" ON public.contact_requests;
CREATE POLICY "Participants or staff view contact requests"
  ON public.contact_requests FOR SELECT
  USING (auth.uid() = donor_id OR auth.uid() = requester_id OR public.is_moderator_or_admin());

DROP POLICY IF EXISTS "Authenticated users send contact requests" ON public.contact_requests;
CREATE POLICY "Authenticated users send contact requests"
  ON public.contact_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id AND donor_id <> auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Donors respond or requesters close contact requests" ON public.contact_requests;
CREATE POLICY "Donors respond or requesters close contact requests"
  ON public.contact_requests FOR UPDATE
  USING (auth.uid() = donor_id OR auth.uid() = requester_id OR public.is_moderator_or_admin())
  WITH CHECK (auth.uid() = donor_id OR auth.uid() = requester_id OR public.is_moderator_or_admin());

-- 8. NOTIFICATIONS
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;
CREATE POLICY "Users mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff create notifications" ON public.notifications;
CREATE POLICY "Staff create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_moderator_or_admin());

-- 9. REPORTS
DROP POLICY IF EXISTS "Reporters view own or staff view all reports" ON public.reports;
CREATE POLICY "Reporters view own or staff view all reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id OR public.is_moderator_or_admin());

DROP POLICY IF EXISTS "Authenticated users create reports" ON public.reports;
CREATE POLICY "Authenticated users create reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id AND status = 'open');

DROP POLICY IF EXISTS "Staff resolve reports" ON public.reports;
CREATE POLICY "Staff resolve reports"
  ON public.reports FOR UPDATE
  USING (public.is_moderator_or_admin())
  WITH CHECK (public.is_moderator_or_admin());

-- 10. ADMIN LOGS (Append-only by staff; readable by staff)
DROP POLICY IF EXISTS "Staff view admin logs" ON public.admin_logs;
CREATE POLICY "Staff view admin logs"
  ON public.admin_logs FOR SELECT
  USING (public.is_moderator_or_admin());

DROP POLICY IF EXISTS "Staff insert admin logs" ON public.admin_logs;
CREATE POLICY "Staff insert admin logs"
  ON public.admin_logs FOR INSERT
  WITH CHECK (public.is_moderator_or_admin() AND actor_id = auth.uid());

-- 11. PLATFORM SETTINGS
DROP POLICY IF EXISTS "Public reads public settings; admin reads all" ON public.platform_settings;
CREATE POLICY "Public reads public settings; admin reads all"
  ON public.platform_settings FOR SELECT
  USING (is_public = true OR public.is_super_admin());

DROP POLICY IF EXISTS "Super admin manages platform settings" ON public.platform_settings;
CREATE POLICY "Super admin manages platform settings"
  ON public.platform_settings FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 12. TESTIMONIALS
DROP POLICY IF EXISTS "Public reads approved testimonials; users read own" ON public.testimonials;
CREATE POLICY "Public reads approved testimonials; users read own"
  ON public.testimonials FOR SELECT
  USING (is_approved = true OR auth.uid() = user_id OR public.is_moderator_or_admin());

DROP POLICY IF EXISTS "Students submit own testimonial" ON public.testimonials;
CREATE POLICY "Students submit own testimonial"
  ON public.testimonials FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_approved = false);

DROP POLICY IF EXISTS "Staff approve testimonials" ON public.testimonials;
CREATE POLICY "Staff approve testimonials"
  ON public.testimonials FOR UPDATE
  USING (public.is_moderator_or_admin())
  WITH CHECK (public.is_moderator_or_admin());

-- ----------------------------------------------------------------------------
-- SECURE PUBLIC RPC FUNCTIONS (No PII exposed)
-- ----------------------------------------------------------------------------

-- A. Public aggregate platform statistics (no individual PII)
CREATE OR REPLACE FUNCTION public.get_public_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_donors INTEGER;
  v_verified_donors INTEGER;
  v_available_donors INTEGER;
  v_total_donations INTEGER;
  v_active_requests INTEGER;
  v_blood_groups JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total_donors FROM public.donor_details;

  SELECT COUNT(*) INTO v_verified_donors
  FROM public.donor_details
  WHERE verification_status = 'approved';

  SELECT COUNT(*) INTO v_available_donors
  FROM public.donor_details
  WHERE verification_status = 'approved'
    AND is_available = true
    AND is_publicly_discoverable = true;

  SELECT COALESCE(SUM(total_donations), 0) INTO v_total_donations
  FROM public.donor_details;

  SELECT COUNT(*) INTO v_active_requests
  FROM public.blood_requests
  WHERE status IN ('verified', 'donor_found')
    AND required_date >= CURRENT_DATE;

  SELECT COALESCE(
    jsonb_object_agg(bg, cnt),
    '{}'::jsonb
  ) INTO v_blood_groups
  FROM (
    SELECT
      g.bg,
      COUNT(d.id) FILTER (
        WHERE d.verification_status = 'approved'
          AND d.is_available = true
          AND d.is_publicly_discoverable = true
      ) AS cnt
    FROM unnest(ARRAY['A+','A-','B+','B-','AB+','AB-','O+','O-']) AS g(bg)
    LEFT JOIN public.donor_details d ON d.blood_group = g.bg
    GROUP BY g.bg
  ) sub;

  RETURN jsonb_build_object(
    'total_donors', v_total_donors,
    'verified_donors', v_verified_donors,
    'available_donors', v_available_donors,
    'total_donations', v_total_donations,
    'active_requests', v_active_requests,
    'blood_group_counts', v_blood_groups
  );
END;
$$;

-- B. Public Donor Search (strictly filters verified + available + discoverable, masks phone/email/student_id)
CREATE OR REPLACE FUNCTION public.search_public_donors(
  p_blood_group TEXT DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_batch TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_only_eligible BOOLEAN DEFAULT false,
  p_limit INTEGER DEFAULT 12,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  donor_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  blood_group TEXT,
  department_name TEXT,
  department_code TEXT,
  batch TEXT,
  location TEXT,
  is_available BOOLEAN,
  verification_status TEXT,
  last_donation_date DATE,
  total_donations INTEGER,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      p.id AS donor_id,
      p.full_name AS display_name,
      p.avatar_url,
      dd.blood_group,
      COALESCE(dept.name, 'General') AS department_name,
      COALESCE(dept.code, 'GEN') AS department_code,
      p.batch,
      dd.location,
      dd.is_available,
      dd.verification_status,
      CASE WHEN dd.show_last_donation_date THEN dd.last_donation_date ELSE NULL END AS last_donation_date,
      dd.total_donations
    FROM public.donor_details dd
    JOIN public.profiles p ON p.id = dd.user_id
    LEFT JOIN public.departments dept ON dept.id = p.department_id
    WHERE p.is_active = true
      AND dd.verification_status = 'approved'
      AND dd.is_available = true
      AND dd.is_publicly_discoverable = true
      AND (p_blood_group IS NULL OR p_blood_group = '' OR dd.blood_group = p_blood_group)
      AND (p_department_id IS NULL OR p.department_id = p_department_id)
      AND (p_batch IS NULL OR p_batch = '' OR p.batch ILIKE '%' || p_batch || '%')
      AND (p_location IS NULL OR p_location = '' OR dd.location ILIKE '%' || p_location || '%')
      AND (
        NOT p_only_eligible
        OR dd.last_donation_date IS NULL
        OR dd.last_donation_date <= (CURRENT_DATE - INTERVAL '90 days')
      )
  )
  SELECT
    f.*,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.total_donations DESC, f.display_name ASC
  LIMIT GREATEST(1, LEAST(p_limit, 50))
  OFFSET GREATEST(0, p_offset);
$$;

-- C. Public Verified Blood Requests (hides raw phone numbers from anonymous visitors)
CREATE OR REPLACE FUNCTION public.get_public_blood_requests(
  p_blood_group TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 12,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  patient_name TEXT,
  required_blood_group TEXT,
  hospital_name TEXT,
  hospital_location TEXT,
  bags_needed INTEGER,
  required_date DATE,
  required_time TIME,
  contact_person TEXT,
  contact_phone_masked TEXT,
  emergency_description TEXT,
  is_emergency BOOLEAN,
  status TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      br.id,
      br.patient_name,
      br.required_blood_group,
      br.hospital_name,
      br.hospital_location,
      br.bags_needed,
      br.required_date,
      br.required_time,
      br.contact_person,
      CASE
        WHEN auth.uid() IS NOT NULL THEN br.contact_phone
        ELSE left(br.contact_phone, 3) || '•••••' || right(br.contact_phone, 2)
      END AS contact_phone_masked,
      br.emergency_description,
      br.is_emergency,
      br.status,
      br.created_at
    FROM public.blood_requests br
    WHERE br.status IN ('verified', 'donor_found', 'completed')
      AND (p_blood_group IS NULL OR p_blood_group = '' OR br.required_blood_group = p_blood_group)
      AND (p_location IS NULL OR p_location = '' OR br.hospital_location ILIKE '%' || p_location || '%' OR br.hospital_name ILIKE '%' || p_location || '%')
      AND (p_status IS NULL OR p_status = '' OR br.status = p_status)
  )
  SELECT
    f.*,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.is_emergency DESC, f.required_date ASC, f.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50))
  OFFSET GREATEST(0, p_offset);
$$;

-- D. Send Contact Request (creates contact_request + in-app notification atomically)
CREATE OR REPLACE FUNCTION public.create_contact_request(
  p_donor_id UUID,
  p_message TEXT,
  p_requester_phone TEXT DEFAULT NULL,
  p_blood_request_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id UUID := auth.uid();
  v_requester_name TEXT;
  v_request_id UUID;
BEGIN
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to contact donors.';
  END IF;

  IF v_requester_id = p_donor_id THEN
    RAISE EXCEPTION 'You cannot send a contact request to yourself.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.donor_details
    WHERE user_id = p_donor_id AND verification_status = 'approved' AND is_available = true
  ) THEN
    RAISE EXCEPTION 'Selected donor is not currently verified and available.';
  END IF;

  SELECT full_name INTO v_requester_name FROM public.profiles WHERE id = v_requester_id;

  INSERT INTO public.contact_requests (donor_id, requester_id, blood_request_id, message, requester_phone)
  VALUES (p_donor_id, v_requester_id, p_blood_request_id, trim(p_message), NULLIF(trim(p_requester_phone), ''))
  RETURNING id INTO v_request_id;

  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (
    p_donor_id,
    'new_contact_request',
    'New Donor Contact Request',
    format('%s sent you a blood donation contact request.', COALESCE(v_requester_name, 'A university member')),
    '/dashboard',
    jsonb_build_object('contact_request_id', v_request_id)
  );

  RETURN v_request_id;
END;
$$;

-- E. Moderator / Admin Verification Decision RPC
CREATE OR REPLACE FUNCTION public.review_donor_verification(
  p_verification_id UUID,
  p_decision TEXT,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_target_user UUID;
  v_req_bg TEXT;
BEGIN
  IF NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Moderator or Super Admin role required.';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected.';
  END IF;

  SELECT user_id, requested_blood_group
  INTO v_target_user, v_req_bg
  FROM public.verification_requests
  WHERE id = p_verification_id;

  IF v_target_user IS NULL THEN
    RAISE EXCEPTION 'Verification request not found.';
  END IF;

  IF v_target_user = v_actor THEN
    RAISE EXCEPTION 'Security restriction: You cannot approve or reject your own verification request.';
  END IF;

  UPDATE public.verification_requests
  SET
    status = p_decision,
    reviewed_by = v_actor,
    review_notes = p_review_notes,
    reviewed_at = now()
  WHERE id = p_verification_id;

  UPDATE public.donor_details
  SET
    verification_status = p_decision,
    blood_group = v_req_bg
  WHERE user_id = v_target_user;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_target_user,
    CASE WHEN p_decision = 'approved' THEN 'verification_approved' ELSE 'verification_rejected' END,
    CASE WHEN p_decision = 'approved' THEN 'Donor Verification Approved' ELSE 'Donor Verification Requires Attention' END,
    CASE
      WHEN p_decision = 'approved' THEN 'Your student identity and blood group have been verified by a campus moderator.'
      ELSE COALESCE('Verification rejected: ' || p_review_notes, 'Your verification request was not approved. Please review your details.')
    END,
    '/dashboard'
  );

  INSERT INTO public.admin_logs (actor_id, action, target_table, target_id, details)
  VALUES (
    v_actor,
    'verification_' || p_decision,
    'verification_requests',
    p_verification_id::text,
    jsonb_build_object('target_user', v_target_user, 'notes', p_review_notes)
  );
END;
$$;

-- F. Moderator / Admin Blood Request Status Update RPC
CREATE OR REPLACE FUNCTION public.moderate_blood_request(
  p_request_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_requester UUID;
  v_patient TEXT;
  v_current_status TEXT;
  v_clean_notes TEXT := NULLIF(trim(COALESCE(p_notes, '')), '');
  v_notif_title TEXT;
  v_notif_message TEXT;
BEGIN
  IF NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Moderator or Super Admin role required.';
  END IF;

  IF p_new_status NOT IN ('verified', 'donor_found', 'completed', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Invalid status transition.';
  END IF;

  SELECT requester_id, patient_name, status
  INTO v_requester, v_patient, v_current_status
  FROM public.blood_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blood request not found.';
  END IF;

  IF v_current_status = 'completed' THEN
    RAISE EXCEPTION 'This blood request has already been marked as completed.';
  END IF;

  IF v_current_status IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'Cannot update a blood request that is already %.', v_current_status;
  END IF;

  IF p_new_status = 'completed' AND v_current_status NOT IN ('verified', 'donor_found') THEN
    RAISE EXCEPTION 'Blood request must be verified before it can be marked completed.';
  END IF;

  IF p_new_status = 'donor_found' AND v_current_status <> 'verified' THEN
    RAISE EXCEPTION 'Blood request must be verified before marking donor found.';
  END IF;

  IF p_new_status = v_current_status THEN
    RAISE EXCEPTION 'Blood request is already %.', v_current_status;
  END IF;

  UPDATE public.blood_requests
  SET
    status = p_new_status,
    verified_by = CASE WHEN p_new_status = 'verified' THEN v_actor ELSE verified_by END,
    verified_at = CASE WHEN p_new_status = 'verified' THEN now() ELSE verified_at END
  WHERE id = p_request_id;

  IF v_requester IS NOT NULL THEN
    v_notif_title := left('Blood Request Updated: ' || replace(initcap(p_new_status), '_', ' '), 160);
    v_notif_message := left(
      trim(
        format(
          'Request for patient %s is now %s.%s',
          COALESCE(NULLIF(trim(v_patient), ''), 'Patient'),
          replace(p_new_status, '_', ' '),
          CASE WHEN v_clean_notes IS NOT NULL THEN ' ' || v_clean_notes ELSE '' END
        )
      ),
      600
    );

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_requester,
      CASE WHEN p_new_status = 'verified' THEN 'blood_request_verified' ELSE 'request_status_updated' END,
      v_notif_title,
      v_notif_message,
      '/requests'
    );
  END IF;

  INSERT INTO public.admin_logs (actor_id, action, target_table, target_id, details)
  VALUES (
    v_actor,
    'blood_request_' || p_new_status,
    'blood_requests',
    p_request_id::text,
    jsonb_build_object(
      'previous_status', v_current_status,
      'new_status', p_new_status,
      'notes', v_clean_notes
    )
  );
END;
$$;

-- G. Super Admin Role Change RPC
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

-- H. Scheduled / Server-side Expiration Helper for Past-Due Requests
CREATE OR REPLACE FUNCTION public.expire_past_due_blood_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE public.blood_requests
  SET status = 'expired'
  WHERE status IN ('pending', 'verified')
    AND (required_date < CURRENT_DATE OR (required_date = CURRENT_DATE AND required_time < CURRENT_TIME));

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;

-- I. Server/Database-backed Role Verification RPC for Protected Routes & Staff Services
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

-- Allow authenticated & anonymous callers to run safe public RPCs
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_account_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_role(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_platform_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_donors(TEXT, UUID, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_blood_requests(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_contact_request(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_donor_verification(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_blood_request(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_past_due_blood_requests() TO authenticated;
