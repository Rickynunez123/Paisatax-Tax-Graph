/**
 * SCHEDULE H — HOUSEHOLD EMPLOYMENT TAXES
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Rev. Proc. 2024-40  — 2025 inflation adjustments
 *   IRS Publication 926 (2025) — Household Employer's Tax Guide
 *   IRC §3101, §3111          — FICA taxes
 *   IRC §3301, §3306          — FUTA tax
 *   IRC §3121(a)(7)(B)        — Cash wage threshold for household workers
 *
 * WHO FILES SCHEDULE H:
 *   Any household employer who paid a household employee:
 *     (a) Cash wages of $2,800 or more in 2025 (Social Security / Medicare threshold), OR
 *     (b) $1,000 or more in any calendar quarter of 2024 or 2025 (FUTA threshold)
 *
 * FICA (Social Security and Medicare):
 *   Employee share:  7.65% (6.2% SS + 1.45% Medicare)
 *   Employer share:  7.65% (6.2% SS + 1.45% Medicare)
 *   Total FICA:     15.3% on wages up to SS wage base ($176,100 for 2025)
 *   Medicare only:   2.9% above SS wage base (rare for household workers)
 *
 * FUTA (Federal Unemployment Tax):
 *   Gross rate:   6.0% on first $7,000 of cash wages per employee
 *   FUTA credit:  Up to 5.4% for timely state unemployment tax payments
 *   Net rate:     0.6% after full FUTA credit (most common case)
 *
 * ADDITIONAL MEDICARE TAX:
 *   0.9% on wages above $200,000 (single) / $250,000 (MFJ) combined.
 *   Household workers rarely hit this threshold — deferred.
 *
 * NANNY TAX THRESHOLD (2025):
 *   $2,800 — cash wages paid to a household employee trigger FICA.
 *   Below this, no FICA or Schedule H required (for that employee).
 *
 * FUTA THRESHOLD:
 *   $1,000 in any calendar quarter triggers FUTA obligation.
 *   Applies per quarter — even if annual total is under $2,800.
 */

export interface ScheduleHConstants {
  taxYear: string

  /**
   * Minimum cash wages paid to a household employee that trigger FICA.
   * IRC §3121(a)(7)(B). $2,800 for 2025.
   */
  ficaWageThreshold: number

  /**
   * Minimum cash wages in any calendar quarter that trigger FUTA obligation.
   * $1,000 per quarter.
   */
  futaQuarterlyThreshold: number

  /**
   * Social Security wage base — OASDI applies only up to this amount.
   */
  socialSecurityWageBase: number

  /**
   * FICA rates.
   */
  fica: {
    socialSecurityRate: number   // 0.062 — both employee and employer shares
    medicareRate: number         // 0.0145 — both employee and employer shares
    totalEmployeeRate: number    // 0.0765
    totalEmployerRate: number    // 0.0765
    combinedRate: number         // 0.153 — full FICA on wages
  }

  /**
   * FUTA rates.
   */
  futa: {
    grossRate: number            // 0.060 — before state credit
    maxStateCredit: number       // 0.054 — for timely state UI payments
    netRateAfterCredit: number   // 0.006 — typical net rate
    wageBase: number             // 7_000 — per employee per year
  }
}

export const SCHEDULE_H_CONSTANTS_2025: ScheduleHConstants = {
  taxYear: '2025',

  ficaWageThreshold: 2_800,
  futaQuarterlyThreshold: 1_000,
  socialSecurityWageBase: 176_100,

  fica: {
    socialSecurityRate: 0.062,
    medicareRate: 0.0145,
    totalEmployeeRate: 0.0765,
    totalEmployerRate: 0.0765,
    combinedRate: 0.153,
  },

  futa: {
    grossRate: 0.060,
    maxStateCredit: 0.054,
    netRateAfterCredit: 0.006,
    wageBase: 7_000,
  },
};

const CONSTANTS_BY_YEAR: Record<string, ScheduleHConstants> = {
  '2025': SCHEDULE_H_CONSTANTS_2025,
};

export function getScheduleHConstants(taxYear: string): ScheduleHConstants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Schedule H constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`
    );
  }
  return c;
}

/**
 * Compute FICA taxes on household wages.
 *
 * Returns:
 *   employeeShare  — the employee's 7.65% portion (withheld from wages)
 *   employerShare  — the employer's 7.65% portion (owed by household)
 *   totalFica      — combined 15.3% (what flows to Schedule 2 / Form 1040)
 *
 * Both shares are capped at the SS wage base for the 6.2% SS component.
 * Medicare (1.45%) has no wage base cap.
 *
 * NOTE: If the employer elected to pay both shares (not withhold from employee),
 * the full 15.3% is the employer's liability. The engine always computes
 * the full combined FICA — the preparer's withholding election only affects
 * Form W-2 preparation, not Schedule H total tax.
 */
export function computeHouseholdFica(
  totalWages: number,
  c: ScheduleHConstants,
): { employeeShare: number; employerShare: number; totalFica: number } {
  if (totalWages < c.ficaWageThreshold) {
    return { employeeShare: 0, employerShare: 0, totalFica: 0 };
  }

  // Social Security: capped at wage base
  const ssWages       = Math.min(totalWages, c.socialSecurityWageBase);
  const ssTax         = ssWages * c.fica.socialSecurityRate;  // each share

  // Medicare: no cap
  const medicareTax   = totalWages * c.fica.medicareRate;     // each share

  const employeeShare = Math.round((ssTax + medicareTax) * 100) / 100;
  const employerShare = Math.round((ssTax + medicareTax) * 100) / 100;
  const totalFica     = Math.round((employeeShare + employerShare) * 100) / 100;

  return { employeeShare, employerShare, totalFica };
}

/**
 * Compute FUTA tax on household wages.
 *
 * FUTA applies to the first $7,000 of cash wages per employee per year.
 * Since Schedule H is filed per household (not per employee), the preparer
 * enters the aggregate FUTA-taxable wages across all employees.
 *
 * Net rate: 6.0% gross − up to 5.4% state credit = 0.6% typical net.
 * If the state UI tax was not paid by the Schedule H due date, the full 6.0% applies.
 *
 * Parameters:
 *   futaTaxableWages — total wages subject to FUTA (capped at $7,000 per employee,
 *                      preparer enters the aggregate across all employees)
 *   stateUiTaxPaid   — total state unemployment insurance tax paid on time
 *   c                — schedule H constants
 */
export function computeFuta(
  futaTaxableWages: number,
  stateUiTaxPaid: number,
  c: ScheduleHConstants,
): number {
  if (futaTaxableWages <= 0) return 0;

  const grossFuta     = futaTaxableWages * c.futa.grossRate;
  // Credit is lesser of: state UI paid or max credit (5.4% of taxable wages)
  const maxCredit     = futaTaxableWages * c.futa.maxStateCredit;
  const actualCredit  = Math.min(stateUiTaxPaid, maxCredit);
  const netFuta       = Math.max(0, grossFuta - actualCredit);

  return Math.round(netFuta * 100) / 100;
}