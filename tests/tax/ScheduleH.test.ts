/**
 * SCHEDULE H — TESTS
 * Household Employment Taxes
 *
 * Test scenarios:
 *
 *   Eligibility gating:
 *   1.  Line A = false → no FICA tax regardless of wages entered
 *   2.  Line B = false → no FUTA tax regardless of wages entered
 *   3.  Both flags false → Line 12 = 0
 *   4.  Line A = true, wages = 0 → FICA = 0 (no wages to tax)
 *
 *   FICA (Part I):
 *   5.  Wages below $2,800 threshold → computeHouseholdFica returns 0
 *   6.  Wages exactly at threshold ($2,800) → FICA computed
 *   7.  Typical nanny wages ($30,000) → 15.3% × $30,000
 *   8.  Wages at SS wage base ($176,100) → 15.3% applies to full amount
 *   9.  Wages above SS wage base ($200,000) → SS capped, Medicare uncapped
 *   10. Line 3 = Line 1 (common case) → Line 4 = 0 (no double-count)
 *   11. Line 3 > Line 1 (wages above SS base) → Line 4 = additional Medicare only
 *   12. Federal withholding (Line 5) adds to Line 6, does not affect FICA
 *   13. Line 6 = Line 2 + Line 4 + Line 5
 *
 *   FUTA (Part II):
 *   14. FUTA on wages below $7,000 → 0.6% net (with full state credit)
 *   15. FUTA on wages above $7,000 → capped at $7,000 per employee
 *   16. Gross FUTA rate: Line 7 × 6.0%
 *   17. Full state UI credit: net FUTA = 0.6% of Line 7
 *   18. No state UI paid → full 6.0% net FUTA
 *   19. Partial state UI → partial credit
 *   20. State UI exceeds max credit → credit capped at 5.4%
 *   21. FUTA wage base: $7,000 per employee correctly described
 *
 *   Line 12 — Total:
 *   22. FICA only (no FUTA eligible) → Line 12 = Line 6
 *   23. FUTA only (no FICA eligible) → Line 12 = Line 11
 *   24. Both FICA + FUTA → Line 12 = Line 6 + Line 11
 *   25. No deductible half — unlike SE tax, no companion deduction node
 *
 *   Constants:
 *   26. 2025 constants: thresholds, rates, wage base correct
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
  SCHEDULE_H_NODES,
  SCHEDULE_H_OUTPUTS,
} from '../../src/tax/forms/schedule-h/nodes';
import {
  SCHEDULE_H_CONSTANTS_2025,
  computeHouseholdFica,
  computeFuta,
} from '../../src/tax/forms/schedule-h/constants';

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
    ...SCHEDULE_H_NODES,
  ]);

  const session = {
    taxYear: '2025',
    filingStatus,
    hasSpouse: false,
    sessionKey: 'test-schedule-h',
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

// Shorthand for schedule H joint nodes
function setH(
  engine:  TaxGraphEngineImpl,
  state:   Record<string, any>,
  session: any,
  field:   string,
  value:   any,
) {
  return setInput(engine, state, session, `scheduleH.joint.${field}`, value);
}

function valH(state: Record<string, any>, field: string): number {
  return val(state, `scheduleH.joint.${field}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ELIGIBILITY GATING
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule H — Eligibility Gating', () => {

  test('1. Line A = false → no FICA tax regardless of wages on Line 1', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // Wages entered but flag not set — default is false
    state = setH(engine, state, session, 'line1_ssWages', 50_000);

    expect(valH(state, 'lineA_ficaEligible')).toBeFalsy();
    expect(valH(state, 'line2_ficaTax')).toBe(0);
    expect(valH(state, 'line6_ficaAndWithholding')).toBe(0);
  });

  test('2. Line B = false → no FUTA tax regardless of wages on Line 7', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'line7_futaWages', 14_000);

    expect(valH(state, 'lineB_futaEligible')).toBeFalsy();
    expect(valH(state, 'line8_futaBeforeCredit')).toBe(0);
    expect(valH(state, 'line11_netFuta')).toBe(0);
  });

  test('3. Both flags false → Line 12 total = 0', () => {
    const { engine, session } = makeEngine();
    const state = engine.initializeSession(session).currentState;

    expect(val(state, SCHEDULE_H_OUTPUTS.totalHouseholdTax)).toBe(0);
  });

  test('4. Line A = true, wages = 0 → FICA = 0 (flag set but no wages)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    // Line 1 left at default 0

    expect(valH(state, 'line2_ficaTax')).toBe(0);
    expect(val(state, SCHEDULE_H_OUTPUTS.totalHouseholdTax)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FICA — PART I
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule H — FICA Taxes (Part I)', () => {

  test('5. Wages below $2,800 threshold → computeHouseholdFica returns 0', () => {
    const c      = SCHEDULE_H_CONSTANTS_2025;
    const result = computeHouseholdFica(2_799, c);

    expect(result.totalFica).toBe(0);
    expect(result.employeeShare).toBe(0);
    expect(result.employerShare).toBe(0);
  });

  test('6. Wages exactly at $2,800 threshold → FICA computed at 15.3%', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    state = setH(engine, state, session, 'line1_ssWages', 2_800);

    // 2_800 × 15.3% = 428.40
    const expected = Math.round(2_800 * 0.153 * 100) / 100;
    expect(valH(state, 'line2_ficaTax')).toBe(expected);  // 428.40
  });

  test('7. Typical wages ($30,000) → 15.3% × $30,000 = $4,590', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    state = setH(engine, state, session, 'line1_ssWages', 30_000);

    // Combined FICA: 30_000 × 0.153 = 4_590
    expect(valH(state, 'line2_ficaTax')).toBe(4_590);
  });

  test('8. Wages exactly at SS wage base ($176,100) → 15.3% on full amount', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    state = setH(engine, state, session, 'line1_ssWages', 176_100);

    // Full 15.3% on 176_100
    const expected = Math.round(176_100 * 0.153 * 100) / 100;
    expect(valH(state, 'line2_ficaTax')).toBeCloseTo(expected, 1);
  });

  test('9. computeHouseholdFica: wages above SS base → SS capped, Medicare uncapped', () => {
    const c = SCHEDULE_H_CONSTANTS_2025;

    // $200,000 in wages — SS capped at $176,100
    const result = computeHouseholdFica(200_000, c);

    // Employee SS share: 176_100 × 6.2% = 10_918.20
    // Employee Medicare: 200_000 × 1.45% = 2_900.00
    // Each share = 13_818.20
    // Total FICA = 27_636.40
    const expectedEachShare = Math.round((176_100 * 0.062 + 200_000 * 0.0145) * 100) / 100;
    const expectedTotal     = Math.round(expectedEachShare * 2 * 100) / 100;

    expect(result.employeeShare).toBeCloseTo(expectedEachShare, 1);
    expect(result.employerShare).toBeCloseTo(expectedEachShare, 1);
    expect(result.totalFica).toBeCloseTo(expectedTotal, 1);
  });

  test('10. Line 3 = Line 1 (common case) → Line 4 = 0, no double-counting', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    state = setH(engine, state, session, 'line1_ssWages',        40_000);
    state = setH(engine, state, session, 'line3_medicareWages',  40_000);  // same as Line 1

    // Line 4 should be 0 — Medicare already captured in Line 2's 15.3%
    expect(valH(state, 'line4_additionalMedicare')).toBe(0);
    // Line 2 carries the full FICA
    expect(valH(state, 'line2_ficaTax')).toBe(Math.round(40_000 * 0.153 * 100) / 100);
  });

  test('11. Line 3 > Line 1 (wages above SS base) → Line 4 = 2.9% on excess only', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // $176,100 in SS wages, $200,000 in Medicare wages (employee earned $200K)
    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    state = setH(engine, state, session, 'line1_ssWages',       176_100);
    state = setH(engine, state, session, 'line3_medicareWages', 200_000);

    // Excess = 200_000 − 176_100 = 23_900
    // Additional Medicare (both shares) = 23_900 × 15.3% = 3_656.70
    const excessWages       = 200_000 - 176_100;
    const expectedAdditional = Math.round(excessWages * 0.153 * 100) / 100;

    expect(valH(state, 'line4_additionalMedicare')).toBeCloseTo(expectedAdditional, 1);
  });

  test('12. Federal withholding (Line 5) adds to Line 6, does not change FICA (Line 2)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    state = setH(engine, state, session, 'line1_ssWages',       30_000);
    state = setH(engine, state, session, 'line5_federalWithheld', 3_000);

    const ficaTax = valH(state, 'line2_ficaTax');  // 30_000 × 15.3% = 4_590

    expect(ficaTax).toBe(4_590);
    // Line 6 = FICA + withholding
    expect(valH(state, 'line6_ficaAndWithholding')).toBe(4_590 + 3_000);  // 7_590
  });

  test('13. Line 6 = Line 2 + Line 4 + Line 5', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    state = setH(engine, state, session, 'line1_ssWages',        176_100);
    state = setH(engine, state, session, 'line3_medicareWages',  200_000);  // Line 4 > 0
    state = setH(engine, state, session, 'line5_federalWithheld',  2_000);

    const line2 = valH(state, 'line2_ficaTax');
    const line4 = valH(state, 'line4_additionalMedicare');
    const line5 = valH(state, 'line5_federalWithheld');
    const line6 = valH(state, 'line6_ficaAndWithholding');

    expect(line6).toBeCloseTo(line2 + line4 + line5, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FUTA — PART II
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule H — FUTA (Part II)', () => {

  test('14. Wages under $7,000 — with full state credit, net FUTA = 0.6%', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // One employee paid $5,000 → FUTA wages = $5,000
    state = setH(engine, state, session, 'lineB_futaEligible', true);
    state = setH(engine, state, session, 'line7_futaWages',     5_000);
    // State UI paid on time = 5_000 × 5.4% = 270 (full credit)
    state = setH(engine, state, session, 'line9_stateUiTaxPaid', 270);

    // Gross = 5_000 × 6.0% = 300
    expect(valH(state, 'line8_futaBeforeCredit')).toBe(300);
    // Credit = min(270, 270) = 270
    expect(valH(state, 'line10_futaCredit')).toBe(270);
    // Net FUTA = 300 − 270 = 30 = 5_000 × 0.6%
    expect(valH(state, 'line11_netFuta')).toBe(30);
  });

  test('15. One employee at $20,000 → FUTA wages capped at $7,000 (preparer enters $7,000)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // Preparer correctly enters only the first $7,000 per employee
    state = setH(engine, state, session, 'lineB_futaEligible', true);
    state = setH(engine, state, session, 'line7_futaWages',     7_000);
    state = setH(engine, state, session, 'line9_stateUiTaxPaid', 378);  // 7_000 × 5.4%

    // Net FUTA = 7_000 × 0.6% = 42
    expect(valH(state, 'line8_futaBeforeCredit')).toBe(420);  // 7_000 × 6%
    expect(valH(state, 'line10_futaCredit')).toBe(378);
    expect(valH(state, 'line11_netFuta')).toBe(42);
  });

  test('16. Gross FUTA rate is 6.0% of Line 7', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineB_futaEligible', true);
    state = setH(engine, state, session, 'line7_futaWages', 10_000);

    // Gross before any credit = 10_000 × 6.0% = 600
    expect(valH(state, 'line8_futaBeforeCredit')).toBe(600);
  });

  test('17. Full state UI paid on time → net FUTA = 0.6% of wages', () => {
    const c = SCHEDULE_H_CONSTANTS_2025;

    const futaWages   = 14_000;  // two employees, each $7_000
    const stateUiPaid = Math.round(futaWages * c.futa.maxStateCredit * 100) / 100;  // 756

    const netFuta = computeFuta(futaWages, stateUiPaid, c);

    // Net = 14_000 × 0.6% = 84
    expect(netFuta).toBeCloseTo(futaWages * c.futa.netRateAfterCredit, 2);
    expect(netFuta).toBe(84);
  });

  test('18. No state UI paid → full 6.0% FUTA applies', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineB_futaEligible', true);
    state = setH(engine, state, session, 'line7_futaWages',     7_000);
    // Line 9 = 0 (no state UI paid)

    // No credit → full gross FUTA
    expect(valH(state, 'line10_futaCredit')).toBe(0);
    expect(valH(state, 'line11_netFuta')).toBe(420);  // 7_000 × 6%
  });

  test('19. Partial state UI paid → partial credit reduces FUTA', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineB_futaEligible', true);
    state = setH(engine, state, session, 'line7_futaWages',      7_000);
    // Only paid $200 in state UI (late or partial)
    state = setH(engine, state, session, 'line9_stateUiTaxPaid', 200);

    // Max credit = 7_000 × 5.4% = 378
    // Actual credit = min(200, 378) = 200
    // Net FUTA = 420 − 200 = 220
    expect(valH(state, 'line10_futaCredit')).toBe(200);
    expect(valH(state, 'line11_netFuta')).toBe(220);
  });

  test('20. State UI exceeds max credit → credit capped at 5.4% of FUTA wages', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineB_futaEligible', true);
    state = setH(engine, state, session, 'line7_futaWages',      7_000);
    // Overpaid state UI — $500 but max credit is only $378
    state = setH(engine, state, session, 'line9_stateUiTaxPaid',   500);

    // Credit capped at 7_000 × 5.4% = 378
    expect(valH(state, 'line10_futaCredit')).toBe(378);
    expect(valH(state, 'line11_netFuta')).toBe(42);   // 420 − 378 = 42
  });

  test('21. FUTA constants: gross 6%, max credit 5.4%, net 0.6%, wage base $7,000', () => {
    const c = SCHEDULE_H_CONSTANTS_2025;

    expect(c.futa.grossRate).toBe(0.060);
    expect(c.futa.maxStateCredit).toBe(0.054);
    expect(c.futa.netRateAfterCredit).toBe(0.006);
    expect(c.futa.wageBase).toBe(7_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LINE 12 — TOTAL HOUSEHOLD TAX
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule H — Line 12 Total Household Employment Taxes', () => {

  test('22. FICA only (FUTA not eligible) → Line 12 = Line 6', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    state = setH(engine, state, session, 'line1_ssWages', 35_000);
    // lineB_futaEligible left false

    const line6  = valH(state, 'line6_ficaAndWithholding');
    const line12 = val(state, SCHEDULE_H_OUTPUTS.totalHouseholdTax);

    expect(line6).toBe(Math.round(35_000 * 0.153 * 100) / 100);  // 5_355
    expect(line12).toBe(line6);
    expect(valH(state, 'line11_netFuta')).toBe(0);
  });

  test('23. FUTA only (FICA not eligible) → Line 12 = Line 11', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // lineA_ficaEligible left false — household workers each under $2,800 but quarterly total hit $1,000
    state = setH(engine, state, session, 'lineB_futaEligible', true);
    state = setH(engine, state, session, 'line7_futaWages',     5_000);
    state = setH(engine, state, session, 'line9_stateUiTaxPaid', 270);

    const line11 = valH(state, 'line11_netFuta');   // 30
    const line12 = val(state, SCHEDULE_H_OUTPUTS.totalHouseholdTax);

    expect(line11).toBe(30);
    expect(line12).toBe(30);
    expect(valH(state, 'line6_ficaAndWithholding')).toBe(0);
  });

  test('24. Both FICA + FUTA eligible → Line 12 = Line 6 + Line 11', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // FICA: $40,000 wages → 40_000 × 15.3% = 6_120
    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    state = setH(engine, state, session, 'line1_ssWages', 40_000);

    // FUTA: $7,000 wages, full state credit → 7_000 × 0.6% = 42
    state = setH(engine, state, session, 'lineB_futaEligible', true);
    state = setH(engine, state, session, 'line7_futaWages',      7_000);
    state = setH(engine, state, session, 'line9_stateUiTaxPaid',   378);

    const line6  = valH(state, 'line6_ficaAndWithholding');  // 6_120
    const line11 = valH(state, 'line11_netFuta');            // 42
    const line12 = val(state, SCHEDULE_H_OUTPUTS.totalHouseholdTax);

    expect(line6).toBe(6_120);
    expect(line11).toBe(42);
    expect(line12).toBe(6_162);
    expect(line12).toBe(line6 + line11);
  });

  test('24b. Real-world nanny scenario: $52,000 wages, $7,000 FUTA, full state credit', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setH(engine, state, session, 'lineA_ficaEligible', true);
    state = setH(engine, state, session, 'line1_ssWages',       52_000);
    state = setH(engine, state, session, 'lineB_futaEligible', true);
    state = setH(engine, state, session, 'line7_futaWages',      7_000);
    state = setH(engine, state, session, 'line9_stateUiTaxPaid',   378);

    // FICA: 52_000 × 15.3% = 7_956
    // FUTA: 7_000 × 0.6% = 42
    // Total: 7_998
    expect(valH(state, 'line2_ficaTax')).toBe(7_956);
    expect(valH(state, 'line11_netFuta')).toBe(42);
    expect(val(state, SCHEDULE_H_OUTPUTS.totalHouseholdTax)).toBe(7_998);
  });

  test('25. No deductible half — Schedule H has no companion deduction node', () => {
    // Verify there is no "deductibleHalf" or "deductibleAmount" node in SCHEDULE_H_NODES
    const nodeIds = SCHEDULE_H_NODES.map(n => n.id);
    const hasDeductibleHalf = nodeIds.some(id =>
      id.includes('deductible') || id.includes('Deductible')
    );
    expect(hasDeductibleHalf).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule H — 2025 Constants', () => {

  test('26. All 2025 thresholds and rates are correct', () => {
    const c = SCHEDULE_H_CONSTANTS_2025;

    expect(c.taxYear).toBe('2025');

    // Filing thresholds
    expect(c.ficaWageThreshold).toBe(2_800);
    expect(c.futaQuarterlyThreshold).toBe(1_000);
    expect(c.socialSecurityWageBase).toBe(176_100);

    // FICA rates
    expect(c.fica.socialSecurityRate).toBe(0.062);
    expect(c.fica.medicareRate).toBe(0.0145);
    expect(c.fica.totalEmployeeRate).toBe(0.0765);
    expect(c.fica.totalEmployerRate).toBe(0.0765);
    expect(c.fica.combinedRate).toBe(0.153);

    // FUTA rates
    expect(c.futa.grossRate).toBe(0.060);
    expect(c.futa.maxStateCredit).toBe(0.054);
    expect(c.futa.netRateAfterCredit).toBe(0.006);
    expect(c.futa.wageBase).toBe(7_000);
  });

  test('26b. OUTPUTS constant IDs match actual node IDs', () => {
    expect(SCHEDULE_H_OUTPUTS.totalHouseholdTax).toBe('scheduleH.joint.line12_totalHouseholdTax');
    expect(SCHEDULE_H_OUTPUTS.ficaTax).toBe('scheduleH.joint.line2_ficaTax');
    expect(SCHEDULE_H_OUTPUTS.netFuta).toBe('scheduleH.joint.line11_netFuta');
  });

  test('26c. computeHouseholdFica: employee share equals employer share', () => {
    const c      = SCHEDULE_H_CONSTANTS_2025;
    const result = computeHouseholdFica(50_000, c);

    expect(result.employeeShare).toBe(result.employerShare);
    expect(result.totalFica).toBe(result.employeeShare + result.employerShare);
  });

  test('26d. computeFuta: gross − credit = net, never negative', () => {
    const c = SCHEDULE_H_CONSTANTS_2025;

    // Normal case
    const net1 = computeFuta(7_000, 378, c);
    expect(net1).toBeGreaterThanOrEqual(0);
    expect(net1).toBe(42);

    // Credit exceeds gross (edge case — should not go negative)
    const net2 = computeFuta(1_000, 999, c);
    expect(net2).toBeGreaterThanOrEqual(0);

    // Zero wages → zero FUTA
    const net3 = computeFuta(0, 0, c);
    expect(net3).toBe(0);
  });
});