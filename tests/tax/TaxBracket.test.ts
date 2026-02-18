/**
 * FORM 1040 LINE 16 -- REGULAR INCOME TAX (BRACKET CALCULATION)
 *
 * Tests three layers:
 *
 *   Suite 1 -- computeTax() pure function (bracket math)
 *     Verifies the raw bracket algorithm against hand-calculated and
 *     IRS-published amounts. No engine needed -- just the function.
 *
 *   Suite 2 -- Line 16 node in the engine
 *     Verifies the node reads Line 15, calls computeTax(), and the
 *     result is reactive to changes in filing status and taxable income.
 *
 *   Suite 3 -- Line 24 total tax (Line 16 + Line 17)
 *     Full end-to-end: income -> AGI -> standard deduction ->
 *     taxable income -> tax -> total tax with penalties.
 *
 *   Suite 4 -- All filing statuses (2025)
 *     Spot-checks one income level per filing status to ensure the
 *     right bracket table is selected for each.
 *
 *   Suite 5 -- 2024 vs 2025 bracket differences
 *     Confirms that the two years use different thresholds and that
 *     the engine respects the session taxYear.
 *
 *   Suite 6 -- Bracket boundary precision
 *     Tests exact bracket floors, the $1 above boundary, and the
 *     rounding behavior for cents.
 *
 *   Suite 7 -- Reactivity
 *     Filing status change mid-session, income change, AGI deduction
 *     cascading through to Line 16.
 *
 *   Suite 8 -- Complete return scenarios
 *     Full persona scenarios exercising the entire chain.
 */

import {
  computeTax,
  getF1040Constants,
  F1040_CONSTANTS_2024,
  F1040_CONSTANTS_2025,
} from '../../src/tax/forms/f1040/constants/index';

import { TaxGraphEngineImpl }              from '../../src/core/graph/engine';
import { F8889_NODES }                     from '../../src/tax/forms/f8889/nodes';
import { F5329_NODES }                     from '../../src/tax/forms/f5329/nodes';
import { SCHEDULE1_NODES }                 from '../../src/tax/forms/schedule1/nodes';
import { SCHEDULE2_NODES }                 from '../../src/tax/forms/schedule2/nodes';
import { F1040_NODES, F1040_OUTPUTS }      from '../../src/tax/forms/f1040/nodes';
import { InputEventSource }                from '../../src/core/graph/engine.types';
import { NodeStatus }                      from '../../src/core/graph/node.types';
import type { InputEvent }                 from '../../src/core/graph/engine.types';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

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
  filingStatus = 'single',
  taxYear      = '2025',
) {
  const engine = makeEngine();
  const ctx    = { taxYear, filingStatus, hasSpouse: filingStatus === 'married_filing_jointly' };
  let result   = engine.initializeSession({ ...ctx, sessionKey: `test#${taxYear}` });
  for (const e of events) {
    result = engine.process(makeEvent(e.id, e.value), result.currentState, ctx);
  }
  return result.currentState;
}

function sessionEngine(filingStatus = 'single', taxYear = '2025') {
  const engine = makeEngine();
  const ctx    = { taxYear, filingStatus, hasSpouse: filingStatus === 'married_filing_jointly' };
  let state    = engine.initializeSession({ ...ctx, sessionKey: `test#${taxYear}` }).currentState;

  const apply = (id: string, value: string | number | boolean, newStatus?: string, newYear?: string) => {
    const fs = newStatus ?? filingStatus;
    const ty = newYear  ?? taxYear;
    const c2 = { taxYear: ty, filingStatus: fs, hasSpouse: fs === 'married_filing_jointly' };
    state = engine.process(makeEvent(id, value), state, c2).currentState;
  };
  const num    = (id: string) => state[id]?.value as number;
  const status = (id: string) => state[id]?.status;
  return { apply, num, status };
}

// Node ID shorthands
const N = {
  income:        'f1040.joint.line9_totalIncome',
  primaryAge:    'f1040.joint.line12input_primaryAge',
  deduction:     'f1040.joint.line12_deduction',
  taxableIncome: 'f1040.joint.line15_taxableIncome',
  tax:           'f1040.joint.line16_tax',
  totalTax:      'f1040.joint.line24_totalTax',
  additionalTax: 'f1040.joint.line17_additionalTaxes',
};

const num  = (state: ReturnType<typeof session>, id: string) => state[id]?.value as number;
const stat = (state: ReturnType<typeof session>, id: string) => state[id]?.status;

// Manual computation helper for test assertions
const c25 = F1040_CONSTANTS_2025;
const c24 = F1040_CONSTANTS_2024;

// ---------------------------------------------------------------------------
// SUITE 1 -- computeTax() PURE FUNCTION
// ---------------------------------------------------------------------------

describe('computeTax() -- Pure Bracket Calculation Function', () => {

  // ── Zero and negative ────────────────────────────────────────────────────

  test('Zero taxable income returns zero tax', () => {
    expect(computeTax(0, 'single', c25)).toBe(0);
  });

  test('Negative taxable income returns zero tax', () => {
    expect(computeTax(-1_000, 'single', c25)).toBe(0);
  });

  // ── Single 2025 bracket boundaries ──────────────────────────────────────

  test('Single $11,925: exactly at top of 10% bracket = $1,192.50', () => {
    // 10% * $11,925 = $1,192.50
    expect(computeTax(11_925, 'single', c25)).toBe(1_192.50);
  });

  test('Single $11,926: first dollar in 12% bracket', () => {
    // $1,192.50 + 12% * $1 = $1,192.62
    expect(computeTax(11_926, 'single', c25)).toBe(1_192.62);
  });

  test('Single $48,475: exactly at top of 12% bracket = $5,578.50', () => {
    // $1,192.50 + 12% * ($48,475 - $11,925)
    // = $1,192.50 + 12% * $36,550 = $1,192.50 + $4,386 = $5,578.50
    expect(computeTax(48_475, 'single', c25)).toBe(5_578.50);
  });

  test('Single $60,000: straddles 10%/12%/22% brackets', () => {
    // $5,578.50 + 22% * ($60,000 - $48,475)
    // = $5,578.50 + 22% * $11,525 = $5,578.50 + $2,535.50 = $8,114.00
    expect(computeTax(60_000, 'single', c25)).toBe(8_114.00);
  });

  test('Single $103,350: exactly at top of 22% bracket = $17,651.00', () => {
    // Published base-tax at $103,350 floor (exactly equals the IRS table entry)
    expect(computeTax(103_350, 'single', c25)).toBe(17_651.00);
  });

  test('Single $150,000: in 24% bracket', () => {
    // $17,651 + 24% * ($150,000 - $103,350)
    // = $17,651 + 24% * $46,650 = $17,651 + $11,196 = $28,847
    expect(computeTax(150_000, 'single', c25)).toBe(28_847.00);
  });

  test('Single $250,525: exactly at top of 32% bracket = $57,231.00', () => {
    expect(computeTax(250_525, 'single', c25)).toBe(57_231.00);
  });

  test('Single $300,000: in 35% bracket', () => {
    // $57,231 + 35% * ($300,000 - $250,525)
    // = $57,231 + 35% * $49,475 = $57,231 + $17,316.25 = $74,547.25
    expect(computeTax(300_000, 'single', c25)).toBe(74_547.25);
  });

  test('Single $626,350: exactly at top of 35% bracket = $188,769.75', () => {
    expect(computeTax(626_350, 'single', c25)).toBe(188_769.75);
  });

  test('Single $700,000: in 37% bracket', () => {
    // $188,769.75 + 37% * ($700,000 - $626,350)
    // = $188,769.75 + 37% * $73,650 = $188,769.75 + $27,250.50 = $216,020.25
    expect(computeTax(700_000, 'single', c25)).toBe(216_020.25);
  });

  // ── MFJ 2025 ─────────────────────────────────────────────────────────────

  test('MFJ $23,850: exactly at top of 10% bracket = $2,385.00', () => {
    expect(computeTax(23_850, 'married_filing_jointly', c25)).toBe(2_385.00);
  });

  test('MFJ $100,000: in 22% bracket', () => {
    // $11,157 + 22% * ($100,000 - $96,950)
    // = $11,157 + 22% * $3,050 = $11,157 + $671 = $11,828
    expect(computeTax(100_000, 'married_filing_jointly', c25)).toBe(11_828.00);
  });

  test('MFJ $200,000: in 22% bracket (just under 24% floor)', () => {
    // 24% bracket starts at $206,700
    // $11,157 + 22% * ($200,000 - $96,950) = $11,157 + 22% * $103,050
    // = $11,157 + $22,671 = $33,828
    expect(computeTax(200_000, 'married_filing_jointly', c25)).toBe(33_828.00);
  });

  test('MFJ $751,600: exactly at top of 35% bracket = $202,154.50', () => {
    expect(computeTax(751_600, 'married_filing_jointly', c25)).toBe(202_154.50);
  });

  // ── HOH 2025 ─────────────────────────────────────────────────────────────

  test('HOH $50,000: in 12% bracket', () => {
    // $1,700 + 12% * ($50,000 - $17,000) = $1,700 + $3,960 = $5,660
    expect(computeTax(50_000, 'head_of_household', c25)).toBe(5_660.00);
  });

  test('HOH $80,000: in 22% bracket', () => {
    // $7,442 + 22% * ($80,000 - $64,850) = $7,442 + $3,333 = $10,775
    expect(computeTax(80_000, 'head_of_household', c25)).toBe(10_775.00);
  });

  // ── MFS 2025 -- 37% hits at $375,800 (half of MFJ ~$751,600) ─────────────

  test('MFS $100,000: same as single (tables identical up to $197,300)', () => {
    expect(computeTax(100_000, 'married_filing_separately', c25))
      .toBe(computeTax(100_000, 'single', c25));
  });

  test('MFS $375,800: top of 35% bracket = $101,077.25', () => {
    expect(computeTax(375_800, 'married_filing_separately', c25)).toBe(101_077.25);
  });

  test('MFS $400,000: in 37% bracket (diverges from single here)', () => {
    // $101,077.25 + 37% * ($400,000 - $375,800)
    // = $101,077.25 + 37% * $24,200 = $101,077.25 + $8,954 = $110,031.25
    expect(computeTax(400_000, 'married_filing_separately', c25)).toBe(110_031.25);
  });

  // Single at $400,000 should be in 35%, not 37% (37% only kicks in at $626,350)
  test('Single $400,000: still in 35% bracket (37% not until $626,350)', () => {
    // $57,231 + 35% * ($400,000 - $250,525) = $57,231 + $52,316.25 = $109,547.25
    expect(computeTax(400_000, 'single', c25)).toBe(109_547.25);
    // Confirm MFS > single at same income (MFS bracket is tighter)
    expect(computeTax(400_000, 'married_filing_separately', c25))
      .toBeGreaterThan(computeTax(400_000, 'single', c25));
  });

  // ── QSS uses MFJ table ────────────────────────────────────────────────────

  test('QSS produces same result as MFJ at every income level tested', () => {
    const incomes = [50_000, 100_000, 300_000, 500_000, 800_000];
    for (const inc of incomes) {
      expect(computeTax(inc, 'qualifying_surviving_spouse', c25))
        .toBe(computeTax(inc, 'married_filing_jointly', c25));
    }
  });

  // ── Rounding to nearest cent ───────────────────────────────────────────────

  test('Tax rounds to nearest cent (not truncated)', () => {
    // Single $11,925.50:
    // $11,925.50 is just past the 10%/12% boundary ($11,925), so 12% applies to $0.50 excess.
    // $1,192.50 + 12% * ($11,925.50 - $11,925) = $1,192.50 + $0.06 = $1,192.56
    expect(computeTax(11_925.50, 'single', c25)).toBe(1_192.56);
  });

  test('2024 single $11,600: exactly at top of 10% bracket = $1,160', () => {
    // 2024: 10% bracket top is $11,600
    expect(computeTax(11_600, 'single', c24)).toBe(1_160.00);
  });

});

// ---------------------------------------------------------------------------
// SUITE 2 -- LINE 16 NODE IN THE ENGINE
// ---------------------------------------------------------------------------

describe('Form 1040 Line 16 -- Tax Node (Engine)', () => {

  test('Line 16 computes from Line 15 (taxable income)', () => {
    // Income $60,000, single, no adjustments
    // Taxable income = $60,000 - $15,000 = $45,000
    // Tax: $5,578.50 + 22% * ($45,000 - $48,475) -- WAIT: $45,000 < $48,475
    // Actually $45,000 is in 12% bracket:
    // $1,192.50 + 12% * ($45,000 - $11,925) = $1,192.50 + $3,969 = $5,161.50
    const state = session([{ id: N.income, value: 60_000 }]);
    expect(num(state, N.taxableIncome)).toBe(45_000);
    expect(num(state, N.tax)).toBe(5_161.50);
  });

  test('Line 16 status is CLEAN after computation', () => {
    const state = session([{ id: N.income, value: 60_000 }]);
    expect(stat(state, N.tax)).toBe(NodeStatus.CLEAN);
  });

  test('Line 16 = 0 when taxable income is 0', () => {
    // Income $5,000, single, standard deduction $15,000 -> taxable income 0
    const state = session([{ id: N.income, value: 5_000 }]);
    expect(num(state, N.taxableIncome)).toBe(0);
    expect(num(state, N.tax)).toBe(0);
  });

  test('Line 16 updates reactively when income changes', () => {
    const s = sessionEngine('single');
    s.apply(N.income, 60_000);
    const tax1 = s.num(N.tax);

    s.apply(N.income, 80_000);
    const tax2 = s.num(N.tax);

    expect(tax2).toBeGreaterThan(tax1);
    // At $80,000 income: taxable = $65,000
    // $5,578.50 + 22% * ($65,000 - $48,475) = $5,578.50 + $3,635.50 = $9,214
    expect(s.num(N.taxableIncome)).toBe(65_000);
    expect(tax2).toBe(9_214.00);
  });

  test('HSA deduction reduces taxable income and tax', () => {
    // Income $75,000, single, HSA contribution $4,300 -> AGI $70,700
    // Taxable = $70,700 - $15,000 = $55,700
    // Tax: $5,578.50 + 22% * ($55,700 - $48,475) = $5,578.50 + $1,589.50 = $7,168
    const state = session([
      { id: N.income,                                    value: 75_000 },
      { id: 'f8889.primary.line1_coverageType',           value: 'self_only' },
      { id: 'f8889.primary.line2_personalContributions',  value: 4_300 },
      { id: 'f8889.primary.line4input_ageAsOfDec31',      value: 40 },
    ]);
    expect(num(state, 'f1040.joint.line11_adjustedGrossIncome')).toBe(70_700);
    expect(num(state, N.taxableIncome)).toBe(55_700);
    expect(num(state, N.tax)).toBe(7_168.00);
  });

  test('Age 65+ standard deduction reduces taxable income and tax', () => {
    // Income $60,000, age 67, single
    // Standard deduction = $15,000 + $2,000 = $17,000
    // Taxable = $60,000 - $17,000 = $43,000
    // Tax: $1,192.50 + 12% * ($43,000 - $11,925) = $1,192.50 + $3,729 = $4,921.50
    const state = session([
      { id: N.income,     value: 60_000 },
      { id: N.primaryAge, value: 67 },
    ]);
    expect(num(state, N.deduction)).toBe(17_000);
    expect(num(state, N.taxableIncome)).toBe(43_000);
    expect(num(state, N.tax)).toBe(4_921.50);
  });

});

// ---------------------------------------------------------------------------
// SUITE 3 -- LINE 24 TOTAL TAX (LINE 16 + LINE 17)
// ---------------------------------------------------------------------------

describe('Form 1040 Line 24 -- Total Tax (Regular + Additional)', () => {

  test('No penalties: total tax = regular tax', () => {
    const state = session([{ id: N.income, value: 60_000 }]);
    expect(num(state, N.tax)).toBe(num(state, N.totalTax));
  });

  test('Total tax = regular tax + HSA excess penalty', () => {
    // Income $60,000, over-contribute to HSA by $1,000
    // Penalty = 6% * $1,000 = $60
    const state = session([
      { id: N.income,                                    value: 60_000 },
      { id: 'f8889.primary.line1_coverageType',           value: 'self_only' },
      { id: 'f8889.primary.line2_personalContributions',  value: 5_300 }, // $1,000 over limit
      { id: 'f8889.primary.line4input_ageAsOfDec31',      value: 40 },
    ]);

    const regularTax = num(state, N.tax);
    const penalty    = num(state, N.additionalTax);
    const total      = num(state, N.totalTax);

    expect(penalty).toBe(60);
    expect(total).toBe(regularTax + 60);
  });

  test('F1040_OUTPUTS.totalTax node equals line16 + line17', () => {
    const state = session([{ id: N.income, value: 100_000 }]);
    const line16 = num(state, N.tax);
    const line17 = num(state, N.additionalTax) ?? 0;
    expect(num(state, F1040_OUTPUTS.totalTax)).toBe(line16 + line17);
  });

});

// ---------------------------------------------------------------------------
// SUITE 4 -- ALL FILING STATUSES (2025)
// ---------------------------------------------------------------------------

describe('Line 16 -- All Filing Statuses at $80,000 Taxable Income', () => {

  // At $80,000 taxable income, each filing status picks a different bracket.
  // We test that the correct table is used for each.

  test('Single $80,000 taxable income', () => {
    // $5,578.50 + 22% * ($80,000 - $48,475) = $5,578.50 + $6,935.50 = $12,514
    expect(computeTax(80_000, 'single', c25)).toBe(12_514.00);
  });

  test('MFJ $80,000 taxable income', () => {
    // In 12% bracket (12% tops at $96,950)
    // $2,385 + 12% * ($80,000 - $23,850) = $2,385 + $6,738 = $9,123
    expect(computeTax(80_000, 'married_filing_jointly', c25)).toBe(9_123.00);
  });

  test('MFS $80,000 taxable income (same as single through this range)', () => {
    expect(computeTax(80_000, 'married_filing_separately', c25))
      .toBe(computeTax(80_000, 'single', c25));
  });

  test('HOH $80,000 taxable income', () => {
    // $7,442 + 22% * ($80,000 - $64,850) = $7,442 + $3,333 = $10,775
    expect(computeTax(80_000, 'head_of_household', c25)).toBe(10_775.00);
  });

  test('QSS $80,000 taxable income (same as MFJ)', () => {
    expect(computeTax(80_000, 'qualifying_surviving_spouse', c25))
      .toBe(computeTax(80_000, 'married_filing_jointly', c25));
  });

  test('MFJ has lower tax than single at same income (marriage benefit)', () => {
    // At high incomes, MFJ has broader brackets
    expect(computeTax(200_000, 'married_filing_jointly', c25))
      .toBeLessThan(computeTax(200_000, 'single', c25));
  });

  test('Engine uses correct bracket for each filing status (integration)', () => {
    // Single
    const single = session([{ id: N.income, value: 100_000 }], 'single');
    // MFJ
    const mfj    = session([{ id: N.income, value: 100_000 }], 'married_filing_jointly');
    // HOH
    const hoh    = session([{ id: N.income, value: 100_000 }], 'head_of_household');

    // After standard deduction:
    // Single: taxable = 100,000 - 15,000 = 85,000
    // MFJ:   taxable = 100,000 - 30,000 = 70,000
    // HOH:   taxable = 100,000 - 22,500 = 77,500

    expect(num(single, N.taxableIncome)).toBe(85_000);
    expect(num(mfj,    N.taxableIncome)).toBe(70_000);
    expect(num(hoh,    N.taxableIncome)).toBe(77_500);

    // All three should be different tax amounts
    const taxSingle = num(single, N.tax);
    const taxMFJ    = num(mfj,    N.tax);
    const taxHOH    = num(hoh,    N.tax);

    expect(taxSingle).toBeGreaterThan(taxMFJ);
    expect(taxSingle).toBeGreaterThan(taxHOH);
    expect(taxMFJ).toBeLessThan(taxHOH);

    // Manual verification:
    // Single $85,000:  $5,578.50 + 22% * ($85,000 - $48,475) = $5,578.50 + $8,035.50 = $13,614
    expect(taxSingle).toBe(13_614.00);
    // MFJ $70,000: $2,385 + 12% * ($70,000 - $23,850) = $2,385 + $5,538 = $7,923
    expect(taxMFJ).toBe(7_923.00);
    // HOH $77,500: $7,442 + 22% * ($77,500 - $64,850) = $7,442 + $2,783 = $10,225
    expect(taxHOH).toBe(10_225.00);
  });

});

// ---------------------------------------------------------------------------
// SUITE 5 -- 2024 vs 2025 BRACKET DIFFERENCES
// ---------------------------------------------------------------------------

describe('Line 16 -- Tax Year Differences (2024 vs 2025)', () => {

  test('2024 and 2025 have different 10% bracket tops (single)', () => {
    // 2024: 10% bracket ends at $11,600
    // 2025: 10% bracket ends at $11,925
    expect(computeTax(11_600, 'single', c24)).toBe(1_160.00);  // top of 2024 10%
    expect(computeTax(11_600, 'single', c25)).toBe(1_160.00);  // still in 10% in 2025

    // $11,925 is the 2025 top; for 2024 this falls into 12%
    expect(computeTax(11_925, 'single', c25)).toBe(1_192.50);  // exactly at 2025 top
    const tax24_at11925 = computeTax(11_925, 'single', c24);
    // 2024: $1,160 + 12% * ($11,925 - $11,600) = $1,160 + $39 = $1,199
    expect(tax24_at11925).toBe(1_199.00);
    // 2025 filer pays less at $11,925 (still in 10% bracket)
    expect(computeTax(11_925, 'single', c25)).toBeLessThan(tax24_at11925);
  });

  test('2025 filer pays less tax than 2024 filer at same income (inflation adjustment)', () => {
    // The 2025 brackets are wider, so the same nominal income falls into lower brackets
    const income = 80_000;
    const tax25  = computeTax(income, 'single', c25);
    const tax24  = computeTax(income, 'single', c24);
    expect(tax25).toBeLessThan(tax24);
  });

  test('2024 engine session uses 2024 brackets', () => {
    const state24 = session([{ id: N.income, value: 80_000 }], 'single', '2024');
    const state25 = session([{ id: N.income, value: 80_000 }], 'single', '2025');
    // 2024 standard deduction is $14,600, so taxable = $65,400
    // 2025 standard deduction is $15,000, so taxable = $65,000
    expect(num(state24, N.taxableIncome)).toBe(65_400);
    expect(num(state25, N.taxableIncome)).toBe(65_000);
    // Tax differs for both reasons: different deductions AND different brackets
    expect(num(state24, N.tax)).toBeGreaterThan(num(state25, N.tax));
  });

  test('2024 MFJ top threshold is $731,200 (lower than 2025s $751,600)', () => {
    // At exactly $731,200 taxable:
    // 2024: exactly at top of 35% bracket ($196,669.50)
    // 2025: still in 35% bracket (37% doesnt start until $751,600)
    expect(computeTax(731_200, 'married_filing_jointly', c24)).toBe(196_669.50);
    // In 2025 at the same income: $114,462 + 35% * ($731,200 - $501,050)
    // = $114,462 + 35% * $230,150 = $114,462 + $80,552.50 = $195,014.50
    expect(computeTax(731_200, 'married_filing_jointly', c25)).toBe(195_014.50);
  });

});

// ---------------------------------------------------------------------------
// SUITE 6 -- BRACKET BOUNDARY PRECISION
// ---------------------------------------------------------------------------

describe('Line 16 -- Bracket Boundary Precision', () => {

  test('Dollar exactly at bracket floor uses the new rate', () => {
    // $48,475 is the single 22% bracket floor in 2025
    // computeTax at exactly $48,475 should use base-tax $5,578.50 (22% rate, 0 excess)
    expect(computeTax(48_475, 'single', c25)).toBe(5_578.50);
  });

  test('Dollar below bracket floor still uses previous rate', () => {
    // $48,474: still in 12% bracket
    // $1,192.50 + 12% * ($48,474 - $11,925) = $1,192.50 + $4,385.88 = $5,578.38
    expect(computeTax(48_474, 'single', c25)).toBe(5_578.38);
  });

  test('Large income in top bracket (single $1M)', () => {
    // $188,769.75 + 37% * ($1,000,000 - $626,350)
    // = $188,769.75 + 37% * $373,650 = $188,769.75 + $138,250.50 = $327,020.25
    expect(computeTax(1_000_000, 'single', c25)).toBe(327_020.25);
  });

  test('Income of $1 produces $0.10 tax (10% of $1)', () => {
    expect(computeTax(1, 'single', c25)).toBe(0.10);
  });

});

// ---------------------------------------------------------------------------
// SUITE 7 -- REACTIVITY
// ---------------------------------------------------------------------------

describe('Line 16 -- Reactivity', () => {

  test('Increasing income pushes into higher bracket', () => {
    const s = sessionEngine('single');

    // Start in 12% bracket
    s.apply(N.income, 40_000);  // taxable = 25,000 -> in 12%
    const tax1 = s.num(N.tax);

    // Push into 22% bracket
    s.apply(N.income, 80_000);  // taxable = 65,000 -> in 22%
    const tax2 = s.num(N.tax);

    expect(tax2).toBeGreaterThan(tax1);
    // Tax on $25,000: $1,192.50 + 12% * ($25,000 - $11,925) = $1,192.50 + $1,569 = $2,761.50
    expect(tax1).toBe(2_761.50);
    // Tax on $65,000: $5,578.50 + 22% * ($65,000 - $48,475) = $5,578.50 + $3,635.50 = $9,214
    expect(tax2).toBe(9_214.00);
  });

  test('Adding HSA deduction updates taxable income, brackets, and tax', () => {
    const s = sessionEngine('single');
    s.apply(N.income, 55_000);  // taxable = 40,000 (12% bracket)
    const taxBefore = s.num(N.tax);

    // Add HSA deduction -- drops taxable income further into 12% bracket
    s.apply('f8889.primary.line1_coverageType',          'self_only');
    s.apply('f8889.primary.line2_personalContributions', 4_300);
    s.apply('f8889.primary.line4input_ageAsOfDec31',     40);
    // Now AGI = $55,000 - $4,300 = $50,700; taxable = $50,700 - $15,000 = $35,700
    const taxAfter = s.num(N.tax);

    expect(taxAfter).toBeLessThan(taxBefore);
    // Tax on $35,700: $1,192.50 + 12% * ($35,700 - $11,925) = $1,192.50 + $2,853 = $4,045.50
    expect(taxAfter).toBe(4_045.50);
  });

  test('Standard deduction change (age 65) propagates through to Line 16', () => {
    const s = sessionEngine('single');
    s.apply(N.income, 60_000);

    // Without age 65+: deduction = $15,000, taxable = $45,000
    const taxBefore = s.num(N.tax);
    // Tax on $45,000: $1,192.50 + 12% * ($45,000 - $11,925) = $1,192.50 + $3,969 = $5,161.50
    expect(taxBefore).toBe(5_161.50);

    // Preparer enters age 67
    s.apply(N.primaryAge, 67);
    // Deduction = $17,000, taxable = $43,000
    const taxAfter = s.num(N.tax);
    // Tax on $43,000: $1,192.50 + 12% * ($43,000 - $11,925) = $1,192.50 + $3,729 = $4,921.50
    expect(taxAfter).toBe(4_921.50);
    expect(taxAfter).toBeLessThan(taxBefore);
  });

});

// ---------------------------------------------------------------------------
// SUITE 8 -- COMPLETE RETURN SCENARIOS
// ---------------------------------------------------------------------------

describe('Line 16 -- Complete Return Scenarios', () => {

  test('Priya, 29, single international student -- full return to Line 24', () => {
    /**
     * Priya, 29, single, not a dependent. Non-resident converted to resident
     * for tax purposes via substantial presence test.
     *
     * W-2 wages:             $52,000
     * HSA contribution:      $4,300 (self-only, fully personal)
     * No penalties.
     *
     * Expected:
     *   AGI = $52,000 - $4,300 = $47,700
     *   Standard deduction = $15,000 (single, age 29)
     *   Taxable income = $47,700 - $15,000 = $32,700
     *   Tax: $1,192.50 + 12% * ($32,700 - $11,925) = $1,192.50 + $2,493 = $3,685.50
     *   Total tax = $3,685.50 (no penalties)
     */
    const state = session([
      { id: N.income,                                    value: 52_000 },
      { id: 'f8889.primary.line1_coverageType',           value: 'self_only' },
      { id: 'f8889.primary.line2_personalContributions',  value: 4_300 },
      { id: 'f8889.primary.line4input_ageAsOfDec31',      value: 29 },
    ]);

    expect(num(state, 'f1040.joint.line11_adjustedGrossIncome')).toBe(47_700);
    expect(num(state, N.taxableIncome)).toBe(32_700);
    expect(num(state, N.tax)).toBe(3_685.50);
    expect(num(state, N.totalTax)).toBe(3_685.50);
  });

  test('Andrés, 35, MFJ, full return with HSA and early IRA withdrawal', () => {
    /**
     * Andrés and his wife, both 35, filing jointly.
     *
     * Combined income:        $120,000
     * HSA (family):           $8,550 personal contribution
     * Early IRA withdrawal:   $10,000 (age 35, no exception -> 10% penalty)
     *
     * Expected:
     *   AGI = $120,000 - $8,550 = $111,450
     *   Standard deduction = $30,000 (MFJ)
     *   Taxable income = $111,450 - $30,000 = $81,450
     *   Tax: $11,157 + 22% * ($81,450 - $96,950) -- WAIT: $81,450 < $96,950
     *   Actually in 12% bracket:
     *   Tax: $2,385 + 12% * ($81,450 - $23,850) = $2,385 + $6,912 = $9,297
     *   Early dist penalty: 10% * $10,000 = $1,000
     *   Total tax: $9,297 + $1,000 = $10,297
     */
    const state = session([
      { id: N.income,                                    value: 120_000 },
      { id: 'f8889.primary.line1_coverageType',           value: 'family' },
      { id: 'f8889.primary.line2_personalContributions',  value: 8_550 },
      { id: 'f8889.primary.line4input_ageAsOfDec31',      value: 35 },
      { id: 'f5329.primary.line1_earlyDistributions',  value: 10_000 },
      { id: 'f5329.primary.line2_exceptionCode',          value: 'none' },
    ], 'married_filing_jointly');

    expect(num(state, 'f1040.joint.line11_adjustedGrossIncome')).toBe(111_450);
    expect(num(state, N.taxableIncome)).toBe(81_450);
    expect(num(state, N.tax)).toBe(9_297.00);
    expect(num(state, N.additionalTax)).toBe(1_000);
    expect(num(state, N.totalTax)).toBe(10_297.00);
  });

  test('Wei, 68, single, age 65+ deduction, 2024 return', () => {
    /**
     * Wei, 68, single, 2024 tax return.
     *
     * Income:            $45,000
     * Age 65+:           qualifies for additional $1,950 deduction
     *
     * Expected (2024):
     *   AGI = $45,000 (no above-the-line adjustments)
     *   Standard deduction = $14,600 + $1,950 = $16,550
     *   Taxable income = $45,000 - $16,550 = $28,450
     *   Tax: $1,160 + 12% * ($28,450 - $11,600) = $1,160 + $2,022 = $3,182
     */
    const state = session([
      { id: N.income,     value: 45_000 },
      { id: N.primaryAge, value: 68 },
    ], 'single', '2024');

    expect(num(state, N.taxableIncome)).toBe(28_450);
    expect(num(state, N.tax)).toBe(3_182.00);
  });

  test('F1040_OUTPUTS.taxableIncome and totalTax point to correct computed values', () => {
    const state = session([{ id: N.income, value: 80_000 }]);
    // Verify the output constants resolve to real computed nodes
    expect(state[F1040_OUTPUTS.taxableIncome]?.status).toBe(NodeStatus.CLEAN);
    expect(state[F1040_OUTPUTS.totalTax]?.status).toBe(NodeStatus.CLEAN);
    expect(typeof state[F1040_OUTPUTS.taxableIncome]?.value).toBe('number');
    expect(typeof state[F1040_OUTPUTS.totalTax]?.value).toBe('number');
  });

});