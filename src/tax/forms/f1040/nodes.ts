/**
 * FORM 1040 — U.S. INDIVIDUAL INCOME TAX RETURN
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Line 1a — W-2 wages (from W-2 joint aggregator)
 *   ✅ Line 9  — Total income (computed from Line 1a + others; input fallback when no income forms)
 *   ✅ Line 10 — Adjustments to income (= Schedule 1 Line 26)
 *   ✅ Line 11 — AGI (Line 9 - Line 10)
 *   ✅ Line 12 — Standard deduction
 *   🚧 Line 13 — QBI deduction (input, deferred)
 *   ✅ Line 15 — Taxable income
 *   ✅ Line 16 — Tax (bracket computation)
 *   ✅ Line 17 — Additional taxes (= Schedule 2 Line 44)
 *   ✅ Line 24 — Total tax
 *   ✅ Line 25a — W-2 federal withholding (from W-2 joint aggregator)
 *   🚧 Lines 2-8 — Other income lines (interest, dividends, cap gains, etc.)
 *   🚧 Lines 25b-33 — Other payments
 *   🚧 Lines 34-38 — Refund / amount owed
 *
 * LINE 9 STRATEGY
 *   Line 9 is COMPUTED when income source forms are available.
 *   It sums Line 1a (W-2 wages) plus a manual override input for
 *   income types not yet implemented (interest, dividends, etc.).
 *   When all income lines are built, the manual override goes away.
 *
 * IRS References:
 *   Form 1040 Instructions (2025)
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import { computeTax, getF1040Constants } from './constants/index';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';
import { earnedIncome } from "./derived";



import { SCHEDULE1_OUTPUTS } from '../schedule1/nodes';
import { SCHEDULE2_OUTPUTS } from '../schedule2/nodes';
import { W2_OUTPUTS }        from '../w2/nodes';

const APPLICABLE_YEARS = ['2024', '2025'];
const FORM_ID          = 'f1040';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 1a — W-2 WAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 1a — Total wages, salaries, tips (from W-2s)
 *
 * Pass-through from the W-2 joint aggregator.
 * When no W-2 slots exist, the aggregator returns 0 and this is 0.
 * When W-2 slots are added, this automatically updates.
 */
const line1a_w2Wages: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line1a_w2Wages`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 1a — W-2 Wages',
  description:        'Total wages, salaries, and tips from all W-2s for both filers. From W-2 Box 1 aggregator.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.earned'],
  dependencies:       [W2_OUTPUTS.jointWages],
  compute: (ctx) => safeNum(ctx.get(W2_OUTPUTS.jointWages)),
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 9 — TOTAL INCOME (COMPUTED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Other income — manual input for income types not yet implemented.
 *
 * This is a temporary node that lets the preparer enter income that
 * doesn't yet have a dedicated form (interest, dividends, capital gains,
 * Schedule C, etc.). As those forms are built, they will add their
 * output to Line 9's dependencies and this input becomes unnecessary.
 *
 * When all income lines are implemented, this node will be deprecated.
 */
const line9input_otherIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line9input_otherIncome`,
  kind:               NodeKind.INPUT,
  label:              'Form 1040 Line 9 — Other Income (Manual Entry)',
  description:        'Income from sources not yet implemented as dedicated forms (interest, dividends, capital gains, business income, etc.). Enter manually until those forms are built.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.other'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.otherIncome',
  defaultValue:       0,
};

/**
 * Line 9 — Total income
 *
 * NOW COMPUTED (was INPUT in the previous shell).
 *
 * Current sum: Line 1a (W-2 wages) + other income (manual input).
 * As income forms are built, add their outputs to dependencies and
 * the compute function. Eventually remove line9input_otherIncome.
 *
 * Income lines to add over time:
 *   Line 1b  — Household employee wages
 *   Line 2a  — Tax-exempt interest
 *   Line 2b  — Taxable interest (Schedule B)
 *   Line 3a  — Qualified dividends
 *   Line 3b  — Ordinary dividends (Schedule B)
 *   Line 4b  — IRA distributions (taxable)
 *   Line 5b  — Pensions/annuities (taxable)
 *   Line 6b  — Social Security (taxable)
 *   Line 7   — Capital gains (Schedule D)
 *   Line 8   — Other income (Schedule 1 Part I)
 */
const line9_totalIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line9_totalIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 9 — Total Income',
  description:        'Total income before adjustments. Currently: W-2 wages (Line 1a) + other income (manual). Will expand as income forms are built.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.earned', 'income.other'],
  dependencies: [
    `${FORM_ID}.joint.line1a_w2Wages`,
    `${FORM_ID}.joint.line9input_otherIncome`,
    // Add future income line IDs here as they are built:
    // `${FORM_ID}.joint.line2b_taxableInterest`,
    // `${FORM_ID}.joint.line3b_ordinaryDividends`,
    // `${FORM_ID}.joint.line7_capitalGains`,
    // `${FORM_ID}.joint.line8_otherIncome`,
  ],
  compute: (ctx) => {
    const wages      = safeNum(ctx.get(`${FORM_ID}.joint.line1a_w2Wages`));
    const otherIncome = safeNum(ctx.get(`${FORM_ID}.joint.line9input_otherIncome`));
    // Add future income lines here as they are implemented
    return wages + otherIncome;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 10 — ADJUSTMENTS TO INCOME
// ─────────────────────────────────────────────────────────────────────────────

const line10_adjustmentsToIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line10_adjustmentsToIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 10 — Adjustments to Income (Schedule 1 Line 26)',
  description:        'Total above-the-line deductions from Schedule 1 Line 26.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['deduction.above_the_line'],
  dependencies:       [SCHEDULE1_OUTPUTS.totalAdjustments],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE1_OUTPUTS.totalAdjustments)),
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 11 — ADJUSTED GROSS INCOME
// ─────────────────────────────────────────────────────────────────────────────

const line11_adjustedGrossIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line11_adjustedGrossIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 11 — Adjusted Gross Income (AGI)',
  description:        'Total income (Line 9) minus adjustments (Line 10). Cannot go below zero.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line9_totalIncome`,

    `${FORM_ID}.joint.line10_adjustmentsToIncome`,
  ],
  compute: (ctx) => {
    const line9  = safeNum(ctx.get(`${FORM_ID}.joint.line9_totalIncome`));
    const line10 = safeNum(ctx.get(`${FORM_ID}.joint.line10_adjustmentsToIncome`));
    return Math.max(0, line9 - line10);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 12 — STANDARD DEDUCTION
// ─────────────────────────────────────────────────────────────────────────────

const line12input_primaryAge: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_primaryAge`,
  kind:               NodeKind.INPUT,
  label:              'Primary Filer Age as of December 31',
  description:        'Used for additional standard deduction eligibility (65+).',
  valueType:          NodeValueType.INTEGER,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.primaryAge',
  defaultValue:       0,
  validation:         { min: 0, max: 130 },
};

const line12input_primaryBlind: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_primaryBlind`,
  kind:               NodeKind.INPUT,
  label:              'Primary Filer — Legally Blind?',
  description:        'Qualifies for additional standard deduction.',
  valueType:          NodeValueType.BOOLEAN,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.primaryBlind',
  defaultValue:       false,
};

const line12input_spouseAge: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_spouseAge`,
  kind:               NodeKind.INPUT,
  label:              'Spouse Age as of December 31',
  description:        'Used for spouse additional standard deduction eligibility (65+). MFJ/MFS only.',
  valueType:          NodeValueType.INTEGER,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.spouseAge',
  defaultValue:       0,
  validation:         { min: 0, max: 130 },
};

const line12input_spouseBlind: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_spouseBlind`,
  kind:               NodeKind.INPUT,
  label:              'Spouse — Legally Blind?',
  description:        'MFJ/MFS only.',
  valueType:          NodeValueType.BOOLEAN,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.spouseBlind',
  defaultValue:       false,
};

const line12input_isDependentFiler: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_isDependentFiler`,
  kind:               NodeKind.INPUT,
  label:              'Can Be Claimed as Dependent on Another Return?',
  description:        'Triggers the dependent filer standard deduction formula (IRC §63(c)(5)).',
  valueType:          NodeValueType.BOOLEAN,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.isDependentFiler',
  defaultValue:       false,
};

const line12input_earnedIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_earnedIncome`,
  kind:               NodeKind.INPUT,
  label:              'Earned Income (Dependent Filer Standard Deduction)',
  description:        'Used only when isDependentFiler = true.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.earned', 'intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.earnedIncome',
  defaultValue:       0,
};

const line12_standardDeduction: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12_deduction`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 12 — Standard Deduction',
  description:        'Standard deduction based on filing status, age, and blindness.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['deduction.below_the_line'],
  dependencies: [
    `${FORM_ID}.joint.line12input_primaryAge`,
    `${FORM_ID}.joint.line12input_primaryBlind`,
    `${FORM_ID}.joint.line12input_spouseAge`,
    `${FORM_ID}.joint.line12input_spouseBlind`,
    `${FORM_ID}.joint.line12input_isDependentFiler`,
    `${FORM_ID}.joint.line12input_earnedIncome`,
  ],
  compute: (ctx) => {
    const c = getF1040Constants(ctx.taxYear);

    const primaryAge   = safeNum(ctx.get(`${FORM_ID}.joint.line12input_primaryAge`));
    const primaryBlind = ctx.get(`${FORM_ID}.joint.line12input_primaryBlind`) as boolean ?? false;
    const spouseAge    = safeNum(ctx.get(`${FORM_ID}.joint.line12input_spouseAge`));
    const spouseBlind  = ctx.get(`${FORM_ID}.joint.line12input_spouseBlind`) as boolean ?? false;
    const isDependent  = ctx.get(`${FORM_ID}.joint.line12input_isDependentFiler`) as boolean ?? false;
    const earnedIncome = safeNum(ctx.get(`${FORM_ID}.joint.line12input_earnedIncome`));
    const fs           = ctx.filingStatus;

    const base = (() => {
      switch (fs) {
        case 'married_filing_jointly':     return c.standardDeduction.marriedFilingJointly;
        case 'married_filing_separately':  return c.standardDeduction.marriedFilingSeparately;
        case 'head_of_household':          return c.standardDeduction.headOfHousehold;
        case 'qualifying_surviving_spouse': return c.standardDeduction.qualifyingSurvivingSpouse;
        default:                           return c.standardDeduction.single;
      }
    })();

    if (isDependent) {
      const { flatMinimum, earnedIncomeAdder } = c.dependentFilerDeduction;
      return Math.min(Math.max(flatMinimum, earnedIncome + earnedIncomeAdder), base);
    }

    const isSingleRate = fs === 'single' || fs === 'head_of_household';
    const addlPerCondition = isSingleRate
      ? c.additionalStandardDeduction.single
      : c.additionalStandardDeduction.marriedOrSurviving;

    let count = 0;
    if (primaryAge >= 65) count++;
    if (primaryBlind)     count++;
    if (ctx.hasSpouse) {
      if (spouseAge >= 65) count++;
      if (spouseBlind)     count++;
    }

    return base + count * addlPerCondition;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 13 — QBI DEDUCTION (deferred)
// ─────────────────────────────────────────────────────────────────────────────

const line13_qbiDeduction: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line13_qbiDeduction`,
  kind:               NodeKind.INPUT,
  label:              'Form 1040 Line 13 — QBI Deduction (§199A)',
  description:        'Qualified Business Income deduction. Deferred — enter manually if applicable.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['deduction.below_the_line'],
  source:             InputSource.PREPARER,
  questionId:         'f1040.q.qbiDeduction',
  defaultValue:       0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 15 — TAXABLE INCOME
// ─────────────────────────────────────────────────────────────────────────────

const line15_taxableIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line15_taxableIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 15 — Taxable Income',
  description:        'AGI minus standard deduction minus QBI deduction. Cannot be negative.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line11_adjustedGrossIncome`,
    `${FORM_ID}.joint.line12_deduction`,
    `${FORM_ID}.joint.line13_qbiDeduction`,
  ],
  compute: (ctx) => {
    const agi = safeNum(ctx.get(`${FORM_ID}.joint.line11_adjustedGrossIncome`));
    const ded = safeNum(ctx.get(`${FORM_ID}.joint.line12_deduction`));
    const qbi = safeNum(ctx.get(`${FORM_ID}.joint.line13_qbiDeduction`));
    return Math.max(0, agi - ded - qbi);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 16 — TAX
// ─────────────────────────────────────────────────────────────────────────────

const line16_tax: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line16_tax`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 16 — Tax',
  description:        'Tax computed from taxable income (Line 15) using IRS brackets.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.line15_taxableIncome`],
  compute: (ctx) => {
    const c  = getF1040Constants(ctx.taxYear);
    const ti = safeNum(ctx.get(`${FORM_ID}.joint.line15_taxableIncome`));
    return computeTax(ti, ctx.filingStatus, c);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 17 — ADDITIONAL TAXES
// ─────────────────────────────────────────────────────────────────────────────

const line17_additionalTaxes: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line17_additionalTaxes`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 17 — Additional Taxes (Schedule 2 Line 44)',
  description:        'Additional taxes from Schedule 2: early distribution penalties, HSA penalties, etc.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['penalty'],
  dependencies:       [SCHEDULE2_OUTPUTS.totalAdditionalTaxes],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE2_OUTPUTS.totalAdditionalTaxes)),
  isApplicable: (ctx) => safeNum(ctx.get(SCHEDULE2_OUTPUTS.totalAdditionalTaxes)) > 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 24 — TOTAL TAX
// ─────────────────────────────────────────────────────────────────────────────

const line24_totalTax: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line24_totalTax`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 24 — Total Tax',
  description:        'Regular tax (Line 16) + additional taxes (Line 17). Lines 18-23 deferred.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line16_tax`,
    `${FORM_ID}.joint.line17_additionalTaxes`,
  ],
  compute: (ctx) => {
    return safeNum(ctx.get(`${FORM_ID}.joint.line16_tax`)) +
           safeNum(ctx.get(`${FORM_ID}.joint.line17_additionalTaxes`));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 25a — W-2 FEDERAL WITHHOLDING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 25a — W-2 federal income tax withheld
 *
 * Pass-through from the W-2 joint withholding aggregator.
 * This is the starting point for the tax payments section.
 * Lines 25b (1099) and 25c (other) are deferred.
 */
const line25a_w2Withholding: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line25a_w2Withholding`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 25a — W-2 Federal Income Tax Withheld',
  description:        'Federal income tax withheld shown on W-2(s) for both filers. From W-2 Box 2 aggregator.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['withholding'],
  dependencies:       [W2_OUTPUTS.jointWithholding],
  compute: (ctx) => safeNum(ctx.get(W2_OUTPUTS.jointWithholding)),
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Form 1040 node definitions.
 *
 * IMPORTANT: W2_INITIAL_AGGREGATORS must also be registered alongside these
 * nodes so that Line 1a and Line 25a have valid dependencies from startup:
 *
 *   engine.registerNodes([
 *     ...F8889_NODES,
 *     ...F5329_NODES,
 *     ...SCHEDULE1_NODES,
 *     ...SCHEDULE2_NODES,
 *     ...W2_INITIAL_AGGREGATORS,   ← register before F1040_NODES
 *     ...F1040_NODES,
 *   ]);
 */
export const F1040_NODES: NodeDefinition[] = [
  // Line 1a
  line1a_w2Wages,
  // Line 9 inputs + computed
  line9input_otherIncome,
  line9_totalIncome,
  earnedIncome, // ← add this
  // Line 10
  line10_adjustmentsToIncome,
  // Line 11
  line11_adjustedGrossIncome,
  // Line 12 inputs
  line12input_primaryAge,
  line12input_primaryBlind,
  line12input_spouseAge,
  line12input_spouseBlind,
  line12input_isDependentFiler,
  line12input_earnedIncome,
  // Line 12 computed
  line12_standardDeduction,
  // Line 13
  line13_qbiDeduction,
  // Line 15
  line15_taxableIncome,
  // Line 16
  line16_tax,
  // Lines 17, 24
  line17_additionalTaxes,
  line24_totalTax,
  // Line 25a
  line25a_w2Withholding,
];

export const F1040_OUTPUTS = {
  w2Wages: `${FORM_ID}.joint.line1a_w2Wages`,
  totalIncome: `${FORM_ID}.joint.line9_totalIncome`,
  earnedIncome: `${FORM_ID}.joint.earnedIncome`, // ← add this
  adjustedGrossIncome: `${FORM_ID}.joint.line11_adjustedGrossIncome`,
  standardDeduction: `${FORM_ID}.joint.line12_deduction`,
  taxableIncome: `${FORM_ID}.joint.line15_taxableIncome`,
  tax: `${FORM_ID}.joint.line16_tax`,
  additionalTaxes: `${FORM_ID}.joint.line17_additionalTaxes`,
  totalTax: `${FORM_ID}.joint.line24_totalTax`,
  w2Withholding: `${FORM_ID}.joint.line25a_w2Withholding`,
} as const;