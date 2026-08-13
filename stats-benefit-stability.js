(()=>{
  if(window.__obdStatsBenefitStability)return;
  window.__obdStatsBenefitStability=true;

  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/gym-game';
  const PIN='1337';
  const activeId=()=>window.getSelectedPlayerId?.()||'';
  const activeName=()=>window.getSelectedPlayer?.()||'';
  const levelNow=()=>{try{return Number(levelInfo(activeName()).level)||1}catch{return 1}};
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

  function textFor(label,t){
    if(label.includes('POWER'))return `WILD CATCH · <b>${t.power.label}</b> (${Math.round(t.power.effective_catch*100)}% catch rate)`;
    if(label.includes('ENGINE'))return `GYM LOOT · <b>${t.engine.label}</b> (${t.engine.extra_shuffle} extra shuffle${t.engine.extra_shuffle===1?'':'s'})`;
    if(label.includes('DISCIPLINE'))return `SNIPE · <b>${t.discipline.label}</b> (${Math.round(t.discipline.snipe_chance*100)}% success)`;
    if(label.includes('GRIT'))return `RARE GYM POKÉMON · <b>${t.grit.label}</b> (+${Math.round(t.grit.rare_bonus*100)}% rare chance)`;
    return '';
  }

  function render(){
    const t=benefits?.tiers;
    const rows=[...document.querySelectorAll('.fighter-stat-row')];
    if(levelNow()<2||!t){rows.forEach(row=>row.querySelector('.stat-game-benefit')?.remove());return}
    rows.forEach(row=>{
      const label=String(row.querySelector('span')?.textContent||'').toUpperCase();
      const html=textFor(label,t);if(!html)return;
      let note=row.querySelector('.stat-game-benefit');
      if(!note){note=document.createElement('small');note.className='stat-game-benefit';row.appendChild(note)}
      if(note.innerHTML!==html)note.innerHTML=html;
    });
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render()})}
  const fighters=document.getElementById('fighters');
  if(fighters)new MutationObserver(schedule).observe(fighters,{childList:true,subtree:true});

  window.addEventListener('obd-auth-ready',()=>setTimeout(loadBenefits,120));
  window.addEventListener('obd-player-changed',()=>{benefits=null;setTimeout(loadBenefits,100)});
  window.addEventListener('obd-workout-added',()=>setTimeout(loadBenefits,180));
  window.addEventListener('pageshow',()=>setTimeout(loadBenefits,160));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(loadBenefits,100)});
  [0,120,350,900].forEach(ms=>setTimeout(()=>{schedule();if(ms===120||ms===900)loadBenefits()},ms));
})();
