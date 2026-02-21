/**
 * tests/tax/ScheduleSE.test.ts
 *
 * Schedule SE — INTEGRATION TESTS
 *
 * Covers:
 *   1. computeSETax unit tests (pure function)
 *   2. Schedule SE computation + flows:
 *        - Schedule SE → Schedule 2 Line 4
 *        - Schedule SE deductible half → Schedule 1 Line 15 → Schedule 1 Line 26
 *   3. Full pipeline: Schedule C → SE → Form 1040 (AGI, taxable income, total tax)
 *   4. Edge cases: sub-$400 threshold, SE wage base straddling, net losses
 *   5. 1099-NEC withholding → Form 1040 Line 25b
 */

import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { InputEventSource }   from '../../src/core/graph/engine.types';
import type { InputEvent }    from '../../src/core/graph/engine.types';

import {
  computeSETax,
  getScheduleSEConstants,
} from '../../src/tax/forms/schedule-se/constants/index';

import {
  generateScheduleCSlotNodes,
  generateScheduleCAggregators,
} from '../../src/tax/forms/schedule-c/nodes';

import { SCHEDULE_SE_NODES }   from '../../src/tax/forms/schedule-se/nodes';
import { SCHEDULE1_NODES }     from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }     from '../../src/tax/forms/schedule2/nodes';
import { F1040_NODES }         from '../../src/tax/forms/f1040/nodes';
import { F1040_PAYMENT_NODES } from '../../src/tax/forms/f1040/payments';

import {
  generateF1099NECSlotNodes,
  generateF1099NECAggregators,
} from '../../src/tax/forms/f1099nec/nodes';

import { NodeOwner } from '../../src/core/graph/node.types';

// ─────────────────────────────────────────────────────────────────────────────
// TEST HELPERS (same pattern as Form 8889 / Schedule C)
// ─────────────────────────────────────────────────────────────────────────────

function getVal(state: ReturnType<typeof applyEvents>, nodeId: string) {
  const snap = state[nodeId];
  if (!snap) throw new Error(`Node not found in state: ${nodeId}`);
  return snap.value;
}

function makeEngine(nodes: any[]) {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes(nodes);
  return engine;
}

function makeEvent(instanceId: string, value: string | number | boolean): InputEvent {
  return {
    instanceId,
    value,
    source:    InputEventSource.PREPARER,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Apply multiple input events in sequence, starting from a fresh session.
 * Returns the final currentState after all events are processed.
 */
function applyEvents(
  nodes: any[],
  events: { instanceId: string; value: string | number | boolean }[],
  taxYear: string = '2025',
  filingStatus: string = 'single',
  hasSpouse: boolean = false
) {
  const engine  = makeEngine(nodes);
  const context = { taxYear, filingStatus, hasSpouse };
  let result    = engine.initializeSession({ ...context, sessionKey: `test#${taxYear}` });

  for (const e of events) {
    result = engine.process(makeEvent(e.instanceId, e.value), result.currentState, context);
  }

  return result.currentState;
}

/**
 * Read a node value from the state, asserting it is a number.
 */
function getNum(state: ReturnType<typeof applyEvents>, nodeId: string): number {
  const snap = state[nodeId];
  if (!snap) throw new Error(`Node not found in state: ${nodeId}`);
  if (typeof snap.value !== 'number') throw new Error(`Expected number for ${nodeId}, got ${snap.value}`);
  return snap.value;
}

// Shorthand node IDs
const N = {
  // Schedule C (profit source)
  c_line1:        'scheduleC.primary.s1.line1_grossReceipts',
  c_line8:        'scheduleC.primary.s1.line8_advertising',
  c_joint_total:  'scheduleC.joint.totalNetProfit',

  // Schedule SE
  se_line3:       'scheduleSE.joint.line3_netProfitFromSE',
  se_line4a:      'scheduleSE.joint.line4a_netEarnings',
  se_line5:       'scheduleSE.joint.line5_seTax',
  se_line6:       'scheduleSE.joint.line6_deductibleHalf',

  // Schedule 2 flows
  s2_line4:       'schedule2.joint.line4_selfEmploymentTax',
  s2_line44:      'schedule2.joint.line44_totalAdditionalTaxes',

  // Schedule 1 flows
  s1_line15:      'schedule1.joint.line15_deductibleSETax',
  s1_line26:      'schedule1.joint.line26_totalAdjustments',

  // 1040 pipeline
  age:            'f1040.joint.line12input_primaryAge',
  agi:            'f1040.joint.line11_adjustedGrossIncome',
  stdDed:         'f1040.joint.line12_deduction',
  taxableInc:     'f1040.joint.line15_taxableIncome',
  incomeTax:      'f1040.joint.line16_tax',
  totalTax:       'f1040.joint.line24_totalTax',
  refund:         'f1040.joint.line34_refund',
  owed:           'f1040.joint.line37_amountOwed',

  // 1099-NEC withholding
  nec_w_s1:       'f1099nec.primary.s1.box4_federalWithholding',
  line25b:        'f1040.joint.line25b_1099Withholding',
  line26:         'f1040.joint.line26_totalWithholding',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — PURE UNIT TESTS (computeSETax)
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule SE — computeSETax (pure math)', () => {

  test('Scenario: net profit below $400 threshold → SE tax = 0', () => {
    const c = getScheduleSEConstants('2025');
    const result = computeSETax(399, c);

    expect(result.netEarnings).toBe(0);
    expect(result.seTax).toBe(0);
    expect(result.deductibleHalf).toBe(0);
  });

  test('Scenario: net profit exactly $0 → SE tax = 0', () => {
    const c = getScheduleSEConstants('2025');
    const result = computeSETax(0, c);

    expect(result.seTax).toBe(0);
  });

  test('Scenario: net profit exactly $400 (boundary)', () => {
    const c = getScheduleSEConstants('2025');
    const result = computeSETax(400, c);

    // netEarnings = 400 × 0.9235 = 369.40
    // seTax = 369.40 × 0.153 = 56.52
    const expectedNetEarnings = Math.round(400 * 0.9235 * 100) / 100;
    const expectedSETax       = Math.round(expectedNetEarnings * 0.153 * 100) / 100;

    expect(result.netEarnings).toBeCloseTo(expectedNetEarnings, 2);
    expect(result.seTax).toBeCloseTo(expectedSETax, 2);
    expect(result.deductibleHalf).toBeCloseTo(expectedSETax / 2, 2);
  });

  test('Scenario: below SS wage base → full 15.3% rate', () => {
    const c = getScheduleSEConstants('2025');
    const netProfit = 50_000;
    const result = computeSETax(netProfit, c);

    const expectedNetEarnings = Math.round(netProfit * 0.9235 * 100) / 100;
    const expectedSETax       = Math.round(expectedNetEarnings * 0.153 * 100) / 100;

    expect(result.netEarnings).toBeCloseTo(expectedNetEarnings, 2);
    expect(result.seTax).toBeCloseTo(expectedSETax, 2);
    expect(result.deductibleHalf).toBeCloseTo(expectedSETax / 2, 2);
  });

  test('Scenario: above SS wage base → SS capped + Medicare continues', () => {
    const c = getScheduleSEConstants('2025');
    const netProfit = 250_000;
    const result = computeSETax(netProfit, c);

    const netEarnings     = netProfit * 0.9235;
    const ssPortion       = 176_100 * 0.124;
    const medicarePortion = netEarnings * 0.029;
    const expectedSETax   = Math.round((ssPortion + medicarePortion) * 100) / 100;

    expect(result.seTax).toBeCloseTo(expectedSETax, 2);
    expect(result.deductibleHalf).toBeCloseTo(expectedSETax / 2, 2);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — ENGINE: Schedule SE computation + flows
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule SE — Engine Computation and Flows', () => {

test('Scenario: profit below threshold → Schedule SE Line 5/6 are zero (Line 3 still shows net profit)', () => {
  const nodes = [
    ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
    ...generateScheduleCAggregators([1], []),
    ...SCHEDULE_SE_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
  ];

  const state = applyEvents(nodes, [
    { instanceId: N.c_line1, value: 300 },
  ]);

  // Line 3 shows net profit
  expect(getNum(state, N.se_line3)).toBe(300);

  // Tax outputs suppressed by $400 rule
  expect(getNum(state, N.se_line5)).toBe(0);
  expect(getNum(state, N.se_line6)).toBe(0);

  // IMPORTANT: downstream flows are not computed → value stays null in this engine
  expect(getVal(state, N.s2_line4)).toBe(null);
  expect(getVal(state, N.s1_line15)).toBe(null);
});

  test('Scenario: Schedule C loss → SE tax floors at zero (no negative SE)', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
      ...SCHEDULE_SE_NODES,
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line1, value: 0 },
      { instanceId: N.c_line8, value: 5_000 }, // creates loss
    ]);

    expect(getNum(state, N.c_joint_total)).toBe(-5_000);
    expect(getNum(state, N.se_line3)).toBe(0);
    expect(getNum(state, N.se_line5)).toBe(0);
  });

  test('Scenario: SE tax flows to Schedule 2 Line 4 and Line 44', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
      ...SCHEDULE_SE_NODES,
      ...SCHEDULE2_NODES,
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line1, value: 50_000 },
    ]);

    const c = getScheduleSEConstants('2025');
    const { seTax } = computeSETax(50_000, c);

    expect(getNum(state, N.s2_line4)).toBeCloseTo(seTax, 1);
    expect(getNum(state, N.s2_line44)).toBeCloseTo(seTax, 1);
  });

  test('Scenario: deductible half flows to Schedule 1 Line 15 and totals into Line 26', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
      ...SCHEDULE_SE_NODES,
      ...SCHEDULE1_NODES,
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line1, value: 50_000 },
    ]);

    const c = getScheduleSEConstants('2025');
    const { deductibleHalf } = computeSETax(50_000, c);

    expect(getNum(state, N.s1_line15)).toBeCloseTo(deductibleHalf, 1);
    expect(getNum(state, N.s1_line26)).toBeCloseTo(deductibleHalf, 1);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — FULL PIPELINE: Schedule C → SE → Form 1040
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule C → SE → Form 1040 (Full Pipeline)', () => {

  test('Scenario: $80,000 Schedule C profit (single) → AGI, taxable income, total tax are consistent', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),

      ...SCHEDULE_SE_NODES,
      ...SCHEDULE1_NODES,
      ...SCHEDULE2_NODES,

      ...F1040_NODES,
      ...F1040_PAYMENT_NODES,
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line1, value: 80_000 },
      { instanceId: N.age,     value: 40 },
    ]);

    // SE tax: 80,000 × 0.9235 × 0.153 = 11,303.64
    const expectedSETax = Math.round(80_000 * 0.9235 * 0.153 * 100) / 100;
    const expectedAGI   = 80_000 - expectedSETax / 2;

    expect(getNum(state, N.se_line5)).toBeCloseTo(expectedSETax, 0);
    expect(getNum(state, N.agi)).toBeCloseTo(expectedAGI, 0);

    // Taxable income = AGI − standard deduction
    const taxable = getNum(state, N.taxableInc);
    const agi     = getNum(state, N.agi);
    const stdDed  = getNum(state, N.stdDed);

    expect(taxable).toBeCloseTo(agi - stdDed, 0);

    // Total tax includes income tax + SE tax (as additional tax)
    const incomeTax = getNum(state, N.incomeTax);
    const seTax     = getNum(state, N.s2_line4);
    const totalTax  = getNum(state, N.totalTax);

    expect(incomeTax).toBeGreaterThan(0);
    expect(seTax).toBeGreaterThan(0);
    expect(totalTax).toBeCloseTo(incomeTax + seTax, 0);

    // No withholding → owe everything, refund = 0
    expect(getNum(state, N.refund)).toBe(0);
    expect(getNum(state, N.owed)).toBeCloseTo(totalTax, 0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule SE — Edge Cases', () => {

  test('Scenario: net profit straddles SS wage base → SE tax is less than full 15.3% of all net earnings', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
      ...SCHEDULE_SE_NODES,
    ];

    const netProfit = 200_000;

    const state = applyEvents(nodes, [
      { instanceId: N.c_line1, value: netProfit },
    ]);

    const c = getScheduleSEConstants('2025');
    const { seTax } = computeSETax(netProfit, c);

    const engineSETax = getNum(state, N.se_line5);
    expect(engineSETax).toBeCloseTo(seTax, 1);

    const netEarnings = netProfit * 0.9235;
    const fullRate    = netEarnings * 0.153;

    expect(engineSETax).toBeLessThan(fullRate);
  });

  test('Scenario: MFJ — primary + spouse Schedule C profits combine into one JOINT Schedule SE', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCSlotNodes(NodeOwner.SPOUSE,  1),
      ...generateScheduleCAggregators([1], [1]),

      ...SCHEDULE_SE_NODES,
      ...SCHEDULE1_NODES,
      ...SCHEDULE2_NODES,
    ];

    const state = applyEvents(
      nodes,
      [
        { instanceId: 'scheduleC.primary.s1.line1_grossReceipts', value: 60_000 },
        { instanceId: 'scheduleC.spouse.s1.line1_grossReceipts',  value: 40_000 },
      ],
      '2025',
      'married_filing_jointly',
      true
    );

    const c = getScheduleSEConstants('2025');
    const { seTax } = computeSETax(100_000, c);

    expect(getNum(state, N.se_line5)).toBeCloseTo(seTax, 1);
    expect(getNum(state, N.s1_line15)).toBeCloseTo(seTax / 2, 1);
    expect(getNum(state, N.s2_line4)).toBeCloseTo(seTax, 1);
  });

  test('Scenario: net SE loss produces $0 SE tax (not negative)', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
      ...SCHEDULE_SE_NODES,
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line1, value: 5_000 },
      { instanceId: N.c_line8, value: 15_000 }, // net loss −10,000
    ]);

    expect(getNum(state, N.c_joint_total)).toBe(-10_000);
    expect(getNum(state, N.se_line3)).toBe(0);
    expect(getNum(state, N.se_line5)).toBe(0);
    expect(getNum(state, N.se_line6)).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — 1099-NEC WITHHOLDING → Form 1040 Line 25b
// ─────────────────────────────────────────────────────────────────────────────

describe('1099-NEC withholding → Form 1040 Line 25b', () => {

  test('Scenario: Box 4 backup withholding flows to Line 25b', () => {
    const nodes = [
      ...generateF1099NECSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateF1099NECAggregators([1], []),
      ...F1040_PAYMENT_NODES,
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.nec_w_s1, value: 500 },
    ]);

    expect(getNum(state, N.line25b)).toBe(500);
  });

  test('Scenario: multiple 1099-NEC slots sum withholding', () => {
    const nodes = [
      ...generateF1099NECSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateF1099NECSlotNodes(NodeOwner.PRIMARY, 2),
      ...generateF1099NECAggregators([1, 2], []),
      ...F1040_PAYMENT_NODES,
    ];

    const state = applyEvents(nodes, [
      { instanceId: 'f1099nec.primary.s1.box4_federalWithholding', value: 300 },
      { instanceId: 'f1099nec.primary.s2.box4_federalWithholding', value: 200 },
    ]);

    expect(getNum(state, N.line25b)).toBe(500);
    expect(getNum(state, N.line26)).toBeGreaterThanOrEqual(500);
  });

});