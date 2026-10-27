import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {utils,write} from 'xlsx';

// Compile the pure import helpers for Node without adding a test-runner dependency.
const temp=await mkdtemp(join(process.cwd(),'.bulk-test-'));
try{
 for(const name of ['csv','bulkImport']){
  const source=(await readFile(`src/${name}.ts`,'utf8')).replace("'./csv'","'./csv.mjs'");
  await writeFile(join(temp,`${name}.mjs`),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 }
 const {autoMap,detectHeader,mappedRows,readImportFile,planWorkbook,planFiles,sheetKey}=await import(pathToFileURL(join(temp,'bulkImport.mjs')));
 const headers=['Org ID','Company / Type','Location'];
 const rows=[['Import title'],[],['Location','ORG id','Client name','Skip'],['Bengaluru','ORG-IMPORT-01','Alpha','ignored'],['','','','ignored']];
 assert.equal(detectHeader(rows,headers),2);
 assert.deepEqual(autoMap(rows[2],headers),[2,0,-1,-1]);
 assert.deepEqual(autoMap(['Org ID','Org ID'],headers),[0,-1]);
 assert.deepEqual(mappedRows(rows,2,[2,0,1,-1],3),[['ORG-IMPORT-01','Alpha','Bengaluru']]);
 assert.throws(()=>mappedRows(rows,2,[0,0,-1,-1],3),/only once/);
 assert.throws(()=>mappedRows(rows,2,[-1,-1,-1,-1],3),/at least one/);
 const book=utils.book_new();utils.book_append_sheet(book,utils.aoa_to_sheet(rows),'Companies');
 const bytes=write(book,{type:'array',bookType:'xlsx'});
 const sheets=await readImportFile(new File([bytes],'test.xlsx'));
 assert.equal(sheets[0].name,'Companies');
 assert.equal(sheets[0].rows[3][1],'ORG-IMPORT-01');
 const csv=await readImportFile(new File(['\uFEFFOrg ID,Company / Type\r\nORG-CSV-01,"Comma, and\nnewline"\r\n'],'test.csv'));
 assert.deepEqual(csv[0].rows[1],['ORG-CSV-01','Comma, and\nnewline']);
 await assert.rejects(()=>readImportFile(new File(['text'],'test.txt')),/xlsx or .csv/);
 await assert.rejects(()=>readImportFile(new File([''],'test.csv')),/no filled cells/);
 assert.equal(sheetKey(' Organisation Master '),'organization');assert.equal(sheetKey('TOOLS'),'tools');
 const masters=[{name:'Organization',headers},{name:'Tools',headers:['Tool ID','Name']},{name:'Rules',headers:['Rule ID','Name']}];
 const plan=planWorkbook([{name:'README',rows:[['x']]},{name:'organization',rows},{name:'tools',rows:[['tool id','NAME'],['T-1','Git']]},{name:'Filetype',rows:[['Ext']]}],masters);
 assert.deepEqual(plan.plans.map(p=>[p.master,p.rows.length]),[['Organization',1],['Tools',1]]);
 assert.deepEqual(plan.plans[1].rows,[['T-1','Git']]);
 assert.deepEqual(plan.unmatchedSheets.map(s=>s.name),['README','Filetype']);
 assert.deepEqual(plan.missingTabs,['Rules']);
 // planFiles: folder/zip imports. A workbook keeps planWorkbook matching and is tagged with its file;
 // a CSV fills the current tab unless its filename matches a tab; filetype.csv stays read-only.
 const multi=planFiles([
  {name:'extra-masters.xlsx',sheets:[{name:'tools',rows:[['tool id','NAME'],['T-9','Jira']]}]},
  {name:'rules.csv',sheets:[{name:'CSV',rows:[['Rule ID','Name'],['R-9','Gate check']]}]},
  {name:'anything.csv',sheets:[{name:'CSV',rows:[['Org ID','Company / Type'],['ORG-X-1','Beta']]}]},
  {name:'filetype.csv',sheets:[{name:'CSV',rows:[['Ext'],['pdf']]}]},
  {name:'mystery.csv',sheets:[{name:'CSV',rows:[['nope'],['1']]}]},
 ],masters,'Organization');
 assert.deepEqual(multi.plans.map(p=>[p.file,p.master,p.rows.length]),[['extra-masters.xlsx','Tools',1],['rules.csv','Rules',1],['anything.csv','Organization',1]]);
 assert.deepEqual(multi.plans[0].rows,[['T-9','Jira']]);
 assert.deepEqual(multi.plans[1].rows,[['R-9','Gate check']]);
 assert.deepEqual(multi.unmatchedSheets.map(u=>u.name),['filetype.csv','mystery.csv']);
 assert.deepEqual(multi.missingTabs,[]);
 const noneMatched=planFiles([{name:'rules.csv',sheets:[{name:'CSV',rows:[['Rule ID','Name'],['R-1','x']]}]}],masters,'Organization');
 assert.deepEqual(noneMatched.plans.map(p=>p.master),['Rules']);
 assert.deepEqual(noneMatched.missingTabs.sort(),['Organization','Tools']);
 console.log('Bulk import checks passed: XLSX, CSV, header detection, mapping, skip, ID fidelity and validation.');
}finally{await rm(temp,{recursive:true,force:true});}
