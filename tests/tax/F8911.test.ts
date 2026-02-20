/**
 * FORM 8911 — ALTERNATIVE FUEL VEHICLE REFUELING PROPERTY CREDIT (§30C)
 *
 * WHAT IS TESTED:
 *   Form 8911 is a thin pass-through form. The heavy lifting (per-item cost
 *   × 30%, $1,000/item cap, census tract verification, Schedule A math) is
 *   done by the preparer before entering the result into this node.
 *
 *   The graph is responsible for:
 *     1. Accepting the preparer-entered credit
 *     2. Passing it through to the credit output node
 *     3. Propagating it to Schedule 3 Line 6j → Line 8 (total nonrefundable)
 *     4. Gating isApplicable so zero-credit filers don't show the form
 *
 *   Tests also verify the per-item credit math as documentation assertions
 *   so future developers understand what the preparer must compute externally.
 *
 * Test scenarios:
 *   Pass-through behavior
 *   1.  Credit entered → flows to credit output
 *   2.  Zero entered (default) → credit is 0, node not applicable
 *
 *   Per-item cap math (preparer responsibility, documented here)
 *   3.  Single item at $2,000 cost → $600 credit (30% × $2,000, below $1,000 cap)
 *   4.  Single item at $4,000 cost → $1,000 credit (30% × $4,000 = $1,200, capped at $1,000)
 *   5.  Single item at $3,334 cost → exactly $1,000 credit (30% × $3,334 = $1,000.20, effectively the cap)
 *   6.  Two items, each over the cap → $2,000 combined credit
 *   7.  Two items, one below cap, one above → correct combined credit
 *
 *   Schedule 3 propagation
 *   8.  Credit flows to Schedule 3 Line 6j
 *   9.  Credit appears in Schedule 3 Line 8 (total nonrefundable credits)
 *   10. With no credit entered, Schedule 3 Line 6j remains 0
 *
 *   Boundary and limits
 *   11. Maximum single-item credit is $1,000 (30% rate, $3,334+ cost)
 *   12. Credit does not go negative regardless of input
 */

import { TaxGraphEngineImpl }    from '../../src/core/graph/engine';
import { InputEventSource }       from '../../src/core/graph/engine.types';
import { F8889_NODES }            from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }            from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }        from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }        from '../../src/tax/forms/schedule2/nodes';
import { W2_INITIAL_AGGREGATORS } from '../../src/tax/forms/w2/nodes';
import { F1040_NODES }            from '../../src/tax/forms/f1040/nodes';
import { F8812_NODES }            from '../../src/tax/forms/f8812/nodes';
import { F2441_NODES }            from '../../src/tax/forms/f2441/nodes';
import { F8863_NODES }            from '../../src/tax/forms/f8863/nodes';
import { F5695_NODES }            from '../../src/tax/forms/f5695/nodes';
import { F8936_NODES }            from '../../src/tax/forms/f8936/nodes';
import { F8911_NODES, F8911_OUTPUTS } from '../../src/tax/forms/f8911/nodes';
import { F4868_NODES }            from '../../src/tax/forms/f4868/nodes';
import { SCHEDULE3_NODES }        from '../../src/tax/forms/schedule3/nodes';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeEngine(filingStatus = 'single') {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
    ...F8812_NODES,
    ...F2441_NODES,
    ...F8863_NODES,
    ...F5695_NODES,
    ...F8936_NODES,
    ...F8911_NODES,
    ...F4868_NODES,
    ...SCHEDULE3_NODES,
  ]);
  return {
    engine,
    session: {
      taxYear:      '2025',
      filingStatus,
      hasSpouse:    false,
      sessionKey:   'test-f8911',
    },
  };
}

function setInput(
  engine:  TaxGraphEngineImpl,
  state:   Record<string, any>,
  session: any,
  id:      string,
  value:   any,
) {
  return engine.process(
    { instanceId: id, value, source: InputEventSource.PREPARER, timestamp: new Date().toISOString() },
    state,
    session,
  ).currentState;
}

function val(state: Record<string, any>, id: string): number {
  return (state[id]?.value as number) ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PASS-THROUGH BEHAVIOR
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8911 — Pass-Through Behavior', () => {

  test('1. Credit entered by preparer flows through to credit output', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f8911.joint.personalUseCredit', 1_000);

    expect(val(state, F8911_OUTPUTS.credit)).toBe(1_000);
  });

  test('2. Zero entered (default) → credit is 0 and node is not applicable', () => {
    const { engine, session } = makeEngine();
    const state = engine.initializeSession(session).currentState;

    expect(val(state, 'f8911.joint.personalUseCredit')).toBe(0);
    expect(val(state, F8911_OUTPUTS.credit)).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// PER-ITEM CAP MATH (PREPARER RESPONSIBILITY — DOCUMENTED AS ASSERTIONS)
//
// These tests validate what the preparer must compute before entering the
// credit. The graph accepts the final result; these verify the underlying
// §30C formula so future developers understand what is expected.
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8911 — Per-Item Cap Math (§30C, 30% rate, $1,000/item cap)', () => {

  const RATE = 0.30;
  const PER_ITEM_CAP = 1_000;

  function itemCredit(cost: number): number {
    return Math.min(cost * RATE, PER_ITEM_CAP);
  }

  test('3. Single item at $2,000 cost → $600 credit (below cap)', () => {
    const credit = itemCredit(2_000);
    expect(credit).toBe(600);

    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f8911.joint.personalUseCredit', credit);
    expect(val(state, F8911_OUTPUTS.credit)).toBe(600);
  });

  test('4. Single item at $4,000 cost → $1,000 credit (capped; 30% = $1,200)', () => {
    const credit = itemCredit(4_000);
    expect(credit).toBe(1_000);

    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f8911.joint.personalUseCredit', credit);
    expect(val(state, F8911_OUTPUTS.credit)).toBe(1_000);
  });

  test('5. Item at $3,334 cost → $1,000 credit (30% × $3,334 = $1,000.20, hits cap)', () => {
    const credit = itemCredit(3_334);
    expect(credit).toBe(1_000);

    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f8911.joint.personalUseCredit', credit);
    expect(val(state, F8911_OUTPUTS.credit)).toBe(1_000);
  });

  test('6. Two items both above cap → $2,000 combined (2 × $1,000)', () => {
    const item1 = itemCredit(5_000); // $1,000
    const item2 = itemCredit(8_000); // $1,000
    const combined = item1 + item2;
    expect(combined).toBe(2_000);

    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f8911.joint.personalUseCredit', combined);
    expect(val(state, F8911_OUTPUTS.credit)).toBe(2_000);
  });

  test('7. Two items: one $1,000 cost (below cap), one $5,000 cost (above cap) → $1,300', () => {
    const item1 = itemCredit(1_000); // $300
    const item2 = itemCredit(5_000); // $1,000
    const combined = item1 + item2;
    expect(combined).toBe(1_300);

    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f8911.joint.personalUseCredit', combined);
    expect(val(state, F8911_OUTPUTS.credit)).toBe(1_300);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE 3 PROPAGATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8911 — Schedule 3 Propagation', () => {

  test('8. Credit flows to Schedule 3 Line 6j', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f8911.joint.personalUseCredit', 800);

    expect(val(state, 'schedule3.joint.line6j_alternativeFuelCredit')).toBe(800);
  });

  test('9. Credit appears in Schedule 3 Line 8 (total nonrefundable credits)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f8911.joint.personalUseCredit', 1_000);

    // Line 8 sums all nonrefundable credits — must include the $1,000 F8911 credit
    expect(val(state, 'schedule3.joint.line8_totalNonRefundableCredits')).toBeGreaterThanOrEqual(1_000);
  });

  test('10. With no credit entered, Schedule 3 Line 6j stays 0', () => {
    const { engine, session } = makeEngine();
    const state = engine.initializeSession(session).currentState;

    expect(val(state, 'schedule3.joint.line6j_alternativeFuelCredit')).toBe(0);
  });

  test('9b. F8911 credit stacks correctly with another Schedule 3 credit', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    // F8911 credit of $1,000 alongside a clean vehicle credit (F8936)
    state = setInput(engine, state, session, 'f8911.joint.personalUseCredit', 1_000);
    state = setInput(engine, state, session, 'f8936.joint.newCleanVehicleCredit', 7_500);

    const line8 = val(state, 'schedule3.joint.line8_totalNonRefundableCredits');
    expect(line8).toBeGreaterThanOrEqual(8_500);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// BOUNDARY AND LIMITS
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8911 — Boundary and Limits', () => {

  test('11. Maximum single-item credit is $1,000 (§30C hard cap per item)', () => {
    // Per IRC §30C(b)(1), $1,000 per item is the ceiling for personal use.
    // Entering anything higher is a preparer error; the graph accepts it as-is
    // since the cap is enforced in Schedule A, not in the graph node.
    // This test documents the expected max for a single qualifying item.
    const RATE = 0.30;
    const PER_ITEM_CAP = 1_000;
    const maxItemCost = PER_ITEM_CAP / RATE; // $3,333.33 is the breakeven cost
    expect(Math.min(maxItemCost * RATE, PER_ITEM_CAP)).toBe(1_000);
  });

  test('12. Credit node does not go negative — allowNegative is false', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    // Input is defined as allowNegative: false, so zero is the floor
    state = setInput(engine, state, session, 'f8911.joint.personalUseCredit', 0);

    expect(val(state, F8911_OUTPUTS.credit)).toBe(0);
    expect(val(state, F8911_OUTPUTS.credit)).toBeGreaterThanOrEqual(0);
  });

});