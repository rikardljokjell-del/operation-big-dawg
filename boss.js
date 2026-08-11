(()=>{
  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const MASTER_PIN='1337';
  const TEST_MODE=new URLSearchParams(location.search).get('bossTest')==='1';
  const TEST_KEY='obd_gym_test_v5';
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
  const STRONG_IDS=new Set([3,9,26,131,143,148,95,94,93,92,135,133,59,34,31,130,144,145,146,123,141,25,6]);
  const ELITE_IDS=new Set([149,150,151]);
  let cache=null,pendingWorkout=null,loading=false,refreshTimer=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const selectedName=()=>window.getSelectedPlayer?.()||'';
  const selectedId=()=>window.getSelectedPlayerId?.()||window.getPlayerMeta?.(selectedName())?.id||'';
  const activeName=()=>selectedName()||(TEST_MODE?'TEST PLAYER':'');
  const activeId=()=>selectedId()||(TEST_MODE?'test-player':'');
  const realLevel=name=>{try{return typeof levelInfo==='function'?levelInfo(name).level:1}catch{return 1}};
  const levelFor=name=>TEST_MODE&&typeof window.getGymTestLevel==='function'?window.getGymTestLevel():realLevel(name);
  const pokemon=id=>window.getPokemon?.(id)||{id:Number(id),name:`#${String(id).padStart(3,'0')}`,image:`dex-png/${id}.png`};
  const uniq=a=>[...new Set((a||[]).map(Number).filter(Number.isInteger))];
  const typeLabel=t=>({power:'POWER',engine:'ENGINE',grit:'GRIT',basic:'BASIC'}[t]||String(t).toUpperCase());
  const typeIcon=t=>({power:'💪',engine:'⚡',grit:'☠',basic:'✊'}[t]||'◆');
  const rand=n=>Math.floor(Math.random()*n);
  const sample=(arr,n)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)};
  const tierFor=id=>ELITE_IDS.has(Number(id))?'elite':STRONG_IDS.has(Number(id))?'strong':'';
  const tierExtra=id=>ELITE_IDS.has(Number(id))?.05:STRONG_IDS.has(Number(id))?.03:0;
  const partyBonus=ids=>uniq(ids).reduce((sum,id)=>sum+.02+tierExtra(id),0);
  const partyBonusPct=ids=>Math.round(partyBonus(ids)*100);
  const lootCount=cycle=>{if(Number(cycle)===1)return 3;if(Number(cycle)===2)return 5;const r=rand(100);return r<15?1:r<50?2:r<85?3:4};
  const leaderForIndex=i=>LEADERS[Math.max(0,Math.min(7,Number(i)||0))];
  const leader=()=>leaderForIndex(cache?.current_leader);
  const blankPlayer=id=>({player_id:id,seen_leaders:[],defeated_leaders:[],owned_pokemon:[],active_party:[],attacks:['basic'],pending_attack:null,current_cycle:0,current_loot:[],current_leader:0,initial_round_complete:false,damage:0,leader_defeated:false});
  const normalize=p=>({...blankPlayer(p?.player_id||activeId()),...(p||{}),seen_leaders:uniq(p?.seen_leaders),defeated_leaders:uniq(p?.defeated_leaders),owned_pokemon:uniq(p?.owned_pokemon).sort((a,b)=>a-b),active_party:uniq(p?.active_party).slice(0,6),attacks:Array.isArray(p?.attacks)&&p.attacks.length?p.attacks.slice(0,3):['basic'],current_loot:uniq(p?.current_loot),current_leader:Math.max(0,Math.min(7,Number(p?.current_leader)||0)),current_cycle:Math.max(0,Number(p?.current_cycle)||0),damage:Math.max(0,Number(p?.damage)||0),leader_defeated:!!p?.leader_defeated,initial_round_complete:!!p?.initial_round_complete});

  function localRollLoot(playerState,lvl,cycle){
    const owned=uniq(playerState.owned_pokemon),complete=owned.length>=151,count=lootCount(cycle),all=Array.from({length:151},(_,i)=>i+1);
    if(complete)return sample(all,count);
    const missing=all.filter(id=>!owned.includes(id));
    const allowed=missing.filter(id=>!ELITE_IDS.has(id)||lvl>=8).filter(id=>!STRONG_IDS.has(id)||lvl>=5);
    const forced=[];
    if(Number(cycle)===2){const strongMissing=[...STRONG_IDS].filter(id=>!owned.includes(id)),pool=strongMissing.length?strongMissing:[...STRONG_IDS];if(pool.length)forced.push(pool[rand(pool.length)])}
    if(lvl>=10&&!owned.includes(151)&&!forced.includes(151))forced.push(151);
    const fixed=[...new Set(forced)].slice(0,count),pool=allowed.filter(id=>!fixed.includes(id));
    const out=[...fixed,...sample(pool,Math.min(count-fixed.length,pool.length))];
    if(out.length<count){const fallback=missing.filter(id=>!out.includes(id));out.push(...sample(fallback,Math.min(count-out.length,fallback.length)))}
    return out.slice(0,count);
  }
  function randomLeader(exclude=-1){const pool=[0,1,2,3,4,5,6,7].filter(x=>x!==exclude);return pool[rand(pool.length)]}

  function ensureUi(){
    let block=document.getElementById('weeklyBoss');
    if(!block){block=document.createElement('section');block.id='weeklyBoss';block.className='weekly-boss';block.hidden=true;const reward=document.getElementById('rewardEngine');if(reward?.parentNode)reward.insertAdjacentElement('afterend',block);else document.querySelector('.app-shell')?.prepend(block)}
    let overlay=document.getElementById('bossOverlay');
    if(!overlay){overlay=document.createElement('div');overlay.id='bossOverlay';overlay.className='boss-overlay';overlay.innerHTML='<div class="boss-modal" id="bossModal" role="dialog" aria-modal="true"></div>';document.body.appendChild(overlay);overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()})}
    return block;
  }
  function openModal(html){ensureUi();const o=document.getElementById('bossOverlay'),m=document.getElementById('bossModal');m.innerHTML=html;o.classList.add('show');document.body.classList.add('boss-modal-open');bindFallback(o)}
  function closeModal(){document.getElementById('bossOverlay')?.classList.remove('show');document.body.classList.remove('boss-modal-open')}
  const pokeArt=(id,small=false)=>{const p=pokemon(id),tier=tierFor(id),label=tier==='elite'?'ELITE':tier==='strong'?'STRONG':'';return `<span class="poke-art ${small?'small':''} ${tier?`pokemon-${tier}`:''}" data-fallback="#${String(id).padStart(3,'0')}"><img src="${p.image}" alt="${esc(p.name)}" draggable="false">${label?`<em>${label}</em>`:''}</span>`};
  const leaderArt=(l,hidden=false)=>`<span class="leader-art ${hidden?'silhouette':''}"><img src="${l.image}" alt="${hidden?'Unknown Gym Leader':esc(l.name)}" draggable="false"></span>`;
  function bindFallback(root=document){root.querySelectorAll('.poke-art img').forEach(img=>{img.onerror=()=>{img.parentElement?.classList.add('missing');img.remove()}})}

  async function api(payload){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,pin:MASTER_PIN})}),text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}if(!r.ok)throw new Error(data.error||text||'Gym sync failed');return data}
  function testRead(){try{return JSON.parse(localStorage.getItem(TEST_KEY)||'null')}catch{return null}}
  function testWrite(v){try{localStorage.setItem(TEST_KEY,JSON.stringify(v))}catch{}return v}
  function testEnsure(){const id=activeId();let s=testRead();if(!s)s={players:{}};s.players=s.players||{};s.players[id]=normalize(s.players[id]||blankPlayer(id));testWrite(s);return s}
  async function loadFor(id=activeId()){
    if(TEST_MODE){const s=testEnsure();return normalize(s.players[id]||blankPlayer(id))}
    const d=await api({action:'get',player_id:id,level:levelFor(activeName())});return normalize(d.player)
  }
  async function persistPlayer(next,id=next.player_id||activeId()){
    next=normalize(next);
    if(TEST_MODE){const s=testEnsure();s.players[id]=next;testWrite(s);if(id===activeId())cache=next;return next}
    const d=await api({action:'save_player',player_id:id,level:levelFor(window.getPlayerMeta?.(id)?.name||activeName()),state:next});if(id===activeId())cache=normalize(d.player);return normalize(d.player)
  }

  async function ensureEncounter(){
    const lvl=levelFor(activeName());if(lvl<3)return;
    if(!TEST_MODE)return;
    let p=normalize(cache),changed=false;
    if(!p.initial_round_complete&&p.current_cycle>0&&p.defeated_leaders.includes(p.current_leader)&&!p.leader_defeated){p=nextEncounterState(p,lvl);changed=true}
    if(p.current_cycle<1){p={...p,current_cycle:1,current_leader:0,damage:0,leader_defeated:false,current_loot:localRollLoot(p,lvl,1),seen_leaders:[...new Set([...p.seen_leaders,0])]};changed=true}
    else if(!p.current_loot.length){p={...p,current_loot:localRollLoot(p,lvl,p.current_cycle)};changed=true}
    if(!p.seen_leaders.includes(p.current_leader)){p={...p,seen_leaders:[...new Set([...p.seen_leaders,p.current_leader])]};changed=true}
    if(changed)cache=await persistPlayer(p)
  }
  function nextEncounterState(p,lvl){
    let idx=p.current_leader,complete=p.initial_round_complete;
    if(!complete){if(idx<7)idx++;else{complete=true;idx=randomLeader(idx)}}else idx=randomLeader(idx);
    const cycle=Number(p.current_cycle||0)+1,base={...p,current_cycle:cycle,current_leader:idx,initial_round_complete:complete,damage:0,leader_defeated:false,current_loot:[]};
    return {...base,current_loot:TEST_MODE?localRollLoot(base,lvl,cycle):[],seen_leaders:[...new Set([...base.seen_leaders,idx])]}
  }
  async function refreshGym(){
    const name=activeName(),id=activeId(),lvl=levelFor(name),block=ensureUi();
    if(!name||!id||lvl<3){block.hidden=true;return}
    block.hidden=false;if(!cache)block.innerHTML='<div class="boss-topline"><span class="boss-alert">GYM LEADER</span></div><div class="gym-loading">Loading Gym...</div>';
    if(loading)return;loading=true;try{cache=await loadFor(id);await ensureEncounter();renderGym()}catch(e){console.warn('Gym refresh failed',e);renderSyncError(e.message)}finally{loading=false}
  }
  function scheduleRefresh(delay=0){clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshGym,delay)}
  function renderSyncError(msg){const b=ensureUi();b.hidden=false;b.innerHTML=`<div class="boss-topline"><span class="boss-alert">GYM SYNC ERROR</span></div><div class="gym-error">${esc(msg||'Could not load Gym data')} <button data-retry>RETRY</button></div>`;b.querySelector('[data-retry]')?.addEventListener('click',refreshGym)}
  function teamHelp(){const selected=window.getBattlePlayers?.()||[];const teammates=Math.max(0,Math.min(5,selected.length-1));return{teammates,bonus:teammates*.03}}
  function renderGym(){
    if(!cache)return;const b=ensureUi(),p=cache,l=leader(),hp=Math.max(0,HP-p.damage),pct=Math.max(0,Math.min(100,hp/HP*100)),loot=uniq(p.current_loot),owned=uniq(p.owned_pokemon),party=uniq(p.active_party),complete=owned.length>=151,team=teamHelp(),lvl=levelFor(activeName()),partyPct=partyBonusPct(party);
    b.hidden=false;b.innerHTML=`<div class="boss-topline"><span class="boss-alert">GYM LEADER APPEARING!</span><span class="boss-clock">PERSONAL STORY</span></div>
      <div class="boss-mainrow"><div class="boss-avatar">${leaderArt(l)}</div><div class="boss-core"><div class="boss-titleline"><div><small>${p.initial_round_complete?'RANDOM ENCOUNTER':`STORY GYM ${p.current_leader+1}/8`}</small><strong>${esc(l.name)}</strong></div><span class="boss-weak">WEAK ${typeIcon(l.weak)} ${typeLabel(l.weak)}</span></div><div class="boss-hp-line"><span>HP</span><strong>${hp} / ${HP}</strong></div><div class="boss-hp"><i style="width:${pct}%"></i></div><div class="boss-contrib"><span>SOLO FIGHT</span><span>TEAM HELP <b>+${Math.round(team.bonus*100)}%</b></span></div></div></div>
      <div class="carried-head"><span>${complete?'CARRIED POKÉMON':'STEAL IF YOU WIN'}</span><b>${complete?'GYMDEX COMPLETE':loot.length?`${loot.length} LOCKED`:(lvl<8?'#149–151 LOCKED':'NO NEW LOOT')}</b></div>
      <div class="carried-pokemon">${loot.length?loot.map(id=>`<div>${pokeArt(id,true)}<span>#${String(id).padStart(3,'0')} ${esc(pokemon(id).name)}</span></div>`).join(''):`<div class="no-loot">${lvl<8&&owned.length>=148?'Reach Level 8 to unlock #149 Dragonite, #150 Mewtwo and #151 Mew.':'No new Pokémon available.'}</div>`}</div>
      <div class="boss-footer"><div class="boss-action-wrap"><span class="boss-train-note">TRAIN → EARN 1 ATTACK</span></div><div class="boss-tools"><button data-attacks>⚔ ATTACKS ${(p.attacks||['basic']).length}/3${p.pending_attack?' +1':''}</button><button data-dex>◈ GYMDEX ${owned.length}/151</button><button data-leaders>♛ LEADERS</button></div></div>
      <div class="party-strip"><span>PARTY ${party.length}/6 · +${partyPct}% DMG · TEAM +${Math.round(team.bonus*100)}%</span><div>${party.map(id=>pokeArt(id,true)).join('')}${Array.from({length:6-party.length},()=>'<i>+</i>').join('')}</div></div>`;
    b.querySelector('[data-attacks]')?.addEventListener('click',openAttacks);b.querySelector('[data-dex]')?.addEventListener('click',openDex);b.querySelector('[data-leaders]')?.addEventListener('click',openLeaders);bindFallback(b)
  }

  function attackReady(detail){if(!cache||cache.leader_defeated||levelFor(activeName())<3)return;pendingWorkout={...detail,levelAfter:levelFor(activeName())};const l=leader();openModal(`<div class="boss-modal-head"><span class="boss-alert">GYM LEADER ACTIVE</span><button data-close>×</button></div><div class="leader-modal-art">${leaderArt(l)}</div><h3>DEAL DAMAGE?</h3><p>${esc(detail.person||activeName())} earned one attack from this workout.</p><div class="boss-ready-actions"><button class="boss-secondary" data-auto>SKIP → AUTO</button><button class="boss-primary" data-fight>FIGHT</button></div>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal);document.querySelector('[data-auto]')?.addEventListener('click',autoAttack);document.querySelector('[data-fight]')?.addEventListener('click',openAttackPicker)}
  function expected(m,type){const l=leader(),lvl=levelFor(activeName()),party=uniq(cache.active_party),team=teamHelp();let x=m.power;if(m.type===l.weak)x*=1.35;if(type==='strength'&&m.type==='power')x*=1.12;if(type==='cardio'&&m.type==='engine')x*=1.12;x*=1+Math.min(.18,Math.max(0,lvl-3)*.03);x*=1+partyBonus(party);x*=1+team.bonus;return x}
  function autoAttack(){if(!pendingWorkout)return closeModal();const moves=(cache.attacks||['basic']).map(id=>MOVES[id]).filter(Boolean),best=[...moves].sort((a,b)=>expected(b,pendingWorkout.type)-expected(a,pendingWorkout.type))[0]||MOVES.basic;performAttack(best,true)}
  function openAttackPicker(){if(!pendingWorkout)return closeModal();const l=leader(),moves=(cache.attacks||['basic']).map(id=>MOVES[id]).filter(Boolean);openModal(`<div class="boss-modal-head"><span class="boss-alert">CHOOSE ATTACK</span><button data-close>×</button></div><div class="leader-mini-head">${leaderArt(l)}<div><h3>${esc(l.name)}</h3><p>Weak ${typeIcon(l.weak)} ${typeLabel(l.weak)}</p></div></div><div class="boss-move-list">${moves.map(m=>`<button class="boss-move" data-move="${m.id}"><span>${m.icon}</span><div><strong>${m.name}</strong><small>${m.rarity} · ${typeLabel(m.type)} · ${m.power} BASE</small></div><b>USE</b></button>`).join('')}</div><button class="boss-secondary wide" data-auto>AUTO PICK</button>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal);document.querySelector('[data-auto]')?.addEventListener('click',autoAttack);document.querySelectorAll('[data-move]').forEach(x=>x.addEventListener('click',()=>performAttack(MOVES[x.dataset.move],false)))}
  function damageFor(m,d){const l=leader(),party=uniq(cache.active_party),team=teamHelp(),pBonus=partyBonus(party);let mult=1,notes=[];if(m.type===l.weak){mult*=1.35;notes.push('SUPER EFFECTIVE')}if(d.type==='strength'&&m.type==='power'){mult*=1.12;notes.push('STRENGTH BOOST')}if(d.type==='cardio'&&m.type==='engine'){mult*=1.12;notes.push('CARDIO BOOST')}mult*=1+Math.min(.18,Math.max(0,Number(d.levelAfter||levelFor(activeName()))-3)*.03);if(party.length){mult*=1+pBonus;notes.push(`PARTY +${Math.round(pBonus*100)}%`)}if(team.bonus){mult*=1+team.bonus;notes.push(`TEAM HELP +${Math.round(team.bonus*100)}%`)}const crit=Math.random()<Math.min(.55,(m.crit||.10)+(party.length>=6?.05:0));if(crit){mult*=1.45;notes.push('CRITICAL')}mult*=.96+Math.random()*.08;return{damage:Math.max(5,Math.round(m.power*mult/5)*5),notes}}
  async function performAttack(m,auto){
    if(!pendingWorkout||!cache)return closeModal();const detail=pendingWorkout;pendingWorkout=null;
    try{
      cache=await loadFor(activeId());await ensureEncounter();if(cache.leader_defeated){closeModal();renderGym();return}
      const oldLeader=leader(),oldIdx=cache.current_leader,loot=uniq(cache.current_loot),hit=damageFor(m,detail),before=cache.damage,after=Math.min(HP,before+hit.damage),defeated=after>=HP;
      cache=await persistPlayer({...cache,damage:after,leader_defeated:defeated});
      if(defeated){const victory=await claimVictory(oldIdx,loot);renderGym();showVictory(oldLeader,loot,after-before,victory);return}
      renderGym();try{if(typeof beep==='function')beep(230,.15,'square',0,.04);navigator.vibrate?.([40,25,70])}catch{}
      openModal(`<div class="boss-modal-head"><span class="boss-alert">DIRECT HIT</span><button data-close>×</button></div><div class="boss-hit-stage">${leaderArt(oldLeader)}<b>-${after-before}</b></div><h3>${esc(m.name)}</h3><p>${hit.notes.length?hit.notes.join(' · '):auto?'AUTO ATTACK':'HIT CONFIRMED'}</p><button class="boss-primary wide" data-close>DONE</button>`);document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',closeModal))
    }catch(e){if(typeof toast==='function')toast(e.message||'Gym attack failed');scheduleRefresh(0)}
  }
  async function claimVictory(oldIdx,loot){
    let p=normalize(cache),owned=p.owned_pokemon.length>=151?p.owned_pokemon:[...new Set([...p.owned_pokemon,...loot])].sort((a,b)=>a-b),party=uniq(p.active_party).filter(n=>owned.includes(n)).slice(0,6);for(const n of loot)if(party.length<6&&!party.includes(n))party.push(n);
    p=awardMove({...p,owned_pokemon:owned,defeated_leaders:[...new Set([...p.defeated_leaders,oldIdx])],active_party:party},oldIdx,activeId());
    const defeatedSnapshot=normalize(p);p=nextEncounterState(p,levelFor(activeName()));cache=await persistPlayer(p);return defeatedSnapshot
  }
  function showVictory(oldLeader,loot,damage,victory){try{if(typeof beep==='function')beep(150,.15,'square',0,.04);navigator.vibrate?.([50,40,100,40,140])}catch{}openModal(`<div class="boss-modal-head"><span class="boss-alert">GYM LEADER DOWN!</span><button data-close>×</button></div><div class="boss-hit-stage">${leaderArt(oldLeader)}<b>-${damage}</b></div><h3>YOU BEAT ${esc(oldLeader.name.toUpperCase())}!</h3><p>You stole every Pokémon this Gym Leader carried. The next Gym Leader is already waiting.</p>${victoryLootHtml(loot)}<button class="boss-primary wide" data-close>NEXT GYM →</button>`);document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>{closeModal();renderGym()}))}
  function awardMove(p,idx,id){const attacks=(p.attacks||['basic']).filter(x=>MOVES[x]),move=DROP_POOL[(idx*7+String(id).length+Number(p.current_cycle||0))%DROP_POOL.length];if(attacks.includes(move))return p;if(attacks.length<3)return{...p,attacks:[...attacks,move]};return{...p,pending_attack:p.pending_attack||move}}
  function victoryLootHtml(loot){return `<div class="stolen-pokemon-banner"><span>POKÉMON STOLEN</span><div>${loot.map(id=>`<div>${pokeArt(id,true)}<b>#${String(id).padStart(3,'0')} ${esc(pokemon(id).name)}</b></div>`).join('')||'<small>No new Pokémon this time.</small>'}</div></div>`}

  function openDex(){const p=cache,owned=uniq(p.owned_pokemon).sort((a,b)=>a-b),party=uniq(p.active_party),complete=owned.length>=151;openModal(`<div class="boss-modal-head"><span class="boss-alert">GYMDEX</span><button data-close>×</button></div><h3>${owned.length}/151 POKÉMON STOLEN</h3><p>${complete?'GYMDEX COMPLETE. You stole all 151.':'Beat Gym Leaders and steal every Pokémon.'}</p><div class="party-editor"><div><span>ACTIVE PARTY</span><strong>${party.length}/6 · +${partyBonusPct(party)}% DMG</strong><small>Normal: +2%. STRONG adds +3%. ELITE adds +5% on top.</small></div><div class="party-six">${party.map(id=>`<button data-remove="${id}">${pokeArt(id,true)}<b>×</b></button>`).join('')}${Array.from({length:6-party.length},()=>'<i>+</i>').join('')}</div></div><div class="gymdex-grid">${owned.length?owned.map(id=>{const pkm=pokemon(id),inParty=party.includes(id);return`<div class="dex-card pokemon-card ${inParty?'in-party':''}">${pokeArt(id)}<strong>#${String(id).padStart(3,'0')} ${esc(pkm.name)}</strong><button data-toggle="${id}">${inParty?'IN PARTY ✓':'ADD TO PARTY'}</button></div>`}).join(''):'<div class="no-loot">No Pokémon stolen yet.</div>'}</div>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal);document.querySelectorAll('[data-remove]').forEach(x=>x.addEventListener('click',()=>setParty(party.filter(n=>n!==Number(x.dataset.remove)))));document.querySelectorAll('[data-toggle]').forEach(x=>x.addEventListener('click',()=>toggleParty(Number(x.dataset.toggle))));bindFallback(document.getElementById('bossOverlay'))}
  async function setParty(next){cache=await persistPlayer({...cache,active_party:uniq(next).slice(0,6)});renderGym();openDex()}
  async function toggleParty(id){const party=uniq(cache.active_party);if(party.includes(id))return setParty(party.filter(n=>n!==id));if(party.length<6)return setParty([...party,id]);openReplaceParty(id)}
  function openReplaceParty(addId){const party=uniq(cache.active_party);openModal(`<div class="boss-modal-head"><span class="boss-alert">PARTY FULL 6/6</span><button data-close>×</button></div><h3>SWAP IN ${esc(pokemon(addId).name.toUpperCase())}</h3><p>Choose who leaves the party.</p><div class="replace-party">${party.map(id=>`<button data-replace-party="${id}">${pokeArt(id)}<span>#${String(id).padStart(3,'0')} ${esc(pokemon(id).name)}</span><b>SWAP</b></button>`).join('')}</div>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal);document.querySelectorAll('[data-replace-party]').forEach(x=>x.addEventListener('click',()=>setParty(party.map(n=>n===Number(x.dataset.replaceParty)?addId:n))));bindFallback(document.getElementById('bossOverlay'))}
  function openLeaders(){const seen=uniq(cache.seen_leaders),def=uniq(cache.defeated_leaders);openModal(`<div class="boss-modal-head"><span class="boss-alert">GYM LEADERS</span><button data-close>×</button></div><h3>${def.length}/8 STORY LEADERS DEFEATED</h3><p>Every player completes their own story. Leaders stay hidden until your first encounter.</p><div class="leader-grid">${LEADERS.map((l,i)=>{const met=seen.includes(i),won=def.includes(i);return`<div class="leader-card ${won?'won':''}">${leaderArt(l,!met)}<strong>${met?esc(l.name):'???'}</strong><small>${won?'DEFEATED ✓':met?'ENCOUNTERED':'NOT ENCOUNTERED'}</small></div>`}).join('')}</div>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal)}
  function openAttacks(){const p=cache;if(p.pending_attack&&MOVES[p.pending_attack])return openPendingAttack();const moves=(p.attacks||['basic']).map(id=>MOVES[id]).filter(Boolean);openModal(`<div class="boss-modal-head"><span class="boss-alert">ATTACK LOADOUT</span><button data-close>×</button></div><h3>${moves.length}/3 ATTACKS</h3><p>Each rewarded workout earns one attack against your personal Gym Leader.</p><div class="boss-move-list">${moves.map(m=>`<div class="boss-move"><span>${m.icon}</span><div><strong>${m.name}</strong><small>${m.rarity} · ${typeLabel(m.type)} · ${m.power} BASE</small></div><b>EQUIPPED</b></div>`).join('')}</div>${Array.from({length:3-moves.length},()=>'<div class="empty-move">🔒 EMPTY ATTACK SLOT</div>').join('')}`);document.querySelector('[data-close]')?.addEventListener('click',closeModal)}
  function openPendingAttack(){const id=cache.pending_attack,m=MOVES[id],moves=(cache.attacks||['basic']).map(x=>MOVES[x]).filter(Boolean);openModal(`<div class="boss-modal-head"><span class="boss-alert">NEW ATTACK FOUND!</span><button data-close>×</button></div><h3>${m.icon} ${m.name}</h3><p>${m.rarity} · ${typeLabel(m.type)} · ${m.power} BASE</p><div class="boss-move-list">${moves.map(x=>`<button class="boss-move" data-replace="${x.id}"><span>${x.icon}</span><div><strong>${x.name}</strong><small>${x.power} BASE</small></div><b>REPLACE</b></button>`).join('')}</div><button class="boss-secondary wide" data-discard>DISCARD</button>`);document.querySelector('[data-close]')?.addEventListener('click',closeModal);document.querySelector('[data-discard]')?.addEventListener('click',async()=>{cache=await persistPlayer({...cache,pending_attack:null});closeModal();renderGym()});document.querySelectorAll('[data-replace]').forEach(x=>x.addEventListener('click',async()=>{cache=await persistPlayer({...cache,attacks:(cache.attacks||[]).map(a=>a===x.dataset.replace?id:a),pending_attack:null});closeModal();renderGym()}))}

  window.renderGymLeader=renderGym;window.refreshGymLeader=refreshGym;window.startGymAttack=attackReady;
  const onWorkout=d=>{
    scheduleRefresh(0);
    const reward=window.consumeWorkoutRewardClaim?.(d);
    if(reward&&reward.eligible===false){if(typeof toast==='function')toast('Økt registrert · dagens goodies er allerede mottatt');return}
    const lvl=levelFor(activeName());if(lvl<3)return;
    const levelUp=Number(d?.levelAfter||lvl)>Number(d?.levelBefore||lvl),delay=TEST_MODE?(levelUp?1200:350):(levelUp?7800:800);
    setTimeout(async()=>{await refreshGym();if(cache&&!cache.leader_defeated)attackReady({...d,person:d?.person||activeName(),type:d?.type||'strength',levelAfter:lvl})},delay)
  };
  window.addEventListener('obd-workout-added',e=>{if(!TEST_MODE)onWorkout(e.detail||{})});
  window.addEventListener('obd-gym-test-workout',e=>{if(TEST_MODE)onWorkout(e.detail||{})});
  window.addEventListener('obd-player-changed',()=>{closeModal();cache=null;scheduleRefresh(0)});window.addEventListener('obd-auth-ready',()=>{cache=null;scheduleRefresh(0)});window.addEventListener('obd-battle-changed',()=>{if(cache)renderGym()});window.addEventListener('pageshow',()=>scheduleRefresh(0));document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleRefresh(0)});
  [0,250,750,1500,3000].forEach(ms=>setTimeout(()=>scheduleRefresh(0),ms));setInterval(()=>scheduleRefresh(0),15000);
})();