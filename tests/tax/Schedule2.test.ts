/**
 * SCHEDULE 2 — INTEGRATION TESTS
 *
 * These tests prove three things that no previous test suite has covered:
 *
 * 1. FULL CHAIN — source form → penalty form → aggregator → Form 1040
 *    A change to Form 8889 (HSA contribution) flows all the way through
 *    Form 5329 (excess penalty) to Schedule 2 Line 44 (total additional taxes).
 *    This is the complete vertical slice of the tax computation graph.
 *
 * 2. TOLERANT AGGREGATION
 *    Schedule 2 Line 44 must produce a valid sum even when some source
 *    nodes are SKIPPED (form not applicable) or UNSUPPORTED.
 *    Missing lines contribute 0, not null or NaN.
 *
 * 3. isApplicable BEHAVIOR
 *    Lines like Line 8 and Line 17b are SKIPPED when their source values
 *    are zero. This keeps the Schedule 2 clean — lines only appear
 *    when there is actual tax owed on them.
 *
 * All tests register all three form node sets together.
 */

import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { F8889_NODES }        from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }        from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE2_NODES }    from '../../src/tax/forms/schedule2/nodes';
import { SCHEDULE2_OUTPUTS }  from '../../src/tax/forms/schedule2/nodes';
import { InputEventSource }   from '../../src/core/graph/engine.types';
import { NodeStatus }         from '../../src/core/graph/node.types';
import type { InputEvent }    from '../../src/core/graph/engine.types';

// ─────────────────────────────────────────────────────────────────────────────
// TEST HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ALL_NODES = [...F8889_NODES, ...F5329_NODES, ...SCHEDULE2_NODES];

function makeEngine() {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes(ALL_NODES);
  return engine;
}

function makeEvent(instanceId: string, value: string | number | boolean): InputEvent {
  return { instanceId, value, source: InputEventSource.PREPARER, timestamp: new Date().toISOString() };
}

function applyEvents(
  events:       { instanceId: string; value: string | number | boolean }[],
  taxYear:      string = '2025',
  filingStatus: string = 'single',
) {
  const engine  = makeEngine();
  const context = { taxYear, filingStatus, hasSpouse: false };
  let result    = engine.initializeSession({ ...context, sessionKey: `test#${taxYear}` });
  for (const e of events) {
    result = engine.process(makeEvent(e.instanceId, e.value), result.currentState, context);
  }
  return result.currentState;
}

function getNum(state: ReturnType<typeof applyEvents>, nodeId: string): number {
  const snap = state[nodeId];
  if (!snap) throw new Error(`Node not found: ${nodeId}`);
  if (typeof snap.value !== 'number') throw new Error(`Expected number for ${nodeId}, got ${snap.value}`);
  return snap.value;
}

function getStatus(state: ReturnType<typeof applyEvents>, nodeId: string): string {
  return state[nodeId]?.status ?? 'not_found';
}

// Node ID shorthands
const H = {
  coverageType:          'f8889.primary.line1_coverageType',
  personalContributions: 'f8889.primary.line2_personalContributions',
  ageAsOfDec31:          'f8889.primary.line4input_ageAsOfDec31',
  employerContributions: 'f8889.primary.line6_employerContributions',
  hsaDeduction:          'f8889.primary.line13_hsaDeduction',
  totalDistributions:    'f8889.primary.line14a_totalDistributions',
  qualifiedExpenses:     'f8889.primary.line16_qualifiedMedicalExpenses',
  additionalTax:         'f8889.primary.line17b_additionalTax',
  isDisabled:            'f8889.primary.line17b_input_isDisabled',
};
const R = {
  earlyDistributions:  'f5329.primary.line1_earlyDistributions',
  exceptionAmount:     'f5329.primary.line2_exceptionAmount',
  earlyDistPenalty:    'f5329.primary.line4_additionalTax',
  excessWithdrawn:     'f5329.primary.line48_excessWithdrawn',
  excessTax:           'f5329.primary.line49_excessTax',
};
const S = {
  line1:  'schedule2.joint.line1_alternativeMinimumTax',
  line2:  'schedule2.joint.line2_excessPremiumTaxCredit',
  line3:  'schedule2.joint.line3_subtotal',
  line8:  'schedule2.joint.line8_additionalRetirementTax',
  line17b:'schedule2.joint.line17b_hsaDistributionTax',
  line44: 'schedule2.joint.line44_totalAdditionalTaxes',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule 2 — Registration', () => {

  test('All three form node sets register together without error', () => {
    expect(() => makeEngine()).not.toThrow();
  });

  test('Schedule 2 Line 44 exists in the graph after registration', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    const init    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });
    expect(init.currentState[S.line44]).toBeDefined();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — TOLERANT AGGREGATION
// Schedule 2 must produce valid totals even when source lines are SKIPPED
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule 2 — Tolerant Aggregation', () => {

  test('Line 44 is 0 when no penalties exist (clean return)', () => {
    /**
     * Simple return: HSA contribution at limit, no distributions, no early withdrawal.
     * No penalties → all Schedule 2 source lines are 0 or SKIPPED.
     * Line 44 should be 0, not null or NaN.
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 4_300 },
      { instanceId: H.ageAsOfDec31,          value: 40 },
    ]);

    expect(getNum(state, S.line44)).toBe(0);
  });

  test('Line 8 is SKIPPED when all Form 5329 penalties are zero', () => {
    /**
     * No early distributions, no excess HSA contributions.
     * isApplicable() returns false → Line 8 = SKIPPED.
     * This keeps the Schedule 2 clean for simple returns.
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 4_000 },
      { instanceId: H.ageAsOfDec31,          value: 40 },
    ]);

    expect(getStatus(state, S.line8)).toBe(NodeStatus.SKIPPED);
  });

  test('Line 17b is SKIPPED when Form 8889 HSA penalty is zero', () => {
    /**
     * All distributions were qualified → 20% penalty = 0.
     * isApplicable() returns false → Line 17b = SKIPPED.
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 3_000 },
      { instanceId: H.ageAsOfDec31,          value: 40 },
      { instanceId: H.totalDistributions,    value: 1_000 },
      { instanceId: H.qualifiedExpenses,     value: 1_000 }, // fully qualified
    ]);

    expect(getStatus(state, S.line17b)).toBe(NodeStatus.SKIPPED);
  });

  test('Line 44 correctly sums SKIPPED lines as zero', () => {
    /**
     * Line 8 = SKIPPED (no retirement penalties)
     * Line 17b = SKIPPED (no HSA distribution penalty)
     * Line 44 should still be 0 — not null, not NaN, not an error.
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 4_000 },
      { instanceId: H.ageAsOfDec31,          value: 40 },
    ]);

    expect(getNum(state, S.line44)).toBe(0);
    expect(getStatus(state, S.line44)).toBe(NodeStatus.CLEAN);
  });

  test('Line 44 includes manually entered unsupported lines (AMT, premium credit)', () => {
    /**
     * The preparer manually enters values for unsupported lines.
     * Line 44 should include them in the total.
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 4_300 },
      { instanceId: H.ageAsOfDec31,          value: 40 },
      { instanceId: S.line1,                 value: 500 },  // AMT entered manually
      { instanceId: S.line2,                 value: 200 },  // premium credit entered manually
    ]);

    expect(getNum(state, S.line3)).toBe(700);   // 500 + 200
    expect(getNum(state, S.line44)).toBe(700);  // all other lines SKIPPED
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — FULL CHAIN TESTS
// F8889 → F5329 → Schedule 2 → Line 44
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule 2 — Full Chain: F8889 → F5329 → Schedule 2', () => {

  test('Full chain: HSA excess contribution penalty flows to Line 44', () => {
    /**
     * Ana contributed $5,000 to her self-only HSA (2025 limit: $4,300).
     * Excess: $700. Penalty: $42 (6%).
     *
     * Full chain:
     *   F8889 Line 2:  $5,000 (personal contributions — input)
     *   F8889 Line 13: $4,300 (allowed deduction — capped at limit)
     *   F5329 Line 44: $5,000 (total contributions)
     *   F5329 Line 46: $4,300 (max allowable from F8889 Line 5)
     *   F5329 Line 47: $700  (excess)
     *   F5329 Line 49: $700  (taxable excess)
     *   F5329 Line 49 tax: $42 (6% penalty)
     *   Schedule 2 Line 8:  $42 (from F5329)
     *   Schedule 2 Line 44: $42 (total)
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 5_000 },
      { instanceId: H.ageAsOfDec31,          value: 30 },
    ]);

    expect(getNum(state, H.hsaDeduction)).toBe(4_300);      // F8889 capped
    expect(getNum(state, R.excessTax)).toBe(42);             // F5329: $700 × 6%
    expect(getNum(state, S.line8)).toBe(42);                 // Schedule 2 Line 8
    expect(getNum(state, S.line44)).toBe(42);                // Schedule 2 Line 44
  });

  test('Full chain: early distribution penalty flows to Line 44', () => {
    /**
     * Carlos, 45, took $10,000 early from his 401(k) — no exception.
     * 10% penalty: $1,000.
     *
     *   F5329 Line 4:      $1,000 (10% penalty)
     *   Schedule 2 Line 8: $1,000
     *   Schedule 2 Line 44: $1,000
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.ageAsOfDec31,          value: 45 },
      { instanceId: R.earlyDistributions,    value: 10_000 },
      { instanceId: R.exceptionAmount,       value: 0 },
    ]);

    expect(getNum(state, R.earlyDistPenalty)).toBe(1_000);
    expect(getNum(state, S.line8)).toBe(1_000);
    expect(getNum(state, S.line44)).toBe(1_000);
  });

  test('Full chain: HSA non-qualified distribution penalty flows to Line 44', () => {
    /**
     * Sofia, 45, withdrew $2,000 from her HSA and spent $0 on medical.
     * 20% penalty: $400.
     *
     *   F8889 Line 17b:     $400 (20% penalty)
     *   Schedule 2 Line 17b: $400
     *   Schedule 2 Line 44:  $400
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.ageAsOfDec31,          value: 45 },
      { instanceId: H.personalContributions, value: 3_000 },
      { instanceId: H.totalDistributions,    value: 2_000 },
      { instanceId: H.qualifiedExpenses,     value: 0 },
    ]);

    expect(getNum(state, H.additionalTax)).toBe(400);
    expect(getNum(state, S.line17b)).toBe(400);
    expect(getNum(state, S.line44)).toBe(400);
  });

  test('Full chain: all three penalties combined on one return', () => {
    /**
     * The worst-case scenario: everything goes wrong at once.
     *
     * David, 45:
     *   - Contributed $5,500 to self-only HSA (excess $1,200 → $72 penalty)
     *   - Withdrew $1,000 from HSA for non-medical ($200 penalty)
     *   - Took $5,000 early from IRA, no exception ($500 penalty)
     *   - Manually entered AMT of $300
     *
     * Expected totals:
     *   Line 3  (AMT subtotal):       $300
     *   Line 8  (F5329 penalties):    $572  ($72 excess + $500 early dist)
     *   Line 17b (F8889 HSA penalty): $200
     *   Line 44 (total):             $1,072
     */
    const state = applyEvents([
      // F8889 inputs
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 5_500 },
      { instanceId: H.ageAsOfDec31,          value: 45 },
      { instanceId: H.totalDistributions,    value: 1_000 },
      { instanceId: H.qualifiedExpenses,     value: 0 },
      // F5329 inputs
      { instanceId: R.earlyDistributions,    value: 5_000 },
      { instanceId: R.exceptionAmount,       value: 0 },
      // Schedule 2 manually entered
      { instanceId: S.line1,                 value: 300 },   // AMT
    ]);

    // Verify each source
    expect(getNum(state, R.excessTax)).toBe(72);       // HSA excess: $1,200 × 6%
    expect(getNum(state, R.earlyDistPenalty)).toBe(500); // Early dist: $5,000 × 10%
    expect(getNum(state, H.additionalTax)).toBe(200);   // HSA dist: $1,000 × 20%

    // Verify Schedule 2 aggregation
    expect(getNum(state, S.line3)).toBe(300);            // AMT
    expect(getNum(state, S.line8)).toBe(572);            // $72 + $500
    expect(getNum(state, S.line17b)).toBe(200);
    expect(getNum(state, S.line44)).toBe(1_072);         // $300 + $572 + $200
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — FULL CHAIN REACTIVITY
// When a source form input changes, the change propagates all the way
// through to Schedule 2 Line 44.
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule 2 — Full Chain Reactivity', () => {

  test('Correcting HSA over-contribution eliminates penalty from Line 44', () => {
    /**
     * Start: $5,000 contribution → $700 excess → $42 penalty → Schedule 2 = $42
     * Fix:   $4,300 contribution → $0 excess → $0 penalty → Schedule 2 = $0
     *
     * This is four levels of propagation:
     *   F8889 Line 2 (input changed)
     *   → F8889 Line 13 (recomputed)
     *   → F5329 Line 46 (recomputed via cross-form dep)
     *   → F5329 Lines 47, 49, 49 tax (recomputed)
     *   → Schedule 2 Line 8 (recomputed, isApplicable flips to false → SKIPPED)
     *   → Schedule 2 Line 44 (recomputed → $0)
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    result = engine.process(makeEvent(H.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(H.personalContributions, 5_000),       result.currentState, context);
    result = engine.process(makeEvent(H.ageAsOfDec31,          30),          result.currentState, context);

    // Initial state: penalty present
    expect(result.currentState[S.line8]?.value).toBe(42);
    expect(result.currentState[S.line44]?.value).toBe(42);

    // Preparer corrects the contribution
    result = engine.process(makeEvent(H.personalContributions, 4_300), result.currentState, context);

    // All downstream updates
    expect(result.currentState[H.hsaDeduction]?.value).toBe(4_300);
    expect(result.currentState[R.excessTax]?.value).toBe(0);
    expect(result.currentState[S.line8]?.status).toBe(NodeStatus.SKIPPED); // isApplicable = false now
    expect(result.currentState[S.line44]?.value).toBe(0);
  });

  test('Adding early distribution mid-session adds to Line 44', () => {
    /**
     * Start: no penalties at all. Line 44 = 0, Line 8 = SKIPPED.
     * Add: $10,000 early distribution. Line 8 becomes CLEAN = $1,000.
     * Line 44 jumps from 0 to $1,000.
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    result = engine.process(makeEvent(H.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(H.personalContributions, 4_000),       result.currentState, context);
    result = engine.process(makeEvent(H.ageAsOfDec31,          40),          result.currentState, context);

    // No penalties yet
    expect(result.currentState[S.line8]?.status).toBe(NodeStatus.SKIPPED);
    expect(result.currentState[S.line44]?.value).toBe(0);

    // Add early distribution
    result = engine.process(makeEvent(R.earlyDistributions, 10_000), result.currentState, context);
    result = engine.process(makeEvent(R.exceptionAmount,    0),      result.currentState, context);

    // Line 8 activates, Line 44 updates
    expect(result.currentState[S.line8]?.status).toBe(NodeStatus.CLEAN);
    expect(result.currentState[S.line8]?.value).toBe(1_000);
    expect(result.currentState[S.line44]?.value).toBe(1_000);
  });

  test('Exception code update on early distribution updates Line 44', () => {
    /**
     * Start: $10,000 early distribution, no exception. Penalty = $1,000.
     * Update: add full disability exception. Penalty drops to $0.
     * Line 44 drops from $1,000 to $0.
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    result = engine.process(makeEvent(H.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(H.ageAsOfDec31,          45),          result.currentState, context);
    result = engine.process(makeEvent(R.earlyDistributions,    10_000),      result.currentState, context);
    result = engine.process(makeEvent(R.exceptionAmount,       0),           result.currentState, context);

    expect(result.currentState[S.line44]?.value).toBe(1_000);

    // Preparer adds disability exception
    result = engine.process(makeEvent(R.exceptionAmount, 10_000), result.currentState, context);

    expect(result.currentState[S.line8]?.status).toBe(NodeStatus.SKIPPED); // isApplicable = false
    expect(result.currentState[S.line44]?.value).toBe(0);
  });

  test('Penalty from 2024 uses 2024 constants throughout the chain', () => {
    /**
     * Verify the full chain uses 2024 constants for a 2024 return.
     * Self-only limit in 2024 is $4,150 (not $4,300).
     * Contributing $5,000 to a 2024 self-only HSA → excess = $850 → penalty = $51
     */
    const engine  = makeEngine();
    const context = { taxYear: '2024', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2024' });

    result = engine.process(makeEvent(H.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(H.personalContributions, 5_000),       result.currentState, context);
    result = engine.process(makeEvent(H.ageAsOfDec31,          30),          result.currentState, context);

    // 2024: self-only limit $4,150, excess = $850, penalty = $51
    expect(result.currentState[H.hsaDeduction]?.value).toBe(4_150);
    expect(result.currentState[R.excessTax]?.value).toBe(51);    // 850 × 6%
    expect(result.currentState[S.line8]?.value).toBe(51);
    expect(result.currentState[S.line44]?.value).toBe(51);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — CHAIN INTEGRITY
// Structural tests: are the right things connected?
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule 2 — Chain Integrity', () => {

  test('Line 44 is CLEAN after a full set of inputs is provided', () => {
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 4_000 },
      { instanceId: H.ageAsOfDec31,          value: 40 },
      { instanceId: H.employerContributions, value: 0 },
      { instanceId: H.totalDistributions,    value: 0 },
      { instanceId: H.qualifiedExpenses,     value: 0 },
      { instanceId: H.isDisabled,            value: false },
      { instanceId: R.earlyDistributions,    value: 0 },
      { instanceId: R.exceptionAmount,       value: 0 },
    ]);

    expect(getStatus(state, S.line44)).toBe(NodeStatus.CLEAN);
    expect(getNum(state, S.line44)).toBe(0);
  });

  test('Line 44 value matches sum of its active source lines', () => {
    /**
     * When multiple lines have values, Line 44 = sum of active lines.
     * We verify the arithmetic directly.
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 5_000 }, // excess $700 → $42
      { instanceId: H.ageAsOfDec31,          value: 40 },
      { instanceId: H.totalDistributions,    value: 500 },
      { instanceId: H.qualifiedExpenses,     value: 0 },     // $500 non-qualified → $100 penalty
      { instanceId: R.earlyDistributions,    value: 3_000 }, // $3,000 × 10% = $300
      { instanceId: R.exceptionAmount,       value: 0 },
    ]);

    const line8   = getNum(state, S.line8);   // F5329: $42 + $300 = $342
    const line17b = getNum(state, S.line17b); // F8889: $100
    const line44  = getNum(state, S.line44);

    // Line 44 must equal the sum of its active parts
    expect(line44).toBe(line8 + line17b);
  });

  test('Schedule 2 output ID matches SCHEDULE2_OUTPUTS constant', () => {
    /**
     * Ensure the exported constant matches the actual node ID.
     * If someone renames the node but forgets to update the export,
     * Form 1040 would silently read from a non-existent node.
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 5_000 },
      { instanceId: H.ageAsOfDec31,          value: 30 },
    ]);

    expect(state[SCHEDULE2_OUTPUTS.totalAdditionalTaxes]).toBeDefined();
    expect(state[SCHEDULE2_OUTPUTS.totalAdditionalTaxes]?.status).toBe(NodeStatus.CLEAN);
  });

});