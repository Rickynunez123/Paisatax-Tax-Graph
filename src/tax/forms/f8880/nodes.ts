/**
 * FORM 8880 — CREDIT FOR QUALIFIED RETIREMENT SAVINGS CONTRIBUTIONS
 * (Saver's Credit)
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Line 1 — Primary filer qualifying contributions (input)
 *   ✅ Line 2 — Primary filer distributions received (input)
 *   ✅ Line 3 — Primary filer qualifying amount (Line 1 capped at $2,000 - Line 2)
 *   ✅ Line 1b — Spouse qualifying contributions (input, MFJ only)
 *   ✅ Line 2b — Spouse distributions received (input, MFJ only)
 *   ✅ Line 3b — Spouse qualifying amount (input capped at $2,000 - spouse distributions)
 *   ✅ Line 4  — Total qualifying contributions (primary + spouse)
 *   ✅ Line 5  — AGI (from Form 1040 Line 11)
 *   ✅ Line 6  — Credit rate (AGI table lookup by filing status)
 *   ✅ Line 7  — Tentative credit (Line 4 × Line 6)
 *   ✅ Line 8  — Tax liability limit (Form 1040 total tax)
 *   ✅ Line 9  — Saver's Credit (min of Line 7 and Line 8) → Schedule 3 Line 4
 *   🚧 Specific contribution type breakdown (401k vs IRA vs SIMPLE etc.) — deferred
 *      The IRS form separates contributions by type on Lines 1a–1f, but the
 *      credit calculation uses only the total. We accept a combined total.
 *
 * KEY DESIGN DECISIONS:
 *   1. Contributions and distributions are INPUTS — they come from W-2 Box 12
 *      (elective deferrals), 1099-R (distributions), and preparer interview.
 *      We do not auto-compute from W-2 because Box 12 codes need interpretation
 *      and not all contributions appear on W-2 (IRA contributions are not on W-2).
 *
 *   2. Distributions are entered separately per filer to match the IRS form.
 *      The distribution lookback spans 2025, 2024, and Jan 1–Apr 15, 2026 for
 *      prior-year IRA distributions. The preparer sums these and enters the total.
 *
 *   3. Spouse nodes use JOINT owner (not PRIMARY/repeatable) because the
 *      Saver's Credit aggregation is inherently a joint calculation and
 *      the spouse amount here is a named input on a specific IRS form line.
 *
 *   4. The credit is NONREFUNDABLE — cannot reduce tax below zero.
 *      This cap is enforced by line8 / line9.
 *
 *   5. Line 4 wires to Schedule 3 Line 4 once this form is registered.
 *      Schedule 3 currently has line4_retirementSavingsCredit as a deferred INPUT.
 *      Replace that INPUT with a COMPUTED node depending on F8880_OUTPUTS.credit.
 *
 * ELIGIBILITY REQUIREMENTS (not enforced by nodes — preparer responsibility):
 *   - Must be 18 or older
 *   - Cannot be a full-time student
 *   - Cannot be claimed as a dependent on another return
 *
 * REGISTRATION ORDER:
 *   engine.registerNodes([
 *     ...F1040_NODES,       ← AGI and totalTax must exist
 *     ...F8880_NODES,       ← reads from F1040
 *     ...SCHEDULE3_NODES,   ← Schedule 3 Line 4 reads F8880_OUTPUTS.credit
 *     ...F1040_PAYMENT_NODES,
 *   ]);
 *
 * IRS References:
 *   Form 8880 Instructions (2025)
 *   IRC Section 25B
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import {
  getF8880Constants,
  getSaversCreditRate,
  computeQualifyingContribution,
} from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f8880';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 1 — PRIMARY FILER CONTRIBUTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 1 — Primary filer's qualifying retirement contributions.
 *
 * Includes: Traditional IRA, Roth IRA, 401(k), 403(b), governmental 457(b),
 * SARSEP, SIMPLE IRA, voluntary after-tax qualified plan contributions.
 *
 * Does NOT include: rollover contributions, employer matches, SEP contributions
 * made BY the employer (only employee elective deferrals qualify).
 *
 * The engine caps this at $2,000 in Line 3. Enter the actual amount here.
 */
const line1_primaryContributions: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line1_primaryContributions`,
  kind:               NodeKind.INPUT,
  label:              'Form 8880 Line 1 — Primary Filer Qualifying Retirement Contributions',
  description:        'Total qualifying retirement contributions made by the primary filer in 2025. Includes IRA, Roth IRA, 401(k), 403(b), 457(b), SIMPLE IRA, and voluntary after-tax plan contributions. Do NOT include rollover contributions or employer matches. Engine caps at $2,000 automatically.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['contribution.retirement'],
  source:             InputSource.PREPARER,
  questionId:         'f8880.q.primaryContributions',
  defaultValue:       0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 2 — PRIMARY FILER DISTRIBUTIONS (lookback period)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 2 — Primary filer's distributions from retirement accounts.
 *
 * Distributions received in the lookback period reduce the qualifying
 * contribution amount dollar-for-dollar (enforced in Line 3).
 *
 * Lookback period covers:
 *   - All of 2025 (current year)
 *   - All of 2024 (prior year)
 *   - January 1 through April 15, 2026 (for IRA distributions that
 *     reduce a prior-year IRA contribution)
 *
 * The preparer enters the sum of all distributions in this window.
 * Source: Form 1099-R for each distribution.
 */
const line2_primaryDistributions: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line2_primaryDistributions`,
  kind:               NodeKind.INPUT,
  label:              'Form 8880 Line 2 — Primary Filer Retirement Distributions (Lookback Period)',
  description:        'Distributions received by the primary filer from retirement accounts during the lookback period: all of 2024, all of 2025, and Jan 1–Apr 15 2026. These reduce qualifying contributions dollar-for-dollar. Enter total from all Form 1099-R distributions in this window.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['distribution.retirement'],
  source:             InputSource.PREPARER,
  questionId:         'f8880.q.primaryDistributions',
  defaultValue:       0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 3 — PRIMARY FILER QUALIFYING AMOUNT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 3 — Primary filer qualifying contribution after cap and distribution offset.
 *
 * = max(0, min(Line 1, $2,000) - Line 2)
 *
 * The $2,000 cap ensures no single filer can generate more than $1,000 of
 * credit (at the 50% rate). The distribution reduction prevents gaming.
 */
const line3_primaryQualifyingAmount: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line3_primaryQualifyingAmount`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8880 Line 3 — Primary Filer Qualifying Contribution Amount',
  description:        'Primary filer contributions capped at $2,000, minus distributions received in the lookback period. This is the net qualifying amount for the credit.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line1_primaryContributions`,
    `${FORM_ID}.joint.line2_primaryDistributions`,
  ],
  compute: (ctx) => {
    const c             = getF8880Constants(ctx.taxYear);
    const contributions = safeNum(ctx.get(`${FORM_ID}.joint.line1_primaryContributions`));
    const distributions = safeNum(ctx.get(`${FORM_ID}.joint.line2_primaryDistributions`));
    return computeQualifyingContribution(contributions, distributions, c);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINES 1b, 2b, 3b — SPOUSE (MFJ ONLY)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 1b — Spouse qualifying retirement contributions (MFJ only).
 *
 * Same qualifying contribution types as Line 1.
 * Only relevant for married_filing_jointly returns.
 * Defaults to 0 for single/HoH/MFS returns.
 */
const line1b_spouseContributions: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line1b_spouseContributions`,
  kind:               NodeKind.INPUT,
  label:              'Form 8880 Line 1b — Spouse Qualifying Retirement Contributions (MFJ)',
  description:        'Qualifying retirement contributions made by the spouse in 2025 (MFJ returns only). Same qualifying types as primary filer Line 1. Enter 0 for non-MFJ returns.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['contribution.retirement'],
  source:             InputSource.PREPARER,
  questionId:         'f8880.q.spouseContributions',
  defaultValue:       0,
};

/**
 * Line 2b — Spouse distributions from retirement accounts (MFJ only).
 *
 * Same lookback period as Line 2 (all of 2024, all of 2025, Jan 1–Apr 15, 2026).
 */
const line2b_spouseDistributions: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line2b_spouseDistributions`,
  kind:               NodeKind.INPUT,
  label:              'Form 8880 Line 2b — Spouse Retirement Distributions Lookback (MFJ)',
  description:        'Distributions received by the spouse from retirement accounts during the lookback period (MFJ returns only). Same period as Line 2. Enter 0 for non-MFJ returns.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['distribution.retirement'],
  source:             InputSource.PREPARER,
  questionId:         'f8880.q.spouseDistributions',
  defaultValue:       0,
};

/**
 * Line 3b — Spouse qualifying contribution amount (MFJ only).
 *
 * = max(0, min(Line 1b, $2,000) - Line 2b)
 *
 * For non-MFJ returns: both inputs default to 0, so this is 0 as well.
 * No special filing status guard needed — the math produces 0 correctly.
 */
const line3b_spouseQualifyingAmount: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line3b_spouseQualifyingAmount`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8880 Line 3b — Spouse Qualifying Contribution Amount (MFJ)',
  description:        'Spouse contributions capped at $2,000, minus spouse distributions in the lookback period. Zero for non-MFJ returns.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line1b_spouseContributions`,
    `${FORM_ID}.joint.line2b_spouseDistributions`,
  ],
  compute: (ctx) => {
    const c             = getF8880Constants(ctx.taxYear);
    const contributions = safeNum(ctx.get(`${FORM_ID}.joint.line1b_spouseContributions`));
    const distributions = safeNum(ctx.get(`${FORM_ID}.joint.line2b_spouseDistributions`));
    return computeQualifyingContribution(contributions, distributions, c);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 4 — TOTAL QUALIFYING CONTRIBUTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 4 — Total qualifying contributions (primary + spouse).
 *
 * For single/HoH/MFS: equals Line 3 only (spouse lines are 0).
 * For MFJ: sum of both qualifying amounts, max potential $4,000.
 */
const line4_totalQualifyingContributions: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line4_totalQualifyingContributions`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8880 Line 4 — Total Qualifying Contributions',
  description:        'Sum of primary (Line 3) and spouse (Line 3b) qualifying contribution amounts. For non-MFJ returns equals Line 3 only. Maximum $2,000 per person; $4,000 for MFJ.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line3_primaryQualifyingAmount`,
    `${FORM_ID}.joint.line3b_spouseQualifyingAmount`,
  ],
  compute: (ctx) => {
    return safeNum(ctx.get(`${FORM_ID}.joint.line3_primaryQualifyingAmount`)) +
           safeNum(ctx.get(`${FORM_ID}.joint.line3b_spouseQualifyingAmount`));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 5 — AGI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 5 — AGI from Form 1040 Line 11.
 *
 * The AGI drives the credit rate lookup. Higher AGI = lower rate.
 * The credit phases to 0% before most filers become ineligible for EIC.
 */
const line5_agi: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line5_agi`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8880 Line 5 — Adjusted Gross Income',
  description:        'AGI from Form 1040 Line 11. Determines the Saver\'s Credit rate (50%, 20%, 10%, or 0%).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       ['f1040.joint.line11_adjustedGrossIncome'],
  compute: (ctx) => safeNum(ctx.get('f1040.joint.line11_adjustedGrossIncome')),
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 6 — CREDIT RATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 6 — Credit rate from AGI table lookup.
 *
 * Rates: 50%, 20%, 10%, or 0%
 * Determined by AGI and filing status using the 2025 threshold tiers.
 * See constants/index.ts for the full table.
 *
 * A rate of 0 means no credit is available — AGI too high.
 */
const line6_creditRate: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line6_creditRate`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8880 Line 6 — Credit Rate (50%, 20%, 10%, or 0%)',
  description:        'Saver\'s Credit rate from AGI table lookup. 50% for lowest income, phasing down to 20%, 10%, and 0% as AGI rises. Thresholds vary by filing status.',
  valueType:          NodeValueType.PERCENTAGE,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.line5_agi`],
  compute: (ctx) => {
    const c   = getF8880Constants(ctx.taxYear);
    const agi = safeNum(ctx.get(`${FORM_ID}.joint.line5_agi`));
    return getSaversCreditRate(agi, ctx.filingStatus, c);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 7 — TENTATIVE CREDIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 7 — Tentative Saver's Credit before tax liability cap.
 *
 * = Line 4 (total qualifying contributions) × Line 6 (credit rate)
 *
 * Maximum possible: $4,000 × 50% = $2,000 (MFJ, lowest AGI tier)
 * Rounded to nearest cent per IRS rounding convention.
 */
const line7_tentativeCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line7_tentativeCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8880 Line 7 — Tentative Saver\'s Credit',
  description:        'Total qualifying contributions (Line 4) multiplied by credit rate (Line 6). This is the credit before the tax liability cap. Maximum $2,000 for MFJ at 50% rate.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line4_totalQualifyingContributions`,
    `${FORM_ID}.joint.line6_creditRate`,
  ],
  compute: (ctx) => {
    const contributions = safeNum(ctx.get(`${FORM_ID}.joint.line4_totalQualifyingContributions`));
    const rate          = safeNum(ctx.get(`${FORM_ID}.joint.line6_creditRate`));
    return Math.round(contributions * rate * 100) / 100;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 8 — TAX LIABILITY LIMIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 8 — Tax liability limit.
 *
 * The Saver's Credit is nonrefundable — it cannot exceed tax liability.
 * We approximate with F1040 total tax (Line 24), consistent with the
 * approach used in F8812 Line 13 and F2441 Line 10.
 *
 * The full Credit Limit Worksheet interaction (subtracting other
 * nonrefundable credits that have already been applied) is deferred.
 * For most filers, this approximation is exact.
 */
const line8_taxLiabilityLimit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line8_taxLiabilityLimit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8880 Line 8 — Tax Liability Limit',
  description:        'Maximum nonrefundable Saver\'s Credit allowed. Cannot exceed tax liability (Form 1040 Line 24). Credit cannot create a refund.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       ['f1040.joint.line24_totalTax'],
  compute: (ctx) => Math.max(0, safeNum(ctx.get('f1040.joint.line24_totalTax'))),
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 9 — SAVER'S CREDIT (FINAL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 9 — Saver's Credit (final, nonrefundable).
 *
 * = min(Line 7 tentative credit, Line 8 tax liability limit)
 *
 * → Flows to Schedule 3 Line 4 → Form 1040 Line 20 (via Schedule 3 Line 8)
 *
 * isApplicable: skipped when credit rate is 0 (AGI too high) or when
 * total qualifying contributions are 0 (nothing contributed).
 */
const line9_saversCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line9_saversCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8880 Line 9 — Saver\'s Credit',
  description:        'Final nonrefundable Saver\'s Credit. Lesser of tentative credit (Line 7) and tax liability (Line 8). Flows to Schedule 3 Line 4.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.line7_tentativeCredit`,
    `${FORM_ID}.joint.line8_taxLiabilityLimit`,
  ],
  compute: (ctx) => {
    const tentative = safeNum(ctx.get(`${FORM_ID}.joint.line7_tentativeCredit`));
    const taxLimit  = safeNum(ctx.get(`${FORM_ID}.joint.line8_taxLiabilityLimit`));
    return Math.min(tentative, taxLimit);
  },
  isApplicable: (ctx) => {
    const rate          = safeNum(ctx.get(`${FORM_ID}.joint.line6_creditRate`));
    const contributions = safeNum(ctx.get(`${FORM_ID}.joint.line4_totalQualifyingContributions`));
    return rate > 0 && contributions > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Form 8880 node definitions.
 *
 * WIRING Schedule 3 Line 4:
 *   schedule3/nodes.ts currently has line4_retirementSavingsCredit as a
 *   deferred INPUT node. Once F8880_NODES is registered, replace it with:
 *
 *   const line4_retirementSavingsCredit: NodeDefinition = {
 *     id:           'schedule3.joint.line4_retirementSavingsCredit',
 *     kind:         NodeKind.COMPUTED,
 *     ...
 *     dependencies: [F8880_OUTPUTS.credit],
 *     compute: (ctx) => safeNum(ctx.get(F8880_OUTPUTS.credit)),
 *     isApplicable: (ctx) => safeNum(ctx.get(F8880_OUTPUTS.credit)) > 0,
 *   };
 */
export const F8880_NODES: NodeDefinition[] = [
  // Primary filer
  line1_primaryContributions,
  line2_primaryDistributions,
  line3_primaryQualifyingAmount,
  // Spouse (MFJ)
  line1b_spouseContributions,
  line2b_spouseDistributions,
  line3b_spouseQualifyingAmount,
  // Combined
  line4_totalQualifyingContributions,
  line5_agi,
  line6_creditRate,
  line7_tentativeCredit,
  line8_taxLiabilityLimit,
  line9_saversCredit,
];

export const F8880_OUTPUTS = {
  /** Final Saver's Credit → Schedule 3 Line 4 */
  credit: `${FORM_ID}.joint.line9_saversCredit`,
} as const;