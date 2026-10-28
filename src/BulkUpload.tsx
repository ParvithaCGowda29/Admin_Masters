import {useEffect,useMemo,useRef,useState} from 'react';
import {autoMap,dedupeRows,detectHeader,importDataRows,mappedRows,matchingSheetIndex,readImportFile,type ImportSheet} from './bulkImport';
import {loadRows} from './provider';

type Props={master:string;headers:string[];file:File;onClose:()=>void;onImport:(values:string[][])=>Promise<void>};
export function BulkUpload({master,headers,file,onClose,onImport}:Props){
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
 const prepared=useMemo(()=>{
  if(!selected)return {rows:[] as string[][],fresh:[] as string[][],exact:0,changed:0,error:''};
  try{
   const rows=mappedRows(selected.rows,headerRow,mapping,headers.length);
   const result=dedupeRows(loadRows(master).map(r=>r.values),rows);
   return {rows,fresh:result.fresh,exact:result.exact,changed:result.changed,error:''};
  }
  catch(err){return {rows:[] as string[][],fresh:[] as string[][],exact:0,changed:0,error:err instanceof Error?err.message:String(err)};}
 },[selected,headerRow,mapping,headers.length,master]);
 function configure(next:ImportSheet[],index:number,row=detectHeader(next[index].rows,headers)){
  setSheetIndex(index);setHeaderRow(row);
  const length=Math.max(...next[index].rows.map(r=>r.length));
  setMapping(autoMap(Array.from({length},(_,i)=>next[index].rows[row][i]||''),headers));setError('');
 }
 async function choose(file?:File){
  if(!file)return;
  setBusy(true);setError('');setSheets([]);
  try{const next=await readImportFile(file);if(!alive.current)return;setSheets(next);setFileName(file.name);const matching=matchingSheetIndex(next,master);configure(next,matching>=0?matching:0);}
  catch(err){if(alive.current)setError(err instanceof Error?err.message:'Could not read this file.');}
  finally{if(alive.current)setBusy(false);}
 }
 useEffect(()=>{void choose(file)},[file]);
 async function confirmImport(){
  setBusy(true);setError('');
  try{await onImport(prepared.rows);onClose();}
  catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}
 }
 return <dialog ref={dialog} className="bulk-dialog" aria-labelledby="bulk-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <div className="bulk-heading"><div><h2 id="bulk-title">Bulk Upload to {master}</h2><p>Choose a file, map its columns, then append the rows.</p></div><button aria-label="Close bulk upload" disabled={busy} onClick={onClose}>×</button></div>
  <div className="bulk-body">
   <label className="bulk-file">Excel or CSV file<input aria-label="Upload file" type="file" accept=".xlsx,.csv" disabled={busy} onClick={e=>{e.currentTarget.value='';}} onChange={e=>{void choose(e.target.files?.[0]);}}/><small>.xlsx and .csv only · Up to 10 MB · Processed in this browser</small></label>
   {selected&&<>
    <div className="bulk-options"><label>Worksheet<select aria-label="Worksheet" value={sheetIndex} disabled={busy} onChange={e=>configure(sheets,Number(e.target.value))}>{sheets.map((s,i)=><option key={i} value={i}>{s.name}</option>)}</select></label><label>Header row<input aria-label="Header row" type="number" min={1} max={selected.rows.length} value={headerRow+1} disabled={busy} onChange={e=>{const row=e.target.valueAsNumber-1;if(Number.isInteger(row)&&row>=0&&row<selected.rows.length)configure(sheets,sheetIndex,row);}}/></label></div>
    <p className="bulk-hint">{fileName} · Header row detected automatically. Adjust it if needed. Unmapped master fields stay blank; ID values are kept exactly as supplied.</p>
    <table className="mapping-table"><thead><tr><th>File column</th><th>Sample value</th><th>{master} field</th></tr></thead><tbody>{columns.map((name,i)=><tr key={i}><td>{name}<small>Column {i+1}</small></td><td className="bulk-sample">{importDataRows(selected.rows,headerRow).find(r=>r[i]?.trim())?.[i]||'-'}</td><td><select aria-label={`Map column ${i+1}: ${name}`} value={mapping[i]??-1} disabled={busy} onChange={e=>setMapping(current=>current.map((v,j)=>j===i?Number(e.target.value):v))}><option value={-1}>Skip this column</option>{headers.map((h,j)=><option key={j} value={j}>{h}{j===0?' (ID)':''}</option>)}</select></td></tr>)}</tbody></table>
    <p className="bulk-summary">{prepared.fresh.length} new row{prepared.fresh.length===1?'':'s'} ready to append.{prepared.exact>0&&` ${prepared.exact} already present will be skipped.`}{prepared.changed>0&&` ${prepared.changed} use an existing ID with different values and won't be overwritten.`} Existing rows will be kept. Blank mapped rows are skipped.</p>
   </>}
   {(error||prepared.error)&&<p role="alert" className="bulk-error">{error||prepared.error}</p>}
   {busy&&<p role="status">{selected?'Importing rows...':'Reading file...'}</p>}
  </div>
  <div className="bulk-footer"><span>Saved on this device only</span><button disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!!prepared.error||!prepared.fresh.length} onClick={()=>void confirmImport()}>Import {prepared.fresh.length||''} new row{prepared.fresh.length===1?'':'s'}</button></div>
 </dialog>;
}
