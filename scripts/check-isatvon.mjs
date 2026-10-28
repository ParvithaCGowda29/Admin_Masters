import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
// Seed one Skills row in the same scoped storage key the app derives from the workbook.
const workbook=JSON.parse(fs.readFileSync('src/workbook.json','utf8'));
const revision=JSON.stringify(workbook);
let hash=2166136261;
for(let i=0;i<revision.length;i++)hash=Math.imul(hash^revision.charCodeAt(i),16777619);
const KEY=`bullm-masters-v2-${(hash>>>0).toString(16)}`;
const screenshotDir=process.env.UI_SCREENSHOT_DIR||'/downloads';fs.mkdirSync(screenshotDir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore'});
try{
 const browser=await chromium.launch({args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(([key])=>{try{
  sessionStorage.setItem('bullm_masters_session','ui-test@example.test');
  localStorage.setItem(key,JSON.stringify({Skills:[{id:'sk1',values:['SK-01','Draft brief','instruction text','s3://bucket/path','auto-tag; enrich','Node, Python','tenant, brand, ICP, goal, geography, owner','tenant-scoped brief; approved fact map','slack: #briefs, email the owner','gate','Proposed','AG-01']}] }));
 }catch{}},[KEY]);
 for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:5173',{timeout:2000});break}catch{await new Promise(r=>setTimeout(r,200));}}
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 await page.getByRole('button',{name:/^Skills/}).click();
 await page.locator('.ag-row').first().waitFor();
 // ISATVON headers show each letter with its expansion.
 for(const label of ['I · Instruction','S · Source','A · Automation','T · Tech stack','V · Variables','O · Outcome','N · Notify on next'])await page.getByText(label,{exact:true}).first().waitFor();
 // Stacked items start with a capital; acronyms and links keep their case.
 for(const t of ['Tenant','Brand','ICP','Goal','Geography','Owner','Tenant-scoped brief','Approved fact map','Auto-tag','Enrich'])await page.getByText(t,{exact:true}).first().waitFor();
 await page.getByText('s3://bucket/path',{exact:true}).first().waitFor();
 await page.waitForTimeout(400);
 await page.screenshot({path:screenshotDir+'/skills-isatvon.png'});
 if(errors.length)throw new Error('page errors: '+errors.join(' | '));
 console.log('ISATVON header labels and capitalized stacked items verified.');
 await browser.close();
}finally{server.kill();}
