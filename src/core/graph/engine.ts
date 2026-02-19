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
 * SPOUSE INSTANCE MATERIALIZATION
 *   When hasSpouse = true, initializeSession() mirrors every node definition
 *   that has repeatable: true and owner: NodeOwner.PRIMARY into a spouse
 *   instance. The spouse instance ID is produced by replacing '.primary.'
 *   with '.spouse.' in the definition's ID.
 *
 *   The instance-level graph (this.instanceGraph) is built fresh on each
 *   initializeSession() call and includes both primary and spouse instances
 *   with correct adjacency for joint aggregator nodes.
 *
 *   The definition-level graph (this.graph) is built once at registerNodes()
 *   and never changes.
 */

import {
  isComputedNode,
  isInputNode,
  NodeKind,
  NodeOwner,
  NodeStatus,
  NodeValueType,
} from "./node.types.js";
import type {
  NodeDefinition,
  NodeId,
  NodeInstanceId,
  NodeSnapshot,
  NodeValue,
  ComputeContext,
} from './node.types.js';

import { InputEventSource } from './engine.types.js';

import type {
  EngineResult,
  InputEvent,
  TaxGraphEngine,
  TraceFrame,
  NodeChange,
  SkipReason,
  ValidationResult,
  ValidationError,
} from "./engine.types.js";

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface InternalGraph {
  adjacency:    Map<NodeId, Set<NodeId>>
  dependencies: Map<NodeId, Set<NodeId>>
  topOrder:     NodeId[]
}

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
  private definitions: Map<NodeId, NodeDefinition> = new Map();

  /**
   * Definition-level graph — built once at registerNodes().
   * Uses definition IDs only.
   */
  private graph: InternalGraph = {
    adjacency: new Map(),
    dependencies: new Map(),
    topOrder: [],
  };

  /**
   * Instance-level graph — rebuilt on each initializeSession() call.
   * Includes spouse instances when hasSpouse = true.
   * Used by propagateDirty() and runComputationPass().
   */
  private instanceGraph: InternalGraph = {
    adjacency: new Map(),
    dependencies: new Map(),
    topOrder: [],
  };

  /**
   * Maps spouseInstanceId → primaryDefinitionId.
   * Rebuilt on each initializeSession() call.
   * Used to resolve spouse instance IDs back to their definition.
   */
  private spouseInstances: Map<NodeInstanceId, NodeId> = new Map();

  private frameCounter: number = 0;

  // ───────────────────────────────────────────────────────────────────────────
  // REGISTRATION
  // ───────────────────────────────────────────────────────────────────────────

  registerNodes(definitions: NodeDefinition[]): void {
    for (const def of definitions) {
      this.definitions.set(def.id, def);
    }
    // Rebuild from ALL definitions, not just the new batch
    this.graph = this.buildGraph(Array.from(this.definitions.values()));
  }

  clearNodes(): void {
    this.definitions.clear();
    this.graph = {
      adjacency: new Map(),
      dependencies: new Map(),
      topOrder: [],
    };
    this.instanceGraph = {
      adjacency: new Map(),
      dependencies: new Map(),
      topOrder: [],
    };
    this.spouseInstances = new Map();
  }

  private buildGraph(definitions: NodeDefinition[]): InternalGraph {
    const adjacency = new Map<NodeId, Set<NodeId>>();
    const dependencies = new Map<NodeId, Set<NodeId>>();

    for (const def of definitions) {
      adjacency.set(def.id, new Set());
      dependencies.set(def.id, new Set());
    }

    for (const def of definitions) {
      if (isComputedNode(def)) {
        for (const depId of def.dependencies) {
          // Only wire known definition IDs — spouse instance IDs are not
          // definitions, they're skipped here and handled at instance graph level
          if (adjacency.has(depId)) {
            adjacency.get(depId)!.add(def.id);
            dependencies.get(def.id)!.add(depId);
          }
        }
      }
    }

    const inDegree = new Map<NodeId, number>();
    for (const def of definitions) {
      inDegree.set(def.id, dependencies.get(def.id)?.size ?? 0);
    }

    const queue: NodeId[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const topOrder: NodeId[] = [];

    while (queue.length > 0) {
      queue.sort();
      const nodeId = queue.shift()!;
      topOrder.push(nodeId);

      for (const downstreamId of adjacency.get(nodeId) ?? []) {
        const newDegree = (inDegree.get(downstreamId) ?? 0) - 1;
        inDegree.set(downstreamId, newDegree);
        if (newDegree === 0) {
          queue.push(downstreamId);
        }
      }
    }

    if (topOrder.length !== definitions.length) {
      const inCycle = definitions
        .map((d) => d.id)
        .filter((id) => !topOrder.includes(id));
      throw new Error(
        `Circular dependency detected in node graph. ` +
          `Nodes involved: [${inCycle.join(", ")}]. ` +
          `These nodes form a cycle — check their dependency declarations.`,
      );
    }

    return { adjacency, dependencies, topOrder };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SPOUSE INSTANCE MATERIALIZATION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Replace '.primary.' with '.spouse.' to derive the spouse instance ID.
   */
  private toSpouseId(primaryId: NodeId): NodeInstanceId {
    return primaryId.replace(".primary.", ".spouse.");
  }

  /**
   * Build the instance-level graph for this session.
   *
   * When hasSpouse = true:
   *   - Every repeatable PRIMARY node gets a spouse mirror inserted
   *     immediately after it in topOrder
   *   - Joint aggregator nodes that declare spouse instance IDs in their
   *     dependencies get those edges wired correctly
   *   - Spouse mirror compute functions get a remapped ctx where
   *     .primary. reads are redirected to .spouse.
   *
   * When hasSpouse = false:
   *   - Instance graph mirrors the definition graph exactly
   */
  private buildInstanceGraph(hasSpouse: boolean): InternalGraph {
    const adjacency = new Map<NodeInstanceId, Set<NodeInstanceId>>();
    const dependencies = new Map<NodeInstanceId, Set<NodeInstanceId>>();
    const topOrder: NodeInstanceId[] = [];

    // Collect all instance IDs
    const allInstanceIds = new Set<NodeInstanceId>(this.graph.topOrder);

    if (hasSpouse) {
      for (const def of this.definitions.values()) {
        if (def.repeatable && def.owner === NodeOwner.PRIMARY) {
          allInstanceIds.add(this.toSpouseId(def.id));
        }
      }
    }

    // Initialize adjacency and dependency maps
    for (const id of allInstanceIds) {
      adjacency.set(id, new Set());
      dependencies.set(id, new Set());
    }

    // Wire edges
    for (const def of this.definitions.values()) {
      if (!isComputedNode(def)) continue;

      const instanceId = def.id;

      for (const depId of def.dependencies) {
        // Wire known instance IDs (definition IDs or spouse instance IDs)
        if (allInstanceIds.has(depId) && allInstanceIds.has(instanceId)) {
          adjacency.get(depId)!.add(instanceId);
          dependencies.get(instanceId)!.add(depId);
        }
      }

      // Wire spouse mirror of this node
      if (hasSpouse && def.repeatable && def.owner === NodeOwner.PRIMARY) {
        const spouseInstanceId = this.toSpouseId(def.id);

        for (const depId of def.dependencies) {
          // Mirror .primary. deps to .spouse. if that instance exists
          const mirroredDepId = depId.includes(".primary.")
            ? this.toSpouseId(depId)
            : depId;
          const actualDepId = allInstanceIds.has(mirroredDepId)
            ? mirroredDepId
            : depId;

          if (allInstanceIds.has(actualDepId)) {
            adjacency.get(actualDepId)!.add(spouseInstanceId);
            dependencies.get(spouseInstanceId)!.add(actualDepId);
          }
        }
      }
    }

    // Build topOrder: insert spouse mirror immediately after primary
    for (const defId of this.graph.topOrder) {
      topOrder.push(defId);

      if (hasSpouse) {
        const def = this.definitions.get(defId);
        if (def?.repeatable && def.owner === NodeOwner.PRIMARY) {
          topOrder.push(this.toSpouseId(defId));
        }
      }
    }

    return { adjacency, dependencies, topOrder };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SESSION INITIALIZATION
  // ───────────────────────────────────────────────────────────────────────────

  initializeSession(context: {
    taxYear: string;
    filingStatus: string;
    hasSpouse: boolean;
    sessionKey: string;
  }): EngineResult {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    // Rebuild instance graph and spouse map for this session
    this.instanceGraph = this.buildInstanceGraph(context.hasSpouse);
    this.spouseInstances = new Map();

    if (context.hasSpouse) {
      for (const def of this.definitions.values()) {
        if (def.repeatable && def.owner === NodeOwner.PRIMARY) {
          this.spouseInstances.set(this.toSpouseId(def.id), def.id);
        }
      }
    }

    // Build initial state for all instances
    const initialState: Record<NodeInstanceId, NodeSnapshot> = {};
    const now = new Date().toISOString();

    for (const instanceId of this.instanceGraph.topOrder) {
      const defId = this.spouseInstances.get(instanceId) ?? instanceId;
      const def = this.definitions.get(defId);
      if (!def) continue;

      if (isInputNode(def)) {
        initialState[instanceId] = {
          instanceId,
          value: def.defaultValue,
          status: NodeStatus.CLEAN,
          updatedAt: now,
        };
      } else {
        initialState[instanceId] = {
          instanceId,
          value: null,
          status: NodeStatus.DIRTY,
          updatedAt: now,
        };
      }
    }

    const { newState, changes, skipped, visitOrder } = this.runComputationPass(
      initialState,
      context,
      null,
    );

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    const frame: TraceFrame = {
      frameIndex: this.frameCounter++,
      trigger: null,
      startedAt,
      completedAt,
      durationMs,
      visitOrder,
      changes,
      skipped,
    };

    return this.buildEngineResult(true, frame, newState);
  }

  reinitializeSession(
    context: {
      taxYear: string;
      filingStatus: string;
      hasSpouse: boolean;
      sessionKey: string;
    },
    existingState: Record<NodeInstanceId, NodeSnapshot>,
  ): EngineResult {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    this.instanceGraph = this.buildInstanceGraph(context.hasSpouse);
    this.spouseInstances = new Map();

    if (context.hasSpouse) {
      for (const def of this.definitions.values()) {
        if (def.repeatable && def.owner === NodeOwner.PRIMARY) {
          this.spouseInstances.set(this.toSpouseId(def.id), def.id);
        }
      }
    }

    const now = new Date().toISOString();
    const mergedState: Record<NodeInstanceId, NodeSnapshot> = {};

    for (const instanceId of this.instanceGraph.topOrder) {
      const defId = this.spouseInstances.get(instanceId) ?? instanceId;
      const def = this.definitions.get(defId);
      if (!def) continue;

      if (existingState[instanceId]) {
        const existing = existingState[instanceId];
        if (isInputNode(def)) {
          mergedState[instanceId] = existing;
        } else {
          mergedState[instanceId] = {
            ...existing,
            status: NodeStatus.DIRTY,
            updatedAt: now,
          };
        }
      } else {
        if (isInputNode(def)) {
          mergedState[instanceId] = {
            instanceId,
            value: def.defaultValue,
            status: NodeStatus.CLEAN,
            updatedAt: now,
          };
        } else {
          mergedState[instanceId] = {
            instanceId,
            value: null,
            status: NodeStatus.DIRTY,
            updatedAt: now,
          };
        }
      }
    }

    const { newState, changes, skipped, visitOrder } = this.runComputationPass(
      mergedState,
      context,
      null,
    );

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    const frame: TraceFrame = {
      frameIndex: this.frameCounter++,
      trigger: null,
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
    event: InputEvent,
    currentState: Record<NodeInstanceId, NodeSnapshot>,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const { instanceId, value, source } = event;

    // Spouse instance IDs resolve back to their primary definition
    const defId = this.spouseInstances.get(instanceId) ?? instanceId;
    const def = this.definitions.get(defId);

    if (!def) {
      errors.push({
        instanceId,
        code: "node_not_found",
        message: `Node '${instanceId}' does not exist in the registry.`,
      });
      return { valid: false, errors };
    }

    if (isComputedNode(def) && source !== InputEventSource.OVERRIDE) {
      errors.push({
        instanceId,
        code: "node_is_computed",
        message: `Node '${instanceId}' is computed. To override it, use source: 'override' and provide an overrideNote.`,
      });
    }

    if (source === InputEventSource.OVERRIDE && !event.overrideNote?.trim()) {
      errors.push({
        instanceId,
        code: "override_requires_note",
        message: `Overriding a computed node requires an overrideNote explaining why.`,
      });
    }

    if (value !== null && typeof value === "number") {
      if (!def.allowNegative && value < 0) {
        errors.push({
          instanceId,
          code: "negative_not_allowed",
          message: `Node '${instanceId}' does not allow negative values. Received: ${value}.`,
        });
      }

      if (isInputNode(def) && def.validation) {
        if (def.validation.min !== undefined && value < def.validation.min) {
          errors.push({
            instanceId,
            code: "below_minimum",
            message: `Value ${value} is below the minimum of ${def.validation.min} for node '${instanceId}'.`,
          });
        }
        if (def.validation.max !== undefined && value > def.validation.max) {
          errors.push({
            instanceId,
            code: "above_maximum",
            message: `Value ${value} is above the maximum of ${def.validation.max} for node '${instanceId}'.`,
          });
        }
      }
    }

    if (
      def.valueType === NodeValueType.ENUM &&
      isInputNode(def) &&
      def.validation?.allowedValues &&
      !def.validation.allowedValues.includes(value as string)
    ) {
      errors.push({
        instanceId,
        code: "invalid_enum_value",
        message: `Value '${value}' is not in the allowed values for node '${instanceId}': [${def.validation.allowedValues.join(", ")}].`,
      });
    }

    return { valid: errors.length === 0, errors };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PROCESS
  // ───────────────────────────────────────────────────────────────────────────

  process(
    event: InputEvent,
    currentState: Record<NodeInstanceId, NodeSnapshot>,
    context: EngineContext,
  ): EngineResult {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    const validation = this.validate(event, currentState);
    if (!validation.valid) {
      const now = new Date().toISOString();
      const frame: TraceFrame = {
        frameIndex: this.frameCounter++,
        trigger: event,
        startedAt,
        completedAt: now,
        durationMs: Date.now() - startMs,
        visitOrder: [],
        changes: {},
        skipped: {},
      };
      return this.buildEngineResult(false, frame, currentState);
    }

    const { state: stateAfterInput, inputChange } = this.applyInputEvent(
      event,
      currentState,
    );
    const dirtyState = this.propagateDirty(event.instanceId, stateAfterInput);

    const { newState, changes, skipped, visitOrder } = this.runComputationPass(
      dirtyState,
      context,
      event,
    );

    if (inputChange) {
      changes[event.instanceId] = inputChange;
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    const frame: TraceFrame = {
      frameIndex: this.frameCounter++,
      trigger: event,
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

  private applyInputEvent(
    event: InputEvent,
    currentState: Record<NodeInstanceId, NodeSnapshot>,
  ): {
    state: Record<NodeInstanceId, NodeSnapshot>;
    inputChange: NodeChange | null;
  } {
    const now = new Date().toISOString();
    const before = currentState[event.instanceId];

    const after: NodeSnapshot = {
      instanceId: event.instanceId,
      value: event.value,
      status:
        event.source === InputEventSource.OVERRIDE
          ? NodeStatus.OVERRIDE
          : NodeStatus.CLEAN,
      updatedAt: now,
      ...(event.overrideNote !== undefined
        ? { overrideNote: event.overrideNote }
        : {}),
      ...(before?.unsupportedNote !== undefined
        ? { unsupportedNote: before.unsupportedNote }
        : {}),
    };

    const state = { ...currentState, [event.instanceId]: after };

    const inputChange: NodeChange | null =
      before?.value !== after.value || before?.status !== after.status
        ? { instanceId: event.instanceId, before: before ?? after, after }
        : null;

    return { state, inputChange };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — DIRTY PROPAGATION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Mark all downstream nodes as DIRTY using the instance-level graph.
   * This correctly propagates through spouse instances.
   */
  private propagateDirty(
    changedId: NodeInstanceId,
    currentState: Record<NodeInstanceId, NodeSnapshot>,
  ): Record<NodeInstanceId, NodeSnapshot> {
    const newState = { ...currentState };
    const now = new Date().toISOString();

    const queue: NodeId[] = [
      ...(this.instanceGraph.adjacency.get(changedId) ?? []),
    ];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const existing = newState[nodeId];
      if (existing?.status === NodeStatus.OVERRIDE) continue;

      newState[nodeId] = {
        instanceId: nodeId,
        value: existing?.value ?? null,
        status: NodeStatus.DIRTY,
        updatedAt: now,
      };

      for (const downstream of this.instanceGraph.adjacency.get(nodeId) ?? []) {
        if (!visited.has(downstream)) queue.push(downstream);
      }
    }

    return newState;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — COMPUTATION PASS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compute all DIRTY nodes in topological order.
   *
   * For spouse instances:
   *   - Definition is resolved via spouseInstances map
   *   - A remapped ComputeContext redirects .primary. reads to .spouse.
   *     so the same compute function works for both filers
   *   - Dependency IDs in def.dependencies are mirrored the same way
   */
  private runComputationPass(
    currentState: Record<NodeInstanceId, NodeSnapshot>,
    context: EngineContext,
    trigger: InputEvent | null,
  ): {
    newState: Record<NodeInstanceId, NodeSnapshot>;
    changes: Record<NodeInstanceId, NodeChange>;
    skipped: Record<NodeInstanceId, SkipReason>;
    visitOrder: NodeInstanceId[];
  } {
    const newState = { ...currentState };
    const changes: Record<NodeInstanceId, NodeChange> = {};
    const skipped: Record<NodeInstanceId, SkipReason> = {};
    const visitOrder: NodeInstanceId[] = [];

    // Base compute context — reads directly from newState
    const baseCtx: ComputeContext = {
      get: (id) => newState[id]?.value ?? null,
      taxYear: context.taxYear,
      filingStatus: context.filingStatus,
      hasSpouse: context.hasSpouse,
    };

    for (const instanceId of this.instanceGraph.topOrder) {
      const defId = this.spouseInstances.get(instanceId) ?? instanceId;
      const def = this.definitions.get(defId);
      const snapshot = newState[instanceId];

      if (!def || !snapshot) continue;
      if (isInputNode(def)) continue;
      if (snapshot.status !== NodeStatus.DIRTY) continue;

      visitOrder.push(instanceId);

      const before = { ...snapshot };
      const now = new Date().toISOString();

      // Tax year check
      if (!def.applicableTaxYears.includes(context.taxYear)) {
        const after: NodeSnapshot = {
          instanceId,
          value: null,
          status: NodeStatus.SKIPPED,
          updatedAt: now,
        };
        newState[instanceId] = after;
        skipped[instanceId] = {
          instanceId,
          reason: "tax_year_mismatch",
          detail: `Node '${instanceId}' does not apply to tax year ${context.taxYear}.`,
        };
        if (before.value !== null || before.status !== NodeStatus.SKIPPED) {
          changes[instanceId] = { instanceId, before, after };
        }
        continue;
      }

      // isApplicable check
      if (isComputedNode(def) && def.isApplicable) {
        if (!def.isApplicable(baseCtx)) {
          const after: NodeSnapshot = {
            instanceId,
            value: null,
            status: NodeStatus.SKIPPED,
            updatedAt: now,
          };
          newState[instanceId] = after;
          skipped[instanceId] = {
            instanceId,
            reason: "not_applicable",
            detail: `Node '${instanceId}' isApplicable() returned false.`,
          };
          if (before.value !== after.value || before.status !== after.status) {
            changes[instanceId] = { instanceId, before, after };
          }
          continue;
        }
      }

      // Dependency status check
      const isSpouse = this.spouseInstances.has(instanceId);
      let skipDueToDepStatus:
        | "dependency_error"
        | "dependency_unsupported"
        | null = null;
      let skipDetail = "";

      if (isComputedNode(def)) {
        for (const depId of def.dependencies) {
          const resolvedId =
            isSpouse && depId.includes(".primary.")
              ? this.toSpouseId(depId)
              : depId;
          const actualId =
            newState[resolvedId] !== undefined ? resolvedId : depId;
          const depSnap = newState[actualId];

          if (depSnap?.status === NodeStatus.ERROR) {
            skipDueToDepStatus = "dependency_error";
            skipDetail = `Dependency '${actualId}' is in ERROR status.`;
            break;
          }
          if (depSnap?.status === NodeStatus.UNSUPPORTED) {
            skipDueToDepStatus = "dependency_unsupported";
            skipDetail = `Dependency '${actualId}' is UNSUPPORTED.`;
            break;
          }
        }
      }

      if (skipDueToDepStatus) {
        const after: NodeSnapshot = {
          instanceId,
          value: null,
          status: NodeStatus.SKIPPED,
          updatedAt: now,
        };
        newState[instanceId] = after;
        skipped[instanceId] = {
          instanceId,
          reason: skipDueToDepStatus,
          detail: skipDetail,
        };
        if (before.value !== after.value || before.status !== after.status) {
          changes[instanceId] = { instanceId, before, after };
        }
        continue;
      }

      // Compute
      if (isComputedNode(def)) {
        // For spouse instances, remap .primary. reads to .spouse. in the ctx
        const computeCtx: ComputeContext = isSpouse
          ? {
              ...baseCtx,
              get: (id: NodeInstanceId): NodeValue => {
                const mirroredId = id.includes(".primary.")
                  ? this.toSpouseId(id)
                  : id;
                const actualId =
                  newState[mirroredId] !== undefined ? mirroredId : id;
                return newState[actualId]?.value ?? null;
              },
            }
          : baseCtx;

        // Record dependency snapshot for trace
        const dependencySnapshot: Record<NodeInstanceId, NodeValue> = {};
        for (const depId of def.dependencies) {
          const resolvedId =
            isSpouse && depId.includes(".primary.")
              ? this.toSpouseId(depId)
              : depId;
          const actualId =
            newState[resolvedId] !== undefined ? resolvedId : depId;
          dependencySnapshot[actualId] = newState[actualId]?.value ?? null;
        }

        let newValue: NodeValue;
        let newStatus: NodeStatus;
        let errorMessage: string | undefined;

        try {
          newState[instanceId] = { ...snapshot, status: NodeStatus.COMPUTING };
          newValue = def.compute(computeCtx);
          newStatus = NodeStatus.CLEAN;
        } catch (err) {
          newValue = null;
          newStatus = NodeStatus.ERROR;
          errorMessage = err instanceof Error ? err.message : String(err);
        }

        const after: NodeSnapshot = {
          instanceId,
          value: newValue,
          status: newStatus,
          updatedAt: now,
          ...(errorMessage !== undefined ? { errorMessage } : {}),
        };

        newState[instanceId] = after;

        if (before.value !== after.value || before.status !== after.status) {
          changes[instanceId] = {
            instanceId,
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

  private buildEngineResult(
    success: boolean,
    frame: TraceFrame,
    currentState: Record<NodeInstanceId, NodeSnapshot>,
  ): EngineResult {
    const snapshots = Object.values(currentState);

    const summary = {
      totalNodes: snapshots.length,
      cleanNodes: snapshots.filter((s) => s.status === NodeStatus.CLEAN).length,
      dirtyNodes: snapshots.filter((s) => s.status === NodeStatus.DIRTY).length,
      skippedNodes: snapshots.filter((s) => s.status === NodeStatus.SKIPPED)
        .length,
      unsupportedNodes: snapshots.filter(
        (s) => s.status === NodeStatus.UNSUPPORTED,
      ).length,
      errorNodes: snapshots.filter((s) => s.status === NodeStatus.ERROR).length,
      overrideNodes: snapshots.filter((s) => s.status === NodeStatus.OVERRIDE)
        .length,
    };

    const remainingDirty = snapshots
      .filter((s) => s.status === NodeStatus.DIRTY)
      .map((s) => s.instanceId);

    return {
      success: success && summary.errorNodes === 0,
      frame,
      currentState,
      remainingDirty,
      summary,
    };
  }
}