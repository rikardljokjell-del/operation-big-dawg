(()=>{
  const names=[null,
    'Bulbasaur','Ivysaur','Venusaur','Charmander','Charmeleon','Charizard','Squirtle','Wartortle','Blastoise','Caterpie',
    'Metapod','Butterfree','Weedle','Kakuna','Beedrill','Pidgey','Pidgeotto','Pidgeot','Rattata','Raticate',
    'Spearow','Fearow','Ekans','Arbok','Pikachu','Raichu','Sandshrew','Sandslash','Nidoran','Nidorina',
    'Nidoqueen','Nidoran','Nidorino','Nidoking','Clefairy','Clefable','Vulpix','Ninetales','Jigglypuff','Wigglytuff',
    'Zubat','Golbat','Oddish','Gloom','Vileplume','Paras','Parasect','Venonat','Venomoth','Diglett',
    'Dugtrio','Meowth','Persian','Psyduck','Golduck','Mankey','Primeape','Growlithe','Arcanine','Poliwag',
    'Poliwhirl','Poliwrath','Abra','Kadabra','Alakazam','Machop','Machoke','Machamp','Bellsprout','Weepinbell',
    'Victreebel','Tentacool','Tentacruel','Geodude','Graveler','Golem','Ponyta','Rapidash','Slowpoke','Slowbro',
    'Magnemite','Magneton','Farfetch\'d','Doduo','Dodrio','Seel','Dewgong','Grimer','Muk','Shellder',
    'Cloyster','Gastly','Haunter','Gengar','Onix','Drowzee','Hypno','Krabby','Kingler','Voltorb',
    'Electrode','Exeggcute','Exeggutor','Cubone','Marowak','Hitmonlee','Hitmonchan','Lickitung','Koffing','Weezing',
    'Rhyhorn','Rhydon','Chansey','Tangela','Kangaskhan','Horsea','Seadra','Goldeen','Seaking','Staryu',
    'Starmie','Mr. Mime','Scyther','Jynx','Electabuzz','Magmar','Pinsir','Tauros','Magikarp','Gyarados',
    'Lapras','Ditto','Eevee','Vaporeon','Jolteon','Flareon','Porygon','Omanyte','Omastar','Kabuto',
    'Kabutops','Aerodactyl','Snorlax','Articuno','Zapdos','Moltres','Dratini','Dragonair','Dragonite','Mewtwo','Mew'
  ];
  window.OBD_POKEMON=Object.freeze(names.map((name,id)=>id?Object.freeze({id,name,image:`dex-png/${id}.png`}):null));
  window.getPokemon=id=>window.OBD_POKEMON[Number(id)]||null;

  if(!window.__obdGymWorkoutBridge){
    window.__obdGymWorkoutBridge=true;
    window.addEventListener('obd-workout-added',e=>window.__obdGymFlowHandleWorkout?.(e.detail||{}));
  }

  if(!document.querySelector('link[href="pokemon-rarity.css"]')){
    const rarityCss=document.createElement('link');
    rarityCss.rel='stylesheet';rarityCss.href='pokemon-rarity.css';document.head.appendChild(rarityCss);
  }

  const loadScript=(src,marker,onload)=>{
    if(document.querySelector(`script[${marker}]`)){onload?.();return}
    const s=document.createElement('script');s.src=src;s.setAttribute(marker,'1');if(onload)s.onload=onload;document.body.appendChild(s);
  };
  const loadTest=()=>{
    if(new URLSearchParams(location.search).get('bossTest')!=='1')return;
    try{if(!localStorage.getItem('obd_gym_test_xp_v3')){localStorage.removeItem('obd_gym_test_xp_v1');localStorage.removeItem('obd_gym_test_xp_v2');localStorage.removeItem('obd_gym_test_v4');localStorage.removeItem('obd_gym_test_v5')}}catch{}
    loadScript('boss-test-xp.js','data-obd-gym-xp-test');
  };
  const loadProgression=()=>loadScript('progression-unbounded.js','data-obd-unbounded-progression',loadTest);
  const loadDebug=()=>loadScript('test-debug.js','data-obd-test-debug-router',loadProgression);
  const loadOnboarding=()=>loadScript('onboarding-access.js','data-obd-onboarding-access',loadDebug);
  const loadCompanionArt=()=>loadScript('starter-companion-art.js','data-obd-starter-companion-art',loadOnboarding);
  const loadGymFlow=()=>loadScript('gym-flow-polish.js','data-obd-gym-flow-polish',loadCompanionArt);
  loadScript('starter-event.js','data-obd-starter-event',loadGymFlow);
})();
