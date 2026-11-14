import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  BloodGroup,
  Department,
  PublicBloodRequest,
  PublicDonor,
  PublicPlatformStats,
  TestimonialItem,
} from '../types/database';

const EMPTY_BLOOD_GROUP_COUNTS: Record<BloodGroup, number> = {
  'A+': 0,
  'A-': 0,
  'B+': 0,
  'B-': 0,
  'AB+': 0,
  'AB-': 0,
  'O+': 0,
  'O-': 0,
};

export const EMPTY_PLATFORM_STATS: PublicPlatformStats = {
  total_donors: 0,
  verified_donors: 0,
  available_donors: 0,
  total_donations: 0,
  active_requests: 0,
  blood_group_counts: { ...EMPTY_BLOOD_GROUP_COUNTS },
};

export async function fetchPublicPlatformStats(): Promise<{
  stats: PublicPlatformStats;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { stats: EMPTY_PLATFORM_STATS, error: null };
  }

  const { data, error } = await supabase.rpc('get_public_platform_stats');
  if (error) {
    return { stats: EMPTY_PLATFORM_STATS, error: error.message };
  }

  const parsed = data as Partial<PublicPlatformStats> | null;
  return {
    stats: {
      total_donors: parsed?.total_donors ?? 0,
      verified_donors: parsed?.verified_donors ?? 0,
      available_donors: parsed?.available_donors ?? 0,
      total_donations: parsed?.total_donations ?? 0,
      active_requests: parsed?.active_requests ?? 0,
      blood_group_counts: {
        ...EMPTY_BLOOD_GROUP_COUNTS,
        ...(parsed?.blood_group_counts || {}),
      },
    },
    error: null,
  };
}

export interface DonorSearchFilters {
  bloodGroup?: string;
  departmentId?: string;
  batch?: string;
  location?: string;
  onlyEligible?: boolean;
  page?: number;
  pageSize?: number;
}

export async function searchPublicDonors(filters: DonorSearchFilters): Promise<{
  donors: PublicDonor[];
  totalCount: number;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { donors: [], totalCount: 0, error: null };
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));
  const offset = (page - 1) * pageSize;

  const { data, error } = await supabase.rpc('search_public_donors', {
    p_blood_group: filters.bloodGroup || null,
    p_department_id: filters.departmentId || null,
    p_batch: filters.batch || null,
    p_location: filters.location || null,
    p_only_eligible: Boolean(filters.onlyEligible),
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) {
    return { donors: [], totalCount: 0, error: error.message };
  }

  const rows = (data as PublicDonor[]) || [];
  const totalCount = rows.length > 0 ? Number(rows[0].total_count || rows.length) : 0;
  return { donors: rows, totalCount, error: null };
}

export interface BloodRequestFilters {
  bloodGroup?: string;
  location?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchPublicBloodRequests(filters: BloodRequestFilters): Promise<{
  requests: PublicBloodRequest[];
  totalCount: number;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { requests: [], totalCount: 0, error: null };
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));
  const offset = (page - 1) * pageSize;

  const { data, error } = await supabase.rpc('get_public_blood_requests', {
    p_blood_group: filters.bloodGroup || null,
    p_location: filters.location || null,
    p_status: filters.status || null,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (error) {
    return { requests: [], totalCount: 0, error: error.message };
  }

  const rows = (data as PublicBloodRequest[]) || [];
  const totalCount = rows.length > 0 ? Number(rows[0].total_count || rows.length) : 0;
  return { requests: rows, totalCount, error: null };
}

export async function fetchPublicBloodRequestById(
  requestId: string
): Promise<PublicBloodRequest | null> {
  if (!isSupabaseConfigured || !supabase || !requestId) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_public_blood_requests', {
    p_blood_group: null,
    p_location: null,
    p_status: null,
    p_limit: 50,
    p_offset: 0,
  });

  if (error || !data) return null;
  const rows = data as PublicBloodRequest[];
  return rows.find((item) => item.id === requestId) || null;
}

export async function fetchActiveDepartments(): Promise<Department[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error || !data) return [];
  return data as Department[];
}

export async function fetchApprovedTestimonials(): Promise<TestimonialItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('testimonials')
    .select(`
      id, user_id, quote, role_label, is_approved, created_at,
      profile:profiles!testimonials_user_id_fkey(
        full_name, batch,
        department:departments(name)
      )
    `)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error || !data) return [];
  return data as unknown as TestimonialItem[];
}

export async function fetchPublicPlatformSettings(): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured || !supabase) {
    return {};
  }
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value')
    .eq('is_public', true);

  if (error || !data) return {};
  const map: Record<string, unknown> = {};
  for (const row of data) {
    map[row.key] = row.value;
  }
  return map;
}
