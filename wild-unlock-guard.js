(()=>{
  if(window.__obdWildUnlockGuard)return;
  window.__obdWildUnlockGuard=true;

  const nativeFetch=window.fetch.bind(window);
  const GYM_ENDPOINT='/functions/v1/gym-game';
  const unlocked=()=>document.body?.classList.contains('obd-starter-pokemon-unlocked');

  function lockedResponse(){
    return new Response(JSON.stringify({
      locked:true,
      wild:{status:'locked',pokemon_id:null,appeared_at:null,expires_at:null,next_spawn_at:null,last_outcome:null},
      benefits:null,
      attempted:false
    }),{status:200,headers:{'Content-Type':'application/json'}});
  }

  window.fetch=function(input,init){
    try{
      const url=typeof input==='string'?input:String(input?.url||'');
      if(url.includes(GYM_ENDPOINT)&&init?.body&&!unlocked()){
        const body=typeof init.body==='string'?JSON.parse(init.body):null;
        if(body?.action==='wild_status'||body?.action==='wild_attempt'){
          return Promise.resolve(lockedResponse());
        }
      }
    }catch{}
    return nativeFetch(input,init);
  };

  window.fetch.__obdWildUnlockGuard=true;
})();
