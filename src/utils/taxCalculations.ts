import { IvaQuincenaData, MONTH_NAMES, SpreadsheetRowConfig } from '../types';

export const TOTAL_PERIODS = 24; // 12 months * 2 quincenas

export function generatePeriodKey(year: number, month: number, quincena: 1 | 2): string {
  return `${year}-${month.toString().padStart(2, '0')}-${quincena}`;
}

// Extract Year, Month, and Quincena from file name patterns (e.g. "1A QUINCENA FEBRERO 2026", "2A QUINCENA FEBRERO 2026", "1ra quincena febrero 2026", "FEB 1Q", "FEB 2Q", "02-1", "02-2", "01-15_FEB")
export function detectPeriodFromFilename(fileName: string): {
  year?: number;
  month?: number;
  quincena?: 1 | 2;
} {
  const result: { year?: number; month?: number; quincena?: 1 | 2 } = {};
  if (!fileName) return result;

  const baseName = fileName.replace(/\.[^/.]+$/, '');
  // Normalize string: lowercase, replace underscores with hyphens for uniformity, remove accents
  const normalized = baseName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ª/g, 'a')
    .replace(/º/g, 'o')
    .replace(/_/g, '-');

  // 1. FULL DATE RANGE IN FILENAME (e.g. "01-02-2026 al 15-02-2026", "16/02/2026 a 28/02/2026", "01.02.2026 - 15.02.2026")
  const fullRangeMatch = normalized.match(
    /\b(0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9]|203[0-9])\s*(?:al|a|hasta|-)\s*(0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9]|203[0-9])\b/i
  );
  if (fullRangeMatch) {
    const d1 = parseInt(fullRangeMatch[1], 10);
    const m1 = parseInt(fullRangeMatch[2], 10);
    const y1 = parseInt(fullRangeMatch[3], 10);
    const d2 = parseInt(fullRangeMatch[4], 10);
    const m2 = parseInt(fullRangeMatch[5], 10);
    const y2 = parseInt(fullRangeMatch[6], 10);

    result.year = y2 || y1;
    result.month = m2 || m1;
    if (d1 <= 15 && d2 <= 15) {
      result.quincena = 1;
    } else if (d1 >= 16 || d2 >= 16) {
      result.quincena = 2;
    }
    return result;
  }

  // ISO Full Range: "2026-02-01 al 2026-02-15" or "2026-02-16 al 2026-02-28"
  const isoFullRange = normalized.match(
    /\b(202[0-9]|203[0-9])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12][0-9]|3[01])\s*(?:al|a|hasta|-)\s*(202[0-9]|203[0-9])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12][0-9]|3[01])\b/i
  );
  if (isoFullRange) {
    result.year = parseInt(isoFullRange[1], 10);
    result.month = parseInt(isoFullRange[2], 10);
    const d1 = parseInt(isoFullRange[3], 10);
    const d2 = parseInt(isoFullRange[6], 10);
    result.quincena = (d1 <= 15 && d2 <= 15) ? 1 : 2;
    return result;
  }

  // Day range with month & year: "01-15-02-2026" or "16-28-02-2026"
  const dayRangeWithMonth = normalized.match(
    /\b(0?[1-9]|[12][0-9]|3[01])[\-_](0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9]|203[0-9])\b/
  );
  if (dayRangeWithMonth) {
    const d1 = parseInt(dayRangeWithMonth[1], 10);
    const d2 = parseInt(dayRangeWithMonth[2], 10);
    result.month = parseInt(dayRangeWithMonth[3], 10);
    result.year = parseInt(dayRangeWithMonth[4], 10);
    result.quincena = (d1 <= 15 && d2 <= 15) ? 1 : 2;
    return result;
  }

  // Textual day range: "01 al 15" or "16 al 28"
  const textDayRange1 = normalized.match(/\b(?:0?1|1)\s*(?:al|a|hasta|-)\s*15\b/i);
  const textDayRange2 = normalized.match(/\b16\s*(?:al|a|hasta|-)\s*(?:28|29|30|31)\b/i);
  if (textDayRange1 && !textDayRange2) {
    result.quincena = 1;
  } else if (textDayRange2 && !textDayRange1) {
    result.quincena = 2;
  }

  // 2. YEAR DETECTION (2020..2035)
  const yearMatch = normalized.match(/\b(202[0-9]|203[0-5])\b/);
  if (yearMatch) {
    result.year = parseInt(yearMatch[1], 10);
  }

  // 3. MONTH DETECTION
  const monthMap: Record<string, number> = {
    enero: 1, ene: 1,
    febrero: 2, feb: 2,
    marzo: 3, mar: 3,
    abril: 4, abr: 4,
    mayo: 5, may: 5,
    junio: 6, jun: 6,
    julio: 7, jul: 7,
    agosto: 8, ago: 8,
    septiembre: 9, setiembre: 9, sep: 9, sept: 9,
    octubre: 10, oct: 10,
    noviembre: 11, nov: 11,
    diciembre: 12, dic: 12,
  };

  for (const [name, num] of Object.entries(monthMap)) {
    const regex = new RegExp(`(?:^|[^a-z0-9])${name}(?:$|[^a-z0-9])`, 'i');
    if (regex.test(normalized)) {
      result.month = num;
      break;
    }
  }

  // 4. SINGLE COMPLETE DATE (e.g. "15-02-2026", "01-02-2026", "28-02-2026", "16-02-2026")
  const singleDateMatch = normalized.match(
    /\b(0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9]|203[0-9])\b/
  );
  if (singleDateMatch) {
    const day = parseInt(singleDateMatch[1], 10);
    const m = parseInt(singleDateMatch[2], 10);
    const y = parseInt(singleDateMatch[3], 10);
    if (!result.year) result.year = y;
    if (!result.month) result.month = m;
    if (result.quincena === undefined) {
      result.quincena = day <= 15 ? 1 : 2;
    }
    return result;
  }

  // ISO Single Date: "2026-02-01", "2026-02-15", "2026-02-16", "2026-02-28"
  const isoSingleMatch = normalized.match(
    /\b(202[0-9]|203[0-9])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12][0-9]|3[01])\b/
  );
  if (isoSingleMatch) {
    const y = parseInt(isoSingleMatch[1], 10);
    const m = parseInt(isoSingleMatch[2], 10);
    const day = parseInt(isoSingleMatch[3], 10);
    if (!result.year) result.year = y;
    if (!result.month) result.month = m;
    if (result.quincena === undefined) {
      result.quincena = day <= 15 ? 1 : 2;
    }
    return result;
  }

  // 5. EXPLICIT QUINCENA TEXT TOKENS (1A, 1ra, 2A, 2da, 1Q, 2Q)
  const is1raQ =
    /(?:^|[^a-z0-9])(?:1a|1ra|1era|primera|primer)\s*(?:quincena|q\b)?(?:$|[^a-z0-9])/i.test(normalized) ||
    /(?:quincena|q)\s*(?:0?1\b|1a|1ra|1era|primera)/i.test(normalized) ||
    /(?:^|[\s\-_\.\(\[])(?:1q|q1|01q|q01|1a|1ra|1era)(?:$|[\s\-_\.\)\]])/i.test(normalized) ||
    /\b(?:feb|ene|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[\s\-_]*(?:1a|1ra|1era|1q|q1)\b/i.test(normalized) ||
    /(?:^|[^a-z0-9])(?:1a|1ra|1era|1q|q1)[\s\-_]*(?:feb|ene|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(normalized);

  const is2daQ =
    /(?:^|[^a-z0-9])(?:2a|2da|segunda|segundo)\s*(?:quincena|q\b)?(?:$|[^a-z0-9])/i.test(normalized) ||
    /(?:quincena|q)\s*(?:0?2\b|2a|2da|segunda)/i.test(normalized) ||
    /(?:^|[\s\-_\.\(\[])(?:2q|q2|02q|q02|2a|2da)(?:$|[\s\-_\.\)\]])/i.test(normalized) ||
    /\b(?:feb|ene|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[\s\-_]*(?:2a|2da|2q|q2)\b/i.test(normalized) ||
    /(?:^|[^a-z0-9])(?:2a|2da|2q|q2)[\s\-_]*(?:feb|ene|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(normalized);

  if (is1raQ && !is2daQ) {
    result.quincena = 1;
  } else if (is2daQ && !is1raQ) {
    result.quincena = 2;
  }

  // 6. SHORT NUMERIC CODES (e.g. "2026-02-1" or "2026-02-2", "FEB-1" or "FEB-2")
  // Must NOT be followed by another date separator or year digits
  if (result.quincena === undefined) {
    const y_m_q = normalized.match(/\b(202[0-9]|203[0-9])[\-_](0?[1-9]|1[0-2])[\-_](1|2)(?:$|[^0-9])/);
    if (y_m_q) {
      if (!result.year) result.year = parseInt(y_m_q[1], 10);
      if (!result.month) result.month = parseInt(y_m_q[2], 10);
      result.quincena = parseInt(y_m_q[3], 10) as (1 | 2);
    }
  }

  if (result.quincena === undefined) {
    const m_q = normalized.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])[\-_](1|2)(?:$|[^0-9])/);
    if (m_q) {
      if (!result.month) result.month = parseInt(m_q[1], 10);
      result.quincena = parseInt(m_q[2], 10) as (1 | 2);
    }
  }

  // Fallback numeric month if still unassigned
  if (!result.month) {
    const numMonthMatch = normalized.match(
      /(?:202[0-9][\-_](0?[1-9]|1[0-2])|(?:^|[^\d])(0?[1-9]|1[0-2])[\-_](?:202[0-9]|1q|2q|1ra|2da|1a|2a\b))/i
    );
    if (numMonthMatch) {
      const mStr = numMonthMatch[1] || numMonthMatch[2];
      if (mStr) {
        const m = parseInt(mStr, 10);
        if (m >= 1 && m <= 12) result.month = m;
      }
    }
  }

  return result;
}

export function createEmptyQuincenaData(year: number, month: number, quincena: 1 | 2): IvaQuincenaData {
  return {
    id: generatePeriodKey(year, month, quincena),
    year,
    month,
    quincena,
    item40: 0,
    item41: 0,
    item42: 0,
    item43: 0,
    item442: 0,
    item443: 0,
    ingresoIntereses: 0,
    item47: 0,

    item30: 0,
    item31: 0,
    item33: 0,
    item34: 0,
    item333: 0,
    item343: 0,
    item35: 0,
    item70: 0,
    item37: 0,
    item71: 0,

    item20: 0,
    item38: 0,
    item39: 0,
    item53: 0,

    item60: 0,
    item54: 0,
    item66: 0,
    item67: 0,
    item90: 0,
  };
}

export function createInitialYearDataset(year: number): Record<string, IvaQuincenaData> {
  const dataset: Record<string, IvaQuincenaData> = {};
  for (let m = 1; m <= 12; m++) {
    dataset[generatePeriodKey(year, m, 1)] = createEmptyQuincenaData(year, m, 1);
    dataset[generatePeriodKey(year, m, 2)] = createEmptyQuincenaData(year, m, 2);
  }
  return dataset;
}

/**
 * Detects if a dataset has demo or simulator values loaded
 */
export function hasDemoOrSimulatorData(periodData: Record<string, IvaQuincenaData>): boolean {
  if (!periodData) return false;
  return Object.values(periodData).some(
    (p) =>
      p.numeroDeclaracion === '0938472910' ||
      p.numeroDeclaracion === '0938478422' ||
      p.item40 === 4367314.08 ||
      p.item40 === 5222264.15 ||
      (p.fileName && p.fileName.startsWith('FORMA_30_ENERO_'))
  );
}

// Sample initial data for company
export function createDemoDataset(year: number = 2025): {
  razonSocial: string;
  rif: string;
  fiscalYear: number;
  periodData: Record<string, IvaQuincenaData>;
} {
  const periodData = createInitialYearDataset(year);

  // Enero - 1ra Quincena
  const eneroQ1Key = generatePeriodKey(year, 1, 1);
  periodData[eneroQ1Key] = {
    ...periodData[eneroQ1Key],
    id: eneroQ1Key,
    fileName: `FORMA_30_ENERO_1Q_${year}.pdf`,
    numeroDeclaracion: '0938472910',
    numeroCertificado: `CERT-${year}-00192`,
    fechaDeclaracion: `${year}-01-18`,
    fechaDesde: `01/01/${year}`,
    fechaHasta: `15/01/${year}`,
    item40: 4367314.08,
    item42: 1326324.15,
    item43: 212211.86,
    ingresoIntereses: 0.0,
    item47: 212211.86,

    item30: 483631.26,
    item33: 1093181.68,
    item34: 174909.07,
    item333: 35787.72,
    item343: 2863.01,
    item35: 1612600.66,
    item70: 177772.08,
    item37: 0.0,
    item71: 177772.08,

    item20: 0.0,
    item38: 0.0,
    item39: 177772.08,
    item53: 34439.78,

    item60: -34439.79,
    item54: 0.0,
    item66: 0.0,
    item67: 0.0,
    item90: 34439.78,
  };

  // Enero - 2da Quincena
  const eneroQ2Key = generatePeriodKey(year, 1, 2);
  periodData[eneroQ2Key] = {
    ...periodData[eneroQ2Key],
    id: eneroQ2Key,
    fileName: `FORMA_30_ENERO_2Q_${year}.pdf`,
    numeroDeclaracion: '0938478422',
    numeroCertificado: `CERT-${year}-00455`,
    fechaDeclaracion: `${year}-02-02`,
    fechaDesde: `16/01/${year}`,
    fechaHasta: `31/01/${year}`,
    item40: 5222264.15,
    item42: 1641785.77,
    item43: 262685.72,
    ingresoIntereses: 0.0,
    item47: 262685.72,

    item30: 286707.32,
    item33: 796078.4,
    item34: 127372.54,
    item333: 0.0,
    item343: 0.0,
    item35: 1082785.72,
    item70: 127372.54,
    item37: 0.0,
    item71: 127372.54,

    item20: 0.0,
    item38: 0.0,
    item39: 127372.54,
    item53: 135313.18,

    item60: 0.0,
    item54: 0.0,
    item66: 7848.36,
    item67: 0.0,
    item90: 127464.82,
  };

  return {
    razonSocial: 'JMC SUPPLY, C.A.',
    rif: 'J-411499455',
    fiscalYear: year,
    periodData,
  };
}

// Format numbers in Venezuelan accounting format (1.234.567,89) or standard
export function formatCurrency(value: number | undefined | null, showZeroAsZero: boolean = true): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0,00';
  }
  if (value === 0 && !showZeroAsZero) {
    return '-';
  }

  // Format with 2 decimals
  const isNegative = value < 0;
  const absVal = Math.abs(value);
  const parts = absVal.toFixed(2).split('.');
  
  // Format integer with thousands dots
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPart = parts[1];

  return `${isNegative ? '-' : ''}${integerPart},${decimalPart}`;
}

export function parseCurrencyInput(input: string): number {
  if (!input) return 0;
  // Clean string: replace dots with empty, and commas with dot
  const clean = input.trim().replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// Calculate Total Ventas for a quincena
export function calcTotalVentas(data: IvaQuincenaData): number {
  return (data.item40 || 0) + (data.item42 || 0) + (data.item41 || 0) + (data.item442 || 0);
}

// Calculate Cuentas por Cobrar (Highlighted in Yellow in the image: Total Ventas + Debito Fiscal)
export function calcCuentasPorCobrar(data: IvaQuincenaData): number {
  return calcTotalVentas(data) + (data.item47 || 0);
}

// Calculate Total Compras
export function calcTotalCompras(data: IvaQuincenaData): number {
  return (data.item30 || 0) + (data.item33 || 0) + (data.item333 || 0) + (data.item31 || 0);
}

// Sanitize Quincena Data against row index collisions and ensure mathematical consistency
export function sanitizeQuincenaData(data: IvaQuincenaData): IvaQuincenaData {
  const d = { ...data };

  // 1. Debito Fiscal item47
  if (d.item47 === 10 && d.item43 === 0 && d.item443 === 0 && d.item42 === 0) {
    d.item47 = 0;
  }
  if (d.item42 > 0 && d.item43 === 0) {
    d.item43 = Math.round(d.item42 * 0.16 * 100) / 100;
  }
  if (d.item442 > 0 && d.item443 === 0) {
    d.item443 = Math.round(d.item442 * 0.08 * 100) / 100;
  }
  if (d.item43 > 0 || d.item443 > 0) {
    d.item47 = Math.round((d.item43 + (d.item443 || 0)) * 100) / 100;
  } else if (d.item42 === 0 && d.item442 === 0) {
    d.item47 = 0;
  }

  // 2. Compras item33 & item34 & item35
  if (d.item33 === 15 || d.item33 === 33 || d.item33 === 16 || d.item33 === 14) {
    if (d.item34 === 0 || d.item34 === 15 || d.item34 === 16 || d.item34 === 34) {
      d.item33 = 0;
      d.item34 = 0;
    }
  }
  if (d.item34 === 15 || d.item34 === 34 || d.item34 === 16) {
    if (d.item33 === 0) {
      d.item34 = 0;
    }
  }
  if (d.item30 === 11 || d.item30 === 30 || d.item30 === 10) {
    d.item30 = 0;
  }

  // Ensure item35 always equals total compras
  d.item35 = calcTotalCompras(d);

  return d;
}

// Full SENIAT Tax Engine: Recalculate single quincena fields strictly by Venezuelan Forma 30 tax logic
export function recalculateSingleQuincena(data: IvaQuincenaData): IvaQuincenaData {
  const d = sanitizeQuincenaData(data);

  // 1. Débitos
  if (d.item42 > 0 && d.item43 === 0) {
    d.item43 = Math.round(d.item42 * 0.16 * 100) / 100;
  }
  if (d.item442 > 0 && d.item443 === 0) {
    d.item443 = Math.round(d.item442 * 0.08 * 100) / 100;
  }
  d.item47 = Math.round(((d.item43 || 0) + (d.item443 || 0)) * 100) / 100;

  // 2. Compras
  if (d.item33 > 0 && d.item34 === 0) {
    d.item34 = Math.round(d.item33 * 0.16 * 100) / 100;
  }
  if (d.item333 > 0 && d.item343 === 0) {
    d.item343 = Math.round(d.item333 * 0.08 * 100) / 100;
  }
  d.item35 = Math.round(((d.item30 || 0) + (d.item33 || 0) + (d.item333 || 0) + (d.item31 || 0)) * 100) / 100;

  // 3. Créditos deducibles
  const credDirect = Math.round(((d.item34 || 0) + (d.item343 || 0)) * 100) / 100;
  if (!d.item70 || d.item70 === 20 || d.item70 === 70 || d.item70 === 17) {
    d.item70 = credDirect;
  }
  d.item71 = Math.round(((d.item70 || 0) + (d.item37 || 0)) * 100) / 100;

  // 4. Total créditos del período
  d.item39 = Math.round(((d.item71 || 0) + (d.item20 || 0) + (d.item38 || 0)) * 100) / 100;

  // 5. Cuota vs Excedente
  if (d.item47 > d.item39) {
    d.item53 = Math.round((d.item47 - d.item39) * 100) / 100;
    d.item60 = 0;
  } else {
    d.item53 = 0;
    d.item60 = Math.round((d.item39 - d.item47) * 100) / 100;
  }

  // 6. Retenciones y Total a Pagar
  const totalRetAvail = Math.round(((d.item54 || 0) + (d.item66 || 0)) * 100) / 100;
  if (d.item53 > 0) {
    if (totalRetAvail >= d.item53) {
      d.item90 = 0;
      d.item67 = Math.round((totalRetAvail - d.item53) * 100) / 100;
    } else {
      d.item90 = Math.round((d.item53 - totalRetAvail) * 100) / 100;
      d.item67 = 0;
    }
  } else {
    d.item90 = 0;
    d.item67 = totalRetAvail;
  }

  return d;
}

// Cascade continuity reconciliation for all 24 quincenas in fiscal year
export function reconcileAnnualContinuity(
  fiscalYear: number,
  periodData: Record<string, IvaQuincenaData>
): {
  updatedPeriodData: Record<string, IvaQuincenaData>;
  changesCount: number;
} {
  const result: Record<string, IvaQuincenaData> = {};
  let changesCount = 0;
  let prevQuincena: IvaQuincenaData | null = null;

  for (let m = 1; m <= 12; m++) {
    for (let q = 1 as 1 | 2; q <= 2; q++) {
      const pKey = generatePeriodKey(fiscalYear, m, q);
      const existing = periodData[pKey] || {
        id: pKey,
        year: fiscalYear,
        month: m,
        quincena: q,
        item40: 0, item41: 0, item42: 0, item43: 0, item442: 0, item443: 0,
        ingresoIntereses: 0, item47: 0, item30: 0, item31: 0, item33: 0,
        item34: 0, item333: 0, item343: 0, item35: 0, item70: 0, item37: 0,
        item71: 0, item20: 0, item38: 0, item39: 0, item53: 0, item60: 0,
        item54: 0, item66: 0, item67: 0, item90: 0,
      };

      const curr = { ...existing };

      if (prevQuincena) {
        // Carry forward Excedente: Item 60 of previous period becomes Item 20 of current period
        const targetExcedente = prevQuincena.item60 || 0;
        if (Math.abs((curr.item20 || 0) - targetExcedente) > 0.01) {
          curr.item20 = targetExcedente;
          changesCount++;
        }

        // Carry forward Retenciones: Item 67 of previous period becomes Item 54 of current period
        const targetRetenciones = prevQuincena.item67 || 0;
        if (Math.abs((curr.item54 || 0) - targetRetenciones) > 0.01) {
          curr.item54 = targetRetenciones;
          changesCount++;
        }
      }

      // Recalculate this quincena
      const calibrated = recalculateSingleQuincena(curr);
      result[pKey] = calibrated;
      prevQuincena = calibrated;
    }
  }

  return {
    updatedPeriodData: result,
    changesCount,
  };
}

// Audit all 24 periods and return real-time diagnostics
export function auditPeriodHealth(
  fiscalYear: number,
  periodData: Record<string, IvaQuincenaData>
): {
  isValid: boolean;
  totalPeriodsWithData: number;
  warnings: {
    periodKey: string;
    periodName: string;
    type: 'excedente' | 'retencion' | 'alicuota' | 'totales';
    message: string;
  }[];
} {
  const warnings: {
    periodKey: string;
    periodName: string;
    type: 'excedente' | 'retencion' | 'alicuota' | 'totales';
    message: string;
  }[] = [];

  let totalPeriodsWithData = 0;
  let prevData: IvaQuincenaData | null = null;

  for (let m = 1; m <= 12; m++) {
    for (let q = 1 as 1 | 2; q <= 2; q++) {
      const pKey = generatePeriodKey(fiscalYear, m, q);
      const curr = periodData[pKey];
      if (!curr) continue;

      const hasData =
        curr.item40 > 0 ||
        curr.item42 > 0 ||
        curr.item30 > 0 ||
        curr.item33 > 0 ||
        curr.item20 > 0 ||
        curr.item60 > 0 ||
        curr.item54 > 0 ||
        curr.item66 > 0 ||
        curr.item90 > 0 ||
        Boolean(curr.fileName);

      if (hasData) totalPeriodsWithData++;

      const pName = `${MONTH_NAMES[m - 1]} (${q === 1 ? '1ª Q' : '2ª Q'})`;

      // 1. Check Rate consistency (Item 42 vs 43)
      if (curr.item42 > 0) {
        const expectedDebito = Math.round(curr.item42 * 0.16 * 100) / 100;
        if (Math.abs(curr.item43 - expectedDebito) > 1.5) {
          warnings.push({
            periodKey: pKey,
            periodName: pName,
            type: 'alicuota',
            message: `Débito Fiscal (Item 43: Bs. ${formatCurrency(curr.item43)}) difiere del 16% de Ventas Gravadas (Item 42: Bs. ${formatCurrency(expectedDebito)}).`,
          });
        }
      }

      // 2. Check Rate consistency (Item 33 vs 34)
      if (curr.item33 > 0) {
        const expectedCredito = Math.round(curr.item33 * 0.16 * 100) / 100;
        if (Math.abs(curr.item34 - expectedCredito) > 1.5) {
          warnings.push({
            periodKey: pKey,
            periodName: pName,
            type: 'alicuota',
            message: `Crédito Fiscal (Item 34: Bs. ${formatCurrency(curr.item34)}) difiere del 16% de Compras Gravadas (Item 33: Bs. ${formatCurrency(expectedCredito)}).`,
          });
        }
      }

      // 3. Continuity checks with previous period
      if (prevData) {
        const prevName = `${MONTH_NAMES[prevData.month - 1]} (${prevData.quincena === 1 ? '1ª Q' : '2ª Q'})`;

        // Check Excedente Item 60 -> Item 20
        const prevExcedente = prevData.item60 || 0;
        const currExcedenteAnterior = curr.item20 || 0;
        if (Math.abs(prevExcedente - currExcedenteAnterior) > 0.05 && (prevExcedente > 0 || currExcedenteAnterior > 0)) {
          warnings.push({
            periodKey: pKey,
            periodName: pName,
            type: 'excedente',
            message: `Excedente Período Anterior (Item 20: Bs. ${formatCurrency(currExcedenteAnterior)}) no coincide con el Excedente del cierre de ${prevName} (Item 60: Bs. ${formatCurrency(prevExcedente)}).`,
          });
        }

        // Check Retenciones Item 67 -> Item 54
        const prevRetSaldo = prevData.item67 || 0;
        const currRetAcumulada = curr.item54 || 0;
        if (Math.abs(prevRetSaldo - currRetAcumulada) > 0.05 && (prevRetSaldo > 0 || currRetAcumulada > 0)) {
          warnings.push({
            periodKey: pKey,
            periodName: pName,
            type: 'retencion',
            message: `Retenciones Acumuladas (Item 54: Bs. ${formatCurrency(currRetAcumulada)}) no coinciden con el Saldo No Aplicado de ${prevName} (Item 67: Bs. ${formatCurrency(prevRetSaldo)}).`,
          });
        }
      }

      prevData = curr;
    }
  }

  return {
    isValid: warnings.length === 0,
    totalPeriodsWithData,
    warnings,
  };
}

// Definition of rows matching exactly the user's reference image
export const SPREADSHEET_ROWS: SpreadsheetRowConfig[] = [
  // SECTION 1: VENTAS Y DEBITOS FISCALES
  {
    id: 'item40',
    label: 'Ventas Internas No Gravadas',
    itemCode: 'Item 40',
    getValue: (d) => d.item40,
    setValue: (d, v) => { d.item40 = v; },
    formulaDescription: 'Base de ventas exentas y no gravadas',
  },
  {
    id: 'item42',
    label: 'Ventas Gravadas',
    itemCode: 'Item 42',
    getValue: (d) => d.item42,
    setValue: (d, v) => { d.item42 = v; },
    formulaDescription: 'Base imponible ventas alícuota general 16%',
  },
  {
    id: 'totalVentas',
    label: 'TOTAL VENTAS',
    itemCode: '',
    isBold: true,
    isSubtotal: true,
    getValue: (d) => calcTotalVentas(d),
    formulaDescription: 'Suma de Ventas No Gravadas + Ventas Gravadas (Item 40 + Item 42)',
  },
  {
    id: 'ingresoIntereses',
    label: 'INGRESO INTERESES BANCARIOS',
    itemCode: '',
    getValue: (d) => d.ingresoIntereses,
    setValue: (d, v) => { d.ingresoIntereses = v; },
    formulaDescription: 'Ingresos por intereses bancarios',
  },
  {
    id: 'item47',
    label: 'Debito Fiscal',
    itemCode: 'Item 47',
    getValue: (d) => d.item47,
    setValue: (d, v) => { d.item47 = v; },
    formulaDescription: 'Total Débitos Fiscales del período',
  },
  {
    id: 'cuentasCobrar',
    label: 'CUENTAS P COBRAR',
    itemCode: '',
    isBold: true,
    isHighlightYellow: true,
    getValue: (d) => calcCuentasPorCobrar(d),
    formulaDescription: 'Total Facturado a Clientes = TOTAL VENTAS + Debito Fiscal',
  },

  // SECTION 2: COMPRAS Y CREDITOS FISCALES
  {
    id: 'item30',
    label: 'Compras Exentas',
    itemCode: 'Item 30',
    getValue: (d) => d.item30,
    setValue: (d, v) => { d.item30 = v; },
    formulaDescription: 'Base de compras exentas o no gravadas',
  },
  {
    id: 'item33',
    label: 'Compras Gravadas 16%',
    itemCode: 'Item 33',
    getValue: (d) => d.item33,
    setValue: (d, v) => { d.item33 = v; },
    formulaDescription: 'Base imponible compras gravadas 16%',
  },
  {
    id: 'item333',
    label: 'Compras Gravadas 8%',
    itemCode: 'Item333',
    getValue: (d) => d.item333,
    setValue: (d, v) => { d.item333 = v; },
    formulaDescription: 'Base imponible compras gravadas 8% (Alícuota Reducida)',
  },
  {
    id: 'item35',
    label: 'TOTAL COMPRAS',
    itemCode: 'Item 35',
    isBold: true,
    isSubtotal: true,
    getValue: (d) => d.item35 || calcTotalCompras(d),
    setValue: (d, v) => { d.item35 = v; },
    formulaDescription: 'Total de Compras del período (Item 30 + Item 33 + Item 333)',
  },

  // SECTION 3: DETERMINACIÓN DE CRÉDITOS
  {
    id: 'item34',
    label: 'Credito Fiscal',
    itemCode: 'Item 34',
    getValue: (d) => d.item34,
    setValue: (d, v) => { d.item34 = v; },
    formulaDescription: 'Crédito fiscal compras alícuota general 16%',
  },
  {
    id: 'item343',
    label: 'Alicuota reducida',
    itemCode: 'item 343',
    getValue: (d) => d.item343,
    setValue: (d, v) => { d.item343 = v; },
    formulaDescription: 'Crédito fiscal compras alícuota reducida 8%',
  },
  {
    id: 'item70',
    label: 'Creditos Fiscales Totalmente deduc',
    itemCode: 'Item 70',
    getValue: (d) => d.item70 || (d.item34 + d.item343),
    setValue: (d, v) => { d.item70 = v; },
    formulaDescription: 'Total créditos fiscales totalmente deducibles',
  },
  {
    id: 'item37',
    label: 'Cred Fiscales Producto del % prorra',
    itemCode: 'Item 37',
    getValue: (d) => d.item37,
    setValue: (d, v) => { d.item37 = v; },
    formulaDescription: 'Créditos fiscales por porcentaje de prorrateo',
  },
  {
    id: 'item71',
    label: 'Total creditos Fiscales Deducibles',
    itemCode: 'Item 71',
    isBold: true,
    getValue: (d) => d.item71 || ((d.item70 || (d.item34 + d.item343)) + (d.item37 || 0)),
    setValue: (d, v) => { d.item71 = v; },
    formulaDescription: 'Item 70 + Item 37',
  },

  // SECTION 4: EXCEDENTES Y CUOTA TRIBUTARIA
  {
    id: 'item20',
    label: 'Excedente Credito Fiscal Mes An',
    itemCode: 'Item 20',
    getValue: (d) => d.item20,
    setValue: (d, v) => { d.item20 = v; },
    formulaDescription: 'Excedente de crédito fiscal del período anterior',
  },
  {
    id: 'item38',
    label: 'Ajuste a los creditos fiscales meses',
    itemCode: 'Item 38',
    getValue: (d) => d.item38,
    setValue: (d, v) => { d.item38 = v; },
    formulaDescription: 'Ajustes a créditos fiscales de meses anteriores',
  },
  {
    id: 'item39',
    label: 'Total Creditos Fiscales del mes',
    itemCode: 'Item 39',
    isBold: true,
    getValue: (d) => d.item39 || ((d.item71 || 0) + (d.item20 || 0) + (d.item38 || 0)),
    setValue: (d, v) => { d.item39 = v; },
    formulaDescription: 'Total Créditos Fiscales = Item 71 + Item 20 + Item 38',
  },
  {
    id: 'item53',
    label: 'Total Cuota Tributaria',
    itemCode: 'Item 53',
    isBold: true,
    getValue: (d) => d.item53,
    setValue: (d, v) => { d.item53 = v; },
    formulaDescription: 'Cuota Tributaria = Débito Fiscal - Total Créditos Fiscales',
  },

  // SECTION 5: RETENCIONES Y TOTAL A PAGAR
  {
    id: 'item60',
    label: 'Excedente Cred Fiscal para mes',
    itemCode: 'Item 60',
    getValue: (d) => d.item60,
    setValue: (d, v) => { d.item60 = v; },
    formulaDescription: 'Excedente de crédito fiscal a favor para el siguiente período',
  },
  {
    id: 'item54',
    label: 'Retenciones Acumuladas Por De',
    itemCode: 'Item 54',
    getValue: (d) => d.item54,
    setValue: (d, v) => { d.item54 = v; },
    formulaDescription: 'Retenciones de IVA acumuladas en períodos anteriores',
  },
  {
    id: 'item66',
    label: 'Retenciones del Periodo',
    itemCode: 'Item 66',
    getValue: (d) => d.item66,
    setValue: (d, v) => { d.item66 = v; },
    formulaDescription: 'Retenciones de IVA soportadas en este período',
  },
  {
    id: 'item67',
    label: 'Saldo de Retenciones de Iva No',
    itemCode: 'Item 67',
    getValue: (d) => d.item67,
    setValue: (d, v) => { d.item67 = v; },
    formulaDescription: 'Saldo de retenciones no aplicadas para el período siguiente',
  },
  {
    id: 'item90',
    label: 'TOTAL A PAGAR',
    itemCode: 'Item 90',
    isBold: true,
    isTotal: true,
    getValue: (d) => d.item90,
    setValue: (d, v) => { d.item90 = v; },
    formulaDescription: 'Total impuesto a pagar al SENIAT = Cuota Tributaria - Retenciones',
  },
];
