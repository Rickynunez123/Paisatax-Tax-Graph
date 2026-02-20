/**
 * FORM 8949 — SALES AND OTHER DISPOSITIONS OF CAPITAL ASSETS
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Box 1a — Description of property
 *   ✅ Box 1b — Date acquired ("VARIOUS" is valid)
 *   ✅ Box 1c — Date sold or disposed
 *   ✅ Box 1d — Proceeds (sales price)
 *   ✅ Box 1e — Cost or other basis
 *   ✅ Box 1f — Adjustment code (W = wash sale, H = covered, etc.)
 *   ✅ Box 1g — Adjustment amount (wash sale loss disallowed — positive;
 *               basis adjustments — negative)
 *   ✅ termType — 'short' | 'long' (short ≤ 1 year, long > 1 year)
 *   ✅ gainLoss — computed: proceeds − basis + adjustment
 *   🚧 basisReported — Box A/B/C vs D/E/F classification (captured but
 *                       doesn't affect math — preparers use it for IRS matching)
 *
 * SLOT PATTERN:
 *   Each sold lot is one slot. Slot ID format:
 *     f8949.primary.s{index}.{field}
 *
 *   Owner is PRIMARY or SPOUSE — gains belong to whoever owned the asset.
 *
 * WASH SALE HANDLING:
 *   Box 1g captures the wash sale loss disallowed amount as reported on
 *   the 1099-B. The engine does NOT validate wash sale rules — the preparer
 *   enters what the broker already computed. A positive Box 1g increases
 *   the realized gain (disallows the loss). A negative Box 1g decreases it
 *   (adds to basis).
 *
 *   gainLoss = proceeds (1d) − basis (1e) + adjustment (1g)
 *
 * AGGREGATOR PATTERN:
 *   Aggregators split by owner AND term type:
 *     f8949.primary.shortTermGainLoss  — net short-term for primary
 *     f8949.primary.longTermGainLoss   — net long-term for primary
 *     f8949.spouse.shortTermGainLoss   — net short-term for spouse
 *     f8949.spouse.longTermGainLoss    — net long-term for spouse
 *
 *   Schedule D reads these four nodes and produces joint totals.
 *
 * IRS References:
 *   Form 8949 Instructions (2025)
 *   Schedule D Instructions (2025)
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f8949';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateF8949SlotNodes(
  owner:     NodeOwner,
  slotIndex: number,
): NodeDefinition[] {
  const ownerStr = owner === NodeOwner.PRIMARY ? 'primary' : 'spouse';
  const slotId   = `${FORM_ID}.${ownerStr}.s${slotIndex}`;

  return [
    // ── Descriptive fields ──────────────────────────────────────────────────

    {
      id:                 `${slotId}.box1a_description`,
      kind:               NodeKind.INPUT,
      label:              `Form 8949 Slot ${slotIndex} — Box 1a: Description`,
      description:        'Description of the property sold (e.g. "100 sh XYZ Corp").',
      valueType:          NodeValueType.STRING,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-B', box: 'description' },
      defaultValue:       '',
    },

    {
      id:                 `${slotId}.box1b_dateAcquired`,
      kind:               NodeKind.INPUT,
      label:              `Form 8949 Slot ${slotIndex} — Box 1b: Date Acquired`,
      description:        'Date the asset was acquired. "VARIOUS" is valid for multiple lots.',
      valueType:          NodeValueType.STRING,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-B', box: 'date_acquired' },
      defaultValue:       '',
    },

    {
      id:                 `${slotId}.box1c_dateSold`,
      kind:               NodeKind.INPUT,
      label:              `Form 8949 Slot ${slotIndex} — Box 1c: Date Sold`,
      description:        'Date the asset was sold or disposed of.',
      valueType:          NodeValueType.STRING,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-B', box: 'date_sold' },
      defaultValue:       '',
    },

    // ── Term type — short or long ────────────────────────────────────────────

    {
      id:                 `${slotId}.termType`,
      kind:               NodeKind.INPUT,
      label:              `Form 8949 Slot ${slotIndex} — Term: Short or Long`,
      description:        '"short" = held ≤ 1 year (ordinary rate). "long" = held > 1 year (preferential rate). Drives which Schedule D Part this slot feeds.',
      valueType:          NodeValueType.ENUM,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-B', box: 'term_type' },
      defaultValue:       'short',
      validation:         { allowedValues: ['short', 'long'] },
    },

    // ── Dollar amounts ───────────────────────────────────────────────────────

    {
      id:                 `${slotId}.box1d_proceeds`,
      kind:               NodeKind.INPUT,
      label:              `Form 8949 Slot ${slotIndex} — Box 1d: Proceeds`,
      description:        'Sales price or proceeds from the sale. From 1099-B Box 1d.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-B', box: '1d', fieldName: 'proceeds' },
      defaultValue:       0,
    },

    {
      id:                 `${slotId}.box1e_costBasis`,
      kind:               NodeKind.INPUT,
      label:              `Form 8949 Slot ${slotIndex} — Box 1e: Cost or Other Basis`,
      description:        'Original cost or adjusted basis of the asset. From 1099-B Box 1e.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      false,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-B', box: '1e', fieldName: 'cost_basis' },
      defaultValue:       0,
    },

    {
      id:                 `${slotId}.box1f_adjustmentCode`,
      kind:               NodeKind.INPUT,
      label:              `Form 8949 Slot ${slotIndex} — Box 1f: Adjustment Code`,
      description:        'IRS adjustment code (e.g. "W" for wash sale, "H" for covered security). Enter as shown on 1099-B. Leave blank if no adjustment.',
      valueType:          NodeValueType.STRING,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-B', box: '1f', fieldName: 'adjustment_code' },
      defaultValue:       '',
    },

    {
      id:                 `${slotId}.box1g_adjustmentAmount`,
      kind:               NodeKind.INPUT,
      label:              `Form 8949 Slot ${slotIndex} — Box 1g: Adjustment Amount`,
      description:        'Adjustment to gain/loss. Positive = loss disallowed (wash sale adds to gain). Negative = basis adjustment (reduces gain). Enter as shown on 1099-B.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      true, // Negative = basis adjustment reducing gain
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      ocrMapping:         { documentType: '1099-B', box: '1g', fieldName: 'adjustment_amount' },
      defaultValue:       0,
    },

    // ── Basis reported flag ──────────────────────────────────────────────────

    {
      id:                 `${slotId}.basisReported`,
      kind:               NodeKind.INPUT,
      label:              `Form 8949 Slot ${slotIndex} — Basis Reported to IRS?`,
      description:        'Whether the broker reported the cost basis to the IRS (Box A/B/D/E). Determines which 8949 column the entry goes in. Does not affect gain/loss calculation.',
      valueType:          NodeValueType.BOOLEAN,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['intermediate'],
      source:             InputSource.OCR,
      defaultValue:       true,
    },

    // ── Computed gain/loss per slot ──────────────────────────────────────────

    {
      id:                 `${slotId}.gainLoss`,
      kind:               NodeKind.COMPUTED,
      label:              `Form 8949 Slot ${slotIndex} — Gain or (Loss)`,
      description:        'Proceeds (1d) minus basis (1e) plus adjustment (1g). Positive = gain, negative = loss.',
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      true, // Losses are the whole point
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      dependencies: [
        `${slotId}.box1d_proceeds`,
        `${slotId}.box1e_costBasis`,
        `${slotId}.box1g_adjustmentAmount`,
      ],
      compute: (ctx) => {
        const proceeds   = safeNum(ctx.get(`${slotId}.box1d_proceeds`));
        const basis      = safeNum(ctx.get(`${slotId}.box1e_costBasis`));
        const adjustment = safeNum(ctx.get(`${slotId}.box1g_adjustmentAmount`));
        return proceeds - basis + adjustment;
      },
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATOR GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates four aggregator nodes splitting by owner and term type.
 * Each aggregator sums gainLoss for all slots matching its owner+term.
 *
 * The slot's termType input determines which aggregator captures it.
 * We use two aggregators per owner (short + long) rather than one combined,
 * because Schedule D Parts I and II are separate.
 *
 * Implementation: each slot's gainLoss feeds BOTH the short and long
 * aggregator dependencies, but the compute function gates by termType.
 * This means the aggregator reads termType as well as gainLoss.
 */
export function generateF8949Aggregators(
  primarySlots: number[],
  spouseSlots:  number[],
): NodeDefinition[] {
  const nodes: NodeDefinition[] = [];

  for (const [ownerStr, slots] of [
    ['primary', primarySlots],
    ['spouse',  spouseSlots],
  ] as const) {
    const owner = ownerStr === 'primary' ? NodeOwner.PRIMARY : NodeOwner.SPOUSE;

    // Build dependencies — for each slot, we need both gainLoss and termType
    const gainLossDeps = slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.gainLoss`);
    const termTypeDeps = slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.termType`);
    const allDeps      = [...gainLossDeps, ...termTypeDeps];

    // Short-term net
    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.shortTermGainLoss`,
      kind:               NodeKind.COMPUTED,
      label:              `Form 8949 (${ownerStr}) — Net Short-Term Gain or (Loss)`,
      description:        `Sum of gain/loss for all ${ownerStr} short-term lots (termType = 'short'). Flows to Schedule D Part I.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      true,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      dependencies:       allDeps,
      compute: (ctx) => slots.reduce((sum, i) => {
        const term = ctx.get(`${FORM_ID}.${ownerStr}.s${i}.termType`);
        if (term !== 'short') return sum;
        return sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.gainLoss`));
      }, 0),
    });

    // Long-term net
    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.longTermGainLoss`,
      kind:               NodeKind.COMPUTED,
      label:              `Form 8949 (${ownerStr}) — Net Long-Term Gain or (Loss)`,
      description:        `Sum of gain/loss for all ${ownerStr} long-term lots (termType = 'long'). Flows to Schedule D Part II.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      true,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.portfolio'],
      dependencies:       allDeps,
      compute: (ctx) => slots.reduce((sum, i) => {
        const term = ctx.get(`${FORM_ID}.${ownerStr}.s${i}.termType`);
        if (term !== 'long') return sum;
        return sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.gainLoss`));
      }, 0),
    });
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL AGGREGATORS
// ─────────────────────────────────────────────────────────────────────────────

export const F8949_INITIAL_AGGREGATORS: NodeDefinition[] =
  generateF8949Aggregators([], []);

export const F8949_OUTPUTS = {
  primaryShortTerm: `${FORM_ID}.primary.shortTermGainLoss`,
  primaryLongTerm:  `${FORM_ID}.primary.longTermGainLoss`,
  spouseShortTerm:  `${FORM_ID}.spouse.shortTermGainLoss`,
  spouseLongTerm:   `${FORM_ID}.spouse.longTermGainLoss`,
} as const;