function characterSetSlug(value){
  const set=Number(value);
  if(set===1)return 'adrian';
  if(set===3)return 'joachim';
  if(set===4)return 'marte';
  return 'rikard';
}
function characterSlug(person){
  const meta=typeof window.getPlayerMeta==='function'?window.getPlayerMeta(person):null;
  if(meta)return characterSetSlug(meta.character_set);
  const fallback=String(person).toLowerCase();
  if(fallback==='adrian')return 'adrian';
  if(fallback==='joachim')return 'joachim';
  if(fallback==='marte')return 'marte';
  return 'rikard';
}
function fig(person,level,big=false){
  const safe=Math.max(1,Math.min(10,Number(level)||1));
  const slug=characterSlug(person);
  const src=`characters/${slug}-${safe}.png`;
  const label=`${person}, Level ${safe}: ${RANKS[safe-1]}`;
  return `<div class="shadow"></div><img class="character-img" src="${src}" alt="${label}" draggable="false">`;
}

(()=>{
  const playerList=()=>typeof window.getPlayers==='function'?window.getPlayers():[];
  const playerById=id=>playerList().find(p=>p.id===id)||null;
  const playerByName=name=>playerList().find(p=>p.name===name)||null;
  const levelOneFor=p=>`characters/${characterSetSlug(p?.character_set)}-1.png`;

  const style=document.createElement('style');
  style.textContent=`
    .character-set-picker.character-set-picker-four{grid-template-columns:repeat(4,minmax(0,1fr))}
    .character-set-picker-four .character-set-art{height:94px}
    .joachim-choice{border-color:rgba(255,201,40,.36)!important;box-shadow:inset 0 0 24px rgba(255,201,40,.05)}
    .marte-choice{border-color:rgba(255,111,188,.38)!important;box-shadow:inset 0 0 24px rgba(255,111,188,.06)}
    .battle-theme-joachim{border-color:rgba(255,201,40,.3)!important;box-shadow:inset 0 0 22px rgba(255,201,40,.07),0 8px 20px rgba(0,0,0,.23)!important}
    .battle-theme-marte{border-color:rgba(255,111,188,.32)!important;box-shadow:inset 0 0 22px rgba(255,111,188,.08),0 8px 20px rgba(0,0,0,.23)!important}
    @media(max-width:390px){.character-set-picker-four .character-set-art{height:80px}.character-set-picker-four .character-set-choice strong{font-size:8px}.character-set-picker-four .character-set-choice small{font-size:7px}}
  `;
  document.head.appendChild(style);

  function ensureCharacterChoices(){
    const picker=document.querySelector('#newPlayerForm .character-set-picker');
    if(!picker)return;
    picker.classList.remove('character-set-picker-three');
    picker.classList.add('character-set-picker-four');
    [
      {value:3,slug:'joachim'},
      {value:4,slug:'marte'}
    ].forEach(item=>{
      if(picker.querySelector(`input[name="characterSet"][value="${item.value}"]`))return;
      const label=document.createElement('label');
      label.className='character-set-choice';
      label.innerHTML=`
        <input type="radio" name="characterSet" value="${item.value}">
        <span class="character-set-art"><img src="characters/${item.slug}-1.png" alt="Character ${item.value}, Level 1" draggable="false"></span>
        <strong>CHARACTER ${item.value}</strong><small>Level 1</small>`;
      picker.appendChild(label);
    });
  }

  function patchPlayerChoices(){
    document.querySelectorAll('#playerChoices [data-player-id]').forEach(btn=>{
      const p=playerById(btn.dataset.playerId);
      if(!p)return;
      const slug=characterSetSlug(p.character_set),src=levelOneFor(p),img=btn.querySelector('img');
      if(img&&img.getAttribute('src')!==src)img.src=src;
      btn.classList.remove('rikard-choice','adrian-choice','joachim-choice','marte-choice');
      btn.classList.add(`${slug}-choice`);
    });
  }

  function patchPlayerPinPreview(){
    const step=document.getElementById('playerPinStep');
    if(!step||step.hidden)return;
    const p=playerByName(document.getElementById('playerPinName')?.textContent||'');
    if(!p)return;
    const img=document.getElementById('playerPinImage'),src=levelOneFor(p);
    if(img&&img.getAttribute('src')!==src)img.src=src;
  }

  function patchBattlePicker(){
    document.querySelectorAll('#battlePickerList [data-battle-option]').forEach(option=>{
      const p=playerById(option.dataset.battleOption);
      if(!p)return;
      const img=option.querySelector('img'),src=levelOneFor(p);
      if(img&&img.getAttribute('src')!==src)img.src=src;
    });
  }

  function patchBattleCards(){
    document.querySelectorAll('[data-battle-player]').forEach(card=>{
      const p=playerById(card.dataset.battlePlayer);
      if(!p)return;
      const slug=characterSetSlug(p.character_set);
      card.classList.remove('battle-theme-rikard','battle-theme-adrian','battle-theme-joachim','battle-theme-marte');
      card.classList.add(`battle-theme-${slug}`);
    });
  }

  function patchSelectedTheme(){
    const id=typeof window.getSelectedPlayerId==='function'?window.getSelectedPlayerId():'';
    const p=playerById(id);
    if(p)document.documentElement.dataset.player=characterSetSlug(p.character_set);
  }

  function patchAdminCharacterChoices(){
    document.querySelectorAll('select[id^="character-"]').forEach(select=>{
      if(!select.querySelector('option[value="4"]')){
        const option=document.createElement('option');
        option.value='4';
        option.textContent='Character 4';
        select.appendChild(option);
      }
      const p=playerById(select.id.slice('character-'.length));
      if(Number(p?.character_set)===4&&select.value!=='4')select.value='4';
    });
  }

  function patchAll(){
    ensureCharacterChoices();
    patchPlayerChoices();
    patchPlayerPinPreview();
    patchBattlePicker();
    patchBattleCards();
    patchSelectedTheme();
    patchAdminCharacterChoices();
  }

  const observer=new MutationObserver(()=>queueMicrotask(patchAll));
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});
  window.addEventListener('obd-auth-ready',()=>setTimeout(patchAll,0));
  window.addEventListener('obd-player-changed',()=>setTimeout(patchAll,0));
  window.addEventListener('obd-battle-changed',()=>setTimeout(patchAll,0));
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-player-id],#battleConfigure,[data-battle-option],#newPlayerButton,[data-save-character]'))setTimeout(patchAll,0);
  },true);
  setTimeout(patchAll,0);
  setTimeout(patchAll,500);
})();
