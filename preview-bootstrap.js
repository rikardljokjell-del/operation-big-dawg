(()=>{
  if(window.__obdPreviewBootstrap)return;
  window.__obdPreviewBootstrap=true;
  window.__OBD_PREVIEW__=true;

  const replacements=[
    ['/functions/v1/training-tracker-character4-preview','/functions/v1/training-tracker-character4-preview'],
    ['/functions/v1/admin-console-character4-preview','/functions/v1/admin-console-character4-preview'],
    ['/functions/v1/training-tracker-preview','/functions/v1/training-tracker-character4-preview'],
    ['/functions/v1/admin-console-preview','/functions/v1/admin-console-character4-preview'],
    ['/functions/v1/gym-game-preview','/functions/v1/gym-game-preview'],
    ['/functions/v1/starter-pokemon-preview','/functions/v1/starter-pokemon-preview'],
    ['/functions/v1/wild-attempt-preview','/functions/v1/wild-attempt-preview'],
    ['/functions/v1/test-debug-workout-preview','/functions/v1/test-debug-workout-preview'],
    ['/functions/v1/training-tracker','/functions/v1/training-tracker-character4-preview'],
    ['/functions/v1/admin-console','/functions/v1/admin-console-character4-preview'],
    ['/functions/v1/gym-game','/functions/v1/gym-game-preview'],
    ['/functions/v1/starter-pokemon','/functions/v1/starter-pokemon-preview'],
    ['/functions/v1/wild-attempt','/functions/v1/wild-attempt-preview'],
    ['/functions/v1/test-debug-workout','/functions/v1/test-debug-workout-preview']
  ];

  const nativeFetch=window.fetch.bind(window);
  const rewrite=value=>{
    let url=String(value||'');
    for(const [from,to] of replacements){
      if(url.includes(from)){url=url.replace(from,to);break}
    }
    return url;
  };

  window.fetch=function(input,init){
    try{
      if(typeof input==='string')return nativeFetch(rewrite(input),init);
      if(input instanceof Request){
        const next=rewrite(input.url);
        if(next!==input.url)return nativeFetch(new Request(next,input),init);
      }
    }catch(error){console.warn('Preview route fallback',error)}
    return nativeFetch(input,init);
  };

  const style=document.createElement('style');
  style.textContent='.obd-preview-badge{position:fixed;z-index:9999;right:8px;top:8px;padding:4px 7px;border:1px solid rgba(255,201,40,.45);border-radius:999px;background:rgba(7,14,21,.86);color:#ffd34d;font:900 8px/1 system-ui,sans-serif;letter-spacing:.12em;pointer-events:none;box-shadow:0 5px 18px rgba(0,0,0,.35)}';
  document.head.appendChild(style);
  const badge=document.createElement('div');badge.className='obd-preview-badge';badge.textContent='PREVIEW';document.body.appendChild(badge);
})();
