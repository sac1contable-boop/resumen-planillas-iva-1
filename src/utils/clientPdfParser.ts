import * as pdfjsLib from 'pdfjs-dist';
import { ExtractionResult, IvaQuincenaData } from '../types';
import { detectPeriodFromFilename } from './taxCalculations';

// Set up pdfjs worker using self-hosted bundle for Netlify & static hosts
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (e) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
    } catch (err) {
      console.warn('Could not set pdfjs workerSrc:', err);
    }
  }
}

// Convert Venezuelan number format ("147.909,07" or "147,909.07" or "147909.07" or "1.326.324,15") to float
export function parseVenAmount(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str) return 0;

  const isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));
  str = str.replace(/[Bs\.\$VES\s\(\)]/gi, '');

  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  const rounded = Math.round(num * 100) / 100;
  return isNegative ? -Math.abs(rounded) : rounded;
}

// Targeted Casilla amount extractor for SENIAT forms
export function extractCasillaAmount(cleanText: string, casillaCode: number): number | null {
  const patterns = [
    new RegExp(`\\[\\s*${casillaCode}\\s*\\][\\s:;\\|\\.\\-_]*(?:Bs\\.?[\\s:;\\|\\.\\-_]*)?([\\d]{1,3}(?:\\.[\\d]{3})*,\\d{2}|[\\d]{1,3}(?:,\\d{3})*\\.\\d{2}|\\d+[,\\.]\\d{2}|0\\b)(?![\\.\\)\\-]\\s*[a-zA-Z])`, 'i'),
    new RegExp(`\\(\\s*${casillaCode}\\s*\\)[\\s:;\\|\\.\\-_]*(?:Bs\\.?[\\s:;\\|\\.\\-_]*)?([\\d]{1,3}(?:\\.[\\d]{3})*,\\d{2}|[\\d]{1,3}(?:,\\d{3})*\\.\\d{2}|\\d+[,\\.]\\d{2}|0\\b)(?![\\.\\)\\-]\\s*[a-zA-Z])`, 'i'),
    new RegExp(`(?:casilla|rengl[oó]n|c[oó]digo|item)\\s*${casillaCode}\\b[\\s:;\\|\\.\\-_]*(?:Bs\\.?[\\s:;\\|\\.\\-_]*)?([\\d]{1,3}(?:\\.[\\d]{3})*,\\d{2}|[\\d]{1,3}(?:,\\d{3})*\\.\\d{2}|\\d+[,\\.]\\d{2}|0\\b)(?![\\.\\)\\-]\\s*[a-zA-Z])`, 'i'),
    new RegExp(`(?:^|[\\r\\n])[\\s\\|]*${casillaCode}[\\s:;\\|\\.\\-_]+(?:Bs\\.?[\\s:;\\|\\.\\-_]*)?([\\d]{1,3}(?:\\.[\\d]{3})*,\\d{2}|[\\d]{1,3}(?:,\\d{3})*\\.\\d{2}|\\d+[,\\.]\\d{2}|0\\b)(?![\\.\\)\\-]\\s*[a-zA-Z])`, 'im'),
    new RegExp(`\\[\\s*${casillaCode}\\s*\\][\\s\\S]{0,60}?([\\d]{1,3}(?:\\.[\\d]{3})*,\\d{2}|[\\d]{1,3}(?:,\\d{3})*\\.\\d{2}|\\d+[,\\.]\\d{2})(?![\\.\\)\\-]\\s*[a-zA-Z])`, 'i'),
    new RegExp(`\\(\\s*${casillaCode}\\s*\\)[\\s\\S]{0,60}?([\\d]{1,3}(?:\\.[\\d]{3})*,\\d{2}|[\\d]{1,3}(?:,\\d{3})*\\.\\d{2}|\\d+[,\\.]\\d{2})(?![\\.\\)\\-]\\s*[a-zA-Z])`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const parsed = parseVenAmount(match[1]);
      if (parsed === casillaCode) continue;
      const isKnownRowIndex = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31, 32].includes(parsed);
      if (isKnownRowIndex && !match[1].includes(',') && !match[1].includes('.')) {
        continue;
      }
      if (casillaCode === 47 && parsed === 10) continue;
      if (casillaCode === 33 && (parsed === 15 || parsed === 16 || parsed === 14)) continue;
      if (casillaCode === 30 && (parsed === 11 || parsed === 10)) continue;
      if (casillaCode === 35 && (parsed === 18 || parsed === 15 || parsed === 19)) continue;
      if (casillaCode === 70 && (parsed === 20 || parsed === 17)) continue;
      if (casillaCode === 71 && (parsed === 22 || parsed === 21)) continue;
      return parsed;
    }
  }
  return null;
}

// Extract amounts from sliding text window
function extractAmountsFromWindow(text: string, excludedNumbers: number[] = []): number[] {
  let sanitized = text.replace(/(?:^|\n|\r|\s)\d{1,2}\.\s+/g, ' ');
  sanitized = sanitized.replace(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g, ' ');
  sanitized = sanitized.replace(/\b(?:del|desde)?\s*\d{1,2}\s*(?:al|a|hasta|-)\s*\d{1,2}\b/gi, ' ');
  sanitized = sanitized.replace(/\b\d+(?:[\.,]\d+)?\s*%/g, ' ');
  sanitized = sanitized.replace(/\b20[2-3][0-9]\b/g, ' ');
  sanitized = sanitized.replace(/\b([0-9]{1,2})\b(?!\s*,\s*\d{2}|\s*\.\s*\d{2})/g, ' ');

  const tokenRegex = /(?:\b\d{1,3}(?:\.\d{3})+(?:,\d{2})\b|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})\b|\b\d+[,\.]\d{2}\b|\b\d{4,}\b)/g;
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
    if (!m.includes(',') && !m.includes('.') && (commonItemCodes.includes(parsed) || parsed < 100)) continue;
    if (parsed === 10 || parsed === 15) {
      if (!m.includes(',00') && !m.includes('.00')) continue;
    }
    amounts.push(parsed);
  }

  return amounts;
}

// Extract raw text from PDF directly in browser
export async function extractTextFromPdfInBrowser(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: true,
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += `\n--- Page ${pageNum} ---\n` + pageText;
    }

    if (fullText.trim().length > 20) {
      return fullText;
    }
  } catch (err) {
    console.warn('pdfjs extraction error, attempting raw text fallback:', err);
  }

  // Fallback: simple text decoder looking for text blocks in the PDF buffer
  try {
    const textDecoder = new TextDecoder('latin1');
    const raw = textDecoder.decode(arrayBuffer);
    
    // Look for text streams
    const streamMatches = raw.match(/stream[\r\n]+([\s\S]*?)endstream/g) || [];
    let fallbackText = '';
    for (const s of streamMatches) {
      // Find strings inside parentheses (Text)
      const parenTexts = s.match(/\(([^()]+)\)/g);
      if (parenTexts) {
        fallbackText += ' ' + parenTexts.map((p) => p.slice(1, -1)).join(' ');
      }
    }
    if (fallbackText.length > 50) {
      return fallbackText;
    }
    return raw;
  } catch (err2) {
    console.error('All PDF text extraction methods failed:', err2);
    return '';
  }
}

// SENIAT Forma 30 deterministic parser (Client-Side)
export function parseSeniatForma30(
  rawText: string,
  fileName: string,
  preferredPeriod?: { year?: number; month?: number; quincena?: 1 | 2 }
): NonNullable<ExtractionResult['data']> {
  const cleanText = rawText.replace(/\r\n/g, '\n');
  const lines = cleanText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // 1. RIF Extraction
  let rif = 'J-00000000-0';
  const rifMatch = cleanText.match(/(?:RIF|R\.I\.F\.?|NÚMERO DE RIF|NUMERO DE RIF)[\s:]*([VJEGP]-?\d{7,9}-?\d?)/i) ||
                   cleanText.match(/\b([VJEGP]-?\d{7,9}-?\d?)\b/i);
  if (rifMatch) {
    let r = rifMatch[1].toUpperCase().replace(/\s+/g, '');
    if (!r.includes('-') && r.length >= 8) {
      r = `${r[0]}-${r.slice(1)}`;
    }
    rif = r;
  }

  // 2. Razón Social Extraction
  let razonSocial = '';
  const razonSocialMatch = cleanText.match(/(?:Razón Social|Nombre o Razón Social|Contribuyente|NOMBRE O RAZÓN SOCIAL|NOMBRE O RAZON SOCIAL)[\s:]+([^\n\r]+)/i) ||
                           cleanText.match(/(?:APELLIDOS Y NOMBRES O RAZÓN SOCIAL)[\s:]+([^\n\r]+)/i);
  if (razonSocialMatch) {
    const rawName = razonSocialMatch[1].trim().replace(/^[:\-\s]+/, '').split(/\s{3,}|\t/)[0];
    if (rawName && rawName.length > 2) {
      razonSocial = rawName.toUpperCase();
    }
  }

  // 3. Fechas
  let fechaDeclaracion = '';
  let fechaDesde = '';
  let fechaHasta = '';

  const fechaDeclMatch = cleanText.match(/(?:Fecha de Declaración|FECHA DE DECLARACION|Fecha de Presentación|FECHA DE PRESENTACION|FECHA PRESENTACION|FECHA DECLARACIÓN)[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (fechaDeclMatch) fechaDeclaracion = fechaDeclMatch[1];

  const periodoMatch = cleanText.match(/(?:PERIODO|PERÍODO)\s*(?:IMPOSITIVO)?[\s\S]{0,120}?DESDE[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})[\s\S]{0,60}?HASTA[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  const rangeMatch = cleanText.match(/\b(0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9])\s*(?:AL|A|HASTA|-)\s*(0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9])\b/i);

  if (periodoMatch) {
    fechaDesde = periodoMatch[1];
    fechaHasta = periodoMatch[2];
  } else if (rangeMatch) {
    fechaDesde = `${rangeMatch[1]}/${rangeMatch[2]}/${rangeMatch[3]}`;
    fechaHasta = `${rangeMatch[4]}/${rangeMatch[5]}/${rangeMatch[6]}`;
  }

  // 4. Period Detection strictly according to filename cues first (AGENTS.md & GEMINI.md)
  const filenameCues = detectPeriodFromFilename(fileName);

  let detectedYear = preferredPeriod?.year || filenameCues.year || new Date().getFullYear();
  let detectedMonth = preferredPeriod?.month || filenameCues.month || 1;
  let detectedQuincena: 1 | 2 = preferredPeriod?.quincena || filenameCues.quincena || 1;

  // Cross-verify with Desde/Hasta only if filename had no month/quincena
  if (!filenameCues.month && fechaDesde) {
    const parts = fechaDesde.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (y >= 2020 && !filenameCues.year) detectedYear = y;
      if (m >= 1 && m <= 12 && !filenameCues.month) detectedMonth = m;
      if (filenameCues.quincena === undefined) detectedQuincena = day > 15 ? 2 : 1;
    }
  }

  // 5. Declaración & Certificado numbers
  let numeroDeclaracion = '';
  let numeroCertificado = '';
  const declNumMatch = cleanText.match(/(?:Número de Declaración|NUMERO DE DECLARACION|N° de Declaración|Nro\. Declaración|Declaración No\.)[\s:]*([A-Z0-9\-]+)/i);
  const certNumMatch = cleanText.match(/(?:Número de Certificado|NUMERO DE CERTIFICADO|N° Certificado|Certificado Electrónico No\.|Certificado No\.)[\s:]*([A-Z0-9\-]+)/i);
  if (declNumMatch) numeroDeclaracion = declNumMatch[1];
  if (certNumMatch) numeroCertificado = certNumMatch[1];

  // 6. Direct Casilla Extraction
  const item40 = extractCasillaAmount(cleanText, 40) ?? 0;
  const item41 = extractCasillaAmount(cleanText, 41) ?? 0;
  let item42 = extractCasillaAmount(cleanText, 42) ?? 0;
  let item43 = extractCasillaAmount(cleanText, 43) ?? 0;
  const item442 = extractCasillaAmount(cleanText, 442) ?? extractCasillaAmount(cleanText, 44) ?? 0;
  const item443 = extractCasillaAmount(cleanText, 443) ?? 0;
  let item47 = extractCasillaAmount(cleanText, 47) ?? 0;

  const item30 = extractCasillaAmount(cleanText, 30) ?? 0;
  const item31 = extractCasillaAmount(cleanText, 31) ?? 0;
  let item33 = extractCasillaAmount(cleanText, 33) ?? 0;
  let item34 = extractCasillaAmount(cleanText, 34) ?? 0;
  const item333 = extractCasillaAmount(cleanText, 333) ?? 0;
  const item343 = extractCasillaAmount(cleanText, 343) ?? 0;
  let item35 = extractCasillaAmount(cleanText, 35) ?? 0;
  const item70 = extractCasillaAmount(cleanText, 70) ?? 0;
  const item37 = extractCasillaAmount(cleanText, 37) ?? 0;
  let item71 = extractCasillaAmount(cleanText, 71) ?? 0;

  const item20 = extractCasillaAmount(cleanText, 20) ?? 0;
  const item38 = extractCasillaAmount(cleanText, 38) ?? 0;
  const item39 = extractCasillaAmount(cleanText, 39) ?? 0;
  let item53 = extractCasillaAmount(cleanText, 53) ?? 0;
  let item60 = extractCasillaAmount(cleanText, 60) ?? 0;

  const item54 = extractCasillaAmount(cleanText, 54) ?? 0;
  const item66 = extractCasillaAmount(cleanText, 66) ?? 0;
  const item67 = extractCasillaAmount(cleanText, 67) ?? 0;
  const item90 = extractCasillaAmount(cleanText, 90) ?? 0;

  // Window scanner fallbacks for critical totals if 0
  if (item42 === 0 || item43 === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (/Ventas Gravadas|Alícuota General/i.test(lines[i])) {
        const window = lines.slice(i, i + 3).join(' ');
        const ams = extractAmountsFromWindow(window, [42, 43, 16]);
        if (ams.length >= 2) {
          if (item42 === 0) item42 = ams[0];
          if (item43 === 0) item43 = ams[1];
        } else if (ams.length === 1 && item42 === 0) {
          item42 = ams[0];
          if (item43 === 0) item43 = Math.round(ams[0] * 0.16 * 100) / 100;
        }
        break;
      }
    }
  }

  if (item33 === 0 || item34 === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (/Compras Gravadas|Alícuota General/i.test(lines[i])) {
        const window = lines.slice(i, i + 3).join(' ');
        const ams = extractAmountsFromWindow(window, [33, 34, 16]);
        if (ams.length >= 2) {
          if (item33 === 0) item33 = ams[0];
          if (item34 === 0) item34 = ams[1];
        } else if (ams.length === 1 && item33 === 0) {
          item33 = ams[0];
          if (item34 === 0) item34 = Math.round(ams[0] * 0.16 * 100) / 100;
        }
        break;
      }
    }
  }

  // Auto-calculated cross totals
  if (item47 === 0 && (item43 > 0 || item443 > 0)) {
    item47 = Math.round((item43 + item443) * 100) / 100;
  }
  if (item34 === 0 && item33 > 0) {
    item34 = Math.round(item33 * 0.16 * 100) / 100;
  }
  if (item35 === 0 && (item30 > 0 || item33 > 0 || item333 > 0)) {
    item35 = Math.round((item30 + item33 + item333 + item31) * 100) / 100;
  }
  if (item71 === 0) {
    item71 = item70 > 0 ? item70 : Math.round((item34 + item343) * 100) / 100;
  }

  // Calculate Cuota Tributaria (item 53) or Excedente Siguiente (item 60)
  const totalCreditos = Math.round((item71 + item20 + item38) * 100) / 100;
  if (item53 === 0 && item60 === 0 && (item47 > 0 || totalCreditos > 0)) {
    if (item47 > totalCreditos) {
      item53 = Math.round((item47 - totalCreditos) * 100) / 100;
    } else {
      item60 = Math.round((totalCreditos - item47) * 100) / 100;
    }
  }

  return {
    razonSocial: razonSocial || 'EMPRESA CONTRIBUYENTE',
    rif: rif || 'J-00000000-0',
    fiscalYear: detectedYear,
    month: detectedMonth,
    quincena: detectedQuincena,
    fechaDesde,
    fechaHasta,
    numeroDeclaracion,
    numeroCertificado,
    fechaDeclaracion,
    fileName,
    item40,
    item41,
    item42,
    item43,
    item442,
    item443,
    ingresoIntereses: 0,
    item47,
    item30,
    item31,
    item33,
    item34,
    item333,
    item343,
    item35,
    item70,
    item37,
    item71,
    item20,
    item38,
    item39: totalCreditos,
    item53,
    item60,
    item54,
    item66,
    item67,
    item90,
    extractedAt: new Date().toISOString(),
  };
}

// Main Client-Side PDF Extraction Workflow
export async function extractIvaFromPdfClient(
  file: File,
  preferredPeriod?: { year?: number; month?: number; quincena?: 1 | 2 }
): Promise<NonNullable<ExtractionResult['data']>> {
  const text = await extractTextFromPdfInBrowser(file);
  return parseSeniatForma30(text, file.name, preferredPeriod);
}
