/**
 * FORM 3800 — GENERAL BUSINESS CREDIT
 *
 * WHAT IT IS:
 *   Form 3800 is an aggregator that combines various business-related credits
 *   into a single allowed amount subject to overall tax liability limits.
 *   Individual business credits feed into Form 3800's Part III, and the
 *   resulting allowed credit flows to Schedule 3 Line 6d.
 *
 * INDIVIDUAL CREDITS THAT FLOW THROUGH FORM 3800 (examples):
 *   §45W  Qualified Commercial Clean Vehicle Credit
 *   §30C  Alternative Fuel Refueling Property (business use portion)
 *   §45   Renewable Energy Production Credit
 *   §47   Rehabilitation Tax Credit
 *   §45B  Employer Social Security and Medicare Taxes Credit
 *   §45S  Employer Credit for Paid Family and Medical Leave
 *   §45D  New Markets Tax Credit
 *   etc. (50+ individual credits flow through Form 3800)
 *
 * IMPLEMENTATION STATUS:
 *   Form 3800 is deferred — none of the individual business credits are
 *   implemented yet. This stub provides:
 *   1. An INPUT node for the preparer to enter the total allowed credit
 *      from a manually completed Form 3800
 *   2. The F3800_OUTPUTS constant that Schedule 3 can reference
 *
 *   When individual business credits are implemented (e.g., employer
 *   family leave credit, rehabilitation credit), they will wire into
 *   this form and the input will become a COMPUTED aggregator.
 *
 * CARRY RULES:
 *   Unused general business credits can carry back 1 year and forward 20 years.
 *   The credit is subject to the tentative minimum tax limitation.
 *
 * IRS References:
 *   Form 3800 Instructions (2025)
 *   IRC §38, §39 — General Business Credit
 *   Schedule 3 Line 6d = Form 3800 Line 38
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f3800';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

/**
 * Total General Business Credit — preparer-entered from Form 3800 Line 38.
 *
 * 🚧 DEFERRED — individual business credits not yet implemented.
 * Enter the total allowed general business credit from the completed Form 3800.
 * When individual credit forms are implemented, this will become a COMPUTED
 * node that aggregates their outputs.
 */
const totalCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.totalCredit`,
  kind:               NodeKind.INPUT,
  label:              'Form 3800 Line 38 — Total General Business Credit (→ Schedule 3 Line 6d)',
  description:        'Total allowed general business credit from Form 3800 Part III aggregation. Deferred — enter manually from completed Form 3800 Line 38 if applicable. Credits that flow through Form 3800 include commercial clean vehicle (§45W), rehabilitation (§47), paid family leave (§45S), and 50+ others.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  source:             InputSource.PREPARER,
  questionId:         'f3800.q.totalCredit',
  defaultValue:       0,
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const F3800_NODES: NodeDefinition[] = [
  totalCredit,
];

export const F3800_OUTPUTS = {
  /** Total general business credit → Schedule 3 Line 6d */
  totalCredit: `${FORM_ID}.joint.totalCredit`,
} as const;