(()=>{
  const ACCESS_PIN='0007';
  const APP_PIN='1337';
  const PIN_KEY='obd_access_pin_v1';
  const PLAYER_ID_KEY='obd_selected_player_id_v2';
  const LEGACY_PLAYER_KEY='obd_selected_player_v1';
  const VERIFIED_PLAYER_KEY='obd_verified_player_id_v1';
  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/onboarding-access';
  let onboarding=false;

  const read=key=>{try{return localStorage.getItem(key)||''}catch{return''}};
  const write=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
  const remove=key=>{try{localStorage.removeItem(key)}catch{}};
  const errorText=(id,msg)=>{const el=document.getElementById(id);if(el)el.textContent=msg||''};

  async function api(payload){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,access_pin:ACCESS_PIN})});
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!r.ok)throw new Error(data.error||text||'Onboarding-feil');
    return data;
  }

  function showPin(message=''){
    onboarding=false;remove(PIN_KEY);
    const gate=document.getElementById('accessGate'),pinStep=document.getElementById('pinStep'),playerStep=document.getElementById('playerStep'),newStep=document.getElementById('newPlayerStep'),playerPinStep=document.getElementById('playerPinStep'),close=document.getElementById('gateClose'),input=document.getElementById('pinInput'),submit=document.getElementById('pinSubmit');
    gate?.classList.add('show');if(pinStep)pinStep.hidden=false;if(playerStep)playerStep.hidden=true;if(newStep)newStep.hidden=true;if(playerPinStep)playerPinStep.hidden=true;if(close)close.hidden=true;
    errorText('pinError',message);if(input){input.disabled=false;input.value=''}if(submit)submit.disabled=false;setTimeout(()=>input?.focus(),30);
  }

  function showCreate(){
    const gate=document.getElementById('accessGate'),pinStep=document.getElementById('pinStep'),playerStep=document.getElementById('playerStep'),newStep=document.getElementById('newPlayerStep'),playerPinStep=document.getElementById('playerPinStep'),close=document.getElementById('gateClose'),form=document.getElementById('newPlayerForm');
    gate?.classList.add('show');if(pinStep)pinStep.hidden=true;if(playerStep)playerStep.hidden=true;if(playerPinStep)playerPinStep.hidden=true;if(newStep)newStep.hidden=false;if(close)close.hidden=true;
    form?.reset();const first=document.querySelector('input[name="characterSet"][value="1"]');if(first)first.checked=true;
    errorText('newPlayerError','');setTimeout(()=>document.getElementById('newPlayerName')?.focus(),40);
  }

  async function enterOnboarding(){
    const input=document.getElementById('pinInput'),submit=document.getElementById('pinSubmit');
    if(input)input.disabled=true;if(submit)submit.disabled=true;errorText('pinError','');
    try{
      const result=await api({action:'auth'});if(!result?.ok||!result?.onboarding)throw new Error('Feil PIN');
      onboarding=true;write(PIN_KEY,ACCESS_PIN);if(input)input.value='';showCreate();
    }catch(e){showPin(e?.message==='Feil access-PIN'?'Feil PIN.':(e?.message||'Kunne ikke åpne registrering.'))}
  }

  async function createOnboardingPlayer(){
    const name=document.getElementById('newPlayerName')?.value.trim()||'';
    const playerPin=document.getElementById('newPlayerPin')?.value.trim()||'';
    const characterSet=Number(document.querySelector('input[name="characterSet"]:checked')?.value||1);
    const save=document.getElementById('saveNewPlayer');
    errorText('newPlayerError','');
    if(!/^[\p{L}\p{N}][\p{L}\p{N} .'-]{0,39}$/u.test(name)){errorText('newPlayerError','Bruk 1–40 tegn: bokstaver, tall, mellomrom, punktum, bindestrek eller apostrof.');return}
    if(!/^\d{4}$/.test(playerPin)){errorText('newPlayerError','PIN må være nøyaktig 4 tall.');return}
    if(playerPin===ACCESS_PIN){errorText('newPlayerError','0007 er reservert som access-PIN. Velg en annen personlig PIN.');return}
    if(save)save.disabled=true;
    try{
      const created=await api({action:'create_player',name,character_set:characterSet,player_pin:playerPin});
      if(!created?.id)throw new Error('Spilleren ble opprettet, men kunne ikke åpnes.');
      write(PIN_KEY,APP_PIN);write(PLAYER_ID_KEY,created.id);write(LEGACY_PLAYER_KEY,created.name||name);write(VERIFIED_PLAYER_KEY,created.id);onboarding=false;
      location.reload();
    }catch(e){errorText('newPlayerError',e?.message||'Kunne ikke opprette spiller.');if(save)save.disabled=false}
  }

  document.addEventListener('submit',e=>{
    const form=e.target;
    if(form?.id==='pinForm'){
      const pin=document.getElementById('pinInput')?.value.trim()||'';
      if(pin!==ACCESS_PIN)return;
      e.preventDefault();e.stopImmediatePropagation();enterOnboarding();return;
    }
    if(form?.id==='newPlayerForm'){
      const pin=document.getElementById('newPlayerPin')?.value.trim()||'';
      const active=onboarding||read(PIN_KEY)===ACCESS_PIN;
      if(pin===ACCESS_PIN||active){
        e.preventDefault();e.stopImmediatePropagation();
        if(pin===ACCESS_PIN){errorText('newPlayerError','0007 er reservert som access-PIN. Velg en annen personlig PIN.');return}
        createOnboardingPlayer();
      }
      return;
    }
    if(form?.id==='changePinForm'){
      const next=document.getElementById('nextPlayerPin')?.value.trim()||'';
      if(next===ACCESS_PIN){e.preventDefault();e.stopImmediatePropagation();errorText('changePinError','0007 er reservert som access-PIN og kan ikke brukes som karakter-PIN.')}
    }
  },true);

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('#cancelNewPlayer');
    if(!btn||!(onboarding||read(PIN_KEY)===ACCESS_PIN))return;
    e.preventDefault();e.stopImmediatePropagation();showPin();
  },true);
})();
