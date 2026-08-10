const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/training-tracker';
const PEOPLE=['Rikard','Adrian'],RANKS=['Couch Recruit','Rep Collector','Hemorrhoid Pumper','Protein Junkie','Pump Chaser','Iron Disciple','Disciplined Lifter','Big Dawg','Meat Machine','Gym Warlord'];
const FORMS=[
{body:'#ef4444',shorts:'#334155',s:0.62,sh:14,ch:16,wa:10,arm:3,leg:3.5,h:'none',a:'none',p:'slouch'},
{body:'#f97316',shorts:'#1d4ed8',s:0.72,sh:16,ch:18,wa:11,arm:4,leg:4,h:'cap',a:'dumbbell',p:'left'},
{body:'#eab308',shorts:'#7c3aed',s:0.78,sh:18,ch:20,wa:11.5,arm:4.5,leg:4.3,h:'spike',a:'belt',p:'lean'},
{body:'#22c55e',shorts:'#be123c',s:0.84,sh:21,ch:23,wa:12,arm:5.2,leg:4.8,h:'mohawk',a:'shaker',p:'flex1'},
{body:'#06b6d4',shorts:'#0f766e',s:0.90,sh:24,ch:26,wa:13,arm:6,leg:5.2,h:'flow',a:'headband',p:'flex2'},
{body:'#3b82f6',shorts:'#1e40af',s:0.98,sh:28,ch:30,wa:14,arm:7,leg:5.8,h:'pony',a:'plate',p:'power'},
{body:'#8b5cf6',shorts:'#312e81',s:1.05,sh:32,ch:34,wa:15,arm:8,leg:6.2,h:'flat',a:'chain',p:'hero'},
{body:'#ec4899',shorts:'#9d174d',s:1.13,sh:37,ch:38,wa:16,arm:9.5,leg:6.8,h:'mane',a:'medal',p:'wide'},
{body:'#f59e0b',shorts:'#78350f',s:1.21,sh:42,ch:43,wa:18,arm:11,leg:7.6,h:'crest',a:'barbell',p:'massive'},
{body:'#a855f7',shorts:'#4c1d95',s:1.32,sh:48,ch:50,wa:20,arm:13,leg:8.4,h:'crown',a:'lightning',p:'boss'}];
let rows=[],busy=false,visibleHistory=10,editing=null,lastBadgeSet=new Set(),audioCtx,evoTimer=null;
const $=id=>document.getElementById(id);
function ensureAudio(){return audioCtx||(audioCtx=new(window.AudioContext||window.webkitAudioContext)())}
function beep(f=440,d=.12,t='square',s=0,v=.03){try{const c=ensureAudio(),o=c.createOscillator(),g=c.createGain();o.type=t;o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(c.destination);o.start(c.currentTime+s);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+s+d);o.stop(c.currentTime+s+d)}catch{}}
const levelSound=()=>[523,659,784,1047].forEach((f,i)=>beep(f,.12,'square',i*.11,.035)), achSound=()=>[392,523,659].forEach((f,i)=>beep(f,.12,'triangle',i*.1,.03));
const osloParts=d=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
const ymd=i=>{const v=osloParts(i instanceof Date?i:new Date(i));return `${v.year}-${v.month}-${v.day}`}, mondayKey=i=>{const s=ymd(i instanceof Date?i:new Date(i)),[y,m,d]=s.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d)),dow=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()-(dow-1));return x.toISOString().slice(0,10)}, addDaysYmd=(s,n)=>{const [y,m,d]=s.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d+n));return x.toISOString().slice(0,10)}, currentWeek=()=>mondayKey(new Date());

// Dynamic player identity. New data uses stable player_id; `person` remains a legacy fallback during migration.
const playerMeta=p=>typeof window.getPlayerMeta==='function'?window.getPlayerMeta(p):null;
const playerIdFor=p=>playerMeta(p)?.id||'';
const rowPlayerKey=r=>r.player_id||String(r.person||'').trim().toLocaleLowerCase('nb-NO');
const rowMatchesPlayer=(r,p)=>{const id=playerIdFor(p);if(id&&r.player_id)return r.player_id===id;const name=playerMeta(p)?.name||String(p||'');return String(r.person||'').localeCompare(name,'nb-NO',{sensitivity:'base'})===0};
const rowsForPlayer=(p,src=rows)=>src.filter(r=>rowMatchesPlayer(r,p));
const creditedRows=(src=rows)=>{const seen=new Set();return src.filter(r=>{const k=rowPlayerKey(r)+'|'+ymd(r.created_at);if(seen.has(k))return false;seen.add(k);return true})};
const creditedRowsFor=(p,src=rows)=>creditedRows(rowsForPlayer(p,src));
const totalCredited=(src=rows)=>creditedRows(src).length;
const uniqueDays=(p,w,src=rows)=>new Set(rowsForPlayer(p,src).filter(r=>mondayKey(r.created_at)===w).map(r=>ymd(r.created_at))).size;
const weekMap=(p,src=rows)=>{const m=new Map();rowsForPlayer(p,src).forEach(r=>{const w=mondayKey(r.created_at);if(!m.has(w))m.set(w,new Set());m.get(w).add(ymd(r.created_at))});return m}, weekKeysBetween=(start,end)=>{const a=[];let k=start;while(k<=end){a.push(k);k=addDaysYmd(k,7)}return a};

// Én felles XP-tabell for alle visninger og totalberegning.
// Uker følger Oslo-tid fra mandag til søndag. Ingen bonus utover XP for hver tellende dag.
// Daglige tillegg: +4, +3, +3, +2, +1, +1, +1.
const WEEK_XP=[0,4,7,10,12,13,14,15];
const gained=d=>WEEK_XP[Math.max(0,Math.min(7,Number(d)||0))];
const finalWeekXp=d=>d<=0?-6:gained(d);
const nextImmediate=d=>{const n=Math.max(0,Math.min(7,Number(d)||0));return n>=7?0:gained(n+1)-gained(n)};
const xpFor=(p,src=rows)=>{const m=weekMap(p,src);if(!m.size)return 0;const keys=[...m.keys()].sort(),end=currentWeek();let xp=0;weekKeysBetween(keys[0],end).forEach(k=>{const days=m.has(k)?m.get(k).size:0;xp+=k===end?gained(days):finalWeekXp(days)});return xp};
const levelInfo=(p,src=rows)=>{const rawXp=xpFor(p,src),xp=Math.max(0,rawXp),level=Math.min(10,Math.floor(xp/10)+1),inLevel=level===10?10:(xp%10);return{xp,rawXp,level,inLevel,rank:RANKS[level-1]}};
const streakInfo=(p,src=rows)=>{const m=weekMap(p,src);if(!m.size)return{current:0,best:0};const keys=[...m.keys()].sort(),all=weekKeysBetween(keys[0],currentWeek());let best=0,run=0;all.forEach(k=>{if((m.get(k)?.size||0)>=3){run++;best=Math.max(best,run)}else run=0});let idx=all.length-1;if((m.get(currentWeek())?.size||0)<3)idx--;let current=0;for(;idx>=0;idx--){if((m.get(all[idx])?.size||0)>=3)current++;else break}return{current,best}};
const typesThisWeek=p=>{const w=currentWeek(),r=rowsForPlayer(p).filter(x=>mondayKey(x.created_at)===w);return{strength:r.filter(x=>x.workout_type==='strength').length,cardio:r.filter(x=>x.workout_type==='cardio').length}};
const verdict=n=>n===0?'No-show territory 💀':n===1?'Motoren er i gang.':n===2?'Én dag til sikrer streaken.':n===3?'Week secured 🔥':n===4?'Overachiever 🔥🔥':n>=7?'7/7 BIG DAWG 👑':'Big Dawg week 👑';
const motivation=n=>n>=7?'7/7. Alle ukas 15 XP er hentet.':n===6?'Én dag til gir +1 XP og fullfører 7/7.':n===5?'Dag 6 gir +1 XP.':n===4?'Dag 5 gir +1 XP.':n===3?'Streak sikret. Dag 4 gir +2 XP.':n===2?'Én tellende dag til gir +3 XP og sikrer uka.':n===1?'Sterk start. Dag 2 gir +3 XP.':'Ingen treningsdager ennå. Dag 1 gir +4 XP.';
const toast=msg=>{const e=$('toast');e.textContent=msg;e.classList.add('show');clearTimeout(window.__t);window.__t=setTimeout(()=>e.classList.remove('show'),1900)}, setBusy=v=>{busy=v;document.querySelectorAll('button').forEach(b=>b.disabled=v)};
async function call(payload){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch{d={error:t}}if(!r.ok)throw new Error(d.error||t||'Feil');return d}