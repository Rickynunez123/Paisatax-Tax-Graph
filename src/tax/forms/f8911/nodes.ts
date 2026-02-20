/**
 * FORM 8911 — ALTERNATIVE FUEL VEHICLE REFUELING PROPERTY CREDIT (§30C)
 *
 * WHAT IT IS:
 *   Credit for installing qualified alternative fuel vehicle refueling or
 *   EV charging equipment. Covers both personal-use (home charger) and
 *   business-use (commercial charging stations) property.
 *
 * OBBBA UPDATE:
 *   Originally extended through December 31, 2032 by the IRA.
 *   OBBBA (signed July 4, 2025) changed termination to June 30, 2026.
 *   Property PLACED IN SERVICE through June 30, 2026 still qualifies.
 *   2025 returns: fully available for qualifying property installed in 2025.
 *
 * CREDIT RATES (2025, for property placed in service after Jan 1, 2023):
 *
 *   Personal Use (home EV charger):
 *     Rate:    30% of cost
 *     Max:     $1,000 per item
 *     Must be at taxpayer's main home
 *     Must be in an "eligible census tract" (IRS-designated low-income or
 *     rural census tract) — see IRS Notice 2024-20 and updated lists
 *     → Flows to Schedule 3 Line 6j (personal use nonrefundable credit)
 *
 *   Business/Investment Use:
 *     Rate:    6% (or 30% if prevailing wage/apprenticeship met)
 *     Max:     $100,000 per single item (per charging port/dispenser/storage)
 *     → Flows to Form 3800 (General Business Credit) — DEFERRED
 *
 * ELIGIBLE CENSUS TRACT REQUIREMENT (effective Jan 1, 2023):
 *   Property placed in service after 2022 must be in an "eligible census tract"
 *   (a low-income community or rural area per §45D(e)). IRS publishes lists.
 *   Preparer must verify the property address qualifies.
 *
 * QUALIFIED ALTERNATIVE FUELS:
 *   - Electricity (EV charging)
 *   - Fuel ≥ 85% by volume: ethanol, natural gas, CNG, LNG, LPG, hydrogen
 *   - Hydrogen
 *   - Biodiesel, diesel-natural gas blends
 *
 * IMPLEMENTATION APPROACH:
 *   The personal-use credit computation involves per-item cost × 30%, capped
 *   at $1,000/item, with census tract verification (preparer step).
 *   We model the NET result after all Schedule A calculations — preparer enters
 *   the final allowed personal-use credit amount. Business-use is deferred.
 *
 * IRS References:
 *   Form 8911 Instructions (Rev. Dec 2025) — IRS.gov/instructions/i8911
 *   Schedule A (Form 8911) — IRS.gov/pub/irs-pdf/f8911sa.pdf
 *   Notice 2024-20 — Eligible census tracts guidance
 *   IRC §30C — Alternative Fuel Vehicle Refueling Property Credit
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f8911';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT — Preparer-computed personal use credit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Personal Use Part of Credit — from Form 8911 Line 19 (rev Dec 2025).
 *
 * The preparer completes Schedule A (Form 8911) for each qualifying property,
 * verifies eligible census tract, and computes:
 *   credit per item = min(cost × 30%, $1,000)
 *
 * The preparer enters the total personal-use credit here after:
 *   1. Confirming each item is at the taxpayer's main home
 *   2. Confirming eligible census tract for items placed in service after 2022
 *   3. Applying the $1,000 per-item cap
 *   4. Applying the tax liability limit (Form 8911 computes this internally)
 *
 * Note: This node captures the credit AFTER the Form 8911 internal tax limit
 * worksheet. The credit is then further subject to Schedule 3 nonrefundable limits.
 */
const personalUseCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.personalUseCredit`,
  kind:               NodeKind.INPUT,
  label:              'Form 8911 — §30C Personal Use Alt Fuel Refueling Credit',
  description:        'Credit for qualified alternative fuel vehicle refueling or EV charging property at taxpayer\'s main home. Rate: 30% of cost, capped at $1,000 per item. Must be in an eligible census tract (IRS Notice 2024-20). Credit available for property placed in service through June 30, 2026 (OBBBA). Preparer enters final credit from Form 8911 Line 19 after all eligibility checks.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  source:             InputSource.PREPARER,
  questionId:         'f8911.q.personalUseCredit',
  defaultValue:       0,
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED — Pass-through to Schedule 3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 19 total → Schedule 3 Line 6j
 *
 * Schedule 3 uses Line 6j for alternative fuel vehicle refueling credit
 * (personal use portion). We pass through the preparer-entered value.
 */
const credit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.credit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8911 — §30C Credit Total (→ Schedule 3 Line 6j)',
  description:        'Personal-use alternative fuel vehicle refueling property credit. Flows to Schedule 3 Line 6j.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies: [`${FORM_ID}.joint.personalUseCredit`],
  compute: (ctx) => safeNum(ctx.get(`${FORM_ID}.joint.personalUseCredit`)),
  isApplicable: (ctx) => safeNum(ctx.get(`${FORM_ID}.joint.personalUseCredit`)) > 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const F8911_NODES: NodeDefinition[] = [
  personalUseCredit,
  credit,
];

export const F8911_OUTPUTS = {
  /** §30C personal use credit → Schedule 3 Line 6j */
  credit: `${FORM_ID}.joint.credit`,
} as const;