(()=>{
  if(window.__obdStatsLevelLock)return;
  window.__obdStatsLevelLock=true;

  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/player-stats-flex';
  const OLD_API='/functions/v1/player-stats';
  const FLEX_API='/functions/v1/player-stats-flex';
  const PIN='1337';
  const KEYS=['power','engine','discipline','grit'];
  const gates=new Map();
  const activeId=()=>window.getSelectedPlayerId?.()||'';
  const activeName=()=>window.getSelectedPlayer?.()||'';
  const sameActive=d=>d?.playerId?String(d.playerId)===String(activeId()):!d?.person||String(d.person).localeCompare(String(activeName()),'nb-NO',{sensitivity:'base'})===0;
  let scheduled=false,syncBusy=false;

  const emptyAlloc=()=>({power:0,engine:0,discipline:0,grit:0});
  function normalizeAlloc(v){const out=emptyAlloc();KEYS.forEach(k=>out[k]=Math.max(0,Math.floor(Number(v?.[k])||0)));return out}
  function fallbackLevel(){try{return Number(levelInfo(activeName()).level)||1}catch{return 1}}
  function ingest(id,data){
    if(!id||!data||typeof data!=='object')return;
    if('build_open' in data||'unspent_ap' in data||'stats_alloc' in data){
      const currentLevel=Number(data.current_level)||fallbackLevel();
      const alloc=normalizeAlloc(data.stats_alloc);
      const totalAp=Number(data.total_ap)||0;
      const spent=Number(data.spent_ap)||KEYS.reduce((s,k)=>s+alloc[k],0);
      gates.set(String(id),{
        buildOpen:!!(data.respec_open??data.build_open),
        currentLevel,
        openLevel:Number(data.build_open_level)||null,
        savedLevel:Number(data.build_saved_level)||null,
        nextBuildLevel:Number(data.next_build_level)||(currentLevel+1),
        totalAp,
        spentAp:spent,
        unspentAp:Number.isFinite(Number(data.unspent_ap))?Math.max(0,Number(data.unspent_ap)):Math.max(0,totalAp-spent),
        respecLimit:Number(data.respec_limit)||10,
        statsAlloc:alloc
      });
      schedule();
    }
  }
  function gate(){
    const level=fallbackLevel();
    return gates.get(String(activeId()))||{buildOpen:false,currentLevel:level,nextBuildLevel:level+1,totalAp:0,spentAp:0,unspentAp:0,respecLimit:10,statsAlloc:emptyAlloc()};
  }

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
      if(data?.build_open){window.toast?.(`Level ${after}: du kan flytte opptil 10 AP i builden`);setTimeout(schedule,120)}
    }catch(e){console.warn('Could not open stat respec window',e)}
  }

  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
  function draftState(g){
    const values={...g.statsAlloc};
    document.querySelectorAll('#statsAllocator .stats-alloc-row').forEach(row=>{
      const key=row.querySelector('[data-stat]')?.dataset?.stat;
      const value=Number(row.querySelector('.stats-stepper strong')?.textContent);
      if(KEYS.includes(key)&&Number.isFinite(value))values[key]=value;
    });
    const released=KEYS.reduce((sum,k)=>sum+Math.max(0,(g.statsAlloc[k]||0)-(values[k]||0)),0);
    return{values,released};
  }

  function renderAllocatorRules(g){
    const allocator=document.getElementById('statsAllocator');
    if(!allocator||allocator.hidden)return;
    const {values,released}=draftState(g),limit=g.respecLimit||10;
    allocator.querySelectorAll('.stats-alloc-row').forEach(row=>{
      const minus=row.querySelector('[data-stat-adjust="-1"]');
      const key=minus?.dataset?.stat;
      if(!minus||!KEYS.includes(key))return;
      const current=Number(values[key])||0,baseline=Number(g.statsAlloc[key])||0;
      const undoingTentative=current>baseline;
      const canReleaseExisting=g.buildOpen&&current>0&&released<limit;
      const canMinus=undoingTentative||canReleaseExisting;
      minus.disabled=!canMinus;
      minus.title=canMinus?(undoingTentative?'Fjern AP du ikke har lagret ennå':`Frigjør AP · ${released}/${limit} brukt denne levelen`):(g.buildOpen?`Maks ${limit} AP kan frigjøres per level up`:'Tildelte AP er låst til neste level up');
      row.classList.toggle('obd-stat-row-locked',!g.buildOpen&&current<=baseline);
    });

    const counter=document.querySelector('#statsAllocator .stats-ap-counter');
    if(counter){
      let note=document.getElementById('statsAllocationMode');
      if(!note){note=document.createElement('div');note.id='statsAllocationMode';note.className='stats-allocation-mode';counter.insertAdjacentElement('afterend',note)}
      const currentUnspent=Math.max(0,(g.totalAp||0)-KEYS.reduce((s,k)=>s+(values[k]||0),0));
      const html=g.buildOpen
        ?`<b>LEVEL-UP RESPEC</b><span>${released}/${limit} AP frigjort · ${currentUnspent} AP fortsatt ledig</span><small>Du kan flytte maks ${limit} allerede tildelte AP denne levelen. Nye/utildelte AP kan brukes samtidig.</small>`
        :`<b>BANKED AP</b><span>${currentUnspent} AP tilgjengelig</span><small>Utildelte AP kan brukes når som helst. Allerede tildelte AP er låst til neste level up.</small>`;
      if(note.innerHTML!==html)note.innerHTML=html;
    }
    const save=document.getElementById('statsSaveBuild');
    if(save)setText(save,g.buildOpen?'LOCK IN BUILD':'ALLOCATE AP');
  }

  function render(){
    const g=gate(),canOpen=g.buildOpen||g.unspentAp>0,fullyLocked=!canOpen;
    document.documentElement.toggleAttribute('data-stat-build-locked',fullyLocked);
    document.documentElement.toggleAttribute('data-stat-build-open',g.buildOpen);
    document.documentElement.toggleAttribute('data-stat-ap-available',g.unspentAp>0);

    document.querySelectorAll('[data-open-stats]').forEach(btn=>{
      btn.classList.toggle('obd-build-locked',fullyLocked);
      btn.setAttribute('aria-disabled',fullyLocked?'true':'false');
      btn.title=g.buildOpen?`Level ${g.currentLevel}: flytt opptil ${g.respecLimit||10} tildelte AP`:g.unspentAp>0?`${g.unspentAp} utildelte AP kan fordeles nå`:`Tildelte AP er låst til Level ${g.nextBuildLevel||g.currentLevel+1}`;
      if(btn.closest('.fighter-stats-head')){
        setText(btn,g.buildOpen?`↔ RESPEC · MAX ${g.respecLimit||10} AP`:g.unspentAp>0?`⚡ ${g.unspentAp} AP AVAILABLE`:`🔒 BUILD LOCKED · L${g.nextBuildLevel||g.currentLevel+1}`);
      }else if(btn.classList.contains('stats-unspent-cta')){
        setText(btn,g.buildOpen?`↔ LEVEL-UP RESPEC · MAX ${g.respecLimit||10} AP`:g.unspentAp>0?`⚡ ${g.unspentAp} ATTRIBUTE POINT${g.unspentAp===1?'':'S'} AVAILABLE`:`🔒 NEXT RESPEC: LEVEL ${g.nextBuildLevel||g.currentLevel+1}`);
      }
    });
    const intro=document.querySelector('[data-stats-build]');
    if(intro){
      intro.classList.toggle('obd-build-locked',fullyLocked);
      intro.setAttribute('aria-disabled',fullyLocked?'true':'false');
      setText(intro,g.buildOpen?'ADJUST BUILD':g.unspentAp>0?'ALLOCATE AP':`BUILD LOCKED · LEVEL ${g.nextBuildLevel||g.currentLevel+1}`);
    }
    renderAllocatorRules(g);
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render()})}

  const nativeFetch=window.fetch.bind(window);
  if(!window.fetch.__obdStatsLevelLock){
    const wrapped=async function(input,init){
      let routed=input;
      try{
        const url=typeof input==='string'?input:String(input?.url||'');
        if(url.includes(OLD_API)&&!url.includes(FLEX_API)&&typeof input==='string')routed=url.replace(OLD_API,FLEX_API);
      }catch{}
      const response=await nativeFetch(routed,init);
      try{
        const url=typeof routed==='string'?routed:String(routed?.url||'');
        if(url.includes(FLEX_API)&&init?.body){
          const body=typeof init.body==='string'?JSON.parse(init.body):null;
          if(body?.player_id&&['get','set','unlock'].includes(body?.action)){
            response.clone().json().then(data=>{
              ingest(String(body.player_id),data);
              if(body.action==='set'&&response.ok)window.dispatchEvent(new CustomEvent('obd-stats-build-saved',{detail:{playerId:String(body.player_id),respecConsumed:!!data.respec_consumed,unspentAp:Number(data.unspent_ap)||0}}));
            }).catch(()=>{});
          }
        }
      }catch{}
      return response;
    };
    wrapped.__obdStatsLevelLock=true;window.fetch=wrapped;
  }

  document.addEventListener('click',e=>{
    const minus=e.target.closest?.('[data-stat-adjust="-1"]');
    if(minus?.disabled){e.preventDefault();e.stopImmediatePropagation();return}
    const trigger=e.target.closest?.('[data-open-stats],[data-stats-build]');
    if(!trigger)return;
    const g=gate();
    if(g.buildOpen||g.unspentAp>0)return;
    e.preventDefault();e.stopImmediatePropagation();
    window.toast?.(`Ingen ledige AP · build kan justeres igjen på Level ${g.nextBuildLevel||g.currentLevel+1}`);
    schedule();
  },true);

  function ensureStyle(){
    if(document.getElementById('statsLevelLockStyle'))return;
    const s=document.createElement('style');s.id='statsLevelLockStyle';s.textContent=`
      .obd-build-locked{opacity:.58!important;filter:saturate(.45);cursor:not-allowed!important}
      html[data-stat-build-open] .fighter-stats-head [data-open-stats]{box-shadow:0 0 18px rgba(255,201,76,.18)}
      .stats-allocation-mode{margin:8px 0 10px;padding:9px 10px;border:1px solid #213746;border-radius:10px;background:#07131c;display:grid;gap:3px}
      .stats-allocation-mode b{font-size:8px;letter-spacing:.12em;color:#f5c85b}.stats-allocation-mode span{font-size:9px;font-weight:900;color:#fff}.stats-allocation-mode small{font-size:7px;line-height:1.35;color:#8da8ba}
      .obd-stat-row-locked [data-stat-adjust="-1"]{opacity:.32}
    `;document.head.appendChild(s);
  }

  ensureStyle();
  const root=document.getElementById('fighters')||document.body;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  const observeOverlay=()=>{const el=document.getElementById('statsUnlockOverlay');if(!el||el.dataset.obdLevelLockObserved)return;el.dataset.obdLevelLockObserved='1';new MutationObserver(schedule).observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']})};
  window.addEventListener('obd-workout-added',e=>unlockForLevelUp(e.detail||{}));
  window.addEventListener('obd-auth-ready',()=>setTimeout(sync,100));
  window.addEventListener('obd-player-changed',()=>{setTimeout(sync,80);schedule()});
  window.addEventListener('obd-stats-build-saved',()=>setTimeout(sync,80));
  window.addEventListener('pageshow',()=>setTimeout(sync,120));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(sync,100)});
  [0,150,500,1100].forEach(ms=>setTimeout(()=>{observeOverlay();schedule();if(ms===150||ms===1100)sync()},ms));
})();
