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
  }
  return svg;
}
