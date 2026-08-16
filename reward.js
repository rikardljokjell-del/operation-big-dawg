(()=>{
  const el=id=>document.getElementById(id);
  const osloWeekday=()=>new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Oslo',weekday:'short'}).format(new Date());
  const hasWorkoutToday=person=>{const today=ymd(new Date());return rowsForPlayer(person).some(r=>ymd(r.created_at)===today)};

  function renderRewardEngine(){
    try{
      const engine=el('rewardEngine');
      if(!engine||!Array.isArray(rows))return;
      const person=typeof activePlayer==='function'?activePlayer():(typeof window.getSelectedPlayer==='function'?window.getSelectedPlayer():'Rikard');
      const days=uniqueDays(person,currentWeek());
      const info=levelInfo(person);
      const streak=streakInfo(person);
      const nextXp=nextImmediate(days);
      const xpToLevel=info.level===10?0:10-info.inLevel;
      const todayDone=hasWorkoutToday(person);
      const thursday=osloWeekday()==='Thu';
      const danger=thursday&&days<=2;
      const missing=Math.max(0,3-days);

      engine.classList.toggle('danger',danger);
      el('rewardPlayer').textContent=person.toUpperCase();
      el('rewardKicker').textContent=danger?'STREAK I FARE':'NEXT REWARD';

      if(danger){
        el('rewardHeadline').textContent=`${missing} ${missing===1?'treningsdag':'treningsdager'} mangler`;
        el('rewardSub').textContent=`Torsdag: ${days}/3 tellende dager. Få inn ${missing} ${missing===1?'ny treningsdag':'nye treningsdager'} innen søndag for å holde streaken i live.`;
      }else if(!todayDone){
        el('rewardHeadline').textContent=nextXp>0?`Neste treningsdag gir +${nextXp} XP`:'Ukas XP er hentet';
        el('rewardSub').textContent=info.level===10?`Level 10 · ${info.rank}. Nå handler det om å holde rytmen.`:`${xpToLevel} XP til Level ${info.level+1}: ${RANKS[info.level]}.`;
      }else{
        el('rewardHeadline').textContent='Dagens mission er fullført ✓';
        el('rewardSub').textContent=nextXp>0?`Neste nye treningsdag gir +${nextXp} XP.${info.level===10?'':` ${xpToLevel} XP til Level ${info.level+1}.`}`:`Alle ukas 15 XP er hentet. Hold streaken varm.`;
      }

      el('rewardNextXp').textContent=days>=7?'MAX':`+${nextXp} XP`;
      el('rewardNextLevel').textContent=info.level===10?'MAX':`${xpToLevel} XP`;
      const mission=el('rewardMission');
      mission.textContent=todayDone?'Fullført ✓':'Logg én økt';
      mission.closest('.reward-chip')?.classList.toggle('complete',todayDone);
      el('rewardStreakMeta').textContent=`🔥 ${streak.current}`;
      const pct=info.level===10?100:info.inLevel*10;
      el('rewardLevelFill').style.width=`${pct}%`;
    }catch{}
  }

  let payoffTimer=null;
  function showWorkoutPayoff(detail={}){
    const wrap=el('workoutPayoff');
    if(!wrap)return;
    clearTimeout(payoffTimer);
    const delta=Math.max(0,Number(detail.xpDelta)||0);
    const xpEl=el('payoffXp');
    const kicker=el('payoffKicker');
    const title=el('payoffTitle');
    const sub=el('payoffSub');
    const leader=el('payoffLeader');
    const fill=el('payoffFill');

    kicker.textContent=delta>0?'WORKOUT LOCKED IN':'DOUBLE DOWN';
    title.textContent=detail.type==='strength'?'Styrke registrert':detail.type==='cardio'?'Kondis registrert':'Mobilitet registrert';
    xpEl.classList.toggle('zero',delta===0);
    xpEl.textContent=delta>0?'+0 XP':'ØKT LOGGET';
    if(detail.levelAfter>=10)sub.textContent=`Level 10 · ${detail.rank||'Gym Warlord'}`;
    else if(delta===0)sub.textContent='Dagens tellende XP var allerede sikret.';
    else sub.textContent=`${detail.xpToNext} XP til Level ${detail.levelAfter+1}: ${RANKS[detail.levelAfter]}`;
    leader.textContent=detail.tookLead?'♛ DU TOK LEDERTRØYA':'';
    fill.style.width='0%';
    wrap.classList.add('show');

    try{navigator.vibrate?.(detail.tookLead?[35,35,55,35,85]:[35,45,75])}catch{}
    try{[523,659,784].forEach((f,i)=>beep(f,.1,'triangle',i*.085,.035))}catch{}

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      fill.style.width=`${detail.levelAfter>=10?100:Math.max(0,Math.min(100,(Number(detail.afterInLevel)||0)*10))}%`;
    }));

    if(delta>0){
      const start=performance.now(),duration=520;
      const tick=now=>{
        const p=Math.min(1,(now-start)/duration),value=Math.round(delta*p);
        xpEl.textContent=`+${value} XP`;
        if(p<1)requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    payoffTimer=setTimeout(()=>wrap.classList.remove('show'),1350);
  }

  let confirmResolver=null;
  function ensureConfirmUi(){
    let wrap=el('obdConfirm');
    if(wrap)return wrap;
    wrap=document.createElement('div');
    wrap.id='obdConfirm';
    wrap.className='obd-confirm';
    wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML=`<div class="obd-confirm-backdrop" data-confirm-cancel></div><div class="obd-confirm-card" role="dialog" aria-modal="true" aria-labelledby="obdConfirmTitle" aria-describedby="obdConfirmText"><div id="obdConfirmIcon" class="obd-confirm-icon">💪</div><div id="obdConfirmKicker" class="obd-confirm-kicker">LOCK IT IN</div><div id="obdConfirmTitle" class="obd-confirm-title">Registrer økt?</div><div id="obdConfirmText" class="obd-confirm-text"></div><div class="obd-confirm-actions"><button type="button" class="obd-confirm-btn secondary" data-confirm-cancel>Avbryt</button><button id="obdConfirmOk" type="button" class="obd-confirm-btn primary" data-confirm-ok>Registrer</button></div></div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',e=>{
      if(e.target.closest('[data-confirm-cancel]'))closeConfirm(false);
      else if(e.target.closest('[data-confirm-ok]'))closeConfirm(true);
    });
    return wrap;
  }

  function closeConfirm(result){
    const wrap=el('obdConfirm');
    if(!wrap||!wrap.classList.contains('show'))return;
    wrap.classList.remove('show');
    wrap.setAttribute('aria-hidden','true');
    document.body.classList.remove('obd-modal-open');
    const resolve=confirmResolver;
    confirmResolver=null;
    if(resolve)resolve(result);
  }

  function openConfirm({kind='strength',person='Rikard'}={}){
    const wrap=ensureConfirmUi();
    if(confirmResolver)closeConfirm(false);
    const isUndo=kind==='undo';
    const isCardio=kind==='cardio';
    const isMobility=kind==='mobility';
    wrap.dataset.kind=kind;
    const label=isMobility?'mobilitet':isCardio?'kondis':'styrke';
    el('obdConfirmIcon').textContent=isUndo?'↶':isMobility?'🧘':isCardio?'⚡':'💪';
    el('obdConfirmKicker').textContent=isUndo?'ANGRE SISTE ØKT':isMobility?'MOBILITET':isCardio?'KONDIS':'STYRKE';
    el('obdConfirmTitle').textContent=isUndo?'Fjerne siste økt?':`Registrer ${label}?`;
    el('obdConfirmText').textContent=isUndo?`Siste registrerte økt for ${person} blir fjernet.`:`Legg inn ${label} for ${person} nå.`;
    el('obdConfirmOk').textContent=isUndo?'Angre økt':'Registrer';
    wrap.classList.add('show');
    wrap.setAttribute('aria-hidden','false');
    document.body.classList.add('obd-modal-open');
    setTimeout(()=>el('obdConfirmOk')?.focus(),80);
    return new Promise(resolve=>{confirmResolver=resolve});
  }

  function callWithoutNativeConfirm(fn){
    const original=window.confirm;
    window.confirm=()=>true;
    try{return fn()}finally{window.confirm=original}
  }

  document.addEventListener('click',e=>{
    const button=e.target.closest?.('[data-add],[data-undo]');
    if(!button)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const isAdd=button.hasAttribute('data-add');
    const person=isAdd?button.dataset.person:button.dataset.undo;
    const kind=isAdd?button.dataset.add:'undo';
    openConfirm({kind,person}).then(ok=>{
      if(!ok)return;
      if(isAdd)callWithoutNativeConfirm(()=>window.addWorkout?.(person,kind));
      else callWithoutNativeConfirm(()=>window.undoWorkout?.(person));
    });
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&el('obdConfirm')?.classList.contains('show')){
      e.preventDefault();
      closeConfirm(false);
    }
  });

  const gymShouldDefer=detail=>typeof window.shouldDeferWorkoutPayoffForGym==='function'&&window.shouldDeferWorkoutPayoffForGym(detail);
  const deferForGym=detail=>{window.__obdGymDeferredPayoff=detail;};

  window.renderRewardEngine=renderRewardEngine;
  window.addEventListener('obd-workout-added',e=>{
    const detail=e.detail||{};
    setTimeout(()=>{
      if(window.__obdStarterStoryPriority){window.__obdStarterDeferredPayoff=detail;return}
      if(gymShouldDefer(detail)){deferForGym(detail);return}
      showWorkoutPayoff(detail);
    },0);
  });
  window.addEventListener('obd-starter-story-complete',e=>{
    const detail=e.detail||{};
    if(gymShouldDefer(detail)){deferForGym(detail);return}
    showWorkoutPayoff(detail);
  });
  window.addEventListener('obd-gym-flow-complete',e=>{
    const detail=window.__obdGymDeferredPayoff||e.detail||{};
    window.__obdGymDeferredPayoff=null;
    showWorkoutPayoff(detail);
  });
  window.addEventListener('obd-player-changed',renderRewardEngine);
  window.addEventListener('pageshow',renderRewardEngine);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderRewardEngine()});
})();
