import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  BloodGroup,
  ContactRequest,
  DonationHistory,
  DonorDetails,
  Profile,
  VerificationRequest,
} from '../types/database';

function assertSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

export async function fetchMyDonorWorkspace(userId: string): Promise<{
  profile: Profile | null;
  donorDetails: DonorDetails | null;
  donations: DonationHistory[];
  incomingContacts: ContactRequest[];
  outgoingContacts: ContactRequest[];
  verifications: VerificationRequest[];
}> {
  const client = assertSupabase();

  const [profileRes, donorRes, donationsRes, incomingRes, outgoingRes, verifyRes] =
    await Promise.all([
      client
        .from('profiles')
        .select('*, department:departments(*)')
        .eq('id', userId)
        .maybeSingle(),
      client.from('donor_details').select('*').eq('user_id', userId).maybeSingle(),
      client
        .from('donation_history')
        .select('*')
        .eq('donor_id', userId)
        .order('donation_date', { ascending: false }),
      client
        .from('contact_requests')
        .select('*, requester_profile:profiles!contact_requests_requester_id_fkey(full_name, batch)')
        .eq('donor_id', userId)
        .order('created_at', { ascending: false }),
      client
        .from('contact_requests')
        .select('*, donor_profile:profiles!contact_requests_donor_id_fkey(full_name, department_id, batch)')
        .eq('requester_id', userId)
        .order('created_at', { ascending: false }),
      client
        .from('verification_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

  const firstErr =
    profileRes.error ||
    donorRes.error ||
    donationsRes.error ||
    incomingRes.error ||
    outgoingRes.error ||
    verifyRes.error;
  if (firstErr) {
    throw new Error(firstErr.message || 'Unable to load donor workspace.');
  }

  return {
    profile: (profileRes.data as Profile | null) || null,
    donorDetails: (donorRes.data as DonorDetails | null) || null,
    donations: (donationsRes.data as DonationHistory[]) || [],
    incomingContacts: (incomingRes.data as unknown as ContactRequest[]) || [],
    outgoingContacts: (outgoingRes.data as unknown as ContactRequest[]) || [],
    verifications: (verifyRes.data as VerificationRequest[]) || [],
  };
}

export async function updateMyProfileAndDonor(
  userId: string,
  profileUpdates: {
    full_name: string;
    phone: string;
    department_id: string | null;
    batch: string;
  },
  donorUpdates: {
    blood_group: BloodGroup;
    location: string;
    is_available: boolean;
    is_publicly_discoverable: boolean;
    contact_preference: 'in_app' | 'phone_on_approval';
    show_last_donation_date: boolean;
    bio: string;
  },
  previousBloodGroup?: BloodGroup,
  studentIdSnapshot?: string
) {
  const client = assertSupabase();

  const { error: profileError } = await client
    .from('profiles')
    .update({
      full_name: profileUpdates.full_name.trim(),
      phone: profileUpdates.phone.trim(),
      department_id: profileUpdates.department_id || null,
      batch: profileUpdates.batch.trim(),
    })
    .eq('id', userId);

  if (profileError) throw profileError;

  const { error: donorError } = await client
    .from('donor_details')
    .update({
      blood_group: donorUpdates.blood_group,
      location: donorUpdates.location.trim(),
      is_available: donorUpdates.is_available,
      is_publicly_discoverable: donorUpdates.is_publicly_discoverable,
      contact_preference: donorUpdates.contact_preference,
      show_last_donation_date: donorUpdates.show_last_donation_date,
      bio: donorUpdates.bio.trim() || null,
    })
    .eq('user_id', userId);

  if (donorError) throw donorError;

  if (previousBloodGroup && previousBloodGroup !== donorUpdates.blood_group) {
    const { error: verifyErr } = await client.from('verification_requests').insert({
      user_id: userId,
      requested_blood_group: donorUpdates.blood_group,
      student_id_snapshot: studentIdSnapshot || 'UPDATED',
      notes: `Blood group updated from ${previousBloodGroup} to ${donorUpdates.blood_group}; re-verification required.`,
      status: 'pending',
    });
    if (verifyErr) throw verifyErr;
  }
}

export async function toggleDonorAvailability(userId: string, isAvailable: boolean) {
  const client = assertSupabase();
  const { error } = await client
    .from('donor_details')
    .update({ is_available: isAvailable })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function uploadProfileAvatar(userId: string, file: File): Promise<string> {
  const client = assertSupabase();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await client.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = client.storage.from('avatars').getPublicUrl(filePath);
  const publicUrl = data.publicUrl;

  const { error: updateErr } = await client
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);

  if (updateErr) throw updateErr;
  return publicUrl;
}

export async function submitVerificationDocument(
  userId: string,
  bloodGroup: BloodGroup,
  studentId: string,
  notes: string,
  file?: File | null
) {
  const client = assertSupabase();
  let documentUrl: string | null = null;

  if (file) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userId}/id-doc-${Date.now()}.${ext}`;
    const { error: uploadErr } = await client.storage
      .from('verification-docs')
      .upload(path, file, { upsert: true });
    if (uploadErr) throw uploadErr;
    documentUrl = path;
  }

  const { error } = await client.from('verification_requests').insert({
    user_id: userId,
    requested_blood_group: bloodGroup,
    student_id_snapshot: studentId,
    document_url: documentUrl,
    notes: notes.trim() || 'Student verification document submitted',
    status: 'pending',
  });

  if (error) throw error;
}

export async function sendContactRequestToDonor(params: {
  donorId: string;
  message: string;
  requesterPhone?: string;
  bloodRequestId?: string;
}) {
  const client = assertSupabase();
  const { data, error } = await client.rpc('create_contact_request', {
    p_donor_id: params.donorId,
    p_message: params.message,
    p_requester_phone: params.requesterPhone || null,
    p_blood_request_id: params.bloodRequestId || null,
  });
  if (error) throw error;
  return data as string;
}

export async function respondToContactRequest(
  contactRequestId: string,
  status: 'accepted' | 'declined' | 'closed'
) {
  const client = assertSupabase();
  const { error } = await client
    .from('contact_requests')
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq('id', contactRequestId);
  if (error) throw error;
}

export async function submitAbuseReport(params: {
  reporterId: string;
  reportedUserId?: string;
  bloodRequestId?: string;
  reason: string;
  details: string;
}) {
  const client = assertSupabase();
  const { error } = await client.from('reports').insert({
    reporter_id: params.reporterId,
    reported_user_id: params.reportedUserId || null,
    blood_request_id: params.bloodRequestId || null,
    reason: params.reason.trim(),
    details: params.details.trim(),
    status: 'open',
  });
  if (error) throw error;
}

export async function submitStudentTestimonial(params: {
  userId: string;
  quote: string;
  roleLabel: string;
}) {
  const client = assertSupabase();
  const { error } = await client.from('testimonials').insert({
    user_id: params.userId,
    quote: params.quote.trim(),
    role_label: params.roleLabel.trim() || 'Student Donor',
    is_approved: false,
  });
  if (error) throw error;
}
