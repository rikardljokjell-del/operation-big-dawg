(()=>{
  if(window.__obdAdminPreview)return;
  window.__obdAdminPreview=true;

  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/admin-console-preview';
  const APP_PIN='1337';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let adminPin='';
  let dashboard=null;
  let editingNotification=null;
  let notificationBusy=false;

  async function api(payload,{admin=false}={}){
    const body=admin?{...payload,admin_pin:adminPin}:{...payload,pin:APP_PIN};
    const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const text=await response.text();let data={};
    try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!response.ok)throw new Error(data.error||text||'Admin-kall feilet');
    return data;
  }

  function ensureStyle(){
    if(document.getElementById('adminPreviewStyle'))return;
    const style=document.createElement('style');style.id='adminPreviewStyle';style.textContent=`
      .admin-entry{display:block;margin:16px auto 0;padding:5px 11px;border:1px solid rgba(148,163,184,.22);border-radius:999px;background:transparent;color:#718397;font-size:8px;font-weight:900;letter-spacing:.12em;text-transform:lowercase;cursor:pointer}.admin-entry:hover{color:#d5e3ef;border-color:rgba(148,163,184,.4)}
      .admin-dialog{width:min(calc(100% - 18px),520px);max-height:92vh;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:#07111a;color:#fff;box-shadow:0 28px 90px rgba(0,0,0,.72)}.admin-dialog::backdrop{background:rgba(1,4,8,.88);backdrop-filter:blur(7px)}.admin-shell{padding:18px}.admin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.admin-head h2{margin:2px 0 0;font-size:24px}.admin-kicker{color:#ffd24b;font-size:8px;font-weight:1000;letter-spacing:.16em}.admin-close{width:34px;height:34px;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:#0c1823;color:#9eb0c0;font-size:20px;cursor:pointer}.admin-note{margin:10px 0;padding:9px 10px;border:1px solid rgba(255,201,40,.17);border-radius:11px;background:rgba(255,201,40,.05);color:#d5c279;font-size:9px;line-height:1.45}.admin-section{margin-top:15px;padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:#09151f}.admin-section h3{margin:0 0 10px;font-size:15px}.admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.admin-field{display:grid;gap:5px}.admin-field.full{grid-column:1/-1}.admin-field span{color:#8da0b1;font-size:7px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.admin-field input,.admin-field textarea,.admin-field select{box-sizing:border-box;width:100%;border:1px solid #263b4e;border-radius:10px;background:#050c12;color:#fff;padding:9px 10px;font:inherit;font-size:11px;outline:none}.admin-field textarea{min-height:92px;resize:vertical}.admin-field input:focus,.admin-field textarea:focus,.admin-field select:focus{border-color:#ffd24b}.admin-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.admin-btn{min-height:37px;padding:0 11px;border:0;border-radius:10px;background:#17304a;color:#dbeaff;font-size:9px;font-weight:950;cursor:pointer}.admin-btn.primary{background:linear-gradient(135deg,#f0b400,#ffd95e);color:#171006}.admin-btn.danger{background:#551827;color:#ffb1c0}.admin-btn:disabled{opacity:.4;cursor:not-allowed}.admin-error{min-height:15px;margin-top:7px;color:#ff8ea5;font-size:9px;font-weight:850}.admin-success{color:#7be0a6}.admin-player{margin-top:8px;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:#061019}.admin-player-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.admin-player-top strong{font-size:13px}.admin-player-top small{color:#7f93a5;font-size:8px}.admin-player-stats{margin-top:5px;color:#8fa3b5;font-size:8px;line-height:1.45}.admin-player-controls{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.admin-notification{margin-top:7px;padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:#061019}.admin-notification strong{display:block;font-size:11px}.admin-notification p{margin:4px 0;color:#90a3b3;font-size:9px;line-height:1.4}.admin-notification small{color:#6f8293;font-size:7px}.admin-login{padding:20px}.admin-login h3{margin:0 0 5px}.admin-login p{margin:0 0 12px;color:#8fa1b1;font-size:10px}.admin-login input{box-sizing:border-box;width:100%;height:48px;border:1px solid #2b4154;border-radius:12px;background:#050c12;color:#fff;padding:0 12px;font-size:20px;font-weight:900;letter-spacing:.18em}.admin-login-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .admin-alert{width:min(calc(100% - 24px),420px);padding:0;border:1px solid rgba(255,211,77,.22);border-radius:20px;background:#08131d;color:#fff;box-shadow:0 28px 90px rgba(0,0,0,.7)}.admin-alert::backdrop{background:rgba(1,4,8,.86);backdrop-filter:blur(6px)}.admin-alert-card{padding:20px}.admin-alert-card h2{margin:4px 0 8px;font-size:23px}.admin-alert-card p{margin:0;color:#a4b5c3;font-size:12px;line-height:1.55;white-space:pre-wrap}.admin-alert-card button{width:100%;min-height:44px;margin-top:16px;border:0;border-radius:11px;background:linear-gradient(135deg,#f0b400,#ffd95e);color:#171006;font-weight:1000}
      @media(max-width:420px){.admin-shell{padding:14px}.admin-grid,.admin-player-controls{grid-template-columns:1fr}.admin-field.full{grid-column:auto}}
    `;document.head.appendChild(style);
  }

  function ensureDialogs(){
    ensureStyle();
    if(!document.getElementById('adminLoginDialog')){
      const login=document.createElement('dialog');login.id='adminLoginDialog';login.className='admin-dialog';login.innerHTML=`<form id="adminLoginForm" class="admin-login" novalidate><span class="admin-kicker">PREVIEW ADMIN</span><h3>Admin</h3><p>Skriv admin-passord.</p><input id="adminPinInput" type="password" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="••••"><div id="adminLoginError" class="admin-error"></div><div class="admin-login-actions"><button class="admin-btn" type="button" data-admin-login-cancel>Avbryt</button><button id="adminLoginSubmit" class="admin-btn primary" type="submit">Åpne</button></div></form>`;document.body.appendChild(login);
      login.querySelector('[data-admin-login-cancel]').addEventListener('click',()=>login.close());
      login.addEventListener('cancel',e=>{e.preventDefault();login.close()});
      login.querySelector('#adminPinInput').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,8));
      login.querySelector('#adminLoginForm').addEventListener('submit',loginAdmin);
    }
    if(!document.getElementById('adminDialog')){
      const dialog=document.createElement('dialog');dialog.id='adminDialog';dialog.className='admin-dialog';dialog.innerHTML='<div id="adminDialogBody" class="admin-shell"></div>';document.body.appendChild(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close()});
    }
    if(!document.getElementById('adminNotificationAlert')){
      const alert=document.createElement('dialog');alert.id='adminNotificationAlert';alert.className='admin-alert';alert.innerHTML='<div class="admin-alert-card"><span class="admin-kicker">MELDING</span><h2 id="adminAlertTitle"></h2><p id="adminAlertText"></p><button id="adminAlertOk" type="button">OK</button></div>';document.body.appendChild(alert);
    }
  }

  function injectEntry(){
    const step=document.getElementById('playerStep');if(!step||step.querySelector('[data-admin-entry]'))return;
    const button=document.createElement('button');button.type='button';button.className='admin-entry';button.dataset.adminEntry='1';button.textContent='admin';button.addEventListener('click',openLogin);step.appendChild(button);
  }

  function openLogin(){ensureDialogs();const d=document.getElementById('adminLoginDialog');document.getElementById('adminLoginForm').reset();document.getElementById('adminLoginError').textContent='';d.showModal();setTimeout(()=>document.getElementById('adminPinInput').focus(),50)}
  async function loginAdmin(e){e.preventDefault();const pin=document.getElementById('adminPinInput').value.trim(),error=document.getElementById('adminLoginError'),button=document.getElementById('adminLoginSubmit');error.textContent='';button.disabled=true;try{adminPin=pin;await api({action:'login'},{admin:true});document.getElementById('adminLoginDialog').close();await openAdmin()}catch(err){adminPin='';error.textContent=err.message||'Feil admin-PIN'}finally{button.disabled=false}}

  const dtLocal=iso=>{const d=new Date(iso),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const defaultTimes=()=>{const start=new Date(),end=new Date(start.getTime()+7*864e5);return{start:dtLocal(start),end:dtLocal(end)}};
  const dateText=iso=>new Date(iso).toLocaleString('nb-NO',{timeZone:'Europe/Oslo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

  async function loadDashboard(){dashboard=await api({action:'dashboard'},{admin:true});renderAdmin()}
  async function openAdmin(){ensureDialogs();const d=document.getElementById('adminDialog');d.showModal();document.getElementById('adminDialogBody').innerHTML='<div class="admin-head"><div><span class="admin-kicker">PREVIEW ADMIN</span><h2>Laster…</h2></div></div>';try{await loadDashboard()}catch(err){document.getElementById('adminDialogBody').innerHTML=`<div class="admin-head"><div><span class="admin-kicker">PREVIEW ADMIN</span><h2>Feil</h2></div><button class="admin-close" data-admin-close>×</button></div><div class="admin-error">${esc(err.message)}</div>`;bindClose()}}
  function bindClose(){document.querySelector('[data-admin-close]')?.addEventListener('click',()=>document.getElementById('adminDialog').close())}

  function renderAdmin(){
    const times=defaultTimes(),n=editingNotification||{};
    const body=document.getElementById('adminDialogBody');
    body.innerHTML=`
      <div class="admin-head"><div><span class="admin-kicker">PREVIEW ADMIN</span><h2>Kontrollpanel</h2></div><button class="admin-close" data-admin-close>×</button></div>
      <div class="admin-note">Preview-sikkerhet: spillerendringer er låst til <strong>Test</strong>. Notifikasjoner publiseres kun i preview-miljøet.</div>
      <section class="admin-section"><h3>Publiser notifikasjon</h3><form id="adminNotificationForm"><div class="admin-grid"><label class="admin-field full"><span>Tittel</span><input id="adminNotificationTitle" maxlength="100" value="${esc(n.title||'')}"></label><label class="admin-field full"><span>Tekst</span><textarea id="adminNotificationText" maxlength="2000">${esc(n.body||'')}</textarea></label><label class="admin-field"><span>Start</span><input id="adminNotificationStart" type="datetime-local" value="${n.starts_at?dtLocal(n.starts_at):times.start}"></label><label class="admin-field"><span>Slutt</span><input id="adminNotificationEnd" type="datetime-local" value="${n.ends_at?dtLocal(n.ends_at):times.end}"></label></div><div id="adminNotificationError" class="admin-error"></div><div class="admin-actions"><button class="admin-btn primary" type="submit">${editingNotification?'Lagre endring':'Publiser notifikasjon'}</button>${editingNotification?'<button class="admin-btn" type="button" data-cancel-notification-edit>Avbryt redigering</button>':''}</div></form></section>
      <section class="admin-section"><h3>Publiserte notifikasjoner</h3><div id="adminNotificationList">${renderNotifications()}</div></section>
      <section class="admin-section"><h3>Spillere</h3>${(dashboard?.players||[]).map(renderPlayer).join('')||'<div class="admin-note">Ingen spillere.</div>'}</section>
      <div id="adminGlobalMessage" class="admin-error"></div>`;
    bindClose();
    document.getElementById('adminNotificationForm').addEventListener('submit',saveNotification);
    document.querySelector('[data-cancel-notification-edit]')?.addEventListener('click',()=>{editingNotification=null;renderAdmin()});
    body.querySelectorAll('[data-edit-notification]').forEach(btn=>btn.addEventListener('click',()=>{editingNotification=(dashboard.notifications||[]).find(x=>x.id===btn.dataset.editNotification)||null;renderAdmin()}));
    body.querySelectorAll('[data-delete-notification]').forEach(btn=>btn.addEventListener('click',()=>archiveNotification(btn.dataset.deleteNotification)));
    body.querySelectorAll('[data-save-character]').forEach(btn=>btn.addEventListener('click',()=>saveCharacter(btn.dataset.saveCharacter)));
    body.querySelectorAll('[data-save-starter]').forEach(btn=>btn.addEventListener('click',()=>saveStarter(btn.dataset.saveStarter)));
    body.querySelectorAll('[data-save-pin]').forEach(btn=>btn.addEventListener('click',()=>savePin(btn.dataset.savePin)));
    body.querySelectorAll('[data-reset-game]').forEach(btn=>btn.addEventListener('click',()=>resetGame(btn.dataset.resetGame)));
    body.querySelectorAll('[data-delete-admin-player]').forEach(btn=>btn.addEventListener('click',()=>deletePlayer(btn.dataset.deleteAdminPlayer)));
  }

  function renderNotifications(){return(dashboard?.notifications||[]).map(n=>`<div class="admin-notification"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><small>${dateText(n.starts_at)} → ${dateText(n.ends_at)} · lest ${Number(n.read_count)||0}${n.archived_at?' · arkivert':''}</small><div class="admin-actions"><button class="admin-btn" type="button" data-edit-notification="${esc(n.id)}">Rediger</button>${n.archived_at?'':'<button class="admin-btn danger" type="button" data-delete-notification="'+esc(n.id)+'">Slett</button>'}</div></div>`).join('')||'<div class="admin-note">Ingen notifikasjoner ennå.</div>'}
  function renderPlayer(p){const disabled=p.editable?'':'disabled',starter=Number(p.starter_pokemon)||0;return`<div class="admin-player"><div class="admin-player-top"><strong>${esc(p.name)}</strong><small>${p.editable?'KAN REDIGERES':'LÅST I PREVIEW'}</small></div><div class="admin-player-stats">Level ${Number(p.level)||1} · ${Number(p.xp)||0} XP · ${Number(p.total_days)||0} treningsdager · GymDex ${Number(p.gymdex_count)||0} · Wild: ${esc(p.wild_status||'locked')}</div><div class="admin-player-controls"><label class="admin-field"><span>Karakter</span><select id="adminCharacter-${esc(p.id)}" ${disabled}><option value="1" ${Number(p.character_set)===1?'selected':''}>Character 1</option><option value="2" ${Number(p.character_set)===2?'selected':''}>Character 2</option><option value="3" ${Number(p.character_set)===3?'selected':''}>Character 3</option></select></label><label class="admin-field"><span>Starter Pokémon</span><select id="adminStarter-${esc(p.id)}" ${disabled}><option value="1" ${starter===1?'selected':''}>Bulbasaur</option><option value="4" ${starter===4?'selected':''}>Charmander</option><option value="7" ${starter===7?'selected':''}>Squirtle</option></select></label><button class="admin-btn" type="button" data-save-character="${esc(p.id)}" ${disabled}>Lagre karakter</button><button class="admin-btn" type="button" data-save-starter="${esc(p.id)}" ${disabled}>Bytt starter</button><label class="admin-field"><span>Ny PIN</span><input id="adminPin-${esc(p.id)}" inputmode="numeric" maxlength="4" placeholder="4 tall" ${disabled}></label><button class="admin-btn" type="button" data-save-pin="${esc(p.id)}" ${disabled}>Endre PIN</button><button class="admin-btn" type="button" data-reset-game="${esc(p.id)}" ${disabled}>Reparer/nullstill spillstatus</button><button class="admin-btn danger" type="button" data-delete-admin-player="${esc(p.id)}" ${disabled}>Slett spiller</button></div></div>`}

  async function withGlobal(fn){const msg=document.getElementById('adminGlobalMessage');if(msg)msg.textContent='';try{await fn();await loadDashboard();if(msg)msg.textContent=''}catch(err){const target=document.getElementById('adminGlobalMessage');if(target)target.textContent=err.message||'Operasjonen feilet'}}
  async function saveNotification(e){e.preventDefault();const error=document.getElementById('adminNotificationError'),title=document.getElementById('adminNotificationTitle').value.trim(),body=document.getElementById('adminNotificationText').value.trim(),starts=document.getElementById('adminNotificationStart').value,ends=document.getElementById('adminNotificationEnd').value;error.textContent='';if(!title||!body||!starts||!ends){error.textContent='Fyll ut alle feltene.';return}try{const payload={action:editingNotification?'update_notification':'create_notification',title,body,starts_at:new Date(starts).toISOString(),ends_at:new Date(ends).toISOString()};if(editingNotification)payload.id=editingNotification.id;await api(payload,{admin:true});editingNotification=null;await loadDashboard()}catch(err){error.textContent=err.message}}
  async function archiveNotification(id){if(!confirm('Slette denne notifikasjonen fra preview?'))return;await withGlobal(()=>api({action:'delete_notification',id},{admin:true}))}
  async function saveCharacter(id){const value=Number(document.getElementById(`adminCharacter-${id}`).value);await withGlobal(()=>api({action:'update_character',player_id:id,character_set:value},{admin:true}))}
  async function saveStarter(id){const value=Number(document.getElementById(`adminStarter-${id}`).value);if(!confirm('Bytte starter? Gammel starter fjernes fra GymDex og erstattes med den nye.'))return;await withGlobal(()=>api({action:'update_starter',player_id:id,starter_pokemon:value},{admin:true}))}
  async function savePin(id){const input=document.getElementById(`adminPin-${id}`),pin=input.value.trim();if(!/^\d{4}$/.test(pin)){document.getElementById('adminGlobalMessage').textContent='PIN må være 4 tall.';return}await withGlobal(()=>api({action:'update_pin',player_id:id,new_pin:pin},{admin:true}))}
  async function resetGame(id){if(!confirm('Nullstille starter/Gym/Wild/spillstats for Test? Treningsøktene beholdes.'))return;await withGlobal(()=>api({action:'reset_game',player_id:id},{admin:true}))}
  async function deletePlayer(id){const p=(dashboard?.players||[]).find(x=>x.id===id);if(!p)return;const typed=prompt(`Skriv ${p.name} for å bekrefte permanent sletting:`);if(typed!==p.name)return;await withGlobal(()=>api({action:'delete_player',player_id:id,confirm:typed},{admin:true}))}

  async function checkNotifications(){
    if(notificationBusy)return;const playerId=window.getSelectedPlayerId?.()||'';if(!playerId)return;notificationBusy=true;
    try{
      const result=await api({action:'active_notifications',player_id:playerId});
      const list=Array.isArray(result.notifications)?result.notifications:[];
      for(const n of list){
        await showNotification(n);
        try{await api({action:'ack_notification',player_id:playerId,notification_id:n.id})}catch(error){console.warn('Notification ack failed',error)}
      }
    }catch(error){console.warn('Notification check failed',error)}finally{notificationBusy=false}
  }
  function showNotification(n){ensureDialogs();return new Promise(resolve=>{const d=document.getElementById('adminNotificationAlert'),ok=document.getElementById('adminAlertOk');document.getElementById('adminAlertTitle').textContent=n.title||'Melding';document.getElementById('adminAlertText').textContent=n.body||'';const done=()=>{ok.removeEventListener('click',done);try{d.close()}catch{}resolve()};ok.addEventListener('click',done);d.showModal()})}

  ensureDialogs();
  const observer=new MutationObserver(()=>injectEntry());observer.observe(document.documentElement,{subtree:true,childList:true});
  injectEntry();setTimeout(injectEntry,100);setTimeout(injectEntry,500);
  window.addEventListener('obd-auth-ready',()=>{injectEntry();setTimeout(checkNotifications,100)});
  window.addEventListener('obd-player-changed',()=>{injectEntry();setTimeout(checkNotifications,100)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(checkNotifications,100)});
})();
