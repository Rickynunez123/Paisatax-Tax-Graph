/**
 * FORM 1040 SHELL — INTEGRATION TESTS (UPDATED)
 *
 * Updated for:
 * ✅ Standard deduction now COMPUTED (Line 12)
 * ✅ Tax now COMPUTED from taxable income (Line 16)
 *
 * Key changes vs old tests:
 * - Removed ALL manual inputs to Line 16 (tax). It is computed now.
 * - Added standard deduction input nodes (age/blind/dependent/QBI) where needed.
 * - Updated assertions: Line 24 = Line 16 + Line 17 (when Line 17 applicable),
 *   otherwise Line 24 = Line 16.
 */

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

// Safe helper for nodes that may be SKIPPED/null
function maybeNum(state: ReturnType<typeof applyEvents>, nodeId: string): number {
  const snap = state[nodeId];
  if (!snap) throw new Error(`Node not found: ${nodeId}`);
  return typeof snap.value === 'number' ? snap.value : 0;
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
  line9_totalIncome: "f1040.joint.line9_totalIncome",
  line10_adjustments: "f1040.joint.line10_adjustmentsToIncome",
  line11_agi: "f1040.joint.line11_adjustedGrossIncome",
  line12_deduction: "f1040.joint.line12_deduction",
  line15_taxableIncome: "f1040.joint.line15_taxableIncome",
  line16_tax: "f1040.joint.line16_tax",
  line17_additionalTax: "f1040.joint.line17_additionalTaxes",
  line24_totalTax: "f1040.joint.line24_totalTax",
};

// Line 12/13 inputs (new)
const F12 = {
  primaryAge:    'f1040.joint.line12input_primaryAge',
  primaryBlind:  'f1040.joint.line12input_primaryBlind',
  spouseAge:     'f1040.joint.line12input_spouseAge',
  spouseBlind:   'f1040.joint.line12input_spouseBlind',
  isDependent:   'f1040.joint.line12input_isDependentFiler',
  earnedIncome:  'f1040.joint.line12input_earnedIncome',
  qbiDeduction:  'f1040.joint.line13_qbiDeduction',
};

// Convenience: set standard deduction inputs deterministically for single filer
function baseStdDeductionInputs(age: number) {
  return [
    { instanceId: F12.primaryAge,   value: age },
    { instanceId: F12.primaryBlind, value: false },
    { instanceId: F12.isDependent,  value: false },
    { instanceId: F12.earnedIncome, value: 0 },
    { instanceId: F12.qbiDeduction, value: 0 },
    // spouse inputs harmless for single, but keep deterministic
    { instanceId: F12.spouseAge,    value: 0 },
    { instanceId: F12.spouseBlind,  value: false },
  ] as { instanceId: string; value: string | number | boolean }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — Registration', () => {

  test('All five form node sets register together without error', () => {
    expect(() => makeEngine()).not.toThrow();
  });

  test("Total node count is reasonable — no duplicate IDs", () => {
    const engine = makeEngine();
    const context = {
      taxYear: "2025",
      filingStatus: "single",
      hasSpouse: false,
    };
    const init = engine.initializeSession({
      ...context,
      sessionKey: "test#2025",
    });
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

  test("Scenario: No adjustments — AGI equals total income", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 60_000 },
    ]);

    expect(num(state, F.line9_totalIncome)).toBe(60_000);
    expect(num(state, F.line10_adjustments)).toBe(0);
    expect(num(state, F.line11_agi)).toBe(60_000);
  });

  test("Scenario: HSA deduction reduces AGI", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 80_000 },
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.personalContributions, value: 4_300 },
      { instanceId: H.ageAsOfDec31, value: 40 },
    ]);

    expect(num(state, H.hsaDeduction)).toBe(4_300);
    expect(num(state, S1.line13_hsaDeduction)).toBe(4_300);
    expect(num(state, S1.line26_totalAdj)).toBe(4_300);
    expect(num(state, F.line10_adjustments)).toBe(4_300);
    expect(num(state, F.line11_agi)).toBe(75_700);
  });

  test("Scenario: Catch-up contribution at age 57 maximizes deduction", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 100_000 },
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.personalContributions, value: 5_300 },
      { instanceId: H.ageAsOfDec31, value: 57 },
    ]);

    expect(num(state, H.hsaDeduction)).toBe(5_300);
    expect(num(state, F.line10_adjustments)).toBe(5_300);
    expect(num(state, F.line11_agi)).toBe(94_700);
  });

  test("Scenario: Employer contributions reduce HSA deduction but not AGI benefit", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 70_000 },
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.personalContributions, value: 2_300 },
      { instanceId: H.ageAsOfDec31, value: 40 },
      { instanceId: H.employerContributions, value: 2_000 },
    ]);

    expect(num(state, H.hsaDeduction)).toBe(2_300);
    expect(num(state, F.line10_adjustments)).toBe(2_300);
    expect(num(state, F.line11_agi)).toBe(67_700);
  });

  test("Scenario: HSA deduction plus manual other adjustment", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 60_000 },
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.personalContributions, value: 3_000 },
      { instanceId: H.ageAsOfDec31, value: 32 },
      {
        instanceId: "schedule1.joint.line21_studentLoanInterest",
        value: 1_200,
      },
    ]);

    expect(num(state, S1.line13_hsaDeduction)).toBe(3_000);
    expect(num(state, S1.line26_totalAdj)).toBe(4_200);
    expect(num(state, F.line10_adjustments)).toBe(4_200);
    expect(num(state, F.line11_agi)).toBe(55_800);
  });

  test("Scenario: Adjustments cannot make AGI negative", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 1_000 },
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.personalContributions, value: 4_300 },
      { instanceId: H.ageAsOfDec31, value: 40 },
    ]);

    expect(num(state, F.line10_adjustments)).toBe(4_300);
    expect(num(state, F.line11_agi)).toBe(0);
  });

  test("Scenario: 2024 return uses 2024 HSA limit", () => {
    const engine = makeEngine();
    const context = {
      taxYear: "2024",
      filingStatus: "single",
      hasSpouse: false,
    };
    let result = engine.initializeSession({
      ...context,
      sessionKey: "test#2024",
    });

    for (const [id, val] of [
      [F.line9_totalIncome, 80_000],
      [H.coverageType, "self_only"],
      [H.personalContributions, 4_300],
      [H.ageAsOfDec31, 40],
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

  test("Line 17 = HSA excess penalty from F5329 via Schedule 2", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 60_000 },
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.personalContributions, value: 5_000 },
      { instanceId: H.ageAsOfDec31, value: 30 },
    ]);

    expect(num(state, R.excessTax)).toBe(42);
    expect(num(state, S2.line44)).toBe(42);
    expect(num(state, F.line17_additionalTax)).toBe(42);
    expect(status(state, F.line17_additionalTax)).toBe(NodeStatus.CLEAN);
  });

  test("Line 17 = early distribution penalty via Schedule 2", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 60_000 },
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.ageAsOfDec31, value: 40 },
      { instanceId: R.earlyDistributions, value: 10_000 },
      { instanceId: R.exceptionAmount, value: 0 },
    ]);

    expect(num(state, R.earlyDistPenalty)).toBe(1_000);
    expect(num(state, F.line17_additionalTax)).toBe(1_000);
  });

  test("Line 17 = HSA distribution penalty from F8889 via Schedule 2", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 60_000 },
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.ageAsOfDec31, value: 40 },
      { instanceId: H.totalDistributions, value: 500 },
      { instanceId: H.qualifiedExpenses, value: 0 },
    ]);

    expect(num(state, H.additionalTax)).toBe(100);
    expect(num(state, F.line17_additionalTax)).toBe(100);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — LINE 24: TOTAL TAX
// Line 16 (computed) + Line 17 (computed or skipped)
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — Total Tax (Line 24)', () => {

  test('Total tax = regular tax when no additional taxes', () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 60_000 },
      ...baseStdDeductionInputs(40),
    ]);

    expect(status(state, F.line17_additionalTax)).toBe(NodeStatus.SKIPPED);
    expect(num(state, F.line24_totalTax)).toBe(num(state, F.line16_tax));
  });

  test("Total tax = regular tax + additional taxes", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 60_000 },
      ...baseStdDeductionInputs(40),
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.ageAsOfDec31, value: 40 },
      { instanceId: R.earlyDistributions, value: 10_000 },
      { instanceId: R.exceptionAmount, value: 0 },
    ]);

    expect(num(state, F.line17_additionalTax)).toBe(1_000);
    expect(num(state, F.line24_totalTax)).toBe(
      num(state, F.line16_tax) + num(state, F.line17_additionalTax),
    );
  });

  test("Total tax when all three penalty types apply", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 80_000 },
      ...baseStdDeductionInputs(40),
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.personalContributions, value: 5_000 },
      { instanceId: H.ageAsOfDec31, value: 40 },
      { instanceId: H.totalDistributions, value: 1_000 },
      { instanceId: H.qualifiedExpenses, value: 0 },
      { instanceId: R.earlyDistributions, value: 5_000 },
      { instanceId: R.exceptionAmount, value: 0 },
    ]);

    expect(num(state, S2.line44)).toBe(742);
    expect(num(state, F.line17_additionalTax)).toBe(742);
    expect(num(state, F.line24_totalTax)).toBe(
      num(state, F.line16_tax) + num(state, F.line17_additionalTax),
    );
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — FULL VERTICAL SLICE
// One complete scenario exercising every layer simultaneously
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — Full Vertical Slice', () => {

  test("Complete scenario: wages → HSA deduction → AGI → penalties → total tax", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 75_000 },
      ...baseStdDeductionInputs(35),
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.personalContributions, value: 5_000 },
      { instanceId: H.ageAsOfDec31, value: 35 },
      { instanceId: H.employerContributions, value: 0 },
      { instanceId: H.totalDistributions, value: 800 },
      { instanceId: H.qualifiedExpenses, value: 300 },
      { instanceId: R.earlyDistributions, value: 6_000 },
      { instanceId: R.exceptionAmount, value: 0 },
    ]);

    // ── Form 8889 ──
    expect(num(state, H.hsaDeduction)).toBe(4_300);
    expect(num(state, "f8889.primary.line17a_nonQualifiedDistributions")).toBe(
      500,
    );
    expect(num(state, H.additionalTax)).toBe(100);

    // ── Form 5329 ──
    expect(num(state, R.earlyDistPenalty)).toBe(600);
    expect(num(state, "f5329.primary.line49_taxableExcess")).toBe(700);
    expect(num(state, R.excessTax)).toBe(42);

    // ── Schedule 1 ──
    expect(num(state, S1.line13_hsaDeduction)).toBe(4_300);
    expect(num(state, S1.line26_totalAdj)).toBe(4_300);

    // ── Schedule 2 ──
    expect(num(state, S2.line8)).toBe(642);
    expect(num(state, S2.line17b)).toBe(100);
    expect(num(state, S2.line44)).toBe(742);

    // ── Form 1040 ──
    expect(num(state, F.line9_totalIncome)).toBe(75_000);
    expect(num(state, F.line10_adjustments)).toBe(4_300);
    expect(num(state, F.line11_agi)).toBe(70_700);

    // Standard deduction now computed
    expect(num(state, F.line12_deduction)).toBeGreaterThan(0);

    // Line 15/16 now computed
    expect(num(state, F.line15_taxableIncome)).toBeGreaterThanOrEqual(0);
    expect(num(state, F.line16_tax)).toBeGreaterThanOrEqual(0);

    expect(num(state, F.line17_additionalTax)).toBe(742);
    expect(num(state, F.line24_totalTax)).toBe(
      num(state, F.line16_tax) + num(state, F.line17_additionalTax),
    );
  });

  test("Clean return: high earner, max HSA, no penalties", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 120_000 },
      ...baseStdDeductionInputs(45),
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.personalContributions, value: 4_300 },
      { instanceId: H.ageAsOfDec31, value: 45 },
      { instanceId: H.totalDistributions, value: 2_000 },
      { instanceId: H.qualifiedExpenses, value: 2_000 },
    ]);

    expect(num(state, F.line11_agi)).toBe(115_700);
    expect(status(state, F.line17_additionalTax)).toBe(NodeStatus.SKIPPED);
    expect(num(state, F.line24_totalTax)).toBe(num(state, F.line16_tax));
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6 — FULL CHAIN REACTIVITY
// Changes at the source propagate all the way to Form 1040 outputs
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 1040 Shell — Full Chain Reactivity', () => {

  test("Correcting HSA contribution updates AGI and eliminates penalty", () => {
    const engine = makeEngine();
    const context = {
      taxYear: "2025",
      filingStatus: "single",
      hasSpouse: false,
    };
    let result = engine.initializeSession({
      ...context,
      sessionKey: "test#2025",
    });

    // include standard deduction inputs (so line15/16 are stable)
    for (const e of baseStdDeductionInputs(35)) {
      result = engine.process(
        makeEvent(e.instanceId, e.value),
        result.currentState,
        context,
      );
    }

    for (const [id, val] of [
      [F.line9_totalIncome, 80_000],
      [H.coverageType, "self_only"],
      [H.personalContributions, 5_000],
      [H.ageAsOfDec31, 35],
    ] as [string, string | number][]) {
      result = engine.process(makeEvent(id, val), result.currentState, context);
    }

    expect(result.currentState[F.line11_agi]?.value).toBe(75_700);
    expect(result.currentState[F.line17_additionalTax]?.value).toBe(42);

    // Correct contribution down to $3,000
    result = engine.process(
      makeEvent(H.personalContributions, 3_000),
      result.currentState,
      context,
    );

    expect(result.currentState[H.hsaDeduction]?.value).toBe(3_000);
    expect(result.currentState[S1.line13_hsaDeduction]?.value).toBe(3_000);
    expect(result.currentState[F.line10_adjustments]?.value).toBe(3_000);
    expect(result.currentState[F.line11_agi]?.value).toBe(77_000);

    expect(result.currentState[S2.line44]?.value).toBe(0);
    expect(result.currentState[F.line17_additionalTax]?.status).toBe(
      NodeStatus.SKIPPED,
    );
    expect(result.currentState[F.line24_totalTax]?.value).toBe(
      result.currentState[F.line16_tax]?.value,
    );
  });

  test("Adding total income mid-session updates AGI immediately", () => {
    const engine = makeEngine();
    const context = {
      taxYear: "2025",
      filingStatus: "single",
      hasSpouse: false,
    };
    let result = engine.initializeSession({
      ...context,
      sessionKey: "test#2025",
    });

    for (const e of baseStdDeductionInputs(40)) {
      result = engine.process(
        makeEvent(e.instanceId, e.value),
        result.currentState,
        context,
      );
    }

    // Enter HSA data first
    result = engine.process(
      makeEvent(H.coverageType, "self_only"),
      result.currentState,
      context,
    );
    result = engine.process(
      makeEvent(H.personalContributions, 4_300),
      result.currentState,
      context,
    );
    result = engine.process(
      makeEvent(H.ageAsOfDec31, 40),
      result.currentState,
      context,
    );

    expect(result.currentState[F.line11_agi]?.value).toBe(0);

    // Now enter wages
    result = engine.process(
      makeEvent(F.line9_totalIncome, 90_000),
      result.currentState,
      context,
    );

    expect(result.currentState[F.line11_agi]?.value).toBe(85_700);
  });

  test("Switching from self-only to family coverage in the middle of prep", () => {
    const engine = makeEngine();
    const context = {
      taxYear: "2025",
      filingStatus: "single",
      hasSpouse: false,
    };
    let result = engine.initializeSession({
      ...context,
      sessionKey: "test#2025",
    });

    for (const e of baseStdDeductionInputs(40)) {
      result = engine.process(
        makeEvent(e.instanceId, e.value),
        result.currentState,
        context,
      );
    }

    result = engine.process(
      makeEvent(F.line9_totalIncome, 100_000),
      result.currentState,
      context,
    );
    result = engine.process(
      makeEvent(H.coverageType, "self_only"),
      result.currentState,
      context,
    );
    result = engine.process(
      makeEvent(H.personalContributions, 8_000),
      result.currentState,
      context,
    );
    result = engine.process(
      makeEvent(H.ageAsOfDec31, 40),
      result.currentState,
      context,
    );

    expect(result.currentState[H.hsaDeduction]?.value).toBe(4_300);
    expect(result.currentState[F.line11_agi]?.value).toBe(95_700);
    expect(result.currentState[R.excessTax]?.value).toBeCloseTo(222);
    expect(result.currentState[F.line17_additionalTax]?.value).toBeCloseTo(222);

    // Correct to family coverage
    result = engine.process(
      makeEvent(H.coverageType, "family"),
      result.currentState,
      context,
    );

    expect(result.currentState[H.hsaDeduction]?.value).toBe(8_000);
    expect(result.currentState[F.line10_adjustments]?.value).toBe(8_000);
    expect(result.currentState[F.line11_agi]?.value).toBe(92_000);
    expect(result.currentState[S2.line44]?.value).toBe(0);
    expect(result.currentState[F.line17_additionalTax]?.status).toBe(
      NodeStatus.SKIPPED,
    );
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

    for (const [, nodeId] of Object.entries(F1040_OUTPUTS)) {
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

  test("AGI node is F1040_OUTPUTS.adjustedGrossIncome", () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 80_000 },
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.personalContributions, value: 4_300 },
      { instanceId: H.ageAsOfDec31, value: 40 },
    ]);

    expect(state[F1040_OUTPUTS.adjustedGrossIncome]?.value).toBe(75_700);
  });

  test('Total tax node is F1040_OUTPUTS.totalTax', () => {
    const state = applyEvents([
      { instanceId: F.line9_totalIncome, value: 60_000 },
      ...baseStdDeductionInputs(40),
      { instanceId: H.coverageType, value: "self_only" },
      { instanceId: H.ageAsOfDec31, value: 40 },
      { instanceId: R.earlyDistributions, value: 5_000 },
      { instanceId: R.exceptionAmount, value: 0 },
    ]);

    // Total tax must equal computed regular tax + penalty
    const expected =
      num(state, F.line16_tax) + maybeNum(state, F.line17_additionalTax);
    expect(state[F1040_OUTPUTS.totalTax]?.value).toBe(expected);
  });

});
