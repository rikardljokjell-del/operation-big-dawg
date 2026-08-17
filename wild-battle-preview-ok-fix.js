(()=>{
  if(!window.__OBD_PREVIEW__||window.__obdWildBattleOkFix)return;
  window.__obdWildBattleOkFix=true;

  const style=document.createElement('style');
  style.id='wildBattlePreviewOkFixStyle';
  style.textContent='#wildBattlePreviewOverlay[hidden]{display:none!important}';
  document.head.appendChild(style);

  function hardUnlock(){
    const overlay=document.getElementById('wildBattlePreviewOverlay');
    if(overlay){
      overlay.hidden=true;
      overlay.setAttribute('aria-hidden','true');
      overlay.remove();
    }
    document.body?.classList.remove('obd-modal-open');
    document.documentElement?.classList.remove('obd-modal-open');
  }

  document.addEventListener('click',event=>{
    if(!event.target?.closest?.('[data-wbp-ok]'))return;
    queueMicrotask(()=>{
      hardUnlock();
      window.dispatchEvent(new Event('pageshow'));
    });
  },true);
})();
