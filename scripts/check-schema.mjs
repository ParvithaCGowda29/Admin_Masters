import fs from 'node:fs';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('src/workbook.json','utf8'));
const expected={Organization:[12,0],Agents:[8,0],Skills:[12,0],Rules:[9,0],Tools:[9,0],Filetype:[9,43]};
assert.deepEqual(data.sheets.map(s=>s.name),Object.keys(expected));
// The confirmed workbook includes ID-only rows (for example MFG-AG-6).
// Reject completely empty rows without rejecting those source records.
for(const sheet of data.sheets){assert.deepEqual([sheet.headers.length,sheet.rows.length],expected[sheet.name]);for(const row of sheet.rows){assert.equal(row.values.length,sheet.headers.length);assert(row.values.some(v=>v.trim()));}assert.equal(new Set(sheet.headers).size,sheet.headers.length);}
assert.equal(data.sheets.find(s=>s.name==='Organization').headers[0],'Org ID');
assert.equal(data.sheets.find(s=>s.name==='Agents').headers[0],'Agent ID');
assert.equal(data.sheets.find(s=>s.name==='Filetype').readOnly,true);
console.log('Schema and blank-row checks passed for all six masters.');
