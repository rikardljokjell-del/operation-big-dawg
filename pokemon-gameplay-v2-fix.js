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
    if(!id||!block||!unlocked)return;
    if(block.querySelector('[data-wild-countdown]')){wildKickAttempt=0;return}
    if(wildKickAttempt>=3)return;
    wildKickAttempt++;
    // Reuse the runtime's existing pageshow sync hook rather than duplicating
    // Wild state/render logic in this compatibility layer.
    window.dispatchEvent(new Event('pageshow'));
    scheduleWildKick([900,1500,2600][wildKickAttempt-1]||2600);
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
  window.addEventListener('obd-auth-ready',()=>{resetWildKick();scheduleWildKick(900)});
  window.addEventListener('obd-player-changed',()=>{resetWildKick();scheduleWildKick(900)});
  window.addEventListener('online',()=>{resetWildKick();scheduleWildKick(150)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){resetWildKick();scheduleWildKick(500)}});
  if(window.obdAuthReady) scheduleWildKick(900);

  [0,100,250,600,1200].forEach(ms=>setTimeout(install,ms));
})();