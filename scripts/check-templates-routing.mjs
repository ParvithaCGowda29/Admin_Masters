import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {set_fs,read,utils,write} from 'xlsx';
set_fs(fs);
const screenshotDir=process.env.UI_SCREENSHOT_DIR||'/downloads';fs.mkdirSync(screenshotDir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
const report=[];
async function readXlsx(path){const wb=read(fs.readFileSync(path));const ws=wb.Sheets[wb.SheetNames[0]];return {sheet:wb.SheetNames[0],rows:utils.sheet_to_json(ws,{header:1})};}
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{try{sessionStorage.setItem('bullm_masters_session','ui-test@example.test')}catch{}});
 for(let i=0;i<30;i++){try{await page.goto('http://127.0.0.1:5173');break}catch{await new Promise(r=>setTimeout(r,100));}}
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();

 // Add files opens one extraction flow: Source, Permission, Find files, Review mapping.
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.getByRole('heading',{name:'Add files',exact:true}).waitFor();
 for(const label of ['Source','Permission','Find files','Review mapping'])await page.locator('.ex-steps').getByText(label,{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/SharePoint/}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:/Google Drive/}).isDisabled(),true);
 assert.ok((await page.getByRole('dialog').allTextContents()).join(' ').includes('Not connected'));
 await page.screenshot({path:screenshotDir+'/masters-bam-menu.png',fullPage:true});
 report.push('Add files opens the extraction flow (Source / Permission / Find files / Review mapping); SharePoint and Google Drive show Not connected and stay disabled.');
 await page.getByRole('button',{name:'Close add files',exact:true}).click();

 // Placement B: the Add templates popup is upload-only; downloads come from the column headers.
 await page.getByRole('button',{name:'Add templates',exact:true}).click();
 assert.equal(await page.locator('.templates-menu a[download]').count(),0);
 assert.equal(await page.locator('.templates-menu').getByRole('menuitem',{name:/Upload your own/}).count(),4);
 await page.screenshot({path:screenshotDir+'/masters-templates-menu.png',fullPage:true});
 report.push('Add templates popup is upload-only: four Upload your own actions, no downloads.');
 await page.keyboard.press('Escape');

 // Placement A: the four backed Organization column headers generate the download on
 // click; with no rows uploaded yet the file is the blank template.
 const headerLinks=page.locator('.ag-header-cell .template-download');
 assert.equal(await headerLinks.count(),4);
 const labels=await headerLinks.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
 for(const column of ['Employees / Job Role','Customers / Audience','Assets (Hardware)','Systems / tools (Software)'])assert.ok(labels.some(l=>l?.includes(column)),`missing ${column}`);
 const [download2]=await Promise.all([page.waitForEvent('download'),page.locator('.template-download[aria-label*="Customers / Audience"]').click()]);
 assert.equal(download2.suggestedFilename(),'Sample - Customers.xlsx');
 const dl2=await readXlsx(await download2.path());
 assert.equal(dl2.rows[0].length,9);assert.equal(dl2.rows.length,1);
 await page.screenshot({path:screenshotDir+'/masters-template-headers.png',fullPage:true});
 report.push('Organization column headers (Employees, Customers, Assets, Systems) download a generated template; empty lists give the blank header row.');

 // Stacked display: top-level commas stack one item per line in the same cell and row.
 await page.evaluate(async()=>{const {saveRows}=await import('/src/provider.ts');saveRows('Tools',[
  {id:'t1',values:['TOOL-MKTG-08','GA4, Search Console, Google Tag Manager, Mixpanel','Analytical tools','TBD','','Active','','','']},
  {id:'t2',values:['TOOL-MKTG-09','Policies (IT, HR, RBAC)','Guidelines','TBD','','Active','','','']},
  {id:'t4',values:['TOOL-MKTG-11','Intake: RFQ pointer; BOM fields, https://x.test:8080/a','Guidelines','TBD','','Active','','','']},
  {id:'t3',values:['TOOL-MKTG-10','Single tool','API','TBD','','Paused','','','']},
 ]);});
 await page.reload();await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:'Tools 4',exact:true}).click();
 await page.getByText('4 of 4 rows',{exact:true}).waitFor();
 assert.deepEqual(await page.locator('[row-id=t1] .stacked-item').allTextContents(),['GA4','Search Console','Google Tag Manager','Mixpanel']);
 assert.deepEqual(await page.locator('[row-id=t4] .stacked-item').allTextContents(),['Intake:','RFQ pointer','BOM fields','https://x.test:8080/a']);
 assert.equal(await page.locator('[row-id=t2] .stacked').count(),0);
 assert.equal(await page.locator('[row-id=t3] .stacked').count(),0);
 const kept=await page.evaluate(async()=>{const {loadRows}=await import('/src/provider.ts');return loadRows('Tools');});
 assert.equal(kept.length,4);assert.equal(kept[0].values[1],'GA4, Search Console, Google Tag Manager, Mixpanel');
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

 // Parent routing: the extraction flow reviews a workbook across every matching tab.
 const book=utils.book_new();
 utils.book_append_sheet(book,utils.aoa_to_sheet([['Org ID','Company / Type'],['ORG-P-1','Parent co']]),'Organization');
 utils.book_append_sheet(book,utils.aoa_to_sheet([['Tooling ID','Tool Name'],['TOOL-P-1','Parent tool']]),'Tools');
 const bytes=Buffer.from(write(book,{type:'array',bookType:'xlsx'}));
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByLabel('Choose files from this device').setInputFiles({name:'masters.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Allow read-only & find files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file goes',exact:true}).waitFor();
 const reviewText=await page.locator('.ex-dialog').allTextContents();
 assert.ok(reviewText[0].includes('Organization')&&reviewText[0].includes('Tools'));
 await page.screenshot({path:screenshotDir+'/masters-parent-bulkall.png',fullPage:true});
 await page.getByRole('button',{name:'Stop extraction',exact:true}).click();
 report.push('On the Masters parent, the flow reviews a workbook across every matching tab.');

 // Tab routing: Choose folder maps every file into the open tab only.
 await page.getByRole('button',{name:'Organization 0',exact:true}).click();
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByLabel('Choose files from this device').setInputFiles([
  {name:'tools.csv',mimeType:'text/csv',buffer:Buffer.from('Org ID,Company / Type\nORG-F-1,Folder co')},
  {name:'org.csv',mimeType:'text/csv',buffer:Buffer.from('Org ID,Company / Type\nORG-F-2,Second co')},
 ]);
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Allow read-only & find files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file goes',exact:true}).waitFor();
 const multiText=await page.locator('.ex-dialog').allTextContents();
 assert.ok(multiText[0].includes('Everything maps into the Organization tab only.'));
 assert.equal((multiText[0].match(/Organization/g)||[]).length>=2,true);
 assert.equal(await page.locator('.ex-table > tbody > tr > td select').count(),0,'no destination dropdown on a tab');
 await page.screenshot({path:screenshotDir+'/masters-tab-routing.png',fullPage:true});
 await page.getByRole('button',{name:'Stop extraction',exact:true}).click();
 report.push('On a specific tab, the flow maps every file into that tab only.');

 // Filetype is read-only: all import choices are disabled there.
 await page.getByRole('button',{name:'Filetype 43',exact:true}).click();
 await page.getByText('43 of 43 rows',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'read-only'}).waitFor();
 assert.equal(await page.getByRole('dialog').count(),0);
 report.push('Filetype stays read-only: Add files shows a read-only notice there and no import flow opens.');

 // Each tab's info panel is specific to that tab; shared README rows stay under the parent.
 await page.getByRole('button',{name:'Agents 0',exact:true}).click();
 await page.getByRole('button',{name:'Information about Agents',exact:true}).hover();
 const agentsPanel=page.getByRole('region',{name:'Agents information',exact:true});
 await agentsPanel.waitFor();
 const agentsText=(await agentsPanel.allTextContents())[0];
 assert.ok(agentsText.includes('AI agents'));
 assert.ok(agentsText.includes('Agent Type'));
 assert.ok(!agentsText.includes('Hierarchy'));
 assert.ok(!agentsText.includes('Workflow step'));
 await page.screenshot({path:screenshotDir+'/masters-agents-info.png',fullPage:true});
 await page.getByRole('heading',{name:'Agents Master',exact:true}).hover();
 await page.waitForTimeout(300);
 await page.getByRole('button',{name:'Information about Masters',exact:true}).hover();
 const parentPanel=page.getByRole('region',{name:'Masters information',exact:true});
 await parentPanel.waitFor();
 assert.ok((await parentPanel.allTextContents())[0].includes('Hierarchy'));
 await page.getByRole('heading',{name:'Agents Master',exact:true}).hover();
 await page.waitForTimeout(300);
 report.push('Tab info panels are tab-specific; shared README rows stay under the Masters parent.');

 // Placement B stays with Add files: the two boxed buttons stack in the sidebar.
 const addBox=await page.getByRole('button',{name:'Add files',exact:true}).boundingBox();
 const tplBox=await page.getByRole('button',{name:'Add templates',exact:true}).boundingBox();
 assert.ok(tplBox.y>addBox.y&&Math.abs(tplBox.x-addBox.x)<2,'Add files and Add templates stack in the sidebar');
 report.push('Add templates stays stacked under Add files in the sidebar.');

 // Filled list templates are held: they are blocked from Masters with the reason shown.
 await page.getByRole('button',{name:'Organization 0',exact:true}).click();
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByLabel('Choose files from this device').setInputFiles({name:'Employee List.csv',mimeType:'text/csv',buffer:Buffer.from('Employee,Job title,Department,Unit applicability,Verification status\nAsha,Engineer,Platform,All,Verified')});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Allow read-only & find files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file goes',exact:true}).waitFor();
 await page.locator('.ex-dialog').getByText(/Add templates/).first().waitFor();
 await page.locator('.ex-dialog').getByText(/not imported into Masters/).first().waitFor();
 assert.equal(await page.getByRole('button',{name:/Import/}).isDisabled(),true);
 await page.screenshot({path:screenshotDir+'/masters-template-blocked.png',fullPage:true});
 await page.getByRole('button',{name:'Close add files',exact:true}).click();
 report.push('Filled list templates are blocked from Masters and pointed at Add templates.');

 // Add rows moved out of the toolbar into the grid's right-click menu.
 await page.getByRole('button',{name:'Tools 4',exact:true}).click();
 await page.getByText('4 of 4 rows',{exact:true}).waitFor();
 assert.equal(await page.locator('.toolbar .add-rows').count(),0);
 await page.locator('.ag-row[row-id=t1]').first().click({button:'right'});
 await page.getByRole('menuitem',{name:'Add row',exact:true}).waitFor();
 await page.getByRole('menuitem',{name:'Delete row',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/masters-context-menu.png'});
 await page.getByRole('menuitem',{name:'Add row',exact:true}).click();
 await page.getByText('5 of 5 rows',{exact:true}).waitFor();
 await page.keyboard.press('Escape');
 report.push('Add rows lives in the right-click menu (with delete); the toolbar holds only search.');

 // Add templates: a user's own filled template maps into the template's fields and lands
 // in that template's list, never in a master tab.
 await page.getByRole('button',{name:'Add templates',exact:true}).click();
 await page.locator('.template-item',{hasText:'Employee list'}).getByRole('menuitem',{name:/Upload your own/}).click();
 await page.getByRole('heading',{name:'Upload your own Employee list template',exact:true}).waitFor();
 await page.locator('.bulk-dialog input[type=file]').setInputFiles({name:'my-employees.csv',mimeType:'text/csv',buffer:Buffer.from('Employee,Job title,Department,Unit applicability,Verification status\nAsha,Engineer,Platform,All,Verified\nBala,Designer,Product,Unit 1,Pending')});
 await page.getByRole('button',{name:'Add 2 new rows',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/masters-template-upload.png'});
 await page.getByRole('button',{name:'Add 2 new rows',exact:true}).click();
 await page.getByRole('status').filter({hasText:'added to your Employee list template'}).waitFor();
 await page.getByRole('button',{name:'Add templates',exact:true}).click();
 await page.screenshot({path:screenshotDir+'/masters-add-templates-menu.png'});
 assert.ok((await page.locator('.templates-menu').allTextContents()).join(' ').includes('2 rows'));
 await page.getByRole('menuitem',{name:'View / edit',exact:true}).click();
 await page.getByRole('heading',{name:'Employee list',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/masters-template-list.png'});
 await page.getByRole('textbox',{name:'Employee (row 1)',exact:true}).fill('Asha R');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 const savedLists=await page.evaluate(()=>localStorage.getItem('bullm-template-lists-v1'));
 assert.ok(savedLists?.includes('Asha R'),'edited template list row persisted');
 await page.getByRole('button',{name:'Organization 0',exact:true}).waitFor();
 report.push('Custom template upload maps columns into the template fields; rows stay in the Add templates list, editable, masters untouched.');

 // Regression: after uploading rows, the header download must serve the current list,
 // not the old blank template. The download icons live on the Organization tab.
 await page.getByRole('button',{name:'Organization 0',exact:true}).click();
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 const [download3]=await Promise.all([page.waitForEvent('download'),page.locator('.template-download[aria-label*="Employees / Job Role"]').click()]);
 assert.equal(download3.suggestedFilename(),'Employee List.xlsx');
 const dl3=await readXlsx(await download3.path());
 assert.equal(dl3.sheet,'Employee List');
 assert.deepEqual(dl3.rows[0],['Employee','Job title','Department','Unit applicability','Verification status']);
 assert.equal(dl3.rows.length,3);
 assert.equal(dl3.rows[1][0],'Asha R');
 assert.equal(dl3.rows[2][0],'Bala');
 report.push('After an upload, the header download contains the current list rows (Asha R, Bala), not the old blank template.');

 // Clean capture of placement A: the four Organization column headers with template downloads.
 await page.setViewportSize({width:3000,height:1000});
 await page.mouse.move(700,500);
 await page.waitForTimeout(300);
 await page.locator('.ag-header').screenshot({path:screenshotDir+'/masters-template-headers.png'});
 await page.setViewportSize({width:1440,height:1000});

 assert.deepEqual(errors,[]);
 report.push('No browser page errors.');
 console.log(report.join('\n'));
}finally{await browser.close();server.kill();}
