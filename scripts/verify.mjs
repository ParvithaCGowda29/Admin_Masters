import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const server=await createServer({server:{port:5173}});await server.listen();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:950}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173');await page.locator('.ag-row').first().waitFor();
await page.waitForTimeout(300);await page.screenshot({path:'/downloads/masters-desktop.png',fullPage:true});
const report=[];
for(const [name,count] of Object.entries({Organization:6,Rules:8,Agents:6,Skills:16,Tooling:11,Filetype:43})){
 await page.getByRole('tab',{name:new RegExp('^'+name)}).click();await page.locator('.ag-row').first().waitFor();
 await page.getByText(`${count} of ${count} rows`,{exact:true}).waitFor();
 if(name==='Filetype'){assert.equal(await page.getByRole('button',{name:'＋ Add Row',exact:true}).count(),0);await page.waitForTimeout(300);await page.screenshot({path:'/downloads/masters-filetype.png',fullPage:true});}
 report.push(`${name}: correct count ${count}, rendered`);
}
await page.getByRole('tab',{name:/^Organization/}).click();
await page.getByRole('searchbox').fill('Manufacturing source registry');await page.getByText('1 of 6 rows',{exact:true}).waitFor();await page.waitForTimeout(900);await page.getByRole('button',{name:'◷ Search history',exact:true}).click();await page.getByRole('button',{name:'Manufacturing source registry',exact:true}).waitFor();await page.getByRole('button',{name:'Manufacturing source registry',exact:true}).click();report.push('Search filters matching row; search history records and recalls the query.');
await page.getByRole('searchbox').fill('NO-SUCH-MASTER');await page.getByText('0 of 6 rows',{exact:true}).waitFor();report.push('Search empty state works.');await page.getByRole('searchbox').fill('');
await page.getByRole('button',{name:'＋ Add Row',exact:true}).click();await page.getByText('7 of 7 rows',{exact:true}).waitFor();await page.locator('.ag-large-text-input textarea').waitFor();await page.keyboard.press('Escape');
const added=page.locator('.ag-center-cols-container .ag-row').last().locator('[col-id="1"]');await added.dblclick();const editor=page.locator('.ag-large-text-input textarea');await editor.fill('FDE test organization');await page.keyboard.press('Control+Enter');await page.waitForTimeout(1000);await page.waitForTimeout(300);await page.screenshot({path:'/downloads/edit-debug.png',fullPage:true});console.log('DEBUG',await page.locator('.notice').allTextContents());await page.getByRole('status').filter({hasText:'Changes saved on this device.'}).waitFor();
assert((await page.evaluate(()=>localStorage.getItem('bullm-masters-v1'))).includes('FDE test organization'));await page.reload();await page.getByText('7 of 7 rows',{exact:true}).waitFor();report.push('Add Row + cell edit + local persistence survive reload.');
const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'↓ Export CSV',exact:true}).click();const download=await downloadPromise;await download.saveAs('/downloads/masters-test-export.csv');assert(fs.readFileSync('/downloads/masters-test-export.csv','utf8').includes('FDE test organization'));report.push('CSV export contains saved edits.');
await page.locator('input[type=file]').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('Wrong,Headers\nA,B')});await page.getByRole('alert').waitFor();report.push('Invalid CSV headers rejected.');
const data=JSON.parse(fs.readFileSync('src/workbook.json'));const heads=data.sheets.find(s=>s.name==='Organization').headers;const csv=[heads,heads.map((h,i)=>i===1?'Imported organization':'')].map(r=>r.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');await page.locator('input[type=file]').setInputFiles({name:'valid.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.getByText('8 of 8 rows',{exact:true}).waitFor();report.push('Valid exact-header CSV appends records.');
// Restore the original clean data for screenshots and delivery.
await page.evaluate(()=>localStorage.clear());await page.reload();await page.locator('.ag-row').first().waitFor();
await page.getByRole('tab',{name:/^Tooling/}).click();await page.locator('.ag-row').first().waitFor();await page.waitForTimeout(300);await page.screenshot({path:'/downloads/masters-tooling.png',fullPage:true});
await page.getByRole('tab',{name:/^README/}).click();await page.getByRole('heading',{name:'Workbook reference',exact:true}).waitFor();await page.waitForTimeout(300);await page.screenshot({path:'/downloads/masters-readme.png',fullPage:false});report.push('README displays preserved source content.');
for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.getByRole('tab',{name:/^Organization/}).click();await page.locator('.ag-row').first().waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.waitForTimeout(300);await page.screenshot({path:`/downloads/masters-mobile-${width}.png`,fullPage:true});report.push(`Mobile ${width}: no document overflow, grid scrolls within panel.`)}
assert.deepEqual(errors,[]);report.push('No browser page errors.');fs.writeFileSync('/downloads/verification.txt',report.join('\n'));console.log(report.join('\n'));await browser.close();await server.close();
