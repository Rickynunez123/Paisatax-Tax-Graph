import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
} from '../../../core/graph/node.types';



const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f1040';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}


// ─────────────────────────────────────────────────────────────────────────────
// EARNED INCOME (COMPOSITE) — used by F2441, F8812, EIC, and other credits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Earned Income — composite node for credit calculations.
 *
 * This is NOT a printed Form 1040 line. It is a derived quantity that
 * aggregates all truly *earned* income sources for use by:
 *   - Form 2441  (Line 4 — primary filer earned income constraint)
 *   - Form 8812  (Line 18a — ACTC earned income formula)
 *   - Schedule EIC (when implemented)
 *
 * WHY THIS EXISTS (instead of using line9_totalIncome):
 *   line9_totalIncome will eventually include unearned income: interest,
 *   dividends, capital gains, pensions, Social Security, etc. Those sources
 *   must NOT count toward earned income for credit purposes. By creating
 *   this dedicated node now, we ensure that when those lines are added to
 *   line9_totalIncome, the credit calculations remain correct automatically.
 *
 * CURRENT SOURCES (Wave 1):
 *   - line1a_w2Wages          — W-2 Box 1 wages (primary + spouse combined)
 *   - line9input_otherIncome  — manual proxy for non-W-2 earned income
 *                               (SE income, etc.) until Schedule C/F/SE built
 *
 * FUTURE SOURCES (add to dependencies + compute as forms are built):
 *   - f1040.joint.scheduleC_netProfit   — Schedule C net self-employment profit
 *   - f1040.joint.scheduleF_netProfit   — Schedule F net farm profit
 *   - f1040.joint.line1b_householdWages — Household employee wages (W-2)
 *   - f1040.joint.line1c_tipIncome      — Tip income not on W-2
 *
 * NEVER INCLUDE:
 *   - Interest (Lines 2a/2b)
 *   - Dividends (Lines 3a/3b)
 *   - Capital gains (Line 7)
 *   - IRA/pension distributions (Lines 4b/5b)
 *   - Social Security (Line 6b)
 *   - Alimony received
 *   - Rental income
 *
 * IRS References:
 *   IRC §32(c)(2) — definition of earned income for EIC
 *   Form 2441 Instructions — Line 4 (earned income definition)
 *   Schedule 8812 Instructions — Line 18a (earned income definition)
 */
export const earnedIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.earnedIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 — Earned Income (for Credit Calculations)',
  description:        'Composite earned income used by Form 2441, Form 8812, and EIC. Includes W-2 wages and other earned income (SE proxy). Excludes unearned income (interest, dividends, capital gains, pensions). Will expand as Schedule C/F/SE are implemented.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.earned'],
  dependencies: [
    `${FORM_ID}.joint.line1a_w2Wages`,
    `${FORM_ID}.joint.line9input_otherIncome`,
    // Add future earned income sources here as they are implemented:
    // `${FORM_ID}.joint.scheduleC_netProfit`,
    // `${FORM_ID}.joint.scheduleF_netProfit`,
    // `${FORM_ID}.joint.line1b_householdWages`,
  ],
  compute: (ctx) => {
    const w2    = safeNum(ctx.get(`${FORM_ID}.joint.line1a_w2Wages`));
    const other = safeNum(ctx.get(`${FORM_ID}.joint.line9input_otherIncome`));
    // Add future earned income lines here as they are implemented:
    // const schedC = safeNum(ctx.get(`${FORM_ID}.joint.scheduleC_netProfit`));
    return w2 + other;
  },
};