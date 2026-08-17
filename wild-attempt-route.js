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

  function loadCooldownGuard(){
    if(window.__OBD_PREVIEW__||window.__obdWildCooldownProductionV1||document.querySelector('script[data-obd-wild-cooldown]'))return;
    const g=document.createElement('script');
    g.src='wild-cooldown.js?v=1';
    g.async=false;
    g.dataset.obdWildCooldown='1';
    document.head.appendChild(g);
  }

  // Production loads the battle layer first, then the validation/cooldown guard
  // as the outermost fetch wrapper. Preview remains fully isolated.
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
