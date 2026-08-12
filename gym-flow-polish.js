(()=>{
  if(window.__obdGymFlowPolish)return;
  window.__obdGymFlowPolish=true;

  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const MASTER_PIN='1337';
  const stateByPlayer=new Map();
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const activeId=()=>window.getSelectedPlayerId?.()||'';
  const activeName=()=>window.getSelectedPlayer?.()||'';
  const levelNow=()=>{try{return typeof levelInfo==='function'?Number(levelInfo(activeName()).level)||1:1}catch{return 1}};
  const levelFor=detail=>Math.max(1,Number(detail?.levelAfter)||levelNow());
  const sameActive=detail=>{
    const id=detail?.playerId||'';
    const name=detail?.person||'';
    return id?String(id)===String(activeId()):!name||String(name).localeCompare(String(activeName()),'nb-NO',{sensitivity:'base'})===0;
  };

  let flow=null;
  let deferredEvolution=null;
  let deferredAchievement=null;
  const baseAchievement=typeof window.showAchievement==='function'?window.showAchievement:null;
  let badgeRenderQueued=false;
  let bossObserversInstalled=false;

  function setGymPriority(value){window.__obdGymFlowPriority=!!value}

  function installProgressHooks(){
    if(typeof window.showEvolution==='function'&&!window.showEvolution.__obdGymFlowWrapped){
      const upstream=window.showEvolution;
      const wrapped=function(...args){
        if(window.__obdGymFlowPriority){deferredEvolution=args;return}
        return upstream(...args);
      };
      wrapped.__obdGymFlowWrapped=true;
      window.showEvolution=wrapped;
    }
    if(typeof window.showAchievement==='function'&&!window.showAchievement.__obdGymFlowWrapped){
      const upstream=window.showAchievement;
      const wrapped=function(...args){
        if(window.__obdGymFlowPriority){deferredAchievement=args;return}
        return upstream(...args);
      };
      wrapped.__obdGymFlowWrapped=true;
      window.showAchievement=wrapped;
    }
  }
  installProgressHooks();

  async function api(payload){
    const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,pin:MASTER_PIN})});
    const text=await response.text();let data={};
    try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!response.ok)throw new Error(data.error||text||'Gym sync failed');
    return data;
  }

  function peekReward(detail){
    const reward=window.__obdLastWorkoutReward;
    if(!reward)return{eligible:true};
    const detailId=detail?.playerId||activeId(),detailName=detail?.person||activeName(),detailType=detail?.type||'';
    const samePlayer=(detailId&&reward.playerId)?String(detailId)===String(reward.playerId):String(detailName||'').localeCompare(String(reward.person||''),'nb-NO',{sensitivity:'base'})===0;
    const sameType=!detailType||!reward.type||detailType===reward.type;
    return samePlayer&&sameType?reward:{eligible:true};
  }

  window.shouldDeferWorkoutPayoffForGym=detail=>sameActive(detail)&&levelFor(detail)>=3;

  function suppressLegacyBossDelay(){
    const original=window.setTimeout;
    if(original.__obdGymSuppression)return;
    let restored=false;
    const restore=()=>{
      if(restored)return;
      restored=true;
      if(window.setTimeout===wrapped)window.setTimeout=original;
    };
    function wrapped(fn,delay,...args){
      const ms=Number(delay);
      if(ms===800||ms===7800){restore();return 0}
      return original.call(window,fn,delay,...args);
    }
    wrapped.__obdGymSuppression=true;
    window.setTimeout=wrapped;
    queueMicrotask(restore);
  }

  function newFlow(detail){
    return{
      active:true,
      detail:{...detail},
      playerId:detail?.playerId||activeId(),
      started:false,
      firstFight:false,
      resultSeen:false,
      resultView:'',
      markPromise:null,
      introRunning:false,
      waitingDexClose:false,
      finishing:false
    };
  }

  window.__obdGymFlowHandleWorkout=detail=>{
    if(!window.shouldDeferWorkoutPayoffForGym(detail))return;
    suppressLegacyBossDelay();
    const reward=peekReward(detail);
    flow=newFlow(detail||{});
    setGymPriority(true);
    if(reward?.eligible===false){
      setTimeout(()=>finishFlow(),0);
      return;
    }
    if(window.__obdStarterStoryPriority)return;
    startGymFlow();
  };

  async function waitForGymRuntime(){
    for(let i=0;i<50;i++){
      if(typeof window.refreshGymLeader==='function'&&typeof window.startGymAttack==='function')return true;
      await wait(50);
    }
    return false;
  }

  async function loadState(playerId=activeId(),level=levelNow()){
    if(!playerId)return null;
    const data=await api({action:'get',player_id:playerId,level});
    if(data?.player){stateByPlayer.set(String(playerId),data.player);queueBadgeRender()}
    return data?.player||null;
  }

  async function startGymFlow(){
    if(!flow?.active||flow.started)return;
    flow.started=true;
    try{
      if(!await waitForGymRuntime())throw new Error('Gym runtime not ready');
      await window.refreshGymLeader();
      const state=await loadState(flow.playerId,levelFor(flow.detail));
      flow.firstFight=!state?.first_gym_fight_at;
      window.startGymAttack({...flow.detail,person:flow.detail?.person||activeName(),levelAfter:levelFor(flow.detail)});
      setTimeout(()=>{
        if(flow?.active&&!document.getElementById('bossOverlay')?.classList.contains('show')&&!flow.resultSeen)finishFlow();
      },350);
    }catch(error){
      console.warn('Prioritized Gym flow failed',error);
      finishFlow();
    }
  }

  async function markFirstFight(){
    if(!flow?.active||!flow.firstFight)return stateByPlayer.get(String(flow?.playerId||''))||null;
    if(flow.markPromise)return flow.markPromise;
    flow.markPromise=(async()=>{
      try{
        const data=await api({action:'mark_first_fight',player_id:flow.playerId,level:levelFor(flow.detail)});
        if(data?.player){stateByPlayer.set(String(flow.playerId),data.player);queueBadgeRender()}
        return data?.player||null;
      }catch(error){
        console.warn('Could not persist first Gym fight',error);
        return null;
      }
    })();
    return flow.markPromise;
  }

  async function unlockGymDex(){
    if(!flow?.active)return null;
    try{
      const data=await api({action:'unlock_gymdex',player_id:flow.playerId,level:levelFor(flow.detail)});
      if(data?.player){stateByPlayer.set(String(flow.playerId),data.player);queueBadgeRender()}
      return data?.player||null;
    }catch(error){
      console.warn('Could not persist GymDex unlock',error);
      return null;
    }
  }

  async function showGymAchievement(text){
    try{baseAchievement?.(text)}catch{}
    await wait(2350);
  }

  async function startFirstGymIntro(){
    if(!flow?.active||flow.introRunning)return;
    flow.introRunning=true;
    await markFirstFight();
    await showGymAchievement('First gym leader fight');
    await unlockGymDex();
    await showGymAchievement('GYMDEX UNLOCKED');
    await openDexUnlockNotice();
  }

  function ensureUnlockNotice(){
    let notice=document.getElementById('gymDexUnlockNotice');
    if(notice)return notice;
    notice=document.createElement('div');
    notice.id='gymDexUnlockNotice';
    notice.className='gymdex-unlock-notice';
    notice.innerHTML='<div class="gymdex-unlock-card" role="dialog" aria-modal="true"><span>GYMDEX UNLOCKED</span><strong>150 Pokémon left.</strong><p>Gotta catch em\' all!</p><button type="button" data-gymdex-unlock-ok>OK</button></div>';
    document.body.appendChild(notice);
    notice.querySelector('[data-gymdex-unlock-ok]')?.addEventListener('click',()=>{
      notice.classList.remove('show');
      flow&&(flow.introRunning=false,flow.waitingDexClose=true);
      if(!document.getElementById('bossOverlay')?.classList.contains('show'))finishFlow();
    });
    return notice;
  }

  async function openDexUnlockNotice(){
    if(!flow?.active)return;
    try{window.renderGymLeader?.()}catch{}
    await wait(60);
    const dexButton=document.querySelector('#weeklyBoss [data-dex]');
    if(!dexButton){finishFlow();return}
    flow.waitingDexClose=true;
    dexButton.click();
    await wait(90);
    if(!document.getElementById('bossOverlay')?.classList.contains('show')){finishFlow();return}
    ensureUnlockNotice().classList.add('show');
  }

  function currentBossView(){
    const modal=document.getElementById('bossModal');
    return String(modal?.querySelector('.boss-alert')?.textContent||'').trim().toUpperCase();
  }

  function enhanceAttackPicker(){
    const modal=document.getElementById('bossModal');
    if(!modal||currentBossView()!=='CHOOSE ATTACK')return;
    const list=modal.querySelector('.boss-move-list');
    if(!list)return;
    const moves=[...list.querySelectorAll('.boss-move[data-move]')];
    const signature=moves.map(x=>x.dataset.move).join('|');
    if(list.dataset.gymThreeSlots===signature)return;
    list.dataset.gymThreeSlots=signature;
    moves.forEach(move=>{
      move.querySelectorAll(':scope > b').forEach(b=>{if(String(b.textContent||'').trim().toUpperCase()==='USE')b.remove()});
      move.setAttribute('aria-label',move.querySelector('strong')?.textContent||'Attack');
    });
    list.querySelectorAll('.gym-move-locked').forEach(x=>x.remove());
    for(let i=moves.length;i<3;i++){
      const locked=document.createElement('button');
      locked.type='button';locked.disabled=true;locked.className='boss-move gym-move-locked';
      locked.innerHTML='<span>🔒</span><div><strong>LOCKED</strong><small>ATTACK SLOT</small></div>';
      list.appendChild(locked);
    }
    list.classList.add('gym-picker-three');
  }

  function inspectBossModal(){
    enhanceAttackPicker();
    if(!flow?.active)return;
    const view=currentBossView();
    if(view==='DIRECT HIT'||view==='GYM LEADER DOWN!'){
      flow.resultSeen=true;
      flow.resultView=view;
      if(flow.firstFight)markFirstFight();
    }
  }

  function handleBossOverlayClosed(){
    if(!flow?.active||flow.finishing)return;
    if(flow.waitingDexClose&&!flow.introRunning){finishFlow();return}
    if(flow.resultSeen&&flow.firstFight){startFirstGymIntro();return}
    finishFlow();
  }

  function installBossObservers(){
    const overlay=document.getElementById('bossOverlay'),modal=document.getElementById('bossModal');
    if(!overlay||!modal||bossObserversInstalled)return false;
    bossObserversInstalled=true;
    new MutationObserver(inspectBossModal).observe(modal,{childList:true,subtree:true,characterData:true});
    new MutationObserver(()=>{
      if(!overlay.classList.contains('show'))handleBossOverlayClosed();
      else inspectBossModal();
    }).observe(overlay,{attributes:true,attributeFilter:['class']});
    inspectBossModal();
    return true;
  }

  function scrollGym(){
    const block=document.getElementById('weeklyBoss');
    if(!block)return;
    block.style.scrollMarginTop='76px';
    try{block.scrollIntoView({behavior:'smooth',block:'start'})}catch{block.scrollIntoView()}
  }

  function resetFlow(){
    flow=null;
    document.getElementById('gymDexUnlockNotice')?.classList.remove('show');
  }

  function finishFlow(){
    if(!flow?.active||flow.finishing)return;
    flow.finishing=true;
    const detail=flow.detail||{};
    const evolution=deferredEvolution;
    const achievement=deferredAchievement;
    deferredEvolution=null;deferredAchievement=null;
    setGymPriority(false);
    scrollGym();
    resetFlow();
    setTimeout(()=>{
      window.dispatchEvent(new CustomEvent('obd-gym-flow-complete',{detail}));
      if(evolution)setTimeout(()=>window.showEvolution?.(...evolution),1550);
      if(achievement)setTimeout(()=>window.showAchievement?.(...achievement),evolution?7600:1750);
    },420);
  }

  function queueBadgeRender(){
    if(badgeRenderQueued)return;
    badgeRenderQueued=true;
    requestAnimationFrame(()=>{badgeRenderQueued=false;renderGymBadges()});
  }

  function renderGymBadges(){
    const wrap=document.getElementById('badges');
    if(!wrap)return;
    const state=stateByPlayer.get(String(activeId()));
    const wanted=[];
    if(state?.first_gym_fight_at)wanted.push(['first-fight','First gym leader fight']);
    if(state?.gymdex_unlocked_at)wanted.push(['gymdex','GYMDEX UNLOCKED']);
    wrap.querySelectorAll('.gym-achievement-badge').forEach(node=>{
      if(!wanted.some(([key])=>node.dataset.gymAchievement===key))node.remove();
    });
    for(const [key,label] of wanted){
      if(wrap.querySelector(`[data-gym-achievement="${key}"]`))continue;
      const badge=document.createElement('span');
      badge.className='badge gym-achievement-badge';
      badge.dataset.gymAchievement=key;
      badge.textContent=`🏆 ${label}`;
      wrap.appendChild(badge);
    }
    const count=document.getElementById('badgeCount');
    if(count)count.textContent=`${wrap.querySelectorAll('.badge').length} låst opp`;
  }

  async function syncActiveState(){
    const id=activeId();
    if(!id||levelNow()<3){queueBadgeRender();return}
    try{await loadState(id,levelNow())}catch(error){console.warn('Gym achievement sync failed',error)}
  }

  function ensureStyle(){
    if(document.getElementById('gymFlowPolishStyle'))return;
    const style=document.createElement('style');
    style.id='gymFlowPolishStyle';
    style.textContent=`
      .boss-move-list.gym-picker-three{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .boss-move-list.gym-picker-three .boss-move{min-height:112px;grid-template-columns:1fr;grid-template-rows:auto 1fr;place-items:center;align-content:center;padding:10px 6px;text-align:center;cursor:pointer}
      .boss-move-list.gym-picker-three .boss-move>span{font-size:25px}
      .boss-move-list.gym-picker-three .boss-move strong{font-size:9px;line-height:1.12}
      .boss-move-list.gym-picker-three .boss-move small{margin-top:4px;font-size:6px;line-height:1.25}
      .boss-move-list.gym-picker-three .gym-move-locked{border-style:dashed;background:#09121a;color:#526575;cursor:not-allowed;opacity:.58}
      .gymdex-unlock-notice{position:fixed;inset:0;z-index:240;display:grid;place-items:center;padding:18px;background:rgba(2,5,8,.38);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:.16s ease}
      .gymdex-unlock-notice.show{opacity:1;pointer-events:auto}
      .gymdex-unlock-card{width:min(88vw,300px);padding:20px;border:1px solid rgba(255,215,91,.30);border-radius:18px;background:linear-gradient(155deg,#111c27,#080d13);box-shadow:0 24px 70px rgba(0,0,0,.62);color:#fff;text-align:center}
      .gymdex-unlock-card>span{display:block;color:#ffd75b;font-size:9px;font-weight:1000;letter-spacing:.16em}
      .gymdex-unlock-card>strong{display:block;margin-top:10px;font-size:22px}
      .gymdex-unlock-card>p{margin:6px 0 0;color:#a8b6c2;font-size:12px;font-weight:800}
      .gymdex-unlock-card>button{width:100%;min-height:42px;margin-top:15px;border:0;border-radius:11px;background:linear-gradient(135deg,#ff384b,#ff8a45);color:#fff;font-weight:1000;cursor:pointer}
      @media(max-width:390px){.boss-move-list.gym-picker-three{gap:6px}.boss-move-list.gym-picker-three .boss-move{min-height:102px;padding:8px 4px}.boss-move-list.gym-picker-three .boss-move strong{font-size:8px}}
    `;
    document.head.appendChild(style);
  }

  ensureStyle();
  const observerTarget=document.getElementById('badges');
  if(observerTarget)new MutationObserver(queueBadgeRender).observe(observerTarget,{childList:true});
  window.addEventListener('obd-starter-story-complete',()=>{if(flow?.active&&!flow.started)startGymFlow()});
  window.addEventListener('obd-player-changed',()=>{setGymPriority(false);resetFlow();setTimeout(syncActiveState,120)});
  window.addEventListener('obd-auth-ready',()=>setTimeout(syncActiveState,220));
  window.addEventListener('pageshow',()=>setTimeout(syncActiveState,250));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(syncActiveState,120)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&flow?.active)setTimeout(()=>{if(!document.getElementById('bossOverlay')?.classList.contains('show'))handleBossOverlayClosed()},0)});
  [0,80,180,350,700,1400].forEach(ms=>setTimeout(()=>{installProgressHooks();installBossObservers();if(ms>=350)syncActiveState()},ms));
})();
