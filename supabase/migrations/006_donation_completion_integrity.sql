-- ============================================================================
-- Campus Blood Connect (Netrokona University)
-- Migration 006: Donation Completion Integrity & State-Transition Hardening
-- Safe to run multiple times (idempotent) without affecting existing data.
-- ============================================================================

-- 1. Enforce valid status transitions on public.blood_requests at the database level
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

  -- Allow direct SQL Editor / migration / service_role administrative repairs
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

  IF NEW.status = 'completed' AND OLD.status NOT IN ('verified', 'donor_found') THEN
    RAISE EXCEPTION 'Blood request must be verified before it can be marked completed.';
  END IF;

  IF NEW.status = 'donor_found' AND OLD.status <> 'verified' THEN
    RAISE EXCEPTION 'Blood request must be verified before marking donor found.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_blood_request_status ON public.blood_requests;
CREATE TRIGGER trg_guard_blood_request_status
  BEFORE UPDATE ON public.blood_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_blood_request_status_transition();

-- 2. Harden moderate_blood_request RPC:
--    - Lock row FOR UPDATE to prevent concurrent double-completion races
--    - Reject duplicate completion & invalid terminal transitions
--    - Truncate notification title/message within CHECK bounds so long names/notes never crash
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

-- 3. Harden sync_donor_donation_stats trigger notification length safety
CREATE OR REPLACE FUNCTION public.sync_donor_donation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message TEXT;
BEGIN
  UPDATE public.donor_details
  SET
    total_donations = total_donations + 1,
    last_donation_date = GREATEST(COALESCE(last_donation_date, NEW.donation_date), NEW.donation_date)
  WHERE user_id = NEW.donor_id;

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

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_blood_request(UUID, TEXT, TEXT) TO authenticated;
