(()=>{
  function renderBattleSummary(){
    try{
      const adrianDays=uniqueDays('Adrian',currentWeek());
      const rikardDays=uniqueDays('Rikard',currentWeek());
      const adrianXp=gained(adrianDays);
      const rikardXp=gained(rikardDays);
      const leader=adrianDays===rikardDays?'Delt':adrianDays>rikardDays?'Adrian':'Rikard';
      const adrianLevel=levelInfo('Adrian').level;
      const rikardLevel=levelInfo('Rikard').level;

      const score=document.getElementById('battleScore');
      const leaderEl=document.getElementById('battleLeader');
      const xp=document.getElementById('battleXp');
      const adrianImg=document.getElementById('battleAdrianImg');
      const rikardImg=document.getElementById('battleRikardImg');

      if(score)score.innerHTML=`${adrianDays} <small>VS</small> ${rikardDays}`;
      if(leaderEl)leaderEl.textContent=`♛ Ledertrøye: ${leader}`;
      if(xp)xp.textContent=`Adrian +${adrianXp} XP · Rikard +${rikardXp} XP`;
      if(adrianImg){adrianImg.src=`characters/adrian-${adrianLevel}.png`;adrianImg.alt=`Adrian Level ${adrianLevel}`;}
      if(rikardImg){rikardImg.src=`characters/rikard-${rikardLevel}.png`;rikardImg.alt=`Rikard Level ${rikardLevel}`;}
    }catch{}
  }

  const versus=document.getElementById('versus');
  if(versus){
    new MutationObserver(renderBattleSummary).observe(versus,{childList:true,characterData:true,subtree:true});
  }
  window.addEventListener('pageshow',renderBattleSummary);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderBattleSummary()});
  setTimeout(renderBattleSummary,100);
  setTimeout(renderBattleSummary,600);
  setInterval(renderBattleSummary,15000);
})();
