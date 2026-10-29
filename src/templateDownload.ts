import {utils,writeFile} from 'xlsx';
import {loadHeaders,loadList} from './templateLists';
import type {MastersTemplate} from './templates';
// Template downloads are generated on click from the template saved on this device: the
// current column names (an upload under Add templates can replace them) plus every row
// in the list. With nothing uploaded yet the file is the blank stock template, matching
// the reference copies in public/templates (scripts/make-templates.mjs).
export function downloadTemplate(template:MastersTemplate){
 const headers=loadHeaders(template.key,template);
 const rows=loadList(template.key,template).map(r=>r.values);
 const sheet=utils.aoa_to_sheet([headers,...rows]);
 sheet['!cols']=headers.map(h=>({wch:Math.max(h.length+2,16)}));
 const book=utils.book_new();
 utils.book_append_sheet(book,sheet,template.file.replace(/\.xlsx$/,''));
 writeFile(book,template.file);
}
