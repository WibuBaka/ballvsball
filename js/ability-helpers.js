function florentinoStrike(b,g,other){
  b.state.ccImmune=true;
  b.state.floPhase='toCenter';
  b.state.floTimer=0;
  b.state.floIndex=0;
  other.state.stunUntil=g.t+0.5;
  const dmg=dmgFor(b,5);
  other.hp=Math.max(0,other.hp-dmg);
  spawnFloatText(g,other.x,other.y-30,'-'+dmg.toFixed(0),'#e0568a');
  spawnFloatText(g,b.x,b.y-40,'STUN!','#e0568a');

  // vòng sóng xung + cánh hoa bung tròn quanh điểm choáng - hiệu ứng "nở hoa"
  b.state.floRingBorn=g.t;
  b.state.floRingX=other.x; b.state.floRingY=other.y;
  b.state.floBurst=b.state.floBurst||[];
  for(let i=0;i<10;i++){
    const bAng=rand(0,Math.PI*2), bSpd=rand(90,170);
    b.state.floBurst.push({x:other.x,y:other.y,vx:Math.cos(bAng)*bSpd,vy:Math.sin(bAng)*bSpd,born:g.t,rot:rand(0,Math.PI*2)});
  }

  // 3 bông hoa chia đều quanh đối thủ (mỗi bông cách nhau 120°).
  // Bông đầu tiên luôn nằm đúng phía đối diện giữa Florentino và đối thủ
  // (góc tính từ đối thủ hướng về phía Florentino) để nhặt trước tiên.
  const faceAng=Math.atan2(b.y-other.y,b.x-other.x);
  const r=110;
  b.state.floFlowers=[];
  for(let i=0;i<3;i++){
    const ang=faceAng+i*(Math.PI*2/3);
    b.state.floFlowers.push({
      x:clamp(other.x+Math.cos(ang)*r,20,g.w-20),
      y:clamp(other.y+Math.sin(ang)*r,20,g.h-20),
      // hoa "bắn ra" từ đúng tâm đối thủ theo 3 hướng chia đều rồi mới an vị -
      // ox/oy/bornAt chỉ dùng để dựng hiệu ứng bay ra trong renderExtra
      ox:other.x, oy:other.y, bornAt:g.t,
      collected:false
    });
  }
  // Không dịch chuyển tức thời nữa - phase 'toCenter' (xử lý trong update())
  // sẽ khiến Florentino thực sự lướt về tâm đối thủ trước khi ra hoa.
  spawnParticles(g,other.x,other.y,10);
}
function florentinoEnd(b,g){
  b.state.floPhase='idle';
  b.state.floCD=g.t;
  b.state.floFlowers=[];
  b.state.floIndex=0;
  b.state.floTrail.length=0;
  b.state.ccImmune=false;
}
function explode(ball,g,radius,dmg){
  for(const other of g.balls){
    if(other!==ball && other.alive){
      const d=dist(ball.x,ball.y,other.x,other.y);
      if(d<radius){
        if(dmg>0){
          other.hp=Math.max(0,other.hp-dmg);
          spawnFloatText(g,other.x,other.y-30,'-'+dmg.toFixed(0),'#ff8a3d');
        }
        const ang=Math.atan2(other.y-ball.y,other.x-ball.x);
        const force=180*(1-d/radius);
        applyKnockback(other,ang,force,true);
      }
    }
  }
  spawnParticles(g,ball.x,ball.y,18,{color:'#ff8a3d',speed:220,type:'spark'});
  g.spawnExplosionRing(ball.x,ball.y,radius);
}
function explodeAt(g,x,y,owner,radius,dmg){
  for(const other of g.balls){
    if(other!==owner && other.alive){
      const d=dist(x,y,other.x,other.y);
      if(d<radius){
        if(dmg>0){
          other.hp=Math.max(0,other.hp-dmg);
          spawnFloatText(g,other.x,other.y-30,'-'+dmg.toFixed(0),'#ff8a3d');
        }
        const ang=Math.atan2(other.y-y,other.x-x);
        const force=180*(1-d/radius);
        applyKnockback(other,ang,force,true);
      }
    }
  }
  spawnParticles(g,x,y,18,{color:'#ff8a3d',speed:220,type:'spark'});
  g.spawnExplosionRing(x,y,radius);
}
function spawnFloatText(g,x,y,text,color){
  // avoid overlapping stacks of text when several hits land on nearly the
  // same spot in quick succession (combo hits, DOT ticks, aoe splash...) -
  // nudge each new one a bit higher based on how many recent ones are still
  // alive near this exact spot, so they read as a readable vertical list
  // instead of a smudge of overlapping text.
  let stack=0;
  for(const f of g.floatTexts){
    if(g.t-f.born<0.35 && Math.abs(f.x-x)<26 && Math.abs(f.y-y)<40) stack++;
  }
  g.floatTexts.push({x,y:y-stack*15,text,color,born:g.t,until:g.t+1.05,drift:rand(-14,14)});
}
// count = how many; opts = {color, speed, spread, type, gravity, size}
//   type 'spark'  - bright streaking dot, shrinks fast (impacts/hits)
//   type 'glow'   - soft round glow puff, drifts slowly (magic/status auras)
//   type 'dust'   - small flat chip, slight gravity (dust/debris)
function spawnParticles(g,x,y,count=8,opts={}){
  const color=opts.color||'#1a1a1a';
  const type=opts.type||'spark';
  const speed=opts.speed!=null?opts.speed:110;
  const life=opts.life!=null?opts.life:(type==='glow'?0.55:0.4);
  for(let i=0;i<count;i++){
    const ang=rand(0,Math.PI*2);
    const spd=rand(speed*0.25,speed);
    g.particles.push({
      x:x+rand(-6,6), y:y+rand(-6,6),
      vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
      r:opts.size||rand(2,5), born:g.t, until:g.t+life*rand(0.7,1.15),
      color, type, gravity:opts.gravity!=null?opts.gravity:(type==='dust'?260:0)
    });
  }
}
function drawLightning(g,from,to){
  spawnParticles(g,(from.x+to.x)/2,(from.y+to.y)/2,3,{color:'#fff36a',type:'glow',speed:40});
}
// jagged lightning bolt polyline, drawn live for a brief moment (Electro King)
function drawLightningBolt(ctx,x1,y1,x2,y2){
  const segs=7;
  const pts=[{x:x1,y:y1}];
  for(let i=1;i<segs;i++){
    const t=i/segs;
    pts.push({x:x1+(x2-x1)*t+rand(-10,10), y:y1+(y2-y1)*t+rand(-10,10)});
  }
  pts.push({x:x2,y:y2});
  ctx.save();
  ctx.lineCap='round'; ctx.lineJoin='round';
  // soft outer glow pass
  ctx.shadowColor='#fff36a'; ctx.shadowBlur=16;
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.strokeStyle='rgba(26,26,26,0.55)'; ctx.lineWidth=6; ctx.stroke();
  ctx.shadowBlur=0;
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.strokeStyle='#fff36a'; ctx.lineWidth=2.5; ctx.stroke();
  // bright hot core
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
}

/* ---- projectile / hazard / bomb systems (shared by many new ball kits) ---- */
function fireProjectile(g,owner,opts){
  g.projectiles.push(Object.assign({
    x:owner.x,y:owner.y,r:6,dmg:5,life:3,bouncesLeft:0,growPerBounce:0,
    color:'#fff',knockback:0,vx:0,vy:0,owner,dead:false
  },opts));
}
function spawnBomb(g,x,y,owner,delay){
  g.bombs.push({x,y,at:g.t+delay,owner,exploded:false});
}
function spawnHazard(g,hz){
  if(!hz.lastHit) hz.lastHit={};
  g.hazards.push(hz);
}
function pointInHazard(hz,ball){
  if(hz.rectType){
    const nx=clamp(ball.x,hz.x,hz.x+hz.w);
    const ny=clamp(ball.y,hz.y,hz.y+hz.h);
    return dist(ball.x,ball.y,nx,ny)<ball.radius;
  }
  return dist(ball.x,ball.y,hz.x,hz.y)<hz.r+ball.radius;
}
function applyHazardEffect(hz,ball,g,dt){
  const p=ball.player;
  switch(hz.type){
    case 'poisontrap':
      if(g.t-(hz.lastHit[p]||0)>3){
        hz.lastHit[p]=g.t;
        ball.state.poisonUntil=g.t+4; ball.state.poisonTickDmg=4;
        ball.state.slowUntil=g.t+2; ball.state.slowFactor=0.8;
        spawnFloatText(g,ball.x,ball.y-30,'POISON!','#8dff7a');
      }
      break;
    case 'frostzone':
      // NOTE: freeze-buildup is tracked centrally per-ball in updateHazards()
      // (not per-hazard-instance) so that walking across the whole frost trail
      // counts as one continuous zone, not resetting every time you cross
      // from one trail patch into the next.
      ball.state.slowUntil=g.t+0.3; ball.state.slowFactor=0.5;
      // direct chip damage while standing in the cold - tracked per-VICTIM
      // (not per-hazard-instance) since Frost Ball leaves many short-lived
      // overlapping trail patches; a per-instance cooldown would let each new
      // overlapping patch re-trigger the tick early and deal damage far
      // faster than intended.
      if(g.t-(ball.state.frostDmgCD||0)>0.5){
        ball.state.frostDmgCD=g.t;
        ball.hp=Math.max(0,ball.hp-1);
        spawnFloatText(g,ball.x,ball.y-24,'-1','#a8e8ff');
      }
      break;
    case 'web':
      if(g.t-(hz.lastHit[p]||0)>2){
        hz.lastHit[p]=g.t;
        ball.state.rootUntil=g.t+1;
        spawnFloatText(g,ball.x,ball.y-30,'WEB!','#cfcfcf');
      }
      break;
    case 'laser':
      if(g.t-(hz.lastHit[p]||0)>0.5){
        hz.lastHit[p]=g.t;
        const dmg=hz.dmg||8;
        ball.hp=Math.max(0,ball.hp-dmg);
        spawnFloatText(g,ball.x,ball.y-30,'-'+dmg.toFixed(0),'#ff5c7c');
      }
      break;
    case 'leafpatch':
      if(g.t-(hz.lastHit[p]||0)>0.4){
        hz.lastHit[p]=g.t;
        const dmg=hz.dmg||5;
        ball.hp=Math.max(0,ball.hp-dmg);
        spawnFloatText(g,ball.x,ball.y-30,'-'+dmg.toFixed(0),'#6fbf3f');
        spawnParticles(g,ball.x,ball.y,6,{color:'#8fd95f',type:'dust',speed:90,life:0.35});
      }
      break;
    case 'zonebox':
      if(g.t-(hz.lastHit[p]||0)>0.5){
        hz.lastHit[p]=g.t;
        const dmg=dmgFor(hz.owner,7);
        ball.hp=Math.max(0,ball.hp-dmg);
        spawnFloatText(g,ball.x,ball.y-30,'-'+dmg.toFixed(0),'#ff3b5c');
      }
      break;
  }
}

// "Air catching fire from sheer speed" effect - a dramatic flame tail
// streams backward from the ball (opposite its travel direction), several
// overlapping wavy ribbons tapering and fading toward the tip, with embers
// peeling off the sides and a hot glow right at the ball. Trail length
// reacts to how fast the ball is actually moving, on top of `intensity`
// (0..1, which scales overall brightness/size). Used by Shooting Ball (once
// stacked to 2x+ damage) and Burst Ball (during its post-dash buff window).
function drawFireAura(ctx,b,g,intensity){
  const t=g.t, R=b.radius;
  const speed=Math.hypot(b.vx,b.vy)||1;
  const ang=Math.atan2(b.vy,b.vx);
  const backX=-Math.cos(ang), backY=-Math.sin(ang);
  const perpX=-backY, perpY=backX;

  ctx.save();
  const trailLen=R*(2.6+intensity*2.4)*clamp(speed/220,0.55,1.7);

  // several overlapping flame ribbons streaming backward - widest/hottest
  // near the ball, tapering to a wavy point at the tail
  const ribbons=3;
  for(let r=0;r<ribbons;r++){
    const phase=r*2.1;
    const widthBase=R*(0.85-r*0.14);
    const steps=10;
    const topPts=[], botPts=[];
    for(let s=0;s<=steps;s++){
      const f=s/steps;
      const dist=f*trailLen;
      const wob=Math.sin(t*18+f*10+phase)*R*0.22*(1-f*0.4);
      const cx=b.x+backX*dist+perpX*wob, cy=b.y+backY*dist+perpY*wob;
      const w=widthBase*(1-f)*(0.6+0.4*Math.sin(t*20+f*14+phase));
      topPts.push({x:cx+perpX*w,y:cy+perpY*w});
      botPts.push({x:cx-perpX*w,y:cy-perpY*w});
    }
    ctx.beginPath();
    ctx.moveTo(topPts[0].x,topPts[0].y);
    for(const p of topPts) ctx.lineTo(p.x,p.y);
    for(let i=botPts.length-1;i>=0;i--) ctx.lineTo(botPts[i].x,botPts[i].y);
    ctx.closePath();
    const grad=ctx.createLinearGradient(b.x,b.y,b.x+backX*trailLen,b.y+backY*trailLen);
    if(r===0){
      grad.addColorStop(0, `rgba(255,240,180,${(0.85+intensity*0.15).toFixed(2)})`);
      grad.addColorStop(0.25, `rgba(255,150,30,${(0.75+intensity*0.2).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(255,60,10,0)');
    } else {
      grad.addColorStop(0, `rgba(255,120,20,${(0.55+intensity*0.25).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(180,20,0,0)');
    }
    ctx.fillStyle=grad;
    ctx.fill();
  }

  // sparks/embers peeling off the sides of the trail, like burning air
  // getting flung outward in the ball's wake
  for(let i=0;i<8;i++){
    const f=i/8;
    const dist=f*trailLen*1.1;
    const side=(i%2===0)?1:-1;
    const wob=Math.sin(t*10+i*2)*R*0.5;
    const ex=b.x+backX*dist+perpX*(side*R*0.4+wob*0.2);
    const ey=b.y+backY*dist+perpY*(side*R*0.4+wob*0.2);
    ctx.beginPath(); ctx.arc(ex,ey,Math.max(0.6,2.4*(1-f)),0,Math.PI*2);
    ctx.fillStyle=`rgba(255,${200+Math.round(30*Math.sin(t*15+i))},100,${(0.6*(1-f)).toFixed(2)})`;
    ctx.fill();
  }

  // hot glow right at the ball itself, where the fire is most intense
  const headGlow=ctx.createRadialGradient(b.x,b.y,R*0.4,b.x,b.y,R*1.6);
  headGlow.addColorStop(0, `rgba(255,180,60,${(0.55+intensity*0.3).toFixed(2)})`);
  headGlow.addColorStop(1, 'rgba(255,80,10,0)');
  ctx.beginPath(); ctx.arc(b.x,b.y,R*1.6,0,Math.PI*2);
  ctx.fillStyle=headGlow; ctx.fill();

  ctx.restore();
}
