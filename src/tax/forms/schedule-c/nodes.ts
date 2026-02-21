/**
 * SCHEDULE C — PROFIT OR LOSS FROM BUSINESS (SOLE PROPRIETORSHIP)
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *
 *   Part I — Income
 *   ✅ Line 1  — Gross receipts or sales
 *   ✅ Line 2  — Returns and allowances
 *   ✅ Line 3  — Net receipts (1 − 2)
 *   ✅ Line 4  — Cost of goods sold (deferred input, $0 for service businesses)
 *   ✅ Line 5a — 1099-NEC income (informational — flows into Line 1)
 *   ✅ Line 6  — Other income
 *   ✅ Line 7  — Gross income (3 − 4 + 6)
 *
 *   Part II — Expenses
 *   ✅ Line 8  — Advertising
 *   ✅ Line 9  — Car and truck expenses (COMPUTED from Part IV standard mileage)
 *   ✅ Line 10 — Commissions and fees
 *   ✅ Line 11 — Contract labor
 *   🚧 Line 12 — Depletion (deferred — mining/timber only)
 *   ✅ Line 13 — Depreciation (deferred input — Form 4562 deferred)
 *   ✅ Line 14 — Employee benefit programs
 *   ✅ Line 15 — Insurance (other than health)
 *   ✅ Line 16a — Mortgage interest (to banks)
 *   ✅ Line 16b — Other interest
 *   ✅ Line 17 — Legal and professional services
 *   ✅ Line 18 — Office expense
 *   🚧 Line 19 — Pension/profit-sharing plans (deferred)
 *   ✅ Line 20a — Rent or lease — vehicles, machinery, equipment
 *   ✅ Line 20b — Rent or lease — other business property
 *   ✅ Line 21 — Repairs and maintenance
 *   ✅ Line 22 — Supplies
 *   ✅ Line 23 — Taxes and licenses
 *   ✅ Line 24a — Travel
 *   ✅ Line 24b — Meals (50% limit applied automatically)
 *   ✅ Line 25 — Utilities
 *   ✅ Line 26 — Wages (less employment credits)
 *   ✅ Line 27a — Other expenses (from Part V total)
 *   ✅ Line 28 — Total expenses (COMPUTED)
 *   ✅ Line 29 — Tentative profit/loss (7 − 28)
 *   ✅ Line 30 — Home office deduction (deferred input — Form 8829 deferred)
 *   ✅ Line 31 — Net profit or loss (29 − 30) → Schedule 1 Line 3
 *
 *   Part IV — Information on Your Vehicle
 *   ✅ Line 43 — Date vehicle placed in service
 *   ✅ Line 44a — Business miles
 *   ✅ Line 44b — Commuting miles
 *   ✅ Line 44c — Other miles
 *   ✅ Line 45 — Evidence to support deduction?
 *   ✅ Line 46 — Is evidence written?
 *   ✅ Line 47a — Another vehicle available for personal use?
 *   ✅ Line 47b — Vehicle available for off-duty personal use?
 *   ✅ Parking/tolls input (added to Line 9 on top of mileage)
 *   ✅ Standard mileage deduction (44a × $0.70 + parking/tolls) → Line 9
 *
 * SLOT PATTERN:
 *   Each business is one slot. Multiple businesses = multiple slots.
 *   Owner: PRIMARY or SPOUSE (who owns/operates the business).
 *   Slot ID: scheduleC.{owner}.s{index}.{field}
 *
 * MEALS (50% LIMIT):
 *   The preparer enters actual meals paid (line24b_mealsActual).
 *   The engine computes the deductible amount (× 50%) automatically.
 *   Line 28 (total expenses) uses the 50%-reduced meals amount.
 *
 * VEHICLE — STANDARD MILEAGE ONLY:
 *   Actual expense method requires Form 4562 (depreciation) — deferred.
 *   Standard mileage: business miles × $0.70 + parking + tolls → Line 9.
 *   Part IV fields (lines 43–47) are captured for IRS compliance.
 *
 * AGGREGATORS:
 *   scheduleC.primary.totalNetProfit — sum of net profit across all primary slots
 *   scheduleC.spouse.totalNetProfit  — sum of net profit across all spouse slots
 *   scheduleC.joint.totalNetProfit   — primary + spouse (feeds Schedule 1 Line 3)
 *
 * IRS References:
 *   Schedule C Instructions (Form 1040) (2025)
 *   IRS Pub 463 — Travel, Gift, and Car Expenses
 *   IRS Pub 334 — Tax Guide for Small Business
 *   IRC §162 (ordinary/necessary business expenses), §274(n) (50% meals)
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';
import { getScheduleCConstants } from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'scheduleC';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateScheduleCSlotNodes(
  owner:     NodeOwner,
  slotIndex: number,
): NodeDefinition[] {
  const ownerStr = owner === NodeOwner.PRIMARY ? 'primary' : 'spouse';
  const slotId   = `${FORM_ID}.${ownerStr}.s${slotIndex}`;

  return [

    // ── Business identification ─────────────────────────────────────────────

    {
      id: `${slotId}.businessName`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Business Name`,
      description: 'Name of the business or "Schedule C" for sole proprietors using their own name.',
      valueType: NodeValueType.STRING, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.businessName', defaultValue: '',
    },

    {
      id: `${slotId}.businessEIN`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Business EIN`,
      description: 'Employer Identification Number if the business has one. Leave blank if sole proprietor using SSN.',
      valueType: NodeValueType.STRING, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.businessEIN', defaultValue: '',
    },

    {
      id: `${slotId}.principalBusinessCode`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Principal Business Code`,
      description: 'IRS business activity code from the Schedule C instructions. E.g., 485300 for rideshare, 812990 for personal services.',
      valueType: NodeValueType.STRING, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.principalBusinessCode', defaultValue: '',
    },

    {
      id: `${slotId}.accountingMethod`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Accounting Method`,
      description: '"cash" or "accrual". Most small businesses and gig workers use cash basis.',
      valueType: NodeValueType.ENUM, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.accountingMethod',
      defaultValue: 'cash', validation: { allowedValues: ['cash', 'accrual'] },
    },

    // ── Part I — Income ─────────────────────────────────────────────────────

    {
      id: `${slotId}.line1_grossReceipts`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 1: Gross Receipts or Sales`,
      description: 'Total income received for goods or services. Must include ALL income — even amounts not reported on a 1099-NEC. Must equal or exceed the sum of all 1099-NEC Box 1 amounts from this business.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line1_grossReceipts', defaultValue: 0,
    },

    {
      id: `${slotId}.line2_returnsAllowances`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 2: Returns and Allowances`,
      description: 'Refunds or credits given to customers. Most service businesses enter $0.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line2_returnsAllowances', defaultValue: 0,
    },

    {
      id: `${slotId}.line3_netReceipts`, kind: NodeKind.COMPUTED,
      label: `Schedule C Slot ${slotIndex} — Line 3: Net Receipts (Line 1 − Line 2)`,
      description: 'Gross receipts minus returns and allowances.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      dependencies: [`${slotId}.line1_grossReceipts`, `${slotId}.line2_returnsAllowances`],
      compute: (ctx) => Math.max(0,
        safeNum(ctx.get(`${slotId}.line1_grossReceipts`)) -
        safeNum(ctx.get(`${slotId}.line2_returnsAllowances`))
      ),
    },

    {
      id: `${slotId}.line4_costOfGoodsSold`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 4: Cost of Goods Sold (Part III)`,
      description: 'Cost of goods sold from Part III. Most service businesses and gig workers enter $0. Deferred — enter from Part III worksheet if applicable.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line4_costOfGoodsSold', defaultValue: 0,
    },

    {
      id: `${slotId}.line5a_1099necIncome`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 5a: Income Reported on 1099-NEC (Informational)`,
      description: 'Total 1099-NEC income from all payers for this business. Informational only — must be included in Line 1 gross receipts. Helps verify Line 1 covers all reported amounts.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line5a_1099necIncome', defaultValue: 0,
    },

    {
      id: `${slotId}.line6_otherIncome`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 6: Other Business Income`,
      description: 'Other business income not included in Line 1. Examples: federal/state fuel tax credits, prizes won in business context, bad debts recovered.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line6_otherIncome', defaultValue: 0,
    },

    {
      id: `${slotId}.line7_grossIncome`, kind: NodeKind.COMPUTED,
      label: `Schedule C Slot ${slotIndex} — Line 7: Gross Income`,
      description: 'Net receipts (Line 3) minus cost of goods sold (Line 4) plus other income (Line 6).',
      valueType: NodeValueType.CURRENCY, allowNegative: true, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      dependencies: [
        `${slotId}.line3_netReceipts`,
        `${slotId}.line4_costOfGoodsSold`,
        `${slotId}.line6_otherIncome`,
      ],
      compute: (ctx) =>
        safeNum(ctx.get(`${slotId}.line3_netReceipts`)) -
        safeNum(ctx.get(`${slotId}.line4_costOfGoodsSold`)) +
        safeNum(ctx.get(`${slotId}.line6_otherIncome`)),
    },

    // ── Part II — Expenses ──────────────────────────────────────────────────

    {
      id: `${slotId}.line8_advertising`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 8: Advertising`,
      description: 'Cost of business advertising. Includes online ads, business cards, flyers, promotional materials.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line8_advertising', defaultValue: 0,
    },

    // Line 9 = COMPUTED from Part IV (vehicle/mileage) — see below

    {
      id: `${slotId}.line9_parkingTolls`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 9: Parking Fees and Tolls (Added to Mileage)`,
      description: 'Business-related parking fees and tolls paid in 2025. Added to the standard mileage deduction to produce Line 9 total.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line9_parkingTolls', defaultValue: 0,
    },

    {
      id: `${slotId}.line10_commissionsFees`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 10: Commissions and Fees`,
      description: 'Commissions and fees paid to others to generate business income. Example: platform fees paid to Uber, Etsy, or similar marketplaces that take a percentage.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line10_commissionsFees', defaultValue: 0,
    },

    {
      id: `${slotId}.line11_contractLabor`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 11: Contract Labor`,
      description: 'Payments to independent contractors who helped operate the business. Do not include payments to employees (use Line 26). Issue Form 1099-NEC to contractors paid $600+.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line11_contractLabor', defaultValue: 0,
    },

    {
      id: `${slotId}.line13_depreciation`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 13: Depreciation (Form 4562)`,
      description: 'Depreciation and Section 179 deduction from Form 4562. Deferred — enter manually from completed Form 4562 if applicable.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line13_depreciation', defaultValue: 0,
    },

    {
      id: `${slotId}.line14_employeeBenefits`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 14: Employee Benefit Programs`,
      description: 'Contributions to employee health, life, disability, accident insurance, and other benefit programs. Does not include amounts paid for your own (owner\'s) coverage.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line14_employeeBenefits', defaultValue: 0,
    },

    {
      id: `${slotId}.line15_insurance`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 15: Insurance (Other Than Health)`,
      description: 'Business insurance premiums paid in 2025. Includes liability, property, malpractice, workers\' compensation. Do NOT include health insurance premiums here — those go on Schedule 1 Part II.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line15_insurance', defaultValue: 0,
    },

    {
      id: `${slotId}.line16a_mortgageInterest`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 16a: Mortgage Interest (to Banks)`,
      description: 'Interest paid on a mortgage for business property — paid to a bank or financial institution. Reported on Form 1098.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line16a_mortgageInterest', defaultValue: 0,
    },

    {
      id: `${slotId}.line16b_otherInterest`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 16b: Other Business Interest`,
      description: 'Business interest paid on loans not covered by Line 16a. Includes credit card interest on business charges, business line of credit interest.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line16b_otherInterest', defaultValue: 0,
    },

    {
      id: `${slotId}.line17_legalProfessional`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 17: Legal and Professional Services`,
      description: 'Fees paid to attorneys, accountants, tax preparers, and other professionals for business services.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line17_legalProfessional', defaultValue: 0,
    },

    {
      id: `${slotId}.line18_officeExpense`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 18: Office Expense`,
      description: 'Office supplies and postage. Do not include home office expenses (use Line 30/Form 8829) or capital assets (use Line 13/Form 4562).',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line18_officeExpense', defaultValue: 0,
    },

    {
      id: `${slotId}.line20a_rentLeaseVehicles`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 20a: Rent/Lease — Vehicles, Machinery, Equipment`,
      description: 'Rent or lease payments for business vehicles, machinery, or equipment. If using standard mileage rate for a vehicle, do not include vehicle lease payments here.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line20a_rentLeaseVehicles', defaultValue: 0,
    },

    {
      id: `${slotId}.line20b_rentLeaseOther`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 20b: Rent/Lease — Other Business Property`,
      description: 'Rent paid for office space, retail space, storage units, or other business property.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line20b_rentLeaseOther', defaultValue: 0,
    },

    {
      id: `${slotId}.line21_repairs`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 21: Repairs and Maintenance`,
      description: 'Cost of repairs and maintenance to business property or equipment. Do not include vehicle repairs if using standard mileage (already included in the rate).',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line21_repairs', defaultValue: 0,
    },

    {
      id: `${slotId}.line22_supplies`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 22: Supplies`,
      description: 'Materials and supplies consumed in the business that are not inventory. For service businesses: cleaning supplies, packaging, tools under the de minimis threshold.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line22_supplies', defaultValue: 0,
    },

    {
      id: `${slotId}.line23_taxesLicenses`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 23: Taxes and Licenses`,
      description: 'Business-related taxes and licenses paid in 2025. Includes sales tax on business purchases, business licenses, professional licenses. Do NOT include federal or self-employment income taxes.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line23_taxesLicenses', defaultValue: 0,
    },

    {
      id: `${slotId}.line24a_travel`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 24a: Travel Expenses`,
      description: 'Business travel expenses excluding meals. Includes airfare, hotel, rental car, train. Travel must be away from home overnight for business purposes.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line24a_travel', defaultValue: 0,
    },

    {
      id: `${slotId}.line24b_mealsActual`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 24b: Business Meals (Enter Full Amount Paid)`,
      description: 'Total amount paid for qualifying business meals in 2025. Enter the full amount — the engine automatically applies the 50% deductibility limit. Business meals must have a clear business purpose and be with clients, partners, or employees.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line24b_mealsActual', defaultValue: 0,
    },

    {
      id: `${slotId}.line24b_mealsDeductible`, kind: NodeKind.COMPUTED,
      label: `Schedule C Slot ${slotIndex} — Line 24b: Business Meals (50% Deductible Amount)`,
      description: 'Deductible meals expense: actual meals paid × 50% (IRC §274(n)). This is the amount included in Line 28 total expenses.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      dependencies: [`${slotId}.line24b_mealsActual`],
      compute: (ctx) => {
        const c       = getScheduleCConstants(ctx.taxYear);
        const actual  = safeNum(ctx.get(`${slotId}.line24b_mealsActual`));
        return Math.round(actual * c.mealsDeductionPercentage * 100) / 100;
      },
    },

    {
      id: `${slotId}.line25_utilities`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 25: Utilities`,
      description: 'Utility costs for business premises. Includes electricity, gas, water, phone, internet for dedicated business space. Do NOT include utilities for a home office (use Line 30/Form 8829).',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line25_utilities', defaultValue: 0,
    },

    {
      id: `${slotId}.line26_wages`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 26: Wages (Employees)`,
      description: 'Gross wages paid to employees before withholding. Do NOT include amounts paid to independent contractors (use Line 11). Do NOT include your own salary as owner (owners of sole proprietorships do not pay themselves wages).',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line26_wages', defaultValue: 0,
    },

    {
      id: `${slotId}.line27a_otherExpenses`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 27a: Other Expenses (Part V Total)`,
      description: 'Total of other business expenses from Part V (described on the back of Schedule C). Enter each expense type and amount on Part V, then enter the total here. Examples: business software subscriptions, professional dues, bank fees.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line27a_otherExpenses', defaultValue: 0,
    },

    {
      id: `${slotId}.line30_homeOffice`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 30: Home Office Deduction (Form 8829)`,
      description: 'Home office deduction from Form 8829. Deferred — enter manually from completed Form 8829 if applicable. The home office must be used regularly and exclusively for business.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line30_homeOffice', defaultValue: 0,
    },

    // ── Part IV — Vehicle Information ───────────────────────────────────────

    {
      id: `${slotId}.line43_datePlacedInService`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 43: Date Vehicle Placed in Service`,
      description: 'Date the vehicle was first used for business. Format: MM/DD/YYYY.',
      valueType: NodeValueType.STRING, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line43_datePlacedInService', defaultValue: '',
    },

    {
      id: `${slotId}.line44a_businessMiles`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 44a: Business Miles`,
      description: 'Total miles driven for business purposes in 2025. Multiply by $0.70 to get the mileage deduction. A mileage log is required to substantiate this deduction.',
      valueType: NodeValueType.INTEGER, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line44a_businessMiles', defaultValue: 0,
    },

    {
      id: `${slotId}.line44b_commutingMiles`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 44b: Commuting Miles`,
      description: 'Miles driven between home and a regular place of business. Commuting miles are NOT deductible. Required for IRS record-keeping.',
      valueType: NodeValueType.INTEGER, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line44b_commutingMiles', defaultValue: 0,
    },

    {
      id: `${slotId}.line44c_otherMiles`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 44c: Other Miles`,
      description: 'Personal miles that are neither business nor commuting. Required for IRS record-keeping to establish total vehicle use.',
      valueType: NodeValueType.INTEGER, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line44c_otherMiles', defaultValue: 0,
    },

    {
      id: `${slotId}.line45_evidenceToSupport`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 45: Evidence to Support Deduction?`,
      description: 'Do you have written evidence (mileage log, app records) to support the vehicle deduction? The IRS requires documentation. Answer honestly.',
      valueType: NodeValueType.BOOLEAN, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line45_evidenceToSupport', defaultValue: false,
    },

    {
      id: `${slotId}.line46_writtenEvidence`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 46: Is the Evidence Written?`,
      description: 'Is the mileage evidence in written form (paper log, app export, calendar records)? Required when Line 45 is Yes.',
      valueType: NodeValueType.BOOLEAN, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line46_writtenEvidence', defaultValue: false,
    },

    {
      id: `${slotId}.line47a_anotherVehicle`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 47a: Another Vehicle Available for Personal Use?`,
      description: 'Was another vehicle available for personal use during off-duty hours? Required IRS question for vehicle expense substantiation.',
      valueType: NodeValueType.BOOLEAN, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line47a_anotherVehicle', defaultValue: false,
    },

    {
      id: `${slotId}.line47b_offDutyPersonalUse`, kind: NodeKind.INPUT,
      label: `Schedule C Slot ${slotIndex} — Line 47b: Vehicle Available for Off-Duty Personal Use?`,
      description: 'Was the business vehicle available for personal use during off-duty hours?',
      valueType: NodeValueType.BOOLEAN, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['intermediate'],
      source: InputSource.PREPARER, questionId: 'scheduleC.q.line47b_offDutyPersonalUse', defaultValue: true,
    },

    // ── Computed Line 9 — Car and Truck Expenses ────────────────────────────

    {
      id: `${slotId}.line9_carTruckExpenses`, kind: NodeKind.COMPUTED,
      label: `Schedule C Slot ${slotIndex} — Line 9: Car and Truck Expenses`,
      description: 'Standard mileage deduction: business miles × $0.70 plus parking fees and tolls. Flows to Line 28 total expenses.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      dependencies: [
        `${slotId}.line44a_businessMiles`,
        `${slotId}.line9_parkingTolls`,
      ],
      compute: (ctx) => {
        const c            = getScheduleCConstants(ctx.taxYear);
        const miles        = safeNum(ctx.get(`${slotId}.line44a_businessMiles`));
        const parkingTolls = safeNum(ctx.get(`${slotId}.line9_parkingTolls`));
        const mileageDeduction = miles * c.standardMileageRate;
        return Math.round((mileageDeduction + parkingTolls) * 100) / 100;
      },
    },

    // ── Line 28 — Total Expenses (COMPUTED) ─────────────────────────────────

    {
      id: `${slotId}.line28_totalExpenses`, kind: NodeKind.COMPUTED,
      label: `Schedule C Slot ${slotIndex} — Line 28: Total Expenses`,
      description: 'Sum of all deductible business expenses (Lines 8–27a). Meals use the 50%-limited amount. Car expenses use the standard mileage computation.',
      valueType: NodeValueType.CURRENCY, allowNegative: false, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['expense.business'],
      dependencies: [
        `${slotId}.line8_advertising`,
        `${slotId}.line9_carTruckExpenses`,
        `${slotId}.line10_commissionsFees`,
        `${slotId}.line11_contractLabor`,
        `${slotId}.line13_depreciation`,
        `${slotId}.line14_employeeBenefits`,
        `${slotId}.line15_insurance`,
        `${slotId}.line16a_mortgageInterest`,
        `${slotId}.line16b_otherInterest`,
        `${slotId}.line17_legalProfessional`,
        `${slotId}.line18_officeExpense`,
        `${slotId}.line20a_rentLeaseVehicles`,
        `${slotId}.line20b_rentLeaseOther`,
        `${slotId}.line21_repairs`,
        `${slotId}.line22_supplies`,
        `${slotId}.line23_taxesLicenses`,
        `${slotId}.line24a_travel`,
        `${slotId}.line24b_mealsDeductible`,
        `${slotId}.line25_utilities`,
        `${slotId}.line26_wages`,
        `${slotId}.line27a_otherExpenses`,
      ],
      compute: (ctx) => [
        `${slotId}.line8_advertising`,
        `${slotId}.line9_carTruckExpenses`,
        `${slotId}.line10_commissionsFees`,
        `${slotId}.line11_contractLabor`,
        `${slotId}.line13_depreciation`,
        `${slotId}.line14_employeeBenefits`,
        `${slotId}.line15_insurance`,
        `${slotId}.line16a_mortgageInterest`,
        `${slotId}.line16b_otherInterest`,
        `${slotId}.line17_legalProfessional`,
        `${slotId}.line18_officeExpense`,
        `${slotId}.line20a_rentLeaseVehicles`,
        `${slotId}.line20b_rentLeaseOther`,
        `${slotId}.line21_repairs`,
        `${slotId}.line22_supplies`,
        `${slotId}.line23_taxesLicenses`,
        `${slotId}.line24a_travel`,
        `${slotId}.line24b_mealsDeductible`,
        `${slotId}.line25_utilities`,
        `${slotId}.line26_wages`,
        `${slotId}.line27a_otherExpenses`,
      ].reduce((sum, id) => sum + safeNum(ctx.get(id)), 0),
    },

    // ── Lines 29 and 31 — Profit/Loss ───────────────────────────────────────

    {
      id: `${slotId}.line29_tentativeProfit`, kind: NodeKind.COMPUTED,
      label: `Schedule C Slot ${slotIndex} — Line 29: Tentative Profit or (Loss)`,
      description: 'Gross income (Line 7) minus total expenses (Line 28). Can be negative.',
      valueType: NodeValueType.CURRENCY, allowNegative: true, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      dependencies: [`${slotId}.line7_grossIncome`, `${slotId}.line28_totalExpenses`],
      compute: (ctx) =>
        safeNum(ctx.get(`${slotId}.line7_grossIncome`)) -
        safeNum(ctx.get(`${slotId}.line28_totalExpenses`)),
    },

    {
      id: `${slotId}.line31_netProfitLoss`, kind: NodeKind.COMPUTED,
      label: `Schedule C Slot ${slotIndex} — Line 31: Net Profit or (Loss)`,
      description: 'Tentative profit (Line 29) minus home office deduction (Line 30). This is the bottom line — flows to Schedule 1 Line 3 and is subject to self-employment tax.',
      valueType: NodeValueType.CURRENCY, allowNegative: true, owner, repeatable: false,
      applicableTaxYears: APPLICABLE_YEARS, classifications: ['income.selfEmployment'],
      dependencies: [`${slotId}.line29_tentativeProfit`, `${slotId}.line30_homeOffice`],
      compute: (ctx) =>
        safeNum(ctx.get(`${slotId}.line29_tentativeProfit`)) -
        safeNum(ctx.get(`${slotId}.line30_homeOffice`)),
    },

  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATOR GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateScheduleCAggregators(
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
      label:              `Schedule C (${ownerStr}) — Total Net Profit or (Loss)`,
      description:        `Sum of Line 31 net profit/loss across all ${ownerStr} Schedule C businesses.`,
      valueType:          NodeValueType.CURRENCY,
      allowNegative:      true,
      owner,
      repeatable:         false,
      applicableTaxYears: APPLICABLE_YEARS,
      classifications:    ['income.selfEmployment'],
      dependencies:       slots.map(i => `${FORM_ID}.${ownerStr}.s${i}.line31_netProfitLoss`),
      compute: (ctx) => slots.reduce((sum, i) =>
        sum + safeNum(ctx.get(`${FORM_ID}.${ownerStr}.s${i}.line31_netProfitLoss`)), 0),
    });
  }

  // Joint total — feeds Schedule 1 Line 3 and Schedule SE
  nodes.push({
    id:                 `${FORM_ID}.joint.totalNetProfit`,
    kind:               NodeKind.COMPUTED,
    label:              'Schedule C (Joint) — Total Net Profit or (Loss)',
    description:        'Combined net profit/loss from all Schedule C businesses (primary + spouse). Flows to Schedule 1 Line 3 and Schedule SE.',
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

export const SCHEDULE_C_INITIAL_AGGREGATORS: NodeDefinition[] =
  generateScheduleCAggregators([], []);

export const SCHEDULE_C_OUTPUTS = {
  primaryNetProfit: `${FORM_ID}.primary.totalNetProfit`,
  spouseNetProfit:  `${FORM_ID}.spouse.totalNetProfit`,
  jointNetProfit:   `${FORM_ID}.joint.totalNetProfit`,
} as const;