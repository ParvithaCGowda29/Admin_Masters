// Renders the approved v3 horizontal Add files layout at the user's exact screen size
// (1529x751) and asserts the dialog fits with no scrolling, list and popup, light and dark.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const screenshotDir='/downloads/addfiles-v3-check';fs.mkdirSync(screenshotDir,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1529,height:751}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{try{sessionStorage.setItem('bullm_masters_session','ui-test@example.test')}catch{}});
 for(let i=0;i<30;i++){try{await page.goto('http://127.0.0.1:5173');break}catch{await new Promise(r=>setTimeout(r,100));}}
 await page.getByRole('heading',{name:'Organization Master',exact:true}).waitFor();
 const fits=async()=>await page.evaluate(()=>{
  const d=document.querySelector('dialog.bulk-dialog').getBoundingClientRect();
  const de=document.documentElement;
  return {bottom:d.bottom,top:d.top,vh:innerHeight,noPageScroll:de.scrollHeight<=de.clientHeight&&de.scrollWidth<=de.clientWidth};
 });
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByRole('heading',{name:'Add files',exact:true}).waitFor();
 let f=await fits();
 assert.ok(f.noPageScroll&&f.bottom<=f.vh&&f.top>=0,'list state fits 1529x751: '+JSON.stringify(f));
 await page.screenshot({path:screenshotDir+'/v3-list-light.png'});
 await page.getByRole('button',{name:/Bulk upload/}).click();
 await page.getByRole('dialog',{name:'Bulk upload'}).locator('.uppy-Dashboard-inner').waitFor();
 const pf=await page.evaluate(()=>{const p=document.querySelector('.ex-drop-panel').getBoundingClientRect();return{bottom:p.bottom,top:p.top,left:p.left,right:p.right,vh:innerHeight,vw:innerWidth};});
 assert.ok(pf.bottom<=pf.vh&&pf.top>=0&&pf.left>=0&&pf.right<=pf.vw,'popup fits 1529x751: '+JSON.stringify(pf));
 await page.screenshot({path:screenshotDir+'/v3-popup-light.png'});
 await page.getByRole('button',{name:'Close file picker',exact:true}).click();
 await page.getByRole('button',{name:'Close add files',exact:true}).click();
 // Dark mode
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await page.getByRole('button',{name:'Add files',exact:true}).click();
 await page.getByRole('heading',{name:'Add files',exact:true}).waitFor();
 f=await fits();
 assert.ok(f.noPageScroll&&f.bottom<=f.vh&&f.top>=0,'dark list fits: '+JSON.stringify(f));
 await page.screenshot({path:screenshotDir+'/v3-list-dark.png'});
 await page.getByRole('button',{name:/Zip upload/}).click();
 await page.getByRole('dialog',{name:'Zip upload'}).locator('.uppy-Dashboard-inner').waitFor();
 await page.screenshot({path:screenshotDir+'/v3-popup-dark.png'});
 assert.deepEqual(errors,[],'no page errors');
 console.log('PASS: v3 horizontal layout fits 1529x751 with no scrolling - list and popup, light and dark. Screenshots in '+screenshotDir);
}finally{await browser.close();server.kill();}
