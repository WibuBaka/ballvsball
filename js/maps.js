/* ---------------------------- MAP DEFINITIONS ----------------------------*/
const MAPS = [
 {id:0,name:'Square Arena',desc:'Hình vuông chuẩn, cân bằng tuyệt đối.',
   build:(w,h)=>({obstacles:[],portals:[]})},
 {id:1,name:'Cross Field',desc:'Vật cản hình dấu cộng ở giữa.',
   build:(w,h)=>{
     const cx=w/2, cy=h/2, arm=w*0.32, thick=w*0.09;
     return {obstacles:[
       {type:'rect',x:cx-arm/2,y:cy-thick/2,w:arm,h:thick},
       {type:'rect',x:cx-thick/2,y:cy-arm/2,w:thick,h:arm},
     ],portals:[]};
   }},
 {id:2,name:'Four Pillars',desc:'4 trụ tròn ở 4 góc.',
   build:(w,h)=>{
     const r=w*0.075, off=w*0.22;
     return {obstacles:[
       {type:'circle',x:off,y:off,r},
       {type:'circle',x:w-off,y:off,r},
       {type:'circle',x:off,y:h-off,r},
       {type:'circle',x:w-off,y:h-off,r},
     ],portals:[]};
   }},
 {id:3,name:'Portal Arena',desc:'2 cặp cổng dịch chuyển đối xứng.',
   build:(w,h)=>{
     const r=26;
     return {obstacles:[],portals:[
       {a:{x:w*0.15,y:h*0.5,r},b:{x:w*0.85,y:h*0.5,r},color:'#7dd8ff'},
       {a:{x:w*0.5,y:h*0.15,r},b:{x:w*0.5,y:h*0.85,r},color:'#ff8bd6'},
     ]};
   }},
 {id:4,name:'Moving Walls',desc:'Tường trượt qua lại liên tục, thêm tường mới mọc ngẫu nhiên - cực kịch tính!',
   // Two kinds of danger here:
   //  1) permanent walls that slide back and forth on a fixed track (`mover`)
   //  2) temporary walls that "mọc" (sprout) at random spots on a timer,
   //     telegraphed briefly before turning solid, then vanish again - see
   //     GameEngine.updateMapObstacles() for the runtime behaviour.
   build:(w,h)=>{
     const thick=w*0.075;
     const barW=w*0.34, barH=h*0.22;
     // NOTE: for rect obstacles, x/y is the TOP-LEFT corner (see engine's
     // resolveObstacleCollision/render), so each mover's `base` is set to
     // the top-left value that keeps the shape centered on its intended
     // track - the mover just overwrites o.x or o.y in place every frame.
     const obstacles=[
       // horizontal slider: a wide bar patrolling left-right in the upper third
       {type:'rect',x:w*0.5-barW/2,y:h*0.28,w:barW,h:thick,
         mover:{axis:'x',base:w*0.5-barW/2,amp:w*0.27,speed:0.9,phase:0}},
       // vertical slider: a tall bar patrolling up-down in the lower third
       {type:'rect',x:w*0.5-thick/2,y:h*0.72-barH/2,w:thick,h:barH,
         mover:{axis:'y',base:h*0.72-barH/2,amp:h*0.2,speed:1.15,phase:Math.PI*0.5}},
       // a lone circular pillar drifting side to side through the middle
       {type:'circle',x:w*0.5,y:h*0.5,r:w*0.055,
         mover:{axis:'x',base:w*0.5,amp:w*0.32,speed:0.65,phase:Math.PI}},
     ];
     return {obstacles,portals:[]};
   },
   spawner:{
     interval:4.2,   // avg seconds between new random walls
     jitter:1.8,      // +/- randomness on the interval
     telegraph:0.85,  // seconds shown as a warning outline before solidifying
     life:3.2,        // seconds a random wall stays solid before despawning
     maxActive:2,     // cap on concurrent random walls
     minSize:0.09,    // min size as a fraction of arena width
     maxSize:0.17,    // max size as a fraction of arena width
   }},
];
function makeMapThumbSVG(m){
  const svgns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgns,'svg');
  svg.setAttribute('viewBox','0 0 100 100'); svg.setAttribute('width','100%'); svg.setAttribute('height','100%');
  const rect=document.createElementNS(svgns,'rect');
  rect.setAttribute('x',3);rect.setAttribute('y',3);rect.setAttribute('width',94);rect.setAttribute('height',94);
  rect.setAttribute('rx',2); rect.setAttribute('fill','none'); rect.setAttribute('stroke','#1a1a1a'); rect.setAttribute('stroke-width',2);
  svg.appendChild(rect);
  if(m.id===1){
    [[35,45,30,10],[45,35,10,30]].forEach(([x,y,w,h])=>{
      const r=document.createElementNS(svgns,'rect');
      r.setAttribute('x',x);r.setAttribute('y',y);r.setAttribute('width',w);r.setAttribute('height',h);
      r.setAttribute('fill','#1a1a1a'); svg.appendChild(r);
    });
  } else if(m.id===2){
    [[22,22],[78,22],[22,78],[78,78]].forEach(([cx,cy])=>{
      const c=document.createElementNS(svgns,'circle');
      c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r',9);
      c.setAttribute('fill','none');c.setAttribute('stroke','#1a1a1a');c.setAttribute('stroke-width',2);
      svg.appendChild(c);
    });
  } else if(m.id===3){
    [[15,50,'#7dd8ff'],[85,50,'#7dd8ff'],[50,15,'#ff8bd6'],[50,85,'#ff8bd6']].forEach(([cx,cy,col])=>{
      const c=document.createElementNS(svgns,'circle');
      c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r',7);
      c.setAttribute('fill',col);c.setAttribute('fill-opacity','0.35');
      c.setAttribute('stroke',col);c.setAttribute('stroke-width',2);
      svg.appendChild(c);
    });
  } else if(m.id===4){
    // two solid sliding bars + a dashed "about to spawn" bar, each with a
    // little double-headed arrow to hint at the movement/randomness theme
    const bar=(x,y,w,h)=>{
      const r=document.createElementNS(svgns,'rect');
      r.setAttribute('x',x);r.setAttribute('y',y);r.setAttribute('width',w);r.setAttribute('height',h);
      r.setAttribute('fill','#1a1a1a'); svg.appendChild(r);
    };
    const arrow=(x1,y1,x2,y2)=>{
      const l=document.createElementNS(svgns,'line');
      l.setAttribute('x1',x1);l.setAttribute('y1',y1);l.setAttribute('x2',x2);l.setAttribute('y2',y2);
      l.setAttribute('stroke','#b3b3ab');l.setAttribute('stroke-width',1.6);l.setAttribute('stroke-dasharray','2,2');
      svg.appendChild(l);
    };
    bar(30,20,30,7);       arrow(15,23.5,85,23.5);
    bar(45,66,7,26);       arrow(48.5,55,48.5,95);
    const dash=document.createElementNS(svgns,'rect');
    dash.setAttribute('x',68);dash.setAttribute('y',60);dash.setAttribute('width',18);dash.setAttribute('height',18);
    dash.setAttribute('fill','none');dash.setAttribute('stroke','#c98a2b');dash.setAttribute('stroke-width',2);
    dash.setAttribute('stroke-dasharray','3,2');dash.setAttribute('rx',2);
    svg.appendChild(dash);
  }
  return svg;
}
