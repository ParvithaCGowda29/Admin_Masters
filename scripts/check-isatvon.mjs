import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Skill factory (approved 2026-11-04): the Skills master is renamed "Skill factory",
// every step renders as a numbered skill chip, agents and the next skill render as links,
// rules and tools render as chips, and Extracted Information is its own column.
// "Notify on next" is renamed to "Next".
const workbook=JSON.parse(fs.readFileSync('src/workbook.json','utf8'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'skill-factory-'));
const revision=JSON.stringify(workbook);
let hash=2166136261;
for(let i=0;i<revision.length;i++)hash=Math.imul(hash^revision.charCodeAt(i),16777619);
const KEY=`bullm-masters-v2-${(hash>>>0).toString(16)}`;
const screenshotDir=process.env.UI_SCREENSHOT_DIR||'/downloads';fs.mkdirSync(screenshotDir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore'});
try{
 const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(([key])=>{try{
  sessionStorage.setItem('bullm_masters_session','ui-test@example.test');
  localStorage.setItem(key,JSON.stringify({Skills:[{id:'sk1',values:['SK-01','RFQ Intake','Parse email; Extract line items; Map to masters','RFQ Intake Agent','RFQ validation','Email parser; LLM','Customer, parts, due date','Drawing OCR','02-11-2026']}] }));
 }catch{}},[KEY]);
 for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:5173',{timeout:2000});break}catch{await new Promise(r=>setTimeout(r,200));}}
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:/^Skill factory/}).click();
 // Renamed tab and title; the ISATVON letter labels and "Notify on next" are gone.
 await page.getByRole('heading',{name:'Skill factory',exact:true}).waitFor();
 await page.locator('.ag-row').first().waitFor();
 for(const label of ['Skill ID','Skill Name','Steps (each a skill)','Agents','Rules','Tools','Extracted Information','Next','Updated'])await page.getByText(label,{exact:true}).first().waitFor();
 if(await page.getByText('N · Notify on next',{exact:true}).count())throw new Error('old ISATVON label still shown');
 if(await page.getByText('Notify on next',{exact:true}).count())throw new Error('old Notify on next label still shown');
 // Numbered skill chips, agent and next-skill links, rule and tool chips.
 await page.locator('.skill-chip').filter({hasText:'1 · Parse email'}).first().waitFor();
 await page.locator('.skill-chip').filter({hasText:'2 · Extract line items'}).first().waitFor();
 await page.locator('.skill-link').filter({hasText:'RFQ Intake Agent'}).first().waitFor();
 await page.locator('.skill-link').filter({hasText:'Drawing OCR'}).first().waitFor();
 await page.locator('.rule-chip').filter({hasText:'RFQ validation'}).first().waitFor();
 await page.locator('.tool-chip').filter({hasText:'Email parser'}).first().waitFor();
 // Extracted Information stacks comma-separated items, each capitalized.
 for(const t of ['Customer','Parts','Due date'])await page.getByText(t,{exact:true}).first().waitFor();
 await page.waitForTimeout(400);
 await page.screenshot({path:screenshotDir+'/skill-factory.png'});
 if(errors.length)throw new Error('page errors: '+errors.join(' | '));
 console.log('Skill factory rename, numbered step chips, link cells, rule/tool chips and Next column verified.');
 await browser.close();
}finally{server.kill();}
