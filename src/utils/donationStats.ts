import type { BloodRequest, DonationHistory } from '../types/database';

/**
 * Computes the authoritative, deduplicated count of successful donations:
 * - Every blood request with status === 'completed' counts as 1.
 * - Any donation_history row NOT linked to an already-completed blood request
 *   (e.g., standalone/camp donations recorded directly by an admin) counts as 1.
 * - Pending, verified, donor_found, cancelled, and expired requests are excluded.
 * - A completed request linked to a donation_history row is never counted twice.
 */
export function countUniqueCompletedDonations(
  requests: Pick<BloodRequest, 'id' | 'status'>[],
  donations: Pick<DonationHistory, 'id' | 'blood_request_id'>[]
): number {
  const completedRequestIds = new Set<string>();
  for (const req of requests) {
    if (req.status === 'completed' && req.id) {
      completedRequestIds.add(req.id);
    }
  }

  let standaloneDonations = 0;
  for (const d of donations) {
    if (!d.blood_request_id || !completedRequestIds.has(d.blood_request_id)) {
      standaloneDonations += 1;
    }
  }

  return completedRequestIds.size + standaloneDonations;
}

/**
 * Builds monthly donation unit trends combining donation_history records
 * with completed blood_requests that do not yet have a linked donation_history row.
 */
export function buildMonthlyDonationTrends(
  requests: Pick<BloodRequest, 'id' | 'status' | 'bags_needed' | 'required_date' | 'updated_at'>[],
  donations: Pick<DonationHistory, 'blood_request_id' | 'donation_date' | 'units_donated'>[]
): Array<{ month: string; units: number }> {
  const monthMap: Record<string, number> = {};
  const linkedRequestIds = new Set<string>();

  for (const d of donations) {
    if (d.blood_request_id) {
      linkedRequestIds.add(d.blood_request_id);
    }
    const month = (d.donation_date || '').slice(0, 7);
    if (!month) continue;
    monthMap[month] = (monthMap[month] || 0) + (Number(d.units_donated) || 1);
  }

  for (const req of requests) {
    if (req.status !== 'completed' || linkedRequestIds.has(req.id)) continue;
    const dateStr = req.updated_at || req.required_date || '';
    const month = dateStr.slice(0, 7);
    if (!month) continue;
    monthMap[month] = (monthMap[month] || 0) + Math.max(1, Number(req.bags_needed) || 1);
  }

  return Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, units]) => ({ month, units }));
}
