// Onyx (https://github.com/onyx-dot-app/onyx) integration for the Add files extraction.
// Onyx is a self-hosted (or Onyx Cloud) document platform: its pipeline reads and indexes
// uploaded documents. The app talks to {server}/api with a Bearer token - an API key from
// Admin Panel > Integrations > Service Accounts, or a Personal Access Token from
// Settings > Accounts & Access (https://docs.onyx.app/developers/overview). The config is
// saved on this device only, like the masters themselves.
export type OnyxConfig={url:string;token:string;projectId:string};
const KEY='bullm-onyx-config-v1';
export function loadOnyxConfig():OnyxConfig|null{
 try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'null');
  if(saved&&typeof saved.url==='string'&&typeof saved.token==='string')return {url:saved.url,token:saved.token,projectId:typeof saved.projectId==='string'?saved.projectId:''};
 }catch{}
 return null;
}
export function saveOnyxConfig(config:OnyxConfig|null){
 try{config?localStorage.setItem(KEY,JSON.stringify(config)):localStorage.removeItem(KEY);}catch{}
}
const base=(url:string)=>`${url.trim().replace(/\/+$/,'')}/api`;
// Any valid token can read its own permissions, so this is the connection check.
// https://docs.onyx.app/developers/overview (Authentication)
export async function testOnyxConnection(config:OnyxConfig):Promise<{ok:boolean;detail:string}>{
 try{
  const res=await fetch(`${base(config.url)}/me/permissions`,{headers:{Authorization:`Bearer ${config.token}`}});
  if(res.ok)return {ok:true,detail:'Connected. Onyx accepted the token.'};
  if(res.status===401||res.status===403)return {ok:false,detail:`Onyx refused the token (${res.status}). Check the API key or token.`};
  return {ok:false,detail:`Onyx answered ${res.status} ${res.statusText||''}. Check the server URL.`.trim()};
 }catch{
  return {ok:false,detail:'Could not reach the Onyx server. Check the URL and that this browser can reach it.'};
 }
}
// Sends the picked files to Onyx, where its pipeline reads and indexes them.
// https://docs.onyx.app/developers/api_reference/projects/upload_user_files
export async function uploadToOnyx(config:OnyxConfig,files:File[]):Promise<{sent:string[];failed:string[]}>{
 const names=files.map(f=>f.name);
 try{
  const form=new FormData();
  for(const file of files)form.append('files',file,file.name);
  if(config.projectId.trim())form.append('project_id',config.projectId.trim());
  const res=await fetch(`${base(config.url)}/user/projects/file/upload`,{method:'POST',headers:{Authorization:`Bearer ${config.token}`},body:form});
  if(res.ok)return {sent:names,failed:[]};
  return {sent:[],failed:names.map(n=>`${n} (Onyx answered ${res.status})`)};
 }catch{
  return {sent:[],failed:names.map(n=>`${n} (server unreachable)`)};
 }
}
