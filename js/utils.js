/* ---------------------------- UTILITIES --------------------------------- */
const rand = (a,b)=>a+Math.random()*(b-a);
const randi = (a,b)=>Math.floor(rand(a,b+1));
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const dist = (x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);
function pointSegmentDist(px,py,x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1;
  const lenSq=dx*dx+dy*dy;
  let t=lenSq>0 ? ((px-x1)*dx+(py-y1)*dy)/lenSq : 0;
  t=clamp(t,0,1);
  const cx=x1+t*dx, cy=y1+t*dy;
  return dist(px,py,cx,cy);
}
const now = ()=>performance.now()/1000;
// ease-out helper, used by juicier UI/visual animations (pop-ins, squash decay...)
const easeOutCubic = (t)=>1-Math.pow(1-clamp(t,0,1),3);
const easeOutBack = (t)=>{ t=clamp(t,0,1); const c=1.70158; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); };

// ---- Color helpers (visual-upgrade utilities) ------------------------------
// Balls are given color hues as either '#rrggbb' hex or 'hsl(...)' strings
// depending on how they were assigned; these helpers normalize either into
// an [r,g,b] triple so gradients/glows/particles can tint consistently off
// of *whatever* color a given ball actually is.
function colorToRGB(c){
  if(!c) return [136,136,136];
  if(c[0]==='#'){
    let h=c.slice(1);
    if(h.length===3) h=h.split('').map(ch=>ch+ch).join('');
    const num=parseInt(h,16);
    return [(num>>16)&255,(num>>8)&255,num&255];
  }
  const m=c.match(/hsl\(\s*([\d.]+)[, ]+([\d.]+)%[, ]+([\d.]+)%\)/);
  if(m){
    let h=parseFloat(m[1])/360, s=parseFloat(m[2])/100, l=parseFloat(m[3])/100;
    if(s===0){ const v=Math.round(l*255); return [v,v,v]; }
    const hue2rgb=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
    const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
    return [Math.round(hue2rgb(p,q,h+1/3)*255),Math.round(hue2rgb(p,q,h)*255),Math.round(hue2rgb(p,q,h-1/3)*255)];
  }
  const probe=document.createElement('canvas').getContext('2d');
  probe.fillStyle=c;
  const hex=probe.fillStyle;
  if(hex[0]==='#') return colorToRGB(hex);
  return [136,136,136];
}
function rgba(c,a){ const [r,g,b]=colorToRGB(c); return `rgba(${r},${g},${b},${a})`; }
function lighten(c,amt){ const [r,g,b]=colorToRGB(c); const L=(v)=>Math.round(v+(255-v)*amt); return `rgb(${L(r)},${L(g)},${L(b)})`; }
function darken(c,amt){ const [r,g,b]=colorToRGB(c); const D=(v)=>Math.round(v*(1-amt)); return `rgb(${D(r)},${D(g)},${D(b)})`; }
// Turns angle `a` toward angle `b` by fraction `t` (0..1), always via the
// shorter direction around the circle. Used for Tornado Ball's gentle pull:
// t stays small each frame so the victim's heading bends toward the vortex
// gradually rather than snapping straight at it.
function angleLerp(a,b,t){
  let diff=b-a;
  diff=((diff+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  return a+diff*clamp(t,0,1);
}

// Global speed cap - safety ceiling in case any ability tries to set an
// absurd velocity; normal play never gets near this with speed now locked.
const MAX_SPEED = 640;
// Florentino Ball: max distance its dash-in combo can trigger from (see
// BALL_TYPES 'florentino') - kept as a named constant since it's checked in
// both the trigger roll and the range-ring visual.
const FLORENTINO_RANGE = 340;
// Florentino Ball is hidden/locked until the "FLO" secret code is entered.
// Its dash-trigger chance and flower-pickup chance are also mutable so the
// "THENTHUNGNHINEMQUAYGOTDIMAI" secret code can buff them live.
let florentinoUnlocked = false;
let FLORENTINO_DASH_CHANCE = 0.3;
let FLORENTINO_PICK_CHANCE = 0.5;
function clampBallSpeed(ball){
  const s=Math.hypot(ball.vx,ball.vy);
  if(s>MAX_SPEED){ const f=MAX_SPEED/s; ball.vx*=f; ball.vy*=f; }
}

// ---- Constant-speed enforcement -------------------------------------------
// A ball's speed must be a hard constant, never a value that drifts up or
// down over time. lockSpeed() records the ONE speed a ball is currently
// allowed to move at - call it right when a deliberate speed/CC ability
// intentionally changes how fast a ball goes (a launch, a knockback, a dash,
// Shooting Ball's speed stacks, etc). enforceSpeedLock() is then called after
// every ordinary physics step (wall/obstacle bounces, ball-vs-ball
// collisions, jitter, floating-point rounding...) to snap the ball's
// velocity magnitude back to that locked value - direction can change,
// speed cannot. This removes acceleration/deceleration as a side-effect of
// anything that isn't an explicit ability.
function lockSpeed(ball, speed){ if(ball) ball.speedLock=speed; }
function enforceSpeedLock(ball, mult){
  if(!ball || ball.speedLock<=0) return;
  const target=ball.speedLock*(mult||1);
  const s=Math.hypot(ball.vx,ball.vy);
  if(s>0.0001){ const f=target/s; ball.vx*=f; ball.vy*=f; }
}

// "Powerless" status (Powerless Ball effect): while active, a ball's own
// kit (update/onWallHit/onBallCollide/getMods/onPortal/onDeath/modify*) is
// fully suppressed - it fights as a plain ball with no special ability.
function powerOk(ball,g){ return g.t >= (ball.state.powerlessUntil||0); }

// "Vulnerable" status (Hook Ball effect): a flat damage-taken multiplier
// applied on top of everything else, regardless of the victim's own kit.
function applyVulnerability(target,dmg,g){
  if(g.t < (target.state.vulnerableUntil||0)) return dmg*(target.state.vulnerableMult||1);
  return dmg;
}

// Stunned balls fight at a diminished output: any damage a ball deals while
// stunned is reduced by 30%, on top of whatever its own kit calculates.
// A ball with ccImmune (e.g. Florentino Ball mid-combo) is never actually
// considered "stunned" in any respect, so it's exempt from this penalty too.
function applyStunPenalty(attacker,dmg,g){
  if(g.t < (attacker.state.stunUntil||0) && !attacker.state.ccImmune) return dmg*0.7;
  return dmg;
}

// Potion Ball's Burn effect: while burning, a ball's own outgoing damage is
// halved - on top of whatever its own kit and other penalties calculate.
function applyBurnPenalty(attacker,dmg,g){
  if(g.t < (attacker.state.potionBurnUntil||0)) return dmg*0.5;
  return dmg;
}

// Knockback that respects CC immunity (Florentino Ball's ccImmune, etc.) -
// use this instead of touching vx/vy on an opponent directly anywhere in
// the game. additive=true adds to the ball's existing velocity (the usual
// case for a hit); additive=false replaces it outright (Charge Ball's clean
// launch). Returns false (and applies nothing) if the target is immune, so
// callers can skip any side effects that only make sense once the knockback
// actually lands.
function applyKnockback(target,ang,force,additive){
  if(target.state.ccImmune) return false;
  if(additive){ target.vx+=Math.cos(ang)*force; target.vy+=Math.sin(ang)*force; }
  else { target.vx=Math.cos(ang)*force; target.vy=Math.sin(ang)*force; }
  clampBallSpeed(target);
  lockSpeed(target, Math.hypot(target.vx,target.vy));
  return true;
}

// Flat, minimal shape drawing for balls - each ball type gets its own body
// shape (see BALL_SHAPES) instead of a uniform glossy circle.
function drawFlatShape(ctx,shape,x,y,r){
  ctx.beginPath();
  switch(shape){
    case 'square':{
      const s=r*1.55;
      ctx.rect(x-s/2,y-s/2,s,s);
      break;
    }
    case 'triangle':{
      const s=r*1.25;
      ctx.moveTo(x,y-s); ctx.lineTo(x+s*0.87,y+s*0.6); ctx.lineTo(x-s*0.87,y+s*0.6); ctx.closePath();
      break;
    }
    case 'diamond':{
      const s=r*1.15;
      ctx.moveTo(x,y-s); ctx.lineTo(x+s,y); ctx.lineTo(x,y+s); ctx.lineTo(x-s,y); ctx.closePath();
      break;
    }
    case 'hexagon':{
      for(let i=0;i<6;i++){
        const ang=Math.PI/6+i*Math.PI/3;
        const px=x+Math.cos(ang)*r, py=y+Math.sin(ang)*r;
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      }
      ctx.closePath();
      break;
    }
    case 'pentagon':{
      for(let i=0;i<5;i++){
        const ang=-Math.PI/2+i*Math.PI*2/5;
        const px=x+Math.cos(ang)*r, py=y+Math.sin(ang)*r;
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      }
      ctx.closePath();
      break;
    }
    case 'star':{
      const spikes=5, outer=r*1.1, inner=r*0.5;
      for(let i=0;i<spikes*2;i++){
        const ang=-Math.PI/2+i*Math.PI/spikes;
        const rr=i%2===0?outer:inner;
        const px=x+Math.cos(ang)*rr, py=y+Math.sin(ang)*rr;
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      }
      ctx.closePath();
      break;
    }
    case 'cross':{
      const a=r*0.42, b=r*1.05;
      ctx.moveTo(x-a,y-b); ctx.lineTo(x+a,y-b); ctx.lineTo(x+a,y-a);
      ctx.lineTo(x+b,y-a); ctx.lineTo(x+b,y+a); ctx.lineTo(x+a,y+a);
      ctx.lineTo(x+a,y+b); ctx.lineTo(x-a,y+b); ctx.lineTo(x-a,y+a);
      ctx.lineTo(x-b,y+a); ctx.lineTo(x-b,y-a); ctx.lineTo(x-a,y-a);
      ctx.closePath();
      break;
    }
    case 'snowflake':{
      // 6 thin pointed arms radiating from the center, 60° apart - a plain
      // geometric snowflake/asterisk silhouette (Frost Ball)
      const armLen=r*1.05, armW=r*0.16;
      for(let i=0;i<6;i++){
        const ang=i*Math.PI/3;
        const tipX=x+Math.cos(ang)*armLen, tipY=y+Math.sin(ang)*armLen;
        const px=Math.cos(ang+Math.PI/2)*armW, py=Math.sin(ang+Math.PI/2)*armW;
        ctx.lineTo(x+px,y+py);
        ctx.lineTo(tipX,tipY);
        ctx.lineTo(x-px,y-py);
      }
      ctx.closePath();
      break;
    }
    case 'bolt':{
      // simple lightning-bolt silhouette (Electric / Thunder Ball)
      const s=r*1.1;
      ctx.moveTo(x-s*0.15,y-s);
      ctx.lineTo(x+s*0.35,y-s*0.15);
      ctx.lineTo(x+s*0.05,y-s*0.05);
      ctx.lineTo(x+s*0.45,y+s*0.55);
      ctx.lineTo(x+s*0.05,y+s);
      ctx.lineTo(x-s*0.35,y+s*0.15);
      ctx.lineTo(x-s*0.05,y+s*0.05);
      ctx.lineTo(x-s*0.45,y-s*0.55);
      ctx.closePath();
      break;
    }
    case 'spike':{
      // stubby all-around spikes, like a spiky mine (Big Spike / Axe / Poison Spike)
      const spikes=10, outer=r*1.18, inner=r*0.82;
      for(let i=0;i<spikes*2;i++){
        const ang=-Math.PI/2+i*Math.PI/spikes;
        const rr=i%2===0?outer:inner;
        const px=x+Math.cos(ang)*rr, py=y+Math.sin(ang)*rr;
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      }
      ctx.closePath();
      break;
    }
    case 'gear':{
      // plain toothed cog silhouette (Reforge / Train Ball)
      const teeth=8, outer=r*1.15, inner=r*0.82, toothW=(Math.PI*2/teeth)*0.55;
      let first=true;
      for(let i=0;i<teeth;i++){
        const a0=i*(Math.PI*2/teeth), a1=a0+toothW, a2=a0+(Math.PI*2/teeth);
        const pts=[
          [x+Math.cos(a0)*outer,y+Math.sin(a0)*outer],
          [x+Math.cos(a1)*outer,y+Math.sin(a1)*outer],
          [x+Math.cos(a1)*inner,y+Math.sin(a1)*inner],
          [x+Math.cos(a2)*inner,y+Math.sin(a2)*inner],
        ];
        for(const [px,py] of pts){ if(first){ ctx.moveTo(px,py); first=false; } else ctx.lineTo(px,py); }
      }
      ctx.closePath();
      break;
    }
    default:
      ctx.arc(x,y,r,0,Math.PI*2);
  }
}
