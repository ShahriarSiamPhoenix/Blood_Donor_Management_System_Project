import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { BloodGroup, BloodRequest } from '../types/database';
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
  return (data as BloodRequest[]) || [];
}

export async function cancelOwnBloodRequest(requestId: string) {
  const client = assertSupabase();
  const { error } = await client
    .from('blood_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);
  if (error) throw error;
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
