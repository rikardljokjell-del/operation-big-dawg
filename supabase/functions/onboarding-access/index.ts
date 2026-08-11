import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!;
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ACCESS_PIN=Deno.env.get('ONBOARDING_ACCESS_PIN')||'0007';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'};
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const J={...C,'content-type':'application/json'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});
const players=`${U}/rest/v1/players`;
const NAME_RE=/^[\p{L}\p{N}][\p{L}\p{N} .'-]{0,39}$/u;

async function api(url:string,init:RequestInit={}){
  const r=await fetch(url,{...init,headers:{...H,...(init.headers||{})}}),text=await r.text();
  let data:any=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw Object.assign(new Error(typeof data==='string'?data:(data?.message||data?.error||text||'Request failed')),{status:r.status,data});
  return data;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});
  if(req.method==='GET')return out({ok:true,service:'onboarding-access'});
  if(req.method!=='POST')return out({error:'Method not allowed'},405);
  try{
    const b=await req.json(),pin=String(b.access_pin||'');
    if(pin!==ACCESS_PIN)return out({error:'Feil access-PIN'},403);
    if(b.action==='auth')return out({ok:true,onboarding:true});
    if(b.action!=='create_player')return out({error:'Onboarding-PIN kan bare brukes til å opprette ny spiller'},403);

    const name=String(b.name||'').trim(),characterSet=Number(b.character_set),playerPin=String(b.player_pin||'');
    if(!NAME_RE.test(name)||![1,2,3].includes(characterSet)||!/^\d{4}$/.test(playerPin))return out({error:'Ugyldig spillerdata'},400);
    if(playerPin===ACCESS_PIN)return out({error:'0007 er reservert som access-PIN. Velg en annen personlig PIN.'},400);

    try{
      const created=await api(players,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({name,character_set:characterSet,pin:playerPin})});
      return out(Array.isArray(created)?created[0]:created,201);
    }catch(e:any){
      const text=JSON.stringify(e?.data||{});
      if(e?.status===409||text.includes('players_name_unique_ci')||text.includes('duplicate key'))return out({error:'Navnet er allerede i bruk'},409);
      throw e;
    }
  }catch(e){console.error(e);return out({error:'Server error'},500)}
});
