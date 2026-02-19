/**
 * SCHEDULE 2 — ADDITIONAL TAXES
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Line 8   — Additional tax from Form 5329 (early dist + HSA excess, primary + spouse)
 *   ✅ Line 17b — Additional 20% HSA tax from Form 8889 (primary + spouse)
 *   ✅ Line 44  — Total additional taxes (Part I total)
 *   🚧 Line 1   — Alternative Minimum Tax (Form 6251)
 *   🚧 Line 2   — Excess advance premium tax credit (Form 8962)
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

const APPLICABLE_YEARS = ['2024', '2025'];
const FORM_ID          = 'schedule2';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART I — DEFERRED INPUT NODES
// ─────────────────────────────────────────────────────────────────────────────

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

const line2_excessPremiumTaxCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line2_excessPremiumTaxCredit`,
  kind: NodeKind.INPUT,
  label: "Schedule 2 Line 2 — Excess Advance Premium Tax Credit (Form 8962)",
  description:
    "Repayment of excess advance premium tax credit. Not yet supported.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["penalty"],
  irsCitation: { form: "schedule2", line: "2", ircSection: "36B" },
  source: "preparer" as any,
  questionId: "schedule2.q.premiumTaxCreditRepayment",
  defaultValue: 0,
};

const line3_subtotal: NodeDefinition = {
  id: `${FORM_ID}.joint.line3_subtotal`,
  kind: NodeKind.COMPUTED,
  label: "Schedule 2 Line 3 — Add Lines 1 and 2",
  description: "Sum of Line 1 (AMT) and Line 2 (excess premium credit).",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  irsCitation: { form: "schedule2", line: "3" },
  dependencies: [
    `${FORM_ID}.joint.line1_alternativeMinimumTax`,
    `${FORM_ID}.joint.line2_excessPremiumTaxCredit`,
  ],
  compute: (ctx) => {
    return (
      safeNum(ctx.get(`${FORM_ID}.joint.line1_alternativeMinimumTax`)) +
      safeNum(ctx.get(`${FORM_ID}.joint.line2_excessPremiumTaxCredit`))
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 8 — ADDITIONAL RETIREMENT/HSA TAX FROM FORM 5329
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 8 — Additional tax from Form 5329 (primary + spouse)
 *
 * All four F5329 output nodes are in the formal dependencies array.
 * The engine materializes spouse instances when hasSpouse = true.
 * ctx.get() returns null for missing instances → safeNum() → 0.
 */
const line8_additionalRetirementTax: NodeDefinition = {
  id: `${FORM_ID}.joint.line8_additionalRetirementTax`,
  kind: NodeKind.COMPUTED,
  label: "Schedule 2 Line 8 — Additional Tax on Retirement Plans (Form 5329)",
  description:
    "Total additional taxes from Form 5329: early distribution penalty and HSA excess contribution tax. Primary + spouse.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["penalty"],
  irsCitation: { form: "schedule2", line: "8", ircSection: "72(t)" },

  dependencies: [
    F5329_OUTPUTS.earlyDistributionPenalty, // f5329.primary.line4_additionalTax
    F5329_OUTPUTS.hsaExcessTax, // f5329.primary.line49_excessTax
    "f5329.spouse.line4_additionalTax", // materialized by engine when hasSpouse = true
    "f5329.spouse.line49_excessTax", // materialized by engine when hasSpouse = true
  ],

  compute: (ctx) => {
    const primaryEarlyDist = safeNum(
      ctx.get(F5329_OUTPUTS.earlyDistributionPenalty),
    );
    const primaryHsaExcess = safeNum(ctx.get(F5329_OUTPUTS.hsaExcessTax));
    const spouseEarlyDist = safeNum(
      ctx.get("f5329.spouse.line4_additionalTax"),
    );
    const spouseHsaExcess = safeNum(ctx.get("f5329.spouse.line49_excessTax"));
    return (
      primaryEarlyDist + primaryHsaExcess + spouseEarlyDist + spouseHsaExcess
    );
  },

  isApplicable: (ctx) => {
    const primaryEarlyDist = safeNum(
      ctx.get(F5329_OUTPUTS.earlyDistributionPenalty),
    );
    const primaryHsaExcess = safeNum(ctx.get(F5329_OUTPUTS.hsaExcessTax));
    const spouseEarlyDist = safeNum(
      ctx.get("f5329.spouse.line4_additionalTax"),
    );
    const spouseHsaExcess = safeNum(ctx.get("f5329.spouse.line49_excessTax"));
    return (
      primaryEarlyDist + primaryHsaExcess + spouseEarlyDist + spouseHsaExcess >
      0
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 17b — HSA DISTRIBUTION TAX FROM FORM 8889
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 17b — 20% HSA distribution tax (primary + spouse)
 *
 * Both F8889 additionalTax instance IDs are in the formal dependencies array.
 */
const line17b_hsaDistributionTax: NodeDefinition = {
  id: `${FORM_ID}.joint.line17b_hsaDistributionTax`,
  kind: NodeKind.COMPUTED,
  label:
    "Schedule 2 Line 17b — Additional Tax on HSA Distributions (Form 8889)",
  description:
    "20% additional tax on non-qualified HSA distributions. Primary + spouse.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["penalty"],
  irsCitation: { form: "schedule2", line: "17b", ircSection: "223(f)(4)" },

  dependencies: [
    F8889_OUTPUTS.additionalTax, // f8889.primary.line17b_additionalTax
    "f8889.spouse.line17b_additionalTax", // materialized by engine when hasSpouse = true
  ],

  compute: (ctx) => {
    const primaryTax = safeNum(ctx.get(F8889_OUTPUTS.additionalTax));
    const spouseTax = safeNum(ctx.get("f8889.spouse.line17b_additionalTax"));
    return primaryTax + spouseTax;
  },

  isApplicable: (ctx) => {
    const primaryTax = safeNum(ctx.get(F8889_OUTPUTS.additionalTax));
    const spouseTax = safeNum(ctx.get("f8889.spouse.line17b_additionalTax"));
    return primaryTax + spouseTax > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 44 — TOTAL ADDITIONAL TAXES
// ─────────────────────────────────────────────────────────────────────────────

const line44_totalAdditionalTaxes: NodeDefinition = {
  id: `${FORM_ID}.joint.line44_totalAdditionalTaxes`,
  kind: NodeKind.COMPUTED,
  label: "Schedule 2 Line 44 — Total Additional Taxes (Part I)",
  description:
    "Sum of all Part I additional tax lines. Flows to Form 1040 Line 17.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["penalty"],
  irsCitation: { form: "schedule2", line: "44" },

  dependencies: [
    `${FORM_ID}.joint.line3_subtotal`,
    `${FORM_ID}.joint.line8_additionalRetirementTax`,
    `${FORM_ID}.joint.line17b_hsaDistributionTax`,
  ],

  compute: (ctx) => {
    const line3 = safeNum(ctx.get(`${FORM_ID}.joint.line3_subtotal`));
    const line8 = safeNum(
      ctx.get(`${FORM_ID}.joint.line8_additionalRetirementTax`),
    );
    const line17b = safeNum(
      ctx.get(`${FORM_ID}.joint.line17b_hsaDistributionTax`),
    );
    return line3 + line8 + line17b;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEDULE2_NODES: NodeDefinition[] = [
  line1_alternativeMinimumTax,
  line2_excessPremiumTaxCredit,
  line3_subtotal,
  line8_additionalRetirementTax,
  line17b_hsaDistributionTax,
  line44_totalAdditionalTaxes,
];

export const SCHEDULE2_OUTPUTS = {
  totalAdditionalTaxes: `${FORM_ID}.joint.line44_totalAdditionalTaxes`,
} as const;