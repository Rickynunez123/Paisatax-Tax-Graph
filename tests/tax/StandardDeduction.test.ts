/**
 * FORM 1040 — STANDARD DEDUCTION AND TAXABLE INCOME TESTS
 *
 * Tests Form 1040 Lines 12 and 15: the standard deduction and taxable income.
 *
 * Coverage:
 *   Suite 1 — Base deduction by filing status (all five statuses, both years)
 *   Suite 2 — Additional deduction: age 65+ (single, married, stacking)
 *   Suite 3 — Additional deduction: blindness (stacking with age)
 *   Suite 4 — Dependent filer formula (IRC §63(c)(5))
 *   Suite 5 — Taxable income = AGI - Line 12 - Line 13
 *   Suite 6 — Full vertical slice: income → AGI → deduction → taxable income
 *   Suite 7 — Reactivity (changing filing status, age, income mid-session)
 *   Suite 8 — Edge cases (AGI floor, deduction > AGI, 2024 vs 2025 constants)
 */

import { TaxGraphEngineImpl } from '../../src/core/graph/engine';
import { F8889_NODES }        from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }        from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES } from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }    from '../../src/tax/forms/schedule2/nodes';
import { F1040_NODES, F1040_OUTPUTS } from '../../src/tax/forms/f1040/nodes';
import { InputEventSource }   from '../../src/core/graph/engine.types';
import { NodeStatus }         from '../../src/core/graph/node.types';
import type { InputEvent }    from '../../src/core/graph/engine.types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ALL_NODES = [
  ...F8889_NODES, ...F5329_NODES,
  ...SCHEDULE1_NODES, ...SCHEDULE2_NODES, ...F1040_NODES,
];

function makeEngine() {
  const e = new TaxGraphEngineImpl();
  e.registerNodes(ALL_NODES);
  return e;
}

function makeEvent(id: string, value: string | number | boolean): InputEvent {
  return { instanceId: id, value, source: InputEventSource.PREPARER, timestamp: new Date().toISOString() };
}

function session(
  events:       { id: string; value: string | number | boolean }[],
  filingStatus: string = 'single',
  taxYear:      string = '2025',
) {
  const engine  = makeEngine();
  const ctx     = { taxYear, filingStatus, hasSpouse: filingStatus === 'married_filing_jointly' };
  let result    = engine.initializeSession({ ...ctx, sessionKey: `test#${taxYear}` });
  for (const e of events) {
    result = engine.process(makeEvent(e.id, e.value), result.currentState, ctx);
  }
  return result.currentState;
}

// Multi-step helper that allows filing status mid-session change
function sessionEngine(filingStatus = 'single', taxYear = '2025') {
  const engine = makeEngine();
  const ctx    = { taxYear, filingStatus, hasSpouse: filingStatus === 'married_filing_jointly' };
  let state    = engine.initializeSession({ ...ctx, sessionKey: `test#${taxYear}` }).currentState;
  const apply  = (id: string, value: string | number | boolean, newStatus?: string) => {
    const c2 = newStatus ? { ...ctx, filingStatus: newStatus, hasSpouse: newStatus === 'married_filing_jointly' } : ctx;
    state = engine.process(makeEvent(id, value), state, c2).currentState;
  };
  const get    = (id: string) => state[id];
  const num    = (id: string) => state[id]?.value as number;
  const status = (id: string) => state[id]?.status;
  return { apply, get, num, status };
}

// Node shorthands
const F = {
  // ✅ INPUT (write here)
  otherIncome: "schedule1.joint.line3_businessIncome",

  // ✅ COMPUTED (read-only assertions)
  totalIncome: "f1040.joint.line9_totalIncome",

  primaryAge: "f1040.joint.line12input_primaryAge",
  primaryBlind: "f1040.joint.line12input_primaryBlind",
  spouseAge: "f1040.joint.line12input_spouseAge",
  spouseBlind: "f1040.joint.line12input_spouseBlind",
  isDependent: "f1040.joint.line12input_isDependentFiler",
  earnedIncome: "f1040.joint.line12input_earnedIncome",
  deduction: "f1040.joint.line12_deduction",
  qbi: "f1040.joint.line13_qbiDeduction",
  taxableIncome: "f1040.joint.line15_taxableIncome",
  agi: "f1040.joint.line11_adjustedGrossIncome",
};


const num  = (state: ReturnType<typeof session>, id: string) => state[id]?.value as number;
const stat = (state: ReturnType<typeof session>, id: string) => state[id]?.status;

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — BASE DEDUCTION BY FILING STATUS
// ─────────────────────────────────────────────────────────────────────────────

describe('Standard Deduction — Base Amount by Filing Status', () => {

  // 2025 base amounts: single $15,000 | MFJ $30,000 | MFS $15,000
  //                   HOH $22,500    | QSS $30,000
  const cases2025: [string, number][] = [
    ['single',                        15_000],
    ['married_filing_jointly',        30_000],
    ['married_filing_separately',     15_000],
    ['head_of_household',             22_500],
    ['qualifying_surviving_spouse',   30_000],
  ];

  for (const [fs, expected] of cases2025) {
    test(`2025 ${fs}: base deduction = $${expected.toLocaleString()}`, () => {
      const state = session([{ id: F.otherIncome, value: 100_000 }], fs);
      expect(num(state, F.deduction)).toBe(expected);
    });
  }

  // 2024 base amounts: single $14,600 | MFJ $29,200 | MFS $14,600
  //                   HOH $21,900    | QSS $29,200
  const cases2024: [string, number][] = [
    ['single',                        14_600],
    ['married_filing_jointly',        29_200],
    ['married_filing_separately',     14_600],
    ['head_of_household',             21_900],
    ['qualifying_surviving_spouse',   29_200],
  ];

  for (const [fs, expected] of cases2024) {
    test(`2024 ${fs}: base deduction = $${expected.toLocaleString()}`, () => {
      const state = session(
        [{ id: F.otherIncome, value: 100_000 }],
        fs,
        "2024",
      );
      expect(num(state, F.deduction)).toBe(expected);
    });
  }

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — ADDITIONAL DEDUCTION: AGE 65+
// ─────────────────────────────────────────────────────────────────────────────

describe('Standard Deduction — Additional Amount: Age 65+', () => {

  test('Single filer, age 65 — one additional unit ($2,000)', () => {
    // Base $15,000 + $2,000 = $17,000
    const state = session([
      { id: F.otherIncome, value: 80_000 },
      { id: F.primaryAge, value: 65 },
    ]);
    expect(num(state, F.deduction)).toBe(17_000);
  });

  test('Single filer, age 64 — no additional amount', () => {
    // Base $15,000 only
    const state = session([
      { id: F.otherIncome, value: 80_000 },
      { id: F.primaryAge, value: 64 },
    ]);
    expect(num(state, F.deduction)).toBe(15_000);
  });

  test('Single filer, age 65 exactly at boundary', () => {
    const state = session([
      { id: F.otherIncome, value: 50_000 },
      { id: F.primaryAge, value: 65 },
    ]);
    expect(num(state, F.deduction)).toBe(17_000);
  });

  test('HOH filer, age 70 — single rate additional ($2,000)', () => {
    // Base $22,500 + $2,000 = $24,500
    const state = session(
      [
        { id: F.otherIncome, value: 80_000 },
        { id: F.primaryAge, value: 70 },
      ],
      "head_of_household",
    );
    expect(num(state, F.deduction)).toBe(24_500);
  });

  test('MFJ, primary age 68 — one married-rate additional ($1,600)', () => {
    // Base $30,000 + $1,600 = $31,600
    const state = session(
      [
        { id: F.otherIncome, value: 100_000 },
        { id: F.primaryAge, value: 68 },
      ],
      "married_filing_jointly",
    );
    expect(num(state, F.deduction)).toBe(31_600);
  });

  test('MFJ, both spouses age 66 — two married-rate additionals ($3,200)', () => {
    // Base $30,000 + $1,600 × 2 = $33,200
    const state = session(
      [
        { id: F.otherIncome, value: 100_000 },
        { id: F.primaryAge, value: 66 },
        { id: F.spouseAge, value: 67 },
      ],
      "married_filing_jointly",
    );
    expect(num(state, F.deduction)).toBe(33_200);
  });

  test('MFJ, only one spouse age 65 — one additional', () => {
    // Base $30,000 + $1,600 = $31,600
    const state = session(
      [
        { id: F.otherIncome, value: 100_000 },
        { id: F.primaryAge, value: 65 },
        { id: F.spouseAge, value: 62 }, // under 65
      ],
      "married_filing_jointly",
    );
    expect(num(state, F.deduction)).toBe(31_600);
  });

  test('2024: single age 65 gets $1,950 additional (not $2,000)', () => {
    // 2024 single additional = $1,950
    const state = session(
      [
        { id: F.otherIncome, value: 80_000 },
        { id: F.primaryAge, value: 65 },
      ],
      "single",
      "2024",
    );
    expect(num(state, F.deduction)).toBe(16_550); // $14,600 + $1,950
  });

  test('2024: MFJ both 65+ get $1,550 each ($3,100 total additional)', () => {
    const state = session(
      [
        { id: F.otherIncome, value: 100_000 },
        { id: F.primaryAge, value: 67 },
        { id: F.spouseAge, value: 66 },
      ],
      "married_filing_jointly",
      "2024",
    );
    expect(num(state, F.deduction)).toBe(32_300); // $29,200 + $3,100
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — ADDITIONAL DEDUCTION: BLINDNESS
// ─────────────────────────────────────────────────────────────────────────────

describe('Standard Deduction — Additional Amount: Blindness', () => {

  test('Single filer, blind — one additional ($2,000)', () => {
    const state = session([
      { id: F.otherIncome, value: 60_000 },
      { id: F.primaryBlind, value: true },
    ]);
    expect(num(state, F.deduction)).toBe(17_000); // $15,000 + $2,000
  });

  test('Single filer, age 66 AND blind — two additionals ($4,000)', () => {
    // Age 65+ = +1, blind = +1 → 2 × $2,000 = $4,000 additional
    const state = session([
      { id: F.otherIncome, value: 60_000 },
      { id: F.primaryAge, value: 66 },
      { id: F.primaryBlind, value: true },
    ]);
    expect(num(state, F.deduction)).toBe(19_000); // $15,000 + $4,000
  });

  test('MFJ, primary blind — one married-rate additional ($1,600)', () => {
    const state = session(
      [
        { id: F.otherIncome, value: 100_000 },
        { id: F.primaryBlind, value: true },
      ],
      "married_filing_jointly",
    );
    expect(num(state, F.deduction)).toBe(31_600); // $30,000 + $1,600
  });

  test('MFJ, primary age 65 AND blind, spouse age 65 — three additionals ($4,800)', () => {
    // Primary: age 65 +1, blind +1 = 2 units
    // Spouse:  age 65 +1 = 1 unit
    // Total: 3 × $1,600 = $4,800
    const state = session(
      [
        { id: F.otherIncome, value: 100_000 },
        { id: F.primaryAge, value: 65 },
        { id: F.primaryBlind, value: true },
        { id: F.spouseAge, value: 65 },
      ],
      "married_filing_jointly",
    );
    expect(num(state, F.deduction)).toBe(34_800); // $30,000 + $4,800
  });

  test('MFJ, both age 65+ AND both blind — four additionals ($6,400)', () => {
    // Maximum possible: 4 × $1,600 = $6,400
    const state = session(
      [
        { id: F.otherIncome, value: 100_000 },
        { id: F.primaryAge, value: 70 },
        { id: F.primaryBlind, value: true },
        { id: F.spouseAge, value: 68 },
        { id: F.spouseBlind, value: true },
      ],
      "married_filing_jointly",
    );
    expect(num(state, F.deduction)).toBe(36_400); // $30,000 + $6,400
  });

  test('Spouse blind but filing status is single — spouse blind input has no effect', () => {
    // Single filer: spouse inputs should be ignored
    // Even if preparer accidentally enters spouseBlind = true, it should not add
    // an additional unit because single filers have no spouse
    const state = session(
      [
        { id: F.otherIncome, value: 60_000 },
        { id: F.spouseBlind, value: true }, // entered in error
      ],
      "single",
    );
    expect(num(state, F.deduction)).toBe(15_000); // no change from base
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — DEPENDENT FILER FORMULA (IRC §63(c)(5))
// ─────────────────────────────────────────────────────────────────────────────

describe('Standard Deduction — Dependent Filer Formula', () => {

  // 2025 constants: flatMinimum = $1,350, earnedIncomeAdder = $450
  // Formula: max($1,350, min(earnedIncome + $450, base))

  test('Dependent with zero earned income — gets flat minimum ($1,350)', () => {
    // max($1,350, min($0 + $450, $15,000)) = max($1,350, $450) = $1,350
    const state = session([
      { id: F.otherIncome, value: 0 },
      { id: F.isDependent, value: true },
      { id: F.earnedIncome, value: 0 },
    ]);
    expect(num(state, F.deduction)).toBe(1_350);
  });

  test('Dependent with earned income $800 — still gets flat minimum', () => {
    // max($1,350, min($800 + $450, $15,000)) = max($1,350, $1,250) = $1,350
    const state = session([
      { id: F.otherIncome, value: 10_000 },
      { id: F.isDependent, value: true },
      { id: F.earnedIncome, value: 800 },
    ]);
    expect(num(state, F.deduction)).toBe(1_350);
  });

  test('Dependent with earned income $1,000 — gets $1,450 (earned + adder)', () => {
    // max($1,350, min($1,000 + $450, $15,000)) = max($1,350, $1,450) = $1,450
    const state = session([
      { id: F.otherIncome, value: 10_000 },
      { id: F.isDependent, value: true },
      { id: F.earnedIncome, value: 1_000 },
    ]);
    expect(num(state, F.deduction)).toBe(1_450);
  });

  test('Dependent with earned income $5,000 — gets $5,450', () => {
    // max($1,350, min($5,000 + $450, $15,000)) = max($1,350, $5,450) = $5,450
    const state = session([
      { id: F.otherIncome, value: 15_000 },
      { id: F.isDependent, value: true },
      { id: F.earnedIncome, value: 5_000 },
    ]);
    expect(num(state, F.deduction)).toBe(5_450);
  });

  test('Dependent with earned income $20,000 — capped at normal base ($15,000)', () => {
    // max($1,350, min($20,000 + $450, $15,000)) = max($1,350, $15,000) = $15,000
    const state = session([
      { id: F.otherIncome, value: 30_000 },
      { id: F.isDependent, value: true },
      { id: F.earnedIncome, value: 20_000 },
    ]);
    expect(num(state, F.deduction)).toBe(15_000);
  });

  test('Dependent filer age 66 — age additions do NOT apply', () => {
    // Non-dependent at 66: $15,000 + $2,000 = $17,000
    // Dependent at 66 (earned income $0): max($1,350, $450) = $1,350
    // The age/blind additions are irrelevant for dependent filers
    const state = session([
      { id: F.otherIncome, value: 5_000 },
      { id: F.isDependent, value: true },
      { id: F.primaryAge, value: 66 },
      { id: F.earnedIncome, value: 0 },
    ]);
    expect(num(state, F.deduction)).toBe(1_350); // NOT $17,000
  });

  test('Clearing dependent status restores normal deduction', () => {
    const s = sessionEngine('single');
    s.apply(F.otherIncome, 30_000);
    s.apply(F.isDependent,  true);
    s.apply(F.earnedIncome, 0);
    expect(s.num(F.deduction)).toBe(1_350);  // dependent formula

    // Preparer corrects — taxpayer is not actually a dependent
    s.apply(F.isDependent, false);
    expect(s.num(F.deduction)).toBe(15_000); // normal single deduction
  });

  test('2024 dependent flat minimum is $1,300 (not $1,350)', () => {
    // 2024: flatMinimum = $1,300, earnedIncomeAdder = $450
    const state = session(
      [
        { id: F.otherIncome, value: 5_000 },
        { id: F.isDependent, value: true },
        { id: F.earnedIncome, value: 0 },
      ],
      "single",
      "2024",
    );
    expect(num(state, F.deduction)).toBe(1_300);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — TAXABLE INCOME (Line 15 = AGI - Line 12 - Line 13)
// ─────────────────────────────────────────────────────────────────────────────

describe('Standard Deduction — Taxable Income (Line 15)', () => {

  test('Taxable income = total income - standard deduction (no adjustments)', () => {
    // Income $60,000, no AGI adjustments, single → deduction $15,000
    // Taxable income = $60,000 - $15,000 = $45,000
    const state = session([{ id: F.otherIncome, value: 60_000 }]);
    expect(num(state, F.agi)).toBe(60_000);
    expect(num(state, F.deduction)).toBe(15_000);
    expect(num(state, F.taxableIncome)).toBe(45_000);
  });

  test('Taxable income accounts for above-the-line HSA deduction', () => {
    // Income $75,000, HSA deduction $4,300 → AGI $70,700
    // Standard deduction (single) $15,000
    // Taxable income = $70,700 - $15,000 = $55,700
    const state = session([
      { id: F.otherIncome, value: 75_000 },
      { id: "f8889.primary.line1_coverageType", value: "self_only" },
      { id: "f8889.primary.line2_personalContributions", value: 4_300 },
      { id: "f8889.primary.line4input_ageAsOfDec31", value: 40 },
    ]);
    expect(num(state, F.agi)).toBe(70_700);
    expect(num(state, F.deduction)).toBe(15_000);
    expect(num(state, F.taxableIncome)).toBe(55_700);
  });

  test('QBI deduction further reduces taxable income', () => {
    // AGI $60,000, standard deduction $15,000, QBI $5,000 (manual)
    // Taxable income = $60,000 - $15,000 - $5,000 = $40,000
    const state = session([
      { id: F.otherIncome, value: 60_000 },
      { id: F.qbi, value: 5_000 },
    ]);
    expect(num(state, F.taxableIncome)).toBe(40_000);
  });

  test('Taxable income cannot go below zero', () => {
    // Low income filer: $5,000 income, single, standard deduction $15,000
    // $5,000 - $15,000 = -$10,000 → floored at 0
    const state = session([{ id: F.otherIncome, value: 5_000 }]);
    expect(num(state, F.taxableIncome)).toBe(0);
  });

  test('MFJ taxable income uses $30,000 standard deduction', () => {
    // Income $100,000, MFJ, standard $30,000
    // Taxable = $100,000 - $30,000 = $70,000
    const state = session(
      [{ id: F.otherIncome, value: 100_000 }],
      "married_filing_jointly",
    );
    expect(num(state, F.deduction)).toBe(30_000);
    expect(num(state, F.taxableIncome)).toBe(70_000);
  });

  test('Age 65+ single: higher deduction lowers taxable income further', () => {
    // Income $60,000, age 66, single
    // Standard = $15,000 + $2,000 = $17,000
    // Taxable = $60,000 - $17,000 = $43,000
    const state = session([
      { id: F.otherIncome, value: 60_000 },
      { id: F.primaryAge, value: 66 },
    ]);
    expect(num(state, F.deduction)).toBe(17_000);
    expect(num(state, F.taxableIncome)).toBe(43_000);
  });

  test('Node is CLEAN and status is accessible', () => {
    const state = session([{ id: F.otherIncome, value: 60_000 }]);
    expect(stat(state, F.taxableIncome)).toBe(NodeStatus.CLEAN);
    expect(stat(state, F.deduction)).toBe(NodeStatus.CLEAN);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6 — FULL VERTICAL SLICE
// Income → AGI → Standard Deduction → Taxable Income
// ─────────────────────────────────────────────────────────────────────────────

describe('Standard Deduction — Full Vertical Slice', () => {

  test('Maria, 67, single — complete return to taxable income', () => {
    /**
     * Maria, 67, single, not a dependent.
     * W-2 wages: $48,000
     * HSA contribution: $4,300 (self-only, fully deductible)
     * Not blind.
     *
     * Expected:
     *   AGI = $48,000 - $4,300 = $43,700
     *   Standard deduction = $15,000 (base) + $2,000 (age 67) = $17,000
     *   Taxable income = $43,700 - $17,000 = $26,700
     */
    const state = session([
      { id: F.otherIncome, value: 48_000 },
      { id: "f8889.primary.line1_coverageType", value: "self_only" },
      { id: "f8889.primary.line2_personalContributions", value: 4_300 },
      { id: "f8889.primary.line4input_ageAsOfDec31", value: 67 },
      { id: F.primaryAge, value: 67 }, // used for std ded
    ]);

    expect(num(state, F.agi)).toBe(43_700);
    expect(num(state, F.deduction)).toBe(17_000);
    expect(num(state, F.taxableIncome)).toBe(26_700);
  });

  test('David and Lisa, MFJ, both 66 — joint return to taxable income', () => {
    /**
     * David and Lisa, MFJ, both age 66.
     * Combined income: $120,000
     * No above-the-line deductions.
     *
     * Expected:
     *   AGI = $120,000 (no adjustments)
     *   Standard deduction = $30,000 (base) + $1,600 × 2 (both 66) = $33,200
     *   Taxable income = $120,000 - $33,200 = $86,800
     */
    const state = session(
      [
        { id: F.otherIncome, value: 120_000 },
        { id: F.primaryAge, value: 66 },
        { id: F.spouseAge, value: 66 },
      ],
      "married_filing_jointly",
    );

    expect(num(state, F.agi)).toBe(120_000);
    expect(num(state, F.deduction)).toBe(33_200);
    expect(num(state, F.taxableIncome)).toBe(86_800);
  });

  test('Carlos, 20, college student, claimed as dependent', () => {
    /**
     * Carlos, 20, single, claimed on parents' return.
     * Part-time job: $4,000 in wages (= earned income).
     * No investment income.
     *
     * Expected:
     *   AGI = $4,000 (no adjustments)
     *   Standard deduction = max($1,350, min($4,000 + $450, $15,000)) = $4,450
     *   Taxable income = $4,000 - $4,450 = max(0, -$450) = $0
     *
     * (His deduction exceeds his income — zero taxable income)
     */
    const state = session([
      { id: F.otherIncome, value: 4_000 },
      { id: F.isDependent, value: true },
      { id: F.earnedIncome, value: 4_000 },
    ]);

    expect(num(state, F.deduction)).toBe(4_450);
    expect(num(state, F.taxableIncome)).toBe(0);
  });

  test('F1040_OUTPUTS.taxableIncome points to the correct node', () => {
    const state = session([{ id: F.otherIncome, value: 60_000 }]);
    expect(state[F1040_OUTPUTS.taxableIncome]).toBeDefined();
    expect(state[F1040_OUTPUTS.taxableIncome]?.value).toBe(45_000);
  });

  test('F1040_OUTPUTS.standardDeduction points to the correct node', () => {
    const state = session([{ id: F.otherIncome, value: 60_000 }]);
    expect(state[F1040_OUTPUTS.standardDeduction]).toBeDefined();
    expect(state[F1040_OUTPUTS.standardDeduction]?.value).toBe(15_000);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7 — REACTIVITY
// ─────────────────────────────────────────────────────────────────────────────

describe('Standard Deduction — Reactivity', () => {

  test('Turning 65 mid-session adds $2,000 to deduction and reduces taxable income', () => {
    const s = sessionEngine('single');
    s.apply(F.otherIncome, 60_000);
    s.apply(F.primaryAge, 64);   // not yet 65

    expect(s.num(F.deduction)).toBe(15_000);
    expect(s.num(F.taxableIncome)).toBe(45_000);

    s.apply(F.primaryAge, 65);   // now qualifies

    expect(s.num(F.deduction)).toBe(17_000);
    expect(s.num(F.taxableIncome)).toBe(43_000);
  });

  test('Becoming blind mid-session adds additional deduction', () => {
    const s = sessionEngine('single');
    s.apply(F.otherIncome, 60_000);
    s.apply(F.primaryBlind, false);

    expect(s.num(F.deduction)).toBe(15_000);

    s.apply(F.primaryBlind, true);
    expect(s.num(F.deduction)).toBe(17_000);
    expect(s.num(F.taxableIncome)).toBe(43_000);
  });

  test('Increasing income raises taxable income but not the deduction', () => {
    const s = sessionEngine('single');
    s.apply(F.otherIncome, 50_000);
    expect(s.num(F.taxableIncome)).toBe(35_000); // 50000 - 15000

    s.apply(F.otherIncome, 80_000);
    expect(s.num(F.deduction)).toBe(15_000);     // deduction unchanged
    expect(s.num(F.taxableIncome)).toBe(65_000); // 80000 - 15000
  });

  test('Switching from single to MFJ doubles standard deduction', () => {
    // This requires re-running the session with a new filing status context
    const single = session([{ id: F.otherIncome, value: 100_000 }], "single");
    const mfj = session(
      [{ id: F.otherIncome, value: 100_000 }],
      "married_filing_jointly",
    );

    expect(num(single, F.deduction)).toBe(15_000);
    expect(num(mfj,    F.deduction)).toBe(30_000);
    expect(num(single, F.taxableIncome)).toBe(85_000);
    expect(num(mfj,    F.taxableIncome)).toBe(70_000);
  });

  test('Setting isDependent = true then adding earned income updates deduction reactively', () => {
    const s = sessionEngine('single');
    s.apply(F.otherIncome, 8_000);
    s.apply(F.isDependent,  true);
    s.apply(F.earnedIncome, 0);

    // Zero earned income → flat minimum $1,350
    expect(s.num(F.deduction)).toBe(1_350);

    // Add part-time job income
    s.apply(F.earnedIncome, 3_000);
    // max($1,350, min($3,000 + $450, $15,000)) = max($1,350, $3,450) = $3,450
    expect(s.num(F.deduction)).toBe(3_450);
    expect(s.num(F.taxableIncome)).toBe(4_550); // 8000 - 3450
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 8 — EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('Standard Deduction — Edge Cases', () => {

  test('Zero income: taxable income = 0 (deduction floors at zero, not negative)', () => {
    const state = session([{ id: F.otherIncome, value: 0 }]);
    expect(num(state, F.taxableIncome)).toBe(0);
  });

  test('Income exactly equal to standard deduction: taxable income = 0', () => {
    const state = session([{ id: F.otherIncome, value: 15_000 }]);
    expect(num(state, F.deduction)).toBe(15_000);
    expect(num(state, F.taxableIncome)).toBe(0);
  });

  test('Income one dollar over standard deduction: taxable income = $1', () => {
    const state = session([{ id: F.otherIncome, value: 15_001 }]);
    expect(num(state, F.taxableIncome)).toBe(1);
  });

  test('MFJ, both 65+ blind: maximum possible deduction = $30,000 + $6,400 = $36,400', () => {
    const state = session(
      [
        { id: F.otherIncome, value: 200_000 },
        { id: F.primaryAge, value: 72 },
        { id: F.primaryBlind, value: true },
        { id: F.spouseAge, value: 69 },
        { id: F.spouseBlind, value: true },
      ],
      "married_filing_jointly",
    );
    // 4 units × $1,600 = $6,400 additional
    expect(num(state, F.deduction)).toBe(36_400);
    expect(num(state, F.taxableIncome)).toBe(163_600);
  });

  test('Dependent with high earned income is capped at normal base, not additional', () => {
    // A dependent age 67 with $50,000 earned income:
    // The cap is the BASE deduction ($15,000), NOT the base + age additional ($17,000)
    // Per IRS Pub 501, the cap for dependents is the BASIC standard deduction,
    // and the age/blind additions do not apply.
    const state = session([
      { id: F.otherIncome, value: 50_000 },
      { id: F.isDependent, value: true },
      { id: F.primaryAge, value: 67 },
      { id: F.earnedIncome, value: 50_000 },
    ]);
    // max($1,350, min($50,000 + $450, $15,000)) = $15,000 (capped at base)
    expect(num(state, F.deduction)).toBe(15_000);
  });

  test('Primary age 0 (not entered): no additional deduction', () => {
    // Default age is 0 — no additional deduction triggered
    const state = session([{ id: F.otherIncome, value: 60_000 }]);
    expect(num(state, F.deduction)).toBe(15_000);
  });

  test('QBI deduction of $0 has no effect on taxable income', () => {
    const withQbi = session([
      { id: F.otherIncome, value: 60_000 },
      { id: F.qbi, value: 0 },
    ]);
    const withoutQbi = session([{ id: F.otherIncome, value: 60_000 }]);
    expect(num(withQbi, F.taxableIncome)).toBe(num(withoutQbi, F.taxableIncome));
  });

});