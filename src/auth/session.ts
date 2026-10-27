// ponytail: Masters' own session only - the signed-in email in sessionStorage (localStorage with "Keep me signed in"), never a password or token.
// Not shared with the Pipeline UI (:5174); nothing here reads or writes its session. Production has no auth backend yet, so no session is read (fails closed). Swap for the real provider; callers stay the same.
const KEY='bullm_masters_session';
export const LOGIN_PATH='/login';
export const PIPELINE_URL='http://localhost:5174';
export type Session={name:string};
export function getSession():Session|null{if(!import.meta.env.DEV)return null;try{const name=sessionStorage.getItem(KEY)??localStorage.getItem(KEY);return name?{name}:null}catch{return null}}
export function startSession(email:string,keep:boolean){try{(keep?localStorage:sessionStorage).setItem(KEY,email)}catch{/* storage blocked */}}
export function clearSession(){try{sessionStorage.removeItem(KEY);localStorage.removeItem(KEY)}catch{/* storage blocked */}}
/** Logout: own login page, no banner. */
export function logout(){clearSession();location.assign(LOGIN_PATH)}
/** Switch to Pipeline: same cleanup as Logout, then Pipeline with the hand-off flag (Pipeline asks for its own sign-in). */
export function switchToPipeline(){clearSession();location.assign(`${PIPELINE_URL}/login?from=masters`)}
/** Login banner: true once when opened by a Pipeline switch; the flag is stripped so a refresh drops it. */
export function consumeFromPipeline(){const url=new URL(location.href);if(url.searchParams.get('from')!=='pipeline')return false;url.searchParams.delete('from');history.replaceState(history.state,'',url.pathname+url.search+url.hash);return true}
// Mock sign-in, development only. Replace with the real backend call. The password is never stored, logged or echoed.
export const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function signInRequest(email:string,password:string):Promise<{ok:true}|{ok:false;reason:'invalid'|'unavailable'}>{if(!import.meta.env.DEV)return{ok:false,reason:'unavailable'};await new Promise(r=>setTimeout(r,700));return EMAIL_RE.test(email)&&password.length>=8?{ok:true}:{ok:false,reason:'invalid'}}
