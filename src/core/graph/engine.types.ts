/**
 * PAISATAX — ENGINE TYPE INTERFACES
 * This file is the contract between UI/OCR/etc and the engine.
 * 
 * engine.types.ts defines the contract for how the tax graph engine runs and communicates.
    It tells the system:
    how values enter the graph (InputEvent)
    how computation is executed (TaxGraphEngine.process)
    what the result looks like (EngineResult)
    how to debug runs (TraceFrame)
    how UI/server will talk later (WebSocket messages)
 * 
 * NOT IN USE 
* Future-ready:
    WebSocket message union types
    “request trace”, “request snapshot” flows
    long-term trace storage (ExecutionTrace.frames)
 *
    
  engine.types.ts defines the contract for how the tax graph engine runs and communicates.
  It tells the system:
  how values enter the graph (InputEvent)
  how computation is executed (TaxGraphEngine.process)
  what the result looks like (EngineResult)
  how to debug runs (TraceFrame)
  how UI/server will talk later (WebSocket messages)




 * Defines the shape of the execution engine, 
 * NOW ADDED YET the computation trace,
 * and the WebSocket events emitted to the preparer UI.
 *
 * This file has zero tax knowledge. It describes how computation
 * happens, not what is being computed.
 *
 * Rules for this file:
 *   - No tax imports
 *   - No form names
 *   - No dollar amounts
 *   - No IRS references
 *   - Imports only from node.types.ts within core
 * 
 */

import type {
  NodeInstanceId,
  NodeValue,
  NodeStatus,
  NodeSnapshot,
  NodeDefinition,
  NodeId,
} from './node.types.js';

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE INPUT — what you hand the engine to run
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An input event sent to the engine by the preparer UI or ingestion layer.
 * This is how values enter the graph from the outside world.
 *
 * The engine validates the value against the node's InputValidation,
 * sets the node to CLEAN with the provided value, marks all downstream
 * computed nodes DIRTY, then runs a computation pass.
 */
export interface InputEvent {
  /**
   * The node instance that received a new value.
   * Format: {formId}.{owner}.{lineId}
   * Example: 'f8889.primary.line2_personalContributions'
   */
  instanceId:  NodeInstanceId

  /**
   * The new value being set.
   * Must match the node's valueType — the engine rejects mismatched types.
   */
  value:       NodeValue

  /**
   * Who or what produced this value.
   * Recorded in the trace for auditability.
   *
   * PREPARER   — a human preparer entered this manually
   * OCR        — extracted from a scanned document
   * UPLOAD     — provided in a bulk upload payload
   * SYSTEM     — set by the system (e.g. defaults on session creation)
   * OVERRIDE   — preparer overriding a computed node's value
   */
  source:      InputEventSource

  /**
   * Required when source is OVERRIDE.
   * Documents why the preparer is overriding a computed value.
   * Stored in the NodeSnapshot as overrideNote.
   */
  overrideNote?: string

  /**
   * ISO 8601 timestamp of when this event was created.
   */
  timestamp:   string
}

// 
export enum InputEventSource {
  PREPARER = 'preparer',
  OCR      = 'ocr',
  UPLOAD   = 'upload',
  SYSTEM   = 'system',
  OVERRIDE = 'override'
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTATION TRACE — full snapshot approach
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One frame in the execution trace — records everything the engine
 * did when processing a single InputEvent.
 *
 * Full snapshot approach: captures the before and after state of every
 * node that changed, plus the order visited. You can scrub through
 * the trace like a timeline to see exactly how a value was reached.
 */
export interface TraceFrame {
  /**
   * Unique identifier for this frame within the session.
   * Monotonically increasing integer — frame 1 happened before frame 2.
   */
  frameIndex:    number

  /**
   * The input event that triggered this computation pass.
   * null for the initial session setup pass.
   */
  trigger:       InputEvent | null

  /**
   * ISO 8601 timestamp when the engine started this pass.
   */
  startedAt:     string

  /**
   * ISO 8601 timestamp when the engine finished this pass.
   */
  completedAt:   string

  /**
   * How many milliseconds the engine took for this pass.
   * Useful for identifying expensive computation chains.
   */
  durationMs:    number

  /**
   * The order in which nodes were visited during this pass.
   * This is the topological sort order — reading this tells you
   * exactly which nodes the engine decided needed recomputation
   * and in what sequence.
   */
  visitOrder:    NodeInstanceId[]

  /**
   * Every node that changed value during this pass.
   * Key: instanceId. Value: before and after snapshot.
   *
   * Nodes that were visited but produced the same value are NOT
   * included here — only nodes whose value or status actually changed.
   */
  changes:       Record<NodeInstanceId, NodeChange>

  /**
   * Nodes that were skipped during this pass and why.
   * Key: instanceId. Value: reason for skipping.
   */
  skipped:       Record<NodeInstanceId, SkipReason>

  /**
   * If the engine detected a circular dependency, it is recorded here
   * rather than throwing — allows partial results to be returned
   * while the cycle is surfaced to the UI.
   */
  cycleDetected?: CycleRecord
}

/**
 * The before and after state of a node that changed in a trace frame.
 */
export interface NodeChange {
  instanceId:   NodeInstanceId
  before:       NodeSnapshot
  after:        NodeSnapshot

  /**
   * For COMPUTED nodes: the dependency values that were read
   * during this computation. Recorded for debuggability.
   */
  dependencySnapshot?: Record<NodeInstanceId, NodeValue>
}

/**
 * Why a node was skipped during a computation pass.
 */
export interface SkipReason {
  instanceId: NodeInstanceId
  reason:
    | 'not_applicable'
    | 'dependency_error'
    | 'dependency_unsupported'
    | 'override_protected'
    | 'tax_year_mismatch'
  detail?: string
}

/**
 * A circular dependency detected during topological sort.
 */
export interface CycleRecord {
  involvedNodes: NodeInstanceId[]
  description:   string
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL EXECUTION TRACE
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionTrace {
  sessionKey:    string
  frames:        TraceFrame[]
  totalEvents:   number
  createdAt:     string
  lastUpdatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION RESULT
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:    boolean
  errors:   ValidationError[]
}

export interface ValidationError {
  instanceId: NodeInstanceId
  code:
    | 'type_mismatch'
    | 'below_minimum'
    | 'above_maximum'
    | 'invalid_enum_value'
    | 'negative_not_allowed'
    | 'node_not_found'
    | 'node_is_computed'
    | 'override_requires_note'
  message:  string
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE RESULT
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineResult {
  success:        boolean
  frame:          TraceFrame
  currentState:   Record<NodeInstanceId, NodeSnapshot>
  remainingDirty: NodeInstanceId[]
  summary: {
    totalNodes:       number
    cleanNodes:       number
    dirtyNodes:       number
    skippedNodes:     number
    unsupportedNodes: number
    errorNodes:       number
    overrideNodes:    number
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET EVENTS
// ─────────────────────────────────────────────────────────────────────────────

export type WebSocketMessage = ClientMessage | ServerMessage

export type ClientMessage =
  | ClientInputEvent
  | ClientRequestTrace
  | ClientRequestSnapshot
  | ClientClearOverride

export interface ClientInputEvent {
  type:    'CLIENT_INPUT'
  payload: InputEvent
}

export interface ClientRequestTrace {
  type:       'CLIENT_REQUEST_TRACE'
  sessionKey: string
}

export interface ClientRequestSnapshot {
  type:       'CLIENT_REQUEST_SNAPSHOT'
  sessionKey: string
}

export interface ClientClearOverride {
  type:       'CLIENT_CLEAR_OVERRIDE'
  instanceId: NodeInstanceId
}

export type ServerMessage =
  | ServerEngineResult
  | ServerTrace
  | ServerSnapshot
  | ServerValidationError
  | ServerError

export interface ServerEngineResult {
  type:    'SERVER_ENGINE_RESULT'
  payload: EngineResult
}

export interface ServerTrace {
  type:    'SERVER_TRACE'
  payload: ExecutionTrace
}

export interface ServerSnapshot {
  type:    'SERVER_SNAPSHOT'
  payload: {
    sessionKey:   string
    currentState: Record<NodeInstanceId, NodeSnapshot>
    timestamp:    string
  }
}

export interface ServerValidationError {
  type:    'SERVER_VALIDATION_ERROR'
  payload: ValidationResult
}

export interface ServerError {
  type:    'SERVER_ERROR'
  payload: {
    code:      string
    message:   string
    timestamp: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface TaxGraphEngine {
  /**
   * Merge new definitions into the registry and rebuild the graph.
   * Additive — existing definitions are preserved unless replaced by same ID.
   * Call clearNodes() first for a clean slate.
   */
  registerNodes(definitions: NodeDefinition[]): void

  /**
   * Remove all registered definitions and reset the graph.
   */
  clearNodes(): void

  /**
   * Validate an input event without applying it.
   */
  validate(
    event:        InputEvent,
    currentState: Record<NodeInstanceId, NodeSnapshot>
  ): ValidationResult

  /**
   * Process an input event against the current session state.
   */
  process(
    event:        InputEvent,
    currentState: Record<NodeInstanceId, NodeSnapshot>,
    context: {
      taxYear:      string
      filingStatus: string
      hasSpouse:    boolean
    }
  ): EngineResult

  /**
   * Initialize a fresh session state.
   * All input nodes get defaultValue + CLEAN status.
   * All computed nodes start DIRTY and are resolved in the initial pass.
   */
  initializeSession(context: {
    taxYear:      string
    filingStatus: string
    hasSpouse:    boolean
    sessionKey:   string
  }): EngineResult

  /**
   * Re-initialize session while carrying over existing node values.
   *
   * Called by FormSlotRegistry after adding or removing form slots.
   * Existing nodes keep their current values. New nodes initialize
   * with defaults. Removed nodes are dropped. All computed nodes
   * are marked DIRTY and recomputed so new aggregator dependencies
   * resolve correctly.
   */
  reinitializeSession(
    context: {
      taxYear:      string
      filingStatus: string
      hasSpouse:    boolean
      sessionKey:   string
    },
    existingState: Record<NodeInstanceId, NodeSnapshot>
  ): EngineResult
}