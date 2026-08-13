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
})();
