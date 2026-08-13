import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL');
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const PIN=Deno.env.get('APP_PIN')||'1337';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});
const nums=(v,min=1,max=151)=>[...new Set((Array.isArray(v)?v:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=min&&n<=max))];
const strs=v=>[...new Set((Array.isArray(v)?v:[]).map(String).filter(Boolean))];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rand=n=>Math.floor(Math.random()*n);
const sample=(arr,n)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)};
const STRONG=[3,9,26,131,143,148,95,94,93,92,135,133,59,34,31,130,144,145,146,123,141,25,6];
const STRONG_SET=new Set(STRONG);
const ELITE=[149,150,151];
const ELITE_SET=new Set(ELITE);
const AUTO_ORDER=['discipline','power','engine','grit'];
const TIER_NAMES=['LOW','MEDIUM','HIGH','MAX'];
const ENGINE_EXTRA=[0,1,1,2];
const SNIPE_CHANCE=[.25,.50,.75,1];
const GRIT_RARE=[.01,.02,.04,.06];
const POWER_RESCUE=[.30,.50,.70,1];

async function api(path,init={}){const r=await fetch(`${U}/rest/v1${path}`,{...init,headers:{...H,...(init.headers||{})}}),t=await r.text();if(!r.ok)throw new Error(t);return t?JSON.parse(t):null}
async function player(id){const a=await api(`/players?id=eq.${encodeURIComponent(id)}&select=id,name,stats_alloc,starter_pokemon&limit=1`);return a?.[0]}
async function workoutRows(id){return await api(`/workouts?player_id=eq.${encodeURIComponent(id)}&select=id,workout_type,created_at&order=created_at.asc`)||[]}
async function state(id){let a=await api(`/gym_player_state?player_id=eq.${encodeURIComponent(id)}&select=*&limit=1`);if(a?.[0])return a[0];a=await api('/gym_player_state',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({player_id:id,current_cycle:0,current_leader:0,damage:0,leader_defeated:false,initial_round_complete:false})});return a[0]}
async function patchState(id,body){const a=await api(`/gym_player_state?player_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...body,updated_at:new Date().toISOString()})});return a[0]}
async function wildState(id){const a=await api(`/wild_pokemon_state?player_id=eq.${encodeURIComponent(id)}&select=*&limit=1`);return a?.[0]||null}
async function patchWild(id,body){const a=await api(`/wild_pokemon_state?player_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...body,updated_at:new Date().toISOString()})});return a[0]}
async function insertWild(id,body){const a=await api('/wild_pokemon_state',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({player_id:id,...body})});return a[0]}

function osloDay(ts){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts))}catch{return String(ts).slice(0,10)}}
function autoStats(level){const out={power:0,engine:0,discipline:0,grit:0};for(let l=2;l<=level;l++)out[AUTO_ORDER[(l-2)%AUTO_ORDER.length]]++;return out}
function tierIndex(value){return value>=23?3:value>=15?2:value>=8?1:0}
async function benefitsFor(id,level){
  const p=await player(id),rows=await workoutRows(id),alloc=p?.stats_alloc||{},auto=autoStats(level);
  const strength=rows.filter(r=>r.workout_type==='strength').length;
  const cardio=rows.filter(r=>r.workout_type==='cardio').length;
  const days=new Set(rows.map(r=>osloDay(r.created_at))).size;
  const values={
    power:1+(Number(auto.power)||0)+(Number(alloc.power)||0)+strength*.45,
    engine:1+(Number(auto.engine)||0)+(Number(alloc.engine)||0)+cardio*.45,
    discipline:1+(Number(auto.discipline)||0)+(Number(alloc.discipline)||0)+days*.12,
    grit:1+(Number(auto.grit)||0)+(Number(alloc.grit)||0)+(strength+cardio)*.15
  };
  const idx={};for(const k of Object.keys(values))idx[k]=tierIndex(values[k]);
  const powerRescue=POWER_RESCUE[idx.power],effectiveCatch=.5+.5*powerRescue;
  return {
    values,
    tiers:{
      power:{index:idx.power,label:TIER_NAMES[idx.power],rescue:powerRescue,effective_catch:effectiveCatch},
      engine:{index:idx.engine,label:TIER_NAMES[idx.engine],extra_shuffle:ENGINE_EXTRA[idx.engine]},
      discipline:{index:idx.discipline,label:TIER_NAMES[idx.discipline],snipe_chance:SNIPE_CHANCE[idx.discipline]},
      grit:{index:idx.grit,label:TIER_NAMES[idx.grit],rare_bonus:GRIT_RARE[idx.grit]}
    }
  };
}

function randomLootCount(cycle){if(cycle===1)return 3;if(cycle===2)return 5;const r=rand(100);return r<15?1:r<50?2:r<85?3:4}
function chooseWeighted(pool,gritBonus){
  if(!pool.length)return null;
  const rare=pool.filter(id=>STRONG_SET.has(id));
  if(rare.length&&Math.random()<gritBonus)return rare[rand(rare.length)];
  return pool[rand(pool.length)];
}
function lootFor(s,level,cycle,benefits){
  const owned=nums(s.owned_pokemon),complete=owned.length>=151,count=randomLootCount(cycle),all=Array.from({length:151},(_,i)=>i+1);
  if(complete)return sample(all,count);
  const missing=all.filter(id=>!owned.includes(id));
  let allowed=missing.filter(id=>!ELITE_SET.has(id)||level>=8).filter(id=>!STRONG_SET.has(id)||level>=5);
  const forced=[];
  if(cycle===2){const strongMissing=STRONG.filter(id=>!owned.includes(id)),pool=strongMissing.length?strongMissing:STRONG;if(pool.length)forced.push(pool[rand(pool.length)])}
  if(level>=10&&!owned.includes(151)&&!forced.includes(151))forced.push(151);
  const out=[...new Set(forced)].slice(0,count);
  allowed=allowed.filter(id=>!out.includes(id));
  while(out.length<count&&allowed.length){
    const id=chooseWeighted(allowed,Number(benefits?.tiers?.grit?.rare_bonus)||0);
    if(id==null)break;
    out.push(id);allowed=allowed.filter(x=>x!==id);
  }
  if(out.length<count){const fallback=missing.filter(id=>!out.includes(id));out.push(...sample(fallback,count-out.length))}
  return out.slice(0,count);
}

async function ensureEncounter(id,level){
  let s=await state(id),changed=false;
  const benefits=await benefitsFor(id,level);
  if(level>=3&&Number(s.current_cycle||0)<1){
    s={...s,current_cycle:1,current_leader:0,damage:0,leader_defeated:false,current_loot:lootFor(s,level,1,benefits),seen_leaders:[...new Set([...nums(s.seen_leaders,0,7),0])]};
    changed=true;
  }else if(level>=3&&Number(s.current_cycle||0)>=1&&!nums(s.current_loot).length&&nums(s.owned_pokemon).length<151){
    s={...s,current_loot:lootFor(s,level,Number(s.current_cycle||1),benefits)};changed=true;
  }
  if(changed)s=await patchState(id,{...s,version:Number(s.version||1)+1});
  return s;
}

async function save(id,b,level){
  const s=await ensureEncounter(id,level);
  const benefits=await benefitsFor(id,level);
  const oldOwned=nums(s.owned_pokemon);
  let requestedOwned=b.owned_pokemon===undefined?oldOwned:nums(b.owned_pokemon);
  const seen=[...new Set([...nums(s.seen_leaders,0,7),...nums(b.seen_leaders,0,7)])].sort((a,b)=>a-b);
  const defeated=[...new Set([...nums(s.defeated_leaders,0,7),...nums(b.defeated_leaders,0,7)])].sort((a,b)=>a-b);
  const requestedAttacks=b.attacks===undefined?strs(s.attacks):strs(b.attacks);
  const oldCycle=Math.max(0,Number(s.current_cycle)||0),requestedCycle=Math.max(0,Number(b.current_cycle??oldCycle)||0);
  const validAdvance=requestedCycle===oldCycle+1&&!!s.leader_defeated;
  let currentCycle=oldCycle,currentLeader=clamp(Number(s.current_leader)||0,0,7),currentLoot=nums(s.current_loot),initialComplete=!!s.initial_round_complete,damage=Math.max(0,Math.round(Number(b.damage??s.damage)||0)),leaderDefeated=b.leader_defeated===undefined?!!s.leader_defeated:!!b.leader_defeated;
  let pendingCycle=s.pending_victory_cycle??null,pendingLeader=s.pending_victory_leader??null,pendingLoot=nums(s.pending_victory_loot),pendingResolved=s.pending_victory_resolved_at||null,pendingAwards=nums(s.pending_victory_awards),pendingShuffle=nums(s.pending_victory_shuffle),pendingSnipeTarget=s.pending_victory_snipe_target??null,pendingSnipeSuccess=s.pending_victory_snipe_success??null;

  const newlyDefeated=!s.leader_defeated&&leaderDefeated;
  if(newlyDefeated){
    pendingCycle=oldCycle;pendingLeader=currentLeader;pendingLoot=[...currentLoot];pendingResolved=null;pendingAwards=[];pendingShuffle=[];pendingSnipeTarget=null;pendingSnipeSuccess=null;
  }
  if(validAdvance&&pendingLoot.length&&!pendingResolved){
    requestedOwned=requestedOwned.filter(id=>!pendingLoot.includes(id));
  }
  const owned=[...new Set([...oldOwned,...requestedOwned])].sort((a,b)=>a-b);
  const requestedParty=b.active_party===undefined?nums(s.active_party):nums(b.active_party);
  const party=requestedParty.filter(n=>owned.includes(n)).slice(0,6);

  if(validAdvance){
    currentCycle=requestedCycle;
    currentLeader=clamp(Number(b.current_leader??currentLeader)||0,0,7);
    initialComplete=!!b.initial_round_complete;
    damage=0;leaderDefeated=false;
    const virtualOwned=[...new Set([...owned,...pendingLoot])];
    currentLoot=lootFor({...s,owned_pokemon:virtualOwned},level,currentCycle,benefits);
  }
  const body={
    owned_pokemon:owned,seen_leaders:seen,defeated_leaders:defeated,active_party:party,
    attacks:(requestedAttacks.length?requestedAttacks:['basic']).slice(0,3),
    pending_attack:b.pending_attack===undefined?s.pending_attack:(b.pending_attack?String(b.pending_attack):null),
    current_cycle:currentCycle,current_loot:currentLoot,current_leader:currentLeader,initial_round_complete:initialComplete,damage,leader_defeated:leaderDefeated,
    pending_victory_cycle:pendingCycle,pending_victory_leader:pendingLeader,pending_victory_loot:pendingLoot,
    pending_victory_resolved_at:pendingResolved,pending_victory_awards:pendingAwards,pending_victory_shuffle:pendingShuffle,
    pending_victory_snipe_target:pendingSnipeTarget,pending_victory_snipe_success:pendingSnipeSuccess,
    version:Number(s.version||1)+1
  };
  return await patchState(id,body);
}

async function markFirstFight(id,level){
  const s=await ensureEncounter(id,level);
  if(s.first_gym_fight_at)return s;
  return await patchState(id,{first_gym_fight_at:new Date().toISOString(),version:Number(s.version||1)+1});
}
async function unlockGymdex(id,level){
  const s=await ensureEncounter(id,level);
  if(s.gymdex_unlocked_at)return s;
  return await patchState(id,{gymdex_unlocked_at:new Date().toISOString(),version:Number(s.version||1)+1});
}
async function victoryStatus(id,level){
  const s=await ensureEncounter(id,level),benefits=await benefitsFor(id,level);
  return {player:s,benefits,pending:{
    cycle:s.pending_victory_cycle??null,leader:s.pending_victory_leader??null,loot:nums(s.pending_victory_loot),
    resolved_at:s.pending_victory_resolved_at||null,awards:nums(s.pending_victory_awards),shuffle:nums(s.pending_victory_shuffle),
    snipe_target:s.pending_victory_snipe_target??null,snipe_success:s.pending_victory_snipe_success??null
  }};
}
async function resolveVictory(id,level,snipeTarget){
  let s=await ensureEncounter(id,level),loot=nums(s.pending_victory_loot);
  const benefits=await benefitsFor(id,level);
  if(!loot.length)return {player:s,benefits,pending:null};
  if(s.pending_victory_resolved_at)return await victoryStatus(id,level);
  const requested=Number(snipeTarget);
  const target=loot.includes(requested)?requested:null;
  const chance=Number(benefits.tiers.discipline.snipe_chance)||0;
  const snipeSuccess=target!=null&&Math.random()<chance;
  let pool=loot.filter(id=>!(snipeSuccess&&id===target));
  const shuffleCount=Math.min(pool.length,1+(Number(benefits.tiers.engine.extra_shuffle)||0));
  const shuffle=sample(pool,shuffleCount);
  const awards=[...new Set([...(snipeSuccess?[target]:[]),...shuffle])];
  const owned=[...new Set([...nums(s.owned_pokemon),...awards])].sort((a,b)=>a-b);
  const party=nums(s.active_party).filter(n=>owned.includes(n)).slice(0,6);
  for(const id of awards)if(party.length<6&&!party.includes(id))party.push(id);
  s=await patchState(id,{
    owned_pokemon:owned,active_party:party,
    pending_victory_resolved_at:new Date().toISOString(),
    pending_victory_awards:awards,pending_victory_shuffle:shuffle,
    pending_victory_snipe_target:target,pending_victory_snipe_success:target==null?null:snipeSuccess,
    version:Number(s.version||1)+1
  });
  return await victoryStatus(id,level);
}

function wildEligible(level){
  const all=Array.from({length:151},(_,i)=>i+1);
  return all.filter(id=>!ELITE_SET.has(id)||level>=8).filter(id=>!STRONG_SET.has(id)||level>=5);
}
async function chooseWild(id,level){
  const g=await state(id),owned=nums(g.owned_pokemon),allowed=wildEligible(level);
  const missing=allowed.filter(n=>!owned.includes(n));
  const pool=missing.length?missing:allowed;
  return pool.length?pool[rand(pool.length)]:1;
}
function addHours(date,minHours,maxHours){
  const span=Math.floor((minHours+Math.random()*(maxHours-minHours))*60);
  return new Date(date.getTime()+span*60000);
}
async function spawnWild(id,level,existing,lastOutcome=null){
  const now=new Date(),pokemonId=await chooseWild(id,level),expires=addHours(now,48,72);
  const body={status:'active',pokemon_id:pokemonId,appeared_at:now.toISOString(),expires_at:expires.toISOString(),next_spawn_at:null,attempt_workout_id:null,last_outcome:lastOutcome,version:Number(existing?.version||0)+1};
  return existing?await patchWild(id,body):await insertWild(id,body);
}
async function ensureWild(id,level){
  let w=await wildState(id);
  if(!w)return await spawnWild(id,level,null,null);
  const now=Date.now();
  if(w.status==='active'&&w.expires_at&&new Date(w.expires_at).getTime()<=now)return await spawnWild(id,level,w,'fled');
  if(w.status==='cooldown'&&w.next_spawn_at&&new Date(w.next_spawn_at).getTime()<=now)return await spawnWild(id,level,w,w.last_outcome||null);
  return w;
}
async function wildStatus(id,level){
  const w=await ensureWild(id,level),benefits=await benefitsFor(id,level);
  return {wild:w,benefits};
}
async function wildAttempt(id,level,workoutId){
  let w=await ensureWild(id,level);
  const benefits=await benefitsFor(id,level);
  if(w.status!=='active'||!w.pokemon_id)return {wild:w,benefits,attempted:false};
  const now=Date.now(),appeared=new Date(w.appeared_at||0).getTime(),expires=new Date(w.expires_at||0).getTime();
  if(now>expires){w=await spawnWild(id,level,w,'fled');return {wild:w,benefits,attempted:false,expired:true}}
  const rows=await api(`/workouts?id=eq.${encodeURIComponent(String(workoutId||''))}&player_id=eq.${encodeURIComponent(id)}&select=id,created_at&limit=1`);
  const workout=rows?.[0];
  if(!workout)return {wild:w,benefits,attempted:false,error:'Workout not found'};
  const wt=new Date(workout.created_at).getTime();
  if(wt<appeared||wt>expires)return {wild:w,benefits,attempted:false,error:'Workout outside encounter'};
  const pokemonId=Number(w.pokemon_id);
  const chance=Number(benefits.tiers.power.effective_catch)||.5;
  const success=Math.random()<chance;
  if(success){
    const g=await state(id),owned=[...new Set([...nums(g.owned_pokemon),pokemonId])].sort((a,b)=>a-b);
    await patchState(id,{owned_pokemon:owned,version:Number(g.version||1)+1});
  }
  const cooldownEnd=addHours(new Date(),3,8);
  w=await patchWild(id,{
    status:'cooldown',pokemon_id:null,expires_at:null,next_spawn_at:cooldownEnd.toISOString(),
    attempt_workout_id:workout.id,last_result_pokemon:pokemonId,last_catch_success:success,last_outcome:success?'caught':'missed',
    version:Number(w.version||1)+1
  });
  return {wild:w,benefits,attempted:true,success,pokemon_id:pokemonId,catch_chance:chance};
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,mode:'gym-wild-victory-v6-slower-stats'});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json();if(String(b.pin||'')!==PIN)return out({error:'Feil PIN'},403);
    const id=String(b.player_id||'');if(!id||!await player(id))return out({error:'Spiller finnes ikke'},404);
    const level=Math.max(1,Math.floor(Number(b.level)||1));
    if(b.action==='get')return out({player:await ensureEncounter(id,level),benefits:await benefitsFor(id,level)});
    if(b.action==='save_player')return out({player:await save(id,b.state||{},level)});
    if(b.action==='mark_first_fight')return out({player:await markFirstFight(id,level)});
    if(b.action==='unlock_gymdex')return out({player:await unlockGymdex(id,level)});
    if(b.action==='benefits')return out({benefits:await benefitsFor(id,level)});
    if(b.action==='victory_status')return out(await victoryStatus(id,level));
    if(b.action==='resolve_victory')return out(await resolveVictory(id,level,b.snipe_target));
    if(b.action==='wild_status')return out(await wildStatus(id,level));
    if(b.action==='wild_attempt')return out(await wildAttempt(id,level,b.workout_id));
    return out({error:'Bad request'},400);
  }catch(e){console.error(e);return out({error:'Server error'},500)}
});