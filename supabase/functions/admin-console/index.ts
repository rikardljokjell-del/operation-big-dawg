import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!;
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_PIN=Deno.env.get('APP_PIN')||'1337';
const ADMIN_PIN=Deno.env.get('ADMIN_PIN')||'8008';
const ENVIRONMENT='production';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:J});
const enc=(value:unknown)=>encodeURIComponent(String(value??''));
const unique=(value:unknown)=>[...new Set((Array.isArray(value)?value:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=151))];

async function api(path:string,init:RequestInit={}){
  const response=await fetch(`${U}/rest/v1${path}`,{...init,headers:{...H,...(init.headers||{})}});
  const text=await response.text();let data:any=null;
  try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok)throw Object.assign(new Error(typeof data==='string'?data:(data?.message||data?.error||text||`REST ${response.status}`)),{status:response.status,data});
  return data;
}
async function audit(action:string,targetType:string,targetId:string|null,details:Record<string,unknown>={}){
  await api('/admin_audit_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({action,target_type:targetType,target_id:targetId,details:{environment:ENVIRONMENT,...details}})});
}
async function player(id:string){const rows=await api(`/players?id=eq.${enc(id)}&select=*&limit=1`);return rows?.[0]||null}
async function requirePlayer(id:string){const p=await player(id);if(!p)throw Object.assign(new Error('Spiller finnes ikke'),{status:404});return p}

function osloDay(input:string|Date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(input instanceof Date?input:new Date(input)),map:any={};for(const p of parts)if(p.type!=='literal')map[p.type]=p.value;return `${map.year}-${map.month}-${map.day}`}
function mondayKey(input:string|Date){const ymd=osloDay(input),[y,m,d]=ymd.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d)),dow=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()-(dow-1));return date.toISOString().slice(0,10)}
function shiftDay(value:string,days:number){const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d+days));return date.toISOString().slice(0,10)}
function xpFor(rows:any[]){if(!rows.length)return 0;const weeks=new Map<string,Set<string>>();for(const row of rows){const week=mondayKey(row.created_at),day=osloDay(row.created_at);if(!weeks.has(week))weeks.set(week,new Set());weeks.get(week)!.add(day)}const keys=[...weeks.keys()].sort(),current=mondayKey(new Date()),W=[0,4,7,10,12,13,14,15];let xp=0;for(let week=keys[0];week<=current;week=shiftDay(week,7)){const days=weeks.get(week)?.size||0;xp+=week===current?W[days]:(days?W[days]:-6)}return Math.max(0,xp)}

async function dashboard(){
  const [players,workouts,gyms,wild,notifications,receipts]=await Promise.all([
    api('/players?select=*&order=created_at.asc'),
    api('/workouts?select=id,player_id,workout_type,created_at&order=created_at.asc'),
    api('/gym_player_state?select=*'),
    api('/wild_pokemon_state?select=*'),
    api(`/admin_notifications?environment=eq.${ENVIRONMENT}&select=*&order=created_at.desc`),
    api('/admin_notification_receipts?select=notification_id,player_id,acknowledged_at')
  ]);
  const currentWeek=mondayKey(new Date());
  return{
    environment:ENVIRONMENT,
    players:(players||[]).map((p:any)=>{const rows=(workouts||[]).filter((w:any)=>w.player_id===p.id),gym=(gyms||[]).find((g:any)=>g.player_id===p.id)||null,wildState=(wild||[]).find((w:any)=>w.player_id===p.id)||null,xp=xpFor(rows),weekDays=new Set(rows.filter((w:any)=>mondayKey(w.created_at)===currentWeek).map((w:any)=>osloDay(w.created_at))).size;return{id:p.id,name:p.name,character_set:Number(p.character_set)||1,starter_pokemon:p.starter_pokemon?Number(p.starter_pokemon):null,starter_completed:!!p.starter_event_completed_at,xp,level:Math.floor(xp/10)+1,total_days:new Set(rows.map((w:any)=>osloDay(w.created_at))).size,week_days:weekDays,last_workout:rows.at(-1)?.created_at||null,gymdex_count:unique(gym?.owned_pokemon).length,gym_cycle:Number(gym?.current_cycle)||0,gym_leader:Number(gym?.current_leader)||0,gym_damage:Number(gym?.damage)||0,wild_status:wildState?.status||'locked',editable:true};}),
    notifications:(notifications||[]).map((n:any)=>({...n,read_count:(receipts||[]).filter((r:any)=>r.notification_id===n.id).length})),
    player_count:(players||[]).length
  };
}

function cleanNotification(body:any){const title=String(body.title||'').trim(),text=String(body.body||'').trim(),starts=new Date(body.starts_at),ends=new Date(body.ends_at);if(!title||title.length>100||!text||text.length>2000||Number.isNaN(starts.getTime())||Number.isNaN(ends.getTime())||ends<=starts)throw Object.assign(new Error('Kontroller tittel, tekst og tidsrom'),{status:400});return{title,body:text,starts_at:starts.toISOString(),ends_at:ends.toISOString(),updated_at:new Date().toISOString()}}
async function activeNotifications(playerId:string){if(!await player(playerId))throw Object.assign(new Error('Spiller finnes ikke'),{status:404});const now=new Date().toISOString(),rows=await api(`/admin_notifications?environment=eq.${ENVIRONMENT}&archived_at=is.null&starts_at=lte.${enc(now)}&ends_at=gt.${enc(now)}&select=*&order=starts_at.asc`),receipts=await api(`/admin_notification_receipts?player_id=eq.${enc(playerId)}&select=notification_id`),seen=new Set((receipts||[]).map((r:any)=>r.notification_id));return(rows||[]).filter((n:any)=>!seen.has(n.id))}

async function replaceStarter(playerId:string,nextStarter:number){
  if(![1,4,7].includes(nextStarter))throw Object.assign(new Error('Ugyldig starter-Pokémon'),{status:400});
  const p=await requirePlayer(playerId),gymRows=await api(`/gym_player_state?player_id=eq.${enc(playerId)}&select=*&limit=1`),gym=gymRows?.[0]||null,old=p.starter_pokemon?Number(p.starter_pokemon):null;
  const owned=[nextStarter,...unique(gym?.owned_pokemon).filter(id=>id!==old&&id!==nextStarter)].sort((a,b)=>a-b),party=[nextStarter,...unique(gym?.active_party).filter(id=>id!==old&&id!==nextStarter)].filter(id=>owned.includes(id)).slice(0,6);
  await api('/rpc/admin_apply_starter_change',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({p_player_id:playerId,p_next_starter:nextStarter,p_owned_pokemon:owned,p_active_party:party})});
  await audit('change_starter','player',playerId,{player:p.name,old_starter:old,new_starter:nextStarter});
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,service:'admin-console',environment:ENVIRONMENT});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json();
    if(b.action==='active_notifications'||b.action==='ack_notification'){
      if(String(b.pin||'')!==APP_PIN)return out({error:'Feil PIN'},403);
      const playerId=String(b.player_id||'');
      if(b.action==='active_notifications')return out({notifications:await activeNotifications(playerId)});
      const notificationId=String(b.notification_id||''),active=await activeNotifications(playerId);
      if(!active.some((n:any)=>n.id===notificationId))return out({ok:true,acknowledged:false});
      await api('/admin_notification_receipts?on_conflict=notification_id,player_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({notification_id:notificationId,player_id:playerId})});
      return out({ok:true,acknowledged:true});
    }

    if(String(b.admin_pin||'')!==ADMIN_PIN)return out({error:'Feil admin-PIN'},403);
    if(b.action==='login')return out({ok:true,environment:ENVIRONMENT});
    if(b.action==='dashboard')return out(await dashboard());
    if(b.action==='create_notification'){const payload={environment:ENVIRONMENT,...cleanNotification(b),created_at:new Date().toISOString()};const rows=await api('/admin_notifications',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)}),row=rows?.[0];await audit('publish_notification','notification',row?.id||null,{title:payload.title});return out({notification:row},201)}
    if(b.action==='update_notification'){const id=String(b.id||''),payload=cleanNotification(b),rows=await api(`/admin_notifications?id=eq.${enc(id)}&environment=eq.${ENVIRONMENT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});if(!rows?.length)return out({error:'Publikasjonen finnes ikke'},404);await audit('update_notification','notification',id,{title:payload.title});return out({notification:rows[0]})}
    if(b.action==='delete_notification'){const id=String(b.id||''),rows=await api(`/admin_notifications?id=eq.${enc(id)}&environment=eq.${ENVIRONMENT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({archived_at:new Date().toISOString(),updated_at:new Date().toISOString()})});if(!rows?.length)return out({error:'Publikasjonen finnes ikke'},404);await audit('archive_notification','notification',id);return out({ok:true})}
    if(b.action==='update_pin'){const id=String(b.player_id||''),p=await requirePlayer(id),pin=String(b.new_pin||'');if(!/^\d{4}$/.test(pin))return out({error:'PIN må være 4 tall'},400);await api(`/players?id=eq.${enc(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({pin,updated_at:new Date().toISOString()})});await audit('change_player_pin','player',id,{player:p.name});return out({ok:true})}
    if(b.action==='update_character'){const id=String(b.player_id||''),p=await requirePlayer(id),character=Number(b.character_set);if(![1,2,3].includes(character))return out({error:'Ugyldig karakter'},400);await api(`/players?id=eq.${enc(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({character_set:character,updated_at:new Date().toISOString()})});await audit('change_character','player',id,{player:p.name,character_set:character});return out({ok:true})}
    if(b.action==='update_starter'){await replaceStarter(String(b.player_id||''),Number(b.starter_pokemon));return out({ok:true})}
    if(b.action==='reset_game'){const id=String(b.player_id||''),p=await requirePlayer(id);await api('/rpc/admin_reset_player_game',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({p_player_id:id})});await audit('reset_game','player',id,{player:p.name});return out({ok:true})}
    if(b.action==='delete_player'){const id=String(b.player_id||''),p=await requirePlayer(id);if(String(b.confirm||'')!==p.name)return out({error:`Skriv ${p.name} for å bekrefte`},400);const players=await api('/players?select=id');if((players||[]).length<=1)return out({error:'Siste spiller kan ikke slettes'},409);await api(`/players?id=eq.${enc(id)}`,{method:'DELETE'});await audit('delete_player','player',id,{player:p.name});return out({ok:true})}
    return out({error:'Bad request'},400);
  }catch(error:any){console.error(error);return out({error:error?.message||'Server error'},Number(error?.status)||500)}
});
