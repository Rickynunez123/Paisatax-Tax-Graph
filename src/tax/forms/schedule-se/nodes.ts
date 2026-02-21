/**
 * SCHEDULE SE — SELF-EMPLOYMENT TAX
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   ✅ Line 2  — Net profit from Schedule C (from aggregator)
 *   ✅ Line 3  — Combined net profit (Schedule C + Schedule F — F deferred, $0)
 *   ✅ Line 4a — Net earnings subject to SE tax (Line 3 × 92.35%)
 *   ✅ Line 5  — SE tax (15.3% below SS wage base; 2.9% above)
 *   ✅ Line 6  — Deductible half of SE tax → Schedule 1 Part II Line 15
 *   🚧 Line 4b — Additional Medicare Tax (Form 8959) — deferred
 *   🚧 Line 8b — Unreported tips (Form 4137) — deferred
 *   🚧 Section B (Long Schedule SE) — partial; SS wage base split is implemented
 *
 * HOW IT FLOWS:
 *   Schedule C Line 31 → scheduleC.joint.totalNetProfit
 *   → scheduleSE.joint.line3_netProfitFromSE
 *   → scheduleSE.joint.line4a_netEarnings (× 92.35%)
 *   → scheduleSE.joint.line5_seTax        → Schedule 2 Line 4
 *   → scheduleSE.joint.line6_deductibleHalf → Schedule 1 Part II Line 15
 *
 * SE TAX THRESHOLD:
 *   SE tax does not apply if net earnings from SE are under $400.
 *   This threshold is checked in the compute function.
 *
 * IRS References:
 *   Schedule SE Instructions (Form 1040) (2025)
 *   IRC §§1401, 1402, 164(f)
 *   IRS Pub 334 — Tax Guide for Small Business
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
} from '../../../core/graph/node.types';
import {
  getScheduleSEConstants,
  computeSETax,
} from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'scheduleSE';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE SE NODES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 2 / Line 3 — Net profit from all SE sources.
 *
 * Currently: Schedule C net profit only.
 * Future: Schedule C + Schedule F (farm income).
 *
 * Negative SE income does not create a negative SE tax — floored at 0
 * for SE tax purposes (a loss reduces income tax but not SE tax below zero).
 */
const line3_netProfitFromSE: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line3_netProfitFromSE`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule SE Line 3 — Net Profit from Self-Employment',
  description:        'Combined net profit from all self-employment sources. Currently: Schedule C net profit only. Future: adds Schedule F (farm). Negative values floored at $0 — SE losses reduce income tax but cannot produce negative SE tax.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.selfEmployment'],
  dependencies:       ['scheduleC.joint.totalNetProfit'],
  compute: (ctx) => Math.max(0, safeNum(ctx.get('scheduleC.joint.totalNetProfit'))),
};

/**
 * Line 4a — Net earnings subject to SE tax.
 * Net profit × 92.35% (= 1 − 7.65%).
 * This is the base amount on which SE tax is computed.
 */
const line4a_netEarnings: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line4a_netEarnings`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule SE Line 4a — Net Earnings from Self-Employment',
  description:        'Net profit × 92.35%. Represents the SE-taxable equivalent of employee wages (mirrors the W-2 wage base on which employees pay their 7.65% FICA share).',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['income.selfEmployment'],
  dependencies:       [`${FORM_ID}.joint.line3_netProfitFromSE`],
  compute: (ctx) => {
    const c          = getScheduleSEConstants(ctx.taxYear);
    const netProfit  = safeNum(ctx.get(`${FORM_ID}.joint.line3_netProfitFromSE`));
    if (netProfit < c.minimumNetEarnings) return 0;
    return Math.round(netProfit * c.netEarningsMultiplier * 100) / 100;
  },
};

/**
 * Line 5 — Self-Employment Tax
 *
 * Implements both Section A (Short SE) and Section B (Long SE):
 *   Below SS wage base ($176,100): 15.3% (12.4% SS + 2.9% Medicare)
 *   Above SS wage base:             2.9%  (Medicare only)
 *
 * → Flows to Schedule 2 Line 4 (added to total tax)
 */
const line5_seTax: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line5_seTax`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule SE Line 5 — Self-Employment Tax',
  description:        'SE tax on net earnings. 15.3% on the first $176,100 (2025 SS wage base); 2.9% Medicare-only above that. No SE tax if net earnings < $400. Flows to Schedule 2 Line 4.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['tax.selfEmployment'],
  dependencies:       [`${FORM_ID}.joint.line3_netProfitFromSE`],
  compute: (ctx) => {
    const c         = getScheduleSEConstants(ctx.taxYear);
    const netProfit = safeNum(ctx.get(`${FORM_ID}.joint.line3_netProfitFromSE`));
    const { seTax } = computeSETax(netProfit, c);
    return seTax;
  },
};

/**
 * Line 6 — Deductible portion of SE tax (50%)
 *
 * IRC §164(f): Half of SE tax is deductible above-the-line, mimicking
 * the employer's deduction for FICA taxes paid on employee wages.
 *
 * → Flows to Schedule 1 Part II Line 15
 */
const line6_deductibleHalf: NodeDefinition = {
  id:                 `${FORM_ID}.joint.line6_deductibleHalf`,
  kind:               NodeKind.COMPUTED,
  label:              'Schedule SE Line 6 — Deductible Part of Self-Employment Tax',
  description:        '50% of SE tax (Line 5). Deductible above-the-line per IRC §164(f). Flows to Schedule 1 Part II Line 15, reducing AGI.',
  valueType:          NodeValueType.CURRENCY,
  allowNegative:      false,
  owner:              NodeOwner.JOINT,
  repeatable:         false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications:    ['deduction.above_the_line'],
  dependencies:       [`${FORM_ID}.joint.line5_seTax`],
  compute: (ctx) => {
    const c         = getScheduleSEConstants(ctx.taxYear);
    const seTax     = safeNum(ctx.get(`${FORM_ID}.joint.line5_seTax`));
    const deductible = seTax * c.deductibleFraction;
    return Math.round(deductible * 100) / 100;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEDULE_SE_NODES: NodeDefinition[] = [
  line3_netProfitFromSE,
  line4a_netEarnings,
  line5_seTax,
  line6_deductibleHalf,
];

export const SCHEDULE_SE_OUTPUTS = {
  netProfitFromSE: `${FORM_ID}.joint.line3_netProfitFromSE`,
  netEarnings:     `${FORM_ID}.joint.line4a_netEarnings`,
  seTax:           `${FORM_ID}.joint.line5_seTax`,
  deductibleHalf:  `${FORM_ID}.joint.line6_deductibleHalf`,
} as const;