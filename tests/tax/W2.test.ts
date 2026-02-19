/**
 * W-2 SLOT ARCHITECTURE TESTS
 *
 * Proves that:
 *   1. FormSlotRegistry correctly adds/removes W-2 slots
 *   2. Aggregator nodes dynamically sum across all active slots
 *   3. Engine state carries over correctly when slots change
 *   4. F1040 Line 1a and Line 25a update as slots are added/removed
 *   5. MFJ scenarios: independent primary/spouse slot counts
 *   6. Removing a slot recalculates aggregators correctly
 *   7. Existing 1040 tests still work (Line 9 is now computed)
 *
 * Test suites:
 *   1. Registry setup — form registration and initial state
 *   2. Single filer — 0, 1, 2, 3 W-2s
 *   3. MFJ — primary and spouse with different slot counts
 *   4. Slot removal — removing middle and last slot
 *   5. F1040 integration — wages flow through to AGI and total tax
 *   6. State carry-over — entered values survive slot mutations
 */

import { TaxGraphEngineImpl }              from '../../src/core/graph/engine.js';
import { FormSlotRegistry }                from '../../src/core/registry/form-instance-registry.js';
import { F8889_NODES }                     from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }                     from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }                 from '../../src/tax/forms/schedule1/nodes.js';
import { SCHEDULE2_NODES }                 from '../../src/tax/forms/schedule2/nodes';
import { W2_INITIAL_AGGREGATORS, W2_OUTPUTS, generateW2SlotNodes, generateW2Aggregators, w2NodeId } from '../../src/tax/forms/w2/nodes.js';
import { F1040_NODES, F1040_OUTPUTS }      from '../../src/tax/forms/f1040/nodes.js';
import { InputEventSource }                from '../../src/core/graph/engine.types';
import { NodeOwner, NodeStatus }           from '../../src/core/graph/node.types';
import type { InputEvent }                 from '../../src/core/graph/engine.types';
import type { NodeInstanceId, NodeSnapshot } from '../../src/core/graph/node.types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeEngine() {
  const engine = new TaxGraphEngineImpl();
  engine.registerNodes([
    ...F8889_NODES,
    ...F5329_NODES,
    ...SCHEDULE1_NODES,
    ...SCHEDULE2_NODES,
    ...W2_INITIAL_AGGREGATORS,
    ...F1040_NODES,
  ]);
  return engine;
}

function makeRegistry(engine: ReturnType<typeof makeEngine>) {
  const registry = new FormSlotRegistry(engine);
  registry.registerForm('w2', {
    generateSlotNodes:   generateW2SlotNodes,
    generateAggregators: generateW2Aggregators,
  });
  return registry;
}

const SINGLE_CTX = {
  taxYear:      '2025',
  filingStatus: 'single',
  hasSpouse:    false,
  sessionKey:   'test-single#2025',
};

const MFJ_CTX = {
  taxYear:      '2025',
  filingStatus: 'married_filing_jointly',
  hasSpouse:    true,
  sessionKey:   'test-mfj#2025',
};

function makeEvent(instanceId: string, value: string | number | boolean): InputEvent {
  return { instanceId, value, source: InputEventSource.PREPARER, timestamp: new Date().toISOString() };
}

function num(state: Record<string, NodeSnapshot>, nodeId: string): number {
  const snap = state[nodeId];
  if (!snap) throw new Error(`Node not found in state: ${nodeId}`);
  if (typeof snap.value !== 'number') {
    throw new Error(`Expected number at ${nodeId}, got ${JSON.stringify(snap.value)} (status: ${snap.status})`);
  }
  return snap.value;
}

function status(state: Record<string, NodeSnapshot>, nodeId: string): string {
  return state[nodeId]?.status ?? 'not_found';
}

// Shorthand for W-2 slot node IDs
function w2(owner: NodeOwner, slot: number, line: string): string {
  return w2NodeId(owner, slot, line);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — REGISTRY SETUP
// ─────────────────────────────────────────────────────────────────────────────

describe('W-2 Slot Architecture — Registry Setup', () => {

  test('Engine initializes with W-2 aggregators at zero', () => {
    const engine = makeEngine();
    const result = engine.initializeSession(SINGLE_CTX);

    // Aggregators exist and compute to 0 with no slots
    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(0);
    expect(num(result.currentState, W2_OUTPUTS.spouseWages)).toBe(0);
    expect(num(result.currentState, W2_OUTPUTS.jointWages)).toBe(0);
    expect(num(result.currentState, W2_OUTPUTS.jointWithholding)).toBe(0);
  });

  test('F1040 Line 1a is 0 with no W-2 slots', () => {
    const engine = makeEngine();
    const result = engine.initializeSession(SINGLE_CTX);

    expect(num(result.currentState, F1040_OUTPUTS.w2Wages)).toBe(0);
  });

  test('F1040 Line 9 is now COMPUTED (not INPUT)', () => {
    const engine = makeEngine();
    const result = engine.initializeSession(SINGLE_CTX);

    // Line 9 should have CLEAN status (computed, not user-entered)
    expect(result.currentState[F1040_OUTPUTS.totalIncome]?.status).toBe(NodeStatus.CLEAN);
  });

  test('Registry throws if form not registered', () => {
    const engine   = makeEngine();
    const registry = new FormSlotRegistry(engine);
    const result   = engine.initializeSession(SINGLE_CTX);

    expect(() => {
      registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    }).toThrow("Form 'w2' is not registered");
  });

  test('Registry throws if same form registered twice', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);

    expect(() => {
      registry.registerForm('w2', {
        generateSlotNodes:   generateW2SlotNodes,
        generateAggregators: generateW2Aggregators,
      });
    }).toThrow("Form 'w2' is already registered");
  });

  test('getSlots returns empty array before any slots added', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);

    expect(registry.getSlots('w2', NodeOwner.PRIMARY)).toEqual([]);
    expect(registry.getSlots('w2', NodeOwner.SPOUSE)).toEqual([]);
    expect(registry.hasSlots('w2')).toBe(false);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — SINGLE FILER
// ─────────────────────────────────────────────────────────────────────────────

describe('W-2 Slot Architecture — Single Filer', () => {

  test('Adding first W-2 creates slot 0 nodes', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);

    // Slot 0 nodes should now exist
    expect(result.currentState[w2(NodeOwner.PRIMARY, 0, 'box1_wages')]).toBeDefined();
    expect(result.currentState[w2(NodeOwner.PRIMARY, 0, 'box2_federalWithholding')]).toBeDefined();
    expect(result.currentState[w2(NodeOwner.PRIMARY, 0, 'employer_name')]).toBeDefined();
  });

  test('One W-2: entering Box 1 wages flows to Line 1a and Line 9', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = engine.process(
      makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 75_000),
      result.currentState, SINGLE_CTX
    );

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(75_000);
    expect(num(result.currentState, W2_OUTPUTS.jointWages)).toBe(75_000);
    expect(num(result.currentState, F1040_OUTPUTS.w2Wages)).toBe(75_000);
    expect(num(result.currentState, F1040_OUTPUTS.totalIncome)).toBe(75_000);
  });

  test('Two W-2s: wages sum correctly', () => {
    /**
     * Primary has two employers:
     *   Employer A: $60,000
     *   Employer B: $40,000
     *   Total:     $100,000
     */
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);

    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 60_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 1, 'box1_wages'), 40_000), result.currentState, SINGLE_CTX);

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(100_000);
    expect(num(result.currentState, F1040_OUTPUTS.totalIncome)).toBe(100_000);
  });

  test('Three W-2s: wages and withholding sum correctly', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);

    // Wages: $50k + $30k + $20k = $100k
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 50_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 1, 'box1_wages'), 30_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 2, 'box1_wages'), 20_000), result.currentState, SINGLE_CTX);

    // Withholding: $6k + $4k + $2k = $12k
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box2_federalWithholding'), 6_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 1, 'box2_federalWithholding'), 4_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 2, 'box2_federalWithholding'), 2_000), result.currentState, SINGLE_CTX);

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(100_000);
    expect(num(result.currentState, W2_OUTPUTS.primaryWithholding)).toBe(12_000);
    expect(num(result.currentState, F1040_OUTPUTS.w2Withholding)).toBe(12_000);
  });

  test('getSlots returns correct indices after adding', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);

    expect(registry.getSlots('w2', NodeOwner.PRIMARY)).toEqual([0, 1, 2]);
    expect(registry.getTotalSlotCount('w2')).toBe(3);
    expect(registry.hasSlots('w2')).toBe(true);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — MFJ SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────

describe('W-2 Slot Architecture — MFJ Scenarios', () => {

  test('Primary and spouse W-2 wages sum into joint total', () => {
    /**
     * Primary: $80,000 (one employer)
     * Spouse:  $65,000 (one employer)
     * Joint:  $145,000
     */
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(MFJ_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, MFJ_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.SPOUSE,  MFJ_CTX, result.currentState);

    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 80_000), result.currentState, MFJ_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.SPOUSE,  0, 'box1_wages'), 65_000), result.currentState, MFJ_CTX);

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(80_000);
    expect(num(result.currentState, W2_OUTPUTS.spouseWages)).toBe(65_000);
    expect(num(result.currentState, W2_OUTPUTS.jointWages)).toBe(145_000);
    expect(num(result.currentState, F1040_OUTPUTS.totalIncome)).toBe(145_000);
  });

  test('Primary has 2 W-2s, spouse has 1', () => {
    /**
     * Primary: $50k (Amazon) + $30k (Uber) = $80k
     * Spouse:  $90k (Google)
     * Joint:  $170k
     */
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(MFJ_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, MFJ_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, MFJ_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.SPOUSE,  MFJ_CTX, result.currentState);

    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 50_000), result.currentState, MFJ_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 1, 'box1_wages'), 30_000), result.currentState, MFJ_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.SPOUSE,  0, 'box1_wages'), 90_000), result.currentState, MFJ_CTX);

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(80_000);
    expect(num(result.currentState, W2_OUTPUTS.spouseWages)).toBe(90_000);
    expect(num(result.currentState, W2_OUTPUTS.jointWages)).toBe(170_000);
  });

  test('Only spouse has W-2 — primary wages = 0', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(MFJ_CTX);

    result = registry.addSlot('w2', NodeOwner.SPOUSE, MFJ_CTX, result.currentState);
    result = engine.process(makeEvent(w2(NodeOwner.SPOUSE, 0, 'box1_wages'), 55_000), result.currentState, MFJ_CTX);

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(0);
    expect(num(result.currentState, W2_OUTPUTS.spouseWages)).toBe(55_000);
    expect(num(result.currentState, W2_OUTPUTS.jointWages)).toBe(55_000);
  });

  test('Primary slot indices are independent of spouse slot indices', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(MFJ_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, MFJ_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, MFJ_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.SPOUSE,  MFJ_CTX, result.currentState);

    // Primary has slots 0 and 1; spouse starts fresh at 0
    expect(registry.getSlots('w2', NodeOwner.PRIMARY)).toEqual([0, 1]);
    expect(registry.getSlots('w2', NodeOwner.SPOUSE)).toEqual([0]);

    // Spouse slot 0 is a different node from primary slot 0
    expect(w2(NodeOwner.PRIMARY, 0, 'box1_wages')).not.toBe(
      w2(NodeOwner.SPOUSE, 0, 'box1_wages')
    );
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — SLOT REMOVAL
// ─────────────────────────────────────────────────────────────────────────────

describe('W-2 Slot Architecture — Slot Removal', () => {

  test('Removing only slot returns wages to 0', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 75_000), result.currentState, SINGLE_CTX);

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(75_000);

    result = registry.removeSlot('w2', NodeOwner.PRIMARY, 0, SINGLE_CTX, result.currentState);

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(0);
    expect(num(result.currentState, F1040_OUTPUTS.totalIncome)).toBe(0);
    expect(registry.getSlots('w2', NodeOwner.PRIMARY)).toEqual([]);
  });

  test('Removing one of two slots recalculates sum', () => {
    /**
     * Primary: slot 0 = $60k, slot 1 = $40k → total $100k
     * Remove slot 0 → total = $40k
     */
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);

    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 60_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 1, 'box1_wages'), 40_000), result.currentState, SINGLE_CTX);

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(100_000);

    result = registry.removeSlot('w2', NodeOwner.PRIMARY, 0, SINGLE_CTX, result.currentState);

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(40_000);
    expect(registry.getSlots('w2', NodeOwner.PRIMARY)).toEqual([1]);
  });

  test('Removing middle slot from three leaves the other two', () => {
    /**
     * Slots 0 = $30k, 1 = $20k, 2 = $50k → total $100k
     * Remove slot 1 → $30k + $50k = $80k
     */
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);

    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 30_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 1, 'box1_wages'), 20_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 2, 'box1_wages'), 50_000), result.currentState, SINGLE_CTX);

    result = registry.removeSlot('w2', NodeOwner.PRIMARY, 1, SINGLE_CTX, result.currentState);

    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(80_000);
    expect(registry.getSlots('w2', NodeOwner.PRIMARY)).toEqual([0, 2]);
  });

  test('Removing non-existent slot throws', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    const result   = engine.initializeSession(SINGLE_CTX);

    expect(() => {
      registry.removeSlot('w2', NodeOwner.PRIMARY, 99, SINGLE_CTX, result.currentState);
    }).toThrow('slot not found');
  });

  test('Slot indices do not reset after removal — monotonically increasing', () => {
    /**
     * Add slot 0, add slot 1, remove slot 0, add slot 2 (NOT slot 0 again).
     * This prevents state collision with previously removed slot node IDs.
     */
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.removeSlot('w2', NodeOwner.PRIMARY, 0, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);

    // Active slots are 1 and 2 (not 0 and 1)
    expect(registry.getSlots('w2', NodeOwner.PRIMARY)).toEqual([1, 2]);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — F1040 INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

describe('W-2 Slot Architecture — F1040 Integration', () => {

  test('W-2 wages feed AGI correctly with HSA deduction', () => {
    /**
     * W-2 wages: $100,000
     * HSA deduction (self-only): $4,300
     * AGI: $95,700
     */
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 100_000), result.currentState, SINGLE_CTX);

    // Add HSA deduction
    result = engine.process(makeEvent('f8889.primary.line1_coverageType',          'self_only'), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent('f8889.primary.line2_personalContributions', 4_300),       result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent('f8889.primary.line4input_ageAsOfDec31',     40),          result.currentState, SINGLE_CTX);

    expect(num(result.currentState, F1040_OUTPUTS.w2Wages)).toBe(100_000);
    expect(num(result.currentState, F1040_OUTPUTS.totalIncome)).toBe(100_000);
    expect(num(result.currentState, F1040_OUTPUTS.adjustedGrossIncome)).toBe(95_700);
  });

  test('Adding other income to W-2 wages sums on Line 9', () => {
    /**
     * W-2 wages: $80,000
     * Other income (manual): $5,000
     * Line 9: $85,000
     */
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 80_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent('f1040.joint.line9input_otherIncome', 5_000), result.currentState, SINGLE_CTX);

    expect(num(result.currentState, F1040_OUTPUTS.totalIncome)).toBe(85_000);
  });

  test('Full vertical slice: W-2 → Line 9 → AGI → taxable income → tax', () => {
    /**
     * Single filer, age 30
     * W-2 wages: $60,000
     * Standard deduction (single 2025): $15,000
     * Taxable income: $45,000
     * Tax (roughly 10% + 12% bracket): computed from brackets
     */
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 60_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent('f1040.joint.line12input_primaryAge', 30), result.currentState, SINGLE_CTX);

    const wages        = num(result.currentState, F1040_OUTPUTS.w2Wages);
    const totalIncome  = num(result.currentState, F1040_OUTPUTS.totalIncome);
    const stdDed       = num(result.currentState, F1040_OUTPUTS.standardDeduction);
    const taxableInc   = num(result.currentState, F1040_OUTPUTS.taxableIncome);
    const tax          = num(result.currentState, F1040_OUTPUTS.tax);

    expect(wages).toBe(60_000);
    expect(totalIncome).toBe(60_000);
    expect(stdDed).toBe(15_000);        // 2025 single standard deduction
    expect(taxableInc).toBe(45_000);
    expect(tax).toBeGreaterThan(0);     // computed from brackets
    expect(tax).toBeLessThan(60_000);   // sanity: less than total income
  });

  test('W-2 withholding shows on Line 25a', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box2_federalWithholding'), 10_000), result.currentState, SINGLE_CTX);

    expect(num(result.currentState, F1040_OUTPUTS.w2Withholding)).toBe(10_000);
  });

  test('MFJ: combined wages from both filers flow to Line 9', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(MFJ_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, MFJ_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.SPOUSE,  MFJ_CTX, result.currentState);

    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 120_000), result.currentState, MFJ_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.SPOUSE,  0, 'box1_wages'),  80_000), result.currentState, MFJ_CTX);

    expect(num(result.currentState, F1040_OUTPUTS.totalIncome)).toBe(200_000);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6 — STATE CARRY-OVER
// ─────────────────────────────────────────────────────────────────────────────

describe('W-2 Slot Architecture — State Carry-Over', () => {

  test('Values in existing slots survive adding a new slot', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'),          60_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box2_federalWithholding'), 8_000), result.currentState, SINGLE_CTX);

    // Slot 0 values before adding slot 1
    expect(num(result.currentState, w2(NodeOwner.PRIMARY, 0, 'box1_wages'))).toBe(60_000);

    // Add slot 1
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);

    // Slot 0 values preserved
    expect(num(result.currentState, w2(NodeOwner.PRIMARY, 0, 'box1_wages'))).toBe(60_000);
    expect(num(result.currentState, w2(NodeOwner.PRIMARY, 0, 'box2_federalWithholding'))).toBe(8_000);

    // Slot 1 starts at 0
    expect(result.currentState[w2(NodeOwner.PRIMARY, 1, 'box1_wages')]?.value).toBe(0);
  });

  test('HSA and other form values survive W-2 slot mutations', () => {
    /**
     * HSA values entered before W-2 slots are added should persist
     * unchanged after slot mutations.
     */
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    // Enter HSA data first
    result = engine.process(makeEvent('f8889.primary.line1_coverageType',          'self_only'), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent('f8889.primary.line2_personalContributions', 4_300),       result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent('f8889.primary.line4input_ageAsOfDec31',     40),          result.currentState, SINGLE_CTX);

    const hsaDeductionBefore = num(result.currentState, 'schedule1.joint.line13_hsaDeduction');
    expect(hsaDeductionBefore).toBe(4_300);

    // Add W-2 slot
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);

    // HSA deduction unchanged
    expect(num(result.currentState, 'schedule1.joint.line13_hsaDeduction')).toBe(4_300);
  });

  test('Values in slot survive removing a different slot', () => {
    const engine   = makeEngine();
    const registry = makeRegistry(engine);
    let result     = engine.initializeSession(SINGLE_CTX);

    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);
    result = registry.addSlot('w2', NodeOwner.PRIMARY, SINGLE_CTX, result.currentState);

    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 0, 'box1_wages'), 40_000), result.currentState, SINGLE_CTX);
    result = engine.process(makeEvent(w2(NodeOwner.PRIMARY, 1, 'box1_wages'), 60_000), result.currentState, SINGLE_CTX);

    // Remove slot 0
    result = registry.removeSlot('w2', NodeOwner.PRIMARY, 0, SINGLE_CTX, result.currentState);

    // Slot 1 value intact
    expect(num(result.currentState, w2(NodeOwner.PRIMARY, 1, 'box1_wages'))).toBe(60_000);
    expect(num(result.currentState, W2_OUTPUTS.primaryWages)).toBe(60_000);
  });

});