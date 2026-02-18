/**
 * SCHEDULE 2 — ADDITIONAL TAXES
 * Node definitions for Part I: Additional Taxes
 *
 * Schedule 2 is a pure aggregator. It does not calculate anything new —
 * it collects computed values from source forms and sums them into totals
 * that flow to Form 1040.
 *
 * NEW PATTERNS introduced here (not seen in F8889 or F5329):
 *
 *   Pattern 1 — JOINT aggregation of REPEATABLE nodes
 *     When both spouses have HSAs, Schedule 2 Line 17b must sum
 *     the primary AND spouse values from Form 8889 Line 17b.
 *     We use a JOINT node that explicitly depends on both instances.
 *     When no spouse: spouse instance is SKIPPED, ctx.get() returns null,
 *     and we treat null as 0. The JOINT node still produces a correct result.
 *
 *   Pattern 2 — Tolerant aggregation (treat SKIPPED/null as zero)
 *     Schedule 2 Line 44 sums all Part I lines. Some lines may be SKIPPED
 *     (form not applicable) or UNSUPPORTED. The aggregator must treat
 *     these as zero rather than propagating null or erroring.
 *     This is enforced by the safeNum() helper in compute functions.
 *
 *   Pattern 3 — isApplicable for form-level conditions
 *     Some Schedule 2 lines only apply when the source form has activity.
 *     We use isApplicable() to skip lines where the source form's key
 *     output is zero — keeping the return clean for simple taxpayers.
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Line 8   — Additional tax from Form 5329 (early dist + HSA excess)
 *   ✅ Line 17b — Additional 20% HSA tax from Form 8889
 *   ✅ Line 44  — Total additional taxes (Part I total)
 *   🚧 Line 1   — Alternative Minimum Tax (Form 6251)
 *   🚧 Line 2   — Excess advance premium tax credit (Form 8962)
 *   🚧 Line 17a — Recapture of low-income housing credit (Form 8611)
 *   🚧 Line 17c — Recapture of federal mortgage credit (Form 8828)
 *   🚧 Lines 17d–17z — Various other recapture taxes
 *   🚧 Lines 45–17  — Part II (Other Taxes): SE tax, NIIT, HCET, etc.
 *
 * IRS References:
 *   Schedule 2 Instructions (2025)
 *   Form 1040 Line 17 references Schedule 2 Line 44
 */
import type { NodeDefinition } from '../../../core/graph/node.types';

import {
  NodeKind,
  NodeOwner,
  NodeValueType,
} from '../../../core/graph/node.types';

import { F8889_OUTPUTS } from '../f8889/nodes';
import { F5329_OUTPUTS } from '../f5329/nodes';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const APPLICABLE_YEARS = ['2024', '2025'];
const FORM_ID          = 'schedule2';

/**
 * Safe numeric read from context.
 * Returns 0 when the node is SKIPPED, UNSUPPORTED, or not yet computed.
 * Schedule 2 aggregation lines must never fail because one source is missing.
 *
 * This is defined inline in compute functions rather than as a shared
 * utility because compute functions must be pure and receive context only
 * through the ctx parameter — no imports from outside.
 */
function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART I — ADDITIONAL TAXES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 1 — Alternative Minimum Tax (Form 6251)
 *
 * 🚧 UNSUPPORTED — Form 6251 not yet implemented.
 *
 * Defined as an input node so the preparer can manually enter the value
 * if needed. When Form 6251 is implemented, this becomes COMPUTED.
 */
const line1_alternativeMinimumTax: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line1_alternativeMinimumTax`,
  kind:               NodeKind.INPUT,
  label:              'Schedule 2 Line 1 — Alternative Minimum Tax (Form 6251)',
  description:        'AMT from Form 6251. Not yet supported — enter manually if applicable.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['penalty'],
  irsCitation:        { form: 'schedule2', line: '1', ircSection: '55' },
  source:             'preparer' as any,
  questionId:         'schedule2.q.amt',
  defaultValue:       0,
};

/**
 * Line 2 — Excess advance premium tax credit repayment (Form 8962)
 *
 * 🚧 UNSUPPORTED — Form 8962 not yet implemented.
 */
const line2_excessPremiumTaxCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line2_excessPremiumTaxCredit`,
  kind:               NodeKind.INPUT,
  label:              'Schedule 2 Line 2 — Excess Advance Premium Tax Credit (Form 8962)',
  description:        'Repayment of excess advance premium tax credit from ACA marketplace coverage. Not yet supported.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['penalty'],
  irsCitation:        { form: 'schedule2', line: '2', ircSection: '36B' },
  source:             'preparer' as any,
  questionId:         'schedule2.q.premiumTaxCreditRepayment',
  defaultValue:       0,
};

/**
 * Line 3 — Add lines 1 and 2 (subtotal before Form 5329 and others)
 *
 * Intermediate sum of the unsupported lines. Defined so the
 * aggregation chain is complete even before those lines are implemented.
 */
const line3_subtotal: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line3_subtotal`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule 2 Line 3 — Add Lines 1 and 2',
  description:        'Sum of Line 1 (AMT) and Line 2 (excess premium credit). Intermediate subtotal.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  irsCitation:        { form: 'schedule2', line: '3' },
  dependencies: [
    `${FORM_ID}.joint.line1_alternativeMinimumTax`,
    `${FORM_ID}.joint.line2_excessPremiumTaxCredit`,
  ],
  compute: (ctx) => {
    const line1 = safeNum(ctx.get(`${FORM_ID}.joint.line1_alternativeMinimumTax`));
    const line2 = safeNum(ctx.get(`${FORM_ID}.joint.line2_excessPremiumTaxCredit`));
    return line1 + line2;
  },
};

/**
 * Line 8 — Additional tax on IRAs and other qualified retirement plans
 *          from Form 5329
 *
 * *** CROSS-FORM AGGREGATION — PRIMARY + SPOUSE ***
 *
 * Form 5329 is filed per-filer. Schedule 2 Line 8 is the household total.
 * We sum:
 *   - Primary filer's early distribution penalty (Form 5329 Line 4)
 *   - Primary filer's HSA excess contribution tax (Form 5329 Line 49 tax)
 *   - Spouse's early distribution penalty (when hasSpouse = true)
 *   - Spouse's HSA excess contribution tax (when hasSpouse = true)
 *
 * The spouse instances may be SKIPPED (no spouse) or UNSUPPORTED.
 * safeNum() treats both as 0 — the aggregation is always valid.
 *
 * Note: Form 5329 has many other penalty parts (II–VI, VIII, IX) that
 * we have not yet implemented. When those are added, their outputs will
 * be added to this node's dependencies and compute function.
 */
const line8_additionalRetirementTax: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line8_additionalRetirementTax`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule 2 Line 8 — Additional Tax on Retirement Plans (Form 5329)',
  description:        'Total additional taxes from Form 5329: early distribution penalty (Part I) and HSA excess contribution tax (Part VII). Includes both primary and spouse when applicable.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['penalty'],
  irsCitation:        { form: 'schedule2', line: '8', ircSection: '72(t)' },

  /**
   * Dependencies include primary filer's F5329 outputs.
   * Spouse F5329 nodes are referenced directly in the compute function
   * via their instance IDs — they will be SKIPPED when no spouse exists,
   * and safeNum() will return 0 for those.
   *
   * We list only the primary instances in the formal dependencies array
   * because the engine validates these at registerNodes() time.
   * The spouse instances use ctx.get() with safeNum() fallback.
   *
   * TODO: When spouse support is fully wired through the session,
   * add spouse node IDs to the dependencies array.
   */
  dependencies: [
    F5329_OUTPUTS.earlyDistributionPenalty,  // f5329.primary.line4_additionalTax
    F5329_OUTPUTS.hsaExcessTax,              // f5329.primary.line49_excessTax
  ],
  compute: (ctx) => {
    // Primary filer's Form 5329 penalties
    const primaryEarlyDist  = safeNum(ctx.get(F5329_OUTPUTS.earlyDistributionPenalty));
    const primaryHsaExcess  = safeNum(ctx.get(F5329_OUTPUTS.hsaExcessTax));

    // Spouse's Form 5329 penalties (spouse instances — SKIPPED if no spouse)
    // When hasSpouse = false, these nodes don't exist and ctx.get() returns null
    const spouseEarlyDist   = safeNum(ctx.get('f5329.spouse.line4_additionalTax'));
    const spouseHsaExcess   = safeNum(ctx.get('f5329.spouse.line49_excessTax'));

    return primaryEarlyDist + primaryHsaExcess + spouseEarlyDist + spouseHsaExcess;
  },

  /**
   * Only applicable if at least one Form 5329 penalty is non-zero.
   * This keeps the form clean — Schedule 2 Line 8 only appears
   * on returns that actually have retirement plan penalties.
   */
  isApplicable: (ctx) => {
    const primaryEarlyDist = safeNum(ctx.get(F5329_OUTPUTS.earlyDistributionPenalty));
    const primaryHsaExcess = safeNum(ctx.get(F5329_OUTPUTS.hsaExcessTax));
    const spouseEarlyDist  = safeNum(ctx.get('f5329.spouse.line4_additionalTax'));
    const spouseHsaExcess  = safeNum(ctx.get('f5329.spouse.line49_excessTax'));
    return (primaryEarlyDist + primaryHsaExcess + spouseEarlyDist + spouseHsaExcess) > 0;
  },
};

/**
 * Line 17b — Additional 20% HSA tax from Form 8889 Line 17b
 *
 * *** CROSS-FORM AGGREGATION — PRIMARY + SPOUSE ***
 *
 * The 20% penalty on non-qualified HSA distributions.
 * When both spouses have HSAs, both penalties are combined here.
 *
 * Same pattern as Line 8 — primary is in formal dependencies,
 * spouse is read via safeNum() fallback.
 */
const line17b_hsaDistributionTax: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line17b_hsaDistributionTax`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule 2 Line 17b — Additional Tax on HSA Distributions (Form 8889)',
  description:        '20% additional tax on non-qualified HSA distributions. From Form 8889 Line 17b. Includes both spouses when applicable.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['penalty'],
  irsCitation:        { form: 'schedule2', line: '17b', ircSection: '223(f)(4)' },
  dependencies: [
    F8889_OUTPUTS.additionalTax,  // f8889.primary.line17b_additionalTax
  ],
  compute: (ctx) => {
    const primaryTax = safeNum(ctx.get(F8889_OUTPUTS.additionalTax));
    const spouseTax  = safeNum(ctx.get('f8889.spouse.line17b_additionalTax'));
    return primaryTax + spouseTax;
  },
  isApplicable: (ctx) => {
    const primaryTax = safeNum(ctx.get(F8889_OUTPUTS.additionalTax));
    const spouseTax  = safeNum(ctx.get('f8889.spouse.line17b_additionalTax'));
    return (primaryTax + spouseTax) > 0;
  },
};

/**
 * Line 44 — Total additional taxes (Part I total)
 *
 * The sum of ALL active Part I lines. This is what flows to
 * Form 1040 Line 17.
 *
 * CRITICAL AGGREGATION BEHAVIOR:
 * This node sums all lines — including ones that may be SKIPPED
 * or UNSUPPORTED. The safeNum() calls inside compute() ensure
 * that missing or inapplicable lines contribute 0, not null or NaN.
 *
 * This is the end of the chain we've been building:
 *   F8889 Line 17b → Schedule 2 Line 17b ──┐
 *   F5329 Line 4   → Schedule 2 Line 8  ──→→ Schedule 2 Line 44 → Form 1040 Line 17
 *   F5329 Line 49  → Schedule 2 Line 8  ──┘
 */
const line44_totalAdditionalTaxes: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line44_totalAdditionalTaxes`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule 2 Line 44 — Total Additional Taxes (Part I)',
  description:        'Sum of all Part I additional tax lines. Flows to Form 1040 Line 17. SKIPPED and unsupported lines contribute zero.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,

  // Not 'intermediate' — this flows to Form 1040 and is shown on the return
  classifications:    ['penalty'],
  irsCitation:        { form: 'schedule2', line: '44' },

  /**
   * Only formally depend on the implemented lines.
   * When new lines are added (AMT, premium credit repayment, etc.),
   * add them to this dependencies array and update the compute function.
   */
  dependencies: [
    `${FORM_ID}.joint.line3_subtotal`,
    `${FORM_ID}.joint.line8_additionalRetirementTax`,
    `${FORM_ID}.joint.line17b_hsaDistributionTax`,
  ],
  compute: (ctx) => {
    // Tolerant aggregation — every line uses safeNum()
    // SKIPPED lines (isApplicable = false) return null from ctx.get()
    // safeNum() converts null → 0, keeping the total valid
    const line3   = safeNum(ctx.get(`${FORM_ID}.joint.line3_subtotal`));
    const line8   = safeNum(ctx.get(`${FORM_ID}.joint.line8_additionalRetirementTax`));
    const line17b = safeNum(ctx.get(`${FORM_ID}.joint.line17b_hsaDistributionTax`));

    return line3 + line8 + line17b;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Schedule 2 node definitions.
 *
 * IMPORTANT: Must be registered with F8889_NODES and F5329_NODES together
 * because Schedule 2 depends on output nodes from both forms.
 *
 * Usage:
 *   engine.registerNodes([...F8889_NODES, ...F5329_NODES, ...SCHEDULE2_NODES]);
 */
export const SCHEDULE2_NODES: NodeDefinition[] = [
  line1_alternativeMinimumTax,
  line2_excessPremiumTaxCredit,
  line3_subtotal,
  line8_additionalRetirementTax,
  line17b_hsaDistributionTax,
  line44_totalAdditionalTaxes,
];

/**
 * Schedule 2 output node IDs that flow to Form 1040.
 * Form 1040 Line 17 = Schedule 2 Line 44.
 */
export const SCHEDULE2_OUTPUTS = {
  totalAdditionalTaxes: `${FORM_ID}.joint.line44_totalAdditionalTaxes`,
} as const;