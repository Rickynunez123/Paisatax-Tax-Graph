/**
 * PAISATAX — TAX GRAPH ENGINE IMPLEMENTATION
 *
 * This is the core execution engine. It has zero tax knowledge —
 * it only knows how to run a dependency graph.
 *
 * Responsibilities:
 *   1. Register node definitions and validate the graph at startup
 *   2. Detect circular dependencies at registration time (not compute time)
 *   3. Accept input events and validate them before applying
 *   4. Propagate dirty flags to all downstream dependents
 *   5. Sort dirty nodes topologically and recompute them in order
 *   6. Record every change in a full-snapshot TraceFrame
 *   7. Return an immutable EngineResult — never mutate input state
 *
 * Design principles:
 *   - Stateless: no instance variables change between process() calls
 *   - Immutable: input state is never mutated — new state is always returned
 *   - Pure: given the same state + event, always produces the same result
 *   - Explicit: every decision is traceable through the TraceFrame
 */

import { isComputedNode, isInputNode, NodeStatus, NodeValueType } from './node.types.js';
import type {
  NodeDefinition,
  NodeId,
  NodeInstanceId,
  NodeSnapshot,
  NodeValue,
  ComputeContext,
} from './node.types.js';

import { InputEventSource } from './engine.types.js';


import type{
  EngineResult,
  InputEvent,
  TaxGraphEngine,
  TraceFrame,
  NodeChange,
  SkipReason,
  ValidationResult,
  ValidationError,
} from './engine.types.js';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL TYPES
// Only used inside this file — not exported
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal representation of the dependency graph.
 * Built once during registerNodes() and never mutated.
 *
 * adjacency:   nodeId → set of nodeIds that depend on it (downstream)
 * dependencies: nodeId → set of nodeIds it depends on (upstream)
 * topOrder:    stable topological sort of all nodes (root → leaf)
 */
interface InternalGraph {
  adjacency:    Map<NodeId, Set<NodeId>>
  dependencies: Map<NodeId, Set<NodeId>>
  topOrder:     NodeId[]
}

/**
 * Session context passed into process() and initializeSession().
 */
interface EngineContext {
  taxYear:      string
  filingStatus: string
  hasSpouse:    boolean
  sessionKey?:  string
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export class TaxGraphEngineImpl implements TaxGraphEngine {

  /**
   * All registered node definitions.
   * Key: nodeId. Set once by registerNodes(), never mutated after.
   */
  private definitions: Map<NodeId, NodeDefinition> = new Map();

  /**
   * The internal dependency graph.
   * Built once by registerNodes() via buildGraph().
   */
  private graph: InternalGraph = {
    adjacency:    new Map(),
    dependencies: new Map(),
    topOrder:     [],
  };

  /**
   * Frame counter — monotonically increasing across the session.
   * Incremented each time process() or initializeSession() is called.
   */
  private frameCounter: number = 0;

  // ───────────────────────────────────────────────────────────────────────────
  // REGISTRATION
  // ───────────────────────────────────────────────────────────────────────────

  registerNodes(definitions: NodeDefinition[]): void {
    // Store all definitions
    for (const def of definitions) {
      this.definitions.set(def.id, def);
    }

    // Build and validate the dependency graph
    // This throws if any cycle is detected — fail fast at startup
    this.graph = this.buildGraph(definitions);
  }

  /**
   * Build the internal graph from node definitions.
   * Performs topological sort using Kahn's algorithm.
   * Throws a descriptive error if any cycle is detected.
   */
  private buildGraph(definitions: NodeDefinition[]): InternalGraph {
    const adjacency    = new Map<NodeId, Set<NodeId>>();
    const dependencies = new Map<NodeId, Set<NodeId>>();

    // Initialize maps for all nodes
    for (const def of definitions) {
      adjacency.set(def.id, new Set());
      dependencies.set(def.id, new Set());
    }

    // Wire up edges: for each computed node, register its dependencies
    for (const def of definitions) {
      if (isComputedNode(def)) {
        for (const depId of def.dependencies) {
          // Record: depId → def.id  (depId is upstream of def.id)
          adjacency.get(depId)?.add(def.id);
          dependencies.get(def.id)?.add(depId);
        }
      }
    }

    // Topological sort using Kahn's algorithm
    // in-degree: how many unprocessed dependencies each node has
    const inDegree = new Map<NodeId, number>();
    for (const def of definitions) {
      inDegree.set(def.id, dependencies.get(def.id)?.size ?? 0);
    }

    // Queue starts with all nodes that have no dependencies (roots)
    const queue: NodeId[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const topOrder: NodeId[] = [];

    while (queue.length > 0) {
      // Sort queue for deterministic ordering (alphabetical within same level)
      queue.sort();
      const nodeId = queue.shift()!;
      topOrder.push(nodeId);

      // For each node downstream of this one, reduce its in-degree
      for (const downstreamId of adjacency.get(nodeId) ?? []) {
        const newDegree = (inDegree.get(downstreamId) ?? 0) - 1;
        inDegree.set(downstreamId, newDegree);
        if (newDegree === 0) {
          queue.push(downstreamId);
        }
      }
    }

    // If topOrder doesn't include all nodes, there's a cycle
    if (topOrder.length !== definitions.length) {
      const inCycle = definitions
        .map(d => d.id)
        .filter(id => !topOrder.includes(id));

      throw new Error(
        `Circular dependency detected in node graph. ` +
        `Nodes involved: [${inCycle.join(', ')}]. ` +
        `These nodes form a cycle — check their dependency declarations.`
      );
    }

    return { adjacency, dependencies, topOrder };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SESSION INITIALIZATION
  // ───────────────────────────────────────────────────────────────────────────

  initializeSession(context: {
    taxYear:      string
    filingStatus: string
    hasSpouse:    boolean
    sessionKey:   string
  }): EngineResult {
    const startedAt = new Date().toISOString();
    const startMs   = Date.now();

    // Build initial state: input nodes get their defaultValue as CLEAN,
    // computed nodes start as DIRTY (will compute in this pass)
    const initialState: Record<NodeInstanceId, NodeSnapshot> = {};

    for (const def of this.definitions.values()) {
      const now = new Date().toISOString();

      if (isInputNode(def)) {
        // Input nodes start CLEAN with their default value
        initialState[def.id] = {
          instanceId: def.id,
          value:      def.defaultValue,
          status:     NodeStatus.CLEAN,
          updatedAt:  now,
        };
      } else {
        // Computed nodes start DIRTY — they'll compute in the pass below
        initialState[def.id] = {
          instanceId: def.id,
          value:      null,
          status:     NodeStatus.DIRTY,
          updatedAt:  now,
        };
      }
    }

    // Run a computation pass with no trigger event to resolve all computed nodes
    const { newState, changes, skipped, visitOrder } = this.runComputationPass(
      initialState,
      context,
      null
    );

    const completedAt = new Date().toISOString();
    const durationMs  = Date.now() - startMs;

    const frame: TraceFrame = {
      frameIndex:   this.frameCounter++,
      trigger:      null,
      startedAt,
      completedAt,
      durationMs,
      visitOrder,
      changes,
      skipped,
    };

    return this.buildEngineResult(true, frame, newState);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ───────────────────────────────────────────────────────────────────────────

  validate(
    event:        InputEvent,
    currentState: Record<NodeInstanceId, NodeSnapshot>
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const { instanceId, value, source } = event;

    // 1. Node must exist
    const def = this.definitions.get(instanceId);
    if (!def) {
      errors.push({
        instanceId,
        code:    'node_not_found',
        message: `Node '${instanceId}' does not exist in the registry.`,
      });
      return { valid: false, errors };
    }

    // 2. Cannot set a computed node directly without OVERRIDE source
    if (isComputedNode(def) && source !== InputEventSource.OVERRIDE) {
      errors.push({
        instanceId,
        code:    'node_is_computed',
        message: `Node '${instanceId}' is computed. To override it, use source: 'override' and provide an overrideNote.`,
      });
    }

    // 3. Override requires a note
    if (source === InputEventSource.OVERRIDE && !event.overrideNote?.trim()) {
      errors.push({
        instanceId,
        code:    'override_requires_note',
        message: `Overriding a computed node requires an overrideNote explaining why.`,
      });
    }

    // 4. Type and range validation for numeric values
    if (value !== null && typeof value === 'number') {
      // Negative check
      if (!def.allowNegative && value < 0) {
        errors.push({
          instanceId,
          code:    'negative_not_allowed',
          message: `Node '${instanceId}' does not allow negative values. Received: ${value}.`,
        });
      }

      // Min/max for input nodes
      if (isInputNode(def) && def.validation) {
        if (def.validation.min !== undefined && value < def.validation.min) {
          errors.push({
            instanceId,
            code:    'below_minimum',
            message: `Value ${value} is below the minimum of ${def.validation.min} for node '${instanceId}'.`,
          });
        }
        if (def.validation.max !== undefined && value > def.validation.max) {
          errors.push({
            instanceId,
            code:    'above_maximum',
            message: `Value ${value} is above the maximum of ${def.validation.max} for node '${instanceId}'.`,
          });
        }
      }
    }

    // 5. Enum validation
    if (
      def.valueType === NodeValueType.ENUM &&
      isInputNode(def) &&
      def.validation?.allowedValues &&
      !def.validation.allowedValues.includes(value as string)
    ) {
      errors.push({
        instanceId,
        code:    'invalid_enum_value',
        message: `Value '${value}' is not in the allowed values for node '${instanceId}': [${def.validation.allowedValues.join(', ')}].`,
      });
    }

    return { valid: errors.length === 0, errors };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PROCESS
  // ───────────────────────────────────────────────────────────────────────────

  process(
    event:        InputEvent,
    currentState: Record<NodeInstanceId, NodeSnapshot>,
    context:      EngineContext
  ): EngineResult {
    const startedAt = new Date().toISOString();
    const startMs   = Date.now();

    // Validate first — reject invalid events before touching state
    const validation = this.validate(event, currentState);
    if (!validation.valid) {
      // Return an engine result with success=false and no state changes
      const now = new Date().toISOString();
      const frame: TraceFrame = {
        frameIndex:   this.frameCounter++,
        trigger:      event,
        startedAt,
        completedAt:  now,
        durationMs:   Date.now() - startMs,
        visitOrder:   [],
        changes:      {},
        skipped:      {},
      };
      return this.buildEngineResult(false, frame, currentState);
    }

    // Apply the input event to produce a new state (immutable)
    // Also captures the before/after change for the trace
    const { state: stateAfterInput, inputChange } = this.applyInputEvent(event, currentState);

    // Mark all downstream nodes DIRTY
    const dirtyState = this.propagateDirty(event.instanceId, stateAfterInput);

    // Run the computation pass
    const { newState, changes, skipped, visitOrder } = this.runComputationPass(
      dirtyState,
      context,
      event
    );

    // Merge the input node's own change into the changes map
    if (inputChange) {
      changes[event.instanceId] = inputChange;
    }

    const completedAt = new Date().toISOString();
    const durationMs  = Date.now() - startMs;

    const frame: TraceFrame = {
      frameIndex:   this.frameCounter++,
      trigger:      event,
      startedAt,
      completedAt,
      durationMs,
      visitOrder,
      changes,
      skipped,
    };

    return this.buildEngineResult(true, frame, newState);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — INPUT APPLICATION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Apply an input event to the current state.
   * Returns a new state object AND a NodeChange for the trace.
   * Does NOT mutate currentState.
   */
  private applyInputEvent(
    event:        InputEvent,
    currentState: Record<NodeInstanceId, NodeSnapshot>
  ): { state: Record<NodeInstanceId, NodeSnapshot>; inputChange: NodeChange | null } {
    const now      = new Date().toISOString();
    const before   = currentState[event.instanceId];

    const after: NodeSnapshot = {
    instanceId: event.instanceId,
    value:      event.value,
    status:     event.source === InputEventSource.OVERRIDE
                    ? NodeStatus.OVERRIDE
                    : NodeStatus.CLEAN,
    updatedAt:  now,

    ...(event.overrideNote !== undefined ? { overrideNote: event.overrideNote } : {}),
    ...(before?.unsupportedNote !== undefined ? { unsupportedNote: before.unsupportedNote } : {}),
    };


    const state = {
      ...currentState,
      [event.instanceId]: after,
    };

    // Record the change only if value or status actually changed
    const inputChange: NodeChange | null =
      (before?.value !== after.value || before?.status !== after.status)
        ? { instanceId: event.instanceId, before: before ?? after, after }
        : null;

    return { state, inputChange };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — DIRTY PROPAGATION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Mark all nodes downstream of changedId as DIRTY.
   * Uses BFS through the adjacency map.
   * Returns a new state object — does NOT mutate input.
   */
  private propagateDirty(
    changedId:    NodeInstanceId,
    currentState: Record<NodeInstanceId, NodeSnapshot>
  ): Record<NodeInstanceId, NodeSnapshot> {
    const newState = { ...currentState };
    const now      = new Date().toISOString();

    // BFS queue — start with all immediate dependents of changedId
    const queue: NodeId[] = [...(this.graph.adjacency.get(changedId) ?? [])];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const existing = newState[nodeId];

      // Don't mark OVERRIDE nodes as DIRTY — they're protected
      if (existing?.status === NodeStatus.OVERRIDE) continue;

      // Mark dirty
    //   newState[nodeId] = {
    //     ...existing,
    //     instanceId: nodeId,
    //     status:     NodeStatus.DIRTY,
    //     updatedAt:  now,
    //   };
    newState[nodeId] = {
    instanceId: nodeId,
    value: existing?.value ?? null,
    status: NodeStatus.DIRTY,
    updatedAt: now,
    };


      // Propagate further downstream
      for (const downstream of this.graph.adjacency.get(nodeId) ?? []) {
        if (!visited.has(downstream)) {
          queue.push(downstream);
        }
      }
    }

    return newState;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — COMPUTATION PASS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compute all DIRTY nodes in topological order.
   * Returns new state plus the trace data for this pass.
   */
  private runComputationPass(
    currentState: Record<NodeInstanceId, NodeSnapshot>,
    context:      EngineContext,
    trigger:      InputEvent | null
  ): {
    newState:    Record<NodeInstanceId, NodeSnapshot>
    changes:     Record<NodeInstanceId, NodeChange>
    skipped:     Record<NodeInstanceId, SkipReason>
    visitOrder:  NodeInstanceId[]
  } {
    const newState  = { ...currentState };
    const changes:  Record<NodeInstanceId, NodeChange>  = {};
    const skipped:  Record<NodeInstanceId, SkipReason>  = {};
    const visitOrder: NodeInstanceId[] = [];

    // Build the ComputeContext that computed nodes call into
    const computeCtx: ComputeContext = {
      get: (instanceId: NodeInstanceId): NodeValue => {
        return newState[instanceId]?.value ?? null;
      },
      taxYear:      context.taxYear,
      filingStatus: context.filingStatus,
      hasSpouse:    context.hasSpouse,
    };

    // Walk nodes in topological order
    // Only process nodes that are DIRTY (or all computed nodes during init)
    for (const nodeId of this.graph.topOrder) {
      const def      = this.definitions.get(nodeId);
      const snapshot = newState[nodeId];

      if (!def || !snapshot) continue;

      // Skip input nodes — they're set by input events, not computed
      if (isInputNode(def)) continue;

      // Skip non-dirty computed nodes — nothing changed for them
      if (snapshot.status !== NodeStatus.DIRTY) continue;

      visitOrder.push(nodeId);

      const before = { ...snapshot };
      const now    = new Date().toISOString();

      // Check if this node applies to the current tax year
      if (!def.applicableTaxYears.includes(context.taxYear)) {
        const after: NodeSnapshot = {
          instanceId: nodeId,
          value:      null,
          status:     NodeStatus.SKIPPED,
          updatedAt:  now,
        };
        newState[nodeId] = after;
        skipped[nodeId] = {
          instanceId: nodeId,
          reason:     'tax_year_mismatch',
          detail:     `Node '${nodeId}' does not apply to tax year ${context.taxYear}.`,
        };
        if (before.value !== null || before.status !== NodeStatus.SKIPPED) {
          changes[nodeId] = { instanceId: nodeId, before, after };
        }
        continue;
      }

      // Check isApplicable — node may be irrelevant for this session
      if (isComputedNode(def) && def.isApplicable) {
        const applicable = def.isApplicable(computeCtx);
        if (!applicable) {
          const after: NodeSnapshot = {
            instanceId: nodeId,
            value:      null,
            status:     NodeStatus.SKIPPED,
            updatedAt:  now,
          };
          newState[nodeId] = after;
          skipped[nodeId] = {
            instanceId: nodeId,
            reason:     'not_applicable',
            detail:     `Node '${nodeId}' isApplicable() returned false.`,
          };
          if (before.value !== after.value || before.status !== after.status) {
            changes[nodeId] = { instanceId: nodeId, before, after };
          }
          continue;
        }
      }

      // Check dependencies — if any are ERROR or UNSUPPORTED, skip this node
      let skipDueToDepStatus: 'dependency_error' | 'dependency_unsupported' | null = null;
      let skipDetail = '';

      if (isComputedNode(def)) {
        for (const depId of def.dependencies) {
          const depSnap = newState[depId];
          if (depSnap?.status === NodeStatus.ERROR) {
            skipDueToDepStatus = 'dependency_error';
            skipDetail = `Dependency '${depId}' is in ERROR status.`;
            break;
          }
          if (depSnap?.status === NodeStatus.UNSUPPORTED) {
            skipDueToDepStatus = 'dependency_unsupported';
            skipDetail = `Dependency '${depId}' is UNSUPPORTED.`;
            break;
          }
        }
      }

      if (skipDueToDepStatus) {
        const after: NodeSnapshot = {
          instanceId: nodeId,
          value:      null,
          status:     NodeStatus.SKIPPED,
          updatedAt:  now,
        };
        newState[nodeId] = after;
        skipped[nodeId] = {
          instanceId: nodeId,
          reason:     skipDueToDepStatus,
          detail:     skipDetail,
        };
        if (before.value !== after.value || before.status !== after.status) {
          changes[nodeId] = { instanceId: nodeId, before, after };
        }
        continue;
      }

      // Compute the node
      if (isComputedNode(def)) {
        // Record dependency values for the trace
        const dependencySnapshot: Record<NodeInstanceId, NodeValue> = {};
        for (const depId of def.dependencies) {
          dependencySnapshot[depId] = newState[depId]?.value ?? null;
        }

        let newValue: NodeValue;
        let newStatus: NodeStatus;
        let errorMessage: string | undefined;

        try {
          // Mark as COMPUTING before calling — for future async support
          newState[nodeId] = { ...snapshot, status: NodeStatus.COMPUTING };

          newValue  = def.compute(computeCtx);
          newStatus = NodeStatus.CLEAN;
        } catch (err) {
          newValue     = null;
          newStatus    = NodeStatus.ERROR;
          errorMessage = err instanceof Error ? err.message : String(err);
        }

            const after: NodeSnapshot = {
            instanceId: nodeId,
            value:      newValue,
            status:     newStatus,
            updatedAt:  now,
            ...(errorMessage !== undefined ? { errorMessage } : {}),
            };

        newState[nodeId] = after;

        // Only record a change if value or status actually changed
        if (before.value !== after.value || before.status !== after.status) {
          changes[nodeId] = {
            instanceId:         nodeId,
            before,
            after,
            dependencySnapshot,
          };
        }
      }
    }

    return { newState, changes, skipped, visitOrder };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — RESULT BUILDER
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Build the EngineResult from a completed computation pass.
   * Computes summary counts and identifies any remaining dirty nodes.
   */
  private buildEngineResult(
    success:      boolean,
    frame:        TraceFrame,
    currentState: Record<NodeInstanceId, NodeSnapshot>
  ): EngineResult {
    const snapshots = Object.values(currentState);

    const summary = {
      totalNodes:       snapshots.length,
      cleanNodes:       snapshots.filter(s => s.status === NodeStatus.CLEAN).length,
      dirtyNodes:       snapshots.filter(s => s.status === NodeStatus.DIRTY).length,
      skippedNodes:     snapshots.filter(s => s.status === NodeStatus.SKIPPED).length,
      unsupportedNodes: snapshots.filter(s => s.status === NodeStatus.UNSUPPORTED).length,
      errorNodes:       snapshots.filter(s => s.status === NodeStatus.ERROR).length,
      overrideNodes:    snapshots.filter(s => s.status === NodeStatus.OVERRIDE).length,
    };

    const remainingDirty = snapshots
      .filter(s => s.status === NodeStatus.DIRTY)
      .map(s => s.instanceId);

    const hasErrors = summary.errorNodes > 0;

    return {
      success:        success && !hasErrors,
      frame,
      currentState,
      remainingDirty,
      summary,
    };
  }
}