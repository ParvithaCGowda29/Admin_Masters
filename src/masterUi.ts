import type {RecordRow} from './provider';
export type FacetSelection=Record<string,string[]>;
// Use only existing workbook fields. No new columns, inferred IDs or tool tags.
const FACETS:Record<string,string[]>={
 Organization:['Company / Type','Location','Certifications'],
 Agents:['Agent Type','Runtime / status'],
 Skills:['Workflow step','Status'],
 Rules:['Status','Owner / version'],
 Tools:['Category','Status','Owner / access','Refresh Frequency'],
 Filetype:['Domain','Type / category'],
};
export function facetFields(name:string,headers:string[]){return (FACETS[name]||[]).map(label=>({label,index:headers.indexOf(label)})).filter(f=>f.index>=0);}
// Treat a source cell as one value: splitting prose or paths could change its meaning.
export function facetValue(value:string){return value.trim()||'(Empty)';}
export function matchesFacets(row:RecordRow,selection:FacetSelection,except?:string){return Object.entries(selection).every(([key,values])=>key===except||!values.length||values.includes(facetValue(row.values[Number(key)]||'')));}
export function facetOptions(rows:RecordRow[],index:number,selection:FacetSelection){const counts=new Map<string,number>();for(const row of rows.filter(r=>matchesFacets(r,selection,String(index)))){const value=facetValue(row.values[index]||'');counts.set(value,(counts.get(value)||0)+1);}return [...counts].sort(([a],[b])=>a.localeCompare(b));}
export function readmeForMaster(name:string,readme:string[][]){
 if(name==='Masters')return readme;
 // Tab panels stay specific to their own tab: only the workbook row named after the tab
 // (if one exists) plus the tab's own field guide. Shared cross-master rows like Layout,
 // Hierarchy and Manufacturing records live under the Masters parent info only.
 return readme.filter(row=>row[0]===name);
}
