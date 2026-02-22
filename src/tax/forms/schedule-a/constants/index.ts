/**
 * SCHEDULE A — ITEMIZED DEDUCTIONS
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Rev. Proc. 2024-40  — 2025 inflation adjustments
 *   IRC §68                 — Overall limitation on itemized deductions (repealed by TCJA, still $0)
 *   IRC §164(b)(6)          — SALT deduction cap ($10,000)
 *   IRC §163(h)(3)          — Mortgage interest limits
 *   IRC §170                — Charitable contribution limits
 *   IRS Publication 17 (2025)
 *
 * SALT CAP:
 *   $10,000 for all filing statuses EXCEPT married_filing_separately ($5,000).
 *   The cap applies to the combined total of state/local income (or sales) taxes
 *   plus real estate taxes. Personal property taxes are included in the cap.
 *
 * MORTGAGE INTEREST:
 *   Acquisition debt limit: $750,000 ($375,000 MFS) for loans originated after
 *   December 15, 2017. Older loans grandfathered at $1,000,000.
 *   Home equity interest deductible only if used to buy/build/improve home.
 *
 * CHARITABLE CONTRIBUTIONS:
 *   Cash to public charities: limited to 60% of AGI.
 *   Capital gain property to public charities: limited to 30% of AGI.
 *   Carryforward: 5 years.
 *
 * MEDICAL EXPENSES:
 *   Only the amount EXCEEDING 7.5% of AGI is deductible (2025).
 *   Floor: 7.5% (same as 2024 — no change under TCJA).
 *
 * CASUALTY LOSSES:
 *   Only federally declared disaster losses are deductible post-TCJA.
 *   Subject to $100 per-event floor and 10% AGI floor.
 *   Deferred — not yet implemented.
 */

export interface ScheduleAConstants {
  taxYear: string

  /**
   * SALT deduction cap (state and local taxes).
   * IRC §164(b)(6). $10,000 for most filers; $5,000 for MFS.
   */
  saltCap: {
    standard: number           // all filing statuses except MFS
    marriedFilingSeparately: number
  }

  /**
   * Medical expense AGI floor.
   * Only amounts exceeding this percentage of AGI are deductible.
   */
  medicalExpenseAgiFloor: number   // 0.075 = 7.5%

  /**
   * Charitable contribution AGI limits.
   */
  charitableContribution: {
    cashAgiLimit: number           // 0.60 = 60% of AGI
    capitalGainPropertyAgiLimit: number  // 0.30 = 30% of AGI
  }

  /**
   * Mortgage interest acquisition debt limit.
   * Post-12/15/2017 loans: $750,000 ($375,000 MFS).
   */
  mortgageDebtLimit: {
    standard: number
    marriedFilingSeparately: number
  }
}

export const SCHEDULE_A_CONSTANTS_2025: ScheduleAConstants = {
  taxYear: '2025',

  saltCap: {
    standard: 10_000,
    marriedFilingSeparately: 5_000,
  },

  medicalExpenseAgiFloor: 0.075,

  charitableContribution: {
    cashAgiLimit: 0.60,
    capitalGainPropertyAgiLimit: 0.30,
  },

  mortgageDebtLimit: {
    standard: 750_000,
    marriedFilingSeparately: 375_000,
  },
};

const CONSTANTS_BY_YEAR: Record<string, ScheduleAConstants> = {
  '2025': SCHEDULE_A_CONSTANTS_2025,
};

export function getScheduleAConstants(taxYear: string): ScheduleAConstants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Schedule A constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`
    );
  }
  return c;
}