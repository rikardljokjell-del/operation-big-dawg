import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!;
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_PIN=Deno.env.get('APP_PIN')||'1337';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});
const players=`${U}/rest/v1/players`,workouts=`${U}/rest/v1/workouts`,gym=`${U}/rest/v1/gym_player_state`;
const STARTERS=[1,4,7];
const uniq=(v:unknown)=>[...new Set((Array.isArray(v)?v:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=151))];

async function api(url:string,init:RequestInit={}){
  const r=await fetch(url,{...init,headers:{...H,...(init.headers||{})}}),text=await r.text();
  let data:any=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw Object.assign(new Error(typeof data==='string'?data:(data?.message||data?.error||text||'Request failed')),{status:r.status,data});
  return data;
}
async function getPlayer(id:string){const a=await api(`${players}?id=eq.${encodeURIComponent(id)}&select=id,name,starter_pokemon,starter_event_triggered_at,starter_event_completed_at&limit=1`);return a?.[0]||null}
async function workoutCount(id:string){const a=await api(`${workouts}?player_id=eq.${encodeURIComponent(id)}&select=id`);return Array.isArray(a)?a.length:0}
async function snapshot(id:string){const p=await getPlayer(id);if(!p)return null;const total=await workoutCount(id);return{player_id:p.id,name:p.name,total_workouts:total,triggered:!!p.starter_event_triggered_at,starter_pokemon:p.starter_pokemon?Number(p.starter_pokemon):null,completed:!!p.starter_event_completed_at,eligible:total>=4&&!!p.starter_event_triggered_at&&!p.starter_event_completed_at}}
async function ensureGymStarter(id:string,starter:number){
  const rows=await api(`${gym}?player_id=eq.${encodeURIComponent(id)}&select=player_id,owned_pokemon,active_party&limit=1`),row=rows?.[0];
  if(!row){
    const created=await api(gym,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({player_id:id,owned_pokemon:[starter],active_party:[starter]})});
    return created?.[0]||null;
  }
  const owned=[...new Set([starter,...uniq(row.owned_pokemon)])].sort((a,b)=>a-b);
  const party=[starter,...uniq(row.active_party).filter(n=>n!==starter)].filter(n=>owned.includes(n)).slice(0,6);
  const updated=await api(`${gym}?player_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({owned_pokemon:owned,active_party:party,updated_at:new Date().toISOString()})});
  return updated?.[0]||null;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,service:'starter-pokemon'});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json();
    if(String(b.pin||'')!==APP_PIN)return out({error:'Feil PIN'},403);
    if(b.action==='list'){
      const rows=await api(`${players}?starter_pokemon=not.is.null&select=id,name,starter_pokemon,starter_event_completed_at&order=created_at.asc`);
      return out({starters:rows||[]});
    }
    const id=String(b.player_id||'');
    if(!id||!await getPlayer(id))return out({error:'Spiller finnes ikke'},404);
    if(b.action==='status')return out(await snapshot(id));
    if(b.action==='arm'){
      const s=await snapshot(id);if(!s)return out({error:'Spiller finnes ikke'},404);
      if(s.total_workouts<4||s.completed)return out(s);
      if(!s.triggered)await api(`${players}?id=eq.${encodeURIComponent(id)}&starter_event_triggered_at=is.null`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({starter_event_triggered_at:new Date().toISOString()})});
      return out(await snapshot(id));
    }
    if(b.action==='choose'){
      const starter=Number(b.starter_pokemon);if(!STARTERS.includes(starter))return out({error:'Ugyldig starter'},400);
      let s=await snapshot(id);if(!s||s.total_workouts<4||!s.triggered)return out({error:'Starter-event er ikke låst opp'},409);
      if(s.starter_pokemon&&s.starter_pokemon!==starter)return out({error:'Starter er allerede valgt'},409);
      if(!s.starter_pokemon){
        try{await api(`${players}?id=eq.${encodeURIComponent(id)}&starter_pokemon=is.null`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({starter_pokemon:starter})})}
        catch(e){s=await snapshot(id);if(s?.starter_pokemon!==starter)return out({error:'Starter er allerede valgt'},409)}
      }
      await ensureGymStarter(id,starter);
      return out(await snapshot(id));
    }
    if(b.action==='complete'){
      let s=await snapshot(id);if(!s?.starter_pokemon)return out({error:'Velg en Pokémon først'},409);
      await ensureGymStarter(id,s.starter_pokemon);
      if(!s.completed)await api(`${players}?id=eq.${encodeURIComponent(id)}&starter_event_completed_at=is.null`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({starter_event_completed_at:new Date().toISOString()})});
      return out(await snapshot(id));
    }
    return out({error:'Bad request'},400);
  }catch(e){console.error(e);return out({error:'Server error'},500)}
});