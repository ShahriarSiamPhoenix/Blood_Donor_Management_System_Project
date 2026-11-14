-- ============================================================================
-- Campus Blood Connect (Netrokona University)
-- Migration 008: Community-Based Blood Request & Donor Interest Workflow
-- Safe to run multiple times (idempotent) without deleting existing data.
-- Maintains full compatibility with 007_donation_stats_sync.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BLOOD REQUEST INTERESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blood_request_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT CHECK (message IS NULL OR char_length(trim(message)) <= 400),
  share_contact BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'interested'
    CHECK (status IN ('interested', 'selected', 'withdrawn', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_request_donor_interest UNIQUE (blood_request_id, donor_id)
);

CREATE INDEX IF NOT EXISTS idx_bri_request_status
  ON public.blood_request_interests(blood_request_id, status);

CREATE INDEX IF NOT EXISTS idx_bri_donor_status
  ON public.blood_request_interests(donor_id, status);

DROP TRIGGER IF EXISTS trg_blood_request_interests_updated_at ON public.blood_request_interests;
CREATE TRIGGER trg_blood_request_interests_updated_at
  BEFORE UPDATE ON public.blood_request_interests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.blood_request_interests ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. EXPAND NOTIFICATIONS TYPE CONSTRAINT FOR INTEREST & SELECTION EVENTS
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_con_name TEXT;
BEGIN
  FOR v_con_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'notifications'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS %I;', v_con_name);
  END LOOP;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'new_contact_request',
      'blood_request_verified',
      'donor_contact_request',
      'request_status_updated',
      'donation_completed',
      'verification_approved',
      'verification_rejected',
      'announcement',
      'donor_interest',
      'donor_selected',
      'interest_withdrawn'
    ));
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. RLS POLICIES FOR BLOOD REQUESTS & INTERESTS
-- ----------------------------------------------------------------------------

-- blood_request_interests RLS
DROP POLICY IF EXISTS "Participants and staff view request interests" ON public.blood_request_interests;
CREATE POLICY "Participants and staff view request interests"
  ON public.blood_request_interests FOR SELECT
  USING (
    auth.uid() = donor_id
    OR public.is_moderator_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.blood_requests br
      WHERE br.id = blood_request_id
        AND br.requester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members express interest on active requests" ON public.blood_request_interests;
CREATE POLICY "Members express interest on active requests"
  ON public.blood_request_interests FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND donor_id = auth.uid()
    AND status = 'interested'
    AND public.is_my_account_active()
    AND EXISTS (
      SELECT 1 FROM public.blood_requests br
      WHERE br.id = blood_request_id
        AND br.requester_id IS DISTINCT FROM auth.uid()
        AND br.status IN ('pending', 'verified', 'donor_found')
    )
  );

DROP POLICY IF EXISTS "Participants or staff update request interests" ON public.blood_request_interests;
CREATE POLICY "Participants or staff update request interests"
  ON public.blood_request_interests FOR UPDATE
  USING (
    auth.uid() = donor_id
    OR public.is_moderator_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.blood_requests br
      WHERE br.id = blood_request_id
        AND br.requester_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = donor_id
    OR public.is_moderator_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.blood_requests br
      WHERE br.id = blood_request_id
        AND br.requester_id = auth.uid()
    )
  );

-- blood_requests RLS: immediate community visibility + owner management + staff oversight
DROP POLICY IF EXISTS "Authorized users read blood requests" ON public.blood_requests;
CREATE POLICY "Authorized users read blood requests"
  ON public.blood_requests FOR SELECT
  USING (
    auth.uid() = requester_id
    OR public.is_moderator_or_admin()
    OR (
      auth.uid() IS NOT NULL
      AND status IN ('pending', 'verified', 'donor_found', 'completed')
    )
  );

DROP POLICY IF EXISTS "Authenticated users create blood requests" ON public.blood_requests;
CREATE POLICY "Authenticated users create blood requests"
  ON public.blood_requests FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND requester_id = auth.uid()
    AND status = 'pending'
    AND public.is_my_account_active()
  );

DROP POLICY IF EXISTS "Requesters edit/cancel own pending or staff manage all" ON public.blood_requests;
DROP POLICY IF EXISTS "Requesters edit/cancel own active or staff manage all" ON public.blood_requests;
CREATE POLICY "Requesters edit/cancel own active or staff manage all"
  ON public.blood_requests FOR UPDATE
  USING (
    (auth.uid() = requester_id AND status IN ('pending', 'verified', 'donor_found'))
    OR public.is_moderator_or_admin()
  )
  WITH CHECK (
    (
      auth.uid() = requester_id
      AND status IN ('pending', 'verified', 'donor_found', 'cancelled')
    )
    OR public.is_moderator_or_admin()
  );

DROP POLICY IF EXISTS "Staff remove non-completed blood requests" ON public.blood_requests;
CREATE POLICY "Staff remove non-completed blood requests"
  ON public.blood_requests FOR DELETE
  USING (
    public.is_moderator_or_admin()
    AND status <> 'completed'
  );

-- ----------------------------------------------------------------------------
-- 4. STATUS TRANSITION GUARD TRIGGER (COMMUNITY WORKFLOW)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_blood_request_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_privileged_session BOOLEAN;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Allow privileged SQL Editor / migration / service_role sessions
  v_is_privileged_session :=
    COALESCE(auth.role(), '') = 'service_role'
    OR (auth.uid() IS NULL AND COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated'));

  IF v_is_privileged_session THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'This blood request has already been marked as completed and cannot be modified.';
  END IF;

  IF OLD.status IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'Cannot update a blood request that is already %.', OLD.status;
  END IF;

  -- Prevent reverting verified back to pending
  IF OLD.status = 'verified' AND NEW.status = 'pending' THEN
    RAISE EXCEPTION 'Cannot revert a verified blood request back to pending.';
  END IF;

  -- Allow donor_found to reopen to pending/verified only when selected donor is cleared (withdrawal)
  IF OLD.status = 'donor_found' AND NEW.status IN ('pending', 'verified') THEN
    IF NEW.fulfilled_by_donor_id IS NOT NULL THEN
      RAISE EXCEPTION 'Clear the selected donor before reopening this blood request.';
    END IF;
    IF NEW.status = 'verified' AND OLD.verified_by IS NULL THEN
      RAISE EXCEPTION 'Cannot mark request verified without moderator verification.';
    END IF;
    RETURN NEW;
  END IF;

  -- Valid community transitions from pending/verified/donor_found
  IF NEW.status NOT IN ('verified', 'donor_found', 'completed', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Invalid blood request status transition.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_blood_request_status ON public.blood_requests;
CREATE TRIGGER trg_guard_blood_request_status
  BEFORE UPDATE ON public.blood_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_blood_request_status_transition();

-- ----------------------------------------------------------------------------
-- 5. PUBLIC STATS & PUBLIC BLOOD REQUESTS (IMMEDIATE PUBLISHING)
-- ----------------------------------------------------------------------------

-- Include active community 'pending' requests in active_requests count,
-- while preserving exact 007 deduplicated completed donation counting.
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

  SELECT
    (SELECT COUNT(*)::INTEGER FROM public.blood_requests WHERE status = 'completed')
    +
    (
      SELECT COUNT(*)::INTEGER
      FROM public.donation_history dh
      WHERE dh.blood_request_id IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM public.blood_requests br
           WHERE br.id = dh.blood_request_id
             AND br.status = 'completed'
         )
    )
  INTO v_total_donations;

  SELECT COUNT(*) INTO v_active_requests
  FROM public.blood_requests
  WHERE status IN ('pending', 'verified', 'donor_found')
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

-- Return published community blood requests immediately (pending, verified, donor_found, completed)
-- with masked phones for anonymous users, interest counts, viewer interest status, and owner flags.
DROP FUNCTION IF EXISTS public.get_public_blood_requests(TEXT, TEXT, TEXT, INTEGER, INTEGER);
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
  requester_name TEXT,
  is_owner BOOLEAN,
  interested_count INTEGER,
  viewer_interest_status TEXT,
  fulfilled_by_donor_id UUID,
  fulfilled_donor_name TEXT,
  verified_at TIMESTAMPTZ,
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
      br.created_at,
      br.requester_name,
      (auth.uid() IS NOT NULL AND br.requester_id = auth.uid()) AS is_owner,
      (
        SELECT COUNT(*)::INTEGER
        FROM public.blood_request_interests bri
        WHERE bri.blood_request_id = br.id
          AND bri.status IN ('interested', 'selected', 'completed')
      ) AS interested_count,
      (
        SELECT bri.status
        FROM public.blood_request_interests bri
        WHERE auth.uid() IS NOT NULL
          AND bri.blood_request_id = br.id
          AND bri.donor_id = auth.uid()
        LIMIT 1
      ) AS viewer_interest_status,
      CASE
        WHEN auth.uid() IS NOT NULL AND (
          br.requester_id = auth.uid()
          OR br.fulfilled_by_donor_id = auth.uid()
          OR public.is_moderator_or_admin()
        )
        THEN br.fulfilled_by_donor_id
        ELSE NULL
      END AS fulfilled_by_donor_id,
      CASE
        WHEN auth.uid() IS NOT NULL AND (
          br.requester_id = auth.uid()
          OR br.fulfilled_by_donor_id = auth.uid()
          OR public.is_moderator_or_admin()
        )
        THEN (SELECT p.full_name FROM public.profiles p WHERE p.id = br.fulfilled_by_donor_id)
        ELSE NULL
      END AS fulfilled_donor_name,
      br.verified_at
    FROM public.blood_requests br
    WHERE br.status IN ('pending', 'verified', 'donor_found', 'completed')
      AND (p_blood_group IS NULL OR p_blood_group = '' OR br.required_blood_group = p_blood_group)
      AND (
        p_location IS NULL
        OR p_location = ''
        OR br.hospital_location ILIKE '%' || p_location || '%'
        OR br.hospital_name ILIKE '%' || p_location || '%'
      )
      AND (
        p_status IS NULL
        OR p_status = ''
        OR (p_status = 'active' AND br.status IN ('pending', 'verified', 'donor_found'))
        OR br.status = p_status
      )
  )
  SELECT
    f.*,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY
    CASE WHEN f.status IN ('pending', 'verified', 'donor_found') THEN 0 ELSE 1 END ASC,
    f.is_emergency DESC,
    f.required_date ASC,
    f.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50))
  OFFSET GREATEST(0, p_offset);
$$;

-- ----------------------------------------------------------------------------
-- 6. DONOR INTEREST & CONTACT REQUEST RPCs
-- ----------------------------------------------------------------------------

-- Express interest in an active blood request (duplicate-safe, notifies owner)
CREATE OR REPLACE FUNCTION public.express_blood_request_interest(
  p_request_id UUID,
  p_message TEXT DEFAULT NULL,
  p_share_contact BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_is_active BOOLEAN;
  v_donor_name TEXT;
  v_donor_bg TEXT;
  v_requester_id UUID;
  v_patient_name TEXT;
  v_request_status TEXT;
  v_existing_id UUID;
  v_existing_status TEXT;
  v_interest_id UUID;
  v_interested_count INTEGER;
  v_clean_msg TEXT := NULLIF(trim(COALESCE(p_message, '')), '');
  v_notif_msg TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Please sign in as a registered member to express interest.';
  END IF;

  SELECT p.is_active, p.full_name, dd.blood_group
  INTO v_is_active, v_donor_name, v_donor_bg
  FROM public.profiles p
  LEFT JOIN public.donor_details dd ON dd.user_id = p.id
  WHERE p.id = v_actor;

  IF NOT FOUND OR COALESCE(v_is_active, false) = false THEN
    RAISE EXCEPTION 'Your account must be active to express interest in a blood request.';
  END IF;

  SELECT requester_id, patient_name, status
  INTO v_requester_id, v_patient_name, v_request_status
  FROM public.blood_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blood request not found.';
  END IF;

  IF v_requester_id = v_actor THEN
    RAISE EXCEPTION 'You cannot express interest in your own blood request.';
  END IF;

  IF v_request_status NOT IN ('pending', 'verified', 'donor_found') THEN
    RAISE EXCEPTION 'This blood request is no longer active.';
  END IF;

  SELECT id, status
  INTO v_existing_id, v_existing_status
  FROM public.blood_request_interests
  WHERE blood_request_id = p_request_id
    AND donor_id = v_actor
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_status IN ('interested', 'selected', 'completed') THEN
      RAISE EXCEPTION 'You have already expressed interest in this blood request.';
    END IF;

    UPDATE public.blood_request_interests
    SET
      status = 'interested',
      message = left(v_clean_msg, 400),
      share_contact = COALESCE(p_share_contact, false)
    WHERE id = v_existing_id
    RETURNING id INTO v_interest_id;
  ELSE
    INSERT INTO public.blood_request_interests (
      blood_request_id,
      donor_id,
      message,
      share_contact,
      status
    )
    VALUES (
      p_request_id,
      v_actor,
      left(v_clean_msg, 400),
      COALESCE(p_share_contact, false),
      'interested'
    )
    RETURNING id INTO v_interest_id;
  END IF;

  IF v_requester_id IS NOT NULL THEN
    v_notif_msg := left(
      trim(
        format(
          '%s (%s) is interested in donating blood for %s. View their profile to see details.',
          COALESCE(NULLIF(trim(v_donor_name), ''), 'Someone'),
          COALESCE(NULLIF(trim(v_donor_bg), ''), 'Donor'),
          COALESCE(NULLIF(trim(v_patient_name), ''), 'your request')
        )
      ),
      600
    );

    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_requester_id,
      'donor_interest',
      'New Donor Interest',
      v_notif_msg,
      '/requests?requestId=' || p_request_id::text || '&panel=interested',
      jsonb_build_object(
        'blood_request_id', p_request_id,
        'interested_member_id', v_actor,
        'interest_id', v_interest_id
      )
    );
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_interested_count
  FROM public.blood_request_interests
  WHERE blood_request_id = p_request_id
    AND status IN ('interested', 'selected', 'completed');

  RETURN jsonb_build_object(
    'interest_id', v_interest_id,
    'status', 'interested',
    'interested_count', v_interested_count
  );
END;
$$;

-- Withdraw interest while request is still active
CREATE OR REPLACE FUNCTION public.withdraw_blood_request_interest(
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_donor_name TEXT;
  v_requester_id UUID;
  v_patient_name TEXT;
  v_request_status TEXT;
  v_verified_by UUID;
  v_fulfilled_by UUID;
  v_interest_id UUID;
  v_interest_status TEXT;
  v_was_selected BOOLEAN := false;
  v_reverted_status TEXT;
  v_interested_count INTEGER;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT requester_id, patient_name, status, verified_by, fulfilled_by_donor_id
  INTO v_requester_id, v_patient_name, v_request_status, v_verified_by, v_fulfilled_by
  FROM public.blood_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blood request not found.';
  END IF;

  IF v_request_status NOT IN ('pending', 'verified', 'donor_found') THEN
    RAISE EXCEPTION 'Cannot withdraw interest because this request is already %.', v_request_status;
  END IF;

  SELECT id, status
  INTO v_interest_id, v_interest_status
  FROM public.blood_request_interests
  WHERE blood_request_id = p_request_id
    AND donor_id = v_actor
    AND status IN ('interested', 'selected')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active interest record found for this request.';
  END IF;

  v_was_selected := (v_interest_status = 'selected' OR v_fulfilled_by = v_actor);

  UPDATE public.blood_request_interests
  SET status = 'withdrawn'
  WHERE id = v_interest_id;

  IF v_was_selected THEN
    v_reverted_status := CASE
      WHEN v_request_status = 'donor_found' THEN
        CASE WHEN v_verified_by IS NOT NULL THEN 'verified' ELSE 'pending' END
      ELSE v_request_status
    END;

    UPDATE public.blood_requests
    SET
      fulfilled_by_donor_id = NULL,
      status = v_reverted_status
    WHERE id = p_request_id;
  END IF;

  IF v_requester_id IS NOT NULL THEN
    SELECT full_name INTO v_donor_name FROM public.profiles WHERE id = v_actor;

    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_requester_id,
      'interest_withdrawn',
      CASE WHEN v_was_selected THEN 'Selected Donor Withdrew' ELSE 'Donor Interest Withdrawn' END,
      left(
        format(
          '%s withdrew their interest for patient %s.%s',
          COALESCE(NULLIF(trim(v_donor_name), ''), 'A member'),
          COALESCE(NULLIF(trim(v_patient_name), ''), 'Patient'),
          CASE WHEN v_was_selected THEN ' Your request is open again for another donor.' ELSE '' END
        ),
        600
      ),
      '/requests?requestId=' || p_request_id::text || '&panel=interested',
      jsonb_build_object(
        'blood_request_id', p_request_id,
        'interested_member_id', v_actor,
        'was_selected', v_was_selected
      )
    );
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_interested_count
  FROM public.blood_request_interests
  WHERE blood_request_id = p_request_id
    AND status IN ('interested', 'selected', 'completed');

  RETURN jsonb_build_object(
    'status', 'withdrawn',
    'interested_count', v_interested_count,
    'request_status', COALESCE(v_reverted_status, v_request_status)
  );
END;
$$;

-- Owner & staff-only interested members query (enforces contact privacy)
DROP FUNCTION IF EXISTS public.get_blood_request_interests(UUID);
CREATE OR REPLACE FUNCTION public.get_blood_request_interests(
  p_request_id UUID
)
RETURNS TABLE (
  interest_id UUID,
  blood_request_id UUID,
  donor_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  blood_group TEXT,
  department_name TEXT,
  department_code TEXT,
  batch TEXT,
  location TEXT,
  last_donation_date DATE,
  total_donations INTEGER,
  is_available BOOLEAN,
  verification_status TEXT,
  contact_preference TEXT,
  contact_phone TEXT,
  contact_request_status TEXT,
  share_contact BOOLEAN,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_requester_id UUID;
  v_is_staff BOOLEAN := public.is_moderator_or_admin();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to view interested donors.';
  END IF;

  SELECT br.requester_id
  INTO v_requester_id
  FROM public.blood_requests br
  WHERE br.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blood request not found.';
  END IF;

  IF v_requester_id IS DISTINCT FROM v_actor AND NOT v_is_staff THEN
    RAISE EXCEPTION 'Unauthorized: Only the request owner or staff can view interested members.';
  END IF;

  RETURN QUERY
  SELECT
    bri.id AS interest_id,
    bri.blood_request_id,
    bri.donor_id,
    p.full_name,
    p.avatar_url,
    COALESCE(dd.blood_group, 'O+') AS blood_group,
    COALESCE(dept.name, 'General') AS department_name,
    COALESCE(dept.code, 'GEN') AS department_code,
    p.batch,
    COALESCE(dd.location, 'Netrokona Campus') AS location,
    CASE
      WHEN COALESCE(dd.show_last_donation_date, true) OR v_is_staff THEN dd.last_donation_date
      ELSE NULL
    END AS last_donation_date,
    COALESCE(dd.total_donations, 0) AS total_donations,
    COALESCE(dd.is_available, false) AS is_available,
    COALESCE(dd.verification_status, 'pending') AS verification_status,
    COALESCE(dd.contact_preference, 'in_app') AS contact_preference,
    CASE
      WHEN bri.share_contact = true
        OR bri.status IN ('selected', 'completed')
        OR EXISTS (
          SELECT 1 FROM public.contact_requests cr
          WHERE cr.donor_id = bri.donor_id
            AND cr.requester_id = v_requester_id
            AND cr.status = 'accepted'
        )
        OR v_is_staff
      THEN p.phone
      ELSE NULL
    END AS contact_phone,
    (
      SELECT cr.status
      FROM public.contact_requests cr
      WHERE cr.donor_id = bri.donor_id
        AND cr.requester_id = v_requester_id
      ORDER BY cr.created_at DESC
      LIMIT 1
    ) AS contact_request_status,
    bri.share_contact,
    bri.message,
    bri.status,
    bri.created_at
  FROM public.blood_request_interests bri
  JOIN public.profiles p ON p.id = bri.donor_id
  LEFT JOIN public.donor_details dd ON dd.user_id = p.id
  LEFT JOIN public.departments dept ON dept.id = p.department_id
  WHERE bri.blood_request_id = p_request_id
    AND bri.status IN ('interested', 'selected', 'completed')
  ORDER BY
    CASE bri.status WHEN 'selected' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END ASC,
    bri.created_at ASC;
END;
$$;

-- Allow contacting interested donors on a blood request even if donor verification is pending
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
  v_is_verified_donor BOOLEAN := false;
  v_is_interested_donor BOOLEAN := false;
BEGIN
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to contact donors.';
  END IF;

  IF v_requester_id = p_donor_id THEN
    RAISE EXCEPTION 'You cannot send a contact request to yourself.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.donor_details
    WHERE user_id = p_donor_id AND verification_status = 'approved' AND is_available = true
  ) INTO v_is_verified_donor;

  IF p_blood_request_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.blood_request_interests bri
      JOIN public.blood_requests br ON br.id = bri.blood_request_id
      WHERE bri.blood_request_id = p_blood_request_id
        AND bri.donor_id = p_donor_id
        AND bri.status IN ('interested', 'selected')
        AND br.requester_id = v_requester_id
    ) INTO v_is_interested_donor;
  END IF;

  IF NOT v_is_verified_donor AND NOT v_is_interested_donor THEN
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
    jsonb_build_object('contact_request_id', v_request_id, 'blood_request_id', p_blood_request_id)
  );

  RETURN v_request_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. OWNER MANAGEMENT RPCs (SELECT DONOR / COMPLETE / CANCEL) + STAFF REMOVAL
-- ----------------------------------------------------------------------------

-- Owner selects donor -> marks request donor_found, saves fulfilled_by_donor_id, notifies donor
CREATE OR REPLACE FUNCTION public.owner_select_donor_for_request(
  p_request_id UUID,
  p_donor_id UUID,
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
  v_status TEXT;
  v_bg TEXT;
  v_hospital TEXT;
  v_prev_donor UUID;
  v_donor_active BOOLEAN;
  v_clean_notes TEXT := NULLIF(trim(COALESCE(p_notes, '')), '');
  v_other RECORD;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT requester_id, patient_name, status, required_blood_group, hospital_name, fulfilled_by_donor_id
  INTO v_requester, v_patient, v_status, v_bg, v_hospital, v_prev_donor
  FROM public.blood_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blood request not found.';
  END IF;

  IF v_requester IS DISTINCT FROM v_actor AND NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only the request owner can select a donor.';
  END IF;

  IF v_status NOT IN ('pending', 'verified', 'donor_found') THEN
    RAISE EXCEPTION 'Cannot select a donor for a request that is already %.', v_status;
  END IF;

  IF p_donor_id IS NULL THEN
    RAISE EXCEPTION 'Please select a donor.';
  END IF;

  IF p_donor_id = v_requester THEN
    RAISE EXCEPTION 'The request owner cannot select themselves as the fulfilling donor.';
  END IF;

  SELECT is_active INTO v_donor_active FROM public.profiles WHERE id = p_donor_id;
  IF NOT FOUND OR COALESCE(v_donor_active, false) = false THEN
    RAISE EXCEPTION 'Selected donor account is not active or not found.';
  END IF;

  -- Update interest statuses cleanly
  UPDATE public.blood_request_interests
  SET status = 'interested'
  WHERE blood_request_id = p_request_id
    AND status = 'selected'
    AND donor_id <> p_donor_id;

  UPDATE public.blood_request_interests
  SET status = 'selected'
  WHERE blood_request_id = p_request_id
    AND donor_id = p_donor_id
    AND status IN ('interested', 'selected');

  UPDATE public.blood_requests
  SET
    status = 'donor_found',
    fulfilled_by_donor_id = p_donor_id
  WHERE id = p_request_id;

  -- Notify selected donor (avoid duplicate if already selected)
  IF v_prev_donor IS DISTINCT FROM p_donor_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      p_donor_id,
      'donor_selected',
      'You Were Selected as Blood Donor',
      left(
        trim(
          format(
            'You have been selected to donate %s blood for %s at %s.%s',
            v_bg,
            COALESCE(NULLIF(trim(v_patient), ''), 'patient'),
            v_hospital,
            CASE WHEN v_clean_notes IS NOT NULL THEN ' ' || v_clean_notes ELSE '' END
          )
        ),
        600
      ),
      '/requests?requestId=' || p_request_id::text,
      jsonb_build_object('blood_request_id', p_request_id, 'donor_id', p_donor_id)
    );
  END IF;

  -- Notify other interested members once that a donor has been found
  IF v_status <> 'donor_found' THEN
    FOR v_other IN
      SELECT donor_id
      FROM public.blood_request_interests
      WHERE blood_request_id = p_request_id
        AND status = 'interested'
        AND donor_id <> p_donor_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (
        v_other.donor_id,
        'request_status_updated',
        'Donor Found for Blood Request',
        left(
          format(
            'A donor has been selected for %s (%s) at %s. Thank you for offering to donate.',
            COALESCE(NULLIF(trim(v_patient), ''), 'patient'),
            v_bg,
            v_hospital
          ),
          600
        ),
        '/requests?requestId=' || p_request_id::text,
        jsonb_build_object('blood_request_id', p_request_id)
      );
    END LOOP;
  END IF;
END;
$$;

-- Owner completes donation -> transitions to completed, creates 1 donation_history row, triggers donor stat sync
CREATE OR REPLACE FUNCTION public.owner_complete_blood_request(
  p_request_id UUID,
  p_donor_id UUID DEFAULT NULL,
  p_donation_date DATE DEFAULT CURRENT_DATE,
  p_units_donated INTEGER DEFAULT 1,
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
  v_status TEXT;
  v_bg TEXT;
  v_hospital TEXT;
  v_existing_donor_id UUID;
  v_resolved_donor_id UUID;
  v_donor_active BOOLEAN;
  v_clean_notes TEXT := NULLIF(trim(COALESCE(p_notes, '')), '');
  v_safe_date DATE := LEAST(COALESCE(p_donation_date, CURRENT_DATE), CURRENT_DATE);
  v_safe_units INTEGER := GREATEST(1, LEAST(COALESCE(p_units_donated, 1), 4));
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT
    requester_id,
    patient_name,
    status,
    required_blood_group,
    hospital_name,
    fulfilled_by_donor_id
  INTO
    v_requester,
    v_patient,
    v_status,
    v_bg,
    v_hospital,
    v_existing_donor_id
  FROM public.blood_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blood request not found.';
  END IF;

  IF v_requester IS DISTINCT FROM v_actor AND NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only the request owner can complete this blood request.';
  END IF;

  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'This blood request has already been marked as completed.';
  END IF;

  IF v_status IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'Cannot complete a blood request that is already %.', v_status;
  END IF;

  IF p_donor_id IS NOT NULL THEN
    v_resolved_donor_id := p_donor_id;
  ELSIF v_existing_donor_id IS NOT NULL THEN
    v_resolved_donor_id := v_existing_donor_id;
  ELSE
    SELECT bri.donor_id
    INTO v_resolved_donor_id
    FROM public.blood_request_interests bri
    WHERE bri.blood_request_id = p_request_id
      AND bri.status = 'selected'
    ORDER BY bri.updated_at DESC
    LIMIT 1;

    IF v_resolved_donor_id IS NULL THEN
      SELECT cr.donor_id
      INTO v_resolved_donor_id
      FROM public.contact_requests cr
      WHERE cr.blood_request_id = p_request_id
        AND cr.status = 'accepted'
      ORDER BY cr.responded_at ASC NULLS LAST, cr.created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_resolved_donor_id IS NULL THEN
    RAISE EXCEPTION 'Please select the donor who completed the donation before confirming completion.';
  END IF;

  IF v_resolved_donor_id = v_requester THEN
    RAISE EXCEPTION 'The request owner cannot be recorded as their own fulfilling donor.';
  END IF;

  SELECT is_active INTO v_donor_active FROM public.profiles WHERE id = v_resolved_donor_id;
  IF NOT FOUND OR COALESCE(v_donor_active, false) = false THEN
    RAISE EXCEPTION 'Selected donor account was not found or is inactive.';
  END IF;

  UPDATE public.blood_requests
  SET
    status = 'completed',
    fulfilled_by_donor_id = v_resolved_donor_id
  WHERE id = p_request_id;

  UPDATE public.blood_request_interests
  SET status = 'completed'
  WHERE blood_request_id = p_request_id
    AND donor_id = v_resolved_donor_id
    AND status IN ('interested', 'selected');

  IF NOT EXISTS (SELECT 1 FROM public.donation_history WHERE blood_request_id = p_request_id) THEN
    INSERT INTO public.donation_history (
      donor_id,
      blood_request_id,
      blood_group,
      donation_date,
      hospital_name,
      units_donated,
      notes,
      verified_by
    )
    VALUES (
      v_resolved_donor_id,
      p_request_id,
      v_bg,
      v_safe_date,
      v_hospital,
      v_safe_units,
      left(
        COALESCE(
          v_clean_notes,
          'Completed via community blood request for ' || COALESCE(NULLIF(trim(v_patient), ''), 'patient')
        ),
        500
      ),
      v_actor
    );
  END IF;

  IF v_requester IS NOT NULL AND v_requester <> v_resolved_donor_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_requester,
      'request_status_updated',
      'Blood Request Completed',
      left(
        format(
          'Your blood request for %s at %s has been marked as completed.',
          COALESCE(NULLIF(trim(v_patient), ''), 'patient'),
          v_hospital
        ),
        600
      ),
      '/requests?requestId=' || p_request_id::text,
      jsonb_build_object('blood_request_id', p_request_id, 'donor_id', v_resolved_donor_id)
    );
  END IF;
END;
$$;

-- Owner cancels own active request -> no donation_history created, notifies interested donors
CREATE OR REPLACE FUNCTION public.owner_cancel_blood_request(
  p_request_id UUID,
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
  v_status TEXT;
  v_hospital TEXT;
  v_clean_notes TEXT := NULLIF(trim(COALESCE(p_notes, '')), '');
  v_interested RECORD;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT requester_id, patient_name, status, hospital_name
  INTO v_requester, v_patient, v_status, v_hospital
  FROM public.blood_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blood request not found.';
  END IF;

  IF v_requester IS DISTINCT FROM v_actor AND NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only the request owner can cancel this blood request.';
  END IF;

  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'Completed blood requests cannot be cancelled.';
  END IF;

  IF v_status IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'This blood request is already %.', v_status;
  END IF;

  UPDATE public.blood_requests
  SET status = 'cancelled'
  WHERE id = p_request_id;

  FOR v_interested IN
    SELECT donor_id
    FROM public.blood_request_interests
    WHERE blood_request_id = p_request_id
      AND status IN ('interested', 'selected')
      AND donor_id <> v_actor
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_interested.donor_id,
      'request_status_updated',
      'Blood Request Cancelled',
      left(
        trim(
          format(
            'The blood request for %s at %s has been cancelled.%s',
            COALESCE(NULLIF(trim(v_patient), ''), 'patient'),
            v_hospital,
            CASE WHEN v_clean_notes IS NOT NULL THEN ' ' || v_clean_notes ELSE '' END
          )
        ),
        600
      ),
      '/requests?requestId=' || p_request_id::text,
      jsonb_build_object('blood_request_id', p_request_id)
    );
  END LOOP;
END;
$$;

-- Staff oversight: update moderate_blood_request so staff can also step pending -> donor_found/completed when needed
CREATE OR REPLACE FUNCTION public.moderate_blood_request(
  p_request_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL,
  p_donor_id UUID DEFAULT NULL
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
  v_blood_group TEXT;
  v_hospital_name TEXT;
  v_existing_donor_id UUID;
  v_resolved_donor_id UUID;
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

  SELECT
    requester_id,
    patient_name,
    status,
    required_blood_group,
    hospital_name,
    fulfilled_by_donor_id
  INTO
    v_requester,
    v_patient,
    v_current_status,
    v_blood_group,
    v_hospital_name,
    v_existing_donor_id
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

  IF p_new_status = v_current_status THEN
    RAISE EXCEPTION 'Blood request is already %.', v_current_status;
  END IF;

  IF p_new_status IN ('donor_found', 'completed') THEN
    IF p_donor_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_donor_id) THEN
        RAISE EXCEPTION 'Selected donor profile not found.';
      END IF;
      v_resolved_donor_id := p_donor_id;
    ELSIF v_existing_donor_id IS NOT NULL THEN
      v_resolved_donor_id := v_existing_donor_id;
    ELSE
      SELECT bri.donor_id
      INTO v_resolved_donor_id
      FROM public.blood_request_interests bri
      WHERE bri.blood_request_id = p_request_id
        AND bri.status = 'selected'
      ORDER BY bri.updated_at DESC
      LIMIT 1;

      IF v_resolved_donor_id IS NULL THEN
        SELECT cr.donor_id
        INTO v_resolved_donor_id
        FROM public.contact_requests cr
        WHERE cr.blood_request_id = p_request_id
          AND cr.status = 'accepted'
        ORDER BY cr.responded_at ASC NULLS LAST, cr.created_at ASC
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  UPDATE public.blood_requests
  SET
    status = p_new_status,
    verified_by = CASE WHEN p_new_status = 'verified' THEN v_actor ELSE verified_by END,
    verified_at = CASE WHEN p_new_status = 'verified' THEN now() ELSE verified_at END,
    fulfilled_by_donor_id = CASE
      WHEN p_new_status IN ('donor_found', 'completed') THEN COALESCE(v_resolved_donor_id, fulfilled_by_donor_id)
      ELSE fulfilled_by_donor_id
    END
  WHERE id = p_request_id;

  IF p_new_status = 'donor_found' AND v_resolved_donor_id IS NOT NULL THEN
    UPDATE public.blood_request_interests
    SET status = 'selected'
    WHERE blood_request_id = p_request_id
      AND donor_id = v_resolved_donor_id
      AND status IN ('interested', 'selected');
  END IF;

  IF p_new_status = 'completed' AND v_resolved_donor_id IS NOT NULL THEN
    UPDATE public.blood_request_interests
    SET status = 'completed'
    WHERE blood_request_id = p_request_id
      AND donor_id = v_resolved_donor_id
      AND status IN ('interested', 'selected');

    IF NOT EXISTS (SELECT 1 FROM public.donation_history WHERE blood_request_id = p_request_id) THEN
      INSERT INTO public.donation_history (
        donor_id,
        blood_request_id,
        blood_group,
        donation_date,
        hospital_name,
        units_donated,
        notes,
        verified_by
      )
      VALUES (
        v_resolved_donor_id,
        p_request_id,
        v_blood_group,
        CURRENT_DATE,
        v_hospital_name,
        1,
        left(COALESCE(v_clean_notes, 'Completed via blood request for ' || COALESCE(NULLIF(trim(v_patient), ''), 'patient')), 500),
        v_actor
      );
    END IF;
  END IF;

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

    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_requester,
      CASE WHEN p_new_status = 'verified' THEN 'blood_request_verified' ELSE 'request_status_updated' END,
      v_notif_title,
      v_notif_message,
      '/requests?requestId=' || p_request_id::text,
      jsonb_build_object('blood_request_id', p_request_id)
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
      'fulfilled_by_donor_id', v_resolved_donor_id,
      'notes', v_clean_notes
    )
  );
END;
$$;

-- Staff oversight: safely remove fraudulent or inappropriate non-completed requests with audit log
CREATE OR REPLACE FUNCTION public.staff_remove_blood_request(
  p_request_id UUID,
  p_reason TEXT DEFAULT NULL
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
  v_status TEXT;
  v_clean_reason TEXT := COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'Removed by campus moderator/admin oversight.');
BEGIN
  IF NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Moderator or Super Admin role required.';
  END IF;

  SELECT requester_id, patient_name, status
  INTO v_requester, v_patient, v_status
  FROM public.blood_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Blood request not found.';
  END IF;

  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'Completed blood requests cannot be removed to preserve verified donation history.';
  END IF;

  DELETE FROM public.blood_requests WHERE id = p_request_id;

  IF v_requester IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_requester,
      'request_status_updated',
      'Blood Request Removed',
      left(
        format(
          'Your blood request for %s was removed by campus moderation: %s',
          COALESCE(NULLIF(trim(v_patient), ''), 'patient'),
          v_clean_reason
        ),
        600
      ),
      '/dashboard'
    );
  END IF;

  INSERT INTO public.admin_logs (actor_id, action, target_table, target_id, details)
  VALUES (
    v_actor,
    'blood_request_removed',
    'blood_requests',
    p_request_id::text,
    jsonb_build_object(
      'previous_status', v_status,
      'patient_name', v_patient,
      'reason', v_clean_reason
    )
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. GRANTS
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_public_platform_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_blood_requests(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.express_blood_request_interest(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_blood_request_interest(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_blood_request_interests(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_contact_request(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_select_donor_for_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_complete_blood_request(UUID, UUID, DATE, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_cancel_blood_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_blood_request(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_remove_blood_request(UUID, TEXT) TO authenticated;
