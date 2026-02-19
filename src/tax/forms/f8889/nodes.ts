/**
 * FORM 8889 — HEALTH SAVINGS ACCOUNTS (HSAs)
 * Node definitions for Part I (Contributions and Deduction)
 * and Part II (Distributions)
 *
 * IRS Form 8889 (2025 instructions)
 * IRC Section 223
 * IRS Publication 969
 *
 * Naming convention:
 *   Node IDs: f8889.{owner}.{lineId}
 *   Line IDs: line{N}_{camelCaseDescription}
 *
 * Owner for Part I nodes:
 *   REPEATABLE = true means the session creates one instance per filer.
 *   The primary filer is always instantiated.
 *   The spouse instance is created only when hasSpouse = true AND
 *   the spouse had their own HDHP coverage with a separate HSA.
 *
 *   Joint nodes (owner: JOINT) represent household-level aggregations
 *   that combine primary + spouse values onto the Schedule 1 line.
 *
 * What is implemented (✅) vs deferred (🚧):
 *   ✅ Part I  Lines 1–13   HSA contributions and deduction
 *   ✅ Part II Lines 14–17b HSA distributions and penalty
 *   🚧 Part III             Testing period (HDHP coverage failure) — deferred
 *                           Requires prior-year carryforward data not yet modeled
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {

  NodeKind,
  NodeOwner,
  NodeStatus,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import { getF8889Constants } from './constants/index';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED METADATA
// ─────────────────────────────────────────────────────────────────────────────

const APPLICABLE_YEARS = ['2024', '2025'];

const FORM_ID = 'f8889';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the filer's age as of December 31 of the tax year.
 * Used for catch-up contribution and penalty exemption calculations.
 *
 * In the real session, dateOfBirth comes from the FilerIdentity.
 * For now, compute functions read it from a dedicated input node.
 * Future: the engine context will expose filer age directly.
 */
function ageAsOfDec31(dateOfBirth: string, taxYear: string): number {
  const dob    = new Date(dateOfBirth);
  const dec31  = new Date(`${taxYear}-12-31`);
  let age      = dec31.getFullYear() - dob.getFullYear();
  const hasBirthdayPassedByDec31 =
    dec31.getMonth() > dob.getMonth() ||
    (dec31.getMonth() === dob.getMonth() && dec31.getDate() >= dob.getDate());
  if (!hasBirthdayPassedByDec31) age--;
  return age;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART I — CONTRIBUTIONS AND DEDUCTION
// Lines 1 through 13
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 1 — HDHP coverage type
 *
 * The taxpayer selects whether they had self-only or family HDHP coverage.
 * This drives the annual contribution limit on Line 3.
 *
 * Values: 'self_only' | 'family'
 * Source: Preparer asks the taxpayer. Also visible on Form W-2 Box 12 Code W
 *         description or the taxpayer's HSA account statements.
 */
const line1_coverageType: NodeDefinition = {
  id: `${FORM_ID}.primary.line1_coverageType`,
  kind: NodeKind.INPUT,
  label: "Form 8889 Line 1 — HDHP Coverage Type",
  description:
    "Whether the taxpayer had self-only or family HDHP coverage during the tax year.",
  valueType: NodeValueType.ENUM,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa"],
  source: InputSource.PREPARER,
  questionId: "f8889.q.coverageType",
  defaultValue: "self_only",
  validation: {
    allowedValues: ["self_only", "family"],
    message: "Coverage type must be either self_only or family.",
  },
};

/**
 * Line 2 — HSA contributions made by the taxpayer (and family members)
 *
 * Personal contributions made directly to the HSA by the taxpayer,
 * their employer on their behalf, or any other person EXCEPT the employer.
 * Does NOT include employer contributions — those go on Line 9.
 *
 * Source: Taxpayer's HSA account statement — "employee/personal contributions"
 * Note:   Pre-tax payroll deductions ARE personal contributions (not employer).
 *         Only Box 12 Code W on W-2 is employer contributions.
 */
const line2_personalContributions: NodeDefinition = {
  id: `${FORM_ID}.primary.line2_personalContributions`,
  kind: NodeKind.INPUT,
  label: "Form 8889 Line 2 — Personal HSA Contributions",
  description:
    "Total HSA contributions made by the taxpayer (and anyone except their employer). Includes payroll deductions taken pre-tax.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "deduction.above_the_line"],
  source: InputSource.PREPARER,
  questionId: "f8889.q.personalContributions",
  defaultValue: 0,
};

/**
 * Line 3 — Annual contribution limit based on coverage type
 *
 * The IRS annual HSA contribution limit for the coverage type selected on Line 1.
 * Computed from the tax-year constants — never hardcoded.
 *
 * 2025: Self-only = $4,300 | Family = $8,550
 * 2024: Self-only = $4,150 | Family = $8,300
 */
const line3_annualContributionLimit: NodeDefinition = {
  id: `${FORM_ID}.primary.line3_annualContributionLimit`,
  kind: NodeKind.COMPUTED,
  label: "Form 8889 Line 3 — Annual HSA Contribution Limit",
  description:
    "IRS annual HSA contribution limit based on coverage type and tax year.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  dependencies: [`${FORM_ID}.primary.line1_coverageType`],
  compute: (ctx) => {
    const constants = getF8889Constants(ctx.taxYear);
    const coverageType =
      (ctx.get(`${FORM_ID}.primary.line1_coverageType`) as string) ??
      "self_only";
    return coverageType === "family"
      ? constants.annualContributionLimit.family
      : constants.annualContributionLimit.selfOnly;
  },
};

/**
 * Line 4 — Additional contribution limit for age 55+
 *
 * Taxpayers who are 55 or older by December 31 of the tax year
 * may contribute an additional $1,000 (catch-up contribution).
 * This $1,000 is NOT inflation-adjusted.
 *
 * Input: the taxpayer's age as of Dec 31 (derived from FilerIdentity.dateOfBirth).
 * For now this is a separate input node. When FilerIdentity is wired into the
 * engine context, this becomes a computed node reading from context.
 *
 * Source: Automatic — derived from taxpayer's date of birth.
 */
const line4_additionalCatchUpContribution: NodeDefinition = {
  id: `${FORM_ID}.primary.line4_additionalCatchUpContribution`,
  kind: NodeKind.COMPUTED,
  label: "Form 8889 Line 4 — Additional Catch-Up Contribution (Age 55+)",
  description:
    "Additional $1,000 allowed for taxpayers who are 55 or older by December 31 of the tax year.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  dependencies: [`${FORM_ID}.primary.line4input_ageAsOfDec31`],
  compute: (ctx) => {
    const constants = getF8889Constants(ctx.taxYear);
    const age =
      (ctx.get(`${FORM_ID}.primary.line4input_ageAsOfDec31`) as number) ?? 0;
    return age >= constants.catchUpEligibleAge
      ? constants.catchUpContributionLimit
      : 0;
  },
};

/**
 * Line 4 input — Taxpayer's age as of December 31
 *
 * Helper input node. In the future this will be derived from
 * FilerIdentity.dateOfBirth through the engine context.
 * For now the preparer enters the taxpayer's age.
 */
const line4input_ageAsOfDec31: NodeDefinition = {
  id: `${FORM_ID}.primary.line4input_ageAsOfDec31`,
  kind: NodeKind.INPUT,
  label: "Taxpayer Age as of December 31",
  description:
    "Taxpayer age as of December 31 of the tax year. Used to determine catch-up contribution eligibility.",
  valueType: NodeValueType.INTEGER,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  source: InputSource.PREPARER,
  questionId: "f8889.q.ageAsOfDec31",
  defaultValue: 0,
  validation: { min: 0, max: 130 },
};

/**
 * Line 5 — Total limit (Line 3 + Line 4)
 *
 * The taxpayer's total allowable HSA contribution for the year,
 * combining the annual limit with any catch-up contribution.
 *
 * 2025 example: Self-only age 57 → $4,300 + $1,000 = $5,300
 */
const line5_totalLimit: NodeDefinition = {
  id: `${FORM_ID}.primary.line5_totalLimit`,
  kind: NodeKind.COMPUTED,
  label: "Form 8889 Line 5 — Total HSA Contribution Limit",
  description:
    "Annual contribution limit (Line 3) plus catch-up contribution if age 55+ (Line 4).",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  dependencies: [
    `${FORM_ID}.primary.line3_annualContributionLimit`,
    `${FORM_ID}.primary.line4_additionalCatchUpContribution`,
  ],
  compute: (ctx) => {
    const line3 =
      (ctx.get(`${FORM_ID}.primary.line3_annualContributionLimit`) as number) ??
      0;
    const line4 =
      (ctx.get(
        `${FORM_ID}.primary.line4_additionalCatchUpContribution`,
      ) as number) ?? 0;
    return line3 + line4;
  },
};

/**
 * Lines 6–8: Employer contributions (W-2 Box 12 Code W)
 * and MSA contributions — these reduce the deductible limit.
 *
 * Line 6  — Employer contributions (from W-2 Box 12 Code W)
 * Line 7  — Qualified HSA funding distributions from an IRA (rare)
 * Line 8  — Reserved for worksheet (Part III testing period — 🚧 UNSUPPORTED)
 *
 * We implement Line 6 (employer contributions) and line 7 as zero (unsupported).
 * Line 8 (testing period worksheet) is deferred — marked UNSUPPORTED.
 */
const line6_employerContributions: NodeDefinition = {
  id: `${FORM_ID}.primary.line6_employerContributions`,
  kind: NodeKind.INPUT,
  label: "Form 8889 Line 6 — Employer HSA Contributions (W-2 Box 12 Code W)",
  description:
    "Employer contributions to the taxpayer's HSA shown in Box 12 Code W of Form W-2. Also includes any employer contributions to an Archer MSA.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  source: InputSource.OCR,
  ocrMapping: { documentType: "W-2", box: "12", fieldName: "Code W" },
  questionId: "f8889.q.employerContributions",
  defaultValue: 0,
};

/**
 * Line 9 — Employer contributions on Line 6 (pass-through for worksheet)
 * Per IRS instructions, Line 9 = Line 6 in most cases.
 * The distinction exists for the testing period worksheet — deferred.
 */
const line9_employerContributionsAdjusted: NodeDefinition = {
  id: `${FORM_ID}.primary.line9_employerContributionsAdjusted`,
  kind: NodeKind.COMPUTED,
  label: "Form 8889 Line 9 — Employer Contributions (Adjusted)",
  description:
    "Employer contributions from Line 6, adjusted for testing period (Part III). Currently equals Line 6 directly.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  dependencies: [`${FORM_ID}.primary.line6_employerContributions`],
  compute: (ctx) => {
    // Line 9 = Line 6 when Part III (testing period) is not applicable.
    // Part III is 🚧 UNSUPPORTED — this is correct for the vast majority of filers.
    return (
      (ctx.get(`${FORM_ID}.primary.line6_employerContributions`) as number) ?? 0
    );
  },
};

/**
 * Line 10 — Adjusted annual contribution limit
 *
 * Line 5 minus Line 9: the maximum the taxpayer can personally deduct.
 * Employer contributions eat into the deductible limit.
 * Cannot go below zero — IRS says enter -0- if line 9 > line 5.
 */
const line10_adjustedContributionLimit: NodeDefinition = {
  id: `${FORM_ID}.primary.line10_adjustedContributionLimit`,
  kind: NodeKind.COMPUTED,
  label: "Form 8889 Line 10 — Adjusted Annual Contribution Limit",
  description:
    "Maximum personal HSA deduction allowed: Line 5 minus Line 9. Cannot be less than zero.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  dependencies: [
    `${FORM_ID}.primary.line5_totalLimit`,
    `${FORM_ID}.primary.line9_employerContributionsAdjusted`,
  ],
  compute: (ctx) => {
    const line5 =
      (ctx.get(`${FORM_ID}.primary.line5_totalLimit`) as number) ?? 0;
    const line9 =
      (ctx.get(
        `${FORM_ID}.primary.line9_employerContributionsAdjusted`,
      ) as number) ?? 0;
    return Math.max(0, line5 - line9);
  },
};

/**
 * Line 11 — Qualified HSA funding distribution (IRA to HSA transfer)
 *
 * A one-time-per-lifetime transfer from a traditional or Roth IRA to an HSA.
 * Not deductible — reduces the allowable contribution on Line 12.
 * Very uncommon. Deferred for now but node is defined.
 *
 * 🚧 UNSUPPORTED — node exists, always returns 0, UI shows unsupportedNote.
 */
const line11_qualifiedFundingDistribution: NodeDefinition = {
  id: `${FORM_ID}.primary.line11_qualifiedFundingDistribution`,
  kind: NodeKind.INPUT,
  label: "Form 8889 Line 11 — Qualified HSA Funding Distribution (IRA to HSA)",
  description:
    "One-time IRA-to-HSA transfer. Reduces contribution limit but not deductible. Rare — most filers enter 0.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  source: InputSource.PREPARER,
  questionId: "f8889.q.qualifiedFundingDistribution",
  defaultValue: 0,
  // Note: when the UI encounters this node with UNSUPPORTED status,
  // it shows the unsupportedNote to the preparer.
};

/**
 * Line 12 — Maximum deductible personal contribution
 *
 * Line 10 minus Line 11: the hard ceiling on the personal deduction.
 */
const line12_maxPersonalContribution: NodeDefinition = {
  id: `${FORM_ID}.primary.line12_maxPersonalContribution`,
  kind: NodeKind.COMPUTED,
  label: "Form 8889 Line 12 — Maximum Deductible Personal Contribution",
  description:
    "Adjusted annual limit (Line 10) minus qualified IRA funding distribution (Line 11). This is the most the taxpayer can deduct.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["contribution.hsa", "intermediate"],
  dependencies: [
    `${FORM_ID}.primary.line10_adjustedContributionLimit`,
    `${FORM_ID}.primary.line11_qualifiedFundingDistribution`,
  ],
  compute: (ctx) => {
    const line10 =
      (ctx.get(
        `${FORM_ID}.primary.line10_adjustedContributionLimit`,
      ) as number) ?? 0;
    const line11 =
      (ctx.get(
        `${FORM_ID}.primary.line11_qualifiedFundingDistribution`,
      ) as number) ?? 0;
    return Math.max(0, line10 - line11);
  },
};

/**
 * Line 13 — HSA Deduction
 *
 * The smaller of Line 2 (what the taxpayer actually contributed personally)
 * and Line 12 (the maximum they are allowed to deduct).
 *
 * This is THE deduction that flows to Schedule 1 Line 13,
 * which reduces the taxpayer's AGI.
 *
 * This is the most important output of Form 8889 Part I.
 */
const line13_hsaDeduction: NodeDefinition = {
  id: `${FORM_ID}.primary.line13_hsaDeduction`,
  kind: NodeKind.COMPUTED,
  label: "Form 8889 Line 13 — HSA Deduction",
  description:
    "The HSA deduction allowed: lesser of personal contributions (Line 2) and the maximum allowed contribution (Line 12). Flows to Schedule 1 Line 13.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["deduction.above_the_line", "contribution.hsa"],
  dependencies: [
    `${FORM_ID}.primary.line2_personalContributions`,
    `${FORM_ID}.primary.line12_maxPersonalContribution`,
  ],
  compute: (ctx) => {
    const line2 =
      (ctx.get(`${FORM_ID}.primary.line2_personalContributions`) as number) ??
      0;
    const line12 =
      (ctx.get(
        `${FORM_ID}.primary.line12_maxPersonalContribution`,
      ) as number) ?? 0;
    return Math.min(line2, line12);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PART II — DISTRIBUTIONS
// Lines 14 through 17b
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 14a — Total HSA distributions (Form 1099-SA Box 1)
 *
 * The total amount distributed from the taxpayer's HSA during the year.
 * Source: Form 1099-SA Box 1 — extracted via OCR.
 * Includes qualified AND non-qualified distributions.
 */
const line14a_totalDistributions: NodeDefinition = {
  id: `${FORM_ID}.primary.line14a_totalDistributions`,
  kind: NodeKind.INPUT,
  label: "Form 8889 Line 14a — Total HSA Distributions (1099-SA Box 1)",
  description:
    "Total amount distributed from the HSA during the year, as shown on Form 1099-SA Box 1.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["distribution.hsa"],
  source: InputSource.OCR,
  ocrMapping: {
    documentType: "1099-SA",
    box: "1",
    fieldName: "Gross Distribution",
  },
  questionId: "f8889.q.totalDistributions",
  defaultValue: 0,
};

/**
 * Line 14b — Distributions rolled over
 *
 * Distributions rolled over to another HSA within 60 days.
 * These are not taxable. Reduces the includible amount on Line 15.
 * Source: Preparer — derived from Form 1099-SA Box 4.
 */
const line14b_rolloverDistributions: NodeDefinition = {
  id: `${FORM_ID}.primary.line14b_rolloverDistributions`,
  kind: NodeKind.INPUT,
  label: "Form 8889 Line 14b — HSA Rollover Distributions",
  description:
    "Distributions rolled over to another HSA within 60 days. Shown on Form 1099-SA Box 4.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["distribution.hsa", "intermediate"],
  source: InputSource.OCR,
  ocrMapping: {
    documentType: "1099-SA",
    box: "4",
    fieldName: "Rollover Contributions",
  },
  questionId: "f8889.q.rolloverDistributions",
  defaultValue: 0,
};

/**
 * Line 15 — Distributions includible in income
 *
 * Line 14a minus Line 14b: the net distribution before qualified expense reduction.
 * This is what might be includible in gross income.
 */
const line15_includibleDistributions: NodeDefinition = {
  id: `${FORM_ID}.primary.line15_includibleDistributions`,
  kind: NodeKind.COMPUTED,
  label: "Form 8889 Line 15 — Distributions Includible in Income",
  description:
    "Total distributions (Line 14a) minus rollovers (Line 14b). Net amount subject to qualified expense reduction.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["distribution.hsa", "intermediate"],
  dependencies: [
    `${FORM_ID}.primary.line14a_totalDistributions`,
    `${FORM_ID}.primary.line14b_rolloverDistributions`,
  ],
  compute: (ctx) => {
    const line14a =
      (ctx.get(`${FORM_ID}.primary.line14a_totalDistributions`) as number) ?? 0;
    const line14b =
      (ctx.get(`${FORM_ID}.primary.line14b_rolloverDistributions`) as number) ??
      0;
    return Math.max(0, line14a - line14b);
  },
};

/**
 * Line 16 — Qualified medical expenses paid from HSA
 *
 * The amount of qualified medical expenses paid using HSA funds.
 * This is what makes distributions tax-free.
 * Source: Preparer — the taxpayer's records of qualified expenses.
 *
 * Note: The IRS does not require receipts with the return, but
 * the taxpayer must keep records in case of audit.
 */
const line16_qualifiedMedicalExpenses: NodeDefinition = {
  id: `${FORM_ID}.primary.line16_qualifiedMedicalExpenses`,
  kind: NodeKind.INPUT,
  label: "Form 8889 Line 16 — Qualified Medical Expenses Paid from HSA",
  description:
    "Qualified medical expenses paid using HSA funds during the tax year. These make distributions tax-free up to this amount.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["distribution.hsa"],
  source: InputSource.PREPARER,
  questionId: "f8889.q.qualifiedMedicalExpenses",
  defaultValue: 0,
};

/**
 * Line 17a — Non-qualified distributions includible in gross income
 *
 * Line 15 minus Line 16 — the amount of HSA distributions that were NOT
 * used for qualified medical expenses.
 * This amount is includible in gross income AND subject to the 20% penalty.
 * Cannot go below zero.
 */
const line17a_nonQualifiedDistributions: NodeDefinition = {
  id: `${FORM_ID}.primary.line17a_nonQualifiedDistributions`,
  kind: NodeKind.COMPUTED,
  label: "Form 8889 Line 17a — Non-Qualified HSA Distributions (Taxable)",
  description:
    "Distributions not used for qualified expenses (Line 15 - Line 16). Includible in gross income. Subject to 20% penalty unless exception applies.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.other", "distribution.hsa"],
  dependencies: [
    `${FORM_ID}.primary.line15_includibleDistributions`,
    `${FORM_ID}.primary.line16_qualifiedMedicalExpenses`,
  ],
  compute: (ctx) => {
    const line15 =
      (ctx.get(
        `${FORM_ID}.primary.line15_includibleDistributions`,
      ) as number) ?? 0;
    const line16 =
      (ctx.get(
        `${FORM_ID}.primary.line16_qualifiedMedicalExpenses`,
      ) as number) ?? 0;
    return Math.max(0, line15 - line16);
  },
};

/**
 * Line 17b — Additional 20% tax on non-qualified distributions
 *
 * 20% of Line 17a — the penalty for using HSA funds for non-medical expenses.
 * The penalty is WAIVED (set to 0) if the taxpayer:
 *   - Is age 65 or older as of December 31
 *   - Is disabled (as defined by IRC §72(m)(7))
 *   - Is deceased
 *
 * We check age via line4input_ageAsOfDec31.
 * Disability exception: input node (line17b_input_isDisabled).
 *
 * This flows to Schedule 2 Line 17b.
 */
const line17b_additionalTax: NodeDefinition = {
  id: `${FORM_ID}.primary.line17b_additionalTax`,
  kind: NodeKind.COMPUTED,
  label:
    "Form 8889 Line 17b — Additional 20% Tax on Non-Qualified Distributions",
  description:
    "20% of non-qualified distributions (Line 17a). Waived if age 65+, disabled, or deceased. Flows to Schedule 2.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["penalty"],
  dependencies: [
    `${FORM_ID}.primary.line17a_nonQualifiedDistributions`,
    `${FORM_ID}.primary.line4input_ageAsOfDec31`,
    `${FORM_ID}.primary.line17b_input_isDisabled`,
  ],
  compute: (ctx) => {
    const constants = getF8889Constants(ctx.taxYear);
    const line17a =
      (ctx.get(
        `${FORM_ID}.primary.line17a_nonQualifiedDistributions`,
      ) as number) ?? 0;
    const age =
      (ctx.get(`${FORM_ID}.primary.line4input_ageAsOfDec31`) as number) ?? 0;
    const isDisabled =
      (ctx.get(`${FORM_ID}.primary.line17b_input_isDisabled`) as boolean) ??
      false;

    // Penalty is waived at age 65+ or disability
    const penaltyWaived = age >= constants.penaltyExemptAge || isDisabled;
    if (penaltyWaived) return 0;

    return (
      Math.round(
        line17a * constants.nonQualifiedDistributionPenaltyRate * 100,
      ) / 100
    );
  },
};

/**
 * Line 17b input — Is the taxpayer disabled?
 *
 * Disability exception to the 20% HSA penalty (IRC §72(m)(7)).
 * The taxpayer qualifies if they are unable to engage in any
 * substantial gainful activity due to a medically determinable
 * physical or mental impairment expected to result in death or
 * last at least 12 months.
 */
const line17b_input_isDisabled: NodeDefinition = {
  id: `${FORM_ID}.primary.line17b_input_isDisabled`,
  kind: NodeKind.INPUT,
  label: "Is Taxpayer Disabled? (HSA Penalty Exception)",
  description:
    "Whether the taxpayer qualifies as disabled under IRC §72(m)(7). Waives the 20% penalty on non-qualified HSA distributions.",
  valueType: NodeValueType.BOOLEAN,
  owner: NodeOwner.PRIMARY,
  repeatable: true,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  source: InputSource.PREPARER,
  questionId: "f8889.q.isDisabled",
  defaultValue: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// PART III — TESTING PERIOD (HDHP COVERAGE FAILURE)
// 🚧 UNSUPPORTED — deferred
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Part III handles the situation where a taxpayer used the last-month rule
 * to maximize their HSA contribution but then lost HDHP coverage before
 * December 31 of the following year (the testing period).
 *
 * This requires prior-year carryforward data that is not yet modeled
 * in the session architecture. Deferred to a future release.
 *
 * Node definitions will be added here when implemented.
 * The UNSUPPORTED status will be set in the session initializer for these nodes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Form 8889 node definitions.
 * Register these with the engine via engine.registerNodes(F8889_NODES).
 *
 * Note on ordering: the engine does its own topological sort,
 * so order here doesn't matter for correctness.
 * We list them in IRS line order for readability.
 */
export const F8889_NODES: NodeDefinition[] = [
  // Part I — Contributions
  line1_coverageType,
  line2_personalContributions,
  line3_annualContributionLimit,
  line4input_ageAsOfDec31,
  line4_additionalCatchUpContribution,
  line5_totalLimit,
  line6_employerContributions,
  line9_employerContributionsAdjusted,
  line10_adjustedContributionLimit,
  line11_qualifiedFundingDistribution,
  line12_maxPersonalContribution,
  line13_hsaDeduction,
  // Part II — Distributions
  line14a_totalDistributions,
  line14b_rolloverDistributions,
  line15_includibleDistributions,
  line16_qualifiedMedicalExpenses,
  line17a_nonQualifiedDistributions,
  line17b_input_isDisabled,
  line17b_additionalTax,
];

/**
 * The node IDs that produce values flowing to other forms.
 * Used by the registry to wire cross-form dependencies.
 *
 * line13_hsaDeduction  → Schedule 1 Line 13
 * line17a              → Form 1040 (other income, small amounts)
 * line17b_additionalTax → Schedule 2 Line 17b
 */
export const F8889_OUTPUTS = {
  hsaDeduction:              `${FORM_ID}.primary.line13_hsaDeduction`,
  nonQualifiedDistributions: `${FORM_ID}.primary.line17a_nonQualifiedDistributions`,
  additionalTax:             `${FORM_ID}.primary.line17b_additionalTax`,
} as const;