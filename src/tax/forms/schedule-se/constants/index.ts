/**
 * SCHEDULE SE — SELF-EMPLOYMENT TAX
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Rev. Proc. 2024-40 — 2025 inflation adjustments
 *   SSA Fact Sheet 2025 — Social Security wage base
 *   IRC §1401 — SE tax rates
 *   IRC §164(f) — deductible portion of SE tax
 *
 * SELF-EMPLOYMENT TAX STRUCTURE (2025):
 *   Rate applies to net self-employment earnings (net profit × 92.35%).
 *   The 92.35% factor = 1 − (SE rate / 2) = 1 − 7.65%, which mirrors
 *   the employee/employer split: an employee pays 7.65% and the employer
 *   pays 7.65% on wages, but both are deductible. Self-employed persons
 *   pay both halves but get to deduct the "employer" half from income.
 *
 *   SOCIAL SECURITY (12.4%):
 *     Applies only up to the SS wage base ($176,100 for 2025).
 *     Employer half (6.2%) is deductible above-the-line.
 *
 *   MEDICARE (2.9%):
 *     Applies to ALL net earnings — no wage base cap.
 *     Employer half (1.45%) is deductible above-the-line.
 *     Additional Medicare Tax (0.9%) applies above $200,000/$250,000
 *     — this is on Form 8959, deferred here.
 *
 *   COMBINED RATE BELOW SS WAGE BASE:  15.3% (12.4% SS + 2.9% Medicare)
 *   RATE ABOVE SS WAGE BASE:            2.9%  (Medicare only)
 *
 *   DEDUCTIBLE HALF:
 *     IRC §164(f): 50% of SE tax is deductible above-the-line
 *     (Schedule 1 Part II Line 15). This mimics the employer deduction
 *     for FICA taxes paid on employee wages.
 *
 * IRS References:
 *   Schedule SE Instructions (2025)
 *   IRS Pub 334 — Tax Guide for Small Business
 *   IRC §§1401, 1402, 164(f)
 */

export interface ScheduleSEConstants {
  taxYear: string

  /**
   * Net profit multiplier before computing SE tax.
   * Net earnings = net profit × 0.9235
   * Derived from: 1 - (combined SE rate / 2) = 1 - 0.0765 = 0.9235
   */
  netEarningsMultiplier: number

  /**
   * Social Security tax rate (employee + employer combined).
   * 12.4% applies only up to ssWageBase.
   */
  socialSecurityRate: number

  /**
   * Medicare tax rate (employee + employer combined).
   * 2.9% applies to all net earnings — no cap.
   */
  medicareRate: number

  /**
   * Social Security wage base — SS tax stops above this amount.
   * 2025: $176,100
   */
  ssWageBase: number

  /**
   * Combined SE tax rate below SS wage base.
   * socialSecurityRate + medicareRate = 15.3%
   */
  combinedRateBelowBase: number

  /**
   * SE tax rate above SS wage base (Medicare only).
   */
  rateAboveBase: number

  /**
   * Fraction of SE tax that is deductible above-the-line (IRC §164(f)).
   * Always 50% — the "employer half" of the combined rate.
   */
  deductibleFraction: number

  /**
   * Minimum net earnings threshold below which SE tax does not apply.
   * SE tax is not owed if net earnings from SE are under $400.
   */
  minimumNetEarnings: number
}

export const SCHEDULE_SE_CONSTANTS_2025: ScheduleSEConstants = {
  taxYear:                '2025',
  netEarningsMultiplier:  0.9235,
  socialSecurityRate:     0.124,
  medicareRate:           0.029,
  ssWageBase:             176_100,
  combinedRateBelowBase:  0.153,   // 12.4% + 2.9%
  rateAboveBase:          0.029,   // Medicare only
  deductibleFraction:     0.50,
  minimumNetEarnings:     400,
};

const CONSTANTS_BY_YEAR: Record<string, ScheduleSEConstants> = {
  '2025': SCHEDULE_SE_CONSTANTS_2025,
};

export function getScheduleSEConstants(taxYear: string): ScheduleSEConstants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Schedule SE constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`,
    );
  }
  return c;
}

/**
 * computeSETax — Self-Employment Tax calculation.
 *
 * Implements Schedule SE Section A (Short Schedule SE) for most filers
 * and Section B (Long Schedule SE) for earnings above the SS wage base.
 *
 * Parameters:
 *   netProfit — Schedule C/F net profit (or loss, floored at 0)
 *   c         — Schedule SE constants for the tax year
 *
 * Returns: { seTax, deductibleHalf, netEarnings }
 *
 * Exported for unit testing independently of the full engine.
 */
export function computeSETax(
  netProfit: number,
  c:         ScheduleSEConstants,
): { seTax: number; deductibleHalf: number; netEarnings: number } {
  // SE tax only applies when net earnings ≥ $400
  if (netProfit < c.minimumNetEarnings) {
    return { seTax: 0, deductibleHalf: 0, netEarnings: 0 };
  }

  // Net earnings subject to SE tax (Line 4a on Schedule SE)
  const netEarnings = netProfit * c.netEarningsMultiplier;

  let seTax: number;

  if (netEarnings <= c.ssWageBase) {
    // Section A — all earnings below SS wage base
    seTax = netEarnings * c.combinedRateBelowBase;
  } else {
    // Section B — earnings straddle or exceed SS wage base
    const ssPortion       = c.ssWageBase * c.socialSecurityRate;
    const medicarePortion = netEarnings  * c.medicareRate;
    seTax = ssPortion + medicarePortion;
  }

  const deductibleHalf = seTax * c.deductibleFraction;

  return {
    seTax:          Math.round(seTax * 100) / 100,
    deductibleHalf: Math.round(deductibleHalf * 100) / 100,
    netEarnings:    Math.round(netEarnings * 100) / 100,
  };
}