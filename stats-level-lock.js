(()=>{
  if(window.__obdStatsLevelLock)return;
  window.__obdStatsLevelLock=true;

  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/player-stats';
  const PIN='1337';
  const gates=new Map();
  const activeId=()=>window.getSelectedPlayerId?.()||'';
  const activeName=()=>window.getSelectedPlayer?.()||'';
  const sameActive=d=>d?.playerId?String(d.playerId)===String(activeId()):!d?.person||String(d.person).localeCompare(String(activeName()),'nb-NO',{sensitivity:'base'})===0;
  let scheduled=false,syncBusy=false;

  function ingest(id,data){
    if(!id||!data||typeof data!=='object')return;
    if('build_open' in data||'build_open_level' in data||'build_saved_level' in data){
      gates.set(String(id),{
        buildOpen:!!data.build_open,
        currentLevel:Number(data.current_level)||1,
        openLevel:Number(data.build_open_level)||null,
        savedLevel:Number(data.build_saved_level)||null,
        nextBuildLevel:Number(data.next_build_level)||((Number(data.current_level)||1)+1),
        totalAp:Number(data.total_ap)||0
      });
      schedule();
    }
  }
  function gate(){return gates.get(String(activeId()))||{buildOpen:false,currentLevel:(()=>{try{return Number(levelInfo(activeName()).level)||1}catch{return 1}})(),nextBuildLevel:(()=>{try{return (Number(levelInfo(activeName()).level)||1)+1}catch{return 2}})()}}

  async function request(action,id=activeId()){
    if(!id)return null;
    const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,player_id:id,pin:PIN})});
    let data={};try{data=await r.json()}catch{}
    ingest(id,data);
    if(!r.ok&&action!=='get')throw new Error(data.error||'Stats sync failed');
    return data;
  }

  async function sync(){
    const id=activeId();if(!id||syncBusy)return;
    syncBusy=true;try{await request('get',id)}catch(e){console.warn('Stats build gate sync failed',e)}finally{syncBusy=false}
  }

  async function unlockForLevelUp(detail){
    if(!sameActive(detail))return;
    const before=Number(detail?.levelBefore)||1,after=Number(detail?.levelAfter)||1;
    if(after<=before||after<2)return;
    try{
      const data=await request('unlock',detail.playerId||activeId());
      if(data?.build_open){
        window.toast?.(`Level ${after}: BUILD YOUR FIGHTER er klar`);
        setTimeout(schedule,120);
      }
    }catch(e){console.warn('Could not open stat build window',e)}
  }

  function render(){
    const g=gate(),locked=!g.buildOpen;
    document.documentElement.toggleAttribute('data-stat-build-locked',locked);
    document.documentElement.toggleAttribute('data-stat-build-open',!locked);

    document.querySelectorAll('[data-open-stats]').forEach(btn=>{
      btn.classList.toggle('obd-build-locked',locked);
      btn.setAttribute('aria-disabled',locked?'true':'false');
      btn.title=locked?`AP-build åpnes igjen ved neste level up (Level ${g.nextBuildLevel||g.currentLevel+1})`:`Build tilgjengelig på Level ${g.currentLevel}`;
      if(btn.closest('.fighter-stats-head')){
        btn.textContent=locked?`🔒 BUILD LOCKED · L${g.nextBuildLevel||g.currentLevel+1}`:`⚡ BUILD AVAILABLE · L${g.currentLevel}`;
      }else if(btn.classList.contains('stats-unspent-cta')){
        const current=String(btn.textContent||''),m=current.match(/(\d+)\s+ATTRIBUTE/i),points=m?Number(m[1]):0;
        btn.textContent=locked?`🔒 ${points||''}${points?' AP BANKED · ':''}NEXT BUILD: LEVEL ${g.nextBuildLevel||g.currentLevel+1}`:`⚡ ${points||''}${points?' AP · ':''}BUILD AVAILABLE NOW`;
      }
    });
    const intro=document.querySelector('[data-stats-build]');
    if(intro){intro.classList.toggle('obd-build-locked',locked);intro.setAttribute('aria-disabled',locked?'true':'false');intro.textContent=locked?`BUILD LOCKED · LEVEL ${g.nextBuildLevel||g.currentLevel+1}`:'BUILD YOUR FIGHTER'}
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render()})}

  const nativeFetch=window.fetch.bind(window);
  if(!window.fetch.__obdStatsLevelLock){
    const wrapped=async function(input,init){
      const response=await nativeFetch(input,init);
      try{
        const url=typeof input==='string'?input:String(input?.url||'');
        if(url.includes('/functions/v1/player-stats')&&init?.body){
          const body=typeof init.body==='string'?JSON.parse(init.body):null;
          if(body?.player_id&&['get','set','unlock'].includes(body?.action)){
            response.clone().json().then(data=>ingest(String(body.player_id),data)).catch(()=>{});
          }
        }
      }catch{}
      return response;
    };
    wrapped.__obdStatsLevelLock=true;window.fetch=wrapped;
  }

  document.addEventListener('click',e=>{
    const trigger=e.target.closest?.('[data-open-stats],[data-stats-build]');
    if(!trigger)return;
    const g=gate();
    if(g.buildOpen)return;
    e.preventDefault();e.stopImmediatePropagation();
    window.toast?.(`Build låst · neste justering på Level ${g.nextBuildLevel||g.currentLevel+1}`);
    schedule();
  },true);

  function ensureStyle(){
    if(document.getElementById('statsLevelLockStyle'))return;
    const s=document.createElement('style');s.id='statsLevelLockStyle';s.textContent=`
      .obd-build-locked{opacity:.58!important;filter:saturate(.45);cursor:not-allowed!important}
      html[data-stat-build-open] .fighter-stats-head [data-open-stats]{box-shadow:0 0 18px rgba(255,201,76,.18)}
    `;document.head.appendChild(s);
  }

  ensureStyle();
  const root=document.getElementById('fighters')||document.body;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  window.addEventListener('obd-workout-added',e=>unlockForLevelUp(e.detail||{}));
  window.addEventListener('obd-auth-ready',()=>setTimeout(sync,100));
  window.addEventListener('obd-player-changed',()=>{setTimeout(sync,80);schedule()});
  window.addEventListener('pageshow',()=>setTimeout(sync,120));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(sync,100)});
  [0,150,500,1100].forEach(ms=>setTimeout(()=>{schedule();if(ms===150||ms===1100)sync()},ms));
})();
