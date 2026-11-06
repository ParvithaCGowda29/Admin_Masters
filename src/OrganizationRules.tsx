import {useEffect,useMemo,useState} from 'react';
import {loadRows,saveRows,type RecordRow} from './provider';
import {newId} from './id';
import {belongsToOrg,nextRuleId,promptCount,ruleExtra,saveRuleExtra,skillRefs,type RuleExtra} from './organizationRules';

type Props={organization:RecordRow;onBack:()=>void;onChanged:()=>void;onSkill:(id:string)=>void};
export function OrganizationRules({organization,onBack,onChanged,onSkill}:Props){
 const orgId=organization.values[0],orgName=organization.values[1]||orgId;
 const[rows,setRows]=useState(()=>loadRows('Rules'));const[query,setQuery]=useState('');
 const[draft,setDraft]=useState<RecordRow|null>(null);const[editing,setEditing]=useState<{row:RecordRow;tab:'rule'|'prompts';extra:RuleExtra}|null>(null);
 const[inline,setInline]=useState<{id:string;column:number;value:string}|null>(null);const[notice,setNotice]=useState('');
 const skills=useMemo(()=>loadRows('Skills'),[]);
 const save=(next:RecordRow[])=>{saveRows('Rules',next);setRows(next);onChanged();setNotice('Saved in this browser. The rule ID and existing links are unchanged.')};
 const updateRow=(row:RecordRow)=>{const current=loadRows('Rules');save(current.some(r=>r.id===row.id)?current.map(r=>r.id===row.id?row:r):[row,...current])};
 const scoped=rows.filter(r=>belongsToOrg(r,orgId));const visible=scoped.filter(r=>r.values.join(' ').toLowerCase().includes(query.toLowerCase()));
 const open=(row:RecordRow,tab:'rule'|'prompts')=>{setEditing({row:structuredClone(row),tab,extra:structuredClone(ruleExtra(row.id))});setInline(null)};
 const saveEditor=()=>{if(!editing)return;if(!editing.row.values[1].trim()){setNotice('Enter rule text before saving.');return}saveRuleExtra(editing.row.id,editing.extra);updateRow(editing.row);setEditing(null)};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setEditing(null);setDraft(null);setInline(null)}if(e.key==='Enter'&&e.ctrlKey&&editing){e.preventDefault();saveEditor()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[editing]);
 const setRuleField=(i:number,v:string)=>setEditing(e=>{if(!e)return e;const row=structuredClone(e.row);row.values[i]=v;return {...e,row}});
 const skillName=(id:string)=>skills.find(s=>s.values[0]===id)?.values[1]||id;
 const openSkill=(id:string)=>{if(skills.some(s=>s.values[0]===id))onSkill(id);else setNotice(`Skill ${id} is referenced by this rule but is not present in the current Skills master. Its link is preserved.`)};
 const renderSkills=(r:RecordRow)=>skillRefs(r.values[8]||'').map(id=><button type="button" className="org-skill-chip" key={id} title={id} onClick={()=>openSkill(id)}>{skillName(id)}</button>);
 const cell=(r:RecordRow,i:number)=>inline?.id===r.id&&inline.column===i?<div className="org-rule-inline" onKeyDown={e=>{if(e.key==='Escape')setInline(null);if(e.key==='Enter'&&e.ctrlKey){const row=structuredClone(r);row.values[i]=inline.value;updateRow(row);setInline(null)}}}><textarea autoFocus aria-label={`Edit ${i===1?'rule text':'status'}`} value={inline.value} onChange={e=>setInline({...inline,value:e.target.value})}/><div><button onClick={()=>setInline(null)}>Cancel</button><button className="primary" onClick={()=>{const row=structuredClone(r);row.values[i]=inline.value;updateRow(row);setInline(null)}}>Save</button></div></div>:<div tabIndex={0} title="Double-click to edit" onDoubleClick={()=>setInline({id:r.id,column:i,value:r.values[i]||''})} onKeyDown={e=>{if(e.key==='Enter')setInline({id:r.id,column:i,value:r.values[i]||''})}}>{r.values[i]||'Not set'}</div>;
 return <div className="org-rules-workspace">
  <button className="org-back" onClick={onBack}>‹ Organization</button><h2>{orgName} · Rules</h2>
  <p className="org-rules-note">{scoped.length} rules · Double-click text or status to edit · Ctrl+Enter to save · Esc to cancel</p>
  <p className="org-scope-note">Membership follows the existing organization references. Proposed scopes and approval status remain as recorded; these are not activated policies.</p>
  <div className="org-rules-toolbar"><input type="search" aria-label="Search organization rules" placeholder="Search rules" value={query} onChange={e=>setQuery(e.target.value)}/><button className="primary" disabled={!!draft} onClick={()=>{const values=Array(9).fill('');values[0]=nextRuleId(loadRows('Rules'));values[3]=`Org: ${orgId}`;values[6]='Draft';setDraft({id:newId(),values});setQuery('')}}>+ Add rule</button></div>
  <div className="org-rules-table-wrap"><table className="org-rules-table"><thead><tr><th>Rule ID</th><th>Rule</th><th>Skills</th><th>Prompts</th><th>Status</th></tr></thead><tbody>
   {draft&&<tr className="org-draft"><td>{draft.values[0]}<small>Assigned automatically</small></td><td><textarea autoFocus aria-label="New rule text" placeholder="Enter rule text" value={draft.values[1]} onChange={e=>{const d=structuredClone(draft);d.values[1]=e.target.value;setDraft(d)}}/></td><td><label>Link skills<select aria-label="New rule skills" multiple value={skillRefs(draft.values[8])} onChange={e=>{const d=structuredClone(draft);d.values[8]=Array.from(e.target.selectedOptions).map(o=>o.value).join('; ');setDraft(d)}}>{skills.map(s=><option key={s.id} value={s.values[0]}>{s.values[1]||s.values[0]}</option>)}</select></label></td><td>After save</td><td><span>Draft</span><div className="org-draft-actions"><button className="primary" disabled={!draft.values[1].trim()} onClick={()=>{updateRow(draft);setDraft(null)}}>Save</button><button onClick={()=>setDraft(null)}>Cancel</button></div></td></tr>}
   {visible.map(r=><tr key={r.id}><td><button className="org-rule-id" onClick={()=>open(r,'rule')}>{r.values[0]}</button></td><td>{cell(r,1)}</td><td><div className="org-chip-list">{renderSkills(r)}</div><button className="org-link-button" onClick={()=>open(r,'rule')}>Edit links</button></td><td><button className="org-prompts-count" onClick={()=>open(r,'prompts')}>{promptCount(r.id)} prompts ›</button></td><td>{cell(r,6)}</td></tr>)}
   {!visible.length&&!draft&&<tr><td colSpan={5}>No matching rules for this organization.</td></tr>}
  </tbody></table></div>
  {notice&&<div className="org-save-note" role="status">{notice}<button aria-label="Dismiss rules notice" onClick={()=>setNotice('')}>×</button></div>}
  <p className="org-rules-note">Saved in this browser only · No backend connected</p>
  {editing&&<div className="org-drawer-shade" onMouseDown={()=>setEditing(null)}><section className="org-rule-drawer" role="dialog" aria-modal="true" aria-label="Rule editor" onMouseDown={e=>e.stopPropagation()}>
   <header><div><h3>{editing.row.values[0]}</h3><small>ID locked. Editing keeps the ID and links.</small></div><button aria-label="Close rule editor" onClick={()=>setEditing(null)}>×</button></header>
   <div className="org-rule-tabs"><button className={editing.tab==='rule'?'on':''} onClick={()=>setEditing({...editing,tab:'rule'})}>Rule</button><button className={editing.tab==='prompts'?'on':''} onClick={()=>setEditing({...editing,tab:'prompts'})}>Prompts {(editing.extra.prompts.system.trim()?1:0)+editing.extra.prompts.micro.filter(p=>p.text.trim()).length}</button></div>
   <div className="org-rule-form">{editing.tab==='rule'?<>
    <label>Rule text<textarea aria-label="Rule text" value={editing.row.values[1]} onChange={e=>setRuleField(1,e.target.value)}/></label>
    <label>Applies to<input aria-label="Rule applies to" placeholder="Set applicability" value={editing.extra.appliesTo} onChange={e=>setEditing({...editing,extra:{...editing.extra,appliesTo:e.target.value}})}/></label>
    <label>Status<input list="org-rule-statuses" aria-label="Rule status" value={editing.row.values[6]} onChange={e=>setRuleField(6,e.target.value)}/><datalist id="org-rule-statuses"><option>Draft</option><option>Active</option><option>Archived</option></datalist></label>
    <label>Linked skills</label><div className="org-chip-list">{skillRefs(editing.row.values[8]).map(id=><span className="org-linked-skill" key={id}><button onClick={()=>openSkill(id)} title={id}>{skillName(id)}</button><button aria-label={`Remove skill ${id}`} onClick={()=>setRuleField(8,skillRefs(editing.row.values[8]).filter(x=>x!==id).join('; '))}>×</button></span>)}</div>
    <select aria-label="Link skill" value="" onChange={e=>{if(e.target.value)setRuleField(8,[...skillRefs(editing.row.values[8]),e.target.value].join('; '))}}><option value="">+ Link skill</option>{skills.filter(s=>!skillRefs(editing.row.values[8]).includes(s.values[0])).map(s=><option key={s.id} value={s.values[0]}>{s.values[1]||s.values[0]} ({s.values[0]})</option>)}</select>
    <details><summary>Original mapping and source (preserved)</summary><p>{editing.row.values[3]}</p><p>{editing.row.values[2]}</p></details>
   </>:<>
    <label>System prompt<textarea aria-label="System prompt" placeholder="No system prompt yet" value={editing.extra.prompts.system} onChange={e=>setEditing({...editing,extra:{...editing.extra,prompts:{...editing.extra.prompts,system:e.target.value}}})}/></label>
    <h4>Micro prompts</h4>{editing.extra.prompts.micro.map((p,i)=><div className="org-micro-prompt" key={p.id}><input aria-label={`Micro prompt ${i+1} name`} placeholder="Name" value={p.name} onChange={e=>{const extra=structuredClone(editing.extra);extra.prompts.micro[i].name=e.target.value;setEditing({...editing,extra})}}/><textarea aria-label={`Micro prompt ${i+1} text`} placeholder="Prompt text" value={p.text} onChange={e=>{const extra=structuredClone(editing.extra);extra.prompts.micro[i].text=e.target.value;setEditing({...editing,extra})}}/><button aria-label={`Remove micro prompt ${i+1}`} onClick={()=>{const extra=structuredClone(editing.extra);extra.prompts.micro.splice(i,1);setEditing({...editing,extra})}}>Remove</button></div>)}
    <button onClick={()=>{const extra=structuredClone(editing.extra);extra.prompts.micro.push({id:newId(),name:'',text:''});setEditing({...editing,extra})}}>+ Add micro prompt</button>
   </>}</div><footer><button onClick={()=>setEditing(null)}>Cancel (Esc)</button><button className="primary" onClick={saveEditor}>Save (Ctrl+Enter)</button></footer>
  </section></div>}
 </div>;
}
