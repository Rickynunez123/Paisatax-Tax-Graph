/**
 * SCHEDULE 3 — ADDITIONAL CREDITS AND PAYMENTS
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   Part I — Non-Refundable Credits
 *   ✅ Line 1  — Foreign tax credit (Form 1116)         input, deferred
 *   ✅ Line 2  — Child/dependent care credit (Form 2441) computed from F2441
 *   ✅ Line 3  — Education credits (Form 8863)           computed from F8863
 *   ✅ Line 4  — Retirement savings credit (Form 8880)   input, deferred
 *   ✅ Line 5  — Residential clean energy (Form 5695 §25D) computed from F5695
 *   ✅ Line 5b — Energy efficient home improvement (Form 5695 §25C) computed
 *   ✅ Line 6a — Child tax credit / ODC (Form 8812)      computed from F8812
 *   ✅ Line 6b — Adoption credit (Form 8839)             input, deferred
 *   ✅ Line 6d — General business credit (Form 3800)     computed from F3800
 *   ✅ Line 6e — Clean vehicle credit (Form 8936)        computed from F8936
 *   ✅ Line 6j — Alternative fuel vehicle (Form 8911)    computed from F8911
 *   ✅ Line 8  — Total non-refundable credits            computed
 *
 *   Part II — Other Payments and Refundable Credits
 *   ✅ Line 9  — Net premium tax credit (Form 8962)      input, deferred
 *   ✅ Line 10 — Amount paid with extension (Form 4868)  computed from F4868
 *   ✅ Line 11 — Excess social security withheld         input
 *   ✅ Line 13a — Additional child tax credit (Form 8812) computed from F8812
 *   ✅ Line 13b — AOC refundable portion (Form 8863)     computed from F8863
 *   ✅ Line 15 — Total other payments/credits            computed → 1040 Line 31
 *
 * F5695 WIRING (TWO SEPARATE LINES):
 *   Line 5  = F5695 §25D Residential Clean Energy (Part I)
 *   Line 5b = F5695 §25C Energy Efficient Improvement (Part II)
 *
 * IRS References:
 *   Schedule 3 Instructions (2025)
 *   Form 1040 Line 31 = Schedule 3 Line 15
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import { F2441_OUTPUTS }  from '../f2441/nodes';
import { F8863_OUTPUTS }  from '../f8863/nodes';
import { F5695_OUTPUTS }  from '../f5695/nodes';
import { F8812_OUTPUTS }  from '../f8812/nodes';
import { F3800_OUTPUTS }  from '../f3800/nodes';
import { F8936_OUTPUTS }  from '../f8936/nodes';
import { F8911_OUTPUTS }  from '../f8911/nodes';
import { F4868_OUTPUTS }  from '../f4868/nodes';
import { F8880_OUTPUTS }  from '../f8880/nodes';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'schedule3';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

const line1_foreignTaxCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line1_foreignTaxCredit`,
  kind: NodeKind.INPUT,
  label: 'Schedule 3 Line 1 — Foreign Tax Credit (Form 1116)',
  description: 'Credit for income taxes paid to a foreign country or US possession. Deferred — enter manually from Form 1116 if applicable.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  source: InputSource.PREPARER,
  questionId: 'schedule3.q.foreignTaxCredit',
  defaultValue: 0,
};

const line2_childDependentCareCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line2_childDependentCareCredit`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 2 — Child and Dependent Care Credit (Form 2441)',
  description: 'Credit for qualifying child/dependent care expenses. From Form 2441 Line 11.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [F2441_OUTPUTS.credit],
  compute: (ctx) => safeNum(ctx.get(F2441_OUTPUTS.credit)),
  isApplicable: (ctx) => safeNum(ctx.get(F2441_OUTPUTS.credit)) > 0,
};

const line3_educationCredits: NodeDefinition = {
  id: `${FORM_ID}.joint.line3_educationCredits`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 3 — Education Credits (Form 8863)',
  description: 'Non-refundable education credits: American Opportunity Credit (non-refundable portion) and Lifetime Learning Credit. From Form 8863.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [F8863_OUTPUTS.nonRefundableEducationCredit],
  compute: (ctx) => safeNum(ctx.get(F8863_OUTPUTS.nonRefundableEducationCredit)),
  isApplicable: (ctx) => safeNum(ctx.get(F8863_OUTPUTS.nonRefundableEducationCredit)) > 0,
};

const line4_retirementSavingsCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line4_retirementSavingsCredit`,
  kind: NodeKind.COMPUTED,
  label: "Schedule 3 Line 4 — Retirement Savings Credit (Form 8880)",
  description: "Saver's Credit from Form 8880 Line 9.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [F8880_OUTPUTS.credit],
  compute: (ctx) => safeNum(ctx.get(F8880_OUTPUTS.credit)),
  isApplicable: (ctx) => safeNum(ctx.get(F8880_OUTPUTS.credit)) > 0,
};

/** §25D Residential Clean Energy Credit → Schedule 3 Line 5 */
const line5_residentialCleanEnergyCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line5_residentialCleanEnergyCredit`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 5 — Residential Clean Energy Credit §25D (Form 5695)',
  description: '30% credit for solar, wind, geothermal, battery storage, fuel cells. From Form 5695 Part I Line 15. Carryforward to 2026 if unused. Last year under OBBBA.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [F5695_OUTPUTS.partICredit],
  compute: (ctx) => safeNum(ctx.get(F5695_OUTPUTS.partICredit)),
  isApplicable: (ctx) => safeNum(ctx.get(F5695_OUTPUTS.partICredit)) > 0,
};

/** §25C Energy Efficient Home Improvement Credit → Schedule 3 Line 5b */
const line5b_energyEfficientCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line5b_energyEfficientCredit`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 5b — Energy Efficient Home Improvement Credit §25C (Form 5695)',
  description: '30% credit for insulation, windows, doors, heat pumps, biomass stoves, electrical panels, audits. Max $1,200 + $2,000 heat pumps = $3,200/year. No carryforward. From Form 5695 Part II Line 32.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [F5695_OUTPUTS.partIICredit],
  compute: (ctx) => safeNum(ctx.get(F5695_OUTPUTS.partIICredit)),
  isApplicable: (ctx) => safeNum(ctx.get(F5695_OUTPUTS.partIICredit)) > 0,
};

const line6a_childTaxCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line6a_childTaxCredit`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 6a — Child Tax Credit / Credit for Other Dependents (Form 8812)',
  description: 'Non-refundable portion of the child tax credit and credit for other dependents. From Form 8812 Line 14.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [F8812_OUTPUTS.nonRefundableCredit],
  compute: (ctx) => safeNum(ctx.get(F8812_OUTPUTS.nonRefundableCredit)),
  isApplicable: (ctx) => safeNum(ctx.get(F8812_OUTPUTS.nonRefundableCredit)) > 0,
};

const line6b_adoptionCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line6b_adoptionCredit`,
  kind: NodeKind.INPUT,
  label: 'Schedule 3 Line 6b — Adoption Credit (Form 8839)',
  description: 'Credit for qualifying adoption expenses. Deferred — enter manually from Form 8839 if applicable.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  source: InputSource.PREPARER,
  questionId: 'schedule3.q.adoptionCredit',
  defaultValue: 0,
};

const line6d_generalBusinessCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line6d_generalBusinessCredit`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 6d — General Business Credit (Form 3800)',
  description: 'Combines multiple business credits into one amount. From Form 3800 Line 38.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [F3800_OUTPUTS.totalCredit],
  compute: (ctx) => safeNum(ctx.get(F3800_OUTPUTS.totalCredit)),
  isApplicable: (ctx) => safeNum(ctx.get(F3800_OUTPUTS.totalCredit)) > 0,
};

const line6e_cleanVehicleCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line6e_cleanVehicleCredit`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 6e — Clean Vehicle Credit (Form 8936)',
  description: 'Credit for qualifying clean vehicles: new §30D (up to $7,500) + used §25E (up to $4,000). Expired for vehicles acquired after September 30, 2025. From Form 8936.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [F8936_OUTPUTS.credit],
  compute: (ctx) => safeNum(ctx.get(F8936_OUTPUTS.credit)),
  isApplicable: (ctx) => safeNum(ctx.get(F8936_OUTPUTS.credit)) > 0,
};

const line6j_alternativeFuelCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line6j_alternativeFuelCredit`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 6j — Alternative Fuel Vehicle Refueling Property Credit (Form 8911)',
  description: 'Personal-use EV charging and alt fuel refueling property at main home. 30% of cost, max $1,000 per item. Must be in eligible census tract. Available through June 30, 2026. From Form 8911 Line 19.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [F8911_OUTPUTS.credit],
  compute: (ctx) => safeNum(ctx.get(F8911_OUTPUTS.credit)),
  isApplicable: (ctx) => safeNum(ctx.get(F8911_OUTPUTS.credit)) > 0,
};

const line8_totalNonRefundableCredits: NodeDefinition = {
  id: `${FORM_ID}.joint.line8_totalNonRefundableCredits`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 8 — Total Non-Refundable Credits',
  description: 'Sum of all Part I non-refundable credits (Lines 1–6j). Flows to Form 1040 Line 20.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.line1_foreignTaxCredit`,
    `${FORM_ID}.joint.line2_childDependentCareCredit`,
    `${FORM_ID}.joint.line3_educationCredits`,
    `${FORM_ID}.joint.line4_retirementSavingsCredit`,
    `${FORM_ID}.joint.line5_residentialCleanEnergyCredit`,
    `${FORM_ID}.joint.line5b_energyEfficientCredit`,
    `${FORM_ID}.joint.line6a_childTaxCredit`,
    `${FORM_ID}.joint.line6b_adoptionCredit`,
    `${FORM_ID}.joint.line6d_generalBusinessCredit`,
    `${FORM_ID}.joint.line6e_cleanVehicleCredit`,
    `${FORM_ID}.joint.line6j_alternativeFuelCredit`,
  ],
  compute: (ctx) => (
    safeNum(ctx.get(`${FORM_ID}.joint.line1_foreignTaxCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line2_childDependentCareCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line3_educationCredits`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line4_retirementSavingsCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line5_residentialCleanEnergyCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line5b_energyEfficientCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line6a_childTaxCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line6b_adoptionCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line6d_generalBusinessCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line6e_cleanVehicleCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line6j_alternativeFuelCredit`))
  ),
};

const line9_netPremiumTaxCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line9_netPremiumTaxCredit`,
  kind: NodeKind.INPUT,
  label: 'Schedule 3 Line 9 — Net Premium Tax Credit (Form 8962)',
  description: 'Net premium tax credit for ACA marketplace coverage. Deferred — enter manually from Form 8962 if applicable.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.refundable'],
  source: InputSource.PREPARER,
  questionId: 'schedule3.q.premiumTaxCredit',
  defaultValue: 0,
};

const line10_amountPaidWithExtension: NodeDefinition = {
  id: `${FORM_ID}.joint.line10_amountPaidWithExtension`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 10 — Amount Paid with Extension (Form 4868)',
  description: 'Amount paid when filing an extension request. From Form 4868 Line 6.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['payment'],
  dependencies: [F4868_OUTPUTS.amountPaid],
  compute: (ctx) => safeNum(ctx.get(F4868_OUTPUTS.amountPaid)),
  isApplicable: (ctx) => safeNum(ctx.get(F4868_OUTPUTS.amountPaid)) > 0,
};

const line11_excessSocialSecurity: NodeDefinition = {
  id: `${FORM_ID}.joint.line11_excessSocialSecurity`,
  kind: NodeKind.INPUT,
  label: 'Schedule 3 Line 11 — Excess Social Security Tax Withheld',
  description: 'Excess SS tax withheld when total wages from multiple employers exceeded the SS wage base ($176,100 for 2025). Enter the excess amount.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['payment'],
  source: InputSource.PREPARER,
  questionId: 'schedule3.q.excessSocialSecurity',
  defaultValue: 0,
  validation: { max: 10918.20 },
};

const line13a_additionalChildTaxCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line13a_additionalChildTaxCredit`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 13a — Additional Child Tax Credit (Form 8812)',
  description: 'Refundable portion of the child tax credit. From Form 8812 Line 27c.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.refundable'],
  dependencies: [F8812_OUTPUTS.additionalChildTaxCredit],
  compute: (ctx) => safeNum(ctx.get(F8812_OUTPUTS.additionalChildTaxCredit)),
  isApplicable: (ctx) => safeNum(ctx.get(F8812_OUTPUTS.additionalChildTaxCredit)) > 0,
};

const line13b_refundableAOC: NodeDefinition = {
  id: `${FORM_ID}.joint.line13b_refundableAOC`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 13b — American Opportunity Credit Refundable Portion (Form 8863)',
  description: '40% of the American Opportunity Credit (up to $1,000 per student) is refundable. From Form 8863.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.refundable'],
  dependencies: [F8863_OUTPUTS.aotcRefundableCredit],
  compute: (ctx) => safeNum(ctx.get(F8863_OUTPUTS.aotcRefundableCredit)),
  isApplicable: (ctx) => safeNum(ctx.get(F8863_OUTPUTS.aotcRefundableCredit)) > 0,
};

const line15_totalOtherPaymentsAndCredits: NodeDefinition = {
  id: `${FORM_ID}.joint.line15_totalOtherPaymentsAndCredits`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule 3 Line 15 — Total Other Payments and Credits',
  description: 'Sum of all Part II credits and payments (Lines 9–14). Flows to Form 1040 Line 31.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.refundable', 'payment'],
  dependencies: [
    `${FORM_ID}.joint.line9_netPremiumTaxCredit`,
    `${FORM_ID}.joint.line10_amountPaidWithExtension`,
    `${FORM_ID}.joint.line11_excessSocialSecurity`,
    `${FORM_ID}.joint.line13a_additionalChildTaxCredit`,
    `${FORM_ID}.joint.line13b_refundableAOC`,
  ],
  compute: (ctx) => (
    safeNum(ctx.get(`${FORM_ID}.joint.line9_netPremiumTaxCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line10_amountPaidWithExtension`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line11_excessSocialSecurity`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line13a_additionalChildTaxCredit`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line13b_refundableAOC`))
  ),
};

export const SCHEDULE3_NODES: NodeDefinition[] = [
  line1_foreignTaxCredit,
  line2_childDependentCareCredit,
  line3_educationCredits,
  line4_retirementSavingsCredit,
  line5_residentialCleanEnergyCredit,
  line5b_energyEfficientCredit,
  line6a_childTaxCredit,
  line6b_adoptionCredit,
  line6d_generalBusinessCredit,
  line6e_cleanVehicleCredit,
  line6j_alternativeFuelCredit,
  line8_totalNonRefundableCredits,
  line9_netPremiumTaxCredit,
  line10_amountPaidWithExtension,
  line11_excessSocialSecurity,
  line13a_additionalChildTaxCredit,
  line13b_refundableAOC,
  line15_totalOtherPaymentsAndCredits,
];

export const SCHEDULE3_OUTPUTS = {
  /** Part I total — flows to Form 1040 Line 20 */
  totalNonRefundableCredits:    `${FORM_ID}.joint.line8_totalNonRefundableCredits`,
  /** Part II total — flows to Form 1040 Line 31 */
  totalOtherPaymentsAndCredits: `${FORM_ID}.joint.line15_totalOtherPaymentsAndCredits`,
} as const;