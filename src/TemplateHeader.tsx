import type {IHeaderParams} from 'ag-grid-community';
import {IconDownload} from './icons';
type Props=IHeaderParams&{templateHref?:string;templateLabel?:string};
// Inner header for Organization columns backed by a blank list template. Rendered inside
// the grid's default header, so sort, resize and keyboard behavior stay untouched; this
// only draws the column name plus a template download.
export function TemplateHeader(p:Props){
 return <span className="template-header"><span className="template-header-name">{p.displayName}</span>{p.templateHref&&<a className="template-download" href={p.templateHref} download title={`Download the blank ${p.templateLabel} template`} aria-label={`Download the blank ${p.templateLabel} template for ${p.displayName}`} onClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}><IconDownload size={13}/></a>}</span>;
}
