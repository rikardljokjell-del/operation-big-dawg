(()=>{
  if(!window.__OBD_PREVIEW__||window.__obdGameplayActionsPreviewV2)return;
  window.__obdGameplayActionsPreviewV2=true;

  const CREDIT_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-attack-credits-preview';
  const WILD_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/wild-attempt-preview';
  const READY_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/wild-ready-preview';
  const GYM_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const PIN='1337';
  const WILD_STORE='obd_preview_wild_catch_pending_v3';

  let creditState={count:0,next:null,gym:null};
  let wildPending=null,currentBatch=null,legacyGymFlow=null,manualGymCredit=null;
  let manualGymSession=false,claimBusy=false,deferredComplete=null;
  const handled=new Set();

  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const playerId=()=>String(window.getSelectedPlayerId?.()||'');
  const playerName=()=>String(window.getSelectedPlayer?.()||'');
  const levelNow=()=>{try{return Math.max(1,Number(levelInfo(playerName()).level)||1)}catch{return 1}};

  async function call(url,payload,fetcher=window.fetch.bind(window)){
    const r=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,pin:payload?.pin||PIN})});
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!r.ok)throw new Error(data.error||text||'Request failed');
    return data;
  }

  async function rewardFor(detail){
    for(let i=0;i<12;i++){
      const r=window.__obdLastWorkoutReward;
      const samePlayer=!r?.playerId||!detail?.playerId||String(r.playerId)===String(detail.playerId);
      const sameType=!r?.type||!detail?.type||String(r.type)===String(detail.type);
      if(r?.workoutId&&samePlayer&&sameType)return r;
      await wait(45);
    }
    return null;
  }

  function ensureStyle(){
    if(document.getElementById('gameplayActionsPreviewV2Style'))return;
    const s=document.createElement('style');s.id='gameplayActionsPreviewV2Style';s.textContent=`
      .gap2-ready{position:fixed;inset:0;z-index:485;display:grid;place-items:center;padding:16px;background:rgba(2,6,10,.91);backdrop-filter:blur(8px)}.gap2-ready[hidden]{display:none!important}.gap2-card{width:min(100%,400px);padding:22px 18px 18px;border:1px solid rgba(255,214,77,.3);border-radius:22px;background:radial-gradient(circle at 50% 0,rgba(255,210,62,.13),transparent 43%),linear-gradient(155deg,#101b25,#060b10 74%);box-shadow:0 28px 90px rgba(0,0,0,.72);text-align:center;color:#fff}.gap2-card>small{display:block;color:#ffd75b;font-size:8px;font-weight:1000;letter-spacing:.18em}.gap2-card h2{margin:8px auto;font-size:25px;line-height:1.08}.gap2-card p{margin:0;color:#91a5b6;font-size:10px;line-height:1.5}.gap2-list{display:grid;gap:7px;margin-top:12px;text-align:left}.gap2-row{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#08131c}.gap2-row>span{font-size:22px}.gap2-row strong{display:block;font-size:10px}.gap2-row small{display:block;margin-top:2px;color:#8fa4b5;font-size:8px}.gap2-ok{width:100%;min-height:46px;margin-top:16px;border:0;border-radius:13px;background:linear-gradient(135deg,#ffb800,#ffe05d);color:#151006;font-weight:1000;cursor:pointer}
      .gap2-gym{margin-top:10px;padding:10px;border:1px solid rgba(255,215,91,.2);border-radius:14px;background:linear-gradient(145deg,rgba(255,201,40,.07),rgba(255,255,255,.025))}.gap2-attack{width:100%;min-height:54px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid rgba(255,215,91,.32);border-radius:13px;background:linear-gradient(135deg,#ffb51c,#ffdf5d);color:#171006;font-weight:1000;cursor:pointer}.gap2-attack:disabled{border-color:rgba(148,163,184,.14);background:linear-gradient(135deg,#18212a,#111922);color:#637381;cursor:not-allowed}.gap2-count{min-width:23px;height:23px;display:grid;place-items:center;border-radius:999px;background:#171006;color:#ffd75b;font-size:11px}.gap2-attack:disabled .gap2-count{background:#27323c;color:#748391}.gap2-note{margin-top:6px;text-align:center;color:#73899a;font-size:7px;font-weight:850}.gap2-error{min-height:11px;margin-top:4px;color:#ff7a91;font-size:8px;font-weight:900}
      .gap2-wild{margin-top:10px;padding:11px 10px 10px;border:1px solid rgba(255,215,91,.23);border-radius:14px;background:linear-gradient(145deg,rgba(255,201,40,.07),rgba(255,255,255,.025));text-align:center}.gap2-wild small{display:block;color:#8fa4b5;font-size:8px;font-weight:850}.gap2-wild-btn{width:100%;min-height:58px;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:11px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:linear-gradient(135deg,#101b25,#081018);color:#fff;font-weight:1000;cursor:pointer}.gap2-wild-btn:disabled{opacity:.55}.gap2-ball{position:relative;flex:0 0 38px;width:38px;height:38px;border:2px solid #0a0d10;border-radius:50%;overflow:hidden;background:linear-gradient(to bottom,#ef3d4e 0 46%,#111 46% 54%,#f5f7f8 54% 100%);box-shadow:0 4px 12px rgba(0,0,0,.35)}.gap2-ball:after{content:'';position:absolute;left:50%;top:50%;width:10px;height:10px;transform:translate(-50%,-50%);border:3px solid #111;border-radius:50%;background:#f5f7f8}.gap2-wild-copy{display:grid;text-align:left;line-height:1.1}.gap2-wild-copy b{font-size:11px}.gap2-wild-copy span{margin-top:3px;color:#ffd75b;font-size:8px}.gap2-pulse{animation:gap2Pulse .7s ease}@keyframes gap2Pulse{45%{box-shadow:0 0 0 3px rgba(255,215,91,.17),0 0 36px rgba(255,201,40,.22)}}
    `;document.head.appendChild(s);
  }

  function ensureOverlay(){
    ensureStyle();let o=document.getElementById('gameplayActionsReadyOverlayV2');if(o)return o;
    o=document.createElement('div');o.id='gameplayActionsReadyOverlayV2';o.className='gap2-ready';o.hidden=true;
    o.innerHTML='<div class="gap2-card" role="dialog" aria-modal="true"><small>WORKOUT REWARD</small><div data-gap2-content></div><button type="button" class="gap2-ok" data-gap2-ok>OK</button></div>';
    document.body.appendChild(o);o.querySelector('[data-gap2-ok]')?.addEventListener('click',()=>{o.hidden=true;document.body.classList.remove('obd-modal-open');scrollActions()});return o;
  }

  function beginBatch(detail,reward){clearTimeout(currentBatch?.timer);currentBatch={detail:{...(detail||{})},workoutId:String(reward?.workoutId||''),gym:false,wild:false,shown:false,timer:null};currentBatch.timer=setTimeout(showBatch,1250)}
  function scheduleBatch(ms){if(!currentBatch||currentBatch.shown)return;clearTimeout(currentBatch.timer);currentBatch.timer=setTimeout(showBatch,ms)}
  function markGym(wid){if(!currentBatch)beginBatch({}, {workoutId:wid});if(wid&&!currentBatch.workoutId)currentBatch.workoutId=String(wid);if(currentBatch.workoutId&&wid&&currentBatch.workoutId!==String(wid))return;currentBatch.gym=true;scheduleBatch(currentBatch.wild?100:900)}
  function markWild(wid){if(!currentBatch)beginBatch({}, {workoutId:wid});if(wid&&!currentBatch.workoutId)currentBatch.workoutId=String(wid);if(currentBatch.workoutId&&wid&&currentBatch.workoutId!==String(wid))return;currentBatch.wild=true;scheduleBatch(currentBatch.gym?100:180)}
  function showBatch(){
    if(!currentBatch||currentBatch.shown||(!currentBatch.gym&&!currentBatch.wild))return;
    if(window.__obdStarterStoryPriority){scheduleBatch(250);return}
    currentBatch.shown=true;const both=currentBatch.gym&&currentBatch.wild,o=ensureOverlay(),c=o.querySelector('[data-gap2-content]');
    if(both)c.innerHTML='<h2>NEW ACTIONS AVAILABLE!</h2><div class="gap2-list"><div class="gap2-row"><span>◉</span><div><strong>WILD POKÉMON READY!</strong><small>Go and catch the Wild Pokémon.</small></div></div><div class="gap2-row"><span>⚔</span><div><strong>GYM BOSS ATTACK READY!</strong><small>You can attack the Gym Boss now or save it.</small></div></div></div>';
    else if(currentBatch.wild)c.innerHTML='<h2>GO AND CATCH THE WILD POKÉMON!</h2><p>The Wild Pokémon is ready. Throw the Poké Ball from the Wild Pokémon block.</p>';
    else c.innerHTML='<h2>GYM BOSS ATTACK READY!</h2><p>Your workout earned one Gym Boss attack. Use it now or save it for later.</p>';
    o.hidden=false;document.body.classList.add('obd-modal-open');try{navigator.vibrate?.([35,25,55])}catch{}
  }
  function scrollActions(){renderAll();const both=currentBatch?.gym&&currentBatch?.wild,target=both?(document.getElementById('weeklyBoss')||document.getElementById('wildPokemonBlock')):currentBatch?.gym?document.getElementById('weeklyBoss'):document.getElementById('wildPokemonBlock');if(!target)return;target.scrollIntoView?.({behavior:'smooth',block:'center'});target.classList.remove('gap2-pulse');requestAnimationFrame(()=>target.classList.add('gap2-pulse'));setTimeout(()=>target.classList.remove('gap2-pulse'),850)}

  async function creditStatus(wid=''){
    const id=playerId();if(!id||levelNow()<3){creditState={count:0,next:null,gym:null};renderGymAction();return creditState}
    try{creditState=await call(CREDIT_API,{action:'status',player_id:id,level:levelNow(),workout_id:wid});renderGymAction();return creditState}catch(e){console.warn('Gym credit status failed',e);return creditState}
  }
  function renderGymAction(){
    const block=document.getElementById('weeklyBoss');if(!block||block.hidden)return;
    let wrap=block.querySelector('[data-gap2-gym]');if(!wrap){wrap=document.createElement('div');wrap.className='gap2-gym';wrap.dataset.gap2Gym='1';block.appendChild(wrap)}
    const count=Math.max(0,Number(creditState?.count)||0),sig=String(count);if(wrap.dataset.sig===sig)return;wrap.dataset.sig=sig;
    wrap.innerHTML=`<button type="button" class="gap2-attack" data-gap2-attack ${count?'':'disabled'}><span>⚔</span><span>ATTACK</span><b class="gap2-count">${count}</b></button><div class="gap2-note">${count?`${count} stored Gym Boss attack${count===1?'':'s'} available`:'Train to earn a Gym Boss attack'}</div><div class="gap2-error" data-gap2-gym-error></div>`;
  }

  function wildRead(){try{return JSON.parse(localStorage.getItem(WILD_STORE)||'{}')||{}}catch{return{}}}
  function wildWrite(v){try{localStorage.setItem(WILD_STORE,JSON.stringify(v))}catch{}}
  function saveWild(v){wildPending=v||null;const map=wildRead(),id=String(v?.player_id||playerId());if(id){if(v)map[id]=v;else delete map[id];wildWrite(map)}renderWildAction()}
  function clearWild(id=playerId()){const map=wildRead();if(id)delete map[id];wildWrite(map);if(!wildPending||String(wildPending.player_id)===String(id))wildPending=null;renderWildAction()}
  function renderWildAction(){
    const block=document.getElementById('wildPokemonBlock');if(!block)return;const old=block.querySelector('[data-gap2-wild]');
    const valid=wildPending&&String(wildPending.player_id)===playerId()&&block.querySelector('.wild-main')&&!block.querySelector('.wild-cooldown');
    if(!valid){old?.remove();return}if(old)return;
    block.insertAdjacentHTML('beforeend','<div class="gap2-wild" data-gap2-wild><small>WILD POKÉMON READY</small><button type="button" class="gap2-wild-btn" data-gap2-wild-catch><span class="gap2-ball" aria-hidden="true"></span><span class="gap2-wild-copy"><b>THROW POKÉ BALL TO CATCH IT!</b><span>Tap to start the catch battle</span></span></button><div class="gap2-error" data-gap2-wild-error></div></div>');
  }
  async function readyWild(){
    const id=playerId();if(!id)return null;
    try{const d=await call(READY_API,{player_id:id});if(d?.eligible&&d?.workout_id){saveWild({player_id:id,workout_id:String(d.workout_id),level:levelNow(),pokemon_id:d?.wild?.pokemon_id||null,created_at:new Date().toISOString()});return d}if(d?.wild?.status!=='active')clearWild(id);return d}catch(e){console.warn('Wild ready lookup failed',e);return null}
  }
  async function restoreWild(){
    const id=playerId();if(!id){wildPending=null;renderWildAction();return}
    const p=wildRead()[id];
    if(p){try{const d=await call(WILD_API,{action:'wild_validate',player_id:id,workout_id:p.workout_id,level:p.level||levelNow()});if(d?.eligible){wildPending={...p,pokemon_id:d?.wild?.pokemon_id||p.pokemon_id||null};renderWildAction();return}}catch(e){console.warn('Stored Wild validation failed',e)}}
    clearWild(id);await readyWild();
  }
  async function startWild(btn){
    if(!wildPending||btn.disabled)return;const p={...wildPending};btn.disabled=true;
    try{const d=await call(GYM_API,{action:'wild_attempt',player_id:p.player_id,level:p.level||levelNow(),workout_id:p.workout_id,manual_catch:true});if(d?.battle_resolved||d?.wild?.status==='cooldown'||d?.already_resolved||d?.eligible===false)clearWild(p.player_id);window.dispatchEvent(new Event('pageshow'))}
    catch(e){const n=document.querySelector('[data-gap2-wild-error]');if(n)n.textContent=String(e?.message||'Could not start battle')}
    finally{const live=document.querySelector('[data-gap2-wild-catch]');if(live)live.disabled=false}
  }

  async function handleFreshWorkout(detail={}){
    const lvl=Math.max(1,Number(detail.levelAfter)||levelNow());if(lvl<3)return;
    const reward=await rewardFor(detail),wid=String(reward?.workoutId||detail.workoutId||'');if(!wid)return;
    if(handled.has(wid))return;handled.add(wid);setTimeout(()=>handled.delete(wid),20000);
    if(!currentBatch||currentBatch.shown)beginBatch(detail,reward);
    const s=await creditStatus(wid);if(reward?.eligible!==false&&s?.fresh_eligible)markGym(wid);
    const complete=()=>window.dispatchEvent(new CustomEvent('obd-gym-flow-complete',{detail:{...detail,workoutId:wid}}));
    if(window.__obdStarterStoryPriority)deferredComplete=complete;else complete();
    [180,520,1050].forEach(ms=>setTimeout(async()=>{const d=await readyWild();if(d?.eligible&&String(d.workout_id)===wid)markWild(wid)},ms));
  }

  function installGymOverride(){
    const fn=window.__obdGymFlowHandleWorkout;if(typeof fn!=='function'||fn.__obdPreviewV2)return;
    if(!legacyGymFlow)legacyGymFlow=fn;
    const wrapped=detail=>handleFreshWorkout(detail||{});wrapped.__obdPreviewV2=true;window.__obdGymFlowHandleWorkout=wrapped;
  }

  async function startGym(btn){
    if(btn.disabled||manualGymSession)return;btn.disabled=true;const err=document.querySelector('[data-gap2-gym-error]');if(err)err.textContent='';
    try{
      const s=await creditStatus(),credit=s?.next;if(!credit){renderGymAction();return}
      manualGymCredit={...credit,player_id:playerId()};manualGymSession=true;
      const detail={person:playerName(),playerId:playerId(),type:credit.workout_type,workoutId:credit.workout_id,levelAfter:levelNow(),storedGymAttack:true};
      const old=window.__obdLastWorkoutReward;window.__obdLastWorkoutReward={playerId:playerId(),person:playerName(),type:credit.workout_type,workoutId:credit.workout_id,eligible:true,storedGymAttack:true};
      try{if(legacyGymFlow)legacyGymFlow(detail);else{for(let i=0;i<30&&typeof window.startGymAttack!=='function';i++)await wait(60);if(typeof window.startGymAttack!=='function')throw new Error('Gym battle is not ready');window.startGymAttack(detail)}}finally{setTimeout(()=>{if(window.__obdLastWorkoutReward?.storedGymAttack)window.__obdLastWorkoutReward=old},150)}
    }catch(e){manualGymSession=false;manualGymCredit=null;if(err)err.textContent=String(e?.message||'Could not start Gym battle')}
    finally{renderGymAction()}
  }

  function installSaveGuard(){
    const current=window.fetch;if(current?.__obdPreviewV2SaveGuard)return;const upstream=current.bind(window);
    const wrapped=async function(input,init){
      let body=null,url='';try{url=typeof input==='string'?input:String(input?.url||'');body=typeof init?.body==='string'?JSON.parse(init.body):null}catch{}
      const isSave=manualGymSession&&manualGymCredit&&body?.action==='save_player'&&(url.includes('/functions/v1/gym-game')||url.includes('/functions/v1/gym-game-preview'));
      if(!isSave)return upstream(input,init);if(claimBusy)return new Response(JSON.stringify({error:'Gym attack is already being saved'}),{status:409,headers:{'Content-Type':'application/json'}});
      claimBusy=true;const credit={...manualGymCredit};let claimed=false;
      try{const c=await call(CREDIT_API,{action:'claim',player_id:credit.player_id,level:levelNow(),workout_id:credit.workout_id},upstream);claimed=!!c?.claimed;if(!claimed)throw new Error('Gym attack credit is no longer available');const response=await upstream(input,init);if(!response.ok){try{await call(CREDIT_API,{action:'release',player_id:credit.player_id,workout_id:credit.workout_id},upstream)}catch{};return response}manualGymCredit=null;creditState={...creditState,count:Number(c.count)||0,next:c.next||null,gym:c.gym||creditState.gym};renderGymAction();setTimeout(()=>creditStatus(),160);return response}
      catch(e){if(claimed){try{await call(CREDIT_API,{action:'release',player_id:credit.player_id,workout_id:credit.workout_id},upstream)}catch{}}return new Response(JSON.stringify({error:String(e?.message||'Could not consume Gym attack')}),{status:409,headers:{'Content-Type':'application/json'}})}finally{claimBusy=false}
    };wrapped.__obdPreviewV2SaveGuard=true;window.fetch=wrapped;
  }
  function installDispatchGuard(){
    const current=window.dispatchEvent;if(current?.__obdPreviewV2DispatchGuard)return;const upstream=current.bind(window);
    const wrapped=function(event){if(manualGymSession&&event?.type==='obd-gym-flow-complete'){manualGymSession=false;manualGymCredit=null;setTimeout(()=>creditStatus(),100);return true}return upstream(event)};wrapped.__obdPreviewV2DispatchGuard=true;window.dispatchEvent=wrapped;
  }

  function renderAll(){renderGymAction();renderWildAction()}
  window.addEventListener('obd-workout-added',e=>{const d=e.detail||{};beginBatch(d,window.__obdLastWorkoutReward);setTimeout(()=>handleFreshWorkout(d),70)});
  window.addEventListener('obd-starter-story-complete',()=>{const f=deferredComplete;deferredComplete=null;if(f)f();scheduleBatch(150)});
  window.addEventListener('obd-wild-catch-ready',e=>{const d=e.detail||{},b=d.body||{},v=d.validation||{};if(!b.player_id||!b.workout_id||!v?.eligible)return;saveWild({player_id:String(b.player_id),workout_id:String(b.workout_id),level:Number(b.level)||levelNow(),pokemon_id:v?.wild?.pokemon_id||null,created_at:new Date().toISOString()});markWild(String(b.workout_id))});
  window.addEventListener('obd-wild-status-refreshed',e=>{if(e.detail?.wild?.status==='cooldown')clearWild();else setTimeout(restoreWild,80)});
  window.addEventListener('obd-player-changed',()=>{wildPending=null;creditState={count:0,next:null,gym:null};manualGymSession=false;manualGymCredit=null;currentBatch=null;setTimeout(()=>{creditStatus();restoreWild()},180)});
  window.addEventListener('obd-auth-ready',()=>setTimeout(()=>{creditStatus();restoreWild()},220));
  window.addEventListener('pageshow',()=>setTimeout(()=>{creditStatus();restoreWild();renderAll()},260));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>{creditStatus();restoreWild()},120)});
  document.addEventListener('click',e=>{const g=e.target?.closest?.('[data-gap2-attack]');if(g){startGym(g);return}const w=e.target?.closest?.('[data-gap2-wild-catch]');if(w)startWild(w)});

  ensureStyle();ensureOverlay();installSaveGuard();installDispatchGuard();installGymOverride();
  [60,180,420,900,1600,3000].forEach(ms=>setTimeout(()=>{installGymOverride();installSaveGuard();installDispatchGuard();renderAll()},ms));
  setInterval(()=>{installGymOverride();installSaveGuard();installDispatchGuard();renderAll()},700);
  setTimeout(()=>{creditStatus();restoreWild()},500);
})();
