import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!;
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PIN=Deno.env.get('APP_PIN')||'1337';
const CREDIT_CUTOFF='2026-08-17T13:33:00.000Z';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});

async function api(path:string,init:RequestInit={}){
  const r=await fetch(`${U}/rest/v1${path}`,{...init,headers:{...H,...(init.headers||{})}});
  const text=await r.text();
  if(!r.ok)throw new Error(text||`REST ${r.status}`);
  return text?JSON.parse(text):null;
}
async function existsPlayer(id:string){const a=await api(`/players?id=eq.${encodeURIComponent(id)}&select=id&limit=1`);return !!a?.[0]}
async function gymState(id:string){const a=await api(`/gym_player_state?player_id=eq.${encodeURIComponent(id)}&select=current_cycle,current_leader,leader_defeated&limit=1`);return a?.[0]||null}

type Credit={workout_id:string;workout_type:string;claimed_at:string};
async function available(id:string,level:number):Promise<Credit[]>{
  if(level<3)return [];
  const rewards=await api(`/workout_reward_claims?player_id=eq.${encodeURIComponent(id)}&first_workout_id=not.is.null&claimed_at=gte.${encodeURIComponent(CREDIT_CUTOFF)}&select=first_workout_id,workout_type,claimed_at&order=claimed_at.asc`)||[];
  if(!rewards.length)return [];
  const spent=await api(`/gym_attack_claims?player_id=eq.${encodeURIComponent(id)}&select=workout_id`)||[];
  const used=new Set(spent.map((r:any)=>String(r.workout_id)));
  return rewards.map((r:any)=>({workout_id:String(r.first_workout_id||''),workout_type:String(r.workout_type||'strength'),claimed_at:String(r.claimed_at||'')})).filter((r:Credit)=>r.workout_id&&!used.has(r.workout_id));
}
async function status(id:string,level:number,workoutId=''){
  const credits=await available(id,level);
  const current=await gymState(id);
  const target=workoutId?credits.find(c=>c.workout_id===workoutId)||null:null;
  return {ok:true,cutoff:CREDIT_CUTOFF,count:credits.length,next:credits[0]||null,fresh_eligible:!!target,fresh:target,gym:{cycle:Number(current?.current_cycle||0),leader:Number(current?.current_leader||0),leader_defeated:!!current?.leader_defeated}};
}
async function claim(id:string,level:number,workoutId:string){
  if(!workoutId)return out({error:'workout_id required'},400);
  const credits=await available(id,level);
  const credit=credits.find(c=>c.workout_id===workoutId);
  if(!credit)return out({error:'Attack credit is no longer available',claimed:false,...await status(id,level)},409);
  const s=await gymState(id);
  const cycle=Math.max(1,Number(s?.current_cycle)||1);
  try{
    const rows=await api('/gym_attack_claims',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workout_id:workoutId,player_id:id,cycle})});
    return out({claimed:true,claim:rows?.[0]||null,...await status(id,level)});
  }catch(error){
    console.warn('gym credit claim conflict',error);
    return out({error:'Attack credit already used',claimed:false,...await status(id,level)},409);
  }
}
async function release(id:string,workoutId:string){
  if(!workoutId)return out({error:'workout_id required'},400);
  await api(`/gym_attack_claims?player_id=eq.${encodeURIComponent(id)}&workout_id=eq.${encodeURIComponent(workoutId)}`,{method:'DELETE'});
  return out({released:true});
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,service:'gym-attack-credits-preview-v2',cutoff:CREDIT_CUTOFF});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json();
    if(String(b.pin||'')!==PIN)return out({error:'Feil PIN'},403);
    const id=String(b.player_id||'');
    if(!id||!await existsPlayer(id))return out({error:'Spiller finnes ikke'},404);
    const level=Math.max(1,Math.floor(Number(b.level)||1));
    if(b.action==='status')return out(await status(id,level,String(b.workout_id||'')));
    if(b.action==='claim')return await claim(id,level,String(b.workout_id||''));
    if(b.action==='release')return await release(id,String(b.workout_id||''));
    return out({error:'Bad request'},400);
  }catch(error){console.error(error);return out({error:'Server error'},500)}
});
