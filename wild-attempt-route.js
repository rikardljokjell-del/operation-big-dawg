(()=>{
  if(window.__obdWildAttemptRoute)return;
  window.__obdWildAttemptRoute=true;

  const upstreamFetch=window.fetch.bind(window);
  const GYM_ENDPOINT='/functions/v1/gym-game';
  const WILD_ATTEMPT_ENDPOINT='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/wild-attempt';
  const WILD_ACTIONS=new Set(['wild_attempt','wild_status','wild_validate']);
  const unlocked=()=>document.body?.classList.contains('obd-starter-pokemon-unlocked');

  window.fetch=function(input,init){
    try{
      const url=typeof input==='string'?input:String(input?.url||'');
      if(url.includes(GYM_ENDPOINT)&&init?.body){
        const body=typeof init.body==='string'?JSON.parse(init.body):null;
        if(WILD_ACTIONS.has(body?.action)&&unlocked()){
          return upstreamFetch(WILD_ATTEMPT_ENDPOINT,{...init,body:JSON.stringify(body)});
        }
      }
    }catch{}
    return upstreamFetch(input,init);
  };
  window.fetch.__obdWildAttemptRoute=true;

  function loadManualCatch(){
    if(window.__OBD_PREVIEW__||window.__obdWildManualCatchProduction||document.querySelector('script[data-obd-wild-manual-catch]'))return;
    const m=document.createElement('script');
    m.src='wild-manual-catch.js?v=1';
    m.async=false;
    m.dataset.obdWildManualCatch='1';
    document.head.appendChild(m);
  }

  function loadCooldownGuard(){
    if(window.__OBD_PREVIEW__)return;
    if(window.__obdWildCooldownProductionV2){loadManualCatch();return}
    const existing=document.querySelector('script[data-obd-wild-cooldown]');
    if(existing){existing.addEventListener('load',loadManualCatch,{once:true});return}
    const g=document.createElement('script');
    g.src='wild-cooldown.js?v=2';
    g.async=false;
    g.dataset.obdWildCooldown='1';
    g.addEventListener('load',loadManualCatch,{once:true});
    document.head.appendChild(g);
  }

  // Production loads battle -> validation/cooldown guard -> manual catch UI.
  // This preserves the tested battle engine while changing only its entry point.
  if(!window.__OBD_PREVIEW__){
    if(window.__obdWildBattle){
      loadCooldownGuard();
    }else{
      const existing=document.querySelector('script[data-obd-wild-battle]');
      if(existing){
        existing.addEventListener('load',loadCooldownGuard,{once:true});
      }else{
        const s=document.createElement('script');
        s.src='wild-battle.js?v=2';
        s.async=false;
        s.dataset.obdWildBattle='1';
        s.addEventListener('load',loadCooldownGuard,{once:true});
        document.head.appendChild(s);
      }
    }
  }
})();