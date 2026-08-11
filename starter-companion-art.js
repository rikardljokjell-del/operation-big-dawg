(()=>{
  if(window.__obdStarterCompanionArt)return;
  window.__obdStarterCompanionArt=true;

  const ASSETS={
    1:'starter-companions/bulbasaur.svg',
    4:'starter-companions/charmander.svg',
    7:'starter-companions/squirtle.svg'
  };

  function ensureStyle(){
    if(document.getElementById('starterCompanionVectorStyle'))return;
    const style=document.createElement('style');
    style.id='starterCompanionVectorStyle';
    style.textContent=`
      .starter-companion{overflow:visible!important;background:none!important;border:0!important;box-shadow:none!important}
      .starter-companion::before{inset:15%!important;background:radial-gradient(circle,rgba(255,255,255,.20),rgba(80,155,220,.09) 48%,transparent 73%)!important;filter:blur(7px)!important}
      .starter-companion img.starter-companion-vector{width:112%!important;height:112%!important;object-fit:contain!important;transform:none!important;-webkit-mask-image:none!important;mask-image:none!important;filter:drop-shadow(0 5px 3px rgba(0,0,0,.22))!important}
      .battle-fighter-art .starter-companion img.starter-companion-vector{width:116%!important;height:116%!important}
    `;
    document.head.appendChild(style);
  }

  function replaceOne(badge){
    const id=Number(badge?.dataset?.starterId||0),asset=ASSETS[id];
    if(!asset)return;
    const img=badge.querySelector('img');
    if(!img)return;
    const current=img.getAttribute('src')||'';
    if(current!==asset)img.setAttribute('src',asset);
    img.classList.add('starter-companion-vector');
    img.dataset.vectorStarter=String(id);
  }

  function apply(){
    ensureStyle();
    document.querySelectorAll('.starter-companion[data-starter-id]').forEach(replaceOne);
  }

  let scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;apply()});
  }

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-starter-id']});
  ['obd-auth-ready','obd-player-changed','obd-battle-changed','obd-starter-pokemon-chosen','pageshow'].forEach(name=>window.addEventListener(name,schedule));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  [0,120,450,1200].forEach(ms=>setTimeout(apply,ms));
})();
