class Ball{
  constructor(typeId, player, x, y, colorHue, returnStacks){
    const def=BALL_TYPES.find(b=>b.id===typeId);
    this.def=def;
    this.type=typeId;
    this.player=player;
    this.x=x; this.y=y;
    this.vx=0; this.vy=0;
    this.maxHp=def.hp*1.6;
    this.hp=this.maxHp;
    this.dmg=def.dmg;
    this.baseSpeed=def.speed;
    // The ball's own constant speed. Set once at launch, and only ever
    // reassigned by a deliberate speed/CC ability afterwards (see lockSpeed()).
    // Every other physics step (bounces, jitter, collisions) gets snapped
    // back to this value via enforceSpeedLock() so speed can never drift.
    this.speedLock=0;
    this.radius=(18+def.hp*0.05)*(def.radiusMult||1);
    this.mass=(def.massMult||1)*Math.max(0.6,this.radius/22);
    this.color=colorHue;
    this.state={};
    this.alive=true;
    this.stuckTimer=0;
    this.chosenAngle=0;
    // Return by Death stacks for this match (owned by main.js' returnDeathRuns,
    // NOT by the Ball - a fresh Ball is built every match). Read by def.init.
    this.returnStacks=returnStacks||0;
    if(def.init) def.init(this);
  }
  currentMods(g){
    let speedMult=1, dmgMult=1, speedAdd=0;
    if(this.def.getMods && powerOk(this,g)){
      const m=this.def.getMods(this,g);
      if(m.speedMult) speedMult*=m.speedMult;
      if(m.dmgMult) dmgMult*=m.dmgMult;
      if(m.speedAdd) speedAdd+=m.speedAdd;
    }
    return {speedMult,dmgMult,speedAdd};
  }
}
