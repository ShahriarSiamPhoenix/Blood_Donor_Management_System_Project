import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMonthlyDonationTrends, countUniqueCompletedDonations } from './donationStats';

test('counts completed blood requests even when no donation_history row exists', () => {
  const count = countUniqueCompletedDonations(
    [
      { id: 'r1', status: 'completed' },
      { id: 'r2', status: 'verified' },
      { id: 'r3', status: 'pending' },
      { id: 'r4', status: 'cancelled' },
      { id: 'r5', status: 'expired' },
    ],
    []
  );
  assert.equal(count, 1);
});

test('never double-counts a completed blood request linked to donation_history', () => {
  const count = countUniqueCompletedDonations(
    [
      { id: 'r1', status: 'completed' },
      { id: 'r2', status: 'completed' },
    ],
    [
      { id: 'd1', blood_request_id: 'r2' },
    ]
  );
  assert.equal(count, 2);
});

test('counts standalone donation_history entries alongside completed blood requests', () => {
  const count = countUniqueCompletedDonations(
    [
      { id: 'r1', status: 'completed' },
      { id: 'r2', status: 'donor_found' },
    ],
    [
      { id: 'd1', blood_request_id: null },
      { id: 'd2', blood_request_id: 'r1' },
    ]
  );
  assert.equal(count, 2);
});

test('builds monthly donation trends from both linked donation_history and unlinked completed requests', () => {
  const trends = buildMonthlyDonationTrends(
    [
      { id: 'r1', status: 'completed', bags_needed: 1, required_date: '2026-11-16', updated_at: '2026-11-14T10:00:00Z' },
      { id: 'r2', status: 'completed', bags_needed: 2, required_date: '2026-10-15', updated_at: '2026-10-15T10:00:00Z' },
      { id: 'r3', status: 'verified', bags_needed: 3, required_date: '2026-11-20', updated_at: '2026-11-14T10:00:00Z' },
    ],
    [
      { blood_request_id: 'r2', donation_date: '2026-10-15', units_donated: 1 },
    ]
  );
  assert.deepEqual(trends, [
    { month: '2026-10', units: 1 },
    { month: '2026-11', units: 1 },
  ]);
});
