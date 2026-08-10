(()=>{
  const el=id=>document.getElementById(id);
  const osloWeekday=()=>new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Oslo',weekday:'short'}).format(new Date());
  const hasWorkoutToday=person=>{const today=ymd(new Date());return rows.some(r=>r.person===person&&ymd(r.created_at)===today)};

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
    title.textContent=detail.type==='cardio'?'Kondis registrert':'Styrke registrert';
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

  window.renderRewardEngine=renderRewardEngine;
  window.addEventListener('obd-workout-added',e=>showWorkoutPayoff(e.detail||{}));
  window.addEventListener('obd-player-changed',renderRewardEngine);
  window.addEventListener('pageshow',renderRewardEngine);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderRewardEngine()});
})();
