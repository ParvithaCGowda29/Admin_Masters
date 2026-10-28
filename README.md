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
- Bulk Upload accepts CSV, appends records, rejects mismatched headers/order, and skips fully blank imported rows. Download CSV template first. It is not an XLSX importer.
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

- Masters is the collapsible parent of all six master tabs. The separate README tab is removed. Hover, focus or tap each `i` to read the existing workbook guide and the tab's field descriptions; shared source notes remain under the parent `i`.
- Add files is the single file entry point. Its existing current-tab, workbook, folder and zip review flows are retained. No new document extraction, cloud connector or ID standardization is included.
- Facet menus use values already present in workbook fields, with counts and removable filter chips. Multiple values in one facet are OR; different facets and text search are AND. Empty tabs show no invented categories or tags.
- Light/dark mode is saved on this browser. The grid keeps one source record per row with wrapped, content-sized cells across tabs. Existing combined source records are not split or rewritten automatically.
- Existing workbook columns, browser storage key, duplicate protection and read-only Filetype are unchanged. No backend or external list storage is added. Template placement implementation remains paused pending the user's wireframe review.

Checks: `npm test`, `npm run test:bulk`, `node scripts/check-master-ui.mjs`, and `node scripts/check-ui-review.mjs` (Playwright browser required; optionally set `CHROME_PATH` and `UI_SCREENSHOT_DIR`). `npm run build` checks TypeScript and produces the production bundle.
