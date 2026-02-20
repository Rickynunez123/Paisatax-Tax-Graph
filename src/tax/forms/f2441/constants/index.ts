/**
 * FORM 2441 — CHILD AND DEPENDENT CARE EXPENSES
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Form 2441 Instructions (2025) — IRS.gov/instructions/i2441
 *   IRS Publication 503 — Child and Dependent Care Expenses
 *   IRC Section 21 — Child and Dependent Care Credit
 *
 * KEY 2025 NUMBERS:
 *   Expense cap — 1 qualifying person:    $3,000
 *   Expense cap — 2+ qualifying persons:  $6,000
 *   Credit rate range:                    20% – 35%
 *   Rate floor (AGI > $43,000):           20%
 *   Rate ceiling (AGI ≤ $15,000):         35%
 *   Rate decreases by 1% per $2,000 AGI above $15,000
 *   Employer-provided dependent care exclusion max: $5,000 ($2,500 MFS)
 *
 * AGI PERCENTAGE TABLE (IRC §21(a)(2)):
 *   These thresholds and percentages are stable year to year —
 *   they are not indexed for inflation. Verbatim from IRS Form 2441 Line 8.
 *
 *   AGI              Decimal
 *   0     – 15,000   .35
 *   15,001 – 17,000  .34
 *   17,001 – 19,000  .33
 *   19,001 – 21,000  .32
 *   21,001 – 23,000  .31
 *   23,001 – 25,000  .30
 *   25,001 – 27,000  .29
 *   27,001 – 29,000  .28
 *   29,001 – 31,000  .27
 *   31,001 – 33,000  .26
 *   33,001 – 35,000  .25
 *   35,001 – 37,000  .24
 *   37,001 – 39,000  .23
 *   39,001 – 41,000  .22
 *   41,001 – 43,000  .21
 *   43,001 and over  .20
 *
 * CREDIT IS NONREFUNDABLE.
 *   It can reduce tax to zero but cannot produce a refund.
 *   The tax liability cap is enforced in the node (line 10).
 *
 * DEPENDENT CARE BENEFITS (Part III):
 *   Employer-provided dependent care (W-2 Box 10) reduces the
 *   expense base available for the credit. Deferred for now —
 *   tracked as an input that defaults to 0.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditRateEntry {
  /** AGI floor (inclusive) */
  floor:   number
  /** AGI ceiling (inclusive); Infinity for the top bracket */
  ceiling: number
  /** Decimal rate applied to qualified expenses */
  rate:    number
}

export interface F2441Constants {
  taxYear: string

  /** Maximum qualifying expenses for one person */
  expenseCapOnePerson:    number

  /** Maximum qualifying expenses for two or more persons */
  expenseCapTwoPlusPersons: number

  /**
   * Maximum employer-provided dependent care exclusion from income.
   * Reduces the expense base available for the credit.
   * MFS: $2,500. All others: $5,000.
   */
  employerBenefitsExclusionMax:    number
  employerBenefitsExclusionMaxMFS: number

  /**
   * AGI-to-credit-rate table (Line 8 of Form 2441).
   * Sorted ascending by floor. Lookup: find first entry where AGI ≤ ceiling.
   */
  creditRateTable: CreditRateEntry[]
}

// ─────────────────────────────────────────────────────────────────────────────
// 2025 CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CREDIT_RATE_TABLE_2025: CreditRateEntry[] = [
  { floor:      0, ceiling:  15_000, rate: 0.35 },
  { floor: 15_001, ceiling:  17_000, rate: 0.34 },
  { floor: 17_001, ceiling:  19_000, rate: 0.33 },
  { floor: 19_001, ceiling:  21_000, rate: 0.32 },
  { floor: 21_001, ceiling:  23_000, rate: 0.31 },
  { floor: 23_001, ceiling:  25_000, rate: 0.30 },
  { floor: 25_001, ceiling:  27_000, rate: 0.29 },
  { floor: 27_001, ceiling:  29_000, rate: 0.28 },
  { floor: 29_001, ceiling:  31_000, rate: 0.27 },
  { floor: 31_001, ceiling:  33_000, rate: 0.26 },
  { floor: 33_001, ceiling:  35_000, rate: 0.25 },
  { floor: 35_001, ceiling:  37_000, rate: 0.24 },
  { floor: 37_001, ceiling:  39_000, rate: 0.23 },
  { floor: 39_001, ceiling:  41_000, rate: 0.22 },
  { floor: 41_001, ceiling:  43_000, rate: 0.21 },
  { floor: 43_001, ceiling: Infinity, rate: 0.20 },
];

export const F2441_CONSTANTS_2025: F2441Constants = {
  taxYear:                         '2025',
  expenseCapOnePerson:              3_000,
  expenseCapTwoPlusPersons:         6_000,
  employerBenefitsExclusionMax:     5_000,
  employerBenefitsExclusionMaxMFS:  2_500,
  creditRateTable:                  CREDIT_RATE_TABLE_2025,
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS INDEX
// ─────────────────────────────────────────────────────────────────────────────

const CONSTANTS_BY_YEAR: Record<string, F2441Constants> = {
  '2025': F2441_CONSTANTS_2025,
};

export function getF2441Constants(taxYear: string): F2441Constants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Form 2441 constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`,
    );
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up the credit rate decimal for a given AGI.
 * Iterates the table and returns the rate for the matching bracket.
 * Returns 0.20 (floor rate) if AGI exceeds all defined brackets.
 */
export function getCreditRate(agi: number, c: F2441Constants): number {
  for (const entry of c.creditRateTable) {
    if (agi >= entry.floor && agi <= entry.ceiling) {
      return entry.rate;
    }
  }
  // Fallback — should not be reached since last entry ceiling is Infinity
  return 0.20;
}

/**
 * Compute the expense cap based on the number of qualifying persons.
 *   1 person  → $3,000
 *   2+ persons → $6,000
 */
export function getExpenseCap(numQualifyingPersons: number, c: F2441Constants): number {
  if (numQualifyingPersons <= 0) return 0;
  return numQualifyingPersons === 1
    ? c.expenseCapOnePerson
    : c.expenseCapTwoPlusPersons;
}

/**
 * Compute the Form 2441 credit (Line 11) given inputs.
 *
 * Formula:
 *   1. expenseCap  = $3,000 (1 person) or $6,000 (2+)
 *   2. qualifiedExp = min(actualExpenses, expenseCap, earnedIncome, spouseEarnedIncome)
 *      minus employer benefits received (W-2 Box 10)
 *   3. rate = getCreditRate(AGI)
 *   4. tentativeCredit = qualifiedExp × rate
 *   5. credit = min(tentativeCredit, taxLiability)  ← nonrefundable cap
 *
 * This function computes step 4 (tentative credit before tax liability cap).
 * The tax liability cap is enforced in the node compute function.
 */
export function computeTentativeCredit(
  qualifiedExpenses:     number,
  numQualifyingPersons:  number,
  agi:                   number,
  earnedIncome:          number,
  spouseEarnedIncome:    number,
  employerBenefits:      number,
  c:                     F2441Constants,
): number {
  if (numQualifyingPersons <= 0) return 0;

  const expenseCap = getExpenseCap(numQualifyingPersons, c);

  // Expenses cannot exceed the cap, earned income of lower-earning spouse,
  // or the combined limit — then reduce by employer-provided benefits
  const earnedIncomeLimit = Math.min(earnedIncome, spouseEarnedIncome);
  const afterBenefits     = Math.max(0, qualifiedExpenses - employerBenefits);
  const qualified         = Math.min(afterBenefits, expenseCap, earnedIncomeLimit);

  if (qualified <= 0) return 0;

  const rate = getCreditRate(agi, c);
  return Math.round(qualified * rate * 100) / 100;
}