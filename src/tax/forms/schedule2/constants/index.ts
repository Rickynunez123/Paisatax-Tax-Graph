/**
 * SCHEDULE 2 — ADDITIONAL TAXES
 * Constants for tax years 2024 and 2025
 *
 * Sources:
 *   IRS Schedule 2 Instructions (2024, 2025)
 *   Form 1040 Instructions
 *
 * Note on constants:
 *   Schedule 2 is a pure aggregator — it collects penalty and tax amounts
 *   from other forms and sums them. It has no rate calculations of its own.
 *   The "constants" here are metadata about which lines exist and which
 *   source forms feed them, so the node definitions can reference them.
 *
 *   Unlike Form 8889 or Form 5329, Schedule 2 lines rarely change year to year
 *   because they just point to other forms. When a new tax or penalty is added
 *   by Congress, a new line appears on Schedule 2 and a new source form is added.
 */

export interface Schedule2Constants {
  taxYear: string

  /**
   * Part I — Additional Taxes
   * These are the lines that aggregate penalty amounts from other forms.
   * Listed here so we can document the source for each line.
   */
  partI: {
    /**
     * Line 2 — Excess advance premium tax credit repayment (Form 8962)
     * 🚧 UNSUPPORTED — requires ACA marketplace coverage data
     */
    line2_source: 'f8962'

    /**
     * Line 8 — Additional tax on retirement plans (Form 5329)
     * ✅ IMPLEMENTED — reads from Form 5329 Parts I and VII
     */
    line8_source: 'f5329'

    /**
     * Line 17b — Additional tax on HSA distributions (Form 8889)
     * ✅ IMPLEMENTED — reads from Form 8889 Line 17b
     */
    line17b_source: 'f8889'

    /**
     * Line 44 — Total additional taxes (sum of Part I)
     * ✅ IMPLEMENTED — sum of all active Part I lines
     */
    line44_isTotal: true
  }

  /**
   * Part II — Other Taxes
   * 🚧 UNSUPPORTED — deferred (SE tax, NIIT, household employment, etc.)
   * These require significant additional form support.
   */
  partII: {
    deferredUntilFutureRelease: true
  }
}

export const SCHEDULE2_CONSTANTS_2024: Schedule2Constants = {
  taxYear: '2024',
  partI: {
    line2_source:   'f8962',
    line8_source:   'f5329',
    line17b_source: 'f8889',
    line44_isTotal: true,
  },
  partII: {
    deferredUntilFutureRelease: true,
  },
};

export const SCHEDULE2_CONSTANTS_2025: Schedule2Constants = {
  ...SCHEDULE2_CONSTANTS_2024,
  taxYear: '2025',
};

const CONSTANTS_BY_YEAR: Record<string, Schedule2Constants> = {
  '2024': SCHEDULE2_CONSTANTS_2024,
  '2025': SCHEDULE2_CONSTANTS_2025,
};

export function getSchedule2Constants(taxYear: string): Schedule2Constants {
  const constants = CONSTANTS_BY_YEAR[taxYear];
  if (!constants) {
    throw new Error(
      `Schedule 2 constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`
    );
  }
  return constants;
}