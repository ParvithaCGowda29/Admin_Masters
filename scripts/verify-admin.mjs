import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const screenshotDir=process.env.UI_SCREENSHOT_DIR||'/downloads/admin-check';fs.mkdirSync(screenshotDir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
const report=[];
const TABS=[
 ['System Settings','settings','Setting ID',8],
 ['User Management','users','User ID',0],
 ['Model Switching','models','Model ID',0],
 ['License & Payments','records','License ID',0],
 ['Tool Setup & Integrations','integrations','Integration ID',0],
 ['File Type & Standardization','file types','Type ID',0],
];
const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{try{sessionStorage.setItem('bullm_masters_session','ui-test@example.test')}catch{}});
 for(let i=0;i<30;i++){try{await page.goto('http://127.0.0.1:5173');break}catch{await new Promise(r=>setTimeout(r,100));}}
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:'Masters',exact:true}).waitFor();
 await page.getByRole('button',{name:'Admin',exact:true}).waitFor();
 for(const [name] of TABS)await page.getByRole('button',{name,exact:true}).waitFor();
 report.push('Sidebar: Admin parent sits under Masters and lists the six sub-tabs.');
 for(const theme of ['light','dark']){
  if(theme==='dark')await page.getByRole('button',{name:'Switch to dark mode'}).click();
  for(const [name,noun,firstHeader,count] of TABS){
   await page.getByRole('button',{name,exact:true}).click();
   await page.getByRole('heading',{name:`Admin · ${name}`,exact:true}).waitFor();
   await page.getByText('Workspace administration for the BuLLM web.',{exact:true}).waitFor();
   await page.getByText(`${count} of ${count} ${noun}`,{exact:true}).waitFor();
   await page.getByText('7 fixed columns',{exact:true}).waitFor();
   await page.locator('.ag-header-cell-text',{hasText:firstHeader}).first().waitFor();
   await page.waitForTimeout(250);
   await page.screenshot({path:`${screenshotDir}/admin-${slug(name)}-${theme}.png`,fullPage:true});
  }
 }
 report.push('All six sub-tabs render in light and dark: Admin heading, workspace subtitle, per-tab counts, 7 fixed columns, screenshots saved.');
 await page.getByRole('button',{name:'System Settings',exact:true}).click();
 await page.getByText('8 of 8 settings',{exact:true}).waitFor();
 assert.equal(await page.locator('.status-chip.on').count(),7);
 assert.equal(await page.locator('.status-chip.off').count(),1);
 report.push('System Settings shows the 8 wireframe rows with 7 Active pills and 1 Off pill.');
 // Admin tabs edit and persist like masters.
 await page.getByRole('button',{name:'User Management',exact:true}).click();
 await page.getByText('0 of 0 users',{exact:true}).waitFor();
 await page.locator('.ag-root').click({button:'right'});
 await page.getByRole('menuitem',{name:'Add row',exact:true}).click();
 const editor=page.locator('.ag-large-text-input textarea');await editor.waitFor();
 await editor.fill('USR-01');
 await page.keyboard.press('Control+Enter');
 await page.getByRole('status').filter({hasText:'Changes saved on this device.'}).waitFor();
 await page.getByText('1 of 1 users',{exact:true}).waitFor();
 await page.reload();
 await page.getByRole('button',{name:'User Management',exact:true}).click();
 await page.getByText('1 of 1 users',{exact:true}).waitFor();
 const saved=await page.evaluate(async()=>{const {loadRows}=await import('/src/provider.ts');return loadRows('User Management');});
 assert.equal(saved.length,1);assert.equal(saved[0].values[0],'USR-01');
 report.push('Admin rows are added by right-click and persist through reload in browser-only storage.');
 assert.deepEqual(errors,[]);
 report.push('No browser page errors.');
 console.log(report.join('\n'));
}finally{await browser.close();server.kill();}
