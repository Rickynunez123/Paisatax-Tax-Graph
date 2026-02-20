/**
 * FORM 1040 — ADDENDUM
 * Lines 19–38: Credits, Payments, and Refund/Amount Owed
 *
 * CHANGES FROM PREVIOUS VERSION:
 *   Line 25b — was a deferred INPUT, now COMPUTED from Schedule B
 *   (1099-INT Box 4 + 1099-DIV Box 4 backup withholding totals)
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Line 20 — Schedule 3 non-refundable credits
 *   ✅ Line 22 — Total tax minus credits
 *   ✅ Line 25a — W-2 withholding (in nodes.ts)
 *   ✅ Line 25b — 1099 withholding (now computed from Schedule B)
 *   🚧 Line 25c — Other withholding (deferred input)
 *   ✅ Line 26 — Total withholding (25a + 25b + 25c)
 *   ✅ Line 27 — EIC (deferred input)
 *   ✅ Line 31 — Schedule 3 Line 15 (other payments/refundable credits)
 *   ✅ Line 33 — Total payments
 *   ✅ Line 34 — Refund (if overpaid)
 *   ✅ Line 37 — Amount owed (if underpaid)
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

import { SCHEDULE3_OUTPUTS } from "../schedule3/nodes";
import { SCHEDULE_B_OUTPUTS } from "../schedule-b/nodes";

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f1040';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 20 — SCHEDULE 3 NON-REFUNDABLE CREDITS
// ─────────────────────────────────────────────────────────────────────────────

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
// LINE 22 — TOTAL TAX AFTER NON-REFUNDABLE CREDITS
// ─────────────────────────────────────────────────────────────────────────────

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
// LINE 25b — 1099 WITHHOLDING (now COMPUTED from Schedule B)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 25b — Federal income tax withheld from 1099s.
 *
 * Previously a deferred INPUT. Now COMPUTED from Schedule B which
 * aggregates backup withholding from 1099-INT (Box 4) and 1099-DIV (Box 4).
 *
 * When 1099-B (capital gains) and other 1099s are built, their withholding
 * nodes should be added to Schedule B's joint1099Withholding aggregator
 * (or a separate aggregator), and wired here.
 */
const line25b_1099Withholding: NodeDefinition = {
  id: `${FORM_ID}.joint.line25b_1099Withholding`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 25b — 1099 Federal Income Tax Withheld",
  description:
    "Federal income tax withheld on 1099 forms (interest and dividend backup withholding). From Schedule B aggregator. Will expand as 1099-B and other 1099s are built.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["withholding"],
  dependencies: [SCHEDULE_B_OUTPUTS.withholding1099],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE_B_OUTPUTS.withholding1099)),
  isApplicable: (ctx) =>
    safeNum(ctx.get(SCHEDULE_B_OUTPUTS.withholding1099)) > 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 25c — OTHER WITHHOLDING (deferred input)
// ─────────────────────────────────────────────────────────────────────────────

const line25c_otherWithholding: NodeDefinition = {
  id: `${FORM_ID}.joint.line25c_otherWithholding`,
  kind: NodeKind.INPUT,
  label: "Form 1040 Line 25c — Other Federal Income Tax Withheld",
  description:
    "Other federal income tax withheld (gambling winnings, backup withholding from other sources, etc.).",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["withholding"],
  source: InputSource.PREPARER,
  questionId: "f1040.q.otherWithholding",
  defaultValue: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 26 — TOTAL WITHHOLDING
// ─────────────────────────────────────────────────────────────────────────────

const line26_totalWithholding: NodeDefinition = {
  id: `${FORM_ID}.joint.line26_totalWithholding`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 26 — Total Federal Income Tax Withheld",
  description:
    "Sum of withholding from W-2s (Line 25a), 1099s (Line 25b), and other sources (Line 25c).",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["withholding"],
  dependencies: [
    `${FORM_ID}.joint.line25a_w2Withholding`,
    `${FORM_ID}.joint.line25b_1099Withholding`,
    `${FORM_ID}.joint.line25c_otherWithholding`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line25a_w2Withholding`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line25b_1099Withholding`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line25c_otherWithholding`)),
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 27 — EARNED INCOME CREDIT (deferred input)
// ─────────────────────────────────────────────────────────────────────────────

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

const line33_totalPayments: NodeDefinition = {
  id: `${FORM_ID}.joint.line33_totalPayments`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 33 — Total Payments",
  description:
    "Sum of all payments and refundable credits: withholding (Line 26), EIC (Line 27), and Schedule 3 (Line 31).",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["payment"],
  dependencies: [
    `${FORM_ID}.joint.line26_totalWithholding`,
    `${FORM_ID}.joint.line27_earnedIncomeCredit`,
    `${FORM_ID}.joint.line31_schedule3Payments`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line26_totalWithholding`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line27_earnedIncomeCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line31_schedule3Payments`)),
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 34 — REFUND
// ─────────────────────────────────────────────────────────────────────────────

const line34_refund: NodeDefinition = {
  id: `${FORM_ID}.joint.line34_refund`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 34 — Refund",
  description: "Amount overpaid. Line 33 minus Line 22, when positive.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  dependencies: [
    `${FORM_ID}.joint.line33_totalPayments`,
    `${FORM_ID}.joint.line22_taxAfterCredits`,
  ],
  compute: (ctx) => {
    const payments = safeNum(ctx.get(`${FORM_ID}.joint.line33_totalPayments`));
    const tax = safeNum(ctx.get(`${FORM_ID}.joint.line22_taxAfterCredits`));
    return Math.max(0, payments - tax);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 37 — AMOUNT OWED
// ─────────────────────────────────────────────────────────────────────────────

const line37_amountOwed: NodeDefinition = {
  id: `${FORM_ID}.joint.line37_amountOwed`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 37 — Amount You Owe",
  description: "Amount owed to IRS. Line 22 minus Line 33, when positive.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  dependencies: [
    `${FORM_ID}.joint.line22_taxAfterCredits`,
    `${FORM_ID}.joint.line33_totalPayments`,
  ],
  compute: (ctx) => {
    const tax = safeNum(ctx.get(`${FORM_ID}.joint.line22_taxAfterCredits`));
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
  schedule3Credits: `${FORM_ID}.joint.line20_schedule3Credits`,
  taxAfterCredits: `${FORM_ID}.joint.line22_taxAfterCredits`,
  withholding1099: `${FORM_ID}.joint.line25b_1099Withholding`,
  totalWithholding: `${FORM_ID}.joint.line26_totalWithholding`,
  totalPayments: `${FORM_ID}.joint.line33_totalPayments`,
  refund: `${FORM_ID}.joint.line34_refund`,
  amountOwed: `${FORM_ID}.joint.line37_amountOwed`,
} as const;