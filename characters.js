function fig(person,level,big=false){
  const safe=Math.max(1,Math.min(10,Number(level)||1));
  const slug=String(person).toLowerCase()==='adrian'?'adrian':'rikard';
  const src=`characters/${slug}-${safe}.png`;
  const label=`${person}, Level ${safe}: ${RANKS[safe-1]}`;
  return `<div class="shadow"></div><img class="character-img" src="${src}" alt="${label}" draggable="false">`;
}
