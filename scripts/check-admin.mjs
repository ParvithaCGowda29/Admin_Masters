import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'masters-admin-'));
try{
 const source=await fs.readFile('src/admin.ts','utf8');
 await fs.writeFile(path.join(temp,'admin.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {ADMIN_SHEETS,adminSheet}=await import(pathToFileURL(path.join(temp,'admin.mjs')));
 assert.deepEqual(ADMIN_SHEETS.map(s=>s.name),['System Settings','User Management','Model Switching','License & Payments','Tool Setup & Integrations','File Type & Standardization']);
 for(const sheet of ADMIN_SHEETS){
  assert.equal(new Set(sheet.headers).size,sheet.headers.length,`${sheet.name}: duplicate headers`);
  assert.equal(sheet.descriptions.length,sheet.headers.length,`${sheet.name}: every column needs a description`);
  assert.equal(sheet.headers.at(-1),'Status',`${sheet.name}: last column is Status`);
  for(const row of sheet.rows){assert.equal(row.values.length,sheet.headers.length,`${sheet.name}: row width`);assert(row.values.every(v=>typeof v==='string'));assert(row.values.some(v=>v.trim()),`${sheet.name}: no blank rows`);}
 }
 const settings=adminSheet('System Settings');
 assert.deepEqual(settings.headers,['Setting ID','Setting','Value','Scope','Owner','Updated','Status']);
 assert.equal(settings.rows.length,8);
 assert.deepEqual(settings.rows.map(r=>r.values[0]),['SET-01','SET-02','SET-03','SET-04','SET-05','SET-06','SET-07','SET-08']);
 assert.equal(settings.rows.filter(r=>r.values[6]==='Active').length,7);
 assert.equal(adminSheet('Nope'),undefined);
 console.log('Admin tab checks passed: 6 sub-tabs, System Settings seed rows match the approved wireframe, unique described headers, Status last.');
}finally{await fs.rm(temp,{recursive:true,force:true})}
