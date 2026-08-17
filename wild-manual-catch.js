(()=>{
  if(window.__OBD_PREVIEW__||window.__obdWildManualCatchProduction)return;
  window.__obdWildManualCatchProduction=true;

  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const WILD_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/wild-attempt';
  const PIN='1337';
  const STORAGE='obd_wild_catch_pending_v1';
  let pending=null;
  let busy=false;
  let observer=null;

  const activeId=()=>String(window.getSelectedPlayerId?.()||'');
  const activeLevel=()=>{try{return Number(levelInfo(window.getSelectedPlayer?.()||'').level)||1}catch{return 1}};

  function readMap(){try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')||{}}catch{return{}}}
  function writeMap(map){try{localStorage.setItem(STORAGE,JSON.stringify(map))}catch{}}
  function savePending(value){pending=value||null;const map=readMap(),id=String(value?.player_id||activeId()||'');if(id){if(value)map[id]=value;else delete map[id];writeMap(map)}renderAction()}
  function clearPending(id=activeId()){const map=readMap();if(id)delete map[id];writeMap(map);if(!pending||String(pending.player_id)===String(id))pending=null;renderAction()}

  function ensureStyles(){
    if(document.getElementById('wildManualCatchProductionStyle'))return;
    const style=document.createElement('style');
    style.id='wildManualCatchProductionStyle';
    style.textContent=`
      .wmc-ready-overlay{position:fixed;inset:0;z-index:470;display:grid;place-items:center;padding:16px;background:rgba(2,6,10,.9);backdrop-filter:blur(8px)}
      .wmc-ready-overlay[hidden]{display:none!important}.wmc-ready-card{width:min(100%,390px);padding:22px 18px 18px;border:1px solid rgba(255,214,77,.3);border-radius:22px;background:radial-gradient(circle at 50% 0,rgba(255,210,62,.12),transparent 42%),linear-gradient(155deg,#101b25,#060b10 74%);box-shadow:0 28px 90px rgba(0,0,0,.72);text-align:center;color:#fff}.wmc-ready-kicker{display:block;color:#ffd75b;font-size:8px;font-weight:1000;letter-spacing:.18em}.wmc-ready-card h2{margin:8px auto 7px;font-size:25px;line-height:1.08;max-width:310px}.wmc-ready-card p{margin:0;color:#91a5b6;font-size:10px;line-height:1.5}.wmc-ready-ok{width:100%;min-height:46px;margin-top:16px;border:0;border-radius:13px;background:linear-gradient(135deg,#ffb800,#ffe05d);color:#151006;font-weight:1000;cursor:pointer}
      .wmc-action{margin-top:10px;padding:11px 10px 10px;border:1px solid rgba(255,215,91,.23);border-radius:14px;background:linear-gradient(145deg,rgba(255,201,40,.07),rgba(255,255,255,.025));text-align:center}.wmc-action small{display:block;color:#8fa4b5;font-size:8px;font-weight:850;line-height:1.35}.wmc-catch-btn{width:100%;min-height:58px;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:11px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:linear-gradient(135deg,#101b25,#081018);color:#fff;font-weight:1000;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.2)}.wmc-catch-btn:disabled{opacity:.55;cursor:default}.wmc-catch-copy{display:grid;text-align:left;line-height:1.1}.wmc-catch-copy b{font-size:11px;letter-spacing:.04em}.wmc-catch-copy span{margin-top:3px;color:#ffd75b;font-size:8px}.wmc-ball{position:relative;flex:0 0 38px;width:38px;height:38px;border:2px solid #0a0d10;border-radius:50%;overflow:hidden;background:linear-gradient(to bottom,#ef3d4e 0 46%,#111 46% 54%,#f5f7f8 54% 100%);box-shadow:0 4px 12px rgba(0,0,0,.35)}.wmc-ball:after{content:'';position:absolute;left:50%;top:50%;width:10px;height:10px;transform:translate(-50%,-50%);border:3px solid #111;border-radius:50%;background:#f5f7f8}.wmc-error{min-height:13px;margin-top:6px;color:#ff7a91;font-size:8px;font-weight:900}.wmc-pulse{animation:wmcPulse .65s ease}@keyframes wmcPulse{0%,100%{box-shadow:0 16px 42px rgba(0,0,0,.24)}45%{box-shadow:0 0 0 3px rgba(255,215,91,.18),0 0 34px rgba(255,201,40,.22)}}
    `;
    document.head.appendChild(style);
  }

  function ensureReadyOverlay(){
    ensureStyles();let overlay=document.getElementById('wildCatchReadyOverlay');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='wildCatchReadyOverlay';overlay.className='wmc-ready-overlay';overlay.hidden=true;
    overlay.innerHTML=`<div class="wmc-ready-card" role="dialog" aria-modal="true" aria-labelledby="wmcReadyTitle"><span class="wmc-ready-kicker">WILD ENCOUNTER</span><h2 id="wmcReadyTitle">GO AND CATCH THE WILD POKÉMON!</h2><p>Your workout unlocked a catch attempt. The Wild Pokémon is waiting in the menu.</p><button type="button" class="wmc-ready-ok" data-wmc-ready-ok>OK</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-wmc-ready-ok]')?.addEventListener('click',()=>{overlay.hidden=true;document.body.classList.remove('obd-modal-open');scrollToWild()});
    return overlay;
  }
  function showReadyNotice(){const overlay=ensureReadyOverlay();overlay.hidden=false;document.body.classList.add('obd-modal-open');try{navigator.vibrate?.([35,25,55])}catch{}}
  function scrollToWild(){renderAction();const block=document.getElementById('wildPokemonBlock');if(!block)return;block.scrollIntoView?.({behavior:'smooth',block:'center'});block.classList.remove('wmc-pulse');requestAnimationFrame(()=>block.classList.add('wmc-pulse'));setTimeout(()=>block.classList.remove('wmc-pulse'),850)}
  function actionHtml(){return `<div class="wmc-action" data-wmc-action><small>This workout unlocked a catch attempt. Start the encounter when you're ready.</small><button type="button" class="wmc-catch-btn" data-wmc-catch><span class="wmc-ball" aria-hidden="true"></span><span class="wmc-catch-copy"><b>THROW POKÉ BALL TO CATCH IT!</b><span>Tap to start the catch battle</span></span></button><div class="wmc-error" data-wmc-error></div></div>`}
  function renderAction(){ensureStyles();const block=document.getElementById('wildPokemonBlock');if(!block)return;const existing=block.querySelector('[data-wmc-action]'),valid=pending&&String(pending.player_id)===activeId()&&block.querySelector('.wild-main')&&!block.querySelector('.wild-cooldown');if(!valid){existing?.remove();return}if(existing)return;block.insertAdjacentHTML('beforeend',actionHtml())}

  async function validateStored(candidate){
    if(!candidate?.player_id||!candidate?.workout_id)return false;
    try{
      const response=await fetch(WILD_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'wild_validate',player_id:candidate.player_id,workout_id:candidate.workout_id,level:candidate.level||activeLevel(),pin:PIN})});
      const data=await response.json();
      if(!response.ok||!data?.eligible){clearPending(candidate.player_id);return false}
      pending={...candidate,level:candidate.level||activeLevel(),pokemon_id:data?.wild?.pokemon_id||candidate.pokemon_id||null};renderAction();return true;
    }catch(error){console.warn('Stored Wild catch validation failed',error);return false}
  }
  async function restorePending(){const id=activeId();if(!id){pending=null;renderAction();return}const candidate=readMap()[id];if(!candidate){pending=null;renderAction();return}pending=candidate;await validateStored(candidate)}

  async function startCatch(button){
    if(busy||!pending)return;const current={...pending};if(String(current.player_id)!==activeId())return clearPending(current.player_id);
    busy=true;button.disabled=true;const errorNode=document.querySelector('[data-wmc-error]');if(errorNode)errorNode.textContent='';
    try{
      const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'wild_attempt',player_id:current.player_id,level:current.level||activeLevel(),workout_id:current.workout_id,manual_catch:true,pin:PIN})});
      const text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
      if(!response.ok)throw new Error(data.error||text||'Could not start Wild battle');
      if(data?.battle_resolved||data?.wild?.status==='cooldown'||data?.already_resolved||data?.eligible===false)clearPending(current.player_id);
      window.dispatchEvent(new Event('pageshow'));
    }catch(error){console.warn('Manual Wild catch failed',error);const node=document.querySelector('[data-wmc-error]');if(node)node.textContent=String(error?.message||'Could not start battle. Try again.')}
    finally{busy=false;const live=document.querySelector('[data-wmc-catch]');if(live)live.disabled=false}
  }

  window.addEventListener('obd-wild-catch-ready',event=>{const detail=event.detail||{},body=detail.body||{},validation=detail.validation||{};if(!body.player_id||!body.workout_id||!validation?.eligible)return;savePending({player_id:String(body.player_id),workout_id:String(body.workout_id),level:Number(body.level)||activeLevel(),pokemon_id:validation?.wild?.pokemon_id||null,created_at:new Date().toISOString()});showReadyNotice();setTimeout(renderAction,0)});
  document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-wmc-catch]');if(button)startCatch(button)});
  window.addEventListener('obd-player-changed',()=>{pending=null;setTimeout(restorePending,120)});
  window.addEventListener('obd-auth-ready',()=>setTimeout(restorePending,180));
  window.addEventListener('obd-wild-status-refreshed',event=>{if(event.detail?.wild?.status==='cooldown')clearPending();else setTimeout(renderAction,0)});
  window.addEventListener('pageshow',()=>setTimeout(renderAction,300));
  const startObserver=()=>{if(observer||!document.body)return;observer=new MutationObserver(()=>renderAction());observer.observe(document.body,{childList:true,subtree:true})};
  ensureStyles();if(document.body)startObserver();else document.addEventListener('DOMContentLoaded',startObserver,{once:true});setTimeout(restorePending,500);
})();