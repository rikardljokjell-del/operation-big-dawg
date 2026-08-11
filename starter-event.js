(()=>{
  if(window.__obdStarterPokemonEvent)return;
  window.__obdStarterPokemonEvent=true;

  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/starter-pokemon';
  const APP_PIN='1337';
  const STARTERS={4:{name:'Charmander',button:'red'},1:{name:'Bulbasaur',button:'green'},7:{name:'Squirtle',button:'blue'}};
  const starterMap=new Map();
  let refreshBusy=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const activeId=()=>window.getSelectedPlayerId?.()||'';
  const activeName=()=>window.getSelectedPlayer?.()||'';
  const poke=id=>window.getPokemon?.(id)||{id:Number(id),name:STARTERS[id]?.name||`#${id}`,image:`dex-png/${id}.png`};
  const setPriority=value=>{window.__obdStarterStoryPriority=!!value};

  function installPriorityHooks(){
    if(window.__obdStarterPriorityHooks)return;
    window.__obdStarterPriorityHooks=true;
    const evolution=window.showEvolution;
    if(typeof evolution==='function')window.showEvolution=(...args)=>{
      if(window.__obdStarterStoryPriority){window.__obdStarterDeferredEvolution=args;return}
      return evolution(...args);
    };
    const achievement=window.showAchievement;
    if(typeof achievement==='function')window.showAchievement=(...args)=>{
      if(window.__obdStarterStoryPriority){window.__obdStarterDeferredAchievement=args;return}
      return achievement(...args);
    };
  }

  function releasePriority(){
    const payoff=window.__obdStarterDeferredPayoff||null;
    const evolution=window.__obdStarterDeferredEvolution||null;
    const achievement=window.__obdStarterDeferredAchievement||null;
    window.__obdStarterDeferredPayoff=null;
    window.__obdStarterDeferredEvolution=null;
    window.__obdStarterDeferredAchievement=null;
    setPriority(false);
    if(payoff)window.dispatchEvent(new CustomEvent('obd-starter-story-complete',{detail:payoff}));
    if(evolution)setTimeout(()=>window.showEvolution?.(...evolution),payoff?1550:120);
    if(achievement)setTimeout(()=>window.showAchievement?.(...achievement),evolution?7600:(payoff?1750:180));
  }

  async function api(payload){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,pin:APP_PIN})});
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!r.ok)throw new Error(data.error||text||'Starter sync failed');
    return data;
  }

  function ensureUi(){
    if(!document.getElementById('starterEventStyle')){
      const style=document.createElement('style');style.id='starterEventStyle';style.textContent=`
        .starter-event-overlay{position:fixed;inset:0;z-index:320;display:grid;place-items:center;padding:16px;background:rgba(2,6,10,.92);backdrop-filter:blur(9px);opacity:0;pointer-events:none;transition:.18s ease}.starter-event-overlay.show{opacity:1;pointer-events:auto}.starter-event-card{width:min(100%,430px);max-height:90vh;overflow:auto;padding:20px;border-radius:24px;border:1px solid rgba(255,72,72,.28);background:radial-gradient(circle at 50% 0,rgba(255,40,40,.11),transparent 34%),linear-gradient(155deg,#101b27,#060b10 72%);box-shadow:0 30px 90px rgba(0,0,0,.72);color:#fff;text-align:center}.starter-event-kicker{display:block;margin-bottom:8px;color:#ff5757;font-size:9px;font-weight:1000;letter-spacing:.18em;text-transform:uppercase}.starter-event-card h2{margin:3px 0 10px;font-size:27px;line-height:1.08}.starter-event-card p{margin:0;color:#b4c0ca;font-size:13px;line-height:1.55}.starter-event-card .starter-crazy{color:#fff;font-weight:950;font-size:15px}.starter-event-primary{width:100%;min-height:48px;margin-top:17px;border:0;border-radius:13px;background:linear-gradient(135deg,#ff344a,#ff8545);color:#fff;font-weight:1000;letter-spacing:.04em;cursor:pointer}.starter-choices{display:grid;grid-template-columns:1fr;gap:9px;margin-top:16px}.starter-choice{min-height:50px;border:0;border-radius:13px;color:#fff;font-weight:1000;font-size:14px;cursor:pointer}.starter-choice.red{background:linear-gradient(135deg,#a91220,#ef4050)}.starter-choice.green{background:linear-gradient(135deg,#176b3a,#34a863)}.starter-choice.blue{background:linear-gradient(135deg,#155b9b,#368fd7)}.starter-choice:disabled,.starter-event-primary:disabled{opacity:.55;cursor:wait}.starter-big-art{width:190px;height:190px;margin:8px auto 4px;display:grid;place-items:center}.starter-big-art img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 15px 24px rgba(0,0,0,.45))}.starter-achievement-icon{font-size:58px;margin:8px 0}.starter-achievement-title{font-size:27px!important;color:#ffd75b!important;font-weight:1000!important}.starter-companion-host{position:relative!important}.starter-companion{position:absolute;z-index:12;right:-7px;bottom:-5px;width:66px;height:66px;display:grid;place-items:center;pointer-events:none;filter:drop-shadow(0 8px 9px rgba(0,0,0,.48));opacity:.98}.starter-companion::before{content:'';position:absolute;inset:14%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.18),rgba(124,184,255,.08) 42%,transparent 72%);filter:blur(5px)}.starter-companion img{position:relative;width:100%;height:100%;object-fit:contain;transform:scale(1.12);-webkit-mask-image:radial-gradient(circle at 50% 50%,#000 0 48%,rgba(0,0,0,.94) 59%,rgba(0,0,0,.64) 70%,rgba(0,0,0,.20) 80%,transparent 90%);mask-image:radial-gradient(circle at 50% 50%,#000 0 48%,rgba(0,0,0,.94) 59%,rgba(0,0,0,.64) 70%,rgba(0,0,0,.20) 80%,transparent 90%)}.battle-fighter-art .starter-companion{width:52px;height:52px;right:-5px;bottom:-1px;filter:drop-shadow(0 6px 7px rgba(0,0,0,.48))}.starter-achievement-badge{border-color:rgba(255,215,91,.28)!important}.starter-event-error{min-height:16px;margin-top:9px;color:#ff8ca3;font-size:10px;font-weight:850}@media(max-width:390px){.starter-event-card{padding:17px}.starter-event-card h2{font-size:23px}.starter-big-art{width:165px;height:165px}.starter-companion{width:60px;height:60px}.battle-fighter-art .starter-companion{width:48px;height:48px}}
      `;document.head.appendChild(style);
    }
    let overlay=document.getElementById('starterEventOverlay');
    if(!overlay){overlay=document.createElement('div');overlay.id='starterEventOverlay';overlay.className='starter-event-overlay';overlay.innerHTML='<div id="starterEventCard" class="starter-event-card" role="dialog" aria-modal="true"></div>';document.body.appendChild(overlay)}
    return overlay;
  }
  function open(html){setPriority(true);const overlay=ensureUi(),card=document.getElementById('starterEventCard');card.innerHTML=html;overlay.classList.add('show');document.body.classList.add('starter-modal-open')}
  function close(){document.getElementById('starterEventOverlay')?.classList.remove('show');document.body.classList.remove('starter-modal-open')}
  const error=(msg='')=>{const el=document.getElementById('starterEventError');if(el)el.textContent=msg};

  function showIntro(){
    open(`<span class="starter-event-kicker">GYM INCIDENT</span><h2>You stole a RED gym bag from ASH at the gym.</h2><p>Something is crawling inside it....</p><div id="starterEventError" class="starter-event-error"></div><button id="starterOpenBag" class="starter-event-primary" type="button">Open bag</button>`);
    document.getElementById('starterOpenBag')?.addEventListener('click',showChoices);
  }
  function showChoices(){
    open(`<span class="starter-event-kicker">THE BAG IS MOVING</span><h2 class="starter-crazy">MOTHERFUCKER. Three Pokémon appeared inside the bag. HURRY - steal one before they all flee!!!</h2><div class="starter-choices">${[4,1,7].map(id=>`<button class="starter-choice ${STARTERS[id].button}" data-starter-choice="${id}" type="button">${STARTERS[id].name}</button>`).join('')}</div><div id="starterEventError" class="starter-event-error"></div>`);
    document.querySelectorAll('[data-starter-choice]').forEach(btn=>btn.addEventListener('click',()=>chooseStarter(Number(btn.dataset.starterChoice))));
  }
  function showSelected(state){
    const id=Number(state.starter_pokemon),p=poke(id);
    open(`<span class="starter-event-kicker">POKÉMON STOLEN</span><div class="starter-big-art"><img src="${p.image}" alt="${esc(p.name)}" draggable="false"></div><h2>${esc(p.name)}</h2><div id="starterEventError" class="starter-event-error"></div><button id="starterPutBag" class="starter-event-primary" type="button">Put inside GYM BAG</button>`);
    document.getElementById('starterPutBag')?.addEventListener('click',completeStarter);
  }
  function showAchievement(){
    open(`<span class="starter-event-kicker">ACHIEVEMENT OBTAINED</span><div class="starter-achievement-icon">🏆</div><h2 class="starter-achievement-title">Grand Theft Pokémon</h2><p>Your first Pokémon is now in your Gym Bag and will already be waiting in your party when Gym battles unlock.</p><button id="starterDone" class="starter-event-primary" type="button">DONE</button>`);
    document.getElementById('starterDone')?.addEventListener('click',()=>{close();releasePriority()});
    try{navigator.vibrate?.([45,35,80,35,130]);if(typeof achSound==='function')achSound()}catch{}
  }

  async function chooseStarter(id){
    document.querySelectorAll('[data-starter-choice]').forEach(b=>b.disabled=true);error('');
    try{const state=await api({action:'choose',player_id:activeId(),starter_pokemon:id});starterMap.set(activeId(),{player_id:activeId(),name:activeName(),starter_pokemon:state.starter_pokemon,completed:false});renderStarterDecorations();showSelected(state)}
    catch(e){error(e.message);document.querySelectorAll('[data-starter-choice]').forEach(b=>b.disabled=false)}
  }
  async function completeStarter(){
    const btn=document.getElementById('starterPutBag');if(btn)btn.disabled=true;error('');
    try{const state=await api({action:'complete',player_id:activeId()});starterMap.set(activeId(),{player_id:activeId(),name:activeName(),starter_pokemon:state.starter_pokemon,completed:true});await refreshStarters();renderStarterDecorations();showAchievement();window.dispatchEvent(new CustomEvent('obd-starter-pokemon-chosen',{detail:{playerId:activeId(),starterPokemon:state.starter_pokemon}}))}
    catch(e){error(e.message);if(btn)btn.disabled=false}
  }

  function putCompanion(host,id){
    if(!host||!id)return;host.classList.add('starter-companion-host');let badge=host.querySelector(':scope > .starter-companion');if(!badge){badge=document.createElement('span');badge.className='starter-companion';host.appendChild(badge)}
    if(badge.dataset.starterId===String(id))return;
    const p=poke(id);badge.dataset.starterId=String(id);badge.innerHTML=`<img src="${p.image}" alt="${esc(p.name)}" draggable="false">`;badge.title=p.name;
  }
  function renderStarterBadge(){
    const data=starterMap.get(activeId()),wrap=document.getElementById('badges');if(!wrap)return;
    const old=wrap.querySelector('.starter-achievement-badge');
    if(!data?.completed){old?.remove();return}
    if(!old){const badge=document.createElement('span');badge.className='badge starter-achievement-badge';badge.textContent='🏆 Grand Theft Pokémon';wrap.appendChild(badge)}
    const count=document.getElementById('badgeCount');if(count){const n=wrap.querySelectorAll('.badge').length;count.textContent=`${n} låst opp`}
  }
  function renderStarterDecorations(){
    for(const data of starterMap.values()){
      const id=Number(data.starter_pokemon);if(!id)continue;
      const player=window.getPlayers?.().find(p=>p.id===data.player_id||p.name===data.name);
      if(player){const card=document.getElementById('person'+player.name),host=card?.querySelector('.fighter-character');putCompanion(host,id)}
      document.querySelectorAll(`[data-battle-player="${CSS.escape(String(data.player_id))}"]`).forEach(card=>putCompanion(card.querySelector('.battle-fighter-art'),id));
    }
    renderStarterBadge();
  }

  async function refreshStarters(){
    if(refreshBusy)return;refreshBusy=true;
    try{const data=await api({action:'list'});starterMap.clear();for(const row of data.starters||[])starterMap.set(row.id,{player_id:row.id,name:row.name,starter_pokemon:Number(row.starter_pokemon),completed:!!row.starter_event_completed_at});renderStarterDecorations()}
    catch(e){console.warn('Starter list sync failed',e)}finally{refreshBusy=false}
  }
  async function resumeActive(){
    const id=activeId();if(!id)return;
    try{const state=await api({action:'status',player_id:id});if(state?.triggered&&!state.completed){setPriority(true);state.starter_pokemon?showSelected(state):showIntro()}}catch(e){console.warn('Starter status failed',e)}
  }
  async function armFromWorkout(detail){
    const id=detail?.playerId||activeId();if(!id||id!==activeId())return;
    const person=detail?.person||activeName();
    const workoutCount=typeof rowsForPlayer==='function'?rowsForPlayer(person).length:0;
    const fourthWorkout=workoutCount===4;
    if(fourthWorkout){setPriority(true);showIntro()}
    try{
      const state=await api({action:'arm',player_id:id});
      if(state?.triggered&&!state.completed){setPriority(true);if(state.starter_pokemon)showSelected(state);else if(!fourthWorkout)showIntro()}
      else if(fourthWorkout){close();releasePriority()}
    }catch(e){console.warn('Starter arm failed',e)}
  }

  installPriorityHooks();
  window.refreshStarterPokemon=refreshStarters;
  window.renderStarterPokemon=renderStarterDecorations;
  window.handleStarterWorkoutEvent=armFromWorkout;
  window.addEventListener('obd-workout-added',e=>armFromWorkout(e.detail||{}));
  window.addEventListener('obd-auth-ready',()=>{setTimeout(refreshStarters,150);setTimeout(resumeActive,500)});
  window.addEventListener('obd-player-changed',()=>{close();setPriority(false);setTimeout(refreshStarters,80);setTimeout(resumeActive,250)});
  window.addEventListener('obd-battle-changed',()=>setTimeout(renderStarterDecorations,30));
  window.addEventListener('pageshow',()=>setTimeout(refreshStarters,250));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(refreshStarters,120)});

  const battle=document.getElementById('battleSummary');if(battle)new MutationObserver(()=>setTimeout(renderStarterDecorations,0)).observe(battle,{childList:true,subtree:true});
  const fighters=document.querySelector('.fighters-stack');if(fighters)new MutationObserver(()=>setTimeout(renderStarterDecorations,0)).observe(fighters,{childList:true,subtree:true});
  const badges=document.getElementById('badges');if(badges)new MutationObserver(()=>setTimeout(renderStarterBadge,0)).observe(badges,{childList:true});
  [250,800,1800].forEach(ms=>setTimeout(refreshStarters,ms));
  setTimeout(resumeActive,1100);
})();
