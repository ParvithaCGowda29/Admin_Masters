import type {IHeaderParams} from 'ag-grid-community';
import {IconDownload} from './icons';
type Props=IHeaderParams&{onTemplateDownload?:()=>void;templateLabel?:string};
// Inner header for Organization columns backed by a list template. Rendered inside the
// grid's default header, so sort, resize and keyboard behavior stay untouched; this only
// draws the column name plus a template download. The file is generated on click from the
// current list, so it always includes the rows uploaded under Add templates.
export function TemplateHeader(p:Props){
 return <span className="template-header"><span className="template-header-name">{p.displayName}</span>{p.onTemplateDownload&&<button type="button" className="template-download" title={`Download the ${p.templateLabel} template with your current rows`} aria-label={`Download the ${p.templateLabel} template for ${p.displayName} with your current rows`} onClick={e=>{e.stopPropagation();p.onTemplateDownload?.();}} onMouseDown={e=>e.stopPropagation()}><IconDownload size={13}/></button>}</span>;
}
