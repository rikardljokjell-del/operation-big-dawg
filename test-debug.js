(()=>{
  const DEBUG_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/test-debug-workout';
  const isTestName=value=>String(value||'').trim().toLocaleLowerCase('nb-NO')==='test';
  const originalCall=window.call;
  if(typeof originalCall!=='function'||window.__obdTestDebugRouter)return;
  window.__obdTestDebugRouter=true;

  async function debugCall(payload){
    const response=await fetch(DEBUG_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const text=await response.text();
    let data={};
    try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!response.ok)throw new Error(data.error||text||'Debug request failed');
    return data;
  }

  function targetMeta(payload={}){
    if(payload.player_id&&typeof window.getPlayerMeta==='function'){
      const byId=window.getPlayerMeta(payload.player_id);
      if(byId)return byId;
    }
    if(payload.person&&typeof window.getPlayerMeta==='function'){
      const byName=window.getPlayerMeta(payload.person);
      if(byName)return byName;
    }
    return null;
  }

  call=window.call=async function(payload,pinOverride){
    const action=payload?.action;
    if(action==='add'||action==='undo'){
      const meta=targetMeta(payload),name=meta?.name||payload?.person;
      if(isTestName(name)){
        const playerId=meta?.id||payload?.player_id||window.getSelectedPlayerId?.();
        if(!playerId)throw new Error('Test-spiller mangler player_id');
        return debugCall({action,player_id:playerId,workout_type:payload?.workout_type});
      }
    }
    return originalCall(payload,pinOverride);
  };

  function markDebugPlayer(){
    const name=window.getSelectedPlayer?.()||'';
    document.documentElement.toggleAttribute('data-test-debug',isTestName(name));
    if(isTestName(name)){
      const label=document.getElementById('selectedPlayerLabel');
      if(label&&!label.dataset.debugMarked){label.dataset.debugMarked='1';label.title='DEBUG: hver økt registreres på en ny simulert treningsdag'}
    }
  }
  window.addEventListener('obd-player-changed',markDebugPlayer);
  window.addEventListener('obd-auth-ready',markDebugPlayer);
  setTimeout(markDebugPlayer,200);
})();
