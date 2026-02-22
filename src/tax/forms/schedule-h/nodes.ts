/**
 * SCHEDULE H — HOUSEHOLD EMPLOYMENT TAXES
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *
 *   Part I — Social Security, Medicare, and Federal Income Taxes
 *   ✅ Line A  — Did taxpayer pay any one household employee $2,800+ in cash wages?
 *   ✅ Line 1  — Total cash wages subject to Social Security taxes
 *   ✅ Line 2  — Social Security taxes (Line 1 × 15.3%, capped at SS wage base)
 *   ✅ Line 3  — Total cash wages subject to Medicare taxes
 *   ✅ Line 4  — Medicare taxes (Line 3 × 2.9%)
 *   ✅ Line 5  — Federal income tax withheld (if employer elected withholding)
 *   ✅ Line 6  — Total FICA + withheld income tax (Lines 2 + 4 + 5)
 *
 *   Part II — Federal Unemployment Tax (FUTA)
 *   ✅ Line B  — Did taxpayer pay $1,000+ in any quarter to household employees?
 *   ✅ Line 7  — Total cash wages subject to FUTA (first $7,000 per employee)
 *   ✅ Line 8  — FUTA tax before state credit (Line 7 × 6.0%)
 *   ✅ Line 9  — State unemployment insurance (UI) contributions paid on time
 *   ✅ Line 10 — FUTA credit (lesser of Line 9 or Line 7 × 5.4%)
 *   ✅ Line 11 — Net FUTA tax (Line 8 − Line 10)
 *
 *   Part III — Total Household Employment Taxes
 *   ✅ Line 12 — Total household employment taxes (Line 6 + Line 11)
 *               → flows to Schedule 2 Line 9
 *
 *   🚧 Additional Medicare Tax (0.9% above $200K/$250K) — deferred
 *   🚧 State income tax withholding — not on Schedule H (state matter)
 *
 * HOW SCHEDULE H CONNECTS TO OTHER FORMS:
 *   scheduleH.joint.line12_totalHouseholdTax → schedule2.joint.line9_householdEmploymentTax
 *   → schedule2.joint.line44_totalAdditionalTaxes → f1040.joint.line17_additionalTaxes
 *
 * UNLIKE SCHEDULE SE:
 *   Schedule H taxes are NOT deductible above-the-line.
 *   There is no "deductible half" companion node.
 *   The entire Schedule H tax flows straight to Schedule 2 / total tax.
 *
 * WHO NEEDS SCHEDULE H:
 *   Filers who paid:
 *     (a) $2,800+ in cash wages to any ONE household employee (FICA threshold), OR
 *     (b) $1,000+ in any calendar quarter across all household employees (FUTA)
 *   Common household employees: nannies, housekeepers, home health aides, cooks.
 *   NOT household employees: independent contractors, agency workers.
 *
 * CASH WAGES vs TOTAL COMPENSATION:
 *   Schedule H applies to CASH WAGES only.
 *   Non-cash compensation (meals, lodging provided for employer convenience) is
 *   generally excluded from wages — see Pub 926. Most preparers only have cash wages.
 *
 * FICA COMPUTATION:
 *   Both employer and employee shares are the household employer's obligation.
 *   If employer elected to pay employee's share too (not withhold), the full 15.3%
 *   is still on Schedule H — the treatment just affects Form W-2 preparation.
 *   The compute function always produces the combined 15.3%.
 *
 * IRS References:
 *   Schedule H Instructions (2025)
 *   IRS Publication 926 — Household Employer's Tax Guide (2025)
 *   IRC §§3101, 3111, 3301, 3306
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';
import {
  getScheduleHConstants,
  computeHouseholdFica,
  computeFuta,
} from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'scheduleH';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART I — SOCIAL SECURITY, MEDICARE, AND FEDERAL INCOME TAXES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line A — Eligibility flag for FICA.
 * Did the taxpayer pay $2,800 or more in cash wages to any ONE household
 * employee in 2025? If No, FICA (Lines 1–4) do not apply — only FUTA may.
 */
const lineA_ficaEligible: NodeDefinition = {
  id: `${FORM_ID}.joint.lineA_ficaEligible`,
  kind: NodeKind.INPUT,
  label: 'Schedule H Line A — Paid $2,800+ to Any One Household Employee?',
  description: 'Did you pay cash wages of $2,800 or more to any single household employee in 2025? If Yes, you must withhold and pay Social Security and Medicare taxes. If No, skip Part I (FICA) — only FUTA may apply.',
  valueType: NodeValueType.BOOLEAN,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'scheduleH.q.lineA_ficaEligible',
  defaultValue: false,
};

/**
 * Line 1 — Total cash wages subject to Social Security taxes.
 * This is the aggregate of all cash wages paid to household employees
 * who individually received $2,800 or more. Employees paid less than
 * $2,800 are excluded from this line.
 * Capped at the SS wage base ($176,100) in the FICA computation.
 */
const line1_ssWages: NodeDefinition = {
  id: `${FORM_ID}.joint.line1_ssWages`,
  kind: NodeKind.INPUT,
  label: 'Schedule H Line 1 — Cash Wages Subject to Social Security Tax',
  description: 'Total cash wages paid in 2025 to household employees who each received $2,800 or more. Exclude employees paid less than $2,800. Include only the portion of each employee\'s wages up to the Social Security wage base ($176,100).',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'scheduleH.q.line1_ssWages',
  defaultValue: 0,
};

/**
 * Line 2 — Social Security and Medicare taxes (combined FICA).
 *
 * The IRS Schedule H Line 2 instruction: multiply Line 1 by 15.3%.
 * This combines both the employer share (7.65%) and employee share (7.65%).
 *
 * Uses computeHouseholdFica() from constants for correctness on edge cases
 * (wages straddling the SS wage base — rare for household workers but handled).
 * The ficaWageThreshold check in the helper is redundant here because Line A
 * gates entry, but is kept for defense-in-depth.
 */
const line2_ficaTax: NodeDefinition = {
  id: `${FORM_ID}.joint.line2_ficaTax`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule H Line 2 — Social Security and Medicare Taxes (15.3%)',
  description: 'Combined employer + employee FICA on Line 1 wages. 12.4% Social Security (both shares, capped at $176,100 wage base) + 2.9% Medicare (both shares, no cap). Zero if Line A is No or wages are zero.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['tax.selfEmployment'],
  dependencies: [
    `${FORM_ID}.joint.lineA_ficaEligible`,
    `${FORM_ID}.joint.line1_ssWages`,
  ],
  compute: (ctx) => {
    const eligible = ctx.get(`${FORM_ID}.joint.lineA_ficaEligible`) as boolean ?? false;
    if (!eligible) return 0;
    const wages = safeNum(ctx.get(`${FORM_ID}.joint.line1_ssWages`));
    const c     = getScheduleHConstants(ctx.taxYear);
    return computeHouseholdFica(wages, c).totalFica;
  },
  isApplicable: (ctx) => (ctx.get(`${FORM_ID}.joint.lineA_ficaEligible`) as boolean ?? false),
};

/**
 * Line 3 — Cash wages subject to Medicare tax.
 * Usually equal to Line 1 (Medicare has no wage base cap).
 * Entered separately because it can differ from Line 1 when wages
 * exceed the SS wage base (employee would still owe Medicare on excess).
 * For most household employers, Line 3 = Line 1.
 */
const line3_medicareWages: NodeDefinition = {
  id: `${FORM_ID}.joint.line3_medicareWages`,
  kind: NodeKind.INPUT,
  label: 'Schedule H Line 3 — Cash Wages Subject to Medicare Tax',
  description: 'Total cash wages subject to Medicare tax. Usually the same as Line 1. Only differs if any employee\'s wages exceeded the Social Security wage base ($176,100) — in that case, Line 3 is higher than Line 1 for that employee.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'scheduleH.q.line3_medicareWages',
  defaultValue: 0,
  isApplicable: (ctx : any) => (ctx.get(`${FORM_ID}.joint.lineA_ficaEligible`) as boolean ?? false),
} as NodeDefinition;

/**
 * Line 4 — Medicare taxes.
 * Line 3 × 2.9% (employee share 1.45% + employer share 1.45%).
 * This is already captured in Line 2's combined 15.3%, so Line 4 is
 * informational on the actual Schedule H form. We compute it for accuracy
 * when Line 3 ≠ Line 1 (wages above SS wage base).
 *
 * For the total tax calculation, we use line2_ficaTax (which already
 * includes Medicare). Line 4 is shown separately per the IRS form layout.
 *
 * IMPLEMENTATION NOTE: Line 6 sums Lines 2, 4, and 5. Because Line 2
 * already includes the full Medicare component when Line 1 = Line 3,
 * adding Line 4 separately would double-count. We handle this by:
 *   - When Line 1 = Line 3: Line 4 = 0 (Medicare already in Line 2)
 *   - When Line 3 > Line 1: Line 4 = (Line 3 − Line 1) × 2.9%
 *     (the additional Medicare on above-SS-base wages not in Line 2)
 * This matches the IRS Schedule H worksheet instructions exactly.
 */
const line4_additionalMedicare: NodeDefinition = {
  id: `${FORM_ID}.joint.line4_additionalMedicare`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule H Line 4 — Additional Medicare Tax on Wages Above SS Wage Base',
  description: 'Medicare tax on wages that exceed the Social Security wage base. Zero in the common case where Line 3 = Line 1. When Line 3 > Line 1, computes 2.9% on the excess — this is the Medicare owed on above-base wages not already captured in Line 2.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['tax.selfEmployment'],
  dependencies: [
    `${FORM_ID}.joint.lineA_ficaEligible`,
    `${FORM_ID}.joint.line1_ssWages`,
    `${FORM_ID}.joint.line3_medicareWages`,
  ],
  compute: (ctx) => {
    const eligible = ctx.get(`${FORM_ID}.joint.lineA_ficaEligible`) as boolean ?? false;
    if (!eligible) return 0;
    const ssWages       = safeNum(ctx.get(`${FORM_ID}.joint.line1_ssWages`));
    const medicareWages = safeNum(ctx.get(`${FORM_ID}.joint.line3_medicareWages`));
    const excessWages   = Math.max(0, medicareWages - ssWages);
    if (excessWages === 0) return 0;
    const c = getScheduleHConstants(ctx.taxYear);
    return Math.round(excessWages * c.fica.combinedRate * 100) / 100;
  },
  isApplicable: (ctx) => {
    const eligible = ctx.get(`${FORM_ID}.joint.lineA_ficaEligible`) as boolean ?? false;
    if (!eligible) return false;
    const ssWages       = safeNum(ctx.get(`${FORM_ID}.joint.line1_ssWages`));
    const medicareWages = safeNum(ctx.get(`${FORM_ID}.joint.line3_medicareWages`));
    return medicareWages > ssWages;
  },
};

/**
 * Line 5 — Federal income tax withheld from household employee wages.
 * Optional — employer and employee must agree in writing to withhold.
 * Most household employers do NOT withhold federal income tax.
 * When they do, it reduces the employee's refund/balance due but does
 * not change the employer's FICA or FUTA obligation.
 */
const line5_federalWithheld: NodeDefinition = {
  id: `${FORM_ID}.joint.line5_federalWithheld`,
  kind: NodeKind.INPUT,
  label: 'Schedule H Line 5 — Federal Income Tax Withheld from Household Employee',
  description: 'Federal income tax voluntarily withheld from household employee wages. Both employer and employee must agree in writing (employee submits Form W-4). Most household employers do not withhold — enter $0 if no withholding agreement was in place.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['withholding'],
  source: InputSource.PREPARER,
  questionId: 'scheduleH.q.line5_federalWithheld',
  defaultValue: 0,
};

/**
 * Line 6 — Total FICA + federal income tax withheld.
 * Line 2 + Line 4 + Line 5.
 * This subtotal covers all FICA obligations and any voluntary withholding.
 */
const line6_ficaAndWithholding: NodeDefinition = {
  id: `${FORM_ID}.joint.line6_ficaAndWithholding`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule H Line 6 — Total FICA and Federal Income Tax Withheld',
  description: 'Sum of Social Security/Medicare taxes (Lines 2 + 4) and any federal income tax withheld from employee wages (Line 5).',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line2_ficaTax`,
    `${FORM_ID}.joint.line4_additionalMedicare`,
    `${FORM_ID}.joint.line5_federalWithheld`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line2_ficaTax`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line4_additionalMedicare`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line5_federalWithheld`)),
};

// ─────────────────────────────────────────────────────────────────────────────
// PART II — FEDERAL UNEMPLOYMENT TAX (FUTA)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line B — Eligibility flag for FUTA.
 * Did the taxpayer pay $1,000 or more in cash wages in any calendar quarter?
 * If No, FUTA (Lines 7–11) do not apply.
 */
const lineB_futaEligible: NodeDefinition = {
  id: `${FORM_ID}.joint.lineB_futaEligible`,
  kind: NodeKind.INPUT,
  label: 'Schedule H Line B — Paid $1,000+ in Any Calendar Quarter?',
  description: 'Did you pay $1,000 or more in total cash wages to household employees in any single calendar quarter of 2024 or 2025? If Yes, you owe FUTA. The $1,000 threshold is per quarter across ALL household employees combined.',
  valueType: NodeValueType.BOOLEAN,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'scheduleH.q.lineB_futaEligible',
  defaultValue: false,
};

/**
 * Line 7 — Total cash wages subject to FUTA.
 * First $7,000 of cash wages paid to EACH employee during the year.
 * Preparer enters the aggregate FUTA-taxable wages across all employees.
 *
 * Example: 2 employees, one paid $10,000 and one paid $5,000.
 *   FUTA-taxable: $7,000 + $5,000 = $12,000 → enter $12,000 on Line 7.
 */
const line7_futaWages: NodeDefinition = {
  id: `${FORM_ID}.joint.line7_futaWages`,
  kind: NodeKind.INPUT,
  label: 'Schedule H Line 7 — Total Cash Wages Subject to FUTA',
  description: 'Total cash wages subject to FUTA tax. Enter the first $7,000 of wages paid to EACH household employee, summed across all employees. Wages above $7,000 per employee are not subject to FUTA.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'scheduleH.q.line7_futaWages',
  defaultValue: 0,
  isApplicable: (ctx : any) => (ctx.get(`${FORM_ID}.joint.lineB_futaEligible`) as boolean ?? false),
} as NodeDefinition;

/**
 * Line 8 — FUTA tax before state credit.
 * Line 7 × 6.0%.
 */
const line8_futaBeforeCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line8_futaBeforeCredit`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule H Line 8 — FUTA Tax Before State Credit (6.0%)',
  description: 'Gross FUTA tax: Line 7 × 6.0%. The state UI credit (Line 10) reduces this to the net FUTA owed.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.lineB_futaEligible`,
    `${FORM_ID}.joint.line7_futaWages`,
  ],
  compute: (ctx) => {
    const eligible = ctx.get(`${FORM_ID}.joint.lineB_futaEligible`) as boolean ?? false;
    if (!eligible) return 0;
    const c     = getScheduleHConstants(ctx.taxYear);
    const wages = safeNum(ctx.get(`${FORM_ID}.joint.line7_futaWages`));
    return Math.round(wages * c.futa.grossRate * 100) / 100;
  },
  isApplicable: (ctx) => (ctx.get(`${FORM_ID}.joint.lineB_futaEligible`) as boolean ?? false),
};

/**
 * Line 9 — State unemployment insurance (UI) tax paid on time.
 * Most states require household employers to pay state UI separately.
 * This credit (up to 5.4% of FUTA wages) offsets the 6.0% gross FUTA rate,
 * resulting in the typical net rate of 0.6%.
 *
 * "Paid on time" means by the Schedule H due date (generally April 15).
 * Late state UI payments reduce the available credit.
 */
const line9_stateUiTaxPaid: NodeDefinition = {
  id: `${FORM_ID}.joint.line9_stateUiTaxPaid`,
  kind: NodeKind.INPUT,
  label: 'Schedule H Line 9 — State Unemployment Insurance (UI) Tax Paid',
  description: 'State unemployment insurance contributions paid on time on the same wages. This generates the FUTA credit (up to 5.4%). If you paid state UI on time, enter that amount here. If your state has no UI (rare) or you didn\'t pay on time, enter $0 and the full 6.0% applies.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'scheduleH.q.line9_stateUiTaxPaid',
  defaultValue: 0,
  isApplicable: (ctx : any) => (ctx.get(`${FORM_ID}.joint.lineB_futaEligible`) as boolean ?? false),
} as NodeDefinition;

/**
 * Line 10 — FUTA credit.
 * Lesser of: (a) state UI tax paid on time (Line 9), or
 *            (b) Line 7 × 5.4% (maximum credit).
 */
const line10_futaCredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line10_futaCredit`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule H Line 10 — FUTA Credit (State UI Tax)',
  description: 'FUTA credit: lesser of state UI tax paid on time (Line 9) or 5.4% of FUTA-taxable wages (Line 7). Reduces gross FUTA (6.0%) to net FUTA (typically 0.6%).',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.lineB_futaEligible`,
    `${FORM_ID}.joint.line7_futaWages`,
    `${FORM_ID}.joint.line9_stateUiTaxPaid`,
  ],
  compute: (ctx) => {
    const eligible = ctx.get(`${FORM_ID}.joint.lineB_futaEligible`) as boolean ?? false;
    if (!eligible) return 0;
    const c           = getScheduleHConstants(ctx.taxYear);
    const futaWages   = safeNum(ctx.get(`${FORM_ID}.joint.line7_futaWages`));
    const stateUiPaid = safeNum(ctx.get(`${FORM_ID}.joint.line9_stateUiTaxPaid`));
    const maxCredit   = Math.round(futaWages * c.futa.maxStateCredit * 100) / 100;
    return Math.min(stateUiPaid, maxCredit);
  },
  isApplicable: (ctx) => (ctx.get(`${FORM_ID}.joint.lineB_futaEligible`) as boolean ?? false),
};

/**
 * Line 11 — Net FUTA tax.
 * Line 8 − Line 10. Cannot be negative.
 * Typical result: 0.6% of FUTA-taxable wages when state UI was paid on time.
 */
const line11_netFuta: NodeDefinition = {
  id: `${FORM_ID}.joint.line11_netFuta`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule H Line 11 — Net FUTA Tax',
  description: 'Net FUTA tax: gross FUTA (Line 8) minus FUTA credit (Line 10). Typically 0.6% of Line 7 when state UI was paid on time.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['tax.selfEmployment'],
  dependencies: [
    `${FORM_ID}.joint.line8_futaBeforeCredit`,
    `${FORM_ID}.joint.line10_futaCredit`,
  ],
  compute: (ctx) => Math.max(
    0,
    safeNum(ctx.get(`${FORM_ID}.joint.line8_futaBeforeCredit`)) -
    safeNum(ctx.get(`${FORM_ID}.joint.line10_futaCredit`)),
  ),
  isApplicable: (ctx) => (ctx.get(`${FORM_ID}.joint.lineB_futaEligible`) as boolean ?? false),
};

// ─────────────────────────────────────────────────────────────────────────────
// PART III — TOTAL HOUSEHOLD EMPLOYMENT TAXES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 12 — Total household employment taxes.
 * Line 6 (FICA + withheld income tax) + Line 11 (net FUTA).
 *
 * → Flows to Schedule 2 Line 9 → Schedule 2 Line 44 total additional taxes
 * → Form 1040 Line 17 → Line 24 total tax.
 *
 * NOTE: No companion deduction flows from Schedule H.
 * Unlike Schedule SE (which has a deductible half), household employment
 * taxes are entirely the employer's cost — no above-the-line deduction.
 */
const line12_totalHouseholdTax: NodeDefinition = {
  id: `${FORM_ID}.joint.line12_totalHouseholdTax`,
  kind: NodeKind.COMPUTED,
  label: 'Schedule H Line 12 — Total Household Employment Taxes',
  description: 'Total household employment taxes: FICA + any withheld income tax (Line 6) plus net FUTA (Line 11). Flows to Schedule 2 Line 9 → Form 1040 Line 17. No companion deduction — unlike SE tax, household employment taxes are not deductible.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['tax.selfEmployment'],
  dependencies: [
    `${FORM_ID}.joint.line6_ficaAndWithholding`,
    `${FORM_ID}.joint.line11_netFuta`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line6_ficaAndWithholding`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line11_netFuta`)),
  isApplicable: (ctx) => {
    const ficaEligible = ctx.get(`${FORM_ID}.joint.lineA_ficaEligible`) as boolean ?? false;
    const futaEligible = ctx.get(`${FORM_ID}.joint.lineB_futaEligible`) as boolean ?? false;
    return ficaEligible || futaEligible;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEDULE_H_NODES: NodeDefinition[] = [
  // Part I — FICA
  lineA_ficaEligible,
  line1_ssWages,
  line2_ficaTax,
  line3_medicareWages,
  line4_additionalMedicare,
  line5_federalWithheld,
  line6_ficaAndWithholding,
  // Part II — FUTA
  lineB_futaEligible,
  line7_futaWages,
  line8_futaBeforeCredit,
  line9_stateUiTaxPaid,
  line10_futaCredit,
  line11_netFuta,
  // Part III — Total
  line12_totalHouseholdTax,
];

export const SCHEDULE_H_OUTPUTS = {
  /** Line 12 — Total household employment taxes → Schedule 2 Line 9 */
  totalHouseholdTax: `${FORM_ID}.joint.line12_totalHouseholdTax`,
  /** Line 2 — FICA tax (combined employer + employee shares) */
  ficaTax: `${FORM_ID}.joint.line2_ficaTax`,
  /** Line 11 — Net FUTA tax */
  netFuta: `${FORM_ID}.joint.line11_netFuta`,
} as const;