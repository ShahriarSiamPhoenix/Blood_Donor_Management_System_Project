import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCompleteBloodRequest,
  canExpressInterestInRequest,
  canTransitionRequestStatus,
  canWithdrawInterestFromRequest,
  formatRequestStatusError,
  formatRequestStatusLabel,
  isActiveRequestStatus,
  isTerminalRequestStatus,
  validateRequestStatusTransition,
} from './requestStatus';

test('allows open (pending), verified, and donor_found community requests to transition to completed', () => {
  assert.equal(isActiveRequestStatus('pending'), true);
  assert.equal(isActiveRequestStatus('verified'), true);
  assert.equal(isActiveRequestStatus('donor_found'), true);
  assert.equal(canCompleteBloodRequest('pending'), true);
  assert.equal(canCompleteBloodRequest('verified'), true);
  assert.equal(canCompleteBloodRequest('donor_found'), true);
  assert.equal(canTransitionRequestStatus('pending', 'donor_found'), true);
  assert.equal(canTransitionRequestStatus('pending', 'completed'), true);
  assert.equal(canTransitionRequestStatus('pending', 'cancelled'), true);
  assert.equal(canTransitionRequestStatus('verified', 'completed'), true);
  assert.equal(canTransitionRequestStatus('donor_found', 'completed'), true);
});

test('prevents completing already completed, cancelled, or expired requests', () => {
  assert.equal(canCompleteBloodRequest('completed'), false);
  assert.equal(canCompleteBloodRequest('cancelled'), false);
  assert.equal(canCompleteBloodRequest('expired'), false);

  const dup = validateRequestStatusTransition('completed', 'completed');
  assert.equal(dup.valid, false);
  assert.match(dup.reason || '', /already been marked as completed/i);

  const revertCompleted = validateRequestStatusTransition('completed', 'verified');
  assert.equal(revertCompleted.valid, false);
  assert.equal(isTerminalRequestStatus('completed'), true);
  assert.equal(isTerminalRequestStatus('cancelled'), true);
  assert.equal(isTerminalRequestStatus('verified'), false);
});

test('validates community interest eligibility and duplicate/owner guards', () => {
  assert.equal(
    canExpressInterestInRequest({ status: 'pending', isOwner: false, viewerInterestStatus: null }),
    true
  );
  assert.equal(
    canExpressInterestInRequest({ status: 'pending', isOwner: false, viewerInterestStatus: 'withdrawn' }),
    true
  );
  assert.equal(
    canExpressInterestInRequest({ status: 'pending', isOwner: false, viewerInterestStatus: 'interested' }),
    false
  );
  assert.equal(
    canExpressInterestInRequest({ status: 'pending', isOwner: true, viewerInterestStatus: null }),
    false
  );
  assert.equal(
    canExpressInterestInRequest({ status: 'completed', isOwner: false, viewerInterestStatus: null }),
    false
  );

  assert.equal(
    canWithdrawInterestFromRequest({ status: 'pending', isOwner: false, viewerInterestStatus: 'interested' }),
    true
  );
  assert.equal(
    canWithdrawInterestFromRequest({ status: 'donor_found', isOwner: false, viewerInterestStatus: 'selected' }),
    true
  );
  assert.equal(
    canWithdrawInterestFromRequest({ status: 'completed', isOwner: false, viewerInterestStatus: 'interested' }),
    false
  );
});

test('formats status labels safely including null/unknown values', () => {
  assert.equal(formatRequestStatusLabel('pending'), 'Open');
  assert.equal(formatRequestStatusLabel('donor_found'), 'Donor Found');
  assert.equal(formatRequestStatusLabel('completed'), 'Completed');
  assert.equal(formatRequestStatusLabel(null), 'Unknown');
  assert.equal(formatRequestStatusLabel(undefined), 'Unknown');
});

test('normalizes database errors into user-friendly messages', () => {
  assert.match(
    formatRequestStatusError(new Error('Blood request has already been marked as completed.')),
    /already been marked as completed/i
  );
  assert.match(
    formatRequestStatusError(new Error('You have already expressed interest in this blood request.')),
    /already expressed interest/i
  );
  assert.match(
    formatRequestStatusError({ message: 'Unauthorized: Only the request owner can complete this blood request.' }),
    /request owner or staff/i
  );
});
