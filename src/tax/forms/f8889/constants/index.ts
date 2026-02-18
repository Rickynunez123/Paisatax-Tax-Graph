/**
 * FORM 8889 — CONSTANTS INDEX
 *
 * Single import point for all tax years.
 * Compute functions call getF8889Constants(taxYear) to get
 * the right constants for the session's tax year.
 *
 * To add a new year:
 *   1. Create constants/{year}.ts following the same shape
 *   2. Import it here and add it to the CONSTANTS_BY_YEAR map
 *   3. That's it — existing node definitions pick it up automatically
 */
import type { F8889Constants } from './2024';
import { F8889_CONSTANTS_2024 } from './2024';
import { F8889_CONSTANTS_2025 }                 from './2025';

/**
 * Map of all available tax years to their constants.
 * Add new years here as they become available.
 */
const CONSTANTS_BY_YEAR: Record<string, F8889Constants> = {
  '2024': F8889_CONSTANTS_2024,
  '2025': F8889_CONSTANTS_2025,
};

/**
 * Retrieve HSA constants for a given tax year.
 * Throws if the year is not supported — fail loudly so the caller
 * knows immediately rather than computing with wrong values.
 *
 * @param taxYear  Four-digit year string, e.g. '2025'
 */
export function getF8889Constants(taxYear: string): F8889Constants {
  const constants = CONSTANTS_BY_YEAR[taxYear];
  if (!constants) {
    throw new Error(
      `Form 8889 constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`
    );
  }
  return constants;
}

export type { F8889Constants };
export { F8889_CONSTANTS_2024, F8889_CONSTANTS_2025 };