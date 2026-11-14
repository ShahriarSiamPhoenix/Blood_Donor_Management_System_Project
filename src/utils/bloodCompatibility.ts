import type { BloodGroup } from '../types/database';

export const BLOOD_GROUPS: BloodGroup[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];

export interface BloodCompatibilityInfo {
  group: BloodGroup;
  canReceiveRedCellsFrom: BloodGroup[];
  canDonateRedCellsTo: BloodGroup[];
  summary: string;
}

/**
 * Standard ABO/Rh red blood cell (RBC) reference table.
 * Educational guidance only — hospital crossmatching is always mandatory.
 */
export const BLOOD_COMPATIBILITY_MAP: Record<BloodGroup, BloodCompatibilityInfo> = {
  'O-': {
    group: 'O-',
    canReceiveRedCellsFrom: ['O-'],
    canDonateRedCellsTo: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    summary: 'O- red cells lack A, B, and Rh(D) antigens, making them the emergency universal red cell donor.',
  },
  'O+': {
    group: 'O+',
    canReceiveRedCellsFrom: ['O-', 'O+'],
    canDonateRedCellsTo: ['O+', 'A+', 'B+', 'AB+'],
    summary: 'O+ is one of the most frequently needed blood groups across hospitals.',
  },
  'A-': {
    group: 'A-',
    canReceiveRedCellsFrom: ['O-', 'A-'],
    canDonateRedCellsTo: ['A-', 'A+', 'AB-', 'AB+'],
    summary: 'A- donors can support both A and AB recipients who are Rh-negative or Rh-positive.',
  },
  'A+': {
    group: 'A+',
    canReceiveRedCellsFrom: ['O-', 'O+', 'A-', 'A+'],
    canDonateRedCellsTo: ['A+', 'AB+'],
    summary: 'A+ is common in Bangladesh and compatible with A+ and AB+ red cell recipients.',
  },
  'B-': {
    group: 'B-',
    canReceiveRedCellsFrom: ['O-', 'B-'],
    canDonateRedCellsTo: ['B-', 'B+', 'AB-', 'AB+'],
    summary: 'B- is an uncommon blood group; verified campus donors help prevent shortages.',
  },
  'B+': {
    group: 'B+',
    canReceiveRedCellsFrom: ['O-', 'O+', 'B-', 'B+'],
    canDonateRedCellsTo: ['B+', 'AB+'],
    summary: 'B+ is widely present in South Asia and serves B+ and AB+ patients.',
  },
  'AB-': {
    group: 'AB-',
    canReceiveRedCellsFrom: ['O-', 'A-', 'B-', 'AB-'],
    canDonateRedCellsTo: ['AB-', 'AB+'],
    summary: 'AB- is rare; AB- patients can receive Rh-negative red cells from any ABO group.',
  },
  'AB+': {
    group: 'AB+',
    canReceiveRedCellsFrom: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    canDonateRedCellsTo: ['AB+'],
    summary: 'AB+ red cell recipients can receive red cells from all eight ABO/Rh groups after crossmatching.',
  },
};

export function isValidBloodGroup(value: string): value is BloodGroup {
  return BLOOD_GROUPS.includes(value as BloodGroup);
}

export function isRbcCompatible(donor: BloodGroup, recipient: BloodGroup): boolean {
  return BLOOD_COMPATIBILITY_MAP[recipient].canReceiveRedCellsFrom.includes(donor);
}

/**
 * Informational check only — does NOT constitute medical clearance.
 * Standard whole-blood interval in Bangladesh is typically 90 to 120 days (minimum 90 days configured).
 */
export function getDonationIntervalStatus(
  lastDonationDate: string | null,
  minIntervalDays = 90,
  referenceDate = new Date()
): {
  daysSinceLastDonation: number | null;
  intervalCompleted: boolean;
  daysRemaining: number;
} {
  if (!lastDonationDate) {
    return {
      daysSinceLastDonation: null,
      intervalCompleted: true,
      daysRemaining: 0,
    };
  }

  const last = new Date(lastDonationDate);
  if (Number.isNaN(last.getTime())) {
    return {
      daysSinceLastDonation: null,
      intervalCompleted: true,
      daysRemaining: 0,
    };
  }

  const refMidnight = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
  );
  const lastMidnight = new Date(
    Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())
  );
  const diffDays = Math.floor((refMidnight.getTime() - lastMidnight.getTime()) / (1000 * 60 * 60 * 24));
  const clampedDays = Math.max(0, diffDays);
  const remaining = Math.max(0, minIntervalDays - clampedDays);

  return {
    daysSinceLastDonation: clampedDays,
    intervalCompleted: clampedDays >= minIntervalDays,
    daysRemaining: remaining,
  };
}
