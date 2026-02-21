/**
 * tests/tax/ScheduleC.test.ts
 *
 * Schedule C — INTEGRATION TESTS
 *
 * Tests real Schedule C scenarios end-to-end through the engine.
 *
 * Coverage:
 *   1. Schedule C net profit computation (single slot)
 *   2. Schedule C aggregation (multi-slot, multi-owner)
 *   3. earnedIncome node reflects Schedule C profit
 *
 * CHANGE LOG:
 *   - Suite 3: register W-2 slot + aggregator nodes so w2.joint.totalWages
 *     flows through to f1040.joint.line1a_w2Wages, which earnedIncome reads.
 *     Previously the test set the input but the node was never registered,
 *     so the event was silently dropped and W-2 wages read as $0.
 */

import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { InputEventSource }   from '../../src/core/graph/engine.types';
import type { InputEvent }    from '../../src/core/graph/engine.types';

import { F1040_NODES }        from '../../src/tax/forms/f1040/nodes';

import {
  generateScheduleCSlotNodes,
  generateScheduleCAggregators,
} from '../../src/tax/forms/schedule-c/nodes';

import {
  generateW2SlotNodes,
  generateW2Aggregators,
} from '../../src/tax/forms/w2/nodes';

import { NodeOwner } from '../../src/core/graph/node.types';

// ─────────────────────────────────────────────────────────────────────────────
// TEST HELPERS (match your Form 8889 pattern)
// ─────────────────────────────────────────────────────────────────────────────

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
  // Schedule C (primary slot 1)
  c_line1:   'scheduleC.primary.s1.line1_grossReceipts',
  c_line2:   'scheduleC.primary.s1.line2_returnsAllowances',
  c_line3:   'scheduleC.primary.s1.line3_netReceipts',
  c_line4:   'scheduleC.primary.s1.line4_costOfGoodsSold',
  c_line6:   'scheduleC.primary.s1.line6_otherIncome',
  c_line7:   'scheduleC.primary.s1.line7_grossIncome',

  c_line8:   'scheduleC.primary.s1.line8_advertising',
  c_line22:  'scheduleC.primary.s1.line22_supplies',
  c_line24b_actual:     'scheduleC.primary.s1.line24b_mealsActual',
  c_line24b_deductible: 'scheduleC.primary.s1.line24b_mealsDeductible',
  c_line28:  'scheduleC.primary.s1.line28_totalExpenses',
  c_line30:  'scheduleC.primary.s1.line30_homeOffice',
  c_line31:  'scheduleC.primary.s1.line31_netProfitLoss',

  c_line44a_miles: 'scheduleC.primary.s1.line44a_businessMiles',
  c_line9_parking: 'scheduleC.primary.s1.line9_parkingTolls',
  c_line9_car:     'scheduleC.primary.s1.line9_carTruckExpenses',

  // Aggregators
  c_primary_total: 'scheduleC.primary.totalNetProfit',
  c_spouse_total:  'scheduleC.spouse.totalNetProfit',
  c_joint_total:   'scheduleC.joint.totalNetProfit',

  // W-2 (primary slot 1 Box 1 — wages)
  w2_primary_s1_wages: 'w2.primary.s1.box1_wages',

  // Earned income (Form 1040)
  earnedIncome:    'f1040.joint.earnedIncome',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — SINGLE SLOT COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule C — Single Slot Computation', () => {

  test('Scenario: Gross income = Line 3 − Line 4 + Line 6', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line1, value: 80_000 },
      { instanceId: N.c_line2, value: 2_000 },
      { instanceId: N.c_line4, value: 10_000 },
      { instanceId: N.c_line6, value: 1_000 },
    ]);

    expect(getNum(state, N.c_line3)).toBe(78_000); // 80,000 − 2,000
    expect(getNum(state, N.c_line7)).toBe(69_000); // 78,000 − 10,000 + 1,000
  });

  test('Scenario: Meals are limited to 50% automatically', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line24b_actual, value: 4_000 },
    ]);

    expect(getNum(state, N.c_line24b_deductible)).toBe(2_000);
  });

  test('Scenario: Standard mileage deduction ($0.70/mile) + parking/tolls', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line44a_miles, value: 10_000 },
      { instanceId: N.c_line9_parking, value: 250 },
    ]);

    // 10,000 × 0.70 + 250 = 7,250
    expect(getNum(state, N.c_line9_car)).toBe(7_250);
  });

  test('Scenario: Net profit = Line 7 − Line 28 − Line 30', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line1,  value: 100_000 },
      { instanceId: N.c_line8,  value: 5_000 },
      { instanceId: N.c_line22, value: 3_000 },
      { instanceId: N.c_line30, value: 2_000 },
    ]);

    expect(getNum(state, N.c_line28)).toBe(8_000);
    expect(getNum(state, N.c_line31)).toBe(90_000);
  });

  test('Scenario: Allows net loss (negative Line 31)', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line1, value: 5_000 },
      { instanceId: N.c_line8, value: 10_000 },
    ]);

    expect(getNum(state, N.c_line31)).toBe(-5_000);
  });

  test('Scenario: Line 3 (net receipts) floors at 0 (cannot go negative)', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
    ];

    const state = applyEvents(nodes, [
      { instanceId: N.c_line1, value: 500 },
      { instanceId: N.c_line2, value: 800 },
    ]);

    expect(getNum(state, N.c_line3)).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — MULTI-SLOT AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule C — Multi-slot Aggregation', () => {

  test('Scenario: Primary has 2 Schedule C slots — totals sum correctly', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 2),
      ...generateScheduleCAggregators([1, 2], []),
    ];

    const state = applyEvents(nodes, [
      { instanceId: 'scheduleC.primary.s1.line1_grossReceipts', value: 60_000 },
      { instanceId: 'scheduleC.primary.s2.line1_grossReceipts', value: 40_000 },
      { instanceId: 'scheduleC.primary.s2.line8_advertising',   value: 5_000 }, // slot2 profit 35k
    ]);

    expect(getNum(state, N.c_primary_total)).toBe(95_000);
  });

  test('Scenario: MFJ — primary + spouse profits sum into joint total', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 2),
      ...generateScheduleCSlotNodes(NodeOwner.SPOUSE,  1),
      ...generateScheduleCAggregators([1, 2], [1]),
    ];

    const state = applyEvents(
      nodes,
      [
        { instanceId: 'scheduleC.primary.s1.line1_grossReceipts', value: 50_000 },
        { instanceId: 'scheduleC.primary.s2.line1_grossReceipts', value: 30_000 },
        { instanceId: 'scheduleC.spouse.s1.line1_grossReceipts',  value: 20_000 },
        { instanceId: 'scheduleC.spouse.s1.line8_advertising',    value: 2_000 }, // spouse profit 18k
      ],
      '2025',
      'married_filing_jointly',
      true
    );

    expect(getNum(state, N.c_joint_total)).toBe(98_000);
  });

  test('Scenario: One slot has a loss — joint total still sums correctly', () => {
    const nodes = [
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 2),
      ...generateScheduleCSlotNodes(NodeOwner.SPOUSE,  1),
      ...generateScheduleCAggregators([1, 2], [1]),
    ];

    const state = applyEvents(
      nodes,
      [
        { instanceId: 'scheduleC.primary.s1.line1_grossReceipts', value: 30_000 },
        { instanceId: 'scheduleC.primary.s2.line1_grossReceipts', value: 5_000 },
        { instanceId: 'scheduleC.primary.s2.line8_advertising',   value: 10_000 }, // slot2 = -5k
        { instanceId: 'scheduleC.spouse.s1.line1_grossReceipts',  value: 20_000 },
      ],
      '2025',
      'married_filing_jointly',
      true
    );

    expect(getNum(state, N.c_primary_total)).toBe(25_000);
    expect(getNum(state, N.c_joint_total)).toBe(45_000);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — EARNED INCOME NODE
//
// WHY W-2 SLOT NODES ARE REGISTERED HERE:
//   earnedIncome reads f1040.joint.line1a_w2Wages, which is a COMPUTED node
//   that aggregates from W2_OUTPUTS.jointWages (the W-2 joint aggregator).
//   Setting a raw input on 'w2.joint.totalWages' without registering the
//   W-2 node tree means the engine either drops the event (unknown node) or
//   the value never reaches line1a_w2Wages. Either way wages read as $0.
//
//   Fix: register a W-2 slot + aggregators so the full chain exists:
//     w2.primary.s1.box1_wages (INPUT)
//       → w2.primary.totalWages (COMPUTED aggregator)
//       → w2.joint.totalWages   (COMPUTED joint aggregator)
//       → f1040.joint.line1a_w2Wages
//       → f1040.joint.earnedIncome
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 earnedIncome — includes Schedule C profit', () => {

  /**
   * Build the full node list needed for earnedIncome tests:
   *   - 1 primary W-2 slot + W-2 aggregators  → feeds line1a_w2Wages
   *   - 1 primary Schedule C slot + aggregators → feeds scheduleC.joint.totalNetProfit
   *   - F1040_NODES                             → includes line1a_w2Wages + earnedIncome
   */
  function earnedIncomeNodes() {
    return [
      ...generateW2SlotNodes(NodeOwner.PRIMARY, 1),
      ...generateW2Aggregators([1], []),           // primary + spouse=[] + joint
      ...generateScheduleCSlotNodes(NodeOwner.PRIMARY, 1),
      ...generateScheduleCAggregators([1], []),
      ...F1040_NODES,
    ];
  }

  test('Scenario: earnedIncome = W-2 wages + Schedule C profit', () => {
    const state = applyEvents(earnedIncomeNodes(), [
      { instanceId: N.w2_primary_s1_wages, value: 30_000 },
      { instanceId: N.c_line1,             value: 20_000 },
    ]);

    // W-2: 30,000 + Schedule C: 20,000 = 50,000
    expect(getNum(state, N.earnedIncome)).toBe(50_000);
  });

  test('Scenario: Schedule C loss does NOT reduce earned income below W-2 wages', () => {
    const state = applyEvents(earnedIncomeNodes(), [
      { instanceId: N.w2_primary_s1_wages,                       value: 40_000 },
      { instanceId: N.c_line1,                                   value: 5_000 },
      { instanceId: 'scheduleC.primary.s1.line8_advertising',    value: 15_000 }, // net loss −10k
    ]);

    // Schedule C loss (−10,000) is floored at $0 for earned income purposes.
    // IRC §32(c)(2)(B) — losses don't reduce earned income.
    // earnedIncome = 40,000 (W-2) + max(0, −10,000) = 40,000
    expect(getNum(state, N.earnedIncome)).toBe(40_000);
  });

  test('Scenario: Schedule C profit only (no W-2) — earnedIncome equals net profit', () => {
    const state = applyEvents(earnedIncomeNodes(), [
      { instanceId: N.c_line1, value: 75_000 },
      { instanceId: 'scheduleC.primary.s1.line8_advertising', value: 5_000 },
    ]);

    // No W-2. Schedule C profit = 70,000.
    expect(getNum(state, N.earnedIncome)).toBe(70_000);
  });

  test('Scenario: W-2 only (no Schedule C) — earnedIncome equals W-2 wages', () => {
    const state = applyEvents(earnedIncomeNodes(), [
      { instanceId: N.w2_primary_s1_wages, value: 55_000 },
    ]);

    expect(getNum(state, N.earnedIncome)).toBe(55_000);
  });

});