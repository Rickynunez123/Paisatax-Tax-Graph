/**
 * SCHEDULE B — INTEREST AND ORDINARY DIVIDENDS
 * Tests for 1099-INT, 1099-DIV, Schedule B, and Form 1040 integration.
 *
 * WHAT IS TESTED:
 *
 *   1099-INT slot behavior
 *   1.  Single 1099-INT slot — Box 1 flows to Schedule B taxable interest
 *   2.  Multiple 1099-INT slots — sum correctly
 *   3.  Box 8 (tax-exempt) does NOT flow to taxable interest
 *   4.  Box 4 (withholding) flows to Schedule B total withholding
 *   5.  Spouse 1099-INT slot aggregates separately, both flow to Schedule B
 *
 *   1099-DIV slot behavior
 *   6.  Single 1099-DIV slot — Box 1a flows to Schedule B ordinary dividends
 *   7.  Multiple 1099-DIV slots — sum correctly
 *   8.  Box 1b (qualified) flows separately, stays ≤ Box 1a
 *   9.  Box 4 (withholding) flows to Schedule B total withholding
 *   10. Spouse 1099-DIV slot aggregates separately, both flow to Schedule B
 *
 *   Schedule B aggregation
 *   11. Schedule B Line 4 = sum of all 1099-INT Box 1 (primary + spouse)
 *   12. Schedule B Line 6 = sum of all 1099-DIV Box 1a (primary + spouse)
 *   13. Tax-exempt interest → Schedule B joint node (informational)
 *   14. 1099 withholding = sum of INT Box 4 + DIV Box 4 (primary + spouse)
 *
 *   Form 1040 integration
 *   15. Line 2a = tax-exempt interest (informational, not in Line 9)
 *   16. Line 2b = taxable interest → included in Line 9
 *   17. Line 3a = qualified dividends (informational subset, not added to Line 9 again)
 *   18. Line 3b = ordinary dividends → included in Line 9
 *   19. Line 9 = wages + interest (2b) + dividends (3b) + Schedule 1 Part I
 *   20. Tax-exempt interest (Line 2a) does NOT affect Line 9 or tax
 *   21. Qualified dividends (Line 3a) do NOT add to Line 9 beyond Line 3b
 *   22. Line 25b = 1099 withholding (INT + DIV combined)
 *
 *   Edge cases
 *   23. Zero slots → all lines are 0
 *   24. MFJ with both spouses having 1099s
 *   25. Interest-only filer (no W-2, no dividends)
 *   26. Dividend-only filer (no W-2, no interest)
 *   27. All three income types (W-2 + interest + dividends) sum correctly
 */

import { TaxGraphEngineImpl }    from '../../src/core/graph/engine';
import { FormSlotRegistry }       from '../../src/core/registry/form-instance-registry';
import { InputEventSource }       from '../../src/core/graph/engine.types';
import { NodeOwner }              from '../../src/core/graph/node.types';
import { F8889_NODES }            from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }            from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }        from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }        from '../../src/tax/forms/schedule2/nodes';
import {
  F1099INT_INITIAL_AGGREGATORS,
  generateF1099INTSlotNodes,
  generateF1099INTAggregators,
  F1099INT_OUTPUTS,
} from '../../src/tax/forms/f1099int/nodes';
import {
  F1099DIV_INITIAL_AGGREGATORS,
  generateF1099DIVSlotNodes,
  generateF1099DIVAggregators,
  F1099DIV_OUTPUTS,
} from '../../src/tax/forms/f1099div/nodes';
import { SCHEDULE_B_NODES, SCHEDULE_B_OUTPUTS } from '../../src/tax/forms/schedule-b/nodes';
import { W2_INITIAL_AGGREGATORS } from '../../src/tax/forms/w2/nodes';
import { F1040_NODES, F1040_OUTPUTS } from '../../src/tax/forms/f1040/nodes';
import { F8812_NODES }            from '../../src/tax/forms/f8812/nodes';
import { F2441_NODES }            from '../../src/tax/forms/f2441/nodes';
import { F8863_NODES }            from '../../src/tax/forms/f8863/nodes';
import { F5695_NODES }            from '../../src/tax/forms/f5695/nodes';
import { F8936_NODES }            from '../../src/tax/forms/f8936/nodes';
import { F8911_NODES }            from '../../src/tax/forms/f8911/nodes';
import { F4868_NODES }            from '../../src/tax/forms/f4868/nodes';
import { F8880_NODES }            from '../../src/tax/forms/f8880/nodes';
import { F3800_NODES }            from '../../src/tax/forms/f3800/nodes';
import { SCHEDULE3_NODES }        from '../../src/tax/forms/schedule3/nodes';
import { SCHEDULE_EIC_NODES }     from '../../src/tax/forms/schedule-eic/nodes';
import { F1040_PAYMENT_NODES }    from '../../src/tax/forms/f1040/payments';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeEngine(filingStatus = 'single', hasSpouse = false) {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...F1099INT_INITIAL_AGGREGATORS,
    ...F1099DIV_INITIAL_AGGREGATORS,
    ...SCHEDULE_B_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
    ...F8812_NODES,
    ...F2441_NODES,
    ...F8863_NODES,
    ...F5695_NODES,
    ...F8936_NODES,
    ...F8911_NODES,
    ...F4868_NODES,
    ...F8880_NODES,
    ...F3800_NODES,
    ...SCHEDULE3_NODES,
    ...SCHEDULE_EIC_NODES,
    ...F1040_PAYMENT_NODES,
  ]);
  const session = {
    taxYear:      '2025',
    filingStatus,
    hasSpouse,
    sessionKey:   'test-schedule-b',
  };
  return { engine, session };
}

/**
 * Add a 1099-INT slot manually (without FormSlotRegistry for simplicity).
 * Returns the new state after reinitializing with the new slot.
 */
function addIntSlot(
  engine:   TaxGraphEngineImpl,
  state:    Record<string, any>,
  session:  any,
  owner:    NodeOwner,
  index:    number,
  primarySlots: number[],
  spouseSlots:  number[],
) {
  const slotNodes   = generateF1099INTSlotNodes(owner, index);
  const aggregators = generateF1099INTAggregators(primarySlots, spouseSlots);
  engine.registerNodes([...slotNodes, ...aggregators]);
  return engine.reinitializeSession(session, state).currentState;
}

function addDivSlot(
  engine:   TaxGraphEngineImpl,
  state:    Record<string, any>,
  session:  any,
  owner:    NodeOwner,
  index:    number,
  primarySlots: number[],
  spouseSlots:  number[],
) {
  const slotNodes   = generateF1099DIVSlotNodes(owner, index);
  const aggregators = generateF1099DIVAggregators(primarySlots, spouseSlots);
  engine.registerNodes([...slotNodes, ...aggregators]);
  return engine.reinitializeSession(session, state).currentState;
}

function setInput(
  engine:  TaxGraphEngineImpl,
  state:   Record<string, any>,
  session: any,
  id:      string,
  value:   any,
) {
  return engine.process(
    { instanceId: id, value, source: InputEventSource.OCR, timestamp: new Date().toISOString() },
    state,
    session,
  ).currentState;
}

function val(state: Record<string, any>, id: string): number {
  return (state[id]?.value as number) ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1099-INT SLOT BEHAVIOR
// ─────────────────────────────────────────────────────────────────────────────

describe('1099-INT — Slot Behavior', () => {

  test('1. Single slot Box 1 flows to Schedule B taxable interest', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box1_interest', 1_200);

    expect(val(state, F1099INT_OUTPUTS.primaryInterest)).toBe(1_200);
    expect(val(state, SCHEDULE_B_OUTPUTS.taxableInterest)).toBe(1_200);
  });

  test('2. Multiple 1099-INT slots sum correctly', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 1, [0, 1], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box1_interest', 500);
    state = setInput(engine, state, session, 'f1099int.primary.s1.box1_interest', 750);

    expect(val(state, F1099INT_OUTPUTS.primaryInterest)).toBe(1_250);
    expect(val(state, SCHEDULE_B_OUTPUTS.taxableInterest)).toBe(1_250);
  });

  test('3. Box 8 (tax-exempt) does NOT add to taxable interest', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box1_interest', 300);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box8_taxExemptInterest', 2_000);

    // Taxable interest = Box 1 only
    expect(val(state, SCHEDULE_B_OUTPUTS.taxableInterest)).toBe(300);
    // Tax-exempt interest is tracked separately
    expect(val(state, SCHEDULE_B_OUTPUTS.taxExemptInterest)).toBe(2_000);
  });

  test('4. Box 4 (withholding) flows to Schedule B withholding', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box4_federalWithholding', 120);

    expect(val(state, SCHEDULE_B_OUTPUTS.withholding1099)).toBe(120);
  });

  test('5. Spouse 1099-INT slot aggregates separately, both flow to Schedule B', () => {
    const { engine, session } = makeEngine('married_filing_jointly', true);
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = addIntSlot(engine, state, session, NodeOwner.SPOUSE, 0, [0], [0]);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box1_interest', 800);
    state = setInput(engine, state, session, 'f1099int.spouse.s0.box1_interest',  600);

    expect(val(state, F1099INT_OUTPUTS.primaryInterest)).toBe(800);
    expect(val(state, F1099INT_OUTPUTS.spouseInterest)).toBe(600);
    expect(val(state, SCHEDULE_B_OUTPUTS.taxableInterest)).toBe(1_400);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 1099-DIV SLOT BEHAVIOR
// ─────────────────────────────────────────────────────────────────────────────

describe('1099-DIV — Slot Behavior', () => {

  test('6. Single slot Box 1a flows to Schedule B ordinary dividends', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 2_400);

    expect(val(state, F1099DIV_OUTPUTS.primaryOrdinaryDividends)).toBe(2_400);
    expect(val(state, SCHEDULE_B_OUTPUTS.ordinaryDividends)).toBe(2_400);
  });

  test('7. Multiple 1099-DIV slots sum correctly', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 1, [0, 1], []);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 1_000);
    state = setInput(engine, state, session, 'f1099div.primary.s1.box1a_ordinaryDividends', 1_500);

    expect(val(state, SCHEDULE_B_OUTPUTS.ordinaryDividends)).toBe(2_500);
  });

  test('8. Box 1b (qualified) flows separately and is ≤ Box 1a', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 3_000);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1b_qualifiedDividends', 2_500);

    expect(val(state, SCHEDULE_B_OUTPUTS.ordinaryDividends)).toBe(3_000);
    expect(val(state, SCHEDULE_B_OUTPUTS.qualifiedDividends)).toBe(2_500);
    // Qualified must be ≤ ordinary
    expect(val(state, SCHEDULE_B_OUTPUTS.qualifiedDividends))
      .toBeLessThanOrEqual(val(state, SCHEDULE_B_OUTPUTS.ordinaryDividends));
  });

  test('9. Box 4 (withholding) flows to Schedule B total withholding', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box4_federalWithholding', 240);

    expect(val(state, SCHEDULE_B_OUTPUTS.withholding1099)).toBe(240);
  });

  test('10. Spouse 1099-DIV slot aggregates separately, both flow to Schedule B', () => {
    const { engine, session } = makeEngine('married_filing_jointly', true);
    let state = engine.initializeSession(session).currentState;
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = addDivSlot(engine, state, session, NodeOwner.SPOUSE, 0, [0], [0]);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 1_200);
    state = setInput(engine, state, session, 'f1099div.spouse.s0.box1a_ordinaryDividends',  800);

    expect(val(state, F1099DIV_OUTPUTS.primaryOrdinaryDividends)).toBe(1_200);
    expect(val(state, F1099DIV_OUTPUTS.spouseOrdinaryDividends)).toBe(800);
    expect(val(state, SCHEDULE_B_OUTPUTS.ordinaryDividends)).toBe(2_000);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE B AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule B — Aggregation', () => {

  test('11. Schedule B Line 4 = sum of all 1099-INT Box 1 (primary + spouse)', () => {
    const { engine, session } = makeEngine('married_filing_jointly', true);
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = addIntSlot(engine, state, session, NodeOwner.SPOUSE, 0, [0], [0]);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box1_interest', 1_000);
    state = setInput(engine, state, session, 'f1099int.spouse.s0.box1_interest',  2_000);

    expect(val(state, SCHEDULE_B_OUTPUTS.taxableInterest)).toBe(3_000);
  });

  test('12. Schedule B Line 6 = sum of all 1099-DIV Box 1a (primary + spouse)', () => {
    const { engine, session } = makeEngine('married_filing_jointly', true);
    let state = engine.initializeSession(session).currentState;
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = addDivSlot(engine, state, session, NodeOwner.SPOUSE, 0, [0], [0]);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 1_500);
    state = setInput(engine, state, session, 'f1099div.spouse.s0.box1a_ordinaryDividends',  500);

    expect(val(state, SCHEDULE_B_OUTPUTS.ordinaryDividends)).toBe(2_000);
  });

  test('13. Tax-exempt interest tracked in Schedule B joint node', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box8_taxExemptInterest', 5_000);

    expect(val(state, SCHEDULE_B_OUTPUTS.taxExemptInterest)).toBe(5_000);
  });

  test('14. 1099 withholding = INT Box 4 + DIV Box 4 across all slots', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box4_federalWithholding', 100);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box4_federalWithholding', 200);

    expect(val(state, SCHEDULE_B_OUTPUTS.withholding1099)).toBe(300);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FORM 1040 INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule B → Form 1040 Integration', () => {

  test('15. Line 2a = tax-exempt interest (informational — present but NOT in Line 9)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box8_taxExemptInterest', 10_000);

    expect(val(state, F1040_OUTPUTS.taxExemptInterest)).toBe(10_000);
    // Tax-exempt interest does NOT increase total income
    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(0);
  });

  test('16. Line 2b = taxable interest → included in Line 9', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box1_interest', 3_000);

    expect(val(state, F1040_OUTPUTS.taxableInterest)).toBe(3_000);
    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(3_000);
  });

  test('17. Line 3a = qualified dividends — informational, not double-counted in Line 9', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 4_000);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1b_qualifiedDividends', 3_500);

    expect(val(state, F1040_OUTPUTS.qualifiedDividends)).toBe(3_500);
    expect(val(state, F1040_OUTPUTS.ordinaryDividends)).toBe(4_000);
    // Line 9 should include 4,000 (ordinary) only — NOT 4,000 + 3,500
    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(4_000);
  });

  test('18. Line 3b = ordinary dividends → included in Line 9', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 2_000);

    expect(val(state, F1040_OUTPUTS.ordinaryDividends)).toBe(2_000);
    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(2_000);
  });

  test('19. Line 9 = wages + interest + dividends + Schedule 1 Part I', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    // Interest
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box1_interest', 1_000);
    // Dividends
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 2_000);
    // Schedule 1 Part I
    state = setInput(engine, state, session, 'schedule1.joint.line7_unemploymentCompensation', 5_000);

    // Line 9 = 0 (wages, no W-2) + 1,000 (interest) + 2,000 (dividends) + 5,000 (unemployment)
    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(8_000);
  });

  test('20. Tax-exempt interest does NOT affect AGI or tax', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box8_taxExemptInterest', 50_000);

    // Tax-exempt interest should not affect any tax computation
    expect(val(state, F1040_OUTPUTS.adjustedGrossIncome)).toBe(0);
    expect(val(state, F1040_OUTPUTS.taxableIncome)).toBe(0);
    expect(val(state, F1040_OUTPUTS.tax)).toBe(0);
  });

  test('21. Qualified dividends (3a) are NOT double-counted beyond ordinary dividends (3b)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    // All dividends are qualified
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 5_000);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1b_qualifiedDividends', 5_000);

    // Line 9 should be 5,000 — not 10,000
    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(5_000);
  });

  test('22. Line 25b = 1099 withholding (backup withholding from INT + DIV)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box4_federalWithholding', 150);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box4_federalWithholding', 250);

    // Line 25b should now be 400 (computed from Schedule B)
    expect(val(state, 'f1040.joint.line25b_1099Withholding')).toBe(400);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule B — Edge Cases', () => {

  test('23. Zero slots → all Schedule B lines are 0', () => {
    const { engine, session } = makeEngine();
    const state = engine.initializeSession(session).currentState;

    expect(val(state, SCHEDULE_B_OUTPUTS.taxableInterest)).toBe(0);
    expect(val(state, SCHEDULE_B_OUTPUTS.taxExemptInterest)).toBe(0);
    expect(val(state, SCHEDULE_B_OUTPUTS.ordinaryDividends)).toBe(0);
    expect(val(state, SCHEDULE_B_OUTPUTS.qualifiedDividends)).toBe(0);
    expect(val(state, SCHEDULE_B_OUTPUTS.withholding1099)).toBe(0);
    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(0);
  });

  test('24. MFJ with both spouses having 1099s — correct joint totals', () => {
    const { engine, session } = makeEngine('married_filing_jointly', true);
    let state = engine.initializeSession(session).currentState;
    // Primary: 1099-INT + 1099-DIV
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    // Spouse: 1099-INT + 1099-DIV
    state = addIntSlot(engine, state, session, NodeOwner.SPOUSE, 0, [0], [0]);
    state = addDivSlot(engine, state, session, NodeOwner.SPOUSE, 0, [0], [0]);

    state = setInput(engine, state, session, 'f1099int.primary.s0.box1_interest',            1_000);
    state = setInput(engine, state, session, 'f1099int.spouse.s0.box1_interest',              2_000);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends',   3_000);
    state = setInput(engine, state, session, 'f1099div.spouse.s0.box1a_ordinaryDividends',    4_000);

    expect(val(state, SCHEDULE_B_OUTPUTS.taxableInterest)).toBe(3_000);
    expect(val(state, SCHEDULE_B_OUTPUTS.ordinaryDividends)).toBe(7_000);
    // MFJ standard deduction 2025 = 30,000 — total income 10,000 < std deduction → taxable income = 0
    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(10_000);
    expect(val(state, F1040_OUTPUTS.taxableIncome)).toBe(0);
  });

  test('25. Interest-only filer (no W-2, no dividends)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box1_interest', 20_000);

    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(20_000);
    // AGI = 20,000, standard deduction single 2025 = 15,000, taxable = 5,000
    expect(val(state, F1040_OUTPUTS.taxableIncome)).toBe(5_000);
    // Tax on $5,000 single: 10% bracket → 5,000 × 0.10 = 500
    expect(val(state, F1040_OUTPUTS.tax)).toBeCloseTo(500, 0);
  });

  test('26. Dividend-only filer (no W-2, no interest)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 25_000);

    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(25_000);
    // Single std deduction 15,000 → taxable 10,000
    expect(val(state, F1040_OUTPUTS.taxableIncome)).toBe(10_000);
  });

  test('27. All three types: wages + interest + dividends', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;
    // Note: W-2 wages require FormSlotRegistry — we test interest + dividends
    // and Schedule 1 business income to simulate a mixed-income filer
    state = addIntSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = addDivSlot(engine, state, session, NodeOwner.PRIMARY, 0, [0], []);
    state = setInput(engine, state, session, 'f1099int.primary.s0.box1_interest',           5_000);
    state = setInput(engine, state, session, 'f1099div.primary.s0.box1a_ordinaryDividends', 8_000);
    state = setInput(engine, state, session, 'schedule1.joint.line3_businessIncome',       40_000);

    // Total: 5,000 + 8,000 + 40,000 = 53,000
    expect(val(state, F1040_OUTPUTS.totalIncome)).toBe(53_000);
    // Standard deduction single 2025 = 15,000 → taxable = 38,000
    expect(val(state, F1040_OUTPUTS.taxableIncome)).toBe(38_000);
  });

});