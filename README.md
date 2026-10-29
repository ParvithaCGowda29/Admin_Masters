# BuLLM Masters

React + Vite + TypeScript, Refine core, AG Grid Community. Matches the supplied BuLLM shell with BuLLM branding, not BuLLM Quote.

## Run

Requires Node.js 22 or later.

```
npm ci
npm run dev
```

Open the local URL printed by Vite.

```
npm run build
npm run preview
npm test
```

Optional browser checks:

```
npx playwright install chromium
node scripts/verify.mjs
```

## Use

- Switch sheets from the sidebar or tabs. All six masters and README have search.
- Search history is per sheet, shows the last 12 terms, can recall terms, and can be cleared. Terms are recorded after 800ms without typing.
- Double-click a cell to edit. Ctrl+Enter saves a multiline editor; Esc cancels. Clicking outside also saves.
- Add Row creates one empty row only when requested.
- Select rows using checkboxes, then Delete selected. Confirmation is required.
- Add files reads .xlsx and .csv in the browser, maps columns onto the fixed masters schema, appends records, and skips fully blank imported rows. Exact duplicates are skipped and a changed value on an existing ID is flagged, never overwritten.
- Export CSV includes exact original headers and current values.
- Hover headers for descriptions and cells for full content. Scroll horizontally for the remaining columns. The grid keeps data-column order fixed.

## Workbook mapping

| Sheet | Exact named columns | Retained rows |
| --- | ---: | ---: |
| Organization | 15 | 6 |
| Rules | 12 | 8 |
| Agents | 12 | 6 |
| Skills | 12 | 16 |
| Tooling | 16 | 11 |
| Filetype | 6 | 43 |

The workbook's second row supplies column names, its third row supplies descriptions, and data starts on row four. Literal header spaces are retained, including `Name ` and ` Logs`. The first named column is included. Metadata numbering and descriptions are not data records. Rules and Skills each contain one trailing formatted column without a name; these unnamed columns are omitted. No named column is omitted or renamed.

Removed Organization worksheet row 8 (Unit #5: label only), Agents rows 9 (Agent #6: label only) and 11 (empty), and Filetype rows 47-48 (empty). Existing row labels are not renumbered. Nonblank example/proposal rows, values and warnings are preserved, not presented as configured systems. README nonblank rows are preserved.

Filetype row 49 says FDE should not edit the private table. This is treated as a rule, not a record. Filetype is read-only in the FDE UI and its data-provider mutations are blocked.

## Storage and integration

This is a working frontend with a local Refine DataProvider. There is no backend, login, tenant isolation, server authorization, configured integration, or multi-user persistence. UI read-only controls are not a security boundary. Wire the provider to the team's actual API, add authentication and server-enforced authorization before production use.

Changes are stored in this browser's localStorage under `bullm-masters-v1`; search history is under `bullm-search-history-v1`. Another browser/device will not see them. Clearing browser storage removes local edits/history. Export CSV for a portable copy. Search history can contain sensitive terms, so clear it on shared devices.

The source workbook remains the initial schema and seed-data reference in `src/workbook.json`. Internal record IDs are not new workbook columns. The original workbook is included in `reference/` in the source archive.

## Masters UI review - 28 October 2026

- Masters is the collapsible parent of all six master tabs. The separate README tab is removed; selecting the Masters parent opens the workbook overview, and the chevron alone collapses the tree. Hover, focus or tap each `i` to read the existing workbook guide and the tab's field descriptions; shared source notes remain under the parent `i`.
- Add files opens one extraction flow with four steps: Source, Permission, Find files and Review mapping. Sources are this device (files or a folder, .xlsx/.csv, zip archives unpack) plus SharePoint and Google Drive cards that stay disabled as Not connected until company sign-in and a backend exist - they never pretend to read files. The permission step ticks exactly which files and file types the job may read, read-only, for that job only, with Stop extraction available. The review step suggests a destination tab per table with a match percentage and per-column mapping dropdowns; low-confidence tables wait unticked and are never imported until the user fixes the mapping and ticks them. Routing follows the open context: from the Masters parent, workbook sheets and matching CSVs fill their tabs; on a specific tab, every file maps into that tab only. Imports append to the end of a tab, skip exact duplicates, and flag changed values on an existing ID without overwriting. Filetype stays read-only and never receives imports. ID standardization stays paused.
- Templates: the Add templates popup is upload-only - a user's own filled Excel/CSV maps into the matching template's columns and lands in that template's own list, editable, never in a master tab. The four blank list templates (Employee List, Sample - Customers, Sample - Assets, Sample - Systems) download from the matching Organization column headers (Employees / Job Role, Customers / Audience, Assets (Hardware), Systems / tools (Software)), generated by `node scripts/make-templates.mjs`. Filled template files are blocked from the Add files flow and pointed at Add templates.
- Comma-separated values stack one item per line inside the same cell and parent row on every tab. Grouped names in brackets, such as "Policies (IT, HR, RBAC)", stay one item. Stored values, IDs and row counts never change; the stacking is display-only.
- Facet menus use values already present in workbook fields, with counts and removable filter chips. Multiple values in one facet are OR; different facets and text search are AND. Empty tabs show no invented categories or tags.
- Light/dark mode is saved on this browser. The grid keeps one source record per row with wrapped, content-sized cells across tabs. Existing combined source records are not split or rewritten automatically.
- Existing workbook columns, browser storage key, duplicate protection and read-only Filetype are unchanged. No backend or external list storage is added.

Checks: `npm test`, `npm run test:bulk`, `npm run test:extraction`, `node scripts/check-master-ui.mjs`, and `node scripts/check-ui-review.mjs` and `node scripts/check-templates-routing.mjs` (Playwright browser required; optionally set `CHROME_PATH` and `UI_SCREENSHOT_DIR`). `npm run build` checks TypeScript and produces the production bundle.
