/**
 * FORM 1040 — U.S. INDIVIDUAL INCOME TAX RETURN
 *
 * CHANGES FROM PREVIOUS VERSION (Schedule D wave):
 *   + Line 7  — Capital gains or losses (= Schedule D toF1040Line7)
 *   ~ Line 9  — Now includes Line 7 in total income sum
 *   ~ Line 16 — Now uses QDCGT Worksheet when netLongTerm > 0 or qualifiedDividends > 0
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Line 1a  — W-2 wages
 *   ✅ Line 2a  — Tax-exempt interest (informational)
 *   ✅ Line 2b  — Taxable interest
 *   ✅ Line 3a  — Qualified dividends (subset of 3b — used by QDCGT Worksheet)
 *   ✅ Line 3b  — Ordinary dividends
 *   🚧 Line 4b  — IRA distributions (deferred)
 *   🚧 Line 5b  — Pensions/annuities (deferred)
 *   🚧 Line 6b  — Social Security (deferred)
 *   ✅ Line 7   — Capital gains or losses (Schedule D)
 *   ✅ Line 8   — Other income (Schedule 1 Part I)
 *   ✅ Line 9   — Total income (1a + 2b + 3b + 7 + 8)
 *   ✅ Line 10  — Adjustments (Schedule 1 Part II)
 *   ✅ Line 11  — AGI
 *   ✅ Line 12  — Standard deduction
 *   🚧 Line 13  — QBI deduction (deferred input)
 *   ✅ Line 15  — Taxable income
 *   ✅ Line 16  — Tax (ordinary brackets OR QDCGT Worksheet)
 *   ✅ Line 17  — Additional taxes (Schedule 2)
 *   ✅ Line 24  — Total tax
 *   ✅ Line 25a — W-2 withholding
 *
 * LINE 16 COMPUTATION PATH:
 *   IF (netLongTerm > 0 OR qualifiedDividends > 0):
 *     → computeQDCGTTax() — preferential 0/15/20% rates on eligible income
 *   ELSE:
 *     → computeTax() — ordinary brackets only
 *
 * IRS References:
 *   Form 1040 Instructions (2025)
 *   Schedule D Instructions — Tax Worksheet (2025)
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

import { SCHEDULE1_OUTPUTS } from "../schedule1/nodes";
import { SCHEDULE2_OUTPUTS } from "../schedule2/nodes";
import { SCHEDULE_B_OUTPUTS } from "../schedule-b/nodes";
import { SCHEDULE_D_OUTPUTS } from "../schedule-d/nodes";
import { W2_OUTPUTS } from "../w2/nodes";
import {
  computeQDCGTTax,
  getScheduleDConstants,
} from "../schedule-d/constants/index";

const APPLICABLE_YEARS = ["2024", "2025"];
const FORM_ID          = 'f1040';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

const line1a_w2Wages: NodeDefinition = {
  id: `${FORM_ID}.joint.line1a_w2Wages`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 1a — W-2 Wages",
  description: "Total wages, salaries, and tips from W-2 Box 1 aggregator.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.earned"],
  dependencies: [W2_OUTPUTS.jointWages],
  compute: (ctx) => safeNum(ctx.get(W2_OUTPUTS.jointWages)),
};

const line2a_taxExemptInterest: NodeDefinition = {
  id: `${FORM_ID}.joint.line2a_taxExemptInterest`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 2a — Tax-Exempt Interest (Informational)",
  description:
    "Tax-exempt interest — informational only. Not included in taxable income.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.portfolio"],
  dependencies: [SCHEDULE_B_OUTPUTS.taxExemptInterest],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE_B_OUTPUTS.taxExemptInterest)),
  isApplicable: (ctx) =>
    safeNum(ctx.get(SCHEDULE_B_OUTPUTS.taxExemptInterest)) > 0,
};

const line2b_taxableInterest: NodeDefinition = {
  id: `${FORM_ID}.joint.line2b_taxableInterest`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 2b — Taxable Interest",
  description: "Taxable interest from Schedule B Line 4. Included in Line 9.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.portfolio"],
  dependencies: [SCHEDULE_B_OUTPUTS.taxableInterest],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE_B_OUTPUTS.taxableInterest)),
  isApplicable: (ctx) =>
    safeNum(ctx.get(SCHEDULE_B_OUTPUTS.taxableInterest)) > 0,
};

const line3a_qualifiedDividends: NodeDefinition = {
  id: `${FORM_ID}.joint.line3a_qualifiedDividends`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 3a — Qualified Dividends",
  description:
    "Qualified dividends (subset of Line 3b). Does not add to Line 9. Used by Line 16 QDCGT Worksheet.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.portfolio"],
  dependencies: [SCHEDULE_B_OUTPUTS.qualifiedDividends],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE_B_OUTPUTS.qualifiedDividends)),
  isApplicable: (ctx) =>
    safeNum(ctx.get(SCHEDULE_B_OUTPUTS.qualifiedDividends)) > 0,
};

const line3b_ordinaryDividends: NodeDefinition = {
  id: `${FORM_ID}.joint.line3b_ordinaryDividends`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 3b — Ordinary Dividends",
  description:
    "Total ordinary dividends from Schedule B Line 6. Included in Line 9.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.portfolio"],
  dependencies: [SCHEDULE_B_OUTPUTS.ordinaryDividends],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE_B_OUTPUTS.ordinaryDividends)),
  isApplicable: (ctx) =>
    safeNum(ctx.get(SCHEDULE_B_OUTPUTS.ordinaryDividends)) > 0,
};

/**
 * Line 7 — Capital gains or losses.
 * Reads Schedule D toF1040Line7 which already applies the $3,000 loss cap.
 * Can be positive (gain) or negative (capped loss). Included in Line 9.
 */
const line7_capitalGains: NodeDefinition = {
  id: `${FORM_ID}.joint.line7_capitalGains`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 7 — Capital Gains or Losses",
  description:
    "Net capital gain (positive) or deductible loss (negative, capped at -$3,000) from Schedule D. Zero when no 8949 activity.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: true,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.portfolio"],
  dependencies: [SCHEDULE_D_OUTPUTS.toF1040Line7],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE_D_OUTPUTS.toF1040Line7)),
  isApplicable: (ctx) =>
    safeNum(ctx.get(SCHEDULE_D_OUTPUTS.toF1040Line7)) !== 0,
};

/**
 * Line 9 — Total income.
 * Lines 1a + 2b + 3b + 7 + 8 (Schedule 1 Part I).
 * Floor at zero — losses cannot push below 0.
 */
const line9_totalIncome: NodeDefinition = {
  id: `${FORM_ID}.joint.line9_totalIncome`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 9 — Total Income",
  description:
    "Sum of W-2 wages (1a) + taxable interest (2b) + ordinary dividends (3b) + capital gains (7) + Schedule 1 Part I (8). Floor at zero.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.earned", "income.portfolio", "income.other"],
  dependencies: [
    `${FORM_ID}.joint.line1a_w2Wages`,
    `${FORM_ID}.joint.line2b_taxableInterest`,
    `${FORM_ID}.joint.line3b_ordinaryDividends`,
    `${FORM_ID}.joint.line7_capitalGains`,
    SCHEDULE1_OUTPUTS.totalAdditionalIncome,
  ],
  compute: (ctx) =>
    Math.max(
      0,
      safeNum(ctx.get(`${FORM_ID}.joint.line1a_w2Wages`)) +
        safeNum(ctx.get(`${FORM_ID}.joint.line2b_taxableInterest`)) +
        safeNum(ctx.get(`${FORM_ID}.joint.line3b_ordinaryDividends`)) +
        safeNum(ctx.get(`${FORM_ID}.joint.line7_capitalGains`)) +
        safeNum(ctx.get(SCHEDULE1_OUTPUTS.totalAdditionalIncome)),
    ),
};

const line10_adjustmentsToIncome: NodeDefinition = {
  id: `${FORM_ID}.joint.line10_adjustmentsToIncome`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 10 — Adjustments to Income",
  description:
    "Total above-the-line deductions from Schedule 1 Part II (Line 26).",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["deduction.above_the_line"],
  dependencies: [SCHEDULE1_OUTPUTS.totalAdjustments],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE1_OUTPUTS.totalAdjustments)),
};

const line11_adjustedGrossIncome: NodeDefinition = {
  id: `${FORM_ID}.joint.line11_adjustedGrossIncome`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 11 — Adjusted Gross Income",
  description: "Total income (9) minus adjustments (10). Floor at zero.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  dependencies: [
    `${FORM_ID}.joint.line9_totalIncome`,
    `${FORM_ID}.joint.line10_adjustmentsToIncome`,
  ],
  compute: (ctx) =>
    Math.max(
      0,
      safeNum(ctx.get(`${FORM_ID}.joint.line9_totalIncome`)) -
        safeNum(ctx.get(`${FORM_ID}.joint.line10_adjustmentsToIncome`)),
    ),
};

const line12input_primaryAge: NodeDefinition = {
  id: `${FORM_ID}.joint.line12input_primaryAge`,
  kind: NodeKind.INPUT,
  label: "Primary Filer Age as of December 31",
  description: "For additional standard deduction (65+).",
  valueType: NodeValueType.INTEGER,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  source: InputSource.PREPARER,
  questionId: "f1040.q.primaryAge",
  defaultValue: 0,
  validation: { min: 0, max: 130 },
};
const line12input_primaryBlind: NodeDefinition = {
  id: `${FORM_ID}.joint.line12input_primaryBlind`,
  kind: NodeKind.INPUT,
  label: "Primary Filer — Legally Blind?",
  description: "Additional standard deduction.",
  valueType: NodeValueType.BOOLEAN,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  source: InputSource.PREPARER,
  questionId: "f1040.q.primaryBlind",
  defaultValue: false,
};
const line12input_spouseAge: NodeDefinition = {
  id: `${FORM_ID}.joint.line12input_spouseAge`,
  kind: NodeKind.INPUT,
  label: "Spouse Age as of December 31",
  description: "MFJ/MFS only.",
  valueType: NodeValueType.INTEGER,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  source: InputSource.PREPARER,
  questionId: "f1040.q.spouseAge",
  defaultValue: 0,
  validation: { min: 0, max: 130 },
};
const line12input_spouseBlind: NodeDefinition = {
  id: `${FORM_ID}.joint.line12input_spouseBlind`,
  kind: NodeKind.INPUT,
  label: "Spouse — Legally Blind?",
  description: "MFJ/MFS only.",
  valueType: NodeValueType.BOOLEAN,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  source: InputSource.PREPARER,
  questionId: "f1040.q.spouseBlind",
  defaultValue: false,
};
const line12input_isDependentFiler: NodeDefinition = {
  id: `${FORM_ID}.joint.line12input_isDependentFiler`,
  kind: NodeKind.INPUT,
  label: "Can Be Claimed as Dependent?",
  description: "Triggers IRC §63(c)(5) formula.",
  valueType: NodeValueType.BOOLEAN,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  source: InputSource.PREPARER,
  questionId: "f1040.q.isDependentFiler",
  defaultValue: false,
};
const line12input_earnedIncomeForDependent: NodeDefinition = {
  id: `${FORM_ID}.joint.line12input_earnedIncome`,
  kind: NodeKind.INPUT,
  label: "Earned Income (Dependent Filer Std Deduction)",
  description: "Used only when isDependentFiler = true.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["income.earned", "intermediate"],
  source: InputSource.PREPARER,
  questionId: "f1040.q.earnedIncome",
  defaultValue: 0,
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
    const ei = safeNum(ctx.get(`${FORM_ID}.joint.line12input_earnedIncome`));
    const fs = ctx.filingStatus;
    const base = (() => {
      switch (fs) {
        case "married_filing_jointly":
          return c.standardDeduction.marriedFilingJointly;
        case "married_filing_separately":
          return c.standardDeduction.marriedFilingSeparately;
        case "head_of_household":
          return c.standardDeduction.headOfHousehold;
        case "qualifying_surviving_spouse":
          return c.standardDeduction.qualifyingSurvivingSpouse;
        default:
          return c.standardDeduction.single;
      }
    })();
    if (isDependent) {
      const { flatMinimum, earnedIncomeAdder } = c.dependentFilerDeduction;
      return Math.min(Math.max(flatMinimum, ei + earnedIncomeAdder), base);
    }
    const isSingleRate = fs === 'single' || fs === 'head_of_household';
    const addl = isSingleRate
      ? c.additionalStandardDeduction.single
      : c.additionalStandardDeduction.marriedOrSurviving;
    let count = 0;
    if (primaryAge >= 65) count++;
    if (primaryBlind) count++;
    if (ctx.hasSpouse) {
      if (spouseAge >= 65) count++;
      if (spouseBlind) count++;
    }
    return base + count * addl;
  },
};

const line13_qbiDeduction: NodeDefinition = {
  id: `${FORM_ID}.joint.line13_qbiDeduction`,
  kind: NodeKind.INPUT,
  label: "Form 1040 Line 13 — QBI Deduction (§199A)",
  description:
    "Qualified Business Income deduction. Deferred — enter manually.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["deduction.below_the_line"],
  source: InputSource.PREPARER,
  questionId: "f1040.q.qbiDeduction",
  defaultValue: 0,
};

const line15_taxableIncome: NodeDefinition = {
  id: `${FORM_ID}.joint.line15_taxableIncome`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 15 — Taxable Income",
  description:
    "AGI (11) minus standard deduction (12) minus QBI (13). Floor at zero.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  dependencies: [
    `${FORM_ID}.joint.line11_adjustedGrossIncome`,
    `${FORM_ID}.joint.line12_deduction`,
    `${FORM_ID}.joint.line13_qbiDeduction`,
  ],
  compute: (ctx) =>
    Math.max(
      0,
      safeNum(ctx.get(`${FORM_ID}.joint.line11_adjustedGrossIncome`)) -
        safeNum(ctx.get(`${FORM_ID}.joint.line12_deduction`)) -
        safeNum(ctx.get(`${FORM_ID}.joint.line13_qbiDeduction`)),
    ),
};

/**
 * Line 16 — Tax.
 *
 * QDCGT Worksheet path: when netLongTerm > 0 OR qualifiedDividends > 0.
 * Ordinary brackets path: all other cases.
 */
// const line16_tax: NodeDefinition = {
//   id: `${FORM_ID}.joint.line16_tax`,
//   kind: NodeKind.COMPUTED,
//   label: "Form 1040 Line 16 — Tax",
//   description:
//     "Tax from QDCGT Worksheet (preferential rates when net LTCG > 0 or qualified dividends > 0) or ordinary brackets. Recomputes whenever capital gains or dividend data changes.",
//   valueType: NodeValueType.CURRENCY,
//   allowNegative: false,
//   owner: NodeOwner.JOINT,
//   repeatable: false,
//   applicableTaxYears: APPLICABLE_YEARS,
//   classifications: ["intermediate"],
//   dependencies: [
//     `${FORM_ID}.joint.line15_taxableIncome`,
//     `${FORM_ID}.joint.line3a_qualifiedDividends`,
//     SCHEDULE_D_OUTPUTS.netLongTerm,
//   ],
//   compute: (ctx) => {
//     const taxableIncome = safeNum(
//       ctx.get(`${FORM_ID}.joint.line15_taxableIncome`),
//     );
//     const qualifiedDividends = safeNum(
//       ctx.get(`${FORM_ID}.joint.line3a_qualifiedDividends`),
//     );
//     const netLongTerm = safeNum(ctx.get(SCHEDULE_D_OUTPUTS.netLongTerm));
//     const f1040C = getF1040Constants(ctx.taxYear);
//     const schedDC = getScheduleDConstants(ctx.taxYear);

//     if (netLongTerm > 0 || qualifiedDividends > 0) {
//       return computeQDCGTTax(
//         taxableIncome,
//         qualifiedDividends,
//         netLongTerm,
//         ctx.filingStatus,
//         schedDC,
//         (ord) => computeTax(ord, ctx.filingStatus, f1040C),
//       );
//     }

//     return computeTax(taxableIncome, ctx.filingStatus, f1040C);
//   },
// };

const line16_tax: NodeDefinition = {
  id: `${FORM_ID}.joint.line16_tax`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 16 — Tax",
  description:
    "Tax from QDCGT Worksheet (preferential rates when net LTCG > 0 or qualified dividends > 0) or ordinary brackets. Recomputes whenever capital gains or dividend data changes.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  dependencies: [
    `${FORM_ID}.joint.line15_taxableIncome`,
    `${FORM_ID}.joint.line3a_qualifiedDividends`,
    SCHEDULE_D_OUTPUTS.netLongTerm,
  ],
  compute: (ctx) => {
    const taxableIncome = safeNum(
      ctx.get(`${FORM_ID}.joint.line15_taxableIncome`),
    );
    const qualifiedDividends = safeNum(
      ctx.get(`${FORM_ID}.joint.line3a_qualifiedDividends`),
    );
    const netLongTerm = safeNum(ctx.get(SCHEDULE_D_OUTPUTS.netLongTerm));

    const f1040C = getF1040Constants(ctx.taxYear);

    // Only load Schedule D constants if we actually need the QDCGT worksheet
    if (netLongTerm > 0 || qualifiedDividends > 0) {
      const schedDC = getScheduleDConstants(ctx.taxYear);
      return computeQDCGTTax(
        taxableIncome,
        qualifiedDividends,
        netLongTerm,
        ctx.filingStatus,
        schedDC,
        (ord) => computeTax(ord, ctx.filingStatus, f1040C),
      );
    }

    // Ordinary brackets path (works even if Schedule D constants are not available for this year)
    return computeTax(taxableIncome, ctx.filingStatus, f1040C);
  },
};


const line17_additionalTaxes: NodeDefinition = {
  id: `${FORM_ID}.joint.line17_additionalTaxes`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 17 — Additional Taxes (Schedule 2)",
  description: "Additional taxes from Schedule 2.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["penalty"],
  dependencies: [SCHEDULE2_OUTPUTS.totalAdditionalTaxes],
  compute: (ctx) => safeNum(ctx.get(SCHEDULE2_OUTPUTS.totalAdditionalTaxes)),
  isApplicable: (ctx) =>
    safeNum(ctx.get(SCHEDULE2_OUTPUTS.totalAdditionalTaxes)) > 0,
};

const line24_totalTax: NodeDefinition = {
  id: `${FORM_ID}.joint.line24_totalTax`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 24 — Total Tax",
  description: "Tax (16) + additional taxes (17).",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["intermediate"],
  dependencies: [
    `${FORM_ID}.joint.line16_tax`,
    `${FORM_ID}.joint.line17_additionalTaxes`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line16_tax`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line17_additionalTaxes`)),
};

const line25a_w2Withholding: NodeDefinition = {
  id: `${FORM_ID}.joint.line25a_w2Withholding`,
  kind: NodeKind.COMPUTED,
  label: "Form 1040 Line 25a — W-2 Federal Income Tax Withheld",
  description: "W-2 Box 2 federal withholding for both filers.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["withholding"],
  dependencies: [W2_OUTPUTS.jointWithholding],
  compute: (ctx) => safeNum(ctx.get(W2_OUTPUTS.jointWithholding)),
};

/**
 * Registration order (add new entries before W2_INITIAL_AGGREGATORS):
 *   ...F8949_INITIAL_AGGREGATORS,
 *   ...SCHEDULE_D_NODES,
 */
export const F1040_NODES: NodeDefinition[] = [
  line1a_w2Wages,
  line2a_taxExemptInterest,
  line2b_taxableInterest,
  line3a_qualifiedDividends,
  line3b_ordinaryDividends,
  line7_capitalGains,
  line9_totalIncome,
  earnedIncome,
  line10_adjustmentsToIncome,
  line11_adjustedGrossIncome,
  line12input_primaryAge,
  line12input_primaryBlind,
  line12input_spouseAge,
  line12input_spouseBlind,
  line12input_isDependentFiler,
  line12input_earnedIncomeForDependent,
  line12_standardDeduction,
  line13_qbiDeduction,
  line15_taxableIncome,
  line16_tax,
  line17_additionalTaxes,
  line24_totalTax,
  line25a_w2Withholding,
];

export const F1040_OUTPUTS = {
  w2Wages: `${FORM_ID}.joint.line1a_w2Wages`,
  taxExemptInterest: `${FORM_ID}.joint.line2a_taxExemptInterest`,
  taxableInterest: `${FORM_ID}.joint.line2b_taxableInterest`,
  qualifiedDividends: `${FORM_ID}.joint.line3a_qualifiedDividends`,
  ordinaryDividends: `${FORM_ID}.joint.line3b_ordinaryDividends`,
  capitalGains: `${FORM_ID}.joint.line7_capitalGains`,
  totalIncome: `${FORM_ID}.joint.line9_totalIncome`,
  earnedIncome: `${FORM_ID}.joint.earnedIncome`,
  adjustedGrossIncome: `${FORM_ID}.joint.line11_adjustedGrossIncome`,
  standardDeduction: `${FORM_ID}.joint.line12_deduction`,
  taxableIncome: `${FORM_ID}.joint.line15_taxableIncome`,
  tax: `${FORM_ID}.joint.line16_tax`,
  additionalTaxes: `${FORM_ID}.joint.line17_additionalTaxes`,
  totalTax: `${FORM_ID}.joint.line24_totalTax`,
  w2Withholding: `${FORM_ID}.joint.line25a_w2Withholding`,
} as const;