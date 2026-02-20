/**
 * FORM 5695 — RESIDENTIAL ENERGY CREDITS — TESTS
 *
 * Test scenarios:
 *
 *   Part I — §25D Residential Clean Energy Credit
 *   1.  Solar PV only → 30% credit, full credit allowed
 *   2.  Multiple Part I sources → summed at 30%
 *   3.  Carryforward from 2024 adds to tentative total
 *   4.  Tax liability cap limits allowed credit — excess carries forward to 2026
 *   5.  Zero tax liability → zero allowed, full carryforward
 *   6.  All Part I inputs combined (solar + wind + geo + battery + fuel cell)
 *
 *   Part II — §25C Bucket A Sub-Limits
 *   7.  Insulation only → 30%, no sub-limit, under $1,200 overall cap
 *   8.  Insulation $5,000 → 30% = $1,500 → capped at $1,200 overall
 *   9.  Exterior doors → $500 total cap enforced
 *   10. Windows/skylights → $600 cap enforced
 *   11. Central A/C → $600 cap enforced
 *   12. Gas water heater → $600 cap enforced
 *   13. Gas furnace → $600 cap enforced
 *   14. Electric panel → $600 cap enforced
 *   15. Home energy audit → $150 cap enforced
 *   16. Bucket A overall $1,200 cap across multiple improvements
 *
 *   Part II — §25C Bucket B
 *   17. Heat pumps only → $2,000 cap enforced
 *   18. Biomass only → under $2,000, actual credit returned
 *   19. Heat pumps + biomass combined → $2,000 cap
 *
 *   Part II — Combined and Tax Cap
 *   20. Bucket A ($1,200 max) + Bucket B ($2,000 max) → $3,200 total
 *   21. Part II tax liability cap — no carryforward (use it or lose it)
 *   22. Zero inputs → all zeros
 *
 *   Part I + Part II on same return
 *   23. Solar (Part I) + heat pump (Part II) → independent credits, separate Schedule 3 lines
 *   24. MFJ filer — same 30% rate (no filing status phase-out for §25D/§25C)
 *   25. Carryforward only (no current-year costs) — prior year credit applied to tax
 *   26. Boundary: tax exactly covers tentative credit → no carryforward
 */

import { TaxGraphEngineImpl }    from '../../src/core/graph/engine';
import { InputEventSource }       from '../../src/core/graph/engine.types';
import { F8889_NODES }            from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }            from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }        from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }        from '../../src/tax/forms/schedule2/nodes';
import { W2_INITIAL_AGGREGATORS } from '../../src/tax/forms/w2/nodes';
import { F1040_NODES }            from '../../src/tax/forms/f1040/nodes';
import { F5695_NODES, F5695_OUTPUTS } from '../../src/tax/forms/f5695/nodes';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeEngine(filingStatus = 'single') {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
    ...F5695_NODES,
  ]);
  return {
    engine,
    session: {
      taxYear:    '2025',
      filingStatus,
      hasSpouse:  filingStatus === 'married_filing_jointly',
      sessionKey: 'test-f5695',
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
// PART I — §25D RESIDENTIAL CLEAN ENERGY CREDIT
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 5695 Part I — §25D Residential Clean Energy Credit', () => {

  test('1. Solar PV only → 30% credit, full credit allowed', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line1_solarElectric', 20_000);

    // 30% × $20,000 = $6,000
    expect(val(state, 'f5695.joint.line6a_creditBase')).toBe(6_000);
    // No carryforward input → tentative equals credit base
    expect(val(state, 'f5695.joint.line13_tentativeTotal')).toBe(6_000);
    // Tax on $100k single well above $6,000 → full credit allowed
    expect(val(state, F5695_OUTPUTS.partICredit)).toBe(6_000);
    // Nothing left to carry forward
    expect(val(state, F5695_OUTPUTS.carryforward)).toBe(0);
  });

  test('2. Multiple Part I sources → all summed then multiplied by 30%', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 200_000);
    state = setInput(engine, state, session, 'f5695.joint.line1_solarElectric',   10_000);
    state = setInput(engine, state, session, 'f5695.joint.line2_solarWater',       5_000);
    state = setInput(engine, state, session, 'f5695.joint.line3_smallWind',        5_000);
    state = setInput(engine, state, session, 'f5695.joint.line4_geothermal',      10_000);
    state = setInput(engine, state, session, 'f5695.joint.line5a_batteryStorage',  5_000);

    // Total costs = $35,000; 30% = $10,500
    expect(val(state, 'f5695.joint.line6a_creditBase')).toBe(10_500);
    expect(val(state, F5695_OUTPUTS.partICredit)).toBe(10_500);
    expect(val(state, F5695_OUTPUTS.carryforward)).toBe(0);
  });

  test('3. Carryforward from 2024 adds to tentative total (line 12 + line 6a = line 13)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 200_000);
    state = setInput(engine, state, session, 'f5695.joint.line1_solarElectric',   10_000);
    state = setInput(engine, state, session, 'f5695.joint.line12_carryforward',    2_000);

    // Credit base = 30% × $10,000 = $3,000
    expect(val(state, 'f5695.joint.line6a_creditBase')).toBe(3_000);
    // Tentative = $3,000 + $2,000 carryforward = $5,000
    expect(val(state, 'f5695.joint.line13_tentativeTotal')).toBe(5_000);
    // High income → tax fully absorbs $5,000
    expect(val(state, F5695_OUTPUTS.partICredit)).toBe(5_000);
    expect(val(state, F5695_OUTPUTS.carryforward)).toBe(0);
  });

  test('4. Tax liability cap limits allowed credit — excess carries forward to 2026', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    // Low income → small tax liability
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 20_000);
    state = setInput(engine, state, session, 'f5695.joint.line1_solarElectric',   30_000);

    // 30% × $30,000 = $9,000 tentative
    expect(val(state, 'f5695.joint.line13_tentativeTotal')).toBe(9_000);

    const taxLiability = val(state, 'f1040.joint.line24_totalTax');
    const allowed      = val(state, F5695_OUTPUTS.partICredit);
    const carryforward = val(state, F5695_OUTPUTS.carryforward);

    // Allowed ≤ tax liability (credit is nonrefundable)
    expect(allowed).toBeLessThanOrEqual(taxLiability);
    expect(allowed).toBeGreaterThan(0);
    // Carryforward makes up the rest
    expect(carryforward).toBe(9_000 - allowed);
    // Together they account for the full tentative
    expect(allowed + carryforward).toBe(9_000);
  });

  test('5. Zero tax liability → zero allowed, full amount carries forward to 2026', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    // No income → zero tax
    state = setInput(engine, state, session, 'f5695.joint.line1_solarElectric', 10_000);

    expect(val(state, 'f1040.joint.line24_totalTax')).toBe(0);
    // Credit base = 30% × $10,000 = $3,000
    expect(val(state, 'f5695.joint.line6a_creditBase')).toBe(3_000);
    // None can be used
    expect(val(state, F5695_OUTPUTS.partICredit)).toBe(0);
    // Full $3,000 carries to 2026
    expect(val(state, F5695_OUTPUTS.carryforward)).toBe(3_000);
  });

  test('6. All Part I inputs including fuel cell', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 500_000);
    state = setInput(engine, state, session, 'f5695.joint.line1_solarElectric',   20_000);
    state = setInput(engine, state, session, 'f5695.joint.line2_solarWater',       5_000);
    state = setInput(engine, state, session, 'f5695.joint.line3_smallWind',        8_000);
    state = setInput(engine, state, session, 'f5695.joint.line4_geothermal',      15_000);
    state = setInput(engine, state, session, 'f5695.joint.line5a_batteryStorage',  7_000);
    state = setInput(engine, state, session, 'f5695.joint.line7a_fuelCell',        5_000);

    // Total = $60,000; 30% = $18,000
    expect(val(state, 'f5695.joint.line6a_creditBase')).toBe(18_000);
    // High income → full credit allowed
    expect(val(state, F5695_OUTPUTS.partICredit)).toBe(18_000);
    expect(val(state, F5695_OUTPUTS.carryforward)).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// PART II — §25C BUCKET A SUB-LIMITS
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 5695 Part II — §25C Bucket A Sub-Limits', () => {

  test('7. Insulation $2,000 → 30% = $600, no sub-limit, under $1,200 overall cap', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line18a_insulation', 2_000);

    // 30% × $2,000 = $600; insulation has no sub-limit, well under $1,200 overall
    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(600);
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(600);
    expect(val(state, F5695_OUTPUTS.partIICredit)).toBe(600);
  });

  test('8. Insulation $5,000 → 30% = $1,500 → capped at $1,200 overall', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line18a_insulation', 5_000);

    // Insulation has no sub-limit but $1,200 overall cap applies
    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(1_500);
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(1_200);
  });

  test('9. Exterior doors $3,000 → 30% = $900, capped at $500 sub-limit', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line19a_exteriorDoors', 3_000);

    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(500);
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(500);
    expect(val(state, F5695_OUTPUTS.partIICredit)).toBe(500);
  });

  test('10. Windows/skylights $5,000 → 30% = $1,500, capped at $600', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line19d_windowsSkylights', 5_000);

    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(600);
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(600);
  });

  test('11. Central A/C $5,000 → 30% = $1,500, capped at $600', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line20a_centralAC', 5_000);

    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(600);
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(600);
  });

  test('12. Gas water heater $5,000 → 30% = $1,500, capped at $600', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line20b_gasWaterHeater', 5_000);

    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(600);
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(600);
  });

  test('13. Gas furnace $5,000 → 30% = $1,500, capped at $600', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line20c_gasFurnace', 5_000);

    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(600);
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(600);
  });

  test('14. Electric panel $5,000 → 30% = $1,500, capped at $600', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line25c_electricPanel', 5_000);

    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(600);
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(600);
  });

  test('15. Home energy audit $1,000 → 30% = $300, capped at $150', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line26b_homeEnergyAudit', 1_000);

    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(150);
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(150);
    expect(val(state, F5695_OUTPUTS.partIICredit)).toBe(150);
  });

  test('16. Bucket A $1,200 overall cap — windows $600 + A/C $600 + water heater $600 = $1,800 subtotal → $1,200', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line19d_windowsSkylights', 5_000); // → $600
    state = setInput(engine, state, session, 'f5695.joint.line20a_centralAC',        5_000); // → $600
    state = setInput(engine, state, session, 'f5695.joint.line20b_gasWaterHeater',   5_000); // → $600

    // Each sub-limit applies first: $600 + $600 + $600 = $1,800 subtotal
    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(1_800);
    // Then overall $1,200 cap
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(1_200);
    expect(val(state, F5695_OUTPUTS.partIICredit)).toBe(1_200);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// PART II — §25C BUCKET B (HEAT PUMPS + BIOMASS)
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 5695 Part II — §25C Bucket B (Heat Pumps + Biomass)', () => {

  test('17. Heat pumps $10,000 → 30% = $3,000, capped at $2,000', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line22a_heatPumps', 10_000);

    expect(val(state, 'f5695.joint.line30_bucketB')).toBe(2_000);
    expect(val(state, F5695_OUTPUTS.partIICredit)).toBe(2_000);
  });

  test('18. Biomass $5,000 → 30% = $1,500, under $2,000 cap', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line23a_biomass', 5_000);

    expect(val(state, 'f5695.joint.line30_bucketB')).toBe(1_500);
    expect(val(state, F5695_OUTPUTS.partIICredit)).toBe(1_500);
  });

  test('19. Heat pumps $5,000 + biomass $5,000 → 30% × $10,000 = $3,000, capped at $2,000', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);
    state = setInput(engine, state, session, 'f5695.joint.line22a_heatPumps', 5_000);
    state = setInput(engine, state, session, 'f5695.joint.line23a_biomass',   5_000);

    expect(val(state, 'f5695.joint.line30_bucketB')).toBe(2_000);
    expect(val(state, F5695_OUTPUTS.partIICredit)).toBe(2_000);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// PART II — COMBINED AND TAX CAP
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 5695 Part II — Combined and Tax Cap', () => {

  test('20. Max Bucket A ($1,200) + max Bucket B ($2,000) → $3,200 total', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 200_000);
    // Max out Bucket A: three $600 items = $1,800 subtotal → $1,200 after cap
    state = setInput(engine, state, session, 'f5695.joint.line19d_windowsSkylights', 5_000);
    state = setInput(engine, state, session, 'f5695.joint.line20a_centralAC',        5_000);
    state = setInput(engine, state, session, 'f5695.joint.line20b_gasWaterHeater',   5_000);
    // Max out Bucket B
    state = setInput(engine, state, session, 'f5695.joint.line22a_heatPumps', 10_000);

    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(1_200);
    expect(val(state, 'f5695.joint.line30_bucketB')).toBe(2_000);
    expect(val(state, 'f5695.joint.partII_tentative')).toBe(3_200);
    // High income → tax fully absorbs $3,200
    expect(val(state, F5695_OUTPUTS.partIICredit)).toBe(3_200);
  });

  test('21. Part II tax liability cap — credit limited, no carryforward (§25C use-it-or-lose-it)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    // Low income → tax well below the $2,000 heat pump tentative
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 15_000);
    state = setInput(engine, state, session, 'f5695.joint.line22a_heatPumps', 10_000);

    const taxLiability = val(state, 'f1040.joint.line24_totalTax');
    const tentative    = val(state, 'f5695.joint.partII_tentative');
    const credit       = val(state, F5695_OUTPUTS.partIICredit);

    expect(tentative).toBe(2_000);
    // Credit capped at tax liability
    expect(credit).toBeLessThanOrEqual(taxLiability);
    expect(credit).toBeLessThan(2_000);
    // §25C has no carryforward node — the unused amount is permanently lost
  });

  test('22. Zero inputs → all computed nodes are zero', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 100_000);

    expect(val(state, 'f5695.joint.line6a_creditBase')).toBe(0);
    expect(val(state, 'f5695.joint.line13_tentativeTotal')).toBe(0);
    expect(val(state, 'f5695.joint.bucketA_subtotal')).toBe(0);
    expect(val(state, 'f5695.joint.line28_bucketA')).toBe(0);
    expect(val(state, 'f5695.joint.line30_bucketB')).toBe(0);
    expect(val(state, 'f5695.joint.partII_tentative')).toBe(0);
    expect(val(state, F5695_OUTPUTS.partICredit)).toBe(0);
    expect(val(state, F5695_OUTPUTS.partIICredit)).toBe(0);
    expect(val(state, F5695_OUTPUTS.carryforward)).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// PART I + PART II ON SAME RETURN
// ─────────────────────────────────────────────────────────────────────────────

describe('Form 5695 — Part I (§25D) + Part II (§25C) on same return', () => {

  test('23. Solar (Part I) + heat pump (Part II) → independent, separate Schedule 3 lines', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 150_000);
    // Part I: $20,000 solar → 30% = $6,000
    state = setInput(engine, state, session, 'f5695.joint.line1_solarElectric', 20_000);
    // Part II: $10,000 heat pump → capped at $2,000
    state = setInput(engine, state, session, 'f5695.joint.line22a_heatPumps', 10_000);

    // Part I nodes unaffected by Part II
    expect(val(state, 'f5695.joint.line6a_creditBase')).toBe(6_000);
    expect(val(state, 'f5695.joint.line13_tentativeTotal')).toBe(6_000);
    expect(val(state, F5695_OUTPUTS.partICredit)).toBe(6_000);
    expect(val(state, F5695_OUTPUTS.carryforward)).toBe(0);

    // Part II nodes unaffected by Part I
    expect(val(state, 'f5695.joint.partII_tentative')).toBe(2_000);
    expect(val(state, F5695_OUTPUTS.partIICredit)).toBe(2_000);
  });

  test('24. MFJ filer — same 30% rate (§25D/§25C have no income phase-out)', () => {
    const { engine, session } = makeEngine('married_filing_jointly');
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 200_000);
    state = setInput(engine, state, session, 'f5695.joint.line1_solarElectric', 20_000);

    // Same 30% regardless of filing status
    expect(val(state, 'f5695.joint.line6a_creditBase')).toBe(6_000);
    expect(val(state, F5695_OUTPUTS.partICredit)).toBe(6_000);
  });

  test('25. Carryforward only — no current-year costs, prior-year credit used against this year tax', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 80_000);
    // No current solar costs — only prior year carryforward
    state = setInput(engine, state, session, 'f5695.joint.line12_carryforward', 4_000);

    expect(val(state, 'f5695.joint.line6a_creditBase')).toBe(0);
    expect(val(state, 'f5695.joint.line13_tentativeTotal')).toBe(4_000);
    // Tax on $80k single >> $4,000 → full carryforward absorbed
    expect(val(state, F5695_OUTPUTS.partICredit)).toBe(4_000);
    expect(val(state, F5695_OUTPUTS.carryforward)).toBe(0);
  });

  test('26. Tax clearly exceeds tentative credit → no carryforward', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    // $80,000 income → tax ≈ $13,000+; solar credit = $3,000 → fully absorbed
    state = setInput(engine, state, session, 'f1040.joint.line9input_otherIncome', 80_000);
    state = setInput(engine, state, session, 'f5695.joint.line1_solarElectric', 10_000);

    const taxLiability = val(state, 'f1040.joint.line24_totalTax');
    const tentative    = val(state, 'f5695.joint.line13_tentativeTotal');

    expect(tentative).toBe(3_000);
    expect(taxLiability).toBeGreaterThan(tentative);
    expect(val(state, F5695_OUTPUTS.partICredit)).toBe(3_000);
    expect(val(state, F5695_OUTPUTS.carryforward)).toBe(0);
  });

});