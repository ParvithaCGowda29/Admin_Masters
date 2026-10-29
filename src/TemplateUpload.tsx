import {useEffect,useRef,useState} from 'react';
import {detectHeader,importDataRows,matchingTemplate,readImportFile,type ImportSheet} from './bulkImport';
import type {MastersTemplate} from './templates';
import {loadHeaders,loadList} from './templateLists';

type Props={template:MastersTemplate;onClose:()=>void;onImport:(headers:string[],values:string[][])=>Promise<void>};
// Uploads a new version of one list template (Employee list, Customers, Assets or
// Systems). The upload replaces that template completely: the file's column names and
// rows become the template (2026-10-29 decision) and the previous columns and rows are
// discarded. Only this list changes - the other lists and the master tabs stay
// untouched, and the download in the Organization column header follows the new
// structure.
export function TemplateUpload({template,onClose,onImport}:Props){
 const [sheets,setSheets]=useState<ImportSheet[]>([]);
 const [sheetIndex,setSheetIndex]=useState(0);
 const [headerRow,setHeaderRow]=useState(0);
 const [fileName,setFileName]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;const element=dialog.current;element?.showModal();return()=>{alive.current=false;element?.close();};},[]);
 const selected=sheets[sheetIndex];
 const width=selected?Math.max(...selected.rows.map(r=>r.length)):0;
 const headers=selected?Array.from({length:width},(_,i)=>selected.rows[headerRow]?.[i]?.trim()||`Column ${i+1}`):[];
 // A file that is exactly one of the other blank templates points the user at the right entry.
 const otherLabel=selected?matchingTemplate(selected.rows[headerRow]||[]):null;
 const wrongTemplate=otherLabel&&otherLabel!==template.label?otherLabel:null;
 const rows=selected?importDataRows(selected.rows,headerRow).map(row=>Array.from({length:width},(_,i)=>String(row[i]??''))).filter(row=>row.some(v=>v.trim())):[];
 const currentHeaders=loadHeaders(template.key,template);
 const currentRows=loadList(template.key,template).length;
 function configure(next:ImportSheet[],index:number,row=detectHeader(next[index].rows,template.headers)){
  setSheetIndex(index);setHeaderRow(row);setError('');
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
  try{await onImport(headers,rows);onClose();}
  catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}
 }
 return <dialog ref={dialog} className="bulk-dialog" aria-labelledby="template-upload-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <div className="bulk-heading"><div><h2 id="template-upload-title">Upload a new {template.label} template</h2><p>The uploaded file becomes your {template.label} template: its column names and rows replace the current ones. Only this list changes; the other lists and the masters stay unchanged.</p></div><button aria-label="Close template upload" disabled={busy} onClick={onClose}>×</button></div>
  <div className="bulk-body">
   <label className="bulk-file">Excel or CSV file<input aria-label="Upload file" type="file" accept=".xlsx,.csv" disabled={busy} onClick={e=>{e.currentTarget.value='';}} onChange={e=>{void choose(e.target.files?.[0]);}}/><small>.xlsx and .csv only · Up to 10 MB · Processed in this browser</small></label>
   {selected&&<>
    <div className="bulk-options"><label>Worksheet<select aria-label="Worksheet" value={sheetIndex} disabled={busy} onChange={e=>configure(sheets,Number(e.target.value))}>{sheets.map((s,i)=><option key={i} value={i}>{s.name}</option>)}</select></label><label>Header row<input aria-label="Header row" type="number" min={1} max={selected.rows.length} value={headerRow+1} disabled={busy} onChange={e=>{const row=e.target.valueAsNumber-1;if(Number.isInteger(row)&&row>=0&&row<selected.rows.length)configure(sheets,sheetIndex,row);}}/></label></div>
    <p className="bulk-hint">{fileName} · These columns become the new {template.label} template. Blank rows are skipped.</p>
    <table className="mapping-table"><thead><tr><th>New column</th><th>Sample value</th></tr></thead><tbody>{headers.map((name,i)=><tr key={i}><td>{name}<small>Column {i+1}</small></td><td className="bulk-sample">{rows.find(r=>r[i]?.trim())?.[i]||'-'}</td></tr>)}</tbody></table>
    <p className="bulk-summary">{headers.length} column{headers.length===1?'':'s'} and {rows.length} row{rows.length===1?'':'s'} from this file replace your current {template.label} template ({currentRows} row{currentRows===1?'':'s'}, columns: {currentHeaders.join(', ')}). The previous columns and rows are discarded; the other lists and the masters stay unchanged.</p>
   </>}
   {wrongTemplate&&<p role="alert" className="bulk-error">This file's columns are exactly the {wrongTemplate} template. Upload it under {wrongTemplate} in Add templates instead.</p>}
   {!wrongTemplate&&error&&<p role="alert" className="bulk-error">{error}</p>}
   {busy&&<p role="status">{selected?'Replacing template...':'Reading file...'}</p>}
  </div>
  <div className="bulk-footer"><span>Saved on this device only</span><button disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!selected||!!wrongTemplate} onClick={()=>void confirmImport()}>Replace template</button></div>
 </dialog>;
}
