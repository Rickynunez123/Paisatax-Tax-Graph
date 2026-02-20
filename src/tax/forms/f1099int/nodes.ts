/**
 * FORM 1099-INT — INTEREST INCOME
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Box 1  — Interest income (taxable)
 *   ✅ Box 4  — Federal income tax withheld
 *   ✅ Box 8  — Tax-exempt interest (municipal bonds — reported on 1040 Line 2a, not taxable)
 *   🚧 Box 2  — Early withdrawal penalty (flows to Schedule 1 Line 18 — deferred)
 *   🚧 Box 3  — Interest on U.S. Savings Bonds/Treasury (state-exempt, federally taxable)
 *   🚧 Box 11 — Bond premium (reduces taxable interest — complex, deferred)
 *   🚧 Box 13 — Bond premium on tax-exempt bonds (deferred)
 *
 * SLOT PATTERN:
 *   Identical to W-2. Each payer (bank, broker) is one slot.
 *   Slot ID format: f1099int.{owner}.s{index}.{lineId}
 *   Owner is always PRIMARY or SPOUSE (not JOINT — interest belongs to whoever
 *   owns the account). The Schedule B aggregator combines both owners.
 *
 * AGGREGATOR PATTERN:
 *   generateAggregators() produces four nodes:
 *     f1099int.primary.totalInterest       — sum of Box 1 across primary slots
 *     f1099int.primary.totalTaxExempt      — sum of Box 8 across primary slots
 *     f1099int.primary.totalWithholding    — sum of Box 4 across primary slots
 *     f1099int.spouse.totalInterest        — sum of Box 1 across spouse slots
 *     f1099int.spouse.totalTaxExempt       — sum of Box 8 across spouse slots
 *     f1099int.spouse.totalWithholding     — sum of Box 4 across spouse slots
 *
 *   Schedule B reads primary + spouse totals and combines them.
 *
 * IRS References:
 *   Form 1099-INT Instructions (2025)
 *   Form 1040 Line 2a (tax-exempt interest) and Line 2b (taxable interest)
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f1099int';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateF1099INTSlotNodes(
  owner:     NodeOwner,
  slotIndex: number,
): NodeDefinition[] {
  const ownerStr = owner === NodeOwner.PRIMARY ? 'primary' : 'spouse';
  const slotId   = `${FORM_ID}.${ownerStr}.s${slotIndex}`;

  return [
    {
      id:                 `${slotId}.payerName`,
      kind:               NodeKind.INPUT,
      label:              `1099-INT Slot ${slotIndex} — Payer Name`,
      description:        'Name of the financial institution or payer as shown on the 1099-INT.',
      valueType:          NodeValueType.STRING,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-INT', box: 'payer_name' },
      defaultValue:       '',
    },

    {
      id:                 `${slotId}.box1_interest`,
      kind:               NodeKind.INPUT,
      label:              `1099-INT Slot ${slotIndex} — Box 1: Interest Income`,
      description:        'Taxable interest income from this payer. Flows to Schedule B Part I and Form 1040 Line 2b.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-INT', box: '1', fieldName: 'interest_income' },
      defaultValue:       0,
    },

    {
      id:                 `${slotId}.box4_federalWithholding`,
      kind:               NodeKind.INPUT,
      label:              `1099-INT Slot ${slotIndex} — Box 4: Federal Income Tax Withheld`,
      description:        'Federal income tax withheld on interest (backup withholding). Flows to Form 1040 Line 25b withholding.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['withholding'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-INT', box: '4', fieldName: 'federal_income_tax_withheld' },
      defaultValue:       0,
    },

    {
      id:                 `${slotId}.box8_taxExemptInterest`,
      kind:               NodeKind.INPUT,
      label:              `1099-INT Slot ${slotIndex} — Box 8: Tax-Exempt Interest`,
      description:        'Tax-exempt interest (e.g. municipal bonds). Not taxable federally. Reported on Form 1040 Line 2a for informational purposes. Does NOT flow to Line 2b.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-INT', box: '8', fieldName: 'tax_exempt_interest' },
      defaultValue:       0,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATOR GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates aggregator nodes for the current set of active slots.
 * Called by FormSlotRegistry after every addSlot/removeSlot.
 *
 * Produces one aggregator per owner per metric:
 *   - totalInterest    (Box 1)
 *   - totalTaxExempt   (Box 8)
 *   - totalWithholding (Box 4)
 */
export function generateF1099INTAggregators(
  primarySlots: number[],
  spouseSlots:  number[],
): NodeDefinition[] {
  const nodes: NodeDefinition[] = [];

  for (const [ownerStr, slots] of [
    ['primary', primarySlots],
    ['spouse',  spouseSlots],
  ] as const) {

    // Box 1 — taxable interest
    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.totalInterest`,
      kind:               NodeKind.COMPUTED,
      label:              `1099-INT (${ownerStr}) — Total Taxable Interest`,
      description:        `Sum of Box 1 (interest income) across all ${ownerStr} 1099-INT slots.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner:              ownerStr === 'primary' ? NodeOwner.PRIMARY : NodeOwner.SPOUSE,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      dependencies:       slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.box1_interest`),
      compute: (ctx) => slots.reduce(
        (sum, i) => sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.box1_interest`)),
        0,
      ),
    });

    // Box 8 — tax-exempt interest
    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.totalTaxExempt`,
      kind:               NodeKind.COMPUTED,
      label:              `1099-INT (${ownerStr}) — Total Tax-Exempt Interest`,
      description:        `Sum of Box 8 (tax-exempt interest) across all ${ownerStr} 1099-INT slots.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner:              ownerStr === 'primary' ? NodeOwner.PRIMARY : NodeOwner.SPOUSE,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      dependencies:       slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.box8_taxExemptInterest`),
      compute: (ctx) => slots.reduce(
        (sum, i) => sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.box8_taxExemptInterest`)),
        0,
      ),
    });

    // Box 4 — withholding
    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.totalWithholding`,
      kind:               NodeKind.COMPUTED,
      label:              `1099-INT (${ownerStr}) — Total Federal Withholding`,
      description:        `Sum of Box 4 (federal income tax withheld) across all ${ownerStr} 1099-INT slots.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner:              ownerStr === 'primary' ? NodeOwner.PRIMARY : NodeOwner.SPOUSE,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['withholding'],
      dependencies:       slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.box4_federalWithholding`),
      compute: (ctx) => slots.reduce(
        (sum, i) => sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.box4_federalWithholding`)),
        0,
      ),
    });
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL AGGREGATORS (zero-slot state — required at engine startup)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Must be registered before Schedule B nodes so the dependency IDs resolve.
 * These produce zero until slots are added via FormSlotRegistry.
 */
export const F1099INT_INITIAL_AGGREGATORS: NodeDefinition[] =
  generateF1099INTAggregators([], []);

export const F1099INT_OUTPUTS = {
  primaryInterest:    `${FORM_ID}.primary.totalInterest`,
  primaryTaxExempt:   `${FORM_ID}.primary.totalTaxExempt`,
  primaryWithholding: `${FORM_ID}.primary.totalWithholding`,
  spouseInterest:     `${FORM_ID}.spouse.totalInterest`,
  spouseTaxExempt:    `${FORM_ID}.spouse.totalTaxExempt`,
  spouseWithholding:  `${FORM_ID}.spouse.totalWithholding`,
} as const;