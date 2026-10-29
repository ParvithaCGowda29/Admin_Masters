import {useRef,useState} from 'react';
import {unzipSync} from 'fflate';
import {autoMap,detectHeader,importDataRows,mappedRows,readImportFile,sheetKey,templateInRows,type ImportSheet,type MasterTarget} from './bulkImport';

export type ExtractScope={type:'all'}|{type:'tab';tab:string};
type Props={scope:ExtractScope;masters:MasterTarget[];onClose:()=>void;onImport:(entries:{master:string;values:string[][]}[])=>Promise<void>};

type Step='source'|'permission'|'find'|'review';
const STEPS:{key:Step;label:string}[]=[{key:'source',label:'Source'},{key:'permission',label:'Permission'},{key:'find',label:'Find files'},{key:'review',label:'Review mapping'}];
// At or above this header-match percent a table starts ticked; below it the table waits,
// unticked, until the user fixes the destination or the column mapping and ticks it.
const MATCH_OK=60;

type Picked={file:File;allowed:boolean};
type TablePlan={id:string;file:string;sheet:string;rows:string[][];headerRow:number;master:string;mapping:number[];included:boolean;blocked:string|null};
type FindProgress={done:number;total:number;current:string;found:number};

const isCsv=(name:string)=>/\.csv$/i.test(name);
const extOk=(name:string,types:{xlsx:boolean;csv:boolean})=>isCsv(name)?types.csv:/\.xlsx$/i.test(name)?types.xlsx:false;

export function ExtractFlow({scope,masters,onClose,onImport}:Props){
 const fileInput=useRef<HTMLInputElement>(null);
 const folderInput=useRef<HTMLInputElement>(null);
 const stopRef=useRef(false);
 const[step,setStep]=useState<Step>('source');
 const[files,setFiles]=useState<Picked[]>([]);
 const[types,setTypes]=useState({xlsx:true,csv:true});
 const[pickError,setPickError]=useState('');
 const[plans,setPlans]=useState<TablePlan[]>([]);
 const[failed,setFailed]=useState<string[]>([]);
 const[progress,setProgress]=useState<FindProgress>({done:0,total:0,current:'',found:0});
 const[expanded,setExpanded]=useState<Set<string>>(new Set());
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');

 const stepIndex=STEPS.findIndex(s=>s.key===step);
 const headersOf=(name:string)=>masters.find(m=>m.name===name)?.headers||[];
 const mappedCount=(p:TablePlan)=>p.mapping.filter(i=>i>=0).length;
 const matchPct=(p:TablePlan)=>{const total=headersOf(p.master).length;return total?Math.round(mappedCount(p)/total*100):0;};
 const importable=(p:TablePlan)=>!p.blocked&&mappedCount(p)>0;
 const unresolved=(p:TablePlan)=>importable(p)&&matchPct(p)<MATCH_OK;
 const ready=plans.filter(p=>p.included&&importable(p));
 const readyCount=ready.length;

 function suggestMaster(sheet:ImportSheet,file:string):string{
  if(scope.type==='tab')return scope.tab;
  // A CSV carries one table, so the tab suggestion comes from the file name.
  const named=masters.find(m=>sheetKey(m.name)===sheetKey(sheet.name==='CSV'?file.replace(/\.csv$/i,''):sheet.name));
  if(named)return named.name;
  // No sheet-name match: offer the master whose fixed columns match this sheet best.
  let best=masters[0]?.name||'',bestMapped=0;
  for(const master of masters){
   const headerRow=detectHeader(sheet.rows,master.headers);
   const width=sheet.rows.length?Math.max(...sheet.rows.map(r=>r.length)):0;
   const mapped=autoMap(Array.from({length:width},(_,i)=>sheet.rows[headerRow]?.[i]||''),master.headers).filter(i=>i>=0).length;
   if(mapped>bestMapped){bestMapped=mapped;best=master.name;}
  }
  return best;
 }
 function planFor(file:string,sheet:ImportSheet):TablePlan{
  const template=templateInRows(sheet.rows);
  const blocked=template?`${template} template - filled template lists are uploaded under Add templates in the sidebar, not imported into Masters`:null;
  const master=suggestMaster(sheet,file);
  const headers=headersOf(master);
  const headerRow=headers.length?detectHeader(sheet.rows,headers):0;
  const width=sheet.rows.length?Math.max(...sheet.rows.map(r=>r.length)):0;
  const mapping=headers.length?autoMap(Array.from({length:width},(_,i)=>sheet.rows[headerRow]?.[i]||''),headers):[];
  const plan:TablePlan={id:crypto.randomUUID(),file,sheet:sheet.name,rows:sheet.rows,headerRow,master,mapping,included:false,blocked};
  plan.included=importable(plan)&&!unresolved(plan);
  return plan;
 }
 function retarget(id:string,master:string){
  setPlans(current=>current.map(p=>{
   if(p.id!==id)return p;
   const headers=headersOf(master);
   const headerRow=detectHeader(p.rows,headers);
   const width=p.rows.length?Math.max(...p.rows.map(r=>r.length)):0;
   const mapping=autoMap(Array.from({length:width},(_,i)=>p.rows[headerRow]?.[i]||''),headers);
   return {...p,master,headerRow,mapping,included:false};
  }));
 }
 function remap(id:string,mapping:number[]){
  setPlans(current=>current.map(p=>{
   if(p.id!==id)return p;
   const next={...p,mapping};
   // Fixing the columns can make a waiting table ready, but the tick stays the user's.
   return {...next,included:p.included&&importable(next)&&!unresolved(next)};
  }));
 }
 async function addFiles(list:FileList|File[]){
  setPickError('');
  const out:File[]=[];const skipped:string[]=[];
  for(const f of [...list]){
   if(/\.zip$/i.test(f.name)){
    try{
     const entries=unzipSync(new Uint8Array(await f.arrayBuffer()));
     const inner=Object.entries(entries).filter(([path])=>/\.(xlsx|csv)$/i.test(path)&&!path.split('/').some(part=>part.startsWith('.')||part==='__MACOSX'));
     if(!inner.length){skipped.push(`${f.name} (no .xlsx or .csv inside)`);continue;}
     for(const [path,data] of inner)out.push(new File([data.buffer as ArrayBuffer],path.split('/').pop()||path));
    }catch{skipped.push(`${f.name} (could not be read)`);}
    continue;
   }
   if(/\.(xlsx|csv)$/i.test(f.name))out.push(f);else skipped.push(`${f.name} (only .xlsx and .csv are read)`);
  }
  if(skipped.length)setPickError(`Skipped: ${skipped.join('; ')}.`);
  setFiles(current=>{
   const seen=new Set(current.map(p=>p.file.name));
   return [...current,...out.filter(f=>!seen.has(f.name)).map(file=>({file,allowed:true}))];
  });
 }
 const selected=files.filter(p=>p.allowed&&extOk(p.file.name,types));
 async function runFind(){
  stopRef.current=false;
  setStep('find');
  const next:TablePlan[]=[];const failedFiles:string[]=[];
  const chosen=selected.map(p=>p.file);
  for(let i=0;i<chosen.length;i++){
   if(stopRef.current)return;
   setProgress({done:i,total:chosen.length,current:chosen[i].name,found:next.length});
   try{
    const sheets=await readImportFile(chosen[i]);
    for(const sheet of sheets)next.push(planFor(chosen[i].name,sheet));
   }catch(err){failedFiles.push(`${chosen[i].name} (${err instanceof Error?err.message:'could not be read'})`);}
   // Let the progress step paint between files.
   await new Promise(r=>setTimeout(r,120));
  }
  if(stopRef.current)return;
  setProgress({done:chosen.length,total:chosen.length,current:'',found:next.length});
  setPlans(next);setFailed(failedFiles);setExpanded(new Set());
  setStep('review');
 }
 async function confirmImport(){
  if(!readyCount)return;
  setBusy(true);setError('');
  try{
   const byMaster=new Map<string,string[][]>();
   for(const p of ready){
    const rows=mappedRows(p.rows,p.headerRow,p.mapping,headersOf(p.master).length);
    byMaster.set(p.master,[...(byMaster.get(p.master)||[]),...rows]);
   }
   await onImport([...byMaster].filter(([,values])=>values.length).map(([master,values])=>({master,values})));
   onClose();
  }catch(err){setError(err instanceof Error?err.message:String(err));setBusy(false);}
 }
 const titles:Record<Step,string>={source:'Add files',permission:'Allow read-only access to your files',find:'Finding tables',review:'Review where each file goes'};
 return <dialog ref={el=>{if(el&&!el.open)el.showModal();}} className="bulk-dialog ex-dialog" aria-labelledby="ex-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <div className="bulk-heading">
   <div>
    <h2 id="ex-title">{titles[step]}</h2>
    <div className="ex-steps" aria-label="Extraction steps">
     {STEPS.map((s,i)=><span key={s.key} className="ex-step-wrap">
      {i>0&&<span className="ex-link" aria-hidden="true"/>}
      <span className={'ex-step'+(i===stepIndex?' current':'')+(i<stepIndex?' done':'')} aria-current={i===stepIndex?'step':undefined}>
       <span className="ex-dot">{i<stepIndex?'✓':i+1}</span><span>{s.label}</span>
      </span>
     </span>)}
    </div>
   </div>
   <button aria-label="Close add files" disabled={busy} onClick={onClose}>×</button>
  </div>
  <div className="bulk-body">
   {step==='source'&&<>
    <p className="ex-label">UPLOAD FILES</p>
    <div className="ex-drop" role="button" tabIndex={0}
     onClick={()=>fileInput.current?.click()}
     onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.current?.click();}}}
     onDragOver={e=>e.preventDefault()}
     onDrop={e=>{e.preventDefault();void addFiles(e.dataTransfer.files);}}>
     <strong>Drop .xlsx / .csv here</strong> or browse your device
     <small>Content is mapped automatically on the review step. Rows are added, never replaced.</small>
    </div>
    <input ref={fileInput} type="file" hidden multiple accept=".xlsx,.csv,.zip" aria-label="Choose files from this device" onChange={e=>{if(e.target.files?.length)void addFiles(e.target.files);e.target.value='';}}/>
    <p className="ex-label">OR EXTRACT FROM A SOURCE</p>
    <div className="ex-sources">
     <button type="button" className="ex-source" onClick={()=>folderInput.current?.click()}>
      <span className="ex-icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/></svg></span>
      <strong>This device</strong>
      <small>Pick a folder on your computer. Only the folder you choose is read.</small>
      <span className="ex-badge">Read-only</span>
     </button>
     <button type="button" className="ex-source" disabled title="SharePoint needs company sign-in and a backend service, which this app doesn't have yet">
      <span className="ex-icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.7 1.6A4 4 0 0 0 6 19z"/></svg></span>
      <strong>SharePoint</strong>
      <small>Not connected. Company sign-in and a backend service are needed first.</small>
      <span className="ex-badge off">Not connected</span>
     </button>
     <button type="button" className="ex-source" disabled title="Google Drive needs sign-in and a backend service, which this app doesn't have yet">
      <span className="ex-icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.7 1.6A4 4 0 0 0 6 19z"/></svg></span>
      <strong>Google Drive</strong>
      <small>Not connected. Sign-in and a backend service are needed first.</small>
      <span className="ex-badge off">Not connected</span>
     </button>
    </div>
    <input ref={folderInput} type="file" hidden multiple {...({webkitdirectory:'',directory:''} as object)} aria-label="Choose a folder from this device" onChange={e=>{if(e.target.files?.length)void addFiles(e.target.files!);e.target.value='';}}/>
    {pickError&&<p role="alert" className="bulk-error">{pickError}</p>}
    <p className="ex-note">Extraction never reads more than the files you choose. You pick exactly which files on the next step, everything is processed in this browser only, and nothing is imported until you confirm.</p>
   </>}
   {step==='permission'&&<>
    <div className="ex-perm">
     <div>
      <p className="ex-label">1. CHOOSE WHAT BULLM MAY READ</p>
      <div className="ex-panel">
       {files.map((p,i)=>{
        const typeOff=!extOk(p.file.name,types);
        return <label key={`${p.file.name}-${i}`} className={'ex-check'+(typeOff?' off':'')}>
         <input type="checkbox" checked={p.allowed&&!typeOff} disabled={typeOff} onChange={e=>setFiles(current=>current.map((q,j)=>j===i?{...q,allowed:e.target.checked}:q))}/>
         <span>{p.file.name}<small>{Math.max(1,Math.round(p.file.size/1024))} KB{isCsv(p.file.name)?' · CSV':' · Excel'}</small></span>
        </label>;
       })}
      </div>
      <p className="ex-label">FILE TYPES</p>
      <div className="ex-panel">
       <label className="ex-check"><input type="checkbox" checked={types.xlsx} onChange={e=>setTypes(t=>({...t,xlsx:e.target.checked}))}/><span>Excel (.xlsx)</span></label>
       <label className="ex-check"><input type="checkbox" checked={types.csv} onChange={e=>setTypes(t=>({...t,csv:e.target.checked}))}/><span>CSV (.csv)</span></label>
       <label className="ex-check off"><input type="checkbox" disabled/><span>Other (PDF, Word) - later</span></label>
      </div>
     </div>
     <div>
      <p className="ex-label">2. WHAT THIS PERMISSION ALLOWS</p>
      <div className="ex-panel ex-allow">
       <p className="ex-yes"><b>✓</b> Read contents of the files you ticked<small>For this extraction job only, to map them into the masters</small></p>
       <p><b>✗</b> Edit, move or delete your files</p>
       <p><b>✗</b> Share files or read other folders</p>
       <p><b>✗</b> Keep reading after this extraction job ends</p>
      </div>
      <p className="ex-note">BuLLM can only read the files you picked here. Unticked files are never opened.</p>
      <p className="ex-note amber">This choice limits what BuLLM extracts in this job. It does not change your device or account permissions. You can stop the job at any time.</p>
     </div>
    </div>
   </>}
   {step==='find'&&<>
    <p className="ex-find-status" role="status">{progress.done<progress.total?`Reading file ${progress.done+1} of ${progress.total}: ${progress.current}`:'Finishing up...'}</p>
    <div className="ex-progress" aria-hidden="true"><span style={{width:`${progress.total?Math.round(progress.done/progress.total*100):0}%`}}/></div>
    <p className="bulk-hint">{progress.found} table{progress.found===1?'':'s'} found so far. Only the files you ticked are being read, and nothing is imported yet.</p>
   </>}
   {step==='review'&&<>
    {scope.type==='tab'&&<p className="bulk-hint">Everything maps into the {scope.tab} tab only.</p>}
    <div className="ex-tiles">
     <div className="ex-tile"><b>{plans.length}</b><span>tables found</span></div>
     <div className="ex-tile"><b>{readyCount}</b><span>ready to import</span></div>
     <div className="ex-tile"><b>{plans.filter(p=>!p.blocked&&!p.included).length}</b><span>needs mapping (not included)</span></div>
     <div className="ex-tile"><b>0</b><span>imported yet</span></div>
    </div>
    <table className="mapping-table ex-table">
     <thead><tr><th></th><th>File / sheet</th><th>Goes to tab</th><th>Match</th><th>Columns</th><th></th></tr></thead>
     <tbody>
      {plans.map(p=>{
       const headers=headersOf(p.master);const total=headers.length;const mapped=mappedCount(p);const pct=matchPct(p);
       const waiting=unresolved(p)||!importable(p);
       return <><tr key={p.id} className={waiting?'ex-waiting':''}>
        <td>{importable(p)&&<input type="checkbox" aria-label={`Include ${p.sheet} from ${p.file}`} checked={p.included} onChange={e=>setPlans(current=>current.map(q=>q.id===p.id?{...q,included:e.target.checked}:q))}/>}</td>
        <td>{p.file}{p.file!==p.sheet&&<small>{p.sheet}</small>}</td>
        <td>{p.blocked?'Add templates':scope.type==='tab'?p.master:<select aria-label={`Destination tab for ${p.sheet}`} value={p.master} onChange={e=>retarget(p.id,e.target.value)}>{masters.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select>}</td>
        <td>{p.blocked?'-':<span className={'ex-match '+(unresolved(p)||!importable(p)?'warn':'good')}>{pct}%</span>}</td>
        <td>{p.blocked?'Template file, never imported':mapped===0?'Unresolved: no columns match':mapped<total?`${unresolved(p)?'Unresolved: ':''}${total-mapped} of ${total} columns unmapped`:`${mapped} of ${total} columns`}</td>
        <td>{importable(p)&&<button type="button" className="ex-map-toggle" aria-expanded={expanded.has(p.id)} onClick={()=>setExpanded(current=>{const next=new Set(current);if(next.has(p.id))next.delete(p.id);else next.add(p.id);return next;})}>{expanded.has(p.id)?'Hide columns':'Map columns'}</button>}</td>
       </tr>
       {expanded.has(p.id)&&importable(p)&&<tr key={`${p.id}-map`} className="ex-map-row"><td colSpan={6}>
        <table className="mapping-table"><thead><tr><th>File column</th><th>Sample value</th><th>{p.master} field</th></tr></thead><tbody>
         {p.mapping.map((target,i)=>{
          const width=Math.max(...p.rows.map(r=>r.length));
          const name=p.rows[p.headerRow]?.[i]?.trim()||`Column ${i+1}`;
          const sample=importDataRows(p.rows,p.headerRow).find(r=>r[i]?.trim())?.[i]||'-';
          return <tr key={i}><td>{name}<small>Column {i+1} of {width}</small></td><td className="bulk-sample">{sample}</td><td><select aria-label={`Map column ${i+1}: ${name}`} value={target} onChange={e=>remap(p.id,p.mapping.map((v,j)=>j===i?Number(e.target.value):v))}><option value={-1}>Skip this column</option>{headers.map((h,j)=><option key={j} value={j}>{h}{j===0?' (ID)':''}</option>)}</select></td></tr>;
         })}
        </tbody></table>
       </td></tr>}
       </>;
      })}
     </tbody>
    </table>
    {failed.length>0&&<p className="bulk-hint review-skipped"><b>Files that could not be read:</b> {failed.join('; ')}.</p>}
    {plans.some(p=>p.blocked)&&<p className="bulk-hint review-skipped"><b>Held back:</b> {plans.filter(p=>p.blocked).map(p=>`${p.file}${p.file!==p.sheet?` · ${p.sheet}`:''} (${p.blocked})`).join('; ')}.</p>}
    {plans.filter(p=>unresolved(p)&&!p.included).slice(0,1).map(p=><p key={p.id} className="ex-note amber"><b>{p.file}</b> is not included yet. Its match to {p.master} is low ({matchPct(p)}%) and {headersOf(p.master).length-mappedCount(p)} columns are unmapped. Map the columns with the dropdowns{scope.type==='all'?' or pick another tab':''}, then tick it to include it.</p>)}
    <p className="ex-note">Masters columns stay fixed. New rows are added to the end of each tab. Nothing is imported until you confirm.</p>
    {error&&<p role="alert" className="bulk-error">{error}</p>}
    {busy&&<p role="status">Importing rows...</p>}
   </>}
  </div>
  <div className="bulk-footer">
   {step==='source'&&<>
    <span>{files.length?`${files.length} file${files.length===1?'':'s'} ready`:'Pick files or a folder to continue'}</span>
    <button onClick={onClose}>Cancel</button>
    <button className="primary" disabled={!files.length} onClick={()=>setStep('permission')}>Continue</button>
   </>}
   {step==='permission'&&<>
    <span>{selected.length} of {files.length} file{files.length===1?'':'s'} selected</span>
    <button onClick={()=>setStep('source')}>Back</button>
    <button className="primary" disabled={!selected.length} onClick={()=>void runFind()}>Allow read-only & find files</button>
   </>}
   {step==='find'&&<>
    <span>Read-only. This extraction job only.</span>
    <button onClick={()=>{stopRef.current=true;setStep('source');}}>Stop extraction</button>
   </>}
   {step==='review'&&<>
    <span>Nothing is imported until you confirm</span>
    <button disabled={busy} onClick={onClose}>Stop extraction</button>
    <button disabled={busy} onClick={()=>setStep('permission')}>Back</button>
    <button className="primary" disabled={busy||!readyCount} onClick={()=>void confirmImport()}>Import {readyCount||''} ready table{readyCount===1?'':'s'}</button>
   </>}
  </div>
 </dialog>;
}
