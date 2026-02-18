/**
 * SCHEDULE 1 — ADDITIONAL INCOME AND ADJUSTMENTS
 * Part II: Adjustments to Income (above-the-line deductions)
 *
 * NEW PATTERN introduced here:
 *
 *   Pattern — Deduction aggregation with spouse summing
 *     The HSA deduction (Form 8889 Line 13) is per-filer (REPEATABLE).
 *     Schedule 1 Line 13 is a JOINT node that sums primary + spouse.
 *     This is the same pattern as Schedule 2 Line 8 and Line 17b,
 *     but now applied to deductions instead of penalties.
 *
 *   Pattern — Tolerant Part II total
 *     Schedule 1 Line 26 must sum all above-the-line deductions.
 *     Most Part II lines are 🚧 UNSUPPORTED (zero by default).
 *     The total is always valid: SKIPPED lines contribute 0.
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Line 13 — HSA deduction (primary + spouse from F8889 Line 13)
 *   🚧 Lines 11,12,14–23 — Other adjustments (input nodes defaulting to 0)
 *   ✅ Line 26 — Total adjustments (tolerant sum of all Part II lines)
 *
 * IRS References:
 *   Schedule 1 Instructions (2025)
 *   Form 1040 Line 10 = Schedule 1 Line 26
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

/** Treat null/SKIPPED/UNSUPPORTED node values as 0 in aggregation. */
function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART II LINES — DEFERRED (input nodes, default 0)
// These exist so the aggregation on Line 26 is complete even before
// we implement the forms that feed them. A preparer can enter values
// manually if needed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: build a deferred/unsupported Part II input node.
 * Keeps the definition list clean — these are all the same shape.
 */
function deferredAdjustment(
  lineId:      string,
  lineNumber:  string,
  label:       string,
  questionId:  string,
  ircSection?: string,
): NodeDefinition {
  return {
    id:                 `${FORM_ID}.joint.${lineId}`,
    kind:               NodeKind.INPUT,
    label:              `Schedule 1 Line ${lineNumber} — ${label}`,
    description:        `${label}. Not yet supported — enter manually if applicable.`,
    valueType:          NodeValueType.CURRENCY,
    allowNegative:      false,
    owner:              NodeOwner.JOINT,
    repeatable:         false,
    applicableTaxYears: APPLICABLE_YEARS,
    classifications:    ['deduction.above_the_line'],
        irsCitation: {
      form: 'schedule1',
      line: lineNumber,
      ...(ircSection !== undefined ? { ircSection } : {}),
    },
    source:             InputSource.PREPARER,
    questionId,
    defaultValue:       0,
  };
}

const line11_educatorExpenses = deferredAdjustment(
  'line11_educatorExpenses', '11',
  'Educator Expenses', 'schedule1.q.educatorExpenses', '62(a)(2)(D)',
);

const line12_businessExpenses = deferredAdjustment(
  'line12_businessExpenses', '12',
  'Business Expenses (Form 2106)', 'schedule1.q.businessExpenses', '62(a)(2)(A)',
);

const line14_movingExpenses = deferredAdjustment(
  'line14_movingExpenses', '14',
  'Moving Expenses (Form 3903 — Military Only)', 'schedule1.q.movingExpenses', '217',
);

const line15_deductibleSETax = deferredAdjustment(
  'line15_deductibleSETax', '15',
  'Deductible Part of Self-Employment Tax', 'schedule1.q.seTax', '164(f)',
);

const line16_selfEmployedPlans = deferredAdjustment(
  'line16_selfEmployedPlans', '16',
  'Self-Employed SEP, SIMPLE, and Qualified Plans', 'schedule1.q.selfEmployedPlans', '404',
);

const line17_selfEmployedHealthInsurance = deferredAdjustment(
  'line17_selfEmployedHealthInsurance', '17',
  'Self-Employed Health Insurance Deduction', 'schedule1.q.selfEmployedHealth', '162(l)',
);

const line18_penaltyEarlyWithdrawal = deferredAdjustment(
  'line18_penaltyEarlyWithdrawal', '18',
  'Penalty on Early Withdrawal of Savings', 'schedule1.q.earlyWithdrawalPenalty',
);

const line19_alimony = deferredAdjustment(
  'line19_alimony', '19',
  'Alimony Paid (Pre-2019 Divorce Agreements)', 'schedule1.q.alimony', '215',
);

const line20_iraDeduction = deferredAdjustment(
  'line20_iraDeduction', '20',
  'IRA Deduction', 'schedule1.q.iraDeduction', '219',
);

const line21_studentLoanInterest = deferredAdjustment(
  'line21_studentLoanInterest', '21',
  'Student Loan Interest Deduction', 'schedule1.q.studentLoanInterest', '221',
);

const line22_archerMsa = deferredAdjustment(
  'line22_archerMsa', '22',
  'Archer MSA Deduction', 'schedule1.q.archerMsa', '220',
);

const line23_otherAdjustments = deferredAdjustment(
  'line23_otherAdjustments', '23',
  'Other Adjustments', 'schedule1.q.otherAdjustments',
);

// ─────────────────────────────────────────────────────────────────────────────
// LINE 13 — HSA DEDUCTION ✅ IMPLEMENTED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 13 — HSA deduction from Form 8889
 *
 * *** CROSS-FORM AGGREGATION — PRIMARY + SPOUSE ***
 *
 * Form 8889 Line 13 is per-filer (REPEATABLE).
 * Schedule 1 Line 13 is JOINT — it sums both filers' HSA deductions.
 *
 * When filing jointly and both spouses have HSAs, the total deduction
 * is the sum of their individual Form 8889 Line 13 values.
 *
 * When no spouse (or spouse has no HSA), spouse instance is SKIPPED,
 * ctx.get() returns null, safeNum() returns 0 — correct behavior.
 *
 * IRS: "If you and your spouse each have a separate HSA, complete
 * a separate Part I for each of you." (Form 8889 instructions)
 * Schedule 1 Line 13 then shows the combined total.
 */
const line13_hsaDeduction: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line13_hsaDeduction`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule 1 Line 13 — HSA Deduction (Form 8889)',
  description:        'HSA deduction from Form 8889 Line 13. Includes both primary and spouse deductions when filing jointly.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['deduction.above_the_line', 'contribution.hsa'],
  irsCitation:        { form: 'schedule1', line: '13', ircSection: '223(a)' },

  // Formally depend on primary only — spouse read via safeNum() fallback
  dependencies: [F8889_OUTPUTS.hsaDeduction],  // f8889.primary.line13_hsaDeduction

  compute: (ctx) => {
    const primaryDeduction = safeNum(ctx.get(F8889_OUTPUTS.hsaDeduction));
    // Spouse instance: SKIPPED when no spouse → safeNum returns 0
    const spouseDeduction  = safeNum(ctx.get('f8889.spouse.line13_hsaDeduction'));
    return primaryDeduction + spouseDeduction;
  },

  isApplicable: (ctx) => {
    const primary = safeNum(ctx.get(F8889_OUTPUTS.hsaDeduction));
    const spouse  = safeNum(ctx.get('f8889.spouse.line13_hsaDeduction'));
    return (primary + spouse) > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LINE 26 — TOTAL ADJUSTMENTS ✅ IMPLEMENTED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 26 — Total adjustments to income (Part II total)
 *
 * Sum of all Part II lines (11 through 23 + any other adjustments).
 * This flows to Form 1040 Line 10.
 *
 * TOLERANT AGGREGATION:
 * All source lines default to 0 or may be SKIPPED.
 * safeNum() ensures the total is always a valid number.
 *
 * When new deductions are implemented (IRA, student loan, etc.),
 * add their node IDs to the dependencies array and their
 * ctx.get() calls to the compute function.
 */
const line26_totalAdjustments: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line26_totalAdjustments`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule 1 Line 26 — Total Adjustments to Income',
  description:        'Sum of all above-the-line deductions (Lines 11–23). Flows to Form 1040 Line 10. SKIPPED and unsupported lines contribute zero.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['deduction.above_the_line'],
  irsCitation:        { form: 'schedule1', line: '26' },

  dependencies: [
    `${FORM_ID}.joint.line11_educatorExpenses`,
    `${FORM_ID}.joint.line12_businessExpenses`,
    `${FORM_ID}.joint.line13_hsaDeduction`,
    `${FORM_ID}.joint.line14_movingExpenses`,
    `${FORM_ID}.joint.line15_deductibleSETax`,
    `${FORM_ID}.joint.line16_selfEmployedPlans`,
    `${FORM_ID}.joint.line17_selfEmployedHealthInsurance`,
    `${FORM_ID}.joint.line18_penaltyEarlyWithdrawal`,
    `${FORM_ID}.joint.line19_alimony`,
    `${FORM_ID}.joint.line20_iraDeduction`,
    `${FORM_ID}.joint.line21_studentLoanInterest`,
    `${FORM_ID}.joint.line22_archerMsa`,
    `${FORM_ID}.joint.line23_otherAdjustments`,
  ],

  compute: (ctx) => {
    return (
      safeNum(ctx.get(`${FORM_ID}.joint.line11_educatorExpenses`))             +
      safeNum(ctx.get(`${FORM_ID}.joint.line12_businessExpenses`))             +
      safeNum(ctx.get(`${FORM_ID}.joint.line13_hsaDeduction`))                 +
      safeNum(ctx.get(`${FORM_ID}.joint.line14_movingExpenses`))               +
      safeNum(ctx.get(`${FORM_ID}.joint.line15_deductibleSETax`))              +
      safeNum(ctx.get(`${FORM_ID}.joint.line16_selfEmployedPlans`))            +
      safeNum(ctx.get(`${FORM_ID}.joint.line17_selfEmployedHealthInsurance`))  +
      safeNum(ctx.get(`${FORM_ID}.joint.line18_penaltyEarlyWithdrawal`))       +
      safeNum(ctx.get(`${FORM_ID}.joint.line19_alimony`))                      +
      safeNum(ctx.get(`${FORM_ID}.joint.line20_iraDeduction`))                 +
      safeNum(ctx.get(`${FORM_ID}.joint.line21_studentLoanInterest`))          +
      safeNum(ctx.get(`${FORM_ID}.joint.line22_archerMsa`))                    +
      safeNum(ctx.get(`${FORM_ID}.joint.line23_otherAdjustments`))
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All Schedule 1 node definitions.
 * Must be registered alongside F8889_NODES (cross-form dependency on Line 13).
 *
 * Usage:
 *   engine.registerNodes([...F8889_NODES, ...F5329_NODES,
 *                         ...SCHEDULE1_NODES, ...SCHEDULE2_NODES,
 *                         ...F1040_NODES]);
 */
export const SCHEDULE1_NODES: NodeDefinition[] = [
  // Part II — deferred input nodes
  line11_educatorExpenses,
  line12_businessExpenses,
  line14_movingExpenses,
  line15_deductibleSETax,
  line16_selfEmployedPlans,
  line17_selfEmployedHealthInsurance,
  line18_penaltyEarlyWithdrawal,
  line19_alimony,
  line20_iraDeduction,
  line21_studentLoanInterest,
  line22_archerMsa,
  line23_otherAdjustments,
  // Part II — implemented computed nodes
  line13_hsaDeduction,
  line26_totalAdjustments,
];

/**
 * Output node IDs from Schedule 1 that flow to Form 1040.
 * Form 1040 Line 10 = Schedule 1 Line 26.
 */
export const SCHEDULE1_OUTPUTS = {
  totalAdjustments: `${FORM_ID}.joint.line26_totalAdjustments`,
} as const;