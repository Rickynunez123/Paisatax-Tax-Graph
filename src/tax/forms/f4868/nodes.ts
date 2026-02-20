/**
 * FORM 4868 — APPLICATION FOR AUTOMATIC EXTENSION OF TIME TO FILE
 *
 * WHAT IT IS:
 *   Form 4868 grants an automatic 6-month extension to file (NOT to pay).
 *   The extension moves the filing deadline from April 15 to October 15, 2026.
 *   However, any tax owed is still due by April 15, 2026.
 *
 * TAX ENGINE RELEVANCE:
 *   The only computation-relevant field is Line 6 — the amount paid with the
 *   extension request. This amount flows to Schedule 3 Line 10 as a payment
 *   that reduces the final amount owed (or increases the refund).
 *
 * FORM LINES:
 *   Line 4 — Estimate of total tax liability for 2025
 *   Line 5 — Total 2025 payments (withholding + estimated tax)
 *   Line 6 — Balance due (Line 4 - Line 5); amount paid with this form
 *
 *   Only Line 6 flows into the tax graph. Lines 4 and 5 are estimations
 *   the preparer makes; the actual amounts come from the completed return.
 *
 * IMPORTANT NOTES:
 *   - Extension does NOT extend the time to pay — interest and penalties
 *     accrue from the original April 15 due date on any unpaid tax.
 *   - If the preparer paid $0 with the extension (filing only, no payment),
 *     this node is 0 and has no effect.
 *   - Many taxpayers file extensions just to get time, paying nothing upfront
 *     (especially when expecting a refund).
 *
 * IRS References:
 *   Form 4868 Instructions (2025)
 *   Schedule 3 Line 10 = amount paid with Form 4868
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f4868';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT — Amount Paid with Extension
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 6 — Amount paid with extension request.
 * Most taxpayers enter $0 here if expecting a refund.
 * Taxpayers with estimated amounts due may pay some or all of the balance.
 */
const line6_amountPaid: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line6_amountPaid`,
  kind:               NodeKind.INPUT,
  label:              'Form 4868 Line 6 — Amount Paid with Extension Request',
  description:        'Amount paid when filing Form 4868 extension. This reduces the final balance due or increases the refund. Enter $0 if no payment was made with the extension.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['payment'],
  source:             InputSource.PREPARER,
  questionId:         'f4868.q.amountPaid',
  defaultValue:       0,
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED — Pass-through to Schedule 3 Line 10
// ─────────────────────────────────────────────────────────────────────────────

const amountPaid: NodeDefinition = {
  id:                 `${FORM_ID}.joint.amountPaid`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 4868 — Extension Payment (→ Schedule 3 Line 10)',
  description:        'Amount paid with the extension request. Flows to Schedule 3 Line 10.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['payment'],
  dependencies:       [`${FORM_ID}.joint.line6_amountPaid`],
  compute: (ctx) => safeNum(ctx.get(`${FORM_ID}.joint.line6_amountPaid`)),
  isApplicable: (ctx) => safeNum(ctx.get(`${FORM_ID}.joint.line6_amountPaid`)) > 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const F4868_NODES: NodeDefinition[] = [
  line6_amountPaid,
  amountPaid,
];

export const F4868_OUTPUTS = {
  /** Amount paid with extension → Schedule 3 Line 10 */
  amountPaid: `${FORM_ID}.joint.amountPaid`,
} as const;