import type { RequestStatus } from '../types/database';

const VALID_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  pending: ['verified', 'cancelled', 'expired'],
  verified: ['donor_found', 'completed', 'cancelled', 'expired'],
  donor_found: ['completed', 'cancelled', 'expired'],
  completed: [],
  cancelled: [],
  expired: [],
};

const TERMINAL_STATUSES = new Set<RequestStatus>(['completed', 'cancelled', 'expired']);

export function isTerminalRequestStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return TERMINAL_STATUSES.has(status as RequestStatus);
}

export function canCompleteBloodRequest(status: string | null | undefined): boolean {
  return status === 'verified' || status === 'donor_found';
}

export function canTransitionRequestStatus(
  currentStatus: string | null | undefined,
  nextStatus: RequestStatus
): boolean {
  return validateRequestStatusTransition(currentStatus, nextStatus).valid;
}

export function validateRequestStatusTransition(
  currentStatus: string | null | undefined,
  nextStatus: RequestStatus
): { valid: boolean; reason?: string } {
  if (!currentStatus) {
    return { valid: false, reason: 'Blood request status is missing.' };
  }

  const normalizedCurrent = currentStatus as RequestStatus;
  if (!(normalizedCurrent in VALID_TRANSITIONS)) {
    return { valid: false, reason: `Unknown blood request status: ${currentStatus}.` };
  }

  if (normalizedCurrent === 'completed') {
    return {
      valid: false,
      reason: 'This blood donation request has already been marked as completed.',
    };
  }

  if (normalizedCurrent === 'cancelled' || normalizedCurrent === 'expired') {
    return {
      valid: false,
      reason: `Cannot update a blood request that is already ${normalizedCurrent}.`,
    };
  }

  if (nextStatus === 'completed' && normalizedCurrent === 'pending') {
    return {
      valid: false,
      reason: 'Verify the blood request before marking donation complete.',
    };
  }

  if (!VALID_TRANSITIONS[normalizedCurrent].includes(nextStatus)) {
    return {
      valid: false,
      reason: `Invalid transition from ${formatRequestStatusLabel(normalizedCurrent)} to ${formatRequestStatusLabel(nextStatus)}.`,
    };
  }

  return { valid: true };
}

export function formatRequestStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'verified':
      return 'Verified';
    case 'donor_found':
      return 'Donor Found';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    default:
      return status ? status.replace(/_/g, ' ') : 'Unknown';
  }
}

export function getRequestStatusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60';
    case 'donor_found':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60';
    case 'verified':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60';
    case 'cancelled':
    case 'expired':
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    default:
      return 'bg-red-50 text-[#C62828] border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60';
  }
}

export function formatRequestStatusError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : '';

  if (!raw) {
    return 'Unable to update the blood request right now. Please try again.';
  }

  const lower = raw.toLowerCase();
  if (lower.includes('already') && lower.includes('completed')) {
    return 'This blood donation request has already been marked as completed.';
  }
  if (lower.includes('unauthorized') || lower.includes('role required')) {
    return 'Only authorized moderators or super administrators can update request statuses.';
  }
  if (lower.includes('not found')) {
    return 'Blood request record could not be found. Please refresh the dashboard.';
  }
  if (lower.includes('must be verified')) {
    return 'Please verify the blood request before marking donation complete.';
  }

  return raw;
}
