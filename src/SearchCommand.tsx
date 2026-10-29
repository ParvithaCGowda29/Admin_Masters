import {useEffect,useMemo,useRef,useState} from 'react';
import {Command} from 'cmdk';
import type {RecordRow} from './provider';
import {IconSearch} from './icons';

type SheetMeta={name:string;headers:string[]};

type Props={active:string;sheet:SheetMeta;rows:RecordRow[];query:string;onQuery:(q:string)=>void};

const matchesRow=(row:RecordRow,words:string[])=>words.every(w=>row.values.some(v=>v.toLowerCase().includes(w)));

// cmdk search panel anchored to the toolbar search field: chips, browse-by-field and grouped
// matches drive the existing table filter; the grid stays visible behind the panel.
export function SearchCommand({active,sheet,rows,query,onQuery}:Props){
 const[open,setOpen]=useState(false);
 const[field,setField]=useState<number|null>(null);
 const wrap=useRef<HTMLDivElement>(null);
 useEffect(()=>{const onDoc=(e:MouseEvent)=>{if(wrap.current&&!wrap.current.contains(e.target as Node)){setOpen(false);setField(null)}};document.addEventListener('mousedown',onDoc);return()=>document.removeEventListener('mousedown',onDoc)},[]);
 useEffect(()=>{setField(null);setOpen(false)},[active]);
 const headers=sheet.headers;
 const displayIdx=headers.length>1?1:0;
 // Categorical columns (2..12 distinct values) power the chips and browse-by-field groups.
 const categorical=useMemo(()=>{
  const out:{i:number;label:string;values:string[]}[]=[];
  for(let i=1;i<headers.length;i++){
   const seen=new Map<string,number>();
   for(const r of rows){const v=(r.values[i]||'').trim();if(v)seen.set(v,(seen.get(v)||0)+1)}
   if(seen.size>=2&&seen.size<=12)out.push({i,label:headers[i],values:[...seen.entries()].sort((a,b)=>b[1]-a[1]).map(([v])=>v)});
  }
  return out.slice(0,4);
 },[rows,headers]);
 const suggestions=useMemo(()=>{
  const vals:string[]=[];
  for(const c of categorical)for(const v of c.values){if(!vals.includes(v))vals.push(v);if(vals.length>=4)return vals}
  // Tabs without a few-valued column (Skills, Filetype): fall back to real cell values, name column first, short values first.
  const order=[displayIdx,...headers.map((_,i)=>i).filter(i=>i!==displayIdx)];
  for(const maxLen of [60,Infinity])for(const i of order)for(const r of rows){const v=(r.values[i]||'').trim();if(v&&v.length<=maxLen&&!vals.includes(v)){vals.push(v);if(vals.length>=4)return vals}}
  return vals;
 },[categorical,rows,headers,displayIdx]);
 const history=useMemo(()=>{if(!open)return[];try{return (JSON.parse(localStorage.getItem('bullm-search-history-v1')||'{}')[active]||[]) as string[]}catch{return[]}},[active,open]);
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const matches=useMemo(()=>words.length?rows.filter(r=>matchesRow(r,words)).slice(0,8):[],[rows,query,words.length]);
 const pick=(value:string)=>{onQuery(value);setOpen(false);setField(null)};
 return <div className="search-cmd" ref={wrap}>
  <Command shouldFilter={false} label={`Search ${active}`}>
   <div className="search-input-row">
    <span className="search-icon" aria-hidden="true"><IconSearch size={15}/></span>
    <Command.Input value={query} onValueChange={v=>{onQuery(v);setOpen(true)}} onFocus={()=>setOpen(true)} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);setField(null)}}} placeholder={`Search ${active}...`} aria-label={`Search ${active}`}/>
    {query&&<button type="button" className="search-clear" aria-label="Clear search" onMouseDown={e=>e.preventDefault()} onClick={()=>onQuery('')}>×</button>}
   </div>
   {open&&<Command.List className="search-panel">
    {words.length===0?<>
     {history.length>0&&<Command.Group heading="Recent searches">{history.slice(0,4).map(h=><Command.Item key={`h-${h}`} value={`h:${h}`} onSelect={()=>pick(h)}><span className="search-item-title">{h}</span></Command.Item>)}</Command.Group>}
     {suggestions.length>0&&<Command.Group heading="Suggested searches"><div className="search-chips">{suggestions.map(s=><button type="button" key={s} className="search-chip" title={s} onMouseDown={e=>e.preventDefault()} onClick={()=>pick(s)}>{s}</button>)}</div></Command.Group>}
     {categorical.length>0&&<Command.Group heading="Browse by field">{field===null
      ?categorical.map(c=><Command.Item key={c.label} value={`f:${c.label}`} onSelect={()=>setField(c.i)}><span className="search-item-title">{c.label}</span><span className="search-item-hint" aria-hidden>→</span></Command.Item>)
      :categorical.filter(c=>c.i===field).map(c=><div key={c.label}>{c.values.slice(0,8).map(v=><Command.Item key={v} value={`fv:${v}`} onSelect={()=>pick(v)}><span className="search-item-title">{v}</span><small>{c.label}</small></Command.Item>)}</div>)}</Command.Group>}
     {history.length===0&&suggestions.length===0&&categorical.length===0&&<div className="search-empty">Type to search {active}</div>}
    </>:<>
     {matches.length>0
      ?<Command.Group heading={`${active} · ${matches.length} match${matches.length===1?'':'es'}`}>{matches.map(r=>{const title=(r.values[displayIdx]||r.values[0]||r.id).trim();const meta=[r.values[0],...r.values.slice(displayIdx+1,displayIdx+3)].filter(v=>v&&v.trim()).join(' · ');return <Command.Item key={r.id} value={r.id} onSelect={()=>pick(title)}><span className="search-avatar" aria-hidden>{(title[0]||'?').toUpperCase()}</span><span className="search-item-main"><span className="search-item-title">{title}</span><small>{meta}</small></span><span className="search-item-hint" aria-hidden>↵</span></Command.Item>})}</Command.Group>
      :<div className="search-empty">No matching rows</div>}
     {matches.length>0&&<div className="search-note">Enter or click a result to reveal its table row</div>}
    </>}
    <div className="search-footer">↑ ↓ Navigate · Enter Select · Esc Close</div>
   </Command.List>}
  </Command>
 </div>
}
