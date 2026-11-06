import {chromium} from 'playwright';import {createServer} from 'vite';import assert from 'node:assert/strict';
const s=await createServer({server:{port:5196},logLevel:'error'});await s.listen();const b=await chromium.launch({headless:true,args:['--no-sandbox']});
try{const p=await b.newPage();await p.addInitScript(()=>sessionStorage.setItem('bullm_masters_session','qa@example.test'));await p.goto('http://localhost:5196');const result=await p.evaluate(async()=>{
 const {loadRows,saveRows}=await import('/src/provider.ts');const w=(await import('/src/workbook.json')).default;
 const old={};for(const sheet of w.sheets){const r=structuredClone(sheet.rows[0]);r.values[1]='Saved '+sheet.name;if(sheet.name==='Tools')r.values.splice(8,0,'OLD RULE REF');old[sheet.name]=[r]}
 // Get the current key without coupling test to a second hard-coded hash.
 saveRows('Organization',[]);const key=Object.keys(localStorage).find(k=>k.startsWith('bullm-masters-v2-'));localStorage.removeItem(key);
 const legacyKey='bullm-masters-v2-c8f5730d';const original=JSON.stringify(old);localStorage.setItem(legacyKey,original);
 const migrated=Object.fromEntries(w.sheets.map(s=>[s.name,loadRows(s.name)]));saveRows('Organization',[]);const keepEmpty=loadRows('Organization');const keepLegacy=localStorage.getItem(legacyKey)===original;
 saveRows('Tools',[{id:'new-tool',values:w.sheets.find(s=>s.name==='Tools').headers.map((_,i)=>i===1?'Newer edits':'')}]);const keepNew=loadRows('Tools')[0].values[1];return {migrated,keepEmpty,keepLegacy,keepNew};
 });for(const [name,rows] of Object.entries(result.migrated)){assert.equal(rows[0].values[1],'Saved '+name);if(name==='Tools'){assert.equal(rows[0].values.length,11);assert.equal(rows[0].values.includes('OLD RULE REF'),false)}}assert.deepEqual(result.keepEmpty,[]);assert.equal(result.keepLegacy,true);assert.equal(result.keepNew,'Newer edits');console.log('Migration PASS: all five saved masters preserved; only old Rule refs cell removed; newer edits, intentional empty tables and old snapshot untouched');}
finally{await b.close();await s.close()}
