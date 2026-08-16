import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_PIN = Deno.env.get('APP_PIN') || '1337';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const jsonHeaders = {...cors, 'content-type':'application/json', 'cache-control':'no-store'};
const serviceHeaders = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

type Player = {
  id:string;
  name:string;
  character_set:number;
  created_at:string;
};
type Workout = {
  id:string;
  player_id:string;
  workout_type:'strength'|'cardio';
  created_at:string;
};
type GymEvent = {
  player_id:string;
  damage:number;
  boss_ko:boolean;
  pokemon_id:number|null;
  steal_method:'snipe'|'random_shuffle'|null;
  occurred_at:string;
};
type WildEvent = {
  player_id:string;
  pokemon_id:number;
  captured_at:string;
};

const WEEK_XP=[0,4,7,10,12,13,14,15];
const GAMEPLAY_EVENTS_STARTED_ON='2026-08-16';
const STRONG=new Set([3,9,26,131,143,148,95,94,93,92,135,133,59,34,31,130,144,145,146,123,141,25,6]);
const ELITE=new Set([149,150,151]);
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:jsonHeaders});

async function api(path:string,init:RequestInit={}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1${path}`,{
    ...init,
    headers:{...serviceHeaders,...(init.headers||{})},
  });
  const text=await response.text();
  if(!response.ok)throw new Error(text||`REST ${response.status}`);
  return text?JSON.parse(text):null;
}

async function apiAll(path:string){
  const pageSize=1000;
  const rows:any[]=[];
  for(let offset=0;;offset+=pageSize){
    const page=await api(path,{headers:{Range:`${offset}-${offset+pageSize-1}`}});
    if(!Array.isArray(page))throw new Error('Expected a row collection');
    rows.push(...page);
    if(page.length<pageSize)return rows;
  }
}

function osloYmd(input:string|Date){
  const date=input instanceof Date?input:new Date(input);
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(date);
  const values:Record<string,string>={};
  for(const part of parts)if(part.type!=='literal')values[part.type]=part.value;
  return `${values.year}-${values.month}-${values.day}`;
}
function shiftYmd(value:string,days:number){
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day+days));
  return date.toISOString().slice(0,10);
}
function mondayKey(input:string|Date){
  const value=typeof input==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input)?input:osloYmd(input);
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day));
  const weekday=date.getUTCDay()||7;
  date.setUTCDate(date.getUTCDate()-(weekday-1));
  return date.toISOString().slice(0,10);
}
const latestCompletedWeek=(referenceDate=new Date())=>shiftYmd(mondayKey(referenceDate),-7);
const debugReferenceDate=()=>new Date(Date.now()+24*60*60*1000);
const isTestPlayer=(player:Player)=>player.name.trim().toLocaleLowerCase('nb-NO')==='test';
const rarity=(id:number)=>ELITE.has(id)?'elite':STRONG.has(id)?'strong':'normal';
const xpForDays=(days:number)=>days===0?-6:WEEK_XP[Math.max(0,Math.min(7,days))];
const playerListPath='/players?select=id,name,character_set,created_at&order=created_at.asc';

function playerFilter(ids:string[]){
  return `in.(${ids.map(encodeURIComponent).join(',')})`;
}

async function fetchWeeklyData(ids:string[],weekStart:string){
  const filter=playerFilter(ids);
  // Keep event reads bounded while leaving a full UTC-day margin around the
  // Oslo week. The final mondayKey filter below remains the source of truth.
  const eventStart=`${shiftYmd(weekStart,-1)}T00:00:00Z`;
  const eventEnd=`${shiftYmd(weekStart,8)}T00:00:00Z`;
  const [workouts,gym,wild]=await Promise.all([
    apiAll(`/workouts?player_id=${filter}&select=id,player_id,workout_type,created_at&order=created_at.asc,id.asc`),
    apiAll(`/gym_weekly_events?player_id=${filter}&occurred_at=gte.${encodeURIComponent(eventStart)}&occurred_at=lt.${encodeURIComponent(eventEnd)}&select=player_id,damage,boss_ko,pokemon_id,steal_method,occurred_at&order=occurred_at.asc,id.asc`),
    apiAll(`/wild_catch_events?player_id=${filter}&captured_at=gte.${encodeURIComponent(eventStart)}&captured_at=lt.${encodeURIComponent(eventEnd)}&select=player_id,pokemon_id,captured_at&order=captured_at.asc,id.asc`),
  ]);
  return{
    workouts:(Array.isArray(workouts)?workouts:[]) as Workout[],
    gym:(Array.isArray(gym)?gym:[]) as GymEvent[],
    wild:(Array.isArray(wild)?wild:[]) as WildEvent[],
  };
}

function sharedRanks<T extends object>(sorted:T[],same:(left:T,right:T)=>boolean):Array<T&{rank:number}>{
  let rank=0;
  return sorted.map((item,index)=>{
    if(index===0||!same(item,sorted[index-1]))rank=index+1;
    return{...item,rank};
  });
}

function streakThrough(daysByWeek:Map<string,number>,weekStart:string){
  let streak=0;
  for(let week=weekStart;(daysByWeek.get(week)||0)>=3;week=shiftYmd(week,-7))streak++;
  return streak;
}

function buildMotivation(player:Player,stats:any){
  const days=stats.training_days;
  if(days===0){
    return{
      tone:'wake-up',
      eyebrow:'COMEBACK WEEK',
      headline:`På tide å slå tilbake, ${player.name}.`,
      text:'Ingen tellende treningsdager forrige uke ga −6 XP. Ny uke, ny start – første treningsdag gir +4 XP.',
      next_goal:'Neste mål: 1 treningsdag',
    };
  }

  const focus=stats.strength>stats.cardio
    ?'Styrke dominerte.'
    :stats.cardio>stats.strength
      ?'Kondisjon dominerte.'
      :'Fin balanse mellom styrke og kondisjon.';
  const highlights:string[]=[];
  if(stats.streak_status==='continued')highlights.push(`${stats.streak} ukers streak lever videre`);
  else if(stats.streak_status==='started')highlights.push('ny streak er startet');
  if(stats.wild.elite>0)highlights.push(`${stats.wild.elite} Elite-fangst${stats.wild.elite===1?'':'er'}`);
  else if(stats.wild.strong>0)highlights.push(`${stats.wild.strong} Strong-fangst${stats.wild.strong===1?'':'er'}`);
  if(stats.gym.boss_ko>0)highlights.push(`${stats.gym.boss_ko} Gym Boss KO`);
  const extra=highlights.length?` ${highlights.slice(0,2).join(' · ')}.`:'';
  const headline=days>=6
    ?`Monsteruke, ${player.name}!`
    :days>=4
      ?`Sterk uke, ${player.name}!`
      :days>=3
        ?`Uka er sikret, ${player.name}!`
        :days===2
          ?`Bra trykk, ${player.name}.`
          :`Du kom i gang, ${player.name}.`;
  const goal=days>=7?7:Math.max(3,days+1);
  return{
    tone:days>=4?'elite':days>=3?'secured':'building',
    eyebrow:days>=3?'WEEK SECURED':'MOMENTUM BUILT',
    headline,
    text:`${days} treningsdag${days===1?'':'er'} og ${stats.workouts} økt${stats.workouts===1?'':'er'}. ${focus}${extra}`,
    next_goal:days>=7?'Neste mål: forsvar 7/7':'Neste mål: '+goal+' treningsdager',
  };
}

function createSnapshot(viewer:Player,selected:Player[],weekStart:string,data:{workouts:Workout[];gym:GymEvent[];wild:WildEvent[]}){
  const previousWeek=shiftYmd(weekStart,-7);
  const fourWeekStart=shiftYmd(weekStart,-21);
  const eightWeekStart=shiftYmd(weekStart,-49);

  const players=selected.map(player=>{
    const playerWorkouts=data.workouts.filter(row=>row.player_id===player.id&&mondayKey(row.created_at)<=weekStart);
    const targetWorkouts=playerWorkouts.filter(row=>mondayKey(row.created_at)===weekStart);
    const targetDays=[...new Set(targetWorkouts.map(row=>osloYmd(row.created_at)))];
    const daysByWeek=new Map<string,Set<string>>();
    for(const row of playerWorkouts){
      const week=mondayKey(row.created_at);
      if(!daysByWeek.has(week))daysByWeek.set(week,new Set());
      daysByWeek.get(week)!.add(osloYmd(row.created_at));
    }
    const dayCounts=new Map([...daysByWeek].map(([week,days])=>[week,days.size]));
    const streak=streakThrough(dayCounts,weekStart);
    const previousStreak=streakThrough(dayCounts,previousWeek);
    const streakStatus=targetDays.length>=3
      ?(previousStreak>0?'continued':'started')
      :(previousStreak>0?'broken':'none');

    const wildEvents=data.wild.filter(row=>row.player_id===player.id&&mondayKey(row.captured_at)===weekStart);
    const catches=wildEvents.map(row=>({pokemon_id:Number(row.pokemon_id),rarity:rarity(Number(row.pokemon_id))}));
    const gymEvents=data.gym.filter(row=>row.player_id===player.id&&mondayKey(row.occurred_at)===weekStart);
    const steals=gymEvents.filter(row=>row.pokemon_id!=null).map(row=>({
      pokemon_id:Number(row.pokemon_id),
      method:row.steal_method||'random_shuffle',
    }));
    const countTypes=(source:Workout[])=>({
      strength:source.filter(row=>row.workout_type==='strength').length,
      cardio:source.filter(row=>row.workout_type==='cardio').length,
    });
    const allTime=countTypes(playerWorkouts);
    const last4=countTypes(playerWorkouts.filter(row=>mondayKey(row.created_at)>=fourWeekStart));
    const last8=countTypes(playerWorkouts.filter(row=>mondayKey(row.created_at)>=eightWeekStart));

    return{
      id:player.id,
      name:player.name,
      character_set:Number(player.character_set)||1,
      training_days:targetDays.length,
      workouts:targetWorkouts.length,
      strength:targetWorkouts.filter(row=>row.workout_type==='strength').length,
      cardio:targetWorkouts.filter(row=>row.workout_type==='cardio').length,
      xp_delta:xpForDays(targetDays.length),
      streak,
      previous_streak:previousStreak,
      streak_status:streakStatus,
      wild:{
        total:catches.length,
        normal:catches.filter(catchItem=>catchItem.rarity==='normal').length,
        strong:catches.filter(catchItem=>catchItem.rarity==='strong').length,
        elite:catches.filter(catchItem=>catchItem.rarity==='elite').length,
        catches,
      },
      gym:{
        damage:gymEvents.reduce((sum,event)=>sum+Math.max(0,Number(event.damage)||0),0),
        boss_ko:gymEvents.filter(event=>event.boss_ko).length,
        stolen:steals,
        snipe:steals.filter(item=>item.method==='snipe').length,
        random_shuffle:steals.filter(item=>item.method==='random_shuffle').length,
      },
      history:{
        all_time:allTime,
        last_4_weeks:last4,
        last_8_weeks:last8,
        average_8_weeks:{
          strength:Number((last8.strength/8).toFixed(1)),
          cardio:Number((last8.cardio/8).toFixed(1)),
        },
      },
    };
  });

  const trainingRanking=sharedRanks(
    [...players].sort((left,right)=>right.training_days-left.training_days||right.workouts-left.workouts||left.name.localeCompare(right.name,'nb-NO')),
    (left,right)=>left.training_days===right.training_days,
  ).map(player=>({id:player.id,rank:player.rank}));
  const wildRanking=sharedRanks(
    [...players].sort((left,right)=>right.wild.total-left.wild.total||right.wild.elite-left.wild.elite||right.wild.strong-left.wild.strong||left.name.localeCompare(right.name,'nb-NO')),
    (left,right)=>left.wild.total===right.wild.total&&left.wild.elite===right.wild.elite&&left.wild.strong===right.wild.strong,
  ).map(player=>({id:player.id,rank:player.rank}));
  const viewerStats=players.find(player=>player.id===viewer.id)||players[0];

  return{
    schema_version:1,
    viewer_player_id:viewer.id,
    week:{start:weekStart,end:shiftYmd(weekStart,6)},
    coverage:{
      gameplay_events_complete:weekStart>=shiftYmd(mondayKey(GAMEPLAY_EVENTS_STARTED_ON),7),
      gameplay_events_started_on:GAMEPLAY_EVENTS_STARTED_ON,
    },
    motivation:buildMotivation(viewer,viewerStats),
    training_ranking:trainingRanking,
    wild_ranking:wildRanking,
    players,
  };
}

async function existingDelivery(viewerId:string,weekStart:string){
  const rows=await api(`/weekly_summary_deliveries?viewer_player_id=eq.${encodeURIComponent(viewerId)}&week_start=eq.${weekStart}&select=viewer_player_id,week_start,selected_player_ids,snapshot,generated_at,dismissed_at&limit=1`);
  return rows?.[0]||null;
}

async function saveDelivery(viewerId:string,weekStart:string,selectedIds:string[],snapshot:unknown){
  const rows=await api('/weekly_summary_deliveries?on_conflict=viewer_player_id,week_start',{
    method:'POST',
    headers:{Prefer:'resolution=merge-duplicates,return=representation'},
    body:JSON.stringify({
      viewer_player_id:viewerId,
      week_start:weekStart,
      selected_player_ids:selectedIds,
      snapshot,
      generated_at:new Date().toISOString(),
      dismissed_at:null,
      updated_at:new Date().toISOString(),
    }),
  });
  return rows?.[0]||null;
}

async function getSummary(body:any){
  const players=(await api(playerListPath)) as Player[];
  const viewer=players.find(player=>player.id===String(body.viewer_player_id||''));
  if(!viewer)return out({error:'Spiller finnes ikke'},404);
  const debug=isTestPlayer(viewer);
  const weekStart=latestCompletedWeek(debug?debugReferenceDate():new Date());
  const weekEnd=shiftYmd(weekStart,6);

  if(!debug&&osloYmd(viewer.created_at)>weekEnd)return out({show:false,reason:'PLAYER_CREATED_AFTER_WEEK',week_start:weekStart});

  const requested=Array.isArray(body.selected_player_ids)?body.selected_player_ids.map(String):[];
  const available=new Map(players.map(player=>[player.id,player]));
  const selectedIds=[viewer.id,...requested.filter(id=>id!==viewer.id&&available.has(id))];
  if(selectedIds.length===1){
    for(const player of players)if(player.id!==viewer.id&&selectedIds.length<6)selectedIds.push(player.id);
  }
  const uniqueIds=[...new Set(selectedIds)].slice(0,6);
  const selected=uniqueIds.map(id=>available.get(id)).filter(Boolean) as Player[];
  const delivery=await existingDelivery(viewer.id,weekStart);

  if(!debug&&delivery?.dismissed_at)return out({show:false,reason:'ALREADY_DISMISSED',week_start:weekStart});
  if(!debug&&delivery?.snapshot?.schema_version===1){
    return out({show:true,debug:false,generated_at:delivery.generated_at,summary:delivery.snapshot});
  }

  const data=await fetchWeeklyData(uniqueIds,weekStart);
  const snapshot=createSnapshot(viewer,selected,weekStart,data);
  if(!debug)await saveDelivery(viewer.id,weekStart,uniqueIds,snapshot);
  return out({show:true,debug,generated_at:new Date().toISOString(),summary:snapshot});
}

async function dismissSummary(body:any){
  const viewerId=String(body.viewer_player_id||'');
  const weekStart=String(body.week_start||'');
  if(!viewerId)return out({error:'Ugyldig sammendrag'},400);
  const players=(await api(`/players?id=eq.${encodeURIComponent(viewerId)}&select=id,name,character_set,created_at&limit=1`)) as Player[];
  const viewer=players?.[0];
  if(!viewer)return out({error:'Spiller finnes ikke'},404);
  const debug=isTestPlayer(viewer);
  const expectedWeek=latestCompletedWeek(debug?debugReferenceDate():new Date());
  if(weekStart!==expectedWeek)return out({error:'Ugyldig sammendrag'},400);
  if(debug)return out({ok:true,debug:true});

  const rows=await api(`/weekly_summary_deliveries?viewer_player_id=eq.${encodeURIComponent(viewerId)}&week_start=eq.${weekStart}`,{
    method:'PATCH',
    headers:{Prefer:'return=representation'},
    body:JSON.stringify({dismissed_at:new Date().toISOString(),updated_at:new Date().toISOString()}),
  });
  return out({ok:Array.isArray(rows)&&rows.length>0});
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method==='GET')return out({ok:true,service:'weekly-summary',schema_version:1});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const body=await req.json();
    if(String(body.pin||'')!==APP_PIN)return out({error:'Feil PIN'},403);
    if(body.action==='get')return await getSummary(body);
    if(body.action==='dismiss')return await dismissSummary(body);
    return out({error:'Bad request'},400);
  }catch(error){
    console.error('weekly-summary failed',error);
    return out({error:'Kunne ikke lage ukesammendrag'},500);
  }
});
