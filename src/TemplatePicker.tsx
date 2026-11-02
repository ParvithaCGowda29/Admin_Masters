import {useEffect,useRef} from 'react';
import {TEMPLATES,type MastersTemplate} from './templates';
import {loadHeaders} from './templateLists';
import {IconUpload,IconStar,IconUsers} from './icons';

type Props={onClose:()=>void;onRecommended:()=>void;onUpload:(client:boolean)=>void;onView:(template:MastersTemplate)=>void};
// Add templates modal - the finalised wireframe (2026-11-02): three cards for where a
// master list's template comes from. Each recommended list row opens that list for
// view/edit; the buttons keep the existing upload dialogs. Downloads stay on the
// Organization column headers, as the note under the cards says.
export function TemplatePicker({onClose,onRecommended,onUpload,onView}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>{element?.close();};},[]);
 return <dialog ref={dialog} className="bulk-dialog templates-dialog" aria-labelledby="templates-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <div className="bulk-heading"><div><h2 id="templates-title">Add templates</h2><p>Pick where the template for a master list comes from.</p></div><button aria-label="Close add templates" onClick={onClose}>×</button></div>
  <div className="bulk-body">
   <div className="tpl-cards">
    <section className="tpl-card recommended">
     <h3><IconStar size={16}/> Recommended templates</h3>
     <p>The built-in BuLLM templates for each master, with the workbook columns already in place.</p>
     <ul className="tpl-lists">
      {TEMPLATES.map(t=><li key={t.key}><button type="button" title={`View and edit your ${t.label} list`} onClick={()=>onView(t)}><span>{t.label}</span><small>{loadHeaders(t.key,t).length} columns</small></button></li>)}
     </ul>
     <button className="primary tpl-action" onClick={onRecommended}>Use recommended</button>
    </section>
    <section className="tpl-card">
     <h3><IconUpload size={16}/> Use your own</h3>
     <p>Upload a list you already maintain. Its columns and rows replace that template completely; the masters are untouched.</p>
     <p className="tpl-caption"><span>.xlsx or .csv</span><small>full replacement</small></p>
     <button className="tpl-action" onClick={()=>onUpload(false)}>Upload your own</button>
    </section>
    <section className="tpl-card">
     <h3><IconUsers size={16}/> Use client's template</h3>
     <p>Start from the template the client already uses, so their lists land in the masters without reformatting.</p>
     <p className="tpl-caption"><span>Client workbook</span><small>their columns kept</small></p>
     <button className="tpl-action" onClick={()=>onUpload(true)}>Upload client's</button>
    </section>
   </div>
   <p className="tpl-note">Download of any template sits next to the columns it fills - on the Organization column headers - so the filled file always matches what the master expects.</p>
  </div>
  <div className="bulk-footer"><span>Saved on this device only</span><button onClick={onClose}>Close</button></div>
 </dialog>;
}
