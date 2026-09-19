const GROUP_META = {
  dps:    {label:"Nhóm DPS (Sát Thương Bền Bỉ)", color:"#3d8fd9"},
  burst:  {label:"Nhóm Burst DMG (Sát Thương Bùng Nổ)", color:"#d94f4f"},
  control:{label:"Nhóm Control (Khống Chế)", color:"#8a4fd9"},
  special:{label:"Nhóm Special (Đặc Biệt)", color:"#c98a2f"},
};

/* ---------------------------- BALL DEFINITIONS --------------------------- */
// shared by Potion Ball's normal (rolled) throw and its auto-throw at a full
// energy bar - picks `count` unique potion types at random and applies each
// one (burn/toxic/frozen/shock land on `other`, health self-buffs `b`),
// then resets the energy bar and plays a shared throw VFX.
function throwPotions(b,other,g,count){
  const pool=['burn','health','toxic','frozen','shock'];
  for(let i=pool.length-1;i>0;i--){ const j=randi(0,i); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  const chosen=pool.slice(0,count);
  for(const type of chosen){
    if(type==='burn') other.state.potionBurnUntil=g.t+1;
    else if(type==='toxic') other.state.potionToxicUntil=g.t+1;
    else if(type==='frozen') other.state.potionFrozenUntil=g.t+1;
    else if(type==='shock') other.state.potionShockUntil=g.t+1;
    else if(type==='health') b.state.potionHealthUntil=g.t+1;
  }
  g.spawnExplosionRing(b.x,b.y,b.radius+18,'62,207,158','185,255,225');
  spawnParticles(g,(b.x+other.x)/2,(b.y+other.y)/2,4+count*3,{color:'#3ecf9e',type:'glow',speed:150});
  b.state.potionEnergy=0;
}
// shared by Leaf Ball's two trigger paths (onBallCollide + the 3s auto-timer)
function startLeafScatter(b,g){
  const R=b.radius;
  b.state.leafPhase='scatter';
  b.state.leafTimer=0;
  b.state.leafDropCD=0;
  b.state.leafTarget={
    x:clamp(Math.random()*g.w, R+20, g.w-R-20),
    y:clamp(Math.random()*g.h, R+20, g.h-R-20)
  };
  b.bodyAlphaOverride=0.32;
  spawnFloatText(g,b.x,b.y-30,'🍃 PHÂN TÁN!','#6fbf3f');
  spawnParticles(g,b.x,b.y,16,{color:'#6fbf3f',type:'dust',speed:150,life:0.5});
}
const BALL_TYPES = [
// ==================== 💥 NHÓM TẤN CÔNG (COMBAT) ====================
{id:'blade', name:'Blade Ball', group:'dps', icon:'🗡️', hp:75, speed:100, dmg:10, color:'#c9c9d6',
 descSimple:'Xoay lưỡi dao quanh thân, số dao tăng dần theo thời gian sống, gây sát thương khi địch đến gần.',
 desc:'Lưỡi dao quay quanh thân với phạm vi rộng. Bắt đầu trận với sẵn 1 lưỡi dao, số lượng tăng dần theo thời gian sống (tối đa 5), gây sát thương liên tục khi địch áp sát.',
 init:(b)=>{ b.state.blades=1; b.state.bladeTimer=0; },
 update:(b,dt,g)=>{
   b.state.bladeTimer+=dt;
   if(b.state.bladeTimer>4 && b.state.blades<5){ b.state.blades++; b.state.bladeTimer=0; }
   const other=g.opponentOf(b);
   const bladeRange=b.radius+70;
   if(other && b.state.blades>0 && dist(b.x,b.y,other.x,other.y)<bladeRange){
     if(g.t-(b.state.bladeTickCD||0)>0.4){
       b.state.bladeTickCD=g.t;
       const dmg=dmgFor(b,4)*b.state.blades*0.5;
       other.hp=Math.max(0,other.hp-dmg);
       spawnFloatText(g,other.x,other.y-30,'-'+dmg.toFixed(0),'#ffe066');
     }
   }
 },
 renderExtra:(b,g,ctx)=>{
   const n=b.state.blades||0;
   const orbitR=b.radius+40;
   for(let i=0;i<n;i++){
     const ang=g.t*3+(i/n)*Math.PI*2;
     const bx=b.x+Math.cos(ang)*orbitR, by=b.y+Math.sin(ang)*orbitR;
     ctx.save(); ctx.translate(bx,by); ctx.rotate(ang+Math.PI/2);
     ctx.fillStyle='#c98a2f';
     ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(5,7); ctx.lineTo(-5,7); ctx.closePath();
     ctx.fill(); ctx.lineWidth=1; ctx.strokeStyle='#1a1a1a'; ctx.stroke();
     ctx.restore();
   }
 }},
{id:'machinegun', name:'Machine Gun Ball', group:'dps', icon:'🔫', hp:70, speed:145, dmg:4, color:'#5b7285',
 descSimple:'Tự động bắn liên tục đạn nhỏ về phía đối thủ, gây áp lực dồn dập không ngừng.',
 desc:'Tự động xả liên tục các viên đạn nhỏ về phía quả bóng đối thủ, dồn ép không cho kịp phản ứng.',
 init:(b)=>{ b.state.fireCD=0; },
 update:(b,dt,g)=>{
   if(g.t-(b.state.fireCD||0)>0.18){
     b.state.fireCD=g.t;
     const other=g.opponentOf(b);
     if(other){
       const ang=Math.atan2(other.y-b.y,other.x-b.x);
       fireProjectile(g,b,{x:b.x,y:b.y,vx:Math.cos(ang)*420,vy:Math.sin(ang)*420,r:4,dmg:dmgFor(b,4),life:1.2,color:'#ffd166',shape:'bullet'});
     }
   }
 }},
{id:'axe', name:'Axe Ball', group:'burst', icon:'🪓', hp:110, speed:75, dmg:14, color:'#8a5a2b',
 descSimple:'Vung rìu lớn xoay quanh thân; càng ít máu, rìu quay càng nhanh và mạnh hơn.',
 desc:'Vung rìu lớn xoay tròn quanh thân. Khi máu dưới 40%, tốc độ quay và sát thương tăng thêm 50%.',
 getMods:(b)=>{ const low=b.hp/b.maxHp<0.4; return low?{speedMult:1.5,dmgMult:1.5}:{speedMult:1,dmgMult:1}; },
 renderExtra:(b,g,ctx)=>{
   const low=b.hp/b.maxHp<0.4;
   const ang=g.t*(low?9:6);
   const orbitR=b.radius+26;
   ctx.save();
   ctx.shadowColor= low? '#ff6a3d' : '#c98a2f'; ctx.shadowBlur=low?16:8;
   // ghost trail of the axe's swing arc so it reads as a fast spinning blade
   for(let k=5;k>=1;k--){
     const trailAng=ang-k*0.14;
     const tx=b.x+Math.cos(trailAng)*orbitR, ty=b.y+Math.sin(trailAng)*orbitR;
     ctx.save();
     ctx.globalAlpha=(1-k/6)*0.35;
     ctx.translate(tx,ty); ctx.rotate(trailAng+Math.PI/2);
     ctx.font='30px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
     ctx.fillText('🪓', 0, 0);
     ctx.restore();
   }
   const ax=b.x+Math.cos(ang)*orbitR, ay=b.y+Math.sin(ang)*orbitR;
   ctx.translate(ax,ay); ctx.rotate(ang+Math.PI/2);
   ctx.font=(low?44:40)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
   ctx.fillText('🪓', 0, 0);
   ctx.restore();
 }},
{id:'thief', name:'Thief Ball', group:'dps', icon:'🔪', hp:80, speed:120, dmg:8, color:'#4a4a52',
 descSimple:'Càng mất máu càng tích được nhiều dao; sau một nhịp tích lực ngắn sẽ phóng toàn bộ dao về phía đối thủ.',
 desc:'Tích lũy dao: cứ mất 15% HP thì thêm 1 con dao. Trước khi phóng sẽ có một nhịp tích lực ngắn (dao xoay quanh thân, nhanh dần), sau đó phóng toàn bộ số dao đang tích lũy về phía đối thủ.',
 init:(b)=>{ b.state.throwCD=-99; b.state.knives=1; b.state.windingUp=false; b.state.windupStart=0; b.state.windupUntil=0; },
 update:(b,dt,g)=>{
   const missing=1-(b.hp/b.maxHp);
   b.state.knives=1+Math.min(9,Math.floor(missing/0.15));
   const COOLDOWN=2.4, WINDUP=0.5;
   if(!b.state.windingUp){
     if(g.t-(b.state.throwCD||-99)>COOLDOWN){
       b.state.windingUp=true;
       b.state.windupStart=g.t;
       b.state.windupUntil=g.t+WINDUP;
     }
   } else if(g.t>=b.state.windupUntil){
     b.state.windingUp=false;
     b.state.throwCD=g.t;
     const other=g.opponentOf(b);
     if(other){
       const baseAng=Math.atan2(other.y-b.y,other.x-b.x);
       const n=b.state.knives;
       for(let i=0;i<n;i++){
         const spread=(i-(n-1)/2)*0.09;
         const ang=baseAng+spread;
         fireProjectile(g,b,{x:b.x,y:b.y,vx:Math.cos(ang)*380,vy:Math.sin(ang)*380,r:5,dmg:dmgFor(b,7),life:1.5,color:'#c8c8d8',shape:'knife'});
       }
       spawnParticles(g,b.x,b.y,10);
     }
   }
 },
 renderExtra:(b,g,ctx)=>{
   if(!b.state.windingUp) return;
   const progress=clamp((g.t-b.state.windupStart)/0.5,0,1);
   const n=b.state.knives;
   const orbitR=b.radius+34-progress*14; // knives draw inward as the throw nears
   const spin=g.t*(6+progress*14); // spin speeds up right before release
   ctx.save();
   ctx.shadowColor='#c8c8d6'; ctx.shadowBlur=10+progress*10;
   for(let i=0;i<n;i++){
     const ang=spin+(i/n)*Math.PI*2;
     const kx=b.x+Math.cos(ang)*orbitR, ky=b.y+Math.sin(ang)*orbitR;
     ctx.save();
     ctx.translate(kx,ky); ctx.rotate(ang+Math.PI/2);
     ctx.font=(20+progress*6)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
     ctx.globalAlpha=0.7+progress*0.3;
     ctx.fillText('🔪',0,0);
     ctx.restore();
   }
   ctx.restore();
   // charge glow that brightens as the throw approaches - thick, glowing ring
   ctx.save();
   ctx.shadowColor='#8a8a96'; ctx.shadowBlur=6+progress*14;
   ctx.beginPath(); ctx.arc(b.x,b.y,b.radius+10,0,Math.PI*2);
   ctx.strokeStyle=`rgba(74,74,82,${0.35+progress*0.6})`; ctx.lineWidth=3+progress*3; ctx.stroke();
   ctx.restore();
 }},
{id:'bow', name:'Bow Ball', group:'burst', icon:'🏹', hp:90, speed:100, dmg:9, color:'#7a5230',
 descSimple:'Định kỳ bắn ra mũi tên năng lượng mạnh, có thể nảy qua tường; thiên về đánh xa hơn cận chiến.',
 desc:'Tụ lực rồi phóng mũi tên năng lượng lớn, sát thương cao, bắn nhanh hơn, nảy tường dồn sát thương. Sát thương khi va chạm trực tiếp với đối thủ giảm đi (chuyên bắn xa hơn cận chiến).',
 init:(b)=>{ b.state.lastFire=-99; b.state.drawing=false; b.state.drawStart=0; },
 update:(b,dt,g)=>{
   const CYCLE=1.5, DRAW=0.35;
   if(!b.state.drawing && g.t-(b.state.lastFire||-99)>CYCLE-DRAW){
     b.state.drawing=true;
     b.state.drawStart=g.t;
   }
   if(b.state.drawing && g.t-b.state.drawStart>=DRAW){
     b.state.drawing=false;
     b.state.lastFire=g.t;
     const other=g.opponentOf(b);
     if(other){
       const ang=Math.atan2(other.y-b.y,other.x-b.x);
       fireProjectile(g,b,{x:b.x,y:b.y,vx:Math.cos(ang)*380,vy:Math.sin(ang)*380,r:10,dmg:dmgFor(b,13),life:3,bouncesLeft:2,growPerBounce:0.25,color:'#9dffb0',shape:'arrow'});
       spawnParticles(g,b.x,b.y,6);
     }
   }
 },
 modifyOutgoing:(b,other,dmg,g,kind)=>{ return kind==='collision'? dmg*0.5 : dmg; },
 renderExtra:(b,g,ctx)=>{
   if(!b.state.drawing) return;
   const t=clamp((g.t-b.state.drawStart)/0.35,0,1);
   const other=g.opponentOf(b);
   if(other) b.state.lastAim=Math.atan2(other.y-b.y,other.x-b.x);
   const aimAng=b.state.lastAim||0;
   ctx.save();
   ctx.translate(b.x,b.y); ctx.rotate(aimAng);
   const R=b.radius+15;
   const tip1={x:-R*0.25,y:-R*0.85}, tip2={x:-R*0.25,y:R*0.85};
   const belly={x:-R*1.1,y:0};
   // bow limbs
   ctx.beginPath();
   ctx.moveTo(tip1.x,tip1.y);
   ctx.quadraticCurveTo(belly.x,belly.y,tip2.x,tip2.y);
   ctx.strokeStyle='#7a5230'; ctx.lineWidth=3.5; ctx.lineCap='round'; ctx.stroke();
   // string, pulled back further as the draw progresses
   const nockX=-R*0.25-t*R*0.75;
   ctx.beginPath();
   ctx.moveTo(tip1.x,tip1.y);
   ctx.lineTo(nockX,0);
   ctx.lineTo(tip2.x,tip2.y);
   ctx.strokeStyle='#e8d8b0'; ctx.lineWidth=1.6; ctx.stroke();
   // nocked arrow: shaft + head, sitting on the string, pointing at the target
   ctx.beginPath();
   ctx.moveTo(nockX,0); ctx.lineTo(R*0.9,0);
   ctx.strokeStyle='#9dffb0'; ctx.lineWidth=2; ctx.stroke();
   ctx.beginPath();
   ctx.moveTo(R*0.9,0); ctx.lineTo(R*0.62,-5); ctx.lineTo(R*0.62,5); ctx.closePath();
   ctx.fillStyle='#9dffb0'; ctx.fill();
   // charge glow that brightens right before release
   ctx.beginPath(); ctx.arc(0,0,b.radius+6,0,Math.PI*2);
   ctx.strokeStyle=`rgba(157,255,176,${(0.2+t*0.6).toFixed(2)})`; ctx.lineWidth=2; ctx.stroke();
   ctx.restore();
 }},
{id:'charge', name:'Charge Ball', group:'burst', icon:'🔋', hp:95, speed:85, dmg:8, color:'#f0c419',
 descSimple:'Tích năng lượng khi không va chạm; đủ 2.5s thì cú chạm tới hất văng đối thủ, đập tường sẽ choáng và mất thêm máu.',
 desc:'Tích năng lượng khi không va chạm. Chỉ khi tích đủ 2.5 giây, va chạm tiếp theo mới giải phóng năng lượng khiến đối thủ lập tức bị đánh bật ra ngoài; nếu đối thủ va vào tường sau đó sẽ chịu 10 sát thương cố định, tạo hiệu ứng nổ đất và bị choáng 0.3 giây. Va chạm khi chưa tích đủ sẽ không có hiệu ứng gì và làm mất năng lượng đang tích.',
 init:(b)=>{ b.state.charge=0; },
 update:(b,dt,g)=>{ b.state.charge=Math.min(3,(b.state.charge||0)+dt); },
 onBallCollide:(b,other,g)=>{
   const charge=b.state.charge||0;
   if(charge>=2.5){
     const ratio=Math.min(1,charge/3);
     const ang=Math.atan2(other.y-b.y,other.x-b.x);
     const force=180+ratio*300; // instant, clean launch — not a small additive nudge
     if(applyKnockback(other,ang,force,false)){
       // nerfed payload: only 1 wall impact, fixed damage (no more scaling burst multiplier)
       other.state.chargeWallHitsLeft=1;
       other.state.chargeWallDmg=10;
       other.state.chargeWallStun=0.3;
       spawnFloatText(g,b.x,b.y-40,'GIẢI PHÓNG!','#ffd166');
     }
   }
   b.state.charge=0;
 },
 renderExtra:(b,g,ctx)=>{
   if((b.state.charge||0)>=2.5){
     const pulse=1+Math.sin(g.t*10)*0.12;
     ctx.beginPath(); ctx.arc(b.x,b.y,(b.radius+8)*pulse,0,Math.PI*2);
     ctx.strokeStyle='rgba(255,209,102,0.85)'; ctx.lineWidth=3; ctx.stroke();
   }
 }},
{id:'burst', name:'Burst Ball', group:'burst', icon:'💥', hp:85, speed:120, dmg:10, color:'#ff7a3d',
 descSimple:'Định kỳ thực hiện một cú lướt nhanh đổi hướng; va chạm ngay sau cú lướt sẽ gây sát thương mạnh hơn hẳn.',
 desc:'Định kỳ kích hoạt cú lướt ngắn đổi hướng, tăng gấp đôi sát thương ở lần va chạm đầu tiên sau khi lướt.',
 init:(b)=>{ b.state.dashCD=0; b.state.buffUntil=0; },
 update:(b,dt,g)=>{
   if(g.t-(b.state.dashCD||0)>4){
     b.state.dashCD=g.t;
     const ang=Math.atan2(b.vy,b.vx)+rand(-0.4,0.4);
     b.vx+=Math.cos(ang)*140; b.vy+=Math.sin(ang)*140;
     clampBallSpeed(b);
     lockSpeed(b, Math.hypot(b.vx,b.vy));
     b.state.buffUntil=g.t+1.2;
     spawnParticles(g,b.x,b.y,10);
   }
 },
 modifyOutgoing:(b,other,dmg,g)=>{ if(g.t<b.state.buffUntil){ b.state.buffUntil=0; return dmg*2; } return dmg; },
 renderExtra:(b,g,ctx)=>{
   if(g.t>=(b.state.buffUntil||0)) return;
   drawFireAura(ctx,b,g,1);
 }},

// ==================== 🧪 NHÓM HIỆU ỨNG & KHỐNG CHẾ (CC) ====================
{id:'poisonspike', name:'Poison Spike Ball', group:'control', icon:'☣️', hp:95, speed:100, dmg:5, color:'#5fa83d',
 descSimple:'Để lại gai độc mỗi khi va tường; đối thủ chạm phải sẽ bị nhiễm độc và chậm lại.',
 desc:'Va đập vào tường để lại một chiếc gai độc nhỏ. Kẻ địch chạm vào bị nhiễm độc 4 giây và giảm 20% tốc độ.',
 onWallHit:(b,g)=>{ spawnHazard(g,{type:'poisontrap',x:b.x,y:b.y,r:14,until:g.t+6,owner:b}); },
 renderExtra:(b,g,ctx)=>{
   const n=6;
   for(let i=0;i<n;i++){
     const ang=i*(Math.PI*2/n)+g.t*0.5;
     const x1=b.x+Math.cos(ang)*b.radius*0.9, y1=b.y+Math.sin(ang)*b.radius*0.9;
     const x2=b.x+Math.cos(ang)*(b.radius+8), y2=b.y+Math.sin(ang)*(b.radius+8);
     const perp=ang+Math.PI/2, w=3.2;
     ctx.beginPath();
     ctx.moveTo(x1+Math.cos(perp)*w, y1+Math.sin(perp)*w);
     ctx.lineTo(x2,y2);
     ctx.lineTo(x1-Math.cos(perp)*w, y1-Math.sin(perp)*w);
     ctx.closePath();
     ctx.fillStyle='#3f7a26'; ctx.fill();
     ctx.lineWidth=1; ctx.strokeStyle='#1a1a1a'; ctx.stroke();
   }
 }},
{id:'electric', name:'Electric Ball', group:'control', icon:'⚡', hp:80, speed:120, dmg:9, color:'#f4e04d',
 descSimple:'Va chạm trực tiếp gây choáng kèm sát thương điện rải đều trong lúc choáng, cần thời gian hồi giữa các lần kích hoạt.',
 desc:'Va chạm trực tiếp phóng dòng điện gây choáng 0.5 giây, đồng thời gây thêm 5 sát thương nhiễm điện mỗi 0.25 giây trong suốt thời gian choáng. Hồi chiêu 1 giây giữa các lần kích hoạt.',
 init:(b)=>{ b.state.lastShock=-99; },
 onBallCollide:(b,other,g)=>{
   if(g.t-(b.state.lastShock||-99)<1) return;
   b.state.lastShock=g.t;
   other.state.stunUntil=g.t+0.5;
   other.state.shockUntil=g.t+0.5;
   other.state.shockTick=g.t;
   spawnFloatText(g,other.x,other.y-30,'STUN!','#fff36a');
 },
 update:(b,dt,g)=>{
   const other=g.opponentOf(b);
   if(other && g.t<(other.state.shockUntil||0) && g.t-(other.state.shockTick||0)>0.25){
     other.state.shockTick=g.t;
     other.hp=Math.max(0,other.hp-5);
     spawnFloatText(g,other.x,other.y-20,'-5','#fff36a');
   }
 }},
{id:'frost', name:'Frost Ball', group:'control', icon:'🥶', hp:95, speed:100, dmg:7, color:'#8fd9e8',
 descSimple:'Để lại vệt sương giá dọc đường đi; đứng trong vệt bị chậm lại và mất máu dần, đứng đủ lâu sẽ bị đóng băng.',
 desc:'Để lại vệt sương giá dọc theo đường đi, tồn tại 3 giây. Chạm vào giảm 50% tốc độ và chịu 1 sát thương mỗi 0.5 giây; đứng trong liên tục 1.5 giây sẽ bị đóng băng và chịu thêm sát thương liên tục.',
 init:(b)=>{ b.state.lastTrail=0; },
 update:(b,dt,g)=>{
   if(g.t-(b.state.lastTrail||0)>0.15){
     b.state.lastTrail=g.t;
     spawnHazard(g,{type:'frostzone',x:b.x,y:b.y,r:34,until:g.t+3,owner:b});
   }
 }},
{id:'icecone', name:'Powerless Ball', group:'control', icon:'🚫', hp:115, speed:70, dmg:13, color:'#7a4fae',
 descSimple:'Chạm vào đối thủ sẽ tạm thời tước hết kỹ năng đặc biệt của họ, chỉ còn va chạm vật lý thuần túy.',
 desc:'Khi đụng vào đối thủ, khiến ball đó mất toàn bộ năng lực đặc biệt (kỹ năng, hiệu ứng bị động) trong 2 giây, chỉ còn va chạm vật lý thuần túy. Bản thân gây sát thương va chạm nhỉnh hơn bình thường một chút.',
 onBallCollide:(b,other,g)=>{
   other.state.powerlessUntil=g.t+2;
   spawnFloatText(g,other.x,other.y-30,'MẤT NĂNG LỰC!','#a8e8ff');
 }},
{id:'thunder', name:'Thunder Ball', group:'burst', icon:'🌩️', hp:85, speed:120, dmg:13, color:'#e8c93a',
 descSimple:'Sau một số lần va tường liên tiếp sẽ phóng một tia sét thẳng vào đối thủ gần nhất.',
 desc:'Cứ 4 lần va vào tường sẽ phóng một tia sét thẳng vào kẻ địch gần nhất, kèm hiệu ứng sét đánh, gây sát thương cố định 10.',
 init:(b)=>{ b.state.wallHitCount=0; },
 onWallHit:(b,g)=>{
   b.state.wallHitCount=(b.state.wallHitCount||0)+1;
   if(b.state.wallHitCount>=4){
     b.state.wallHitCount=0;
     const other=g.opponentOf(b);
     if(other){
       other.hp=Math.max(0,other.hp-10);
       b.state.boltUntil=g.t+0.3; b.state.boltTo={x:other.x,y:other.y};
       drawLightning(g,b,other);
       spawnFloatText(g,other.x,other.y-30,'-10','#fff36a');
     }
   }
 },
 renderExtra:(b,g,ctx)=>{
   if(g.t<(b.state.boltUntil||0) && b.state.boltTo){
     drawLightningBolt(ctx,b.x,b.y,b.state.boltTo.x,b.state.boltTo.y);
   }
 }},
{id:'snake', name:'Snake Ball', group:'dps', icon:'🐍', hp:90, speed:110, dmg:10, color:'#7fbf3f',
 descSimple:'Mọc đuôi năng lượng dài dần theo thời gian sống sót; đuôi quét trúng đối thủ sẽ gây sát thương và đẩy lùi.',
 desc:'Mọc đuôi năng lượng dài dần theo thời gian sống sót, quét trúng đối thủ gây sát thương & đẩy lùi.',
 init:(b)=>{ b.state.tail=[]; b.state.tailTimer=0; },
 update:(b,dt,g)=>{
   b.state.tailTimer+=dt;
   b.state.tail.unshift({x:b.x,y:b.y});
   const maxLen=Math.min(24,6+Math.floor(b.state.tailTimer*1.5));
   if(b.state.tail.length>maxLen) b.state.tail.length=maxLen;
   const other=g.opponentOf(b);
   if(other && g.t-(b.state.tailHitCD||0)>0.6){
     for(let i=6;i<b.state.tail.length;i+=3){
       const seg=b.state.tail[i];
       if(dist(seg.x,seg.y,other.x,other.y)<other.radius+10){
         b.state.tailHitCD=g.t;
         const dmg=dmgFor(b,6);
         other.hp=Math.max(0,other.hp-dmg);
         const ang=Math.atan2(other.y-seg.y,other.x-seg.x);
         applyKnockback(other,ang,140,true);
         spawnFloatText(g,other.x,other.y-30,'-'+dmg.toFixed(0),'#9dffb0');
         break;
       }
     }
   }
 },
 renderExtra:(b,g,ctx)=>{
   const tail=b.state.tail||[];
   if(tail.length<2) return;
   ctx.beginPath(); ctx.moveTo(tail[0].x,tail[0].y);
   for(let i=1;i<tail.length;i++) ctx.lineTo(tail[i].x,tail[i].y);
   ctx.strokeStyle='rgba(157,255,176,0.7)'; ctx.lineWidth=6; ctx.lineCap='round'; ctx.stroke();
 }},
{id:'hook', name:'Hook Ball', group:'control', icon:'🪝', hp:90, speed:100, dmg:7, color:'#c8963c',
 descSimple:'Bắn ra một chiếc móc câu; đối thủ dính móc hoặc dây sẽ bị kéo lại, choáng ngắn, và dễ tổn thương hơn trong ít giây sau đó.',
 desc:'Bắn ra một chiếc móc nối bằng dây. Đối thủ chạm vào móc hoặc dây sẽ bị kéo về phía Hook Ball (đổi quỹ đạo) và bị choáng ngắn, sau đó trong 2 giây sẽ nhận thêm x1.5 sát thương từ mọi nguồn.',
 init:(b)=>{ b.state.hookCD=0; b.state.hook=null; },
 update:(b,dt,g)=>{
   const other=g.opponentOf(b);
   if(!b.state.hook){
     if(other && g.t-(b.state.hookCD||0)>2 && dist(b.x,b.y,other.x,other.y)<340){
       b.state.hookCD=g.t;
       const ang=Math.atan2(other.y-b.y,other.x-b.x);
       b.state.hook={x:b.x,y:b.y,vx:Math.cos(ang)*480,vy:Math.sin(ang)*480,life:1.0};
     }
     return;
   }
   const hk=b.state.hook;
   hk.x+=hk.vx*dt; hk.y+=hk.vy*dt; hk.life-=dt;
   if(hk.life<=0 || hk.x<0 || hk.x>g.w || hk.y<0 || hk.y>g.h){ b.state.hook=null; return; }
   if(other){
     const distToTip=dist(hk.x,hk.y,other.x,other.y);
     const distToRope=pointSegmentDist(other.x,other.y,b.x,b.y,hk.x,hk.y);
     if(distToTip<other.radius+10 || distToRope<other.radius+7){
       const dmg=dmgFor(b,4);
       other.hp=Math.max(0,other.hp-dmg);
       spawnFloatText(g,other.x,other.y-30,'-'+dmg.toFixed(0),'#e0c080');
       // pull the hooked ball toward the hooker (changes its trajectory)
       const ang=Math.atan2(b.y-other.y,b.x-other.x);
       applyKnockback(other,ang,260,true);
       // vulnerable for 2s: takes x1.5 damage from any source after being hooked
       other.state.vulnerableUntil=g.t+2; other.state.vulnerableMult=1.5;
       // stunned briefly right after being reeled in
       other.state.stunUntil=g.t+0.6;
       spawnFloatText(g,other.x,other.y-50,'HOOKED!','#e0c080');
       b.state.hook=null;
     }
   }
 },
 renderExtra:(b,g,ctx)=>{
   const hk=b.state.hook; if(!hk) return;
   ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(hk.x,hk.y);
   ctx.strokeStyle='#e0c080'; ctx.lineWidth=3; ctx.stroke();
   ctx.save();
   ctx.translate(hk.x,hk.y); ctx.rotate(Math.atan2(hk.vy,hk.vx)+Math.PI/2);
   ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
   ctx.fillText('🪝',0,0);
   ctx.restore();
 }},
{id:'florentino', name:'Florentino Ball', group:'control', icon:'🌹', hp:105, speed:110, dmg:9, color:'#e0568a',
 descSimple:'Thỉnh thoảng lướt thẳng tới đối thủ, miễn khống chế và giảm sát thương lúc lướt. Chạm tới sẽ choáng và múa nhặt hoa, gây thêm sát thương và hồi máu.',
 desc:'Nếu đối thủ nằm trong phạm vi lướt, cứ mỗi 2 giây có 30% cơ hội lướt thẳng tới đối thủ: ngay từ lúc bắt đầu lướt (chưa cần chạm tới) đã nhận miễn nhiễm mọi khống chế (làm chậm, choáng...) lẫn hiệu ứng đẩy lùi, cùng giảm 25% sát thương nhận vào từ mọi nguồn. Khi lướt tới nơi sẽ gây choáng cho đối thủ kèm một lượng sát thương nhỏ, đồng thời tung ra 3 bông hoa chia đều quanh đối thủ (bông đầu tiên luôn nằm ở phía đối diện giữa Florentino và đối thủ, hai bông còn lại cách đều 120°). Trong suốt thời gian múa (từ lúc lướt về tâm cho tới khi nhặt xong hoặc nhặt hụt), đối thủ bị giữ đứng yên hoàn toàn, không thể di chuyển, còn Florentino vẫn tiếp tục miễn nhiễm khống chế/đẩy lùi và giảm 25% sát thương nhận vào suốt cả quá trình. Florentino liên tục lướt về tâm đối thủ rồi lướt tiếp ra từng bông theo đúng thứ tự đó, xoay kiếm múa quanh mình như điệu múa nhặt hoa của Florentino trong AoV; mỗi lần nhặt trúng một bông (50% cơ hội, 50% nhặt hụt) gây thêm một lượng sát thương lớn hơn hẳn đòn choáng ban đầu, đồng thời tự hồi 6 HP cho bản thân. Nhặt đủ cả 3 bông sẽ lặp lại: choáng đối thủ thêm lần nữa và tung ra 3 bông mới quanh đối thủ, cứ thế tiếp diễn không giới hạn. Chỉ cần nhặt hụt một bông là mất ngay mọi miễn nhiễm, thả đối thủ ra và toàn bộ chuỗi múa kết thúc, quay lại chờ cơ hội kích hoạt tiếp theo.',
 init:(b)=>{
   b.state.floPhase='idle';
   b.state.floCD=0;
   b.state.floTimer=0;
   b.state.floFlowers=[];
   b.state.floIndex=0;
   b.state.ccImmune=false;
   b.state.floTrail=[];
   b.state.floBurst=[];
   b.state.floRingBorn=undefined;
   b.state.floRingX=0; b.state.floRingY=0;
 },
 update:(b,dt,g)=>{
   const other=g.opponentOf(b);
   if(!other) return;
   // suốt lúc đang múa (từ khi lướt về tâm cho tới lúc nhặt xong/nhặt hụt),
   // đối thủ bị khoá đứng yên hoàn toàn - liên tục làm mới stun mỗi khung
   // hình để họ không kịp cựa quậy giữa các lần lướt ra hoa.
   const dancing = b.state.floPhase==='toCenter' || b.state.floPhase==='picking';
   if(dancing){
     other.state.stunUntil=g.t+0.3;
     // vệt lướt (afterimage) theo sau Florentino trong lúc múa
     b.state.floTrail.push({x:b.x,y:b.y,t:g.t});
     if(b.state.floTrail.length>10) b.state.floTrail.shift();
   } else if(b.state.floTrail.length){
     b.state.floTrail.length=0;
   }
   // cập nhật các cánh hoa bung ra lúc vừa choáng (hiệu ứng "nở hoa")
   if(b.state.floBurst.length){
     for(const p of b.state.floBurst){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.92; p.vy*=0.92; }
     b.state.floBurst=b.state.floBurst.filter(p=>g.t-p.born<0.6);
   }
   if(b.state.floPhase==='idle'){
     if(g.t-(b.state.floCD||0)>2){
       b.state.floCD=g.t;
       if(Math.random()<FLORENTINO_DASH_CHANCE && dist(b.x,b.y,other.x,other.y)<FLORENTINO_RANGE){
         b.state.floPhase='dash';
         b.state.floTimer=0;
         // miễn nhiễm mọi khống chế (chậm, choáng...) + giảm 50% sát thương
         // nhận vào ngay từ lúc bắt đầu lướt tới, không phải chờ tới lúc chạm
         b.state.ccImmune=true;
       }
     }
   } else if(b.state.floPhase==='dash'){
     // lướt thật sự về phía đối thủ (không dịch chuyển tức thời), giới hạn
     // trong phạm vi lướt của kỹ năng
     const ang=Math.atan2(other.y-b.y,other.x-b.x);
     const spd=430;
     b.vx=Math.cos(ang)*spd; b.vy=Math.sin(ang)*spd;
     lockSpeed(b,spd);
     b.state.floTimer+=dt;
     const closeEnough=dist(b.x,b.y,other.x,other.y)<(b.radius+other.radius+10);
     if(closeEnough || b.state.floTimer>0.85){
       florentinoStrike(b,g,other);
     }
   } else if(b.state.floPhase==='toCenter'){
     // lướt (không tele) về đúng tâm đối thủ trước khi phóng ra hoa kế tiếp -
     // cho phép đè hẳn lên đối thủ (không dừng ở rìa) - tốc độ múa được hạ
     // xuống một chút cho dễ theo dõi bằng mắt
     const ang=Math.atan2(other.y-b.y,other.x-b.x);
     const spd=350;
     b.vx=Math.cos(ang)*spd; b.vy=Math.sin(ang)*spd;
     lockSpeed(b,spd);
     b.state.floTimer+=dt;
     const arrived=dist(b.x,b.y,other.x,other.y)<10;
     if(arrived || b.state.floTimer>0.42){
       b.state.floTimer=0;
       b.state.floPhase='picking';
     }
   } else if(b.state.floPhase==='picking'){
     const target=b.state.floFlowers[b.state.floIndex];
     if(!target){ florentinoEnd(b,g); return; }
     const ang=Math.atan2(target.y-b.y,target.x-b.x);
     const spd=310;
     b.vx=Math.cos(ang)*spd; b.vy=Math.sin(ang)*spd;
     lockSpeed(b,spd);
     b.state.floTimer+=dt;
     const arrived=dist(b.x,b.y,target.x,target.y)<20;
     if(arrived || b.state.floTimer>0.6){
       b.state.floTimer=0;
       if(Math.random()<FLORENTINO_PICK_CHANCE){
         target.collected=true;
         const pickDmg=dmgFor(b,10);
         other.hp=Math.max(0,other.hp-pickDmg);
         spawnFloatText(g,other.x,other.y-30,'-'+pickDmg.toFixed(0),'#e0568a');
         spawnFloatText(g,b.x,b.y-24,'🌸','#e0568a');
         // mỗi lần nhặt trúng hoa cũng hồi máu cho Florentino
         b.hp=Math.min(b.maxHp,b.hp+6);
         spawnFloatText(g,b.x,b.y-40,'+6','#7CFF9A');
         // bung nhẹ vài cánh hoa ngay chỗ nhặt trúng
         for(let i=0;i<4;i++){
           const bAng=rand(0,Math.PI*2), spd2=rand(50,110);
           b.state.floBurst.push({x:b.x,y:b.y,vx:Math.cos(bAng)*spd2,vy:Math.sin(bAng)*spd2,born:g.t,rot:rand(0,Math.PI*2)});
         }
         b.state.floIndex++;
         if(b.state.floIndex>=3){
           florentinoStrike(b,g,other);
         } else {
           // lướt (không tele) quay lại tâm đối thủ trước khi ra bông kế tiếp
           b.state.floPhase='toCenter';
           b.state.floTimer=0;
         }
       } else {
         spawnFloatText(g,b.x,b.y-30,'HỤT!','#999999');
         b.state.ccImmune=false;
         florentinoEnd(b,g);
       }
     }
   }
 },
 // giảm 25% sát thương nhận vào trong suốt thời gian miễn nhiễm khống chế
 // (từ lúc bắt đầu lướt tới cho tới khi kết thúc combo múa) - đã nerf từ 50%
 modifyIncoming:(b,attacker,dmg,g)=>{ return b.state.ccImmune? dmg*0.75 : dmg; },
 renderExtra:(b,g,ctx)=>{
   const dancing = b.state.floPhase==='toCenter' || b.state.floPhase==='picking';

   // vòng khoảng cách lướt của ulti - chỉ hiện mờ nhạt lúc chưa kích hoạt
   if(b.state.floPhase==='idle'){
     ctx.save();
     ctx.beginPath(); ctx.arc(b.x,b.y,FLORENTINO_RANGE,0,Math.PI*2);
     ctx.setLineDash([5,7]);
     ctx.strokeStyle='rgba(224,86,138,0.18)'; ctx.lineWidth=1.5; ctx.stroke();
     ctx.setLineDash([]);
     ctx.restore();
   }

   // vệt lướt (afterimage hồng nhạt) phía sau khi đang múa
   for(const p of b.state.floTrail){
     const age=g.t-p.t;
     const a=clamp(1-age/0.35,0,1)*0.3;
     if(a<=0) continue;
     ctx.beginPath(); ctx.arc(p.x,p.y,b.radius*0.65,0,Math.PI*2);
     ctx.fillStyle=`rgba(224,86,138,${a})`; ctx.fill();
   }

   // vòng sóng xung "nở hoa" toả ra từ điểm vừa choáng
   if(b.state.floRingBorn!==undefined){
     const age=g.t-b.state.floRingBorn;
     if(age<0.45){
       const a=clamp(1-age/0.45,0,1);
       const r=14+age*170;
       ctx.beginPath(); ctx.arc(b.state.floRingX,b.state.floRingY,r,0,Math.PI*2);
       ctx.strokeStyle=`rgba(224,86,138,${(a*0.8).toFixed(2)})`; ctx.lineWidth=3; ctx.stroke();
     }
   }

   // hào quang sàn diễn hồng nhạt dưới chân khi đang múa
   if(dancing){
     ctx.save();
     ctx.globalAlpha=0.22+0.09*Math.sin(g.t*6);
     const grad=ctx.createRadialGradient(b.x,b.y,2,b.x,b.y,b.radius*2.3);
     grad.addColorStop(0,'rgba(224,86,138,0.55)');
     grad.addColorStop(1,'rgba(224,86,138,0)');
     ctx.beginPath(); ctx.arc(b.x,b.y,b.radius*2.3,0,Math.PI*2);
     ctx.fillStyle=grad; ctx.fill();
     ctx.restore();
   }

   // các cánh hoa đang bung ra (impact bloom)
   for(const p of b.state.floBurst){
     const age=g.t-p.born;
     const a=clamp(1-age/0.6,0,1);
     if(a<=0) continue;
     ctx.save();
     ctx.globalAlpha=a;
     ctx.translate(p.x,p.y); ctx.rotate(p.rot+age*4);
     ctx.font='14px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
     ctx.fillText('🌸',0,0);
     ctx.restore();
   }

   // hoa chưa nhặt - "bắn ra" từ đúng tâm đối thủ theo 3 hướng rồi an vị,
   // hơi phập phồng cho sinh động. Hiện ngay từ lúc toCenter để thấy rõ
   // cảnh hoa bắn ra trong lúc Florentino đang lướt về tâm.
   if(dancing){
     for(const f of b.state.floFlowers){
       if(f.collected) continue;
       const shootT=clamp((g.t-(f.bornAt||0))/0.28,0,1);
       const ease=shootT*shootT*(3-2*shootT); // smoothstep
       const fx=(f.ox!==undefined)? f.ox+(f.x-f.ox)*ease : f.x;
       const fy=(f.oy!==undefined)? f.oy+(f.y-f.oy)*ease : f.y;
       const pulse=1+0.12*Math.sin(g.t*5);
       ctx.save();
       ctx.translate(fx,fy);
       ctx.rotate(g.t*2.2);
       ctx.scale(pulse,pulse);
       ctx.font='16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
       ctx.fillText('🌸',0,0);
       ctx.restore();
     }
   }

   // vòng xoay 3 cánh hoa quanh thân khi đang múa - như tà váy hoa xoay tròn
   if(dancing){
     const haloR=b.radius+13;
     for(let i=0;i<3;i++){
       const a=g.t*3.5+i*(Math.PI*2/3);
       const px=b.x+Math.cos(a)*haloR, py=b.y+Math.sin(a)*haloR;
       ctx.save();
       ctx.translate(px,py); ctx.rotate(a+Math.PI/2);
       ctx.font=(b.radius*0.42)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
       ctx.fillText('🌸',0,0);
       ctx.restore();
     }
   }

   if(b.state.ccImmune){
     ctx.beginPath(); ctx.arc(b.x,b.y,b.radius+9,0,Math.PI*2);
     ctx.strokeStyle='rgba(224,86,138,0.85)'; ctx.lineWidth=2.5; ctx.stroke();
   }

   // thanh kiếm (rapier): thủ thế chĩa về đối thủ lúc bình thường,
   // xoay múa tít quanh thân như một điệu kiếm khi đang múa hoa
   const opp=g.opponentOf(b);
   if(dancing){
     const swordAng=g.t*8;
     ctx.save();
     ctx.translate(b.x,b.y); ctx.rotate(swordAng);
     ctx.font=(b.radius*0.85)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
     ctx.fillText('🗡️', b.radius*1.25, 0);
     ctx.restore();
   } else if(opp){
     const swordAng=Math.atan2(opp.y-b.y,opp.x-b.x);
     ctx.save();
     ctx.translate(b.x,b.y); ctx.rotate(swordAng);
     ctx.font=(b.radius*0.8)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
     ctx.fillText('🗡️', b.radius*1.15, 0);
     ctx.restore();
   }

   if(b.state.floPhase==='dash'){
     const spin=g.t*5;
     ctx.save();
     ctx.translate(b.x,b.y); ctx.rotate(spin);
     ctx.font=(b.radius*0.5)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
     ctx.fillText('✨',b.radius*0.9,0);
     ctx.restore();
   }
 }},

// ==================== 🛡️ NHÓM HỖ TRỢ, VÙNG ĐẤT & TRIỆU HỒI ====================
{id:'vampire', name:'Vampire Ball', group:'dps', icon:'🧛', hp:95, speed:120, dmg:9, color:'#8a1f3d',
 descSimple:'Định kỳ, khi chạm vào đối thủ sẽ hút máu của họ để hồi phục cho bản thân.',
 desc:'Cứ mỗi 4 giây, khi chạm vào đối thủ sẽ giữ họ lại và hút 10 HP để hồi phục cho bản thân. Luôn có 2 chiếc nanh chĩa về phía đối thủ.',
 init:(b)=>{ b.state.lastVamp=-99; },
 onBallCollide:(b,other,g)=>{
   if(g.t-(b.state.lastVamp||-99)>4){
     b.state.lastVamp=g.t;
     const drain=Math.min(10,other.hp);
     other.hp=Math.max(0,other.hp-10);
     b.hp=Math.min(b.maxHp,b.hp+drain);
     other.state.rootUntil=g.t+0.8;
     spawnFloatText(g,other.x,other.y-30,'-10','#ff6a8a');
     spawnFloatText(g,b.x,b.y-30,'+'+drain.toFixed(0),'#7CFF9A');
   }
 },
 renderExtra:(b,g,ctx)=>{
   const other=g.opponentOf(b); if(!other) return;
   const ang=Math.atan2(other.y-b.y,other.x-b.x);
   const r=b.radius;
   ctx.save();
   ctx.translate(b.x,b.y); ctx.rotate(ang);
   ctx.fillStyle='#ffffff'; ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=1.2;
   for(const side of [-1,1]){
     ctx.beginPath();
     ctx.moveTo(r*0.55, side*r*0.4);
     ctx.lineTo(r*1.25, side*r*0.18);
     ctx.lineTo(r*0.55, side*r*0.08);
     ctx.closePath();
     ctx.fill(); ctx.stroke();
   }
   ctx.restore();
 }},
{id:'spider', name:'Spider Ball', group:'control', icon:'🕷️', hp:95, speed:100, dmg:6, color:'#4a3b5c',
 descSimple:'Mỗi lần va tường sẽ giăng một sợi tơ tồn tại vĩnh viễn; đối thủ chạm vào tơ sẽ mất máu nhẹ theo thời gian.',
 desc:'Khi va tường, giăng một sợi tơ nối từ điểm chạm đến bản thân, tồn tại vĩnh viễn — số lượng dây không giới hạn và không bao giờ biến mất. Đối thủ chạm vào sợi tơ sẽ mất 1 máu.',
 init:(b)=>{ b.state.webAnchors=[]; },
 onWallHit:(b,g)=>{
   b.state.webAnchors.push({x:b.x,y:b.y,lastHit:-99});
 },
 update:(b,dt,g)=>{
   const other=g.opponentOf(b);
   if(!other) return;
   for(const anchor of b.state.webAnchors){
     const d=pointSegmentDist(other.x,other.y,anchor.x,anchor.y,b.x,b.y);
     if(d<other.radius+5 && g.t-anchor.lastHit>0.3){
       anchor.lastHit=g.t;
       other.hp=Math.max(0,other.hp-1);
       spawnFloatText(g,other.x,other.y-30,'-1','#cfcfcf');
     }
   }
 },
 renderExtra:(b,g,ctx)=>{
   for(const anchor of b.state.webAnchors){
     // brighter, thicker silk thread with a soft glow so it actually reads
     // against the dark arena background instead of disappearing
     ctx.save();
     ctx.shadowColor='rgba(255,255,255,0.55)'; ctx.shadowBlur=6;
     ctx.beginPath(); ctx.moveTo(anchor.x,anchor.y); ctx.lineTo(b.x,b.y);
     ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=3.5;
     ctx.stroke();
     ctx.restore();
     // bright thin core line down the middle for a "spun silk" highlight
     ctx.beginPath(); ctx.moveTo(anchor.x,anchor.y); ctx.lineTo(b.x,b.y);
     ctx.strokeStyle='rgba(255,255,255,0.95)'; ctx.lineWidth=1.2;
     ctx.stroke();
     // wall anchor stud
     ctx.beginPath(); ctx.arc(anchor.x,anchor.y,6,0,Math.PI*2);
     ctx.fillStyle='#f4f4f4'; ctx.fill();
     ctx.lineWidth=1.5; ctx.strokeStyle='#8a4fd9'; ctx.stroke();
   }
 }},
{id:'reforge', name:'Reforge Ball', group:'dps', icon:'⚒️', hp:100, speed:100, dmg:8, color:'#b5652f',
 descSimple:'Va tường sẽ triệu hồi một linh hồn nhỏ tự bắn đạn hỗ trợ; linh hồn mạnh dần khi đánh trúng địch, và có thêm một linh hồn nữa khi máu xuống thấp.',
 desc:'Đập vào tường để triệu hồi tiểu linh hồn bắn đạn hỗ trợ, tích lũy sức mạnh nhanh mỗi khi đánh trúng địch. Khi HP dưới 50%, triệu hồi thêm linh hồn thứ hai.',
 init:(b)=>{ b.state.minions=[]; },
 onWallHit:(b,g)=>{
   if(b.state.minions.length<1) b.state.minions.push({x:b.x,y:b.y,power:1,fireCD:0,offset:-30});
 },
 onDealDamage:(b,other,dmg,g)=>{
   for(const m of b.state.minions) m.power=Math.min(10,m.power+2);
 },
 update:(b,dt,g)=>{
   if(b.hp/b.maxHp<0.5 && b.state.minions.length===1){
     b.state.minions.push({x:b.x,y:b.y,power:b.state.minions[0].power,fireCD:0,offset:30});
   }
   const other=g.opponentOf(b);
   for(const m of b.state.minions){
     m.x+=(b.x+m.offset-m.x)*0.05; m.y+=(b.y-30-m.y)*0.05;
     if(g.t-(m.fireCD||0)>2.5){
       m.fireCD=g.t;
       if(other){
         const ang=Math.atan2(other.y-m.y,other.x-m.x);
         fireProjectile(g,b,{x:m.x,y:m.y,vx:Math.cos(ang)*300,vy:Math.sin(ang)*300,r:5,dmg:dmgFor(b,2)*m.power*0.4,life:1.5,color:'#c9a8ff'});
       }
     }
   }
 },
 renderExtra:(b,g,ctx)=>{
   for(const m of b.state.minions){
     const heat=clamp((m.power-1)/9,0,1); // 0 at power 1, 1 at power 10 (max)
     const r=8+m.power*0.6;
     if(m.power>=6){
       // charged aura: pulsing ring + a few orbiting spark motes
       const pulse=1+Math.sin(g.t*8+m.offset)*0.15;
       ctx.beginPath(); ctx.arc(m.x,m.y,(r+6)*pulse,0,Math.PI*2);
       ctx.strokeStyle=`rgba(201,168,255,${(0.3+heat*0.5).toFixed(2)})`; ctx.lineWidth=2; ctx.stroke();
       for(let i=0;i<3;i++){
         const ang=g.t*6+i*(Math.PI*2/3);
         const sx=m.x+Math.cos(ang)*(r+9), sy=m.y+Math.sin(ang)*(r+9);
         ctx.beginPath(); ctx.arc(sx,sy,2.2,0,Math.PI*2);
         ctx.fillStyle=`rgba(255,255,255,${(0.5+heat*0.5).toFixed(2)})`; ctx.fill();
       }
       // thin energy tether back to the Reforge Ball once nearly maxed out
       if(m.power>=9){
         ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(m.x,m.y);
         ctx.strokeStyle=`rgba(201,168,255,${(0.25+0.25*Math.sin(g.t*20)).toFixed(2)})`; ctx.lineWidth=1.5; ctx.stroke();
       }
     }
     const core=ctx.createRadialGradient(m.x,m.y,1,m.x,m.y,r);
     core.addColorStop(0, heat>0.5? '#ffffff' : '#e8d8ff');
     core.addColorStop(1, 'rgba(201,168,255,0.85)');
     ctx.beginPath(); ctx.arc(m.x,m.y,r,0,Math.PI*2);
     ctx.fillStyle=core; ctx.fill();
   }
 }},
{id:'cell', name:'Cell Ball', group:'dps', icon:'🦠', hp:80, speed:110, dmg:5, color:'#7ee06a',
 descSimple:'Mất tới mốc máu nhất định sẽ nhân đôi toàn bộ bản thể thành các bản sao độc lập, sát thương tăng theo mỗi lần phân chia.',
 desc:'Cứ khi máu chạm mốc còn 75%/50%/25%/mốc cuối, Cell Ball nhân đôi toàn bộ số lượng bản thể đang có (kể cả bản thân) thành các bản sao độc lập kích thước bằng chính nó — đang có 2 sẽ ra 4, đang có 4 sẽ ra 8. Các bản sao bay theo hướng ngẫu nhiên, va chạm như bóng thường. Sát thương của Cell Ball tăng thêm x1.5 mỗi lần phân chia.',
 init:(b)=>{ b.state.thresholdsHit=0; b.state.dmgMult=1; },
 update:(b,dt,g)=>{
   const missingRatio=1-(b.hp/b.maxHp);
   const thresholds=Math.min(4,Math.floor(missingRatio/0.25));
   if(thresholds>b.state.thresholdsHit){
     for(let i=b.state.thresholdsHit;i<thresholds;i++){
       const existing=g.cellClones.filter(c=>c.owner===b);
       const sources=[{x:b.x,y:b.y},...existing];
       // parent also gets redirected onto a fresh random heading
       const newAng=rand(0,Math.PI*2);
       const spd0=170+rand(-25,25);
       b.vx=Math.cos(newAng)*spd0; b.vy=Math.sin(newAng)*spd0;
       lockSpeed(b, spd0);
       // spawn one new clone per existing body -> doubles the total headcount
       for(const src of sources){
         const ang=rand(0,Math.PI*2);
         const spd=170+rand(-25,25);
         g.spawnCellClone(b,src.x,src.y,Math.cos(ang)*spd,Math.sin(ang)*spd);
       }
       b.state.dmgMult=(b.state.dmgMult||1)*1.5;
     }
     b.state.thresholdsHit=thresholds;
     spawnParticles(g,b.x,b.y,20);
     spawnFloatText(g,b.x,b.y-40,'PHÂN CHIA!','#8dff7a');
   }
 },
 modifyOutgoing:(b,other,dmg,g)=>{ return dmg*(b.state.dmgMult||1); },
 renderExtra:(b,g,ctx)=>{
   const dots=[{a:0.6,d:0.35,r:0.22,sp:0.4},{a:2.4,d:0.5,r:0.16,sp:-0.3},{a:4.1,d:0.28,r:0.14,sp:0.55}];
   for(const dc of dots){
     const ang=dc.a+g.t*dc.sp;
     const dx=b.x+Math.cos(ang)*b.radius*dc.d, dy=b.y+Math.sin(ang)*b.radius*dc.d;
     ctx.beginPath(); ctx.arc(dx,dy,b.radius*dc.r,0,Math.PI*2);
     ctx.fillStyle='rgba(20,70,20,0.35)'; ctx.fill();
   }
 }},
{id:'range', name:'Range Ball', group:'dps', icon:'🌐', hp:110, speed:70, dmg:6, color:'#4fb0c9',
 descSimple:'Tạo một vòng năng lượng quanh bản thân, mở rộng dần theo thời gian (có giới hạn); ai đứng bên trong sẽ bị bào mòn máu.',
 desc:'Tạo vòng năng lượng bao quanh bản thân, mở rộng dần theo thời gian nhưng bị giới hạn tối đa chỉ bao phủ khoảng 65% sân đấu, bào mòn máu ai đứng bên trong.',
 init:(b)=>{ b.state.auraTimer=0; },
 update:(b,dt,g)=>{
   b.state.auraTimer+=dt;
   const maxRadius=Math.min(g.w,g.h)*0.325; // capped so the aura's diameter never exceeds ~65% of the arena
   const radius=Math.min(maxRadius,40+b.state.auraTimer*10);
   b.state.auraRadius=radius;
   const other=g.opponentOf(b);
   if(other && dist(b.x,b.y,other.x,other.y)<radius && g.t-(b.state.auraTickCD||0)>0.5){
     b.state.auraTickCD=g.t;
     const dmg=dmgFor(b,4);
     other.hp=Math.max(0,other.hp-dmg);
     spawnFloatText(g,other.x,other.y-30,'-'+dmg.toFixed(0),'#ffcb3d');
   }
 },
 renderExtra:(b,g,ctx)=>{
   const r=b.state.auraRadius||0; if(r<=0) return;
   ctx.beginPath(); ctx.arc(b.x,b.y,r,0,Math.PI*2);
   ctx.strokeStyle='rgba(255,203,61,0.45)'; ctx.lineWidth=2; ctx.stroke();
 }},
{id:'zone', name:'Zone Ball', group:'control', icon:'🟥', hp:120, speed:55, dmg:6, color:'#c0392b',
 descSimple:'Tạo ra các ô vuông tử địa rải rác trên sân đấu — càng mất nhiều máu càng có thêm ô mới; lọt vào ô sẽ chịu sát thương rất nặng.',
 desc:'Ngay khi vào trận đã tự tạo sẵn 1 ô vuông tử địa. Sau đó, cứ mỗi 20% HP bị mất, tạo thêm 1 ô vuông tử địa tại vị trí ngẫu nhiên trên sân đấu, gây sát thương cực nặng cho ai lọt vào trong.',
 init:(b)=>{ b.state.thresholdsHit=0; b.state.startZoneDone=false; },
 update:(b,dt,g)=>{
   if(!b.state.startZoneDone){
     b.state.startZoneDone=true;
     const cx=rand(70,g.w-70), cy=rand(70,g.h-70);
     spawnHazard(g,{type:'zonebox',x:cx-45,y:cy-45,w:90,h:90,until:g.t+9999,owner:b,rectType:true});
     spawnFloatText(g,b.x,b.y-40,'ZONE!','#ff3b5c');
   }
   const missingRatio=1-(b.hp/b.maxHp);
   const thresholds=Math.min(5,Math.floor(missingRatio/0.2));
   if(thresholds>b.state.thresholdsHit){
     for(let i=b.state.thresholdsHit;i<thresholds;i++){
       const cx=rand(70,g.w-70), cy=rand(70,g.h-70);
       spawnHazard(g,{type:'zonebox',x:cx-45,y:cy-45,w:90,h:90,until:g.t+9999,owner:b,rectType:true});
     }
     b.state.thresholdsHit=thresholds;
     spawnFloatText(g,b.x,b.y-40,'ZONE MỚI!','#ff3b5c');
   }
 }},
{id:'laser', name:'Laser Ball', group:'burst', icon:'🔴', hp:70, speed:120, dmg:11, color:'#ff4d4d',
 descSimple:'Ngay khi vào trận sẽ dựng 4 đường laser cố định dọc theo các cạnh sân đấu, tồn tại tới hết trận; chạm vào sẽ liên tục mất máu.',
 desc:'Ngay khi vào trận, dựng 4 đường laser cố định dọc theo 4 cạnh sân đấu, tồn tại vĩnh viễn tới hết trận. Chạm vào sẽ chịu sát thương liên tục.',
 init:(b)=>{ b.state.lasersSpawned=false; },
 update:(b,dt,g)=>{
   if(!b.state.lasersSpawned){
     b.state.lasersSpawned=true;
     const th=12, d=dmgFor(b,7);
     spawnHazard(g,{type:'laser',x:0,y:0,w:g.w,h:th,until:Infinity,owner:b,rectType:true,dmg:d});
     spawnHazard(g,{type:'laser',x:0,y:g.h-th,w:g.w,h:th,until:Infinity,owner:b,rectType:true,dmg:d});
     spawnHazard(g,{type:'laser',x:0,y:0,w:th,h:g.h,until:Infinity,owner:b,rectType:true,dmg:d});
     spawnHazard(g,{type:'laser',x:g.w-th,y:0,w:th,h:g.h,until:Infinity,owner:b,rectType:true,dmg:d});
   }
 }},

// ==================== 🎁 NHÓM ĐẶC BIỆT & ĐỘC QUYỀN ====================
{id:'bomb', name:'Bomb Ball', group:'burst', icon:'💣', hp:100, speed:100, dmg:14, color:'#4a4a4a',
 descSimple:'Định kỳ thả một quả bom hẹn giờ; sau vài giây bom phát nổ, gây sát thương diện rộng quanh vị trí nổ.',
 desc:'Cứ mỗi 1 giây thả một quả bom hẹn giờ (có hiện đếm ngược). Sau 5 giây, bom phát nổ gây sát thương diện rộng quanh vị trí quả bom, kèm hiệu ứng vòng nổ lan tỏa (phạm vi lớn hơn, nhưng vẫn không phải toàn map).',
 init:(b)=>{ b.state.bombCD=0; },
 update:(b,dt,g)=>{
   if(g.t-(b.state.bombCD||0)>1){
     b.state.bombCD=g.t;
     spawnBomb(g,b.x,b.y,b,5);
   }
 },
 renderExtra:(b,g,ctx)=>{
   const wag=Math.sin(g.t*6)*8;
   const topX=b.x, topY=b.y-b.radius;
   const midX=b.x+wag*0.5, midY=topY-8;
   const tipX=b.x+wag, tipY=topY-16;
   ctx.beginPath();
   ctx.moveTo(topX,topY);
   ctx.quadraticCurveTo(midX,midY,tipX,tipY);
   ctx.strokeStyle='#8a6a3a'; ctx.lineWidth=3; ctx.lineCap='round'; ctx.stroke();
   const flick=0.6+0.4*Math.sin(g.t*20);
   ctx.beginPath(); ctx.arc(tipX,tipY,6*flick,0,Math.PI*2);
   ctx.fillStyle='rgba(255,150,50,0.35)'; ctx.fill();
   ctx.beginPath(); ctx.arc(tipX,tipY,3.2*flick,0,Math.PI*2);
   ctx.fillStyle='#ffcf4a'; ctx.fill();
 }},
{id:'conductor', name:'Train Ball', group:'burst', icon:'🚂', hp:95, speed:100, dmg:13, color:'#c97a2f',
 descSimple:'Va tường đánh dấu điểm ray; sau ít giây một đoàn tàu chạy dọc ray đó, gây sát thương nặng và hất văng ai cản đường.',
 desc:'Va tường để lại điểm ray nối với điểm chạm trước đó. Sau mỗi 5 giây, một đoàn tàu (hitbox lớn) chạy đúng theo đường ray đã tạo, gây sát thương cố định 22 và húc văng/hất tung bất kỳ ai cản đường. Chạy xong, đường ray đó biến mất và phải tạo lại từ đầu.',
 init:(b)=>{ b.state.trainCD=0; b.state.railPoints=[]; b.state.activeRail=null; },
 onWallHit:(b,g)=>{
   b.state.railPoints.push({x:b.x,y:b.y});
   if(b.state.railPoints.length>6) b.state.railPoints.shift();
 },
 update:(b,dt,g)=>{
   if(g.t-(b.state.trainCD||0)>5 && b.state.railPoints.length>0){
     b.state.trainCD=g.t;
     const path=[...b.state.railPoints,{x:b.x,y:b.y}];
     // freeze this exact path for rendering while the train runs, so the
     // drawn track no longer keeps stretching to follow the ball's later
     // movement - it now stays put until the train has fully passed
     b.state.activeRail=path;
     g.spawnTrain(b,path,()=>{ b.state.railPoints=[]; b.state.activeRail=null; });
     spawnFloatText(g,b.x,b.y-40,'🚂 TRAIN!','#ffb347');
   }
 },
 renderExtra:(b,g,ctx)=>{
   const pts=b.state.activeRail||b.state.railPoints;
   if(!pts || pts.length<1) return;
   ctx.beginPath();
   ctx.moveTo(pts[0].x,pts[0].y);
   for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
   if(!b.state.activeRail) ctx.lineTo(b.x,b.y); // still-building track follows the ball live
   ctx.strokeStyle='rgba(255,179,71,0.55)'; ctx.lineWidth=3; ctx.setLineDash([6,4]);
   ctx.stroke(); ctx.setLineDash([]);
 }},
{id:'potion', name:'Potion Ball', group:'special', icon:'🧪', hp:90, speed:100, dmg:9, color:'#3ecf9e',
 descSimple:'Va chạm tích năng lượng; đủ vạch sẽ ném bình thuốc ngẫu nhiên: đốt, độc, đóng băng, giật điện hoặc tự hồi máu.',
 desc:'Mang thanh năng lượng 4 vạch. Mỗi lần va chạm: 75% cơ hội tích thêm 1 vạch, 25% cơ hội ném các bình thuốc ngẫu nhiên ngay theo số vạch đang có rồi thanh năng lượng tụt về 0 (0 vạch ném 1 loại, 4 vạch ném đủ cả 5 loại). Nếu thanh đã đầy 4 vạch, lần va chạm tiếp theo TỰ ĐỘNG ném cả 5 loại thuốc luôn, không cần roll may rủi nữa. Không có chữ báo hiệu ứng - chỉ có icon nhỏ hiện trên đầu quả bóng bị dính, các icon có thể chồng lên nhau nếu trúng nhiều loại cùng lúc. Burn 🔥: 3 dmg/0.3s lên đối thủ, đồng thời giảm 50% sát thương đối thủ gây ra trong lúc đang cháy. Toxic ☠️: 3 dmg/0.3s lên đối thủ, độc tăng thêm 3 dmg mỗi nhịp (hết hiệu ứng độc trở lại mức 3). Frozen ❄️ / Shock ⚡: khiến đối thủ đứng yên tại chỗ, gây 1 dmg/0.2s. Health 💚: tự hồi 7 máu/0.3s cho chính Potion Ball. Mỗi hiệu ứng kéo dài 1 giây.',
 init:(b)=>{ b.state.potionEnergy=0; },
 onBallCollide:(b,other,g)=>{
   if((b.state.potionEnergy||0)>=4){
     // Full bar (4 vạch): auto-throw all 5 potions on this hit, no roll needed
     throwPotions(b,other,g,5);
     return;
   }
   if(Math.random()<0.75){
     b.state.potionEnergy=Math.min(4,(b.state.potionEnergy||0)+1);
     spawnParticles(g,b.x,b.y,6,{color:'#3ecf9e',type:'spark',speed:90});
   } else {
     const countByEnergy={0:1,1:2,2:3,3:4,4:5};
     const count=countByEnergy[b.state.potionEnergy||0];
     throwPotions(b,other,g,count);
   }
 },
 renderExtra:(b,g,ctx)=>{
   // energy bar: 4 pips above the ball (drawn above the generic status icons)
   const n=4, w=8, h=6, gap=3;
   const totalW=n*w+(n-1)*gap;
   const startX=b.x-totalW/2, y=b.y-b.radius-30;
   for(let i=0;i<n;i++){
     const filled=i<(b.state.potionEnergy||0);
     ctx.beginPath();
     ctx.rect(startX+i*(w+gap),y,w,h);
     ctx.fillStyle= filled? '#3ecf9e' : 'rgba(0,0,0,0.12)';
     ctx.fill();
     ctx.lineWidth=1; ctx.strokeStyle='#1a1a1a'; ctx.stroke();
   }
 }},
{id:'dice', name:'Dice Ball', group:'burst', icon:'🎲', hp:90, speed:100, dmg:8, color:'#e8e8e8',
 descSimple:'Mỗi lần va chạm sẽ tự đổi mặt xúc xắc; mặt xúc xắc càng lớn thì sát thương gây ra càng cao.',
 desc:'Sau mỗi lần va chạm, tự đổi mặt xúc xắc, sát thương tăng dần đều theo mặt xúc xắc: ra 1 yếu nhất, ra 6 mạnh nhất (không còn chênh lệch cực đoan như trước).',
 modifyOutgoing:(b,other,dmg,g)=>{
   const roll=randi(1,6);
   spawnFloatText(g,b.x,b.y-46,'🎲'+roll,'#ffffff');
   const table={1:0.5,2:0.75,3:1.0,4:1.25,5:1.5,6:2.5};
   return dmg*table[roll];
 }},
{id:'bigspike', name:'Big Spike Ball', group:'burst', icon:'🔩', hp:180, speed:65, dmg:15, color:'#5a5a5a', radiusMult:1.25, massMult:2.2,
 descSimple:'Không có kỹ năng đặc biệt, nhưng thân hình to và nặng khiến lực húc trực diện cực kỳ mạnh, dễ phá vỡ phòng thủ đối thủ.',
 desc:'Gắn gai sắt khổng lồ xung quanh. Không có kỹ năng phức tạp, nhưng lực húc trực diện cực kỳ mạnh, dễ phá vỡ phòng thủ.',
 renderExtra:(b,g,ctx)=>{
   const n=8;
   for(let i=0;i<n;i++){
     const ang=i*(Math.PI*2/n)+g.t*0.3;
     const x1=b.x+Math.cos(ang)*b.radius*0.92, y1=b.y+Math.sin(ang)*b.radius*0.92;
     const x2=b.x+Math.cos(ang)*(b.radius+10), y2=b.y+Math.sin(ang)*(b.radius+10);
     const perp=ang+Math.PI/2, w=4.5;
     ctx.beginPath();
     ctx.moveTo(x1+Math.cos(perp)*w, y1+Math.sin(perp)*w);
     ctx.lineTo(x2,y2);
     ctx.lineTo(x1-Math.cos(perp)*w, y1-Math.sin(perp)*w);
     ctx.closePath();
     ctx.fillStyle='#6b6b6b'; ctx.fill();
     ctx.lineWidth=1; ctx.strokeStyle='#1a1a1a'; ctx.stroke();
   }
 }},
{id:'basic', name:'Basic Ball', group:'special', icon:'⚪', hp:100, speed:100, dmg:7, color:'#b0b0b0',
 descSimple:'Không có kỹ năng đặc biệt, mọi chỉ số đều ở mức trung bình, bù lại độ ổn định cao và dễ điều khiển.',
 desc:'Không có kỹ năng đặc biệt, mọi chỉ số đều ở mức trung bình, bù lại độ ổn định cao và dễ điều khiển.'},
{id:'forcefield', name:'Forcefield Ball', group:'special', icon:'🛡️', hp:95, speed:115, dmg:6, color:'#4fa8e8',
 descSimple:'Luôn mang khiên năng lượng; đỡ đòn giảm sát thương nhận và phản lại cho đối thủ, sau đó vỡ và cần thời gian hồi phục.',
 desc:'Mang khiên năng lượng thường trực, không giới hạn thời gian - khiên chỉ mất đi khi thực sự đỡ một đòn: lần trúng đòn đó bản thân chỉ nhận 50% sát thương, đồng thời phản ngược lại 150% sát thương gốc cho đối thủ. Ngay sau đó khiên vỡ và mất 4 giây để tái tạo trước khi bảo vệ trở lại.',
 init:(b)=>{ b.state.shieldReady=true; b.state.shieldBrokenAt=-99; b.state.shieldCooldown=4; },
 update:(b,dt,g)=>{
   // Shield has no timer while up - it only ever breaks by actually
   // absorbing/reflecting a hit (see modifyIncoming). This just handles the
   // recharge countdown after it broke.
   if(!b.state.shieldReady && g.t-(b.state.shieldBrokenAt||-99) >= b.state.shieldCooldown){
     b.state.shieldReady=true;
     spawnFloatText(g,b.x,b.y-42,'KHIÊN HỒI PHỤC!','#8fdcff');
     spawnParticles(g,b.x,b.y,10,{color:'#8fdcff',type:'glow',speed:60,life:0.5});
   }
 },
 modifyIncoming:(b,attacker,dmg,g)=>{
   if(b.state.shieldReady && dmg>0){
     const reflect=dmg*1.5;
     attacker.hp=Math.max(0,attacker.hp-reflect);
     spawnFloatText(g,attacker.x,attacker.y-30,'-'+reflect.toFixed(0),'#8fdcff');
     spawnFloatText(g,b.x,b.y-46,'REFLECT!','#8fdcff');
     // shield breaks on the hit it just absorbed - starts its recharge clock
     b.state.shieldReady=false;
     b.state.shieldBrokenAt=g.t;
     g.spawnExplosionRing(b.x,b.y,b.radius+24,'79,168,232','200,236,255');
     spawnParticles(g,b.x,b.y,16,{color:'#8fdcff',type:'spark',speed:230});
     return dmg*0.5;
   }
   return dmg;
 },
 renderExtra:(b,g,ctx)=>{
   const R=b.radius+13;
   if(b.state.shieldReady){
     // ---- active shield: rotating hex energy field, hi-tech but minimal ----
     const rot=g.t*0.6;
     const pulse=0.75+0.25*Math.sin(g.t*3);
     ctx.save();
     ctx.shadowColor='#4fa8e8'; ctx.shadowBlur=13*pulse;
     // hex barrier outline + faint fill
     ctx.beginPath();
     for(let i=0;i<6;i++){
       const ang=rot+i*Math.PI/3;
       const px=b.x+Math.cos(ang)*R, py=b.y+Math.sin(ang)*R;
       i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
     }
     ctx.closePath();
     ctx.fillStyle=`rgba(79,168,232,${0.07+0.05*pulse})`; ctx.fill();
     ctx.strokeStyle=`rgba(143,220,255,${0.7*pulse})`; ctx.lineWidth=2.5; ctx.stroke();
     // small glowing node at each hex vertex - reads as "energy field", not clutter
     for(let i=0;i<6;i++){
       const ang=rot+i*Math.PI/3;
       const px=b.x+Math.cos(ang)*R, py=b.y+Math.sin(ang)*R;
       ctx.beginPath(); ctx.arc(px,py,2.3,0,Math.PI*2);
       ctx.fillStyle='#eaf7ff'; ctx.fill();
     }
     ctx.shadowBlur=0;
     // single bright scan arc sweeping around the barrier - the one "tech" flourish
     const sweep=g.t*2.4;
     ctx.beginPath();
     ctx.arc(b.x,b.y,R,sweep,sweep+0.85);
     ctx.strokeStyle=`rgba(255,255,255,${0.55+0.3*pulse})`; ctx.lineWidth=2; ctx.stroke();
     ctx.restore();
   } else {
     // ---- shield down: faint dashed outline + clean radial recharge sweep ----
     const rechargeT=clamp((g.t-(b.state.shieldBrokenAt||-99))/b.state.shieldCooldown,0,1);
     ctx.save();
     ctx.beginPath(); ctx.arc(b.x,b.y,R,0,Math.PI*2);
     ctx.strokeStyle='rgba(143,220,255,0.16)'; ctx.lineWidth=2; ctx.setLineDash([3,5]); ctx.stroke(); ctx.setLineDash([]);
     ctx.beginPath();
     ctx.arc(b.x,b.y,R,-Math.PI/2,-Math.PI/2+rechargeT*Math.PI*2);
     ctx.strokeStyle='rgba(143,220,255,0.85)'; ctx.lineWidth=3; ctx.stroke();
     ctx.restore();
   }
 }},
{id:'ghost', name:'Ghost Ball', group:'special', icon:'👻', hp:90, speed:105, dmg:8, color:'#9a8fc9',
 descSimple:'Di chuyển khó đoán, đôi lúc dịch chuyển tới cạnh đối thủ để đánh úp; sau đó sát thương gây ra tăng tạm thời, đòn kế tiếp nhận vào giảm một nửa.',
 desc:'Quỹ đạo chuyển động khó đoán, thỉnh thoảng biến mất trong tích tắc rồi xuất hiện bất ngờ cạnh đối thủ để đánh úp (22% cơ hội mỗi lần va tường). Sau mỗi lần blink, sát thương tăng thêm 50% trong ít giây, đồng thời lần trúng đòn kế tiếp (dù từ nguồn nào) sẽ được giảm 50% sát thương (hiệu ứng chỉ dùng được 1 lần, tái nạp lại ở lần blink sau).',
 update:(b,dt,g)=>{ if(Math.random()<0.01){ b.vx+=rand(-80,80); b.vy+=rand(-80,80); clampBallSpeed(b); lockSpeed(b, Math.hypot(b.vx,b.vy)); } },
 onWallHit:(b,g)=>{
   if(Math.random()<0.22){
     const other=g.opponentOf(b);
     if(other){
       const ang=rand(0,Math.PI*2);
       b.x=clamp(other.x+Math.cos(ang)*70,b.radius,g.w-b.radius);
       b.y=clamp(other.y+Math.sin(ang)*70,b.radius,g.h-b.radius);
       const spd=Math.hypot(b.vx,b.vy)||140;
       const toOther=Math.atan2(other.y-b.y,other.x-b.x);
       b.vx=Math.cos(toOther)*spd; b.vy=Math.sin(toOther)*spd;
       lockSpeed(b, spd);
       b.state.blinkBuffUntil=g.t+2.5;
       b.state.ghostShieldReady=true;
       spawnParticles(g,b.x,b.y,14);
       spawnFloatText(g,b.x,b.y-30,'BLINK!','#c9a8ff');
     }
   }
 },
 modifyOutgoing:(b,other,dmg,g)=>{ return g.t<(b.state.blinkBuffUntil||0)? dmg*1.5 : dmg; },
 modifyIncoming:(b,attacker,dmg,g,source)=>{
   if(b.state.ghostShieldReady && dmg>0){
     b.state.ghostShieldReady=false;
     spawnFloatText(g,b.x,b.y-40,'GHOST SHIELD!','#c9a8ff');
     return dmg*0.5;
   }
   return dmg;
 }},
{id:'shooting', name:'Shooting Ball', group:'special', icon:'🎯', hp:75, speed:160, dmg:9, color:'#f2a83c',
 descSimple:'Va tường liên tiếp mà chưa chạm địch sẽ tăng dần tốc độ và sát thương; chạm được đối thủ thì xả hết rồi tích lại từ đầu.',
 desc:'Mỗi lần va tường mà chưa chạm đối thủ kể từ lần va trước, tốc độ nhân thêm x1.5 và sát thương nhân thêm x1.25 (sát thương tối đa x3). Chạm được đối thủ sẽ xả toàn bộ sát thương tích lũy rồi tích lại từ đầu.',
 init:(b)=>{ b.state.dmgMult=1; b.state.touchedOpponent=false; },
 onWallHit:(b,g)=>{
   if(!b.state.touchedOpponent){
     b.vx*=1.5; b.vy*=1.5; clampBallSpeed(b);
     lockSpeed(b, Math.hypot(b.vx,b.vy));
     b.state.dmgMult=Math.min(3,(b.state.dmgMult||1)*1.25);
     spawnFloatText(g,b.x,b.y-30,'x'+b.state.dmgMult.toFixed(2),'#ffd166');
   } else {
     b.state.touchedOpponent=false;
   }
 },
 onBallCollide:(b,other,g)=>{ b.state.touchedOpponent=true; },
 modifyOutgoing:(b,other,dmg,g)=>{ return dmg*(b.state.dmgMult||1); },
 onDealDamage:(b,other,dmg,g)=>{ b.state.dmgMult=1; },
 renderExtra:(b,g,ctx)=>{
   const mult=b.state.dmgMult||1;
   if(mult<2) return;
   const heat=clamp((mult-2)/1,0,1); // 0 right at x2, 1 at the x3 cap
   drawFireAura(ctx,b,g,heat);
 }},
{id:'tornado', name:'Tornado Ball', group:'control', icon:'🌪️', hp:90, speed:100, dmg:8, color:'#8a4fd9',
 descSimple:'Đôi lúc bẻ quỹ đạo thành vòng tròn, tạo lốc xoáy hút nhẹ đối thủ lại gần, cuốn họ quay nếu dính đủ lâu rồi nổ tung sau 2 giây.',
 desc:'Cứ khoảng 5-9 giây, có cơ hội đột ngột bẻ quỹ đạo của chính mình thành một vòng tròn (không dịch chuyển tức thời, chỉ đổi hướng đi mượt sang hình tròn), tạo ra một cơn lốc xoáy đứng yên tại đúng tâm vòng tròn đó, tồn tại 2 giây. Trong lúc lốc còn tồn tại: nếu đối thủ ở trong phạm vi hút, lốc sẽ hút nhẹ (chỉ bẻ dần hướng đi, không giật hẳn về) đồng thời gây 1 sát thương mỗi 0.2 giây; nếu đối thủ ở trong phạm vi hút liên tục đủ 1 giây, họ sẽ bị cuốn hẳn vào trong và buộc phải quay vòng quanh tâm lốc cho tới khi lốc tan biến. Đúng 2 giây kể từ lúc xuất hiện, cơn lốc nổ tung, gây 18 sát thương và hất văng bất kỳ ai ở gần tâm.',
 init:(b)=>{ b.state.torPhase='idle'; b.state.torCD=-99; b.state.torTimer=0; },
 update:(b,dt,g)=>{
   if(b.state.torPhase==='idle'){
     // "thỉnh thoảng" - occasional random trigger, gated by both a hard
     // cooldown (torCD) and a per-second chance, so it can't spam back to
     // back; also skipped near walls/obstacles so the orbit never clips them.
     if(g.t-(b.state.torCD||-99)>5 && !g.isNearHazard(b) && g.opponentOf(b) && Math.random()<0.25*dt){
       const speed=Math.hypot(b.vx,b.vy)||b.speedLock||100;
       const travelAngle=Math.atan2(b.vy,b.vx);
       const side=Math.random()<0.5?1:-1;
       const radius=65;
       // pick the circle's center perpendicular to the current heading, so
       // the ball curves smoothly into the loop instead of teleporting/snapping
       const perp=travelAngle+side*(Math.PI/2);
       const cx=clamp(b.x+Math.cos(perp)*radius, radius+10, g.w-radius-10);
       const cy=clamp(b.y+Math.sin(perp)*radius, radius+10, g.h-radius-10);
       // pick the spin direction so the very first instant of the loop keeps
       // moving the same way the ball was already heading (no velocity jump)
       const theta0=Math.atan2(b.y-cy,b.x-cx);
       const dot=(-Math.sin(theta0))*b.vx+Math.cos(theta0)*b.vy;
       b.state.torPhase='spin';
       b.state.torTimer=0;
       b.state.torCenter={x:cx,y:cy};
       b.state.torRadius=radius;
       b.state.torDir=dot>=0?1:-1;
       b.state.torCD=g.t;
       g.spawnTornado(cx,cy,b);
       spawnFloatText(g,cx,cy-30,'🌪️ LỐC XOÁY!','#8a4fd9');
     }
   } else if(b.state.torPhase==='spin'){
     // recompute the tangential velocity fresh every frame from the ball's
     // actual current position (same self-correcting technique used by
     // Florentino Ball's dash/pickup phases) - avoids drift and never
     // fights with the normal position-integration step.
     const c=b.state.torCenter;
     const ang=Math.atan2(b.y-c.y,b.x-c.x);
     const spd=b.speedLock||Math.hypot(b.vx,b.vy);
     const w=b.state.torDir;
     b.vx=-Math.sin(ang)*spd*w;
     b.vy=Math.cos(ang)*spd*w;
     lockSpeed(b,spd);
     b.state.torTimer+=dt;
     if(b.state.torTimer>=2){
       b.state.torPhase='idle';
       b.state.torTimer=0;
     }
   }
 },
 renderExtra:(b,g,ctx)=>{
   if(b.state.torPhase==='spin' && b.state.torCenter){
     ctx.beginPath(); ctx.arc(b.state.torCenter.x,b.state.torCenter.y,b.state.torRadius,0,Math.PI*2);
     ctx.strokeStyle='rgba(138,79,217,0.35)'; ctx.lineWidth=2; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
   }
 }},

// ==================== 🌀 NHÓM ĐẶC BIỆT (SPECIAL) ====================
{id:'beyblade', name:'Beyblade Ball', group:'special', icon:'🌀', hp:100, speed:130, dmg:10, color:'#2fd4ff',
 descSimple:'Sống chết theo Động Lượng thay vì máu. Đâm trúng gây sát thương lớn nhưng tốn ĐL; định kỳ có cơ hội bùng nổ lao vào đối thủ để hồi lại ĐL.',
 desc:'Cơ chế đặc biệt: không dùng thanh máu, chỉ số quyết định sống còn là Động Lượng (100% -> 0%). Mỗi lần nhận sát thương từ bất kỳ nguồn nào hoặc va vào tường chỉ mất 1% ĐL (hiện dòng chữ -1%, không mất máu thật). Khi đâm trúng đối thủ, luôn gây đúng 10% máu tối đa đối thủ rồi tự mất 5% ĐL. Cứ 5 giây có 50% cơ hội tự bẻ hướng lao thẳng vào đối thủ (giữ nguyên tốc độ), bốc lửa xanh trong 1.4 giây và hồi lại 15% ĐL (không vượt quá 100%) nếu trúng. Hết Động Lượng thì vỡ ngay lập tức.',
 momentumBar:true,
 init:(b)=>{ b.state.momentum=100; b.state.burstCD=0; b.state.burstFireUntil=0; },
 update:(b,dt,g)=>{
   if(b.state.momentum==null) b.state.momentum=100;
   if(g.t-(b.state.burstCD||0)>5){
     b.state.burstCD=g.t;
     if(Math.random()<0.5){
       const other=g.opponentOf(b);
       if(other && b.state.momentum>0){
         const speed=b.speedLock||Math.hypot(b.vx,b.vy)||b.baseSpeed;
         const ang=Math.atan2(other.y-b.y,other.x-b.x);
         b.vx=Math.cos(ang)*speed; b.vy=Math.sin(ang)*speed;
         lockSpeed(b,speed);
         b.state.burstFireUntil=g.t+1.4;
         b.state.momentum=Math.min(100,b.state.momentum+15);
         spawnFloatText(g,b.x,b.y-40,'BURST! +15% ĐL','#2fd4ff');
         spawnParticles(g,b.x,b.y,18,{color:'#2fd4ff',type:'spark',speed:230});
       }
     }
   }
 },
 modifyIncoming:(b,attacker,dmg,g,source)=>0,
 modifyOutgoing:(b,other,dmg,g,source)=>{ if(source==='collision') return 0; return dmg; },
 onTakeDamage:(b,attacker,dmg,g)=>{
   b.state.momentum=Math.max(0,(b.state.momentum==null?100:b.state.momentum)-1);
   spawnFloatText(g,b.x,b.y-30,'-1% ĐL','#2fd4ff');
   if(b.state.momentum<=0){ b.hp=0; spawnFloatText(g,b.x,b.y-40,'HẾT ĐỘNG LƯỢNG!','#2fd4ff'); }
 },
 onWallHit:(b,g)=>{
   b.state.momentum=Math.max(0,(b.state.momentum==null?100:b.state.momentum)-1);
   spawnFloatText(g,b.x,b.y-30,'-1% ĐL','#2fd4ff');
   if(b.state.momentum<=0){ b.hp=0; spawnFloatText(g,b.x,b.y-40,'HẾT ĐỘNG LƯỢNG!','#2fd4ff'); }
 },
 onBallCollide:(b,other,g)=>{
   const mom=b.state.momentum==null?100:b.state.momentum;
   if(mom<=0) return;
   const dmg=other.maxHp*0.10;
   other.hp=Math.max(0,other.hp-dmg);
   spawnFloatText(g,other.x,other.y-30,'-'+dmg.toFixed(0),'#2fd4ff');
   spawnParticles(g,other.x,other.y,8,{color:'#2fd4ff',type:'spark',speed:200});
   b.state.momentum=Math.max(0,mom-5);
   if(b.state.momentum<=0){ b.hp=0; spawnFloatText(g,b.x,b.y-40,'HẾT ĐỘNG LƯỢNG!','#2fd4ff'); }
 },
 renderExtra:(b,g,ctx)=>{
   const mom=clamp(b.state.momentum==null?100:b.state.momentum,0,100);
   const spin=g.t*(2+9*(mom/100));
   const R=b.radius;
   // ---- blue burst fire (only while burst-charging into the opponent) ----
   if(g.t<(b.state.burstFireUntil||0)){
     ctx.save();
     const ang=Math.atan2(b.vy,b.vx);
     const backX=-Math.cos(ang), backY=-Math.sin(ang);
     for(let i=0;i<12;i++){
       const f=i/12;
       const flick=0.6+0.4*Math.sin(g.t*30+i*2.4);
       const len=R*(1.6+f*1.8)*flick;
       const spread=(i-5.5)*0.14;
       const dx=Math.cos(ang+Math.PI+spread), dy=Math.sin(ang+Math.PI+spread);
       const tx=b.x+dx*len, ty=b.y+dy*len;
       ctx.beginPath();
       ctx.moveTo(b.x+backX*R*0.3,b.y+backY*R*0.3);
       ctx.quadraticCurveTo(b.x+dx*len*0.5+ -dy*R*0.3, b.y+dy*len*0.5+dx*R*0.3, tx,ty);
       ctx.strokeStyle=`rgba(60,200,255,${(0.55*flick).toFixed(2)})`;
       ctx.lineWidth=3*flick; ctx.lineCap='round'; ctx.stroke();
     }
     const glow=ctx.createRadialGradient(b.x,b.y,R*0.3,b.x,b.y,R*2.2);
     glow.addColorStop(0,'rgba(120,230,255,0.55)');
     glow.addColorStop(1,'rgba(20,120,200,0)');
     ctx.beginPath(); ctx.arc(b.x,b.y,R*2.2,0,Math.PI*2); ctx.fillStyle=glow; ctx.fill();
     // trailing ash/embers
     for(let i=0;i<6;i++){
       const f=i/6;
       const ex=b.x+backX*R*(1.5+f*3)+rand(-6,6), ey=b.y+backY*R*(1.5+f*3)+rand(-6,6);
       ctx.beginPath(); ctx.arc(ex,ey,Math.max(0.6,2*(1-f)),0,Math.PI*2);
       ctx.fillStyle=`rgba(180,220,255,${(0.5*(1-f)).toFixed(2)})`; ctx.fill();
     }
     ctx.restore();
   }
   // ---- spinning beyblade teeth ----
   ctx.save();
   const teeth=10;
   for(let i=0;i<teeth;i++){
     const ang=spin+(i/teeth)*Math.PI*2;
     ctx.save();
     ctx.translate(b.x,b.y); ctx.rotate(ang);
     const outer=R+9, inner=R*0.7;
     const grad=ctx.createLinearGradient(inner,0,outer,0);
     grad.addColorStop(0,'#8fa3ad'); grad.addColorStop(0.5,'#dff4ff'); grad.addColorStop(1,'#2fd4ff');
     ctx.beginPath();
     ctx.moveTo(inner,-4);
     ctx.quadraticCurveTo(outer*0.75,-6,outer,0);
     ctx.quadraticCurveTo(outer*0.75,6,inner,4);
     ctx.closePath();
     ctx.fillStyle=grad; ctx.fill();
     ctx.lineWidth=1; ctx.strokeStyle='#0a3a4a'; ctx.stroke();
     // bright inner edge to sell a sharpened blade
     ctx.beginPath(); ctx.moveTo(inner,-1.5); ctx.lineTo(outer*0.92,0); ctx.lineTo(inner,1.5);
     ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1; ctx.stroke();
     ctx.restore();
   }
   ctx.restore();
   // ---- 3-segment energy arc ring ----
   ctx.save();
   ctx.shadowColor='#2fd4ff'; ctx.shadowBlur=8+6*(mom/100);
   for(let i=0;i<3;i++){
     const start=spin*1.4+i*(Math.PI*2/3);
     ctx.beginPath();
     ctx.arc(b.x,b.y,R+4,start,start+Math.PI*2/3*0.7);
     ctx.strokeStyle=`rgba(47,212,255,${(0.4+0.4*(mom/100)).toFixed(2)})`;
     ctx.lineWidth=2.4; ctx.stroke();
   }
   ctx.restore();
 }},

// ---- Werewolf Ball: human by day, wolf by night ----
{id:'werewolf', name:'Werewolf Ball', group:'special', icon:'🐺', hp:30, speed:95, dmg:0, color:'#e8b48c',
 descSimple:'Vào trận yếu ớt ở dạng người. Định kỳ hoá sói: máu và tốc độ tăng vọt, tự lao vào đối thủ và cào sát thương liên tục, rồi hoá lại người với máu đầy.',
 desc:'Bắt đầu trận ở dạng người: HP nền rất thấp (30), không gây sát thương khi va chạm. Cứ sau 12 giây, môi trường tối lại như ban đêm với một vầng trăng tròn hiện giữa map và ball hoá thành Werewolf: máu tối đa tăng 400% (gấp 5 so với mốc người), tốc độ +50%, tự hồi đầy máu rồi hồi thêm 4 HP mỗi giây, cứ mỗi giây tự đổi hướng lao thẳng về phía đối thủ, và có một vùng cào (vòng nguy hiểm) quanh thân — hễ đối thủ lọt vào vùng này sẽ liên tục lãnh 10 sát thương mỗi 0.2 giây kèm hiệu ứng cào/chém đầy đủ. Sau 12 giây ở dạng sói, trời sáng trở lại, ball hoá về người với máu đầy theo đúng mốc máu tối đa gốc, không bị trừ. Ngoài ra, ngay khi vào trận và ngay sau MỖI lần đổi dạng (người→sói hoặc sói→người), ball được khiên miễn nhiễm hoàn toàn đòn đánh kế tiếp (dùng 1 lần rồi mất, nạp lại ở lần đổi dạng sau). Mốc 12 giây chạy theo thời gian trận đấu: chỉ bắt đầu đếm khi giao tranh thực sự bắt đầu (không tính lúc hai bên đang ngắm) và đứng yên hoàn toàn khi Clock Ball ngưng đọng thời gian.',
 init:(b)=>{
   b.state.form='human';
   // NOT 0: game time already runs during the aiming phases, so anchoring the
   // 12s human timer to t=0 made the first transformation arrive early (by
   // however long both players spent aiming). It is anchored to the first
   // simulated frame instead (see update()).
   b.state.formSince=null;
   b.state.baseMaxHp=b.maxHp;
   b.state.homingAt=0;
   b.state.clawCD=0;
   b.state.nightMode=false;
   b.state.clawRange=0;
   b.state.slashes=[];
   b.state.shieldReady=true; // free damage-immunity charge right from kickoff
 },
 getMods:(b)=>({ speedMult: b.state.form==='wolf' ? 1.5 : 1 }),
 // any hit that would land while the charge is up is fully negated instead -
 // refreshed once at match start and again after every single transform
 modifyIncoming:(b,attacker,dmg,g,source)=>{
   if(b.state.shieldReady && dmg>0){
     b.state.shieldReady=false;
     b.state.shieldPopAt=g.t;
     spawnFloatText(g,b.x,b.y-40,'MIỄN THƯƠNG!','#7dd3fc');
     spawnParticles(g,b.x,b.y,20,{color:'#7dd3fc',type:'glow',speed:170,life:0.5});
     return 0;
   }
   return dmg;
 },
 update:(b,dt,g)=>{
   if(b.state.formSince==null) b.state.formSince=g.t;
   const elapsed=g.t-b.state.formSince;
   if(b.state.form==='human' && elapsed>=WEREWOLF_FORM_SECONDS){
     b.state.form='wolf';
     b.state.formSince=g.t;
     b.state.nightMode=true;
     b.state.shieldReady=true;
     b.maxHp=b.state.baseMaxHp*5;
     b.hp=b.maxHp;
     spawnFloatText(g,b.x,b.y-40,'BIẾN HÌNH!','#8b5cf6');
     spawnParticles(g,b.x,b.y,30,{color:'#8b5cf6',type:'glow',speed:210,life:0.9});
     spawnParticles(g,b.x,b.y,16,{color:'#ffcf5c',type:'spark',speed:260,life:0.5});
     g.triggerShake(6,0.22);
   } else if(b.state.form==='wolf' && elapsed>=WEREWOLF_FORM_SECONDS){
     b.state.form='human';
     b.state.formSince=g.t;
     b.state.nightMode=false;
     b.state.shieldReady=true;
     b.maxHp=b.state.baseMaxHp;
     b.hp=b.maxHp;
     b.state.slashes=[];
     spawnFloatText(g,b.x,b.y-40,'TRỞ LẠI NGƯỜI','#c9a27a');
     spawnParticles(g,b.x,b.y,16,{color:'#c9a27a',type:'dust',speed:110});
   }
   b.bodyColorOverride = b.state.form==='wolf' ? '#4b3626' : null;
   // age out old slash-swipe animations regardless of form
   b.state.slashes=(b.state.slashes||[]).filter(s=>g.t-s.born<0.32);
   if(b.state.form!=='wolf') return;
   const other=g.opponentOf(b);
   if(!other || !other.alive) return;
   // every 1s: re-lock heading straight at the opponent's current spot -
   // relock to the UNBOOSTED base speed, getMods()'s speedMult already
   // multiplies it back up to the real +50% every physics step, so this
   // never compounds into a runaway speed over multiple pulses
   if(g.t-(b.state.homingAt||0)>=1){
     b.state.homingAt=g.t;
     const spd=b.speedLock||Math.hypot(b.vx,b.vy)||b.baseSpeed||95;
     const ang=Math.atan2(other.y-b.y,other.x-b.x);
     b.vx=Math.cos(ang)*spd; b.vy=Math.sin(ang)*spd;
     lockSpeed(b,spd);
   }
   // claw zone: a melee AoE around the wolf, not just a point hit - the
   // radius is tracked in state so renderExtra can draw the exact same
   // zone the hitbox uses
   const range=b.radius+other.radius+22;
   b.state.clawRange=range;
   if(dist(b.x,b.y,other.x,other.y)<range && g.t>=(b.state.clawCD||0)){
     b.state.clawCD=g.t+0.2;
     b.state.clawFlashUntil=g.t+0.18;
     other.hp=Math.max(0,other.hp-10);
     b.state.slashes.push({born:g.t, ang:Math.atan2(other.y-b.y,other.x-b.x)});
     spawnFloatText(g,other.x,other.y-30,'-10','#ef4444');
     spawnParticles(g,other.x,other.y,10,{color:'#ef4444',type:'spark',speed:230});
     spawnParticles(g,b.x,b.y,6,{color:'#8b5cf6',type:'glow',speed:70,life:0.28});
     g.triggerShake(2.4,0.1);
   }
   // passive regen while transformed
   b.hp=Math.min(b.maxHp,b.hp+4*dt);
 },
 renderExtra:(b,g,ctx)=>{
   const R=b.radius;
   const spd=Math.hypot(b.vx,b.vy);
   const ang=spd>1?Math.atan2(b.vy,b.vx):(b.state.lastAng||0);
   b.state.lastAng=ang;

   // shield-charge indicator: a thin pulsing ring worn in EITHER form
   // whenever the free damage-immunity charge is still up, so it's obvious
   // at a glance when it's been spent (ring disappears the instant it pops)
   if(b.state.shieldReady){
     ctx.save();
     const sp=0.55+0.45*Math.sin(g.t*5);
     ctx.shadowColor='#7dd3fc'; ctx.shadowBlur=8;
     ctx.strokeStyle=`rgba(125,211,252,${(0.55+0.35*sp).toFixed(2)})`;
     ctx.lineWidth=2;
     ctx.beginPath(); ctx.arc(b.x,b.y,R+5+sp*1.5,0,Math.PI*2); ctx.stroke();
     ctx.restore();
   }
   const shieldPopAge=g.t-(b.state.shieldPopAt||-99);
   if(shieldPopAge<0.35){
     ctx.save();
     const t=shieldPopAge/0.35;
     ctx.globalAlpha=1-t;
     ctx.strokeStyle='#7dd3fc'; ctx.lineWidth=2.4;
     ctx.beginPath(); ctx.arc(b.x,b.y,R+4+t*22,0,Math.PI*2); ctx.stroke();
     ctx.restore();
   }

   if(b.state.form!=='wolf'){
     // ---- human form: simple tuft of hair + eyes ----
     ctx.save();
     ctx.fillStyle='#3b2a1e';
     ctx.translate(b.x,b.y-R*0.72);
     for(let i=-2;i<=2;i++){
       ctx.beginPath();
       ctx.moveTo(i*3.2,4);
       ctx.quadraticCurveTo(i*3.2+1.5,-5-Math.abs(i)*0.6,i*3.2+(i>=0?4.5:-4.5),1.5);
       ctx.closePath(); ctx.fill();
     }
     ctx.restore();
     ctx.save();
     ctx.fillStyle='#3b2a1e';
     ctx.beginPath(); ctx.arc(b.x-R*0.28,b.y-R*0.05,1.6,0,Math.PI*2); ctx.fill();
     ctx.beginPath(); ctx.arc(b.x+R*0.28,b.y-R*0.05,1.6,0,Math.PI*2); ctx.fill();
     ctx.restore();
     return;
   }
   // ---- werewolf form ----
   const range=b.state.clawRange||(R+40);
   const clawFlash=g.t<(b.state.clawFlashUntil||0);

   // 1) prowling danger-zone ring around the wolf, marking its claw range -
   // slow rotating dashes + a soft pulsing fill so it reads as a real zone
   ctx.save();
   const pulse=0.5+0.5*Math.sin(g.t*3.2);
   const zoneGlow=ctx.createRadialGradient(b.x,b.y,R*0.6,b.x,b.y,range);
   zoneGlow.addColorStop(0,'rgba(139,92,246,0)');
   zoneGlow.addColorStop(0.75,`rgba(139,92,246,${(0.05+0.05*pulse).toFixed(2)})`);
   zoneGlow.addColorStop(1,`rgba(220,60,60,${(0.14+0.08*pulse).toFixed(2)})`);
   ctx.beginPath(); ctx.arc(b.x,b.y,range,0,Math.PI*2); ctx.fillStyle=zoneGlow; ctx.fill();
   ctx.setLineDash([8,7]); ctx.lineDashOffset=-g.t*26;
   ctx.strokeStyle=`rgba(220,60,60,${(0.45+0.25*pulse).toFixed(2)})`;
   ctx.lineWidth=1.6;
   ctx.beginPath(); ctx.arc(b.x,b.y,range,0,Math.PI*2); ctx.stroke();
   ctx.setLineDash([]);
   ctx.restore();

   // 2) speed-blur streaks trailing behind, to sell the +50% speed boost
   if(spd>40){
     ctx.save();
     const back=ang+Math.PI;
     for(let i=0;i<3;i++){
       const off=(i-1)*R*0.4;
       const len=R*(1.1+i*0.35);
       const px=b.x+Math.cos(back)*R*0.4+Math.cos(back+Math.PI/2)*off;
       const py=b.y+Math.sin(back)*R*0.4+Math.sin(back+Math.PI/2)*off;
       const tx=px+Math.cos(back)*len, ty=py+Math.sin(back)*len;
       ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(tx,ty);
       ctx.strokeStyle=`rgba(75,54,38,${0.35-i*0.09})`;
       ctx.lineWidth=3-i*0.6; ctx.lineCap='round'; ctx.stroke();
     }
     ctx.restore();
   }

   // 3) ears
   ctx.save();
   ctx.fillStyle='#3a2a20';
   [-1,1].forEach(side=>{
     ctx.beginPath();
     ctx.moveTo(b.x+side*R*0.55,b.y-R*0.75);
     ctx.lineTo(b.x+side*R*0.95,b.y-R*1.35);
     ctx.lineTo(b.x+side*R*0.25,b.y-R*0.95);
     ctx.closePath(); ctx.fill();
   });
   ctx.restore();

   // 4) snout + glowing eyes, facing movement direction, flushed brighter
   //    for an instant on every claw tick
   ctx.save();
   ctx.translate(b.x,b.y); ctx.rotate(ang);
   const snoutGrad=ctx.createLinearGradient(R*0.25,0,R*1.15,0);
   snoutGrad.addColorStop(0,'#5b4636'); snoutGrad.addColorStop(1,'#2e2119');
   ctx.beginPath();
   ctx.moveTo(R*0.25,-R*0.32);
   ctx.lineTo(R*1.15,-R*0.08);
   ctx.lineTo(R*1.15,R*0.08);
   ctx.lineTo(R*0.25,R*0.32);
   ctx.closePath();
   ctx.fillStyle=snoutGrad; ctx.fill();
   ctx.beginPath(); ctx.arc(R*1.08,0,2.4,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
   ctx.shadowColor='#ffcf5c'; ctx.shadowBlur=clawFlash?12:6; ctx.fillStyle='#ffcf5c';
   ctx.beginPath(); ctx.ellipse(R*0.42,-R*0.22,2.6,1.6,0,0,Math.PI*2); ctx.fill();
   ctx.beginPath(); ctx.ellipse(R*0.42,R*0.22,2.6,1.6,0,0,Math.PI*2); ctx.fill();
   ctx.restore();

   // 5) two forward-facing slashing claws, aimed the way the wolf is
   //    heading - flare bright + swing wider for an instant on each tick
   ctx.save();
   ctx.translate(b.x,b.y); ctx.rotate(ang);
   [-1,1].forEach(side=>{
     ctx.save();
     ctx.translate(R*0.55,side*R*0.55);
     ctx.rotate(side*0.5 + (clawFlash? side*0.6*Math.sin(g.t*46):0));
     for(let i=-1;i<=1;i++){
       ctx.beginPath();
       ctx.moveTo(0,i*4);
       ctx.quadraticCurveTo(R*0.55,i*4-2,R*0.85,i*4+2);
       ctx.lineWidth=clawFlash?3.2:2.4; ctx.lineCap='round';
       ctx.strokeStyle= clawFlash? '#ffffff' : '#e7e3da';
       if(clawFlash){ ctx.shadowColor='#ffffff'; ctx.shadowBlur=8; }
       ctx.stroke();
     }
     ctx.restore();
   });
   ctx.restore();

   // 6) active slash-swipe animations - big fading crescent arcs bursting
   //    outward wherever a claw tick actually landed, for a proper "attack"
   //    beat instead of a static pose
   for(const s of (b.state.slashes||[])){
     const age=g.t-s.born, life=0.32, t=clamp(age/life,0,1);
     if(t>=1) continue;
     const grow=1-Math.pow(1-t,2);
     const alpha=1-t;
     const cx=b.x+Math.cos(s.ang)*range*0.55, cy=b.y+Math.sin(s.ang)*range*0.55;
     ctx.save();
     ctx.translate(cx,cy); ctx.rotate(s.ang);
     ctx.globalAlpha=alpha;
     for(let i=0;i<3;i++){
       const rr=(range*0.32)*(0.7+i*0.22)*(0.6+grow*0.6);
       ctx.beginPath();
       ctx.arc(0,0,rr,-0.7,0.7);
       ctx.strokeStyle= i===1?'#ffffff':'#ef4444';
       ctx.lineWidth=3.4-i*0.7; ctx.lineCap='round';
       ctx.shadowColor='#ef4444'; ctx.shadowBlur=10;
       ctx.stroke();
     }
     ctx.restore();
   }
 }},

{id:'clock', name:'Clock Ball', group:'special', icon:'⏰', hp:95, speed:100, dmg:8, color:'#c9a227', collidePriority:1,
 descSimple:'Cứ 2 lần va chạm là NGƯNG ĐỌNG THỜI GIAN toàn trận trong 1 giây: mọi thứ (kể cả đồng hồ đếm giờ của mọi kỹ năng) đứng yên, đồng hồ khổng lồ xoay giữa màn hình; chỉ Clock Ball tung ~20 cú đấm liên hoàn vào đối thủ, dứt đòn hất văng.',
 desc:'Thân mang mặt đồng hồ với kim giờ/kim phút quay chậm đều đặn suốt trận. Cứ đúng mỗi 2 lần va chạm với đối thủ, lần va thứ 2 sẽ kích hoạt \"Ngưng Đọng Thời Gian\" trong 1 giây: TOÀN BỘ dòng thời gian của trận đấu dừng lại — mọi quả bóng, đạn, bẫy, bom, tàu, lốc xoáy, tường di động và cả các bộ đếm hồi chiêu / thời gian hiệu lực của mọi kỹ năng (ví dụ chu kỳ hoá sói của Werewolf Ball) đều đứng yên tuyệt đối, rồi chạy tiếp đúng từ chỗ đã dừng sau 1 giây — không bị hụt, không bị cộng dồn trễ. Trên màn hình hiện một chiếc đồng hồ khổng lồ xoay tròn cùng hiệu ứng đảo màu để báo hiệu thời gian đang ngừng. Trong khoảng đó chỉ Clock Ball hoạt động: bản thân miễn toàn bộ sát thương và mọi sát thương gây ra được nhân đôi; Clock Ball đứng yên tại chỗ và tung liên tục khoảng 20 cú đấm liên hoàn (\"muda muda\") vào đối thủ, kèm vệt mờ, tia va chạm và đường tập trung quanh nạn nhân. Đối thủ bị đóng băng đứng yên tuyệt đối VÀ mất hoàn toàn năng lực đặc biệt (kỹ năng, hiệu ứng bị động), xuyên thủng mọi miễn nhiễm khống chế đang có sẵn (ví dụ Florentino Ball đang lướt/múa vẫn bị khoá cứng). Mỗi cú chỉ gây một lượng sát thương rất nhỏ. Ngay khoảnh khắc thời gian chạy lại, một cú đấm chốt hạ (\"ORA!\") hất văng đối thủ ra xa kèm thêm một đòn sát thương vừa phải — bất chấp mọi miễn nhiễm đẩy lùi; lực hất chỉ là một xung tạm thời rồi giảm dần về tốc độ vốn có của đối thủ, không làm đối thủ chạy nhanh vĩnh viễn.',
 init:(b)=>{
   b.state.clockHitCount=0;     // counts ball-ball collisions since the last proc; fires on the 2nd
   b.state.clockTriggerFx=-99;  // effect-clock time of the last trigger (drives the trigger ring)
   b.state.barrageTarget=null;  // opponent locked in the muda-muda barrage
   b.state.barrageNext=0;       // time-stop-elapsed at which the next punch is thrown
   b.state.barragePunches=[];
   b.state.barrageCount=0;      // punches thrown in the current barrage (drives fist side + damage-number batching)
   b.state.barrageAcc=0;        // damage accumulated since the last floating number
   b.state.barrageFinish=null;  // finishing-blow animation record
 },
 // The time-stop itself lives in the engine (GameEngine.startTimeStop): game
 // time is frozen for everyone and only the hooks below keep running.
 modifyIncoming:(b,attacker,dmg,g,source)=>{ if(g.isTimeStopOwner(b)) return 0; return dmg; },
 modifyOutgoing:(b,other,dmg,g,source)=>{ if(g.isTimeStopOwner(b)) return dmg*2; return dmg; },
 onBallCollide:(b,other,g)=>{
   if(g.timeStop) return; // never re-count / re-trigger while time is already stopped
   b.state.clockHitCount=(b.state.clockHitCount||0)+1;
   if(b.state.clockHitCount<2) return; // deterministic: fires on every 2nd collision, no RNG
   b.state.clockHitCount=0;
   g.startTimeStop(b,other,CLOCK_STOP_DURATION);
 },
 onTimeStopStart:(b,other,g,ts)=>{
   b.state.clockTriggerFx=g.fxT;
   b.state.barrageTarget=other;
   b.state.barrageNext=0;      // first punch lands on the very first stopped frame
   b.state.barragePunches=[];
   b.state.barrageCount=0;
   b.state.barrageAcc=0;
   b.state.barrageFinish=null;
   spawnFloatText(g,other.x,other.y-40,'ĐÓNG BĂNG!','#7dd3fc');
   spawnParticles(g,other.x,other.y,14,{color:'#7dd3fc',type:'glow',speed:80,life:ts.dur+0.1});
   spawnFloatText(g,b.x,b.y-40,'⏰ THE WORLD!','#38bdf8');
   spawnParticles(g,b.x,b.y,24,{color:'#38bdf8',type:'glow',speed:200,life:0.5});
   spawnParticles(g,b.x,b.y,10,{color:'#ffffff',type:'spark',speed:260,life:0.35});
   g.triggerShake(4,0.15);
 },
 // Rapid "muda muda" ticks: ~20 tiny punches across the stop. Punch timing is
 // driven by the stop's own elapsed time (a fixed step, so the rate can't drift
 // with frame timing) and capped per frame so a lag spike can't dump a burst.
 onTimeStopTick:(b,target,g,ts)=>{
   if(!target.alive) return;
   let guard=0;
   while(b.state.barrageNext<=ts.elapsed && b.state.barrageCount<CLOCK_PUNCH_MAX && guard++<3){
     b.state.barrageNext+=CLOCK_PUNCH_INTERVAL;
     let punchDmg=dmgFor(b,CLOCK_PUNCH_BASE_DMG);
     punchDmg=b.def.modifyOutgoing(b,target,punchDmg,g,'barrage'); // applies the x2 time-stop multiplier
     target.hp=Math.max(0,target.hp-punchDmg);
     b.state.barrageAcc=(b.state.barrageAcc||0)+punchDmg;
     b.state.barrageCount=(b.state.barrageCount||0)+1;
     // one floating number per 4 punches (sum of them) instead of 20 tiny "-1"s
     if(b.state.barrageCount%4===0){
       spawnFloatText(g,target.x+rand(-16,16),target.y-30+rand(-10,6),'-'+Math.max(1,Math.round(b.state.barrageAcc)),'#ffe066');
       b.state.barrageAcc=0;
     }
     // where on the victim this fist lands + which hand throws it
     const rr=target.radius*0.5*Math.sqrt(Math.random()), aa=rand(0,Math.PI*2);
     b.state.barragePunches=(b.state.barragePunches||[]).filter(p=>g.fxT-p.born<CLOCK_PUNCH_LIFE);
     b.state.barragePunches.push({
       born:g.fxT,
       side:(b.state.barrageCount%2===0)?1:-1,       // alternate left/right hand
       ox:Math.cos(aa)*rr, oy:Math.sin(aa)*rr,
       ang:rand(-0.35,0.35)                          // slight fist tilt
     });
     spawnParticles(g,target.x+Math.cos(aa)*rr,target.y+Math.sin(aa)*rr,3,{color:'#ffffff',type:'spark',speed:210,life:0.16});
     g.triggerShake(0.8,0.05);
   }
 },
 // time resumes: one finishing blow, knocked away + a solid hit, bypassing any
 // immunity on purpose (ignoreImmune=true). Runs even if the Clock Ball got
 // powerless in the meantime - it belongs to the stop, not to the ball's kit.
 onTimeStopEnd:(b,target,g,ts)=>{
   // flush any damage number still waiting to be shown
   if((b.state.barrageAcc||0)>=1 && target.alive){
     spawnFloatText(g,target.x+rand(-16,16),target.y-30,'-'+Math.round(b.state.barrageAcc),'#ffe066');
   }
   b.state.barrageAcc=0;
   if(!target.alive || target.hp<=0) return; // already dead: the engine ends the match this frame
   const ang=Math.atan2(target.y-b.y,target.x-b.x)||rand(0,Math.PI*2);
   const finishDmg=dmgFor(b,CLOCK_FINISH_BASE_DMG);
   target.hp=Math.max(0,target.hp-finishDmg);
   // a temporary shove that fades away on its own (see applyImpulse): the victim's
   // own velocity / speed lock are never touched, so it can't end up permanently
   // faster - not even for kits that re-lock their speed (Ghost, Shooting, Axe...)
   applyImpulse(target,ang,CLOCK_FINISH_KNOCKBACK);
   b.state.barrageFinish={born:g.fxT, dir:ang, tx:target.x, ty:target.y, bx:b.x, by:b.y};
   spawnFloatText(g,target.x,target.y-44,'-'+finishDmg.toFixed(0),'#ef4444');
   spawnFloatText(g,target.x,target.y-62,'ORA!','#38bdf8');
   spawnParticles(g,target.x,target.y,22,{color:'#ffffff',type:'spark',speed:330,life:0.4});
   spawnParticles(g,target.x,target.y,10,{color:'#38bdf8',type:'glow',speed:180,life:0.4});
   g.triggerShake(5,0.18);
 },
 renderExtra:(b,g,ctx)=>{
   const R=b.radius;
   const inStop=g.isTimeStopOwner(b);
   ctx.save();
   if(inStop){ ctx.shadowColor='#38bdf8'; ctx.shadowBlur=10; }
   ctx.strokeStyle= inStop? '#38bdf8' : 'rgba(255,255,255,0.55)';
   ctx.lineWidth=1.6;
   ctx.beginPath(); ctx.arc(b.x,b.y,R*0.68,0,Math.PI*2); ctx.stroke();
   for(let i=0;i<12;i++){
     const a2=i/12*Math.PI*2;
     ctx.beginPath();
     ctx.moveTo(b.x+Math.cos(a2)*R*0.68,b.y+Math.sin(a2)*R*0.68);
     ctx.lineTo(b.x+Math.cos(a2)*R*0.58,b.y+Math.sin(a2)*R*0.58);
     ctx.stroke();
   }
   // idle: hands drift slowly with game time. During its own stop the Clock
   // Ball is the only thing still moving through time, so its hands spin fast
   // on the effect clock (game time itself is frozen right now).
   const minAng = inStop ? g.fxT*16 : g.t*1.6;
   const hourAng = inStop ? g.fxT*3.2 : g.t*0.4;
   ctx.strokeStyle= inStop? '#ffffff' : 'rgba(255,255,255,0.75)';
   ctx.lineWidth= inStop? 2.6 : 1.6;
   ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x+Math.cos(minAng)*R*0.5,b.y+Math.sin(minAng)*R*0.5); ctx.stroke();
   ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x+Math.cos(hourAng)*R*0.32,b.y+Math.sin(hourAng)*R*0.32); ctx.stroke();
   ctx.restore();
   const age=g.fxT-(b.state.clockTriggerFx||-99);
   if(age<0.4){
     const t=age/0.4;
     ctx.save();
     ctx.globalAlpha=1-t;
     ctx.strokeStyle='#38bdf8'; ctx.lineWidth=2.4;
     ctx.beginPath(); ctx.arc(b.x,b.y,R*0.8+t*38,0,Math.PI*2); ctx.stroke();
     ctx.restore();
   }
 },
 // drawn in a second pass ABOVE both ball bodies: the muda-muda fists, focus
 // lines around the victim, the time-left ring and the finishing \"ORA\" punch.
 // All animation runs on the effect clock (g.fxT) - game time is frozen here.
 renderTop:(b,g,ctx)=>{
   const ts=(g.timeStop && g.timeStop.owner===b) ? g.timeStop : null;
   const active=!!ts;
   const punches=(b.state.barragePunches||[]).filter(p=>g.fxT-p.born<CLOCK_PUNCH_LIFE);
   const fin=b.state.barrageFinish;
   const finAge=fin? g.fxT-fin.born : 99;
   if(!active && !punches.length && finAge>=CLOCK_FINISH_ANIM) return;
   const R=b.radius;
   const target=b.state.barrageTarget;
   const hr=(n)=>{ const v=Math.sin(n*127.1+311.7)*43758.5453; return v-Math.floor(v); };
   ctx.save();
   ctx.lineCap='round'; ctx.lineJoin='round';

   if(active){
     // time-left ring, trembling slightly like the body is straining
     const rem=clamp(1-ts.elapsed/ts.dur,0,1);
     const jx=(hr(Math.floor(g.fxT*40))-0.5)*2.5, jy=(hr(Math.floor(g.fxT*40)+9)-0.5)*2.5;
     ctx.shadowColor='#38bdf8'; ctx.shadowBlur=12;
     ctx.strokeStyle='#38bdf8'; ctx.lineWidth=3;
     ctx.beginPath(); ctx.arc(b.x+jx,b.y+jy,R+8,-Math.PI/2,-Math.PI/2+rem*Math.PI*2); ctx.stroke();
     ctx.shadowBlur=0;

     // manga-style focus lines radiating off the frozen victim
     if(target && target.alive){
       const seed=Math.floor(g.fxT*26);
       ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=1.5;
       for(let i=0;i<16;i++){
         const a=hr(seed*17+i)*Math.PI*2;
         const r0=target.radius*1.15+hr(seed*5+i)*8;
         const r1=r0+10+hr(seed*11+i)*18;
         ctx.beginPath();
         ctx.moveTo(target.x+Math.cos(a)*r0,target.y+Math.sin(a)*r0);
         ctx.lineTo(target.x+Math.cos(a)*r1,target.y+Math.sin(a)*r1);
         ctx.stroke();
       }
     }

     // comic \"MUDA\" lettering that jitters above the puncher
     const words=['MUDA!','MUDA MUDA!','MUDA!!!'];
     const w=words[Math.floor(g.fxT*14)%3];
     ctx.save();
     ctx.translate(b.x+jx*2,b.y+R+22+jy*2); // below the ball so it doesn't cover the floating 'THE WORLD!' text
     ctx.rotate(-0.12+(hr(Math.floor(g.fxT*14))-0.5)*0.2);
     ctx.font='italic 900 '+(15+(Math.floor(g.fxT*28)%2)*3)+'px \"Arial Black\",Impact,sans-serif';
     ctx.textAlign='center'; ctx.textBaseline='middle';
     ctx.lineWidth=4; ctx.strokeStyle='#0c4a6e'; ctx.strokeText(w,0,0);
     ctx.fillStyle='#e0f2fe'; ctx.fillText(w,0,0);
     ctx.restore();
   }

   // ---- the flurry of fists -------------------------------------------------
   if(target){
     const dir=Math.atan2(target.y-b.y,target.x-b.x);
     const px=Math.cos(dir+Math.PI/2), py=Math.sin(dir+Math.PI/2);
     for(const p of punches){
       const t=clamp((g.fxT-p.born)/CLOCK_PUNCH_LIFE,0,1);
       // snap out fast (ease-out) for the first 40%, then pull back
       const ext = t<0.4 ? 1-Math.pow(1-t/0.4,2) : 1-(t-0.4)/0.6;
       const sx=b.x+Math.cos(dir)*R*0.25+px*p.side*R*0.55;
       const sy=b.y+Math.sin(dir)*R*0.25+py*p.side*R*0.55;
       const ex=target.x+p.ox-Math.cos(dir)*target.radius*0.1;
       const ey=target.y+p.oy-Math.sin(dir)*target.radius*0.1;
       // afterimages (motion trail) - older ghosts fainter and further back
       for(let k=3;k>=0;k--){
         const e2=Math.max(0,ext-k*0.14);
         const fx=sx+(ex-sx)*e2, fy=sy+(ey-sy)*e2;
         drawClockFist(ctx,sx,sy,fx,fy,dir+p.ang,R*0.4,k===0?1:0.28/k,k===0);
       }
       // impact burst where the fist lands (peaks just after full extension)
       if(t>0.3 && t<1){
         const i=(t-0.3)/0.7;
         ctx.save();
         ctx.globalAlpha=1-i;
         ctx.strokeStyle='#ffe066'; ctx.lineWidth=2;
         const cx=ex, cy=ey, r0=3+i*6, r1=8+i*18;
         for(let s2=0;s2<6;s2++){
           const a=s2/6*Math.PI*2+p.born*9;
           ctx.beginPath();
           ctx.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0);
           ctx.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);
           ctx.stroke();
         }
         ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5;
         ctx.beginPath(); ctx.arc(cx,cy,4+i*14,0,Math.PI*2); ctx.stroke();
         ctx.restore();
       }
     }
   }

   // ---- finishing blow: one big fist + shockwave ---------------------------
   if(fin && finAge<CLOCK_FINISH_ANIM){
     const t=finAge/CLOCK_FINISH_ANIM;
     const ext=t<0.35? 1-Math.pow(1-t/0.35,3) : 1-(t-0.35)/0.65*0.6;
     const sx=fin.bx+Math.cos(fin.dir)*R*0.3, sy=fin.by+Math.sin(fin.dir)*R*0.3;
     const ex=fin.tx-Math.cos(fin.dir)*R*0.2, ey=fin.ty-Math.sin(fin.dir)*R*0.2;
     const fx=sx+(ex-sx)*ext, fy=sy+(ey-sy)*ext;
     for(let k=4;k>=0;k--){
       const e2=Math.max(0,ext-k*0.12);
       drawClockFist(ctx,sx,sy,sx+(ex-sx)*e2,sy+(ey-sy)*e2,fin.dir,R*0.62,k===0?1:0.3/k,k===0);
     }
     if(t>0.25){
       const i=(t-0.25)/0.75;
       ctx.globalAlpha=1-i;
       ctx.strokeStyle='#ffffff'; ctx.lineWidth=4*(1-i)+1;
       ctx.beginPath(); ctx.arc(ex,ey,10+i*46,0,Math.PI*2); ctx.stroke();
       ctx.strokeStyle='#38bdf8'; ctx.lineWidth=2.5;
       ctx.beginPath(); ctx.arc(ex,ey,6+i*30,0,Math.PI*2); ctx.stroke();
       ctx.strokeStyle='#ffe066'; ctx.lineWidth=3;
       for(let s2=0;s2<10;s2++){
         const a=s2/10*Math.PI*2;
         ctx.beginPath();
         ctx.moveTo(ex+Math.cos(a)*(12+i*10),ey+Math.sin(a)*(12+i*10));
         ctx.lineTo(ex+Math.cos(a)*(22+i*36),ey+Math.sin(a)*(22+i*36));
         ctx.stroke();
       }
     }
   }
   ctx.restore();
 }},

{id:'leaf', name:'Leaf Ball', group:'special', icon:'🍃', hp:90, speed:100, dmg:7, color:'#6fbf3f',
 descSimple:'Định kỳ hoặc khi va chạm sẽ tan thành lốc lá bay tới điểm ngẫu nhiên, rải lá gây sát thương dọc đường; lá còn nằm lại thêm một lúc.',
 desc:'Cứ mỗi 3 giây, hoặc ngay khi va chạm với đối thủ, Leaf Ball tan thành một cơn lốc lá (thân mờ đi) và bay thẳng tới một vị trí ngẫu nhiên trên map trong tối đa 1.4 giây. Trong lúc bay, liên tục rải lại những chiếc lá dọc đường đi — mỗi chiếc lá là một vùng sát thương nhỏ, gây 5 sát thương mỗi lần chạm và còn tồn tại thêm khoảng 1.4 giây sau khi rơi xuống, tức là vẫn nằm lại một lúc sau khi ball đã bay xong và hiện nguyên hình trở lại. Khi tới nơi (hoặc hết thời gian bay), ball tái hợp thành hình tròn bình thường tại điểm đến và bắt đầu đếm lại 3 giây cho lượt phân tán kế tiếp.',
 init:(b)=>{ b.state.leafPhase='idle'; b.state.leafCD=0; b.state.leafTimer=0; b.state.leafTarget=null; b.state.leafDropCD=0; b.bodyAlphaOverride=1; },
 onBallCollide:(b,other,g)=>{ if(b.state.leafPhase==='idle') startLeafScatter(b,g); },
 update:(b,dt,g)=>{
   if(b.state.leafPhase==='idle'){
     if(g.t-(b.state.leafCD||0)>=3) startLeafScatter(b,g);
     return;
   }
   const tgt=b.state.leafTarget;
   const d=dist(b.x,b.y,tgt.x,tgt.y);
   if(d>12 && b.state.leafTimer<1.4){
     const spd=b.speedLock||Math.hypot(b.vx,b.vy)||b.baseSpeed||100;
     const ang=Math.atan2(tgt.y-b.y,tgt.x-b.x);
     b.vx=Math.cos(ang)*spd; b.vy=Math.sin(ang)*spd;
     lockSpeed(b,spd);
   }
   b.state.leafTimer+=dt;
   if(g.t-(b.state.leafDropCD||0)>=0.1){
     b.state.leafDropCD=g.t;
     spawnHazard(g,{type:'leafpatch', x:b.x, y:b.y, r:15, until:g.t+1.4, owner:b, dmg:5});
     spawnParticles(g,b.x,b.y,3,{color:'#8fd95f',type:'dust',speed:50,life:0.4});
   }
   if(d<=12 || b.state.leafTimer>=1.4){
     b.state.leafPhase='idle';
     b.state.leafCD=g.t;
     b.bodyAlphaOverride=1;
     spawnParticles(g,b.x,b.y,14,{color:'#6fbf3f',type:'glow',speed:120,life:0.4});
   }
 },
 renderExtra:(b,g,ctx)=>{
   if(b.state.leafPhase!=='scatter') return;
   const R=b.radius;
   const ang=Math.atan2(b.vy,b.vx);
   for(let i=0;i<5;i++){
     const off=g.t*6+i*(Math.PI*2/5);
     const rr=R*0.9+Math.sin(g.t*4+i)*4;
     const lx=b.x+Math.cos(off)*rr, ly=b.y+Math.sin(off)*rr;
     ctx.save();
     ctx.translate(lx,ly); ctx.rotate(off+ang);
     ctx.fillStyle= i%2? '#6fbf3f':'#8fd95f';
     ctx.beginPath();
     ctx.moveTo(0,-5); ctx.quadraticCurveTo(4,0,0,5); ctx.quadraticCurveTo(-4,0,0,-5);
     ctx.closePath(); ctx.fill();
     ctx.restore();
   }
 }},
];

// Every ball keeps the same plain circle silhouette - identity now comes
// from each ball's own accent color (see `color:` on each definition above)
// plus small decorative details (spikes, a fuse, orbiting weapons...) drawn
// by renderExtra, not from changing the base body shape.
BALL_TYPES.forEach((bt)=>{ bt.shape='circle'; });

function dmgFor(ball, base){ return base * (ball.dmg/7); }

// ---- Werewolf Ball form cycle -------------------------------------------
const WEREWOLF_FORM_SECONDS=12;    // seconds spent in EACH form (human -> wolf -> human ...), in game time

// ---- Clock Ball time-stop barrage tuning --------------------------------
// (before: 14 punches x dmgFor(1.6) x2 = ~51 dmg + finisher dmgFor(15) = ~17
//  -> ~68 total.  now: ~20 punches x dmgFor(0.45) x2 = ~21 + finisher
//  dmgFor(8) = ~9  -> ~30 total.)
const CLOCK_STOP_DURATION=1.0;     // seconds of REAL time the whole world is stopped for
const CLOCK_PUNCH_MAX=20;          // hard cap on punches per stop
const CLOCK_FINISH_KNOCKBACK=470;  // initial shove of the finishing "ORA" blow (fades out by itself)
const CLOCK_PUNCH_INTERVAL=0.05;   // seconds between punches (~20 per 1s stop)
const CLOCK_PUNCH_BASE_DMG=0.45;   // per-punch base damage (before the x2 time-stop bonus)
const CLOCK_FINISH_BASE_DMG=8;     // finishing "ORA" blow base damage
const CLOCK_PUNCH_LIFE=0.16;       // lifetime of one punch animation
const CLOCK_FINISH_ANIM=0.32;      // lifetime of the finishing punch animation

// A fist on an arm: (sx,sy) = shoulder, (fx,fy) = fist centre, dir = punch heading.
// Cyan "stand" energy arm + a white/cyan fist with 4 knuckle dots.
function drawClockFist(ctx,sx,sy,fx,fy,dir,r,alpha,withArm){
  ctx.save();
  ctx.globalAlpha=alpha;
  if(withArm){
    ctx.strokeStyle='rgba(56,189,248,0.55)'; ctx.lineWidth=r*0.9;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(fx,fy); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=r*0.3;
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(fx,fy); ctx.stroke();
  }
  ctx.shadowColor='#38bdf8'; ctx.shadowBlur=withArm?10:0;
  const g=ctx.createRadialGradient(fx-r*0.3,fy-r*0.3,r*0.1,fx,fy,r);
  g.addColorStop(0,'#ffffff'); g.addColorStop(1,'#7dd3fc');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.arc(fx,fy,r,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  ctx.lineWidth=Math.max(1.2,r*0.14); ctx.strokeStyle='#0369a1';
  ctx.beginPath(); ctx.arc(fx,fy,r,0,Math.PI*2); ctx.stroke();
  if(withArm){
    // knuckles across the front of the fist
    const ux=Math.cos(dir), uy=Math.sin(dir), vx=-uy, vy=ux;
    ctx.fillStyle='#0369a1';
    for(let i=-1.5;i<=1.5;i++){
      ctx.beginPath();
      ctx.arc(fx+ux*r*0.55+vx*i*r*0.42, fy+uy*r*0.55+vy*i*r*0.42, r*0.13, 0, Math.PI*2);
      ctx.fill();
    }
  }
  ctx.restore();
}
