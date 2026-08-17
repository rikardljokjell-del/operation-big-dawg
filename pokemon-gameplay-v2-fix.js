(()=>{
  if(window.__obdPokemonGameplayV2Fix)return;
  window.__obdPokemonGameplayV2Fix=true;

  // The Wild UI depends on one startup status request. A temporary network/5xx
  // failure used to leave the block empty until the 30 s poll or a manual refresh.
  // Retry only wild_status calls; all other fetches keep their original behavior.
  function installWildFetchRetry(){
    if(window.fetch?.__obdWildStatusRetry)return;
    const upstream=window.fetch.bind(window);
    const wrapped=async function(input,init){
      let isWildStatus=false;
      try{
        const url=typeof input==='string'?input:String(input?.url||'');
        if(url.includes('/functions/v1/gym-game')&&typeof init?.body==='string'){
          const body=JSON.parse(init.body);
          isWildStatus=body?.action==='wild_status';
        }
      }catch{}
      if(!isWildStatus)return upstream(input,init);

      let lastResponse=null,lastError=null;
      const delays=[250,700];
      for(let attempt=0;attempt<3;attempt++){
        try{
          const response=await upstream(input,init);
          if(response.ok||response.status<500)return response;
          lastResponse=response;
        }catch(error){lastError=error}
        if(attempt<2)await new Promise(resolve=>setTimeout(resolve,delays[attempt]));
      }
      if(lastResponse)return lastResponse;
      throw lastError||new Error('Wild Pokémon status request failed');
    };
    wrapped.__obdWildStatusRetry=true;
    wrapped.__obdWildStatusRetryUpstream=upstream;
    window.fetch=wrapped;
  }

  let wildKickAttempt=0;
  let wildKickTimer=null;
  let observedPlayerId='';

  function resetWildKick(){
    clearTimeout(wildKickTimer);
    wildKickTimer=null;
    wildKickAttempt=0;
  }
  function scheduleWildKick(delay=1200){
    clearTimeout(wildKickTimer);
    wildKickTimer=setTimeout(kickWildIfMissing,delay);
  }
  function kickWildIfMissing(){
    wildKickTimer=null;
    const id=window.getSelectedPlayerId?.()||'';
    const block=document.getElementById('wildPokemonBlock');
    const unlocked=document.body.classList.contains('obd-starter-pokemon-unlocked');
    if(!id||!block)return;

    // Starter unlock and Wild status are separate requests. If Wild already loaded
    // while its block was still gated, the countdown will be ready the instant the
    // starter gate opens. Otherwise keep a short startup retry running.
    if(!unlocked){scheduleWildKick(180);return}
    if(block.querySelector('[data-wild-countdown]')){wildKickAttempt=0;return}
    if(wildKickAttempt>=3)return;
    wildKickAttempt++;
    // Reuse the runtime's existing pageshow sync hook rather than duplicating
    // Wild state/render logic in this compatibility layer.
    window.dispatchEvent(new Event('pageshow'));
    scheduleWildKick([450,900,1600][wildKickAttempt-1]||1600);
  }

  function playerBecameAvailable(){
    const id=window.getSelectedPlayerId?.()||'';
    if(!id){observedPlayerId='';return}
    if(id===observedPlayerId)return;
    observedPlayerId=id;
    resetWildKick();

    // auth.js sets the selected player before its slower compatibility/auth-ready
    // tail finishes. Trigger the normal page-resume sync immediately at that point,
    // so Starter + Wild requests begin in parallel instead of waiting many seconds.
    window.dispatchEvent(new Event('pageshow'));
    scheduleWildKick(180);
  }

  function installPlayerReadyObserver(){
    if(document.documentElement.dataset.obdWildPlayerObserver==='1')return;
    document.documentElement.dataset.obdWildPlayerObserver='1';
    new MutationObserver(playerBecameAvailable).observe(document.documentElement,{attributes:true,attributeFilter:['data-player']});
    playerBecameAvailable();
  }

  function ensureWildRefreshHintStyle(){
    if(document.getElementById('obdWildRefreshHintStyle'))return;
    const style=document.createElement('style');
    style.id='obdWildRefreshHintStyle';
    style.textContent='.wild-refresh-hint{margin-top:4px;color:#ff4b55;font-size:9px;font-weight:1000;font-style:italic;line-height:1.2}';
    document.head.appendChild(style);
  }

  function updateWildRefreshHint(){
    const block=document.getElementById('wildPokemonBlock');
    if(!block)return;
    const countdown=block.querySelector('[data-wild-countdown]');
    const unresolved=countdown&&String(countdown.textContent||'').trim()==='--:--:--';
    let hint=block.querySelector('.wild-refresh-hint');
    if(!unresolved){
      hint?.remove();
      return;
    }
    if(!hint){
      hint=document.createElement('div');
      hint.className='wild-refresh-hint';
      hint.textContent='refresh page to spawn wild pokémon';
      countdown.insertAdjacentElement('afterend',hint);
    }
  }

  function installWildRefreshHint(){
    ensureWildRefreshHintStyle();
    const block=document.getElementById('wildPokemonBlock');
    if(!block||block.dataset.obdRefreshHintObserver==='1')return false;
    block.dataset.obdRefreshHintObserver='1';
    new MutationObserver(updateWildRefreshHint).observe(block,{childList:true,subtree:true,characterData:true});
    updateWildRefreshHint();
    return true;
  }

  function install(){
    const modal=document.getElementById('bossModal');
    if(!modal||modal.dataset.v2ResetObserver)return false;
    modal.dataset.v2ResetObserver='1';
    const check=()=>{
      const view=String(modal.querySelector('.boss-alert')?.textContent||'').trim().toUpperCase();
      if(view!=='GYM LEADER DOWN!')delete modal.dataset.v2Victory;
    };
    new MutationObserver(check).observe(modal,{childList:true,subtree:true,characterData:true});
    check();
    return true;
  }

  installWildFetchRetry();
  installPlayerReadyObserver();
  window.addEventListener('obd-auth-ready',()=>{playerBecameAvailable();resetWildKick();scheduleWildKick(180);installWildRefreshHint()});
  window.addEventListener('obd-player-changed',()=>{observedPlayerId='';playerBecameAvailable();resetWildKick();scheduleWildKick(180);installWildRefreshHint()});
  window.addEventListener('online',()=>{resetWildKick();scheduleWildKick(100)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){resetWildKick();scheduleWildKick(250);updateWildRefreshHint()}});
  if(window.obdAuthReady) scheduleWildKick(180);

  [0,100,250,600,1200].forEach(ms=>setTimeout(install,ms));
  [0,100,250,600,1200,2500].forEach(ms=>setTimeout(installWildRefreshHint,ms));
})();