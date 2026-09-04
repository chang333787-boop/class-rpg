/* ==================================================================
   데생 따라하기 — 코스 콘텐츠 (2026-09-04, 10차시)
   index.html(엔진)이 ?course=drawing 일 때 이 파일을 읽는다.
   글만 바꾸면 되니 메모장으로도 수정할 수 있다. 차시 번호(id)는 0부터 빈틈없이.
   각 단계 = text(지시) · sub(보조) · press(0~3, 연필 힘) · art{type} · tip(선생님) · wait(초) · quiz
   ================================================================== */
(function(){
/* ---------- 그림 도우미 (이 파일 전용) ---------- */
const DEFS = `<defs>
<filter id="dtx" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 0.40  0 0 0 0 0.38  0 0 0 0 0.34  0 0 0 0.06 0"/></filter>
</defs>`;
const svg = s => `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg">${DEFS}${s}</svg>`;
const PAPER = `<rect x="20" y="20" width="360" height="220" rx="6" fill="#fbfaf5" stroke="#e0dcd0"/><rect x="20" y="20" width="360" height="220" rx="6" filter="url(#dtx)"/>`;
const INK = '#2a2a2a';
const OP = [.22,.42,.66,.92];            // 연필 힘 0~3 → 선의 진하기
const VOP = [0,.18,.38,.6,.85];          // 명도 1~5단계 → 면의 진하기 (0 = 흰 종이)
const G = (d, press=1, w=2.4, extra='') => `<path d="${d}" fill="none" stroke="${INK}" stroke-opacity="${OP[press]}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const SHADE = (x,y,w,h,level,extra='') => level>0?`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${INK}" fill-opacity="${VOP[level]}" ${extra}/>`:'';
const CAP = (t, y=248) => `<text x="200" y="${y}" font-size="15" text-anchor="middle" fill="#666">${t}</text>`;
const LBL = (x,y,t,size=13) => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="#666">${t}</text>`;
const PENCIL = (x,y,cls='',rot=35) => `<g class="${cls}" style="transform-origin:${x}px ${y}px"><g transform="translate(${x},${y}) rotate(${rot})">
  <rect x="-6" y="-104" width="12" height="76" rx="2" fill="#e8b84a"/><rect x="-6" y="-104" width="12" height="7" fill="#9aa39a"/>
  <path d="M-6 -28 L6 -28 L0 0 Z" fill="#e6cfa0"/><path d="M-2.4 -11 L2.4 -11 L0 0 Z" fill="${INK}"/></g></g>`;
const LIGHT = (x=58,y=50) => `<g class="tap"><circle cx="${x}" cy="${y}" r="12" fill="#f5d58a" stroke="#c8962e" stroke-width="2"/><path d="M${x+18} ${y+14} L${x+50} ${y+38}" stroke="#c8962e" stroke-width="3"/><path d="M${x+42} ${y+26} L${x+52} ${y+40} L${x+35} ${y+42}Z" fill="#c8962e"/></g>`;
const ERASER = (x,y,off) => `<g transform="translate(${x},${y}) rotate(-15)"><rect x="-26" y="-12" width="52" height="24" rx="4" fill="#f4f4f4" stroke="#aaa"/><rect x="-26" y="-12" width="22" height="24" rx="4" fill="#9fc5e8" stroke="#aaa"/>${off?`<path d="M-30 -18 L30 18 M30 -18 L-30 18" stroke="#d33" stroke-width="4" stroke-linecap="round"/>`:''}</g>`;
/* 해칭: 직사각형(x,y,w,h) 안에 간격 s로 선을 채움. dir = h | v | d1(＼) | d2(／) */
const HATCH = (x,y,w,h,s,dir,press,wd=1.6) => {
  const seg=[];
  if(dir==='h'){ for(let yy=y+s/2; yy<y+h; yy+=s) seg.push(`M${x} ${yy.toFixed(1)} H${x+w}`); }
  else if(dir==='v'){ for(let xx=x+s/2; xx<x+w; xx+=s) seg.push(`M${xx.toFixed(1)} ${y} V${y+h}`); }
  else if(dir==='d1'){ for(let c=x-(y+h); c<=x+w-y; c+=s*1.414){ const lo=Math.max(y,x-c), hi=Math.min(y+h,x+w-c); if(hi-lo>2) seg.push(`M${(lo+c).toFixed(1)} ${lo.toFixed(1)} L${(hi+c).toFixed(1)} ${hi.toFixed(1)}`); } }
  else { for(let c=x+y; c<=x+w+y+h; c+=s*1.414){ const lo=Math.max(y,c-x-w), hi=Math.min(y+h,c-x); if(hi-lo>2) seg.push(`M${(c-lo).toFixed(1)} ${lo.toFixed(1)} L${(c-hi).toFixed(1)} ${hi.toFixed(1)}`); } }
  return `<path d="${seg.join(' ')}" fill="none" stroke="${INK}" stroke-opacity="${OP[press]}" stroke-width="${wd}" stroke-linecap="round"/>`;
};
/* 명도 띠: 다섯 칸, fill = 각 칸의 단계(0~4) */
const VALUEBAR = (fill, x=50, y=70, w=60, h=110) => fill.map((lv,i)=>`<rect x="${x+i*w}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#bbb"/>${SHADE(x+i*w+1,y+1,w-2,h-2,lv)}`).join('');
const SKETCHY = (cx,cy,r,press=1) => [0,1,2].map(i=>G(`M${cx-r+i*2} ${cy} a${r} ${r-i*1.5} 0 1 0 ${r*2-i*3} 0 a${r} ${r+i} 0 1 0 ${-(r*2-i*3)} 0`, press, 1.6)).join('');
const HAND = (x,y,rot) => `<g transform="translate(${x},${y}) rotate(${rot})" opacity=".9"><ellipse cx="0" cy="22" rx="26" ry="20" fill="#f3d9c1" stroke="#c9a68a"/><ellipse cx="-16" cy="-2" rx="9" ry="16" fill="#f3d9c1" stroke="#c9a68a"/><ellipse cx="4" cy="-6" rx="8" ry="17" fill="#f3d9c1" stroke="#c9a68a"/></g>`;
const CUP = (x,y,s=1,press=1,inner=true) => `<g transform="translate(${x},${y}) scale(${s})">${G('M-30 -40 L-24 40 Q0 48 24 40 L30 -40',press,2.2)}${G('M-30 -40 a30 9 0 1 0 60 0 a30 9 0 1 0 -60 0',press,2.2)}${inner?G('M30 -20 q26 -2 24 20 q-2 22 -26 22',press,2.2):''}</g>`;
const APPLE = (x,y,s=1,press=1) => `<g transform="translate(${x},${y}) scale(${s})">${G('M-2 -30 q-30 -6 -34 22 q-2 30 26 40 q10 3 20 0 q28 -10 26 -40 q-4 -28 -34 -22 Z',press,2.2)}${G('M-2 -30 q2 -12 10 -16',press,2.2)}</g>`;

const ART = {
  /* 잡는 법 — mode: write(글씨 잡기) | lay(눕혀 잡기) */
  grip(a){ const lay=a.mode==='lay'; return svg(`${PAPER}
    ${lay?G('M110 170 Q200 150 300 168',0,26):G('M120 172 Q200 160 290 176',1,2.4)}
    ${PENCIL(lay?170:150,lay?168:172,'',lay?68:32)}
    ${HAND(lay?205:172,lay?128:120,lay?55:20)}
    ${lay?'':`<path d="M137 150 L157 136" stroke="#d33" stroke-width="2"/><circle cx="137" cy="150" r="5" fill="none" stroke="#d33" stroke-width="2"/>${LBL(150,126,'심에서 손가락 두 마디 위',13)}`}
    ${CAP(lay?'눕혀 잡기 → 심의 옆면이 닿아 넓고 연하게':'글씨 잡기 → 심 끝이 닿아 선이 또렷하게', 232)}`); },
  /* 힘 조절 — n: 보여줄 줄 수(1~4), mode:'wave'면 힘이 변하는 선 한 줄 */
  pressure(a){ const n=a.n||4;
    if(a.mode==='wave') return svg(`${PAPER}
      ${G('M50 130 Q120 110 200 130 T350 130',0,3)}${G('M120 124 Q170 112 220 128 Q245 134 280 130',1,4)}${G('M160 121 Q200 114 240 126',3,5,'class="row"')}
      ${PENCIL(250,132,'brush',35)}${CAP('살짝 → 세게 → 살짝, 연필을 떼지 않고 한 줄로')}`);
    return svg(`${PAPER}
    ${[0,1,2,3].slice(0,n).map(p=>`${G(`M120 ${70+p*40} Q220 ${62+p*40} 340 ${72+p*40}`,p,2+p*.8)}${LBL(75,75+p*40,['살짝','보통','세게','아주 세게'][p],14)}`).join('')}
    ${[0,1,2,3].slice(n).map(p=>`<path d="M120 ${70+p*40} Q220 ${62+p*40} 340 ${72+p*40}" fill="none" stroke="#ddd" stroke-width="1.5" stroke-dasharray="4 4"/>`).join('')}
    ${PENCIL(300,72+(n-1)*40,'brush',35)}
    ${CAP(n<4?'손가락 끝의 힘만 바꿔요':'네 줄이 계단처럼 달라 보이면 성공')}`); },
  /* 선 연습 — mode: noeraser | long | straight | curve | circle | all */
  lines(a){ const m=a.mode||'straight';
    if(m==='noeraser') return svg(`${PAPER}${ERASER(200,120,true)}${CAP('오늘은 지우개 없는 날. 틀린 선 위에 다시 그어요', 200)}`);
    if(m==='long') return svg(`${PAPER}${G('M40 90 L360 84',1,2.4,'class="row"')}${G('M40 130 L360 124',1,2.4,'class="row"')}${G('M40 170 L360 164',1,2.4,'class="row"')}
      <g class="tap"><path d="M60 226 q60 -40 120 -8" stroke="#d33" stroke-width="2.5" fill="none"/><path d="M172 210 L182 220 L168 224Z" fill="#d33"/></g>${LBL(120,238,'손목 ✕  팔꿈치를 들고 팔 전체로 ○',13)}
      ${PENCIL(330,166,'brush',35)}`);
    if(m==='straight') return svg(`${PAPER}${[0,1,2,3].map(i=>`<circle cx="60" cy="${70+i*36}" r="3.5" fill="#d33"/><circle cx="340" cy="${70+i*36}" r="3.5" fill="#d33"/>${i<3?G(`M60 ${70+i*36} L340 ${70+i*36}`,1,2.2,i===2?'class="row"':''):''}`).join('')}
      ${PENCIL(300,178,'brush',35)}${CAP('시작점·끝점을 먼저 찍고, 끝점을 보면서 한 번에')}`);
    if(m==='curve') return svg(`${PAPER}${G('M50 90 C110 40 150 140 210 90 S310 40 350 90',1,2.4,'class="row"')}${G('M50 160 Q90 120 130 160 T210 160 T290 160 T370 160',1,2.4,'class="row"')}${G('M60 210 q30 -30 60 0 q30 30 60 0 q30 -30 60 0 q30 30 60 0',1,2.4,'class="row"')}
      ${PENCIL(330,205,'brush',35)}${CAP('S자·물결, 팔로 크게')}`);
    if(m==='circle') return svg(`${PAPER}${SKETCHY(120,130,50,1)}${SKETCHY(240,130,34,1)}${SKETCHY(320,130,20,1)}
      <g class="tilt"><path d="M110 60 a22 12 0 1 1 22 12" stroke="#d33" stroke-width="2" fill="none" stroke-dasharray="4 3"/></g>${LBL(120,52,'허공에서 세 번 돌리고',12)}
      ${PENCIL(275,120,'brush',35)}${CAP('연하게 여러 번 돌려서, 겹친 선이 동그라미가 돼요')}`);
    return svg(`${PAPER}${G('M50 60 V200',1)}${G('M75 60 V200',2,3)}${G('M100 200 V60',0)}${G('M130 80 q20 -30 40 0 t40 0 t40 0',1)}${G('M130 130 q20 30 40 0 t40 0 t40 0',2,3)}${SKETCHY(180,190,28,1)}${SKETCHY(260,190,18,2)}${HATCH(300,60,60,60,7,'d1',1)}${HATCH(300,140,60,60,6,'h',2)}
      ${CAP('직선·곡선·동그라미·빗금으로 종이 한 장 채우기')}`); },
  /* 명도 띠 — fill: 다섯 칸의 단계 배열(0~4), still: 연필 없이 */
  valuebar(a){ const f=a.fill||[0,0,0,0,0]; const last=[...f].map((v,i)=>v>0?i:-1).filter(i=>i>=0).pop();
    return svg(`${PAPER}${VALUEBAR(f)}
    ${[1,2,3,4,5].map((n,i)=>LBL(80+i*60,200,n+'단계',13)).join('')}
    ${LBL(80,216,'흰 종이',12)}${LBL(320,216,'아주 세게',12)}
    ${a.still||last===undefined?'':PENCIL(80+last*60,120,'brush',60)}
    ${CAP(a.still?(a.flat?'칸끼리 차이가 안 보여요':'멀리서 보면 계단처럼 보여야 해요'):'연필을 눕혀서 같은 방향으로 고르게', 240)}`); },
  /* 해칭 — mode: one | cross | steps | curve | uneven */
  hatch(a){ const m=a.mode||'one';
    if(m==='one') return svg(`${PAPER}<rect x="90" y="60" width="220" height="130" fill="none" stroke="#bbb"/>${HATCH(90,60,220,130,9,'d2',1,1.8)}${PENCIL(250,140,'brush',35)}${CAP('한 방향, 같은 간격, 팔로 길게')}`);
    if(m==='cross') return svg(`${PAPER}<rect x="90" y="60" width="220" height="130" fill="none" stroke="#bbb"/>${HATCH(90,60,220,130,9,'d2',1,1.8)}<g class="fade-in">${HATCH(90,60,110,130,9,'d1',1,1.8)}</g>${LBL(145,208,'겹친 곳 = 더 어두움',13)}${LBL(255,208,'한 방향',13)}${PENCIL(190,120,'brush',35)}${CAP('그 위에 다른 방향으로 한 번 더')}`);
    if(m==='steps') return svg(`${PAPER}${[0,1,2,3].map(i=>{const x=50+i*78; return `<rect x="${x}" y="65" width="70" height="120" fill="none" stroke="#bbb"/>${HATCH(x,65,70,120,8,'d2',1,1.6)}${i>=1?HATCH(x,65,70,120,8,'d1',1,1.6):''}${i>=2?HATCH(x,65,70,120,8,'h',1,1.6):''}${i>=3?HATCH(x,65,70,120,8,'v',1,1.6):''}${LBL(x+35,205,['한 번','두 번','세 번','네 번'][i],13)}`;}).join('')}${CAP('겹친 횟수로 어두움을 만들어요 — 힘은 그대로')}`);
    if(m==='curve') return svg(`${PAPER}<circle cx="120" cy="130" r="60" fill="none" stroke="#bbb" stroke-dasharray="4 3"/>${[0,1,2,3,4,5].map(i=>G(`M${150+i*6} ${78+i*4} a${60-i*4} ${60-i*4} 0 0 1 ${-40+i*3} ${100-i*10}`,1,1.6)).join('')}${LBL(120,210,'둥근 것 → 둥근 방향',13)}
      <rect x="230" y="70" width="120" height="120" fill="none" stroke="#bbb" stroke-dasharray="4 3"/>${HATCH(290,70,60,120,8,'v',1,1.6)}${LBL(290,210,'납작한 면 → 곧은 방향',13)}${CAP('선의 방향이 모양을 따라가요')}`);
    /* uneven: 간격 들쭉날쭉, 짧게 끊긴 선 */
    const segs=[]; let x=95; let k=1; while(x<305){ const len=30+(k*37)%50; for(let y=64; y<186; y+=len+8){ segs.push(`M${x} ${y} l${Math.min(len,186-y)*.55} ${Math.min(len,186-y)}`); } x+=5+(k*13)%16; k++; }
    return svg(`${PAPER}<rect x="90" y="60" width="220" height="130" fill="none" stroke="#bbb"/><path d="${segs.join(' ')}" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="1.8" stroke-linecap="round"/>${CAP('간격이 들쭉날쭉, 선이 짧게 끊겨 지저분해요')}`); },
  /* 공 — stage 0~4, flat: 테두리만 진한 나쁜 예 */
  sphere(a){ const s=a.stage||0; const cx=200, cy=132, r=76;
    if(a.flat) return svg(`${PAPER}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}" fill-opacity=".3" stroke="${INK}" stroke-width="7" stroke-opacity=".9"/>${CAP('테두리만 진하고 안이 같은 회색이면 동전처럼 납작해요')}`);
    return svg(`${PAPER}${LIGHT()}
    ${s===0?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#e9e6de" stroke="#cfcac0"/><circle cx="172" cy="104" r="14" fill="#fff"/><ellipse cx="226" cy="216" rx="70" ry="12" fill="#cfcac0"/><g class="tap">${LBL(330,215,'빛은 왼쪽 위 ↖',13)}</g>`:''}
    ${s>=1?SKETCHY(cx,cy,r,1):''}
    ${s===1?`<circle cx="172" cy="104" r="17" fill="none" stroke="#d33" stroke-width="2" stroke-dasharray="4 3"/>${LBL(172,80,'제일 밝은 곳, 비워 두기',12)}`:''}
    ${s>=2?`<circle cx="${cx}" cy="${cy}" r="${r-1}" fill="${INK}" fill-opacity=".16" class="${s===2?'fade-in':''}"/><circle cx="172" cy="104" r="17" fill="#fbfaf5"/>`:''}
    ${s>=3?`<path d="M254 78 A76 76 0 0 1 146 186 A104 104 0 0 0 254 78Z" fill="${INK}" fill-opacity=".22" class="${s===3?'fade-in':''}"/><path d="M269 100 A76 76 0 0 1 168 205 A148 148 0 0 0 269 100Z" fill="${INK}" fill-opacity=".3" class="${s===3?'fade-in':''}"/>`:''}
    ${s>=4?`<path d="M275 118 A76 76 0 0 1 190 208 A92 92 0 0 0 275 118Z" fill="#fbfaf5" fill-opacity=".45" class="fade-in"/><ellipse cx="228" cy="216" rx="72" ry="12" fill="${INK}" fill-opacity=".55" class="fade-in"/><ellipse cx="212" cy="211" rx="40" ry="6" fill="${INK}" fill-opacity=".35" class="fade-in"/>`:''}
    ${s===2?PENCIL(250,150,'brush',60):''}${s===3?PENCIL(262,170,'brush',35):''}
    ${CAP(['빛을 비추고 밝은 곳·어두운 곳·그림자를 찾아요','동그라미 여러 번 돌려 그리고, 밝은 곳은 표시만','밝은 곳만 빼고 전체를 살짝','빛 반대쪽을 초승달처럼 더 어둡게 — 가장자리는 남기고','가장자리 살짝 밝게(반사광) + 바닥 그림자'][Math.min(s,4)])}`); },
  /* 재기 — stage 0 연필 눈금 · 1 높이=폭×? · 2 큰 네모 · 3 네모 안에 원 · 4 여러 물건 */
  measure(a){ const s=a.stage||0;
    const bottle = `<path d="M300 70 h30 v22 q14 6 14 22 v96 h-58 v-96 q14 -16 14 -22 Z" fill="#dfe7ec" stroke="#9fb0bb"/>`;
    if(s===0) return svg(`${PAPER}${bottle}
      <g transform="translate(150,150)"><rect x="-6" y="-88" width="12" height="70" rx="2" fill="#e8b84a"/><path d="M-6 -18 L6 -18 L0 0Z" fill="#e6cfa0"/><path d="M-2.4 -8 L2.4 -8 L0 0Z" fill="${INK}"/><rect x="-16" y="-24" width="32" height="14" rx="7" fill="#f3d9c1" stroke="#c9a68a"/><ellipse cx="0" cy="24" rx="24" ry="22" fill="#f3d9c1" stroke="#c9a68a"/></g>
      <path d="M40 120 L138 68" stroke="#888" stroke-width="1.5" stroke-dasharray="5 4"/><path d="M40 120 L138 132" stroke="#888" stroke-width="1.5" stroke-dasharray="5 4"/><circle cx="40" cy="120" r="9" fill="#fff" stroke="#555" stroke-width="2"/><circle cx="43" cy="120" r="4" fill="#555"/>
      ${LBL(150,48,'팔을 쭉 뻗고, 한 눈 감고',13)}${LBL(150,235,'엄지로 눈금 잡기',13)}${LBL(315,235,'물건의 폭 = 눈금 1',13)}`);
    if(s===1) return svg(`${PAPER}${bottle}
      <path d="M270 70 V210" stroke="#d33" stroke-width="2"/>${[70,105,140,175,210].map(y=>`<path d="M264 ${y} H276" stroke="#d33" stroke-width="2"/>`).join('')}${[0,1,2,3].map(i=>LBL(252,95+i*35,String(i+1),13)).join('')}
      <path d="M286 224 H344" stroke="#d33" stroke-width="2"/><path d="M286 218 V230 M344 218 V230" stroke="#d33" stroke-width="2"/>
      ${LBL(120,110,'폭 하나 = 눈금 1',15)}${LBL(120,140,'높이 = 눈금 4개',15)}${LBL(120,170,'→ "높이는 폭의 4배"',15)}`);
    if(s===2) return svg(`${PAPER}<rect x="255" y="60" width="70" height="160" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 4"/>${LBL(290,238,'폭 1 : 높이 4',13)}
      <rect x="60" y="120" width="120" height="70" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 4"/>${LBL(120,210,'폭 2 : 높이 1',13)}${PENCIL(190,120,'brush',35)}${CAP('잰 비율대로 큰 네모를 살짝', 60)}`);
    if(s===3) return svg(`${PAPER}<rect x="70" y="70" width="120" height="120" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 4"/>${SKETCHY(130,130,60,1)}${[[130,70],[130,190],[70,130],[190,130]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4" fill="#d33"/>`).join('')}${LBL(130,212,'네 변 가운데에 닿게',13)}
      <rect x="255" y="60" width="70" height="160" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 4"/>${G('M270 60 v22 q-14 6 -14 22 v116 h58 v-116 q-14 -16 -14 -22 v-22',1,2.2,'class="fade-in"')}${LBL(290,238,'네모 안에서 모양 찾기',13)}`);
    return svg(`${PAPER}
      <rect x="40" y="90" width="120" height="50" fill="none" stroke="${INK}" stroke-opacity=".3" stroke-width="2" stroke-dasharray="5 4"/>${G('M44 98 q56 -6 112 0 v34 q-56 6 -112 0 Z',1,2)}${LBL(100,160,'필통',13)}
      <rect x="180" y="50" width="60" height="150" fill="none" stroke="${INK}" stroke-opacity=".3" stroke-width="2" stroke-dasharray="5 4"/>${G('M196 50 v24 q-16 6 -16 22 v104 h60 v-104 q-16 -16 -16 -22 v-24',1,2)}${LBL(210,220,'병',13)}
      <rect x="270" y="90" width="90" height="90" fill="none" stroke="${INK}" stroke-opacity=".3" stroke-width="2" stroke-dasharray="5 4"/>${SKETCHY(315,135,45,1)}${LBL(315,200,'공',13)}
      ${CAP('네모 먼저 → 그 안에 모양')}`); },
  /* 정육면체 — stage 0 관찰 · 1 선 그리기 · 2 세 면 명암 · 3 가까운 모서리 진하게, flat: 나쁜 예 */
  box(a){ const s=a.stage||0;
    const front='M140 110 h100 v100 h-100 Z', top='M140 110 l40 -30 h100 l-40 30 Z', side='M240 110 l40 -30 v100 l-40 30 Z';
    if(a.flat) return svg(`${PAPER}${LIGHT()}<path d="${top}" fill="${INK}" fill-opacity=".4"/><path d="${front}" fill="${INK}" fill-opacity=".4"/><path d="${side}" fill="${INK}" fill-opacity=".4"/>${G(front+top+side,2,2)}${CAP('세 면이 같은 진하기면 납작한 종이처럼 보여요')}`);
    if(s===0) return svg(`${PAPER}${LIGHT()}<path d="${top}" fill="#efece4" stroke="#bbb"/><path d="${front}" fill="#d9d5cc" stroke="#bbb"/><path d="${side}" fill="#b9b4aa" stroke="#bbb"/>${LBL(210,95,'위',15)}${LBL(190,165,'앞',15)}${LBL(262,150,'옆',15)}${CAP('보이는 면은 세 개 — 눈보다 낮게 놓아야 윗면이 보여요')}`);
    if(s===1) return svg(`${PAPER}${G(front,1,2.2)}${[[140,110],[240,110],[240,210]].map(([x,y])=>G(`M${x} ${y} l40 -30`,1,2.2,'class="row"')).join('')}<g class="fade-in">${G('M180 80 h100 v100',1,2.2)}</g>${PENCIL(300,190,'brush',35)}${CAP('앞 네모 → 뒤로 비스듬한 선 셋(같은 방향, 같은 길이) → 잇기')}`);
    return svg(`${PAPER}${LIGHT()}<path d="${front}" fill="${INK}" fill-opacity=".3"/><path d="${side}" fill="${INK}" fill-opacity=".6"/>${G(front+top+side,1,1.6)}
      ${s>=3?`<g class="fade-in">${G('M140 110 v100 h100 v-100 Z',3,3.6)}${G('M240 110 v100',3,3.6)}${G('M140 110 l40 -30',2,2.4)}${G('M240 110 l40 -30',2,2.4)}</g><ellipse cx="238" cy="222" rx="72" ry="10" fill="${INK}" fill-opacity=".45" class="fade-in"/>`:''}
      ${s===2?PENCIL(300,150,'brush',60):''}
      ${CAP(s===2?'위는 비우고, 앞은 보통, 옆은 어둡게 — 면마다 고르게':'가까운 모서리는 진하게, 먼 모서리는 연하게')}`); },
  /* 원기둥 — stage 0 선 · 1 세로 해칭 명암, flat: 나쁜 예 */
  cylinder(a){ const s=a.stage||0; const cx=180, top=70, bot=190, rx=70, ry=18;
    const outline = G(`M${cx-rx} ${top} V${bot} A${rx} ${ry} 0 0 0 ${cx+rx} ${bot} V${top}`,1,2)+G(`M${cx-rx} ${top} a${rx} ${ry} 0 1 0 ${rx*2} 0 a${rx} ${ry} 0 1 0 ${-rx*2} 0`,1,2);
    let lines=''; if(s>=1){ const n=22; const parts=[]; for(let i=0;i<n;i++){ const x=cx-rx+6+i*((rx*2-12)/(n-1)); const t=Math.min(1,Math.max(0,((x-cx)/rx+1)/2)); const dy=ry*Math.sqrt(Math.max(0,1-((x-cx)/rx)**2)); const o=a.flat?.45:(.12+t*.8); if(o>.18||a.flat) parts.push(`<path d="M${x.toFixed(1)} ${(top+dy).toFixed(1)} V${(bot+dy).toFixed(1)}" stroke="${INK}" stroke-opacity="${o.toFixed(2)}" stroke-width="${(1.4+t*1.6).toFixed(1)}" stroke-linecap="round"/>`); } lines=`<g fill="none">${parts.join('')}</g>`; }
    return svg(`${PAPER}${LIGHT()}${lines}${outline}${s>=1&&!a.flat?`<ellipse cx="${cx+40}" cy="${bot+ry+6}" rx="66" ry="10" fill="${INK}" fill-opacity=".5"/>`:''}${s===0?PENCIL(280,150,'brush',35):''}
    ${CAP(a.flat?'선이 다 같은 진하기라 둥글지 않아요':s===0?'위는 납작한 타원, 세로 두 줄, 아래는 곡선':'세로 해칭: 왼쪽 연하게 → 오른쪽 진하게, 가장자리는 살짝 남기기')}`); },
  /* 윤곽선 관찰 — mode: look(기본) | blind | symbol | compare, stage 0 관찰 · 1 바깥선 · 2 안쪽 선 */
  contour(a){ const m=a.mode||'look', s=a.stage===undefined?1:a.stage;
    const real = `<g transform="translate(110,130)"><path d="M-36 -46 L-29 48 Q0 58 29 48 L36 -46 Z" fill="#dfe7ec" stroke="#9fb0bb"/><ellipse cx="0" cy="-46" rx="36" ry="11" fill="#eef3f6" stroke="#9fb0bb"/><path d="M36 -24 q32 -2 30 24 q-2 26 -32 26" fill="none" stroke="#9fb0bb" stroke-width="7"/></g>`;
    if(m==='blind') return svg(`${PAPER}${real}<rect x="220" y="40" width="150" height="190" fill="#f1efe8" stroke="#ddd"/>
      ${G('M262 78 l-4 96 q28 14 52 -4 l-2 -84 q-22 -14 -46 -6 m 50 24 q30 6 22 32 q-8 20 -30 14',1,2.2,'class="row"')}
      <g class="tap"><path d="M60 40 q20 -18 40 0" stroke="#d33" stroke-width="2.5" fill="none"/><circle cx="80" cy="40" r="5" fill="#d33"/></g>${LBL(80,60,'눈은 물건만',12)}${LBL(295,246,'종이는 보지 않아요',13)}${PENCIL(320,150,'brush',35)}`);
    if(m==='symbol') return svg(`${PAPER}${G('M120 90 h100 v100 h-100 Z',2,2.4)}<circle cx="170" cy="90" r="50" fill="none" stroke="${INK}" stroke-opacity=".66" stroke-width="2.4"/>${G('M220 110 h30 v50 h-30',2,2.4)}${CAP('기억으로 그린 컵 — 입구가 동그라미, 몸통이 네모')}`);
    if(m==='compare') return svg(`${PAPER}<rect x="40" y="50" width="140" height="160" fill="#f1efe8" stroke="#ddd"/><rect x="220" y="50" width="140" height="160" fill="#f1efe8" stroke="#ddd"/>
      <g transform="translate(110,130) scale(.8)">${G('M-30 -40 l-4 84 q28 14 52 -4 l-2 -76 q-22 -14 -46 -4 m 50 22 q30 6 22 32 q-8 20 -30 14',1,2.4)}</g>${CUP(290,130,.9,1,true)}
      ${LBL(110,232,'안 보고 그린 것',13)}${LBL(290,232,'보고 그린 것',13)}${CAP('어느 쪽이 더 컵 같아 보이나요? 왜?', 40)}`);
    if(s===0) return svg(`${PAPER}${real}<g transform="translate(110,130)"><path d="M-36 -46 L-29 48 Q0 58 29 48 L36 -46" fill="none" stroke="#d33" stroke-width="2.5" stroke-dasharray="6 4" class="row"/></g>
      <g transform="translate(270,120)"><circle r="30" fill="none" stroke="#bbb" stroke-width="3" stroke-dasharray="5 4"/><circle cx="-4" cy="-4" r="13" fill="none" stroke="#888" stroke-width="3"/><line x1="6" y1="6" x2="18" y2="18" stroke="#888" stroke-width="3" stroke-linecap="round"/></g>${LBL(270,180,'1분 동안 보기만',14)}${LBL(270,200,'테두리를 눈으로 따라가요',12)}`);
    return svg(`${PAPER}${real}<rect x="220" y="40" width="150" height="190" fill="#f1efe8" stroke="#ddd"/>
      ${CUP(295,135,1,1,s>=2)}${s>=2?`<g class="fade-in">${G('M269 95 q26 -4 52 0',1,1.8)}${G('M325 115 q18 0 16 18 q-2 14 -18 16',1,1.8)}</g>`:''}
      ${PENCIL(340,190,'brush',35)}${LBL(295,246,s>=2?'입구는 납작한 타원, 손잡이 안쪽 선도':'눈은 물건 70%, 종이 30%. 천천히',12)}`); },
  /* 질감 — kind: wood | cloth | glass | all */
  texture(a){ const k=a.kind||'all';
    const wood=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#bbb"/>${[0,1,2,3,4,5].map(i=>G(`M${x+4} ${y+10+i*(h-20)/5+(i%2)*3} q${w*.25} ${-6+(i%3)*4} ${w*.5} 0 t${w*.5-8} ${2-(i%2)*4}`,i%3===0?2:1,1.4+(i%2)*.6)).join('')}${G(`M${x+w*.55} ${y+h*.5} a10 6 0 1 0 20 0 a10 6 0 1 0 -20 0`,2,1.6)}${G(`M${x+w*.5} ${y+h*.5} a16 10 0 1 0 32 0 a16 10 0 1 0 -32 0`,1,1.4)}`;
    const cloth=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#bbb"/>${[0,1,2,3].map(i=>{const px=x+12+i*(w-24)/3; return `${G(`M${px} ${y+6} q${(i%2?-1:1)*10} ${h*.5} ${(i%2?-6:6)} ${h-12}`,2,2.4)}${G(`M${px+7} ${y+6} q${(i%2?-1:1)*10} ${h*.5} ${(i%2?-6:6)} ${h-12}`,1,1.4)}${G(`M${px-7} ${y+6} q${(i%2?-1:1)*10} ${h*.5} ${(i%2?-6:6)} ${h-12}`,1,1.4)}`;}).join('')}`;
    const glass=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#bbb"/>${G(`M${x+w*.25} ${y+14} l${w*.06} ${h-28} h${w*.38} l${w*.06} ${-(h-28)}`,1,2)}${G(`M${x+w*.25} ${y+14} a${w*.25} 6 0 1 0 ${w*.5} 0 a${w*.25} 6 0 1 0 ${-w*.5} 0`,1,2)}${G(`M${x+w*.31} ${y+30} v${h-56}`,2,3)}${G(`M${x+w*.66} ${y+24} v${h-44}`,1,1.6)}${G(`M${x+w*.34} ${y+h-24} q${w*.16} 8 ${w*.32} 0`,2,2)}`;
    if(k==='wood') return svg(`${PAPER}${wood(70,60,260,130)}${PENCIL(300,150,'brush',35)}${CAP('결 방향으로 긴 곡선, 옹이는 돌아서 흘러가요')}`);
    if(k==='cloth') return svg(`${PAPER}${cloth(70,60,260,130)}${PENCIL(300,150,'brush',35)}${CAP('주름 골짜기는 진하게, 산은 비워 두기')}`);
    if(k==='glass') return svg(`${PAPER}${glass(70,50,260,150)}${PENCIL(300,150,'brush',35)}${CAP('테두리와 반사만 그리고 가운데는 비워요')}`);
    return svg(`${PAPER}${wood(40,60,100,120)}${cloth(150,60,100,120)}${glass(260,50,100,130)}${LBL(90,205,'나무결',14)}${LBL(200,205,'천 주름',14)}${LBL(310,205,'유리',14)}${CAP('선의 방향·굵기·간격이 재질을 만들어요')}`); },
  /* 정물 — stage 0 배치 · 1 재기와 네모 · 2 윤곽 · 3 명암 3단계 · 4 어두운 곳과 그림자 · 5 완성 */
  still(a){ const s=a.stage||0;
    const cupBox=`<rect x="120" y="60" width="80" height="120" fill="none" stroke="${INK}" stroke-opacity=".3" stroke-width="2" stroke-dasharray="5 4"/>`, appleBox=`<rect x="170" y="120" width="90" height="80" fill="none" stroke="${INK}" stroke-opacity=".3" stroke-width="2" stroke-dasharray="5 4"/>`;
    if(s===0) return svg(`${PAPER}${LIGHT()}<rect x="60" y="180" width="280" height="40" fill="#f1efe8"/>
      <g transform="translate(160,125)"><path d="M-36 -46 L-29 48 Q0 58 29 48 L36 -46 Z" fill="#dfe7ec" stroke="#9fb0bb"/><ellipse cx="0" cy="-46" rx="36" ry="11" fill="#eef3f6" stroke="#9fb0bb"/></g>
      <g transform="translate(215,160)"><path d="M-2 -30 q-30 -6 -34 22 q-2 30 26 40 q10 3 20 0 q28 -10 26 -40 q-4 -28 -34 -22 Z" fill="#e2b3a8" stroke="#b07d72"/><path d="M-2 -30 q2 -12 10 -16" fill="none" stroke="#6b4a2a" stroke-width="3"/></g>
      ${CAP('하나는 뒤, 하나는 앞에 살짝 겹치게 — 빛은 한쪽에서')}`);
    if(s===1) return svg(`${PAPER}${cupBox}${appleBox}<path d="M100 60 V180" stroke="#d33" stroke-width="2"/>${[60,100,140,180].map(y=>`<path d="M94 ${y} H106" stroke="#d33" stroke-width="2"/>`).join('')}${LBL(84,124,'3',13)}<path d="M275 120 V200" stroke="#d33" stroke-width="2"/>${[120,160,200].map(y=>`<path d="M269 ${y} H281" stroke="#d33" stroke-width="2"/>`).join('')}${LBL(292,164,'2',13)}${CAP('컵 높이가 3이면 사과는 2 — 네모 두 개를 살짝')}`);
    const cup = CUP(160,125,1.1,1,false), apple = APPLE(215,160,1.1,1);
    if(s===2) return svg(`${PAPER}${cupBox}${appleBox}${cup}${apple}${PENCIL(300,180,'brush',35)}${CAP('네모 안에서 모양 찾기 — 겹친 곳은 앞 물건이 이겨요')}`);
    const shade = `<path d="M127 75 L133 174 Q160 186 187 174 L193 75 Z" fill="${INK}" fill-opacity=".16"/><path d="M175 78 L184 172 Q192 182 187 174 L193 75 Z" fill="${INK}" fill-opacity=".28"/><path d="M186 137 q-32 -6 -37 24 q-2 32 28 44 q11 3 22 0 q30 -10 28 -44 q-4 -30 -37 -24 Z" fill="${INK}" fill-opacity=".16"/><path d="M232 150 q22 12 12 44 q-6 12 -20 16 q30 -10 28 -44 q-3 -12 -20 -16 Z" fill="${INK}" fill-opacity=".3"/><circle cx="200" cy="150" r="8" fill="#fbfaf5"/><ellipse cx="170" cy="88" rx="8" ry="30" fill="#fbfaf5" fill-opacity=".9"/>`;
    const dark = `<g class="fade-in"><path d="M234 158 q16 14 8 40 q-5 10 -16 13 q24 -8 24 -40 q-2 -8 -16 -13 Z" fill="${INK}" fill-opacity=".45"/><path d="M181 90 L187 168 Q190 174 187 174 L193 84 Z" fill="${INK}" fill-opacity=".4"/><ellipse cx="258" cy="208" rx="60" ry="9" fill="${INK}" fill-opacity=".5"/><ellipse cx="196" cy="182" rx="44" ry="7" fill="${INK}" fill-opacity=".45"/><path d="M133 174 Q160 186 187 174 v4 Q160 192 133 178Z" fill="${INK}" fill-opacity=".6"/></g>`;
    if(s===3) return svg(`${PAPER}${LIGHT()}${shade}${cup}${apple}${PENCIL(300,180,'brush',60)}${CAP('밝음·중간·어두움 세 단계만 — 밝은 곳은 비워요')}`);
    if(s===4) return svg(`${PAPER}${LIGHT()}${shade}${dark}${cup}${apple}${PENCIL(300,180,'brush',35)}${CAP('물건이 바닥에 닿는 곳이 제일 진하게, 그림자는 빛 반대쪽')}`);
    return svg(`${PAPER}${LIGHT()}${shade}${dark}${cup}${apple}<path d="M60 224 H180" stroke="#aaa" stroke-width="1.5"/>${LBL(120,218,'제목 · 이름',12)}<g class="tap"><path d="M300 90 h60 v26 h-44 l-8 9 v-9 h-8Z" fill="#fff" stroke="#888"/><text x="330" y="108" font-size="12" text-anchor="middle" fill="#555">좋은 점 하나</text></g>${CAP('멀리서 한 번 보고, 제목을 붙여요')}`); },
};

/* ---------- 차시 ---------- */
const LESSONS = [
{
  id:0, part:1, title:'연필 잡기와 힘 조절', tech:'연필 잡는 법 2가지 · 힘 4단계', std:'[4미02-02] 재료와 용구의 특성 이해, 사용 방법 익히기 · [4미01-01] 다양한 감각 탐색', goal:'연필을 두 가지로 잡아 보고, 힘을 바꿔 연한 선부터 진한 선까지 그어요',
  materials:['연필 4B(주로 씀)','연필 2B','지우개','도화지 2장','화판 또는 책받침','연필깎이','손 밑에 깔 종이 한 장'],
  steps:[
    { text:'연필 4B를 글씨 쓰듯 잡아요. 심에서 손가락 두 마디쯤 위를.', sub:'너무 아래를 잡으면 손이 그림을 가려요.', art:{type:'grip', mode:'write'},
      tip:'<b>4B를 쓰는 이유:</b> 심이 무르고 진해서 힘 차이가 바로 보입니다. HB·2H는 아무리 눌러도 연해서 힘 조절 연습이 안 됩니다. 심 바로 위를 움켜쥐는 아이가 많은데, 그러면 힘이 세져 모든 선이 진해지고 손이 종이를 가립니다. "심에서 손가락 두 마디"를 직접 재 보게 하세요.' },
    { text:'이번엔 연필을 눕혀 잡아요. 엄지와 네 손가락으로 연필을 감싸듯.', sub:'심의 옆면이 종이에 닿아요. 넓게 칠할 때 쓰는 잡기예요.', art:{type:'grip', mode:'lay'},
      tip:'글씨 잡기는 선, 눕혀 잡기는 면(명암)입니다. 눕혀 잡으면 손날이 종이에 닿아 이미 그린 곳이 번지므로, 손 밑에 종이 한 장을 깔게 하세요. 어색해하는 아이에게는 "연필로 종이를 쓸어 준다"고 말해 주면 됩니다. 두 잡기를 오늘 여러 번 바꿔 보게 하세요.' },
    { text:'살짝 한 줄, 보통 한 줄. 손가락 끝의 힘만 바꿔요.', sub:'살짝 = 연필 무게만으로. 종이에 닿을락 말락.', press:0, art:{type:'pressure', n:2},
      tip:'네 단계 중 아이들이 가장 못 하는 것이 "살짝"입니다. 세게는 누구나 되지만, 연필 무게만으로 긋는 것은 연습이 필요합니다. 살짝 그은 선이 잘 안 보이면 정상입니다. 안 보인다고 다시 진하게 긋는 아이에게는 "지금이 맞아"라고 말해 주세요.' },
    { text:'세게 한 줄, 아주 세게 한 줄. 네 줄이 계단처럼 달라야 해요.', sub:'아주 세게는 종이가 눌릴 정도. 그림에서는 거의 안 써요.', press:3, art:{type:'pressure', n:4},
      tip:'"아주 세게"는 종이가 눌려 나중에 지우개로도 안 지워진다는 것을 알려 주세요. 그래서 그림에서는 3단계(세게)까지만 쓰고, 4단계는 마지막 제일 어두운 곳에만 씁니다. 네 줄이 비슷하게 나온 아이는 대부분 1·2단계가 진한 경우이니 살짝부터 다시.' },
    { text:'손목은 가만히, 팔꿈치를 들고 팔 전체로 긴 선을 그어요.', sub:'종이 끝에서 끝까지, 한 번에.', press:1, art:{type:'lines', mode:'long'},
      tip:'손목만 쓰면 선이 짧고 휘어지며 한쪽으로 기웁니다. 팔꿈치를 책상에서 떼고 어깨로 긋게 하세요. 화판을 세우거나 서서 그리면 저절로 팔을 쓰게 됩니다. "손목은 붙이고 팔을 움직여"라고 여러 번 말해 주어야 합니다.' },
    { text:'연필을 떼지 않고, 힘을 바꾸며 한 줄로. 살짝 → 세게 → 살짝.', sub:'선 하나 안에서 진하기가 변해요.', press:2, art:{type:'pressure', mode:'wave'},
      tip:'선 하나에 밝고 어두움이 생기는 것을 보여 주는 단계입니다. 이것이 다음 차시들의 명암으로 이어집니다. 잘 안 되면 손 대신 목소리로 "살짝, 세게, 살짝"을 함께 말하며 긋게 하면 리듬이 생깁니다([4미01-01] 감각 탐색).' },
  ],
  check:{ q:'연필과 친해졌나요?',
    items:['글씨 잡기와 눕혀 잡기를 둘 다 해 봤어요','살짝·보통·세게·아주 세게 네 줄이 다르게 보여요','팔 전체로 긴 선을 그었어요','힘을 바꾸는 선 한 줄을 그었어요'] }
},
{
  id:1, part:1, title:'선 연습', tech:'직선 · 곡선 · 동그라미', std:'[4미02-03] 조형 요소(선) 탐색 · [4미02-02] 용구 사용', goal:'긴 직선을 한 번에 긋고, 곡선과 동그라미를 여러 번 돌려 그려요',
  materials:['연필 4B','도화지 2장','화판 또는 책받침','(지우개는 필통에 넣어 두기)'],
  steps:[
    { text:'지우개를 필통에 넣어요. 오늘은 지우개 없는 날.', sub:'틀린 선은 지우지 않고, 그 위에 다시 그어요.', art:{type:'lines', mode:'noeraser'},
      tip:'<b>지우개 금지 이유:</b> 틀린 선 위에 다시 그으면 눈이 바른 선을 찾아갑니다. 지우개를 쓰면 종이가 상하고, 지우는 데 시간을 다 씁니다. 처음 그은 선을 "연습 선"이라고 부르게 하세요. 오늘 결과물은 지저분한 것이 정상이고, 그것을 평가하지 않는다고 미리 말해 두세요.' },
    { text:'긴 직선을 한 번에. 시작점과 끝점을 먼저 찍고, 끝점을 보면서 그어요.', sub:'같은 간격으로 열 줄.', press:1, art:{type:'lines', mode:'straight'},
      tip:'연필 끝을 보고 그으면 휘고, 끝점을 보고 그으면 곧게 됩니다. 짧게 이어 긋는(털을 그리듯 찍찍) 것이 가장 흔한 실수입니다. "쓱" 한 번에. 자를 대지 않게 하세요. 조금 휘어도 한 번에 그은 선이 이어 그은 선보다 좋다고 말해 주세요.' },
    { text:'곡선: 큰 S자, 물결. 팔로 크게.', sub:'세 줄씩, 점점 더 크게.', press:1, art:{type:'lines', mode:'curve'},
      tip:'곡선도 팔로 긋습니다. 손목만 쓰면 작고 각진 물결이 됩니다. 종이를 돌려 가며 편한 방향으로 긋는 것도 허용하세요(손은 안쪽으로 당기는 곡선이 가장 편합니다).' },
    { text:'동그라미: 연필을 든 채 허공에서 세 번 돌리고, 내려서 연하게 여러 번 돌려 그려요.', sub:'한 번에 그리지 않아요. 겹친 선이 동그라미가 돼요.', press:0, art:{type:'lines', mode:'circle'},
      tip:'한 번에 그리려 하면 찌그러집니다. "허공에서 돌리기 → 내려서 연하게 여러 번"이 방법입니다. 여러 겹 선 중 좋은 선이 저절로 보입니다. 크기를 바꿔 큰 것·중간·작은 것을 그리게 하세요. 이 방법이 다음 차시들(공, 사과)의 밑그림 방법입니다.' },
    { text:'직선·곡선·동그라미·빗금을 섞어 종이 한 장을 채워요.', sub:'굵게, 가늘게, 연하게, 진하게.', press:2, art:{type:'lines', mode:'all'},
      tip:'선의 종류(곧은·굽은·둥근), 굵기, 진하기를 말로 이야기하게 하면 조형 요소로서의 "선"을 익히는 활동이 됩니다([4미02-03]). 다 채운 뒤 "어느 선이 제일 마음에 드니? 왜?"를 물어보세요. 음악을 틀고 리듬에 맞춰 긋게 해도 좋습니다.' },
  ],
  check:{ q:'선을 마음대로 그을 수 있나요?',
    items:['지우개 없이 끝까지 했어요','긴 직선을 한 번에 그었어요','곡선을 팔로 크게 그렸어요','동그라미를 여러 번 돌려 그렸어요','종이 한 장을 여러 선으로 채웠어요'] }
},
{
  id:2, part:2, title:'명도 띠 5단계', tech:'명도 단계 · 눕혀 칠하기', std:'[4미02-03] 조형 요소(명암) 탐색 · [4미02-02] 용구 사용', goal:'연필 하나로 흰 종이부터 제일 어두운 색까지 다섯 단계를 만들어요',
  materials:['연필 4B','연필 2B','도화지','자','손 밑에 깔 종이'],
  steps:[
    { text:'자로 긴 네모를 그리고 다섯 칸으로 나눠요. 첫 칸은 비워 둬요.', sub:'흰 종이가 1단계예요. 칸은 손가락 두 개 폭.', art:{type:'valuebar', fill:[0,0,0,0,0]},
      tip:'"흰 종이가 가장 밝은 단계"라는 것이 첫 개념입니다. 데생에서 밝은 곳은 칠해서 만드는 것이 아니라 남겨서 만듭니다. 칸이 작으면 고르게 칠하는 연습이 안 되니 칸 하나가 3cm 이상 되게 하세요.' },
    { text:'연필을 눕혀 잡고, 마지막 5칸을 아주 세게, 고르게 채워요.', sub:'같은 방향으로 여러 번 겹쳐서. 빈틈 없이.', press:3, art:{type:'valuebar', fill:[0,0,0,0,4]},
      tip:'양 끝(흰 종이, 제일 어두움)을 먼저 정하면 가운데 단계를 나누기 쉽습니다. 고르게 칠하는 요령은 "한 방향으로 여러 번"입니다. 이리저리 방향을 바꾸면 얼룩이 집니다. 4B로도 안 어두워지면 2B와 겹쳐 칠하게 하세요.' },
    { text:'2칸은 살짝. 연필 무게만으로.', sub:'흰 종이와 구별될 만큼만.', press:0, art:{type:'valuebar', fill:[0,1,0,0,4]},
      tip:'1차시의 "살짝"이 여기서 쓰입니다. 2칸이 진하게 나오면 나머지 단계가 다 몰려 버리니, 2칸은 "거의 안 보일 정도"가 맞다고 말해 주세요. 눕혀 잡고 힘을 거의 주지 않은 채 쓸어 줍니다.' },
    { text:'3칸은 보통, 4칸은 세게. 양쪽 칸과 비교하면서.', sub:'3칸은 2칸보다 어둡고 5칸보다 밝게.', press:2, art:{type:'valuebar', fill:[0,1,2,3,4]},
      tip:'옆 칸과 비교하며 칠하게 하세요. 한 번에 맞추지 말고 연하게 채운 뒤 부족하면 한 겹 더 얹는 방식이 실패가 적습니다. 진하게 나온 칸은 되돌리기 어렵습니다.' },
    { text:'손가락으로 문지르지 않기! 팔을 뻗어 멀리서 봐요. 계단처럼 보이나요?', sub:'문지르면 얼룩이 지고 종이가 더러워져요.', art:{type:'valuebar', fill:[0,1,2,3,4], still:true},
      tip:'손가락으로 문지르면 당장은 부드러워 보여도 얼룩이 지고 손때가 묻어 회색 종이가 됩니다. "어두움은 겹쳐 칠해서 만든다"를 규칙으로. 멀리서 보면 칸끼리 차이가 나는지 바로 보입니다. 이 띠는 앞으로 명암을 넣을 때마다 옆에 두고 비교하는 자가 됩니다.' },
  ],
  check:{ q:'다섯 칸이 계단처럼 밝음 → 어두움으로 보이나요?',
    good:{art:{type:'valuebar', fill:[0,1,2,3,4], still:true}, text:'칸마다 차이가 뚜렷해요.'},
    bad:{art:{type:'valuebar', fill:[0,2,2,3,3], still:true, flat:true}, text:'가운데 칸들이 비슷해요. 2칸은 더 살짝, 5칸은 더 세게.'},
    tip:'비슷하게 나온 학생은 대부분 2칸이 진하거나 5칸이 연한 경우입니다. 양 끝부터 다시 잡게 하세요. 한 색으로 여러 밝기를 낼 수 있다는 것이 오늘의 핵심이고, 이것이 3~4학년군 조형 요소 "명암"입니다.' }
},
{
  id:3, part:2, title:'해칭과 크로스해칭', tech:'해칭 · 크로스해칭', std:'[4미02-03] 조형 요소(선·명암) 탐색', goal:'나란한 선을 겹쳐서 어두움을 만들어요',
  materials:['연필 4B','도화지','자(칸 그리기용)'],
  steps:[
    { text:'한 방향으로 나란한 선을 같은 간격으로 그어요. (해칭)', sub:'팔로 길게. 짧게 끊지 않아요.', press:1, art:{type:'hatch', mode:'one'},
      tip:'간격이 같아야 선들이 하나의 면으로 보입니다. 1차시 긴 선 긋기가 그대로 쓰입니다. 비스듬한 방향(／)이 손에 가장 편합니다. 처음엔 자로 칸을 그려 주고 그 안을 채우게 하면 집중이 됩니다.' },
    { text:'그 위에 다른 방향 선을 겹쳐요. 겹친 곳이 어두워져요. (크로스해칭)', sub:'직각보다 살짝 기울여 겹치면 자연스러워요.', press:1, art:{type:'hatch', mode:'cross'},
      tip:'힘을 더 주지 않아도 겹치면 어두워진다는 것을 보게 하세요. 겹친 곳과 안 겹친 곳을 나란히 두고 비교하게 합니다. 직각으로 겹치면 그물처럼 딱딱해 보이니 살짝 기울여 겹치게 하세요.' },
    { text:'한 번, 두 번, 세 번, 네 번 겹친 칸 네 개를 만들어요.', sub:'힘은 그대로, 겹친 횟수만 늘려요.', press:1, art:{type:'hatch', mode:'steps'},
      tip:'명도 띠(2차시)를 눕혀 칠하기 대신 해칭으로 만든 것입니다. 이 방법의 좋은 점은 힘 조절이 서툴러도 겹친 횟수로 어두움을 조절할 수 있고, 얼룩이 잘 안 생긴다는 것입니다. 두 방법 중 편한 쪽을 골라 쓰게 하세요.' },
    { text:'둥근 것에는 둥근 방향으로, 납작한 면에는 곧은 방향으로 선을 그어요.', sub:'선의 방향이 모양을 따라가요.', press:1, art:{type:'hatch', mode:'curve'},
      tip:'선의 방향이 형태를 따라가면 입체감이 생깁니다. 공에는 둥근 해칭, 상자 면에는 곧은 해칭. 다음 차시(공)와 6차시(입체 도형)에서 바로 쓰이는 규칙이니 오늘은 맛보기만으로 충분합니다.' },
  ],
  check:{ q:'해칭이 고르게, 겹칠수록 어둡게 되었나요?',
    good:{art:{type:'hatch', mode:'steps'}, text:'간격이 고르고, 겹친 횟수만큼 어두워져요.'},
    bad:{art:{type:'hatch', mode:'uneven'}, text:'간격이 들쭉날쭉하고 선이 짧게 끊겨 지저분해요.'},
    tip:'지저분하게 나온 학생은 손목으로 짧게 그은 경우입니다. 팔꿈치를 들고 칸 끝에서 끝까지 한 번에 긋게 하세요. 간격은 처음엔 넓어도 됩니다. 좁은 간격은 나중에 저절로 됩니다.' }
},
{
  id:4, part:2, title:'공에 빛 주기', tech:'명암 5요소 (밝음·중간·어두움·반사광·그림자)', std:'[4미02-03] 조형 요소(명암) 탐색 · [4미01-01] 감각으로 대상 탐색', goal:'빛 방향을 정하고, 동그라미를 둥근 공으로 만들어요',
  materials:['연필 4B','연필 2B','지우개(떡지우개가 있으면 좋아요)','도화지','공 하나(테니스공·탁구공)','손전등 또는 스탠드','흰 종이(공 밑에 깔기)'],
  steps:[
    { text:'공에 손전등을 비추고 관찰해요. 밝은 곳, 어두운 곳, 그림자는 어디?', sub:'빛 방향을 정하고 종이 구석에 화살표를 그려요.', art:{type:'sphere', stage:0},
      tip:'<b>명암의 절반은 빛 방향 정하기입니다.</b> 창문 빛은 여러 방향에서 와서 헷갈리니 손전등 하나를 왼쪽 위에서 비추세요. 아이들에게 "제일 밝은 곳 손가락으로 짚어 봐, 제일 어두운 곳은?"을 먼저 시킵니다. 공 아래 그림자와 공의 어두운 쪽이 다르다는 것도 짚어 주세요.' },
    { text:'동그라미를 연하게 여러 번 돌려 그리고, 제일 밝은 곳을 작게 표시해 비워 둬요.', sub:'밝은 곳은 빛 쪽(왼쪽 위)에, 작게.', press:0, art:{type:'sphere', stage:1},
      tip:'2차시 동그라미 그리기 방법 그대로. 밝은 곳(하이라이트)은 나중에 지워서 만드는 것이 아니라 처음부터 남기는 것입니다. 너무 크게 남기면 구멍처럼 보이니 동전 크기만큼만.' },
    { text:'연필을 눕혀서 밝은 곳만 빼고 전체를 살짝 칠해요. (2단계 밝기)', sub:'둥글게 쓸어요. 명도 띠의 2칸 밝기.', press:0, art:{type:'sphere', stage:2},
      tip:'전체를 한 번 연하게 덮는 것이 순서의 시작입니다. 이 단계에서 진하게 칠하면 돌이킬 수 없습니다. "2차시 명도 띠 2칸"을 옆에 놓고 비교하게 하세요. 선 방향은 동그라미를 따라 둥글게(3차시).' },
    { text:'빛 반대쪽을 초승달 모양으로 더 어둡게. 가장자리는 조금 남기고!', sub:'제일 어두운 띠는 가장자리보다 살짝 안쪽에.', press:2, art:{type:'sphere', stage:3},
      tip:'<b>가장 흔한 실수:</b> 가장자리를 제일 진하게 칠하는 것. 그러면 테두리만 진한 동전이 됩니다. 제일 어두운 띠는 가장자리보다 안쪽에 있고, 가장자리는 바닥에서 튕겨 온 빛(반사광) 때문에 살짝 밝습니다. 공을 다시 보게 하면 아이들이 스스로 발견합니다.' },
    { text:'가장자리를 살짝 밝게 남기고(반사광), 바닥에 그림자를 넣어요. 공에 붙은 곳이 제일 진하게.', sub:'그림자는 빛 반대쪽 바닥에 납작한 타원.', press:3, art:{type:'sphere', stage:4},
      tip:'그림자가 붙는 순간 공이 바닥에 "놓여" 보입니다. 그림자는 공과 떨어지지 않게, 공에 붙은 곳이 제일 진하고 멀어질수록 연하게. 마지막에 다섯 요소 이름을 칠판에 정리하세요: 밝음·중간·어두움·반사광·그림자. 이름은 몰라도 되고 위치를 짚을 수 있으면 됩니다.' },
  ],
  check:{ q:'공이 둥글게 보이나요?',
    good:{art:{type:'sphere', stage:4}, text:'밝음 → 중간 → 어두움이 이어지고, 가장자리가 살짝 밝아요.'},
    bad:{art:{type:'sphere', flat:true}, text:'테두리만 진하고 안이 같은 회색이라 동전처럼 납작해요.'},
    tip:'납작하게 나온 학생은 ① 가장자리를 제일 진하게 칠했거나 ② 밝은 곳을 남기지 않았거나 ③ 전체를 같은 힘으로 칠한 경우입니다. 손전등을 다시 비춰 "제일 어두운 곳이 정말 가장자리니?"를 물어보세요. 사과·귤·달도 같은 원리입니다.' }
},
{
  id:5, part:3, title:'기본 도형과 비율', tech:'연필로 재기 · 네모 안에 모양 넣기', std:'[4미02-03] 조형 요소(형) 탐색 · [4미01-01] 대상 관찰', goal:'물건의 폭과 높이를 연필로 재고, 네모 안에 모양을 찾아 넣어요',
  materials:['연필 4B','지우개','도화지','재 볼 물건(병·필통·공 등)'],
  steps:[
    { text:'물건을 고르고, 팔을 쭉 뻗어 연필을 세워요. 한 눈을 감고 물건의 폭을 엄지로 눈금 잡아요.', sub:'팔꿈치를 펴야 눈금이 매번 같아요.', art:{type:'measure', stage:0},
      tip:'팔꿈치가 굽으면 잴 때마다 눈금이 달라집니다. "팔은 항상 쭉, 한 눈은 항상 감고"를 규칙으로. 처음엔 선생님이 학생 앞에서 시범을 보이고, 짝끼리 팔이 펴졌는지 확인하게 하세요.' },
    { text:'그 눈금으로 높이를 재요. 폭이 몇 개 들어가나요?', sub:'"높이는 폭의 4배"처럼 말로 해요.', art:{type:'measure', stage:1},
      tip:'"몇 배"를 말로 하게 하는 것이 핵심입니다. 정확할 필요는 없고 "두 배 조금 넘게" 정도면 충분합니다. 이 활동은 수학의 비와 연결되며, 기억으로 그릴 때 물건이 뚱뚱하거나 길쭉해지는 문제를 해결합니다.' },
    { text:'잰 비율대로 종이에 큰 네모를 살짝 그려요.', sub:'폭 1이면 높이 4. 종이의 반 이상 크게.', press:0, art:{type:'measure', stage:2},
      tip:'네모는 나중에 지울 선이니 연하게(살짝). 작게 그리면 세부를 넣을 자리가 없으니 종이 절반 이상 크게. 네모를 먼저 그리면 물건이 종이 밖으로 나가는 일도 없어집니다.' },
    { text:'네모 안에서 물건의 모양을 찾아 넣어요. 둥근 것은 네모 네 변의 가운데에 닿는 원.', sub:'네모 → 그 안에 모양.', press:1, art:{type:'measure', stage:3},
      tip:'원을 그리기 어려운 아이도 네모 안에 넣으면 크기와 비율이 맞습니다. 네 변의 가운데에 점을 찍고 잇게 하세요. 병처럼 복잡한 모양도 "네모 안에서 깎아 내기"로 접근하면 됩니다.' },
    { text:'물건 세 개를 네모 → 모양 순서로 그려요.', sub:'필통, 병, 공. 크기를 서로 비교해서.', press:1, art:{type:'measure', stage:4},
      tip:'물건마다 재고, 네모 그리고, 모양 찾기를 반복합니다. 세 물건의 크기 관계(병이 필통보다 높다 등)를 말로 확인하고 그리게 하세요. 지우개는 마지막에 네모 선을 지울 때만.' },
  ],
  check:{ q:'물건의 비율이 맞게 보이나요?',
    items:['팔을 뻗고 한 눈을 감고 쟀어요','높이가 폭의 몇 배인지 말했어요','네모를 먼저 살짝 그렸어요','네모 안에 모양을 넣었어요','세 물건의 크기 관계가 맞아요'] }
},
{
  id:6, part:3, title:'입체 도형', tech:'정육면체 · 원기둥 · 면의 명암', std:'[4미02-03] 조형 요소(형·명암) · [4미02-02] 용구 사용', goal:'상자와 원기둥을 그리고, 면마다 밝기를 다르게 해서 입체로 보이게 해요',
  materials:['연필 4B','연필 2B','지우개','도화지','네모 상자(티슈 상자 등)','휴지심 또는 컵','손전등'],
  steps:[
    { text:'상자를 눈보다 낮게 놓고 보이는 면을 찾아요. 위, 앞, 옆 — 세 개.', sub:'눈높이보다 위에 두면 윗면이 안 보여요.', art:{type:'box', stage:0},
      tip:'상자를 책상 위에 놓고 학생은 앉아서 보게 하세요. 눈높이보다 낮아야 윗면이 보이고, 모서리가 비스듬히 보이게 살짝 돌려 놓아야 세 면이 다 보입니다. 정면으로 놓으면 면이 하나만 보여 납작한 네모가 됩니다.' },
    { text:'앞면 네모를 그리고, 세 꼭짓점에서 뒤로 비스듬한 선을 같은 방향·같은 길이로 그어요. 끝을 이어요.', sub:'선 셋이 나란해야 해요.', press:1, art:{type:'box', stage:1},
      tip:'초등 수준에서는 "비스듬한 선 셋이 나란하고 같은 길이"면 충분합니다(투시는 다루지 않음). 자를 써도 됩니다. 뒤로 가는 선이 너무 길면 상자가 길쭉해지니 앞면 변의 절반 정도로.' },
    { text:'빛을 정하고 세 면을 다르게. 위는 비우고, 앞은 보통, 옆은 어둡게.', sub:'면 하나는 한 가지 밝기로 고르게.', press:2, art:{type:'box', stage:2},
      tip:'면마다 한 가지 밝기로 고르게 칠하는 것이 요령입니다. 면 안에서 변하면 둥근 것처럼 보입니다. 해칭으로 칠하면 면마다 방향을 다르게(위는 비스듬히, 옆은 세로) 해서 면이 꺾인 느낌을 더할 수 있습니다(3차시).' },
    { text:'가까운 모서리는 진하게, 먼 모서리는 연하게 다시 그어요. 바닥 그림자도.', sub:'앞면 네모와 앞쪽 세로 모서리가 제일 진해요.', press:3, art:{type:'box', stage:3},
      tip:'같은 굵기의 선으로 그린 상자는 종이접기 도면처럼 보입니다. 가까운 모서리를 진하게 하면 앞으로 튀어나옵니다. 1차시의 힘 조절이 여기서 쓰입니다. 그림자는 빛 반대쪽 바닥에 상자에 붙여서.' },
    { text:'원기둥: 위에 납작한 타원, 세로 두 줄, 아래는 곡선. 세로 해칭으로 왼쪽 밝고 오른쪽 어둡게.', sub:'가장자리는 살짝 남겨요(반사광).', press:2, art:{type:'cylinder', stage:1},
      tip:'타원은 동그라미가 아니라 납작하게. 아래 곡선은 위 타원의 아래쪽 반과 같은 모양입니다. 명암은 공(4차시)과 같은 규칙인데 세로 방향으로만 변합니다. 세로 해칭이 가장 쉽고, 왼쪽에서 오른쪽으로 갈수록 선을 촘촘히 겹칩니다.' },
  ],
  check:{ q:'상자가 튀어나와 보이나요?',
    good:{art:{type:'box', stage:3}, text:'세 면의 밝기가 다르고, 가까운 모서리가 진해요.'},
    bad:{art:{type:'box', flat:true}, text:'세 면이 같은 진하기라 납작한 종이 같아요.'},
    tip:'납작하게 나온 학생은 면마다 밝기 차이를 주지 않은 경우입니다. 명도 띠(2차시)를 옆에 놓고 "위는 1칸, 앞은 3칸, 옆은 5칸"처럼 숫자로 정해 주면 바로 됩니다. 원기둥은 다음 차시 컵 그리기에서 다시 씁니다.' }
},
{
  id:7, part:4, title:'윤곽선 관찰 그리기', tech:'블라인드 컨투어 · 관찰 윤곽선', std:'[6미01-01] 감각을 활용하여 대상의 특징 탐색 · [4미02-03] 조형 요소(선)', goal:'기억이 아니라 눈으로 본 대로 물건의 테두리를 그려요',
  materials:['연필 4B','도화지 2장','컵 또는 사과','종이를 가릴 책 한 권','(지우개는 안 써요)'],
  steps:[
    { text:'컵을 앞에 두고 1분 동안 보기만 해요. 눈으로 테두리를 천천히 따라가요.', sub:'손잡이 안쪽, 입구 타원까지.', art:{type:'contour', stage:0},
      tip:'"컵은 이렇게 생겼지"라는 기억 대신 실물을 보게 하는 것이 관찰 표현의 시작입니다([6미01-01]). 1분이 길게 느껴지지만 꼭 지키세요. 눈으로 따라가는 동안 손가락으로 허공에 같이 그려 보게 해도 좋습니다.' },
    { text:'종이를 보지 않고 그려요! 눈은 컵의 테두리만 천천히 따라가고, 손도 같은 속도로 움직여요.', sub:'2분. 한 번도 종이를 보지 않아요. 연필도 떼지 않아요.', press:1, art:{type:'contour', mode:'blind'},
      tip:'<b>블라인드 컨투어.</b> 결과가 우스꽝스러운 것이 정상이고 목적입니다. 눈과 손을 연결하는 연습이지 잘 그리기가 아닙니다. 종이 위에 책을 걸쳐 가리면 안 보게 됩니다. 다 그린 뒤 다 같이 보고 웃고 넘기세요. "눈이 가는 속도 = 손이 가는 속도"만 지키면 성공입니다.' },
    { text:'새 종이에, 이번엔 보면서 천천히. 눈은 컵 70%, 종이 30%.', sub:'기억으로 그리지 않아요. 눈이 본 만큼만 손이 가요.', press:1, art:{type:'contour', mode:'look', stage:1},
      tip:'방금 안 보고 그린 감각 그대로, 가끔만 종이를 확인하며 그립니다. 빨리 그리는 아이는 기억으로 그리는 것입니다. "천천히"를 계속 말해 주세요. 지우개는 쓰지 않고 틀린 선 위에 다시 긋습니다(1차시).' },
    { text:'안쪽 선도 관찰해서 그려요. 입구는 납작한 타원, 손잡이는 안쪽 선까지.', sub:'컵 입구가 동그라미로 보이나요? 눈높이를 확인해요.', press:1, art:{type:'contour', mode:'look', stage:2},
      tip:'기억으로 그리면 입구가 완전한 동그라미가 됩니다. 앉은 눈높이에서 입구는 납작한 타원이고, 낮게 볼수록 더 납작해집니다. 눈높이를 바꿔 가며 타원이 변하는 것을 직접 보게 하세요. 손잡이도 굵기가 있는 띠라는 것을 관찰하게 합니다.' },
    { text:'두 그림을 나란히 놓고 비교해요. 어느 쪽이 더 컵 같나요? 왜?', sub:'안 보고 그린 것, 보고 그린 것.', art:{type:'contour', mode:'compare'},
      tip:'감상 활동입니다. "보고 그린 쪽이 낫다"는 답보다 "어디가 다른지"를 말하게 하세요(입구 모양, 손잡이 위치, 기울기). 안 보고 그린 그림에도 살아 있는 선이 있다는 것을 짚어 주면 좋습니다.' },
  ],
  check:{ q:'본 대로 그렸나요?',
    good:{art:{type:'contour', mode:'look', stage:2}, text:'입구가 타원, 손잡이에 굵기가 있어요. 실물과 닮았어요.'},
    bad:{art:{type:'contour', mode:'symbol'}, text:'입구가 동그라미, 몸통이 네모. 기억으로 그린 컵이에요.'},
    tip:'기호처럼 그린 학생은 실물을 보는 시간이 짧았던 것입니다. 다시 1분 관찰 → 천천히. 이 차시의 평가 관점은 "잘 그렸는가"가 아니라 "관찰한 것이 선에 들어갔는가"입니다.' }
},
{
  id:8, part:4, title:'질감', tech:'질감 표현 (나무결·천 주름·유리)', std:'[6미01-01] 감각으로 대상의 특징 탐색 · [4미02-03] 조형 요소(질감)', goal:'선의 방향·굵기·간격을 바꿔 나무·천·유리의 느낌을 만들어요',
  materials:['연필 4B','연필 2B','지우개','도화지','나무 조각(또는 나무 책상)','손수건 또는 천','유리컵'],
  steps:[
    { text:'나무결: 결 방향으로 긴 곡선을 그어요. 옹이는 작은 동그라미, 결이 옹이를 돌아서 흘러가요.', sub:'선 간격을 넓게, 좁게 바꿔요. 굵은 선 하나에 가는 선 여럿.', press:1, art:{type:'texture', kind:'wood'},
      tip:'실제 나무를 만지고 결을 손가락으로 따라가게 한 뒤 그리세요. 결은 평행선이 아니라 옹이 주변에서 휘어집니다. 굵은 선과 가는 선을 섞어야 나무처럼 보이고, 같은 굵기로만 그으면 줄무늬가 됩니다.' },
    { text:'천 주름: 손수건을 살짝 구겨 놓고, 주름 골짜기는 진하게, 산은 비워 두어요.', sub:'선은 주름이 흐르는 방향으로.', press:2, art:{type:'texture', kind:'cloth'},
      tip:'손수건을 구겨 놓고 손전등을 옆에서 비추면 골짜기와 산이 뚜렷해집니다. 골짜기 하나 = 진한 선 하나 + 양쪽으로 점점 연하게. 주름 전체를 그리려 하지 말고 크게 보이는 주름 서너 개만.' },
    { text:'유리: 테두리와 반사되는 곳만 그리고, 가운데는 비워 두어요.', sub:'반짝이는 곳은 지우개로 닦아 내도 좋아요.', press:1, art:{type:'texture', kind:'glass'},
      tip:'유리는 "없는 것"을 그립니다. 뒤가 비쳐 보이니 안을 채우지 않고, 테두리의 진한 선과 세로로 긴 반사, 바닥의 두꺼운 부분만 그립니다. 지우개를 세워 세로로 한 번 닦아 내면 반짝임이 됩니다. 이 차시에서만 지우개가 "그리는 도구"입니다.' },
    { text:'세 가지를 나란히 놓고 봐요. 무엇이 재질을 다르게 보이게 했나요?', sub:'선의 방향·굵기·간격.', art:{type:'texture', kind:'all'},
      tip:'같은 연필로 세 가지 다른 느낌이 난 이유를 말로 정리하게 하세요: 나무는 긴 곡선, 천은 진한 골짜기와 연한 산, 유리는 비움과 반짝임. "질감"이라는 말은 소개만 해도 됩니다. 교실에서 질감 하나(벽돌, 스웨터, 머리카락)를 더 찾아 그리게 하면 확장 활동이 됩니다.' },
  ],
  check:{ q:'세 가지 재질이 다르게 보이나요?',
    items:['나무결에 굵은 선과 가는 선을 섞었어요','주름 골짜기는 진하게, 산은 비웠어요','유리 가운데를 비워 두었어요','무엇이 재질을 다르게 보이게 했는지 말했어요'] }
},
{
  id:9, part:5, title:'정물 한 점', tech:'비율 → 윤곽 → 명암 → 그림자', std:'[6미02-03] 조형 요소의 어울림 · [6미02-04] 표현 과정 돌아보기 · [6미01-01] 관찰', goal:'배운 것을 순서대로 써서 물건 두 개를 한 장에 완성하고 서로 감상해요',
  materials:['연필 4B','연필 2B','지우개','도화지(8절)','물건 2개(컵+사과 등)','흰 종이(물건 밑에 깔기)','손전등 또는 스탠드'],
  steps:[
    { text:'물건 두 개를 놓아요. 하나는 뒤, 하나는 앞에 살짝 겹치게. 빛은 한쪽에서.', sub:'나란히 놓으면 심심해요. 겹치면 앞뒤가 생겨요.', art:{type:'still', stage:0},
      tip:'배치가 그림의 절반입니다. 나란히 놓으면 평평하고, 살짝 겹치면 앞뒤(공간)가 생깁니다. 물건 밑에 흰 종이를 깔면 그림자가 잘 보입니다. 빛은 손전등 하나로 왼쪽 위에서(4차시). 모둠마다 정물을 하나 놓고 여러 방향에서 그리게 해도 됩니다.' },
    { text:'연필로 재요. 큰 물건 높이가 3이면 작은 물건은? 종이에 큰 네모 두 개를 살짝.', sub:'5차시처럼. 종이의 반 이상 크게.', press:0, art:{type:'still', stage:1},
      tip:'두 물건의 크기 관계를 먼저 정하면 나중에 고칠 일이 줄어듭니다. 네모는 살짝, 나중에 지웁니다. 작게 그리는 아이에게는 "종이 반 이상"을 다시 말해 주세요.' },
    { text:'네모 안에서 모양을 찾아요. 보면서 천천히. 겹친 곳은 앞 물건이 이겨요.', sub:'7차시처럼 눈은 물건 70%.', press:1, art:{type:'still', stage:2},
      tip:'앞 물건에 가려진 뒤 물건의 선은 그리지 않습니다(겹침이 앞뒤를 만듭니다). 컵 입구는 타원(7차시), 사과는 네모 안의 동그라미(5차시). 지우개는 이 단계 끝에 네모 선을 지울 때 한 번만.' },
    { text:'명암: 밝음·중간·어두움 세 단계만. 눕혀 칠하기나 해칭으로. 밝은 곳은 비워요.', sub:'전체를 연하게 → 어두운 쪽을 한 번 더.', press:1, art:{type:'still', stage:3},
      tip:'다섯 단계를 다 쓰려 하면 시간이 모자랍니다. "세 단계"로 제한하세요. 순서는 4차시 공과 같습니다: 밝은 곳 남기고 전체 연하게 → 빛 반대쪽 한 번 더. 컵은 원기둥(6차시), 사과는 공(4차시) 규칙 그대로.' },
    { text:'제일 어두운 곳을 찾아요: 물건이 바닥에 닿는 곳, 겹친 곳. 그다음 그림자.', sub:'그림자는 빛 반대쪽 바닥에, 물건에 붙여서.', press:3, art:{type:'still', stage:4},
      tip:'제일 어두운 곳(바닥에 닿는 선, 두 물건이 만나는 곳)을 마지막에 4B로 세게 넣으면 그림이 살아납니다. 그림자가 붙으면 물건이 바닥에 놓입니다. 여기까지 하고 지우개로 밝은 곳을 한 번 닦아 내면 반짝임이 생깁니다(8차시).' },
    { text:'팔을 뻗어 멀리서 1분 동안 봐요. 고칠 곳 하나만 고치고, 제목과 이름을 써요.', sub:'그다음 친구 그림에서 좋은 점을 하나씩 말해요.', art:{type:'still', stage:5}, wait:60,
      tip:'멀리서 보면 어디가 너무 연한지, 어디가 뭉쳤는지 바로 보입니다. 고칠 곳은 하나만 — 계속 손대면 더러워집니다. 감상은 "어디가 제일 진하지?", "빛은 어디서 오는 것 같아?"처럼 배운 말로 묻게 하면 구체적이 됩니다([6미02-04] 과정 돌아보기). 작품은 사진으로 남겨 1차시 선 연습과 나란히 보여 주면 성장이 보입니다.' },
  ],
  check:{ q:'정물이 완성됐나요? 배운 것을 순서대로 썼는지 확인해요.',
    items:['물건 두 개를 겹치게 놓고 빛을 정했어요','연필로 재고 네모부터 그렸어요','보면서 윤곽을 그렸어요','밝음·중간·어두움 세 단계가 보여요','제일 어두운 곳과 그림자를 넣었어요','친구 그림의 좋은 점을 말했어요'],
    tip:'평가 기준은 "잘 그렸는가"가 아니라 "재기 → 윤곽 → 명암 → 그림자 순서를 알고 썼는가"입니다. 항목 네 개 이상이면 성취. 이 차시는 물건을 바꿔 학기마다 반복해도 좋습니다.' }
}
];

const PARTS = [
  {id:1, color:'#6b7280', title:'연필과 친해지기', sub:'잡는 법, 힘 조절, 선 긋기부터', grade:'3학년 무렵부터 · 3~4학년군 [4미01-01]·[4미02-02]'},
  {id:2, color:'#3f74c9', title:'밝기와 빛', sub:'연필 하나로 밝음과 어두움을 만들어요', grade:'3~4학년 · [4미02-03] 조형 요소(명암) 중심'},
  {id:3, color:'#df6a3c', title:'형태', sub:'재고, 네모 안에 넣고, 입체로', grade:'4학년 무렵 · [4미02-03] 조형 요소(형)'},
  {id:4, color:'#3f9d63', title:'관찰', sub:'기억이 아니라 눈으로 본 대로', grade:'5학년 무렵부터 · 5~6학년군 [6미01-01]'},
  {id:5, color:'#8a5bb5', title:'나만의 그림', sub:'배운 순서대로 정물 한 점 완성', grade:'6학년 무렵 · [6미02-03]·[6미02-04]'},
];

window.COURSE_DATA = {
  key:'drawing', ns:'dr', title:'데생 따라하기', short:'데생', subtitle:'연필 한 자루로 형태와 빛을 보는 눈',
  promise:['연필은 살살, 손목이 아니라 팔로','지우개보다 선을 더 긋기','멀리서 한 번 보기'],
  intro:'태블릿을 보면서 한 단계씩 종이에 해 봐요. 연필 힘 표시(살짝~아주 세게)를 보고 힘을 맞추면 돼요.',
  meters:[ {key:'press', icon:'✏️', labels:['살짝','보통','세게','아주 세게']} ],
  waitMsg:'기다리는 동안 멀리서 한 번 봐요',
  videoDir:'videos_drawing',
  prints:[],
  parts:PARTS, lessons:LESSONS, art:ART,
};
})();
