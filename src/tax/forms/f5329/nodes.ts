/**
 * FORM 5329 — ADDITIONAL TAXES ON QUALIFIED PLANS (INCLUDING IRAs)
 * AND OTHER TAX-FAVORED ACCOUNTS
 *
 * Node definitions for:
 *   ✅ Part I   (Lines 1–6)   Early distributions from retirement plans
 *   ✅ Part VII (Lines 43–49) Excess HSA contributions
 *   🚧 Parts II–VI            Other early distribution exceptions (deferred)
 *   🚧 Part VIII              Excess Archer MSA contributions (deferred — obsolete)
 *   🚧 Part IX                RMD failure penalty (deferred — requires RMD calculation)
 *
 * CROSS-FORM DEPENDENCIES:
 *   Part VII reads from Form 8889:
 *     f8889.primary.line13_hsaDeduction  — the allowed HSA deduction
 *     f8889.primary.line2_personalContributions — what was actually contributed
 *     f8889.primary.line6_employerContributions — employer contributions
 *
 *   This is the first cross-form dependency in the graph.
 *   The engine resolves these by node ID — no special wiring needed.
 *
 * IRS References:
 *   Form 5329 Instructions (2025)
 *   IRC §72(t) — early distributions
 *   IRC §4973  — excess contributions to HSAs and other accounts
 */

import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from "../../../core/graph/node.types";
import type { NodeDefinition } from "../../../core/graph/node.types";

import { getF5329Constants } from "./constants/index";
import { F8889_OUTPUTS } from "../f8889/nodes";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED METADATA
// ─────────────────────────────────────────────────────────────────────────────

const APPLICABLE_YEARS = ["2024", "2025"];
const FORM_ID = "f5329";

// ─────────────────────────────────────────────────────────────────────────────
// PART I — EARLY DISTRIBUTIONS FROM QUALIFIED RETIREMENT PLANS
// Lines 1 through 6
//
// Applies when a taxpayer receives a distribution from a retirement plan
// before age 59½ and no exception applies.
//
// The 10% penalty applies to the TAXABLE portion of the distribution.
// Many exceptions exist (see exception codes below).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 1 — Early distributions included in income
 *
 * The total taxable amount of early retirement distributions
 * that are subject to the 10% penalty before exceptions.
 *
 * Source: Form 1099-R Box 2a (taxable amount).
 * If Box 2b "Taxable amount not determined" is checked, the preparer
 * must calculate the taxable portion manually.
 *
 * Note: NOT all of Box 1 (gross distribution) — only the taxable portion.
 */
const line1_earlyDistributions: NodeDefinition = {
  id: `${FORM_ID}.primary.line1_earlyDistributions`,
  kind: NodeKind.INPUT,
  label: "Form 5329 Line 1 — Early Distributions Included in Income",
  description:
    "Taxable amount of early distributions from qualified plans subject to the 10% penalty. From Form 1099-R Box 2a.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.other", "distribution.retirement"],
  source: InputSource.OCR,
  ocrMapping: {
    documentType: "1099-R",
    box: "2a",
    fieldName: "Taxable Amount",
  },
  questionId: "f5329.q.earlyDistributions",
  defaultValue: 0,
};

/**
 * Line 2 — Early distributions not subject to additional tax
 *
 * The portion of Line 1 that qualifies for an exception to the 10% penalty.
 * The taxpayer selects an exception code (see below).
 *
 * Common exception codes:
 *   01 — Substantially equal periodic payments (IRC §72(t)(2)(A)(iv))
 *   02 — Disability (IRC §72(m)(7))
 *   03 — Death of taxpayer
 *   04 — Medical expenses exceeding 7.5% of AGI
 *   05 — Distributions to an alternate payee under a QDRO
 *   06 — Health insurance premiums paid while unemployed
 *   07 — Higher education expenses
 *   08 — First-time home purchase (up to $10,000 lifetime, IRA only)
 *   09 — IRS levy
 *   10 — Qualified reservist distribution
 *   11 — Qualified birth or adoption (up to $5,000)
 *   12 — Other (attach explanation)
 *
 * 🚧 Exception code validation (ensuring the right amount for each code)
 *    is partially deferred. The node accepts any amount up to Line 1.
 */
const line2_exceptionAmount: NodeDefinition = {
  id: `${FORM_ID}.primary.line2_exceptionAmount`,
  kind: NodeKind.INPUT,
  label: "Form 5329 Line 2 — Exception to Early Distribution Penalty",
  description:
    "Amount from Line 1 that qualifies for an exception to the 10% penalty. Enter the exception code on Line 2.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["distribution.retirement", "intermediate"],
  source: InputSource.PREPARER,
  questionId: "f5329.q.exceptionAmount",
  defaultValue: 0,
};

/**
 * Line 2 — Exception code (companion to exception amount)
 *
 * The IRS exception code that justifies the exception amount.
 * Stored as a separate input node alongside the dollar amount.
 */
const line2_exceptionCode: NodeDefinition = {
  id: `${FORM_ID}.primary.line2_exceptionCode`,
  kind: NodeKind.INPUT,
  label: "Form 5329 Line 2 — Early Distribution Exception Code",
  description:
    "IRS exception code (01-12) for the early distribution exception. See Form 5329 instructions for the complete list.",
  valueType: NodeValueType.ENUM,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["distribution.retirement", "intermediate"],
  source: InputSource.PREPARER,
  questionId: "f5329.q.exceptionCode",
  defaultValue: "12",
  validation: {
    allowedValues: [
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
    ],
    message:
      "Exception code must be 01 through 12. See Form 5329 instructions.",
  },
};

/**
 * Line 3 — Amount subject to additional tax
 *
 * Line 1 minus Line 2: the portion of early distributions
 * that has no exception and is subject to the 10% penalty.
 */
const line3_amountSubjectToTax: NodeDefinition = {
  id: `${FORM_ID}.primary.line3_amountSubjectToTax`,
  kind: NodeKind.COMPUTED,
  label: "Form 5329 Line 3 — Amount Subject to 10% Additional Tax",
  description:
    "Early distributions minus exception amount (Line 1 - Line 2). This is what the 10% penalty is calculated on.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["distribution.retirement", "intermediate"],
  dependencies: [
    `${FORM_ID}.primary.line1_earlyDistributions`,
    `${FORM_ID}.primary.line2_exceptionAmount`,
  ],
  compute: (ctx) => {
    const line1 =
      (ctx.get(`${FORM_ID}.primary.line1_earlyDistributions`) as number) ?? 0;
    const line2 =
      (ctx.get(`${FORM_ID}.primary.line2_exceptionAmount`) as number) ?? 0;
    return Math.max(0, line1 - line2);
  },
};

/**
 * Line 4 — Additional 10% tax on early distributions
 *
 * 10% of Line 3. Fixed rate — does not change by year.
 * Flows to Schedule 2 Line 8.
 */
const line4_additionalTax: NodeDefinition = {
  id: `${FORM_ID}.primary.line4_additionalTax`,
  kind: NodeKind.COMPUTED,
  label: "Form 5329 Line 4 — 10% Additional Tax on Early Distributions",
  description:
    "10% of the amount on Line 3. Flows to Schedule 2 Line 8. No penalty if exception covers the full amount.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["penalty"],
  dependencies: [`${FORM_ID}.primary.line3_amountSubjectToTax`],
  compute: (ctx) => {
    const constants = getF5329Constants(ctx.taxYear);
    const line3 =
      (ctx.get(`${FORM_ID}.primary.line3_amountSubjectToTax`) as number) ?? 0;
    return (
      Math.round(line3 * constants.earlyDistributionPenaltyRate * 100) / 100
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PART VII — EXCESS HSA CONTRIBUTIONS (IRC §4973)
// Lines 43 through 49
//
// When a taxpayer contributes more to their HSA than they are allowed
// to deduct (as computed on Form 8889), the excess is subject to a
// 6% excise tax for each year it remains in the account uncorrected.
//
// KEY DEPENDENCY:
//   This part reads directly from Form 8889 nodes.
//   The engine resolves these cross-form dependencies by node ID.
//   No special wiring — the graph handles it automatically.
//
// HOW EXCESS IS CALCULATED:
//   Total contributions (personal + employer) MINUS the allowed deduction
//   = Excess for the year
//   Plus any prior-year excess carryforward (🚧 deferred)
//   Minus any excess withdrawn by tax filing deadline (🚧 deferred)
//   = Taxable excess subject to 6% penalty
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 43 — HSA excess contributions from prior year (carryforward)
 *
 * 🚧 UNSUPPORTED — requires prior-year Form 5329 data not yet modeled.
 * This node is defined so it appears in the UI as "not yet supported."
 * For now it always returns 0, meaning we only handle first-year excess.
 *
 * In a future release, this will read from the prior-year session's
 * f5329.primary.line49_additionalTax via a prior-year context.
 */
const line43_priorYearExcess: NodeDefinition = {
  id: `${FORM_ID}.primary.line43_priorYearExcess`,
  kind: NodeKind.INPUT,
  label: "Form 5329 Line 43 — Prior Year Excess HSA Contributions",
  description:
    "Excess HSA contributions carried forward from the prior year. From prior year Form 5329 Line 48.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  source: InputSource.PRIOR_YEAR,
  questionId: "f5329.q.priorYearExcess",
  defaultValue: 0,
  // Note: When this node has UNSUPPORTED status, the UI shows a note
  // directing the preparer to manually enter the value from prior year Form 5329.
};

/**
 * Line 44 — Total HSA contributions for the current year
 *
 * *** CROSS-FORM DEPENDENCY ***
 * This node reads from Form 8889:
 *   - f8889.primary.line2_personalContributions (personal contributions)
 *   - f8889.primary.line6_employerContributions (employer contributions)
 *
 * The engine resolves these automatically because they are declared
 * in the dependencies array as full node IDs.
 * No orchestrator, no special wiring — the graph finds them.
 *
 * Total = personal contributions + employer contributions
 * This is the gross amount going into the HSA before any deduction analysis.
 */
const line44_currentYearContributions: NodeDefinition = {
  id: `${FORM_ID}.primary.line44_currentYearContributions`,
  kind: NodeKind.COMPUTED,
  label: "Form 5329 Line 44 — Total HSA Contributions This Year",
  description:
    "Total HSA contributions for the year: personal (Form 8889 Line 2) plus employer (Form 8889 Line 6).",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],

  // ↓ Cross-form dependencies — engine resolves these from Form 8889's node registry
  dependencies: [
    F8889_OUTPUTS.hsaDeduction, // f8889.primary.line13_hsaDeduction
    "f8889.primary.line2_personalContributions",
    "f8889.primary.line6_employerContributions",
  ],
  compute: (ctx) => {
    const personalContributions =
      (ctx.get("f8889.primary.line2_personalContributions") as number) ?? 0;
    const employerContributions =
      (ctx.get("f8889.primary.line6_employerContributions") as number) ?? 0;
    return personalContributions + employerContributions;
  },
};

/**
 * Line 45 — Qualified HSA funding distributions included in Line 44
 *
 * IRA-to-HSA transfers (Form 8889 Line 11) that are included in
 * Line 44 and must be subtracted when calculating excess.
 * These are not counted as contributions for excess purposes.
 *
 * In most returns this is 0. Connects to Form 8889 Line 11.
 */
const line45_fundingDistributions: NodeDefinition = {
  id: `${FORM_ID}.primary.line45_fundingDistributions`,
  kind: NodeKind.COMPUTED,
  label: "Form 5329 Line 45 — Qualified HSA Funding Distributions",
  description:
    "IRA-to-HSA transfers from Form 8889 Line 11. These are excluded from the excess contribution calculation.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  dependencies: ["f8889.primary.line11_qualifiedFundingDistribution"],
  compute: (ctx) => {
    return (
      (ctx.get(
        "f8889.primary.line11_qualifiedFundingDistribution",
      ) as number) ?? 0
    );
  },
};

/**
 * Line 46 — Maximum HSA contribution allowed
 *
 * *** CROSS-FORM DEPENDENCY ***
 * The allowed deduction from Form 8889 Line 13.
 * This is the ceiling — anything above this is excess.
 *
 * Note the semantic distinction:
 *   Form 8889 Line 13 = the deduction the taxpayer is ALLOWED
 *   Form 5329 Line 46 = the contribution LIMIT for excess calculation
 *
 * They use the same value but for different purposes.
 * We read from F8889_OUTPUTS.hsaDeduction (the IRS-approved max).
 */
const line46_maximumAllowableContribution: NodeDefinition = {
  id: `${FORM_ID}.primary.line46_maximumAllowableContribution`,
  kind: NodeKind.COMPUTED,
  label: "Form 5329 Line 46 — Maximum Allowable HSA Contribution",
  description: `The annual HSA contribution limit including catch-up (Form 8889 Line 5).
    Per IRS Form 5329 Part VII instructions, Line 46 uses the ANNUAL LIMIT (Line 5),
    not the personal deduction (Line 13). Employer contributions within the limit
    do not create excess — only contributions exceeding the annual limit do.`,
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],

  // ↓ Cross-form dependency — reads from Form 8889 Line 5 (total annual limit)
  //   NOT Line 13 (personal deduction). This is the key distinction:
  //   excess is determined by whether TOTAL contributions exceed the ANNUAL LIMIT,
  //   not whether personal contributions exceed the adjusted deductible amount.
  dependencies: ["f8889.primary.line5_totalLimit"],
  compute: (ctx) => {
    return (ctx.get("f8889.primary.line5_totalLimit") as number) ?? 0;
  },
};

/**
 * Line 47 — Adjusted excess contributions
 *
 * Line 43 (prior year carryforward) + Line 44 (current year total)
 * - Line 45 (IRA funding distributions) - Line 46 (maximum allowed)
 *
 * This is the raw excess before any timely withdrawals.
 * Cannot go below zero — no negative excess.
 */
const line47_adjustedExcess: NodeDefinition = {
  id: `${FORM_ID}.primary.line47_adjustedExcess`,
  kind: NodeKind.COMPUTED,
  label: "Form 5329 Line 47 — Adjusted Excess HSA Contributions",
  description:
    "Prior year excess (Line 43) + current contributions (Line 44) - funding distributions (Line 45) - allowed amount (Line 46). Raw excess before timely withdrawals.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  dependencies: [
    `${FORM_ID}.primary.line43_priorYearExcess`,
    `${FORM_ID}.primary.line44_currentYearContributions`,
    `${FORM_ID}.primary.line45_fundingDistributions`,
    `${FORM_ID}.primary.line46_maximumAllowableContribution`,
  ],
  compute: (ctx) => {
    const line43 =
      (ctx.get(`${FORM_ID}.primary.line43_priorYearExcess`) as number) ?? 0;
    const line44 =
      (ctx.get(
        `${FORM_ID}.primary.line44_currentYearContributions`,
      ) as number) ?? 0;
    const line45 =
      (ctx.get(`${FORM_ID}.primary.line45_fundingDistributions`) as number) ??
      0;
    const line46 =
      (ctx.get(
        `${FORM_ID}.primary.line46_maximumAllowableContribution`,
      ) as number) ?? 0;
    return Math.max(0, line43 + line44 - line45 - line46);
  },
};

/**
 * Line 48 — Excess contributions withdrawn by tax deadline
 *
 * If the taxpayer withdraws excess contributions (plus earnings) by
 * the tax filing deadline (including extensions), those withdrawn amounts
 * are NOT subject to the 6% penalty.
 *
 * 🚧 Earnings on withdrawn excess: not yet modeled.
 *    For now, the preparer enters the withdrawn principal only.
 *    Earnings on withdrawn excess are handled separately on Form 1099-SA.
 */
const line48_excessWithdrawn: NodeDefinition = {
  id: `${FORM_ID}.primary.line48_excessWithdrawn`,
  kind: NodeKind.INPUT,
  label: "Form 5329 Line 48 — Excess HSA Contributions Withdrawn by Deadline",
  description:
    "Excess HSA contributions withdrawn (with earnings) by the tax filing deadline. These avoid the 6% penalty.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  source: InputSource.PREPARER,
  questionId: "f5329.q.excessWithdrawn",
  defaultValue: 0,
};

/**
 * Line 49 — Taxable excess subject to 6% penalty
 *
 * Line 47 minus Line 48: the excess that remains at year-end
 * and is subject to the 6% excise tax.
 *
 * This is the most important output of Part VII.
 * Flows to Schedule 2 Line 8 (combined with other Form 5329 penalties).
 *
 * This value carries forward to next year as Line 43 if not corrected.
 */
const line49_taxableExcess: NodeDefinition = {
  id: `${FORM_ID}.primary.line49_taxableExcess`,
  kind: NodeKind.COMPUTED,
  label:
    "Form 5329 Line 49 — Taxable Excess HSA Contributions (Subject to 6% Penalty)",
  description:
    "Excess contributions remaining after deadline withdrawals (Line 47 - Line 48). Subject to 6% excise tax. Carries forward to next year if not corrected.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  dependencies: [
    `${FORM_ID}.primary.line47_adjustedExcess`,
    `${FORM_ID}.primary.line48_excessWithdrawn`,
  ],
  compute: (ctx) => {
    const line47 =
      (ctx.get(`${FORM_ID}.primary.line47_adjustedExcess`) as number) ?? 0;
    const line48 =
      (ctx.get(`${FORM_ID}.primary.line48_excessWithdrawn`) as number) ?? 0;
    return Math.max(0, line47 - line48);
  },
};

/**
 * Line 49 tax — 6% excise tax on taxable excess
 *
 * 6% of Line 49. This is what actually flows to Schedule 2.
 * Computed separately from the taxable excess amount so both
 * values are available as distinct nodes.
 */
const line49_excessTax: NodeDefinition = {
  id: `${FORM_ID}.primary.line49_excessTax`,
  kind: NodeKind.COMPUTED,
  label: "Form 5329 Line 49 — 6% Excise Tax on Excess HSA Contributions",
  description:
    "6% of taxable excess contributions (Line 49 amount). Flows to Schedule 2.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["penalty"],
  dependencies: [`${FORM_ID}.primary.line49_taxableExcess`],
  compute: (ctx) => {
    const constants = getF5329Constants(ctx.taxYear);
    const taxableExcess =
      (ctx.get(`${FORM_ID}.primary.line49_taxableExcess`) as number) ?? 0;
    return (
      Math.round(
        taxableExcess * constants.hsaExcessContributionPenaltyRate * 100,
      ) / 100
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Form 5329 node definitions — Part I and Part VII.
 *
 * IMPORTANT: When registering with the engine, F8889_NODES must ALSO
 * be registered because Part VII depends on Form 8889 nodes.
 * The engine validates all declared dependencies at registerNodes() time
 * and will throw if any dependency node ID is not in the registry.
 *
 * Usage:
 *   engine.registerNodes([...F8889_NODES, ...F5329_NODES]);
 */
export const F5329_NODES: NodeDefinition[] = [
  // Part I — Early Distributions
  line1_earlyDistributions,
  line2_exceptionCode,
  line2_exceptionAmount,
  line3_amountSubjectToTax,
  line4_additionalTax,
  // Part VII — HSA Excess Contributions
  line43_priorYearExcess,
  line44_currentYearContributions,
  line45_fundingDistributions,
  line46_maximumAllowableContribution,
  line47_adjustedExcess,
  line48_excessWithdrawn,
  line49_taxableExcess,
  line49_excessTax,
];

/**
 * Output node IDs from Form 5329 that flow to other forms.
 * Schedule 2 will reference these.
 */
export const F5329_OUTPUTS = {
  earlyDistributionPenalty: `${FORM_ID}.primary.line4_additionalTax`,
  hsaExcessTax: `${FORM_ID}.primary.line49_excessTax`,
  hsaTaxableExcess: `${FORM_ID}.primary.line49_taxableExcess`,
} as const;
