import { GoogleGenAI } from "@google/genai";
import { PDFParse } from "pdf-parse";

export interface ExtractedIvaData {
  razonSocial: string;
  rif: string;
  fiscalYear: number;
  month: number;
  quincena: 1 | 2;
  fechaDesde: string;
  fechaHasta: string;
  numeroDeclaracion: string;
  numeroCertificado: string;
  fechaDeclaracion: string;
  fileName: string;

  // Débitos y Ventas (Página 1 de Forma 30)
  item40: number; // Ventas No Gravadas
  item41: number; // Ventas Exportación
  item42: number; // Ventas Gravadas 16% (Base Imponible)
  item43: number; // Débito Fiscal 16%
  item442: number; // Ventas Gravadas 8% (Base Imponible)
  item443: number; // Débito Fiscal 8%
  ingresoIntereses: number;
  item47: number; // Total Débito Fiscal

  // Créditos y Compras (Página 2 de Forma 30)
  item30: number; // Compras No Sujetas / Exentas
  item31: number; // Importaciones Exentas
  item33: number; // Compras Gravadas 16% (Base Imponible)
  item34: number; // Crédito Fiscal 16%
  item333: number; // Compras Gravadas 8% (Base Imponible)
  item343: number; // Crédito Fiscal 8%
  item35: number; // Total Compras
  item70: number; // Créditos Totalmente Deducibles
  item37: number; // Créditos por Prorrateo
  item71: number; // Total Créditos Fiscales Deducibles

  // Determinación y Excedentes (Página 2 de Forma 30)
  item20: number; // Excedente Crédito Fiscal Período Anterior
  item38: number; // Ajustes Créditos Anteriores
  item39: number; // Total Créditos Fiscales del Período
  item53: number; // Total Cuota Tributaria
  item60: number; // Excedente Crédito Fiscal para el Período Siguiente

  // Retenciones y Pago (Página 2 de Forma 30)
  item54: number; // Retenciones Acumuladas Períodos Anteriores
  item66: number; // Retenciones del Período
  item67: number; // Saldo de Retenciones no aplicadas
  item90: number; // TOTAL A PAGAR

  extractedAt: string;
  sourceMethod: "ai" | "deterministic" | "hybrid";
}

// Extract Year, Month, and Quincena from file name patterns
export function detectPeriodFromFilename(fileName: string): {
  year?: number;
  month?: number;
  quincena?: 1 | 2;
} {
  const result: { year?: number; month?: number; quincena?: 1 | 2 } = {};
  if (!fileName) return result;

  const baseName = fileName.replace(/\.[^/.]+$/, "");
  // Normalize string: lowercase, replace underscores with hyphens for uniformity, remove accents
  const normalized = baseName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ª/g, "a")
    .replace(/º/g, "o")
    .replace(/_/g, "-");

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
    const regex = new RegExp(`(?:^|[^a-z0-9])${name}(?:$|[^a-z0-9])`, "i");
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

// Convert Venezuelan number format ("147.909,07" or "147,909.07" or "147909.07" or "1.326.324,15") to float
// Convert Venezuelan number format ("147.909,07" or "147,909.07" or "2.479.904" or "1.326.324,15") to float
export function parseVenAmount(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str) return 0;

  const isNegative = str.startsWith("-") || (str.startsWith("(") && str.endsWith(")"));
  // Strip ONLY currency symbols and surrounding brackets/spaces — NEVER strip dots or commas from numeric figures!
  str = str.replace(/(?:Bs\.?|VES|\$|\s|\(|\))/gi, "").trim();

  if (str.includes(",") && str.includes(".")) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      // 1.234.567,89 -> 1234567.89
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234,567.89 -> 1234567.89
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      str = str.replace(/,/g, "");
    } else {
      str = str.replace(",", ".");
    }
  } else if (str.includes(".")) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Multiple dots: e.g. 2.479.904 -> 2479904
      str = str.replace(/\./g, "");
    } else {
      // Single dot: e.g. "451.360" or "2.479" vs "123.45" or "0.00"
      if (/\.\d{3}$/.test(str)) {
        str = str.replace(/\./g, "");
      }
    }
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  const rounded = Math.round(num * 100) / 100;
  return isNegative ? -Math.abs(rounded) : rounded;
}

// Normalize spacing in extracted PDF text so character position splits don't break regex matching
export function normalizePdfText(text: string): string {
  if (!text) return "";
  let clean = text.replace(/\r\n/g, "\n");
  clean = clean.replace(/(\d)\s*([\.,])\s*(\d)/g, "$1$2$3");
  clean = clean.replace(/(\d)\s*([\.,])\s*(\d)/g, "$1$2$3");
  clean = clean.replace(/\[\s*(\d{1,3})\s*\]/g, "[$1]");
  clean = clean.replace(/\(\s*(\d{1,3})\s*\)/g, "($1)");
  clean = clean.replace(/[ \t]+/g, " ");
  return clean;
}

// Extract raw text from PDF buffer preserving multi-page contents
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const textResult = await parser.getText();
    await parser.destroy();
    return textResult.text || "";
  } catch (err) {
    console.warn("PDFParse reading text warning:", err);
    return "";
  }
}

// Helper: Extract valid monetary amounts from text line/window, filtering out row indices, item codes, dates, and percentages
function extractAmountsFromWindow(
  text: string,
  excludedNumbers: number[] = []
): number[] {
  let sanitized = text.replace(/(?:^|\n|\r|\s)\d{1,2}\.\s+/g, " ");
  sanitized = sanitized.replace(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g, " ");
  sanitized = sanitized.replace(/\b(?:del|desde)?\s*\d{1,2}\s*(?:al|a|hasta|-)\s*\d{1,2}\b/gi, " ");
  sanitized = sanitized.replace(/\b\d+(?:[\.,]\d+)?\s*%/g, " ");
  sanitized = sanitized.replace(/\b20[2-3][0-9]\b/g, " ");
  sanitized = sanitized.replace(/\b([0-9]{1,2})\b(?!\s*,\s*\d{2}|\s*\.\s*\d{2})/g, " ");

  const tokenRegex = /(?:\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b|\b\d+[,\.]\d{1,2}\b|\b\d{4,}\b)/g;
  const matches = sanitized.match(tokenRegex) || [];
  const amounts: number[] = [];

  const commonItemCodes = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    28, 30, 31, 32, 33, 34, 35, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
    53, 54, 60, 66, 67, 70, 71, 90, 442, 443, 333, 343
  ];

  for (const m of matches) {
    const parsed = parseVenAmount(m);
    if (excludedNumbers.includes(parsed)) continue;
    if (parsed > 500000000) continue;
    if (!m.includes(",") && !m.includes(".") && (commonItemCodes.includes(parsed) || parsed < 100)) continue;
    if (parsed === 10 || parsed === 15) {
      if (!m.includes(",00") && !m.includes(".00")) continue;
    }
    amounts.push(parsed);
  }

  return amounts;
}

// Targeted Casilla amount extractor for SENIAT forms
export function extractCasillaAmount(cleanText: string, casillaCode: number): number | null {
  const normText = normalizePdfText(cleanText);
  const lines = normText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  const bracketTarget = `[${casillaCode}]`;
  const parenTarget = `(${casillaCode})`;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasBracket = line.includes(bracketTarget);
    const hasParen = line.includes(parenTarget);
    const hasBareCode = new RegExp(`(?:casilla|rengl[oó]n|c[oó]digo|item)?\\s*\\b${casillaCode}\\b`, "i").test(line);

    if (hasBracket || hasParen || hasBareCode) {
      let codePos = -1;
      let cutOffset = 0;
      if (hasBracket) {
        codePos = line.indexOf(bracketTarget);
        cutOffset = bracketTarget.length;
      } else if (hasParen) {
        codePos = line.indexOf(parenTarget);
        cutOffset = parenTarget.length;
      } else {
        codePos = line.search(new RegExp(`\\b${casillaCode}\\b`));
        cutOffset = String(casillaCode).length;
      }

      const afterCode = codePos !== -1 ? line.substring(codePos + cutOffset) : line;
      // Match Venezuelan monetary numbers with or without decimals: 2.479.904,00 or 2.479.904 or 451.360,44 or 451.360 or 0,00 or 0
      const moneyMatches = afterCode.match(/(?:\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b|\b\d+[,\.]\d{1,2}\b|\b0(?:[,\.]00)?\b|\b\d+\b)/g);

      if (moneyMatches && moneyMatches.length > 0) {
        for (const m of moneyMatches) {
          const val = parseVenAmount(m);
          if (val !== casillaCode || m.includes(",") || m.includes(".")) {
            return val;
          }
        }
      }

      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextMoneyMatches = nextLine.match(/(?:\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b|\b\d+[,\.]\d{1,2}\b|\b0(?:[,\.]00)?\b|\b\d+\b)/g);
        if (nextMoneyMatches && nextMoneyMatches.length > 0) {
          for (const m of nextMoneyMatches) {
            const val = parseVenAmount(m);
            if (val !== casillaCode || m.includes(",") || m.includes(".")) {
              return val;
            }
          }
        }
      }
    }
  }

  const patterns = [
    new RegExp(`\\[${casillaCode}\\][\\s:;\\|\\.\\-_]*(?:Bs\\.?)?[\\s:;\\|\\.\\-_]*([\\d]{1,3}(?:[\\.\\,]\\d{3})*(?:[\\.,]\\d{1,2})?|0(?:[\\.,]00)?|\\d+)`, "i"),
    new RegExp(`\\(${casillaCode}\\)[\\s:;\\|\\.\\-_]*(?:Bs\\.?)?[\\s:;\\|\\.\\-_]*([\\d]{1,3}(?:[\\.\\,]\\d{3})*(?:[\\.,]\\d{1,2})?|0(?:[\\.,]00)?|\\d+)`, "i"),
    new RegExp(`(?:casilla|rengl[oó]n|c[oó]digo|item)?\\s*\\b${casillaCode}\\b[\\s:;\\|\\.\\-_]*(?:Bs\\.?)?[\\s:;\\|\\.\\-_]*([\\d]{1,3}(?:[\\.\\,]\\d{3})*(?:[\\.,]\\d{1,2})?|0(?:[\\.,]00)?|\\d+)`, "i"),
  ];

  for (const pat of patterns) {
    const match = normText.match(pat);
    if (match && match[1]) {
      const val = parseVenAmount(match[1]);
      if (val !== casillaCode || match[1].includes(",") || match[1].includes(".")) {
        return val;
      }
    }
  }

  return null;
}

// Rule-based SENIAT parser for Forma 30 and Certificados Electrónicos (Supports Pages 1 & 2)
export function parseSeniatText(rawText: string, fileName: string): Partial<ExtractedIvaData> {
  const result: Partial<ExtractedIvaData> = {};
  const cleanText = rawText.replace(/\r\n/g, "\n");
  const lines = cleanText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // 1. RIF Extraction (e.g. J-411499455, J411499455, V-12345678)
  const rifMatch = cleanText.match(/(?:RIF|R\.I\.F\.?|NÚMERO DE RIF|NUMERO DE RIF)[\s:]*([VJEGP]-?\d{7,9}-?\d?)/i) ||
                   cleanText.match(/\b([VJEGP]-?\d{7,9}-?\d?)\b/i);
  if (rifMatch) {
    let rif = rifMatch[1].toUpperCase().replace(/\s+/g, "");
    if (!rif.includes("-") && rif.length >= 8) {
      rif = `${rif[0]}-${rif.slice(1)}`;
    }
    result.rif = rif;
  }

  // 2. Razón Social Extraction
  const razonSocialMatch = cleanText.match(/(?:Razón Social|Nombre o Razón Social|Contribuyente|NOMBRE O RAZÓN SOCIAL|NOMBRE O RAZON SOCIAL)[\s:]+([^\n\r]+)/i) ||
                           cleanText.match(/(?:APELLIDOS Y NOMBRES O RAZÓN SOCIAL)[\s:]+([^\n\r]+)/i);
  if (razonSocialMatch) {
    const rawName = razonSocialMatch[1].trim().replace(/^[:\-\s]+/, "").split(/\s{3,}|\t/)[0];
    if (rawName && rawName.length > 2) {
      result.razonSocial = rawName.toUpperCase();
    }
  }

  // 3. Fechas: Período Impositivo (Desde / Hasta) vs Fecha de Declaración
  // IMPORTANT: We separate the tax period dates (Período Impositivo) from the submission date (Fecha de Presentación/Declaración)
  const fechaDeclMatch = cleanText.match(/(?:Fecha de Declaración|FECHA DE DECLARACION|Fecha de Presentación|FECHA DE PRESENTACION|FECHA PRESENTACION|FECHA DECLARACIÓN)[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (fechaDeclMatch) result.fechaDeclaracion = fechaDeclMatch[1];

  // Look strictly for tax period ranges:
  // e.g. "PERIODO IMPOSITIVO ... DESDE: 01/02/2026 HASTA: 15/02/2026"
  // or "01/02/2026 AL 15/02/2026" or "16/02/2026 AL 28/02/2026"
  const periodoMatch = cleanText.match(/(?:PERIODO|PERÍODO)\s*(?:IMPOSITIVO)?[\s\S]{0,120}?DESDE[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[\s\S]{0,60}?HASTA[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);

  const rangeMatch = cleanText.match(/\b(0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9])\s*(?:AL|A|HASTA|-)\s*(0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9])\b/i);

  const fechaDesdeMatch = cleanText.match(/(?:Período Desde|PERIODO DESDE|Período Impositivo[^\n\r]*Desde|Desde)[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ||
                          cleanText.match(/(?:Per[ií]odo|Periodo)[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*(?:AL|A|HASTA|-)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  
  const fechaHastaMatch = cleanText.match(/(?:Período Hasta|PERIODO HASTA|Período Impositivo[^\n\r]*Hasta|Hasta)[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);

  if (periodoMatch) {
    result.fechaDesde = periodoMatch[1];
    result.fechaHasta = periodoMatch[2];
  } else if (rangeMatch) {
    result.fechaDesde = `${rangeMatch[1]}/${rangeMatch[2]}/${rangeMatch[3]}`;
    result.fechaHasta = `${rangeMatch[4]}/${rangeMatch[5]}/${rangeMatch[6]}`;
  } else {
    if (fechaDesdeMatch) {
      result.fechaDesde = fechaDesdeMatch[1];
      if (fechaDesdeMatch[2] && !result.fechaHasta) {
        result.fechaHasta = fechaDesdeMatch[2];
      }
    }
    if (fechaHastaMatch) result.fechaHasta = fechaHastaMatch[1];
  }

  // 4. Determinación infalible de Año Fiscal, Mes y Quincena
  const filenameCues = detectPeriodFromFilename(fileName);

  let detectedYear = filenameCues.year || new Date().getFullYear();
  let detectedMonth: number | null = filenameCues.month || null;
  let detectedQuincena: 1 | 2 | null = filenameCues.quincena || null;

  // Check direct SENIAT header if month/year not found in filename: "AÑO: 2026 MES: 02" or "MES: FEBRERO"
  if (detectedMonth === null || !filenameCues.year) {
    const headerPeriodMatch = cleanText.match(/(?:AÑO|ANO)[:\s]*(\d{4})[\s\S]*?MES[:\s]*(0?[1-9]|1[0-2]|ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b/i) ||
                              cleanText.match(/MES[:\s]*(0?[1-9]|1[0-2]|ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)[\s\S]*?(?:AÑO|ANO)[:\s]*(\d{4})\b/i);

    const monthNamesSpanish: { [k: string]: number } = {
      enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
      mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
      septiembre: 9, setiembre: 9, sep: 9, octubre: 10, oct: 10, noviembre: 11, nov: 11, diciembre: 12, dic: 12
    };

    if (headerPeriodMatch) {
      const rawVal = (headerPeriodMatch[1] || headerPeriodMatch[2] || "").toLowerCase();
      if (monthNamesSpanish[rawVal] && detectedMonth === null) {
        detectedMonth = monthNamesSpanish[rawVal];
      } else {
        const parsedM = parseInt(rawVal, 10);
        if (!isNaN(parsedM) && parsedM >= 1 && parsedM <= 12 && detectedMonth === null) {
          detectedMonth = parsedM;
        }
      }
    }
  }

  // Cross-verify with tax period Desde & Hasta (DO NOT USE FECHA DE PRESENTACION)
  if (result.fechaDesde) {
    const parts = result.fechaDesde.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;

      if (!isNaN(year) && year > 2000 && year < 2100 && !filenameCues.year) detectedYear = year;
      if (!isNaN(month) && month >= 1 && month <= 12 && detectedMonth === null) detectedMonth = month;
      if (!isNaN(day) && detectedQuincena === null) {
        detectedQuincena = day > 15 ? 2 : 1;
      }
    }
  }

  if (result.fechaHasta) {
    const parts = result.fechaHasta.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (detectedMonth === null && !isNaN(month) && month >= 1 && month <= 12) detectedMonth = month;
      
      if (detectedQuincena === null) {
        if (day <= 15) {
          detectedQuincena = 1;
        } else if (day >= 16) {
          detectedQuincena = 2;
        }
      }
    }
  }

  // Check document text for explicit Quincena mentions if still not determined
  if (detectedQuincena === null) {
    const textHas1raQ = /(?:1a|1ra|1era|primera|1ª)\s*(?:quincena|q\b)|quincena\s*(?:0?1|1a|1ra|1era|1ª)\b|\b0?1[\/\-\.]0?2[\/\-\.]202[0-9]\s*(?:al|a|hasta|-)\s*15[\/\-\.]0?2[\/\-\.]202[0-9]\b|\b(?:01|1)\s*(?:al|a|hasta|-)\s*15\s*(?:de\s*)?(?:febrero|feb)\b/i.test(cleanText);
    const textHas2daQ = /(?:2a|2da|segunda|2ª)\s*(?:quincena|q\b)|quincena\s*(?:0?2|2a|2da|segunda)\b|\b16[\/\-\.]0?2[\/\-\.]202[0-9]\s*(?:al|a|hasta|-)\s*(?:28|29)[\/\-\.]0?2[\/\-\.]202[0-9]\b|\b16\s*(?:al|a|hasta|-)\s*(?:28|29|30|31)\s*(?:de\s*)?(?:febrero|feb)\b/i.test(cleanText);

    if (textHas1raQ && !textHas2daQ) detectedQuincena = 1;
    else if (textHas2daQ && !textHas1raQ) detectedQuincena = 2;
  }

  // If year found in text and not in filename
  if (!filenameCues.year) {
    const yearMatch = `${fileName} ${cleanText}`.match(/\b(202[0-9])\b/);
    if (yearMatch) {
      detectedYear = parseInt(yearMatch[1], 10);
    }
  }

  result.fiscalYear = detectedYear;
  result.month = detectedMonth !== null ? detectedMonth : 2; // Default
  result.quincena = detectedQuincena !== null ? detectedQuincena : 1; // Default

  // 5. Declaración & Certificado numbers
  const declNumMatch = cleanText.match(/(?:Número de Declaración|NUMERO DE DECLARACION|N° de Declaración|Nro\. Declaración|Declaración No\.)[\s:]*([A-Z0-9\-]+)/i);
  const certNumMatch = cleanText.match(/(?:Número de Certificado|NUMERO DE CERTIFICADO|N° Certificado|Certificado Electrónico No\.|Certificado No\.)[\s:]*([A-Z0-9\-]+)/i);
  if (declNumMatch) result.numeroDeclaracion = declNumMatch[1];
  if (certNumMatch) result.numeroCertificado = certNumMatch[1];

  // 6. Direct Casilla Extraction (Most accurate for standard SENIAT Forma 30)
  let casilla40 = extractCasillaAmount(cleanText, 40);
  if (casilla40 === null) {
    // Dedicated search for Renglón 1 / Ventas no gravadas y/o sin derecho a crédito fiscal
    const m40 = cleanText.match(/(?:(?:1[\.\)\-]?\s*)?Ventas\s+(?:internas\s+)?no\s+gravadas(?:\s+y\s*\/\s*o\s+sin\s+derecho\s+a\s+cr[eé]dito(?:\s+fiscal)?)?|sin\s+derecho\s+a\s+cr[eé]dito\s+fiscal|Ventas\s+no\s+sujetas|Ventas\s+exentas)[\s\S]{0,100}?(?:\[\s*40\s*\]|\(\s*40\s*\)|\b40\b)?[\s:\|\.\-_]*(?:Bs\.?|VES)?[\s:\|\.\-_]*([1-9]\d{0,2}(?:\.\d{3})*(?:,\d{2})?|0[,\.]\d{2}|\d+[,\.]\d{2}|\d+)(?![\\.\\)\\-]\\s*[a-zA-Z])/i);
    if (m40 && m40[1]) {
      const parsed40 = parseVenAmount(m40[1]);
      if (parsed40 !== 40 && parsed40 !== 1) {
        casilla40 = parsed40;
      }
    }
  }
  if (casilla40 !== null) result.item40 = casilla40;

  const casilla41 = extractCasillaAmount(cleanText, 41);
  if (casilla41 !== null) result.item41 = casilla41;

  const casilla42 = extractCasillaAmount(cleanText, 42);
  if (casilla42 !== null) result.item42 = casilla42;

  const casilla43 = extractCasillaAmount(cleanText, 43);
  if (casilla43 !== null) result.item43 = casilla43;

  const casilla442 = extractCasillaAmount(cleanText, 442) || extractCasillaAmount(cleanText, 44);
  if (casilla442 !== null) result.item442 = casilla442;

  const casilla443 = extractCasillaAmount(cleanText, 443);
  if (casilla443 !== null) result.item443 = casilla443;

  const casilla47 = extractCasillaAmount(cleanText, 47);
  if (casilla47 !== null) result.item47 = casilla47;

  const casilla30 = extractCasillaAmount(cleanText, 30);
  if (casilla30 !== null) result.item30 = casilla30;

  const casilla31 = extractCasillaAmount(cleanText, 31);
  if (casilla31 !== null) result.item31 = casilla31;

  const casilla33 = extractCasillaAmount(cleanText, 33);
  if (casilla33 !== null) result.item33 = casilla33;

  const casilla34 = extractCasillaAmount(cleanText, 34);
  if (casilla34 !== null) result.item34 = casilla34;

  const casilla333 = extractCasillaAmount(cleanText, 333);
  if (casilla333 !== null) result.item333 = casilla333;

  const casilla343 = extractCasillaAmount(cleanText, 343);
  if (casilla343 !== null) result.item343 = casilla343;

  const casilla35 = extractCasillaAmount(cleanText, 35);
  if (casilla35 !== null) result.item35 = casilla35;

  const casilla70 = extractCasillaAmount(cleanText, 70);
  if (casilla70 !== null) result.item70 = casilla70;

  const casilla37 = extractCasillaAmount(cleanText, 37);
  if (casilla37 !== null) result.item37 = casilla37;

  const casilla71 = extractCasillaAmount(cleanText, 71);
  if (casilla71 !== null) result.item71 = casilla71;

  const casilla20 = extractCasillaAmount(cleanText, 20);
  if (casilla20 !== null) result.item20 = casilla20;

  const casilla38 = extractCasillaAmount(cleanText, 38);
  if (casilla38 !== null) result.item38 = casilla38;

  const casilla39 = extractCasillaAmount(cleanText, 39);
  if (casilla39 !== null) result.item39 = casilla39;

  const casilla53 = extractCasillaAmount(cleanText, 53);
  if (casilla53 !== null) result.item53 = casilla53;

  const casilla60 = extractCasillaAmount(cleanText, 60);
  if (casilla60 !== null) result.item60 = casilla60;

  const casilla54 = extractCasillaAmount(cleanText, 54);
  if (casilla54 !== null) result.item54 = casilla54;

  const casilla66 = extractCasillaAmount(cleanText, 66);
  if (casilla66 !== null) result.item66 = casilla66;

  const casilla67 = extractCasillaAmount(cleanText, 67);
  if (casilla67 !== null) result.item67 = casilla67;

  const casilla90 = extractCasillaAmount(cleanText, 90);
  if (casilla90 !== null) result.item90 = casilla90;

  // 7. Secondary Sliding Window Pattern Scanner for lines not matched by direct casilla
  for (let i = 0; i < lines.length; i++) {
    // Only check up to 3 lines window
    const windowLines = lines.slice(i, Math.min(i + 3, lines.length));
    const combinedWindow = windowLines.join(" ");

    // ITEM 40: Ventas No Gravadas / Sin derecho a crédito fiscal / Exentas / No sujetas
    if (result.item40 === undefined && (
      /(?:(?:1[\.\)\-]?\s*)?Ventas\s+(?:internas\s+)?no\s+gravadas|sin\s+derecho\s+a\s+cr[eé]dito|Ventas\s+no\s+sujetas|Ventas\s+exentas)/i.test(lines[i]) ||
      /\[\s*40\s*\]|\bitem\s*40\b|\bcasilla\s*40\b/i.test(lines[i])
    )) {
      const amounts = extractAmountsFromWindow(combinedWindow, [40, 1]);
      if (amounts.length > 0) result.item40 = amounts[amounts.length - 1];
    }

    // ITEM 41: Ventas de Exportación
    if (result.item41 === undefined && (/Ventas de Exportación|Exportación/i.test(lines[i]))) {
      const amounts = extractAmountsFromWindow(combinedWindow, [41]);
      if (amounts.length > 0) result.item41 = amounts[amounts.length - 1];
    }

    // ITEM 42 & 43: Ventas Internas Gravadas por Alícuota General (Base) y Débito Fiscal (16%)
    if ((result.item42 === undefined || result.item43 === undefined) && (/Ventas Internas Gravadas por Alícuota General|Ventas Gravadas por Alícuota General|Ventas Gravadas 16/i.test(lines[i]))) {
      const amounts = extractAmountsFromWindow(combinedWindow, [42, 43, 16]);
      if (amounts.length >= 2) {
        if (result.item42 === undefined) result.item42 = amounts[0];
        if (result.item43 === undefined) result.item43 = amounts[1];
      } else if (amounts.length === 1 && result.item42 === undefined) {
        result.item42 = amounts[0];
        if (result.item43 === undefined) result.item43 = Math.round(amounts[0] * 0.16 * 100) / 100;
      }
    }

    // ITEM 47: Total Débitos Fiscales
    if (result.item47 === undefined && (/Total Débito Fiscal|TOTAL DÉBITOS FISCALES|TOTAL DÉBITO\b/i.test(lines[i]))) {
      const amounts = extractAmountsFromWindow(combinedWindow, [47, 10]);
      if (amounts.length > 0) result.item47 = amounts[amounts.length - 1];
    }

    // ITEM 30: Compras No Sujetas / Exentas
    if (result.item30 === undefined && (/Compras No Sujetas|Compras Sin Derecho a Cr[eé]dito|Compras Exentas|Compras No Gravadas/i.test(lines[i]))) {
      const amounts = extractAmountsFromWindow(combinedWindow, [30, 11]);
      if (amounts.length > 0) result.item30 = amounts[amounts.length - 1];
    }

    // ITEM 33 & 34: Compras Internas Gravadas 16%
    if ((result.item33 === undefined || result.item34 === undefined) && (/Compras Internas Gravadas por Alícuota General|Compras Gravadas por Alícuota General|Compras Gravadas 16/i.test(lines[i]))) {
      const amounts = extractAmountsFromWindow(combinedWindow, [33, 34, 16, 14, 15]);
      if (amounts.length >= 2) {
        if (result.item33 === undefined) result.item33 = amounts[0];
        if (result.item34 === undefined) result.item34 = amounts[1];
      } else if (amounts.length === 1 && result.item33 === undefined) {
        result.item33 = amounts[0];
        if (result.item34 === undefined) result.item34 = Math.round(amounts[0] * 0.16 * 100) / 100;
      }
    }

    // ITEM 35: Total Compras
    if (result.item35 === undefined && (/Total Compras y Créditos del Período|Total Compras y Créditos|Total Compras\b/i.test(lines[i]))) {
      const amounts = extractAmountsFromWindow(combinedWindow, [35, 16]);
      if (amounts.length > 0) result.item35 = amounts[amounts.length - 1];
    }

    // ITEM 70 & 71: Total Créditos Deducibles
    if (result.item70 === undefined && (/Total Créditos Fiscales Totalmente Deducibles|Créditos Fiscales Totalmente Deducibles/i.test(lines[i]))) {
      const amounts = extractAmountsFromWindow(combinedWindow, [70, 17]);
      if (amounts.length > 0) result.item70 = amounts[amounts.length - 1];
    }
    if (result.item71 === undefined && (/Total Créditos Fiscales Deducibles|Total Créditos Deducibles/i.test(lines[i]))) {
      const amounts = extractAmountsFromWindow(combinedWindow, [71]);
      if (amounts.length > 0) result.item71 = amounts[amounts.length - 1];
    }

    // ITEM 53: Total Cuota Tributaria
    if (result.item53 === undefined && (/Total Cuota Tributaria|Cuota Tributaria del Período|Cuota Tributaria\b/i.test(lines[i]))) {
      const amounts = extractAmountsFromWindow(combinedWindow, [53, 21]);
      if (amounts.length > 0) result.item53 = amounts[amounts.length - 1];
    }

    // ITEM 90: TOTAL A PAGAR
    if (result.item90 === undefined && (/TOTAL A PAGAR|MONTO A PAGAR|Total a Pagar al SENIAT/i.test(lines[i]))) {
      const amounts = extractAmountsFromWindow(combinedWindow, [90, 25]);
      if (amounts.length > 0) result.item90 = amounts[amounts.length - 1];
    }
  }

  // 7. Consistency Auto-Resolution for Page 2 Totals
  if ((!result.item34 || result.item34 === 0) && result.item33 && result.item33 > 0) {
    result.item34 = Math.round(result.item33 * 0.16 * 100) / 100;
  }
  if ((!result.item35 || result.item35 === 0) && (result.item33 || result.item30 || result.item333)) {
    result.item35 = Math.round(((result.item30 || 0) + (result.item33 || 0) + (result.item333 || 0) + (result.item31 || 0)) * 100) / 100;
  }
  if ((!result.item71 || result.item71 === 0) && (result.item70 || result.item34)) {
    result.item71 = result.item70 || Math.round(((result.item34 || 0) + (result.item343 || 0)) * 100) / 100;
  }

  return result;
}

// Anti-contamination sanitizer: removes values that accidentally captured the item number or row index itself
function sanitizeItemCodeContamination(data: Partial<ExtractedIvaData>): void {
  const checkAndClean = (key: keyof ExtractedIvaData, excluded: number[]) => {
    const val = Number(data[key]);
    if (excluded.includes(val) || val > 500000000) {
      (data as any)[key] = 0;
    }
  };

  checkAndClean("item40", [40, 1]);
  checkAndClean("item41", [41, 2]);
  checkAndClean("item42", [42, 3]);
  checkAndClean("item43", [43, 3, 16]);
  checkAndClean("item442", [442, 44, 5]);
  checkAndClean("item443", [443, 5, 8]);
  checkAndClean("item47", [47, 10]);

  checkAndClean("item30", [30, 11]);
  checkAndClean("item31", [31, 12]);
  checkAndClean("item33", [33, 15]);
  checkAndClean("item34", [34, 15, 16]);
  checkAndClean("item333", [333, 17]);
  checkAndClean("item343", [343, 17, 8]);
  checkAndClean("item35", [35, 19, 18, 16]);
  checkAndClean("item70", [70, 20, 17]);
  checkAndClean("item37", [37, 21]);
  checkAndClean("item71", [71, 22]);

  checkAndClean("item20", [20, 23]);
  checkAndClean("item38", [38, 24]);
  checkAndClean("item39", [39, 25]);
  checkAndClean("item53", [53, 27, 21]);
  checkAndClean("item60", [60, 28]);

  checkAndClean("item54", [54, 29]);
  checkAndClean("item66", [66, 30]);
  checkAndClean("item67", [67, 31]);
  checkAndClean("item90", [90, 32, 25]);
}

// Master extraction function combining AI with Deterministic parser
export async function extractIvaFromDocument(
  fileData: string,
  mimeType: string,
  fileName: string,
  apiKey?: string,
  preferredPeriod?: { year?: number; month?: number; quincena?: 1 | 2 }
): Promise<ExtractedIvaData> {
  const isPdf = mimeType.toLowerCase().includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const fileBuffer = Buffer.from(fileData, "base64");

  let extractedPdfText = "";
  if (isPdf) {
    extractedPdfText = await extractTextFromPdf(fileBuffer);
  }

  // 1. Run Deterministic parsing across all pages
  const deterministicData = parseSeniatText(extractedPdfText, fileName);
  sanitizeItemCodeContamination(deterministicData);

  // 2. Run Gemini AI extraction
  let aiData: Partial<ExtractedIvaData> | null = null;
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (effectiveApiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: effectiveApiKey,
      });

      const filenameCues = detectPeriodFromFilename(fileName);

      const prompt = `Eres un contador público experto en legislación tributaria de Venezuela y en la Forma 30 de Declaración del IVA y Certificados Electrónicos del SENIAT.

DOCUMENTO A PROCESAR:
- Nombre de archivo: "${fileName}"
${filenameCues.quincena ? `- Quincena detectada por nombre de archivo: ${filenameCues.quincena === 1 ? '1ra Quincena (1A)' : '2da Quincena (2A)'}` : ""}
${filenameCues.month ? `- Mes detectado por nombre de archivo: Mes ${filenameCues.month}` : ""}
${filenameCues.year ? `- Año detectado por nombre de archivo: ${filenameCues.year}` : ""}

Debes examinar visual y textualmente TODO el documento PDF (Página 1 y Página 2):
- PÁGINA 1: Datos del contribuyente, Período impositivo y SECCIÓN II: DÉBITOS FISCALES (Ventas).
- PÁGINA 2: SECCIÓN III: CRÉDITOS FISCALES (Compras), SECCIÓN IV: AUTOLIQUIDACIÓN / DETERMINACIÓN (Excedentes y Cuota Tributaria), y SECCIÓN V: RETENCIONES DE IVA Y TOTAL A PAGAR.

${extractedPdfText ? `Texto base detectado:\n"""\n${extractedPdfText}\n"""\n` : ""}

REGLAS CRÍTICAS:
1. REGLA FUNDAMENTAL DE CLASIFICACIÓN DE PERÍODO (MES Y QUINCENA):
   - Prioridad 1: Toma en cuenta el nombre del archivo ("${fileName}") para identificar la quincena (1 o 2) y el mes:
     * Para 1ra Quincena (quincena: 1): rangos de fecha como "01 al 15", "01-02-2026 al 15-02-2026", fechas de corte como "15-02-2026", "01-02-2026", o patrones como "1A", "1a", "1ª", "1RA", "1ra", "1ERA", "PRIMERA", "01-15", "1-15", "Q1", "1Q", "_1", "FEB 1", "FEBRERO 1", "2026-02-1".
     * Para 2da Quincena (quincena: 2): rangos de fecha como "16 al 28", "16-02-2026 al 28-02-2026", fechas de corte como "28-02-2026", "16-02-2026", o patrones como "2A", "2a", "2ª", "2DA", "2da", "SEGUNDA", "16-28", "16-29", "16-30", "16-31", "Q2", "2Q", "_2", "FEB 2", "FEBRERO 2", "2026-02-2".
   - Prioridad 2: En el documento, lee el "PERÍODO IMPOSITIVO" (Desde: DD/MM/AAAA Hasta: DD/MM/AAAA) o "01/MM/AAAA AL 15/MM/AAAA". Si es del 01 al 15 -> quincena: 1. Si es del 16 al fin de mes (28/29/30/31) -> quincena: 2.
   - ¡PROHIBICIÓN ESTRICTA!: NUNCA uses la "Fecha de Presentación", "Fecha de Declaración", "Fecha de Emisión" o "Fecha de Pago" para determinar la quincena. En Venezuela, la 1ra Quincena de Febrero (01/02 al 15/02) se declara y paga entre el 16 y el 25 de Febrero (ej. 18/02/2026). Aunque la fecha de presentación diga "18/02/2026" o "20/02/2026", la declaración corresponde OBLIGATORIAMENTE a la 1ra Quincena de Febrero (month: 2, quincena: 1).
   - NUNCA clasifiques la 1ra quincena de febrero como quincena 2. Si el archivo o los días indican 1ra quincena (1A), quincena DEBE SER 1.
2. Lee los montos EXACTOS en Bolívares (VES) que están declarados en las casillas de la planilla.
3. Si una casilla está en blanco o en 0,00 coloca 0.
4. NUNCA inventes números. NUNCA tomes fechas (ej. 15, 28, 31, 2026), días, porcentajes ni números de renglón como montos monetarios.
5. ATENCIÓN PRIORITARIA A VENTAS NO GRAVADAS (ITEM 40 / RENGLÓN 1):
   - El renglón "1. Ventas no gravadas y/o sin derecho a crédito fiscal [40]" (o "Ventas no gravadas" / exentas) corresponde a la casilla [40].
   - Si la planilla tiene un monto declarado en el renglón 1 / casilla 40 (por ejemplo 2.513.414,61 o cualquier otro valor mayor a 0), DEBES EXTRAERLO OBLIGATORIAMENTE en el campo "item40".
   - NUNCA pongas "item40": 0 si en la planilla hay un monto en esa casilla.
6. ATENCIÓN ESPECIAL A NÚMEROS DE RENGLÓN DE LA FORMA 30:
   - El renglón "10. TOTAL DÉBITO FISCAL [47]" tiene el número 10 a la izquierda como índice de fila. NUNCA asignes 10 a item47. Si item43 (débito 16%) es 0 e item443 (débito 8%) es 0, item47 ES ESTRICTAMENTE 0.
   - El renglón "15. Compras internas gravadas por alícuota general [33]" tiene el número 15 a la izquierda como índice de fila. NUNCA asignes 15 a item33. Si no hay compras gravadas declaradas, item33 es 0.
   - El renglón "11. Compras no sujetas [30]" tiene el número 11 a la izquierda como índice de fila. NUNCA asignes 11 a item30.

Devuelve un JSON estrictamente válido:
{
  "razonSocial": string,
  "rif": string,
  "fiscalYear": number (ej. 2026),
  "month": number (1 al 12),
  "quincena": 1 o 2,
  "fechaDesde": "DD/MM/AAAA",
  "fechaHasta": "DD/MM/AAAA",
  "numeroDeclaracion": string,
  "numeroCertificado": string,
  "fechaDeclaracion": "DD/MM/AAAA",

  "item40": number (Ventas No Gravadas / Exentas),
  "item41": number (Ventas Exportación),
  "item42": number (Ventas Gravadas 16% - Base Imponible),
  "item43": number (Débito Fiscal 16%),
  "item442": number (Ventas Gravadas 8% - Base Imponible),
  "item443": number (Débito Fiscal 8%),
  "ingresoIntereses": number,
  "item47": number (Total Débito Fiscal),

  "item30": number (Compras No Sujetas / Exentas),
  "item31": number (Importaciones Exentas),
  "item33": number (Compras Gravadas 16% - Base Imponible),
  "item34": number (Crédito Fiscal 16%),
  "item333": number (Compras Gravadas 8% - Base Imponible),
  "item343": number (Crédito Fiscal 8%),
  "item35": number (Total Compras y Créditos del Período / Base Total),
  "item70": number (Créditos Fiscales Totalmente Deducibles),
  "item37": number (Créditos por Prorrateo),
  "item71": number (Total Créditos Fiscales Deducibles),

  "item20": number (Excedente Crédito Fiscal Período Anterior),
  "item38": number (Ajustes Créditos Fiscales Anteriores),
  "item39": number (Total Créditos Fiscales del Período),
  "item53": number (Total Cuota Tributaria),
  "item60": number (Excedente Crédito Fiscal Período Siguiente),

  "item54": number (Retenciones Acumuladas Períodos Anteriores),
  "item66": number (Retenciones de IVA del Período),
  "item67": number (Saldo de Retenciones no aplicadas),
  "item90": number (TOTAL A PAGAR)
}`;

      const parts: any[] = [];
      if (fileData) {
        parts.push({
          inlineData: {
            data: fileData,
            mimeType: mimeType || "application/pdf",
          },
        });
      }
      parts.push({ text: prompt });

      // Call AI with fast flash model
      const modelsToTry = [
        "gemini-3.7-flash",
        "gemini-flash-latest",
        "gemini-3.1-flash-lite",
        "gemini-3.1-pro-preview",
      ];
      let rawResponseText = "";
      let aiExtractionSuccess = false;

      for (const modelName of modelsToTry) {
        if (aiExtractionSuccess) break;
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts,
              },
            ],
            config: {
              responseMimeType: "application/json",
            },
          });

          rawResponseText = response.text || "";
          if (rawResponseText.trim().length > 0) {
            aiExtractionSuccess = true;
            break;
          }
        } catch (err: any) {
          // Quickly try next model without long blocking delays
          continue;
        }
      }

      if (rawResponseText) {
        rawResponseText = rawResponseText.trim();
        if (rawResponseText.startsWith("```json")) {
          rawResponseText = rawResponseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (rawResponseText.startsWith("```")) {
          rawResponseText = rawResponseText.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }

        try {
          aiData = JSON.parse(rawResponseText);
          if (aiData) {
            sanitizeItemCodeContamination(aiData);
          }
        } catch (jsonErr) {
          console.warn("Could not parse JSON from AI response, using deterministic parser:", jsonErr);
        }
      }
    } catch (aiErr) {
      console.warn("AI extraction encountered an issue, seamlessly proceeding with deterministic extraction:", aiErr);
    }
  }

  // 3. Merge AI and Deterministic results: AI data takes absolute precedence
  const primary = aiData || null;
  const secondary = deterministicData || {};

  const cleanNum = (valA: any, valB: any, excludedCodes: number[] = []): number => {
    const numA = valA !== undefined && valA !== null
      ? (typeof valA === "number" ? valA : parseVenAmount(valA))
      : 0;
    const numB = valB !== undefined && valB !== null
      ? (typeof valB === "number" ? valB : parseVenAmount(valB))
      : 0;

    const safeA = excludedCodes.includes(numA) || isNaN(numA) ? 0 : numA;
    const safeB = excludedCodes.includes(numB) || isNaN(numB) ? 0 : numB;

    // 1. If both are positive, prefer AI (or if equal)
    if (safeA > 0 && safeB > 0) {
      return safeA;
    }

    // 2. If one is > 0 and the other is 0, ALWAYS preserve the positive monetary value!
    // Never let an AI 0 wipe out a real number extracted deterministically from the document text,
    // and never let a deterministic 0 wipe out an AI extracted number!
    if (safeA > 0) return safeA;
    if (safeB > 0) return safeB;

    return 0;
  };

  const cleanStr = (strA: any, strB: any, fallback = ""): string => {
    if (strA && typeof strA === "string" && strA.trim().length > 0 && strA.trim() !== "N/A") return strA.trim();
    if (strB && typeof strB === "string" && strB.trim().length > 0 && strB.trim() !== "N/A") return strB.trim();
    return fallback;
  };

  const primaryObj = primary || {};
  const filenameCues = detectPeriodFromFilename(fileName);

  // Check official tax period dates (fechaDesde / fechaHasta) from document
  let dateDocQuincena: 1 | 2 | null = null;
  const testDesde = cleanStr(primaryObj.fechaDesde, secondary.fechaDesde, "");
  const testHasta = cleanStr(primaryObj.fechaHasta, secondary.fechaHasta, "");
  if (testDesde) {
    const dMatch = testDesde.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (dMatch) {
      const d = parseInt(dMatch[1], 10);
      dateDocQuincena = d > 15 ? 2 : 1;
    }
  }
  if (!dateDocQuincena && testHasta) {
    const hMatch = testHasta.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (hMatch) {
      const d = parseInt(hMatch[1], 10);
      dateDocQuincena = d <= 15 ? 1 : 2;
    }
  }

  // Resolution hierarchy: Filename cues (REGLA 1: Leer nombre de archivo) > User Preferred Override > Official Tax Period Dates > AI extracted > Deterministic text parser > Defaults
  const resolvedYear = filenameCues.year || preferredPeriod?.year || primaryObj.fiscalYear || secondary.fiscalYear || new Date().getFullYear();
  const resolvedMonth = filenameCues.month || preferredPeriod?.month || primaryObj.month || secondary.month || 1;
  const resolvedQuincena: 1 | 2 = (filenameCues.quincena === 1 || filenameCues.quincena === 2)
    ? filenameCues.quincena
    : (preferredPeriod?.quincena === 1 || preferredPeriod?.quincena === 2)
    ? preferredPeriod.quincena
    : (dateDocQuincena === 1 || dateDocQuincena === 2)
    ? dateDocQuincena
    : (primaryObj.quincena === 1 || primaryObj.quincena === 2)
    ? primaryObj.quincena
    : (secondary.quincena === 1 || secondary.quincena === 2)
    ? secondary.quincena
    : 1;

  // Build merged final structure
  const finalResult: ExtractedIvaData = {
    razonSocial: cleanStr(primaryObj.razonSocial, secondary.razonSocial, "CONTRIBUYENTE"),
    rif: cleanStr(primaryObj.rif, secondary.rif, ""),
    fiscalYear: resolvedYear,
    month: resolvedMonth,
    quincena: resolvedQuincena,
    fechaDesde: cleanStr(primaryObj.fechaDesde, secondary.fechaDesde, ""),
    fechaHasta: cleanStr(primaryObj.fechaHasta, secondary.fechaHasta, ""),
    numeroDeclaracion: cleanStr(primaryObj.numeroDeclaracion, secondary.numeroDeclaracion, ""),
    numeroCertificado: cleanStr(primaryObj.numeroCertificado, secondary.numeroCertificado, ""),
    fechaDeclaracion: cleanStr(primaryObj.fechaDeclaracion, secondary.fechaDeclaracion, ""),
    fileName,

    // Débitos y Ventas
    item40: cleanNum(primaryObj.item40, secondary.item40, [40, 1]),
    item41: cleanNum(primaryObj.item41, secondary.item41, [41, 2]),
    item42: cleanNum(primaryObj.item42, secondary.item42, [42, 3]),
    item43: cleanNum(primaryObj.item43, secondary.item43, [43, 3, 16]),
    item442: cleanNum(primaryObj.item442, secondary.item442, [442, 44, 5]),
    item443: cleanNum(primaryObj.item443, secondary.item443, [443, 5, 8]),
    ingresoIntereses: cleanNum(primaryObj.ingresoIntereses, secondary.ingresoIntereses, []),
    item47: cleanNum(primaryObj.item47, secondary.item47, [47, 10]),

    // Créditos y Compras
    item30: cleanNum(primaryObj.item30, secondary.item30, [30, 11]),
    item31: cleanNum(primaryObj.item31, secondary.item31, [31, 12]),
    item33: cleanNum(primaryObj.item33, secondary.item33, [33, 15]),
    item34: cleanNum(primaryObj.item34, secondary.item34, [34, 15, 16]),
    item333: cleanNum(primaryObj.item333, secondary.item333, [333, 17]),
    item343: cleanNum(primaryObj.item343, secondary.item343, [343, 17, 8]),
    item35: cleanNum(primaryObj.item35, secondary.item35, [35, 19, 18, 16]),
    item70: cleanNum(primaryObj.item70, secondary.item70, [70, 20, 17]),
    item37: cleanNum(primaryObj.item37, secondary.item37, [37, 21]),
    item71: cleanNum(primaryObj.item71, secondary.item71, [71, 22]),

    // Determinación y Excedentes
    item20: cleanNum(primaryObj.item20, secondary.item20, [20, 23]),
    item38: cleanNum(primaryObj.item38, secondary.item38, [38, 24]),
    item39: cleanNum(primaryObj.item39, secondary.item39, [39, 25]),
    item53: cleanNum(primaryObj.item53, secondary.item53, [53, 27, 21]),
    item60: cleanNum(primaryObj.item60, secondary.item60, [60, 28]),

    // Retenciones y Pago
    item54: cleanNum(primaryObj.item54, secondary.item54, [54, 29]),
    item66: cleanNum(primaryObj.item66, secondary.item66, [66, 30]),
    item67: cleanNum(primaryObj.item67, secondary.item67, [67, 31]),
    item90: cleanNum(primaryObj.item90, secondary.item90, [90, 32, 25]),

    extractedAt: new Date().toISOString(),
    sourceMethod: primary && deterministicData ? "hybrid" : primary ? "ai" : "deterministic",
  };

  // Strict Accounting & Mathematical Reconciliation (Forma 30 SENIAT)
  // 1. Débito Fiscal (item47) MUST strictly match sum of items 43 + 443. Never 10 Bs artifact!
  if (finalResult.item42 > 0 && finalResult.item43 === 0) {
    finalResult.item43 = Math.round(finalResult.item42 * 0.16 * 100) / 100;
  }
  if (finalResult.item442 > 0 && finalResult.item443 === 0) {
    finalResult.item443 = Math.round(finalResult.item442 * 0.08 * 100) / 100;
  }

  if (finalResult.item43 > 0 || finalResult.item443 > 0) {
    finalResult.item47 = Math.round((finalResult.item43 + finalResult.item443) * 100) / 100;
  } else {
    // If there are no calculated/declared debits from 16% or 8%, Débito Fiscal is strictly 0.00
    finalResult.item47 = 0;
  }

  // 2. Compras y Créditos Fiscales (item33, item34, item35)
  // Eliminate 15 (row index), 33 (item code), 16 (tax rate), 14 (row index) collisions
  if (finalResult.item33 === 15 || finalResult.item33 === 33 || finalResult.item33 === 16 || finalResult.item33 === 14) {
    finalResult.item33 = 0;
    finalResult.item34 = 0;
  }
  if (finalResult.item34 === 15 || finalResult.item34 === 34 || finalResult.item34 === 16) {
    finalResult.item34 = 0;
  }
  if (finalResult.item30 === 11 || finalResult.item30 === 30 || finalResult.item30 === 10) {
    finalResult.item30 = 0;
  }

  if (finalResult.item33 > 0 && finalResult.item34 === 0) {
    finalResult.item34 = Math.round(finalResult.item33 * 0.16 * 100) / 100;
  }
  if (finalResult.item333 > 0 && finalResult.item343 === 0) {
    finalResult.item343 = Math.round(finalResult.item333 * 0.08 * 100) / 100;
  }

  // 3. Total Compras (Item 35 is ALWAYS mathematically equal to sum of bases)
  finalResult.item35 = Math.round(((finalResult.item30 || 0) + (finalResult.item33 || 0) + (finalResult.item333 || 0) + (finalResult.item31 || 0)) * 100) / 100;

  // 4. Créditos Deducibles
  if (finalResult.item70 === 20 || finalResult.item70 === 70 || finalResult.item70 === 17) {
    finalResult.item70 = 0;
  }
  const calcCredTotal = Math.round(((finalResult.item34 || 0) + (finalResult.item343 || 0)) * 100) / 100;
  finalResult.item70 = finalResult.item70 > 0 ? finalResult.item70 : calcCredTotal;

  if (finalResult.item71 === 22 || finalResult.item71 === 71 || finalResult.item71 === 0) {
    finalResult.item71 = Math.round((finalResult.item70 + (finalResult.item37 || 0)) * 100) / 100;
  }

  // 5. Total Créditos del Período (Item 39 = Item 71 + Item 20 + Item 38)
  finalResult.item39 = Math.round(((finalResult.item71 || 0) + (finalResult.item20 || 0) + (finalResult.item38 || 0)) * 100) / 100;

  // 6. Cuota Tributaria (Item 53)
  if (finalResult.item47 === 0 || finalResult.item47 <= finalResult.item39) {
    finalResult.item53 = 0;
  } else {
    finalResult.item53 = Math.round((finalResult.item47 - finalResult.item39) * 100) / 100;
  }

  // 7. Excedente Crédito Fiscal (Item 60)
  if (finalResult.item39 > finalResult.item47) {
    finalResult.item60 = Math.round((finalResult.item39 - finalResult.item47) * 100) / 100;
  }

  // 8. Total a Pagar (Item 90)
  if (finalResult.item53 === 0) {
    finalResult.item90 = 0;
  } else {
    const deductRet = (finalResult.item54 || 0) + (finalResult.item66 || 0);
    finalResult.item90 = Math.max(0, Math.round((finalResult.item53 - deductRet) * 100) / 100);
  }

  return finalResult;
}
