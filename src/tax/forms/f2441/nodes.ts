/**
 * FORM 2441 — CHILD AND DEPENDENT CARE EXPENSES
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   Part I  — Care provider info (metadata only, no computed nodes needed)
 *   Part II — Credit Calculation
 *   ✅ Line 3  — Qualifying care expenses (input, capped at per-person limit)
 *   ✅ Line 4  — Earned income (primary filer, from F1040 W-2 wages)
 *   ✅ Line 5  — Earned income (spouse, input — required for MFJ)
 *   ✅ Line 6  — Qualified expense base (min of line 3, 4, 5)
 *   ✅ Line 7  — AGI (from F1040 Line 11)
 *   ✅ Line 8  — Credit rate decimal (AGI lookup table)
 *   ✅ Line 9a — Tentative credit (line 6 × line 8)
 *   ✅ Line 10 — Tax liability limit (from F1040 total tax)
 *   ✅ Line 11 — Credit (min of line 9a and line 10) → Schedule 3 Line 2
 *
 *   Part III — Dependent Care Benefits (W-2 Box 10)
 *   ✅ Line 12 — Employer-provided dependent care benefits (input, W-2 Box 10)
 *   ✅ Line 25 — Benefits excluded from income (min of benefits vs FSA limit)
 *   🚧 Lines 13–24, 26–31 — Full FSA carryover/forfeiture logic (deferred)
 *      The full Part III is only needed when employer-provided benefits
 *      AND carryovers/forfeitures exist. For most filers: benefits reduce
 *      the expense base and that's it.
 *
 * KEY DESIGN DECISIONS:
 *   1. Number of qualifying persons is an INPUT (line 2 count).
 *      It drives the expense cap ($3,000 vs $6,000) but is not
 *      a separate line node — it's the qualifying persons count input.
 *
 *   2. Spouse earned income is an INPUT. The IRS requires both spouses
 *      to have earned income (or be a student/disabled). For student/disabled
 *      spouses, a deemed income of $250/month (1 person) or $500/month
 *      (2+ persons) applies. The "student/disabled" override is an input.
 *
 *   3. The credit is NONREFUNDABLE — it cannot reduce tax below zero.
 *      This cap is enforced in line 10 / line 11.
 *
 * IRS References:
 *   Form 2441 Instructions (2025) — IRS.gov/instructions/i2441
 *   IRC Section 21
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import {
  getF2441Constants,
  getCreditRate,
  getExpenseCap,
} from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f2441';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Number of qualifying persons receiving care.
 * Drives the expense cap: 1 → $3,000 cap; 2+ → $6,000 cap.
 */
const line2_numQualifyingPersons: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line2_numQualifyingPersons`,
  kind:               NodeKind.INPUT,
  label:              'Form 2441 Line 2 — Number of Qualifying Persons',
  description:        'Count of qualifying persons for whom care was provided (children under 13, disabled spouse, or disabled dependent).',
  valueType:          NodeValueType.INTEGER,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f2441.q.numQualifyingPersons',
  defaultValue:       0,
  validation:         { min: 0, max: 10 },
};

/**
 * Line 3 — Total qualifying care expenses paid in 2025.
 * Preparer enters the actual amount paid; engine applies the cap in line 6.
 */
const line3_qualifyingExpenses: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line3_qualifyingExpenses`,
  kind:               NodeKind.INPUT,
  label:              'Form 2441 Line 3 — Qualifying Care Expenses Paid',
  description:        'Total amount paid in 2025 for qualifying child/dependent care. The engine applies the $3,000 (one person) or $6,000 (two or more) cap automatically.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f2441.q.qualifyingExpenses',
  defaultValue:       0,
};

/**
 * Line 5 — Spouse earned income.
 *
 * For MFJ returns, both spouses must have earned income (or be
 * student/disabled). The credit cannot exceed the lower-earning spouse's
 * income. For student/disabled spouses, use deemed income ($250 or $500/month).
 *
 * For single/HoH filers this defaults to the primary earned income
 * (no spouse limitation applies).
 */
const line5_spouseEarnedIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line5_spouseEarnedIncome`,
  kind:               NodeKind.INPUT,
  label:              'Form 2441 Line 5 — Spouse Earned Income',
  description:        'Spouse earned income for 2025. Required for MFJ returns — credit cannot exceed the lower-earning spouse. For student or disabled spouses, enter deemed income ($250/month for 1 qualifying person, $500/month for 2+). Single/HoH filers: leave at 0.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f2441.q.spouseEarnedIncome',
  defaultValue:       0,
};

/**
 * Line 12 — Employer-provided dependent care benefits (W-2 Box 10).
 * These reduce the expense base available for the credit.
 * Most filers: $0. FSA participants: up to $5,000.
 */
const line12_employerBenefits: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12_employerBenefits`,
  kind:               NodeKind.INPUT,
  label:              'Form 2441 Line 12 — Employer-Provided Dependent Care Benefits (W-2 Box 10)',
  description:        'Dependent care benefits from employer FSA or direct payments (W-2 Box 10). Reduces the expense base for the credit dollar-for-dollar. Up to $5,000 ($2,500 MFS) is excludable from income.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.OCR,
  ocrMapping:         { documentType: 'W-2', box: '10', fieldName: 'dependentCareBenefits' },
  questionId:         'f2441.q.employerBenefits',
  defaultValue:       0,
  validation:         { max: 5_000 },
};

// ─────────────────────────────────────────────────────────────────────────────
// PART III (SIMPLIFIED) — EMPLOYER BENEFIT EXCLUSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 25 — Benefits excluded from income
 *
 * Simplified Part III: for most filers the excluded amount equals
 * the benefits received (up to the FSA limit). The full Part III
 * carryover/forfeiture logic is deferred.
 *
 * Exclusion max: $5,000 (all filers except MFS); $2,500 (MFS).
 * Benefits above the exclusion max are taxable wages (already in W-2 Box 1).
 */
const line25_benefitsExcluded: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line25_benefitsExcluded`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 2441 Line 25 — Dependent Care Benefits Excluded from Income',
  description:        'Employer benefits excluded from income. Min of benefits received (Line 12) and FSA exclusion limit ($5,000; $2,500 MFS).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.line12_employerBenefits`],
  compute: (ctx) => {
    const c        = getF2441Constants(ctx.taxYear);
    const benefits = safeNum(ctx.get(`${FORM_ID}.joint.line12_employerBenefits`));
    const limit    = ctx.filingStatus === 'married_filing_separately'
      ? c.employerBenefitsExclusionMaxMFS
      : c.employerBenefitsExclusionMax;
    return Math.min(benefits, limit);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PART II — CREDIT CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 4 — Primary filer earned income
 *
 * Pulled from F1040 W-2 wages (Line 1a). Will expand to include
 * SE income once Schedule C/SE are implemented.
 *
 * For student/disabled primary filers, the deemed income rule applies
 * but is handled by the preparer overriding this via the spouse income input.
 */
const line4_primaryEarnedIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line4_primaryEarnedIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 2441 Line 4 — Primary Filer Earned Income',
  description:        'Earned income used for the Form 2441 limit. Currently uses Form 1040 derived earned income (W-2 wages + other earned proxy).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       ['f1040.joint.earnedIncome'],      // ✅ change
  compute: (ctx) => safeNum(ctx.get('f1040.joint.earnedIncome')), // ✅ change
};

/**
 * Expense cap node — computed from number of qualifying persons.
 * $3,000 for 1 person; $6,000 for 2 or more.
 * Intermediate node used by line 6.
 */
const expenseCap: NodeDefinition = {
  id:                 `${FORM_ID}.joint.expenseCap`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 2441 — Expense Cap ($3,000 or $6,000)',
  description:        'Maximum qualifying expense base. $3,000 for one qualifying person; $6,000 for two or more.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.line2_numQualifyingPersons`],
  compute: (ctx) => {
    const c          = getF2441Constants(ctx.taxYear);
    const numPersons = safeNum(ctx.get(`${FORM_ID}.joint.line2_numQualifyingPersons`));
    return getExpenseCap(numPersons, c);
  },
};

/**
 * Line 6 — Qualified expense base (smallest of lines 3, 4, 5, and expense cap)
 *
 * Per IRS instructions: "Enter the smallest of line 3, 4, or 5."
 * But also cannot exceed the expense cap for number of persons.
 * Also reduced by employer-provided benefits (line 25).
 *
 * Final qualified amount = min(expenses - employer benefits, earnedIncome,
 *                              spouseEarnedIncome [if MFJ], expenseCap)
 *
 * For non-MFJ filers: spouse earned income constraint doesn't apply —
 * we treat $999,999 as effectively unconstrained when spouse is 0 and
 * filing status is not MFJ.
 */
const line6_qualifiedExpenseBase: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line6_qualifiedExpenseBase`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 2441 Line 6 — Qualified Expense Base',
  description:        'Smallest of: actual expenses minus employer benefits, primary earned income, spouse earned income (MFJ), and per-person expense cap.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line3_qualifyingExpenses`,
    `${FORM_ID}.joint.line4_primaryEarnedIncome`,
    `${FORM_ID}.joint.line5_spouseEarnedIncome`,
    `${FORM_ID}.joint.line25_benefitsExcluded`,
    `${FORM_ID}.joint.expenseCap`,
  ],
  compute: (ctx) => {
    const expenses         = safeNum(ctx.get(`${FORM_ID}.joint.line3_qualifyingExpenses`));
    const primaryIncome    = safeNum(ctx.get(`${FORM_ID}.joint.line4_primaryEarnedIncome`));
    const spouseIncome     = safeNum(ctx.get(`${FORM_ID}.joint.line5_spouseEarnedIncome`));
    const benefitsExcluded = safeNum(ctx.get(`${FORM_ID}.joint.line25_benefitsExcluded`));
    const cap              = safeNum(ctx.get(`${FORM_ID}.joint.expenseCap`));

    // Net expenses after employer benefits
    const netExpenses = Math.max(0, expenses - benefitsExcluded);

    // For MFJ: must not exceed LOWER of both spouses' earned income
    // For single/HoH: only primary income constraint applies
    const isMFJ = ctx.filingStatus === 'married_filing_jointly';
    const earnedIncomeLimit = isMFJ
      ? Math.min(primaryIncome, spouseIncome)
      : primaryIncome;

    return Math.min(netExpenses, cap, earnedIncomeLimit);
  },
};

/**
 * Line 7 — AGI (from F1040 Line 11)
 */
const line7_agi: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line7_agi`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 2441 Line 7 — Adjusted Gross Income',
  description:        'AGI from Form 1040 Line 11. Used to determine the credit rate percentage.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       ['f1040.joint.line11_adjustedGrossIncome'],
  compute: (ctx) => safeNum(ctx.get('f1040.joint.line11_adjustedGrossIncome')),
};

/**
 * Line 8 — Credit rate decimal (AGI table lookup)
 * Ranges from 0.35 (AGI ≤ $15,000) to 0.20 (AGI > $43,000).
 */
const line8_creditRate: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line8_creditRate`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 2441 Line 8 — Credit Rate Decimal',
  description:        'Credit rate based on AGI. 35% for AGI ≤ $15,000; decreasing by 1% per $2,000 of AGI; floor of 20% for AGI > $43,000.',
  valueType:          NodeValueType.PERCENTAGE,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.line7_agi`],
  compute: (ctx) => {
    const c   = getF2441Constants(ctx.taxYear);
    const agi = safeNum(ctx.get(`${FORM_ID}.joint.line7_agi`));
    return getCreditRate(agi, c);
  },
};

/**
 * Line 9a — Tentative credit (line 6 × line 8)
 * Before the tax liability cap.
 */
const line9a_tentativeCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line9a_tentativeCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 2441 Line 9a — Tentative Credit (Expenses × Rate)',
  description:        'Qualified expense base (Line 6) multiplied by the credit rate (Line 8). This is the credit before the tax liability cap.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line6_qualifiedExpenseBase`,
    `${FORM_ID}.joint.line8_creditRate`,
  ],
  compute: (ctx) => {
    const expBase    = safeNum(ctx.get(`${FORM_ID}.joint.line6_qualifiedExpenseBase`));
    const rate       = safeNum(ctx.get(`${FORM_ID}.joint.line8_creditRate`));
    return Math.round(expBase * rate * 100) / 100;
  },
};

/**
 * Line 10 — Tax liability limit
 *
 * The credit is nonrefundable — it cannot exceed tax liability.
 * We use F1040 total tax (Line 24) as the constraint.
 * The full Credit Limit Worksheet interaction is the same approximation
 * used in Form 8812 Line 13.
 */
const line10_taxLiabilityLimit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line10_taxLiabilityLimit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 2441 Line 10 — Tax Liability Limit',
  description:        'Maximum nonrefundable credit allowed. Cannot exceed tax liability (Form 1040 Line 24). Credit cannot create a refund.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       ['f1040.joint.line24_totalTax'],
  compute: (ctx) => Math.max(0, safeNum(ctx.get('f1040.joint.line24_totalTax'))),
};

/**
 * Line 11 — Child and Dependent Care Credit (FINAL)
 *
 * Min of tentative credit (line 9a) and tax liability limit (line 10).
 * → Flows to Schedule 3 Line 2 → Form 1040 Line 20 (via Schedule 3 Line 8)
 */
const line11_credit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line11_credit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 2441 Line 11 — Child and Dependent Care Credit',
  description:        'Final nonrefundable credit for child and dependent care expenses. Lesser of tentative credit (Line 9a) and tax liability (Line 10). Flows to Schedule 3 Line 2.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.line9a_tentativeCredit`,
    `${FORM_ID}.joint.line10_taxLiabilityLimit`,
  ],
  compute: (ctx) => {
    const tentative = safeNum(ctx.get(`${FORM_ID}.joint.line9a_tentativeCredit`));
    const taxLimit  = safeNum(ctx.get(`${FORM_ID}.joint.line10_taxLiabilityLimit`));
    return Math.min(tentative, taxLimit);
  },
  isApplicable: (ctx) => {
    const numPersons = safeNum(ctx.get(`${FORM_ID}.joint.line2_numQualifyingPersons`));
    const expenses   = safeNum(ctx.get(`${FORM_ID}.joint.line3_qualifyingExpenses`));
    return numPersons > 0 && expenses > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Form 2441 node definitions.
 *
 * Registration order: F2441 reads from F1040 (AGI, wages, total tax),
 * so F1040_NODES must be registered BEFORE F2441_NODES.
 * Schedule 3 reads from F2441, so F2441_NODES before SCHEDULE3_NODES.
 *
 *   engine.registerNodes([
 *     ...F1040_NODES,
 *     ...F8812_NODES,
 *     ...F2441_NODES,    ← new
 *     ...SCHEDULE3_NODES,
 *     ...F1040_PAYMENT_NODES,
 *   ]);
 */
export const F2441_NODES: NodeDefinition[] = [
  // Inputs
  line2_numQualifyingPersons,
  line3_qualifyingExpenses,
  line5_spouseEarnedIncome,
  line12_employerBenefits,
  // Part III (simplified)
  line25_benefitsExcluded,
  // Part II — Credit calculation
  line4_primaryEarnedIncome,
  expenseCap,
  line6_qualifiedExpenseBase,
  line7_agi,
  line8_creditRate,
  line9a_tentativeCredit,
  line10_taxLiabilityLimit,
  line11_credit,
];

export const F2441_OUTPUTS = {
  /** Final nonrefundable credit → Schedule 3 Line 2 */
  credit: `${FORM_ID}.joint.line11_credit`,
} as const;