(()=>{
  function renderBattleSummary(){
    try{
      const adrianDays=uniqueDays('Adrian',currentWeek());
      const rikardDays=uniqueDays('Rikard',currentWeek());
      const adrianXp=gained(adrianDays);
      const rikardXp=gained(rikardDays);
      const leader=adrianDays===rikardDays?'Delt':adrianDays>rikardDays?'Adrian':'Rikard';
      const adrian=levelInfo('Adrian');
      const rikard=levelInfo('Rikard');

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
    }catch{}
  }

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
