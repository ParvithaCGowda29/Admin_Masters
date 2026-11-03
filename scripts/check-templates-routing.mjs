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

 // Add files opens one extraction flow: Source, Permission, Fetch files, Mapping. The intake
 // is three options (Choose folder / Bulk upload / Zip upload); each opens the Uppy
 // dashboard in a popup instead of an inline dropzone.
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.getByRole('heading',{name:'Add files',exact:true}).waitFor();
 for(const label of ['Source','Permission','Fetch files','Mapping'])await page.locator('.ex-steps').getByText(label,{exact:true}).waitFor();
 assert.deepEqual(await page.locator('.ex-option strong').allTextContents(),['Choose folder','Bulk upload','Zip upload']);
 assert.equal(await page.locator('.uppy-Dashboard').count(),0,'no inline dropzone on the Source step');
 await page.getByRole('button',{name:/Bulk upload/}).click();
 await page.getByRole('dialog',{name:'Bulk upload'}).locator('.uppy-Dashboard-inner').waitFor();
 await page.getByRole('button',{name:'Close file picker',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:/SharePoint/}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:/Google Drive/}).isDisabled(),true);
 assert.ok((await page.getByRole('dialog').allTextContents()).join(' ').includes('Not connected'));
 await page.screenshot({path:screenshotDir+'/masters-bam-menu.png',fullPage:true});
 report.push('Add files opens the extraction flow (Source / Permission / Fetch files / Mapping) with the three upload options each opening the Uppy dashboard in a popup; SharePoint and Google Drive show Not connected and stay disabled.');

 // Onyx source: configure against a stubbed server, test, save; ticked files then go to
 // Onyx on the fetch step and the review reports the handoff.
 await page.route('**/api/me/permissions',route=>route.fulfill({status:200,contentType:'application/json',body:'{"permissions":[],"is_owner":false}'}));
 let onyxUploads=0;
 await page.route('**/api/user/projects/file/upload',route=>{onyxUploads++;return route.fulfill({status:200,contentType:'application/json',body:'{"user_files":[]}'});});
 await page.getByRole('button',{name:/Onyx/}).click();
 await page.getByRole('heading',{name:'Connect Onyx',exact:true}).waitFor();
 await page.getByLabel('Server URL',{exact:true}).fill('https://onyx.example.test');
 await page.getByLabel('API key or token',{exact:true}).fill('test-token');
 await page.getByRole('button',{name:'Test connection',exact:true}).click();
 await page.getByText('Connected. Onyx accepted the token.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Save connection',exact:true}).click();
 await page.locator('.ex-source',{hasText:'Onyx'}).getByText('Connected',{exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/masters-onyx-connected.png',fullPage:true});
 await page.getByLabel('Choose files from this device').setInputFiles({name:'org.csv',mimeType:'text/csv',buffer:Buffer.from('Org ID,Company / Type\nORG-O-1,Onyx co')});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Allow read-write & fetch files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file maps',exact:true}).waitFor();
 await page.locator('.ex-dialog').getByText(/sent to Onyx/).first().waitFor();
 assert.equal(onyxUploads,1);
 report.push('Onyx source: connect + test + save works, ticked files are sent to Onyx on the fetch step and the review reports the handoff.');
 await page.getByRole('button',{name:'Stop extraction',exact:true}).click();

 // Placement B: Add templates opens the finalised wireframe modal with the three source cards.
 await page.getByRole('button',{name:'Add templates',exact:true}).click();
 const tplDialog=page.locator('.templates-dialog');
 await tplDialog.getByRole('heading',{name:'Add templates',exact:true}).waitFor();
 await tplDialog.getByText('Pick where the template for a master list comes from.',{exact:true}).waitFor();
 await tplDialog.locator('.tpl-card.recommended').getByText('Recommended templates',{exact:true}).waitFor();
 for(const name of ['Use recommended','Upload your own',"Upload client's"])await tplDialog.getByRole('button',{name,exact:true}).waitFor();
 assert.ok((await tplDialog.allTextContents()).join(' ').includes('Organization column headers'));
 await page.screenshot({path:screenshotDir+'/masters-templates-menu.png',fullPage:true});
 report.push('Add templates opens the wireframe modal: recommended / your own / client cards with one action each, and the download note pointing at the Organization column headers.');
 await tplDialog.getByRole('button',{name:'Close',exact:true}).click();

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
  {id:'t1',values:['TOOL-MKTG-08','GA4, Search Console, Google Tag Manager, Mixpanel','Analytical tools','TBD','','Active','','','','','','']},
  {id:'t2',values:['TOOL-MKTG-09','Policies (IT, HR, RBAC)','Guidelines','TBD','','Active','','','','','','']},
  {id:'t4',values:['TOOL-MKTG-11','Intake: RFQ pointer; BOM fields, https://x.test:8080/a','Guidelines','TBD','','Active','','','','','','']},
  {id:'t3',values:['TOOL-MKTG-10','Single tool','API','TBD','','Paused','','','','','','']},
 ]);});
 await page.reload();await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:'Tool Factory 4',exact:true}).click();
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
 assert.equal(await page.locator('#masters-branches').count(),0);
 assert.equal(await page.locator('#admin-branches').count(),1);
 await page.getByRole('button',{name:'Expand masters',exact:true}).click();
 await page.getByRole('button',{name:'Collapse admin',exact:true}).click();
 assert.equal(await page.locator('#admin-branches').count(),0);
 assert.equal(await page.locator('#masters-branches').count(),1);
 await page.getByRole('button',{name:'Expand admin',exact:true}).click();
 await page.getByRole('button',{name:'Masters',exact:true}).click();
 await page.getByRole('heading',{name:'Masters overview',exact:true}).waitFor();
 assert.equal(await page.locator('.nav-parent.parent-selected').count(),1);
 await page.screenshot({path:screenshotDir+'/masters-parent-overview.png',fullPage:true});
 report.push('Masters parent selects an overview; the chevron alone collapses the tree; the Admin tree collapses independently.');

 // Parent routing: the extraction flow reviews a workbook across every matching tab.
 const book=utils.book_new();
 utils.book_append_sheet(book,utils.aoa_to_sheet([['Org ID','Company / Type'],['ORG-P-1','Parent co']]),'Organization');
 utils.book_append_sheet(book,utils.aoa_to_sheet([['Tooling ID','Tool Name'],['TOOL-P-1','Parent tool']]),'Tools');
 const bytes=Buffer.from(write(book,{type:'array',bookType:'xlsx'}));
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByLabel('Choose files from this device').setInputFiles({name:'masters.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
 await page.getByRole('button',{name:/Bulk upload/}).click();
 await page.locator('.uppy-Dashboard-Item').first().waitFor();
 await page.getByRole('button',{name:'Close file picker',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Allow read-write & fetch files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file maps',exact:true}).waitFor();
 const reviewText=await page.locator('.ex-dialog').allTextContents();
 assert.ok(reviewText[0].includes('Organization')&&reviewText[0].includes('Tools'));
 await page.screenshot({path:screenshotDir+'/masters-parent-bulkall.png',fullPage:true});
 await page.getByRole('button',{name:'Stop extraction',exact:true}).click();
 report.push('On the Masters parent, the flow reviews a workbook across every matching tab.');

 // Tab routing: Choose folder maps every file into the open tab only.
 await page.getByRole('button',{name:'Organization 3',exact:true}).click();
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByLabel('Choose files from this device').setInputFiles([
  {name:'tools.csv',mimeType:'text/csv',buffer:Buffer.from('Org ID,Company / Type\nORG-F-1,Folder co')},
  {name:'org.csv',mimeType:'text/csv',buffer:Buffer.from('Org ID,Company / Type\nORG-F-2,Second co')},
 ]);
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Allow read-write & fetch files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file maps',exact:true}).waitFor();
 const multiText=await page.locator('.ex-dialog').allTextContents();
 assert.ok(multiText[0].includes('Everything maps into the Organization tab only.'));
 assert.equal((multiText[0].match(/Organization/g)||[]).length>=2,true);
 assert.equal(await page.locator('.ex-table > tbody > tr > td select').count(),0,'no destination dropdown on a tab');
 await page.screenshot({path:screenshotDir+'/masters-tab-routing.png',fullPage:true});
 await page.getByRole('button',{name:'Stop extraction',exact:true}).click();
 report.push('On a specific tab, the flow maps every file into that tab only.');

 // Each tab's info panel is specific to that tab; shared README rows stay under the parent.
 await page.getByRole('button',{name:'Agents 18',exact:true}).click();
 await page.getByRole('button',{name:'Information about Agents',exact:true}).hover();
 const agentsPanel=page.getByRole('region',{name:'Agents information',exact:true});
 await agentsPanel.waitFor();
 const agentsText=(await agentsPanel.allTextContents())[0];
 assert.ok(agentsText.includes('AI agents'));
 assert.ok(agentsText.includes('Steps (skills)'));
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
 await page.getByRole('button',{name:'Organization 3',exact:true}).click();
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByLabel('Choose files from this device').setInputFiles({name:'Employee List.csv',mimeType:'text/csv',buffer:Buffer.from('Employee,Job title,Department,Unit applicability,Verification status\nAsha,Engineer,Platform,All,Verified')});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Allow read-write & fetch files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file maps',exact:true}).waitFor();
 await page.locator('.ex-dialog').getByText(/Add templates/).first().waitFor();
 await page.locator('.ex-dialog').getByText(/not imported into Masters/).first().waitFor();
 assert.equal(await page.getByRole('button',{name:/^Import/}).isDisabled(),true);
 await page.screenshot({path:screenshotDir+'/masters-template-blocked.png',fullPage:true});
 await page.getByRole('button',{name:'Close add files',exact:true}).click();
 report.push('Filled list templates are blocked from Masters and pointed at Add templates.');

 // Add rows moved out of the toolbar into the grid's right-click menu.
 await page.getByRole('button',{name:'Tool Factory 4',exact:true}).click();
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

 // Add templates: uploading a new template replaces that template completely - the
 // file's column names and rows take over, never touching a master tab.
 await page.getByRole('button',{name:'Add templates',exact:true}).click();
 await page.locator('.templates-dialog').getByRole('button',{name:'Upload your own',exact:true}).click();
 await page.getByRole('heading',{name:'Upload a new Employee list template',exact:true}).waitFor();
 await page.locator('.bulk-dialog input[type=file]').setInputFiles({name:'my-employees.csv',mimeType:'text/csv',buffer:Buffer.from('Employee,Job title,Department,Unit applicability,Verification status\nAsha,Engineer,Platform,All,Verified\nBala,Designer,Product,Unit 1,Pending')});
 await page.getByRole('button',{name:'Replace template',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/masters-template-upload.png'});
 await page.getByRole('button',{name:'Replace template',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Employee list template now uses the uploaded file'}).waitFor();
 await page.getByRole('button',{name:'Add templates',exact:true}).click();
 await page.screenshot({path:screenshotDir+'/masters-add-templates-menu.png'});
 await page.locator('.templates-dialog').getByRole('button',{name:/Employee list/}).click();
 await page.getByRole('heading',{name:'Employee list',exact:true}).waitFor();
 await page.screenshot({path:screenshotDir+'/masters-template-list.png'});
 await page.getByRole('textbox',{name:'Employee (row 1)',exact:true}).fill('Asha R');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 const savedLists=await page.evaluate(()=>localStorage.getItem('bullm-template-lists-v1'));
 assert.ok(savedLists?.includes('Asha R'),'edited template list row persisted');
 await page.getByRole('button',{name:'Organization 3',exact:true}).waitFor();
 report.push('A new template upload replaces that template (columns and rows); rows stay in the Add templates list, editable, masters untouched.');

 // Regression: after uploading rows, the header download must serve the current list,
 // not the old blank template. The download icons live on the Organization tab.
 await page.getByRole('button',{name:'Organization 3',exact:true}).click();
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

 // Regression: a file with completely new column names replaces the Customers template;
 // the header download then serves the new structure, and the other lists stay untouched.
 await page.getByRole('button',{name:'Add templates',exact:true}).click();
 await page.locator('.templates-dialog').getByRole('button',{name:'Upload your own',exact:true}).click();
 await page.getByRole('heading',{name:'Upload a new Employee list template',exact:true}).waitFor();
 await page.getByLabel('List',{exact:true}).selectOption('customers');
 await page.getByRole('heading',{name:'Upload a new Customers / Audience template',exact:true}).waitFor();
 await page.locator('.bulk-dialog input[type=file]').setInputFiles({name:'customers-new.csv',mimeType:'text/csv',buffer:Buffer.from('Client code,Client name,Market segment\nCL-SMPL-01,Asha Textiles,D2C\nCL-SMPL-02,Bala Foods,Retail')});
 await page.getByRole('button',{name:'Replace template',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Customers / Audience template now uses the uploaded file'}).waitFor();
 await page.getByRole('button',{name:'Add templates',exact:true}).click();
 assert.ok((await page.locator('.templates-dialog').allTextContents()).join(' ').includes('3 columns'),'card shows the replaced column count');
 await page.screenshot({path:screenshotDir+'/masters-add-templates-menu.png'});
 await page.locator('.templates-dialog').getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Organization 3',exact:true}).click();
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 const [download4]=await Promise.all([page.waitForEvent('download'),page.locator('.template-download[aria-label*="Customers / Audience"]').click()]);
 assert.equal(download4.suggestedFilename(),'Sample - Customers.xlsx');
 const dl4=await readXlsx(await download4.path());
 assert.deepEqual(dl4.rows[0],['Client code','Client name','Market segment']);
 assert.equal(dl4.rows.length,3);
 assert.equal(dl4.rows[1][0],'CL-SMPL-01');
 assert.equal(dl4.rows[2][1],'Bala Foods');
 const [download5]=await Promise.all([page.waitForEvent('download'),page.locator('.template-download[aria-label*="Employees / Job Role"]').click()]);
 const dl5=await readXlsx(await download5.path());
 assert.deepEqual(dl5.rows[0],['Employee','Job title','Department','Unit applicability','Verification status']);
 assert.equal(dl5.rows.length,3);
 report.push('A renamed-columns upload replaces the Customers template and its download (Client code / Client name / Market segment); the Employees list keeps its own columns and rows.');

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
