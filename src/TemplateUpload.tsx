import {useEffect,useMemo,useRef,useState} from 'react';
import {autoMap,dedupeRows,detectHeader,importDataRows,mappedRows,matchingTemplate,readImportFile,type ImportSheet} from './bulkImport';
import type {MastersTemplate} from './templates';
import {loadList} from './templateLists';

type Props={template:MastersTemplate;onClose:()=>void;onImport:(values:string[][])=>Promise<void>};
// Uploads a user's own filled version of one list template (Employee list, Customers,
// Assets or Systems). Columns map into that template's own fields explicitly, so custom
// column names land in the right place; the rows join the template's list in
// Add templates and never touch a master tab.
export function TemplateUpload({template,onClose,onImport}:Props){
 const [sheets,setSheets]=useState<ImportSheet[]>([]);
 const [sheetIndex,setSheetIndex]=useState(0);
 const [headerRow,setHeaderRow]=useState(0);
 const [mapping,setMapping]=useState<number[]>([]);
 const [fileName,setFileName]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;const element=dialog.current;element?.showModal();return()=>{alive.current=false;element?.close();};},[]);
 const selected=sheets[sheetIndex];
 const sourceHeaders=selected?.rows[headerRow]||[];
 const width=selected?Math.max(...selected.rows.map(r=>r.length)):0;
 const columns=Array.from({length:width},(_,i)=>sourceHeaders[i]?.trim()||`Column ${i+1}`);
 // A file that is exactly one of the other blank templates points the user at the right entry.
 const otherLabel=selected?matchingTemplate(sourceHeaders):null;
 const wrongTemplate=otherLabel&&otherLabel!==template.label?otherLabel:null;
 const prepared=useMemo(()=>{
  if(!selected)return {rows:[] as string[][],fresh:[] as string[][],exact:0,changed:0,error:''};
  try{
   const rows=mappedRows(selected.rows,headerRow,mapping,template.headers.length);
   const result=dedupeRows(loadList(template.key,template).map(r=>r.values),rows);
   return {rows,fresh:result.fresh,exact:result.exact,changed:result.changed,error:''};
  }
  catch(err){return {rows:[] as string[][],fresh:[] as string[][],exact:0,changed:0,error:err instanceof Error?err.message:String(err)};}
 },[selected,headerRow,mapping,template]);
 function configure(next:ImportSheet[],index:number,row=detectHeader(next[index].rows,template.headers)){
  setSheetIndex(index);setHeaderRow(row);
  const length=Math.max(...next[index].rows.map(r=>r.length));
  setMapping(autoMap(Array.from({length},(_,i)=>next[index].rows[row][i]||''),template.headers));setError('');
 }
 async function choose(file?:File){
  if(!file)return;
  setBusy(true);setError('');setSheets([]);
  try{const next=await readImportFile(file);if(!alive.current)return;setSheets(next);setFileName(file.name);configure(next,0);}
  catch(err){if(alive.current)setError(err instanceof Error?err.message:'Could not read this file.');}
  finally{if(alive.current)setBusy(false);}
 }
 async function confirmImport(){
  setBusy(true);setError('');
  try{await onImport(prepared.rows);onClose();}
  catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}
 }
 return <dialog ref={dialog} className="bulk-dialog" aria-labelledby="template-upload-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <div className="bulk-heading"><div><h2 id="template-upload-title">Upload your own {template.label} template</h2><p>Map your file's columns into the {template.label} fields. Rows join your {template.label} template in Add templates; the masters stay unchanged.</p></div><button aria-label="Close template upload" disabled={busy} onClick={onClose}>×</button></div>
  <div className="bulk-body">
   <label className="bulk-file">Excel or CSV file<input aria-label="Upload file" type="file" accept=".xlsx,.csv" disabled={busy} onClick={e=>{e.currentTarget.value='';}} onChange={e=>{void choose(e.target.files?.[0]);}}/><small>.xlsx and .csv only · Up to 10 MB · Processed in this browser</small></label>
   {selected&&<>
    <div className="bulk-options"><label>Worksheet<select aria-label="Worksheet" value={sheetIndex} disabled={busy} onChange={e=>configure(sheets,Number(e.target.value))}>{sheets.map((s,i)=><option key={i} value={i}>{s.name}</option>)}</select></label><label>Header row<input aria-label="Header row" type="number" min={1} max={selected.rows.length} value={headerRow+1} disabled={busy} onChange={e=>{const row=e.target.valueAsNumber-1;if(Number.isInteger(row)&&row>=0&&row<selected.rows.length)configure(sheets,sheetIndex,row);}}/></label></div>
    <p className="bulk-hint">{fileName} · Columns are matched automatically. Fix any field with its dropdown so values land in the right columns. Unmapped fields stay blank.</p>
    <table className="mapping-table"><thead><tr><th>File column</th><th>Sample value</th><th>{template.label} field</th></tr></thead><tbody>{columns.map((name,i)=><tr key={i}><td>{name}<small>Column {i+1}</small></td><td className="bulk-sample">{importDataRows(selected.rows,headerRow).find(r=>r[i]?.trim())?.[i]||'-'}</td><td><select aria-label={`Map column ${i+1}: ${name}`} value={mapping[i]??-1} disabled={busy} onChange={e=>setMapping(current=>current.map((v,j)=>j===i?Number(e.target.value):v))}><option value={-1}>Skip this column</option>{template.headers.map((h,j)=><option key={j} value={j}>{h}</option>)}</select></td></tr>)}</tbody></table>
    <p className="bulk-summary">{prepared.fresh.length} new row{prepared.fresh.length===1?'':'s'} ready to add to your {template.label} template.{prepared.exact>0&&` ${prepared.exact} already present will be skipped.`}{prepared.changed>0&&` ${prepared.changed} use an existing ${template.headers[0]} with different values and won't be overwritten.`} Blank mapped rows are skipped.</p>
   </>}
   {wrongTemplate&&<p role="alert" className="bulk-error">This file's columns are exactly the {wrongTemplate} template. Upload it under {wrongTemplate} in Add templates instead.</p>}
   {!wrongTemplate&&(error||prepared.error)&&<p role="alert" className="bulk-error">{error||prepared.error}</p>}
   {busy&&<p role="status">{selected?'Adding rows...':'Reading file...'}</p>}
  </div>
  <div className="bulk-footer"><span>Saved on this device only</span><button disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!!wrongTemplate||!!prepared.error||!prepared.fresh.length} onClick={()=>void confirmImport()}>Add {prepared.fresh.length||''} new row{prepared.fresh.length===1?'':'s'}</button></div>
 </dialog>;
}
