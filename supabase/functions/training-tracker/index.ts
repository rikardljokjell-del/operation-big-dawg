import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const api = `${SUPABASE_URL}/rest/v1/workouts`;
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

async function allRowsFor(person: string) {
  const r = await fetch(`${api}?person=eq.${encodeURIComponent(person)}&select=id,person,workout_type,created_at&order=created_at.asc`, {headers:serviceHeaders});
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

async function ensureWeekCapacity(person: string, dateIso: string, excludeId?: string) {
  const rows = await allRowsFor(person);
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (req.method === 'GET') return new Response(JSON.stringify({ok:true,service:'training-tracker'}),{headers:jsonHeaders});
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:jsonHeaders});

  try {
    const body = await req.json();

    if (body.action === 'list') {
      const r = await fetch(`${api}?select=id,person,workout_type,created_at&order=created_at.desc`,{headers:serviceHeaders});
      return new Response(await r.text(),{status:r.status,headers:jsonHeaders});
    }

    if (body.action === 'add') {
      if (!['Rikard','Adrian'].includes(body.person) || !['strength','cardio'].includes(body.workout_type)) {
        return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
      }
      const createdAt = new Date().toISOString();
      try { await ensureWeekCapacity(body.person, createdAt); }
      catch (e) {
        if (String(e).includes('WEEK_LIMIT')) return new Response(JSON.stringify({error:'Maks 7 tellende treningsdager per uke'}),{status:409,headers:jsonHeaders});
        throw e;
      }
      const r = await fetch(api,{
        method:'POST', headers:{...serviceHeaders,'Prefer':'return=representation'},
        body:JSON.stringify({person:body.person,workout_type:body.workout_type,created_at:createdAt})
      });
      return new Response(await r.text(),{status:r.status,headers:jsonHeaders});
    }

    if (body.action === 'undo') {
      if (!['Rikard','Adrian'].includes(body.person)) return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
      const q=await fetch(`${api}?person=eq.${encodeURIComponent(body.person)}&select=id&order=created_at.desc&limit=1`,{headers:serviceHeaders});
      const arr=await q.json();
      if(!arr.length) return new Response(JSON.stringify({ok:true,deleted:false}),{headers:jsonHeaders});
      const r=await fetch(`${api}?id=eq.${arr[0].id}`,{method:'DELETE',headers:serviceHeaders});
      return new Response(JSON.stringify({ok:r.ok,deleted:r.ok}),{status:r.ok?200:r.status,headers:jsonHeaders});
    }

    if (body.action === 'edit') {
      if (!body.id || !body.created_at) return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
      const q = await fetch(`${api}?id=eq.${encodeURIComponent(body.id)}&select=id,person,workout_type,created_at&limit=1`,{headers:serviceHeaders});
      const arr = await q.json();
      if (!arr.length) return new Response(JSON.stringify({error:'Not found'}),{status:404,headers:jsonHeaders});
      const row = arr[0];
      const dt = new Date(body.created_at);
      if (Number.isNaN(dt.getTime())) return new Response(JSON.stringify({error:'Ugyldig dato'}),{status:400,headers:jsonHeaders});
      try { await ensureWeekCapacity(row.person, dt.toISOString(), row.id); }
      catch (e) {
        if (String(e).includes('WEEK_LIMIT')) return new Response(JSON.stringify({error:'Den uken har allerede 7 tellende treningsdager'}),{status:409,headers:jsonHeaders});
        throw e;
      }
      const r = await fetch(`${api}?id=eq.${encodeURIComponent(body.id)}`,{
        method:'PATCH', headers:{...serviceHeaders,'Prefer':'return=representation'},
        body:JSON.stringify({created_at:dt.toISOString()})
      });
      return new Response(await r.text(),{status:r.status,headers:jsonHeaders});
    }

    if (body.action === 'delete') {
      if (!body.id) return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
      const r = await fetch(`${api}?id=eq.${encodeURIComponent(body.id)}`,{method:'DELETE',headers:serviceHeaders});
      return new Response(JSON.stringify({ok:r.ok}),{status:r.ok?200:r.status,headers:jsonHeaders});
    }

    if (body.action === 'reset') {
      if (body.pin !== '1337') return new Response(JSON.stringify({error:'Feil PIN'}),{status:403,headers:jsonHeaders});
      if (body.confirm !== 'RESET_ALL_WORKOUTS') return new Response(JSON.stringify({error:'Confirmation required'}),{status:400,headers:jsonHeaders});
      const r = await fetch(`${api}?id=not.is.null`,{method:'DELETE',headers:serviceHeaders});
      return new Response(JSON.stringify({ok:r.ok}),{status:r.ok?200:r.status,headers:jsonHeaders});
    }

    return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({error:'Server error'}),{status:500,headers:jsonHeaders});
  }
});