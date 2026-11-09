import { CompanyProfile, MONTH_NAMES } from '../types';
import {
  generatePeriodKey,
  SPREADSHEET_ROWS,
  auditPeriodHealth,
  calcTotalVentas,
} from './taxCalculations';

export async function exportToExcel(company: CompanyProfile): Promise<void> {
  const ExcelJSModule = await import('exceljs');
  const Workbook = ExcelJSModule.Workbook || (ExcelJSModule as unknown as { default: { Workbook: typeof ExcelJSModule.Workbook } }).default.Workbook;
  const wb = new Workbook();
  wb.creator = 'Sistema de Resumen de Planillas IVA - SENIAT';
  wb.created = new Date();

  const audit = auditPeriodHealth(company.fiscalYear, company.periodData || {});

  // ----------------------------------------------------
  // HOJA 1: PORTADA & RESUMEN EJECUTIVO
  // ----------------------------------------------------
  const wsPortada = wb.addWorksheet('Portada', {
    views: [{ showGridLines: true }],
  });

  wsPortada.columns = [
    { width: 4 },
    { width: 32 },
    { width: 38 },
    { width: 22 },
  ];

  // Header Title
  wsPortada.mergeCells('B2:D2');
  const titleCell = wsPortada.getCell('B2');
  titleCell.value = 'RESUMEN ANUAL DE PLANILLAS DE IVA (FORMA 30 SENIAT)';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsPortada.getRow(2).height = 32;

  // Company Information block
  const companyInfo = [
    ['Razón Social:', company.razonSocial],
    ['R.I.F.:', company.rif],
    ['Ejercicio Fiscal:', company.fiscalYear.toString()],
    ['Fecha de Generación:', new Date().toLocaleString('es-VE')],
    ['Estado de Auditoría:', audit.isValid ? 'CONCILIADO Y VÁLIDO' : `ALERTAS DETECTADAS (${audit.warnings.length})`],
    ['Planillas Cargadas:', `${audit.totalPeriodsWithData} de 24 Quincenas`],
  ];

  let currRow = 4;
  companyInfo.forEach(([label, value]) => {
    wsPortada.getCell(`B${currRow}`).value = label;
    wsPortada.getCell(`B${currRow}`).font = { bold: true, color: { argb: 'FF374151' } };
    wsPortada.getCell(`C${currRow}`).value = value;
    wsPortada.getCell(`C${currRow}`).font = { bold: label.includes('Estado'), color: { argb: label.includes('Estado') && !audit.isValid ? 'FFDC2626' : 'FF111827' } };
    currRow++;
  });

  // Calculate annual summary figures
  let totalDebito = 0;
  let totalCreditoDeducible = 0;
  let totalRetencionesPeriodo = 0;
  let totalPagadoSeniat = 0;
  let excedenteFinalDiciembre = 0;

  const periods = Object.values(company.periodData || {});
  periods.forEach((p) => {
    totalDebito += p.item47 || 0;
    totalCreditoDeducible += p.item71 || 0;
    totalRetencionesPeriodo += p.item66 || 0;
    totalPagadoSeniat += p.item90 || 0;
  });

  const lastPeriodKey = generatePeriodKey(company.fiscalYear, 12, 2);
  if (company.periodData && company.periodData[lastPeriodKey]) {
    excedenteFinalDiciembre = company.periodData[lastPeriodKey].item60 || 0;
  }

  currRow += 2;
  wsPortada.mergeCells(`B${currRow}:D${currRow}`);
  const summaryHeader = wsPortada.getCell(`B${currRow}`);
  summaryHeader.value = 'RESUMEN FISCAL EJECUTIVO DEL AÑO';
  summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  summaryHeader.alignment = { horizontal: 'center' };
  wsPortada.getRow(currRow).height = 24;

  currRow++;
  const summaryKPIs = [
    ['Total Débito Fiscal Generado (Item 47):', totalDebito],
    ['Total Crédito Fiscal Deducible (Item 71):', totalCreditoDeducible],
    ['Total Retenciones de IVA Soportadas (Item 66):', totalRetencionesPeriodo],
    ['Total Impuesto Enterado al SENIAT (Item 90):', totalPagadoSeniat],
    ['Excedente Crédito Fiscal Final (Diciembre 2Q - Item 60):', excedenteFinalDiciembre],
  ];

  summaryKPIs.forEach(([kpi, val]) => {
    wsPortada.getCell(`B${currRow}`).value = kpi;
    wsPortada.getCell(`B${currRow}`).font = { bold: true, color: { argb: 'FF4B5563' } };
    wsPortada.mergeCells(`C${currRow}:D${currRow}`);
    const valCell = wsPortada.getCell(`C${currRow}`);
    valCell.value = val;
    valCell.numFmt = '#,##0.00;[Red]-#,##0.00;"-"';
    valCell.font = { bold: true, color: { argb: 'FF065F46' } };
    valCell.alignment = { horizontal: 'right' };
    currRow++;
  });

  // ----------------------------------------------------
  // HOJA 2: RESUMEN IVA (MATRIZ DE 24 QUINCENAS)
  // ----------------------------------------------------
  const wsMatrix = wb.addWorksheet(`Resumen IVA ${company.fiscalYear}`, {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 7, showGridLines: true }],
  });

  // Top header banner
  wsMatrix.mergeCells('A1:AA1');
  const mainTitle = wsMatrix.getCell('A1');
  mainTitle.value = `RESUMEN DE PLANILLAS DE IVA - EJERCICIO FISCAL ${company.fiscalYear}`;
  mainTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  mainTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
  mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsMatrix.getRow(1).height = 24;

  wsMatrix.mergeCells('A2:AA2');
  const compTitle = wsMatrix.getCell('A2');
  compTitle.value = `${company.razonSocial} | R.I.F.: ${company.rif}`;
  compTitle.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F2937' } };
  compTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsMatrix.getRow(2).height = 20;

  // Row 4: Month Headers spanning 2 quincenas each
  wsMatrix.getCell('A4').value = 'CONCEPTO';
  wsMatrix.getCell('B4').value = 'ITEM';
  wsMatrix.mergeCells('A4:A5');
  wsMatrix.mergeCells('B4:B5');

  let colIdx = 3; // Col C is index 3
  for (let m = 1; m <= 12; m++) {
    const colStartLetter = getColumnLetter(colIdx);
    const colEndLetter = getColumnLetter(colIdx + 1);
    wsMatrix.mergeCells(`${colStartLetter}4:${colEndLetter}4`);
    const mCell = wsMatrix.getCell(`${colStartLetter}4`);
    mCell.value = MONTH_NAMES[m - 1].toUpperCase();
    mCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    mCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    mCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Sub-header 1Q and 2Q on Row 5
    const q1Cell = wsMatrix.getCell(`${colStartLetter}5`);
    q1Cell.value = '1ra Q';
    q1Cell.font = { bold: true, size: 9, color: { argb: 'FF334155' } };
    q1Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    q1Cell.alignment = { horizontal: 'center' };

    const q2Cell = wsMatrix.getCell(`${colEndLetter}5`);
    q2Cell.value = '2da Q';
    q2Cell.font = { bold: true, size: 9, color: { argb: 'FF334155' } };
    q2Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    q2Cell.alignment = { horizontal: 'center' };

    colIdx += 2;
  }

  // TOTAL column header
  const totalColLetter = getColumnLetter(colIdx);
  wsMatrix.mergeCells(`${totalColLetter}4:${totalColLetter}5`);
  const totHeader = wsMatrix.getCell(`${totalColLetter}4`);
  totHeader.value = 'TOTAL';
  totHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  totHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  totHeader.alignment = { horizontal: 'center', vertical: 'middle' };

  wsMatrix.getRow(4).height = 20;
  wsMatrix.getRow(5).height = 18;

  // Setup Column Widths
  wsMatrix.getColumn(1).width = 38; // Concepto
  wsMatrix.getColumn(2).width = 12; // Item
  for (let c = 3; c <= 26; c++) {
    wsMatrix.getColumn(c).width = 14;
  }
  wsMatrix.getColumn(27).width = 18; // Total

  // Fill in Data Rows
  let startDataRow = 7;
  SPREADSHEET_ROWS.forEach((rowConfig, idx) => {
    const rIdx = startDataRow + idx;
    const row = wsMatrix.getRow(rIdx);

    const conceptoCell = row.getCell(1);
    conceptoCell.value = rowConfig.label;
    conceptoCell.font = {
      bold: Boolean(rowConfig.isBold || rowConfig.isSubtotal || rowConfig.isTotal),
      size: 10,
      color: { argb: rowConfig.isTotal ? 'FF1E3A8A' : 'FF1F2937' },
    };

    const itemCodeCell = row.getCell(2);
    itemCodeCell.value = rowConfig.itemCode || '';
    itemCodeCell.font = { size: 9, color: { argb: 'FF6B7280' } };
    itemCodeCell.alignment = { horizontal: 'center' };

    // Fill each quincena value
    let qCol = 3;
    for (let m = 1; m <= 12; m++) {
      for (let q = 1 as 1 | 2; q <= 2; q++) {
        const pKey = generatePeriodKey(company.fiscalYear, m, q);
        const qData = (company.periodData || {})[pKey];
        const val = qData ? rowConfig.getValue(qData) : 0;

        const dataCell = row.getCell(qCol);
        dataCell.value = val;
        dataCell.numFmt = '#,##0.00;[Red]-#,##0.00;"-"';
        dataCell.font = {
          bold: Boolean(rowConfig.isBold || rowConfig.isTotal),
          size: 10,
        };

        // Section Tints
        if (rowConfig.id === 'cuentasCobrar') {
          dataCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }; // Light Yellow
        } else if (['item40', 'item42', 'item43', 'item442', 'item443', 'item47'].includes(rowConfig.id)) {
          dataCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }; // Soft Rose
        } else if (['item30', 'item33', 'item333', 'item35', 'item34', 'item343', 'item70', 'item37', 'item71'].includes(rowConfig.id)) {
          dataCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }; // Soft Green
        } else if (['item20', 'item38', 'item39', 'item53'].includes(rowConfig.id)) {
          dataCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }; // Soft Indigo
        } else if (['item60', 'item54', 'item66', 'item67'].includes(rowConfig.id)) {
          dataCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // Soft Gray
        } else if (rowConfig.id === 'item90') {
          dataCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Amber Total
        }

        qCol++;
      }
    }

    // Formula for Total column: =SUM(C{r}:Z{r})
    const totalCell = row.getCell(27);
    totalCell.value = { formula: `SUM(C${rIdx}:Z${rIdx})` };
    totalCell.numFmt = '#,##0.00;[Red]-#,##0.00;"-"';
    totalCell.font = {
      bold: true,
      color: { argb: rowConfig.isTotal ? 'FFB45309' : 'FF065F46' },
    };
    totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };

    // Format special highlighting for whole row if total/subtotal
    if (rowConfig.isTotal) {
      row.height = 22;
      conceptoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      itemCodeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    } else if (rowConfig.id === 'cuentasCobrar') {
      conceptoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      itemCodeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
    }

    row.commit();
  });

  // ----------------------------------------------------
  // HOJA 3: DETALLE DE PLANILLAS CARGADAS
  // ----------------------------------------------------
  const wsDetail = wb.addWorksheet('Detalle de Planillas', {
    views: [{ showGridLines: true }],
  });

  wsDetail.columns = [
    { header: 'Período', key: 'periodo', width: 14 },
    { header: 'Mes / Quincena', key: 'mesQuincena', width: 20 },
    { header: 'N° Declaración', key: 'numDec', width: 18 },
    { header: 'N° Certificado', key: 'numCert', width: 18 },
    { header: 'Fecha Declaración', key: 'fechaDec', width: 16 },
    { header: 'Período Impositivo', key: 'periodoImp', width: 22 },
    { header: 'Archivo de Origen', key: 'archivo', width: 34 },
    { header: 'Ventas Gravadas', key: 'ventas', width: 16 },
    { header: 'Débito Fiscal', key: 'debito', width: 16 },
    { header: 'Total a Pagar', key: 'pagar', width: 16 },
    { header: 'Estado', key: 'estado', width: 14 },
  ];

  // Style Header Row of Detalle
  const dHeaderRow = wsDetail.getRow(1);
  dHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  dHeaderRow.height = 24;

  for (let m = 1; m <= 12; m++) {
    for (let q = 1 as 1 | 2; q <= 2; q++) {
      const pKey = generatePeriodKey(company.fiscalYear, m, q);
      const qData = (company.periodData || {})[pKey];
      const hasData = qData && (qData.item40 > 0 || qData.item42 > 0 || qData.item30 > 0 || qData.item33 > 0 || qData.fileName);

      const dRow = wsDetail.addRow({
        periodo: `${company.fiscalYear}-${m.toString().padStart(2, '0')}-${q}`,
        mesQuincena: `${MONTH_NAMES[m - 1]} (${q === 1 ? '1ra Q' : '2da Q'})`,
        numDec: qData?.numeroDeclaracion || (hasData ? 'No indicado' : '-'),
        numCert: qData?.numeroCertificado || (hasData ? 'No indicado' : '-'),
        fechaDec: qData?.fechaDeclaracion || '-',
        periodoImp: qData?.fechaDesde ? `${qData.fechaDesde} al ${qData.fechaHasta}` : '-',
        archivo: qData?.fileName || (hasData ? 'Carga manual' : 'Pendiente'),
        ventas: qData?.item42 || 0,
        debito: qData?.item47 || 0,
        pagar: qData?.item90 || 0,
        estado: hasData ? 'Cargada' : 'Pendiente',
      });

      dRow.getCell('ventas').numFmt = '#,##0.00;[Red]-#,##0.00;"-"';
      dRow.getCell('debito').numFmt = '#,##0.00;[Red]-#,##0.00;"-"';
      dRow.getCell('pagar').numFmt = '#,##0.00;[Red]-#,##0.00;"-"';

      if (hasData) {
        dRow.getCell('estado').font = { bold: true, color: { argb: 'FF065F46' } };
      } else {
        dRow.getCell('estado').font = { color: { argb: 'FF9CA3AF' } };
      }
    }
  }

  // ----------------------------------------------------
  // HOJA 4: AUDITORÍA Y VALIDACIÓN SENIAT
  // ----------------------------------------------------
  const wsAudit = wb.addWorksheet('Validación SENIAT', {
    views: [{ showGridLines: true }],
  });

  wsAudit.columns = [
    { header: 'Período', key: 'periodKey', width: 14 },
    { header: 'Quincena', key: 'periodName', width: 22 },
    { header: 'Tipo de Verificación', key: 'type', width: 22 },
    { header: 'Diagnóstico / Alerta SENIAT', key: 'message', width: 50 },
    { header: 'Estado', key: 'status', width: 16 },
  ];

  const aHeaderRow = wsAudit.getRow(1);
  aHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  aHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF831843' } };
  aHeaderRow.height = 24;

  if (audit.warnings.length === 0) {
    wsAudit.addRow({
      periodKey: 'TODOS',
      periodName: `Año Completo ${company.fiscalYear}`,
      type: 'CONTINUIDAD FISCAL',
      message: 'Todos los saldos de arrastre (Excedentes Item 60->20 y Retenciones Item 67->54) están perfectamente conciliados.',
      status: 'CORRECTO',
    });
  } else {
    audit.warnings.forEach((w) => {
      const aRow = wsAudit.addRow({
        periodKey: w.periodKey,
        periodName: w.periodName,
        type: w.type.toUpperCase(),
        message: w.message,
        status: 'DESCUADRE',
      });
      aRow.getCell('status').font = { bold: true, color: { argb: 'FFDC2626' } };
    });
  }

  // Generate and trigger download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeName = company.razonSocial.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const fileName = `Resumen_IVA_${safeName}_${company.fiscalYear}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}
