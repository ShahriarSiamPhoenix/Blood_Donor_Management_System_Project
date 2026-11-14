import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRequestDedupFingerprint,
  computeProfileCompletion,
  isValidBangladeshPhone,
  matchesUniversityDomain,
  validateBloodRequestForm,
  validateRegistrationForm,
} from './validation';

test('validates Bangladesh mobile phone numbers', () => {
  assert.equal(isValidBangladeshPhone('01712345678'), true);
  assert.equal(isValidBangladeshPhone('+8801812345678'), true);
  assert.equal(isValidBangladeshPhone('01234567890'), false);
  assert.equal(isValidBangladeshPhone('12345'), false);
});

test('validates configurable university email domain matching', () => {
  assert.equal(matchesUniversityDomain('student@neu.ac.bd', ['neu.ac.bd']), true);
  assert.equal(matchesUniversityDomain('ali@student.neu.ac.bd', ['neu.ac.bd']), true);
  assert.equal(matchesUniversityDomain('ali@gmail.com', ['neu.ac.bd']), false);
});

test('validateRegistrationForm catches missing fields and mismatched passwords', () => {
  const errors = validateRegistrationForm({
    fullName: 'A',
    studentId: '12',
    email: 'bad-email',
    departmentId: '',
    batch: '',
    phone: '123',
    bloodGroup: 'Z+',
    password: 'short',
    confirmPassword: 'other',
    agreedToPrivacy: false,
    enforceUniversityDomain: true,
    allowedDomains: ['neu.ac.bd'],
  });

  assert.ok(errors.fullName);
  assert.ok(errors.studentId);
  assert.ok(errors.email);
  assert.ok(errors.departmentId);
  assert.ok(errors.batch);
  assert.ok(errors.phone);
  assert.ok(errors.bloodGroup);
  assert.ok(errors.password);
  assert.ok(errors.confirmPassword);
  assert.ok(errors.agreedToPrivacy);

  const validErrors = validateRegistrationForm({
    fullName: 'Nusrat Jahan',
    studentId: '20220104012',
    email: 'nusrat@neu.ac.bd',
    departmentId: '65be27ea-9a2d-418c-b758-89b3d8afb2f6',
    batch: '2022-23',
    phone: '01712345678',
    bloodGroup: 'O+',
    password: 'StrongPassword123',
    confirmPassword: 'StrongPassword123',
    agreedToPrivacy: true,
    enforceUniversityDomain: true,
    allowedDomains: ['neu.ac.bd'],
  });
  assert.deepEqual(validErrors, {});

  const whitespaceDeptErrors = validateRegistrationForm({
    fullName: 'Nusrat Jahan',
    studentId: '20220104012',
    email: 'nusrat@neu.ac.bd',
    departmentId: '   ',
    batch: '2022-23',
    phone: '01712345678',
    bloodGroup: 'O+',
    password: 'StrongPassword123',
    confirmPassword: 'StrongPassword123',
    agreedToPrivacy: true,
  });
  assert.ok(whitespaceDeptErrors.departmentId);
});

test('validateBloodRequestForm enforces valid bags, future date, and description length', () => {
  const invalid = validateBloodRequestForm(
    {
      patientName: 'Rahim Uddin',
      requiredBloodGroup: 'B+',
      hospitalName: 'Netrokona Sadar Hospital',
      hospitalLocation: 'Netrokona Town',
      bagsNeeded: 0,
      requiredDate: '2026-11-01',
      requiredTime: '14:00',
      contactPerson: 'Karim',
      contactPhone: '01711223344',
      emergencyDescription: 'Urgent',
      requesterName: 'Karim',
    },
    '2026-11-13'
  );
  assert.ok(invalid.bagsNeeded);
  assert.ok(invalid.requiredDate);
  assert.ok(invalid.emergencyDescription);

  const valid = validateBloodRequestForm(
    {
      patientName: 'Rahim Uddin',
      requiredBloodGroup: 'B+',
      hospitalName: 'Netrokona Sadar Hospital',
      hospitalLocation: 'Netrokona Town',
      bagsNeeded: 2,
      requiredDate: '2026-11-14',
      requiredTime: '14:00',
      contactPerson: 'Karim Ahmed',
      contactPhone: '01711223344',
      emergencyDescription: 'Patient undergoing emergency surgery tomorrow morning.',
      requesterName: 'Karim Ahmed',
    },
    '2026-11-13'
  );
  assert.deepEqual(valid, {});
});

test('dedup fingerprint normalizes spacing and phone digits', () => {
  const fp1 = buildRequestDedupFingerprint({
    patientName: '  Rahim  Uddin ',
    requiredBloodGroup: 'o+',
    hospitalName: 'Netrokona Sadar Hospital',
    requiredDate: '2026-11-14',
    contactPhone: '+8801711-223344',
  });
  const fp2 = buildRequestDedupFingerprint({
    patientName: 'rahim uddin',
    requiredBloodGroup: 'O+',
    hospitalName: 'netrokona sadar hospital',
    requiredDate: '2026-11-14',
    contactPhone: '01711223344',
  });
  assert.equal(fp1, fp2);
});

test('computeProfileCompletion returns percentage accurately', () => {
  assert.equal(computeProfileCompletion(null, null), 0);
  const full = computeProfileCompletion(
    {
      full_name: 'Nusrat Jahan',
      phone: '01712345678',
      student_id: '20220101',
      department_id: 'dept-1',
      batch: '4th',
      avatar_url: 'https://example.com/a.jpg',
    },
    { blood_group: 'A+', location: 'Netrokona' }
  );
  assert.equal(full, 100);
});
