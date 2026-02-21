/**
 * FORM 1099-NEC — NONEMPLOYEE COMPENSATION
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Box 1 — Nonemployee compensation → informs Schedule C Line 1
 *   ✅ Box 4 — Federal income tax withheld (backup withholding) → F1040 Line 25b
 *   🚧 Box 5 — State income tax withheld (state returns — deferred)
 *   🚧 Box 6 — State/payer's state number (informational — deferred)
 *   🚧 Box 7 — State income (informational — deferred)
 *
 * SLOT PATTERN:
 *   Each payer (client, platform, company) is one slot.
 *   Slot ID format: f1099nec.{owner}.s{index}.{field}
 *   Owner: PRIMARY or SPOUSE — whoever performed the work.
 *
 * HOW 1099-NEC CONNECTS TO SCHEDULE C:
 *   The 1099-NEC total is NOT wired directly to Schedule C Line 1.
 *   Reason: a filer may have multiple 1099-NECs from different clients
 *   PLUS unreported cash income that the IRS never sees on a 1099.
 *   Schedule C Line 1 (gross receipts) must include ALL income,
 *   including amounts under $600 for which no 1099-NEC was issued.
 *
 *   Instead:
 *     1. OCR extracts 1099-NEC Box 1 amounts into slots (this file).
 *     2. Aggregators sum them into f1099nec.primary.totalNEC.
 *     3. The UI warns the preparer if Schedule C gross receipts
 *        fall below the 1099-NEC total (unreported income risk).
 *     4. Schedule C Line 1 is an independent input the preparer sets.
 *
 * BACKUP WITHHOLDING:
 *   Box 4 (federal withholding) adds to the same Line 25b aggregator
 *   as 1099-INT and 1099-DIV backup withholding.
 *
 * IRS References:
 *   Form 1099-NEC Instructions (2025)
 *   IRC §6041A — return requirement for nonemployee compensation
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f1099nec';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateF1099NECSlotNodes(
  owner:     NodeOwner,
  slotIndex: number,
): NodeDefinition[] {
  const ownerStr = owner === NodeOwner.PRIMARY ? 'primary' : 'spouse';
  const slotId   = `${FORM_ID}.${ownerStr}.s${slotIndex}`;

  return [
    // ── Payer identification ────────────────────────────────────────────────

    {
      id:                 `${slotId}.payerName`,
      kind:               NodeKind.INPUT,
      label:              `Form 1099-NEC Slot ${slotIndex} — Payer Name`,
      description:        'Name of the business or individual that paid the nonemployee compensation.',
      valueType:          NodeValueType.STRING,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-NEC', box: 'payerName' },
      questionId:         'f1099nec.q.payerName',
      defaultValue:       '',
    },

    {
      id:                 `${slotId}.payerEIN`,
      kind:               NodeKind.INPUT,
      label:              `Form 1099-NEC Slot ${slotIndex} — Payer EIN`,
      description:        'Employer Identification Number of the payer.',
      valueType:          NodeValueType.STRING,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-NEC', box: 'payerEIN' },
      questionId:         'f1099nec.q.payerEIN',
      defaultValue:       '',
    },

    // ── Box 1 — Nonemployee compensation ────────────────────────────────────

    {
      id:                 `${slotId}.box1_nonemployeeCompensation`,
      kind:               NodeKind.INPUT,
      label:              `Form 1099-NEC Slot ${slotIndex} — Box 1: Nonemployee Compensation`,
      description:        'Total nonemployee compensation paid by this payer. This amount is self-employment income and flows to Schedule C Line 1 (gross receipts). The filer must report ALL income on Schedule C — even amounts not on a 1099-NEC.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.selfEmployment'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-NEC', box: '1', fieldName: 'nonemployeeCompensation' },
      questionId:         'f1099nec.q.box1_nonemployeeCompensation',
      defaultValue:       0,
    },

    // ── Box 4 — Federal income tax withheld (backup withholding) ────────────

    {
      id:                 `${slotId}.box4_federalWithholding`,
      kind:               NodeKind.INPUT,
      label:              `Form 1099-NEC Slot ${slotIndex} — Box 4: Federal Income Tax Withheld`,
      description:        'Federal income tax withheld (backup withholding). Uncommon — most self-employed workers do not have withholding on 1099-NEC income. Flows to Form 1040 Line 25b.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['withholding'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-NEC', box: '4', fieldName: 'federalWithholding' },
      questionId:         'f1099nec.q.box4_federalWithholding',
      defaultValue:       0,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATOR GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates four aggregator nodes:
 *   f1099nec.primary.totalNEC        — sum of Box 1 for all primary slots
 *   f1099nec.primary.totalWithholding — sum of Box 4 for all primary slots
 *   f1099nec.spouse.totalNEC
 *   f1099nec.spouse.totalWithholding
 *
 * The totalNEC nodes are informational — used for UI validation warning
 * when Schedule C gross receipts < total 1099-NEC amounts.
 *
 * The totalWithholding nodes feed Form 1040 Line 25b via payments.ts.
 */
export function generateF1099NECAggregators(
  primarySlots: number[],
  spouseSlots:  number[],
): NodeDefinition[] {
  const nodes: NodeDefinition[] = [];

  for (const [ownerStr, slots] of [
    ['primary', primarySlots],
    ['spouse',  spouseSlots],
  ] as const) {
    const owner = ownerStr === 'primary' ? NodeOwner.PRIMARY : NodeOwner.SPOUSE;

    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.totalNEC`,
      kind:               NodeKind.COMPUTED,
      label:              `Form 1099-NEC (${ownerStr}) — Total Nonemployee Compensation`,
      description:        `Sum of Box 1 across all ${ownerStr} 1099-NEC slots. Informational — used to validate Schedule C gross receipts cover all reported amounts.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.selfEmployment'],
      dependencies:       slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.box1_nonemployeeCompensation`),
      compute: (ctx) => slots.reduce((sum, i) =>
        sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.box1_nonemployeeCompensation`)), 0),
    });

    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.totalWithholding`,
      kind:               NodeKind.COMPUTED,
      label:              `Form 1099-NEC (${ownerStr}) — Total Federal Withholding`,
      description:        `Sum of Box 4 backup withholding across all ${ownerStr} 1099-NEC slots. Flows to Form 1040 Line 25b.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['withholding'],
      dependencies:       slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.box4_federalWithholding`),
      compute: (ctx) => slots.reduce((sum, i) =>
        sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.box4_federalWithholding`)), 0),
    });
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL AGGREGATORS (no slots — zero-sum base state)
// ─────────────────────────────────────────────────────────────────────────────

export const F1099NEC_INITIAL_AGGREGATORS: NodeDefinition[] =
  generateF1099NECAggregators([], []);

export const F1099NEC_OUTPUTS = {
  primaryTotalNEC:         `${FORM_ID}.primary.totalNEC`,
  primaryTotalWithholding: `${FORM_ID}.primary.totalWithholding`,
  spouseTotalNEC:          `${FORM_ID}.spouse.totalNEC`,
  spouseTotalWithholding:  `${FORM_ID}.spouse.totalWithholding`,
} as const;