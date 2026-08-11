import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_PIN = Deno.env.get('APP_PIN') || '1337';
const playersApi = `${SUPABASE_URL}/rest/v1/players`;

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

function normalizeAlloc(value: unknown) {
  const src = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const alloc = emptyAlloc();
  for (const key of Object.keys(alloc) as (keyof typeof alloc)[]) {
    const n = Number(src[key] ?? 0);
    if (!Number.isInteger(n) || n < 0) throw new Error('INVALID_ALLOC');
    alloc[key] = n;
  }
  const spent = Object.values(alloc).reduce((a,b)=>a+b,0);
  if (spent > 19) throw new Error('INVALID_ALLOC');
  return alloc;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (req.method === 'GET') return new Response(JSON.stringify({ok:true,service:'player-stats'}),{headers:jsonHeaders});
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:jsonHeaders});

  try {
    const body = await req.json();
    if (String(body.pin || '') !== APP_PIN) {
      return new Response(JSON.stringify({error:'Feil PIN'}),{status:403,headers:jsonHeaders});
    }
    const playerId = String(body.player_id || '');
    if (!playerId) return new Response(JSON.stringify({error:'player_id required'}),{status:400,headers:jsonHeaders});

    if (body.action === 'get') {
      const r = await fetch(`${playersApi}?id=eq.${encodeURIComponent(playerId)}&select=id,stats_alloc&limit=1`,{headers:serviceHeaders});
      if (!r.ok) return new Response(await r.text(),{status:r.status,headers:jsonHeaders});
      const rows = await r.json();
      if (!rows.length) return new Response(JSON.stringify({error:'Spiller finnes ikke'}),{status:404,headers:jsonHeaders});
      return new Response(JSON.stringify({ok:true,stats_alloc:normalizeAlloc(rows[0].stats_alloc)}),{headers:jsonHeaders});
    }

    if (body.action === 'set') {
      let alloc;
      try { alloc = normalizeAlloc(body.stats_alloc); }
      catch { return new Response(JSON.stringify({error:'Ugyldig stat-fordeling'}),{status:400,headers:jsonHeaders}); }
      const r = await fetch(`${playersApi}?id=eq.${encodeURIComponent(playerId)}`,{
        method:'PATCH',
        headers:{...serviceHeaders,Prefer:'return=representation'},
        body:JSON.stringify({stats_alloc:alloc})
      });
      if (!r.ok) return new Response(await r.text(),{status:r.status,headers:jsonHeaders});
      const rows = await r.json();
      if (!rows.length) return new Response(JSON.stringify({error:'Spiller finnes ikke'}),{status:404,headers:jsonHeaders});
      return new Response(JSON.stringify({ok:true,stats_alloc:normalizeAlloc(rows[0].stats_alloc)}),{headers:jsonHeaders});
    }

    return new Response(JSON.stringify({error:'Bad request'}),{status:400,headers:jsonHeaders});
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({error:'Server error'}),{status:500,headers:jsonHeaders});
  }
});