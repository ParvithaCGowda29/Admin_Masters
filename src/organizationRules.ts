import {loadRows,type RecordRow} from './provider';
export type RulePrompts={system:string;micro:{id:string;name:string;text:string}[]};
export type RuleExtra={appliesTo:string;prompts:RulePrompts};
const KEY='bullm-organization-rule-details-v1';
export function loadRuleExtras():Record<string,RuleExtra>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
export function saveRuleExtra(id:string,extra:RuleExtra){localStorage.setItem(KEY,JSON.stringify({...loadRuleExtras(),[id]:extra}))}
export function ruleExtra(id:string):RuleExtra{return loadRuleExtras()[id]||{appliesTo:'',prompts:{system:'',micro:[]}}}
export function promptCount(id:string){const p=ruleExtra(id).prompts;return (p.system.trim()?1:0)+p.micro.filter(x=>x.text.trim()).length}
// Match only explicit organization identifiers in the mapping field, before Skills.
// Expand the workbook's literal compressed reference ORG-BU-01/02, not other inferred scopes.
export function belongsToOrg(rule:RecordRow,orgId:string){if(!orgId.trim())return false;const mapping=(rule.values[3]||'').split(/Skills:/i)[0].replace(/ORG-BU-01\/02/g,'ORG-BU-01; ORG-BU-02');return mapping.split(/[^A-Za-z0-9-]+/).includes(orgId)}
export function orgRuleCount(orgId:string){return loadRows('Rules').filter(r=>belongsToOrg(r,orgId)).length}
export function nextRuleId(rows:RecordRow[]){let n=1;const ids=new Set(rows.map(r=>r.values[0]));while(ids.has(`RULE-CUSTOM-${String(n).padStart(3,'0')}`))n++;return `RULE-CUSTOM-${String(n).padStart(3,'0')}`}
export function skillRefs(text:string){return text.split(/[;,\n]+/).map(x=>x.trim()).filter(Boolean)}
