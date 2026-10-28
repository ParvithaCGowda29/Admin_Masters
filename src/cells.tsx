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
 const parts=splitTopLevel(text).map(part=>({...part,trimmed:part.value.trim()})).filter(part=>part.trimmed);
 if(parts.length<2){const only=parts[0];return only?mark(only.trimmed,only.start+(only.value.length-only.value.trimStart().length),0):'';}
 return <span className="stacked">{parts.map((part,i)=>{const lead=part.value.length-part.value.trimStart().length;return <span className="stacked-item" key={i}>{mark(capitalizeItem(part.trimmed),part.start+lead,i)}</span>;})}</span>;
}
