import { isValidBloodGroup } from './bloodCompatibility';

export interface RegistrationValidationInput {
  fullName: string;
  studentId: string;
  email: string;
  departmentId: string;
  batch: string;
  phone: string;
  bloodGroup: string;
  password: string;
  confirmPassword: string;
  agreedToPrivacy: boolean;
  enforceUniversityDomain?: boolean;
  allowedDomains?: string[];
}

export interface BloodRequestValidationInput {
  patientName: string;
  requiredBloodGroup: string;
  hospitalName: string;
  hospitalLocation: string;
  bagsNeeded: number;
  requiredDate: string;
  requiredTime: string;
  contactPerson: string;
  contactPhone: string;
  emergencyDescription: string;
  requesterName: string;
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function matchesUniversityDomain(email: string, allowedDomains: string[]): boolean {
  const clean = email.trim().toLowerCase();
  const domain = clean.split('@')[1];
  if (!domain) return false;
  return allowedDomains.some((d) => {
    const normalized = d.trim().toLowerCase();
    return domain === normalized || domain.endsWith(`.${normalized}`);
  });
}

export function isValidBangladeshPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-()]/g, '');
  return /^(\+?88)?01[3-9]\d{8}$/.test(digits);
}

export function validateRegistrationForm(
  input: RegistrationValidationInput
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (input.fullName.trim().length < 2) {
    errors.fullName = 'Please enter your full name (at least 2 characters).';
  }
  if (input.studentId.trim().length < 4) {
    errors.studentId = 'Please enter a valid university Student ID.';
  }
  if (!isValidEmailFormat(input.email)) {
    errors.email = 'Please enter a valid email address.';
  } else if (
    input.enforceUniversityDomain &&
    input.allowedDomains &&
    input.allowedDomains.length > 0 &&
    !matchesUniversityDomain(input.email, input.allowedDomains)
  ) {
    errors.email = `University email must use one of: ${input.allowedDomains.join(', ')}`;
  }

  if (!input.departmentId.trim()) {
    errors.departmentId = 'Please select your academic department.';
  }
  if (input.batch.trim().length < 1) {
    errors.batch = 'Please enter your batch (e.g., 2022-23 or 5th Batch).';
  }
  if (!isValidBangladeshPhone(input.phone)) {
    errors.phone = 'Enter a valid Bangladesh mobile number (e.g., 01712345678).';
  }
  if (!isValidBloodGroup(input.bloodGroup)) {
    errors.bloodGroup = 'Please select a valid ABO/Rh blood group.';
  }
  if (input.password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  }
  if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  if (!input.agreedToPrivacy) {
    errors.agreedToPrivacy = 'You must agree to the donor privacy policy to register.';
  }

  return errors;
}

export function validateBloodRequestForm(
  input: BloodRequestValidationInput,
  todayIso?: string
): Record<string, string> {
  const errors: Record<string, string> = {};
  const today = todayIso || new Date().toISOString().slice(0, 10);

  if (input.patientName.trim().length < 2) {
    errors.patientName = 'Patient name is required.';
  }
  if (!isValidBloodGroup(input.requiredBloodGroup)) {
    errors.requiredBloodGroup = 'Select a valid required blood group.';
  }
  if (input.hospitalName.trim().length < 2) {
    errors.hospitalName = 'Hospital or clinic name is required.';
  }
  if (input.hospitalLocation.trim().length < 2) {
    errors.hospitalLocation = 'Hospital address or area is required.';
  }
  if (!Number.isInteger(input.bagsNeeded) || input.bagsNeeded < 1 || input.bagsNeeded > 20) {
    errors.bagsNeeded = 'Number of bags must be between 1 and 20.';
  }
  if (!input.requiredDate) {
    errors.requiredDate = 'Required date is needed.';
  } else if (input.requiredDate < today) {
    errors.requiredDate = 'Required date cannot be in the past.';
  }
  if (!input.requiredTime) {
    errors.requiredTime = 'Required time is needed.';
  }
  if (input.contactPerson.trim().length < 2) {
    errors.contactPerson = 'Contact person name is required.';
  }
  if (!isValidBangladeshPhone(input.contactPhone)) {
    errors.contactPhone = 'Enter a valid Bangladesh contact number (e.g., 01712345678).';
  }
  if (input.emergencyDescription.trim().length < 10) {
    errors.emergencyDescription = 'Please provide at least 10 characters explaining the medical context.';
  }
  if (input.requesterName.trim().length < 2) {
    errors.requesterName = 'Requester name is required.';
  }

  return errors;
}

export function buildRequestDedupFingerprint(input: {
  patientName: string;
  requiredBloodGroup: string;
  hospitalName: string;
  requiredDate: string;
  contactPhone: string;
}): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return [
    norm(input.patientName),
    input.requiredBloodGroup.trim().toUpperCase(),
    norm(input.hospitalName),
    input.requiredDate.trim(),
    input.contactPhone.replace(/\D/g, '').slice(-11),
  ].join('|');
}

export function computeProfileCompletion(profile: {
  full_name?: string | null;
  phone?: string | null;
  student_id?: string | null;
  department_id?: string | null;
  batch?: string | null;
  avatar_url?: string | null;
} | null, donor?: {
  blood_group?: string | null;
  location?: string | null;
} | null): number {
  if (!profile) return 0;
  const checks = [
    Boolean(profile.full_name),
    Boolean(profile.phone),
    Boolean(profile.student_id),
    Boolean(profile.department_id),
    Boolean(profile.batch),
    Boolean(profile.avatar_url),
    Boolean(donor?.blood_group),
    Boolean(donor?.location),
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}
