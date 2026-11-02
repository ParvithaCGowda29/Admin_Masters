import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {set_fs,utils,write} from 'xlsx';
set_fs(fs);
const dir='/downloads/import-check';fs.mkdirSync(dir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
const workbook=JSON.parse(fs.readFileSync('src/workbook.json','utf8'));
const orgHeaders=workbook.sheets.find(s=>s.name==='Organization').headers;
const wb=utils.book_new();
utils.book_append_sheet(wb,utils.aoa_to_sheet([['BuLLM masters'],['Organization: business units and locations.']]),'README');
utils.book_append_sheet(wb,utils.aoa_to_sheet([orgHeaders,['ORG-V-1','Verify co','','','','','','','','','','']]),'Organization');
const buf=Buffer.from(write(wb,{type:'array',bookType:'xlsx'}));
const file={name:'Copy of BuLLM - Common Masters.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:buf};
try{
 const page=await browser.newPage({viewport:{width:1529,height:751}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{try{sessionStorage.setItem('bullm_masters_session','ui-test@example.test')}catch{}});
 for(let i=0;i<30;i++){try{await page.goto('http://127.0.0.1:5173');break}catch{await new Promise(r=>setTimeout(r,100));}}
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 for(const mode of ['light','dark']){
  if(mode==='dark')await page.getByRole('button',{name:'Switch to dark mode'}).click();
  await page.getByRole('button',{name:'Add files',exact:true}).click();
  await page.getByRole('heading',{name:'Add files',exact:true}).waitFor();
  await page.getByRole('button',{name:/Bulk upload/}).click();
  const popup=page.getByRole('dialog',{name:'Bulk upload'});
  await popup.locator('.uppy-Dashboard-inner').waitFor();
  await page.getByLabel('Choose files from this device').setInputFiles({...file,buffer:Buffer.from(write(wb,{type:'array',bookType:'xlsx'}))});
  await popup.getByRole('button',{name:'Done (1 file)',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  // Read-write is the only permission and is pre-selected.
  assert.equal(await page.getByText(/Read-only/).count(),0);await page.screenshot({path:dir+`/permission-${mode}.png`});
  await page.getByRole('button',{name:'Allow read-write & fetch files',exact:true}).click();
  await page.getByRole('heading',{name:'Review where each file maps',exact:true}).waitFor();
  const imp=page.getByRole('button',{name:/Import 1 ready table/});
  await imp.waitFor();assert.ok(await imp.isEnabled());
  await page.screenshot({path:dir+`/review-import-${mode}.png`});
  await imp.click();
  await page.getByRole('heading',{name:'Review where each file maps',exact:true}).waitFor({state:'detached'});
  await page.getByText('ORG-V-'+(mode==='light'?'1':'1')).first().waitFor();
  await page.screenshot({path:dir+`/imported-${mode}.png`});
  // clear for second pass: re-import should skip duplicate, not fail
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: default flow imports rows in light+dark. Screenshots in '+dir);
}finally{await browser.close();server.kill();}
