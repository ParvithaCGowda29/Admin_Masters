// Regenerates the blank template workbooks in public/templates/ from src/templates.ts.
// Run: node scripts/make-templates.mjs
import {mkdirSync,readFileSync} from 'node:fs';
import * as fs from 'node:fs';
import ts from 'typescript';
import {set_fs,utils,writeFile} from 'xlsx';
set_fs(fs);
const source=readFileSync('src/templates.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {TEMPLATES}=await import(`data:text/javascript,${encodeURIComponent(js)}`);
mkdirSync('public/templates',{recursive:true});
for(const template of TEMPLATES){
 const sheet=utils.aoa_to_sheet([template.headers]);
 sheet['!cols']=template.headers.map(h=>({wch:Math.max(h.length+2,16)}));
 const book=utils.book_new();
 utils.book_append_sheet(book,sheet,template.file.replace(/\.xlsx$/,''));
 writeFile(book,`public/templates/${template.file}`);
 console.log(`public/templates/${template.file}: ${template.headers.length} columns`);
}
