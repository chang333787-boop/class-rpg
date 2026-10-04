// student/char.js — 캐릭터 그림(SVG 빌더 · 종이인형 84장)
//  student.js 에서 떼어 옮긴 클래식 스크립트 [SPLIT-1] — 글자 그대로 · 전역 그대로 · student.html 에서 student.js 바로 뒤에 부른다.
// ── [SPLIT-1] 'char' — 원래 student.js 688~1204줄 ──
// ══ SVG 캐릭터 빌더 ══
const EQUIP_COLORS = {
  none:    { body:'#3a3a4a', outline:'#555',  shine:'#555'  },
  e_b1:    { body:'#c8c8d8', outline:'#999',  shine:'#eee'  }, // 천
  e_b2:    { body:'#7B4F2E', outline:'#5a3820',shine:'#a06838'}, // 가죽
  e_b3:    { body:'#7B3FA0', outline:'#5a2e78',shine:'#a060c8'}, // 견습 로브
  e_b4:    { body:'#4a7abf', outline:'#2e5a9a',shine:'#6a9adf'}, // 철 갑옷
  e_b5:    { body:'#2a6090', outline:'#1a4070',shine:'#4a90c0'}, // 연구 로브
  e_b6:    { body:'#2C3E6E', outline:'#1a2850',shine:'#4a6090'}, // 기사 갑옷
  e_b7:    { body:'#4a2070', outline:'#2e1050',shine:'#7a40a0'}, // 대마법 로브
  e_b8:    { body:'#C8970A', outline:'#a07808',shine:'#f0c020'}, // 황금 갑옷
  e_b9:    { body:'#8B1A1A', outline:'#600000',shine:'#c04040'}, // 전설 갑옷
  e_b10:   { body:'#8B6914', outline:'#604800',shine:'#d4a820'}, // 왕의 갑옷
};
const HEAD_COLORS = {
  none:    null,
  e_h1:    { fill:'#c8c8d8', outline:'#999'  },
  e_h2:    { fill:'#7B4F2E', outline:'#5a3820'},
  e_h3:    { fill:'#7B3FA0', outline:'#5a2e78'},
  e_h4:    { fill:'#4a7abf', outline:'#2e5a9a'},
  e_h5:    { fill:'#2a6090', outline:'#1a4070'},
  e_h6:    { fill:'#2C3E6E', outline:'#1a2850'},
  e_h7:    { fill:'#4a2070', outline:'#2e1050'},
  e_h8:    { fill:'#C8970A', outline:'#a07808'},
  e_h9:    { fill:'#8B1A1A', outline:'#600000'},
  e_h10:   { fill:'#C8970A', outline:'#7a5000'},
};
const WEAPON_SHAPES = {
  none:   null,
  e_w1:   'sword',   e_w2:  'sword',  e_w3:  'staff',
  e_w4:   'sword',   e_w5:  'staff',  e_w6:  'sword',
  e_w7:   'staff',   e_w8:  'sword',  e_w9:  'sword',  e_w10: 'sword',
};
const WEAPON_COLORS = {
  none:   '#555',
  e_w1:   '#8B6914', e_w2:  '#aaa',   e_w3:  '#9B59B6',
  e_w4:   '#6a9adf', e_w5:  '#2a6090',e_w6:  '#2C3E6E',
  e_w7:   '#9B59B6', e_w8:  '#C8970A',e_w9:  '#8B1A1A', e_w10: '#e040fb',
};
const SHOE_COLORS = {
  none:   '#3a3a4a',
  e_s1:   '#c8c8d8', e_s2:  '#7B4F2E',e_s3:  '#7B3FA0',
  e_s4:   '#4a7abf', e_s5:  '#2a6090',e_s6:  '#2C3E6E',
  e_s7:   '#4a2070', e_s8:  '#C8970A',e_s9:  '#8B1A1A', e_s10: '#e040fb',
};
const GLOVE_COLORS = {
  none:   '#c8a87a',
  e_g1:   '#d8d8e8', e_g2:  '#8B5E3C',e_g3:  '#9B59B6',
  e_g4:   '#5a8abf', e_g5:  '#2a6090',e_g6:  '#3C4E7E',
  e_g7:   '#6a40a0', e_g8:  '#D4A820',e_g9:  '#A01A1A', e_g10: '#e040fb',
};

function buildCharSVG(s) {
  const eqIds  = s.equipmentIds || {};
  const bodyId   = eqIds.body   || 'none';
  const headId   = eqIds.head   || 'none';
  const weaponId = eqIds.weapon || 'none';
  const gloveId  = eqIds.glove  || 'none';
  const shoeId   = eqIds.shoe   || 'none';

  const isFemale = (s.charType === 2 || s.charType === 4);

  // ── 피부/머리카락 ──
  const skin = s.charType===2?'#FDDCB5':s.charType===3?'#C68642':s.charType===4?'#8D5524':'#FFCC80';
  const skinD = s.charType===2?'#E8B98A':s.charType===3?'#A0522D':s.charType===4?'#6B3A2A':'#E8A87C';
  const hairColors = {1:'#3E1F00',2:'#6A1B9A',3:'#0D2B6B',4:'#1B5E20'};
  const hair  = hairColors[s.charType]||'#3E1F00';
  const hairH = s.charType===2?'#9C27B0':s.charType===3?'#1565C0':s.charType===4?'#2E7D32':'#5D4037';

  // ── 장비 색상 팔레트 ──
  const BODY_PAL = {
    none:   {a:'#5C7AEA',b:'#3A5BCC',c:'#8FA8FF',belt:'#8B6914'},
    e_b1:   {a:'#BDBDBD',b:'#9E9E9E',c:'#E0E0E0',belt:'#795548'},
    e_b2:   {a:'#8D6E63',b:'#6D4C41',c:'#A1887F',belt:'#795548'},
    e_b3:   {a:'#9C27B0',b:'#7B1FA2',c:'#CE93D8',belt:'#4A148C'},
    e_b4:   {a:'#78909C',b:'#546E7A',c:'#B0BEC5',belt:'#37474F'},
    e_b5:   {a:'#7E57C2',b:'#5E35B1',c:'#B39DDB',belt:'#4527A0'},
    e_b6:   {a:'#455A64',b:'#263238',c:'#78909C',belt:'#BF360C'},
    e_b7:   {a:'#4A148C',b:'#311B92',c:'#9C27B0',belt:'#F57F17'},
    e_b8:   {a:'#F9A825',b:'#F57F17',c:'#FFF176',belt:'#E65100'},
    e_b9:   {a:'#37474F',b:'#1C313A',c:'#546E7A',belt:'#FFD700'},
    e_b10:  {a:'#880E4F',b:'#560027',c:'#C2185B',belt:'#FFD700'},
    // [CHAR-PAL-1] 물(e_b11~20)·풀(e_b21~30) 몸통 30종이 팔레트에 없어
    //   BODY_PAL.none(기본 파란 옷)으로 그려지고 있었다. 등급이 오를수록 진해진다.
    e_b11:  {a:'#B3E5FC',b:'#4FC3F7',c:'#E1F5FE',belt:'#0277BD'},
    e_b12:  {a:'#81D4FA',b:'#29B6F6',c:'#E1F5FE',belt:'#01579B'},
    e_b13:  {a:'#4FC3F7',b:'#039BE5',c:'#B3E5FC',belt:'#01579B'},
    e_b14:  {a:'#29B6F6',b:'#0288D1',c:'#81D4FA',belt:'#014A7F'},
    e_b15:  {a:'#039BE5',b:'#0277BD',c:'#4FC3F7',belt:'#013A63'},
    e_b16:  {a:'#0288D1',b:'#01579B',c:'#29B6F6',belt:'#FFD54F'},
    e_b17:  {a:'#0277BD',b:'#014A7F',c:'#039BE5',belt:'#FFD54F'},
    e_b18:  {a:'#01579B',b:'#013A63',c:'#0288D1',belt:'#FFC107'},
    e_b19:  {a:'#014A7F',b:'#002F4B',c:'#0277BD',belt:'#FFD700'},
    e_b20:  {a:'#003D66',b:'#00243D',c:'#0288D1',belt:'#FFD700'},
    e_b21:  {a:'#C8E6C9',b:'#81C784',c:'#E8F5E9',belt:'#33691E'},
    e_b22:  {a:'#A5D6A7',b:'#66BB6A',c:'#E8F5E9',belt:'#2E7D32'},
    e_b23:  {a:'#81C784',b:'#4CAF50',c:'#C8E6C9',belt:'#2E7D32'},
    e_b24:  {a:'#66BB6A',b:'#43A047',c:'#A5D6A7',belt:'#1B5E20'},
    e_b25:  {a:'#4CAF50',b:'#388E3C',c:'#81C784',belt:'#1B5E20'},
    e_b26:  {a:'#43A047',b:'#2E7D32',c:'#66BB6A',belt:'#FFD54F'},
    e_b27:  {a:'#388E3C',b:'#1B5E20',c:'#4CAF50',belt:'#FFD54F'},
    e_b28:  {a:'#2E7D32',b:'#155A1A',c:'#43A047',belt:'#FFC107'},
    e_b29:  {a:'#1B5E20',b:'#0D3D12',c:'#388E3C',belt:'#FFD700'},
    e_b30:  {a:'#14501A',b:'#08300D',c:'#2E7D32',belt:'#FFD700'},
  };
  const SHOE_PAL = {
    none:'#4E342E', e_s1:'#5D4037', e_s2:'#795548', e_s3:'#7B1FA2',
    e_s4:'#37474F', e_s5:'#5E35B1', e_s6:'#1A237E', e_s7:'#4A148C',
    e_s8:'#E65100', e_s9:'#1C313A', e_s10:'#880E4F',
  };
  const GLOVE_PAL = {
    none:skin, e_g1:'#795548', e_g2:'#6D4C41', e_g3:'#9C27B0',
    e_g4:'#546E7A', e_g5:'#7E57C2', e_g6:'#455A64', e_g7:'#4A148C',
    e_g8:'#F9A825', e_g9:'#37474F', e_g10:'#880E4F',
  };
  const HEAD_PAL = {
    e_h1:{a:'#BDBDBD',b:'#9E9E9E',type:'cloth'},
    e_h2:{a:'#8D6E63',b:'#6D4C41',type:'leather'},
    e_h3:{a:'#9C27B0',b:'#7B1FA2',type:'magic'},
    e_h4:{a:'#78909C',b:'#546E7A',type:'helm'},
    e_h5:{a:'#7E57C2',b:'#5E35B1',type:'magic'},
    e_h6:{a:'#455A64',b:'#263238',type:'helm'},
    e_h7:{a:'#4A148C',b:'#311B92',type:'magic'},
    e_h8:{a:'#F9A825',b:'#F57F17',type:'helm'},
    e_h9:{a:'#37474F',b:'#1C313A',type:'helm'},
    e_h10:{a:'#FFD700',b:'#FF8F00',type:'crown'},
  };
  const WEAPON_PAL = {
    e_w1:{a:'#A1887F',b:'#6D4C41',type:'sword'},
    e_w2:{a:'#90A4AE',b:'#546E7A',type:'sword'},
    e_w3:{a:'#CE93D8',b:'#9C27B0',type:'staff'},
    e_w4:{a:'#B0BEC5',b:'#78909C',type:'sword'},
    e_w5:{a:'#B39DDB',b:'#7E57C2',type:'staff'},
    e_w6:{a:'#90CAF9',b:'#1976D2',type:'sword'},
    e_w7:{a:'#E1BEE7',b:'#7B1FA2',type:'staff'},
    e_w8:{a:'#FFE082',b:'#F9A825',type:'sword'},
    e_w9:{a:'#B0BEC5',b:'#37474F',type:'sword'},
    e_w10:{a:'#F48FB1',b:'#880E4F',type:'sword'},
    // [CHAR-PAL-1] 스태프 10종이 팔레트에 없어 무기가 아예 안 그려지고 있었다.
    e_ws1:{a:'#C5A880',b:'#8D6E63',type:'staff'},
    e_ws2:{a:'#B0BEC5',b:'#607D8B',type:'staff'},
    e_ws3:{a:'#CE93D8',b:'#8E24AA',type:'staff'},
    e_ws4:{a:'#90CAF9',b:'#1E88E5',type:'staff'},
    e_ws5:{a:'#A5D6A7',b:'#43A047',type:'staff'},
    e_ws6:{a:'#FFCC80',b:'#FB8C00',type:'staff'},
    e_ws7:{a:'#F48FB1',b:'#D81B60',type:'staff'},
    e_ws8:{a:'#B39DDB',b:'#5E35B1',type:'staff'},
    e_ws9:{a:'#80DEEA',b:'#00ACC1',type:'staff'},
    e_ws10:{a:'#FFE082',b:'#FFA000',type:'staff'},
  };

  const bp   = BODY_PAL[bodyId]  || BODY_PAL.none;
  const shoe = SHOE_PAL[shoeId]  || SHOE_PAL.none;
  const glv  = GLOVE_PAL[gloveId]|| GLOVE_PAL.none;
  const hp   = HEAD_PAL[headId];
  const wp   = WEAPON_PAL[weaponId];

  // ── 무기: 손잡이=오른손(cx=101,cy=100) 위에서 그려짐 ──
  // 실제 렌더는 오른팔/장갑 다음에 위치
  let weaponSvg = '';

  // ── 투구/머리 장식 SVG ──
  let helmSvg = '';
  if (hp) {
    if (hp.type === 'crown') {
      // 왕관: 머리 위로 올리고 크게
      helmSvg = `
        <rect x="40" y="18" width="40" height="10" rx="2" fill="${hp.a}"/>
        <polygon points="40,18 45,5 50,18" fill="${hp.a}"/>
        <polygon points="55,18 60,8 65,18" fill="${hp.a}"/>
        <polygon points="70,18 75,5 80,18" fill="${hp.a}"/>
        <rect x="42" y="20" width="36" height="6" fill="${hp.b}" opacity=".6"/>
        <circle cx="60" cy="9" r="2.5" fill="#FFD700" opacity=".9"/>
        <circle cx="47" cy="6" r="2" fill="#FFD700" opacity=".8"/>
        <circle cx="73" cy="6" r="2" fill="#FFD700" opacity=".8"/>`;
    } else if (hp.type === 'magic') {
      // 마법 모자: 크고 위로 (이미 수정됨)
      helmSvg = `
        <polygon points="60,-4 44,24 76,24" fill="${hp.a}"/>
        <polygon points="60,-4 57,24 63,24" fill="${hp.b}"/>
        <rect x="40" y="21" width="40" height="8" rx="4" fill="${hp.a}"/>
        <rect x="40" y="21" width="40" height="3" fill="${hp.b}" opacity=".5"/>
        <circle cx="60" cy="-4" r="3" fill="${hp.b}" opacity=".7"/>`;
    } else if (hp.type === 'helm' || hp.type === 'leather') {
      // 투구/가죽: 머리 전체 덮게
      helmSvg = `
        <rect x="38" y="14" width="44" height="24" rx="9" fill="${hp.a}"/>
        <rect x="38" y="14" width="44" height="10" rx="9" fill="${hp.b}"/>
        <rect x="38" y="32" width="12" height="8" rx="3" fill="${hp.b}"/>
        <rect x="70" y="32" width="12" height="8" rx="3" fill="${hp.b}"/>
        <rect x="40" y="16" width="7" height="3" rx="1" fill="rgba(255,255,255,.3)"/>`;
    } else {
      // cloth: 부드러운 천 모자
      helmSvg = `
        <path d="M40,28 Q38,10 60,8 Q82,10 80,28" fill="${hp.a}"/>
        <path d="M40,28 Q38,10 60,8 Q82,10 80,28 Q72,18 60,18 Q48,18 40,28Z" fill="${hp.b}" opacity=".5"/>
        <ellipse cx="60" cy="28" rx="22" ry="4" fill="${hp.a}"/>`;
    }
  }

  // ── 에픽 글로우 ──
  const isEpic = ['e_b8','e_b9','e_b10'].includes(bodyId);
  const glowEl = isEpic ? `<ellipse cx="60" cy="148" rx="28" ry="6" fill="${bp.a}" opacity=".3"/>` : '';

  // ── 캐릭터 픽셀아트 ──
  return `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;image-rendering:pixelated">

  ${glowEl}
  <!-- 그림자 -->
  <ellipse cx="60" cy="152" rx="22" ry="4" fill="rgba(0,0,0,.25)"/>

  <!-- 무기는 오른손 다음에 그림 -->

  <!-- ═══ 신발 ═══ -->
  <rect x="42" y="130" width="15" height="12" rx="3" fill="${shoe}"/>
  <rect x="63" y="130" width="15" height="12" rx="3" fill="${shoe}"/>
  <rect x="40" y="135" width="19" height="7" rx="3" fill="${shoe}"/>
  <rect x="61" y="135" width="19" height="7" rx="3" fill="${shoe}"/>
  <rect x="42" y="130" width="15" height="3" fill="rgba(255,255,255,.15)" rx="1"/>
  <rect x="63" y="130" width="15" height="3" fill="rgba(255,255,255,.15)" rx="1"/>

  <!-- ═══ 다리 ═══ -->
  <rect x="44" y="104" width="13" height="28" rx="4" fill="${bp.b}"/>
  <rect x="63" y="104" width="13" height="28" rx="4" fill="${bp.b}"/>
  <rect x="44" y="104" width="13" height="3" fill="${bp.a}" opacity=".5"/>
  <rect x="63" y="104" width="13" height="3" fill="${bp.a}" opacity=".5"/>

  <!-- ═══ 몸통 ═══ -->
  <rect x="36" y="64" width="48" height="44" rx="7" fill="${bp.a}"/>
  <rect x="36" y="64" width="48" height="8" rx="7" fill="${bp.c}" opacity=".4"/>
  <rect x="38" y="68" width="5" height="16" rx="2" fill="${bp.c}" opacity=".3"/>
  <!-- 중앙선 -->
  <rect x="58" y="68" width="4" height="36" rx="2" fill="${bp.b}" opacity=".35"/>
  <!-- 버클 -->
  <rect x="36" y="104" width="48" height="4" rx="2" fill="${bp.belt||'#795548'}"/>
  <rect x="56" y="103" width="8" height="6" rx="2" fill="${bp.belt||'#795548'}"/>
  <rect x="58" y="104" width="4" height="4" rx="1" fill="#FFD700" opacity=".7"/>

  <!-- ═══ 왼팔 ═══ -->
  <rect x="18" y="65" width="20" height="11" rx="6" fill="${bp.a}"/>
  <rect x="14" y="74" width="10" height="24" rx="5" fill="${bp.a}"/>
  <rect x="14" y="74" width="10" height="4" fill="${bp.c}" opacity=".3" rx="2"/>
  <!-- 왼장갑 -->
  <ellipse cx="19" cy="100" rx="8" ry="7" fill="${glv}"/>
  <ellipse cx="19" cy="97" rx="6" ry="3" fill="rgba(255,255,255,.15)"/>

  <!-- ═══ 오른팔 ═══ -->
  <rect x="82" y="65" width="20" height="11" rx="6" fill="${bp.a}"/>
  <rect x="96" y="74" width="10" height="24" rx="5" fill="${bp.a}"/>
  <rect x="96" y="74" width="10" height="4" fill="${bp.c}" opacity=".3" rx="2"/>
  <!-- 오른장갑 -->
  <ellipse cx="101" cy="100" rx="8" ry="7" fill="${glv}"/>
  <ellipse cx="101" cy="97" rx="6" ry="3" fill="rgba(255,255,255,.15)"/>

  <!-- ═══ 무기 (오른손이 쥔 위치에서 그림) ═══ -->
  ${wp ? (wp.type === 'sword' ? `
    <g transform="rotate(-15, 101, 100)">
      <!-- 손잡이: 손 중앙(101,100)에서 위로 -->
      <rect x="98" y="88" width="6" height="16" rx="2" fill="${wp.b}"/>
      <rect x="99" y="88" width="2" height="16" fill="rgba(255,255,255,.25)"/>
      <!-- 날밑(가드) -->
      <rect x="92" y="84" width="18" height="5" rx="2" fill="${wp.b}"/>
      <rect x="99" y="85" width="4" height="3" fill="#FFD700" opacity=".8"/>
      <!-- 칼날: 손잡이 위에서 쭉 올라감 -->
      <rect x="99" y="40" width="4" height="46" rx="1" fill="${wp.a}"/>
      <rect x="99" y="40" width="2" height="46" fill="rgba(255,255,255,.35)"/>
      <!-- 칼끝 -->
      <polygon points="99,40 103,40 101,28" fill="${wp.a}"/>
      <polygon points="100,40 102,40 101,32" fill="rgba(255,255,255,.4)"/>
    </g>
  ` : `
    <g transform="rotate(5, 101, 100)">
      <!-- 지팡이 몸체: 손 위치에서 아래로 조금, 위로 길게 -->
      <rect x="99" y="42" width="4" height="70" rx="2" fill="${wp.b}"/>
      <rect x="100" y="42" width="2" height="70" fill="rgba(255,255,255,.2)"/>
      <!-- 손잡이 부분 강조 -->
      <rect x="98" y="88" width="6" height="14" rx="3" fill="${wp.b}" opacity=".8"/>
      <rect x="98" y="88" width="6" height="4" rx="2" fill="rgba(255,255,255,.15)"/>
      <!-- 오브 -->
      <circle cx="101" cy="36" r="11" fill="${wp.b}"/>
      <circle cx="101" cy="36" r="8" fill="${wp.a}"/>
      <circle cx="101" cy="36" r="4" fill="white" opacity=".45"/>
      <circle cx="98" cy="33" r="2" fill="white" opacity=".3"/>
    </g>
  `) : ''}

  <!-- ═══ 목 ═══ -->
  <rect x="54" y="56" width="12" height="10" rx="3" fill="${skin}"/>

  <!-- ═══ 얼굴 (둥근 픽셀 스타일) ═══ -->
  <rect x="38" y="28" width="44" height="32" rx="10" fill="${skin}"/>
  <rect x="36" y="34" width="4" height="16" rx="3" fill="${skin}"/>
  <rect x="80" y="34" width="4" height="16" rx="3" fill="${skin}"/>
  <rect x="38" y="26" width="44" height="8" rx="8" fill="${skin}"/>
  <!-- 얼굴 하이라이트 -->
  <rect x="40" y="30" width="10" height="8" rx="4" fill="rgba(255,255,255,.12)"/>
  <!-- 볼 홍조 -->
  <ellipse cx="46" cy="46" rx="5" ry="3" fill="#FF8A80" opacity=".35"/>
  <ellipse cx="74" cy="46" rx="5" ry="3" fill="#FF8A80" opacity=".35"/>

  <!-- ═══ 눈 ═══ -->
  <!-- 흰자 -->
  <rect x="47" y="35" width="10" height="8" rx="3" fill="white"/>
  <rect x="63" y="35" width="10" height="8" rx="3" fill="white"/>
  <!-- 눈동자 -->
  <rect x="50" y="36" width="5" height="6" rx="2" fill="${s.charType===2?'#7B1FA2':s.charType===3?'#1565C0':s.charType===4?'#2E7D32':'#3E2723'}"/>
  <rect x="66" y="36" width="5" height="6" rx="2" fill="${s.charType===2?'#7B1FA2':s.charType===3?'#1565C0':s.charType===4?'#2E7D32':'#3E2723'}"/>
  <!-- 눈빛 -->
  <rect x="51" y="37" width="2" height="2" rx="1" fill="white" opacity=".8"/>
  <rect x="67" y="37" width="2" height="2" rx="1" fill="white" opacity=".8"/>

  <!-- ═══ 코 ═══ -->
  <rect x="58" y="44" width="4" height="3" rx="1" fill="${skinD}"/>

  <!-- ═══ 입 ═══ -->
  ${isFemale
    ? `<rect x="54" y="50" width="12" height="3" rx="2" fill="#EF9A9A"/>
       <rect x="56" y="50" width="8" height="2" rx="1" fill="#E57373"/>`
    : `<rect x="54" y="50" width="12" height="3" rx="2" fill="${skinD}"/>
       <rect x="56" y="51" width="8" height="1" rx="1" fill="rgba(0,0,0,.1)"/>`}

  <!-- ═══ 머리카락 ═══ -->
  ${isFemale ? `
    <rect x="38" y="16" width="44" height="16" rx="8" fill="${hair}"/>
    <rect x="34" y="24" width="8" height="28" rx="4" fill="${hair}"/>
    <rect x="78" y="24" width="8" height="28" rx="4" fill="${hair}"/>
    <rect x="38" y="14" width="44" height="8" rx="6" fill="${hairH}" opacity=".5"/>
    <rect x="42" y="16" width="12" height="4" rx="2" fill="rgba(255,255,255,.15)"/>
  ` : `
    <rect x="38" y="16" width="44" height="16" rx="8" fill="${hair}"/>
    <rect x="36" y="22" width="6" height="14" rx="4" fill="${hair}"/>
    <rect x="78" y="22" width="6" height="14" rx="4" fill="${hair}"/>
    <rect x="38" y="14" width="44" height="8" rx="6" fill="${hairH}" opacity=".5"/>
    <rect x="42" y="16" width="14" height="3" rx="2" fill="rgba(255,255,255,.15)"/>
  `}

  <!-- ═══ 투구 (머리카락 위) ═══ -->
  ${helmSvg}

</svg>`;
}

// ══ 캐릭터 종이인형 (CHAR-DOLL-1) ══════════════════════════════
//  assets/char/ 의 SVG 84장을 겹쳐 캐릭터를 그린다.
//  합성 규칙 원본: 클로드코드\성장rpg_svg\char\README.md "합성 (코드)" 절.
//  · buildCharSVG(기존 코드 그림)는 한 줄도 건드리지 않는다. 에셋이 안 오면 그대로 폴백.
//  · 파일은 로그인 직후 한 번에 받아 문자열로 캐시한다(84장 약 183KB).
//  · CHAR_DOLL 을 false 로 두면 즉시 예전 그림으로 돌아간다.
const CHAR_DOLL = true;

const _CHAR_SVG = {};        // 'base_1' | 'body_e_b3' ... → 바깥 <svg> 벗긴 내용
let _charDollReady = false;
let _charDollLoading = false;
let _charDollFailed = false;   // [CHAR-FIRST-1] 84장을 못 받았을 때만 true → 그때만 옛 그림(buildCharSVG)
const _CHAR_DOLL_WAIT_MS = 15000;   // 이보다 오래 안 오면 일단 옛 그림, 뒤늦게 오면 다시 종이인형

// 바깥 <svg …> … </svg> 벗기기
function _charInner(txt) {
  return String(txt).replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}
// class 로만 구분된 그룹 하나를 집어오기 / 떼어내기 (그룹 안에 중첩 <g> 없음이 보장됨)
function _charGroupRe(cls) {
  return new RegExp('<g class="' + cls + '"[^>]*>[\\s\\S]*?<\\/g>');
}
function _grabGroup(svg, cls) { const m = svg.match(_charGroupRe(cls)); return m ? m[0] : ''; }
function _dropGroup(svg, cls) { return svg.replace(_charGroupRe(cls), ''); }

// 받아올 84장의 이름
function _charFileNames() {
  const out = [];
  for (let i = 1; i <= 4;  i++) out.push('base_' + i);
  for (let i = 1; i <= 30; i++) out.push('body_e_b' + i);
  for (let i = 1; i <= 10; i++) out.push('head_e_h' + i, 'glove_e_g' + i, 'shoe_e_s' + i,
                                         'weapon_e_w' + i, 'weapon_e_ws' + i);
  return out;
}

// 로그인 직후 1회. 실패한 파일은 그 슬롯만 빠지고 나머지는 그대로 그린다.
function loadCharDolls() {
  if (!CHAR_DOLL || _charDollLoading || _charDollReady) return;
  _charDollLoading = true;
  const names = _charFileNames();
  Promise.all(names.map(n =>
    fetch('./assets/char/' + n + '.svg')
      .then(r => r.ok ? r.text() : null)
      .then(t => { if (t) _CHAR_SVG[n] = _charInner(t); })
      .catch(() => {})
  )).then(() => {
    // base 가 하나도 없으면 종이인형을 쓸 수 없다 — 그때만 예전 그림
    const anyBase = ['base_1','base_2','base_3','base_4'].some(b => _CHAR_SVG[b]);
    if (!anyBase) { console.warn('캐릭터 에셋 로드 실패 — 기존 그림 유지'); _charDollFailed = true; _redrawCharSpots(); return; }
    _charDollReady = true; _charDollFailed = false;
    _redrawCharSpots();   // [CHAR-FIRST-1] 화면 전체(renderAll)가 아니라 캐릭터 자리만
  });
  // 느린 망: 너무 오래 안 오면 빈 자리 대신 옛 그림을 보인다. 뒤늦게 오면 위 then 이 다시 종이인형으로 바꾼다.
  setTimeout(() => { if (!_charDollReady && !_charDollFailed) { _charDollFailed = true; _redrawCharSpots(); } }, _CHAR_DOLL_WAIT_MS);
}
// [CHAR-FIRST-1] 로그인 전 페이지 로드 직후부터 받기 시작한다(로그인 화면 동안 84장이 미리 온다).
try { loadCharDolls(); } catch (e) { /* fetch 없는 환경이면 로그인 뒤 호출이 다시 시도한다 */ }

// [CHAR-FIRST-1] 84장이 오기 전 자리 — 그림자와 흐린 실루엣만. 옛 그림을 먼저 보이지 않는다.
function _charPlaceholderSVG() {
  return '<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">'
       + '<ellipse cx="60" cy="151" rx="26" ry="5" fill="#000" opacity=".28"/>'
       + '<g fill="#fff" opacity=".07"><circle cx="60" cy="42" r="22"/><rect x="40" y="60" width="40" height="44" rx="6"/>'
       + '<rect x="43" y="100" width="15" height="32" rx="5"/><rect x="62" y="100" width="15" height="32" rx="5"/></g></svg>';
}
// [CHAR-FIRST-1] 캐릭터가 그려지는 자리만 다시 그린다(캐릭터 카드·모바일 카드·전투 무대). 없는 자리는 건너뛴다.
function _redrawCharSpots() {
  if (typeof CUR === 'undefined' || !CUR) return;
  ['char-svg-wrap', 'mob-char-svg-wrap', 'ba-char-emoji'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    try { el.innerHTML = charSVG(CUR); } catch (e) { /* 그 자리만 건너뛴다 */ }
  });
}

// 종이인형 합성. base 가 없으면 null 을 돌려 호출부가 폴백하게 한다.
function buildCharDoll(s) {
  const ct = (s && s.charType >= 1 && s.charType <= 4) ? s.charType : 1;
  let base = _CHAR_SVG['base_' + ct];
  if (!base) return null;

  const eq = (s && s.equipmentIds) || {};
  const pick = (slot, id) => (id && id !== 'none') ? (_CHAR_SVG[slot + '_' + id] || '') : '';

  // 머리: 투구를 쓰면 base 의 정수리(hair-top)를 뺀다. 왕관처럼 정수리를 안 덮는 것은 남긴다.
  const headSvg = pick('head', eq.head);
  if (headSvg && headSvg.indexOf('keep-hair-top') === -1) base = _dropGroup(base, 'hair-top');

  // 손: 손가락(fingers-front)은 무기 자루 앞에 다시 그려야 해서 따로 떼어 둔다.
  let fingers = _grabGroup(base, 'fingers-front');
  base = _dropGroup(base, 'fingers-front');

  let out = base + pick('shoe', eq.shoe) + pick('body', eq.body);

  const gloveSvg = pick('glove', eq.glove);
  if (gloveSvg) {                       // 장갑이 있으면 손가락도 장갑 것을 쓴다
    fingers = _grabGroup(gloveSvg, 'fingers-front');
    out += _dropGroup(gloveSvg, 'fingers-front');
  }

  out += headSvg + pick('weapon', eq.weapon) + fingers;
  return '<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" '
       + 'style="width:100%;height:100%">' + out + '</svg>';
}

// 화면이 쓰는 입구. 에셋이 준비됐으면 종이인형, 아니면 예전 그림.
function charSVG(s) {
  if (CHAR_DOLL && _charDollReady) {
    const doll = buildCharDoll(s);
    if (doll) return doll;
  }
  if (CHAR_DOLL && !_charDollFailed) return _charPlaceholderSVG();   // [CHAR-FIRST-1] 받는 중 — 옛 그림을 먼저 보이지 않는다
  return buildCharSVG(s);
}

function renderCharCard(svgWrapId, cnameId, jobId, combatId, equipId, abilityId, s) {
  const svgWrap = document.getElementById(svgWrapId);
  if (svgWrap) svgWrap.innerHTML = charSVG(s);
  document.getElementById(cnameId).textContent = s.name;
  document.getElementById(jobId).textContent   = '⚗️ ' + (s.job || '');
  const combatNames = {atk:'공격력',def:'방어력',mag:'마력',spd:'속도'};
  document.getElementById(combatId).innerHTML = Object.entries(s.combat||{}).map(([k,v]) =>
    `<div class="combat-stat"><span>${combatNames[k]||k}</span><span class="combat-val">${v}</span></div>`
  ).join('');
  const slotDefs = [{k:'head',icon:'🪖',l:'머리'},{k:'body',icon:'🥋',l:'옷'},
    {k:'weapon',icon:'⚔️',l:'무기'},{k:'glove',icon:'🧤',l:'장갑'},{k:'shoe',icon:'👟',l:'신발'}];
  document.getElementById(equipId).innerHTML = slotDefs.map(sl => {
    const eqId   = s.equipmentIds?.[sl.k];
    const eqItem = eqId ? GAME_DATA.getItemById(eqId) : null;
    const name   = eqItem ? eqItem.name : (s.equipment?.[sl.k] || '');
    return `<div class="equip-slot ${name?'has':''}" onclick="openModal('m-inv');renderInv()">
      <span class="eslot-icon">
        ${eqItem ? iconImg(eqItem, 'equipment', '2.2rem') : `<span style="font-size:1.4rem">${sl.icon}</span>`}   <!-- [EQUIP-ICON-1] 상점·가방과 같은 PNG(셀셰이딩) -->
      </span>
      <div class="eslot-info">
        <div class="eslot-type">${sl.l}</div>
        <div class="eslot-name">${name||'없음'}</div>
      </div>
    </div>`;
  }).join('');
  const abDefs = [{k:'read',l:'독서',c:'ab-read'},{k:'study',l:'학습',c:'ab-study'},
    {k:'art',l:'예술',c:'ab-art'},{k:'value',l:'가치',c:'ab-moral'},{k:'health',l:'건강',c:'ab-health'},
    {k:'life',l:'생활',c:'ab-life'}];
  const maxV = Math.max(10, ...Object.values(s.stats||{}));
  document.getElementById(abilityId).innerHTML =
    // 독서 (특수 능력치)
    `<div style="font-size:.6rem;color:var(--txt3);letter-spacing:.05em;margin-bottom:.25rem;opacity:.7">
      ✨ 특수 능력치</div>` +
    abDefs.filter(ab => ab.k === 'read').map(ab => {
      const v = s.stats?.[ab.k]||0;
      const display = Number.isInteger(v) ? v : v.toFixed(1);
      return `<div class="ab-row ${ab.c}" style="opacity:.85">
        <span class="ab-name" style="color:var(--sky)">${ab.l}</span>
        <div class="ab-bar" style="background:rgba(93,173,226,.12)">
          <div class="ab-fill" style="width:${Math.min(100,v/maxV*100)}%;background:var(--sky)"></div>
        </div>
        <span class="ab-val" style="color:var(--sky)">${display}</span>
      </div>`;
    }).join('') +
    // 구분선
    `<div style="height:1px;background:rgba(255,255,255,.07);margin:.45rem 0"></div>
    <div style="font-size:.6rem;color:var(--txt3);letter-spacing:.05em;margin-bottom:.25rem;opacity:.7">
      ⚔️ 전투 활동 능력치</div>` +
    // 나머지 능력치
    abDefs.filter(ab => ab.k !== 'read').map(ab => {
      const v = s.stats?.[ab.k]||0;
      const display = Number.isInteger(v) ? v : v.toFixed(1);
      return `<div class="ab-row ${ab.c}">
        <span class="ab-name">${ab.l}</span>
        <div class="ab-bar"><div class="ab-fill" style="width:${Math.min(100,v/maxV*100)}%"></div></div>
        <span class="ab-val">${display}</span>
      </div>`;
    }).join('');
}

