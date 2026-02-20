/**
 * FORM 8936 — CLEAN VEHICLE CREDITS
 *
 * THREE CREDIT TYPES (all expired for vehicles acquired after Sept 30, 2025):
 *
 *   §30D — New Clean Vehicle Credit
 *     Maximum:      $7,500 (base credit, not all vehicles qualify for full amount)
 *     Eligibility:  Vehicle acquired AND placed in service on or before Sept 30, 2025
 *     MAGI limits:  MFJ/QSS $300,000 | HoH $225,000 | Others $150,000
 *                   Use LOWER of 2024 or 2025 MAGI
 *     Vehicle cap:  MSRP ≤ $80,000 (vans/SUVs/pickups) or $55,000 (other)
 *     Partially refundable via "point-of-sale transfer" (dealer transfer) — but
 *     for tax return purposes, the personal-use portion is nonrefundable
 *     → Flows to Schedule 3 Line 6e
 *
 *   §25E — Previously Owned Clean Vehicle Credit
 *     Maximum:      min($4,000, 30% of sale price)
 *     Eligibility:  Vehicle acquired from licensed dealer on or before Sept 30, 2025
 *     Vehicle must be ≤ $25,000 purchase price
 *     Can only claim once every 3 years
 *     MAGI limits:  MFJ/QSS $150,000 | HoH $112,500 | Others $75,000
 *     → Flows to Schedule 3 Line 6e (combined with §30D)
 *
 *   §45W — Qualified Commercial Clean Vehicle Credit
 *     Business-only credit; flows through Form 3800, not Schedule 3 directly
 *     Max: min(basis×30% or 15%, $7,500 for <14k lb GVWR or $40,000 for ≥14k lb)
 *     → Deferred — not modeled here (business taxpayers, flows via F3800)
 *
 * IMPLEMENTATION APPROACH:
 *   Form 8936 Schedule A (per-vehicle) is complex with FEOC sourcing rules and
 *   credit transfer mechanics. We model the net result: preparer inputs the final
 *   allowed credit from Schedule A after completing eligibility checks.
 *
 *   This is consistent with how deferred forms work — preparer certifies amount,
 *   engine wires it to Schedule 3.
 *
 * OBBBA NOTE:
 *   Clean Vehicle Credit (§30D) and Used Clean Vehicle Credit (§25E) both
 *   terminated for vehicles acquired after September 30, 2025.
 *   A 2025 tax return may still include these credits for vehicles acquired
 *   January 1 – September 30, 2025 and placed in service in 2025.
 *
 * IRS References:
 *   Form 8936 Instructions (2025) — IRS.gov/instructions/i8936
 *   Schedule A (Form 8936) — IRS.gov/pub/irs-pdf/f8936sa.pdf
 *   IRC §30D (New Clean Vehicle), §25E (Previously Owned), §45W (Commercial)
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f8936';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * §30D New Clean Vehicle Credit — preparer-computed from Schedule A(s).
 *
 * The preparer completes Schedule A (Form 8936) for each new vehicle,
 * verifies FEOC sourcing requirements, MSRP cap, and MAGI limit, and enters
 * the final allowed personal-use credit amount here.
 *
 * Note: If the taxpayer transferred the credit to the dealer at point of sale,
 * the preparer still enters the credit amount here to reconcile it. The dealer
 * received the credit; this node tracks what flows through the tax return.
 */
const newCleanVehicleCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.newCleanVehicleCredit`,
  kind:               NodeKind.INPUT,
  label:              'Form 8936 — §30D New Clean Vehicle Credit',
  description:        'Credit for new qualifying clean vehicles (EV, fuel cell) acquired and placed in service on or before September 30, 2025. Maximum $7,500 per vehicle. Preparer enters the final allowed personal-use credit from Schedule A (Form 8936) after verifying MSRP cap, MAGI limits, and FEOC sourcing requirements. For vehicles acquired after September 30, 2025, enter 0.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  source:             InputSource.PREPARER,
  questionId:         'f8936.q.newCleanVehicleCredit',
  defaultValue:       0,
};

/**
 * §25E Previously Owned Clean Vehicle Credit — preparer-computed.
 *
 * Credit = min($4,000, 30% of purchase price).
 * Vehicle must cost ≤ $25,000, purchased from licensed dealer.
 * Can only be claimed once every 3 years per taxpayer.
 * Acquired on or before September 30, 2025.
 */
const usedCleanVehicleCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.usedCleanVehicleCredit`,
  kind:               NodeKind.INPUT,
  label:              'Form 8936 — §25E Previously Owned Clean Vehicle Credit',
  description:        'Credit for qualifying used clean vehicle (EV/FCV) purchased from a licensed dealer for ≤ $25,000, acquired on or before September 30, 2025. Credit = min($4,000, 30% of purchase price). Can only be claimed once every 3 years. Preparer enters the allowed credit after verifying MAGI limits (MFJ $150k | HoH $112.5k | Others $75k) and eligibility.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  source:             InputSource.PREPARER,
  questionId:         'f8936.q.usedCleanVehicleCredit',
  defaultValue:       0,
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED — Combined Credit → Schedule 3 Line 6e
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 15 — Total F8936 personal-use clean vehicle credit.
 * New (§30D) + Used (§25E) combined.
 * → Schedule 3 Line 6e
 *
 * Both are nonrefundable. The tax liability limit is enforced by Schedule 3
 * and Form 1040 — not here.
 */
const totalCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.totalCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8936 — Total Clean Vehicle Credit (→ Schedule 3 Line 6e)',
  description:        'Combined personal-use clean vehicle credit (§30D new + §25E used). Flows to Schedule 3 Line 6e as a nonrefundable credit.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.newCleanVehicleCredit`,
    `${FORM_ID}.joint.usedCleanVehicleCredit`,
  ],
  compute: (ctx) => {
    return safeNum(ctx.get(`${FORM_ID}.joint.newCleanVehicleCredit`)) +
           safeNum(ctx.get(`${FORM_ID}.joint.usedCleanVehicleCredit`));
  },
  isApplicable: (ctx) => {
    return safeNum(ctx.get(`${FORM_ID}.joint.newCleanVehicleCredit`)) +
           safeNum(ctx.get(`${FORM_ID}.joint.usedCleanVehicleCredit`)) > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const F8936_NODES: NodeDefinition[] = [
  newCleanVehicleCredit,
  usedCleanVehicleCredit,
  totalCredit,
];

export const F8936_OUTPUTS = {
  /** Combined clean vehicle credit → Schedule 3 Line 6e */
  credit: `${FORM_ID}.joint.totalCredit`,
} as const;