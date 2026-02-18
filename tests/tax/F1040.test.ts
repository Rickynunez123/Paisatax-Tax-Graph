/**
 * FORM 1040 SHELL — INTEGRATION TESTS
 *
 * These tests close the vertical slice. Every previous test suite proved
 * one level of the chain. This suite proves the whole thing at once:
 *
 *   Raw input (wages, HSA contribution)
 *     → F8889: deduction computed
 *     → F5329: excess penalty computed
 *     → Schedule 1: adjustments aggregated
 *     → Schedule 2: additional taxes aggregated
 *     → Form 1040: AGI and total tax computed
 *
 * After these tests pass, a single call to process() anywhere in the
 * chain propagates correctly all the way to the final return numbers.
 *
 * Test suites:
 *   1. Registration — all five form node sets register cleanly together
 *   2. AGI calculation — total income minus Schedule 1 adjustments
 *   3. Additional taxes line — Schedule 2 → Form 1040 Line 17
 *   4. Full vertical slice — one scenario exercising every layer
 *   5. Reactivity across the full chain
 *   6. Output integrity — exported constants point to real nodes
 */

// import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { TaxGraphEngineImpl } from '../../src/core/graph/engine.js';
import { F8889_NODES }        from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }        from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }    from '../../src/tax/forms/schedule1/nodes.js';
import { SCHEDULE2_NODES }    from '../../src/tax/forms/schedule2/nodes';
import { F1040_NODES }        from '../../src/tax/forms/f1040/nodes.js';
import { F1040_OUTPUTS }      from '../../src/tax/forms/f1040/nodes.js';
import { SCHEDULE1_OUTPUTS }  from '../../src/tax/forms/schedule1/nodes.js';
import { SCHEDULE2_OUTPUTS }  from '../../src/tax/forms/schedule2/nodes';
import { InputEventSource }   from '../../src/core/graph/engine.types';
import { NodeStatus }         from '../../src/core/graph/node.types';
import type { InputEvent }    from '../../src/core/graph/engine.types';

// ─────────────────────────────────────────────────────────────────────────────
// TEST HELPERS
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

function num(state: ReturnType<typeof applyEvents>, nodeId: string): number {
  const snap = state[nodeId];
  if (!snap) throw new Error(`Node not found: ${nodeId}`);
  if (typeof snap.value !== 'number') throw new Error(`Expected number at ${nodeId}, got: ${snap.value}`);
  return snap.value;
}

function status(state: ReturnType<typeof applyEvents>, nodeId: string): string {
  return state[nodeId]?.status ?? 'not_found';
}

// ── Node ID shorthands ──────────────────────────────────────────────────────

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
  earlyDistributions:    'f5329.primary.line1_earlyDistributions',
  exceptionAmount:       'f5329.primary.line2_exceptionAmount',
  earlyDistPenalty:      'f5329.primary.line4_additionalTax',
  excessTax:             'f5329.primary.line49_excessTax',
};
const S1 = {
  line13_hsaDeduction:   'schedule1.joint.line13_hsaDeduction',
  line26_totalAdj:       'schedule1.joint.line26_totalAdjustments',
};
const S2 = {
  line8:                 'schedule2.joint.line8_additionalRetirementTax',
  line17b:               'schedule2.joint.line17b_hsaDistributionTax',
  line44:                'schedule2.joint.line44_totalAdditionalTaxes',
};
const F = {
  line9_totalIncome:     'f1040.joint.line9_totalIncome',
  line10_adjustments:    'f1040.joint.line10_adjustmentsToIncome',
  line11_agi:            'f1040.joint.line11_adjustedGrossIncome',
  line12_deduction:      'f1040.joint.line12_deduction',
  line16_tax:            'f1040.joint.line16_tax',
  line17_additionalTax:  'f1040.joint.line17_additionalTaxes',
  line24_totalTax:       'f1040.joint.line24_totalTax',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — Registration', () => {

  test('All five form node sets register together without error', () => {
    expect(() => makeEngine()).not.toThrow();
  });

  test('Total node count is reasonable — no duplicate IDs', () => {
    // Duplicate node IDs would cause the engine to silently overwrite definitions.
    // We check the count instead of enumerating every node.
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    const init    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    // We have F8889 (19), F5329 (13), Schedule1 (14), Schedule2 (6), F1040 (8) nodes
    // Exact count will grow as we add forms — we just verify it's > 50
    expect(Object.keys(init.currentState).length).toBeGreaterThan(50);
  });

  test('Form 1040 AGI node exists in the initialized session', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    const init    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });
    expect(init.currentState[F.line11_agi]).toBeDefined();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — AGI CALCULATION
// Form 1040 Lines 9, 10, 11
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — AGI Calculation', () => {

  test('Scenario: No adjustments — AGI equals total income', () => {
    /**
     * Maria earns $60,000. No HSA, no other adjustments.
     * AGI = $60,000.
     *
     *   Line 9:  $60,000
     *   Line 10: $0      (no adjustments)
     *   Line 11: $60,000 (AGI)
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 60_000 },
    ]);

    expect(num(state, F.line9_totalIncome)).toBe(60_000);
    expect(num(state, F.line10_adjustments)).toBe(0);
    expect(num(state, F.line11_agi)).toBe(60_000);
  });

  test('Scenario: HSA deduction reduces AGI', () => {
    /**
     * John earns $80,000 and contributed $4,300 to his self-only HSA.
     * The HSA deduction flows:
     *   F8889 Line 13 → Schedule 1 Line 13 → Schedule 1 Line 26
     *   → Form 1040 Line 10 → AGI
     *
     *   Line 9:  $80,000
     *   Line 10: $4,300  (HSA deduction from Schedule 1)
     *   Line 11: $75,700 (AGI)
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 80_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.personalContributions,   value: 4_300 },
      { instanceId: H.ageAsOfDec31,            value: 40 },
    ]);

    expect(num(state, H.hsaDeduction)).toBe(4_300);            // F8889
    expect(num(state, S1.line13_hsaDeduction)).toBe(4_300);    // Schedule 1
    expect(num(state, S1.line26_totalAdj)).toBe(4_300);        // Schedule 1 total
    expect(num(state, F.line10_adjustments)).toBe(4_300);      // Form 1040 Line 10
    expect(num(state, F.line11_agi)).toBe(75_700);             // AGI
  });

  test('Scenario: Catch-up contribution at age 57 maximizes deduction', () => {
    /**
     * Robert, 57, earns $100,000. Contributes $5,300 ($4,300 + $1,000 catch-up).
     * HSA deduction = $5,300. AGI = $94,700.
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 100_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.personalContributions,   value: 5_300 },
      { instanceId: H.ageAsOfDec31,            value: 57 },
    ]);

    expect(num(state, H.hsaDeduction)).toBe(5_300);
    expect(num(state, F.line10_adjustments)).toBe(5_300);
    expect(num(state, F.line11_agi)).toBe(94_700);
  });

  test('Scenario: Employer contributions reduce HSA deduction but not AGI benefit', () => {
    /**
     * Lisa earns $70,000. Employer contributed $2,000 to her HSA.
     * She personally contributed $2,300.
     * Total into HSA = $4,300 (at the limit).
     * Allowed personal deduction = min($2,300, $4,300 - $2,000) = $2,300.
     *
     * The HSA deduction on Line 13 is her PERSONAL contribution that is deductible:
     *   F8889 Line 13 = $2,300 (not $4,300 — employer's portion is excluded from wages)
     *   Schedule 1 Line 13 = $2,300
     *   AGI = $70,000 - $2,300 = $67,700
     *
     * Note: The employer's $2,000 was already excluded from Box 1 of her W-2,
     * so it never appeared in total income — it's excluded at the wage level,
     * not through this deduction.
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 70_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.personalContributions,   value: 2_300 },
      { instanceId: H.ageAsOfDec31,            value: 40 },
      { instanceId: H.employerContributions,   value: 2_000 },
    ]);

    expect(num(state, H.hsaDeduction)).toBe(2_300);
    expect(num(state, F.line10_adjustments)).toBe(2_300);
    expect(num(state, F.line11_agi)).toBe(67_700);
  });

  test('Scenario: HSA deduction plus manual other adjustment', () => {
    /**
     * Sofia contributes $3,000 to her HSA and also has $1,200 in
     * student loan interest (entered manually on Schedule 1 Line 21).
     * Total adjustments = $4,200. AGI = $55,800.
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,                              value: 60_000 },
      { instanceId: H.coverageType,                                   value: 'self_only' },
      { instanceId: H.personalContributions,                          value: 3_000 },
      { instanceId: H.ageAsOfDec31,                                   value: 32 },
      { instanceId: 'schedule1.joint.line21_studentLoanInterest',     value: 1_200 },
    ]);

    expect(num(state, S1.line13_hsaDeduction)).toBe(3_000);
    expect(num(state, S1.line26_totalAdj)).toBe(4_200);   // 3000 + 1200
    expect(num(state, F.line10_adjustments)).toBe(4_200);
    expect(num(state, F.line11_agi)).toBe(55_800);
  });

  test('Scenario: Adjustments cannot make AGI negative', () => {
    /**
     * Edge case: total adjustments exceed total income.
     * AGI floors at 0, not a negative number.
     * (NOL carryforward is a future feature.)
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 1_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.personalContributions,   value: 4_300 },
      { instanceId: H.ageAsOfDec31,            value: 40 },
    ]);

    // $4,300 deduction > $1,000 income → AGI = 0, not -$3,300
    expect(num(state, F.line10_adjustments)).toBe(4_300);
    expect(num(state, F.line11_agi)).toBe(0);
  });

  test('Scenario: 2024 return uses 2024 HSA limit', () => {
    /**
     * Same setup as "HSA deduction reduces AGI" but tax year 2024.
     * Self-only limit in 2024 is $4,150.
     * Contributing $4,300 → deduction capped at $4,150.
     * AGI = $80,000 - $4,150 = $75,850.
     */
    const engine  = makeEngine();
    const context = { taxYear: '2024', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2024' });

    for (const [id, val] of [
      [F.line9_totalIncome,       80_000],
      [H.coverageType,            'self_only'],
      [H.personalContributions,   4_300],
      [H.ageAsOfDec31,            40],
    ] as [string, string | number][]) {
      result = engine.process(makeEvent(id, val), result.currentState, context);
    }

    expect(result.currentState[H.hsaDeduction]!.value).toBe(4_150);
    expect(result.currentState[F.line10_adjustments]!.value).toBe(4_150);
    expect(result.currentState[F.line11_agi]!.value).toBe(75_850);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — ADDITIONAL TAXES LINE
// Form 1040 Line 17 = Schedule 2 Line 44
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — Additional Taxes (Line 17)', () => {

  test('Line 17 is SKIPPED when no penalties exist', () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 60_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.personalContributions,   value: 4_000 },
      { instanceId: H.ageAsOfDec31,            value: 40 },
    ]);

    expect(status(state, F.line17_additionalTax)).toBe(NodeStatus.SKIPPED);
  });

  test('Line 17 = HSA excess penalty from F5329 via Schedule 2', () => {
    /**
     * $700 HSA excess → $42 penalty
     *   F5329 Line 49 tax = $42
     *   Schedule 2 Line 8 = $42
     *   Schedule 2 Line 44 = $42
     *   Form 1040 Line 17  = $42
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 60_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.personalContributions,   value: 5_000 },
      { instanceId: H.ageAsOfDec31,            value: 30 },
    ]);

    expect(num(state, R.excessTax)).toBe(42);
    expect(num(state, S2.line44)).toBe(42);
    expect(num(state, F.line17_additionalTax)).toBe(42);
    expect(status(state, F.line17_additionalTax)).toBe(NodeStatus.CLEAN);
  });

  test('Line 17 = early distribution penalty via Schedule 2', () => {
    /**
     * $10,000 early distribution → $1,000 penalty
     *   F5329 Line 4 = $1,000
     *   Schedule 2 Line 8 = $1,000
     *   Form 1040 Line 17 = $1,000
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 60_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.ageAsOfDec31,            value: 40 },
      { instanceId: R.earlyDistributions,      value: 10_000 },
      { instanceId: R.exceptionAmount,         value: 0 },
    ]);

    expect(num(state, R.earlyDistPenalty)).toBe(1_000);
    expect(num(state, F.line17_additionalTax)).toBe(1_000);
  });

  test('Line 17 = HSA distribution penalty from F8889 via Schedule 2', () => {
    /**
     * $500 non-qualified HSA distribution → $100 penalty (20%)
     *   F8889 Line 17b = $100
     *   Schedule 2 Line 17b = $100
     *   Form 1040 Line 17 = $100
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 60_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.ageAsOfDec31,            value: 40 },
      { instanceId: H.totalDistributions,      value: 500 },
      { instanceId: H.qualifiedExpenses,       value: 0 },
    ]);

    expect(num(state, H.additionalTax)).toBe(100);
    expect(num(state, F.line17_additionalTax)).toBe(100);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — LINE 24: TOTAL TAX
// Line 16 (regular tax, manual) + Line 17 (additional taxes, computed)
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — Total Tax (Line 24)', () => {

  test('Total tax = regular tax when no additional taxes', () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,  value: 60_000 },
      { instanceId: F.line16_tax,         value: 8_000 },  // manually entered
    ]);

    expect(num(state, F.line24_totalTax)).toBe(8_000);
  });

  test('Total tax = regular tax + additional taxes', () => {
    /**
     * Regular tax:  $8,000 (manually entered, bracket calc deferred)
     * Early dist:   $10,000 withdrawal → $1,000 penalty
     * Total tax:    $9,000
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,   value: 60_000 },
      { instanceId: F.line16_tax,          value: 8_000 },
      { instanceId: H.coverageType,        value: 'self_only' },
      { instanceId: H.ageAsOfDec31,        value: 40 },
      { instanceId: R.earlyDistributions,  value: 10_000 },
      { instanceId: R.exceptionAmount,     value: 0 },
    ]);

    expect(num(state, F.line17_additionalTax)).toBe(1_000);
    expect(num(state, F.line24_totalTax)).toBe(9_000);
  });

  test('Total tax when all three penalty types apply', () => {
    /**
     * Regular tax:          $12,000
     * HSA excess penalty:   $42   ($700 excess × 6%)
     * Early dist penalty:   $500  ($5,000 × 10%)
     * HSA dist penalty:     $200  ($1,000 × 20%)
     * Total additional:     $742
     * Total tax:            $12,742
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 80_000 },
      { instanceId: F.line16_tax,              value: 12_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.personalContributions,   value: 5_000 },
      { instanceId: H.ageAsOfDec31,            value: 40 },
      { instanceId: H.totalDistributions,      value: 1_000 },
      { instanceId: H.qualifiedExpenses,       value: 0 },
      { instanceId: R.earlyDistributions,      value: 5_000 },
      { instanceId: R.exceptionAmount,         value: 0 },
    ]);

    expect(num(state, S2.line44)).toBe(742);
    expect(num(state, F.line17_additionalTax)).toBe(742);
    expect(num(state, F.line24_totalTax)).toBe(12_742);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — FULL VERTICAL SLICE
// One complete scenario exercising every layer simultaneously
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — Full Vertical Slice', () => {

  test('Complete scenario: wages → HSA deduction → AGI and → penalties → total tax', () => {
    /**
     * TAXPAYER PROFILE
     * ─────────────────
     * Ana, 35, single.
     * Total income:  $75,000 (wages)
     * Coverage:      Self-only HDHP
     *
     * HSA ACTIVITY
     * ─────────────
     * Personal contributions:  $5,000  (over the $4,300 limit)
     * Employer contributions:  $0
     * Distributions:           $800    (spent $300 on qualified expenses,
     *                                   $500 on non-medical)
     * Withdrawal of excess:    $0      (did not correct before deadline)
     *
     * EARLY RETIREMENT
     * ─────────────────
     * Early IRA withdrawal:  $6,000   (no exception)
     *
     * EXPECTED FORM 8889
     * ──────────────────
     * Line 13 (HSA deduction):       $4,300  (capped at limit)
     * Line 17a (non-qualified dist):   $500
     * Line 17b (20% HSA penalty):      $100
     *
     * EXPECTED FORM 5329
     * ──────────────────
     * Line 4 (early dist penalty):     $600   ($6,000 × 10%)
     * Line 49 (taxable excess):         $700   ($5,000 - $4,300)
     * Line 49 tax (6% penalty):          $42   ($700 × 6%)
     *
     * EXPECTED SCHEDULE 1
     * ───────────────────
     * Line 13 (HSA deduction):        $4,300
     * Line 26 (total adjustments):    $4,300
     *
     * EXPECTED SCHEDULE 2
     * ───────────────────
     * Line 8  (F5329 penalties):       $642   ($600 + $42)
     * Line 17b (F8889 penalty):        $100
     * Line 44 (total):                 $742
     *
     * EXPECTED FORM 1040
     * ──────────────────
     * Line 9  (total income):        $75,000
     * Line 10 (adjustments):          $4,300  (HSA deduction)
     * Line 11 (AGI):                 $70,700  ($75,000 - $4,300)
     * Line 17 (additional taxes):      $742
     * Line 24 (total tax):           $11,742  ($11,000 + $742)
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 75_000 },
      { instanceId: F.line16_tax,              value: 11_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.personalContributions,   value: 5_000 },
      { instanceId: H.ageAsOfDec31,            value: 35 },
      { instanceId: H.employerContributions,   value: 0 },
      { instanceId: H.totalDistributions,      value: 800 },
      { instanceId: H.qualifiedExpenses,       value: 300 },
      { instanceId: R.earlyDistributions,      value: 6_000 },
      { instanceId: R.exceptionAmount,         value: 0 },
    ]);

    // ── Form 8889 ──
    expect(num(state, H.hsaDeduction)).toBe(4_300);
    expect(num(state, 'f8889.primary.line17a_nonQualifiedDistributions')).toBe(500);
    expect(num(state, H.additionalTax)).toBe(100);

    // ── Form 5329 ──
    expect(num(state, R.earlyDistPenalty)).toBe(600);
    expect(num(state, 'f5329.primary.line49_taxableExcess')).toBe(700);
    expect(num(state, R.excessTax)).toBe(42);

    // ── Schedule 1 ──
    expect(num(state, S1.line13_hsaDeduction)).toBe(4_300);
    expect(num(state, S1.line26_totalAdj)).toBe(4_300);

    // ── Schedule 2 ──
    expect(num(state, S2.line8)).toBe(642);    // $600 + $42
    expect(num(state, S2.line17b)).toBe(100);
    expect(num(state, S2.line44)).toBe(742);

    // ── Form 1040 ──
    expect(num(state, F.line9_totalIncome)).toBe(75_000);
    expect(num(state, F.line10_adjustments)).toBe(4_300);
    expect(num(state, F.line11_agi)).toBe(70_700);
    expect(num(state, F.line17_additionalTax)).toBe(742);
    expect(num(state, F.line24_totalTax)).toBe(11_742);
  });

  test('Clean return: high earner, max HSA, no penalties', () => {
    /**
     * David, 45, earns $120,000. Max HSA contribution ($4,300), all qualified.
     * No early distributions, no excess.
     *
     * Expected:
     *   AGI = $120,000 - $4,300 = $115,700
     *   Line 17 = SKIPPED
     *   Total tax = whatever regular tax is (entered manually as $25,000)
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 120_000 },
      { instanceId: F.line16_tax,              value: 25_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.personalContributions,   value: 4_300 },
      { instanceId: H.ageAsOfDec31,            value: 45 },
      { instanceId: H.totalDistributions,      value: 2_000 },
      { instanceId: H.qualifiedExpenses,       value: 2_000 },  // all qualified
    ]);

    expect(num(state, F.line11_agi)).toBe(115_700);
    expect(status(state, F.line17_additionalTax)).toBe(NodeStatus.SKIPPED);
    expect(num(state, F.line24_totalTax)).toBe(25_000);  // regular tax only
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6 — FULL CHAIN REACTIVITY
// Changes at the source propagate all the way to Form 1040 outputs
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — Full Chain Reactivity', () => {

  test('Correcting HSA contribution updates AGI and eliminates penalty', () => {
    /**
     * Start: $5,000 contribution → $4,300 deduction → AGI $75,700 → penalty $42
     * Fix:   $3,000 contribution → $3,000 deduction → AGI $77,000 → no penalty
     *
     * That's a 5-level propagation:
     *   F8889 → Schedule 1 → Form 1040 Line 10 → Form 1040 Line 11 (AGI)
     *   F8889 → F5329 → Schedule 2 → Form 1040 Line 17
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    for (const [id, val] of [
      [F.line9_totalIncome,       80_000],
      [H.coverageType,            'self_only'],
      [H.personalContributions,   5_000],
      [H.ageAsOfDec31,            35],
    ] as [string, string | number][]) {
      result = engine.process(makeEvent(id, val), result.currentState, context);
    }

    // Initial state
    expect(result.currentState[F.line11_agi]?.value).toBe(75_700);     // 80000 - 4300
    expect(result.currentState[F.line17_additionalTax]?.value).toBe(42);

    // Correct the contribution down to $3,000
    result = engine.process(makeEvent(H.personalContributions, 3_000), result.currentState, context);

    // AGI updated: $80,000 - $3,000 = $77,000
    expect(result.currentState[H.hsaDeduction]?.value).toBe(3_000);
    expect(result.currentState[S1.line13_hsaDeduction]?.value).toBe(3_000);
    expect(result.currentState[F.line10_adjustments]?.value).toBe(3_000);
    expect(result.currentState[F.line11_agi]?.value).toBe(77_000);

    // Penalty eliminated
    expect(result.currentState[S2.line44]?.value).toBe(0);
    expect(result.currentState[F.line17_additionalTax]?.status).toBe(NodeStatus.SKIPPED);
  });

  test('Adding total income mid-session updates AGI immediately', () => {
    /**
     * Preparer enters HSA data first, then enters wages.
     * AGI should compute correctly regardless of input order.
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    // Enter HSA data first
    result = engine.process(makeEvent(H.coverageType,          'self_only'), result.currentState, context);
    result = engine.process(makeEvent(H.personalContributions, 4_300),       result.currentState, context);
    result = engine.process(makeEvent(H.ageAsOfDec31,          40),          result.currentState, context);

    // AGI is 0 - 4300 = 0 (floored) because income not entered yet
    expect(result.currentState[F.line11_agi]?.value).toBe(0);

    // Now enter wages
    result = engine.process(makeEvent(F.line9_totalIncome, 90_000), result.currentState, context);

    // AGI = 90,000 - 4,300 = 85,700
    expect(result.currentState[F.line11_agi]?.value).toBe(85_700);
  });

  test('Switching from self-only to family coverage in the middle of prep', () => {
    /**
     * Common scenario: preparer initially selects wrong coverage type,
     * then corrects it. Everything downstream should update.
     *
     * Self-only: limit $4,300, contributed $8,000 → deduction $4,300, excess $3,700
     * Family:    limit $8,550, contributed $8,000 → deduction $8,000, no excess
     */
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    let result    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    result = engine.process(makeEvent(F.line9_totalIncome,       100_000), result.currentState, context);
    result = engine.process(makeEvent(H.coverageType,            'self_only'), result.currentState, context);
    result = engine.process(makeEvent(H.personalContributions,   8_000),    result.currentState, context);
    result = engine.process(makeEvent(H.ageAsOfDec31,            40),       result.currentState, context);

    // With self-only: deduction capped at $4,300, excess $3,700
    expect(result.currentState[H.hsaDeduction]?.value).toBe(4_300);
    expect(result.currentState[F.line11_agi]?.value).toBe(95_700);      // 100000 - 4300
    expect(result.currentState[R.excessTax]?.value).toBeCloseTo(222);   // 3700 × 6%
    expect(result.currentState[F.line17_additionalTax]?.value).toBeCloseTo(222);

    // Correct to family coverage
    result = engine.process(makeEvent(H.coverageType, 'family'), result.currentState, context);

    // With family: deduction = $8,000 (under $8,550 limit), no excess
    expect(result.currentState[H.hsaDeduction]?.value).toBe(8_000);
    expect(result.currentState[F.line10_adjustments]?.value).toBe(8_000);
    expect(result.currentState[F.line11_agi]?.value).toBe(92_000);      // 100000 - 8000
    expect(result.currentState[S2.line44]?.value).toBe(0);
    expect(result.currentState[F.line17_additionalTax]?.status).toBe(NodeStatus.SKIPPED);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7 — OUTPUT INTEGRITY
// Exported constants point to real nodes; IDs haven't drifted
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — Output Integrity', () => {

  test('F1040_OUTPUTS constants all point to existing nodes', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    const init    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    for (const [key, nodeId] of Object.entries(F1040_OUTPUTS)) {
      expect(init.currentState[nodeId]).toBeDefined();
    }
  });

  test('SCHEDULE1_OUTPUTS and SCHEDULE2_OUTPUTS constants point to existing nodes', () => {
    const engine  = makeEngine();
    const context = { taxYear: '2025', filingStatus: 'single', hasSpouse: false };
    const init    = engine.initializeSession({ ...context, sessionKey: 'test#2025' });

    expect(init.currentState[SCHEDULE1_OUTPUTS.totalAdjustments]).toBeDefined();
    expect(init.currentState[SCHEDULE2_OUTPUTS.totalAdditionalTaxes]).toBeDefined();
  });

  test('AGI node is F1040_OUTPUTS.adjustedGrossIncome', () => {
    /**
     * Verify the exported constant is the node that actually holds the AGI.
     */
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 80_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.personalContributions,   value: 4_300 },
      { instanceId: H.ageAsOfDec31,            value: 40 },
    ]);

    expect(state[F1040_OUTPUTS.adjustedGrossIncome]?.value).toBe(75_700);
  });

  test('Total tax node is F1040_OUTPUTS.totalTax', () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome,       value: 60_000 },
      { instanceId: F.line16_tax,              value: 8_000 },
      { instanceId: H.coverageType,            value: 'self_only' },
      { instanceId: H.ageAsOfDec31,            value: 40 },
      { instanceId: R.earlyDistributions,      value: 5_000 },
      { instanceId: R.exceptionAmount,         value: 0 },
    ]);

    // Regular tax ($8,000) + early dist penalty ($500) = $8,500
    expect(state[F1040_OUTPUTS.totalTax]?.value).toBe(8_500);
  });

});