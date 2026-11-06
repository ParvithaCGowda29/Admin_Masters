import {chromium} from 'playwright';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const shots=process.env.SHOTS||'/downloads/organization-qa';fs.mkdirSync(shots,{recursive:true});
const server=await createServer({server:{port:5197},logLevel:'error'});await server.listen();const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(t=>{sessionStorage.setItem('bullm_masters_session','test@example.test');localStorage.setItem('bullm-masters-theme',t)},theme);await page.goto('http://localhost:5197');await page.locator('.ag-row').first().waitFor();
 const baseline=await page.evaluate(async()=>{const p=await import('/src/provider.ts');return {org:p.loadRows('Organization'),rules:p.loadRows('Rules'),skills:p.loadRows('Skills')}});
 // Real data and navigation preserved; rule column available after Data Sources.
 assert.equal(await page.getByRole('button',{name:/^Agent factory/}).count(),1);assert.equal(await page.getByRole('button',{name:/^Rules 41/}).count(),1);
 await page.waitForTimeout(400);await page.locator('.ag-body-horizontal-scroll-viewport').evaluate(e=>e.scrollLeft=1800);await page.waitForTimeout(200);
 await page.screenshot({path:`${shots}/org-list-${theme}.png`});
 await page.locator('.ag-body-horizontal-scroll-viewport').evaluate(e=>e.scrollLeft=0);
 // In-place edit/cancel then save: direct data assertions detect accidental saves.
 const cert=page.locator('.ag-center-cols-container .ag-row').first().locator('[col-id="4"]');await cert.dblclick();const edit=page.getByLabel('Edit Certifications');await edit.fill('Cancelled certificate');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(await page.evaluate(async()=>{const p=await import('/src/provider.ts');return p.loadRows('Organization')[0].values[4]}),baseline.org[0].values[4]);
 await cert.dblclick();await edit.fill('QA certification\nValid till 14-03-2028');await page.screenshot({path:`${shots}/org-inline-${theme}.png`});await page.getByRole('button',{name:'Save',exact:true}).click();
 assert.equal(await page.evaluate(async()=>{const p=await import('/src/provider.ts');return p.loadRows('Organization')[0].values[4]}),'QA certification\nValid till 14-03-2028');
 await page.locator('.ag-body-horizontal-scroll-viewport').evaluate(e=>e.scrollLeft=1800);await page.waitForTimeout(100);await page.locator('.ag-center-cols-container .ag-row').first().getByRole('button',{name:'41 rules ›'}).click();await page.locator('.org-rules-table').waitFor();
 assert.equal(await page.locator('.org-rules-table tbody tr').count(),41);
 // Requested removals: no company-specific heading, no membership/scope note, no + Add rule button.
 assert.equal(await page.locator('.org-rules-workspace h2').count(),0,'company heading removed');
 assert.equal(await page.locator('.org-scope-note').count(),0,'membership note removed');
 assert.equal(await page.getByRole('button',{name:'+ Add rule'}).count(),0,'add rule button removed');
 // Search field sits on the right-hand side of the toolbar.
 const box=await page.getByLabel('Search organization rules').boundingBox();const bar=await page.locator('.org-rules-toolbar').boundingBox();
 assert.ok(box&&bar&&Math.abs((box.x+box.width)-(bar.x+bar.width))<24,'search field on the right-hand side');
 await page.screenshot({path:`${shots}/rules-list-${theme}.png`});
 // Example prompts are seeded and open from the Prompts column; closing without edits keeps them examples.
 await page.locator('.org-rules-table tbody tr').first().getByRole('button',{name:'3 prompts ›',exact:true}).click();const seeded=page.getByRole('dialog',{name:'Rule editor'});
 assert.ok((await page.getByLabel('System prompt',{exact:true}).inputValue()).includes('access gate'),'seeded system prompt present');
 assert.ok((await page.getByLabel('Micro prompt 1 name').inputValue()).length>0,'seeded micro prompt present');
 await page.screenshot({path:`${shots}/rule-prompts-mock-${theme}.png`});await seeded.getByRole('button',{name:'Cancel (Esc)',exact:true}).click();
 // Right-click on the grid adds a rule through the draft row (replaces the removed button).
 await page.locator('.org-rules-table-wrap').click({button:'right'});await page.getByRole('menuitem',{name:'Add rule',exact:true}).click();await page.getByLabel('New rule text').fill('QA rule for persistence test');await page.getByLabel('New rule skills').selectOption({index:0});await page.screenshot({path:`${shots}/rule-add-${theme}.png`});await page.locator('.org-draft').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('.org-rules-table tbody tr').count(),41);
 await page.locator('.org-rules-table-wrap').click({button:'right'});await page.getByRole('menuitem',{name:'Add rule',exact:true}).click();await page.getByLabel('New rule text').fill('QA rule for persistence test');await page.getByLabel('New rule skills').selectOption({index:0});await page.locator('.org-draft').getByRole('button',{name:'Save',exact:true}).click();assert.equal(await page.locator('.org-rules-table tbody tr').count(),42);
 const row=page.locator('.org-rules-table tbody tr').first();await row.getByRole('button',{name:'RULE-CUSTOM-001',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Rule editor'});await page.getByLabel('Rule text',{exact:true}).fill('QA revised rule');await page.getByLabel('Rule applies to').fill('QA operations');await page.getByLabel('Rule status').fill('Draft');await page.screenshot({path:`${shots}/rule-editor-${theme}.png`});
 await dialog.getByRole('button',{name:'Prompts 0',exact:true}).click();await page.getByLabel('System prompt',{exact:true}).fill('QA system prompt');await page.getByRole('button',{name:'+ Add micro prompt'}).click();await page.getByLabel('Micro prompt 1 name').fill('QA check');await page.getByLabel('Micro prompt 1 text').fill('QA micro prompt');await page.screenshot({path:`${shots}/rule-prompts-${theme}.png`});await dialog.getByRole('button',{name:'Save (Ctrl+Enter)',exact:true}).click();await row.getByRole('button',{name:'2 prompts ›',exact:true}).waitFor();
 // All original records retained.
 const saved=await page.evaluate(async()=>{const p=await import('/src/provider.ts');return {org:p.loadRows('Organization'),rules:p.loadRows('Rules'),skills:p.loadRows('Skills')}});
 assert.deepEqual(saved.rules.slice(1),baseline.rules,'all original records retained');assert.deepEqual(saved.skills,baseline.skills,'Skills records unchanged');assert.deepEqual(saved.org.map(r=>r.values[0]),baseline.org.map(r=>r.values[0]),'real organizations retained');assert.equal(saved.rules[0].values[0],'RULE-CUSTOM-001');assert.equal(saved.rules[0].values[8],baseline.skills[0].values[0]);
 // A seeded rule still shows its example prompts: saving another rule's prompts does not touch them.
 await page.locator('.org-rules-table tbody tr').nth(1).getByRole('button',{name:'3 prompts ›',exact:true}).click();assert.ok((await page.getByLabel('System prompt',{exact:true}).inputValue()).includes('access gate'),'other rule example prompts intact');await page.getByRole('button',{name:'Cancel (Esc)',exact:true}).click();
 // Cancel editor must leave the saved rule unchanged.
 await row.getByRole('button',{name:'RULE-CUSTOM-001',exact:true}).click();await page.getByLabel('Rule text',{exact:true}).fill('cancel me');await page.getByRole('button',{name:'Cancel (Esc)',exact:true}).click();assert.equal(await row.locator('td').nth(1).textContent(),'QA revised rule');
 // Search filters the rules and clears back.
 await page.getByLabel('Search organization rules').fill('privacy');const filtered=await page.locator('.org-rules-table tbody tr').count();assert.ok(filtered>0&&filtered<42,'search filters rules');await page.getByLabel('Search organization rules').fill('');assert.equal(await page.locator('.org-rules-table tbody tr').count(),42);
 // Saved prompts and the added rule persist across reload.
 await page.reload();await page.locator('.ag-row').first().waitFor();await page.locator('.ag-body-horizontal-scroll-viewport').evaluate(e=>e.scrollLeft=1800);await page.waitForTimeout(100);await page.waitForTimeout(400);await page.locator('.ag-body-horizontal-scroll-viewport').evaluate(e=>e.scrollLeft=1800);await page.waitForTimeout(200);await page.locator('.ag-center-cols-container .ag-row').first().getByRole('button',{name:'42 rules ›'}).click();await page.locator('.org-rules-table').waitFor();await page.locator('.org-rules-table tbody tr').first().getByRole('button',{name:'2 prompts ›',exact:true}).click();await page.getByLabel('System prompt',{exact:true}).waitFor();assert.equal(await page.getByLabel('System prompt',{exact:true}).inputValue(),'QA system prompt');assert.equal(await page.getByLabel('Micro prompt 1 text').inputValue(),'QA micro prompt');assert.deepEqual(errors,[]);console.log(theme+': organization edit/cancel, rules screen removals, right-click add, right search, example prompts, prompts/counts/reload and preservation PASS');await page.close();
}}
finally{await browser.close();await server.close()}
