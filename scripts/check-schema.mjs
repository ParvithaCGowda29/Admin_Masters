import fs from 'node:fs';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('src/workbook.json','utf8'));
// The Filetype tab was removed from the masters (2026-11-02 decision); five masters remain.
// Organization ships with the 3 workbook records (ORG-HQ-01, ORG-BU-01/02, 2026-11-03).
// Agents uses the current 8-column Agents + Assistants master (5 agents and 3 assistants).
// Rules keeps the 5 costing rules after the 36 workbook rules; Tools keeps the 50 Tool Factory entries before the 177 workbook tools. Rule refs left the Tool Factory (2026-11-06 decision).
const expected={Organization:[14,3],Agents:[8,8],Skills:[10,8],Rules:[9,41],Tools:[11,173]};
assert.deepEqual(data.sheets.map(s=>s.name),Object.keys(expected));
// The confirmed workbook includes ID-only rows (for example MFG-AG-6).
// Reject completely empty rows without rejecting those source records.
for(const sheet of data.sheets){assert.deepEqual([sheet.headers.length,sheet.rows.length],expected[sheet.name]);for(const row of sheet.rows){assert.equal(row.values.length,sheet.headers.length);assert(row.values.some(v=>v.trim()));}assert.equal(new Set(sheet.headers).size,sheet.headers.length);}
assert.equal(data.sheets.find(s=>s.name==='Organization').headers[0],'Org ID');
assert.equal(data.sheets.find(s=>s.name==='Agents').headers[0],'Agent ID');
console.log('Schema and blank-row checks passed for all five masters.');
