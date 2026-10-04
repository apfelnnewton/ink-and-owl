/* Copied verbatim from design/reference-c.html (lines 300-518 and 531-605). Do not redraw or simplify.
   Additions live in art-plus.js. */
/* ---------- helpers ---------- */
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function shade(hex,amt){var n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;
  function f(v){return Math.max(0,Math.min(255,Math.round(amt<0?v*(1+amt):v+(255-v)*amt)))}
  return '#'+[f(r),f(g),f(b)].map(function(v){return v.toString(16).padStart(2,'0')}).join('')}
function r1(v){return Math.round(v*10)/10}

/* ---------- stone wall: irregular coursed blocks, each with its own tone, highlight and shadow ---------- */
function stoneWall(w,h,seed,base){
  var R=rng(seed),s='<rect width="'+w+'" height="'+h+'" fill="#0C100E"/>',y=0;
  while(y<h){
    var hh=46+Math.round(R()*12),x=-Math.round(R()*70);
    while(x<w){
      var ww=62+Math.round(R()*78),c=shade(base,(R()-.5)*.2);
      s+='<rect x="'+(x+1.5)+'" y="'+(y+1.5)+'" width="'+(ww-3)+'" height="'+(hh-3)+'" rx="3.5" fill="'+c+'"/>';
      s+='<rect x="'+(x+4)+'" y="'+(y+2.2)+'" width="'+(ww-8)+'" height="1.3" fill="#fff" opacity=".055"/>';
      s+='<rect x="'+(x+3)+'" y="'+(y+hh-4.5)+'" width="'+(ww-6)+'" height="2.5" rx="1" fill="#000" opacity=".3"/>';
      if(R()<.34){var cx=x+10+R()*(ww-24),cy=y+8+R()*(hh-22);
        s+='<path d="M'+r1(cx)+' '+r1(cy)+' l'+r1(4+R()*9)+' '+r1(3+R()*6)+' l'+r1(-3+R()*5)+' '+r1(4+R()*7)+'" stroke="#000" stroke-opacity=".4" stroke-width="1" fill="none" stroke-linecap="round"/>';}
      if(R()<.22){s+='<ellipse cx="'+r1(x+ww*R())+'" cy="'+r1(y+hh*.5)+'" rx="'+r1(5+R()*9)+'" ry="'+r1(3+R()*4)+'" fill="#000" opacity=".12"/>';}
      x+=ww;
    }
    y+=hh;
  }
  s+='<rect width="'+w+'" height="'+h+'" filter="url(#grain)" opacity=".5"/>';
  return s;
}

/* ---------- one stone block for door surrounds ---------- */
function block(x,y,w,h,base,R){
  var c=shade(base,(R()-.5)*.16);
  return '<rect x="'+r1(x+1)+'" y="'+r1(y+1)+'" width="'+r1(w-2)+'" height="'+r1(h-2)+'" rx="2.5" fill="'+c+'"/>'+
         '<rect x="'+r1(x+3)+'" y="'+r1(y+2)+'" width="'+r1(w-6)+'" height="1.2" fill="#fff" opacity=".08"/>'+
         '<rect x="'+r1(x+2)+'" y="'+r1(y+h-4)+'" width="'+r1(w-4)+'" height="2.2" fill="#000" opacity=".3"/>';
}

/* ---------- door ---------- */
var W=250,H=560,CX=125,SPRING=205,RO=85,BOTTOM=488,RL=78;
function metal(kind){return kind==='brass'?{fill:'url(#g-brass)',dark:'#6A5218',hi:'#F3E2A6'}:{fill:'url(#g-iron)',dark:'#0E1011',hi:'#7A8389'}}

function strap(y,m,len,curl){
  var xl=CX-RL,s='';
  s+='<rect x="'+(xl-3)+'" y="'+(y-11)+'" width="7" height="22" rx="3" fill="'+m.fill+'" stroke="'+m.dark+'" stroke-width=".6"/>';
  s+='<path d="M'+xl+' '+(y-7)+' L'+(xl+len-18)+' '+(y-4.5)+' L'+(xl+len)+' '+y+' L'+(xl+len-18)+' '+(y+4.5)+' L'+xl+' '+(y+7)+' Z" fill="'+m.fill+'" stroke="'+m.dark+'" stroke-width=".7"/>';
  s+='<path d="M'+(xl+2)+' '+(y-5.6)+' L'+(xl+len-20)+' '+(y-3.4)+'" stroke="'+m.hi+'" stroke-opacity=".5" stroke-width=".8"/>';
  if(curl){
    s+='<path d="M'+(xl+len-4)+' '+y+' q10 -12 2 -18 q-8 -4 -9 4" fill="none" stroke="'+m.dark+'" stroke-width="3.6" stroke-linecap="round"/>';
    s+='<path d="M'+(xl+len-4)+' '+y+' q10 12 2 18 q-8 4 -9 -4" fill="none" stroke="'+m.dark+'" stroke-width="3.6" stroke-linecap="round"/>';
    s+='<path d="M'+(xl+len-4)+' '+y+' q10 -12 2 -18 q-8 -4 -9 4" fill="none" stroke="#C5A253" stroke-width="2"/>';
    s+='<path d="M'+(xl+len-4)+' '+y+' q10 12 2 18 q-8 4 -9 -4" fill="none" stroke="#C5A253" stroke-width="2"/>';
  }
  for(var k=0;k<4;k++){var rx=xl+12+k*((len-34)/3);
    s+='<circle cx="'+r1(rx)+'" cy="'+y+'" r="2.5" fill="'+m.dark+'"/><circle cx="'+r1(rx-.7)+'" cy="'+(y-.8)+'" r=".9" fill="'+m.hi+'" opacity=".8"/>';}
  return s;
}
function stud(x,y,m){return '<circle cx="'+r1(x)+'" cy="'+y+'" r="3" fill="'+m.dark+'"/><circle cx="'+r1(x)+'" cy="'+y+'" r="2.1" fill="'+m.fill+'"/><circle cx="'+r1(x-.8)+'" cy="'+(y-.8)+'" r=".8" fill="'+m.hi+'" opacity=".8"/>'}
function pinnedCard(x,y,w,h,rot,lines,tartan){
  var s='<g transform="rotate('+rot+' '+(x+w/2)+' '+(y+h/2)+')">';
  s+='<rect x="'+(x+1.5)+'" y="'+(y+2.5)+'" width="'+w+'" height="'+h+'" fill="#000" opacity=".35"/>';
  s+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#E6D9B8"/>';
  if(tartan){
    s+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="9" fill="#7A1F2B"/>';
    for(var i=0;i<w;i+=9){s+='<rect x="'+(x+i+3)+'" y="'+y+'" width="2" height="9" fill="#1F4D3A"/><rect x="'+(x+i+6.5)+'" y="'+y+'" width=".8" height="9" fill="#E8D98A"/>';}
    s+='<rect x="'+x+'" y="'+(y+3.5)+'" width="'+w+'" height="1.6" fill="#1F4D3A"/>';
  }
  lines.forEach(function(t,i){s+='<text x="'+(x+w/2)+'" y="'+(y+(tartan?24:17)+i*13)+'" text-anchor="middle" font-family="\'IM Fell English\', Georgia, serif" font-style="italic" font-size="11.5" fill="#2A2118">'+t+'</text>'});
  s+='<circle cx="'+(x+w/2)+'" cy="'+(y+(tartan?4.5:5))+'" r="2.6" fill="url(#g-brass)" stroke="#6A5218" stroke-width=".5"/></g>';
  return s;
}

var EXTRAS={
  snape:function(){ // austere: heavy iron studs along the arch, nothing friendly
    var s='',m=metal('iron');
    for(var a=20;a<=160;a+=20){var rad=a*Math.PI/180;s+=stud(CX+ (RL-12)*Math.cos(rad), Math.round(SPRING-(RL-12)*Math.sin(rad)), m);}
    return s;
  },
  mcgonagall:function(){ return pinnedCard(CX-62,296,84,42,-2,['Knock once.','Do not be late.'],true); },
  lupin:function(){ // claw gouges and a patched plank
    var s='';
    s+='<rect x="'+(CX-RL+26)+'" y="392" width="26" height="54" fill="#8C7350"/><rect x="'+(CX-RL+26)+'" y="392" width="26" height="54" fill="none" stroke="#000" stroke-opacity=".4"/>';
    [[CX-RL+30,396],[CX-RL+48,396],[CX-RL+30,442],[CX-RL+48,442]].forEach(function(p){s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="1.6" fill="#2A2E30"/>'});
    for(var i=0;i<3;i++){var x0=CX+2+i*13,y0=292+i*3;
      s+='<path d="M'+x0+' '+y0+' q10 24 26 62" stroke="#1B120A" stroke-width="3.4" stroke-linecap="round" fill="none" opacity=".75"/>';
      s+='<path d="M'+(x0+1.2)+' '+(y0+1)+' q10 24 25 60" stroke="#C7B08A" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".8"/>';}
    return s;
  },
  moody:function(){ // iron bands, a column of locks, a watchful lens
    var s='',m=metal('iron');
    [222,318,430].forEach(function(y){s+='<rect x="'+(CX-RL)+'" y="'+(y-7)+'" width="'+(2*RL)+'" height="14" fill="'+m.fill+'" stroke="'+m.dark+'" stroke-width=".7"/>';
      for(var x=CX-RL+10;x<CX+RL;x+=19){s+='<circle cx="'+x+'" cy="'+y+'" r="2.2" fill="'+m.dark+'"/><circle cx="'+(x-.6)+'" cy="'+(y-.7)+'" r=".8" fill="'+m.hi+'" opacity=".8"/>';}});
    for(var k=0;k<7;k++){var y=302+k*25,x=CX+RL-18;
      s+='<rect x="'+(x-7)+'" y="'+(y-9)+'" width="14" height="19" rx="3" fill="url(#g-brass)" stroke="#6A5218" stroke-width=".7"/>';
      s+='<circle cx="'+x+'" cy="'+(y-2)+'" r="2.2" fill="#15110A"/><path d="M'+(x-1.4)+' '+(y-1)+' L'+(x+1.4)+' '+(y-1)+' L'+(x+2)+' '+(y+5.5)+' L'+(x-2)+' '+(y+5.5)+' Z" fill="#15110A"/>';}
    s+='<circle cx="'+CX+'" cy="170" r="13" fill="url(#g-brass)" stroke="#6A5218"/><circle cx="'+CX+'" cy="170" r="8.5" fill="#0E1418"/><circle cx="'+CX+'" cy="170" r="6" fill="#4FA3D1"/><circle cx="'+CX+'" cy="170" r="2.6" fill="#07151E"/><circle cx="'+(CX-2.4)+'" cy="167.4" r="1.5" fill="#fff" opacity=".85"/>';
    return s;
  },
  umbridge:function(){ // decorative kitten plate and a bow
    var s='',cx=CX,cy=170;
    s+='<circle cx="'+cx+'" cy="'+(cy+1.5)+'" r="23" fill="#000" opacity=".25"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="23" fill="#FBF4F5" stroke="#C9A24A" stroke-width="2"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="17.5" fill="none" stroke="#E7A9BC" stroke-width="1.2" stroke-dasharray="2 2.6"/>';
    s+='<ellipse cx="'+cx+'" cy="'+(cy+8)+'" rx="8.5" ry="6.5" fill="#9A8F96"/>';
    s+='<circle cx="'+cx+'" cy="'+(cy-2.5)+'" r="7" fill="#9A8F96"/>';
    s+='<path d="M'+(cx-6.4)+' '+(cy-5.5)+' l1 -7.5 l5 4.6 Z M'+(cx+6.4)+' '+(cy-5.5)+' l-1 -7.5 l-5 4.6 Z" fill="#9A8F96"/>';
    s+='<circle cx="'+(cx-2.6)+'" cy="'+(cy-3.2)+'" r="1" fill="#2A2118"/><circle cx="'+(cx+2.6)+'" cy="'+(cy-3.2)+'" r="1" fill="#2A2118"/>';
    s+='<path d="M'+(cx-5)+' '+(cy+3)+' l5 2.4 l5 -2.4 l-1.2 4.6 l-3.8 -1.6 l-3.8 1.6 Z" fill="#D9618A"/>';
    var bx=CX+RL-30,by=318; // bow on the handle
    s+='<path d="M'+bx+' '+by+' q-16 -12 -17 0 q1 12 17 0 Z M'+bx+' '+by+' q16 -12 17 0 q-1 12 -17 0 Z" fill="#F6C7D6" stroke="#B4577A" stroke-width=".9"/>';
    s+='<path d="M'+bx+' '+by+' l-6 17 l5 -3 l1 -14 l1 14 l5 3 Z" fill="#F0B3C7" stroke="#B4577A" stroke-width=".8"/><circle cx="'+bx+'" cy="'+by+'" r="3" fill="#E58EAD" stroke="#B4577A" stroke-width=".8"/>';
    return s;
  },
  dumbledore:function(){ // sunburst knocker and the password note
    var s='',cx=CX,cy=170,pts=[];
    for(var i=0;i<16;i++){var a=i*Math.PI/8,rr=i%2?10:19;pts.push(r1(cx+rr*Math.cos(a))+','+r1(cy+rr*Math.sin(a)));}
    s+='<polygon points="'+pts.join(' ')+'" fill="url(#g-brass)" stroke="#6A5218" stroke-width=".8"/>';
    s+='<circle cx="'+cx+'" cy="'+cy+'" r="6.5" fill="#8E6A1E" stroke="#6A5218"/>';
    s+='<path d="M'+(cx-13)+' '+(cy+4)+' a13 15 0 0 0 26 0" fill="none" stroke="#6A5218" stroke-width="5.6" stroke-linecap="round"/>';
    s+='<path d="M'+(cx-13)+' '+(cy+4)+' a13 15 0 0 0 26 0" fill="none" stroke="#D9BC6A" stroke-width="3.4" stroke-linecap="round"/>';
    s+=pinnedCard(CX-66,298,88,38,-2,['Password:','Sherbet Lemon'],false);
    return s;
  },
  slughorn:function(){ // a small gilt pineapple and a tassel
    var s='',cx=CX,cy=174;
    s+='<path d="M'+cx+' '+(cy-12)+' q-9 -12 -13 -15 q9 1 12 8 q-1 -11 1 -17 q2 6 1 17 q3 -7 12 -8 q-4 3 -13 15 Z" fill="#6E8F3A" stroke="#3E5A1C" stroke-width=".7"/>';
    s+='<ellipse cx="'+cx+'" cy="'+(cy+3)+'" rx="11.5" ry="15" fill="url(#g-brass)" stroke="#6A5218" stroke-width=".9"/>';
    s+='<g stroke="#6A5218" stroke-width=".7" opacity=".85"><path d="M'+(cx-10)+' '+(cy-3)+' l20 14 M'+(cx-11)+' '+(cy+5)+' l16 11 M'+(cx-5)+' '+(cy-9)+' l16 11"/><path d="M'+(cx+10)+' '+(cy-3)+' l-20 14 M'+(cx+11)+' '+(cy+5)+' l-16 11 M'+(cx+5)+' '+(cy-9)+' l-16 11"/></g>';
    var tx=CX+RL-30,ty=344;
    s+='<path d="M'+tx+' '+ty+' v20" stroke="#D2B158" stroke-width="1.6"/><circle cx="'+tx+'" cy="'+(ty+22)+'" r="3.6" fill="url(#g-brass)" stroke="#6A5218" stroke-width=".6"/>';
    s+='<path d="M'+(tx-4.5)+' '+(ty+25)+' l-1.5 20 h12 l-1.5 -20 Z" fill="#C9A24A" stroke="#6A5218" stroke-width=".6"/><path d="M'+(tx-2.5)+' '+(ty+27)+' v17 M'+tx+' '+(ty+27)+' v18 M'+(tx+2.5)+' '+(ty+27)+' v17" stroke="#6A5218" stroke-width=".6"/>';
    return s;
  }
};

function door(cfg,i){
  var R=rng(cfg.seed),m=metal(cfg.metal),s='',g=cfg.glow,uid='d'+i;
  s+='<defs><clipPath id="'+uid+'leaf"><path d="M'+(CX-RL)+' '+BOTTOM+' L'+(CX-RL)+' '+SPRING+' A'+RL+' '+RL+' 0 0 1 '+(CX+RL)+' '+SPRING+' L'+(CX+RL)+' '+BOTTOM+' Z"/></clipPath>'+
     '<radialGradient id="'+uid+'in" cx=".5" cy=".62" r=".7"><stop offset="0" stop-color="'+shade(g,.55)+'"/><stop offset=".6" stop-color="'+g+'"/><stop offset="1" stop-color="'+shade(g,-.6)+'"/></radialGradient>'+
     '<radialGradient id="'+uid+'sp"><stop offset="0" stop-color="'+g+'" stop-opacity=".6"/><stop offset="1" stop-color="'+g+'" stop-opacity="0"/></radialGradient></defs>';
  /* floor */
  s+='<rect x="0" y="'+(BOTTOM+12)+'" width="'+W+'" height="'+(H-BOTTOM-12)+'" fill="#121714"/>';
  s+='<path d="M0 '+(BOTTOM+34)+' H'+W+' M0 '+(H-1)+' H'+W+' M40 '+(BOTTOM+12)+' L22 '+(BOTTOM+34)+' M128 '+(BOTTOM+12)+' L130 '+(BOTTOM+34)+' M214 '+(BOTTOM+12)+' L232 '+(BOTTOM+34)+' M82 '+(BOTTOM+34)+' L58 '+H+' M176 '+(BOTTOM+34)+' L196 '+H+'" stroke="#070908" stroke-width="2.4"/>';
  s+='<path d="M0 '+(BOTTOM+35.5)+' H'+W+'" stroke="#fff" stroke-opacity=".05"/>';
  /* lamp glow on the wall, behind stones' highlights */
  if(cfg.due) s+='<circle class="glow" cx="'+CX+'" cy="58" r="118" fill="url(#g-lamp)"/>';
  /* surround: jambs */
  var y=SPRING,k=0;
  while(y<BOTTOM){var hh=Math.min(k%2?34:42,BOTTOM-y),wd=k%2?27:35;
    s+=block(CX-RO-wd,y,wd,hh,cfg.stone,R)+block(CX+RO,y,wd,hh,cfg.stone,R);y+=hh;k++;}
  /* voussoirs */
  var n=11;
  for(var j=0;j<n;j++){
    var a0=Math.PI-j*Math.PI/n,a1=Math.PI-(j+1)*Math.PI/n,key=j===5,ri=RO-3,ro=RO+(key?44:31),c=shade(cfg.stone,(R()-.5)*.16+(key?.06:0));
    var P=function(r,a){return r1(CX+r*Math.cos(a))+','+r1(SPRING-r*Math.sin(a))};
    s+='<polygon points="'+P(ri,a0)+' '+P(ro,a0)+' '+P(ro,a1)+' '+P(ri,a1)+'" fill="'+c+'" stroke="#0C100E" stroke-width="2.4" stroke-linejoin="round"/>';
    s+='<polyline points="'+P(ro-2.5,a0-.03)+' '+P(ro-2.5,a1+.03)+'" stroke="#fff" stroke-opacity=".07" stroke-width="1.2" fill="none"/>';
  }
  /* threshold */
  s+='<rect x="6" y="'+BOTTOM+'" width="'+(W-12)+'" height="13" rx="2" fill="'+shade(cfg.stone,.08)+'"/><rect x="8" y="'+(BOTTOM+1)+'" width="'+(W-16)+'" height="1.3" fill="#fff" opacity=".1"/><rect x="6" y="'+(BOTTOM+10)+'" width="'+(W-12)+'" height="3" fill="#000" opacity=".35"/>';
  /* opening and the lit room behind the leaf */
  s+='<path d="M'+(CX-RO)+' '+BOTTOM+' L'+(CX-RO)+' '+SPRING+' A'+RO+' '+RO+' 0 0 1 '+(CX+RO)+' '+SPRING+' L'+(CX+RO)+' '+BOTTOM+' Z" fill="#060807"/>';
  s+='<path d="M'+(CX-RL)+' '+BOTTOM+' L'+(CX-RL)+' '+SPRING+' A'+RL+' '+RL+' 0 0 1 '+(CX+RL)+' '+SPRING+' L'+(CX+RL)+' '+BOTTOM+' Z" fill="url(#'+uid+'in)"/>';
  /* leaf */
  s+='<g class="leaf" style="transform-origin:'+(CX-RL)+'px 330px"><g clip-path="url(#'+uid+'leaf)">';
  var top=SPRING-RL,pw=(2*RL)/6;
  for(var p=0;p<6;p++){
    var x=CX-RL+p*pw,c2=shade(cfg.wood,(R()-.5)*.14);
    s+='<rect x="'+r1(x)+'" y="'+top+'" width="'+r1(pw)+'" height="'+(BOTTOM-top)+'" fill="'+c2+'"/>';
    for(var q=0;q<4;q++){var gx=x+3+R()*(pw-6),w1=(R()-.5)*5,w2=(R()-.5)*5;
      s+='<path d="M'+r1(gx)+' '+top+' C'+r1(gx+w1)+' '+(top+120)+' '+r1(gx+w2)+' '+(top+240)+' '+r1(gx+w1*.4)+' '+BOTTOM+'" stroke="'+shade(cfg.wood,-.45)+'" stroke-opacity="'+r1(.25+R()*.3)+'" stroke-width="'+r1(.6+R()*.7)+'" fill="none"/>';}
    if(R()<.5){var ky=top+70+R()*(BOTTOM-top-140),kx=x+pw/2+(R()-.5)*6;
      s+='<ellipse cx="'+r1(kx)+'" cy="'+r1(ky)+'" rx="3.4" ry="5.6" fill="'+shade(cfg.wood,-.5)+'" opacity=".7"/><ellipse cx="'+r1(kx)+'" cy="'+r1(ky)+'" rx="6" ry="10" fill="none" stroke="'+shade(cfg.wood,-.45)+'" stroke-opacity=".4" stroke-width=".8"/>';}
    if(p>0){s+='<rect x="'+r1(x-1)+'" y="'+top+'" width="2" height="'+(BOTTOM-top)+'" fill="#000" opacity=".5"/><rect x="'+r1(x+1)+'" y="'+top+'" width="1" height="'+(BOTTOM-top)+'" fill="#fff" opacity=".07"/>';}
  }
  if(cfg.trim) s+='<path d="M'+(CX-RL+4)+' '+BOTTOM+' L'+(CX-RL+4)+' '+SPRING+' A'+(RL-4)+' '+(RL-4)+' 0 0 1 '+(CX+RL-4)+' '+SPRING+' L'+(CX+RL-4)+' '+BOTTOM+'" fill="none" stroke="'+cfg.trim+'" stroke-width="3" opacity=".85"/>';
  s+='<rect x="'+(CX-RL)+'" y="'+top+'" width="'+(2*RL)+'" height="'+(BOTTOM-top)+'" filter="url(#grain)" opacity=".35"/>';
  /* fittings */
  if(!cfg.noStraps){s+=strap(218,m,112,cfg.curl)+strap(352,m,112,cfg.curl)+strap(456,m,112,cfg.curl);}
  /* nameplate */
  var px=CX-63,py=238,en=cfg.plate==='enamel';
  s+='<rect x="'+(px+1.5)+'" y="'+(py+2.5)+'" width="126" height="46" rx="2" fill="#000" opacity=".4"/>';
  s+='<rect x="'+px+'" y="'+py+'" width="126" height="46" rx="2" fill="'+(en?'#FBEFF2':'url(#g-brass)')+'" stroke="'+(en?'#C9607F':'#6A5218')+'" stroke-width="1"/>';
  s+='<rect x="'+(px+3.5)+'" y="'+(py+3.5)+'" width="119" height="39" rx="1" fill="none" stroke="'+(en?'#E7A9BC':'#6A5218')+'" stroke-opacity=".7" stroke-width=".8"/>';
  [[px+7,py+7],[px+119,py+7],[px+7,py+39],[px+119,py+39]].forEach(function(q){s+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="2" fill="'+(en?'#C9A24A':'#6A5218')+'"/><path d="M'+(q[0]-1.3)+' '+(q[1]-1)+' l2.6 2" stroke="'+(en?'#6A5218':'#E6CC80')+'" stroke-width=".6"/>'});
  var tc=en?'#7A2A45':'#33240A';
  if(!en) s+='<text x="'+CX+'" y="'+(py+20.8)+'" text-anchor="middle" font-family="\'IM Fell English SC\', Georgia, serif" font-size="14.5" fill="#F3E2A6" opacity=".6">'+cfg.plateName+'</text>';
  s+='<text x="'+CX+'" y="'+(py+20)+'" text-anchor="middle" font-family="\'IM Fell English SC\', Georgia, serif" font-size="14.5" fill="'+tc+'">'+cfg.plateName+'</text>';
  s+='<text x="'+CX+'" y="'+(py+35)+'" text-anchor="middle" font-family="\'Gowun Batang\', serif" font-size="10.5" fill="'+tc+'">'+cfg.plateSub+'</text>';
  /* ring pull and keyhole */
  var hx=CX+RL-30,hy=318;
  if(!cfg.noRing) s+='<circle cx="'+hx+'" cy="'+hy+'" r="10.5" fill="'+m.fill+'" stroke="'+m.dark+'" stroke-width=".8"/><circle cx="'+hx+'" cy="'+hy+'" r="4" fill="'+m.dark+'"/>';
  if(!cfg.noRing) s+='<circle cx="'+hx+'" cy="'+(hy+13)+'" r="13.5" fill="none" stroke="'+m.dark+'" stroke-width="5.4"/><circle cx="'+hx+'" cy="'+(hy+13)+'" r="13.5" fill="none" stroke="'+m.fill+'" stroke-width="3.6"/>';
  if(!cfg.noRing) s+='<path d="M'+(hx-11)+' '+(hy+20)+' a13.5 13.5 0 0 0 9 6.2" stroke="'+m.hi+'" stroke-width="1.1" fill="none" opacity=".8" stroke-linecap="round"/>';
  if(!cfg.noKeyhole){s+='<rect x="'+(hx-6.5)+'" y="'+(hy+44)+'" width="13" height="23" rx="6" fill="'+m.fill+'" stroke="'+m.dark+'" stroke-width=".8"/><circle cx="'+hx+'" cy="'+(hy+52)+'" r="2.3" fill="#070707"/><path d="M'+(hx-1.4)+' '+(hy+53)+' h2.8 l.8 7.5 h-4.4 Z" fill="#070707"/>';}
  s+=(EXTRAS[cfg.id]?EXTRAS[cfg.id]():'');
  s+='<path d="M'+(CX-RL)+' '+BOTTOM+' L'+(CX-RL)+' '+SPRING+' A'+RL+' '+RL+' 0 0 1 '+(CX+RL)+' '+SPRING+' L'+(CX+RL)+' '+BOTTOM+' Z" fill="url(#g-reveal)"/>';
  s+='</g></g>';
  /* light under the door and its spill on the floor */
  if(cfg.due){
    s+='<rect x="'+(CX-RL+2)+'" y="'+(BOTTOM-3)+'" width="'+(2*RL-4)+'" height="3" fill="'+shade(g,.5)+'" opacity=".9"/>';
    s+='<ellipse class="glow" cx="'+CX+'" cy="'+(BOTTOM+26)+'" rx="92" ry="26" fill="url(#'+uid+'sp)"/>';
  }
  /* lantern on an iron bracket above the keystone */
  var ly=12,lit=cfg.due;
  s+='<rect x="'+(CX-13)+'" y="'+(ly-8)+'" width="26" height="7" rx="1.5" fill="url(#g-iron)" stroke="#0E1011" stroke-width=".7"/>';
  s+='<path d="M'+CX+' '+(ly-1)+' v8" stroke="#0E1011" stroke-width="3.2"/><path d="M'+CX+' '+(ly-1)+' v8" stroke="#4A5054" stroke-width="1.2"/>';
  s+='<path d="M'+(CX-8)+' '+(ly+16)+' L'+(CX-4)+' '+(ly+7)+' h8 L'+(CX+8)+' '+(ly+16)+' Z" fill="url(#g-iron)" stroke="#0E1011" stroke-width=".8"/>';
  s+='<rect x="'+(CX-14)+'" y="'+(ly+16)+'" width="28" height="4" rx="1" fill="url(#g-iron)" stroke="#0E1011" stroke-width=".7"/>';
  s+='<path d="M'+(CX-12.5)+' '+(ly+20)+' L'+(CX+12.5)+' '+(ly+20)+' L'+(CX+9.5)+' '+(ly+50)+' L'+(CX-9.5)+' '+(ly+50)+' Z" fill="'+(lit?'#FFD98A':'#141917')+'" opacity="'+(lit?'.92':'1')+'"/>';
  if(lit){
    s+='<ellipse cx="'+CX+'" cy="'+(ly+38)+'" rx="8" ry="12" fill="#FFF3CF" opacity=".75"/>';
    s+='<path class="flame" d="M'+CX+' '+(ly+26)+' q6 8 3.4 14 q-1.6 4 -3.4 4 q-1.8 0 -3.4 -4 q-2.6 -6 3.4 -14 Z" fill="#F08A1D"/>';
    s+='<path class="flame" d="M'+CX+' '+(ly+32)+' q3 5 1.6 8.6 q-.8 2 -1.6 2 q-.8 0 -1.6 -2 q-1.4 -3.6 1.6 -8.6 Z" fill="#FFF3CF"/>';
  } else {
    s+='<path d="M'+(CX-9)+' '+(ly+24)+' l5 22" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>';
  }
  s+='<path d="M'+(CX-12.5)+' '+(ly+20)+' L'+(CX-9.5)+' '+(ly+50)+' M'+(CX+12.5)+' '+(ly+20)+' L'+(CX+9.5)+' '+(ly+50)+' M'+(CX-4)+' '+(ly+20)+' L'+(CX-3)+' '+(ly+50)+' M'+(CX+4)+' '+(ly+20)+' L'+(CX+3)+' '+(ly+50)+'" stroke="#0E1011" stroke-width="1.6"/>';
  s+='<rect x="'+(CX-11.5)+'" y="'+(ly+50)+'" width="23" height="4.5" rx="1" fill="url(#g-iron)" stroke="#0E1011" stroke-width=".7"/><circle cx="'+CX+'" cy="'+(ly+57)+'" r="2" fill="#17191A"/>';
  return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" aria-hidden="true">'+s+'</svg>';
}

/* ---------- torn parchment outline ---------- */
function tornRect(w,h,seed,tearTop,tearBottom){
  var R=rng(seed),d='M0 '+(tearTop?4:0);
  if(tearTop){for(var x=8;x<w;x+=8+R()*10){d+=' L'+r1(x)+' '+r1(R()*5);} }
  d+=' L'+w+' '+(tearTop?3:0)+' L'+w+' '+(h-(tearBottom?6:0));
  if(tearBottom){for(var x2=w-8;x2>0;x2-=7+R()*11){d+=' L'+r1(x2)+' '+r1(h-R()*7);} }
  d+=' L0 '+(h-(tearBottom?5:0))+' Z';
  return d;
}

/* ---------- shelf with bottles ---------- */
function bottle(o){
  var s='',x=o.x,by=o.by,id='b'+o.n,body='',neckW=o.neck||10,liq=o.level;
  if(o.type==='round'){var r=o.r;body='M'+(x-neckW/2)+' '+(by-2*r-16)+' V'+(by-2*r+3)+' A'+r+' '+r+' 0 1 0 '+(x+neckW/2)+' '+(by-2*r+3)+' V'+(by-2*r-16)+' Z';o.top=by-2*r-16;o.h=2*r;o.w=2*r;}
  if(o.type==='tall'){var w=o.w,h=o.h;body='M'+(x-neckW/2)+' '+(by-h-14)+' V'+(by-h)+' Q'+(x-w/2)+' '+(by-h)+' '+(x-w/2)+' '+(by-h+8)+' V'+(by-3)+' Q'+(x-w/2)+' '+by+' '+(x-w/2+3)+' '+by+' H'+(x+w/2-3)+' Q'+(x+w/2)+' '+by+' '+(x+w/2)+' '+(by-3)+' V'+(by-h+8)+' Q'+(x+w/2)+' '+(by-h)+' '+(x+neckW/2)+' '+(by-h)+' V'+(by-h-14)+' Z';o.top=by-h-14;}
  if(o.type==='cone'){var w3=o.w,h3=o.h;body='M'+(x-neckW/2)+' '+(by-h3-14)+' V'+(by-h3)+' L'+(x-w3/2)+' '+(by-3)+' Q'+(x-w3/2)+' '+by+' '+(x-w3/2+4)+' '+by+' H'+(x+w3/2-4)+' Q'+(x+w3/2)+' '+by+' '+(x+w3/2)+' '+(by-3)+' L'+(x+neckW/2)+' '+(by-h3)+' V'+(by-h3-14)+' Z';o.top=by-h3-14;}
  if(o.type==='jar'){var w4=o.w,h4=o.h;body='M'+(x-w4/2+3)+' '+(by-h4)+' H'+(x+w4/2-3)+' Q'+(x+w4/2)+' '+(by-h4)+' '+(x+w4/2)+' '+(by-h4+4)+' V'+(by-3)+' Q'+(x+w4/2)+' '+by+' '+(x+w4/2-3)+' '+by+' H'+(x-w4/2+3)+' Q'+(x-w4/2)+' '+by+' '+(x-w4/2)+' '+(by-3)+' V'+(by-h4+4)+' Q'+(x-w4/2)+' '+(by-h4)+' '+(x-w4/2+3)+' '+(by-h4)+' Z';o.top=by-h4;neckW=w4-6;}
  var bw=(o.w||2*o.r),ly=by-liq;
  s+='<defs><clipPath id="'+id+'"><path d="'+body+'"/></clipPath><linearGradient id="'+id+'l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+shade(o.color,.25)+'"/><stop offset="1" stop-color="'+shade(o.color,-.45)+'"/></linearGradient></defs>';
  s+='<ellipse cx="'+x+'" cy="'+(by+1)+'" rx="'+(bw/2+2)+'" ry="2.6" fill="#000" opacity=".45"/>';
  s+='<path d="'+body+'" fill="#0A0E0C" opacity=".35"/>';
  s+='<g clip-path="url(#'+id+')"><rect x="'+(x-bw/2-2)+'" y="'+ly+'" width="'+(bw+4)+'" height="'+(liq+2)+'" fill="url(#'+id+'l)"/>';
  s+='<ellipse cx="'+x+'" cy="'+ly+'" rx="'+(bw/2)+'" ry="2.2" fill="'+shade(o.color,.5)+'" opacity=".8"/>';
  if(o.bubbles){for(var b=0;b<o.bubbles;b++){s+='<circle class="bub" style="animation-delay:-'+(b*0.9+o.n*0.3).toFixed(1)+'s" cx="'+r1(x-bw/4+b*(bw/(2*o.bubbles))+2)+'" cy="'+(by-5-b*2)+'" r="'+(1.3+((b+o.n)%2)*.6)+'" fill="'+shade(o.color,.7)+'"/>';}}
  if(o.thing){s+='<path d="M'+(x-5)+' '+(by-4)+' q-3 -12 4 -16 q8 -2 6 8 q-1 7 -4 8 Z" fill="'+shade(o.color,-.6)+'" opacity=".8"/>';}
  s+='<rect x="'+(x-bw/2-2)+'" y="'+(o.top-2)+'" width="'+(bw+4)+'" height="'+(by-o.top+4)+'" fill="url(#g-glass)"/></g>';
  s+='<path d="'+body+'" fill="none" stroke="#C9DDD2" stroke-opacity=".55" stroke-width="1.1"/>';
  s+='<path d="M'+(x-bw/2+3.5)+' '+(by-6)+' V'+(by-Math.min(liq+10,(o.h||2*o.r)-6))+'" stroke="#fff" stroke-opacity=".38" stroke-width="1.6" stroke-linecap="round"/>';
  if(o.type==='jar'){
    s+='<rect x="'+(x-bw/2-1.5)+'" y="'+(o.top-6)+'" width="'+(bw+3)+'" height="7" rx="1.5" fill="url(#g-iron)" stroke="#0E1011" stroke-width=".6"/>';
  } else {
    s+='<rect x="'+(x-neckW/2-1.5)+'" y="'+(o.top-1)+'" width="'+(neckW+3)+'" height="3" rx="1" fill="none" stroke="#C9DDD2" stroke-opacity=".6"/>';
    if(o.wax){s+='<path d="M'+(x-neckW/2-2)+' '+(o.top-7)+' h'+(neckW+4)+' v8 q-2 4 -4 0 q-2 6 -5 1 q-2 3 -'+(neckW-5)+' -1 Z" fill="'+o.wax+'"/><rect x="'+(x-neckW/2-.5)+'" y="'+(o.top-6)+'" width="2" height="5" fill="#fff" opacity=".25"/>';}
    else{s+='<rect x="'+(x-neckW/2+.5)+'" y="'+(o.top-7)+'" width="'+(neckW-1)+'" height="9" rx="1.5" fill="url(#g-cork)"/><path d="M'+(x-neckW/2+2)+' '+(o.top-4.5)+' h'+(neckW-5)+' M'+(x-neckW/2+3)+' '+(o.top-2)+' h'+(neckW-6)+'" stroke="#4E3920" stroke-width=".6" opacity=".7"/>';}
  }
  if(o.label){var lw=Math.min(bw-6,22),lh=13,lx=x-lw/2,lyy=by-(o.labelY||18);
    s+='<g transform="rotate('+(o.n%2?-3:2.5)+' '+x+' '+lyy+')"><rect x="'+lx+'" y="'+lyy+'" width="'+lw+'" height="'+lh+'" fill="#E6D9B8"/><rect x="'+lx+'" y="'+lyy+'" width="'+lw+'" height="'+lh+'" fill="none" stroke="#8A7A55" stroke-width=".5"/><path d="M'+(lx+2.5)+' '+(lyy+4)+' h'+(lw-6)+' M'+(lx+2.5)+' '+(lyy+7)+' h'+(lw-9)+' M'+(lx+2.5)+' '+(lyy+10)+' h'+(lw-7)+'" stroke="#2A2118" stroke-width=".8" opacity=".7"/></g>';}
  return s;
}
function shelf(){
  var s='',Y=118;
  /* cobweb in the corner */
  s+='<g stroke="#C9D2CB" stroke-opacity=".16" fill="none" stroke-width=".8"><path d="M390 8 L340 8 M390 8 L352 34 M390 8 L372 52 M390 8 L390 58"/><path d="M362 8 Q366 20 371 21 Q378 31 381 30 Q386 36 390 34"/><path d="M348 8 Q354 28 361 28 Q372 44 376 42 Q384 50 390 46"/></g>';
  /* shelf plank with brackets */
  s+='<path d="M52 '+(Y+12)+' v16 q0 6 -14 8 M338 '+(Y+12)+' v16 q0 6 14 8" stroke="#0E1011" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M52 '+(Y+12)+' v16 q0 6 -14 8 M338 '+(Y+12)+' v16 q0 6 14 8" stroke="#3A4044" stroke-width="2" fill="none" stroke-linecap="round"/>';
  s+='<rect x="14" y="'+Y+'" width="362" height="12" rx="1.5" fill="url(#g-plank)"/><rect x="14" y="'+Y+'" width="362" height="1.6" fill="#fff" opacity=".16"/><rect x="14" y="'+(Y+12)+'" width="362" height="5" fill="#000" opacity=".5"/>';
  s+='<path d="M30 '+(Y+5)+' h60 M120 '+(Y+7)+' h90 M240 '+(Y+4)+' h110 M70 '+(Y+9)+' h40 M200 '+(Y+9)+' h70" stroke="#2A1A0D" stroke-width=".8" opacity=".6"/>';
  /* books lying flat */
  s+='<rect x="24" y="'+(Y-9)+'" width="46" height="9" rx="1" fill="#4A1F1F"/><rect x="24" y="'+(Y-9)+'" width="5" height="9" fill="#C5A253" opacity=".8"/><rect x="62" y="'+(Y-8)+'" width="8" height="7" fill="#E6D9B8"/>';
  s+='<rect x="28" y="'+(Y-17)+'" width="40" height="8" rx="1" fill="#1F3A2E"/><rect x="28" y="'+(Y-17)+'" width="4" height="8" fill="#C5A253" opacity=".8"/><rect x="61" y="'+(Y-16)+'" width="7" height="6" fill="#E6D9B8"/>';
  /* candle on the books */
  s+='<circle class="glow" cx="48" cy="'+(Y-52)+'" r="46" fill="url(#g-lamp)"/>';
  s+='<path d="M41 '+(Y-17)+' v-22 q0 -2 2 -2 h10 q2 0 2 2 v22 Z" fill="#EFE6CF"/><path d="M41 '+(Y-30)+' q-3 2 -2 9 q1 4 2 0 Z M55 '+(Y-34)+' q3 3 2 12 q-1 3 -2 0 Z" fill="#EFE6CF"/><rect x="41" y="'+(Y-39)+'" width="3" height="22" fill="#fff" opacity=".35"/>';
  s+='<path d="M48 '+(Y-41)+' v-4" stroke="#2A2118" stroke-width="1.2"/>';
  s+='<path class="flame" d="M48 '+(Y-62)+' q7 9 4 15 q-2 4 -4 4 q-2 0 -4 -4 q-3 -6 4 -15 Z" fill="#F08A1D"/><path class="flame" d="M48 '+(Y-54)+' q3.4 5 1.8 8.6 q-.9 2 -1.8 2 q-.9 0 -1.8 -2 q-1.6 -3.6 1.8 -8.6 Z" fill="#FFF3CF"/>';
  /* bottles */
  s+=bottle({n:1,type:'round',x:106,by:Y,r:19,level:22,color:'#3FA66B',bubbles:3,label:false});
  s+=bottle({n:2,type:'tall',x:152,by:Y,w:24,h:52,level:30,color:'#C98A2B',label:true,labelY:26,wax:'#8E1B1B'});
  s+=bottle({n:3,type:'cone',x:200,by:Y,w:42,h:44,level:18,color:'#7B5AA6',bubbles:2,neck:11});
  s+=bottle({n:4,type:'jar',x:250,by:Y,w:34,h:46,level:36,color:'#6E7B52',thing:true,label:true,labelY:20});
  s+=bottle({n:5,type:'tall',x:290,by:Y,w:18,h:60,level:44,color:'#8E1B1B',label:false});
  s+=bottle({n:6,type:'round',x:330,by:Y,r:15,level:12,color:'#6FB7C9',bubbles:1,label:false,neck:8});
  /* mortar and pestle */
  s+='<path d="M352 '+(Y-16)+' h28 q0 16 -14 16 q-14 0 -14 -16 Z" fill="#8A8F86"/><path d="M352 '+(Y-16)+' h28" stroke="#C9CEC4" stroke-width="2"/><path d="M370 '+(Y-17)+' l10 -17" stroke="#6E7269" stroke-width="5" stroke-linecap="round"/><path d="M370 '+(Y-17)+' l10 -17" stroke="#A9AEA4" stroke-width="2" stroke-linecap="round"/>';
  return s;
}
function tray(){
  var s='<rect x="0" y="4" width="374" height="12" rx="1.5" fill="url(#g-plank)"/><rect x="0" y="4" width="374" height="1.5" fill="#fff" opacity=".18"/><rect x="0" y="16" width="374" height="4" fill="#000" opacity=".45"/>';
  s+='<rect x="30" y="0" width="34" height="6" rx="2.5" fill="#EDEBDD"/><rect x="30" y="0" width="34" height="2" rx="1" fill="#fff" opacity=".6"/>';
  s+='<rect x="74" y="1" width="20" height="5.5" rx="2.5" fill="#E8D98A"/>';
  s+='<rect x="104" y="1.5" width="11" height="5" rx="2.4" fill="#EDEBDD"/>';
  s+='<rect x="290" y="-4" width="52" height="5" rx="1" fill="#7A5532"/><rect x="290" y="1" width="52" height="5" rx="1" fill="#33383A"/><rect x="292" y="-4" width="48" height="1.2" fill="#fff" opacity=".2"/>';
  s+='<g fill="#EDEBDD" opacity=".5"><circle cx="126" cy="5" r=".9"/><circle cx="140" cy="5.4" r=".7"/><circle cx="150" cy="4.8" r="1"/><circle cx="182" cy="5.2" r=".8"/><circle cx="262" cy="5" r=".9"/><circle cx="276" cy="5.4" r=".7"/></g>';
  return s;
}

export {rng, shade, r1, stoneWall, block, door, metal, strap, stud, pinnedCard, EXTRAS, tornRect, bottle, shelf, tray, W, H, CX, SPRING, RO, BOTTOM, RL};
