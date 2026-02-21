/**
 * paisatax-tax-graph/src/tax/forms/f1099nec/questions.ts
 *
 * Question definitions for Form 1099-NEC — Nonemployee Compensation.
 *
 * Covers: payer identification, Box 1 compensation, Box 4 withholding.
 *
 * NAMING CONVENTION:
 *   questionId format: f1099nec.q.{shortName}
 *   Must match the node definition's `questionId` field in f1099nec/nodes.ts.
 *
 * AUDIENCE NOTE:
 *   Many PaisaTax users receiving 1099-NEC are first-time self-employed filers
 *   (gig workers, rideshare drivers, freelancers). Guidance is written to be
 *   especially clear for someone filing Schedule C for the first time.
 */

import type { QuestionDefinition } from '../../../core/question/question.types.js';
import { QuestionType } from '../../../core/question/question.types.js';

export const F1099NEC_QUESTIONS: QuestionDefinition[] = [

  // ─── PAYER NAME ─────────────────────────────────────────────────────────
  {
    id:           'f1099nec.q.payerName',
    questionType: QuestionType.FREE_TEXT,
    question: {
      en: 'What is the name of the company or person who sent this 1099-NEC?',
      es: '¿Cuál es el nombre de la empresa o persona que envió este formulario 1099-NEC?',
    },
    shortLabel: { en: 'Payer name', es: 'Nombre del pagador' },
    guidance: {
      explanation: {
        en: 'Enter the name of the business or individual that paid you for your work. This will appear on the tax return for identification purposes.',
        es: 'Ingrese el nombre del negocio o individuo que le pagó por su trabajo. Esto aparecerá en la declaración de impuestos con fines de identificación.',
      },
      whereToFind: {
        en: 'Found in the top-left section of the 1099-NEC form, labeled "PAYER\'S name, street address, city or town, state or province, country, ZIP or foreign postal code, and telephone no."',
        es: 'Se encuentra en la sección superior izquierda del formulario 1099-NEC, etiquetado como "PAYER\'S name..." (Nombre del pagador).',
      },
      commonMistakes: {
        en: 'Do not enter the taxpayer\'s own name here — enter the name of the company or person who PAID them.',
        es: 'No ingrese el nombre del contribuyente aquí — ingrese el nombre de la empresa o persona que LES PAGÓ.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  // ─── PAYER EIN ──────────────────────────────────────────────────────────
  {
    id:           'f1099nec.q.payerEIN',
    questionType: QuestionType.FREE_TEXT,
    question: {
      en: 'What is the payer\'s Employer Identification Number (EIN)?',
      es: '¿Cuál es el Número de Identificación del Empleador (EIN) del pagador?',
    },
    shortLabel: { en: 'Payer EIN', es: 'EIN del pagador' },
    guidance: {
      explanation: {
        en: 'The EIN is a 9-digit number used to identify businesses. Format: XX-XXXXXXX.',
        es: 'El EIN es un número de 9 dígitos usado para identificar negocios. Formato: XX-XXXXXXX.',
      },
      whereToFind: {
        en: 'Found on the 1099-NEC form, labeled "PAYER\'S TIN" (Taxpayer Identification Number). It will be in the format XX-XXXXXXX.',
        es: 'Se encuentra en el formulario 1099-NEC, etiquetado como "PAYER\'S TIN". Tendrá el formato XX-XXXXXXX.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  // ─── BOX 1 — NONEMPLOYEE COMPENSATION ───────────────────────────────────
  {
    id:           'f1099nec.q.box1_nonemployeeCompensation',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much does Box 1 of this 1099-NEC show?',
      es: '¿Cuánto muestra la Casilla 1 de este formulario 1099-NEC?',
    },
    shortLabel: { en: '1099-NEC Box 1 — Nonemployee compensation', es: '1099-NEC Casilla 1 — Compensación a no empleados' },
    guidance: {
      explanation: {
        en: 'Box 1 shows the total amount this payer paid you for your services during 2025. This is self-employment income and will be reported on Schedule C.',
        es: 'La Casilla 1 muestra el monto total que este pagador le pagó por sus servicios durante 2025. Este es ingreso de trabajo por cuenta propia y se reportará en el Anexo C.',
      },
      whereToFind: {
        en: 'Box 1 is labeled "Nonemployee compensation" on the 1099-NEC form. It should be the largest number on the form. Common payers include Uber, Lyft, DoorDash, Instacart, Upwork, Fiverr, or any client who paid you $600 or more.',
        es: 'La Casilla 1 está etiquetada como "Nonemployee compensation" en el formulario 1099-NEC. Suele ser el número más grande en el formulario. Pagadores comunes incluyen Uber, Lyft, DoorDash, Instacart, Upwork, Fiverr, o cualquier cliente que le haya pagado $600 o más.',
      },
      commonMistakes: {
        en: 'Important: You must report ALL income on Schedule C, even income NOT reported on a 1099-NEC. If a client paid you less than $600, they were not required to send a 1099-NEC, but you are still required to report that income. Enter all your income from this type of work on Schedule C Line 1.',
        es: 'Importante: Debe reportar TODOS los ingresos en el Anexo C, incluso los ingresos NO reportados en un formulario 1099-NEC. Si un cliente le pagó menos de $600, no estaban obligados a enviar un 1099-NEC, pero usted sigue estando obligado a reportar ese ingreso.',
      },
      taxPlanningNote: {
        en: '1099-NEC income is subject to BOTH income tax AND self-employment tax (15.3% on the first $176,100 of net profit). Making estimated quarterly tax payments can help avoid underpayment penalties.',
        es: 'El ingreso del 1099-NEC está sujeto TANTO al impuesto sobre la renta COMO al impuesto sobre el trabajo por cuenta propia (15.3% sobre los primeros $176,100 de ganancia neta). Hacer pagos trimestrales de impuestos estimados puede ayudar a evitar multas por pago insuficiente.',
      },
      irsReferences: [
        { title: 'IRS — About Form 1099-NEC', url: 'https://www.irs.gov/forms-pubs/about-form-1099-nec' },
        { title: 'IRS Pub 334 — Tax Guide for Small Business', url: 'https://www.irs.gov/publications/p334' },
      ],
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  // ─── BOX 4 — FEDERAL INCOME TAX WITHHELD ────────────────────────────────
  {
    id:           'f1099nec.q.box4_federalWithholding',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Does Box 4 of this 1099-NEC show any federal income tax withheld?',
      es: '¿Muestra la Casilla 4 de este formulario 1099-NEC algún impuesto federal sobre la renta retenido?',
    },
    shortLabel: { en: '1099-NEC Box 4 — Federal withholding', es: '1099-NEC Casilla 4 — Retención federal' },
    guidance: {
      explanation: {
        en: 'Box 4 shows federal income tax that was withheld from your payments. Most self-employed workers have $0 here — withholding on 1099-NEC income is rare and typically only happens with backup withholding.',
        es: 'La Casilla 4 muestra el impuesto federal sobre la renta que fue retenido de sus pagos. La mayoría de los trabajadores por cuenta propia tienen $0 aquí — la retención en ingresos 1099-NEC es rara.',
      },
      whereToFind: {
        en: 'Check Box 4 on the 1099-NEC form, labeled "Federal income tax withheld." Most forms will show $0.00 or leave this blank. Enter 0 if blank.',
        es: 'Revise la Casilla 4 en el formulario 1099-NEC, etiquetada como "Federal income tax withheld." La mayoría de los formularios mostrarán $0.00 o dejarán esto en blanco. Ingrese 0 si está en blanco.',
      },
      commonMistakes: {
        en: 'Do not confuse this with state tax withholding (Box 5). Enter only the federal amount here.',
        es: 'No confunda esto con la retención de impuesto estatal (Casilla 5). Ingrese solo el monto federal aquí.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

];