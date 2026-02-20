/**
 * FORM 8863 — EDUCATION CREDITS
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Form 8863 Instructions (2025) — IRS.gov/instructions/i8863
 *   IRS Publication 970 — Tax Benefits for Education
 *   IRC Section 25A — American Opportunity and Lifetime Learning Credits
 *   One Big Beautiful Bill Act (OBBBA) — SSN required for both credits starting 2025
 *
 * TWO CREDITS ON ONE FORM (cannot claim both for same student):
 *
 * ─── AMERICAN OPPORTUNITY CREDIT (AOTC) ───
 *   Max per eligible student:         $2,500
 *   Expense tier 1: 100% of first     $2,000
 *   Expense tier 2: 25% of next       $2,000  → max $500
 *   Total expense cap per student:    $4,000  → yields max $2,500
 *   Refundable portion:               40% of allowed credit (max $1,000/student)
 *   Nonrefundable portion:            60% of allowed credit (max $1,500/student)
 *   Eligible years:                   First 4 years of postsecondary only
 *   Enrollment requirement:           At least half-time
 *   Years claimable per student:      Max 4 tax years (cumulative, not consecutive)
 *   Phase-out MAGI (single/HoH/QSS):  $80,000 – $90,000
 *   Phase-out MAGI (MFJ):             $160,000 – $180,000
 *   MFS:                              NOT eligible
 *   Flow: AOTC nonrefundable → Schedule 3 Line 3
 *         AOTC refundable   → Form 1040 Line 29
 *
 * ─── LIFETIME LEARNING CREDIT (LLC) ───
 *   Max per return (not per student):  $2,000
 *   Rate:                              20% of first $10,000 of expenses per return
 *   Expense cap (per return):          $10,000
 *   Nonrefundable:                     Yes (cannot create refund)
 *   Eligible years:                    Unlimited (no 4-year cap)
 *   Enrollment requirement:            At least one course (not half-time required)
 *   Phase-out MAGI (single/HoH/QSS):  $80,000 – $90,000  (same as AOTC)
 *   Phase-out MAGI (MFJ):             $160,000 – $180,000 (same as AOTC)
 *   MFS:                              NOT eligible
 *   Flow: LLC nonrefundable → Schedule 3 Line 3 (combined with AOTC nonrefundable)
 *
 * PHASE-OUT MECHANICS (both credits, per IRS form lines 3–6 and 14–17):
 *   1. phaseOutFloor = $80,000 (single) or $160,000 (MFJ)
 *   2. phaseOutRange = $10,000 (single) or $20,000 (MFJ)
 *   3. excessMAGI = max(0, MAGI - phaseOutFloor)
 *   4. phaseOutFraction = min(1, excessMAGI / phaseOutRange)
 *   5. allowedCredit = tentativeCredit × (1 - phaseOutFraction)
 *   Note: IRS rounds phaseOutFraction intermediate values — we use continuous
 *   approximation which is standard practice for software implementations.
 *
 * KEY NOTES:
 *   - AOTC and LLC cannot be claimed for the SAME STUDENT in the same year.
 *   - They CAN be claimed on the same return for DIFFERENT students.
 *   - The combined nonrefundable amount flows together to Schedule 3 Line 3.
 *   - The AOTC refundable portion flows to Form 1040 Line 29 (separate from Schedule 3).
 */

export interface F8863Constants {
  taxYear: string

  /** AOTC per-student limits */
  aotc: {
    tier1Rate:     number  // 1.00 (100%)
    tier1Cap:      number  // $2,000
    tier2Rate:     number  // 0.25 (25%)
    tier2Cap:      number  // $2,000 additional → max $500
    maxPerStudent: number  // $2,500
    refundableRate: number // 0.40 (40%)
    maxRefundable:  number // $1,000 per student
    /** Phase-out: single/HoH/QSS */
    phaseOutFloorSingle: number  // $80,000
    phaseOutCeilSingle:  number  // $90,000
    /** Phase-out: MFJ */
    phaseOutFloorMFJ:    number  // $160,000
    phaseOutCeilMFJ:     number  // $180,000
  }

  /** LLC per-return limits */
  llc: {
    rate:            number  // 0.20 (20%)
    expenseCap:      number  // $10,000 per return
    maxCredit:       number  // $2,000 per return
    /** Phase-out: single/HoH/QSS */
    phaseOutFloorSingle: number  // $80,000
    phaseOutCeilSingle:  number  // $90,000
    /** Phase-out: MFJ */
    phaseOutFloorMFJ:    number  // $160,000
    phaseOutCeilMFJ:     number  // $180,000
  }
}

export const F8863_CONSTANTS_2025: F8863Constants = {
  taxYear: '2025',

  aotc: {
    tier1Rate:            1.00,
    tier1Cap:             2_000,
    tier2Rate:            0.25,
    tier2Cap:             2_000,
    maxPerStudent:        2_500,
    refundableRate:       0.40,
    maxRefundable:        1_000,
    phaseOutFloorSingle:  80_000,
    phaseOutCeilSingle:   90_000,
    phaseOutFloorMFJ:    160_000,
    phaseOutCeilMFJ:     180_000,
  },

  llc: {
    rate:                 0.20,
    expenseCap:           10_000,
    maxCredit:             2_000,
    phaseOutFloorSingle:  80_000,
    phaseOutCeilSingle:   90_000,
    phaseOutFloorMFJ:    160_000,
    phaseOutCeilMFJ:     180_000,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS INDEX
// ─────────────────────────────────────────────────────────────────────────────

const CONSTANTS_BY_YEAR: Record<string, F8863Constants> = {
  '2025': F8863_CONSTANTS_2025,
};

export function getF8863Constants(taxYear: string): F8863Constants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Form 8863 constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`,
    );
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the phase-out multiplier for education credits.
 * Returns a number between 0.0 and 1.0 representing the allowed fraction.
 *
 * Formula:
 *   excess = max(0, MAGI - floor)
 *   range  = ceiling - floor
 *   fraction = min(1, excess / range)
 *   allowed  = 1 - fraction
 *
 * Examples:
 *   MAGI $70,000 single → allowed = 1.00 (full credit)
 *   MAGI $85,000 single → allowed = 0.50 (50% of credit)
 *   MAGI $90,000 single → allowed = 0.00 (no credit)
 *   MAGI $95,000 single → allowed = 0.00 (no credit, already phased out)
 */
export function computePhaseOutMultiplier(
  magi:          number,
  filingStatus:  string,
  floor:         number,
  ceiling:       number,
  mfjFloor:      number,
  mfjCeiling:    number,
): number {
  if (filingStatus === 'married_filing_separately') return 0;

  const phaseFloor = filingStatus === 'married_filing_jointly' ? mfjFloor   : floor;
  const phaseCeil  = filingStatus === 'married_filing_jointly' ? mfjCeiling : ceiling;

  const excess   = Math.max(0, magi - phaseFloor);
  const range    = phaseCeil - phaseFloor;
  const fraction = Math.min(1, excess / range);
  return Math.max(0, 1 - fraction);
}

/**
 * Compute AOTC tentative credit for one student (before phase-out).
 *
 *   tier1 = min(expenses, $2,000) × 100%
 *   tier2 = min(max(0, expenses - $2,000), $2,000) × 25%
 *   total = tier1 + tier2  (max $2,500)
 */
export function computeAOTCTentative(
  qualifiedExpenses: number,
  c: F8863Constants,
): number {
  const tier1 = Math.min(qualifiedExpenses, c.aotc.tier1Cap) * c.aotc.tier1Rate;
  const tier2 = Math.min(Math.max(0, qualifiedExpenses - c.aotc.tier1Cap), c.aotc.tier2Cap) * c.aotc.tier2Rate;
  return Math.min(tier1 + tier2, c.aotc.maxPerStudent);
}

/**
 * Compute LLC tentative credit for the entire return (before phase-out).
 *
 *   qualified = min(totalExpenses, $10,000)
 *   credit    = qualified × 20%  (max $2,000)
 */
export function computeLLCTentative(
  totalQualifiedExpenses: number,
  c: F8863Constants,
): number {
  const capped = Math.min(totalQualifiedExpenses, c.llc.expenseCap);
  return Math.min(capped * c.llc.rate, c.llc.maxCredit);
}