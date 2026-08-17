(()=>{
  if(!window.__OBD_PREVIEW__||window.__obdGameplayActionsPreview)return;
  window.__obdGameplayActionsPreview=true;

  const CREDIT_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-attack-credits-preview';
  const WILD_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/wild-attempt-preview';
  const GYM_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const PIN='1337';
  const WILD_STORE='obd_preview_wild_catch_pending_v2';

  let creditState={count:0,next:null,gym:null};
  let wildPending=null;
  let currentBatch=null;
  let legacyGymFlow=null;
  let manualGymCredit=null;
  let manualGymSession=false;
  let claimBusy=false;
  let deferredWorkoutComplete=null;

  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const playerId=()=>String(window.getSelectedPlayerId?.()||'');
  const playerName=()=>String(window.getSelectedPlayer?.()||'');
  const levelNow=()=>{try{return Math.max(1,Number(levelInfo(playerName()).level)||1)}catch{return 1}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function jsonCall(url,payload,fetcher=window.fetch.bind(window)){
    const r=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,pin:payload?.pin||PIN})});
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!r.ok)throw new Error(data.error||text||'Request failed');
    return data;
  }

  async function rewardFor(detail){
    for(let i=0;i<10;i++){
      const r=window.__obdLastWorkoutReward;
      const samePlayer=!r?.playerId||!detail?.playerId||String(r.playerId)===String(detail.playerId);
      const sameType=!r?.type||!detail?.type||String(r.type)===String(detail.type);
      if(r?.workoutId&&samePlayer&&sameType)return r;
      await wait(45);
    }
    return null;
  }

  function ensureStyles(){
    if(document.getElementById('gameplayActionsPreviewStyle'))return;
    const s=document.createElement('style');s.id='gameplayActionsPreviewStyle';s.textContent=`
      .gap-ready-overlay{position:fixed;inset:0;z-index:485;display:grid;place-items:center;padding:16px;background:rgba(2,6,10,.91);backdrop-filter:blur(8px)}.gap-ready-overlay[hidden]{display:none!important}.gap-ready-card{width:min(100%,400px);padding:22px 18px 18px;border:1px solid rgba(255,214,77,.3);border-radius:22px;background:radial-gradient(circle at 50% 0,rgba(255,210,62,.13),transparent 43%),linear-gradient(155deg,#101b25,#060b10 74%);box-shadow:0 28px 90px rgba(0,0,0,.72);text-align:center;color:#fff}.gap-ready-card>small{display:block;color:#ffd75b;font-size:8px;font-weight:1000;letter-spacing:.18em}.gap-ready-card h2{margin:8px auto 8px;font-size:25px;line-height:1.08}.gap-ready-card p{margin:0;color:#91a5b6;font-size:10px;line-height:1.5}.gap-ready-list{display:grid;gap:7px;margin-top:12px;text-align:left}.gap-ready-row{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#08131c}.gap-ready-row>span{font-size:22px}.gap-ready-row strong{display:block;font-size:10px}.gap-ready-row small{display:block;margin-top:2px;color:#8fa4b5;font-size:8px}.gap-ready-ok{width:100%;min-height:46px;margin-top:16px;border:0;border-radius:13px;background:linear-gradient(135deg,#ffb800,#ffe05d);color:#151006;font-weight:1000;cursor:pointer}
      .gap-gym-action{margin-top:10px;padding:10px;border:1px solid rgba(255,215,91,.2);border-radius:14px;background:linear-gradient(145deg,rgba(255,201,40,.07),rgba(255,255,255,.025))}.gap-gym-attack{width:100%;min-height:54px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid rgba(255,215,91,.32);border-radius:13px;background:linear-gradient(135deg,#ffb51c,#ffdf5d);color:#171006;font-weight:1000;cursor:pointer}.gap-gym-attack:disabled{border-color:rgba(148,163,184,.14);background:linear-gradient(135deg,#18212a,#111922);color:#637381;box-shadow:none;cursor:not-allowed}.gap-gym-icon{font-size:20px}.gap-gym-label{font-size:12px;letter-spacing:.08em}.gap-count{min-width:23px;height:23px;display:grid;place-items:center;border-radius:999px;background:#171006;color:#ffd75b;font-size:11px}.gap-gym-attack:disabled .gap-count{background:#27323c;color:#748391}.gap-gym-note{margin-top:6px;text-align:center;color:#73899a;font-size:7px;font-weight:850}.gap-pulse{animation:gapPulse .7s ease}@keyframes gapPulse{45%{box-shadow:0 0 0 3px rgba(255,215,91,.17),0 0 36px rgba(255,201,40,.22)}}
      .gap-wild-action{margin-top:10px;padding:11px 10px 10px;border:1px solid rgba(255,215,91,.23);border-radius:14px;background:linear-gradient(145deg,rgba(255,201,40,.07),rgba(255,255,255,.025));text-align:center}.gap-wild-action small{display:block;color:#8fa4b5;font-size:8px;font-weight:850}.gap-wild-btn{width:100%;min-height:58px;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:11px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:linear-gradient(135deg,#101b25,#081018);color:#fff;font-weight:1000;cursor:pointer}.gap-wild-btn:disabled{opacity:.55}.gap-ball{position:relative;flex:0 0 38px;width:38px;height:38px;border:2px solid #0a0d10;border-radius:50%;overflow:hidden;background:linear-gradient(to bottom,#ef3d4e 0 46%,#111 46% 54%,#f5f7f8 54% 100%);box-shadow:0 4px 12px rgba(0,0,0,.35)}.gap-ball:after{content:'';position:absolute;left:50%;top:50%;width:10px;height:10px;transform:translate(-50%,-50%);border:3px solid #111;border-radius:50%;background:#f5f7f8}.gap-wild-copy{display:grid;text-align:left;line-height:1.1}.gap-wild-copy b{font-size:11px}.gap-wild-copy span{margin-top:3px;color:#ffd75b;font-size:8px}.gap-error{min-height:12px;margin-top:5px;color:#ff7a91;font-size:8px;font-weight:900}
    `;document.head.appendChild(s);
  }

  function ensureReadyOverlay(){
    ensureStyles();let o=document.getElementById('gameplayActionsReadyOverlay');if(o)return o;
    o=document.createElement('div');o.id='gameplayActionsReadyOverlay';o.className='gap-ready-overlay';o.hidden=true;o.innerHTML='<div class="gap-ready-card" role="dialog" aria-modal="true"><small>WORKOUT REWARD</small><div data-gap-ready-content></div><button type="button" class="gap-ready-ok" data-gap-ready-ok>OK</button></div>';document.body.appendChild(o);
    o.querySelector('[data-gap-ready-ok]')?.addEventListener('click',()=>{o.hidden=true;document.body.classList.remove('obd-modal-open');scrollActions()});
    return o;
  }

  function beginBatch(detail,reward=null){
    clearTimeout(currentBatch?.timer);
    currentBatch={detail:{...(detail||{})},workoutId:String(reward?.workoutId||''),gym:false,wild:false,timer:null,shown:false};
    currentBatch.timer=setTimeout(showBatch,1500);
  }
  function scheduleBatch(ms){if(!currentBatch||currentBatch.shown)return;clearTimeout(currentBatch.timer);currentBatch.timer=setTimeout(showBatch,ms)}
  function markGym(workoutId){
    if(!currentBatch)beginBatch({}, {workoutId});
    if(workoutId&&!currentBatch.workoutId)currentBatch.workoutId=String(workoutId);
    if(currentBatch.workoutId&&workoutId&&String(currentBatch.workoutId)!==String(workoutId))beginBatch({}, {workoutId});
    currentBatch.gym=true;scheduleBatch(currentBatch.wild?120:1050);
  }
  function markWild(workoutId){
    if(!currentBatch)beginBatch({}, {workoutId});
    if(workoutId&&!currentBatch.workoutId)currentBatch.workoutId=String(workoutId);
    if(currentBatch.workoutId&&workoutId&&String(currentBatch.workoutId)!==String(workoutId))beginBatch({}, {workoutId});
    currentBatch.wild=true;scheduleBatch(currentBatch.gym?120:260);
  }
  function showBatch(){
    if(!currentBatch||currentBatch.shown||(!currentBatch.gym&&!currentBatch.wild))return;
    currentBatch.shown=true;const both=currentBatch.gym&&currentBatch.wild,o=ensureReadyOverlay(),c=o.querySelector('[data-gap-ready-content]');
    if(both)c.innerHTML='<h2>NEW ACTIONS AVAILABLE!</h2><div class="gap-ready-list"><div class="gap-ready-row"><span>◉</span><div><strong>WILD POKÉMON READY!</strong><small>Go and catch the Wild Pokémon.</small></div></div><div class="gap-ready-row"><span>⚔</span><div><strong>GYM BOSS ATTACK READY!</strong><small>You can attack the Gym Boss.</small></div></div></div>';
    else if(currentBatch.wild)c.innerHTML='<h2>GO AND CATCH THE WILD POKÉMON!</h2><p>Your workout unlocked a catch attempt. The Wild Pokémon is waiting in the menu.</p>';
    else c.innerHTML='<h2>GYM BOSS ATTACK READY!</h2><p>Your workout earned a Gym Boss attack. Use it now or save it for later.</p>';
    o.hidden=false;document.body.classList.add('obd-modal-open');try{navigator.vibrate?.([35,25,55])}catch{}
  }
  function scrollActions(){
    renderGymAction();renderWildAction();
    const both=currentBatch?.gym&&currentBatch?.wild,target=both?(document.getElementById('weeklyBoss')||document.getElementById('wildPokemonBlock')):currentBatch?.gym?document.getElementById('weeklyBoss'):document.getElementById('wildPokemonBlock');
    if(!target)return;target.scrollIntoView?.({behavior:'smooth',block:'center'});target.classList.remove('gap-pulse');requestAnimationFrame(()=>target.classList.add('gap-pulse'));setTimeout(()=>target.classList.remove('gap-pulse'),850);
  }

  async function creditStatus(workoutId=''){
    const id=playerId();if(!id||levelNow()<3){creditState={count:0,next:null,gym:null};renderGymAction();return creditState}
    try{const d=await jsonCall(CREDIT_API,{action:'status',player_id:id,level:levelNow(),workout_id:workoutId});creditState=d;renderGymAction();return d}catch(e){console.warn('Gym attack credit status failed',e);return creditState}
  }

  function renderGymAction(){
    ensureStyles();const block=document.getElementById('weeklyBoss');if(!block||block.hidden)return;
    const moves=block.querySelector('[data-tools]');if(moves&&/ATTACKS/i.test(moves.textContent||''))moves.innerHTML=moves.innerHTML.replace(/ATTACKS/gi,'MOVES');
    let wrap=block.querySelector('[data-gap-gym-action]');if(!wrap){wrap=document.createElement('div');wrap.className='gap-gym-action';wrap.dataset.gapGymAction='1';block.appendChild(wrap)}
    const count=Math.max(0,Number(creditState?.count)||0);wrap.innerHTML=`<button type="button" class="gap-gym-attack" data-gap-gym-attack ${count>0?'':'disabled'}><span class="gap-gym-icon">⚔</span><span class="gap-gym-label">ATTACK</span><b class="gap-count">${count}</b></button><div class="gap-gym-note">${count>0?`${count} stored Gym Boss attack${count===1?'':'s'} available`:'Train to earn a Gym Boss attack'}</div><div class="gap-error" data-gap-gym-error></div>`;
  }

  function wildRead(){try{return JSON.parse(localStorage.getItem(WILD_STORE)||'{}')||{}}catch{return{}}}
  function wildWrite(map){try{localStorage.setItem(WILD_STORE,JSON.stringify(map))}catch{}}
  function saveWild(value){wildPending=value||null;const map=wildRead(),id=String(value?.player_id||playerId());if(id){if(value)map[id]=value;else delete map[id];wildWrite(map)}renderWildAction()}
  function clearWild(id=playerId()){const map=wildRead();if(id)delete map[id];wildWrite(map);if(!wildPending||String(wildPending.player_id)===String(id))wildPending=null;renderWildAction()}
  function renderWildAction(){
    ensureStyles();const block=document.getElementById('wildPokemonBlock');if(!block)return;const old=block.querySelector('[data-gap-wild-action]');const valid=wildPending&&String(wildPending.player_id)===playerId()&&block.querySelector('.wild-main')&&!block.querySelector('.wild-cooldown');if(!valid){old?.remove();return}if(old)return;
    block.insertAdjacentHTML('beforeend','<div class="gap-wild-action" data-gap-wild-action><small>This workout unlocked a catch attempt.</small><button type="button" class="gap-wild-btn" data-gap-wild-catch><span class="gap-ball" aria-hidden="true"></span><span class="gap-wild-copy"><b>THROW POKÉ BALL TO CATCH IT!</b><span>Tap to start the catch battle</span></span></button><div class="gap-error" data-gap-wild-error></div></div>');
  }
  async function restoreWild(){const id=playerId();if(!id){wildPending=null;renderWildAction();return}const p=wildRead()[id];if(!p){wildPending=null;renderWildAction();return}try{const d=await jsonCall(WILD_API,{action:'wild_validate',player_id:id,workout_id:p.workout_id,level:p.level||levelNow()});if(!d?.eligible){clearWild(id);return}wildPending={...p,pokemon_id:d?.wild?.pokemon_id||p.pokemon_id||null};renderWildAction()}catch(e){console.warn('Stored Wild catch validation failed',e)}}
  async function startWild(button){if(!wildPending||button.disabled)return;const p={...wildPending};button.disabled=true;try{const d=await jsonCall(GYM_API,{action:'wild_attempt',player_id:p.player_id,level:p.level||levelNow(),workout_id:p.workout_id,manual_catch:true});if(d?.battle_resolved||d?.wild?.status==='cooldown'||d?.already_resolved||d?.eligible===false)clearWild(p.player_id);window.dispatchEvent(new Event('pageshow'))}catch(e){const n=document.querySelector('[data-gap-wild-error]');if(n)n.textContent=String(e?.message||'Could not start battle')}finally{const live=document.querySelector('[data-gap-wild-catch]');if(live)live.disabled=false}}

  function installGymFlowOverride(){
    const fn=window.__obdGymFlowHandleWorkout;
    if(typeof fn!=='function'||fn.__obdCreditPreviewOverride)return;
    if(!legacyGymFlow)legacyGymFlow=fn;
    const wrapped=detail=>handleFreshWorkout(detail||{});
    wrapped.__obdCreditPreviewOverride=true;window.__obdGymFlowHandleWorkout=wrapped;
  }

  const handled=new Set();
  async function handleFreshWorkout(detail={}){
    const lvl=Math.max(1,Number(detail.levelAfter)||levelNow());if(lvl<3)return;
    const reward=await rewardFor(detail);const wid=String(reward?.workoutId||detail.workoutId||'');const key=wid||`${detail.playerId||playerId()}:${detail.type||''}:${Date.now()>>10}`;
    if(handled.has(key))return;handled.add(key);setTimeout(()=>handled.delete(key),15000);
    if(!currentBatch||currentBatch.shown)beginBatch(detail,reward);
    const status=await creditStatus(wid);
    if(wid&&reward?.eligible!==false&&status?.fresh_eligible)markGym(wid);
    const complete=()=>window.dispatchEvent(new CustomEvent('obd-gym-flow-complete',{detail:{...detail,workoutId:wid}}));
    if(window.__obdStarterStoryPriority)deferredWorkoutComplete={detail:{...detail,workoutId:wid},complete};else complete();
  }

  async function startStoredGymAttack(button){
    if(button.disabled||manualGymSession)return;button.disabled=true;const error=document.querySelector('[data-gap-gym-error]');if(error)error.textContent='';
    try{
      const s=await creditStatus();const credit=s?.next;if(!credit){renderGymAction();return}
      manualGymCredit={...credit,player_id:playerId()};manualGymSession=true;
      const detail={person:playerName(),playerId:playerId(),type:credit.workout_type,workoutId:credit.workout_id,levelAfter:levelNow(),storedGymAttack:true};
      const oldReward=window.__obdLastWorkoutReward;window.__obdLastWorkoutReward={playerId:playerId(),person:playerName(),type:credit.workout_type,workoutId:credit.workout_id,eligible:true,storedGymAttack:true};
      try{
        if(legacyGymFlow)legacyGymFlow(detail);
        else{for(let i=0;i<30&&typeof window.startGymAttack!=='function';i++)await wait(60);if(typeof window.startGymAttack!=='function')throw new Error('Gym battle is not ready');window.startGymAttack(detail)}
      }finally{setTimeout(()=>{if(window.__obdLastWorkoutReward?.storedGymAttack)window.__obdLastWorkoutReward=oldReward},120)}
    }catch(e){manualGymSession=false;manualGymCredit=null;if(error)error.textContent=String(e?.message||'Could not start Gym battle')}
    finally{const live=document.querySelector('[data-gap-gym-attack]');if(live)live.disabled=Math.max(0,Number(creditState?.count)||0)<1}
  }

  function installGymSaveGuard(){
    const current=window.fetch;if(current?.__obdGymCreditSaveGuard)return;const upstream=current.bind(window);
    const wrapped=async function(input,init){
      let body=null,url='';try{url=typeof input==='string'?input:String(input?.url||'');body=typeof init?.body==='string'?JSON.parse(init.body):null}catch{}
      const isSave=manualGymSession&&manualGymCredit&&body?.action==='save_player'&&(url.includes('/functions/v1/gym-game')||url.includes('/functions/v1/gym-game-preview'));
      if(!isSave)return upstream(input,init);
      if(claimBusy)return new Response(JSON.stringify({error:'Gym attack is already being saved'}),{status:409,headers:{'Content-Type':'application/json'}});
      claimBusy=true;const credit={...manualGymCredit};let claimed=false;
      try{
        const claim=await jsonCall(CREDIT_API,{action:'claim',player_id:credit.player_id,level:levelNow(),workout_id:credit.workout_id},upstream);claimed=!!claim?.claimed;if(!claimed)throw new Error('Gym attack credit is no longer available');
        const response=await upstream(input,init);
        if(!response.ok){try{await jsonCall(CREDIT_API,{action:'release',player_id:credit.player_id,workout_id:credit.workout_id},upstream)}catch{};return response}
        manualGymCredit=null;creditState={...creditState,count:Number(claim.count)||Math.max(0,(Number(creditState.count)||1)-1),next:claim.next||null,gym:claim.gym||creditState.gym};renderGymAction();setTimeout(()=>creditStatus(),150);return response;
      }catch(e){if(claimed){try{await jsonCall(CREDIT_API,{action:'release',player_id:credit.player_id,workout_id:credit.workout_id},upstream)}catch{}}return new Response(JSON.stringify({error:String(e?.message||'Could not consume Gym attack')}),{status:409,headers:{'Content-Type':'application/json'}})}
      finally{claimBusy=false}
    };
    wrapped.__obdGymCreditSaveGuard=true;window.fetch=wrapped;
  }

  function installDispatchGuard(){
    const current=window.dispatchEvent;if(current?.__obdStoredGymDispatchGuard)return;const upstream=current.bind(window);
    const wrapped=function(event){
      if(manualGymSession&&event?.type==='obd-gym-flow-complete'){
        manualGymSession=false;manualGymCredit=null;setTimeout(()=>creditStatus(),80);return true;
      }
      return upstream(event);
    };wrapped.__obdStoredGymDispatchGuard=true;window.dispatchEvent=wrapped;
  }

  function observeDom(){
    if(!document.body||document.body.dataset.gapActionsObserver==='1')return;document.body.dataset.gapActionsObserver='1';
    new MutationObserver(()=>{renderGymAction();renderWildAction()}).observe(document.body,{childList:true,subtree:true});
    const checkOverlay=()=>{const o=document.getElementById('bossOverlay');if(!o||o.dataset.gapSessionObserver==='1')return;o.dataset.gapSessionObserver='1';new MutationObserver(()=>{if(manualGymSession&&!o.classList.contains('show')&&!claimBusy){setTimeout(()=>{if(manualGymSession&&!o.classList.contains('show')){manualGymSession=false;manualGymCredit=null;creditStatus()}},120)}}).observe(o,{attributes:true,attributeFilter:['class']})};
    setInterval(checkOverlay,500);checkOverlay();
  }

  window.addEventListener('obd-workout-added',e=>{const d=e.detail||{};beginBatch(d,window.__obdLastWorkoutReward);setTimeout(()=>handleFreshWorkout(d),60)});
  window.addEventListener('obd-starter-story-complete',()=>{const d=deferredWorkoutComplete;deferredWorkoutComplete=null;if(d)d.complete()});
  window.addEventListener('obd-wild-catch-ready',e=>{const d=e.detail||{},body=d.body||{},v=d.validation||{};if(!body.player_id||!body.workout_id||!v?.eligible)return;saveWild({player_id:String(body.player_id),workout_id:String(body.workout_id),level:Number(body.level)||levelNow(),pokemon_id:v?.wild?.pokemon_id||null,created_at:new Date().toISOString()});markWild(String(body.workout_id))});
  window.addEventListener('obd-wild-status-refreshed',e=>{if(e.detail?.wild?.status==='cooldown')clearWild();else renderWildAction()});
  window.addEventListener('obd-player-changed',()=>{wildPending=null;creditState={count:0,next:null,gym:null};manualGymSession=false;manualGymCredit=null;setTimeout(()=>{creditStatus();restoreWild()},180)});
  window.addEventListener('obd-auth-ready',()=>setTimeout(()=>{creditStatus();restoreWild()},220));
  window.addEventListener('pageshow',()=>setTimeout(()=>{creditStatus();renderGymAction();renderWildAction()},320));
  document.addEventListener('click',e=>{const g=e.target?.closest?.('[data-gap-gym-attack]');if(g){startStoredGymAttack(g);return}const w=e.target?.closest?.('[data-gap-wild-catch]');if(w)startWild(w)});

  ensureStyles();ensureReadyOverlay();observeDom();
  installGymSaveGuard();installDispatchGuard();installGymFlowOverride();
  [50,150,350,700,1200,2200,4000].forEach(ms=>setTimeout(()=>{installGymFlowOverride();installGymSaveGuard();installDispatchGuard();renderGymAction()},ms));
  setInterval(()=>{installGymFlowOverride();installGymSaveGuard();installDispatchGuard()},1500);
  setTimeout(()=>{creditStatus();restoreWild()},600);
})();
