(()=>{
  if(!window.__OBD_PREVIEW__||window.__obdWildCooldownPreview)return;
  window.__obdWildCooldownPreview=true;

  const upstreamFetch=window.fetch.bind(window);
  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const PIN='1337';

  async function freshWild(body){
    const r=await upstreamFetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'wild_status',player_id:body.player_id,level:body.level,pin:PIN})});
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{}
    if(!r.ok)throw new Error(data.error||text||'Wild status refresh failed');
    return data;
  }

  window.fetch=async function(input,init){
    let body=null,url='';
    try{
      url=typeof input==='string'?input:String(input?.url||'');
      body=typeof init?.body==='string'?JSON.parse(init.body):null;
    }catch{}
    const isWildAttempt=body?.action==='wild_attempt'&&(url.includes('/functions/v1/wild-attempt')||url.includes('/functions/v1/gym-game'));
    const response=await upstreamFetch(input,init);
    if(!isWildAttempt||!body?.workout_id)return response;
    try{
      const data=await response.clone().json();
      if(!data?.battle_resolved)return response;
      const fresh=await freshWild(body);
      const merged={...data,wild:fresh?.wild||data.wild,benefits:fresh?.benefits||data.benefits,wild_status_refreshed:true};
      setTimeout(()=>window.dispatchEvent(new Event('pageshow')),120);
      return new Response(JSON.stringify(merged),{status:response.status,headers:{'Content-Type':'application/json'}});
    }catch(error){
      console.warn('Wild cooldown refresh failed',error);
      setTimeout(()=>window.dispatchEvent(new Event('pageshow')),180);
      return response;
    }
  };
  window.fetch.__obdWildCooldownPreview=true;
})();
