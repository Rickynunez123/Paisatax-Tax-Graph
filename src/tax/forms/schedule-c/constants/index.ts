/**
 * SCHEDULE C — PROFIT OR LOSS FROM BUSINESS
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Rev. Proc. 2024-40 — 2025 inflation adjustments
 *   IRS Notice 2024-80 — 2025 standard mileage rates
 *   IRC §274(n) — 50% meals limitation
 *
 * IRS References:
 *   Instructions for Schedule C (Form 1040) (2025)
 *   IRS Topic No. 510 — Business Use of Car
 */

export interface ScheduleCConstants {
  taxYear: string

  /**
   * Standard mileage rate for business use of a vehicle.
   * 2025: $0.70 per mile (70 cents)
   * Replaces actual vehicle operating expenses (gas, oil, repairs, insurance, etc.)
   * Does NOT include depreciation (included in the rate) or parking/tolls
   * (those are added separately on top of the mileage deduction).
   */
  standardMileageRate: number

  /**
   * Percentage of business meal expenses that are deductible.
   * IRC §274(n): generally 50% for business meals.
   * Exception: 100% for food provided on employer premises for employer's
   * convenience — deferred, not implemented here.
   */
  mealsDeductionPercentage: number
}

export const SCHEDULE_C_CONSTANTS_2025: ScheduleCConstants = {
  taxYear:                  '2025',
  standardMileageRate:      0.70,
  mealsDeductionPercentage: 0.50,
};

const CONSTANTS_BY_YEAR: Record<string, ScheduleCConstants> = {
  '2025': SCHEDULE_C_CONSTANTS_2025,
};

export function getScheduleCConstants(taxYear: string): ScheduleCConstants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Schedule C constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`,
    );
  }
  return c;
}