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
  if(new URLSearchParams(location.search).get('bossTest')==='1'&&!document.querySelector('script[data-obd-gym-xp-test]')){
    try{if(!localStorage.getItem('obd_gym_test_xp_v1'))localStorage.removeItem('obd_gym_test_v4')}catch{}
    setTimeout(()=>{const s=document.createElement('script');s.src='boss-test-xp.js';s.dataset.obdGymXpTest='1';document.body.appendChild(s)},0);
  }
})();
