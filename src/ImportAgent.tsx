import {useEffect,useState} from 'react';
// Import mode (approved 2026-11-03): an existing internal or third-party agent is brought in
// from its path instead of being built from scratch. Proposed agents are designed in BuLLM
// and can't be imported. Browser-only: "Fetch details" derives the name from the path.
const SOURCES=['GitHub','Company path','MCP server','API endpoint'];
export type ImportedAgent={name:string;type:'Internal'|'Third-party';source:string;path:string;version:string};
export function ImportAgent({onClose,onImport}:{onClose:()=>void;onImport:(agent:ImportedAgent)=>void}){
 const[type,setType]=useState<'Internal'|'Third-party'>('Third-party');
 const[source,setSource]=useState(SOURCES[0]);
 const[path,setPath]=useState('');
 const[fetched,setFetched]=useState('');
 const[version,setVersion]=useState('v1.0');
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[onClose]);
 function fetchDetails(){
  const tail=path.trim().replace(/\/+$/,'').split('/').pop()||'';
  const name=tail.replace(/\.[a-z0-9]+$/i,'').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  setFetched(name||'Imported agent');
 }
 function submit(){if(!fetched)return;onImport({name:fetched,type,source,path:path.trim(),version:version.trim()||'v1.0'})}
 const card=(value:'Internal'|'Third-party',title:string,desc:string)=>
  <button type="button" className={'import-card'+(type===value?' selected':'')} aria-pressed={type===value} onClick={()=>setType(value)}>
   <span className="import-card-title"><span className="import-radio" aria-hidden="true"/>{title}</span>
   <span className="import-card-desc">{desc}</span>
  </button>;
 return <div className="import-overlay" role="presentation" onClick={onClose}>
  <div className="import-dialog" role="dialog" aria-label="Import agent" onClick={e=>e.stopPropagation()}>
   <h2><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg> Import agent</h2>
   <p className="import-sub">Bring an existing internal or third-party agent in from its path, instead of building it from scratch.</p>
   <div className="import-label">AGENT TYPE</div>
   <div className="import-cards">
    {card('Internal','Internal agent','Already running in the company. Imported rows stay linked to their path.')}
    {card('Third-party','Third-party / external agent','Hosted outside the company (GitHub, MCP server, API).')}
   </div>
   <div className="import-label">SOURCE PATH</div>
   <div className="import-path-row">
    <select aria-label="Source" value={source} onChange={e=>setSource(e.target.value)}>{SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select>
    <input aria-label="Repository or path" placeholder="github.com/digibull-ai/supplier-lookup-agent" value={path} onChange={e=>{setPath(e.target.value);setFetched('')}} onKeyDown={e=>{if(e.key==='Enter'&&path.trim())fetchDetails()}}/>
    <button type="button" onClick={fetchDetails} disabled={!path.trim()}>Fetch details</button>
   </div>
   {fetched&&<div className="import-preview">
    <div className="import-preview-head"><strong>{fetched}</strong><span className="import-found"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Found</span></div>
    <div className="import-preview-fields">
     <label>Version<input value={version} onChange={e=>setVersion(e.target.value)}/></label>
    </div>
   </div>}
   <p className="import-note">Proposed agents are designed in BuLLM and can't be imported.</p>
   <div className="import-actions">
    <button type="button" onClick={onClose}>Cancel</button>
    <button type="button" className="primary" disabled={!fetched} onClick={submit}>Import agent</button>
   </div>
  </div>
 </div>;
}
