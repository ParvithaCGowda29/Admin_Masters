import type { DataProvider } from '@refinedev/core';
import workbook from './workbook.json';
export type RecordRow = {id:string;values:string[];sourceRow?:number};
// Scope edits to the exact shipped workbook. Older snapshots remain untouched
// under their old key, but cannot hide updated workbook rows after a pull.
const revision=JSON.stringify(workbook);
let hash=2166136261;
for(let i=0;i<revision.length;i++)hash=Math.imul(hash^revision.charCodeAt(i),16777619);
const KEY=`bullm-masters-v2-${(hash>>>0).toString(16)}`;
function tableMeta(name:string){return workbook.sheets.find(s=>s.name===name);}
// November 16 merge (she approved on WhatsApp): the external registry Agents and
// Assistants list inside the built Agents/Assistants grids as External rows. One-time
// copy into the saved Agents table, mapped to the master columns (Reference keeps the
// registry link/path, Source marks the import path so Category reads External). The
// registry originals stay untouched in the Tools sheet. The flag keeps intentionally
// deleted copies deleted; the ID check keeps a re-run from duplicating rows.
function mergeExternalAgents(name:string,rows:RecordRow[]):RecordRow[]{
 if(name!=='Agents')return rows;
 let done=false;try{done=localStorage.getItem(KEY+':agents-merge')==='1'}catch{}
 if(done)return rows;
 try{
  const seen=new Set(rows.map(r=>r.values[0]));
  const added:RecordRow[]=[];
  for(const r of loadRows('Tools')){
   const category=(r.values[2]||'').trim();
   if(category!=='Agents'&&category!=='Assistants')continue;
   if(seen.has(r.values[0]))continue;
   added.push({id:'ext-'+r.id,values:[r.values[0],r.values[1],category==='Assistants'?'Assistant':'Agent','External',r.values[3],'Imported · GitHub','',''],sourceRow:r.sourceRow});
  }
  try{localStorage.setItem(KEY+':agents-merge','1')}catch{}
  if(!added.length)return rows;
  const merged=[...rows,...added];
  let saved:any={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
  try{localStorage.setItem(KEY,JSON.stringify({...saved,[name]:merged}))}catch{}
  return merged;
 }catch{return rows}
}
export function loadRows(name:string):RecordRow[]{
 const sheet=tableMeta(name)!;
 if(sheet.readOnly)return structuredClone(sheet.rows);
 try {
  const current=JSON.parse(localStorage.getItem(KEY)||'{}');let saved=current[name];
  // November 6: removing Tool Factory Rule refs must not hide edits to ANY master.
  // Migrate only a missing current table from the exact previous workbook snapshot.
  // Current edits (including an intentionally empty table) and the old snapshot stay intact.
  // November 11 (ISATVON Skills): the snapshot chain gains 7428edf1 (the Nov 6 workbook).
  // Old 9-column Skills rows never match the new 10-column ISATVON sheet, so the
  // validation below drops them and the mapped workbook rows take over.
  if(saved===undefined){
   const old=JSON.parse(localStorage.getItem('bullm-masters-v2-7428edf1')||'{}')[name]??JSON.parse(localStorage.getItem('bullm-masters-v2-c8f5730d')||'{}')[name];
   if(Array.isArray(old)){
    const candidate=old.map((r:any)=>name==='Tools'&&Array.isArray(r.values)&&r.values.length===12?{...r,values:r.values.filter((_:unknown,i:number)=>i!==8)}:r);
    if(candidate.every((r:any)=>typeof r.id==='string'&&Array.isArray(r.values)&&r.values.length===sheet.headers.length&&r.values.every((v:any)=>typeof v==='string'))){saved=candidate;localStorage.setItem(KEY,JSON.stringify({...current,[name]:saved}));}
   }
  }
  if(Array.isArray(saved)&&saved.every((r:any)=>typeof r.id==='string'&&Array.isArray(r.values)&&r.values.length===sheet.headers.length&&r.values.every((v:any)=>typeof v==='string')))return mergeExternalAgents(name,saved);
 }catch{}
 return mergeExternalAgents(name,structuredClone(sheet.rows));
}
export function saveRows(name:string,rows:RecordRow[]){
 if(tableMeta(name)?.readOnly)throw Error('This table is read-only for FDE.');
 let saved:any={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
 localStorage.setItem(KEY,JSON.stringify({...saved,[name]:rows}));
}
export const dataProvider:DataProvider={
 getList:async({resource})=>({data:loadRows(resource) as any,total:loadRows(resource).length}),
 getOne:async({resource,id})=>{const data=loadRows(resource).find(r=>r.id===id);if(!data)throw Error('Record not found');return{data:data as any}},
 create:async({resource,variables})=>{const row=variables as RecordRow;saveRows(resource,[...loadRows(resource),row]);return{data:row as any}},
 update:async({resource,id,variables})=>{const row={...loadRows(resource).find(r=>r.id===id),...variables as object,id:String(id)} as RecordRow;saveRows(resource,loadRows(resource).map(r=>r.id===id?row:r));return{data:row as any}},
 deleteOne:async({resource,id})=>{const row=loadRows(resource).find(r=>r.id===id);saveRows(resource,loadRows(resource).filter(r=>r.id!==id));return{data:row as any}},
 getApiUrl:()=>''
};
