import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!;
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PIN=Deno.env.get('APP_PIN')||'1337';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});
const nums=(v:unknown)=>[...new Set((Array.isArray(v)?v:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=151))];
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const STRONG=new Set([3,9,26,131,143,148,95,94,93,92,135,133,59,34,31,130,144,145,146,123,141,25,6]);
const ELITE=new Set([149,150,151]);

async function api(path:string,init:RequestInit={}){
  const r=await fetch(`${U}/rest/v1${path}`,{...init,headers:{...H,...(init.headers||{})}}),text=await r.text();
  if(!r.ok)throw new Error(text||`REST ${r.status}`);
  return text?JSON.parse(text):null;
}
async function player(id:string){const a=await api(`/players?id=eq.${encodeURIComponent(id)}&select=id,name,starter_event_completed_at&limit=1`);return a?.[0]||null}
async function wild(id:string){const a=await api(`/wild_pokemon_state?player_id=eq.${encodeURIComponent(id)}&select=*&limit=1`);return a?.[0]||null}
async function gym(id:string){let a=await api(`/gym_player_state?player_id=eq.${encodeURIComponent(id)}&select=*&limit=1`);if(a?.[0])return a[0];a=await api('/gym_player_state',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({player_id:id,current_cycle:0,current_leader:0,damage:0,leader_defeated:false,initial_round_complete:false})});return a?.[0]||null}
async function patchGym(id:string,body:Record<string,unknown>){const a=await api(`/gym_player_state?player_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...body,updated_at:new Date().toISOString()})});return a?.[0]||null}
async function patchWild(id:string,body:Record<string,unknown>){const a=await api(`/wild_pokemon_state?player_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...body,updated_at:new Date().toISOString()})});return a?.[0]||null}
function addHours(date:Date,minHours:number,maxHours:number){const mins=Math.floor((minHours+Math.random()*(maxHours-minHours))*60);return new Date(date.getTime()+mins*60000)}

async function benefits(id:string,level:number){
  const r=await fetch(`${U}/functions/v1/gym-game-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'benefits',player_id:id,level,pin:PIN})});
  const text=await r.text();let data:any={};try{data=text?JSON.parse(text):{}}catch{}
  if(!r.ok)throw new Error(data.error||text||'Benefits failed');
  return data.benefits||{};
}
function osloDay(ts:string|Date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(ts instanceof Date?ts:new Date(ts)),v:any={};for(const p of parts)if(p.type!=='literal')v[p.type]=p.value;return`${v.year}-${v.month}-${v.day}`}
function mondayKey(ts:string|Date){const value=osloDay(ts),[y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d)),dow=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()-(dow-1));return date.toISOString().slice(0,10)}
function shiftDay(value:string,days:number){const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d+days));return date.toISOString().slice(0,10)}
async function levelForPlayer(id:string){const rows=await api(`/workouts?player_id=eq.${encodeURIComponent(id)}&select=created_at&order=created_at.asc`);if(!rows?.length)return 1;const weeks=new Map<string,Set<string>>();for(const row of rows){const week=mondayKey(row.created_at),day=osloDay(row.created_at);if(!weeks.has(week))weeks.set(week,new Set());weeks.get(week)!.add(day)}const keys=[...weeks.keys()].sort(),current=mondayKey(new Date()),W=[0,4,7,10,12,13,14,15];let xp=0;for(let week=keys[0];week<=current;week=shiftDay(week,7)){const days=weeks.get(week)?.size||0;xp+=week===current?W[days]:(days?W[days]:-6)}return Math.floor(Math.max(0,xp)/10)+1}

function rarityPenalty(id:number){return ELITE.has(id)?.12:STRONG.has(id)?.06:0}
function catchChance(base:number,hpRatio:number,turns:number,resolution:string,pokemonId:number){
  const safeBase=clamp(Number(base)||.5,.25,1),penalty=rarityPenalty(pokemonId);
  if(resolution==='auto')return clamp(safeBase*.72-penalty,.30,.78);
  const turnBonus=Math.min(8,Math.max(0,Number(turns)||0))*.005;
  return clamp(safeBase*.72-penalty+(1-clamp(hpRatio,0,1))*.48+turnBonus,.30,.95);
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,service:'wild-attempt-preview-battle-v3'});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json(),id=String(b.player_id||''),workoutId=String(b.workout_id||''),level=await levelForPlayer(id);
    if(String(b.pin||'')!==PIN)return out({error:'Feil PIN'},403);
    const p=await player(id);if(!p)return out({error:'Spiller finnes ikke'},404);
    if(!p.starter_event_completed_at)return out({locked:true,attempted:false,error:'Wild Pokémon er ikke låst opp'},200);
    let w=await wild(id);const benefit=await benefits(id,level);
    if(!w||w.status!=='active'||!w.pokemon_id)return out({wild:w,benefits:benefit,attempted:false});
    const now=Date.now(),appeared=new Date(w.appeared_at||0).getTime(),expires=new Date(w.expires_at||0).getTime();
    if(!appeared||!expires||now>expires)return out({wild:w,benefits:benefit,attempted:false,expired:true});

    const workouts=await api(`/workouts?id=eq.${encodeURIComponent(workoutId)}&player_id=eq.${encodeURIComponent(id)}&select=id,created_at&limit=1`),workout=workouts?.[0];
    if(!workout)return out({wild:w,benefits:benefit,attempted:false,error:'Workout not found'});
    const claims=await api(`/workout_reward_claims?first_workout_id=eq.${encodeURIComponent(workoutId)}&player_id=eq.${encodeURIComponent(id)}&select=first_workout_id,claimed_at&limit=1`),claim=claims?.[0];
    const registeredAt=new Date(claim?.claimed_at||workout.created_at).getTime();
    if(!registeredAt||registeredAt<appeared||registeredAt>expires)return out({wild:w,benefits:benefit,attempted:false,error:'Workout outside encounter'});

    const pokemonId=Number(w.pokemon_id),resolution=b.resolution==='battle'?'battle':'auto';
    const turns=resolution==='battle'?clamp(Math.floor(Number(b.turns)||0),0,999):0;
    const hpRatio=resolution==='battle'?clamp(Number(b.hp_ratio??1),0,1):1;
    const fainted=resolution==='battle'&&(!!b.fainted||hpRatio<=0),playerFainted=resolution==='battle'&&!!b.player_fainted;
    const baseChance=Number(benefit?.tiers?.power?.effective_catch)||.5;
    const chance=fainted||playerFainted?0:catchChance(baseChance,hpRatio,turns,resolution,pokemonId);
    const success=!fainted&&!playerFainted&&Math.random()<chance;
    if(success){
      const g=await gym(id),owned=[...new Set([...nums(g?.owned_pokemon),pokemonId])].sort((a,b)=>a-b),party=nums(g?.active_party).filter(x=>owned.includes(x)).slice(0,6);
      if(party.length<6&&!party.includes(pokemonId))party.push(pokemonId);
      await patchGym(id,{owned_pokemon:owned,active_party:party,version:Number(g?.version||1)+1});
    }
    const outcome=fainted?'fainted':playerFainted?'escaped':success?'caught':'missed';
    w=await patchWild(id,{status:'cooldown',pokemon_id:null,expires_at:null,next_spawn_at:addHours(new Date(),3,8).toISOString(),attempt_workout_id:workout.id,last_result_pokemon:pokemonId,last_catch_success:success,last_outcome:outcome,version:Number(w.version||1)+1});
    return out({wild:w,benefits:benefit,attempted:true,success,pokemon_id:pokemonId,catch_chance:chance,base_catch_chance:baseChance,resolution,hp_ratio:hpRatio,turns,fainted,player_fainted:playerFainted,registered_at:new Date(registeredAt).toISOString()});
  }catch(error){console.error(error);return out({error:'Server error'},500)}
});
