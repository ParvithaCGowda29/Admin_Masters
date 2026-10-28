import {read,utils} from 'xlsx';
import {parseCSV} from './csv';

export type ImportSheet={name:string;rows:string[][]};
export const normalizeHeader=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
// Source workbook labels can differ from the current master schema. Keep aliases
// explicit so metadata/description rows do not win header detection by accident.
const HEADER_ALIASES:Record<string,string>={
 orgid:'orgid',organizationid:'orgid',organisationid:'orgid',code:'orgid',
 company:'companytype',organizationname:'companytype',organisationname:'companytype',orgname:'companytype',companyname:'companytype',
 brand:'brandproperties',website:'brandproperties',brandprofile:'brandproperties',websitegbpsocialmedia:'brandproperties',
 address:'location',registeredaddress:'location',registeredlocation:'location',
 qualitystandards:'certifications',qualityregulatorystandards:'certifications',certification:'certifications',
 businesssegmentandofferings:'companysegmentnicheofferings',companysegment:'companysegmentnicheofferings',companydetails:'companysegmentnicheofferings',orgdetails:'companysegmentnicheofferings',offerings:'companysegmentnicheofferings',
 customer:'customersaudience','clientaccounts':'customersaudience',audience:'customersaudience','customersandaudience':'customersaudience',
 userrole:'employeesjobrole',employees:'employeesjobrole',
 knowledgebase:'datasources',knowledgebases:'datasources',
 erpapiintegrationendpoints:'systemstoolssoftware',systemstools:'systemstoolssoftware',
 hardware:'assetshardware',notes:'fdenotes',
};
const headerKey=(value:string)=>{const key=normalizeHeader(value);return HEADER_ALIASES[key]||key;};
export function autoMap(headers:string[],targets:string[]):number[]{
 const used=new Set<number>();
 return headers.map(header=>{
  const key=headerKey(header);
  const target=key?targets.findIndex((h,i)=>!used.has(i)&&headerKey(h)===key):-1;
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
export function importDataRows(rows:string[][],headerRow:number):string[][]{
 return rows.slice(headerRow+1).filter(row=>{
  const first=normalizeHeader(row[0]||'');
  return !['description','context','definition','stable'].some(label=>first.startsWith(label));
 });
}
export function mappedRows(rows:string[][],headerRow:number,mapping:number[],width:number):string[][]{
 const targets=mapping.filter(i=>i>=0);
 if(!targets.length)throw Error('Map at least one file column.');
 if(new Set(targets).size!==targets.length)throw Error('Each master column can be mapped only once.');
 if(targets.some(i=>i>=width))throw Error('A mapping is outside the master columns.');
 return importDataRows(rows,headerRow).map(row=>{
  const values=Array<string>(width).fill('');
  mapping.forEach((target,index)=>{if(target>=0)values[target]=String(row[index]??'');});
  return values;
 }).filter(row=>row.some(v=>v.trim()));
}

export type MasterTarget={name:string;headers:string[]};
export type SheetPlan={master:string;sheet:string;headerRow:number;mapped:number;total:number;rows:string[][];note:string;file?:string};
export type WorkbookPlan={plans:SheetPlan[];unmatchedSheets:{name:string;reason:string}[];missingTabs:string[]};
const ALIASES:Record<string,string>={organization:'organization',organisation:'organization',organizations:'organization',organisations:'organization',org:'organization',agent:'agents',agents:'agents',skill:'skills',skills:'skills',rule:'rules',rules:'rules',tool:'tools',tools:'tools',tooling:'tools'};
// Tolerant sheet-name match: case, spaces and punctuation ignored; a trailing "master(s)" is ignored.
export function sheetKey(name:string):string{
 const key=normalizeHeader(name).replace(/masters?$/,'');
 return ALIASES[key]||key;
}
export function matchingSheetIndex(sheets:ImportSheet[],master:string):number{
 const key=sheetKey(master);
 return sheets.findIndex(sheet=>sheetKey(sheet.name)===key);
}
export function planWorkbook(sheets:ImportSheet[],masters:MasterTarget[]):WorkbookPlan{
 const plans:SheetPlan[]=[];const unmatchedSheets:{name:string;reason:string}[]=[];const used=new Set<string>();
 for(const sheet of sheets){
  const master=masters.find(m=>sheetKey(m.name)===sheetKey(sheet.name));
  if(!master){unmatchedSheets.push({name:sheet.name,reason:sheetKey(sheet.name)==='filetype'?'Read-only, never imported':'No master tab with this name'});continue;}

  if(used.has(master.name)){unmatchedSheets.push({name:sheet.name,reason:`Duplicate of the sheet already used for ${master.name}`});continue;}
  const headerRow=detectHeader(sheet.rows,master.headers);
  const width=Math.max(...sheet.rows.map(r=>r.length));
  const mapping=autoMap(Array.from({length:width},(_,i)=>sheet.rows[headerRow]?.[i]||''),master.headers);
  const mapped=mapping.filter(i=>i>=0).length;
  if(!mapped){unmatchedSheets.push({name:sheet.name,reason:`No column headings match ${master.name}`});continue;}
  used.add(master.name);
  const rows=mappedRows(sheet.rows,headerRow,mapping,master.headers.length);
  plans.push({master:master.name,sheet:sheet.name,headerRow,mapped,total:master.headers.length,rows,note:`${mapped} of ${master.headers.length} columns matched`});
 }
 return {plans,unmatchedSheets,missingTabs:masters.filter(m=>!used.has(m.name)).map(m=>m.name)};
}

export type DedupeResult={fresh:string[][];exact:number;changed:number};
// Import duplicate protection: re-importing the same file must not add its rows again.
// A row is a duplicate when every cell matches an existing (or already queued) row after
// trimming and whitespace/case folding. A row whose ID matches but whose other cells
// differ is a changed version: it is skipped too, never used to overwrite the existing
// row, and reported separately so the conflict stays visible.
const cellKey=(value:string)=>value.trim().replace(/\s+/g,' ').toLowerCase();
const rowKey=(values:string[])=>values.map(cellKey).join('\u0001');
export function dedupeRows(existing:string[][],incoming:string[][],idIndex=0):DedupeResult{
 const seen=new Set(existing.map(rowKey));
 const ids=new Set(existing.map(row=>cellKey(row[idIndex]||'')).filter(Boolean));
 const fresh:string[][]=[];let exact=0,changed=0;
 for(const row of incoming){
  const key=rowKey(row);
  if(seen.has(key)){exact++;continue;}
  const id=cellKey(row[idIndex]||'');
  if(id&&ids.has(id)){changed++;continue;}
  seen.add(key);if(id)ids.add(id);
  fresh.push(row);
 }
 return {fresh,exact,changed};
}

export type SourceFile={name:string;sheets:ImportSheet[]};
export type ImportScope={type:'all'}|{type:'tab';tab:string};
// Folder/zip import routing. Masters parent scope ('all'): each workbook's sheets fill tabs
// by sheet name and each CSV fills the tab its filename matches. Single-tab scope ('tab'):
// every file maps into the open tab only - a workbook contributes the sheet named like the
// tab when present, otherwise its first sheet; other sheets are reported as skipped.
export function planFiles(files:SourceFile[],masters:MasterTarget[],scope:ImportScope):WorkbookPlan{
 const plans:SheetPlan[]=[];const unmatchedSheets:WorkbookPlan['unmatchedSheets']=[];
 const addSheet=(master:MasterTarget,name:string,rows:string[][],file?:string)=>{
  const headerRow=detectHeader(rows,master.headers);
  const width=rows.length?Math.max(...rows.map(r=>r.length)):0;
  const mapping=autoMap(Array.from({length:width},(_,i)=>rows[headerRow]?.[i]||''),master.headers);
  const mapped=mapping.filter(i=>i>=0).length;
  if(!mapped){unmatchedSheets.push({name,reason:`No column headings match ${master.name}`});return;}
  plans.push({master:master.name,sheet:name,headerRow,mapped,total:master.headers.length,rows:mappedRows(rows,headerRow,mapping,master.headers.length),note:`${mapped} of ${master.headers.length} columns matched`,file});
 };
 for(const file of files){
  if(scope.type==='tab'){
   const master=masters.find(m=>sheetKey(m.name)===sheetKey(scope.tab));
   if(!master){unmatchedSheets.push({name:file.name,reason:`${scope.tab} is read-only, so it cannot receive imports`});continue;}
   if(/\.csv$/i.test(file.name)){addSheet(master,file.name,file.sheets[0]?.rows||[],file.name);continue;}
   const chosen=(()=>{const index=matchingSheetIndex(file.sheets,master.name);return index>=0?index:0;})();
   file.sheets.forEach((sheet,index)=>{
    if(index===chosen)addSheet(master,sheet.name,sheet.rows,file.name);
    else unmatchedSheets.push({name:`${file.name} \u00b7 ${sheet.name}`,reason:`Only the ${master.name} sheet imports while the ${scope.tab} tab is open`});
   });
  }else if(/\.csv$/i.test(file.name)){
   const key=sheetKey(file.name.replace(/\.csv$/i,''));
   if(key==='filetype'){unmatchedSheets.push({name:file.name,reason:'Read-only, never imported'});continue;}
   const master=masters.find(m=>sheetKey(m.name)===key);
   if(!master){unmatchedSheets.push({name:file.name,reason:'No master tab with this name. Name the file after a tab, or open that tab to import it'});continue;}
   addSheet(master,file.name,file.sheets[0]?.rows||[],file.name);
  }else{
   const plan=planWorkbook(file.sheets,masters);
   plans.push(...plan.plans.map(p=>({...p,file:file.name})));
   unmatchedSheets.push(...plan.unmatchedSheets.map(s=>({...s,name:`${file.name} \u00b7 ${s.name}`})));
  }
 }
 // Single-tab scope targets only the open tab, so other tabs are never "missing".
 const missingTabs=scope.type==='tab'
  ?(plans.length?[]:[scope.tab])
  :masters.filter(m=>!plans.some(p=>p.master===m.name)).map(m=>m.name);
 return {plans,unmatchedSheets,missingTabs};
}
