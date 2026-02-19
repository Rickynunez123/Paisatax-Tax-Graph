/**
 * FORM SLOT REGISTRY
 *
 * Sits above the engine and manages the lifecycle of repeatable form instances
 * (slots). A "slot" is one occurrence of a multi-instance form — for example,
 * one W-2 among potentially many W-2s for the same filer.
 *
 * RESPONSIBILITIES
 *   - Track which slots exist per form per owner
 *   - Generate node definitions for a new slot by calling the form's generator
 *   - Maintain and regenerate the aggregator node when slots change
 *   - Call engine.registerNodes() with new/updated definitions (additive)
 *   - Call engine.reinitializeSession() to carry over existing state
 *   - Return the updated EngineResult to the caller
 *
 * ZERO TAX KNOWLEDGE
 *   The registry has no knowledge of what a W-2 or 1099 is. It calls
 *   generator functions provided at registration time. All tax logic
 *   lives in the generator functions.
 *
 * SLOT ID FORMAT
 *   Slot instance IDs follow: {formId}.{owner}.s{slotIndex}.{lineId}
 *   Example: w2.primary.s0.box1_wages
 *            w2.primary.s1.box1_wages
 *            w2.spouse.s0.box1_wages
 *
 * AGGREGATOR PATTERN
 *   Each slotted form has one aggregator node per owner that sums a key
 *   output across all slots. The aggregator's dependencies list is
 *   dynamically rebuilt whenever slots change. The aggregator node is
 *   re-registered (replacing the previous definition) after every mutation.
 *
 * USAGE
 *   const registry = new FormSlotRegistry(engine);
 *
 *   registry.registerForm('w2', {
 *     generateSlotNodes:   (owner, slotIndex) => [...NodeDefinition[]],
 *     generateAggregators: (primarySlots, spouseSlots) => [...NodeDefinition[]],
 *   });
 *
 *   // User clicks "Add W-2" for primary filer
 *   const result = registry.addSlot('w2', NodeOwner.PRIMARY, sessionContext, currentState);
 *
 *   // User clicks "Remove W-2" (slot 1)
 *   const result = registry.removeSlot('w2', NodeOwner.PRIMARY, 1, sessionContext, currentState);
 */


import type { NodeDefinition, NodeOwner, NodeInstanceId, NodeSnapshot } from "../graph/node.types";
// import type { EngineResult } from '../../../core/graph/engine.types';
import type { EngineResult } from "../graph/engine.types";
// import type { TaxGraphEngineImpl } from '../../../core/graph/engine';
import { TaxGraphEngineImpl } from "../graph/engine";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotSessionContext {
  taxYear: string;
  filingStatus: string;
  hasSpouse: boolean;
  sessionKey: string;
}

/**
 * A form registration tells the registry how to generate nodes for this form.
 *
 * generateSlotNodes:
 *   Called once per slot when a slot is added.
 *   Must return all node definitions for that one slot.
 *   Slot index is 0-based and monotonically increasing per owner.
 *
 * generateAggregators:
 *   Called after every slot mutation (add or remove).
 *   Receives the current list of slot indices for each owner.
 *   Must return aggregator node definitions whose dependencies list
 *   all slots for that owner. These replace any previous aggregator
 *   definitions with the same ID.
 */
export interface FormRegistration {
  generateSlotNodes: (owner: NodeOwner, slotIndex: number) => NodeDefinition[];
  generateAggregators: (
    primarySlots: number[],
    spouseSlots: number[],
  ) => NodeDefinition[];
}

/**
 * Tracks the slot state for one form.
 */
interface FormSlotState {
  registration: FormRegistration;
  /** Slot indices currently active for the primary filer. May have gaps after removal. */
  primarySlots: number[];
  /** Slot indices currently active for the spouse. May have gaps after removal. */
  spouseSlots: number[];
  /** Monotonically increasing counter — next slot index to assign for primary. */
  primaryNext: number;
  /** Monotonically increasing counter — next slot index to assign for spouse. */
  spouseNext: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export class FormSlotRegistry {
  private engine: TaxGraphEngineImpl;
  private forms: Map<string, FormSlotState> = new Map();

  constructor(engine: TaxGraphEngineImpl) {
    this.engine = engine;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // REGISTRATION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Register a form type with the registry.
   * Must be called before addSlot/removeSlot for that form.
   * Does not immediately add any slots or touch the engine.
   */
  registerForm(formId: string, registration: FormRegistration): void {
    if (this.forms.has(formId)) {
      throw new Error(
        `Form '${formId}' is already registered. ` +
          `Call unregisterForm() first if you need to re-register.`,
      );
    }
    this.forms.set(formId, {
      registration,
      primarySlots: [],
      spouseSlots: [],
      primaryNext: 0,
      spouseNext: 0,
    });
  }

  /**
   * Remove a form registration. Does not clean up engine state.
   */
  unregisterForm(formId: string): void {
    this.forms.delete(formId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SLOT MUTATIONS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Add a new slot for the given form and owner.
   *
   * Steps:
   *   1. Assign the next slot index for this owner
   *   2. Generate slot node definitions via the form's generator
   *   3. Regenerate aggregator nodes with the updated slot list
   *   4. Register all new/updated definitions with the engine (additive)
   *   5. Call engine.reinitializeSession() to carry over existing state
   *   6. Return the new EngineResult
   *
   * The slot index is monotonically increasing and never reused, even
   * after removal. This ensures node IDs are stable and do not collide
   * with previously removed slots that may still be in state history.
   */
  addSlot(
    formId: string,
    owner: NodeOwner,
    context: SlotSessionContext,
    currentState: Record<NodeInstanceId, NodeSnapshot>,
  ): EngineResult {
    const state = this.getFormState(formId);

    const slotIndex =
      owner === ("primary" as NodeOwner)
        ? state.primaryNext++
        : state.spouseNext++;

    if (owner === ("primary" as NodeOwner)) {
      state.primarySlots.push(slotIndex);
    } else {
      state.spouseSlots.push(slotIndex);
    }

    const slotNodes = state.registration.generateSlotNodes(owner, slotIndex);
    const aggregators = state.registration.generateAggregators(
      state.primarySlots,
      state.spouseSlots,
    );

    this.engine.registerNodes([...slotNodes, ...aggregators]);

    return this.engine.reinitializeSession(context, currentState);
  }

  /**
   * Remove an existing slot by index.
   *
   * Steps:
   *   1. Remove the slot index from the owner's active list
   *   2. Regenerate aggregator nodes with the updated slot list
   *      (the removed slot's nodes remain in the engine registry but
   *       are no longer in the aggregator's dependencies — they become
   *       orphaned and will be ignored by downstream computations)
   *   3. Register updated aggregators with the engine
   *   4. Call engine.reinitializeSession() to carry over existing state
   *   5. Return the new EngineResult
   *
   * NOTE: Removed slot nodes are NOT unregistered from the engine.
   * They remain in the definition registry but are disconnected from
   * the aggregator. If the slot's state values are in currentState,
   * they will be dropped by reinitializeSession() since they're still
   * in the instance graph.
   *
   * TODO: Add engine.removeNodes() if orphaned node cleanup becomes important.
   */
  removeSlot(
    formId: string,
    owner: NodeOwner,
    slotIndex: number,
    context: SlotSessionContext,
    currentState: Record<NodeInstanceId, NodeSnapshot>,
  ): EngineResult {
    const state = this.getFormState(formId);

    const slots =
      owner === ("primary" as NodeOwner)
        ? state.primarySlots
        : state.spouseSlots;

    const idx = slots.indexOf(slotIndex);
    if (idx === -1) {
      throw new Error(
        `Cannot remove slot ${slotIndex} for form '${formId}' owner '${owner}': slot not found. ` +
          `Active slots: [${slots.join(", ")}]`,
      );
    }

    slots.splice(idx, 1);

    const aggregators = state.registration.generateAggregators(
      state.primarySlots,
      state.spouseSlots,
    );

    this.engine.registerNodes(aggregators);

    return this.engine.reinitializeSession(context, currentState);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // INSPECTION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Return the active slot indices for a form and owner.
   */
  getSlots(formId: string, owner: NodeOwner): number[] {
    const state = this.getFormState(formId);
    return owner === ("primary" as NodeOwner)
      ? [...state.primarySlots]
      : [...state.spouseSlots];
  }

  /**
   * Return the total number of active slots across both owners.
   */
  getTotalSlotCount(formId: string): number {
    const state = this.getFormState(formId);
    return state.primarySlots.length + state.spouseSlots.length;
  }

  /**
   * Return true if the form has any active slots for either owner.
   */
  hasSlots(formId: string): boolean {
    return this.getTotalSlotCount(formId) > 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE
  // ───────────────────────────────────────────────────────────────────────────

  private getFormState(formId: string): FormSlotState {
    const state = this.forms.get(formId);
    if (!state) {
      throw new Error(
        `Form '${formId}' is not registered. ` +
          `Call registry.registerForm('${formId}', { generateSlotNodes, generateAggregators }) first.`,
      );
    }
    return state;
  }
}