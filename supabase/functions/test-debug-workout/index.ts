import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!;
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});
const players=`${U}/rest/v1/players`,workouts=`${U}/rest/v1/workouts`,claims=`${U}/rest/v1/workout_reward_claims`;

function osloYmd(date:Date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),v:any={};for(const p of parts)if(p.type!=='literal')v[p.type]=p.value;return`${v.year}-${v.month}-${v.day}`}
function shiftYmd(value:string,days:number){const [y,m,d]=value.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d+days));return dt.toISOString().slice(0,10)}
const debugIso=(ymd:string)=>`${ymd}T12:00:00.000Z`;
async function api(url:string,init:RequestInit={}){const r=await fetch(url,{...init,headers:{...H,...(init.headers||{})}}),t=await r.text();if(!r.ok)throw new Error(t);return t?JSON.parse(t):null}
async function getTestPlayer(id:string){if(!id)return null;const a=await api(`${players}?id=eq.${encodeURIComponent(id)}&select=id,name&limit=1`),p=a?.[0];return p&&String(p.name||'').trim().toLocaleLowerCase('nb-NO')==='test'?p:null}
async function rows(id:string){return await api(`${workouts}?player_id=eq.${encodeURIComponent(id)}&select=id,created_at&order=created_at.asc`)}
async function nextDate(id:string){const a=await rows(id);if(!a.length)return new Date().toISOString();return debugIso(shiftYmd(osloYmd(new Date(a[0].created_at)),-1))}
async function claimReward(playerId:string,dateIso:string,type:string,workoutId:string){const rewardDate=osloYmd(new Date(dateIso));const r=await fetch(`${claims}?on_conflict=player_id,reward_date,workout_type`,{method:'POST',headers:{...H,'Prefer':'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({player_id:playerId,reward_date:rewardDate,workout_type:type,first_workout_id:workoutId})});const text=await r.text();if(!r.ok)throw new Error(text||'Reward claim failed');let a:any[]=[];try{a=text?JSON.parse(text):[]}catch{}return{reward_date:rewardDate,reward_eligible:Array.isArray(a)&&a.length>0}}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,service:'test-debug-workout'});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json(),id=String(b.player_id||''),p=await getTestPlayer(id);if(!p)return out({error:'Debug access only for player test'},403);
    if(b.action==='add'){
      const type=String(b.workout_type||'');if(!['strength','cardio'].includes(type))return out({error:'Bad request'},400);
      const created_at=await nextDate(id),a=await api(workouts,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({player_id:id,person:p.name,workout_type:type,created_at})}),workout=a?.[0]||null;
      let reward={reward_date:osloYmd(new Date(created_at)),reward_eligible:false};if(workout?.id){try{reward=await claimReward(id,created_at,type,workout.id)}catch(e){console.error('reward claim failed',e)}}
      return out({workout,...reward});
    }
    if(b.action==='undo'){const a=await rows(id);if(!a.length)return out({ok:true,deleted:false,reason:'NO_WORKOUT'});const target=a[0];await api(`${workouts}?id=eq.${encodeURIComponent(target.id)}`,{method:'DELETE'});return out({ok:true,deleted:true})}
    return out({error:'Bad request'},400);
  }catch(e){console.error(e);return out({error:'Server error'},500)}
});