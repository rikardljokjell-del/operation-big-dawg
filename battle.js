(()=>{
  function ensureBattlePanels(){
    const summary=document.getElementById('battleSummary');
    const adrianSide=summary?.querySelector('.battle-side-adrian');
    const rikardSide=summary?.querySelector('.battle-side-rikard');
    if(!summary||!adrianSide||!rikardSide)return;

    if(!document.getElementById('battleAdrianStats')){
      adrianSide.insertAdjacentHTML('afterend',`
        <div id="battleAdrianStats" class="battle-stat-panel battle-stat-adrian" aria-label="Adrian statistikk">
          <div class="battle-stat-row battle-stat-workouts">
            <span class="battle-stat-label">🏋 Økter</span>
            <strong id="battleAdrianWorkouts">0/100</strong>
            <div class="battle-stat-progress"><i id="battleAdrianWorkoutsFill"></i></div>
          </div>
          <div class="battle-stat-row battle-stat-level-row">
            <span class="battle-stat-label">◆ Level</span>
            <strong id="battleAdrianStatLevel">1</strong>
            <small id="battleAdrianStatRank">Couch Recruit</small>
          </div>
          <div class="battle-stat-row battle-stat-streak-row">
            <span class="battle-stat-label">🔥 Streak</span>
            <strong><span id="battleAdrianStreak">0</span><small> uker</small></strong>
          </div>
        </div>`);
    }

    if(!document.getElementById('battleRikardStats')){
      rikardSide.insertAdjacentHTML('beforebegin',`
        <div id="battleRikardStats" class="battle-stat-panel battle-stat-rikard" aria-label="Rikard statistikk">
          <div class="battle-stat-row battle-stat-workouts">
            <span class="battle-stat-label">🏋 Økter</span>
            <strong id="battleRikardWorkouts">0/100</strong>
            <div class="battle-stat-progress"><i id="battleRikardWorkoutsFill"></i></div>
          </div>
          <div class="battle-stat-row battle-stat-level-row">
            <span class="battle-stat-label">◆ Level</span>
            <strong id="battleRikardStatLevel">1</strong>
            <small id="battleRikardStatRank">Couch Recruit</small>
          </div>
          <div class="battle-stat-row battle-stat-streak-row">
            <span class="battle-stat-label">🔥 Streak</span>
            <strong><span id="battleRikardStreak">0</span><small> uker</small></strong>
          </div>
        </div>`);
    }
  }

  function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=value}
  function setProgress(id,value){const el=document.getElementById(id);if(el)el.style.width=Math.min(100,Math.max(0,value))+'%'}

  function renderBattleSummary(){
    try{
      ensureBattlePanels();
      const adrianDays=uniqueDays('Adrian',currentWeek());
      const rikardDays=uniqueDays('Rikard',currentWeek());
      const adrianXp=gained(adrianDays);
      const rikardXp=gained(rikardDays);
      const leader=adrianDays===rikardDays?'Delt':adrianDays>rikardDays?'Adrian':'Rikard';
      const adrian=levelInfo('Adrian');
      const rikard=levelInfo('Rikard');
      const adrianStreak=streakInfo('Adrian').current;
      const rikardStreak=streakInfo('Rikard').current;
      const adrianWorkouts=rows.filter(r=>r.person==='Adrian').length;
      const rikardWorkouts=rows.filter(r=>r.person==='Rikard').length;

      const score=document.getElementById('battleScore');
      const leaderEl=document.getElementById('battleLeader');
      const xp=document.getElementById('battleXp');
      const adrianImg=document.getElementById('battleAdrianImg');
      const rikardImg=document.getElementById('battleRikardImg');
      const adrianRank=document.getElementById('battleAdrianRank');
      const rikardRank=document.getElementById('battleRikardRank');
      const adrianLevel=document.getElementById('battleAdrianLevel');
      const rikardLevel=document.getElementById('battleRikardLevel');

      if(score)score.innerHTML=`${adrianDays} <small>VS</small> ${rikardDays}`;
      if(leaderEl)leaderEl.textContent=`♛ Ledertrøye: ${leader}`;
      if(xp)xp.textContent=`Adrian +${adrianXp} XP · Rikard +${rikardXp} XP`;
      if(adrianImg){adrianImg.src=`characters/adrian-${adrian.level}.png`;adrianImg.alt=`Adrian Level ${adrian.level}`;}
      if(rikardImg){rikardImg.src=`characters/rikard-${rikard.level}.png`;rikardImg.alt=`Rikard Level ${rikard.level}`;}
      if(adrianRank)adrianRank.textContent=adrian.rank;
      if(rikardRank)rikardRank.textContent=rikard.rank;
      if(adrianLevel)adrianLevel.textContent=`Level ${adrian.level}`;
      if(rikardLevel)rikardLevel.textContent=`Level ${rikard.level}`;

      setText('battleAdrianWorkouts',`${adrianWorkouts}/100`);
      setText('battleRikardWorkouts',`${rikardWorkouts}/100`);
      setProgress('battleAdrianWorkoutsFill',adrianWorkouts);
      setProgress('battleRikardWorkoutsFill',rikardWorkouts);
      setText('battleAdrianStatLevel',adrian.level);
      setText('battleRikardStatLevel',rikard.level);
      setText('battleAdrianStatRank',adrian.rank);
      setText('battleRikardStatRank',rikard.rank);
      setText('battleAdrianStreak',adrianStreak);
      setText('battleRikardStreak',rikardStreak);
    }catch{}
  }

  ensureBattlePanels();
  const versus=document.getElementById('versus');
  if(versus){
    new MutationObserver(renderBattleSummary).observe(versus,{childList:true,characterData:true,subtree:true});
  }
  window.addEventListener('pageshow',renderBattleSummary);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderBattleSummary()});
  window.addEventListener('obd-player-changed',renderBattleSummary);
  setTimeout(renderBattleSummary,100);
  setTimeout(renderBattleSummary,600);
  setInterval(renderBattleSummary,15000);
})();
