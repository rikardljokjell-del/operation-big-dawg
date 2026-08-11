(()=>{
  const STATS_URL='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/player-stats';
  const MASTER_PIN='1337';
  const SEEN_KEY='obd_stats_unlock_seen_v1';
  const KEYS=['power','engine','discipline','grit'];
  const LABELS={power:'POWER',engine:'ENGINE',discipline:'DISCIPLINE',grit:'GRIT'};
  const ICONS={power:'💪',engine:'⚡',discipline:'🔥',grit:'☠'};
  const DESCRIPTIONS={
    power:'Råstyrke. Styrkeøkter mater denne hardest.',
    engine:'Motor og arbeidskapasitet. Kondis bygger denne raskest.',
    discipline:'Evnen til å møte opp. Nye treningsdager bygger disiplin.',
    grit:'Mental seighet. Alle økter legger litt stål i ryggraden.'
  };
  const empty=()=>({power:0,engine:0,discipline:0,grit:0});
  const allocCache=new Map();
  let draft=null;
  let draftPlayerId='';
  let pendingUnlock='';
  let evoWasShown=false;
  let unlockInProgress=false;

  if(!document.querySelector('link[href="stats.css"]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='stats.css';document.head.appendChild(link);
  }

  function playerMeta(person){
    return typeof window.getPlayerMeta==='function'?window.getPlayerMeta(person):null;
  }
  function selected(){
    const id=typeof window.getSelectedPlayerId==='function'?window.getSelectedPlayerId():'';
    const name=typeof window.getSelectedPlayer==='function'?window.getSelectedPlayer():'';
    return {id,name,meta:playerMeta(id)||playerMeta(name)};
  }
  function totalAp(level){return level<2?0:3+Math.max(0,level-2)*2}
  function autoStats(level){
    const out=empty(),order=['discipline','power','engine','grit'];
    for(let l=2;l<=level;l++)out[order[(l-2)%order.length]]++;
    return out;
  }
  function normalizeAlloc(v){
    const out=empty();
    KEYS.forEach(k=>out[k]=Math.max(0,Math.floor(Number(v?.[k])||0)));
    return out;
  }
  function spent(v){return KEYS.reduce((sum,k)=>sum+(Number(v?.[k])||0),0)}
  function workoutBonus(person){
    const list=typeof rowsForPlayer==='function'?rowsForPlayer(person):[];
    const strength=list.filter(r=>r.workout_type==='strength').length;
    const cardio=list.filter(r=>r.workout_type==='cardio').length;
    const days=new Set(list.map(r=>ymd(r.created_at))).size;
    return {
      power:strength*.45,
      engine:cardio*.45,
      discipline:days*.12,
      grit:(strength+cardio)*.15
    };
  }
  function stateFor(person){
    const info=levelInfo(person),meta=playerMeta(person),id=meta?.id||'';
    const allocation=normalizeAlloc(allocCache.get(id));
    const auto=autoStats(info.level),workout=workoutBonus(person),base=1;
    const values={};
    KEYS.forEach(k=>values[k]=Math.round((base+auto[k]+allocation[k]+workout[k])*10)/10);
    const available=Math.max(0,totalAp(info.level)-spent(allocation));
    return {info,meta,id,allocation,auto,workout,values,available,totalPoints:totalAp(info.level)};
  }
  function buildClass(values){
    const sorted=KEYS.map(k=>({k,v:values[k]})).sort((a,b)=>b.v-a.v);
    if(sorted[0].v-sorted[3].v<1.25)return 'BIG DAWG HYBRID';
    if(sorted[0].v-sorted[1].v<.45)return 'HYBRID MONSTER';
    return {power:'IRON BRUTE',engine:'DIESEL BEAST',discipline:'DISCIPLINE DEMON',grit:'WAR DOG'}[sorted[0].k];
  }
  function fmt(n){return Number(n).toFixed(1).replace('.0','')}

  async function statsCall(action,playerId,payload={}){
    const r=await fetch(STATS_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,player_id:playerId,pin:MASTER_PIN,...payload})});
    let data={};try{data=await r.json()}catch{}
    if(!r.ok)throw new Error(data.error||`Stats-feil (${r.status})`);
    return data;
  }
  async function loadAlloc(playerId,rerender=true){
    if(!playerId)return empty();
    try{
      const data=await statsCall('get',playerId);
      const value=normalizeAlloc(data.stats_alloc);
      allocCache.set(playerId,value);
      if(rerender&&typeof renderPeople==='function')renderPeople();
      return value;
    }catch(e){console.warn('Stats allocation load failed',e);return empty()}
  }

  function seenMap(){try{return JSON.parse(localStorage.getItem(SEEN_KEY)||'{}')||{}}catch{return {}}}
  function hasSeen(id){return !!seenMap()[id]}
  function markSeen(id){
    if(!id)return;const map=seenMap();map[id]=true;try{localStorage.setItem(SEEN_KEY,JSON.stringify(map))}catch{}
  }

  function ensureUi(){
    if(document.getElementById('statsUnlockOverlay'))return;
    const wrap=document.createElement('div');
    wrap.id='statsUnlockOverlay';wrap.className='stats-overlay';wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML=`
      <div class="stats-modal" role="dialog" aria-modal="true" aria-labelledby="statsModalTitle">
        <button class="stats-close" type="button" data-stats-close aria-label="Lukk">×</button>
        <section id="statsUnlockIntro" class="stats-stage">
          <div class="stats-system-kicker">SYSTEM UPGRADE</div>
          <h2 id="statsModalTitle">STATS UNLOCKED!</h2>
          <p class="stats-lead">Du trener ikke bare lenger. Du bygger en fighter.</p>
          <div class="stats-unlock-grid">
            ${KEYS.map(k=>`<article><b>${ICONS[k]}</b><strong>${LABELS[k]}</strong><span>${DESCRIPTIONS[k]}</span></article>`).join('')}
          </div>
          <div class="stats-ap-award"><small>ATTRIBUTE POINTS</small><strong id="statsUnlockAward">+3 AP</strong><span>Fordel dem og skap din egen build.</span></div>
          <div class="stats-actions"><button class="stats-secondary" type="button" data-stats-later>SENERE</button><button class="stats-primary" type="button" data-stats-build>BUILD YOUR FIGHTER</button></div>
        </section>
        <section id="statsAllocator" class="stats-stage" hidden>
          <div class="stats-system-kicker">ATTRIBUTE LAB</div>
          <h2>BUILD YOUR FIGHTER</h2>
          <div class="stats-ap-counter"><span>AP AVAILABLE</span><strong id="statsApAvailable">0</strong></div>
          <div id="statsAllocRows" class="stats-alloc-rows"></div>
          <div id="statsBuildPreview" class="stats-build-preview"></div>
          <div id="statsAllocError" class="stats-error"></div>
          <div class="stats-actions"><button class="stats-secondary" type="button" data-stats-back>TILBAKE</button><button id="statsSaveBuild" class="stats-primary" type="button" data-stats-save>LOCK IN BUILD</button></div>
        </section>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',handleUiClick);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&wrap.classList.contains('show'))closeStats()});
  }

  function handleUiClick(e){
    const target=e.target;
    if(target.closest('[data-stats-close],[data-stats-later]')){closeStats();return}
    if(target.closest('[data-stats-build]')){openAllocator();return}
    if(target.closest('[data-stats-back]')){showIntro();return}
    if(target.closest('[data-stats-save]')){saveBuild();return}
    const adjust=target.closest('[data-stat-adjust]');
    if(adjust){adjustDraft(adjust.dataset.stat,Number(adjust.dataset.statAdjust));return}
  }

  function openOverlay(){
    ensureUi();const el=document.getElementById('statsUnlockOverlay');
    el.classList.add('show');el.setAttribute('aria-hidden','false');document.body.classList.add('stats-modal-open');
  }
  function closeStats(){
    const el=document.getElementById('statsUnlockOverlay');if(!el)return;
    el.classList.remove('show');el.setAttribute('aria-hidden','true');document.body.classList.remove('stats-modal-open');unlockInProgress=false;
  }
  function showIntro(){
    const intro=document.getElementById('statsUnlockIntro'),allocator=document.getElementById('statsAllocator');
    if(intro)intro.hidden=false;if(allocator)allocator.hidden=true;
  }
  function showUnlock(person){
    const s=stateFor(person);if(s.info.level<2||!s.id||hasSeen(s.id))return;
    markSeen(s.id);unlockInProgress=true;openOverlay();showIntro();
    const award=document.getElementById('statsUnlockAward');if(award)award.textContent=`+${s.available} AP`;
    try{if(typeof achSound==='function')achSound();navigator.vibrate?.([35,45,75])}catch{}
  }

  function openAllocator(){
    const s=stateFor(selected().name);if(s.info.level<2)return;
    ensureUi();openOverlay();
    draftPlayerId=s.id;draft=normalizeAlloc(s.allocation);
    document.getElementById('statsUnlockIntro').hidden=true;
    document.getElementById('statsAllocator').hidden=false;
    renderAllocator();
  }
  window.openStatsAllocator=openAllocator;

  function renderAllocator(){
    if(!draft)return;
    const person=selected().name,s=stateFor(person),remaining=Math.max(0,s.totalPoints-spent(draft));
    document.getElementById('statsApAvailable').textContent=remaining;
    const rows=document.getElementById('statsAllocRows');
    rows.innerHTML=KEYS.map(k=>`
      <div class="stats-alloc-row">
        <div class="stats-alloc-name"><b>${ICONS[k]}</b><span><strong>${LABELS[k]}</strong><small>${DESCRIPTIONS[k]}</small></span></div>
        <div class="stats-stepper"><button type="button" data-stat="${k}" data-stat-adjust="-1" ${draft[k]<=0?'disabled':''}>−</button><strong>${draft[k]}</strong><button type="button" data-stat="${k}" data-stat-adjust="1" ${remaining<=0?'disabled':''}>+</button></div>
      </div>`).join('');
    const previewValues={};
    KEYS.forEach(k=>previewValues[k]=Math.round((1+s.auto[k]+draft[k]+s.workout[k])*10)/10);
    document.getElementById('statsBuildPreview').innerHTML=`<span>BUILD CLASS</span><strong>${buildClass(previewValues)}</strong><small>${KEYS.map(k=>`${LABELS[k]} ${fmt(previewValues[k])}`).join(' · ')}</small>`;
    document.getElementById('statsAllocError').textContent='';
  }
  function adjustDraft(key,delta){
    if(!draft||!KEYS.includes(key))return;
    const s=stateFor(selected().name),remaining=s.totalPoints-spent(draft);
    if(delta>0&&remaining<=0)return;
    draft[key]=Math.max(0,draft[key]+delta);
    try{navigator.vibrate?.(18)}catch{}
    renderAllocator();
  }
  async function saveBuild(){
    if(!draft||!draftPlayerId)return;
    const s=stateFor(selected().name),used=spent(draft),error=document.getElementById('statsAllocError'),btn=document.getElementById('statsSaveBuild');
    if(used>s.totalPoints){error.textContent='Du har fordelt flere AP enn du har låst opp.';return}
    btn.disabled=true;error.textContent='';
    try{
      const data=await statsCall('set',draftPlayerId,{stats_alloc:draft});
      allocCache.set(draftPlayerId,normalizeAlloc(data.stats_alloc));
      draft=null;draftPlayerId='';
      if(typeof renderPeople==='function')renderPeople();
      closeStats();showBurst('BUILD LOCKED IN',`◆ ${buildClass(stateFor(selected().name).values)}`,'gold');
      try{navigator.vibrate?.([25,35,60])}catch{}
    }catch(e){error.textContent=e.message||'Kunne ikke lagre build.'}
    finally{btn.disabled=false}
  }

  function renderStatsIntoFighter(){
    const person=selected().name;if(!person)return;
    const s=stateFor(person),card=document.getElementById('person'+person);if(!card)return;
    card.querySelector('.fighter-stats-panel')?.remove();
    if(s.info.level<2)return;
    const panel=document.createElement('section');panel.className='fighter-stats-panel';
    panel.innerHTML=`
      <div class="fighter-stats-head"><div><span>FIGHTER STATS</span><strong>${buildClass(s.values)}</strong></div><button type="button" data-open-stats>${s.available>0?`⚡ ${s.available} AP`:'JUSTÉR BUILD'}</button></div>
      <div class="fighter-stats-list">
        ${KEYS.map(k=>`<div class="fighter-stat-row"><div><span>${ICONS[k]} ${LABELS[k]}</span><strong>${fmt(s.values[k])}</strong></div><i><b style="width:${Math.min(100,s.values[k]/24*100)}%"></b></i><small>Auto +${s.auto[k]} · Økter +${fmt(s.workout[k])} · AP +${s.allocation[k]}</small></div>`).join('')}
      </div>
      ${s.available>0?`<button class="stats-unspent-cta" type="button" data-open-stats>⚡ ${s.available} ATTRIBUTE POINT${s.available===1?'':'S'} AVAILABLE</button>`:''}`;
    const actions=card.querySelector('.actions');
    if(actions)card.insertBefore(panel,actions);else card.appendChild(panel);
    panel.querySelectorAll('[data-open-stats]').forEach(b=>b.addEventListener('click',openAllocator));
  }
  window.renderStatsIntoFighter=renderStatsIntoFighter;

  function showBurst(title,sub,kind=''){
    let el=document.getElementById('statBurst');
    if(!el){el=document.createElement('div');el.id='statBurst';el.className='stat-burst';document.body.appendChild(el)}
    el.className=`stat-burst show ${kind}`;el.innerHTML=`<strong>${title}</strong><span>${sub}</span>`;
    clearTimeout(showBurst.timer);showBurst.timer=setTimeout(()=>el.classList.remove('show'),2200);
  }

  function handleWorkout(detail){
    if(!detail)return;
    if(detail.levelBefore<2&&detail.levelAfter>=2){pendingUnlock=detail.person;return}
    if(detail.levelAfter<2)return;
    const main=detail.type==='strength'?'+0.45 POWER':'+0.45 ENGINE';
    const extra=['+0.15 GRIT'];if(detail.newTrainingDay)extra.push('+0.12 DISCIPLINE');
    setTimeout(()=>showBurst('STAT GAIN',`${main} · ${extra.join(' · ')}`,detail.type),900);
  }

  function installEvolutionWatcher(){
    const evo=document.getElementById('evoOverlay');if(!evo)return;
    const check=()=>{
      const showing=evo.classList.contains('show');
      if(showing){evoWasShown=true;return}
      if(evoWasShown&&pendingUnlock){
        const person=pendingUnlock;pendingUnlock='';evoWasShown=false;
        setTimeout(()=>showUnlock(person),180);
      }
    };
    new MutationObserver(check).observe(evo,{attributes:true,attributeFilter:['class']});
  }

  function patchBadgeTiming(){
    if(typeof maybeShowNewBadge!=='function'||window.__obdStatsBadgePatch)return;
    window.__obdStatsBadgePatch=true;
    const original=maybeShowNewBadge;
    maybeShowNewBadge=function(){
      if(unlockInProgress){setTimeout(()=>maybeShowNewBadge(),900);return}
      original();
    };
  }
  function patchRender(){
    if(typeof renderPeople!=='function'||window.__obdStatsRenderPatch)return;
    window.__obdStatsRenderPatch=true;
    const original=renderPeople;
    renderPeople=function(){original();renderStatsIntoFighter()};
  }

  async function activateForSelected(showRetro=true){
    const s=selected();if(!s.id||!s.name)return;
    await loadAlloc(s.id,false);
    if(typeof renderPeople==='function')renderPeople();
    if(showRetro){
      const info=levelInfo(s.name);
      if(info.level>=2&&!hasSeen(s.id)&&!document.getElementById('evoOverlay')?.classList.contains('show'))setTimeout(()=>showUnlock(s.name),850);
    }
  }

  ensureUi();installEvolutionWatcher();patchBadgeTiming();patchRender();
  window.addEventListener('obd-workout-added',e=>handleWorkout(e.detail));
  window.addEventListener('obd-player-changed',()=>activateForSelected(true));
  window.addEventListener('obd-auth-ready',()=>activateForSelected(true));
  if(window.obdAuthReady)activateForSelected(true);
})();