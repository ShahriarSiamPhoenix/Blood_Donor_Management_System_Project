import type { Department } from '../types/database';

export interface CanonicalDepartmentMeta {
  code: string;
  name: string;
  displayLabel: string;
  nameBn: string;
  order: number;
}

export const NETROKONA_DEPARTMENTS: readonly CanonicalDepartmentMeta[] = [
  {
    code: 'CSE',
    name: 'Computer Science & Engineering',
    displayLabel: 'Computer Science & Engineering (CSE)',
    nameBn: 'কম্পিউটার বিজ্ঞান ও প্রকৌশল',
    order: 1,
  },
  {
    code: 'EEE',
    name: 'Electrical & Electronic Engineering',
    displayLabel: 'Electrical & Electronic Engineering (EEE)',
    nameBn: 'তড়িৎ ও ইলেকট্রনিক প্রকৌশল',
    order: 2,
  },
  {
    code: 'BAN',
    name: 'Bangla',
    displayLabel: 'Bangla',
    nameBn: 'বাংলা',
    order: 3,
  },
  {
    code: 'ENG',
    name: 'English',
    displayLabel: 'English',
    nameBn: 'ইংরেজি',
    order: 4,
  },
  {
    code: 'ECO',
    name: 'Economics',
    displayLabel: 'Economics',
    nameBn: 'অর্থনীতি',
    order: 5,
  },
  {
    code: 'HIS',
    name: 'History & Archaeology',
    displayLabel: 'History & Archaeology',
    nameBn: 'ইতিহাস ও প্রত্নতত্ত্ব',
    order: 6,
  },
  {
    code: 'IR',
    name: 'International Relations',
    displayLabel: 'International Relations (IR)',
    nameBn: 'আন্তর্জাতিক সম্পর্ক',
    order: 7,
  },
  {
    code: 'DS',
    name: 'Development Studies',
    displayLabel: 'Development Studies (DS)',
    nameBn: 'উন্নয়ন অধ্যয়ন',
    order: 8,
  },
  {
    code: 'AIS',
    name: 'Accounting & Information Systems',
    displayLabel: 'Accounting & Information Systems (AIS)',
    nameBn: 'হিসাববিজ্ঞান ও তথ্য ব্যবস্থা',
    order: 9,
  },
] as const;

const BY_CODE = new Map(
  NETROKONA_DEPARTMENTS.map((d) => [d.code.toUpperCase(), d])
);
const BY_NAME = new Map(
  NETROKONA_DEPARTMENTS.map((d) => [d.name.toLowerCase(), d])
);

function findCanonicalMeta(
  dept: Pick<Department, 'code' | 'name'>
): CanonicalDepartmentMeta | undefined {
  const codeKey = dept.code?.trim().toUpperCase();
  if (codeKey && BY_CODE.has(codeKey)) {
    return BY_CODE.get(codeKey);
  }
  const nameKey = dept.name?.trim().toLowerCase();
  if (nameKey && BY_NAME.has(nameKey)) {
    return BY_NAME.get(nameKey);
  }
  return undefined;
}

/**
 * Formats a department row into the exact Netrokona University display label
 * requested for student registration and donor profiles.
 */
export function formatDepartmentLabel(
  dept: Pick<Department, 'code' | 'name'> | null | undefined
): string {
  if (!dept) return '';
  const canonical = findCanonicalMeta(dept);
  if (canonical) {
    return canonical.displayLabel;
  }
  const cleanName = dept.name.trim();
  const cleanCode = dept.code.trim();
  if (!cleanCode || cleanName.includes(`(${cleanCode})`)) {
    return cleanName;
  }
  return `${cleanName} (${cleanCode})`;
}

/**
 * Deduplicates department records by id, normalized code, and normalized name,
 * and sorts Netrokona University's 9 official departments in canonical order.
 * Optionally includes an inactive legacy department if it is currently assigned
 * to an existing user's profile.
 */
export function prepareDepartmentOptions(
  departments: Department[],
  legacySelectedDepartment?: Department | null
): Department[] {
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();
  const result: Department[] = [];

  const combined = legacySelectedDepartment
    ? [...departments, legacySelectedDepartment]
    : departments;

  for (const dept of combined) {
    if (!dept?.id) continue;
    const normCode = dept.code.trim().toUpperCase();
    const normName = dept.name.trim().toLowerCase();

    if (seenIds.has(dept.id) || seenCodes.has(normCode) || seenNames.has(normName)) {
      continue;
    }

    seenIds.add(dept.id);
    seenCodes.add(normCode);
    seenNames.add(normName);
    result.push(dept);
  }

  return result.sort((a, b) => {
    const metaA = findCanonicalMeta(a);
    const metaB = findCanonicalMeta(b);
    if (metaA && metaB) return metaA.order - metaB.order;
    if (metaA) return -1;
    if (metaB) return 1;
    return formatDepartmentLabel(a).localeCompare(formatDepartmentLabel(b));
  });
}

/**
 * Filters departments by display label, code, name, or Bangla name.
 */
export function filterDepartments(
  departments: Department[],
  query: string
): Department[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return departments;

  return departments.filter((dept) => {
    const label = formatDepartmentLabel(dept).toLowerCase();
    const code = dept.code.trim().toLowerCase();
    const name = dept.name.trim().toLowerCase();
    const nameBn = (dept.name_bn || '').trim().toLowerCase();
    return (
      label.includes(clean) ||
      code.includes(clean) ||
      name.includes(clean) ||
      nameBn.includes(clean)
    );
  });
}
