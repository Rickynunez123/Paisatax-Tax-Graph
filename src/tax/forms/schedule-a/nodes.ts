/**
 * SCHEDULE A — ITEMIZED DEDUCTIONS
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *
 *   Medical and Dental Expenses
 *   ✅ Line 1  — Medical/dental expenses paid
 *   ✅ Line 2  — AGI (from Form 1040 Line 11)
 *   ✅ Line 3  — AGI × 7.5% floor
 *   ✅ Line 4  — Deductible medical expenses (Line 1 − Line 3, floor at 0)
 *
 *   Taxes You Paid
 *   ✅ Line 5a — State and local income taxes (or sales taxes — elect one)
 *   ✅ Line 5b — State and local real estate taxes
 *   ✅ Line 5c — Personal property taxes
 *   ✅ Line 5d — Sum of 5a + 5b + 5c
 *   ✅ Line 5e — SALT deduction (5d capped at $10,000 / $5,000 MFS)
 *   🚧 Line 6  — Other taxes (deferred)
 *   ✅ Line 7  — Total taxes paid (5e + 6)
 *
 *   Interest You Paid
 *   ✅ Line 8a — Home mortgage interest on Form 1098
 *   ✅ Line 8b — Home mortgage interest not on Form 1098
 *   ✅ Line 8c — Points not reported on Form 1098
 *   🚧 Line 8d — Mortgage insurance premiums (expired — deferred)
 *   ✅ Line 8e — Total mortgage interest (8a + 8b + 8c)
 *   🚧 Line 9  — Investment interest (Form 4952 — deferred)
 *   ✅ Line 10 — Total interest (8e + 9)
 *
 *   Gifts to Charity
 *   ✅ Line 11 — Cash contributions
 *   ✅ Line 12 — Non-cash contributions (deferred input — Form 8283 not required)
 *   🚧 Line 13 — Carryover from prior year (deferred)
 *   ✅ Line 14 — Total charitable contributions (11 + 12 + 13)
 *
 *   Casualty and Theft Losses
 *   🚧 Line 15 — Casualty/theft losses (federal disaster areas only — deferred)
 *
 *   Other Itemized Deductions
 *   🚧 Line 16 — Other itemized deductions (deferred)
 *
 *   ✅ Line 17 — Total itemized deductions (4 + 7 + 10 + 14 + 15 + 16)
 *
 * HOW SCHEDULE A CONNECTS TO FORM 1040:
 *   Schedule A Line 17 → f1040.joint.line12_itemizedDeductions
 *   Form 1040 Line 12 picks the GREATER of standard deduction or itemized deductions.
 *   The isItemizing input flag controls which path is used.
 *
 * SALT CAP (IRC §164(b)(6)):
 *   The combined state/local income (or sales) + real estate + personal property
 *   taxes are capped at $10,000 ($5,000 for MFS). This cap applies per return,
 *   not per person.
 *
 * MEDICAL EXPENSES (IRC §213):
 *   Only amounts exceeding 7.5% of AGI are deductible.
 *   This form reads AGI from f1040.joint.line11_adjustedGrossIncome.
 *
 * IRS References:
 *   Schedule A Instructions (2025)
 *   IRS Pub 17 (2025) — Chapter 22 (Medical), 23 (Taxes), 24 (Interest), 25 (Charity)
 *   IRC §§163, 164, 170, 213
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';
import { getScheduleAConstants } from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'scheduleA';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDICAL AND DENTAL EXPENSES (Lines 1–4)
// ─────────────────────────────────────────────────────────────────────────────

const line1_medicalExpenses: NodeDefinition = {
  id: `${FORM_ID}.joint.line1_medicalExpenses`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 1 — Medical and Dental Expenses',
  description: 'Total medical and dental expenses paid in 2025. Include premiums for health insurance not paid pre-tax, prescription drugs, doctor/dentist fees, hospital costs. Do NOT include expenses reimbursed by insurance.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.medicalExpenses',
  defaultValue: 0,
};

/**
 * Line 2 — AGI from Form 1040 Line 11.
 * Pulled directly from the engine graph — preparer does not enter this.
 */
const line2_agi: NodeDefinition = {
  id: `${FORM_ID}.joint.line2_agi`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule A Line 2 — Adjusted Gross Income (from Form 1040 Line 11)',
  description: 'AGI from Form 1040 Line 11. Used to compute the 7.5% medical expense floor.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: ['f1040.joint.line11_adjustedGrossIncome'],
  compute: (ctx) => safeNum(ctx.get('f1040.joint.line11_adjustedGrossIncome')),
};

const line3_medicalFloor: NodeDefinition = {
  id: `${FORM_ID}.joint.line3_medicalFloor`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule A Line 3 — Medical Expense AGI Floor (7.5%)',
  description: 'AGI × 7.5%. Only medical expenses above this amount are deductible (IRC §213).',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [`${FORM_ID}.joint.line2_agi`],
  compute: (ctx) => {
    const c   = getScheduleAConstants(ctx.taxYear);
    const agi = safeNum(ctx.get(`${FORM_ID}.joint.line2_agi`));
    return Math.round(agi * c.medicalExpenseAgiFloor * 100) / 100;
  },
};

const line4_deductibleMedical: NodeDefinition = {
  id: `${FORM_ID}.joint.line4_deductibleMedical`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule A Line 4 — Deductible Medical Expenses',
  description: 'Medical expenses (Line 1) minus AGI floor (Line 3). Floor at zero — if expenses do not exceed 7.5% of AGI, nothing is deductible.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  dependencies: [
    `${FORM_ID}.joint.line1_medicalExpenses`,
    `${FORM_ID}.joint.line3_medicalFloor`,
  ],
  compute: (ctx) => Math.max(
    0,
    safeNum(ctx.get(`${FORM_ID}.joint.line1_medicalExpenses`)) -
    safeNum(ctx.get(`${FORM_ID}.joint.line3_medicalFloor`)),
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// TAXES YOU PAID (Lines 5a–7)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 5a — State and local income taxes OR general sales taxes (elect one).
 * Most filers elect income taxes. Sales tax election is beneficial only in
 * states with no income tax (e.g., TX, FL, WA, NV).
 */
const line5a_stateLocalIncomeTax: NodeDefinition = {
  id: `${FORM_ID}.joint.line5a_stateLocalIncomeTax`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 5a — State and Local Income (or Sales) Taxes',
  description: 'State and local income taxes paid in 2025, OR general sales taxes (elect one — cannot deduct both). Most filers use income taxes withheld per W-2 Box 17 + any additional state tax paid. Sales tax election requires IRS Optional Sales Tax Tables or actual receipts.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.stateLocalIncomeTax',
  defaultValue: 0,
};

const line5b_realEstateTax: NodeDefinition = {
  id: `${FORM_ID}.joint.line5b_realEstateTax`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 5b — State and Local Real Estate Taxes',
  description: 'Real property taxes paid on your home and any other real estate you own. Reported on Form 1098 Box 10 or county tax statements. Do not include taxes paid through an escrow account that have not yet been paid to the taxing authority.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.realEstateTax',
  defaultValue: 0,
};

const line5c_personalPropertyTax: NodeDefinition = {
  id: `${FORM_ID}.joint.line5c_personalPropertyTax`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 5c — Personal Property Taxes',
  description: 'State or local taxes on personal property (e.g., annual vehicle registration fees based on value). Only the ad valorem (value-based) portion qualifies — flat fees do not.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.personalPropertyTax',
  defaultValue: 0,
};

const line5d_saltSubtotal: NodeDefinition = {
  id: `${FORM_ID}.joint.line5d_saltSubtotal`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule A Line 5d — SALT Subtotal (5a + 5b + 5c)',
  description: 'Sum of state/local income taxes, real estate taxes, and personal property taxes before the $10,000 cap.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line5a_stateLocalIncomeTax`,
    `${FORM_ID}.joint.line5b_realEstateTax`,
    `${FORM_ID}.joint.line5c_personalPropertyTax`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line5a_stateLocalIncomeTax`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line5b_realEstateTax`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line5c_personalPropertyTax`)),
};

/**
 * Line 5e — SALT deduction after cap.
 * IRC §164(b)(6): $10,000 cap ($5,000 for MFS).
 */
const line5e_saltDeduction: NodeDefinition = {
  id: `${FORM_ID}.joint.line5e_saltDeduction`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule A Line 5e — State and Local Tax Deduction (SALT Cap Applied)',
  description: 'SALT deduction after applying the $10,000 cap ($5,000 for married filing separately). IRC §164(b)(6). Cannot exceed the lesser of Line 5d or the cap.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  dependencies: [`${FORM_ID}.joint.line5d_saltSubtotal`],
  compute: (ctx) => {
    const c        = getScheduleAConstants(ctx.taxYear);
    const subtotal = safeNum(ctx.get(`${FORM_ID}.joint.line5d_saltSubtotal`));
    const cap      = ctx.filingStatus === 'married_filing_separately'
      ? c.saltCap.marriedFilingSeparately
      : c.saltCap.standard;
    return Math.min(subtotal, cap);
  },
};

/**
 * Line 6 — Other taxes (deferred).
 * Includes foreign income taxes not elected as a credit, generation-skipping tax, etc.
 */
const line6_otherTaxes: NodeDefinition = {
  id: `${FORM_ID}.joint.line6_otherTaxes`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 6 — Other Taxes',
  description: 'Other deductible taxes not included above. Deferred — enter manually if applicable.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.otherTaxes',
  defaultValue: 0,
};

const line7_totalTaxesPaid: NodeDefinition = {
  id: `${FORM_ID}.joint.line7_totalTaxesPaid`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule A Line 7 — Total Taxes Paid',
  description: 'SALT deduction (Line 5e) plus other taxes (Line 6).',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  dependencies: [
    `${FORM_ID}.joint.line5e_saltDeduction`,
    `${FORM_ID}.joint.line6_otherTaxes`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line5e_saltDeduction`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line6_otherTaxes`)),
};

// ─────────────────────────────────────────────────────────────────────────────
// INTEREST YOU PAID (Lines 8a–10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 8a — Home mortgage interest reported on Form 1098.
 * Reported by the lender in Box 1. Includes interest on primary and
 * one secondary residence. Subject to $750,000 acquisition debt limit
 * for loans originated after 12/15/2017.
 */
const line8a_mortgageInterest1098: NodeDefinition = {
  id: `${FORM_ID}.joint.line8a_mortgageInterest1098`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 8a — Home Mortgage Interest (Form 1098)',
  description: 'Home mortgage interest reported on Form 1098 Box 1. Lender reports this directly. Subject to the $750,000 acquisition debt limit for post-12/15/2017 loans ($375,000 for MFS).',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.mortgageInterest1098',
  defaultValue: 0,
};

/**
 * Line 8b — Home mortgage interest NOT reported on Form 1098.
 * Paid to an individual (e.g., seller financing, private lender).
 * Must include lender's name, SSN/EIN, and address on Schedule A.
 */
const line8b_mortgageInterestOther: NodeDefinition = {
  id: `${FORM_ID}.joint.line8b_mortgageInterestOther`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 8b — Home Mortgage Interest Not on Form 1098',
  description: 'Home mortgage interest paid to an individual lender who did not issue a Form 1098 (e.g., seller-financed mortgage, private party loan). You must include the lender\'s name, address, and SSN/TIN.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.mortgageInterestOther',
  defaultValue: 0,
};

/**
 * Line 8c — Points not reported on Form 1098.
 * Loan origination fees (points) paid on purchase of primary residence
 * that were not already reported on Form 1098 Box 6.
 */
const line8c_points: NodeDefinition = {
  id: `${FORM_ID}.joint.line8c_points`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 8c — Points Not Reported on Form 1098',
  description: 'Loan origination points paid on purchase of your main home, not already reported in Form 1098 Box 6. Points on refinances are generally deducted over the life of the loan, not all at once.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.points',
  defaultValue: 0,
};

const line8e_totalMortgageInterest: NodeDefinition = {
  id: `${FORM_ID}.joint.line8e_totalMortgageInterest`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule A Line 8e — Total Home Mortgage Interest',
  description: 'Sum of Lines 8a + 8b + 8c.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  dependencies: [
    `${FORM_ID}.joint.line8a_mortgageInterest1098`,
    `${FORM_ID}.joint.line8b_mortgageInterestOther`,
    `${FORM_ID}.joint.line8c_points`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line8a_mortgageInterest1098`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line8b_mortgageInterestOther`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line8c_points`)),
};

/**
 * Line 9 — Investment interest (Form 4952 — deferred).
 * Interest on money borrowed to invest in property held for investment.
 * Limited to net investment income.
 */
const line9_investmentInterest: NodeDefinition = {
  id: `${FORM_ID}.joint.line9_investmentInterest`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 9 — Investment Interest (Form 4952)',
  description: 'Interest on loans used to buy investment property. Deferred — enter manually from Form 4952 if applicable. Limited to net investment income.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.investmentInterest',
  defaultValue: 0,
};

const line10_totalInterest: NodeDefinition = {
  id: `${FORM_ID}.joint.line10_totalInterest`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule A Line 10 — Total Interest Paid',
  description: 'Total deductible interest: home mortgage interest (Line 8e) plus investment interest (Line 9).',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  dependencies: [
    `${FORM_ID}.joint.line8e_totalMortgageInterest`,
    `${FORM_ID}.joint.line9_investmentInterest`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line8e_totalMortgageInterest`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line9_investmentInterest`)),
};

// ─────────────────────────────────────────────────────────────────────────────
// GIFTS TO CHARITY (Lines 11–14)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 11 — Cash contributions.
 * Includes checks, credit card charges, electronic transfers to qualified
 * organizations. Must have written receipt for any single gift of $250+.
 * Limited to 60% of AGI.
 */
const line11_cashContributions: NodeDefinition = {
  id: `${FORM_ID}.joint.line11_cashContributions`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 11 — Cash Charitable Contributions',
  description: 'Total cash, check, and electronic charitable contributions to qualified organizations. Requires written receipt for contributions of $250 or more. The AGI limit (60%) is not applied here — it is the filer\'s responsibility to verify they are within the limit.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.cashContributions',
  defaultValue: 0,
};

/**
 * Line 12 — Non-cash contributions.
 * Donations of property (clothing, household goods, stocks, vehicles).
 * Form 8283 required if total non-cash donations exceed $500.
 * Form 8283 is deferred — preparer enters the total manually.
 */
const line12_nonCashContributions: NodeDefinition = {
  id: `${FORM_ID}.joint.line12_nonCashContributions`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 12 — Non-Cash Charitable Contributions',
  description: 'Fair market value of donated property (clothing, household goods, vehicles, securities). Form 8283 required if total non-cash donations exceed $500. Enter the deductible amount from your Form 8283 if applicable, or the total FMV of all non-cash donations.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.nonCashContributions',
  defaultValue: 0,
};

/**
 * Line 13 — Carryover from prior year (deferred).
 * Excess charitable contributions from prior years that exceeded AGI limits.
 */
const line13_charitableCarryover: NodeDefinition = {
  id: `${FORM_ID}.joint.line13_charitableCarryover`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 13 — Charitable Contribution Carryover from Prior Year',
  description: 'Prior-year charitable contributions that exceeded AGI limits and are being carried forward. Deferred — enter manually from prior year Schedule A if applicable.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.charitableCarryover',
  defaultValue: 0,
};

const line14_totalCharitableContributions: NodeDefinition = {
  id: `${FORM_ID}.joint.line14_totalCharitableContributions`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule A Line 14 — Total Charitable Contributions',
  description: 'Sum of cash (Line 11) + non-cash (Line 12) + carryover (Line 13).',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  dependencies: [
    `${FORM_ID}.joint.line11_cashContributions`,
    `${FORM_ID}.joint.line12_nonCashContributions`,
    `${FORM_ID}.joint.line13_charitableCarryover`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line11_cashContributions`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line12_nonCashContributions`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line13_charitableCarryover`)),
};

// ─────────────────────────────────────────────────────────────────────────────
// CASUALTY AND OTHER (Lines 15–16 — deferred)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 15 — Casualty and theft losses.
 * Post-TCJA: only losses from federally declared disaster areas.
 * Subject to $100 per-event floor and 10% AGI floor.
 */
const line15_casualtyLosses: NodeDefinition = {
  id: `${FORM_ID}.joint.line15_casualtyLosses`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 15 — Casualty and Theft Losses (Federal Disasters Only)',
  description: 'Net casualty/theft losses from federally declared disaster areas only (post-TCJA). Subject to $100 per-event and 10% AGI floors. Deferred — enter from Form 4684 if applicable.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.casualtyLosses',
  defaultValue: 0,
};

/**
 * Line 16 — Other itemized deductions.
 * Gambling losses (to extent of winnings), impairment-related work expenses,
 * certain unrecovered investment in pension, etc.
 */
const line16_otherDeductions: NodeDefinition = {
  id: `${FORM_ID}.joint.line16_otherDeductions`,
  kind: NodeKind.INPUT,
  label: 'Schedule A Line 16 — Other Itemized Deductions',
  description: 'Other itemized deductions including gambling losses (limited to gambling winnings), impairment-related work expenses, unrecovered pension investment. Deferred — enter manually if applicable.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  source: InputSource.PREPARER,
  questionId: 'scheduleA.q.otherDeductions',
  defaultValue: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 17 — TOTAL ITEMIZED DEDUCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const line17_totalItemizedDeductions: NodeDefinition = {
  id: `${FORM_ID}.joint.line17_totalItemizedDeductions`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule A Line 17 — Total Itemized Deductions',
  description: 'Sum of all itemized deductions: medical (4) + taxes (7) + interest (10) + charity (14) + casualty (15) + other (16). Flows to Form 1040 Line 12 when taxpayer elects to itemize.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['deduction.itemized'],
  dependencies: [
    `${FORM_ID}.joint.line4_deductibleMedical`,
    `${FORM_ID}.joint.line7_totalTaxesPaid`,
    `${FORM_ID}.joint.line10_totalInterest`,
    `${FORM_ID}.joint.line14_totalCharitableContributions`,
    `${FORM_ID}.joint.line15_casualtyLosses`,
    `${FORM_ID}.joint.line16_otherDeductions`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line4_deductibleMedical`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line7_totalTaxesPaid`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line10_totalInterest`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line14_totalCharitableContributions`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line15_casualtyLosses`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line16_otherDeductions`)),
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEDULE_A_NODES: NodeDefinition[] = [
  // Medical
  line1_medicalExpenses,
  line2_agi,
  line3_medicalFloor,
  line4_deductibleMedical,
  // Taxes
  line5a_stateLocalIncomeTax,
  line5b_realEstateTax,
  line5c_personalPropertyTax,
  line5d_saltSubtotal,
  line5e_saltDeduction,
  line6_otherTaxes,
  line7_totalTaxesPaid,
  // Interest
  line8a_mortgageInterest1098,
  line8b_mortgageInterestOther,
  line8c_points,
  line8e_totalMortgageInterest,
  line9_investmentInterest,
  line10_totalInterest,
  // Charity
  line11_cashContributions,
  line12_nonCashContributions,
  line13_charitableCarryover,
  line14_totalCharitableContributions,
  // Casualty and other
  line15_casualtyLosses,
  line16_otherDeductions,
  // Total
  line17_totalItemizedDeductions,
];

export const SCHEDULE_A_OUTPUTS = {
  /** Line 17 — Total itemized deductions → flows to Form 1040 Line 12 when itemizing */
  totalItemizedDeductions: `${FORM_ID}.joint.line17_totalItemizedDeductions`,
  /** SALT subtotal before cap — useful for planning display */
  saltSubtotal: `${FORM_ID}.joint.line5d_saltSubtotal`,
  /** SALT after cap */
  saltDeduction: `${FORM_ID}.joint.line5e_saltDeduction`,
  /** Deductible medical expenses */
  deductibleMedical: `${FORM_ID}.joint.line4_deductibleMedical`,
  /** Total charitable contributions */
  totalCharitableContributions: `${FORM_ID}.joint.line14_totalCharitableContributions`,
} as const;