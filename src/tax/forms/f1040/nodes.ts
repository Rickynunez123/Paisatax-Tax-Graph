/**
 * FORM 1040 -- U.S. INDIVIDUAL INCOME TAX RETURN
 * Shell: AGI + standard deduction + taxable income + additional taxes
 *
 * This is a partial implementation covering only the lines needed
 * to close the vertical slice from source forms → AGI → Schedule 2.
 *
 * VERTICAL SLICE BEING CLOSED:
 *
 *   Income sources (inputs)
 *     → Form 1040 Line 9 (total income -- input for now)
 *     → Form 1040 Line 10 (= Schedule 1 Line 26, adjustments)
 *     → Form 1040 Line 11 (AGI = Line 9 - Line 10)
 *
 *   Penalty sources (F8889, F5329)
 *     → Schedule 2 Line 44 (total additional taxes)
 *     → Form 1040 Line 17 (= Schedule 2 Line 44)
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Line 9  -- Total income (input -- wage/salary, etc.)
 *   ✅ Line 10 -- Adjustments to income (= Schedule 1 Line 26)
 *   ✅ Line 11 -- AGI (Line 9 - Line 10)
 *   ✅ Line 17 -- Additional taxes (= Schedule 2 Line 44)
 *   ✅ Line 12 -- Standard deduction (computed from filing status + age/blind + dependent formula)
 *   🚧 Line 13 -- QBI deduction (input, deferred)
 *   ✅ Line 15 -- Taxable income (AGI − Line 12 − Line 13)
 *   🚧 Lines 16-24 -- Tax and credits
 *   🚧 Lines 25-33 -- Payments
 *   🚧 Lines 34-38 -- Refund or amount owed
 *
 * IRS References:
 *   Form 1040 Instructions (2025)
 *   IRC S.62 -- definition of AGI
 */
import type { NodeDefinition } from '../../../core/graph/node.types';
import { computeTax } from "./constants/index";
import {
  // NodeDefinition,
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import { SCHEDULE1_OUTPUTS } from '../schedule1/nodes';
import { SCHEDULE2_OUTPUTS } from '../schedule2/nodes';
import { getF1040Constants }  from './constants/index';

const APPLICABLE_YEARS = ['2024', '2025'];
const FORM_ID          = 'f1040';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 9 -- TOTAL INCOME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 9 -- Total income
 *
 * The sum of all income sources before any adjustments.
 * In the full implementation this is computed from:
 *   - W-2 wages (Line 1a)
 *   - Interest income (Schedule B)
 *   - Dividend income (Schedule B)
 *   - Capital gains (Schedule D)
 *   - Business income (Schedule C)
 *   - Other income (Schedule 1 Part I)
 *   - etc.
 *
 * For this shell, it is an INPUT node -- the preparer enters
 * the total directly. When income source forms are implemented,
 * this will become COMPUTED.
 *
 * 🚧 Will become COMPUTED when income forms (W-2, Schedule B, etc.) are built.
 */
const line9_totalIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line9_totalIncome`,
  kind:               NodeKind.INPUT,
  label:              'Form 1040 Line 9 -- Total Income',
  description:        'Total income before adjustments. Sum of all income sources (wages, interest, dividends, capital gains, business income, etc.).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    [
    'income.earned',
    'income.passive',
    'income.portfolio',
    'income.other',
  ],

  source:             InputSource.PREPARER,
  questionId:         'f1040.q.totalIncome',
  defaultValue:       0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 10 -- ADJUSTMENTS TO INCOME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 10 -- Adjustments to income (from Schedule 1 Line 26)
 *
 * Above-the-line deductions that reduce gross income to AGI.
 * Currently includes:
 *   - HSA deduction (Schedule 1 Line 13, which reads from F8889)
 * Eventually includes IRA, student loan interest, SE tax deduction, etc.
 *
 * This is a pure pass-through from Schedule 1 Line 26.
 * The engine resolves the cross-form dependency automatically.
 */
const line10_adjustmentsToIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line10_adjustmentsToIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 10 -- Adjustments to Income (Schedule 1 Line 26)',
  description:        'Total above-the-line deductions from Schedule 1 Line 26. Includes HSA deduction and other adjustments.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['deduction.above_the_line'],

  dependencies:       [SCHEDULE1_OUTPUTS.totalAdjustments],
  compute: (ctx) => {
    return safeNum(ctx.get(SCHEDULE1_OUTPUTS.totalAdjustments));
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 11 -- ADJUSTED GROSS INCOME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 11 -- Adjusted Gross Income (AGI)
 *
 * AGI = Line 9 (total income) - Line 10 (adjustments)
 *
 * AGI is one of the most important numbers on the return:
 *   - It is the base for many credit phase-outs
 *   - Medical expense deduction uses 7.5% of AGI as a floor
 *   - It determines eligibility for IRA deductions
 *   - It affects student loan interest deduction phase-outs
 *   - Many state returns start with federal AGI
 *
 * Cannot go below zero -- the IRS does not allow negative AGI
 * except in specific Net Operating Loss situations (deferred).
 *
 * This is the first "landmark" number in the return.
 * When this node computes, the preparer immediately sees
 * how the HSA deduction reduced the taxpayer's AGI.
 */
const line11_adjustedGrossIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line11_adjustedGrossIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 11 -- Adjusted Gross Income (AGI)',
  description:        'Total income (Line 9) minus adjustments (Line 10). The foundation for many calculations throughout the return. Lower AGI means more credits and deductions.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,  // NOL carryforward is a future edge case
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],   // not 'income' -- AGI is a derived measure

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
// LINES 12 INPUT NODES -- FACTORS FOR STANDARD DEDUCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Primary filer's age as of December 31 of the tax year.
 *
 * AGE RULE FOR ADDITIONAL STANDARD DEDUCTION (different from HSA catch-up!):
 * You qualify for the additional deduction if you are 65 or older by
 * January 1 of the FOLLOWING year -- equivalently, born before January 2
 * of the tax year.  IRS Pub 501, p. 20: "You are considered to be age 65
 * on the day before your 65th birthday."
 *
 * Example: Born January 1, 1960 → considered 65 on December 31, 2024
 *          → qualifies for the 2024 additional deduction even though
 *            technically still 64 on December 31, 2024.
 *
 * We handle this by asking for age-as-of-Dec-31 and applying a ≥ 65
 * check EXCEPT for the January 1 birthday edge case -- which the preparer
 * resolves by entering 65 manually for that edge case.
 * (In practice this is rare enough that a note on the question suffices.)
 */
const line12input_primaryAge: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_primaryAge`,
  kind:               NodeKind.INPUT,
  label:              'Primary Filer Age as of December 31 (Standard Deduction)',
  description:        'Primary filer age as of December 31 of the tax year. Used to determine additional standard deduction eligibility (age 65+). Note: if your birthday is January 1, enter your age after the birthday.',
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

/**
 * Whether the primary filer is legally blind.
 * Qualifies for the same additional standard deduction as age 65+.
 * A filer who is both 65+ AND blind gets the additional amount TWICE.
 * IRS Pub 501: "You are considered blind if your vision cannot be
 * corrected to better than 20/200 in your better eye, or your field
 * of vision is not more than 20 degrees."
 */
const line12input_primaryBlind: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_primaryBlind`,
  kind:               NodeKind.INPUT,
  label:              'Primary Filer -- Legally Blind?',
  description:        'Whether the primary filer is legally blind (vision not correctable to better than 20/200, or field of vision ≤ 20 degrees). Qualifies for an additional standard deduction.',
  valueType:          NodeValueType.BOOLEAN,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],

  source:             InputSource.PREPARER,
  questionId:         'f1040.q.primaryBlind',
  defaultValue:       false,
};

/**
 * Spouse's age as of December 31 (MFJ / MFS returns only).
 * Ignored for filing statuses without a spouse.
 * Same age-rule note as primary filer applies.
 */
const line12input_spouseAge: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_spouseAge`,
  kind:               NodeKind.INPUT,
  label:              'Spouse Age as of December 31 (Standard Deduction)',
  description:        'Spouse age as of December 31 of the tax year. Used to determine spouse additional standard deduction eligibility (age 65+). Only relevant for MFJ and MFS returns.',
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

/**
 * Whether the spouse is legally blind (MFJ / MFS returns only).
 */
const line12input_spouseBlind: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_spouseBlind`,
  kind:               NodeKind.INPUT,
  label:              'Spouse -- Legally Blind?',
  description:        'Whether the spouse is legally blind. Qualifies for an additional standard deduction. Only relevant for MFJ and MFS returns.',
  valueType:          NodeValueType.BOOLEAN,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],

  source:             InputSource.PREPARER,
  questionId:         'f1040.q.spouseBlind',
  defaultValue:       false,
};

/**
 * Whether the taxpayer CAN BE CLAIMED as a dependent on another return.
 *
 * This triggers the dependent filer standard deduction formula (IRC S.63(c)(5)):
 *   max(flatMinimum, earnedIncome + earnedIncomeAdder), capped at normal deduction.
 *
 * Common for:
 *   - College students claimed by parents
 *   - Young adults on parents' return
 *   - International students whose parents claim them
 *
 * Note the distinction: this is whether they CAN BE claimed (even if
 * the parent chooses not to). If a parent can claim the child but does
 * not, the child still uses the dependent formula.
 */
const line12input_isDependentFiler: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_isDependentFiler`,
  kind:               NodeKind.INPUT,
  label:              'Can Be Claimed as Dependent on Another Return?',
  description:        'Whether this taxpayer can be claimed as a dependent on another person\'s return. Triggers the dependent filer standard deduction formula (IRC S.63(c)(5)). Common for college students and young adults.',
  valueType:          NodeValueType.BOOLEAN,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],

  source:             InputSource.PREPARER,
  questionId:         'f1040.q.isDependentFiler',
  defaultValue:       false,
};

/**
 * Earned income -- used only in the dependent filer deduction formula.
 *
 * Earned income = wages + tips + other compensation from work.
 * Does NOT include investment income, scholarships (generally),
 * or Social Security.
 *
 * Only needed when isDependentFiler = true.
 * When isDependentFiler = false, this node is ignored.
 */
const line12input_earnedIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12input_earnedIncome`,
  kind:               NodeKind.INPUT,
  label:              'Earned Income (for Dependent Filer Standard Deduction)',
  description:        'Wages, tips, and other compensation from work. Used only when the taxpayer is a dependent filer (IRC S.63(c)(5)). Does not include investment income.',
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

// ─────────────────────────────────────────────────────────────────────────────
// LINE 12 -- STANDARD DEDUCTION ✅ COMPUTED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 12 -- Standard deduction (IRC S.63)
 *
 * THREE possible formulas depending on taxpayer situation:
 *
 * FORMULA A -- Normal filer (not a dependent, not itemizing):
 *   baseDeduction(filingStatus)
 *   + additionalAmount × count(primaryAge65+, primaryBlind,
 *                              spouseAge65+, spouseBlind)
 *
 *   where additionalAmount depends on filing status:
 *     - Single / HOH:              $2,000 (2025)
 *     - MFJ / MFS / QSS:          $1,600 (2025)
 *
 * FORMULA B -- Dependent filer (IRC S.63(c)(5)):
 *   max(flatMinimum, earnedIncome + earnedIncomeAdder)
 *   capped at the Formula A result (which acts as the ceiling)
 *
 *   This formula IGNORES the age/blindness additions --
 *   a dependent filer who is also 65+ gets the larger of:
 *   (i) the dependent formula result, or (ii) the dependent formula
 *   result (the age addition does not apply per IRS instructions)
 *   Actually: the cap IS the base deduction without additions,
 *   but the age/blind additions DO NOT apply to dependent filers.
 *   See IRS Pub 501 Worksheet for Standard Deduction for Dependents.
 *
 * FORMULA C -- Itemizing (deferred):
 *   Schedule A total (not yet implemented)
 *   We take whichever is larger when Schedule A is available.
 *   For now: always use the standard deduction.
 *
 * FILING STATUS STRINGS match the engine context:
 *   'single', 'married_filing_jointly', 'married_filing_separately',
 *   'head_of_household', 'qualifying_surviving_spouse'
 */
const line12_standardDeduction: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line12_deduction`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 12 -- Standard Deduction',
  description:        'Standard deduction based on filing status, age, and blindness. Dependent filers use a special formula. Itemized deductions (Schedule A) deferred.',
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

    const primaryAge      = safeNum(ctx.get(`${FORM_ID}.joint.line12input_primaryAge`));
    const primaryBlind    = ctx.get(`${FORM_ID}.joint.line12input_primaryBlind`) as boolean ?? false;
    const spouseAge       = safeNum(ctx.get(`${FORM_ID}.joint.line12input_spouseAge`));
    const spouseBlind     = ctx.get(`${FORM_ID}.joint.line12input_spouseBlind`) as boolean ?? false;
    const isDependent     = ctx.get(`${FORM_ID}.joint.line12input_isDependentFiler`) as boolean ?? false;
    const earnedIncome    = safeNum(ctx.get(`${FORM_ID}.joint.line12input_earnedIncome`));
    const filingStatus    = ctx.filingStatus;

    // ── Base deduction by filing status ───────────────────────────────────────
    const base = (() => {
      switch (filingStatus) {
        case 'married_filing_jointly':    return c.standardDeduction.marriedFilingJointly;
        case 'married_filing_separately': return c.standardDeduction.marriedFilingSeparately;
        case 'head_of_household':         return c.standardDeduction.headOfHousehold;
        case 'qualifying_surviving_spouse':
          return c.standardDeduction.qualifyingSurvivingSpouse;
        default:                          return c.standardDeduction.single; // 'single'
      }
    })();

    // ── Dependent filer formula (IRC S.63(c)(5)) ───────────────────────────────
    // The age/blind additions do NOT apply to dependent filers.
    // Their deduction is: max(flatMin, earnedIncome + adder), capped at base.
    if (isDependent) {
      const { flatMinimum, earnedIncomeAdder } = c.dependentFilerDeduction;
      const dependentAmount = Math.max(flatMinimum, earnedIncome + earnedIncomeAdder);
      return Math.min(dependentAmount, base);
    }

    // ── Normal filer: base + additional amounts ────────────────────────────────
    // Additional amount per qualifying condition per person.
    // Single / HOH rate is higher than married rate.
    const isSingleRate = (filingStatus === 'single' || filingStatus === 'head_of_household');
    const additionalPerCondition = isSingleRate
      ? c.additionalStandardDeduction.single
      : c.additionalStandardDeduction.marriedOrSurviving;

    // Count qualifying conditions:
    //   Primary age 65+: +1
    //   Primary blind:   +1 (stackable with age)
    //   Spouse age 65+:  +1 (MFJ/MFS only -- but we let the preparer control this
    //                       via the spouse age/blind inputs; if not married,
    //                       they should leave those at 0)
    //   Spouse blind:    +1
    let additionalCount = 0;
    if (primaryAge  >= 65)  additionalCount++;
    if (primaryBlind)       additionalCount++;
    // Spouse additions only apply on returns that actually have a spouse.
    // For single / HOH / QSS filers the spouse inputs are ignored entirely.
    if (ctx.hasSpouse) {
      if (spouseAge  >= 65) additionalCount++;
      if (spouseBlind)      additionalCount++;
    }

    return base + additionalCount * additionalPerCondition;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 13 -- QBI DEDUCTION (deferred)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 13 -- Qualified Business Income (QBI) deduction (IRC S.199A)
 *
 * 🚧 DEFERRED -- requires Schedule C / K-1 business income data.
 * Up to 20% of qualified business income for pass-through entities.
 * Defined as input so the preparer can enter manually if needed.
 */
const line13_qbiDeduction: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line13_qbiDeduction`,
  kind:               NodeKind.INPUT,
  label:              'Form 1040 Line 13 -- Qualified Business Income (QBI) Deduction',
  description:        'QBI deduction from Schedule C/K-1 business income (IRC S.199A). Not yet computed automatically.',
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
// LINE 15 -- TAXABLE INCOME ✅ COMPUTED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 15 -- Taxable income
 *
 * AGI (Line 11) minus:
 *   Line 12 (standard or itemized deduction)
 *   Line 13 (QBI deduction)
 *
 * Cannot be negative -- if deductions exceed AGI, taxable income = 0.
 *
 * This is the number fed into the tax bracket tables to compute
 * the regular income tax (Line 16). With this node computed,
 * the path to Line 16 (brackets) is the only remaining gap.
 */
const line15_taxableIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line15_taxableIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 15 -- Taxable Income',
  description:        'AGI (Line 11) minus standard deduction (Line 12) minus QBI deduction (Line 13). Cannot be negative. This is the base for income tax bracket calculations.',
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
    const agi  = safeNum(ctx.get(`${FORM_ID}.joint.line11_adjustedGrossIncome`));
    const ded  = safeNum(ctx.get(`${FORM_ID}.joint.line12_deduction`));
    const qbi  = safeNum(ctx.get(`${FORM_ID}.joint.line13_qbiDeduction`));
    return Math.max(0, agi - ded - qbi);
  },
};

/**
 * Line 16 -- Tax (from tax tables or tax computation worksheet)
 *
 * 🚧 DEFERRED -- requires full tax bracket calculation.
 * Defined as input for now. When brackets are implemented,
 * this becomes COMPUTED from Line 15 (taxable income) and
 * the filing status bracket tables.
 *
 * Next step after this file: add F1040_CONSTANTS bracket tables
 * and a computeTax(taxableIncome, filingStatus, taxYear) function.
 */
// const line16_tax: NodeDefinition = {
//   id:                 `${FORM_ID}.joint.line16_tax`,
//   kind:               NodeKind.INPUT,
//   label:              'Form 1040 Line 16 -- Tax',
//   description:        'Tax from the tax tables or tax computation worksheet. Not yet computed automatically -- will use Line 15 (taxable income) once bracket tables are implemented.',
//   valueType:          NodeValueType.CURRENCY,
//   allowNegative:      false,
//   owner:              NodeOwner.JOINT,
//   repeatable:         false,
//   applicableTaxYears: APPLICABLE_YEARS,
//   classifications:    ['intermediate'],
//   source:             InputSource.PREPARER,
//   questionId:         'f1040.q.tax',
//   defaultValue:       0,
// };




const line16_tax: NodeDefinition = {
  id: `${FORM_ID}.joint.line16_tax`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 16 -- Tax",
  description: "Tax computed from taxable income (Line 15) using IRS brackets.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],

  dependencies: [`${FORM_ID}.joint.line15_taxableIncome`],

  compute: (ctx) => {
    const c = getF1040Constants(ctx.taxYear);
    const ti = safeNum(ctx.get(`${FORM_ID}.joint.line15_taxableIncome`));
    return computeTax(ti, ctx.filingStatus, c); // computeTax already returns 0 for <=0
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// LINE 17 -- ADDITIONAL TAXES FROM SCHEDULE 2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 17 -- Additional taxes (from Schedule 2 Line 44)
 *
 * *** END OF THE VERTICAL SLICE ***
 *
 * This is where all penalties computed across Form 8889, Form 5329,
 * and Schedule 2 arrive on the main tax return.
 *
 * The computation chain that ends here:
 *   F8889 input → F8889 Line 17b (HSA penalty)
 *   F5329 input → F5329 Line 4  (early dist penalty)
 *   F5329 input → F5329 Line 49 (HSA excess penalty)
 *   → Schedule 2 Line 8   (retirement taxes)
 *   → Schedule 2 Line 17b (HSA distribution taxes)
 *   → Schedule 2 Line 44  (total additional taxes)
 *   → Form 1040 Line 17   ← YOU ARE HERE
 *
 * This node is SKIPPED when Schedule 2 Line 44 = 0 -- keeping the
 * form clean for taxpayers with no additional taxes.
 */
const line17_additionalTaxes: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line17_additionalTaxes`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 17 -- Additional Taxes (Schedule 2 Line 44)',
  description:        'Additional taxes from Schedule 2 Line 44: early distribution penalties, HSA excess penalties, HSA non-qualified distribution taxes.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['penalty'],

  dependencies:       [SCHEDULE2_OUTPUTS.totalAdditionalTaxes],
  compute: (ctx) => {
    return safeNum(ctx.get(SCHEDULE2_OUTPUTS.totalAdditionalTaxes));
  },
  isApplicable: (ctx) => {
    return safeNum(ctx.get(SCHEDULE2_OUTPUTS.totalAdditionalTaxes)) > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 24 -- TOTAL TAX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 24 -- Total tax
 *
 * In the full return: Line 16 (regular tax) + Line 17 (additional taxes)
 * + Lines 18-23 (other credits and taxes, deferred).
 *
 * For this shell: Line 16 + Line 17.
 * This gives a meaningful partial total even before the full return is built --
 * the preparer can see the tax due from penalties immediately.
 *
 * When Lines 18-23 are implemented, they will be added to this sum.
 */
const line24_totalTax: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line24_totalTax`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 1040 Line 24 -- Total Tax',
  description:        'Total tax before payments. Currently: regular tax (Line 16) + additional taxes (Line 17). Lines 18-23 deferred.',
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
    const line16 = safeNum(ctx.get(`${FORM_ID}.joint.line16_tax`));
    const line17 = safeNum(ctx.get(`${FORM_ID}.joint.line17_additionalTaxes`));
    return line16 + line17;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Form 1040 shell node definitions.
 *
 * Must be registered with all upstream form nodes:
 *   engine.registerNodes([
 *     ...F8889_NODES,
 *     ...F5329_NODES,
 *     ...SCHEDULE1_NODES,
 *     ...SCHEDULE2_NODES,
 *     ...F1040_NODES,
 *   ]);
 */
export const F1040_NODES: NodeDefinition[] = [
  line9_totalIncome,
  line10_adjustmentsToIncome,
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
];

/**
 * Form 1040 output node IDs.
 * These are the numbers the preparer reads at the end of the return.
 */
export const F1040_OUTPUTS = {
  adjustedGrossIncome: `${FORM_ID}.joint.line11_adjustedGrossIncome`,
  standardDeduction:   `${FORM_ID}.joint.line12_deduction`,
  taxableIncome:       `${FORM_ID}.joint.line15_taxableIncome`,
  additionalTaxes:     `${FORM_ID}.joint.line17_additionalTaxes`,
  totalTax:            `${FORM_ID}.joint.line24_totalTax`,
} as const;