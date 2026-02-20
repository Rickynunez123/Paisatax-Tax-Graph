/**
 * FORM 8812 — TESTS
 * Child Tax Credit, ODC, and Additional Child Tax Credit
 *
 * Test scenarios:
 *   1. Basic CTC — 2 qualifying children, no phase-out, enough tax liability
 *   2. ACTC — low income, insufficient tax liability → ACTC kicks in
 *   3. Phase-out — high income MFJ reduces credit
 *   4. Phase-out — full phase-out, no credit
 *   5. ODC only — no qualifying children, one other dependent
 *   6. Mixed — qualifying children + other dependents
 *   7. ACTC cap — large family, ACTC capped at per-child max
 *   8. No dependents — all zeros
 */

import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { InputEventSource }   from '../../src/core/graph/engine.types';
import {
  F8889_NODES,
  F8889_OUTPUTS,
} from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }        from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }    from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }    from '../../src/tax/forms/schedule2/nodes';
import { W2_INITIAL_AGGREGATORS } from '../../src/tax/forms/w2/nodes';
import { F1040_NODES }        from '../../src/tax/forms/f1040/nodes';
import { F8812_NODES, F8812_OUTPUTS } from '../../src/tax/forms/f8812/nodes';

const SESSION = {
  taxYear:      '2025',
  filingStatus: 'married_filing_jointly',
  hasSpouse:    false,
  sessionKey:   'test-f8812',
};

function makeEngine() {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
    ...F8812_NODES,

  ]);
  return engine;
}

function setInput(
  engine: TaxGraphEngineImpl,
  state:  Record<string, any>,
  instanceId: string,
  value:  any,
) {
  const result = engine.process(
    { instanceId, value, source: InputEventSource.PREPARER, timestamp: new Date().toISOString() },
    state,
    SESSION,
  );
  return result.currentState;
}

function getVal(state: Record<string, any>, id: string): number {
  return (state[id]?.value as number) ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8812 — Child Tax Credit', () => {

  test('Scenario 1: Basic CTC — 2 children, full credit, sufficient tax', () => {
    const engine = makeEngine();
    let state = engine.initializeSession(SESSION).currentState;

    // $120,000 wages → enough tax liability
    state = setInput(engine, state, 'f1040.joint.line9input_otherIncome', 120_000);
    // 2 qualifying children
    state = setInput(engine, state, 'f8812.joint.line4_numQualifyingChildren', 2);

    // Initial credit = 2 × $2,200 = $4,400
    expect(getVal(state, 'f8812.joint.line8_initialCredit')).toBe(4_400);
    // MAGI well below $400k threshold → no phase-out
    expect(getVal(state, 'f8812.joint.line11_phaseOutReduction')).toBe(0);
    expect(getVal(state, 'f8812.joint.line12_creditAfterPhaseOut')).toBe(4_400);
    // Non-refundable credit = min($4,400, tax liability)
    const nonRefundable = getVal(state, F8812_OUTPUTS.nonRefundableCredit);
    expect(nonRefundable).toBeGreaterThan(0);
    expect(nonRefundable).toBeLessThanOrEqual(4_400);
    // No unallowed CTC if tax covers it → no ACTC
    const unallowed = getVal(state, 'f8812.joint.line15_unallowedCTC');
    const actc      = getVal(state, F8812_OUTPUTS.additionalChildTaxCredit);
    expect(nonRefundable + unallowed).toBe(4_400);
    if (unallowed === 0) {
      expect(actc).toBe(0);
    }
  });

  test('Scenario 2: ACTC — low income, tax insufficient to absorb full CTC', () => {
    const engine = makeEngine();
    let state = engine.initializeSession(SESSION).currentState;

    // Low wages → small tax liability, can't use full CTC
    state = setInput(engine, state, 'f1040.joint.line9input_otherIncome', 25_000);
    state = setInput(engine, state, 'f8812.joint.line4_numQualifyingChildren', 2);

    const nonRefundable = getVal(state, F8812_OUTPUTS.nonRefundableCredit);
    const unallowed     = getVal(state, 'f8812.joint.line15_unallowedCTC');
    const actc          = getVal(state, F8812_OUTPUTS.additionalChildTaxCredit);

    // Total must not exceed $4,400
    expect(nonRefundable + unallowed).toBe(4_400);
    // ACTC formula: 15% × ($25,000 - $2,500) = 15% × $22,500 = $3,375
    // But capped at unallowed CTC and per-child cap ($3,400)
    const expectedEarnedBased = Math.min(3_400, 0.15 * (25_000 - 2_500));
    expect(actc).toBe(Math.min(unallowed, expectedEarnedBased));
    expect(actc).toBeGreaterThan(0);
  });

  test('Scenario 3: Phase-out — MFJ, MAGI $410,000 → $500 reduction', () => {
    const engine = makeEngine();
    let state = engine.initializeSession(SESSION).currentState;

    // $410,000 income → excess = $10,000 → rounded $10,000 → reduction = 10 × $50 = $500
    state = setInput(engine, state, 'f1040.joint.line9input_otherIncome', 410_000);
    state = setInput(engine, state, 'f8812.joint.line4_numQualifyingChildren', 2);

    expect(getVal(state, 'f8812.joint.line11_phaseOutReduction')).toBe(500);
    // Initial $4,400 - $500 = $3,900
    expect(getVal(state, 'f8812.joint.line12_creditAfterPhaseOut')).toBe(3_900);
  });

  test('Scenario 4: Phase-out — MFJ, MAGI $444,000 → full phase-out (2 children)', () => {
    const engine = makeEngine();
    let state = engine.initializeSession(SESSION).currentState;

    // $444,000 → excess = $44,000 → rounded = $44,000 → reduction = 44 × $50 = $2,200
    // But we have 2 children → initial credit $4,400
    // $4,400 - $2,200 = $2,200 remaining
    state = setInput(engine, state, 'f1040.joint.line9input_otherIncome', 444_000);
    state = setInput(engine, state, 'f8812.joint.line4_numQualifyingChildren', 2);

    expect(getVal(state, 'f8812.joint.line11_phaseOutReduction')).toBe(2_200);
    expect(getVal(state, 'f8812.joint.line12_creditAfterPhaseOut')).toBe(2_200);
  });

  test('Scenario 4b: Phase-out — complete elimination (1 child, high income)', () => {
    const engine = makeEngine();
    let state = engine.initializeSession(SESSION).currentState;

    // 1 child → initial credit $2,200
    // Need excess > $44,000 for full phase-out: MAGI > $444,000
    state = setInput(engine, state, 'f1040.joint.line9input_otherIncome', 450_000);
    state = setInput(engine, state, 'f8812.joint.line4_numQualifyingChildren', 1);

    // excess = $50,000 → rounded → reduction = 50 × $50 = $2,500 > $2,200
    expect(getVal(state, 'f8812.joint.line12_creditAfterPhaseOut')).toBe(0);
    expect(getVal(state, F8812_OUTPUTS.nonRefundableCredit)).toBe(0);
    expect(getVal(state, F8812_OUTPUTS.additionalChildTaxCredit)).toBe(0);
  });

  test('Scenario 5: ODC only — 1 other dependent, no qualifying children', () => {
    const engine = makeEngine();
    let state = engine.initializeSession(SESSION).currentState;

    state = setInput(engine, state, 'f1040.joint.line9input_otherIncome', 80_000);
    state = setInput(engine, state, 'f8812.joint.line6_numOtherDependents', 1);

    // ODC = $500, no CTC
    expect(getVal(state, 'f8812.joint.line5_ctcAmount')).toBe(0);
    expect(getVal(state, 'f8812.joint.line7_odcAmount')).toBe(500);
    expect(getVal(state, 'f8812.joint.line8_initialCredit')).toBe(500);
    // No ACTC for ODC-only
    expect(getVal(state, F8812_OUTPUTS.additionalChildTaxCredit)).toBe(0);
  });

  test('Scenario 6: Mixed — 2 qualifying children + 1 other dependent', () => {
    const engine = makeEngine();
    let state = engine.initializeSession(SESSION).currentState;

    state = setInput(engine, state, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, 'f8812.joint.line4_numQualifyingChildren', 2);
    state = setInput(engine, state, 'f8812.joint.line6_numOtherDependents', 1);

    // Initial = (2 × $2,200) + (1 × $500) = $4,900
    expect(getVal(state, 'f8812.joint.line8_initialCredit')).toBe(4_900);
  });

  test('Scenario 7: ACTC cap — 3 children, earned income formula exceeds per-child cap', () => {
    const engine = makeEngine();
    let state = engine.initializeSession(SESSION).currentState;

    // $100,000 wages
    state = setInput(engine, state, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, 'f8812.joint.line4_numQualifyingChildren', 3);

    // Per-child ACTC cap = 3 × $1,700 = $5,100
    expect(getVal(state, 'f8812.joint.line16a_actcCap')).toBe(5_100);
    // Earned income formula = 15% × ($100,000 - $2,500) = $14,625 → capped at $5,100
    const actc = getVal(state, F8812_OUTPUTS.additionalChildTaxCredit);
    expect(actc).toBeLessThanOrEqual(5_100);
  });

  test('Scenario 8: No dependents — all credits zero', () => {
    const engine = makeEngine();
    let state = engine.initializeSession(SESSION).currentState;

    state = setInput(engine, state, 'f1040.joint.line9input_otherIncome', 80_000);
    // Default: 0 qualifying children, 0 other dependents

    expect(getVal(state, 'f8812.joint.line8_initialCredit')).toBe(0);
    expect(getVal(state, F8812_OUTPUTS.nonRefundableCredit)).toBe(0);
    expect(getVal(state, F8812_OUTPUTS.additionalChildTaxCredit)).toBe(0);
  });

  test('ACTC earned income threshold — earned income exactly at $2,500 → no ACTC', () => {
    const engine = makeEngine();
    let state = engine.initializeSession(SESSION).currentState;

    // Very low income — at threshold
    state = setInput(engine, state, 'f1040.joint.line9input_otherIncome', 2_500);
    state = setInput(engine, state, 'f8812.joint.line4_numQualifyingChildren', 2);

    // Earned income above threshold = $0 → ACTC formula = 0
    expect(getVal(state, 'f8812.joint.line19_earnedIncomeAboveThreshold')).toBe(0);
    expect(getVal(state, F8812_OUTPUTS.additionalChildTaxCredit)).toBe(0);
  });

test('Single filer phase-out threshold — $200,000', () => {
  const singleSession = { ...SESSION, filingStatus: 'single' };
  const engine = new TaxGraphEngineImpl();   // fresh engine, no clearNodes needed
  engine.registerNodes([
    ...F8889_NODES, ...F5329_NODES, ...SCHEDULE1_NODES, ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS, ...F1040_NODES, ...F8812_NODES,
  ]);
  let state = engine.initializeSession(singleSession).currentState;

  // Use a local setInput that passes singleSession
  const setLocal = (s: Record<string, any>, id: string, val: any) =>
    engine.process(
      { instanceId: id, value: val, source: InputEventSource.PREPARER, timestamp: new Date().toISOString() },
      s,
      singleSession,
    ).currentState;

  state = setLocal(state, 'f1040.joint.line9input_otherIncome', 205_000);
  state = setLocal(state, 'f8812.joint.line4_numQualifyingChildren', 1);

  expect(getVal(state, 'f8812.joint.line11_phaseOutReduction')).toBe(250);
  expect(getVal(state, 'f8812.joint.line12_creditAfterPhaseOut')).toBe(1_950);
});
});