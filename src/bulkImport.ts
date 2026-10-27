import {read,utils} from 'xlsx';
import {parseCSV} from './csv';

export type ImportSheet={name:string;rows:string[][]};
export const normalizeHeader=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
export function autoMap(headers:string[],targets:string[]):number[]{
 const used=new Set<number>();
 return headers.map(header=>{
  const key=normalizeHeader(header);
  const target=key?targets.findIndex((h,i)=>!used.has(i)&&normalizeHeader(h)===key):-1;
  if(target>=0)used.add(target);
  return target;
 });
}
export function detectHeader(rows:string[][],targets:string[]):number{
 let best=0,score=-1;
 rows.slice(0,50).forEach((row,index)=>{
  const filled=row.filter(v=>v.trim());
  if(!filled.length)return;
  const matches=autoMap(row,targets).filter(i=>i>=0).length;
  const value=matches*100+Math.min(new Set(filled.map(normalizeHeader)).size,20);
  if(value>score){score=value;best=index;}
 });
 return best;
}
export async function readImportFile(file:File):Promise<ImportSheet[]>{
 if(!/\.(xlsx|csv)$/i.test(file.name))throw Error('Choose an .xlsx or .csv file.');
 if(file.size>10*1024*1024)throw Error('Choose a file smaller than 10 MB.');
 let sheets:ImportSheet[];
 if(/\.csv$/i.test(file.name))sheets=[{name:'CSV',rows:parseCSV(await file.text())}];
 else{
  const book=read(await file.arrayBuffer(),{type:'array'});
  sheets=book.SheetNames.map(name=>({name,rows:utils.sheet_to_json<string[]>(book.Sheets[name],{header:1,defval:'',raw:false,blankrows:true}).map(row=>row.map(v=>String(v??'')))}));
 }
 const filled=sheets.filter(s=>s.rows.some(row=>row.some(v=>v.trim())));
 if(!filled.length)throw Error('This file has no filled cells.');
 if(filled.some(s=>s.rows.length>20000||s.rows.some(r=>r.length>200)))throw Error('Use a file with at most 20,000 rows and 200 columns per sheet.');
 return filled;
}
export function mappedRows(rows:string[][],headerRow:number,mapping:number[],width:number):string[][]{
 const targets=mapping.filter(i=>i>=0);
 if(!targets.length)throw Error('Map at least one file column.');
 if(new Set(targets).size!==targets.length)throw Error('Each master column can be mapped only once.');
 if(targets.some(i=>i>=width))throw Error('A mapping is outside the master columns.');
 return rows.slice(headerRow+1).map(row=>{
  const values=Array<string>(width).fill('');
  mapping.forEach((target,index)=>{if(target>=0)values[target]=String(row[index]??'');});
  return values;
 }).filter(row=>row.some(v=>v.trim()));
}
