// Blank header-row templates matching the four list sheets in the BuLLM common masters
// workbook. Both template placements (Organization column headers and the sidebar
// Add templates menu) download these same files. A user's own filled version uploads
// under Add templates and lands in that template's own list, never in a master tab.
export type TemplateKey='employees'|'customers'|'assets'|'systems';
export type MastersTemplate={key:TemplateKey;file:string;label:string;column:string;headers:string[]};
export const TEMPLATES:MastersTemplate[]=[
 {key:'employees',file:'Employee List.xlsx',label:'Employee list',column:'Employees / Job Role',headers:['Employee','Job title','Department','Unit applicability','Verification status']},
 {key:'customers',file:'Sample - Customers.xlsx',label:'Customers / Audience',column:'Customers / Audience',headers:['Customer ID','Customer / Audience','Segment / niche','Region','Related Org ID','Owner type (Employee or Company)','Owner','Status','Note']},
 {key:'assets',file:'Sample - Assets.xlsx',label:'Assets (Hardware)',column:'Assets (Hardware)',headers:['Asset ID','Asset (hardware)','Type','Location','Org ID','Owner type (Employee or Company)','Owner','Status','Note']},
 {key:'systems',file:'Sample - Systems.xlsx',label:'Systems / tools (Software)',column:'Systems / tools (Software)',headers:['System ID','System / tool (software)','Category','Used by Org ID','Owner type (Employee or Company)','Owner','Access level','Status','Note']},
];
export const templateForColumn=(header:string)=>TEMPLATES.find(t=>t.column===header);
