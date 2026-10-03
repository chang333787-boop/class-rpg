// 블록 정의 · 파이썬 글 코드 · 어두운 테마 — Blockly 11(구글 · Apache-2.0)은 index.html 의 <script> 가 싣는다(전역 Blockly · python)
//  [CODING-ROOM-1] 블록 편집기는 검증된 엔진을 쓰고, 우리는 내용(판 · 몬스터 · 교과 연결)과 기록에 힘을 쓴다.
import { PEN_COLORS, CONDS } from './world.js';

const B = globalThis.Blockly;
const PY = globalThis.python && globalThis.python.pythonGenerator;
export const MEDIA = 'https://cdn.jsdelivr.net/npm/blockly@11.2.2/media/';

const STYLE = {
  hat_blocks: { colourPrimary: '#f2a93b', colourSecondary: '#ffc766', colourTertiary: '#b37a1f', hat: 'cap' },
  move_blocks: { colourPrimary: '#3d8bfd', colourSecondary: '#8ab6ff', colourTertiary: '#2a62b5' },
  act_blocks: { colourPrimary: '#2fae6a', colourSecondary: '#7fd4a3', colourTertiary: '#1f7a49' },
  loop_blocks: { colourPrimary: '#f59a23', colourSecondary: '#ffc068', colourTertiary: '#b86d0c' },
  if_blocks: { colourPrimary: '#9b5de5', colourSecondary: '#c39bf0', colourTertiary: '#6c3aa8' },
  variable_blocks: { colourPrimary: '#d39a1c', colourSecondary: '#f0c35c', colourTertiary: '#9a6d0c' },   // [CODING-U7] 주머니(변수)
  math_blocks: { colourPrimary: '#4f9a6a', colourSecondary: '#86c79c', colourTertiary: '#336b48' },
  procedure_blocks: { colourPrimary: '#d6457a', colourSecondary: '#ef8db0', colourTertiary: '#9c2a54' },   // [CODING-U8] 기술(함수)
  pen_blocks: { colourPrimary: '#e0533d', colourSecondary: '#ff9585', colourTertiary: '#a3382a' },
};
let THEME = null, done = false;
//  [CODING-U5] 만약 블록의 살피기 목록 — 판(몬스터)마다 다르다. 작업판을 만들기 전에 정한다(서랍 블록이 그때 만들어진다)
let condList = ['wall', 'ahead', 'left', 'right'];
export function setConds(list) { if (list && list.length) condList = list.slice(); }
const condOptions = () => condList.map(k => [CONDS[k] ? CONDS[k][0] : k, k]);

export function defineAll() {
  if (done || !B) return;
  done = true;
  THEME = B.Theme.defineTheme('codingDark', {
    name: 'codingDark', base: B.Themes.Classic, startHats: true, blockStyles: STYLE,
    categoryStyles: { move_category: { colour: '#3d8bfd' }, loop_category: { colour: '#f59a23' }, if_category: { colour: '#9b5de5' }, pen_category: { colour: '#e0533d' },
      var_category: { colour: '#d39a1c' }, math_category: { colour: '#4f9a6a' }, skill_category: { colour: '#d6457a' } },
    componentStyles: {
      workspaceBackgroundColour: '#1d1611', toolboxBackgroundColour: '#241b13', toolboxForegroundColour: '#f3e8d6',
      flyoutBackgroundColour: '#2a2018', flyoutForegroundColour: '#d9c9ae', flyoutOpacity: 1,
      scrollbarColour: '#6b5a48', scrollbarOpacity: 0.5, insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.35,
      cursorColour: '#ffc766', selectedGlowColour: '#ffc766', selectedGlowOpacity: 0.6,
    },
    fontStyle: { family: '"Noto Sans KR", sans-serif', weight: '800', size: 13 },
  });
  Object.assign(B.Msg, {   // [CODING-U7] 변수 = 주머니 · 함수 = 기술(몬스터가 배우는 것)
    VARIABLES_SET: '주머니 %1 에 %2 넣기', MATH_CHANGE_TITLE: '주머니 %1 을(를) %2 만큼 늘리기', NEW_VARIABLE: '주머니(변수) 만들기…', NEW_VARIABLE_TITLE: '새 주머니 이름:',
    RENAME_VARIABLE: '주머니 이름 바꾸기…', RENAME_VARIABLE_TITLE: '주머니 이름:',
    PROCEDURES_DEFNORETURN_TITLE: '기술', PROCEDURES_DEFNORETURN_PROCEDURE: '새 기술', PROCEDURES_BEFORE_PARAMS: '받는 값:', PROCEDURES_CALL_BEFORE_PARAMS: '받는 값:',
    PROCEDURES_MUTATORCONTAINER_TITLE: '받는 값들', PROCEDURES_MUTATORARG_TITLE: '값 이름:', PROCEDURES_DEFNORETURN_TOOLTIP: '블록 묶음에 이름을 붙여 몬스터의 기술로 만들어요',
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
    // [CODING-U7] 값 칸 꼴 — 숫자 대신 주머니 · 셈을 끼울 수 있다
    { type: 'p_fwd_v', message0: '앞으로 %1 걸음', args0: [{ type: 'input_value', name: 'N', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, style: 'pen_blocks' },
    { type: 'p_right_v', message0: '오른쪽으로 %1 도 돌기 ↻', args0: [{ type: 'input_value', name: 'N', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, style: 'pen_blocks' },
    { type: 'p_left_v', message0: '왼쪽으로 %1 도 돌기 ↺', args0: [{ type: 'input_value', name: 'N', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, style: 'pen_blocks' },
    { type: 'c_repeat_v', message0: '%1 번 반복', args0: [{ type: 'input_value', name: 'N', check: 'Number' }], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }],
      inputsInline: true, previousStatement: null, nextStatement: null, style: 'loop_blocks' },
    { type: 'p_color', message0: '붓 색 %1', args0: [{ type: 'field_dropdown', name: 'C', options: PEN_COLORS.map(([n, c]) => [n, c]) }], previousStatement: null, nextStatement: null, style: 'pen_blocks' },
    { type: 'p_pen', message0: '붓 %1', args0: [{ type: 'field_dropdown', name: 'S', options: [['내리기(그리기)', 'down'], ['들기(안 그리기)', 'up']] }], previousStatement: null, nextStatement: null, style: 'pen_blocks' },
  ]);
  //  만약 · 만약/아니면 · 될 때까지 — 살피기 칸은 판마다 바뀌어 JS 로 정의
  B.Blocks.c_if = { init() {
    this.appendDummyInput().appendField('만약').appendField(new B.FieldDropdown(condOptions), 'C');
    this.appendStatementInput('DO'); this.setPreviousStatement(true); this.setNextStatement(true); this.setStyle('if_blocks');
  } };
  B.Blocks.c_ifelse = { init() {
    this.appendDummyInput().appendField('만약').appendField(new B.FieldDropdown(condOptions), 'C');
    this.appendStatementInput('DO'); this.appendDummyInput().appendField('아니면'); this.appendStatementInput('ELSE');
    this.setPreviousStatement(true); this.setNextStatement(true); this.setStyle('if_blocks');
  } };
  B.Blocks.c_until = { init() {
    this.appendDummyInput().appendField('집에 닿을 때까지 반복');
    this.appendStatementInput('DO'); this.setPreviousStatement(true); this.setNextStatement(true); this.setStyle('loop_blocks');
  } };
  if (PY) {   // 블록 옆 '글 코드' — 파이썬 모양(6학년 · 중학교 정보로 이어지는 다리)
    const f = PY.forBlock, line = s => () => s + '\n';
    f.start = () => '';
    f.m_fwd = line('forward()'); f.m_left = line('turn_left()'); f.m_right = line('turn_right()');
    f.m_up = line('up()'); f.m_down = line('down()'); f.m_west = line('left()'); f.m_east = line('right()');
    f.m_jump = line('jump()'); f.m_pick = line('pick()');
    f.c_repeat = (b, g) => `for i in range(${b.getFieldValue('N')}):\n${g.statementToCode(b, 'DO') || g.INDENT + 'pass\n'}`;
    const cond = b => (CONDS[b.getFieldValue('C')] || ['', 'check()'])[1];
    f.c_if = (b, g) => `if ${cond(b)}:\n${g.statementToCode(b, 'DO') || g.INDENT + 'pass\n'}`;
    f.c_ifelse = (b, g) => `if ${cond(b)}:\n${g.statementToCode(b, 'DO') || g.INDENT + 'pass\n'}else:\n${g.statementToCode(b, 'ELSE') || g.INDENT + 'pass\n'}`;
    f.c_until = (b, g) => `while not at_home():\n${g.statementToCode(b, 'DO') || g.INDENT + 'pass\n'}`;
    f.p_fwd = b => `forward(${b.getFieldValue('N')})\n`;
    const NM = x => String(x || '').trim().replace(/\s+/g, '_'), V = (b, g, n) => g.valueToCode(b, n, 99) || '0';   // 한글 이름 그대로(파이썬 3 은 한글 이름을 쓸 수 있다)
    f.p_fwd_v = (b, g) => `forward(${V(b, g, 'N')})\n`; f.p_right_v = (b, g) => `right(${V(b, g, 'N')})\n`; f.p_left_v = (b, g) => `left(${V(b, g, 'N')})\n`;
    f.c_repeat_v = (b, g) => `for i in range(${V(b, g, 'N')}):\n${g.statementToCode(b, 'DO') || g.INDENT + 'pass\n'}`;
    f.variables_get = b => [NM(b.getField('VAR').getText()), 0];
    f.variables_set = (b, g) => `${NM(b.getField('VAR').getText())} = ${V(b, g, 'VALUE')}\n`;
    f.math_change = (b, g) => `${NM(b.getField('VAR').getText())} += ${V(b, g, 'DELTA')}\n`;
    f.procedures_defnoreturn = (b, g) => { const n = NM(b.getFieldValue('NAME')); g.definitions_['%' + n] = `def ${n}(${(b.getVars ? b.getVars() : []).map(NM).join(', ')}):\n${g.statementToCode(b, 'STACK') || g.INDENT + 'pass\n'}`; return null; };
    f.procedures_callnoreturn = (b, g) => { const a = []; for (let k = 0; b.getInput('ARG' + k); k++) a.push(V(b, g, 'ARG' + k)); return `${NM(b.getFieldValue('NAME'))}(${a.join(', ')})\n`; };
    f.p_right = b => `right(${b.getFieldValue('N')})\n`;
    f.p_left = b => `left(${b.getFieldValue('N')})\n`;
    f.p_color = b => `color("${(PEN_COLORS.find(([, c]) => c === b.getFieldValue('C')) || ['?'])[0]}")\n`;
    f.p_pen = b => b.getFieldValue('S') === 'up' ? 'pen_up()\n' : 'pen_down()\n';
  }
}

// 판 하나의 작업판 — 6단원까지는 블록 줄 하나(쓸 수 있는 것만) · 7단원부터 종류 칸(붓 · 반복 · 만약 · 주머니 · 셈 · 기술)
const num = (type, n, name = 'N') => ({ kind: 'block', type, inputs: { [name]: { shadow: { type: 'math_number', fields: { NUM: n } } } } });
function toolboxFor(stage) {
  const blocks = stage.blocks || [];
  if (!(stage.unit >= 7)) {
    const contents = blocks.map(t => ({ kind: 'block', type: t, ...(t === 'p_fwd' ? { fields: { N: 100 } } : t === 'p_right' || t === 'p_left' ? { fields: { N: 90 } } : {}) }));
    return { kind: 'flyoutToolbox', contents };
  }
  const cat = (name, style, contents) => ({ kind: 'category', name, categorystyle: style, contents });
  const cats = [];
  if (stage.world === 'pen') cats.push(cat('붓', 'pen_category', [num('p_fwd_v', 100), num('p_right_v', 90), num('p_left_v', 90), { kind: 'block', type: 'p_color' }, { kind: 'block', type: 'p_pen' }]));
  else cats.push(cat('움직임', 'move_category', blocks.filter(t => /^m_/.test(t)).map(t => ({ kind: 'block', type: t }))));
  cats.push(cat('반복', 'loop_category', stage.world === 'pen' ? [num('c_repeat_v', 4)] : [{ kind: 'block', type: 'c_repeat' }, ...(blocks.includes('c_until') ? [{ kind: 'block', type: 'c_until' }] : [])]));
  if (stage.world !== 'pen') cats.push(cat('만약', 'if_category', [{ kind: 'block', type: 'c_if' }, { kind: 'block', type: 'c_ifelse' }]));
  if (stage.world === 'pen') {
    cats.push({ kind: 'category', name: '주머니', categorystyle: 'var_category', custom: 'VARIABLE' });
    cats.push(cat('셈', 'math_category', [{ kind: 'block', type: 'math_number', fields: { NUM: 10 } }, { kind: 'block', type: 'math_arithmetic', fields: { OP: 'ADD' },
      inputs: { A: { shadow: { type: 'math_number', fields: { NUM: 1 } } }, B: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } }]));
  }
  if (stage.unit >= 8) cats.push({ kind: 'category', name: '기술', categorystyle: 'skill_category', custom: 'SKILLS' });
  return { kind: 'categoryToolbox', contents: cats };
}
export function makeWorkspace(div, stage) {
  defineAll();
  const ws = B.inject(div, {
    toolbox: toolboxFor(stage),
    theme: THEME, renderer: 'zelos', trashcan: true, sounds: false, media: MEDIA,
    maxBlocks: stage.limit ? stage.limit + 1 : Infinity,
    zoom: { controls: true, wheel: false, startScale: 0.9, maxScale: 1.6, minScale: 0.55, scaleSpeed: 1.15 },
    move: { scrollbars: true, drag: true, wheel: true },
  });
  //  [CODING-U8] '기술' 서랍 — 기술 만들기 하나 + 이미 만든 기술마다 쓰기 블록(받는 값 칸까지)
  ws.registerToolboxCategoryCallback('SKILLS', w => [
    { kind: 'label', text: '기술 = 이름 붙인 블록 묶음' },
    { kind: 'block', type: 'procedures_defnoreturn', fields: { NAME: '새 기술' } },
    ...w.getTopBlocks(false).filter(b => b.type === 'procedures_defnoreturn').map(b => ({ kind: 'block', type: 'procedures_callnoreturn', extraState: { name: b.getFieldValue('NAME'), params: b.getVars() } })),
  ]);
  for (const v of stage.vars || []) { try { (ws.getVariableMap ? ws.getVariableMap() : ws).createVariable(v); } catch (e) {} }   // 판이 준비해 둔 주머니
  return ws;
}

export const startOf = ws => ws.getTopBlocks(false).find(b => b.type === 'start') || null;

// '시작하면' 밑의 코드 + 기술 정의를 글로(떨어져 있는 다른 블록은 안 들어간다 — 실행도 똑같이 안 한다)
export function pythonOf(ws) {
  const st = startOf(ws);
  if (!PY || !st) return '';
  PY.init(ws);
  delete PY.definitions_.variables;   // 'x = None' 줄은 빼고(아이 코드에 없는 줄)
  for (const d of ws.getTopBlocks(false).filter(b => b.type === 'procedures_defnoreturn')) PY.blockToCode(d);
  const code = PY.finish(PY.blockToCode(st) || '').replace(/^\s*\n/, '').replace(/\s+$/, '');
  return code ? code + '\n' : '';
}
