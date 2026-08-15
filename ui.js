const activePlayer=()=>{const p=typeof window.getSelectedPlayer==='function'?window.getSelectedPlayer():'';return PEOPLE.includes(p)?p:(p||PEOPLE[0]||'')};

function weekCard(p){
  const n=uniqueDays(p,currentWeek()),st=streakInfo(p),t=typesThisWeek(p),imm=nextImmediate(n),final=finalWeekXp(n),g=gained(n),status=n>=3?'good':'warn',pct=Math.min(100,n/3*100);
  return `<div class="week-top"><div><span class="section-kicker">${p.toUpperCase()}</span><div class="week-name">Ukesmål</div></div><span class="pill ${status}">${n>=3?'STREAK SAFE':'TARGET 3'}</span></div><div class="week-score"><div class="week-count">${n} / 3</div><div class="week-target">${n}/7 tellende dager</div></div><div class="week-mini-progress"><span style="width:${pct}%"></span></div><div class="split"><span>🔥 ${st.current} ukers streak</span><span>S ${t.strength} · K ${t.cardio}</span></div><div class="motivation">${motivation(n)}</div><div class="forecast"><b>Opptjent:</b> +${g} XP<br><b>Hvis uka slutter nå:</b> ${final>=0?'+':''}${final} XP · ${verdict(n)}<br><span class="muted">Neste nye treningsdag: ${imm>0?'+'+imm+' XP':'ingen ekstra XP'}</span></div>`;
}

function personCard(p){
  const i=levelInfo(p),n=uniqueDays(p,currentWeek()),st=streakInfo(p),pct=i.level===10?100:i.inLevel*10,next=i.level===10?'MAX LEVEL':`${10-i.inLevel} XP til Level ${i.level+1}`,days=creditedRowsFor(p).length;
  return `<div class="fighter-heading"><div><div class="fighter-name">${p}<span class="crown">♛</span></div><div class="fighter-rank">Level ${i.level} · ${i.rank}</div></div><span class="level-chip">LEVEL ${i.level}/10</span></div><div class="fighter-main"><div class="fighter-character">${fig(p,i.level)}</div><div class="fighter-metrics"><div class="metric"><span>TRENINGS-DAGER</span><strong>${days}</strong></div><div class="metric"><span>DENNE UKA</span><strong>${n}/3</strong></div><div class="metric streak"><span>STREAK</span><strong>🔥 ${st.current}</strong></div></div></div><div class="fighter-xp"><div class="fighter-xp-line"><strong>${i.xp} total XP</strong><span>${next}</span></div><div class="xpbar"><div class="xpfill" style="width:${pct}%"></div></div></div><div class="actions"><button class="btn strength" data-add="strength" data-person="${p}">＋ Styrke</button><button class="btn cardio" data-add="cardio" data-person="${p}">＋ Kondis</button><button class="btn undo" data-undo="${p}">Angre siste økt</button></div>`;
}

function evolutionCard(p){
  const i=levelInfo(p),slug=typeof characterSlug==='function'?characterSlug(p):(String(p).toLowerCase()==='adrian'?'adrian':'rikard');
  const thumbs=Array.from({length:10},(_,idx)=>{
    const level=idx+1,state=level===i.level?'current':level>i.level?'future':'unlocked',title=level>i.level?`Level ${level} · Locked`:`Level ${level}: ${RANKS[idx]}`;
    return `<div class="evo-thumb ${state}" title="${title}"><img src="characters/${slug}-${level}.png" alt="${level>i.level?'Skjult kommende evolution':`${p} Level ${level}`}" draggable="false"><span>${level}</span></div>`;
  }).join('');
  return `<div class="evolution-head"><strong>${p}s evolution</strong><span>Level ${i.level} / 10</span></div><div class="evolution-track">${thumbs}</div>`;
}

function renderHero(){
  const total=totalCredited(),pct=Math.min(100,total);
  $('total').textContent=`${total} / 100`;
  $('fill').style.width=pct+'%';
  $('heroPercent').textContent=pct+'%';
  const ms=[25,50,75,100].find(x=>x>total)||100;
  $('nextMilestone').textContent=total>=100?'Mission complete 🏆':ms;
  $('milestoneLeft').textContent=total>=100?'':`${ms-total} igjen`;
}

function renderWeek(){
  const p=activePlayer();
  PEOPLE.forEach(name=>{
    const el=$('week'+name),active=name===p;
    if(!el)return;
    el.hidden=!active;
    el.innerHTML=active?weekCard(name):'';
  });
  const a=uniqueDays('Rikard',currentWeek()),b=uniqueDays('Adrian',currentWeek());
  if($('versus')){$('versus').textContent=a===b?`Uavgjort ${a}–${b}`:a>b?`Rikard ${a}–${b}`:`Adrian ${b}–${a}`;$('versus').hidden=true}
}

function renderPeople(){
  const p=activePlayer();
  PEOPLE.forEach(name=>{
    const el=$('person'+name),active=name===p;
    if(!el)return;
    el.hidden=!active;
    el.innerHTML=active?personCard(name):'';
  });
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addWorkout(b.dataset.person,b.dataset.add));
  document.querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>undoWorkout(b.dataset.undo));
  if(typeof window.applySelectedControls==='function')window.applySelectedControls();
}

function renderEvolution(){
  const p=activePlayer();
  PEOPLE.forEach(name=>{
    const el=$('evolution'+name),active=name===p;
    if(!el)return;
    el.hidden=!active;
    el.innerHTML=active?evolutionCard(name):'';
  });
}

function renderHeat(){
  if(typeof window.renderTrainingCalendar==='function')return window.renderTrainingCalendar();
  const p=activePlayer(),today=ymd(new Date()),start=addDaysYmd(currentWeek(),-49);
  PEOPLE.forEach(name=>{
    const h=$('heat'+name),card=h?.closest('.calendar-card'),active=name===p;
    if(card)card.hidden=!active;
    if(!h)return;
    if(!active){h.innerHTML='';return}
    const m=new Map();
    rowsForPlayer(name).forEach(r=>{const d=ymd(r.created_at);if(!m.has(d))m.set(d,new Set());m.get(d).add(r.workout_type)});
    let out='';
    for(let i=0;i<56;i++){
      const d=addDaysYmd(start,i),set=m.get(d)||new Set(),future=d>today;
      out+=`<div class="day ${set.size?'has':''} ${future?'future':''}" title="${d}">${set.has('strength')?'<span class="s">S</span>':''}${set.has('cardio')?'<span class="k">K</span>':''}</div>`;
    }
    h.innerHTML=out;
  });
}

function renderForm(){
  const p=activePlayer();
  PEOPLE.forEach(name=>{
    const el=$('form'+name),active=name===p;
    if(!el)return;
    el.hidden=!active;
    if(!active){el.innerHTML='';return}
    const s=streakInfo(name),arr=[5,4,3,2,1,0].map(i=>uniqueDays(name,addDaysYmd(currentWeek(),-7*i))),bestWeek=Math.max(0,...[...weekMap(name).values()].map(v=>v.size));
    el.innerHTML=`<div class="name"><div><span class="section-kicker">${name.toUpperCase()}</span><h3>Form</h3></div><span class="pill ${s.current?'good':''}">🔥 ${s.current}</span></div><div class="split"><span>Beste streak: ${s.best} uker</span><span>Beste uke: ${bestWeek}/7</span></div><div class="form-strip">${arr.map(x=>`<span class="week-chip ${x>=3?'good':x<2?'bad':''}">${x}</span>`).join('')}</div>`;
  });
}

function renderHistory(){
  const p=activePlayer(),filtered=typeof historyRowsForPlayer==='function'?historyRowsForPlayer(p):rowsForPlayer(p),list=filtered.slice(0,visibleHistory),h=$('history');
  h.innerHTML=!list.length?`<div class="muted" style="text-align:center;padding:18px">Ingen økter logget for ${p} ennå.</div>`:list.map(r=>{
    const d=new Date(r.created_at),date=d.toLocaleDateString('nb-NO',{day:'2-digit',month:'short',year:'2-digit',timeZone:'Europe/Oslo'}),time=d.toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'}),label=r.workout_type==='strength'?'Styrke':'Kondis',manual=r.entry_source==='manual';
    return `<div class="row" data-id="${r.id}" data-source="${manual?'manual':'normal'}"><div class="left"><span class="dot ${r.workout_type}"></span><div><div class="who">${r.person}</div><div class="kind">${label}${manual?'<span class="history-source-badge">ETTERREGISTRERT</span>':''}</div></div></div><div class="when">${date}<br>${time}</div></div>`;
  }).join('');
  document.querySelectorAll('.row[data-id]').forEach(el=>el.onclick=()=>openEdit(el.dataset.id));
  $('moreBtn').hidden=filtered.length<=10;
  $('moreBtn').textContent=visibleHistory>=filtered.length?'Vis færre':`Vis mer (${Math.min(10,filtered.length-visibleHistory)})`;
}

const badgeList=()=>{
  const all=[];
  PEOPLE.forEach(p=>{
    const cr=creditedRowsFor(p).length,st=streakInfo(p),lvl=levelInfo(p).level,maxWeek=Math.max(0,...[...weekMap(p).values()].map(v=>v.size));
    if(cr>=1)all.push(`${p}: First Blood`);
    if(st.best>=3)all.push(`${p}: No Excuses`);
    if(maxWeek>=5)all.push(`${p}: Five Piece`);
    if(lvl>=8)all.push(`${p}: Big Dawg`);
    if(lvl>=10)all.push(`${p}: Gym Warlord`);
  });
  if(totalCredited()>=100)all.push('100 Club');
  return all;
};

function renderBadges(){
  const p=activePlayer(),prefix=`${p}: `,all=badgeList().filter(x=>x.startsWith(prefix)).map(x=>x.slice(prefix.length));
  $('badges').innerHTML=all.length?all.map(x=>`<span class="badge">🏆 ${x}</span>`).join(''):`<span class="muted small">Ingen achievements for ${p} ennå. Get to work.</span>`;
  $('badgeCount').textContent=`${all.length} låst opp`;
}

function showAchievement(text){achSound();$('achText').textContent=text;$('achOverlay').classList.add('show');setTimeout(()=>$('achOverlay').classList.remove('show'),2200)}
function maybeShowNewBadge(){const n=new Set(badgeList());if(lastBadgeSet.size){for(const b of n){if(!lastBadgeSet.has(b)){showAchievement(b);break}}}lastBadgeSet=n}
function closeEvolution(){clearTimeout(evoTimer);$('evoOverlay').classList.remove('show')}
function showEvolution(person,from,to){levelSound();$('evoTitle').textContent=`${person} is evolving…`;$('evoOld').innerHTML=fig(person,from,true);$('evoNew').innerHTML=fig(person,to,true);$('evoOld').classList.add('evolving');$('evoNew').classList.add('flash');$('evoText').textContent=`${person} evolved into Level ${to}: ${RANKS[to-1]}`;$('evoOverlay').classList.add('show');setTimeout(()=>{$('evoOld').classList.remove('evolving');$('evoNew').classList.remove('flash');$('evoTitle').textContent='Evolution complete!';$('evoText').textContent=`${person} is now ${RANKS[to-1]}`;evoTimer=setTimeout(closeEvolution,5000)},1700)}

function render(){if(typeof window.renderRewardEngine==='function')window.renderRewardEngine();renderHero();renderPeople();renderEvolution();renderWeek();renderHeat();renderForm();renderHistory();renderBadges()}

async function refresh(silent=true){try{rows=await call({action:'list'});render();if(lastBadgeSet.size===0)lastBadgeSet=new Set(badgeList());$('status').textContent='● Tilkoblet';if(!silent)toast('Oppdatert')}catch(e){$('status').textContent='Kunne ikke koble til';if(!silent)toast(e.message)}}

async function addWorkout(person,type){
  if(busy)return;
  try{const c=ensureAudio();if(c.state==='suspended')c.resume()}catch{}
  const label=type==='strength'?'styrke':'kondis';
  if(!confirm(`Registrere ${label} for ${person} nå?`))return;
  const beforeInfo=levelInfo(person),beforeDays=uniqueDays(person,currentWeek()),opponents=PEOPLE.filter(p=>p!==person),maxOpponentDays=opponents.length?Math.max(...opponents.map(p=>uniqueDays(p,currentWeek()))):-1;
  setBusy(true);
  try{
    const meta=typeof window.getPlayerMeta==='function'?window.getPlayerMeta(person):null;
    await call({action:'add',person,player_id:meta?.id||undefined,workout_type:type});
    await refresh(true);
    const afterInfo=levelInfo(person),afterDays=uniqueDays(person,currentWeek()),xpDelta=afterInfo.rawXp-beforeInfo.rawXp,tookLead=opponents.length===1&&beforeDays<=maxOpponentDays&&afterDays>maxOpponentDays;
    toast('Økt registrert');
    window.dispatchEvent(new CustomEvent('obd-workout-added',{detail:{person,playerId:meta?.id||'',type,xpDelta,levelBefore:beforeInfo.level,levelAfter:afterInfo.level,afterInLevel:afterInfo.inLevel,rank:afterInfo.rank,xpToNext:afterInfo.level===10?0:10-afterInfo.inLevel,tookLead,newTrainingDay:afterDays>beforeDays}}));
    if(afterInfo.level>beforeInfo.level){setTimeout(()=>showEvolution(person,beforeInfo.level,afterInfo.level),1450);setTimeout(maybeShowNewBadge,8300)}else setTimeout(maybeShowNewBadge,1500);
  }catch(e){toast(e.message)}finally{setBusy(false)}
}

async function undoWorkout(person){if(busy)return;if(!confirm(`Angre siste registrerte økt for ${person}?`))return;const meta=typeof window.getPlayerMeta==='function'?window.getPlayerMeta(person):null;setBusy(true);try{const r=await call({action:'undo',person,player_id:meta?.id||undefined});await refresh(true);toast(r.deleted?'Siste økt fjernet':'Ingen økt å angre')}catch(e){toast(e.message)}finally{setBusy(false)}}
function toLocalInput(date){const d=new Date(date),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
function openEdit(id){editing=rows.find(r=>r.id===id);if(!editing)return;$('editMeta').textContent=`${editing.person} · ${editing.workout_type==='strength'?'Styrke':'Kondis'}${editing.entry_source==='manual'?' · Etterregistrert':''}`;$('editDate').value=toLocalInput(editing.created_at);$('editDialog').showModal()}
$('cancelEdit').onclick=()=>$('editDialog').close();
$('saveEdit').onclick=async()=>{if(!editing||busy)return;const val=$('editDate').value;if(!val)return toast('Velg dato og tid');if(!confirm('Lagre ny dato/tid for økten?'))return;setBusy(true);try{await call({action:'edit',id:editing.id,source:editing.entry_source==='manual'?'manual':'normal',created_at:new Date(val).toISOString()});$('editDialog').close();await refresh(true);toast('Økten er oppdatert')}catch(e){toast(e.message)}finally{setBusy(false)}};
$('deleteEdit').onclick=async()=>{if(!editing||busy)return;if(!confirm('Slette denne økten permanent?'))return;setBusy(true);try{await call({action:'delete',id:editing.id,source:editing.entry_source==='manual'?'manual':'normal'});$('editDialog').close();await refresh(true);toast('Økten er slettet')}catch(e){toast(e.message)}finally{setBusy(false)}};
$('moreBtn').onclick=()=>{const list=typeof historyRowsForPlayer==='function'?historyRowsForPlayer(activePlayer()):rowsForPlayer(activePlayer()),count=list.length;visibleHistory=visibleHistory>=count?10:Math.min(count,visibleHistory+10);renderHistory()};
$('evoOverlay').onclick=closeEvolution;$('achOverlay').onclick=()=>$('achOverlay').classList.remove('show');
$('resetAll').onclick=async()=>{if(busy)return;const pin=prompt('Tast PIN for å nullstille all datalogg');if(pin===null)return;if(pin!=='1337'){toast('Feil PIN');return}if(!confirm('Dette sletter ALL treningshistorikk. Er du sikker?'))return;setBusy(true);try{await call({action:'reset',confirm:'RESET_ALL_WORKOUTS',pin});rows=[];lastBadgeSet=new Set();visibleHistory=10;render();toast('All historikk er nullstilt')}catch(e){toast(e.message)}finally{setBusy(false)}};

window.addEventListener('obd-player-changed',()=>{if(!window.__obdAppStarted)return;visibleHistory=10;render()});

function startApp(){
  if(window.__obdAppStarted)return;
  window.__obdAppStarted=true;
  refresh(true);
  window.__obdRefreshTimer=setInterval(()=>refresh(true),15000);
}
if(window.obdAuthReady)startApp();
else window.addEventListener('obd-auth-ready',startApp,{once:true});
