import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCompleteBloodRequest,
  canTransitionRequestStatus,
  formatRequestStatusError,
  formatRequestStatusLabel,
  isTerminalRequestStatus,
  validateRequestStatusTransition,
} from './requestStatus';

test('allows verified and donor_found requests to transition to completed', () => {
  assert.equal(canCompleteBloodRequest('verified'), true);
  assert.equal(canCompleteBloodRequest('donor_found'), true);
  assert.equal(canTransitionRequestStatus('verified', 'completed'), true);
  assert.equal(canTransitionRequestStatus('donor_found', 'completed'), true);
});

test('prevents completing already completed, cancelled, expired, or pending requests', () => {
  assert.equal(canCompleteBloodRequest('completed'), false);
  assert.equal(canCompleteBloodRequest('cancelled'), false);
  assert.equal(canCompleteBloodRequest('expired'), false);
  assert.equal(canCompleteBloodRequest('pending'), false);

  const dup = validateRequestStatusTransition('completed', 'completed');
  assert.equal(dup.valid, false);
  assert.match(dup.reason || '', /already been marked as completed/i);

  const pendingComplete = validateRequestStatusTransition('pending', 'completed');
  assert.equal(pendingComplete.valid, false);
  assert.match(pendingComplete.reason || '', /Verify the blood request/i);

  const revertCompleted = validateRequestStatusTransition('completed', 'verified');
  assert.equal(revertCompleted.valid, false);
  assert.equal(isTerminalRequestStatus('completed'), true);
  assert.equal(isTerminalRequestStatus('verified'), false);
});

test('validates full forward lifecycle pending -> verified -> donor_found -> completed', () => {
  assert.equal(canTransitionRequestStatus('pending', 'verified'), true);
  assert.equal(canTransitionRequestStatus('verified', 'donor_found'), true);
  assert.equal(canTransitionRequestStatus('donor_found', 'completed'), true);
  assert.equal(canTransitionRequestStatus('completed', 'cancelled'), false);
});

test('formats status labels safely including null/unknown values', () => {
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
    formatRequestStatusError({ message: 'Unauthorized: Moderator or Super Admin role required.' }),
    /authorized moderators or super administrators/i
  );
});
