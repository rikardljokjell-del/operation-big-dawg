(()=>{
  if(window.__obdStatBalanceV2)return;
  window.__obdStatBalanceV2=true;

  const THRESHOLDS={medium:8,high:15,max:23};
  const tierFor=value=>Number(value)>=THRESHOLDS.max?3:Number(value)>=THRESHOLDS.high?2:Number(value)>=THRESHOLDS.medium?1:0;
  const LABELS=['LOW','MEDIUM','HIGH','MAX'];
  const POWER=[65,75,85,100];
  const ENGINE=[0,1,1,2];
  const DISCIPLINE=[25,50,75,100];
  const GRIT=[1,2,4,6];
  const keyFor=label=>label.includes('POWER')?'power':label.includes('ENGINE')?'engine':label.includes('DISCIPLINE')?'discipline':label.includes('GRIT')?'grit':'';

  window.OBD_STAT_TIER_THRESHOLDS=Object.freeze({...THRESHOLDS});
  window.OBD_STAT_TIER_INDEX=tierFor;

  function benefitText(key,value){
    const i=tierFor(value),tier=LABELS[i];
    if(key==='power')return `WILD CATCH · <b>${tier}</b> (${POWER[i]}% catch rate)`;
    if(key==='engine')return `GYM LOOT · <b>${tier}</b> (${ENGINE[i]} extra shuffle${ENGINE[i]===1?'':'s'})`;
    if(key==='discipline')return `SNIPE · <b>${tier}</b> (${DISCIPLINE[i]}% success)`;
    if(key==='grit')return `RARE GYM POKÉMON · <b>${tier}</b> (+${GRIT[i]}% rare chance)`;
    return '';
  }

  function previewValues(){
    const text=String(document.querySelector('#statsBuildPreview small')?.textContent||'');
    const out={};
    for(const part of text.split('·')){
      const m=part.trim().match(/^(POWER|ENGINE|DISCIPLINE|GRIT)\s+([0-9]+(?:\.[0-9]+)?)/i);
      if(m)out[m[1].toLowerCase()]=Number(m[2]);
    }
    return out;
  }

  function renderAllocatorBenefits(){
    const allocator=document.getElementById('statsAllocator');
    if(!allocator||allocator.hidden)return;
    const values=previewValues();
    allocator.querySelectorAll('.stats-alloc-row').forEach(row=>{
      const label=String(row.querySelector('.stats-alloc-name strong')?.textContent||'').toUpperCase();
      const key=keyFor(label),value=values[key];
      if(!key||!Number.isFinite(value))return;
      const html=benefitText(key,value);
      let note=row.querySelector('.stats-ap-live-benefit');
      if(!note){note=document.createElement('small');note.className='stats-ap-live-benefit';row.querySelector('.stats-alloc-name span')?.appendChild(note)}
      if(note&&note.innerHTML!==html)note.innerHTML=html;
    });
  }

  function ensureStyle(){
    if(document.getElementById('statBalanceV2Style'))return;
    const s=document.createElement('style');s.id='statBalanceV2Style';s.textContent=`
      .stats-ap-live-benefit{display:block!important;margin-top:5px!important;padding:5px 7px;border-radius:7px;background:#07131c;color:#8eb4ce!important;font-size:7px!important;font-weight:900!important;line-height:1.25}
      .stats-ap-live-benefit b{color:#fff}
    `;document.head.appendChild(s);
  }

  let scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderAllocatorBenefits()})}
  ensureStyle();
  const root=document.getElementById('statsUnlockOverlay')||document.body;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-stat-adjust],[data-stats-build],[data-open-stats]'))setTimeout(schedule,0)},true);
  [0,120,350].forEach(ms=>setTimeout(schedule,ms));
})();
