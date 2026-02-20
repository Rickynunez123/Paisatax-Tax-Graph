/**
 * SCHEDULE B — INTEREST AND ORDINARY DIVIDENDS
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   Part I — Interest
 *   ✅ Line 1  — List of payers (captured at slot level in 1099-INT)
 *   ✅ Line 2  — Total taxable interest (sum of all 1099-INT Box 1, primary + spouse)
 *   ✅ Line 4  — Taxable interest after exclusions → Form 1040 Line 2b
 *   🚧 Line 3  — Excludable U.S. savings bond interest (Form 8815 — deferred)
 *
 *   Part II — Dividends
 *   ✅ Line 5  — List of payers (captured at slot level in 1099-DIV)
 *   ✅ Line 6  — Total ordinary dividends (sum of all 1099-DIV Box 1a, primary + spouse)
 *               → Form 1040 Line 3b
 *
 *   Part III — Foreign Accounts and Trusts
 *   🚧 Checkbox questions only — no dollar amounts feed into 1040 calculations.
 *      Deferred.
 *
 * JOINT AGGREGATION PATTERN:
 *   Interest and dividends belong to whoever owns the account (primary or spouse).
 *   Schedule B is a JOINT form that combines both owners' income.
 *   The joint nodes here sum primary + spouse 1099 aggregators.
 *
 * HOW THIS CONNECTS TO FORM 1040:
 *   Schedule B Line 4  → Form 1040 Line 2b (taxable interest)
 *   Schedule B Line 6  → Form 1040 Line 3b (ordinary dividends)
 *   1099-DIV Box 1b total → Form 1040 Line 3a (qualified dividends — subset of 3b)
 *   1099-INT Box 8 total  → Form 1040 Line 2a (tax-exempt interest — informational only)
 *
 * NOTE ON QUALIFIED DIVIDENDS (Line 3a):
 *   Qualified dividends are taxed at 0/15/20% preferential rates.
 *   The tax computation uses the Qualified Dividends and Capital Gains Tax
 *   Worksheet, which is shared with Schedule D. The AMOUNT flows through here
 *   (Line 3a on 1040), but the RATE BENEFIT is deferred until Schedule D.
 *   For now: Line 16 (tax) may slightly overstate liability for filers with
 *   qualified dividends because it uses ordinary brackets on all taxable income.
 *
 * IRS References:
 *   Schedule B Instructions (2025)
 *   Form 1040 Instructions (2025), Lines 2a, 2b, 3a, 3b
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
} from '../../../core/graph/node.types';

import { F1099INT_OUTPUTS } from '../f1099int/nodes';
import { F1099DIV_OUTPUTS } from '../f1099div/nodes';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'scheduleB';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART I — INTEREST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 2 — Total interest income (primary + spouse combined).
 * Reads from 1099-INT aggregators for both owners.
 */
const line2_totalInterest: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line2_totalInterest`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule B Line 2 — Total Taxable Interest',
  description:        'Sum of all taxable interest (Box 1) from 1099-INT forms for both filers. Flows to Line 4.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies: [
    F1099INT_OUTPUTS.primaryInterest,
    F1099INT_OUTPUTS.spouseInterest,
  ],
  compute: (ctx) => (
    safeNum(ctx.get(F1099INT_OUTPUTS.primaryInterest)) +
    safeNum(ctx.get(F1099INT_OUTPUTS.spouseInterest))
  ),
};

/**
 * Line 4 — Taxable interest after bond interest exclusion.
 * Line 3 (savings bond exclusion via Form 8815) is deferred, so Line 4 = Line 2.
 * When Form 8815 is built, wire its output here as a subtraction.
 * Flows to Form 1040 Line 2b.
 */
const line4_taxableInterest: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line4_taxableInterest`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule B Line 4 — Taxable Interest (→ Form 1040 Line 2b)',
  description:        'Taxable interest after savings bond exclusion (Line 3, deferred). Currently equals Line 2. Flows to Form 1040 Line 2b.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies: [
    `${FORM_ID}.joint.line2_totalInterest`,
    // Add when Form 8815 built:
    // `${FORM_ID}.joint.line3_savingsBondExclusion`,
  ],
  compute: (ctx) => safeNum(ctx.get(`${FORM_ID}.joint.line2_totalInterest`)),
  // NOTE: Line 3 (savings bond exclusion) deferred — will subtract when built
};

/**
 * Tax-exempt interest combined (primary + spouse).
 * Not a Schedule B line — it flows directly to Form 1040 Line 2a (informational).
 * Reported so the IRS knows about it, but not included in taxable income.
 */
const jointTaxExemptInterest: NodeDefinition = {
  id:                 `${FORM_ID}.joint.taxExemptInterest`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule B — Total Tax-Exempt Interest (→ Form 1040 Line 2a)',
  description:        'Sum of Box 8 (tax-exempt interest) from all 1099-INT forms for both filers. Informational only — not included in taxable income.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies: [
    F1099INT_OUTPUTS.primaryTaxExempt,
    F1099INT_OUTPUTS.spouseTaxExempt,
  ],
  compute: (ctx) => (
    safeNum(ctx.get(F1099INT_OUTPUTS.primaryTaxExempt)) +
    safeNum(ctx.get(F1099INT_OUTPUTS.spouseTaxExempt))
  ),
};

/**
 * 1099 withholding combined (interest + dividends, primary + spouse).
 * Flows to Form 1040 Line 25b.
 */
const joint1099Withholding: NodeDefinition = {
  id:                 `${FORM_ID}.joint.total1099Withholding`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule B — Total 1099 Federal Withholding (→ Form 1040 Line 25b)',
  description:        'Sum of all federal income tax withheld on interest (1099-INT Box 4) and dividends (1099-DIV Box 4) for both filers. Flows to Form 1040 Line 25b.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['withholding'],
  dependencies: [
    F1099INT_OUTPUTS.primaryWithholding,
    F1099INT_OUTPUTS.spouseWithholding,
    F1099DIV_OUTPUTS.primaryWithholding,
    F1099DIV_OUTPUTS.spouseWithholding,
  ],
  compute: (ctx) => (
    safeNum(ctx.get(F1099INT_OUTPUTS.primaryWithholding))  +
    safeNum(ctx.get(F1099INT_OUTPUTS.spouseWithholding))   +
    safeNum(ctx.get(F1099DIV_OUTPUTS.primaryWithholding))  +
    safeNum(ctx.get(F1099DIV_OUTPUTS.spouseWithholding))
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// PART II — DIVIDENDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 6 — Total ordinary dividends (primary + spouse combined).
 * Flows to Form 1040 Line 3b.
 */
const line6_totalOrdinaryDividends: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line6_totalOrdinaryDividends`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule B Line 6 — Total Ordinary Dividends (→ Form 1040 Line 3b)',
  description:        'Sum of Box 1a (ordinary dividends) from all 1099-DIV forms for both filers. Flows to Form 1040 Line 3b.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies: [
    F1099DIV_OUTPUTS.primaryOrdinaryDividends,
    F1099DIV_OUTPUTS.spouseOrdinaryDividends,
  ],
  compute: (ctx) => (
    safeNum(ctx.get(F1099DIV_OUTPUTS.primaryOrdinaryDividends)) +
    safeNum(ctx.get(F1099DIV_OUTPUTS.spouseOrdinaryDividends))
  ),
};

/**
 * Qualified dividends combined (primary + spouse).
 * A subset of ordinary dividends. Flows to Form 1040 Line 3a.
 * These are taxed at preferential rates — the rate benefit is computed via
 * the QDCGT Worksheet (deferred until Schedule D).
 */
const jointQualifiedDividends: NodeDefinition = {
  id:                 `${FORM_ID}.joint.totalQualifiedDividends`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule B — Total Qualified Dividends (→ Form 1040 Line 3a)',
  description:        'Sum of Box 1b (qualified dividends) from all 1099-DIV forms for both filers. Subset of ordinary dividends — already included in Line 6. Flows to Form 1040 Line 3a.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies: [
    F1099DIV_OUTPUTS.primaryQualifiedDividends,
    F1099DIV_OUTPUTS.spouseQualifiedDividends,
  ],
  compute: (ctx) => (
    safeNum(ctx.get(F1099DIV_OUTPUTS.primaryQualifiedDividends)) +
    safeNum(ctx.get(F1099DIV_OUTPUTS.spouseQualifiedDividends))
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEDULE_B_NODES: NodeDefinition[] = [
  // Part I — Interest
  line2_totalInterest,
  line4_taxableInterest,
  jointTaxExemptInterest,
  joint1099Withholding,
  // Part II — Dividends
  line6_totalOrdinaryDividends,
  jointQualifiedDividends,
];

export const SCHEDULE_B_OUTPUTS = {
  /** Part I Line 4 → Form 1040 Line 2b */
  taxableInterest:      `${FORM_ID}.joint.line4_taxableInterest`,
  /** Informational → Form 1040 Line 2a */
  taxExemptInterest:    `${FORM_ID}.joint.taxExemptInterest`,
  /** 1099 backup withholding → Form 1040 Line 25b */
  withholding1099:      `${FORM_ID}.joint.total1099Withholding`,
  /** Part II Line 6 → Form 1040 Line 3b */
  ordinaryDividends:    `${FORM_ID}.joint.line6_totalOrdinaryDividends`,
  /** Subset of Line 6 → Form 1040 Line 3a */
  qualifiedDividends:   `${FORM_ID}.joint.totalQualifiedDividends`,
} as const;