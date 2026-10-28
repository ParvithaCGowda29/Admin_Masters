import type {ReactNode} from 'react';
import type {ICellRendererParams} from 'ag-grid-community';
import type {RecordRow} from './provider';
export type Hits=Map<string,Map<string,readonly (readonly [number,number])[]>>;
// Split a cell on top-level commas only. Commas inside (), [] or {} stay put, so grouped
// names like "Policies (IT, HR, RBAC)" remain one item. Offsets refer to the original
// text so search highlighting still lines up.
export function splitTopLevel(text:string):{value:string;start:number}[]{
 const parts:{value:string;start:number}[]=[];let depth=0,start=0;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='('||c==='['||c==='{')depth++;
  else if(c===')'||c===']'||c==='}')depth=Math.max(0,depth-1);
  else if(c===','&&!depth){parts.push({value:text.slice(start,i),start});start=i+1;}
 }
 parts.push({value:text.slice(start),start});
 return parts;
}
// Display-only: comma-separated items stack one per line inside the same cell and parent
// row. The stored value, ID and record count never change. Search matches still highlight.
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
 return <span className="stacked">{parts.map((part,i)=>{const lead=part.value.length-part.value.trimStart().length;return <span className="stacked-item" key={i}>{mark(part.trimmed,part.start+lead,i)}</span>;})}</span>;
}
