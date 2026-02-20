// __tests__/form-8880.test.ts
/**
 * FORM 8880 — SAVER'S CREDIT — TESTS
 *
 * Form 8880 test scenarios:
 *   Saver's Credit — Rate Lookup
 *   25. Single, AGI $20,000 → 50% rate
 *   26. Single, AGI $21,750 → 50% rate (at boundary)
 *   27. Single, AGI $21,751 → 20% rate (just above 50% threshold)
 *   28. Single, AGI $23,750 → 20% rate (at boundary)
 *   29. Single, AGI $23,751 → 10% rate
 *   30. Single, AGI $36,500 → 10% rate (at boundary)
 *   31. Single, AGI $36,501 → 0% rate, credit = 0
 *   32. MFJ, AGI $43,500 → 50% rate
 *   33. MFJ, AGI $73,000 → 10% rate (at boundary)
 *   34. MFJ, AGI $73,001 → 0% rate, credit = 0
 *   35. HoH, AGI $32,625 → 50% rate
 *   36. HoH, AGI $54,750 → 10% rate (at boundary)
 *   37. HoH, AGI $54,751 → 0% rate, credit = 0
 *
 *   Saver's Credit — Contribution Cap and Distribution Offset
 *   38. Primary contribution $2,000 exactly → no cap applied
 *   39. Primary contribution $3,000 → capped at $2,000
 *   40. Contributions $2,000, distributions $500 → qualifying amount $1,500
 *   41. Contributions $2,000, distributions $2,500 → qualifying amount $0
 *   42. MFJ — primary $2,000 + spouse $2,000 → $4,000 total × rate
 *   43. MFJ — spouse contributions 0 → only primary counts
 *   44. MFJ — spouse distributions reduce spouse qualifying amount independently
 *
 *   Saver's Credit — Tax Liability Cap
 *   45. Credit exceeds tax liability → capped at tax (nonrefundable)
 *   46. Zero tax liability → credit = 0
 *   47. Tax exceeds tentative credit → full tentative credit allowed
 *
 *   Saver's Credit — isApplicable Gate
 *   48. Rate = 0% → credit skipped (AGI too high)
 *   49. Contributions = 0 → credit skipped
 *   50. Rate > 0 and contributions > 0 → credit computed
 */

import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { InputEventSource } from '../../src/core/graph/engine.types';
import { F8889_NODES } from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES } from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES } from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES } from '../../src/tax/forms/schedule2/nodes';
import { W2_INITIAL_AGGREGATORS } from '../../src/tax/forms/w2/nodes';
import { F1040_NODES } from '../../src/tax/forms/f1040/nodes';
import { F8880_NODES, F8880_OUTPUTS } from '../../src/tax/forms/f8880/nodes';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS (Form 8880)
// ─────────────────────────────────────────────────────────────────────────────

function make8880Engine(filingStatus: string = 'single') {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
    ...F8880_NODES,
  ]);
  return {
    engine,
    session: {
      taxYear: '2025',
      filingStatus,
      hasSpouse: filingStatus === 'married_filing_jointly',
      sessionKey: 'test-f8880',
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

function num(state: Record<string, any>, id: string): number {
  return (state[id]?.value as number) ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM 8880 — CREDIT RATE LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

describe("Form 8880 — Saver's Credit Rate Lookup", () => {
  test('25. Single, AGI $20,000 → 50% rate', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 20_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.5);
  });

  test('26. Single, AGI $21,750 → 50% rate (at boundary)', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 21_750);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.5);
  });

  test('27. Single, AGI $21,751 → 20% rate (just above 50% threshold)', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 21_751);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.2);
  });

  test('28. Single, AGI $23,750 → 20% rate (at boundary)', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 23_750);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.2);
  });

  test('29. Single, AGI $23,751 → 10% rate', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 23_751);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.1);
  });

  test('30. Single, AGI $36,500 → 10% rate (at boundary)', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 36_500);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.1);
  });

  test('31. Single, AGI $36,501 → 0% rate, credit = 0', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 36_501);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0);
    expect(num(state, F8880_OUTPUTS.credit)).toBe(0);
  });

  test('32. MFJ, AGI $43,500 → 50% rate', () => {
    const { engine, session } = make8880Engine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 43_500);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.5);
  });

  test('33. MFJ, AGI $73,000 → 10% rate (at boundary)', () => {
    const { engine, session } = make8880Engine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 73_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.1);
  });

  test('34. MFJ, AGI $73,001 → 0% rate, credit = 0', () => {
    const { engine, session } = make8880Engine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 73_001);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0);
    expect(num(state, F8880_OUTPUTS.credit)).toBe(0);
  });

  test('35. HoH, AGI $32,625 → 50% rate', () => {
    const { engine, session } = make8880Engine('head_of_household');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 32_625);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.5);
  });

  test('36. HoH, AGI $54,750 → 10% rate (at boundary)', () => {
    const { engine, session } = make8880Engine('head_of_household');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 54_750);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.1);
  });

  test('37. HoH, AGI $54,751 → 0% rate, credit = 0', () => {
    const { engine, session } = make8880Engine('head_of_household');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 54_751);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0);
    expect(num(state, F8880_OUTPUTS.credit)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM 8880 — CONTRIBUTION CAP AND DISTRIBUTION OFFSET
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8880 — Contribution Cap and Distribution Offset', () => {
  test('38. Primary contribution $2,000 exactly → no cap applied, qualifying = $2,000', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 20_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line3_primaryQualifyingAmount')).toBe(2_000);
  });

  test('39. Primary contribution $3,000 → capped at $2,000', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 20_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 3_000);

    expect(num(state, 'f8880.joint.line3_primaryQualifyingAmount')).toBe(2_000);
  });

  test('40. Contributions $2,000, distributions $500 → qualifying = $1,500', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 20_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);
    state = setInput(engine, state, session, 'f8880.joint.line2_primaryDistributions', 500);

    expect(num(state, 'f8880.joint.line3_primaryQualifyingAmount')).toBe(1_500);
    expect(num(state, 'f8880.joint.line7_tentativeCredit')).toBe(750);
  });

  test('41. Distributions exceed capped contribution → qualifying = $0', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 20_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);
    state = setInput(engine, state, session, 'f8880.joint.line2_primaryDistributions', 2_500);

    expect(num(state, 'f8880.joint.line3_primaryQualifyingAmount')).toBe(0);
    expect(num(state, F8880_OUTPUTS.credit)).toBe(0);
  });

  test('42. MFJ — primary $2,000 + spouse $2,000 → Line 4 = $4,000', () => {
    const { engine, session } = make8880Engine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 40_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);
    state = setInput(engine, state, session, 'f8880.joint.line1b_spouseContributions', 2_000);

    expect(num(state, 'f8880.joint.line3_primaryQualifyingAmount')).toBe(2_000);
    expect(num(state, 'f8880.joint.line3b_spouseQualifyingAmount')).toBe(2_000);
    expect(num(state, 'f8880.joint.line4_totalQualifyingContributions')).toBe(4_000);
    expect(num(state, 'f8880.joint.line7_tentativeCredit')).toBe(2_000);
  });

  test('43. MFJ — spouse contributions = 0 → only primary counts', () => {
    const { engine, session } = make8880Engine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 40_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line4_totalQualifyingContributions')).toBe(2_000);
    expect(num(state, 'f8880.joint.line7_tentativeCredit')).toBe(1_000);
  });

  test('44. MFJ — spouse distributions reduce spouse qualifying amount independently', () => {
    const { engine, session } = make8880Engine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 40_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);
    state = setInput(engine, state, session, 'f8880.joint.line1b_spouseContributions', 2_000);
    state = setInput(engine, state, session, 'f8880.joint.line2b_spouseDistributions', 1_000);

    expect(num(state, 'f8880.joint.line3_primaryQualifyingAmount')).toBe(2_000);
    expect(num(state, 'f8880.joint.line3b_spouseQualifyingAmount')).toBe(1_000);
    expect(num(state, 'f8880.joint.line4_totalQualifyingContributions')).toBe(3_000);
    expect(num(state, 'f8880.joint.line7_tentativeCredit')).toBe(1_500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM 8880 — TAX LIABILITY CAP
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8880 — Tax Liability Cap (Nonrefundable)', () => {
  test('45. Tentative credit exceeds tax liability → capped at tax', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 12_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    const tentative = num(state, 'f8880.joint.line7_tentativeCredit');
    const taxLiability = num(state, 'f8880.joint.line8_taxLiabilityLimit');
    const credit = num(state, F8880_OUTPUTS.credit);

    expect(tentative).toBeGreaterThan(taxLiability);
    expect(credit).toBe(taxLiability);
    expect(credit).toBeGreaterThanOrEqual(0);
  });

  test('46. Zero tax liability → credit = 0', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f1040.joint.line24_totalTax')).toBe(0);
    expect(num(state, F8880_OUTPUTS.credit)).toBe(0);
  });

test('47. Tax clearly exceeds tentative credit → full tentative credit allowed', () => {
  const { engine, session } = make8880Engine('married_filing_jointly');
  let state = engine.initializeSession(session).currentState;

  // MFJ at 50% tier boundary, but high enough taxable income to have tax > $1,000
  state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 43_500);

  // Qualifying contributions: $2,000 → tentative = $2,000 × 50% = $1,000
  state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

  const tentative    = num(state, 'f8880.joint.line7_tentativeCredit'); // 1000
  const taxLiability = num(state, 'f8880.joint.line8_taxLiabilityLimit');
  const credit       = num(state, F8880_OUTPUTS.credit);

  expect(taxLiability).toBeGreaterThanOrEqual(tentative);
  expect(credit).toBe(tentative);
});
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM 8880 — isApplicable GATE
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8880 — isApplicable Gate', () => {
  test('48. Rate = 0% (AGI too high) → credit node SKIPPED, value null', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 40_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 2_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0);
    expect(state[F8880_OUTPUTS.credit]?.value).toBeNull();
  });

  test('49. Contributions = 0 → credit node SKIPPED, value null', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 20_000);

    expect(state[F8880_OUTPUTS.credit]?.value).toBeNull();
  });

  test('50. Rate > 0 and contributions > 0 → credit is computed and non-null', () => {
    const { engine, session } = make8880Engine('single');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 20_000);
    state = setInput(engine, state, session, 'f8880.joint.line1_primaryContributions', 1_000);

    expect(num(state, 'f8880.joint.line6_creditRate')).toBe(0.5);
    const credit = state[F8880_OUTPUTS.credit]?.value;
    expect(credit).not.toBeNull();
    expect(credit).toBeGreaterThan(0);
  });
});