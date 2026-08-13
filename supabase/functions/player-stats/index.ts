import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_PIN = Deno.env.get('APP_PIN') || '1337';
const playersApi = `${SUPABASE_URL}/rest/v1/players`;
const workoutsApi = `${SUPABASE_URL}/rest/v1/workouts`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const jsonHeaders = {...cors, 'content-type':'application/json'};
const serviceHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

const emptyAlloc = () => ({power:0,engine:0,discipline:0,grit:0});
const WEEK_XP=[0,4,7,10,12,13,14,15];
const RESPEC_LIMIT=10;

function normalizeAlloc(value: unknown) {
  const src = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const alloc = emptyAlloc();
  for (const key of Object.keys(alloc) as (keyof typeof alloc)[]) {
    const n = Number(src[key] ?? 0);
    if (!Number.isInteger(n) || n < 0) throw new Error('INVALID_ALLOC');
    alloc[key] = n;
  }
  return alloc;
}
function spentAp(alloc:ReturnType<typeof emptyAlloc>){return Object.values(alloc).reduce((a,b)=>a+b,0)}
function releasedAp(before:ReturnType<typeof emptyAlloc>,after:ReturnType<typeof emptyAlloc>){
  return (Object.keys(before) as (keyof typeof before)[]).reduce((sum,key)=>sum+Math.max(0,before[key]-after[key]),0);
}
function totalAp(level:number){return level<2?0:3+Math.max(0,level-2)*2}
function osloYmd(input:Date|string){
  const d=input instanceof Date?input:new Date(input);
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const v:any={};for(const p of parts)if(p.type!=='literal')v[p.type]=p.value;
  return `${v.year}-${v.month}-${v.day}`;
}
function mondayKey(input:Date|string){
  const s=osloYmd(input),[y,m,d]=s.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d)),dow=x.getUTCDay()||7;
  x.setUTCDate(x.getUTCDate()-(dow-1));return x.toISOString().slice(0,10);
}
function addDaysYmd(s:string,n:number){const [y,m,d]=s.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d+n));return x.toISOString().slice(0,10)}
function gained(days:number){return WEEK_XP[Math.max(0,Math.min(7,days||0))]}
function finalWeekXp(days:number){return days<=0?-6:gained(days)}
async function api(url:string,init:RequestInit={}){
  const r=await fetch(url,{...init,headers:{...serviceHeaders,...(init.headers||{})}}),t=await r.text();
  if(!r.ok)throw new Error(t||`REST ${r.status}`);return t?JSON.parse(t):null;
}
async function currentLevel(playerId:string){
  const rows=await api(`${workoutsApi}?player_id=eq.${encodeURIComponent(playerId)}&select=created_at&order=created_at.asc`)||[];
  if(!rows.length)return 1;
  const weeks=new Map<string,Set<string>>();
  for(const row of rows){const wk=mondayKey(row.created_at),day=osloYmd(row.created_at);if(!weeks.has(wk))weeks.set(wk,new Set());weeks.get(wk)!.add(day)}
  const keys=[...weeks.keys()].sort(),end=mondayKey(new Date());let xp=0,k=keys[0];
  while(k<=end){const days=weeks.get(k)?.size||0;xp+=k===end?gained(days):finalWeekXp(days);k=addDaysYmd(k,7)}
  return Math.floor(Math.max(0,xp)/10)+1;
}
async function getPlayer(playerId:string){
  const rows=await api(`${playersApi}?id=eq.${encodeURIComponent(playerId)}&select=id,stats_alloc,stats_build_open_level,stats_build_saved_level&limit=1`)||[];
  return rows[0]||null;
}
function responseState(row:any,level:number){
  const open=Number(row?.stats_build_open_level)||null,saved=Number(row?.stats_build_saved_level)||null;
  const alloc=normalizeAlloc(row?.stats_alloc),spent=spentAp(alloc),cap=totalAp(level);
  const buildOpen=level>=2&&open===level&&saved!==level;
  return {
    ok:true,
    stats_alloc:alloc,
    current_level:level,
    total_ap:cap,
    spent_ap:spent,
    unspent_ap:Math.max(0,cap-spent),
    can_allocate:level>=2&&spent<cap,
    build_open:buildOpen,
    respec_open:buildOpen,
    respec_limit:RESPEC_LIMIT,
    build_open_level:open,
    build_saved_level:saved,
    next_build_level:Math.max(level+1,(saved||1)+1)
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (req.method === 'GET') return new Response(JSON.stringify({ok:true,service:'player-stats-banked-ap-respec-v3'}),{headers:jsonHeaders});
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:jsonHeaders});

  try {
    const body = await req.json();
    if (String(body.pin || '') !== APP_PIN) return new Response(JSON.stringify({error:'Feil PIN'}),{status:403,headers:jsonHeaders});
    const playerId = String(body.player_id || '');
    if (!playerId) return new Response(JSON.stringify({error:'player_id required'}),{status:400,headers:jsonHeaders});
    const row=await getPlayer(playerId);if(!row)return new Response(JSON.stringify({error:'Spiller finnes ikke'}),{status:404,headers:jsonHeaders});
    const level=await currentLevel(playerId);

    if (body.action === 'get') return new Response(JSON.stringify(responseState(row,level)),{headers:jsonHeaders});

    if (body.action === 'unlock') {
      if(level<2)return new Response(JSON.stringify({...responseState(row,level),error:'Stats låses opp på Level 2'}),{headers:jsonHeaders});
      const saved=Number(row.stats_build_saved_level)||0;
      if(saved>=level)return new Response(JSON.stringify({...responseState(row,level),error:'Respec er allerede brukt på denne levelen'}),{headers:jsonHeaders});
      const rows=await api(`${playersApi}?id=eq.${encodeURIComponent(playerId)}`,{
        method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({stats_build_open_level:level})
      });
      return new Response(JSON.stringify(responseState(rows[0],level)),{headers:jsonHeaders});
    }

    if (body.action === 'set') {
      if(level<2)return new Response(JSON.stringify({...responseState(row,level),error:'Stats er ikke låst opp ennå'}),{status:409,headers:jsonHeaders});
      let alloc;
      try { alloc = normalizeAlloc(body.stats_alloc); }
      catch { return new Response(JSON.stringify({error:'Ugyldig stat-fordeling'}),{status:400,headers:jsonHeaders}); }

      const current=normalizeAlloc(row.stats_alloc),cap=totalAp(level),spent=spentAp(alloc);
      if(spent>cap)return new Response(JSON.stringify({error:`Du har kun ${cap} AP på Level ${level}`}),{status:400,headers:jsonHeaders});

      const open=Number(row.stats_build_open_level)||0,saved=Number(row.stats_build_saved_level)||0;
      const buildOpen=open===level&&saved!==level;
      const released=releasedAp(current,alloc);

      if(released>0&&!buildOpen){
        return new Response(JSON.stringify({...responseState(row,level),error:'Tildelte AP er låst. AP kan bare frigjøres ved level up.'}),{status:409,headers:jsonHeaders});
      }
      if(released>RESPEC_LIMIT){
        return new Response(JSON.stringify({...responseState(row,level),error:`Du kan maksimalt frigjøre ${RESPEC_LIMIT} AP per level up.`}),{status:400,headers:jsonHeaders});
      }

      const patch:any={stats_alloc:alloc};
      if(buildOpen){
        patch.stats_build_saved_level=level;
        patch.stats_build_open_level=null;
      }
      const rows = await api(`${playersApi}?id=eq.${encodeURIComponent(playerId)}`,{
        method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)
      });
      return new Response(JSON.stringify({...responseState(rows[0],level),respec_released:released,respec_consumed:buildOpen}),{headers:jsonHeaders});
    }

    return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({error:'Server error'}),{status:500,headers:jsonHeaders});
  }
});
