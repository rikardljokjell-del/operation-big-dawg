(()=>{
  if(window.__obdStatsBenefitStability)return;
  window.__obdStatsBenefitStability=true;

  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const PIN='1337';
  const activeId=()=>window.getSelectedPlayerId?.()||'';
  const activeName=()=>window.getSelectedPlayer?.()||'';
  const levelNow=()=>{try{return Number(levelInfo(activeName()).level)||1}catch{return 1}};
  const THRESHOLDS=[8,15,23],LABELS=['LOW','MEDIUM','HIGH','MAX'];
  const POWER=[65,75,85,100],ENGINE=[0,1,1,2],DISCIPLINE=[25,50,75,100],GRIT=[1,2,4,6];
  let benefits=null,fetchBusy=false,scheduled=false;

  async function loadBenefits(){
    const id=activeId();
    if(!id||levelNow()<2){benefits=null;render();return}
    if(fetchBusy)return;
    fetchBusy=true;
    try{
      const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'benefits',player_id:id,level:levelNow(),pin:PIN})});
      const data=await response.json();
      if(response.ok)benefits=data.benefits||null;
    }catch(error){console.warn('Stats benefit sync failed',error)}
    finally{fetchBusy=false;render()}
  }

  function keyFor(label){if(label.includes('POWER'))return'power';if(label.includes('ENGINE'))return'engine';if(label.includes('DISCIPLINE'))return'discipline';if(label.includes('GRIT'))return'grit';return''}
  function currentEffect(key,i){
    if(key==='power')return `${POWER[i]}% catch rate`;
    if(key==='engine')return `${ENGINE[i]} extra shuffle${ENGINE[i]===1?'':'s'}`;
    if(key==='discipline')return `${DISCIPLINE[i]}% snipe success`;
    if(key==='grit')return `+${GRIT[i]}% rare chance`;
    return '';
  }
  function nextLine(key,value,i){
    if(i>=3)return '<em>MAXED · no further upgrade</em>';
    const threshold=THRESHOLDS[i],need=Math.max(1,Math.ceil(threshold-Number(value||0))),next=i+1;
    return `<em>${need} AP TO ${LABELS[next]} · NEXT: ${currentEffect(key,next)}</em>`;
  }
  function textFor(key,t,value){
    const i=Number(t?.[key]?.index)||0,tier=LABELS[i],effect=currentEffect(key,i);
    const head=key==='power'?'WILD CATCH':key==='engine'?'GYM LOOT':key==='discipline'?'SNIPE':'RARE GYM POKÉMON';
    return `${head} · <b>${tier}</b> (${effect})${nextLine(key,value,i)}`;
  }

  function render(){
    const t=benefits?.tiers,values=benefits?.values||{};
    const rows=[...document.querySelectorAll('.fighter-stat-row')];
    if(levelNow()<2||!t){rows.forEach(row=>row.querySelector('.stat-game-benefit')?.remove());return}
    rows.forEach(row=>{
      const label=String(row.querySelector('span')?.textContent||'').toUpperCase(),key=keyFor(label);if(!key)return;
      const html=textFor(key,t,Number(values[key])||0);
      let note=row.querySelector('.stat-game-benefit');
      if(!note){note=document.createElement('small');note.className='stat-game-benefit';row.appendChild(note)}
      if(note.innerHTML!==html)note.innerHTML=html;
    });
  }

  function ensureStyle(){
    if(document.getElementById('statsBenefitProgressStyle'))return;
    const s=document.createElement('style');s.id='statsBenefitProgressStyle';s.textContent=`
      .stat-game-benefit em{display:block;margin-top:3px;color:#ffd86b;font-style:normal;font-size:6px;letter-spacing:.04em}
    `;document.head.appendChild(s);
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render()})}
  ensureStyle();
  const fighters=document.getElementById('fighters');
  if(fighters)new MutationObserver(schedule).observe(fighters,{childList:true,subtree:true});

  window.addEventListener('obd-auth-ready',()=>setTimeout(loadBenefits,120));
  window.addEventListener('obd-player-changed',()=>{benefits=null;setTimeout(loadBenefits,100)});
  window.addEventListener('obd-workout-added',()=>setTimeout(loadBenefits,180));
  window.addEventListener('pageshow',()=>setTimeout(loadBenefits,160));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(loadBenefits,100)});
  [0,120,350,900].forEach(ms=>setTimeout(()=>{schedule();if(ms===120||ms===900)loadBenefits()},ms));
})();
