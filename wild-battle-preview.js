(()=>{
  if(!window.__OBD_PREVIEW__||window.__obdWildBattlePreview)return;
  window.__obdWildBattlePreview=true;

  const upstreamFetch=window.fetch.bind(window);
  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const PIN='1337';
  const STRONG_IDS=new Set([3,9,26,131,143,148,95,94,93,92,135,133,59,34,31,130,144,145,146,123,141,25,6]);
  const ELITE_IDS=new Set([149,150,151]);
  const PLAYER_MAX_HP=150;
  const MOVES={
    basic:{id:'basic',name:'BASIC STRIKE',power:205,accuracy:.97,crit:.06,icon:'✊'},
    iron:{id:'iron',name:'IRON COMET',power:240,accuracy:.94,crit:.08,icon:'💪'},
    redline:{id:'redline',name:'REDLINE',power:235,accuracy:.95,crit:.08,icon:'⚡'},
    grit:{id:'grit',name:'GRIT CRUSH',power:225,accuracy:.96,crit:.08,icon:'☠'},
    haymaker:{id:'haymaker',name:'HAYMAKER',power:275,accuracy:.88,crit:.16,icon:'🥊'},
    afterburn:{id:'afterburn',name:'AFTERBURN',power:265,accuracy:.91,crit:.13,icon:'🔥'},
    warcry:{id:'warcry',name:'WAR DOG',power:255,accuracy:.92,crit:.28,icon:'🐺'},
    execution:{id:'execution',name:'EXECUTION',power:300,accuracy:.84,crit:.18,icon:'⚔️'},
    hold:{id:'hold',name:'HOLD BACK',power:150,accuracy:1,crit:0,icon:'✋',safe:true}
  };
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rand=(min,max)=>Math.floor(min+Math.random()*(max-min+1));
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const pokemon=id=>window.getPokemon?.(Number(id))||{id:Number(id),name:`#${String(id).padStart(3,'0')}`,image:`dex-png/${id}.png`};
  const inFlight=new Map();

  function rarity(id){return ELITE_IDS.has(Number(id))?'ELITE':STRONG_IDS.has(Number(id))?'STRONG':'WILD'}
  function rarityPenalty(id){return ELITE_IDS.has(Number(id))?.12:STRONG_IDS.has(Number(id))?.06:0}
  function catchChance(base,hpRatio,turns,mode,pokemonId){
    const penalty=rarityPenalty(pokemonId),safeBase=clamp(Number(base)||.5,.25,1);
    if(mode==='auto')return clamp(safeBase*.72-penalty,.30,.78);
    const turnBonus=Math.min(8,Math.max(0,Number(turns)||0))*.005;
    return clamp(safeBase*.72-penalty+(1-clamp(hpRatio,0,1))*.48+turnBonus,.30,.95);
  }
  function moveProfile(move){
    if(move.safe)return{min:10,max:15,accuracy:1,crit:0};
    const scale=clamp((Number(move.power||205)-205)/95,0,1);
    return{min:17+Math.round(scale*9),max:25+Math.round(scale*13),accuracy:move.accuracy??.94,crit:move.crit??.08};
  }
  function chosenMoves(attacks){
    const list=(Array.isArray(attacks)?attacks:[]).map(id=>MOVES[String(id)]).filter(Boolean).slice(0,3);
    if(!list.length)list.push(MOVES.basic);
    if(list.length<3)list.push(MOVES.hold);
    return list.slice(0,3);
  }
  function combatProfile(pokemonId){
    const id=Math.max(1,Number(pokemonId)||1);
    const bulk=((id*37+11)%101)/100;
    const offense=((id*53+29)%101)/100;
    if(ELITE_IDS.has(id))return{tier:'ELITE',maxHp:165+Math.round(bulk*40),minDamage:25+Math.round(offense*5),maxDamage:34+Math.round(offense*7),accuracy:.94+offense*.03};
    if(STRONG_IDS.has(id))return{tier:'STRONG',maxHp:130+Math.round(bulk*35),minDamage:20+Math.round(offense*5),maxDamage:28+Math.round(offense*6),accuracy:.92+offense*.04};
    return{tier:'WILD',maxHp:90+Math.round(bulk*35),minDamage:14+Math.round(offense*6),maxDamage:21+Math.round(offense*7),accuracy:.89+offense*.06};
  }
  function enemyAttack(profile){
    if(Math.random()>profile.accuracy)return{hit:false,damage:0,crit:false};
    const crit=Math.random()<(profile.tier==='ELITE'?.12:profile.tier==='STRONG'?.08:.05);
    const raw=rand(profile.minDamage,profile.maxDamage);
    return{hit:true,crit,damage:crit?Math.round(raw*1.2):raw};
  }

  function ensureStyles(){
    if(document.getElementById('wildBattlePreviewStyles'))return;
    const s=document.createElement('style');s.id='wildBattlePreviewStyles';s.textContent=`
      .wbp-overlay{position:fixed;inset:0;z-index:420;display:grid;place-items:center;padding:12px;background:rgba(2,5,8,.92);backdrop-filter:blur(8px)}
      .wbp-card{width:min(100%,430px);max-height:92vh;overflow:auto;border:1px solid rgba(255,218,92,.28);border-radius:22px;background:linear-gradient(155deg,#101c27,#050a0f 76%);box-shadow:0 28px 90px rgba(0,0,0,.75);color:#fff;padding:16px;box-sizing:border-box}
      .wbp-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.wbp-kicker{font-size:9px;font-weight:1000;letter-spacing:.17em;color:#ffd85f}.wbp-turn{font-size:8px;font-weight:950;color:#7f94a6}
      .wbp-stage{display:grid;grid-template-columns:112px minmax(0,1fr);gap:13px;align-items:center;margin-top:8px}.wbp-art{width:112px;height:112px;display:grid;place-items:center;border-radius:20px;background:radial-gradient(circle,rgba(255,255,255,.09),transparent 68%)}.wbp-art img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 8px rgba(0,0,0,.5))}.wbp-name small{display:block;color:#758a9c;font-size:8px;font-weight:900}.wbp-name strong{display:block;font-size:23px;line-height:1.05}.wbp-hp-label{display:flex;justify-content:space-between;margin-top:9px;font-size:8px;font-weight:1000;color:#91a6b8}.wbp-hp{height:9px;margin-top:4px;border-radius:999px;background:#061018;overflow:hidden;border:1px solid rgba(255,255,255,.06)}.wbp-hp i{display:block;height:100%;width:100%;border-radius:inherit;background:linear-gradient(90deg,#4adc8a,#9be35c);transition:width .28s ease}.wbp-hp.danger i{background:linear-gradient(90deg,#ff4c5d,#ff9c45)}
      .wbp-player{margin-top:11px;padding:9px 10px;border-radius:12px;background:#08131c;border:1px solid rgba(255,255,255,.06)}.wbp-player .wbp-hp-label{margin-top:0}.wbp-log{min-height:34px;margin-top:10px;padding:8px 10px;border-radius:10px;background:#071018;color:#b6c6d3;font-size:9px;font-weight:850;line-height:1.45}.wbp-catch{margin-top:9px;text-align:center;color:#8fa5b6;font-size:9px;font-weight:900}.wbp-catch b{color:#ffd85f;font-size:16px;margin-left:4px}.wbp-moves{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px}.wbp-move{min-height:48px;padding:7px 5px;border:1px solid rgba(92,182,255,.18);border-radius:11px;background:#0a1823;color:#fff;font-size:8px;font-weight:1000;cursor:pointer}.wbp-move small{display:block;margin-top:3px;color:#7390a6;font-size:6px}.wbp-move:disabled{opacity:.42;cursor:default}.wbp-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.wbp-ball,.wbp-auto,.wbp-ok{min-height:44px;border-radius:12px;font-weight:1000;cursor:pointer}.wbp-ball{border:0;background:linear-gradient(135deg,#ff354c,#ff8844);color:white}.wbp-auto{border:1px solid rgba(255,255,255,.09);background:#0a141d;color:#91a7b8}.wbp-note{margin-top:8px;text-align:center;color:#607687;font-size:7px;font-weight:850}.wbp-impact .wbp-art{animation:wbpHit .28s ease}@keyframes wbpHit{35%{transform:translateX(5px)}70%{transform:translateX(-4px)}}
      .wbp-result{text-align:center;padding:5px 2px 2px}.wbp-result .wbp-art{margin:4px auto 10px}.wbp-result h2{margin:4px 0 6px;font-size:26px}.wbp-result p{margin:0;color:#91a6b8;font-size:10px;line-height:1.45}.wbp-result-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}.wbp-result-grid div{padding:8px 5px;border-radius:10px;background:#07131c;border:1px solid rgba(255,255,255,.06)}.wbp-result-grid small{display:block;color:#6f8799;font-size:6px;font-weight:900}.wbp-result-grid b{display:block;margin-top:2px;font-size:11px}.wbp-ok{width:100%;margin-top:12px;border:0;background:linear-gradient(135deg,#36b9ff,#586cff);color:#fff}.wbp-result.caught h2{color:#7cf0a7}.wbp-result.lost h2{color:#ff6977}
      @media(max-width:390px){.wbp-stage{grid-template-columns:88px minmax(0,1fr)}.wbp-art{width:88px;height:88px}.wbp-name strong{font-size:20px}.wbp-moves{grid-template-columns:1fr}.wbp-move{min-height:40px}.wbp-actions{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }
  function ensureOverlay(){
    ensureStyles();let o=document.getElementById('wildBattlePreviewOverlay');if(o)return o;
    o=document.createElement('div');o.id='wildBattlePreviewOverlay';o.className='wbp-overlay';o.hidden=true;o.innerHTML='<div class="wbp-card" id="wildBattlePreviewCard" role="dialog" aria-modal="true"></div>';document.body.appendChild(o);return o;
  }
  function closeBattle(){const o=document.getElementById('wildBattlePreviewOverlay');if(o)o.hidden=true;document.body.classList.remove('obd-modal-open')}
  function openBattle(html){const o=ensureOverlay(),c=document.getElementById('wildBattlePreviewCard');c.innerHTML=html;o.hidden=false;document.body.classList.add('obd-modal-open')}

  async function postGym(payload){
    const r=await upstreamFetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,pin:PIN})});
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!r.ok)throw new Error(data.error||text||'Gym sync failed');return data;
  }
  async function contextFor(body){
    const base={player_id:body.player_id,level:body.level};
    const [gym,wild]=await Promise.all([postGym({...base,action:'get'}),postGym({...base,action:'wild_status'})]);
    const pokemonId=Number(wild?.wild?.pokemon_id||0),p=pokemon(pokemonId);
    if(!pokemonId)throw new Error('Wild Pokémon is no longer active');
    return{pokemonId,p,baseChance:Number(wild?.benefits?.tiers?.power?.effective_catch)||.5,powerLabel:wild?.benefits?.tiers?.power?.label||'LOW',moves:chosenMoves(gym?.player?.attacks),profile:combatProfile(pokemonId)};
  }

  function battleHtml(state){
    const wildPct=Math.max(0,Math.round(state.wildHp/state.profile.maxHp*100)),playerPct=Math.max(0,Math.round(state.playerHp/state.playerMaxHp*100)),hpRatio=state.wildHp/state.profile.maxHp;
    const manual=catchChance(state.baseChance,hpRatio,state.turns,'battle',state.pokemonId),auto=catchChance(state.baseChance,1,0,'auto',state.pokemonId),locked=state.busy||state.wildHp<=0||state.playerHp<=0;
    return `<div class="wbp-top"><span class="wbp-kicker">WILD ENCOUNTER · PREVIEW</span><span class="wbp-turn">TURN ${state.turns+1} · ${state.profile.tier}</span></div>
      <div class="wbp-stage"><div class="wbp-art"><img src="${state.p.image}" alt="${esc(state.p.name)}"></div><div class="wbp-name"><small>#${String(state.pokemonId).padStart(3,'0')} · POWER ${esc(state.powerLabel)}</small><strong>${esc(state.p.name)}</strong><div class="wbp-hp-label"><span>WILD HP</span><span>${Math.round(state.wildHp)} / ${state.profile.maxHp}</span></div><div class="wbp-hp ${wildPct<=25?'danger':''}"><i style="width:${wildPct}%"></i></div></div></div>
      <div class="wbp-player"><div class="wbp-hp-label"><span>YOUR HP</span><span>${Math.round(state.playerHp)} / ${state.playerMaxHp}</span></div><div class="wbp-hp ${playerPct<=25?'danger':''}"><i style="width:${playerPct}%"></i></div></div>
      <div class="wbp-log">${esc(state.log||`${state.profile.tier==='WILD'?'This Pokémon has its own HP and damage profile.':'Strong Pokémon have more HP and hit harder.'} Weaken it, throw a Poké Ball, or keep fighting until one side faints.`)}</div>
      <div class="wbp-catch">CURRENT CATCH CHANCE <b>${Math.round(manual*100)}%</b></div>
      <div class="wbp-moves">${state.moves.map(m=>{const q=moveProfile(m);return `<button type="button" class="wbp-move" data-wbp-move="${esc(m.id)}" ${locked?'disabled':''}>${m.icon||'◆'} ${esc(m.name)}<small>${q.min}–${q.max} DMG · ${Math.round(q.accuracy*100)}% HIT</small></button>`}).join('')}</div>
      <div class="wbp-actions"><button type="button" class="wbp-ball" data-wbp-ball ${locked?'disabled':''}>◉ THROW POKÉ BALL · ${Math.round(manual*100)}%</button><button type="button" class="wbp-auto" data-wbp-auto ${state.busy?'disabled':''}>SKIP · AUTO ${Math.round(auto*100)}%</button></div>
      <div class="wbp-note">No turn limit. Battle ends only when you throw, skip, or either side faints.</div>`;
  }

  function showState(state){
    openBattle(battleHtml(state));
    document.querySelectorAll('[data-wbp-move]').forEach(btn=>btn.addEventListener('click',()=>attack(state,String(btn.dataset.wbpMove)),{once:true}));
    document.querySelector('[data-wbp-ball]')?.addEventListener('click',()=>state.resolve?.('battle'),{once:true});
    document.querySelector('[data-wbp-auto]')?.addEventListener('click',()=>state.resolve?.('auto'),{once:true});
  }

  async function attack(state,moveId){
    if(state.busy||state.wildHp<=0||state.playerHp<=0)return;
    const move=state.moves.find(m=>m.id===moveId)||MOVES.basic,q=moveProfile(move);state.busy=true;state.turns++;
    const hit=Math.random()<q.accuracy,crit=hit&&Math.random()<q.crit,raw=hit?rand(q.min,q.max):0,damage=crit?Math.round(raw*1.25):raw;
    state.log=hit?`${move.name}${crit?' CRITICAL HIT!':''} dealt ${damage} damage.`:`${move.name} missed!`;showState(state);await wait(210);
    if(hit){state.wildHp=Math.max(0,state.wildHp-damage);document.getElementById('wildBattlePreviewCard')?.classList.add('wbp-impact');try{navigator.vibrate?.(crit?[35,25,55]:25)}catch{};await wait(190)}
    if(state.wildHp<=0){state.busy=false;state.log=`${state.p.name} fainted. It cannot be caught.`;showState(state);await wait(420);return state.resolve?.('fainted')}
    const counter=enemyAttack(state.profile);
    if(counter.hit){state.playerHp=Math.max(0,state.playerHp-counter.damage);state.log+=` ${state.p.name}${counter.crit?' landed a critical hit and':''} hit back for ${counter.damage}.`}
    else state.log+=` ${state.p.name} attacked but missed.`;
    if(state.playerHp<=0){state.busy=false;showState(state);await wait(420);return state.resolve?.('player_fainted')}
    state.busy=false;showState(state);
  }

  function resultHtml(state,data,mode){
    const fainted=!!data.fainted,playerFainted=!!data.player_fainted,success=!!data.success;
    const cls=success?'caught':'lost';
    const title=fainted?'WILD POKÉMON FAINTED':playerFainted?'YOU FAINTED':success?'CAUGHT!':'POKÉMON BROKE FREE!';
    const sub=fainted?`${state.p.name} was knocked out and cannot be caught.`:playerFainted?`${state.p.name} escaped after knocking you out.`:success?`${state.p.name} was added to your GymDex.`:mode==='auto'?`Auto catch failed. ${state.p.name} got away.`:`The Poké Ball failed. ${state.p.name} got away.`;
    const chance=Math.round((Number(data.catch_chance)||0)*100);
    const wildHp=Math.max(0,Math.round(state.wildHp));
    const yourHp=Math.max(0,Math.round(state.playerHp));
    return `<div class="wbp-result ${cls}"><span class="wbp-kicker">BATTLE RESULT</span><div class="wbp-art"><img src="${state.p.image}" alt="${esc(state.p.name)}"></div><h2>${esc(title)}</h2><p>${esc(sub)}</p><div class="wbp-result-grid"><div><small>ATTACKS</small><b>${state.turns}</b></div><div><small>FINAL CATCH</small><b>${chance}%</b></div><div><small>HP LEFT</small><b>${wildHp} / ${yourHp}</b></div></div><button type="button" class="wbp-ok" data-wbp-ok>OK</button></div>`;
  }
  function showResult(state,data,mode){
    return new Promise(resolve=>{
      openBattle(resultHtml(state,data,mode));
      document.querySelector('[data-wbp-ok]')?.addEventListener('click',()=>{closeBattle();resolve()},{once:true});
      try{navigator.vibrate?.(data.success?[40,30,80]:data.fainted||data.player_fainted?[70,35,70]:[35,35,35])}catch{}
    });
  }

  function encounter(input,init,body){
    return new Promise(async(resolve,reject)=>{
      let ctx;try{ctx=await contextFor(body)}catch(error){return reject(error)}
      const state={...ctx,wildHp:ctx.profile.maxHp,playerHp:PLAYER_MAX_HP,playerMaxHp:PLAYER_MAX_HP,turns:0,busy:false,log:'',moves:ctx.moves};
      let finished=false;
      state.resolve=async mode=>{
        if(finished)return;finished=true;state.busy=true;showState(state);
        const resolution=mode==='auto'?'auto':'battle',fainted=mode==='fainted',playerFainted=mode==='player_fainted',hpRatio=fainted?0:clamp(state.wildHp/state.profile.maxHp,.001,1);
        try{
          const nextBody={...body,resolution,hp_ratio:resolution==='auto'?1:hpRatio,turns:resolution==='auto'?0:state.turns,fainted,player_fainted:playerFainted};
          const response=await upstreamFetch(input,{...init,body:JSON.stringify(nextBody)}),copy=response.clone();let data={};try{data=await copy.json()}catch{}
          if(!response.ok)throw new Error(data.error||'Could not resolve catch');
          await showResult(state,data,resolution);
          const muted={...data,attempted:false,battle_resolved:true};
          resolve(new Response(JSON.stringify(muted),{status:response.status,headers:{'Content-Type':'application/json'}}));
          setTimeout(()=>window.dispatchEvent(new Event('pageshow')),250);
        }catch(error){finished=false;state.busy=false;state.log=String(error?.message||'Could not resolve catch. Try again.');showState(state)}
      };
      showState(state);
    });
  }

  window.fetch=function(input,init){
    try{
      const url=typeof input==='string'?input:String(input?.url||''),body=init?.body&&typeof init.body==='string'?JSON.parse(init.body):null;
      const isWildAttempt=body?.action==='wild_attempt'&&(url.includes('/functions/v1/wild-attempt')||url.includes('/functions/v1/gym-game'));
      if(isWildAttempt&&body?.workout_id){
        const key=`${body.player_id||''}:${body.workout_id}`;
        if(!inFlight.has(key))inFlight.set(key,encounter(input,init,body).finally(()=>setTimeout(()=>inFlight.delete(key),3000)));
        return inFlight.get(key).then(r=>r.clone());
      }
    }catch(error){console.warn('Wild battle preview intercept failed',error)}
    return upstreamFetch(input,init);
  };
  window.fetch.__obdWildBattlePreview=true;

  const patchObserver=new MutationObserver(()=>{
    const power=document.querySelector('#wildPokemonBlock .wild-power');
    if(power&&!power.dataset.wbpCopy){const label=power.querySelector('b')?.textContent||'LOW';power.dataset.wbpCopy='1';power.innerHTML=`POWER <b>${esc(label)}</b> · <b>BATTLE</b> improves catch chance`}
  });
  const startObserver=()=>{if(document.body)patchObserver.observe(document.body,{childList:true,subtree:true})};
  if(document.body)startObserver();else document.addEventListener('DOMContentLoaded',startObserver,{once:true});
})();
