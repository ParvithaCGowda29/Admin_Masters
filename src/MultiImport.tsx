import {useEffect,useMemo,useRef,useState} from 'react';
import {dedupeRows,planFiles,readImportFile,type ImportScope,type MasterTarget,type SourceFile,type WorkbookPlan} from './bulkImport';
import {loadRows} from './provider';

type Props={files:File[];scope:ImportScope;masters:MasterTarget[];onClose:()=>void;onImport:(entries:{master:string;values:string[][]}[])=>Promise<void>};
export function MultiImport({files,scope,masters,onClose,onImport}:Props){
 const [plan,setPlan]=useState<WorkbookPlan|null>(null);
 const [skipped,setSkipped]=useState<string[]>([]);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;const element=dialog.current;element?.showModal();return()=>{alive.current=false;element?.close();};},[]);
 useEffect(()=>{(async()=>{
  setBusy(true);
  const sources:SourceFile[]=[];const failed:string[]=[];
  for(const file of files){
   try{sources.push({name:file.name,sheets:await readImportFile(file)});}
   catch(err){failed.push(`${file.name} (${err instanceof Error?err.message:'could not be read'})`);}
  }
  if(!alive.current)return;
  setSkipped(failed);
  setPlan(planFiles(sources,masters,scope));
  setBusy(false);
 })();},[files,masters,scope]);
 const tabs=plan?new Set(plan.plans.map(p=>p.master)).size:0;
 // Prospective duplicate counts per master tab, computed on the same merged rows the
 // import sends, so repeats across files in one import are counted too.
 const preview=useMemo(()=>{
  if(!plan)return null;
  const byMaster=new Map<string,string[][]>();
  for(const p of plan.plans)byMaster.set(p.master,[...(byMaster.get(p.master)||[]),...p.rows]);
  let added=0,skipped=0,changed=0;
  for(const [master,rows] of byMaster){const result=dedupeRows(loadRows(master).map(r=>r.values),rows);added+=result.fresh.length;skipped+=result.exact+result.changed;changed+=result.changed;}
  return {added,skipped,changed};
 },[plan]);
 const total=preview?preview.added:0;
 async function confirmImport(){
  if(!plan)return;
  setBusy(true);setError('');
  try{
   const byMaster=new Map<string,string[][]>();
   for(const p of plan.plans)byMaster.set(p.master,[...(byMaster.get(p.master)||[]),...p.rows]);
   await onImport([...byMaster].filter(([,values])=>values.length).map(([master,values])=>({master,values})));
   onClose();
  }catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}
 }
 return <dialog ref={dialog} className="bulk-dialog" aria-labelledby="multi-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <div className="bulk-heading"><div><h2 id="multi-title">Review import</h2><p>{files.length} file{files.length===1?'':'s'}. {scope.type==='tab'?`Everything maps into the ${scope.tab} tab only.`:'Workbooks fill tabs by sheet name; CSVs fill the tab their filename matches.'}</p></div><button aria-label="Close import review" disabled={busy} onClick={onClose}>×</button></div>
  <div className="bulk-body">
   {plan&&<>
    <p className="bulk-hint">Header rows and columns are matched automatically. Unmatched fields stay blank; ID values are kept exactly as supplied. Filetype is read-only and never receives imports.</p>
    <table className="mapping-table review-table"><thead><tr><th>File</th><th>Sheet</th><th>Master tab</th><th>Columns matched</th><th>Rows</th></tr></thead><tbody>
     {plan.plans.map(p=><tr key={`${p.file||''}:${p.sheet}`}><td>{p.file||p.sheet}</td><td>{p.sheet}</td><td>{p.master}</td><td>{p.note}</td><td><b>{p.rows.length}</b></td></tr>)}
     {plan.missingTabs.map(n=><tr key={n} className="review-none"><td colSpan={2}>-</td><td>{n}</td><td>No matching file. This tab stays unchanged.</td><td>0</td></tr>)}
    </tbody></table>
    {plan.unmatchedSheets.length>0&&<p className="bulk-hint review-skipped"><b>Sheets skipped:</b> {plan.unmatchedSheets.map(s=>`${s.name} (${s.reason})`).join('; ')}.</p>}
    {skipped.length>0&&<p className="bulk-hint review-skipped"><b>Files skipped:</b> {skipped.join('; ')}.</p>}
    <p className="bulk-summary">{total} new row{total===1?'':'s'} across {tabs} tab{tabs===1?'':'s'} ready to append.{preview!.skipped>0&&` ${preview!.skipped} already-present row${preview!.skipped===1?'':'s'} will be skipped${preview!.changed?`, including ${preview!.changed} that use an existing ID with different values and won't be overwritten`:''}.`} Existing rows will be kept.</p>
   </>}
   {error&&<p role="alert" className="bulk-error">{error}</p>}
   {busy&&!plan&&<p role="status">Reading files...</p>}
   {busy&&plan&&<p role="status">Importing rows...</p>}
  </div>
  <div className="bulk-footer"><span>Saved on this device only</span><button disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!plan||!total} onClick={()=>void confirmImport()}>Import {total||''} new row{total===1?'':'s'} into {tabs||''} tab{tabs===1?'':'s'}</button></div>
 </dialog>;
}
