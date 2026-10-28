import type {MastersTemplate,TemplateKey} from './templates';
export type ListRow={id:string;values:string[]};
const KEY='bullm-template-lists-v1';
// Filled template lists (Employee list, Sample - Customers/Assets/Systems) live in their
// own per-template store on this device, not in a master grid: the 2026-10-28 decision is
// that real lists (thousands of employees) belong in their own systems, while the masters
// keep the templates themselves. Uploads happen under Add templates in the sidebar.
export function loadList(key:TemplateKey,template:MastersTemplate):ListRow[]{
 try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'{}')[key];
  if(Array.isArray(saved)&&saved.every((r:any)=>typeof r.id==='string'&&Array.isArray(r.values)&&r.values.length===template.headers.length&&r.values.every((v:any)=>typeof v==='string')))return saved;
 }catch{}
 return [];
}
export function saveList(key:TemplateKey,rows:ListRow[]){
 let saved:any={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
 localStorage.setItem(KEY,JSON.stringify({...saved,[key]:rows}));
}
