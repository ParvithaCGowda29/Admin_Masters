import type { DataProvider } from '@refinedev/core';
import workbook from './workbook.json';
export type RecordRow = {id:string;values:string[];sourceRow?:number};
const KEY='bullm-masters-v1';
export function loadRows(name:string):RecordRow[]{
 const sheet=workbook.sheets.find(s=>s.name===name)!;
 if(sheet.readOnly)return structuredClone(sheet.rows);
 try { const saved=JSON.parse(localStorage.getItem(KEY)||'{}')[name];if(Array.isArray(saved)&&saved.every((r:any)=>typeof r.id==='string'&&Array.isArray(r.values)&&r.values.length===sheet.headers.length&&r.values.every((v:any)=>typeof v==='string')))return saved; }catch{}
 return structuredClone(sheet.rows);
}
export function saveRows(name:string,rows:RecordRow[]){
 if(workbook.sheets.find(s=>s.name===name)?.readOnly)throw Error('Filetype is read-only for FDE.');
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
