/**
 * FORM 8889 — INTEGRATION TESTS
 *
 * Tests real HSA tax scenarios end to end through the engine.
 * Every test reflects a situation a preparer will actually encounter.
 *
 * Each test includes:
 *   - The scenario in plain English (who is this taxpayer?)
 *   - The input values (what the preparer enters)
 *   - The expected output (what the IRS form should show)
 *   - The IRS citation (why this is correct)
 *
 * These tests fail if the constants change — that is intentional.
 * When IRS limits change for a new year, update constants/{year}.ts
 * and add a corresponding test scenario for the new year.
 */

import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { F8889_NODES }        from '../../src/tax/forms/f8889/nodes';
import { InputEventSource }   from '../../src/core/graph/engine.types';
import { NodeStatus }         from '../../src/core/graph/node.types';
import type { InputEvent }    from '../../src/core/graph/engine.types';

// ─────────────────────────────────────────────────────────────────────────────
// TEST HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeEngine() {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes(F8889_NODES);
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
  events:      { instanceId: string; value: string | number | boolean }[],
  taxYear:     string = '2025',
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
  coverageType:                 'f8889.primary.line1_coverageType',
  personalContributions:        'f8889.primary.line2_personalContributions',
  annualLimit:                  'f8889.primary.line3_annualContributionLimit',
  ageAsOfDec31:                 'f8889.primary.line4input_ageAsOfDec31',
  catchUpContribution:          'f8889.primary.line4_additionalCatchUpContribution',
  totalLimit:                   'f8889.primary.line5_totalLimit',
  employerContributions:        'f8889.primary.line6_employerContributions',
  employerAdjusted:             'f8889.primary.line9_employerContributionsAdjusted',
  adjustedLimit:                'f8889.primary.line10_adjustedContributionLimit',
  fundingDistribution:          'f8889.primary.line11_qualifiedFundingDistribution',
  maxPersonalContribution:      'f8889.primary.line12_maxPersonalContribution',
  hsaDeduction:                 'f8889.primary.line13_hsaDeduction',
  totalDistributions:           'f8889.primary.line14a_totalDistributions',
  rolloverDistributions:        'f8889.primary.line14b_rolloverDistributions',
  includibleDistributions:      'f8889.primary.line15_includibleDistributions',
  qualifiedExpenses:            'f8889.primary.line16_qualifiedMedicalExpenses',
  nonQualifiedDistributions:    'f8889.primary.line17a_nonQualifiedDistributions',
  isDisabled:                   'f8889.primary.line17b_input_isDisabled',
  additionalTax:                'f8889.primary.line17b_additionalTax',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — PART I: BASIC CONTRIBUTION AND DEDUCTION
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8889 Part I — Contributions and Deduction', () => {

  test('Scenario: Single filer, self-only HDHP, contributes exactly the limit (2025)', () => {
    /**
     * Maria, 35, single.
     * Self-only HDHP coverage all year.
     * Contributed exactly $4,300 — the 2025 self-only limit.
     * No employer contributions.
     * Expected deduction: $4,300 (she contributed the max, gets the max)
     *
     * IRS Form 8889 Part I:
     *   Line 1: Self-only
     *   Line 2: $4,300
     *   Line 3: $4,300 (2025 self-only limit)
     *   Line 13: $4,300
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 4_300 },
      { instanceId: N.ageAsOfDec31,          value: 35 },
    ]);

    expect(getNum(state, N.annualLimit)).toBe(4_300);
    expect(getNum(state, N.catchUpContribution)).toBe(0);
    expect(getNum(state, N.totalLimit)).toBe(4_300);
    expect(getNum(state, N.adjustedLimit)).toBe(4_300);
    expect(getNum(state, N.maxPersonalContribution)).toBe(4_300);
    expect(getNum(state, N.hsaDeduction)).toBe(4_300);
  });

  test('Scenario: Family coverage, contributed under the limit (2025)', () => {
    /**
     * John, 42, married filing jointly, family HDHP.
     * Contributed $5,000 out of a possible $8,550.
     * No employer contributions.
     * Expected deduction: $5,000 (he contributed less than the max)
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'family' },
      { instanceId: N.personalContributions, value: 5_000 },
      { instanceId: N.ageAsOfDec31,          value: 42 },
    ]);

    expect(getNum(state, N.annualLimit)).toBe(8_550);
    expect(getNum(state, N.totalLimit)).toBe(8_550);
    expect(getNum(state, N.hsaDeduction)).toBe(5_000); // limited by what he actually contributed
  });

  test('Scenario: Over-contribution — deduction capped at annual limit', () => {
    /**
     * Ana contributed $5,000 but the 2025 self-only limit is $4,300.
     * The deduction is capped at $4,300 — she has a $700 excess contribution
     * that would be subject to a 6% excise tax on Form 5329.
     * (Form 5329 handles the penalty — Form 8889 Line 13 just caps the deduction.)
     *
     * IRS Form 8889 Line 13: lesser of Line 2 ($5,000) and Line 12 ($4,300) = $4,300
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 5_000 },
      { instanceId: N.ageAsOfDec31,          value: 30 },
    ]);

    expect(getNum(state, N.hsaDeduction)).toBe(4_300); // capped at limit
    expect(getNum(state, N.maxPersonalContribution)).toBe(4_300);
  });

  test('Scenario: Age 55+ catch-up contribution', () => {
    /**
     * Robert, 57, self-only HDHP.
     * Contributed $5,300 (= $4,300 annual + $1,000 catch-up).
     * Expected deduction: $5,300
     *
     * IRS Form 8889:
     *   Line 3: $4,300
     *   Line 4: $1,000 (catch-up eligible, age 57 ≥ 55)
     *   Line 5: $5,300
     *   Line 13: $5,300
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 5_300 },
      { instanceId: N.ageAsOfDec31,          value: 57 },
    ]);

    expect(getNum(state, N.catchUpContribution)).toBe(1_000);
    expect(getNum(state, N.totalLimit)).toBe(5_300);
    expect(getNum(state, N.hsaDeduction)).toBe(5_300);
  });

  test('Scenario: Age exactly 55 — qualifies for catch-up', () => {
    /**
     * Edge case: taxpayer turns 55 on December 31 of the tax year.
     * Per IRC §223(b)(3), they qualify if they are 55 "by the close of the tax year."
     * December 31 IS the close — age 55 on Dec 31 qualifies.
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 5_300 },
      { instanceId: N.ageAsOfDec31,          value: 55 },
    ]);

    expect(getNum(state, N.catchUpContribution)).toBe(1_000);
  });

  test('Scenario: Age 54 — does NOT qualify for catch-up', () => {
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 4_300 },
      { instanceId: N.ageAsOfDec31,          value: 54 },
    ]);

    expect(getNum(state, N.catchUpContribution)).toBe(0);
    expect(getNum(state, N.totalLimit)).toBe(4_300);
  });

  test('Scenario: Employer contributions reduce the deductible amount', () => {
    /**
     * Lisa's employer contributed $2,000 to her HSA (W-2 Box 12 Code W).
     * She also personally contributed $2,000.
     * Self-only coverage, age 40.
     *
     * 2025 limit: $4,300
     * Employer contributions reduce the limit she can personally deduct:
     *   Line 10: $4,300 - $2,000 = $2,300
     *   Line 13: min($2,000, $2,300) = $2,000
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 2_000 },
      { instanceId: N.ageAsOfDec31,          value: 40 },
      { instanceId: N.employerContributions, value: 2_000 },
    ]);

    expect(getNum(state, N.employerAdjusted)).toBe(2_000);
    expect(getNum(state, N.adjustedLimit)).toBe(2_300);   // 4300 - 2000
    expect(getNum(state, N.hsaDeduction)).toBe(2_000);    // she contributed 2000, limit is 2300
  });

  test('Scenario: Employer contributions exceed limit — deduction is zero', () => {
    /**
     * Employer contributed $5,000 but limit is $4,300.
     * The taxpayer cannot deduct anything (and has an excess employer contribution).
     *
     * Line 10: max(0, $4,300 - $5,000) = $0
     * Line 13: min($0, $0) = $0
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 0 },
      { instanceId: N.ageAsOfDec31,          value: 40 },
      { instanceId: N.employerContributions, value: 5_000 },
    ]);

    expect(getNum(state, N.adjustedLimit)).toBe(0);
    expect(getNum(state, N.hsaDeduction)).toBe(0);
  });

  test('Scenario: No contributions — deduction is zero', () => {
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 0 },
      { instanceId: N.ageAsOfDec31,          value: 30 },
    ]);

    expect(getNum(state, N.hsaDeduction)).toBe(0);
  });

  test('Scenario: Same limits apply correctly for 2024', () => {
    /**
     * Verify 2024 constants are used when taxYear is 2024.
     * Self-only limit in 2024 is $4,150 (not $4,300).
     */
    const engine  = makeEngine();
    const context = { taxYear: '2024', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2024' });

    result = engine.process(makeEvent(N.coverageType, 'self_only'),   result.currentState, context);
    result = engine.process(makeEvent(N.personalContributions, 4_300), result.currentState, context);
    result = engine.process(makeEvent(N.ageAsOfDec31, 35),            result.currentState, context);

    // 2024 limit is $4,150 — deduction capped at $4,150 even though she contributed $4,300
    expect(result.currentState[N.annualLimit]?.value).toBe(4_150);
    expect(result.currentState[N.hsaDeduction]?.value).toBe(4_150);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — PART II: DISTRIBUTIONS AND PENALTY
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8889 Part II — Distributions', () => {

  test('Scenario: All distributions are qualified — no taxable income, no penalty', () => {
    /**
     * Carlos took $3,000 out of his HSA and spent it all on qualified
     * medical expenses. Zero taxable distribution. Zero penalty.
     *
     *   Line 14a: $3,000
     *   Line 15:  $3,000
     *   Line 16:  $3,000 (all qualified)
     *   Line 17a: $0
     *   Line 17b: $0
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 3_000 },
      { instanceId: N.ageAsOfDec31,          value: 40 },
      { instanceId: N.totalDistributions,    value: 3_000 },
      { instanceId: N.qualifiedExpenses,     value: 3_000 },
    ]);

    expect(getNum(state, N.includibleDistributions)).toBe(3_000);
    expect(getNum(state, N.nonQualifiedDistributions)).toBe(0);
    expect(getNum(state, N.additionalTax)).toBe(0);
  });

  test('Scenario: Partial non-qualified distribution — penalty applies', () => {
    /**
     * Sofia took $2,000 from her HSA. $1,500 was for medical expenses.
     * $500 was used for non-medical purposes.
     *
     *   Line 14a: $2,000
     *   Line 15:  $2,000
     *   Line 16:  $1,500
     *   Line 17a: $500  (non-qualified)
     *   Line 17b: $100  ($500 × 20% penalty)
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 2_000 },
      { instanceId: N.ageAsOfDec31,          value: 40 },
      { instanceId: N.totalDistributions,    value: 2_000 },
      { instanceId: N.qualifiedExpenses,     value: 1_500 },
    ]);

    expect(getNum(state, N.nonQualifiedDistributions)).toBe(500);
    expect(getNum(state, N.additionalTax)).toBe(100); // 500 * 20%
  });

  test('Scenario: 100% non-qualified distribution — full penalty', () => {
    /**
     * David withdrew $1,000 and spent none of it on medical expenses.
     *   Line 17a: $1,000
     *   Line 17b: $200 ($1,000 × 20%)
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.ageAsOfDec31,          value: 40 },
      { instanceId: N.totalDistributions,    value: 1_000 },
      { instanceId: N.qualifiedExpenses,     value: 0 },
    ]);

    expect(getNum(state, N.nonQualifiedDistributions)).toBe(1_000);
    expect(getNum(state, N.additionalTax)).toBe(200);
  });

  test('Scenario: Age 65+ — no penalty even for non-qualified distributions', () => {
    /**
     * Helen, 67, took $1,000 from her HSA for non-medical expenses.
     * At age 65+ the 20% penalty does not apply (still owe income tax, but no penalty).
     *
     *   Line 17a: $1,000 (still taxable income)
     *   Line 17b: $0    (penalty waived — age 65+)
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.ageAsOfDec31,          value: 67 },
      { instanceId: N.totalDistributions,    value: 1_000 },
      { instanceId: N.qualifiedExpenses,     value: 0 },
    ]);

    expect(getNum(state, N.nonQualifiedDistributions)).toBe(1_000); // still taxable
    expect(getNum(state, N.additionalTax)).toBe(0);                  // no penalty
  });

  test('Scenario: Age exactly 65 — penalty waived', () => {
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.ageAsOfDec31,          value: 65 },
      { instanceId: N.totalDistributions,    value: 1_000 },
      { instanceId: N.qualifiedExpenses,     value: 0 },
    ]);

    expect(getNum(state, N.additionalTax)).toBe(0);
  });

  test('Scenario: Disabled taxpayer — 20% penalty waived', () => {
    /**
     * Marco, 45, is disabled under IRC §72(m)(7).
     * Took $1,000 for non-medical expenses.
     * Penalty is waived due to disability — same as age 65+ exception.
     *
     *   Line 17a: $1,000 (taxable)
     *   Line 17b: $0    (waived — disability exception)
     */
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.ageAsOfDec31,          value: 45 },
      { instanceId: N.isDisabled,            value: true },
      { instanceId: N.totalDistributions,    value: 1_000 },
      { instanceId: N.qualifiedExpenses,     value: 0 },
    ]);

    expect(getNum(state, N.nonQualifiedDistributions)).toBe(1_000);
    expect(getNum(state, N.additionalTax)).toBe(0);
  });

  test('Scenario: Rollover excludes distributions from penalty', () => {
    /**
     * Emma took $5,000 from her old HSA and rolled it over within 60 days to a new one.
     * The rollover is excluded from the calculation.
     *   Line 14a: $5,000
     *   Line 14b: $5,000 (rollover)
     *   Line 15:  $0
     *   Line 17a: $0
     *   Line 17b: $0
     */
    const state = applyEvents([
      { instanceId: N.coverageType,           value: 'self_only' },
      { instanceId: N.ageAsOfDec31,           value: 40 },
      { instanceId: N.totalDistributions,     value: 5_000 },
      { instanceId: N.rolloverDistributions,  value: 5_000 },
      { instanceId: N.qualifiedExpenses,      value: 0 },
    ]);

    expect(getNum(state, N.includibleDistributions)).toBe(0);
    expect(getNum(state, N.nonQualifiedDistributions)).toBe(0);
    expect(getNum(state, N.additionalTax)).toBe(0);
  });

  test('Scenario: Partial rollover — only non-rolled portion subject to penalty', () => {
    /**
     *   Total distributions: $3,000
     *   Rolled over:         $1,000
     *   Net includible:      $2,000
     *   Qualified expenses:  $1,200
     *   Non-qualified:       $800
     *   Penalty:             $160 ($800 × 20%)
     */
    const state = applyEvents([
      { instanceId: N.coverageType,           value: 'self_only' },
      { instanceId: N.ageAsOfDec31,           value: 40 },
      { instanceId: N.totalDistributions,     value: 3_000 },
      { instanceId: N.rolloverDistributions,  value: 1_000 },
      { instanceId: N.qualifiedExpenses,      value: 1_200 },
    ]);

    expect(getNum(state, N.includibleDistributions)).toBe(2_000);
    expect(getNum(state, N.nonQualifiedDistributions)).toBe(800);
    expect(getNum(state, N.additionalTax)).toBe(160);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — REACTIVE UPDATES
// Verify the engine correctly recomputes when values change
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8889 — Reactive Updates', () => {

  test('Changing coverage type from self_only to family updates all downstream nodes', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    // Start with self-only
    result = engine.process(makeEvent(N.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(N.personalContributions, 4_300),       result.currentState, context);
    result = engine.process(makeEvent(N.ageAsOfDec31,          40),          result.currentState, context);

    expect(result.currentState[N.annualLimit]?.value).toBe(4_300);
    expect(result.currentState[N.hsaDeduction]?.value).toBe(4_300);

    // Switch to family coverage
    result = engine.process(makeEvent(N.coverageType, 'family'), result.currentState, context);

    // Annual limit should now be $8,550 and deduction stays at $4,300
    // (taxpayer only contributed $4,300 — now they're under the limit)
    expect(result.currentState[N.annualLimit]?.value).toBe(8_550);
    expect(result.currentState[N.totalLimit]?.value).toBe(8_550);
    expect(result.currentState[N.adjustedLimit]?.value).toBe(8_550);
    expect(result.currentState[N.hsaDeduction]?.value).toBe(4_300); // min(4300, 8550)
  });

  test('Adding employer contributions mid-session reduces the deduction correctly', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    result = engine.process(makeEvent(N.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(N.personalContributions, 3_000),       result.currentState, context);
    result = engine.process(makeEvent(N.ageAsOfDec31,          40),          result.currentState, context);

    // Initially: deduction = $3,000 (under limit)
    expect(result.currentState[N.hsaDeduction]?.value).toBe(3_000);

    // Now add employer contributions
    result = engine.process(makeEvent(N.employerContributions, 2_000), result.currentState, context);

    // Adjusted limit: $4,300 - $2,000 = $2,300
    // Deduction: min($3,000, $2,300) = $2,300
    expect(result.currentState[N.adjustedLimit]?.value).toBe(2_300);
    expect(result.currentState[N.hsaDeduction]?.value).toBe(2_300);
  });

  test('Catch-up eligibility changes correctly when age is updated', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    result = engine.process(makeEvent(N.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(N.personalContributions, 5_300),       result.currentState, context);
    result = engine.process(makeEvent(N.ageAsOfDec31,          57),          result.currentState, context);

    // Age 57: catch-up eligible
    expect(result.currentState[N.catchUpContribution]?.value).toBe(1_000);
    expect(result.currentState[N.hsaDeduction]?.value).toBe(5_300);

    // Preparer corrects the age — taxpayer is actually 54
    result = engine.process(makeEvent(N.ageAsOfDec31, 54), result.currentState, context);

    // No longer catch-up eligible
    expect(result.currentState[N.catchUpContribution]?.value).toBe(0);
    expect(result.currentState[N.totalLimit]?.value).toBe(4_300);
    expect(result.currentState[N.hsaDeduction]?.value).toBe(4_300); // now capped
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — NODE STATUS
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8889 — Node Status', () => {

  test('All nodes are CLEAN after a complete set of inputs is provided', () => {
    const state = applyEvents([
      { instanceId: N.coverageType,          value: 'self_only' },
      { instanceId: N.personalContributions, value: 3_000 },
      { instanceId: N.ageAsOfDec31,          value: 40 },
      { instanceId: N.employerContributions, value: 0 },
      { instanceId: N.fundingDistribution,   value: 0 },
      { instanceId: N.totalDistributions,    value: 0 },
      { instanceId: N.rolloverDistributions, value: 0 },
      { instanceId: N.qualifiedExpenses,     value: 0 },
      { instanceId: N.isDisabled,            value: false },
    ]);

    const computedNodes = [
      N.annualLimit, N.catchUpContribution, N.totalLimit,
      N.employerAdjusted, N.adjustedLimit, N.maxPersonalContribution,
      N.hsaDeduction, N.includibleDistributions,
      N.nonQualifiedDistributions, N.additionalTax,
    ];

    for (const nodeId of computedNodes) {
      expect(state[nodeId]?.status).toBe(NodeStatus.CLEAN);
    }
  });

  test('Unsupported tax year — nodes are SKIPPED (not applicable for that year)', () => {
    /**
     * Nodes declare applicableTaxYears: ['2024', '2025'].
     * For tax year 2023, the engine correctly sets them to SKIPPED
     * before the compute function ever runs.
     *
     * SKIPPED is the correct behavior:
     *   - The preparer sees the node is not applicable, not an error
     *   - No incorrect constants are ever used
     *   - To support 2023, add '2023' to applicableTaxYears + constants/2023.ts
     */
    const engine  = makeEngine();
    const context = { taxYear: '2023', filingStatus: 'single', hasSpouse: false };
    const init    = engine.initializeSession({ ...context, sessionKey: 'test#2023' });

    const result = engine.process(
      makeEvent(N.coverageType, 'self_only'),
      init.currentState,
      context
    );

    expect(result.currentState[N.annualLimit]?.status).toBe(NodeStatus.SKIPPED);
    expect(result.currentState[N.annualLimit]?.value).toBe(null);
    expect(result.currentState[N.coverageType]?.status).toBe(NodeStatus.CLEAN);
  });

});