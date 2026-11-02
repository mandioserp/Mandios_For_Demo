# Own Trading report and purchase editing

## Changes
- AdminDashboard.jsx and ClerkDashboard.jsx route Own Trading lot edits to OwnTradingPurchases.jsx instead of the stock-arrival modal. The existing unrelated AdminDashboard changes were preserved.
- OwnTradingPurchases.jsx preloads the entire multi-supplier purchase using utils/ownTradingForm.js and saves through PUT /own-trading-purchases/:id. Existing lot IDs and payments are preserved.
- ownTradingController.js updates the purchase, linked lots, product quantities, supplier balances, adjustment ledger entries and audit log in one MongoDB transaction. ownTradingEdit.js validates stale edits, ownership of submitted lot identities, payment constraints and movement restrictions.
- reportController.js dispatches Own Trading before loading unrelated report datasets. ownTradingReportData.js validates filters, scopes every query to the selected tenant and queries only matching purchases and their linked transactions. Existing report role restrictions remain in effect.
- ownTrading.js reuses the established costing method and allocates supplier payments cumulatively to avoid rounding discrepancies. Reports show product-lot rows, sale and payment statuses, combined filters and transaction details.
- ReportDetailPage.jsx, OwnTradingLotDetails.jsx and reportsConfig.js provide date-basis selection, all-date defaults, linked purchase/sales/return/payment details, print headers and CSV/PDF summaries, filters and totals. Mixed-unit quantities are not totaled.
- Supporting tenant/lot/purchase indexes were added in models/index.js and returnModel.js.

## Calculation rules
Purchase quantity × original purchase rate gives merchandise cost. Recorded transport/loading/unloading/other purchase expenses are allocated by merchandise value using the existing purchase normalizer. Recorded landed unit cost values sold and remaining quantities. Actual sales less approved return credits give revenue; net sold quantity × landed unit cost gives realized sold cost. Gross trading profit is realized revenue less sold cost; net trading profit also deducts damaged/spoiled return cost. Payments reduce supplier liability and are never deducted as expenses.

The purchase-date mode selects purchases and includes all their linked activity. Purchase-or-activity mode also includes older purchases with sales, approved returns or payments in the selected period. Both modes show lifetime/current balances for the selected purchases, not period-only income or historical as-of balances.

## Existing model limitations and edit rules
Supplier payments belong to a supplier within a purchase, not an individual product lot. Lot-level payments/payables therefore use explicitly disclosed proportional allocations; detail payments display the complete supplier share of that purchase. Only recorded purchase expenses and approved returns can be attributed reliably; unrelated business expenses and unrecorded movements are not invented. The existing rounded landed unit cost can introduce small valuation differences versus total landed cost; this implementation preserves the accounting convention.

Edits preserve purchase date/reference, supplier/product/unit identities, original advances, and existing line structure. Quantity/rate/expense corrections are allowed before sales, returns or stock adjustments; after these transactions only metadata can change. Use Payments for payment corrections. A stale form must be reopened. These constraints prevent rewriting recorded sale cost or duplicating transactions.

## Validation
- node --test server/utils/ownTrading.test.js server/utils/ownTradingEdit.test.js server/utils/ownTradingReportData.test.js: 25 passing tests.
- npm run build: successful frontend and server bundles; existing large-chunk advisory remains.
- Tested multi-product/supplier preload, preserved lot identities, recalculation, partial/full payments, stale edits, movement restrictions, invalid/injected filters, combined filters, partial/multiple/full sales, allocation rounding, activity-date selection, query tenant scoping and foreign-lot rejection.
- Read-only reconciliation against configured MongoDB was attempted without application startup/index creation; connection failed with MongooseServerSelectionError. No live transactions were changed. Live record reconciliation and browser/physical print verification remain unverified.

## Landscape output correction
Print Report and Export PDF now use the same measured A4 landscape pages, with separate purchase/stock, realized-profit, and balance sections. All 30 configured columns are retained, with repeating lot identifiers and headers; each financial column is totaled only in its section. Six summary cards, applied filter names, date basis, business header/logo and page numbers are included. The PDF embeds the rendered pages at double resolution to preserve Urdu shaping and match the printed layout. Footer totals now include wastage cost and customer recoveries/receivables.

Validation: 16 focused report/output tests passed; browser fixture checks retained 138 rows (45 lots in each of three sections plus three totals) across 15 landscape pages with zero overflow. A three-lot Urdu fixture generated three pages with zero overflow. The exported three-page Urdu PDF measured 841.89 × 595.28 points on every page (A4 landscape). Visual inspection identified a remaining last-page header capture issue. The final correction detaches all pages and captures each source page alone at the origin before cloning, preserving RTL page numbering. Browser tools were unavailable for a fresh visual export after that final correction. All 28 purchase/report/output tests and targeted lint passed. These checks use synthetic records; they do not establish live database reconciliation or physical-printer behavior.

