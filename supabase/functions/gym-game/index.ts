import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!;
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PIN=Deno.env.get('APP_PIN')||'1337';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});
const nums=(v:unknown,min=1,max=151)=>[...new Set((Array.isArray(v)?v:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=min&&n<=max))];
const strs=(v:unknown)=>[...new Set((Array.isArray(v)?v:[]).map(String).filter(Boolean))];
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const rand=(n:number)=>Math.floor(Math.random()*n);
const sample=(arr:number[],n:number)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)};
const STRONG=[3,9,26,131,143,148,95,94,93,92,135,133,59,34,31,130,144,145,146,123,141,25,6];
const STRONG_SET=new Set(STRONG);
const ELITE=[149,150,151];
const ELITE_SET=new Set(ELITE);

async function api(path:string,init:RequestInit={}){const r=await fetch(`${U}/rest/v1${path}`,{...init,headers:{...H,...(init.headers||{})}}),t=await r.text();if(!r.ok)throw new Error(t);return t?JSON.parse(t):null}
async function player(id:string){const a=await api(`/players?id=eq.${encodeURIComponent(id)}&select=id,name&limit=1`);return a?.[0]}
async function state(id:string){let a=await api(`/gym_player_state?player_id=eq.${encodeURIComponent(id)}&select=*&limit=1`);if(a?.[0])return a[0];a=await api('/gym_player_state',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({player_id:id,current_cycle:0,current_leader:0,damage:0,leader_defeated:false,initial_round_complete:false})});return a[0]}
async function patchState(id:string,body:any){const a=await api(`/gym_player_state?player_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...body,updated_at:new Date().toISOString()})});return a[0]}

function randomLootCount(cycle:number){if(cycle===1)return 3;if(cycle===2)return 5;const r=rand(100);return r<15?1:r<50?2:r<85?3:4}
function lootFor(s:any,level:number,cycle:number){
  const owned=nums(s.owned_pokemon),complete=owned.length>=151,count=randomLootCount(cycle),all=Array.from({length:151},(_,i)=>i+1);
  if(complete)return sample(all,count);
  const missing=all.filter(id=>!owned.includes(id));
  const allowed=missing.filter(id=>!ELITE_SET.has(id)||level>=8).filter(id=>!STRONG_SET.has(id)||level>=5);
  const forced:number[]=[];
  if(cycle===2){const strongMissing=STRONG.filter(id=>!owned.includes(id));const pool=strongMissing.length?strongMissing:STRONG;if(pool.length)forced.push(pool[rand(pool.length)])}
  if(level>=10&&!owned.includes(151)&&!forced.includes(151))forced.push(151);
  const forcedUnique=[...new Set(forced)].slice(0,count);
  let fillPool=allowed.filter(id=>!forcedUnique.includes(id));
  if(fillPool.length<count-forcedUnique.length)fillPool=missing.filter(id=>!forcedUnique.includes(id)&&(!ELITE_SET.has(id)||level>=8));
  const chosen=[...forcedUnique,...sample(fillPool,Math.min(count-forcedUnique.length,fillPool.length))];
  if(chosen.length<count){const fallback=missing.filter(id=>!chosen.includes(id));chosen.push(...sample(fallback,Math.min(count-chosen.length,fallback.length)))}
  return chosen.slice(0,count);
}

async function ensureEncounter(id:string,level:number){
  let s=await state(id),changed=false;
  if(level>=3&&Number(s.current_cycle||0)<1){s={...s,current_cycle:1,current_leader:0,damage:0,leader_defeated:false,current_loot:lootFor(s,level,1),seen_leaders:[...new Set([...nums(s.seen_leaders,0,7),0])]};changed=true}
  else if(level>=3&&Number(s.current_cycle||0)>=1&&!nums(s.current_loot).length&&nums(s.owned_pokemon).length<151){s={...s,current_loot:lootFor(s,level,Number(s.current_cycle||1))};changed=true}
  if(changed)s=await patchState(id,{...s,version:Number(s.version||1)+1});
  return s;
}

async function save(id:string,b:any,level:number){
  const s=await ensureEncounter(id,level);
  const owned=[...new Set([...nums(s.owned_pokemon),...nums(b.owned_pokemon)])].sort((a,b)=>a-b);
  const seen=[...new Set([...nums(s.seen_leaders,0,7),...nums(b.seen_leaders,0,7)])].sort((a,b)=>a-b);
  const defeated=[...new Set([...nums(s.defeated_leaders,0,7),...nums(b.defeated_leaders,0,7)])].sort((a,b)=>a-b);
  const requestedParty=b.active_party===undefined?nums(s.active_party):nums(b.active_party);
  const party=requestedParty.filter((n:number)=>owned.includes(n)).slice(0,6);
  const requestedAttacks=b.attacks===undefined?strs(s.attacks):strs(b.attacks);
  const oldCycle=Math.max(0,Number(s.current_cycle)||0),requestedCycle=Math.max(0,Number(b.current_cycle??oldCycle)||0);
  const validAdvance=requestedCycle===oldCycle+1&&!!s.leader_defeated;
  let currentCycle=oldCycle,currentLeader=clamp(Number(s.current_leader)||0,0,7),currentLoot=nums(s.current_loot),initialComplete=!!s.initial_round_complete,damage=Math.max(0,Math.round(Number(b.damage??s.damage)||0)),leaderDefeated=b.leader_defeated===undefined?!!s.leader_defeated:!!b.leader_defeated;
  if(validAdvance){currentCycle=requestedCycle;currentLeader=clamp(Number(b.current_leader??currentLeader)||0,0,7);initialComplete=!!b.initial_round_complete;damage=0;leaderDefeated=false;currentLoot=lootFor({...s,owned_pokemon:owned},level,currentCycle)}
  const body={owned_pokemon:owned,seen_leaders:seen,defeated_leaders:defeated,active_party:party,attacks:(requestedAttacks.length?requestedAttacks:['basic']).slice(0,3),pending_attack:b.pending_attack===undefined?s.pending_attack:(b.pending_attack?String(b.pending_attack):null),current_cycle:currentCycle,current_loot:currentLoot,current_leader:currentLeader,initial_round_complete:initialComplete,damage,leader_defeated:leaderDefeated,version:Number(s.version||1)+1};
  return await patchState(id,body);
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,mode:'per-player-server-loot'});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json();if(String(b.pin||'')!==PIN)return out({error:'Feil PIN'},403);
    const id=String(b.player_id||'');if(!id||!await player(id))return out({error:'Spiller finnes ikke'},404);
    const level=Math.max(1,Math.floor(Number(b.level)||1));
    if(b.action==='get')return out({player:await ensureEncounter(id,level)});
    if(b.action==='save_player')return out({player:await save(id,b.state||{},level)});
    return out({error:'Bad request'},400);
  }catch(e){console.error(e);return out({error:'Server error'},500)}
});