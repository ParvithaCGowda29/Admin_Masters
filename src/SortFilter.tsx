import {useEffect,useState} from 'react';
import {useGridFilter,type CustomFilterProps} from 'ag-grid-react';
type Model={type:string;text:string}|null;
const TYPES:[string,string][]=[['contains','Contains'],['notContains','Does not contain'],['equals','Equals'],['notEqual','Does not equal'],['startsWith','Begins with'],['endsWith','Ends with'],['blank','Blank'],['notBlank','Not blank']];
function passes(type:string,text:string,raw:unknown){
 const value=String(raw??'').toLowerCase(),needle=text.toLowerCase();
 if(type==='blank')return value.trim()==='';
 if(type==='notBlank')return value.trim()!=='';
 if(!needle)return true;
 switch(type){case 'equals':return value===needle;case 'notEqual':return value!==needle;case 'startsWith':return value.startsWith(needle);case 'endsWith':return value.endsWith(needle);case 'notContains':return !value.includes(needle);default:return value.includes(needle)}
}
// Column filter popup: match type + text box (as before) plus Sort A-Z / Sort Z-A.
// Clicking the column name no longer sorts; sorting lives here.
export function SortFilter({model,onModelChange,getValue,api,column}:CustomFilterProps<any,any,Model>){
 const [type,setType]=useState(model?.type||'contains'),[text,setText]=useState(model?.text||'');
 const [sort,setSort]=useState<string|null|undefined>(column.getSort());
 useEffect(()=>{setType(model?.type||'contains');setText(model?.text||'')},[model]);
 useEffect(()=>{const sync=()=>setSort(column.getSort());api.addEventListener('sortChanged',sync);return()=>api.removeEventListener('sortChanged',sync)},[api,column]);
 useGridFilter({doesFilterPass:({node})=>!model||passes(model.type,model.text,getValue(node)),});
 const apply=(t:string,x:string)=>{const none=!x&&t!=='blank'&&t!=='notBlank';onModelChange(none?null:{type:t,text:x})};
 const setSorting=(dir:'asc'|'desc')=>{api.applyColumnState({state:[{colId:column.getColId(),sort:sort===dir?null:dir}],defaultState:{sort:null}})};
 const noText=type==='blank'||type==='notBlank';
 return <div className="sort-filter" onClick={e=>e.stopPropagation()}>
  <div className="sf-sort" role="group" aria-label="Sort"><button type="button" className={sort==='asc'?'on':''} aria-pressed={sort==='asc'} onClick={()=>setSorting('asc')}>Sort A-Z</button><button type="button" className={sort==='desc'?'on':''} aria-pressed={sort==='desc'} onClick={()=>setSorting('desc')}>Sort Z-A</button></div>
  <select aria-label="Match type" value={type} onChange={e=>{setType(e.target.value);apply(e.target.value,text)}}>{TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
  {!noText&&<input type="text" placeholder="Filter..." aria-label="Filter" value={text} onChange={e=>{setText(e.target.value);apply(type,e.target.value)}} autoFocus/>}
 </div>;
}
