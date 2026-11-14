import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  AdminLogItem,
  BloodGroup,
  BloodRequest,
  Department,
  DonationHistory,
  DonorDetails,
  Profile,
  ReportItem,
  RequestStatus,
  UserRole,
  VerificationRequest,
} from '../types/database';
import { formatRequestStatusError } from '../utils/requestStatus';

function assertSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }
  return supabase;
}

async function assertDatabaseRole(allowedRoles: UserRole[]) {
  const client = assertSupabase();
  const { data: userRes } = await client.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) {
    throw new Error('Authentication required.');
  }

  const { data, error } = await client.rpc('verify_user_role', {
    p_allowed_roles: allowedRoles,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    const row = data[0] as { authorized: boolean };
    if (!row.authorized) {
      throw new Error('Unauthorized: insufficient database role permissions.');
    }
    return;
  }

  if (error && (error.code === 'PGRST202' || error.message?.includes('verify_user_role'))) {
    const { data: profileRow, error: profileErr } = await client
      .from('profiles')
      .select('role, is_active')
      .eq('id', authUser.id)
      .maybeSingle();

    if (
      profileErr ||
      !profileRow ||
      !profileRow.is_active ||
      !allowedRoles.includes(profileRow.role as UserRole)
    ) {
      throw new Error('Unauthorized: insufficient database role permissions.');
    }
    return;
  }

  throw new Error(error?.message || 'Unauthorized: role verification failed.');
}

export interface AdminUserRow extends Profile {
  donor_details: DonorDetails | null;
}

export async function fetchModeratorWorkspace(): Promise<{
  verifications: VerificationRequest[];
  requests: BloodRequest[];
  reports: ReportItem[];
  logs: AdminLogItem[];
}> {
  const client = assertSupabase();
  await assertDatabaseRole(['moderator', 'super_admin']);
  const [verRes, reqRes, repRes, logRes] = await Promise.all([
    client
      .from('verification_requests')
      .select('*, profile:profiles!verification_requests_user_id_fkey(*, department:departments(*))')
      .order('created_at', { ascending: false })
      .limit(50),
    client
      .from('blood_requests')
      .select('*')
      .order('is_emergency', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
    client
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    client
      .from('admin_logs')
      .select('*, actor:profiles!admin_logs_actor_id_fkey(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const firstError = verRes.error || reqRes.error || repRes.error || logRes.error;
  if (firstError) {
    throw new Error(firstError.message || 'Unable to load moderator workspace data.');
  }

  return {
    verifications: (verRes.data as unknown as VerificationRequest[]) || [],
    requests: (reqRes.data as BloodRequest[]) || [],
    reports: (repRes.data as ReportItem[]) || [],
    logs: (logRes.data as unknown as AdminLogItem[]) || [],
  };
}

export async function reviewVerificationRequest(
  verificationId: string,
  decision: 'approved' | 'rejected',
  notes?: string
) {
  const client = assertSupabase();
  const { error } = await client.rpc('review_donor_verification', {
    p_verification_id: verificationId,
    p_decision: decision,
    p_review_notes: notes || null,
  });
  if (error) throw error;
}

export async function moderateBloodRequestStatus(
  requestId: string,
  newStatus: Exclude<RequestStatus, 'pending'>,
  notes?: string
) {
  const client = assertSupabase();
  await assertDatabaseRole(['moderator', 'super_admin']);
  const { error } = await client.rpc('moderate_blood_request', {
    p_request_id: requestId,
    p_new_status: newStatus,
    p_notes: notes?.trim() || null,
  });
  if (error) {
    throw new Error(formatRequestStatusError(error));
  }
}

export async function resolveReport(
  reportId: string,
  resolverId: string,
  status: 'reviewing' | 'resolved' | 'dismissed',
  notes: string
) {
  const client = assertSupabase();
  const { error } = await client
    .from('reports')
    .update({
      status,
      resolved_by: resolverId,
      resolution_notes: notes.trim() || null,
    })
    .eq('id', reportId);
  if (error) throw error;

  await client.from('admin_logs').insert({
    actor_id: resolverId,
    action: `report_${status}`,
    target_table: 'reports',
    target_id: reportId,
    details: { notes },
  });
}

export async function fetchSuperAdminDashboardData() {
  const client = assertSupabase();
  await assertDatabaseRole(['super_admin']);

  const [
    usersRes,
    requestsRes,
    donationsRes,
    departmentsRes,
    verificationsRes,
    reportsRes,
    logsRes,
    settingsRes,
  ] = await Promise.all([
    client
      .from('profiles')
      .select('*, department:departments(*), donor_details(*)')
      .order('created_at', { ascending: false }),
    client.from('blood_requests').select('*').order('created_at', { ascending: false }),
    client.from('donation_history').select('*').order('donation_date', { ascending: false }),
    client.from('departments').select('*').order('name', { ascending: true }),
    client
      .from('verification_requests')
      .select('*, profile:profiles!verification_requests_user_id_fkey(*, department:departments(*))')
      .order('created_at', { ascending: false }),
    client.from('reports').select('*').order('created_at', { ascending: false }),
    client
      .from('admin_logs')
      .select('*, actor:profiles!admin_logs_actor_id_fkey(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(100),
    client.from('platform_settings').select('*').order('key', { ascending: true }),
  ]);

  const firstError =
    usersRes.error ||
    requestsRes.error ||
    donationsRes.error ||
    departmentsRes.error ||
    verificationsRes.error ||
    reportsRes.error ||
    logsRes.error ||
    settingsRes.error;

  if (firstError) {
    throw new Error(firstError.message || 'Unable to load admin dashboard data.');
  }

  const rawUsers = (usersRes.data || []) as Array<
    Profile & { donor_details: DonorDetails | DonorDetails[] | null }
  >;
  const users: AdminUserRow[] = rawUsers.map((u) => ({
    ...u,
    donor_details: Array.isArray(u.donor_details) ? u.donor_details[0] ?? null : u.donor_details,
  }));

  return {
    users,
    requests: (requestsRes.data as BloodRequest[]) || [],
    donations: (donationsRes.data as DonationHistory[]) || [],
    departments: (departmentsRes.data as Department[]) || [],
    verifications: (verificationsRes.data as unknown as VerificationRequest[]) || [],
    reports: (reportsRes.data as ReportItem[]) || [],
    logs: (logsRes.data as unknown as AdminLogItem[]) || [],
    settings: (settingsRes.data as Array<{ key: string; value: unknown; description: string | null; is_public: boolean }>) || [],
  };
}

export async function adminChangeUserRole(targetUserId: string, newRole: UserRole) {
  const client = assertSupabase();
  const { error } = await client.rpc('admin_update_user_role', {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });
  if (error) throw error;
}

export async function adminToggleUserActive(targetUserId: string, isActive: boolean, actorId: string) {
  const client = assertSupabase();
  await assertDatabaseRole(['super_admin']);
  const { error } = await client
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', targetUserId);
  if (error) throw error;

  await client.from('admin_logs').insert({
    actor_id: actorId,
    action: isActive ? 'user_activated' : 'user_suspended',
    target_table: 'profiles',
    target_id: targetUserId,
    details: { is_active: isActive },
  });
}

export async function adminRecordDonation(params: {
  donorId: string;
  bloodGroup: BloodGroup;
  donationDate: string;
  hospitalName: string;
  unitsDonated: number;
  bloodRequestId?: string;
  notes?: string;
  verifiedBy: string;
}) {
  const client = assertSupabase();
  const { error } = await client.from('donation_history').insert({
    donor_id: params.donorId,
    blood_group: params.bloodGroup,
    donation_date: params.donationDate,
    hospital_name: params.hospitalName.trim(),
    units_donated: params.unitsDonated,
    blood_request_id: params.bloodRequestId || null,
    notes: params.notes?.trim() || null,
    verified_by: params.verifiedBy,
  });
  if (error) throw error;

  await client.from('admin_logs').insert({
    actor_id: params.verifiedBy,
    action: 'donation_recorded',
    target_table: 'donation_history',
    target_id: params.donorId,
    details: { hospital_name: params.hospitalName, units: params.unitsDonated },
  });
}

export async function adminCreateDepartment(params: {
  code: string;
  name: string;
  nameBn?: string;
  actorId: string;
}) {
  const client = assertSupabase();
  await assertDatabaseRole(['super_admin']);
  const { error } = await client.from('departments').insert({
    code: params.code.trim().toUpperCase(),
    name: params.name.trim(),
    name_bn: params.nameBn?.trim() || null,
    is_active: true,
  });
  if (error) throw error;

  await client.from('admin_logs').insert({
    actor_id: params.actorId,
    action: 'department_created',
    target_table: 'departments',
    target_id: params.code.trim().toUpperCase(),
    details: { name: params.name },
  });
}

export async function adminToggleDepartment(deptId: string, isActive: boolean) {
  const client = assertSupabase();
  await assertDatabaseRole(['super_admin']);
  const { error } = await client
    .from('departments')
    .update({ is_active: isActive })
    .eq('id', deptId);
  if (error) throw error;
}

export async function adminUpdatePlatformSetting(key: string, value: unknown, actorId: string) {
  const client = assertSupabase();
  await assertDatabaseRole(['super_admin']);
  const { error } = await client
    .from('platform_settings')
    .update({ value, updated_by: actorId })
    .eq('key', key);
  if (error) throw error;

  await client.from('admin_logs').insert({
    actor_id: actorId,
    action: 'setting_updated',
    target_table: 'platform_settings',
    target_id: key,
    details: { value },
  });
}

export async function adminRunExpirePastDue(): Promise<number> {
  const client = assertSupabase();
  const { data, error } = await client.rpc('expire_past_due_blood_requests');
  if (error) throw error;
  return Number(data ?? 0);
}
