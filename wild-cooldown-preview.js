(()=>{
  if(!window.__OBD_PREVIEW__)return;
  if(window.__obdWildCooldownPreviewV3)return;
  window.__obdWildCooldownPreviewV3=true;

  const PREVIEW_WILD='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/wild-attempt-preview';
  const PIN='1337';
  let renderTimer=null;

  const parseBody=init=>{try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}};
  const isWildUrl=url=>url.includes('/functions/v1/gym-game')||url.includes('/functions/v1/gym-game-preview')||url.includes('/functions/v1/wild-attempt')||url.includes('/functions/v1/wild-attempt-preview');
  const countdown=iso=>{const ms=Math.max(0,new Date(iso).getTime()-Date.now()),sec=Math.floor(ms/1000),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`};

  function renderCooldown(wild){
    if(!wild||wild.status!=='cooldown')return;
    const el=document.getElementById('wildPokemonBlock');
    if(!el)return;
    const when=wild.next_spawn_at||null;
    el.innerHTML=`<div class="wild-head"><span class="wild-kicker">WILD POKÉMON</span><span class="wild-status">${String(wild.last_outcome||'COOLDOWN').toUpperCase()}</span></div><div class="wild-cooldown"><strong>NEXT WILD POKÉMON IN</strong><div class="wild-countdown" data-wild-cooldown-preview>${when?countdown(when):'--:--:--'}</div></div>`;
    clearInterval(renderTimer);
    if(when)renderTimer=setInterval(()=>{const node=document.querySelector('[data-wild-cooldown-preview]');if(!node){clearInterval(renderTimer);return}node.textContent=countdown(when)},1000);
  }

  function makeStatusInit(init,body){
    const headers=new Headers(init?.headers||{});
    if(!headers.has('Content-Type'))headers.set('Content-Type','application/json');
    return {...(init||{}),method:'POST',headers,body:JSON.stringify({...body,action:'wild_status',pin:body?.pin||PIN})};
  }

  async function freshStatus(upstream,body){
    const r=await upstream(PREVIEW_WILD,makeStatusInit(null,{player_id:body?.player_id,level:body?.level,pin:body?.pin||PIN}));
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!r.ok)throw new Error(data.error||text||'Wild status refresh failed');
    return data;
  }

  function applyFresh(fresh){
    window.__obdWildCooldownLastState=fresh;
    renderCooldown(fresh?.wild);
    window.dispatchEvent(new CustomEvent('obd-wild-status-refreshed',{detail:fresh}));
    // pokemon-gameplay-v2 owns its cache. pageshow makes it run syncAll(), and
    // the final fetch guard below guarantees that syncWild() reads preview state.
    queueMicrotask(()=>window.dispatchEvent(new Event('pageshow')));
  }

  function install(){
    const current=window.fetch;
    if(current?.__obdWildCooldownPreviewFinal)return;
    const upstream=current.bind(window);

    const wrapped=async function(input,init){
      let body=null,url='';
      try{url=typeof input==='string'?input:String(input?.url||'');body=parseBody(init)}catch{}

      // Make preview Wild status authoritative regardless of other fetch wrappers.
      if(body?.action==='wild_status'&&isWildUrl(url)){
        return upstream(PREVIEW_WILD,makeStatusInit(init,body));
      }

      const response=await upstream(input,init);
      const isAttempt=body?.action==='wild_attempt'&&isWildUrl(url)&&!!body?.workout_id;
      if(!isAttempt)return response;

      try{
        const data=await response.clone().json();
        const terminal=!!data?.battle_resolved||!!data?.cooldown_started||data?.wild?.status==='cooldown';
        if(!terminal)return response;

        // Use the battle response immediately: the menu can switch to cooldown
        // as soon as OK closes. Then verify once against preview backend without
        // blocking the result dialog or normal page.
        renderCooldown(data?.wild);
        Promise.resolve()
          .then(()=>freshStatus(upstream,body))
          .then(applyFresh)
          .catch(error=>{console.warn('Wild cooldown authoritative refresh failed',error);window.dispatchEvent(new Event('pageshow'))});
      }catch(error){
        console.warn('Wild cooldown response parse failed',error);
        window.dispatchEvent(new Event('pageshow'));
      }
      return response;
    };

    wrapped.__obdWildCooldownPreviewFinal=true;
    wrapped.__obdWildCooldownUpstream=current;
    window.fetch=wrapped;
  }

  window.__obdWildCooldownInstall=install;
  install();
  [0,50,250,750,1500,3000].forEach(ms=>setTimeout(install,ms));
  window.addEventListener('pageshow',install,true);
  window.addEventListener('obd-auth-ready',()=>setTimeout(install,0));
  // If a late-loaded production helper wraps/replaces fetch, reclaim the outer
  // position so preview status can never fall through to production gym-game.
  setInterval(install,2000);
})();
