(()=>{
  if(!window.__OBD_PREVIEW__||window.__obdGymAttackPreloadPreview)return;
  window.__obdGymAttackPreloadPreview=true;

  // boss.js still contains the old automatic workout -> attack listener. In this
  // preview we intentionally do not register that one listener; all other workout
  // listeners continue unchanged.
  const nativeAdd=window.addEventListener.bind(window);
  window.addEventListener=function(type,listener,options){
    try{
      const src=typeof listener==='function'?Function.prototype.toString.call(listener):'';
      if(type==='obd-workout-added'&&src.includes('TEST_MODE')&&src.includes('onWorkout')){
        window.__obdSuppressedLegacyGymWorkoutListener=listener;
        return;
      }
    }catch{}
    return nativeAdd(type,listener,options);
  };

  // ui.js historically ignores the response from action:add. Keep the exact
  // workout/reward identity here so the Gym credit can be tied to the same
  // irreversible reward claim that Wild already uses.
  const upstream=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await upstream(input,init);
    try{
      const url=typeof input==='string'?input:String(input?.url||'');
      const body=typeof init?.body==='string'?JSON.parse(init.body):null;
      if(body?.action==='add'&&url.includes('/functions/v1/training-tracker')){
        response.clone().json().then(data=>{
          const workout=data?.workout;
          if(!workout?.id)return;
          window.__obdLastWorkoutReward={
            playerId:String(workout.player_id||body.player_id||''),
            person:String(workout.person||body.person||''),
            type:String(workout.workout_type||body.workout_type||''),
            workoutId:String(workout.id),
            rewardDate:data?.reward_date||null,
            eligible:data?.reward_eligible!==false,
            capturedAt:Date.now()
          };
        }).catch(()=>{});
      }
    }catch{}
    return response;
  };
  window.fetch.__obdGymAttackPreloadPreview=true;
})();
