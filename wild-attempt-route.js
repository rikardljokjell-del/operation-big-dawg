(()=>{
  if(window.__obdWildAttemptRoute)return;
  window.__obdWildAttemptRoute=true;

  const upstreamFetch=window.fetch.bind(window);
  const GYM_ENDPOINT='/functions/v1/gym-game';
  const WILD_ATTEMPT_ENDPOINT='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/wild-attempt';
  const unlocked=()=>document.body?.classList.contains('obd-starter-pokemon-unlocked');

  window.fetch=function(input,init){
    try{
      const url=typeof input==='string'?input:String(input?.url||'');
      if(url.includes(GYM_ENDPOINT)&&init?.body){
        const body=typeof init.body==='string'?JSON.parse(init.body):null;
        if(body?.action==='wild_attempt'&&unlocked()){
          return upstreamFetch(WILD_ATTEMPT_ENDPOINT,{...init,body:JSON.stringify(body)});
        }
      }
    }catch{}
    return upstreamFetch(input,init);
  };
  window.fetch.__obdWildAttemptRoute=true;

  // Preview has its own isolated battle runtime. Production loads the tested
  // battle layer here so it wraps this route and still resolves catches through
  // the dedicated wild-attempt Edge Function.
  if(!window.__OBD_PREVIEW__&&!window.__obdWildBattle&&!document.querySelector('script[data-obd-wild-battle]')){
    const s=document.createElement('script');
    s.src='wild-battle.js?v=1';
    s.async=false;
    s.dataset.obdWildBattle='1';
    document.head.appendChild(s);
  }
})();
