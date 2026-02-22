/**
 * paisatax-tax-graph/src/tax/forms/schedule-a/questions.ts
 *
 * Question definitions for Schedule A — Itemized Deductions.
 *
 * NAMING CONVENTION:
 *   questionId format: scheduleA.q.{shortName}
 *   Must match the node definition's `questionId` field in schedule-a/nodes.ts.
 */

import type { QuestionDefinition } from '../../../core/question/question.types.js';
import { QuestionType } from '../../../core/question/question.types.js';

export const SCHEDULE_A_QUESTIONS: QuestionDefinition[] = [

  // ─── MEDICAL EXPENSES ────────────────────────────────────────────────────

  {
    id: 'scheduleA.q.medicalExpenses',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What were the total medical and dental expenses paid out of pocket in 2025?',
      es: '¿Cuáles fueron los gastos médicos y dentales totales pagados de su bolsillo en 2025?',
    },
    shortLabel: { en: 'Medical & dental expenses', es: 'Gastos médicos y dentales' },
    guidance: {
      explanation: {
        en: 'Include amounts paid for doctor visits, hospital stays, prescriptions, dental care, vision care, and health insurance premiums paid with after-tax dollars. Only the amount exceeding 7.5% of AGI is deductible.',
        es: 'Incluya montos pagados por visitas médicas, hospitalizaciones, medicamentos recetados, atención dental, atención visual y primas de seguro médico pagadas con dólares después de impuestos. Solo el monto que excede el 7.5% del AGI es deducible.',
      },
      whereToFind: {
        en: 'Gather receipts, EOBs from insurance, pharmacy statements, and premium payment records. Do NOT include amounts reimbursed by insurance or paid through an HSA/FSA.',
        es: 'Reúna recibos, EOBs del seguro, estados de farmacia y registros de pago de primas. NO incluya montos reembolsados por el seguro o pagados a través de HSA/FSA.',
      },
      commonMistakes: {
        en: 'Do not include: cosmetic surgery (unless reconstructive), gym memberships, vitamins (unless prescribed), or expenses paid pre-tax through payroll deductions.',
        es: 'No incluir: cirugía cosmética (a menos que sea reconstructiva), membresías de gimnasio, vitaminas (a menos que sean recetadas) o gastos pagados antes de impuestos a través de deducciones de nómina.',
      },
      taxPlanningNote: {
        en: 'The 7.5% AGI floor means this deduction only helps filers with very large medical bills relative to income. If total expenses don\'t exceed 7.5% of AGI, the deduction is $0.',
        es: 'El piso del 7.5% del AGI significa que esta deducción solo ayuda a los contribuyentes con facturas médicas muy grandes en relación a sus ingresos.',
      },
      irsReferences: [{ title: 'IRS Pub 502 — Medical and Dental Expenses', url: 'https://www.irs.gov/publications/p502' }],
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ─── TAXES PAID ─────────────────────────────────────────────────────────

  {
    id: 'scheduleA.q.stateLocalIncomeTax',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What were the total state and local income taxes (or general sales taxes) paid in 2025?',
      es: '¿Cuáles fueron los impuestos estatales y locales sobre ingresos (o ventas generales) pagados en 2025?',
    },
    shortLabel: { en: 'State/local income or sales taxes', es: 'Impuestos estatales/locales sobre ingresos o ventas' },
    guidance: {
      explanation: {
        en: 'You may deduct either state/local income taxes OR general sales taxes — not both. Most filers choose income taxes. Check W-2 Box 17 for state wages withheld, and add any additional state tax paid with 2024 return or estimated payments in 2025.',
        es: 'Puede deducir impuestos estatales/locales sobre ingresos O impuestos generales sobre ventas — no ambos. La mayoría elige impuestos sobre ingresos. Revise el W-2 Casilla 17 para impuestos estatales retenidos.',
      },
      whereToFind: {
        en: 'W-2 Box 17 (state income tax withheld) + any state tax paid when filing 2024 state return + 2025 state estimated tax payments made.',
        es: 'W-2 Casilla 17 (impuesto estatal retenido) + impuesto estatal pagado al presentar la declaración estatal de 2024 + pagos estimados estatales de 2025.',
      },
      commonMistakes: {
        en: 'Don\'t add both income taxes and sales taxes — elect one. The combined SALT deduction (income + real estate + personal property) is capped at $10,000 ($5,000 MFS).',
        es: 'No agregue tanto impuestos sobre ingresos como impuestos sobre ventas — elija uno. La deducción SALT combinada está limitada a $10,000 ($5,000 para MFS).',
      },
      irsReferences: [{ title: 'IRS Pub 17 — State and Local Taxes', url: 'https://www.irs.gov/publications/p17', page: 'Chapter 23' }],
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleA.q.realEstateTax',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What were the total state and local real estate taxes paid in 2025?',
      es: '¿Cuáles fueron los impuestos inmobiliarios estatales y locales totales pagados en 2025?',
    },
    shortLabel: { en: 'Real estate taxes', es: 'Impuestos inmobiliarios' },
    guidance: {
      explanation: {
        en: 'Real property taxes paid on your home, vacation home, land, or other real estate. Include amounts paid from escrow if actually remitted to the taxing authority in 2025.',
        es: 'Impuestos sobre bienes inmuebles pagados en su hogar, casa de vacaciones, terreno u otros bienes raíces. Incluya montos pagados desde el depósito en garantía si se remitieron a la autoridad fiscal en 2025.',
      },
      whereToFind: {
        en: 'Form 1098 Box 10 (real estate taxes paid from escrow), county property tax bill, or mortgage servicer year-end statement.',
        es: 'Formulario 1098 Casilla 10 (impuestos inmobiliarios pagados desde el depósito en garantía), factura de impuestos de la propiedad del condado o estado de fin de año del administrador hipotecario.',
      },
      commonMistakes: {
        en: 'Do not include: assessments for local improvements (sidewalks, sewers), trash collection fees, or amounts escrowed but not yet paid to the taxing authority.',
        es: 'No incluir: evaluaciones por mejoras locales (aceras, alcantarillas), tarifas de recolección de basura o montos en depósito pero aún no pagados a la autoridad fiscal.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleA.q.personalPropertyTax',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Were any personal property taxes paid in 2025 (e.g., vehicle registration fees based on value)?',
      es: '¿Se pagaron impuestos sobre bienes personales en 2025 (p. ej., tarifas de registro de vehículos basadas en el valor)?',
    },
    shortLabel: { en: 'Personal property taxes', es: 'Impuestos sobre bienes personales' },
    guidance: {
      explanation: {
        en: 'State or local taxes on personal property where the tax is based on the VALUE of the property (ad valorem). Most common example: annual vehicle registration fee in states that charge based on vehicle value (e.g., Virginia, Colorado).',
        es: 'Impuestos estatales o locales sobre bienes personales donde el impuesto se basa en el VALOR de la propiedad (ad valorem). Ejemplo más común: tarifa anual de registro de vehículos en estados que cobran según el valor del vehículo.',
      },
      whereToFind: {
        en: 'Check your state vehicle registration receipt — only the portion based on value qualifies, not flat fees.',
        es: 'Revise el recibo de registro de su vehículo estatal — solo la porción basada en el valor califica, no las tarifas fijas.',
      },
      commonMistakes: {
        en: 'Most vehicle registration fees include a flat portion that is NOT deductible. Only the ad valorem (value-based) portion qualifies. When in doubt, check your state DMV website for the breakdown.',
        es: 'La mayoría de las tarifas de registro de vehículos incluyen una porción fija que NO es deducible. Solo la porción ad valorem (basada en el valor) califica.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleA.q.otherTaxes',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Were any other deductible taxes paid not included above?',
      es: '¿Se pagaron otros impuestos deducibles no incluidos arriba?',
    },
    shortLabel: { en: 'Other taxes', es: 'Otros impuestos' },
    guidance: {
      explanation: {
        en: 'Rare category — includes foreign income taxes not claimed as a foreign tax credit, and certain generation-skipping transfer taxes. Most filers enter $0.',
        es: 'Categoría rara — incluye impuestos sobre ingresos extranjeros no reclamados como crédito fiscal extranjero, y ciertos impuestos de transferencia de omisión de generación. La mayoría de los contribuyentes ingresa $0.',
      },
      whereToFind: {
        en: 'If you paid foreign taxes and chose deduction over credit, include here. Otherwise $0.',
        es: 'Si pagó impuestos extranjeros y eligió la deducción en lugar del crédito, inclúyalos aquí. De lo contrario, $0.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ─── MORTGAGE INTEREST ──────────────────────────────────────────────────

  {
    id: 'scheduleA.q.mortgageInterest1098',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What is the total home mortgage interest reported on Form 1098?',
      es: '¿Cuál es el total de intereses hipotecarios del hogar reportados en el Formulario 1098?',
    },
    shortLabel: { en: 'Mortgage interest (Form 1098)', es: 'Interés hipotecario (Formulario 1098)' },
    guidance: {
      explanation: {
        en: 'Enter the total from Box 1 of all Form 1098s received. If you have multiple mortgages (primary + second home), add all Box 1 amounts together. Subject to $750,000 acquisition debt limit for loans after 12/15/2017.',
        es: 'Ingrese el total de la Casilla 1 de todos los Formularios 1098 recibidos. Si tiene múltiples hipotecas (principal + segunda vivienda), sume todos los montos de la Casilla 1. Sujeto al límite de deuda de adquisición de $750,000 para préstamos después del 12/15/2017.',
      },
      whereToFind: {
        en: 'Form 1098 Box 1 from your mortgage lender(s). Usually mailed in January.',
        es: 'Formulario 1098 Casilla 1 de su(s) prestamista(s) hipotecario(s). Generalmente se envía por correo en enero.',
      },
      commonMistakes: {
        en: 'If total acquisition debt exceeds $750,000, only a portion of interest is deductible. For loans before 12/16/2017, the limit is $1,000,000. Consult Pub 936 for the exact worksheet.',
        es: 'Si la deuda de adquisición total excede $750,000, solo una parte del interés es deducible. Para préstamos anteriores al 12/16/2017, el límite es $1,000,000.',
      },
      irsReferences: [{ title: 'IRS Pub 936 — Home Mortgage Interest Deduction', url: 'https://www.irs.gov/publications/p936' }],
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  {
    id: 'scheduleA.q.mortgageInterestOther',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Was any home mortgage interest paid to someone who did NOT send a Form 1098?',
      es: '¿Se pagaron intereses hipotecarios a alguien que NO envió un Formulario 1098?',
    },
    shortLabel: { en: 'Mortgage interest (no Form 1098)', es: 'Interés hipotecario (sin Formulario 1098)' },
    guidance: {
      explanation: {
        en: 'This applies when you have a mortgage with a private party (e.g., seller financing, family member). You must include the lender\'s name, address, and SSN/TIN on Schedule A.',
        es: 'Esto aplica cuando tiene una hipoteca con un particular (p. ej., financiamiento del vendedor, familiar). Debe incluir el nombre, dirección y SSN/TIN del prestamista en el Anexo A.',
      },
      whereToFind: {
        en: 'Your own payment records and the loan agreement. The lender must provide their TIN for you to deduct this interest.',
        es: 'Sus propios registros de pago y el acuerdo del préstamo. El prestamista debe proporcionar su TIN para que pueda deducir este interés.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleA.q.points',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Were any mortgage points paid that are not already shown on Form 1098 Box 6?',
      es: '¿Se pagaron puntos hipotecarios que no están ya incluidos en el Formulario 1098 Casilla 6?',
    },
    shortLabel: { en: 'Points not on Form 1098', es: 'Puntos no en Formulario 1098' },
    guidance: {
      explanation: {
        en: 'Points (loan origination fees) paid to lower your interest rate on a home purchase are generally deductible in the year paid — but only for your main home and only if already shown on your HUD-1/settlement statement but NOT on Form 1098.',
        es: 'Los puntos (tarifas de originación de préstamos) pagados para reducir su tasa de interés en una compra de vivienda generalmente son deducibles en el año pagado — pero solo para su residencia principal y solo si ya se muestran en su HUD-1 pero NO en el Formulario 1098.',
      },
      whereToFind: {
        en: 'Closing disclosure / HUD-1 settlement statement from the home purchase. Points on refinances must generally be deducted over the loan life, not all at once.',
        es: 'Declaración de cierre / HUD-1 de la compra de la vivienda. Los puntos en refinanciamientos generalmente deben deducirse durante la vida del préstamo, no todos a la vez.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleA.q.investmentInterest',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Was any investment interest paid in 2025 (Form 4952)?',
      es: '¿Se pagaron intereses de inversión en 2025 (Formulario 4952)?',
    },
    shortLabel: { en: 'Investment interest', es: 'Interés de inversión' },
    guidance: {
      explanation: {
        en: 'Interest paid on money borrowed to purchase investments (stocks, bonds, etc.) held in a taxable account. Limited to net investment income. Form 4952 calculates the deductible amount.',
        es: 'Interés pagado por dinero prestado para comprar inversiones (acciones, bonos, etc.) en una cuenta gravable. Limitado al ingreso neto de inversión. El Formulario 4952 calcula el monto deducible.',
      },
      whereToFind: {
        en: 'Margin interest statements from your brokerage. Calculate deductible amount on Form 4952.',
        es: 'Estados de interés de margen de su corretaje. Calcule el monto deducible en el Formulario 4952.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ─── CHARITABLE CONTRIBUTIONS ───────────────────────────────────────────

  {
    id: 'scheduleA.q.cashContributions',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What were the total cash and check charitable contributions made in 2025?',
      es: '¿Cuáles fueron las contribuciones caritativas en efectivo y cheque totales realizadas en 2025?',
    },
    shortLabel: { en: 'Cash charitable contributions', es: 'Contribuciones caritativas en efectivo' },
    guidance: {
      explanation: {
        en: 'Include all cash, check, credit card, and electronic transfers to qualified charitable organizations. A bank record or written receipt is required for all donations. Written acknowledgment from the charity is required for single donations of $250 or more.',
        es: 'Incluya todo el efectivo, cheques, tarjetas de crédito y transferencias electrónicas a organizaciones caritativas calificadas. Se requiere un registro bancario o recibo escrito para todas las donaciones.',
      },
      whereToFind: {
        en: 'Bank statements, credit card statements, and donation receipts from charities. Many charities send year-end giving summaries.',
        es: 'Estados bancarios, estados de tarjeta de crédito y recibos de donación de organizaciones caritativas. Muchas organizaciones envían resúmenes de donaciones de fin de año.',
      },
      commonMistakes: {
        en: 'You cannot deduct: donations to individuals, political organizations, political candidates, or the value of your time/services. Also cannot deduct the portion of a donation that provides personal benefit (e.g., charity gala ticket cost minus the fair value of the dinner).',
        es: 'No puede deducir: donaciones a personas, organizaciones políticas, candidatos políticos o el valor de su tiempo/servicios.',
      },
      taxPlanningNote: {
        en: 'Cash contributions to public charities are limited to 60% of AGI. Excess is carried forward 5 years.',
        es: 'Las contribuciones en efectivo a organizaciones públicas están limitadas al 60% del AGI. El exceso se lleva adelante 5 años.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleA.q.nonCashContributions',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What was the total value of non-cash charitable contributions (clothing, household goods, securities, etc.)?',
      es: '¿Cuál fue el valor total de las contribuciones caritativas no monetarias (ropa, artículos del hogar, valores, etc.)?',
    },
    shortLabel: { en: 'Non-cash contributions', es: 'Contribuciones no monetarias' },
    guidance: {
      explanation: {
        en: 'The fair market value of donated property. Clothing and household goods must be in good used condition or better. Securities are valued at FMV on the date of donation. Form 8283 is required if total non-cash donations exceed $500.',
        es: 'El valor de mercado justo de la propiedad donada. La ropa y los artículos del hogar deben estar en buenas condiciones usadas o mejores. Los valores se valoran al FMV en la fecha de donación.',
      },
      whereToFind: {
        en: 'Receipts from Goodwill/Salvation Army, brokerage statements for stock donations, Form 8283 (if required). IRS Publication 561 explains how to value donated property.',
        es: 'Recibos de Goodwill/Ejército de Salvación, estados de corretaje para donaciones de acciones, Formulario 8283 (si es requerido).',
      },
      irsReferences: [{ title: 'IRS Pub 561 — Determining the Value of Donated Property', url: 'https://www.irs.gov/publications/p561' }],
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleA.q.charitableCarryover',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Is there a charitable contribution carryover from a prior tax year?',
      es: '¿Hay un arrastre de contribución caritativa de un año fiscal anterior?',
    },
    shortLabel: { en: 'Charitable carryover', es: 'Arrastre caritativo' },
    guidance: {
      explanation: {
        en: 'If prior-year charitable contributions exceeded AGI limits (60% for cash, 30% for capital gain property), the excess carries forward up to 5 years. Enter the carryover amount from prior year Schedule A worksheet.',
        es: 'Si las contribuciones caritativas del año anterior excedieron los límites del AGI, el exceso se lleva adelante hasta 5 años. Ingrese el monto del arrastre del año anterior.',
      },
      whereToFind: {
        en: 'Prior year Schedule A worksheet for charitable contribution carryover amounts.',
        es: 'Hoja de trabajo del Anexo A del año anterior para montos de arrastre de contribuciones caritativas.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ─── CASUALTY / OTHER ───────────────────────────────────────────────────

  {
    id: 'scheduleA.q.casualtyLosses',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Were there any casualty or theft losses from a federally declared disaster in 2025?',
      es: '¿Hubo pérdidas por accidente o robo de un desastre declarado federalmente en 2025?',
    },
    shortLabel: { en: 'Casualty/theft losses', es: 'Pérdidas por accidente/robo' },
    guidance: {
      explanation: {
        en: 'Post-TCJA (2018+), only losses from federally declared disaster areas are deductible. Subject to $100 per-casualty floor and 10% AGI floor. Calculate on Form 4684.',
        es: 'Post-TCJA (2018+), solo las pérdidas de áreas de desastre declaradas federalmente son deducibles. Sujeto al piso de $100 por accidente y el piso del 10% del AGI. Calcule en el Formulario 4684.',
      },
      whereToFind: {
        en: 'Form 4684. Check FEMA\'s disaster declaration list at disasterassistance.gov to verify federal declaration.',
        es: 'Formulario 4684. Consulte la lista de declaraciones de desastres de FEMA en disasterassistance.gov para verificar la declaración federal.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleA.q.otherDeductions',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Are there any other itemized deductions to report (gambling losses, impairment-related expenses, etc.)?',
      es: '¿Hay otras deducciones detalladas para reportar (pérdidas de juego, gastos relacionados con discapacidad, etc.)?',
    },
    shortLabel: { en: 'Other itemized deductions', es: 'Otras deducciones detalladas' },
    guidance: {
      explanation: {
        en: 'Includes: gambling losses (limited to gambling winnings reported on Schedule 1), impairment-related work expenses for disabled employees, unrecovered investment in a pension.',
        es: 'Incluye: pérdidas de juego (limitadas a las ganancias de juego reportadas en el Anexo 1), gastos de trabajo relacionados con discapacidad para empleados discapacitados, inversión no recuperada en una pensión.',
      },
      whereToFind: {
        en: 'W-2G forms for gambling winnings/losses records, employer disability accommodation documentation.',
        es: 'Formularios W-2G para registros de ganancias/pérdidas de juego, documentación de acomodaciones para discapacidad del empleador.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },
];