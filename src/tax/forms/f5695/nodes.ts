/**
 * FORM 5695 — RESIDENTIAL ENERGY CREDITS
 *
 * TWO SEPARATE CREDITS, TWO SEPARATE SCHEDULE 3 DESTINATIONS:
 *   Part I  (§25D) → Schedule 3 Line 5  (residential clean energy)
 *   Part II (§25C) → Schedule 3 Line 5b (energy efficient home improvement)
 *
 * WHAT IS IMPLEMENTED (✅) vs DEFERRED (🚧):
 *   Part I — §25D Residential Clean Energy Credit
 *   ✅ Lines 1–5b: Qualified cost inputs (solar, wind, geo, battery, fuel cell)
 *   ✅ Line 6a:    30% of total qualified costs
 *   ✅ Line 12:    Carryforward from 2024 (input)
 *   ✅ Line 13:    Total tentative credit (line 6a + prior carryforward)
 *   ✅ Line 14:    Tax liability limit (Credit Limit Worksheet approximation)
 *   ✅ Line 15:    Allowed credit (min of line 13 and line 14) → Schedule 3 Line 5
 *   ✅ Line 16:    Carryforward to 2026 (line 13 - line 15, if any)
 *   🚧 Fuel cell $500/½kW cap enforcement (deferred — rare)
 *
 *   Part II — §25C Energy Efficient Home Improvement Credit
 *   ✅ Lines 18a–20b: Bucket A inputs (insulation, doors, windows, HVAC, audit)
 *   ✅ Lines 22a–23b: Bucket B inputs (heat pumps, biomass)
 *   ✅ Sub-limit enforcement: $250/door ($500 total), $600/category, $150 audit
 *   ✅ Line 28:    Bucket A total (≤ $1,200)
 *   ✅ Lines 29–30: Bucket B total (≤ $2,000)
 *   ✅ Line 31:    Tax liability limit
 *   ✅ Line 32:    Allowed credit (≤ tax) → Schedule 3 Line 5b
 *   🚧 Enabling property (electric panel wired to heat pump) — $600 sub-limit
 *      partially implemented as electricPanel under bucket A
 *
 * IMPORTANT NOTE ON SCHEDULE 3 WIRING:
 *   Both credits are separate Schedule 3 lines. The current Schedule 3
 *   implementation has Line 5 as a combined F5695 output. This needs updating
 *   to separate Line 5 (§25D) and Line 5b (§25C). See F5695_OUTPUTS below.
 *
 * IRS References:
 *   Form 5695 Instructions (2025) — IRS.gov/instructions/i5695
 *   IRC §25D, IRC §25C
 */

import type { NodeDefinition } from '../../../core/graph/node.types';
import {
  NodeKind,
  NodeOwner,
  NodeValueType,
  InputSource,
} from '../../../core/graph/node.types';

import {
  getF5695Constants,
  computePartIICredit,
} from './constants/index';

const APPLICABLE_YEARS = ['2025'];
const FORM_ID          = 'f5695';

function safeNum(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART I INPUTS — §25D Qualified Costs
// ─────────────────────────────────────────────────────────────────────────────

const line1_solarElectric: NodeDefinition = {
  id: `${FORM_ID}.joint.line1_solarElectric`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 1 — Solar Electric Property Costs',
  description: 'Costs paid for qualified solar photovoltaic panels and related equipment including installation labor. Includes solar panels, inverters, mounting hardware, and wiring to the home.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.solarElectric',
  defaultValue: 0,
};

const line2_solarWater: NodeDefinition = {
  id: `${FORM_ID}.joint.line2_solarWater`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 2 — Solar Water Heating Property Costs',
  description: 'Costs paid for qualified solar water heating property. At least half the energy used to heat water must come from the sun. Excludes pools and hot tubs.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.solarWater',
  defaultValue: 0,
};

const line3_smallWind: NodeDefinition = {
  id: `${FORM_ID}.joint.line3_smallWind`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 3 — Small Wind Energy Property Costs',
  description: 'Costs paid for qualified small wind energy property (turbines with nameplate capacity ≤ 100 kW) at your principal or secondary residence.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.smallWind',
  defaultValue: 0,
};

const line4_geothermal: NodeDefinition = {
  id: `${FORM_ID}.joint.line4_geothermal`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 4 — Geothermal Heat Pump Property Costs',
  description: 'Costs paid for qualified geothermal heat pump property meeting ENERGY STAR requirements. Includes equipment and installation labor.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.geothermal',
  defaultValue: 0,
};

const line5a_batteryStorage: NodeDefinition = {
  id: `${FORM_ID}.joint.line5a_batteryStorage`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 5a — Battery Storage Technology Costs',
  description: 'Costs paid for qualified battery storage technology with a capacity of at least 3 kilowatt-hours. Must be installed at your residence.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.batteryStorage',
  defaultValue: 0,
};

const line7a_fuelCell: NodeDefinition = {
  id: `${FORM_ID}.joint.line7a_fuelCell`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 7a — Qualified Fuel Cell Property Costs',
  description: 'Costs paid for qualified fuel cell property. Credit limited to $500 per ½ kilowatt of capacity. Must be at your MAIN home only.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.fuelCell',
  defaultValue: 0,
};

const line12_carryforward: NodeDefinition = {
  id: `${FORM_ID}.joint.line12_carryforward`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 12 — §25D Credit Carryforward from 2024',
  description: 'Unused residential clean energy credit from prior year (from your 2024 Form 5695, Line 16). This carries forward until used.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.carryforward2024',
  defaultValue: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// PART I COMPUTED — §25D Credit Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line 6a — Total §25D qualified costs × 30%
 * (Fuel cell portion already input as adjusted — $500/½kW cap is a preparer step)
 */
const line6a_creditBase: NodeDefinition = {
  id: `${FORM_ID}.joint.line6a_creditBase`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 Line 6a — §25D Credit Base (30% of Qualified Costs)',
  description: '30% of total qualified residential clean energy costs: solar electric, solar water heating, small wind, geothermal, battery storage, and fuel cell.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line1_solarElectric`,
    `${FORM_ID}.joint.line2_solarWater`,
    `${FORM_ID}.joint.line3_smallWind`,
    `${FORM_ID}.joint.line4_geothermal`,
    `${FORM_ID}.joint.line5a_batteryStorage`,
    `${FORM_ID}.joint.line7a_fuelCell`,
  ],
  compute: (ctx) => {
    const c = getF5695Constants(ctx.taxYear);
    const total =
      safeNum(ctx.get(`${FORM_ID}.joint.line1_solarElectric`)) +
      safeNum(ctx.get(`${FORM_ID}.joint.line2_solarWater`)) +
      safeNum(ctx.get(`${FORM_ID}.joint.line3_smallWind`)) +
      safeNum(ctx.get(`${FORM_ID}.joint.line4_geothermal`)) +
      safeNum(ctx.get(`${FORM_ID}.joint.line5a_batteryStorage`)) +
      safeNum(ctx.get(`${FORM_ID}.joint.line7a_fuelCell`));
    return Math.round(total * c.partI.rate * 100) / 100;
  },
};

/**
 * Line 13 — Total tentative §25D credit (line 6a + line 12 carryforward)
 */
const line13_tentativeTotal: NodeDefinition = {
  id: `${FORM_ID}.joint.line13_tentativeTotal`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 Line 13 — §25D Tentative Credit (Including Carryforward)',
  description: '30% credit (Line 6a) plus any carryforward from 2024 (Line 12). This total is subject to the tax liability limit.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line6a_creditBase`,
    `${FORM_ID}.joint.line12_carryforward`,
  ],
  compute: (ctx) => {
    return safeNum(ctx.get(`${FORM_ID}.joint.line6a_creditBase`)) +
           safeNum(ctx.get(`${FORM_ID}.joint.line12_carryforward`));
  },
};

/**
 * Line 14 — Tax liability limit for §25D (Credit Limit Worksheet)
 * Nonrefundable — cannot reduce tax below zero, but unused credit carries forward.
 */
const line14_taxLimitPartI: NodeDefinition = {
  id: `${FORM_ID}.joint.line14_taxLimitPartI`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 Line 14 — §25D Tax Liability Limit',
  description: 'Maximum nonrefundable §25D credit. Approximated as Form 1040 total tax (Line 24). Unused credit carries forward to 2026.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: ['f1040.joint.line24_totalTax'],
  compute: (ctx) => Math.max(0, safeNum(ctx.get('f1040.joint.line24_totalTax'))),
};

/**
 * Line 15 — §25D Allowed Credit (→ Schedule 3 Line 5)
 * min(tentative, tax liability limit)
 */
const line15_partICredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line15_partICredit`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 Line 15 — §25D Residential Clean Energy Credit (→ Sched. 3 Line 5)',
  description: 'Final allowed §25D credit. Smaller of Line 13 (tentative) and Line 14 (tax limit). Flows to Schedule 3 Line 5. Any excess carries forward to 2026 (Line 16).',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.line13_tentativeTotal`,
    `${FORM_ID}.joint.line14_taxLimitPartI`,
  ],
  compute: (ctx) => {
    const tentative = safeNum(ctx.get(`${FORM_ID}.joint.line13_tentativeTotal`));
    const taxLimit  = safeNum(ctx.get(`${FORM_ID}.joint.line14_taxLimitPartI`));
    return Math.min(tentative, taxLimit);
  },
  isApplicable: (ctx) => {
    const solarEl  = safeNum(ctx.get(`${FORM_ID}.joint.line1_solarElectric`));
    const solar2   = safeNum(ctx.get(`${FORM_ID}.joint.line2_solarWater`));
    const wind     = safeNum(ctx.get(`${FORM_ID}.joint.line3_smallWind`));
    const geo      = safeNum(ctx.get(`${FORM_ID}.joint.line4_geothermal`));
    const battery  = safeNum(ctx.get(`${FORM_ID}.joint.line5a_batteryStorage`));
    const fuel     = safeNum(ctx.get(`${FORM_ID}.joint.line7a_fuelCell`));
    const carry    = safeNum(ctx.get(`${FORM_ID}.joint.line12_carryforward`));
    return solarEl + solar2 + wind + geo + battery + fuel + carry > 0;
  },
};

/**
 * Line 16 — §25D Carryforward to 2026
 * = max(0, line 13 - line 15)
 * Informational — not a credit reduction, just tracks unused amount.
 */
const line16_carryforwardTo2026: NodeDefinition = {
  id: `${FORM_ID}.joint.line16_carryforwardTo2026`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 Line 16 — §25D Credit Carryforward to 2026',
  description: 'Unused §25D credit that carries forward to 2026. Note: OBBBA ended new §25D credits after 2025, but 2025-generated carryforwards can still be used against 2026 tax.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line13_tentativeTotal`,
    `${FORM_ID}.joint.line15_partICredit`,
  ],
  compute: (ctx) => {
    const tentative = safeNum(ctx.get(`${FORM_ID}.joint.line13_tentativeTotal`));
    const allowed   = safeNum(ctx.get(`${FORM_ID}.joint.line15_partICredit`));
    return Math.max(0, tentative - allowed);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PART II INPUTS — §25C Qualified Costs
// ─────────────────────────────────────────────────────────────────────────────

/** Insulation / air sealing (no sub-limit, just the $1,200 overall cap) */
const line18a_insulation: NodeDefinition = {
  id: `${FORM_ID}.joint.line18a_insulation`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 18a — Insulation / Air Sealing Costs',
  description: 'Costs for insulation material or air sealing material/system (including vapor retarders) primarily designed to reduce heat loss/gain. Must meet IECC standards in effect 2 years prior. No sub-limit beyond overall $1,200 cap.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.insulation',
  defaultValue: 0,
};

/** Exterior doors ($250/door cap, $500 total for all doors) */
const line19a_exteriorDoors: NodeDefinition = {
  id: `${FORM_ID}.joint.line19a_exteriorDoors`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 19a — Exterior Door Costs',
  description: 'Costs for exterior doors that meet applicable ENERGY STAR requirements. Credit capped at $250 per door and $500 total for all exterior doors. Enter total cost paid — engine applies caps.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.exteriorDoors',
  defaultValue: 0,
};

/** Windows and skylights ($600 total cap) */
const line19d_windowsSkylights: NodeDefinition = {
  id: `${FORM_ID}.joint.line19d_windowsSkylights`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 19d — Exterior Windows and Skylights Costs',
  description: 'Costs for exterior windows and skylights meeting ENERGY STAR Most Efficient certification. Credit capped at $600 total.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.windowsSkylights',
  defaultValue: 0,
};

/** Central A/C ($600 cap) */
const line20a_centralAC: NodeDefinition = {
  id: `${FORM_ID}.joint.line20a_centralAC`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 20a — Central Air Conditioner Costs',
  description: 'Costs for central air conditioner meeting highest efficiency tier (CEE Tier 3 for split systems or Tier 2 for package units). Credit capped at $600.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.centralAC',
  defaultValue: 0,
};

/** Natural gas/propane/oil water heater ($600 cap) */
const line20b_gasWaterHeater: NodeDefinition = {
  id: `${FORM_ID}.joint.line20b_gasWaterHeater`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 20b — Gas/Propane/Oil Water Heater Costs',
  description: 'Costs for natural gas, propane, or oil water heater meeting highest efficiency tier. Credit capped at $600.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.gasWaterHeater',
  defaultValue: 0,
};

/** Natural gas/propane/oil furnace/boiler ($600 cap) */
const line20c_gasFurnace: NodeDefinition = {
  id: `${FORM_ID}.joint.line20c_gasFurnace`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 20c — Gas/Propane/Oil Furnace or Hot Water Boiler Costs',
  description: 'Costs for natural gas, propane, or oil furnace or hot water boiler meeting highest efficiency tier (AFUE ≥ 97%). Credit capped at $600.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.gasFurnace',
  defaultValue: 0,
};

/** Electric panel / enabling property ($600 cap) */
const line25c_electricPanel: NodeDefinition = {
  id: `${FORM_ID}.joint.line25c_electricPanel`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 25c — Electrical Panel / Enabling Property Costs (×30%)',
  description: 'Costs for main electric panel or sub-panel upgrades that enable installation of a separate qualifying energy property (heat pump, EV charger, etc.). Both enabling and enabled property must be installed in 2025. Credit capped at $600. QMID required.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.electricPanel',
  defaultValue: 0,
};

/** Home energy audit ($150 cap) */
const line26b_homeEnergyAudit: NodeDefinition = {
  id: `${FORM_ID}.joint.line26b_homeEnergyAudit`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 26b — Home Energy Audit Costs',
  description: 'Costs for a home energy audit by a certified auditor including written report. Credit is 30% of cost, capped at $150.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.homeEnergyAudit',
  defaultValue: 0,
};

/** Heat pumps + heat pump water heaters ($2,000 separate cap) */
const line22a_heatPumps: NodeDefinition = {
  id: `${FORM_ID}.joint.line22a_heatPumps`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 22a — Heat Pump / Heat Pump Water Heater Costs',
  description: 'Costs for electric or natural gas heat pumps and heat pump water heaters meeting CEE highest efficiency tier. Part of the $2,000 separate annual cap (combined with biomass). QMID required.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.heatPumps',
  defaultValue: 0,
};

/** Biomass stoves/boilers ($2,000 separate cap, combined with heat pumps) */
const line23a_biomass: NodeDefinition = {
  id: `${FORM_ID}.joint.line23a_biomass`,
  kind: NodeKind.INPUT,
  label: 'Form 5695 Line 23a — Biomass Stove / Boiler Costs',
  description: 'Costs for biomass stoves or boilers with thermal efficiency ≥ 75% (HHV). Part of the $2,000 separate annual cap (combined with heat pumps). QMID required.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  source: InputSource.PREPARER,
  questionId: 'f5695.q.biomass',
  defaultValue: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// PART II COMPUTED — §25C Credit Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bucket A subtotal — improvements subject to $1,200 overall cap.
 * Sub-limits applied per-category before the $1,200 cap.
 */
const bucketA_subtotal: NodeDefinition = {
  id: `${FORM_ID}.joint.bucketA_subtotal`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 — §25C Bucket A Subtotal (Before $1,200 Cap)',
  description: 'Sum of 30% credits for each Bucket A improvement after per-category sub-limits: insulation (no sub-limit), doors ($500 max), windows ($600 max), A/C ($600 max), gas water heater ($600 max), gas furnace ($600 max), electric panel ($600 max), audit ($150 max).',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line18a_insulation`,
    `${FORM_ID}.joint.line19a_exteriorDoors`,
    `${FORM_ID}.joint.line19d_windowsSkylights`,
    `${FORM_ID}.joint.line20a_centralAC`,
    `${FORM_ID}.joint.line20b_gasWaterHeater`,
    `${FORM_ID}.joint.line20c_gasFurnace`,
    `${FORM_ID}.joint.line25c_electricPanel`,
    `${FORM_ID}.joint.line26b_homeEnergyAudit`,
  ],
  compute: (ctx) => {
    const c   = getF5695Constants(ctx.taxYear);
    const sl  = c.partII.subLimits;
    const r   = c.partII.rate;

    const insulation  = safeNum(ctx.get(`${FORM_ID}.joint.line18a_insulation`)) * r;
    const doors       = Math.min(safeNum(ctx.get(`${FORM_ID}.joint.line19a_exteriorDoors`)) * r, sl.exteriorDoorTotal);
    const windows     = Math.min(safeNum(ctx.get(`${FORM_ID}.joint.line19d_windowsSkylights`)) * r, sl.windowsSkylights);
    const ac          = Math.min(safeNum(ctx.get(`${FORM_ID}.joint.line20a_centralAC`)) * r, sl.centralAC);
    const waterHeater = Math.min(safeNum(ctx.get(`${FORM_ID}.joint.line20b_gasWaterHeater`)) * r, sl.waterHeater);
    const furnace     = Math.min(safeNum(ctx.get(`${FORM_ID}.joint.line20c_gasFurnace`)) * r, sl.furnaceBoiler);
    const panel       = Math.min(safeNum(ctx.get(`${FORM_ID}.joint.line25c_electricPanel`)) * r, sl.electricPanel);
    const audit       = Math.min(safeNum(ctx.get(`${FORM_ID}.joint.line26b_homeEnergyAudit`)) * r, sl.homeEnergyAudit);

    return insulation + doors + windows + ac + waterHeater + furnace + panel + audit;
  },
};

/**
 * Line 28 — §25C Bucket A credit (capped at $1,200)
 */
const line28_bucketA: NodeDefinition = {
  id: `${FORM_ID}.joint.line28_bucketA`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 Line 28 — §25C Bucket A Credit (≤ $1,200)',
  description: 'Bucket A improvements credit after the $1,200 annual overall cap.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [`${FORM_ID}.joint.bucketA_subtotal`],
  compute: (ctx) => {
    const c       = getF5695Constants(ctx.taxYear);
    const subtotal = safeNum(ctx.get(`${FORM_ID}.joint.bucketA_subtotal`));
    return Math.min(subtotal, c.partII.overallCap);
  },
};

/**
 * Lines 29–30 — §25C Bucket B credit (heat pumps + biomass, capped at $2,000)
 */
const line30_bucketB: NodeDefinition = {
  id: `${FORM_ID}.joint.line30_bucketB`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 Lines 29–30 — §25C Bucket B Credit (Heat Pumps + Biomass, ≤ $2,000)',
  description: '30% of heat pump and biomass costs combined, capped at $2,000 per year.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line22a_heatPumps`,
    `${FORM_ID}.joint.line23a_biomass`,
  ],
  compute: (ctx) => {
    const c          = getF5695Constants(ctx.taxYear);
    const heatPumps  = safeNum(ctx.get(`${FORM_ID}.joint.line22a_heatPumps`));
    const biomass    = safeNum(ctx.get(`${FORM_ID}.joint.line23a_biomass`));
    const bucketBRaw = (heatPumps + biomass) * c.partII.rate;
    return Math.min(bucketBRaw, c.partII.heatPumpBiomassCap);
  },
};

/**
 * §25C Tentative total = Bucket A + Bucket B (max $3,200)
 */
const partII_tentative: NodeDefinition = {
  id: `${FORM_ID}.joint.partII_tentative`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 — §25C Tentative Total (Bucket A + Bucket B)',
  description: 'Combined §25C credit from both buckets: up to $1,200 (Bucket A) + up to $2,000 (Bucket B) = maximum $3,200. Subject to tax liability limit.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: [
    `${FORM_ID}.joint.line28_bucketA`,
    `${FORM_ID}.joint.line30_bucketB`,
  ],
  compute: (ctx) => {
    return safeNum(ctx.get(`${FORM_ID}.joint.line28_bucketA`)) +
           safeNum(ctx.get(`${FORM_ID}.joint.line30_bucketB`));
  },
};

/**
 * Line 31 — Tax liability limit for §25C
 * Nonrefundable, NO carryforward.
 */
const line31_taxLimitPartII: NodeDefinition = {
  id: `${FORM_ID}.joint.line31_taxLimitPartII`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 Line 31 — §25C Tax Liability Limit',
  description: 'Maximum nonrefundable §25C credit. Unused §25C does NOT carry forward — it is permanently lost.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['intermediate'],
  dependencies: ['f1040.joint.line24_totalTax'],
  compute: (ctx) => Math.max(0, safeNum(ctx.get('f1040.joint.line24_totalTax'))),
};

/**
 * Line 32 — §25C Allowed Credit (→ Schedule 3 Line 5b)
 * min(tentative, tax liability limit). No carryforward.
 */
const line32_partIICredit: NodeDefinition = {
  id: `${FORM_ID}.joint.line32_partIICredit`,
  kind: NodeKind.COMPUTED,
  label: 'Form 5695 Line 32 — §25C Energy Efficient Home Improvement Credit (→ Sched. 3 Line 5b)',
  description: 'Final §25C credit. Smaller of tentative (Bucket A + B) and tax liability limit. Flows to Schedule 3 Line 5b. No carryforward — OBBBA ended the program after 2025.',
  valueType: NodeValueType.CURRENCY,
  allowNegative: false,
  owner: NodeOwner.JOINT,
  repeatable: false,
  applicableTaxYears: APPLICABLE_YEARS,
  classifications: ['credit.nonrefundable'],
  dependencies: [
    `${FORM_ID}.joint.partII_tentative`,
    `${FORM_ID}.joint.line31_taxLimitPartII`,
  ],
  compute: (ctx) => {
    const tentative = safeNum(ctx.get(`${FORM_ID}.joint.partII_tentative`));
    const taxLimit  = safeNum(ctx.get(`${FORM_ID}.joint.line31_taxLimitPartII`));
    return Math.min(tentative, taxLimit);
  },
  isApplicable: (ctx) => {
    const a = safeNum(ctx.get(`${FORM_ID}.joint.line18a_insulation`)) +
              safeNum(ctx.get(`${FORM_ID}.joint.line19a_exteriorDoors`)) +
              safeNum(ctx.get(`${FORM_ID}.joint.line19d_windowsSkylights`)) +
              safeNum(ctx.get(`${FORM_ID}.joint.line20a_centralAC`)) +
              safeNum(ctx.get(`${FORM_ID}.joint.line20b_gasWaterHeater`)) +
              safeNum(ctx.get(`${FORM_ID}.joint.line20c_gasFurnace`)) +
              safeNum(ctx.get(`${FORM_ID}.joint.line25c_electricPanel`)) +
              safeNum(ctx.get(`${FORM_ID}.joint.line26b_homeEnergyAudit`));
    const b = safeNum(ctx.get(`${FORM_ID}.joint.line22a_heatPumps`)) +
              safeNum(ctx.get(`${FORM_ID}.joint.line23a_biomass`));
    return a + b > 0;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registration order:
 *   engine.registerNodes([
 *     ...F1040_NODES,
 *     ...F8812_NODES, ...F2441_NODES, ...F8863_NODES,
 *     ...F5695_NODES,              // ← new
 *     ...SCHEDULE3_NODES,
 *     ...F1040_PAYMENT_NODES,
 *   ]);
 *
 * SCHEDULE 3 WIRING UPDATE REQUIRED:
 *   The existing Schedule 3 Line 5 node must be split into:
 *     Line 5  → reads F5695_OUTPUTS.partICredit   (§25D clean energy)
 *     Line 5b → reads F5695_OUTPUTS.partIICredit  (§25C efficiency)
 *   Both count against the Schedule 3 Line 8 total.
 */
export const F5695_NODES: NodeDefinition[] = [
  // Part I inputs (§25D)
  line1_solarElectric,
  line2_solarWater,
  line3_smallWind,
  line4_geothermal,
  line5a_batteryStorage,
  line7a_fuelCell,
  line12_carryforward,
  // Part I computed
  line6a_creditBase,
  line13_tentativeTotal,
  line14_taxLimitPartI,
  line15_partICredit,
  line16_carryforwardTo2026,
  // Part II inputs (§25C)
  line18a_insulation,
  line19a_exteriorDoors,
  line19d_windowsSkylights,
  line20a_centralAC,
  line20b_gasWaterHeater,
  line20c_gasFurnace,
  line25c_electricPanel,
  line26b_homeEnergyAudit,
  line22a_heatPumps,
  line23a_biomass,
  // Part II computed
  bucketA_subtotal,
  line28_bucketA,
  line30_bucketB,
  partII_tentative,
  line31_taxLimitPartII,
  line32_partIICredit,
];

export const F5695_OUTPUTS = {
  /** §25D Residential Clean Energy Credit → Schedule 3 Line 5 */
  partICredit:    `${FORM_ID}.joint.line15_partICredit`,
  /** §25C Energy Efficient Home Improvement Credit → Schedule 3 Line 5b */
  partIICredit:   `${FORM_ID}.joint.line32_partIICredit`,
  /** §25D Carryforward to 2026 — informational */
  carryforward:   `${FORM_ID}.joint.line16_carryforwardTo2026`,
} as const;