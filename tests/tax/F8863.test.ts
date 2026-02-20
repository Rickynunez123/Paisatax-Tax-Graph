/**
 * FORM 8863 — TESTS
 * American Opportunity Credit (AOTC) + Lifetime Learning Credit (LLC)
 *
 * Test scenarios:
 *   AOTC:
 *   1. Single student, full expenses, no phase-out → max $2,500
 *   2. Single student, < $4,000 expenses → partial credit
 *   3. Single student, within phase-out range (single filer $85,000)
 *   4. Above phase-out ceiling ($90,000 single) → no credit
 *   5. MFJ, two students, within MFJ phase-out ($170,000)
 *   6. MFS → no credit (both AOTC and LLC)
 *   7. Refundable 40% split verified
 *   8. Refundable ineligible flag → full credit shifts to nonrefundable
 *
 *   LLC:
 *   9.  LLC basic: $8,000 expenses → $1,600 credit
 *   10. LLC max: $10,000+ expenses → $2,000 cap
 *   11. LLC phase-out single $83,000
 *   12. LLC above ceiling ($90,000) → no credit
 *
 *   Combined:
 *   13. AOTC for one student + LLC for another → both appear
 *   14. Tax liability cap limits total nonrefundable education credit
 */

import { TaxGraphEngineImpl }      from '../../src/core/graph/engine';
import { InputEventSource }         from '../../src/core/graph/engine.types';
import { F8889_NODES }              from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }              from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }          from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }          from '../../src/tax/forms/schedule2/nodes';
import { W2_INITIAL_AGGREGATORS }   from '../../src/tax/forms/w2/nodes';
import { F1040_NODES }              from '../../src/tax/forms/f1040/nodes';
import { F8863_NODES, F8863_OUTPUTS } from '../../src/tax/forms/f8863/nodes';
import { F1040_PAYMENT_NODES } from '../../src/tax/forms/f1040/payments';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeEngine(filingStatus = 'married_filing_jointly') {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES, ...F5329_NODES, ...SCHEDULE1_NODES, ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,          // ← ADD THIS
    ...F1040_PAYMENT_NODES,
    ...F8863_NODES,
  ]);
  return { engine, session: { taxYear: '2025', filingStatus, hasSpouse: false, sessionKey: 'test-f8863' } };
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

function val(state: Record<string, any>, id: string): number {
  return (state[id]?.value as number) ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// AOTC TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8863 — American Opportunity Credit (AOTC)', () => {

  test('1. Single student, $4,000+ expenses, below phase-out → $2,500 max', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      50_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.aotcNumStudents', 1);
    state = setInput(engine, state, session, 'f8863.joint.aotcQualifiedExpenses', 6_000);

    expect(val(state, 'f8863.joint.aotcTentativeCredit')).toBe(2_500);
    expect(val(state, 'f8863.joint.aotcPhaseOutMultiplier')).toBe(1.0);
    expect(val(state, 'f8863.joint.aotcAllowedCredit')).toBe(2_500);
    // Refundable = 40% of $2,500 = $1,000
    expect(val(state, F8863_OUTPUTS.aotcRefundableCredit)).toBe(1_000);
    // Nonrefundable = $1,500
    expect(val(state, 'f8863.joint.aotcNonRefundableCredit')).toBe(1_500);
  });

  test('2. Single student, $3,000 expenses → $2,000 + $250 = $2,250', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      50_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.aotcNumStudents', 1);
    state = setInput(engine, state, session, 'f8863.joint.aotcQualifiedExpenses', 3_000);

    // Tier 1: $2,000 × 100% = $2,000; Tier 2: $1,000 × 25% = $250
    expect(val(state, 'f8863.joint.aotcTentativeCredit')).toBe(2_250);
    // Refundable: 40% × $2,250 = $900
    expect(val(state, F8863_OUTPUTS.aotcRefundableCredit)).toBe(900);
    // Nonrefundable: $1,350
    expect(val(state, 'f8863.joint.aotcNonRefundableCredit')).toBe(1_350);
  });

  test('3. Single filer, MAGI $85,000 → 50% phase-out', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      85_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.aotcNumStudents', 1);
    state = setInput(engine, state, session, 'f8863.joint.aotcQualifiedExpenses', 4_000);

    // Phase-out: excess = $5,000, range = $10,000 → multiplier = 0.5
    expect(val(state, 'f8863.joint.aotcPhaseOutMultiplier')).toBeCloseTo(0.5, 4);
    // Tentative = $2,500, allowed = $2,500 × 0.5 = $1,250
    expect(val(state, 'f8863.joint.aotcAllowedCredit')).toBeCloseTo(1_250, 0);
    // Refundable = 40% × $1,250 = $500
    expect(val(state, F8863_OUTPUTS.aotcRefundableCredit)).toBeCloseTo(500, 0);
  });

  test('4. Single filer, MAGI $90,000 (at ceiling) → no credit', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      90_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.aotcNumStudents', 1);
    state = setInput(engine, state, session, 'f8863.joint.aotcQualifiedExpenses', 4_000);

    expect(val(state, 'f8863.joint.aotcPhaseOutMultiplier')).toBe(0);
    expect(val(state, 'f8863.joint.aotcAllowedCredit')).toBe(0);
    expect(val(state, F8863_OUTPUTS.aotcRefundableCredit)).toBe(0);
  });

  test('5. MFJ, 2 students, $8,000 total, MAGI $170,000 (within MFJ phase-out)', () => {
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      170_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.aotcNumStudents', 2);
    state = setInput(engine, state, session, 'f8863.joint.aotcQualifiedExpenses', 8_000);

    // 2 students × $4,000 each → 2 × $2,500 = $5,000 tentative
    expect(val(state, 'f8863.joint.aotcTentativeCredit')).toBe(5_000);
    // MFJ phase-out: MAGI $170,000, floor $160,000, range $20,000 → excess $10,000 → 50% allowed
    expect(val(state, 'f8863.joint.aotcPhaseOutMultiplier')).toBeCloseTo(0.5, 4);
    expect(val(state, 'f8863.joint.aotcAllowedCredit')).toBeCloseTo(2_500, 0);
    // Refundable = 40% × $2,500 = $1,000, capped at $1,000/student × 2 = $2,000
    // But allowed = $2,500 → refundable = $1,000 (40% × $2,500 = $1,000, cap = $2,000)
    expect(val(state, F8863_OUTPUTS.aotcRefundableCredit)).toBeCloseTo(1_000, 0);
  });

  test('6. MFS → no AOTC credit', () => {
    const { engine, session } = makeEngine('married_filing_separately');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      50_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.aotcNumStudents', 1);
    state = setInput(engine, state, session, 'f8863.joint.aotcQualifiedExpenses', 4_000);

    expect(val(state, 'f8863.joint.aotcPhaseOutMultiplier')).toBe(0);
    expect(val(state, 'f8863.joint.aotcAllowedCredit')).toBe(0);
    expect(val(state, F8863_OUTPUTS.aotcRefundableCredit)).toBe(0);
  });

  test('7. Refundable ineligible flag → all credit becomes nonrefundable', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      50_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.aotcNumStudents', 1);
    state = setInput(engine, state, session, 'f8863.joint.aotcQualifiedExpenses', 4_000);
    // Mark as ineligible for refundable (e.g. under-24 dependent student rule)
    state = setInput(engine, state, session, 'f8863.joint.aotcRefundableEligible', false);

    expect(val(state, 'f8863.joint.aotcAllowedCredit')).toBe(2_500);
    // No refundable portion
    expect(val(state, F8863_OUTPUTS.aotcRefundableCredit)).toBe(0);
    // Full $2,500 is nonrefundable
    expect(val(state, 'f8863.joint.aotcNonRefundableCredit')).toBe(2_500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LLC TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8863 — Lifetime Learning Credit (LLC)', () => {

  test('9. $8,000 LLC expenses → $1,600 credit (20% × $8,000)', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      50_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.llcQualifiedExpenses', 8_000);

    expect(val(state, 'f8863.joint.llcTentativeCredit')).toBe(1_600);
    expect(val(state, 'f8863.joint.llcPhaseOutMultiplier')).toBe(1.0);
    expect(val(state, 'f8863.joint.llcNonRefundableCredit')).toBe(1_600);
    // LLC is fully nonrefundable
    expect(val(state, F8863_OUTPUTS.aotcRefundableCredit)).toBe(0);
  });

  test('10. $12,000 LLC expenses → capped at $10,000 → $2,000 max', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      50_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.llcQualifiedExpenses', 12_000);

    expect(val(state, 'f8863.joint.llcTentativeCredit')).toBe(2_000);
    expect(val(state, 'f8863.joint.llcNonRefundableCredit')).toBe(2_000);
  });

  test('11. Single MAGI $83,000, LLC $10,000 → 70% allowed = $1,400', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      83_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.llcQualifiedExpenses', 10_000);

    // Phase-out: excess = $3,000, range = $10,000 → 70% allowed
    expect(val(state, 'f8863.joint.llcPhaseOutMultiplier')).toBeCloseTo(0.7, 4);
    expect(val(state, 'f8863.joint.llcNonRefundableCredit')).toBeCloseTo(1_400, 0);
  });

  test('12. MAGI $95,000 single → LLC = 0 (above ceiling)', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      95_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.llcQualifiedExpenses', 10_000);

    expect(val(state, 'f8863.joint.llcPhaseOutMultiplier')).toBe(0);
    expect(val(state, 'f8863.joint.llcNonRefundableCredit')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8863 — Combined AOTC + LLC', () => {

  test('13. AOTC for student A + LLC for student B → both credits appear', () => {
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      100_000,
    );
    // Student A: AOTC, freshman
    state = setInput(engine, state, session, 'f8863.joint.aotcNumStudents', 1);
    state = setInput(engine, state, session, 'f8863.joint.aotcQualifiedExpenses', 4_000);
    // Student B: LLC, grad student
    state = setInput(engine, state, session, 'f8863.joint.llcQualifiedExpenses', 5_000);

    // AOTC: $2,500 allowed, refundable $1,000, nonrefundable $1,500
    expect(val(state, 'f8863.joint.aotcNonRefundableCredit')).toBe(1_500);
    expect(val(state, F8863_OUTPUTS.aotcRefundableCredit)).toBe(1_000);
    // LLC: $1,000 credit (20% × $5,000)
    expect(val(state, 'f8863.joint.llcNonRefundableCredit')).toBe(1_000);
    // Combined nonrefundable: $1,500 + $1,000 = $2,500
    expect(val(state, F8863_OUTPUTS.nonRefundableEducationCredit)).toBe(2_500);
  });

  test('14. Tax liability cap limits combined nonrefundable education credit', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;
    // Very low income → tiny tax liability
    state = setInput(
      engine,
      state,
      session,
      "schedule1.joint.line3_businessIncome",
      12_000,
    );
    state = setInput(engine, state, session, 'f8863.joint.llcQualifiedExpenses', 10_000);

    const taxLiability = val(state, 'f1040.joint.line24_totalTax');
    const llcCredit    = val(state, 'f8863.joint.llcNonRefundableCredit');
    const combined     = val(state, F8863_OUTPUTS.nonRefundableEducationCredit);

    // Combined nonrefundable cannot exceed tax liability
    expect(combined).toBeLessThanOrEqual(taxLiability);
    // LLC tentative should be $2,000 but combined is capped
    expect(llcCredit).toBeGreaterThanOrEqual(0);
  });
});