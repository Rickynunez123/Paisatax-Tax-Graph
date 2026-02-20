/**
 * PAISATAX — ENGINE TESTS
 *
 * These tests define what correct engine behavior looks like.
 * They use fake nodes with simple arithmetic — no tax knowledge.
 *
 * Five suites:
 *   1. Input acceptance   — engine correctly sets input node values
 *   2. Dirty propagation  — changing an input marks downstream nodes dirty
 *   3. Computation order  — topological sort produces correct visit order
 *   4. Cycle detection    — circular dependencies are caught, not silently looped
 *   5. Full trace         — trace captures before/after state correctly
 *
 * How to read these tests:
 *   - We build a fake graph of simple arithmetic nodes (add, multiply, etc.)
 *   - We send input events and assert the resulting state
 *   - We never reference any tax form or IRS concept
 *
 * When the engine implementation is written, ALL of these must pass.
 * Do not change these tests to fit the implementation — change the
 * implementation to fit the tests.
 */

import type {
  NodeDefinition,
  InputNodeDefinition,
  ComputedNodeDefinition,
} from '../../src/core/graph/node.types.js';

import { NodeKind, NodeValueType, NodeOwner, InputSource, NodeStatus } from '../../src/core/graph/node.types.js';
import { InputEventSource } from '../../src/core/graph/engine.types.js';

import type {
  InputEvent,
  EngineResult,
  TaxGraphEngine,
} from '../../src/core/graph/engine.types.js';

// ─────────────────────────────────────────────────────────────────────────────
// FAKE NODE BUILDER HELPERS
// These build minimal valid node definitions for testing.
// Real form nodes will have much richer metadata.
// ─────────────────────────────────────────────────────────────────────────────

function makeInput(id: string, defaultValue: number = 0): InputNodeDefinition {
  return {
    id,
    kind: NodeKind.INPUT,
    label: `Input ${id}`,
    description: `Test input node ${id}`,
    valueType: NodeValueType.CURRENCY,
    allowNegative: false,
    owner: NodeOwner.JOINT,
    repeatable: false,
    applicableTaxYears: ["2025"],
    classifications: ["intermediate"],
    source: InputSource.PREPARER,
    defaultValue,
  };
}

function makeComputed(
  id:           string,
  dependencies: string[],
  compute:      (ctx: any) => number | null,
  isApplicable?: (ctx: any) => boolean,
): ComputedNodeDefinition {
  return {
    id,
    kind: NodeKind.COMPUTED,
    label: `Computed ${id}`,
    description: `Test computed node ${id}`,
    valueType: NodeValueType.CURRENCY,
    allowNegative: false,
    owner: NodeOwner.JOINT,
    repeatable: false,
    applicableTaxYears: ["2025"],
    classifications: ["intermediate"],
    dependencies,
    compute,
    ...(isApplicable !== undefined ? { isApplicable } : {}),
  };
}

function makeInputEvent(instanceId: string, value: number): InputEvent {
  return {
    instanceId,
    value,
    source:    InputEventSource.PREPARER,
    timestamp: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE FACTORY
// Imported here as a type — the actual implementation is what we are
// building AFTER these tests. We import it by path so that once the
// implementation exists, the tests run against it automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { TaxGraphEngineImpl } from '../../src/core/graph/engine.js';

function createEngine(): TaxGraphEngine {
  return new TaxGraphEngineImpl();
}

// Session context used across all tests
const TEST_CONTEXT = {
  taxYear:      '2025',
  filingStatus: 'single',
  hasSpouse:    false,
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — INPUT ACCEPTANCE
// The engine must correctly accept input values, validate them,
// and reject invalid ones.
// ─────────────────────────────────────────────────────────────────────────────

describe('Suite 1 — Input Acceptance', () => {

  /**
   * Graph shape for this suite:
   *
   *   A (input) ──→ C (A + B)
   *   B (input) ──→
   */
  function buildGraph(): NodeDefinition[] {
    return [
      makeInput('A'),
      makeInput('B'),
      makeComputed('C', ['A', 'B'], ctx => {
        const a = ctx.get('A') as number ?? 0;
        const b = ctx.get('B') as number ?? 0;
        return a + b;
      }),
    ];
  }

  test('input node accepts a valid value and becomes CLEAN', () => {
    const engine = createEngine();
    engine.registerNodes(buildGraph());
    const init   = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });
    const result = engine.process(makeInputEvent('A', 100), init.currentState, TEST_CONTEXT);

    const a = result.currentState['A']!;
    expect(a.value).toBe(100);
    expect(a.status).toBe(NodeStatus.CLEAN);
  });

  test('input node with default value starts CLEAN at 0', () => {
    const engine = createEngine();
    engine.registerNodes(buildGraph());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    expect(init.currentState['A']?.value).toBe(0);
    expect(init.currentState['A']?.status).toBe(NodeStatus.CLEAN);
  });

  test('engine rejects negative value when allowNegative is false', () => {
    const engine = createEngine();
    engine.registerNodes(buildGraph());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    const validation = engine.validate(makeInputEvent('A', -50), init.currentState);

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]?.code).toBe('negative_not_allowed');
  });

  test('engine rejects input targeting a computed node without override flag', () => {
    const engine = createEngine();
    engine.registerNodes(buildGraph());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    // C is computed — you cannot set it directly without source: OVERRIDE
    const validation = engine.validate(makeInputEvent('C', 999), init.currentState);

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]?.code).toBe('node_is_computed');
  });

  test('engine rejects input for unknown node ID', () => {
    const engine = createEngine();
    engine.registerNodes(buildGraph());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    const validation = engine.validate(makeInputEvent('DOES_NOT_EXIST', 100), init.currentState);

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]?.code).toBe('node_not_found');
  });

  test('override requires a note — rejected without one', () => {
    const engine = createEngine();
    engine.registerNodes(buildGraph());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    const overrideWithoutNote: InputEvent = {
      instanceId: 'C',
      value:      999,
      source:     InputEventSource.OVERRIDE,
      timestamp:  new Date().toISOString(),
      // overrideNote intentionally missing
    };

    const validation = engine.validate(overrideWithoutNote, init.currentState);

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]?.code).toBe('override_requires_note');
  });

  test('override with note is accepted and node becomes OVERRIDE status', () => {
    const engine = createEngine();
    engine.registerNodes(buildGraph());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    const overrideEvent: InputEvent = {
      instanceId:   'C',
      value:        999,
      source:       InputEventSource.OVERRIDE,
      overrideNote: 'Taxpayer has documentation supporting this figure',
      timestamp:    new Date().toISOString(),
    };

    const result = engine.process(overrideEvent, init.currentState, TEST_CONTEXT);

    expect(result.currentState['C']?.value).toBe(999);
    expect(result.currentState['C']?.status).toBe(NodeStatus.OVERRIDE);
    expect(result.currentState['C']?.overrideNote).toBe('Taxpayer has documentation supporting this figure');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — DIRTY PROPAGATION
// When an input changes, all nodes that depend on it (directly or
// transitively) must be marked DIRTY and then recomputed.
// Nodes that do NOT depend on the changed input must NOT be recomputed.
// ─────────────────────────────────────────────────────────────────────────────

describe('Suite 2 — Dirty Propagation', () => {

  /**
   * Graph shape:
   *
   *   A (input) ──→ C (A + B) ──→ E (C * D)
   *   B (input) ──→              ↑
   *   D (input) ─────────────────┘
   *
   *   X (input) ──→ Y (X * 2)   ← independent branch, must NOT be affected
   */
  function buildGraph(): NodeDefinition[] {
    return [
      makeInput('A'),
      makeInput('B'),
      makeInput('D', 3),
      makeInput('X', 10),
      makeComputed('C', ['A', 'B'], ctx => {
        const a = ctx.get('A') as number ?? 0;
        const b = ctx.get('B') as number ?? 0;
        return a + b;
      }),
      makeComputed('E', ['C', 'D'], ctx => {
        const c = ctx.get('C') as number ?? 0;
        const d = ctx.get('D') as number ?? 0;
        return c * d;
      }),
      makeComputed('Y', ['X'], ctx => {
        const x = ctx.get('X') as number ?? 0;
        return x * 2;
      }),
    ];
  }

  test('changing A recomputes C and E but not Y', () => {
    const engine = createEngine();
    engine.registerNodes(buildGraph());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    // Set initial values
    let state = engine.process(makeInputEvent('A', 5),  init.currentState, TEST_CONTEXT).currentState;
        state = engine.process(makeInputEvent('B', 3),  state,             TEST_CONTEXT).currentState;
        state = engine.process(makeInputEvent('X', 10), state,             TEST_CONTEXT).currentState;

    // C should be 8 (5+3), E should be 24 (8*3), Y should be 20 (10*2)
    expect(state['C']?.value).toBe(8);
    expect(state['E']?.value).toBe(24);
    expect(state['Y']?.value).toBe(20);

    // Now change A — C and E should recompute, Y should NOT
    const resultA = engine.process(makeInputEvent('A', 10), state, TEST_CONTEXT);

    // C and E changed
    expect(resultA.currentState['C']?.value).toBe(13);  // 10+3
    expect(resultA.currentState['E']?.value).toBe(39);  // 13*3

    // Y was NOT recomputed — its value is still 20
    expect(resultA.currentState['Y']?.value).toBe(20);

    // Y should NOT appear in the frame's changes
    expect(resultA.frame.changes['Y']).toBeUndefined();
  });

  test('changing D recomputes E but not C', () => {
    const engine = createEngine();
    engine.registerNodes(buildGraph());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    let state = engine.process(makeInputEvent('A', 5), init.currentState, TEST_CONTEXT).currentState;
        state = engine.process(makeInputEvent('B', 3), state,             TEST_CONTEXT).currentState;
        state = engine.process(makeInputEvent('D', 3), state,             TEST_CONTEXT).currentState;

    const cValueBefore = state['C']?.value; // should be 8

    // Change D — only E should recompute
    const result = engine.process(makeInputEvent('D', 10), state, TEST_CONTEXT);

    expect(result.currentState['E']?.value).toBe(80);    // 8 * 10
    expect(result.currentState['C']?.value).toBe(cValueBefore); // unchanged
    expect(result.frame.changes['C']).toBeUndefined();          // C not in changes
  });

  test('overridden node is NOT recomputed when its dependency changes', () => {
    const engine = createEngine();
    engine.registerNodes(buildGraph());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    let state = engine.process(makeInputEvent('A', 5), init.currentState, TEST_CONTEXT).currentState;
        state = engine.process(makeInputEvent('B', 3), state,             TEST_CONTEXT).currentState;

    // Override C
    const overrideEvent: InputEvent = {
      instanceId: 'C', value: 999, source: InputEventSource.OVERRIDE,
      overrideNote: 'Test override', timestamp: new Date().toISOString(),
    };
    state = engine.process(overrideEvent, state, TEST_CONTEXT).currentState;
    expect(state['C']?.value).toBe(999);

    // Change A — C is protected by override, should stay 999
    const result = engine.process(makeInputEvent('A', 100), state, TEST_CONTEXT);

    expect(result.currentState['C']?.value).toBe(999);
    expect(result.currentState['C']?.status).toBe(NodeStatus.OVERRIDE);

    // E still recomputes because it depends on C's current value (999)
    // and D's current value (3 default) = 2997
    expect(result.currentState['E']?.value).toBe(999 * 3);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — COMPUTATION ORDER (Topological Sort)
// The engine must visit nodes in an order where all dependencies
// are computed before the nodes that depend on them.
// ─────────────────────────────────────────────────────────────────────────────

describe('Suite 3 — Computation Order', () => {

  /**
   * Graph shape (diamond dependency — classic topological sort test):
   *
   *        A (input)
   *       / \
   *      B   C       B = A * 2,  C = A * 3
   *       \ /
   *        D         D = B + C  (should be A*2 + A*3 = A*5)
   */
  function buildDiamond(): NodeDefinition[] {
    return [
      makeInput('A', 4),
      makeComputed('B', ['A'],    ctx => (ctx.get('A') as number ?? 0) * 2),
      makeComputed('C', ['A'],    ctx => (ctx.get('A') as number ?? 0) * 3),
      makeComputed('D', ['B','C'],ctx => {
        const b = ctx.get('B') as number ?? 0;
        const c = ctx.get('C') as number ?? 0;
        return b + c;
      }),
    ];
  }

  test('diamond: D is computed after both B and C', () => {
    const engine = createEngine();
    engine.registerNodes(buildDiamond());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    // A defaults to 4: B=8, C=12, D=20
    expect(init.currentState['D']?.value).toBe(20);
  });

  test('diamond: changing A recomputes B, C, then D — D gets correct value', () => {
    const engine = createEngine();
    engine.registerNodes(buildDiamond());
    const init   = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });
    const result = engine.process(makeInputEvent('A', 10), init.currentState, TEST_CONTEXT);

    // A=10: B=20, C=30, D=50
    expect(result.currentState['B']?.value).toBe(20);
    expect(result.currentState['C']?.value).toBe(30);
    expect(result.currentState['D']?.value).toBe(50);
  });

  test('diamond: visit order has B and C before D', () => {
    const engine = createEngine();
    engine.registerNodes(buildDiamond());
    const init   = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });
    const result = engine.process(makeInputEvent('A', 10), init.currentState, TEST_CONTEXT);

    const order = result.frame.visitOrder;
    const posB  = order.indexOf('B');
    const posC  = order.indexOf('C');
    const posD  = order.indexOf('D');

    // B and C must both appear before D
    expect(posB).toBeGreaterThanOrEqual(0);
    expect(posC).toBeGreaterThanOrEqual(0);
    expect(posD).toBeGreaterThan(posB);
    expect(posD).toBeGreaterThan(posC);
  });

  /**
   * Deep chain: A → B → C → D → E
   * Each step adds 1. If A=0, E should be 4.
   */
  test('deep chain computes correctly end to end', () => {
    const nodes: NodeDefinition[] = [
      makeInput('A', 0),
      makeComputed('B', ['A'], ctx => (ctx.get('A') as number ?? 0) + 1),
      makeComputed('C', ['B'], ctx => (ctx.get('B') as number ?? 0) + 1),
      makeComputed('D', ['C'], ctx => (ctx.get('C') as number ?? 0) + 1),
      makeComputed('E', ['D'], ctx => (ctx.get('D') as number ?? 0) + 1),
    ];
    const engine = createEngine();
    engine.registerNodes(nodes);
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    // A defaults to 0 → E should be 4
    expect(init.currentState['E']?.value).toBe(4);

    // Change A to 10 → E should be 14
    const result = engine.process(makeInputEvent('A', 10), init.currentState, TEST_CONTEXT);
    expect(result.currentState['E']?.value).toBe(14);
  });

  test('isApplicable returning false sets node to SKIPPED with null value', () => {
    const nodes: NodeDefinition[] = [
      makeInput('A', 100),
      makeComputed(
        'B',
        ['A'],
        ctx  => (ctx.get('A') as number ?? 0) * 2,
        _ctx => false   // never applicable
      ),
    ];
    const engine = createEngine();
    engine.registerNodes(nodes);
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    expect(init.currentState['B']?.status).toBe(NodeStatus.SKIPPED);
    expect(init.currentState['B']?.value).toBe(null);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — CYCLE DETECTION
// The engine must detect circular dependencies and surface them
// clearly rather than hanging or silently producing wrong values.
// ─────────────────────────────────────────────────────────────────────────────

describe('Suite 4 — Cycle Detection', () => {

  test('registerNodes throws when a direct cycle is declared', () => {
    /**
     * X → Y → X  (direct cycle)
     */
    const nodes: NodeDefinition[] = [
      makeInput('A'),
      makeComputed('X', ['Y'], ctx => ctx.get('Y') as number ?? 0),
      makeComputed('Y', ['X'], ctx => ctx.get('X') as number ?? 0),
    ];
    const engine = createEngine();

    // The engine should detect this at registration time, not at compute time
    expect(() => engine.registerNodes(nodes)).toThrow();
  });

  test('registerNodes throws when an indirect cycle is declared', () => {
    /**
     * P → Q → R → P  (three-node cycle)
     */
    const nodes: NodeDefinition[] = [
      makeInput('A'),
      makeComputed('P', ['R'], ctx => ctx.get('R') as number ?? 0),
      makeComputed('Q', ['P'], ctx => ctx.get('P') as number ?? 0),
      makeComputed('R', ['Q'], ctx => ctx.get('Q') as number ?? 0),
    ];
    const engine = createEngine();

    expect(() => engine.registerNodes(nodes)).toThrow();
  });

  test('valid graph with no cycles registers without error', () => {
    const nodes: NodeDefinition[] = [
      makeInput('A'),
      makeInput('B'),
      makeComputed('C', ['A', 'B'], ctx => {
        return (ctx.get('A') as number ?? 0) + (ctx.get('B') as number ?? 0);
      }),
    ];
    const engine = createEngine();
    expect(() => engine.registerNodes(nodes)).not.toThrow();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — EXECUTION TRACE
// The trace must accurately record what happened during each pass.
// This is the foundation of the debug and visualization tools.
// ─────────────────────────────────────────────────────────────────────────────

describe('Suite 5 — Execution Trace', () => {

  /**
   * Graph:  A (input) → B (A * 2) → C (B + 10)
   */
  function buildChain(): NodeDefinition[] {
    return [
      makeInput('A', 0),
      makeComputed('B', ['A'], ctx => (ctx.get('A') as number ?? 0) * 2),
      makeComputed('C', ['B'], ctx => (ctx.get('B') as number ?? 0) + 10),
    ];
  }

  test('frame records the triggering input event', () => {
    const engine = createEngine();
    engine.registerNodes(buildChain());
    const init   = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });
    const event  = makeInputEvent('A', 5);
    const result = engine.process(event, init.currentState, TEST_CONTEXT);

    expect(result.frame.trigger).not.toBeNull();
    expect(result.frame.trigger!.instanceId).toBe('A');
    expect(result.frame.trigger!.value).toBe(5);
  });

  test('frame records before and after value for each changed node', () => {
    const engine = createEngine();
    engine.registerNodes(buildChain());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    // Set A to 5 first
    let state = engine.process(makeInputEvent('A', 5), init.currentState, TEST_CONTEXT).currentState;
    // B is now 10, C is now 20

    // Now change A to 7
    const result = engine.process(makeInputEvent('A', 7), state, TEST_CONTEXT);

    // A changed from 5 → 7
    expect(result.frame.changes['A']?.before.value).toBe(5);
    expect(result.frame.changes['A']?.after.value).toBe(7);

    // B changed from 10 → 14
    expect(result.frame.changes['B']?.before.value).toBe(10);
    expect(result.frame.changes['B']?.after.value).toBe(14);

    // C changed from 20 → 24
    expect(result.frame.changes['C']?.before.value).toBe(20);
    expect(result.frame.changes['C']?.after.value).toBe(24);
  });

  test('frame records dependency snapshot for computed nodes', () => {
    const engine = createEngine();
    engine.registerNodes(buildChain());
    const init   = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });
    const result = engine.process(makeInputEvent('A', 6), init.currentState, TEST_CONTEXT);

    // B's dependency snapshot should show A=6
    const bChange = result.frame.changes['B'];
    expect(bChange?.dependencySnapshot).toBeDefined();
    expect(bChange?.dependencySnapshot!['A']).toBe(6);
  });

  test('frame records duration in milliseconds', () => {
    const engine = createEngine();
    engine.registerNodes(buildChain());
    const init   = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });
    const result = engine.process(makeInputEvent('A', 5), init.currentState, TEST_CONTEXT);

    expect(result.frame.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.frame.durationMs).toBe('number');
  });

  test('unchanged nodes do not appear in frame changes', () => {
    const nodes: NodeDefinition[] = [
      makeInput('A'),
      makeInput('X', 10),   // independent — never changes
      makeComputed('B', ['A'], ctx => (ctx.get('A') as number ?? 0) + 1),
      makeComputed('Y', ['X'], ctx => (ctx.get('X') as number ?? 0) + 1),
    ];
    const engine = createEngine();
    engine.registerNodes(nodes);
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    // Change A — only A and B should appear in changes
    const result = engine.process(makeInputEvent('A', 5), init.currentState, TEST_CONTEXT);

    expect(result.frame.changes['A']).toBeDefined();
    expect(result.frame.changes['B']).toBeDefined();
    expect(result.frame.changes['X']).toBeUndefined();  // X untouched
    expect(result.frame.changes['Y']).toBeUndefined();  // Y untouched
  });

  test('summary counts are accurate after a computation pass', () => {
    const nodes: NodeDefinition[] = [
      makeInput('A', 5),
      makeComputed('B', ['A'],    ctx => (ctx.get('A') as number ?? 0) * 2),
      makeComputed('C', ['A'],    ctx => (ctx.get('A') as number ?? 0) * 3, () => false), // skipped
    ];
    const engine = createEngine();
    engine.registerNodes(nodes);
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    // After init: A=CLEAN, B=CLEAN (computed from default), C=SKIPPED
    expect(init.summary.cleanNodes).toBeGreaterThanOrEqual(2);   // A and B
    expect(init.summary.skippedNodes).toBeGreaterThanOrEqual(1); // C
    expect(init.summary.errorNodes).toBe(0);
  });

  test('initializeSession frame has null trigger', () => {
    const engine = createEngine();
    engine.registerNodes(buildChain());
    const init = engine.initializeSession({ ...TEST_CONTEXT, sessionKey: 'test#2025' });

    // The setup frame has no triggering event
    expect(init.frame.trigger).toBeNull();
  });

});