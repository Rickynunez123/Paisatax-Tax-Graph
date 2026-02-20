/**
 * FORM 5695 — RESIDENTIAL ENERGY CREDITS
 * Constants for tax year 2025
 *
 * Sources:
 *   IRS Form 5695 Instructions (2025) — IRS.gov/instructions/i5695
 *   IRS Form 5695 (2025) — IRS.gov/pub/irs-pdf/f5695.pdf
 *   IRC §25D — Residential Clean Energy Credit
 *   IRC §25C — Energy Efficient Home Improvement Credit
 *   One Big Beautiful Bill Act (OBBBA), signed July 4, 2025
 *
 * ─── LEGISLATIVE CONTEXT ────────────────────────────────────────────────────
 *   The OBBBA accelerated expiration of BOTH credits to December 31, 2025.
 *   2025 is the LAST tax year these credits can be claimed.
 *   Property must be "placed in service" (installed and operational) by 12/31/2025.
 *
 * ─── PART I: RESIDENTIAL CLEAN ENERGY CREDIT (§25D) ────────────────────────
 *   Rate:                     30% of qualified costs
 *   Qualified property types:
 *     - Solar electric (photovoltaic panels)
 *     - Solar water heating
 *     - Small wind energy
 *     - Geothermal heat pump
 *     - Battery storage technology (≥3 kWh capacity)
 *     - Fuel cell (limited: $500 per ½ kW capacity)
 *   No annual dollar cap (except fuel cell)
 *   Fuel cell cap:            $500 per ½ kilowatt of capacity
 *   Nonrefundable, but CARRYFORWARD allowed to 2026 if credit exceeds tax
 *   → Flows to Schedule 3 Line 5
 *
 * ─── PART II: ENERGY EFFICIENT HOME IMPROVEMENT CREDIT (§25C) ───────────────
 *   Rate:                     30% of qualified costs
 *   Overall annual cap:       $1,200 (applies to most improvements combined)
 *   Separate annual cap:      $2,000 (heat pumps, heat pump water heaters,
 *                                     biomass stoves/boilers)
 *   The $2,000 bucket is IN ADDITION to the $1,200 bucket — max total: $3,200
 *
 *   Sub-limits within the $1,200 bucket:
 *     Insulation/air sealing: No sub-limit (just 30%, under $1,200 overall)
 *     Exterior doors:         $250 per door, $500 total
 *     Windows/skylights:      $600 total
 *     Central A/C:            $600 total
 *     Natural gas/propane/oil water heaters: $600 total
 *     Natural gas/propane/oil furnaces/boilers: $600 total
 *     Electrical panels:      $600 total (enabling property for heat pumps)
 *     Home energy audit:      $150 (30% of cost)
 *   Nonrefundable, NO carryforward (use it or lose it)
 *   → Flows to Schedule 3 Line 5b (combined with §25D via Credit Limit Worksheet)
 *   Actually: §25C flows to Form 5695 Line 32 → Schedule 3 Line 5b separately
 *   §25D flows to Form 5695 Line 15 → Schedule 3 Line 5
 *
 * IMPORTANT SCHEDULE 3 WIRING:
 *   Schedule 3 Line 5  = §25D (Part I residential clean energy)
 *   Schedule 3 Line 5b = §25C (Part II energy efficient home improvement)
 *   Both go to different Schedule 3 lines!
 *
 * 2025 QMID REQUIREMENT (new):
 *   For §25C property placed in service in 2025, a 4-character alphanumeric
 *   Qualified Manufacturer Identification Number (QMID) is required per item.
 *   This is a documentation/preparer requirement — not a computational node.
 */

export interface F5695Constants {
  taxYear: string

  /** Part I — §25D Residential Clean Energy Credit */
  partI: {
    rate:              number  // 0.30 (30%)
    fuelCellCapPer05kW: number  // $500 per ½ kW of fuel cell capacity
    hasCarryforward:   boolean // true — unused credit carries to 2026
  }

  /** Part II — §25C Energy Efficient Home Improvement Credit */
  partII: {
    rate:                   number  // 0.30 (30%)
    /** $1,200 overall annual cap (most improvements) */
    overallCap:             number  // $1,200
    /** $2,000 separate annual cap (heat pumps, biomass) */
    heatPumpBiomassCap:     number  // $2,000
    /** Sub-limits within the $1,200 bucket */
    subLimits: {
      exteriorDoorPerDoor:  number  // $250 per door
      exteriorDoorTotal:    number  // $500 (max 2 doors at $250 each effectively)
      windowsSkylights:     number  // $600
      centralAC:            number  // $600
      waterHeater:          number  // $600 (gas/propane/oil)
      furnaceBoiler:        number  // $600 (gas/propane/oil)
      electricPanel:        number  // $600 (enabling property)
      homeEnergyAudit:      number  // $150
    }
    hasCarryforward:        boolean // false — no carryforward for §25C
  }
}

export const F5695_CONSTANTS_2025: F5695Constants = {
  taxYear: '2025',

  partI: {
    rate:                0.30,
    fuelCellCapPer05kW:   500,
    hasCarryforward:     true,
  },

  partII: {
    rate:                0.30,
    overallCap:          1_200,
    heatPumpBiomassCap:  2_000,
    subLimits: {
      exteriorDoorPerDoor: 250,
      exteriorDoorTotal:   500,
      windowsSkylights:    600,
      centralAC:           600,
      waterHeater:         600,
      furnaceBoiler:       600,
      electricPanel:       600,
      homeEnergyAudit:     150,
    },
    hasCarryforward:     false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS INDEX
// ─────────────────────────────────────────────────────────────────────────────

const CONSTANTS_BY_YEAR: Record<string, F5695Constants> = {
  '2025': F5695_CONSTANTS_2025,
};

export function getF5695Constants(taxYear: string): F5695Constants {
  const c = CONSTANTS_BY_YEAR[taxYear];
  if (!c) {
    throw new Error(
      `Form 5695 constants not available for tax year '${taxYear}'. ` +
      `Supported years: ${Object.keys(CONSTANTS_BY_YEAR).join(', ')}.`,
    );
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the §25D (Residential Clean Energy) tentative credit.
 *
 * Simple: 30% of total qualified costs.
 * The only complexity is fuel cell which has a per-kW cap — handled separately.
 *
 * @param solarElectricCosts    Solar PV panel costs
 * @param solarWaterCosts       Solar water heating costs
 * @param smallWindCosts        Small wind energy costs
 * @param geothermalCosts       Geothermal heat pump costs
 * @param batteryStorageCosts   Battery storage technology costs
 * @param fuelCellCosts         Qualified fuel cell costs (ALREADY capped by caller)
 * @param carryforwardFrom2024  Prior year unused credit carryforward
 * @param c                     Constants
 */
export function computePartITentative(
  solarElectricCosts:   number,
  solarWaterCosts:      number,
  smallWindCosts:       number,
  geothermalCosts:      number,
  batteryStorageCosts:  number,
  fuelCellCosts:        number,
  carryforwardFrom2024: number,
  c:                    F5695Constants,
): number {
  const totalCosts = solarElectricCosts + solarWaterCosts + smallWindCosts +
                     geothermalCosts + batteryStorageCosts + fuelCellCosts;
  return (totalCosts * c.partI.rate) + carryforwardFrom2024;
}

/**
 * Compute the §25C (Energy Efficient Home Improvement) credit.
 *
 * Two-bucket system:
 *   Bucket A ($1,200 overall cap): insulation + envelope improvements + audits
 *   Bucket B ($2,000 separate cap): heat pumps + biomass
 *
 * Sub-limits within Bucket A are enforced per category.
 * Total credit = min(bucketA, $1,200) + min(bucketB, $2,000)
 * Maximum combined = $3,200
 *
 * Note: Sub-limits within bucket A are applied BEFORE the $1,200 overall cap.
 *
 * @param insulation            Insulation/air sealing materials (30%, no sub-limit)
 * @param exteriorDoors         Exterior door costs (30%, $250/door, $500 total)
 * @param windowsSkylights      Window/skylight costs (30%, $600 cap)
 * @param centralAC             Central A/C costs (30%, $600 cap)
 * @param gasWaterHeater        Natural gas/propane/oil water heater (30%, $600 cap)
 * @param gasFurnaceBoiler      Natural gas/propane/oil furnace/boiler (30%, $600 cap)
 * @param electricPanel         Electrical panel upgrade (30%, $600 cap)
 * @param homeEnergyAudit       Home energy audit (30%, $150 cap)
 * @param heatPumps             Heat pumps + heat pump water heaters (30%, $2,000 cap)
 * @param biomassStoviersBoilers Biomass stoves/boilers (30%, part of $2,000 cap)
 * @param c                     Constants
 */
export function computePartIICredit(
  insulation:            number,
  exteriorDoors:         number,
  windowsSkylights:      number,
  centralAC:             number,
  gasWaterHeater:        number,
  gasFurnaceBoiler:      number,
  electricPanel:         number,
  homeEnergyAudit:       number,
  heatPumps:             number,
  biomassStovesBoilers:  number,
  c:                     F5695Constants,
): { bucketA: number; bucketB: number; total: number } {
  const sl = c.partII.subLimits;
  const rate = c.partII.rate;

  // ── Bucket A: $1,200 overall cap ──
  // Each item: compute 30%, then apply sub-limit
  const insulationCredit  = insulation     * rate;   // no sub-limit
  const doorsCredit       = Math.min(exteriorDoors * rate, sl.exteriorDoorTotal);
  const windowsCredit     = Math.min(windowsSkylights * rate, sl.windowsSkylights);
  const acCredit          = Math.min(centralAC * rate, sl.centralAC);
  const waterHeaterCredit = Math.min(gasWaterHeater * rate, sl.waterHeater);
  const furnaceCredit     = Math.min(gasFurnaceBoiler * rate, sl.furnaceBoiler);
  const panelCredit       = Math.min(electricPanel * rate, sl.electricPanel);
  const auditCredit       = Math.min(homeEnergyAudit * rate, sl.homeEnergyAudit);

  const bucketARaw = insulationCredit + doorsCredit + windowsCredit +
                     acCredit + waterHeaterCredit + furnaceCredit +
                     panelCredit + auditCredit;
  const bucketA = Math.min(bucketARaw, c.partII.overallCap);

  // ── Bucket B: $2,000 separate cap ──
  const heatPumpCredit  = heatPumps * rate;
  const biomassCredit   = biomassStovesBoilers * rate;
  const bucketB = Math.min(heatPumpCredit + biomassCredit, c.partII.heatPumpBiomassCap);

  return {
    bucketA,
    bucketB,
    total: bucketA + bucketB,
  };
}