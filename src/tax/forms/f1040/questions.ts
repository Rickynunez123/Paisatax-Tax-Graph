/**
 * paisatax-tax-graph/src/tax/forms/f1040/questions.ts
 *
 * Question definitions for Form 1040 — U.S. Individual Income Tax Return.
 *
 * Covers: personal info (age, blind, dependent), other income,
 * withholding, and deferred credit inputs.
 *
 * NAMING CONVENTION:
 *   questionId format: f1040.q.{shortName}
 *   Must match the node definition's `questionId` field in f1040/nodes.ts.
 */

import type { QuestionDefinition } from '../../../core/question/question.types.js';
import { QuestionType } from '../../../core/question/question.types.js';

export const F1040_QUESTIONS: QuestionDefinition[] = [
  // ─── PRIMARY AGE ────────────────────────────────────────────────────────
  {
    id: 'f1040.q.primaryAge',
    questionType: QuestionType.INTEGER,
    question: {
      en: 'How old was the primary filer on December 31 of the tax year?',
      es: '¿Cuántos años tenía el contribuyente principal el 31 de diciembre del año fiscal?',
    },
    shortLabel: { en: 'Primary filer age', es: 'Edad del contribuyente principal' },
    guidance: {
      explanation: {
        en: 'Enter the age of the primary filer as of December 31 of the tax year. This determines eligibility for the additional standard deduction for taxpayers 65 and older.',
        es: 'Ingrese la edad del contribuyente principal al 31 de diciembre del año fiscal. Esto determina la elegibilidad para la deducción estándar adicional para contribuyentes de 65 años o más.',
      },
      whereToFind: {
        en: 'Ask the taxpayer their date of birth, then calculate their age as of December 31. If they turn 65 on January 1 of the following year, the IRS considers them 65 on December 31 of the tax year.',
        es: 'Pregunte al contribuyente su fecha de nacimiento, luego calcule su edad al 31 de diciembre. Si cumplen 65 el 1 de enero del año siguiente, el IRS los considera de 65 años el 31 de diciembre del año fiscal.',
      },
      commonMistakes: {
        en: 'The IRS rule: if the taxpayer turns 65 on January 1 of the year AFTER the tax year, they are considered 65 for the tax year. Double-check birthdays around January 1.',
        es: 'La regla del IRS: si el contribuyente cumple 65 el 1 de enero del año DESPUÉS del año fiscal, se le considera de 65 años para el año fiscal. Verifique cumpleaños alrededor del 1 de enero.',
      },
      taxPlanningNote: {
        en: 'Taxpayers 65+ get an additional standard deduction: $2,000 for single/HOH or $1,600 for married (2025).',
        es: 'Los contribuyentes de 65+ obtienen una deducción estándar adicional: $2,000 para solteros/jefe de familia o $1,600 para casados (2025).',
      },
      irsReferences: [{ title: 'IRS Pub 501 — Standard Deduction', url: 'https://www.irs.gov/publications/p501', page: 'Additional Amount' }],
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer'],
  },

  // ─── PRIMARY BLIND ──────────────────────────────────────────────────────
  {
    id: 'f1040.q.primaryBlind',
    questionType: QuestionType.YES_NO,
    question: {
      en: 'Is the primary filer legally blind?',
      es: '¿Es el contribuyente principal legalmente ciego?',
    },
    shortLabel: { en: 'Primary filer — blind', es: 'Contribuyente principal — ciego' },
    options: [
      { value: true, label: { en: 'Yes', es: 'Sí' }, hint: { en: 'Corrected vision no better than 20/200 or field of vision ≤ 20°', es: 'Visión corregida no mejor que 20/200 o campo visual ≤ 20°' } },
      { value: false, label: { en: 'No', es: 'No' } },
    ],
    guidance: {
      explanation: {
        en: 'A legally blind taxpayer qualifies for an additional standard deduction.',
        es: 'Un contribuyente legalmente ciego califica para una deducción estándar adicional.',
      },
      whereToFind: {
        en: 'Ask the taxpayer directly. If yes, they should have documentation from an eye doctor.',
        es: 'Pregunte al contribuyente directamente. Si es sí, deben tener documentación de un oftalmólogo.',
      },
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer'],
  },

  // ─── SPOUSE AGE ─────────────────────────────────────────────────────────
  {
    id: 'f1040.q.spouseAge',
    questionType: QuestionType.INTEGER,
    question: {
      en: 'How old was the spouse on December 31 of the tax year?',
      es: '¿Cuántos años tenía el cónyuge el 31 de diciembre del año fiscal?',
    },
    shortLabel: { en: 'Spouse age', es: 'Edad del cónyuge' },
    guidance: {
      explanation: {
        en: 'Enter the spouse\'s age as of December 31. Same rules as primary filer age.',
        es: 'Ingrese la edad del cónyuge al 31 de diciembre. Las mismas reglas que la edad del contribuyente principal.',
      },
      whereToFind: {
        en: 'Ask the taxpayer for their spouse\'s date of birth.',
        es: 'Pregunte al contribuyente la fecha de nacimiento de su cónyuge.',
      },
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer'],
    hideUntilPrerequisitesMet: true,
  },

  // ─── SPOUSE BLIND ───────────────────────────────────────────────────────
  {
    id: 'f1040.q.spouseBlind',
    questionType: QuestionType.YES_NO,
    question: {
      en: 'Is the spouse legally blind?',
      es: '¿Es el cónyuge legalmente ciego?',
    },
    shortLabel: { en: 'Spouse — blind', es: 'Cónyuge — ciego' },
    options: [
      { value: true, label: { en: 'Yes', es: 'Sí' } },
      { value: false, label: { en: 'No', es: 'No' } },
    ],
    guidance: {
      explanation: {
        en: 'Same as primary filer — qualifies for additional standard deduction.',
        es: 'Igual que el contribuyente principal — califica para deducción estándar adicional.',
      },
      whereToFind: {
        en: 'Ask the taxpayer about their spouse.',
        es: 'Pregunte al contribuyente sobre su cónyuge.',
      },
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer'],
    hideUntilPrerequisitesMet: true,
  },

  // ─── IS DEPENDENT FILER ─────────────────────────────────────────────────
  {
    id: 'f1040.q.isDependentFiler',
    questionType: QuestionType.YES_NO,
    question: {
      en: 'Can this taxpayer be claimed as a dependent on someone else\'s return?',
      es: '¿Puede este contribuyente ser reclamado como dependiente en la declaración de otra persona?',
    },
    shortLabel: { en: 'Claimed as dependent', es: 'Reclamado como dependiente' },
    options: [
      { value: true, label: { en: 'Yes', es: 'Sí' }, hint: { en: 'Common for students under 24 whose parents provide >50% support', es: 'Común para estudiantes menores de 24 cuyos padres proporcionan >50% de manutención' }, triggersFollowUp: true },
      { value: false, label: { en: 'No', es: 'No' } },
    ],
    guidance: {
      explanation: {
        en: 'If someone else can claim this taxpayer as a dependent, the standard deduction is limited to the greater of $1,350 or earned income + $450 (2025).',
        es: 'Si otra persona puede reclamar a este contribuyente como dependiente, la deducción estándar está limitada al mayor de $1,350 o ingreso ganado + $450 (2025).',
      },
      whereToFind: {
        en: 'Ask: "Does anyone else (parent, guardian) claim you as a dependent on their tax return?"',
        es: 'Pregunte: "¿Alguien más (padre, tutor) lo reclama como dependiente en su declaración de impuestos?"',
      },
      commonMistakes: {
        en: 'The question is whether someone CAN claim them, not whether they actually DO. Even if the parent doesn\'t file, the dependent deduction rules still apply if they qualify.',
        es: 'La pregunta es si alguien PUEDE reclamarlos, no si realmente LO HACEN. Las reglas aplican si califican, aunque el padre no declare.',
      },
      irsReferences: [{ title: 'IRS Pub 501 — Dependents', url: 'https://www.irs.gov/publications/p501', page: 'Standard Deduction for Dependents' }],
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer'],
  },

  // ─── EARNED INCOME (dependent filer) ────────────────────────────────────
  {
    id: 'f1040.q.earnedIncome',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What is the dependent filer\'s total earned income?',
      es: '¿Cuál es el ingreso total ganado del contribuyente dependiente?',
    },
    shortLabel: { en: 'Earned income (dependent)', es: 'Ingreso ganado (dependiente)' },
    guidance: {
      explanation: {
        en: 'Earned income includes wages, salaries, tips, and self-employment income. It does NOT include interest, dividends, or other unearned income. Used to calculate the dependent\'s limited standard deduction.',
        es: 'El ingreso ganado incluye salarios, sueldos, propinas e ingreso de trabajo por cuenta propia. NO incluye intereses, dividendos u otro ingreso no ganado. Se usa para calcular la deducción estándar limitada del dependiente.',
      },
      whereToFind: {
        en: 'Sum up all W-2 Box 1 amounts plus any net self-employment income.',
        es: 'Sume todos los montos de la Casilla 1 del W-2 más cualquier ingreso neto de trabajo por cuenta propia.',
      },
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer'],
    hideUntilPrerequisitesMet: true,
  },

  // ─── OTHER INCOME ───────────────────────────────────────────────────────
  {
    id: 'f1040.q.otherIncome',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Does the taxpayer have any other income not from W-2s? (interest, dividends, business income, etc.)',
      es: '¿Tiene el contribuyente algún otro ingreso que no sea de W-2? (intereses, dividendos, ingresos de negocio, etc.)',
    },
    shortLabel: { en: 'Other income', es: 'Otros ingresos' },
    guidance: {
      explanation: {
        en: 'Enter the total of all income NOT from W-2 wages. This is a temporary manual entry until dedicated forms for each income type are built.',
        es: 'Ingrese el total de todos los ingresos que NO son de salarios W-2. Esta es una entrada manual temporal hasta que se construyan formularios dedicados para cada tipo de ingreso.',
      },
      whereToFind: {
        en: 'Ask if the taxpayer received any 1099 forms, had side income, sold investments, or received any other income during the year.',
        es: 'Pregunte si el contribuyente recibió formularios 1099, tuvo ingresos adicionales, vendió inversiones o recibió cualquier otro ingreso durante el año.',
      },
      commonMistakes: {
        en: 'Do NOT include W-2 wages here — those are entered separately through the W-2 form.',
        es: 'NO incluya salarios W-2 aquí — esos se ingresan por separado a través del formulario W-2.',
      },
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer'],
  },

  // ─── QBI DEDUCTION ──────────────────────────────────────────────────────
  {
    id: 'f1040.q.qbiDeduction',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Does the taxpayer have a Qualified Business Income (QBI) deduction?',
      es: '¿Tiene el contribuyente una deducción por Ingreso Calificado de Negocio (QBI)?',
    },
    shortLabel: { en: 'QBI deduction', es: 'Deducción QBI' },
    guidance: {
      explanation: {
        en: 'The QBI deduction allows eligible self-employed and small business owners to deduct up to 20% of qualified business income. Calculated on Form 8995 or 8995-A.',
        es: 'La deducción QBI permite a los trabajadores por cuenta propia y propietarios de pequeñas empresas elegibles deducir hasta el 20% de su ingreso calificado de negocio. Se calcula en el Formulario 8995 o 8995-A.',
      },
      whereToFind: {
        en: 'If the taxpayer has business income, calculate using Form 8995. If no business income, enter 0.',
        es: 'Si el contribuyente tiene ingresos de negocio, calcule usando el Formulario 8995. Si no hay ingresos de negocio, ingrese 0.',
      },
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer'],
  },

  // ─── 1099 WITHHOLDING ──────────────────────────────────────────────────
  {
    id: 'f1040.q.withholding1099',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Was there any federal tax withheld on 1099 forms?',
      es: '¿Se retuvo algún impuesto federal en los formularios 1099?',
    },
    shortLabel: { en: '1099 withholding', es: 'Retención de 1099' },
    guidance: {
      explanation: {
        en: 'Some 1099 forms show federal income tax withheld (usually Box 4). This occurs with retirement distributions, gambling winnings, and backup withholding.',
        es: 'Algunos formularios 1099 muestran impuesto federal retenido (usualmente Casilla 4). Ocurre con distribuciones de jubilación, ganancias de juegos y retención de respaldo.',
      },
      whereToFind: {
        en: 'Check Box 4 on all 1099 forms (1099-R, 1099-INT, 1099-DIV, 1099-MISC, etc.). Sum up all federal tax withheld amounts.',
        es: 'Revise la Casilla 4 de todos los formularios 1099 (1099-R, 1099-INT, 1099-DIV, 1099-MISC, etc.). Sume todos los montos de impuesto federal retenido.',
      },
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  // ─── OTHER WITHHOLDING ─────────────────────────────────────────────────
  {
    id: 'f1040.q.otherWithholding',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Is there any other federal tax withheld? (gambling, backup withholding, etc.)',
      es: '¿Hay algún otro impuesto federal retenido? (juegos, retención de respaldo, etc.)',
    },
    shortLabel: { en: 'Other withholding', es: 'Otra retención' },
    guidance: {
      explanation: {
        en: 'This includes federal tax withheld from sources not covered by W-2s or standard 1099s: gambling winnings (W-2G), backup withholding, etc.',
        es: 'Esto incluye impuesto federal retenido de fuentes no cubiertas por W-2 o 1099 estándar: ganancias de juego (W-2G), retención de respaldo, etc.',
      },
      whereToFind: {
        en: 'Check W-2G forms for gambling withholding, and any 1099 forms that show backup withholding. Most taxpayers will enter 0 here.',
        es: 'Revise formularios W-2G para retención de juegos, y cualquier formulario 1099 con retención de respaldo. La mayoría de los contribuyentes ingresarán 0 aquí.',
      },
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer'],
  },

  // ─── EARNED INCOME CREDIT ──────────────────────────────────────────────
  {
    id: 'f1040.q.earnedIncomeCredit',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Does the taxpayer qualify for the Earned Income Credit (EIC)?',
      es: '¿Califica el contribuyente para el Crédito por Ingreso del Trabajo (EIC)?',
    },
    shortLabel: { en: 'Earned Income Credit', es: 'Crédito por Ingreso del Trabajo' },
    guidance: {
      explanation: {
        en: 'The EIC is a refundable credit for low-to-moderate income workers. The amount depends on earned income, filing status, and number of qualifying children. Schedule EIC is not yet implemented — enter the amount manually if applicable.',
        es: 'El EIC es un crédito reembolsable para trabajadores de ingresos bajos a moderados. El monto depende del ingreso ganado, estado civil tributario y número de hijos calificados. El Anexo EIC aún no está implementado — ingrese el monto manualmente si aplica.',
      },
      whereToFind: {
        en: 'Calculate using the EIC tables in IRS Pub 596 or use the IRS EITC Assistant tool online. Enter 0 if not applicable.',
        es: 'Calcule usando las tablas EIC en la Publicación 596 del IRS o use la herramienta EITC Assistant del IRS en línea. Ingrese 0 si no aplica.',
      },
      taxPlanningNote: {
        en: 'The EIC can be worth up to $7,830 (2025) for families with 3+ qualifying children. Even taxpayers with no children may qualify for up to $632.',
        es: 'El EIC puede valer hasta $7,830 (2025) para familias con 3+ hijos calificados. Incluso contribuyentes sin hijos pueden calificar por hasta $632.',
      },
      irsReferences: [
        { title: 'IRS Pub 596 — Earned Income Credit', url: 'https://www.irs.gov/publications/p596' },
        { title: 'IRS EITC Assistant', url: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc' },
      ],
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['preparer'],
  },
];