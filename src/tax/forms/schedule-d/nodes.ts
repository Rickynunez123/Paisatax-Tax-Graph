/**
 * SCHEDULE D — CAPITAL GAINS AND LOSSES
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *
 *   Part I — Short-Term Capital Gains and Losses
 *   ✅ Line 1b — Net short-term from Form 8949 (primary + spouse)
 *   🚧 Line 1a — Short-term transactions not reported on 8949 (deferred)
 *   🚧 Line 2  — Short-term from K-1s / partnerships (deferred)
 *   ✅ Line 6  — Short-term carryover from prior year (deferred input)
 *   ✅ Line 7  — Net short-term capital gain or (loss) — Part I total
 *
 *   Part II — Long-Term Capital Gains and Losses
 *   ✅ Line 8b — Net long-term from Form 8949 (primary + spouse)
 *   🚧 Line 8a — Long-term transactions not reported on 8949 (deferred)
 *   🚧 Line 9  — Long-term from K-1s / partnerships (deferred)
 *   🚧 Line 10 — Long-term capital gain distributions (1099-DIV Box 2a — deferred)
 *   ✅ Line 11 — Long-term carryover from prior year (deferred input)
 *   ✅ Line 15 — Net long-term capital gain or (loss) — Part II total
 *
 *   Part III — Summary
 *   ✅ Line 16 — Combined net gain or (loss) = Line 7 + Line 15
 *   ✅ Line 21 — Loss deductible this year (capped at $3,000 / $1,500 MFS)
 *   ✅ toF1040Line7 — gain or capped loss flowing to Form 1040 Line 7
 *   ✅ carryoverExcess — excess loss for next year (informational)
 *
 * CAPITAL LOSS CARRYFORWARD:
 *   Short-term and long-term carryforwards from prior year are separate
 *   deferred INPUT nodes. Enter as positive numbers.
 *
 * QDCGT WORKSHEET:
 *   Triggered when Line 15 (net LTCG) > 0 OR qualified dividends (Line 3a) > 0.
 *   The worksheet logic lives in schedule-d/constants/index.ts.
 *   Form 1040 Line 16 reads SCHEDULE_D_OUTPUTS.netLongTerm to decide
 *   whether to use ordinary brackets or the QDCGT computation path.
 *
 * HOW PART III FLOWS TO FORM 1040:
 *   Gain (Line 16 > 0): full gain → Form 1040 Line 7 (positive)
 *   Loss (Line 16 < 0): capped loss → Form 1040 Line 7 (negative, max -$3,000)
 *   Zero (Line 16 = 0): $0 → Form 1040 Line 7
 *
 * IRS References:
 *   Schedule D Instructions (2025)
 *   Schedule D Tax Worksheet (inside Schedule D Instructions, page D-12)
 *   IRC §1211 (capital loss limitation), §1212 (carryover)
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import { F8949_OUTPUTS }         from '../f8949/nodes';
import { getScheduleDConstants } from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'scheduleD';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART I — SHORT-TERM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 6 — Short-term capital loss carryover from prior year.
 * Enter as a positive number — the engine subtracts it as a loss.
 * Short-term carryovers retain their character and are taxed at ordinary rates.
 */
const line6_shortTermCarryover: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line6_shortTermCarryover`,
  kind:               NodeKind.INPUT,
  label:              'Schedule D Line 6 — Short-Term Capital Loss Carryover from Prior Year',
  description:        'Short-term capital loss carryover from prior year Schedule D Line 7 (if a loss). Enter as a positive number — treated as a loss. Deferred — enter from prior year return.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  source:             InputSource.PREPARER,
  questionId:         'scheduleD.q.shortTermCarryover',
  defaultValue:       0,
};

/**
 * Line 7 — Net short-term capital gain or (loss).
 * 8949 short-term (primary + spouse) minus prior year carryover.
 * Taxed at ordinary income rates.
 */
const line7_netShortTerm: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line7_netShortTerm`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule D Line 7 — Net Short-Term Capital Gain or (Loss)',
  description:        'Net short-term capital gain or loss from Form 8949 lots plus prior year carryover. Taxed at ordinary income rates.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      true,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies: [
    F8949_OUTPUTS.primaryShortTerm,
    F8949_OUTPUTS.spouseShortTerm,
    `${FORM_ID}.joint.line6_shortTermCarryover`,
  ],
  compute: (ctx) => {
    const primaryST = safeNum(ctx.get(F8949_OUTPUTS.primaryShortTerm));
    const spouseST  = safeNum(ctx.get(F8949_OUTPUTS.spouseShortTerm));
    const carryover = safeNum(ctx.get(`${FORM_ID}.joint.line6_shortTermCarryover`));
    return primaryST + spouseST - carryover;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PART II — LONG-TERM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 11 — Long-term capital loss carryover from prior year.
 * Enter as a positive number. Long-term carryovers retain preferential rate eligibility.
 */
const line11_longTermCarryover: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line11_longTermCarryover`,
  kind:               NodeKind.INPUT,
  label:              'Schedule D Line 11 — Long-Term Capital Loss Carryover from Prior Year',
  description:        'Long-term capital loss carryover from prior year Schedule D Line 15 (if a loss). Enter as a positive number. Deferred — enter from prior year return.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  source:             InputSource.PREPARER,
  questionId:         'scheduleD.q.longTermCarryover',
  defaultValue:       0,
};

/**
 * Line 15 — Net long-term capital gain or (loss).
 * When positive, eligible for preferential 0/15/20% rates via QDCGT Worksheet.
 * This is the key input Form 1040 Line 16 reads to trigger the worksheet.
 */
const line15_netLongTerm: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line15_netLongTerm`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule D Line 15 — Net Long-Term Capital Gain or (Loss)',
  description:        'Net long-term capital gain or loss from Form 8949 lots plus prior year carryover. When positive, eligible for preferential LTCG rates (0/15/20%) via QDCGT Worksheet.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      true,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies: [
    F8949_OUTPUTS.primaryLongTerm,
    F8949_OUTPUTS.spouseLongTerm,
    `${FORM_ID}.joint.line11_longTermCarryover`,
  ],
  compute: (ctx) => {
    const primaryLT = safeNum(ctx.get(F8949_OUTPUTS.primaryLongTerm));
    const spouseLT  = safeNum(ctx.get(F8949_OUTPUTS.spouseLongTerm));
    const carryover = safeNum(ctx.get(`${FORM_ID}.joint.line11_longTermCarryover`));
    return primaryLT + spouseLT - carryover;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PART III — SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 16 — Combined net capital gain or (loss).
 * Short-term (Line 7) + long-term (Line 15).
 */
const line16_combinedNet: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line16_combinedNet`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule D Line 16 — Combined Net Capital Gain or (Loss)',
  description:        'Net short-term (Line 7) + net long-term (Line 15). Positive = net gain. Negative = net loss (subject to $3,000 annual deduction limit).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      true,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies: [
    `${FORM_ID}.joint.line7_netShortTerm`,
    `${FORM_ID}.joint.line15_netLongTerm`,
  ],
  compute: (ctx) => (
    safeNum(ctx.get(`${FORM_ID}.joint.line7_netShortTerm`)) +
    safeNum(ctx.get(`${FORM_ID}.joint.line15_netLongTerm`))
  ),
};

/**
 * Line 21 — Deductible capital loss this year (negative, capped at -$3,000).
 *
 * When Line 16 is a loss, the deductible portion is limited to:
 *   -$3,000 for most filers
 *   -$1,500 for MFS
 *
 * Stored as a NEGATIVE number so Form 1040 Line 7 can simply add it
 * to reduce total income.
 *
 * Excess loss carries forward (see carryoverExcess).
 */
const line21_deductibleLoss: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line21_deductibleLoss`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule D Line 21 — Deductible Capital Loss (max -$3,000)',
  description:        'When Schedule D has a net loss, this is the deductible portion capped at -$3,000 (or -$1,500 for MFS). Stored as negative. Excess loss carries forward.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      true,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies:       [`${FORM_ID}.joint.line16_combinedNet`],
  compute: (ctx) => {
    const net = safeNum(ctx.get(`${FORM_ID}.joint.line16_combinedNet`));
    if (net >= 0) return 0;

    const c = getScheduleDConstants(ctx.taxYear);
    const limit = ctx.filingStatus === 'married_filing_separately'
      ? c.capitalLossLimit / 2   // $1,500 MFS
      : c.capitalLossLimit;      // $3,000 all others

    // Math.max because both values are negative — we want the less-negative one
    return Math.max(net, -limit);
  },
};

/**
 * carryoverExcess — capital loss that exceeds the annual $3,000 cap.
 * Informational — becomes next year's Line 6 or Line 11 input.
 * Stored as a POSITIVE number.
 */
const carryoverExcess: NodeDefinition = {
  id:                 `${FORM_ID}.joint.carryoverExcess`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule D — Capital Loss Carryover to Next Year',
  description:        'Portion of net capital loss exceeding the $3,000 annual deduction limit. Positive number. Carries forward to next year as Line 6 (short-term) and/or Line 11 (long-term).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies: [
    `${FORM_ID}.joint.line16_combinedNet`,
    `${FORM_ID}.joint.line21_deductibleLoss`,
  ],
  compute: (ctx) => {
    const net        = safeNum(ctx.get(`${FORM_ID}.joint.line16_combinedNet`));
    const deductible = safeNum(ctx.get(`${FORM_ID}.joint.line21_deductibleLoss`));
    if (net >= 0) return 0;
    return Math.abs(net) - Math.abs(deductible);
  },
};

/**
 * toF1040Line7 — the value that flows to Form 1040 Line 7.
 *
 *   Net gain  (Line 16 > 0): full gain (positive)
 *   Net loss  (Line 16 < 0): deductible loss (negative, capped)
 *   Zero      (Line 16 = 0): 0
 */
const toF1040Line7: NodeDefinition = {
  id:                 `${FORM_ID}.joint.toF1040Line7`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule D — Amount to Form 1040 Line 7',
  description:        'Net capital gain (positive) or deductible loss (negative, capped at -$3,000). Flows directly to Form 1040 Line 7.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      true,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.portfolio'],
  dependencies: [
    `${FORM_ID}.joint.line16_combinedNet`,
    `${FORM_ID}.joint.line21_deductibleLoss`,
  ],
  compute: (ctx) => {
    const net = safeNum(ctx.get(`${FORM_ID}.joint.line16_combinedNet`));
    if (net > 0) return net;
    if (net < 0) return safeNum(ctx.get(`${FORM_ID}.joint.line21_deductibleLoss`));
    return 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEDULE_D_NODES: NodeDefinition[] = [
  // Part I
  line6_shortTermCarryover,
  line7_netShortTerm,
  // Part II
  line11_longTermCarryover,
  line15_netLongTerm,
  // Part III
  line16_combinedNet,
  line21_deductibleLoss,
  carryoverExcess,
  toF1040Line7,
];

export const SCHEDULE_D_OUTPUTS = {
  /** Part I net — taxed at ordinary rates */
  netShortTerm:    `${FORM_ID}.joint.line7_netShortTerm`,
  /** Part II net — eligible for preferential LTCG rates */
  netLongTerm:     `${FORM_ID}.joint.line15_netLongTerm`,
  /** Combined net before $3k cap */
  combinedNet:     `${FORM_ID}.joint.line16_combinedNet`,
  /** Deductible loss (negative, capped at -$3,000 / -$1,500 MFS) */
  deductibleLoss:  `${FORM_ID}.joint.line21_deductibleLoss`,
  /** Excess loss carrying forward (positive) */
  carryoverExcess: `${FORM_ID}.joint.carryoverExcess`,
  /** What flows to Form 1040 Line 7 */
  toF1040Line7:    `${FORM_ID}.joint.toF1040Line7`,
} as const;