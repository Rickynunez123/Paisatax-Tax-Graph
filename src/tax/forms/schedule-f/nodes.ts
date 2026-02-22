/**
 * SCHEDULE F — PROFIT OR LOSS FROM FARMING
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *
 *   Part I — Farm Income (Cash Method)
 *   ✅ Line 1a — Sales of livestock and other items you bought for resale
 *   ✅ Line 1b — Cost or other basis
 *   ✅ Line 1c — Gain/loss on livestock resale (1a − 1b)
 *   ✅ Line 2  — Sales of livestock, produce, grains raised (not for resale)
 *   ✅ Line 3a — Cooperative distributions (gross amount)
 *   ✅ Line 3b — Cooperative distributions (taxable amount)
 *   ✅ Line 4a — Agricultural program payments (gross)
 *   ✅ Line 4b — Agricultural program payments (taxable)
 *   ✅ Line 5a — CCC loans reported under election
 *   ✅ Line 5b — CCC loans forfeited
 *   ✅ Line 6  — Crop insurance proceeds and disaster payments (cash basis)
 *   ✅ Line 7  — Custom hire (machine work) income
 *   ✅ Line 8  — Other income including federal and state gasoline credits
 *   ✅ Line 9  — Gross income (computed)
 *
 *   Part II — Farm Expenses
 *   ✅ Line 10 — Car and truck expenses (computed from mileage)
 *   ✅ Line 10b — Parking fees and tolls (added to Line 10)
 *   ✅ Line 11 — Chemicals
 *   ✅ Line 12 — Conservation expenses (Form 8645 — deferred input)
 *   ✅ Line 13 — Custom hire (machine work)
 *   ✅ Line 14 — Depreciation (Form 4562 — deferred input)
 *   ✅ Line 15 — Employee benefit programs
 *   ✅ Line 16 — Feed purchased
 *   ✅ Line 17 — Fertilizers and lime
 *   ✅ Line 18 — Freight and trucking
 *   ✅ Line 19 — Gasoline, fuel, and oil
 *   ✅ Line 20 — Insurance (other than health)
 *   ✅ Line 21 — Interest (mortgage)
 *   ✅ Line 22 — Interest (other)
 *   ✅ Line 23 — Labor hired (less employment credits)
 *   ✅ Line 24 — Pension and profit-sharing plans (deferred input)
 *   ✅ Line 25 — Rent or lease — vehicles, machinery, equipment
 *   ✅ Line 26 — Rent or lease — other (land, etc.)
 *   ✅ Line 27 — Repairs and maintenance
 *   ✅ Line 28 — Seeds and plants purchased
 *   ✅ Line 29 — Storage and warehousing
 *   ✅ Line 30 — Supplies purchased
 *   ✅ Line 31 — Taxes
 *   ✅ Line 32 — Utilities
 *   ✅ Line 33 — Veterinary, breeding, and medicine
 *   ✅ Line 34 — Other expenses (deferred input)
 *   ✅ Line 35 — Total expenses (computed)
 *   ✅ Line 36 — Net farm profit or (loss) (Line 9 − Line 35)
 *   ✅ Line 37 — If a loss, enter amount at risk (deferred — all treated as at-risk)
 *
 *   Part III — Farm Income — Accrual Method
 *   🚧 Deferred — most farmers use cash method
 *
 *   Vehicle Information
 *   ✅ Lines 42a–e — Vehicle miles and documentation (same pattern as Schedule C)
 *
 * SLOT PATTERN:
 *   Each farm operation is one slot. Multiple farms = multiple slots.
 *   Owner: PRIMARY or SPOUSE (who owns/operates the farm).
 *   Slot ID: scheduleF.{owner}.s{index}.{field}
 *
 * AGGREGATORS:
 *   scheduleF.primary.totalNetProfit — sum of net profit across all primary slots
 *   scheduleF.spouse.totalNetProfit  — sum of net profit across all spouse slots
 *   scheduleF.joint.totalNetProfit   — primary + spouse (feeds Schedule 1 Line 6)
 *
 * CONNECTIONS TO OTHER FORMS:
 *   scheduleF.joint.totalNetProfit → schedule1.joint.line6_farmIncome  (Schedule 1 Line 6)
 *   scheduleF.joint.totalNetProfit → scheduleSE.joint.line3_netProfitFromSE (SE tax base)
 *   scheduleF.joint.totalNetProfit → f1040.joint.earnedIncome (credit calculations)
 *
 * IRS References:
 *   Schedule F Instructions (Form 1040) (2025)
 *   IRS Pub 225 — Farmer's Tax Guide (2025)
 *   IRC §162, §175, §263A, §1231
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';
import { getScheduleFConstants } from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'scheduleF';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateScheduleFSlotNodes(
  owner:     NodeOwner,
  slotIndex: number,
): NodeDefinition[] {
  const ownerStr = owner === NodeOwner.PRIMARY ? 'primary' : 'spouse';
  const slotId   = `${FORM_ID}.${ownerStr}.s${slotIndex}`;

  return [

    // ── Farm identification ─────────────────────────────────────────────────

    {
      id: `${slotId}.farmName`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Farm Name or Description`,
      description: 'Name of the farm or type of farming activity (e.g., "Smith Family Farm", "Corn and Soybean Operation").',
      valueType: NodeValueType.STRING, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.farmName', defaultValue: '',
    },

    {
      id: `${slotId}.farmEIN`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Farm EIN`,
      description: 'Employer Identification Number if the farm has one. Leave blank if sole proprietor using SSN.',
      valueType: NodeValueType.STRING, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.farmEIN', defaultValue: '',
    },

    {
      id: `${slotId}.accountingMethod`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Accounting Method`,
      description: '"cash" or "accrual". Most small family farms use cash basis.',
      valueType: NodeValueType.ENUM, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.accountingMethod',
      defaultValue: 'cash', validation: { allowedValues: ['cash', 'accrual'] },
    },

    {
      id: `${slotId}.materialParticipation`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Material Participation?`,
      description: 'Did the farmer materially participate in the farm operation in 2025? Required for passive activity loss rules. Most active farmers answer Yes.',
      valueType: NodeValueType.BOOLEAN, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.materialParticipation', defaultValue: true,
    },

    // ── Part I — Farm Income ────────────────────────────────────────────────

    {
      id: `${slotId}.line1a_livestockResaleSales`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 1a: Sales of Livestock Bought for Resale`,
      description: 'Gross sales price of livestock and other items you purchased and then sold (not raised). This is the gross proceeds, not profit.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line1a_livestockResaleSales', defaultValue: 0,
    },

    {
      id: `${slotId}.line1b_livestockResaleCost`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 1b: Cost or Other Basis of Livestock for Resale`,
      description: 'Your cost or other basis in the livestock or items sold on Line 1a.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line1b_livestockResaleCost', defaultValue: 0,
    },

    {
      id: `${slotId}.line1c_livestockResaleGain`, kind: NodeKind.COMPUTED,
      label: `Schedule F Slot ${slotIndex} — Line 1c: Gain or Loss on Livestock Resale (1a − 1b)`,
      description: 'Net gain or loss on livestock purchased for resale. Can be negative.',
      valueType: NodeValueType.CURRENCY, allowNegative: true, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      dependencies: [`${slotId}.line1a_livestockResaleSales`, `${slotId}.line1b_livestockResaleCost`],
      compute: (ctx) =>
        safeNum(ctx.get(`${slotId}.line1a_livestockResaleSales`)) -
        safeNum(ctx.get(`${slotId}.line1b_livestockResaleCost`)),
    },

    {
      id: `${slotId}.line2_salesRaisedLivestock`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 2: Sales of Livestock, Produce, Grains Raised`,
      description: 'Total sales of livestock, produce, grains, and other farm products you RAISED (not purchased for resale). Includes dairy sales, crop sales, egg sales, etc.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line2_salesRaisedLivestock', defaultValue: 0,
    },

    {
      id: `${slotId}.line3a_cooperativeGross`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 3a: Cooperative Distributions — Gross Amount`,
      description: 'Gross amount of distributions received from agricultural cooperatives. Reported on Form 1099-PATR.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line3a_cooperativeGross', defaultValue: 0,
    },

    {
      id: `${slotId}.line3b_cooperativeTaxable`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 3b: Cooperative Distributions — Taxable Amount`,
      description: 'Taxable portion of cooperative distributions from Line 3a. From Form 1099-PATR Box 1.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line3b_cooperativeTaxable', defaultValue: 0,
    },

    {
      id: `${slotId}.line4a_agProgramGross`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 4a: Agricultural Program Payments — Gross`,
      description: 'Gross agricultural program payments received from USDA (CRP, ARC, PLC, etc.). Reported on Form 1099-G.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line4a_agProgramGross', defaultValue: 0,
    },

    {
      id: `${slotId}.line4b_agProgramTaxable`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 4b: Agricultural Program Payments — Taxable`,
      description: 'Taxable portion of agricultural program payments from Line 4a.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line4b_agProgramTaxable', defaultValue: 0,
    },

    {
      id: `${slotId}.line5a_cccLoansElection`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 5a: CCC Loans Reported Under Election`,
      description: 'Commodity Credit Corporation loan amounts reported as income under election (treating loans as income in the year received). If no election, leave blank.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line5a_cccLoansElection', defaultValue: 0,
    },

    {
      id: `${slotId}.line5b_cccLoansForfeited`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 5b: CCC Loans Forfeited`,
      description: 'Amount of CCC loan forfeited (collateral retained by CCC). This is taxable income.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line5b_cccLoansForfeited', defaultValue: 0,
    },

    {
      id: `${slotId}.line6_cropInsurance`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 6: Crop Insurance Proceeds and Disaster Payments`,
      description: 'Proceeds from crop insurance or disaster payments received in 2025. Cash method farmers may elect to postpone income to the following year if the crop would normally be sold in the following year.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line6_cropInsurance', defaultValue: 0,
    },

    {
      id: `${slotId}.line7_customHireIncome`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 7: Custom Hire (Machine Work) Income`,
      description: 'Income received for providing custom farm services (plowing, harvesting, etc.) on other people\'s farms using your equipment.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line7_customHireIncome', defaultValue: 0,
    },

    {
      id: `${slotId}.line8_otherIncome`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 8: Other Farm Income`,
      description: 'Other income from farming not included above. Includes state and federal gasoline or fuel tax credits/refunds, income from breeding fees, sale of farm-raised fish, and other miscellaneous farm income.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line8_otherIncome', defaultValue: 0,
    },

    {
      id: `${slotId}.line9_grossIncome`, kind: NodeKind.COMPUTED,
      label: `Schedule F Slot ${slotIndex} — Line 9: Gross Farm Income`,
      description: 'Sum of all income lines: livestock resale gain (1c) + sales of raised livestock (2) + taxable cooperative distributions (3b) + taxable ag program payments (4b) + CCC loans election (5a) + CCC forfeited (5b) + crop insurance (6) + custom hire income (7) + other income (8).',
      valueType: NodeValueType.CURRENCY, allowNegative: true, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      dependencies: [
        `${slotId}.line1c_livestockResaleGain`,
        `${slotId}.line2_salesRaisedLivestock`,
        `${slotId}.line3b_cooperativeTaxable`,
        `${slotId}.line4b_agProgramTaxable`,
        `${slotId}.line5a_cccLoansElection`,
        `${slotId}.line5b_cccLoansForfeited`,
        `${slotId}.line6_cropInsurance`,
        `${slotId}.line7_customHireIncome`,
        `${slotId}.line8_otherIncome`,
      ],
      compute: (ctx) => [
        `${slotId}.line1c_livestockResaleGain`,
        `${slotId}.line2_salesRaisedLivestock`,
        `${slotId}.line3b_cooperativeTaxable`,
        `${slotId}.line4b_agProgramTaxable`,
        `${slotId}.line5a_cccLoansElection`,
        `${slotId}.line5b_cccLoansForfeited`,
        `${slotId}.line6_cropInsurance`,
        `${slotId}.line7_customHireIncome`,
        `${slotId}.line8_otherIncome`,
      ].reduce((sum, id) => sum + safeNum(ctx.get(id)), 0),
    },

    // ── Part II — Farm Expenses ─────────────────────────────────────────────

    {
      id: `${slotId}.line10b_parkingTolls`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 10: Parking Fees and Tolls (Added to Mileage)`,
      description: 'Farm-related parking fees and tolls. Added to standard mileage deduction to compute Line 10 total.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line10b_parkingTolls', defaultValue: 0,
    },

    {
      id: `${slotId}.line11_chemicals`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 11: Chemicals`,
      description: 'Cost of herbicides, fungicides, insecticides, and other chemicals used in farming operations.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line11_chemicals', defaultValue: 0,
    },

    {
      id: `${slotId}.line12_conservationExpenses`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 12: Conservation Expenses`,
      description: 'Soil and water conservation expenses. Deductible up to 25% of gross farm income. Any excess is deductible in future years. Deferred — enter manually if applicable.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line12_conservationExpenses', defaultValue: 0,
    },

    {
      id: `${slotId}.line13_customHireExpense`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 13: Custom Hire (Machine Work) Expense`,
      description: 'Amounts paid to others for custom farm work using their equipment (contract harvesting, aerial application, etc.).',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line13_customHireExpense', defaultValue: 0,
    },

    {
      id: `${slotId}.line14_depreciation`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 14: Depreciation (Form 4562)`,
      description: 'Depreciation and Section 179 deduction for farm equipment, buildings, and other assets. Deferred — enter from Form 4562 if applicable.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line14_depreciation', defaultValue: 0,
    },

    {
      id: `${slotId}.line15_employeeBenefits`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 15: Employee Benefit Programs`,
      description: 'Contributions to employee health, life, and other benefit programs. Does not include amounts for owner coverage.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line15_employeeBenefits', defaultValue: 0,
    },

    {
      id: `${slotId}.line16_feedPurchased`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 16: Feed Purchased`,
      description: 'Cost of feed purchased for livestock. Cash method farmers deduct in the year paid.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line16_feedPurchased', defaultValue: 0,
    },

    {
      id: `${slotId}.line17_fertilizersLime`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 17: Fertilizers and Lime`,
      description: 'Cost of fertilizers, lime, and other soil amendments applied to farmland.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line17_fertilizersLime', defaultValue: 0,
    },

    {
      id: `${slotId}.line18_freightTrucking`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 18: Freight and Trucking`,
      description: 'Freight charges and trucking costs for transporting farm products to market or farm supplies to the farm.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line18_freightTrucking', defaultValue: 0,
    },

    {
      id: `${slotId}.line19_gasolineFuelOil`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 19: Gasoline, Fuel, and Oil`,
      description: 'Cost of gasoline, diesel fuel, propane, and oil used in farm operations. Does not include fuel used in a vehicle claimed on Line 10 (standard mileage rate already includes fuel).',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line19_gasolineFuelOil', defaultValue: 0,
    },

    {
      id: `${slotId}.line20_insurance`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 20: Insurance (Other Than Health)`,
      description: 'Farm insurance premiums: crop insurance, livestock insurance, farm liability, farm property insurance. Do NOT include health insurance (deducted on Schedule 1 Line 17).',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line20_insurance', defaultValue: 0,
    },

    {
      id: `${slotId}.line21_mortgageInterest`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 21: Interest — Mortgage (Paid to Banks)`,
      description: 'Mortgage interest paid on farm real estate (reported on Form 1098). Do not include home mortgage interest — that goes on Schedule A.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line21_mortgageInterest', defaultValue: 0,
    },

    {
      id: `${slotId}.line22_otherInterest`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 22: Interest — Other`,
      description: 'Other farm business interest paid in 2025. Includes operating loans, equipment financing, lines of credit for farm operations.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line22_otherInterest', defaultValue: 0,
    },

    {
      id: `${slotId}.line23_laborHired`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 23: Labor Hired (Less Employment Credits)`,
      description: 'Gross wages paid to farm employees, reduced by any employment credits (Work Opportunity Credit, etc.). Issue W-2s to employees and report on Form 943.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line23_laborHired', defaultValue: 0,
    },

    {
      id: `${slotId}.line24_pensionPlans`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 24: Pension and Profit-Sharing Plans`,
      description: 'Contributions to qualified retirement plans for farm employees. Deferred — enter manually if applicable.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line24_pensionPlans', defaultValue: 0,
    },

    {
      id: `${slotId}.line25_rentLeaseVehicles`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 25: Rent or Lease — Vehicles, Machinery, Equipment`,
      description: 'Rent/lease payments for farm vehicles, machinery, and equipment. Do not include vehicle lease if claiming standard mileage for that vehicle.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line25_rentLeaseVehicles', defaultValue: 0,
    },

    {
      id: `${slotId}.line26_rentLeaseLand`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 26: Rent or Lease — Land, Animals, Other`,
      description: 'Rent paid for farmland, grazing rights, or other farm property. A very common expense for tenant farmers.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line26_rentLeaseLand', defaultValue: 0,
    },

    {
      id: `${slotId}.line27_repairs`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 27: Repairs and Maintenance`,
      description: 'Cost of repairing farm equipment, buildings, fences, and drainage systems. Improvements that extend useful life are capital expenditures (Form 4562), not repairs.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line27_repairs', defaultValue: 0,
    },

    {
      id: `${slotId}.line28_seedsPlants`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 28: Seeds and Plants Purchased`,
      description: 'Cost of seed, seedlings, and plants purchased for planting. Cash method farmers deduct when paid.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line28_seedsPlants', defaultValue: 0,
    },

    {
      id: `${slotId}.line29_storageWarehousing`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 29: Storage and Warehousing`,
      description: 'Charges for storing farm products (grain storage, elevator fees, cold storage for produce or dairy).',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line29_storageWarehousing', defaultValue: 0,
    },

    {
      id: `${slotId}.line30_supplies`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 30: Supplies Purchased`,
      description: 'Farm supplies consumed in operations: twine, wire, small tools, containers, packaging materials.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line30_supplies', defaultValue: 0,
    },

    {
      id: `${slotId}.line31_taxes`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 31: Taxes`,
      description: 'Farm-related taxes paid: real estate taxes on farm property, employer share of payroll taxes (FICA, FUTA), state/local taxes on farm operations. Do not include federal income tax.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line31_taxes', defaultValue: 0,
    },

    {
      id: `${slotId}.line32_utilities`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 32: Utilities`,
      description: 'Electricity, water, telephone, and other utility costs for farm operations. Do not include utilities for personal living quarters.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line32_utilities', defaultValue: 0,
    },

    {
      id: `${slotId}.line33_vetBreedingMedicine`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 33: Veterinary, Breeding, and Medicine`,
      description: 'Veterinary fees, artificial insemination, livestock medicine, and other animal health costs.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line33_vetBreedingMedicine', defaultValue: 0,
    },

    {
      id: `${slotId}.line34_otherExpenses`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 34: Other Farm Expenses`,
      description: 'Other ordinary and necessary farm expenses not included above. Examples: accounting/legal fees, dues to farm organizations, subscriptions to farm publications, bank fees on farm accounts.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line34_otherExpenses', defaultValue: 0,
    },

    // ── Vehicle Information (Lines 42a–e) ───────────────────────────────────

    {
      id: `${slotId}.line42a_businessMiles`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 42a: Business Miles`,
      description: 'Total miles driven for farm business purposes in 2025. Multiply by $0.70 to get the mileage deduction. A mileage log is required.',
      valueType: NodeValueType.INTEGER, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line42a_businessMiles', defaultValue: 0,
    },

    {
      id: `${slotId}.line42b_commutingMiles`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 42b: Commuting Miles`,
      description: 'Miles between home and the farm. Generally not deductible unless the taxpayer\'s principal place of business is the farm home.',
      valueType: NodeValueType.INTEGER, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line42b_commutingMiles', defaultValue: 0,
    },

    {
      id: `${slotId}.line42c_otherMiles`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 42c: Other (Personal) Miles`,
      description: 'Non-business, non-commuting miles.',
      valueType: NodeValueType.INTEGER, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line42c_otherMiles', defaultValue: 0,
    },

    {
      id: `${slotId}.line42d_evidenceToSupport`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 42d: Evidence to Support Mileage Deduction?`,
      description: 'Do you have written records (mileage log) supporting the vehicle deduction?',
      valueType: NodeValueType.BOOLEAN, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line42d_evidenceToSupport', defaultValue: false,
    },

    {
      id: `${slotId}.line42e_writtenEvidence`, kind: NodeKind.INPUT,
      label: `Schedule F Slot ${slotIndex} — Line 42e: Is the Evidence Written?`,
      description: 'Is the mileage evidence in written form?',
      valueType: NodeValueType.BOOLEAN, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleF.q.line42e_writtenEvidence', defaultValue: false,
    },

    // ── Computed Line 10 — Car and Truck Expenses ────────────────────────────

    {
      id: `${slotId}.line10_carTruckExpenses`, kind: NodeKind.COMPUTED,
      label: `Schedule F Slot ${slotIndex} — Line 10: Car and Truck Expenses`,
      description: 'Standard mileage deduction: business miles × $0.70 plus parking fees and tolls. Flows to Line 35 total expenses.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      dependencies: [
        `${slotId}.line42a_businessMiles`,
        `${slotId}.line10b_parkingTolls`,
      ],
      compute: (ctx) => {
        const c            = getScheduleFConstants(ctx.taxYear);
        const miles        = safeNum(ctx.get(`${slotId}.line42a_businessMiles`));
        const parkingTolls = safeNum(ctx.get(`${slotId}.line10b_parkingTolls`));
        return Math.round((miles * c.standardMileageRate + parkingTolls) * 100) / 100;
      },
    },

    // ── Line 35 — Total Farm Expenses (COMPUTED) ────────────────────────────

    {
      id: `${slotId}.line35_totalExpenses`, kind: NodeKind.COMPUTED,
      label: `Schedule F Slot ${slotIndex} — Line 35: Total Farm Expenses`,
      description: 'Sum of all deductible farm expenses (Lines 10–34).',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      dependencies: [
        `${slotId}.line10_carTruckExpenses`,
        `${slotId}.line11_chemicals`,
        `${slotId}.line12_conservationExpenses`,
        `${slotId}.line13_customHireExpense`,
        `${slotId}.line14_depreciation`,
        `${slotId}.line15_employeeBenefits`,
        `${slotId}.line16_feedPurchased`,
        `${slotId}.line17_fertilizersLime`,
        `${slotId}.line18_freightTrucking`,
        `${slotId}.line19_gasolineFuelOil`,
        `${slotId}.line20_insurance`,
        `${slotId}.line21_mortgageInterest`,
        `${slotId}.line22_otherInterest`,
        `${slotId}.line23_laborHired`,
        `${slotId}.line24_pensionPlans`,
        `${slotId}.line25_rentLeaseVehicles`,
        `${slotId}.line26_rentLeaseLand`,
        `${slotId}.line27_repairs`,
        `${slotId}.line28_seedsPlants`,
        `${slotId}.line29_storageWarehousing`,
        `${slotId}.line30_supplies`,
        `${slotId}.line31_taxes`,
        `${slotId}.line32_utilities`,
        `${slotId}.line33_vetBreedingMedicine`,
        `${slotId}.line34_otherExpenses`,
      ],
      compute: (ctx) => [
        `${slotId}.line10_carTruckExpenses`,
        `${slotId}.line11_chemicals`,
        `${slotId}.line12_conservationExpenses`,
        `${slotId}.line13_customHireExpense`,
        `${slotId}.line14_depreciation`,
        `${slotId}.line15_employeeBenefits`,
        `${slotId}.line16_feedPurchased`,
        `${slotId}.line17_fertilizersLime`,
        `${slotId}.line18_freightTrucking`,
        `${slotId}.line19_gasolineFuelOil`,
        `${slotId}.line20_insurance`,
        `${slotId}.line21_mortgageInterest`,
        `${slotId}.line22_otherInterest`,
        `${slotId}.line23_laborHired`,
        `${slotId}.line24_pensionPlans`,
        `${slotId}.line25_rentLeaseVehicles`,
        `${slotId}.line26_rentLeaseLand`,
        `${slotId}.line27_repairs`,
        `${slotId}.line28_seedsPlants`,
        `${slotId}.line29_storageWarehousing`,
        `${slotId}.line30_supplies`,
        `${slotId}.line31_taxes`,
        `${slotId}.line32_utilities`,
        `${slotId}.line33_vetBreedingMedicine`,
        `${slotId}.line34_otherExpenses`,
      ].reduce((sum, id) => sum + safeNum(ctx.get(id)), 0),
    },

    // ── Line 36 — Net Farm Profit or (Loss) ─────────────────────────────────

    {
      id: `${slotId}.line36_netProfitLoss`, kind: NodeKind.COMPUTED,
      label: `Schedule F Slot ${slotIndex} — Line 36: Net Farm Profit or (Loss)`,
      description: 'Gross income (Line 9) minus total expenses (Line 35). This is the bottom line — flows to Schedule 1 Line 6 and is subject to self-employment tax if positive.',
      valueType: NodeValueType.CURRENCY, allowNegative: true, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      dependencies: [`${slotId}.line9_grossIncome`, `${slotId}.line35_totalExpenses`],
      compute: (ctx) =>
        safeNum(ctx.get(`${slotId}.line9_grossIncome`)) -
        safeNum(ctx.get(`${slotId}.line35_totalExpenses`)),
    },

  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATOR GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateScheduleFAggregators(
  primarySlots: number[],
  spouseSlots:  number[],
): NodeDefinition[] {
  const nodes: NodeDefinition[] = [];

  for (const [ownerStr, slots] of [
    ['primary', primarySlots],
    ['spouse',  spouseSlots],
  ] as const) {
    const owner = ownerStr === 'primary' ? NodeOwner.PRIMARY : NodeOwner.SPOUSE;
    nodes.push({
      id:                 `${FORM_ID}.${ownerStr}.totalNetProfit`,
      kind:               NodeKind.COMPUTED,
      label:              `Schedule F (${ownerStr}) — Total Net Farm Profit or (Loss)`,
      description:        `Sum of Line 36 net profit/loss across all ${ownerStr} Schedule F farm operations.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      true,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.selfEmployment'],
      dependencies:       slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.line36_netProfitLoss`),
      compute: (ctx) => slots.reduce((sum, i) =>
        sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.line36_netProfitLoss`)), 0),
    });
  }

  // Joint total — feeds Schedule 1 Line 6 and Schedule SE
  nodes.push({
    id:                 `${FORM_ID}.joint.totalNetProfit`,
    kind:               NodeKind.COMPUTED,
    label:              'Schedule F (Joint) — Total Net Farm Profit or (Loss)',
    description:        'Combined net farm profit/loss from all farm operations (primary + spouse). Flows to Schedule 1 Line 6 and Schedule SE (SE tax base).',
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      true,
    owner:              NodeOwner.JOINT,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['income.selfEmployment'],
    dependencies:       [
      `${FORM_ID}.primary.totalNetProfit`,
      `${FORM_ID}.spouse.totalNetProfit`,
    ],
    compute: (ctx) =>
      safeNum(ctx.get(`${FORM_ID}.primary.totalNetProfit`)) +
      safeNum(ctx.get(`${FORM_ID}.spouse.totalNetProfit`)),
  });

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL AGGREGATORS (no slots — zero base state)
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEDULE_F_INITIAL_AGGREGATORS: NodeDefinition[] =
  generateScheduleFAggregators([], []);

export const SCHEDULE_F_OUTPUTS = {
  primaryNetProfit: `${FORM_ID}.primary.totalNetProfit`,
  spouseNetProfit:  `${FORM_ID}.spouse.totalNetProfit`,
  jointNetProfit:   `${FORM_ID}.joint.totalNetProfit`,
} as const;