import {loadRows,type RecordRow} from './provider';
export type RulePrompts={system:string;micro:{id:string;name:string;text:string}[]};
export type RuleExtra={appliesTo:string;prompts:RulePrompts};
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
export function ruleExtra(id:string):RuleExtra{
 const stored=loadRuleExtras()[id];const mock=MOCK_PROMPTS[id];
 if(!stored)return {appliesTo:'',prompts:mock?structuredClone(mock):{system:'',micro:[]}};
 // Saved details win; an example fills in only when the rule has no saved prompts yet.
 if(mock&&!stored.prompts.system.trim()&&!stored.prompts.micro.some(p=>p.text.trim()))return {...stored,prompts:structuredClone(mock)};
 return stored;
}
export function promptCount(id:string){const p=ruleExtra(id).prompts;return (p.system.trim()?1:0)+p.micro.filter(x=>x.text.trim()).length}
// Match only explicit organization identifiers in the mapping field, before Skills.
// Expand the workbook's literal compressed reference ORG-BU-01/02, not other inferred scopes.
export function belongsToOrg(rule:RecordRow,orgId:string){if(!orgId.trim())return false;const mapping=(rule.values[3]||'').split(/Skills:/i)[0].replace(/ORG-BU-01\/02/g,'ORG-BU-01; ORG-BU-02');return mapping.split(/[^A-Za-z0-9-]+/).includes(orgId)}
export function orgRuleCount(orgId:string){return loadRows('Rules').filter(r=>belongsToOrg(r,orgId)).length}
export function nextRuleId(rows:RecordRow[]){let n=1;const ids=new Set(rows.map(r=>r.values[0]));while(ids.has(`RULE-CUSTOM-${String(n).padStart(3,'0')}`))n++;return `RULE-CUSTOM-${String(n).padStart(3,'0')}`}
export function skillRefs(text:string){return text.split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean)}
