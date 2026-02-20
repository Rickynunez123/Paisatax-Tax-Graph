/**
 * FORM 2441 — CHILD AND DEPENDENT CARE EXPENSES — TESTS
 *
 * Test scenarios:
 *   Credit Rate Table
 *   1.  AGI ≤ $15,000 → 35% max rate
 *   2.  AGI $20,000 → 32% rate
 *   3.  AGI $43,001+ → 20% floor rate
 *   4.  AGI at exact bracket boundary ($17,000) → 34%
 *
 *   Expense Cap
 *   5.  1 qualifying person → $3,000 cap enforced
 *   6.  2 qualifying persons → $6,000 cap enforced
 *   7.  Expenses below cap → actual expenses used
 *
 *   Earned Income Limit
 *   8.  Single filer — credit capped at primary earned income
 *   9.  MFJ — credit capped at lower-earning spouse's income
 *   10. MFJ — spouse income is the binding constraint
 *
 *   Employer Benefits (Part III)
 *   11. FSA benefits reduce expense base dollar-for-dollar
 *   12. FSA benefits fully consume expense base → zero credit
 *   13. MFS filer — FSA exclusion max is $2,500
 *
 *   Tax Liability Cap (Nonrefundable)
 *   14. Credit capped at tax liability when liability < tentative credit
 *   15. Zero tax liability → zero credit
 *
 *   Edge Cases
 *   16. No qualifying persons → zero credit
 *   17. Zero expenses → zero credit
 *   18. HoH filer — no spouse income constraint
 */

import { TaxGraphEngineImpl }   from '../../src/core/graph/engine';
import { InputEventSource }      from '../../src/core/graph/engine.types';
import { F8889_NODES }           from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }           from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }       from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }       from '../../src/tax/forms/schedule2/nodes';
import { W2_INITIAL_AGGREGATORS } from '../../src/tax/forms/w2/nodes';
import { F1040_NODES }           from '../../src/tax/forms/f1040/nodes';
import { F2441_NODES, F2441_OUTPUTS } from '../../src/tax/forms/f2441/nodes';
import { SCHEDULE3_NODES } from '../../src/tax/forms/schedule3/nodes';
import { F1040_PAYMENT_NODES } from '../../src/tax/forms/f1040/payments'; // or payments.ts export name


// ─── helpers ──────────────────────────────────────────────────────────────────

function makeEngine(filingStatus = 'married_filing_jointly') {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
      ...SCHEDULE3_NODES,
  ...F1040_NODES,
  ...F1040_PAYMENT_NODES,
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
    ...F2441_NODES,
  ]);
  return {
    engine,
    session: {
      taxYear:      '2025',
      filingStatus,
      hasSpouse:    filingStatus === 'married_filing_jointly' || filingStatus === 'married_filing_separately',
      sessionKey:   'test-f2441',
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
// CREDIT RATE TABLE
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 2441 — Credit Rate Table', () => {

  test('1. AGI ≤ $15,000 → 35% max rate', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      12_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);

    expect(val(state, 'f2441.joint.line8_creditRate')).toBe(0.35);
    // Tentative: $3,000 × 35% = $1,050
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(1_050);
  });

  test('2. AGI $20,000 → 32% rate', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      20_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);

    expect(val(state, 'f2441.joint.line8_creditRate')).toBe(0.32);
    // Tentative: $3,000 × 32% = $960
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(960);
  });

  test('3. AGI $43,001+ → 20% floor rate', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);

    expect(val(state, 'f2441.joint.line8_creditRate')).toBe(0.20);
    // Tentative: $3,000 × 20% = $600
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(600);
  });

  test('4. AGI exactly $17,000 → 34% (boundary check)', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      17_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);

    expect(val(state, 'f2441.joint.line8_creditRate')).toBe(0.34);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE CAP
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 2441 — Expense Cap', () => {

  test('5. 1 qualifying person → $3,000 cap enforced on $5,000 actual expenses', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    // High income → 20% rate, high expenses → cap is the binding constraint
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 5_000);

    // Expense base capped at $3,000; credit = $3,000 × 20% = $600
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(3_000);
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(600);
  });

  test('6. 2 qualifying persons → $6,000 cap enforced on $10,000 actual expenses', () => {
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 2);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 10_000);
    state = setInput(engine, state, session, 'f2441.joint.line5_spouseEarnedIncome', 80_000);

    // Expense base capped at $6,000; credit = $6,000 × 20% = $1,200
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(6_000);
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(1_200);
  });

  test('7. Expenses below cap → actual expenses used', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 2);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 2_500);

    // $2,500 < $6,000 cap → actual expenses used; credit = $2,500 × 20% = $500
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(2_500);
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(500);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// EARNED INCOME LIMIT
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 2441 — Earned Income Limit', () => {

  test('8. Single filer — credit capped at primary earned income', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    // Low earned income → earned income is the binding constraint
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      1_500,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);

    // Earned income $1,500 < cap $3,000 → base = $1,500
    // AGI $1,500 → rate = 35%; credit = $1,500 × 35% = $525
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(1_500);
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(525);
  });

  test('9. MFJ — primary earns $50k, spouse earns $50k → not a constraint', () => {
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      50_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line5_spouseEarnedIncome', 50_000);
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);

    // Both incomes > cap → cap is binding; credit = $3,000 × 20% = $600
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(3_000);
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(600);
  });

  test('10. MFJ — spouse income is the binding constraint', () => {
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    // Primary earns $80k; spouse earns $1,200 (lower-earning spouse is binding)
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line5_spouseEarnedIncome', 1_200);
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);

    // Spouse income $1,200 < cap $3,000 → base = $1,200
    // AGI $80,000 → rate = 20%; credit = $1,200 × 20% = $240
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(1_200);
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(240);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYER BENEFITS (PART III)
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 2441 — Employer Benefits (FSA)', () => {

  test('11. FSA benefits reduce expense base dollar-for-dollar', () => {
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line5_spouseEarnedIncome', 80_000);
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 2);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 10_000);
    // $3,000 FSA benefit reduces the $6,000 cap base
    state = setInput(engine, state, session, 'f2441.joint.line12_employerBenefits', 3_000);

    // Excluded benefits = $3,000 (≤ $5,000 limit)
    expect(val(state, 'f2441.joint.line25_benefitsExcluded')).toBe(3_000);
    // Net expense base: min($10,000 - $3,000, $6,000) = $6,000 - but net is $7,000 so cap wins at $6,000
    // Actually: netExpenses = $10,000 - $3,000 = $7,000; min($7,000, $6,000) = $6,000
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(6_000);
  });

  test('11b. FSA $5,000 + expenses $6,000 → base = $1,000', () => {
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line5_spouseEarnedIncome', 80_000);
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 2);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 6_000);
    state = setInput(engine, state, session, 'f2441.joint.line12_employerBenefits', 5_000);

    // Net expenses: $6,000 - $5,000 = $1,000; min($1,000, cap $6,000) = $1,000
    // Rate at AGI $80,000 = 20%; credit = $1,000 × 20% = $200
    expect(val(state, 'f2441.joint.line25_benefitsExcluded')).toBe(5_000);
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(1_000);
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(200);
  });

  test('12. FSA benefits fully consume expense base → zero credit', () => {
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line5_spouseEarnedIncome', 80_000);
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);
    // FSA fully covers expenses
    state = setInput(engine, state, session, 'f2441.joint.line12_employerBenefits', 5_000);

    // netExpenses = max(0, $3,000 - $5,000) = 0 → no credit
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(0);
    expect(val(state, F2441_OUTPUTS.credit)).toBe(0);
  });

  test('13. MFS filer — FSA exclusion max is $2,500', () => {
    const { engine, session } = makeEngine('married_filing_separately');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);
    // $4,000 benefits, but MFS cap is $2,500
    state = setInput(engine, state, session, 'f2441.joint.line12_employerBenefits', 4_000);

    // Excluded = min($4,000, $2,500) = $2,500
    expect(val(state, 'f2441.joint.line25_benefitsExcluded')).toBe(2_500);
    // Net expenses = $3,000 - $2,500 = $500; base = $500
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(500);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TAX LIABILITY CAP (NONREFUNDABLE)
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 2441 — Tax Liability Cap', () => {

  test('14. Credit capped at tax liability when liability < tentative credit', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    // Very low income → small tax liability
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      14_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);

    const taxLiability  = val(state, 'f1040.joint.line24_totalTax');
    const tentative     = val(state, 'f2441.joint.line9a_tentativeCredit');
    const credit        = val(state, F2441_OUTPUTS.credit);

    // Tentative = $3,000 × 35% = $1,050; but may exceed tiny tax liability
    expect(tentative).toBe(1_050);
    expect(credit).toBeLessThanOrEqual(taxLiability);
    expect(credit).toBeLessThanOrEqual(tentative);
  });

  test('15. Zero tax liability → zero credit', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    // No income → zero tax
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 1);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 3_000);

    expect(val(state, 'f1040.joint.line24_totalTax')).toBe(0);
    expect(val(state, F2441_OUTPUTS.credit)).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 2441 — Edge Cases', () => {

  test('16. No qualifying persons → zero credit', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    // Default: 0 qualifying persons
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 5_000);

    expect(val(state, 'f2441.joint.expenseCap')).toBe(0);
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(0);
    expect(val(state, F2441_OUTPUTS.credit)).toBe(0);
  });

  test('17. Zero expenses → zero credit', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 2);
    // Default: $0 expenses

    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(0);
    expect(val(state, F2441_OUTPUTS.credit)).toBe(0);
  });

  test('18. HoH filer — no spouse income constraint, full cap available', () => {
    const { engine, session } = makeEngine('head_of_household');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      80_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 2);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 6_000);
    // Spouse income input left at default 0 — should NOT constrain a single HoH

    // HoH: no spouse constraint → base = min(expenses, cap) = $6,000
    // Rate at $80k = 20%; credit = $6,000 × 20% = $1,200
    expect(val(state, 'f2441.joint.line6_qualifiedExpenseBase')).toBe(6_000);
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(1_200);
  });

  test('19. Maximum credit scenario — 2 persons, $6,000 expenses, AGI ≤ $15,000', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      10_000,
    );
    state = setInput(engine, state, session, 'f2441.joint.line2_numQualifyingPersons', 2);
    state = setInput(engine, state, session, 'f2441.joint.line3_qualifyingExpenses', 6_000);

    // Rate = 35%; tentative = $6,000 × 35% = $2,100
    expect(val(state, 'f2441.joint.line8_creditRate')).toBe(0.35);
    expect(val(state, 'f2441.joint.line9a_tentativeCredit')).toBe(2_100);
    // Final credit ≤ $2,100 (may be capped by low tax liability)
    expect(val(state, F2441_OUTPUTS.credit)).toBeLessThanOrEqual(2_100);
  });

});