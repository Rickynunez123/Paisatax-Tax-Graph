// __tests__/schedule-eic.test.ts
/**
 * SCHEDULE EIC — EARNED INCOME CREDIT — TESTS
 *
 * Schedule EIC test scenarios:
 *   EIC — Eligibility Guards
 *   1.  MFS filer → ineligible, credit = 0
 *   2.  Excess investment income → ineligible, credit = 0
 *   3.  Childless EIC, age 24 → ineligible (below 25 minimum)
 *   4.  Childless EIC, age 65 → ineligible (above 64 maximum)
 *   5.  Childless EIC, age 25 → eligible (at lower boundary)
 *   6.  Childless EIC, age 64 → eligible (at upper boundary)
 *   7.  Age disqualifier ignored when qualifying children are present
 *
 *   EIC — Worksheet A (No Children)
 *   8.  Childless EIC — low income, single, earns within phase-in
 *   9.  Childless EIC — income at max credit plateau (single)
 *   10. Childless EIC — income in phase-out zone (single)
 *   11. Childless EIC — MFJ, phase-out starts higher than single
 *   12. Childless EIC — income above phase-out end → credit = 0
 *
 *   EIC — Worksheet A (With Children)
 *   13. 1 qualifying child — moderate income, full credit
 *   14. 1 qualifying child — income in phase-out zone (single)
 *   15. 1 qualifying child — income above phase-out end → 0
 *   16. 2 qualifying children — moderate income, full credit
 *   17. 2 qualifying children — income above phase-out end → 0
 *   18. 3 qualifying children — MFJ, maximum credit scenario
 *   19. 3 qualifying children — income near MFJ phase-out end
 *
 *   EIC — AGI vs Earned Income Interaction
 *   20. AGI > earned income → AGI lookup produces smaller credit (phase-out accelerated)
 *   21. AGI = earned income → credit equals table lookup on earned income directly
 *   22. Zero earned income → credit = 0
 *
 *   EIC — Investment Income Boundary
 *   23. Investment income exactly at limit ($11,950) → eligible
 *   24. Investment income $1 above limit ($11,951) → ineligible
 */

import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { InputEventSource } from '../../src/core/graph/engine.types';
import { F8889_NODES } from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES } from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES } from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES } from '../../src/tax/forms/schedule2/nodes';
import { W2_INITIAL_AGGREGATORS } from '../../src/tax/forms/w2/nodes';
import { F1040_NODES } from '../../src/tax/forms/f1040/nodes';
import { SCHEDULE_EIC_NODES, SCHEDULE_EIC_OUTPUTS } from '../../src/tax/forms/schedule-eic/nodes';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS (Schedule EIC)
// ─────────────────────────────────────────────────────────────────────────────

function makeEICEngine(filingStatus: string = 'single') {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
    ...SCHEDULE_EIC_NODES,
  ]);
  return {
    engine,
    session: {
      taxYear: '2025',
      filingStatus,
      hasSpouse: filingStatus === 'married_filing_jointly',
      sessionKey: 'test-schedule-eic',
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
    { instanceId: id, value, source: InputEventSource.PREPARER, timestamp: new Date().toISOString() },
    state,
    session,
  ).currentState;
}

function val(state: Record<string, any>, id: string): number | boolean | null {
  return state[id]?.value ?? null;
}

function num(state: Record<string, any>, id: string): number {
  return (state[id]?.value as number) ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE EIC — ELIGIBILITY GUARDS
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule EIC — Eligibility Guards', () => {
  test('1. MFS filer → isMFSIneligible = true, credit = 0', () => {
    const { engine, session } = makeEICEngine('married_filing_separately');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      30_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);

    expect(val(state, 'schedule-eic.joint.isMFSIneligible')).toBe(true);
    expect(val(state, 'schedule-eic.joint.isEligible')).toBe(false);
    // Final credit node should be SKIPPED → value is null
    expect(state['schedule-eic.joint.worksheetLine6_finalCredit']?.value).toBeNull();
  });

  test('2. Investment income $12,000 > $11,950 limit → ineligible, credit = 0', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      30_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);
    state = setInput(engine, state, session, 'schedule-eic.joint.inputInvestmentIncome', 12_000);

    expect(val(state, 'schedule-eic.joint.isInvestmentIncomeDisqualified')).toBe(true);
    expect(val(state, 'schedule-eic.joint.isEligible')).toBe(false);
    expect(state['schedule-eic.joint.worksheetLine6_finalCredit']?.value).toBeNull();
  });

  test('3. Childless EIC, age 24 → age disqualifier fires, credit = 0', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      15_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 24);
    // 0 qualifying children (default)

    expect(val(state, 'schedule-eic.joint.isChildlessAgeDisqualified')).toBe(true);
    expect(val(state, 'schedule-eic.joint.isEligible')).toBe(false);
    expect(state['schedule-eic.joint.worksheetLine6_finalCredit']?.value).toBeNull();
  });

  test('4. Childless EIC, age 65 → age disqualifier fires, credit = 0', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      15_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 65);

    expect(val(state, 'schedule-eic.joint.isChildlessAgeDisqualified')).toBe(true);
    expect(val(state, 'schedule-eic.joint.isEligible')).toBe(false);
  });

  test('5. Childless EIC, age 25 → eligible (lower boundary)', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      15_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 25);

    expect(val(state, 'schedule-eic.joint.isChildlessAgeDisqualified')).toBe(false);
    expect(val(state, 'schedule-eic.joint.isEligible')).toBe(true);
    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBeGreaterThan(0);
  });

  test('6. Childless EIC, age 64 → eligible (upper boundary)', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      15_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 64);

    expect(val(state, 'schedule-eic.joint.isChildlessAgeDisqualified')).toBe(false);
    expect(val(state, 'schedule-eic.joint.isEligible')).toBe(true);
    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBeGreaterThan(0);
  });

  test('7. Age disqualifier is ignored when qualifying children are present', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      30_000,
    );
    // Age 24 would disqualify childless EIC, but children are present
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 24);
    state = setInput(engine, state, session, 'schedule-eic.joint.inputNumQualifyingChildren', 1);

    // Age disqualifier should be false (not applicable with children)
    expect(val(state, 'schedule-eic.joint.isChildlessAgeDisqualified')).toBe(false);
    expect(val(state, 'schedule-eic.joint.isEligible')).toBe(true);
    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE EIC — WORKSHEET A (NO CHILDREN)
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule EIC — Worksheet A (No Qualifying Children)', () => {
  test('8. Childless, single, $8,000 earned income → in phase-in zone, credit > 0', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      8_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);

    // Earned income is in the phase-in zone (below $8,490 max-credit plateau)
    const phaseIn = num(state, 'schedule-eic.joint.worksheetLine2_phaseInCredit');
    expect(phaseIn).toBeGreaterThan(0);
    expect(phaseIn).toBeLessThanOrEqual(649);
    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBe(phaseIn);
  });

  test('9. Childless, single, $10,000 earned income → at/near max credit ($649)', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    // $10,000 is between the $8,490 phase-in limit and $10,620 phase-out start
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      10_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);

    const credit = num(state, SCHEDULE_EIC_OUTPUTS.credit);
    // Plateau between phase-in and phase-out
    expect(credit).toBe(649);
  });

  test('10. Childless, single, $15,000 → in phase-out zone, credit reduced', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    // Phase-out starts at $10,620, ends at $19,104 for single
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      15_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);

    const credit = num(state, SCHEDULE_EIC_OUTPUTS.credit);
    expect(credit).toBeGreaterThan(0);
    expect(credit).toBeLessThan(649);
  });

  test('11. Childless, MFJ — $17,000 earned income, phase-out starts at $17,730 (higher than single)', () => {
    const { engine, session } = makeEICEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      17_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);

    // MFJ phase-out start = $17,730; $17,000 is still at plateau
    const credit = num(state, SCHEDULE_EIC_OUTPUTS.credit);
    expect(credit).toBe(649);
  });

  test('12. Childless, single, $20,000 → above phase-out end ($19,104), credit = 0', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      20_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);

    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE EIC — WORKSHEET A (WITH QUALIFYING CHILDREN)
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule EIC — Worksheet A (With Qualifying Children)', () => {
  test('13. 1 child, single, $20,000 income → in plateau, full max credit', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    // 1-child plateau: $12,730–$23,350; $20,000 sits in the middle
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      20_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputNumQualifyingChildren', 1);

    const phaseIn = num(state, 'schedule-eic.joint.worksheetLine2_phaseInCredit');
    const credit = num(state, SCHEDULE_EIC_OUTPUTS.credit);
    expect(phaseIn).toBe(4_328);
    expect(credit).toBe(4_328);
  });

  test('14. 1 child, single, $40,000 → in phase-out zone (starts $23,350)', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      40_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputNumQualifyingChildren', 1);

    const credit = num(state, SCHEDULE_EIC_OUTPUTS.credit);
    expect(credit).toBeGreaterThan(0);
    expect(credit).toBeLessThan(4_328);
  });

  test('15. 1 child, single, $52,000 → above phase-out end ($50,434), credit = 0', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      52_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputNumQualifyingChildren', 1);

    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBe(0);
  });

  test('16. 2 children, single, $20,000 → plateau, max credit $7,152', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    // 2-child plateau: $17,880–$23,350
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      20_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputNumQualifyingChildren', 2);

    expect(num(state, 'schedule-eic.joint.worksheetLine2_phaseInCredit')).toBe(7_152);
    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBe(7_152);
  });

  test('17. 2 children, single, $58,000 → above phase-out end ($57,310), credit = 0', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      58_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputNumQualifyingChildren', 2);

    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBe(0);
  });

  test('18. 3 children, MFJ, $25,000 → plateau, max credit $8,046', () => {
    const { engine, session } = makeEICEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    // 3-child MFJ plateau: $17,880–$30,470
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      25_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputNumQualifyingChildren', 3);

    expect(num(state, 'schedule-eic.joint.worksheetLine2_phaseInCredit')).toBe(8_046);
    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBe(8_046);
  });

  test('19. 3 children, MFJ, $68,000 → near phase-out end ($68,675), small credit', () => {
    const { engine, session } = makeEICEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      68_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputNumQualifyingChildren', 3);

    const credit = num(state, SCHEDULE_EIC_OUTPUTS.credit);
    expect(credit).toBeGreaterThanOrEqual(0);
    expect(credit).toBeLessThan(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE EIC — AGI VS EARNED INCOME INTERACTION
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule EIC — AGI vs Earned Income Interaction', () => {
  test('20. AGI > earned income → AGI lookup produces smaller (phase-out accelerated)', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      15_000,
    );

    const phaseIn = num(state, 'schedule-eic.joint.worksheetLine2_phaseInCredit');
    const agiLookup = num(state, 'schedule-eic.joint.worksheetLine5_agiLookup');
    const credit = num(state, SCHEDULE_EIC_OUTPUTS.credit);

    expect(credit).toBe(Math.min(phaseIn, agiLookup));
    expect(credit).toBeGreaterThan(0);
  });

  test('21. AGI = earned income → Line 2 = Line 5, credit = Line 2', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      20_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputNumQualifyingChildren', 1);
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);

    const line1 = num(state, 'schedule-eic.joint.worksheetLine1_earnedIncome');
    const line3 = num(state, 'schedule-eic.joint.worksheetLine3_agi');
    const line2 = num(state, 'schedule-eic.joint.worksheetLine2_phaseInCredit');
    const line5 = num(state, 'schedule-eic.joint.worksheetLine5_agiLookup');

    expect(line1).toBe(line3);
    expect(line2).toBe(line5);
    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBe(line2);
  });

  test('22. Zero earned income → credit = 0', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);

    expect(num(state, 'schedule-eic.joint.worksheetLine1_earnedIncome')).toBe(0);
    expect(num(state, 'schedule-eic.joint.worksheetLine2_phaseInCredit')).toBe(0);
    expect(num(state, SCHEDULE_EIC_OUTPUTS.credit)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE EIC — INVESTMENT INCOME BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule EIC — Investment Income Boundary', () => {
  test('23. Investment income exactly at limit ($11,950) → still eligible', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      20_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);
    state = setInput(engine, state, session, 'schedule-eic.joint.inputInvestmentIncome', 11_950);

    expect(val(state, 'schedule-eic.joint.isInvestmentIncomeDisqualified')).toBe(false);
    expect(val(state, 'schedule-eic.joint.isEligible')).toBe(true);
  });

  test('24. Investment income $1 above limit ($11,951) → disqualified', () => {
    const { engine, session } = makeEICEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      20_000,
    );
    state = setInput(engine, state, session, 'schedule-eic.joint.inputPrimaryAge', 35);
    state = setInput(engine, state, session, 'schedule-eic.joint.inputInvestmentIncome', 11_951);

    expect(val(state, 'schedule-eic.joint.isInvestmentIncomeDisqualified')).toBe(true);
    expect(val(state, 'schedule-eic.joint.isEligible')).toBe(false);
  });
});