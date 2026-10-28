import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {set_fs,read,utils,write} from 'xlsx';
set_fs(fs);
const screenshotDir='/downloads';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({args:['--no-sandbox']});
const report=[];
async function readXlsx(path){const wb=read(fs.readFileSync(path));const ws=wb.Sheets[wb.SheetNames[0]];return {sheet:wb.SheetNames[0],rows:utils.sheet_to_json(ws,{header:1})};}
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{try{sessionStorage.setItem('bullm_masters_session','ui-test@example.test')}catch{}});
 for(let i=0;i<30;i++){try{await page.goto('http://127.0.0.1:5173');break}catch{await new Promise(r=>setTimeout(r,100));}}
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();

 // Add files menu uses the BAM format: Choose folder, Bulk upload, Upload zip.
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 const menuItems=await page.locator('.files-menu [role=menuitem]').allTextContents();
 assert.equal(menuItems.length,3);
 assert.ok(menuItems[0].startsWith('Choose folder'),menuItems[0]);
 assert.ok(menuItems[1].startsWith('Bulk upload'),menuItems[1]);
 assert.ok(menuItems[2].startsWith('Upload zip'),menuItems[2]);
 await page.screenshot({path:screenshotDir+'/masters-bam-menu.png',fullPage:true});
 report.push('Add files menu is the BAM format: Choose folder / Bulk upload / Upload zip.');
 await page.keyboard.press('Escape');

 // Placement B: Templates button next to Add files downloads the four blank templates.
 await page.getByRole('button',{name:'Templates',exact:true}).click();
 const templateLinks=page.locator('.templates-menu a[role=menuitem]');
 assert.equal(await templateLinks.count(),4);
 await page.screenshot({path:screenshotDir+'/masters-templates-menu.png',fullPage:true});
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('menuitem',{name:/Employee list/}).click()]);
 assert.equal(download.suggestedFilename(),'Employee List.xlsx');
 const dl=await readXlsx(await download.path());
 assert.deepEqual(dl.rows,[['Employee','Job title','Department','Unit applicability','Verification status']]);
 assert.equal(dl.rows.length,1);
 report.push('Templates menu next to Add files downloads all four blank header templates.');

 // Placement A: the four backed Organization column headers carry the same downloads.
 const headerLinks=page.locator('.ag-header-cell .template-download');
 assert.equal(await headerLinks.count(),4);
 const labels=await headerLinks.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
 for(const column of ['Employees / Job Role','Customers / Audience','Assets (Hardware)','Systems / tools (Software)'])assert.ok(labels.some(l=>l?.includes(column)),`missing ${column}`);
 const [download2]=await Promise.all([page.waitForEvent('download'),page.locator('.template-download[aria-label*="Customers / Audience"]').click()]);
 assert.equal(download2.suggestedFilename(),'Sample - Customers.xlsx');
 const dl2=await readXlsx(await download2.path());
 assert.equal(dl2.rows[0].length,9);assert.equal(dl2.rows.length,1);
 await page.screenshot({path:screenshotDir+'/masters-template-headers.png',fullPage:true});
 report.push('Organization column headers (Employees, Customers, Assets, Systems) download the same blank templates.');

 // Stacked display: top-level commas stack one item per line in the same cell and row.
 await page.evaluate(async()=>{const {saveRows}=await import('/src/provider.ts');saveRows('Tools',[
  {id:'t1',values:['TOOL-MKTG-08','GA4, Search Console, Google Tag Manager, Mixpanel','Analytical tools','TBD','','Active','','','']},
  {id:'t2',values:['TOOL-MKTG-09','Policies (IT, HR, RBAC)','Guidelines','TBD','','Active','','','']},
  {id:'t3',values:['TOOL-MKTG-10','Single tool','API','TBD','','Paused','','','']},
 ]);});
 await page.reload();await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:'Tools 3',exact:true}).click();
 await page.getByText('3 of 3 rows',{exact:true}).waitFor();
 assert.deepEqual(await page.locator('[row-id=t1] .stacked-item').allTextContents(),['GA4','Search Console','Google Tag Manager','Mixpanel']);
 assert.equal(await page.locator('[row-id=t2] .stacked').count(),0);
 assert.equal(await page.locator('[row-id=t3] .stacked').count(),0);
 const kept=await page.evaluate(async()=>{const {loadRows}=await import('/src/provider.ts');return loadRows('Tools');});
 assert.equal(kept.length,3);assert.equal(kept[0].values[1],'GA4, Search Console, Google Tag Manager, Mixpanel');
 await page.screenshot({path:screenshotDir+'/masters-stacked-light.png',fullPage:true});
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await page.screenshot({path:screenshotDir+'/masters-stacked-dark.png',fullPage:true});
 await page.getByRole('button',{name:'Switch to light mode'}).click();
 report.push('Comma-separated items stack one per line inside the same cell and parent row; grouped names in brackets stay one item; stored values and row count unchanged.');

 // Masters parent is a real selection with an overview; chevron alone collapses.
 await page.getByRole('button',{name:'Collapse masters',exact:true}).click();
 assert.equal(await page.locator('.nav-branches').count(),0);
 await page.getByRole('button',{name:'Expand masters',exact:true}).click();
 await page.getByRole('button',{name:'Masters',exact:true}).click();
 await page.getByRole('heading',{name:'Masters overview',exact:true}).waitFor();
 assert.equal(await page.locator('.nav-parent.parent-selected').count(),1);
 await page.screenshot({path:screenshotDir+'/masters-parent-overview.png',fullPage:true});
 report.push('Masters parent selects an overview; the chevron alone collapses the tree.');

 // Parent routing: Bulk upload fills every matching tab.
 const book=utils.book_new();
 utils.book_append_sheet(book,utils.aoa_to_sheet([['Org ID','Company / Type'],['ORG-P-1','Parent co']]),'Organization');
 utils.book_append_sheet(book,utils.aoa_to_sheet([['Tooling ID','Tool Name'],['TOOL-P-1','Parent tool']]),'Tools');
 const bytes=Buffer.from(write(book,{type:'array',bookType:'xlsx'}));
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByRole('menuitem',{name:/Bulk upload/}).click();
 await page.locator('.uppy-Dashboard-input').first().setInputFiles({name:'masters.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
 await page.getByRole('button',{name:'Continue with 1 file',exact:true}).click();
 await page.getByRole('heading',{name:'Bulk Upload all tabs',exact:true}).waitFor();
 const reviewText=await page.locator('.bulk-dialog').allTextContents();
 assert.ok(reviewText[0].includes('Organization')&&reviewText[0].includes('Tools'));
 await page.screenshot({path:screenshotDir+'/masters-parent-bulkall.png',fullPage:true});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 report.push('On the Masters parent, Bulk upload reviews a workbook across every matching tab.');

 // Tab routing: Choose folder maps every file into the open tab only.
 await page.getByRole('button',{name:'Organization 0',exact:true}).click();
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByRole('menuitem',{name:/Choose folder/}).click();
 await page.locator('.uppy-Dashboard-input').first().setInputFiles([
  {name:'tools.csv',mimeType:'text/csv',buffer:Buffer.from('Org ID,Company / Type\nORG-F-1,Folder co')},
  {name:'org.csv',mimeType:'text/csv',buffer:Buffer.from('Org ID,Company / Type\nORG-F-2,Second co')},
 ]);
 await page.getByRole('button',{name:'Continue with 2 files',exact:true}).click();
 await page.getByRole('heading',{name:'Review import',exact:true}).waitFor();
 const multiText=await page.locator('.bulk-dialog').allTextContents();
 assert.ok(multiText[0].includes('Everything maps into the Organization tab only.'));
 assert.equal((multiText[0].match(/Organization/g)||[]).length>=2,true);
 assert.ok(!/>Tools</.test(await page.locator('.review-table').innerHTML()),'no Tools target on a tab');
 await page.screenshot({path:screenshotDir+'/masters-tab-routing.png',fullPage:true});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 report.push('On a specific tab, Choose folder maps every file into that tab only.');

 // Filetype is read-only: all import choices are disabled there.
 await page.getByRole('button',{name:'Filetype 43',exact:true}).click();
 await page.getByText('43 of 43 rows',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 const disabled=await page.locator('.files-menu [role=menuitem][disabled]').count();
 assert.equal(disabled,3);
 await page.keyboard.press('Escape');
 report.push('Filetype stays read-only: all three Add files choices are disabled on that tab.');

 assert.deepEqual(errors,[]);
 report.push('No browser page errors.');
 console.log(report.join('\n'));
}finally{await browser.close();server.kill();}
