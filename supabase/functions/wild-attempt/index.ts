import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!;
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PIN=Deno.env.get('APP_PIN')||'1337';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});
const nums=(v:unknown)=>[...new Set((Array.isArray(v)?v:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=151))];

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
  const r=await fetch(`${U}/functions/v1/gym-game`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'benefits',player_id:id,level,pin:PIN})});
  const text=await r.text();let data:any={};try{data=text?JSON.parse(text):{}}catch{}
  if(!r.ok)throw new Error(data.error||text||'Benefits failed');
  return data.benefits||{};
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,service:'wild-attempt-registration-time-v1'});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json(),id=String(b.player_id||''),workoutId=String(b.workout_id||''),level=Math.max(1,Math.floor(Number(b.level)||1));
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
    // Test mode backdates workout.created_at to simulate training days. claimed_at is
    // the real server time when the workout was registered, so it is the correct
    // timestamp for deciding whether the player trained during this Wild encounter.
    const registeredAt=new Date(claim?.claimed_at||workout.created_at).getTime();
    if(!registeredAt||registeredAt<appeared||registeredAt>expires)return out({wild:w,benefits:benefit,attempted:false,error:'Workout outside encounter'});

    const pokemonId=Number(w.pokemon_id),chance=Number(benefit?.tiers?.power?.effective_catch)||.5,success=Math.random()<chance;
    if(success){
      const g=await gym(id),owned=[...new Set([...nums(g?.owned_pokemon),pokemonId])].sort((a,b)=>a-b),party=nums(g?.active_party).filter(x=>owned.includes(x)).slice(0,6);
      if(party.length<6&&!party.includes(pokemonId))party.push(pokemonId);
      await patchGym(id,{owned_pokemon:owned,active_party:party,version:Number(g?.version||1)+1});
    }
    w=await patchWild(id,{status:'cooldown',pokemon_id:null,expires_at:null,next_spawn_at:addHours(new Date(),3,8).toISOString(),attempt_workout_id:workout.id,last_result_pokemon:pokemonId,last_catch_success:success,last_outcome:success?'caught':'missed',version:Number(w.version||1)+1});
    return out({wild:w,benefits:benefit,attempted:true,success,pokemon_id:pokemonId,catch_chance:chance,registered_at:new Date(registeredAt).toISOString()});
  }catch(error){console.error(error);return out({error:'Server error'},500)}
});
