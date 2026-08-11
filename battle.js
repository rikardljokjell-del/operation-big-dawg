(()=>{
  const STORE_KEY='obd_battle_players_v1';
  const MANUAL_STORE_KEY='obd_battle_players_manual_v1';
  let memoryStore={};
  let memoryManualStore={};

  if(!document.querySelector('link[href="battle-multi.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='battle-multi.css';
    document.head.appendChild(link);
  }

  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const players=()=>typeof window.getPlayers==='function'?window.getPlayers():[];
  const activeMeta=()=>{
    const id=typeof window.getSelectedPlayerId==='function'?window.getSelectedPlayerId():'';
    const name=typeof window.getSelectedPlayer==='function'?window.getSelectedPlayer():'';
    return players().find(p=>p.id===id)||players().find(p=>p.name===name)||null;
  };
  const readMap=()=>{
    try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{}}catch{return memoryStore}
  };
  const writeMap=map=>{
    memoryStore=map;
    try{localStorage.setItem(STORE_KEY,JSON.stringify(map))}catch{}
  };
  const readManualMap=()=>{
    try{return JSON.parse(localStorage.getItem(MANUAL_STORE_KEY)||'{}')||{}}catch{return memoryManualStore}
  };
  const writeManualMap=map=>{
    memoryManualStore=map;
    try{localStorage.setItem(MANUAL_STORE_KEY,JSON.stringify(map))}catch{}
  };

  function defaultSelection(all,active){
    if(!active)return [];
    const ids=[active.id,...all.filter(p=>p.id!==active.id).map(p=>p.id)].slice(0,6);
    return ids.map(id=>all.find(p=>p.id===id)).filter(Boolean);
  }

  function selectionForActive(){
    const all=players(),active=activeMeta();
    if(!active)return [];
    const map=readMap(),manualMap=readManualMap();
    const hasManualSelection=manualMap[active.id]===true;
    if(!hasManualSelection)return defaultSelection(all,active);

    const stored=Array.isArray(map[active.id])?map[active.id]:[];
    const available=new Set(all.map(p=>p.id));
    let ids=[active.id,...stored.filter(id=>id!==active.id&&available.has(id))];
    ids=[...new Set(ids)].slice(0,6);
    if(ids.length<2&&all.length>1){
      const firstOther=all.find(p=>p.id!==active.id);
      if(firstOther)ids.push(firstOther.id);
    }
    return ids.map(id=>all.find(p=>p.id===id)).filter(Boolean);
  }

  window.getBattlePlayers=()=>selectionForActive().map(p=>({...p}));
  window.getBattlePlayerNames=()=>selectionForActive().map(p=>p.name);

  const workoutCount=p=>typeof rowsForPlayer==='function'?rowsForPlayer(p.name).length:rows.filter(r=>r.person===p.name).length;
  const weekDays=p=>uniqueDays(p.name,currentWeek());
  const themeFor=p=>Number(p.character_set)===1?'adrian':'rikard';
  const imageFor=(p,level)=>`characters/${typeof characterSlug==='function'?characterSlug(p.name):themeFor(p)}-${level}.png`;

  function battleGoal(){
    const selected=selectionForActive();
    const target=Math.max(100,selected.length*100);
    const total=selected.reduce((sum,p)=>sum+workoutCount(p),0);
    return{selected,target,total};
  }

  function renderBattleGoalHero(){
    const totalEl=document.getElementById('total'),fill=document.getElementById('fill'),percent=document.getElementById('heroPercent'),next=document.getElementById('nextMilestone'),left=document.getElementById('milestoneLeft');
    if(!totalEl||!fill||!percent||!next||!left)return;
    const {selected,target,total}=battleGoal();
    const pct=Math.min(100,target?total/target*100:0);
    totalEl.textContent=`${total} / ${target}`;
    fill.style.width=pct+'%';
    percent.textContent=`${Math.round(pct)}%`;
    const label=totalEl.closest('.mission-progress')?.querySelector('.mission-meta span');
    if(label)label.textContent=`Økter · ${selected.length} ${selected.length===1?'spiller':'spillere'}`;
    const milestones=[.25,.5,.75,1].map(x=>Math.round(target*x));
    const milestone=milestones.find(x=>x>total)||target;
    next.textContent=total>=target?'Mission complete 🏆':milestone;
    left.textContent=total>=target?'':`${milestone-total} igjen`;
  }

  // Replace the old 100-day hero calculation once battle.js has loaded.
  if(typeof renderHero==='function')renderHero=renderBattleGoalHero;

  function leaderText(selected){
    if(!selected.length)return '♛ Ledertrøye: –';
    const scored=selected.map(p=>({p,days:weekDays(p)})),max=Math.max(...scored.map(x=>x.days));
    const leaders=scored.filter(x=>x.days===max).map(x=>x.p.name);
    if(leaders.length===selected.length)return '♛ Ledertrøye: Delt';
    if(leaders.length>1)return `♛ Ledertrøye: Delt · ${leaders.join(' / ')}`;
    return `♛ Ledertrøye: ${leaders[0]}`;
  }

  function fighterCard(p){
    const info=levelInfo(p.name),days=weekDays(p),streak=streakInfo(p.name).current,workouts=workoutCount(p),theme=themeFor(p),pct=Math.min(100,workouts);
    return `<article class="battle-fighter-card battle-theme-${theme}" data-battle-player="${esc(p.id)}">
      <div class="battle-week-badge"><small>UKE</small><strong>${days}/7</strong></div>
      <div class="battle-fighter-art"><img src="${imageFor(p,info.level)}" alt="${esc(p.name)} Level ${info.level}" draggable="false"></div>
      <div class="battle-fighter-rank">${esc(info.rank)}</div>
      <div class="battle-fighter-name">${esc(p.name)}</div>
      <div class="battle-fighter-level">Level ${info.level}</div>
      <div class="battle-fighter-hud">
        <div class="battle-hud-workouts"><span>🏋 Økter</span><strong>${workouts}/100</strong><i><b style="width:${pct}%"></b></i></div>
        <div><span>◆ Level</span><strong>${info.level}</strong></div>
        <div><span>🔥 Streak</span><strong>${streak}<small> uker</small></strong></div>
      </div>
    </article>`;
  }

  function renderBattleSummary(){
    try{
      const summary=document.getElementById('battleSummary');
      if(!summary)return;
      const selected=selectionForActive();
      const count=selected.length;
      const scores=selected.map(p=>`${esc(p.name)} ${weekDays(p)}`).join(' · ');
      const xp=selected.map(p=>`${esc(p.name)} +${gained(weekDays(p))} XP`).join(' · ');
      summary.className=`battle-summary battle-multi battle-count-${Math.max(1,Math.min(6,count))}`;
      summary.innerHTML=`
        <div class="battle-multi-head">
          <div class="battle-multi-title"><span class="battle-kicker">WEEKLY BATTLE</span><strong>${scores||'Ingen spillere'}</strong></div>
          <button id="battleConfigure" class="battle-configure" type="button" aria-label="Velg spillere i Weekly Battle">⚙ Velg spillere</button>
          <div class="leader-shirt">${leaderText(selected)}</div>
          <div class="battle-summary-line"><span>UKESSAMMENDRAG</span><strong>${xp||'–'}</strong></div>
        </div>
        <div class="battle-roster">${selected.map(fighterCard).join('')}</div>`;
      document.getElementById('battleConfigure')?.addEventListener('click',openPicker);
      renderBattleGoalHero();
    }catch(e){console.warn('Weekly Battle render failed',e)}
  }

  function ensurePicker(){
    let wrap=document.getElementById('battlePicker');
    if(wrap)return wrap;
    wrap=document.createElement('div');
    wrap.id='battlePicker';
    wrap.className='battle-picker';
    wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML=`<div class="battle-picker-backdrop" data-battle-cancel></div><div class="battle-picker-card" role="dialog" aria-modal="true" aria-labelledby="battlePickerTitle">
      <span class="battle-kicker">WEEKLY BATTLE</span>
      <h3 id="battlePickerTitle">Velg spillere</h3>
      <p>Din karakter er alltid med. Velg totalt 2–6 spillere, eller færre hvis det ikke finnes flere.</p>
      <div id="battlePickerList" class="battle-picker-list"></div>
      <div class="battle-picker-meta"><span id="battlePickerCount">0 valgt</span><span id="battlePickerError"></span></div>
      <div class="battle-picker-actions"><button type="button" class="access-secondary" data-battle-cancel>Avbryt</button><button id="battlePickerSave" type="button" class="access-primary">Lagre</button></div>
    </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',e=>{
      if(e.target.closest('[data-battle-cancel]')){closePicker();return}
      const option=e.target.closest('[data-battle-option]');
      if(option){
        e.preventDefault();
        const input=option.querySelector('input');
        if(!input||input.disabled)return;
        input.checked=!input.checked;
        enforcePickerLimit(input);
        updatePickerMeta();
      }
    });
    wrap.querySelector('#battlePickerSave')?.addEventListener('click',savePicker);
    return wrap;
  }

  function openPicker(){
    const wrap=ensurePicker(),all=players(),active=activeMeta(),selected=new Set(selectionForActive().map(p=>p.id));
    const list=wrap.querySelector('#battlePickerList');
    list.innerHTML=all.map(p=>{
      const fixed=p.id===active?.id;
      return `<label class="battle-picker-option ${fixed?'fixed':''}" data-battle-option="${esc(p.id)}">
        <input type="checkbox" value="${esc(p.id)}" ${selected.has(p.id)?'checked':''} ${fixed?'disabled':''}>
        <img src="characters/${themeFor(p)}-1.png" alt="" draggable="false">
        <span><strong>${esc(p.name)}</strong><small>Character ${Number(p.character_set)||1}${fixed?' · DIN':''}</small></span>
        <b>✓</b>
      </label>`;
    }).join('');
    wrap.classList.add('show');
    wrap.setAttribute('aria-hidden','false');
    document.body.classList.add('obd-modal-open');
    updatePickerMeta();
  }

  function pickerChecked(){
    const wrap=document.getElementById('battlePicker');
    if(!wrap)return [];
    const active=activeMeta();
    const checked=[...wrap.querySelectorAll('#battlePickerList input:checked')].map(i=>i.value);
    if(active&&!checked.includes(active.id))checked.unshift(active.id);
    return [...new Set(checked)];
  }

  function enforcePickerLimit(lastInput){
    const checked=pickerChecked();
    const error=document.getElementById('battlePickerError');
    if(checked.length<=6){if(error)error.textContent='';return}
    if(lastInput&&!lastInput.disabled)lastInput.checked=false;
    if(error)error.textContent='Maks 6 spillere.';
  }

  function updatePickerMeta(){
    const checked=pickerChecked(),count=document.getElementById('battlePickerCount'),error=document.getElementById('battlePickerError');
    if(count)count.textContent=`${checked.length} valgt`;
    if(error&&checked.length<=6&&error.textContent==='Maks 6 spillere.')error.textContent='';
  }

  function closePicker(){
    const wrap=document.getElementById('battlePicker');
    if(!wrap)return;
    wrap.classList.remove('show');
    wrap.setAttribute('aria-hidden','true');
    document.body.classList.remove('obd-modal-open');
  }

  function savePicker(){
    const all=players(),active=activeMeta(),checked=pickerChecked(),error=document.getElementById('battlePickerError');
    if(!active)return;
    if(all.length>1&&checked.length<2){if(error)error.textContent='Velg minst 2 spillere.';return}
    if(checked.length>6){if(error)error.textContent='Maks 6 spillere.';return}
    const available=new Set(all.map(p=>p.id));
    const ids=[active.id,...checked.filter(id=>id!==active.id&&available.has(id))].slice(0,6);
    const map=readMap();map[active.id]=[...new Set(ids)];writeMap(map);
    const manualMap=readManualMap();manualMap[active.id]=true;writeManualMap(manualMap);
    closePicker();
    renderBattleSummary();
    window.dispatchEvent(new CustomEvent('obd-battle-changed',{detail:{playerId:active.id,playerIds:map[active.id]}}));
    if(typeof toast==='function')toast(`Weekly Battle: ${map[active.id].length} spillere`);
  }

  window.renderBattleSummary=renderBattleSummary;
  window.renderBattleGoalHero=renderBattleGoalHero;

  const versus=document.getElementById('versus');
  if(versus)new MutationObserver(renderBattleSummary).observe(versus,{childList:true,characterData:true,subtree:true});
  window.addEventListener('pageshow',renderBattleSummary);
  window.addEventListener('obd-player-changed',()=>{closePicker();renderBattleSummary()});
  window.addEventListener('obd-player-created',renderBattleSummary);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderBattleSummary()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('battlePicker')?.classList.contains('show'))closePicker()});
  setTimeout(renderBattleSummary,100);
  setTimeout(renderBattleSummary,600);
  setInterval(renderBattleSummary,15000);
})();
