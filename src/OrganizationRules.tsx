import {useEffect,useMemo,useState} from 'react';
import {loadRows,saveRows,type RecordRow} from './provider';
import {newId} from './id';
import {belongsToOrg,nextRuleId,promptCount,ruleExtra,ruleType,saveRuleExtra,skillRefs,statusMeta,workflowMap,type RuleExtra} from './orgRuleData';

type Props={organization:RecordRow;onBack:()=>void;onChanged:()=>void;onSkill:(id:string)=>void};
type Editing={row:RecordRow;tab:'rule'|'prompts';extra:RuleExtra;isNew:boolean};
// Rules Engine (Variant 2 "Workflow skill map", approved 2026-11-12): a left workflow map groups
// skills by their ISATVON Next chains with per-skill rule counts; the right panel lists the rules
// that drive the picked skill as cards, expanding into FDE / client-representative usage panels.
export function OrganizationRules({organization,onBack,onChanged,onSkill}:Props){
 const orgId=organization.values[0],orgName=organization.values[1]||orgId;
 const[rows,setRows]=useState(()=>loadRows('Rules'));const[query,setQuery]=useState('');
 const[menu,setMenu]=useState<{x:number;y:number}|null>(null);const[editing,setEditing]=useState<Editing|null>(null);
 const[notice,setNotice]=useState('');
 const[selected,setSelected]=useState<string|null|undefined>(undefined); // undefined: pick default; null: all rules
 const[openCard,setOpenCard]=useState<string|null>(null);
 const[collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const skills=useMemo(()=>loadRows('Skills'),[]);
 const scoped=useMemo(()=>rows.filter(r=>belongsToOrg(r,orgId)),[rows,orgId]);
 const map=useMemo(()=>workflowMap(skills,scoped),[skills,scoped]);
 const refsOf=(r:RecordRow)=>skillRefs(r.values[8]||'');
 const matchesSkill=(r:RecordRow,skill:string)=>refsOf(r).some(ref=>skill.includes('.')?ref===skill:ref===skill||ref.startsWith(skill+'.'));
 const counts=useMemo(()=>{const c=new Map<string,number>();for(const w of map)for(const s of w.skills){c.set(s.id,scoped.filter(r=>matchesSkill(r,s.id)).length);for(const sub of s.subskills)c.set(sub.id,scoped.filter(r=>matchesSkill(r,sub.id)).length)}return c},[map,scoped]);
 const workflowCount=(w:typeof map[number])=>scoped.filter(r=>refsOf(r).some(ref=>w.skills.some(s=>ref===s.id||ref.startsWith(s.id+'.')))).length;
 const workflowOf=(skill:string)=>map.find(w=>w.skills.some(s=>s.id===skill||s.subskills.some(sub=>sub.id===skill)));
 const skillInfo=(ref:string)=>{for(const w of map)for(const s of w.skills){if(s.id===ref)return s;const sub=s.subskills.find(x=>x.id===ref);if(sub)return{id:sub.id,name:sub.name,inMaster:s.inMaster,subskills:[]}}return{id:ref,name:ref,inMaster:false,subskills:[]}};
 useEffect(()=>{if(selected!==undefined)return;const first=map.flatMap(w=>w.skills).find(s=>(counts.get(s.id)||0)>0||(s.subskills||[]).some(sub=>(counts.get(sub.id)||0)>0));setSelected(first?first.id:null)},[selected,map,counts]);
 const querying=query.trim().length>0;
 const visible=useMemo(()=>{if(querying){const q=query.trim().toLowerCase();return scoped.filter(r=>(r.values.join(' ')+' '+JSON.stringify(ruleExtra(r.id))).toLowerCase().includes(q))}return selected?scoped.filter(r=>matchesSkill(r,selected)):scoped},[querying,query,scoped,selected]);
 useEffect(()=>{setOpenCard(cur=>cur&&visible.some(r=>r.id===cur)?cur:visible[0]?.id??null)},[visible]);
 const groupsWithRules=map.filter(w=>workflowCount(w)>0).length;
 const save=(next:RecordRow[])=>{saveRows('Rules',next);setRows(next);onChanged();setNotice('Saved in this browser. The rule ID and existing links are unchanged.')};
 const updateRow=(row:RecordRow)=>{const current=loadRows('Rules');save(current.some(r=>r.id===row.id)?current.map(r=>r.id===row.id?row:r):[row,...current])};
 const open=(row:RecordRow,tab:'rule'|'prompts',isNew=false)=>setEditing({row:structuredClone(row),tab,extra:structuredClone(ruleExtra(row.id)),isNew});
 const startDraft=()=>{const values=Array(9).fill('');values[0]=nextRuleId(loadRows('Rules'));values[3]=`Org: ${orgId}`;values[6]='Draft';if(selected&&!selected.includes('.'))values[8]=selected;open({id:newId(),values},'rule',true)};
 const saveEditor=()=>{if(!editing)return;if(!editing.row.values[1].trim()){setNotice('Enter rule text before saving.');return}saveRuleExtra(editing.row.id,editing.extra);updateRow(editing.row);setEditing(null)};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setEditing(null);setMenu(null)}if(e.key==='Enter'&&e.ctrlKey&&editing){e.preventDefault();saveEditor()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[editing]);
 const setRuleField=(i:number,v:string)=>setEditing(e=>{if(!e)return e;const row=structuredClone(e.row);row.values[i]=v;return {...e,row}});
 const setExtraField=(k:'appliesTo'|'fdeUse'|'clientUse'|'actsOn',v:string)=>setEditing(e=>e?{...e,extra:{...e.extra,[k]:v}}:e);
 const skillName=(id:string)=>skills.find(s=>s.values[0]===id)?.values[1]||id;
 const openSkill=(id:string)=>{if(skills.some(s=>s.values[0]===id))onSkill(id);else setNotice(`Skill ${id} is referenced by this rule but is not present in the current Skills master. Its link is preserved.`)};
 const promptsLabel=(id:string)=>{const ex=ruleExtra(id).prompts;const micros=ex.micro.filter(p=>p.text.trim()).length;const sys=ex.system.trim()?1:0;if(sys&&micros)return `system + ${micros} micro`;const n=sys+micros;return `${n} prompt${n===1?'':'s'}`};
 const selInfo=selected?skillInfo(selected):null;
 const selWorkflow=selected?workflowOf(selected):undefined;
 const headerTitle=querying?'Search results':selected?`${selInfo!.id}${selInfo!.name!==selInfo!.id?' · '+selInfo!.name:''}`:'All rules';
 const headerSub=querying?`${visible.length} of ${scoped.length} rules match`:selected?`${visible.length} rule${visible.length===1?'':'s'} · ${selWorkflow?.name||'Other linked skills'}${selected.includes('.')?` · Subskill of ${selected.slice(0,selected.indexOf('.'))}`:''}`:`${scoped.length} rules across ${groupsWithRules} workflow${groupsWithRules===1?'':'s'}`;
 const keyFacts=(r:RecordRow)=>[r.values[5],r.values[4],r.values[7]].map(f=>f.trim()).filter(Boolean);
 return <div className="org-rules-workspace" onClick={()=>setMenu(null)}>
  <div className="org-rules-toolbar"><button className="org-back" onClick={onBack}>‹ Organisations</button><h2 className="org-rules-title">Rules Engine</h2><span className="org-org-chip" title={orgName}>{orgName} · {orgId}</span><input type="search" aria-label="Search organization rules" placeholder="Search rules" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  <p className="org-rules-note">{scoped.length} rules across {groupsWithRules} workflow{groupsWithRules===1?'':'s'} · Pick a skill to see the rules that drive it</p>
  <div className="org-rules-layout">
   <div className="org-map" role="navigation" aria-label="Workflow map">
    <h3>WORKFLOW MAP</h3>
    <div className="org-map-groups">
    {map.map(w=><div className="org-map-group" key={w.id}>
     <button type="button" className="org-map-workflow" aria-expanded={!collapsed[w.id]} onClick={()=>setCollapsed(c=>({...c,[w.id]:!c[w.id]}))}><span className="caret" aria-hidden="true">{collapsed[w.id]?'▸':'▾'}</span><span className="wf-name">{w.name}</span><span className="org-map-count">{workflowCount(w)} rules</span></button>
     {!collapsed[w.id]&&w.skills.map(s=><div key={s.id}>
      <button type="button" className={'org-map-skill'+(selected===s.id?' selected':'')} onClick={()=>setSelected(sel=>sel===s.id?null:s.id)} title={s.inMaster?`${s.id} · ${s.name}`:`${s.id} - referenced by rules, not in the Skills master`}><span className="sk-id">{s.id}</span><span className="sk-name">{s.inMaster?s.name:''}</span><span className="sk-count">{counts.get(s.id)||0}</span></button>
      {s.subskills.map(sub=><button type="button" key={sub.id} className={'org-map-skill org-map-sub'+(selected===sub.id?' selected':'')} onClick={()=>setSelected(sel=>sel===sub.id?null:sub.id)} title={sub.id}><span className="sk-name">{sub.name}</span><span className="sk-count">{counts.get(sub.id)||0}</span></button>)}
     </div>)}
    </div>)}
    </div>
    <div className="org-map-legend"><span><span className="dot dot-fde" aria-hidden="true"/>FDE - configures and tests the rule</span><span><span className="dot dot-client" aria-hidden="true"/>Client representative - acts on it day to day</span></div>
   </div>
   <section className="org-rules-panel" aria-label={headerTitle} onContextMenu={e=>{e.preventDefault();setMenu({x:e.clientX,y:e.clientY})}}>
    <div className="org-panel-head"><div><h2 className="org-panel-title">{headerTitle}</h2><p className="org-panel-sub">{headerSub}</p></div>{selected&&!selected.includes('.')&&selInfo?.inMaster&&<button type="button" className="org-open-skill" onClick={()=>openSkill(selected)}>Open skill in Skills master ›</button>}</div>
    <div className="org-card-list">
     {visible.map(r=>{const ex=ruleExtra(r.id);const type=ruleType(r.values[1]||'');const status=statusMeta(r.values[6]||'');const open=openCard===r.id;const refs=refsOf(r);const subskill=selected&&!selected.includes('.')?refs.find(ref=>ref.startsWith(selected+'.')):undefined;const alsoLinked=refs.filter(ref=>ref!==selected&&ref!==subskill&&!(selected&&!selected.includes('.')&&ref.startsWith(selected+'.')));const facts=keyFacts(r);
      return <article key={r.id} className={'org-card'+(open?' open':'')} onClick={()=>setOpenCard(open?null:r.id)}>
       <div className="org-card-top"><button type="button" className="org-rule-id" title="Open rule editor" onClick={e=>{e.stopPropagation();openRule(r)}}>{r.values[0]}</button>{type.short&&<span className="org-card-type" title={type.full}>{type.short}</span>}<span className={`org-status org-status-${status.tone}`} title={status.full}>{status.label}</span></div>
       <p className="org-card-text">{type.description||'Not set'}</p>
       <div className="org-card-meta" onClick={e=>e.stopPropagation()}>
        {ex.appliesTo.trim()&&<span className="org-meta"><label>APPLIES TO</label><span className="org-meta-chip">{ex.appliesTo}</span></span>}
        {subskill&&<span className="org-meta"><label>SUBSKILL</label><button type="button" className="org-meta-chip org-meta-link" title="Show this subskill" onClick={()=>setSelected(subskill)}>{subskill}</button></span>}
        {alsoLinked.length>0&&<span className="org-meta"><label>ALSO LINKED</label>{alsoLinked.map(ref=><button type="button" key={ref} className="org-meta-chip org-meta-link" title={`Show rules for ${ref}`} onClick={()=>setSelected(ref)}>{ref}</button>)}</span>}
        <span className="org-meta"><label>PROMPTS</label><button type="button" className="org-prompts-count" onClick={()=>openRule(r,'prompts')}>{promptsLabel(r.id)} ›</button></span>
        {ex.actsOn.trim()&&<span className="org-meta"><label>ACTS ON</label><span className="org-meta-chip org-actor"><span className="dot dot-client" aria-hidden="true"/>{ex.actsOn}</span></span>}
       </div>
       {open&&<div className="org-usage" onClick={e=>e.stopPropagation()}>
        <div className="org-usage-panel"><h4><span className="dot dot-fde" aria-hidden="true"/>FDE</h4><p className={ex.fdeUse.trim()?'':'org-muted'}>{ex.fdeUse.trim()||'No FDE usage recorded yet - open the rule editor to describe how the FDE configures and tests this rule.'}</p><button type="button" className="org-usage-link" onClick={()=>openRule(r)}>Open rule editor ›</button></div>
        <div className="org-usage-panel"><h4><span className="dot dot-client" aria-hidden="true"/>Client representative</h4><p className={ex.clientUse.trim()?'':'org-muted'}>{ex.clientUse.trim()||'No client-representative usage recorded yet - open the rule editor to describe how they act on this rule day to day.'}</p></div>
       </div>}
       {open&&facts.length>0&&<div className="org-card-foot">{facts.map((f,i)=>{const m=f.match(/^([^:]{1,24}):\s*(.*)$/);return <span key={i} className="org-fact">{m?<><b>{m[1]}</b> {m[2]}</>:f}</span>})}</div>}
      </article>})}
     {!visible.length&&<p className="org-rules-empty">{querying?'No matching rules for this organization.':selected?`No rules linked to ${selected} yet.`:'No rules for this organization yet. Right-click to add one.'}</p>}
    </div>
   </section>
  </div>
  {menu&&<div className="pop-menu context-menu" role="menu" style={{left:menu.x,top:menu.y}} onClick={e=>e.stopPropagation()}><button role="menuitem" className="primary" onClick={()=>{setMenu(null);startDraft()}}>Add rule</button></div>}
  {notice&&<div className="org-save-note" role="status">{notice}<button aria-label="Dismiss rules notice" onClick={()=>setNotice('')}>×</button></div>}
  <p className="org-rules-note org-rules-footer"><span>Rules apply to {orgName} only · Selecting a skill filters the rules on the right · Right-click the rules list to add a rule</span><span>Saved in this browser only · No backend connected</span></p>
  {editing&&<div className="org-drawer-shade" onMouseDown={()=>setEditing(null)}><section className="org-rule-drawer" role="dialog" aria-modal="true" aria-label="Rule editor" onMouseDown={e=>e.stopPropagation()}>
   <header><div><h3>{editing.row.values[0]}</h3><small>{editing.isNew?'New rule. The ID is assigned and locked.':'ID locked. Editing keeps the ID and links.'}</small></div><button aria-label="Close rule editor" onClick={()=>setEditing(null)}>×</button></header>
   <div className="org-rule-tabs"><button className={editing.tab==='rule'?'on':''} onClick={()=>setEditing({...editing,tab:'rule'})}>Rule</button><button className={editing.tab==='prompts'?'on':''} onClick={()=>setEditing({...editing,tab:'prompts'})}>Prompts {(editing.extra.prompts.system.trim()?1:0)+editing.extra.prompts.micro.filter(p=>p.text.trim()).length}</button></div>
   <div className="org-rule-form">{editing.tab==='rule'?<>
    <label>Rule text<textarea aria-label="Rule text" value={editing.row.values[1]} onChange={e=>setRuleField(1,e.target.value)}/></label>
    <label>Applies to<input aria-label="Rule applies to" placeholder="Set applicability" value={editing.extra.appliesTo} onChange={e=>setExtraField('appliesTo',e.target.value)}/></label>
    <label>FDE usage<textarea aria-label="FDE usage" placeholder="How the FDE configures and tests this rule" value={editing.extra.fdeUse} onChange={e=>setExtraField('fdeUse',e.target.value)}/></label>
    <label>Client representative usage<textarea aria-label="Client representative usage" placeholder="How the client representative acts on this rule day to day" value={editing.extra.clientUse} onChange={e=>setExtraField('clientUse',e.target.value)}/></label>
    <label>Acts on<input aria-label="Acts on" placeholder="Who acts on this rule (e.g. Client rep (BU head))" value={editing.extra.actsOn} onChange={e=>setExtraField('actsOn',e.target.value)}/></label>
    <label>Status<input list="org-rule-statuses" aria-label="Rule status" value={editing.row.values[6]} onChange={e=>setRuleField(6,e.target.value)}/><datalist id="org-rule-statuses"><option>Draft</option><option>Active</option><option>Archived</option></datalist></label>
    <label>Linked skills</label><div className="org-chip-list">{skillRefs(editing.row.values[8]).map(id=><span className="org-linked-skill" key={id}><button onClick={()=>openSkill(id)} title={id}>{skillName(id)}</button><button aria-label={`Remove skill ${id}`} onClick={()=>setRuleField(8,skillRefs(editing.row.values[8]).filter(x=>x!==id).join('; '))}>×</button></span>)}</div>
    <select aria-label="Link skill" value="" onChange={e=>{if(e.target.value)setRuleField(8,[...skillRefs(editing.row.values[8]),e.target.value].join('; '))}}><option value="">+ Link skill</option>{skills.filter(s=>!skillRefs(editing.row.values[8]).includes(s.values[0])).map(s=><option key={s.id} value={s.values[0]}>{s.values[1]||s.values[0]} ({s.values[0]})</option>)}</select>
    <details><summary>Original mapping and source (preserved)</summary><p>{editing.row.values[3]}</p><p>{editing.row.values[2]}</p></details>
   </>:<>
    <label>System prompt<textarea aria-label="System prompt" placeholder="No system prompt yet" value={editing.extra.prompts.system} onChange={e=>setEditing({...editing,extra:{...editing.extra,prompts:{...editing.extra.prompts,system:e.target.value}}})}/></label>
    <h4>Micro prompts</h4>{editing.extra.prompts.micro.map((p,i)=><div className="org-micro-prompt" key={p.id}><input aria-label={`Micro prompt ${i+1} name`} placeholder="Name" value={p.name} onChange={e=>{const extra=structuredClone(editing.extra);extra.prompts.micro[i].name=e.target.value;setEditing({...editing,extra})}}/><textarea aria-label={`Micro prompt ${i+1} text`} placeholder="Prompt text" value={p.text} onChange={e=>{const extra=structuredClone(editing.extra);extra.prompts.micro[i].text=e.target.value;setEditing({...editing,extra})}}/><button aria-label={`Remove micro prompt ${i+1}`} onClick={()=>{const extra=structuredClone(editing.extra);extra.prompts.micro.splice(i,1);setEditing({...editing,extra})}}>Remove</button></div>)}
    <button onClick={()=>{const extra=structuredClone(editing.extra);extra.prompts.micro.push({id:newId(),name:'',text:''});setEditing({...editing,extra})}}>+ Add micro prompt</button>
   </>}</div><footer><button aria-label="Cancel (Esc)" onClick={()=>setEditing(null)}><span>Cancel</span><span className="shortcut-hint">(Esc)</span></button><button className="primary" aria-label="Save (Ctrl+Enter)" onClick={saveEditor}><span>Save</span><span className="shortcut-hint">(Ctrl+Enter)</span></button></footer>
  </section></div>}
 </div>;
 function openRule(r:RecordRow,tab:'rule'|'prompts'='rule'){open(r,tab)}
}
