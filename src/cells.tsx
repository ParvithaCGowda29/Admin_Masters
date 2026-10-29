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
