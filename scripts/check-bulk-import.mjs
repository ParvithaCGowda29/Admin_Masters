import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {utils,write} from 'xlsx';

// Compile the pure import helpers for Node without adding a test-runner dependency.
const temp=await mkdtemp(join(process.cwd(),'.bulk-test-'));
try{
 for(const name of ['csv','templates','bulkImport']){
  const source=(await readFile(`src/${name}.ts`,'utf8')).replace("'./csv'","'./csv.mjs'").replace("'./templates'","'./templates.mjs'");
  await writeFile(join(temp,`${name}.mjs`),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 }
 const {autoMap,dedupeRows,detectHeader,mappedRows,readImportFile,planWorkbook,planFiles,sheetKey,matchingSheetIndex,importDataRows}=await import(pathToFileURL(join(temp,'bulkImport.mjs')));
 const headers=['Org ID','Company / Type','Location'];
 const orgHeaders=['Org ID','Company / Type','Brand Properties','Location','Certifications','Company Segment / Niche / Offerings','Customers / Audience','Employees / Job Role','Data Sources','Systems / tools (Software)','Assets (Hardware)','FDE Notes'];
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
 assert.equal(matchingSheetIndex([{name:'README',rows:[['x']]},{name:'organization',rows}], 'Organization'),1);
 assert.equal(matchingSheetIndex([{name:'README',rows:[['x']]},{name:'Organization Master',rows}], 'Organisation'),1);
 assert.equal(matchingSheetIndex([{name:'README',rows:[['x']]}], 'Organization'),-1);
 const templateRows=[['Metadata','1.0','2.0','3.0','4.0','5.0','6.0','7.0','8.0','9.0','10.0','11.0','12.0'],['Org ID','Company','Brand Properties','Location','Certifications','Business segment and offerings','Customers and audience','User Role','Knowledge Base','ERP & API Integration Endpoints','Hardware','Notes'],['Description','Company name and type','Website, GBP and social media','Registered address','Quality standards','Company context and offerings','Client accounts','Employee roles','Knowledge base and source references','Systems and software','Physical assets','Open gaps and changes'],['ORG-001','Example Organization','https://example.test','Austin, TX','ISO 9001','Electronics manufacturing','Raytheon','Sourcing Engineers','PostgreSQL','SAP S/4HANA','GPU Cluster','Review notes']];
 assert.equal(detectHeader(templateRows,orgHeaders),1);
 const templateMap=autoMap(templateRows[1],orgHeaders);
 assert.equal(templateMap.filter(i=>i>=0).length,12);
 assert.deepEqual(mappedRows(templateRows,1,templateMap,12),[['ORG-001','Example Organization','https://example.test','Austin, TX','ISO 9001','Electronics manufacturing','Raytheon','Sourcing Engineers','PostgreSQL','SAP S/4HANA','GPU Cluster','Review notes']]);

 const plan=planWorkbook([{name:'README',rows:[['x']]},{name:'organization',rows},{name:'tools',rows:[['tool id','NAME'],['T-1','Git']]},{name:'Filetype',rows:[['Ext']]}],masters);
 assert.deepEqual(plan.plans.map(p=>[p.master,p.rows.length]),[['Organization',1],['Tools',1]]);
 assert.deepEqual(plan.plans[1].rows,[['T-1','Git']]);
 assert.deepEqual(plan.unmatchedSheets.map(s=>s.name),['README','Filetype']);
 assert.deepEqual(plan.missingTabs,['Rules']);
 const sevenSheetPlan=planWorkbook([{name:'README',rows:[['Section','Context','Details'],['Layout','Hierarchy','Manufacturing records']]},{name:'Organization',rows:templateRows},{name:'Agents',rows:[]},{name:'Skills',rows:[]},{name:'Rules',rows:[]},{name:'Tools',rows:[]},{name:'Filetype',rows:[]}],[{name:'Organization',headers:orgHeaders}]);
 assert.equal(sevenSheetPlan.plans[0].sheet,'Organization');
 assert.equal(sevenSheetPlan.plans[0].headerRow,1);
 assert.equal(sevenSheetPlan.plans[0].mapped,12);
 assert.deepEqual(sevenSheetPlan.plans[0].rows[0],['ORG-001','Example Organization','https://example.test','Austin, TX','ISO 9001','Electronics manufacturing','Raytheon','Sourcing Engineers','PostgreSQL','SAP S/4HANA','GPU Cluster','Review notes']);
 const testBook=utils.book_new();
 utils.book_append_sheet(testBook,utils.aoa_to_sheet([['Section','Context','Details'],['Layout','Hierarchy','Manufacturing records']]),'README');
 utils.book_append_sheet(testBook,utils.aoa_to_sheet([['Metadata','1.0','2.0','3.0','4.0','5.0','6.0','7.0','8.0','9.0','10.0','11.0'],orgHeaders,['Stable unit or resource ID',...orgHeaders.slice(1)],['ORG-001','Example Organization','https://example.test','Austin, TX','ISO 9001','Electronics manufacturing','Raytheon','Sourcing Engineers','PostgreSQL','SAP S/4HANA','GPU Cluster','Review notes']]),'Organization');
 for(const name of ['Agents','Skills','Rules','Tools','Filetype'])utils.book_append_sheet(testBook,utils.aoa_to_sheet([['Metadata'],['Example']]),name);
 const testBytes=write(testBook,{type:'array',bookType:'xlsx'});
 const uploaded=await readImportFile(new File([testBytes],'masters.xlsx'));
 const orgSheetIndex=matchingSheetIndex(uploaded,'Organisation');
 assert.equal(uploaded[orgSheetIndex].name,'Organization');
 const orgSheet=uploaded[orgSheetIndex];
 const orgHeaderRow=detectHeader(orgSheet.rows,orgHeaders);
 const orgMapping=autoMap(orgSheet.rows[orgHeaderRow],orgHeaders);
 assert.equal(orgHeaderRow,1);
 assert.equal(orgMapping.filter(i=>i>=0).length,12);
 const orgValues=mappedRows(orgSheet.rows,orgHeaderRow,orgMapping,orgHeaders.length);
 assert.equal(importDataRows(orgSheet.rows,orgHeaderRow).length,1);
 assert.equal(orgValues.length,1);
 assert.equal(orgValues[0][0],'ORG-001');
 assert.equal(orgValues[0][1],'Example Organization');
 assert.equal(orgValues[0][2],'https://example.test');
 // planFiles: folder/zip imports. Masters parent scope ('all'): a workbook keeps planWorkbook
 // matching and is tagged with its file; a CSV fills the tab its filename matches; other CSVs
 // are reported, and filetype.csv stays read-only.
 const multi=planFiles([
  {name:'extra-masters.xlsx',sheets:[{name:'tools',rows:[['tool id','NAME'],['T-9','Jira']]}]},
  {name:'rules.csv',sheets:[{name:'CSV',rows:[['Rule ID','Name'],['R-9','Gate check']]}]},
  {name:'anything.csv',sheets:[{name:'CSV',rows:[['Org ID','Company / Type'],['ORG-X-1','Beta']]}]},
  {name:'filetype.csv',sheets:[{name:'CSV',rows:[['Ext'],['pdf']]}]},
  {name:'mystery.csv',sheets:[{name:'CSV',rows:[['nope'],['1']]}]},
 ],masters,{type:'all'});
 assert.deepEqual(multi.plans.map(p=>[p.file,p.master,p.rows.length]),[['extra-masters.xlsx','Tools',1],['rules.csv','Rules',1]]);
 assert.deepEqual(multi.plans[0].rows,[['T-9','Jira']]);
 assert.deepEqual(multi.plans[1].rows,[['R-9','Gate check']]);
 assert.deepEqual(multi.unmatchedSheets.map(u=>u.name),['anything.csv','filetype.csv','mystery.csv']);
 assert.deepEqual(multi.missingTabs,['Organization']);
 // Single-tab scope: every file maps into the open tab only. A workbook contributes the sheet
 // named like the tab when present, otherwise its first sheet; other sheets are reported.
 const scoped=planFiles([
  {name:'anything.csv',sheets:[{name:'CSV',rows:[['Org ID','Company / Type'],['ORG-X-1','Beta']]}]},
  {name:'book.xlsx',sheets:[{name:'Random',rows:[['Org ID','Company / Type'],['ORG-W-1','Gamma']]},{name:'tools',rows:[['Org ID','Company / Type'],['ORG-W-2','Delta']]}]},
 ],masters,{type:'tab',tab:'Organization'});
 assert.deepEqual(scoped.plans.map(p=>[p.file,p.master,p.rows.length]),[['anything.csv','Organization',1],['book.xlsx','Organization',1]]);
 assert.deepEqual(scoped.plans[1].rows,[['ORG-W-1','Gamma','']]);
 assert.equal(scoped.unmatchedSheets.length,1);
 assert.ok(scoped.unmatchedSheets[0].name.endsWith('tools'));
 const named=planFiles([{name:'book.xlsx',sheets:[{name:'zzz',rows:[['Org ID','Company / Type'],['ORG-0','Zero']]},{name:'organization',rows:[['Org ID','Company / Type'],['ORG-N-1','Eta']]}]}],masters,{type:'tab',tab:'Organization'});
 assert.deepEqual(named.plans.map(p=>[p.sheet,p.rows.length]),[['organization',1]]);
 const noneMatched=planFiles([{name:'rules.csv',sheets:[{name:'CSV',rows:[['Rule ID','Name'],['R-1','x']]}]}],masters,{type:'all'});
 assert.deepEqual(noneMatched.plans.map(p=>p.master),['Rules']);
 assert.deepEqual(noneMatched.missingTabs.sort(),['Organization','Tools']);
 // Fill-in list templates are held: never imported into Masters, detected by their exact
 // blank-template header row even when the file is renamed after a master tab.
 const employee=[['Employee','Job title','Department','Unit applicability','Verification status'],['Asha','Engineer','Platform','All','Verified']];
 const held=planWorkbook([{name:'Employee List',rows:employee},{name:'tools',rows:[['tool id','NAME'],['T-9','Jira']]}],masters);
 assert.deepEqual(held.plans.map(p=>p.master),['Tools']);
 assert.equal(held.unmatchedSheets.length,1);
 assert.match(held.unmatchedSheets[0].reason,/not imported into Masters/);
 const renamed=planFiles([{name:'organization.csv',sheets:[{name:'CSV',rows:employee}]}],masters,{type:'all'});
 assert.deepEqual(renamed.plans,[]);
 assert.match(renamed.unmatchedSheets[0].reason,/not imported into Masters/);
 const heldOnTab=planFiles([{name:'Employee List.xlsx',sheets:[{name:'Employee List',rows:employee}]}],masters,{type:'tab',tab:'Organization'});
 assert.deepEqual(heldOnTab.plans,[]);
 assert.match(heldOnTab.unmatchedSheets[0].reason,/not imported into Masters/);
 // dedupeRows: re-imports skip exact repeats, never overwrite changed IDs, and keep batch order.
 assert.deepEqual(dedupeRows([['ORG-1','Alpha',' Austin ']],[['org-1','Alpha','Austin']]),{fresh:[],exact:1,changed:0});
 assert.deepEqual(dedupeRows([['ORG-1','Alpha','Austin']],[['ORG-1','Beta','Austin']]),{fresh:[],exact:0,changed:1});
 assert.deepEqual(dedupeRows([['ORG-1','Alpha','Austin']],[['ORG-2','Beta','Austin'],[' ORG-2 ','Beta','Austin'],['ORG-1','Alpha','Austin']]),{fresh:[['ORG-2','Beta','Austin']],exact:2,changed:0});
 assert.deepEqual(dedupeRows([['','Alpha']],[['','Beta']]),{fresh:[['','Beta']],exact:0,changed:0});
 assert.deepEqual(dedupeRows([['ORG-1','Alpha']],[['ORG-1','Beta'],['ORG-1','Gamma']]),{fresh:[],exact:0,changed:2});
 console.log('Bulk import checks passed: XLSX, CSV, header detection, mapping, skip, ID fidelity, dedupe and validation.');
}finally{await rm(temp,{recursive:true,force:true});}
