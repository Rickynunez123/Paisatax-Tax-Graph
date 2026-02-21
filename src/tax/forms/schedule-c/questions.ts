/**
 * paisatax-tax-graph/src/tax/forms/schedule-c/questions.ts
 *
 * Question definitions for Schedule C — Profit or Loss From Business.
 *
 * Covers: business identification, all income lines, all expense lines,
 * Part IV vehicle information.
 *
 * NAMING CONVENTION:
 *   questionId format: scheduleC.q.{shortName}
 *   Must match the node definition's `questionId` field in schedule-c/nodes.ts.
 *
 * AUDIENCE NOTE:
 *   Many PaisaTax users filing Schedule C are gig workers (Uber, Lyft,
 *   DoorDash, Instacart) or freelancers filing for the first time.
 *   Guidance is written to be accessible to first-time Schedule C filers
 *   while remaining accurate for more complex business situations.
 */

import type { QuestionDefinition } from '../../../core/question/question.types.js';
import { QuestionType } from '../../../core/question/question.types.js';

export const SCHEDULE_C_QUESTIONS: QuestionDefinition[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS IDENTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'scheduleC.q.businessName',
    questionType: QuestionType.FREE_TEXT,
    question: {
      en: 'What is the name of this business?',
      es: '¿Cuál es el nombre de este negocio?',
    },
    shortLabel: { en: 'Business name', es: 'Nombre del negocio' },
    guidance: {
      explanation: {
        en: 'Enter the name used to conduct this business. If you operate under your own name as a sole proprietor, you can enter your name or leave this blank.',
        es: 'Ingrese el nombre usado para este negocio. Si opera bajo su propio nombre como propietario único, puede ingresar su nombre o dejarlo en blanco.',
      },
      whereToFind: {
        en: 'Use the name that appears on your business bank account, contracts, or invoices. For gig workers (Uber, DoorDash, etc.), use your own name since you are the business.',
        es: 'Use el nombre que aparece en su cuenta bancaria de negocios, contratos o facturas. Para trabajadores de plataformas (Uber, DoorDash, etc.), use su propio nombre ya que usted es el negocio.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.businessEIN',
    questionType: QuestionType.FREE_TEXT,
    question: {
      en: 'Does this business have an Employer Identification Number (EIN)?',
      es: '¿Tiene este negocio un Número de Identificación del Empleador (EIN)?',
    },
    shortLabel: { en: 'Business EIN', es: 'EIN del negocio' },
    guidance: {
      explanation: {
        en: 'An EIN is a 9-digit number (format: XX-XXXXXXX) the IRS assigns to businesses. Most sole proprietors who have no employees use their Social Security Number instead and leave this blank.',
        es: 'Un EIN es un número de 9 dígitos (formato: XX-XXXXXXX) que el IRS asigna a los negocios. La mayoría de los propietarios únicos sin empleados usan su Número de Seguro Social y dejan esto en blanco.',
      },
      whereToFind: {
        en: 'Found on the EIN assignment letter from the IRS (CP 575), or on previously filed business tax returns. Leave blank if you don\'t have one.',
        es: 'Se encuentra en la carta de asignación de EIN del IRS (CP 575), o en declaraciones de impuestos de negocios presentadas anteriormente. Déjelo en blanco si no tiene uno.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.principalBusinessCode',
    questionType: QuestionType.FREE_TEXT,
    question: {
      en: 'What is the IRS Principal Business Code for this business?',
      es: '¿Cuál es el Código de Actividad Empresarial Principal del IRS para este negocio?',
    },
    shortLabel: { en: 'Business activity code', es: 'Código de actividad empresarial' },
    guidance: {
      explanation: {
        en: 'A 6-digit code that classifies your type of business. Used for IRS statistical purposes.',
        es: 'Un código de 6 dígitos que clasifica su tipo de negocio. Se usa con fines estadísticos del IRS.',
      },
      whereToFind: {
        en: 'Find the code in the Schedule C instructions (Appendix, page C-18). Common codes: 485300 (Taxi/Rideshare), 492000 (Couriers/Delivery), 541990 (Other Professional Services), 812990 (Other Personal Services), 999999 (Other).',
        es: 'Encuentre el código en las instrucciones del Anexo C (Apéndice). Códigos comunes: 485300 (Taxi/Rideshare), 492000 (Mensajería/Entrega), 541990 (Otros Servicios Profesionales), 812990 (Otros Servicios Personales), 999999 (Otro).',
      },
      commonMistakes: {
        en: 'Use 485300 for rideshare drivers (Uber/Lyft), 492000 for delivery drivers (DoorDash/Instacart), 541510 for software/IT freelancers, 711510 for artists/performers.',
        es: 'Use 485300 para conductores de rideshare (Uber/Lyft), 492000 para repartidores (DoorDash/Instacart), 541510 para freelancers de tecnología, 711510 para artistas/intérpretes.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.accountingMethod',
    questionType: QuestionType.SINGLE_CHOICE,
    question: {
      en: 'What accounting method does this business use?',
      es: '¿Qué método contable usa este negocio?',
    },
    shortLabel: { en: 'Accounting method', es: 'Método contable' },
    options: [
      {
        value: 'cash',
        label: { en: 'Cash', es: 'Base de efectivo' },
        hint: { en: 'Report income when received, expenses when paid. Most small businesses and gig workers.', es: 'Reportar ingresos cuando se reciben, gastos cuando se pagan. La mayoría de pequeños negocios.' },
      },
      {
        value: 'accrual',
        label: { en: 'Accrual', es: 'Base de devengo' },
        hint: { en: 'Report income when earned, expenses when incurred. Required for some larger businesses.', es: 'Reportar ingresos cuando se ganan, gastos cuando se incurren.' },
      },
    ],
    guidance: {
      explanation: {
        en: 'The accounting method determines when income and expenses are recognized for tax purposes.',
        es: 'El método contable determina cuándo se reconocen los ingresos y gastos para efectos fiscales.',
      },
      whereToFind: {
        en: 'Most gig workers and freelancers use Cash basis — they report money when they actually receive it. If unsure, select Cash.',
        es: 'La mayoría de los trabajadores de plataformas y freelancers usan la Base de efectivo. Si no está seguro, seleccione Efectivo.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PART I — INCOME
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'scheduleC.q.line1_grossReceipts',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What was the total income received from this business in 2025?',
      es: '¿Cuál fue el ingreso total recibido de este negocio en 2025?',
    },
    shortLabel: { en: 'Gross receipts (Line 1)', es: 'Ingresos brutos (Línea 1)' },
    guidance: {
      explanation: {
        en: 'Enter ALL income earned from this business in 2025, regardless of whether you received a 1099-NEC. Include cash, checks, Venmo, Zelle, PayPal, and any other payment method.',
        es: 'Ingrese TODOS los ingresos ganados de este negocio en 2025, independientemente de si recibió un 1099-NEC. Incluya efectivo, cheques, Venmo, Zelle, PayPal y cualquier otro método de pago.',
      },
      whereToFind: {
        en: 'For gig workers: check your platform\'s annual tax summary (Uber/Lyft Tax Summary, DoorDash/Instacart year-end report). Add all 1099-NEC Box 1 amounts plus any cash or under-$600 payments not on a 1099. For freelancers: total all invoices paid in 2025.',
        es: 'Para trabajadores de plataformas: revise el resumen fiscal anual de su plataforma. Sume todos los montos de la Casilla 1 del 1099-NEC más cualquier pago en efectivo o menor a $600. Para freelancers: totalice todas las facturas pagadas en 2025.',
      },
      commonMistakes: {
        en: 'CRITICAL: You must report ALL income, not just what\'s on 1099-NEC forms. Clients are only required to send 1099-NECs for payments of $600 or more. Smaller payments are still taxable income. The IRS receives copies of all 1099-NECs and will compare them to your return.',
        es: 'CRÍTICO: Debe reportar TODOS los ingresos, no solo lo que está en los formularios 1099-NEC. Los clientes solo están obligados a enviar 1099-NECs por pagos de $600 o más. Los pagos menores siguen siendo ingresos gravables.',
      },
      taxPlanningNote: {
        en: 'Your gross receipts on Line 1 must be equal to or greater than the sum of all 1099-NEC Box 1 amounts you received. The IRS will flag your return if it\'s less.',
        es: 'Sus ingresos brutos en la Línea 1 deben ser iguales o mayores a la suma de todos los montos de la Casilla 1 del 1099-NEC que recibió.',
      },
      irsReferences: [
        { title: 'IRS Pub 334 — Tax Guide for Small Business', url: 'https://www.irs.gov/publications/p334' },
      ],
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line2_returnsAllowances',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Did you give any refunds or credit allowances to customers in 2025?',
      es: '¿Dio algún reembolso o descuento a clientes en 2025?',
    },
    shortLabel: { en: 'Returns & allowances (Line 2)', es: 'Devoluciones y descuentos (Línea 2)' },
    guidance: {
      explanation: {
        en: 'Refunds or credits given to customers for returned merchandise or dissatisfaction. Most service businesses and gig workers enter $0.',
        es: 'Reembolsos o créditos dados a clientes por mercancía devuelta o insatisfacción. La mayoría de los negocios de servicios ingresan $0.',
      },
      whereToFind: {
        en: 'Review your records for any customer refunds issued in 2025. Most freelancers and gig workers have no returns to report.',
        es: 'Revise sus registros de cualquier reembolso a clientes emitido en 2025. La mayoría de los freelancers y trabajadores de plataformas no tienen devoluciones que reportar.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line4_costOfGoodsSold',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What was the cost of goods sold for this business in 2025?',
      es: '¿Cuál fue el costo de los bienes vendidos para este negocio en 2025?',
    },
    shortLabel: { en: 'Cost of goods sold (Line 4)', es: 'Costo de mercancía vendida (Línea 4)' },
    guidance: {
      explanation: {
        en: 'The cost of inventory or products sold. Service businesses and gig workers (Uber, freelancers, etc.) typically enter $0 here — you sell your time and skills, not products.',
        es: 'El costo del inventario o productos vendidos. Los negocios de servicios y trabajadores de plataformas típicamente ingresan $0 aquí.',
      },
      whereToFind: {
        en: 'If you sell physical products, calculate from Part III of Schedule C. If you provide only services, enter $0.',
        es: 'Si vende productos físicos, calcule desde la Parte III del Anexo C. Si solo presta servicios, ingrese $0.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line5a_1099necIncome',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What is the total amount shown on all 1099-NEC forms for this business?',
      es: '¿Cuál es el monto total mostrado en todos los formularios 1099-NEC para este negocio?',
    },
    shortLabel: { en: '1099-NEC total (informational)', es: 'Total 1099-NEC (informativo)' },
    guidance: {
      explanation: {
        en: 'Enter the sum of all Box 1 amounts from 1099-NEC forms related to this business. This is for verification only — your actual gross receipts (Line 1) must equal or exceed this amount.',
        es: 'Ingrese la suma de todos los montos de la Casilla 1 de los formularios 1099-NEC relacionados con este negocio. Esto es solo para verificación.',
      },
      whereToFind: {
        en: 'Add up Box 1 from all 1099-NEC forms you received for this business type. If you have multiple 1099-NECs entered in the system, the total will be pre-populated.',
        es: 'Sume la Casilla 1 de todos los formularios 1099-NEC que recibió para este tipo de negocio.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line6_otherIncome',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Did this business have any other income not from sales or services?',
      es: '¿Tuvo este negocio algún otro ingreso que no sea de ventas o servicios?',
    },
    shortLabel: { en: 'Other business income (Line 6)', es: 'Otros ingresos del negocio (Línea 6)' },
    guidance: {
      explanation: {
        en: 'Other income not from normal sales. Examples: fuel tax credits, prizes won in business context, recovered bad debts, income from business-related interest.',
        es: 'Otros ingresos que no son de ventas normales. Ejemplos: créditos de impuesto de combustible, premios ganados en contexto de negocios, deudas incobrables recuperadas.',
      },
      whereToFind: {
        en: 'Most small businesses enter $0 here. If you received any government grants or unusual business-related income, enter it here.',
        es: 'La mayoría de los pequeños negocios ingresan $0 aquí.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PART II — EXPENSES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'scheduleC.q.line8_advertising',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you spend on advertising for this business in 2025?',
      es: '¿Cuánto gastó en publicidad para este negocio en 2025?',
    },
    shortLabel: { en: 'Advertising (Line 8)', es: 'Publicidad (Línea 8)' },
    guidance: {
      explanation: {
        en: 'All costs to advertise your business or attract customers.',
        es: 'Todos los costos para anunciar su negocio o atraer clientes.',
      },
      whereToFind: {
        en: 'Includes: Google/Facebook/Instagram ads, business cards, flyers, Yelp/Thumbtack listings, website costs for marketing, promotional materials. Does NOT include website hosting (use Line 27a) or your own personal social media posts.',
        es: 'Incluye: anuncios de Google/Facebook/Instagram, tarjetas de presentación, volantes, listados en directorios, materiales promocionales.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line9_parkingTolls',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you pay for business-related parking fees and tolls in 2025?',
      es: '¿Cuánto pagó en tarifas de estacionamiento y peajes relacionados con el negocio en 2025?',
    },
    shortLabel: { en: 'Parking & tolls', es: 'Estacionamiento y peajes' },
    guidance: {
      explanation: {
        en: 'Business-related parking and toll costs are added on top of your mileage deduction. These are not already included in the standard mileage rate.',
        es: 'Los costos de estacionamiento y peajes relacionados con el negocio se agregan encima de su deducción de millaje. Estos NO están incluidos en la tarifa de millaje estándar.',
      },
      whereToFind: {
        en: 'For rideshare/delivery drivers: check your app\'s expense section or bank/credit card statements for parking and toll charges paid while working. Keep receipts or use E-ZPass/FasTrak records.',
        es: 'Para conductores de rideshare/entrega: revise la sección de gastos de su aplicación o estados de cuenta bancarios/tarjetas de crédito por cargos de estacionamiento y peajes mientras trabajaba.',
      },
      taxPlanningNote: {
        en: 'For rideshare drivers: platform fees (Uber/Lyft service fee) go on Line 10, not here. Tolls and parking go here and are added to the mileage deduction.',
        es: 'Para conductores de rideshare: las tarifas de plataforma van en la Línea 10, no aquí. Los peajes y el estacionamiento van aquí.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line10_commissionsFees',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you pay in commissions and fees in 2025?',
      es: '¿Cuánto pagó en comisiones y honorarios en 2025?',
    },
    shortLabel: { en: 'Commissions & fees (Line 10)', es: 'Comisiones y honorarios (Línea 10)' },
    guidance: {
      explanation: {
        en: 'Commissions and fees paid to others to generate your income.',
        es: 'Comisiones y honorarios pagados a otros para generar sus ingresos.',
      },
      whereToFind: {
        en: 'For rideshare drivers: the platform\'s service fee (the % Uber/Lyft keeps from each ride) is your largest deductible commission. Find this on your annual tax summary from the platform. For Etsy sellers: Etsy\'s transaction fees and listing fees. For freelancers: marketplace fees (Upwork, Fiverr, Toptal service fees).',
        es: 'Para conductores de rideshare: la tarifa de servicio de la plataforma (el % que Uber/Lyft retiene de cada viaje) es su comisión deducible más grande. Para vendedores en marketplaces: las tarifas de transacción.',
      },
      commonMistakes: {
        en: 'Platform service fees are commissions, not contract labor. Use Line 10. Contract labor (Line 11) is for hiring subcontractors to do work FOR you.',
        es: 'Las tarifas de servicio de la plataforma son comisiones, no mano de obra por contrato. Use la Línea 10.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line11_contractLabor',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you pay to independent contractors for help with this business in 2025?',
      es: '¿Cuánto le pagó a contratistas independientes por ayuda con este negocio en 2025?',
    },
    shortLabel: { en: 'Contract labor (Line 11)', es: 'Mano de obra contratada (Línea 11)' },
    guidance: {
      explanation: {
        en: 'Payments to independent contractors who helped operate your business.',
        es: 'Pagos a contratistas independientes que ayudaron a operar su negocio.',
      },
      whereToFind: {
        en: 'Payments to subcontractors, virtual assistants, or other self-employed helpers. You must issue Form 1099-NEC to anyone paid $600 or more. Do NOT include W-2 employees here (use Line 26).',
        es: 'Pagos a subcontratistas, asistentes virtuales u otros ayudantes independientes. Debe emitir el Formulario 1099-NEC a cualquiera a quien le pague $600 o más.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line13_depreciation',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What is the depreciation deduction for this business (from Form 4562)?',
      es: '¿Cuál es la deducción por depreciación para este negocio (del Formulario 4562)?',
    },
    shortLabel: { en: 'Depreciation (Line 13)', es: 'Depreciación (Línea 13)' },
    guidance: {
      explanation: {
        en: 'Depreciation of business assets (equipment, computers, furniture) and Section 179 deduction. Calculated on Form 4562.',
        es: 'Depreciación de activos del negocio (equipos, computadoras, muebles) y deducción de la Sección 179. Se calcula en el Formulario 4562.',
      },
      whereToFind: {
        en: 'If you purchased major equipment for the business, calculate depreciation on Form 4562 and enter the total here. For most gig workers with no major equipment purchases, this is $0. Note: if using the standard mileage rate for your vehicle, do NOT include vehicle depreciation here — it\'s already factored into the mileage rate.',
        es: 'Si compró equipo importante para el negocio, calcule la depreciación en el Formulario 4562. Para la mayoría de los trabajadores de plataformas sin compras importantes de equipo, esto es $0.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line14_employeeBenefits',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you spend on employee benefit programs in 2025?',
      es: '¿Cuánto gastó en programas de beneficios para empleados en 2025?',
    },
    shortLabel: { en: 'Employee benefits (Line 14)', es: 'Beneficios de empleados (Línea 14)' },
    guidance: {
      explanation: {
        en: 'Contributions to employee health insurance, life insurance, disability plans, and other benefit programs. Only for benefits provided to employees — not for your own coverage as the owner.',
        es: 'Contribuciones al seguro de salud de empleados, seguro de vida, planes de discapacidad y otros programas de beneficios. Solo para beneficios a empleados, no para su propia cobertura como propietario.',
      },
      whereToFind: {
        en: 'Review payroll records or insurance invoices for employee benefit costs. Most sole proprietors without employees enter $0. Your own health insurance deduction goes on Schedule 1 Part II, not here.',
        es: 'Revise registros de nómina o facturas de seguros. La mayoría de los propietarios únicos sin empleados ingresan $0.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line15_insurance',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you pay for business insurance (other than health insurance) in 2025?',
      es: '¿Cuánto pagó por seguro de negocio (que no sea seguro de salud) en 2025?',
    },
    shortLabel: { en: 'Business insurance (Line 15)', es: 'Seguro de negocio (Línea 15)' },
    guidance: {
      explanation: {
        en: 'Insurance premiums for your business — liability, property, professional indemnity, etc. Does NOT include health insurance (Schedule 1) or vehicle insurance when using standard mileage (already in the rate).',
        es: 'Primas de seguro para su negocio — responsabilidad civil, propiedad, indemnización profesional, etc. NO incluye seguro de salud ni seguro de vehículo si usa la tarifa de millaje estándar.',
      },
      whereToFind: {
        en: 'Review insurance policy invoices or annual statements. Common for: general liability insurance, professional liability (E&O), property insurance for business equipment. For rideshare drivers: Uber/Lyft provides commercial insurance while on the platform — your personal car insurance is not deductible here when using standard mileage.',
        es: 'Revise facturas de pólizas de seguro. Común para: seguro de responsabilidad general, seguro de responsabilidad profesional, seguro de propiedad.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line16a_mortgageInterest',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Did you pay mortgage interest on a business property to a bank or financial institution in 2025?',
      es: '¿Pagó intereses hipotecarios sobre una propiedad de negocio a un banco o institución financiera en 2025?',
    },
    shortLabel: { en: 'Mortgage interest — bank (Line 16a)', es: 'Interés hipotecario — banco (Línea 16a)' },
    guidance: {
      explanation: {
        en: 'Interest paid on a mortgage for business property (not your home) to a bank or financial institution. Reported on Form 1098.',
        es: 'Interés pagado sobre una hipoteca para propiedad comercial (no su hogar) a un banco o institución financiera.',
      },
      whereToFind: {
        en: 'Check Form 1098 from your lender. Most gig workers and service businesses enter $0.',
        es: 'Revise el Formulario 1098 de su prestamista. La mayoría de los trabajadores de plataformas ingresan $0.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line16b_otherInterest',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Did you pay interest on any other business loans or credit cards used for business in 2025?',
      es: '¿Pagó intereses sobre otros préstamos de negocios o tarjetas de crédito usadas para el negocio en 2025?',
    },
    shortLabel: { en: 'Other business interest (Line 16b)', es: 'Otro interés de negocio (Línea 16b)' },
    guidance: {
      explanation: {
        en: 'Interest on business loans, lines of credit, and the business portion of credit card interest.',
        es: 'Interés sobre préstamos de negocios, líneas de crédito y la porción comercial del interés de tarjetas de crédito.',
      },
      whereToFind: {
        en: 'Review bank statements and credit card statements for interest charges on business accounts. If you use a card for both business and personal, only deduct the business portion. Keep documentation showing which charges were for business.',
        es: 'Revise estados de cuenta bancarios y de tarjetas de crédito. Si usa una tarjeta para negocios y uso personal, solo deduzca la porción de negocios.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line17_legalProfessional',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you pay for legal and professional services for this business in 2025?',
      es: '¿Cuánto pagó por servicios legales y profesionales para este negocio en 2025?',
    },
    shortLabel: { en: 'Legal & professional (Line 17)', es: 'Legal y profesional (Línea 17)' },
    guidance: {
      explanation: {
        en: 'Fees paid to attorneys, accountants, tax preparers, and consultants for business purposes.',
        es: 'Honorarios pagados a abogados, contadores, preparadores de impuestos y consultores por razones de negocios.',
      },
      whereToFind: {
        en: 'Includes: attorney fees for business contracts, accountant fees for business bookkeeping, tax preparation fees for the Schedule C portion of your return, consulting fees. Note: the tax preparation fee for Schedule C specifically is deductible here; personal tax prep fees are not deductible.',
        es: 'Incluye: honorarios de abogados por contratos comerciales, honorarios de contador, honorarios de preparación de impuestos para la parte del Anexo C de su declaración.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line18_officeExpense',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you spend on office supplies and postage for this business in 2025?',
      es: '¿Cuánto gastó en suministros de oficina y franqueo postal para este negocio en 2025?',
    },
    shortLabel: { en: 'Office expense (Line 18)', es: 'Gastos de oficina (Línea 18)' },
    guidance: {
      explanation: {
        en: 'Office supplies consumed in running the business. Postage and shipping for business purposes.',
        es: 'Suministros de oficina usados en el negocio. Franqueo y envío con fines comerciales.',
      },
      whereToFind: {
        en: 'Includes: paper, pens, printer ink, file folders, postage stamps, shipping costs for business packages. Does NOT include large equipment (use Line 13) or home office costs (use Line 30).',
        es: 'Incluye: papel, bolígrafos, tinta de impresora, carpetas, sellos postales, costos de envío. NO incluye equipo grande ni costos de oficina en el hogar.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line20a_rentLeaseVehicles',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you pay to rent or lease vehicles, machinery, or equipment for this business in 2025?',
      es: '¿Cuánto pagó por alquilar o arrendar vehículos, maquinaria o equipo para este negocio en 2025?',
    },
    shortLabel: { en: 'Rent/lease — vehicles, equipment (Line 20a)', es: 'Alquiler — vehículos, equipo (Línea 20a)' },
    guidance: {
      explanation: {
        en: 'Rent or lease payments for business vehicles, machinery, and equipment.',
        es: 'Pagos de alquiler o arrendamiento de vehículos, maquinaria y equipo de negocios.',
      },
      whereToFind: {
        en: 'Important: if you are using the standard mileage rate for a leased vehicle, do NOT enter the lease payment here. The standard mileage rate covers lease costs for the vehicle. Only enter lease costs here if you are NOT using standard mileage for that vehicle, or for non-vehicle equipment leases.',
        es: 'Importante: si usa la tarifa de millaje estándar para un vehículo arrendado, NO ingrese el pago de arrendamiento aquí. La tarifa estándar ya cubre los costos de arrendamiento del vehículo.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line20b_rentLeaseOther',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you pay to rent business space (office, retail, storage) in 2025?',
      es: '¿Cuánto pagó por rentar espacio de negocios (oficina, local comercial, almacenamiento) en 2025?',
    },
    shortLabel: { en: 'Rent — business property (Line 20b)', es: 'Renta — propiedad de negocios (Línea 20b)' },
    guidance: {
      explanation: {
        en: 'Rent paid for office space, retail store, warehouse, storage unit, coworking space, or any other business property.',
        es: 'Renta pagada por espacio de oficina, local comercial, almacén, unidad de almacenamiento, espacio de coworking u otra propiedad de negocios.',
      },
      whereToFind: {
        en: 'Review lease agreements and rent receipts for business locations. If you work from home, use the home office deduction (Line 30) instead — do not enter home rent here.',
        es: 'Revise contratos de arrendamiento y recibos de renta para ubicaciones de negocios. Si trabaja desde casa, use la deducción de oficina en el hogar (Línea 30).',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line21_repairs',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you spend on repairs and maintenance for business property or equipment in 2025?',
      es: '¿Cuánto gastó en reparaciones y mantenimiento de propiedad o equipo de negocio en 2025?',
    },
    shortLabel: { en: 'Repairs & maintenance (Line 21)', es: 'Reparaciones y mantenimiento (Línea 21)' },
    guidance: {
      explanation: {
        en: 'Cost to repair or maintain business equipment and property. Does not include vehicle repairs if using the standard mileage rate.',
        es: 'Costo de reparar o mantener equipo y propiedad del negocio. No incluye reparaciones de vehículos si usa la tarifa de millaje estándar.',
      },
      whereToFind: {
        en: 'Includes: computer repairs, equipment maintenance, repairs to business furniture or fixtures. If using standard mileage for your car, vehicle repairs are NOT deductible separately — they\'re already in the rate.',
        es: 'Incluye: reparaciones de computadora, mantenimiento de equipo, reparaciones de muebles o accesorios del negocio.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line22_supplies',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you spend on supplies used in this business in 2025?',
      es: '¿Cuánto gastó en suministros usados en este negocio en 2025?',
    },
    shortLabel: { en: 'Supplies (Line 22)', es: 'Suministros (Línea 22)' },
    guidance: {
      explanation: {
        en: 'Materials and supplies consumed in the business — not resold to customers and not capital assets.',
        es: 'Materiales y suministros consumidos en el negocio — no revendidos a clientes ni activos de capital.',
      },
      whereToFind: {
        en: 'Includes: cleaning supplies (for house cleaners), packaging materials (for sellers), tools under $2,500 (de minimis safe harbor), phone accessories used for business. Does NOT include inventory to be resold (that goes in COGS) or equipment lasting more than a year (use Line 13).',
        es: 'Incluye: suministros de limpieza, materiales de empaque, herramientas bajo $2,500, accesorios de teléfono usados para el negocio.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line23_taxesLicenses',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you pay in business taxes and licenses in 2025?',
      es: '¿Cuánto pagó en impuestos y licencias de negocio en 2025?',
    },
    shortLabel: { en: 'Taxes & licenses (Line 23)', es: 'Impuestos y licencias (Línea 23)' },
    guidance: {
      explanation: {
        en: 'Business-related taxes and license fees. Does NOT include federal income tax or self-employment tax.',
        es: 'Impuestos y tarifas de licencia relacionados con el negocio. NO incluye el impuesto federal sobre la renta ni el impuesto sobre el trabajo por cuenta propia.',
      },
      whereToFind: {
        en: 'Includes: state/local business licenses, professional licenses, sales tax paid on business purchases (not collected from customers), vehicle registration fees for business vehicles (only if NOT using standard mileage), city business permits.',
        es: 'Incluye: licencias de negocio estatales/locales, licencias profesionales, impuesto de ventas pagado en compras de negocios, permisos de negocios de la ciudad.',
      },
      commonMistakes: {
        en: 'Do NOT include: federal or state income taxes, self-employment tax, payroll taxes on employees (those are Line 26 related), or estimated tax payments.',
        es: 'NO incluya: impuestos federales o estatales sobre la renta, impuesto sobre el trabajo por cuenta propia, impuestos sobre la nómina de empleados, ni pagos de impuestos estimados.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line24a_travel',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you spend on business travel (not including meals) in 2025?',
      es: '¿Cuánto gastó en viajes de negocios (sin incluir comidas) en 2025?',
    },
    shortLabel: { en: 'Travel (Line 24a)', es: 'Viajes (Línea 24a)' },
    guidance: {
      explanation: {
        en: 'Business travel expenses excluding meals. Travel must be away from your tax home overnight for business.',
        es: 'Gastos de viajes de negocios excluyendo comidas. El viaje debe ser fuera de su hogar tributario durante la noche.',
      },
      whereToFind: {
        en: 'Includes: airfare, train/bus tickets, hotel/lodging, rental car, Uber/Lyft while traveling for business, baggage fees. Does NOT include meals (Line 24b), commuting (never deductible), or local transportation for daily business use (use Line 9 — car expenses).',
        es: 'Incluye: boletos de avión/tren, hotel, alquiler de auto, Uber/Lyft durante viajes de negocios, tarifas de equipaje. NO incluye comidas (Línea 24b) ni desplazamientos diarios.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line24b_mealsActual',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you spend on business meals in 2025? (Enter the full amount — the 50% limit is applied automatically)',
      es: '¿Cuánto gastó en comidas de negocios en 2025? (Ingrese el monto total — el límite del 50% se aplica automáticamente)',
    },
    shortLabel: { en: 'Business meals — full amount (Line 24b)', es: 'Comidas de negocios — monto total (Línea 24b)' },
    guidance: {
      explanation: {
        en: 'Business meals are 50% deductible. Enter the full amount you paid — the engine automatically applies the 50% limit. Only $0.50 of every $1.00 spent will reduce your taxable income.',
        es: 'Las comidas de negocios son deducibles al 50%. Ingrese el monto total que pagó — el sistema aplica automáticamente el límite del 50%.',
      },
      whereToFind: {
        en: 'Qualifying business meals: (1) must have a clear business purpose, (2) taxpayer or employee must be present, (3) meal is with a client, customer, employee, or business contact. Keep receipts noting who you dined with and the business purpose. Does NOT include meals during commuting, personal meals, or lavish/extravagant meals.',
        es: 'Comidas de negocios calificadas: (1) deben tener un propósito de negocio claro, (2) el contribuyente o empleado debe estar presente, (3) la comida es con un cliente, empleado o contacto de negocios.',
      },
      commonMistakes: {
        en: 'The 50% limit is automatic — enter the FULL amount you paid. Do not pre-calculate 50% yourself. Also: entertainment (concerts, sports tickets) is NOT deductible — only the meal portion qualifies.',
        es: 'El límite del 50% es automático — ingrese el monto COMPLETO que pagó. No precalcule el 50% usted mismo.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line25_utilities',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you pay for utilities for your business premises in 2025?',
      es: '¿Cuánto pagó por servicios públicos para su local de negocios en 2025?',
    },
    shortLabel: { en: 'Utilities (Line 25)', es: 'Servicios públicos (Línea 25)' },
    guidance: {
      explanation: {
        en: 'Utility costs for a dedicated business location — not for your home.',
        es: 'Costos de servicios públicos para un local de negocios dedicado — no para su hogar.',
      },
      whereToFind: {
        en: 'Electricity, gas, water, internet, and phone for a dedicated business space (office, shop, studio). If you work from home, use the home office deduction (Line 30) for the business portion of home utilities — do not enter them here.',
        es: 'Electricidad, gas, agua, internet y teléfono para un espacio de negocios dedicado. Si trabaja desde casa, use la deducción de oficina en el hogar (Línea 30).',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line26_wages',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'How much did you pay in wages to employees of this business in 2025?',
      es: '¿Cuánto pagó en salarios a empleados de este negocio en 2025?',
    },
    shortLabel: { en: 'Employee wages (Line 26)', es: 'Salarios de empleados (Línea 26)' },
    guidance: {
      explanation: {
        en: 'Gross wages paid to W-2 employees before any withholding.',
        es: 'Salarios brutos pagados a empleados con formulario W-2 antes de cualquier retención.',
      },
      whereToFind: {
        en: 'Total of all W-2 Box 1 amounts for employees of THIS business. Do NOT include: your own salary as the business owner (sole proprietors cannot pay themselves wages), independent contractors (use Line 11), or amounts already deducted through employment credits.',
        es: 'Total de todos los montos de la Casilla 1 del W-2 para empleados de ESTE negocio. NO incluya: su propio salario como propietario, contratistas independientes (Línea 11).',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line27a_otherExpenses',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What is the total of other business expenses not listed above (Part V total)?',
      es: '¿Cuál es el total de otros gastos de negocios no listados arriba (total de la Parte V)?',
    },
    shortLabel: { en: 'Other expenses — Part V total (Line 27a)', es: 'Otros gastos — total Parte V (Línea 27a)' },
    guidance: {
      explanation: {
        en: 'Business expenses that don\'t fit in any of the above lines. Each expense must be described in Part V (Schedule C, page 2). Enter the total here.',
        es: 'Gastos de negocios que no encajan en ninguna de las líneas anteriores. Cada gasto debe describirse en la Parte V (Anexo C, página 2). Ingrese el total aquí.',
      },
      whereToFind: {
        en: 'Common "other" expenses for gig workers and freelancers: (1) Phone bill — business portion (if using for business), (2) Software subscriptions (QuickBooks, Adobe, etc.), (3) Professional dues and subscriptions, (4) Bank fees for business account, (5) Background check fees (rideshare), (6) Merchant processing fees (Square, Stripe, PayPal fees), (7) Business-related books and training.',
        es: 'Gastos "otros" comunes: (1) Factura de teléfono — porción comercial, (2) Suscripciones de software, (3) Cuotas profesionales, (4) Tarifas bancarias, (5) Tarifas de verificación de antecedentes, (6) Tarifas de procesamiento de pagos.',
      },
      taxPlanningNote: {
        en: 'Your cell phone is deductible if used for business — but only the business-use percentage. If you use your phone 70% for business, deduct 70% of the bill.',
        es: 'Su teléfono celular es deducible si se usa para negocios — pero solo el porcentaje de uso comercial.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line30_homeOffice',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'Do you have a home office deduction for this business (from Form 8829 or simplified method)?',
      es: '¿Tiene una deducción de oficina en el hogar para este negocio (del Formulario 8829 o método simplificado)?',
    },
    shortLabel: { en: 'Home office deduction (Line 30)', es: 'Deducción de oficina en el hogar (Línea 30)' },
    guidance: {
      explanation: {
        en: 'If you use part of your home regularly and exclusively for business, you may deduct home office expenses. Calculate using Form 8829 (actual expenses) or the simplified method ($5/sq ft, max 300 sq ft = $1,500 max).',
        es: 'Si usa parte de su hogar regular y exclusivamente para negocios, puede deducir gastos de oficina en el hogar. Calcule usando el Formulario 8829 o el método simplificado ($5/pie cuadrado, máximo 300 pies cuadrados = $1,500 máximo).',
      },
      whereToFind: {
        en: 'To qualify: the space must be used (1) regularly and (2) exclusively for business. A dedicated room qualifies. A kitchen table used sometimes does not. Calculate on Form 8829 or use simplified: measure the business area in square feet × $5, max $1,500.',
        es: 'Para calificar: el espacio debe usarse (1) regular y (2) exclusivamente para negocios. Una habitación dedicada califica. Una mesa de cocina usada a veces no califica.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PART IV — VEHICLE INFORMATION
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'scheduleC.q.line43_datePlacedInService',
    questionType: QuestionType.FREE_TEXT,
    question: {
      en: 'When was this vehicle first used for business purposes?',
      es: '¿Cuándo se usó este vehículo por primera vez para fines de negocios?',
    },
    shortLabel: { en: 'Date vehicle placed in service (Line 43)', es: 'Fecha en que el vehículo entró en servicio (Línea 43)' },
    guidance: {
      explanation: {
        en: 'The date you first used this vehicle for business. Format: MM/DD/YYYY.',
        es: 'La fecha en que usó por primera vez este vehículo para negocios. Formato: MM/DD/AAAA.',
      },
      whereToFind: {
        en: 'If you started driving for rideshare or delivery this year, it\'s your first day on the platform. If you\'ve been using your vehicle for business for multiple years, enter the original date it was first used for business.',
        es: 'Si comenzó a manejar para rideshare o entrega este año, es su primer día en la plataforma. Si ha usado su vehículo para negocios por varios años, ingrese la fecha original.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line44a_businessMiles',
    questionType: QuestionType.INTEGER,
    question: {
      en: 'How many miles did you drive for business purposes in 2025?',
      es: '¿Cuántas millas manejó con fines de negocios en 2025?',
    },
    shortLabel: { en: 'Business miles (Line 44a)', es: 'Millas de negocios (Línea 44a)' },
    guidance: {
      explanation: {
        en: 'Business miles driven in 2025. Multiply by $0.70 to get your mileage deduction. This is the most important vehicle number for most gig workers.',
        es: 'Millas de negocios conducidas en 2025. Multiplique por $0.70 para obtener su deducción de millaje. Este es el número de vehículo más importante para la mayoría de los trabajadores de plataformas.',
      },
      whereToFind: {
        en: 'For rideshare drivers: your platform\'s annual tax summary shows online miles. Also include miles driving TO the first pickup and FROM the last dropoff if for the sole purpose of working. For ALL drivers: you should maintain a mileage log (date, starting point, destination, business purpose, miles). Apps like MileIQ, Everlance, or Stride automatically track miles.',
        es: 'Para conductores de rideshare: el resumen fiscal anual de su plataforma muestra las millas en línea. Para TODOS los conductores: debe mantener un registro de millaje (fecha, punto de inicio, destino, propósito de negocios, millas).',
      },
      commonMistakes: {
        en: 'Commuting miles (home to your first stop, last stop to home) are NOT business miles. However, if you drive directly from home to a client (not a regular office), those miles may qualify. For rideshare: miles while waiting for a ride request DO count as business miles.',
        es: 'Las millas de desplazamiento (hogar al primer punto, último punto al hogar) NO son millas de negocios. Para rideshare: las millas mientras espera una solicitud de viaje SÍ cuentan como millas de negocios.',
      },
      taxPlanningNote: {
        en: '2025 standard mileage rate: $0.70 per mile. Example: 10,000 business miles × $0.70 = $7,000 deduction. This is often the largest single deduction for gig economy workers.',
        es: 'Tarifa de millaje estándar 2025: $0.70 por milla. Ejemplo: 10,000 millas × $0.70 = $7,000 de deducción. Esta es a menudo la deducción individual más grande para trabajadores de la economía gig.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line44b_commutingMiles',
    questionType: QuestionType.INTEGER,
    question: {
      en: 'How many miles did you drive for commuting (home to regular workplace) in 2025?',
      es: '¿Cuántas millas manejó para desplazarse (hogar al lugar de trabajo regular) en 2025?',
    },
    shortLabel: { en: 'Commuting miles (Line 44b)', es: 'Millas de desplazamiento (Línea 44b)' },
    guidance: {
      explanation: {
        en: 'Miles driven between your home and your regular place of business. These are NOT deductible — required for IRS record-keeping.',
        es: 'Millas conducidas entre su hogar y su lugar de trabajo regular. Estas NO son deducibles — requeridas para los registros del IRS.',
      },
      whereToFind: {
        en: 'Calculate from your home to your regular office or business location and back, times the number of days you commuted. For most gig workers who work from home or drive from home to start working, this may be $0.',
        es: 'Calcule desde su hogar hasta su oficina o ubicación de negocios regular y de regreso, multiplicado por el número de días que se desplazó.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line44c_otherMiles',
    questionType: QuestionType.INTEGER,
    question: {
      en: 'How many other personal miles did you drive in 2025 (not business, not commuting)?',
      es: '¿Cuántas otras millas personales manejó en 2025 (no de negocios, no de desplazamiento)?',
    },
    shortLabel: { en: 'Other personal miles (Line 44c)', es: 'Otras millas personales (Línea 44c)' },
    guidance: {
      explanation: {
        en: 'All remaining personal miles not counted as business or commuting. Required so the IRS can verify the total miles driven matches business + commuting + other.',
        es: 'Todas las millas personales restantes no contadas como negocios o desplazamiento. Requeridas para que el IRS pueda verificar que el total de millas conducidas coincide.',
      },
      whereToFind: {
        en: 'Total vehicle miles for the year (from odometer readings) minus business miles minus commuting miles = other miles. Check your vehicle\'s beginning and end of year odometer readings, or use your car\'s trip computer.',
        es: 'Millas totales del vehículo para el año (de lecturas del odómetro) menos millas de negocios menos millas de desplazamiento = otras millas.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line45_evidenceToSupport',
    questionType: QuestionType.YES_NO,
    question: {
      en: 'Do you have evidence to support your vehicle deduction?',
      es: '¿Tiene evidencia para respaldar su deducción de vehículo?',
    },
    shortLabel: { en: 'Evidence to support deduction (Line 45)', es: 'Evidencia para respaldar deducción (Línea 45)' },
    options: [
      { value: true, label: { en: 'Yes', es: 'Sí' } },
      { value: false, label: { en: 'No', es: 'No' }, hint: { en: 'The IRS may disallow your vehicle deduction without documentation', es: 'El IRS puede rechazar su deducción de vehículo sin documentación' } },
    ],
    guidance: {
      explanation: {
        en: 'The IRS requires documentation for vehicle deductions. Answer honestly.',
        es: 'El IRS requiere documentación para las deducciones de vehículo. Responda honestamente.',
      },
      whereToFind: {
        en: 'Evidence can be: a written mileage log (paper or app), platform reports (Uber/Lyft annual statement showing miles), calendar records with trip notes, or bank/credit card records with business purpose noted.',
        es: 'La evidencia puede ser: un registro de millaje escrito (papel o aplicación), informes de plataforma (declaración anual de Uber/Lyft que muestra millas), registros de calendario con notas de viaje.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line46_writtenEvidence',
    questionType: QuestionType.YES_NO,
    question: {
      en: 'Is the evidence written (mileage log, app records, receipts)?',
      es: '¿Es la evidencia escrita (registro de millaje, registros de aplicación, recibos)?',
    },
    shortLabel: { en: 'Written evidence (Line 46)', es: 'Evidencia escrita (Línea 46)' },
    options: [
      { value: true, label: { en: 'Yes', es: 'Sí' } },
      { value: false, label: { en: 'No', es: 'No' } },
    ],
    guidance: {
      explanation: {
        en: 'The IRS prefers written evidence. Contemporaneous written records (kept at the time of the trip) carry more weight in an audit.',
        es: 'El IRS prefiere evidencia escrita. Los registros escritos contemporáneos (mantenidos en el momento del viaje) tienen más peso en una auditoría.',
      },
      whereToFind: {
        en: 'Written evidence includes: physical mileage log, mileage tracking app exports (MileIQ, Everlance, Stride), platform annual tax summaries, and calendar entries made at the time of travel.',
        es: 'La evidencia escrita incluye: registro de millaje físico, exportaciones de aplicaciones de seguimiento de millaje, resúmenes fiscales anuales de plataforma y entradas de calendario hechas en el momento del viaje.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
    hideUntilPrerequisitesMet: true,
  },

  {
    id: 'scheduleC.q.line47a_anotherVehicle',
    questionType: QuestionType.YES_NO,
    question: {
      en: 'Was another vehicle available for your personal use during 2025?',
      es: '¿Había otro vehículo disponible para su uso personal durante 2025?',
    },
    shortLabel: { en: 'Another vehicle available (Line 47a)', es: 'Otro vehículo disponible (Línea 47a)' },
    options: [
      { value: true, label: { en: 'Yes', es: 'Sí' } },
      { value: false, label: { en: 'No', es: 'No' } },
    ],
    guidance: {
      explanation: {
        en: 'Required IRS question. Indicates whether you had access to another vehicle for personal use, which affects how the IRS evaluates business use percentage claims.',
        es: 'Pregunta requerida del IRS. Indica si tenía acceso a otro vehículo para uso personal.',
      },
      whereToFind: {
        en: 'Answer Yes if there was another vehicle available (spouse\'s car, second personal car) for personal errands during 2025. Answer No if the vehicle claimed on Schedule C was your only vehicle.',
        es: 'Responda Sí si había otro vehículo disponible (auto del cónyuge, segundo auto personal). Responda No si el vehículo reclamado en el Anexo C era su único vehículo.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleC.q.line47b_offDutyPersonalUse',
    questionType: QuestionType.YES_NO,
    question: {
      en: 'Was the business vehicle available for personal use during off-duty hours?',
      es: '¿Estaba el vehículo de negocios disponible para uso personal durante las horas libres?',
    },
    shortLabel: { en: 'Off-duty personal use (Line 47b)', es: 'Uso personal fuera de servicio (Línea 47b)' },
    options: [
      { value: true, label: { en: 'Yes', es: 'Sí' }, hint: { en: 'Most people answer Yes — the vehicle goes home with you', es: 'La mayoría responde Sí — el vehículo va a casa con usted' } },
      { value: false, label: { en: 'No', es: 'No' }, hint: { en: 'Only if the vehicle stays at a business location overnight', es: 'Solo si el vehículo permanece en un lugar de negocios durante la noche' } },
    ],
    guidance: {
      explanation: {
        en: 'Almost all personal vehicles used for business are available for personal use off-duty. Answer Yes unless the vehicle is kept at a business location and you cannot access it personally.',
        es: 'Casi todos los vehículos personales usados para negocios están disponibles para uso personal fuera de servicio. Responda Sí a menos que el vehículo se mantenga en un lugar de negocios.',
      },
      whereToFind: {
        en: 'If you drive your personal car for Uber/Lyft/DoorDash and it goes home with you at night, answer Yes. Answer No only if it\'s a company vehicle that stays at the depot.',
        es: 'Si maneja su auto personal para Uber/Lyft/DoorDash y va a casa con usted por la noche, responda Sí.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

];