import {useEffect,useRef,useState} from 'react';
import {loadHeaders,loadList,saveList,type ListRow} from './templateLists';
import type {MastersTemplate} from './templates';

type Props={template:MastersTemplate;onClose:()=>void;onChanged:()=>void};
// View and edit the rows of one template list, under its current column names (an
// upload can replace them). Kept on this device only, separate from the master tabs.
export function TemplateListView({template,onClose,onChanged}:Props){
 const [headers]=useState<string[]>(()=>loadHeaders(template.key,template));
 const [rows,setRows]=useState<ListRow[]>(()=>loadList(template.key,template));
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>{element?.close();};},[]);
 function persist(next:ListRow[]){setRows(next);saveList(template.key,next,headers);onChanged();}
 const setCell=(id:string,index:number,value:string)=>persist(rows.map(r=>r.id===id?{...r,values:r.values.map((v,j)=>j===index?value:v)}:r));
 const removeRow=(id:string)=>persist(rows.filter(r=>r.id!==id));
 const addRow=()=>persist([...rows,{id:crypto.randomUUID(),values:headers.map(()=>'')}]);
 return <dialog ref={dialog} className="bulk-dialog" aria-labelledby="template-list-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <div className="bulk-heading"><div><h2 id="template-list-title">{template.label}</h2><p>{rows.length} row{rows.length===1?'':'s'} in your uploaded {template.label} template. Edit any cell; changes save straight away on this device. The masters stay unchanged.</p></div><button aria-label="Close list" onClick={onClose}>×</button></div>
  <div className="bulk-body">
   <table className="mapping-table list-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}<th aria-label="Row actions"/></tr></thead><tbody>
    {rows.map(row=><tr key={row.id}>{row.values.map((value,i)=><td key={i}><input aria-label={`${headers[i]} (row ${rows.indexOf(row)+1})`} value={value} onChange={e=>setCell(row.id,i,e.target.value)}/></td>)}<td><button className="danger" aria-label={`Delete row ${rows.indexOf(row)+1}`} onClick={()=>removeRow(row.id)}>Delete</button></td></tr>)}
    {!rows.length&&<tr><td colSpan={headers.length+1}><p className="bulk-hint">No rows yet. Upload your own filled template, or add a row by hand.</p></td></tr>}
   </tbody></table>
  </div>
  <div className="bulk-footer"><span>Saved on this device only</span><button onClick={addRow}>＋ Add row</button><button className="primary" onClick={onClose}>Done</button></div>
 </dialog>;
}
