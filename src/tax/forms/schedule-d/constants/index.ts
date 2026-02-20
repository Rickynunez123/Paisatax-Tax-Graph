/**
 * SCHEDULE D — CAPITAL GAINS AND LOSSES
 * QDCGT WORKSHEET — QUALIFIED DIVIDENDS AND CAPITAL GAIN TAX
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Rev. Proc. 2024-40 — 2025 inflation adjustments
 *   IRC §1(h) — Maximum capital gains rates
 *   2025 Schedule D Tax Worksheet (Instructions for Schedule D)
 *
 * PREFERENTIAL RATE STRUCTURE (2025):
 *   0%  rate applies up to the thresholds below
 *   15% rate applies above 0% threshold up to 15%/20% breakpoint
 *   20% rate applies above 15% threshold
 *
 *   Additionally, the 3.8% Net Investment Income Tax (NIIT) applies
 *   when MAGI exceeds $200,000 (single) / $250,000 (MFJ) — deferred.
 *
 * THRESHOLD TABLE (2025, from Rev. Proc. 2024-40):
 *   The 0% bracket ends / 15% bracket begins at:
 *     Single:                    $48,350
 *     MFJ / Surviving Spouse:    $96,700
 *     MFS:                       $48,350
 *     HOH:                       $64,750
 *
 *   The 15% bracket ends / 20% bracket begins at:
 *     Single:                   $533,400
 *     MFJ / Surviving Spouse:   $600,050
 *     MFS:                      $300,000
 *     HOH:                      $566,700
 *
 * HOW THE QDCGT WORKSHEET WORKS (simplified):
 *   1. Qualified income = qualified dividends + net LTCG (floor at 0)
 *   2. Ordinary income  = taxable income − qualified income (floor at 0)
 *   3. Tax on ordinary income  = bracket tax on ordinary income
 *   4. Tax on qualified income = tiered: 0% / 15% / 20% based on thresholds
 *   5. Total tax = step 3 + step 4
 *
 * IRS References:
 *   2025 Schedule D Instructions — Tax Worksheet (page D-12)
 *   Rev. Proc. 2024-40, Section 3.03
 */

export interface QDCGTThresholds {
  /** Taxable income at which 0% LTCG rate ends (15% begins) */
  zeroRateMax:   number
  /** Taxable income at which 15% LTCG rate ends (20% begins) */
  fifteenRateMax: number
}

export interface ScheduleDConstants {
  taxYear:    string
  qdcgt: {
    single:                    QDCGTThresholds
    marriedFilingJointly:      QDCGTThresholds
    marriedFilingSeparately:   QDCGTThresholds
    headOfHousehold:           QDCGTThresholds
    qualifyingSurvivingSpouse: QDCGTThresholds
  }
  /** Maximum capital loss deductible against ordinary income per year */
  capitalLossLimit: number
}

export const SCHEDULE_D_CONSTANTS_2025: ScheduleDConstants = {
  taxYear: '2025',

  qdcgt: {
    single: {
      zeroRateMax:    48_350,
      fifteenRateMax: 533_400,
    },
    marriedFilingJointly: {
      zeroRateMax:    96_700,
      fifteenRateMax: 600_050,
    },
    marriedFilingSeparately: {
      zeroRateMax:    48_350,
      fifteenRateMax: 300_000,
    },
    headOfHousehold: {
      zeroRateMax:    64_750,
      fifteenRateMax: 566_700,
    },
    qualifyingSurvivingSpouse: {
      zeroRateMax:    96_700,
      fifteenRateMax: 600_050,
    },
  },

  capitalLossLimit: 3_000,
};

const CONSTANTS_BY_YEAR: Record<string, ScheduleDConstants> = {
  '2025': SCHEDULE_D_CONSTANTS_2025,
};

export function getScheduleDConstants(taxYear: string): ScheduleDConstants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Schedule D constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`,
    );
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// QDCGT WORKSHEET COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_surviving_spouse';

const FS_TO_KEY: Record<string, keyof ScheduleDConstants['qdcgt']> = {
  'single':                      'single',
  'married_filing_jointly':      'marriedFilingJointly',
  'married_filing_separately':   'marriedFilingSeparately',
  'head_of_household':           'headOfHousehold',
  'qualifying_surviving_spouse': 'qualifyingSurvivingSpouse',
};

/**
 * computeQDCGTTax — implements the Schedule D Tax Worksheet.
 *
 * Called from Form 1040 Line 16 when either:
 *   - qualifiedDividends > 0, OR
 *   - netLongTermGain > 0
 *
 * Parameters:
 *   taxableIncome     — Form 1040 Line 15
 *   qualifiedDividends — Form 1040 Line 3a
 *   netLongTermGain   — Schedule D Line 15 (floor at 0 — losses don't get pref rate)
 *   filingStatus      — session filing status
 *   c                 — Schedule D constants for the tax year
 *   computeOrdinaryTax — callback to compute ordinary bracket tax (avoids circular import)
 *
 * Returns the total tax (Line 16).
 *
 * Exported so it can be unit tested independently of the full engine.
 */
export function computeQDCGTTax(
  taxableIncome:      number,
  qualifiedDividends: number,
  netLongTermGain:    number,
  filingStatus:       string,
  c:                  ScheduleDConstants,
  computeOrdinaryTax: (income: number) => number,
): number {
  if (taxableIncome <= 0) return 0;

  const key = FS_TO_KEY[filingStatus];
  if (!key) throw new Error(`Unknown filing status: ${filingStatus}`);
  const thresholds = c.qdcgt[key];

  // Step 1: Qualified income = qualified dividends + net LTCG, capped at taxable income
  const qualifiedIncome = Math.min(
    Math.max(0, qualifiedDividends) + Math.max(0, netLongTermGain),
    taxableIncome,
  );

  if (qualifiedIncome <= 0) {
    // No preferential income — use ordinary brackets entirely
    return computeOrdinaryTax(taxableIncome);
  }

  // Step 2: Ordinary income = taxable income − qualified income
  const ordinaryIncome = Math.max(0, taxableIncome - qualifiedIncome);

  // Step 3: Tax on ordinary income portion
  const ordinaryTax = computeOrdinaryTax(ordinaryIncome);

  // Step 4: Tax on qualified income portion (tiered 0/15/20%)
  // The rate applied to each dollar of qualified income depends on where
  // ordinary income + that qualified dollar sits relative to the thresholds.

  // "Breakpoint" — how much room is left in the 0% bracket above ordinary income
  const zeroRateRoom   = Math.max(0, thresholds.zeroRateMax - ordinaryIncome);
  const fifteenRateRoom = Math.max(0, thresholds.fifteenRateMax - ordinaryIncome);

  // Portion taxed at 0%
  const atZero   = Math.min(qualifiedIncome, zeroRateRoom);
  // Portion taxed at 15%
  const atFifteen = Math.min(qualifiedIncome - atZero, fifteenRateRoom - zeroRateRoom);
  // Remainder taxed at 20%
  const atTwenty = qualifiedIncome - atZero - atFifteen;

  const qualifiedTax =
    atZero    * 0.00 +
    atFifteen * 0.15 +
    atTwenty  * 0.20;

  const totalTax = ordinaryTax + qualifiedTax;
  return Math.round(totalTax * 100) / 100;
}