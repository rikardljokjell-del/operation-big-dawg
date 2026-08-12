(()=>{
  if(window.__obdPokemonGameplayV2Fix)return;
  window.__obdPokemonGameplayV2Fix=true;
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
  [0,100,250,600,1200].forEach(ms=>setTimeout(install,ms));
})();
