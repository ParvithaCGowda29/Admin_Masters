import {useEffect,useMemo,useRef,useState} from 'react';
import {dedupeRows,planWorkbook,readImportFile,type MasterTarget,type WorkbookPlan} from './bulkImport';
import {loadRows} from './provider';

type Props={masters:MasterTarget[];file:File;onClose:()=>void;onImport:(entries:{master:string;values:string[][]}[])=>Promise<void>};
export function BulkUploadAll({masters,file,onClose,onImport}:Props){
 const [plan,setPlan]=useState<WorkbookPlan|null>(null);
 const [fileName,setFileName]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;const element=dialog.current;element?.showModal();return()=>{alive.current=false;element?.close();};},[]);
 async function choose(file?:File){
  if(!file)return;
  setBusy(true);setError('');setPlan(null);
  try{
   if(!/\.xlsx$/i.test(file.name))throw Error('Choose one .xlsx workbook. For a .csv, use Bulk Upload on a single tab.');
   const sheets=await readImportFile(file);
   if(!alive.current)return;
   setPlan(planWorkbook(sheets,masters));setFileName(file.name);
  }catch(err){if(alive.current)setError(err instanceof Error?err.message:'Could not read this file.');}
  finally{if(alive.current)setBusy(false);}
 }
 useEffect(()=>{void choose(file)},[file]);
 // Prospective duplicate counts against the rows already stored on this device; the
 // import itself re-checks before saving, so these numbers only set expectations.
 const preview=useMemo(()=>{
  if(!plan)return null;
  const plans=plan.plans.map(p=>({plan:p,result:dedupeRows(loadRows(p.master).map(r=>r.values),p.rows)}));
  return {plans,added:plans.reduce((n,x)=>n+x.result.fresh.length,0),skipped:plans.reduce((n,x)=>n+x.result.exact+x.result.changed,0),changed:plans.reduce((n,x)=>n+x.result.changed,0)};
 },[plan]);
 const total=preview?preview.added:0;
 async function confirmImport(){
  if(!plan)return;
  setBusy(true);setError('');
  try{await onImport(plan.plans.filter(p=>p.rows.length).map(p=>({master:p.master,values:p.rows})));onClose();}
  catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}
 }
 return <dialog ref={dialog} className="bulk-dialog" aria-labelledby="bulk-all-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <div className="bulk-heading"><div><h2 id="bulk-all-title">Bulk Upload all tabs</h2><p>Choose one masters workbook. Each sheet fills the tab with the same name.</p></div><button aria-label="Close bulk upload" disabled={busy} onClick={onClose}>×</button></div>
  <div className="bulk-body">
   <label className="bulk-file">Masters workbook (.xlsx)<input aria-label="Upload workbook" type="file" accept=".xlsx" disabled={busy} onClick={e=>{e.currentTarget.value='';}} onChange={e=>{void choose(e.target.files?.[0]);}}/><small>Sheets named {masters.map(m=>m.name).join(', ')} · Up to 10 MB · Processed in this browser</small></label>
   {plan&&<>
    <p className="bulk-hint">{fileName} · Header rows and columns are matched automatically. Unmatched fields stay blank; ID values are kept exactly as supplied. To fill one tab on its own, use Bulk Upload inside that tab.</p>
    <table className="mapping-table review-table"><thead><tr><th>Master tab</th><th>Sheet used</th><th>Columns matched</th><th>Rows to import</th></tr></thead><tbody>
     {preview!.plans.map(({plan:p,result})=><tr key={p.master}><td>{p.master}</td><td>{p.sheet}</td><td>{p.note}</td><td><b>{result.fresh.length}</b>{result.exact+result.changed>0&&<small>{` (${result.exact+result.changed} already present)`}</small>}</td></tr>)}
     {plan.missingTabs.map(n=><tr key={n} className="review-none"><td>{n}</td><td colSpan={2}>No matching sheet. This tab stays unchanged.</td><td>0</td></tr>)}
    </tbody></table>
    {plan.unmatchedSheets.length>0&&<p className="bulk-hint review-skipped"><b>Sheets skipped:</b> {plan.unmatchedSheets.map(s=>`${s.name} (${s.reason})`).join('; ')}. Filetype is read-only and never receives imports.</p>}
    <p className="bulk-summary">{total} new row{total===1?'':'s'} across {plan.plans.length} tab{plan.plans.length===1?'':'s'} ready to append.{preview!.skipped>0&&` ${preview!.skipped} already-present row${preview!.skipped===1?'':'s'} will be skipped${preview!.changed?`, including ${preview!.changed} that use an existing ID with different values and won't be overwritten`:''}.`} Existing rows will be kept.</p>
   </>}
   {error&&<p role="alert" className="bulk-error">{error}</p>}
   {busy&&<p role="status">{plan?'Importing rows...':'Reading file...'}</p>}
  </div>
  <div className="bulk-footer"><span>Saved on this device only</span><button disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!plan||!total} onClick={()=>void confirmImport()}>Import {total||''} new rows into {plan?.plans.length||''} tabs</button></div>
 </dialog>;
}
