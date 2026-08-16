(()=>{
  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/weekly-summary';
  const PIN_KEY='obd_access_pin_v1';
  const checkedPlayers=new Set();
  let current=null;
  let loading=false;
  let restoreFocus=null;
  let hideTimer=null;

  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const playerById=(summary,id)=>summary.players.find(player=>player.id===id);
  const slugFor=player=>Number(player?.character_set)===1?'adrian':Number(player?.character_set)===3?'joachim':'rikard';
  const avatar=player=>`<span class="weekly-avatar"><img src="characters/${slugFor(player)}-1.png" alt="" draggable="false"></span>`;
  const rankLabel=rank=>rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`${rank}.`;
  const methodLabel=method=>method==='snipe'?'Snipe':'Random Shuffle';
  const poke=id=>window.getPokemon?.(id)||{id:Number(id),name:`Pokémon #${String(id).padStart(3,'0')}`,image:`dex-png/${id}.png`};
  const rarityFor=id=>[149,150,151].includes(Number(id))?'elite':[3,9,26,131,143,148,95,94,93,92,135,133,59,34,31,130,144,145,146,123,141,25,6].includes(Number(id))?'strong':'normal';
  const pokemonSprite=(item,method='')=>{
    const id=Number(item?.pokemon_id??item),pokemon=poke(id),rarity=item?.rarity||rarityFor(id),title=method?`${pokemon.name} · ${methodLabel(method)}`:`${pokemon.name} · ${rarity==='elite'?'Elite':rarity==='strong'?'Strong':'Normal'}`;
    return `<span class="weekly-pokemon-sprite ${rarity}" title="${esc(title)}"><img data-weekly-fallback src="${esc(pokemon.image)}" alt="${esc(pokemon.name)}" loading="lazy" draggable="false"></span>`;
  };

  function api(payload){
    let pin='1337';
    try{pin=localStorage.getItem(PIN_KEY)||pin}catch{}
    return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,pin}),keepalive:payload.action==='dismiss'}).then(async response=>{
      const text=await response.text();let data={};
      try{data=text?JSON.parse(text):{}}catch{data={error:text}}
      if(!response.ok)throw new Error(data.error||text||'Weekly Summary failed');
      return data;
    });
  }

  function weekLabel(week){
    const date=value=>new Date(`${value}T12:00:00Z`).toLocaleDateString('nb-NO',{day:'numeric',month:'short',timeZone:'Europe/Oslo'}).replace('.','');
    return `${date(week.start)} – ${date(week.end)}`;
  }

  function ensureModal(){
    let overlay=document.getElementById('weeklySummaryOverlay');
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.id='weeklySummaryOverlay';
    overlay.className='weekly-summary-overlay';
    overlay.hidden=true;
    overlay.innerHTML=`<section class="weekly-summary-card" role="dialog" aria-modal="true" aria-labelledby="weeklySummaryTitle">
      <header class="weekly-summary-top">
        <div class="weekly-summary-mark" aria-hidden="true">🏆</div>
        <div class="weekly-summary-title"><span>WEEKLY REPORT <b id="weeklySummaryDebug" class="weekly-debug-badge" hidden>DEBUG</b></span><h2 id="weeklySummaryTitle">WEEKLY SUMMARY</h2><small id="weeklySummaryDates"></small></div>
        <button class="weekly-summary-x" type="button" data-weekly-close aria-label="Lukk ukesammendrag">×</button>
      </header>
      <nav class="weekly-summary-tabs" role="tablist" aria-label="Ukesammendrag">
        <button id="weeklyTabWeek" class="weekly-summary-tab" type="button" role="tab" aria-controls="weeklySummaryWeek" aria-selected="true" data-weekly-tab="week">UKEN</button>
        <button id="weeklyTabGame" class="weekly-summary-tab" type="button" role="tab" aria-controls="weeklySummaryGame" aria-selected="false" tabindex="-1" data-weekly-tab="game">FANGST &amp; BOSS</button>
        <button id="weeklyTabHistory" class="weekly-summary-tab" type="button" role="tab" aria-controls="weeklySummaryHistory" aria-selected="false" tabindex="-1" data-weekly-tab="history">HISTORIKK</button>
      </nav>
      <div class="weekly-summary-scroll">
        <div id="weeklySummaryWeek" class="weekly-summary-panel active" role="tabpanel" aria-labelledby="weeklyTabWeek"></div>
        <div id="weeklySummaryGame" class="weekly-summary-panel" role="tabpanel" aria-labelledby="weeklyTabGame" hidden></div>
        <div id="weeklySummaryHistory" class="weekly-summary-panel" role="tabpanel" aria-labelledby="weeklyTabHistory" hidden></div>
      </div>
      <footer class="weekly-summary-footer"><button class="weekly-summary-close" type="button" data-weekly-close>LUKK UKESAMMENDRAG</button></footer>
    </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',event=>{
      if(event.target===overlay||event.target.closest('[data-weekly-close]')){closeSummary();return}
      const tab=event.target.closest('[data-weekly-tab]');
      if(tab){selectTab(tab.dataset.weeklyTab);return}
      const toggle=event.target.closest('[data-weekly-catch-toggle]');
      if(toggle){
        const row=toggle.closest('.weekly-wild-row');row?.classList.toggle('expanded');
        const expanded=row?.classList.contains('expanded');
        toggle.textContent=expanded?'Færre':`+${toggle.dataset.more}`;
        toggle.setAttribute('aria-expanded',String(!!expanded));
      }
    });
    overlay.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();closeSummary();return}
      if(event.key==='Tab'){
        const focusable=[...overlay.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element=>!element.closest('[hidden]'));
        const first=focusable[0],last=focusable.at(-1);
        if(first&&last&&event.shiftKey&&event.target===first){event.preventDefault();last.focus()}
        else if(first&&last&&!event.shiftKey&&event.target===last){event.preventDefault();first.focus()}
        return;
      }
      if(!event.target.matches('[data-weekly-tab]')||!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();
      const tabs=[...overlay.querySelectorAll('[data-weekly-tab]')],index=tabs.indexOf(event.target),direction=event.key==='ArrowRight'?1:-1,next=tabs[(index+direction+tabs.length)%tabs.length];
      next.focus();selectTab(next.dataset.weeklyTab);
    });
    return overlay;
  }

  function selectTab(name){
    const overlay=ensureModal(),map={week:'weeklySummaryWeek',game:'weeklySummaryGame',history:'weeklySummaryHistory'};
    overlay.querySelectorAll('[data-weekly-tab]').forEach(tab=>{const selected=tab.dataset.weeklyTab===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1});
    Object.entries(map).forEach(([key,id])=>{const panel=document.getElementById(id),active=key===name;panel?.classList.toggle('active',active);if(panel)panel.hidden=!active});
    overlay.querySelector('.weekly-summary-scroll')?.scrollTo({top:0,behavior:'smooth'});
  }

  function streakStatus(player){
    if(player.streak_status==='continued')return 'STREAK FORTSETTER';
    if(player.streak_status==='started')return 'NY STREAK';
    if(player.streak_status==='broken')return 'STREAK BRUTT';
    return 'INGEN AKTIV STREAK';
  }

  function renderStreaks(summary){
    return `<section class="weekly-block"><div class="weekly-block-head"><div><span>STREAK STATUS</span><h3>Spillerne</h3></div><small>Ved ukeslutt</small></div><div class="weekly-streak-grid">${summary.players.map(player=>`
      <div class="weekly-streak-chip ${player.streak_status==='broken'?'broken':''}"><span class="weekly-streak-flame">${player.streak_status==='broken'?'○':'🔥'}</span><span class="weekly-streak-copy"><strong>${esc(player.name)}</strong><small>${streakStatus(player)}</small></span><b class="weekly-streak-value">${player.streak}</b></div>`).join('')}</div></section>`;
  }

  function renderTrainingRanking(summary){
    const ranked=summary.training_ranking.map(item=>({...playerById(summary,item.id),rank:item.rank})).filter(player=>player.id);
    return `<section class="weekly-block"><div class="weekly-block-head"><div><span>WEEKLY SCOREBOARD</span><h3>Treningsdager</h3></div><small>Samme dag teller én gang</small></div><div class="weekly-ranking">${ranked.map(player=>`
      <div class="weekly-rank-row ${player.rank<=3?'top':''}"><b class="weekly-rank-number">${rankLabel(player.rank)}</b>${avatar(player)}<span class="weekly-rank-copy"><strong>${esc(player.name)}</strong><small>S ${player.strength} · K ${player.cardio} · ${player.workouts} økt${player.workouts===1?'':'er'}</small></span><span class="weekly-rank-score"><strong>${player.training_days}</strong><small>DAGER</small></span></div>`).join('')}</div></section>`;
  }

  function renderWeek(summary){
    const motivation=summary.motivation;
    return `<section class="weekly-hero ${esc(motivation.tone)}"><div class="weekly-hero-kicker"><span>${esc(motivation.eyebrow)}</span><b>${summary.players.find(player=>player.id===summary.viewer_player_id)?.xp_delta>=0?'+':''}${summary.players.find(player=>player.id===summary.viewer_player_id)?.xp_delta||0} XP</b></div><h3>${esc(motivation.headline)}</h3><p>${esc(motivation.text)}</p><div class="weekly-next-goal">${esc(motivation.next_goal)}</div></section>${renderStreaks(summary)}${renderTrainingRanking(summary)}`;
  }

  function renderWild(summary){
    const ranked=summary.wild_ranking.map(item=>({...playerById(summary,item.id),rank:item.rank})).filter(player=>player.id);
    return `<section class="weekly-block"><div class="weekly-block-head"><div><span>WILD POKÉMON</span><h3>Ukens fangster</h3></div><small>Elite → Strong ved likt</small></div><div class="weekly-ranking">${ranked.map(player=>{
      const catches=player.wild.catches||[],more=Math.max(0,catches.length-4);
      return `<div class="weekly-rank-row weekly-wild-row ${player.rank<=3?'top':''}"><b class="weekly-rank-number">${rankLabel(player.rank)}</b><span class="weekly-rank-copy"><strong>${esc(player.name)}</strong><small>${player.wild.elite} Elite · ${player.wild.strong} Strong</small></span><span class="weekly-catch-sprites">${catches.length?catches.map(item=>pokemonSprite(item)).join(''):'<i class="weekly-catch-empty">Ingen fangster</i>'}${more?`<button class="weekly-catch-toggle" type="button" data-weekly-catch-toggle data-more="${more}" aria-expanded="false">+${more}</button>`:''}</span><span class="weekly-rank-score"><strong>${player.wild.total}</strong><small>FANGET</small></span></div>`;
    }).join('')}</div></section>`;
  }

  function renderGym(summary){
    const ordered=[...summary.players].sort((left,right)=>right.gym.damage-left.gym.damage||right.gym.boss_ko-left.gym.boss_ko||left.name.localeCompare(right.name,'nb-NO'));
    const maxDamage=Math.max(0,...ordered.map(player=>player.gym.damage));
    return `<section class="weekly-block"><div class="weekly-block-head"><div><span>GYM BOSS</span><h3>Damage report</h3></div><small>Summert for uken</small></div><div class="weekly-gym-list">${ordered.map(player=>{
      const stolen=player.gym.stolen||[],mvp=maxDamage>0&&player.gym.damage===maxDamage;
      return `<div class="weekly-gym-row"><div class="weekly-gym-main"><span class="weekly-gym-name"><strong>${esc(player.name)}</strong><small>${mvp?'⚡ MVP DAMAGE':'GYM FIGHTER'}</small></span><span class="weekly-gym-metric"><strong>${Number(player.gym.damage).toLocaleString('nb-NO')}</strong><small>DAMAGE</small></span><span class="weekly-gym-metric"><strong>${player.gym.boss_ko}</strong><small>BOSS KO</small></span><span class="weekly-gym-metric"><strong>${stolen.length}</strong><small>STJÅLET</small></span></div><div class="weekly-gym-loot"><span class="weekly-stolen-sprites">${stolen.length?stolen.map(item=>pokemonSprite(item,item.method)).join(''):'<i class="weekly-catch-empty">Ingen Pokémon stjålet</i>'}</span><span class="weekly-methods">${player.gym.snipe?`<b class="weekly-method snipe">🎯 SNIPE ×${player.gym.snipe}</b>`:''}${player.gym.random_shuffle?`<b class="weekly-method">🔀 RANDOM ×${player.gym.random_shuffle}</b>`:''}</span></div></div>`;
    }).join('')}</div></section>`;
  }

  function renderGame(summary){
    const coverage=summary.coverage;
    const note=coverage&&!coverage.gameplay_events_complete
      ?`<div class="weekly-coverage-note"><b>FØRSTE LOGGUKE</b><span>Fangst- og bossdata teller fra ${new Date(`${coverage.gameplay_events_started_on}T12:00:00Z`).toLocaleDateString('nb-NO',{day:'numeric',month:'short',timeZone:'Europe/Oslo'}).replace('.','')}. Trening dekker hele uka.</span></div>`
      :'';
    return `${note}${renderWild(summary)}${renderGym(summary)}`;
  }

  function historyCell(value,average=false){
    const number=item=>average?Number(item||0).toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1}):Number(item||0).toLocaleString('nb-NO');
    return `<span class="weekly-history-cell"><b class="s">S ${number(value.strength)}</b><b class="k">K ${number(value.cardio)}</b></span>`;
  }

  function renderHistory(summary){
    return `<section class="weekly-block"><div class="weekly-block-head"><div><span>TRAINING HISTORY</span><h3>Sammenligning</h3></div><small>S = styrke · K = kondis</small></div><div class="weekly-history-wrap"><table class="weekly-history-table"><thead><tr><th>SPILLER</th><th>ALL-TIME</th><th>SISTE 4 UKER</th><th>SISTE 8 UKER</th><th>SNITT / UKE</th></tr></thead><tbody>${summary.players.map(player=>`<tr><td>${esc(player.name)}</td><td>${historyCell(player.history.all_time)}</td><td>${historyCell(player.history.last_4_weeks)}</td><td>${historyCell(player.history.last_8_weeks)}</td><td>${historyCell(player.history.average_8_weeks,true)}</td></tr>`).join('')}</tbody></table></div><p class="weekly-history-note">Kun vanlige, tellende økter er med. Etterregistrerte økter påvirker ikke spillet eller sammenligningen.</p></section>`;
  }

  function bindImageFallbacks(root){
    root.querySelectorAll('img[data-weekly-fallback]').forEach(image=>image.addEventListener('error',()=>image.parentElement?.classList.add('missing'),{once:true}));
  }

  function openSummary(response){
    const overlay=ensureModal(),summary=response.summary;
    if(hideTimer){clearTimeout(hideTimer);hideTimer=null}
    current={viewerId:summary.viewer_player_id,weekStart:summary.week.start};
    restoreFocus=document.activeElement;
    document.getElementById('weeklySummaryDates').textContent=weekLabel(summary.week);
    document.getElementById('weeklySummaryDebug').hidden=!response.debug;
    document.getElementById('weeklySummaryWeek').innerHTML=renderWeek(summary);
    document.getElementById('weeklySummaryGame').innerHTML=renderGame(summary);
    document.getElementById('weeklySummaryHistory').innerHTML=renderHistory(summary);
    bindImageFallbacks(overlay);
    selectTab('week');
    overlay.hidden=false;
    document.body.classList.add('weekly-summary-open');
    requestAnimationFrame(()=>{overlay.classList.add('show');setTimeout(()=>overlay.querySelector('.weekly-summary-x')?.focus(),80)});
  }

  function closeSummary(){
    const overlay=document.getElementById('weeklySummaryOverlay');
    if(!overlay||overlay.hidden)return;
    const closing=current;current=null;
    overlay.classList.remove('show');
    document.body.classList.remove('weekly-summary-open');
    hideTimer=setTimeout(()=>{overlay.hidden=true;hideTimer=null;try{restoreFocus?.focus?.()}catch{}},220);
    if(closing)api({action:'dismiss',viewer_player_id:closing.viewerId,week_start:closing.weekStart}).catch(error=>console.warn('Weekly Summary dismissal was not saved',error));
  }

  async function checkSummary(force=false){
    const viewerId=window.getSelectedPlayerId?.()||'';
    if(!window.obdAuthReady||!viewerId||loading||(!force&&checkedPlayers.has(viewerId)))return;
    checkedPlayers.add(viewerId);loading=true;
    try{
      const selected=(window.getBattlePlayers?.()||[]).map(player=>player.id).filter(Boolean);
      const response=await api({action:'get',viewer_player_id:viewerId,selected_player_ids:selected});
      if(response?.show&&response.summary)openSummary(response);
    }catch(error){console.warn('Weekly Summary unavailable',error)}
    finally{loading=false}
  }

  window.addEventListener('obd-auth-ready',()=>setTimeout(()=>checkSummary(),320));
  window.addEventListener('obd-player-changed',()=>setTimeout(()=>checkSummary(),180));
  window.addEventListener('pageshow',event=>{if(event.persisted){checkedPlayers.clear();setTimeout(()=>checkSummary(),180)}});
  if(window.obdAuthReady)setTimeout(()=>checkSummary(),320);
})();
