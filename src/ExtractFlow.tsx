import {useEffect,useRef,useState} from 'react';
import Uppy from '@uppy/core';
import Dashboard from '@uppy/react/dashboard';
import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';
import {IconFolder,IconUpload,IconArchive,IconStack2} from './icons';
import {OnyxSettings} from './OnyxSettings';
import {loadOnyxConfig,uploadToOnyx,type OnyxConfig} from './onyx';
import {unzipSync} from 'fflate';
import {autoMap,detectHeader,importDataRows,mappedRows,readImportFile,sheetKey,templateInRows,type ImportSheet,type MasterTarget} from './bulkImport';
import {newId} from './id';
import bullMark from './assets/login/bull-logo.png';

export type ExtractScope={type:'all'}|{type:'tab';tab:string};
type Props={dark:boolean;scope:ExtractScope;masters:MasterTarget[];onClose:()=>void;onImport:(entries:{master:string;values:string[][]}[])=>Promise<void>};

type Step='source'|'permission'|'find'|'review';
const STEPS:{key:Step;label:string}[]=[{key:'source',label:'Source'},{key:'permission',label:'Permission'},{key:'find',label:'Fetch files'},{key:'review',label:'Mapping'}];
// At or above this header-match percent a fully resolved table starts ticked. A high
// percentage alone never ticks a table: every source column with content must be
// mapped or explicitly ignored, and the master's ID column must be mapped.
const MATCH_OK=60;
const IGNORE=-2; // mapping select value for "Ignore this column" (stored in plan.ignored)

// Intake takes any project document. Only tabular master data (.xlsx/.csv) is read and
// mapped; drawings, SOPs and client emails are listed so the set of project documents
// stays complete, and are never opened in this version.
const isTable=(name:string)=>/\.(xlsx|csv)$/i.test(name);
const isDoc=(name:string)=>/\.(pdf|dxf|dwg|step|stp|docx|md|txt|eml|msg)$/i.test(name);
const docKind=(name:string)=>{
 if(/\.(eml|msg)$/i.test(name))return 'Client email';
 if(/\.(docx|md|txt)$/i.test(name))return 'SOP';
 if(/\.(dxf|dwg|step|stp)$/i.test(name))return 'Drawing';
 return 'Drawing / SOP'; // .pdf
};

type Picked={file:File;allowed:boolean;kind:'table'|'doc'};
type Access='read'|'write';
type TablePlan={id:string;file:string;sheet:string;rows:string[][];headerRow:number;master:string;mapping:number[];ignored:number[];content:boolean[];included:boolean;blocked:string|null};
type FindProgress={done:number;total:number;current:string;found:number};

const isCsv=(name:string)=>/\.csv$/i.test(name);
const extOk=(name:string,types:{xlsx:boolean;csv:boolean})=>isCsv(name)?types.csv:/\.xlsx$/i.test(name)?types.xlsx:false;

export function ExtractFlow({dark,scope,masters,onClose,onImport}:Props){
 const fileInput=useRef<HTMLInputElement>(null);
 const folderInput=useRef<HTMLInputElement>(null);
 const zipInput=useRef<HTMLInputElement>(null);
 const stopRef=useRef(false);
 const[step,setStep]=useState<Step>('source');
 const[files,setFiles]=useState<Picked[]>([]);
 const[types,setTypes]=useState({xlsx:true,csv:true});
 const[access,setAccess]=useState<Access>('read');
 const[pickError,setPickError]=useState('');
 const[plans,setPlans]=useState<TablePlan[]>([]);
 const[failed,setFailed]=useState<string[]>([]);
 const[progress,setProgress]=useState<FindProgress>({done:0,total:0,current:'',found:0});
 const[expanded,setExpanded]=useState<Set<string>>(new Set());
 const[uppyCount,setUppyCount]=useState(0);
 // The Uppy dashboard is the intake preview for all three options (folder, bulk, zip). It
 // never uploads anywhere: Continue reads its file list and hands the File objects to the
 // same processing the typed inputs used before (zip expansion, type classification).
 const[uppy]=useState(()=>new Uppy({autoProceed:false,restrictions:{maxNumberOfFiles:null,allowedFileTypes:['.xlsx','.csv','.zip','.pdf','.dxf','.dwg','.step','.stp','.docx','.md','.txt','.eml','.msg']}}));
 useEffect(()=>{
  const update=()=>setUppyCount(uppy.getFiles().length);
  uppy.on('file-added',update);uppy.on('file-removed',update);
  // No uppy.destroy() here: StrictMode's setup/cleanup/setup cycle would kill the instance the
  // second setup still uses. The dialog is short-lived; Dashboard uninstalls its plugin on unmount.
  return()=>{uppy.off('file-added',update);uppy.off('file-removed',update);};
 },[uppy]);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 // Onyx: when connected, the picked files are also sent to the Onyx server to read and
 // index at the fetch step (docs like drawings/SOPs/emails become tickable then).
 const[onyxCfg,setOnyxCfg]=useState<OnyxConfig|null>(()=>loadOnyxConfig());
 const[onyxConnected,setOnyxConnected]=useState(false);
 const[onyxOpen,setOnyxOpen]=useState(false);
 const[onyxResult,setOnyxResult]=useState<{sent:string[];failed:string[]}|null>(null);

 const stepIndex=STEPS.findIndex(s=>s.key===step);
 const headersOf=(name:string)=>masters.find(m=>m.name===name)?.headers||[];
 const mappedCount=(p:TablePlan)=>p.mapping.filter(i=>i>=0).length;
 const matchPct=(p:TablePlan)=>{const total=headersOf(p.master).length;return total?Math.round(mappedCount(p)/total*100):0;};
 // Columns with any content (heading or a cell) must each be resolved before import.
 const needsReview=(p:TablePlan,i:number)=>p.content[i]&&p.mapping[i]<0&&!p.ignored.includes(i);
 const reviewCount=(p:TablePlan)=>p.content.reduce((n,has,i)=>n+(has&&p.mapping[i]<0&&!p.ignored.includes(i)?1:0),0);
 const idMapped=(p:TablePlan)=>p.mapping.includes(0);
 // Safe to include only when nothing is silently dropped: ID mapped and every
 // content-bearing source column either mapped or explicitly ignored. This is also the
 // Mapped Yes/No rule: a table shows Yes only when every column with content is resolved.
 const resolvable=(p:TablePlan)=>!p.blocked&&mappedCount(p)>0&&idMapped(p)&&reviewCount(p)===0;
 const ignoredCount=(p:TablePlan)=>p.ignored.length;
 const ready=plans.filter(p=>p.included&&resolvable(p));
 const readyCount=ready.length;
 const needMapping=plans.filter(p=>!p.blocked&&!resolvable(p)).length;
 // Unmapped and needs-mapping tables list first; ready tables after them; held-back
 // template files last.
 const sortedPlans=[...plans].sort((a,b)=>{
  const rank=(p:TablePlan)=>p.blocked?2:resolvable(p)?1:0;
  return rank(a)-rank(b);
 });

 function analyze(file:string,sheet:ImportSheet,master:string):Pick<TablePlan,'headerRow'|'mapping'|'content'>{
  const headers=headersOf(master);
  const headerRow=headers.length?detectHeader(sheet.rows,headers):0;
  const width=sheet.rows.length?Math.max(...sheet.rows.map(r=>r.length)):0;
  const data=importDataRows(sheet.rows,headerRow);
  const content=Array.from({length:width},(_,i)=>!!(sheet.rows[headerRow]?.[i]||'').trim()||data.some(r=>(r[i]||'').trim()));
  const mapping=headers.length?autoMap(Array.from({length:width},(_,i)=>sheet.rows[headerRow]?.[i]||''),headers):[];
  return {headerRow,mapping,content};
 }
 function suggestMaster(sheet:ImportSheet,file:string):string{
  if(scope.type==='tab')return scope.tab;
  // A CSV carries one table, so the tab suggestion comes from the file name.
  const named=masters.find(m=>sheetKey(m.name)===sheetKey(sheet.name==='CSV'?file.replace(/\.csv$/i,''):sheet.name));
  if(named)return named.name;
  // No sheet-name match: offer the master whose fixed columns match this sheet best.
  let best=masters[0]?.name||'',bestMapped=0;
  for(const master of masters){
   const {mapping}=analyze(file,sheet,master.name);
   const mapped=mapping.filter(i=>i>=0).length;
   if(mapped>bestMapped){bestMapped=mapped;best=master.name;}
  }
  return best;
 }
 function planFor(file:string,sheet:ImportSheet):TablePlan{
  const template=templateInRows(sheet.rows);
  const blocked=template?`${template} template - filled template lists are uploaded under Add templates in the sidebar, not imported into Masters`:null;
  const master=suggestMaster(sheet,file);
  const plan:TablePlan={id:newId(),file,sheet:sheet.name,rows:sheet.rows,master,ignored:[],included:false,blocked,...analyze(file,sheet,master)};
  plan.included=resolvable(plan)&&matchPct(plan)>=MATCH_OK;
  return plan;
 }
 function retarget(id:string,master:string){
  setPlans(current=>current.map(p=>{
   if(p.id!==id)return p;
   const next={...p,master,ignored:[],included:false,...analyze(p.file,{name:p.sheet,rows:p.rows},master)};
   return next;
  }));
 }
 // One master column can receive one source column. Mapping onto a used target frees the
 // previous source column back to "needs review" instead of silently overwriting it.
 function remap(id:string,column:number,value:number){
  setPlans(current=>current.map(p=>{
   if(p.id!==id)return p;
   const mapping=p.mapping.map((v,j)=>{
    if(j===column)return value>=0?value:-1;
    if(value>=0&&v===value)return -1;
    return v;
   });
   const ignored=value===IGNORE?[...p.ignored,column]:p.ignored.filter(j=>j!==column&&mapping[j]<0);
   const next={...p,mapping,ignored:[...new Set(ignored)]};
   return {...next,included:p.included&&resolvable(next)};
  }));
 }
 const selected=files.filter(p=>p.kind==='table'&&p.allowed&&extOk(p.file.name,types));
 async function addFiles(list:FileList|File[]){
  setPickError('');
  const out:Picked[]=[];const skipped:string[]=[];
  for(const f of [...list]){
   if(/\.zip$/i.test(f.name)){
    try{
     const entries=unzipSync(new Uint8Array(await f.arrayBuffer()));
     const inner=Object.entries(entries).filter(([path])=>/\.(xlsx|csv)$/i.test(path)&&!path.split('/').some(part=>part.startsWith('.')||part==='__MACOSX'));
     if(!inner.length){skipped.push(`${f.name} (no .xlsx or .csv inside)`);continue;}
     for(const [path,data] of inner)out.push({file:new File([data.buffer as ArrayBuffer],path.split('/').pop()||path),allowed:true,kind:'table'});
    }catch{skipped.push(`${f.name} (could not be read)`);}
    continue;
   }
   if(isTable(f.name)){out.push({file:f,allowed:true,kind:'table'});continue;}
   if(isDoc(f.name)){out.push({file:f,allowed:false,kind:'doc'});continue;}
   skipped.push(`${f.name} (not a project document type)`);
  }
  if(skipped.length)setPickError(`Skipped: ${skipped.join('; ')}.`);
  // The dashboard is the whole intake, so the processed set replaces whatever an earlier
  // Continue staged (duplicates inside one batch are kept once).
  const seen=new Set<string>();
  const next=out.filter(p=>!seen.has(p.file.name)&&(seen.add(p.file.name),true));
  setFiles(next);
  return next.length;
 }
 // Folder, bulk and zip inputs all feed the dashboard preview; duplicates are Uppy's call.
 function addToDashboard(list:FileList|null){
  if(!list)return;
  for(const file of [...list]){try{uppy.addFile({name:file.name,type:file.type,data:file});}catch{}}
 }
 async function continueFromSource(){
  const picked=uppy.getFiles().map(f=>new File([f.data as Blob],f.name,{type:f.type||undefined}));
  const added=await addFiles(picked);
  if(added>0)setStep('permission');
 }
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
    // README sheets are documentation, not data: their content lives on each tab's (i)
    // info icon, so they never enter the mapping list.
    for(const sheet of sheets){if(/^read\s*me\b/i.test(sheet.name.trim()))continue;next.push(planFor(chosen[i].name,sheet));}
   }catch(err){failedFiles.push(`${chosen[i].name} (${err instanceof Error?err.message:'could not be read'})`);}
   // Let the progress step paint between files.
   await new Promise(r=>setTimeout(r,120));
  }
  if(stopRef.current)return;
  setProgress({done:chosen.length,total:chosen.length,current:'',found:next.length});
  // Onyx reads and indexes every file this job may read - including the documents this
  // browser cannot parse. Its result is reported on the review step, never silently.
  if(onyxCfg&&onyxConnected){
   const forOnyx=files.filter(p=>p.allowed&&(p.kind==='doc'||extOk(p.file.name,types))).map(p=>p.file);
   setOnyxResult(forOnyx.length?await uploadToOnyx(onyxCfg,forOnyx):null);
  }else setOnyxResult(null);
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
 const titles:Record<Step,string>={source:'Add files',permission:access==='read'?'Allow read-only access to your files':'Allow read-write access to your files',find:'Fetching tables',review:'Review where each file maps'};
 return <><dialog ref={el=>{if(el&&!el.open)el.showModal();}} className="bulk-dialog ex-dialog" aria-labelledby="ex-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <div className="bulk-heading">
   <div>
    <h2 id="ex-title">{titles[step]}</h2>
    <div className="ex-steps" aria-label="Extraction steps">
     {STEPS.map((s,i)=><span key={s.key} className="ex-step-wrap">
      {i>0&&<span className="ex-link" aria-hidden="true"/>}
      <span className={'ex-step'+(i===stepIndex?' current':'')+(i<stepIndex?' done':'')} aria-current={i===stepIndex?'step':undefined}>
       <span className="ex-dot">{i<stepIndex?'✓':s.key==='find'?<img className="ex-dot-icon" src={bullMark} alt="" aria-hidden="true"/>:<svg className="ex-dot-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855"/></svg>}</span><span>{s.label}</span>
      </span>
     </span>)}
    </div>
   </div>
   <button aria-label="Close add files" disabled={busy} onClick={onClose}>×</button>
  </div>
  <div className="bulk-body">
   {step==='source'&&<>
    <p className="ex-label">UPLOAD PROJECT DOCUMENTS</p>
    <div className="ex-options" role="group" aria-label="Upload options">
     <button type="button" className="ex-option" onClick={()=>folderInput.current?.click()}>
      <span className="ex-option-num" aria-hidden="true">1</span>
      <IconFolder size={17}/>
      <strong>Choose folder</strong>
      <small>Every project document in the folder you pick</small>
     </button>
     <button type="button" className="ex-option" onClick={()=>fileInput.current?.click()}>
      <span className="ex-option-num" aria-hidden="true">2</span>
      <IconUpload size={17}/>
      <strong>Bulk upload</strong>
      <small>Pick several files at once</small>
     </button>
     <button type="button" className="ex-option" onClick={()=>zipInput.current?.click()}>
      <span className="ex-option-num" aria-hidden="true">3</span>
      <IconArchive size={17}/>
      <strong>Zip upload</strong>
      <small>One .zip of project documents</small>
     </button>
    </div>
    <Dashboard uppy={uppy} width="100%" height={280} proudlyDisplayPoweredByUppy={false} hideUploadButton theme={dark?'dark':'light'} note="Only relevant content maps into the master tabs. Rows are added, never replaced."/>
    <span className="ex-chips" aria-label="Accepted document types">
     <span className="ex-chip">Master data <b>.xlsx .csv</b></span>
     <span className="ex-chip">Drawings <b>.pdf .dxf .dwg .step</b></span>
     <span className="ex-chip">SOPs <b>.pdf .docx .md .txt</b></span>
     <span className="ex-chip">Client emails <b>.eml .msg</b></span>
    </span>
    <input ref={fileInput} type="file" hidden multiple accept=".xlsx,.csv,.pdf,.dxf,.dwg,.step,.stp,.docx,.md,.txt,.eml,.msg" aria-label="Choose files from this device" onChange={e=>{addToDashboard(e.target.files);e.target.value='';}}/>
    <input ref={zipInput} type="file" hidden accept=".zip" aria-label="Choose a zip file from this device" onChange={e=>{addToDashboard(e.target.files);e.target.value='';}}/>
    <input ref={folderInput} type="file" hidden multiple {...({webkitdirectory:'',directory:''} as object)} aria-label="Choose a folder from this device" onChange={e=>{addToDashboard(e.target.files);e.target.value='';}}/>
    <p className="ex-label">OR EXTRACT FROM A SOURCE</p>
    <div className="ex-sources">
     <button type="button" className="ex-source" onClick={()=>setOnyxOpen(true)}>
      <span className="ex-icon" aria-hidden="true"><IconStack2 size={15}/></span>
      <strong>Onyx</strong>
      <small>{onyxCfg&&onyxConnected?`Linked to ${(()=>{try{return new URL(onyxCfg.url).host}catch{return 'your Onyx server'}})()}. Files you tick are sent to Onyx to read and index.`:onyxCfg?'Connection saved. Open to test or update it.':'Connect your Onyx server so it reads and indexes the picked files.'}</small>
      <span className={'ex-badge'+(onyxCfg&&onyxConnected?'':' off')}>{onyxCfg&&onyxConnected?'Connected':'Not connected'}</span>
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
    {pickError&&<p role="alert" className="bulk-error">{pickError}</p>}
    <p className="ex-note">Extraction never reads more than the files you choose. You pick exactly which files on the next step, everything is processed in this browser only, and nothing is imported until you confirm.</p>
   </>}
   {step==='permission'&&<>
    {pickError&&<p role="alert" className="bulk-error">{pickError}</p>}
    <p className="ex-label">ACCESS LEVEL</p>
    <div className="ex-access" role="radiogroup" aria-label="Access level">
     <button type="button" role="radio" aria-checked={access==='read'} className={'ex-access-card'+(access==='read'?' on':'')} onClick={()=>setAccess('read')}>
      <strong>Read-only <span>(Extract)</span></strong>
      <small>BuLLM reads the ticked files and maps their content into the master columns. Nothing is added to the masters.</small>
     </button>
     <button type="button" role="radio" aria-checked={access==='write'} className={'ex-access-card'+(access==='write'?' on':'')} onClick={()=>setAccess('write')}>
      <strong>Read-write <span>(Extract + authorize)</span></strong>
      <small>Everything in Read-only, plus BuLLM may add the rows you approve to the masters on the review step.</small>
     </button>
    </div>
    <div className="ex-perm">
     <div>
      <p className="ex-label">1. CHOOSE WHAT BULLM MAY READ</p>
      <div className="ex-panel">
       {files.map((p,i)=>{
        const typeOff=p.kind==='table'&&!extOk(p.file.name,types);
        if(p.kind==='doc')return <label key={`${p.file.name}-${i}`} className={'ex-check'+(onyxConnected?'':' off')}>
         <input type="checkbox" checked={p.allowed} disabled={!onyxConnected} onChange={e=>setFiles(current=>current.map((q,j)=>j===i?{...q,allowed:e.target.checked}:q))}/>
         <span>{p.file.name}<small>{Math.max(1,Math.round(p.file.size/1024))} KB · {docKind(p.file.name)} - {onyxConnected?'sent to Onyx for reading':'listed, not read yet'}</small></span>
        </label>;
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
       <label className="ex-check off"><input type="checkbox" disabled/><span>Drawings, SOPs and client emails - {onyxConnected?'read by Onyx when ticked above':'listed, not read yet'}</span></label>
      </div>
     </div>
     <div>
      <p className="ex-label">2. WHAT THIS PERMISSION ALLOWS</p>
      <div className="ex-panel ex-allow">
       <p className="ex-yes"><b>✓</b> Read contents of the files you ticked<small>For this extraction job only, to map them into the masters</small></p>
       {access==='write'
        ?<p className="ex-yes"><b>✓</b> Add the rows you approve to the masters<small>Only after you review the mapping and confirm the import</small></p>
        :<p><b>✗</b> Add anything to the masters<small>Read-only job: mappings are reviewed, never imported</small></p>}
       <p><b>✗</b> Edit, move or delete your files</p>
       <p><b>✗</b> Share files or read other folders</p>
       <p><b>✗</b> Keep reading after this extraction job ends</p>
      </div>
      <p className="ex-label">3. WHO DOES WHAT</p>
      <div className="ex-panel ex-who">
       <p><img src={bullMark} alt="" aria-hidden="true"/> Find tables in the ticked files<small>Automated</small></p>
       <p><img src={bullMark} alt="" aria-hidden="true"/> Map columns to master fields<small>Automated - you review every mapping</small></p>
       <p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg> Confirm access<small>You - this step</small></p>
       <p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg> Review the mapping<small>You - next step</small></p>
       <p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg> Approve the import<small>You - {access==='write'?'final step':'off in a read-only job'}</small></p>
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
    <p className="ex-summary">{plans.length} table{plans.length===1?'':'s'} found · {readyCount} ready to import · {needMapping} need mapping</p>
    <table className="mapping-table ex-table">
     <thead><tr><th></th><th>File / sheet</th><th>Maps with</th><th>Mapped</th><th></th></tr></thead>
     <tbody>
      {sortedPlans.map(p=>{
       const headers=headersOf(p.master);
       const waiting=!resolvable(p);
       const toggle=<button type="button" className="ex-map-toggle" aria-expanded={expanded.has(p.id)} onClick={()=>setExpanded(current=>{const next=new Set(current);if(next.has(p.id))next.delete(p.id);else next.add(p.id);return next;})}>{expanded.has(p.id)?'Hide columns':'Map columns'}</button>;
       return <><tr key={p.id} className={waiting&&!p.blocked?'ex-waiting':''}>
        <td>{!p.blocked&&<input type="checkbox" aria-label={`Include ${p.sheet} from ${p.file}`} checked={p.included} disabled={!resolvable(p)} title={resolvable(p)?undefined:'Map or ignore every column with content, and map the ID column, first'} onChange={e=>setPlans(current=>current.map(q=>q.id===p.id?{...q,included:e.target.checked}:q))}/>}</td>
        <td>{p.file}{p.file!==p.sheet&&<small>{p.sheet}</small>}</td>
        <td>{p.blocked?<span>Add templates<small>{p.blocked}</small></span>:scope.type==='tab'?p.master:<select aria-label={`Destination tab for ${p.sheet}`} value={p.master} onChange={e=>retarget(p.id,e.target.value)}>{masters.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select>}</td>
        <td>{p.blocked?'-':<span className={'ex-pill '+(waiting?'no':'yes')}>{waiting?'No':'Yes'}</span>}</td>
        <td>{!p.blocked&&toggle}</td>
       </tr>
       {expanded.has(p.id)&&!p.blocked&&<tr key={`${p.id}-map`} className="ex-map-row"><td colSpan={5}>
        <table className="mapping-table"><thead><tr><th>File column</th><th>Sample value</th><th>{p.master} field</th></tr></thead><tbody>
         {p.mapping.map((target,i)=>{
          const name=p.rows[p.headerRow]?.[i]?.trim()||`Column ${i+1}`;
          const sample=importDataRows(p.rows,p.headerRow).find(r=>r[i]?.trim())?.[i]||'-';
          const value=p.ignored.includes(i)?IGNORE:target;
          return <tr key={i} className={needsReview(p,i)?'ex-waiting':''}><td>{name}<small>Column {i+1}</small></td><td className="bulk-sample">{sample}</td><td><select aria-label={`Map column ${i+1}: ${name}`} value={value} onChange={e=>remap(p.id,i,Number(e.target.value))}><option value={-1}>Needs review</option><option value={IGNORE}>Ignore this column</option>{headers.map((h,j)=><option key={j} value={j}>{h}{j===0?' (ID)':''}</option>)}</select></td></tr>;
         })}
        </tbody></table>
        <p className="bulk-hint">Every column with content must be mapped to a {p.master} field or explicitly ignored before this table can be included. Ignored columns are left out of the import.</p>
       </td></tr>}
       </>;
      })}
     </tbody>
    </table>
    {onyxResult&&<p className="ex-note"><b>Onyx:</b> {onyxResult.sent.length?`${onyxResult.sent.length} file${onyxResult.sent.length===1?'':'s'} sent to Onyx, which reads and indexes them (including documents this browser cannot parse)`:''}{onyxResult.failed.length?` Could not send: ${onyxResult.failed.join('; ')}.`:''} The master mapping above still runs in this browser.</p>}
    {failed.length>0&&<p className="bulk-hint review-skipped"><b>Files that could not be read:</b> {failed.join('; ')}.</p>}
    {plans.some(p=>p.blocked)&&<p className="bulk-hint review-skipped"><b>Held back:</b> {plans.filter(p=>p.blocked).map(p=>`${p.file}${p.file!==p.sheet?` · ${p.sheet}`:''} (${p.blocked})`).join('; ')}.</p>}
    {plans.filter(p=>!p.blocked&&!resolvable(p)).slice(0,1).map(p=><p key={p.id} className="ex-note amber"><b>{p.file}</b> is not included yet. {reviewCount(p)>0?`${reviewCount(p)} column${reviewCount(p)===1?'':'s'} with content ${reviewCount(p)===1?'is':'are'} not mapped`:'The ID column is not mapped'}. Open Map columns and map or ignore each one, then tick the table to include it. Nothing is dropped without your choice.</p>)}
    <p className="ex-note">A table shows Mapped Yes only when every column with content is mapped or ignored and the ID column is mapped. Masters columns stay fixed. New rows are added to the end of each tab. Nothing is imported until you confirm.</p>
    {access==='read'&&<p className="ex-note amber">This is a read-only job: mappings are reviewed but nothing is imported. Go back and choose Read-write (Extract + authorize) to import the ready tables.</p>}
    {error&&<p role="alert" className="bulk-error">{error}</p>}
    {busy&&<p role="status">Importing rows...</p>}
   </>}
  </div>
  <div className="bulk-footer">
   {step==='source'&&<>
    <span>{uppyCount?`${uppyCount} file${uppyCount===1?'':'s'} ready`:'Pick files, a folder or a zip to continue'}</span>
    <button onClick={onClose}>Cancel</button>
    <button className="primary" disabled={!uppyCount} onClick={()=>void continueFromSource()}>Continue</button>
   </>}
   {step==='permission'&&<>
    <span>{selected.length} of {files.filter(p=>p.kind==='table').length} tabular file{files.filter(p=>p.kind==='table').length===1?'':'s'} selected</span>
    <button onClick={()=>setStep('source')}>Back</button>
    <button className="primary" disabled={!selected.length} onClick={()=>void runFind()}>{access==='read'?'Allow read-only':'Allow read-write'} & fetch files</button>
   </>}
   {step==='find'&&<>
    <span>{access==='read'?'Read-only':'Read-write'}. This extraction job only.</span>
    <button onClick={()=>{stopRef.current=true;setStep('source');}}>Stop extraction</button>
   </>}
   {step==='review'&&<>
    <span>{access==='read'?'Read-only job - nothing is imported':'Nothing is imported until you confirm'}</span>
    <button disabled={busy} onClick={onClose}>Stop extraction</button>
    <button disabled={busy} onClick={()=>setStep('permission')}>Back</button>
    <button className="primary" disabled={busy||!readyCount||access==='read'} title={access==='read'?'Read-only job: switch to Read-write on the permission step to import':undefined} onClick={()=>void confirmImport()}>Import {readyCount||''} ready table{readyCount===1?'':'s'}</button>
   </>}
  </div>
 </dialog>
 {onyxOpen&&<OnyxSettings config={onyxCfg} onClose={()=>setOnyxOpen(false)} onSaved={(config,connected)=>{setOnyxCfg(config);setOnyxConnected(connected);setOnyxOpen(false);}}/>}
 </>;
}
