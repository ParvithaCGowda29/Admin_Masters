import {loadRows,type RecordRow} from './provider';
export type RulePrompts={system:string;micro:{id:string;name:string;text:string}[]};
// fdeUse / clientUse / actsOn power the Rules Engine usage panels (Variant 2, approved 2026-11-12):
// how the FDE configures and tests the rule, how the client representative acts on it day to day,
// and who it acts on. Older saved records lack these keys; ruleExtra() fills them with ''.
export type RuleExtra={appliesTo:string;fdeUse:string;clientUse:string;actsOn:string;prompts:RulePrompts};
const KEY='bullm-organization-rule-details-v1';
// Starter example prompts so the Prompts column has examples to open (requested 2026-11-06).
// An example shows only while the rule has no saved prompts of its own; any prompt the user
// saves for that rule is stored under KEY and replaces the example for that rule only.
const MOCK_PROMPTS:Record<string,RulePrompts>={
 'Rules-2':{system:'You are the access gate for the selected organization. Before any data access or external operation, check the actor and operation against the approved access matrix. Permit only operations the matrix explicitly allows for this role; anything else stops for review.',micro:[
  {id:'mock-rbac-1',name:'Access check',text:'Actor {{actor}} requests {{operation}} in {{org}}. Does the approved matrix permit this role and operation? Answer permit or stop, with the matrix row you relied on.'},
  {id:'mock-rbac-2',name:'Denial review',text:'The matrix does not cover this actor or operation. Write the stop-for-review note: what was requested, what is missing, and who should review it.'}]},
 'Rules-3':{system:'You draft skills from supplied sources only. Cite every source you use, mark fields you could not fill as missing, and return the agreed skill schema. A draft is never approved or created automatically.',micro:[
  {id:'mock-skill-1',name:'Draft skill',text:'From these source refs {{sources}}, draft the skill {{skill}} in the agreed schema. Cite evidence per field and label anything unknown.'},
  {id:'mock-skill-2',name:'Schema check',text:'Check this draft skill against the output schema. List invalid or missing fields and the citation for each filled field.'}]},
 'Rules-6':{system:'You check links before publication. For each required destination URL and internal link, confirm it resolves to the intended content on the correct tenant. Hold publication for any broken, wrong, or unverified destination.',micro:[
  {id:'mock-link-1',name:'Link check',text:'Page {{source_page}} must link to {{destination_url}}. Verify the destination resolves and shows the intended content; report pass or the exact failure.'},
  {id:'mock-link-2',name:'Hold note',text:'A link failed verification. Write the hold note for publication: page, link, what you found, and the fix needed before release.'}]},
 'Rules-9':{system:'You guard retrieval and use of personal data. Restrict every access by tenant, channel and consent basis. Where consent is missing or conflicts, do not allow outreach; route the record to review.',micro:[
  {id:'mock-privacy-1',name:'Consent check',text:'Contact {{contact}} from {{source}} is requested for {{channel}} in {{geography}}. Confirm a valid consent basis and retention status before any use.'},
  {id:'mock-privacy-2',name:'Conflict review',text:'Consent basis is missing or conflicts for this record. Write the no-outreach review note: record, conflicting signals, and the reviewer to decide.'}]},
 'Rules-12':{system:'You separate budget approval from planning. Enforce the approved cap and the stop signal on every spend action; a plan never commits spend by itself.',micro:[
  {id:'mock-spend-1',name:'Cap check',text:'Proposed spend {{amount}} for {{campaign}} against approved cap {{cap}}. State whether the action fits the cap and what approval it still needs.'},
  {id:'mock-spend-2',name:'Stop signal',text:'The stop condition for {{campaign}} is met. Write the pause action: what to stop, effective when, and who is notified.'}]},
 'Rules-30':{system:'You apply the engineering costing rules for PCBA work. Use the approved BOM costing formulas, keep units and currency explicit, and show each step so the arithmetic can be checked independently.',micro:[
  {id:'mock-pcba-1',name:'Cost a BOM',text:'Cost this BOM {{bom}} using the approved formulas. Show material, finish and machine time per line with units, currency and rounding.'},
  {id:'mock-pcba-2',name:'Formula check',text:'Recalculate this costing {{quote}} independently. Flag any line where the formula, inputs or arithmetic disagree.'}]},
};

export function loadRuleExtras():Record<string,RuleExtra>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
export function saveRuleExtra(id:string,extra:RuleExtra){localStorage.setItem(KEY,JSON.stringify({...loadRuleExtras(),[id]:extra}))}
const EMPTY_EXTRA:RuleExtra={appliesTo:'',fdeUse:'',clientUse:'',actsOn:'',prompts:{system:'',micro:[]}};
export function ruleExtra(id:string):RuleExtra{
 const stored=loadRuleExtras()[id] as Partial<RuleExtra>|undefined;const mock=MOCK_PROMPTS[id];
 if(!stored)return {...EMPTY_EXTRA,prompts:mock?structuredClone(mock):{system:'',micro:[]}};
 const sp:RulePrompts={system:'',micro:[],...(stored.prompts||{})};
 const merged:RuleExtra={...EMPTY_EXTRA,...stored,prompts:sp};
 // Saved details win; an example fills in only when the rule has no saved prompts yet.
 if(mock&&!merged.prompts.system.trim()&&!merged.prompts.micro.some(p=>p.text.trim()))return {...merged,prompts:structuredClone(mock)};
 return merged;
}
export function promptCount(id:string){const p=ruleExtra(id).prompts;return (p.system.trim()?1:0)+p.micro.filter(x=>x.text.trim()).length}
// Match only explicit organization identifiers in the mapping field, before Skills.
// Expand the workbook's literal compressed reference ORG-BU-01/02, not other inferred scopes.
export function belongsToOrg(rule:RecordRow,orgId:string){if(!orgId.trim())return false;const mapping=(rule.values[3]||'').split(/Skills:/i)[0].replace(/ORG-BU-01\/02/g,'ORG-BU-01; ORG-BU-02');return mapping.split(/[^A-Za-z0-9-]+/).includes(orgId)}
export function orgRuleCount(orgId:string){return loadRows('Rules').filter(r=>belongsToOrg(r,orgId)).length}
export function nextRuleId(rows:RecordRow[]){let n=1;const ids=new Set(rows.map(r=>r.values[0]));while(ids.has(`RULE-CUSTOM-${String(n).padStart(3,'0')}`))n++;return `RULE-CUSTOM-${String(n).padStart(3,'0')}`}
export function skillRefs(text:string){return text.split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean)}
// Split the workbook's "Rule / Type: X / Y; Description: Z" text into the type chip and the
// plain description shown on a rule card. Rows without the pattern show their text as-is.
export function ruleType(text:string){const m=text.match(/^Rule\s*\/\s*Type:\s*([^;]+);\s*Description:\s*([\s\S]*)$/);if(!m)return{full:'',short:'',description:text};const full=m[1].trim();return{full,short:full.split('/').pop()!.trim(),description:m[2].trim()}}
// Normalize the long workbook status ("Proposed starter; not approved / not implemented") into
// a short pill label and a tone for its colour. The full text stays available as a tooltip.
export function statusMeta(status:string){const s=status.trim();const low=s.toLowerCase();const label=/^proposed/.test(low)?'Proposed':/^active/.test(low)?'Active':/^draft/.test(low)?'Draft':/^archived/.test(low)?'Archived':s.split(';')[0]||'Not set';const tone=label==='Active'?'active':label==='Proposed'?'proposed':label==='Draft'?'draft':label==='Archived'?'archived':'other';return{label,tone,full:s}}
export type MapSubskill={id:string;name:string};
export type MapSkill={id:string;name:string;inMaster:boolean;subskills:MapSubskill[]};
export type MapWorkflow={id:string;name:string;skills:MapSkill[]};
function subskillName(id:string){return id.slice(id.indexOf('.')+1).split(/[.\-_]+/).filter(Boolean).map(w=>w[0]?w[0].toUpperCase()+w.slice(1).toLowerCase():w).join(' ')||id}
// Build the Rules Engine workflow map. Master skills chain through their ISATVON "Next" column;
// each connected chain is one workflow named after its first skill. Skill refs used by rules but
// missing from the Skills master group under "Other linked skills" so every rule stays reachable.
// A dotted ref (SK-X.Y) is a subskill: it nests under its parent skill, master or not.
export function workflowMap(skills:RecordRow[],ruleRows:RecordRow[]):MapWorkflow[]{
 const master=skills.map(s=>({id:s.values[0],name:s.values[1]||s.values[0],next:(s.values[8]||'').split(/\s+/)[0]||''}));
 const ids=new Set(master.map(m=>m.id));
 const parent=new Map<string,string>();master.forEach(m=>parent.set(m.id,m.id));
 const find=(x:string):string=>{let r=x;while(parent.get(r)!==r)r=parent.get(r)!;parent.set(x,r);return r};
 master.forEach(m=>{if(ids.has(m.next)){const a=find(m.id),b=find(m.next);if(a!==b)parent.set(a,b)}});
 const comps=new Map<string,string[]>();master.forEach(m=>{const r=find(m.id);comps.set(r,[...(comps.get(r)||[]),m.id])});
 const byId=new Map(master.map(m=>[m.id,m]));
 const order=(members:string[])=>{const set=new Set(members);const targeted=new Set(members.map(id=>byId.get(id)!.next).filter(n=>set.has(n)));const out:string[]=[];const seen=new Set<string>();const heads=members.filter(id=>!targeted.has(id)).sort();for(const h of heads){let cur:string|undefined=h;while(cur&&set.has(cur)&&!seen.has(cur)){seen.add(cur);out.push(cur);const n:string=byId.get(cur)!.next;cur=ids.has(n)?n:undefined}}members.filter(id=>!seen.has(id)).sort().forEach(id=>out.push(id));return out};
 const subs=new Map<string,Set<string>>();const other=new Map<string,Set<string>>();
 for(const r of ruleRows)for(const ref of skillRefs(r.values[8]||''))if(ref.includes('.')){const p=ref.slice(0,ref.indexOf('.'));(ids.has(p)?subs:other).get(p)??(ids.has(p)?subs:other).set(p,new Set());(ids.has(p)?subs:other).get(p)!.add(ref)}else if(!ids.has(ref)){if(!other.has(ref))other.set(ref,new Set())};
 const workflows:MapWorkflow[]=[...comps.values()].map(members=>{const ordered=order(members);return{id:'wf-'+ordered[0],name:byId.get(ordered[0])!.name,skills:ordered.map(id=>({id,name:byId.get(id)!.name,inMaster:true,subskills:[...(subs.get(id)||[])].sort().map(s=>({id:s,name:subskillName(s)}))}))}}).sort((a,b)=>a.id.localeCompare(b.id));
 const otherSkills:MapSkill[]=[...other.entries()].map(([id,ss])=>({id,name:id,inMaster:false,subskills:[...ss].sort().map(s=>({id:s,name:subskillName(s)}))})).sort((a,b)=>a.id.localeCompare(b.id));
 if(otherSkills.length)workflows.push({id:'wf-other',name:'Other linked skills',skills:otherSkills});
 return workflows;
}
