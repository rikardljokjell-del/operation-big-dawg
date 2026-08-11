(()=>{
  if(window.__obdUnboundedProgression)return;
  window.__obdUnboundedProgression=true;
  const rank=level=>typeof rankForLevel==='function'?rankForLevel(level):(Array.isArray(RANKS)?RANKS[Math.min(RANKS.length,Math.max(1,Number(level)||1))-1]:'Gym Warlord');

  function patchMainCards(){
    if(typeof personCard==='function'&&!window.__obdPersonCardUnbounded){
      window.__obdPersonCardUnbounded=true;
      personCard=function(p){
        const i=levelInfo(p),n=uniqueDays(p,currentWeek()),st=streakInfo(p),pct=i.inLevel*10,next=`${10-i.inLevel} XP til Level ${i.level+1}`,days=creditedRowsFor(p).length;
        return `<div class="fighter-heading"><div><div class="fighter-name">${p}<span class="crown">♛</span></div><div class="fighter-rank">Level ${i.level} · ${i.rank}</div></div><span class="level-chip">LEVEL ${i.level}</span></div><div class="fighter-main"><div class="fighter-character">${fig(p,i.level)}</div><div class="fighter-metrics"><div class="metric"><span>TRENINGS-DAGER</span><strong>${days}</strong></div><div class="metric"><span>DENNE UKA</span><strong>${n}/3</strong></div><div class="metric streak"><span>STREAK</span><strong>🔥 ${st.current}</strong></div></div></div><div class="fighter-xp"><div class="fighter-xp-line"><strong>${i.xp} total XP</strong><span>${next}</span></div><div class="xpbar"><div class="xpfill" style="width:${pct}%"></div></div></div><div class="actions"><button class="btn strength" data-add="strength" data-person="${p}">＋ Styrke</button><button class="btn cardio" data-add="cardio" data-person="${p}">＋ Kondis</button><button class="btn undo" data-undo="${p}">Angre siste økt</button></div>`;
      };
    }
    if(typeof evolutionCard==='function'&&!window.__obdEvolutionCardUnbounded){
      window.__obdEvolutionCardUnbounded=true;
      evolutionCard=function(p){
        const i=levelInfo(p),slug=typeof characterSlug==='function'?characterSlug(p):(String(p).toLowerCase()==='adrian'?'adrian':'rikard');
        const thumbs=Array.from({length:10},(_,idx)=>{
          const level=idx+1,isCurrent=i.level>=10?level===10:level===i.level,state=isCurrent?'current':level>i.level?'future':'unlocked',title=level>i.level?`Level ${level} · Locked`:`Level ${level}: ${RANKS[idx]}`;
          return `<div class="evo-thumb ${state}" title="${title}"><img src="characters/${slug}-${level}.png" alt="${level>i.level?'Skjult kommende evolution':`${p} evolution ${level}`}" draggable="false"><span>${level}</span></div>`;
        }).join('');
        const meta=i.level>=10?`Level ${i.level} · Final form`:`Level ${i.level}`;
        return `<div class="evolution-head"><strong>${p}s evolution</strong><span>${meta}</span></div><div class="evolution-track">${thumbs}</div>`;
      };
    }
    if(typeof showEvolution==='function'&&!window.__obdEvolutionOverlayUnbounded){
      window.__obdEvolutionOverlayUnbounded=true;
      showEvolution=function(person,from,to){
        levelSound();
        $('evoTitle').textContent=to<=10?`${person} is evolving…`:`LEVEL UP!`;
        $('evoOld').innerHTML=fig(person,Math.min(10,from),true);$('evoNew').innerHTML=fig(person,Math.min(10,to),true);
        $('evoOld').classList.add('evolving');$('evoNew').classList.add('flash');
        $('evoText').textContent=to<=10?`${person} evolved into Level ${to}: ${rank(to)}`:`${person} reached Level ${to} · ${rank(to)}`;
        $('evoOverlay').classList.add('show');
        setTimeout(()=>{$('evoOld').classList.remove('evolving');$('evoNew').classList.remove('flash');$('evoTitle').textContent=to<=10?'Evolution complete!':'Level up complete!';$('evoText').textContent=`${person} · Level ${to} · ${rank(to)}`;evoTimer=setTimeout(closeEvolution,4200)},1200);
      };
    }
  }

  function renderRewardUnbounded(){
    try{
      const el=id=>document.getElementById(id),engine=el('rewardEngine');if(!engine||!Array.isArray(rows))return;
      const person=typeof activePlayer==='function'?activePlayer():(window.getSelectedPlayer?.()||'Rikard'),days=uniqueDays(person,currentWeek()),info=levelInfo(person),streak=streakInfo(person),nextXp=nextImmediate(days),xpToLevel=10-info.inLevel,today=ymd(new Date()),todayDone=rowsForPlayer(person).some(r=>ymd(r.created_at)===today),weekday=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Oslo',weekday:'short'}).format(new Date()),danger=weekday==='Thu'&&days<=2,missing=Math.max(0,3-days);
      engine.classList.toggle('danger',danger);el('rewardPlayer').textContent=person.toUpperCase();el('rewardKicker').textContent=danger?'STREAK I FARE':'NEXT REWARD';
      if(danger){el('rewardHeadline').textContent=`${missing} ${missing===1?'treningsdag':'treningsdager'} mangler`;el('rewardSub').textContent=`Torsdag: ${days}/3 tellende dager. Få inn ${missing} ${missing===1?'ny treningsdag':'nye treningsdager'} innen søndag for å holde streaken i live.`}
      else if(!todayDone){el('rewardHeadline').textContent=nextXp>0?`Neste treningsdag gir +${nextXp} XP`:'Ukas XP er hentet';el('rewardSub').textContent=`${xpToLevel} XP til Level ${info.level+1} · ${rank(info.level+1)}.`}
      else{el('rewardHeadline').textContent='Dagens mission er fullført ✓';el('rewardSub').textContent=nextXp>0?`Neste nye treningsdag gir +${nextXp} XP. ${xpToLevel} XP til Level ${info.level+1}.`:`Alle ukas 15 XP er hentet. Hold streaken varm.`}
      el('rewardNextXp').textContent=days>=7?'MAX':`+${nextXp} XP`;el('rewardNextLevel').textContent=`${xpToLevel} XP`;const mission=el('rewardMission');mission.textContent=todayDone?'Fullført ✓':'Logg én økt';mission.closest('.reward-chip')?.classList.toggle('complete',todayDone);el('rewardStreakMeta').textContent=`🔥 ${streak.current}`;el('rewardLevelFill').style.width=`${info.inLevel*10}%`;
    }catch(e){console.warn('Unbounded reward render failed',e)}
  }

  function patchReward(){window.renderRewardEngine=renderRewardUnbounded;renderRewardUnbounded()}
  function patchBattleImages(){
    document.querySelectorAll('[data-battle-player] .battle-fighter-art img').forEach(img=>{
      const src=img.getAttribute('src')||'',m=src.match(/^(characters\/.+?)-(\d+)\.png$/);if(m&&Number(m[2])>10)img.src=`${m[1]}-10.png`;
    });
  }
  function patchCompleteVictory(){
    const dexButton=[...document.querySelectorAll('[data-dex]')].find(b=>/151\/151/.test(b.textContent||''));if(!dexButton)return;
    const modal=document.getElementById('bossModal');if(!modal)return;
    const p=[...modal.querySelectorAll('p')].find(x=>/You stole every Pokémon/i.test(x.textContent||''));if(p)p.textContent='GymDex complete. No new Pokémon are awarded, but the next Gym Leader is already waiting.';
    const banner=modal.querySelector('.stolen-pokemon-banner');if(banner)banner.innerHTML='<span>GYMDEX COMPLETE · 151/151</span><div><small>No new Pokémon awarded. Keep fighting.</small></div>';
  }
  function patchPayoff(detail){setTimeout(()=>{try{const sub=document.getElementById('payoffSub'),fill=document.getElementById('payoffFill');if(sub)sub.textContent=`${10-(Number(detail.afterInLevel)||0)} XP til Level ${Number(detail.levelAfter||1)+1} · ${rank(Number(detail.levelAfter||1)+1)}`;if(fill)fill.style.width=`${Math.max(0,Math.min(100,(Number(detail.afterInLevel)||0)*10))}%`}catch{}},80)}

  patchMainCards();patchReward();
  if(typeof render==='function')setTimeout(()=>render(),0);
  const observer=new MutationObserver(()=>{patchBattleImages();patchCompleteVictory()});observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('obd-workout-added',e=>patchPayoff(e.detail||{}));
  window.addEventListener('obd-player-changed',()=>setTimeout(()=>{patchReward();patchBattleImages()},0));
  setInterval(()=>{patchBattleImages();patchCompleteVictory()},1500);
})();