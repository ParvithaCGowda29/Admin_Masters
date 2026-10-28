import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
const screenshotDir=process.env.UI_SCREENSHOT_DIR||path.join(os.tmpdir(),'masters-ui-review');fs.mkdirSync(screenshotDir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{try{sessionStorage.setItem('bullm_masters_session','ui-test@example.test')}catch{}});
 for(let i=0;i<30;i++){try{await page.goto('http://127.0.0.1:5173');break}catch{await new Promise(r=>setTimeout(r,100));}}
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.evaluate(async()=>{const {saveRows}=await import('/src/provider.ts');saveRows('Organization',[{id:'org-persist',values:['ORG-EXISTING','Existing business','','Bengaluru','','','','','','','','Keep me']}]);});await page.reload();await page.getByText('1 of 1 rows',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'README',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Upload',exact:true}).count(),0);
 await page.screenshot({path:screenshotDir+'/masters-light.png',fullPage:true});
 await page.getByRole('button',{name:'Information about Organization',exact:true}).hover();
 await page.getByRole('region',{name:'Organization information',exact:true}).waitFor();
 await page.getByRole('region',{name:'Organization information',exact:true}).hover();await page.waitForTimeout(250);assert.equal(await page.getByRole('region',{name:'Organization information',exact:true}).count(),1);
 await page.screenshot({path:screenshotDir+'/masters-info.png',fullPage:true});
 await page.getByRole('heading',{name:'Organization Master',exact:true}).hover();
 await page.getByRole('button',{name:'Collapse masters',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Tools 0'}).count(),0);await page.getByRole('button',{name:'Expand masters',exact:true}).click();
 await page.getByRole('button',{name:'Masters',exact:true}).click();await page.getByRole('heading',{name:'Masters overview',exact:true}).waitFor();await page.screenshot({path:screenshotDir+'/masters-parent.png',fullPage:true});
 await page.getByRole('button',{name:/Organization 1/,exact:true}).click();await page.getByText('1 of 1 rows',{exact:true}).waitFor();
 // Test representative records in a disposable browser context, never in the shipped workbook.
 await page.evaluate(async()=>{
 const {saveRows}=await import('/src/provider.ts');
 saveRows('Tools',[
 {id:'t1',values:['TOOL-01','Internal search','API','https://example.test/api','BuLLM','Active','v1','Daily','RULE-01']},
 {id:'t2',values:['TOOL-02','Document lookup','MCP','https://example.test/mcp','Customer','Active','v2','Weekly','RULE-02']},
 {id:'t3',values:['TOOL-03','Cost estimator','API','/tools/estimate','BuLLM','Paused','v1','Daily','RULE-03']}
 ]);
 });
 await page.getByRole('button',{name:'Tools 0',exact:true}).click();
 await page.getByText('3 of 3 rows',{exact:true}).waitFor();
 await page.locator('summary').filter({hasText:/^Category/}).click();await page.getByLabel('API',{exact:false}).check();
 await page.getByText('2 of 3 rows',{exact:true}).waitFor();
 await page.locator('summary').filter({hasText:/^Category/}).click();
 await page.locator('summary').filter({hasText:/^Status/}).click();await page.getByLabel('Active',{exact:false}).check();
 await page.getByText('1 of 3 rows',{exact:true}).waitFor();
 await page.locator('summary').filter({hasText:/^Status/}).click();
 await page.screenshot({path:screenshotDir+'/masters-facets.png',fullPage:true});
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await page.screenshot({path:screenshotDir+'/masters-dark.png',fullPage:true});
 await page.reload();await page.getByRole('button',{name:'Switch to light mode'}).waitFor();
 await page.getByRole('button',{name:'Add files',exact:true}).click();await page.screenshot({path:screenshotDir+'/masters-addfiles-dark.png',fullPage:true});
 await page.getByRole('menuitem',{name:/Bulk upload/}).click();
 await page.getByRole('dialog').waitFor();await page.screenshot({path:screenshotDir+'/masters-picker-dark.png',fullPage:true});await page.getByRole('button',{name:'Close file picker'}).click();
 await page.getByRole('button',{name:'Filetype 43',exact:true}).click();await page.getByText('43 of 43 rows',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'＋ Add Row',exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Toggle navigation'}).click();await page.screenshot({path:screenshotDir+'/masters-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:/Organization 1/,exact:true}).click();await page.getByText('1 of 1 rows',{exact:true}).waitFor();
 // Exercise the retained Add files > Uppy > review path and duplicate guard.
 async function selectCSV(){
 await page.getByRole('button',{name:'Add files',exact:true}).click();await page.getByRole('menuitem',{name:/Bulk upload/}).click();
 await page.locator('.uppy-Dashboard-input').first().setInputFiles({name:'Organization.csv',mimeType:'text/csv',buffer:Buffer.from('Org ID,Company / Type,Location\nORG-IMPORT,Imported business,Mysuru')});
 await page.getByRole('button',{name:'Continue with 1 file',exact:true}).click();await page.getByRole('heading',{name:'Bulk Upload to Organization',exact:true}).waitFor();
 }
 await selectCSV();await page.getByRole('button',{name:'Import 1 new row',exact:true}).click();await page.getByText('2 of 2 rows',{exact:true}).waitFor();
 await selectCSV();await page.getByText(/1 already present will be skipped/).waitFor();assert(await page.getByRole('button',{name:'Import new rows',exact:true}).isDisabled());await page.getByRole('button',{name:'Close bulk upload'}).click();
 await page.locator('.ag-center-cols-container [row-id="org-persist"] [col-id="1"]').dblclick();const editor=page.locator('.ag-large-text-input textarea');await editor.fill('Edited business');await page.keyboard.press('Control+Enter');await page.getByRole('status').filter({hasText:'Changes saved on this device.'}).waitFor();
 await page.reload();await page.getByText('2 of 2 rows',{exact:true}).waitFor();
 const saved=await page.evaluate(async()=>{const {loadRows}=await import('/src/provider.ts');return loadRows('Organization')});assert.equal(saved[0].values[11],'Keep me');assert.equal(saved[0].values[1],'Edited business');assert.equal(saved.length,2);
 assert.deepEqual(errors,[]);console.log('UI tests passed: tree, info, additive facets, removed Upload/README, theme persistence, picker, protected Filetype, mobile.');
}finally{await browser.close();server.kill();}
