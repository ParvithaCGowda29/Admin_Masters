import {utils,writeFile} from 'xlsx';
import {loadList} from './templateLists';
import type {MastersTemplate} from './templates';
// Template downloads are generated on click from the list saved on this device: the fixed
// header row plus every uploaded or edited row, so a download after an upload can never
// serve the old blank file. With no rows yet the file is the blank template, matching the
// reference copies in public/templates (scripts/make-templates.mjs).
export function downloadTemplate(template:MastersTemplate){
 const rows=loadList(template.key,template).map(r=>r.values);
 const sheet=utils.aoa_to_sheet([template.headers,...rows]);
 sheet['!cols']=template.headers.map(h=>({wch:Math.max(h.length+2,16)}));
 const book=utils.book_new();
 utils.book_append_sheet(book,sheet,template.file.replace(/\.xlsx$/,''));
 writeFile(book,template.file);
}
