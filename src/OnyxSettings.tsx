import {useEffect,useRef,useState} from 'react';
import {saveOnyxConfig,testOnyxConnection,type OnyxConfig} from './onyx';

type Props={config:OnyxConfig|null;onSaved:(config:OnyxConfig|null,connected:boolean)=>void;onClose:()=>void};
// Connects this browser to an Onyx server (self-hosted or Onyx Cloud) so picked project
// documents can be sent there for reading and indexing. Saved on this device only.
export function OnyxSettings({config,onSaved,onClose}:Props){
 const [url,setUrl]=useState(config?.url||'');
 const [token,setToken]=useState(config?.token||'');
 const [projectId,setProjectId]=useState(config?.projectId||'');
 const [status,setStatus]=useState('');
 const [ok,setOk]=useState(false);
 const [busy,setBusy]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>{element?.close();};},[]);
 const current=():OnyxConfig=>({url,token,projectId});
 async function test(){
  setBusy(true);setStatus('');
  const result=await testOnyxConnection(current());
  setOk(result.ok);setStatus(result.detail);setBusy(false);
 }
 function save(){
  const config=current();
  saveOnyxConfig(config);
  onSaved(config,ok);
 }
 return <dialog ref={dialog} className="bulk-dialog onyx-dialog" aria-labelledby="onyx-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <div className="bulk-heading"><div><h2 id="onyx-title">Connect Onyx</h2><p>Onyx (onyx-dot-app/onyx) reads and indexes the project documents you pick here. Use your own deployment or Onyx Cloud; the URL and token stay on this device.</p></div><button aria-label="Close Onyx settings" onClick={onClose}>×</button></div>
  <div className="bulk-body">
   <div className="bulk-options">
    <label>Server URL<input aria-label="Server URL" type="url" placeholder="https://your-onyx.example.com" value={url} disabled={busy} onChange={e=>{setUrl(e.target.value);setStatus('');}}/></label>
    <label>API key or token<input aria-label="API key or token" type="password" placeholder="API key or personal access token" value={token} disabled={busy} onChange={e=>{setToken(e.target.value);setStatus('');}}/></label>
    <label>Project ID (optional)<input aria-label="Project ID (optional)" value={projectId} disabled={busy} onChange={e=>setProjectId(e.target.value)}/></label>
   </div>
   {status&&<p role="status" className={ok?'bulk-hint':'bulk-error'}>{status}</p>}
   <p className="ex-note">Create an API key in Onyx under Admin Panel → Integrations → Service Accounts (Basic group is enough), or a Personal Access Token under Settings → Accounts &amp; Access. The picked files are uploaded with the projects file API and read by Onyx; the master mapping still runs in this browser.</p>
  </div>
  <div className="bulk-footer"><span>Saved on this device only</span>
   {config&&<button className="danger" disabled={busy} onClick={()=>{saveOnyxConfig(null);onSaved(null,false);}}>Remove connection</button>}
   <button disabled={busy} onClick={onClose}>Cancel</button>
   <button disabled={busy||!url.trim()||!token.trim()} onClick={()=>void test()}>Test connection</button>
   <button className="primary" disabled={busy||!url.trim()||!token.trim()} onClick={save}>Save connection</button>
  </div>
 </dialog>;
}
