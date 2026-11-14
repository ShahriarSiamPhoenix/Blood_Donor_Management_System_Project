import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOOD_COMPATIBILITY_MAP,
  BLOOD_GROUPS,
  getDonationIntervalStatus,
  isRbcCompatible,
  isValidBloodGroup,
} from './bloodCompatibility';

test('supports all eight standard ABO/Rh blood groups', () => {
  assert.equal(BLOOD_GROUPS.length, 8);
  assert.equal(isValidBloodGroup('O-'), true);
  assert.equal(isValidBloodGroup('AB+'), true);
  assert.equal(isValidBloodGroup('X+'), false);
});

test('ABO/Rh red blood cell compatibility rules match medical reference', () => {
  // O- is universal red cell donor
  for (const recipient of BLOOD_GROUPS) {
    assert.equal(isRbcCompatible('O-', recipient), true);
  }
  // AB+ can receive from all groups
  for (const donor of BLOOD_GROUPS) {
    assert.equal(isRbcCompatible(donor, 'AB+'), true);
  }
  // Rh+ cannot donate red cells to Rh-
  assert.equal(isRbcCompatible('O+', 'O-'), false);
  assert.equal(isRbcCompatible('A+', 'A-'), false);
  assert.equal(BLOOD_COMPATIBILITY_MAP['A-'].canReceiveRedCellsFrom.includes('A+'), false);
});

test('informational donation interval calculates days remaining accurately', () => {
  const ref = new Date('2026-11-13T00:00:00Z');
  const recent = getDonationIntervalStatus('2026-10-14', 90, ref);
  assert.equal(recent.daysSinceLastDonation, 30);
  assert.equal(recent.intervalCompleted, false);
  assert.equal(recent.daysRemaining, 60);

  const older = getDonationIntervalStatus('2026-07-01', 90, ref);
  assert.equal(older.intervalCompleted, true);
  assert.equal(older.daysRemaining, 0);

  const neverDonated = getDonationIntervalStatus(null, 90, ref);
  assert.equal(neverDonated.intervalCompleted, true);
});
