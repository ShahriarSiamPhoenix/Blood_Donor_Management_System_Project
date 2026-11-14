import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { BloodGroup, BloodRequest, BloodRequestInterest } from '../types/database';
import { formatRequestStatusError } from '../utils/requestStatus';
import { buildRequestDedupFingerprint } from '../utils/validation';

function assertSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

export interface CreateBloodRequestPayload {
  requesterId: string;
  requesterName: string;
  requesterRelation?: string;
  patientName: string;
  requiredBloodGroup: BloodGroup;
  hospitalName: string;
  hospitalLocation: string;
  bagsNeeded: number;
  requiredDate: string;
  requiredTime: string;
  contactPerson: string;
  contactPhone: string;
  emergencyDescription: string;
  isEmergency: boolean;
}

export async function createBloodRequest(payload: CreateBloodRequestPayload): Promise<BloodRequest> {
  const client = assertSupabase();
  const fingerprint = buildRequestDedupFingerprint({
    patientName: payload.patientName,
    requiredBloodGroup: payload.requiredBloodGroup,
    hospitalName: payload.hospitalName,
    requiredDate: payload.requiredDate,
    contactPhone: payload.contactPhone,
  });

  // Duplicate submission guard within 24 hours for active requests
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await client
    .from('blood_requests')
    .select('id')
    .eq('dedup_fingerprint', fingerprint)
    .in('status', ['pending', 'verified', 'donor_found'])
    .gte('created_at', cutoff)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(
      'A matching active blood request for this patient and hospital was already submitted recently.'
    );
  }

  const { data, error } = await client
    .from('blood_requests')
    .insert({
      requester_id: payload.requesterId,
      requester_name: payload.requesterName.trim(),
      requester_relation: payload.requesterRelation?.trim() || 'Self / Family',
      patient_name: payload.patientName.trim(),
      required_blood_group: payload.requiredBloodGroup,
      hospital_name: payload.hospitalName.trim(),
      hospital_location: payload.hospitalLocation.trim(),
      bags_needed: payload.bagsNeeded,
      required_date: payload.requiredDate,
      required_time: payload.requiredTime,
      contact_person: payload.contactPerson.trim(),
      contact_phone: payload.contactPhone.trim(),
      emergency_description: payload.emergencyDescription.trim(),
      is_emergency: payload.isEmergency,
      status: 'pending',
      dedup_fingerprint: fingerprint,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as BloodRequest;
}

export async function fetchMyBloodRequests(userId: string): Promise<BloodRequest[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from('blood_requests')
    .select('*')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = (data as BloodRequest[]) || [];
  if (rows.length === 0) return [];

  const requestIds = rows.map((r) => r.id);
  const { data: interestRows } = await client
    .from('blood_request_interests')
    .select('blood_request_id, status')
    .in('blood_request_id', requestIds)
    .in('status', ['interested', 'selected', 'completed']);

  if (!interestRows) return rows;

  const countMap: Record<string, number> = {};
  for (const row of interestRows as Array<{ blood_request_id: string }>) {
    countMap[row.blood_request_id] = (countMap[row.blood_request_id] || 0) + 1;
  }

  return rows.map((r) => ({
    ...r,
    interested_count: countMap[r.id] ?? 0,
  }));
}

export async function expressInterestInRequest(params: {
  requestId: string;
  message?: string;
  shareContact?: boolean;
}): Promise<{ interest_id: string; status: string; interested_count: number }> {
  const client = assertSupabase();
  const { data, error } = await client.rpc('express_blood_request_interest', {
    p_request_id: params.requestId,
    p_message: params.message?.trim() || null,
    p_share_contact: Boolean(params.shareContact),
  });

  if (error) {
    throw new Error(formatRequestStatusError(error));
  }
  return data as { interest_id: string; status: string; interested_count: number };
}

export async function withdrawInterestFromRequest(
  requestId: string
): Promise<{ status: string; interested_count: number; request_status: string }> {
  const client = assertSupabase();
  const { data, error } = await client.rpc('withdraw_blood_request_interest', {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(formatRequestStatusError(error));
  }
  return data as { status: string; interested_count: number; request_status: string };
}

export async function fetchRequestInterests(requestId: string): Promise<BloodRequestInterest[]> {
  const client = assertSupabase();
  const { data, error } = await client.rpc('get_blood_request_interests', {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(formatRequestStatusError(error));
  }
  return (data as BloodRequestInterest[]) || [];
}

export async function ownerSelectDonorForRequest(params: {
  requestId: string;
  donorId: string;
  notes?: string;
}) {
  const client = assertSupabase();
  const { error } = await client.rpc('owner_select_donor_for_request', {
    p_request_id: params.requestId,
    p_donor_id: params.donorId,
    p_notes: params.notes?.trim() || null,
  });

  if (error) {
    throw new Error(formatRequestStatusError(error));
  }
}

export async function ownerCompleteBloodRequest(params: {
  requestId: string;
  donorId?: string | null;
  donationDate?: string;
  unitsDonated?: number;
  notes?: string;
}) {
  const client = assertSupabase();
  const { error } = await client.rpc('owner_complete_blood_request', {
    p_request_id: params.requestId,
    p_donor_id: params.donorId || null,
    p_donation_date: params.donationDate || new Date().toISOString().slice(0, 10),
    p_units_donated: params.unitsDonated ?? 1,
    p_notes: params.notes?.trim() || null,
  });

  if (error) {
    throw new Error(formatRequestStatusError(error));
  }
}

export async function cancelOwnBloodRequest(requestId: string, notes?: string) {
  const client = assertSupabase();
  const { error } = await client.rpc('owner_cancel_blood_request', {
    p_request_id: requestId,
    p_notes: notes?.trim() || null,
  });

  if (error && error.code === 'PGRST202') {
    const fallback = await client
      .from('blood_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId);
    if (fallback.error) throw new Error(formatRequestStatusError(fallback.error));
    return;
  }

  if (error) {
    throw new Error(formatRequestStatusError(error));
  }
}

export async function updateOwnPendingBloodRequest(
  requestId: string,
  updates: Partial<{
    hospital_name: string;
    hospital_location: string;
    bags_needed: number;
    required_date: string;
    required_time: string;
    emergency_description: string;
  }>
) {
  const client = assertSupabase();
  const { error } = await client
    .from('blood_requests')
    .update(updates)
    .eq('id', requestId);
  if (error) throw error;
}
