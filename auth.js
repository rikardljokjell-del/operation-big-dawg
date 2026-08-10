(()=>{
  const PIN_KEY='obd_access_pin_v1';
  const PLAYER_KEY='obd_selected_player_v1';
  let memoryPin='';
  let memoryPlayer='';
  let selectedPlayer='';
  let unlocked=false;

  const readStore=(key,fallback='')=>{try{return localStorage.getItem(key)||fallback}catch{return key===PIN_KEY?memoryPin:memoryPlayer||fallback}};
  const writeStore=(key,value)=>{try{localStorage.setItem(key,value)}catch{if(key===PIN_KEY)memoryPin=value;else memoryPlayer=value}};
  const removeStore=key=>{try{localStorage.removeItem(key)}catch{if(key===PIN_KEY)memoryPin='';else memoryPlayer=''}};

  selectedPlayer=PEOPLE.includes(readStore(PLAYER_KEY))?readStore(PLAYER_KEY):'';
  window.getSelectedPlayer=()=>selectedPlayer;

  const baseCall=call;
  call=window.call=async function(payload,pinOverride){
    const pin=pinOverride!==undefined?String(pinOverride):readStore(PIN_KEY);
    return baseCall({...payload,pin});
  };

  const gate=$('accessGate'),pinStep=$('pinStep'),playerStep=$('playerStep'),pinForm=$('pinForm'),pinInput=$('pinInput'),pinError=$('pinError'),gateClose=$('gateClose'),switchBtn=$('playerSwitch'),label=$('selectedPlayerLabel');

  function updatePlayerUi(){
    if(label)label.textContent=selectedPlayer||'VELG';
    if(switchBtn)switchBtn.setAttribute('aria-label',selectedPlayer?`Spiller som ${selectedPlayer}. Bytt karakter`:'Velg karakter');
    document.documentElement.dataset.player=selectedPlayer.toLowerCase();
    applySelectedControls();
  }

  function showPin(message=''){
    gate.classList.add('show');
    pinStep.hidden=false;
    playerStep.hidden=true;
    gateClose.hidden=true;
    pinError.textContent=message;
    setTimeout(()=>pinInput.focus(),50);
  }

  function showPlayerPicker(){
    gate.classList.add('show');
    pinStep.hidden=true;
    playerStep.hidden=false;
    gateClose.hidden=!unlocked||!selectedPlayer;
  }

  function closeGate(){
    if(!unlocked||!selectedPlayer)return;
    gate.classList.remove('show');
  }

  function finishUnlock(){
    unlocked=true;
    updatePlayerUi();
    closeGate();
    setTimeout(()=>{if(typeof refresh==='function')refresh(true)},0);
  }

  function choosePlayer(person){
    if(!PEOPLE.includes(person))return;
    const changed=selectedPlayer!==person;
    selectedPlayer=person;
    writeStore(PLAYER_KEY,person);
    updatePlayerUi();
    if(!unlocked)finishUnlock();
    else{
      closeGate();
      if(changed&&typeof toast==='function')toast(`Spiller som ${person}`);
    }
  }

  function applySelectedControls(){
    PEOPLE.forEach(person=>{
      const card=$('person'+person);
      if(!card)return;
      const active=person===selectedPlayer;
      card.classList.toggle('player-selected',active);
      const actions=card.querySelector('.actions');
      if(actions)actions.hidden=!active;
      let note=card.querySelector('.player-inactive-note');
      if(!active){
        if(!note){
          note=document.createElement('div');
          note.className='player-inactive-note';
          card.appendChild(note);
        }
        note.innerHTML=selectedPlayer?`Spiller som <strong>${selectedPlayer}</strong> · bytt øverst for å logge som ${person}.`:'Velg karakter øverst for å logge økter.';
      }else if(note)note.remove();
    });
  }

  pinForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const pin=pinInput.value.trim();
    if(!pin)return;
    pinError.textContent='Sjekker PIN…';
    pinInput.disabled=true;
    try{
      await call({action:'auth'},pin);
      writeStore(PIN_KEY,pin);
      pinInput.value='';
      pinError.textContent='';
      if(selectedPlayer)finishUnlock();
      else showPlayerPicker();
    }catch{
      removeStore(PIN_KEY);
      pinError.textContent='Feil PIN.';
      pinInput.select();
    }finally{pinInput.disabled=false}
  });

  document.querySelectorAll('[data-choose-player]').forEach(btn=>btn.addEventListener('click',()=>choosePlayer(btn.dataset.choosePlayer)));
  switchBtn.addEventListener('click',()=>{if(unlocked)showPlayerPicker()});
  gateClose.addEventListener('click',closeGate);

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-add],[data-undo]');
    if(!btn)return;
    const person=btn.dataset.person||btn.dataset.undo;
    if(person&&person!==selectedPlayer){e.preventDefault();e.stopImmediatePropagation();if(typeof toast==='function')toast(`Bytt til ${person} øverst først`) }
  },true);

  const fighters=$('fighters');
  if(fighters)new MutationObserver(applySelectedControls).observe(fighters,{childList:true,subtree:true});
  updatePlayerUi();

  (async()=>{
    const pin=readStore(PIN_KEY);
    if(!pin){showPin();return}
    try{
      await call({action:'auth'},pin);
      if(selectedPlayer)finishUnlock();
      else showPlayerPicker();
    }catch{
      removeStore(PIN_KEY);
      showPin('PIN må bekreftes på nytt.');
    }
  })();
})();