(()=>{
  if(new URLSearchParams(location.search).get('bossTest')!=='1'||window.__obdGymXpTest)return;
  window.__obdGymXpTest=true;

  const XP_KEY='obd_gym_test_xp_v1';
  const GYM_KEY='obd_gym_test_v4';
  const MAX_TEST_XP=92;
  const RANKS_FALLBACK=['Couch Recruit','Rep Collector','Hemorrhoid Pumper','Protein Junkie','Pump Chaser','Iron Disciple','Disciplined Lifter','Big Dawg','Meat Machine','Gym Warlord'];
  let lastPlayer='';

  const playerId=()=>window.getSelectedPlayerId?.()||'test-player';
  const playerName=()=>window.getSelectedPlayer?.()||'TEST PLAYER';
  const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}return value};
  const levelFromXp=xp=>Math.min(10,Math.floor(Math.max(0,Number(xp)||0)/10)+1);
  const rankFor=level=>{try{return typeof RANKS!=='undefined'&&RANKS[level-1]?RANKS[level-1]:RANKS_FALLBACK[level-1]}catch{return RANKS_FALLBACK[level-1]}};

  function xpMap(){return readJson(XP_KEY,{players:{}})}
  function testPlayer(){
    const map=xpMap(),id=playerId();map.players=map.players||{};
    map.players[id]=map.players[id]||{xp:0,lootCycle:0};
    writeJson(XP_KEY,map);return map.players[id];
  }
  function saveTestPlayer(next){const map=xpMap(),id=playerId();map.players=map.players||{};map.players[id]=next;writeJson(XP_KEY,map);return next}
  function testLevel(){return levelFromXp(testPlayer().xp)}
  window.getGymTestXp=()=>Number(testPlayer().xp)||0;
  window.getGymTestLevel=testLevel;

  function addStyle(){
    if(document.getElementById('gymTestXpStyle'))return;
    const s=document.createElement('style');s.id='gymTestXpStyle';s.textContent=`
      .gym-test-xp{margin:10px 0 8px;padding:10px 11px;border:1px dashed rgba(250,204,21,.4);border-radius:15px;background:linear-gradient(145deg,rgba(37,29,6,.94),rgba(12,16,22,.96));box-shadow:inset 0 0 24px rgba(250,204,21,.035)}
      .gym-test-xp-head,.gym-test-xp-row,.gym-test-xp-meta{display:flex;align-items:center;justify-content:space-between;gap:8px}.gym-test-xp-head span{font-size:8px;font-weight:1000;letter-spacing:.14em;color:#facc15}.gym-test-xp-head b{font-size:7px;color:#8b96a3}.gym-test-xp-row{margin-top:8px}.gym-test-xp-stat{min-width:58px}.gym-test-xp-stat small{display:block;font-size:6px;color:#7d8b98;font-weight:900}.gym-test-xp-stat strong{display:block;margin-top:1px;font-size:15px;color:#fff}.gym-test-xp-add,.gym-test-xp-reset{border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 10px;font-size:8px;font-weight:1000;cursor:pointer}.gym-test-xp-add{background:linear-gradient(135deg,#eab308,#f97316);color:#150f02;box-shadow:0 5px 18px rgba(234,179,8,.18)}.gym-test-xp-add:disabled{filter:grayscale(1);opacity:.45;cursor:not-allowed}.gym-test-xp-reset{background:#101821;color:#81909d}.gym-test-xp-track{height:6px;margin-top:8px;border-radius:99px;background:#1a2027;overflow:hidden}.gym-test-xp-track i{display:block;height:100%;background:linear-gradient(90deg,#eab308,#fb923c);border-radius:inherit;transition:.25s}.gym-test-xp-meta{margin-top:6px;font-size:7px;color:#81909d}.gym-test-xp-meta b{color:#e5e7eb}.gym-test-xp-note{margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.05);font-size:7px;line-height:1.4;color:#a7b0b8}.gym-test-xp-note strong{color:#facc15}@media(max-width:390px){.gym-test-xp-row{flex-wrap:wrap}.gym-test-xp-add{flex:1}.gym-test-xp-reset{padding:8px}}
    `;document.head.appendChild(s);
  }

  function ensureControls(){
    addStyle();let el=document.getElementById('gymTestXpControls');
    if(!el){el=document.createElement('section');el.id='gymTestXpControls';el.className='gym-test-xp';const reward=document.getElementById('rewardEngine');if(reward?.parentNode)reward.insertAdjacentElement('afterend',el);else document.querySelector('.app-shell')?.prepend(el)}
    return el;
  }

  function progressInfo(xp,level){
    if(level>=10)return{pct:100,text:'MAX LEVEL'};
    const floor=(level-1)*10,next=level*10,pct=Math.max(0,Math.min(100,(xp-floor)/(next-floor)*100));
    return{pct,text:`${Math.max(0,next-xp)} XP TO LEVEL ${level+1}`};
  }

  function renderControls(){
    const p=testPlayer(),xp=Math.max(0,Number(p.xp)||0),level=levelFromXp(xp),prog=progressInfo(xp,level),el=ensureControls();
    const note=level<3?'<strong>GYM LOCKED</strong> · Reach Level 3 to reveal Brock.':level<8?'<strong>GYM ACTIVE</strong> · #149 Dragonite, #150 Mewtwo and #151 Mew stay locked until Level 8.':level<10?'<strong>LEGENDARIES UNLOCKED</strong> · #149–151 may now appear in new Gym Leader loot.':'<strong>LEVEL 10 REACHED</strong> · Continue fighting Gym Leaders and building the GymDex.';
    el.innerHTML=`<div class="gym-test-xp-head"><span>TEST PROGRESSION</span><b>LOCAL ONLY · REAL DATA UNTOUCHED</b></div><div class="gym-test-xp-row"><div class="gym-test-xp-stat"><small>LEVEL</small><strong>${level}/10</strong></div><div class="gym-test-xp-stat"><small>TEST XP</small><strong>${xp}</strong></div><div class="gym-test-xp-stat"><small>RANK</small><strong style="font-size:9px">${rankFor(level)}</strong></div><button class="gym-test-xp-add" data-gym-add-xp ${xp>=MAX_TEST_XP?'disabled':''}>+4 XP</button><button class="gym-test-xp-reset" data-gym-reset>RESET</button></div><div class="gym-test-xp-track"><i style="width:${prog.pct}%"></i></div><div class="gym-test-xp-meta"><span>${prog.text}</span><b>0 → 92 TEST XP</b></div><div class="gym-test-xp-note">${note}</div>`;
    el.querySelector('[data-gym-add-xp]')?.addEventListener('click',addFourXp);el.querySelector('[data-gym-reset]')?.addEventListener('click',resetTest);
    applyGymGate();
  }

  function applyGymGate(){
    const block=document.getElementById('weeklyBoss');if(!block)return;
    if(testLevel()<3){block.style.setProperty('display','none','important')}else block.style.removeProperty('display');
  }

  function showLevelUp(from,to){
    const name=playerName();
    try{if(typeof showEvolution==='function'&&name!=='TEST PLAYER'){setTimeout(()=>showEvolution(name,from,to),120);return}}catch{}
    const msg=`TEST LEVEL ${to} · ${rankFor(to)}`;if(typeof toast==='function')toast(msg);
  }

  function addFourXp(){
    const old=testPlayer(),beforeXp=Number(old.xp)||0,before=levelFromXp(beforeXp),afterXp=Math.min(MAX_TEST_XP,beforeXp+4),after=levelFromXp(afterXp);
    saveTestPlayer({...old,xp:afterXp});renderControls();
    if(after>before){showLevelUp(before,after);if(typeof toast==='function'){if(after===3)setTimeout(()=>toast('GYM LEADERS UNLOCKED'),550);else if(after===8)setTimeout(()=>toast('#149–151 UNLOCKED'),550)}}
    if(after>=3)window.refreshGymLeader?.();
  }

  function resetTest(){
    if(!confirm('Reset all LOCAL Gym test XP, Gym Leaders and stolen Pokémon? Real player data is not touched.'))return;
    try{localStorage.removeItem(XP_KEY);localStorage.removeItem(GYM_KEY)}catch{}
    renderControls();applyGymGate();setTimeout(()=>window.refreshGymLeader?.(),80);
    if(typeof toast==='function')toast('Local Gym test reset');
  }

  const random=n=>Math.floor(Math.random()*n);
  function lootCount(){const r=random(100);return r<15?1:r<50?2:r<85?3:4}
  function sample(arr,n){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=random(i+1);[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)}
  function enforceLootForCycle(){
    const gym=readJson(GYM_KEY,null);if(!gym?.global||!gym.players)return false;
    const id=playerId(),gp=gym.players[id];if(!gp)return false;
    const cycle=Number(gp.current_cycle||gym.global.cycle||0);if(!cycle)return false;
    const xpState=testPlayer();if(Number(xpState.lootCycle)===cycle)return false;
    const owned=[...new Set((gp.owned_pokemon||[]).map(Number).filter(n=>n>=1&&n<=151))],level=levelFromXp(xpState.xp),complete=owned.length>=151,max=level>=8?151:148;
    const pool=complete?Array.from({length:151},(_,i)=>i+1):Array.from({length:max},(_,i)=>i+1).filter(n=>!owned.includes(n));
    gp.current_loot=pool.length?sample(pool,Math.min(lootCount(),pool.length)):[];
    gym.players[id]=gp;writeJson(GYM_KEY,gym);saveTestPlayer({...xpState,lootCycle:cycle});return true;
  }

  function sync(){
    const id=playerId();if(id!==lastPlayer){lastPlayer=id;renderControls()}
    ensureControls();applyGymGate();
    if(testLevel()>=3&&enforceLootForCycle())setTimeout(()=>window.refreshGymLeader?.(),20);
  }

  function boot(){
    renderControls();
    if(typeof window.refreshGymLeader==='function'){sync();setInterval(sync,350);return}
    setTimeout(boot,80);
  }
  boot();
})();
