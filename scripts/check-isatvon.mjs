import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const workbook=JSON.parse(fs.readFileSync('src/workbook.json','utf8'));
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
  localStorage.setItem(key,JSON.stringify({Skills:[{id:'sk1',values:['SK-01','RFQ Intake','Parse email; Extract line items; Map to masters','Shared RFQ inbox','Trigger · new mail','Email parser; LLM','Customer, parts, due date','Structured RFQ record','SK-02 Drawing OCR','Innotech HQ; TF-01 Claude Code']}] }));
 }catch{}},[KEY]);
 for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:5173',{timeout:2000});break}catch{await new Promise(r=>setTimeout(r,200));}}
 await page.getByRole('heading',{name:'Organisations',exact:true}).waitFor();
 await page.getByRole('button',{name:/^Skills/}).click();
 // ISATVON grid (approved 2026-11-06 wireframes): letter columns, no Rules anywhere.
 await page.getByRole('heading',{name:'Skills',exact:true}).waitFor();
 await page.locator('.ag-row').first().waitFor();
 for(const label of ['Skill ID','Skill','I · Instruction','S · Source data','A · Automation','T · Tech stack','V · Variables','O · Outcome','N · Next','References'])await page.getByText(label,{exact:true}).first().waitFor();
 if(await page.locator('.ag-header-cell').filter({hasText:'Rules'}).count())throw new Error('Rules column still shown in Skills');
 if(await page.locator('.rule-chip').count())throw new Error('rule chips still rendered in Skills');
 // References: blue Organisation chip, grey Tool Factory chip.
 await page.locator('.skill-chip').filter({hasText:'Innotech HQ'}).first().waitFor();
 await page.locator('.tool-chip').filter({hasText:'TF-01 Claude Code'}).first().waitFor();
 // Native edit-in-place: single click opens the cell editor; no drawer, no Save/Cancel buttons.
 const firstRow='.ag-center-cols-container .ag-row[row-index="0"]';
 const variablesCell=page.locator(firstRow).locator('[col-id="6"]');
 await variablesCell.click();
 await page.locator('.ag-cell-inline-editing').first().waitFor();
 if(await page.getByRole('button',{name:'Save',exact:true}).count())throw new Error('Save button shown');
 if(await page.getByRole('button',{name:'Cancel',exact:true}).count())throw new Error('Cancel button shown');
 await page.keyboard.press('Escape');
 // Skill ID stays non-editable.
 await page.locator('.ag-row[row-index="0"]').locator('[col-id="0"]').click();
 await page.waitForTimeout(300);
 if(await page.locator('.ag-cell-inline-editing').count())throw new Error('Skill ID opened an editor');
 // Right-click row menu: Add skill / Duplicate row / Delete row.
 await variablesCell.click({button:'right'});
 await page.getByRole('menuitem',{name:'+ Add skill',exact:true}).waitFor();
 await page.getByRole('menuitem',{name:'Duplicate row',exact:true}).waitFor();
 await page.getByRole('menuitem',{name:'Delete row',exact:true}).waitFor();
 await page.getByRole('menuitem',{name:'+ Add skill',exact:true}).click();
 // New row takes the next Skill ID (SK-02 after the seeded SK-01) and opens in edit mode.
 await page.locator('.ag-cell-inline-editing').first().waitFor();
 await page.getByText('SK-02',{exact:true}).first().waitFor();
 await page.waitForTimeout(400);
 await page.screenshot({path:screenshotDir+'/skills-isatvon.png'});
 if(errors.length)throw new Error('page errors: '+errors.join(' | '));
 console.log('Skills ISATVON grid verified: letter columns, no Rules, chips, edit-in-place, right-click add.');
 await browser.close();
}finally{server.kill();}
