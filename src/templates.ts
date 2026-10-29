// Header-row templates matching the four list sheets in the BuLLM common masters
// workbook. These are the stock column names each list starts with. An upload under
// Add templates replaces a list's template completely - the file's column names and rows
// take over (2026-10-29 decision) - and downloads are generated on click from the saved
// template (templateDownload.ts), so a download after an upload serves the new structure.
// The blank copies in public/templates (scripts/make-templates.mjs) stay as reference
// only. A template list never lands in a master tab.
export type TemplateKey='employees'|'customers'|'assets'|'systems';
export type MastersTemplate={key:TemplateKey;file:string;label:string;column:string;headers:string[]};
export const TEMPLATES:MastersTemplate[]=[
 {key:'employees',file:'Employee List.xlsx',label:'Employee list',column:'Employees / Job Role',headers:['Employee','Job title','Department','Unit applicability','Verification status']},
 {key:'customers',file:'Sample - Customers.xlsx',label:'Customers / Audience',column:'Customers / Audience',headers:['Customer ID','Customer / Audience','Segment / niche','Region','Related Org ID','Owner type (Employee or Company)','Owner','Status','Note']},
 {key:'assets',file:'Sample - Assets.xlsx',label:'Assets (Hardware)',column:'Assets (Hardware)',headers:['Asset ID','Asset (hardware)','Type','Location','Org ID','Owner type (Employee or Company)','Owner','Status','Note']},
 {key:'systems',file:'Sample - Systems.xlsx',label:'Systems / tools (Software)',column:'Systems / tools (Software)',headers:['System ID','System / tool (software)','Category','Used by Org ID','Owner type (Employee or Company)','Owner','Access level','Status','Note']},
];
export const templateForColumn=(header:string)=>TEMPLATES.find(t=>t.column===header);
