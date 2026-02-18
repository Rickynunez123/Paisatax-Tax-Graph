/**
 * PAISATAX — QUESTION TYPE INTERFACES
 *
 * Defines the shape of preparer-facing questions, guidance, and help text.
 * Kept entirely separate from node logic so questions can be:
 *   - Translated to Spanish without touching any calculation code
 *   - Updated with better wording without risk of breaking computations
 *   - Augmented with new guidance, examples, or IRS citations independently
 *
 * Every InputNodeDefinition references a QuestionDefinition by ID.
 * The engine never reads questions — only the UI layer does.
 *
 * Rules for this file:
 *   - No calculation logic
 *   - No imports from node.types or engine.types
 *   - Pure data shapes only
 */

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORTED LANGUAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Languages supported in the preparer UI.
 * All QuestionDefinitions must have at least 'en' content.
 * 'es' is required for PaisaTax's bilingual support.
 */
export type SupportedLanguage = 'en' | 'es';

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION ANSWER SHAPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One option in a multiple-choice question.
 * Used when questionType is SINGLE_CHOICE or MULTI_CHOICE.
 */
export interface AnswerOption {
  /**
   * The value stored in the node when this option is selected.
   * Must match the node's valueType.
   */
  value:       string | number | boolean

  /**
   * Display label shown to the preparer.
   * Keyed by language code.
   */
  label:       Record<SupportedLanguage, string>

  /**
   * Optional clarifying note shown alongside the option.
   * Use for options that are commonly misunderstood.
   * Keyed by language code.
   */
  hint?:       Record<SupportedLanguage, string>

  /**
   * When true, selecting this option causes the question to
   * display an additional follow-up question (defined in followUpQuestionId).
   * Example: selecting 'yes' for HSA coverage reveals coverage type question.
   */
  triggersFollowUp?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How the question is presented and answered in the UI.
 *
 * CURRENCY       — dollar amount input field. Numeric keyboard on mobile.
 * INTEGER        — whole number input field.
 * PERCENTAGE     — percentage input (0–100). Converted to 0–1 before storing.
 * DATE           — date picker. Stored as YYYY-MM-DD string.
 * SINGLE_CHOICE  — radio buttons or dropdown. One answer from a fixed list.
 * MULTI_CHOICE   — checkboxes. Multiple answers from a fixed list.
 * YES_NO         — simplified SINGLE_CHOICE with just yes/no. Common pattern.
 * FREE_TEXT      — open text. Used for names, descriptions, EINs, etc.
 */
export enum QuestionType {
  CURRENCY      = 'currency',
  INTEGER       = 'integer',
  PERCENTAGE    = 'percentage',
  DATE          = 'date',
  SINGLE_CHOICE = 'single_choice',
  MULTI_CHOICE  = 'multi_choice',
  YES_NO        = 'yes_no',
  FREE_TEXT     = 'free_text'
}

// ─────────────────────────────────────────────────────────────────────────────
// GUIDANCE CONTENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured guidance attached to a question.
 * Educates both the preparer and the taxpayer about what is being asked,
 * why it matters, and what tax planning implications it may have.
 */
export interface QuestionGuidance {
  /**
   * One-sentence plain-language explanation of what this question is asking.
   * Shown as subtitle text directly below the question.
   * Keyed by language.
   *
   * Example EN: "Enter the total amount you personally deposited into your HSA
   *              in 2025, not including employer contributions."
   * Example ES: "Ingrese el monto total que usted depositó en su HSA en 2025,
   *              sin incluir las contribuciones del empleador."
   */
  explanation:    Record<SupportedLanguage, string>

  /**
   * Where to find this number — specific instructions for the preparer.
   * References the exact document, box, or source.
   * Shown in the "Where to find this" expandable section.
   * Keyed by language.
   *
   * Example: "Ask the taxpayer directly. This is NOT on any tax form.
   *           It is the amount they contributed through their bank or payroll
   *           deduction, separate from what their employer contributed."
   */
  whereToFind:    Record<SupportedLanguage, string>

  /**
   * Common mistakes preparers make on this question.
   * Shown as a warning callout.
   * Optional — only populate when there is a real, common mistake.
   * Keyed by language.
   *
   * Example: "Do NOT include employer contributions here.
   *           Employer contributions come from Form W-2 Box 12 Code W
   *           and are handled automatically on Line 9."
   */
  commonMistakes?: Record<SupportedLanguage, string>

  /**
   * Tax planning insight — what the preparer can tell the taxpayer
   * about how this value affects their return or future planning.
   * Shown in a collapsible "Tax Planning Note" section.
   * Optional — populate for nodes with meaningful planning implications.
   * Keyed by language.
   *
   * Example: "If the taxpayer contributed less than the annual limit ($4,300
   *           for self-only coverage), they may be able to make additional
   *           contributions before the tax filing deadline — April 15, 2026."
   */
  taxPlanningNote?: Record<SupportedLanguage, string>

  /**
   * One or two concrete examples that make the question concrete.
   * Shown as "For example:" text.
   * Keyed by language.
   *
   * Example: "Maria contributed $200/month through payroll deduction
   *           for 10 months, then stopped. Her personal contribution
   *           is $2,000. Her employer also contributed $500 — that goes
   *           on Line 9, not here."
   */
  examples?:      Record<SupportedLanguage, string[]>

  /**
   * IRS publication or instruction references.
   * Shown as clickable links in the "IRS Reference" section.
   * Optional.
   */
  irsReferences?: IRSReference[]
}

/**
 * A reference to an IRS publication or instruction page.
 */
export interface IRSReference {
  /** Short title shown as link text. Example: "IRS Pub 969 — HSAs" */
  title:  string
  /** URL to the IRS document. */
  url:    string
  /** Specific page or section within the document. Optional. */
  page?:  string
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A complete question definition.
 * Referenced by InputNodeDefinition.questionId.
 *
 * One QuestionDefinition can be referenced by multiple nodes
 * if the same question applies in different contexts.
 * Example: "How much did you contribute?" is the same question
 * whether it's for a traditional IRA or a Roth IRA.
 */
export interface QuestionDefinition {
  /**
   * Stable unique identifier for this question.
   * Format: {formId}.q.{shortName}
   * Example: 'f8889.q.personalContributions'
   *
   * Never changes once shipped — node definitions reference this by ID.
   */
  id:            string

  /**
   * How the question is presented in the UI.
   */
  questionType:  QuestionType

  /**
   * The question text shown to the preparer.
   * Should be written as a question the preparer asks the taxpayer.
   * Keyed by language.
   *
   * Example EN: "How much did you personally contribute to your HSA in 2025?"
   * Example ES: "¿Cuánto contribuyó usted personalmente a su HSA en 2025?"
   */
  question:      Record<SupportedLanguage, string>

  /**
   * Very short label for the input field itself.
   * Used in compact views and the trace viewer.
   * Keyed by language.
   *
   * Example EN: "Personal HSA contributions"
   * Example ES: "Contribuciones personales al HSA"
   */
  shortLabel:    Record<SupportedLanguage, string>

  /**
   * Answer options. Required when questionType is
   * SINGLE_CHOICE, MULTI_CHOICE, or YES_NO.
   * Omit for CURRENCY, INTEGER, PERCENTAGE, DATE, FREE_TEXT.
   */
  options?:      AnswerOption[]

  /**
   * Structured guidance for the preparer.
   */
  guidance:      QuestionGuidance

  /**
   * Tax years this question applies to.
   * Mirrors the node's applicableTaxYears — if the question wording
   * changes for a new year, create a new QuestionDefinition with a new ID
   * and update the node's questionId. The old question is retained for
   * historical trace display purposes.
   */
  applicableTaxYears: string[]

  /**
   * Input source categories this question is shown for.
   * Drives which UI panel displays this question.
   *
   * 'preparer'   — shown in the manual entry panel
   * 'other_form' — shown in the "transcribe from paper form" panel
   * 'prior_year' — shown in the "prior year carryforward" panel
   *
   * Most questions are 'preparer'. 'other_form' questions show
   * the otherFormMapping instruction prominently.
   */
  inputPanels:   ('preparer' | 'other_form' | 'prior_year')[]

  /**
   * Whether this question should be hidden until its display prerequisites
   * are satisfied. Mirrors the node's displayPrerequisites.
   *
   * When false, the question is always visible but may be disabled.
   * When true, the question is completely hidden until prerequisites are met.
   * Default: false.
   */
  hideUntilPrerequisitesMet?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION REGISTRY INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The contract for the question registry.
 * Stores all QuestionDefinitions and serves them to the UI layer.
 *
 * The engine never uses this — only the UI/API layer does.
 */
export interface QuestionRegistry {
  /**
   * Register question definitions.
   * Called once at startup for each form's questions.ts file.
   */
  register(questions: QuestionDefinition[]): void

  /**
   * Look up a question by its ID.
   * Returns null if not found.
   */
  get(questionId: string): QuestionDefinition | null

  /**
   * Get all questions for a specific form.
   * Used to render the full question list for a form panel.
   */
  getByForm(formId: string): QuestionDefinition[]

  /**
   * Get all questions applicable for a given tax year.
   */
  getByTaxYear(taxYear: string): QuestionDefinition[]
}

// ─────────────────────────────────────────────────────────────────────────────
// PREPARER UI QUESTION STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The state of a single question as rendered in the preparer UI.
 * Combines the QuestionDefinition (static) with the current node
 * state (dynamic) for display purposes.
 *
 * Built by the UI layer from QuestionDefinition + NodeSnapshot.
 * Never stored in the session or processed by the engine.
 */
export interface QuestionUIState {
  questionId:     string
  nodeInstanceId: string
  question:       string       // resolved for current language
  shortLabel:     string       // resolved for current language
  questionType:   QuestionType
  options?:       AnswerOption[]

  /**
   * Current value from the NodeSnapshot.
   */
  currentValue:   string | number | boolean | null

  /**
   * Whether this question is editable by the preparer.
   * false for COMPUTED nodes (unless in OVERRIDE mode).
   * false when displayPrerequisites are not yet satisfied.
   */
  isEditable:     boolean

  /**
   * Whether this question is visible in the current UI state.
   * false when hideUntilPrerequisitesMet and prerequisites not met.
   */
  isVisible:      boolean

  /**
   * The node's current status — drives visual treatment.
   * 'clean'       → green checkmark
   * 'dirty'       → loading spinner
   * 'error'       → red error state with errorMessage
   * 'unsupported' → gray with unsupportedNote
   * 'override'    → yellow badge "Manually set"
   * 'skipped'     → dimmed, not applicable
   */
  nodeStatus:     string

  /**
   * Error message to show when nodeStatus is 'error'.
   */
  errorMessage?:  string

  /**
   * Override note to show when nodeStatus is 'override'.
   */
  overrideNote?:  string

  /**
   * Note to show when nodeStatus is 'unsupported'.
   */
  unsupportedNote?: string

  /**
   * Resolved guidance for the current language.
   * Passed to the expandable help section.
   */
  guidance: {
    explanation:      string
    whereToFind:      string
    commonMistakes?:  string
    taxPlanningNote?: string
    examples?:        string[]
    irsReferences?:   IRSReference[]
  }
}