import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_PIN = Deno.env.get('APP_PIN') || '1337';
const workoutsApi = `${SUPABASE_URL}/rest/v1/workouts`;
const playersApi = `${SUPABASE_URL}/rest/v1/players`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const jsonHeaders = {...cors, 'content-type':'application/json'};
const serviceHeaders = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

type Player = {
  id: string;
  name: string;
  character_set: number;
  pin: string;
  created_at?: string;
};

const normalizeName = (value: unknown) => String(value ?? '').trim();
const validPlayerPin = (value: unknown) => /^\d{4}$/.test(String(value ?? ''));

function osloYmd(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Europe/Oslo', year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(date);
  const v:any = {};
  for (const p of parts) if (p.type !== 'literal') v[p.type] = p.value;
  return `${v.year}-${v.month}-${v.day}`;
}

function weekKey(input: string | Date) {
  const d = input instanceof Date ? input : new Date(input);
  const ymd = osloYmd(d);
  const [y,m,day] = ymd.split('-').map(Number);
  const cal = new Date(Date.UTC(y,m-1,day));
  const dow = cal.getUTCDay() || 7;
  cal.setUTCDate(cal.getUTCDate() - (dow - 1));
  return cal.toISOString().slice(0,10);
}

async function fetchPlayersWithPins(): Promise<Player[]> {
  const r = await fetch(`${playersApi}?select=id,name,character_set,pin,created_at&order=created_at.asc`, {headers:serviceHeaders});
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

async function resolvePlayer(input: {player_id?: unknown; person?: unknown; name?: unknown}): Promise<Player | null> {
  if (input.player_id) {
    const r = await fetch(`${playersApi}?id=eq.${encodeURIComponent(String(input.player_id))}&select=id,name,character_set,pin,created_at&limit=1`, {headers:serviceHeaders});
    if (!r.ok) throw new Error(await r.text());
    const arr = await r.json();
    return arr[0] || null;
  }
  const wanted = normalizeName(input.person ?? input.name).toLocaleLowerCase('nb-NO');
  if (!wanted) return null;
  const players = await fetchPlayersWithPins();
  return players.find(p => normalizeName(p.name).toLocaleLowerCase('nb-NO') === wanted) || null;
}

async function authenticateAccessPin(value: unknown) {
  const pin = String(value ?? '');
  const master = pin === APP_PIN;
  const players = await fetchPlayersWithPins();
  const playerIds = players.filter(player => player.pin === pin).map(player => player.id);
  return {ok: master || playerIds.length > 0, master, player_ids: playerIds};
}

async function allRowsFor(playerId: string) {
  const r = await fetch(`${workoutsApi}?player_id=eq.${encodeURIComponent(playerId)}&select=id,player_id,person,workout_type,created_at&order=created_at.asc`, {headers:serviceHeaders});
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

async function ensureWeekCapacity(playerId: string, dateIso: string, excludeId?: string) {
  const rows = await allRowsFor(playerId);
  const targetWeek = weekKey(dateIso);
  const targetDay = osloYmd(new Date(dateIso));
  const days = new Set<string>();
  for (const row of rows) {
    if (row.id === excludeId) continue;
    if (weekKey(row.created_at) !== targetWeek) continue;
    days.add(osloYmd(new Date(row.created_at)));
  }
  if (days.has(targetDay)) return;
  if (days.size >= 7) throw new Error('WEEK_LIMIT');
}

async function ensureDailyTypeAvailable(playerId: string, dateIso: string, workoutType: string, excludeId?: string) {
  const rows = await allRowsFor(playerId);
  const targetDay = osloYmd(new Date(dateIso));
  const duplicate = rows.some(row =>
    row.id !== excludeId &&
    row.workout_type === workoutType &&
    osloYmd(new Date(row.created_at)) === targetDay
  );
  if (duplicate) throw new Error('DAILY_TYPE_LIMIT');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (req.method === 'GET') return new Response(JSON.stringify({ok:true,service:'training-tracker'}),{headers:jsonHeaders});
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:jsonHeaders});

  try {
    const body = await req.json();

    if (body.action === 'auth') {
      const access = await authenticateAccessPin(body.pin);
      if (!access.ok) return new Response(JSON.stringify({error:'Feil PIN'}),{status:403,headers:jsonHeaders});
      return new Response(JSON.stringify(access),{headers:jsonHeaders});
    }

    if (String(body.pin || '') !== APP_PIN) {
      return new Response(JSON.stringify({error:'Feil PIN'}),{status:403,headers:jsonHeaders});
    }

    if (body.action === 'list_players') {
      const r = await fetch(`${playersApi}?select=id,name,character_set,created_at&order=created_at.asc`,{headers:serviceHeaders});
      return new Response(await r.text(),{status:r.status,headers:jsonHeaders});
    }

    if (body.action === 'create_player') {
      const name = normalizeName(body.name);
      const characterSet = Number(body.character_set);
      const playerPin = String(body.player_pin ?? '');
      if (!name || name.length > 40 || ![1,2,3].includes(characterSet) || !validPlayerPin(playerPin)) {
        return new Response(JSON.stringify({error:'Ugyldig spillerdata'}),{status:400,headers:jsonHeaders});
      }
      const existing = await resolvePlayer({name});
      if (existing) return new Response(JSON.stringify({error:'Navnet er allerede i bruk'}),{status:409,headers:jsonHeaders});
      const r = await fetch(playersApi,{
        method:'POST',
        headers:{...serviceHeaders,'Prefer':'return=representation'},
        body:JSON.stringify({name,character_set:characterSet,pin:playerPin})
      });
      if (!r.ok) {
        const text = await r.text();
        if (r.status === 409 || text.includes('players_name_unique_ci')) {
          return new Response(JSON.stringify({error:'Navnet er allerede i bruk'}),{status:409,headers:jsonHeaders});
        }
        return new Response(text,{status:r.status,headers:jsonHeaders});
      }
      return new Response(await r.text(),{status:r.status,headers:jsonHeaders});
    }

    if (body.action === 'verify_player_pin') {
      const player = await resolvePlayer(body);
      if (!player) return new Response(JSON.stringify({error:'Spiller finnes ikke'}),{status:404,headers:jsonHeaders});
      const ok = String(body.player_pin ?? '') === player.pin;
      return new Response(JSON.stringify({ok}),{status:ok?200:403,headers:jsonHeaders});
    }

    if (body.action === 'change_player_pin') {
      const player = await resolvePlayer(body);
      if (!player) return new Response(JSON.stringify({error:'Spiller finnes ikke'}),{status:404,headers:jsonHeaders});
      if (String(body.current_pin ?? '') !== player.pin) {
        return new Response(JSON.stringify({error:'Feil spiller-PIN'}),{status:403,headers:jsonHeaders});
      }
      if (!validPlayerPin(body.new_pin)) {
        return new Response(JSON.stringify({error:'Ny PIN må være 4 tall'}),{status:400,headers:jsonHeaders});
      }
      const r = await fetch(`${playersApi}?id=eq.${encodeURIComponent(player.id)}`,{
        method:'PATCH', headers:{...serviceHeaders,'Prefer':'return=minimal'},
        body:JSON.stringify({pin:String(body.new_pin)})
      });
      return new Response(JSON.stringify({ok:r.ok}),{status:r.ok?200:r.status,headers:jsonHeaders});
    }

    if (body.action === 'delete_player') {
      const player = await resolvePlayer(body);
      if (!player) return new Response(JSON.stringify({error:'Spiller finnes ikke'}),{status:404,headers:jsonHeaders});
      if (String(body.player_pin ?? '') !== player.pin) {
        return new Response(JSON.stringify({error:'Feil spiller-PIN'}),{status:403,headers:jsonHeaders});
      }
      if (body.confirm !== 'DELETE_PLAYER') {
        return new Response(JSON.stringify({error:'Confirmation required'}),{status:400,headers:jsonHeaders});
      }
      const r = await fetch(`${playersApi}?id=eq.${encodeURIComponent(player.id)}`,{method:'DELETE',headers:serviceHeaders});
      return new Response(JSON.stringify({ok:r.ok}),{status:r.ok?200:r.status,headers:jsonHeaders});
    }

    if (body.action === 'list') {
      const r = await fetch(`${workoutsApi}?select=id,player_id,person,workout_type,created_at&order=created_at.desc`,{headers:serviceHeaders});
      return new Response(await r.text(),{status:r.status,headers:jsonHeaders});
    }

    if (body.action === 'add') {
      const player = await resolvePlayer(body);
      if (!player || !['strength','cardio'].includes(body.workout_type)) {
        return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
      }
      const createdAt = new Date().toISOString();
      try {
        await ensureDailyTypeAvailable(player.id, createdAt, body.workout_type);
        await ensureWeekCapacity(player.id, createdAt);
      }
      catch (e) {
        if (String(e).includes('DAILY_TYPE_LIMIT')) {
          const label = body.workout_type === 'strength' ? 'Styrke' : 'Kondis';
          return new Response(JSON.stringify({error:`${label} allerede registrert i dag`}),{status:409,headers:jsonHeaders});
        }
        if (String(e).includes('WEEK_LIMIT')) return new Response(JSON.stringify({error:'Maks 7 tellende treningsdager per uke'}),{status:409,headers:jsonHeaders});
        throw e;
      }
      const r = await fetch(workoutsApi,{
        method:'POST', headers:{...serviceHeaders,'Prefer':'return=representation'},
        body:JSON.stringify({player_id:player.id,person:player.name,workout_type:body.workout_type,created_at:createdAt})
      });
      return new Response(await r.text(),{status:r.status,headers:jsonHeaders});
    }

    if (body.action === 'undo') {
      const player = await resolvePlayer(body);
      if (!player) return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
      const q=await fetch(`${workoutsApi}?player_id=eq.${encodeURIComponent(player.id)}&select=id,created_at&order=created_at.desc&limit=1`,{headers:serviceHeaders});
      if(!q.ok) throw new Error(await q.text());
      const arr=await q.json();
      if(!arr.length || osloYmd(new Date(arr[0].created_at)) !== osloYmd(new Date())) {
        return new Response(JSON.stringify({ok:true,deleted:false,reason:'NO_WORKOUT_TODAY',message:'Ingen økter registrert i dag'}),{headers:jsonHeaders});
      }
      const r=await fetch(`${workoutsApi}?id=eq.${arr[0].id}`,{method:'DELETE',headers:serviceHeaders});
      return new Response(JSON.stringify({ok:r.ok,deleted:r.ok}),{status:r.ok?200:r.status,headers:jsonHeaders});
    }

    if (body.action === 'edit') {
      if (!body.id || !body.created_at) return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
      const q = await fetch(`${workoutsApi}?id=eq.${encodeURIComponent(body.id)}&select=id,player_id,person,workout_type,created_at&limit=1`,{headers:serviceHeaders});
      const arr = await q.json();
      if (!arr.length) return new Response(JSON.stringify({error:'Not found'}),{status:404,headers:jsonHeaders});
      const row = arr[0];
      const dt = new Date(body.created_at);
      if (Number.isNaN(dt.getTime())) return new Response(JSON.stringify({error:'Ugyldig dato'}),{status:400,headers:jsonHeaders});
      try {
        const originalDay = osloYmd(new Date(row.created_at));
        const targetDay = osloYmd(dt);
        if (targetDay !== originalDay) await ensureDailyTypeAvailable(row.player_id, dt.toISOString(), row.workout_type, row.id);
        await ensureWeekCapacity(row.player_id, dt.toISOString(), row.id);
      }
      catch (e) {
        if (String(e).includes('DAILY_TYPE_LIMIT')) {
          const label = row.workout_type === 'strength' ? 'styrkeøkt' : 'kondisøkt';
          return new Response(JSON.stringify({error:`Det finnes allerede en ${label} den dagen`}),{status:409,headers:jsonHeaders});
        }
        if (String(e).includes('WEEK_LIMIT')) return new Response(JSON.stringify({error:'Den uken har allerede 7 tellende treningsdager'}),{status:409,headers:jsonHeaders});
        throw e;
      }
      const r = await fetch(`${workoutsApi}?id=eq.${encodeURIComponent(body.id)}`,{
        method:'PATCH', headers:{...serviceHeaders,'Prefer':'return=representation'},
        body:JSON.stringify({created_at:dt.toISOString()})
      });
      return new Response(await r.text(),{status:r.status,headers:jsonHeaders});
    }

    if (body.action === 'delete') {
      if (!body.id) return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
      const r = await fetch(`${workoutsApi}?id=eq.${encodeURIComponent(body.id)}`,{method:'DELETE',headers:serviceHeaders});
      return new Response(JSON.stringify({ok:r.ok}),{status:r.ok?200:r.status,headers:jsonHeaders});
    }

    if (body.action === 'reset') {
      if (body.confirm !== 'RESET_ALL_WORKOUTS') return new Response(JSON.stringify({error:'Confirmation required'}),{status:400,headers:jsonHeaders});
      const r = await fetch(`${workoutsApi}?id=not.is.null`,{method:'DELETE',headers:serviceHeaders});
      return new Response(JSON.stringify({ok:r.ok}),{status:r.ok?200:r.status,headers:jsonHeaders});
    }

    return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({error:'Server error'}),{status:500,headers:jsonHeaders});
  }
});