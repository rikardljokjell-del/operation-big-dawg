(()=>{
  const LABEL={strength:'Styrke',cardio:'Kondis',mobility:'Mobilitet'};
  const originalText=new WeakMap();
  const undoText=new WeakMap();

  const today=()=>typeof ymd==='function'?ymd(new Date()):new Date().toISOString().slice(0,10);
  const rowsFor=person=>typeof rowsForPlayer==='function'?rowsForPlayer(person):[];
  const isDebugTest=person=>String(person||'').trim().toLocaleLowerCase('nb-NO')==='test';
  const alreadyLogged=(person,type)=>rowsFor(person).some(r=>r.workout_type===type&&ymd(r.created_at)===today());
  const hasTodayWorkout=person=>rowsFor(person).some(r=>ymd(r.created_at)===today());
  const hasAnyWorkout=person=>rowsFor(person).length>0;
  const shiftYmd=(value,days)=>typeof addDaysYmd==='function'?addDaysYmd(value,days):(()=>{const [y,m,d]=value.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d+days));return dt.toISOString().slice(0,10)})();

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
    .edit-date-rule{display:block;margin-top:7px;color:#8ea3b8;font-size:11px;line-height:1.35}
  `;
  document.head.appendChild(style);

  function applyDailyLocks(){
    document.querySelectorAll('[data-add]').forEach(btn=>{
      const type=btn.dataset.add;
      const person=btn.dataset.person;
      if(!type||!person)return;
      if(!originalText.has(btn))originalText.set(btn,btn.textContent);
      const debug=isDebugTest(person);
      const locked=!debug&&alreadyLogged(person,type);
      btn.classList.toggle('daily-locked',locked);
      btn.setAttribute('aria-disabled',locked?'true':'false');
      btn.title=debug?'DEBUG: hvert trykk registreres som en ny treningsdag':locked?`${LABEL[type]} allerede registrert i dag`:'';
      btn.textContent=locked?`✓ ${LABEL[type]} registrert`:originalText.get(btn);
    });

    document.querySelectorAll('[data-undo]').forEach(btn=>{
      const person=btn.dataset.undo;
      if(!person)return;
      if(!undoText.has(btn))undoText.set(btn,btn.textContent);
      const debug=isDebugTest(person);
      const locked=debug?!hasAnyWorkout(person):!hasTodayWorkout(person);
      btn.classList.toggle('daily-locked',locked);
      btn.setAttribute('aria-disabled',locked?'true':'false');
      btn.title=locked?(debug?'Ingen debugøkter registrert':'Ingen økter registrert i dag'):debug?'DEBUG: angrer siste simulerte klikk':'';
      btn.textContent=undoText.get(btn);
    });
  }
  window.applyDailyWorkoutLocks=applyDailyLocks;

  function editBounds(row){
    const original=ymd(row.created_at);
    const min=shiftYmd(original,-7);
    const plusSeven=shiftYmd(original,7);
    const latest=row.entry_source==='manual'?shiftYmd(today(),-1):today();
    const max=plusSeven<latest?plusSeven:latest;
    return{original,min,max,manual:row.entry_source==='manual'};
  }

  function applyEditBounds(){
    if(typeof editing==='undefined'||!editing)return;
    const input=document.getElementById('editDate');
    if(!input)return;
    const bounds=editBounds(editing);
    input.min=`${bounds.min}T00:00`;
    input.max=`${bounds.max}T23:59`;
    input.dataset.minDate=bounds.min;
    input.dataset.maxDate=bounds.max;
    const field=input.closest('.field');
    if(field){
      let note=field.querySelector('.edit-date-rule');
      if(!note){note=document.createElement('small');note.className='edit-date-rule';field.appendChild(note)}
      note.textContent=bounds.manual?`Etterregistrerte økter kan flyttes maks 7 dager, men aldri til dagens eller en fremtidig dato. Tillatt: ${bounds.min} – ${bounds.max}.`:`Dato kan endres maks 7 dager fra originaldato (${bounds.original}), og aldri etter i dag. Tillatt: ${bounds.min} – ${bounds.max}.`;
    }
  }

  if(typeof openEdit==='function'&&!window.__obdEditDatePatch){
    window.__obdEditDatePatch=true;
    const originalOpenEdit=openEdit;
    openEdit=function(id){originalOpenEdit(id);applyEditBounds()};
  }

  if(typeof renderPeople==='function'&&!window.__obdDailyLimitRenderPatch){
    window.__obdDailyLimitRenderPatch=true;
    const original=renderPeople;
    renderPeople=function(){original();applyDailyLocks()};
  }

  if(typeof undoWorkout==='function'&&!window.__obdUndoTodayPatch){
    window.__obdUndoTodayPatch=true;
    const originalUndo=undoWorkout;
    undoWorkout=async function(person){
      if(isDebugTest(person)){
        if(!hasAnyWorkout(person)){
          if(typeof toast==='function')toast('Ingen debugøkter registrert');
          else alert('Ingen debugøkter registrert');
          applyDailyLocks();
          return;
        }
        return originalUndo(person);
      }
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
      const msg=isDebugTest(undoBtn.dataset.undo)?'Ingen debugøkter registrert':'Ingen økter registrert i dag';
      if(typeof toast==='function')toast(msg);else alert(msg);
      return;
    }
    if(e.target.closest('#saveEdit')){
      const input=document.getElementById('editDate');
      const value=input?.value||'';
      const targetDate=value.slice(0,10);
      const min=input?.dataset.minDate||'';
      const max=input?.dataset.maxDate||'';
      if(targetDate&&((min&&targetDate<min)||(max&&targetDate>max))){
        e.preventDefault();
        e.stopImmediatePropagation();
        const msg=editing?.entry_source==='manual'&&targetDate>=today()?'Etterregistrerte økter kan ikke flyttes til dagens eller en fremtidig dato':targetDate>today()?'Dato kan ikke settes frem i tid':`Dato må være mellom ${min} og ${max}`;
        if(typeof toast==='function')toast(msg);else alert(msg);
      }
    }
  },true);

  window.addEventListener('obd-workout-added',()=>setTimeout(applyDailyLocks,0));
  window.addEventListener('obd-player-changed',()=>setTimeout(applyDailyLocks,0));
  window.addEventListener('obd-auth-ready',()=>setTimeout(applyDailyLocks,0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)applyDailyLocks()});
  setTimeout(applyDailyLocks,150);
  setTimeout(applyDailyLocks,700);
})();
