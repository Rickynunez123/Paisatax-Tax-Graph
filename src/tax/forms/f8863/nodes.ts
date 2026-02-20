/**
 * FORM 8863 — EDUCATION CREDITS (AOTC + LLC)
 *
 * ARCHITECTURE DECISION — One Form, Two Credits, Three Output Nodes:
 *
 *   This form handles two mutually exclusive-per-student credits.
 *   Rather than modeling per-student instances (which requires repeatable node
 *   infrastructure not yet built), we implement two parallel tracks:
 *
 *   Track A — AOTC (for students eligible for first-4-years credit):
 *     Input: total qualified AOTC expenses across all AOTC-eligible students
 *     Output 1: AOTC nonrefundable → Schedule 3 Line 3
 *     Output 2: AOTC refundable    → Form 1040 Line 29 (direct, bypasses Schedule 3)
 *
 *   Track B — LLC (for other students / graduate / professional):
 *     Input: total qualified LLC expenses for the return (all LLC students)
 *     Output 3: LLC nonrefundable  → Schedule 3 Line 3 (combined with AOTC nonrefundable)
 *
 *   Combined Output → Schedule 3 Line 3:
 *     nonRefundableEducationCredit = AOTC_nonrefundable + LLC_nonrefundable
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ AOTC: total qualified expenses input, tentative credit, phase-out, split
 *   ✅ LLC: total qualified expenses input, tentative credit, phase-out
 *   ✅ Combined nonrefundable output → Schedule 3 Line 3
 *   ✅ AOTC refundable output → Form 1040 Line 29
 *   ✅ MAGI phase-out for both credits
 *   ✅ Tax liability cap for nonrefundable portion (line 7 / Credit Limit Worksheet)
 *   🚧 Per-student repeatable instances (when repeatable node infra is ready)
 *   🚧 4-year AOTC eligibility tracking per student (preparer certifies eligibility)
 *   🚧 Scholarship/grant reduction from expenses (preparer adjusts gross expenses)
 *   🚧 Under-24 full-time student restriction on AOTC refundable (preparer flag)
 *
 * IRS References:
 *   Form 8863 Instructions (2025) — IRS.gov/instructions/i8863
 *   IRC Section 25A
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import {
  getF8863Constants,
  computePhaseOutMultiplier,
  computeAOTCTentative,
  computeLLCTentative,
} from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f8863';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED — MAGI (Lines 3 and 14 both use AGI from 1040)
// ─────────────────────────────────────────────────────────────────────────────

const magi: NodeDefinition = {
  id:                 `${FORM_ID}.joint.magi`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8863 — MAGI (Lines 3 & 14)',
  description:        'Modified AGI for education credit phase-outs. For most filers equals Form 1040 Line 11 AGI. Excludes foreign earned income (Form 2555) — deferred edge case.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       ['f1040.joint.line11_adjustedGrossIncome'],
  compute: (ctx) => safeNum(ctx.get('f1040.joint.line11_adjustedGrossIncome')),
};

// ─────────────────────────────────────────────────────────────────────────────
// TRACK A — AOTC (AMERICAN OPPORTUNITY CREDIT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AOTC — Total qualified education expenses (all AOTC students combined).
 *
 * Preparer enters ADJUSTED expenses (after subtracting tax-free scholarships,
 * Pell grants, and other tax-free assistance). We do not auto-reduce for
 * 1098-T Box 5 scholarships — preparer must enter net qualified amount.
 *
 * For multiple AOTC students: enter combined total. The per-student
 * calculation ($2,000 tier 1 + $2,000 tier 2) is approximated by applying
 * the formula to the combined amount. When per-student repeatable nodes are
 * built, this input will be replaced.
 *
 * Note: the AOTC formula is convex so treating combined expenses as a single
 * student slightly OVER-estimates the credit when total exceeds $4,000.
 * For now we store number of AOTC students and divide to approximate.
 */
const aotcNumStudents: NodeDefinition = {
  id:                 `${FORM_ID}.joint.aotcNumStudents`,
  kind:               NodeKind.INPUT,
  label:              'Form 8863 — Number of AOTC-Eligible Students',
  description:        'Number of students for whom you are claiming the American Opportunity Credit. Each must be in their first 4 years of postsecondary education and enrolled at least half-time.',
  valueType:          NodeValueType.INTEGER,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f8863.q.aotcNumStudents',
  defaultValue:       0,
  validation:         { min: 0, max: 10 },
};

const aotcQualifiedExpenses: NodeDefinition = {
  id:                 `${FORM_ID}.joint.aotcQualifiedExpenses`,
  kind:               NodeKind.INPUT,
  label:              'Form 8863 — AOTC Adjusted Qualified Expenses (All Students)',
  description:        'Total adjusted qualified education expenses for all AOTC-eligible students combined. Preparer must subtract tax-free scholarships, Pell grants, and employer-provided education assistance before entering. Includes tuition, required fees, and required course materials.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f8863.q.aotcQualifiedExpenses',
  defaultValue:       0,
};

/**
 * AOTC tentative credit (before phase-out and tax limit).
 *
 * For multiple students, we compute per-student average and apply the
 * two-tier formula per student, then sum.
 *
 * Per-student: 100% × min(expenses, $2,000) + 25% × min(max(0, expenses - $2,000), $2,000)
 *
 * Example: 2 students, $8,000 total → $4,000 each
 *   Per student: $2,000 × 100% + $2,000 × 25% = $2,500
 *   Total: $5,000
 */
const aotcTentativeCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.aotcTentativeCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8863 — AOTC Tentative Credit (Before Phase-Out)',
  description:        'AOTC before MAGI phase-out. Computed per-student: 100% of first $2,000 + 25% of next $2,000 per student. Maximum $2,500 per eligible student.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.aotcQualifiedExpenses`,
    `${FORM_ID}.joint.aotcNumStudents`,
  ],
  compute: (ctx) => {
    const c          = getF8863Constants(ctx.taxYear);
    const totalExp   = safeNum(ctx.get(`${FORM_ID}.joint.aotcQualifiedExpenses`));
    const numStudents = Math.max(1, safeNum(ctx.get(`${FORM_ID}.joint.aotcNumStudents`)));

    if (totalExp <= 0 || numStudents === 0) return 0;

    // Per-student expenses (average — approximation until per-student nodes exist)
    const perStudentExp = totalExp / numStudents;
    const perStudentCredit = computeAOTCTentative(perStudentExp, c);
    return perStudentCredit * numStudents;
  },
};

/**
 * AOTC phase-out multiplier (Lines 4–6 of the form).
 * Returns fraction of credit allowed based on MAGI.
 */
const aotcPhaseOutMultiplier: NodeDefinition = {
  id:                 `${FORM_ID}.joint.aotcPhaseOutMultiplier`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8863 — AOTC Phase-Out Multiplier',
  description:        'Fraction of AOTC allowed after MAGI phase-out. 1.0 = full credit (MAGI ≤ $80K/$160K). 0.0 = no credit (MAGI ≥ $90K/$180K). MFS = 0.0.',
  valueType:          NodeValueType.PERCENTAGE,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.magi`],
  compute: (ctx) => {
    const c    = getF8863Constants(ctx.taxYear);
    const magi = safeNum(ctx.get(`${FORM_ID}.joint.magi`));
    return computePhaseOutMultiplier(
      magi,
      ctx.filingStatus,
      c.aotc.phaseOutFloorSingle,
      c.aotc.phaseOutCeilSingle,
      c.aotc.phaseOutFloorMFJ,
      c.aotc.phaseOutCeilMFJ,
    );
  },
};

/**
 * AOTC allowed credit (tentative × phase-out multiplier).
 * This is the total AOTC (both refundable and nonrefundable portions combined).
 * Tax liability limit applies to the nonrefundable portion only (see below).
 */
const aotcAllowedCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.aotcAllowedCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8863 — AOTC Allowed Credit (After Phase-Out)',
  description:        'AOTC after MAGI phase-out. Split into 40% refundable (Form 1040 Line 29) and 60% nonrefundable (Schedule 3 Line 3).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.aotcTentativeCredit`,
    `${FORM_ID}.joint.aotcPhaseOutMultiplier`,
  ],
  compute: (ctx) => {
    const tentative   = safeNum(ctx.get(`${FORM_ID}.joint.aotcTentativeCredit`));
    const multiplier  = safeNum(ctx.get(`${FORM_ID}.joint.aotcPhaseOutMultiplier`));
    return Math.round(tentative * multiplier * 100) / 100;
  },
};

/**
 * AOTC — Refundable portion (Line 8 of form)
 *
 * 40% of allowed credit, maximum $1,000 per student.
 * → Flows DIRECTLY to Form 1040 Line 29 (not through Schedule 3).
 *
 * NOTE: The refundable portion is NOT available to students who are:
 *   - Under age 18, OR
 *   - Age 18 AND earned income < half of support, OR
 *   - Full-time student age 19–23 AND earned income < half of support AND
 *     at least one parent alive
 * This restriction is a preparer certification — we do not enforce it
 * automatically. Preparer flags via the `aotcRefundableEligible` input.
 */
const aotcRefundableEligible: NodeDefinition = {
  id:                 `${FORM_ID}.joint.aotcRefundableEligible`,
  kind:               NodeKind.INPUT,
  label:              'Form 8863 — AOTC Refundable Portion Eligible',
  description:        'Whether the AOTC refundable portion (40%, up to $1,000/student) is allowed. Not eligible for: students under 18, certain students 18-23 who are dependents with earned income less than half their support. Check IRS Form 8863 instructions for the under-24 kiddie tax rules.',
  valueType:          NodeValueType.BOOLEAN,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f8863.q.aotcRefundableEligible',
  defaultValue:       true,  // Most adult filers ARE eligible
};

const aotcRefundableCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.aotcRefundableCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8863 Line 8 — AOTC Refundable Credit',
  description:        '40% of allowed AOTC credit, up to $1,000 per student. Flows to Form 1040 Line 29. Zero if filer is ineligible for the refundable portion (under-24 dependent rules).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.refundable'],
  dependencies: [
    `${FORM_ID}.joint.aotcAllowedCredit`,
    `${FORM_ID}.joint.aotcRefundableEligible`,
    `${FORM_ID}.joint.aotcNumStudents`,
  ],
  compute: (ctx) => {
    const c            = getF8863Constants(ctx.taxYear);
    const allowed      = safeNum(ctx.get(`${FORM_ID}.joint.aotcAllowedCredit`));
    const eligible     = ctx.get(`${FORM_ID}.joint.aotcRefundableEligible`) !== false;
    const numStudents  = Math.max(1, safeNum(ctx.get(`${FORM_ID}.joint.aotcNumStudents`)));

    if (!eligible || allowed <= 0) return 0;

    const refundable = allowed * c.aotc.refundableRate;
    // Cap at $1,000 per student
    const cap = c.aotc.maxRefundable * numStudents;
    return Math.min(refundable, cap);
  },
  isApplicable: (ctx) => {
    return safeNum(ctx.get(`${FORM_ID}.joint.aotcNumStudents`)) > 0;
  },
};

/**
 * AOTC — Nonrefundable portion (Line 9 of form)
 *
 * Remaining 60% of allowed credit (allowed minus refundable portion).
 * → Feeds into combined nonrefundable total → Schedule 3 Line 3.
 */
const aotcNonRefundableCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.aotcNonRefundableCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8863 Line 9 — AOTC Nonrefundable Credit',
  description:        'AOTC allowed credit minus the refundable portion. This 60% portion reduces tax liability but cannot create a refund. Combined with LLC nonrefundable → Schedule 3 Line 3.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.aotcAllowedCredit`,
    `${FORM_ID}.joint.aotcRefundableCredit`,
  ],
  compute: (ctx) => {
    const allowed    = safeNum(ctx.get(`${FORM_ID}.joint.aotcAllowedCredit`));
    const refundable = safeNum(ctx.get(`${FORM_ID}.joint.aotcRefundableCredit`));
    return Math.max(0, allowed - refundable);
  },
  isApplicable: (ctx) => {
    return safeNum(ctx.get(`${FORM_ID}.joint.aotcNumStudents`)) > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TRACK B — LLC (LIFETIME LEARNING CREDIT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LLC — Total qualified education expenses (all LLC students, per return cap $10,000).
 * Preparer enters ADJUSTED expenses (after subtracting tax-free scholarships).
 * For LLC: includes tuition and required fees only (not books/supplies).
 */
const llcQualifiedExpenses: NodeDefinition = {
  id:                 `${FORM_ID}.joint.llcQualifiedExpenses`,
  kind:               NodeKind.INPUT,
  label:              'Form 8863 — LLC Adjusted Qualified Expenses',
  description:        'Total adjusted qualified education expenses for Lifetime Learning Credit students. Preparer must subtract tax-free scholarships and grants. Per-return cap is $10,000 (max credit $2,000). LLC covers tuition and fees; books/supplies only if required for enrollment.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  source:             InputSource.PREPARER,
  questionId:         'f8863.q.llcQualifiedExpenses',
  defaultValue:       0,
};

/**
 * LLC tentative credit (before phase-out).
 * 20% of first $10,000 of expenses = max $2,000 per return.
 */
const llcTentativeCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.llcTentativeCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8863 — LLC Tentative Credit (Before Phase-Out)',
  description:        '20% of qualified expenses, capped at $10,000 in expenses ($2,000 maximum). Per-return cap, not per-student.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.llcQualifiedExpenses`],
  compute: (ctx) => {
    const c        = getF8863Constants(ctx.taxYear);
    const expenses = safeNum(ctx.get(`${FORM_ID}.joint.llcQualifiedExpenses`));
    return computeLLCTentative(expenses, c);
  },
};

/**
 * LLC phase-out multiplier (same thresholds as AOTC).
 */
const llcPhaseOutMultiplier: NodeDefinition = {
  id:                 `${FORM_ID}.joint.llcPhaseOutMultiplier`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8863 — LLC Phase-Out Multiplier',
  description:        'Fraction of LLC allowed after MAGI phase-out. Same thresholds as AOTC: $80K–$90K single, $160K–$180K MFJ. MFS = 0.',
  valueType:          NodeValueType.PERCENTAGE,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['intermediate'],
  dependencies:       [`${FORM_ID}.joint.magi`],
  compute: (ctx) => {
    const c    = getF8863Constants(ctx.taxYear);
    const magi = safeNum(ctx.get(`${FORM_ID}.joint.magi`));
    return computePhaseOutMultiplier(
      magi,
      ctx.filingStatus,
      c.llc.phaseOutFloorSingle,
      c.llc.phaseOutCeilSingle,
      c.llc.phaseOutFloorMFJ,
      c.llc.phaseOutCeilMFJ,
    );
  },
};

/**
 * LLC — Nonrefundable credit after phase-out (Line 18 of form).
 * Fully nonrefundable. Combined with AOTC nonrefundable → Schedule 3 Line 3.
 */
const llcNonRefundableCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.llcNonRefundableCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8863 Line 18 — Lifetime Learning Credit (After Phase-Out)',
  description:        'LLC after MAGI phase-out. Fully nonrefundable — combines with AOTC nonrefundable to form Schedule 3 Line 3 total.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.llcTentativeCredit`,
    `${FORM_ID}.joint.llcPhaseOutMultiplier`,
  ],
  compute: (ctx) => {
    const tentative  = safeNum(ctx.get(`${FORM_ID}.joint.llcTentativeCredit`));
    const multiplier = safeNum(ctx.get(`${FORM_ID}.joint.llcPhaseOutMultiplier`));
    return Math.round(tentative * multiplier * 100) / 100;
  },
  isApplicable: (ctx) => {
    return safeNum(ctx.get(`${FORM_ID}.joint.llcQualifiedExpenses`)) > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED OUTPUT — SCHEDULE 3 LINE 3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Part II Line 19 (and Credit Limit Worksheet output) — Combined nonrefundable
 * education credit.
 *
 * = AOTC nonrefundable + LLC nonrefundable
 *
 * This is the total that flows to Schedule 3 Line 3.
 * The tax liability cap (Credit Limit Worksheet) is approximated as total tax —
 * consistent with how we handle this for F8812 and F2441.
 *
 * → Schedule 3 Line 3 → Form 1040 Line 20 (via Schedule 3 Line 8)
 */
const nonRefundableEducationCredit: NodeDefinition = {
  id:                 `${FORM_ID}.joint.nonRefundableEducationCredit`,
  kind:               NodeKind.COMPUTED,
  label:              'Form 8863 — Combined Nonrefundable Education Credit (→ Sched. 3 Line 3)',
  description:        'Sum of AOTC nonrefundable (Line 9) and LLC (Line 18). Cannot exceed tax liability. Flows to Schedule 3 Line 3.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.aotcNonRefundableCredit`,
    `${FORM_ID}.joint.llcNonRefundableCredit`,
    'f1040.joint.line24_totalTax',
  ],
  compute: (ctx) => {
    const aotcNR    = safeNum(ctx.get(`${FORM_ID}.joint.aotcNonRefundableCredit`));
    const llcNR     = safeNum(ctx.get(`${FORM_ID}.joint.llcNonRefundableCredit`));
    const taxLimit  = Math.max(0, safeNum(ctx.get('f1040.joint.line24_totalTax')));
    return Math.min(aotcNR + llcNR, taxLimit);
  },
  isApplicable: (ctx) => {
    const aotcStudents = safeNum(ctx.get(`${FORM_ID}.joint.aotcNumStudents`));
    const llcExpenses  = safeNum(ctx.get(`${FORM_ID}.joint.llcQualifiedExpenses`));
    return aotcStudents > 0 || llcExpenses > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registration order:
 *   engine.registerNodes([
 *     ...F1040_NODES,              // AGI and totalTax
 *     ...F8812_NODES,
 *     ...F2441_NODES,
 *     ...F8863_NODES,              // ← new
 *     ...SCHEDULE3_NODES,          // reads from F8863 (Schedule 3 Line 3)
 *     ...F1040_PAYMENT_NODES,      // reads from Schedule 3, F8863 Line 29
 *   ]);
 *
 * Note: F1040 Line 29 (AOTC refundable) must be wired in F1040_PAYMENT_NODES
 * to read from f8863.joint.aotcRefundableCredit.
 */
export const F8863_NODES: NodeDefinition[] = [
  // Inputs
  aotcNumStudents,
  aotcQualifiedExpenses,
  aotcRefundableEligible,
  llcQualifiedExpenses,
  // Shared
  magi,
  // AOTC track
  aotcTentativeCredit,
  aotcPhaseOutMultiplier,
  aotcAllowedCredit,
  aotcRefundableCredit,
  aotcNonRefundableCredit,
  // LLC track
  llcTentativeCredit,
  llcPhaseOutMultiplier,
  llcNonRefundableCredit,
  // Combined output
  nonRefundableEducationCredit,
];

export const F8863_OUTPUTS = {
  /** Nonrefundable AOTC + LLC → Schedule 3 Line 3 */
  nonRefundableEducationCredit: `${FORM_ID}.joint.nonRefundableEducationCredit`,
  /** Refundable AOTC → Form 1040 Line 29 (direct, bypasses Schedule 3) */
  aotcRefundableCredit:         `${FORM_ID}.joint.aotcRefundableCredit`,
} as const;