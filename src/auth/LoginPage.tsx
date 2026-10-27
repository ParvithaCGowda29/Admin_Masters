// /login: public, no app shell. Ported 1:1 from the Pipeline UI login (frontend3/src/features/login); only the product chip and banner text differ.
import {useEffect,useRef,useState,type FormEvent,type KeyboardEvent,type ReactNode} from 'react';
import {EMAIL_RE,signInRequest,startSession} from './session';
import logo from '../assets/login/bull-logo.png';
import panel from '../assets/login/bull-panel.png';
import './login.css';

const MESSAGES=[
  {headline:'From discovery document to deployed skill, in one pipeline.',flow:'Ingest > Retrieve > Build > Validate'},
  {headline:'Every SOW traces back to its source documents.',flow:'Sources > Evidence > Score > Approve'},
  {headline:'Validated code, tested before it ships.',flow:'Generate > Validate > Test > Deploy'},
  {headline:'Build in FDE, prove in Staging.',flow:'Draft > Review > Certify > Release'},
];
const ROTATE_MS=6000;

const Svg=({size=16,spin,children}:{size?:number;spin?:boolean;children:ReactNode})=><svg className={spin?'login-spin':undefined} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>;
const I={
  info:<><circle cx="8" cy="8" r="5.8"/><path d="M8 7.2v3.8M8 5v.2"/></>,
  alert:<><path d="M8 2.5l6 10.5H2z"/><path d="M8 6.5v3M8 11.2v.3"/></>,
  eye:<><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></>,
  eyeOff:<><path d="M2 8s2.2-4 6-4c1 0 1.9.3 2.7.7M14 8s-2.2 4-6 4c-1 0-1.9-.3-2.7-.7"/><path d="M6.6 6.6a2 2 0 0 0 2.8 2.8"/><path d="M2.5 2.5l11 11"/></>,
  spinner:<path d="M8 2.5a5.5 5.5 0 105.5 5.5"/>,
  check:<path d="M3.5 8.5l3 3 6-7"/>,
  left:<path d="M13 8H3m4-4L3 8l4 4"/>,
  right:<path d="M3 8h10M9 4l4 4-4 4"/>,
};

export function LoginPage({fromPipeline}:{fromPipeline:boolean}){
  useEffect(()=>{const t=document.title;document.title='Sign in · BuLLM FDE workspace';return()=>{document.title=t}},[]);
  return <>
    {fromPipeline&&<div className="login-banner" role="status"><Svg size={14}>{I.info}</Svg>Your Pipeline session has ended - sign in to continue to Masters.</div>}
    <main className={`login-page${fromPipeline?' has-banner':''}`}>
      <div className="login-card">
        <section className="login-left">
          <div className="login-brand">
            <img src={logo} alt="" width={68} height={68} className="login-logo"/>
            <div>
              <span className="brand-lockup login-lockup" role="img" aria-label="BuLLM. Scaffold. Automate. Accelerate."><span className="brand-mark" aria-hidden><span className="brand-bu">Bu</span><span className="brand-llm">LLM</span></span><span className="brand-tag" aria-hidden>Scaffold. Automate. Accelerate.</span></span>
              <div className="login-product">FDE workspace<span className="login-chip">Masters</span></div>
            </div>
          </div>
          <h1 className="login-title">Welcome back</h1>
          <p className="login-lede">Sign in to your BuLLM workspace.</p>
          <SignInForm/>
          <p className="login-note">Access is invite-only. Contact your administrator for an account.</p>
        </section>
        <Showcase/>
      </div>
    </main>
  </>;
}

function SignInForm(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [show,setShow]=useState(false);
  const [keep,setKeep]=useState(false);
  const [errors,setErrors]=useState<{email?:string;password?:string}>({});
  const [status,setStatus]=useState<'idle'|'busy'|'ok'>('idle');
  const [alert,setAlert]=useState<string|null>(null);
  const [caps,setCaps]=useState(false);
  const [forgot,setForgot]=useState(false);
  const emailRef=useRef<HTMLInputElement>(null);
  const pwRef=useRef<HTMLInputElement>(null);
  const busy=status!=='idle';
  const onKey=(e:KeyboardEvent<HTMLInputElement>)=>setCaps(e.getModifierState('CapsLock'));

  async function submit(e:FormEvent){
    e.preventDefault();
    if(busy)return;
    const user=email.trim();
    const next={email:EMAIL_RE.test(user)?undefined:'Enter a valid work email',password:password?undefined:'Enter your password'};
    setErrors(next);setAlert(null);
    if(next.email)return emailRef.current?.focus();
    if(next.password)return pwRef.current?.focus();
    setStatus('busy');
    const res=await signInRequest(user,password).catch(()=>({ok:false as const,reason:'unavailable' as const}));
    setPassword('');
    if(!res.ok){
      setStatus('idle');
      setAlert(res.reason==='invalid'?'Email or password is incorrect.':'Sign-in is not available right now. Contact your administrator.');
      requestAnimationFrame(()=>pwRef.current?.focus());
      return;
    }
    setStatus('ok');
    setTimeout(()=>{startSession(user,keep);location.replace('/')},600);
  }

  return <form className="login-form" noValidate onSubmit={submit}>
    <div className="login-field">
      <label htmlFor="login-email">Work email</label>
      <input id="login-email" ref={emailRef} type="email" autoComplete="username" placeholder="you@company.com" autoFocus value={email} onChange={e=>setEmail(e.target.value)} disabled={busy} aria-invalid={!!errors.email} aria-describedby={errors.email?'login-email-err':undefined}/>
      {errors.email&&<p id="login-email-err" className="login-err"><Svg size={13}>{I.alert}</Svg>{errors.email}</p>}
    </div>
    <div className="login-field">
      <label htmlFor="login-password">Password</label>
      <div className="login-pw">
        <input id="login-password" ref={pwRef} type={show?'text':'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKey} onKeyUp={onKey} onBlur={()=>setCaps(false)} disabled={busy} aria-invalid={!!errors.password} aria-describedby={[errors.password&&'login-pw-err',caps&&'login-caps'].filter(Boolean).join(' ')||undefined}/>
        <button type="button" className="login-eye" onClick={()=>setShow(s=>!s)} aria-pressed={show} aria-label={show?'Hide password':'Show password'} disabled={busy}><Svg size={20}>{show?I.eyeOff:I.eye}</Svg></button>
      </div>
      {errors.password&&<p id="login-pw-err" className="login-err"><Svg size={13}>{I.alert}</Svg>{errors.password}</p>}
      {caps&&<p id="login-caps" className="login-hint">Caps Lock is on.</p>}
    </div>
    <div className="login-row">
      <label className="login-check"><input type="checkbox" checked={keep} onChange={e=>setKeep(e.target.checked)} disabled={busy}/>Keep me signed in</label>
      <button type="button" className="login-link" onClick={()=>setForgot(true)} aria-expanded={forgot} aria-controls="login-forgot">Forgot password?</button>
    </div>
    <p id="login-forgot" className="login-hint" role="status">{forgot?'Contact your administrator to reset your password.':''}</p>
    {alert&&<div className="login-alert" role="alert"><Svg size={15}>{I.alert}</Svg>{alert}</div>}
    <button type="submit" className={`login-submit ${status}`} aria-disabled={busy}>
      {status==='busy'?<><Svg size={18} spin>{I.spinner}</Svg>Signing in</>:status==='ok'?<><Svg size={18}>{I.check}</Svg>Signed in</>:'Sign in'}
    </button>
  </form>;
}

function Showcase(){
  const n=MESSAGES.length;
  const [i,setI]=useState(0);
  const [prev,setPrev]=useState<number|null>(null);
  const [manual,setManual]=useState(false);
  const [held,setHeld]=useState(false);
  const [hidden,setHidden]=useState(()=>document.hidden);
  const [restart,setRestart]=useState(0);
  const cur=useRef(0);
  const show=(to:number,byUser:boolean)=>{
    const next=((to%n)+n)%n;
    if(next===cur.current)return;
    setPrev(cur.current);cur.current=next;setI(next);setManual(byUser);
    if(byUser)setRestart(r=>r+1);
  };
  useEffect(()=>{const f=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',f);return()=>document.removeEventListener('visibilitychange',f)},[]);
  useEffect(()=>{if(held||hidden||n<2)return;const t=setInterval(()=>show(cur.current+1,false),ROTATE_MS);return()=>clearInterval(t)},[held,hidden,n,restart]);
  const m=MESSAGES[i];
  const old=prev!==null?MESSAGES[prev]:null;
  return <aside className="login-panel" aria-label="FDE workspace highlights">
    <img src={panel} alt="" className="login-panel-art" width={580} height={440}/>
    <div className="login-panel-body">
      <ul className="login-chips" aria-label="Product areas"><li>Four stages</li><li>FDE Workbench</li><li>Sandbox</li></ul>
      <div className="login-rotator" onMouseEnter={()=>setHeld(true)} onMouseLeave={()=>setHeld(false)} onFocus={()=>setHeld(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setHeld(false)}}>
        <div className="login-quote" aria-live={manual?'polite':'off'}>
          {old&&<div key={`o${prev}`} className="login-quote-text out" aria-hidden onAnimationEnd={()=>setPrev(null)}><p className="login-quote-head">{old.headline}</p><p className="login-quote-flow">{old.flow}</p></div>}
          <div key={i} className="login-quote-text in"><p className="login-quote-head">{m.headline}</p><p className="login-quote-flow">{m.flow}</p></div>
        </div>
        <div className="login-controls">
          <div className="login-dots">{MESSAGES.map((_,k)=><button key={k} type="button" className="login-dot" aria-label={`Show message ${k+1} of ${n}`} aria-current={k===i?'true':undefined} onClick={()=>show(k,true)}/>)}</div>
          <div className="login-arrows">
            <button type="button" className="login-arrow" aria-label="Previous message" onClick={()=>show(cur.current-1,true)}><Svg size={20}>{I.left}</Svg></button>
            <button type="button" className="login-arrow" aria-label="Next message" onClick={()=>show(cur.current+1,true)}><Svg size={20}>{I.right}</Svg></button>
          </div>
        </div>
      </div>
    </div>
  </aside>;
}
