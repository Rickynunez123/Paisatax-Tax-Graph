/**
 * SCHEDULE D — CAPITAL GAINS AND LOSSES
 * Tests for Form 8949 slots, Schedule D aggregation, QDCGT Worksheet,
 * and Form 1040 Lines 7 and 16 integration.
 */

import { TaxGraphEngineImpl }    from '../../src/core/graph/engine';
import { InputEventSource }       from '../../src/core/graph/engine.types';
import { NodeOwner }              from '../../src/core/graph/node.types';
import { F8889_NODES }            from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }            from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }        from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }        from '../../src/tax/forms/schedule2/nodes';
import { F1099INT_INITIAL_AGGREGATORS } from '../../src/tax/forms/f1099int/nodes';
import { F1099DIV_INITIAL_AGGREGATORS, generateF1099DIVSlotNodes, generateF1099DIVAggregators } from '../../src/tax/forms/f1099div/nodes';
import { SCHEDULE_B_NODES }       from '../../src/tax/forms/schedule-b/nodes';
import {
  F8949_INITIAL_AGGREGATORS,
  generateF8949SlotNodes,
  generateF8949Aggregators,
  F8949_OUTPUTS,
} from '../../src/tax/forms/f8949/nodes';
import { SCHEDULE_D_NODES, SCHEDULE_D_OUTPUTS } from '../../src/tax/forms/schedule-d/nodes';
import {
  computeQDCGTTax,
  SCHEDULE_D_CONSTANTS_2025,
} from '../../src/tax/forms/schedule-d/constants/index';
import { W2_INITIAL_AGGREGATORS } from '../../src/tax/forms/w2/nodes';
import { F1040_NODES, F1040_OUTPUTS } from '../../src/tax/forms/f1040/nodes';
import { computeTax, getF1040Constants } from '../../src/tax/forms/f1040/constants/index';
import { F8812_NODES }   from '../../src/tax/forms/f8812/nodes';
import { F2441_NODES }   from '../../src/tax/forms/f2441/nodes';
import { F8863_NODES }   from '../../src/tax/forms/f8863/nodes';
import { F5695_NODES }   from '../../src/tax/forms/f5695/nodes';
import { F8936_NODES }   from '../../src/tax/forms/f8936/nodes';
import { F8911_NODES }   from '../../src/tax/forms/f8911/nodes';
import { F4868_NODES }   from '../../src/tax/forms/f4868/nodes';
import { F8880_NODES }   from '../../src/tax/forms/f8880/nodes';
import { F3800_NODES }   from '../../src/tax/forms/f3800/nodes';
import { SCHEDULE3_NODES }    from '../../src/tax/forms/schedule3/nodes';
import { SCHEDULE_EIC_NODES } from '../../src/tax/forms/schedule-eic/nodes';
import { F1040_PAYMENT_NODES } from '../../src/tax/forms/f1040/payments';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeEngine(filingStatus = 'single', hasSpouse = false) {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES, ...F5329_NODES, ...SCHEDULE1_NODES, ...SCHEDULE2_NODES,
    ...F1099INT_INITIAL_AGGREGATORS, ...F1099DIV_INITIAL_AGGREGATORS, ...SCHEDULE_B_NODES,
    ...F8949_INITIAL_AGGREGATORS, ...SCHEDULE_D_NODES,
    ...W2_INITIAL_AGGREGATORS, ...F1040_NODES,
    ...F8812_NODES, ...F2441_NODES, ...F8863_NODES, ...F5695_NODES,
    ...F8936_NODES, ...F8911_NODES, ...F4868_NODES, ...F8880_NODES,
    ...F3800_NODES, ...SCHEDULE3_NODES, ...SCHEDULE_EIC_NODES, ...F1040_PAYMENT_NODES,
  ]);
  return { engine, session: { taxYear: '2025', filingStatus, hasSpouse, sessionKey: 'test-sched-d' } };
}

function addSlot(engine: any, state: any, session: any, owner: any, index: any, primarySlots: any, spouseSlots: any) {
  engine.registerNodes([
    ...generateF8949SlotNodes(owner, index),
    ...generateF8949Aggregators(primarySlots, spouseSlots),
  ]);
  return engine.reinitializeSession(session, state).currentState;
}

function set(engine: any, state: any, session: any, id: any, value: any) {
  return engine.process(
    { instanceId: id, value, source: InputEventSource.OCR, timestamp: new Date().toISOString() },
    state, session,
  ).currentState;
}

function val(state: any, id: any) { return (state[id]?.value) ?? 0; }

const F1040_C = getF1040Constants('2025');
const ordTax = (income: any, fs = 'single') => computeTax(income, fs, F1040_C);
const qdcgtTax = (ti: any, qd: any, ltcg : any, fs = 'single') =>
  computeQDCGTTax(ti, qd, ltcg, fs, SCHEDULE_D_CONSTANTS_2025, (o) => ordTax(o, fs));

// ─────────────────────────────────────────────────────────────────────────────

describe('Form 8949 — Slot Gain/Loss', () => {

  test('1. gainLoss = proceeds − basis (no adjustment)', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 5_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 3_000);
    expect(val(s, 'f8949.primary.s0.gainLoss')).toBe(2_000);
  });

  test('2. Positive Box 1g (wash sale) increases gain', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 4_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 5_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1g_adjustmentAmount', 1_200);
    expect(val(s, 'f8949.primary.s0.gainLoss')).toBe(200); // -1,000 + 1,200
  });

  test('3. Loss lot is negative', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 2_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 8_000);
    expect(val(s, 'f8949.primary.s0.gainLoss')).toBe(-6_000);
  });

  test('4. Negative Box 1g (basis adjustment) reduces gain', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 10_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 7_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1g_adjustmentAmount', -500);
    expect(val(s, 'f8949.primary.s0.gainLoss')).toBe(2_500);
  });

  test('5. Short-term lot feeds only short-term aggregator', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'short');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 5_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 3_000);
    expect(val(s, F8949_OUTPUTS.primaryShortTerm)).toBe(2_000);
    expect(val(s, F8949_OUTPUTS.primaryLongTerm)).toBe(0);
  });

  test('6. Long-term lot feeds only long-term aggregator', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 8_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 5_000);
    expect(val(s, F8949_OUTPUTS.primaryLongTerm)).toBe(3_000);
    expect(val(s, F8949_OUTPUTS.primaryShortTerm)).toBe(0);
  });

  test('7. Mixed short/long lots split into correct aggregators', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 1, [0, 1], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'short');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 4_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 1_000);
    s = set(engine, s, session, 'f8949.primary.s1.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s1.box1d_proceeds', 10_000);
    s = set(engine, s, session, 'f8949.primary.s1.box1e_costBasis', 6_000);
    expect(val(s, F8949_OUTPUTS.primaryShortTerm)).toBe(3_000);
    expect(val(s, F8949_OUTPUTS.primaryLongTerm)).toBe(4_000);
  });

  test('8. Multiple short-term lots sum correctly', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 1, [0, 1], []);
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 2, [0, 1, 2], []);
    for (const [i, gain] of [[0, 1_000], [1, -500], [2, 2_500]]) {
      s = set(engine, s, session, `f8949.primary.s${i}.termType`, 'short');
      s = set(engine, s, session, `f8949.primary.s${i}.box1d_proceeds`, 10_000 + gain);
      s = set(engine, s, session, `f8949.primary.s${i}.box1e_costBasis`, 10_000);
    }
    expect(val(s, F8949_OUTPUTS.primaryShortTerm)).toBe(3_000);
  });

  test('9. Spouse lots aggregate separately and both flow to Schedule D', () => {
    const { engine, session } = makeEngine('married_filing_jointly', true);
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = addSlot(engine, s, session, NodeOwner.SPOUSE, 0, [0], [0]);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 8_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 3_000);
    s = set(engine, s, session, 'f8949.spouse.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.spouse.s0.box1d_proceeds', 6_000);
    s = set(engine, s, session, 'f8949.spouse.s0.box1e_costBasis', 4_000);
    expect(val(s, F8949_OUTPUTS.primaryLongTerm)).toBe(5_000);
    expect(val(s, F8949_OUTPUTS.spouseLongTerm)).toBe(2_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.netLongTerm)).toBe(7_000);
  });

});

describe('Schedule D — Parts I, II, III Aggregation', () => {

  test('10. Line 7 = primary ST + spouse ST − ST carryover', () => {
    const { engine, session } = makeEngine('married_filing_jointly', true);
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = addSlot(engine, s, session, NodeOwner.SPOUSE, 0, [0], [0]);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'short');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 5_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 2_000);
    s = set(engine, s, session, 'f8949.spouse.s0.termType', 'short');
    s = set(engine, s, session, 'f8949.spouse.s0.box1d_proceeds', 3_000);
    s = set(engine, s, session, 'f8949.spouse.s0.box1e_costBasis', 1_000);
    s = set(engine, s, session, 'scheduleD.joint.line6_shortTermCarryover', 500);
    expect(val(s, SCHEDULE_D_OUTPUTS.netShortTerm)).toBe(4_500); // 3+2 - 0.5
  });

  test('11. Line 15 = primary LT + spouse LT − LT carryover', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 15_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 5_000);
    s = set(engine, s, session, 'scheduleD.joint.line11_longTermCarryover', 2_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.netLongTerm)).toBe(8_000);
  });

  test('12. Line 16 = Line 7 + Line 15', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 1, [0, 1], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'short');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 3_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 5_000);
    s = set(engine, s, session, 'f8949.primary.s1.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s1.box1d_proceeds', 12_000);
    s = set(engine, s, session, 'f8949.primary.s1.box1e_costBasis', 5_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.combinedNet)).toBe(5_000); // -2k + 7k
  });

  test('15. Net gain passes full amount to Form 1040 Line 7', () => {
    const { engine, session } = makeEngine();
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 20_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 12_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.toF1040Line7)).toBe(8_000);
    expect(val(s, F1040_OUTPUTS.capitalGains)).toBe(8_000);
  });

  test('16. Net loss capped at -$3,000 (single)', () => {
    const { engine, session } = makeEngine('single');
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'short');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 2_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 12_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.deductibleLoss)).toBe(-3_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.toF1040Line7)).toBe(-3_000);
  });

  test('17. Net loss capped at -$1,500 for MFS', () => {
    const { engine, session } = makeEngine('married_filing_separately');
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 0);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 8_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.deductibleLoss)).toBe(-1_500);
  });

  test('18. Excess loss above cap goes to carryoverExcess', () => {
    const { engine, session } = makeEngine('single');
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'short');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 0);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 10_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.carryoverExcess)).toBe(7_000);
  });

  test('19. Exactly -$3,000 loss — all deductible, zero carryover', () => {
    const { engine, session } = makeEngine('single');
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 0);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 3_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.deductibleLoss)).toBe(-3_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.carryoverExcess)).toBe(0);
  });

  test('20. Small loss under $3,000 — all deductible, zero carryover', () => {
    const { engine, session } = makeEngine('single');
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'short');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 500);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 2_000);
    expect(val(s, SCHEDULE_D_OUTPUTS.deductibleLoss)).toBe(-1_500);
    expect(val(s, SCHEDULE_D_OUTPUTS.carryoverExcess)).toBe(0);
  });

});

describe('Schedule D → Form 1040 Integration', () => {

  test('21. Capital gain increases Line 9 total income', () => {
    const { engine, session } = makeEngine('single');
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 30_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 10_000);
    expect(val(s, F1040_OUTPUTS.totalIncome)).toBe(20_000);
  });

  test('22. Capped loss reduces Line 9', () => {
    const { engine, session } = makeEngine('single');
    let s = engine.initializeSession(session).currentState;
    s = set(engine, s, session, 'schedule1.joint.line7_unemploymentCompensation', 10_000);
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'short');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 0);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 20_000);
    expect(val(s, F1040_OUTPUTS.capitalGains)).toBe(-3_000);
    expect(val(s, F1040_OUTPUTS.totalIncome)).toBe(7_000);
  });

  test('23. No 8949 activity → Line 7 = 0', () => {
    const { engine, session } = makeEngine('single');
    const s = engine.initializeSession(session).currentState;
    expect(val(s, F1040_OUTPUTS.capitalGains)).toBe(0);
  });

});

describe('QDCGT Worksheet — Form 1040 Line 16', () => {

  test('24. Ordinary-only income uses straight brackets', () => {
    const { engine, session } = makeEngine('single');
    let s = engine.initializeSession(session).currentState;
    s = set(engine, s, session, 'schedule1.joint.line3_businessIncome', 50_000);
    // taxable = 50,000 - 15,000 = 35,000
    expect(val(s, F1040_OUTPUTS.tax)).toBeCloseTo(ordTax(35_000), 0);
  });

  test('25. LTCG in 0% bracket → $0 LTCG tax', () => {
    const { engine, session } = makeEngine('single');
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 30_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 10_000);
    // taxable = 20,000 - 15,000 = 5,000, all LTCG, within 0% bracket
    expect(val(s, F1040_OUTPUTS.tax)).toBe(0);
  });

  test('26. Qualified dividends alone trigger QDCGT', () => {
    const { engine, session } = makeEngine('single');
    // Add 1099-DIV slot
    engine.registerNodes([
      ...generateF1099DIVSlotNodes(NodeOwner.PRIMARY, 0),
      ...generateF1099DIVAggregators([0], []),
    ]);
    let s = engine.initializeSession(session).currentState;
    s = set(engine, s, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 20_000);
    s = set(engine, s, session, 'f1099div.primary.s0.box1b_qualifiedDividends', 20_000);
    // taxable = 20,000 - 15,000 = 5,000, all qualified — 0% bracket
    expect(val(s, F1040_OUTPUTS.tax)).toBe(0);
  });

  test('27. LTCG in 0% bracket unit test', () => {
    expect(qdcgtTax(30_000, 0, 30_000)).toBe(0);
  });

  test('28. LTCG straddling 0%/15% bracket', () => {
    const ordinary = 40_000;
    const ltcg = 20_000;
    const ti = ordinary + ltcg;
    const zeroRoom = Math.max(0, 48_350 - ordinary);
    const atFifteen = ltcg - zeroRoom;
    const expected = ordTax(ordinary) + atFifteen * 0.15;
    expect(qdcgtTax(ti, 0, ltcg)).toBeCloseTo(expected, 1);
  });

  test('29. Large LTCG in 20% bracket (single > $533,400)', () => {
    const ti = 600_000;
    const expected = 48_350 * 0 + (533_400 - 48_350) * 0.15 + (600_000 - 533_400) * 0.20;
    expect(qdcgtTax(ti, 0, ti)).toBeCloseTo(expected, 0);
  });

  test('30. MFJ QDCGT uses correct wider thresholds', () => {
    const ti = 100_000;
    // MFJ 0% threshold = $96,700 → $3,300 at 15%
    const expected = 3_300 * 0.15;
    expect(qdcgtTax(ti, 0, ti, 'married_filing_jointly')).toBeCloseTo(expected, 1);
  });

  test('31. LTCG net loss does NOT trigger QDCGT', () => {
    const { engine, session } = makeEngine('single');
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 0);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 10_000);
    s = set(engine, s, session, 'schedule1.joint.line3_businessIncome', 40_000);
    // Line 9 = 40,000 - 3,000 = 37,000; taxable = 22,000; pure ordinary
    expect(val(s, F1040_OUTPUTS.tax)).toBeCloseTo(ordTax(22_000), 0);
  });

  test('32. ST gain taxed at ordinary, LT gain at pref rate', () => {
    const { engine, session } = makeEngine('single');
    let s = engine.initializeSession(session).currentState;
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 1, [0, 1], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'short');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 20_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 10_000);
    s = set(engine, s, session, 'f8949.primary.s1.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s1.box1d_proceeds', 30_000);
    s = set(engine, s, session, 'f8949.primary.s1.box1e_costBasis', 15_000);
    // Total income: 25,000; taxable: 10,000; LT: 15,000
    // QDCGT: qualified = min(15k, 10k) = 10k at 0% → tax = 0
    expect(val(s, F1040_OUTPUTS.tax)).toBeCloseTo(qdcgtTax(10_000, 0, 15_000), 0);
  });

  test('33. Qualified divs + LTCG both eligible, combined correctly', () => {
    const { engine, session } = makeEngine('single');
    engine.registerNodes([
      ...generateF1099DIVSlotNodes(NodeOwner.PRIMARY, 0),
      ...generateF1099DIVAggregators([0], []),
    ]);
    let s = engine.initializeSession(session).currentState;
    s = set(engine, s, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 10_000);
    s = set(engine, s, session, 'f1099div.primary.s0.box1b_qualifiedDividends', 10_000);
    s = addSlot(engine, s, session, NodeOwner.PRIMARY, 0, [0], []);
    s = set(engine, s, session, 'f8949.primary.s0.termType', 'long');
    s = set(engine, s, session, 'f8949.primary.s0.box1d_proceeds', 20_000);
    s = set(engine, s, session, 'f8949.primary.s0.box1e_costBasis', 10_000);
    // Taxable = (10k divs + 10k LTCG) - 15k std = 5,000
    // QDCGT: qualified = min(10k QD + 10k LTCG, 5k) = 5k at 0% → tax = 0
    expect(val(s, F1040_OUTPUTS.tax)).toBe(0);
  });

});

describe('computeQDCGTTax — Unit Tests', () => {

  test('34. $0 income → $0 tax', () => {
    expect(qdcgtTax(0, 0, 0)).toBe(0);
  });

  test('35. Pure ordinary income → same as computeTax', () => {
    const income = 75_000;
    expect(qdcgtTax(income, 0, 0)).toBeCloseTo(ordTax(income), 1);
  });

  test('36. All LTCG in 0% bracket → $0 LTCG tax', () => {
    expect(qdcgtTax(30_000, 0, 30_000)).toBe(0);
  });

  test('37. Ordinary fills 0% bracket, LTCG spills into 15%', () => {
    const ordinary = 48_000;
    const ltcg = 5_000;
    const ti = ordinary + ltcg;
    const zeroRoom = Math.max(0, 48_350 - ordinary); // 350
    const atFifteen = ltcg - zeroRoom; // 4,650
    const expected = ordTax(ordinary) + atFifteen * 0.15;
    expect(qdcgtTax(ti, 0, ltcg)).toBeCloseTo(expected, 1);
  });

});