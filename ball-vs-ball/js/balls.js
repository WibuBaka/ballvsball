const GROUP_META = {
  dps:    {label:"Nhóm DPS (Sát Thương Bền Bỉ)", color:"#3d8fd9"},
  burst:  {label:"Nhóm Burst DMG (Sát Thương Bùng Nổ)", color:"#d94f4f"},
  control:{label:"Nhóm Control (Khống Chế)", color:"#8a4fd9"},
  special:{label:"Nhóm Special (Đặc Biệt)", color:"#c98a2f"},
};

/* ---------------------------- BALL DEFINITIONS --------------------------- */
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
 descSimple:'Tích năng lượng theo thời gian khi không va chạm; nếu va vào đối thủ lúc đã tích đủ, đối thủ sẽ bị hất văng mạnh và chịu thêm hiệu ứng khi đập vào tường.',
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
 descSimple:'Trong một phạm vi lướt nhất định, thỉnh thoảng lướt thẳng tới đối thủ — ngay từ lúc bắt đầu lướt đã nhận miễn nhiễm mọi khống chế (chậm, choáng...) lẫn đẩy lùi, cùng giảm 25% sát thương nhận vào. Khi chạm tới sẽ gây choáng kèm sát thương, giữ đối thủ đứng yên hoàn toàn suốt cả màn múa, khiến hoa nở thành 3 hướng quanh đối thủ (bông đầu tiên luôn đối diện mặt Florentino). Florentino sẽ lướt từ tâm đối thủ ra từng bông theo thứ tự đó, mỗi lần nhặt trúng một bông vừa gây thêm sát thương vừa tự hồi một ít máu — nhặt trúng cả 3 thì lặp lại combo choáng + tung hoa, chỉ cần nhặt hụt một bông là mất mọi miễn nhiễm, thả đối thủ ra và dừng combo.',
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
 descSimple:'Mỗi khi mất một mốc máu nhất định, Cell Ball sẽ nhân đôi toàn bộ số bản thể đang có thành các bản sao độc lập, đồng thời sát thương tăng thêm sau mỗi lần phân chia.',
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
 descSimple:'Va tường sẽ đánh dấu điểm đường ray; sau một khoảng thời gian, một đoàn tàu chạy dọc theo đường ray đã tạo, gây sát thương nặng và hất văng bất kỳ ai cản đường, rồi đường ray biến mất và phải tạo lại từ đầu.',
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
 descSimple:'Va chạm sẽ kích hoạt một hiệu ứng ngẫu nhiên: có thể là đốt cháy đối thủ, làm choáng, tự hồi máu, hoặc tự tăng tốc.',
 desc:'Va chạm sẽ ném các bình thuốc ngẫu nhiên: lúc đốt, lúc làm choáng, lúc tự hồi máu hoặc tăng tốc độ.',
 onBallCollide:(b,other,g)=>{
   const roll=randi(0,3);
   if(roll===0){ other.state.poisonUntil=g.t+3; other.state.poisonTickDmg=3; spawnFloatText(g,other.x,other.y-30,'BURN!','#ff8a3d'); }
   else if(roll===1){ other.state.stunUntil=g.t+0.4; spawnFloatText(g,other.x,other.y-30,'STUN!','#fff36a'); }
   else if(roll===2){ b.hp=Math.min(b.maxHp,b.hp+14); spawnFloatText(g,b.x,b.y-30,'+14','#7CFF9A'); }
   else { b.state.speedBoostUntil=g.t+2; spawnFloatText(g,b.x,b.y-30,'SPEED!','#8fdcff'); }
 },
 getMods:(b,g)=>({speedMult:(g.t<(b.state.speedBoostUntil||0))?1.4:1})},
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
 descSimple:'Định kỳ tạo một lớp khiên bảo vệ trong thời gian ngắn: giảm sát thương nhận vào và phản ngược một phần sát thương lại cho đối thủ.',
 desc:'Định kỳ tạo lớp khiên bảo vệ trong 2 giây: bản thân chỉ nhận 50% sát thương, đồng thời phản ngược lại 150% sát thương gốc cho đối thủ.',
 init:(b)=>{ b.state.shieldCD=0; },
 update:(b,dt,g)=>{ if(g.t-(b.state.shieldCD||0)>6){ b.state.shieldCD=g.t; b.state.shieldUntil=g.t+2; } },
 modifyIncoming:(b,attacker,dmg,g)=>{
   if(g.t<(b.state.shieldUntil||0)){
     const reflect=dmg*1.5;
     attacker.hp=Math.max(0,attacker.hp-reflect);
     spawnFloatText(g,attacker.x,attacker.y-30,'-'+reflect.toFixed(0),'#8fdcff');
     spawnFloatText(g,b.x,b.y-46,'REFLECT!','#8fdcff');
     return dmg*0.5;
   }
   return dmg;
 },
 renderExtra:(b,g,ctx)=>{
   if(g.t<(b.state.shieldUntil||0)){
     ctx.beginPath(); ctx.arc(b.x,b.y,b.radius+10,0,Math.PI*2);
     ctx.strokeStyle='rgba(143,220,255,0.85)'; ctx.lineWidth=3; ctx.stroke();
   }
 }},
{id:'ghost', name:'Ghost Ball', group:'special', icon:'👻', hp:90, speed:105, dmg:8, color:'#9a8fc9',
 descSimple:'Quỹ đạo di chuyển khó đoán, thỉnh thoảng bất ngờ dịch chuyển đến cạnh đối thủ để đánh úp; ngay sau khi dịch chuyển, sát thương gây ra sẽ tăng thêm trong ít giây và bản thân được miễn giảm 50% sát thương ở lần trúng đòn kế tiếp.',
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
 descSimple:'Mỗi lần va tường mà chưa chạm đối thủ kể từ lần trước, tốc độ và sát thương sẽ tăng dần; khi chạm được đối thủ, toàn bộ sát thương tích lũy sẽ được xả ra rồi tích lại từ đầu.',
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
 descSimple:'Thỉnh thoảng đột ngột bẻ quỹ đạo của chính mình thành một vòng tròn, tạo ra cơn lốc xoáy tại tâm vòng đó. Lốc hút nhẹ đối thủ lại gần, cuốn họ quay vòng nếu dính đủ lâu, rồi nổ tung sau 2 giây.',
 desc:'Cứ khoảng 6-10 giây, có cơ hội đột ngột bẻ quỹ đạo của chính mình thành một vòng tròn (không dịch chuyển tức thời, chỉ đổi hướng đi mượt sang hình tròn), tạo ra một cơn lốc xoáy đứng yên tại đúng tâm vòng tròn đó, tồn tại 2 giây. Trong lúc lốc còn tồn tại: nếu đối thủ ở trong phạm vi hút, lốc sẽ hút nhẹ (chỉ bẻ dần hướng đi, không giật hẳn về) đồng thời gây 1 sát thương mỗi 0.2 giây; nếu đối thủ ở trong phạm vi hút liên tục đủ 1 giây, họ sẽ bị cuốn hẳn vào trong và buộc phải quay vòng quanh tâm lốc cho tới khi lốc tan biến. Đúng 2 giây kể từ lúc xuất hiện, cơn lốc nổ tung, gây 18 sát thương và hất văng bất kỳ ai ở gần tâm.',
 init:(b)=>{ b.state.torPhase='idle'; b.state.torCD=-99; b.state.torTimer=0; },
 update:(b,dt,g)=>{
   if(b.state.torPhase==='idle'){
     // "thỉnh thoảng" - occasional random trigger, gated by both a hard
     // cooldown (torCD) and a per-second chance, so it can't spam back to
     // back; also skipped near walls/obstacles so the orbit never clips them.
     if(g.t-(b.state.torCD||-99)>6 && !g.isNearHazard(b) && g.opponentOf(b) && Math.random()<0.25*dt){
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
 descSimple:'Không có thanh máu thường — sống chết theo Động Lượng (0-100%). Mỗi lần bị đánh hoặc va tường chỉ mất 1% ĐL (hiện -1%); đâm trúng đối thủ gây 10% máu tối đa đối thủ nhưng tự mất 5% ĐL. Cứ 5 giây có 50% cơ hội bùng nổ lao thẳng vào đối thủ và hồi 15% ĐL.',
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
];

// Every ball keeps the same plain circle silhouette - identity now comes
// from each ball's own accent color (see `color:` on each definition above)
// plus small decorative details (spikes, a fuse, orbiting weapons...) drawn
// by renderExtra, not from changing the base body shape.
BALL_TYPES.forEach((bt)=>{ bt.shape='circle'; });

function dmgFor(ball, base){ return base * (ball.dmg/7); }
