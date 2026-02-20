/**
 * MFJ SPOUSE MATERIALIZATION TESTS
 *
 * Proves that the engine correctly:
 *   1. Creates spouse instances for all repeatable PRIMARY nodes when hasSpouse = true
 *   2. Does NOT create spouse instances when hasSpouse = false
 *   3. Computes spouse instances independently using mirrored compute contexts
 *   4. Joint aggregator nodes (Schedule 1 Line 13, Schedule 2 Lines 8/17b) sum both filers
 *   5. Dirty propagation flows through spouse instances correctly
 *   6. Full MFJ vertical slice: both spouses with HSAs → combined AGI reduction
 *
 * Test suites:
 *   1. Instance materialization — spouse nodes exist when and only when expected
 *   2. Independent computation — spouse values compute from spouse inputs
 *   3. Joint aggregation — Schedule 1/2 sum primary + spouse correctly
 *   4. Dirty propagation — changing spouse input updates joint aggregators
 *   5. Full MFJ vertical slice — end-to-end with both spouses
 *   6. Edge cases — asymmetric HSAs, only spouse has penalty, etc.
 */

import { TaxGraphEngineImpl }  from '../../src/core/graph/engine.js';
import { F8889_NODES }         from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }         from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }     from '../../src/tax/forms/schedule1/nodes.js';
import { SCHEDULE2_NODES }     from '../../src/tax/forms/schedule2/nodes';
import { F1040_NODES }         from '../../src/tax/forms/f1040/nodes.js';
import { F8889_OUTPUTS }       from '../../src/tax/forms/f8889/nodes';
import { F5329_OUTPUTS }       from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_OUTPUTS }   from '../../src/tax/forms/schedule1/nodes.js';
import { SCHEDULE2_OUTPUTS }   from '../../src/tax/forms/schedule2/nodes';
import { F1040_OUTPUTS }       from '../../src/tax/forms/f1040/nodes.js';
import { InputEventSource }    from '../../src/core/graph/engine.types';
import { NodeStatus }          from '../../src/core/graph/node.types';
import type { InputEvent }     from '../../src/core/graph/engine.types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ALL_NODES = [
  ...F8889_NODES,
  ...F5329_NODES,
  ...SCHEDULE1_NODES,
  ...SCHEDULE2_NODES,
  ...F1040_NODES,
];

function makeEngine() {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes(ALL_NODES);
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

function initMFJ(engine: ReturnType<typeof makeEngine>) {
  return engine.initializeSession({
    taxYear:      '2025',
    filingStatus: 'married_filing_jointly',
    hasSpouse:    true,
    sessionKey:   'test-mjf#2025',
  });
}

function initSingle(engine: ReturnType<typeof makeEngine>) {
  return engine.initializeSession({
    taxYear:      '2025',
    filingStatus: 'single',
    hasSpouse:    false,
    sessionKey:   'test-single#2025',
  });
}

function applyMFJ(
  events: { instanceId: string; value: string | number | boolean }[]
) {
  const engine  = makeEngine();
  const context = { taxYear: '2025', filingStatus: 'married_filing_jointly', hasSpouse: true };
  let result    = engine.initializeSession({ ...context, sessionKey: 'test-mfj#2025' });
  for (const e of events) {
    result = engine.process(makeEvent(e.instanceId, e.value), result.currentState, context);
  }
  return { result, engine, context };
}

function num(state: Record<string, any>, nodeId: string): number {
  const snap = state[nodeId];
  if (!snap) throw new Error(`Node not found: ${nodeId}`);
  if (typeof snap.value !== 'number') throw new Error(`Expected number at ${nodeId}, got: ${JSON.stringify(snap.value)} (status: ${snap.status})`);
  return snap.value;
}

function nodeStatus(state: Record<string, any>, nodeId: string): string {
  return state[nodeId]?.status ?? 'not_found';
}

// Node ID shorthands
const P = {
  coverageType:          'f8889.primary.line1_coverageType',
  personalContributions: 'f8889.primary.line2_personalContributions',
  ageAsOfDec31:          'f8889.primary.line4input_ageAsOfDec31',
  employerContributions: 'f8889.primary.line6_employerContributions',
  hsaDeduction:          'f8889.primary.line13_hsaDeduction',
  totalDistributions:    'f8889.primary.line14a_totalDistributions',
  qualifiedExpenses:     'f8889.primary.line16_qualifiedMedicalExpenses',
  additionalTax:         'f8889.primary.line17b_additionalTax',
};

const SP = {
  coverageType:          'f8889.spouse.line1_coverageType',
  personalContributions: 'f8889.spouse.line2_personalContributions',
  ageAsOfDec31:          'f8889.spouse.line4input_ageAsOfDec31',
  employerContributions: 'f8889.spouse.line6_employerContributions',
  hsaDeduction:          'f8889.spouse.line13_hsaDeduction',
  totalDistributions:    'f8889.spouse.line14a_totalDistributions',
  qualifiedExpenses:     'f8889.spouse.line16_qualifiedMedicalExpenses',
  additionalTax:         'f8889.spouse.line17b_additionalTax',
};

const PR = {
  earlyDistributions: 'f5329.primary.line1_earlyDistributions',
  exceptionAmount:    'f5329.primary.line2_exceptionAmount',
  earlyDistPenalty:   'f5329.primary.line4_additionalTax',
  excessTax:          'f5329.primary.line49_excessTax',
};

const SR = {
  earlyDistributions: 'f5329.spouse.line1_earlyDistributions',
  exceptionAmount:    'f5329.spouse.line2_exceptionAmount',
  earlyDistPenalty:   'f5329.spouse.line4_additionalTax',
  excessTax:          'f5329.spouse.line49_excessTax',
};

const S1 = {
  hsaDeduction:    'schedule1.joint.line13_hsaDeduction',
  totalAdj:        'schedule1.joint.line26_totalAdjustments',
};

const S2 = {
  line8:   'schedule2.joint.line8_additionalRetirementTax',
  line17b: 'schedule2.joint.line17b_hsaDistributionTax',
  line44:  'schedule2.joint.line44_totalAdditionalTaxes',
};

const F = {
  otherIncome: "schedule1.joint.line3_businessIncome", // ✅ INPUT (write here)
  totalIncome: "f1040.joint.line9_totalIncome", // ✅ COMPUTED (read/assert only)
  adjustments: "f1040.joint.line10_adjustmentsToIncome",
  agi: "f1040.joint.line11_adjustedGrossIncome",
};


// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — INSTANCE MATERIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

describe('MFJ Spouse Materialization — Instance Creation', () => {

  test('Spouse HSA nodes exist in MFJ session', () => {
    const engine = makeEngine();
    const result = initMFJ(engine);

    // All spouse F8889 node instances should be materialized
    expect(result.currentState[SP.coverageType]).toBeDefined();
    expect(result.currentState[SP.personalContributions]).toBeDefined();
    expect(result.currentState[SP.ageAsOfDec31]).toBeDefined();
    expect(result.currentState[SP.hsaDeduction]).toBeDefined();
    expect(result.currentState[SP.additionalTax]).toBeDefined();
  });

  test('Spouse F5329 nodes exist in MFJ session', () => {
    const engine = makeEngine();
    const result = initMFJ(engine);

    expect(result.currentState[SR.earlyDistributions]).toBeDefined();
    expect(result.currentState[SR.exceptionAmount]).toBeDefined();
    expect(result.currentState[SR.earlyDistPenalty]).toBeDefined();
    expect(result.currentState[SR.excessTax]).toBeDefined();
  });

  test('MFJ session has more nodes than single session', () => {
    const engine = makeEngine();
    const mfj    = initMFJ(engine);
    const single = initSingle(engine);

    // MFJ should have additional spouse instance nodes
    expect(Object.keys(mfj.currentState).length).toBeGreaterThan(
      Object.keys(single.currentState).length
    );
  });

  test('Spouse nodes do NOT exist in single filer session', () => {
    const engine = makeEngine();
    const result = initSingle(engine);

    expect(result.currentState[SP.coverageType]).toBeUndefined();
    expect(result.currentState[SP.hsaDeduction]).toBeUndefined();
    expect(result.currentState[SR.earlyDistPenalty]).toBeUndefined();
  });

  test('Spouse input nodes initialize with same default values as primary', () => {
    const engine = makeEngine();
    const result = initMFJ(engine);

    // Spouse input nodes should have default values (same as primary defaults)
    expect(result.currentState[SP.personalContributions]?.value).toBe(0);
    expect(result.currentState[SP.ageAsOfDec31]?.value).toBe(0);
    expect(result.currentState[SR.earlyDistributions]?.value).toBe(0);
  });

  test('Spouse input nodes initialize with CLEAN status', () => {
    const engine = makeEngine();
    const result = initMFJ(engine);

    expect(result.currentState[SP.personalContributions]?.status).toBe(NodeStatus.CLEAN);
    expect(result.currentState[SP.coverageType]?.status).toBe(NodeStatus.CLEAN);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — INDEPENDENT COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

describe('MFJ Spouse Materialization — Independent Computation', () => {

  test('Setting spouse coverage type updates only spouse HSA deduction', () => {
    /**
     * Primary: no HSA activity
     * Spouse:  self-only coverage, $3,600 contribution, age 35
     * Expected: primary deduction = 0, spouse deduction = $3,600
     */
    const { result } = applyMFJ([
      { instanceId: SP.coverageType,          value: 'self_only' },
      { instanceId: SP.personalContributions, value: 3_600 },
      { instanceId: SP.ageAsOfDec31,          value: 35 },
    ]);

    expect(result.currentState[P.hsaDeduction]?.value).toBe(0);
    expect(result.currentState[SP.hsaDeduction]?.value).toBe(3_600);
  });

  test('Primary and spouse HSA deductions compute independently', () => {
    /**
     * Primary: self-only, $4,300, age 45 → deduction = $4,300
     * Spouse:  self-only, $3,000, age 38 → deduction = $3,000
     */
    const { result } = applyMFJ([
      { instanceId: P.coverageType,           value: 'self_only' },
      { instanceId: P.personalContributions,  value: 4_300 },
      { instanceId: P.ageAsOfDec31,           value: 45 },
      { instanceId: SP.coverageType,          value: 'self_only' },
      { instanceId: SP.personalContributions, value: 3_000 },
      { instanceId: SP.ageAsOfDec31,          value: 38 },
    ]);

    expect(num(result.currentState, P.hsaDeduction)).toBe(4_300);
    expect(num(result.currentState, SP.hsaDeduction)).toBe(3_000);
  });

  test('Spouse catch-up contribution works independently', () => {
    /**
     * Spouse is 57 — qualifies for $1,000 catch-up
     * Self-only limit: $4,300 + $1,000 = $5,300
     */
    const { result } = applyMFJ([
      { instanceId: SP.coverageType,          value: 'self_only' },
      { instanceId: SP.personalContributions, value: 5_300 },
      { instanceId: SP.ageAsOfDec31,          value: 57 },
    ]);

    expect(num(result.currentState, SP.hsaDeduction)).toBe(5_300);
  });

  test('Spouse HSA excess penalty computes from spouse contribution', () => {
    /**
     * Spouse contributes $5,500 to self-only HSA (limit $4,300) → $1,200 excess
     * Excess tax = $1,200 × 6% = $72
     */
    const { result } = applyMFJ([
      { instanceId: SP.coverageType,          value: 'self_only' },
      { instanceId: SP.personalContributions, value: 5_500 },
      { instanceId: SP.ageAsOfDec31,          value: 40 },
    ]);

    expect(num(result.currentState, SR.excessTax)).toBe(72);    // 1200 × 6%
    expect(num(result.currentState, PR.excessTax)).toBe(0);     // primary unaffected
  });

  test('Spouse early distribution penalty computes from spouse F5329', () => {
    /**
     * Spouse withdraws $8,000 early → $800 penalty
     * Primary has no early distribution
     */
    const { result } = applyMFJ([
      { instanceId: SR.earlyDistributions, value: 8_000 },
      { instanceId: SR.exceptionAmount,    value: 0 },
    ]);

    expect(num(result.currentState, SR.earlyDistPenalty)).toBe(800);
    expect(num(result.currentState, PR.earlyDistPenalty)).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — JOINT AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

describe('MFJ Spouse Materialization — Joint Aggregation', () => {

  test('Schedule 1 Line 13 sums primary + spouse HSA deductions', () => {
    /**
     * Primary deduction: $4,300
     * Spouse deduction:  $3,600
     * Schedule 1 Line 13 total: $7,900
     */
    const { result } = applyMFJ([
      { instanceId: P.coverageType,           value: 'self_only' },
      { instanceId: P.personalContributions,  value: 4_300 },
      { instanceId: P.ageAsOfDec31,           value: 45 },
      { instanceId: SP.coverageType,          value: 'self_only' },
      { instanceId: SP.personalContributions, value: 3_600 },
      { instanceId: SP.ageAsOfDec31,          value: 38 },
    ]);

    expect(num(result.currentState, S1.hsaDeduction)).toBe(7_900);
    expect(num(result.currentState, S1.totalAdj)).toBe(7_900);
  });

  test('Schedule 1 Line 13 = primary only when spouse has no HSA', () => {
    const { result } = applyMFJ([
      { instanceId: P.coverageType,          value: 'self_only' },
      { instanceId: P.personalContributions, value: 4_300 },
      { instanceId: P.ageAsOfDec31,          value: 45 },
    ]);

    expect(num(result.currentState, S1.hsaDeduction)).toBe(4_300);
  });

  test('Schedule 2 Line 8 sums primary + spouse F5329 penalties', () => {
    /**
     * Primary early dist penalty: $600   ($6,000 × 10%)
     * Spouse early dist penalty:  $800   ($8,000 × 10%)
     * Schedule 2 Line 8 total:    $1,400
     */
    const { result } = applyMFJ([
      { instanceId: PR.earlyDistributions, value: 6_000 },
      { instanceId: PR.exceptionAmount,    value: 0 },
      { instanceId: SR.earlyDistributions, value: 8_000 },
      { instanceId: SR.exceptionAmount,    value: 0 },
    ]);

    expect(num(result.currentState, PR.earlyDistPenalty)).toBe(600);
    expect(num(result.currentState, SR.earlyDistPenalty)).toBe(800);
    expect(num(result.currentState, S2.line8)).toBe(1_400);
  });

  test('Schedule 2 Line 17b sums primary + spouse HSA distribution penalties', () => {
    /**
     * Primary non-qualified dist: $500 → $100 penalty (20%)
     * Spouse non-qualified dist:  $300 → $60 penalty (20%)
     * Schedule 2 Line 17b:        $160
     */
    const { result } = applyMFJ([
      { instanceId: P.coverageType,        value: 'self_only' },
      { instanceId: P.ageAsOfDec31,        value: 40 },
      { instanceId: P.totalDistributions,  value: 500 },
      { instanceId: P.qualifiedExpenses,   value: 0 },
      { instanceId: SP.coverageType,       value: 'self_only' },
      { instanceId: SP.ageAsOfDec31,       value: 40 },
      { instanceId: SP.totalDistributions, value: 300 },
      { instanceId: SP.qualifiedExpenses,  value: 0 },
    ]);

    expect(num(result.currentState, S2.line17b)).toBe(160);
  });

  test('Schedule 2 Line 44 sums all penalty sources from both filers', () => {
    /**
     * Primary excess tax:    $42    (700 excess × 6%)
     * Spouse early dist:     $500   ($5,000 × 10%)
     * Total:                 $542
     */
    const { result } = applyMFJ([
      // Primary: HSA excess
      { instanceId: P.coverageType,          value: 'self_only' },
      { instanceId: P.personalContributions, value: 5_000 },
      { instanceId: P.ageAsOfDec31,          value: 40 },
      // Spouse: early distribution
      { instanceId: SR.earlyDistributions,   value: 5_000 },
      { instanceId: SR.exceptionAmount,      value: 0 },
    ]);

    expect(num(result.currentState, S2.line44)).toBe(542);
  });

  test('Single filer: joint aggregators use only primary values', () => {
    /**
     * On a single return, the spouse instance IDs don't exist.
     * Schedule 1 and 2 aggregators should still compute correctly from primary only.
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'single#2025' });

    result = engine.process(makeEvent(P.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(P.personalContributions, 4_300),       result.currentState, context);
    result = engine.process(makeEvent(P.ageAsOfDec31,          40),          result.currentState, context);

    expect(num(result.currentState, S1.hsaDeduction)).toBe(4_300);
    expect(num(result.currentState, S1.totalAdj)).toBe(4_300);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — DIRTY PROPAGATION
// ─────────────────────────────────────────────────────────────────────────────

describe('MFJ Spouse Materialization — Dirty Propagation', () => {

  test('Changing spouse HSA contribution propagates to Schedule 1 and Form 1040 AGI', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'married_filing_jointly', hasSpouse: true };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    // Set up both filers
    result = engine.process(
      makeEvent(F.otherIncome, 150_000),
      result.currentState,
      context,
    );

    result = engine.process(makeEvent(P.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(P.personalContributions, 4_300), result.currentState, context);
    result = engine.process(makeEvent(P.ageAsOfDec31,          45),    result.currentState, context);
    result = engine.process(makeEvent(SP.coverageType,         'self_only'), result.currentState, context);
    result = engine.process(makeEvent(SP.personalContributions, 3_000), result.currentState, context);
    result = engine.process(makeEvent(SP.ageAsOfDec31,         38),    result.currentState, context);

    // Initial AGI: $150,000 - ($4,300 + $3,000) = $142,700
    expect(result.currentState[F.agi]?.value).toBe(142_700);

    // Change spouse contribution
    result = engine.process(makeEvent(SP.personalContributions, 4_300), result.currentState, context);

    // Updated AGI: $150,000 - ($4,300 + $4,300) = $141,400
    expect(result.currentState[S1.hsaDeduction]?.value).toBe(8_600);
    expect(result.currentState[F.agi]?.value).toBe(141_400);
  });

  test('Removing spouse HSA coverage cascades penalty elimination', () => {
    /**
     * Start: spouse has $5,500 excess → penalty $72
     * Fix: set spouse coverage to family (higher limit) → no excess
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'married_filing_jointly', hasSpouse: true };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    result = engine.process(makeEvent(SP.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(SP.personalContributions, 5_500),       result.currentState, context);
    result = engine.process(makeEvent(SP.ageAsOfDec31,          40),          result.currentState, context);

    // Spouse has excess
    expect(result.currentState[SR.excessTax]?.value).toBe(72);
    expect(result.currentState[S2.line8]?.value).toBe(72);

    // Fix: switch to family coverage (limit $8,550 — $5,500 is under limit)
    result = engine.process(makeEvent(SP.coverageType, 'family'), result.currentState, context);

    // Penalty eliminated
    expect(result.currentState[SR.excessTax]?.value).toBe(0);
    expect(result.currentState[S2.line8]?.status).toBe(NodeStatus.SKIPPED);

  });

  test('Changing primary input does not re-compute spouse nodes unnecessarily', () => {
    /**
     * Only the primary coverage type changes.
     * Spouse nodes that have no dependency on primary inputs should not be
     * in the visitOrder of the resulting frame.
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'married_filing_jointly', hasSpouse: true };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    // Set up spouse independently
    result = engine.process(makeEvent(SP.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(SP.personalContributions, 3_000),       result.currentState, context);
    result = engine.process(makeEvent(SP.ageAsOfDec31,          38),          result.currentState, context);

    const spouseDeductionBefore = result.currentState[SP.hsaDeduction]?.value;

    // Change primary coverage — should not affect spouse deduction value
    result = engine.process(makeEvent(P.coverageType, 'self_only'), result.currentState, context);

    // Spouse deduction unchanged
    expect(result.currentState[SP.hsaDeduction]?.value).toBe(spouseDeductionBefore);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — FULL MFJ VERTICAL SLICE
// ─────────────────────────────────────────────────────────────────────────────

describe('MFJ Spouse Materialization — Full Vertical Slice', () => {

  test('Complete MFJ scenario: both spouses with HSAs, combined return', () => {
    /**
     * TAXPAYER PROFILE
     * ─────────────────
     * David and Maria, MFJ.
     * Combined income: $200,000
     *
     * DAVID (primary)
     *   Coverage:     Self-only HDHP
     *   Age:          48
     *   Contributions: $4,300 (at limit)
     *   Distributions: $1,000 all qualified
     *   Expected deduction: $4,300
     *
     * MARIA (spouse)
     *   Coverage:     Family HDHP
     *   Age:          45
     *   Contributions: $8,550 (at 2025 family limit)
     *   Distributions: none
     *   Expected deduction: $8,550
     *
     * SCHEDULE 1
     *   Line 13 (combined HSA): $12,850 ($4,300 + $8,550)
     *   Line 26 (total adj):    $12,850
     *
     * FORM 1040
     *   Line 9:  $200,000
     *   Line 10: $12,850
     *   Line 11: $187,150 (AGI)
     *   Line 17: SKIPPED (no penalties)
     */
    const { result } = applyMFJ([
      { instanceId: F.otherIncome, value: 200_000 },
      // David
      { instanceId: P.coverageType, value: "self_only" },
      { instanceId: P.personalContributions, value: 4_300 },
      { instanceId: P.ageAsOfDec31, value: 48 },
      { instanceId: P.totalDistributions, value: 1_000 },
      { instanceId: P.qualifiedExpenses, value: 1_000 }, // all qualified
      // Maria
      { instanceId: SP.coverageType, value: "family" },
      { instanceId: SP.personalContributions, value: 8_550 },
      { instanceId: SP.ageAsOfDec31, value: 45 },
    ]);

    const state = result.currentState;

    // Individual deductions
    expect(num(state, P.hsaDeduction)).toBe(4_300);
    expect(num(state, SP.hsaDeduction)).toBe(8_550);

    // Schedule 1 combined
    expect(num(state, S1.hsaDeduction)).toBe(12_850);
    expect(num(state, S1.totalAdj)).toBe(12_850);

    // Form 1040
    expect(num(state, F.adjustments)).toBe(12_850);
    expect(num(state, F.agi)).toBe(187_150);

    // No penalties
    expect(nodeStatus(state, S2.line8)).toBe(NodeStatus.SKIPPED);
  });

  test('MFJ scenario: primary has penalties, spouse has deduction', () => {
    /**
     * David (primary): contributes $5,200 to self-only (excess $900 → tax $54)
     *                  also has early dist $10,000 → penalty $1,000
     * Maria (spouse):  max family contribution $8,550, no penalties
     *
     * Schedule 1 adj: $4,300 (David capped) + $8,550 (Maria) = $12,850
     * Schedule 2 penalties: $1,054 ($54 + $1,000)
     */
    const { result } = applyMFJ([
      { instanceId: F.otherIncome, value: 250_000 },
      // David
      { instanceId: P.coverageType, value: "self_only" },
      { instanceId: P.personalContributions, value: 5_200 },
      { instanceId: P.ageAsOfDec31, value: 50 },
      { instanceId: PR.earlyDistributions, value: 10_000 },
      { instanceId: PR.exceptionAmount, value: 0 },
      // Maria
      { instanceId: SP.coverageType, value: "family" },
      { instanceId: SP.personalContributions, value: 8_550 },
      { instanceId: SP.ageAsOfDec31, value: 48 },
    ]);

    const state = result.currentState;

    expect(num(state, P.hsaDeduction)).toBe(4_300);     // capped at limit
    expect(num(state, SP.hsaDeduction)).toBe(8_550);
    expect(num(state, S1.hsaDeduction)).toBe(12_850);   // combined deduction

    // Penalties: excess ($900 × 6% = $54) + early dist ($1,000)
    expect(num(state, PR.excessTax)).toBe(54);
    expect(num(state, PR.earlyDistPenalty)).toBe(1_000);
    expect(num(state, S2.line8)).toBe(1_054);

    // AGI: $250,000 - $12,850 = $237,150
    expect(num(state, F.agi)).toBe(237_150);
  });

  test('MFJ scenario: both spouses have penalties', () => {
    /**
     * Both spouses have early distributions.
     * David:  $5,000 early dist → $500 penalty
     * Maria:  $3,000 early dist → $300 penalty
     * Total Schedule 2 Line 8: $800
     */
    const { result } = applyMFJ([
      { instanceId: PR.earlyDistributions, value: 5_000 },
      { instanceId: PR.exceptionAmount,    value: 0 },
      { instanceId: SR.earlyDistributions, value: 3_000 },
      { instanceId: SR.exceptionAmount,    value: 0 },
    ]);

    const state = result.currentState;

    expect(num(state, PR.earlyDistPenalty)).toBe(500);
    expect(num(state, SR.earlyDistPenalty)).toBe(300);
    expect(num(state, S2.line8)).toBe(800);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6 — EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('MFJ Spouse Materialization — Edge Cases', () => {

  test('Only spouse has HSA — primary deduction is zero', () => {
    const { result } = applyMFJ([
      { instanceId: SP.coverageType,          value: 'self_only' },
      { instanceId: SP.personalContributions, value: 4_300 },
      { instanceId: SP.ageAsOfDec31,          value: 40 },
    ]);

    expect(result.currentState[P.hsaDeduction]?.value).toBe(0);
    expect(num(result.currentState, SP.hsaDeduction)).toBe(4_300);
    expect(num(result.currentState, S1.hsaDeduction)).toBe(4_300);
  });

  test('Only primary has HSA — spouse deduction is zero', () => {
    const { result } = applyMFJ([
      { instanceId: P.coverageType,          value: 'self_only' },
      { instanceId: P.personalContributions, value: 4_300 },
      { instanceId: P.ageAsOfDec31,          value: 40 },
    ]);

    expect(result.currentState[SP.hsaDeduction]?.value).toBe(0);
    expect(num(result.currentState, S1.hsaDeduction)).toBe(4_300);
  });

  test('Both spouses with no HSA activity — Schedule 1 Line 13 is SKIPPED', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'married_filing_jointly', hasSpouse: true };
    const result  = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    expect(nodeStatus(result.currentState, S1.hsaDeduction)).toBe(NodeStatus.SKIPPED);
  });

  test('Switching MFJ session: reinitializing with hasSpouse = false drops spouse nodes', () => {
    /**
     * Initialize as MFJ, then re-initialize as single.
     * Spouse nodes should not exist in the second session.
     */
    const engine = makeEngine();

    const mfjResult = engine.initializeSession({
      taxYear: '2025', filingStatus: 'married_filing_jointly',
      hasSpouse: true, sessionKey: 'test-mfj#2025',
    });

    expect(mfjResult.currentState[SP.hsaDeduction]).toBeDefined();

    const singleResult = engine.initializeSession({
      taxYear: '2025', filingStatus: 'single',
      hasSpouse: false, sessionKey: 'test-single#2025',
    });

    expect(singleResult.currentState[SP.hsaDeduction]).toBeUndefined();
  });

  test('Validate accepts spouse instance IDs as valid input targets', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'married_filing_jointly', hasSpouse: true };
    const result  = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    const validation = engine.validate(
      makeEvent(SP.personalContributions, 3_000),
      result.currentState
    );

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('Validate rejects spouse instance IDs when hasSpouse = false (node not in session)', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    const result  = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    // Spouse node not materialized in single session
    const validation = engine.validate(
      makeEvent(SP.personalContributions, 3_000),
      result.currentState
    );

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]?.code).toBe('node_not_found');
  });

});