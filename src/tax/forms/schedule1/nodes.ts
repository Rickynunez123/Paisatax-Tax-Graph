/**
 * SCHEDULE 1 — ADDITIONAL INCOME AND ADJUSTMENTS
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *
 *   Part I — Additional Income
 *   🚧 Line 1   — Taxable refunds of state/local income taxes    (input, deferred)
 *   🚧 Line 2a  — Alimony received (pre-2019 divorce only)       (input, deferred)
 *   🚧 Line 3   — Business income/loss (Schedule C)              (input, deferred → Schedule C)
 *   🚧 Line 4   — Other gains/losses (Form 4797)                 (input, deferred)
 *   🚧 Line 5   — Rental/royalty/partnership/S-corp (Schedule E) (input, deferred → Schedule E)
 *   🚧 Line 6   — Farm income/loss (Schedule F)                  (input, deferred → Schedule F)
 *   🚧 Line 7   — Unemployment compensation                      (input, deferred)
 *   🚧 Line 8z  — Other income (catch-all)                       (input, deferred)
 *   ✅ Line 10  — Total additional income (sum of Lines 1–8)     (computed)
 *
 *   Part II — Adjustments to Income
 *   🚧 Line 11  — Educator expenses                              (input, deferred)
 *   🚧 Line 12  — Business expenses (Form 2106)                  (input, deferred)
 *   ✅ Line 13  — HSA deduction (Form 8889)                      (computed from F8889)
 *   🚧 Line 14  — Moving expenses (Form 3903 — Military only)    (input, deferred)
 *   🚧 Line 15  — Deductible part of self-employment tax         (input, deferred → Schedule SE)
 *   🚧 Line 16  — Self-employed SEP/SIMPLE/qualified plans       (input, deferred)
 *   🚧 Line 17  — Self-employed health insurance deduction       (input, deferred)
 *   🚧 Line 18  — Penalty on early withdrawal of savings         (input, deferred)
 *   🚧 Line 19  — Alimony paid (pre-2019 divorce agreements)     (input, deferred)
 *   🚧 Line 20  — IRA deduction                                  (input, deferred)
 *   🚧 Line 21  — Student loan interest deduction                (input, deferred)
 *   🚧 Line 22  — Archer MSA deduction                          (input, deferred)
 *   🚧 Line 23  — Other adjustments                             (input, deferred)
 *   ✅ Line 26  — Total adjustments (sum of Lines 11–23)         (computed)
 *
 * HOW PART I CONNECTS TO FORM 1040:
 *   Schedule 1 Line 10 → Form 1040 Line 8 (additional income)
 *   Form 1040 Line 9 (total income) = Line 1a (W-2) + Line 8 (Schedule 1 Line 10)
 *
 * UPGRADE PATH FOR DEFERRED PART I LINES:
 *   When Schedule C is built:
 *     - Replace line3_businessIncome INPUT with a COMPUTED node that reads
 *       from schedule-c's net profit output
 *     - earnedIncome in f1040/derived.ts gains scheduleC_netProfit dependency
 *   When Schedule E is built:
 *     - Replace line5_rentalIncome INPUT similarly
 *   When Schedule SE is built:
 *     - Replace line15_deductibleSETax INPUT in Part II with computed node
 *
 * IRS References:
 *   Schedule 1 Instructions (2025)
 *   Form 1040 Instructions (2025), Lines 8 and 10
 */

import type { NodeDefinition } from '../../../core/graph/node.types';

import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import { F8889_OUTPUTS } from '../f8889/nodes';

const APPLICABLE_YEARS = ['2024', '2025'];
const FORM_ID          = 'schedule1';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deferred income node — Part I.
 * These are placeholders that accept manual entry.
 * When the upstream form is built, the node kind flips to COMPUTED.
 * allowNegative: true because income lines can be losses (Sch C, E, F).
 */
function deferredIncome(
  lineId:     string,
  lineNumber: string,
  label:      string,
  questionId: string,
  allowNegative = false,
): NodeDefinition {
  return {
    id:                 `${FORM_ID}.joint.${lineId}`,
    kind:               NodeKind.INPUT,
    label:              `Schedule 1 Line ${lineNumber} — ${label}`,
    description:        `${label}. Deferred — will be computed from upstream form when implemented. Enter manually if applicable.`,
    valueType:          NodeValueType.CURRENCY,
    allowNegative,
    owner:              NodeOwner.JOINT,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['income.other'],
    source:             InputSource.PREPARER,
    questionId,
    defaultValue:       0,
  };
}

/**
 * Deferred adjustment node — Part II.
 * Losses are not applicable here — adjustments are always positive or zero.
 */
function deferredAdjustment(
  lineId: string,
  lineNumber: string,
  label: string,
  questionId: string,
): NodeDefinition {
  return {
    id: `${FORM_ID}.joint.${lineId}`,
    kind: NodeKind.INPUT,
    label: `Schedule 1 Line ${lineNumber} — ${label}`,
    description: `${label}. Deferred — enter manually if applicable.`,
    valueType: NodeValueType.CURRENCY,
    allowNegative: false,
    owner: NodeOwner.JOINT,
    repeatable: false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications: ["deduction.above_the_line"],
    source: InputSource.PREPARER,
    questionId,
    defaultValue: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PART I — ADDITIONAL INCOME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 1 — Taxable refunds, credits, or offsets of state and local income taxes.
 * Taxable only if the taxpayer deducted those taxes in a prior year (tax benefit rule).
 * 🚧 DEFERRED
 */
const line1_taxableRefunds = deferredIncome(
  'line1_taxableRefunds',
  '1',
  'Taxable Refunds of State/Local Income Taxes',
  'schedule1.q.taxableRefunds',
);

/**
 * Line 2a — Alimony received.
 * Only taxable for divorce/separation agreements executed BEFORE January 1, 2019.
 * Post-2018 alimony is NOT income to the recipient (TCJA).
 * 🚧 DEFERRED
 */
const line2a_alimonyReceived = deferredIncome(
  'line2a_alimonyReceived',
  '2a',
  'Alimony Received (Pre-2019 Divorce/Separation Agreements Only)',
  'schedule1.q.alimonyReceived',
);

/**
 * Line 3 — Business income or (loss) from Schedule C.
 * Can be negative (a loss). Feeds earnedIncome in derived.ts when Schedule C built.
 * 🚧 DEFERRED — will become COMPUTED when Schedule C is implemented.
 */
const line3_businessIncome = deferredIncome(
  'line3_businessIncome',
  '3',
  'Business Income or (Loss) — Schedule C',
  'schedule1.q.businessIncome',
  true, // allowNegative — Schedule C net loss is valid
);

/**
 * Line 4 — Other gains or (losses) from Form 4797.
 * Gains/losses from sale of business property. Separate from Schedule D capital gains.
 * Can be negative.
 * 🚧 DEFERRED
 */
const line4_otherGains = deferredIncome(
  'line4_otherGains',
  '4',
  'Other Gains or (Losses) — Form 4797',
  'schedule1.q.otherGains',
  true, // allowNegative
);

/**
 * Line 5 — Rental real estate, royalties, partnerships, S corps, trusts (Schedule E).
 * Commonly negative for rental losses (passive activity rules may limit deduction).
 * Can be negative.
 * 🚧 DEFERRED — will become COMPUTED when Schedule E is implemented.
 */
const line5_rentalIncome = deferredIncome(
  'line5_rentalIncome',
  '5',
  'Rental Real Estate, Royalties, Partnerships, S Corps, Trusts — Schedule E',
  'schedule1.q.rentalIncome',
  true, // allowNegative — rental losses are common
);

/**
 * Line 6 — Farm income or (loss) from Schedule F.
 * Can be negative.
 * 🚧 DEFERRED — will become COMPUTED when Schedule F is implemented.
 */
const line6_farmIncome = deferredIncome(
  'line6_farmIncome',
  '6',
  'Farm Income or (Loss) — Schedule F',
  'schedule1.q.farmIncome',
  true, // allowNegative
);

/**
 * Line 7 — Unemployment compensation.
 * Fully taxable federal income. Received on Form 1099-G.
 * 🚧 DEFERRED
 */
const line7_unemploymentCompensation = deferredIncome(
  'line7_unemploymentCompensation',
  '7',
  'Unemployment Compensation (Form 1099-G)',
  'schedule1.q.unemploymentCompensation',
);

/**
 * Line 8z — Other income (catch-all).
 * Covers: gambling winnings, cancellation of debt, taxable distributions
 * from HSA used for non-medical purposes (already captured in F8889/F5329),
 * prizes/awards, and other income not fitting a specific line.
 * 🚧 DEFERRED
 *
 * NOTE: Non-qualified HSA distributions flow through F8889 → F5329 → Schedule 2
 * as penalty taxes, NOT through this line. Do not double-count.
 */
const line8z_otherIncome = deferredIncome(
  'line8z_otherIncome',
  '8z',
  'Other Income (Gambling Winnings, Prizes, Cancellation of Debt, etc.)',
  'schedule1.q.otherIncome',
);

/**
 * Line 10 — Combine lines 1 through 8. This is your additional income.
 * Flows to Form 1040 Line 8.
 *
 * CRITICAL: This total CAN be negative if losses (Sch C, E, F) exceed income.
 * Form 1040 Line 9 (total income) will then be reduced accordingly.
 * However the engine floor at Line 9 handles the overall floor — Line 10
 * itself is allowed to go negative.
 *
 * ✅ IMPLEMENTED
 */
const line10_totalAdditionalIncome: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line10_totalAdditionalIncome`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule 1 Line 10 — Total Additional Income',
  description:        'Sum of all Part I income lines (Lines 1–8). Flows to Form 1040 Line 8. Can be negative when losses exceed other income on this schedule.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      true, // Net losses from Sch C/E/F can make this negative
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.other'],
  dependencies: [
    `${FORM_ID}.joint.line1_taxableRefunds`,
    `${FORM_ID}.joint.line2a_alimonyReceived`,
    `${FORM_ID}.joint.line3_businessIncome`,
    `${FORM_ID}.joint.line4_otherGains`,
    `${FORM_ID}.joint.line5_rentalIncome`,
    `${FORM_ID}.joint.line6_farmIncome`,
    `${FORM_ID}.joint.line7_unemploymentCompensation`,
    `${FORM_ID}.joint.line8z_otherIncome`,
  ],
  compute: (ctx) => (
    safeNum(ctx.get(`${FORM_ID}.joint.line1_taxableRefunds`))      +
    safeNum(ctx.get(`${FORM_ID}.joint.line2a_alimonyReceived`))    +
    safeNum(ctx.get(`${FORM_ID}.joint.line3_businessIncome`))      +
    safeNum(ctx.get(`${FORM_ID}.joint.line4_otherGains`))          +
    safeNum(ctx.get(`${FORM_ID}.joint.line5_rentalIncome`))        +
    safeNum(ctx.get(`${FORM_ID}.joint.line6_farmIncome`))          +
    safeNum(ctx.get(`${FORM_ID}.joint.line7_unemploymentCompensation`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line8z_otherIncome`))
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// PART II — ADJUSTMENTS TO INCOME
// ─────────────────────────────────────────────────────────────────────────────

const line11_educatorExpenses = deferredAdjustment(
  "line11_educatorExpenses",
  "11",
  "Educator Expenses",
  "schedule1.q.educatorExpenses",
);

const line12_businessExpenses = deferredAdjustment(
  "line12_businessExpenses",
  "12",
  "Business Expenses (Form 2106)",
  "schedule1.q.businessExpenses",
);

const line14_movingExpenses = deferredAdjustment(
  "line14_movingExpenses",
  "14",
  "Moving Expenses (Form 3903 — Military Only)",
  "schedule1.q.movingExpenses",
);

/**
 * Line 15 — Deductible part of self-employment tax.
 * 🚧 DEFERRED — will become COMPUTED when Schedule SE is built.
 * Schedule SE computes total SE tax; half is deductible here.
 * This is one of the few deductions that depends on a tax computation.
 */
const line15_deductibleSETax = deferredAdjustment(
  "line15_deductibleSETax",
  "15",
  "Deductible Part of Self-Employment Tax (Schedule SE)",
  "schedule1.q.seTax",
);

const line16_selfEmployedPlans = deferredAdjustment(
  "line16_selfEmployedPlans",
  "16",
  "Self-Employed SEP, SIMPLE, and Qualified Plans",
  "schedule1.q.selfEmployedPlans",
);

const line17_selfEmployedHealthInsurance = deferredAdjustment(
  "line17_selfEmployedHealthInsurance",
  "17",
  "Self-Employed Health Insurance Deduction",
  "schedule1.q.selfEmployedHealth",
);

const line18_penaltyEarlyWithdrawal = deferredAdjustment(
  "line18_penaltyEarlyWithdrawal",
  "18",
  "Penalty on Early Withdrawal of Savings",
  "schedule1.q.earlyWithdrawalPenalty",
);

const line19_alimonyPaid = deferredAdjustment(
  "line19_alimonyPaid",
  "19",
  "Alimony Paid (Pre-2019 Divorce Agreements)",
  "schedule1.q.alimony",
);

const line20_iraDeduction = deferredAdjustment(
  "line20_iraDeduction",
  "20",
  "IRA Deduction",
  "schedule1.q.iraDeduction",
);

const line21_studentLoanInterest = deferredAdjustment(
  "line21_studentLoanInterest",
  "21",
  "Student Loan Interest Deduction",
  "schedule1.q.studentLoanInterest",
);

const line22_archerMsa = deferredAdjustment(
  "line22_archerMsa",
  "22",
  "Archer MSA Deduction",
  "schedule1.q.archerMsa",
);

const line23_otherAdjustments = deferredAdjustment(
  "line23_otherAdjustments",
  "23",
  "Other Adjustments",
  "schedule1.q.otherAdjustments",
);

// ─────────────────────────────────────────────────────────────────────────────
// LINE 13 — HSA DEDUCTION ✅ IMPLEMENTED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 13 — HSA deduction from Form 8889.
 * JOINT node that sums primary + spouse HSA deductions.
 * Both spouse instance IDs are in the formal dependencies array.
 * The engine materializes f8889.spouse.line13_hsaDeduction when hasSpouse = true.
 */
const line13_hsaDeduction: NodeDefinition = {
  id: `${FORM_ID}.joint.line13_hsaDeduction`,
  kind: NodeKind.COMPUTED,
  label: "Schedule 1 Line 13 — HSA Deduction (Form 8889)",
  description:
    "HSA deduction from Form 8889 Line 13. Includes both primary and spouse deductions when filing jointly.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["deduction.above_the_line", "contribution.hsa"],
  dependencies: [
    F8889_OUTPUTS.hsaDeduction, // f8889.primary.line13_hsaDeduction
    "f8889.spouse.line13_hsaDeduction", // materialized by engine when hasSpouse = true
  ],
  compute: (ctx) => {
    const primary = safeNum(ctx.get(F8889_OUTPUTS.hsaDeduction));
    const spouse = safeNum(ctx.get("f8889.spouse.line13_hsaDeduction"));
    return primary + spouse;
  },
  isApplicable: (ctx) => {
    const primary = safeNum(ctx.get(F8889_OUTPUTS.hsaDeduction));
    const spouse = safeNum(ctx.get("f8889.spouse.line13_hsaDeduction"));
    return primary + spouse > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 26 — TOTAL ADJUSTMENTS ✅ IMPLEMENTED
// ─────────────────────────────────────────────────────────────────────────────

const line26_totalAdjustments: NodeDefinition = {
  id: `${FORM_ID}.joint.line26_totalAdjustments`,
  kind: NodeKind.COMPUTED,
  label: "Schedule 1 Line 26 — Total Adjustments to Income",
  description:
    "Sum of all above-the-line deductions (Lines 11–23). Flows to Form 1040 Line 10.",
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ["deduction.above_the_line"],
  dependencies: [
    `${FORM_ID}.joint.line11_educatorExpenses`,
    `${FORM_ID}.joint.line12_businessExpenses`,
    `${FORM_ID}.joint.line13_hsaDeduction`,
    `${FORM_ID}.joint.line14_movingExpenses`,
    `${FORM_ID}.joint.line15_deductibleSETax`,
    `${FORM_ID}.joint.line16_selfEmployedPlans`,
    `${FORM_ID}.joint.line17_selfEmployedHealthInsurance`,
    `${FORM_ID}.joint.line18_penaltyEarlyWithdrawal`,
    `${FORM_ID}.joint.line19_alimonyPaid`,
    `${FORM_ID}.joint.line20_iraDeduction`,
    `${FORM_ID}.joint.line21_studentLoanInterest`,
    `${FORM_ID}.joint.line22_archerMsa`,
    `${FORM_ID}.joint.line23_otherAdjustments`,
  ],
  compute: (ctx) =>
    safeNum(ctx.get(`${FORM_ID}.joint.line11_educatorExpenses`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line12_businessExpenses`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line13_hsaDeduction`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line14_movingExpenses`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line15_deductibleSETax`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line16_selfEmployedPlans`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line17_selfEmployedHealthInsurance`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line18_penaltyEarlyWithdrawal`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line19_alimonyPaid`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line20_iraDeduction`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line21_studentLoanInterest`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line22_archerMsa`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line23_otherAdjustments`)),
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEDULE1_NODES: NodeDefinition[] = [
  // Part I — Additional Income (deferred stubs)
  line1_taxableRefunds,
  line2a_alimonyReceived,
  line3_businessIncome,
  line4_otherGains,
  line5_rentalIncome,
  line6_farmIncome,
  line7_unemploymentCompensation,
  line8z_otherIncome,
  line10_totalAdditionalIncome, // ← Part I total
  // Part II — Adjustments (deferred stubs)
  line11_educatorExpenses,
  line12_businessExpenses,
  line14_movingExpenses,
  line15_deductibleSETax,
  line16_selfEmployedPlans,
  line17_selfEmployedHealthInsurance,
  line18_penaltyEarlyWithdrawal,
  line19_alimonyPaid,
  line20_iraDeduction,
  line21_studentLoanInterest,
  line22_archerMsa,
  line23_otherAdjustments,
  // Part II — HSA (implemented, must come after Part I deferred are registered)
  line13_hsaDeduction,
  // Part II total
  line26_totalAdjustments,
];

export const SCHEDULE1_OUTPUTS = {
  /** Part I total — flows to Form 1040 Line 8 */
  totalAdditionalIncome: `${FORM_ID}.joint.line10_totalAdditionalIncome`,
  /** Part II total — flows to Form 1040 Line 10 */
  totalAdjustments: `${FORM_ID}.joint.line26_totalAdjustments`,
} as const;