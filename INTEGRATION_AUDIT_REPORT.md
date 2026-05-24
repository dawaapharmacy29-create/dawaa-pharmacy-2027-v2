# Dawaa Pharmacy 2027 Integration Audit Report

Date: 2026-05-24

## Canonical Source Rules Applied

- Customer sales metrics: `sales_invoices` only.
- Customer basic data: `customers`.
- Customer notes and flags: `customers.team_notes`, `customers.handling_notes`, `customers.customer_flags`.
- Followups: `daily_followups`; `customer_followups` should be added through a unified adapter if enabled later.
- Customer requests: `customer_requests`, `customer_request_events`.
- Points, rewards, penalties: `employee_transactions` only.
- Conversation reviews: `conversation_sales_reviews`.
- Stagnant medicines: `stagnant_medicines`, `stagnant_medicine_dispenses`.
- Incentive medicines: `incentive_medicines`.

## Helpers Added Or Updated

- `src/lib/customerMetrics.ts`: customer matching and metrics from `sales_invoices`.
- `src/lib/salesInvoiceSource.ts`: normalized invoice source and customer/staff sales metrics.
- `src/lib/pointsLedger.ts`: official ledger calculations plus display formatters that hide UUIDs, RULE/CMP codes, raw metadata, and duplicated technical text.
- `src/lib/dataSources.ts`: canonical source map.
- `src/lib/staffMetrics.ts`: staff metrics adapter from canonical sources.
- `src/lib/dashboardMetrics.ts`: dashboard metrics adapter from canonical sources.
- `src/lib/customerTimeline.ts`: unified customer timeline scaffold.
- `src/lib/branchMetrics.ts`: branch metrics from invoices and operational rows.

## Page-by-Page Audit

| Page | Reads | Writes | Status / Fix |
|---|---|---|---|
| `/` Executive Dashboard 2027 | `sales_invoices`, `customers`, `daily_followups`, `customer_requests`, `employee_transactions`, operations tables | none | Uses canonical sales source. Added visible 26-to-25 date filters and operations priority cards. |
| `/dashboard-classic` | `sales_invoices` | none | Kept as archive/classic. Hidden from main navigation except archive group. |
| `/customers` | `customers`, `sales_invoices`, `daily_followups` | `customers` | Fixed stale sales bug. No longer uses `customer_analysis` as primary source. Notes/flags save to `customers`. |
| Customer 360 | `sales_invoices`, `daily_followups`, `customers` | `customers` | Sales values now zero when no matching invoices exist. Save toast waits for Supabase success. |
| `/customer-service` | `daily_followups`, customer helpers | `daily_followups` | Followup generation now uses `customers + sales_invoices`, not `customer_analysis`. |
| `/customer-requests` | `customer_requests`, `customer_request_events` | same | Uses canonical request tables. Migration adds missing workflow/source fields. |
| `/analytics` | `sales_invoices` | none | Canonical invoice source. |
| `/import-invoices` | `sales_invoices`, import logs | `sales_invoices`, optional `customer_analysis` refresh/cache | Delete flow deletes invoice rows and cached analysis. Visible metrics elsewhere no longer depend on cache. |
| `/staff/:id` | `sales_invoices`, `daily_followups`, `employee_transactions`, `conversation_sales_reviews`, medicine tables | none | Uses canonical tables; point reasons cleaned through ledger helper in visible list. |
| `/penalty-incentive` | `employee_transactions`, `staff` | `employee_transactions` | Fixed raw reason/executor display. Rows show clean reason, executor, source, type, status; details modal hides technical metadata. |
| `/points` | `employee_transactions`, `staff`, `evaluation_rules` | `employee_transactions` | Raw `reason`/`created_by` display cleaned through `pointsLedger`. |
| `/conversation-reviews` | `conversation_sales_reviews` | same, `employee_transactions` through points persistence | Canonical review source. |
| `/whatsapp-analytics` | `conversation_sales_reviews`, `sales_invoices`, `employee_transactions` | none | Canonical WhatsApp source with invoice enrichment. |
| `/stagnant-medicines` | `stagnant_medicines`, `stagnant_medicine_dispenses`, `customers`, `sales_invoices` | stagnant tables, `employee_transactions` | Removed `customer_analysis` from customer search/list. |
| `/incentive-medicines` | `incentive_medicines` | `incentive_medicines`, `employee_transactions` | Canonical incentive source. |
| `/delivery` | `sales_invoices`, delivery issue tables if present | delivery issue records | Sales from invoices; no fake delivery metrics. |
| `/stories-offers` | `offers`, `whatsapp_stories` | same | Real Supabase module page with empty/error states. |
| `/supplies` | `supplies_items` | same | Real Supabase module page with empty/error states. |
| `/accessories` | `accessory_items` | same | Real Supabase module page with empty/error states. |
| `/shortages` | `shortage_items` | same | Real Supabase module page with empty/error states. |
| `/inventory-counts` | `inventory_count_sessions` | same | Real Supabase module page with empty/error states. |
| `/shelf-organization` | `shelf_tasks` | same | Real Supabase module page with empty/error states. |
| `/branch-cleaning` | `branch_cleaning_tasks` | same | Real Supabase module page with empty/error states. |
| `/training` | `training_modules` | same | Real Supabase module page with empty/error states. |
| `/manager-performance` | `manager_role_assignments`, `manager_performance_reviews` | pending page-level UI | Migration added tables; full UI integration remains a next step. |

## Stale Dependencies Removed

- Active Customers API no longer loads `customer_analysis` as the primary customer list.
- Customer 360 sales metrics no longer use cached customer fields.
- Daily smart followup generation no longer loads customers from `customer_analysis`.
- Stagnant medicine customer selector no longer reads `customer_analysis`.
- Notification feed no longer builds customer risk alert from `customer_analysis`.

Remaining `customer_analysis` references are limited to invoice import/cache rebuilding and invoice delete cleanup.

## Raw UI Text Cleaned

- `PenaltyIncentiveManagement` no longer displays raw `reason` or `created_by`.
- `Points`, `StaffDashboard`, `Team`, and `StaffDetail` now use `getTransactionShortReason`.
- `pointsLedger` hides UUIDs, zero IDs, `RULE__`, `CMP_`, status metadata, source IDs, and raw JSON-like markers.

## Migrations Added

- `supabase/20260524_full_system_integration_operations_upgrade.sql`
- `supabase/20260524_full_integration_audit_and_operations.sql`

Both are designed to be idempotent and non-destructive.

## Known Limitations

- Some existing modules still need deeper UI-specific adoption of the new `staffMetrics`, `dashboardMetrics`, and `customerTimeline` adapters.
- Live Supabase write tests were not executed in this local sandbox.
- `customer_analysis` remains as an optional import/cache table, but is no longer treated as live sales truth in fixed pages.

## Test Results

- `npm.cmd run build`: passes.
- `npm.cmd run lint`: passes with existing non-blocking warnings only.
