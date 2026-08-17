(()=>{
  if(window.__OBD_PREVIEW__||window.__obdWildCooldownProductionV2)return;
  window.__obdWildCooldownProductionV2=true;

  const WILD_API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/wild-attempt';
  const PIN='1337';
  let renderTimer=null;

  const parseBody=init=>{try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}};
  const isWildUrl=url=>url.includes('/functions/v1/gym-game')||url.includes('/functions/v1/wild-attempt');
  const countdown=iso=>{const ms=Math.max(0,new Date(iso).getTime()-Date.now()),sec=Math.floor(ms/1000),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`};

  function renderCooldown(wild){
    if(!wild||wild.status!=='cooldown')return;
    const el=document.getElementById('wildPokemonBlock');
    if(!el)return;
    const when=wild.next_spawn_at||null;
    el.innerHTML=`<div class="wild-head"><span class="wild-kicker">WILD POKÉMON</span><span class="wild-status">${String(wild.last_outcome||'COOLDOWN').toUpperCase()}</span></div><div class="wild-cooldown"><strong>NEXT WILD POKÉMON IN</strong><div class="wild-countdown" data-wild-cooldown-production>${when?countdown(when):'--:--:--'}</div></div>`;
    clearInterval(renderTimer);
    if(when)renderTimer=setInterval(()=>{const node=document.querySelector('[data-wild-cooldown-production]');if(!node){clearInterval(renderTimer);return}node.textContent=countdown(when)},1000);
  }

  function makeInit(init,body){
    const headers=new Headers(init?.headers||{});
    if(!headers.has('Content-Type'))headers.set('Content-Type','application/json');
    return {...(init||{}),method:'POST',headers,body:JSON.stringify({...body,pin:body?.pin||PIN})};
  }
  const jsonResponse=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

  async function callWild(upstream,body,init=null){
    const r=await upstream(WILD_API,makeInit(init,body));
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!r.ok)throw new Error(data.error||text||'Wild request failed');
    return data;
  }
  async function freshStatus(upstream,body){return await callWild(upstream,{action:'wild_status',player_id:body?.player_id,level:body?.level,pin:body?.pin||PIN})}

  function applyFresh(fresh){
    window.__obdWildCooldownLastState=fresh;
    renderCooldown(fresh?.wild);
    window.dispatchEvent(new CustomEvent('obd-wild-status-refreshed',{detail:fresh}));
    queueMicrotask(()=>window.dispatchEvent(new Event('pageshow')));
  }

  function install(){
    const current=window.fetch;
    if(current?.__obdWildCooldownProductionFinalV2)return;
    const upstream=current.bind(window);

    const wrapped=async function(input,init){
      let body=null,url='';
      try{url=typeof input==='string'?input:String(input?.url||'');body=parseBody(init)}catch{}

      if(body?.action==='wild_status'&&isWildUrl(url)){
        return upstream(WILD_API,makeInit(init,{...body,action:'wild_status'}));
      }

      const isAttempt=body?.action==='wild_attempt'&&isWildUrl(url)&&!!body?.workout_id;
      if(!isAttempt)return upstream(input,init);

      let validation;
      try{
        validation=await callWild(upstream,{...body,action:'wild_validate'});
      }catch(error){
        console.warn('Wild validation failed',error);
        return jsonResponse({attempted:false,error:String(error?.message||'Wild validation failed')},500);
      }
      if(!validation?.eligible){
        if(validation?.wild?.status==='cooldown')renderCooldown(validation.wild);
        return jsonResponse({...validation,attempted:false,battle_resolved:false});
      }

      // A qualifying workout only unlocks the catch action. The battle begins
      // when the player explicitly taps the Poké Ball in the Wild block.
      if(!body.manual_catch){
        window.dispatchEvent(new CustomEvent('obd-wild-catch-ready',{detail:{body:{...body},validation}}));
        return jsonResponse({...validation,attempted:false,battle_resolved:false,catch_ready:true});
      }

      const response=await upstream(WILD_API,init);
      try{
        const data=await response.clone().json();
        const terminal=!!data?.battle_resolved||!!data?.cooldown_started||data?.wild?.status==='cooldown';
        if(terminal){
          renderCooldown(data?.wild);
          Promise.resolve().then(()=>freshStatus(upstream,body)).then(applyFresh).catch(error=>{console.warn('Wild cooldown refresh failed',error);window.dispatchEvent(new Event('pageshow'))});
        }
      }catch(error){console.warn('Wild cooldown response parse failed',error)}
      return response;
    };

    wrapped.__obdWildCooldownProductionFinalV2=true;
    wrapped.__obdWildCooldownUpstream=current;
    window.fetch=wrapped;
  }

  window.__obdWildCooldownInstall=install;
  install();
  [0,50,250,750,1500,3000].forEach(ms=>setTimeout(install,ms));
  window.addEventListener('pageshow',install,true);
  window.addEventListener('obd-auth-ready',()=>setTimeout(install,0));
  setInterval(install,2000);
})();