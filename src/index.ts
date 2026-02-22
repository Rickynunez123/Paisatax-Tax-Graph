// ─── Core types ──────────────────────────────────────────────────────────────
export type {
  NodeDefinition,
  NodeInstanceId,
  NodeSnapshot,
  InputValidation,
} from "./core/graph/node.types.js";

export {
  NodeKind,
  NodeOwner,
  NodeValueType,
  NodeStatus,
  InputSource,
} from "./core/graph/node.types.js";

export type {
  EngineResult,
  InputEvent,
  ExecutionTrace,
  TraceFrame,
} from "./core/graph/engine.types.js";

export { InputEventSource } from "./core/graph/engine.types.js";

// ─── Core engine ─────────────────────────────────────────────────────────────
export { TaxGraphEngineImpl } from "./core/graph/engine.js";

// ─── Core registry ───────────────────────────────────────────────────────────
export { FormSlotRegistry } from "./core/registry/form-instance-registry.js";

// ─── Question types ──────────────────────────────────────────────────────────
export type {
  QuestionDefinition,
  QuestionGuidance,
  AnswerOption,
} from "./core/question/question.types.js";

export { QuestionType } from "./core/question/question.types.js";

// ─── Form node definitions ───────────────────────────────────────────────────

// Form 1040 and supporting derived nodes
export { F1040_NODES } from "./tax/forms/f1040/nodes.js";
export { F1040_PAYMENT_NODES } from "./tax/forms/f1040/payments.js";

// 1099 information returns (slotted)
export {
  generateF1099DIVSlotNodes,
  generateF1099DIVAggregators,
  F1099DIV_INITIAL_AGGREGATORS,
  F1099DIV_OUTPUTS,
} from "./tax/forms/f1099div/nodes.js";

export {
  generateF1099INTSlotNodes,
  generateF1099INTAggregators,
  F1099INT_INITIAL_AGGREGATORS,
  F1099INT_OUTPUTS,
} from "./tax/forms/f1099int/nodes.js";

export {
  generateF1099NECSlotNodes,
  generateF1099NECAggregators,
  F1099NEC_INITIAL_AGGREGATORS,
  F1099NEC_OUTPUTS,
} from "./tax/forms/f1099nec/nodes.js";

// Credits and other standalone forms
export { F2441_NODES } from "./tax/forms/f2441/nodes.js";
export { F3800_NODES } from "./tax/forms/f3800/nodes.js";
export { F4868_NODES } from "./tax/forms/f4868/nodes.js";
export { F5329_NODES } from "./tax/forms/f5329/nodes.js";
export { F5695_NODES } from "./tax/forms/f5695/nodes.js";
export { F8812_NODES } from "./tax/forms/f8812/nodes.js";
export { F8863_NODES } from "./tax/forms/f8863/nodes.js";
export { F8880_NODES } from "./tax/forms/f8880/nodes.js";
export { F8889_NODES } from "./tax/forms/f8889/nodes.js";
export { F8911_NODES } from "./tax/forms/f8911/nodes.js";
export { F8936_NODES } from "./tax/forms/f8936/nodes.js";

// Form 8949 (slotted — one slot per brokerage/category)
export {
  generateF8949SlotNodes,
  generateF8949Aggregators,
  F8949_INITIAL_AGGREGATORS,
  F8949_OUTPUTS,
} from "./tax/forms/f8949/nodes.js";

// Schedules
export {
  SCHEDULE_A_NODES,
  SCHEDULE_A_OUTPUTS,
} from "./tax/forms/schedule-a/nodes.js";
export {
  SCHEDULE_B_NODES,
  SCHEDULE_B_OUTPUTS,
} from "./tax/forms/schedule-b/nodes.js";

export {
  generateScheduleCSlotNodes,
  generateScheduleCAggregators,
  SCHEDULE_C_INITIAL_AGGREGATORS,
  SCHEDULE_C_OUTPUTS,
} from "./tax/forms/schedule-c/nodes.js";

export {
  SCHEDULE_D_NODES,
  SCHEDULE_D_OUTPUTS,
} from "./tax/forms/schedule-d/nodes.js";
export {
  SCHEDULE_EIC_NODES,
  SCHEDULE_EIC_OUTPUTS,
} from "./tax/forms/schedule-eic/nodes.js";

export {
  generateScheduleFSlotNodes,
  generateScheduleFAggregators,
  SCHEDULE_F_INITIAL_AGGREGATORS,
  SCHEDULE_F_OUTPUTS,
} from "./tax/forms/schedule-f/nodes.js";

export {
  SCHEDULE_H_NODES,
  SCHEDULE_H_OUTPUTS,
} from "./tax/forms/schedule-h/nodes.js";
export {
  SCHEDULE_SE_NODES,
  SCHEDULE_SE_OUTPUTS,
} from "./tax/forms/schedule-se/nodes.js";
export {
  SCHEDULE1_NODES,
  SCHEDULE1_OUTPUTS,
} from "./tax/forms/schedule1/nodes.js";
export {
  SCHEDULE2_NODES,
  SCHEDULE2_OUTPUTS,
} from "./tax/forms/schedule2/nodes.js";
export { SCHEDULE3_NODES } from "./tax/forms/schedule3/nodes.js";

// ─── W-2 (slotted form) ──────────────────────────────────────────────────────
export {
  generateW2SlotNodes,
  generateW2Aggregators,
  W2_INITIAL_AGGREGATORS,
  W2_OUTPUTS,
  w2NodeId,
} from "./tax/forms/w2/nodes.js";

// ─── Question definitions ────────────────────────────────────────────────────
export { W2_QUESTIONS } from "./tax/forms/w2/questions.js";
export { F1040_QUESTIONS } from "./tax/forms/f1040/questions.js";
export { F1099NEC_QUESTIONS } from "./tax/forms/f1099nec/questions.js";
// export { F5329_QUESTIONS }     from './tax/forms/f5329/questions.js';
// export { F8889_QUESTIONS }     from './tax/forms/f8889/questions.js';
export { SCHEDULE_A_QUESTIONS } from "./tax/forms/schedule-a/questions.js";
export { SCHEDULE_C_QUESTIONS } from "./tax/forms/schedule-c/questions.js";
export { SCHEDULE_F_QUESTIONS } from "./tax/forms/schedule-f/questions.js";
export { SCHEDULE_H_QUESTIONS } from "./tax/forms/schedule-h/questions.js";
