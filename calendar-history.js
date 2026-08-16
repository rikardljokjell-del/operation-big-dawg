(()=>{
  const VIEWS=[
    {id:'8w',label:'Siste 8 uker'},
    {id:'4m',label:'Siste 4 måneder'},
    {id:'12m',label:'Siste 12 måneder'}
  ];
  const MONTHS=['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];
  let viewIndex=0;
  let periodOffset=0;
  let pickerYear=0;
  let pickerMonth=0;
  let selectedDate='';

  const view=()=>VIEWS[viewIndex];
  const civilDate=value=>new Date(`${value}T12:00:00Z`);
  const monthParts=(year,monthIndex,delta=0)=>{const d=new Date(Date.UTC(year,monthIndex+delta,1));return{year:d.getUTCFullYear(),month:d.getUTCMonth()}};
  const monthStart=({year,month})=>`${year}-${String(month+1).padStart(2,'0')}-01`;
  const monthEnd=({year,month})=>new Date(Date.UTC(year,month+1,0)).toISOString().slice(0,10);
  const monthKey=value=>value.slice(0,7);
  const formatMonth=({year,month},short=false)=>new Intl.DateTimeFormat('nb-NO',{month:short?'short':'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,1))).replace('.','');
  const formatDay=value=>new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',timeZone:'UTC'}).format(civilDate(value)).replace('.','');
  const formatLongDate=value=>new Intl.DateTimeFormat('nb-NO',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(civilDate(value));
  const selectedHistory=()=>typeof historyRowsForPlayer==='function'?historyRowsForPlayer(activePlayer()):rowsForPlayer(activePlayer());
  const today=()=>ymd(new Date());

  function isoWeek(value){
    const d=civilDate(value),thursday=new Date(d);thursday.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
    const yearStart=new Date(Date.UTC(thursday.getUTCFullYear(),0,1));
    return Math.ceil((((thursday-yearStart)/86400000)+1)/7);
  }

  function countTypes(list,predicate){
    let strength=0,cardio=0,mobility=0;
    list.forEach(row=>{if(!predicate(row))return;if(row.workout_type==='strength')strength++;if(row.workout_type==='cardio')cardio++;if(row.workout_type==='mobility')mobility++});
    return{strength,cardio,mobility};
  }

  function countMarkup(counts){
    return `<div class="calendar-counts"><span class="calendar-count strength">S ${counts.strength}</span><span class="calendar-count cardio">K ${counts.cardio}</span><span class="calendar-count mobility">M ${counts.mobility}</span></div>`;
  }

  function rangeLabel(start,end){
    return `${formatDay(start)} – ${new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(civilDate(end)).replace('.','')}`;
  }

  function currentMonthAnchor(multiplier){
    const [year,month]=today().split('-').map(Number);
    return monthParts(year,month-1,periodOffset*multiplier);
  }

  function renderEightWeeks(container,dow,list){
    const anchorWeek=addDaysYmd(currentWeek(),periodOffset*56),start=addDaysYmd(anchorWeek,-49),end=addDaysYmd(anchorWeek,6),todayKey=today(),byDay=new Map();
    list.forEach(row=>{const day=ymd(row.created_at);if(!byDay.has(day))byDay.set(day,new Set());byDay.get(day).add(row.workout_type)});
    container.className='heat';
    dow.hidden=false;
    let out='';
    for(let i=0;i<56;i++){
      const day=addDaysYmd(start,i),types=byDay.get(day)||new Set(),future=day>todayKey,title=[day,types.has('strength')?'Styrke':'',types.has('cardio')?'Kondisjon':'',types.has('mobility')?'Mobilitet':''].filter(Boolean).join(' · ');
      out+=`<div class="day ${types.size?'has':''} ${future?'future':''}" title="${title}">${types.has('strength')?'<span class="s">S</span>':''}${types.has('cardio')?'<span class="k">K</span>':''}${types.has('mobility')?'<span class="m">M</span>':''}</div>`;
    }
    container.innerHTML=out;
    return{start,end};
  }

  function renderFourMonths(container,dow,list){
    const endMonth=currentMonthAnchor(4),startMonth=monthParts(endMonth.year,endMonth.month,-3),start=mondayKey(monthStart(startMonth)),lastWeek=mondayKey(monthEnd(endMonth)),end=addDaysYmd(lastWeek,6),current=currentWeek();
    container.className='heat calendar-week-summary';
    dow.hidden=true;
    let out='',lastCaption='';
    for(let week=start;week<=lastWeek;week=addDaysYmd(week,7)){
      const middle=addDaysYmd(week,3),rawCaption=monthKey(middle),caption=rawCaption<monthKey(monthStart(startMonth))?monthKey(monthStart(startMonth)):rawCaption>monthKey(monthEnd(endMonth))?monthKey(monthEnd(endMonth)):rawCaption;
      if(caption!==lastCaption){const [year,month]=caption.split('-').map(Number);out+=`<div class="calendar-period-caption">${formatMonth({year,month:month-1})}</div>`;lastCaption=caption}
      const counts=countTypes(list,row=>mondayKey(row.created_at)===week),empty=counts.strength+counts.cardio+counts.mobility===0;
      out+=`<div class="calendar-week-tile ${week===current?'current':''} ${empty?'empty':''}"><div><span class="calendar-tile-label">UKE ${isoWeek(week)}</span><small class="calendar-tile-dates">${formatDay(week)}–${formatDay(addDaysYmd(week,6))}</small></div>${countMarkup(counts)}</div>`;
    }
    container.innerHTML=out;
    return{start:monthStart(startMonth),end:monthEnd(endMonth)};
  }

  function renderTwelveMonths(container,dow,list){
    const endMonth=currentMonthAnchor(12),startMonth=monthParts(endMonth.year,endMonth.month,-11),todayMonth=monthKey(today());
    container.className='heat calendar-month-summary';
    dow.hidden=true;
    let out='';
    for(let i=0;i<12;i++){
      const item=monthParts(startMonth.year,startMonth.month,i),key=`${item.year}-${String(item.month+1).padStart(2,'0')}`,counts=countTypes(list,row=>monthKey(ymd(row.created_at))===key),empty=counts.strength+counts.cardio+counts.mobility===0;
      out+=`<div class="calendar-month-tile ${key===todayMonth?'current':''} ${empty?'empty':''}"><div><span class="calendar-month-name">${MONTHS[item.month]}</span><small class="calendar-month-year">${item.year}</small></div>${countMarkup(counts)}</div>`;
    }
    container.innerHTML=out;
    return{start:monthStart(startMonth),end:monthEnd(endMonth)};
  }

  function updateControls(period){
    const label=document.getElementById('calendarViewLabel'),next=document.getElementById('calendarNext'),todayButton=document.getElementById('calendarToday'),range=document.getElementById('calendarRangeLabel');
    if(label)label.textContent=view().label;
    if(next)next.disabled=periodOffset===0;
    if(todayButton)todayButton.hidden=periodOffset===0;
    if(range&&period)range.textContent=rangeLabel(period.start,period.end);
  }

  window.renderTrainingCalendar=function(){
    const person=activePlayer(),list=selectedHistory();
    let activePeriod=null;
    PEOPLE.forEach(name=>{
      const container=document.getElementById('heat'+name),card=container?.closest('.calendar-card'),active=name===person;
      if(card)card.hidden=!active;
      if(!container)return;
      if(!active){container.innerHTML='';return}
      const dow=card.querySelector('.dow');
      activePeriod=view().id==='8w'?renderEightWeeks(container,dow,list):view().id==='4m'?renderFourMonths(container,dow,list):renderTwelveMonths(container,dow,list);
    });
    updateControls(activePeriod);
  };

  function changePeriod(delta){periodOffset=Math.min(0,periodOffset+delta);window.renderTrainingCalendar()}
  document.getElementById('calendarPrev')?.addEventListener('click',()=>changePeriod(-1));
  document.getElementById('calendarNext')?.addEventListener('click',()=>changePeriod(1));
  document.getElementById('calendarToday')?.addEventListener('click',()=>{periodOffset=0;window.renderTrainingCalendar()});
  document.getElementById('calendarViewCycle')?.addEventListener('click',()=>{viewIndex=(viewIndex+1)%VIEWS.length;periodOffset=0;window.renderTrainingCalendar()});

  function osloTime(){
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
    return `${parts.hour}:${parts.minute}`;
  }

  function wallTimeToIso(dateValue,timeValue){
    const [year,month,day]=dateValue.split('-').map(Number),[hour,minute]=timeValue.split(':').map(Number),wanted=Date.UTC(year,month-1,day,hour,minute);let guess=wanted;
    for(let i=0;i<3;i++){
      const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
      const seen=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
      guess+=wanted-seen;
    }
    return new Date(guess).toISOString();
  }

  function recordsForDate(value){
    const types=new Set();selectedHistory().forEach(row=>{if(ymd(row.created_at)===value)types.add(row.workout_type)});return types;
  }

  function fillPickerSelects(){
    const monthSelect=document.getElementById('manualMonth'),yearSelect=document.getElementById('manualYear'),currentYear=Number(today().slice(0,4));
    monthSelect.innerHTML=MONTHS.map((name,index)=>`<option value="${index}">${name}</option>`).join('');
    let years='';for(let year=currentYear;year>=2000;year--)years+=`<option value="${year}">${year}</option>`;yearSelect.innerHTML=years;
  }

  function chooseAvailableType(types){
    const inputs=[...document.querySelectorAll('input[name="manualWorkoutType"]')];
    inputs.forEach(input=>input.disabled=types.has(input.value));
    const checked=inputs.find(input=>input.checked&&!input.disabled),available=inputs.find(input=>!input.disabled);
    if(!checked){inputs.forEach(input=>input.checked=false);if(available)available.checked=true}
    document.getElementById('saveManualWorkout').disabled=!selectedDate||!available;
  }

  function renderSelectedStatus(){
    const label=document.getElementById('manualSelectedDate'),status=document.getElementById('manualDateStatus'),types=selectedDate?recordsForDate(selectedDate):new Set();
    label.textContent=selectedDate?formatLongDate(selectedDate):'Velg en dato';
    status.innerHTML=!selectedDate?'':types.size?[types.has('strength')?'<span class="manual-status-chip s">S registrert</span>':'',types.has('cardio')?'<span class="manual-status-chip k">K registrert</span>':'',types.has('mobility')?'<span class="manual-status-chip m">M registrert</span>':''].join(''):'<span class="manual-status-empty">Ingen økter registrert denne dagen</span>';
    chooseAvailableType(types);
  }

  function renderDatePicker(){
    const grid=document.getElementById('manualDateGrid'),first=`${pickerYear}-${String(pickerMonth+1).padStart(2,'0')}-01`,firstDow=civilDate(first).getUTCDay()||7,start=addDaysYmd(first,-(firstDow-1)),todayKey=today();
    document.getElementById('manualMonth').value=String(pickerMonth);
    document.getElementById('manualYear').value=String(pickerYear);
    const currentParts=monthParts(Number(todayKey.slice(0,4)),Number(todayKey.slice(5,7))-1),atCurrent=pickerYear===currentParts.year&&pickerMonth===currentParts.month;
    document.getElementById('manualMonthNext').disabled=atCurrent;
    let out='';
    for(let i=0;i<42;i++){
      const value=addDaysYmd(start,i),inMonth=value.slice(0,7)===first.slice(0,7),unavailable=value>=todayKey,types=recordsForDate(value),marks=`${types.has('strength')?'<span class="manual-day-mark s">S</span>':''}${types.has('cardio')?'<span class="manual-day-mark k">K</span>':''}${types.has('mobility')?'<span class="manual-day-mark m">M</span>':''}`,status=[types.has('strength')?'S registrert':'',types.has('cardio')?'K registrert':'',types.has('mobility')?'M registrert':''].filter(Boolean).join(', ');
      out+=`<button class="manual-calendar-day ${!inMonth?'other-month':''} ${unavailable?'unavailable':''} ${value===selectedDate?'selected':''}" type="button" data-manual-date="${value}" ${!inMonth||unavailable?'disabled':''} title="${value}${status?` · ${status}`:''}"><span class="manual-day-number">${Number(value.slice(8,10))}</span><span class="manual-day-marks">${marks}</span></button>`;
    }
    grid.innerHTML=out;
    renderSelectedStatus();
  }

  function shiftPicker(delta){
    const next=monthParts(pickerYear,pickerMonth,delta),current=monthParts(Number(today().slice(0,4)),Number(today().slice(5,7))-1);
    if(next.year>current.year||(next.year===current.year&&next.month>current.month))return;
    pickerYear=next.year;pickerMonth=next.month;renderDatePicker();
  }

  function closeManual(){document.getElementById('manualWorkoutDialog')?.close()}
  function openManual(){
    const person=activePlayer();if(!person){toast('Velg spiller først');return}
    const yesterday=addDaysYmd(today(),-1),[year,month]=yesterday.split('-').map(Number);
    selectedDate=yesterday;pickerYear=year;pickerMonth=month-1;
    document.getElementById('manualPlayerLabel').textContent=`Etterregistrerer for ${person}`;
    document.getElementById('manualWorkoutTime').value=osloTime();
    renderDatePicker();
    document.getElementById('manualWorkoutDialog').showModal();
  }

  async function saveManual(){
    if(busy)return;
    const person=activePlayer(),meta=typeof window.getPlayerMeta==='function'?window.getPlayerMeta(person):null,type=document.querySelector('input[name="manualWorkoutType"]:checked')?.value,time=document.getElementById('manualWorkoutTime').value,types=recordsForDate(selectedDate);
    if(!selectedDate||selectedDate>=today())return toast('Velg en dato før i dag');
    if(!type||types.has(type))return toast(type==='strength'?'Styrke er allerede registrert':type==='cardio'?'Kondisjon er allerede registrert':'Mobilitet er allerede registrert');
    if(!time)return toast('Velg tidspunkt');
    setBusy(true);
    try{
      await call({action:'manual_add',person,player_id:meta?.id||undefined,workout_type:type,workout_date:selectedDate,created_at:wallTimeToIso(selectedDate,time)});
      await refresh(true);
      closeManual();
      toast('Økten er etterregistrert');
    }catch(error){toast(error.message)}finally{setBusy(false);window.renderTrainingCalendar();renderSelectedStatus()}
  }

  fillPickerSelects();
  document.getElementById('openManualWorkout')?.addEventListener('click',openManual);
  document.getElementById('closeManualWorkout')?.addEventListener('click',closeManual);
  document.getElementById('cancelManualWorkout')?.addEventListener('click',closeManual);
  document.getElementById('manualMonthPrev')?.addEventListener('click',()=>shiftPicker(-1));
  document.getElementById('manualMonthNext')?.addEventListener('click',()=>shiftPicker(1));
  document.getElementById('manualMonth')?.addEventListener('change',event=>{pickerMonth=Number(event.target.value);renderDatePicker()});
  document.getElementById('manualYear')?.addEventListener('change',event=>{pickerYear=Number(event.target.value);const current=monthParts(Number(today().slice(0,4)),Number(today().slice(5,7))-1);if(pickerYear===current.year&&pickerMonth>current.month)pickerMonth=current.month;renderDatePicker()});
  document.getElementById('manualDateGrid')?.addEventListener('click',event=>{const button=event.target.closest('[data-manual-date]');if(!button||button.disabled)return;selectedDate=button.dataset.manualDate;renderDatePicker()});
  document.querySelectorAll('input[name="manualWorkoutType"]').forEach(input=>input.addEventListener('change',renderSelectedStatus));
  document.getElementById('saveManualWorkout')?.addEventListener('click',saveManual);
  window.addEventListener('obd-player-changed',()=>{closeManual();periodOffset=0});
  window.__obdCalendarPreview={get view(){return view().id},get offset(){return periodOffset},render:window.renderTrainingCalendar};
})();
