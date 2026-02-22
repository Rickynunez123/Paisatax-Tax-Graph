/**
 * paisatax-tax-graph/src/tax/forms/schedule-h/questions.ts
 *
 * Question definitions for Schedule H — Household Employment Taxes.
 *
 * NAMING CONVENTION:
 *   questionId format: scheduleH.q.{shortName}
 *   Must match the node definition's `questionId` field in schedule-h/nodes.ts.
 */

import type { QuestionDefinition } from '../../../core/question/question.types.js';
import { QuestionType } from '../../../core/question/question.types.js';

export const SCHEDULE_H_QUESTIONS: QuestionDefinition[] = [

  // ─── ELIGIBILITY ─────────────────────────────────────────────────────────

  {
    id: 'scheduleH.q.lineA_ficaEligible',
    questionType: QuestionType.YES_NO,
    question: {
      en: 'Did you pay $2,800 or more in cash wages to any single household employee in 2025?',
      es: '¿Pagó $2,800 o más en salarios en efectivo a algún empleado doméstico individual en 2025?',
    },
    shortLabel: { en: 'Paid $2,800+ to any household employee?', es: '¿Pagó $2,800+ a algún empleado doméstico?' },
    options: [
      {
        value: true,
        label: { en: 'Yes — FICA taxes apply', es: 'Sí — aplican impuestos FICA' },
        hint: { en: 'Must withhold/pay Social Security and Medicare taxes', es: 'Debe retener/pagar impuestos de Seguro Social y Medicare' },
        triggersFollowUp: true,
      },
      {
        value: false,
        label: { en: 'No', es: 'No' },
        hint: { en: 'FICA taxes do not apply — only FUTA may if quarterly wages reached $1,000', es: 'Los impuestos FICA no aplican — solo puede aplicar FUTA si los salarios trimestrales llegaron a $1,000' },
      },
    ],
    guidance: {
      explanation: {
        en: 'The $2,800 threshold is per employee, not total. If you paid one nanny $3,000 and one housekeeper $1,500, only the nanny crosses the threshold — FICA applies only to the nanny\'s wages.',
        es: 'El umbral de $2,800 es por empleado, no total. Si pagó $3,000 a una niñera y $1,500 a una ama de llaves, solo la niñera supera el umbral — FICA aplica solo a los salarios de la niñera.',
      },
      whereToFind: {
        en: 'Add up total cash wages paid to each household employee separately. Only count wages paid directly (exclude agency-placed workers — the agency is the employer in that case).',
        es: 'Sume los salarios totales en efectivo pagados a cada empleado doméstico por separado. Solo cuente los salarios pagados directamente (excluya a los trabajadores de agencias — la agencia es el empleador en ese caso).',
      },
      commonMistakes: {
        en: 'Common household employees: nannies, au pairs, babysitters (regular), housekeepers, home health aides, gardeners, private nurses, cooks. NOT employees: agency workers, independent contractors, workers providing services primarily for their own business.',
        es: 'Empleados domésticos comunes: niñeras, au pairs, cuidadores de niños (regulares), amas de llaves, auxiliares de salud en el hogar, jardineros, enfermeras privadas, cocineros. NO son empleados: trabajadores de agencias, contratistas independientes.',
      },
      taxPlanningNote: {
        en: 'As a household employer, you must file Schedule H with your Form 1040, issue Form W-2 to each qualifying employee by January 31, and file Form W-3 with the SSA.',
        es: 'Como empleador doméstico, debe presentar el Anexo H con su Formulario 1040, emitir el Formulario W-2 a cada empleado calificado antes del 31 de enero y presentar el Formulario W-3 ante la SSA.',
      },
      irsReferences: [{ title: 'IRS Publication 926 — Household Employer\'s Tax Guide', url: 'https://www.irs.gov/publications/p926' }],
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleH.q.lineB_futaEligible',
    questionType: QuestionType.YES_NO,
    question: {
      en: 'Did you pay $1,000 or more in total cash wages to household employees in any single calendar quarter of 2024 or 2025?',
      es: '¿Pagó $1,000 o más en salarios totales en efectivo a empleados domésticos en algún trimestre calendario de 2024 o 2025?',
    },
    shortLabel: { en: 'Paid $1,000+ in any quarter?', es: '¿Pagó $1,000+ en algún trimestre?' },
    options: [
      {
        value: true,
        label: { en: 'Yes — FUTA applies', es: 'Sí — aplica FUTA' },
        triggersFollowUp: true,
      },
      { value: false, label: { en: 'No', es: 'No' } },
    ],
    guidance: {
      explanation: {
        en: 'The FUTA threshold ($1,000 in any quarter) applies to total wages across ALL household employees combined, not per employee. Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec.',
        es: 'El umbral de FUTA ($1,000 en cualquier trimestre) aplica a los salarios totales de TODOS los empleados domésticos combinados, no por empleado.',
      },
      whereToFind: {
        en: 'Check payroll records by quarter. If total wages paid to all household employees exceeded $1,000 in any one of the four quarters, the answer is Yes.',
        es: 'Consulte los registros de nómina por trimestre. Si los salarios totales pagados a todos los empleados domésticos superaron $1,000 en cualquiera de los cuatro trimestres, la respuesta es Sí.',
      },
      commonMistakes: {
        en: 'Note the reference to "2024 or 2025" — if you paid $1,000+ in any quarter of 2024, you may still owe FUTA on 2025 wages even if 2025 quarterly amounts were under $1,000.',
        es: 'Nota la referencia a "2024 o 2025" — si pagó $1,000+ en cualquier trimestre de 2024, puede que aún deba FUTA sobre los salarios de 2025 aunque los montos trimestrales de 2025 estuvieran por debajo de $1,000.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ─── PART I — FICA ───────────────────────────────────────────────────────

  {
    id: 'scheduleH.q.line1_ssWages',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What were the total cash wages paid to household employees subject to Social Security tax?',
      es: '¿Cuáles fueron los salarios totales en efectivo pagados a empleados domésticos sujetos al impuesto del Seguro Social?',
    },
    shortLabel: { en: 'Wages subject to Social Security', es: 'Salarios sujetos al Seguro Social' },
    guidance: {
      explanation: {
        en: 'Include the total cash wages paid to all household employees who individually received $2,800 or more. The Social Security tax applies to wages up to $176,100 per employee — if any employee\'s wages exceeded this, only include the first $176,100 for that employee.',
        es: 'Incluya los salarios totales en efectivo pagados a todos los empleados domésticos que individualmente recibieron $2,800 o más. El impuesto del Seguro Social aplica a salarios hasta $176,100 por empleado.',
      },
      whereToFind: {
        en: 'Payroll records, cancelled checks, or bank records showing wages paid to each qualifying household employee.',
        es: 'Registros de nómina, cheques cancelados o registros bancarios que muestren los salarios pagados a cada empleado doméstico calificado.',
      },
      commonMistakes: {
        en: 'Do not include: meals or lodging provided for your convenience (generally tax-free), payments to your spouse, your child under 21, or your parent (exempt from FICA in most cases).',
        es: 'No incluya: comidas o alojamiento proporcionados para su conveniencia (generalmente libres de impuestos), pagos a su cónyuge, su hijo menor de 21 años o su padre (exentos de FICA en la mayoría de los casos).',
      },
      taxPlanningNote: {
        en: 'You owe BOTH the employer share (7.65%) AND the employee share (7.65%) = 15.3% total. You may either withhold the employee share from wages or pay it yourself — either way, 15.3% goes on Schedule H.',
        es: 'Debe TANTO la parte del empleador (7.65%) COMO la parte del empleado (7.65%) = 15.3% total. Puede retener la parte del empleado de los salarios o pagarla usted mismo — de cualquier manera, el 15.3% va en el Anexo H.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleH.q.line3_medicareWages',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What were the total cash wages subject to Medicare tax? (Usually the same as Social Security wages — enter the same amount unless any employee earned over $176,100.)',
      es: '¿Cuáles fueron los salarios totales en efectivo sujetos al impuesto de Medicare? (Generalmente igual que los salarios del Seguro Social — ingrese el mismo monto a menos que algún empleado haya ganado más de $176,100.)',
    },
    shortLabel: { en: 'Wages subject to Medicare', es: 'Salarios sujetos a Medicare' },
    guidance: {
      explanation: {
        en: 'Medicare has no wage base cap — all wages are subject to Medicare tax. For most household employers, this is the same number as Line 1. Only differs if you paid a household employee more than $176,100 (extremely rare).',
        es: 'Medicare no tiene límite de base salarial — todos los salarios están sujetos al impuesto de Medicare. Para la mayoría de los empleadores domésticos, este es el mismo número que la Línea 1.',
      },
      whereToFind: {
        en: 'Same payroll records as Line 1. Add back any wages above $176,100 per employee that were excluded from Line 1.',
        es: 'Los mismos registros de nómina que la Línea 1. Agregue de nuevo cualquier salario por encima de $176,100 por empleado que fue excluido de la Línea 1.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleH.q.line5_federalWithheld',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Did you withhold federal income tax from any household employee\'s wages? If so, how much total?',
      es: '¿Retuvo impuesto federal sobre la renta de los salarios de algún empleado doméstico? En caso afirmativo, ¿cuánto en total?',
    },
    shortLabel: { en: 'Federal income tax withheld', es: 'Impuesto federal sobre la renta retenido' },
    guidance: {
      explanation: {
        en: 'Federal income tax withholding from household employees is optional — both you and the employee must agree in writing (the employee submits Form W-4). If you did not withhold, enter $0. This is separate from FICA and does not change your FICA obligation.',
        es: 'La retención del impuesto federal sobre la renta de los empleados domésticos es opcional — tanto usted como el empleado deben acordar por escrito (el empleado presenta el Formulario W-4). Si no retuvo, ingrese $0.',
      },
      whereToFind: {
        en: 'Payroll records showing federal income tax amounts withheld and remitted. Check Form W-4 filed by the employee.',
        es: 'Registros de nómina que muestran los montos de impuesto federal sobre la renta retenidos y remitidos. Consulte el Formulario W-4 presentado por el empleado.',
      },
      commonMistakes: {
        en: 'Most household employers do NOT withhold federal income tax. This is only entered if a withholding agreement was in place. Entering an incorrect amount here does not affect FICA — it only affects the household employer\'s withholding credit.',
        es: 'La mayoría de los empleadores domésticos NO retienen el impuesto federal sobre la renta. Esto solo se ingresa si había un acuerdo de retención en vigor.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ─── PART II — FUTA ──────────────────────────────────────────────────────

  {
    id: 'scheduleH.q.line7_futaWages',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What were the total cash wages subject to FUTA? (First $7,000 paid to each household employee, summed across all employees.)',
      es: '¿Cuáles fueron los salarios totales en efectivo sujetos a FUTA? (Los primeros $7,000 pagados a cada empleado doméstico, sumados para todos los empleados.)',
    },
    shortLabel: { en: 'FUTA-taxable wages', es: 'Salarios sujetos a FUTA' },
    guidance: {
      explanation: {
        en: 'FUTA applies to the first $7,000 of cash wages per employee per year. Add up the first $7,000 for each employee (or less if an employee received under $7,000 total). Sum these amounts across all household employees.',
        es: 'FUTA aplica a los primeros $7,000 de salarios en efectivo por empleado por año. Sume los primeros $7,000 para cada empleado (o menos si un empleado recibió menos de $7,000 en total). Sume estos montos para todos los empleados domésticos.',
      },
      whereToFind: {
        en: 'Example: Nanny paid $20,000 → FUTA on $7,000. Housekeeper paid $5,000 → FUTA on $5,000. Total FUTA wages = $12,000.',
        es: 'Ejemplo: Niñera pagada $20,000 → FUTA sobre $7,000. Ama de llaves pagada $5,000 → FUTA sobre $5,000. Total de salarios FUTA = $12,000.',
      },
      commonMistakes: {
        en: 'Do not enter total wages here — only the first $7,000 per employee. Wages above $7,000 are exempt from FUTA.',
        es: 'No ingrese los salarios totales aquí — solo los primeros $7,000 por empleado. Los salarios por encima de $7,000 están exentos de FUTA.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleH.q.line9_stateUiTaxPaid',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much state unemployment insurance (UI) tax did you pay on time for your household employees?',
      es: '¿Cuánto impuesto de seguro de desempleo (UI) estatal pagó a tiempo por sus empleados domésticos?',
    },
    shortLabel: { en: 'State UI tax paid on time', es: 'Impuesto UI estatal pagado a tiempo' },
    guidance: {
      explanation: {
        en: 'Most states require household employers to register and pay state unemployment insurance on employee wages. The state UI tax paid generates a credit against FUTA (up to 5.4%), reducing the net FUTA rate from 6.0% to typically 0.6%.',
        es: 'La mayoría de los estados requieren que los empleadores domésticos se registren y paguen el seguro de desempleo estatal sobre los salarios de los empleados. El impuesto UI estatal pagado genera un crédito contra FUTA (hasta 5.4%), reduciendo la tasa neta de FUTA del 6.0% a típicamente 0.6%.',
      },
      whereToFind: {
        en: 'State unemployment tax payment records. Check your state labor department or workforce agency — each state has its own household employer registration and UI tax system.',
        es: 'Registros de pago de impuestos de desempleo estatal. Consulte el departamento de trabajo o la agencia de empleo de su estado — cada estado tiene su propio sistema de registro y impuesto UI para empleadores domésticos.',
      },
      commonMistakes: {
        en: '"On time" means paid by April 15 (the Schedule H due date). If state UI was paid late, the credit is reduced or eliminated and you may owe the full 6% FUTA. If your state has no UI tax requirement for household employers, enter $0.',
        es: '"A tiempo" significa pagado antes del 15 de abril (la fecha límite del Anexo H). Si el UI estatal se pagó tarde, el crédito se reduce o elimina y puede deber el 6% completo de FUTA.',
      },
      taxPlanningNote: {
        en: 'Paying state UI on time is important — it saves 5.4% on FUTA wages. For a household employer with $10,000 of FUTA wages, timely state UI payment saves $540 in federal FUTA.',
        es: 'Pagar el UI estatal a tiempo es importante — ahorra 5.4% en salarios FUTA. Para un empleador doméstico con $10,000 de salarios FUTA, el pago oportuno del UI estatal ahorra $540 en FUTA federal.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },
];