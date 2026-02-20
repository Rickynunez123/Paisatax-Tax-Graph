/**
 * paisatax-tax-graph/src/index.ts
 *
 * Barrel export — re-exports everything the API and tests need.
 * The package.json "exports" field points to ./dist/index.js,
 * so this is the single entry point for all external consumers.
 *
 * RULE: If the API needs to import something, it must be exported here.
 */

// ─── Core types ──────────────────────────────────────────────────────────────
export type {
  NodeDefinition,
  NodeInstanceId,
  NodeSnapshot,
  InputValidation,
} from './core/graph/node.types.js';

export {
  NodeKind,
  NodeOwner,
  NodeValueType,
  NodeStatus,
  InputSource,
} from './core/graph/node.types.js';

export type {
  EngineResult,
  InputEvent,
  ExecutionTrace,
  TraceFrame,
} from './core/graph/engine.types.js';

export {
  InputEventSource,
} from './core/graph/engine.types.js';

// ─── Core engine ─────────────────────────────────────────────────────────────
export { TaxGraphEngineImpl } from './core/graph/engine.js';

// ─── Core registry ───────────────────────────────────────────────────────────
export { FormSlotRegistry } from './core/registry/form-instance-registry.js';

// ─── Question types ──────────────────────────────────────────────────────────
export type {
  QuestionDefinition,
  QuestionGuidance,
  AnswerOption,
} from './core/question/question.types.js';

export {
  QuestionType,
} from './core/question/question.types.js';

// ─── Form node definitions ──────────────────────────────────────────────────
export { F1040_NODES } from './tax/forms/f1040/nodes.js';
export { F1040_PAYMENT_NODES } from './tax/forms/f1040/payments.js';
export { F8889_NODES } from './tax/forms/f8889/nodes.js';
export { F5329_NODES } from './tax/forms/f5329/nodes.js';
export { SCHEDULE1_NODES } from './tax/forms/schedule1/nodes.js';
export { SCHEDULE2_NODES } from './tax/forms/schedule2/nodes.js';
export { SCHEDULE3_NODES } from './tax/forms/schedule3/nodes.js';
export { F2441_NODES } from './tax/forms/f2441/nodes.js';
export { F3800_NODES } from './tax/forms/f3800/nodes.js';
export { F4868_NODES } from './tax/forms/f4868/nodes.js';
export { F5695_NODES } from './tax/forms/f5695/nodes.js';
export { F8812_NODES } from './tax/forms/f8812/nodes.js';
export { F8863_NODES } from './tax/forms/f8863/nodes.js';
export { F8880_NODES } from './tax/forms/f8880/nodes.js';
export { F8911_NODES } from './tax/forms/f8911/nodes.js';
export { F8936_NODES } from './tax/forms/f8936/nodes.js';

// ─── W-2 (slotted form) ─────────────────────────────────────────────────────
export {
  generateW2SlotNodes,
  generateW2Aggregators,
  W2_INITIAL_AGGREGATORS,
  W2_OUTPUTS,
  w2NodeId,
} from './tax/forms/w2/nodes.js';

// ─── Question definitions ────────────────────────────────────────────────────
export { W2_QUESTIONS } from './tax/forms/w2/questions.js';
export { F1040_QUESTIONS } from './tax/forms/f1040/questions.js';
// Add more as you write them:
// export { F8889_QUESTIONS } from './tax/forms/f8889/questions.js';
// export { F5329_QUESTIONS } from './tax/forms/f5329/questions.js';