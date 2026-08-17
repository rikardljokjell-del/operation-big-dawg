import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!;
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PIN=Deno.env.get('APP_PIN')||'1337';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});
const nums=(v:unknown)=>[...new Set((Array.isArray(v)?v:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=151))];
const STRONG=new Set([3,9,26,131,143,148,95,94,93,92,135,133,59,34,31,130,144,145,146,123,141,25,6]);
const ELITE=new Set([149,150,151]);

async function api(path:string,init:RequestInit={}){
  const r=await fetch(`${U}/rest/v1${path}`,{...init,headers:{...H,...(init.headers||{})}}),text=await r.text();
  if(!r.ok)throw new Error(text||`REST ${r.status}`);
  return text?JSON.parse(text):null;
}
async function player(id:string){const a=await api(`/players?id=eq.${encodeURIComponent(id)}&select=id,name,starter_event_completed_at&limit=1`);return a?.[0]||null}
async function wild(id:string){const a=await api(`/wild_pokemon_state?player_id=eq.${encodeURIComponent(id)}&select=*&limit=1`);return a?.[0]||null}
async function gym(id:string){const a=await api(`/gym_player_state?player_id=eq.${encodeURIComponent(id)}&select=owned_pokemon&limit=1`);return a?.[0]||null}
async function patchWild(id:string,body:Record<string,unknown>){const a=await api(`/wild_pokemon_state?player_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...body,updated_at:new Date().toISOString()})});return a?.[0]||null}
async function insertWild(id:string,body:Record<string,unknown>){const a=await api('/wild_pokemon_state',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({player_id:id,...body})});return a?.[0]||null}
function addHours(date:Date,minHours:number,maxHours:number){const mins=Math.floor((minHours+Math.random()*(maxHours-minHours))*60);return new Date(date.getTime()+mins*60000)}
function osloDay(ts:string|Date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(ts instanceof Date?ts:new Date(ts)),v:any={};for(const p of parts)if(p.type!=='literal')v[p.type]=p.value;return`${v.year}-${v.month}-${v.day}`}
function mondayKey(ts:string|Date){const value=osloDay(ts),[y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d)),dow=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()-(dow-1));return date.toISOString().slice(0,10)}
function shiftDay(value:string,days:number){const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d+days));return date.toISOString().slice(0,10)}
async function levelForPlayer(id:string){const rows=await api(`/workouts?player_id=eq.${encodeURIComponent(id)}&select=created_at&order=created_at.asc`);if(!rows?.length)return 1;const weeks=new Map<string,Set<string>>();for(const row of rows){const week=mondayKey(row.created_at),day=osloDay(row.created_at);if(!weeks.has(week))weeks.set(week,new Set());weeks.get(week)!.add(day)}const keys=[...weeks.keys()].sort(),current=mondayKey(new Date()),W=[0,4,7,10,12,13,14,15];let xp=0;for(let week=keys[0];week<=current;week=shiftDay(week,7)){const days=weeks.get(week)?.size||0;xp+=week===current?W[days]:(days?W[days]:-6)}return Math.floor(Math.max(0,xp)/10)+1}
async function benefits(id:string){
  const r=await fetch(`${U}/functions/v1/gym-game-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'benefits',player_id:id,pin:PIN})});
  const text=await r.text();let data:any={};try{data=text?JSON.parse(text):{}}catch{}
  if(!r.ok)throw new Error(data.error||text||'Benefits failed');
  return data.benefits||{};
}
function eligible(level:number){return Array.from({length:151},(_,i)=>i+1).filter(id=>!ELITE.has(id)||level>=8).filter(id=>!STRONG.has(id)||level>=5)}
async function chooseWild(id:string,level:number){const g=await gym(id),owned=nums(g?.owned_pokemon),allowed=eligible(level),missing=allowed.filter(n=>!owned.includes(n)),pool=missing.length?missing:allowed;return pool.length?pool[Math.floor(Math.random()*pool.length)]:1}
async function spawn(id:string,level:number,existing:any,lastOutcome:string|null){const now=new Date(),pokemonId=await chooseWild(id,level),expires=addHours(now,48,72),body={status:'active',pokemon_id:pokemonId,appeared_at:now.toISOString(),expires_at:expires.toISOString(),next_spawn_at:null,attempt_workout_id:null,last_outcome:lastOutcome,version:Number(existing?.version||0)+1};return existing?await patchWild(id,body):await insertWild(id,body)}
async function cooldown(id:string,existing:any,outcome='fled'){const pokemonId=Number(existing?.pokemon_id||0),body={status:'cooldown',pokemon_id:null,expires_at:null,next_spawn_at:addHours(new Date(),3,8).toISOString(),attempt_workout_id:null,last_result_pokemon:pokemonId||existing?.last_result_pokemon||null,last_catch_success:false,last_outcome:outcome,version:Number(existing?.version||0)+1};return await patchWild(id,body)}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,service:'wild-status-preview-cooldown-v1'});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json(),id=String(b.player_id||'');
    if(String(b.pin||'')!==PIN)return out({error:'Feil PIN'},403);
    const p=await player(id);if(!p)return out({error:'Spiller finnes ikke'},404);
    if(!p.starter_event_completed_at)return out({locked:true,wild:null,benefits:{}});
    const level=await levelForPlayer(id),benefit=await benefits(id);
    let w=await wild(id);
    if(!w)w=await spawn(id,level,null,null);
    const now=Date.now();
    if(w?.status==='active'&&w.expires_at&&new Date(w.expires_at).getTime()<=now)w=await cooldown(id,w,'fled');
    if(w?.status==='cooldown'&&w.next_spawn_at&&new Date(w.next_spawn_at).getTime()<=now)w=await spawn(id,level,w,w.last_outcome||null);
    return out({wild:w,benefits:benefit,level});
  }catch(error){console.error(error);return out({error:'Server error'},500)}
});
