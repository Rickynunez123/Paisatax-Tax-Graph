/**
 * SCHEDULE F — PROFIT OR LOSS FROM FARMING
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Rev. Proc. 2024-40  — 2025 standard mileage rate
 *   IRS Publication 225 (2025) — Farmer's Tax Guide
 *   IRC §162 — ordinary/necessary business expenses
 *   IRC §175 — soil and water conservation expenditures
 *   IRC §263A — UNICAP rules (generally inapplicable to small farmers)
 *
 * CASH vs ACCRUAL:
 *   Most farmers use cash basis accounting.
 *   Accrual is required for C corporations and certain large farming operations.
 *
 * MEALS DEDUCTION:
 *   Farm business meals are subject to the same 50% limit as Schedule C.
 *   IRC §274(n).
 *
 * MILEAGE:
 *   Standard mileage rate for business use of a vehicle: $0.70/mile (2025).
 *   Same rate as Schedule C — applies to farm-related vehicle use.
 */

export interface ScheduleFConstants {
  taxYear: string

  /**
   * Standard mileage rate per business mile.
   * Same as Schedule C — IRS publishes one rate for all business use.
   */
  standardMileageRate: number   // 0.70

  /**
   * Percentage of business meals that is deductible (IRC §274(n)).
   */
  mealsDeductionPercentage: number   // 0.50

  /**
   * Minimum net earnings from farming subject to SE tax.
   * Net profit must exceed $400 for SE tax to apply.
   * Same threshold as Schedule C / Schedule SE.
   */
  minimumNetEarnings: number   // 400
}

export const SCHEDULE_F_CONSTANTS_2025: ScheduleFConstants = {
  taxYear: '2025',
  standardMileageRate: 0.70,
  mealsDeductionPercentage: 0.50,
  minimumNetEarnings: 400,
};

const CONSTANTS_BY_YEAR: Record<string, ScheduleFConstants> = {
  '2025': SCHEDULE_F_CONSTANTS_2025,
};

export function getScheduleFConstants(taxYear: string): ScheduleFConstants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Schedule F constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`
    );
  }
  return c;
}