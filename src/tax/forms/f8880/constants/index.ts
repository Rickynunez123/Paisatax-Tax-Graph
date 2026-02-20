/**
 * FORM 8880 — CREDIT FOR QUALIFIED RETIREMENT SAVINGS CONTRIBUTIONS
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Rev. Proc. 2024-40 — 2025 inflation adjustments
 *   IRS Form 8880 Instructions (2025)
 *   IRC Section 25B — Elective Deferrals and IRA Contributions Credit
 *   SECURE 2.0 Act — Enhanced Saver's Credit provisions
 *
 * THE SAVER'S CREDIT — HOW IT WORKS:
 *   A nonrefundable credit for low-to-moderate income taxpayers who
 *   contribute to IRAs, 401(k)s, 403(b)s, 457(b)s, SIMPLE IRAs, or SEPs.
 *
 *   Steps:
 *     1. Enter contributions (primary + spouse if MFJ), capped at $2,000 each
 *     2. Subtract prior-year distributions received in the past 2 years
 *        (this reduces the qualifying contribution amount)
 *     3. Multiply net contributions by the credit rate (AGI table lookup)
 *     4. Cap at tax liability (nonrefundable)
 *
 *   CREDIT RATE TABLE (2025 AGI thresholds):
 *     Filing Status          AGI ≤ Tier 1    ≤ Tier 2    ≤ Tier 3    > Tier 3
 *     MFJ                     ≤ $43,500      ≤ $47,500   ≤ $73,000   > $73,000
 *     HoH                     ≤ $32,625      ≤ $35,625   ≤ $54,750   > $54,750
 *     Single/MFS/QSS          ≤ $21,750      ≤ $23,750   ≤ $36,500   > $36,500
 *     Rate                      50%            20%         10%           0%
 *
 * CONTRIBUTION TYPES THAT QUALIFY (Form 8880 Line 1):
 *   - Traditional IRA (not Roth for this line — Roth is Line 1 separately)
 *   - Roth IRA
 *   - 401(k), 403(b), governmental 457(b), SARSEP, SIMPLE IRA
 *   - Voluntary after-tax employee contributions to qualified plans
 *   NOTE: Rollover contributions do NOT qualify. Employer matches do NOT qualify.
 *
 * DISTRIBUTION LOOKBACK (Form 8880 Lines 2–4):
 *   Distributions received from retirement accounts in:
 *     - 2025 (current year)
 *     - 2024 (prior year)
 *     - Jan 1 – April 15, 2026 (early distributions of prior-year IRA contributions)
 *   These reduce the qualifying contribution amount dollar-for-dollar.
 *   This prevents gaming the credit by contributing and distributing in same year.
 *
 * IRS References:
 *   Form 8880 Instructions (2025)
 *   IRC Section 25B
 */

export interface F8880AGITier {
  /**
   * Maximum AGI for this credit rate (inclusive).
   * A filer with AGI exactly at this threshold qualifies for this rate.
   * For the 0% tier: all filers above the 10% threshold get 0.
   */
  maxAGI: number;
  rate:   number;  // 0.50, 0.20, 0.10, or 0.00
}

export interface F8880Constants {
  taxYear: string;

  /**
   * Maximum qualifying contribution per person.
   * Both primary and spouse (MFJ) are each capped at this amount.
   */
  maxContributionPerPerson: number;  // $2,000

  /**
   * Credit rate tiers by filing status.
   * Entries are in DESCENDING rate order (50% → 20% → 10% → 0%).
   * Lookup: iterate from top; use first tier where AGI ≤ tier.maxAGI.
   * If AGI exceeds all tiers' maxAGI, rate = 0.
   */
  rateTiers: {
    marriedFilingJointly:         F8880AGITier[];
    headOfHousehold:               F8880AGITier[];
    singleMFSOrQualifyingSurviving: F8880AGITier[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2025 CONSTANTS (verbatim from IRS Form 8880 Instructions 2025)
// ─────────────────────────────────────────────────────────────────────────────

export const F8880_CONSTANTS_2025: F8880Constants = {
  taxYear: '2025',

  maxContributionPerPerson: 2_000,

  rateTiers: {
    marriedFilingJointly: [
      { maxAGI: 43_500, rate: 0.50 },
      { maxAGI: 47_500, rate: 0.20 },
      { maxAGI: 73_000, rate: 0.10 },
      { maxAGI: Infinity, rate: 0.00 },
    ],
    headOfHousehold: [
      { maxAGI: 32_625, rate: 0.50 },
      { maxAGI: 35_625, rate: 0.20 },
      { maxAGI: 54_750, rate: 0.10 },
      { maxAGI: Infinity, rate: 0.00 },
    ],
    singleMFSOrQualifyingSurviving: [
      { maxAGI: 21_750, rate: 0.50 },
      { maxAGI: 23_750, rate: 0.20 },
      { maxAGI: 36_500, rate: 0.10 },
      { maxAGI: Infinity, rate: 0.00 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS INDEX
// ─────────────────────────────────────────────────────────────────────────────

const CONSTANTS_BY_YEAR: Record<string, F8880Constants> = {
  '2025': F8880_CONSTANTS_2025,
};

export function getF8880Constants(taxYear: string): F8880Constants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Form 8880 constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`,
    );
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select the correct rate tier array for a filing status.
 * qualifying_surviving_spouse uses the same single/MFS tiers per IRS instructions.
 */
function getRateTiers(filingStatus: string, c: F8880Constants): F8880AGITier[] {
  switch (filingStatus) {
    case 'married_filing_jointly':
      return c.rateTiers.marriedFilingJointly;
    case 'head_of_household':
      return c.rateTiers.headOfHousehold;
    default:
      // single, married_filing_separately, qualifying_surviving_spouse
      return c.rateTiers.singleMFSOrQualifyingSurviving;
  }
}

/**
 * Look up the Saver's Credit rate from AGI and filing status.
 *
 * Algorithm: iterate tiers in descending-rate order; return the rate
 * of the first tier where AGI ≤ tier.maxAGI.
 * The last tier always has maxAGI = Infinity and rate = 0, so this
 * function always returns a defined value.
 */
export function getSaversCreditRate(
  agi:          number,
  filingStatus: string,
  c:            F8880Constants,
): number {
  const tiers = getRateTiers(filingStatus, c);
  for (const tier of tiers) {
    if (agi <= tier.maxAGI) return tier.rate;
  }
  return 0;
}

/**
 * Compute the qualifying contribution amount for one filer.
 *
 * qualifying = max(0, min(contributions, maxPerPerson) - distributions)
 *
 * Distributions are subtracted because taking money out in the lookback
 * period negates the credit benefit — the net amount that stayed in
 * a retirement account is what the credit rewards.
 */
export function computeQualifyingContribution(
  contributions:  number,
  distributions:  number,
  c:              F8880Constants,
): number {
  const capped = Math.min(contributions, c.maxContributionPerPerson);
  return Math.max(0, capped - distributions);
}