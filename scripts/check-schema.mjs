import fs from 'node:fs';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('src/workbook.json','utf8'));
const expected={Organization:[15,6],Rules:[12,8],Agents:[12,6],Skills:[12,16],Tooling:[16,11],Filetype:[6,43]};
for(const sheet of data.sheets){assert.deepEqual([sheet.headers.length,sheet.rows.length],expected[sheet.name]);for(const row of sheet.rows){assert.equal(row.values.length,sheet.headers.length);assert(row.values.slice(1).some(v=>v.trim()));}assert.equal(new Set(sheet.headers).size,sheet.headers.length);}
assert.equal(data.sheets.find(s=>s.name==='Organization').headers[0],'Name ');
assert.equal(data.sheets.find(s=>s.name==='Agents').headers[10],' Logs');
assert.equal(data.sheets.find(s=>s.name==='Filetype').readOnly,true);
console.log('Schema and blank-row checks passed for all six masters.');
