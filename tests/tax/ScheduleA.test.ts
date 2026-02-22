/**
 * SCHEDULE A — TESTS
 * Itemized Deductions
 *
 * Test scenarios:
 *
 *   Medical expenses (Lines 1–4):
 *   1.  Medical expenses below 7.5% AGI floor → deductible = 0
 *   2.  Medical expenses exactly at floor → deductible = 0
 *   3.  Medical expenses above floor → deductible = expenses − floor
 *   4.  AGI floor is read from Form 1040 Line 11 (computed AGI, not manual input)
 *   5.  Zero medical expenses → zero deductible medical
 *
 *   SALT — Taxes You Paid (Lines 5a–7):
 *   6.  SALT under cap (single) → full deduction, no cap applied
 *   7.  SALT over cap (single) → capped at $10,000
 *   8.  SALT exactly at cap → $10,000
 *   9.  MFS filing → SALT capped at $5,000
 *   10. MFJ filing → SALT capped at $10,000 (same as single)
 *   11. Three SALT components (5a + 5b + 5c) all sum into 5d, then 5e applies cap
 *   12. Other taxes (Line 6) add to Line 7 total
 *   13. Line 7 = Line 5e + Line 6
 *
 *   Interest (Lines 8a–10):
 *   14. Mortgage interest from Form 1098 (8a) flows to 8e and Line 10
 *   15. Three mortgage lines (8a + 8b + 8c) sum into 8e
 *   16. Investment interest (Line 9) adds to Line 10
 *   17. Line 10 = Line 8e + Line 9
 *
 *   Charitable contributions (Lines 11–14):
 *   18. Cash contributions (Line 11) flow to Line 14
 *   19. Non-cash contributions (Line 12) add to Line 14
 *   20. Carryover (Line 13) adds to Line 14
 *   21. Line 14 = Lines 11 + 12 + 13
 *
 *   Casualty and other (Lines 15–16):
 *   22. Casualty losses (Line 15) add to Line 17
 *   23. Other deductions (Line 16) add to Line 17
 *
 *   Line 17 — Total itemized deductions:
 *   24. Line 17 = lines 4 + 7 + 10 + 14 + 15 + 16 (full identity test)
 *   25. Zero inputs → Line 17 = 0
 *   26. Real-world MFJ scenario: mortgage + SALT capped + charity
 *   27. OUTPUTS.totalItemizedDeductions matches hard-coded node ID
 *
 *   Constants:
 *   28. 2025 constants: SALT caps, medical floor, charitable limits
 */

import { TaxGraphEngineImpl }    from '../../src/core/graph/engine';
import { InputEventSource }       from '../../src/core/graph/engine.types';
import { F8889_NODES }            from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }            from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }        from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }        from '../../src/tax/forms/schedule2/nodes';
import { W2_INITIAL_AGGREGATORS } from '../../src/tax/forms/w2/nodes';
import { F1040_NODES }            from '../../src/tax/forms/f1040/nodes';
import { F1040_PAYMENT_NODES }    from '../../src/tax/forms/f1040/payments';
import {
  SCHEDULE_A_NODES,
  SCHEDULE_A_OUTPUTS,
} from '../../src/tax/forms/schedule-a/nodes';
import { SCHEDULE_A_CONSTANTS_2025 } from '../../src/tax/forms/schedule-a/constants';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeEngine(filingStatus = 'single') {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
    ...F1040_PAYMENT_NODES,
    ...SCHEDULE_A_NODES,
  ]);

  const session = {
    taxYear: '2025',
    filingStatus,
    hasSpouse: false,
    sessionKey: 'test-schedule-a',
  };

  return { engine, session };
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

// Shorthand: set a scheduleA.joint.* node
function setA(
  engine:  TaxGraphEngineImpl,
  state:   Record<string, any>,
  session: any,
  field:   string,
  value:   any,
) {
  return setInput(engine, state, session, `scheduleA.joint.${field}`, value);
}

function valA(state: Record<string, any>, field: string): number {
  return val(state, `scheduleA.joint.${field}`);
}

// Drive AGI via Schedule 1 business income (same pattern as F8863 tests)
function setAgi(
  engine:  TaxGraphEngineImpl,
  state:   Record<string, any>,
  session: any,
  agi:     number,
) {
  return setInput(engine, state, session, 'schedule1.joint.line3_businessIncome', agi);
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDICAL EXPENSES (Lines 1–4)
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule A — Medical Expenses (Lines 1–4)', () => {

  test('1. Medical expenses below 7.5% AGI floor → deductible = 0', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // AGI = $60,000 → floor = $4,500
    state = setAgi(engine, state, session, 60_000);
    // Expenses = $3,000 — below floor
    state = setA(engine, state, session, 'line1_medicalExpenses', 3_000);

    expect(valA(state, 'line3_medicalFloor')).toBe(4_500);
    expect(valA(state, 'line4_deductibleMedical')).toBe(0);
    expect(val(state, SCHEDULE_A_OUTPUTS.deductibleMedical)).toBe(0);
  });

  test('2. Medical expenses exactly at the 7.5% floor → deductible = 0', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // AGI = $80,000 → floor = $6,000
    state = setAgi(engine, state, session, 80_000);
    state = setA(engine, state, session, 'line1_medicalExpenses', 6_000);

    expect(valA(state, 'line3_medicalFloor')).toBe(6_000);
    expect(valA(state, 'line4_deductibleMedical')).toBe(0);
  });

  test('3. Medical expenses above floor → deductible = expenses minus floor', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // AGI = $100,000 → floor = $7,500
    state = setAgi(engine, state, session, 100_000);
    // Expenses = $15,000 → deductible = $15,000 − $7,500 = $7,500
    state = setA(engine, state, session, 'line1_medicalExpenses', 15_000);

    expect(valA(state, 'line3_medicalFloor')).toBe(7_500);
    expect(valA(state, 'line4_deductibleMedical')).toBe(7_500);
  });

  test('3b. Precise floor computation: AGI × 7.5% rounded correctly', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // AGI = $50,000 → floor = $3,750.00 exactly
    state = setAgi(engine, state, session, 50_000);
    state = setA(engine, state, session, 'line1_medicalExpenses', 10_000);

    expect(valA(state, 'line3_medicalFloor')).toBe(3_750);
    expect(valA(state, 'line4_deductibleMedical')).toBe(6_250);  // 10_000 − 3_750
  });

  test('4. AGI is sourced from Form 1040 Line 11 (reflects computed AGI)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // Set AGI indirectly via income, not directly on scheduleA
    state = setAgi(engine, state, session, 40_000);
    state = setA(engine, state, session, 'line1_medicalExpenses', 5_000);

    // Line 2 (AGI mirror on Schedule A) should equal the engine-computed AGI
    const schedulaAgi = valA(state, 'line2_agi');
    const f1040Agi    = val(state, 'f1040.joint.line11_adjustedGrossIncome');

    expect(schedulaAgi).toBe(f1040Agi);
    // Floor = 40_000 × 7.5% = 3_000 → deductible = 5_000 − 3_000 = 2_000
    expect(valA(state, 'line4_deductibleMedical')).toBe(2_000);
  });

  test('5. Zero medical expenses → deductible medical = 0', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setAgi(engine, state, session, 100_000);
    // line1 left at default 0

    expect(valA(state, 'line4_deductibleMedical')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SALT — TAXES YOU PAID (Lines 5a–7)
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule A — SALT and Taxes Paid (Lines 5a–7)', () => {

  test('6. SALT under cap (single) → full amount deductible, no cap applied', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 4_000);
    state = setA(engine, state, session, 'line5b_realEstateTax',        3_000);

    expect(valA(state, 'line5d_saltSubtotal')).toBe(7_000);
    expect(valA(state, 'line5e_saltDeduction')).toBe(7_000);  // under $10K cap
  });

  test('7. SALT over cap (single) → capped at $10,000', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax',  8_000);
    state = setA(engine, state, session, 'line5b_realEstateTax',         6_000);  // total 14_000

    expect(valA(state, 'line5d_saltSubtotal')).toBe(14_000);
    expect(valA(state, 'line5e_saltDeduction')).toBe(10_000);  // capped
    expect(val(state, SCHEDULE_A_OUTPUTS.saltDeduction)).toBe(10_000);
  });

  test('8. SALT exactly at cap → $10,000 (no rounding issues)', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 6_000);
    state = setA(engine, state, session, 'line5b_realEstateTax',        4_000);  // total = 10_000

    expect(valA(state, 'line5d_saltSubtotal')).toBe(10_000);
    expect(valA(state, 'line5e_saltDeduction')).toBe(10_000);
  });

  test('9. MFS filing → SALT capped at $5,000', () => {
    const { engine, session } = makeEngine('married_filing_separately');
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 4_000);
    state = setA(engine, state, session, 'line5b_realEstateTax',        4_000);  // total 8_000

    expect(valA(state, 'line5d_saltSubtotal')).toBe(8_000);
    expect(valA(state, 'line5e_saltDeduction')).toBe(5_000);  // MFS cap
  });

  test('10. MFJ filing → SALT capped at $10,000 (same as single)', () => {
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 7_000);
    state = setA(engine, state, session, 'line5b_realEstateTax',        6_000);  // total 13_000

    expect(valA(state, 'line5e_saltDeduction')).toBe(10_000);  // capped at $10K for MFJ
  });

  test('11. All three SALT components (5a + 5b + 5c) sum into 5d, then cap applied to 5e', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 5_000);
    state = setA(engine, state, session, 'line5b_realEstateTax',        4_000);
    state = setA(engine, state, session, 'line5c_personalPropertyTax',  3_000);  // total 12_000

    expect(valA(state, 'line5d_saltSubtotal')).toBe(12_000);
    expect(val(state, SCHEDULE_A_OUTPUTS.saltSubtotal)).toBe(12_000);
    expect(valA(state, 'line5e_saltDeduction')).toBe(10_000);  // capped
  });

  test('12. Other taxes (Line 6) add to Line 7 total', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 6_000);
    state = setA(engine, state, session, 'line6_otherTaxes',            1_500);

    expect(valA(state, 'line5e_saltDeduction')).toBe(6_000);
    expect(valA(state, 'line7_totalTaxesPaid')).toBe(7_500);
  });

  test('13. Line 7 = Line 5e + Line 6', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 12_000);  // → 5e = 10_000
    state = setA(engine, state, session, 'line6_otherTaxes',             2_000);

    const line5e = valA(state, 'line5e_saltDeduction');   // 10_000
    const line6  = valA(state, 'line6_otherTaxes');       // 2_000
    const line7  = valA(state, 'line7_totalTaxesPaid');   // 12_000

    expect(line7).toBe(line5e + line6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INTEREST (Lines 8a–10)
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule A — Interest Paid (Lines 8a–10)', () => {

  test('14. Mortgage interest from Form 1098 (8a) flows through 8e to Line 10', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line8a_mortgageInterest1098', 18_000);

    expect(valA(state, 'line8e_totalMortgageInterest')).toBe(18_000);
    expect(valA(state, 'line10_totalInterest')).toBe(18_000);
  });

  test('15. Three mortgage lines (8a + 8b + 8c) sum correctly into 8e', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line8a_mortgageInterest1098', 14_000);
    state = setA(engine, state, session, 'line8b_mortgageInterestOther',  3_000);
    state = setA(engine, state, session, 'line8c_points',                  1_500);

    expect(valA(state, 'line8e_totalMortgageInterest')).toBe(18_500);
  });

  test('16. Investment interest (Line 9) adds to Line 10', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line8a_mortgageInterest1098', 12_000);
    state = setA(engine, state, session, 'line9_investmentInterest',      2_000);

    expect(valA(state, 'line10_totalInterest')).toBe(14_000);
  });

  test('17. Line 10 = Line 8e + Line 9', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line8a_mortgageInterest1098', 20_000);
    state = setA(engine, state, session, 'line8b_mortgageInterestOther',  1_000);
    state = setA(engine, state, session, 'line9_investmentInterest',      3_000);

    const line8e = valA(state, 'line8e_totalMortgageInterest');  // 21_000
    const line9  = valA(state, 'line9_investmentInterest');      // 3_000
    const line10 = valA(state, 'line10_totalInterest');          // 24_000

    expect(line10).toBe(line8e + line9);
    expect(line10).toBe(24_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHARITABLE CONTRIBUTIONS (Lines 11–14)
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule A — Charitable Contributions (Lines 11–14)', () => {

  test('18. Cash contributions (Line 11) flow to Line 14', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line11_cashContributions', 5_000);

    expect(valA(state, 'line14_totalCharitableContributions')).toBe(5_000);
    expect(val(state, SCHEDULE_A_OUTPUTS.totalCharitableContributions)).toBe(5_000);
  });

  test('19. Non-cash contributions (Line 12) add to Line 14', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line11_cashContributions',   3_000);
    state = setA(engine, state, session, 'line12_nonCashContributions', 2_000);

    expect(valA(state, 'line14_totalCharitableContributions')).toBe(5_000);
  });

  test('20. Carryover (Line 13) adds to Line 14', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line11_cashContributions', 4_000);
    state = setA(engine, state, session, 'line13_charitableCarryover', 1_500);

    expect(valA(state, 'line14_totalCharitableContributions')).toBe(5_500);
  });

  test('21. Line 14 = Lines 11 + 12 + 13', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line11_cashContributions',    6_000);
    state = setA(engine, state, session, 'line12_nonCashContributions', 2_500);
    state = setA(engine, state, session, 'line13_charitableCarryover',  1_000);

    const line11 = valA(state, 'line11_cashContributions');
    const line12 = valA(state, 'line12_nonCashContributions');
    const line13 = valA(state, 'line13_charitableCarryover');
    const line14 = valA(state, 'line14_totalCharitableContributions');

    expect(line14).toBe(line11 + line12 + line13);
    expect(line14).toBe(9_500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CASUALTY / OTHER (Lines 15–16)
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule A — Casualty and Other Deductions (Lines 15–16)', () => {

  test('22. Casualty losses (Line 15) add to Line 17 total', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line15_casualtyLosses', 8_000);

    expect(valA(state, 'line17_totalItemizedDeductions')).toBe(8_000);
  });

  test('23. Other deductions (Line 16) add to Line 17 total', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setA(engine, state, session, 'line16_otherDeductions', 1_200);

    expect(valA(state, 'line17_totalItemizedDeductions')).toBe(1_200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LINE 17 — TOTAL ITEMIZED DEDUCTIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule A — Line 17 Total Itemized Deductions', () => {

  test('24. Line 17 = Lines 4 + 7 + 10 + 14 + 15 + 16 (full identity)', () => {
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;

    // Medical: AGI 120_000 → floor 9_000; expenses 20_000 → deductible 11_000
    state = setAgi(engine, state, session, 120_000);
    state = setA(engine, state, session, 'line1_medicalExpenses', 20_000);

    // Taxes: SALT 8_000 (under cap) + other 500 → line7 = 8_500
    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 5_000);
    state = setA(engine, state, session, 'line5b_realEstateTax',        3_000);
    state = setA(engine, state, session, 'line6_otherTaxes',              500);

    // Interest: mortgage 18_000 + investment 2_000 → line10 = 20_000
    state = setA(engine, state, session, 'line8a_mortgageInterest1098', 18_000);
    state = setA(engine, state, session, 'line9_investmentInterest',     2_000);

    // Charity: cash 5_000 + non-cash 1_000 → line14 = 6_000
    state = setA(engine, state, session, 'line11_cashContributions',    5_000);
    state = setA(engine, state, session, 'line12_nonCashContributions', 1_000);

    // Casualty + other
    state = setA(engine, state, session, 'line15_casualtyLosses',  3_000);
    state = setA(engine, state, session, 'line16_otherDeductions',    500);

    const line4  = valA(state, 'line4_deductibleMedical');           // 11_000
    const line7  = valA(state, 'line7_totalTaxesPaid');              // 8_500
    const line10 = valA(state, 'line10_totalInterest');              // 20_000
    const line14 = valA(state, 'line14_totalCharitableContributions'); // 6_000
    const line15 = valA(state, 'line15_casualtyLosses');             // 3_000
    const line16 = valA(state, 'line16_otherDeductions');            // 500
    const line17 = valA(state, 'line17_totalItemizedDeductions');

    expect(line4).toBe(11_000);
    expect(line7).toBe(8_500);
    expect(line10).toBe(20_000);
    expect(line14).toBe(6_000);
    expect(line17).toBe(line4 + line7 + line10 + line14 + line15 + line16);
    expect(line17).toBe(49_000);
  });

  test('25. Zero inputs → Line 17 = 0', () => {
    const { engine, session } = makeEngine();
    const state = engine.initializeSession(session).currentState;

    expect(valA(state, 'line17_totalItemizedDeductions')).toBe(0);
    expect(val(state, SCHEDULE_A_OUTPUTS.totalItemizedDeductions)).toBe(0);
  });

  test('26. Real-world MFJ scenario: mortgage + SALT capped + charity', () => {
    // Married couple: $180K AGI, owns a home, state taxes near cap
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;

    state = setAgi(engine, state, session, 180_000);

    // Medical: $8,000 expenses; floor = 180_000 × 7.5% = $13,500 → no deduction
    state = setA(engine, state, session, 'line1_medicalExpenses', 8_000);

    // SALT: $7,000 state income + $6,000 real estate = $13,000 → capped at $10,000
    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 7_000);
    state = setA(engine, state, session, 'line5b_realEstateTax',        6_000);

    // Mortgage: $22,000 on Form 1098
    state = setA(engine, state, session, 'line8a_mortgageInterest1098', 22_000);

    // Charity: $8,000 cash donations
    state = setA(engine, state, session, 'line11_cashContributions', 8_000);

    expect(valA(state, 'line4_deductibleMedical')).toBe(0);        // below floor
    expect(valA(state, 'line5e_saltDeduction')).toBe(10_000);       // capped (MFJ = $10K)
    expect(valA(state, 'line8e_totalMortgageInterest')).toBe(22_000);
    expect(valA(state, 'line14_totalCharitableContributions')).toBe(8_000);
    // Total: 0 + 10_000 + 22_000 + 8_000 = 40_000
    expect(valA(state, 'line17_totalItemizedDeductions')).toBe(40_000);
    expect(val(state, SCHEDULE_A_OUTPUTS.totalItemizedDeductions)).toBe(40_000);
  });

  test('26b. High medical + SALT under cap scenario (single, low income)', () => {
    // Single filer: $40K AGI, large medical bills, SALT under cap
    const { engine, session } = makeEngine('single');
    let state = engine.initializeSession(session).currentState;

    state = setAgi(engine, state, session, 40_000);

    // Medical: $10,000; floor = 40_000 × 7.5% = $3,000 → deductible $7,000
    state = setA(engine, state, session, 'line1_medicalExpenses', 10_000);

    // SALT: $4,200 (under $10K cap)
    state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 2_500);
    state = setA(engine, state, session, 'line5b_realEstateTax',        1_700);

    // Charity: $2,000
    state = setA(engine, state, session, 'line11_cashContributions', 2_000);

    expect(valA(state, 'line4_deductibleMedical')).toBe(7_000);
    expect(valA(state, 'line5e_saltDeduction')).toBe(4_200);   // no cap applied
    // Total: 7_000 + 4_200 + 2_000 = 13_200
    expect(valA(state, 'line17_totalItemizedDeductions')).toBe(13_200);
  });

  test('27. OUTPUTS.totalItemizedDeductions matches hard-coded node ID', () => {
    expect(SCHEDULE_A_OUTPUTS.totalItemizedDeductions).toBe('scheduleA.joint.line17_totalItemizedDeductions');
    expect(SCHEDULE_A_OUTPUTS.saltSubtotal).toBe('scheduleA.joint.line5d_saltSubtotal');
    expect(SCHEDULE_A_OUTPUTS.saltDeduction).toBe('scheduleA.joint.line5e_saltDeduction');
    expect(SCHEDULE_A_OUTPUTS.deductibleMedical).toBe('scheduleA.joint.line4_deductibleMedical');
    expect(SCHEDULE_A_OUTPUTS.totalCharitableContributions).toBe('scheduleA.joint.line14_totalCharitableContributions');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule A — 2025 Constants', () => {

  test('28. All 2025 constants are correct', () => {
    const c = SCHEDULE_A_CONSTANTS_2025;

    expect(c.taxYear).toBe('2025');

    // SALT caps
    expect(c.saltCap.standard).toBe(10_000);
    expect(c.saltCap.marriedFilingSeparately).toBe(5_000);

    // Medical floor
    expect(c.medicalExpenseAgiFloor).toBe(0.075);

    // Charitable limits
    expect(c.charitableContribution.cashAgiLimit).toBe(0.60);
    expect(c.charitableContribution.capitalGainPropertyAgiLimit).toBe(0.30);

    // Mortgage debt limit
    expect(c.mortgageDebtLimit.standard).toBe(750_000);
    expect(c.mortgageDebtLimit.marriedFilingSeparately).toBe(375_000);
  });

  test('28b. SALT cap for all non-MFS statuses is $10,000', () => {
    // single, MFJ, and HOH all use the standard $10K cap
    for (const status of ['single', 'married_filing_jointly', 'head_of_household']) {
      const { engine, session } = makeEngine(status);
      let state = engine.initializeSession(session).currentState;

      state = setA(engine, state, session, 'line5a_stateLocalIncomeTax', 15_000);

      expect(valA(state, 'line5e_saltDeduction')).toBe(10_000);
    }
  });

  test('28c. Medical floor: 7.5% = 0.075', () => {
    // Verify the computation: AGI = $1 → floor = $0.08 (rounds to nearest cent)
    const c = SCHEDULE_A_CONSTANTS_2025;
    expect(c.medicalExpenseAgiFloor).toBe(0.075);

    // Sanity: floor computation on round numbers
    const floor100k = Math.round(100_000 * c.medicalExpenseAgiFloor * 100) / 100;
    expect(floor100k).toBe(7_500);
  });
});