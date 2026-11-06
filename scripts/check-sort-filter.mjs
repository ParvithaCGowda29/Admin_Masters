// Browser check: column name click must not sort; the funnel popup holds Sort A-Z / Sort Z-A.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
const shots=process.env.SHOTS||'';
const server=await createServer({server:{port:5191},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
try{
 for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width:1529,height:751}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(t=>{localStorage.setItem('bullm-masters-theme',t);sessionStorage.setItem('bullm_masters_session','test@digibull.ai')},theme);
  await page.goto('http://localhost:5191');
  const login=page.getByRole('button',{name:/sign in|log in|continue/i});
  if(await login.count()){console.log('login screen present');}
  await page.locator('.ag-header-cell').first().waitFor();
  const NAV={Organization:'Organisations',Agents:'Agent factory',Rules:'Rules'};
  for(const master of ['Organization','Agents','Rules']){
   await page.evaluate(async m=>{const p=await import('/src/provider.ts');const w=(await import('/src/workbook.json')).default;const s=w.sheets.find(x=>x.name===m);const mk=(c)=>({id:'t'+c,values:s.headers.map((_,i)=>i===1?c:'')});p.saveRows(m,['Beta','Alpha','Gamma'].map(mk))},master);
   await page.reload();await page.locator('.ag-header-cell').first().waitFor();
   await page.getByRole('button',{name:new RegExp('^'+NAV[master])}).first().click();
   await page.locator('.ag-row').first().waitFor();
   const col=async()=>page.locator('.ag-center-cols-container .ag-row').evaluateAll(rs=>rs.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top).map(r=>r.querySelector('[col-id="1"]')?.textContent.trim()));
   const before=await col();
   const header=page.locator('.ag-header-cell[col-id="1"]');
   await header.locator('.ag-header-cell-text').click();await page.waitForTimeout(200);
   assert.deepEqual(await col(),before,master+': clicking the name must not sort');
   await header.hover();await header.locator('.ag-header-cell-filter-button').click();
   const pop=page.locator('.sort-filter');await pop.waitFor();
   assert.equal(await pop.locator('select').inputValue(),'contains');
   if(shots&&master==='Organization')await page.screenshot({path:`${shots}/sort-popup-${theme}.png`});
   await pop.getByRole('button',{name:'Sort A-Z'}).click();await page.waitForTimeout(200);
   assert.deepEqual(await col(),['Alpha','Beta','Gamma'],master+' A-Z');
   await pop.getByRole('button',{name:'Sort Z-A'}).click();await page.waitForTimeout(200);
   assert.deepEqual(await col(),['Gamma','Beta','Alpha'],master+' Z-A');
   await pop.locator('input').fill('al');await page.waitForTimeout(200);
   assert.deepEqual(await col(),['Alpha'],master+' filter still works with sort');
   await pop.locator('select').selectOption('startsWith');await pop.locator('input').fill('g');await page.waitForTimeout(200);
   assert.deepEqual(await col(),['Gamma'],master+' starts with');
   if(shots&&master==='Organization'){await page.screenshot({path:`${shots}/sort-filtered-${theme}.png`});}
   await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Sort/filter popup checks passed (light + dark, Organization/Agents/Rules).');
}finally{await browser.close();await server.close()}
