import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {set_fs,utils,write} from 'xlsx';
set_fs(fs);
const screenshotDir=process.env.UI_SCREENSHOT_DIR||'/downloads/extraction-check';fs.mkdirSync(screenshotDir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
const report=[];
const workbook=JSON.parse(fs.readFileSync('src/workbook.json','utf8'));
const orgHeaders=workbook.sheets.find(s=>s.name==='Organization').headers;
const orgSeeded=workbook.sheets.find(s=>s.name==='Organization').rows.length;
const orgAfterImport=orgSeeded+2; // 11 seeded wireframe rows plus the 2 imported test rows
const toXlsx=(sheets)=>{const wb=utils.book_new();for(const [name,rows] of sheets)utils.book_append_sheet(wb,utils.aoa_to_sheet(rows),name);return Buffer.from(write(wb,{type:'array',bookType:'xlsx'}));};
const xlsxType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{try{sessionStorage.setItem('bullm_masters_session','ui-test@example.test')}catch{}});
 for(let i=0;i<30;i++){try{await page.goto('http://127.0.0.1:5173');break}catch{await new Promise(r=>setTimeout(r,100));}}
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();

 // The whole flow on the Masters parent: workbook with one matching sheet and one unrelated sheet.
 const mixed=toXlsx([
  ['Organization',[orgHeaders,['ORG-T-1','Test co','','','','','','','','','',''],['ORG-T-2','Second co','','','','','','','','','','']]],
  ['Leave approvals',[['Leave code','Approver','Days'],['L-1','Asha','2']]],
 ]);
 async function openFlow(){await page.getByRole('button',{name:'Add files',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('heading',{name:'Add files',exact:true}).waitFor();}
 async function toReview(files){
  await page.getByLabel('Choose files from this device').setInputFiles(files);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('heading',{name:'Allow read-write access to your files',exact:true}).waitFor();
  await page.getByRole('radio',{name:/Read-write/}).click();
 await page.getByRole('button',{name:'Allow read-write & fetch files',exact:true}).click();
  await page.getByRole('heading',{name:'Review where each file maps',exact:true}).waitFor();
 }
 await page.getByRole('button',{name:'Masters',exact:true}).click();
 await openFlow();
 await page.screenshot({path:screenshotDir+'/ex-1-source-light.png'});
 assert.equal(await page.getByRole('button',{name:/SharePoint/}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:/Google Drive/}).isDisabled(),true);
 assert.ok((await page.getByRole('dialog').allTextContents()).join(' ').includes('Not connected'));
 // No inline dropzone: each upload option opens the drop/browse area in a centered popup.
 assert.equal(await page.locator('.uppy-Dashboard').count(),0);
 await page.getByRole('button',{name:/Bulk upload/}).click();
 const popup=page.getByRole('dialog',{name:'Bulk upload'});
 await popup.locator('.uppy-Dashboard-inner').waitFor();
 assert.ok((await popup.allTextContents()).join(' ').includes('Master data'));
 await page.screenshot({path:screenshotDir+'/ex-1b-source-popup-light.png'});
 await page.getByRole('button',{name:'Close file picker',exact:true}).click();
 assert.equal(await page.locator('.uppy-Dashboard').count(),0);
 // Done confirms the picked files: it closes the popup and keeps the selection on the
 // Source step. With nothing picked it is disabled; Uppy's own Cancel still discards.
 await page.getByRole('button',{name:/Bulk upload/}).click();
 await popup.locator('.uppy-Dashboard-inner').waitFor();
 assert.equal(await popup.getByRole('button',{name:'Done (0 files)',exact:true}).isDisabled(),true);
 await page.getByLabel('Choose files from this device').setInputFiles({name:'masters.xlsx',mimeType:xlsxType,buffer:mixed});
 const done=popup.getByRole('button',{name:'Done (1 file)',exact:true});
 await done.waitFor();
 await page.screenshot({path:screenshotDir+'/ex-1c-popup-done-light.png'});
 await done.click();
 assert.equal(await page.locator('.ex-drop-popup').count(),0);
 assert.ok(/1 file ready/.test((await page.getByRole('dialog').allTextContents()).join(' ')));
 await page.getByRole('button',{name:/Bulk upload/}).click();
 await popup.getByRole('button',{name:'Done (1 file)',exact:true}).waitFor();
 await popup.getByRole('button',{name:'Cancel',exact:true}).click();
 await popup.getByRole('button',{name:'Done (0 files)',exact:true}).waitFor();
 await page.getByRole('button',{name:'Close file picker',exact:true}).click();
 assert.ok(/Pick files, a folder or a zip to continue/.test((await page.getByRole('dialog').allTextContents()).join(' ')));
 report.push('Picker popup: Done (with the file count) confirms the picked files, closes the popup and keeps the selection on the Source step; it is disabled with nothing picked, and Cancel still discards the picked files.');
 report.push('Source step: the three upload options (Choose folder, Bulk upload, Zip upload) each open the drop/browse area with the type chips in a popup; SharePoint and Google Drive are disabled with Not connected.');

 await page.getByLabel('Choose files from this device').setInputFiles({name:'masters.xlsx',mimeType:xlsxType,buffer:mixed});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'Allow read-write access to your files',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/ex-2-permission-light.png'});
 const permText=(await page.getByRole('dialog').allTextContents()).join(' ').replace(/\s+/g,' ');
 assert.ok(permText.includes('masters.xlsx')&&permText.includes('this extraction job')&&permText.includes('stop the job at any time'));
 report.push('Permission step lists the real picked files, the read-only scope, the job-only limit and the stop wording.');
 assert.equal(await page.getByRole('radio',{name:/Read-only/}).count(),0);
 await page.getByRole('radio',{name:/Read-write/}).click();
 await page.getByRole('button',{name:'Allow read-write & fetch files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file maps',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/ex-3-review-light.png'});

 const dialogText=()=>page.getByRole('dialog').allTextContents().then(t=>t.join(' ').replace(/\s+/g,' '));
 assert.ok(/2\s*tables found/.test(await dialogText()));
 assert.ok(/ready to import/.test(await dialogText()));
 // The unrelated sheet stays visible but unticked and is never imported - but it keeps a manual mapping path.
 const leaveRow=page.locator('.ex-table tr',{hasText:'Leave approvals'});
 assert.equal(await leaveRow.locator('.ex-pill').textContent(),'No');
 assert.equal(await leaveRow.locator('input[type=checkbox]').isDisabled(),true);
 assert.equal(await leaveRow.getByRole('button',{name:'Map columns',exact:true}).count(),0);
 // No Columns column on the mapping table; the amber note names what is unresolved.
 assert.equal(await page.locator('.ex-table > thead > tr > th',{hasText:'Columns'}).count(),0);
 assert.ok(/masters\.xlsx is not included yet: no columns matched any .* field/.test((await dialogText()).replace(/\s+/g,' ')));
 report.push('Review: matching sheet is ticked and ready; the unrelated sheet stays listed, unticked, checkbox disabled, Mapped No, with no Map columns path - unmatched columns are auto-ignored and the amber note names why it stays out.');

 await page.getByRole('button',{name:'Import 1 ready table',exact:true}).click();
 await page.getByRole('status').filter({hasText:'2 new rows added'}).waitFor();
 report.push('Import appends only the ready table: 2 rows into Organization.');

 await page.getByRole('button',{name:new RegExp('Organization '+orgAfterImport),exact:true}).click();
 await page.getByText(`${orgAfterImport} of ${orgAfterImport} rows`,{exact:true}).waitFor();
 const tabCounts={Rules:41,Skills:50,'Tool Factory':227,Agents:21};
 for(const tab of ['Rules','Skills','Tool Factory','Agents']){
  await page.getByRole('button',{name:new RegExp('^'+tab+' '),exact:true}).click();
  await page.getByText(`${tabCounts[tab]} of ${tabCounts[tab]} rows`,{exact:true}).waitFor();
 }
 report.push('The unrelated Leave approvals sheet landed nowhere: every other tab keeps only its seeded master rows.');

 // Re-importing the same file skips the already-present rows instead of duplicating them.
 await page.getByRole('button',{name:'Masters',exact:true}).click();
 await openFlow();
 await toReview({name:'masters.xlsx',mimeType:xlsxType,buffer:mixed});
 await page.getByRole('button',{name:'Import 1 ready table',exact:true}).click();
 await page.getByRole('status').filter({hasText:'already-present'}).waitFor();
 await page.getByRole('button',{name:new RegExp('Organization '+orgAfterImport),exact:true}).click();
 await page.getByText(`${orgAfterImport} of ${orgAfterImport} rows`,{exact:true}).waitFor();
 report.push('Re-import is guarded: already-present rows are skipped, count stays at the post-import total.');

 // A changed value on an existing ID is flagged and never overwrites the stored row.
 const changedCsv=[orgHeaders.slice(0,2),['ORG-T-1','CHANGED NAME']].map(r=>r.join(',')).join('\n');
 await openFlow();
 await toReview({name:'Organization.csv',mimeType:'text/csv',buffer:Buffer.from(changedCsv)});
 // 2 of 12 columns -> low match, unticked; the user ticks it deliberately.
 await page.getByRole('checkbox',{name:'Include CSV from Organization.csv'}).check();
 await page.getByRole('button',{name:'Import 1 ready table',exact:true}).click();
 await page.getByRole('status').filter({hasText:'not overwritten'}).waitFor();
 await page.reload();await page.getByText(`${orgAfterImport} of ${orgAfterImport} rows`,{exact:true}).waitFor();
 const kept=await page.evaluate(async()=>{const {loadRows}=await import('/src/provider.ts');return loadRows('Organization');});
 assert.equal(kept.find(r=>r.values[0]==='ORG-T-1').values[1],'Test co');
 report.push('Existing ID with different values is flagged, not overwritten; stored row and count unchanged.');

 // Permission untick excludes the file entirely: its tables never reach the review.
 await openFlow();
 await page.getByLabel('Choose files from this device').setInputFiles([
  {name:'agents.csv',mimeType:'text/csv',buffer:Buffer.from('Agent ID,Agent Type\nAG-1,Helper')},
  {name:'tools.csv',mimeType:'text/csv',buffer:Buffer.from('Tooling ID,Tool Name\nTO-1,Search')},
 ]);
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('checkbox',{name:/tools\.csv/}).uncheck();
 await page.getByRole('radio',{name:/Read-write/}).click();
 await page.getByRole('button',{name:'Allow read-write & fetch files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file maps',exact:true}).waitFor();
 const reviewText=await dialogText();
 assert.ok(reviewText.includes('agents.csv')&&!reviewText.includes('tools.csv'));
 await page.getByRole('button',{name:'Stop extraction',exact:true}).click();
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:/Agents 8/,exact:true}).click();
 await page.getByText('8 of 8 rows',{exact:true}).waitFor();
 report.push('Unticking a file on the permission step excludes it completely; Stop extraction imports nothing.');

 // Filled Add templates files are held back with the reason, never imported into Masters.
 await openFlow();
 await toReview({name:'Employee List.csv',mimeType:'text/csv',buffer:Buffer.from('Employee,Job title,Department,Unit applicability,Verification status\nAsha,Engineer,Platform,All,Verified')});
 const blockedText=await dialogText();
 assert.ok(blockedText.includes('Add templates')&&blockedText.includes('not imported into Masters'));
 assert.equal(await page.getByRole('button',{name:/Import/}).isDisabled(),true);
 await page.getByRole('button',{name:'Close add files',exact:true}).click();
 report.push('Filled list templates stay blocked from Masters and point at Add templates.');

 // Renamed headers: 9 of 12 columns auto-map and the 3 unmatched content columns are
 // auto-ignored, so the table is ticked and ready on its own - no Map columns step.
 const renamed=toXlsx([['Organization',[
  ['Code','Company Name','Registered address','Certifications','Offerings','Client accounts','Knowledge bases','Hardware','Notes','Website & socials','Team size & roles','Software in use'],
  ['ORG-R-1','Renamed co','Mysuru','ISO','Widgets','Clients','KB','Laptop','note','https://example.test','5 engineers','Excel'],
 ]]]);
 await page.getByRole('button',{name:'Masters',exact:true}).click();
 await openFlow();
 await toReview({name:'org-renamed.xlsx',mimeType:xlsxType,buffer:renamed});
 const renamedRow=page.locator('.ex-table tr',{hasText:'org-renamed.xlsx'});
 assert.equal(await renamedRow.locator('.ex-pill').textContent(),'Yes');
 assert.ok(/org-renamed\.xlsx: 3 columns with content did not match any Organization field and were ignored/.test((await dialogText()).replace(/\s+/g,' ')));
 assert.equal(await renamedRow.locator('input[type=checkbox]').isDisabled(),false);
 assert.equal(await renamedRow.locator('input[type=checkbox]').isChecked(),true);
 await page.screenshot({path:screenshotDir+'/ex-7-renamed-resolved.png'});
 await page.getByRole('button',{name:'Import 1 ready table',exact:true}).click();
 await page.getByRole('status').filter({hasText:'1 new row'}).waitFor();
 const renamedSaved=await page.evaluate(async()=>{const {loadRows}=await import('/src/provider.ts');return loadRows('Organization');});
 const renamedRowSaved=renamedSaved.find(r=>r.values[0]==='ORG-R-1');
 assert.equal(renamedRowSaved.values[1],'Renamed co');
 assert.equal(renamedRowSaved.values.some(v=>v==='5 engineers'||v==='Excel'||v==='https://example.test'),false);
 report.push('Renamed headers (9/12): the 3 unmatched content columns are auto-ignored, the table is ticked and ready on its own, and ignored column data never lands.');

 // Zero-match table: nothing maps, so the table stays out with the reason in the amber
 // note - there is no manual Map columns step; unmatched columns are auto-ignored.
 const zero=toXlsx([['Sheet1',[
  ['Foo','Bar','Baz'],
  ['ORG-Z-1','Zero co','Extra fact'],
 ]]]);
 await openFlow();
 await toReview({name:'zero.xlsx',mimeType:xlsxType,buffer:zero});
 const zeroRow=page.locator('.ex-table tr',{hasText:'zero.xlsx'});
 assert.equal(await zeroRow.locator('.ex-pill').textContent(),'No');
 assert.equal(await zeroRow.locator('input[type=checkbox]').isDisabled(),true);
 assert.equal(await zeroRow.getByRole('button',{name:'Map columns',exact:true}).count(),0);
 assert.ok(/zero\.xlsx is not included yet: no columns matched any .* field/.test((await dialogText()).replace(/\s+/g,' ')));
 assert.equal(await page.getByRole('button',{name:/Import/}).isDisabled(),true);
 await page.getByRole('button',{name:'Close add files',exact:true}).click();
 report.push('Zero-match table stays out with the reason in the amber note; unmatched columns are auto-ignored, no manual Map columns step.');

 // README and Filetype sheets never enter the mapping list: README content belongs to
 // each tab's info icon, and the Filetype tab was removed from Masters.
 const withReadme=toXlsx([
  ['README',[['BuLLM masters'],['Organization: business units and locations.']]],
  ['Filetype',[['Ext'],['.xlsx']]],
  ['Organization',[orgHeaders,['ORG-RM-1','Readme co','','','','','','','','','','']]],
 ]);
 await page.getByRole('button',{name:'Masters',exact:true}).click();
 await openFlow();
 await toReview({name:'workbook.xlsx',mimeType:xlsxType,buffer:withReadme});
 const readmeText=await dialogText();
 assert.ok(/1\s*table found/.test(readmeText));
 assert.ok(!readmeText.includes('README'));
 assert.ok(!readmeText.includes('Filetype'));
 assert.equal(await page.locator('.ex-table tr',{hasText:'README'}).count(),0);
 assert.equal(await page.locator('.ex-table tr',{hasText:'Filetype'}).count(),0);
 await page.getByRole('button',{name:'Close add files',exact:true}).click();
 report.push('README and Filetype sheets never enter the mapping list: only the real data table is found and listed.');

 // Dark theme over the same flow.
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await openFlow();
 await page.screenshot({path:screenshotDir+'/ex-4-source-dark.png'});
 await page.getByLabel('Choose files from this device').setInputFiles({name:'masters.xlsx',mimeType:xlsxType,buffer:mixed});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.screenshot({path:screenshotDir+'/ex-5-permission-dark.png'});
 await page.getByRole('radio',{name:/Read-write/}).click();
 await page.getByRole('button',{name:'Allow read-write & fetch files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file maps',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/ex-6-review-dark.png'});
 await page.getByRole('button',{name:'Close add files',exact:true}).click();
 report.push('Dark theme renders across source, permission and review steps.');

 assert.deepEqual(errors,[]);
 report.push('No browser page errors.');
 console.log(report.join('\n'));
}finally{await browser.close();server.kill();}
