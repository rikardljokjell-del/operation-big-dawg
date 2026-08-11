(()=>{
  if(window.__obdStarterCompanionArt)return;
  window.__obdStarterCompanionArt=true;

  const ASSETS={
    1:'starter-companions/bulbasaur.png',
    4:'starter-companions/charmander.png',
    7:'starter-companions/squirtle.png'
  };

  function ensureStyle(){
    if(document.getElementById('starterCompanionPngStyle'))return;
    const old=document.getElementById('starterCompanionVectorStyle');
    old?.remove();
    const style=document.createElement('style');
    style.id='starterCompanionPngStyle';
    style.textContent=`
      .starter-companion-host{position:relative!important}
      .starter-companion{
        position:absolute!important;
        z-index:12!important;
        width:42px!important;
        height:42px!important;
        right:4px!important;
        bottom:5px!important;
        display:grid!important;
        place-items:center!important;
        overflow:visible!important;
        background:none!important;
        border:0!important;
        box-shadow:none!important;
        pointer-events:none!important;
        opacity:1!important;
        filter:none!important;
      }
      .starter-companion::before{display:none!important}
      .starter-companion img.starter-companion-png{
        display:block!important;
        width:100%!important;
        height:100%!important;
        max-width:100%!important;
        max-height:100%!important;
        object-fit:contain!important;
        object-position:center!important;
        transform:none!important;
        -webkit-mask-image:none!important;
        mask-image:none!important;
        filter:drop-shadow(0 2px 2px rgba(0,0,0,.34))!important;
      }
      .battle-fighter-art .starter-companion{
        width:34px!important;
        height:34px!important;
        right:3px!important;
        bottom:3px!important;
      }
      @media(max-width:390px){
        .starter-companion{width:38px!important;height:38px!important;right:3px!important;bottom:4px!important}
        .battle-fighter-art .starter-companion{width:32px!important;height:32px!important;right:2px!important;bottom:2px!important}
      }
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
    img.classList.remove('starter-companion-vector');
    img.classList.add('starter-companion-png');
    delete img.dataset.vectorStarter;
    img.dataset.pngStarter=String(id);
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
