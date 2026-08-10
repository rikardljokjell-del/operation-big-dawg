(()=>{
  const PIN_KEY='obd_access_pin_v1';
  const LEGACY_PLAYER_KEY='obd_selected_player_v1';
  const PLAYER_ID_KEY='obd_selected_player_id_v2';
  const VERIFIED_PLAYER_KEY='obd_verified_player_id_v1';
  const APP_PIN='1337';
  const NAME_RE=/^[\p{L}\p{N}][\p{L}\p{N} .'-]{0,39}$/u;
  let memoryStore={};
  let players=[];
  let selectedPlayer=null;
  let pendingPlayer=null;
  let loginVerifiedIds=new Set();
  let unlocked=false;
  let compatPromise=null;

  const readStore=(key,fallback='')=>{try{return localStorage.getItem(key)||fallback}catch{return memoryStore[key]||fallback}};
  const writeStore=(key,value)=>{try{localStorage.setItem(key,value)}catch{memoryStore[key]=value}};
  const removeStore=key=>{try{localStorage.removeItem(key)}catch{delete memoryStore[key]}};
  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const themeFor=p=>Number(p?.character_set)===1?'adrian':'rikard';
  const imageFor=p=>`characters/${themeFor(p)}-1.png`;

  window.getSelectedPlayer=()=>selectedPlayer?.name||'';
  window.getSelectedPlayerId=()=>selectedPlayer?.id||'';
  window.getPlayerMeta=value=>players.find(p=>p.id===value||p.name===value)||null;
  window.getPlayers=()=>players.map(p=>({...p}));
  window.obdAuthReady=false;

  const baseCall=call;
  call=window.call=async function(payload,pinOverride){
    const pin=pinOverride!==undefined?String(pinOverride):readStore(PIN_KEY);
    return baseCall({...payload,pin});
  };

  const gate=$('accessGate'),pinStep=$('pinStep'),playerStep=$('playerStep'),pinForm=$('pinForm'),pinInput=$('pinInput'),pinError=$('pinError'),pinSubmit=$('pinSubmit'),gateClose=$('gateClose'),switchBtn=$('playerSwitch'),label=$('selectedPlayerLabel');

  function buildPlayerGate(){
    const pinText=pinStep?.querySelector('p');
    if(pinText)pinText.textContent='Bruk master-PIN eller PIN-koden til en registrert karakter.';

    playerStep.innerHTML=`
      <div class="player-picker-head">
        <div><h1>VELG KARAKTER</h1><p>Sist valgte karakter huskes på denne enheten. Bytte til en annen karakter krever den karakterens PIN.</p></div>
        <button id="newPlayerButton" class="new-player-button" type="button">＋ Ny spiller</button>
      </div>
      <div id="playerListError" class="pin-error" aria-live="polite"></div>
      <div id="playerChoices" class="player-choices player-choices-dynamic"></div>
      <div id="playerEmpty" class="player-empty" hidden>Ingen spillere ennå. Opprett den første.</div>`;

    let createStep=$('newPlayerStep');
    if(!createStep){
      createStep=document.createElement('div');
      createStep.id='newPlayerStep';
      createStep.className='access-step';
      createStep.hidden=true;
      createStep.innerHTML=`
        <div class="new-player-title"><span class="access-kicker">NEW FIGHTER</span><h1>NY SPILLER</h1><p>Velg navn, karaktersett og en enkel personlig PIN.</p></div>
        <form id="newPlayerForm" class="new-player-form" novalidate>
          <label class="new-player-field"><span>Navn</span><input id="newPlayerName" maxlength="40" autocomplete="off" placeholder="F.eks. Ola" required></label>
          <fieldset class="character-set-picker">
            <legend>Karakterutseende</legend>
            <label class="character-set-choice">
              <input type="radio" name="characterSet" value="1" checked>
              <span class="character-set-art"><img src="characters/adrian-1.png" alt="Character 1, Level 1" draggable="false"></span>
              <strong>CHARACTER 1</strong><small>Level 1</small>
            </label>
            <label class="character-set-choice">
              <input type="radio" name="characterSet" value="2">
              <span class="character-set-art"><img src="characters/rikard-1.png" alt="Character 2, Level 1" draggable="false"></span>
              <strong>CHARACTER 2</strong><small>Level 1</small>
            </label>
          </fieldset>
          <label class="new-player-field"><span>Personlig PIN · 4 tall</span><input id="newPlayerPin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••" required></label>
          <div class="pin-plain-warning">⚠ PIN lagres ukryptert og er kun ment som enkel beskyttelse av karakteren.</div>
          <div id="newPlayerError" class="pin-error" aria-live="polite"></div>
          <div class="new-player-actions"><button id="cancelNewPlayer" class="access-secondary" type="button">Avbryt</button><button id="saveNewPlayer" class="access-primary" type="submit">Lagre</button></div>
        </form>`;
      playerStep.insertAdjacentElement('afterend',createStep);
    }

    let playerPinStep=$('playerPinStep');
    if(!playerPinStep){
      playerPinStep=document.createElement('div');
      playerPinStep.id='playerPinStep';
      playerPinStep.className='access-step';
      playerPinStep.hidden=true;
      playerPinStep.innerHTML=`
        <div class="new-player-title"><span class="access-kicker">CHARACTER LOCK</span><h1>SKRIV PIN</h1><p id="playerPinPrompt">Bekreft PIN for karakteren.</p></div>
        <form id="playerPinForm" class="new-player-form" novalidate>
          <div id="playerPinPreview" class="character-set-choice">
            <span class="character-set-art"><img id="playerPinImage" src="characters/adrian-1.png" alt="" draggable="false"></span>
            <strong id="playerPinName">KARAKTER</strong><small id="playerPinCharacter">Character 1</small>
          </div>
          <label class="new-player-field"><span>Karakter-PIN · 4 tall</span><input id="playerPinInput" type="password" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="••••" required></label>
          <div class="pin-plain-warning">PIN kreves når du bytter karakter. Sist valgte karakter huskes på denne enheten.</div>
          <div id="playerPinError" class="pin-error" aria-live="polite"></div>
          <div class="new-player-actions"><button id="cancelPlayerPin" class="access-secondary" type="button">Avbryt</button><button id="confirmPlayerPin" class="access-primary" type="submit">Fortsett</button></div>
        </form>`;
      createStep.insertAdjacentElement('afterend',playerPinStep);
    }

    $('newPlayerButton').addEventListener('click',showNewPlayer);
    $('cancelNewPlayer').addEventListener('click',()=>showPlayerPicker(false));
    $('newPlayerForm').addEventListener('submit',createPlayer);
    $('cancelPlayerPin').addEventListener('click',()=>showPlayerPicker(false));
    $('playerPinForm').addEventListener('submit',verifyPendingPlayer);
    $('playerChoices').addEventListener('click',e=>{
      const btn=e.target.closest('[data-player-id]');
      if(btn)requestPlayerChoice(btn.dataset.playerId);
    });
  }

  function renderPlayerChoices(){
    const wrap=$('playerChoices'),empty=$('playerEmpty');
    if(!wrap)return;
    wrap.innerHTML=players.map(p=>`
      <button class="player-choice dynamic-player-choice ${themeFor(p)}-choice ${selectedPlayer?.id===p.id?'current':''}" type="button" data-player-id="${esc(p.id)}">
        <span class="choice-img"><img src="${imageFor(p)}" alt="${esc(p.name)}, Level 1" draggable="false"></span>
        <strong>${esc(p.name)}</strong><small>${selectedPlayer?.id===p.id?'Sist valgt · ':''}Character ${Number(p.character_set)||1}</small>
      </button>`).join('');
    if(empty)empty.hidden=players.length>0;
  }

  function ensurePlayerSlots(){
    const weekGrid=document.querySelector('.week-grid');
    const formGrid=document.querySelector('.form-grid');
    const fighters=document.querySelector('.fighters-stack');
    const evolution=document.querySelector('.evolution-stack');
    const heatWrap=document.querySelector('.heat-wrap');

    players.forEach(p=>{
      const name=p.name,theme=themeFor(p);
      if(weekGrid&&!$('week'+name)){
        const el=document.createElement('article');el.id='week'+name;el.className=`week-card week-${theme}`;weekGrid.appendChild(el);
      }
      if(formGrid&&!$('form'+name)){
        const el=document.createElement('article');el.id='form'+name;el.className=`form-card form-${theme}`;formGrid.appendChild(el);
      }
      if(fighters&&!$('person'+name)){
        const el=document.createElement('article');el.id='person'+name;el.className=`fighter-card fighter-${theme}`;fighters.appendChild(el);
      }
      if(evolution&&!$('evolution'+name)){
        const el=document.createElement('article');el.id='evolution'+name;el.className=`evolution-card evolution-${theme}`;evolution.appendChild(el);
      }
      if(heatWrap&&!$('heat'+name)){
        const card=document.createElement('article');
        card.className=`calendar-card calendar-${theme}`;
        const title=document.createElement('div');title.className='heat-title';
        const dot=document.createElement('span');dot.className='person-dot';title.appendChild(dot);title.appendChild(document.createTextNode(name));
        const dow=document.createElement('div');dow.className='dow';dow.innerHTML='<span>M</span><span>T</span><span>O</span><span>T</span><span>F</span><span>L</span><span>S</span>';
        const heat=document.createElement('div');heat.id='heat'+name;heat.className='heat';
        card.append(title,dow,heat);heatWrap.appendChild(card);
      }
    });
  }

  function syncPlayers(next){
    players=Array.isArray(next)?next.filter(p=>p&&p.id&&p.name):[];
    PEOPLE.splice(0,PEOPLE.length,...players.map(p=>p.name));
    ensurePlayerSlots();
    const storedId=readStore(PLAYER_ID_KEY);
    const legacyName=readStore(LEGACY_PLAYER_KEY);
    selectedPlayer=players.find(p=>p.id===storedId)||players.find(p=>p.name===legacyName)||selectedPlayer&&players.find(p=>p.id===selectedPlayer.id)||null;
    const verifiedId=readStore(VERIFIED_PLAYER_KEY);
    if(verifiedId&&!players.some(p=>p.id===verifiedId))removeStore(VERIFIED_PLAYER_KEY);
    if(selectedPlayer){
      writeStore(PLAYER_ID_KEY,selectedPlayer.id);
      writeStore(LEGACY_PLAYER_KEY,selectedPlayer.name);
    }else{
      removeStore(PLAYER_ID_KEY);
      removeStore(LEGACY_PLAYER_KEY);
      removeStore(VERIFIED_PLAYER_KEY);
    }
    renderPlayerChoices();
    updatePlayerUi();
  }

  async function loadPlayers(showError=true){
    try{
      const list=await call({action:'list_players'});
      syncPlayers(list);
      if($('playerListError'))$('playerListError').textContent='';
      return players;
    }catch(e){
      if(showError&&$('playerListError'))$('playerListError').textContent=e.message||'Kunne ikke hente spillere.';
      throw e;
    }
  }

  function applySelectedControls(){
    PEOPLE.forEach(person=>{
      const card=$('person'+person);
      if(!card)return;
      const active=person===selectedPlayer?.name;
      card.classList.toggle('player-selected',active);
      const actions=card.querySelector('.actions');
      if(actions)actions.hidden=!active;
      let note=card.querySelector('.player-inactive-note');
      if(!active){
        const text=selectedPlayer?`Spiller som <strong>${esc(selectedPlayer.name)}</strong> · bytt øverst for å logge som ${esc(person)}.`:'Velg karakter øverst for å logge økter.';
        if(!note){note=document.createElement('div');note.className='player-inactive-note';card.appendChild(note)}
        if(note.innerHTML!==text)note.innerHTML=text;
      }else if(note)note.remove();
    });
  }
  window.applySelectedControls=applySelectedControls;

  function updatePlayerUi(){
    const name=selectedPlayer?.name||'';
    if(label)label.textContent=name||'VELG';
    if(switchBtn)switchBtn.setAttribute('aria-label',name?`Spiller som ${name}. Bytt karakter`:'Velg karakter');
    if(selectedPlayer)document.documentElement.dataset.player=themeFor(selectedPlayer);
    else delete document.documentElement.dataset.player;
    applySelectedControls();
  }

  function hideAuxSteps(){
    const newStep=$('newPlayerStep');if(newStep)newStep.hidden=true;
    const playerPinStep=$('playerPinStep');if(playerPinStep)playerPinStep.hidden=true;
  }

  function showPin(message=''){
    pendingPlayer=null;
    gate.classList.add('show');
    pinStep.hidden=false;
    playerStep.hidden=true;
    hideAuxSteps();
    gateClose.hidden=true;
    pinError.textContent=message;
    pinInput.disabled=false;
    if(pinSubmit)pinSubmit.disabled=false;
    requestAnimationFrame(()=>pinInput.focus());
  }

  async function showPlayerPicker(reload=true){
    pendingPlayer=null;
    gate.classList.add('show');
    pinStep.hidden=true;
    playerStep.hidden=false;
    hideAuxSteps();
    gateClose.hidden=!unlocked||!selectedPlayer;
    if(reload){
      if($('playerListError'))$('playerListError').textContent='Henter spillere…';
      try{await loadPlayers(true)}catch{}
    }else renderPlayerChoices();
  }

  function showNewPlayer(){
    pendingPlayer=null;
    pinStep.hidden=true;
    playerStep.hidden=true;
    const pinStepPlayer=$('playerPinStep');if(pinStepPlayer)pinStepPlayer.hidden=true;
    const step=$('newPlayerStep');if(step)step.hidden=false;
    gateClose.hidden=!unlocked||!selectedPlayer;
    const form=$('newPlayerForm');if(form)form.reset();
    const first=document.querySelector('input[name="characterSet"][value="1"]');if(first)first.checked=true;
    if($('newPlayerError'))$('newPlayerError').textContent='';
    setTimeout(()=>$('newPlayerName')?.focus(),50);
  }

  function showPlayerPin(player){
    if(!player)return;
    pendingPlayer=player;
    gate.classList.add('show');
    pinStep.hidden=true;
    playerStep.hidden=true;
    const newStep=$('newPlayerStep');if(newStep)newStep.hidden=true;
    const step=$('playerPinStep');if(step)step.hidden=false;
    gateClose.hidden=!unlocked||!selectedPlayer;
    const img=$('playerPinImage'),name=$('playerPinName'),character=$('playerPinCharacter'),prompt=$('playerPinPrompt'),input=$('playerPinInput'),error=$('playerPinError');
    if(img){img.src=imageFor(player);img.alt=`${player.name}, Character ${Number(player.character_set)||1}`}
    if(name)name.textContent=player.name;
    if(character)character.textContent=`Character ${Number(player.character_set)||1}`;
    if(prompt)prompt.textContent=selectedPlayer?.id===player.id&&!unlocked?`Bekreft PIN for ${player.name} første gang på denne enheten.`:`Skriv PIN for å bytte til ${player.name}.`;
    if(input){input.value='';input.disabled=false}
    if(error)error.textContent='';
    const confirm=$('confirmPlayerPin');if(confirm)confirm.disabled=false;
    setTimeout(()=>input?.focus(),50);
  }

  function closeGate(){
    if(!unlocked||!selectedPlayer)return;
    gate.classList.remove('show');
  }

  function ensureCompatLoaded(){
    if(compatPromise)return compatPromise;
    compatPromise=new Promise(resolve=>{
      if(window.__obdPlayerStep2Compat){resolve();return}
      const s=document.createElement('script');s.src='player-step2.js';s.onload=resolve;s.onerror=resolve;document.head.appendChild(s);
    });
    return compatPromise;
  }

  async function finishUnlock(){
    if(unlocked)return;
    await ensureCompatLoaded();
    unlocked=true;
    loginVerifiedIds.clear();
    window.obdAuthReady=true;
    document.body.classList.add('auth-ready');
    updatePlayerUi();
    closeGate();
    window.dispatchEvent(new Event('obd-auth-ready'));
  }

  async function commitPlayerChoice(id,verified=false){
    const player=players.find(p=>p.id===id);
    if(!player)return;
    const changed=selectedPlayer?.id!==player.id;
    selectedPlayer=player;
    if(verified)writeStore(VERIFIED_PLAYER_KEY,player.id);
    writeStore(PLAYER_ID_KEY,player.id);
    writeStore(LEGACY_PLAYER_KEY,player.name);
    updatePlayerUi();
    renderPlayerChoices();
    if(!unlocked)await finishUnlock();
    else{
      closeGate();
      if(changed){
        window.dispatchEvent(new CustomEvent('obd-player-changed',{detail:{player:player.name,playerId:player.id}}));
        if(typeof toast==='function')toast(`Spiller som ${player.name}`);
      }
    }
  }

  async function requestPlayerChoice(id){
    const player=players.find(p=>p.id===id);
    if(!player)return;
    const currentVerified=selectedPlayer?.id===player.id&&readStore(VERIFIED_PLAYER_KEY)===player.id;
    if(currentVerified){
      if(!unlocked)await finishUnlock();
      else closeGate();
      return;
    }
    if(loginVerifiedIds.has(player.id)){
      await commitPlayerChoice(player.id,true);
      return;
    }
    showPlayerPin(player);
  }

  async function verifyPendingPlayer(e){
    e.preventDefault();
    const player=pendingPlayer;
    if(!player)return;
    const input=$('playerPinInput'),error=$('playerPinError'),confirm=$('confirmPlayerPin');
    const playerPin=input?.value.trim()||'';
    if(!/^\d{4}$/.test(playerPin)){if(error)error.textContent='PIN må være nøyaktig 4 tall.';return}
    if(error)error.textContent='';
    if(input)input.disabled=true;
    if(confirm)confirm.disabled=true;
    try{
      const result=await call({action:'verify_player_pin',player_id:player.id,player_pin:playerPin});
      if(!result?.ok)throw new Error('Feil PIN');
      pendingPlayer=null;
      await commitPlayerChoice(player.id,true);
    }catch(err){
      if(error)error.textContent=`Feil PIN for ${player.name}.`;
      if(input){input.disabled=false;input.select()}
      if(confirm)confirm.disabled=false;
    }
  }

  async function createPlayer(e){
    e.preventDefault();
    const name=$('newPlayerName').value.trim();
    const pin=$('newPlayerPin').value.trim();
    const choice=document.querySelector('input[name="characterSet"]:checked');
    const characterSet=Number(choice?.value||1);
    const error=$('newPlayerError'),save=$('saveNewPlayer');
    error.textContent='';
    if(!NAME_RE.test(name)){error.textContent='Bruk 1–40 tegn: bokstaver, tall, mellomrom, punktum, bindestrek eller apostrof.';return}
    if(players.some(p=>p.name.localeCompare(name,'nb-NO',{sensitivity:'base'})===0)){error.textContent='Navnet er allerede i bruk.';return}
    if(!/^\d{4}$/.test(pin)){error.textContent='PIN må være nøyaktig 4 tall.';return}
    save.disabled=true;
    try{
      const result=await call({action:'create_player',name,character_set:characterSet,player_pin:pin});
      const created=Array.isArray(result)?result[0]:result;
      await loadPlayers(false);
      const player=players.find(p=>p.id===created?.id)||players.find(p=>p.name.localeCompare(name,'nb-NO',{sensitivity:'base'})===0);
      if(!player)throw new Error('Spilleren ble opprettet, men kunne ikke lastes inn.');
      if(typeof toast==='function')toast(`${player.name} er opprettet`);
      await commitPlayerChoice(player.id,true);
    }catch(err){error.textContent=err.message||'Kunne ikke opprette spiller.'}
    finally{save.disabled=false}
  }

  async function continueAfterSiteAuth(authResult){
    loginVerifiedIds=new Set(Array.isArray(authResult?.player_ids)?authResult.player_ids:[]);
    await loadPlayers(false);

    if(loginVerifiedIds.size===1){
      const id=[...loginVerifiedIds][0];
      const player=players.find(p=>p.id===id);
      if(player){await commitPlayerChoice(player.id,true);return}
    }

    if(selectedPlayer&&loginVerifiedIds.has(selectedPlayer.id)){
      await commitPlayerChoice(selectedPlayer.id,true);
      return;
    }

    if(selectedPlayer&&readStore(VERIFIED_PLAYER_KEY)===selectedPlayer.id){
      await finishUnlock();
      return;
    }

    if(selectedPlayer){showPlayerPin(selectedPlayer);return}
    await showPlayerPicker(false);
  }

  pinForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const pin=pinInput.value.trim();
    pinError.textContent='';
    pinInput.disabled=true;
    if(pinSubmit)pinSubmit.disabled=true;
    try{
      const authResult=await baseCall({action:'auth',pin});
      if(!authResult?.ok)throw new Error('Feil PIN');
      writeStore(PIN_KEY,APP_PIN);
      pinInput.value='';
      await continueAfterSiteAuth(authResult);
    }catch(err){
      removeStore(PIN_KEY);
      loginVerifiedIds.clear();
      pinError.textContent='Feil PIN.';
      pinInput.disabled=false;
      if(pinSubmit)pinSubmit.disabled=false;
      pinInput.select();
    }
  });

  switchBtn.addEventListener('click',()=>{if(unlocked)showPlayerPicker(true)});
  gateClose.addEventListener('click',closeGate);

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-add],[data-undo]');
    if(!btn)return;
    const person=btn.dataset.person||btn.dataset.undo;
    if(person&&person!==selectedPlayer?.name){
      e.preventDefault();
      e.stopImmediatePropagation();
      if(typeof toast==='function')toast(`Bytt til ${person} øverst først`);
    }
  },true);

  buildPlayerGate();
  updatePlayerUi();

  async function boot(){
    const storedPin=readStore(PIN_KEY);
    if(storedPin===APP_PIN){
      try{
        await loadPlayers(false);
        if(selectedPlayer&&readStore(VERIFIED_PLAYER_KEY)===selectedPlayer.id)await finishUnlock();
        else if(selectedPlayer)showPlayerPin(selectedPlayer);
        else await showPlayerPicker(false);
      }catch(err){showPin(err.message||'Kunne ikke hente spillere.')}
    }else{
      removeStore(PIN_KEY);
      showPin();
    }
  }
  boot();
})();