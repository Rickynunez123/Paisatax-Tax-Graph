/**
 * paisatax-tax-graph/src/tax/forms/schedule-f/questions.ts
 *
 * Question definitions for Schedule F — Profit or Loss from Farming.
 * Covers farm identification, income sources, and expense categories.
 *
 * NAMING CONVENTION:
 *   questionId format: scheduleF.q.{shortName}
 *   Must match the node definition's `questionId` field in schedule-f/nodes.ts.
 */

import type { QuestionDefinition } from '../../../core/question/question.types.js';
import { QuestionType } from '../../../core/question/question.types.js';

export const SCHEDULE_F_QUESTIONS: QuestionDefinition[] = [

  // ─── FARM IDENTIFICATION ─────────────────────────────────────────────────

  {
    id: 'scheduleF.q.farmName',
    questionType: QuestionType.MULTI_CHOICE,
    question: {
      en: 'What is the name of this farm operation?',
      es: '¿Cuál es el nombre de esta operación agrícola?',
    },
    shortLabel: { en: 'Farm name', es: 'Nombre de la granja' },
    guidance: {
      explanation: {
        en: 'Enter the name of the farm or a description of the farming activity (e.g., "Smith Family Farm", "Corn and Soybean Operation", "Dairy Farm").',
        es: 'Ingrese el nombre de la granja o una descripción de la actividad agrícola.',
      },
      whereToFind: {
        en: 'Ask the farmer what name they use for their farm operation.',
        es: 'Pregunte al agricultor qué nombre usa para su operación agrícola.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.farmEIN',
    questionType: QuestionType.MULTI_CHOICE,
    question: {
      en: 'Does the farm have an Employer Identification Number (EIN)?',
      es: '¿La granja tiene un Número de Identificación del Empleador (EIN)?',
    },
    shortLabel: { en: 'Farm EIN', es: 'EIN de la granja' },
    guidance: {
      explanation: {
        en: 'Enter the EIN if the farm has employees or is an entity. Leave blank if operating as a sole proprietor using your SSN.',
        es: 'Ingrese el EIN si la granja tiene empleados o es una entidad. Deje en blanco si opera como propietario único usando su SSN.',
      },
      whereToFind: {
        en: 'Prior year tax return, IRS EIN confirmation letter, or payroll records.',
        es: 'Declaración de impuestos del año anterior, carta de confirmación EIN del IRS o registros de nómina.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.accountingMethod',
    questionType: QuestionType.MULTI_CHOICE,
    question: {
      en: 'Which accounting method does the farm use?',
      es: '¿Qué método contable usa la granja?',
    },
    shortLabel: { en: 'Accounting method', es: 'Método contable' },
    options: [
      { value: 'cash', label: { en: 'Cash', es: 'Efectivo' }, hint: { en: 'Report income when received, expenses when paid', es: 'Reporte ingresos cuando se reciben, gastos cuando se pagan' } },
      { value: 'accrual', label: { en: 'Accrual', es: 'Acumulación' }, hint: { en: 'Report income when earned, expenses when incurred', es: 'Reporte ingresos cuando se ganan, gastos cuando se incurren' } },
    ],
    guidance: {
      explanation: {
        en: 'Most small family farms use the cash method. The accrual method is required for C corporations and certain large farming operations.',
        es: 'La mayoría de las granjas familiares pequeñas usan el método de efectivo.',
      },
      whereToFind: {
        en: 'Check prior year Schedule F or ask the farmer which method they have historically used.',
        es: 'Consulte el Anexo F del año anterior o pregunte al agricultor qué método ha usado históricamente.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.materialParticipation',
    questionType: QuestionType.YES_NO,
    question: {
      en: 'Did the farmer materially participate in this farm operation in 2025?',
      es: '¿El agricultor participó materialmente en esta operación agrícola en 2025?',
    },
    shortLabel: { en: 'Material participation', es: 'Participación material' },
    options: [
      { value: true, label: { en: 'Yes', es: 'Sí' } },
      { value: false, label: { en: 'No — passive activity rules apply', es: 'No — se aplican reglas de actividad pasiva' } },
    ],
    guidance: {
      explanation: {
        en: 'Material participation generally means working in the farm on a regular, continuous, and substantial basis. Active farmers almost always answer Yes. If No, passive activity loss rules may limit the deductible loss.',
        es: 'La participación material generalmente significa trabajar en la granja de manera regular, continua y sustancial. Los agricultores activos casi siempre responden Sí.',
      },
      whereToFind: {
        en: 'Ask the farmer: "Did you work in the farm operation for more than 500 hours in 2025?" If yes, they materially participated.',
        es: 'Pregunte al agricultor: "¿Trabajó en la operación agrícola más de 500 horas en 2025?" Si es así, participó materialmente.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ─── INCOME ─────────────────────────────────────────────────────────────

  {
    id: 'scheduleF.q.line1a_livestockResaleSales',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What were the gross sales of livestock or other items PURCHASED for resale?',
      es: '¿Cuáles fueron las ventas brutas de ganado u otros artículos COMPRADOS para revender?',
    },
    shortLabel: { en: 'Livestock resale — gross sales', es: 'Reventa de ganado — ventas brutas' },
    guidance: {
      explanation: {
        en: 'Enter the GROSS proceeds from selling livestock or other items you originally PURCHASED (not raised). The cost basis is entered separately on Line 1b.',
        es: 'Ingrese los ingresos BRUTOS de la venta de ganado u otros artículos que compró originalmente (no crió). El costo base se ingresa por separado en la Línea 1b.',
      },
      whereToFind: {
        en: 'Sales receipts, Form 1099-S, scale tickets, or marketing records.',
        es: 'Recibos de ventas, Formulario 1099-S, tickets de báscula o registros de marketing.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line1b_livestockResaleCost',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What was the cost or basis of the livestock/items sold on Line 1a?',
      es: '¿Cuál fue el costo o base del ganado/artículos vendidos en la Línea 1a?',
    },
    shortLabel: { en: 'Livestock resale — cost basis', es: 'Reventa de ganado — base del costo' },
    guidance: {
      explanation: {
        en: 'Enter what you paid for the livestock or items that you sold. This is subtracted from Line 1a to determine gain or loss.',
        es: 'Ingrese lo que pagó por el ganado o los artículos que vendió. Esto se resta de la Línea 1a para determinar la ganancia o pérdida.',
      },
      whereToFind: {
        en: 'Purchase receipts, cattle purchase records, or farm ledger.',
        es: 'Recibos de compra, registros de compra de ganado o libro mayor de la granja.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line2_salesRaisedLivestock',
    questionType: QuestionType.CURRENCY,
    question: {
      en: 'What were the total sales of livestock, produce, and grains that were RAISED (not purchased)?',
      es: '¿Cuáles fueron las ventas totales de ganado, productos y granos que fueron CRIADOS (no comprados)?',
    },
    shortLabel: { en: 'Sales of raised livestock/crops', es: 'Ventas de ganado/cultivos criados' },
    guidance: {
      explanation: {
        en: 'This is the main income line for most farmers. Includes all crops harvested and sold, livestock raised from birth or young ages, dairy sales, eggs, wool, and similar farm products.',
        es: 'Esta es la línea de ingresos principal para la mayoría de los agricultores. Incluye todos los cultivos cosechados y vendidos, ganado criado desde el nacimiento, ventas de lácteos, huevos, lana y productos agrícolas similares.',
      },
      whereToFind: {
        en: 'Scale tickets, elevator settlement sheets, dairy cooperative statements, Form 1099-PATR, and other marketing records.',
        es: 'Tickets de báscula, hojas de liquidación del elevador, estados de la cooperativa lechera y otros registros de marketing.',
      },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line3a_cooperativeGross',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the gross amount of cooperative distributions received?', es: '¿Cuál fue el monto bruto de las distribuciones de la cooperativa recibidas?' },
    shortLabel: { en: 'Cooperative distributions (gross)', es: 'Distribuciones cooperativas (brutas)' },
    guidance: {
      explanation: { en: 'Total distributions from agricultural cooperatives per Form 1099-PATR. Box 1 is the patronage dividends.', es: 'Distribuciones totales de cooperativas agrícolas según el Formulario 1099-PATR. La Casilla 1 son los dividendos de patrocinio.' },
      whereToFind: { en: 'Form 1099-PATR from the cooperative.', es: 'Formulario 1099-PATR de la cooperativa.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  {
    id: 'scheduleF.q.line3b_cooperativeTaxable',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the TAXABLE portion of cooperative distributions?', es: '¿Cuál fue la porción GRAVABLE de las distribuciones de la cooperativa?' },
    shortLabel: { en: 'Cooperative distributions (taxable)', es: 'Distribuciones cooperativas (gravables)' },
    guidance: {
      explanation: { en: 'Taxable amount from Form 1099-PATR. Often equal to Line 3a, but may be less if some distributions are non-taxable per-unit retain allocations.', es: 'Monto gravable del Formulario 1099-PATR. A menudo igual a la Línea 3a, pero puede ser menor.' },
      whereToFind: { en: 'Form 1099-PATR Box 1 (patronage dividends) is generally the taxable amount.', es: 'Formulario 1099-PATR Casilla 1 (dividendos de patrocinio) es generalmente el monto gravable.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  {
    id: 'scheduleF.q.line4a_agProgramGross',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were the gross USDA agricultural program payments received (Form 1099-G)?', es: '¿Cuáles fueron los pagos brutos del programa agrícola del USDA recibidos (Formulario 1099-G)?' },
    shortLabel: { en: 'Agricultural program payments (gross)', es: 'Pagos del programa agrícola (brutos)' },
    guidance: {
      explanation: { en: 'Payments from USDA programs: ARC, PLC, CRP annual payments, WHIP+, ERP, etc. Reported on Form 1099-G.', es: 'Pagos de programas del USDA: ARC, PLC, pagos anuales de CRP, WHIP+, ERP, etc. Reportados en el Formulario 1099-G.' },
      whereToFind: { en: 'Form 1099-G from USDA/FSA office.', es: 'Formulario 1099-G de la oficina del USDA/FSA.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  {
    id: 'scheduleF.q.line4b_agProgramTaxable',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the TAXABLE portion of agricultural program payments?', es: '¿Cuál fue la porción GRAVABLE de los pagos del programa agrícola?' },
    shortLabel: { en: 'Agricultural program payments (taxable)', es: 'Pagos del programa agrícola (gravables)' },
    guidance: {
      explanation: { en: 'Usually the same as Line 4a. Some conservation payments may be excludable — consult IRS Pub 225.', es: 'Generalmente igual a la Línea 4a. Algunos pagos de conservación pueden excluirse — consulte la Publicación 225 del IRS.' },
      whereToFind: { en: 'Form 1099-G Box 2.', es: 'Formulario 1099-G Casilla 2.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  {
    id: 'scheduleF.q.line5a_cccLoansElection',
    questionType: QuestionType.CURRENCY,
    question: { en: 'Any CCC (Commodity Credit Corporation) loans reported as income under election?', es: '¿Algún préstamo CCC (Corporación de Crédito Agrícola) reportado como ingreso bajo elección?' },
    shortLabel: { en: 'CCC loans — election', es: 'Préstamos CCC — elección' },
    guidance: {
      explanation: { en: 'If the farmer elected to treat CCC loans as income in the year received, enter the loan amount here. Most farmers do NOT make this election. Leave $0 if uncertain.', es: 'Si el agricultor eligió tratar los préstamos CCC como ingreso en el año recibido, ingrese el monto del préstamo aquí. La mayoría de los agricultores NO hacen esta elección.' },
      whereToFind: { en: 'Form CCC-1099-G from USDA if the election was made.', es: 'Formulario CCC-1099-G del USDA si se hizo la elección.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line5b_cccLoansForfeited',
    questionType: QuestionType.CURRENCY,
    question: { en: 'Were any CCC loans forfeited (collateral retained by CCC) in 2025?', es: '¿Se confiscaron préstamos CCC (garantía retenida por CCC) en 2025?' },
    shortLabel: { en: 'CCC loans — forfeited', es: 'Préstamos CCC — confiscados' },
    guidance: {
      explanation: { en: 'When a farmer forfeits commodities pledged as CCC loan collateral, the loan amount is treated as income. Enter the amount shown on Form CCC-1099-G.', es: 'Cuando un agricultor confisca materias primas prometidas como garantía de préstamo CCC, el monto del préstamo se trata como ingreso.' },
      whereToFind: { en: 'Form CCC-1099-G from USDA.', es: 'Formulario CCC-1099-G del USDA.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  {
    id: 'scheduleF.q.line6_cropInsurance',
    questionType: QuestionType.CURRENCY,
    question: { en: 'Were any crop insurance proceeds or disaster payments received in 2025?', es: '¿Se recibieron ingresos de seguros de cultivos o pagos por desastres en 2025?' },
    shortLabel: { en: 'Crop insurance proceeds', es: 'Ingresos de seguro de cultivos' },
    guidance: {
      explanation: { en: 'Proceeds from federal crop insurance (MPCI, NAP) and disaster programs. Cash method farmers may elect to defer to next year if the crop would normally be sold then. Reported on Form 1099-A or FSA records.', es: 'Ingresos del seguro federal de cultivos y programas de desastres. Los agricultores de método de efectivo pueden elegir diferir al año siguiente.' },
      whereToFind: { en: 'Insurance company statements, Form 1099-A, or FSA payment records.', es: 'Estados de la compañía de seguros, Formulario 1099-A o registros de pago de FSA.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  {
    id: 'scheduleF.q.line7_customHireIncome',
    questionType: QuestionType.CURRENCY,
    question: { en: 'Was any income received for providing custom farm work (machine hire) to others?', es: '¿Se recibieron ingresos por proporcionar trabajo agrícola personalizado (alquiler de máquinas) a otros?' },
    shortLabel: { en: 'Custom hire income', es: 'Ingresos de trabajo personalizado' },
    guidance: {
      explanation: { en: 'If the farmer rented out their equipment and provided machine work on other farms (custom plowing, harvesting, etc.), that income goes here.', es: 'Si el agricultor alquiló su equipo y proporcionó trabajo con máquinas en otras granjas, ese ingreso va aquí.' },
      whereToFind: { en: 'Invoices or receipts from custom work performed.', es: 'Facturas o recibos del trabajo personalizado realizado.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line8_otherIncome',
    questionType: QuestionType.CURRENCY,
    question: { en: 'Were there any other farm income sources not reported above?', es: '¿Hubo otras fuentes de ingresos agrícolas no reportadas arriba?' },
    shortLabel: { en: 'Other farm income', es: 'Otros ingresos agrícolas' },
    guidance: {
      explanation: { en: 'Includes state/federal gasoline tax credits/refunds, income from breeding fees, farm-raised fish sales, agritourism income, and other miscellaneous farm income.', es: 'Incluye créditos/reembolsos de impuestos sobre gasolina estatales/federales, ingresos de tarifas de cría, ventas de peces criados en granjas, ingresos de agroturismo y otros ingresos agrícolas misceláneos.' },
      whereToFind: { en: 'Various receipts and income records for miscellaneous farm activities.', es: 'Varios recibos y registros de ingresos para actividades agrícolas misceláneas.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ─── EXPENSES ────────────────────────────────────────────────────────────

  {
    id: 'scheduleF.q.line10b_parkingTolls',
    questionType: QuestionType.CURRENCY,
    question: { en: 'Were any farm-related parking fees or tolls paid in 2025?', es: '¿Se pagaron tarifas de estacionamiento o peajes relacionados con la granja en 2025?' },
    shortLabel: { en: 'Farm parking/tolls', es: 'Estacionamiento/peajes agrícolas' },
    guidance: {
      explanation: { en: 'Added to the standard mileage deduction to produce Line 10 total car and truck expenses.', es: 'Se agrega a la deducción de millaje estándar para producir el total de la Línea 10.' },
      whereToFind: { en: 'Receipts for parking and toll payments related to farm business travel.', es: 'Recibos de pagos de estacionamiento y peajes relacionados con viajes de negocios agrícolas.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line11_chemicals',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the total cost of chemicals (herbicides, pesticides, fungicides) used in 2025?', es: '¿Cuál fue el costo total de los químicos (herbicidas, pesticidas, fungicidas) utilizados en 2025?' },
    shortLabel: { en: 'Chemicals', es: 'Químicos' },
    guidance: {
      explanation: { en: 'All agricultural chemicals used in crop production. Purchase receipts required.', es: 'Todos los químicos agrícolas utilizados en la producción de cultivos. Se requieren recibos de compra.' },
      whereToFind: { en: 'Co-op statements, agronomy bills, chemical dealer receipts.', es: 'Estados de la cooperativa, facturas de agronomía, recibos de distribuidores de químicos.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line12_conservationExpenses',
    questionType: QuestionType.CURRENCY,
    question: { en: 'Were any soil and water conservation expenses paid (Form 8645 or Pub 225 worksheet)?', es: '¿Se pagaron gastos de conservación de suelo y agua (Formulario 8645 o hoja de trabajo de la Publicación 225)?' },
    shortLabel: { en: 'Conservation expenses', es: 'Gastos de conservación' },
    guidance: {
      explanation: { en: 'Costs for soil and water conservation practices: terracing, leveling, drainage tile installation, earthen dams, etc. Limited to 25% of gross farm income — excess carries forward.', es: 'Costos de prácticas de conservación de suelo y agua: terrazas, nivelación, instalación de drenaje, represas de tierra, etc. Limitado al 25% del ingreso bruto agrícola.' },
      whereToFind: { en: 'Contractor invoices, equipment rental receipts for conservation work.', es: 'Facturas de contratistas, recibos de alquiler de equipos para trabajo de conservación.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line13_customHireExpense',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was paid for custom hire (contract farm machine work) from others?', es: '¿Cuánto se pagó por trabajo personalizado (trabajo con máquinas agrícolas por contrato) de otros?' },
    shortLabel: { en: 'Custom hire expense', es: 'Gasto de trabajo personalizado' },
    guidance: {
      explanation: { en: 'Payments for contract farm services: hired harvest crews, custom spraying, aerial application, contract plowing.', es: 'Pagos por servicios agrícolas por contrato: equipos de cosecha contratados, aplicación de aerosol personalizada, aplicación aérea, arado por contrato.' },
      whereToFind: { en: 'Invoices from custom operators.', es: 'Facturas de operadores personalizados.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line14_depreciation',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What is the total farm depreciation and Section 179 deduction (from Form 4562)?', es: '¿Cuál es la depreciación agrícola total y la deducción de la Sección 179 (del Formulario 4562)?' },
    shortLabel: { en: 'Farm depreciation', es: 'Depreciación agrícola' },
    guidance: {
      explanation: { en: 'Depreciation on farm buildings, machinery, equipment, and other assets. Section 179 immediate expensing may be available. Calculate on Form 4562.', es: 'Depreciación de edificios agrícolas, maquinaria, equipo y otros activos. La deducción inmediata de la Sección 179 puede estar disponible. Calcule en el Formulario 4562.' },
      whereToFind: { en: 'Form 4562, prior year depreciation schedule.', es: 'Formulario 4562, programa de depreciación del año anterior.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line15_employeeBenefits',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was paid for employee benefit programs (health insurance, life insurance for farm employees)?', es: '¿Cuánto se pagó por programas de beneficios para empleados (seguro médico, seguro de vida para empleados agrícolas)?' },
    shortLabel: { en: 'Employee benefits', es: 'Beneficios para empleados' },
    guidance: {
      explanation: { en: 'Employer contributions to health, life, and disability insurance and other benefits for farm employees. Does not include owner benefits.', es: 'Contribuciones del empleador a seguros de salud, vida y discapacidad y otros beneficios para los empleados agrícolas.' },
      whereToFind: { en: 'Insurance premium invoices, benefit plan statements.', es: 'Facturas de primas de seguro, estados del plan de beneficios.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line16_feedPurchased',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the total cost of feed purchased for livestock in 2025?', es: '¿Cuál fue el costo total del alimento comprado para el ganado en 2025?' },
    shortLabel: { en: 'Feed purchased', es: 'Alimento comprado' },
    guidance: {
      explanation: { en: 'All purchased feed: hay, grain, supplements, total mixed rations. Cash method farmers deduct when paid, not when fed.', es: 'Todo el alimento comprado: heno, grano, suplementos, raciones mezcladas totales. Los agricultores de método de efectivo deducen cuando pagan, no cuando alimentan.' },
      whereToFind: { en: 'Feed dealer invoices, co-op statements, hay purchase receipts.', es: 'Facturas del distribuidor de alimentos, estados de la cooperativa, recibos de compra de heno.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line17_fertilizersLime',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the total cost of fertilizers and lime applied in 2025?', es: '¿Cuál fue el costo total de fertilizantes y cal aplicados en 2025?' },
    shortLabel: { en: 'Fertilizers and lime', es: 'Fertilizantes y cal' },
    guidance: {
      explanation: { en: 'Commercial fertilizer, anhydrous ammonia, UAN solutions, lime, and other soil amendments.', es: 'Fertilizante comercial, amoníaco anhidro, soluciones UAN, cal y otras enmiendas del suelo.' },
      whereToFind: { en: 'Agronomy invoices, co-op statements.', es: 'Facturas de agronomía, estados de la cooperativa.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line18_freightTrucking',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were total freight and trucking expenses for farm products or supplies?', es: '¿Cuáles fueron los gastos totales de flete y transporte de productos o suministros agrícolas?' },
    shortLabel: { en: 'Freight and trucking', es: 'Flete y transporte' },
    guidance: {
      explanation: { en: 'Third-party trucking costs to haul grain to elevator, livestock to market, or supplies to the farm.', es: 'Costos de transporte de terceros para transportar grano al elevador, ganado al mercado o suministros a la granja.' },
      whereToFind: { en: 'Trucking company invoices, elevator settlement sheets showing hauling charges.', es: 'Facturas de empresas de transporte, hojas de liquidación del elevador que muestran cargos de transporte.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line19_gasolineFuelOil',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the total cost of gasoline, diesel fuel, and oil for farm equipment?', es: '¿Cuál fue el costo total de gasolina, diésel y aceite para equipo agrícola?' },
    shortLabel: { en: 'Fuel and oil', es: 'Combustible y aceite' },
    guidance: {
      explanation: { en: 'Fuel for tractors, combines, irrigation pumps, grain dryers, and other stationary equipment. Do NOT include fuel for vehicles on which you claim standard mileage.', es: 'Combustible para tractores, cosechadoras, bombas de riego, secadoras de grano y otro equipo estacionario. NO incluya combustible para vehículos en los que reclama el millaje estándar.' },
      whereToFind: { en: 'Fuel receipts, farm fuel account statements.', es: 'Recibos de combustible, estados de cuenta de combustible agrícola.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line20_insurance',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were total farm insurance premiums paid (crop, livestock, farm property, liability)?', es: '¿Cuáles fueron las primas totales de seguro agrícola pagadas (cultivos, ganado, propiedad agrícola, responsabilidad)?' },
    shortLabel: { en: 'Farm insurance', es: 'Seguro agrícola' },
    guidance: {
      explanation: { en: 'All farm-related insurance except health insurance: crop insurance, livestock insurance, farm property/equipment insurance, farm liability, farm workers\' compensation. Health insurance for self-employed farmers goes on Schedule 1 Line 17.', es: 'Todo seguro relacionado con la granja excepto seguro médico: seguro de cultivos, seguro de ganado, seguro de propiedad/equipo agrícola, responsabilidad agrícola, compensación laboral agrícola.' },
      whereToFind: { en: 'Insurance premium statements, RMA (Risk Management Agency) policy documents.', es: 'Estados de primas de seguro, documentos de póliza de la RMA (Agencia de Gestión de Riesgos).' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line21_mortgageInterest',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the farm mortgage interest paid to banks (Form 1098)?', es: '¿Cuál fue el interés hipotecario agrícola pagado a bancos (Formulario 1098)?' },
    shortLabel: { en: 'Farm mortgage interest', es: 'Interés hipotecario agrícola' },
    guidance: {
      explanation: { en: 'Interest on loans secured by farm real estate (farm mortgage). Reported on Form 1098 from the lender. Do not include home mortgage interest — that goes on Schedule A.', es: 'Interés sobre préstamos garantizados por bienes raíces agrícolas (hipoteca agrícola). Reportado en el Formulario 1098 del prestamista.' },
      whereToFind: { en: 'Form 1098 from Farm Credit Services, Farm Bureau Bank, or other agricultural lenders.', es: 'Formulario 1098 de Servicios de Crédito Agrícola, Banco de la Oficina Agrícola u otros prestamistas agrícolas.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer', 'other_form'],
  },

  {
    id: 'scheduleF.q.line22_otherInterest',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the total of other farm-related interest paid (operating loans, equipment financing)?', es: '¿Cuál fue el total de otros intereses relacionados con la granja pagados (préstamos operativos, financiamiento de equipos)?' },
    shortLabel: { en: 'Other farm interest', es: 'Otro interés agrícola' },
    guidance: {
      explanation: { en: 'Interest on farm operating lines of credit, equipment loans, feeder cattle financing, and other farm debt not secured by real estate.', es: 'Interés en líneas de crédito operativas agrícolas, préstamos de equipo, financiamiento de ganado de engorde y otra deuda agrícola no garantizada por bienes raíces.' },
      whereToFind: { en: 'Bank/lender annual interest statements, Form 1099-INT.', es: 'Estados de interés anuales del banco/prestamista, Formulario 1099-INT.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line23_laborHired',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were the total gross wages paid to farm employees (before withholding)?', es: '¿Cuáles fueron los salarios brutos totales pagados a los empleados agrícolas (antes de la retención)?' },
    shortLabel: { en: 'Labor hired', es: 'Mano de obra contratada' },
    guidance: {
      explanation: { en: 'All wages paid to farm employees. Report net of any employment credits claimed (e.g., Work Opportunity Credit). Issue W-2s and file Form 943 (not Form 941) for farm employees.', es: 'Todos los salarios pagados a los empleados agrícolas. Reporte neto de cualquier crédito de empleo reclamado. Emita W-2s y presente el Formulario 943 (no el Formulario 941) para empleados agrícolas.' },
      whereToFind: { en: 'Payroll records, Form 943, W-2 copies.', es: 'Registros de nómina, Formulario 943, copias de W-2.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line24_pensionPlans',
    questionType: QuestionType.CURRENCY,
    question: { en: 'Were any contributions made to pension or profit-sharing plans for farm employees?', es: '¿Se realizaron contribuciones a planes de pensión o participación en las ganancias para empleados agrícolas?' },
    shortLabel: { en: 'Pension/profit-sharing plans', es: 'Planes de pensión/participación en ganancias' },
    guidance: {
      explanation: { en: 'Employer contributions to qualified retirement plans for farm employees. This is for EMPLOYEE plans, not the self-employed farmer\'s own retirement contributions.', es: 'Contribuciones del empleador a planes de jubilación calificados para empleados agrícolas. Esto es para planes de EMPLEADOS, no las propias contribuciones de jubilación del agricultor por cuenta propia.' },
      whereToFind: { en: 'Plan administrator statements.', es: 'Estados del administrador del plan.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line25_rentLeaseVehicles',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were the rent/lease payments for farm vehicles, machinery, and equipment?', es: '¿Cuáles fueron los pagos de alquiler/arrendamiento de vehículos, maquinaria y equipo agrícola?' },
    shortLabel: { en: 'Equipment rent/lease', es: 'Alquiler/arrendamiento de equipo' },
    guidance: {
      explanation: { en: 'Payments for leased tractors, combines, irrigation systems, and other farm equipment.', es: 'Pagos por tractores arrendados, cosechadoras, sistemas de riego y otro equipo agrícola.' },
      whereToFind: { en: 'Lease agreements and payment records.', es: 'Contratos de arrendamiento y registros de pago.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line26_rentLeaseLand',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the total cash rent paid for farmland or pasture?', es: '¿Cuál fue el alquiler en efectivo total pagado por tierras agrícolas o pastizales?' },
    shortLabel: { en: 'Cash rent (farmland)', es: 'Alquiler en efectivo (tierras agrícolas)' },
    guidance: {
      explanation: { en: 'Cash rent paid to landlords for farmland, pasture, or other farm real estate. Very common expense for tenant farmers. Crop-share rent is handled differently.', es: 'Alquiler en efectivo pagado a propietarios por tierras agrícolas, pastizales u otros bienes raíces agrícolas. Gasto muy común para agricultores arrendatarios.' },
      whereToFind: { en: 'Lease agreements, cancelled checks, or landlord payment records.', es: 'Contratos de arrendamiento, cheques cancelados o registros de pago del propietario.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line27_repairs',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were the total repairs and maintenance costs for farm equipment and buildings?', es: '¿Cuáles fueron los costos totales de reparaciones y mantenimiento de equipo y edificios agrícolas?' },
    shortLabel: { en: 'Farm repairs', es: 'Reparaciones agrícolas' },
    guidance: {
      explanation: { en: 'Costs to keep farm equipment and buildings in operating condition. Does not include improvements that add value or extend useful life (those are capital expenditures).', es: 'Costos para mantener el equipo y los edificios agrícolas en condición operativa. No incluye mejoras que agregan valor o extienden la vida útil.' },
      whereToFind: { en: 'Repair shop invoices, parts receipts, maintenance records.', es: 'Facturas del taller de reparación, recibos de piezas, registros de mantenimiento.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line28_seedsPlants',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What was the total cost of seeds and plants purchased for planting?', es: '¿Cuál fue el costo total de semillas y plantas compradas para siembra?' },
    shortLabel: { en: 'Seeds and plants', es: 'Semillas y plantas' },
    guidance: {
      explanation: { en: 'Purchased seed corn, soybean seed, wheat seed, vegetable transplants, and other planting materials.', es: 'Maíz semilla comprado, semilla de soja, semilla de trigo, trasplantes de vegetales y otros materiales de siembra.' },
      whereToFind: { en: 'Seed dealer invoices, co-op statements.', es: 'Facturas del distribuidor de semillas, estados de la cooperativa.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line29_storageWarehousing',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were total storage and warehousing costs for farm products?', es: '¿Cuáles fueron los costos totales de almacenamiento y almacenaje de productos agrícolas?' },
    shortLabel: { en: 'Storage and warehousing', es: 'Almacenamiento y almacenaje' },
    guidance: {
      explanation: { en: 'Elevator storage fees, bin rental, cold storage charges for produce or dairy, and other product storage costs.', es: 'Tarifas de almacenamiento del elevador, alquiler de silos, cargos de almacenamiento en frío para productos o lácteos y otros costos de almacenamiento de productos.' },
      whereToFind: { en: 'Elevator statements, storage facility invoices.', es: 'Estados del elevador, facturas de instalaciones de almacenamiento.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line30_supplies',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were total farm supply purchases (twine, wire, small tools, containers, etc.)?', es: '¿Cuáles fueron las compras totales de suministros agrícolas (hilo, alambre, herramientas pequeñas, contenedores, etc.)?' },
    shortLabel: { en: 'Farm supplies', es: 'Suministros agrícolas' },
    guidance: {
      explanation: { en: 'Miscellaneous farm supplies consumed in operations: baling twine, fencing wire, teat dip, ear tags, small hand tools, harvest bags/bins.', es: 'Suministros agrícolas misceláneos consumidos en las operaciones: hilo para pacas, alambre para cercas, desinfectante de pezones, etiquetas de orejas, herramientas manuales pequeñas, bolsas/contenedores de cosecha.' },
      whereToFind: { en: 'Co-op statements, farm supply store receipts.', es: 'Estados de la cooperativa, recibos de tiendas de suministros agrícolas.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line31_taxes',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were the total farm-related taxes paid (real estate taxes on farm, payroll taxes, etc.)?', es: '¿Cuáles fueron los impuestos relacionados con la granja pagados (impuestos inmobiliarios agrícolas, impuestos sobre nómina, etc.)?' },
    shortLabel: { en: 'Farm taxes', es: 'Impuestos agrícolas' },
    guidance: {
      explanation: { en: 'Real estate taxes on farm property, employer share of FICA on farm wages, FUTA (Form 940), state payroll taxes, state/local taxes on farm operations.', es: 'Impuestos inmobiliarios sobre propiedad agrícola, parte del empleador del FICA en salarios agrícolas, FUTA (Formulario 940), impuestos de nómina estatales, impuestos estatales/locales en operaciones agrícolas.' },
      whereToFind: { en: 'County property tax bills, Form 940, Form 943 records.', es: 'Facturas de impuestos de propiedad del condado, Formulario 940, registros del Formulario 943.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line32_utilities',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were total farm utility costs (electricity for grain bins, water for livestock, farm phone, etc.)?', es: '¿Cuáles fueron los costos totales de servicios públicos agrícolas (electricidad para silos de grano, agua para ganado, teléfono agrícola, etc.)?' },
    shortLabel: { en: 'Farm utilities', es: 'Servicios públicos agrícolas' },
    guidance: {
      explanation: { en: 'Electricity for grain dryers, bins, barns, and irrigation; water for livestock and irrigation; telephone for farm business. Do not include utilities for personal residence.', es: 'Electricidad para secadoras de grano, silos, graneros y riego; agua para ganado y riego; teléfono para negocios agrícolas. No incluya servicios públicos para la residencia personal.' },
      whereToFind: { en: 'Utility bills. If farm and home share a meter, allocate the farm portion.', es: 'Facturas de servicios públicos. Si la granja y el hogar comparten un medidor, asigne la porción agrícola.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line33_vetBreedingMedicine',
    questionType: QuestionType.CURRENCY,
    question: { en: 'What were the total veterinary, breeding, and medicine costs for livestock?', es: '¿Cuáles fueron los costos totales de veterinaria, cría y medicamentos para el ganado?' },
    shortLabel: { en: 'Vet, breeding, medicine', es: 'Veterinaria, cría, medicina' },
    guidance: {
      explanation: { en: 'All animal health costs: vet bills, herd health visits, artificial insemination supplies and semen, livestock medications, vaccines, dewormers.', es: 'Todos los costos de salud animal: facturas veterinarias, visitas de salud del rebaño, suministros de inseminación artificial y semen, medicamentos para el ganado, vacunas, desparasitantes.' },
      whereToFind: { en: 'Vet clinic invoices, AI supplier receipts, feed store medicine purchases.', es: 'Facturas de la clínica veterinaria, recibos del proveedor de IA, compras de medicamentos en tiendas de alimentos.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line34_otherExpenses',
    questionType: QuestionType.CURRENCY,
    question: { en: 'Were there any other ordinary and necessary farm expenses not listed above?', es: '¿Hubo otros gastos agrícolas ordinarios y necesarios no enumerados arriba?' },
    shortLabel: { en: 'Other farm expenses', es: 'Otros gastos agrícolas' },
    guidance: {
      explanation: { en: 'Examples: accounting/tax preparation fees, dues to farm organizations (Farm Bureau, commodity groups), farm publications, grain marketing costs, bank service charges on farm accounts.', es: 'Ejemplos: honorarios de contabilidad/preparación de impuestos, cuotas a organizaciones agrícolas (Oficina Agrícola, grupos de materias primas), publicaciones agrícolas, costos de comercialización de granos, cargos por servicios bancarios en cuentas agrícolas.' },
      whereToFind: { en: 'Miscellaneous receipts and invoices for farm business expenses.', es: 'Recibos y facturas misceláneos para gastos del negocio agrícola.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  // ─── VEHICLE INFORMATION ─────────────────────────────────────────────────

  {
    id: 'scheduleF.q.line42a_businessMiles',
    questionType: QuestionType.INTEGER,
    question: { en: 'How many miles were driven for farm business purposes in 2025?', es: '¿Cuántas millas se condujeron para propósitos de negocios agrícolas en 2025?' },
    shortLabel: { en: 'Farm business miles', es: 'Millas de negocios agrícolas' },
    guidance: {
      explanation: { en: 'Business miles driven in a personal vehicle for farm purposes: hauling supplies, visiting fields, trips to the co-op, FSA office, vet, etc. Use $0.70/mile for 2025. A mileage log is required.', es: 'Millas de negocios conducidas en un vehículo personal para propósitos agrícolas: transportar suministros, visitar campos, viajes a la cooperativa, oficina FSA, veterinario, etc. Use $0.70/milla para 2025.' },
      whereToFind: { en: 'Mileage log or GPS/app records.', es: 'Registro de millaje o registros de GPS/aplicación.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line42b_commutingMiles',
    questionType: QuestionType.INTEGER,
    question: { en: 'How many commuting miles (home to farm) were driven?', es: '¿Cuántas millas de desplazamiento (casa a la granja) se condujeron?' },
    shortLabel: { en: 'Commuting miles', es: 'Millas de desplazamiento' },
    guidance: {
      explanation: { en: 'Miles between your personal home and the farm. Generally NOT deductible. (Exception: if your home is your principal place of business, first trip to farm may qualify.)' , es: 'Millas entre su hogar personal y la granja. Generalmente NO deducibles.' },
      whereToFind: { en: 'Mileage log records.', es: 'Registros del libro de millaje.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line42c_otherMiles',
    questionType: QuestionType.INTEGER,
    question: { en: 'How many other (personal) miles were driven in this vehicle?', es: '¿Cuántas otras millas (personales) se condujeron en este vehículo?' },
    shortLabel: { en: 'Other miles', es: 'Otras millas' },
    guidance: {
      explanation: { en: 'Personal miles that are neither farm business nor commuting. Required to establish total vehicle use for IRS substantiation.', es: 'Millas personales que no son negocios agrícolas ni desplazamiento. Requeridas para establecer el uso total del vehículo para la sustanciación del IRS.' },
      whereToFind: { en: 'Mileage log records.', es: 'Registros del libro de millaje.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line42d_evidenceToSupport',
    questionType: QuestionType.YES_NO,
    question: { en: 'Is there written evidence supporting the farm vehicle mileage deduction?', es: '¿Hay evidencia escrita que respalde la deducción de millaje del vehículo agrícola?' },
    shortLabel: { en: 'Mileage evidence?', es: '¿Evidencia de millaje?' },
    options: [
      { value: true, label: { en: 'Yes', es: 'Sí' } },
      { value: false, label: { en: 'No', es: 'No' } },
    ],
    guidance: {
      explanation: { en: 'The IRS requires written evidence (mileage log, calendar, GPS records) to substantiate vehicle expense deductions.', es: 'El IRS requiere evidencia escrita (registro de millaje, calendario, registros GPS) para justificar las deducciones de gastos de vehículos.' },
      whereToFind: { en: 'Mileage log book, calendar app, or mileage tracking app records.', es: 'Libro de registro de millaje, aplicación de calendario o registros de aplicación de seguimiento de millaje.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },

  {
    id: 'scheduleF.q.line42e_writtenEvidence',
    questionType: QuestionType.YES_NO,
    question: { en: 'Is the mileage evidence in written form?', es: '¿La evidencia de millaje está en forma escrita?' },
    shortLabel: { en: 'Written mileage evidence?', es: '¿Evidencia escrita de millaje?' },
    options: [
      { value: true, label: { en: 'Yes', es: 'Sí' } },
      { value: false, label: { en: 'No', es: 'No' } },
    ],
    guidance: {
      explanation: { en: 'Written evidence includes paper mileage logs, printed GPS records, exported mileage app data. Electronic records count as written.', es: 'La evidencia escrita incluye registros de millaje en papel, registros de GPS impresos, datos de aplicaciones de millaje exportados. Los registros electrónicos cuentan como escritos.' },
      whereToFind: { en: 'Mileage tracking records in any written format.', es: 'Registros de seguimiento de millaje en cualquier formato escrito.' },
    },
    applicableTaxYears: ['2025'],
    inputPanels: ['preparer'],
  },
];