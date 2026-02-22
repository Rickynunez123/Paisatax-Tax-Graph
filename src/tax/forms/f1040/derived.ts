import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
} from '../../../core/graph/node.types';

const APPLICABLE_YEARS = ["2024", "2025"];
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
 * CHANGES FROM PREVIOUS VERSION (Schedule C + SE wave):
 *   - Removed dependency on schedule1.joint.line3_businessIncome (now COMPUTED
 *     from Schedule C, so the data already flows through that node correctly).
 *   - Added SCHEDULE_C_OUTPUTS.jointNetProfit as direct dependency so earnedIncome
 *     updates whenever any Schedule C slot changes — without waiting for the
 *     schedule1 Line 3 intermediate node to recompute.
 *   - SE income is now real Schedule C profit, not a manual proxy.
 *
 * This is NOT a printed Form 1040 line. It is a derived quantity used by:
 *   - Form 2441  (Line 4 — primary filer earned income constraint)
 *   - Form 8812  (Line 18a — ACTC earned income formula)
 *   - Schedule EIC (when implemented)
 *
 * WHY THIS EXISTS (instead of using line9_totalIncome):
 *   line9_totalIncome includes unearned income: interest, dividends, capital
 *   gains, pensions, Social Security, etc. Those sources must NOT count toward
 *   earned income for credit purposes. By keeping this dedicated node, credit
 *   calculations remain correct even as new income sources are added to Line 9.
 *
 * CURRENT SOURCES:
 *   - line1a_w2Wages             — W-2 Box 1 wages (primary + spouse combined)
 *   - scheduleC.joint.totalNetProfit — Schedule C net profit (primary + spouse)
 *     Loss floors at $0 — a Schedule C loss reduces income tax but does NOT
 *     reduce earned income for credit purposes (IRC §32(c)(2)(B)).
 *
 * FUTURE SOURCES (add to dependencies + compute as forms are built):
 *   - scheduleF.joint.totalNetProfit — Schedule F net farm profit
 *   - f1040.joint.line1b_householdWages — Household employee wages
 *   - f1040.joint.line1c_tipIncome — Tip income not on W-2
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
  id: `${FORM_ID}.joint.earnedIncome`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 — Earned Income (for Credit Calculations)",
  description:
    "Composite earned income used by Form 2441, Form 8812, and EIC. W-2 wages plus Schedule C net profit (floored at $0 — losses do not reduce earned income). Excludes unearned income. Expands as Schedule F and other earned sources are added.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.earned"],
  dependencies: [
    `${FORM_ID}.joint.line1a_w2Wages`,
    "scheduleC.joint.totalNetProfit",
    "scheduleF.joint.totalNetProfit", // NEW — farm earned income
    // Future earned income sources:
    // 'scheduleF.joint.totalNetProfit',
    // `${FORM_ID}.joint.line1b_householdWages`,
    // `${FORM_ID}.joint.line1c_tipIncome`,
  ],
  compute: (ctx) => {
    const w2 = safeNum(ctx.get(`${FORM_ID}.joint.line1a_w2Wages`));
    // Floor at 0 — losses reduce income tax but NOT earned income for credit purposes
    const schedCProfit = Math.max(
      0,
      safeNum(ctx.get("scheduleC.joint.totalNetProfit")),
    );
    const schedFProfit = Math.max(
      0,
      safeNum(ctx.get("scheduleF.joint.totalNetProfit")),
    ); // NEW
    return w2 + schedCProfit + schedFProfit;
  },
};