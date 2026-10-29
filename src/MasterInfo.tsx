import {useState,useRef} from 'react';
import workbook from './workbook.json';
import {readmeForMaster} from './masterUi';
export function MasterInfo({name,summary}:{name:string;summary:string}){
 const[open,setOpen]=useState(false);const closeTimer=useRef<ReturnType<typeof setTimeout>>();function show(){clearTimeout(closeTimer.current);setOpen(true)}function hide(){closeTimer.current=setTimeout(()=>setOpen(false),180)}const sheet=workbook.sheets.find(s=>s.name===name);
 return <span className="master-info" onMouseEnter={show} onMouseLeave={hide} onFocus={()=>setOpen(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);e.stopPropagation()}}}>
 <button className="info" aria-label={`Information about ${name}`} aria-expanded={open} onClick={e=>{e.stopPropagation();setOpen(!open)}}>i</button>
 {open&&<span className="master-info-panel" role="region" aria-label={`${name} information`} tabIndex={0}>
 <strong>{name}</strong><span>{summary}</span>
 {readmeForMaster(name,workbook.readme).map((r,i)=><span key={i}><b>{r[0]}: {r[1]}</b><span>{r[2]}</span></span>)}
 {sheet&&<span className="field-guide"><b>Field guide</b>{sheet.headers.map((h,i)=><span key={h} className="field-row"><b>{h}</b><span>{sheet.descriptions[i]||'Source workbook field.'}</span></span>)}</span>}
 </span>}
 </span>;
}
