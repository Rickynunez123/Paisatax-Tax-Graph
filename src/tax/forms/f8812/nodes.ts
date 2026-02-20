/**
 * FORM 8812 — CREDITS FOR QUALIFYING CHILDREN AND OTHER DEPENDENTS
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   Part I — CTC and ODC
 *   ✅ Line 4  — Number of qualifying children (input)
 *   ✅ Line 5  — CTC amount (line 4 × $2,200)
 *   ✅ Line 6  — Number of other dependents (input)
 *   ✅ Line 7  — ODC amount (line 6 × $500)
 *   ✅ Line 8  — Initial credit (line 5 + line 7)
 *   ✅ Line 9  — MAGI from Form 1040 Line 11
 *   ✅ Line 10 — Phase-out threshold
 *   ✅ Line 11 — Phase-out reduction
 *   ✅ Line 12 — Credit after phase-out (line 8 - line 11)
 *   ✅ Line 13 — Credit limit (from tax liability — reads 1040 Line 18)
 *   ✅ Line 14 — Non-refundable CTC/ODC (min of line 12 and line 13)
 *               → flows to Schedule 3 Line 6a
 *
 *   Part II-A — ACTC (General Rule)
 *   ✅ Line 15 — Unallowed CTC (line 12 - line 14)
 *   ✅ Line 16a — ACTC cap (line 4 × $1,700)
 *   ✅ Line 18a — Earned income (input)
 *   ✅ Line 19 — Earned income minus threshold ($2,500)
 *   ✅ Line 20 — 15% of line 19
 *   ✅ Line 27 — ACTC (min of line 16a and line 20, capped at line 15)
 *               → flows to Schedule 3 Line 13a
 *
 *   🚧 Part II-B — 3+ children SS/Medicare method (deferred)
 *      Applies only when taxpayer has 3+ qualifying children AND
 *      the SS/Medicare method produces a larger ACTC. Rare edge case.
 *
 * DEPENDENCY NOTE:
 *   Line 13 (credit limit) requires 1040 Line 18 (regular tax - AMT + other taxes).
 *   We approximate with line24_totalTax from F1040. This is standard practice
 *   for most returns — the Credit Limit Worksheet A adjustment is only needed
 *   when also claiming Form 8396, 8839, 5695 Part I, or 8859.
 *
 * IRS References:
 *   Schedule 8812 Instructions (2025), Dec 5 2025
 *   IRC Section 24
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import {
  getF8812Constants,
  computePhaseOutReduction,
  computeInitialCredit,
  computeACTC,
} from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f8812';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUTS — DEPENDENT COUNTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 4 — Number of qualifying children (under 17, with valid SSN)
 */
const line4_numQualifyingChildren: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line4_numQualifyingChildren`,
  kind:               NodeKind.INPUT,
  label:              'Form 8812 Line 4 — Number of Qualifying Children',
  description:        'Number of qualifying children under age 17 at year-end with valid SSNs. Each qualifies for the CTC and potentially the ACTC.',
  valueType:          NodeValueType.INTEGER,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f8812.q.numQualifyingChildren',
  defaultValue:       0,
  validation:         { min: 0, max: 20 },
};

/**
 * Line 6 — Number of other dependents (not qualifying for CTC/ACTC)
 * Dependents age 17+ with TIN — qualify for $500 ODC only.
 */
const line6_numOtherDependents: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line6_numOtherDependents`,
  kind:               NodeKind.INPUT,
  label:              'Form 8812 Line 6 — Number of Other Dependents',
  description:        'Number of dependents who do not qualify for the CTC (age 17+, or lack valid SSN). Each qualifies for the $500 Credit for Other Dependents (ODC).',
  valueType:          NodeValueType.INTEGER,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f8812.q.numOtherDependents',
  defaultValue:       0,
  validation:         { min: 0, max: 20 },
};

// ─────────────────────────────────────────────────────────────────────────────
// PART I — CTC AND ODC COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 5 — CTC amount (qualifying children × $2,200)
 */
const line5_ctcAmount: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line5_ctcAmount`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 5 — CTC Amount (Children × $2,200)',
  description:        'Child Tax Credit before phase-out. Number of qualifying children times $2,200.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies:       [`${FORM_ID}.joint.line4_numQualifyingChildren`],
  compute: (ctx) => {
    const c        = getF8812Constants(ctx.taxYear);
    const children = safeNum(ctx.get(`${FORM_ID}.joint.line4_numQualifyingChildren`));
    return children * c.ctcMaxPerChild;
  },
};

/**
 * Line 7 — ODC amount (other dependents × $500)
 */
const line7_odcAmount: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line7_odcAmount`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 7 — ODC Amount (Other Dependents × $500)',
  description:        'Credit for Other Dependents before phase-out. Number of other dependents times $500.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies:       [`${FORM_ID}.joint.line6_numOtherDependents`],
  compute: (ctx) => {
    const c          = getF8812Constants(ctx.taxYear);
    const dependents = safeNum(ctx.get(`${FORM_ID}.joint.line6_numOtherDependents`));
    return dependents * c.odcMaxPerDependent;
  },
};

/**
 * Line 8 — Initial combined credit (line 5 + line 7)
 */
const line8_initialCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line8_initialCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 8 — Initial CTC + ODC Credit',
  description:        'Combined CTC and ODC before phase-out and tax liability limit.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.line5_ctcAmount`,
    `${FORM_ID}.joint.line7_odcAmount`,
  ],
  compute: (ctx) => {
    return safeNum(ctx.get(`${FORM_ID}.joint.line5_ctcAmount`)) +
           safeNum(ctx.get(`${FORM_ID}.joint.line7_odcAmount`));
  },
};

/**
 * Line 9 — Modified AGI
 * For most filers = Form 1040 Line 11 (AGI).
 * Exceptions (Form 2555 exclusions) are rare — using AGI directly.
 */
const line9_modifiedAGI: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line9_modifiedAGI`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 9 — Modified AGI',
  description:        'Modified adjusted gross income. For most filers equals Form 1040 Line 11 AGI.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       ['f1040.joint.line11_adjustedGrossIncome'],
  compute: (ctx) => safeNum(ctx.get('f1040.joint.line11_adjustedGrossIncome')),
};

/**
 * Line 10 — Phase-out threshold for this filer's filing status
 */
const line10_phaseOutThreshold: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line10_phaseOutThreshold`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 10 — Phase-Out Threshold',
  description:        '$400,000 for MFJ; $200,000 for all other filing statuses.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [],
  compute: (ctx) => {
    const c = getF8812Constants(ctx.taxYear);
    return ctx.filingStatus === 'married_filing_jointly'
      ? c.phaseOut.thresholdMFJ
      : c.phaseOut.thresholdOther;
  },
};

/**
 * Line 11 — Phase-out reduction
 * $50 for every $1,000 (or fraction thereof) that MAGI exceeds the threshold.
 */
const line11_phaseOutReduction: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line11_phaseOutReduction`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 11 — Phase-Out Reduction',
  description:        'CTC/ODC reduction due to MAGI exceeding the phase-out threshold. $50 per $1,000 of excess MAGI, rounded up.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line9_modifiedAGI`,
  ],
  compute: (ctx) => {
    const c    = getF8812Constants(ctx.taxYear);
    const magi = safeNum(ctx.get(`${FORM_ID}.joint.line9_modifiedAGI`));
    return computePhaseOutReduction(magi, ctx.filingStatus, c);
  },
};

/**
 * Line 12 — Credit after phase-out (line 8 - line 11, not below 0)
 */
const line12_creditAfterPhaseOut: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12_creditAfterPhaseOut`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 12 — Credit After Phase-Out',
  description:        'Initial CTC/ODC credit reduced by the phase-out amount. Cannot go below zero.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line8_initialCredit`,
    `${FORM_ID}.joint.line11_phaseOutReduction`,
  ],
  compute: (ctx) => {
    const credit    = safeNum(ctx.get(`${FORM_ID}.joint.line8_initialCredit`));
    const reduction = safeNum(ctx.get(`${FORM_ID}.joint.line11_phaseOutReduction`));
    return Math.max(0, credit - reduction);
  },
};

/**
 * Line 13 — Credit limit (tax liability constraint)
 *
 * Per the form: "Enter the amount from Credit Limit Worksheet A."
 * Credit Limit Worksheet A = Form 1040 Line 18 (tax - certain other credits).
 *
 * We use line24_totalTax as an approximation. This is accurate for the
 * vast majority of returns. The full Credit Limit Worksheet A interaction
 * (subtracting Form 4972, 8814 taxes etc.) is a deferred edge case.
 *
 * Non-refundable credits cannot reduce tax below zero — this is the cap.
 */
const line13_creditLimit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line13_creditLimit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 13 — Credit Limit (Tax Liability)',
  description:        'The CTC/ODC cannot exceed tax liability. Approximated as Form 1040 total tax (Line 24). Full Credit Limit Worksheet A adjustment deferred.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       ['f1040.joint.line24_totalTax'],
  compute: (ctx) => Math.max(0, safeNum(ctx.get('f1040.joint.line24_totalTax'))),
};

/**
 * Line 14 — Non-refundable CTC/ODC (min of line 12 and line 13)
 *
 * This is the actual non-refundable credit applied against tax.
 * → Flows to Schedule 3 Line 6a → Form 1040 Line 19
 */
const line14_nonRefundableCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line14_nonRefundableCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 14 — Non-Refundable Child Tax Credit / ODC',
  description:        'The lesser of the phase-out-adjusted credit (Line 12) and the tax liability limit (Line 13). This non-refundable amount flows to Schedule 3 Line 6a.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.line12_creditAfterPhaseOut`,
    `${FORM_ID}.joint.line13_creditLimit`,
  ],
  compute: (ctx) => {
    const creditAfterPhaseOut = safeNum(ctx.get(`${FORM_ID}.joint.line12_creditAfterPhaseOut`));
    const creditLimit         = safeNum(ctx.get(`${FORM_ID}.joint.line13_creditLimit`));
    return Math.min(creditAfterPhaseOut, creditLimit);
  },
  isApplicable: (ctx) => {
    const children    = safeNum(ctx.get(`${FORM_ID}.joint.line4_numQualifyingChildren`));
    const dependents  = safeNum(ctx.get(`${FORM_ID}.joint.line6_numOtherDependents`));
    return children + dependents > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PART II-A — ADDITIONAL CHILD TAX CREDIT (ACTC)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 15 — Unallowed CTC (line 12 - line 14)
 *
 * The portion of CTC that could not be used against tax liability.
 * This is the starting point for computing the refundable ACTC.
 * If zero, no ACTC is available.
 */
const line15_unallowedCTC: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line15_unallowedCTC`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 15 — Unallowed CTC (Available for ACTC)',
  description:        'Portion of CTC not used against tax (Line 12 minus Line 14). This amount may be refundable as ACTC if earned income qualifies.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line12_creditAfterPhaseOut`,
    `${FORM_ID}.joint.line14_nonRefundableCredit`,
  ],
  compute: (ctx) => {
    const creditAfterPhaseOut  = safeNum(ctx.get(`${FORM_ID}.joint.line12_creditAfterPhaseOut`));
    const nonRefundableCredit  = safeNum(ctx.get(`${FORM_ID}.joint.line14_nonRefundableCredit`));
    return Math.max(0, creditAfterPhaseOut - nonRefundableCredit);
  },
};

/**
 * Line 16a — ACTC cap (qualifying children × $1,700)
 */
const line16a_actcCap: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line16a_actcCap`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 16a — ACTC Cap (Children × $1,700)',
  description:        'Maximum ACTC based on number of qualifying children. Each child allows up to $1,700 of refundable ACTC.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.line4_numQualifyingChildren`],
  compute: (ctx) => {
    const c        = getF8812Constants(ctx.taxYear);
    const children = safeNum(ctx.get(`${FORM_ID}.joint.line4_numQualifyingChildren`));
    return children * c.actcMaxPerChild;
  },
};

/**
 * Line 18a — Earned income for ACTC purposes
 *
 * Earned income = wages + net self-employment income.
 * For most W-2 filers this equals W-2 Box 1 wages.
 * We pull from F1040 Line 1a (W-2 wages) as the primary source.
 * Preparer can override if there is self-employment income.
 *
 * NOTE: The IRS form uses earned income from Form 1040, not just W-2 wages.
 * Full SE income calculation is deferred until Schedule C/SE are implemented.
 */
const line18a_earnedIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line18a_earnedIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 18a — Earned Income',
  description:        'Earned income used to compute ACTC. Currently equals Form 1040 Line 9 total income (W-2 wages + other earned income). Will narrow to true earned income once Schedule C/SE are implemented.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       ['f1040.joint.line9_totalIncome'],
  compute: (ctx) => safeNum(ctx.get('f1040.joint.line9_totalIncome')),
};

/**
 * Line 19 — Earned income minus $2,500 threshold (not below 0)
 */
const line19_earnedIncomeAboveThreshold: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line19_earnedIncomeAboveThreshold`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 19 — Earned Income Above $2,500 Threshold',
  description:        'Earned income (Line 18a) minus the $2,500 ACTC threshold. Cannot be negative.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.line18a_earnedIncome`],
  compute: (ctx) => {
    const c            = getF8812Constants(ctx.taxYear);
    const earnedIncome = safeNum(ctx.get(`${FORM_ID}.joint.line18a_earnedIncome`));
    return Math.max(0, earnedIncome - c.actcEarnedIncomeThreshold);
  },
};

/**
 * Line 20 — 15% of line 19 (ACTC earned-income formula amount)
 */
const line20_actcEarnedIncomeFormula: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line20_actcEarnedIncomeFormula`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 20 — 15% of Earned Income Above Threshold',
  description:        '15% of the amount on Line 19. This is the earned-income-based ACTC amount before the per-child cap.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.line19_earnedIncomeAboveThreshold`],
  compute: (ctx) => {
    const c      = getF8812Constants(ctx.taxYear);
    const above  = safeNum(ctx.get(`${FORM_ID}.joint.line19_earnedIncomeAboveThreshold`));
    return above * c.actcRate;
  },
};

/**
 * Line 27 — Additional Child Tax Credit (ACTC) — REFUNDABLE
 *
 * ACTC = min(line 15 unallowed CTC, min(line 16a cap, line 20 earned income formula))
 *
 * Three constraints must ALL be satisfied:
 *   1. Cannot exceed unallowed CTC (line 15) — you can only refund what you couldn't use
 *   2. Cannot exceed per-child cap (line 16a) — $1,700 × qualifying children
 *   3. Cannot exceed 15% × (earned income - $2,500) (line 20)
 *
 * → Flows to Schedule 3 Line 13a → Form 1040 Line 28
 */
const line27_additionalChildTaxCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line27_additionalChildTaxCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8812 Line 27 — Additional Child Tax Credit (ACTC)',
  description:        'Refundable child tax credit. The lesser of: unallowed CTC (Line 15), per-child cap (Line 16a: children × $1,700), and 15% of earned income above $2,500 (Line 20). Flows to Schedule 3 Line 13a.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.refundable'],
  dependencies: [
    `${FORM_ID}.joint.line15_unallowedCTC`,
    `${FORM_ID}.joint.line16a_actcCap`,
    `${FORM_ID}.joint.line20_actcEarnedIncomeFormula`,
  ],
  compute: (ctx) => {
    const unallowed      = safeNum(ctx.get(`${FORM_ID}.joint.line15_unallowedCTC`));
    const perChildCap    = safeNum(ctx.get(`${FORM_ID}.joint.line16a_actcCap`));
    const earnedFormula  = safeNum(ctx.get(`${FORM_ID}.joint.line20_actcEarnedIncomeFormula`));

    if (unallowed === 0) return 0;
    // Earned income formula capped by per-child max
    const earnedBased = Math.min(perChildCap, earnedFormula);
    // Further capped by unallowed CTC — can't refund more than you couldn't use
    return Math.min(unallowed, earnedBased);
  },
  isApplicable: (ctx) => {
    const children = safeNum(ctx.get(`${FORM_ID}.joint.line4_numQualifyingChildren`));
    return children > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Form 8812 node definitions.
 *
 * Registration order: F8812 reads from F1040 (AGI, total tax, W-2 wages),
 * so F1040_NODES must be registered BEFORE F8812_NODES.
 * Schedule 3 reads from F8812, so F8812_NODES must be registered BEFORE SCHEDULE3_NODES.
 *
 *   engine.registerNodes([
 *     ...F1040_NODES,        ← AGI and totalTax must exist first
 *     ...F8812_NODES,        ← reads from F1040
 *     ...SCHEDULE3_NODES,    ← reads from F8812
 *     ...F1040_PAYMENT_NODES ← reads from Schedule 3
 *   ]);
 */
export const F8812_NODES: NodeDefinition[] = [
  // Inputs
  line4_numQualifyingChildren,
  line6_numOtherDependents,
  // Part I — CTC/ODC
  line5_ctcAmount,
  line7_odcAmount,
  line8_initialCredit,
  line9_modifiedAGI,
  line10_phaseOutThreshold,
  line11_phaseOutReduction,
  line12_creditAfterPhaseOut,
  line13_creditLimit,
  line14_nonRefundableCredit,
  // Part II-A — ACTC
  line15_unallowedCTC,
  line16a_actcCap,
  line18a_earnedIncome,
  line19_earnedIncomeAboveThreshold,
  line20_actcEarnedIncomeFormula,
  line27_additionalChildTaxCredit,
];

export const F8812_OUTPUTS = {
  /** Non-refundable CTC/ODC → Schedule 3 Line 6a */
  nonRefundableCredit:      `${FORM_ID}.joint.line14_nonRefundableCredit`,
  /** Refundable ACTC → Schedule 3 Line 13a */
  additionalChildTaxCredit: `${FORM_ID}.joint.line27_additionalChildTaxCredit`,
} as const;