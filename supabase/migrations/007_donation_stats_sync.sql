-- ============================================================================
-- Campus Blood Connect (Netrokona University)
-- Migration 007: Global Donation Statistics & Donor Count Synchronization
-- Safe to run multiple times (idempotent) without deleting existing data.
-- ============================================================================

-- 1. Track optional fulfilling donor on blood_requests
ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS fulfilled_by_donor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_blood_requests_fulfilled_donor
  ON public.blood_requests(fulfilled_by_donor_id)
  WHERE fulfilled_by_donor_id IS NOT NULL;

-- Prevent duplicate donation_history rows for the same blood_request_id when clean
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.donation_history
    WHERE blood_request_id IS NOT NULL
    GROUP BY blood_request_id
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_donation_history_unique_request
      ON public.donation_history(blood_request_id)
      WHERE blood_request_id IS NOT NULL;
  END IF;
END;
$$;

-- 2. Allow internal trigger-driven donor_details stat recalculation alongside staff/service updates
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
    OR (auth.uid() IS NULL AND COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated'))
    OR pg_trigger_depth() > 1;

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

-- 3. Authoritative donor_details synchronization trigger (idempotent count from donation_history)
CREATE OR REPLACE FUNCTION public.sync_donor_donation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_donor_id UUID;
  v_old_donor_id UUID;
  v_message TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_donor_id := OLD.donor_id;
  ELSE
    v_donor_id := NEW.donor_id;
  END IF;

  IF v_donor_id IS NOT NULL THEN
    UPDATE public.donor_details dd
    SET
      total_donations = stats.cnt,
      last_donation_date = stats.max_date
    FROM (
      SELECT
        COUNT(*)::INTEGER AS cnt,
        MAX(donation_date) AS max_date
      FROM public.donation_history
      WHERE donor_id = v_donor_id
    ) stats
    WHERE dd.user_id = v_donor_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.donor_id IS DISTINCT FROM NEW.donor_id AND OLD.donor_id IS NOT NULL THEN
    v_old_donor_id := OLD.donor_id;
    UPDATE public.donor_details dd
    SET
      total_donations = stats.cnt,
      last_donation_date = stats.max_date
    FROM (
      SELECT
        COUNT(*)::INTEGER AS cnt,
        MAX(donation_date) AS max_date
      FROM public.donation_history
      WHERE donor_id = v_old_donor_id
    ) stats
    WHERE dd.user_id = v_old_donor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.blood_request_id IS NOT NULL THEN
      UPDATE public.blood_requests
      SET fulfilled_by_donor_id = COALESCE(fulfilled_by_donor_id, NEW.donor_id)
      WHERE id = NEW.blood_request_id
        AND fulfilled_by_donor_id IS NULL;
    END IF;

    v_message := left(
      trim(format('Your blood donation at %s on %s has been recorded.', NEW.hospital_name, NEW.donation_date::text)),
      600
    );

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.donor_id,
      'donation_completed',
      'Donation Recorded',
      v_message,
      '/dashboard'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_donor_donation_stats ON public.donation_history;
CREATE TRIGGER trg_sync_donor_donation_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.donation_history
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_donor_donation_stats();

-- 4. Fix global platform stats: count completed blood_requests + unlinked donation_history without double counting
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

-- 5. Update moderate_blood_request to optionally link a donor & record donation_history atomically on completion
DROP FUNCTION IF EXISTS public.moderate_blood_request(UUID, TEXT, TEXT);
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

  IF p_new_status = 'completed' AND v_current_status NOT IN ('verified', 'donor_found') THEN
    RAISE EXCEPTION 'Blood request must be verified before it can be marked completed.';
  END IF;

  IF p_new_status = 'donor_found' AND v_current_status <> 'verified' THEN
    RAISE EXCEPTION 'Blood request must be verified before marking donor found.';
  END IF;

  IF p_new_status = v_current_status THEN
    RAISE EXCEPTION 'Blood request is already %.', v_current_status;
  END IF;

  IF p_new_status = 'completed' THEN
    IF p_donor_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_donor_id) THEN
        RAISE EXCEPTION 'Selected donor profile not found.';
      END IF;
      v_resolved_donor_id := p_donor_id;
    ELSIF v_existing_donor_id IS NOT NULL THEN
      v_resolved_donor_id := v_existing_donor_id;
    ELSE
      SELECT cr.donor_id
      INTO v_resolved_donor_id
      FROM public.contact_requests cr
      WHERE cr.blood_request_id = p_request_id
        AND cr.status = 'accepted'
      ORDER BY cr.responded_at ASC NULLS LAST, cr.created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  UPDATE public.blood_requests
  SET
    status = p_new_status,
    verified_by = CASE WHEN p_new_status = 'verified' THEN v_actor ELSE verified_by END,
    verified_at = CASE WHEN p_new_status = 'verified' THEN now() ELSE verified_at END,
    fulfilled_by_donor_id = CASE
      WHEN p_new_status = 'completed' THEN COALESCE(v_resolved_donor_id, fulfilled_by_donor_id)
      ELSE fulfilled_by_donor_id
    END
  WHERE id = p_request_id;

  IF p_new_status = 'completed'
     AND v_resolved_donor_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.donation_history WHERE blood_request_id = p_request_id
     ) THEN
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
      'fulfilled_by_donor_id', v_resolved_donor_id,
      'notes', v_clean_notes
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_platform_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_blood_request(UUID, TEXT, TEXT, UUID) TO authenticated;

-- 6. Synchronize existing historical completed requests and donor counts safely
DO $$
DECLARE
  v_req RECORD;
  v_donor_id UUID;
BEGIN
  -- Link fulfilled_by_donor_id from existing donation_history rows if already recorded
  UPDATE public.blood_requests br
  SET fulfilled_by_donor_id = dh.donor_id
  FROM public.donation_history dh
  WHERE dh.blood_request_id = br.id
    AND br.fulfilled_by_donor_id IS NULL;

  -- Backfill accepted contact_request donor or donation_history row for completed requests
  FOR v_req IN
    SELECT id, required_blood_group, hospital_name, patient_name, fulfilled_by_donor_id, verified_by, updated_at, created_at
    FROM public.blood_requests
    WHERE status = 'completed'
  LOOP
    v_donor_id := v_req.fulfilled_by_donor_id;

    IF v_donor_id IS NULL THEN
      SELECT cr.donor_id
      INTO v_donor_id
      FROM public.contact_requests cr
      WHERE cr.blood_request_id = v_req.id
        AND cr.status = 'accepted'
      ORDER BY cr.responded_at ASC NULLS LAST, cr.created_at ASC
      LIMIT 1;

      IF v_donor_id IS NOT NULL THEN
        UPDATE public.blood_requests
        SET fulfilled_by_donor_id = v_donor_id
        WHERE id = v_req.id;
      END IF;
    END IF;

    IF v_donor_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.donation_history WHERE blood_request_id = v_req.id) THEN
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
        v_donor_id,
        v_req.id,
        v_req.required_blood_group,
        LEAST(COALESCE(v_req.updated_at::date, v_req.created_at::date, CURRENT_DATE), CURRENT_DATE),
        v_req.hospital_name,
        1,
        left('Synchronized from completed blood request for ' || COALESCE(NULLIF(trim(v_req.patient_name), ''), 'patient'), 500),
        v_req.verified_by
      );
    END IF;
  END LOOP;

  -- Recalculate every donor_details.total_donations and last_donation_date from authoritative donation_history
  UPDATE public.donor_details dd
  SET
    total_donations = COALESCE(agg.cnt, 0),
    last_donation_date = agg.max_date
  FROM (
    SELECT
      d.user_id,
      COUNT(dh.id)::INTEGER AS cnt,
      MAX(dh.donation_date) AS max_date
    FROM public.donor_details d
    LEFT JOIN public.donation_history dh ON dh.donor_id = d.user_id
    GROUP BY d.user_id
  ) agg
  WHERE dd.user_id = agg.user_id
    AND (
      dd.total_donations IS DISTINCT FROM COALESCE(agg.cnt, 0)
      OR dd.last_donation_date IS DISTINCT FROM agg.max_date
    );
END;
$$;
