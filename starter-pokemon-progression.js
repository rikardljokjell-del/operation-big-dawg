(()=>{
  if(window.__obdStarterPokemonProgression)return;
  window.__obdStarterPokemonProgression=true;

  const STARTER_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/starter-pokemon';
  const GYM_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const PIN='1337';
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const activeId=()=>window.getSelectedPlayerId?.()||'';
  const activeName=()=>window.getSelectedPlayer?.()||'';
  const levelNow=()=>{try{return Number(levelInfo(activeName()).level)||1}catch{return 1}};

  let unlocked=false;
  let unlockBusy=false;
  let currentPlayerId='';
  let rawAchievement=null;
  let allowMovedGymDexAchievement=false;

  function ensureStyle(){
    if(document.getElementById('starterPokemonProgressionStyle'))return;
    const style=document.createElement('style');
    style.id='starterPokemonProgressionStyle';
    style.textContent=`
      body:not(.obd-starter-pokemon-unlocked) #gymDexLaunch,
      body:not(.obd-starter-pokemon-unlocked) #wildPokemonBlock{display:none!important}
      body.obd-starter-pokemon-unlocked #gymDexLaunch,
      body.obd-starter-pokemon-unlocked #wildPokemonBlock{animation:starterFeatureReveal .42s ease both}
      body.obd-starter-pokemon-unlocked #gymDexUnlockNotice{display:none!important}
      @keyframes starterFeatureReveal{from{opacity:0;transform:translateY(-7px)}to{opacity:1;transform:none}}
    `;
    document.head.appendChild(style);
  }

  async function call(url,payload){
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,pin:PIN})});
    const text=await response.text();
    let data={};
    try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!response.ok)throw new Error(data.error||text||'Pokémon progression sync failed');
    return data;
  }

  function setUnlocked(value){
    unlocked=!!value;
    document.body.classList.toggle('obd-starter-pokemon-unlocked',unlocked);
    document.body.dataset.pokemonProgression=unlocked?'unlocked':'locked';
  }

  function installAchievementGuard(){
    if(window.showAchievement?.__obdStarterPokemonProgression)return;
    if(typeof window.showAchievement!=='function')return;
    const upstream=window.showAchievement;
    rawAchievement=rawAchievement||upstream;
    const wrapped=function(text,...args){
      const gymdex=String(text||'').trim().toUpperCase()==='GYMDEX UNLOCKED';
      if(gymdex&&unlocked&&!allowMovedGymDexAchievement)return;
      return upstream(text,...args);
    };
    wrapped.__obdStarterPokemonProgression=true;
    window.showAchievement=wrapped;
  }

  async function persistGymDexUnlock(){
    const id=activeId();
    if(!id)return;
    try{await call(GYM_API,{action:'unlock_gymdex',player_id:id,level:levelNow()})}
    catch(error){console.warn('GymDex unlock persistence failed',error)}
  }

  async function syncStarterUnlock(){
    const id=activeId();
    currentPlayerId=id;
    if(!id){setUnlocked(false);return}
    try{
      const state=await call(STARTER_API,{action:'status',player_id:id});
      if(id!==activeId())return;
      setUnlocked(!!state?.completed);
      if(state?.completed)persistGymDexUnlock();
    }catch(error){
      console.warn('Starter progression sync failed',error);
      if(id===activeId())setUnlocked(false);
    }
  }

  async function waitForPermanentDexButton(){
    for(let i=0;i<40;i++){
      const button=document.querySelector('#gymDexLaunch [data-open-permanent-dex]');
      if(button)return button;
      await wait(75);
    }
    return null;
  }

  async function unlockAfterGrandTheft(){
    if(unlockBusy)return;
    const id=activeId();
    if(!id)return;
    unlockBusy=true;
    try{
      // The Grand Theft Pokémon DONE handler closes the starter story first.
      await wait(90);
      if(id!==activeId())return;
      setUnlocked(true);
      await persistGymDexUnlock();

      allowMovedGymDexAchievement=true;
      try{(rawAchievement||window.showAchievement)?.('GYMDEX UNLOCKED')}
      finally{allowMovedGymDexAchievement=false}

      // Let the achievement land before revealing the collection itself.
      await wait(2350);
      if(id!==activeId())return;
      const button=await waitForPermanentDexButton();
      if(button){
        button.scrollIntoView?.({behavior:'smooth',block:'center'});
        await wait(180);
        button.click();
      }
    }catch(error){console.warn('Starter GymDex unlock flow failed',error)}
    finally{unlockBusy=false}
  }

  function suppressLegacyGymDexIntro(){
    if(!unlocked)return;
    const notice=document.getElementById('gymDexUnlockNotice');
    if(!notice?.classList.contains('show'))return;
    notice.querySelector('[data-gymdex-unlock-ok]')?.click();
    setTimeout(()=>{
      const alert=String(document.querySelector('#bossModal .boss-alert')?.textContent||'').trim().toUpperCase();
      if(alert==='GYMDEX')document.querySelector('#bossModal [data-close]')?.click();
    },0);
  }

  ensureStyle();
  installAchievementGuard();
  setUnlocked(false);

  // Grand Theft Pokémon is already displayed at this point. Unlock the next
  // progression layer only when the player presses DONE on that achievement.
  document.addEventListener('click',event=>{
    if(!event.target.closest?.('#starterDone'))return;
    setTimeout(unlockAfterGrandTheft,0);
  },true);

  const legacyObserver=new MutationObserver(suppressLegacyGymDexIntro);
  legacyObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  window.addEventListener('obd-auth-ready',()=>setTimeout(syncStarterUnlock,140));
  window.addEventListener('obd-player-changed',()=>{unlockBusy=false;currentPlayerId='';setUnlocked(false);setTimeout(syncStarterUnlock,100)});
  window.addEventListener('pageshow',()=>setTimeout(syncStarterUnlock,180));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(syncStarterUnlock,100)});

  [0,80,220,600].forEach(ms=>setTimeout(()=>{installAchievementGuard();if(ms>=220)syncStarterUnlock()},ms));
})();
