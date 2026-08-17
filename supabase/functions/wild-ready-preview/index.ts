import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!;
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PIN=Deno.env.get('APP_PIN')||'1337';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});
async function api(path:string){const r=await fetch(`${U}/rest/v1${path}`,{headers:H}),t=await r.text();if(!r.ok)throw new Error(t);return t?JSON.parse(t):null}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,service:'wild-ready-preview-v1'});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json();
    if(String(b.pin||'')!==PIN)return out({error:'Feil PIN'},403);
    const id=String(b.player_id||'');if(!id)return out({error:'player_id required'},400);
    const players=await api(`/players?id=eq.${encodeURIComponent(id)}&select=id,starter_event_completed_at&limit=1`),p=players?.[0];
    if(!p)return out({error:'Spiller finnes ikke'},404);
    if(!p.starter_event_completed_at)return out({eligible:false,locked:true,wild:null});
    const rows=await api(`/wild_pokemon_state?player_id=eq.${encodeURIComponent(id)}&select=*&limit=1`),w=rows?.[0]||null;
    if(!w||w.status!=='active'||!w.pokemon_id||w.attempt_workout_id)return out({eligible:false,wild:w});
    const appeared=String(w.appeared_at||''),expires=String(w.expires_at||'');
    if(!appeared||!expires||new Date(expires).getTime()<=Date.now())return out({eligible:false,wild:w,expired:true});
    const claims=await api(`/workout_reward_claims?player_id=eq.${encodeURIComponent(id)}&first_workout_id=not.is.null&claimed_at=gte.${encodeURIComponent(appeared)}&claimed_at=lte.${encodeURIComponent(expires)}&select=first_workout_id,workout_type,claimed_at&order=claimed_at.asc&limit=1`),c=claims?.[0]||null;
    if(!c)return out({eligible:false,wild:w});
    return out({eligible:true,wild:w,workout_id:String(c.first_workout_id),workout_type:String(c.workout_type||''),registered_at:String(c.claimed_at||'')});
  }catch(error){console.error(error);return out({error:'Server error'},500)}
});
