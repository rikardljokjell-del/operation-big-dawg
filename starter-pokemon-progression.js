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
  let rawAchievement=null;
  let allowMovedGymDexAchievement=false;
  let releaseReplay=false;
  let syncPromise=null;
  let syncPlayerId='';
  let syncRetryTimer=null;
  let syncRetryAttempt=0;

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

  function resetSyncRetry(){
    clearTimeout(syncRetryTimer);
    syncRetryTimer=null;
    syncRetryAttempt=0;
  }

  function scheduleSyncRetry(id){
    if(!id||id!==activeId())return;
    const delays=[350,900,1800,3500];
    if(syncRetryAttempt>=delays.length)return;
    clearTimeout(syncRetryTimer);
    const delay=delays[syncRetryAttempt++];
    syncRetryTimer=setTimeout(()=>{
      syncRetryTimer=null;
      if(id===activeId())syncStarterUnlock();
    },delay);
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
    if(!id){resetSyncRetry();setUnlocked(false);return}
    if(syncPromise&&syncPlayerId===id)return syncPromise;

    const run=(async()=>{
      try{
        const state=await call(STARTER_API,{action:'status',player_id:id});
        if(id!==activeId())return;
        resetSyncRetry();
        setUnlocked(!!state?.completed);
        if(state?.completed)persistGymDexUnlock();
      }catch(error){
        if(id!==activeId())return;
        console.warn('Starter progression sync failed',error);
        // A temporary/late request failure must never undo a known-good unlock.
        // Keep the current state and retry shortly instead.
        scheduleSyncRetry(id);
      }
    })();

    syncPromise=run;
    syncPlayerId=id;
    try{return await run}
    finally{
      if(syncPromise===run){syncPromise=null;syncPlayerId=''}
    }
  }

  async function waitForPermanentDexButton(){
    for(let i=0;i<50;i++){
      const button=document.querySelector('#gymDexLaunch [data-open-permanent-dex]');
      if(button)return button;
      await wait(75);
    }
    return null;
  }

  async function waitForDexClosed(){
    const overlay=document.getElementById('pokemonV2Overlay');
    if(!overlay)return;
    for(let i=0;i<30&&!overlay.classList.contains('show');i++)await wait(50);
    if(!overlay.classList.contains('show'))return;
    await new Promise(resolve=>{
      let done=false;
      const finish=()=>{if(done)return;done=true;observer.disconnect();clearTimeout(timeout);resolve()};
      const observer=new MutationObserver(()=>{if(!overlay.classList.contains('show'))finish()});
      observer.observe(overlay,{attributes:true,attributeFilter:['class']});
      const timeout=setTimeout(finish,120000);
    });
  }

  async function showMovedGymDexAchievement(){
    const previousPriority=!!window.__obdStarterStoryPriority;
    window.__obdStarterStoryPriority=false;
    allowMovedGymDexAchievement=true;
    try{(rawAchievement||window.showAchievement)?.('GYMDEX UNLOCKED')}
    finally{
      allowMovedGymDexAchievement=false;
      window.__obdStarterStoryPriority=previousPriority;
    }
    await wait(2350);
  }

  async function unlockAfterGrandTheft(doneButton){
    if(unlockBusy)return;
    const id=activeId();
    if(!id)return;
    unlockBusy=true;
    try{
      // Hide the Grand Theft card, but deliberately keep starter priority active
      // until the player has seen the new GymDex unlock and opened the collection.
      document.getElementById('starterEventOverlay')?.classList.remove('show');
      document.body.classList.remove('starter-modal-open');

      setUnlocked(true);
      await persistGymDexUnlock();
      await showMovedGymDexAchievement();
      if(id!==activeId())return;

      const button=await waitForPermanentDexButton();
      if(button){
        button.scrollIntoView?.({behavior:'smooth',block:'center'});
        await wait(180);
        button.click();
        await waitForDexClosed();
      }
    }catch(error){console.warn('Starter GymDex unlock flow failed',error)}
    finally{
      unlockBusy=false;
      // Replay the original DONE click only now. This lets starter-event.js run
      // its normal releasePriority(), so XP/Gym/other rewards continue afterwards.
      if(doneButton?.isConnected){
        releaseReplay=true;
        try{doneButton.click()}finally{releaseReplay=false}
      }
    }
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

  // Grand Theft Pokémon is already on screen. Intercept its DONE click so the
  // next progression beat is always: GYMDEX UNLOCKED -> open GymDex -> continue.
  document.addEventListener('click',event=>{
    const done=event.target.closest?.('#starterDone');
    if(!done||releaseReplay)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    unlockAfterGrandTheft(done);
  },true);

  const legacyObserver=new MutationObserver(suppressLegacyGymDexIntro);
  legacyObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  window.addEventListener('obd-auth-ready',()=>{resetSyncRetry();setTimeout(syncStarterUnlock,0)});
  window.addEventListener('obd-player-changed',()=>{unlockBusy=false;resetSyncRetry();setUnlocked(false);setTimeout(syncStarterUnlock,80)});
  window.addEventListener('pageshow',()=>setTimeout(syncStarterUnlock,120));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(syncStarterUnlock,80)});
  window.addEventListener('online',()=>{resetSyncRetry();syncStarterUnlock()});

  if(window.obdAuthReady&&activeId())setTimeout(syncStarterUnlock,0);
  [0,80,220,600].forEach(ms=>setTimeout(()=>{installAchievementGuard();if(ms>=220)syncStarterUnlock()},ms));
})();