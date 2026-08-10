function characterSetSlug(value){
  const set=Number(value);
  if(set===1)return 'adrian';
  if(set===3)return 'joachim';
  return 'rikard';
}
function characterSlug(person){
  const meta=typeof window.getPlayerMeta==='function'?window.getPlayerMeta(person):null;
  if(meta)return characterSetSlug(meta.character_set);
  return String(person).toLowerCase()==='adrian'?'adrian':'rikard';
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
  const isJoachim=p=>Number(p?.character_set)===3;
  const playerById=id=>playerList().find(p=>p.id===id)||null;
  const playerByName=name=>playerList().find(p=>p.name===name)||null;
  const levelOne='characters/joachim-1.png';

  const style=document.createElement('style');
  style.textContent=`
    .character-set-picker.character-set-picker-three{grid-template-columns:repeat(3,minmax(0,1fr))}
    .character-set-picker-three .character-set-art{height:100px}
    .joachim-choice{border-color:rgba(255,201,40,.36)!important;box-shadow:inset 0 0 24px rgba(255,201,40,.05)}
    .battle-theme-joachim{border-color:rgba(255,201,40,.3)!important;box-shadow:inset 0 0 22px rgba(255,201,40,.07),0 8px 20px rgba(0,0,0,.23)!important}
    @media(max-width:390px){.character-set-picker-three .character-set-art{height:88px}.character-set-picker-three .character-set-choice strong{font-size:9px}.character-set-picker-three .character-set-choice small{font-size:7px}}
  `;
  document.head.appendChild(style);

  function ensureThirdChoice(){
    const picker=document.querySelector('#newPlayerForm .character-set-picker');
    if(!picker)return;
    picker.classList.add('character-set-picker-three');
    if(picker.querySelector('input[name="characterSet"][value="3"]'))return;
    const label=document.createElement('label');
    label.className='character-set-choice';
    label.innerHTML=`
      <input type="radio" name="characterSet" value="3">
      <span class="character-set-art"><img src="${levelOne}" alt="Character 3, Level 1" draggable="false"></span>
      <strong>CHARACTER 3</strong><small>Level 1</small>`;
    picker.appendChild(label);
  }

  function patchPlayerChoices(){
    document.querySelectorAll('#playerChoices [data-player-id]').forEach(btn=>{
      const p=playerById(btn.dataset.playerId);
      if(!isJoachim(p))return;
      const img=btn.querySelector('img');
      if(img&&img.getAttribute('src')!==levelOne)img.src=levelOne;
      btn.classList.remove('rikard-choice','adrian-choice');
      btn.classList.add('joachim-choice');
    });
  }

  function patchPlayerPinPreview(){
    const step=document.getElementById('playerPinStep');
    if(!step||step.hidden)return;
    const p=playerByName(document.getElementById('playerPinName')?.textContent||'');
    if(!isJoachim(p))return;
    const img=document.getElementById('playerPinImage');
    if(img&&img.getAttribute('src')!==levelOne)img.src=levelOne;
  }

  function patchBattlePicker(){
    document.querySelectorAll('#battlePickerList [data-battle-option]').forEach(option=>{
      const p=playerById(option.dataset.battleOption);
      if(!isJoachim(p))return;
      const img=option.querySelector('img');
      if(img&&img.getAttribute('src')!==levelOne)img.src=levelOne;
    });
  }

  function patchBattleCards(){
    document.querySelectorAll('[data-battle-player]').forEach(card=>{
      const p=playerById(card.dataset.battlePlayer);
      if(!isJoachim(p))return;
      card.classList.remove('battle-theme-rikard','battle-theme-adrian');
      card.classList.add('battle-theme-joachim');
    });
  }

  function patchSelectedTheme(){
    const id=typeof window.getSelectedPlayerId==='function'?window.getSelectedPlayerId():'';
    const p=playerById(id);
    if(isJoachim(p))document.documentElement.dataset.player='joachim';
  }

  function patchAll(){
    ensureThirdChoice();
    patchPlayerChoices();
    patchPlayerPinPreview();
    patchBattlePicker();
    patchBattleCards();
    patchSelectedTheme();
  }

  const observer=new MutationObserver(()=>queueMicrotask(patchAll));
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});
  window.addEventListener('obd-auth-ready',()=>setTimeout(patchAll,0));
  window.addEventListener('obd-player-changed',()=>setTimeout(patchAll,0));
  window.addEventListener('obd-battle-changed',()=>setTimeout(patchAll,0));
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-player-id],#battleConfigure,[data-battle-option],#newPlayerButton'))setTimeout(patchAll,0);
  },true);
  setTimeout(patchAll,0);
  setTimeout(patchAll,500);
})();
