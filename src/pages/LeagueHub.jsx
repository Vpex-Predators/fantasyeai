import React,{useCallback,useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import {ArrowLeft,CheckCircle,Link2,LockKeyhole,RefreshCw,ShieldCheck,LogOut,Users} from "lucide-react";
const API=import.meta.env.VITE_LEAGUE_API_URL || "";
const GOOGLE_CLIENT_ID=import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const KEY="fantasyeai_google_id_token";
const YEAR=new Date().getFullYear();
async function call(path,method="GET",body=null,token=""){
  if(!API)throw new Error("League sync is not configured yet.");
  const res=await fetch(API+path,{method,headers:{"authorization":"Bearer "+token,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||"Request failed ("+res.status+")");
  return data;
}
function GoogleButton({onCredential,onError}){
  const ref=useRef(null);
  useEffect(()=>{
    if(!GOOGLE_CLIENT_ID||!ref.current)return;
    let ignore=false;
    const initialize=()=>{
      if(ignore||!window.google?.accounts?.id)return;
      window.google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:r=>r.credential?onCredential(r.credential):onError("Google did not return a credential.")});
      if(ref.current){ref.current.replaceChildren();window.google.accounts.id.renderButton(ref.current,{theme:"outline",size:"large",text:"signin_with",shape:"rectangular",width:285})}
    };
    if(window.google?.accounts?.id){initialize();return()=>{ignore=true}};
    const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;s.defer=true;s.onload=initialize;s.onerror=()=>onError("Could not load Google sign-in.");document.head.appendChild(s);
    return()=>{ignore=true;s.remove()};
  },[onCredential,onError]);
  return <div ref={ref} aria-label="Sign in with Google" className="flex min-h-[44px] justify-center"/>;
}
export default function LeagueHub(){
  const [token,setToken]=useState(()=>sessionStorage.getItem(KEY)||"");
  const [me,setMe]=useState(null),[leagues,setLeagues]=useState([]),[teamOptions,setTeamOptions]=useState({});
  const [provider,setProvider]=useState("espn"),[leagueId,setLeagueId]=useState(""),[season,setSeason]=useState(YEAR),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const onError=useCallback(m=>setError(m),[]);
  const onCredential=useCallback(t=>{sessionStorage.setItem(KEY,t);setToken(t);setError("")},[]);
  const load=useCallback(async()=>{
    if(!token||!API)return;
    setBusy(true);setError("");
    try{const [who,ls]=await Promise.all([call("/v1/me","GET",null,token),call("/v1/leagues","GET",null,token)]);setMe(who);setLeagues(ls.leagues||[])}
    catch(e){setError(e.message);if(/Invalid Google login|Google token not valid|Sign in with Google/.test(e.message)){sessionStorage.removeItem(KEY);setToken("");setMe(null)}}
    finally{setBusy(false)}
  },[token]);
  useEffect(()=>{load()},[load]);
  const link=async e=>{
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try{const data=await call("/v1/leagues","POST",{provider,leagueId:leagueId.trim(),season:Number(season)},token);setNotice("League connected: "+data.league.name);setLeagueId("");await load();
      setTeamOptions(v=>({...v,[data.league.id]:data.teams||[]}));
    }catch(e){setError(e.message)}finally{setBusy(false)}
  };
  const sync=async l=>{
    setBusy(true);setError("");setNotice("");
    try{const data=await call("/v1/leagues/"+encodeURIComponent(l.id)+"/sync","GET",null,token);setTeamOptions(v=>({...v,[l.id]:data.teams||[]}));setNotice("Updated "+(data.league.name||l.name)+" · "+(data.teams?.length||0)+" teams")}
    catch(e){setError(e.message)}finally{setBusy(false)}
  };
  const lock=async(l,teamId)=>{
    if(!teamId)return;
    setBusy(true);setError("");
    try{await call("/v1/leagues/"+encodeURIComponent(l.id)+"/lock","POST",{teamId},token);setNotice("Team locked to your account");await load()}
    catch(e){setError(e.message)}finally{setBusy(false)}
  };
  return <div className="min-h-screen bg-slate-950 pb-24 text-slate-100">
    <div className="mx-auto max-w-2xl space-y-5 px-4 pt-8">
      <div className="flex items-center gap-3"><Link to="/" className="rounded-lg border border-slate-700 p-2" aria-label="Back"><ArrowLeft size={20}/></Link><div><p className="font-mono text-xs uppercase tracking-widest text-emerald-400">FantasyEAi • Account Hub</p><h1 className="font-heading text-2xl font-bold">My fantasy leagues</h1></div></div>
      <p className="text-sm text-slate-300">Connect your own league, choose your team once, and keep each account's picks private. No admin-assigned league required.</p>
      {error&&<p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {notice&&<p role="status" className="rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">{notice}</p>}
      {!GOOGLE_CLIENT_ID||!API?<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><b>Account setup pending.</b> Google OAuth client ID and the independent league API must be configured before sign-in becomes available. No account is created until sign-in succeeds.</div>:null}
      {GOOGLE_CLIENT_ID&&API&&!me?<section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/70 p-5"><h2 className="font-semibold">Sign in to sync your leagues</h2><GoogleButton onCredential={onCredential} onError={onError}/><p className="text-xs text-slate-400">Google sign-in uses your own account. FantasyEAi never requests your Google password.</p></section>:null}
      {me?<><div className="flex items-center justify-between rounded-lg border border-emerald-600/30 bg-emerald-900/20 p-3"><div className="flex min-w-0 items-center gap-2"><ShieldCheck size={18} className="text-emerald-400"/><div className="min-w-0"><p className="truncate text-sm font-semibold">{me.name||me.email}</p><p className="truncate text-xs text-slate-400">{me.email}</p></div></div><button aria-label="Log out" className="rounded border border-slate-600 p-2" onClick={()=>{sessionStorage.removeItem(KEY);setToken("");setMe(null);setLeagues([])}}><LogOut size={18}/></button></div>
      <form onSubmit={link} className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/70 p-4"><div className="flex items-center gap-2"><Link2 size={19} className="text-emerald-400"/><h2 className="font-semibold">Connect a league</h2></div><label className="block text-sm">Platform<select className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-3" value={provider} onChange={e=>setProvider(e.target.value)}><option value="espn">ESPN Fantasy</option><option value="sleeper">Sleeper</option></select></label><label className="block text-sm">League ID<input required inputMode="numeric" pattern="[0-9]{1,18}" value={leagueId} onChange={e=>setLeagueId(e.target.value)} placeholder="Paste your league ID" className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-3"/></label><label className="block text-sm">Season<input type="number" min="2020" max="2100" value={season} onChange={e=>setSeason(e.target.value)} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-3"/></label><p className="text-xs text-slate-400">Public leagues sync immediately. Private ESPN leagues require a separate authorized connection; do not paste ESPN passwords or cookies.</p><button disabled={busy} className="w-full rounded bg-emerald-400 p-3 font-bold text-slate-950 disabled:opacity-50">{busy?"Checking…":"Connect league"}</button></form>
      <section className="space-y-3"><h2 className="flex items-center gap-2 font-semibold"><Users size={19}/>Linked leagues ({leagues.length})</h2>{leagues.length===0&&<p className="rounded border border-slate-700 p-4 text-sm text-slate-400">No leagues linked yet.</p>}{leagues.map(l=><article key={l.id} className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/70 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{l.name||l.league_id}</p><p className="text-xs text-slate-400">{l.provider.toUpperCase()} · {l.season} · ID {l.league_id}</p></div><button disabled={busy} onClick={()=>sync(l)} className="rounded border border-emerald-400/60 p-2" aria-label="Sync league"><RefreshCw size={18}/></button></div>{l.locked_team_id?<p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle size={16}/>Team locked: #{l.locked_team_id}</p>:<div><p className="mb-2 flex items-center gap-2 text-sm"><LockKeyhole size={16}/>Select your team to lock this account</p>{(teamOptions[l.id]||[]).length===0?<button className="rounded border border-slate-500 px-3 py-2 text-sm" onClick={()=>sync(l)}>Load teams</button>:<select defaultValue="" onChange={e=>lock(l,e.target.value)} disabled={busy} className="w-full rounded border border-slate-600 bg-slate-950 p-3"><option value="" disabled>Choose your team</option>{teamOptions[l.id].map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>}</div>}</article>)}</section>
      </>:null}
    </div>
  </div>
}