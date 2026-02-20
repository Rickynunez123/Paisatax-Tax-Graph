// __tests__/form-8936.test.ts
/**
 * FORM 8936 — CLEAN VEHICLE CREDITS — TESTS
 *
 * Form 8936 test scenarios:
 *
 *   Clean Vehicle Credit — Core Inputs + Sum
 *   1. New credit only ($7,500) → total = $7,500
 *   2. Used credit only ($4,000) → total = $4,000
 *   3. New + Used → total = sum
 *
 *   Clean Vehicle Credit — isApplicable Gate
 *   4. Both inputs = 0 → totalCredit skipped (value null)
 *   5. Either input > 0 → totalCredit computed (non-null)
 *
 *   Schedule 3 Wiring
 *   6. Schedule 3 Line 6e equals Form 8936 totalCredit
 *   7. When 8936 skipped → Schedule 3 Line 6e skipped (value null)
 */

import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { InputEventSource } from '../../src/core/graph/engine.types';

import { F8889_NODES } from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES } from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES } from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES } from '../../src/tax/forms/schedule2/nodes';
import { W2_INITIAL_AGGREGATORS } from '../../src/tax/forms/w2/nodes';
import { F1040_NODES } from '../../src/tax/forms/f1040/nodes';

import { F8936_NODES, F8936_OUTPUTS } from '../../src/tax/forms/f8936/nodes';
import { SCHEDULE3_NODES } from '../../src/tax/forms/schedule3/nodes';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS (Form 8936)
// ─────────────────────────────────────────────────────────────────────────────

function make8936Engine(filingStatus: string = 'single') {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,

    // Schedule 3 exists and already wires Line 6e to Form 8936 output
    ...F8936_NODES,
    ...SCHEDULE3_NODES,
  ]);

  return {
    engine,
    session: {
      taxYear: '2025',
      filingStatus,
      hasSpouse: filingStatus === 'married_filing_jointly',
      sessionKey: 'test-f8936',
    },
  };
}

function setInput(
  engine: TaxGraphEngineImpl,
  state: Record<string, any>,
  session: any,
  id: string,
  value: any,
) {
  return engine.process(
    {
      instanceId: id,
      value,
      source: InputEventSource.PREPARER,
      timestamp: new Date().toISOString(),
    },
    state,
    session,
  ).currentState;
}

function num(state: Record<string, any>, id: string): number {
  return (state[id]?.value as number) ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM 8936 — CORE INPUTS + SUM
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8936 — Clean Vehicle Credit (Core)', () => {
  test('1. New credit only ($7,500) → total = $7,500', () => {
    const { engine, session } = make8936Engine('single');
    let state = engine.initializeSession(session).currentState;

    state = setInput(engine, state, session, 'f8936.joint.newCleanVehicleCredit', 7_500);

    expect(num(state, F8936_OUTPUTS.credit)).toBe(7_500);
    expect(num(state, 'f8936.joint.totalCredit')).toBe(7_500);
  });

  test('2. Used credit only ($4,000) → total = $4,000', () => {
    const { engine, session } = make8936Engine('single');
    let state = engine.initializeSession(session).currentState;

    state = setInput(engine, state, session, 'f8936.joint.usedCleanVehicleCredit', 4_000);

    expect(num(state, F8936_OUTPUTS.credit)).toBe(4_000);
    expect(num(state, 'f8936.joint.totalCredit')).toBe(4_000);
  });

  test('3. New + Used → total = sum', () => {
    const { engine, session } = make8936Engine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;

    state = setInput(engine, state, session, 'f8936.joint.newCleanVehicleCredit', 7_500);
    state = setInput(engine, state, session, 'f8936.joint.usedCleanVehicleCredit', 4_000);

    expect(num(state, F8936_OUTPUTS.credit)).toBe(11_500);
    expect(num(state, 'f8936.joint.totalCredit')).toBe(11_500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM 8936 — isApplicable GATE
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8936 — isApplicable Gate', () => {
  test('4. Both inputs = 0 → totalCredit skipped (value null)', () => {
    const { engine, session } = make8936Engine('single');
    const state = engine.initializeSession(session).currentState;

    // totalCredit has isApplicable: (new + used) > 0
    expect(state[F8936_OUTPUTS.credit]?.value).toBeNull();
  });

  test('5. Either input > 0 → totalCredit computed (non-null)', () => {
    const { engine, session } = make8936Engine('single');
    let state = engine.initializeSession(session).currentState;

    state = setInput(engine, state, session, 'f8936.joint.usedCleanVehicleCredit', 1);

    const credit = state[F8936_OUTPUTS.credit]?.value;
    expect(credit).not.toBeNull();
    expect(num(state, F8936_OUTPUTS.credit)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE 3 WIRING — LINE 6e
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule 3 — Wiring for Form 8936 (Line 6e)', () => {
  test('6. Schedule 3 Line 6e equals Form 8936 totalCredit', () => {
    const { engine, session } = make8936Engine('single');
    let state = engine.initializeSession(session).currentState;

    state = setInput(engine, state, session, 'f8936.joint.newCleanVehicleCredit', 7_500);

    expect(num(state, 'schedule3.joint.line6e_cleanVehicleCredit')).toBe(7_500);
  });

  test('7. When 8936 skipped → Schedule 3 Line 6e skipped (value null)', () => {
    const { engine, session } = make8936Engine('single');
    const state = engine.initializeSession(session).currentState;

    // Line 6e has isApplicable: F8936_OUTPUTS.credit > 0
    expect(state['schedule3.joint.line6e_cleanVehicleCredit']?.value).toBeNull();
  });
});