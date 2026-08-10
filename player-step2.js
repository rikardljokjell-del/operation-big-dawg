(()=>{
  window.__obdPlayerStep2Compat=true;
  if(typeof evolutionCard==='function'){
    evolutionCard=function(p){
      const i=levelInfo(p),slug=typeof characterSlug==='function'?characterSlug(p):(String(p).toLowerCase()==='adrian'?'adrian':'rikard');
      const thumbs=Array.from({length:10},(_,idx)=>{
        const level=idx+1,state=level===i.level?'current':level>i.level?'future':'unlocked',title=level>i.level?`Level ${level} · Locked`:`Level ${level}: ${RANKS[idx]}`;
        return `<div class="evo-thumb ${state}" title="${title}"><img src="characters/${slug}-${level}.png" alt="${level>i.level?'Skjult kommende evolution':`${p} Level ${level}`}" draggable="false"><span>${level}</span></div>`;
      }).join('');
      return `<div class="evolution-head"><strong>${p}s evolution</strong><span>Level ${i.level} / 10</span></div><div class="evolution-track">${thumbs}</div>`;
    };
  }

  function initPlayerManagement(){
    if(window.__obdPlayerManagementReady)return;
    const section=document.querySelector('.danger-section');
    if(!section)return;
    window.__obdPlayerManagementReady=true;

    const style=document.createElement('style');
    style.textContent=`
      .player-account-section{display:grid;gap:10px}.player-account-card{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px;border-radius:18px;background:linear-gradient(145deg,#0b1723,#07111b);border:1px solid rgba(148,163,184,.12)}.player-account-card>div{min-width:0}.player-account-card h3{margin:3px 0 4px;font-size:16px}.player-account-card p{margin:0;color:#8195a9;font-size:10px;line-height:1.45}.player-account-card .btn{flex:0 0 auto;min-width:112px}.player-account-card.delete-card{border-color:rgba(255,53,93,.22);background:linear-gradient(145deg,#151018,#0b0d14)}.player-account-card.delete-card p{color:#a98d96}.account-dialog{width:min(calc(100% - 24px),390px);padding:0;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:#08131e;color:#fff;box-shadow:0 24px 70px rgba(0,0,0,.58)}.account-dialog::backdrop{background:rgba(1,5,9,.82);backdrop-filter:blur(5px)}.account-dialog-card{padding:20px}.account-dialog .section-kicker{display:block;margin-bottom:5px}.account-dialog h3{margin:0 0 7px;font-size:23px;line-height:1}.account-dialog p{margin:0 0 15px;color:#91a5b8;font-size:11px;line-height:1.5}.account-field{display:grid;gap:6px;margin-top:11px}.account-field span{color:#91a6ba;font-size:8px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.account-field input{box-sizing:border-box;width:100%;height:47px;border:1px solid #2c4055;border-radius:13px;background:#050d15;color:#fff;padding:0 13px;font-size:18px;font-weight:900;letter-spacing:.14em;outline:none}.account-field input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(255,201,40,.08)}.account-warning{margin-top:12px;padding:9px 10px;border:1px solid rgba(255,201,40,.15);border-radius:11px;background:rgba(255,201,40,.05);color:#d8c477;font-size:9px;line-height:1.45}.account-warning.danger{border-color:rgba(255,53,93,.24);background:rgba(255,53,93,.06);color:#ff91a7}.account-error{min-height:17px;margin-top:8px;color:#ff8ca3;font-size:10px;font-weight:850}.account-dialog-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.account-dialog-actions button{min-height:46px;border-radius:13px;font-weight:950;cursor:pointer}.account-cancel{border:1px solid rgba(148,163,184,.2);background:#0d1925;color:#cbd8e4}.account-save{border:0;background:linear-gradient(135deg,#ffb800,#ffe063);color:#171006}.account-delete{border:1px solid rgba(255,53,93,.35);background:rgba(255,53,93,.12);color:#ff9db0}.account-delete-final{border:0;background:#ff355d;color:#fff}@media(max-width:390px){.player-account-card{align-items:stretch;flex-direction:column}.player-account-card .btn{width:100%}.account-dialog-card{padding:17px}.account-dialog h3{font-size:21px}}
    `;
    document.head.appendChild(style);

    section.classList.add('player-account-section');
    section.innerHTML=`
      <article class="player-account-card">
        <div><span class="section-kicker">KARAKTER</span><h3>Endre PIN</h3><p>Endre den enkle 4-sifrede PIN-koden for <strong data-account-player></strong>.</p></div>
        <button id="changePlayerPin" class="btn undo" type="button">Endre PIN</button>
      </article>
      <article class="player-account-card delete-card">
        <div><span class="section-kicker">DANGER ZONE</span><h3>Slett karakter</h3><p>Sletter karakteren og all treningshistorikk som tilhører denne spilleren.</p></div>
        <button id="deletePlayer" class="btn danger" type="button">Slett karakter</button>
      </article>`;

    const changeDialog=document.createElement('dialog');
    changeDialog.id='changePinDialog';
    changeDialog.className='account-dialog';
    changeDialog.innerHTML=`<form id="changePinForm" class="account-dialog-card" novalidate><span class="section-kicker">KARAKTERSIKKERHET</span><h3>Endre PIN</h3><p id="changePinIntro"></p><label class="account-field"><span>Nåværende PIN</span><input id="currentPlayerPin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="••••"></label><label class="account-field"><span>Ny PIN · 4 tall</span><input id="nextPlayerPin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••"></label><div class="account-warning">⚠ PIN lagres ukryptert og er kun ment som enkel beskyttelse av karakteren.</div><div id="changePinError" class="account-error" aria-live="polite"></div><div class="account-dialog-actions"><button class="account-cancel" type="button" data-change-cancel>Avbryt</button><button id="changePinSave" class="account-save" type="submit">Lagre PIN</button></div></form>`;
    document.body.appendChild(changeDialog);

    const deleteDialog=document.createElement('dialog');
    deleteDialog.id='deletePlayerDialog';
    deleteDialog.className='account-dialog';
    deleteDialog.innerHTML=`<form id="deletePlayerForm" class="account-dialog-card" novalidate><span class="section-kicker">DANGER ZONE</span><h3 id="deletePlayerTitle">Slett karakter</h3><p>Tast inn den personlige PIN-koden for å fortsette.</p><label class="account-field"><span>Personlig PIN</span><input id="deletePlayerPin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="••••"></label><div id="deletePlayerError" class="account-error" aria-live="polite"></div><div class="account-dialog-actions"><button class="account-cancel" type="button" data-delete-cancel>Avbryt</button><button id="deletePlayerContinue" class="account-delete" type="submit">Slett karakter</button></div></form>`;
    document.body.appendChild(deleteDialog);

    const finalDialog=document.createElement('dialog');
    finalDialog.id='deletePlayerFinalDialog';
    finalDialog.className='account-dialog';
    finalDialog.innerHTML=`<div class="account-dialog-card"><span class="section-kicker">SISTE VARSEL</span><h3>Vil du virkelig slette?</h3><p id="deleteFinalText"></p><div class="account-warning danger">Dette kan ikke angres. Karakteren og all treningshistorikk for denne spilleren slettes permanent.</div><div id="deleteFinalError" class="account-error" aria-live="polite"></div><div class="account-dialog-actions"><button class="account-cancel" type="button" data-final-cancel>Avbryt</button><button id="deletePlayerFinal" class="account-delete-final" type="button">Ja, slett karakter</button></div></div>`;
    document.body.appendChild(finalDialog);

    let changePlayerId='';
    let deleteCandidate=null;
    const digits=input=>input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(0,4)});
    ['currentPlayerPin','nextPlayerPin','deletePlayerPin'].forEach(id=>digits(document.getElementById(id)));
    const selected=()=>({id:typeof window.getSelectedPlayerId==='function'?window.getSelectedPlayerId():'',name:typeof window.getSelectedPlayer==='function'?window.getSelectedPlayer():''});
    const refreshName=()=>document.querySelectorAll('[data-account-player]').forEach(el=>el.textContent=selected().name||'valgt spiller');
    const close=d=>{try{d.close()}catch{}};
    const notify=msg=>{if(typeof toast==='function')toast(msg)};

    refreshName();
    window.addEventListener('obd-player-changed',refreshName);

    document.getElementById('changePlayerPin').addEventListener('click',()=>{
      const p=selected();if(!p.id)return notify('Velg spiller først');
      changePlayerId=p.id;
      document.getElementById('changePinIntro').textContent=`Endrer PIN for ${p.name}.`;
      document.getElementById('changePinForm').reset();
      document.getElementById('changePinError').textContent='';
      changeDialog.showModal();
      setTimeout(()=>document.getElementById('currentPlayerPin').focus(),40);
    });
    document.querySelector('[data-change-cancel]').addEventListener('click',()=>close(changeDialog));
    document.getElementById('changePinForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const current=document.getElementById('currentPlayerPin').value;
      const next=document.getElementById('nextPlayerPin').value;
      const error=document.getElementById('changePinError');
      const save=document.getElementById('changePinSave');
      error.textContent='';
      if(!/^\d{4}$/.test(current)||!/^\d{4}$/.test(next)){error.textContent='Begge PIN-kodene må være nøyaktig 4 tall.';return}
      if(current===next){error.textContent='Ny PIN må være forskjellig fra nåværende PIN.';return}
      save.disabled=true;
      try{
        await window.call({action:'change_player_pin',player_id:changePlayerId,current_pin:current,new_pin:next});
        close(changeDialog);notify('PIN er endret');
      }catch(err){error.textContent=err?.message?.includes('Feil')?'Feil nåværende PIN.':(err?.message||'Kunne ikke endre PIN.')}
      finally{save.disabled=false}
    });

    document.getElementById('deletePlayer').addEventListener('click',()=>{
      const p=selected();if(!p.id)return notify('Velg spiller først');
      deleteCandidate={id:p.id,name:p.name,pin:''};
      document.getElementById('deletePlayerTitle').textContent=`Slett ${p.name}`;
      document.getElementById('deletePlayerForm').reset();
      document.getElementById('deletePlayerError').textContent='';
      deleteDialog.showModal();
      setTimeout(()=>document.getElementById('deletePlayerPin').focus(),40);
    });
    document.querySelector('[data-delete-cancel]').addEventListener('click',()=>{deleteCandidate=null;close(deleteDialog)});
    document.getElementById('deletePlayerForm').addEventListener('submit',async e=>{
      e.preventDefault();
      if(!deleteCandidate)return close(deleteDialog);
      const pin=document.getElementById('deletePlayerPin').value;
      const error=document.getElementById('deletePlayerError');
      const button=document.getElementById('deletePlayerContinue');
      error.textContent='';
      if(!/^\d{4}$/.test(pin)){error.textContent='PIN må være nøyaktig 4 tall.';return}
      button.disabled=true;
      try{
        await window.call({action:'verify_player_pin',player_id:deleteCandidate.id,player_pin:pin});
        deleteCandidate.pin=pin;
        close(deleteDialog);
        document.getElementById('deleteFinalText').textContent=`${deleteCandidate.name} og all historikk for denne karakteren blir slettet.`;
        document.getElementById('deleteFinalError').textContent='';
        finalDialog.showModal();
      }catch{error.textContent='Feil PIN.'}
      finally{button.disabled=false}
    });
    document.querySelector('[data-final-cancel]').addEventListener('click',()=>{deleteCandidate=null;close(finalDialog)});
    document.getElementById('deletePlayerFinal').addEventListener('click',async()=>{
      if(!deleteCandidate)return close(finalDialog);
      const button=document.getElementById('deletePlayerFinal');
      const error=document.getElementById('deleteFinalError');
      button.disabled=true;error.textContent='';
      try{
        const name=deleteCandidate.name;
        await window.call({action:'delete_player',player_id:deleteCandidate.id,player_pin:deleteCandidate.pin,confirm:'DELETE_PLAYER'});
        try{localStorage.removeItem('obd_selected_player_id_v2');localStorage.removeItem('obd_selected_player_v1')}catch{}
        close(finalDialog);notify(`${name} er slettet`);
        deleteCandidate=null;
        setTimeout(()=>location.reload(),450);
      }catch(err){error.textContent=err?.message||'Kunne ikke slette karakteren.';button.disabled=false}
    });

    [changeDialog,deleteDialog,finalDialog].forEach(d=>d.addEventListener('cancel',e=>{e.preventDefault();if(d===finalDialog||d===deleteDialog)deleteCandidate=null;close(d)}));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPlayerManagement,{once:true});
  else setTimeout(initPlayerManagement,0);
})();
