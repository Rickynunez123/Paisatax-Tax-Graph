/**
 * FORM 8889 — HEALTH SAVINGS ACCOUNT (HSA)
 * Constants for tax year 2024
 *
 * Sources:
 *   IRS Rev. Proc. 2023-23 (HSA limits for 2024)
 *   IRS Publication 969 (HSAs and Other Tax-Favored Health Plans)
 *   IRC Section 223
 *
 * These values are READ-ONLY. Import them into node compute functions
 * via the constants index — never hardcode limits in node logic.
 */

export const F8889_CONSTANTS_2024 = {
  taxYear: '2024',

  /**
   * Annual HSA contribution limits (IRC §223(b)(2))
   * Self-only HDHP coverage: $4,150
   * Family HDHP coverage:    $8,300
   */
  annualContributionLimit: {
    selfOnly: 4_150,
    family:   8_300,
  },

  /**
   * Catch-up contribution limit for taxpayers age 55+ (IRC §223(b)(3))
   * Flat $1,000 — not inflation-adjusted
   */
  catchUpContributionLimit: 1_000,

  /**
   * Minimum annual deductible to qualify as an HDHP (IRC §223(c)(2)(A))
   * Self-only: $1,600
   * Family:    $3,200
   */
  hdhpMinimumDeductible: {
    selfOnly: 1_600,
    family:   3_200,
  },

  /**
   * Maximum out-of-pocket expense limit for HDHP qualification (IRC §223(c)(2)(A))
   * Self-only: $8,050
   * Family:    $16,100
   */
  hdhpMaxOutOfPocket: {
    selfOnly: 8_050,
    family:   16_100,
  },

  /**
   * HSA distribution penalty rate for non-qualified withdrawals (IRC §223(f)(4))
   * 20% additional tax — reduced to 10% if taxpayer is:
   *   - Age 65 or older
   *   - Disabled (as defined by IRC §72(m)(7))
   *   - Deceased
   */
  nonQualifiedDistributionPenaltyRate: 0.20,
  reducedPenaltyRate: 0.10, // applies after age 65 or disability

  /**
   * Age at which the 20% penalty no longer applies to non-qualified distributions.
   * At 65 the taxpayer still owes income tax, but not the additional penalty.
   */
  penaltyExemptAge: 65,

  /**
   * Age threshold for catch-up contributions.
   */
  catchUpEligibleAge: 55,
};

export interface F8889Constants {
  taxYear:                           string;
  annualContributionLimit:           { selfOnly: number; family: number };
  catchUpContributionLimit:          number;
  hdhpMinimumDeductible:             { selfOnly: number; family: number };
  hdhpMaxOutOfPocket:                { selfOnly: number; family: number };
  nonQualifiedDistributionPenaltyRate: number;
  reducedPenaltyRate:                number;
  penaltyExemptAge:                  number;
  catchUpEligibleAge:                number;
}