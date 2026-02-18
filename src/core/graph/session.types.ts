/**
 * PAISATAX — SESSION TYPE INTERFACES
 *
 * A session represents one taxpayer's return for one tax year.
 * It holds the current state of every node in the graph, the identity
 * of the filers, and the full execution trace.
 *
 * Session key format: {userId}#{taxYear}
 * Example: 'usr_abc123#2025'
 *
 * Rules for this file:
 *   - No tax form knowledge
 *   - No IRS-specific logic
 *   - Imports only from node.types and engine.types within core
 */

import type { NodeInstanceId, NodeSnapshot, NodeOwner } from './node.types.js';
import type { ExecutionTrace, InputEvent } from './engine.types.js';

// ─────────────────────────────────────────────────────────────────────────────
// FILER IDENTITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lean identity record for one filer (primary or spouse).
 * Contains only what the engine needs to instantiate nodes correctly
 * and what the UI needs to label things clearly.
 *
 * Form-specific data (HSA contributions, retirement accounts, etc.)
 * does NOT live here — it lives in input nodes inside the graph.
 * This keeps the identity model stable even as tax forms change.
 */
export interface FilerIdentity {
  /**
   * Internal user ID — used to key the session in storage.
   */
  userId:       string

  /**
   * Display name for the preparer UI.
   * Example: 'Maria Garcia' or 'John Garcia (Spouse)'
   */
  displayName:  string

  /**
   * Date of birth in YYYY-MM-DD format.
   * Used by the engine to compute age-dependent node behavior
   * (catch-up contributions, age 59½ distributions, RMD age 73, etc.)
   */
  dateOfBirth:  string

  /**
   * Social Security Number or ITIN.
   * Stored here for form header population only — never used in calculations.
   */
  taxId:        string

  /**
   * Whether this filer is a U.S. citizen or resident alien.
   * Determines which form set applies (1040 vs 1040-NR).
   */
  residencyStatus: 'resident' | 'nonresident' | 'dual_status'

  /**
   * Whether this filer was blind at the end of the tax year.
   * Affects standard deduction calculation.
   */
  isBlind:      boolean

  /**
   * Whether this filer can be claimed as a dependent by another taxpayer.
   * Affects standard deduction and certain credits.
   */
  isDependent:  boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fixed context for a session — things that do not change
 * after the session is created.
 *
 * The engine receives this on every call so it can make
 * filing-status-aware and year-aware decisions.
 */
export interface SessionContext {
  /**
   * The tax year being filed.
   * Used by compute functions to look up year-specific constants.
   * Example: '2025'
   */
  taxYear:      string

  /**
   * Filing status for this return.
   * Drives standard deduction, bracket selection, credit phase-outs.
   *
   * Uses string rather than an enum so this file stays free of
   * tax-domain enums. The tax layer validates against its own enum.
   *
   * Valid values: 'single' | 'married_filing_jointly' |
   *               'married_filing_separately' | 'head_of_household' |
   *               'qualifying_surviving_spouse'
   */
  filingStatus: string

  /**
   * Whether this return has a spouse.
   * When true, the session instantiates spouse copies of REPEATABLE nodes.
   * When false, spouse node instances do not exist and cannot receive input.
   */
  hasSpouse:    boolean

  /**
   * Primary filer identity.
   * Always present.
   */
  primary:      FilerIdentity

  /**
   * Spouse identity.
   * Present only when hasSpouse is true.
   */
  spouse?:      FilerIdentity

  /**
   * Whether this is a non-resident return (Form 1040-NR).
   * Affects which node definitions are applicable.
   */
  isNonResident: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The mutable state of the session — everything that changes
 * as the preparer enters values and the engine recomputes.
 *
 * The engine never mutates this directly — it returns a new
 * SessionState on every computation pass (immutable update pattern).
 */
export interface SessionState {
  /**
   * Current snapshot of every node instance in the graph.
   * Key:   NodeInstanceId (e.g. 'f8889.primary.line13_hsaDeduction')
   * Value: NodeSnapshot with current value, status, timestamps
   *
   * This is the single source of truth for all node values.
   * The UI renders entirely from this map.
   */
  nodes:         Record<NodeInstanceId, NodeSnapshot>

  /**
   * Set of node instance IDs currently marked DIRTY.
   * The engine processes these in topological order each pass.
   * Empty after a successful computation pass.
   *
   * Stored as an array (not a Set) for JSON serialization.
   */
  dirtyNodes:    NodeInstanceId[]

  /**
   * Set of node instance IDs that the engine has determined
   * are not applicable for this session context.
   * These are in SKIPPED status and their values are null.
   */
  skippedNodes:  NodeInstanceId[]

  /**
   * Set of node instance IDs that are not yet implemented.
   * These are in UNSUPPORTED status.
   * The preparer must handle these manually.
   */
  unsupportedNodes: NodeInstanceId[]

  /**
   * Set of node instance IDs where a preparer has manually
   * overridden a computed value.
   * The engine does not recompute these until the override is cleared.
   */
  overriddenNodes: NodeInstanceId[]

  /**
   * ISO 8601 timestamp of the last time any node value changed.
   */
  lastModifiedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION — the complete container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete session object.
 * Combines the fixed context, the mutable state, and the execution trace.
 *
 * This is what gets persisted to storage between Lambda invocations.
 * In local development it lives in memory.
 */
export interface TaxSession {
  /**
   * Unique key for this session.
   * Format: {userId}#{taxYear}
   * Example: 'usr_abc123#2025'
   *
   * Used as the primary key in DynamoDB (future).
   * Used to route WebSocket messages to the correct session.
   */
  sessionKey:   string

  /**
   * Fixed context — does not change after session creation.
   */
  context:      SessionContext

  /**
   * Mutable state — updated on every computation pass.
   * The engine returns a new state object; the old one is preserved
   * in the trace for replay purposes.
   */
  state:        SessionState

  /**
   * Complete execution history for this session.
   * One TraceFrame per InputEvent processed, plus the setup frame.
   */
  trace:        ExecutionTrace

  /**
   * All input events received by this session, in order.
   * Stored separately from the trace for replay and audit.
   * Replaying these events against a fresh session should produce
   * the same final state.
   */
  eventLog:     InputEvent[]

  /**
   * Current status of the overall session.
   *
   * ACTIVE      — preparer is actively working on this return
   * COMPLETE    — all required nodes are CLEAN, return is ready to file
   * ERROR       — one or more nodes are in ERROR status
   * NEEDS_INPUT — one or more required input nodes have no value
   */
  status:       SessionStatus

  /**
   * ISO 8601 timestamp when this session was first created.
   */
  createdAt:    string

  /**
   * ISO 8601 timestamp of the last computation pass.
   */
  lastUpdatedAt: string
}

export enum SessionStatus {
  ACTIVE       = 'active',
  COMPLETE     = 'complete',
  ERROR        = 'error',
  NEEDS_INPUT  = 'needs_input'
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A lightweight summary of the session for dashboard and list views.
 * Does not include the full node state or trace — just what the UI
 * needs to show a return in a list or status card.
 */
export interface SessionSummary {
  sessionKey:       string
  displayName:      string   // e.g. 'Maria Garcia — 2025'
  taxYear:          string
  filingStatus:     string
  status:           SessionStatus

  /**
   * Key financial figures for quick display.
   * These are read from specific well-known node instance IDs.
   * null if the node has not yet been computed.
   */
  figures: {
    adjustedGrossIncome:     number | null
    totalTax:                number | null
    totalPayments:           number | null
    refundOrAmountOwed:      number | null   // positive = refund, negative = owed
  }

  /**
   * Counts for the status bar in the UI.
   */
  counts: {
    totalNodes:        number
    completedNodes:    number   // CLEAN + SKIPPED + OVERRIDE
    pendingNodes:      number   // DIRTY + PENDING
    unsupportedNodes:  number
    errorNodes:        number
    overrideNodes:     number
  }

  /**
   * Forms that have at least one CLEAN computed node.
   * Used to show which forms are "active" in the return.
   * Example: ['f8889', 'f5329', 'schedule-2', 'f1040']
   */
  activeForms:      string[]

  lastUpdatedAt:    string
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE INSTANCE RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How the session resolves NodeIds to NodeInstanceIds
 * for REPEATABLE nodes.
 *
 * When a node definition has repeatable: true, the session
 * creates two instances — one for each filer. This record
 * maps the definition ID to both instance IDs so the engine
 * can look them up efficiently.
 */
export interface RepeatableNodeInstances {
  definitionId:      NodeId           // the definition (e.g. 'f8889.primary.line13_hsaDeduction')
  primaryInstanceId: NodeInstanceId   // primary filer instance
  spouseInstanceId:  NodeInstanceId   // spouse filer instance (only when hasSpouse = true)
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION REPOSITORY INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The contract for session persistence.
 * In local development: an in-memory implementation.
 * In production: a DynamoDB implementation.
 *
 * The engine never calls this directly — only the session manager does.
 * This keeps the engine pure and storage-agnostic.
 */
export interface SessionRepository {
  /**
   * Load a session by its key.
   * Returns null if no session exists for this key.
   */
  load(sessionKey: string): Promise<TaxSession | null>

  /**
   * Persist a session.
   * Creates if it does not exist, replaces if it does.
   */
  save(session: TaxSession): Promise<void>

  /**
   * Delete a session and all its data.
   */
  delete(sessionKey: string): Promise<void>

  /**
   * List all sessions for a given user.
   * Returns summaries only — not full session objects.
   */
  listByUser(userId: string): Promise<SessionSummary[]>
}

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORT — so consumers only need to import from session.types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-exported from node.types for convenience.
 * Callers working with sessions often need NodeOwner
 * without importing directly from node.types.
 */
// export { NodeOwner };

// Needed internally — re-exported for convenience
type NodeId = string;