/**
 * FORM 8812 — CREDITS FOR QUALIFYING CHILDREN AND OTHER DEPENDENTS
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Schedule 8812 Instructions (2025) — Dec 5, 2025
 *   IRS Rev. Proc. 2024-40 — 2025 inflation adjustments
 *   IRC Section 24 — Child Tax Credit
 *   One Big Beautiful Bill Act (OBBBA) — CTC increased to $2,200 for 2025
 *
 * KEY 2025 NUMBERS (verbatim from IRS instructions):
 *   CTC max per qualifying child:     $2,200
 *   ODC max per other dependent:        $500
 *   ACTC max per qualifying child:    $1,700
 *   ACTC rate (% of earned income):    15%
 *   ACTC earned income threshold:    $2,500
 *   Phase-out threshold MFJ:        $400,000
 *   Phase-out threshold all others: $200,000
 *   Phase-out rate:                      $50 reduction per $1,000 over threshold
 *                                        (i.e. 5% of excess, rounded up to nearest $1,000)
 *
 * PHASE-OUT MECHANICS (IRC §24(b)):
 *   1. Compute excess MAGI = max(0, MAGI - threshold)
 *   2. Round excess up to nearest $1,000
 *   3. Reduce = (rounded excess / 1,000) * 50
 *   4. Apply reduce to total initial CTC/ODC credit
 *
 * ACTC FORMULA (Part II-A):
 *   ACTC = min(
 *     ACTC_max_per_child * num_qualifying_children,
 *     max(0, earned_income - ACTC_threshold) * ACTC_rate
 *   )
 *   Where ACTC_max = CTC_max - nonRefundableCTC_used
 */

export interface F8812Constants {
  taxYear: string

  /**
   * Part I — CTC and ODC
   */
  ctcMaxPerChild:   number    // $2,200 in 2025
  odcMaxPerDependent: number  // $500 (unchanged)

  /**
   * Phase-out: credit reduces $50 per $1,000 of MAGI over threshold
   */
  phaseOut: {
    thresholdMFJ:    number   // $400,000
    thresholdOther:  number   // $200,000
    reductionPer:    number   // $50 per $1,000 increment
    incrementSize:   number   // $1,000
  }

  /**
   * Part II — ACTC
   */
  actcMaxPerChild:       number  // $1,700 in 2025
  actcEarnedIncomeThreshold: number  // $2,500
  actcRate:              number  // 0.15 (15%)

  /**
   * Part II-B: Three-or-more-children alternative (SS/Medicare method)
   * Threshold where Part II-B may produce a larger ACTC: $5,100
   */
  actcPartIIBThreshold: number  // $5,100
}

export const F8812_CONSTANTS_2025: F8812Constants = {
  taxYear: '2025',

  // Part I
  ctcMaxPerChild:      2_200,
  odcMaxPerDependent:    500,

  // Phase-out
  phaseOut: {
    thresholdMFJ:    400_000,
    thresholdOther:  200_000,
    reductionPer:         50,
    incrementSize:     1_000,
  },

  // Part II — ACTC
  actcMaxPerChild:           1_700,
  actcEarnedIncomeThreshold: 2_500,
  actcRate:                  0.15,
  actcPartIIBThreshold:      5_100,
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS INDEX
// ─────────────────────────────────────────────────────────────────────────────

const CONSTANTS_BY_YEAR: Record<string, F8812Constants> = {
  '2025': F8812_CONSTANTS_2025,
};

export function getF8812Constants(taxYear: string): F8812Constants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Form 8812 constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`,
    );
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS (no engine dependencies — unit testable in isolation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the CTC/ODC phase-out reduction amount.
 *
 * Per IRC §24(b):
 *   1. excess = max(0, MAGI - threshold)
 *   2. rounded = ceil(excess / 1000) * 1000
 *   3. reduction = (rounded / 1000) * 50
 *
 * Example: MAGI $401,500 MFJ
 *   excess = 1,500
 *   rounded = 2,000
 *   reduction = 2 * 50 = $100
 */
export function computePhaseOutReduction(
  magi:          number,
  filingStatus:  string,
  c:             F8812Constants,
): number {
  const threshold = filingStatus === 'married_filing_jointly'
    ? c.phaseOut.thresholdMFJ
    : c.phaseOut.thresholdOther;

  const excess = Math.max(0, magi - threshold);
  if (excess === 0) return 0;

  const rounded = Math.ceil(excess / c.phaseOut.incrementSize) * c.phaseOut.incrementSize;
  return (rounded / c.phaseOut.incrementSize) * c.phaseOut.reductionPer;
}

/**
 * Compute initial (pre-limit) CTC + ODC credit before phase-out.
 *   initialCredit = (numQualifyingChildren * ctcMax) + (numOtherDependents * odcMax)
 */
export function computeInitialCredit(
  numQualifyingChildren: number,
  numOtherDependents:    number,
  c:                     F8812Constants,
): number {
  return (numQualifyingChildren * c.ctcMaxPerChild) +
         (numOtherDependents   * c.odcMaxPerDependent);
}

/**
 * Compute the ACTC (Part II-A formula — general rule).
 *
 *   actcPotential = max(0, earnedIncome - threshold) * rate
 *   actcCap       = actcMaxPerChild * numQualifyingChildren
 *   ACTC          = min(actcPotential, actcCap)
 *
 * The ACTC is further constrained by the unallowed CTC (line 12 - line 14 on
 * the form), but that constraint is enforced in the node compute function
 * where we have access to both values.
 */
export function computeACTC(
  earnedIncome:          number,
  numQualifyingChildren: number,
  c:                     F8812Constants,
): number {
  if (numQualifyingChildren === 0) return 0;

  const potential = Math.max(0, earnedIncome - c.actcEarnedIncomeThreshold) * c.actcRate;
  const cap       = c.actcMaxPerChild * numQualifyingChildren;
  return Math.min(potential, cap);
}