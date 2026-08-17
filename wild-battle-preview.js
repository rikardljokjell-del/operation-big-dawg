(()=>{
  if(!window.__OBD_PREVIEW__||window.__obdWildBattlePreview)return;
  window.__obdWildBattlePreview=true;

  const upstreamFetch=window.fetch.bind(window);
  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const PIN='1337';
  const STRONG_IDS=new Set([3,9,26,131,143,148,95,94,93,92,135,133,59,34,31,130,144,145,146,123,141,25,6]);
  const ELITE_IDS=new Set([149,150,151]);
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
  let lastResultMeta=null;
  const inFlight=new Map();

  function rarityPenalty(id){return ELITE_IDS.has(Number(id))?.12:STRONG_IDS.has(Number(id))?.06:0}
  function catchChance(base,hpRatio,turns,mode,pokemonId){
    const penalty=rarityPenalty(pokemonId),safeBase=clamp(Number(base)||.5,.25,1);
    if(mode==='auto')return clamp(safeBase*.72-penalty,.30,.78);
    return clamp(safeBase*.72-penalty+(1-clamp(hpRatio,0,1))*.48+Math.min(3,Math.max(0,turns))*.015,.30,.95);
  }
  function moveProfile(move){
    if(move.safe)return{min:11,max:17,accuracy:1,crit:0};
    const scale=clamp((Number(move.power||205)-205)/95,0,1);
    return{min:18+Math.round(scale*10),max:27+Math.round(scale*12),accuracy:move.accuracy??.94,crit:move.crit??.08};
  }
  function chosenMoves(attacks){
    const list=(Array.isArray(attacks)?attacks:[]).map(id=>MOVES[String(id)]).filter(Boolean).slice(0,3);
    if(!list.length)list.push(MOVES.basic);
    if(list.length<3)list.push(MOVES.hold);
    return list.slice(0,3);
  }
  function enemyDamage(pokemonId){
    if(ELITE_IDS.has(Number(pokemonId)))return rand(16,23);
    if(STRONG_IDS.has(Number(pokemonId)))return rand(13,20);
    return rand(9,17);
  }

  function ensureStyles(){
    if(document.getElementById('wildBattlePreviewStyles'))return;
    const s=document.createElement('style');s.id='wildBattlePreviewStyles';s.textContent=`
      .wbp-overlay{position:fixed;inset:0;z-index:420;display:grid;place-items:center;padding:12px;background:rgba(2,5,8,.92);backdrop-filter:blur(8px)}
      .wbp-card{width:min(100%,430px);max-height:92vh;overflow:auto;border:1px solid rgba(255,218,92,.28);border-radius:22px;background:linear-gradient(155deg,#101c27,#050a0f 76%);box-shadow:0 28px 90px rgba(0,0,0,.75);color:#fff;padding:16px;box-sizing:border-box}
      .wbp-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.wbp-kicker{font-size:9px;font-weight:1000;letter-spacing:.17em;color:#ffd85f}.wbp-turn{font-size:8px;font-weight:950;color:#7f94a6}
      .wbp-stage{display:grid;grid-template-columns:112px minmax(0,1fr);gap:13px;align-items:center;margin-top:8px}.wbp-art{width:112px;height:112px;display:grid;place-items:center;border-radius:20px;background:radial-gradient(circle,rgba(255,255,255,.09),transparent 68%)}.wbp-art img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 8px rgba(0,0,0,.5))}.wbp-name small{display:block;color:#758a9c;font-size:8px;font-weight:900}.wbp-name strong{display:block;font-size:23px;line-height:1.05}.wbp-hp-label{display:flex;justify-content:space-between;margin-top:9px;font-size:8px;font-weight:1000;color:#91a6b8}.wbp-hp{height:9px;margin-top:4px;border-radius:999px;background:#061018;overflow:hidden;border:1px solid rgba(255,255,255,.06)}.wbp-hp i{display:block;height:100%;width:100%;border-radius:inherit;background:linear-gradient(90deg,#4adc8a,#9be35c);transition:width .28s ease}.wbp-hp.danger i{background:linear-gradient(90deg,#ff4c5d,#ff9c45)}
      .wbp-player{margin-top:11px;padding:9px 10px;border-radius:12px;background:#08131c;border:1px solid rgba(255,255,255,.06)}.wbp-player .wbp-hp-label{margin-top:0}.wbp-log{min-height:34px;margin-top:10px;padding:8px 10px;border-radius:10px;background:#071018;color:#b6c6d3;font-size:9px;font-weight:850;line-height:1.45}.wbp-catch{margin-top:9px;text-align:center;color:#8fa5b6;font-size:9px;font-weight:900}.wbp-catch b{color:#ffd85f;font-size:16px;margin-left:4px}.wbp-moves{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px}.wbp-move{min-height:48px;padding:7px 5px;border:1px solid rgba(92,182,255,.18);border-radius:11px;background:#0a1823;color:#fff;font-size:8px;font-weight:1000;cursor:pointer}.wbp-move small{display:block;margin-top:3px;color:#7390a6;font-size:6px}.wbp-move:disabled{opacity:.42;cursor:default}.wbp-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.wbp-ball,.wbp-auto{min-height:44px;border-radius:12px;font-weight:1000;cursor:pointer}.wbp-ball{border:0;background:linear-gradient(135deg,#ff354c,#ff8844);color:white}.wbp-auto{border:1px solid rgba(255,255,255,.09);background:#0a141d;color:#91a7b8}.wbp-note{margin-top:8px;text-align:center;color:#607687;font-size:7px;font-weight:850}.wbp-impact .wbp-art{animation:wbpHit .28s ease}@keyframes wbpHit{35%{transform:translateX(5px)}70%{transform:translateX(-4px)}}
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
    return{pokemonId,p,baseChance:Number(wild?.benefits?.tiers?.power?.effective_catch)||.5,powerLabel:wild?.benefits?.tiers?.power?.label||'LOW',moves:chosenMoves(gym?.player?.attacks)};
  }

  function battleHtml(state){
    const hpPct=Math.max(0,Math.round(state.wildHp)),playerPct=Math.max(0,Math.round(state.playerHp)),hpRatio=state.wildHp/100;
    const manual=catchChance(state.baseChance,hpRatio,state.turns,'battle',state.pokemonId),auto=catchChance(state.baseChance,1,0,'auto',state.pokemonId),locked=state.busy||state.turns>=3||state.wildHp<=0||state.playerHp<=0;
    return `<div class="wbp-top"><span class="wbp-kicker">WILD ENCOUNTER · PREVIEW</span><span class="wbp-turn">TURN ${Math.min(3,state.turns+1)} / 3</span></div>
      <div class="wbp-stage"><div class="wbp-art"><img src="${state.p.image}" alt="${esc(state.p.name)}"></div><div class="wbp-name"><small>#${String(state.pokemonId).padStart(3,'0')} · POWER ${esc(state.powerLabel)}</small><strong>${esc(state.p.name)}</strong><div class="wbp-hp-label"><span>WILD HP</span><span>${hpPct}%</span></div><div class="wbp-hp ${hpPct<=25?'danger':''}"><i style="width:${hpPct}%"></i></div></div></div>
      <div class="wbp-player"><div class="wbp-hp-label"><span>YOUR HP</span><span>${playerPct}%</span></div><div class="wbp-hp ${playerPct<=25?'danger':''}"><i style="width:${playerPct}%"></i></div></div>
      <div class="wbp-log">${esc(state.log||'Weaken the Pokémon, then throw a Poké Ball. Lower HP improves catch chance.')}</div>
      <div class="wbp-catch">CURRENT CATCH CHANCE <b>${Math.round(manual*100)}%</b></div>
      <div class="wbp-moves">${state.moves.map(m=>{const q=moveProfile(m);return `<button type="button" class="wbp-move" data-wbp-move="${esc(m.id)}" ${locked?'disabled':''}>${m.icon||'◆'} ${esc(m.name)}<small>${q.min}–${q.max} DMG · ${Math.round(q.accuracy*100)}% HIT</small></button>`}).join('')}</div>
      <div class="wbp-actions"><button type="button" class="wbp-ball" data-wbp-ball ${state.busy||state.wildHp<=0||state.playerHp<=0?'disabled':''}>◉ THROW POKÉ BALL · ${Math.round(manual*100)}%</button><button type="button" class="wbp-auto" data-wbp-auto ${state.busy?'disabled':''}>SKIP · AUTO ${Math.round(auto*100)}%</button></div>
      <div class="wbp-note">Battle takes max 3 turns. Fainting the wild Pokémon ends the encounter.</div>`;
  }

  function showState(state){
    openBattle(battleHtml(state));
    document.querySelectorAll('[data-wbp-move]').forEach(btn=>btn.addEventListener('click',()=>attack(state,String(btn.dataset.wbpMove)),{once:true}));
    document.querySelector('[data-wbp-ball]')?.addEventListener('click',()=>state.resolve?.('battle'),{once:true});
    document.querySelector('[data-wbp-auto]')?.addEventListener('click',()=>state.resolve?.('auto'),{once:true});
  }

  async function attack(state,moveId){
    if(state.busy||state.turns>=3||state.wildHp<=0||state.playerHp<=0)return;
    const move=state.moves.find(m=>m.id===moveId)||MOVES.basic,q=moveProfile(move);state.busy=true;state.turns++;
    const hit=Math.random()<q.accuracy,crit=hit&&Math.random()<q.crit,raw=hit?rand(q.min,q.max):0,damage=crit?Math.round(raw*1.25):raw;
    state.log=hit?`${move.name}${crit?' CRITICAL HIT!':''} dealt ${damage} damage.`:`${move.name} missed!`;showState(state);await wait(240);
    if(hit){state.wildHp=Math.max(0,state.wildHp-damage);document.getElementById('wildBattlePreviewCard')?.classList.add('wbp-impact');try{navigator.vibrate?.(crit?[35,25,55]:25)}catch{};await wait(210)}
    if(state.wildHp<=0){state.busy=false;state.log=`${state.p.name} fainted. It cannot be caught.`;showState(state);await wait(650);return state.resolve?.('fainted')}
    const counter=enemyDamage(state.pokemonId);state.playerHp=Math.max(0,state.playerHp-counter);state.log+=` ${state.p.name} hit back for ${counter}.`;
    if(state.playerHp<=0){state.busy=false;showState(state);await wait(650);return state.resolve?.('player_fainted')}
    state.busy=false;if(state.turns>=3)state.log+=` No turns left — throw the Poké Ball.`;showState(state);
  }

  function encounter(input,init,body){
    return new Promise(async(resolve,reject)=>{
      let ctx;try{ctx=await contextFor(body)}catch(error){return reject(error)}
      const state={...ctx,wildHp:100,playerHp:100,turns:0,busy:false,log:'',moves:ctx.moves};
      let finished=false;
      state.resolve=async mode=>{
        if(finished)return;finished=true;state.busy=true;showState(state);
        const resolution=mode==='auto'?'auto':'battle',fainted=mode==='fainted',playerFainted=mode==='player_fainted',hpRatio=fainted?0:clamp(state.wildHp/100,.01,1);
        if(fainted||playerFainted){state.log=fainted?`${state.p.name} fainted. The encounter is over.`:'You were knocked out. The Pokémon escaped.';showState(state);await wait(500)}
        try{
          const nextBody={...body,resolution,hp_ratio:resolution==='auto'?1:hpRatio,turns:resolution==='auto'?0:state.turns,fainted,player_fainted:playerFainted};
          const response=await upstreamFetch(input,{...init,body:JSON.stringify(nextBody)}),copy=response.clone();let data={};try{data=await copy.json()}catch{}
          lastResultMeta={pokemon:state.p,mode:resolution,chance:Number(data.catch_chance)||0};
          closeBattle();
          if(fainted||playerFainted){
            const muted={...data,attempted:false,battle_resolved:true};
            return resolve(new Response(JSON.stringify(muted),{status:response.status,headers:{'Content-Type':'application/json'}}));
          }
          resolve(response);
        }catch(error){finished=false;state.busy=false;state.log='Could not resolve catch. Try again.';showState(state)}
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
    const text=document.querySelector('#pokemonV2Card p');
    if(lastResultMeta&&text&&/catch chance from your POWER build/i.test(text.textContent||'')){
      const mode=lastResultMeta.mode==='auto'?'AUTO · reduced odds':'BATTLE + POWER';
      text.textContent=`${lastResultMeta.pokemon.name} · ${Math.round(lastResultMeta.chance*100)}% catch chance · ${mode}.`;lastResultMeta=null;
    }
  });
  const startObserver=()=>{if(document.body)patchObserver.observe(document.body,{childList:true,subtree:true})};
  if(document.body)startObserver();else document.addEventListener('DOMContentLoaded',startObserver,{once:true});
})();
