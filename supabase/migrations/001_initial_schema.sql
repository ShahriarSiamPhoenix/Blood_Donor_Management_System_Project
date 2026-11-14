-- ============================================================================
-- Campus Blood Connect (Netrokona University)
-- Migration 001: Core Normalized Schema, Constraints, Indexes, and Triggers
-- ============================================================================

-- Enable helpful extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. DEPARTMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (char_length(trim(code)) BETWEEN 2 AND 16),
  name TEXT NOT NULL UNIQUE CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  name_bn TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. PROFILES (1-to-1 with auth.users)
-- Role security: defaults to 'student' and cannot be elevated by the user.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 120),
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL CHECK (char_length(trim(phone)) BETWEEN 10 AND 20),
  student_id TEXT NOT NULL UNIQUE CHECK (char_length(trim(student_id)) BETWEEN 4 AND 32),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  batch TEXT NOT NULL CHECK (char_length(trim(batch)) BETWEEN 1 AND 32),
  role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'moderator', 'super_admin')),
  avatar_url TEXT,
  privacy_policy_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. DONOR DETAILS (1-to-1 with profiles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donor_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  blood_group TEXT NOT NULL
    CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  location TEXT NOT NULL DEFAULT 'Netrokona Campus',
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_publicly_discoverable BOOLEAN NOT NULL DEFAULT true,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  last_donation_date DATE,
  total_donations INTEGER NOT NULL DEFAULT 0 CHECK (total_donations >= 0),
  contact_preference TEXT NOT NULL DEFAULT 'in_app'
    CHECK (contact_preference IN ('in_app', 'phone_on_approval')),
  show_last_donation_date BOOLEAN NOT NULL DEFAULT true,
  bio TEXT CHECK (bio IS NULL OR char_length(bio) <= 400),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. VERIFICATION REQUESTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_blood_group TEXT NOT NULL
    CHECK (requested_blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  student_id_snapshot TEXT NOT NULL,
  document_url TEXT,
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. BLOOD REQUESTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL CHECK (char_length(trim(requester_name)) BETWEEN 2 AND 120),
  requester_relation TEXT DEFAULT 'Self / Family',
  patient_name TEXT NOT NULL CHECK (char_length(trim(patient_name)) BETWEEN 2 AND 120),
  required_blood_group TEXT NOT NULL
    CHECK (required_blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  hospital_name TEXT NOT NULL CHECK (char_length(trim(hospital_name)) BETWEEN 2 AND 160),
  hospital_location TEXT NOT NULL CHECK (char_length(trim(hospital_location)) BETWEEN 2 AND 160),
  bags_needed INTEGER NOT NULL CHECK (bags_needed BETWEEN 1 AND 20),
  required_date DATE NOT NULL,
  required_time TIME NOT NULL,
  contact_person TEXT NOT NULL CHECK (char_length(trim(contact_person)) BETWEEN 2 AND 120),
  contact_phone TEXT NOT NULL CHECK (char_length(trim(contact_phone)) BETWEEN 10 AND 20),
  emergency_description TEXT NOT NULL CHECK (char_length(trim(emergency_description)) BETWEEN 10 AND 1000),
  is_emergency BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'donor_found', 'completed', 'cancelled', 'expired')),
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  dedup_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. DONATION HISTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blood_request_id UUID REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  blood_group TEXT NOT NULL
    CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  donation_date DATE NOT NULL CHECK (donation_date <= CURRENT_DATE),
  hospital_name TEXT NOT NULL CHECK (char_length(trim(hospital_name)) BETWEEN 2 AND 160),
  units_donated INTEGER NOT NULL DEFAULT 1 CHECK (units_donated BETWEEN 1 AND 4),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. CONTACT REQUESTS (Authorized donor-requester contact channel)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blood_request_id UUID REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  message TEXT NOT NULL CHECK (char_length(trim(message)) BETWEEN 5 AND 600),
  requester_phone TEXT CHECK (requester_phone IS NULL OR char_length(trim(requester_phone)) BETWEEN 10 AND 20),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'closed')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_contact_request CHECK (donor_id <> requester_id)
);

-- ----------------------------------------------------------------------------
-- 8. NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'new_contact_request',
    'blood_request_verified',
    'donor_contact_request',
    'request_status_updated',
    'donation_completed',
    'verification_approved',
    'verification_rejected',
    'announcement'
  )),
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 160),
  message TEXT NOT NULL CHECK (char_length(trim(message)) BETWEEN 2 AND 600),
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 9. REPORTS (Abuse / Misconduct / Inaccurate Request Reports)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  blood_request_id UUID REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 160),
  details TEXT NOT NULL CHECK (char_length(trim(details)) BETWEEN 10 AND 1000),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT report_target_required CHECK (
    reported_user_id IS NOT NULL OR blood_request_id IS NOT NULL
  )
);

-- ----------------------------------------------------------------------------
-- 10. ADMIN LOGS (Immutable audit trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (char_length(trim(action)) BETWEEN 2 AND 120),
  target_table TEXT NOT NULL,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 11. PLATFORM SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 12. STUDENT TESTIMONIALS (Approved real student stories only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quote TEXT NOT NULL CHECK (char_length(trim(quote)) BETWEEN 20 AND 500),
  role_label TEXT NOT NULL DEFAULT 'Student Donor',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR QUERY PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_donor_details_blood_group ON public.donor_details(blood_group);
CREATE INDEX IF NOT EXISTS idx_donor_details_discovery ON public.donor_details(verification_status, is_available, is_publicly_discoverable);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status_date ON public.blood_requests(status, required_date);
CREATE INDEX IF NOT EXISTS idx_blood_requests_group ON public.blood_requests(required_blood_group);
CREATE INDEX IF NOT EXISTS idx_blood_requests_requester ON public.blood_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_blood_requests_dedup ON public.blood_requests(dedup_fingerprint, created_at);
CREATE INDEX IF NOT EXISTS idx_donation_history_donor ON public.donation_history(donor_id, donation_date DESC);
CREATE INDEX IF NOT EXISTS idx_contact_requests_donor ON public.contact_requests(donor_id, status);
CREATE INDEX IF NOT EXISTS idx_contact_requests_requester ON public.contact_requests(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.verification_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- TRIGGERS & AUTOMATION FUNCTIONS
-- ----------------------------------------------------------------------------

-- Updated-at timestamp trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'departments',
    'profiles',
    'donor_details',
    'verification_requests',
    'blood_requests',
    'donation_history',
    'contact_requests',
    'reports',
    'platform_settings',
    'testimonials'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- Automatically provision profile + donor_details + initial verification_request on auth signup
-- SECURITY: Never trusts raw_user_meta_data for 'role'. Always forces role = 'student'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_student_id TEXT;
  v_department_id UUID;
  v_batch TEXT;
  v_blood_group TEXT;
BEGIN
  v_full_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1));
  v_phone := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''), '01000000000');
  v_student_id := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'student_id'), ''), 'PENDING-' || substr(NEW.id::text, 1, 8));
  v_batch := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'batch'), ''), 'Unknown');
  v_blood_group := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'blood_group'), ''), 'O+');

  IF v_blood_group NOT IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') THEN
    v_blood_group := 'O+';
  END IF;

  BEGIN
    v_department_id := NULLIF(NEW.raw_user_meta_data->>'department_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_department_id := NULL;
  END;

  INSERT INTO public.profiles (
    id, full_name, email, phone, student_id, department_id, batch, role, privacy_policy_accepted_at
  )
  VALUES (
    NEW.id, v_full_name, NEW.email, v_phone, v_student_id, v_department_id, v_batch, 'student', now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.donor_details (
    user_id, blood_group, verification_status
  )
  VALUES (
    NEW.id, v_blood_group, 'pending'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.verification_requests (
    user_id, requested_blood_group, student_id_snapshot, notes, status
  )
  VALUES (
    NEW.id, v_blood_group, v_student_id, 'Initial registration verification request', 'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Prevent privilege escalation: non-super-admins cannot change role or is_active
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

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

-- Force re-verification when blood group changes; prevent donor from approving self
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

  -- If blood_group changed by donor, reset verification_status to 'pending'
  IF NEW.blood_group IS DISTINCT FROM OLD.blood_group THEN
    IF COALESCE(v_caller_role, 'student') = 'student' AND NOT v_is_privileged_session THEN
      NEW.verification_status := 'pending';
    END IF;
  END IF;

  -- Nobody can approve/reject their own verification status via API JWT (must be reviewed by another staff member or SQL Editor)
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NOT v_is_privileged_session
     AND OLD.user_id = auth.uid() THEN
    IF NOT (NEW.blood_group IS DISTINCT FROM OLD.blood_group AND NEW.verification_status = 'pending') THEN
      RAISE EXCEPTION 'Security restriction: You cannot approve or reject your own donor verification status.';
    END IF;
  END IF;

  -- Non-moderators/admins cannot alter verification_status or total_donations directly
  IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status OR NEW.total_donations IS DISTINCT FROM OLD.total_donations) THEN
    IF NOT v_is_privileged_session
       AND (COALESCE(v_caller_role, 'student') NOT IN ('moderator', 'super_admin') OR COALESCE(v_caller_active, false) = false) THEN
      -- Allow internal reset to 'pending' on blood_group change only
      IF NOT (NEW.blood_group IS DISTINCT FROM OLD.blood_group AND NEW.verification_status = 'pending' AND NEW.total_donations = OLD.total_donations) THEN
        RAISE EXCEPTION 'Only authorized moderators or administrators can verify donors or modify donation totals.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_donor_details_update ON public.donor_details;
CREATE TRIGGER trg_guard_donor_details_update
  BEFORE UPDATE ON public.donor_details
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_donor_details_update();

-- Sync donor_details donation stats when a donation_history record is added
CREATE OR REPLACE FUNCTION public.sync_donor_donation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.donor_details
  SET
    total_donations = total_donations + 1,
    last_donation_date = GREATEST(COALESCE(last_donation_date, NEW.donation_date), NEW.donation_date)
  WHERE user_id = NEW.donor_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    NEW.donor_id,
    'donation_completed',
    'Donation Recorded',
    format('Your blood donation at %s on %s has been recorded.', NEW.hospital_name, NEW.donation_date::text),
    '/dashboard'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_donor_donation_stats ON public.donation_history;
CREATE TRIGGER trg_sync_donor_donation_stats
  AFTER INSERT ON public.donation_history
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_donor_donation_stats();
