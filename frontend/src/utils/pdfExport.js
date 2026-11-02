import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import i18n from '../i18n.js';
import { escapeHtml } from './safePrint.js';
import urduFontUrl from '../assets/fonts/NotoNastaliqUrdu-wght.ttf?url';
import { buildPrintReportHeaderHtml, PRINT_REPORT_HEADER_STYLES } from '../components/common/PrintReportHeader.jsx';
import api from './api.js';

let businessProfileRequest;
export async function getBusinessProfileForReport() {
  if (!businessProfileRequest) {
    businessProfileRequest = api.get('/settings/business')
      .then(({ data }) => data || {})
      .catch(() => ({}))
      .finally(() => { businessProfileRequest = null; });
  }
  return businessProfileRequest;
}

export function drawPdfReportHeader(doc, { title = '', period = '', businessProfile = {} } = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 14;
  const logoX = left;
  const logoY = 7;
  const logoW = 22;
  const logoH = 20;
  const infoX = 43;
  const codeWidth = businessProfile?.arthiCode ? 44 : 0;
  const infoWidth = pageWidth - infoX - left - codeWidth - 8;
  let infoY = 11;
  const businessName = businessProfile?.businessName || businessProfile?.name || '';
  const owner1Name = businessProfile?.ownerName1 || businessProfile?.ownerName;
  const owner1Phone = businessProfile?.ownerNumber1 || businessProfile?.mobileNumber;
  const owner2Name = businessProfile?.ownerName2;
  const owner2Phone = businessProfile?.ownerNumber2;

  doc.setFillColor(240, 245, 241);
  doc.roundedRect(logoX, logoY, logoW, logoH, 2, 2, 'F');
  if (typeof businessProfile?.logo === 'string' && businessProfile.logo.startsWith('data:image/')) {
    try {
      const imageInfo = doc.getImageProperties(businessProfile.logo);
      const scale = Math.min((logoW - 3) / imageInfo.width, (logoH - 3) / imageInfo.height);
      const imageW = imageInfo.width * scale;
      const imageH = imageInfo.height * scale;
      doc.addImage(businessProfile.logo, imageInfo.fileType, logoX + (logoW - imageW) / 2, logoY + (logoH - imageH) / 2, imageW, imageH);
    } catch { /* Keep the fallback mark when the configured image is invalid. */ }
  }
  if (!businessProfile?.logo || !businessProfile.logo.startsWith('data:image/')) {
    doc.setDrawColor(22, 139, 80);
    doc.setLineWidth(0.45);
    doc.rect(logoX + 5, logoY + 5, 5, 12);
    doc.rect(logoX + 10, logoY + 8, 6, 9);
    doc.line(logoX + 4, logoY + 17.5, logoX + 18, logoY + 17.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(String(owner1Name || businessName).charAt(0).toUpperCase(), logoX + 11, logoY + 24, { align: 'center' });
  }

  if (businessName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(22, 139, 80);
    const nameLines = doc.splitTextToSize(businessName.toUpperCase(), infoWidth);
    doc.text(nameLines, infoX, infoY);
    infoY += nameLines.length * 6;
  }
  const ownerLines = [
    [owner1Name, owner1Phone].filter(Boolean).join(' • '),
    [owner2Name, owner2Phone].filter(Boolean).join(' • ')
  ].filter(Boolean);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(11, 53, 71);
  ownerLines.forEach((line) => {
    const lines = doc.splitTextToSize(line, infoWidth);
    doc.text(lines, infoX, infoY);
    infoY += lines.length * 3.5;
  });
  const proprietor = businessProfile?.proprietorName || businessProfile?.ownerName;
  if (proprietor && proprietor !== owner1Name && proprietor !== owner2Name) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(85, 122, 152);
    const lines = doc.splitTextToSize(`Proprietor: ${proprietor}`, infoWidth);
    doc.text(lines, infoX, infoY);
    infoY += lines.length * 3.5;
  }
  const address = [businessProfile?.shopNumber || businessProfile?.shopNo, businessProfile?.address, businessProfile?.city, businessProfile?.country].filter(Boolean).join(', ');
  if (address) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(85, 122, 152);
    const lines = doc.splitTextToSize(address, infoWidth);
    doc.text(lines, infoX, infoY);
    infoY += lines.length * 3.5;
  }
  if (businessProfile?.arthiCode) {
    doc.setDrawColor(8, 98, 122);
    doc.setLineWidth(0.35);
    doc.line(pageWidth - 59, 8, pageWidth - 59, Math.max(27, infoY));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(85, 122, 152);
    doc.text('ARHTI CODE', pageWidth - 53, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(22, 139, 80);
    doc.text(String(businessProfile.arthiCode), pageWidth - 53, 22);
  }

  const dividerY = Math.max(32, infoY + 2);
  doc.setLineWidth(0.8);
  doc.setDrawColor(8, 98, 122);
  doc.line(left, dividerY, pageWidth - 22, dividerY);
  doc.setDrawColor(22, 139, 80);
  doc.line(pageWidth - 19, dividerY, pageWidth - left, dividerY);
  const titleLines = doc.splitTextToSize(String(title).toUpperCase(), pageWidth - 2 * left);
  const titleY = dividerY + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(11, 53, 71);
  doc.text(titleLines, pageWidth / 2, titleY, { align: 'center' });
  const periodY = titleY + titleLines.length * 5 + 1;
  if (period) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(85, 122, 152);
    doc.text(`Report Period: ${period}`, pageWidth / 2, periodY, { align: 'center' });
  }
  const bottomLineY = periodY + (period ? 5 : 1);
  doc.setDrawColor(197, 217, 231);
  doc.setLineWidth(0.35);
  doc.line(left, bottomLineY, pageWidth - left, bottomLineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(85, 122, 152);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, left, bottomLineY + 5);
  doc.text('MandiOS Business Report', pageWidth - left, bottomLineY + 5, { align: 'right' });
  return bottomLineY + 9;
}

export async function downloadLocalizedPdf({ title, subtitle = '', period = '', businessProfile = null, summary = [], columns = [], rows = [], filename = '' }) {
  if (typeof document === 'undefined' || document.documentElement.lang !== 'ur') return false;

  const localize = (value) => i18n.t(String(value), { defaultValue: String(value) });
  const displayValue = (value) => {
    const text = String(value ?? '-');
    const direction = /^[\d\s.,+()/:#A-Za-z%$-]+$/.test(text) && /\d/.test(text) ? 'ltr' : 'auto';
    return `<bdi dir="${direction}">${escapeHtml(text)}</bdi>`;
  };
  const summaryHtml = summary.map(([label, value]) => `
    <div class="summary-item">
      <dt>${escapeHtml(localize(label))}</dt>
      <dd>${displayValue(value)}</dd>
    </div>
  `).join('');
  const headHtml = columns.map(column => `<th>${escapeHtml(localize(column))}</th>`).join('');
  const reportHeader = buildPrintReportHeaderHtml({
    title: localize(title),
    period: localize(period || subtitle),
    profile: businessProfile,
    labels: {
      arthiCode: localize('ARHTI CODE'),
      date: localize('Date'),
      generated: localize('Generated'),
      footer: localize('MandiOS Business Report'),
      proprietor: localize('Proprietor'),
      period: localize('Report Period'),
      locale: 'ur-PK'
    },
    includeStyles: false
  });
  const renderRoot = document.createElement('div');
  renderRoot.dataset.reportPdfRender = 'true';
  renderRoot.lang = 'ur';
  renderRoot.dir = 'rtl';
  renderRoot.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;opacity:0;pointer-events:none;';
  renderRoot.innerHTML = `
    <style>
      ${PRINT_REPORT_HEADER_STYLES}
      @font-face { font-family:"Noto Nastaliq Urdu"; src:url("${urduFontUrl}") format("truetype"); font-style:normal; font-weight:100 900; }
      .report-pdf-page { box-sizing:border-box; width:794px; height:1123px; padding:40px 44px; overflow:hidden; background:#fff; color:#0f172a; font:14px/1.8 "Noto Nastaliq Urdu","Noto Naskh Arabic","Segoe UI",serif; direction:rtl; }
      .report-pdf-page * { box-sizing:border-box; }
      .report-pdf-page dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:0 0 18px; }
      .report-pdf-page .summary-item { border:1px solid #cbd5e1; padding:6px 10px; break-inside:avoid; }
      .report-pdf-page dt { color:#475569; font-size:11px; }
      .report-pdf-page dd { margin:0; font-weight:700; }
      .report-pdf-page table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px; }
      .report-pdf-page th,.report-pdf-page td { border:1px solid #cbd5e1; padding:5px 7px; text-align:right; vertical-align:top; overflow-wrap:anywhere; }
      .report-pdf-page th { background:#eef2ff; }
      .report-pdf-page td bdi[dir="auto"] { unicode-bidi:plaintext; }
      .report-pdf-page .mandios-print-header { margin-bottom:12px; }
    </style>`;
  document.body.appendChild(renderRoot);
  const headerHtml = reportHeader || `<h1>${escapeHtml(localize(title))}</h1>`;
  const createPage = (includeSummary) => {
    const page = document.createElement('section');
    page.className = 'report-pdf-page';
    page.innerHTML = `${headerHtml}${includeSummary && summaryHtml ? `<dl>${summaryHtml}</dl>` : ''}${columns.length ? `<table><thead><tr>${headHtml}</tr></thead><tbody></tbody></table>` : ''}`;
    renderRoot.appendChild(page);
    return page;
  };
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4', unit: 'mm' });
  let pageCount = 0;
  let html2canvasLoader;
  const renderPage = async (page) => {
    html2canvasLoader ||= import('html2canvas').then(module => module.default);
    const html2canvas = await html2canvasLoader;
    await document.fonts?.load('14px "Noto Nastaliq Urdu"');
    await document.fonts?.ready;
    const canvas = await html2canvas(page, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      width: 794,
      height: 1123,
      windowWidth: 794,
      windowHeight: 1123,
      onclone: (clonedDocument) => {
        const clonedRoot = clonedDocument.querySelector('[data-report-pdf-render]');
        if (clonedRoot) clonedRoot.style.opacity = '1';
      }
    });
    if (pageCount > 0) doc.addPage();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297);
    pageCount += 1;
    page.remove();
  };
  try {
    let page = createPage(true);
    let tbody = page.querySelector('tbody');
    for (const row of rows) {
      if (!tbody) break;
      const tr = document.createElement('tr');
      tr.innerHTML = row.map(value => `<td>${displayValue(value)}</td>`).join('');
      tbody.appendChild(tr);
      if (page.scrollHeight > page.clientHeight && tbody.rows.length > 1) {
        tr.remove();
        await renderPage(page);
        page = createPage(false);
        tbody = page.querySelector('tbody');
        tbody?.appendChild(tr);
      }
    }
    await renderPage(page);
    const safeFilename = (filename || title || 'report').replace(/[^a-zA-Z0-9_-]+/g, '_');
    doc.save(`${safeFilename}_${new Date().toISOString().split('T')[0]}.pdf`);
  } finally {
    renderRoot.remove();
  }
  return true;
}

/**
 * Generates and triggers download of a PDF document for Customer or Supplier Ledger.
 */
export const downloadLedgerPDF = async ({
  partyType = 'Customer', // 'Customer' or 'Supplier'
  partyDetails = {},
  ledgerEntries = [],
  totals = {},
  businessProfile: suppliedBusinessProfile
}) => {
  const businessProfile = suppliedBusinessProfile || await getBusinessProfileForReport();
  const displayPartyType = partyType === 'Supplier' ? 'Beopari/Grower' : partyType;
  const title = partyType === 'Supplier' 
    ? 'BEOPARI/GROWER CONSIGNMENT STATEMENT LEDGER' 
    : 'CUSTOMER ACCOUNT STATEMENT LEDGER';
  const ledgerRows = ledgerEntries.map(entry => [
    entry.date || '',
    entry.description || entry.memo || 'Transaction Posting',
    entry.type || '-',
    entry.type === 'Debit' ? `Rs. ${(entry.amount || 0).toLocaleString()}` : '-',
    entry.type === 'Credit' ? `Rs. ${(entry.amount || 0).toLocaleString()}` : '-',
    `Rs. ${(entry.balanceAfter || 0).toLocaleString()}`
  ]);
  const balance = totals.currentBalance !== undefined
    ? totals.currentBalance
    : (partyDetails?.currentBalance || 0);

  if (await downloadLocalizedPdf({
    title,
    summary: [
      ['Party', `${displayPartyType}: ${partyDetails?.name || 'All Accounts'}`],
      ['Phone', partyDetails?.phone || 'N/A'],
      ['City', partyDetails?.city || 'Mandi Market'],
      ['Balance', `Rs. ${Math.abs(balance).toLocaleString()}`],
    ],
    columns: ['Date', 'Transaction Reference / Description', 'Posting', 'Debit (Dr)', 'Credit (Cr)', 'Balance After'],
    rows: ledgerRows,
    businessProfile,
  })) return;

  const doc = new jsPDF();
  const headerBottom = drawPdfReportHeader(doc, { title, businessProfile });

  // Party Information Card
  doc.setTextColor(30, 41, 59);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, headerBottom + 2, 182, 28, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, headerBottom + 2, 182, 28, 3, 3, 'D');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${displayPartyType}: ${partyDetails?.name || 'All Accounts'}`, 18, headerBottom + 10);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Phone: ${partyDetails?.phone || 'N/A'}`, 18, headerBottom + 16);
  doc.text(`City: ${partyDetails?.city || 'Mandi Market'}`, 18, headerBottom + 22);

  const bal = balance;
  doc.setFont('helvetica', 'bold');
  const balText = partyType === 'Supplier' 
    ? `Net Payable Balance: Rs. ${Math.abs(bal).toLocaleString()} ${bal > 0 ? '(Payable)' : bal < 0 ? '(Advance)' : ''}`
    : `Net Account Balance: Rs. ${Math.abs(bal).toLocaleString()} ${bal > 0 ? '(Receivable)' : bal < 0 ? '(Credit)' : ''}`;
  
  doc.text(balText, 190, headerBottom + 10, { align: 'right' });

  if (totals.totalDebit !== undefined && totals.totalCredit !== undefined) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const debitLabel = partyType === 'Supplier' ? 'Disbursed (Dr)' : 'Purchases (Dr)';
    const creditLabel = partyType === 'Supplier' ? 'Credits (Cr)' : 'Payments (Cr)';
    doc.text(`Total ${debitLabel}: Rs. ${totals.totalDebit.toLocaleString()}`, 190, headerBottom + 16, { align: 'right' });
    doc.text(`Total ${creditLabel}: Rs. ${totals.totalCredit.toLocaleString()}`, 190, headerBottom + 22, { align: 'right' });
  }

  // Format table rows
  const tableRows = ledgerRows;

  autoTable(doc, {
    startY: headerBottom + 34,
    margin: { top: headerBottom + 34, bottom: 12 },
    head: [['Date', 'Transaction Reference / Description', 'Posting', 'Debit (Dr)', 'Credit (Cr)', 'Balance After']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 62 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 27, halign: 'right', fontStyle: 'bold' }
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [51, 65, 85]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPdfReportHeader(doc, { title, businessProfile });
      const pageCount = doc.internal.getNumberOfPages();
      const str = `Page ${data.pageNumber} of ${pageCount}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, 196, doc.internal.pageSize.height - 10, { align: 'right' });
      doc.text('Mandi Stock Brokerage System — Statement Ledger PDF', 14, doc.internal.pageSize.height - 10);
    }
  });

  const cleanName = (partyDetails?.name || partyType).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${partyType === 'Supplier' ? 'Beopari-Grower' : partyType}_Ledger_${cleanName}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

export async function downloadPaymentParchiPDF({ payment = {}, party = {} } = {}) {
  const partyType = payment.partyType || party.partyType || 'Customer';
  const amount = Number(payment.amount) || 0;
  const internalBefore = Number.isFinite(Number(payment.balanceBefore))
    ? Number(payment.balanceBefore)
    : (partyType === 'Supplier'
      ? (Number(party.currentBalance) || 0) - amount
      : (Number(party.currentBalance) || 0) + amount);
  const internalAfter = Number.isFinite(Number(payment.balanceAfter))
    ? Number(payment.balanceAfter)
    : (partyType === 'Supplier' ? internalBefore + amount : internalBefore - amount);
  const displayBefore = partyType === 'Supplier' ? -internalBefore : internalBefore;
  const displayAfter = partyType === 'Supplier' ? -internalAfter : internalAfter;
  const formatAmount = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;
  const businessProfile = await getBusinessProfileForReport();
  const summary = [
    ['Party', `${partyType === 'Supplier' ? 'Beopari/Grower' : 'Customer'}: ${payment.partyName || party.name || ''}`],
    ['Date', payment.date || ''],
    ['Transaction Type', payment.type === 'Paid' ? 'Disbursement' : 'Receipt'],
    ['Payment Method', payment.paymentMethod || 'Cash'],
    ['Total Amount', formatAmount(displayBefore)],
    ['Paid / Disbursement Amount', formatAmount(amount)],
    ['Remaining Balance', formatAmount(displayAfter)],
  ];
  const title = 'Payment / Receipt Parchi';

  if (typeof document !== 'undefined' && document.documentElement.lang === 'ur') {
    const localize = (value) => i18n.t(String(value), { defaultValue: String(value) });
    const labels = {
      arthiCode: localize('ARHTI CODE'),
      date: localize('Date'),
      generated: localize('Generated'),
      footer: localize('MandiOS Business Report'),
      logo: localize('Business logo'),
      logoFallback: localize('Business mark'),
      period: localize('Report Period'),
      proprietor: localize('Proprietor'),
      reportHeader: localize('Report header'),
      locale: 'ur-PK',
    };
    const header = buildPrintReportHeaderHtml({
      title: localize(title),
      period: payment.date || '',
      profile: businessProfile,
      labels,
      includeStyles: false,
    });
    const summaryRows = summary.map(([label, value]) => `
      <div class="parchi-row">
        <div class="parchi-label" dir="rtl">${escapeHtml(localize(label))}</div>
        <div class="parchi-value" dir="auto">${escapeHtml(value)}</div>
      </div>
    `).join('');
    const renderRoot = document.createElement('div');
    renderRoot.dataset.parchiPdfRender = 'true';
    renderRoot.lang = 'ur';
    renderRoot.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;opacity:0;pointer-events:none;';
    renderRoot.innerHTML = `
      <style>
        ${PRINT_REPORT_HEADER_STYLES}
        @font-face { font-family:"Noto Nastaliq Urdu"; src:url("${urduFontUrl}") format("truetype"); font-style:normal; font-weight:100 900; }
        .parchi-page { box-sizing:border-box; width:794px; height:1123px; padding:40px 44px; overflow:hidden; background:#fff; color:#0f172a; font:14px/1.8 "Noto Nastaliq Urdu","Noto Naskh Arabic","Segoe UI",serif; direction:ltr; }
        .parchi-page * { box-sizing:border-box; }
        .parchi-page .mandios-print-header { margin-bottom:22px; }
        .parchi-rows { direction:ltr; }
        .parchi-row { display:flex; align-items:center; justify-content:space-between; min-height:38px; gap:20px; border-bottom:1px solid #e2e8f0; color:#475569; }
        .parchi-label { flex:1; text-align:left; }
        .parchi-value { flex:1; text-align:right; color:#0f172a; font-weight:700; unicode-bidi:plaintext; }
      </style>
      <section class="parchi-page">${header}<div class="parchi-rows">${summaryRows}</div></section>
    `;
    document.body.appendChild(renderRoot);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const page = renderRoot.querySelector('.parchi-page');
      await document.fonts?.load('14px "Noto Nastaliq Urdu"');
      await document.fonts?.ready;
      const canvas = await html2canvas(page, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
        onclone: (clonedDocument) => {
          const clonedRoot = clonedDocument.querySelector('[data-parchi-pdf-render]');
          if (clonedRoot) clonedRoot.style.opacity = '1';
        },
      });
      const doc = new jsPDF({ orientation: 'portrait', format: 'a4', unit: 'mm' });
      doc.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297);
      const safeName = String(payment.partyName || party.name || 'Party').replace(/[^a-zA-Z0-9_-]+/g, '_');
      doc.save(`Payment_Parchi_${safeName}_${payment.date || new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      renderRoot.remove();
    }
    return true;
  }

  const doc = new jsPDF();
  const headerBottom = drawPdfReportHeader(doc, { title, period: payment.date || '', businessProfile });
  const left = 18;
  let y = headerBottom + 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  for (const [label, value] of summary) {
    doc.text(label, left, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(value), 192, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    y += 10;
    doc.setDrawColor(226, 232, 240);
    doc.line(left, y - 4, 192, y - 4);
  }
  const safeName = String(payment.partyName || party.name || 'Party').replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`Payment_Parchi_${safeName}_${payment.date || new Date().toISOString().slice(0, 10)}.pdf`);
  return true;
}

export async function downloadTruckParchiPDF({ truck = {} } = {}) {
  const businessProfile = await getBusinessProfileForReport();
  const beoparis = Array.isArray(truck.beoparis) && truck.beoparis.length
    ? truck.beoparis
    : [{ supplierName: truck.supplierName || '', products: [{ productName: truck.description || truck.notes || 'Cargo', quantity: truck.quantityLoaded || 0, unit: truck.unit || 'Crates', description: '' }] }];
  const rows = beoparis.flatMap(entry => (entry.products || []).map(product => [
    entry.supplierName || truck.supplierName || '-',
    product.productName || '-',
    String(product.quantity ?? 0),
    product.unit || '-',
    product.description || '-',
  ]));
  const title = 'Truck Entry Parchi';
  const period = truck.arrivalDate || '';
  const summary = [
    ['Vehicle Type', truck.vehicleType || 'Truck'],
    ['Vehicle Number', truck.truckNumber || '-'],
    ['Driver', truck.driverName || '-'],
    ['Driver Phone', truck.driverPhone || '-'],
    ['Status', truck.status || 'Arrived'],
    ['Beopari Count', String(beoparis.length)],
    ['Product Rows', String(rows.length)],
  ];
  const filename = `Truck_Parchi_${String(truck.truckNumber || 'Entry').replace(/[^a-zA-Z0-9_-]+/g, '_')}_${period || new Date().toISOString().slice(0, 10)}.pdf`;
  if (await downloadLocalizedPdf({
    title, period, businessProfile, summary,
    columns: ['Beopari', 'Product', 'Quantity', 'Unit', 'Notes'], rows, filename,
  })) return true;

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4', unit: 'mm' });
  const headerBottom = drawPdfReportHeader(doc, { title, period, businessProfile });
  autoTable(doc, {
    startY: headerBottom + 4,
    head: [['Beopari', 'Product', 'Quantity', 'Unit', 'Notes']],
    body: rows,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [8, 98, 122] },
    margin: { left: 14, right: 14 },
  });
  let y = (doc.lastAutoTable?.finalY || headerBottom) + 10;
  doc.setFontSize(9);
  for (const [label, value] of summary.slice(0, 5)) {
    doc.text(`${label}: ${value}`, 14, y);
    y += 5;
  }
  doc.save(filename);
  return true;
}

/**
 * Generates and triggers download of a PDF document for Employee & Payroll Management reports.
 */
export const downloadPayrollReportPDF = async ({
  reportTitle = 'Payroll Report',
  reportPeriod = '',
  reportData = [],
  businessProfile = {},
  totalAmount = null
}) => {
  if (reportData?.length && await downloadLocalizedPdf({
    title: reportTitle,
    subtitle: reportPeriod,
    period: reportPeriod,
    businessProfile,
    summary: [
      ['Total Sum', totalAmount === null || totalAmount === undefined ? '-' : `Rs. ${Number(totalAmount).toLocaleString()}`],
    ],
    columns: Object.keys(reportData[0]),
    rows: reportData.map(row => Object.values(row).map(value => value ?? '-')),
  })) return;

  if (!reportData?.length && await downloadLocalizedPdf({
    title: reportTitle,
    subtitle: reportPeriod,
    period: reportPeriod,
    businessProfile,
    summary: [['Report', 'No records found for the selected report filters.']],
  })) return;

  const doc = new jsPDF({ orientation: 'landscape' });

  const bizName = businessProfile?.businessName || businessProfile?.name || '';
  const drawPayrollHeader = () => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 14;
    const logoX = left;
    const logoY = 7;
    const logoW = 22;
    const logoH = 20;
    const infoX = 43;
    const infoWidth = 192;
    let infoY = 11;

    doc.setFillColor(240, 245, 241);
    doc.roundedRect(logoX, logoY, logoW, logoH, 2, 2, 'F');
    if (typeof businessProfile?.logo === 'string' && businessProfile.logo.startsWith('data:image/')) {
      try {
        const imageInfo = doc.getImageProperties(businessProfile.logo);
        const scale = Math.min((logoW - 3) / imageInfo.width, (logoH - 3) / imageInfo.height);
        const imageW = imageInfo.width * scale;
        const imageH = imageInfo.height * scale;
        doc.addImage(businessProfile.logo, imageInfo.fileType, logoX + (logoW - imageW) / 2, logoY + (logoH - imageH) / 2, imageW, imageH);
      } catch {
        // Keep the building mark fallback if the configured logo cannot be embedded.
      }
    }
    if (!businessProfile?.logo || !businessProfile.logo.startsWith('data:image/')) {
      doc.setDrawColor(22, 139, 80);
      doc.setLineWidth(0.45);
      doc.rect(logoX + 5, logoY + 5, 5, 12);
      doc.rect(logoX + 10, logoY + 8, 6, 9);
      doc.line(logoX + 4, logoY + 17.5, logoX + 18, logoY + 17.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text(String(businessProfile?.ownerName1 || businessProfile?.ownerName || bizName).charAt(0).toUpperCase(), logoX + 11, logoY + 24, { align: 'center' });
    }

    const businessName = businessProfile?.businessName || businessProfile?.name || '';
    if (businessName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(22, 139, 80);
      const nameLines = doc.splitTextToSize(businessName.toUpperCase(), infoWidth);
      doc.text(nameLines, infoX, infoY);
      infoY += nameLines.length * 6;
    }

    const owner1Name = businessProfile?.ownerName1 || businessProfile?.ownerName;
    const owner1Phone = businessProfile?.ownerNumber1 || businessProfile?.mobileNumber;
    const owner2Name = businessProfile?.ownerName2;
    const owner2Phone = businessProfile?.ownerNumber2;
    const ownerLines = [
      [owner1Name, owner1Phone].filter(Boolean).join(' • '),
      [owner2Name, owner2Phone].filter(Boolean).join(' • ')
    ].filter(Boolean);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(11, 53, 71);
    ownerLines.forEach((line) => {
      const lines = doc.splitTextToSize(line, infoWidth);
      doc.text(lines, infoX, infoY);
      infoY += lines.length * 3.5;
    });

    const proprietor = businessProfile?.proprietorName || businessProfile?.ownerName;
    if (proprietor && proprietor !== owner1Name && proprietor !== owner2Name) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(85, 122, 152);
      const lines = doc.splitTextToSize(`Proprietor: ${proprietor}`, infoWidth);
      doc.text(lines, infoX, infoY);
      infoY += lines.length * 3.5;
    }
    const address = [businessProfile?.shopNumber || businessProfile?.shopNo, businessProfile?.address, businessProfile?.city, businessProfile?.country].filter(Boolean).join(', ');
    if (address) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(85, 122, 152);
      const lines = doc.splitTextToSize(address, infoWidth);
      doc.text(lines, infoX, infoY);
      infoY += lines.length * 3.5;
    }

    const arthiCode = businessProfile?.arthiCode;
    if (arthiCode) {
      doc.setDrawColor(8, 98, 122);
      doc.setLineWidth(0.35);
      doc.line(245, 8, 245, Math.max(27, infoY));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(85, 122, 152);
      doc.text('ARHTI CODE', 251, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(22, 139, 80);
      doc.text(String(arthiCode), 251, 22);
    }

    const dividerY = Math.max(32, infoY + 2);
    doc.setLineWidth(0.8);
    doc.setDrawColor(8, 98, 122);
    doc.line(left, dividerY, pageWidth - 22, dividerY);
    doc.setDrawColor(22, 139, 80);
    doc.line(pageWidth - 19, dividerY, pageWidth - left, dividerY);

    const titleLines = doc.splitTextToSize(reportTitle.toUpperCase(), pageWidth - 2 * left);
    const titleY = dividerY + 9;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(11, 53, 71);
    doc.text(titleLines, pageWidth / 2, titleY, { align: 'center' });
    const periodY = titleY + titleLines.length * 5 + 1;
    if (reportPeriod) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(85, 122, 152);
      doc.text(`Report Period: ${reportPeriod}`, pageWidth / 2, periodY, { align: 'center' });
    }
    const bottomLineY = periodY + (reportPeriod ? 5 : 1);
    doc.setDrawColor(197, 217, 231);
    doc.setLineWidth(0.35);
    doc.line(left, bottomLineY, pageWidth - left, bottomLineY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(85, 122, 152);
    const generated = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(`Generated: ${generated}`, left, bottomLineY + 5);
    doc.text('MandiOS Business Report', pageWidth - left, bottomLineY + 5, { align: 'right' });
    return bottomLineY + 9;
  };
  let headerBottom = drawPayrollHeader();

  if (totalAmount !== null && totalAmount !== undefined) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(11, 53, 71);
    doc.text(`Total Sum: Rs. ${Number(totalAmount).toLocaleString()}`, 14, headerBottom + 5);
    headerBottom += 7;
  }

  if (!reportData || reportData.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('No records found for the selected report filters.', 14, headerBottom + 7);
    doc.save(`${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    return;
  }

  // Extract Columns & Rows from reportData
  const headers = Object.keys(reportData[0]);
  const body = reportData.map(row => 
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '-';
      if (typeof val === 'number') {
        if (h.includes('(Rs.)') || h.includes('Basic') || h.includes('Payout') || h.includes('Amount')) {
          return `Rs. ${val.toLocaleString()}`;
        }
      }
      return String(val);
    })
  );

  autoTable(doc, {
    startY: headerBottom + 7,
    margin: { top: headerBottom + 7, bottom: 12, left: 14, right: 14 },
    head: [headers],
    body: body,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // Slate-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPayrollHeader();
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, 283, doc.internal.pageSize.height - 8, { align: 'right' });
      doc.text(`Official Computer Generated Audit Report • ${bizName}`, 14, doc.internal.pageSize.height - 8);
    }
  });

  const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

/**
 * Generates and triggers download of a PDF document for Day-Wise Purchase Report.
 */
export const downloadDayWisePurchasePDF = async ({
  customerDetails = {},
  dayWiseList = [],
  totals = {},
  filterTitle = 'All Time',
  businessProfile: suppliedBusinessProfile
}) => {
  const businessProfile = suppliedBusinessProfile || await getBusinessProfileForReport();
  const totalAmount = totals.grandTotalAmount || dayWiseList.reduce((acc, d) => acc + (d.totalAmount || 0), 0);
  const totalQty = totals.grandTotalQty || dayWiseList.reduce((acc, d) => acc + (d.totalQuantity || 0), 0);
  const totalDays = totals.grandTotalDays || dayWiseList.length;
  const tableRows = dayWiseList.map((dayData, idx) => [
    idx + 1,
    dayData.date || 'N/A',
    `${dayData.itemsCount || 0} Line(s)`,
    `${(dayData.totalQuantity || 0).toLocaleString()} Units`,
    `Rs. ${(dayData.totalAmount || 0).toLocaleString()}`
  ]);

  if (await downloadLocalizedPdf({
    title: 'DAY-WISE PURCHASE REPORT',
    subtitle: filterTitle,
    summary: [
      ['Customer', customerDetails?.name || 'Customer Account'],
      ['Phone', customerDetails?.phone || 'N/A'],
      ['City', customerDetails?.city || 'Mandi Market'],
      ['Total Days Logged', totalDays],
      ['Total Quantity', `${totalQty.toLocaleString()} Units`],
      ['Total Net Amount', `Rs. ${totalAmount.toLocaleString()}`],
    ],
    columns: ['S.No', 'Purchase Date', 'Items Purchased', 'Total Quantity', 'Total Cost Payable'],
    rows: tableRows,
    businessProfile,
  })) return;

  const doc = new jsPDF();
  const headerBottom = drawPdfReportHeader(doc, { title: 'DAY-WISE PURCHASE REPORT', period: filterTitle, businessProfile });

  // Customer Information & Summary Card
  doc.setTextColor(30, 41, 59);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, headerBottom + 2, 182, 30, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, headerBottom + 2, 182, 30, 3, 3, 'D');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Customer: ${customerDetails?.name || 'Customer Account'}`, 18, headerBottom + 10);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Phone: ${customerDetails?.phone || 'N/A'}`, 18, headerBottom + 16);
  doc.text(`City: ${customerDetails?.city || 'Mandi Market'}`, 18, headerBottom + 22);

  doc.setFont('helvetica', 'bold');
  doc.text(`Total Days Logged: ${totalDays}`, 190, headerBottom + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Total Quantity: ${totalQty.toLocaleString()} Units`, 190, headerBottom + 16, { align: 'right' });
  doc.text(`Total Net Amount: Rs. ${totalAmount.toLocaleString()}`, 190, headerBottom + 22, { align: 'right' });

  // Format table rows
  autoTable(doc, {
    startY: headerBottom + 36,
    margin: { top: headerBottom + 36, bottom: 12 },
    head: [['S.No', 'Purchase Date', 'Items Purchased', 'Total Quantity', 'Total Cost Payable']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 32, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 68, halign: 'right', fontStyle: 'bold' }
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [51, 65, 85]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPdfReportHeader(doc, { title: 'DAY-WISE PURCHASE REPORT', period: filterTitle, businessProfile });
      const pageCount = doc.internal.getNumberOfPages();
      const str = `Page ${data.pageNumber} of ${pageCount}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, 196, doc.internal.pageSize.height - 10, { align: 'right' });
      doc.text('Mandi Stock Brokerage System — Day Wise Purchase Report', 14, doc.internal.pageSize.height - 10);
    }
  });

  const cleanName = (customerDetails?.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `DayWise_Purchase_Report_${cleanName}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

/**
 * Generates and triggers download of a PDF document for a Single Day's Purchase Breakdown.
 */
export const downloadSingleDayPurchasePDF = async ({
  customerDetails = {},
  dayData = {},
  businessProfile: suppliedBusinessProfile
}) => {
  const businessProfile = suppliedBusinessProfile || await getBusinessProfileForReport();
  const purchaseRows = (dayData.items || []).map((item, idx) => [
    idx + 1,
    item.productName || 'Produce',
    item.lotNumber ? `Lot #${item.lotNumber}` : '-',
    item.quantity || 0,
    `Rs. ${(item.totalAmount || 0).toLocaleString()}`
  ]);

  if (await downloadLocalizedPdf({
    title: 'DAILY PURCHASE BREAKDOWN',
    subtitle: dayData.date || '',
    summary: [
      ['Customer', customerDetails?.name || 'Customer Account'],
      ['Phone', customerDetails?.phone || 'N/A'],
      ['City', customerDetails?.city || 'Mandi Market'],
      ['Purchase Date', dayData.date || 'N/A'],
      ['Total Items', `${dayData.itemsCount || (dayData.items || []).length} Produce Lines`],
      ['Day Net Amount', `Rs. ${(dayData.totalAmount || 0).toLocaleString()}`],
    ],
    columns: ['#', 'Product / Produce', 'Lot #', 'Qty', 'Total Cost Payable'],
    rows: purchaseRows,
    businessProfile,
  })) return;

  const doc = new jsPDF();
  const headerBottom = drawPdfReportHeader(doc, { title: 'DAILY PURCHASE BREAKDOWN', period: dayData.date || '', businessProfile });

  // Customer Information & Summary Card
  doc.setTextColor(30, 41, 59);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, headerBottom + 2, 182, 30, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, headerBottom + 2, 182, 30, 3, 3, 'D');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Customer: ${customerDetails?.name || 'Customer Account'}`, 18, headerBottom + 10);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Phone: ${customerDetails?.phone || 'N/A'}`, 18, headerBottom + 16);
  doc.text(`City: ${customerDetails?.city || 'Mandi Market'}`, 18, headerBottom + 22);

  doc.setFont('helvetica', 'bold');
  doc.text(`Purchase Date: ${dayData.date || 'N/A'}`, 190, headerBottom + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Total Items: ${dayData.itemsCount || (dayData.items || []).length} Produce Lines`, 190, headerBottom + 16, { align: 'right' });
  doc.text(`Day Net Amount: Rs. ${(dayData.totalAmount || 0).toLocaleString()}`, 190, headerBottom + 22, { align: 'right' });

  // Format table rows
  const tableRows = purchaseRows;

  autoTable(doc, {
    startY: headerBottom + 36,
    margin: { top: headerBottom + 36, bottom: 12 },
    head: [['#', 'Product / Produce', 'Lot #', 'Qty', 'Total Cost Payable']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 58 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 66, halign: 'right', fontStyle: 'bold' }
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [51, 65, 85]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPdfReportHeader(doc, { title: 'DAILY PURCHASE BREAKDOWN', period: dayData.date || '', businessProfile });
      const pageCount = doc.internal.getNumberOfPages();
      const str = `Page ${data.pageNumber} of ${pageCount}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, 196, doc.internal.pageSize.height - 10, { align: 'right' });
      doc.text(`Day Purchases Log — ${dayData.date || ''}`, 14, doc.internal.pageSize.height - 10);
    }
  });

  const cleanName = (customerDetails?.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `DayPurchase_${dayData.date}_${cleanName}.pdf`;
  doc.save(filename);
};

/**
 * Generates and triggers download of a PDF document for a Professional Lot Voucher.
 */
export const downloadLotVoucherPDF = async ({
  lot = {},
  lotSales = [],
  lotReturns = [],
  supplier = {},
  stock = {},
  businessProfile: suppliedBusinessProfile
}) => {
  const businessProfile = suppliedBusinessProfile || await getBusinessProfileForReport();
  const doc = new jsPDF();
  const activeStock = stock && Object.keys(stock).length > 0 ? stock : (lot.stock || {});
  const lotNum = lot.lotNumber || activeStock.lotNumber || 'N/A';
  const productName = lot.productName || activeStock.productName || 'General Produce';
  const supplierName = supplier.name || lot.supplier?.name || activeStock.supplierName || 'N/A';
  const supplierPhone = supplier.phone || lot.supplier?.phone || activeStock.supplierPhone || activeStock.supplier?.phone || 'N/A';
  const arrivalDate = activeStock.arrivalDate || activeStock.date || lot.arrivalDate || lot.date || 'N/A';

  const headerBottom = drawPdfReportHeader(doc, {
    title: `PROFESSIONAL CONSIGNMENT LOT VOUCHER — LOT #${lotNum}`,
    period: arrivalDate,
    businessProfile
  });

  // Lot Info Panel
  doc.setTextColor(30, 41, 59);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, headerBottom + 2, 182, 32, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, headerBottom + 2, 182, 32, 3, 3, 'D');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Beopari Name: ${supplierName}`, 18, headerBottom + 10);
  doc.text(`Commodity: ${productName}`, 18, headerBottom + 16);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Phone: ${supplierPhone}`, 18, headerBottom + 22);
  doc.text(`Arrival Date: ${arrivalDate}`, 18, headerBottom + 28);

  const arrivedQty = activeStock.totalQuantity ?? activeStock.quantity ?? lot.arrivedQty ?? 0;
  const rawSoldQty = lotSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const returnedQty = lotReturns.reduce((sum, r) => sum + (Number(r.produceReturnedQty) || 0), 0);
  const soldQty = Math.max(0, rawSoldQty - returnedQty);
  const remainingQty = activeStock.remainingQuantity ?? lot.remainingQty ?? Math.max(0, arrivedQty - soldQty);

  doc.setFont('helvetica', 'bold');
  doc.text(`Lot Number: #${lotNum}`, 190, headerBottom + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Initial Arrived Qty: ${arrivedQty} units`, 190, headerBottom + 16, { align: 'right' });
  doc.text(`Net Sold Qty: ${soldQty} units${returnedQty > 0 ? ` (${returnedQty} ret)` : ''}`, 190, headerBottom + 22, { align: 'right' });
  doc.text(`Remaining Stock: ${remainingQty} units`, 190, headerBottom + 28, { align: 'right' });

  // Format sales table
  let rawGrossSum = 0;

  const tableRows = lotSales.map((s) => {
    const qty = s.quantity || 0;
    const invNum = s.invoiceNumber || (s.id || s._id || '').substring(0, 8).toUpperCase();
    const gross = s.grossSale || (qty * (s.saleRate || 0)) || 0;
    const comm = s.commissionAmount || s.commission || 0;
    const disc = s.discount || 0;
    const net = s.netSale || s.totalAmount || (gross - comm - disc);

    rawGrossSum += gross;
    return [
      `INV-${invNum}`,
      s.date || 'N/A',
      s.customerName || s.walkInName || 'Walk-In',
      s.isWalkIn ? 'Walk-In' : 'Registered',
      qty,
      `Rs. ${(s.saleRate || 0).toLocaleString()}`,
      `Rs. ${gross.toLocaleString()}`,
      `Rs. ${comm.toLocaleString()}`,
      `Rs. ${net.toLocaleString()}`
    ];
  });

  // Append return rows if any exist
  const returnedGrossValue = lotReturns.reduce((sum, r) => sum + (Number(r.grossReturnAmount) || (Number(r.produceReturnedQty || 0) * Number(r.saleRate || 0))), 0);
  lotReturns.forEach(r => {
    const rQty = Number(r.produceReturnedQty) || 0;
    const rGross = Number(r.grossReturnAmount) || (rQty * Number(r.saleRate || 0));
    tableRows.push([
      r.returnNumber || 'RET',
      r.date || 'N/A',
      r.customerName || 'Customer Return',
      'Return',
      `-${rQty}`,
      `Rs. ${(r.saleRate || 0).toLocaleString()}`,
      `-Rs. ${rGross.toLocaleString()}`,
      '-',
      `-Rs. ${rGross.toLocaleString()}`
    ]);
  });

  const lotGrossSum = Math.max(0, Math.round((rawGrossSum - returnedGrossValue) * 100) / 100);

  autoTable(doc, {
    startY: headerBottom + 38,
    margin: { top: headerBottom + 38, bottom: 12 },
    head: [['Invoice #', 'Date', 'Buyer Name', 'Buyer Type', 'Qty', 'Rate', 'Gross Value', 'Comm.', 'Net Value']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 20 },
      2: { cellWidth: 32 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 12, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawPdfReportHeader(doc, {
        title: `PROFESSIONAL CONSIGNMENT LOT VOUCHER — LOT #${lotNum}`,
        period: arrivalDate,
        businessProfile
      });
    }
  });

  let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : 120;

  // Compute deductions for Settlement Card
  const commType = activeStock.supplierCommissionType || 'Percentage';
  const commVal = activeStock.supplierCommissionValue !== undefined ? activeStock.supplierCommissionValue : 0;
  let suppCommAmt = 0;
  if (commType === 'Percentage') suppCommAmt = lotGrossSum * (commVal / 100);
  else if (commType === 'Per Unit') suppCommAmt = soldQty * commVal;
  else if (commType === 'Fixed Amount') suppCommAmt = commVal;

  const marketFeeRate = Number(activeStock.marketFeeFixedAmount ?? activeStock.marketFeeRate ?? activeStock.marketFeePercentage ?? 0);
  let marketFeeAmt = 0;
  if (activeStock.marketFeeFixedAmount !== undefined) {
    marketFeeAmt = marketFeeRate;
  } else if (activeStock.marketFeeAmount) {
    marketFeeAmt = Number(activeStock.marketFeeAmount);
  } else if (marketFeeRate > 0) {
    marketFeeAmt = Math.round((lotGrossSum * (marketFeeRate / 100)) * 100) / 100;
  }

  let totalExpAmt = 0;
  const expObj = activeStock.lotExpenses || {};
  Object.values(expObj).forEach(v => {
    const n = Number(v);
    if (!isNaN(n) && n > 0) totalExpAmt += n;
  });

  const totalDeductions = Math.round((suppCommAmt + marketFeeAmt + totalExpAmt) * 100) / 100;
  const netPayableToSupplier = Math.round((lotGrossSum - totalDeductions) * 100) / 100;

  if (await downloadLocalizedPdf({
    title: 'PROFESSIONAL CONSIGNMENT LOT VOUCHER',
    summary: [
      ['Lot Number', lotNum],
      ['Beopari', supplierName],
      ['Product', productName],
      ['Phone', supplierPhone],
      ['Arrival Date', arrivalDate],
      ['Initial Arrived Qty', `${arrivedQty} units`],
      ['Net Sold Qty', `${soldQty} units`],
      ['Remaining Stock', `${remainingQty} units`],
      ['Gross Consignment Sales Value', `Rs. ${lotGrossSum.toLocaleString()}`],
      ['Beopari Commission', `Rs. ${Math.round(suppCommAmt).toLocaleString()}`],
      ['Market / Sarkari Fee', `Rs. ${Math.round(marketFeeAmt).toLocaleString()}`],
      ['Lot Expense Deductions', `Rs. ${totalExpAmt.toLocaleString()}`],
      ['Net Payable to Supplier', `Rs. ${netPayableToSupplier.toLocaleString()}`],
    ],
    columns: ['Invoice #', 'Date', 'Buyer Name', 'Buyer Type', 'Qty', 'Rate', 'Gross Value', 'Commission', 'Net Value'],
    rows: tableRows,
    businessProfile,
  })) return;

  if (finalY + 55 > doc.internal.pageSize.height) {
    doc.addPage();
    finalY = 20;
  }

  // Settlement Box
  const boxHeight = marketFeeAmt > 0 ? 44 : 38;
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(14, finalY, 182, boxHeight, 3, 3, 'F');
  doc.setDrawColor(99, 102, 241);
  doc.roundedRect(14, finalY, 182, boxHeight, 3, 3, 'D');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(67, 56, 202);
  doc.text('SUPPLIER SETTLEMENT & DEDUCTIONS BREAKDOWN', 18, finalY + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text('Gross Consignment Sales Value:', 18, finalY + 14);
  doc.text(`Rs. ${lotGrossSum.toLocaleString()}`, 190, finalY + 14, { align: 'right' });

  doc.text(`Beopari Commission (${commVal} ${commType}):`, 18, finalY + 19);
  doc.setTextColor(220, 38, 38);
  doc.text(`- Rs. ${Math.round(suppCommAmt).toLocaleString()}`, 190, finalY + 19, { align: 'right' });

  let curY = finalY + 19;
  if (marketFeeAmt > 0) {
    curY += 5;
    doc.setTextColor(30, 41, 59);
    doc.text('Market / Sarkari Fee:', 18, curY);
    doc.setTextColor(220, 38, 38);
    doc.text(`- Rs. ${Math.round(marketFeeAmt).toLocaleString()}`, 190, curY, { align: 'right' });
  }

  if (totalExpAmt > 0) {
    curY += 5;
    doc.setTextColor(30, 41, 59);
    doc.text('Lot Expense Deductions:', 18, curY);
    doc.setTextColor(220, 38, 38);
    doc.text(`- Rs. ${totalExpAmt.toLocaleString()}`, 190, curY, { align: 'right' });
  }

  curY += 6;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text('NET PAYABLE TO SUPPLIER:', 18, curY);
  doc.setTextColor(5, 150, 105);
  doc.text(`Rs. ${netPayableToSupplier.toLocaleString()}`, 190, curY, { align: 'right' });

  // Signatures
  const sigY = finalY + 52;
  if (sigY + 20 < doc.internal.pageSize.height) {
    doc.setDrawColor(148, 163, 184);
    doc.line(20, sigY, 70, sigY);
    doc.line(140, sigY, 190, sigY);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Mandi Clerk Verification', 45, sigY + 5, { align: 'center' });
    doc.text('Authorized Manager Stamp', 165, sigY + 5, { align: 'center' });
  }

  const filename = `Professional_Lot_Voucher_Lot_${lotNum}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};
