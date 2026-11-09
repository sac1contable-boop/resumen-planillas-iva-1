import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ExtractionResult, IvaQuincenaData } from '../types';
import { detectPeriodFromFilename } from './taxCalculations';

// Set up pdfjs worker using Vite URL bundle for 100% reliable execution in browser
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch (e) {
    console.warn('Could not set pdfjs workerSrc:', e);
  }
}

/**
 * Strips all non-numeric surrounding characters (currency symbols, brackets, labels, text)
 * and isolates pure numeric strings like "2.479.904,00", "2.479.904", "451.360,44", or "0,00".
 */
export function cleanNumericToken(rawToken: string): string {
  if (!rawToken) return '';
  let token = rawToken.trim();

  // Remove currency words/symbols, brackets, quotes, and colon labels
  token = token.replace(/(?:Bs\.?|VES|\$|Bs|Bol[ií]vares|Bolivares|VES|\[|\]|\(|\)|:|=|;)+/gi, ' ').trim();

  // Isolate the pure numeric portion matching Venezuelan or standard formats
  const match = token.match(/[-+]?\b\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\b|[-+]?\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b|[-+]?\b\d+[,\.]\d{1,2}\b|[-+]?\b\d+\b/);
  return match ? match[0] : '';
}

/**
 * Converts Venezuelan number format ("2.479.904,00", "2.479.904", "147.909,07", "451.360") or standard floats to a pure JavaScript number.
 */
export function parseVenAmount(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str) return 0;

  const isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));

  // First pass: extract pure numeric token discarding any text around it
  const cleanStr = cleanNumericToken(str);
  if (!cleanStr) return 0;

  let numStr = cleanStr;

  if (numStr.includes(',') && numStr.includes('.')) {
    if (numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
      // Venezuelan standard: 1.234.567,89 -> 1234567.89
      numStr = numStr.replace(/\./g, '').replace(',', '.');
    } else {
      // US standard: 1,234,567.89 -> 1234567.89
      numStr = numStr.replace(/,/g, '');
    }
  } else if (numStr.includes(',')) {
    const commaCount = (numStr.match(/,/g) || []).length;
    if (commaCount > 1) {
      numStr = numStr.replace(/,/g, '');
    } else {
      // Single comma as decimal separator: 1234,56 -> 1234.56
      numStr = numStr.replace(',', '.');
    }
  } else if (numStr.includes('.')) {
    const dotCount = (numStr.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Multiple thousand dots without decimals: 2.479.904 -> 2479904
      numStr = numStr.replace(/\./g, '');
    } else {
      // Single dot: check if followed by 3 digits at end of string (e.g. "451.360" or "2.479")
      if (/\.\d{3}$/.test(numStr)) {
        numStr = numStr.replace(/\./g, '');
      }
    }
  }

  const num = parseFloat(numStr);
  if (isNaN(num)) return 0;
  const rounded = Math.round(num * 100) / 100;
  return isNegative ? -Math.abs(rounded) : rounded;
}

/**
 * Normalizes PDF text by joining split digits, removing duplicate spaces, and unifying brackets.
 */
export function normalizePdfText(text: string): string {
  if (!text) return '';
  let clean = text.replace(/\r\n/g, '\n');
  // 1. Join split digits and punctuation: "99 . 030 , 00" -> "99.030,00"
  clean = clean.replace(/(\d)\s*([\.,])\s*(\d)/g, '$1$2$3');
  clean = clean.replace(/(\d)\s*([\.,])\s*(\d)/g, '$1$2$3');
  // 2. Normalize brackets: "[ 40 ]" -> "[40]", "( 42 )" -> "(42)"
  clean = clean.replace(/\[\s*(\d{1,3})\s*\]/g, '[$1]');
  clean = clean.replace(/\(\s*(\d{1,3})\s*\)/g, '($1)');
  clean = clean.replace(/[ \t]+/g, ' ');
  return clean;
}

/**
 * Target Casilla amount extractor with strict label/code discarding and support for integer thousands (2.479.904) and decimals (2.479.904,00).
 */
export function extractCasillaAmount(cleanText: string, casillaCode: number): number | null {
  const normText = normalizePdfText(cleanText);
  const lines = normText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  const bracketTarget = `[${casillaCode}]`;
  const parenTarget = `(${casillaCode})`;

  // Strategy 1: Line-by-line targeted lookup
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasBracket = line.includes(bracketTarget);
    const hasParen = line.includes(parenTarget);
    const hasBareCode = new RegExp(`(?:casilla|rengl[oó]n|c[oó]digo|item)?\\s*\\b${casillaCode}\\b`, 'i').test(line);

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

      // Extract candidate number tokens discarding any surrounding words
      const moneyMatches = afterCode.match(/(?:\b\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?\b|\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d+[,\.]\d{1,2}\b|\b0(?:[,\.]00)?\b|\b\d+\b)/g);

      if (moneyMatches && moneyMatches.length > 0) {
        for (const m of moneyMatches) {
          const val = parseVenAmount(m);
          // Ignore if matched value is identical to casilla code without formatting (prevent row index collision)
          if (val !== casillaCode || m.includes(',') || m.includes('.')) {
            return val;
          }
        }
      }

      // Check next line if current line didn't have amount after code
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextMoneyMatches = nextLine.match(/(?:\b\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?\b|\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d+[,\.]\d{1,2}\b|\b0(?:[,\.]00)?\b|\b\d+\b)/g);
        if (nextMoneyMatches && nextMoneyMatches.length > 0) {
          for (const m of nextMoneyMatches) {
            const val = parseVenAmount(m);
            if (val !== casillaCode || m.includes(',') || m.includes('.')) {
              return val;
            }
          }
        }
      }
    }
  }

  // Strategy 2: Global pattern fallbacks
  const patterns = [
    new RegExp(`\\[${casillaCode}\\][\\s:;\\|\\.\\-_]*(?:Bs\\.?)?[\\s:;\\|\\.\\-_]*([\\d]{1,3}(?:[\\.\\,]\\d{3})*(?:[\\.,]\\d{1,2})?|0(?:[\\.,]00)?|\\d+)`, 'i'),
    new RegExp(`\\(${casillaCode}\\)[\\s:;\\|\\.\\-_]*(?:Bs\\.?)?[\\s:;\\|\\.\\-_]*([\\d]{1,3}(?:[\\.\\,]\\d{3})*(?:[\\.,]\\d{1,2})?|0(?:[\\.,]00)?|\\d+)`, 'i'),
    new RegExp(`(?:casilla|rengl[oó]n|c[oó]digo|item)?\\s*\\b${casillaCode}\\b[\\s:;\\|\\.\\-_]*(?:Bs\\.?)?[\\s:;\\|\\.\\-_]*([\\d]{1,3}(?:[\\.\\,]\\d{3})*(?:[\\.,]\\d{1,2})?|0(?:[\\.,]00)?|\\d+)`, 'i'),
  ];

  for (const pat of patterns) {
    const match = normText.match(pat);
    if (match && match[1]) {
      const val = parseVenAmount(match[1]);
      if (val !== casillaCode || match[1].includes(',') || match[1].includes('.')) {
        return val;
      }
    }
  }

  return null;
}

/**
 * Extracts raw text from PDF directly in browser with spatial Y-coordinate sorting.
 */
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

      const items: { str: string; x: number; y: number }[] = [];
      for (const item of textContent.items as any[]) {
        if ('str' in item && typeof item.str === 'string' && item.str.length > 0) {
          const transform = item.transform || [1, 0, 0, 1, 0, 0];
          const x = transform[4] || 0;
          const y = transform[5] || 0;
          items.push({ str: item.str, x, y });
        }
      }

      // Group into Y line buckets (4pt height quantization for stable line grouping)
      const lineMap = new Map<number, { str: string; x: number }[]>();
      for (const item of items) {
        const lineKey = Math.round(item.y / 4) * 4;
        if (!lineMap.has(lineKey)) {
          lineMap.set(lineKey, []);
        }
        lineMap.get(lineKey)!.push({ str: item.str, x: item.x });
      }

      // Sort Y lines descending (top to bottom of page)
      const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
      const pageLines: string[] = [];

      for (const yKey of sortedY) {
        const lineItems = lineMap.get(yKey)!;
        lineItems.sort((a, b) => a.x - b.x);
        pageLines.push(lineItems.map((i) => i.str).join(' '));
      }

      fullText += `\n--- Page ${pageNum} ---\n` + pageLines.join('\n');
    }

    if (fullText.trim().length > 10) {
      return fullText;
    }
  } catch (err) {
    console.warn('pdfjs extraction error:', err);
  }

  // Fallback: Latin1 decoding of uncompressed PDF streams
  try {
    const textDecoder = new TextDecoder('latin1');
    const raw = textDecoder.decode(arrayBuffer);
    const parenMatches = raw.match(/\(([^()]{2,100})\)/g) || [];
    if (parenMatches.length > 0) {
      const extractedStr = parenMatches.map((m) => m.slice(1, -1)).join(' ');
      if (extractedStr.length > 20) return extractedStr;
    }
  } catch (err2) {
    console.error('PDF text extraction fallback error:', err2);
  }

  return '';
}
