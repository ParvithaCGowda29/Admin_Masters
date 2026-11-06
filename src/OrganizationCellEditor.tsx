import {useEffect,useRef} from 'react';
import type {CustomCellEditorProps} from 'ag-grid-react';
import type {RecordRow} from './provider';

export function OrganizationCellEditor(p:CustomCellEditorProps<RecordRow,string>){
 const input=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{input.current?.focus();input.current?.select()},[]);
 const cancel=()=>p.api.stopEditing(true);
 return <div className="org-cell-editor" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();cancel()}if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();p.stopEditing()}}}>
  <textarea ref={input} aria-label={`Edit ${p.column.getColDef().headerName}`} value={p.value||''} onChange={e=>p.onValueChange(e.target.value)}/>
  <div><button type="button" onClick={cancel}>Cancel</button><button type="button" className="primary" onClick={()=>p.stopEditing()}>Save</button></div>
 </div>;
}
