/**
 * FORM 1099-DIV — DIVIDENDS AND DISTRIBUTIONS
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Box 1a — Total ordinary dividends → Schedule B Part II → 1040 Line 3b
 *   ✅ Box 1b — Qualified dividends → 1040 Line 3a (subset of Box 1a)
 *   ✅ Box 4  — Federal income tax withheld (backup withholding)
 *   🚧 Box 2a — Total capital gain distributions → Schedule D (deferred)
 *   🚧 Box 2b — Unrecaptured §1250 gain (deferred)
 *   🚧 Box 2c — Section 1202 gain (deferred)
 *   🚧 Box 2d — Collectibles (28%) gain (deferred)
 *   🚧 Box 5  — Section 199A dividends / REIT dividends (deferred)
 *   🚧 Box 6  — Investment expenses (deferred)
 *   🚧 Box 7  — Foreign tax paid (deferred → Form 1116)
 *   🚧 Box 12 — Exempt-interest dividends (deferred)
 *
 * SLOT PATTERN:
 *   Same as W-2 and 1099-INT. Each brokerage/fund company is one slot.
 *   Slot ID format: f1099div.{owner}.s{index}.{lineId}
 *
 * KEY RELATIONSHIP — Box 1a vs Box 1b:
 *   Box 1b (qualified dividends) is ALWAYS ≤ Box 1a (ordinary dividends).
 *   Qualified dividends are a subset — they are already included in Box 1a.
 *   On Form 1040: Line 3b = Box 1a total, Line 3a = Box 1b total.
 *   The preferential tax rate on qualified dividends is computed via the
 *   Qualified Dividends and Capital Gains Tax Worksheet — deferred until
 *   Schedule D is built (they share the same worksheet).
 *
 * IRS References:
 *   Form 1099-DIV Instructions (2025)
 *   Form 1040 Lines 3a (qualified dividends) and 3b (ordinary dividends)
 *   Schedule B Part II
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f1099div';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateF1099DIVSlotNodes(
  owner:     NodeOwner,
  slotIndex: number,
): NodeDefinition[] {
  const ownerStr = owner === NodeOwner.PRIMARY ? 'primary' : 'spouse';
  const slotId   = `${FORM_ID}.${ownerStr}.s${slotIndex}`;

  return [
    {
      id:                 `${slotId}.payerName`,
      kind:               NodeKind.INPUT,
      label:              `1099-DIV Slot ${slotIndex} — Payer Name`,
      description:        'Name of the fund company or brokerage as shown on the 1099-DIV.',
      valueType:          NodeValueType.STRING,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-DIV', box: 'payer_name' },
      defaultValue:       '',
    },

    {
      id:                 `${slotId}.box1a_ordinaryDividends`,
      kind:               NodeKind.INPUT,
      label:              `1099-DIV Slot ${slotIndex} — Box 1a: Total Ordinary Dividends`,
      description:        'Total ordinary dividends from this payer. Includes qualified dividends. Flows to Schedule B Part II Line 6 and Form 1040 Line 3b.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-DIV', box: '1a', fieldName: 'total_ordinary_dividends' },
      defaultValue:       0,
    },

    {
      id:                 `${slotId}.box1b_qualifiedDividends`,
      kind:               NodeKind.INPUT,
      label:              `1099-DIV Slot ${slotIndex} — Box 1b: Qualified Dividends`,
      description:        'Qualified dividends taxed at preferential rates (0/15/20%). Must be ≤ Box 1a. Already included in Box 1a — do not add separately. Flows to Form 1040 Line 3a.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-DIV', box: '1b', fieldName: 'qualified_dividends' },
      defaultValue:       0,
    },

    {
      id:                 `${slotId}.box4_federalWithholding`,
      kind:               NodeKind.INPUT,
      label:              `1099-DIV Slot ${slotIndex} — Box 4: Federal Income Tax Withheld`,
      description:        'Federal income tax withheld on dividends (backup withholding). Flows to Form 1040 Line 25b withholding.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['withholding'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-DIV', box: '4', fieldName: 'federal_income_tax_withheld' },
      defaultValue:       0,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATOR GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateF1099DIVAggregators(
  primarySlots: number[],
  spouseSlots:  number[],
): NodeDefinition[] {
  const nodes: NodeDefinition[] = [];

  for (const [ownerStr, slots] of [
    ['primary', primarySlots],
    ['spouse',  spouseSlots],
  ] as const) {

    // Box 1a — total ordinary dividends
    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.totalOrdinaryDividends`,
      kind:               NodeKind.COMPUTED,
      label:              `1099-DIV (${ownerStr}) — Total Ordinary Dividends`,
      description:        `Sum of Box 1a (ordinary dividends) across all ${ownerStr} 1099-DIV slots.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner:              ownerStr === 'primary' ? NodeOwner.PRIMARY : NodeOwner.SPOUSE,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      dependencies:       slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.box1a_ordinaryDividends`),
      compute: (ctx) => slots.reduce(
        (sum, i) => sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.box1a_ordinaryDividends`)),
        0,
      ),
    });

    // Box 1b — qualified dividends
    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.totalQualifiedDividends`,
      kind:               NodeKind.COMPUTED,
      label:              `1099-DIV (${ownerStr}) — Total Qualified Dividends`,
      description:        `Sum of Box 1b (qualified dividends) across all ${ownerStr} 1099-DIV slots. Always ≤ totalOrdinaryDividends.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner:              ownerStr === 'primary' ? NodeOwner.PRIMARY : NodeOwner.SPOUSE,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      dependencies:       slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.box1b_qualifiedDividends`),
      compute: (ctx) => slots.reduce(
        (sum, i) => sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.box1b_qualifiedDividends`)),
        0,
      ),
    });

    // Box 4 — withholding
    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.totalWithholding`,
      kind:               NodeKind.COMPUTED,
      label:              `1099-DIV (${ownerStr}) — Total Federal Withholding`,
      description:        `Sum of Box 4 (federal income tax withheld) across all ${ownerStr} 1099-DIV slots.`,
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
// INITIAL AGGREGATORS
// ─────────────────────────────────────────────────────────────────────────────

export const F1099DIV_INITIAL_AGGREGATORS: NodeDefinition[] =
  generateF1099DIVAggregators([], []);

export const F1099DIV_OUTPUTS = {
  primaryOrdinaryDividends:  `${FORM_ID}.primary.totalOrdinaryDividends`,
  primaryQualifiedDividends: `${FORM_ID}.primary.totalQualifiedDividends`,
  primaryWithholding:        `${FORM_ID}.primary.totalWithholding`,
  spouseOrdinaryDividends:   `${FORM_ID}.spouse.totalOrdinaryDividends`,
  spouseQualifiedDividends:  `${FORM_ID}.spouse.totalQualifiedDividends`,
  spouseWithholding:         `${FORM_ID}.spouse.totalWithholding`,
} as const;