import { jsPDF } from 'jspdf';
import { buildPrintReportHeaderHtml, PRINT_REPORT_HEADER_STYLES } from '../components/common/PrintReportHeader.jsx';
import { escapeHtml, openSafePrintWindow } from './safePrint.js';
import urduFontUrl from '../assets/fonts/NotoNastaliqUrdu-wght.ttf?url';

// A4 landscape at 96 CSS pixels/inch. Print and PDF use these exact pages.
const WIDTH = 1122;
const HEIGHT = 793;
const styles = `
${PRINT_REPORT_HEADER_STYLES}
@page { size: A4 landscape; margin: 0; }
.ot-page { width:${WIDTH}px; height:${HEIGHT}px; padding:30px; box-sizing:border-box; position:relative; background:white; color:#172b3a; font:11px/1.35 Arial,sans-serif; break-after:page; page-break-after:always; }
.ot-page:last-child { break-after:auto; page-break-after:auto; }
.ot-page[dir=rtl] { font-family:"Noto Nastaliq Urdu",serif; line-height:1.8; }
.ot-page * { box-sizing:border-box; }
.ot-page .mandios-print-header { margin:0 0 8px; }
.ot-page .mandios-print-header-top { min-height:58px; }
.ot-page .mandios-print-header-business { grid-template-columns:55px 1fr; }
.ot-page .mandios-print-header-logo { width:55px; height:50px; }
.ot-page .mandios-print-header-name { font-size:18px; }
.ot-page .mandios-print-header-code { min-height:48px; margin:0; }
.ot-page .mandios-print-header-title { font-size:17px; }
.ot-page .mandios-print-header-period { font-size:11px; }
.ot-page .mandios-print-header-report { padding:0 0 5px; }
.ot-page .mandios-print-header-metrics { grid-auto-flow:row; grid-template-columns:repeat(3,1fr); margin-top:5px; gap:4px; }
.ot-page .mandios-print-header-metric { font-size:11px; padding:4px; }
.ot-page h2 { font-size:13px; margin:6px 0; }
.ot-page .ot-note { font-size:9px; margin:4px 0 8px; }
.ot-page table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:10px; direction:inherit; }
.ot-page th, .ot-page td { border:1px solid #cad5df; padding:5px 4px !important; vertical-align:top; overflow-wrap:anywhere; text-align:start; }
.ot-page th { background:#e7eef3; font-weight:bold; }
.ot-page .ot-number { text-align:right; direction:ltr; unicode-bidi:isolate; font-family:Arial,sans-serif; }
.ot-page tr:nth-child(even) { background:#f6f8fa; }
.ot-page .ot-total { font-weight:bold; background:#e7eef3; }
.ot-page .ot-page-number { direction:ltr; unicode-bidi:isolate; }
.ot-page .ot-footer { position:absolute; bottom:14px; left:30px; right:30px; border-top:1px solid #cad5df; padding-top:4px; display:flex; justify-content:space-between; font:9px Arial,sans-serif; }
@media print { * { print-color-adjust:exact; -webkit-print-color-adjust:exact; } .ot-page { width:297mm; height:210mm; } }
`;

const waitForImages = async root => {
  await Promise.all([...root.querySelectorAll('img')].map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
    img.onload = resolve; img.onerror = resolve;
    setTimeout(resolve, 5000);
  })));
};

export async function renderOwnTradingPages(model, profile, language = 'en') {
  const root = document.createElement('div');
  root.dataset.ownTradingOutput = 'true';
  root.id = `own-trading-output-${Date.now()}`;
  root.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-1;';
  root.innerHTML = `<style>@font-face { font-family:"Noto Nastaliq Urdu"; src:url("${urduFontUrl}") format("truetype"); }</style><style>${styles}</style>`;
  document.body.appendChild(root);
  const pages = [];
  const direction = language === 'ur' ? 'rtl' : 'ltr';
  const makePage = async (section, first) => {
    const page = document.createElement('section');
    page.className = 'ot-page'; page.dir = direction; page.lang = language;
    page.innerHTML = `<div class="ot-content">${buildPrintReportHeaderHtml({ title: model.title, period: model.period, profile,
      filters: model.filters, generatedAt: model.generatedAt, summaryMetrics: first ? model.summary : [], includeStyles: false })}
      ${first ? `<p class="ot-note">${escapeHtml(model.note)}</p>` : ''}<h2>${escapeHtml(section.title)}</h2>
      <table><thead><tr>${section.columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody></tbody></table></div><div class="ot-footer"><span>${escapeHtml(model.title)} · ${escapeHtml(section.title)}</span><span class="ot-page-number"></span></div>`;
    page.dataset.outputPage = String(pages.length);
    root.appendChild(page); pages.push(page);
    await document.fonts?.load('11px "Noto Nastaliq Urdu"');
    await document.fonts?.ready;
    await waitForImages(page);
    return page;
  };
  const fits = page => page.querySelector('.ot-content').getBoundingClientRect().bottom <= page.querySelector('.ot-footer').getBoundingClientRect().top - 7;
  try {
    for (const section of model.sections) {
      let page = await makePage(section, pages.length === 0);
      for (const [index, cells] of [...section.rows, section.totals].entries()) {
        const row = document.createElement('tr');
        if (index === section.rows.length) row.className = 'ot-total';
        row.innerHTML = cells.map((cell, i) => `<td class="${section.columns[i].format ? 'ot-number' : ''}">${escapeHtml(cell)}</td>`).join('');
        page.querySelector('tbody').appendChild(row);
        if (!fits(page)) {
          row.remove();
          page = await makePage(section, false);
          page.querySelector('tbody').appendChild(row);
          if (!fits(page)) throw new Error('A report row is too tall for a landscape page. Shorten unusually long record text before exporting.');
        }
      }
    }
    pages.forEach((page, index) => { page.querySelector('.ot-page-number').textContent = `${index + 1} / ${pages.length}`; });
    return { root, pages, html: `<html><head><style>${styles}</style></head><body style="margin:0;padding:0;background:white">${pages.map(page => page.outerHTML).join('')}</body></html>` };
  } catch (error) { root.remove(); throw error; }
}

export async function outputOwnTradingReport({ model, profile, mode, printWindow, language }) {
  const rendered = await renderOwnTradingPages(model, profile, language);
  try {
    if (mode === 'print') {
      const target = openSafePrintWindow(model.title, rendered.html, 'width=1200,height=850', printWindow);
      if (!target) throw new Error('Allow popups to print the report.');
      await target.document.fonts?.ready;
      await waitForImages(target.document);
      target.focus(); target.print();
    } else {
      const { default: html2canvas } = await import('html2canvas');
      const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm' });
      // Keep the source page at the origin before cloning. Moving only the clone
      // leaves later headers outside html2canvas's original capture viewport.
      rendered.pages.forEach(page => page.remove());
      for (const [index, page] of rendered.pages.entries()) {
        rendered.root.appendChild(page);
        await waitForImages(page);
        const canvas = await html2canvas(page, { scale: 2, width: WIDTH, height: HEIGHT, windowWidth: WIDTH, windowHeight: HEIGHT, scrollX: 0, scrollY: 0, backgroundColor: '#ffffff', useCORS: true,
          onclone: cloned => {
            const root = cloned.getElementById(rendered.root.id);
            if (!root) return;
            root.style.cssText = 'position:absolute;left:0;top:0;opacity:1;z-index:2147483647;';
          } });
        if (index) doc.addPage('a4', 'landscape');
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210, undefined, 'FAST');
        page.remove();
      }
      doc.save(`own-trading_${String(model.generatedAt || '').slice(0, 10)}.pdf`);
    }
  } finally { rendered.root.remove(); }
}
