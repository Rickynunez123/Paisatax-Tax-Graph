/**
 * SCHEDULE 1 — ADDITIONAL INCOME AND ADJUSTMENTS
 * Constants for tax years 2024 and 2025
 *
 * Sources:
 *   IRS Schedule 1 Instructions (2024, 2025)
 *   Form 1040 Instructions
 *
 * Schedule 1 has two parts:
 *   Part I  — Additional Income        🚧 DEFERRED (capital gains, alimony, etc.)
 *   Part II — Adjustments to Income    ✅ PARTIAL (HSA deduction implemented)
 *
 * Part II is the "above-the-line" deduction section.
 * These deductions reduce Gross Income → AGI without itemizing.
 * The HSA deduction (Line 13) is the one we have implemented.
 *
 * Lines and their source forms (Part II):
 *   Line 11 — Educator expenses               🚧 deferred
 *   Line 12 — Business expenses (Form 2106)   🚧 deferred
 *   Line 13 — HSA deduction (Form 8889)        ✅ implemented
 *   Line 14 — Moving expenses (Form 3903)      🚧 deferred (military only)
 *   Line 15 — Self-employment deduction        🚧 deferred
 *   Line 16 — SEP/SIMPLE/qualified plan        🚧 deferred
 *   Line 17 — Self-employed health insurance   🚧 deferred
 *   Line 18 — Penalty on early withdrawal      🚧 deferred
 *   Line 19 — Alimony paid (pre-2019 divorce)  🚧 deferred
 *   Line 20 — IRA deduction                    🚧 deferred
 *   Line 21 — Student loan interest            🚧 deferred
 *   Line 22 — Archer MSA deduction             🚧 deferred
 *   Line 23 — Other adjustments                🚧 deferred
 *   Line 26 — Total adjustments (sum of above) ✅ implemented
 */

export interface Schedule1Constants {
  taxYear: string
  partII: {
    line13_source:      'f8889'
    line26_isTotal:     true
  }
}

export const SCHEDULE1_CONSTANTS_2024: Schedule1Constants = {
  taxYear: '2024',
  partII: {
    line13_source:  'f8889',
    line26_isTotal: true,
  },
};

export const SCHEDULE1_CONSTANTS_2025: Schedule1Constants = {
  ...SCHEDULE1_CONSTANTS_2024,
  taxYear: '2025',
};

const CONSTANTS_BY_YEAR: Record<string, Schedule1Constants> = {
  '2024': SCHEDULE1_CONSTANTS_2024,
  '2025': SCHEDULE1_CONSTANTS_2025,
};

export function getSchedule1Constants(taxYear: string): Schedule1Constants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Schedule 1 constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`
    );
  }
  return c;
}