/* ---------------------------- MATCH LIFECYCLE ------------------------------*/
let engine=null;

/* ---------------------- RETURN BY DEATH RUN STATE ----------------------------
   Stacks live HERE (per player slot), not on the Ball - startMatch() builds fresh
   Ball instances every match. Memory only (no browser storage): a run is one chain of
   Rematches, and dies with Main Menu / a new match started from the pickers.
   returnDeathRuns[player] = { ballId, opponentId, stacks, diedPending } | null */
let returnDeathRuns={1:null,2:null};
function resetReturnDeathRuns(){ returnDeathRuns={1:null,2:null}; }
// called by the engine once a Return by Death ball's death is confirmed; only raises
// a flag, so a double death-check in the same frame can't count twice
function markReturnDeath(ball){
  const run=returnDeathRuns[ball.player];
  if(run) run.diedPending=true;
}
// stacks the ball in `player`'s slot fights this match with
function returnDeathStacks(player,ballId,opponentId,isRematch){
  if(ballId!=='returnbydeath'){ returnDeathRuns[player]=null; return 0; }
  let run=returnDeathRuns[player];
  if(!isRematch || !run || run.ballId!==ballId || run.opponentId!==opponentId){
    // new chain, or a different ball/opponent than last time -> back to stack 0
    run=returnDeathRuns[player]={ballId,opponentId,stacks:0,diedPending:false};
  } else if(run.diedPending){
    run.stacks=Math.min(SUBARU_MAX_STACKS,run.stacks+1); // exactly one stack per confirmed death
    run.diedPending=false;
  }
  return run.stacks;
}

/* ---------------------- SUBARU: add deaths by hand ------------------------------
   Only reachable after the "SUBARU" secret code. Shown when the match ended because a
   Return by Death ball died. Adds N straight onto that run's stacks; the normal +1 for
   the death itself is still applied when Rematch is pressed. */
const SUBARU_MAX_STACKS=999;
function subaruDeadPlayers(){
  return [1,2].filter(p=>returnDeathRuns[p] && returnDeathRuns[p].diedPending);
}
function renderSubaruPanel(feedback){
  const panel=document.getElementById('subaruPanel');
  if(!panel) return;
  const dead=subaruUnlocked?subaruDeadPlayers():[];
  if(!dead.length){ panel.classList.remove('show'); panel.innerHTML=''; return; }
  panel.innerHTML=dead.map(p=>{
    const run=returnDeathRuns[p];
    return '<div class="subaru-row" data-player="'+p+'">'+
      '<span class="subaru-label">🔁 P'+p+' chết:</span>'+
      '<input type="number" inputmode="numeric" min="0" max="'+SUBARU_MAX_STACKS+'" step="1" placeholder="Số lần" class="subaru-input">'+
      '<button type="button" class="subaru-add">＋ Cộng</button>'+
      '</div>'+
      '<div class="subaru-info">Đấu lại sẽ vào trận với tầng ×'+Math.min(SUBARU_MAX_STACKS,run.stacks+1)+'</div>';
  }).join('')+(feedback?'<div class="subaru-info" style="color:#7b5ea7;font-weight:700;">'+feedback+'</div>':'');
  panel.querySelectorAll('.subaru-row').forEach(row=>{
    const p=+row.dataset.player, input=row.querySelector('input');
    const apply=()=>{
      const n=Math.floor(Number(input.value));
      if(!(n>0)){ input.focus(); return; }
      const run=returnDeathRuns[p];
      if(!run) return;
      run.stacks=Math.min(SUBARU_MAX_STACKS,run.stacks+n);
      renderSubaruPanel('✅ Đã cộng +'+n+' lần chết cho P'+p);
    };
    row.querySelector('button').onclick=apply;
    input.addEventListener('keydown',(e)=>{ if(e.key==='Enter') apply(); });
  });
  panel.classList.add('show');
}
function hideSubaruPanel(){
  const panel=document.getElementById('subaruPanel');
  if(panel){ panel.classList.remove('show'); panel.innerHTML=''; }
}

// isRematch=true only from the Rematch button; everything else starts a new chain
function startMatch(isRematch){
  if(!isRematch) resetReturnDeathRuns();
  const canvas=document.getElementById('gameCanvas');
  if(!engine){ engine=new GameEngine(canvas); }
  engine.resize();
  engine.setupMap(MAPS[selectedMap]);
  engine.vsAI=vsAI;

  const margin=engine.w*0.18;
  const stacksA=returnDeathStacks(1,p1Ball,p2Ball,isRematch);
  const stacksB=returnDeathStacks(2,p2Ball,p1Ball,isRematch);
  const a=new Ball(p1Ball,1,margin,engine.h/2,'#d94f4f',stacksA);
  const b=new Ball(p2Ball,2,engine.w-margin,engine.h/2,'#3d6fd9',stacksB);
  engine.balls=[a,b];

  const defA=BALL_TYPES.find(t=>t.id===p1Ball);
  const defB=BALL_TYPES.find(t=>t.id===p2Ball);
  document.getElementById('p1NameLbl').textContent=defA.icon+' '+defA.name+(stacksA?' ×'+stacksA:'');
  document.getElementById('p2NameLbl').textContent=(vsAI?'🤖 ':'')+defB.name+(stacksB?' ×'+stacksB:'')+' '+defB.icon;
  document.getElementById('p1Badge').style.background=GROUP_META[defA.group].color;
  document.getElementById('p1Badge').style.color=GROUP_META[defA.group].color;
  document.getElementById('p2Badge').style.background=GROUP_META[defB.group].color;
  document.getElementById('p2Badge').style.color=GROUP_META[defB.group].color;
  document.getElementById('p1HpText').textContent=defA.momentumBar?'100% ĐL':Math.round(a.maxHp)+'/'+Math.round(a.maxHp);
  document.getElementById('p2HpText').textContent=defB.momentumBar?'100% ĐL':Math.round(b.maxHp)+'/'+Math.round(b.maxHp);

  engine.start();
}
function stopMatch(){ if(engine) engine.stop(); }
// 'layoutchange' is fired by device.js on every resize / phone rotation / browser
// toolbar show-hide, after it has refreshed --app-h and the device classes - so
// the arena is re-fitted using up-to-date layout measurements.
window.addEventListener('layoutchange',()=>{ if(engine && engine.running) engine.resize(); });
