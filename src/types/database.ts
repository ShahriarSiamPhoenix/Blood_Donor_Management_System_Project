export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type UserRole = 'student' | 'moderator' | 'super_admin';

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export type RequestStatus =
  | 'pending'
  | 'verified'
  | 'donor_found'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type InterestStatus = 'interested' | 'selected' | 'withdrawn' | 'completed';

export type ContactRequestStatus = 'pending' | 'accepted' | 'declined' | 'closed';

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export type NotificationType =
  | 'new_contact_request'
  | 'blood_request_verified'
  | 'donor_contact_request'
  | 'request_status_updated'
  | 'donation_completed'
  | 'verification_approved'
  | 'verification_rejected'
  | 'announcement'
  | 'donor_interest'
  | 'donor_selected'
  | 'interest_withdrawn';

export interface Department {
  id: string;
  code: string;
  name: string;
  name_bn: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  student_id: string;
  department_id: string | null;
  batch: string;
  role: UserRole;
  avatar_url: string | null;
  privacy_policy_accepted_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: Department | null;
}

export interface DonorDetails {
  id: string;
  user_id: string;
  blood_group: BloodGroup;
  location: string;
  is_available: boolean;
  is_publicly_discoverable: boolean;
  verification_status: VerificationStatus;
  last_donation_date: string | null;
  total_donations: number;
  contact_preference: 'in_app' | 'phone_on_approval';
  show_last_donation_date: boolean;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicDonor {
  donor_id: string;
  display_name: string;
  avatar_url: string | null;
  blood_group: BloodGroup;
  department_name: string;
  department_code: string;
  batch: string;
  location: string;
  is_available: boolean;
  verification_status: VerificationStatus;
  last_donation_date: string | null;
  total_donations: number;
  total_count: number;
}

export interface PublicPlatformStats {
  total_donors: number;
  verified_donors: number;
  available_donors: number;
  total_donations: number;
  active_requests: number;
  blood_group_counts: Record<BloodGroup, number>;
}

export interface BloodRequest {
  id: string;
  requester_id: string | null;
  requester_name: string;
  requester_relation: string | null;
  patient_name: string;
  required_blood_group: BloodGroup;
  hospital_name: string;
  hospital_location: string;
  bags_needed: number;
  required_date: string;
  required_time: string;
  contact_person: string;
  contact_phone: string;
  emergency_description: string;
  is_emergency: boolean;
  status: RequestStatus;
  verified_by: string | null;
  verified_at: string | null;
  fulfilled_by_donor_id?: string | null;
  interested_count?: number;
  created_at: string;
  updated_at: string;
}

export interface PublicBloodRequest {
  id: string;
  patient_name: string;
  required_blood_group: BloodGroup;
  hospital_name: string;
  hospital_location: string;
  bags_needed: number;
  required_date: string;
  required_time: string;
  contact_person: string;
  contact_phone_masked: string;
  emergency_description: string;
  is_emergency: boolean;
  status: RequestStatus;
  created_at: string;
  requester_name?: string;
  is_owner?: boolean;
  interested_count?: number;
  viewer_interest_status?: InterestStatus | null;
  fulfilled_by_donor_id?: string | null;
  fulfilled_donor_name?: string | null;
  verified_at?: string | null;
  total_count: number;
}

export interface BloodRequestInterest {
  interest_id: string;
  blood_request_id: string;
  donor_id: string;
  full_name: string;
  avatar_url: string | null;
  blood_group: BloodGroup;
  department_name: string;
  department_code: string;
  batch: string;
  location: string;
  last_donation_date: string | null;
  total_donations: number;
  is_available: boolean;
  verification_status: VerificationStatus;
  contact_preference: 'in_app' | 'phone_on_approval';
  contact_phone: string | null;
  contact_request_status: ContactRequestStatus | null;
  share_contact: boolean;
  message: string | null;
  status: InterestStatus;
  created_at: string;
}

export interface DonationHistory {
  id: string;
  donor_id: string;
  blood_request_id: string | null;
  blood_group: BloodGroup;
  donation_date: string;
  hospital_name: string;
  units_donated: number;
  notes: string | null;
  verified_by: string | null;
  created_at: string;
}

export interface ContactRequest {
  id: string;
  donor_id: string;
  requester_id: string;
  blood_request_id: string | null;
  message: string;
  requester_phone: string | null;
  status: ContactRequestStatus;
  responded_at: string | null;
  created_at: string;
  donor_profile?: { full_name: string; department_id: string | null; batch: string } | null;
  requester_profile?: { full_name: string; batch: string } | null;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface VerificationRequest {
  id: string;
  user_id: string;
  requested_blood_group: BloodGroup;
  student_id_snapshot: string;
  document_url: string | null;
  notes: string | null;
  status: VerificationStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile?: Profile | null;
}

export interface ReportItem {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  blood_request_id: string | null;
  reason: string;
  details: string;
  status: ReportStatus;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface AdminLogItem {
  id: string;
  actor_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor?: { full_name: string; role: UserRole } | null;
}

export interface TestimonialItem {
  id: string;
  user_id: string;
  quote: string;
  role_label: string;
  is_approved: boolean;
  created_at: string;
  profile?: {
    full_name: string;
    batch: string;
    department?: { name: string } | null;
  } | null;
}
