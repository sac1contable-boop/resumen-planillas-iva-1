import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanyProfile, MONTH_NAMES } from '../types';
import { formatCurrency, generatePeriodKey, SPREADSHEET_ROWS } from './taxCalculations';

export function exportToPdf(company: CompanyProfile): void {
  // Create landscape A3 or A4 doc for the wide matrix
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
  });

  // Header Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`EJERCICIO FISCAL ${company.fiscalYear}`, 210, 15, { align: 'center' });
  doc.setFontSize(13);
  doc.text(company.razonSocial, 210, 22, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`RIF: ${company.rif}  |  RESUMEN ANUAL DE PLANILLAS DE IVA - SENIAT`, 210, 28, { align: 'center' });

  // Prepare table headers
  const headRows: any[] = [];
  const topHeader: any[] = [
    { content: 'CONCEPTO', rowSpan: 2, styles: { halign: 'left', fillColor: [240, 240, 240], textColor: [20, 20, 20], fontStyle: 'bold' } },
    { content: 'ITEM', rowSpan: 2, styles: { halign: 'center', fillColor: [240, 240, 240], textColor: [20, 20, 20], fontStyle: 'bold' } },
  ];

  for (let m = 1; m <= 12; m++) {
    topHeader.push({
      content: `${company.fiscalYear}\n${MONTH_NAMES[m - 1]}`,
      colSpan: 2,
      styles: { halign: 'center', fillColor: [253, 230, 240], textColor: [120, 20, 70], fontStyle: 'bold' },
    });
  }

  topHeader.push({
    content: 'TOTAL',
    rowSpan: 2,
    styles: { halign: 'right', fillColor: [220, 230, 242], textColor: [20, 40, 80], fontStyle: 'bold' },
  });

  const subHeader: any[] = [];
  for (let m = 1; m <= 12; m++) {
    subHeader.push({ content: '1Q', styles: { halign: 'center', fillColor: [250, 240, 245], fontSize: 7 } });
    subHeader.push({ content: '2Q', styles: { halign: 'center', fillColor: [250, 240, 245], fontSize: 7 } });
  }

  headRows.push(topHeader);
  headRows.push(subHeader);

  // Table Body
  const bodyRows: any[] = [];

  SPREADSHEET_ROWS.forEach((rowConfig) => {
    const rowCells: any[] = [
      {
        content: rowConfig.label,
        styles: {
          fontStyle: rowConfig.isBold ? 'bold' : 'normal',
          fillColor: rowConfig.isHighlightYellow ? [254, 240, 138] : undefined,
        },
      },
      {
        content: rowConfig.itemCode || '',
        styles: {
          halign: 'center',
          fontStyle: 'normal',
          fontSize: 7,
          fillColor: rowConfig.isHighlightYellow ? [254, 240, 138] : undefined,
        },
      },
    ];

    let rowSum = 0;

    for (let m = 1; m <= 12; m++) {
      for (let q = 1 as 1 | 2; q <= 2; q++) {
        const pKey = generatePeriodKey(company.fiscalYear, m, q);
        const qData = company.periodData[pKey];
        const val = qData ? rowConfig.getValue(qData) : 0;
        rowSum += val;

        rowCells.push({
          content: formatCurrency(val, true),
          styles: {
            halign: 'right',
            fontStyle: rowConfig.isBold ? 'bold' : 'normal',
            fontSize: 7,
            fillColor: rowConfig.isHighlightYellow ? [254, 240, 138] : undefined,
          },
        });
      }
    }

    // Total cell
    rowCells.push({
      content: formatCurrency(rowSum, true),
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fontSize: 7.5,
        fillColor: rowConfig.isHighlightYellow ? [254, 240, 138] : [240, 245, 255],
      },
    });

    bodyRows.push(rowCells);
  });

  autoTable(doc, {
    startY: 34,
    head: headRows,
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 16 },
    },
    margin: { top: 34, left: 8, right: 8, bottom: 12 },
  });

  // Footer notes
  const finalY = (doc as any).lastAutoTable?.finalY || 260;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Documento generado automáticamente a partir de las declaraciones Forma 30 SENIAT - Fecha de emisión: ${new Date().toLocaleDateString('es-VE')}`,
    8,
    finalY + 8
  );

  const safeName = company.razonSocial.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  doc.save(`Resumen_IVA_${safeName}_${company.fiscalYear}.pdf`);
}
