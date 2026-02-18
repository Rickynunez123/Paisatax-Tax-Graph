/**
 * FORM 1040 -- U.S. INDIVIDUAL INCOME TAX RETURN
 * Constants for tax years 2024 and 2025
 *
 * Sources:
 *   IRS Rev. Proc. 2023-34  -- 2024 inflation adjustments
 *   IRS Rev. Proc. 2024-40  -- 2025 inflation adjustments
 *   IRC Section 1(j)        -- Tax rate tables
 *   IRC Section 63          -- Standard deduction
 *   IRS Publication 501     -- Dependents, standard deduction
 *
 * ALL BRACKET NUMBERS ARE TAKEN VERBATIM FROM THE IRS REVENUE PROCEDURES.
 * Do not round or derive -- use the exact published thresholds and
 * base-tax amounts, which account for the IRS's own rounding rules.
 *
 * BRACKET TABLE STRUCTURE:
 *   Each entry represents one bracket:
 *     floor    -- lowest taxable income in this bracket (inclusive)
 *     baseTax  -- cumulative tax owed at exactly the floor amount
 *     rate     -- marginal rate applied to income ABOVE the floor
 *
 *   Tax = baseTax + rate * (taxableIncome - floor)
 *
 *   Entries are sorted DESCENDING by floor. Lookup iterates from the top
 *   and stops at the first entry where taxableIncome >= floor.
 *
 * FILING STATUS STRINGS (engine convention, snake_case):
 *   'single'
 *   'married_filing_jointly'
 *   'married_filing_separately'
 *   'head_of_household'
 *   'qualifying_surviving_spouse'
 *
 * NOTE: qualifying_surviving_spouse uses the same brackets as MFJ (IRC S.1(a)).
 */

// ---------------------------------------------------------------------------
// BRACKET ENTRY TYPE
// ---------------------------------------------------------------------------

export interface BracketEntry {
  floor:   number
  baseTax: number
  rate:    number
}

// ---------------------------------------------------------------------------
// F1040 CONSTANTS INTERFACE
// ---------------------------------------------------------------------------

export interface F1040Constants {
  taxYear: string

  brackets: {
    single:                    BracketEntry[]
    marriedFilingJointly:      BracketEntry[]
    marriedFilingSeparately:   BracketEntry[]
    headOfHousehold:           BracketEntry[]
    qualifyingSurvivingSpouse: BracketEntry[]
  }

  standardDeduction: {
    single:                       number
    marriedFilingJointly:         number
    marriedFilingSeparately:      number
    headOfHousehold:              number
    qualifyingSurvivingSpouse:    number
  }

  additionalStandardDeduction: {
    single:              number
    marriedOrSurviving:  number
  }

  dependentFilerDeduction: {
    flatMinimum:       number
    earnedIncomeAdder: number
  }
}

// ---------------------------------------------------------------------------
// 2024 BRACKETS  --  Rev. Proc. 2023-34
// ---------------------------------------------------------------------------
//
// Single / Unmarried Individuals (Table 3 equivalent):
//   Not over $11,600:           10% of taxable income
//   $11,601 - $47,150:          $1,160 + 12% over $11,600
//   $47,151 - $100,525:         $5,426 + 22% over $47,150
//   $100,526 - $191,950:       $17,168.50 + 24% over $100,525
//   $191,951 - $243,725:       $40,426 + 32% over $191,950
//   $243,726 - $609,350:       $58,226.75 + 35% over $243,725
//   Over $609,350:            $174,238.25 + 37% over $609,350

const BRACKETS_2024_SINGLE: BracketEntry[] = [
  { floor: 609_350, baseTax: 174_238.25, rate: 0.37 },
  { floor: 243_725, baseTax:  58_226.75, rate: 0.35 },
  { floor: 191_950, baseTax:  40_426.00, rate: 0.32 },
  { floor: 100_525, baseTax:  17_168.50, rate: 0.24 },
  { floor:  47_150, baseTax:   5_426.00, rate: 0.22 },
  { floor:  11_600, baseTax:   1_160.00, rate: 0.12 },
  { floor:       0, baseTax:       0.00, rate: 0.10 },
];

// MFJ and Surviving Spouses (Table 1 equivalent):
//   Not over $23,200:           10% of taxable income
//   $23,201 - $94,300:          $2,320 + 12% over $23,200
//   $94,301 - $201,050:        $10,294 + 22% over $94,300
//   $201,051 - $383,900:       $34,337 + 24% over $201,050
//   $383,901 - $487,450:       $78,070 + 32% over $383,900
//   $487,451 - $731,200:      $111,356 + 35% over $487,450
//   Over $731,200:            $196,669.50 + 37% over $731,200

const BRACKETS_2024_MFJ: BracketEntry[] = [
  { floor: 731_200, baseTax: 196_669.50, rate: 0.37 },
  { floor: 487_450, baseTax: 111_356.00, rate: 0.35 },
  { floor: 383_900, baseTax:  78_070.00, rate: 0.32 },
  { floor: 201_050, baseTax:  34_337.00, rate: 0.24 },
  { floor:  94_300, baseTax:  10_294.00, rate: 0.22 },
  { floor:  23_200, baseTax:   2_320.00, rate: 0.12 },
  { floor:       0, baseTax:       0.00, rate: 0.10 },
];

// Heads of Households (Table 2 equivalent):
//   Not over $16,550:           10% of taxable income
//   $16,551 - $63,100:          $1,655 + 12% over $16,550
//   $63,101 - $100,500:         $7,226 + 22% over $63,100
//   $100,501 - $191,950:       $15,426.50 + 24% over $100,500
//   $191,951 - $243,700:       $37,290.50 + 32% over $191,950
//   $243,701 - $609,350:       $53,842.50 + 35% over $243,700
//   Over $609,350:            $182,050 + 37% over $609,350

const BRACKETS_2024_HOH: BracketEntry[] = [
  { floor: 609_350, baseTax: 182_050.00, rate: 0.37 },
  { floor: 243_700, baseTax:  53_842.50, rate: 0.35 },
  { floor: 191_950, baseTax:  37_290.50, rate: 0.32 },
  { floor: 100_500, baseTax:  15_426.50, rate: 0.24 },
  { floor:  63_100, baseTax:   7_226.00, rate: 0.22 },
  { floor:  16_550, baseTax:   1_655.00, rate: 0.12 },
  { floor:       0, baseTax:       0.00, rate: 0.10 },
];

// MFS: same as Single through $243,725, then 37% starts at $365,600 (half of MFJ)
//   Not over $11,600:           10% of taxable income
//   $11,601 - $47,150:          $1,160 + 12% over $11,600
//   $47,151 - $100,525:         $5,426 + 22% over $47,150
//   $100,526 - $191,950:       $17,168.50 + 24% over $100,525
//   $191,951 - $243,725:       $40,426 + 32% over $191,950
//   $243,726 - $365,600:       $58,226.75 + 35% over $243,725
//   Over $365,600:             $98,334.75 + 37% over $365,600

const BRACKETS_2024_MFS: BracketEntry[] = [
  { floor: 365_600, baseTax:  98_334.75, rate: 0.37 },
  { floor: 243_725, baseTax:  58_226.75, rate: 0.35 },
  { floor: 191_950, baseTax:  40_426.00, rate: 0.32 },
  { floor: 100_525, baseTax:  17_168.50, rate: 0.24 },
  { floor:  47_150, baseTax:   5_426.00, rate: 0.22 },
  { floor:  11_600, baseTax:   1_160.00, rate: 0.12 },
  { floor:       0, baseTax:       0.00, rate: 0.10 },
];

// ---------------------------------------------------------------------------
// 2025 BRACKETS  --  Rev. Proc. 2024-40  (verbatim)
// ---------------------------------------------------------------------------
//
// TABLE 3 -- Unmarried Individuals (Single):
//   Not over $11,925:          10% of taxable income
//   $11,925 - $48,475:         $1,192.50 + 12% over $11,925
//   $48,475 - $103,350:        $5,578.50 + 22% over $48,475
//   $103,350 - $197,300:      $17,651 + 24% over $103,350
//   $197,300 - $250,525:      $40,199 + 32% over $197,300
//   $250,525 - $626,350:      $57,231 + 35% over $250,525
//   Over $626,350:           $188,769.75 + 37% over $626,350

const BRACKETS_2025_SINGLE: BracketEntry[] = [
  { floor: 626_350, baseTax: 188_769.75, rate: 0.37 },
  { floor: 250_525, baseTax:  57_231.00, rate: 0.35 },
  { floor: 197_300, baseTax:  40_199.00, rate: 0.32 },
  { floor: 103_350, baseTax:  17_651.00, rate: 0.24 },
  { floor:  48_475, baseTax:   5_578.50, rate: 0.22 },
  { floor:  11_925, baseTax:   1_192.50, rate: 0.12 },
  { floor:       0, baseTax:       0.00, rate: 0.10 },
];

// TABLE 1 -- MFJ and Surviving Spouses:
//   Not over $23,850:          10% of taxable income
//   $23,850 - $96,950:         $2,385 + 12% over $23,850
//   $96,950 - $206,700:       $11,157 + 22% over $96,950
//   $206,700 - $394,600:      $35,302 + 24% over $206,700
//   $394,600 - $501,050:      $80,398 + 32% over $394,600
//   $501,050 - $751,600:     $114,462 + 35% over $501,050
//   Over $751,600:           $202,154.50 + 37% over $751,600

const BRACKETS_2025_MFJ: BracketEntry[] = [
  { floor: 751_600, baseTax: 202_154.50, rate: 0.37 },
  { floor: 501_050, baseTax: 114_462.00, rate: 0.35 },
  { floor: 394_600, baseTax:  80_398.00, rate: 0.32 },
  { floor: 206_700, baseTax:  35_302.00, rate: 0.24 },
  { floor:  96_950, baseTax:  11_157.00, rate: 0.22 },
  { floor:  23_850, baseTax:   2_385.00, rate: 0.12 },
  { floor:       0, baseTax:       0.00, rate: 0.10 },
];

// TABLE 2 -- Heads of Households:
//   Not over $17,000:          10% of taxable income
//   $17,000 - $64,850:         $1,700 + 12% over $17,000
//   $64,850 - $103,350:        $7,442 + 22% over $64,850
//   $103,350 - $197,300:      $15,912 + 24% over $103,350
//   $197,300 - $250,500:      $38,460 + 32% over $197,300
//   $250,500 - $626,350:      $55,484 + 35% over $250,500
//   Over $626,350:           $187,031.50 + 37% over $626,350

const BRACKETS_2025_HOH: BracketEntry[] = [
  { floor: 626_350, baseTax: 187_031.50, rate: 0.37 },
  { floor: 250_500, baseTax:  55_484.00, rate: 0.35 },
  { floor: 197_300, baseTax:  38_460.00, rate: 0.32 },
  { floor: 103_350, baseTax:  15_912.00, rate: 0.24 },
  { floor:  64_850, baseTax:   7_442.00, rate: 0.22 },
  { floor:  17_000, baseTax:   1_700.00, rate: 0.12 },
  { floor:       0, baseTax:       0.00, rate: 0.10 },
];

// TABLE 4 -- MFS:
//   Same as Single through $250,525, then 37% starts at $375,800 (~half of MFJ)
//   Not over $11,925:          10% of taxable income
//   $11,925 - $48,475:         $1,192.50 + 12% over $11,925
//   $48,475 - $103,350:        $5,578.50 + 22% over $48,475
//   $103,350 - $197,300:      $17,651 + 24% over $103,350
//   $197,300 - $250,525:      $40,199 + 32% over $197,300
//   $250,525 - $375,800:      $57,231 + 35% over $250,525
//   Over $375,800:           $101,077.25 + 37% over $375,800

const BRACKETS_2025_MFS: BracketEntry[] = [
  { floor: 375_800, baseTax: 101_077.25, rate: 0.37 },
  { floor: 250_525, baseTax:  57_231.00, rate: 0.35 },
  { floor: 197_300, baseTax:  40_199.00, rate: 0.32 },
  { floor: 103_350, baseTax:  17_651.00, rate: 0.24 },
  { floor:  48_475, baseTax:   5_578.50, rate: 0.22 },
  { floor:  11_925, baseTax:   1_192.50, rate: 0.12 },
  { floor:       0, baseTax:       0.00, rate: 0.10 },
];

// ---------------------------------------------------------------------------
// CONSTANTS OBJECTS
// ---------------------------------------------------------------------------

export const F1040_CONSTANTS_2024: F1040Constants = {
  taxYear: '2024',

  brackets: {
    single:                    BRACKETS_2024_SINGLE,
    marriedFilingJointly:      BRACKETS_2024_MFJ,
    marriedFilingSeparately:   BRACKETS_2024_MFS,
    headOfHousehold:           BRACKETS_2024_HOH,
    qualifyingSurvivingSpouse: BRACKETS_2024_MFJ,
  },

  standardDeduction: {
    single:                    14_600,
    marriedFilingJointly:      29_200,
    marriedFilingSeparately:   14_600,
    headOfHousehold:           21_900,
    qualifyingSurvivingSpouse: 29_200,
  },

  additionalStandardDeduction: {
    single:             1_950,
    marriedOrSurviving: 1_550,
  },

  dependentFilerDeduction: {
    flatMinimum:       1_300,
    earnedIncomeAdder:   450,
  },
};

export const F1040_CONSTANTS_2025: F1040Constants = {
  taxYear: '2025',

  brackets: {
    single:                    BRACKETS_2025_SINGLE,
    marriedFilingJointly:      BRACKETS_2025_MFJ,
    marriedFilingSeparately:   BRACKETS_2025_MFS,
    headOfHousehold:           BRACKETS_2025_HOH,
    qualifyingSurvivingSpouse: BRACKETS_2025_MFJ,
  },

  standardDeduction: {
    single:                    15_000,
    marriedFilingJointly:      30_000,
    marriedFilingSeparately:   15_000,
    headOfHousehold:           22_500,
    qualifyingSurvivingSpouse: 30_000,
  },

  additionalStandardDeduction: {
    single:             2_000,
    marriedOrSurviving: 1_600,
  },

  dependentFilerDeduction: {
    flatMinimum:       1_350,
    earnedIncomeAdder:   450,
  },
};

// ---------------------------------------------------------------------------
// CONSTANTS INDEX
// ---------------------------------------------------------------------------

const CONSTANTS_BY_YEAR: Record<string, F1040Constants> = {
  '2024': F1040_CONSTANTS_2024,
  '2025': F1040_CONSTANTS_2025,
};

export function getF1040Constants(taxYear: string): F1040Constants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Form 1040 constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`
    );
  }
  return c;
}

// ---------------------------------------------------------------------------
// BRACKET LOOKUP HELPERS
// ---------------------------------------------------------------------------

const FILING_STATUS_TO_BRACKET_KEY: Record<string, keyof F1040Constants['brackets']> = {
  'single':                      'single',
  'married_filing_jointly':      'marriedFilingJointly',
  'married_filing_separately':   'marriedFilingSeparately',
  'head_of_household':           'headOfHousehold',
  'qualifying_surviving_spouse': 'qualifyingSurvivingSpouse',
};

const FILING_STATUS_TO_STD_KEY: Record<string, keyof F1040Constants['standardDeduction']> = {
  'single':                      'single',
  'married_filing_jointly':      'marriedFilingJointly',
  'married_filing_separately':   'marriedFilingSeparately',
  'head_of_household':           'headOfHousehold',
  'qualifying_surviving_spouse': 'qualifyingSurvivingSpouse',
};

export function getBrackets(filingStatus: string, c: F1040Constants): BracketEntry[] {
  const key = FILING_STATUS_TO_BRACKET_KEY[filingStatus];
  if (!key) {
    throw new Error(
      `Unknown filing status '${filingStatus}'. ` +
      `Expected one of: ${Object.keys(FILING_STATUS_TO_BRACKET_KEY).join(', ')}.`
    );
  }
  return c.brackets[key];
}

export function getStandardDeduction(filingStatus: string, c: F1040Constants): number {
  const key = FILING_STATUS_TO_STD_KEY[filingStatus];
  if (!key) {
    throw new Error(`Unknown filing status '${filingStatus}'.`);
  }
  return c.standardDeduction[key];
}

/**
 * computeTax -- pure function, no engine dependencies.
 *
 * Given taxable income and constants, returns the regular income tax
 * (Form 1040 Line 16).
 *
 * Algorithm:
 *   1. Iterate entries descending; stop at first where taxableIncome >= floor.
 *   2. tax = entry.baseTax + entry.rate * (taxableIncome - entry.floor)
 *   3. Round to nearest cent.
 *
 * Exported so unit tests can spot-check brackets without a full engine session.
 */
export function computeTax(
  taxableIncome: number,
  filingStatus:  string,
  c:             F1040Constants,
): number {
  if (taxableIncome <= 0) return 0;

  const brackets = getBrackets(filingStatus, c);

  for (const entry of brackets) {
    if (taxableIncome >= entry.floor) {
      const raw = entry.baseTax + entry.rate * (taxableIncome - entry.floor);
      return Math.round(raw * 100) / 100;
    }
  }

  throw new Error(
    `No bracket matched taxableIncome=${taxableIncome}, filingStatus=${filingStatus}`
  );
}