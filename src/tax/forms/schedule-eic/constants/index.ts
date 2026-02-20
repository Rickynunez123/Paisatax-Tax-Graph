/**
 * SCHEDULE EIC — EARNED INCOME CREDIT
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Rev. Proc. 2024-40 — 2025 inflation adjustments
 *   IRS Publication 596 (2025) — Earned Income Credit
 *   IRC Section 32 — Earned Income Credit
 *   IRC Section 32(c)(2) — Definition of earned income
 *
 * 2025 KEY NUMBERS (verbatim from Rev. Proc. 2024-40):
 *
 *   Investment income limit:              $11,950
 *   Min age (no qualifying children):         25
 *   Max age (no qualifying children):         64
 *
 *   No qualifying children:
 *     Max credit (single):                  $649
 *     Max credit (MFJ):                     $649
 *     Phase-out start (single):          $10,620
 *     Phase-out start (MFJ):             $17,730
 *     Phase-out end (single):            $19,104
 *     Phase-out end (MFJ):               $26,214
 *
 *   1 qualifying child:
 *     Max credit:                         $4,328
 *     Phase-out start (single):          $23,350
 *     Phase-out start (MFJ):             $30,470
 *     Phase-out end (single):            $50,434
 *     Phase-out end (MFJ):               $57,554
 *
 *   2 qualifying children:
 *     Max credit:                         $7,152
 *     Phase-out start (single):          $23,350
 *     Phase-out start (MFJ):             $30,470
 *     Phase-out end (single):            $57,310
 *     Phase-out end (MFJ):               $64,430
 *
 *   3+ qualifying children:
 *     Max credit:                         $8,046
 *     Phase-out start (single):          $23,350
 *     Phase-out start (MFJ):             $30,470
 *     Phase-out end (single):            $61,555
 *     Phase-out end (MFJ):               $68,675
 *
 * ELIGIBILITY RULES IMPLEMENTED AS NODES:
 *   - MFS filers ineligible (unless separated spouse exception — deferred)
 *   - Investment income limit: $11,950
 *   - Age requirement for childless EIC: 25–64
 *   - Qualifying children require valid SSN; without SSN, only childless EIC applies
 */

export interface EICChildThresholds {
  maxCredit: number;
  single: {
    phaseOutStart: number;
    phaseOutEnd:   number;
  };
  marriedJoint: {
    phaseOutStart: number;
    phaseOutEnd:   number;
  };
}

export interface ScheduleEICConstants {
  taxYear: string;

  /**
   * Thresholds by number of qualifying children (0, 1, 2, 3+)
   * Index 3 = 3 or more children.
   */
  byChildren: [
    EICChildThresholds,  // 0 children
    EICChildThresholds,  // 1 child
    EICChildThresholds,  // 2 children
    EICChildThresholds,  // 3+ children
  ];

  /**
   * Investment income limit — if investment income exceeds this,
   * the taxpayer is ineligible for EIC regardless of earned income.
   */
  investmentIncomeLimit: number;

  /**
   * Age requirements for taxpayers WITHOUT qualifying children.
   * Must be at least minAge and no more than maxAge at year-end.
   */
  childlessAgeMin: number;  // 25
  childlessAgeMax: number;  // 64
}

export const SCHEDULE_EIC_CONSTANTS_2025: ScheduleEICConstants = {
  taxYear: '2025',

  byChildren: [
    // 0 children
    {
      maxCredit: 649,
      single:      { phaseOutStart: 10_620, phaseOutEnd: 19_104 },
      marriedJoint:{ phaseOutStart: 17_730, phaseOutEnd: 26_214 },
    },
    // 1 child
    {
      maxCredit: 4_328,
      single:      { phaseOutStart: 23_350, phaseOutEnd: 50_434 },
      marriedJoint:{ phaseOutStart: 30_470, phaseOutEnd: 57_554 },
    },
    // 2 children
    {
      maxCredit: 7_152,
      single:      { phaseOutStart: 23_350, phaseOutEnd: 57_310 },
      marriedJoint:{ phaseOutStart: 30_470, phaseOutEnd: 64_430 },
    },
    // 3+ children
    {
      maxCredit: 8_046,
      single:      { phaseOutStart: 23_350, phaseOutEnd: 61_555 },
      marriedJoint:{ phaseOutStart: 30_470, phaseOutEnd: 68_675 },
    },
  ],

  investmentIncomeLimit: 11_950,
  childlessAgeMin:            25,
  childlessAgeMax:            64,
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS INDEX
// ─────────────────────────────────────────────────────────────────────────────

const CONSTANTS_BY_YEAR: Record<string, ScheduleEICConstants> = {
  '2025': SCHEDULE_EIC_CONSTANTS_2025,
};

export function getScheduleEICConstants(taxYear: string): ScheduleEICConstants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Schedule EIC constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`,
    );
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the threshold bucket for the given number of qualifying children.
 * Clamps at index 3 for 3+ children.
 */
export function getEICChildThresholds(
  numQualifyingChildren: number,
  c: ScheduleEICConstants,
): EICChildThresholds {
  const index = Math.min(numQualifyingChildren, 3) as 0 | 1 | 2 | 3;
  return c.byChildren[index];
}

/**
 * Returns true if investment income disqualifies the taxpayer.
 */
export function hasExcessInvestmentIncome(
  investmentIncome: number,
  c: ScheduleEICConstants,
): boolean {
  return investmentIncome > c.investmentIncomeLimit;
}

/**
 * Returns true if the taxpayer meets the age requirement for childless EIC.
 * Always returns true when qualifying children are present.
 */
export function meetsChildlessAgeRequirement(
  age: number,
  c: ScheduleEICConstants,
): boolean {
  return age >= c.childlessAgeMin && age <= c.childlessAgeMax;
}