(()=>{
  if(window.__obdAdminV2Preview)return;
  window.__obdAdminV2Preview=true;

  const API='https://uqhwqvqafyrosrakljxt.supabase.co/functions/v1/admin-console-preview';
  const APP_PIN='1337';
  let adminPin='';
  let dashboard=null;
  let editingNotification=null;
  let checkingNotifications=false;

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byId=id=>document.getElementById(id);
  const localDateTime=iso=>{
    const d=iso?new Date(iso):new Date();
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const dateText=iso=>new Date(iso).toLocaleString('nb-NO',{timeZone:'Europe/Oslo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

  async function callApi(payload,{admin=true}={}){
    const body=admin?{...payload,admin_pin:adminPin}:{...payload,pin:APP_PIN};
    const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const text=await response.text();
    let data={};
    try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!response.ok)throw new Error(data?.error||text||`HTTP ${response.status}`);
    return data;
  }

  function ensureStyle(){
    if(byId('adminV2PreviewStyle'))return;
    const s=document.createElement('style');
    s.id='adminV2PreviewStyle';
    s.textContent=`
      .admin-v2-entry-wrap{position:sticky;bottom:-1px;z-index:8;margin-top:12px;padding:10px 0 3px;background:linear-gradient(180deg,rgba(7,16,26,0),#07101a 38%)}
      .admin-v2-entry{display:block!important;visibility:visible!important;opacity:1!important;width:max-content;min-width:92px;margin:0 auto;padding:8px 18px;border:1px solid rgba(255,210,75,.55);border-radius:999px;background:#132334;color:#ffe06b;font:900 10px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:lowercase;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.3)}
      .admin-v2-entry:active{transform:scale(.98)}
      .admin-v2-dialog{width:min(calc(100% - 18px),540px);max-height:92dvh;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:#07111a;color:#fff;box-shadow:0 28px 90px rgba(0,0,0,.72)}
      .admin-v2-dialog::backdrop{background:rgba(1,4,8,.88);backdrop-filter:blur(7px)}
      .admin-v2-shell{padding:17px}.admin-v2-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.admin-v2-head h2{margin:2px 0 0;font-size:24px}.admin-v2-kicker{color:#ffd24b;font-size:8px;font-weight:1000;letter-spacing:.16em}.admin-v2-close{width:35px;height:35px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:#0d1925;color:#c9d7e2;font-size:20px}
      .admin-v2-note{margin:10px 0;padding:10px;border:1px solid rgba(255,201,40,.18);border-radius:12px;background:rgba(255,201,40,.05);color:#d7c579;font-size:9px;line-height:1.45}
      .admin-v2-section{margin-top:14px;padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:#09151f}.admin-v2-section h3{margin:0 0 10px;font-size:15px}
      .admin-v2-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.admin-v2-field{display:grid;gap:5px}.admin-v2-field.full{grid-column:1/-1}.admin-v2-field span{color:#8da0b1;font-size:7px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.admin-v2-field input,.admin-v2-field textarea,.admin-v2-field select{box-sizing:border-box;width:100%;border:1px solid #263b4e;border-radius:10px;background:#050c12;color:#fff;padding:9px 10px;font:inherit;font-size:11px}.admin-v2-field textarea{min-height:90px;resize:vertical}
      .admin-v2-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.admin-v2-btn{min-height:37px;padding:0 11px;border:0;border-radius:10px;background:#17304a;color:#dbeaff;font-size:9px;font-weight:950;cursor:pointer}.admin-v2-btn.primary{background:linear-gradient(135deg,#f0b400,#ffd95e);color:#171006}.admin-v2-btn.danger{background:#551827;color:#ffb1c0}.admin-v2-btn:disabled{opacity:.38;cursor:not-allowed}.admin-v2-error{min-height:15px;margin-top:7px;color:#ff8ea5;font-size:9px;font-weight:850}.admin-v2-success{color:#7be0a6}
      .admin-v2-player,.admin-v2-notification{margin-top:8px;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:#061019}.admin-v2-player-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.admin-v2-player-top strong{font-size:13px}.admin-v2-player-top small{color:#7f93a5;font-size:8px}.admin-v2-stats{margin-top:5px;color:#8fa3b5;font-size:8px;line-height:1.45}.admin-v2-controls{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.admin-v2-notification strong{display:block;font-size:11px}.admin-v2-notification p{margin:4px 0;color:#90a3b3;font-size:9px;line-height:1.4;white-space:pre-wrap}.admin-v2-notification small{color:#6f8293;font-size:7px}
      .admin-v2-login{padding:20px}.admin-v2-login h3{margin:0 0 5px}.admin-v2-login p{margin:0 0 12px;color:#8fa1b1;font-size:10px}.admin-v2-login input{box-sizing:border-box;width:100%;height:48px;border:1px solid #2b4154;border-radius:12px;background:#050c12;color:#fff;padding:0 12px;font-size:20px;font-weight:900;letter-spacing:.18em}.admin-v2-login-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .admin-v2-alert{width:min(calc(100% - 24px),420px);padding:0;border:1px solid rgba(255,211,77,.22);border-radius:20px;background:#08131d;color:#fff}.admin-v2-alert::backdrop{background:rgba(1,4,8,.86);backdrop-filter:blur(6px)}.admin-v2-alert-card{padding:20px}.admin-v2-alert-card h2{margin:4px 0 8px;font-size:23px}.admin-v2-alert-card p{margin:0;color:#a4b5c3;font-size:12px;line-height:1.55;white-space:pre-wrap}.admin-v2-alert-card button{width:100%;min-height:44px;margin-top:16px;border:0;border-radius:11px;background:linear-gradient(135deg,#f0b400,#ffd95e);color:#171006;font-weight:1000}
      @media(max-width:420px){.admin-v2-shell{padding:14px}.admin-v2-grid,.admin-v2-controls{grid-template-columns:1fr}.admin-v2-field.full{grid-column:auto}}
    `;
    document.head.appendChild(s);
  }

  function ensureEntry(){
    ensureStyle();
    const step=byId('playerStep');
    if(!step)return false;
    step.querySelectorAll('[data-admin-entry],.admin-v2-entry-wrap').forEach(el=>el.remove());
    const wrap=document.createElement('div');
    wrap.className='admin-v2-entry-wrap';
    wrap.innerHTML='<button id="adminV2Entry" class="admin-v2-entry" data-admin-entry="v2" type="button">admin</button>';
    step.appendChild(wrap);
    byId('adminV2Entry').addEventListener('click',openLogin);
    return true;
  }

  function ensureDialogs(){
    ensureStyle();
    if(!byId('adminV2LoginDialog')){
      const d=document.createElement('dialog');d.id='adminV2LoginDialog';d.className='admin-v2-dialog';
      d.innerHTML=`<form id="adminV2LoginForm" class="admin-v2-login" novalidate><span class="admin-v2-kicker">PREVIEW ADMIN</span><h3>Admin</h3><p>Skriv admin-passord.</p><input id="adminV2Pin" type="password" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="••••"><div id="adminV2LoginError" class="admin-v2-error"></div><div class="admin-v2-login-actions"><button class="admin-v2-btn" type="button" id="adminV2LoginCancel">Avbryt</button><button class="admin-v2-btn primary" type="submit">Åpne</button></div></form>`;
      document.body.appendChild(d);
      byId('adminV2LoginCancel').addEventListener('click',()=>d.close());
      byId('adminV2LoginForm').addEventListener('submit',login);
      byId('adminV2Pin').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,8));
    }
    if(!byId('adminV2Dialog')){
      const d=document.createElement('dialog');d.id='adminV2Dialog';d.className='admin-v2-dialog';d.innerHTML='<div id="adminV2Body" class="admin-v2-shell"></div>';document.body.appendChild(d);
    }
    if(!byId('adminV2Alert')){
      const d=document.createElement('dialog');d.id='adminV2Alert';d.className='admin-v2-alert';d.innerHTML='<div class="admin-v2-alert-card"><span class="admin-v2-kicker">MELDING</span><h2 id="adminV2AlertTitle"></h2><p id="adminV2AlertBody"></p><button id="adminV2AlertOk" type="button">OK</button></div>';document.body.appendChild(d);
    }
  }

  function openLogin(){
    ensureDialogs();
    const form=byId('adminV2LoginForm');form.reset();byId('adminV2LoginError').textContent='';
    const d=byId('adminV2LoginDialog');if(!d.open)d.showModal();setTimeout(()=>byId('adminV2Pin')?.focus(),40);
  }

  async function login(e){
    e.preventDefault();
    const error=byId('adminV2LoginError');error.textContent='';adminPin=byId('adminV2Pin').value.trim();
    try{await callApi({action:'login'});byId('adminV2LoginDialog').close();await openAdmin()}catch(err){adminPin='';error.textContent=err.message||'Feil admin-PIN'}
  }

  async function loadDashboard(){dashboard=await callApi({action:'dashboard'});renderAdmin()}
  async function openAdmin(){
    ensureDialogs();
    const d=byId('adminV2Dialog');if(!d.open)d.showModal();byId('adminV2Body').innerHTML='<span class="admin-v2-kicker">PREVIEW ADMIN</span><h2>Laster…</h2>';
    try{await loadDashboard()}catch(err){byId('adminV2Body').innerHTML=`<div class="admin-v2-head"><div><span class="admin-v2-kicker">PREVIEW ADMIN</span><h2>Feil</h2></div><button class="admin-v2-close" type="button" id="adminV2Close">×</button></div><div class="admin-v2-error">${esc(err.message)}</div>`;byId('adminV2Close').onclick=()=>d.close()}
  }

  function renderNotifications(){
    const rows=dashboard?.notifications||[];
    if(!rows.length)return '<div class="admin-v2-note">Ingen notifikasjoner ennå.</div>';
    return rows.map(n=>`<div class="admin-v2-notification"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><small>${dateText(n.starts_at)} → ${dateText(n.ends_at)} · lest ${Number(n.read_count)||0}${n.archived_at?' · arkivert':''}</small><div class="admin-v2-actions"><button class="admin-v2-btn" type="button" data-edit-notification="${esc(n.id)}">Rediger</button>${n.archived_at?'':`<button class="admin-v2-btn danger" type="button" data-delete-notification="${esc(n.id)}">Slett</button>`}</div></div>`).join('');
  }

  function renderPlayer(p){
    const disabled=p.editable?'':'disabled';
    const starter=Number(p.starter_pokemon)||0;
    return `<div class="admin-v2-player"><div class="admin-v2-player-top"><strong>${esc(p.name)}</strong><small>${p.editable?'KAN REDIGERES':'LÅST I PREVIEW'}</small></div><div class="admin-v2-stats">Level ${Number(p.level)||1} · ${Number(p.xp)||0} XP · ${Number(p.total_days)||0} treningsdager · GymDex ${Number(p.gymdex_count)||0}</div><div class="admin-v2-controls"><label class="admin-v2-field"><span>Karakter</span><select id="character-${esc(p.id)}" ${disabled}><option value="1" ${Number(p.character_set)===1?'selected':''}>Character 1</option><option value="2" ${Number(p.character_set)===2?'selected':''}>Character 2</option><option value="3" ${Number(p.character_set)===3?'selected':''}>Character 3</option></select></label><div class="admin-v2-actions"><button class="admin-v2-btn" data-save-character="${esc(p.id)}" ${disabled}>Lagre karakter</button></div><label class="admin-v2-field"><span>Starter</span><select id="starter-${esc(p.id)}" ${disabled}><option value="1" ${starter===1?'selected':''}>Bulbasaur</option><option value="4" ${starter===4?'selected':''}>Charmander</option><option value="7" ${starter===7?'selected':''}>Squirtle</option></select></label><div class="admin-v2-actions"><button class="admin-v2-btn" data-save-starter="${esc(p.id)}" ${disabled}>Bytt starter</button></div><label class="admin-v2-field"><span>Ny PIN</span><input id="pin-${esc(p.id)}" maxlength="4" inputmode="numeric" ${disabled} placeholder="4 tall"></label><div class="admin-v2-actions"><button class="admin-v2-btn" data-save-pin="${esc(p.id)}" ${disabled}>Endre PIN</button></div></div><div class="admin-v2-actions"><button class="admin-v2-btn" data-reset-game="${esc(p.id)}" ${disabled}>Nullstill spillprogresjon</button><button class="admin-v2-btn danger" data-delete-player="${esc(p.id)}" data-player-name="${esc(p.name)}" ${disabled}>Slett spiller</button></div></div>`;
  }

  function renderAdmin(){
    const d=byId('adminV2Body');
    const now=new Date();const end=new Date(now.getTime()+7*864e5);const n=editingNotification||{};
    d.innerHTML=`<div class="admin-v2-head"><div><span class="admin-v2-kicker">PREVIEW ADMIN</span><h2>Kontrollpanel</h2></div><button class="admin-v2-close" id="adminV2Close" type="button">×</button></div><div class="admin-v2-note">Preview-sikkerhet: spillerendringer er kun aktivert for <strong>Test</strong>. Notifikasjoner gjelder kun preview.</div><section class="admin-v2-section"><h3>Publiser notifikasjon</h3><form id="notificationForm"><div class="admin-v2-grid"><label class="admin-v2-field full"><span>Tittel</span><input id="notificationTitle" maxlength="100" value="${esc(n.title||'')}"></label><label class="admin-v2-field full"><span>Tekst</span><textarea id="notificationBody" maxlength="2000">${esc(n.body||'')}</textarea></label><label class="admin-v2-field"><span>Start</span><input id="notificationStart" type="datetime-local" value="${n.starts_at?localDateTime(n.starts_at):localDateTime(now)}"></label><label class="admin-v2-field"><span>Slutt</span><input id="notificationEnd" type="datetime-local" value="${n.ends_at?localDateTime(n.ends_at):localDateTime(end)}"></label></div><div id="notificationError" class="admin-v2-error"></div><div class="admin-v2-actions"><button class="admin-v2-btn primary" type="submit">${editingNotification?'Lagre endring':'Publiser notifikasjon'}</button>${editingNotification?'<button class="admin-v2-btn" id="cancelNotificationEdit" type="button">Avbryt redigering</button>':''}</div></form></section><section class="admin-v2-section"><h3>Publiserte notifikasjoner</h3>${renderNotifications()}</section><section class="admin-v2-section"><h3>Spillere</h3>${(dashboard?.players||[]).map(renderPlayer).join('')||'<div class="admin-v2-note">Ingen spillere.</div>'}</section><div id="adminV2Global" class="admin-v2-error"></div>`;
    byId('adminV2Close').onclick=()=>byId('adminV2Dialog').close();
    byId('notificationForm').addEventListener('submit',saveNotification);
    byId('cancelNotificationEdit')?.addEventListener('click',()=>{editingNotification=null;renderAdmin()});
    d.querySelectorAll('[data-edit-notification]').forEach(b=>b.onclick=()=>{editingNotification=(dashboard.notifications||[]).find(n=>n.id===b.dataset.editNotification)||null;renderAdmin()});
    d.querySelectorAll('[data-delete-notification]').forEach(b=>b.onclick=()=>deleteNotification(b.dataset.deleteNotification));
    d.querySelectorAll('[data-save-character]').forEach(b=>b.onclick=()=>saveCharacter(b.dataset.saveCharacter));
    d.querySelectorAll('[data-save-starter]').forEach(b=>b.onclick=()=>saveStarter(b.dataset.saveStarter));
    d.querySelectorAll('[data-save-pin]').forEach(b=>b.onclick=()=>savePin(b.dataset.savePin));
    d.querySelectorAll('[data-reset-game]').forEach(b=>b.onclick=()=>resetGame(b.dataset.resetGame));
    d.querySelectorAll('[data-delete-player]').forEach(b=>b.onclick=()=>deletePlayer(b.dataset.deletePlayer,b.dataset.playerName));
  }

  async function saveNotification(e){
    e.preventDefault();const err=byId('notificationError');err.textContent='';
    const payload={title:byId('notificationTitle').value.trim(),body:byId('notificationBody').value.trim(),starts_at:new Date(byId('notificationStart').value).toISOString(),ends_at:new Date(byId('notificationEnd').value).toISOString()};
    try{if(editingNotification)await callApi({action:'update_notification',id:editingNotification.id,...payload});else await callApi({action:'create_notification',...payload});editingNotification=null;await loadDashboard()}catch(e){err.textContent=e.message||'Kunne ikke lagre'}
  }
  async function deleteNotification(id){if(!confirm('Slette denne notifikasjonen?'))return;await actionAndReload({action:'delete_notification',id})}
  async function saveCharacter(id){await actionAndReload({action:'update_character',player_id:id,character_set:Number(byId(`character-${id}`).value)})}
  async function saveStarter(id){const starter=Number(byId(`starter-${id}`).value);if(!confirm('Bytte starter? Opprinnelig starter fjernes fra GymDex og erstattes med den nye.'))return;await actionAndReload({action:'update_starter',player_id:id,starter_pokemon:starter})}
  async function savePin(id){const value=byId(`pin-${id}`).value.trim();await actionAndReload({action:'update_pin',player_id:id,new_pin:value})}
  async function resetGame(id){if(!confirm('Nullstille spillprogresjon for Test? Treningsloggen beholdes.'))return;await actionAndReload({action:'reset_game',player_id:id})}
  async function deletePlayer(id,name){if(!confirm(`Slette ${name}? Dette kan ikke angres.`))return;await actionAndReload({action:'delete_player',player_id:id,confirm:name})}
  async function actionAndReload(payload){const out=byId('adminV2Global');if(out)out.textContent='';try{await callApi(payload);await loadDashboard()}catch(e){if(out)out.textContent=e.message||'Handlingen feilet';else alert(e.message||'Handlingen feilet')}}

  async function showNotification(n){
    ensureDialogs();byId('adminV2AlertTitle').textContent=n.title||'Melding';byId('adminV2AlertBody').textContent=n.body||'';const d=byId('adminV2Alert');if(!d.open)d.showModal();
    await new Promise(resolve=>{const ok=byId('adminV2AlertOk');const done=()=>{ok.removeEventListener('click',done);d.close();resolve()};ok.addEventListener('click',done)});
  }
  async function checkNotifications(){
    if(checkingNotifications)return;const playerId=window.getSelectedPlayerId?.();if(!playerId)return;checkingNotifications=true;
    try{const data=await callApi({action:'active_notifications',player_id:playerId},{admin:false});for(const n of data.notifications||[]){await showNotification(n);await callApi({action:'ack_notification',player_id:playerId,notification_id:n.id},{admin:false})}}catch(e){console.warn('Preview notification check failed',e)}finally{checkingNotifications=false}
  }

  ensureStyle();
  ensureDialogs();
  ensureEntry();
  setTimeout(ensureEntry,0);
  setTimeout(ensureEntry,250);
  window.addEventListener('obd-auth-ready',()=>{ensureEntry();setTimeout(checkNotifications,100)});
  window.addEventListener('obd-player-changed',()=>{ensureEntry();setTimeout(checkNotifications,100)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(checkNotifications,100)});
})();
