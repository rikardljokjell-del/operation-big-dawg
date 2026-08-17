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
    // Let the battle runtime's own OK handler resolve the pending workout flow first.
    // Then remove the overlay node entirely so no author CSS can keep it visible.
    queueMicrotask(()=>{
      hardUnlock();
      setTimeout(()=>{
        hardUnlock();
        window.dispatchEvent(new Event('pageshow'));
      },80);
    });
  },true);
})();
