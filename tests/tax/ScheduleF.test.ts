/**
 * SCHEDULE F — TESTS
 * Profit or Loss from Farming
 *
 * Test scenarios:
 *
 *   Basic income/expense:
 *   1.  Single farm, cash sales only, no expenses → net = gross income
 *   2.  Single farm, income + expenses → correct net profit
 *   3.  Farm loss (expenses > income) → negative Line 36
 *   4.  Zero activity → all zeros
 *
 *   Income lines:
 *   5.  Livestock resale gain (1a − 1b): gain, loss, and break-even
 *   6.  Cooperative distributions use taxable amount (3b), not gross (3a)
 *   7.  Agricultural program payments use taxable amount (4b), not gross (4a)
 *   8.  CCC loans election (5a) and forfeited (5b) both flow into gross income
 *   9.  Crop insurance proceeds add to gross income
 *   10. Custom hire income (Line 7) adds to gross income
 *
 *   Expense lines:
 *   11. Standard mileage: business miles × $0.70 + parking/tolls
 *   12. Zero business miles → zero car expense
 *   13. All expense lines sum correctly into Line 35
 *   14. Meals deduction constant exposed in constants (50%)
 *
 *   Multiple slots / aggregation:
 *   15. Two primary farm slots → totalNetProfit sums both
 *   16. Spouse farm slot → spouse aggregator is separate
 *   17. Primary + spouse → joint aggregator = primary + spouse
 *
 *   Connection to parent forms:
 *   18. Joint total net profit flows correctly (value check)
 *   19. Farm loss does NOT floor to zero in aggregators (Schedule SE/1 handle that)
 *
 *   Edge cases:
 *   20. Livestock resale: sale price < cost → loss on 1c (negative), reduces gross
 *   21. Multiple income sources all contribute to Line 9
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
  generateScheduleFSlotNodes,
  generateScheduleFAggregators,
  SCHEDULE_F_INITIAL_AGGREGATORS,
  SCHEDULE_F_OUTPUTS,
} from '../../src/tax/forms/schedule-f/nodes';
import { SCHEDULE_F_CONSTANTS_2025 } from '../../src/tax/forms/schedule-f/constants';
import { NodeOwner } from '../../src/core/graph/node.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Build an engine with one primary farm slot registered (slot index 0).
 * Most tests only need a single farm — use makeEngineWithSlots() for multi-slot tests.
 */
function makeEngine(filingStatus = 'single') {
  const engine = new TaxGraphEngineImpl();

  const primarySlot0 = generateScheduleFSlotNodes(NodeOwner.PRIMARY, 0);
  const aggregators  = generateScheduleFAggregators([0], []);   // 1 primary slot, no spouse

  engine.registerNodes([
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
    ...F1040_PAYMENT_NODES,
    ...primarySlot0,
    ...aggregators,
  ]);

  const session = {
    taxYear: '2025',
    filingStatus,
    hasSpouse: false,
    sessionKey: 'test-schedule-f',
  };

  return { engine, session };
}

/**
 * Build an engine with configurable slot setup for multi-slot / spouse tests.
 *
 * @param primarySlots  array of slot indices for primary owner (e.g. [0, 1])
 * @param spouseSlots   array of slot indices for spouse owner (e.g. [0])
 */
function makeEngineWithSlots(
  primarySlots: number[],
  spouseSlots:  number[],
  filingStatus = 'married_filing_jointly',
) {
  const engine = new TaxGraphEngineImpl();

  const nodes = [
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
    ...F1040_PAYMENT_NODES,
  ];

  for (const i of primarySlots) {
    nodes.push(...generateScheduleFSlotNodes(NodeOwner.PRIMARY, i));
  }
  for (const i of spouseSlots) {
    nodes.push(...generateScheduleFSlotNodes(NodeOwner.SPOUSE, i));
  }
  nodes.push(...generateScheduleFAggregators(primarySlots, spouseSlots));

  engine.registerNodes(nodes);

  const session = {
    taxYear: '2025',
    filingStatus,
    hasSpouse: spouseSlots.length > 0,
    sessionKey: 'test-schedule-f-multi',
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

// Convenience: set a primary slot-0 field
function setSlot(
  engine:  TaxGraphEngineImpl,
  state:   Record<string, any>,
  session: any,
  field:   string,
  value:   any,
  owner = 'primary',
  slot  = 0,
) {
  return setInput(engine, state, session, `scheduleF.${owner}.s${slot}.${field}`, value);
}

// ─────────────────────────────────────────────────────────────────────────────
// BASIC INCOME / EXPENSE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule F — Basic Income and Net Profit', () => {

  test('1. Cash sales only, no expenses → net profit equals gross income', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line2_salesRaisedLivestock', 80_000);

    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(80_000);
    expect(val(state, 'scheduleF.primary.s0.line35_totalExpenses')).toBe(0);
    expect(val(state, 'scheduleF.primary.s0.line36_netProfitLoss')).toBe(80_000);
    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(80_000);
  });

  test('2. Income + multiple expenses → correct net profit', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line2_salesRaisedLivestock', 120_000);
    state = setSlot(engine, state, session, 'line16_feedPurchased',        20_000);
    state = setSlot(engine, state, session, 'line17_fertilizersLime',       8_000);
    state = setSlot(engine, state, session, 'line26_rentLeaseLand',        15_000);
    state = setSlot(engine, state, session, 'line31_taxes',                 4_000);

    const expectedExpenses = 20_000 + 8_000 + 15_000 + 4_000; // 47_000
    const expectedNet      = 120_000 - expectedExpenses;       // 73_000

    expect(val(state, 'scheduleF.primary.s0.line35_totalExpenses')).toBe(47_000);
    expect(val(state, 'scheduleF.primary.s0.line36_netProfitLoss')).toBe(73_000);
    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(73_000);
  });

  test('3. Farm loss (expenses > income) → negative Line 36', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line2_salesRaisedLivestock', 30_000);
    state = setSlot(engine, state, session, 'line16_feedPurchased',        50_000);

    expect(val(state, 'scheduleF.primary.s0.line36_netProfitLoss')).toBe(-20_000);
    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(-20_000);
  });

  test('4. Zero activity → all zero', () => {
    const { engine, session } = makeEngine();
    const state = engine.initializeSession(session).currentState;

    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(0);
    expect(val(state, 'scheduleF.primary.s0.line35_totalExpenses')).toBe(0);
    expect(val(state, 'scheduleF.primary.s0.line36_netProfitLoss')).toBe(0);
    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INCOME LINE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule F — Income Lines', () => {

  test('5a. Livestock resale: sales > cost → positive Line 1c gain', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line1a_livestockResaleSales', 40_000);
    state = setSlot(engine, state, session, 'line1b_livestockResaleCost',  25_000);

    expect(val(state, 'scheduleF.primary.s0.line1c_livestockResaleGain')).toBe(15_000);
    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(15_000);
  });

  test('5b. Livestock resale: cost > sales → negative Line 1c (loss reduces gross income)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line1a_livestockResaleSales', 20_000);
    state = setSlot(engine, state, session, 'line1b_livestockResaleCost',  25_000);

    expect(val(state, 'scheduleF.primary.s0.line1c_livestockResaleGain')).toBe(-5_000);
    // Gross income includes the −5,000 (reduces it)
    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(-5_000);
  });

  test('5c. Livestock resale break-even → Line 1c = 0', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line1a_livestockResaleSales', 30_000);
    state = setSlot(engine, state, session, 'line1b_livestockResaleCost',  30_000);

    expect(val(state, 'scheduleF.primary.s0.line1c_livestockResaleGain')).toBe(0);
  });

  test('6. Cooperative distributions: only taxable amount (3b) enters gross income', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // Gross 10_000, taxable 8_000 (non-taxable per-unit retain allocation)
    state = setSlot(engine, state, session, 'line3a_cooperativeGross',   10_000);
    state = setSlot(engine, state, session, 'line3b_cooperativeTaxable',  8_000);

    // Line 9 should include 8_000 (Line 3b), not 10_000 (Line 3a)
    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(8_000);
  });

  test('7. Agricultural program payments: only taxable amount (4b) enters gross income', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line4a_agProgramGross',   15_000);
    state = setSlot(engine, state, session, 'line4b_agProgramTaxable', 12_000);

    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(12_000);
  });

  test('8. CCC loans: both election (5a) and forfeited (5b) contribute to gross income', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line5a_cccLoansElection',  5_000);
    state = setSlot(engine, state, session, 'line5b_cccLoansForfeited', 3_000);

    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(8_000);
  });

  test('9. Crop insurance proceeds add to gross income', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line2_salesRaisedLivestock', 50_000);
    state = setSlot(engine, state, session, 'line6_cropInsurance',        18_000);

    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(68_000);
  });

  test('10. Custom hire income (Line 7) adds to gross income', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line7_customHireIncome', 6_500);

    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(6_500);
  });

  test('21. All income sources sum correctly into Line 9', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line1a_livestockResaleSales',  20_000);
    state = setSlot(engine, state, session, 'line1b_livestockResaleCost',   15_000);  // gain = 5_000
    state = setSlot(engine, state, session, 'line2_salesRaisedLivestock',   60_000);
    state = setSlot(engine, state, session, 'line3b_cooperativeTaxable',     4_000);
    state = setSlot(engine, state, session, 'line4b_agProgramTaxable',       3_000);
    state = setSlot(engine, state, session, 'line5a_cccLoansElection',       2_000);
    state = setSlot(engine, state, session, 'line5b_cccLoansForfeited',      1_000);
    state = setSlot(engine, state, session, 'line6_cropInsurance',           5_000);
    state = setSlot(engine, state, session, 'line7_customHireIncome',        3_000);
    state = setSlot(engine, state, session, 'line8_otherIncome',             1_000);

    // 5_000 + 60_000 + 4_000 + 3_000 + 2_000 + 1_000 + 5_000 + 3_000 + 1_000 = 84_000
    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(84_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE LINES
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule F — Expense Lines', () => {

  test('11. Standard mileage: miles × $0.70 + parking/tolls = Line 10', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line42a_businessMiles', 10_000);
    state = setSlot(engine, state, session, 'line10b_parkingTolls',     250);

    // 10_000 × 0.70 = 7_000 + 250 = 7_250
    expect(val(state, 'scheduleF.primary.s0.line10_carTruckExpenses')).toBe(7_250);
    expect(val(state, 'scheduleF.primary.s0.line35_totalExpenses')).toBe(7_250);
  });

  test('12. Zero business miles → zero car/truck expense', () => {
    const { engine, session } = makeEngine();
    const state = engine.initializeSession(session).currentState;

    expect(val(state, 'scheduleF.primary.s0.line10_carTruckExpenses')).toBe(0);
  });

  test('11b. Mileage rate is $0.70 for 2025', () => {
    expect(SCHEDULE_F_CONSTANTS_2025.standardMileageRate).toBe(0.70);
  });

  test('14. Meals deduction percentage is 50%', () => {
    expect(SCHEDULE_F_CONSTANTS_2025.mealsDeductionPercentage).toBe(0.50);
  });

  test('13. All expense lines sum correctly into Line 35', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // Set every expense line
    state = setSlot(engine, state, session, 'line42a_businessMiles',       2_000);  // 2_000 × 0.70 = 1_400
    state = setSlot(engine, state, session, 'line10b_parkingTolls',          100);  // +100 → line10 = 1_500
    state = setSlot(engine, state, session, 'line11_chemicals',             2_000);
    state = setSlot(engine, state, session, 'line12_conservationExpenses',    500);
    state = setSlot(engine, state, session, 'line13_customHireExpense',     1_000);
    state = setSlot(engine, state, session, 'line14_depreciation',          5_000);
    state = setSlot(engine, state, session, 'line15_employeeBenefits',        800);
    state = setSlot(engine, state, session, 'line16_feedPurchased',        10_000);
    state = setSlot(engine, state, session, 'line17_fertilizersLime',       4_000);
    state = setSlot(engine, state, session, 'line18_freightTrucking',         600);
    state = setSlot(engine, state, session, 'line19_gasolineFuelOil',       3_000);
    state = setSlot(engine, state, session, 'line20_insurance',             2_500);
    state = setSlot(engine, state, session, 'line21_mortgageInterest',      8_000);
    state = setSlot(engine, state, session, 'line22_otherInterest',         1_200);
    state = setSlot(engine, state, session, 'line23_laborHired',           12_000);
    state = setSlot(engine, state, session, 'line24_pensionPlans',            400);
    state = setSlot(engine, state, session, 'line25_rentLeaseVehicles',     1_800);
    state = setSlot(engine, state, session, 'line26_rentLeaseLand',        20_000);
    state = setSlot(engine, state, session, 'line27_repairs',               3_500);
    state = setSlot(engine, state, session, 'line28_seedsPlants',           6_000);
    state = setSlot(engine, state, session, 'line29_storageWarehousing',    1_500);
    state = setSlot(engine, state, session, 'line30_supplies',                900);
    state = setSlot(engine, state, session, 'line31_taxes',                 4_200);
    state = setSlot(engine, state, session, 'line32_utilities',             2_400);
    state = setSlot(engine, state, session, 'line33_vetBreedingMedicine',   1_100);
    state = setSlot(engine, state, session, 'line34_otherExpenses',           700);

    const expectedTotal =
      1_500  +  // line10 (mileage 1_400 + tolls 100)
      2_000  +  // line11
        500  +  // line12
      1_000  +  // line13
      5_000  +  // line14
        800  +  // line15
     10_000  +  // line16
      4_000  +  // line17
        600  +  // line18
      3_000  +  // line19
      2_500  +  // line20
      8_000  +  // line21
      1_200  +  // line22
     12_000  +  // line23
        400  +  // line24
      1_800  +  // line25
     20_000  +  // line26
      3_500  +  // line27
      6_000  +  // line28
      1_500  +  // line29
        900  +  // line30
      4_200  +  // line31
      2_400  +  // line32
      1_100  +  // line33
        700;    // line34
    // Total = 93_900

    expect(val(state, 'scheduleF.primary.s0.line35_totalExpenses')).toBe(expectedTotal);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MULTIPLE SLOTS / AGGREGATION TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule F — Multiple Farm Slots and Aggregation', () => {

  test('15. Two primary farm slots → totalNetProfit sums both', () => {
    const { engine, session } = makeEngineWithSlots([0, 1], []);
    let state = engine.initializeSession(session).currentState;

    // Farm 0: profit 60_000
    state = setInput(engine, state, session, 'scheduleF.primary.s0.line2_salesRaisedLivestock', 80_000);
    state = setInput(engine, state, session, 'scheduleF.primary.s0.line16_feedPurchased',       20_000);

    // Farm 1: profit 25_000
    state = setInput(engine, state, session, 'scheduleF.primary.s1.line2_salesRaisedLivestock', 40_000);
    state = setInput(engine, state, session, 'scheduleF.primary.s1.line26_rentLeaseLand',       15_000);

    expect(val(state, 'scheduleF.primary.s0.line36_netProfitLoss')).toBe(60_000);
    expect(val(state, 'scheduleF.primary.s1.line36_netProfitLoss')).toBe(25_000);
    expect(val(state, SCHEDULE_F_OUTPUTS.primaryNetProfit)).toBe(85_000);
    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(85_000);
  });

  test('16. Spouse farm slot → spouse aggregator is separate from primary', () => {
    const { engine, session } = makeEngineWithSlots([0], [0]);
    let state = engine.initializeSession(session).currentState;

    // Primary: profit 50_000
    state = setInput(engine, state, session, 'scheduleF.primary.s0.line2_salesRaisedLivestock', 50_000);
    // Spouse: profit 30_000
    state = setInput(engine, state, session, 'scheduleF.spouse.s0.line2_salesRaisedLivestock',  30_000);

    expect(val(state, SCHEDULE_F_OUTPUTS.primaryNetProfit)).toBe(50_000);
    expect(val(state, SCHEDULE_F_OUTPUTS.spouseNetProfit)).toBe(30_000);
  });

  test('17. Primary + spouse → joint aggregator = sum of both', () => {
    const { engine, session } = makeEngineWithSlots([0], [0]);
    let state = engine.initializeSession(session).currentState;

    state = setInput(engine, state, session, 'scheduleF.primary.s0.line2_salesRaisedLivestock', 60_000);
    state = setInput(engine, state, session, 'scheduleF.spouse.s0.line2_salesRaisedLivestock',  40_000);

    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(100_000);
  });

  test('17b. Primary profit + spouse loss → joint net reflects both', () => {
    const { engine, session } = makeEngineWithSlots([0], [0]);
    let state = engine.initializeSession(session).currentState;

    // Primary: profit 80_000
    state = setInput(engine, state, session, 'scheduleF.primary.s0.line2_salesRaisedLivestock',  80_000);
    // Spouse: loss 20_000
    state = setInput(engine, state, session, 'scheduleF.spouse.s0.line2_salesRaisedLivestock',   10_000);
    state = setInput(engine, state, session, 'scheduleF.spouse.s0.line16_feedPurchased',         30_000);

    expect(val(state, SCHEDULE_F_OUTPUTS.primaryNetProfit)).toBe(80_000);
    expect(val(state, SCHEDULE_F_OUTPUTS.spouseNetProfit)).toBe(-20_000);
    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(60_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NET PROFIT INTEGRITY TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule F — Net Profit Integrity', () => {

  test('18. Joint net profit node ID matches OUTPUTS constant', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line2_salesRaisedLivestock', 45_000);

    // The OUTPUTS constant and the hard-coded ID should match
    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(45_000);
    expect(val(state, 'scheduleF.joint.totalNetProfit')).toBe(45_000);
    expect(SCHEDULE_F_OUTPUTS.jointNetProfit).toBe('scheduleF.joint.totalNetProfit');
  });

  test('19. Farm loss is NOT floored to zero in aggregators (stays negative)', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    state = setSlot(engine, state, session, 'line2_salesRaisedLivestock', 10_000);
    state = setSlot(engine, state, session, 'line16_feedPurchased',        40_000);

    // Net should be −30_000, not 0 — Schedule SE and Schedule 1 handle the floor
    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(-30_000);
    expect(val(state, 'scheduleF.primary.totalNetProfit')).toBe(-30_000);
  });

  test('20. Livestock resale loss reduces overall net profit', () => {
    const { engine, session } = makeEngine();
    let state = engine.initializeSession(session).currentState;

    // Large raised livestock income
    state = setSlot(engine, state, session, 'line2_salesRaisedLivestock',  100_000);
    // But bought-for-resale livestock sold at a loss
    state = setSlot(engine, state, session, 'line1a_livestockResaleSales',  10_000);
    state = setSlot(engine, state, session, 'line1b_livestockResaleCost',   15_000);

    // Gross = 100_000 + (−5_000) = 95_000
    expect(val(state, 'scheduleF.primary.s0.line9_grossIncome')).toBe(95_000);
    expect(val(state, 'scheduleF.primary.s0.line36_netProfitLoss')).toBe(95_000);
    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(95_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL AGGREGATORS (EMPTY STATE)
// ─────────────────────────────────────────────────────────────────────────────

describe('Schedule F — Initial Aggregators (no slots)', () => {

  test('Initial aggregators have correct IDs and compute zero with no slots', () => {
    const engine = new TaxGraphEngineImpl();
    engine.registerNodes([
      ...F8889_NODES,
      ...F5329_NODES,
      ...SCHEDULE1_NODES,
      ...SCHEDULE2_NODES,
      ...W2_INITIAL_AGGREGATORS,
      ...F1040_NODES,
      ...F1040_PAYMENT_NODES,
      ...SCHEDULE_F_INITIAL_AGGREGATORS,
    ]);

    const session = {
      taxYear: '2025',
      filingStatus: 'single',
      hasSpouse: false,
      sessionKey: 'test-schedule-f-initial',
    };

    const state = engine.initializeSession(session).currentState;

    expect(val(state, SCHEDULE_F_OUTPUTS.primaryNetProfit)).toBe(0);
    expect(val(state, SCHEDULE_F_OUTPUTS.spouseNetProfit)).toBe(0);
    expect(val(state, SCHEDULE_F_OUTPUTS.jointNetProfit)).toBe(0);
  });
});