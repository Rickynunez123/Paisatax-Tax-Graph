/**
 * FORM 1040 — ADDENDUM
 * Lines 19–38: Credits, Payments, and Refund/Amount Owed
 *
 * This file extends f1040/nodes.ts with the lines that connect
 * Schedule 3 into the return and complete the tax liability flow.
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Line 19 — Child tax credit / ODC (from Schedule 3 Line 6a → Schedule 3 Line 8)
 *   ✅ Line 20 — Schedule 3 Line 8 (total non-refundable credits)
 *   ✅ Line 22 — Total tax minus credits
 *   ✅ Line 25a — W-2 withholding (already in nodes.ts)
 *   ✅ Line 26 — Total withholding (25a + 25b + 25c — 25b/c deferred input)
 *   ✅ Line 27 — EIC (Schedule EIC — deferred input)
 *   ✅ Line 31 — Schedule 3 Line 15 (other payments/refundable credits)
 *   ✅ Line 33 — Total payments
 *   ✅ Line 34 — Refund (if overpaid)
 *   ✅ Line 37 — Amount owed (if underpaid)
 *   🚧 Line 23 — Other taxes (Schedule 2 Part II) — deferred
 *   🚧 Lines 25b, 25c — 1099/other withholding — deferred inputs
 *   🚧 Lines 27b–30 — Other refundable credits — deferred
 *   🚧 Line 32 — Reserved
 *
 * REGISTRATION ORDER:
 *   These nodes must be registered AFTER Schedule 3 nodes.
 *   Combine with F1040_NODES from nodes.ts:
 *
 *   engine.registerNodes([
 *     ...SCHEDULE3_NODES,
 *     ...F1040_NODES,
 *     ...F1040_PAYMENT_NODES,  ← this file
 *   ]);
 *
 * IRS References:
 *   Form 1040 Instructions (2025), Lines 19–38
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import { SCHEDULE3_OUTPUTS } from '../schedule3/nodes';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f1040';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 20 — SCHEDULE 3 NON-REFUNDABLE CREDITS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 20 — Schedule 3 Line 8 (total non-refundable credits)
 *
 * Non-refundable credits reduce tax liability but cannot go below zero.
 * The cap is enforced in Line 22.
 */
const line20_schedule3Credits: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line20_schedule3Credits`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 20 — Schedule 3 Non-Refundable Credits',
  description:        'Total non-refundable credits from Schedule 3 Line 8.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies:       [SCHEDULE3_OUTPUTS.totalNonRefundableCredits],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE3_OUTPUTS.totalNonRefundableCredits)),
  isApplicable: (ctx) => safeNum(ctx.get(SCHEDULE3_OUTPUTS.totalNonRefundableCredits)) > 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 22 — TOTAL TAX MINUS NON-REFUNDABLE CREDITS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 22 — Total tax after non-refundable credits
 *
 * Line 24 (total tax) minus Line 20 (non-refundable credits).
 * Cannot go below zero — non-refundable credits cannot create a refund.
 *
 * Lines 21 is deferred (AMT recapture etc — rare).
 */
const line22_taxAfterCredits: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line22_taxAfterCredits`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 22 — Total Tax After Non-Refundable Credits',
  description:        'Total tax (Line 24) minus non-refundable credits (Line 20). Cannot be negative.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line24_totalTax`,
    `${FORM_ID}.joint.line20_schedule3Credits`,
  ],
  compute: (ctx) => {
    const totalTax = safeNum(ctx.get(`${FORM_ID}.joint.line24_totalTax`));
    const credits  = safeNum(ctx.get(`${FORM_ID}.joint.line20_schedule3Credits`));
    return Math.max(0, totalTax - credits);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 24 REVISED — TOTAL TAX (adds Schedule 2)
// NOTE: line24_totalTax already exists in nodes.ts — no change needed there.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// LINES 25b, 25c — OTHER WITHHOLDING (deferred inputs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 25b — 1099 federal income tax withheld
 * 🚧 DEFERRED — Will be computed from 1099-B, 1099-DIV, 1099-INT etc.
 * when those form slots are implemented.
 */
const line25b_1099Withholding: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line25b_1099Withholding`,
  kind:               NodeKind.INPUT,
  label:              'Form 1040 Line 25b — 1099 Federal Income Tax Withheld',
  description:        'Federal income tax withheld shown on 1099 forms. Deferred — enter manually until 1099 forms are implemented.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['withholding'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.withholding1099',
  defaultValue:       0,
};

/**
 * Line 25c — Other federal income tax withheld
 * 🚧 DEFERRED — Gambling winnings, backup withholding, etc.
 */
const line25c_otherWithholding: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line25c_otherWithholding`,
  kind:               NodeKind.INPUT,
  label:              'Form 1040 Line 25c — Other Federal Income Tax Withheld',
  description:        'Other federal income tax withheld (gambling, backup withholding, etc.).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['withholding'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.otherWithholding',
  defaultValue:       0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 26 — TOTAL WITHHOLDING
// ─────────────────────────────────────────────────────────────────────────────

const line26_totalWithholding: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line26_totalWithholding`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 26 — Total Federal Income Tax Withheld',
  description:        'Sum of withholding from W-2s (Line 25a), 1099s (Line 25b), and other sources (Line 25c).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['withholding'],
  dependencies: [
    `${FORM_ID}.joint.line25a_w2Withholding`,
    `${FORM_ID}.joint.line25b_1099Withholding`,
    `${FORM_ID}.joint.line25c_otherWithholding`,
  ],
  compute: (ctx) => {
    return (
      safeNum(ctx.get(`${FORM_ID}.joint.line25a_w2Withholding`)) +
      safeNum(ctx.get(`${FORM_ID}.joint.line25b_1099Withholding`)) +
      safeNum(ctx.get(`${FORM_ID}.joint.line25c_otherWithholding`))
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 27 — EARNED INCOME CREDIT (deferred input)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 27 — Earned Income Credit (Schedule EIC)
 * 🚧 DEFERRED — Schedule EIC not yet implemented.
 * EIC is one of the most complex credits — requires earned income,
 * qualifying children, investment income limits, etc.
 */
const line27_earnedIncomeCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line27_earnedIncomeCredit`,
  kind:               NodeKind.INPUT,
  label:              'Form 1040 Line 27 — Earned Income Credit (EIC)',
  description:        'Refundable earned income credit from Schedule EIC. Deferred — enter manually if applicable.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.refundable'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.earnedIncomeCredit',
  defaultValue:       0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 31 — SCHEDULE 3 PART II TOTAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 31 — Schedule 3 Line 15 (other payments/refundable credits)
 *
 * Includes extension payments, excess SS withheld, AOC refundable,
 * ACTC, and net premium tax credit.
 */
const line31_schedule3Payments: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line31_schedule3Payments`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 31 — Schedule 3 Other Payments and Credits',
  description:        'Total other payments and refundable credits from Schedule 3 Line 15.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['payment', 'credit.refundable'],
  dependencies:       [SCHEDULE3_OUTPUTS.totalOtherPaymentsAndCredits],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE3_OUTPUTS.totalOtherPaymentsAndCredits)),
  isApplicable: (ctx) => safeNum(ctx.get(SCHEDULE3_OUTPUTS.totalOtherPaymentsAndCredits)) > 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 33 — TOTAL PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 33 — Total Payments
 *
 * Sum of all payments and refundable credits:
 *   Line 26 — Total withholding
 *   Line 27 — EIC
 *   Line 28 — Additional CTC (from Schedule 3 Line 13a — already in Line 31)
 *   Line 29 — AOC refundable (from Schedule 3 Line 13b — already in Line 31)
 *   Line 31 — Schedule 3 total
 *
 * Lines 28 and 29 are included in Schedule 3 Line 15 (Line 31 here),
 * so we do NOT double-count them.
 */
const line33_totalPayments: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line33_totalPayments`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 33 — Total Payments',
  description:        'Sum of all payments and refundable credits: withholding (Line 26), EIC (Line 27), and Schedule 3 (Line 31).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['payment'],
  dependencies: [
    `${FORM_ID}.joint.line26_totalWithholding`,
    `${FORM_ID}.joint.line27_earnedIncomeCredit`,
    `${FORM_ID}.joint.line31_schedule3Payments`,
  ],
  compute: (ctx) => {
    return (
      safeNum(ctx.get(`${FORM_ID}.joint.line26_totalWithholding`)) +
      safeNum(ctx.get(`${FORM_ID}.joint.line27_earnedIncomeCredit`)) +
      safeNum(ctx.get(`${FORM_ID}.joint.line31_schedule3Payments`))
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 34 — REFUND (overpaid)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 34 — Refund
 *
 * If total payments (Line 33) > tax after credits (Line 22),
 * the difference is the refund.
 */
const line34_refund: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line34_refund`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 34 — Refund',
  description:        'Amount overpaid. Line 33 (total payments) minus Line 22 (tax after credits), when positive.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line33_totalPayments`,
    `${FORM_ID}.joint.line22_taxAfterCredits`,
  ],
  compute: (ctx) => {
    const payments = safeNum(ctx.get(`${FORM_ID}.joint.line33_totalPayments`));
    const tax      = safeNum(ctx.get(`${FORM_ID}.joint.line22_taxAfterCredits`));
    return Math.max(0, payments - tax);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 37 — AMOUNT OWED (underpaid)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 37 — Amount You Owe
 *
 * If tax after credits (Line 22) > total payments (Line 33),
 * the difference is owed to the IRS.
 *
 * Note: Underpayment penalties (Form 2210) are not computed here — deferred.
 */
const line37_amountOwed: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line37_amountOwed`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 37 — Amount You Owe',
  description:        'Amount owed to IRS. Line 22 (tax after credits) minus Line 33 (total payments), when positive.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line22_taxAfterCredits`,
    `${FORM_ID}.joint.line33_totalPayments`,
  ],
  compute: (ctx) => {
    const tax      = safeNum(ctx.get(`${FORM_ID}.joint.line22_taxAfterCredits`));
    const payments = safeNum(ctx.get(`${FORM_ID}.joint.line33_totalPayments`));
    return Math.max(0, tax - payments);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const F1040_PAYMENT_NODES: NodeDefinition[] = [
  line20_schedule3Credits,
  line22_taxAfterCredits,
  line25b_1099Withholding,
  line25c_otherWithholding,
  line26_totalWithholding,
  line27_earnedIncomeCredit,
  line31_schedule3Payments,
  line33_totalPayments,
  line34_refund,
  line37_amountOwed,
];

export const F1040_PAYMENT_OUTPUTS = {
  schedule3Credits:  `${FORM_ID}.joint.line20_schedule3Credits`,
  taxAfterCredits:   `${FORM_ID}.joint.line22_taxAfterCredits`,
  totalWithholding:  `${FORM_ID}.joint.line26_totalWithholding`,
  totalPayments:     `${FORM_ID}.joint.line33_totalPayments`,
  refund:            `${FORM_ID}.joint.line34_refund`,
  amountOwed:        `${FORM_ID}.joint.line37_amountOwed`,
} as const;