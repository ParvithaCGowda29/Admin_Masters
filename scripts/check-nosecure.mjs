import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {set_fs,utils,write} from 'xlsx';
set_fs(fs);
const dir='/downloads/nosecure-check';fs.mkdirSync(dir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5199'],{stdio:'ignore'});
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
const workbook=JSON.parse(fs.readFileSync('src/workbook.json','utf8'));
const orgHeaders=workbook.sheets.find(s=>s.name==='Organization').headers;
const toXlsx=(sheets)=>{const wb=utils.book_new();for(const [name,rows] of sheets)utils.book_append_sheet(wb,utils.aoa_to_sheet(rows),name);return Buffer.from(write(wb,{type:'array',bookType:'xlsx'}));};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   try{sessionStorage.setItem('bullm_masters_session','ui-test@example.test')}catch{}
   // Simulate a non-secure context (plain http on a LAN address): randomUUID is absent.
   Object.defineProperty(globalThis.crypto,'randomUUID',{value:undefined,writable:true,configurable:true});
 });
 for(let i=0;i<50;i++){try{await page.goto('http://127.0.0.1:5199');break}catch{await new Promise(r=>setTimeout(r,100));}}
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 const missing=await page.evaluate(()=>typeof crypto.randomUUID);
 assert.equal(missing,'undefined','randomUUID must be absent in this test');
 const mixed=toXlsx([['Organization',[orgHeaders,['ORG-T-1','Test co','','','','','','','','','',''],['ORG-T-2','Second co','','','','','','','','','','']]]]);
 await page.getByRole('button',{name:'Masters',exact:true}).click();
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.getByLabel('Choose files from this device').setInputFiles({name:'masters.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:mixed});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Allow read-only & find files',exact:true}).click();
 await page.getByRole('heading',{name:'Review where each file goes',exact:true}).waitFor();
 await page.screenshot({path:dir+'/review-nosecure.png'});
 const text=(await page.getByRole('dialog').allTextContents()).join(' ');
 assert.ok(!text.includes('could not be read'),'no read failures expected, got: '+text.slice(0,300));
 assert.ok(text.includes('1'),'a table should be found');
 await page.getByRole('button',{name:/Import .* ready table/}).click();
 await page.getByRole('heading',{name:'Review where each file goes',exact:true}).waitFor({state:'detached'});
 await page.waitForTimeout(800);
 await page.screenshot({path:dir+'/after-import-nosecure.png'});
 const bodyText=await page.evaluate(()=>document.body.innerText);
 assert.ok(/Organization\s*\n?2/.test(bodyText)||bodyText.includes('ORG-T-1'),'Organization count should be 2 after import, got: '+bodyText.slice(0,400));
 assert.deepEqual(errors,[],'no page errors');
 console.log('PASS: extraction works without crypto.randomUUID (non-secure context). File read, mapped, and 2 rows imported into Organization.');
}catch(e){console.error('FAIL:',e.message);process.exitCode=1}
finally{await browser.close();server.kill();}
