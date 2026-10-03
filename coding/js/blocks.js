// 블록 정의 · 파이썬 글 코드 · 어두운 테마 — Blockly 11(구글 · Apache-2.0)은 index.html 의 <script> 가 싣는다(전역 Blockly · python)
//  [CODING-ROOM-1] 블록 편집기는 검증된 엔진을 쓰고, 우리는 내용(판 · 몬스터 · 교과 연결)과 기록에 힘을 쓴다.
import { PEN_COLORS } from './world.js';

const B = globalThis.Blockly;
const PY = globalThis.python && globalThis.python.pythonGenerator;
export const MEDIA = 'https://cdn.jsdelivr.net/npm/blockly@11.2.2/media/';

const STYLE = {
  hat_blocks: { colourPrimary: '#f2a93b', colourSecondary: '#ffc766', colourTertiary: '#b37a1f', hat: 'cap' },
  move_blocks: { colourPrimary: '#3d8bfd', colourSecondary: '#8ab6ff', colourTertiary: '#2a62b5' },
  act_blocks: { colourPrimary: '#2fae6a', colourSecondary: '#7fd4a3', colourTertiary: '#1f7a49' },
  loop_blocks: { colourPrimary: '#f59a23', colourSecondary: '#ffc068', colourTertiary: '#b86d0c' },
  pen_blocks: { colourPrimary: '#e0533d', colourSecondary: '#ff9585', colourTertiary: '#a3382a' },
};
let THEME = null, done = false;

export function defineAll() {
  if (done || !B) return;
  done = true;
  THEME = B.Theme.defineTheme('codingDark', {
    name: 'codingDark', base: B.Themes.Classic, startHats: true, blockStyles: STYLE, categoryStyles: {},
    componentStyles: {
      workspaceBackgroundColour: '#1d1611', toolboxBackgroundColour: '#241b13', toolboxForegroundColour: '#f3e8d6',
      flyoutBackgroundColour: '#2a2018', flyoutForegroundColour: '#d9c9ae', flyoutOpacity: 1,
      scrollbarColour: '#6b5a48', scrollbarOpacity: 0.5, insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.35,
      cursorColour: '#ffc766', selectedGlowColour: '#ffc766', selectedGlowOpacity: 0.6,
    },
    fontStyle: { family: '"Noto Sans KR", sans-serif', weight: '800', size: 13 },
  });
  const stmt = (type, text, style) => ({ type, message0: text, previousStatement: null, nextStatement: null, style });
  B.defineBlocksWithJsonArray([
    { type: 'start', message0: '▶ 시작하면', nextStatement: null, style: 'hat_blocks' },
    stmt('m_fwd', '앞으로 한 칸 ⬆', 'move_blocks'),
    stmt('m_left', '왼쪽으로 돌기 ↺', 'move_blocks'),
    stmt('m_right', '오른쪽으로 돌기 ↻', 'move_blocks'),
    stmt('m_up', '위로 한 칸 ↑', 'move_blocks'),
    stmt('m_down', '아래로 한 칸 ↓', 'move_blocks'),
    stmt('m_west', '왼쪽으로 한 칸 ←', 'move_blocks'),
    stmt('m_east', '오른쪽으로 한 칸 →', 'move_blocks'),
    stmt('m_jump', '두 칸 뛰기 ⤴', 'act_blocks'),
    stmt('m_pick', '도토리 줍기 🌰', 'act_blocks'),
    { type: 'c_repeat', message0: '%1 번 반복', args0: [{ type: 'field_number', name: 'N', value: 3, min: 1, max: 50, precision: 1 }],
      message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], previousStatement: null, nextStatement: null, style: 'loop_blocks' },
    { type: 'p_fwd', message0: '앞으로 %1 걸음', args0: [{ type: 'field_number', name: 'N', value: 100, min: 0, max: 400, precision: 1 }], previousStatement: null, nextStatement: null, style: 'pen_blocks' },
    { type: 'p_right', message0: '오른쪽으로 %1 도 돌기 ↻', args0: [{ type: 'field_number', name: 'N', value: 90, min: 0, max: 360, precision: 1 }], previousStatement: null, nextStatement: null, style: 'pen_blocks' },
    { type: 'p_left', message0: '왼쪽으로 %1 도 돌기 ↺', args0: [{ type: 'field_number', name: 'N', value: 90, min: 0, max: 360, precision: 1 }], previousStatement: null, nextStatement: null, style: 'pen_blocks' },
    { type: 'p_color', message0: '붓 색 %1', args0: [{ type: 'field_dropdown', name: 'C', options: PEN_COLORS.map(([n, c]) => [n, c]) }], previousStatement: null, nextStatement: null, style: 'pen_blocks' },
    { type: 'p_pen', message0: '붓 %1', args0: [{ type: 'field_dropdown', name: 'S', options: [['내리기(그리기)', 'down'], ['들기(안 그리기)', 'up']] }], previousStatement: null, nextStatement: null, style: 'pen_blocks' },
  ]);
  if (PY) {   // 블록 옆 '글 코드' — 파이썬 모양(6학년 · 중학교 정보로 이어지는 다리)
    const f = PY.forBlock, line = s => () => s + '\n';
    f.start = () => '';
    f.m_fwd = line('forward()'); f.m_left = line('turn_left()'); f.m_right = line('turn_right()');
    f.m_up = line('up()'); f.m_down = line('down()'); f.m_west = line('left()'); f.m_east = line('right()');
    f.m_jump = line('jump()'); f.m_pick = line('pick()');
    f.c_repeat = (b, g) => `for i in range(${b.getFieldValue('N')}):\n${g.statementToCode(b, 'DO') || g.INDENT + 'pass\n'}`;
    f.p_fwd = b => `forward(${b.getFieldValue('N')})\n`;
    f.p_right = b => `right(${b.getFieldValue('N')})\n`;
    f.p_left = b => `left(${b.getFieldValue('N')})\n`;
    f.p_color = b => `color("${(PEN_COLORS.find(([, c]) => c === b.getFieldValue('C')) || ['?'])[0]}")\n`;
    f.p_pen = b => b.getFieldValue('S') === 'up' ? 'pen_up()\n' : 'pen_down()\n';
  }
}

// 판 하나의 작업판 — 쓸 수 있는 블록만 서랍에 · limit 이면 그만큼만(‘시작하면’ 하나 더)
export function makeWorkspace(div, { blocks, limit }) {
  defineAll();
  const contents = blocks.map(t => ({ kind: 'block', type: t, ...(t === 'p_fwd' ? { fields: { N: 100 } } : t === 'p_right' || t === 'p_left' ? { fields: { N: 90 } } : {}) }));
  return B.inject(div, {
    toolbox: { kind: 'flyoutToolbox', contents },
    theme: THEME, renderer: 'zelos', trashcan: true, sounds: false, media: MEDIA,
    maxBlocks: limit ? limit + 1 : Infinity,
    zoom: { controls: true, wheel: false, startScale: 0.9, maxScale: 1.6, minScale: 0.55, scaleSpeed: 1.15 },
    move: { scrollbars: true, drag: true, wheel: true },
  });
}

export const startOf = ws => ws.getTopBlocks(false).find(b => b.type === 'start') || null;

// '시작하면' 밑의 코드만 글로(떨어져 있는 블록은 안 들어간다 — 실행도 똑같이 안 한다)
export function pythonOf(ws) {
  const st = startOf(ws);
  if (!PY || !st) return '';
  PY.init(ws);
  const code = PY.finish(PY.blockToCode(st) || '').replace(/^\s*\n/, '').replace(/\s+$/, '');
  return code ? code + '\n' : '';
}
