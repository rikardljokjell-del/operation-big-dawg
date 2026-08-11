import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const U=Deno.env.get('SUPABASE_URL')!,K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,PIN=Deno.env.get('APP_PIN')||'1337';
const H={'apikey':K,'Authorization':`Bearer ${K}`,'Content-Type':'application/json'},C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'GET, POST, OPTIONS'},J={...C,'content-type':'application/json'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:J});
const nums=(v:unknown,min=1,max=151)=>[...new Set((Array.isArray(v)?v:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=min&&n<=max))];
const strs=(v:unknown)=>[...new Set((Array.isArray(v)?v:[]).map(String).filter(Boolean))];
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
async function api(path:string,init:RequestInit={}){const r=await fetch(`${U}/rest/v1${path}`,{...init,headers:{...H,...(init.headers||{})}}),t=await r.text();if(!r.ok)throw new Error(t);return t?JSON.parse(t):null}
async function player(id:string){const a=await api(`/players?id=eq.${encodeURIComponent(id)}&select=id,name&limit=1`);return a?.[0]}
async function state(id:string){let a=await api(`/gym_player_state?player_id=eq.${encodeURIComponent(id)}&select=*&limit=1`);if(a?.[0])return a[0];a=await api('/gym_player_state',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({player_id:id,current_cycle:0,current_leader:0,damage:0,leader_defeated:false,initial_round_complete:false})});return a[0]}
async function save(id:string,b:any){
  const s=await state(id);
  const owned=[...new Set([...nums(s.owned_pokemon),...nums(b.owned_pokemon)])].sort((a,b)=>a-b);
  const seen=[...new Set([...nums(s.seen_leaders,0,7),...nums(b.seen_leaders,0,7)])].sort((a,b)=>a-b);
  const defeated=[...new Set([...nums(s.defeated_leaders,0,7),...nums(b.defeated_leaders,0,7)])].sort((a,b)=>a-b);
  const requestedParty=b.active_party===undefined?nums(s.active_party):nums(b.active_party);
  const party=requestedParty.filter((n:number)=>owned.includes(n)).slice(0,6);
  const requestedAttacks=b.attacks===undefined?strs(s.attacks):strs(b.attacks);
  const body={owned_pokemon:owned,seen_leaders:seen,defeated_leaders:defeated,active_party:party,attacks:(requestedAttacks.length?requestedAttacks:['basic']).slice(0,3),pending_attack:b.pending_attack===undefined?s.pending_attack:(b.pending_attack?String(b.pending_attack):null),current_cycle:Math.max(0,Number(b.current_cycle??s.current_cycle)||0),current_loot:b.current_loot===undefined?nums(s.current_loot):nums(b.current_loot),current_leader:clamp(Number(b.current_leader??s.current_leader)||0,0,7),initial_round_complete:b.initial_round_complete===undefined?!!s.initial_round_complete:!!b.initial_round_complete,damage:Math.max(0,Math.round(Number(b.damage??s.damage)||0)),leader_defeated:b.leader_defeated===undefined?!!s.leader_defeated:!!b.leader_defeated,version:Number(s.version||1)+1,updated_at:new Date().toISOString()};
  const a=await api(`/gym_player_state?player_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});return a[0]
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:C});if(req.method==='GET')return out({ok:true,mode:'per-player'});if(req.method!=='POST')return out({error:'Method not allowed'},405);try{const b=await req.json();if(String(b.pin||'')!==PIN)return out({error:'Feil PIN'},403);const id=String(b.player_id||'');if(!id||!await player(id))return out({error:'Spiller finnes ikke'},404);if(b.action==='get')return out({player:await state(id)});if(b.action==='save_player')return out({player:await save(id,b.state||{})});return out({error:'Bad request'},400)}catch(e){console.error(e);return out({error:'Server error'},500)}});
