import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
const out='/downloads/masters-admin-removed';fs.mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore'});
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 await page.addInitScript(()=>sessionStorage.setItem('bullm_masters_session','ui-test@example.test'));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(let i=0;i<40;i++){try{await page.goto('http://127.0.0.1:5173',{timeout:2000});break}catch{await new Promise(r=>setTimeout(r,200));}}
 await page.getByRole('heading',{name:'Organization Master'}).waitFor();
 const names=[['Organization','Organization Master'],['Agents','Agents Master'],['Skill factory','Skill factory'],['Rules','Rules Master'],['Tool Factory','Tool Factory']];
 const nav=page.locator('aside');
 assert.equal(await nav.getByRole('button',{name:'Masters',exact:true}).count(),1);
 assert.equal(await nav.locator('[role="group"]').count(),1);
 assert.equal(await nav.getByRole('button').filter({hasText:/System Settings|User Management|Model Switching|License & Payments|Tool Setup & Integrations|File Type & Standardization/}).count(),0);
 for(const [label,heading] of names){
  const button=nav.getByRole('button',{name:new RegExp('^'+label+'(?:\\s|$)')});
  await button.click();
  await page.getByRole('heading',{name:heading,exact:true}).waitFor();
  await page.locator('.ag-root').waitFor();
  assert.equal(await page.locator('.nav-admin-items').count(),0);
 }
 for(const [theme,screenshot] of [['light','masters-admin-removed-light.png'],['dark','masters-admin-removed-dark.png']]){
  await page.reload();
  if(theme==='dark')await page.getByRole('button',{name:'Switch to dark mode'}).click();
  await page.getByRole('button',{name:/^Agents/}).click();
  await page.getByRole('heading',{name:'Agents Master',exact:true}).waitFor();
  await page.locator('.ag-root').waitFor();
  await page.screenshot({path:`${out}/${screenshot}`,fullPage:true});
 }
 if(errors.length)throw new Error(errors.join(' | '));
 console.log(JSON.stringify({screenshots:[`${out}/masters-admin-removed-light.png`,`${out}/masters-admin-removed-dark.png`],pagesRendered:names.map(x=>x[0]),themes:['light','dark'],viewport:'1600x1000',sidebarGroups:1,adminEntries:0,pageErrors:errors}));
}finally{if(browser)await browser.close();server.kill();}
