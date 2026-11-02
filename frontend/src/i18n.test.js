import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from './locales/en/translation.json' with { type: 'json' };
import ur from './locales/ur/translation.json' with { type: 'json' };
import i18n, { applyDocumentLanguage, getLanguageDirection } from './i18n.js';
import { REPORTS_CONFIG, REPORTS_SECTIONS } from './config/reportsConfig.js';

test('shared interface translation resources cover the same keys', () => {
  assert.deepEqual(Object.keys(ur).sort(), Object.keys(en).sort());
});

test('static translation calls in application components have Urdu entries', () => {
  const componentsRoot = join(dirname(fileURLToPath(import.meta.url)), 'components');
  const visit = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'superAdmin' ? [] : visit(path);
    if (entry.name === 'SuperAdminDashboard.jsx') return [];
    return entry.name.endsWith('.jsx') ? [path] : [];
  });
  const missing = [];

  for (const path of visit(componentsRoot)) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*(['"])(.*?)\1\s*[,)]/g)) {
      if (!(match[2] in ur)) missing.push(`${path}: ${match[2]}`);
    }
  }

  assert.deepEqual(missing, []);
});

test('report metadata, table labels, filters, and data sources have Urdu entries', () => {
  const values = new Set();
  for (const report of Object.values(REPORTS_CONFIG)) {
    for (const key of ['name', 'description', 'purpose', 'tier', 'section', 'calculationLogic']) {
      if (report[key]) values.add(report[key]);
    }
    for (const column of report.columns || []) values.add(column.label);
    for (const filter of report.availableFilters || []) {
      values.add(filter.label);
      for (const option of filter.options || []) values.add(option);
    }
    for (const source of report.dataSources || []) values.add(source);
  }
  for (const section of REPORTS_SECTIONS) {
    values.add(section.title);
    values.add(section.tier);
    values.add(section.description);
  }

  const missing = [...values].filter(value => !(value in ur));
  assert.deepEqual(missing, []);
});

test('language switching resolves shared labels in English and Urdu', async () => {
  await i18n.changeLanguage('en');
  assert.equal(i18n.t('Dashboard'), 'Dashboard');
  assert.equal(i18n.t('Start Boli Session'), 'Start Boli Session');
  assert.equal(i18n.t('Lot Wise Consignment Reports'), 'Lot Wise Consignment Reports');
  assert.equal(i18n.t('Confirm & Record Sale'), 'Confirm & Record Sale');
  assert.equal(i18n.t('Professional Consignment Lot Voucher'), 'Professional Consignment Lot Voucher');
  assert.equal(i18n.t('Customer Portfolio Ledger'), 'Customer Portfolio Ledger');
  assert.equal(i18n.t('Opening Till'), 'Opening Till');
  assert.equal(
    i18n.t('Crate Sales Breakdown ({{count}} Transactions)', { count: 3 }),
    'Crate Sales Breakdown (3 Transactions)'
  );

  await i18n.changeLanguage('ur');
  assert.equal(i18n.t('Dashboard'), 'ڈیش بورڈ');
  assert.equal(i18n.t('Bardana'), 'باردانہ');
  assert.equal(i18n.t('Start Boli Session'), 'بولی کا سیشن شروع کریں');
  assert.equal(i18n.t('Lot Wise Consignment Reports'), 'لاٹ کے حساب سے سپرد کردہ مال کی رپورٹس');
  assert.equal(i18n.t('Confirm & Record Sale'), 'تصدیق کریں اور فروخت درج کریں');
  assert.equal(i18n.t('Fast Retail'), 'نقد فروخت');
  assert.equal(i18n.t('Active Trading'), 'کاروبار جاری ہے');
  assert.equal(i18n.t('Professional Consignment Lot Voucher'), 'لاٹ کی باقاعدہ رسید');
  assert.equal(i18n.t('Reports Hub'), 'رپورٹس کا مرکزی صفحہ');
  assert.equal(i18n.t('Customer Portfolio Ledger'), 'گاہکوں کا مجموعی کھاتہ');
  assert.equal(i18n.t('Print Ledger'), 'کھاتہ پرنٹ کریں');
  assert.equal(i18n.t('Opening Till'), 'ابتدائی نقد رقم');
  assert.equal(i18n.t('MANDI OS — DAILY ROZNAMCHA / DAY BOOK REPORT'), 'MandiOS — روزنامچہ رپورٹ');
  assert.equal(
    i18n.t('Allow pop-up windows to print this Urdu report or save it as PDF.'),
    'اردو رپورٹ پرنٹ کرنے یا PDF کے طور پر محفوظ کرنے کے لیے پاپ اپ ونڈوز کی اجازت دیں۔'
  );
  assert.equal(
    i18n.t('Crate Sales Breakdown ({{count}} Transactions)', { count: 3 }),
    'کریٹوں کی فروخت کی تفصیل (3 لین دین)'
  );
  assert.equal(i18n.t('Sales entries recorded', { count: 2 }), '2 فروخت کے اندراجات محفوظ ہیں');
  assert.equal(i18n.t('Fully Sold (Pending Settlement)'), 'مکمل فروخت (تصفیہ زیرِ التوا)');
  assert.equal(i18n.t('Gross Sales Revenue'), 'فروخت کی مجموعی آمدن');
  assert.equal(i18n.t('Approve Return?'), 'واپسی منظور کریں؟');
  assert.equal(
    i18n.t('Are you sure you want to delete Return #{{number}}?', { number: 'R-102' }),
    'کیا آپ واقعی واپسی نمبر R-102 حذف کرنا چاہتے ہیں؟'
  );
  assert.equal(
    i18n.t('Vehicle status updated to {{status}}', { status: i18n.t('Arrived') }),
    'گاڑی کی حالت اب پہنچ گئی ہے'
  );
});

test('document language direction follows the selected locale', () => {
  const documentRef = {
    documentElement: {},
    body: {},
  };

  assert.equal(getLanguageDirection('en'), 'ltr');
  assert.equal(getLanguageDirection('ur'), 'rtl');

  applyDocumentLanguage('ur', documentRef);
  assert.deepEqual(documentRef.documentElement, { lang: 'ur', dir: 'rtl' });
  assert.deepEqual(documentRef.body, { lang: 'ur', dir: 'rtl' });

  applyDocumentLanguage('en', documentRef);
  assert.deepEqual(documentRef.documentElement, { lang: 'en', dir: 'ltr' });
  assert.deepEqual(documentRef.body, { lang: 'en', dir: 'ltr' });
});

test('Urdu font asset is a valid font and includes its redistribution license', () => {
  const sourceRoot = dirname(fileURLToPath(import.meta.url));
  const font = readFileSync(join(sourceRoot, 'assets', 'fonts', 'NotoNastaliqUrdu-wght.ttf'));
  const license = readFileSync(join(sourceRoot, '..', 'public', 'fonts', 'OFL-NotoNastaliqUrdu.txt'), 'utf8');

  assert.equal(font.readUInt32BE(0), 0x00010000);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
});
