/**
 * PAISATAX — CORE NODE TYPE INTERFACES
 *
 * This file is the foundation of the entire tax graph engine.
 * It has zero tax knowledge — it defines the shape of nodes,
 * not what any specific tax node does.
 *
 * Rules for this file:
 *   - No tax imports
 *   - No form names
 *   - No dollar amounts
 *   - No IRS references
 *   - Pure TypeScript interfaces and enums only
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Who this node's value belongs to on the tax return.
 *
 * PRIMARY  — belongs to the main filer only
 * SPOUSE   — belongs to the spouse only (MFJ returns)
 * JOINT    — belongs to the household (single value regardless of filing status)
 *
 * When a node is REPEATABLE, the session instantiates separate copies
 * for PRIMARY and SPOUSE. Non-repeatable nodes always have one instance.
 */
export enum NodeOwner {
  PRIMARY = 'primary',
  SPOUSE  = 'spouse',
  JOINT   = 'joint'
}

/**
 * The source of a node's value.
 *
 * INPUT     — value comes from outside the graph (preparer entry, OCR, upload)
 * COMPUTED  — value is derived from other nodes by a pure function
 */
export enum NodeKind {
  INPUT    = 'input',
  COMPUTED = 'computed'
}

/**
 * Lifecycle state of a node within a session.
 *
 * PENDING     — has dependencies but none have been resolved yet
 * DIRTY       — one or more dependencies changed, needs recomputation
 * COMPUTING   — currently being evaluated by the engine (cycle detection)
 * CLEAN       — value is current and all dependencies are resolved
 * SKIPPED     — node is not applicable for this session context
 *               (wrong tax year, no spouse, filing status mismatch, etc.)
 *               The node EXISTS in the system — it just doesn't apply here.
 *               A different session could have this node as CLEAN.
 * UNSUPPORTED — this line or section has not been implemented yet in PaisaTax.
 *               The node definition exists so the architecture is complete
 *               and the UI can show "not yet supported" to the preparer.
 *               The preparer must handle this line manually outside the system.
 *               Visually distinct from SKIPPED — this is a system limitation,
 *               not a situational inapplicability.
 * OVERRIDE    — a preparer manually set this value on a node that would
 *               normally be COMPUTED. The engine stops propagating to this
 *               node until the override is cleared. Used in full-service
 *               returns where the preparer has information the system lacks.
 * ERROR       — last computation threw an exception. errorMessage will be set.
 */
export enum NodeStatus {
  PENDING     = 'pending',
  DIRTY       = 'dirty',
  COMPUTING   = 'computing',
  CLEAN       = 'clean',
  SKIPPED     = 'skipped',
  UNSUPPORTED = 'unsupported',
  OVERRIDE    = 'override',
  ERROR       = 'error'
}

/**
 * The data type of a node's value.
 * Used by the UI to render the right input control
 * and by the engine to validate inputs.
 */
export enum NodeValueType {
  CURRENCY   = 'currency',   // Dollar amount — always a number, never negative unless explicitly allowed
  PERCENTAGE = 'percentage', // Rate — number between 0 and 1
  INTEGER    = 'integer',    // Whole number (e.g. days, count)
  BOOLEAN    = 'boolean',    // Yes/no flag
  ENUM       = 'enum',       // One of a fixed set of string values
  DATE       = 'date',       // ISO 8601 date string YYYY-MM-DD
  STRING     = 'string'      // Free text (names, SSNs, etc.)
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE IDENTITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The stable identifier for a node definition.
 * Format: {formId}.{owner}.{lineId}
 *
 * Examples:
 *   f8889.primary.line13_hsaDeduction
 *   f5329.joint.line4_additionalTax
 *   f1040.joint.line11_agi
 *
 * When a node is REPEATABLE, the session creates two instances:
 *   f8889.primary.line13_hsaDeduction  (primary filer)
 *   f8889.spouse.line13_hsaDeduction   (spouse)
 *
 * The NodeId is the definition ID. The session uses NodeInstanceId
 * to address a specific instantiation.
 */
export type NodeId = string;

/**
 * Uniquely addresses one instance of a node within a session.
 * For non-repeatable nodes: same as NodeId.
 * For repeatable nodes: NodeId with owner resolved to primary or spouse.
 */
export type NodeInstanceId = string;

// ─────────────────────────────────────────────────────────────────────────────
// NODE VALUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The actual value stored in a node instance.
 * null means the value has not been set or could not be computed.
 */
export type NodeValue = number | boolean | string | null;

/**
 * A snapshot of a node instance's value and status at a point in time.
 * This is what gets stored in the session and sent over the WebSocket.
 * The UI renders from this — it never reads the node definition directly.
 */
export interface NodeSnapshot {
  instanceId:       NodeInstanceId
  value:            NodeValue
  status:           NodeStatus

  /**
   * Set when status is ERROR.
   * Human-readable description of what went wrong.
   */
  errorMessage?:    string

  /**
   * Set when status is OVERRIDE.
   * Records why the preparer overrode this computed value.
   * Required when overriding — forces the preparer to document their reasoning.
   * Example: "Taxpayer has corrected 1099-R — payer error on original"
   */
  overrideNote?:    string

  /**
   * Set when status is UNSUPPORTED.
   * Tells the preparer exactly what they need to handle manually
   * and ideally references the relevant IRS form and line.
   * Example: "Form 5329 Part III Line 9 — prior year IRA excess carryforward
   *           not yet supported. Enter manually from prior year Form 5329 Line 16."
   */
  unsupportedNote?: string

  /**
   * ISO 8601 timestamp of the last time this snapshot changed.
   * Used by the WebSocket to send only changed nodes to the client.
   */
  updatedAt:        string
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE DEFINITION — BASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fields shared by both InputNodeDefinition and ComputedNodeDefinition.
 */
export interface BaseNodeDefinition {
  /**
   * Stable unique identifier.
   * Format: {formId}.{owner}.{lineId}
   * Never changes once the codebase ships — downstream consumers depend on it.
   */
  id: NodeId

  /**
   * Human-readable label shown in the UI and trace viewer.
   * Example: "Form 8889 Line 13 — HSA Deduction"
   */
  label: string

  /**
   * Short description of what this node represents.
   * Shown as a tooltip in the preparer UI.
   */
  description: string

  /**
   * The data type of this node's value.
   * Drives input validation and UI rendering.
   */
  valueType: NodeValueType

  /**
   * Whether negative values are valid for this node.
   * Default: false. Losses and carrybacks are the exception, not the rule.
   */
  allowNegative?: boolean

  /**
   * Who owns this node's value.
   * For REPEATABLE nodes this is the default — the session overrides
   * it when instantiating the spouse copy.
   */
  owner: NodeOwner

  /**
   * When true, the session creates one instance per filer (primary + spouse)
   * when the return has a spouse. Non-repeatable nodes always have one instance.
   *
   * Only meaningful when owner is NodeOwner.PRIMARY or NodeOwner.SPOUSE.
   * Joint nodes are never repeatable.
   */
  repeatable?: boolean

  /**
   * Tax years this node is valid for.
   * ['2024', '2025'] means the node exists in both years.
   * When the compute function needs year-specific constants, it receives
   * the tax year as a parameter and looks them up from the constants file.
   *
   * If a node's formula changes between years, create a new node definition
   * with a new ID and set applicableTaxYears on the old one to exclude
   * the year it changed. No deletion — retirement only.
   */
  applicableTaxYears: string[]

  /**
   * Classification tags describing what kind of tax concept this node
   * represents. A node can have multiple classifications.
   *
   * Used to build summary views ("all deductions", "all credits") and
   * to educate preparers on tax planning implications.
   *
   * Defined in classification.types.ts — kept separate to allow
   * localization and UI changes without touching node logic.
   */
  classifications: NodeClassificationTag[]

  /**
   * IRS citation for this node — form number, line number, and
   * optionally the IRC section that governs it.
   *
   * Example: { form: 'f8889', line: '13', ircSection: '223' }
   */
  irsCitation: IRSCitation

  /**
   * Optional: node IDs that must be resolved before this node
   * is considered for display in the preparer UI.
   *
   * Different from computed dependencies — these are UI prerequisites.
   * Example: HSA nodes should not show until coverage type is answered.
   */
  displayPrerequisites?: NodeId[]
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT NODE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Describes where an input node's value comes from.
 *
 * OCR          — extracted from a scanned document (1099, W-2, etc.)
 * PREPARER     — entered manually by the tax preparer answering questions
 * PRIOR_YEAR   — carried forward from last year's return (will be automated eventually)
 * OTHER_FORM   — transcribed from a paper form the preparer has in hand
 * DERIVED      — a simple transformation of another input with no computation chain
 */
export enum InputSource {
  OCR        = 'ocr',
  PREPARER   = 'preparer',
  PRIOR_YEAR = 'prior_year',
  OTHER_FORM = 'other_form',
  DERIVED    = 'derived'
}

/**
 * A node whose value comes from outside the graph.
 * The engine never computes this — it only accepts and validates input.
 */
export interface InputNodeDefinition extends BaseNodeDefinition {
  kind: NodeKind.INPUT

  /**
   * Where this value comes from.
   * Drives which UI panel shows this field and what instructions accompany it.
   */
  source: InputSource

  /**
   * When source is OCR: which document type and which box/field.
   * Example: { documentType: '1099-SA', box: '1' }
   */
  ocrMapping?: {
    documentType: string
    box:          string
    fieldName?:   string
  }

  /**
   * When source is OTHER_FORM: what paper form and line the preparer reads from.
   * Example: { form: 'Form 8853', line: '1' }
   * This text is shown directly in the preparer UI as an instruction.
   */
  otherFormMapping?: {
    form: string
    line: string
  }

  /**
   * ID of the QuestionDefinition to show the preparer for this input.
   * The QuestionDefinition lives in the form's questions.ts file.
   * Kept separate so questions can be translated without touching node logic.
   */
  questionId?: string

  /**
   * Default value when no input has been provided.
   * Most currency nodes default to 0. Boolean nodes should be explicit.
   */
  defaultValue: NodeValue

  /**
   * Optional validation rules for this input.
   * The engine rejects values that fail validation before accepting them.
   */
  validation?: InputValidation
}

/**
 * Validation constraints for an input node.
 */
export interface InputValidation {
  min?:          number
  max?:          number
  // For ENUM type — the list of valid string values
  allowedValues?: string[]
  // Custom validation message shown to preparer on failure
  message?:      string
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED NODE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The context the engine passes to a computed node's compute function.
 * The function reads dependency values from this context — it never
 * accesses the graph or session directly.
 */
export interface ComputeContext {
  /**
   * Retrieve the current value of any node by its instance ID.
   * Returns null if the node has not been resolved yet.
   * The engine ensures all dependencies are resolved before calling compute.
   */
  get: (instanceId: NodeInstanceId) => NodeValue

  /**
   * The tax year for this session.
   * Used to look up year-specific constants inside the compute function.
   */
  taxYear: string

  /**
   * The filing status for this session.
   * Common enough that it's on the context rather than a dependency.
   */
  filingStatus: string

  /**
   * Whether this return has a spouse.
   * Affects which node instances exist and are resolvable.
   */
  hasSpouse: boolean
}

/**
 * A node whose value is derived from other nodes by a pure function.
 * The engine calls compute() whenever any dependency changes.
 *
 * CRITICAL RULES for compute functions:
 *   - Must be pure — same inputs always produce same output
 *   - Must not throw — return null if result cannot be determined
 *   - Must not access anything outside ComputeContext
 *   - Must not have side effects
 */
export interface ComputedNodeDefinition extends BaseNodeDefinition {
  kind: NodeKind.COMPUTED

  /**
   * The node instance IDs this node depends on.
   * The engine builds the dependency graph from these declarations.
   * If a dependency is missing from this list, the engine cannot
   * guarantee correct computation order — this is a definition error.
   *
   * Use the full instance ID format: {formId}.{owner}.{lineId}
   * For repeatable nodes, use the same owner as this node's owner.
   */
  dependencies: NodeId[]

  /**
   * Pure function that computes this node's value.
   * Receives a context with resolved dependency values.
   * Returns the computed value or null if it cannot be determined.
   *
   * Example:
   *   compute: (ctx) => {
   *     const line1 = ctx.get('f8889.primary.line2_personalContributions') as number ?? 0
   *     const line2 = ctx.get('f8889.primary.line3_annualLimit') as number ?? 0
   *     return Math.min(line1, line2)
   *   }
   */
  compute: (ctx: ComputeContext) => NodeValue

  /**
   * Optional: function that determines whether this node is applicable
   * for the current session context.
   *
   * When this returns false, the engine sets the node to SKIPPED
   * and its value to null. Downstream computed nodes treat null
   * dependencies as zero for currency nodes.
   *
   * Use this for:
   *   - Credits that don't apply in a given year
   *   - Lines that only apply when a spouse exists
   *   - Forms that are only required under certain conditions
   */
  isApplicable?: (ctx: ComputeContext) => boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// UNION TYPE — what you actually work with
// ─────────────────────────────────────────────────────────────────────────────

export type NodeDefinition = InputNodeDefinition | ComputedNodeDefinition

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORTING TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IRS citation attached to every node.
 * Provides traceability from any computed value back to the IRS source.
 */
export interface IRSCitation {
  /** The IRS form number. Example: 'f8889', 'schedule-2', 'f1040' */
  form:        string
  /** The line number on that form. Example: '13', '14a', '17b' */
  line:        string
  /** Optional: The IRC section governing this calculation. Example: '223' */
  ircSection?: string
  /** Optional: IRS Publication reference. Example: 'Pub 590-B' */
  publication?: string
}

/**
 * Classification tag — referenced from BaseNodeDefinition.classifications.
 * Defined as a string union here, with full metadata in classification.types.ts.
 * Using a string union allows easy extension without breaking existing code.
 */
export type NodeClassificationTag =
  | 'income.earned'
  | 'income.passive'
  | 'income.portfolio'
  | 'income.other'
  | 'deduction.above_the_line'
  | 'deduction.below_the_line'
  | 'deduction.itemized'
  | 'credit.refundable'
  | 'credit.nonrefundable'
  | 'contribution.retirement'
  | 'contribution.hsa'
  | 'contribution.education'
  | 'contribution.other'
  | 'distribution.retirement'
  | 'distribution.hsa'
  | 'distribution.education'
  | 'distribution.other'
  | 'penalty'
  | 'withholding'
  | 'payment'
  | 'intermediate'  // Internal calculation — not shown in summary views

// ─────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

export function isInputNode(node: NodeDefinition): node is InputNodeDefinition {
  return node.kind === NodeKind.INPUT
}

export function isComputedNode(node: NodeDefinition): node is ComputedNodeDefinition {
  return node.kind === NodeKind.COMPUTED
}