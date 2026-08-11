(()=>{
  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const MASTER_PIN='1337';
  const TEST_MODE=new URLSearchParams(location.search).get('bossTest')==='1';
  const TEST_KEY='obd_gym_test_v4';
  const HP=TEST_MODE?360:820;
  const LEADERS=[
    {name:'Brock',image:'boss-png/boss-1.png',weak:'power'},
    {name:'Misty',image:'boss-png/boss-2.png',weak:'engine'},
    {name:'Lt. Surge',image:'boss-png/boss-3.png',weak:'engine'},
    {name:'Erika',image:'boss-png/boss-4.png',weak:'grit'},
    {name:'Koga',image:'boss-png/boss-5.png',weak:'grit'},
    {name:'Sabrina',image:'boss-png/boss-6.png',weak:'power'},
    {name:'Blaine',image:'boss-png/boss-7.png',weak:'engine'},
    {name:'Giovanni',image:'boss-png/boss-8.png',weak:'power'}
  ];
  const MOVES={
    basic:{id:'basic',name:'BASIC STRIKE',type:'basic',power:205,rarity:'STARTER',icon:'✊'},
    iron:{id:'iron',name:'IRON COMET',type:'power',power:240,rarity:'COMMON',icon:'💪'},
    redline:{id:'redline',name:'REDLINE',type:'engine',power:235,rarity:'COMMON',icon:'⚡'},
    grit:{id:'grit',name:'GRIT CRUSH',type:'grit',power:225,rarity:'COMMON',icon:'☠'},
    haymaker:{id:'haymaker',name:'HAYMAKER',type:'power',power:275,rarity:'RARE',icon:'🥊'},
    afterburn:{id:'afterburn',name:'AFTERBURN',type:'engine',power:265,rarity:'RARE',icon:'🔥'},
    warcry:{id:'warcry',name:'WAR DOG',type:'grit',power:255,rarity:'RARE',icon:'🐺',crit:.28},
    execution:{id:'execution',name:'EXECUTION',type:'power',power:300,rarity:'EPIC',icon:'⚔️'}
  };
  const DROP_POOL=['iron','redline','grit','haymaker','afterburn','warcry','execution'];
  let cache=null,pendingWorkout=null,loading=false,refreshTimer=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const selectedName=()=>window.getSelectedPlayer?.()||'';
  const selectedId=()=>window.getSelectedPlayerId?.()||window.getPlayerMeta?.(selectedName())?.id||'';
  const activeName=()=>selectedName()||(TEST_MODE?'TEST PLAYER':'');
  const activeId=()=>selectedId()||(TEST_MODE?'test-player':'');
  const levelFor=name=>{try{return typeof levelInfo==='function'?levelInfo(name).level:1}catch{return 1}};
  const nowWeek=()=>{try{return typeof currentWeek==='function'?currentWeek():new Date().toISOString().slice(0,10)}catch{return new Date().toISOString().slice(0,10)}};
  const pokemon=id=>window.getPokemon?.(id)||{id:Number(id),name:`#${String(id).padStart(3,'0')}`,image:`dex-png/${id}.png`};
  const uniq=a=>[...new Set((a||[]).map(Number).filter(Number.isInteger))];
  const typeLabel=t=>({power:'POWER',engine:'ENGINE',grit:'GRIT',basic:'BASIC'}[t]||String(t).toUpperCase());
  const typeIcon=t=>({power:'💪',engine:'⚡',grit:'☠',basic:'✊'}[t]||'◆');
  const rand=n=>Math.floor(Math.random()*n);
  const lootCount=()=>{const r=rand(100);return r<15?1:r<50?2:r<85?3:4};
  const sample=(arr,n)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)};
  const deterministicLeader=(week,cycle)=>{let h=2166136261;for(const c of `${week}:${cycle}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return Math.abs(h)%8};
  const leader=()=>LEADERS[Math.max(0,Math.min(7,Number(cache?.global?.leader_index)||0))];
  const deadlineText=()=>{const [y,m,d]=nowWeek().split('-').map(Number),end=new Date(Date.UTC(y,m-1,d+7)),diff=Math.max(0,end-Date.now());return `${Math.floor(diff/86400000)}D ${Math.floor(diff%86400000/3600000)}H`};
  const blankPlayer=id=>({player_id:id,seen_leaders:[],defeated_leaders:[],owned_pokemon:[],active_party:[],attacks:['basic'],pending_attack:null,current_cycle:0,current_loot:[]});

  function ensureUi(){
    let block=document.getElementById('weeklyBoss');
    if(!block){
      block=document.createElement('section');block.id='weeklyBoss';block.className='weekly-boss';block.hidden=true;
      const reward=document.getElementById('rewardEngine');
      if(reward?.parentNode)reward.insertAdjacentElement('afterend',block);else document.querySelector('.app-shell')?.prepend(block);
    }
    let overlay=document.getElementById('bossOverlay');
    if(!overlay){
      overlay=document.createElement('div');overlay.id='bossOverlay';overlay.className='boss-overlay';overlay.innerHTML='<div class="boss-modal" id="bossModal" role="dialog" aria-modal="true"></div>';document.body.appendChild(overlay);
      overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal()});
      document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
    }
    return block;
  }
  function openModal(html){ensureUi();const o=document.getElementById('bossOverlay'),m=document.getElementById('bossModal');m.innerHTML=html;o.classList.add('show');document.body.classList.add('boss-modal-open');bindFallback(o)}
  function closeModal(){document.getElementById('bossOverlay')?.classList.remove('show');document.body.classList.remove('boss-modal-open')}
  const pokeArt=(id,small=false)=>{const p=pokemon(id);return `<span class="poke-art ${small?'small':''}" data-fallback="#${String(id).padStart(3,'0')}"><img src="${p.image}" alt="${esc(p.name)}" draggable="false"></span>`};
  const leaderArt=(l,hidden=false)=>`<span class="leader-art ${hidden?'silhouette':''}"><img src="${l.image}" alt="${hidden?'Unknown Gym Leader':esc(l.name)}" draggable="false"></span>`;
  function bindFallback(root=document){root.querySelectorAll('.poke-art img').forEach(img=>{img.onerror=()=>{img.parentElement?.classList.add('missing');img.remove()}})}

  async function api(payload){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,pin:MASTER_PIN})});
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!r.ok)throw new Error(data.error||text||'Gym sync failed');return data;
  }
  function testRead(){try{return JSON.parse(localStorage.getItem(TEST_KEY)||'null')}catch{return null}}
  function testWrite(v){try{localStorage.setItem(TEST_KEY,JSON.stringify(v))}catch{}return v}
  function testEnsure(){
    const id=activeId(),week=nowWeek();let s=testRead();
    if(!s)s={global:{week_key:week,leader_index:0,initial_round_complete:false,cycle:1,damage:0,defeated:false,contributors:{}},players:{}};
    s.players=s.players||{};s.players[id]=s.players[id]||blankPlayer(id);testWrite(s);return s;
  }
  async function loadFor(id=activeId()){
    if(TEST_MODE){const s=testEnsure();return{global:s.global,player:s.players[id]||blankPlayer(id)}}
    return api({action:'get',player_id:id,level:levelFor(activeName())});
  }
  async function persistPlayer(next,id=next.player_id||activeId()){
    if(TEST_MODE){const s=testEnsure();s.players[id]=next;testWrite(s);if(id===activeId()&&cache)cache.player=next;return next}
    const d=await api({action:'save_player',player_id:id,level:levelFor(window.getPlayerMeta?.(id)?.name||activeName()),state:next});if(id===activeId()&&cache)cache.player=d.player;return d.player;
  }
  async function persistGlobal(next){
    if(TEST_MODE){const s=testEnsure();s.global=next;testWrite(s);if(cache)cache.global=next;return next}
    const d=await api({action:'save_global',player_id:activeId(),level:levelFor(activeName()),state:next});if(cache)cache.global=d.global;return d.global;
  }

  function rollLoot(playerState,level){
    const owned=uniq(playerState.owned_pokemon),complete=owned.length>=151,max=level>=8?151:148;
    const pool=complete?Array.from({length:151},(_,i)=>i+1):Array.from({length:max},(_,i)=>i+1).filter(id=>!owned.includes(id));
    if(!pool.length)return[];return sample(pool,Math.min(lootCount(),pool.length));
  }
  async function syncWeek(){
    const g=cache.global,week=nowWeek();if(String(g.week_key)===week)return;
    let idx=Number(g.leader_index)||0,complete=!!g.initial_round_complete;
    if(g.defeated){
      if(complete)idx=deterministicLeader(week,Number(g.cycle||1)+1);
      else if(idx<7)idx++;else{complete=true;idx=deterministicLeader(week,Number(g.cycle||1)+1)}
    }
    cache.global=await persistGlobal({...g,week_key:week,leader_index:idx,initial_round_complete:complete,cycle:Number(g.cycle||1)+1,damage:0,defeated:false,contributors:{}});
  }
  async function ensurePersonalCycle(name=activeName(),id=activeId()){
    const p=cache.player,g=cache.global,lvl=levelFor(name);let changed=false,next={...p};
    const seen=uniq(next.seen_leaders);if(!seen.includes(Number(g.leader_index))){seen.push(Number(g.leader_index));next.seen_leaders=seen;changed=true}
    if(Number(next.current_cycle)!==Number(g.cycle)){next.current_cycle=Number(g.cycle);next.current_loot=rollLoot(next,lvl);changed=true}
    if(changed)cache.player=await persistPlayer(next,id);
  }

  function scheduleRefresh(delay=0){clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshGym,delay)}
  async function refreshGym(){
    const name=activeName(),id=activeId(),lvl=levelFor(name),block=ensureUi();
    if(!TEST_MODE&&(!name||!id||lvl<3)){block.hidden=true;return}
    if(TEST_MODE||name&&id){block.hidden=false;if(!cache)block.innerHTML='<div class="boss-topline"><span class="boss-alert">GYM LEADER</span></div><div class="gym-loading">Loading Gym...</div>'}
    if(loading)return;loading=true;
    try{cache=await loadFor(id);await syncWeek();await ensurePersonalCycle(name,id);renderGym()}
    catch(e){console.warn('Gym refresh failed',e);renderSyncError(e.message)}finally{loading=false}
  }
  function renderSyncError(msg){const b=ensureUi();b.hidden=false;b.innerHTML=`<div class="boss-topline"><span class="boss-alert">GYM SYNC ERROR</span></div><div class="gym-error">${esc(msg||'Could not load Gym data')} <button data-retry>RETRY</button></div>`;b.querySelector('[data-retry]')?.addEventListener('click',refreshGym)}
  function contributions(){const c=cache?.global?.contributors||{},items=Object.values(c).sort((a,b)=>Number(b.damage||0)-Number(a.damage||0));return items.length?items.slice(0,4).map(x=>`<span>${esc(x.name||'PLAYER')} <b>${Math.round(x.damage||0)}</b></span>`).join(''):'<span>NO DAMAGE YET</span>'}

  function renderGym(){
    if(!cache)return;const b=ensureUi(),g=cache.global,p=cache.player,l=leader(),hp=Math.max(0,HP-Number(g.damage||0)),pct=Math.max(0,Math.min(100,hp/HP*100)),loot=uniq(p.current_loot),owned=uniq(p.owned_pokemon),party=uniq(p.active_party),complete=owned.length>=151;
    b.hidden=false;b.innerHTML=`<div class="boss-topline"><span class="boss-alert">${g.defeated?'GYM LEADER DOWN!':'GYM LEADER APPEARING!'}</span><span class="boss-clock">${deadlineText()}</span></div>
      <div class="boss-mainrow"><div class="boss-avatar">${leaderArt(l)}</div><div class="boss-core"><div class="boss-titleline"><div><small>GYM #${Number(g.leader_index)+1}${g.initial_round_complete?' · RANDOM ENCOUNTER':''}</small><strong>${esc(l.name)}</strong></div><span class="boss-weak">WEAK ${typeIcon(l.weak)} ${typeLabel(l.weak)}</span></div><div class="boss-hp-line"><span>HP</span><strong>${hp} / ${HP}</strong></div><div class="boss-hp"><i style="width:${pct}%"></i></div><div class="boss-contrib">${contributions()}</div></div></div>
      <div class="carried-head"><span>${complete?'CARRIED POKÉMON':'STEAL IF YOU WIN'}</span><b>${complete?'GYMDEX COMPLETE':loot.length?`${loot.length} NEW`:(levelFor(activeName())<8?'LEGENDARIES LOCKED':'NO NEW LOOT')}</b></div>
      <div class="carried-pokemon">${loot.length?loot.map(id=>`<div>${pokeArt(id,true)}<span>#${String(id).padStart(3,'0')} ${esc(pokemon(id).name)}</span></div>`).join(''):`<div class="no-loot">${levelFor(activeName())<8&&owned.length>=148?'Reach Level 8 to unlock #149 Dragonite, #150 Mewtwo and #151 Mew.':'No new Pokémon available.'}</div>`}</div>
      <div class="boss-footer"><div class="boss-action-wrap">${g.defeated?'<span class="boss-defeated-note">✓ WAITING FOR NEXT GYM</span>':'<span class="boss-train-note">TRAIN → EARN 1 ATTACK</span>'}${TEST_MODE&&!g.defeated?' <button class="boss-secondary mini" data-test-hit>TEST ATTACK</button>':''}${TEST_MODE&&g.defeated?' <button class="boss-secondary mini" data-test-next>NEXT GYM</button>':''}</div><div class="boss-tools"><button data-attacks>⚔ ATTACKS ${(p.attacks||['basic']).length}/3${p.pending_attack?' +1':''}</button><button data-dex>◈ GYMDEX ${owned.length}/151</button><button data-leaders>♛ LEADERS</button></div></div>
      <div class="party-strip"><span>PARTY ${party.length}/6 · +${party.length*2}% DMG</span><div>${party.map(id=>pokeArt(id,true)).join('')}${Array.from({length:6-party.length},()=>'<i>+</i>').join('')}</div></div>`;
    b.querySelector('[data-attacks]')?.addEventListener('click',openAttacks);b.querySelector('[data-dex]')?.addEventListener('click',openDex);b.querySelector('[data-leaders]')?.addEventListener('click',openLeaders);b.querySelector('[data-test-hit]')?.addEventListener('click',()=>attackReady({person:activeName(),type:'strength',levelAfter:Math.max(3,levelFor(activeName()))}));b.querySelector('[data-test-next]')?.addEventListener('click',testNext);bindFallback(b);
  }

  function attackReady(detail){if(!cache||cache.global.defeated)return;pendingWorkout={...detail};const l=leader();openModal(`<div class="boss-modal-head"><span class="boss-alert">GYM LEADER ACTIVE</span><button data-close>×</button></div><div class="leader-modal-art">${leaderArt(l)}</div><h3>DEAL DAMAGE?</h3><p>${esc(detail.person)} earned one attack from the ${detail.type==='strength'?'strength':'cardio'} workout.</p><div class="boss-ready-actions"><button class="boss-secondary" data-auto>SKIP → AUTO</button><button class="boss-primary" data-fight>FIGHT</button></div>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal);document.querySelector('[data-auto]')?.addEventListener('click',autoAttack);document.querySelector('[data-fight]')?.addEventListener('click',openAttackPicker)}
  function expected(m,type){const l=leader(),lvl=levelFor(activeName()),party=uniq(cache.player.active_party).length;let x=m.power;if(m.type===l.weak)x*=1.35;if(type==='strength'&&m.type==='power')x*=1.12;if(type==='cardio'&&m.type==='engine')x*=1.12;x*=1+Math.min(.18,Math.max(0,lvl-3)*.03);x*=1+party*.02;return x}
  function autoAttack(){if(!pendingWorkout)return closeModal();const moves=(cache.player.attacks||['basic']).map(id=>MOVES[id]).filter(Boolean),best=[...moves].sort((a,b)=>expected(b,pendingWorkout.type)-expected(a,pendingWorkout.type))[0]||MOVES.basic;performAttack(best,true)}
  function openAttackPicker(){if(!pendingWorkout)return closeModal();const l=leader(),moves=(cache.player.attacks||['basic']).map(id=>MOVES[id]).filter(Boolean);openModal(`<div class="boss-modal-head"><span class="boss-alert">CHOOSE ATTACK</span><button data-close>×</button></div><div class="leader-mini-head">${leaderArt(l)}<div><h3>${esc(l.name)}</h3><p>Weak ${typeIcon(l.weak)} ${typeLabel(l.weak)}</p></div></div><div class="boss-move-list">${moves.map(m=>`<button class="boss-move" data-move="${m.id}"><span>${m.icon}</span><div><strong>${m.name}</strong><small>${m.rarity} · ${typeLabel(m.type)} · ${m.power} BASE</small></div><b>USE</b></button>`).join('')}</div><button class="boss-secondary wide" data-auto>AUTO PICK</button>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal);document.querySelector('[data-auto]')?.addEventListener('click',autoAttack);document.querySelectorAll('[data-move]').forEach(x=>x.addEventListener('click',()=>performAttack(MOVES[x.dataset.move],false)))}
  function damageFor(m,d){const l=leader(),party=uniq(cache.player.active_party).length;let mult=1,notes=[];if(m.type===l.weak){mult*=1.35;notes.push('SUPER EFFECTIVE')}if(d.type==='strength'&&m.type==='power'){mult*=1.12;notes.push('STRENGTH BOOST')}if(d.type==='cardio'&&m.type==='engine'){mult*=1.12;notes.push('CARDIO BOOST')}mult*=1+Math.min(.18,Math.max(0,Number(d.levelAfter||levelFor(d.person))-3)*.03);if(party){mult*=1+party*.02;notes.push(`PARTY +${party*2}%`)}const crit=Math.random()<Math.min(.55,(m.crit||.10)+(party>=6?.05:0));if(crit){mult*=1.45;notes.push('CRITICAL')}mult*=.96+Math.random()*.08;return{damage:Math.max(5,Math.round(m.power*mult/5)*5),notes}}
  async function performAttack(m,auto){
    if(!pendingWorkout||!cache)return closeModal();const detail=pendingWorkout;pendingWorkout=null;
    try{
      const fresh=await loadFor(activeId());cache.global=fresh.global;cache.player=fresh.player;await syncWeek();await ensurePersonalCycle();if(cache.global.defeated){closeModal();renderGym();return}
      const hit=damageFor(m,detail),g=cache.global,before=Number(g.damage||0),after=Math.min(HP,before+hit.damage),id=activeId(),c={...(g.contributors||{})},prev=c[id]||{name:activeName(),damage:0,hits:0};c[id]={name:activeName(),damage:Number(prev.damage||0)+(after-before),hits:Number(prev.hits||0)+1};const defeated=after>=HP;
      cache.global=await persistGlobal({...g,damage:after,defeated,contributors:c});if(defeated)await awardAllContributors();renderGym();
      try{if(typeof beep==='function')beep(defeated?150:230,.15,'square',0,.04);navigator.vibrate?.(defeated?[50,40,100,40,140]:[40,25,70])}catch{}
      const l=leader();openModal(`<div class="boss-modal-head"><span class="boss-alert">${defeated?'GYM LEADER DOWN!':'DIRECT HIT'}</span><button data-close>×</button></div><div class="boss-hit-stage">${leaderArt(l)}<b>-${after-before}</b></div><h3>${defeated?`YOU BEAT ${esc(l.name.toUpperCase())}!`:esc(m.name)}</h3><p>${defeated?'Every contributor steals the Pokémon this Gym Leader carried.':(hit.notes.length?hit.notes.join(' · '):auto?'AUTO ATTACK':'HIT CONFIRMED')}</p>${defeated?victoryLootHtml():''}<button class="boss-primary wide" data-close>${defeated?'CLAIMED':'DONE'}</button>`);document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',closeModal));
    }catch(e){if(typeof toast==='function')toast(e.message||'Gym attack failed');scheduleRefresh(0)}
  }
  async function awardAllContributors(){
    const g=cache.global,ids=Object.keys(g.contributors||{}).filter(id=>Number(g.contributors[id]?.hits||0)>0);
    for(const id of ids){
      const meta=window.getPlayerMeta?.(id),name=meta?.name||g.contributors[id]?.name||'',lvl=name?levelFor(name):3;let d=await loadFor(id),p=d.player;
      if(Number(p.current_cycle)!==Number(g.cycle))p={...p,current_cycle:g.cycle,current_loot:rollLoot(p,lvl),seen_leaders:[...new Set([...uniq(p.seen_leaders),Number(g.leader_index)])]};
      const loot=uniq(p.current_loot),owned=[...new Set([...uniq(p.owned_pokemon),...loot])].sort((a,b)=>a-b),defeated=[...new Set([...uniq(p.defeated_leaders),Number(g.leader_index)])],party=uniq(p.active_party).filter(n=>owned.includes(n)).slice(0,6);
      for(const n of loot)if(party.length<6&&!party.includes(n))party.push(n);
      p=awardMove({...p,owned_pokemon:owned,defeated_leaders:defeated,active_party:party},Number(g.leader_index),id);await persistPlayer(p,id);if(id===activeId())cache.player=p;
    }
  }
  function awardMove(p,idx,id){const attacks=(p.attacks||['basic']).filter(x=>MOVES[x]),move=DROP_POOL[(idx*7+String(id).length)%DROP_POOL.length];if(attacks.includes(move))return p;if(attacks.length<3)return{...p,attacks:[...attacks,move]};return{...p,pending_attack:p.pending_attack||move}}
  function victoryLootHtml(){const loot=uniq(cache.player.current_loot);return `<div class="stolen-pokemon-banner"><span>POKÉMON STOLEN</span><div>${loot.map(id=>`<div>${pokeArt(id,true)}<b>#${String(id).padStart(3,'0')} ${esc(pokemon(id).name)}</b></div>`).join('')||'<small>No new Pokémon this time.</small>'}</div></div>`}

  function openDex(){
    const p=cache.player,owned=uniq(p.owned_pokemon).sort((a,b)=>a-b),party=uniq(p.active_party),complete=owned.length>=151;
    openModal(`<div class="boss-modal-head"><span class="boss-alert">GYMDEX</span><button data-close>×</button></div><h3>${owned.length}/151 POKÉMON STOLEN</h3><p>${complete?'GYMDEX COMPLETE. You stole all 151.':'Beat Gym Leaders and steal every Pokémon.'}</p><div class="party-editor"><div><span>ACTIVE PARTY</span><strong>${party.length}/6</strong><small>Each active Pokémon gives +2% Gym damage.</small></div><div class="party-six">${party.map(id=>`<button data-remove="${id}">${pokeArt(id,true)}<b>×</b></button>`).join('')}${Array.from({length:6-party.length},()=>'<i>+</i>').join('')}</div></div><div class="gymdex-grid">${owned.length?owned.map(id=>{const pkm=pokemon(id),inParty=party.includes(id);return`<div class="dex-card pokemon-card ${inParty?'in-party':''}">${pokeArt(id)}<strong>#${String(id).padStart(3,'0')} ${esc(pkm.name)}</strong><button data-toggle="${id}">${inParty?'IN PARTY ✓':'ADD TO PARTY'}</button></div>`}).join(''):'<div class="no-loot">No Pokémon stolen yet.</div>'}</div>`);
    document.querySelector('[data-close]')?.addEventListener('click',closeModal);document.querySelectorAll('[data-remove]').forEach(x=>x.addEventListener('click',()=>setParty(party.filter(n=>n!==Number(x.dataset.remove)))));document.querySelectorAll('[data-toggle]').forEach(x=>x.addEventListener('click',()=>toggleParty(Number(x.dataset.toggle))));bindFallback(document.getElementById('bossOverlay'));
  }
  async function setParty(next){cache.player=await persistPlayer({...cache.player,active_party:uniq(next).slice(0,6)});renderGym();openDex()}
  async function toggleParty(id){const party=uniq(cache.player.active_party);if(party.includes(id))return setParty(party.filter(n=>n!==id));if(party.length<6)return setParty([...party,id]);openReplaceParty(id)}
  function openReplaceParty(addId){const party=uniq(cache.player.active_party);openModal(`<div class="boss-modal-head"><span class="boss-alert">PARTY FULL 6/6</span><button data-close>×</button></div><h3>SWAP IN ${esc(pokemon(addId).name.toUpperCase())}</h3><p>Choose who leaves the party.</p><div class="replace-party">${party.map(id=>`<button data-replace-party="${id}">${pokeArt(id)}<span>#${String(id).padStart(3,'0')} ${esc(pokemon(id).name)}</span><b>SWAP</b></button>`).join('')}</div>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal);document.querySelectorAll('[data-replace-party]').forEach(x=>x.addEventListener('click',()=>setParty(party.map(n=>n===Number(x.dataset.replaceParty)?addId:n))));bindFallback(document.getElementById('bossOverlay'))}
  function openLeaders(){const seen=uniq(cache.player.seen_leaders),def=uniq(cache.player.defeated_leaders);openModal(`<div class="boss-modal-head"><span class="boss-alert">GYM LEADERS</span><button data-close>×</button></div><h3>${def.length}/8 DEFEATED</h3><p>Gym Leaders stay hidden until you encounter them for the first time.</p><div class="leader-grid">${LEADERS.map((l,i)=>{const met=seen.includes(i),won=def.includes(i);return`<div class="leader-card ${won?'won':''}">${leaderArt(l,!met)}<strong>${met?esc(l.name):'???'}</strong><small>${won?'DEFEATED ✓':met?'ENCOUNTERED':'NOT ENCOUNTERED'}</small></div>`}).join('')}</div>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal)}
  function openAttacks(){const p=cache.player;if(p.pending_attack&&MOVES[p.pending_attack])return openPendingAttack();const moves=(p.attacks||['basic']).map(id=>MOVES[id]).filter(Boolean);openModal(`<div class="boss-modal-head"><span class="boss-alert">ATTACK LOADOUT</span><button data-close>×</button></div><h3>${moves.length}/3 ATTACKS</h3><p>Each real workout earns one attack against the active Gym Leader.</p><div class="boss-move-list">${moves.map(m=>`<div class="boss-move"><span>${m.icon}</span><div><strong>${m.name}</strong><small>${m.rarity} · ${typeLabel(m.type)} · ${m.power} BASE</small></div><b>EQUIPPED</b></div>`).join('')}</div>${Array.from({length:3-moves.length},()=>'<div class="empty-move">🔒 EMPTY ATTACK SLOT</div>').join('')}`);document.querySelector('[data-close]')?.addEventListener('click',closeModal)}
  function openPendingAttack(){const id=cache.player.pending_attack,m=MOVES[id],moves=(cache.player.attacks||['basic']).map(x=>MOVES[x]).filter(Boolean);openModal(`<div class="boss-modal-head"><span class="boss-alert">NEW ATTACK FOUND!</span><button data-close>×</button></div><h3>${m.icon} ${m.name}</h3><p>${m.rarity} · ${typeLabel(m.type)} · ${m.power} BASE</p><div class="boss-move-list">${moves.map(x=>`<button class="boss-move" data-replace="${x.id}"><span>${x.icon}</span><div><strong>${x.name}</strong><small>${x.power} BASE</small></div><b>REPLACE</b></button>`).join('')}</div><button class="boss-secondary wide" data-discard>DISCARD</button>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal);document.querySelector('[data-discard]')?.addEventListener('click',async()=>{cache.player=await persistPlayer({...cache.player,pending_attack:null});closeModal();renderGym()});document.querySelectorAll('[data-replace]').forEach(x=>x.addEventListener('click',async()=>{cache.player=await persistPlayer({...cache.player,attacks:(cache.player.attacks||[]).map(a=>a===x.dataset.replace?id:a),pending_attack:null});closeModal();renderGym()}))}
  async function testNext(){if(!TEST_MODE||!cache.global.defeated)return;const g=cache.global,cycle=Number(g.cycle||1)+1;let idx=Number(g.leader_index)||0,complete=!!g.initial_round_complete;if(complete)idx=deterministicLeader(`${g.week_key}:test`,cycle);else if(idx<7)idx++;else{complete=true;idx=deterministicLeader(`${g.week_key}:test`,cycle)}cache.global=await persistGlobal({...g,leader_index:idx,initial_round_complete:complete,cycle,damage:0,defeated:false,contributors:{}});cache.player=await persistPlayer({...cache.player,current_cycle:0});await ensurePersonalCycle();renderGym()}

  window.renderGymLeader=renderGym;
  window.refreshGymLeader=refreshGym;
  window.addEventListener('obd-workout-added',e=>{
    const d=e.detail||{};
    scheduleRefresh(0);
    if(!TEST_MODE&&Number(d.levelAfter||0)<3)return;
    const delay=Number(d.levelAfter||0)>Number(d.levelBefore||0)?7800:800;
    setTimeout(async()=>{await refreshGym();if(cache&&!cache.global.defeated)attackReady(d)},delay);
  });
  window.addEventListener('obd-player-changed',()=>{closeModal();cache=null;scheduleRefresh(0)});
  window.addEventListener('obd-auth-ready',()=>{cache=null;scheduleRefresh(0)});
  window.addEventListener('pageshow',()=>scheduleRefresh(0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleRefresh(0)});
  if(typeof window.render==='function'&&!window.__obdGymRenderPatch){const old=window.render;window.__obdGymRenderPatch=true;window.render=function(){old();scheduleRefresh(0)}}
  [0,250,750,1500,3000,6000].forEach(ms=>setTimeout(()=>scheduleRefresh(0),ms));
  setInterval(()=>scheduleRefresh(0),15000);
})();
