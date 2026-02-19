/**
 * FORM W-2 — WAGE AND TAX STATEMENT
 *
 * W-2 is the first slotted form in PaisaTax. Unlike F8889 or F5329,
 * W-2 instances are not known at registration time — they are generated
 * dynamically by FormSlotRegistry when a user adds an employer.
 *
 * SLOT ARCHITECTURE
 *   Node IDs follow: {formId}.{owner}.s{slotIndex}.{lineId}
 *   Example: w2.primary.s0.box1_wages
 *            w2.primary.s1.box1_wages   ← second employer
 *            w2.spouse.s0.box1_wages
 *
 *   Each slot is independent. Slots do not know about each other.
 *   The aggregator sums across all active slots for a given owner.
 *
 * AGGREGATOR PATTERN
 *   generateW2Aggregators() returns aggregator nodes whose dependencies
 *   list is rebuilt dynamically based on which slots are active.
 *   The aggregator node for primary wages has ID: w2.primary.wages_total
 *   The aggregator node for spouse wages has ID:  w2.spouse.wages_total
 *   A joint total combines both: w2.joint.wages_total
 *
 *   The joint total feeds into F1040 Line 1a (wages).
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Box 1  — Wages, tips, other compensation
 *   ✅ Box 2  — Federal income tax withheld
 *   ✅ Box 12 — Various codes (retirement, HSA, etc.) — passthrough input
 *   ✅ Box 16 — State wages
 *   ✅ Box 17 — State income tax withheld
 *   🚧 Box 3/4 — Social Security wages/tax (SE calculations deferred)
 *   🚧 Box 5/6 — Medicare wages/tax (SE calculations deferred)
 *   🚧 Box 14 — Other (union dues, etc.)
 *
 * IRS References:
 *   Form W-2 Instructions (2025)
 *   Form 1040 Line 1a = total W-2 Box 1 wages
 *   Form 1040 Line 25a = federal withholding from W-2
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource
} from '../../../core/graph/node.types';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'w2';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT NODE ID HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a slot-scoped node ID.
 * Format: w2.{owner}.s{slotIndex}.{lineId}
 */
export function w2NodeId(owner: NodeOwner, slotIndex: number, lineId: string): string {
  return `${FORM_ID}.${owner}.s${slotIndex}.${lineId}`;
}

/** W-2 aggregator node IDs — stable, not slot-scoped. */
export const W2_OUTPUTS = {
  /** Total Box 1 wages for primary filer across all slots */
  primaryWages:        `${FORM_ID}.primary.wages_total`,
  /** Total Box 1 wages for spouse across all slots */
  spouseWages:         `${FORM_ID}.spouse.wages_total`,
  /** Combined wages for both filers — feeds F1040 Line 1a */
  jointWages:          `${FORM_ID}.joint.wages_total`,
  /** Total federal withholding for primary filer */
  primaryWithholding:  `${FORM_ID}.primary.withholding_total`,
  /** Total federal withholding for spouse */
  spouseWithholding:   `${FORM_ID}.spouse.withholding_total`,
  /** Combined federal withholding — feeds F1040 Line 25a */
  jointWithholding:    `${FORM_ID}.joint.withholding_total`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SLOT NODE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate all node definitions for one W-2 slot.
 *
 * Called by FormSlotRegistry when the user clicks "Add W-2".
 * Returns all input and computed nodes for this single employer.
 *
 * The slot is self-contained — none of these nodes reference other slots.
 * Cross-slot aggregation happens in the aggregator nodes.
 */
export function generateW2SlotNodes(owner: NodeOwner, slotIndex: number): NodeDefinition[] {
  const slotLabel = `W-2 #${slotIndex + 1} (${owner === NodeOwner.PRIMARY ? 'Primary' : 'Spouse'})`;

  function id(lineId: string): string {
    return w2NodeId(owner, slotIndex, lineId);
  }

  // ── Employer identification ─────────────────────────────────────────────────

  const employerName: NodeDefinition = {
    id:                 id('employer_name'),
    kind:               NodeKind.INPUT,
    label:              `${slotLabel} — Employer Name`,
    description:        'Name of the employer as shown on the W-2.',
    valueType:          NodeValueType.STRING,
    owner,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['income.earned'],
    source:             InputSource.OCR || InputSource.PREPARER,
    questionId:         `w2.q.${owner}.s${slotIndex}.employerName`,
    defaultValue:       '',
  };

  const employerEin: NodeDefinition = {
    id:                 id('employer_ein'),
    kind:               NodeKind.INPUT,
    label:              `${slotLabel} — Employer EIN`,
    description:        'Employer Identification Number (XX-XXXXXXX).',
    valueType:          NodeValueType.STRING,
    owner,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['income.earned'],
    source:             InputSource.OCR || InputSource.PREPARER,
    questionId:         `w2.q.${owner}.s${slotIndex}.employerEin`,
    defaultValue:       '',
  };

  // ── Box 1 — Wages, tips, other compensation ─────────────────────────────────

  const box1_wages: NodeDefinition = {
    id:                 id('box1_wages'),
    kind:               NodeKind.INPUT,
    label:              `${slotLabel} — Box 1: Wages, Tips, Other Compensation`,
    description:        'Total wages, tips, and other compensation from this employer. Feeds into Form 1040 Line 1a.',
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['income.earned'],
    source:             InputSource.OCR || InputSource.PREPARER,
    questionId:         `w2.q.${owner}.s${slotIndex}.box1`,
    defaultValue:       0,
  };

  // ── Box 2 — Federal income tax withheld ─────────────────────────────────────

  const box2_federalWithholding: NodeDefinition = {
    id:                 id('box2_federalWithholding'),
    kind:               NodeKind.INPUT,
    label:              `${slotLabel} — Box 2: Federal Income Tax Withheld`,
    description:        'Federal income tax withheld by this employer. Feeds into Form 1040 Line 25a (tax payments).',
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['withholding'],
    source:             InputSource.OCR || InputSource.PREPARER,
    questionId:         `w2.q.${owner}.s${slotIndex}.box2`,
    defaultValue:       0,
  };

  // ── Box 12 — Various codes (passthrough input) ───────────────────────────────
  // Box 12 has many codes (12a–12d, each with a letter code).
  // The most common codes relevant to our forms:
  //   D  = 401(k) contributions (reduces taxable wages for SS, not for income tax)
  //   W  = Employer HSA contributions (flows to F8889 Line 9)
  //   DD = Cost of employer-sponsored health coverage (informational only)
  //
  // For now: store as a single passthrough amount for code W (employer HSA).
  // Other codes deferred until their forms are built.

  const box12w_employerHsa: NodeDefinition = {
    id:                 id('box12w_employerHsa'),
    kind:               NodeKind.INPUT,
    label:              `${slotLabel} — Box 12 Code W: Employer HSA Contributions`,
    description:        'Employer contributions to employee\'s HSA (Box 12, Code W). Flows to Form 8889 Line 9 as employer contribution.',
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['contribution.hsa'],
    source:             InputSource.OCR || InputSource.PREPARER,
    questionId:         `w2.q.${owner}.s${slotIndex}.box12w`,
    defaultValue:       0,
  };

  // ── Box 16/17 — State wages and withholding ──────────────────────────────────

  const box16_stateWages: NodeDefinition = {
    id:                 id('box16_stateWages'),
    kind:               NodeKind.INPUT,
    label:              `${slotLabel} — Box 16: State Wages`,
    description:        'State wages, tips, etc. for state income tax purposes. May differ from Box 1.',
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['income.earned'],
    source:             InputSource.OCR || InputSource.PREPARER,
    questionId:         `w2.q.${owner}.s${slotIndex}.box16`,
    defaultValue:       0,
  };

  const box17_stateWithholding: NodeDefinition = {
    id:                 id('box17_stateWithholding'),
    kind:               NodeKind.INPUT,
    label:              `${slotLabel} — Box 17: State Income Tax Withheld`,
    description:        'State income tax withheld by this employer.',
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['payment'],
    source:             InputSource.OCR || InputSource.PREPARER,
    questionId:         `w2.q.${owner}.s${slotIndex}.box17`,
    defaultValue:       0,
  };

  return [
    employerName,
    employerEin,
    box1_wages,
    box2_federalWithholding,
    box12w_employerHsa,
    box16_stateWages,
    box17_stateWithholding,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATOR GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate aggregator node definitions for the current set of active slots.
 *
 * Called by FormSlotRegistry after every addSlot / removeSlot operation.
 * The returned nodes REPLACE any previously registered aggregators
 * (same IDs, updated dependencies list).
 *
 * AGGREGATOR HIERARCHY
 *   w2.primary.wages_total   = sum of box1_wages across all primary slots
 *   w2.spouse.wages_total    = sum of box1_wages across all spouse slots
 *   w2.joint.wages_total     = primary total + spouse total → F1040 Line 1a
 *
 *   w2.primary.withholding_total = sum of box2 across all primary slots
 *   w2.spouse.withholding_total  = sum of box2 across all spouse slots
 *   w2.joint.withholding_total   = combined → F1040 Line 25a
 *
 * EMPTY SLOT LISTS
 *   When a filer has no W-2 slots, their aggregator has no dependencies
 *   and returns 0. This is correct — no wages means zero contribution.
 *   The joint aggregator always exists and always sums whatever is present.
 */
export function generateW2Aggregators(
  primarySlots: number[],
  spouseSlots:  number[]
): NodeDefinition[] {

  // ── Primary wages aggregator ──────────────────────────────────────────────

  const primaryWagesDeps = primarySlots.map(i =>
    w2NodeId(NodeOwner.PRIMARY, i, 'box1_wages')
  );

  const primaryWagesAgg: NodeDefinition = {
    id:                 W2_OUTPUTS.primaryWages,
    kind:               NodeKind.COMPUTED,
    label:              'W-2 Primary Wages Total (Box 1)',
    description:        `Sum of Box 1 wages across ${primarySlots.length} W-2(s) for the primary filer.`,
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner:              NodeOwner.PRIMARY,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['income.earned'],
    dependencies:       primaryWagesDeps,
    compute: (ctx) => {
      return primaryWagesDeps.reduce((sum, dep) => sum + safeNum(ctx.get(dep)), 0);
    },
  };

  // ── Spouse wages aggregator ───────────────────────────────────────────────

  const spouseWagesDeps = spouseSlots.map(i =>
    w2NodeId(NodeOwner.SPOUSE, i, 'box1_wages')
  );

  const spouseWagesAgg: NodeDefinition = {
    id:                 W2_OUTPUTS.spouseWages,
    kind:               NodeKind.COMPUTED,
    label:              'W-2 Spouse Wages Total (Box 1)',
    description:        `Sum of Box 1 wages across ${spouseSlots.length} W-2(s) for the spouse.`,
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner:              NodeOwner.SPOUSE,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['income.earned'],
    dependencies:       spouseWagesDeps,
    compute: (ctx) => {
      return spouseWagesDeps.reduce((sum, dep) => sum + safeNum(ctx.get(dep)), 0);
    },
  };

  // ── Joint wages aggregator → F1040 Line 1a ───────────────────────────────

  const jointWagesAgg: NodeDefinition = {
    id:                 W2_OUTPUTS.jointWages,
    kind:               NodeKind.COMPUTED,
    label:              'W-2 Total Wages (Box 1) — Both Filers',
    description:        'Total W-2 Box 1 wages for both filers combined. Feeds Form 1040 Line 1a.',
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner:              NodeOwner.JOINT,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['income.earned'],
    dependencies:       [W2_OUTPUTS.primaryWages, W2_OUTPUTS.spouseWages],
    compute: (ctx) => {
      return safeNum(ctx.get(W2_OUTPUTS.primaryWages)) +
             safeNum(ctx.get(W2_OUTPUTS.spouseWages));
    },
  };

  // ── Primary withholding aggregator ────────────────────────────────────────

  const primaryWithholdingDeps = primarySlots.map(i =>
    w2NodeId(NodeOwner.PRIMARY, i, 'box2_federalWithholding')
  );

  const primaryWithholdingAgg: NodeDefinition = {
    id:                 W2_OUTPUTS.primaryWithholding,
    kind:               NodeKind.COMPUTED,
    label:              'W-2 Primary Federal Withholding Total (Box 2)',
    description:        `Sum of Box 2 federal withholding across ${primarySlots.length} W-2(s) for the primary filer.`,
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner:              NodeOwner.PRIMARY,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['withholding'],
    dependencies:       primaryWithholdingDeps,
    compute: (ctx) => {
      return primaryWithholdingDeps.reduce((sum, dep) => sum + safeNum(ctx.get(dep)), 0);
    },
  };

  // ── Spouse withholding aggregator ─────────────────────────────────────────

  const spouseWithholdingDeps = spouseSlots.map(i =>
    w2NodeId(NodeOwner.SPOUSE, i, 'box2_federalWithholding')
  );

  const spouseWithholdingAgg: NodeDefinition = {
    id:                 W2_OUTPUTS.spouseWithholding,
    kind:               NodeKind.COMPUTED,
    label:              'W-2 Spouse Federal Withholding Total (Box 2)',
    description:        `Sum of Box 2 federal withholding across ${spouseSlots.length} W-2(s) for the spouse.`,
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner:              NodeOwner.SPOUSE,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['withholding'],
    dependencies:       spouseWithholdingDeps,
    compute: (ctx) => {
      return spouseWithholdingDeps.reduce((sum, dep) => sum + safeNum(ctx.get(dep)), 0);
    },
  };

  // ── Joint withholding aggregator → F1040 Line 25a ────────────────────────

  const jointWithholdingAgg: NodeDefinition = {
    id:                 W2_OUTPUTS.jointWithholding,
    kind:               NodeKind.COMPUTED,
    label:              'W-2 Total Federal Withholding (Box 2) — Both Filers',
    description:        'Total federal income tax withheld from W-2s for both filers. Feeds Form 1040 Line 25a.',
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner:              NodeOwner.JOINT,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['withholding'],
    dependencies:       [W2_OUTPUTS.primaryWithholding, W2_OUTPUTS.spouseWithholding],
    compute: (ctx) => {
      return safeNum(ctx.get(W2_OUTPUTS.primaryWithholding)) +
             safeNum(ctx.get(W2_OUTPUTS.spouseWithholding));
    },
  };

  return [
    primaryWagesAgg,
    spouseWagesAgg,
    jointWagesAgg,
    primaryWithholdingAgg,
    spouseWithholdingAgg,
    jointWithholdingAgg,
  ];
}

/**
 * The initial aggregator definitions with zero slots.
 * Register these alongside F1040_NODES at engine startup so that
 * F1040 Line 1a has a valid dependency even before any W-2 is added.
 */
export const W2_INITIAL_AGGREGATORS: NodeDefinition[] = generateW2Aggregators([], []);