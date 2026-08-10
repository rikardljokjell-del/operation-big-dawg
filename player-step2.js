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
})();
