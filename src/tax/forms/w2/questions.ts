/**
 * paisatax-tax-graph/src/tax/forms/w2/questions.ts
 *
 * Question definitions for Form W-2 — Wage and Tax Statement.
 *
 * These are the questions the preparer asks the taxpayer (or reads
 * from the physical W-2 form) to fill in the W-2 slot nodes.
 *
 * NAMING CONVENTION:
 *   questionId format: {formId}.q.{shortName}
 *   The questionId MUST match the node definition's `questionId` field.
 *
 * BILINGUAL:
 *   Every text field has both 'en' and 'es' keys.
 *   The frontend reads the language from the user's preference.
 *
 * NOTE: W-2 is a slotted form — the same questions apply to every
 * W-2 instance (s0, s1, s2...). The frontend uses the questionId
 * to look up the question, and the nodeInstanceId to know which
 * slot it belongs to.
 */

import type { QuestionDefinition } from '../../../core/question/question.types.js';
import { QuestionType } from '../../../core/question/question.types.js';

export const W2_QUESTIONS: QuestionDefinition[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // BOX 1 — WAGES, TIPS, OTHER COMPENSATION
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'w2.q.box1Wages',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What is the amount in Box 1 (Wages, tips, other compensation)?',
      es: '¿Cuál es el monto en la Casilla 1 (Salarios, propinas y otra compensación)?',
    },
    shortLabel: {
      en: 'Box 1 — Wages',
      es: 'Casilla 1 — Salarios',
    },
    guidance: {
      explanation: {
        en: 'This is the total taxable wages, tips, and other compensation the employer paid. It may differ from gross pay because pre-tax deductions (401k, health insurance, HSA) reduce this number.',
        es: 'Este es el total de salarios gravables, propinas y otra compensación que el empleador pagó. Puede diferir del pago bruto porque las deducciones antes de impuestos (401k, seguro médico, HSA) reducen este número.',
      },
      whereToFind: {
        en: 'Look at the W-2 form, Box 1 (top-left area, labeled "Wages, tips, other compensation"). This is the most important number on the W-2.',
        es: 'Mire el formulario W-2, Casilla 1 (área superior izquierda, etiquetada "Wages, tips, other compensation"). Este es el número más importante del W-2.',
      },
      commonMistakes: {
        en: 'Do NOT confuse Box 1 with Box 3 (Social Security wages) or Box 5 (Medicare wages). They are often different amounts. Box 1 is typically the smallest of the three because it excludes pre-tax deductions.',
        es: 'NO confunda la Casilla 1 con la Casilla 3 (salarios del Seguro Social) o la Casilla 5 (salarios de Medicare). Frecuentemente son montos diferentes. La Casilla 1 es típicamente la más pequeña de las tres porque excluye las deducciones antes de impuestos.',
      },
      taxPlanningNote: {
        en: 'If the taxpayer is contributing to a 401(k) or HSA, increasing those contributions will lower Box 1 next year, reducing their taxable income.',
        es: 'Si el contribuyente está contribuyendo a un 401(k) o HSA, aumentar esas contribuciones reducirá la Casilla 1 el próximo año, reduciendo su ingreso gravable.',
      },
      examples: {
        en: [
          'Maria earns $60,000/year but contributes $5,000 to her 401(k) and $2,000 to her HSA through payroll. Her Box 1 shows $53,000.',
          'Juan earns $45,000 with no pre-tax deductions. His Box 1 matches his gross salary: $45,000.',
        ],
        es: [
          'María gana $60,000/año pero contribuye $5,000 a su 401(k) y $2,000 a su HSA a través de nómina. Su Casilla 1 muestra $53,000.',
          'Juan gana $45,000 sin deducciones antes de impuestos. Su Casilla 1 coincide con su salario bruto: $45,000.',
        ],
      },
      irsReferences: [
        {
          title: 'IRS W-2 Instructions — Box 1',
          url: 'https://www.irs.gov/instructions/iw2w3',
          page: 'Box 1',
        },
      ],
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['other_form'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BOX 2 — FEDERAL INCOME TAX WITHHELD
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'w2.q.box2FederalWithholding',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What is the amount in Box 2 (Federal income tax withheld)?',
      es: '¿Cuál es el monto en la Casilla 2 (Impuesto federal sobre ingresos retenido)?',
    },
    shortLabel: {
      en: 'Box 2 — Federal Withholding',
      es: 'Casilla 2 — Retención Federal',
    },
    guidance: {
      explanation: {
        en: 'This is how much federal income tax the employer already sent to the IRS on behalf of the employee during the year. This amount is credited against the total tax owed.',
        es: 'Esta es la cantidad de impuesto federal sobre ingresos que el empleador ya envió al IRS en nombre del empleado durante el año. Este monto se acredita contra el impuesto total adeudado.',
      },
      whereToFind: {
        en: 'Look at the W-2 form, Box 2 (to the right of Box 1, labeled "Federal income tax withheld").',
        es: 'Mire el formulario W-2, Casilla 2 (a la derecha de la Casilla 1, etiquetada "Federal income tax withheld").',
      },
      commonMistakes: {
        en: 'Do NOT confuse this with state tax withholding (Box 17) or Social Security tax (Box 4). Some taxpayers have $0 in Box 2 if they claimed exempt on their W-4 — this is valid but means they owe the full tax at filing.',
        es: 'NO confunda esto con la retención de impuestos estatales (Casilla 17) o el impuesto del Seguro Social (Casilla 4). Algunos contribuyentes tienen $0 en la Casilla 2 si reclamaron exención en su W-4 — esto es válido pero significa que deben el impuesto completo al declarar.',
      },
      taxPlanningNote: {
        en: 'If the taxpayer owes a large amount at filing or gets a very large refund, they should adjust their W-4 withholding. A large refund means they gave the IRS an interest-free loan.',
        es: 'Si el contribuyente debe una cantidad grande al declarar o recibe un reembolso muy grande, debería ajustar su retención W-4. Un reembolso grande significa que le dio al IRS un préstamo sin intereses.',
      },
      examples: {
        en: [
          'Box 1 shows $53,000 and Box 2 shows $6,200. The employer withheld $6,200 in federal taxes throughout the year.',
        ],
        es: [
          'La Casilla 1 muestra $53,000 y la Casilla 2 muestra $6,200. El empleador retuvo $6,200 en impuestos federales durante el año.',
        ],
      },
      irsReferences: [
        {
          title: 'IRS W-2 Instructions — Box 2',
          url: 'https://www.irs.gov/instructions/iw2w3',
          page: 'Box 2',
        },
      ],
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['other_form'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BOX 12 CODE W — EMPLOYER HSA CONTRIBUTIONS
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'w2.q.box12CodeW',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Does Box 12 have a Code W amount? If so, what is it?',
      es: '¿La Casilla 12 tiene un monto con Código W? Si es así, ¿cuál es?',
    },
    shortLabel: {
      en: 'Box 12 Code W — Employer HSA',
      es: 'Casilla 12 Código W — HSA del Empleador',
    },
    guidance: {
      explanation: {
        en: 'Code W in Box 12 shows the total HSA contributions made through the employer — both the employer\'s contribution AND any amount the employee contributed via payroll deduction. This flows to Form 8889 Line 9.',
        es: 'El Código W en la Casilla 12 muestra las contribuciones totales al HSA hechas a través del empleador — tanto la contribución del empleador COMO cualquier monto que el empleado contribuyó por deducción de nómina. Esto fluye al Formulario 8889 Línea 9.',
      },
      whereToFind: {
        en: 'Look at Box 12 on the W-2. It has up to 4 lettered slots (12a, 12b, 12c, 12d). Look for the one with a "W" code next to it. If there is no "W" code, the taxpayer may not have an employer-facilitated HSA contribution — enter 0.',
        es: 'Mire la Casilla 12 en el W-2. Tiene hasta 4 espacios con letras (12a, 12b, 12c, 12d). Busque el que tiene un código "W" al lado. Si no hay código "W", el contribuyente puede no tener una contribución HSA facilitada por el empleador — ingrese 0.',
      },
      commonMistakes: {
        en: 'Code W includes BOTH employer and employee payroll-deducted HSA contributions. Do not also count these amounts as "personal contributions" on Form 8889 Line 2 — that would be double-counting. Personal contributions on Line 2 are ONLY amounts contributed outside of payroll (e.g., direct bank transfer to HSA).',
        es: 'El Código W incluye TANTO las contribuciones del empleador como las del empleado deducidas de nómina. No cuente también estos montos como "contribuciones personales" en el Formulario 8889 Línea 2 — eso sería contar doble. Las contribuciones personales en la Línea 2 son SOLO montos contribuidos fuera de la nómina (ej. transferencia bancaria directa al HSA).',
      },
      examples: {
        en: [
          'Maria\'s W-2 Box 12a shows "W — $3,600". Her employer contributed $1,200 and she contributed $2,400 via payroll deduction. The full $3,600 goes on Form 8889 Line 9.',
          'Juan\'s W-2 has no Code W in Box 12. He contributed $2,000 directly from his bank account to his HSA. That $2,000 is a personal contribution (Form 8889 Line 2), not Box 12 Code W.',
        ],
        es: [
          'El W-2 de María, Casilla 12a muestra "W — $3,600". Su empleador contribuyó $1,200 y ella contribuyó $2,400 por deducción de nómina. Los $3,600 completos van en el Formulario 8889 Línea 9.',
          'El W-2 de Juan no tiene Código W en la Casilla 12. Él contribuyó $2,000 directamente desde su cuenta bancaria a su HSA. Esos $2,000 son una contribución personal (Formulario 8889 Línea 2), no Casilla 12 Código W.',
        ],
      },
      irsReferences: [
        {
          title: 'IRS W-2 Instructions — Box 12 Codes',
          url: 'https://www.irs.gov/instructions/iw2w3',
          page: 'Box 12 — Code W',
        },
        {
          title: 'IRS Pub 969 — HSAs',
          url: 'https://www.irs.gov/publications/p969',
        },
      ],
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['other_form'],
    hideUntilPrerequisitesMet: true,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EMPLOYER NAME — for display/identification purposes
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'w2.q.employerName',
    questionType: QuestionType.FREE_TEXT,
    question: {
      en: 'What is the employer\'s name (from Box c on the W-2)?',
      es: '¿Cuál es el nombre del empleador (de la Casilla c del W-2)?',
    },
    shortLabel: {
      en: 'Employer Name',
      es: 'Nombre del Empleador',
    },
    guidance: {
      explanation: {
        en: 'The employer\'s name helps identify which W-2 is which when there are multiple. It is not used in tax calculations.',
        es: 'El nombre del empleador ayuda a identificar cuál W-2 es cuál cuando hay múltiples. No se usa en los cálculos de impuestos.',
      },
      whereToFind: {
        en: 'Look at Box c on the W-2 form (left side, labeled "Employer\'s name, address, and ZIP code").',
        es: 'Mire la Casilla c del formulario W-2 (lado izquierdo, etiquetada "Employer\'s name, address, and ZIP code").',
      },
    },
    applicableTaxYears: ['2024', '2025'],
    inputPanels: ['other_form'],
  },
];