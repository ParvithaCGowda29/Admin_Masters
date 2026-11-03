import type {ReactNode} from 'react';
import type {ICellRendererParams} from 'ag-grid-community';
import type {RecordRow} from './provider';
export type Hits=Map<string,Map<string,readonly (readonly [number,number])[]>>;
// Split a cell on top-level commas, semicolons and colons followed by a space (so URLs,
// times and IDs like ORG:01 stay whole; a label keeps its colon). Delimiters inside (), [] or {} stay put, so grouped
// names like "Policies (IT, HR, RBAC)" remain one item. Offsets refer to the original
// text so search highlighting still lines up.
export function splitTopLevel(text:string):{value:string;start:number}[]{
 const parts:{value:string;start:number}[]=[];let depth=0,start=0;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='('||c==='['||c==='{')depth++;
  else if(c===')'||c===']'||c==='}')depth=Math.max(0,depth-1);
  else if(!depth&&c===','&&!(/\d/.test(text[i-1]??'')&&/\d/.test(text[i+1]??''))){parts.push({value:text.slice(start,i),start});start=i+1;}
  else if(!depth&&c===';'){parts.push({value:text.slice(start,i),start});start=i+1;}
  else if(!depth&&c===':'&&(i+1>=text.length||/\s/.test(text[i+1]))){parts.push({value:text.slice(start,i+1),start});start=i+1;}
 }
 parts.push({value:text.slice(start),start});
 return parts;
}
// Display-only: comma, semicolon and colon separated items stack one per line inside the same cell and parent
// row. The stored value, ID and record count never change. Search matches still highlight.
// Display-only: each stacked item starts with a capital letter. Only an ASCII lowercase
// first letter changes, so acronyms (ICP) keep their case, lengths and highlight offsets
// stay stable, and the stored value is untouched. Links stay as typed (case-sensitive).
export function capitalizeItem(text:string):string{
 if(/^(?:[a-z][a-z0-9+.-]*:\/\/|www\.)/i.test(text))return text;
 const c=text.charCodeAt(0);
 return c>=97&&c<=122?String.fromCharCode(c-32)+text.slice(1):text;
}
export function StackedHighlight(p:ICellRendererParams<RecordRow,string>&{hlKey:string}){
 const text=p.value??'';const ranges=(p.context.current as Hits).get(p.data?.id??'')?.get(p.hlKey);
 const mark=(seg:string,offset:number,key:number):ReactNode=>{
  if(!ranges?.length)return seg;
  const out:ReactNode[]=[];let at=0;
  for(const [s,e] of [...ranges].sort((a,b)=>a[0]-b[0])){
   const from=Math.max(s-offset,0,at),to=Math.min(e-offset,seg.length-1);
   if(to<at||s-offset>seg.length-1||e-offset<0)continue;
   out.push(seg.slice(at,from),<mark className="hit" key={from}>{seg.slice(from,to+1)}</mark>);
   at=to+1;
  }
  out.push(seg.slice(at));
  return <span key={key}>{out}</span>;
 };
 // Each URL inside a displayed line becomes a real link with a small link icon beside it,
 // so the indicator sits next to the actual links in their cells instead of a page-level
 // badge. Trailing sentence punctuation stays out of the href. Offsets stay absolute so
 // search highlighting still lines up.
 const line=(seg:string,offset:number):ReactNode=>{
  const re=/(https?:\/\/|www\.)[^\s]*/gi;const out:ReactNode[]=[];let at=0,key=0,m:RegExpExecArray|null;
  while((m=re.exec(seg))){
   let url=m[0],trail='';
   while(url&&/[.,;:!?)\]}'"]/.test(url.slice(-1))){trail=url.slice(-1)+trail;url=url.slice(0,-1);}
   if(!url){url=m[0];trail='';}
   if(m.index>at)out.push(<span key={key++}>{mark(seg.slice(at,m.index),offset+at,0)}</span>);
   const href=/^www\./i.test(url)?`https://${url}`:url;
   out.push(<a key={key++} className="cell-link" href={href} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>{mark(url,offset+m.index,0)}<svg className="cell-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></a>);
   at=m.index+m[0].length;
   if(trail)out.push(<span key={key++}>{mark(trail,offset+m.index+url.length,0)}</span>);
  }
  if(at<seg.length)out.push(<span key={key++}>{mark(seg.slice(at),offset+at,0)}</span>);
  return out.length===1?out[0]:<>{out}</>;
 };
 const parts=splitTopLevel(text).map(part=>({...part,trimmed:part.value.trim()})).filter(part=>part.trimmed);
 if(parts.length<2){const only=parts[0];return only?line(only.trimmed,only.start+(only.value.length-only.value.trimStart().length)):'';}
 return <span className="stacked">{parts.map((part,i)=>{const lead=part.value.length-part.value.trimStart().length;return <span className="stacked-item" key={i}>{line(capitalizeItem(part.trimmed),part.start+lead)}</span>;})}</span>;
}

// Link-only cells (Organization > Data Sources and Customers / Audience): the cell stores
// just a link per line, optionally behind a "Label:" line, and shows only the link text.
// A cell with no link falls back to the normal stacked display.
const LINK_RE=/^(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S+$/i;
export function LinkOnlyCell(p:ICellRendererParams<RecordRow,string>&{hlKey:string}){
 const text=p.value??'';
 const parts=splitTopLevel(text).map(x=>x.value.trim()).filter(Boolean);
 if(!parts.some(x=>LINK_RE.test(x)))return StackedHighlight(p);
 const items:string[]=[];
 for(let i=0;i<parts.length;i++){
  const part=parts[i];
  if(LINK_RE.test(part))items.push(part);
  else if(part.endsWith(':')&&LINK_RE.test(parts[i+1]||'')){items.push(parts[i+1]);i++;}
  else items.push(capitalizeItem(part));
 }
 return <span className="stacked">{items.map((item,i)=><span className="stacked-item" key={i}>{item}</span>)}</span>;
}

// Agents master (2026-11-03 approved wireframes): three agent types, a reference link for
// proposed agents, an Imported tag that shows on row hover only, and every step as a skill.
export function AgentTypeCell(p:ICellRendererParams<RecordRow,string>){
 const v=(p.value??'').trim();if(!v)return '';
 const key=/^internal$/i.test(v)?'internal':/^third/i.test(v)?'third':/^proposed$/i.test(v)?'proposed':'';
 return <span className={'agent-type'+(key?' '+key:'')}>{v}</span>;
}
// "Enhances: AG-02 · Costing Agent" - the verb stays quiet, the target reads as a link. Empty shows a dash.
export function AgentRefCell(p:ICellRendererParams<RecordRow,string>){
 const v=(p.value??'').trim();
 if(!v)return <span className="agent-ref-empty">—</span>;
 const m=/^(Enhances|Integrates)\s*:\s*(.+)$/i.exec(v);
 if(!m)return <span>{v}</span>;
 return <span className="agent-ref"><span className="agent-ref-verb">{m[1]}:</span> <span className="agent-ref-target">{m[2]}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{marginLeft:3,verticalAlign:'-1px'}}><path d="M7 17L17 7M9 7h8v8"/></svg></span></span>;
}
// "Built in BuLLM" stays plain. "Imported · <path>" carries the Imported tag, visible only on row hover.
export function AgentSourceCell(p:ICellRendererParams<RecordRow,string>){
 const v=(p.value??'').trim();if(!v)return '';
 const m=/^Imported\s*·\s*(.+)$/i.exec(v);
 if(!m)return <span className="agent-source-plain">{v}</span>;
 return <span className="agent-source"><span className="imported-tag"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg> Imported</span><span className="agent-source-path">{m[1]}</span></span>;
}
// Steps (skills): each step is a skill - one chip style for all, no separate knowledge step type.
export function SkillChipsCell(p:ICellRendererParams<RecordRow,string>){
 const v=(p.value??'').trim();if(!v)return '';
 const skills=v.split(';').map(s=>s.trim()).filter(Boolean);
 return <span className="skill-chips">{skills.map((skill,i)=><span className="skill-chip" key={i}>{skill}</span>)}</span>;
}
