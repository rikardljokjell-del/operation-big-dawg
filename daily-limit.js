(()=>{
  const LABEL={strength:'Styrke',cardio:'Kondis'};
  const originalText=new WeakMap();
  const undoText=new WeakMap();

  const today=()=>typeof ymd==='function'?ymd(new Date()):new Date().toISOString().slice(0,10);
  const rowsFor=person=>typeof rowsForPlayer==='function'?rowsForPlayer(person):[];
  const alreadyLogged=(person,type)=>rowsFor(person).some(r=>r.workout_type===type&&ymd(r.created_at)===today());
  const hasTodayWorkout=person=>rowsFor(person).some(r=>ymd(r.created_at)===today());

  const style=document.createElement('style');
  style.textContent=`
    .btn.daily-locked{
      background:linear-gradient(135deg,#1a232d,#202b36)!important;
      border-color:rgba(148,163,184,.18)!important;
      color:#73808d!important;
      box-shadow:none!important;
      filter:saturate(0)!important;
      opacity:.72!important;
      cursor:not-allowed!important;
      transform:none!important;
    }
    .btn.daily-locked:hover,.btn.daily-locked:active{transform:none!important;box-shadow:none!important}
  `;
  document.head.appendChild(style);

  function applyDailyLocks(){
    document.querySelectorAll('[data-add]').forEach(btn=>{
      const type=btn.dataset.add;
      const person=btn.dataset.person;
      if(!type||!person)return;
      if(!originalText.has(btn))originalText.set(btn,btn.textContent);
      const locked=alreadyLogged(person,type);
      btn.classList.toggle('daily-locked',locked);
      btn.setAttribute('aria-disabled',locked?'true':'false');
      btn.title=locked?`${LABEL[type]} allerede registrert i dag`:'';
      btn.textContent=locked?`✓ ${LABEL[type]} registrert`:originalText.get(btn);
    });

    document.querySelectorAll('[data-undo]').forEach(btn=>{
      const person=btn.dataset.undo;
      if(!person)return;
      if(!undoText.has(btn))undoText.set(btn,btn.textContent);
      const locked=!hasTodayWorkout(person);
      btn.classList.toggle('daily-locked',locked);
      btn.setAttribute('aria-disabled',locked?'true':'false');
      btn.title=locked?'Ingen økter registrert i dag':'';
      btn.textContent=undoText.get(btn);
    });
  }
  window.applyDailyWorkoutLocks=applyDailyLocks;

  if(typeof renderPeople==='function'&&!window.__obdDailyLimitRenderPatch){
    window.__obdDailyLimitRenderPatch=true;
    const original=renderPeople;
    renderPeople=function(){original();applyDailyLocks()};
  }

  if(typeof undoWorkout==='function'&&!window.__obdUndoTodayPatch){
    window.__obdUndoTodayPatch=true;
    const originalUndo=undoWorkout;
    undoWorkout=async function(person){
      if(!hasTodayWorkout(person)){
        if(typeof toast==='function')toast('Ingen økter registrert i dag');
        else alert('Ingen økter registrert i dag');
        applyDailyLocks();
        return;
      }
      return originalUndo(person);
    };
  }

  document.addEventListener('click',e=>{
    const addBtn=e.target.closest('[data-add].daily-locked');
    if(addBtn){
      e.preventDefault();
      e.stopImmediatePropagation();
      const type=addBtn.dataset.add;
      const msg=`${LABEL[type]} allerede registrert i dag`;
      if(typeof toast==='function')toast(msg);else alert(msg);
      return;
    }
    const undoBtn=e.target.closest('[data-undo].daily-locked');
    if(undoBtn){
      e.preventDefault();
      e.stopImmediatePropagation();
      const msg='Ingen økter registrert i dag';
      if(typeof toast==='function')toast(msg);else alert(msg);
    }
  },true);

  window.addEventListener('obd-workout-added',()=>setTimeout(applyDailyLocks,0));
  window.addEventListener('obd-player-changed',()=>setTimeout(applyDailyLocks,0));
  window.addEventListener('obd-auth-ready',()=>setTimeout(applyDailyLocks,0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)applyDailyLocks()});
  setTimeout(applyDailyLocks,150);
  setTimeout(applyDailyLocks,700);
})();
