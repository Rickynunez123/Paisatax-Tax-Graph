/**
 * FORM 8889 — HEALTH SAVINGS ACCOUNT (HSA)
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Rev. Proc. 2024-25 (HSA limits for 2025)
 *   IRS Publication 969 (HSAs and Other Tax-Favored Health Plans)
 *   IRC Section 223
 *
 * Changes from 2024:
 *   Self-only limit:       $4,150 → $4,300  (+$150)
 *   Family limit:          $8,300 → $8,550  (+$250)
 *   HDHP min deductible:   unchanged
 *   HDHP max out-of-pocket: $8,050/$16,100 → $8,300/$16,600
 *   Catch-up limit:         unchanged ($1,000 — never inflation-adjusted)
 */

import type { F8889Constants } from './2024';

export const F8889_CONSTANTS_2025: F8889Constants = {
  taxYear: '2025',

  /**
   * Annual HSA contribution limits (IRC §223(b)(2))
   * Self-only HDHP coverage: $4,300  ← increased from $4,150
   * Family HDHP coverage:    $8,550  ← increased from $8,300
   */
  annualContributionLimit: {
    selfOnly: 4_300,
    family:   8_550,
  },

  /**
   * Catch-up contribution limit for taxpayers age 55+ (IRC §223(b)(3))
   * $1,000 — unchanged, never inflation-adjusted
   */
  catchUpContributionLimit: 1_000,

  /**
   * Minimum annual deductible to qualify as an HDHP (IRC §223(c)(2)(A))
   * Self-only: $1,650  ← increased from $1,600
   * Family:    $3,300  ← increased from $3,200
   */
  hdhpMinimumDeductible: {
    selfOnly: 1_650,
    family:   3_300,
  },

  /**
   * Maximum out-of-pocket expense limit for HDHP qualification (IRC §223(c)(2)(A))
   * Self-only: $8,300   ← increased from $8,050
   * Family:    $16,600  ← increased from $16,100
   */
  hdhpMaxOutOfPocket: {
    selfOnly: 8_300,
    family:   16_600,
  },

  /**
   * Penalty rates — unchanged from 2024
   */
  nonQualifiedDistributionPenaltyRate: 0.20,
  reducedPenaltyRate: 0.10,

  penaltyExemptAge:   65,
  catchUpEligibleAge: 55,
};