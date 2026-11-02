import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { useLanguage } from '../../context/LanguageContext.jsx';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const clean = (value) => typeof value === 'string' ? value.trim() : value;

export const PRINT_REPORT_HEADER_STYLES = `
  .mandios-print-header { color:#0B3547; background:#fff; font-family:Arial,Helvetica,sans-serif; margin:0 0 12px; page-break-inside:avoid; break-inside:avoid; }
  .mandios-print-header * { box-sizing:border-box; }
  .mandios-print-header-top { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:start; gap:16px; min-height:88px; }
  .mandios-print-header-business { display:grid; grid-template-columns:76px minmax(0,1fr); align-items:start; gap:12px; min-width:0; }
  .mandios-print-header-logo { width:76px; height:68px; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:10px; background:#F0F5F1; color:#168B50; }
  .mandios-print-header-logo img { width:100%; height:100%; padding:5px; object-fit:contain; }
  .mandios-print-header-fallback { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0; font-size:22px; font-weight:700; line-height:1; }
  .mandios-print-header-fallback svg { width:28px; height:24px; }
  .mandios-print-header-fallback span { font-size:11px; }
  .mandios-print-header-info { min-width:0; overflow-wrap:anywhere; }
  .mandios-print-header-name { margin:0; color:#168B50; font-size:23px; line-height:1.15; font-weight:800; text-transform:uppercase; overflow-wrap:anywhere; }
  .mandios-print-header-owner { margin-top:3px; color:#0B3547; font-size:11px; line-height:1.45; font-weight:600; }
  .mandios-print-header-proprietor,.mandios-print-header-address { margin-top:3px; color:#557A98; font-size:11px; line-height:1.4; overflow-wrap:anywhere; }
  .mandios-print-header-code { min-width:130px; max-width:180px; min-height:68px; margin-top:7px; padding:5px 0 5px 18px; border-left:1px solid #08627A; color:#557A98; text-align:left; overflow-wrap:anywhere; }
  .mandios-print-header-code-label { margin:0 0 2px; font-size:10px; line-height:1.2; letter-spacing:.04em; }
  .mandios-print-header-code-value { margin:0; color:#168B50; font-size:23px; line-height:1.15; font-weight:800; }
  .mandios-print-header-divider { display:grid; grid-template-columns:minmax(0,1fr) 42px; gap:4px; margin:8px 0 10px; height:3px; }
  .mandios-print-header-divider span:first-child { background:#08627A; }
  .mandios-print-header-divider span:last-child { background:#168B50; }
  .mandios-print-header-report { text-align:center; padding:0 0 10px; }
  .mandios-print-header-title { margin:0; color:#0B3547; font-size:21px; line-height:1.25; font-weight:800; overflow-wrap:anywhere; }
  .mandios-print-header-period { margin:3px 0 0; color:#557A98; font-size:14px; line-height:1.35; }
  .mandios-print-header-context { margin:4px 0 0; color:#557A98; font-size:10px; line-height:1.4; }
  .mandios-print-header-context span { margin:0 5px; }
  .mandios-print-header-bottom { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; border-top:1px solid #C5D9E7; padding-top:8px; color:#557A98; font-size:10px; line-height:1.4; }
  .mandios-print-header-footer { text-align:right; }
  .mandios-print-header-metrics { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:6px; margin-top:8px; padding-top:7px; border-top:1px dashed #C5D9E7; text-align:center; }
  .mandios-print-header-metric { padding:4px; border:1px solid #E2EBF1; color:#0B3547; font-size:10px; }
  .mandios-print-header-metric-label { display:block; color:#557A98; font-size:8px; font-weight:600; text-transform:uppercase; }
  @media print { .mandios-print-header { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  @media (max-width:600px) { .mandios-print-header-top { grid-template-columns:minmax(0,1fr) auto; gap:8px; } .mandios-print-header-business { grid-template-columns:54px minmax(0,1fr); gap:8px; } .mandios-print-header-logo { width:54px; height:54px; } .mandios-print-header-name { font-size:18px; } .mandios-print-header-code { min-width:95px; padding-left:9px; } .mandios-print-header-code-value { font-size:18px; } }
`;

export function buildPrintReportHeaderHtml({
  title,
  period,
  dateRange,
  subtitle,
  filters = [],
  summaryMetrics = [],
  profile = null,
  generatedAt = new Date(),
  labels = {},
  includeStyles = true
}) {
  const name = clean(profile?.businessName || profile?.name);
  const owner1Name = clean(profile?.ownerName1 || profile?.ownerName);
  const owner1Phone = clean(profile?.ownerNumber1 || profile?.mobileNumber);
  const owner2Name = clean(profile?.ownerName2);
  const owner2Phone = clean(profile?.ownerNumber2);
  const proprietorName = clean(profile?.proprietorName || profile?.ownerName);
  const proprietor = proprietorName && proprietorName !== owner1Name && proprietorName !== owner2Name
    ? proprietorName : '';
  const address = [profile?.shopNumber || profile?.shopNo, profile?.address, profile?.city, profile?.country]
    .map(clean).filter(Boolean).join(', ');
  const arthiCode = clean(profile?.arthiCode);
  const locale = labels.locale || 'en-GB';
  const generatedDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const generated = Number.isNaN(generatedDate.getTime()) ? '' : generatedDate.toLocaleDateString(locale, {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  const ownerLines = [
    owner1Name || owner1Phone ? [owner1Name, owner1Phone].filter(Boolean).map(esc).join(' &nbsp; • &nbsp; ') : '',
    owner2Name || owner2Phone ? [owner2Name, owner2Phone].filter(Boolean).map(esc).join(' &nbsp; • &nbsp; ') : ''
  ].filter(Boolean);
  const context = [
    dateRange ? `${esc(labels.date || 'Date')}: ${esc(dateRange)}` : '',
    subtitle ? esc(subtitle) : '',
    ...filters.filter((filter) => filter && filter.value !== undefined && filter.value !== null && filter.value !== '')
      .map((filter) => `${esc(filter.label)}: ${esc(filter.value)}`)
  ].filter(Boolean).join('<span>•</span>');
  const metrics = summaryMetrics.length ? `<div class="mandios-print-header-metrics">${summaryMetrics.map((metric) => `
    <div class="mandios-print-header-metric"><span class="mandios-print-header-metric-label">${esc(metric.label)}</span>${esc(metric.value)}</div>
  `).join('')}</div>` : '';
  const logo = profile?.logo
    ? `<img src="${esc(profile.logo)}" alt="${esc(labels.logo || 'Business logo')}" />`
    : `<div class="mandios-print-header-fallback" aria-label="${esc(labels.logoFallback || 'Business mark')}"><svg viewBox="0 0 32 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 25V8h9v17M13 13h7v12M20 17h8v8M2 26h28M7 12h3m-3 4h3m-3 4h3m14 0h2"/></svg><span>${esc((owner1Name || name || '').charAt(0).toUpperCase())}</span></div>`;

  return `${includeStyles ? `<style>${PRINT_REPORT_HEADER_STYLES}</style>` : ''}
    <section class="mandios-print-header" aria-label="${esc(labels.reportHeader || 'Report header')}">
      <div class="mandios-print-header-top">
        <div class="mandios-print-header-business">
          <div class="mandios-print-header-logo">${logo}</div>
          <div class="mandios-print-header-info">
            ${name ? `<h1 class="mandios-print-header-name">${esc(name)}</h1>` : ''}
            ${ownerLines.map((line) => `<div class="mandios-print-header-owner">${line}</div>`).join('')}
            ${proprietor ? `<div class="mandios-print-header-proprietor"><strong>${esc(labels.proprietor || 'Proprietor')}:</strong> ${esc(proprietor)}</div>` : ''}
            ${address ? `<div class="mandios-print-header-address">${esc(address)}</div>` : ''}
          </div>
        </div>
        ${arthiCode ? `<div class="mandios-print-header-code"><p class="mandios-print-header-code-label">${esc(labels.arthiCode || 'ARHTI CODE')}</p><p class="mandios-print-header-code-value" dir="ltr">${esc(arthiCode)}</p></div>` : ''}
      </div>
      <div class="mandios-print-header-divider" aria-hidden="true"><span></span><span></span></div>
      <div class="mandios-print-header-report">
        <h2 class="mandios-print-header-title">${esc(title || '')}</h2>
        ${period ? `<p class="mandios-print-header-period">${esc(labels.period || 'Report Period')}: ${esc(period)}</p>` : ''}
        ${context ? `<div class="mandios-print-header-context">${context}</div>` : ''}
      </div>
      <div class="mandios-print-header-bottom"><div>${esc(labels.generated || 'Generated')}: ${esc(generated)}</div><div class="mandios-print-header-footer">${esc(labels.footer || 'MandiOS Business Report')}</div></div>
      ${metrics}
    </section>`;
}

export default function PrintReportHeader({
  title,
  subtitle,
  period,
  dateRange,
  filters = [],
  summaryMetrics = [],
  businessProfile: initialProfile = null,
  className = ''
}) {
  const { t, language } = useLanguage();
  const [fetchedProfile, setFetchedProfile] = useState(null);
  const profile = initialProfile || fetchedProfile;

  useEffect(() => {
    if (initialProfile) return undefined;
    let isMounted = true;
    api.get('/settings/business')
      .then((res) => {
        if (isMounted && res.data) setFetchedProfile(res.data);
      })
      .catch(() => {
        // Keep optional business details blank when settings cannot be loaded.
      });
    return () => { isMounted = false; };
  }, [initialProfile]);

  const labels = {
    arthiCode: t('ARHTI CODE'),
    date: t('Date'),
    generated: t('Generated'),
    footer: t('MandiOS Business Report'),
    logo: t('Business logo'),
    logoFallback: t('Business mark'),
    period: t('Report Period'),
    proprietor: t('Proprietor'),
    reportHeader: t('Report header'),
    locale: language === 'ur' ? 'ur-PK' : 'en-GB'
  };
  const html = buildPrintReportHeaderHtml({
    title: t(title || ''),
    subtitle: subtitle ? t(subtitle) : '',
    period,
    dateRange,
    filters: filters.map((filter) => ({ ...filter, label: t(filter.label), value: filter.value })),
    summaryMetrics: summaryMetrics.map((metric) => ({ ...metric, label: t(metric.label) })),
    profile,
    labels
  });

  return <div className={`hidden print:block ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
