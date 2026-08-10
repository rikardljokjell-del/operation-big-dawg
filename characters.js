function characterSlug(person){
  const meta=typeof window.getPlayerMeta==='function'?window.getPlayerMeta(person):null;
  if(meta)return Number(meta.character_set)===1?'adrian':'rikard';
  return String(person).toLowerCase()==='adrian'?'adrian':'rikard';
}
function fig(person,level,big=false){
  const safe=Math.max(1,Math.min(10,Number(level)||1));
  const slug=characterSlug(person);
  const src=`characters/${slug}-${safe}.png`;
  const label=`${person}, Level ${safe}: ${RANKS[safe-1]}`;
  return `<div class="shadow"></div><img class="character-img" src="${src}" alt="${label}" draggable="false">`;
}
