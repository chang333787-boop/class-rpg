/* ==================================================================
   수채화 따라하기 — 코스 콘텐츠 (2026-09-03 재구성, 16차시)
   index.html(엔진)이 ?course=watercolor(기본)일 때 이 파일을 읽는다.
   글만 바꾸면 되니 메모장으로도 수정할 수 있다. 차시 번호(id)는 0부터 빈틈없이.
   각 단계 = text(지시) · sub(보조) · water/paint(0~3) · art{type} · tip(선생님) · wait(초) · quiz
   ================================================================== */
(function(){
const DEFS = `<defs>
<filter id="ptx" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.42  0 0 0 0 0.36  0 0 0 0.05 0"/></filter>
<filter id="wc" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="8"/></filter>
</defs>`;
const WC = s => `<g filter="url(#wc)">${s}</g>`;
const PAPER = `<rect x="20" y="20" width="360" height="220" rx="6" fill="#fdfcf7" stroke="#e4dfd2"/><rect x="20" y="20" width="360" height="220" filter="url(#ptx)"/>`;
const BRUSH = (x,y,color,cls='') => `<g class="${cls}" style="transform-origin:${x}px ${y}px"><g transform="translate(${x},${y}) rotate(35)">
  <rect x="-5" y="-90" width="10" height="70" rx="3" fill="#b06a3b"/><rect x="-6" y="-22" width="12" height="12" fill="#c9c9c9"/>
  <path d="M-6 -10 L6 -10 L2 12 L-2 12 Z" fill="${color}"/></g></g>`;
const CRAYON = (x,y) => `<g class="brush" style="transform-origin:${x}px ${y}px"><g transform="translate(${x},${y}) rotate(35)"><rect x="-7" y="-70" width="14" height="60" rx="2" fill="#f4f0e4" stroke="#bbb"/><path d="M-7 -10 L7 -10 L0 8Z" fill="#fff" stroke="#bbb"/></g></g>`;
const svg = s => `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg">${DEFS}${s}</svg>`;
const ART = {
  cups(){ return svg(`${PAPER}
    <g transform="translate(110,70)"><path d="M0 0 h80 l-8 110 h-64 Z" fill="#cfe3ff" stroke="#8ab"/><path d="M6 40 h68 l-5 70 h-58 Z" fill="#9ab3c9" opacity=".8"/><text x="40" y="140" font-size="16" text-anchor="middle">씻는 물</text></g>
    <g transform="translate(220,70)"><path d="M0 0 h80 l-8 110 h-64 Z" fill="#cfe3ff" stroke="#8ab"/><path d="M6 40 h68 l-5 70 h-58 Z" fill="#dff0ff" opacity=".9"/><text x="40" y="140" font-size="16" text-anchor="middle">깨끗한 물</text></g>
    ${BRUSH(150,95,'#7a8fa6','tap')}`); },
  tape(){ return svg(`<rect x="10" y="10" width="380" height="240" fill="#d9c9a8"/>${PAPER}
    ${[[20,20],[350,20],[20,225],[350,225]].map(([x,y])=>`<rect x="${x-8}" y="${y-2}" width="46" height="18" fill="#f2e2a0" opacity=".9" transform="rotate(-8 ${x} ${y})" class="fade-in"/>`).join('')}
    <text x="200" y="140" font-size="15" text-anchor="middle" fill="#888">두꺼운 종이 (수채화지 · 200g)</text>`); },
  hold(){ return svg(`${PAPER}
    <path d="M60 120 Q200 60 340 110" stroke="#2563eb" stroke-width="4" fill="none" stroke-linecap="round" class="row"/>
    <path d="M60 200 Q200 140 340 190" stroke="#2563eb" stroke-width="22" fill="none" stroke-linecap="round" class="row" style="animation-delay:1.3s"/>
    ${BRUSH(300,170,'#2563eb','brush')}
    <text x="80" y="100" font-size="13" fill="#666">붓 세우기 → 가는 선</text><text x="80" y="235" font-size="13" fill="#666">붓 눕히기 → 넓은 면</text>`); },
  palette(a){ return svg(`<ellipse cx="200" cy="140" rx="170" ry="100" fill="#fff" stroke="#ccc" stroke-width="3"/>
    ${[['#e63946',95,105],['#f28c28',150,80],['#f7d51d',215,75],['#3fa34d',280,90],['#2563eb',325,125],['#7b3fa0',315,175]].map(([c,x,y])=>`<circle cx="${x}" cy="${y}" r="24" fill="#f4f4f4" stroke="#ddd"/>`).join('')}
    ${WC([['#e63946',95,105],['#f28c28',150,80],['#f7d51d',215,75],['#3fa34d',280,90],['#2563eb',325,125],['#7b3fa0',315,175]].map(([c,x,y])=>`<circle cx="${x}" cy="${y}" r="${a&&a.dry?18:9}" fill="${c}" class="fade-in"/>`).join(''))}
    ${[[130,180],[200,195],[260,185]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="22" fill="#f4f4f4" stroke="#ddd"/>`).join('')}
    <text x="200" y="245" font-size="15" text-anchor="middle" fill="#666">${a&&a.dry?'색상환 순서로, 전날 짜서 말리기':'콩알만큼만'}</text>`); },
  wash(a){ if (a && a.c) return ART.flat(a); return svg(`<path d="M120 60 h160 l-14 150 h-132 Z" fill="#cfe3ff" stroke="#8ab"/><path d="M130 110 h140 l-10 100 h-120 Z" fill="#a9c2da" opacity=".8"/>
    ${BRUSH(200,150,'#7a8fa6','tilt')}
    <g transform="translate(300,170)" class="tap"><rect x="0" y="0" width="80" height="40" rx="8" fill="#e8e0d0"/><text x="40" y="26" font-size="14" text-anchor="middle">걸레 톡톡</text></g>`); },
  boxes(a){ const f=a.fill; const bx=[40,150,260]; return svg(`${PAPER}
    ${WC(bx.map((x,i)=>f[i]?`<rect x="${x}" y="70" width="100" height="120" fill="#2563eb" fill-opacity="${f[i]}"/>`:'').join(''))}
    ${bx.map((x,i)=>`<rect x="${x}" y="70" width="100" height="120" fill="none" stroke="#bbb" stroke-dasharray="4 3"/>
      <text x="${x+50}" y="215" font-size="15" text-anchor="middle" fill="#666">${['연하게','중간','진하게'][i]}</text>`).join('')}
    ${a.brush!==undefined ? BRUSH(bx[a.brush]+30, 120, '#2563eb', 'brush') : ''}`); },
  lines(){ return svg(`${PAPER}${[0.25,0.6,1].map((o,i)=>`<path d="M50 ${80+i*50} Q200 ${60+i*50} 350 ${85+i*50}" stroke="#2563eb" stroke-opacity="${o}" stroke-width="5" fill="none" stroke-linecap="round" class="row"/>`).join('')}
    ${BRUSH(340,190,'#2563eb','brush')}`); },
  mix(a){ return svg(`${WC(`<circle cx="90" cy="120" r="45" fill="${a.a}"/><circle cx="230" cy="120" r="32" fill="${a.b}"/>`)}<text x="170" y="132" font-size="40" text-anchor="middle" fill="#666">+</text>
    <text x="295" y="132" font-size="40" text-anchor="middle" fill="#666">=</text>
    ${a.hide?`<circle cx="350" cy="120" r="45" fill="#eee" stroke="#bbb" stroke-dasharray="6 4"/><text x="350" y="132" font-size="36" text-anchor="middle" fill="#999">?</text>`:WC(`<circle cx="350" cy="120" r="45" fill="${a.c}" class="fade-in"/>`)}
    <text x="230" y="200" font-size="15" text-anchor="middle" fill="#666">${a.hide?'무슨 색이 될까요?':'진한 색은 아주 조금만'}</text>`); },
  mix3(){ return svg(`${WC(['#e63946','#f7d51d','#2563eb'].map((c,i)=>`<circle cx="${80+i*70}" cy="90" r="30" fill="${c}"/>`).join(''))}
    <text x="290" y="102" font-size="36" text-anchor="middle" fill="#666">=</text>${WC(`<circle cx="350" cy="90" r="40" fill="#8b5e3c" class="fade-in"/>`)}
    <text x="200" y="200" font-size="17" text-anchor="middle" fill="#666">많이 섞을수록 탁해져요 → 흙, 나무 줄기, 그림자</text>`); },
  lighten(a){ return svg(`${WC(`<circle cx="90" cy="120" r="45" fill="${a.c}"/>`)}<text x="170" y="132" font-size="40" text-anchor="middle" fill="#666">+</text>
    <g transform="translate(230,120)" class="drop"><path d="M0 -30 C 18 -5 22 10 0 28 C -22 10 -18 -5 0 -30Z" fill="#7cc4ff"/></g>
    <text x="295" y="132" font-size="40" text-anchor="middle" fill="#666">=</text>${WC(`<circle cx="350" cy="120" r="45" fill="${a.c}" fill-opacity=".35" class="fade-in"/>`)}
    <text x="200" y="210" font-size="17" text-anchor="middle" fill="#666">흰색 물감 ❌ &nbsp; 물 ⭕</text>`); },
  dots(a){ return svg(`${PAPER}${WC(a.colors.map((c,i)=>`<circle cx="${70+i*65}" cy="130" r="28" fill="${c}"/>`).join(''))}`); },
  'palette-pool'(a){ return svg(`<ellipse cx="200" cy="140" rx="170" ry="100" fill="#fff" stroke="#ccc" stroke-width="3"/>
    ${WC(`<ellipse cx="200" cy="150" rx="70" ry="40" fill="${a.c}" fill-opacity=".85" class="fade-in"/><circle cx="110" cy="100" r="10" fill="${a.c}"/>`)}
    <text x="200" y="240" font-size="16" text-anchor="middle" fill="#666">넉넉하게 만들어 두기</text>`); },
  flat(a){ const rows=a.rows||1; const rowsSvg = Array.from({length:a.done?4:rows},(_,i)=>`<path d="M62 ${77+i*35} H338" stroke="${a.c}" stroke-opacity=".75" stroke-width="36" class="${a.done?'':'row'}"/>`).join(''); return svg(`${PAPER}<rect x="60" y="60" width="280" height="140" fill="none" stroke="#bbb" stroke-dasharray="4 3"/>
    ${a.done?WC(rowsSvg):rowsSvg}
    ${a.done?'':BRUSH(90,77+(rows-1)*35,a.c,'brush')}
    <text x="200" y="235" font-size="16" text-anchor="middle" fill="#666">${a.done?'만지지 않고 기다리기':'왼쪽 → 오른쪽, 겹치게'}</text>`); },
  grad(a){ const rows=a.rows||1; return svg(`<defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a.c}"/><stop offset="1" stop-color="${a.c}" stop-opacity=".05"/></linearGradient></defs>${PAPER}
    <rect x="60" y="60" width="280" height="140" fill="none" stroke="#bbb" stroke-dasharray="4 3"/>
    ${a.still?WC(`<rect x="60" y="60" width="280" height="140" fill="url(#g1)"/>`):Array.from({length:rows},(_,i)=>`<path d="M62 ${77+i*35} H338" stroke="${a.c}" stroke-opacity="${(0.9-i*0.22).toFixed(2)}" stroke-width="36" class="row"/>`).join('')}
    ${a.still?'':BRUSH(90,77+(rows-1)*35,a.c,'brush')}
    ${a.still?'':`<g transform="translate(345,70)" class="drop"><path d="M0 -14 C 9 -2 11 5 0 14 C -11 5 -9 -2 0 -14Z" fill="#7cc4ff"/></g><text x="200" y="235" font-size="16" text-anchor="middle" fill="#666">줄마다 물만 살짝 더하기</text>`}`); },
  stripes(a){ return svg(`${PAPER}${WC(Array.from({length:4},(_,i)=>`<rect x="60" y="${60+i*35}" width="280" height="30" fill="${a.c}" fill-opacity="${(0.9-i*0.2).toFixed(2)}"/>`).join(''))}`); },
  wet(){ return svg(`${PAPER}<ellipse cx="200" cy="130" rx="130" ry="75" fill="#eaf4ff" stroke="#bcd" stroke-dasharray="5 4"/>
    <path d="M110 110 q30 -25 60 -10" stroke="#fff" stroke-width="8" fill="none"/><path d="M250 150 q20 -15 40 -5" stroke="#fff" stroke-width="6" fill="none"/>
    ${BRUSH(200,120,'#9cc9ff','brush')}<text x="200" y="235" font-size="16" text-anchor="middle" fill="#666">물만! 반짝일 정도로</text>`); },
  wetwet(a){ const pos=[[170,120,60],[240,140,50],[200,90,40]]; return svg(`<defs><filter id="bl"><feGaussianBlur stdDeviation="9"/></filter></defs>${PAPER}
    <ellipse cx="200" cy="130" rx="130" ry="75" fill="#eaf4ff" stroke="#bcd" stroke-dasharray="5 4"/>
    ${a.colors.map((c,i)=>`<circle cx="${pos[i][0]}" cy="${pos[i][1]}" r="${pos[i][2]}" fill="${c}" filter="url(#bl)" class="${a.still||a.push?'':'blob b'+(i+1)}" opacity=".8"/>`).join('')}
    ${a.push?`<ellipse cx="250" cy="125" rx="60" ry="40" fill="${a.colors[0]}" filter="url(#bl)" opacity=".35" class="fade-in"/>${BRUSH(280,110,'#9cc9ff','brush')}<text x="200" y="235" font-size="16" text-anchor="middle" fill="#666">씻은 붓으로 끌기 (문지르지 않기)</text>`:''}
    ${a.still?`<text x="200" y="235" font-size="16" text-anchor="middle" fill="#666">만지지 않기!</text>`:(a.push?'':BRUSH(pos[a.colors.length-1][0]+20, pos[a.colors.length-1][1]-10, a.colors[a.colors.length-1], 'tap'))}`); },
  wetdry(a){ return svg(`${PAPER}${WC(`<circle cx="170" cy="130" r="60" fill="${a.a}" fill-opacity="${a.hard?1:.55}"/>
    ${a.only?'':`<circle cx="235" cy="130" r="60" fill="${a.b}" fill-opacity="${a.hard?1:.6}" style="mix-blend-mode:multiply" class="fade-in"/>`}
    ${a.c?`<path d="M235 130 m-60 0 a60 60 0 0 0 30 52" stroke="${a.b}" stroke-width="30" stroke-opacity=".5" fill="none" style="mix-blend-mode:multiply"/>`:''}`)}
    ${a.only&&!a.still?BRUSH(190,110,a.a,'brush'):''}
    ${a.still?`<text x="200" y="235" font-size="16" text-anchor="middle" fill="#666">손등으로 확인: 차갑지 않으면 마른 것</text>`:''}
    ${!a.only&&!a.hard&&!a.c?`<text x="200" y="235" font-size="16" text-anchor="middle" fill="#666">겹친 곳 = 초록!</text>`:''}
    ${a.c?`<text x="200" y="235" font-size="16" text-anchor="middle" fill="#666">겹칠수록 진해져요 → 그림자</text>`:''}`); },
  resist(a){ const s=a.stage; const lines = `<path d="M60 90 q30 -25 60 0 t60 0 t60 0 t60 0" fill="none" stroke="#fff" stroke-width="${a.weak?2:7}" stroke-linecap="round" opacity="${a.weak?.5:1}"/>
    <path d="M60 150 q30 -25 60 0 t60 0 t60 0 t60 0" fill="none" stroke="#fff" stroke-width="${a.weak?2:7}" stroke-linecap="round" opacity="${a.weak?.5:1}"/>
    ${[[110,200],[200,205],[290,198]].map(([x,y])=>`<path d="M${x} ${y-12} L${x+4} ${y-4} L${x+12} ${y-3} L${x+6} ${y+3} L${x+8} ${y+11} L${x} ${y+7} L${x-8} ${y+11} L${x-6} ${y+3} L${x-12} ${y-3} L${x-4} ${y-4}Z" fill="#fff" opacity="${a.weak?.5:1}"/>`).join('')}`;
    return svg(`${PAPER}
      ${s===0?`<g opacity=".35">${lines.replace(/#fff/g,'#d9d4c4')}</g>${CRAYON(300,120)}<text x="200" y="235" font-size="16" text-anchor="middle" fill="#666">꾹 눌러서 두껍게</text>`:''}
      ${s>=1?`${WC(`<rect x="22" y="22" width="356" height="216" fill="#2563eb" fill-opacity="${a.weak?.85:.6}"/>`)}${lines}`:''}
      ${s===1&&!a.still&&!a.weak?BRUSH(300,70,'#2563eb','brush'):''}
      ${s===2?`<path d="M60 90 q30 -25 60 0 t60 0 t60 0 t60 0" fill="none" stroke="#111" stroke-width="2" class="row"/><path d="M60 150 q30 -25 60 0 t60 0 t60 0 t60 0" fill="none" stroke="#111" stroke-width="2" class="row"/><g transform="translate(320,180) rotate(35)" class="tap"><rect x="-5" y="-60" width="10" height="55" rx="2" fill="#222"/><path d="M-5 -5 L5 -5 L0 8Z" fill="#222"/></g>`:''}
      ${a.still&&s===1?`<text x="200" y="250" font-size="15" text-anchor="middle" fill="#fff">기름(크레파스)과 물(물감)은 서로 밀어내요</text>`:''}`); },
  scene(a){ const s=a.stage; return svg(`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset=".55" stop-color="#f28c28"/><stop offset="1" stop-color="#f9a8c9"/></linearGradient><filter id="bl2"><feGaussianBlur stdDeviation="7"/></filter></defs>${PAPER}
    ${s===0?`<rect x="22" y="22" width="356" height="130" fill="#eaf4ff"/><path d="M80 60 q40 -20 80 -5" stroke="#fff" stroke-width="8" fill="none"/>${BRUSH(200,80,'#9cc9ff','brush')}`:''}
    ${s>=1?WC(`<rect x="22" y="22" width="356" height="130" fill="url(#sky)" opacity=".85"/>`):''}
    ${s===1&&!a.still?`<circle cx="120" cy="50" r="30" fill="#2563eb" filter="url(#bl2)" class="blob"/><circle cx="260" cy="110" r="30" fill="#f28c28" filter="url(#bl2)" class="blob b2"/>${BRUSH(280,100,'#f28c28','tap')}`:''}
    ${s>=2?WC(`<path d="M20 200 Q120 120 250 180 T380 170 V240 H20Z" fill="#3fa34d"/><path d="M20 240 V210 Q150 160 380 215 V240Z" fill="#2f7d3a"/>`):''}
    ${s===2?BRUSH(150,190,'#2f7d3a','brush'):''}
    ${s>=3?`<rect x="300" y="150" width="8" height="45" fill="#5b3a1e"/><circle cx="304" cy="140" r="24" fill="#245c2a"/><path d="M60 200 l20 -30 l20 30Z M60 200 v25 h40 v-25Z" fill="#8b5e3c"/>`:''}
    ${s===3&&!a.still?BRUSH(320,170,'#5b3a1e','tap'):''}
    ${a.still&&s===1?`<text x="200" y="255" font-size="15" text-anchor="middle" fill="#666">마르는 동안 초록 만들어 두기</text>`:''}
    ${a.still&&s===3?`<text x="200" y="255" font-size="15" text-anchor="middle" fill="#666">내 그림에는 무엇을 넣을까?</text>`:''}`); },
  salt(){ return svg(`${PAPER}${WC(`<rect x="40" y="50" width="320" height="160" fill="#2563eb" fill-opacity=".8"/>`)}
    ${Array.from({length:22},(_,i)=>{const x=60+((i*137)%300), y=65+((i*89)%130); return `<circle cx="${x}" cy="${y}" r="${4+(i%3)*2}" fill="#fff" opacity=".85" class="fade-in" style="animation-delay:${(i%5)*0.4}s"/>`;}).join('')}
    <g transform="translate(200,30)" class="tap"><rect x="-16" y="-20" width="32" height="26" rx="4" fill="#eee" stroke="#aaa"/><text x="0" y="0" font-size="12" text-anchor="middle">소금</text></g>`); },
  lift(){ return svg(`${PAPER}${WC(`<rect x="22" y="22" width="356" height="216" fill="#7cc4ff" fill-opacity=".8"/>
    <g class="fade-in"><ellipse cx="150" cy="110" rx="60" ry="30" fill="#fff" opacity=".9"/><ellipse cx="190" cy="95" rx="45" ry="28" fill="#fff" opacity=".9"/><ellipse cx="270" cy="150" rx="50" ry="25" fill="#fff" opacity=".85"/></g>`)}
    <g transform="translate(300,60)" class="tap"><path d="M0 0 q20 -20 40 0 q10 20 -10 25 q-25 5 -30 -25Z" fill="#fafafa" stroke="#bbb"/><text x="20" y="45" font-size="12" text-anchor="middle">휴지 꾹</text></g>`); },
  splat(){ return svg(`${PAPER}${WC(`<rect x="22" y="22" width="356" height="216" fill="#1e3a8a"/>`)}
    ${Array.from({length:30},(_,i)=>{const x=40+((i*151)%320), y=40+((i*97)%180); return `<circle cx="${x}" cy="${y}" r="${1.5+(i%4)}" fill="#fff" class="fade-in" style="animation-delay:${(i%6)*0.3}s"/>`;}).join('')}
    ${BRUSH(330,80,'#fff','tap')}`); },
  free(a){ const m=a.mode;
    const dots=`<circle cx="90" cy="90" r="7" fill="#e63946"/><circle cx="140" cy="130" r="14" fill="#f7d51d"/><circle cx="80" cy="175" r="22" fill="#2563eb" opacity=".8"/><circle cx="180" cy="70" r="4" fill="#3fa34d"/>`;
    const lines=`<path d="M215 60 V200" stroke="#e63946" stroke-width="6" fill="none" class="row"/><path d="M245 190 q15 -40 30 0 t30 0 t30 0" stroke="#2563eb" stroke-width="6" fill="none" class="row"/><path d="M310 100 a26 26 0 1 1 -20 -28 a17 17 0 1 0 13 19" stroke="#3fa34d" stroke-width="6" fill="none" class="row"/>`;
    const field=`<rect x="60" y="70" width="90" height="70" rx="10" fill="#f28c28" opacity=".65" class="fade-in"/><ellipse cx="295" cy="170" rx="55" ry="36" fill="#7b3fa0" opacity=".5" class="fade-in"/>`;
    return svg(`${PAPER}${m==='dots'?WC(dots)+BRUSH(165,110,'#f7d51d','tap'):''}${m==='lines'?lines+BRUSH(130,150,'#2563eb','brush'):''}${m==='field'?WC(field)+BRUSH(200,150,'#f28c28','brush'):''}${m==='all'?`<g opacity=".9">${WC(dots+field)}${lines}</g>`:''}
    <text x="200" y="252" font-size="15" text-anchor="middle" fill="#666">${{dots:'크게, 작게 찍어 보기',lines:'곧게, 구불구불, 빙글빙글',field:'붓을 눕혀 넓게',all:'점·선·면으로 나만의 무늬'}[m]}</text>`); },
  pour(a){ return svg(`<g class="tilt"><rect x="60" y="30" width="280" height="190" rx="6" fill="#fff" stroke="#ddd"/>
    ${WC(`<circle cx="140" cy="70" r="16" fill="#2563eb" opacity=".85"/><circle cx="230" cy="60" r="13" fill="#e63946" opacity=".85"/>`)}<path d="M140 80 q-6 40 4 100" stroke="#2563eb" stroke-width="9" fill="none" stroke-linecap="round" class="row"/>
    <path d="M230 70 q8 45 -2 110" stroke="#e63946" stroke-width="8" fill="none" stroke-linecap="round" class="row" style="animation-delay:1s"/></g>
    ${a.blow?`<g transform="translate(300,55) rotate(25)"><rect x="0" y="-6" width="72" height="12" rx="6" fill="#9fd0e8"/></g>
    ${[[-32,10],[-15,34],[12,28],[26,48]].map(([dx,dy],i)=>`<path d="M262 92 q${dx} ${dy} ${dx*2} ${dy*2}" stroke="#e63946" stroke-width="3" fill="none" class="row" style="animation-delay:${i*.5}s"/>`).join('')}
    <text x="200" y="250" font-size="15" text-anchor="middle" fill="#666">불면 가지처럼 뻗어 나가요</text>`:`<text x="200" y="250" font-size="15" text-anchor="middle" fill="#666">종이를 기울이면 물감이 길을 만들어요</text>`}`); },
  fold(a){ return svg(`${PAPER}<line x1="200" y1="24" x2="200" y2="236" stroke="#bbb" stroke-dasharray="6 5"/>
    ${WC(`<ellipse cx="140" cy="100" rx="34" ry="26" fill="#e63946" opacity=".8"/><ellipse cx="112" cy="165" rx="22" ry="30" fill="#2563eb" opacity=".8"/><ellipse cx="168" cy="188" rx="16" ry="12" fill="#f7d51d" opacity=".9"/>`)}
    ${a.open?WC(`<g class="fade-in"><ellipse cx="260" cy="100" rx="34" ry="26" fill="#e63946" opacity=".8"/><ellipse cx="288" cy="165" rx="22" ry="30" fill="#2563eb" opacity=".8"/><ellipse cx="232" cy="188" rx="16" ry="12" fill="#f7d51d" opacity=".9"/></g>`)+`
    <text x="200" y="252" font-size="15" text-anchor="middle" fill="#666">펼치면 양쪽이 똑같아요 — 무엇처럼 보이나요?</text>`
    :`<path d="M320 150 q40 -60 -30 -95" stroke="#888" stroke-width="3" fill="none" class="tilt"/>
    <text x="200" y="252" font-size="15" text-anchor="middle" fill="#666">반으로 접었다 펴면?</text>`}`); },
  wheel(a){ const cols=['#e63946','#ef5b2e','#f28c28','#f7b32b','#f7d51d','#a8c93a','#3fa34d','#2a9d8f','#2563eb','#4547b8','#7b3fa0','#b8447e'];
    const on = a.stage===0?[0,4,8]:a.stage===1?[0,2,4,6,8,10]:cols.map((_,i)=>i);
    const seg=i=>{ const p=(deg,r)=>[(200+r*Math.cos((deg-90)*Math.PI/180)).toFixed(1),(128+r*Math.sin((deg-90)*Math.PI/180)).toFixed(1)];
      const [x1,y1]=p(i*30-15,40),[x2,y2]=p(i*30-15,92),[x3,y3]=p(i*30+15,92),[x4,y4]=p(i*30+15,40);
      const fill=on.includes(i)?(a.messy?cols[(i*5+3)%12]:cols[i]):'#f4f2ec';
      return `<path d="M${x1} ${y1} L${x2} ${y2} A92 92 0 0 1 ${x3} ${y3} L${x4} ${y4} A40 40 0 0 0 ${x1} ${y1}Z" fill="${fill}" stroke="#fff" stroke-width="2"/>`; };
    const pairs = a.stage===3?`<g stroke="#555" stroke-width="2" stroke-dasharray="5 4" class="fade-in"><line x1="200" y1="50" x2="200" y2="206"/><line x1="268" y1="89" x2="132" y2="167"/><line x1="268" y1="167" x2="132" y2="89"/></g>`:'';
    const swatch = a.stage===4?`<g transform="translate(316,36)">${WC([0,1,2,3].map(i=>`<rect x="${(i%2)*21}" y="${Math.floor(i/2)*21}" width="21" height="21" fill="${(i===0||i===3)?'#2563eb':'#f28c28'}" class="fade-in"/>`).join(''))}<text x="21" y="60" font-size="12" text-anchor="middle" fill="#666">보색 무늬</text></g>`:'';
    return svg(`${WC(cols.map((_,i)=>seg(i)).join(''))}${pairs}${swatch}
    <text x="200" y="248" font-size="14" text-anchor="middle" fill="#666">${['12시 빨강 · 4시 노랑 · 8시 파랑','사이사이에 주황 · 초록 · 보라','이웃끼리 섞어 12칸 완성','마주 보는 짝 = 보색','보색은 나란히 두면 서로 돋보여요'][Math.min(a.stage,4)]}</text>`); },
  sphere(a){ const s=a.stage, base='#2563eb';
    if(s===9) return svg(`${PAPER}${WC(`<circle cx="200" cy="130" r="72" fill="${base}" fill-opacity=".3" stroke="${base}" stroke-width="14" stroke-opacity=".85"/>`)}<text x="200" y="245" font-size="15" text-anchor="middle" fill="#666">테두리만 진하면 납작해 보여요</text>`);
    return svg(`${PAPER}
    <g class="tap"><circle cx="66" cy="52" r="13" fill="#f7d51d"/><path d="M85 66 L122 92" stroke="#e0a800" stroke-width="4"/><path d="M114 80 L124 94 L107 96Z" fill="#e0a800"/></g>
    ${s===0?`<circle cx="200" cy="132" r="76" fill="none" stroke="#999" stroke-dasharray="5 4"/>`:WC(`<circle cx="200" cy="132" r="76" fill="${base}" fill-opacity=".26"/>
    <circle cx="173" cy="103" r="19" fill="#efece4"/>
    ${s>=2?`<path d="M254 78 A76 76 0 0 1 146 186 A104 104 0 0 0 254 78Z" fill="${base}" fill-opacity=".3" class="fade-in"/>`:''}
    ${s>=3?`<path d="M269 100 A76 76 0 0 1 168 205 A148 148 0 0 0 269 100Z" fill="${base}" fill-opacity=".32" class="fade-in"/>`:''}
    ${s>=4?`<ellipse cx="224" cy="219" rx="68" ry="11" fill="${base}" fill-opacity=".45" class="fade-in"/>`:''}`)}
    <text x="200" y="252" font-size="14" text-anchor="middle" fill="#666">${['빛은 왼쪽 위에서!','반짝이는 곳은 남기고 전체 연하게','마른 뒤, 빛 반대쪽 절반 한 번 더','한 번 더 좁게 = 명암 3단계','그림자까지, 완성!'][Math.min(s,4)]}</text>`); },
  hills(a){ const s=a.stage, op=a.flat?[.55,.55,.55]:[.2,.48,.85];
    const far='M22 122 L80 78 L130 108 L190 70 L250 104 L310 82 L378 112 V238 H22Z';
    const mid='M22 162 L90 122 L160 152 L240 118 L310 150 L378 132 V238 H22Z';
    const near='M22 205 L110 158 L200 196 L290 160 L378 192 V238 H22Z';
    return svg(`${PAPER}
    ${s===0?`<g fill="none" stroke="#999" stroke-dasharray="4 3"><path d="${far}"/><path d="${mid}"/><path d="${near}"/></g>`:''}
    ${s>=1?WC(`<path d="${far}" fill="#2563eb" fill-opacity="${op[0]}" class="fade-in"/>`):''}
    ${s>=2?WC(`<path d="${mid}" fill="#2563eb" fill-opacity="${op[1]}" class="fade-in"/>`):''}
    ${s>=3?`${WC(`<path d="${near}" fill="#2563eb" fill-opacity="${op[2]}" class="fade-in"/>`)}${a.flat?'':`<g fill="#14336e" class="fade-in">${[[120,182],[210,208],[300,184]].map(([x,y])=>`<path d="M${x} ${y} l7 -18 l7 18Z"/>`).join('')}</g>`}`:''}
    <text x="200" y="253" font-size="14" text-anchor="middle" fill="#666">${a.flat?'다 같은 진하기면 평평해요':['능선 세 줄, 연필로 살짝','먼 산: 아주 연하게','가운데 산: 중간 진하기','앞 산: 진하게 + 세부는 여기만'][Math.min(s,3)]}</text>`); },
  observe(a){ const s=a.stage;
    const real=`<g transform="translate(80,118)"><ellipse cx="0" cy="42" rx="42" ry="7" fill="#c9b98f"/><circle r="34" fill="#c93a2e"/><circle cx="-11" cy="-12" r="8" fill="#fff" opacity=".55"/><circle cx="14" cy="-20" r="6" fill="#a8c93a" opacity=".9"/><path d="M0 -34 q4 -12 12 -14" stroke="#5b3a1e" stroke-width="4" fill="none"/><text y="66" font-size="13" text-anchor="middle" fill="#666">진짜 과일</text></g>`;
    return svg(`${PAPER}${real}
    <g transform="translate(258,116)">
      ${s===0?`<circle r="30" fill="none" stroke="#bbb" stroke-width="3" stroke-dasharray="5 4"/><circle cx="-4" cy="-4" r="13" fill="none" stroke="#888" stroke-width="3"/><line x1="6" y1="6" x2="18" y2="18" stroke="#888" stroke-width="3" stroke-linecap="round"/><text y="62" font-size="13" text-anchor="middle" fill="#666">먼저 1분 동안 관찰하기</text>`:''}
      ${s>=1?`<circle r="42" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="4 3"/>`:''}
      ${s>=2?WC(`<circle r="42" fill="#e46a5a" fill-opacity=".35"/><circle cx="-13" cy="-15" r="9" fill="#efece4"/>`):''}
      ${s>=3?WC(`<path d="M30 -29 A42 42 0 0 1 -21 36 A60 60 0 0 0 30 -29Z" fill="#c0392b" fill-opacity=".45" class="fade-in"/><circle cx="17" cy="-24" r="7" fill="#a8c93a" fill-opacity=".85" class="fade-in"/>`):''}
      ${s>=4?WC(`<path d="M0 -42 q3 -10 10 -12" stroke="#5b3a1e" stroke-width="4" fill="none" class="fade-in"/><ellipse cx="6" cy="50" rx="34" ry="7" fill="#8b6f4e" fill-opacity=".5" class="fade-in"/>`):''}
    </g>
    ${s>=1?`<text x="258" y="245" font-size="13" text-anchor="middle" fill="#666">${['','크게, 연하게 스케치','밝은 색부터 연하게','어두운 쪽 + 관찰한 색','세부와 그림자'][s]}</text>`:''}`); },
  warmcool(a){ const s=a.stage;
    if(s===0) return svg(`${WC(`<path d="M200 28 A102 102 0 0 0 200 232Z" fill="#7cc4ff" fill-opacity=".35"/><path d="M200 28 A102 102 0 0 1 200 232Z" fill="#ffb37c" fill-opacity=".4"/>
      ${['#e63946','#f28c28','#f7d51d'].map((c,i)=>`<circle cx="${252+((i%2)*26)}" cy="${72+i*56}" r="17" fill="${c}" class="fade-in" style="animation-delay:${i*.3}s"/>`).join('')}
      ${['#2563eb','#3fa34d','#7b3fa0'].map((c,i)=>`<circle cx="${148-((i%2)*26)}" cy="${72+i*56}" r="17" fill="${c}" class="fade-in" style="animation-delay:${i*.3+.15}s"/>`).join('')}`)}
      <text x="292" y="248" font-size="15" text-anchor="middle" fill="#a5600e">따뜻한 색</text><text x="108" y="248" font-size="15" text-anchor="middle" fill="#2c5c8a">차가운 색</text>`);
    return svg(`<defs><filter id="bl3"><feGaussianBlur stdDeviation="10"/></filter></defs>${PAPER}
    <ellipse cx="200" cy="128" rx="140" ry="78" fill="#eaf4ff" stroke="#bcd" stroke-dasharray="5 4"/>
    <circle cx="${s===1?200:152}" cy="122" r="50" fill="#f7b32b" filter="url(#bl3)" opacity=".85" class="${a.still?'':'blob'}"/>
    ${s>=2?`<circle cx="253" cy="133" r="46" fill="#2563eb" filter="url(#bl3)" opacity=".75" class="${a.still?'':'blob b2'}"/>`:''}
    <text x="200" y="250" font-size="14" text-anchor="middle" fill="#666">${a.still?'제목: ＿＿＿＿ (제목까지가 작품!)':s===1?'내 기분은 무슨 색인가요?':'두 기분이 만나는 곳'}</text>`); },
  planart(a){ const s=a.stage;
    const paint=`<rect x="30" y="34" width="245" height="160" rx="4" fill="#fff" stroke="#ccc"/>
      ${WC(`<rect x="34" y="38" width="237" height="76" fill="#f9a8c9" opacity="${s>=2?.55:0}"/>
      <path d="M34 140 Q125 100 195 130 T271 124 V190 H34Z" fill="#3fa34d" opacity="${s>=3?.65:0}"/>`)}
      ${s>=4?`<rect x="190" y="104" width="6" height="30" fill="#5b3a1e"/><circle cx="193" cy="96" r="15" fill="#245c2a"/><text x="252" y="186" font-size="10" fill="#555">제목·이름</text>`:''}`;
    return svg(`
    ${s===0?`${PAPER}<text x="200" y="110" font-size="19" text-anchor="middle" fill="#444">무엇을 보여주고 싶나요?</text><text x="90" y="160" font-size="17" fill="#888">주제:</text><line x1="140" y1="163" x2="330" y2="163" stroke="#aaa" stroke-width="2"/><g transform="translate(330,150) rotate(40)"><rect x="-4" y="-34" width="8" height="30" fill="#c9a35a"/><path d="M-4 -4 L4 -4 L0 6Z" fill="#555"/></g>`:''}
    ${s===1?`${PAPER}${[['번지기 → 하늘','#cfe3ff',48],['겹쳐 칠하기 → 그림자','#ffe6b3',113],['보색 → 꽃과 잎','#e3d1f2',178]].map(([t,c,y],i)=>`<g class="fade-in" style="animation-delay:${i*.4}s"><rect x="70" y="${y}" width="260" height="46" rx="8" fill="${c}" stroke="#bbb"/><text x="200" y="${y+29}" font-size="17" text-anchor="middle" fill="#333">${t}</text></g>`).join('')}`:''}
    ${s>=2&&s<=4?`${paint}${s===2?BRUSH(150,80,'#f9a8c9','brush'):''}${s===3?`<g class="tap"><circle cx="330" cy="88" r="16" fill="none" stroke="#888" stroke-width="2.5"/><text x="330" y="95" font-size="20" text-anchor="middle" fill="#888">?</text></g>`:''}<text x="330" y="150" font-size="13" text-anchor="middle" fill="#666">${['','','넓은 곳부터','물러나 보기','완성!'][s]}</text>`:''}
    ${s===5?`${PAPER}<g transform="translate(105,115)"><rect x="-45" y="-38" width="90" height="76" fill="#fff" stroke="#bbb"/><rect x="-40" y="-33" width="80" height="34" fill="#f9a8c9" opacity=".6"/><path d="M-40 33 Q-10 8 40 26 V33Z" fill="#3fa34d" opacity=".6"/></g><g transform="translate(295,115)"><rect x="-45" y="-38" width="90" height="76" fill="#fff" stroke="#bbb"/><circle cx="-8" cy="-6" r="20" fill="#f7b32b" opacity=".6"/><circle cx="18" cy="12" r="14" fill="#2563eb" opacity=".5"/></g><g class="tap"><path d="M178 105 h44 v26 h-30 l-8 9 v-9 h-6Z" fill="#fff" stroke="#888"/></g><text x="200" y="240" font-size="15" text-anchor="middle" fill="#666">"좋은 점 한 가지" 찾아 말하기</text>`:''}`); },

  /* ---- 명암 띠 · 원기둥 · 원뿔 · 나무 (2026-09-03 추가) ---- */
  strips(a){ const op=[.14,.3,.48,.68,.9]; return svg(`${PAPER}${WC(op.map((o,i)=>`<rect x="${52+i*60}" y="62" width="48" height="128" rx="3" fill="#2563eb" fill-opacity="${o}"/>`).join(''))}
    <text x="76" y="212" font-size="13" text-anchor="middle" fill="#666">물 많이</text><text x="196" y="212" font-size="13" text-anchor="middle" fill="#666">물 반, 물감 반</text><text x="316" y="212" font-size="13" text-anchor="middle" fill="#666">물감 많이</text>
    <text x="200" y="236" font-size="16" text-anchor="middle" fill="#666">왼쪽 연하게 → 오른쪽 진하게, 다섯 칸</text>`); },
  cylinder(a){ const s=a.stage||0, op=a.flat?[.5,.5,.5,.5,.5]:[.14,.3,.48,.68,.9], base='#2563eb';
    const light='<path d="M40 46 L70 70" stroke="#c8962e" stroke-width="3"/><circle cx="40" cy="46" r="9" fill="#f5d58a" stroke="#c8962e"/>';
    const outline='<path d="M110 70 V190 A70 18 0 0 0 250 190 V70" fill="none" stroke="#777" stroke-width="1.6" stroke-dasharray="5 4"/><ellipse cx="180" cy="70" rx="70" ry="18" fill="none" stroke="#777" stroke-width="1.6" stroke-dasharray="5 4"/>';
    const stripes=op.map((o,i)=>`<rect x="${110+i*28}" y="70" width="28" height="120" fill="${base}" fill-opacity="${o}"/>`).join('');
    const body=s>=1?WC(`<clipPath id="cyl"><path d="M110 70 V190 A70 18 0 0 0 250 190 V70 Z"/></clipPath><g clip-path="url(#cyl)">${stripes}</g><ellipse cx="180" cy="70" rx="70" ry="18" fill="${base}" fill-opacity=".12" stroke="${base}" stroke-opacity=".5"/>`):'';
    const shadow=s>=2?WC(`<ellipse cx="228" cy="200" rx="78" ry="13" fill="#1e3a8a" fill-opacity="${a.flat?.5:.75}"/>`):'';
    return svg(`${PAPER}${light}${shadow}${body}${outline}<text x="200" y="236" font-size="16" text-anchor="middle" fill="#666">${s===0?'위 타원 · 세로 두 줄 · 아래 곡선':s===1?'띠 하나 = 붓질 한 번, 위에서 아래로':'빛 반대쪽 바닥에 납작한 그림자'}</text>`); },
  cone(a){ const s=a.stage||0, op=a.flat?[.5,.5,.5,.5,.5]:[.14,.3,.48,.68,.9], base='#2563eb';
    const light='<path d="M40 46 L70 70" stroke="#c8962e" stroke-width="3"/><circle cx="40" cy="46" r="9" fill="#f5d58a" stroke="#c8962e"/>';
    const outline='<path d="M200 44 L110 190 A90 16 0 0 0 290 190 Z" fill="none" stroke="#777" stroke-width="1.6" stroke-dasharray="5 4"/>';
    const wedges=op.map((o,i)=>`<path d="M200 44 L${110+i*36} 200 L${110+(i+1)*36} 200 Z" fill="${base}" fill-opacity="${o}"/>`).join('');
    const body=s>=1?WC(`<clipPath id="cone"><path d="M200 44 L110 190 A90 16 0 0 0 290 190 Z"/></clipPath><g clip-path="url(#cone)">${wedges}</g>`):'';
    const shadow=s>=2?WC('<ellipse cx="250" cy="200" rx="80" ry="12" fill="#1e3a8a" fill-opacity=".75"/>'):'';
    return svg(`${PAPER}${light}${shadow}${body}${outline}<text x="200" y="236" font-size="16" text-anchor="middle" fill="#666">${s===0?'꼭짓점 하나, 아래는 타원':'꼭짓점에서 아래로 부채꼴 띠'}</text>`); },
  treecone(a){ const s=a.stage||0, g=['#b9dc7a','#8fc457','#5fa33a','#3f7f2a','#2b5c1d'];
    const light='<path d="M40 46 L70 70" stroke="#c8962e" stroke-width="3"/><circle cx="40" cy="46" r="9" fill="#f5d58a" stroke="#c8962e"/>';
    const tri='M200 36 L118 178 L282 178 Z', trunk='M186 178 V222 H214 V178';
    const outline=`<path d="${tri}" fill="none" stroke="#777" stroke-width="1.6" stroke-dasharray="5 4"/><path d="${trunk}" fill="none" stroke="#777" stroke-width="1.6" stroke-dasharray="5 4"/>`;
    const wedges=g.map((c,i)=>`<path d="M200 36 L${118+i*32.8} 180 L${118+(i+1)*32.8} 180 Z" fill="${c}"/>`).join('');
    const leaves=s>=1?WC(`<clipPath id="tc"><path d="${tri}"/></clipPath><g clip-path="url(#tc)">${wedges}</g>`):'';
    const bark=s>=2?WC(`<rect x="186" y="178" width="10" height="44" fill="#b98a5a"/><rect x="196" y="178" width="9" height="44" fill="#8b5e3c"/><rect x="205" y="178" width="9" height="44" fill="#5c3b22"/><ellipse cx="236" cy="224" rx="44" ry="8" fill="#3b2a1a" fill-opacity=".55"/>`):'';
    return svg(`${PAPER}${light}${bark}${leaves}${outline}<text x="200" y="244" font-size="15" text-anchor="middle" fill="#666">${s===0?'긴 삼각형 + 줄기 자리':s===1?'연두 → 초록 → 진초록, 세로 띠':'줄기는 원기둥처럼, 오른쪽 진하게'}</text>`); },
  treeround(a){ const s=a.stage||0, flat=!!a.flat;
    const blobs=[[150,118,44],[236,104,50],[196,152,42],[268,150,34]];
    const light='<path d="M40 46 L70 70" stroke="#c8962e" stroke-width="3"/><circle cx="40" cy="46" r="9" fill="#f5d58a" stroke="#c8962e"/>';
    const outline=blobs.map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#777" stroke-width="1.6" stroke-dasharray="5 4"/>`).join('')+'<path d="M198 190 V226 H222 V190" fill="none" stroke="#777" stroke-width="1.6" stroke-dasharray="5 4"/>';
    const tone=([x,y,r],i)=>flat?`<circle cx="${x}" cy="${y}" r="${r}" fill="#5fa33a"/>`:
      `<g><circle cx="${x}" cy="${y}" r="${r}" fill="#5fa33a"/><circle cx="${x-r*.25}" cy="${y-r*.28}" r="${r*.62}" fill="#b9dc7a"/><path d="M${x-r} ${y} A${r} ${r} 0 0 0 ${x+r} ${y} A${r*1.1} ${r*.55} 0 0 1 ${x-r} ${y} Z" fill="#2b5c1d" fill-opacity=".85"/></g>`;
    const leaves=s>=1?WC(blobs.map(tone).join('')):'';
    const bark=s>=2?WC('<rect x="198" y="186" width="9" height="40" fill="#b98a5a"/><rect x="207" y="186" width="8" height="40" fill="#8b5e3c"/><rect x="215" y="186" width="7" height="40" fill="#5c3b22"/><ellipse cx="246" cy="228" rx="46" ry="8" fill="#3b2a1a" fill-opacity=".55"/>'):'';
    return svg(`${PAPER}${light}${bark}${leaves}${outline}<text x="200" y="250" font-size="15" text-anchor="middle" fill="#666">${s===0?'구름 같은 잎 덩어리 3~4개':s===1?'덩어리마다 연두(위) · 초록 · 진초록(아래)':'줄기는 덩어리 사이에서'}</text>`); },
};

const LESSONS = [
{
  id:0, part:1, title:'준비하고 붓과 놀기', tech:'재료와 용구 · 점·선·면', std:'[4미02-02] 재료와 용구의 특성 이해, 사용 방법 익히기 · [4미01-01] 다양한 감각 탐색 · [4미02-03] 조형 요소(점·선·면)', goal:'붓·물·물감을 바르게 준비하고, 붓으로 점·선·면을 마음껏 실험해요',
  materials:['두꺼운 종이(수채화지 또는 200g 도화지)','굵은 붓(12호 정도)','가는 붓(4호 정도)','물통 2개','팔레트','물감(빨강·노랑·파랑 위주)','걸레 또는 휴지','종이테이프','연필','좋아하는 색 물감 2~3개'],
  steps:[
    { text:'수업 전날, 팔레트에 물감을 짜서 말려 두어요.', sub:'칸 안쪽 벽에 닿도록 넉넉히. 비슷한 색끼리 이웃하게.', art:{type:'palette', dry:true},
      tip:'<b>가장 효과 큰 준비.</b> 3~4학년도 "방금 짠 물감"은 양 조절을 못 합니다. 말라 있는 물감은 젖은 붓으로 문지르면 바로 쓸 수 있고, 한 번 짜 두면 한 학기 동안 씁니다. 배열은 빨강→주황→노랑→초록→파랑→보라 순(색상환 순서)으로 하면 색 섞기 수업과 연결됩니다.' },
    { text:'두꺼운 종이를 골라, 네 변을 종이테이프로 붙여요.', sub:'얇은 도화지는 물을 못 먹어서 번지기가 잘 안 돼요.', art:{type:'tape'},
      tip:'<b>번지기 실패 원인 1순위가 종이입니다.</b> 일반 얇은 도화지(120g 이하)는 물이 바로 스며들어 번지지 않고 종이가 웁니다. 수채화지가 없으면 200g 이상 도화지로. 테이프는 나중에 바깥쪽으로 천천히 떼어야 찢어지지 않습니다.' },
    { text:'물통을 두 개 놓아요. 씻는 물, 깨끗한 물.', sub:'깨끗한 물은 색을 만들 때만 써요.', art:{type:'cups'},
      tip:'씻는 물이 탁해지면 그 물로 만든 색은 모두 회색빛이 됩니다. "색 만들 때는 깨끗한 물통"을 규칙으로 정하세요.' },
    { text:'붓은 연필처럼 잡아요. 세우면 가는 선, 눕히면 넓은 면.', sub:'문지르지 말고 미끄러지듯이 한 번에.', art:{type:'hold'},
      tip:'붓을 꾹 눌러 문지르면 종이가 일어나고 붓이 갈라집니다. "붓은 종이 위를 스케이트 타듯"이라고 말해 주세요. 붓끝을 세워 가는 선, 옆면을 눕혀 넓은 면을 칠하는 두 가지를 종이 구석에서 각각 세 번씩 연습시키면 좋습니다.' },
    { text:'붓 씻기: 물에서 흔들흔들 → 물통 옆에 톡톡 → 걸레에 톡톡.', sub:'색을 바꿀 때마다 꼭.', art:{type:'wash'},
      tip:'붓을 물통 바닥에 찧지 않게. "톡톡 두 번"이 물 조절의 기본 동작이니 오늘 여러 번 시키세요. 평가는 그림이 아니라 "붓과 물을 바르게 쓰는가"를 관찰하는 것으로 충분합니다.' },
    { text:'좋아하는 색으로 점을 콕콕 찍어요. 크게, 작게.', sub:'붓끝으로 가볍게, 붓을 눌러서 굵게.', water:2, paint:2, art:{type:'free', mode:'dots'},
      tip:'첫 물감 활동은 잘 그리기가 아니라 놀이입니다. 점 하나에도 물이 많으면 퍼지고 적으면 또렷한 것을 스스로 발견하게 두세요. 이 단계에서는 결과물을 평가하지 않는 것이 가장 중요합니다.' },
    { text:'이번엔 선! 곧은 선, 구불구불한 선, 빙글빙글 선. 그리고 붓을 눕혀 넓은 면도 쓱쓱.', sub:'팔 전체로 크게 그어요. 네모, 동그라미, 아무 모양이나.', water:2, paint:2, art:{type:'free', mode:'all'},
      tip:'음악을 틀고 리듬에 맞춰 긋게 하면 몸의 감각과 연결됩니다([4미01-01]). 손목만 쓰는 아이는 팔꿈치를 들고 크게 긋도록 해주세요. 앞 단계의 "세우면 선, 눕히면 면"을 놀이로 익히는 단계입니다. 모양의 이름을 묻지 말고 크기와 느낌을 물어보세요. 마지막에 "어떤 점·선이 제일 마음에 드니?"라고 물으면 조형 요소의 말로 자기 그림을 이야기하는 연습이 됩니다.' },
  ],
  check:{ q:'준비가 되고, 붓과 친해졌나요?',
    items:['팔레트 물감이 말라 있어요','두꺼운 종이를 테이프로 붙였어요','물통이 두 개 있어요','크고 작은 점을 찍어 봤어요','세 가지 다른 선을 긋고, 붓을 눕혀 면도 칠해 봤어요'] }
},
{
  id:1, part:2, title:'물의 양과 진하기', tech:'명도 단계', std:'[4미02-02] 용구 사용 · [4미02-03] 조형 요소(색) 탐색', goal:'같은 색으로 연한 색부터 진한 색까지 만들어요',
  materials:['파랑 물감','굵은 붓','가는 붓','종이(네모 세 칸)'],
  steps:[
    { text:'종이에 네모 세 칸을 연필로 그려요.', sub:'손바닥보다 크게.', art:{type:'boxes', fill:[0,0,0]},
      tip:'칸이 작으면 붓질 연습이 안 됩니다. 연필선은 물감 아래로 비쳐도 괜찮다고 미리 말해 주세요.' },
    { text:'붓을 물에 흠뻑 적시고 파랑을 조금만. 첫째 칸을 칠해요.', sub:'연한 파랑 = 물 많이, 물감 조금', water:3, paint:1, art:{type:'boxes', fill:[0.25,0,0], brush:0},
      tip:'붓에서 물이 뚝 떨어지면 너무 많은 것. 걸레에 한 번 톡. 종이에 물웅덩이가 생기면 마른 붓으로 찍어 빨아들이게 하세요.' },
    { text:'걸레에 톡톡 두 번, 파랑을 더 묻혀요. 둘째 칸.', sub:'중간 파랑 = 물 반, 물감 반', water:2, paint:2, art:{type:'boxes', fill:[0.25,0.6,0], brush:1},
      tip:'"물 반, 물감 반"이 대부분의 수채화에 쓰는 기본 농도입니다. 첫째 칸 옆에 두고 차이를 스스로 보게 하세요.' },
    { text:'물은 거의 없이 물감을 많이. 셋째 칸.', sub:'진한 파랑 = 물 조금, 물감 많이', water:1, paint:3, art:{type:'boxes', fill:[0.25,0.6,1], brush:2},
      tip:'붓이 뻑뻑해 안 칠해지면 물 한 방울만 더. 이 농도는 나무 줄기·윤곽선처럼 진하게 그릴 때 씁니다.' },
    { text:'가는 붓으로 세 농도의 선을 칸 아래에 그어 봐요.', sub:'연한 선, 중간 선, 진한 선. 같은 색인데 셋 다 달라요.', water:2, paint:2, art:{type:'lines'},
      tip:'색의 밝고 어두움을 물의 양으로 조절한다는 것이 이 차시의 개념입니다. "명도"는 교육과정 필수 용어가 아니므로(초등 교육과정 원문에 미등장) "색의 진하기"로 충분하고, 용어를 소개하는 것은 선택입니다. 5단계로 늘려 도전하게 해도 됩니다(드릴 연습장 A).' },
  ],
  check:{ q:'세 칸이 연한 색 → 진한 색으로 뚜렷하게 보이나요?',
    good:{art:{type:'boxes', fill:[0.25,0.6,1]}, text:'연함 → 중간 → 진함이 한눈에 보여요.'},
    bad:{art:{type:'boxes', fill:[0.5,0.55,0.6]}, text:'세 칸이 비슷해요. 물의 양 차이를 더 크게!'},
    tip:'비슷하게 나온 학생은 대부분 "물을 줄이는 법"을 몰라서입니다. 걸레에 톡톡 닦는 걸 다시 보여주고 셋째 칸만 다시 칠하게 하세요. 같은 색으로 여러 명도를 낼 수 있다는 것이 오늘의 핵심입니다.' }
},
{
  id:2, part:2, title:'색 섞기', tech:'삼원색과 이차색', std:'[4미02-03] 조형 요소(색) 탐색', goal:'빨강·노랑·파랑 세 색으로 여러 색을 만들어요',
  materials:['빨강·노랑·파랑 물감','굵은 붓','깨끗한 물통','종이'],
  steps:[
    { text:'먼저 예상해요. 노랑에 빨강을 조금 섞으면 무슨 색?', sub:'아래에서 골라 봐요.', art:{type:'mix', a:'#f7d51d', b:'#e63946', c:'#f28c28', hide:true}, quiz:{options:[['초록','#3fa34d'],['주황','#f28c28'],['보라','#7b3fa0']], answer:1},
      tip:'혼색 연구에서 "예상 → 섞기 → 확인" 순서가 이해도를 크게 올렸습니다. 손을 들어 답하게 하거나 종이에 예상 색 이름을 쓰게 하세요.' },
    { text:'팔레트 빈 칸에 노랑을 놓고 빨강을 아주 조금 섞어요.', sub:'주황이 나왔나요? 종이에 동그라미로 칠해요.', water:2, paint:2, art:{type:'mix', a:'#f7d51d', b:'#e63946', c:'#f28c28'},
      tip:'<b>순서:</b> 연한 색(노랑) 먼저, 진한 색(빨강·파랑)을 아주 조금씩. 반대로 하면 노랑을 아무리 넣어도 밝아지지 않습니다.' },
    { text:'붓을 씻고, 노랑에 파랑을 조금. 초록.', sub:'파랑 양을 바꾸면 연두부터 청록까지 나와요.', water:2, paint:2, art:{type:'mix', a:'#f7d51d', b:'#2563eb', c:'#3fa34d'},
      tip:'파랑은 힘이 세서 조금만 넣어도 확 바뀝니다. 초록을 세 가지 만들어 보게 하면(연두·초록·청록) "나뭇잎 색이 다 다르다"는 관찰로 이어집니다.' },
    { text:'붓을 씻고, 빨강에 파랑을 조금. 보라.', sub:'', water:2, paint:2, art:{type:'mix', a:'#e63946', b:'#2563eb', c:'#7b3fa0'},
      tip:'물감에 따라 탁한 보라가 나오기도 합니다. 그것도 정답. "삼원색 → 이차색(주황·초록·보라)" 용어를 칠판에 정리해 주세요.' },
    { text:'연한 색은 흰색이 아니라 물로 만들어요.', sub:'주황에 물을 더 넣어 연한 주황을 만들어요.', water:3, paint:1, art:{type:'lighten', c:'#f28c28'},
      tip:'<b>수채화의 규칙:</b> 밝게 = 물, 종이의 흰색 남기기. 흰 물감을 섞으면 탁하고 불투명해져 수채화 느낌이 사라집니다. 오늘은 흰색을 꺼내지 않는 것도 방법.' },
    { text:'세 색을 다 섞으면? 갈색.', sub:'흙, 나무 줄기, 그림자에 쓰는 색이에요.', water:2, paint:2, art:{type:'mix3'},
      tip:'실패가 아니라 "탁한 색 만드는 법"으로 소개하세요. 색을 많이 섞을수록 탁해진다는 것을 알면, 아무 색이나 섞어 갈색 범벅이 되는 일이 줄어듭니다.' },
  ],
  check:{ q:'삼원색으로 이차색 세 가지를 모두 만들었나요?',
    good:{art:{type:'dots', colors:['#f28c28','#3fa34d','#7b3fa0','#f9c784','#8b5e3c']}, text:'주황·초록·보라, 연한 색, 갈색까지!'},
    bad:{art:{type:'dots', colors:['#8b7355','#7a6a5a','#8b7355']}, text:'다 비슷한 갈색이에요. 붓을 씻고, 진한 색은 조금만.'},
    tip:'갈색만 나온 학생은 ① 붓을 안 씻었거나 ② 씻는 물통에서 색을 만들었거나 ③ 세 색을 다 넣은 경우입니다. 팔레트 빈 칸을 닦고 두 색만으로 다시.' }
},
{
  id:3, part:2, title:'평칠과 그러데이션', tech:'평칠 · 그러데이션', std:'[4미02-02] 용구 사용 방법', goal:'줄이 안 생기게 고르게 칠하고, 점점 연하게 만들어요',
  materials:['파랑(또는 좋아하는 색)','굵은 붓','종이(큰 네모 두 개)'],
  steps:[
    { text:'팔레트에 중간 농도 물감을 넉넉히 만들어 두어요.', sub:'칸 하나를 다 칠할 만큼.', water:2, paint:2, art:{type:'palette-pool', c:'#2563eb'},
      tip:'평칠 실패 원인 1위는 "물감이 중간에 모자라 다시 만드는 사이 앞부분이 마르는 것"입니다. 시작 전에 충분히 섞어 두게 하세요.' },
    { text:'평칠: 왼쪽에서 오른쪽으로, 한 줄을 한 번에.', sub:'첫째 네모 맨 위. 중간에 멈추지 않아요.', water:2, paint:2, art:{type:'wash', c:'#2563eb', rows:1},
      tip:'붓을 떼지 않고 한 번에. 종이를 책 한 권 두께로 기울이면 물감이 아래쪽에 모여 다음 줄과 잘 이어집니다.' },
    { text:'바로 아래에 살짝 겹치게 또 한 줄을 이어요.', sub:'앞줄이 마르기 전에 빠르게.', water:2, paint:2, art:{type:'wash', c:'#2563eb', rows:3},
      tip:'줄 사이 틈 → 흰 줄무늬, 앞줄이 마른 뒤 겹침 → 진한 줄무늬. 둘 다 속도 문제입니다. 네모 하나를 30초 안에.' },
    { text:'다 칠했으면 만지지 말고 기다려요.', sub:'붓을 씻으면서.', art:{type:'wash', c:'#2563eb', rows:3, done:true}, wait:60,
      tip:'마르는 동안 "고치려고" 붓을 대면 망칩니다. 얼룩은 마르면 옅어지는 경우가 많습니다.' },
    { text:'그러데이션: 둘째 네모, 진한 색으로 시작해요.', sub:'맨 윗줄은 진하게.', water:1, paint:3, art:{type:'grad', c:'#2563eb', rows:1},
      tip:'그러데이션은 "진하게 시작 → 물만 더하기"입니다. 반대 방향은 훨씬 어려우니 이 순서로만.' },
    { text:'한 줄마다 붓을 물에 살짝 담갔다가 칠해요. 물감은 더 안 묻혀요.', sub:'점점 연해져요.', water:3, paint:0, art:{type:'grad', c:'#2563eb', rows:4},
      tip:'팔레트로 돌아가면 다시 진해집니다. 마지막 줄은 거의 물만 칠해 종이색에 가깝게 끝내게 하세요.' },
  ],
  check:{ q:'둘째 네모가 위에서 아래로 부드럽게 연해졌나요?',
    good:{art:{type:'grad', c:'#2563eb', rows:4, still:true}, text:'줄무늬 없이 부드럽게.'},
    bad:{art:{type:'stripes', c:'#2563eb'}, text:'줄무늬가 보여요. 앞줄이 마르기 전에 더 빨리!'},
    tip:'줄무늬는 이 단계에서 정상입니다. "빨리, 겹치게, 물만 더하기" 세 마디로 정리하고 한 번 더. 하늘·바다·저녁놀이 모두 이 기법입니다.' }
},
{
  id:4, part:2, title:'번지기', tech:'습식 기법 (젖은 종이 위)', std:'[4미02-02] 재료의 특성 이해', goal:'젖은 종이 위에서 색이 스스로 퍼지게 해요',
  materials:['깨끗한 물','두세 가지 색','굵은 붓'],
  steps:[
    { text:'깨끗한 붓에 물만 묻혀 종이 한 부분을 칠해요.', sub:'물감 없이! 종이가 반짝일 정도로.', water:3, paint:0, art:{type:'wet'},
      tip:'"반짝이지만 웅덩이는 아닌 상태"가 목표. 종이를 기울여 빛에 비추면 보입니다. 웅덩이는 마른 붓으로 찍어 빨아들이게.' },
    { text:'물이 스며드는 동안 팔레트에 진한 물감을 준비해요.', sub:'물 조금, 물감 많이.', water:1, paint:3, art:{type:'palette-pool', c:'#2563eb'},
      tip:'물감은 진해야 젖은 종이 위에서 퍼집니다. 붓에 물이 많으면 오히려 흰 자국(백런)이 생겨요.' },
    { text:'젖은 곳에 붓을 한 번만 살짝 대요. 색이 퍼지는 걸 봐요.', sub:'문지르지 말고, 대었다가 바로 손 떼기.', water:1, paint:3, art:{type:'wetwet', colors:['#2563eb']},
      tip:'"톡 대고 손 떼기"를 시범 보여 주세요. 안 퍼지면 종이가 이미 마른 것 → 물을 다시 칠하고 재도전.' },
    { text:'씻은 붓으로 물감 가장자리를 살살 몰고 가요.', sub:'색이 더 멀리, 더 옅게 퍼져요.', water:2, paint:0, art:{type:'wetwet', colors:['#2563eb'], push:true},
      tip:'심화 동작. 물감을 묻히지 않은 젖은 붓으로 색의 끝을 끌어 옮기면 자연스러운 그라데이션이 됩니다. 문지르면 안 되고 "끌기".' },
    { text:'다른 색도 옆에 살짝 대요. 두 색이 만나요.', sub:'붓을 씻고 다른 색으로.', water:1, paint:3, art:{type:'wetwet', colors:['#2563eb','#e63946','#f7d51d']},
      tip:'색이 만나 저절로 섞이는 것을 관찰하는 게 목표입니다. 재촉하지 말고 충분히 지켜볼 시간을 주세요.' },
    { text:'절대 만지지 말고 기다려요.', sub:'마르면서 모양이 변해요.', art:{type:'wetwet', colors:['#2563eb','#e63946','#f7d51d'], still:true}, wait:120,
      tip:'마르는 2분 동안 "무엇처럼 보이나요?"를 이야기하게 하세요(구름, 바다, 불꽃). [4미02-01] 상상으로 주제 떠올리기와 연결됩니다.' },
  ],
  check:{ q:'색의 가장자리가 부드럽게 퍼졌나요?',
    good:{art:{type:'wetwet', colors:['#2563eb','#e63946'], still:true}, text:'테두리가 흐릿하게, 색이 저절로 섞였어요.'},
    bad:{art:{type:'wetdry', a:'#2563eb', b:'#e63946', hard:true}, text:'테두리가 또렷해요. 종이가 말라 있었거나, 붓으로 문질렀어요.'},
    tip:'또렷하게 나온 학생은 ① 물 칠하고 시간이 지나 마름 ② 물감에 물이 너무 많음 ③ 문지름 ④ 종이가 얇음 중 하나입니다. 하늘·노을·물속·불꽃놀이에 쓰는 기법.' }
},
{
  id:5, part:2, title:'겹쳐 칠하기', tech:'건식 기법 · 글레이징', std:'[4미02-02] 재료의 특성 이해', goal:'마른 뒤에 칠하면 퍼지지 않고 겹쳐요',
  materials:['노랑·파랑 물감','굵은 붓'],
  steps:[
    { text:'연한 노랑으로 동그라미를 칠해요.', sub:'물 넉넉히, 연하게.', water:3, paint:1, art:{type:'wetdry', a:'#f7d51d', only:1},
      tip:'첫 색은 반드시 연하게. 밝은 색 → 진한 색 순서가 수채화의 기본 순서입니다.' },
    { text:'완전히 마를 때까지 기다려요.', sub:'손등을 대 봐서 차갑지 않으면 마른 거예요.', art:{type:'wetdry', a:'#f7d51d', only:1, still:true}, wait:180,
      tip:'"차갑지 않으면 마른 것" 확인법을 알려주세요. 덜 말랐을 때 칠하면 번지기가 되어 버립니다(번지기 차시와 비교). 급하면 드라이어 찬바람.' },
    { text:'마른 노랑 위에 파랑 동그라미를 반쯤 겹쳐 칠해요.', sub:'한 번에 쓱. 문지르지 않기.', water:2, paint:2, art:{type:'wetdry', a:'#f7d51d', b:'#2563eb'},
      tip:'같은 자리를 여러 번 문지르면 아래 노랑이 녹아 올라와 탁해집니다. 겹친 곳이 초록이 되는 걸 색 섞기 차시와 연결.' },
    { text:'마른 뒤 파랑 동그라미의 한쪽을 같은 색으로 한 번 더.', sub:'겹칠수록 진해져요 → 그림자!', water:2, paint:2, art:{type:'wetdry', a:'#f7d51d', b:'#2563eb', c:true},
      tip:'글레이징으로 명암·입체감을 만드는 원리입니다. 사과·공 그리기로 확장하면 [4미02-03] 조형 요소(명암)와 연결됩니다.' },
  ],
  check:{ q:'겹친 부분의 테두리가 또렷한가요?',
    good:{art:{type:'wetdry', a:'#f7d51d', b:'#2563eb'}, text:'또렷하게 겹치고, 겹친 곳은 초록.'},
    bad:{art:{type:'wetwet', colors:['#f7d51d','#2563eb'], still:true}, text:'번졌어요. 첫 색이 덜 말랐을 때 칠했어요.'},
    tip:'번지기(젖었을 때)와 겹쳐 칠하기(말랐을 때) 작품을 나란히 놓고 "뭐가 다르지?"를 물어보면 학생 스스로 정리합니다. 이 둘이 수채화 기법의 거의 전부입니다.' }
},
{
  id:6, part:2, title:'크레파스 배수', tech:'배수 기법 (배틱)', std:'[4미02-02] 재료의 특성 이해', goal:'크레파스가 물감을 밀어내는 성질로 무늬를 만들어요',
  materials:['흰색·밝은색 크레파스(또는 양초)','파랑·보라 물감','굵은 붓','검정 네임펜'],
  steps:[
    { text:'흰 크레파스로 종이에 무늬를 꾹 눌러 그려요.', sub:'별, 물결, 눈송이, 내 이름. 잘 안 보여도 괜찮아요.', art:{type:'resist', stage:0},
      tip:'세게 눌러 두껍게 그려야 물감이 튕깁니다. 약하게 그리면 무늬가 안 나오는 게 실패 원인 1위. 흰 크레파스는 안 보이니 종이를 기울여 확인하게 하세요. 양초도 됩니다.' },
    { text:'그 위에 연한 물감을 넓게 칠해요.', sub:'물 많이! 크레파스 부분이 하얗게 남아요.', water:3, paint:1, art:{type:'resist', stage:1},
      tip:'물감이 진하면 무늬가 묻힙니다. 연한 농도로 한 번에 넓게(평칠 차시). 밤하늘=진한 파랑, 바다=청록처럼 주제와 연결해도 좋습니다.' },
    { text:'무늬가 드러나는 걸 관찰해요. 왜 물감이 안 묻을까요?', sub:'기름(크레파스)과 물(물감)은 서로 밀어내요.', art:{type:'resist', stage:1, still:true}, wait:120,
      tip:'재료의 특성([4미02-02])을 눈으로 확인하는 순간입니다. "기름과 물은 섞이지 않는다"를 과학과 연결해 설명하면 좋습니다.' },
    { text:'마른 뒤, 검정 네임펜으로 윤곽을 그려 넣어요.', sub:'물감 위에 그리면 선이 또렷하게 남아요.', art:{type:'resist', stage:2},
      tip:'매직+수채 기법. 선을 먼저 그리고 물감을 칠하는 방법(유성펜은 번지지 않음)도 있으니 두 순서를 비교해 보게 해도 좋습니다.' },
  ],
  check:{ q:'크레파스 무늬가 하얗게 또렷이 남았나요?',
    good:{art:{type:'resist', stage:1, still:true}, text:'무늬가 선명하게 남았어요.'},
    bad:{art:{type:'resist', stage:1, weak:true}, text:'무늬가 희미해요. 크레파스를 더 세게, 물감은 더 연하게.'},
    tip:'희미하면 ① 크레파스를 약하게 칠함 ② 물감이 진함 ③ 같은 곳을 여러 번 문지름. 저학년부터 고학년까지 성공률이 가장 높은 기법이라 자신감 회복용으로도 좋습니다.' }
},
{
  id:7, part:3, title:'작품: 저녁 하늘과 언덕', tech:'기법 종합', std:'[4미02-01] 주제 구체화 · [4미02-02] · [4미02-03] · [4미02-04] 표현 의도·자기 작품 소중히', goal:'배운 기법을 골라 써서 그림을 완성해요',
  materials:['파랑·빨강·노랑','굵은 붓·가는 붓','새 종이','검정 네임펜(선택)'],
  steps:[
    { text:'어떤 장면을 그릴지 정해요. 저녁 하늘 아래 무엇이 있을까요?', sub:'언덕, 나무, 집, 바다… 하나만 골라요.', art:{type:'scene', stage:3, still:true},
      tip:'[4미02-01] 관찰·상상으로 주제 구체화. 사진을 보여주거나 창밖을 보게 한 뒤 "내 그림에는 무엇을 넣을까"를 한 줄로 쓰게 하세요.' },
    { text:'종이 위쪽 반 이상을 깨끗한 물로 칠해요. (번지기 준비)', sub:'반짝일 정도로.', water:3, paint:0, art:{type:'scene', stage:0},
      tip:'번지기 차시의 시작과 같습니다. 아래쪽(언덕)에는 물을 칠하지 않게.' },
    { text:'맨 위에 파랑, 가운데에 주황·분홍을 톡톡. (번지기)', sub:'색이 저절로 퍼지게 두어요.', water:1, paint:3, art:{type:'scene', stage:1},
      tip:'위 파랑, 아래 주황(노랑+빨강 조금)이 저녁 하늘의 기본. 분홍은 빨강+물 많이. "세 번만 톡톡"으로 제한하면 탁해지지 않습니다.' },
    { text:'하늘이 완전히 마를 때까지 기다려요.', sub:'그동안 진한 초록을 넉넉히 만들어 두어요.', art:{type:'scene', stage:1, still:true}, wait:180,
      tip:'덜 마르면 언덕이 번져 올라갑니다. 기다리는 동안 노랑+파랑으로 진한 초록 준비(색 섞기·평칠 차시).' },
    { text:'아래쪽에 진한 초록으로 언덕을 칠해요. (겹쳐 칠하기)', sub:'언덕 두 개를 겹치면 앞뒤가 생겨요. 앞 언덕이 더 진하게.', water:1, paint:3, art:{type:'scene', stage:2},
      tip:'겹쳐 칠하기 차시의 글레이징. 앞 언덕을 더 진하게 하면 원근이 생깁니다.' },
    { text:'마른 뒤, 가는 붓으로 나무·집을 진하게. 마지막에 네임펜으로 윤곽.', sub:'물 조금, 물감 많이. (물의 양)', water:1, paint:3, art:{type:'scene', stage:3}, wait:120,
      tip:'물의 양 차시의 진한 농도 + 색 섞기 차시의 갈색(세 색 혼합)으로 나무 줄기. 네임펜 윤곽은 크레파스 배수 차시. 배운 기법 이름을 학생이 스스로 말하게 하면 정리가 됩니다.' },
  ],
  check:{ q:'완성! 어떤 기법을 썼는지 확인해요.',
    items:['하늘: 번지기(젖은 종이 위)','언덕: 겹쳐 칠하기(마른 뒤)','나무·집: 진한 농도(물 조금)','윤곽: 네임펜 또는 가는 붓'],
    tip:'평가 기준은 "예쁜가"가 아니라 "기법을 알고 골라 썼는가"([4미02-02])입니다. 항목 두 개 이상이면 성취. 작품은 사진으로 남겨 1차시 사진과 나란히 보여주면 성장이 보입니다.' }
},
{
  id:8, part:3, title:'질감과 우연 효과', tech:'소금 · 닦아내기 · 뿌리기 · 흘리기 · 불기 · 데칼코마니', std:'[4미02-03] 조형 요소(질감) 탐색 · [4미02-02] 재료 탐색 · [4미02-01] 상상', goal:'소금·휴지·뿌리기로 질감을 만들고, 흘리기·불기·데칼코마니로 물감이 만든 우연을 즐겨요', bonus:false,
  materials:['소금','휴지','칫솔(선택)','흰 물감(뿌리기용)','빨대','종이 2장','신문지(바닥에 깔기)'],
  steps:[
    { text:'젖은 색 위에 소금을 톡톡 뿌려요.', sub:'마르면 눈꽃 무늬가 생겨요.', water:2, paint:2, art:{type:'salt'}, wait:180,
      tip:'물감이 "반짝이게 젖어 있을 때" 뿌려야 합니다. 마른 뒤 손으로 털어내요. 굵은 소금이 더 큰 무늬. 눈, 밤하늘, 바위 질감.' },
    { text:'젖은 하늘색 위를 뭉친 휴지로 꾹 눌러요. (닦아내기)', sub:'구름이 생겨요.', water:2, paint:2, art:{type:'lift'},
      tip:'"누르고 떼기", 문지르지 않기. 닦아내기(리프팅)는 실수한 곳을 옅게 만들 때도 쓰는 구조 기술입니다.' },
    { text:'붓에 진한 물감을 묻히고 손가락으로 튕겨요. (뿌리기)', sub:'별, 꽃가루, 불꽃놀이.', water:1, paint:3, art:{type:'splat'},
      tip:'신문지를 깔고. 칫솔은 더 고운 점. 흰 물감으로 튕기면 별(이때만 흰색 허용).' },
    { text:'물 많은 물감을 종이에 뚝 떨어뜨리고, 종이를 기울여요.', sub:'물감이 길을 만들며 흘러내려요.', water:3, paint:2, art:{type:'pour'},
      tip:'책상에 신문지를 꼭 깔고 시작하세요. 기울이기 전에 "어디로 흐를까?"를 예상하게 하면 관찰 놀이가 됩니다.' },
    { text:'물감 방울을 빨대로 불어요.', sub:'가지처럼 뻗어 나가요.', water:3, paint:2, art:{type:'pour', blow:true},
      tip:'세게 오래 불면 어지러울 수 있으니 "세 번 불고 쉬기"를 규칙으로. 나무, 불꽃, 머리카락처럼 보이는 효과가 납니다.' },
    { text:'새 종이 반쪽에만 물감을 몇 방울 놓고, 반으로 접었다 펴요. 마르면 제목을 붙여요.', sub:'데칼코마니! 양쪽이 똑같아요. 나비? 괴물? 우주?', water:2, paint:3, art:{type:'fold'},
      tip:'접기 전에 "펴면 뭐가 나올까?"를 예상하게 하세요. 대칭이라는 말을 자연스럽게 소개할 수 있습니다. 우연한 모양에서 상상을 끌어내는 것이 [4미02-01](관찰과 상상으로 주제 구체화)의 시작입니다. 제목 발표까지 하면 감상 활동도 됩니다.' },
  ],
  check:{ q:'어떤 효과가 가장 마음에 들었나요?',
    items:['소금 눈꽃','휴지 구름','물감 뿌리기','흘리기','불기로 만든 가지','데칼코마니'],
    tip:'정답 없는 탐색 차시. 발견한 효과를 발표하게 하고, 다음 작품에 하나를 골라 쓰게 하세요. 시간이 모자라면 앞 3개(질감)와 뒤 3개(우연)를 두 번에 나눠도 됩니다.' }
},
{
  id:9, part:4, title:'색상환과 보색', tech:'색상환 · 보색 대비', std:'[6미02-03] 조형 요소의 어울림 → 조형 원리(대비)', goal:'12색 색상환을 만들고, 마주 보는 색의 힘을 알아요',
  materials:['빨강·노랑·파랑 물감','굵은 붓','종이(큰 원을 12칸으로 나누기)','연필·자'],
  steps:[
    { text:'큰 원을 12칸으로 나누고, 삼원색을 4칸 간격으로 칠해요.', sub:'시계라고 생각해요: 12시 빨강, 4시 노랑, 8시 파랑.', water:2, paint:2, art:{type:'wheel', stage:0},
      tip:'원 나누기가 어려우면 종이 접시나 CD를 대고 그리게 하세요. 색 섞기 차시의 삼원색 복습으로 시작하면 자연스럽습니다.' },
    { text:'삼원색 사이 한가운데에 이차색을 칠해요.', sub:'2시 주황, 6시 초록, 10시 보라. 두 색을 반반씩.', water:2, paint:2, art:{type:'wheel', stage:1},
      tip:'색 섞기 차시에서 만들던 색들이 색상환의 제자리로 정리되는 순간입니다. 붓은 색을 바꿀 때마다 씻기.' },
    { text:'남은 6칸엔 이웃한 두 칸을 섞어 중간색을 칠해요.', sub:'다홍, 귤색, 연두, 청록, 남보라, 자주.', water:2, paint:2, art:{type:'wheel', stage:2},
      tip:'중간색 이름은 몰라도 됩니다. "이웃 두 칸을 섞으면 그 사이 색"이라는 규칙만 알면 12칸이 채워집니다. 시간이 부족하면 몇 칸만 해도 좋아요.' },
    { text:'다 마르면, 마주 보는 색끼리 짝을 지어요. 이 짝이 보색!', sub:'빨강↔초록, 노랑↔보라, 파랑↔주황.', art:{type:'wheel', stage:3}, wait:120,
      tip:'보색은 서로를 가장 돋보이게 하는 짝입니다. 교실에서 보색 짝을 찾아보게 하세요(초록 칠판과 빨간 글씨 등). 색의 어울림에서 "대비"라는 원리로 나아가는 것이 5~6학년군의 핵심입니다([6미02-03]).' },
    { text:'보색 두 가지로 작은 무늬를 칠해 봐요.', sub:'체크무늬, 줄무늬처럼 나란히 놓아요.', water:2, paint:2, art:{type:'wheel', stage:4},
      tip:'보색을 직접 섞으면 오히려 탁해진다는 것도 실험시켜 보세요(색 섞기 차시의 갈색과 연결). 나란히 두면 선명, 섞으면 탁함 — 둘 다 알면 색을 계획해서 쓰게 됩니다.' },
  ],
  check:{ q:'색상환이 무지개 순서로 이어지나요?',
    good:{art:{type:'wheel', stage:2}, text:'옆 칸끼리 자연스럽게 이어져요.'},
    bad:{art:{type:'wheel', stage:2, messy:true}, text:'순서가 뒤죽박죽이거나 탁해요. 이웃 색끼리만 섞기!'},
    tip:'탁해진 학생은 멀리 있는 색을 섞었거나 붓을 안 씻은 경우입니다. 완성한 색상환은 이후 모든 작품에서 "무슨 색을 고를까"의 지도가 되니 교실에 붙여 두면 좋습니다.' }
},
{
  id:10, part:4, title:'명암과 입체: 띠로 칠하기', tech:'5단계 명도 띠 · 원기둥 · 원뿔', std:'[6미02-03] 조형 요소(명암)의 어울림', goal:'한 색을 다섯 단계로 나눠 띠로 칠해, 원기둥과 원뿔이 둥글게 보이게 해요',
  materials:['한 가지 색 물감(파랑 추천)','가는 붓','중간 붓','종이','연필'],
  steps:[
    { text:'가는 붓으로 한 색의 5단계 띠를 만들어요.', sub:'왼쪽은 물 많이·물감 조금, 오른쪽으로 갈수록 물감 많이.', water:3, paint:1, art:{type:'strips'},
      tip:'물의 양 차시(3단계)를 5단계로 늘린 것입니다. 한 칸 칠할 때마다 걸레에 톡톡 한 번 + 물감 조금 더. 다섯 칸이 계단처럼 보이면 성공. 이 띠가 오늘 쓸 "물감 팔레트"가 되니 팔레트에도 같은 다섯 농도를 만들어 두게 하세요.' },
    { text:'연필로 원기둥을 그려요. 빛은 왼쪽 위에서 온다고 정해요.', sub:'위에 납작한 타원, 세로 두 줄, 아래는 곡선.', art:{type:'cylinder', stage:0},
      tip:'명암의 절반은 "빛의 방향 정하기"입니다. 화살표를 종이 구석에 그리게 하세요. 컵이나 물통에 스탠드 불빛을 비춰 밝은 쪽·어두운 쪽을 먼저 보게 하면 가장 좋습니다.' },
    { text:'세로 띠로 칠해요. 왼쪽부터 가장 연한 띠, 오른쪽으로 갈수록 진하게.', sub:'띠 하나 = 붓질 한 번. 위에서 아래로 한 번에, 문지르지 않기.', water:2, paint:2, art:{type:'cylinder', stage:1},
      tip:'이 방법의 좋은 점은 "섞어서 부드럽게"를 못 해도 둥글게 보인다는 것입니다. 띠 5개가 1단계 띠와 같은 순서면 됩니다. 옆 띠가 젖어 있으면 살짝 번져 더 자연스럽고, 말라 있으면 또렷한 줄무늬가 되는데 둘 다 정답입니다.' },
    { text:'원뿔도 같은 방법으로. 꼭짓점에서 아래로 부채꼴 띠.', sub:'왼쪽 연하게 → 오른쪽 진하게.', water:2, paint:2, art:{type:'cone', stage:1},
      tip:'원뿔은 띠가 위에서 한 점으로 모입니다. 붓을 꼭짓점에 대고 아래로 쓸어내리듯. 원기둥보다 어렵다고 느끼면 띠를 3개로 줄여도 됩니다.' },
    { text:'마르면 빛 반대쪽 바닥에 납작한 타원 그림자를 깔아요.', sub:'진한 색으로, 물체에 딱 붙여서.', water:1, paint:3, art:{type:'cylinder', stage:2}, wait:120,
      tip:'그림자는 빛 반대쪽(오른쪽 아래)에, 물체와 떨어지지 않게. 그림자가 붙는 순간 종이 위에 "놓여 있는" 느낌이 납니다. 공·사과·컵도 같은 원리라고 짚어 주면 다음 차시(나무 그리기, 관찰해서 그리기)로 바로 이어집니다.' },
  ],
  check:{ q:'원기둥이 둥글게 보이나요?',
    good:{art:{type:'cylinder', stage:2}, text:'띠가 점점 진해져서 둥글게 보여요.'},
    bad:{art:{type:'cylinder', stage:2, flat:true}, text:'띠가 다 같은 진하기라 납작해요.'},
    tip:'납작하게 나온 학생은 1단계 띠부터 다시 보게 하세요. 대부분 물감을 더하는 양이 너무 적어서 생깁니다. "오른쪽 끝 띠는 거의 물감만"이라고 말해 주세요.' }
},
{
  id:11, part:4, title:'나무 그리기', tech:'띠 명암 응용 · 잎 덩어리 3톤', std:'[4미02-02] 재료의 특성 이해 · [6미02-03] 조형 요소(명암)의 어울림', goal:'원뿔 나무는 세로 띠로, 둥근 나무는 잎 덩어리마다 세 가지 초록으로 칠해요',
  materials:['연두·초록·진초록(또는 초록+파랑·노랑)','갈색','중간 붓','가는 붓','종이','연필'],
  steps:[
    { text:'원뿔 나무: 연필로 긴 삼각형을 그리고, 빛은 왼쪽 위.', sub:'아래에 줄기 자리도 남겨요.', art:{type:'treecone', stage:0},
      tip:'앞 차시 원뿔과 같은 구조입니다. "나무 = 원뿔 + 원기둥"이라고 말해 주면 형태 잡기가 쉬워집니다. 삼각형은 종이의 위 3분의 2를 차지할 만큼 크게.' },
    { text:'세로 띠로 칠해요. 연두(왼쪽) → 초록 → 진초록(오른쪽).', sub:'띠 하나에 한 붓질, 꼭짓점에서 아래로.', water:2, paint:2, art:{type:'treecone', stage:1},
      tip:'색을 세 개만 써도 됩니다: 연두(초록+노랑), 초록, 진초록(초록+파랑 아주 조금). 팔레트에 세 색을 미리 만들어 두게 하세요. 띠 사이가 살짝 번지면 오히려 자연스럽습니다.' },
    { text:'줄기: 갈색 원기둥. 오른쪽을 진하게.', sub:'가는 붓으로 세로 띠 셋.', water:2, paint:2, art:{type:'treecone', stage:2},
      tip:'줄기도 원기둥 규칙 그대로(왼쪽 연하게, 오른쪽 진하게). 갈색은 세 색을 다 섞으면 됩니다(색 섞기 차시). 줄기가 마르면 바닥에 납작한 그림자도.' },
    { text:'둥근 나무: 연필로 구름 같은 잎 덩어리를 3~4개 겹쳐 그려요.', sub:'덩어리마다 크기를 다르게.', art:{type:'treeround', stage:0},
      tip:'나무 전체를 한 덩어리로 보지 말고 "구름 여러 개"로 보게 하는 것이 핵심입니다. 덩어리를 나누면 명암을 넣을 자리가 생깁니다. 겹치는 부분은 앞 덩어리가 가리도록.' },
    { text:'덩어리마다 세 가지 초록: 연두는 빛 쪽 위, 초록은 가운데, 진초록은 아래.', sub:'붓끝으로 잎 모양을 톡톡.', water:2, paint:2, art:{type:'treeround', stage:1}, wait:120,
      tip:'덩어리 하나마다 "위 밝음·가운데 중간·아래 어두움"을 반복하면 됩니다. 붓을 눕혀 문지르지 말고 붓끝으로 톡톡 찍으면 잎 느낌이 납니다. 덩어리의 아래쪽(다음 덩어리와 만나는 곳)이 가장 진합니다.' },
    { text:'마르면 줄기와 바닥 그림자를 그려요.', sub:'줄기는 덩어리 사이에서 나와요.', water:2, paint:3, art:{type:'treeround', stage:2},
      tip:'줄기는 잎 덩어리 뒤에서 나오므로 덩어리와 겹치는 부분은 칠하지 않습니다. 가지 몇 개를 덩어리 사이로 살짝 보이게 그리면 진짜 나무 같아집니다.' },
  ],
  check:{ q:'나무가 둥글게, 덩어리지게 보이나요?',
    good:{art:{type:'treeround', stage:2}, text:'덩어리마다 밝음·중간·어두움이 보여요.'},
    bad:{art:{type:'treeround', stage:2, flat:true}, text:'초록 한 가지로 평평해요.'},
    tip:'평평하게 나온 학생은 진초록을 안 쓴 경우가 대부분입니다. 덩어리 아래쪽에만 진초록을 한 번 더 찍게 하면 바로 살아납니다. 다음 그림(원근, 관찰)에서도 나무가 나오면 이 방법을 쓰게 하세요.' }
},
{
  id:12, part:4, title:'멀리와 가까이', tech:'공기 원근', std:'[6미02-03] 조형 원리(원근·공간)', goal:'멀수록 연하게, 가까울수록 진하게 칠해 깊이를 만들어요',
  materials:['파랑(또는 보라) 물감','굵은 붓·가는 붓','종이','연필'],
  steps:[
    { text:'산 능선을 세 줄, 연필로 살짝 그려요.', sub:'위쪽 줄이 제일 먼 산.', art:{type:'hills', stage:0},
      tip:'먼 산이 찍힌 사진을 한 장 보여주고 "먼 산은 왜 뿌옇게 보일까?"를 물어보세요. 공기 때문이라는 답을 관찰에서 끌어내는 것이 시작입니다.' },
    { text:'제일 먼 산부터: 물 많이, 아주 연하게.', sub:'하늘색에 가까울 만큼.', water:3, paint:1, art:{type:'hills', stage:1},
      tip:'물의 양 차시의 "연하게"가 공간을 만드는 도구가 됩니다. 연할수록 멀어 보여요.' },
    { text:'마르면 가운데 산을 중간 진하기로.', sub:'앞 산이 먼 산을 살짝 가려요.', water:2, paint:2, art:{type:'hills', stage:2}, wait:120,
      tip:'겹쳐 칠하기 차시처럼 완전히 마른 뒤에. 산이 겹치면서 앞뒤가 분명해집니다.' },
    { text:'마르면 제일 앞 산을 진하게. 나무 같은 세부는 앞 산에만!', sub:'멀리 있는 건 뭉개져 보여요.', water:1, paint:3, art:{type:'hills', stage:3}, wait:120,
      tip:'"세부는 가까운 것에만"이 원근의 두 번째 규칙입니다. 먼 산에 나무를 그리려는 아이에게는 "멀리 있는 나무가 하나하나 보일까?"라고 물어보세요.' },
  ],
  check:{ q:'그림에 깊이가 생겼나요?',
    good:{art:{type:'hills', stage:3}, text:'연함→진함 순서로 멀고 가까움이 보여요.'},
    bad:{art:{type:'hills', stage:3, flat:true}, text:'세 산이 다 같은 진하기라 평평해요.'},
    tip:'작품 차시(저녁 하늘과 언덕)의 "앞 언덕 더 진하게"가 바로 이 원리였음을 연결해 주세요. 진하기 차이가 클수록 깊이가 커집니다.' }
},
{
  id:13, part:4, title:'관찰해서 그리기', tech:'관찰 정물', std:'[6미01-01] 감각으로 대상 탐색 · [6미02-03]', goal:'진짜 과일을 관찰하고 배운 기법으로 그려요',
  materials:['진짜 과일(사과·귤 등) 하나','물감','굵은 붓·가는 붓','종이','연필'],
  steps:[
    { text:'그리기 전에 1분 동안 보기만 해요. 색이 몇 가지 보이나요?', sub:'만져 보고, 돌려 보고, 냄새도 맡아 보고.', art:{type:'observe', stage:0},
      tip:'"사과=빨강"이라는 기억 대신 실물을 보게 하는 것이 관찰 표현의 시작입니다([6미01-01]). 빨강 속 노랑·연두·갈색 반점까지 세 가지 이상 찾게 하세요.' },
    { text:'연필로 크게, 연하게 모양을 잡아요.', sub:'종이의 반을 차지할 만큼 크게.', art:{type:'observe', stage:1},
      tip:'작게 그리면 붓이 들어갈 자리가 없습니다. 지우개는 되도록 쓰지 않게 — 연필선은 물감 아래로 비쳐도 괜찮습니다.' },
    { text:'제일 밝은 색부터 전체를 연하게. 반짝이는 곳은 남겨요.', sub:'명암과 입체 차시처럼!', water:3, paint:1, art:{type:'observe', stage:2},
      tip:'밝은 색→어두운 색 순서는 수채화의 기본 순서입니다. 첫 층은 "이 과일에서 제일 밝은 색"으로 시작하게 하세요.' },
    { text:'마르면 어두운 쪽을 겹쳐 칠하고, 관찰한 다른 색도 살짝 얹어요.', sub:'연두 한 조각, 갈색 반점….', water:2, paint:2, art:{type:'observe', stage:3}, wait:180,
      tip:'아까 찾아낸 색을 다 쓰게 하세요. 관찰한 색이 들어가는 순간 그림이 갑자기 진짜 같아집니다.' },
    { text:'가는 붓으로 꼭지 같은 세부를 그리고, 아래에 그림자.', sub:'물 조금, 물감 많이.', water:1, paint:3, art:{type:'observe', stage:4},
      tip:'평가 관점은 "실물과 똑같은가"가 아니라 "관찰한 것을 표현에 반영했는가"입니다. 실물과 그림을 나란히 놓고 사진을 남기면 좋은 기록이 됩니다.' },
  ],
  check:{ q:'관찰한 것이 그림에 들어갔나요?',
    items:['실물에서 색을 세 가지 이상 찾았어요','반짝이는 곳을 종이색으로 남겼어요','어두운 쪽을 겹쳐 칠했어요','실물과 내 그림을 비교해 봤어요'] }
},
{
  id:14, part:5, title:'마음을 색으로', tech:'따뜻한 색 · 차가운 색', std:'[6미01-02] 느낌·생각을 관련지어 표현 · [6미02-01]', goal:'기분과 느낌을 색과 번지기로 표현해요',
  materials:['물감','굵은 붓','종이 2장'],
  steps:[
    { text:'색상환을 반으로 나눠요. 따뜻한 쪽과 차가운 쪽.', sub:'빨강·주황·노랑 ↔ 파랑·초록·보라.', art:{type:'warmcool', stage:0},
      tip:'색상환과 보색 차시의 색상환을 다시 꺼내세요. "여름 바다는 어느 쪽? 모닥불은?"처럼 경험과 연결해 분류하게 하면 쉽습니다.' },
    { text:'지금 내 기분은 무슨 색인가요? 그 색으로 크게 번지기!', sub:'젖은 종이에 톡톡. 이유는 아직 비밀.', water:3, paint:2, art:{type:'warmcool', stage:1},
      tip:'번지기 차시의 기법을 감정 표현에 쓰는 단계입니다. 정답이 없다는 것을 꼭 말해 주세요 — 같은 기쁨도 노랑인 아이가 있고 하늘색인 아이가 있습니다.' },
    { text:'기분이 두 가지라면? 두 색을 옆에서 번지게 해 만나게 해요.', sub:'설렘+긴장, 신남+피곤….', water:3, paint:2, art:{type:'warmcool', stage:2},
      tip:'두 색이 만나는 자리가 "섞인 마음"이 됩니다. 붓으로 억지로 섞지 말고 저절로 만나게 두는 것이 포인트.' },
    { text:'마르면 제목을 붙여요. "월요일 아침", "이기기 직전"….', sub:'제목까지가 작품!', art:{type:'warmcool', stage:2, still:true}, wait:120,
      tip:'짝과 그림을 바꿔 보고 "무슨 기분 같아?"를 먼저 맞히게 한 뒤 제목을 공개하면 훌륭한 감상 활동이 됩니다([6미03-04] 서로 다른 관점 존중).' },
  ],
  check:{ q:'마음이 색이 되었나요?',
    items:['따뜻한 색과 차가운 색을 나눠 봤어요','내 기분을 색으로 골랐어요','작품에 제목을 붙였어요','짝의 그림에서 기분을 찾아 봤어요'] }
},
{
  id:15, part:5, title:'나만의 작품', tech:'계획 · 제작 · 감상', std:'[6미02-01] 주제 확장 · [6미02-04] 과정 돌아보기 · [6미03-04] 감상', goal:'주제와 기법을 스스로 골라 작품을 완성하고 서로 감상해요',
  materials:['물감','굵은 붓·가는 붓','새 종이','연필','지금까지의 내 기록(사진)'],
  steps:[
    { text:'보여주고 싶은 것을 한 문장으로 정해요.', sub:'"비 오는 운동장", "우리 강아지가 자는 모습"….', art:{type:'planart', stage:0},
      tip:'주제가 안 떠오르면 내 기록 갤러리를 열어 지금까지의 그림을 넘겨 보게 하세요. "더 해 보고 싶었던 것"이 가장 좋은 주제가 됩니다([6미02-01]).' },
    { text:'배운 기법 중 3가지를 골라 어디에 쓸지 계획해요.', sub:'번지기는 하늘에, 겹쳐 칠하기는 그림자에….', art:{type:'planart', stage:1},
      tip:'기법 목록을 칠판에 적어 주세요: 번지기·평칠·그러데이션·겹쳐 칠하기·크레파스 배수·소금·뿌리기·보색·명암·원근. 계획은 종이 귀퉁이에 연필로 메모하게 합니다.' },
    { text:'넓은 곳, 밝은 색부터 시작해요.', sub:'하늘·배경 먼저, 세부는 나중에.', water:2, paint:2, art:{type:'planart', stage:2},
      tip:'순서만 지켜도 실패가 크게 줄어듭니다: 넓다→좁다, 밝다→어둡다, 젖었을 때→마른 뒤.' },
    { text:'마를 때마다 한 걸음 물러나서 봐요. 다음에 뭘 더할까?', sub:'고칠 곳보다 더하고 싶은 곳을 찾아요!', water:2, paint:2, art:{type:'planart', stage:3}, wait:180,
      tip:'중간에 멈춰 작품을 돌아보는 것이 [6미02-04]의 핵심입니다. "망쳤다"는 아이에게는 위에 더할 수 있는 기법(소금·뿌리기·닦아내기·글레이징)을 권해 주세요.' },
    { text:'완성! 제목과 이름을 쓰고 사진을 남겨요.', sub:'구석에 작게, 연필이나 가는 붓으로.', art:{type:'planart', stage:4},
      tip:'작품 사진과 함께 "쓴 기법 3가지"를 한 줄 이유 칸에 적게 하면 그대로 평가 기록이 됩니다.' },
    { text:'작품 감상회: 친구 작품에서 좋은 점을 한 가지씩 찾아 말해요.', sub:'"하늘 번지기가 진짜 노을 같아."', art:{type:'planart', stage:5},
      tip:'"어떤 기법을 쓴 것 같아?"를 함께 묻게 하면 감상이 구체적이 됩니다. 서로 다른 표현을 존중하는 것까지가 목표입니다([6미03-04]).' },
  ],
  check:{ q:'나만의 작품이 완성됐나요?',
    items:['주제를 한 문장으로 정했어요','계획한 기법을 2가지 이상 썼어요','제목과 이름을 썼어요','친구 작품의 좋은 점을 말했어요'],
    tip:'이 차시는 학기마다 반복해도 좋습니다. 반복할 때마다 내 기록 갤러리가 성장 앨범이 됩니다.' }
}
];

const PARTS = [
  {id:1, color:'#e8a33d', title:'시작하기', sub:'준비하고, 붓과 물감을 가지고 놀며 시작해요', grade:'3학년 무렵부터 · 3~4학년군 [4미01-01]·[4미02-02]'},
  {id:2, color:'#3f74c9', title:'기본기 익히기', sub:'수채화의 핵심 기법을 하나씩', grade:'3~4학년 · [4미02-02]·[4미02-03] 중심'},
  {id:3, color:'#df6a3c', title:'첫 작품', sub:'배운 기법을 골라 써서 그림 완성', grade:'4학년 무렵 · [4미02-01]·[4미02-04]'},
  {id:4, color:'#3f9d63', title:'한 걸음 더', sub:'색·명암·원근으로 깊어져요', grade:'5학년 무렵부터 · 5~6학년군 [6미02-03]'},
  {id:5, color:'#8a5bb5', title:'나만의 그림', sub:'주제도 기법도 스스로 골라요', grade:'6학년 무렵 · [6미02-01]·[6미02-04]·[6미03-04]'},
];

window.COURSE_DATA = {
  key:'watercolor', ns:'wc', title:'수채화 따라하기', short:'수채화', subtitle:'물감과 친해지기부터 나만의 그림까지',
  promise:['실수해도 괜찮아요, 실험이니까','붓은 살살, 문지르지 않기','마를 때까지 기다리기'],
  intro:'태블릿을 보면서 한 단계씩 종이에 해 봐요. 기법 이름을 기억해 두면 다음 그림에서 골라 쓸 수 있어요.',
  meters:[ {key:'water', icon:'💧', labels:['물 없이','물 조금','물 보통','물 많이']}, {key:'paint', icon:'🎨', labels:['물감 없이','물감 조금','물감 보통','물감 많이']} ],
  videoDir:'videos',
  prints:[ {label:'학습지 18장 (A4 가로, 도화지에 인쇄)', href:'worksheets.html'}, {label:'파일럿 수업기록지 2장', href:'pilot-log.html'} ],
  videoNote:'영상이 있는 단계: 1차시 2·4단계, 2차시 2단계, 4차시 3·5단계, 14차시 2단계 (그림 오른쪽 아래 "실제 영상 보기")',
  parts:PARTS, lessons:LESSONS, art:ART,
};
})();
