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
  await page.getByRole('heading',{name:'Allow read-only access to your files',exact:true}).waitFor();
  await page.getByRole('button',{name:'Allow read-only & find files',exact:true}).click();
  await page.getByRole('heading',{name:'Review where each file goes',exact:true}).waitFor();
 }
 await page.getByRole('button',{name:'Masters',exact:true}).click();
 await openFlow();
 await page.screenshot({path:screenshotDir+'/ex-1-source-light.png'});
 assert.equal(await page.getByRole('button',{name:/SharePoint/}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:/Google Drive/}).isDisabled(),true);
 assert.ok((await page.getByRole('dialog').allTextContents()).join(' ').includes('Not connected'));
 report.push('Source step: This device is the only working source; SharePoint and Google Drive are disabled with Not connected.');

 await page.getByLabel('Choose files from this device').setInputFiles({name:'masters.xlsx',mimeType:xlsxType,buffer:mixed});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'Allow read-only access to your files',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/ex-2-permission-light.png'});
 const permText=(await page.getByRole('dialog').allTextContents()).join(' ').replace(/\s+/g,' ');
 assert.ok(permText.includes('masters.xlsx')&&permText.includes('this extraction job')&&permText.includes('stop the job at any time'));
 report.push('Permission step lists the real picked files, the read-only scope, the job-only limit and the stop wording.');
 await page.getByRole('button',{name:'Allow read-only & find files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file goes',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/ex-3-review-light.png'});

 const dialogText=()=>page.getByRole('dialog').allTextContents().then(t=>t.join(' ').replace(/\s+/g,' '));
 assert.ok(/2\s*tables found/.test(await dialogText()));
 assert.ok(/ready to import/.test(await dialogText()));
 // The unrelated sheet stays visible but unticked and is never imported.
 const leaveRow=page.locator('.ex-table tr',{hasText:'Leave approvals'});
 assert.ok((await leaveRow.allTextContents()).join(' ').match(/no columns match|unmapped/));
 assert.equal(await leaveRow.locator('input[type=checkbox]').count(),0);
 assert.equal(await page.getByRole('button',{name:'Import 1 ready table',exact:true}).count(),1);
 report.push('Review: matching sheet is ticked and ready; the unrelated sheet stays listed, unticked, with no include checkbox.');

 await page.getByRole('button',{name:'Import 1 ready table',exact:true}).click();
 await page.getByRole('status').filter({hasText:'2 new rows added'}).waitFor();
 report.push('Import appends only the ready table: 2 rows into Organization.');

 await page.getByRole('button',{name:/Organization 2/,exact:true}).click();
 await page.getByText('2 of 2 rows',{exact:true}).waitFor();
 for(const tab of ['Rules','Skills','Tools','Agents']){
  await page.getByRole('button',{name:new RegExp('^'+tab+' '),exact:true}).click();
  await page.getByText('0 of 0 rows',{exact:true}).waitFor();
 }
 report.push('The unrelated Leave approvals sheet landed nowhere: every other editable tab stays empty.');

 // Re-importing the same file skips the already-present rows instead of duplicating them.
 await page.getByRole('button',{name:'Masters',exact:true}).click();
 await openFlow();
 await toReview({name:'masters.xlsx',mimeType:xlsxType,buffer:mixed});
 await page.getByRole('button',{name:'Import 1 ready table',exact:true}).click();
 await page.getByRole('status').filter({hasText:'already-present'}).waitFor();
 await page.getByRole('button',{name:/Organization 2/,exact:true}).click();
 await page.getByText('2 of 2 rows',{exact:true}).waitFor();
 report.push('Re-import is guarded: already-present rows are skipped, count stays 2.');

 // A changed value on an existing ID is flagged and never overwrites the stored row.
 const changedCsv=[orgHeaders.slice(0,2),['ORG-T-1','CHANGED NAME']].map(r=>r.join(',')).join('\n');
 await openFlow();
 await toReview({name:'Organization.csv',mimeType:'text/csv',buffer:Buffer.from(changedCsv)});
 // 2 of 12 columns -> low match, unticked; the user ticks it deliberately.
 await page.getByRole('checkbox',{name:'Include CSV from Organization.csv'}).check();
 await page.getByRole('button',{name:'Import 1 ready table',exact:true}).click();
 await page.getByRole('status').filter({hasText:'not overwritten'}).waitFor();
 await page.reload();await page.getByText('2 of 2 rows',{exact:true}).waitFor();
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
 await page.getByRole('button',{name:'Allow read-only & find files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file goes',exact:true}).waitFor();
 const reviewText=await dialogText();
 assert.ok(reviewText.includes('agents.csv')&&!reviewText.includes('tools.csv'));
 await page.getByRole('button',{name:'Stop extraction',exact:true}).click();
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:/Agents 0/,exact:true}).click();
 await page.getByText('0 of 0 rows',{exact:true}).waitFor();
 report.push('Unticking a file on the permission step excludes it completely; Stop extraction imports nothing.');

 // Filled Add templates files are held back with the reason, never imported into Masters.
 await openFlow();
 await toReview({name:'Employee List.csv',mimeType:'text/csv',buffer:Buffer.from('Employee,Job title,Department,Unit applicability,Verification status\nAsha,Engineer,Platform,All,Verified')});
 const blockedText=await dialogText();
 assert.ok(blockedText.includes('Add templates')&&blockedText.includes('not imported into Masters'));
 assert.equal(await page.getByRole('button',{name:/Import/}).isDisabled(),true);
 await page.getByRole('button',{name:'Close add files',exact:true}).click();
 report.push('Filled list templates stay blocked from Masters and point at Add templates.');

 // Dark theme over the same flow.
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await openFlow();
 await page.screenshot({path:screenshotDir+'/ex-4-source-dark.png'});
 await page.getByLabel('Choose files from this device').setInputFiles({name:'masters.xlsx',mimeType:xlsxType,buffer:mixed});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.screenshot({path:screenshotDir+'/ex-5-permission-dark.png'});
 await page.getByRole('button',{name:'Allow read-only & find files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file goes',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/ex-6-review-dark.png'});
 await page.getByRole('button',{name:'Close add files',exact:true}).click();
 report.push('Dark theme renders across source, permission and review steps.');

 assert.deepEqual(errors,[]);
 report.push('No browser page errors.');
 console.log(report.join('\n'));
}finally{await browser.close();server.kill();}
