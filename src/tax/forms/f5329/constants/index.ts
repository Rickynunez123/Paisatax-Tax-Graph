/**
 * FORM 5329 — ADDITIONAL TAXES ON QUALIFIED PLANS
 * Constants for tax years 2024 and 2025
 *
 * Sources:
 *   IRS Form 5329 Instructions (2024, 2025)
 *   IRC Section 4973 (excess contributions — HSA, IRA, ESA, etc.)
 *   IRC Section 72(t) (early distributions from retirement plans)
 *   SECURE 2.0 Act (RMD penalty reduction effective 2023)
 *
 * Note on structure:
 *   Form 5329 has 9 parts. Most rates are fixed by statute and do not
 *   change year to year. The constants that DO change are the
 *   contribution limits that feed into "excess" calculations —
 *   but those limits live in the source form's constants (e.g. f8889).
 *   Form 5329 only holds the excise/penalty rates that ARE its own.
 */

export interface F5329Constants {
  taxYear: string

  /**
   * Part I — Early Distributions from Qualified Plans (IRC §72(t))
   * 10% additional tax on early distributions (before age 59½).
   * Rate is fixed by statute — does not change.
   */
  earlyDistributionPenaltyRate: number

  /**
   * Age threshold below which early distribution penalty applies.
   * 59.5 years old (age 59, 6+ months).
   * Fixed by statute.
   */
  earlyDistributionPenaltyAge: number

  /**
   * Part VII — Excess HSA Contributions (IRC §4973)
   * 6% excise tax on excess contributions remaining at year-end.
   * Applied each year the excess remains uncorrected.
   * Rate is fixed by statute.
   */
  hsaExcessContributionPenaltyRate: number

  /**
   * Part VIII — Excess Archer MSA Contributions (IRC §4973)
   * Same 6% rate — separate part for MSA vs HSA.
   * 🚧 UNSUPPORTED — Archer MSAs are obsolete for most filers.
   */
  msaExcessContributionPenaltyRate: number

  /**
   * Part IX — Failure to Take Required Minimum Distributions (IRC §4974)
   *
   * SECURE 2.0 reduced the RMD penalty:
   *   Before 2023: 50% of the amount not distributed
   *   2023+:       25% (further reduced to 10% if corrected timely)
   *
   * We store the standard rate (25%) and the corrected rate (10%).
   */
  rmdPenaltyRate:          number   // 25% standard (post-SECURE 2.0)
  rmdCorrectedPenaltyRate: number   // 10% if corrected within correction window

  /**
   * Year SECURE 2.0 RMD penalty reduction took effect.
   * For years before this, the rate was 50%.
   */
  secure2RmdEffectiveYear: string
}

// ─────────────────────────────────────────────────────────────────────────────
// 2024 CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const F5329_CONSTANTS_2024: F5329Constants = {
  taxYear: '2024',

  // Part I — Early Distributions
  earlyDistributionPenaltyRate: 0.10,
  earlyDistributionPenaltyAge:  59.5,

  // Part VII — HSA Excess (6% — unchanged since statute was written)
  hsaExcessContributionPenaltyRate: 0.06,

  // Part VIII — MSA Excess (same rate, different form part)
  msaExcessContributionPenaltyRate: 0.06,

  // Part IX — RMD failure (SECURE 2.0 rates, effective 2023)
  rmdPenaltyRate:          0.25,
  rmdCorrectedPenaltyRate: 0.10,
  secure2RmdEffectiveYear: '2023',
};

// ─────────────────────────────────────────────────────────────────────────────
// 2025 CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * No rate changes from 2024 to 2025 for Form 5329.
 * All rates are fixed by statute and do not inflation-adjust.
 * Defined separately so the pattern is consistent and adding
 * future changes requires only this file.
 */
export const F5329_CONSTANTS_2025: F5329Constants = {
  ...F5329_CONSTANTS_2024,
  taxYear: '2025',
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS INDEX
// ─────────────────────────────────────────────────────────────────────────────

const CONSTANTS_BY_YEAR: Record<string, F5329Constants> = {
  '2024': F5329_CONSTANTS_2024,
  '2025': F5329_CONSTANTS_2025,
};

export function getF5329Constants(taxYear: string): F5329Constants {
  const constants = CONSTANTS_BY_YEAR[taxYear];
  if (!constants) {
    throw new Error(
      `Form 5329 constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`
    );
  }
  return constants;
}