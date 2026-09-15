/* ---------------------------- MATCH LIFECYCLE ------------------------------*/
let engine=null;
function startMatch(){
  const canvas=document.getElementById('gameCanvas');
  if(!engine){ engine=new GameEngine(canvas); }
  engine.resize();
  engine.setupMap(MAPS[selectedMap]);
  engine.vsAI=vsAI;

  const margin=engine.w*0.18;
  const a=new Ball(p1Ball,1,margin,engine.h/2,'#d94f4f');
  const b=new Ball(p2Ball,2,engine.w-margin,engine.h/2,'#3d6fd9');
  engine.balls=[a,b];

  const defA=BALL_TYPES.find(t=>t.id===p1Ball);
  const defB=BALL_TYPES.find(t=>t.id===p2Ball);
  document.getElementById('p1NameLbl').textContent=defA.icon+' '+defA.name;
  document.getElementById('p2NameLbl').textContent=(vsAI?'🤖 ':'')+defB.name+' '+defB.icon;
  document.getElementById('p1Badge').style.background=GROUP_META[defA.group].color;
  document.getElementById('p1Badge').style.color=GROUP_META[defA.group].color;
  document.getElementById('p2Badge').style.background=GROUP_META[defB.group].color;
  document.getElementById('p2Badge').style.color=GROUP_META[defB.group].color;
  document.getElementById('p1HpText').textContent=defA.momentumBar?'100% ĐL':Math.round(a.maxHp)+'/'+Math.round(a.maxHp);
  document.getElementById('p2HpText').textContent=defB.momentumBar?'100% ĐL':Math.round(b.maxHp)+'/'+Math.round(b.maxHp);

  engine.start();
}
function stopMatch(){ if(engine) engine.stop(); }
window.addEventListener('resize',()=>{ if(engine && engine.running) engine.resize(); });
