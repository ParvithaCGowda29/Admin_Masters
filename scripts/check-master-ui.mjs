import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'masters-ui-'));
try{
 const source=await fs.readFile('src/masterUi.ts','utf8');
 await fs.writeFile(path.join(temp,'ui.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {matchesFacets,facetFields,facetOptions,readmeForMaster}=await import(pathToFileURL(path.join(temp,'ui.mjs')));
 const rows=[{id:'1',values:['API','Active']},{id:'2',values:['MCP','Active']},{id:'3',values:['API','Paused']}];
 assert.equal(rows.filter(r=>matchesFacets(r,{'0':['API']})).length,2);
 assert.equal(rows.filter(r=>matchesFacets(r,{'0':['API'],'1':['Active']})).length,1);
 assert.equal(rows.filter(r=>matchesFacets(r,{'0':['API','MCP']})).length,3);
 assert.deepEqual(facetOptions(rows,0,{'1':['Active']}),[['API',1],['MCP',1]]);
 assert.deepEqual(facetFields('Tools',['Category','Status']),[{label:'Category',index:0},{label:'Status',index:1}]);
 const readme=[['Layout','Global','Guide'],['Filetype','Untouched','Read-only'],['Sources','Snapshot','Context']];
 assert.deepEqual(readmeForMaster('Masters',readme),readme);
 assert.deepEqual(readmeForMaster('Organization',readme),[readme[0]]);
 assert.deepEqual(readmeForMaster('Filetype',readme),readme.slice(0,2));
 console.log('Masters UI logic checks passed: multi-select OR, cross-facet AND, dynamic counts, source guidance.');
}finally{await fs.rm(temp,{recursive:true,force:true})}
