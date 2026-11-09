export interface IvaQuincenaData {
  id: string; // e.g. '2026-01-1'
  year: number;
  month: number; // 1-12
  quincena: 1 | 2; // 1: 1ra Quincena (1-15), 2: 2da Quincena (16-fin)
  fileName?: string;
  numeroDeclaracion?: string;
  numeroCertificado?: string;
  fechaDeclaracion?: string;
  fechaDesde?: string;
  fechaHasta?: string;

  // Ventas y Débitos Fiscales
  item40: number; // Ventas Internas No Gravadas
  item41?: number; // Ventas de Exportación
  item42: number; // Ventas Gravadas (Alícuota General 16%)
  item43?: number; // Débito Fiscal Ventas Gravadas 16%
  item442?: number; // Ventas Gravadas 8% (Alícuota Reducida)
  item443?: number; // Débito Fiscal Ventas Gravadas 8%
  ingresoIntereses: number; // Ingreso Intereses Bancarios
  item47: number; // Débito Fiscal Total

  // Compras y Créditos Fiscales
  item30: number; // Compras Exentas
  item31?: number; // Importaciones Exentas
  item33: number; // Compras Gravadas 16%
  item34: number; // Crédito Fiscal 16%
  item333: number; // Compras Gravadas 8%
  item343: number; // Alícuota reducida (Crédito Fiscal 8%)
  item35: number; // TOTAL COMPRAS
  item70: number; // Créditos Fiscales Totalmente Deducibles
  item37: number; // Créditos Fiscales Producto del % Prorrateo
  item71: number; // Total Créditos Fiscales Deducibles

  // Excedentes y Determinación
  item20: number; // Excedente Crédito Fiscal Mes/Período Anterior
  item38: number; // Ajuste a los créditos fiscales meses anteriores
  item39: number; // Total Créditos Fiscales del mes/período
  item53: number; // Total Cuota Tributaria

  // Retenciones y Liquidación
  item60: number; // Excedente Crédito Fiscal para el mes siguiente (en la hoja se muestra como valor negativo o positivo)
  item54: number; // Retenciones Acumuladas Por Descontar
  item66: number; // Retenciones del Período
  item67: number; // Saldo de Retenciones de IVA No Aplicadas
  item90: number; // TOTAL A PAGAR

  rawPdfText?: string;
  extractedAt?: string;
}

export interface CompanyProfile {
  id: string;
  razonSocial: string;
  rif: string;
  fiscalYear: number;
  periodData: Record<string, IvaQuincenaData>; // Key is `${year}-${month.toString().padStart(2, '0')}-${quincena}`
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionResult {
  success: boolean;
  data?: Partial<IvaQuincenaData> & {
    razonSocial?: string;
    rif?: string;
    fiscalYear?: number;
    month?: number;
    quincena?: 1 | 2;
    numeroDeclaracion?: string;
    numeroCertificado?: string;
  };
  error?: string;
  fileName?: string;
}

export const MONTH_NAMES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
] as const;

export interface SpreadsheetRowConfig {
  id: string;
  label: string;
  itemCode?: string;
  isHeader?: boolean;
  isBold?: boolean;
  isTotal?: boolean;
  isHighlightYellow?: boolean;
  isSubtotal?: boolean;
  bgColor?: string;
  textColor?: string;
  getValue: (data: IvaQuincenaData) => number;
  setValue?: (data: IvaQuincenaData, val: number) => void;
  formulaDescription?: string;
}
