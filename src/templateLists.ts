import type {MastersTemplate,TemplateKey} from './templates';
export type ListRow={id:string;values:string[]};
const KEY='bullm-template-lists-v1';
// Filled template lists (Employee list, Sample - Customers/Assets/Systems) live in their
// own per-template store on this device, not in a master grid: the 2026-10-28 decision is
// that real lists (thousands of employees) belong in their own systems, while the masters
// keep the templates themselves. Uploads happen under Add templates in the sidebar, and
// since 2026-10-29 an upload replaces its template completely: the file's column names
// and rows become the template, and only that one list is replaced.
type StoredList={headers:string[];rows:ListRow[]};
const validHeaders=(value:any):value is string[]=>Array.isArray(value)&&value.length>0&&value.every(h=>typeof h==='string'&&h.trim().length>0);
const validRows=(value:any,headers:string[]):value is ListRow[]=>Array.isArray(value)&&value.every((r:any)=>typeof r?.id==='string'&&Array.isArray(r.values)&&r.values.length===headers.length&&r.values.every((v:any)=>typeof v==='string'));
function loadStored(key:TemplateKey,template:MastersTemplate):StoredList{
 try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'{}')[key];
  if(saved&&validHeaders(saved.headers)&&validRows(saved.rows,saved.headers))return {headers:saved.headers,rows:saved.rows};
  // Earlier uploads stored only rows, mapped into the stock fields: keep them under the stock headers.
  if(validRows(saved,template.headers))return {headers:template.headers,rows:saved};
 }catch{}
 return {headers:template.headers,rows:[]};
}
export function loadHeaders(key:TemplateKey,template:MastersTemplate):string[]{return loadStored(key,template).headers}
export function loadList(key:TemplateKey,template:MastersTemplate):ListRow[]{return loadStored(key,template).rows}
export function saveList(key:TemplateKey,rows:ListRow[],headers:string[]){
 let saved:any={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
 localStorage.setItem(KEY,JSON.stringify({...saved,[key]:{headers,rows}}));
}
