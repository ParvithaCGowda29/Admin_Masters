import {useState} from 'react';
import {readImportFile} from './bulkImport';
import {loadRows,saveRows} from './provider';
import {newId} from './id';
import workbook from './workbook.json';

type Found={name:string;kind:'agent'|'assistant';type:string;description:string;checked:boolean};
type Props={onClose:()=>void;onImported:(added:number,kinds:('agent'|'assistant')[])=>void};

// Import agents and assistants (approved 2026-11-11 wireframes): drop a file, review the
// agents and assistants found in it, tick the ones to bring in and confirm. Nothing is
// added until "Import N selected" is clicked; imported rows get the next AG-/AS- IDs.
const norm=(v:string)=>v.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const KIND_WORDS=new Set(['agent','assistant']);

function columns(header:string[]){
 let name=-1,kind=-1,type=-1,desc=-1,id=-1;
 header.forEach((h,i)=>{
  const k=norm(h);
  if(name<0&&(k==='name'||k==='agentname'||k.endsWith('name')))name=i;
  if(k==='kind')kind=i;
  if(k==='type'||k==='agenttype')type=i;
  if(id<0&&(k==='id'||k==='agentid'))id=i;
  if(desc<0&&/purpose|description|what|summary|does/.test(k))desc=i;
 });
 return{name,kind,type,desc,id};
}
function findHeader(rows:string[][]){
 for(let i=0;i<Math.min(rows.length,15);i++){const c=columns(rows[i]);if(c.name>=0)return{headerRow:i,c};}
 return null;
}
function toFound(rows:string[][],headerRow:number,c:ReturnType<typeof columns>):Found[]{
 const out:Found[]=[];
 for(const row of rows.slice(headerRow+1)){
  const name=(row[c.name]||'').trim();if(!name)continue;
  const kindText=norm((c.kind>=0?row[c.kind]:c.type>=0?row[c.type]:'')||'');
  let kind:'agent'|'assistant'|''=KIND_WORDS.has(kindText)?kindText as 'agent'|'assistant':'';
  if(!kind&&c.id>=0){const idv=(row[c.id]||'').trim();if(/^as[-\d]/i.test(idv))kind='assistant';else if(/^ag[-\d]/i.test(idv))kind='agent';}
  if(!kind)kind='agent';
  const type=c.type>=0&&!KIND_WORDS.has(norm(row[c.type]||''))?(row[c.type]||'').trim():'';
  out.push({name,kind,type,description:c.desc>=0?(row[c.desc]||'').trim():'',checked:true});
 }
 return out;
}
function fromObjects(list:Record<string,unknown>[]):Found[]{
 const out:Found[]=[];
 for(const o of list){
  const get=(...keys:string[])=>{for(const k of keys){const hit=Object.keys(o).find(h=>norm(h)===k);if(hit&&o[hit]!=null)return String(o[hit])}return ''};
  const name=get('name','agentname').trim();if(!name)continue;
  const kw=norm(get('kind','type'));
  const kind:'agent'|'assistant'=kw==='assistant'?'assistant':'agent';
  out.push({name,kind,type:KIND_WORDS.has(kw)?'':get('type'),description:get('purpose','description','whatitdoes','summary'),checked:true});
 }
 return out;
}

export function ImportAgents({onClose,onImported}:Props){
 const[found,setFound]=useState<Found[]|null>(null);
 const[fileName,setFileName]=useState('');
 const[problem,setProblem]=useState('');
 const[busy,setBusy]=useState(false);
 const[over,setOver]=useState(false);
 async function parse(file:File){
  setProblem('');setFound(null);setFileName(file.name);
  try{
   if(/\.json$/i.test(file.name)){
    const data=JSON.parse(await file.text());
    const list=Array.isArray(data)?data:Array.isArray(data?.agents)?data.agents:Array.isArray(data?.items)?data.items:null;
    if(!list)throw Error('The JSON should be a list of agents, or an object with an "agents" list.');
    const items=fromObjects(list);
    if(!items.length)throw Error('No agents or assistants found in that file.');
    setFound(items);return;
   }
   const sheets=await readImportFile(file);
   const items=sheets.flatMap(s=>{const h=findHeader(s.rows);return h?toFound(s.rows,h.headerRow,h.c):[];});
   if(!items.length)throw Error('No agents or assistants found in that file. It needs at least a name column.');
   setFound(items);
  }catch(err){setProblem(err instanceof Error?err.message:String(err));}
 }
 const selected=(found||[]).filter(f=>f.checked);
 async function confirm(){
  if(!found||!selected.length)return;
  setBusy(true);
  try{
   const headers=workbook.sheets.find(s=>s.name==='Agents')!.headers;
   const col=(label:string)=>headers.indexOf(label);
   const existing=loadRows('Agents');
   let agMax=0,asMax=0;
   for(const r of existing){const v=(r.values[0]||'').trim().toUpperCase();const ag=/^AG-(\d+)$/.exec(v);if(ag)agMax=Math.max(agMax,+ag[1]);const as=/^AS-(\d+)$/.exec(v);if(as)asMax=Math.max(asMax,+as[1]);}
   const rows=selected.map(f=>{
    const values=Array(headers.length).fill('');
    const id=f.kind==='assistant'?`AS-${String(++asMax).padStart(2,'0')}`:`AG-${String(++agMax).padStart(2,'0')}`;
    if(col('Agent ID')>=0)values[col('Agent ID')]=id;
    if(col('Agent Name')>=0)values[col('Agent Name')]=f.name;
    if(col('Kind')>=0)values[col('Kind')]=f.kind==='assistant'?'Assistant':'Agent';
    if(col('Type')>=0)values[col('Type')]=f.type;
    if(col('Source')>=0)values[col('Source')]=`Imported · ${fileName}`;
    return{id:newId(),values};
   });
   saveRows('Agents',[...existing,...rows]);
   onImported(rows.length,selected.map(f=>f.kind));
  }finally{setBusy(false);}
 }
 return <dialog ref={el=>{if(el&&!el.open)el.showModal()}} className="bulk-dialog import-agents-dialog" aria-labelledby="ia-title" onCancel={e=>{e.preventDefault();if(!busy)onClose()}}>
  <div className="bulk-heading"><div><h2 id="ia-title">Import agents and assistants</h2><p>Bring in agents that are already built.</p></div><button aria-label="Close import" onClick={onClose} disabled={busy}>×</button></div>
  <div className="bulk-body">
   <label className={'ia-drop'+(over?' over':'')} onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);const f=e.dataTransfer.files?.[0];if(f)void parse(f)}}>
    <input type="file" accept=".xlsx,.csv,.json" aria-label="Choose an agents file" onChange={e=>{const f=e.target.files?.[0];if(f)void parse(f);e.target.value=''}}/>
    Drop a file here, or choose one
   </label>
   {problem&&<div className="bulk-error">{problem}</div>}
   {found&&<><div className="ia-found-label">Found in the file</div><div className="ia-list">
    {found.map((f,i)=><label className="ia-item" key={i}><input type="checkbox" checked={f.checked} onChange={e=>setFound(found.map((x,j)=>j===i?{...x,checked:e.target.checked}:x))}/><span className="ia-item-name">{f.name}</span><span className="ia-item-desc">{f.description}</span><span className={'agent-kind '+(f.kind==='assistant'?'assistant':'agent')}>{f.kind==='assistant'?'Assistant':'Agent'}</span></label>)}
   </div></>}
  </div>
  <div className="bulk-footer"><span>{found?`${selected.length} of ${found.length} selected`:''}</span><button onClick={onClose} disabled={busy}>Cancel</button><button className="primary" disabled={!selected.length||busy} onClick={()=>void confirm()}>Import {selected.length} selected</button></div>
 </dialog>;
}
