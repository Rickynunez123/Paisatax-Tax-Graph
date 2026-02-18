/**
 * FORM 5329 — INTEGRATION TESTS
 *
 * These tests cover two things that have never been tested before:
 *
 * 1. CROSS-FORM DEPENDENCIES
 *    Form 5329 Part VII reads directly from Form 8889 node values.
 *    The engine must resolve these dependencies correctly —
 *    changing a Form 8889 input must propagate through to Form 5329.
 *    If the architecture holds, these tests pass without any special wiring.
 *
 * 2. REAL TAX SCENARIOS
 *    Each test is a situation a preparer will actually encounter:
 *    over-contributions, partial corrections, early withdrawal penalties,
 *    and the interaction between what was contributed vs. what was allowed.
 *
 * IMPORTANT: All tests register BOTH F8889_NODES and F5329_NODES.
 * The engine validates cross-form dependencies at registerNodes() time.
 */

import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { F8889_NODES }        from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }        from '../../src/tax/forms/f5329/nodes';
import { InputEventSource }   from '../../src/core/graph/engine.types';
import { NodeStatus }         from '../../src/core/graph/node.types';
import type { InputEvent }    from '../../src/core/graph/engine.types';

// ─────────────────────────────────────────────────────────────────────────────
// TEST HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeEngine() {
  const engine = new TaxGraphEngineImpl();
  // Register both forms together — required because f5329 depends on f8889 nodes
  engine.registerNodes([...F8889_NODES, ...F5329_NODES]);
  return engine;
}

function makeEvent(instanceId: string, value: string | number | boolean): InputEvent {
  return { instanceId, value, source: InputEventSource.PREPARER, timestamp: new Date().toISOString() };
}

function applyEvents(
  events:       { instanceId: string; value: string | number | boolean }[],
  taxYear:      string = '2025',
  filingStatus: string = 'single'
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

// Node ID shorthands — F8889
const H = {
  coverageType:           'f8889.primary.line1_coverageType',
  personalContributions:  'f8889.primary.line2_personalContributions',
  annualLimit:            'f8889.primary.line3_annualContributionLimit',
  ageAsOfDec31:           'f8889.primary.line4input_ageAsOfDec31',
  employerContributions:  'f8889.primary.line6_employerContributions',
  hsaDeduction:           'f8889.primary.line13_hsaDeduction',
  totalDistributions:     'f8889.primary.line14a_totalDistributions',
  qualifiedExpenses:      'f8889.primary.line16_qualifiedMedicalExpenses',
  nonQualifiedDist:       'f8889.primary.line17a_nonQualifiedDistributions',
  hsaPenalty:             'f8889.primary.line17b_additionalTax',
  isDisabled:             'f8889.primary.line17b_input_isDisabled',
};

// Node ID shorthands — F5329 Part I
const R = {
  earlyDistributions:  'f5329.primary.line1_earlyDistributions',
  exceptionCode:       'f5329.primary.line2_exceptionCode',
  exceptionAmount:     'f5329.primary.line2_exceptionAmount',
  amountSubjectToTax:  'f5329.primary.line3_amountSubjectToTax',
  earlyDistPenalty:    'f5329.primary.line4_additionalTax',
};

// Node ID shorthands — F5329 Part VII
const X = {
  priorYearExcess:     'f5329.primary.line43_priorYearExcess',
  currentContribs:     'f5329.primary.line44_currentYearContributions',
  fundingDists:        'f5329.primary.line45_fundingDistributions',
  maxAllowable:        'f5329.primary.line46_maximumAllowableContribution',
  adjustedExcess:      'f5329.primary.line47_adjustedExcess',
  excessWithdrawn:     'f5329.primary.line48_excessWithdrawn',
  taxableExcess:       'f5329.primary.line49_taxableExcess',
  excessTax:           'f5329.primary.line49_excessTax',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — CROSS-FORM DEPENDENCY WIRING
// These tests prove the engine resolves cross-form dependencies correctly.
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 5329 — Cross-Form Dependency Wiring', () => {

  test('Engine registers both forms without error', () => {
    // If this fails, there is an undeclared dependency or a cycle
    expect(() => makeEngine()).not.toThrow();
  });

  test('F5329 Line 46 reflects F8889 Line 13 deduction correctly', () => {
    /**
     * Maria contributed $4,300 (exactly the 2025 self-only limit).
     * F8889 Line 13 = $4,300.
     * F5329 Line 46 should mirror this: max allowable = $4,300.
     * No excess — excess tax = $0.
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 4_300 },
      { instanceId: H.ageAsOfDec31,          value: 35 },
    ]);

    expect(getNum(state, H.hsaDeduction)).toBe(4_300);       // F8889 Line 13 — personal deduction
    expect(getNum(state, X.maxAllowable)).toBe(4_300);        // F5329 Line 46 = F8889 Line 5 (annual limit = $4,300 self-only)
    expect(getNum(state, X.currentContribs)).toBe(4_300);     // personal only, no employer
    expect(getNum(state, X.adjustedExcess)).toBe(0);          // no excess
    expect(getNum(state, X.taxableExcess)).toBe(0);
    expect(getNum(state, X.excessTax)).toBe(0);
  });

  test('Changing F8889 coverage type propagates through to F5329 excess calculation', () => {
    /**
     * This is the critical cross-form reactivity test.
     *
     * Start: self-only coverage, $4,300 contribution (at limit — no excess)
     * Change: switch to family coverage
     * Result: F8889 Line 13 jumps to $4,300 (same, still under $8,550 family limit)
     *         F5329 Line 46 also stays $4,300
     *         No excess in either case.
     *
     * Then add more contributions to create excess:
     * Total contributions $9,000 > family limit $8,550 → excess = $450
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    // Step 1: self-only, $4,300 contributed (at limit)
    result = engine.process(makeEvent(H.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(H.personalContributions, 4_300),       result.currentState, context);
    result = engine.process(makeEvent(H.ageAsOfDec31,          40),          result.currentState, context);

    expect(result.currentState[X.adjustedExcess]?.value).toBe(0);

    // Step 2: switch to family, increase contribution to $9,000
    result = engine.process(makeEvent(H.coverageType,          'family'), result.currentState, context);
    result = engine.process(makeEvent(H.personalContributions, 9_000),    result.currentState, context);

    // Family limit is $8,550. Contributed $9,000.
    // F8889 Line 13 = min($9,000, $8,550) = $8,550
    // F5329 Line 46 (max allowable) = $8,550
    // F5329 Line 44 (total contributions) = $9,000
    // F5329 Line 47 (excess) = $9,000 - $8,550 = $450
    expect(result.currentState[H.hsaDeduction]?.value).toBe(8_550);
    expect(result.currentState[X.maxAllowable]?.value).toBe(8_550);
    expect(result.currentState[X.currentContribs]?.value).toBe(9_000);
    expect(result.currentState[X.adjustedExcess]?.value).toBe(450);
    expect(result.currentState[X.taxableExcess]?.value).toBe(450);
    expect(result.currentState[X.excessTax]?.value).toBe(27); // 450 * 6%
  });

  test('F5329 Line 44 includes both personal and employer contributions', () => {
    /**
     * The TOTAL going into the HSA matters for excess calculation —
     * not just what the taxpayer personally contributed.
     *
     * Employer contributed $2,000 (W-2 Box 12 Code W)
     * Taxpayer contributed $3,000 personally
     * Total into HSA = $5,000
     *
     * Self-only limit = $4,300
     * F8889 Line 13: allowed deduction = min($3,000, $4,300 - $2,000) = $2,300
     * F5329 Line 44: total contributions = $5,000 (personal + employer)
     * F5329 Line 46: max allowable = $2,300 (the actual deduction allowed)
     *
     * Wait — Line 46 reads from F8889 Line 13 which already accounts for
     * employer contributions. Let's verify the excess is computed correctly.
     *
     * Excess = total contributions ($5,000) - max allowable ($4,300 limit) ...
     *
     * Actually per IRS instructions, Line 46 = the contribution LIMIT (not the deduction).
     * The limit is $4,300 for self-only (before employer contribution adjustment).
     * But F8889 Line 13 = min(personal contributions, adjusted limit after employer).
     *
     * This is a known nuance: for excess purposes, we compare TOTAL contributions
     * (personal + employer) against the ANNUAL LIMIT (not the adjusted deduction).
     *
     * IRS Form 5329 Part VII instructions: "Enter the amount from Form 8889, line 6."
     * reads Line 6 for employer and Line 2 for personal into Line 44,
     * then compares against the Line 3/5 limit, not Line 13.
     *
     * This test documents the correct behavior: no excess when total ≤ annual limit.
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 2_300 },
      { instanceId: H.ageAsOfDec31,          value: 40 },
      { instanceId: H.employerContributions, value: 2_000 },
    ]);

    // Total into HSA = $4,300 (= self-only limit exactly) → no excess
    expect(getNum(state, X.currentContribs)).toBe(4_300);  // 2300 + 2000
    expect(getNum(state, X.adjustedExcess)).toBe(0);
    expect(getNum(state, X.excessTax)).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — PART VII: HSA EXCESS CONTRIBUTION SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 5329 Part VII — HSA Excess Contributions', () => {

  test('Scenario: No excess — contributed exactly the limit', () => {
    /**
     * Self-only, contributed exactly $4,300. Zero excess.
     *   Line 44: $4,300
     *   Line 46: $4,300 (allowed = limit)
     *   Line 47: $0
     *   Line 49 tax: $0
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 4_300 },
      { instanceId: H.ageAsOfDec31,          value: 35 },
    ]);

    expect(getNum(state, X.adjustedExcess)).toBe(0);
    expect(getNum(state, X.taxableExcess)).toBe(0);
    expect(getNum(state, X.excessTax)).toBe(0);
  });

  test('Scenario: Excess contribution — no withdrawal — 6% penalty applies', () => {
    /**
     * Ana contributed $5,000 to her self-only HSA.
     * 2025 limit: $4,300. Excess: $700.
     * She did NOT withdraw the excess before the deadline.
     *
     *   Line 44: $5,000
     *   Line 46: $4,300 (= F8889 Line 13)
     *   Line 47: $700 (excess)
     *   Line 48: $0  (not withdrawn)
     *   Line 49 taxable excess: $700
     *   Line 49 tax: $42 ($700 × 6%)
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 5_000 },
      { instanceId: H.ageAsOfDec31,          value: 30 },
    ]);

    expect(getNum(state, X.currentContribs)).toBe(5_000);
    expect(getNum(state, X.maxAllowable)).toBe(4_300);
    expect(getNum(state, X.adjustedExcess)).toBe(700);
    expect(getNum(state, X.taxableExcess)).toBe(700);
    expect(getNum(state, X.excessTax)).toBe(42);   // 700 × 6% = 42
  });

  test('Scenario: Excess contribution — fully withdrawn before deadline — no penalty', () => {
    /**
     * Same as above, but Ana withdrew all $700 excess before April 15.
     *
     *   Line 47: $700 (gross excess)
     *   Line 48: $700 (withdrawn)
     *   Line 49: $0  (no taxable excess)
     *   Tax: $0
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 5_000 },
      { instanceId: H.ageAsOfDec31,          value: 30 },
      { instanceId: X.excessWithdrawn,        value: 700 },
    ]);

    expect(getNum(state, X.adjustedExcess)).toBe(700);
    expect(getNum(state, X.taxableExcess)).toBe(0);
    expect(getNum(state, X.excessTax)).toBe(0);
  });

  test('Scenario: Excess contribution — partially withdrawn — penalty on remainder', () => {
    /**
     * Ana contributed $5,000, excess = $700.
     * She withdrew $300 before the deadline.
     * Remaining taxable excess = $400.
     * Penalty = $24 ($400 × 6%).
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 5_000 },
      { instanceId: H.ageAsOfDec31,          value: 30 },
      { instanceId: X.excessWithdrawn,        value: 300 },
    ]);

    expect(getNum(state, X.taxableExcess)).toBe(400);
    expect(getNum(state, X.excessTax)).toBe(24);  // 400 × 6%
  });

  test('Scenario: Age 57 catch-up reduces excess — higher limit absorbs more', () => {
    /**
     * Robert, 57, contributed $5,200.
     * Without catch-up: limit = $4,300, excess = $900
     * With catch-up: limit = $5,300, excess = $0 (under limit)
     *
     * The catch-up contribution is built into F8889 Line 13 which feeds
     * F5329 Line 46. So the whole chain updates when age is set.
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 5_200 },
      { instanceId: H.ageAsOfDec31,          value: 57 },
    ]);

    // With catch-up: limit = $5,300 > $5,200 contributed → no excess
    expect(getNum(state, H.hsaDeduction)).toBe(5_200);  // F8889 Line 13: min($5,200, $5,300) = $5,200
    expect(getNum(state, X.maxAllowable)).toBe(5_300);  // F5329 Line 46: annual limit (Line 5) = $5,300
    expect(getNum(state, X.adjustedExcess)).toBe(0);    // $5,200 contributed < $5,300 limit
    expect(getNum(state, X.excessTax)).toBe(0);
  });

  test('Scenario: Age 57, contributed over catch-up limit — penalty applies', () => {
    /**
     * Robert, 57, contributed $5,600 (over $5,300 limit).
     * Excess: $5,600 - $5,300 = $300.
     * Penalty: $18 ($300 × 6%).
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 5_600 },
      { instanceId: H.ageAsOfDec31,          value: 57 },
    ]);

    expect(getNum(state, X.adjustedExcess)).toBe(300);
    expect(getNum(state, X.excessTax)).toBe(18);  // 300 × 6%
  });

  test('Scenario: Large excess — penalty scales correctly', () => {
    /**
     * Someone contributed $8,550 (family limit) to a self-only plan.
     * Excess: $8,550 - $4,300 = $4,250.
     * Penalty: $255 ($4,250 × 6%).
     */
    const state = applyEvents([
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 8_550 },
      { instanceId: H.ageAsOfDec31,          value: 40 },
    ]);

    expect(getNum(state, X.adjustedExcess)).toBe(4_250);
    expect(getNum(state, X.excessTax)).toBe(255);  // 4250 × 6%
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — PART I: EARLY DISTRIBUTION PENALTY
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 5329 Part I — Early Distribution Penalty', () => {

  test('Scenario: Full early distribution — no exception — 10% penalty', () => {
    /**
     * Carlos, 45, withdrew $10,000 from his 401(k) early.
     * No exception applies. Full 10% penalty.
     *
     *   Line 1: $10,000
     *   Line 2: $0 (no exception)
     *   Line 3: $10,000
     *   Line 4: $1,000 (10% penalty)
     */
    const state = applyEvents([
      { instanceId: R.earlyDistributions, value: 10_000 },
      { instanceId: R.exceptionAmount,    value: 0 },
      { instanceId: R.exceptionCode,      value: '12' },
    ]);

    expect(getNum(state, R.amountSubjectToTax)).toBe(10_000);
    expect(getNum(state, R.earlyDistPenalty)).toBe(1_000);  // 10%
  });

  test('Scenario: Full exception applies — no penalty', () => {
    /**
     * Disability exception (Code 02) covers the full distribution.
     *   Line 1: $10,000
     *   Line 2: $10,000 (full exception)
     *   Line 3: $0
     *   Line 4: $0
     */
    const state = applyEvents([
      { instanceId: R.earlyDistributions, value: 10_000 },
      { instanceId: R.exceptionCode,      value: '02' },
      { instanceId: R.exceptionAmount,    value: 10_000 },
    ]);

    expect(getNum(state, R.amountSubjectToTax)).toBe(0);
    expect(getNum(state, R.earlyDistPenalty)).toBe(0);
  });

  test('Scenario: Partial exception — penalty on remainder', () => {
    /**
     * First-time home purchase (Code 08): exception limited to $10,000 lifetime.
     * But the distribution was $15,000.
     * $10,000 is excepted. $5,000 is penalized.
     *
     *   Line 1: $15,000
     *   Line 2: $10,000 (home purchase exception)
     *   Line 3: $5,000
     *   Line 4: $500 (10% of $5,000)
     */
    const state = applyEvents([
      { instanceId: R.earlyDistributions, value: 15_000 },
      { instanceId: R.exceptionCode,      value: '08' },
      { instanceId: R.exceptionAmount,    value: 10_000 },
    ]);

    expect(getNum(state, R.amountSubjectToTax)).toBe(5_000);
    expect(getNum(state, R.earlyDistPenalty)).toBe(500);
  });

  test('Scenario: No early distribution — all lines are zero', () => {
    const state = applyEvents([
      { instanceId: R.earlyDistributions, value: 0 },
    ]);

    expect(getNum(state, R.amountSubjectToTax)).toBe(0);
    expect(getNum(state, R.earlyDistPenalty)).toBe(0);
  });

  test('Exception amount cannot create negative subject-to-tax (capped at 0)', () => {
    /**
     * If somehow the exception amount exceeds the distribution,
     * the taxable amount should be 0, not negative.
     */
    const state = applyEvents([
      { instanceId: R.earlyDistributions, value: 5_000 },
      { instanceId: R.exceptionAmount,    value: 6_000 }, // exceeds distribution
    ]);

    expect(getNum(state, R.amountSubjectToTax)).toBe(0);
    expect(getNum(state, R.earlyDistPenalty)).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — COMBINED SCENARIOS (Both F8889 and F5329 active)
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 5329 — Combined F8889 + F5329 Scenarios', () => {

  test('Taxpayer has both excess HSA contributions AND an early retirement distribution', () => {
    /**
     * Full scenario: all penalties on one return.
     *
     * Sofia, 45:
     *   - Contributed $5,500 to her self-only HSA (excess = $1,200)
     *   - Took $8,000 early from her IRA (no exception)
     *
     * Expected:
     *   F8889 Line 13:  $4,300 (HSA deduction, capped at limit)
     *   F5329 Line 49 tax: $72 ($1,200 × 6% = $72)
     *   F5329 Line 4:  $800 ($8,000 × 10% = $800)
     */
    const state = applyEvents([
      // F8889 inputs
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 5_500 },
      { instanceId: H.ageAsOfDec31,          value: 45 },
      // F5329 Part I inputs
      { instanceId: R.earlyDistributions,    value: 8_000 },
      { instanceId: R.exceptionAmount,       value: 0 },
    ]);

    // F8889 results
    expect(getNum(state, H.hsaDeduction)).toBe(4_300);

    // F5329 Part VII results
    expect(getNum(state, X.adjustedExcess)).toBe(1_200);   // 5500 - 4300
    expect(getNum(state, X.taxableExcess)).toBe(1_200);
    expect(getNum(state, X.excessTax)).toBe(72);            // 1200 × 6%

    // F5329 Part I results
    expect(getNum(state, R.amountSubjectToTax)).toBe(8_000);
    expect(getNum(state, R.earlyDistPenalty)).toBe(800);    // 8000 × 10%
  });

  test('Reactivity: correcting HSA contribution mid-session eliminates excess penalty', () => {
    /**
     * Preparer initially enters $5,500 contribution (excess = $1,200, penalty = $72).
     * Then corrects it to $4,300 (exactly at limit).
     * All downstream nodes should update: excess = 0, penalty = 0.
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    result = engine.process(makeEvent(H.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(H.personalContributions, 5_500),       result.currentState, context);
    result = engine.process(makeEvent(H.ageAsOfDec31,          35),          result.currentState, context);

    // Initial state: excess penalty
    expect(result.currentState[X.excessTax]?.value).toBe(72);

    // Preparer corrects the contribution
    result = engine.process(makeEvent(H.personalContributions, 4_300), result.currentState, context);

    // Everything should update reactively
    expect(result.currentState[H.hsaDeduction]?.value).toBe(4_300);
    expect(result.currentState[X.adjustedExcess]?.value).toBe(0);
    expect(result.currentState[X.taxableExcess]?.value).toBe(0);
    expect(result.currentState[X.excessTax]?.value).toBe(0);
  });

  test('All form nodes are CLEAN after complete inputs provided', () => {
    const state = applyEvents([
      // F8889
      { instanceId: H.coverageType,          value: 'self_only' },
      { instanceId: H.personalContributions, value: 4_000 },
      { instanceId: H.ageAsOfDec31,          value: 40 },
      { instanceId: H.employerContributions, value: 0 },
      { instanceId: H.totalDistributions,    value: 0 },
      { instanceId: H.qualifiedExpenses,     value: 0 },
      { instanceId: H.isDisabled,            value: false },
      // F5329 Part I
      { instanceId: R.earlyDistributions,    value: 0 },
      { instanceId: R.exceptionCode,         value: '12' },
      { instanceId: R.exceptionAmount,       value: 0 },
      // F5329 Part VII
      { instanceId: X.priorYearExcess,       value: 0 },
      { instanceId: X.excessWithdrawn,       value: 0 },
    ]);

    const allComputedNodes = [
      // F8889
      H.annualLimit, H.hsaDeduction,
      // F5329 Part I
      R.amountSubjectToTax, R.earlyDistPenalty,
      // F5329 Part VII
      X.currentContribs, X.fundingDists, X.maxAllowable,
      X.adjustedExcess, X.taxableExcess, X.excessTax,
    ];

    for (const nodeId of allComputedNodes) {
      expect(state[nodeId]?.status).toBe(NodeStatus.CLEAN);
    }
  });

});