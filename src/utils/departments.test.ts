import test from 'node:test';
import assert from 'node:assert/strict';
import type { Department } from '../types/database';
import {
  filterDepartments,
  formatDepartmentLabel,
  NETROKONA_DEPARTMENTS,
  prepareDepartmentOptions,
} from './departments';

function makeDept(
  id: string,
  code: string,
  name: string,
  nameBn: string | null = null,
  isActive = true
): Department {
  return {
    id,
    code,
    name,
    name_bn: nameBn,
    is_active: isActive,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

test('NETROKONA_DEPARTMENTS includes all 9 exact university departments without duplicates', () => {
  assert.equal(NETROKONA_DEPARTMENTS.length, 9);
  assert.deepEqual(
    NETROKONA_DEPARTMENTS.map((d) => d.displayLabel),
    [
      'Computer Science & Engineering (CSE)',
      'Electrical & Electronic Engineering (EEE)',
      'Bangla',
      'English',
      'Economics',
      'History & Archaeology',
      'International Relations (IR)',
      'Development Studies (DS)',
      'Accounting & Information Systems (AIS)',
    ]
  );
});

test('prepareDepartmentOptions deduplicates and orders all 9 departments canonically', () => {
  const unsortedWithDupes: Department[] = [
    makeDept('9', 'AIS', 'Accounting & Information Systems'),
    makeDept('3', 'BAN', 'Bangla'),
    makeDept('1', 'CSE', 'Computer Science & Engineering'),
    makeDept('1-dup', 'CSE', 'Computer Science & Engineering'),
    makeDept('8', 'DS', 'Development Studies'),
    makeDept('5', 'ECO', 'Economics'),
    makeDept('2', 'EEE', 'Electrical & Electronic Engineering'),
    makeDept('4', 'ENG', 'English'),
    makeDept('6', 'HIS', 'History & Archaeology'),
    makeDept('7', 'IR', 'International Relations'),
  ];

  const prepared = prepareDepartmentOptions(unsortedWithDupes);
  assert.equal(prepared.length, 9);
  assert.deepEqual(
    prepared.map((d) => formatDepartmentLabel(d)),
    NETROKONA_DEPARTMENTS.map((d) => d.displayLabel)
  );
});

test('prepareDepartmentOptions preserves an existing user legacy department without duplicating active ones', () => {
  const active = NETROKONA_DEPARTMENTS.map((d, idx) =>
    makeDept(`id-${idx + 1}`, d.code, d.name, d.nameBn, true)
  );
  const legacyPa = makeDept('legacy-pa', 'PA', 'Public Administration', 'লোকপ্রশাসন', false);

  const prepared = prepareDepartmentOptions(active, legacyPa);
  assert.equal(prepared.length, 10);
  assert.equal(prepared[9].code, 'PA');
  assert.equal(formatDepartmentLabel(prepared[9]), 'Public Administration (PA)');
});

test('filterDepartments matches by department name, abbreviation code, and Bangla name', () => {
  const all = NETROKONA_DEPARTMENTS.map((d, idx) =>
    makeDept(`id-${idx + 1}`, d.code, d.name, d.nameBn, true)
  );

  assert.equal(filterDepartments(all, 'EEE').length, 1);
  assert.equal(filterDepartments(all, 'EEE')[0].code, 'EEE');

  assert.equal(filterDepartments(all, 'accounting').length, 1);
  assert.equal(filterDepartments(all, 'accounting')[0].code, 'AIS');

  assert.equal(filterDepartments(all, 'archaeology').length, 1);
  assert.equal(filterDepartments(all, 'archaeology')[0].code, 'HIS');

  assert.equal(filterDepartments(all, 'IR').length, 1);
  assert.equal(filterDepartments(all, 'বাংলা').length, 1);
  assert.equal(filterDepartments(all, '   ').length, 9);
  assert.equal(filterDepartments(all, 'nonexistent-xyz').length, 0);
});
