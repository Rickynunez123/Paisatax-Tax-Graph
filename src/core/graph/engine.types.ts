/**
 * PAISATAX — ENGINE TYPE INTERFACES
 *
 * Defines the shape of the execution engine, the computation trace,
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
   *
   * Example: ['f8889.primary.line5_limitAfterMsa',
   *            'f8889.primary.line8_totalLimit',
   *            'f8889.primary.line12_maxPersonalContribution',
   *            'f8889.primary.line13_hsaDeduction',
   *            'f5329.joint.line43_hsaMaxAllowable',
   *            'f5329.joint.line49_additionalTax']
   */
  visitOrder:    NodeInstanceId[]

  /**
   * Every node that changed value during this pass.
   * Key: instanceId. Value: before and after snapshot.
   *
   * Nodes that were visited but produced the same value are NOT
   * included here — only nodes whose value or status actually changed.
   * This keeps the trace lean while still capturing everything meaningful.
   */
  changes:       Record<NodeInstanceId, NodeChange>

  /**
   * Nodes that were skipped during this pass and why.
   * Key: instanceId. Value: reason for skipping.
   *
   * A node is skipped when:
   *   - isApplicable() returned false
   *   - A dependency is in ERROR or UNSUPPORTED status
   *   - The node is in OVERRIDE status (engine leaves it alone)
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
   *
   * Key: instanceId of the dependency.
   * Value: the value that was read.
   *
   * Example: {
   *   'f8889.primary.line2_personalContributions': 3500,
   *   'f8889.primary.line3_annualContributionLimit': 4300
   * }
   */
  dependencySnapshot?: Record<NodeInstanceId, NodeValue>
}

/**
 * Why a node was skipped during a computation pass.
 */
export interface SkipReason {
  instanceId: NodeInstanceId
  reason:
    | 'not_applicable'      // isApplicable() returned false
    | 'dependency_error'    // a dependency is in ERROR status
    | 'dependency_unsupported' // a dependency is in UNSUPPORTED status
    | 'override_protected'  // node is in OVERRIDE status — engine leaves it alone
    | 'tax_year_mismatch'   // node's applicableTaxYears does not include session year
  detail?: string           // human-readable elaboration
}

/**
 * A circular dependency detected during topological sort.
 */
export interface CycleRecord {
  /**
   * The nodes involved in the cycle, in the order they were visited
   * before the cycle was detected.
   * Example: ['f1040.joint.line11_agi', 'schedule1.joint.line8_totalAdjustments',
   *            'f1040.joint.line11_agi']  ← last entry is where the cycle closes
   */
  involvedNodes: NodeInstanceId[]

  /**
   * Human-readable description of the cycle for the developer.
   */
  description:   string
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL EXECUTION TRACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete execution history for a session.
 * An ordered list of TraceFrames — one per InputEvent processed.
 *
 * This is the artifact used for debugging, auditing, and visualization.
 * The UI trace viewer renders this as a scrollable timeline.
 */
export interface ExecutionTrace {
  /**
   * The session this trace belongs to.
   * Format: {userId}#{taxYear}
   */
  sessionKey:   string

  /**
   * Ordered list of frames — earliest first.
   * frame[0] is the initial session setup pass.
   * frame[n] is the most recent computation pass.
   */
  frames:       TraceFrame[]

  /**
   * Total number of input events processed in this session.
   * Equals frames.length - 1 (frame 0 is setup, not an input event).
   */
  totalEvents:  number

  /**
   * ISO 8601 timestamp of when the trace was created (session start).
   */
  createdAt:    string

  /**
   * ISO 8601 timestamp of the most recent frame.
   */
  lastUpdatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION RESULT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of validating an InputEvent before accepting it.
 */
export interface ValidationResult {
  valid:    boolean
  errors:   ValidationError[]
}

export interface ValidationError {
  instanceId: NodeInstanceId
  code:
    | 'type_mismatch'        // value type does not match node's valueType
    | 'below_minimum'        // number value below node's validation.min
    | 'above_maximum'        // number value above node's validation.max
    | 'invalid_enum_value'   // string value not in node's validation.allowedValues
    | 'negative_not_allowed' // negative number when node.allowNegative is false
    | 'node_not_found'       // instanceId does not exist in the registry
    | 'node_is_computed'     // tried to set an input on a COMPUTED node without override flag
    | 'override_requires_note' // tried to override without providing overrideNote
  message:  string
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE RESULT — what comes back after a computation pass
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The result of one engine computation pass.
 * Returned synchronously after the engine processes an InputEvent.
 * Also emitted over the WebSocket to the preparer UI.
 */
export interface EngineResult {
  /**
   * Whether the computation pass completed without errors.
   * false if any node ended in ERROR status or a cycle was detected.
   */
  success:       boolean

  /**
   * The trace frame generated by this pass.
   * Contains the full before/after snapshot of every node that changed.
   */
  frame:         TraceFrame

  /**
   * The current snapshot of every node in the session after this pass.
   * The UI replaces its local state with this on every EngineResult.
   *
   * Key: instanceId. Value: current snapshot.
   */
  currentState:  Record<NodeInstanceId, NodeSnapshot>

  /**
   * Nodes that are still DIRTY after this pass.
   * Non-empty only if the engine hit an error mid-pass.
   * In normal operation this is always empty after a pass completes.
   */
  remainingDirty: NodeInstanceId[]

  /**
   * Summary counts for quick UI display.
   */
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

/**
 * All events that flow over the WebSocket between the engine and the UI.
 * The UI sends CLIENT events. The engine sends SERVER events.
 * Tagged union on `type` for exhaustive handling.
 */
export type WebSocketMessage = ClientMessage | ServerMessage

// ─── CLIENT → SERVER ────────────────────────────────────────────────────────

export type ClientMessage =
  | ClientInputEvent
  | ClientRequestTrace
  | ClientRequestSnapshot
  | ClientClearOverride

/**
 * Client sends a new input value to the engine.
 * Engine responds with SERVER_ENGINE_RESULT.
 */
export interface ClientInputEvent {
  type:    'CLIENT_INPUT'
  payload: InputEvent
}

/**
 * Client requests the full execution trace for the current session.
 * Engine responds with SERVER_TRACE.
 * Used when the preparer opens the trace viewer panel.
 */
export interface ClientRequestTrace {
  type:       'CLIENT_REQUEST_TRACE'
  sessionKey: string
}

/**
 * Client requests a full snapshot of all current node values.
 * Engine responds with SERVER_SNAPSHOT.
 * Used on initial UI load or reconnect.
 */
export interface ClientRequestSnapshot {
  type:       'CLIENT_REQUEST_SNAPSHOT'
  sessionKey: string
}

/**
 * Client clears a preparer override on a computed node.
 * Engine reverts the node to DIRTY and recomputes it.
 */
export interface ClientClearOverride {
  type:       'CLIENT_CLEAR_OVERRIDE'
  instanceId: NodeInstanceId
}

// ─── SERVER → CLIENT ────────────────────────────────────────────────────────

export type ServerMessage =
  | ServerEngineResult
  | ServerTrace
  | ServerSnapshot
  | ServerValidationError
  | ServerError

/**
 * Sent after every successful computation pass.
 * The UI updates its display from this.
 */
export interface ServerEngineResult {
  type:    'SERVER_ENGINE_RESULT'
  payload: EngineResult
}

/**
 * Full execution trace for the session.
 * Sent in response to CLIENT_REQUEST_TRACE.
 */
export interface ServerTrace {
  type:    'SERVER_TRACE'
  payload: ExecutionTrace
}

/**
 * Full snapshot of all current node values.
 * Sent in response to CLIENT_REQUEST_SNAPSHOT or on initial connect.
 */
export interface ServerSnapshot {
  type:    'SERVER_SNAPSHOT'
  payload: {
    sessionKey:   string
    currentState: Record<NodeInstanceId, NodeSnapshot>
    timestamp:    string
  }
}

/**
 * Sent when an incoming ClientInputEvent fails validation.
 * The engine does not run a computation pass — the value was rejected.
 * The UI should surface the error to the preparer.
 */
export interface ServerValidationError {
  type:    'SERVER_VALIDATION_ERROR'
  payload: ValidationResult
}

/**
 * Sent when an unexpected engine-level error occurs.
 * Not a node computation error — a system-level failure.
 * The UI should show a generic error and offer to reload the session.
 */
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

/**
 * The contract for the engine implementation.
 *
 * The engine is stateless — it receives a session state, processes
 * an input event, and returns an updated session state plus a trace frame.
 * It never holds state between calls.
 *
 * This design makes the engine:
 *   - Testable: inject any session state, assert the result
 *   - Lambda-compatible: no in-memory state between invocations
 *   - Replayable: given the same session state and input, always same result
 */
export interface TaxGraphEngine {
  /**
   * Register node definitions with the engine.
   * Called once at startup with all form node definitions.
   * The engine builds its internal dependency graph from these.
   */
  registerNodes(definitions: NodeDefinition[]): void

  /**
   * Validate an input event without applying it.
   * Call this before process() to surface errors to the UI immediately.
   */
  validate(
    event:        InputEvent,
    currentState: Record<NodeInstanceId, NodeSnapshot>
  ): ValidationResult

  /**
   * Process an input event against the current session state.
   * Returns the updated state and the trace frame for this pass.
   *
   * The engine:
   *   1. Validates the event (rejects if invalid)
   *   2. Applies the input value to the target node
   *   3. Marks all downstream nodes DIRTY
   *   4. Runs topological sort to determine computation order
   *   5. Computes each DIRTY node in order
   *   6. Records all changes in a TraceFrame
   *   7. Returns the updated state and frame
   *
   * The currentState passed in is never mutated — the engine returns
   * a new state object. Immutability makes replaying the trace possible.
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
   * Initialize a fresh session state for a new tax return.
   * Sets all input nodes to their defaultValue with CLEAN status.
   * Sets all computed nodes to DIRTY (will compute on first pass).
   * Returns the initial state and a setup TraceFrame.
   */
  initializeSession(context: {
    taxYear:      string
    filingStatus: string
    hasSpouse:    boolean
    sessionKey:   string
  }): EngineResult
}