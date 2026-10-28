import {useEffect,useRef,useState} from 'react';
import Uppy from '@uppy/core';
import Dashboard from '@uppy/react/dashboard';
import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

export type UploadMode='bulk'|'folder'|'zip';
const CONFIG:Record<UploadMode,{title:string;note:string;types:string[];max:number|null;folders?:boolean}>={
 bulk:{title:'Bulk upload',note:'One .xlsx or .csv file.',types:['.xlsx','.csv'],max:1},
 folder:{title:'Choose folder',note:'Every .xlsx and .csv in the folder is imported together.',types:['.xlsx','.csv'],max:null,folders:true},
 zip:{title:'Upload zip',note:'One .zip archive. Every .xlsx and .csv inside is imported together, like a folder.',types:['.zip'],max:1},
};
type Props={mode:UploadMode;title?:string;note?:string;types?:string[];onClose:()=>void;onConfirm:(files:File[])=>void};
export function UppyPicker({mode,title,note,types,onClose,onConfirm}:Props){
 const base=CONFIG[mode];const config={...base,title:title||base.title,note:note||base.note,types:types||base.types};
 const dialog=useRef<HTMLDialogElement>(null);
 const [count,setCount]=useState(0);
 const [uppy]=useState(()=>new Uppy({autoProceed:false,restrictions:{maxNumberOfFiles:config.max,allowedFileTypes:config.types}}));
 useEffect(()=>{
  const element=dialog.current;element?.showModal();
  const update=()=>setCount(uppy.getFiles().length);
  uppy.on('file-added',update);uppy.on('file-removed',update);
  // No uppy.destroy() here: StrictMode's setup/cleanup/setup cycle would kill the instance the second
  // setup still uses. The dialog is short-lived; Dashboard uninstalls its plugin on unmount.
  return()=>{uppy.off('file-added',update);uppy.off('file-removed',update);element?.close();};
 },[uppy]);
 return <dialog ref={dialog} className="bulk-dialog uppy-dialog" aria-labelledby="uppy-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <div className="bulk-heading"><div><h2 id="uppy-title">{config.title}</h2><p>{config.note}</p></div><button aria-label="Close file picker" onClick={onClose}>×</button></div>
  <div className="bulk-body">
   <Dashboard uppy={uppy} width="100%" height={330} proudlyDisplayPoweredByUppy={false} hideUploadButton fileManagerSelectionType={config.folders?'folders':'files'} note={config.folders?'Drop a folder or browse for one':config.types.join(' or ')}/>
  </div>
  <div className="bulk-footer"><span>Processed in this browser only</span><button onClick={onClose}>Cancel</button><button className="primary" disabled={!count} onClick={()=>onConfirm(uppy.getFiles().map(f=>new File([f.data as Blob],f.name,{type:f.type||undefined})))}>Continue with {count||''} file{count===1?'':'s'}</button></div>
 </dialog>;
}
