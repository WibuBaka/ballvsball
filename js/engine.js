class GameEngine{
  constructor(canvas){
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d');
    this.w=0; this.h=0;
    this.balls=[];
    this.t=0;
    this.floatTexts=[];
    this.particles=[];
    this.projectiles=[];
    this.hazards=[];
    this.bombs=[];
    this.trains=[];
    this.cellClones=[];
    this.explosions=[];
    this.tornadoes=[]; // Tornado Ball vortex zones
    this.mapDef=null;
    this.mapObstacles=[];
    this.mapPortals=[];
    this.running=false;
    this.phase='aim1'; // aim1 -> aim2 -> sim -> end
    this.dragging=false;
    this.dragStart=null;
    this.dragCurrent=null;
    this.winner=null;
    // ---- vs-AI mode ----
    this.vsAI=false;
    this.aiFireAt=null; // sim-time timestamp when the AI will release its shot
    // ---- visual-juice state (screen shake, hit-reaction bookkeeping) ----
    this.shakeMag=0; this.shakeUntil=0; this.shakeSeed=Math.random()*1000;
    this._hpPrevFrame=null;
    // ---- game-loop bookkeeping (see start()/loop()) ----
    this._loopQueued=false;  // guards against stacking multiple parallel RAF chains
    this._lastFrameTime=null; // used to compute real delta-time each frame
    this._bindInput();
  }
  // Small, brief camera shake used for impacts/explosions - magnitude decays
  // linearly to 0 by `until`. Multiple calls take whichever shake is currently
  // strongest so rapid multi-hits don't fight each other.
  triggerShake(mag,dur){
    dur=dur||0.2;
    const untilT=this.t+dur;
    if(mag>=this.shakeMag || untilT>this.shakeUntil){
      this.shakeMag=Math.max(mag,this.shakeMag*0.4);
      this.shakeUntil=untilT;
    }
  }
  opponentOf(ball){ return this.balls.find(b=>b!==ball); }
  isNearHazard(ball){
    for(const o of this.mapObstacles){
      if(o.type==='circle'){ if(dist(ball.x,ball.y,o.x,o.y)<o.r+ball.radius+30) return true; }
      if(o.type==='rect'){ if(ball.x>o.x-30&&ball.x<o.x+o.w+30&&ball.y>o.y-30&&ball.y<o.y+o.h+30) return true; }
    }
    const margin=48;
    if(ball.x<margin||ball.x>this.w-margin||ball.y<margin||ball.y>this.h-margin) return true;
    return false;
  }
  setupMap(mapDef){
    this.mapDef=mapDef;
    const built=mapDef.build(this.w,this.h);
    this.mapObstacles=built.obstacles;
    this.mapPortals=built.portals;
  }
  resize(){
    const host=document.getElementById('canvasHost');
    const maxW=Math.min(window.innerWidth*0.92, 860);
    const maxH=Math.min(window.innerHeight*0.68, 620);
    const size=Math.min(maxW,maxH);
    this.canvas.width=size; this.canvas.height=size;
    this.w=size; this.h=size;
    // BUGFIX: obstacles/portals are built once in setupMap() as absolute
    // pixel coordinates for whatever w/h the canvas had at that moment. If
    // the window is resized mid-match (e.g. rotating a phone, or resizing a
    // desktop browser window) this.w/this.h change here but the obstacles
    // were never rebuilt for the new size, so the map geometry no longer
    // matched the actual arena (obstacles could end up outside the canvas,
    // or floating in the wrong relative spot). Rebuild the map for the new
    // dimensions whenever one is already active.
    if(this.mapDef) this.setupMap(this.mapDef);
  }
  _bindInput(){
    const c=this.canvas;
    const getPos=(e)=>{
      const r=c.getBoundingClientRect();
      const t=(e.touches && e.touches.length)? e.touches[0] : e;
      const rawX=(t.clientX-r.left)*(c.width/(r.width||1));
      const rawY=(t.clientY-r.top)*(c.height/(r.height||1));
      // clamp inside the canvas so dragging past the map edge never
      // produces out-of-range/NaN coordinates
      return {x:clamp(rawX,0,c.width), y:clamp(rawY,0,c.height)};
    };
    const down=(e)=>{
      if(this.phase!=='aim1' && this.phase!=='aim2') return;
      // P2 is AI-controlled - the human never gets to drag its ball
      if(this.phase==='aim2' && this.vsAI) return;
      const pos=getPos(e);
      const activeBall = this.phase==='aim1'? this.balls[0] : this.balls[1];
      if(dist(pos.x,pos.y,activeBall.x,activeBall.y)<activeBall.radius+40){
        this.dragging=true; this.dragStart={x:activeBall.x,y:activeBall.y}; this.dragCurrent=pos;
      }
    };
    const move=(e)=>{
      if(!this.dragging) return;
      if(e.touches && e.touches.length===0) return;
      this.dragCurrent=getPos(e);
      e.preventDefault();
    };
    const up=(e)=>{
      if(!this.dragging) return;
      this.dragging=false;
      if(!this.dragStart || !this.dragCurrent) return;
      const activeBall = this.phase==='aim1'? this.balls[0] : this.balls[1];
      const dx=this.dragStart.x-this.dragCurrent.x;
      const dy=this.dragStart.y-this.dragCurrent.y;
      const pullDist=Math.hypot(dx,dy);
      // pull distance only decides whether a shot was actually taken (vs an
      // accidental tap) - it no longer scales speed at all; every launch
      // uses the ball's own fixed speed stat regardless of how far you pull.
      if(pullDist>8){
        this.launchBall(activeBall, Math.atan2(dy,dx));
      }
      if(this.phase==='aim1'){
        if(this.vsAI){
          this.phase='aim2';
          document.getElementById('statusBar').textContent='🤖 AI đang ngắm...';
          // brief "thinking" delay before the AI fires, so its turn reads as
          // a deliberate beat rather than an instant snap-shot
          this.aiFireAt=this.t+rand(0.55,1.05);
        } else {
          this.phase='aim2';
          document.getElementById('statusBar').textContent='Kéo bóng để ngắm — PLAYER 2';
        }
      } else if(this.phase==='aim2'){
        this.phase='sim';
        document.getElementById('statusBar').textContent='⚔️ ĐANG GIAO TRANH ⚔️';
      }
    };
    // bind move/up on window (not just the canvas) so dragging past the
    // map edge keeps tracking the pointer instead of freezing/erroring
    c.addEventListener('mousedown',down);
    window.addEventListener('mousemove',move);
    window.addEventListener('mouseup',up);
    c.addEventListener('touchstart',down,{passive:true});
    window.addEventListener('touchmove',move,{passive:false});
    window.addEventListener('touchend',up);
    window.addEventListener('touchcancel',up);
  }
  // Shared launch math - `ang` is the world-space direction the ball should
  // fly in. Speed is always this ball's own maximum speed - the same value
  // a full-strength pull used to produce - it's just fixed now instead of
  // scaling with how far you drag. Pull distance only ever decides direction
  // (and whether you dragged far enough to count as a shot at all).
  launchBall(ball, ang){
    const launchSpeed = 60 + ball.baseSpeed*2.4;
    ball.vx=Math.cos(ang)*launchSpeed;
    ball.vy=Math.sin(ang)*launchSpeed;
    lockSpeed(ball, launchSpeed);
  }
  // AI's turn: aim roughly at the opponent (with a little human-like
  // inaccuracy), then hand off to 'sim' just like a real player releasing
  // their drag. Speed is fixed (see launchBall), so there's no pull-strength
  // to randomize anymore - only the aim angle varies.
  aiTakeShot(){
    const ball=this.balls[1], target=this.opponentOf(ball);
    if(target){
      const baseAng=Math.atan2(target.y-ball.y, target.x-ball.x);
      const ang=baseAng+rand(-0.16,0.16); // slight aim error, not a perfect laser
      this.launchBall(ball, ang);
    }
    this.aiFireAt=null;
    this.phase='sim';
    document.getElementById('statusBar').textContent='⚔️ ĐANG GIAO TRANH ⚔️';
  }
  start(){
    this.running=true;
    this.t=0;
    this.phase='aim1';
    this.winner=null;
    this.aiFireAt=null;
    this.floatTexts=[]; this.particles=[]; this.projectiles=[]; this.hazards=[]; this.bombs=[]; this.trains=[]; this.cellClones=[]; this.explosions=[]; this.tornadoes=[];
    this.shakeMag=0; this.shakeUntil=0; this._lastHudHp=null;
    document.getElementById('statusBar').textContent='Kéo bóng để ngắm — PLAYER 1';
    document.getElementById('roundMsg').style.display='none';
    document.getElementById('btnRematch').style.display='none';
    this._lastTurnPhase=null;
    this.updateTurnGlow();
    // reset the real-time clock used for delta-time measurement (see loop())
    // so the first frame of a fresh/rematch game never sees a huge dt caused
    // by time elapsed since the previous match ended.
    this._lastFrameTime=null;
    // BUGFIX: start() used to unconditionally queue a brand-new
    // requestAnimationFrame chain every time it ran. Because stop() is only
    // called when returning to the main menu - NOT when a match ends or the
    // player hits "Đấu lại" (Rematch) - the *previous* match's loop() chain
    // was still alive and calling itself every frame. Each rematch therefore
    // stacked one more parallel loop() chain on top of the others, so
    // update()/render() (and therefore ball movement, collisions and damage)
    // ran 2x, 3x, 4x... as many times per real animation frame the more
    // times you replayed - balls got faster and hits doubled up the longer
    // a session went on. We now only ever kick off ONE loop chain, guarded
    // by _loopQueued; loop() clears the flag when it actually stops so a
    // later start() (e.g. after returning to the menu and starting again)
    // can safely queue a new chain.
    if(!this._loopQueued){
      this._loopQueued=true;
      requestAnimationFrame((ts)=>this.loop(ts));
    }
  }
  stop(){ this.running=false; }
  loop(ts){
    if(!this.running){ this._loopQueued=false; return; }
    // BUGFIX: dt used to be hardcoded to Math.min(0.033, 1/60), which always
    // evaluates to exactly 1/60s regardless of how much real time actually
    // passed between frames. requestAnimationFrame fires once per display
    // refresh, so on a 90Hz/120Hz screen (common on phones) this loop runs
    // 1.5x/2x more often than on a 60Hz screen while still advancing the
    // simulation by a fixed 1/60s each time - the whole match (ball speed,
    // cooldowns, timers...) played out proportionally faster on higher
    // refresh-rate devices. We now measure the REAL elapsed time between
    // frames and use that as dt (clamped to avoid a huge jump after the tab
        // was backgrounded or the device hitched), so match speed is now
    // identical across every device regardless of its refresh rate.
    const nowMs = (typeof ts==='number') ? ts : performance.now();
    if(this._lastFrameTime==null) this._lastFrameTime=nowMs;
    let dt=(nowMs-this._lastFrameTime)/1000;
    this._lastFrameTime=nowMs;
    dt=clamp(dt,0,0.033); // cap at ~1/30s so tab-switch/lag spikes can't cause a huge simulation jump
    this.t+=dt;
    if(this.phase!==this._lastTurnPhase){
      this._lastTurnPhase=this.phase;
      this.updateTurnGlow();
    }
    if(this.phase==='aim2' && this.vsAI && this.aiFireAt!=null && this.t>=this.aiFireAt){
      this.aiTakeShot();
    }
    if(this.phase==='sim') this.update(dt);
    this.render(dt);
    requestAnimationFrame((ts2)=>this.loop(ts2));
  }

  update(dt){
    // snapshot HP before any damage this frame lands, so we can react (flash,
    // shake, impact sparks) to ANY source of damage generically afterwards -
    // ability ticks, projectiles, hazards, explosions, collisions, etc -
    // without needing every single damage call-site to know about visuals.
    const hpBefore=this.balls.map(b=>b.hp);
    for(const ball of this.balls){
      if(!ball.alive) continue;
      const mods=ball.currentMods(this);
      let localDt=dt;
      if(this.t < (ball.state.slowUntil||0) && !ball.state.ccImmune) localDt*=(ball.state.slowFactor||0.85);
      if(ball.def.update && powerOk(ball,this)) ball.def.update(ball,localDt,this);

      // status effects: frozen/rooted/stunned now all fully stop the ball for
      // the frame (localDt=0) - a stunned ball stands completely still, it
      // no longer crawls at a reduced rate.
      // ball.state.ccImmune (e.g. Florentino Ball mid-combo) bypasses all of
      // this entirely - such a ball simply cannot be frozen/rooted/stunned,
      // nor disoriented (see below). clockFrozenUntil (Clock Ball's time-stop
      // hitting an opponent) joins the same OR-chain - same hard stop.
      if(!ball.state.ccImmune){
        if(this.t < (ball.state.frozenUntil||0) || this.t < (ball.state.rootUntil||0) || this.t < (ball.state.stunUntil||0) || this.t < (ball.state.clockFrozenUntil||0) || this.t < (ball.state.potionFrozenUntil||0) || this.t < (ball.state.potionShockUntil||0)){
          localDt=0;
        }
      }
      if(this.t < (ball.state.disorientedUntil||0) && !ball.state.ccImmune){
        ball.vx += rand(-1,1)*180*dt;
        ball.vy += rand(-1,1)*180*dt;
      }
      clampBallSpeed(ball);

      // integrate position
      ball.x += ball.vx*localDt;
      ball.y += ball.vy*localDt;

      // NOTE: no passive friction here on purpose — speed must stay constant
      // over the whole match. It only ever changes from: wall/obstacle bounces,
      // ball-ball collisions, ability effects, or map/slow hazards below.

      // speedAdd mod - passive nudge (reserved for future abilities)
      if(mods.speedAdd>0){
        const spd=Math.hypot(ball.vx,ball.vy)||1;
        const targetBoost = mods.speedAdd*0.02;
        ball.vx += (ball.vx/spd)*targetBoost*localDt*10;
        ball.vy += (ball.vy/spd)*targetBoost*localDt*10;
      }

      // anti-stuck
      const speed=Math.hypot(ball.vx,ball.vy);
      if(speed<8){ ball.stuckTimer+=dt; } else { ball.stuckTimer=0; }
      if(ball.stuckTimer>1.5){
        const ang=rand(0,Math.PI*2);
        ball.vx+=Math.cos(ang)*120; ball.vy+=Math.sin(ang)*120;
        ball.stuckTimer=0;
        if(ball.speedLock<=0) lockSpeed(ball, Math.hypot(ball.vx,ball.vy));
      }

      // poison / burn damage-over-time tick (Poison Spike trap, legacy Potion Ball burn)
      if(this.t < (ball.state.poisonUntil||0)){
        ball.state.poisonTick=(ball.state.poisonTick||0)+dt;
        if(ball.state.poisonTick>0.5){
          ball.state.poisonTick=0;
          const pdmg=ball.state.poisonTickDmg||3;
          ball.hp=Math.max(0,ball.hp-pdmg);
          spawnFloatText(this,ball.x,ball.y-30,'-'+pdmg.toFixed(0),'#8dff7a');
        }
      }

      // ---- Potion Ball (redesigned): burn / toxic / frozen / shock / health
      // ticks. These are generic state fields so ANY ball type can carry
      // them (whoever got hit by a thrown potion) - no floating "BURN!"-style
      // labels are shown per the design; only small status icons above the
      // ball (see render()) communicate what's active, and they can freely
      // overlap when several effects are stacked at once.
      if(this.t < (ball.state.potionBurnUntil||0)){
        ball.state.potionBurnTick=(ball.state.potionBurnTick||0)+dt;
        if(ball.state.potionBurnTick>0.3){
          ball.state.potionBurnTick=0;
          ball.hp=Math.max(0,ball.hp-3);
          spawnParticles(this,ball.x,ball.y,4,{color:'#ff8a3d',type:'spark',speed:80});
        }
      }
      if(this.t < (ball.state.potionToxicUntil||0)){
        ball.state.potionToxicTick=(ball.state.potionToxicTick||0)+dt;
        if(ball.state.potionToxicTick>0.3){
          ball.state.potionToxicTick=0;
          const pd=ball.state.potionToxicDmg||3;
          ball.hp=Math.max(0,ball.hp-pd);
          ball.state.potionToxicDmg=pd+3; // ramps up each tick while active
          spawnParticles(this,ball.x,ball.y,4,{color:'#7CFF3A',type:'spark',speed:80});
        }
      } else if(ball.state.potionToxicDmg){
        ball.state.potionToxicDmg=3; // resets once the effect wears off
      }
      if(this.t < (ball.state.potionFrozenUntil||0)){
        ball.state.potionFrozenTick=(ball.state.potionFrozenTick||0)+dt;
        if(ball.state.potionFrozenTick>0.2){
          ball.state.potionFrozenTick=0;
          ball.hp=Math.max(0,ball.hp-1);
          spawnParticles(this,ball.x,ball.y,3,{color:'#8fdcff',type:'spark',speed:60});
        }
      }
      if(this.t < (ball.state.potionShockUntil||0)){
        ball.state.potionShockTick=(ball.state.potionShockTick||0)+dt;
        if(ball.state.potionShockTick>0.2){
          ball.state.potionShockTick=0;
          ball.hp=Math.max(0,ball.hp-1);
          spawnParticles(this,ball.x,ball.y,3,{color:'#fff36a',type:'spark',speed:100});
        }
      }
      if(this.t < (ball.state.potionHealthUntil||0)){
        ball.state.potionHealthTick=(ball.state.potionHealthTick||0)+dt;
        if(ball.state.potionHealthTick>0.3){
          ball.state.potionHealthTick=0;
          ball.hp=Math.min(ball.maxHp,ball.hp+7);
          spawnParticles(this,ball.x,ball.y,4,{color:'#7CFF9A',type:'glow',speed:40});
        }
      }

      this.resolveWallCollision(ball);
      this.resolveObstacleCollision(ball);
      this.resolvePortals(ball);
      // getMods().speedMult (Axe Ball low-HP buff, Potion Ball speed potion, etc.)
      // now actually scales the enforced locked speed instead of being ignored.
      enforceSpeedLock(ball, mods.speedMult);
    }
    this.resolveBallCollision();
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateBombs();
    this.updateTrains(dt);
    this.updateCellClones(dt);
    this.updateTornadoes(dt);
    this.explosions=this.explosions.filter(e=>this.t-e.start<e.dur);

    this.floatTexts=this.floatTexts.filter(f=>this.t<f.until);
    this.particles=this.particles.filter(p=>this.t<p.until);

    // universal hit-reaction: any ball that lost HP this frame (from any
    // source) gets a brief white flash + a squash pop + a burst of sparks in
    // its own color + a proportional screen shake. This makes every one of
    // the 32 kits' attacks feel impactful without touching each kit's code.
    //
    // Momentum-bar balls (e.g. Beyblade Ball) must NEVER actually lose real
    // HP - only their own onTakeDamage/onWallHit/onBallCollide hooks are
    // supposed to cost them Động Lượng. But several abilities across the
    // roster (poison/frost ticks, hazards, bombs, reflect damage, etc.)
    // write directly to `ball.hp` and skip modifyIncoming/onTakeDamage
    // entirely, which used to let those sources silently kill a Beyblade
    // Ball even while its Động Lượng bar was still full. We catch that here:
    // any incidental HP loss on a momentum-bar ball is undone and converted
    // into the same 1% Động Lượng cost as every other hit.
    this.balls.forEach((ball,i)=>{
      if(!ball.alive) return;
      let dmg=hpBefore[i]-ball.hp;
      if(dmg>0.01){
        if(ball.def.momentumBar){
          ball.hp=hpBefore[i];
          ball.state.momentum=Math.max(0,(ball.state.momentum==null?100:ball.state.momentum)-1);
          spawnFloatText(this,ball.x,ball.y-30,'-1% ĐL','#2fd4ff');
          if(ball.state.momentum<=0) ball.hp=0;
          dmg=1;
        }
        ball.state.flashUntil=this.t+0.14;
        ball.state.hitPopAt=this.t;
        this.triggerShake(clamp(2+dmg*0.35,2,11), 0.16);
        spawnParticles(this,ball.x,ball.y,clamp(Math.round(3+dmg*0.35),3,14),{color:ball.color,speed:190,type:'spark'});
      }
    });

    // check death
    for(const ball of this.balls){
      if(ball.hp<=0 && ball.alive){
        let revived=false;
        if(ball.def.onDeath && powerOk(ball,this)) revived=ball.def.onDeath(ball,this);
        if(!revived){
          ball.alive=false;
          this.endMatch(this.opponentOf(ball));
        }
      }
    }
    this.updateHUD();
  }

  updateProjectiles(dt){
    for(const pr of this.projectiles){
      pr.x+=pr.vx*dt; pr.y+=pr.vy*dt; pr.life-=dt;
      if(pr.piercing){
        // straight-through projectile (e.g. Conductor's train): no wall bounce,
        // just dies once it exits the arena bounds
        if(pr.x<-60 || pr.x>this.w+60 || pr.y<-60 || pr.y>this.h+60) pr.dead=true;
      } else {
        let bounced=false;
        if(pr.x<pr.r){ pr.x=pr.r; pr.vx=Math.abs(pr.vx); bounced=true; }
        else if(pr.x>this.w-pr.r){ pr.x=this.w-pr.r; pr.vx=-Math.abs(pr.vx); bounced=true; }
        if(pr.y<pr.r){ pr.y=pr.r; pr.vy=Math.abs(pr.vy); bounced=true; }
        else if(pr.y>this.h-pr.r){ pr.y=this.h-pr.r; pr.vy=-Math.abs(pr.vy); bounced=true; }
        if(bounced){
          if((pr.bouncesLeft||0)>0){ pr.bouncesLeft--; if(pr.growPerBounce) pr.dmg*=1+pr.growPerBounce; }
          else { pr.dead=true; }
        }
      }
      if(!pr.dead){
        const target=this.balls.find(b=>b!==pr.owner && b.alive);
        if(target && dist(pr.x,pr.y,target.x,target.y)<pr.r+target.radius){
          if(pr.piercing){
            if(this.t-(pr.lastHit||-99)>0.4){ pr.lastHit=this.t; this.applyProjectileDamage(pr,target); }
          } else {
            this.applyProjectileDamage(pr,target);
            pr.dead=true;
          }
        }
      }
      if(pr.life<=0) pr.dead=true;
    }
    this.projectiles=this.projectiles.filter(p=>!p.dead);
  }
  applyProjectileDamage(pr,target){
    const attacker=pr.owner;
    let dmg=pr.dmg*attacker.currentMods(this).dmgMult;
    if(attacker.def.modifyOutgoing && powerOk(attacker,this)) dmg=attacker.def.modifyOutgoing(attacker,target,dmg,this,'projectile');
    if(target.def.modifyIncoming && powerOk(target,this)) dmg=target.def.modifyIncoming(target,attacker,dmg,this,'projectile');
    dmg=applyVulnerability(target,dmg,this);
    dmg=applyStunPenalty(attacker,dmg,this);
    dmg=applyBurnPenalty(attacker,dmg,this);
    target.hp=Math.max(0,target.hp-dmg);
    if(attacker.def.onDealDamage && powerOk(attacker,this)) attacker.def.onDealDamage(attacker,target,dmg,this);
    if(target.def.onTakeDamage && powerOk(target,this)) target.def.onTakeDamage(target,attacker,dmg,this);
    if(dmg>0) spawnFloatText(this,target.x,target.y-30,'-'+dmg.toFixed(0),pr.color||'#ff5c7c');
    if(pr.knockback){
      const ang=Math.atan2(target.y-pr.y,target.x-pr.x);
      applyKnockback(target,ang,pr.knockback,true);
    }
    if(pr.type==='hook'){
      const ang=Math.atan2(attacker.y-target.y,attacker.x-target.x);
      if(applyKnockback(target,ang,260,true)){
        target.state.disorientedUntil=this.t+1.5;
        spawnFloatText(this,target.x,target.y-50,'HOOKED!','#e0c080');
      }
    }
    spawnParticles(this,pr.x,pr.y,5);
  }
  updateHazards(dt){
    // Track whether each ball is standing in ANY frost patch this frame —
    // Frost Ball leaves many overlapping short-lived patches along its trail,
    // and they should all count as one continuous "frozen zone" for the
    // freeze-buildup timer, not reset every time you step from one patch
    // into the next.
    const inFrostThisFrame = new Set();
    for(const hz of this.hazards){
      for(const ball of this.balls){
        if(!ball.alive || hz.owner===ball) continue;
        if(pointInHazard(hz,ball)){
          applyHazardEffect(hz,ball,this,dt);
          if(hz.type==='frostzone') inFrostThisFrame.add(ball);
        }
      }
    }
    for(const ball of this.balls){
      if(!ball.alive) continue;
      if(inFrostThisFrame.has(ball)){
        ball.state.frostContactTime=(ball.state.frostContactTime||0)+dt;
        if(ball.state.frostContactTime>1.5){
          ball.state.frostContactTime=0;
          ball.state.frozenUntil=this.t+1.5;
          ball.state.poisonUntil=this.t+1.5; ball.state.poisonTickDmg=6;
          spawnFloatText(this,ball.x,ball.y-30,'FROZEN!','#a8e8ff');
        }
      } else {
        ball.state.frostContactTime=0;
      }
    }
    this.hazards=this.hazards.filter(hz=>this.t<hz.until);
  }
  updateBombs(){
    for(const bomb of this.bombs){
      if(this.t>=bomb.at && !bomb.exploded){
        bomb.exploded=true;
        explodeAt(this,bomb.x,bomb.y,bomb.owner,155,dmgFor(bomb.owner,10));
      }
    }
    this.bombs=this.bombs.filter(bm=>!bm.exploded);
  }
  // Train Ball: a marker that travels along the exact recorded rail polyline
  // (instead of a straight random sweep) and launches anyone it touches.
  // Once it finishes traversing, the rail that produced it disappears (onComplete).
  spawnTrain(owner,path,onComplete){
    if(path.length<2){ if(onComplete) onComplete(); return; }
    this.trains.push({owner,path,seg:0,segT:0,speed:520,r:22,dmg:22,hitSet:new Set(),x:path[0].x,y:path[0].y,onComplete,dead:false,history:[]});
  }
  updateTrains(dt){
    for(const tr of this.trains){
      if(tr.dead) continue;
      const p0=tr.path[tr.seg], p1=tr.path[tr.seg+1];
      if(!p1){ tr.dead=true; if(tr.onComplete) tr.onComplete(); continue; }
      const segLen=dist(p0.x,p0.y,p1.x,p1.y)||1;
      tr.segT += (tr.speed*dt)/segLen;
      if(tr.segT>=1){
        tr.segT=0; tr.seg++;
        if(tr.seg>=tr.path.length-1){ tr.dead=true; if(tr.onComplete) tr.onComplete(); continue; }
      }
      const a=tr.path[tr.seg], c=tr.path[tr.seg+1];
      tr.x=a.x+(c.x-a.x)*tr.segT; tr.y=a.y+(c.y-a.y)*tr.segT;
      // remember recent positions so we can render + hit-test 3 trailing cars
      // behind the engine, giving the train a real length (4 toa total)
      tr.history.unshift({x:tr.x,y:tr.y});
      if(tr.history.length>30) tr.history.length=30;
      for(const other of this.balls){
        if(other===tr.owner || !other.alive || tr.hitSet.has(other)) continue;
        let hit = dist(tr.x,tr.y,other.x,other.y)<tr.r+other.radius;
        if(!hit){
          for(let i=6;i<tr.history.length;i+=6){
            const h=tr.history[i];
            if(dist(h.x,h.y,other.x,other.y)<tr.r*0.85+other.radius){ hit=true; break; }
          }
        }
        if(hit){
          tr.hitSet.add(other);
          // fixed flat damage — not scaled by owner stats or modifiers
          let dmg=tr.dmg;
          dmg=applyVulnerability(other,dmg,this);
          other.hp=Math.max(0,other.hp-dmg);
          spawnFloatText(this,other.x,other.y-30,'-'+dmg.toFixed(0),'#ffb347');
          // "hất tung": strong launch impulse away from the train
          const ang=Math.atan2(other.y-tr.y,other.x-tr.x);
          if(applyKnockback(other,ang,420,true)){
            other.state.disorientedUntil=this.t+0.6;
            spawnFloatText(this,other.x,other.y-50,'LAUNCHED!','#ffb347');
          }
          spawnParticles(this,tr.x,tr.y,10);
        }
      }
    }
    this.trains=this.trains.filter(t=>!t.dead);
  }
  // Cell Ball: a truly independent clone entity that flies off and bounces
  // around the arena like a normal ball (instead of orbiting its parent).
  // Radius matches the parent Cell Ball's own current size.
  spawnCellClone(owner,x,y,vx,vy){
    this.cellClones.push({owner,x,y,vx,vy,r:owner.radius,dmg:dmgFor(owner,3)*4,lastHit:-99});
  }
  updateCellClones(dt){
    for(const c of this.cellClones){
      c.x+=c.vx*dt; c.y+=c.vy*dt;
      if(c.x-c.r<0){ c.x=c.r; c.vx=Math.abs(c.vx); }
      if(c.x+c.r>this.w){ c.x=this.w-c.r; c.vx=-Math.abs(c.vx); }
      if(c.y-c.r<0){ c.y=c.r; c.vy=Math.abs(c.vy); }
      if(c.y+c.r>this.h){ c.y=this.h-c.r; c.vy=-Math.abs(c.vy); }
      const other=this.opponentOf(c.owner);
      if(other && other.alive && dist(c.x,c.y,other.x,other.y)<other.radius+c.r && this.t-c.lastHit>0.6){
        c.lastHit=this.t;
        let dmg=applyVulnerability(other,c.dmg,this);
        other.hp=Math.max(0,other.hp-dmg);
        const ang=Math.atan2(other.y-c.y,other.x-c.x);
        applyKnockback(other,ang,70,true);
        spawnFloatText(this,other.x,other.y-30,'-'+dmg.toFixed(0),'#8dff7a');
      }
    }
  }
  // Generic expanding-ring visual for AOE explosions (Bomb Ball etc.)
  spawnExplosionRing(x,y,radius,fillRGB,strokeRGB){
    this.explosions.push({x,y,radius,start:this.t,dur:0.45,fillRGB,strokeRGB});
    this.triggerShake(clamp(radius*0.045,3,13), 0.22);
  }

  // ---- Tornado Ball vortex: pull (gentle, chip dmg) -> capture (forced
  // orbit) -> explode (knockback + burst dmg). Lives entirely in its own
  // array (like bombs/trains) since its lifecycle is unique. Balance knobs
  // (pullRadius/exposure-to-capture/captureR/explosion size) are kept
  // moderate on purpose - see Tornado Ball's own trigger cooldown/chance in
  // BALL_TYPES for the other half of the balance story.
  spawnTornado(x,y,owner){
    this.tornadoes.push({
      x,y,owner,createdAt:this.t,life:2,
      pullRadius:140, exposure:0, captured:false,
      captureAngle:0, captureR:55, lastTick:0, dead:false
    });
  }
  updateTornadoes(dt){
    for(const tor of this.tornadoes){
      if(tor.dead) continue;
      const age=this.t-tor.createdAt;
      if(age>=tor.life){
        tor.dead=true;
        const target=this.opponentOf(tor.owner);
        if(target) target.state.tornadoCaptured=false;
        explodeAt(this,tor.x,tor.y,tor.owner,120,18);
        continue;
      }
      const target=this.opponentOf(tor.owner);
      if(!target || !target.alive) continue;
      const d=dist(target.x,target.y,tor.x,tor.y);
      if(!tor.captured){
        if(d<tor.pullRadius){
          tor.exposure+=dt;
          // gentle pull: bend the victim's heading toward the eye a little
          // each frame, keep their own speed unchanged - "kéo nhẹ chứ không
          // kéo hẳn" (only nudges direction, never snaps or drags in a line)
          const pullAng=Math.atan2(tor.y-target.y,tor.x-target.x);
          const curAng=Math.atan2(target.vy,target.vx);
          const newAng=angleLerp(curAng,pullAng,1.2*dt);
          const spd=target.speedLock||Math.hypot(target.vx,target.vy);
          target.vx=Math.cos(newAng)*spd; target.vy=Math.sin(newAng)*spd;
          if(this.t-(tor.lastTick||0)>0.2){
            tor.lastTick=this.t;
            target.hp=Math.max(0,target.hp-1);
            spawnFloatText(this,target.x,target.y-20,'-1','#c9a8ff');
          }
          if(tor.exposure>=1){
            tor.captured=true;
            target.state.tornadoCaptured=true;
            tor.captureAngle=Math.atan2(target.y-tor.y,target.x-tor.x);
            tor.captureR=clamp(d,30,80);
            spawnFloatText(this,target.x,target.y-40,'CUỐN VÀO LỐC!','#8a4fd9');
          }
        } else {
          tor.exposure=Math.max(0,tor.exposure-dt*2);
        }
      } else {
        // captured: forced circular orbit around the eye of the storm,
        // completely overriding the victim's own control until it explodes
        const w=4.5;
        tor.captureAngle+=w*dt;
        const nx=clamp(tor.x+Math.cos(tor.captureAngle)*tor.captureR, target.radius, this.w-target.radius);
        const ny=clamp(tor.y+Math.sin(tor.captureAngle)*tor.captureR, target.radius, this.h-target.radius);
        target.x=nx; target.y=ny;
        target.vx=-Math.sin(tor.captureAngle)*tor.captureR*w;
        target.vy=Math.cos(tor.captureAngle)*tor.captureR*w;
        lockSpeed(target, Math.hypot(target.vx,target.vy));
      }
    }
    this.tornadoes=this.tornadoes.filter(t=>!t.dead);
  }

  resolveWallCollision(ball){
    const r=ball.radius;
    let hit=false, normal=null;
    // Walls are always perfectly elastic - a bounce only ever flips
    // direction, never speed.
    const rest = 1.0;
    if(ball.x-r<0){ ball.x=r; ball.vx=Math.abs(ball.vx)*rest; hit=true; normal={x:1,y:0}; }
    if(ball.x+r>this.w){ ball.x=this.w-r; ball.vx=-Math.abs(ball.vx)*rest; hit=true; normal={x:-1,y:0}; }
    if(ball.y-r<0){ ball.y=r; ball.vy=Math.abs(ball.vy)*rest; hit=true; normal={x:0,y:1}; }
    if(ball.y+r>this.h){ ball.y=this.h-r; ball.vy=-Math.abs(ball.vy)*rest; hit=true; normal={x:0,y:-1}; }
    if(hit){
      clampBallSpeed(ball);
      // Charge Ball "slam" debuff: victim takes a fixed hit + stun + dust burst
      // on the next wall impact after being launched (nerfed to trigger once).
      if(ball.state.chargeWallHitsLeft>0){
        ball.state.chargeWallHitsLeft--;
        const dmg=ball.state.chargeWallDmg||10;
        ball.hp=Math.max(0,ball.hp-dmg);
        ball.state.stunUntil=this.t+(ball.state.chargeWallStun||0.3);
        this.spawnExplosionRing(ball.x,ball.y,60,'168,124,74','120,88,52');
        spawnParticles(this,ball.x,ball.y,14);
        spawnFloatText(this,ball.x,ball.y-30,'-'+dmg.toFixed(0),'#c9a56b');
        spawnFloatText(this,ball.x,ball.y-50,'STUN!','#c9a56b');
      }
      if(ball.def.onWallHit && powerOk(ball,this)) ball.def.onWallHit(ball,this,normal);
    }
  }
  resolveObstacleCollision(ball){
    for(const o of this.mapObstacles){
      if(o.type==='circle'){
        const d=dist(ball.x,ball.y,o.x,o.y);
        const minD=ball.radius+o.r;
        if(d<minD && d>0.001){
          const nx=(ball.x-o.x)/d, ny=(ball.y-o.y)/d;
          ball.x=o.x+nx*minD; ball.y=o.y+ny*minD;
          const dot=ball.vx*nx+ball.vy*ny;
          ball.vx -= 2*dot*nx; ball.vy -= 2*dot*ny;
          clampBallSpeed(ball);
          if(ball.def.onWallHit && powerOk(ball,this)) ball.def.onWallHit(ball,this,{x:nx,y:ny});
        }
      } else if(o.type==='rect'){
        const nx=clamp(ball.x,o.x,o.x+o.w);
        const ny=clamp(ball.y,o.y,o.y+o.h);
        const d=dist(ball.x,ball.y,nx,ny);
        if(d<ball.radius && d>0.001){
          const dirx=(ball.x-nx)/d, diry=(ball.y-ny)/d;
          ball.x=nx+dirx*ball.radius; ball.y=ny+diry*ball.radius;
          const dot=ball.vx*dirx+ball.vy*diry;
          ball.vx -= 2*dot*dirx; ball.vy -= 2*dot*diry;
          clampBallSpeed(ball);
          if(ball.def.onWallHit && powerOk(ball,this)) ball.def.onWallHit(ball,this,{x:dirx,y:diry});
        }
      }
    }
  }
  resolvePortals(ball){
    for(const p of this.mapPortals){
      if(!ball.state.portalCD || this.t>ball.state.portalCD){
        if(dist(ball.x,ball.y,p.a.x,p.a.y)<p.a.r+ball.radius*0.5){
          ball.x=p.b.x; ball.y=p.b.y; ball.state.portalCD=this.t+0.4;
          if(ball.def.onPortal && powerOk(ball,this)) ball.def.onPortal(ball,this);
        } else if(dist(ball.x,ball.y,p.b.x,p.b.y)<p.b.r+ball.radius*0.5){
          ball.x=p.a.x; ball.y=p.a.y; ball.state.portalCD=this.t+0.4;
          if(ball.def.onPortal && powerOk(ball,this)) ball.def.onPortal(ball,this);
        }
      }
    }
  }
  resolveBallCollision(){
    const [a,b]=this.balls;
    if(!a.alive||!b.alive) return;
    // Florentino Ball mid-dance (toCenter/picking) lướt thẳng qua/đè lên đối
    // thủ - bỏ qua tách vị trí lẫn va chạm sát thương thường trong lúc đó,
    // vì bản thân kỹ năng đã tự xử lý choáng + sát thương riêng.
    const floDancing=(ph)=> ph==='toCenter' || ph==='picking';
    if(floDancing(a.state.floPhase) || floDancing(b.state.floPhase)) return;
    // Tornado Ball mid-spin (self-orbit) or a victim currently captured by a
    // tornado both move under fully hand-managed velocity/position each
    // frame - let those systems own the interaction instead of double-
    // resolving a normal elastic bounce on top of it.
    const tornadoBusy=(x)=> x.state.torPhase==='spin' || x.state.tornadoCaptured;
    if(tornadoBusy(a) || tornadoBusy(b)) return;
    const d=dist(a.x,a.y,b.x,b.y);
    const minD=a.radius+b.radius;
    if(d<minD && d>0.001){
      const nx=(b.x-a.x)/d, ny=(b.y-a.y)/d;
      const overlap=minD-d;
      a.x-=nx*overlap/2; a.y-=ny*overlap/2;
      b.x+=nx*overlap/2; b.y+=ny*overlap/2;

      const relVx=b.vx-a.vx, relVy=b.vy-a.vy;
      const relSpeed=Math.abs(relVx*nx+relVy*ny);
      const restitution=1.0; // perfectly elastic: balls never lose speed from colliding with each other
      const dot=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
      if(dot<0){
        // Mass-based elastic impulse: heavier balls (e.g. Big Spike Ball)
        // get redirected much less than lighter ones, but the impulse only
        // ever steers DIRECTION now - enforceSpeedLock right after snaps
        // each ball's speed straight back to its own locked constant, so a
        // routine bounce can never speed a ball up or down.
        const m1=a.mass, m2=b.mass;
        const impulse=-(1+restitution)*dot/(1/m1+1/m2);
        a.vx-=(impulse/m1)*nx; a.vy-=(impulse/m1)*ny;
        b.vx+=(impulse/m2)*nx; b.vy+=(impulse/m2)*ny;
      }
      clampBallSpeed(a); clampBallSpeed(b);
      enforceSpeedLock(a, a.currentMods(this).speedMult); enforceSpeedLock(b, b.currentMods(this).speedMult);

      // ICD to avoid multi-trigger within the same clump
      const collisionICD=0.25;
      if(!a.state.lastCollide || this.t-a.state.lastCollide>collisionICD){
        a.state.lastCollide=this.t; b.state.lastCollide=this.t;
        if(a.def.onBallCollide && powerOk(a,this)) a.def.onBallCollide(a,b,this);
        if(b.def.onBallCollide && powerOk(b,this)) b.def.onBallCollide(b,a,this);
        this.applyCombatDamage(a,b,relSpeed);
        this.applyCombatDamage(b,a,relSpeed);
        clampBallSpeed(a); clampBallSpeed(b);
        enforceSpeedLock(a, a.currentMods(this).speedMult); enforceSpeedLock(b, b.currentMods(this).speedMult);
        spawnParticles(this,(a.x+b.x)/2,(a.y+b.y)/2);
      }
    }
  }
  applyCombatDamage(attacker,defender,relSpeed){
    if(!attacker.alive || !defender.alive) return;
    const modsA=attacker.currentMods(this);
    // Base collision damage is fixed per-ball (dmgFor) and no longer scales
    // with impact speed - speed only affects damage through a ball's own
    // speed/CC ability (e.g. Charge Ball, Shooting Ball, Dice Ball), never
    // as a generic side-effect of how hard two balls happened to collide.
    let dmg=dmgFor(attacker,6) * modsA.dmgMult;
    if(attacker.def.modifyOutgoing && powerOk(attacker,this)) dmg=attacker.def.modifyOutgoing(attacker,defender,dmg,this,'collision');
    if(defender.def.modifyIncoming && powerOk(defender,this)) dmg=defender.def.modifyIncoming(defender,attacker,dmg,this,'collision');
    dmg=applyVulnerability(defender,dmg,this);
    dmg=applyStunPenalty(attacker,dmg,this);
    dmg=applyBurnPenalty(attacker,dmg,this);
    defender.hp=Math.max(0,defender.hp-dmg);
    if(attacker.def.onDealDamage && powerOk(attacker,this)) attacker.def.onDealDamage(attacker,defender,dmg,this);
    if(defender.def.onTakeDamage && powerOk(defender,this)) defender.def.onTakeDamage(defender,attacker,dmg,this);
    if(dmg>0) spawnFloatText(this,defender.x,defender.y-30,'-'+dmg.toFixed(0),'#ff5c7c');
  }

  updateHUD(){
    const [a,b]=this.balls;
    this._lastHudHp=this._lastHudHp||{1:a.hp,2:b.hp};
    this._lastHudMom=this._lastHudMom||{1:100,2:100};
    [[a,'p1'],[b,'p2']].forEach(([ball,pfx])=>{
      const bar=document.getElementById(pfx+'HpBar');
      const block=document.querySelector('.hp-'+pfx);
      const isMom=!!ball.def.momentumBar;
      const mom=clamp(ball.state.momentum==null?100:ball.state.momentum,0,100);
      const frac=isMom?mom/100:clamp(ball.hp/ball.maxHp,0,1);
      bar.style.width=frac*100+'%';
      document.getElementById(pfx+'HpText').textContent=isMom?Math.round(mom)+'% ĐL':Math.ceil(Math.max(0,ball.hp))+'/'+Math.round(ball.maxHp);
      bar.classList.toggle('momentum',isMom);
      bar.classList.toggle('low', frac<0.25);
      const momTag=document.getElementById(pfx+'MomTag');
      if(momTag) momTag.style.display=isMom?'inline-block':'none';
      const prev=isMom?this._lastHudMom[ball.player]:this._lastHudHp[ball.player];
      if((isMom?mom:ball.hp)<prev && block){
        block.classList.remove('hit'); void block.offsetWidth; block.classList.add('hit');
      }
      this._lastHudHp[ball.player]=ball.hp;
      this._lastHudMom[ball.player]=mom;
    });
  }

  // toggles a soft glow on whichever player's HP block is currently aiming,
  // so it's obvious at a glance whose turn it is without reading statusBar
  updateTurnGlow(){
    const p1=document.querySelector('.hp-p1'), p2=document.querySelector('.hp-p2');
    if(p1) p1.classList.toggle('your-turn', this.phase==='aim1');
    if(p2) p2.classList.toggle('your-turn', this.phase==='aim2');
  }

  endMatch(winnerBall){
    this.phase='end';
    const msg=document.getElementById('roundMsg');
    msg.style.display='block';
    const col=winnerBall.player===1?'#d94f4f':'#3d6fd9';
    msg.style.color=col;
    msg.textContent=`🏆 PLAYER ${winnerBall.player} THẮNG!`;
    document.getElementById('btnRematch').style.display='inline-block';
    this.updateTurnGlow();
    // victory flourish: a burst of sparks from the winner + confetti raining
    // down from the top of the arena in the winner's color, gold and white
    spawnParticles(this,winnerBall.x,winnerBall.y,26,{color:col,type:'spark',speed:260,life:0.7});
    for(let i=0;i<46;i++){
      this.particles.push({
        x:rand(0,this.w), y:rand(-60,-10),
        vx:rand(-30,30), vy:rand(90,180),
        r:rand(4,7), born:this.t, until:this.t+rand(1.6,2.6),
        color:Math.random()<0.5?col:(Math.random()<0.5?'#ffd166':'#ffffff'),
        type:'confetti', gravity:70, rot:rand(0,Math.PI*2), rotSpeed:rand(-5,5)
      });
    }
  }

  render(dt){
    // Fallback so any other/older call site that still calls render() with
    // no argument keeps behaving exactly like before (assume ~60fps).
    if(dt==null) dt=1/60;
    const ctx=this.ctx;
    ctx.clearRect(0,0,this.w,this.h);
    ctx.save();

    // ---- screen shake (impacts/explosions) ----
    let shakeX=0, shakeY=0;
    if(this.t<this.shakeUntil && this.shakeMag>0){
      const remain=(this.shakeUntil-this.t);
      const k=this.shakeMag*Math.min(1,remain/0.22);
      shakeX=(Math.sin(this.t*53+this.shakeSeed)+Math.sin(this.t*97))*0.5*k;
      shakeY=(Math.cos(this.t*61+this.shakeSeed)+Math.cos(this.t*83))*0.5*k;
      ctx.translate(shakeX,shakeY);
    } else { this.shakeMag=0; }

    // ---- background: soft gradient + faint grid + turn-tinted vignette ----
    const bgGrad=ctx.createLinearGradient(0,0,0,this.h);
    bgGrad.addColorStop(0,'#ffffff');
    bgGrad.addColorStop(1,'#f4f4f2');
    ctx.fillStyle=bgGrad;
    ctx.fillRect(-20,-20,this.w+40,this.h+40);
    ctx.strokeStyle='rgba(26,26,26,0.045)';
    ctx.lineWidth=1;
    for(let x=0;x<=this.w;x+=30){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.h); ctx.stroke(); }
    for(let y=0;y<=this.h;y+=30){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.w,y); ctx.stroke(); }
    // gentle corner vignette so the flat arena reads with a bit of depth
    const vg=ctx.createRadialGradient(this.w/2,this.h/2,this.h*0.25,this.w/2,this.h/2,this.h*0.72);
    vg.addColorStop(0,'rgba(0,0,0,0)');
    vg.addColorStop(1,'rgba(0,0,0,0.05)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,this.w,this.h);

    // ---- night cycle (Werewolf Ball): dim the arena + a moon overhead ----
    // triggered by any ball flagged state.nightMode=true; sits underneath
    // obstacles/balls so gameplay stays perfectly readable, just moodier.
    if(this.balls.some(b=>b.state && b.state.nightMode)){
      ctx.save();
      ctx.fillStyle='rgba(12,16,36,0.5)';
      ctx.fillRect(0,0,this.w,this.h);
      const mx=this.w/2, my=this.h/2, mr=Math.min(this.w,this.h)*0.1;
      const moonGlow=ctx.createRadialGradient(mx,my,mr*0.2,mx,my,mr*2.6);
      moonGlow.addColorStop(0,'rgba(255,250,222,0.32)');
      moonGlow.addColorStop(1,'rgba(255,250,222,0)');
      ctx.fillStyle=moonGlow; ctx.beginPath(); ctx.arc(mx,my,mr*2.6,0,Math.PI*2); ctx.fill();
      const moonGrad=ctx.createRadialGradient(mx-mr*0.3,my-mr*0.3,mr*0.1,mx,my,mr);
      moonGrad.addColorStop(0,'#fffdf3'); moonGrad.addColorStop(1,'#e6dfc4');
      ctx.beginPath(); ctx.arc(mx,my,mr,0,Math.PI*2); ctx.fillStyle=moonGrad; ctx.fill();
      ctx.fillStyle='rgba(196,190,162,0.55)';
      ctx.beginPath(); ctx.arc(mx-mr*0.35,my-mr*0.15,mr*0.16,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx+mr*0.25,my+mr*0.3,mr*0.11,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx+mr*0.05,my-mr*0.35,mr*0.08,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // border — glows in whichever player's turn color while aiming
    const turnColor = this.phase==='aim1' ? '#d94f4f' : this.phase==='aim2' ? '#3d6fd9' : null;
    if(turnColor){
      ctx.save();
      ctx.shadowColor=turnColor; ctx.shadowBlur=16;
      ctx.strokeStyle=rgba(turnColor,0.9); ctx.lineWidth=3;
      ctx.strokeRect(3,3,this.w-6,this.h-6);
      ctx.restore();
    }
    ctx.strokeStyle='#1a1a1a';
    ctx.lineWidth=3;
    ctx.strokeRect(3,3,this.w-6,this.h-6);

    // obstacles — soft bevel gradient + grounded shadow so flat shapes still
    // read with a touch of depth
    for(const o of this.mapObstacles){
      ctx.save();
      ctx.shadowColor='rgba(0,0,0,0.18)'; ctx.shadowBlur=10; ctx.shadowOffsetY=4;
      const cx=o.type==='circle'?o.x:o.x+o.w/2, cy=o.type==='circle'?o.y:o.y+o.h/2;
      const rr=o.type==='circle'?o.r:Math.max(o.w,o.h)/2;
      const grad=ctx.createRadialGradient(cx-rr*0.35,cy-rr*0.35,rr*0.1,cx,cy,rr*1.15);
      grad.addColorStop(0,'#f4f4f0'); grad.addColorStop(1,'#d8d8d0');
      ctx.beginPath();
      if(o.type==='circle'){ ctx.arc(o.x,o.y,o.r,0,Math.PI*2); }
      else { ctx.rect(o.x,o.y,o.w,o.h); }
      ctx.fillStyle=grad; ctx.fill();
      ctx.shadowColor='transparent';
      ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=2; ctx.stroke();
      ctx.restore();
    }
    // portals — animated swirling energy ring so each linked pair pops
    for(const p of this.mapPortals){
      [p.a,p.b].forEach(pt=>{
        ctx.save();
        ctx.shadowColor=p.color; ctx.shadowBlur=14;
        const pulse=0.85+0.15*Math.sin(this.t*4+pt.x*0.02);
        const grad=ctx.createRadialGradient(pt.x,pt.y,pt.r*0.1,pt.x,pt.y,pt.r*pulse);
        grad.addColorStop(0,rgba(p.color,0.55));
        grad.addColorStop(1,rgba(p.color,0.08));
        ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r*pulse,0,Math.PI*2);
        ctx.fillStyle=grad; ctx.fill();
        ctx.strokeStyle=p.color; ctx.lineWidth=3; ctx.stroke();
        // two counter-rotating swirl arcs for a "portal" feel
        ctx.setLineDash([pt.r*0.7,pt.r*1.4]);
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r*0.62,this.t*3,this.t*3+Math.PI*1.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r*0.34,-this.t*4,-this.t*4+Math.PI*1.5); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      });
    }
    // hazards (traps, zones, laser beams) - soft pulsing gradient fills with glow
    for(const hz of this.hazards){
      ctx.save();
      const pulse=0.8+0.2*Math.sin(this.t*5+ (hz.x||0)*0.05);
      if(hz.type==='poisontrap'){
        ctx.shadowColor='#4f9e42'; ctx.shadowBlur=12;
        const g=ctx.createRadialGradient(hz.x,hz.y,0,hz.x,hz.y,hz.r);
        g.addColorStop(0,'rgba(141,255,122,0.30)'); g.addColorStop(1,'rgba(79,158,66,0.05)');
        ctx.beginPath(); ctx.arc(hz.x,hz.y,hz.r*pulse,0,Math.PI*2);
        ctx.fillStyle=g; ctx.fill();
        ctx.strokeStyle='#4f9e42'; ctx.lineWidth=2; ctx.stroke();
      } else if(hz.type==='frostzone'){
        ctx.shadowColor='#3d8fd9'; ctx.shadowBlur=12;
        const g=ctx.createRadialGradient(hz.x,hz.y,0,hz.x,hz.y,hz.r);
        g.addColorStop(0,'rgba(168,232,255,0.32)'); g.addColorStop(1,'rgba(61,143,217,0.05)');
        ctx.beginPath(); ctx.arc(hz.x,hz.y,hz.r,0,Math.PI*2);
        ctx.fillStyle=g; ctx.fill();
        ctx.strokeStyle='#3d8fd9'; ctx.lineWidth=2; ctx.stroke();
      } else if(hz.type==='web'){
        ctx.beginPath(); ctx.arc(hz.x,hz.y,hz.r,0,Math.PI*2);
        ctx.fillStyle='rgba(120,120,115,0.14)'; ctx.fill();
        ctx.strokeStyle='#78786f'; ctx.setLineDash([3,3]); ctx.lineDashOffset=-this.t*10; ctx.stroke(); ctx.setLineDash([]);
      } else if(hz.type==='laser'){
        ctx.shadowColor='#d94f4f'; ctx.shadowBlur=14;
        const g=ctx.createLinearGradient(hz.x,hz.y,hz.x,hz.y+hz.h);
        g.addColorStop(0,`rgba(217,79,79,${0.14*pulse})`); g.addColorStop(0.5,`rgba(255,138,138,${0.34*pulse})`); g.addColorStop(1,`rgba(217,79,79,${0.14*pulse})`);
        ctx.fillStyle=g; ctx.fillRect(hz.x,hz.y,hz.w,hz.h);
        ctx.strokeStyle='#d94f4f'; ctx.lineWidth=2; ctx.strokeRect(hz.x,hz.y,hz.w,hz.h);
      } else if(hz.type==='zonebox'){
        ctx.shadowColor='#d94f4f'; ctx.shadowBlur=10;
        ctx.fillStyle=`rgba(217,79,79,${0.16*pulse})`; ctx.fillRect(hz.x,hz.y,hz.w,hz.h);
        ctx.strokeStyle='#d94f4f'; ctx.lineWidth=2; ctx.setLineDash([5,4]); ctx.lineDashOffset=-this.t*14;
        ctx.strokeRect(hz.x,hz.y,hz.w,hz.h); ctx.setLineDash([]);
      } else if(hz.type==='leafpatch'){
        // a single fallen leaf, not a generic glow blob - small rotated
        // leaf shape that settles then fades near the end of its life
        const life=clamp((hz.until-this.t)/1.4,0,1);
        ctx.shadowColor='#6fbf3f'; ctx.shadowBlur=8;
        ctx.globalAlpha=0.35+0.5*life;
        ctx.translate(hz.x,hz.y); ctx.rotate((hz._rot=hz._rot||Math.random()*Math.PI*2));
        ctx.fillStyle= life>0.5?'#6fbf3f':'#a3874a';
        ctx.beginPath();
        ctx.moveTo(0,-hz.r*0.9); ctx.quadraticCurveTo(hz.r*0.7,0,0,hz.r*0.9);
        ctx.quadraticCurveTo(-hz.r*0.7,0,0,-hz.r*0.9);
        ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(0,-hz.r*0.85); ctx.lineTo(0,hz.r*0.85); ctx.stroke();
      }
      ctx.restore();
    }
    // projectiles (bullets, knives, arrows, hooks...) - glowing core + a short
    // fading motion trail so fast shots read as streaks, not just dots.
    // Weapon-throwing balls (Machine Gun/Thief/Bow) pass a `shape` so their
    // shot actually looks like the weapon it is, oriented along its flight
    // path; anything without a shape keeps the plain glowing-dot look.
    for(const pr of this.projectiles){
      pr._trail=pr._trail||[];
      pr._trail.unshift({x:pr.x,y:pr.y});
      if(pr._trail.length>6) pr._trail.length=6;
      for(let i=pr._trail.length-1;i>=0;i--){
        const a=(1-i/pr._trail.length)*0.35;
        ctx.beginPath(); ctx.arc(pr._trail[i].x,pr._trail[i].y,pr.r*(1-i*0.1),0,Math.PI*2);
        ctx.fillStyle=rgba(pr.color||'#1a1a1a',a); ctx.fill();
      }
      ctx.save();
      ctx.shadowColor=pr.color||'#1a1a1a'; ctx.shadowBlur=9;
      if(pr.shape){
        const s=pr.r;
        ctx.translate(pr.x,pr.y);
        ctx.rotate(Math.atan2(pr.vy,pr.vx));
        ctx.beginPath();
        if(pr.shape==='bullet'){
          // small pointed capsule with a bright hot tip
          ctx.moveTo(s*1.6,0);
          ctx.lineTo(s*0.2, s*0.55);
          ctx.lineTo(-s*1.1, s*0.5);
          ctx.lineTo(-s*1.1,-s*0.5);
          ctx.lineTo(s*0.2,-s*0.55);
          ctx.closePath();
          const bg=ctx.createLinearGradient(-s*1.1,0,s*1.6,0);
          bg.addColorStop(0, darken(pr.color||'#1a1a1a',0.2));
          bg.addColorStop(1, '#fff8d8');
          ctx.fillStyle=bg;
        } else if(pr.shape==='knife'){
          // slim blade with a small handle
          ctx.moveTo(s*1.8,0);
          ctx.lineTo(-s*0.2, s*0.45);
          ctx.lineTo(-s*0.2, s*0.16);
          ctx.lineTo(-s*1.3, s*0.16);
          ctx.lineTo(-s*1.3,-s*0.16);
          ctx.lineTo(-s*0.2,-s*0.16);
          ctx.lineTo(-s*0.2,-s*0.45);
          ctx.closePath();
          ctx.fillStyle=pr.color||'#c8c8d8';
        } else if(pr.shape==='arrow'){
          // shaft + triangular head + back fletching
          ctx.moveTo(s*2.0,0); ctx.lineTo(s*0.9,s*0.5); ctx.lineTo(s*0.9,s*0.15);
          ctx.lineTo(-s*1.6,s*0.15); ctx.lineTo(-s*1.9,s*0.55);
          ctx.lineTo(-s*1.3,0);
          ctx.lineTo(-s*1.9,-s*0.55); ctx.lineTo(-s*1.6,-s*0.15);
          ctx.lineTo(s*0.9,-s*0.15); ctx.lineTo(s*0.9,-s*0.5);
          ctx.closePath();
          ctx.fillStyle=pr.color||'#9dffb0';
        }
        ctx.fill();
        ctx.lineWidth=1; ctx.strokeStyle='#1a1a1a'; ctx.stroke();
      } else {
        const g=ctx.createRadialGradient(pr.x-pr.r*0.3,pr.y-pr.r*0.3,pr.r*0.1,pr.x,pr.y,pr.r);
        g.addColorStop(0,'#ffffff'); g.addColorStop(0.55,pr.color||'#1a1a1a'); g.addColorStop(1,darken(pr.color||'#1a1a1a',0.25));
        ctx.beginPath(); ctx.arc(pr.x,pr.y,pr.r,0,Math.PI*2);
        ctx.fillStyle=g; ctx.fill();
        ctx.lineWidth=1; ctx.strokeStyle='#1a1a1a'; ctx.stroke();
      }
      ctx.shadowBlur=0;
      ctx.restore();
    }
    // trains (Train Ball) — engine + 3 trailing cars = 4 toa total, now with
    // a visible rail-bed track beneath them, wheels, and a trail of steam
    for(const tr of this.trains){
      // rail bed line following the actual path the train has already covered
      if(tr.history.length>1){
        ctx.beginPath();
        ctx.moveTo(tr.history[0].x,tr.history[0].y);
        for(let i=1;i<Math.min(tr.history.length,28);i++) ctx.lineTo(tr.history[i].x,tr.history[i].y);
        ctx.strokeStyle='rgba(90,60,20,0.45)'; ctx.lineWidth=tr.r*1.4; ctx.lineCap='round'; ctx.stroke();
        ctx.strokeStyle='rgba(230,180,110,0.4)'; ctx.lineWidth=2; ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]);
      }
      // steam puffs drifting up and away from the engine
      tr._smokeT=(tr._smokeT||0)+0.016;
      for(let i=0;i<3;i++){
        const age=(tr._smokeT*1.3+i*0.5)%1.5;
        const puffR=6+age*10;
        const puffY=tr.y-tr.r*1.3-age*22;
        const puffX=tr.x+Math.sin(i*2+age*3)*6;
        ctx.beginPath(); ctx.arc(puffX,puffY,puffR,0,Math.PI*2);
        ctx.fillStyle=`rgba(210,210,210,${(0.35*(1-age/1.5)).toFixed(2)})`; ctx.fill();
      }
      const carIdx=[7,14,21];
      for(const idx of carIdx){
        const h=tr.history[idx];
        if(!h) continue;
        // small wheels beneath the car
        ctx.beginPath();
        ctx.arc(h.x-tr.r*0.45,h.y+tr.r*0.55,tr.r*0.22,0,Math.PI*2);
        ctx.arc(h.x+tr.r*0.45,h.y+tr.r*0.55,tr.r*0.22,0,Math.PI*2);
        ctx.fillStyle='#3a2a1a'; ctx.fill();
        ctx.beginPath(); ctx.arc(h.x,h.y,tr.r*0.8,0,Math.PI*2);
        ctx.fillStyle='#e0a050'; ctx.fill();
        ctx.lineWidth=1.5; ctx.strokeStyle='#8a5a1f'; ctx.stroke();
        ctx.font=(tr.r*1.1)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🚃', h.x, h.y);
      }
      // wheels under the engine too
      ctx.beginPath();
      ctx.arc(tr.x-tr.r*0.5,tr.y+tr.r*0.6,tr.r*0.24,0,Math.PI*2);
      ctx.arc(tr.x+tr.r*0.5,tr.y+tr.r*0.6,tr.r*0.24,0,Math.PI*2);
      ctx.fillStyle='#3a2a1a'; ctx.fill();
      ctx.font=(tr.r*1.4)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🚂', tr.x, tr.y);
    }
    // pending bombs
    for(const bomb of this.bombs){
      ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('💣', bomb.x, bomb.y);
      const remain=Math.max(0,bomb.at-this.t);
      ctx.font='bold 11px sans-serif'; ctx.fillStyle='#1a1a1a';
      ctx.fillText(remain.toFixed(1)+'s', bomb.x, bomb.y+16);
    }
    // explosion AOE rings (Bomb Ball etc.) — hot flash core + expanding
    // shockwave ring + a fainter trailing echo ring for extra punch
    for(const ex of this.explosions){
      const p=clamp((this.t-ex.start)/ex.dur,0,1);
      const fillRGB=ex.fillRGB||'255,138,61', strokeRGB=ex.strokeRGB||'217,79,79';
      ctx.save();
      // quick white-hot flash at the very start, fading fast
      if(p<0.35){
        const fp=1-p/0.35;
        ctx.beginPath(); ctx.arc(ex.x,ex.y,ex.radius*0.4*p+6,0,Math.PI*2);
        ctx.fillStyle=`rgba(255,255,255,${fp*0.6})`; ctx.fill();
      }
      ctx.shadowColor=`rgb(${strokeRGB})`; ctx.shadowBlur=18*(1-p);
      ctx.beginPath(); ctx.arc(ex.x,ex.y,ex.radius*p,0,Math.PI*2);
      ctx.fillStyle=`rgba(${fillRGB},${(1-p)*0.22})`; ctx.fill();
      ctx.strokeStyle=`rgba(${strokeRGB},${1-p})`; ctx.lineWidth=4; ctx.stroke();
      ctx.shadowBlur=0;
      if(p>0.15){
        const echoP=clamp((p-0.15)/0.85,0,1);
        ctx.beginPath(); ctx.arc(ex.x,ex.y,ex.radius*echoP*0.8,0,Math.PI*2);
        ctx.strokeStyle=`rgba(${strokeRGB},${(1-echoP)*0.4})`; ctx.lineWidth=2; ctx.stroke();
      }
      ctx.restore();
    }
    // Tornado Ball vortex zones - ambient haze + layered rotating funnel +
    // swirling debris streaks + a pulsing eye that flares into warning rays
    // right before it explodes, plus a highlight ring on whoever is captured
    for(const tor of this.tornadoes){
      const age=this.t-tor.createdAt;
      const lifeT=clamp(age/tor.life,0,1);
      const heat=clamp((age-(tor.life-0.5))/0.5,0,1); // ramps up in the final 0.5s
      ctx.save();
      // soft ambient haze filling the vortex zone, warming in color near the end
      const rr=Math.round(138+heat*(224-138)), gg=Math.round(79+heat*(86-79)), bb=Math.round(217+heat*(138-217));
      const haze=ctx.createRadialGradient(tor.x,tor.y,0,tor.x,tor.y,60);
      haze.addColorStop(0, `rgba(${rr},${gg},${bb},${(0.22+heat*0.18).toFixed(2)})`);
      haze.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
      ctx.beginPath(); ctx.arc(tor.x,tor.y,60,0,Math.PI*2);
      ctx.fillStyle=haze; ctx.fill();
      // faint outer guide showing the pull radius
      ctx.beginPath(); ctx.arc(tor.x,tor.y,tor.pullRadius,0,Math.PI*2);
      ctx.strokeStyle='rgba(138,79,217,0.14)'; ctx.lineWidth=1.5; ctx.setLineDash([4,6]);
      ctx.stroke(); ctx.setLineDash([]);
      // rotating funnel: squashed ellipses at shrinking radii, giving the
      // impression of looking down into a spinning vortex
      const layers=[
        {r:52, ry:0.85, speed:5.5,  op:0.5,  dash:[9,7]},
        {r:40, ry:0.78, speed:-8.0, op:0.65, dash:[8,5]},
        {r:28, ry:0.7,  speed:10.5, op:0.75, dash:[6,4]},
        {r:17, ry:0.6,  speed:-14,  op:0.85, dash:[4,3]},
      ];
      for(const L of layers){
        ctx.beginPath();
        ctx.setLineDash(L.dash);
        ctx.ellipse(tor.x,tor.y,L.r,L.r*L.ry,0,this.t*L.speed,this.t*L.speed+Math.PI*1.5);
        ctx.strokeStyle=`rgba(${rr},${gg},${bb},${L.op})`;
        ctx.lineWidth=3;
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // swirling debris as short streaks (reads as "windy" better than plain dots)
      for(let i=0;i<8;i++){
        const dAng=this.t*7+i*(Math.PI*2/8);
        const dR=12+((i*11+this.t*46)%54);
        const dx=tor.x+Math.cos(dAng)*dR, dy=tor.y+Math.sin(dAng)*dR*0.8;
        const tailAng=dAng+Math.PI/2;
        ctx.beginPath();
        ctx.moveTo(dx-Math.cos(tailAng)*4, dy-Math.sin(tailAng)*4);
        ctx.lineTo(dx+Math.cos(tailAng)*4, dy+Math.sin(tailAng)*4);
        ctx.strokeStyle='rgba(220,200,255,0.75)'; ctx.lineWidth=2; ctx.stroke();
      }
      // eye of the storm - pulses brighter/hotter as the explosion nears
      const pulse=0.5+0.5*Math.sin(this.t*10);
      ctx.beginPath(); ctx.arc(tor.x,tor.y,6+pulse*3+heat*4,0,Math.PI*2);
      ctx.fillStyle=`rgba(224,86,138,${(0.5+lifeT*0.5).toFixed(2)})`; ctx.fill();
      // warning flicker rays flaring out in the final half-second
      if(heat>0){
        const flicker=Math.random()<0.3?1:0.4;
        for(let i=0;i<5;i++){
          const rAng=i*(Math.PI*2/5)+this.t*3;
          ctx.beginPath();
          ctx.moveTo(tor.x,tor.y);
          ctx.lineTo(tor.x+Math.cos(rAng)*(14+heat*22), tor.y+Math.sin(rAng)*(14+heat*22));
          ctx.strokeStyle=`rgba(255,220,240,${(heat*0.5*flicker).toFixed(2)})`; ctx.lineWidth=1.5; ctx.stroke();
        }
      }
      ctx.restore();
      // highlight ring around whoever is currently captured/spinning inside
      if(tor.captured){
        const target=this.opponentOf(tor.owner);
        if(target && target.alive){
          const cpulse=0.5+0.5*Math.sin(this.t*14);
          ctx.beginPath(); ctx.arc(target.x,target.y,target.radius+8+cpulse*2,0,Math.PI*2);
          ctx.strokeStyle='rgba(224,86,138,0.85)'; ctx.lineWidth=2.5; ctx.stroke();
        }
      }
    }
    // Cell Ball clones (independent, flying/bouncing like a normal ball)
    for(const c of this.cellClones){
      ctx.save();
      ctx.shadowColor='#8dff7a'; ctx.shadowBlur=10;
      const g=ctx.createRadialGradient(c.x-c.r*0.3,c.y-c.r*0.3,c.r*0.1,c.x,c.y,c.r);
      g.addColorStop(0,'#c8ffbe'); g.addColorStop(1,'#8dff7a');
      ctx.beginPath(); ctx.arc(c.x,c.y,c.r,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
      ctx.shadowBlur=0;
      ctx.lineWidth=1.5; ctx.strokeStyle='#1a1a1a'; ctx.stroke();
      ctx.font=(c.r*0.9)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🦠', c.x, c.y);
      ctx.restore();
    }
    // AI "thinking" indicator - a pulsing ring + bobbing robot icon while it
    // decides its shot, so its turn doesn't feel like a silent dead pause
    if(this.phase==='aim2' && this.vsAI && !this.dragging){
      const ball=this.balls[1];
      const pulse=0.5+0.5*Math.sin(this.t*7);
      ctx.save();
      ctx.shadowColor='#3d6fd9'; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.radius+12+pulse*4,0,Math.PI*2);
      ctx.strokeStyle=`rgba(61,111,217,${0.35+pulse*0.35})`; ctx.lineWidth=2.5; ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.font='22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🤖', ball.x, ball.y-ball.radius-22-Math.sin(this.t*5)*3);
      ctx.restore();
    }
    // aim trajectory preview — glowing gradient shot line + arrowhead. No
    // more "power ring" here: speed is fixed per ball now, so how far you
    // pull only sets the direction/preview length, never how hard it launches.
    if(this.dragging){
      const activeBall = this.phase==='aim1'? this.balls[0]: this.balls[1];
      const turnCol = this.phase==='aim1' ? '#d94f4f' : '#3d6fd9';
      const dx=this.dragStart.x-this.dragCurrent.x;
      const dy=this.dragStart.y-this.dragCurrent.y;
      const aimLen=1.4;
      const ex=activeBall.x+dx*aimLen, ey=activeBall.y+dy*aimLen;

      ctx.save();
      // plain static aim ring around the ball - just marks "you're aiming",
      // doesn't fill/charge since pull strength no longer does anything
      ctx.beginPath(); ctx.arc(activeBall.x,activeBall.y,activeBall.radius+14,0,Math.PI*2);
      ctx.shadowColor=turnCol; ctx.shadowBlur=8;
      ctx.strokeStyle=rgba(turnCol,0.55); ctx.lineWidth=3; ctx.stroke();
      ctx.shadowBlur=0;

      // dashed predicted-path line with a marching-ants animation
      const lineGrad=ctx.createLinearGradient(activeBall.x,activeBall.y,ex,ey);
      lineGrad.addColorStop(0,rgba(turnCol,0.9));
      lineGrad.addColorStop(1,rgba(turnCol,0.15));
      ctx.setLineDash([9,7]); ctx.lineDashOffset=-this.t*40;
      ctx.strokeStyle=lineGrad; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(activeBall.x,activeBall.y); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.setLineDash([]);

      // arrowhead at the tip of the predicted path
      const ang=Math.atan2(ey-activeBall.y,ex-activeBall.x);
      ctx.translate(ex,ey); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-12,-6); ctx.lineTo(-12,6); ctx.closePath();
      ctx.fillStyle=turnCol; ctx.fill();
      ctx.restore();

      // drag handle line to cursor - subtle, secondary
      ctx.beginPath();
      ctx.strokeStyle='rgba(201,138,47,0.8)'; ctx.lineWidth=2;
      ctx.moveTo(activeBall.x,activeBall.y);
      ctx.lineTo(this.dragCurrent.x,this.dragCurrent.y);
      ctx.stroke();
    }

    // balls - own body shape per type, now with a soft grounded shadow, a
    // subtle 3D-ish sheen gradient, a colored rim glow, a low-HP warning
    // pulse, a speed trail, and a hit-flash/pop reaction — all while keeping
    // each type's own flat silhouette, border and icon intact.
    for(const ball of this.balls){
      if(!ball.alive) continue;
      const lowHp = ball.hp/ball.maxHp < 0.25;

      // motion trail: a few fading ghost silhouettes behind fast-moving balls
      const spd=Math.hypot(ball.vx,ball.vy);
      ball.state.trail=ball.state.trail||[];
      if(this.phase==='sim' && spd>60){
        ball.state.trail.unshift({x:ball.x,y:ball.y});
        if(ball.state.trail.length>5) ball.state.trail.length=5;
      } else if(ball.state.trail.length){ ball.state.trail.pop(); }
      for(let i=ball.state.trail.length-1;i>=0;i--){
        const a=(1-i/(ball.state.trail.length+1))*0.14;
        ctx.save(); ctx.globalAlpha=a;
        drawFlatShape(ctx,ball.def.shape,ball.state.trail[i].x,ball.state.trail[i].y,ball.radius*(0.94-i*0.03));
        ctx.fillStyle=ball.bodyColorOverride||ball.def.color||ball.color; ctx.fill();
        ctx.restore();
      }

      // hit-pop squash/stretch scale, decaying quickly back to 1
      const popAge=this.t-(ball.state.hitPopAt||-99);
      const pop = popAge<0.16 ? 1+ (1-popAge/0.16)*0.16 : 1;

      ctx.save();
      // grounded soft shadow
      ctx.beginPath();
      ctx.ellipse(ball.x, ball.y+ball.radius*0.72, ball.radius*0.8, ball.radius*0.28, 0, 0, Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.14)'; ctx.fill();

      ctx.translate(ball.x,ball.y); ctx.scale(pop,pop); ctx.translate(-ball.x,-ball.y);

      // colored rim glow behind the body (player color, so it doubles as an
      // owner cue) - stronger if low HP / just hit
      const flashT=clamp((ball.state.flashUntil||0)-this.t,0,0.14)/0.14;
      const glowStrength = 14 + (lowHp?10*(0.6+0.4*Math.sin(this.t*8)):0) + flashT*14;
      ctx.shadowColor= lowHp? '#ff3b3b' : ball.color;
      ctx.shadowBlur=glowStrength;

      // sheen gradient body fill, in the BALL TYPE's own accent color (each
      // of the 32 balls has its own `color` - this is what makes them look
      // distinct from each other even before you read the icon)
      // bodyColorOverride lets a ball type recolor its own instance at
      // runtime (e.g. Werewolf Ball's human/wolf forms) without mutating
      // the shared `def` object that every instance of that type points to
      const bodyColor=ball.bodyColorOverride||ball.def.color||ball.color;
      // bodyAlphaOverride mirrors bodyColorOverride: lets a ball type fade
      // its own solid body mid-ability (e.g. Leaf Ball dissolving into a
      // leaf swirl) without touching the shared `def`.
      ctx.globalAlpha = ball.bodyAlphaOverride!=null ? ball.bodyAlphaOverride : 1;
      drawFlatShape(ctx,ball.def.shape,ball.x,ball.y,ball.radius);
      const grad=ctx.createRadialGradient(
        ball.x-ball.radius*0.35, ball.y-ball.radius*0.4, ball.radius*0.15,
        ball.x, ball.y, ball.radius*1.05
      );
      grad.addColorStop(0, lighten(bodyColor,0.55));
      grad.addColorStop(0.55, bodyColor);
      grad.addColorStop(1, darken(bodyColor,0.18));
      ctx.fillStyle=grad;
      ctx.fill();
      ctx.shadowBlur=0;
      // the outline ring is the PLAYER's color (red P1 / blue P2) - lets you
      // tell whose ball is whose at a glance even if both picked the same type
      ctx.lineWidth=3.5; ctx.strokeStyle=ball.color; ctx.stroke();
      ctx.lineWidth=1; ctx.strokeStyle='rgba(26,26,26,0.55)'; ctx.stroke();

      // hit-flash: a bright white wash over the body that fades out fast
      if(flashT>0){
        drawFlatShape(ctx,ball.def.shape,ball.x,ball.y,ball.radius);
        ctx.fillStyle=`rgba(255,255,255,${flashT*0.75})`; ctx.fill();
      }
      ctx.restore();

      ctx.font=(ball.radius*0.85)+'px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.save();
      ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=3; ctx.shadowOffsetY=1;
      ctx.fillText(ball.def.icon, ball.x, ball.y+1);
      ctx.restore();

      // low-HP warning ring, pulsing outward
      if(lowHp){
        const pr=0.5+0.5*Math.sin(this.t*8);
        ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.radius+6+pr*3,0,Math.PI*2);
        ctx.strokeStyle=`rgba(255,59,59,${0.35+pr*0.35})`; ctx.lineWidth=2; ctx.stroke();
      }

      // time-frozen overlay: generic to ANY ball type (opponent caught by
      // Clock Ball's time-stop) - icy-cyan desaturating wash + a stopped
      // clock-hand glyph, independent of that ball's own renderExtra so it
      // reads the same no matter which ball got frozen.
      if(this.t < (ball.state.clockFrozenUntil||0)){
        ctx.save();
        ctx.globalAlpha=0.45;
        ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.radius,0,Math.PI*2);
        ctx.fillStyle='rgba(125,211,252,0.35)'; ctx.fill();
        ctx.globalAlpha=0.9;
        ctx.strokeStyle='#7dd3fc'; ctx.lineWidth=2; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.radius+5,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Potion Ball status icons - generic to ANY ball type that got hit by
      // a thrown potion (or, for the health icon, the thrower buffing
      // itself). No text label per the design - just small icon chips above
      // the ball, freely overlapping when several effects stack at once.
      {
        const potionIcons=[];
        if(this.t<(ball.state.potionBurnUntil||0)) potionIcons.push({icon:'🔥',color:'#ff8a3d'});
        if(this.t<(ball.state.potionToxicUntil||0)) potionIcons.push({icon:'☠️',color:'#7CFF3A'});
        if(this.t<(ball.state.potionFrozenUntil||0)) potionIcons.push({icon:'❄️',color:'#8fdcff'});
        if(this.t<(ball.state.potionShockUntil||0)) potionIcons.push({icon:'⚡',color:'#fff36a'});
        if(this.t<(ball.state.potionHealthUntil||0)) potionIcons.push({icon:'💚',color:'#7CFF9A'});
        if(potionIcons.length){
          const iconR=9, spacing=12;
          const totalW=(potionIcons.length-1)*spacing;
          const baseY=ball.y-ball.radius-16;
          potionIcons.forEach((pi,idx)=>{
            const ix=ball.x-totalW/2+idx*spacing;
            ctx.save();
            ctx.shadowColor=pi.color; ctx.shadowBlur=6;
            ctx.beginPath(); ctx.arc(ix,baseY,iconR,0,Math.PI*2);
            ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
            ctx.lineWidth=1; ctx.strokeStyle=pi.color; ctx.stroke();
            ctx.shadowBlur=0;
            ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(pi.icon,ix,baseY+1);
            ctx.restore();
          });
        }
      }

      // per-ball custom visuals (orbit blades, tail, aura ring, shield, minion...)
      if(ball.def.renderExtra) ball.def.renderExtra(ball,this,ctx);
    }


    // particles — spark / glow / dust flavors, glowing, with drift+gravity
    for(const p of this.particles){
      const a=clamp((p.until-this.t)/((p.until-p.born)||0.4),0,1);
      p.x += (p.vx||0)*dt; p.y += (p.vy||0)*dt;
      if(p.gravity) p.vy += p.gravity*dt;
      ctx.save();
      if(p.type==='glow'){
        ctx.shadowColor=p.color; ctx.shadowBlur=10;
        ctx.globalAlpha=a*0.8;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(0.6+0.4*a),0,Math.PI*2);
        ctx.fillStyle=p.color; ctx.fill();
      } else if(p.type==='dust'){
        ctx.globalAlpha=a*0.7;
        ctx.fillStyle=p.color;
        ctx.fillRect(p.x-p.r*0.5,p.y-p.r*0.5,p.r,p.r);
      } else if(p.type==='confetti'){
        p.rot=(p.rot||0)+(p.rotSpeed||0)*dt;
        ctx.globalAlpha=a;
        ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle=p.color;
        ctx.fillRect(-p.r*0.5,-p.r*0.3,p.r,p.r*0.6);
      } else {
        ctx.shadowColor=p.color; ctx.shadowBlur=6;
        ctx.globalAlpha=a;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*a,0,Math.PI*2);
        ctx.fillStyle=p.color; ctx.fill();
      }
      ctx.restore();
    }
    // float texts — pop-in scale, gentle upward drift + horizontal wander,
    // soft outline for legibility, colored glow
    ctx.textAlign='center';
    for(const f of this.floatTexts){
      const age=this.t-f.born;
      const dur=f.until-f.born;
      const progress=clamp(age/dur,0,1);
      const scale = age<0.12 ? easeOutBack(age/0.12) : 1;
      ctx.save();
      ctx.globalAlpha=clamp(1-Math.max(0,progress-0.55)/0.45,0,1);
      const fx=f.x+(f.drift||0)*progress, fy=f.y-progress*32;
      ctx.translate(fx,fy); ctx.scale(scale,scale);
      ctx.font='800 16px sans-serif';
      ctx.lineJoin='round';
      ctx.lineWidth=3.5; ctx.strokeStyle='rgba(255,255,255,0.85)';
      ctx.strokeText(f.text,0,0);
      ctx.shadowColor=f.color; ctx.shadowBlur=6;
      ctx.fillStyle=f.color;
      ctx.fillText(f.text,0,0);
      ctx.restore();
    }
    ctx.restore(); // matches the shake-transform save() at the top of render()
  }
}
