/**
 * SCHEDULE EIC — EARNED INCOME CREDIT
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Qualifying children count (input)
 *   ✅ Investment income (input — disqualifier check)
 *   ✅ Primary filer age (input — childless EIC eligibility)
 *   ✅ MFS ineligibility guard
 *   ✅ Investment income disqualifier
 *   ✅ Childless age requirement check
 *   ✅ Worksheet A — Line 1 (earned income)
 *   ✅ Worksheet A — Line 2 (table lookup on earned income)
 *   ✅ Worksheet A — Line 3 (AGI)
 *   ✅ Worksheet A — Line 5 (table lookup on AGI)
 *   ✅ Worksheet A — Line 6 (final credit = min of Line 2 and Line 5)
 *   ✅ Eligibility gate — collapses to 0 when ineligible
 *   🚧 Worksheet B (self-employment / nontaxable combat pay — deferred)
 *   🚧 Separated spouse exception for MFS filers (deferred)
 *   🚧 Taxable scholarship / combat pay in earned income (deferred)
 *
 * WORKSHEET A IMPLEMENTATION:
 *   IRS Worksheet A (Form 1040 Instructions, Line 27) has 6 lines:
 *     Line 1 — Earned income
 *     Line 2 — Table lookup on Line 1 (phase-in credit)
 *     Line 3 — AGI
 *     Line 4 — Are Lines 1 and 3 the same? (branch)
 *     Line 5 — Table lookup on Line 3 (phase-out credit)  [only if Line 4 = No]
 *     Line 6 — Final credit = min(Line 2, Line 5)
 *   We implement this as individual nodes matching the form structure.
 *
 * TABLE LOOKUP:
 *   Uses binary search on EITC_2025_TABLE from ./constants/table.ts.
 *   Returns 0 when income is out of range (too high or zero).
 *
 * DEPENDENCY WIRING:
 *   Schedule EIC reads from:
 *     f1040.joint.earnedIncome          — earned income composite (derived.ts)
 *     f1040.joint.line11_adjustedGrossIncome — AGI
 *   Schedule EIC output flows to:
 *     f1040.joint.line27_earnedIncomeCredit — (payments.ts, currently deferred INPUT)
 *     → When Schedule EIC is wired, that node should become COMPUTED
 *       and depend on SCHEDULE_EIC_OUTPUTS.credit
 *
 * REGISTRATION ORDER:
 *   engine.registerNodes([
 *     ...F1040_NODES,           ← AGI and earnedIncome must exist
 *     ...SCHEDULE_EIC_NODES,    ← reads from F1040
 *     ...SCHEDULE3_NODES,
 *     ...F1040_PAYMENT_NODES,
 *   ]);
 *
 * IRS References:
 *   Form 1040 Instructions (2025), Line 27 and Worksheet A
 *   IRS Publication 596 (2025) — Earned Income Credit
 *   IRC Section 32
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import {
  getScheduleEICConstants,
  getEICChildThresholds,
  hasExcessInvestmentIncome,
  meetsChildlessAgeRequirement,
} from './constants/index';

import { EITC_2025_TABLE } from './constants/table';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'schedule-eic';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE TABLE LOOKUP — no engine dependency, fully unit-testable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Binary search lookup into EITC_2025_TABLE.
 *
 * @param income             — Dollar amount to look up (rounded to nearest dollar)
 * @param isMFJ              — true for married_filing_jointly
 * @param numQualifyingChildren — clamped to 0–3
 * @returns                  — credit amount, or 0 if income out of table range
 */
function lookupEITCTable(
  income: number,
  isMFJ: boolean,
  numQualifyingChildren: number,
): number {
  const rounded  = Math.round(income);
  if (rounded <= 0) return 0;

  const childKey = Math.min(numQualifyingChildren, 3) as 0 | 1 | 2 | 3;

  let left   = 0;
  let right  = EITC_2025_TABLE.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const row : any = EITC_2025_TABLE[mid];

    if (rounded >= row.minIncome && rounded < row.maxIncome) {
      return isMFJ ? row.marriedJoint[childKey] : row.single[childKey];
    } else if (rounded < row.minIncome) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // Income exceeds table — no credit
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Number of qualifying children for EIC.
 *
 * Qualifying child requirements (IRS Pub 596):
 *   - Age: under 19, OR under 24 and a full-time student, OR any age if permanently disabled
 *   - Relationship: son, daughter, stepchild, foster child, sibling, or descendant
 *   - Residency: lived with taxpayer in the US for more than half the year
 *   - SSN: must have a valid Social Security Number
 *   - Joint return: child cannot file a joint return (unless only to claim a refund)
 *
 * Preparer enters the count of children who meet ALL requirements.
 * A child who lacks a valid SSN does NOT count here — use 0 and claim
 * only the childless EIC amount.
 */
const inputNumQualifyingChildren: NodeDefinition = {
  id:                 `${FORM_ID}.joint.inputNumQualifyingChildren`,
  kind:               NodeKind.INPUT,
  label:              'Schedule EIC — Number of Qualifying Children (with valid SSN)',
  description:        'Count of qualifying children who meet all EIC requirements AND have valid Social Security Numbers. Children without valid SSNs do not count — enter 0 and claim childless EIC if otherwise eligible.',
  valueType:          NodeValueType.INTEGER,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'schedule-eic.q.numQualifyingChildren',
  defaultValue:       0,
  validation:         { min: 0, max: 10 },
};

/**
 * Investment income for EIC disqualification check.
 *
 * If investment income exceeds $11,950 (2025), the taxpayer is ineligible
 * for EIC entirely, regardless of earned income or qualifying children.
 *
 * Investment income includes: taxable interest, ordinary dividends,
 * capital gain net income, net passive income, and net rental/royalty income.
 * It does NOT include tax-exempt interest.
 *
 * 🚧 DEFERRED: Will eventually be computed from Schedule B, Schedule D,
 * and other investment income nodes. Manual input until those are built.
 */
const inputInvestmentIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.inputInvestmentIncome`,
  kind:               NodeKind.INPUT,
  label:              'Schedule EIC — Investment Income',
  description:        'Total investment income: taxable interest, ordinary dividends, capital gain net income, passive income, and rental/royalty income. If this exceeds $11,950 (2025), EIC is completely disallowed. Enter 0 if none.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'schedule-eic.q.investmentIncome',
  defaultValue:       0,
};

/**
 * Primary filer age at year-end.
 *
 * Required ONLY for childless EIC (0 qualifying children).
 * For childless EIC, the filer must be at least 25 and no more than 64.
 * For returns with qualifying children, this node is not a disqualifier.
 *
 * For MFJ returns: either spouse meeting the age requirement is sufficient.
 * We use the primary filer age as the input; preparer should enter the
 * age of whichever spouse meets the requirement if the primary does not.
 */
const inputPrimaryAge: NodeDefinition = {
  id:                 `${FORM_ID}.joint.inputPrimaryAge`,
  kind:               NodeKind.INPUT,
  label:              'Schedule EIC — Primary Filer Age at Year-End (Childless EIC)',
  description:        'Age of primary filer on December 31, 2025. Only used for childless EIC (0 qualifying children). Filer must be 25–64. For MFJ: enter whichever spouse\'s age satisfies the requirement. Irrelevant when qualifying children are present.',
  valueType:          NodeValueType.INTEGER,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'schedule-eic.q.primaryAge',
  defaultValue:       0,
  validation:         { min: 0, max: 130 },
};

// ─────────────────────────────────────────────────────────────────────────────
// ELIGIBILITY GUARDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MFS Ineligibility Flag
 *
 * Married Filing Separately filers are categorically ineligible for EIC
 * (IRC §32(d)), with a narrow exception for legally separated spouses
 * who meet the IRC §7703(b) "considered unmarried" test.
 *
 * That exception is deferred. This node is true (ineligible) for all
 * MFS filers; false for all other filing statuses.
 *
 * Value: true = INELIGIBLE (MFS); false = not disqualified by filing status.
 */
const isMFSIneligible: NodeDefinition = {
  id:                 `${FORM_ID}.joint.isMFSIneligible`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule EIC — MFS Filing Status Disqualifier',
  description:        'True when filing status is Married Filing Separately, which categorically disallows EIC. The separated spouse exception (IRC §7703(b)) is deferred.',
  valueType:          NodeValueType.BOOLEAN,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [],
  compute: (ctx) => ctx.filingStatus === 'married_filing_separately',
};

/**
 * Investment Income Disqualifier
 *
 * True when investment income exceeds $11,950 (2025).
 * Value: true = INELIGIBLE; false = investment income within limit.
 */
const isInvestmentIncomeDisqualified: NodeDefinition = {
  id:                 `${FORM_ID}.joint.isInvestmentIncomeDisqualified`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule EIC — Investment Income Disqualifier',
  description:        'True when investment income exceeds $11,950 (2025 limit), making the taxpayer ineligible for EIC.',
  valueType:          NodeValueType.BOOLEAN,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.inputInvestmentIncome`],
  compute: (ctx) => {
    const c              = getScheduleEICConstants(ctx.taxYear);
    const investmentInc  = safeNum(ctx.get(`${FORM_ID}.joint.inputInvestmentIncome`));
    return hasExcessInvestmentIncome(investmentInc, c);
  },
};

/**
 * Childless Age Requirement Disqualifier
 *
 * Only applies when numQualifyingChildren = 0.
 * True when the filer fails the 25–64 age requirement.
 * Always false (not disqualified) when qualifying children are present.
 */
const isChildlessAgeDisqualified: NodeDefinition = {
  id:                 `${FORM_ID}.joint.isChildlessAgeDisqualified`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule EIC — Childless Age Requirement Disqualifier',
  description:        'True when claiming childless EIC (0 qualifying children) and filer does not meet the age 25–64 requirement. Always false when qualifying children are present.',
  valueType:          NodeValueType.BOOLEAN,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.inputNumQualifyingChildren`,
    `${FORM_ID}.joint.inputPrimaryAge`,
  ],
  compute: (ctx) => {
    const children = safeNum(ctx.get(`${FORM_ID}.joint.inputNumQualifyingChildren`));
    if (children > 0) return false;  // Age requirement does not apply with children

    const c   = getScheduleEICConstants(ctx.taxYear);
    const age = safeNum(ctx.get(`${FORM_ID}.joint.inputPrimaryAge`));
    return !meetsChildlessAgeRequirement(age, c);
  },
};

/**
 * Overall EIC Eligibility
 *
 * Consolidates all disqualification guards into a single boolean.
 * true = ELIGIBLE; false = ineligible (any disqualifier fires).
 *
 * Used as the isApplicable gate on the final credit node.
 * Disqualifiers checked:
 *   1. MFS filing status
 *   2. Excess investment income (> $11,950)
 *   3. Childless age failure (age < 25 or > 64, no qualifying children)
 */
const isEligible: NodeDefinition = {
  id:                 `${FORM_ID}.joint.isEligible`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule EIC — Overall Eligibility',
  description:        'True when no disqualification applies: not MFS, investment income within limit, and age requirement met for childless EIC. Used to gate the final credit computation.',
  valueType:          NodeValueType.BOOLEAN,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.isMFSIneligible`,
    `${FORM_ID}.joint.isInvestmentIncomeDisqualified`,
    `${FORM_ID}.joint.isChildlessAgeDisqualified`,
  ],
  compute: (ctx) => {
    const mfs         = ctx.get(`${FORM_ID}.joint.isMFSIneligible`);
    const investment  = ctx.get(`${FORM_ID}.joint.isInvestmentIncomeDisqualified`);
    const age         = ctx.get(`${FORM_ID}.joint.isChildlessAgeDisqualified`);
    return mfs !== true && investment !== true && age !== true;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKSHEET A — LINES 1–6
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Worksheet A Line 1 — Earned Income
 *
 * From F1040 derived earnedIncome node (f1040/derived.ts).
 * Includes W-2 wages and the other-income proxy.
 * Will expand to include Schedule C/SE net profit as those forms are built.
 *
 * NOTE: The IRS worksheet says "earned income from Step 5" which covers
 * wages, salaries, tips, net SE income, and taxable scholarships.
 * We use the f1040.joint.earnedIncome composite node which is the
 * correct source of truth for earned income across the engine.
 */
const worksheetLine1_earnedIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.worksheetLine1_earnedIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule EIC Worksheet A Line 1 — Earned Income',
  description:        'Earned income for EIC purposes. From F1040 earned income composite (W-2 wages + other earned income proxy). Flows to table lookup for phase-in credit.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       ['f1040.joint.earnedIncome'],
  compute: (ctx) => safeNum(ctx.get('f1040.joint.earnedIncome')),
};

/**
 * Worksheet A Line 2 — Phase-In Credit (table lookup on earned income)
 *
 * Look up Line 1 (earned income) in the EIC Table using filing status
 * and number of qualifying children. This gives the phase-in credit
 * — the credit based on how much the filer has earned.
 *
 * If this is zero, there is no EIC (earned income too low or too high).
 */
const worksheetLine2_phaseInCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.worksheetLine2_phaseInCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule EIC Worksheet A Line 2 — Phase-In Credit (Earned Income Table Lookup)',
  description:        'EIC amount from table lookup on earned income (Line 1). Uses filing status and number of qualifying children columns. This is the phase-in credit before the AGI phase-out check.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.worksheetLine1_earnedIncome`,
    `${FORM_ID}.joint.inputNumQualifyingChildren`,
  ],
  compute: (ctx) => {
    const earnedIncome  = safeNum(ctx.get(`${FORM_ID}.joint.worksheetLine1_earnedIncome`));
    const children      = safeNum(ctx.get(`${FORM_ID}.joint.inputNumQualifyingChildren`));
    const isMFJ         = ctx.filingStatus === 'married_filing_jointly';
    return lookupEITCTable(earnedIncome, isMFJ, children);
  },
};

/**
 * Worksheet A Line 3 — AGI
 *
 * From Form 1040 Line 11. Used for the phase-out lookup when AGI
 * differs from earned income (e.g., investment income boosts AGI above
 * the earned income amount, accelerating the phase-out).
 */
const worksheetLine3_agi: NodeDefinition = {
  id:                 `${FORM_ID}.joint.worksheetLine3_agi`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule EIC Worksheet A Line 3 — AGI',
  description:        'Adjusted Gross Income from Form 1040 Line 11. Compared against earned income (Line 1) to determine whether an AGI phase-out lookup is needed.',
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
 * Worksheet A Line 5 — AGI Phase-Out Credit (table lookup on AGI)
 *
 * Per the IRS worksheet: "Look up the amount on line 3 [AGI] in the
 * EIC Table. Enter the smaller of line 2 or line 5 on line 6."
 *
 * This step applies the phase-out reduction. When AGI is higher than
 * earned income (because of investment or other unearned income),
 * the AGI lookup produces a smaller credit, correctly reducing EIC.
 *
 * When AGI = earned income (Line 3 = Line 1), the IRS says skip to
 * Line 6 and use Line 2 directly. We still compute this node in that
 * case — it will equal Line 2, so min(Line2, Line5) = Line2 correctly.
 */
const worksheetLine5_agiLookup: NodeDefinition = {
  id:                 `${FORM_ID}.joint.worksheetLine5_agiLookup`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule EIC Worksheet A Line 5 — AGI Phase-Out Credit (AGI Table Lookup)',
  description:        'EIC amount from table lookup on AGI (Line 3). When AGI exceeds earned income, this produces a smaller credit, implementing the phase-out. Final credit is min(Line 2, Line 5).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.worksheetLine3_agi`,
    `${FORM_ID}.joint.inputNumQualifyingChildren`,
  ],
  compute: (ctx) => {
    const agi      = safeNum(ctx.get(`${FORM_ID}.joint.worksheetLine3_agi`));
    const children = safeNum(ctx.get(`${FORM_ID}.joint.inputNumQualifyingChildren`));
    const isMFJ    = ctx.filingStatus === 'married_filing_jointly';
    return lookupEITCTable(agi, isMFJ, children);
  },
};

/**
 * Worksheet A Line 6 — Final EIC Credit
 *
 * "This is your Earned Income Credit."
 * = min(Line 2 phase-in credit, Line 5 AGI phase-out credit)
 *
 * When Line 2 = 0 (earned income too low or too high), result is 0.
 * When Line 5 = 0 (AGI in phase-out zone), result is 0.
 * Otherwise: whichever constraint is binding produces the final credit.
 *
 * isApplicable: collapses to SKIPPED (returns null) when any disqualifier
 * fires. This is the correct behavior — a SKIPPED node produces null which
 * is treated as 0 by downstream consumers.
 *
 * → Flows to f1040.joint.line27_earnedIncomeCredit (payments.ts)
 */
const worksheetLine6_finalCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.worksheetLine6_finalCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule EIC Worksheet A Line 6 — Final Earned Income Credit',
  description:        'Final EIC. The smaller of: phase-in credit (Line 2, based on earned income) and AGI phase-out credit (Line 5, based on AGI). Zero when either lookup returns 0. Flows to Form 1040 Line 27.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.refundable'],
  dependencies: [
    `${FORM_ID}.joint.isEligible`,
    `${FORM_ID}.joint.worksheetLine2_phaseInCredit`,
    `${FORM_ID}.joint.worksheetLine5_agiLookup`,
  ],
  compute: (ctx) => {
    const phaseIn   = safeNum(ctx.get(`${FORM_ID}.joint.worksheetLine2_phaseInCredit`));
    const agiLookup = safeNum(ctx.get(`${FORM_ID}.joint.worksheetLine5_agiLookup`));
    return Math.min(phaseIn, agiLookup);
  },
  isApplicable: (ctx) => {
    // Gate on eligibility — if any disqualifier fires, skip this node
    const eligible = ctx.get(`${FORM_ID}.joint.isEligible`);
    return eligible === true;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Schedule EIC node definitions.
 *
 * REGISTRATION ORDER:
 *   Schedule EIC reads f1040.joint.earnedIncome and f1040.joint.line11_adjustedGrossIncome,
 *   so F1040_NODES (including derived.ts earnedIncome) must be registered first.
 *   Schedule EIC output feeds f1040.joint.line27_earnedIncomeCredit.
 *
 *   engine.registerNodes([
 *     ...F1040_NODES,           ← earnedIncome + AGI must exist
 *     ...SCHEDULE_EIC_NODES,    ← reads from F1040
 *     ...SCHEDULE3_NODES,
 *     ...F1040_PAYMENT_NODES,   ← line27 reads SCHEDULE_EIC_OUTPUTS.credit
 *   ]);
 *
 * NOTE ON LINE 27 (payments.ts):
 *   Currently line27_earnedIncomeCredit in payments.ts is a deferred INPUT.
 *   Once SCHEDULE_EIC_NODES is registered, replace that INPUT node with
 *   a COMPUTED node that depends on SCHEDULE_EIC_OUTPUTS.credit.
 *   The OUTPUT key below is the value to wire into that dependency.
 */
export const SCHEDULE_EIC_NODES: NodeDefinition[] = [
  // Inputs
  inputNumQualifyingChildren,
  inputInvestmentIncome,
  inputPrimaryAge,
  // Eligibility guards
  isMFSIneligible,
  isInvestmentIncomeDisqualified,
  isChildlessAgeDisqualified,
  isEligible,
  // Worksheet A
  worksheetLine1_earnedIncome,
  worksheetLine2_phaseInCredit,
  worksheetLine3_agi,
  worksheetLine5_agiLookup,
  worksheetLine6_finalCredit,
];

export const SCHEDULE_EIC_OUTPUTS = {
  /** Final EIC → Form 1040 Line 27 */
  credit: `${FORM_ID}.joint.worksheetLine6_finalCredit`,
} as const;