// ══════════════════════════════════════════════════
//  수학 보충학습 은행 — 1~3학년 복습 단원 + 문항
//  ------------------------------------------------
//  · curriculum.js 와 같은 방식의 클래식 <script>. 전역 상수 REVIEW_CURRICULUM / REVIEW_PROBLEMS 노출.
//    (curriculum.js 와 독립. 어디에 로드하고 어떻게 붙일지는 student.js/admin.js 쪽에서 정한다)
//  · 용도: 4학년 학생이 1~3학년 수학을 다시 다지는 "보충" 문항. 보상과는 무관하다.
//  · 교과서 본문·문제를 옮겨 오지 않는다. 2022 개정 교육과정 성취기준에 맞춰 새로 만든 문항만 담는다.
//    (교과서 내용은 저작권 대상. 이 앱은 배포를 염두에 두므로 원칙적으로 제외)
//  · 단원은 1·2학기를 합쳐서 학년당 8~10개로 묶었다(보충용이라 학기 구분이 필요 없음).
//
//  id 규칙
//   · 단원  : ma<학년>-<번호>            예: ma2-4   (학기 없음)
//   · 문항  : r_ma<학년>_<단원>_<번호>    예: r_ma2_4_03   ← 접두 r_ (curriculum.js 의 p_ 와 충돌 방지)
//
//  문항 형식 — curriculum.js 와 동일
//   { id, unitId, type, cat, level, q, a, choices?, hint, fig? }
//   type  : 'choice' | 'short' | 'number'      cat: 'calc' | 'word' | 'concept'
//   level : 1(기본) 2(보통) 3(도전) — 보충이므로 대부분 1~2
//   a     : number 형은 숫자 문자열('12'), choice 형은 choices 중 하나, short 는 짧은 한글/숫자
//   hint  : 모든 문항에 넣는다
//
//  fig — 그림이 필요한 문항(도형·시계·분수·길이 등)에만 넣는다. 렌더러는 별도 파일에 있고,
//        모르는 kind 는 무시된다. 아래 kind 만 쓴다.
//   { kind:'angle', deg:60, label:'?' }                 각 (label:'?' 이면 각도 숫자 숨김)
//   { kind:'polygon', n:3, shape:'right'|'iso'|'equi' } 다각형 (shape 는 n=3 일 때만)
//       + angles:[50,70,'?'] 옵션 — 꼭짓점마다 각 표기('?' 는 물음표). 1~3학년에서는 거의 안 씀
//   { kind:'rect', w:4, h:3, unit:'cm' }                직사각형 (w=h 면 정사각형)
//   { kind:'clock', h:3, m:30 }                         아날로그 시계
//   { kind:'fraction', n:4, k:3, shape:'circle'|'bar' } 전체 n 칸 중 k 칸 색칠
//   { kind:'blocks', hundreds:2, tens:3, ones:4 }       수 모형(백·십·일)
//   { kind:'grid', rows:3, cols:4 }                     묶음 배열(곱셈·나눗셈)
//   { kind:'numline', from:0, to:10, marks:[3], q:7 }   수직선 (marks 표시된 수, q 물음표 위치)
//   { kind:'shapes', items:['circle','triangle','square','rect','star','heart'] } 모양 나열(반복 가능)
//   { kind:'move', shape:'L'|'F'|'P'|'arrow', op:'flip-h'|'flip-v'|'rot90'|'rot180'|'?' } 도형 이동
//       op:'?' 이면 결과 자리에 물음표 — "어떻게 움직였을까요/어떤 모양이 될까요" 유형(답은 choices 로)
//   { kind:'ruler', len:7, unit:'cm' }                  자 위에 놓인 물건
//   ※ 그림과 물음이 반드시 맞아야 한다(시계 h/m = 묻는 시각, fraction n/k = 묻는 색칠 부분).
// ══════════════════════════════════════════════════

// ── 학년별 단원 ──
const REVIEW_CURRICULUM = {
  math: {
    label: '수학 보충', icon: '🧮',
    grades: {
      '1': {
        label: '1학년',
        units: [
          { id:'ma1-1', no:1, name:'9까지의 수' },
          { id:'ma1-2', no:2, name:'여러 가지 모양' },
          { id:'ma1-3', no:3, name:'덧셈과 뺄셈' },
          { id:'ma1-4', no:4, name:'비교하기' },
          { id:'ma1-5', no:5, name:'50까지의 수' },
          { id:'ma1-6', no:6, name:'100까지의 수' },
          { id:'ma1-7', no:7, name:'덧셈과 뺄셈(2)' },
          { id:'ma1-8', no:8, name:'시계 보기와 규칙 찾기' },
        ],
      },
      '2': {
        label: '2학년',
        units: [
          { id:'ma2-1',  no:1,  name:'세 자리 수' },
          { id:'ma2-2',  no:2,  name:'여러 가지 도형' },
          { id:'ma2-3',  no:3,  name:'덧셈과 뺄셈' },
          { id:'ma2-4',  no:4,  name:'길이 재기' },
          { id:'ma2-5',  no:5,  name:'분류하기' },
          { id:'ma2-6',  no:6,  name:'곱셈' },
          { id:'ma2-7',  no:7,  name:'네 자리 수' },
          { id:'ma2-8',  no:8,  name:'곱셈구구' },
          { id:'ma2-9',  no:9,  name:'시각과 시간' },
          { id:'ma2-10', no:10, name:'표와 그래프' },
        ],
      },
      '3': {
        label: '3학년',
        units: [
          { id:'ma3-1', no:1, name:'덧셈과 뺄셈' },
          { id:'ma3-2', no:2, name:'평면도형' },
          { id:'ma3-3', no:3, name:'나눗셈' },
          { id:'ma3-4', no:4, name:'곱셈' },
          { id:'ma3-5', no:5, name:'길이와 시간' },
          { id:'ma3-6', no:6, name:'분수와 소수' },
          { id:'ma3-7', no:7, name:'원' },
          { id:'ma3-8', no:8, name:'들이와 무게' },
          { id:'ma3-9', no:9, name:'자료의 정리' },
        ],
      },
    },
  },
};

// ── 문항 ──
const REVIEW_PROBLEMS = [
  // ══════════ 1학년 ══════════
  // ── 1-1. 9까지의 수 ──────────────────────────
  { id:'r_ma1_1_01', unitId:'ma1-1', type:'number', cat:'calc', level:1, q:'1, 2, 3, 4, 5 다음에 오는 수는 무엇일까요?', a:'6', hint:'하나씩 커져요. 5 다음은?' },
  { id:'r_ma1_1_02', unitId:'ma1-1', type:'number', cat:'concept', level:1, q:'그림의 낱개 모형은 모두 몇 개일까요?', a:'7', hint:'하나, 둘, 셋… 하고 세어 보세요', fig:{ kind:'blocks', hundreds:0, tens:0, ones:7 } },
  { id:'r_ma1_1_03', unitId:'ma1-1', type:'choice', cat:'concept', level:1, q:'다음 중 가장 큰 수는 무엇일까요?', choices:['3','8','5'], a:'8', hint:'수를 셀 때 나중에 나오는 수가 더 커요' },
  { id:'r_ma1_1_04', unitId:'ma1-1', type:'choice', cat:'concept', level:1, q:'다음 중 가장 작은 수는 무엇일까요?', choices:['6','2','9','4'], a:'2', hint:'수를 셀 때 먼저 나오는 수가 더 작아요' },
  { id:'r_ma1_1_05', unitId:'ma1-1', type:'number', cat:'calc', level:1, q:'4보다 1만큼 더 큰 수는 무엇일까요?', a:'5', hint:'4 다음에 오는 수예요' },
  { id:'r_ma1_1_06', unitId:'ma1-1', type:'number', cat:'calc', level:1, q:'7보다 1만큼 더 작은 수는 무엇일까요?', a:'6', hint:'7 바로 앞에 오는 수예요' },
  { id:'r_ma1_1_07', unitId:'ma1-1', type:'choice', cat:'concept', level:1, q:'"다섯"을 숫자로 쓰면 무엇일까요?', choices:['3','5','7'], a:'5', hint:'하나, 둘, 셋, 넷, 다섯' },
  { id:'r_ma1_1_08', unitId:'ma1-1', type:'choice', cat:'concept', level:1, q:'숫자 8을 바르게 읽은 것은 무엇일까요?', choices:['여덟','아홉','일곱'], a:'여덟', hint:'…여섯, 일곱, 여덟, 아홉' },
  { id:'r_ma1_1_09', unitId:'ma1-1', type:'number', cat:'concept', level:1, q:'수직선에서 물음표 자리에 알맞은 수는 무엇일까요?', a:'6', hint:'3에서 오른쪽으로 한 칸씩 세어 보세요', fig:{ kind:'numline', from:0, to:9, marks:[3], q:6 } },
  { id:'r_ma1_1_10', unitId:'ma1-1', type:'number', cat:'word', level:1, q:'줄을 서 있어요. 앞에서 넷째에 서 있는 친구의 앞에는 몇 명이 있을까요?', a:'3', hint:'첫째, 둘째, 셋째가 앞에 있어요' },
  { id:'r_ma1_1_11', unitId:'ma1-1', type:'number', cat:'concept', level:2, q:'6보다 크고 8보다 작은 수는 무엇일까요?', a:'7', hint:'6과 8 사이에 있는 수예요' },
  { id:'r_ma1_1_12', unitId:'ma1-1', type:'number', cat:'word', level:2, q:'접시에 있던 사탕 3개를 모두 먹었어요. 접시에 남은 사탕은 몇 개일까요?', a:'0', hint:'아무것도 없는 것을 나타내는 수는 0이에요' },

  // ── 1-2. 여러 가지 모양 ───────────────────────
  { id:'r_ma1_2_01', unitId:'ma1-2', type:'choice', cat:'concept', level:1, q:'이 모양의 이름은 무엇일까요?', choices:['동그라미','세모','네모'], a:'동그라미', hint:'뾰족한 곳이 없고 둥글어요', fig:{ kind:'shapes', items:['circle'] } },
  { id:'r_ma1_2_02', unitId:'ma1-2', type:'choice', cat:'concept', level:1, q:'이 모양의 이름은 무엇일까요?', choices:['세모','네모','동그라미'], a:'세모', hint:'뾰족한 곳이 3개예요', fig:{ kind:'shapes', items:['triangle'] } },
  { id:'r_ma1_2_03', unitId:'ma1-2', type:'choice', cat:'concept', level:1, q:'이 모양의 이름은 무엇일까요?', choices:['네모','세모','동그라미'], a:'네모', hint:'뾰족한 곳이 4개예요', fig:{ kind:'shapes', items:['square'] } },
  { id:'r_ma1_2_04', unitId:'ma1-2', type:'number', cat:'calc', level:1, q:'그림에서 세모 모양은 모두 몇 개일까요?', a:'3', hint:'뾰족한 곳이 3개인 모양만 세어요', fig:{ kind:'shapes', items:['triangle','circle','triangle','square','triangle'] } },
  { id:'r_ma1_2_05', unitId:'ma1-2', type:'number', cat:'calc', level:1, q:'그림에서 동그라미 모양은 모두 몇 개일까요?', a:'3', hint:'둥근 모양만 세어요', fig:{ kind:'shapes', items:['circle','circle','square','circle'] } },
  { id:'r_ma1_2_06', unitId:'ma1-2', type:'choice', cat:'concept', level:1, q:'어느 쪽으로도 잘 굴러가고 쌓을 수 없는 모양은 무엇일까요?', choices:['공 모양','상자 모양','둥근 기둥 모양'], a:'공 모양', hint:'축구공을 떠올려 보세요' },
  { id:'r_ma1_2_07', unitId:'ma1-2', type:'choice', cat:'concept', level:1, q:'상자 모양의 특징으로 알맞은 것은 무엇일까요?', choices:['평평한 면이 있어 잘 쌓을 수 있다','어느 쪽으로도 잘 굴러간다','뾰족한 곳이 하나도 없다'], a:'평평한 면이 있어 잘 쌓을 수 있다', hint:'택배 상자를 떠올려 보세요' },
  { id:'r_ma1_2_08', unitId:'ma1-2', type:'choice', cat:'concept', level:1, q:'음료수 캔과 같은 모양은 무엇일까요?', choices:['둥근 기둥 모양','공 모양','상자 모양'], a:'둥근 기둥 모양', hint:'눕히면 굴러가고 세우면 쌓을 수 있어요' },
  { id:'r_ma1_2_09', unitId:'ma1-2', type:'choice', cat:'concept', level:2, q:'곧은 선이 4개, 뾰족한 곳이 4개인 모양은 무엇일까요?', choices:['네모','세모','동그라미'], a:'네모', hint:'그림의 모양을 보고 곧은 선을 세어 보세요', fig:{ kind:'shapes', items:['rect'] } },
  { id:'r_ma1_2_10', unitId:'ma1-2', type:'choice', cat:'concept', level:2, q:'곧은 선과 뾰족한 곳이 하나도 없는 모양은 무엇일까요?', choices:['동그라미','세모','네모'], a:'동그라미', hint:'동전, 접시 같은 모양이에요', fig:{ kind:'shapes', items:['circle'] } },
  { id:'r_ma1_2_11', unitId:'ma1-2', type:'number', cat:'word', level:2, q:'그림에서 네모 모양은 세모 모양보다 몇 개 더 많을까요?', a:'1', hint:'네모 3개, 세모 2개', fig:{ kind:'shapes', items:['square','triangle','square','circle','square','triangle'] } },

  // ── 1-3. 덧셈과 뺄셈 ─────────────────────────
  { id:'r_ma1_3_01', unitId:'ma1-3', type:'number', cat:'calc', level:1, q:'3 + 4 = ?', a:'7', hint:'3에서 4만큼 더 세어 보세요' },
  { id:'r_ma1_3_02', unitId:'ma1-3', type:'number', cat:'calc', level:1, q:'2 + 6 = ?', a:'8', hint:'6에서 2만큼 더 세어도 같아요' },
  { id:'r_ma1_3_03', unitId:'ma1-3', type:'number', cat:'calc', level:1, q:'9 − 4 = ?', a:'5', hint:'9에서 4만큼 거꾸로 세어 보세요' },
  { id:'r_ma1_3_04', unitId:'ma1-3', type:'number', cat:'calc', level:1, q:'8 − 3 = ?', a:'5', hint:'8, 7, 6, 5 … 세 번 거꾸로' },
  { id:'r_ma1_3_05', unitId:'ma1-3', type:'number', cat:'calc', level:1, q:'5 + 0 = ?', a:'5', hint:'0을 더하면 그대로예요' },
  { id:'r_ma1_3_06', unitId:'ma1-3', type:'number', cat:'word', level:1, q:'사탕이 4개 있었는데 3개를 더 받았어요. 사탕은 모두 몇 개일까요?', a:'7', hint:'4 + 3' },
  { id:'r_ma1_3_07', unitId:'ma1-3', type:'number', cat:'word', level:1, q:'나뭇가지에 새 7마리가 앉아 있다가 2마리가 날아갔어요. 남은 새는 몇 마리일까요?', a:'5', hint:'7 − 2' },
  { id:'r_ma1_3_08', unitId:'ma1-3', type:'choice', cat:'concept', level:1, q:'합이 9가 되는 식은 무엇일까요?', choices:['4 + 5','3 + 5','6 + 2'], a:'4 + 5', hint:'하나씩 계산해 보세요' },
  { id:'r_ma1_3_09', unitId:'ma1-3', type:'number', cat:'concept', level:1, q:'수직선에서 3부터 오른쪽으로 4칸 간 곳의 수는 무엇일까요?', a:'7', hint:'3 + 4', fig:{ kind:'numline', from:0, to:10, marks:[3], q:7 } },
  { id:'r_ma1_3_10', unitId:'ma1-3', type:'number', cat:'calc', level:2, q:'2 + □ = 6 에서 □에 알맞은 수는?', a:'4', hint:'2에서 몇을 더해야 6이 될까요?' },
  { id:'r_ma1_3_11', unitId:'ma1-3', type:'number', cat:'calc', level:2, q:'□ − 3 = 4 에서 □에 알맞은 수는?', a:'7', hint:'4 + 3을 계산해 보세요' },

  // ── 1-4. 비교하기 ────────────────────────────
  { id:'r_ma1_4_01', unitId:'ma1-4', type:'choice', cat:'concept', level:1, q:'두 물건의 길이를 비교할 때 쓰는 말은 무엇일까요?', choices:['길다, 짧다','무겁다, 가볍다','많다, 적다'], a:'길다, 짧다', hint:'연필 두 자루를 나란히 놓고 비교할 때' },
  { id:'r_ma1_4_02', unitId:'ma1-4', type:'choice', cat:'concept', level:1, q:'두 물건의 무게를 비교할 때 쓰는 말은 무엇일까요?', choices:['무겁다, 가볍다','길다, 짧다','넓다, 좁다'], a:'무겁다, 가볍다', hint:'양손에 들어 보고 비교할 때' },
  { id:'r_ma1_4_03', unitId:'ma1-4', type:'choice', cat:'concept', level:1, q:'두 곳의 넓이를 비교할 때 쓰는 말은 무엇일까요?', choices:['넓다, 좁다','높다, 낮다','많다, 적다'], a:'넓다, 좁다', hint:'운동장과 교실을 비교할 때' },
  { id:'r_ma1_4_04', unitId:'ma1-4', type:'choice', cat:'concept', level:1, q:'두 그릇에 담긴 물의 양을 비교할 때 쓰는 말은 무엇일까요?', choices:['많다, 적다','길다, 짧다','넓다, 좁다'], a:'많다, 적다', hint:'컵에 담긴 물을 비교할 때' },
  { id:'r_ma1_4_05', unitId:'ma1-4', type:'choice', cat:'word', level:1, q:'코끼리와 토끼 중 더 무거운 동물은 무엇일까요?', choices:['코끼리','토끼','똑같다'], a:'코끼리', hint:'몸집이 훨씬 커요' },
  { id:'r_ma1_4_06', unitId:'ma1-4', type:'choice', cat:'word', level:1, q:'기린과 강아지 중 키가 더 작은 동물은 무엇일까요?', choices:['강아지','기린','똑같다'], a:'강아지', hint:'기린은 목이 아주 길어요' },
  { id:'r_ma1_4_07', unitId:'ma1-4', type:'choice', cat:'word', level:1, q:'운동장과 교실 중 더 넓은 곳은 어디일까요?', choices:['운동장','교실','똑같다'], a:'운동장', hint:'많은 친구가 뛰어놀 수 있는 곳' },
  { id:'r_ma1_4_08', unitId:'ma1-4', type:'choice', cat:'word', level:2, q:'똑같은 컵 두 개에 물을 담았어요. 한 컵은 가득, 다른 컵은 반만 담았어요. 물이 더 많은 컵은?', choices:['가득 찬 컵','반만 찬 컵','똑같다'], a:'가득 찬 컵', hint:'컵 크기가 같으니 높이가 높을수록 많아요' },
  { id:'r_ma1_4_09', unitId:'ma1-4', type:'choice', cat:'concept', level:2, q:'두 줄의 길이를 바르게 비교하는 방법은 무엇일까요?', choices:['한쪽 끝을 맞추어 나란히 놓고 비교한다','아무 데나 놓고 눈으로만 본다','길이는 비교할 수 없다'], a:'한쪽 끝을 맞추어 나란히 놓고 비교한다', hint:'시작점을 같게 해야 공평해요' },
  { id:'r_ma1_4_10', unitId:'ma1-4', type:'short', cat:'concept', level:2, q:'시소를 탈 때 아래로 내려간 쪽에 앉은 사람은 더 (무겁다 / 가볍다) 중 어느 쪽일까요?', a:'무겁다', hint:'무거운 쪽이 내려가요' },
  { id:'r_ma1_4_11', unitId:'ma1-4', type:'choice', cat:'word', level:2, q:'민수는 지우보다 키가 크고, 지우는 하은이보다 키가 커요. 키가 가장 작은 사람은 누구일까요?', choices:['하은','민수','지우'], a:'하은', hint:'민수 > 지우 > 하은' },

  // ── 1-5. 50까지의 수 ─────────────────────────
  { id:'r_ma1_5_01', unitId:'ma1-5', type:'number', cat:'concept', level:1, q:'10개씩 묶음 1개는 얼마일까요?', a:'10', hint:'낱개 10개를 묶으면 십이에요', fig:{ kind:'blocks', hundreds:0, tens:1, ones:0 } },
  { id:'r_ma1_5_02', unitId:'ma1-5', type:'number', cat:'concept', level:1, q:'그림이 나타내는 수는 무엇일까요?', a:'23', hint:'10개씩 묶음 2개와 낱개 3개', fig:{ kind:'blocks', hundreds:0, tens:2, ones:3 } },
  { id:'r_ma1_5_03', unitId:'ma1-5', type:'number', cat:'concept', level:1, q:'그림이 나타내는 수는 무엇일까요?', a:'41', hint:'10개씩 묶음 4개와 낱개 1개', fig:{ kind:'blocks', hundreds:0, tens:4, ones:1 } },
  { id:'r_ma1_5_04', unitId:'ma1-5', type:'number', cat:'calc', level:1, q:'10개씩 묶음 3개와 낱개 5개인 수는 무엇일까요?', a:'35', hint:'30과 5' },
  { id:'r_ma1_5_05', unitId:'ma1-5', type:'number', cat:'concept', level:1, q:'"서른둘"을 숫자로 쓰면 무엇일까요?', a:'32', hint:'서른 = 30, 둘 = 2' },
  { id:'r_ma1_5_06', unitId:'ma1-5', type:'number', cat:'calc', level:1, q:'19보다 1만큼 더 큰 수는 무엇일까요?', a:'20', hint:'19 다음에 오는 수예요' },
  { id:'r_ma1_5_07', unitId:'ma1-5', type:'choice', cat:'concept', level:2, q:'다음 중 가장 큰 수는 무엇일까요?', choices:['38','29','41','17'], a:'41', hint:'10개씩 묶음의 수부터 비교해요' },
  { id:'r_ma1_5_08', unitId:'ma1-5', type:'number', cat:'calc', level:2, q:'10, 20, 30, □, 50 에서 □에 알맞은 수는?', a:'40', hint:'10씩 커져요' },
  { id:'r_ma1_5_09', unitId:'ma1-5', type:'number', cat:'concept', level:2, q:'45는 10개씩 묶음이 몇 개일까요?', a:'4', hint:'45 = 40 + 5' },
  { id:'r_ma1_5_10', unitId:'ma1-5', type:'number', cat:'word', level:2, q:'구슬을 10개씩 묶었더니 2묶음이 되고 7개가 남았어요. 구슬은 모두 몇 개일까요?', a:'27', hint:'20 + 7' },
  { id:'r_ma1_5_11', unitId:'ma1-5', type:'number', cat:'concept', level:2, q:'30과 32 사이에 있는 수는 무엇일까요?', a:'31', hint:'30, □, 32' },

  // ── 1-6. 100까지의 수 ────────────────────────
  { id:'r_ma1_6_01', unitId:'ma1-6', type:'number', cat:'concept', level:1, q:'그림이 나타내는 수는 무엇일까요?', a:'64', hint:'10개씩 묶음 6개와 낱개 4개', fig:{ kind:'blocks', hundreds:0, tens:6, ones:4 } },
  { id:'r_ma1_6_02', unitId:'ma1-6', type:'number', cat:'calc', level:1, q:'10개씩 묶음 7개는 얼마일까요?', a:'70', hint:'10, 20, 30 … 하고 7번 세어요' },
  { id:'r_ma1_6_03', unitId:'ma1-6', type:'number', cat:'calc', level:1, q:'99보다 1만큼 더 큰 수는 무엇일까요?', a:'100', hint:'99 다음은 백이에요' },
  { id:'r_ma1_6_04', unitId:'ma1-6', type:'choice', cat:'concept', level:1, q:'다음 중 가장 큰 수는 무엇일까요?', choices:['68','86','79'], a:'86', hint:'10개씩 묶음의 수가 큰 쪽이 커요' },
  { id:'r_ma1_6_05', unitId:'ma1-6', type:'choice', cat:'concept', level:1, q:'다음 중 가장 작은 수는 무엇일까요?', choices:['53','35','52','57'], a:'35', hint:'10개씩 묶음의 수가 작은 쪽이 작아요' },
  { id:'r_ma1_6_06', unitId:'ma1-6', type:'number', cat:'calc', level:2, q:'57, 58, 59, □ 에서 □에 알맞은 수는?', a:'60', hint:'59 다음에 오는 수' },
  { id:'r_ma1_6_07', unitId:'ma1-6', type:'number', cat:'calc', level:2, q:'43, 53, 63, □ 에서 □에 알맞은 수는?', a:'73', hint:'10씩 커져요' },
  { id:'r_ma1_6_08', unitId:'ma1-6', type:'choice', cat:'concept', level:2, q:'다음 중 짝수는 무엇일까요?', choices:['14','9','21'], a:'14', hint:'둘씩 짝을 지었을 때 남는 것이 없는 수' },
  { id:'r_ma1_6_09', unitId:'ma1-6', type:'choice', cat:'concept', level:2, q:'다음 중 홀수는 무엇일까요?', choices:['17','8','20','4'], a:'17', hint:'둘씩 짝을 지었을 때 하나가 남는 수' },
  { id:'r_ma1_6_10', unitId:'ma1-6', type:'number', cat:'concept', level:2, q:'76에서 낱개의 수는 몇일까요?', a:'6', hint:'10개씩 묶음 7개, 낱개 □개' },
  { id:'r_ma1_6_11', unitId:'ma1-6', type:'number', cat:'word', level:2, q:'색종이 100장을 10장씩 묶으면 몇 묶음이 될까요?', a:'10', hint:'100은 10이 10개인 수예요' },

  // ── 1-7. 덧셈과 뺄셈(2) ──────────────────────
  { id:'r_ma1_7_01', unitId:'ma1-7', type:'number', cat:'calc', level:1, q:'20 + 30 = ?', a:'50', hint:'10개씩 묶음 2개 + 3개' },
  { id:'r_ma1_7_02', unitId:'ma1-7', type:'number', cat:'calc', level:1, q:'45 + 3 = ?', a:'48', hint:'낱개끼리 더해요. 5 + 3' },
  { id:'r_ma1_7_03', unitId:'ma1-7', type:'number', cat:'calc', level:1, q:'57 − 4 = ?', a:'53', hint:'낱개끼리 빼요. 7 − 4' },
  { id:'r_ma1_7_04', unitId:'ma1-7', type:'number', cat:'calc', level:1, q:'60 − 20 = ?', a:'40', hint:'10개씩 묶음 6개 − 2개' },
  { id:'r_ma1_7_05', unitId:'ma1-7', type:'number', cat:'calc', level:1, q:'2 + 3 + 4 = ?', a:'9', hint:'앞에서부터 차례로. 2 + 3 = 5, 5 + 4' },
  { id:'r_ma1_7_06', unitId:'ma1-7', type:'number', cat:'calc', level:1, q:'9 − 2 − 3 = ?', a:'4', hint:'9 − 2 = 7, 7 − 3' },
  { id:'r_ma1_7_07', unitId:'ma1-7', type:'number', cat:'calc', level:1, q:'7 + 3 = ?', a:'10', hint:'7과 3을 모으면 10' },
  { id:'r_ma1_7_08', unitId:'ma1-7', type:'number', cat:'calc', level:1, q:'10 − 6 = ?', a:'4', hint:'10은 6과 몇으로 가를 수 있을까요?' },
  { id:'r_ma1_7_09', unitId:'ma1-7', type:'choice', cat:'concept', level:2, q:'합이 10이 되는 식은 무엇일까요?', choices:['6 + 4','5 + 3','7 + 2'], a:'6 + 4', hint:'10이 되는 두 수 짝을 떠올려요' },
  { id:'r_ma1_7_10', unitId:'ma1-7', type:'number', cat:'calc', level:2, q:'8 + 5 = ?', a:'13', hint:'8 + 2 = 10, 10 + 3' },
  { id:'r_ma1_7_11', unitId:'ma1-7', type:'number', cat:'calc', level:2, q:'14 − 6 = ?', a:'8', hint:'14 − 4 = 10, 10 − 2' },
  { id:'r_ma1_7_12', unitId:'ma1-7', type:'number', cat:'word', level:2, q:'바구니에 사과 32개와 배 15개가 있어요. 과일은 모두 몇 개일까요?', a:'47', hint:'32 + 15' },
  { id:'r_ma1_7_13', unitId:'ma1-7', type:'number', cat:'word', level:2, q:'색종이 48장 중에서 25장을 사용했어요. 남은 색종이는 몇 장일까요?', a:'23', hint:'48 − 25' },

  // ── 1-8. 시계 보기와 규칙 찾기 ───────────────
  { id:'r_ma1_8_01', unitId:'ma1-8', type:'choice', cat:'concept', level:1, q:'시계가 나타내는 시각은 몇 시일까요?', choices:['3시','12시','6시'], a:'3시', hint:'긴바늘이 12, 짧은바늘이 3', fig:{ kind:'clock', h:3, m:0 } },
  { id:'r_ma1_8_02', unitId:'ma1-8', type:'choice', cat:'concept', level:1, q:'시계가 나타내는 시각은 몇 시일까요?', choices:['7시','8시','5시'], a:'7시', hint:'짧은바늘이 가리키는 숫자를 읽어요', fig:{ kind:'clock', h:7, m:0 } },
  { id:'r_ma1_8_03', unitId:'ma1-8', type:'choice', cat:'concept', level:1, q:'시계가 나타내는 시각은 무엇일까요?', choices:['9시 30분','10시 30분','9시'], a:'9시 30분', hint:'긴바늘이 6이면 30분. 짧은바늘은 9와 10 사이', fig:{ kind:'clock', h:9, m:30 } },
  { id:'r_ma1_8_04', unitId:'ma1-8', type:'choice', cat:'concept', level:1, q:'시계가 나타내는 시각은 무엇일까요?', choices:['1시 30분','2시 30분','6시'], a:'1시 30분', hint:'짧은바늘이 1과 2 사이에 있으면 아직 1시예요', fig:{ kind:'clock', h:1, m:30 } },
  { id:'r_ma1_8_05', unitId:'ma1-8', type:'number', cat:'concept', level:1, q:'시계의 짧은바늘이 가리키는 숫자는 무엇일까요?', a:'11', hint:'짧은바늘은 "시"를 가리켜요', fig:{ kind:'clock', h:11, m:0 } },
  { id:'r_ma1_8_06', unitId:'ma1-8', type:'choice', cat:'concept', level:2, q:'시계의 긴바늘이 가리키는 숫자는 무엇일까요?', choices:['6','12','4'], a:'6', hint:'30분일 때 긴바늘은 아래쪽을 가리켜요', fig:{ kind:'clock', h:4, m:30 } },
  { id:'r_ma1_8_07', unitId:'ma1-8', type:'choice', cat:'concept', level:2, q:'긴바늘이 12를 가리키고 있을 때는 몇 분일까요?', choices:['0분 (정각)','30분','12분'], a:'0분 (정각)', hint:'"몇 시" 라고만 읽어요' },
  { id:'r_ma1_8_08', unitId:'ma1-8', type:'choice', cat:'concept', level:2, q:'시계가 나타내는 시각은 무엇일까요?', choices:['12시 30분','1시 30분','6시'], a:'12시 30분', hint:'짧은바늘이 12와 1 사이', fig:{ kind:'clock', h:12, m:30 } },
  { id:'r_ma1_8_09', unitId:'ma1-8', type:'choice', cat:'concept', level:1, q:'규칙에 따라 다음에 올 모양은 무엇일까요?', choices:['세모','동그라미','네모'], a:'세모', hint:'동그라미, 세모가 반복돼요', fig:{ kind:'shapes', items:['circle','triangle','circle','triangle','circle'] } },
  { id:'r_ma1_8_10', unitId:'ma1-8', type:'choice', cat:'concept', level:1, q:'규칙에 따라 다음에 올 모양은 무엇일까요?', choices:['별','하트','동그라미'], a:'별', hint:'별, 하트, 하트가 반복돼요', fig:{ kind:'shapes', items:['star','heart','heart','star','heart','heart'] } },
  { id:'r_ma1_8_11', unitId:'ma1-8', type:'number', cat:'calc', level:1, q:'2, 4, 6, 8, □ 에서 □에 알맞은 수는?', a:'10', hint:'2씩 커져요' },
  { id:'r_ma1_8_12', unitId:'ma1-8', type:'number', cat:'calc', level:2, q:'5, 10, 15, □ 에서 □에 알맞은 수는?', a:'20', hint:'5씩 커져요' },
  { id:'r_ma1_8_13', unitId:'ma1-8', type:'number', cat:'calc', level:2, q:'30, 25, 20, 15, □ 에서 □에 알맞은 수는?', a:'10', hint:'5씩 작아져요' },

  // ══════════ 2학년 ══════════
  // ── 2-1. 세 자리 수 ──────────────────────────
  { id:'r_ma2_1_01', unitId:'ma2-1', type:'number', cat:'concept', level:1, q:'백 모형 1개가 나타내는 수는 무엇일까요?', a:'100', hint:'10이 10개 모이면 100', fig:{ kind:'blocks', hundreds:1, tens:0, ones:0 } },
  { id:'r_ma2_1_02', unitId:'ma2-1', type:'number', cat:'concept', level:1, q:'그림이 나타내는 수는 무엇일까요?', a:'234', hint:'백 2개, 십 3개, 일 4개', fig:{ kind:'blocks', hundreds:2, tens:3, ones:4 } },
  { id:'r_ma2_1_03', unitId:'ma2-1', type:'number', cat:'concept', level:1, q:'그림이 나타내는 수는 무엇일까요?', a:'305', hint:'십 모형이 없으면 십의 자리에 0을 써요', fig:{ kind:'blocks', hundreds:3, tens:0, ones:5 } },
  { id:'r_ma2_1_04', unitId:'ma2-1', type:'number', cat:'calc', level:1, q:'100이 4개, 10이 6개, 1이 2개인 수는 무엇일까요?', a:'462', hint:'400 + 60 + 2' },
  { id:'r_ma2_1_05', unitId:'ma2-1', type:'number', cat:'concept', level:1, q:'"오백삼십"을 숫자로 쓰면 무엇일까요?', a:'530', hint:'오백 = 500, 삼십 = 30' },
  { id:'r_ma2_1_06', unitId:'ma2-1', type:'number', cat:'concept', level:2, q:'573에서 십의 자리 숫자는 무엇일까요?', a:'7', hint:'오른쪽부터 일, 십, 백의 자리' },
  { id:'r_ma2_1_07', unitId:'ma2-1', type:'number', cat:'concept', level:2, q:'573에서 숫자 5가 나타내는 값은 얼마일까요?', a:'500', hint:'5는 백의 자리에 있어요' },
  { id:'r_ma2_1_08', unitId:'ma2-1', type:'choice', cat:'concept', level:2, q:'다음 중 가장 큰 수는 무엇일까요?', choices:['489','498','479','394'], a:'498', hint:'백의 자리가 같으면 십의 자리를 비교해요' },
  { id:'r_ma2_1_09', unitId:'ma2-1', type:'number', cat:'calc', level:2, q:'350, 450, 550, □ 에서 □에 알맞은 수는?', a:'650', hint:'100씩 뛰어 세고 있어요' },
  { id:'r_ma2_1_10', unitId:'ma2-1', type:'number', cat:'calc', level:2, q:'780, 790, □ 에서 □에 알맞은 수는?', a:'800', hint:'10씩 뛰어 세면 790 다음은?' },
  { id:'r_ma2_1_11', unitId:'ma2-1', type:'number', cat:'calc', level:2, q:'351과 349 중 더 큰 수는 무엇일까요?', a:'351', hint:'십의 자리 5와 4를 비교해요' },
  { id:'r_ma2_1_12', unitId:'ma2-1', type:'number', cat:'calc', level:3, q:'999보다 1만큼 더 큰 수는 무엇일까요?', a:'1000', hint:'세 자리 수 중 가장 큰 수 다음은 천' },

  // ── 2-2. 여러 가지 도형 ───────────────────────
  { id:'r_ma2_2_01', unitId:'ma2-2', type:'choice', cat:'concept', level:1, q:'이 도형의 이름은 무엇일까요?', choices:['삼각형','사각형','원'], a:'삼각형', hint:'변이 3개예요', fig:{ kind:'polygon', n:3, shape:'iso' } },
  { id:'r_ma2_2_02', unitId:'ma2-2', type:'choice', cat:'concept', level:1, q:'이 도형의 이름은 무엇일까요?', choices:['사각형','삼각형','오각형'], a:'사각형', hint:'변이 4개예요', fig:{ kind:'polygon', n:4 } },
  { id:'r_ma2_2_03', unitId:'ma2-2', type:'choice', cat:'concept', level:1, q:'이 도형의 이름은 무엇일까요?', choices:['원','삼각형','사각형'], a:'원', hint:'어느 방향에서 봐도 똑같이 둥글어요', fig:{ kind:'shapes', items:['circle'] } },
  { id:'r_ma2_2_04', unitId:'ma2-2', type:'number', cat:'concept', level:1, q:'이 도형의 변은 몇 개일까요?', a:'3', hint:'곧은 선을 세어 보세요', fig:{ kind:'polygon', n:3, shape:'equi' } },
  { id:'r_ma2_2_05', unitId:'ma2-2', type:'number', cat:'concept', level:1, q:'이 도형의 꼭짓점은 몇 개일까요?', a:'4', hint:'변과 변이 만나는 점을 세어요', fig:{ kind:'polygon', n:4 } },
  { id:'r_ma2_2_06', unitId:'ma2-2', type:'choice', cat:'concept', level:1, q:'이 도형의 이름은 무엇일까요?', choices:['오각형','육각형','사각형'], a:'오각형', hint:'변이 5개면 오각형', fig:{ kind:'polygon', n:5 } },
  { id:'r_ma2_2_07', unitId:'ma2-2', type:'number', cat:'concept', level:2, q:'이 도형의 변은 몇 개일까요?', a:'6', hint:'육각형의 "육"은 6이에요', fig:{ kind:'polygon', n:6 } },
  { id:'r_ma2_2_08', unitId:'ma2-2', type:'choice', cat:'concept', level:2, q:'원의 특징으로 알맞은 것은 무엇일까요?', choices:['곧은 선이 없고 둥글다','변이 3개이다','꼭짓점이 4개이다'], a:'곧은 선이 없고 둥글다', hint:'원에는 변과 꼭짓점이 없어요' },
  { id:'r_ma2_2_09', unitId:'ma2-2', type:'number', cat:'concept', level:2, q:'그림에서 사각형은 모두 몇 개일까요?', a:'2', hint:'변이 4개인 도형을 찾아요. 정사각형도 사각형이에요', fig:{ kind:'shapes', items:['triangle','square','circle','rect'] } },
  { id:'r_ma2_2_10', unitId:'ma2-2', type:'number', cat:'word', level:2, q:'쌓기나무를 1층에 3개, 2층에 1개 쌓았어요. 쌓기나무는 모두 몇 개일까요?', a:'4', hint:'3 + 1' },
  { id:'r_ma2_2_11', unitId:'ma2-2', type:'number', cat:'concept', level:2, q:'삼각형의 꼭짓점 수와 사각형의 꼭짓점 수를 더하면 몇일까요?', a:'7', hint:'3 + 4' },
  { id:'r_ma2_2_12', unitId:'ma2-2', type:'choice', cat:'concept', level:3, q:'변이 5개, 꼭짓점이 5개인 도형은 무엇일까요?', choices:['오각형','사각형','육각형','삼각형'], a:'오각형', hint:'변의 수와 이름이 같아요' },
  { id:'r_ma2_2_13', unitId:'ma2-2', type:'choice', cat:'concept', level:3, q:'왼쪽 ㄴ 모양을 오른쪽으로 뒤집으면 물음표 자리에는 어떤 모양이 될까요?', choices:['왼쪽과 오른쪽이 바뀐 모양','위와 아래가 바뀐 모양','처음과 똑같은 모양'], a:'왼쪽과 오른쪽이 바뀐 모양', hint:'거울에 비친 모습을 떠올려요', fig:{ kind:'move', shape:'L', op:'?' } },
  { id:'r_ma2_2_14', unitId:'ma2-2', type:'choice', cat:'concept', level:3, q:'왼쪽 F 모양을 위쪽으로 뒤집으면 물음표 자리에는 어떤 모양이 될까요?', choices:['위와 아래가 바뀐 모양','왼쪽과 오른쪽이 바뀐 모양','처음과 똑같은 모양'], a:'위와 아래가 바뀐 모양', hint:'물에 비친 모습을 떠올려요', fig:{ kind:'move', shape:'F', op:'?' } },

  // ── 2-3. 덧셈과 뺄셈 ─────────────────────────
  { id:'r_ma2_3_01', unitId:'ma2-3', type:'number', cat:'calc', level:1, q:'27 + 15 = ?', a:'42', hint:'7 + 5 = 12, 십의 자리로 1 올려요' },
  { id:'r_ma2_3_02', unitId:'ma2-3', type:'number', cat:'calc', level:1, q:'46 + 38 = ?', a:'84', hint:'6 + 8 = 14 → 4 쓰고 1 올림' },
  { id:'r_ma2_3_03', unitId:'ma2-3', type:'number', cat:'calc', level:1, q:'52 − 17 = ?', a:'35', hint:'2에서 7을 뺄 수 없으니 십의 자리에서 10을 받아내려요' },
  { id:'r_ma2_3_04', unitId:'ma2-3', type:'number', cat:'calc', level:1, q:'73 − 45 = ?', a:'28', hint:'13 − 5 = 8, 6 − 4 = 2' },
  { id:'r_ma2_3_05', unitId:'ma2-3', type:'number', cat:'calc', level:2, q:'64 + 29 = ?', a:'93', hint:'64 + 30 − 1' },
  { id:'r_ma2_3_06', unitId:'ma2-3', type:'number', cat:'calc', level:2, q:'90 − 36 = ?', a:'54', hint:'90 − 30 = 60, 60 − 6' },
  { id:'r_ma2_3_07', unitId:'ma2-3', type:'number', cat:'word', level:2, q:'문구점에서 연필 35자루와 지우개 27개를 샀어요. 산 물건은 모두 몇 개일까요?', a:'62', hint:'35 + 27' },
  { id:'r_ma2_3_08', unitId:'ma2-3', type:'number', cat:'word', level:2, q:'책 81권 중 46권을 빌려 갔어요. 남은 책은 몇 권일까요?', a:'35', hint:'81 − 46' },
  { id:'r_ma2_3_09', unitId:'ma2-3', type:'number', cat:'calc', level:2, q:'□ + 18 = 40 에서 □에 알맞은 수는?', a:'22', hint:'40 − 18' },
  { id:'r_ma2_3_10', unitId:'ma2-3', type:'number', cat:'calc', level:2, q:'25 + 13 − 8 = ?', a:'30', hint:'앞에서부터 차례로. 25 + 13 = 38' },
  { id:'r_ma2_3_11', unitId:'ma2-3', type:'choice', cat:'concept', level:2, q:'52 − 17 = 35 가 맞는지 확인하는 덧셈식은 무엇일까요?', choices:['35 + 17 = 52','52 + 17 = 69','35 − 17 = 18'], a:'35 + 17 = 52', hint:'뺄셈 결과에 뺀 수를 다시 더해 봐요' },
  { id:'r_ma2_3_12', unitId:'ma2-3', type:'number', cat:'calc', level:3, q:'58 + 36 − 29 = ?', a:'65', hint:'58 + 36 = 94, 94 − 29' },

  // ── 2-4. 길이 재기 ───────────────────────────
  { id:'r_ma2_4_01', unitId:'ma2-4', type:'number', cat:'concept', level:1, q:'자로 잰 연필의 길이는 몇 cm일까요? (숫자만)', a:'5', hint:'0에서 시작해서 끝이 가리키는 눈금을 읽어요', fig:{ kind:'ruler', len:5, unit:'cm' } },
  { id:'r_ma2_4_02', unitId:'ma2-4', type:'number', cat:'concept', level:1, q:'자로 잰 물건의 길이는 몇 cm일까요? (숫자만)', a:'8', hint:'끝이 8 눈금에 닿아 있어요', fig:{ kind:'ruler', len:8, unit:'cm' } },
  { id:'r_ma2_4_03', unitId:'ma2-4', type:'number', cat:'concept', level:1, q:'자로 잰 물건의 길이는 몇 cm일까요? (숫자만)', a:'12', hint:'10을 넘어 두 칸 더', fig:{ kind:'ruler', len:12, unit:'cm' } },
  { id:'r_ma2_4_04', unitId:'ma2-4', type:'choice', cat:'concept', level:1, q:'자의 큰 눈금 한 칸의 길이를 바르게 읽은 것은 무엇일까요?', choices:['1 센티미터','1 미터','1 킬로그램'], a:'1 센티미터', hint:'cm 는 센티미터라고 읽어요', fig:{ kind:'ruler', len:1, unit:'cm' } },
  { id:'r_ma2_4_05', unitId:'ma2-4', type:'number', cat:'concept', level:2, q:'1 m 는 몇 cm 일까요? (숫자만)', a:'100', hint:'1 m = 100 cm' },
  { id:'r_ma2_4_06', unitId:'ma2-4', type:'number', cat:'calc', level:2, q:'3 m 는 몇 cm 일까요? (숫자만)', a:'300', hint:'100 cm 가 3개' },
  { id:'r_ma2_4_07', unitId:'ma2-4', type:'number', cat:'calc', level:2, q:'150 cm 는 1 m □ cm 입니다. □에 알맞은 수는?', a:'50', hint:'150 − 100' },
  { id:'r_ma2_4_08', unitId:'ma2-4', type:'number', cat:'word', level:2, q:'그림의 크레파스는 6 cm 이고 지우개는 4 cm 예요. 두 길이를 합하면 몇 cm 일까요? (숫자만)', a:'10', hint:'6 + 4', fig:{ kind:'ruler', len:6, unit:'cm' } },
  { id:'r_ma2_4_09', unitId:'ma2-4', type:'number', cat:'word', level:2, q:'그림의 막대 끝에 12 cm 막대를 이어 붙이면 전체 길이는 몇 cm 일까요? (숫자만)', a:'27', hint:'15 + 12', fig:{ kind:'ruler', len:15, unit:'cm' } },
  { id:'r_ma2_4_10', unitId:'ma2-4', type:'number', cat:'calc', level:2, q:'60 cm − 25 cm = □ cm. □에 알맞은 수는?', a:'35', hint:'60 − 25' },
  { id:'r_ma2_4_11', unitId:'ma2-4', type:'choice', cat:'concept', level:2, q:'교실 칠판의 긴 쪽 길이를 재기에 알맞은 단위는 무엇일까요?', choices:['m','cm','둘 다 알맞지 않다'], a:'m', hint:'긴 길이는 큰 단위로 재요' },
  { id:'r_ma2_4_12', unitId:'ma2-4', type:'number', cat:'word', level:3, q:'그림의 막대 길이의 2배는 몇 cm 일까요? (숫자만)', a:'18', hint:'9 + 9', fig:{ kind:'ruler', len:9, unit:'cm' } },

  // ── 2-5. 분류하기 ────────────────────────────
  { id:'r_ma2_5_01', unitId:'ma2-5', type:'choice', cat:'concept', level:1, q:'물건을 나눌 때 분류 기준으로 알맞은 것은 무엇일까요?', choices:['색깔','예쁜 것','좋아하는 것'], a:'색깔', hint:'누가 봐도 똑같이 나눌 수 있어야 해요' },
  { id:'r_ma2_5_02', unitId:'ma2-5', type:'choice', cat:'concept', level:1, q:'분류 기준으로 알맞지 않은 것은 무엇일까요?', choices:['맛있는 것','모양','크기'], a:'맛있는 것', hint:'사람마다 다르게 느끼는 것은 기준이 될 수 없어요' },
  { id:'r_ma2_5_03', unitId:'ma2-5', type:'number', cat:'concept', level:1, q:'모양에 따라 분류했을 때 동그라미 묶음에는 몇 개가 들어갈까요?', a:'3', hint:'둥근 모양만 세어요', fig:{ kind:'shapes', items:['circle','triangle','circle','square','circle','triangle'] } },
  { id:'r_ma2_5_04', unitId:'ma2-5', type:'number', cat:'concept', level:1, q:'모양에 따라 분류했을 때 별 묶음에는 몇 개가 들어갈까요?', a:'3', hint:'별 모양만 세어요', fig:{ kind:'shapes', items:['star','heart','star','star','heart'] } },
  { id:'r_ma2_5_05', unitId:'ma2-5', type:'choice', cat:'word', level:2, q:'참새, 독수리, 오리, 토끼를 "날개가 있는 동물"로 분류할 때 들어가지 않는 것은?', choices:['토끼','참새','오리'], a:'토끼', hint:'날개 대신 긴 귀가 있어요' },
  { id:'r_ma2_5_06', unitId:'ma2-5', type:'choice', cat:'word', level:2, q:'색연필을 색깔별로 세었더니 빨강 4자루, 파랑 3자루, 노랑 5자루였어요. 가장 많은 색은?', choices:['노랑','빨강','파랑'], a:'노랑', hint:'5가 가장 큰 수' },
  { id:'r_ma2_5_07', unitId:'ma2-5', type:'number', cat:'word', level:2, q:'빨강 4자루, 파랑 3자루, 노랑 5자루인 색연필은 모두 몇 자루일까요?', a:'12', hint:'4 + 3 + 5' },
  { id:'r_ma2_5_08', unitId:'ma2-5', type:'choice', cat:'concept', level:2, q:'사과, 바나나, 당근, 오이를 두 묶음으로 나누었어요. 어떤 기준으로 나눈 걸까요?', choices:['과일과 채소','빨간 것과 노란 것','긴 것과 짧은 것'], a:'과일과 채소', hint:'사과·바나나 / 당근·오이' },
  { id:'r_ma2_5_09', unitId:'ma2-5', type:'number', cat:'word', level:2, q:'우리 반을 분류해 세었더니 남학생 12명, 여학생 14명이에요. 여학생은 남학생보다 몇 명 더 많을까요?', a:'2', hint:'14 − 12' },
  { id:'r_ma2_5_10', unitId:'ma2-5', type:'choice', cat:'concept', level:3, q:'분류하여 수를 세면 좋은 점은 무엇일까요?', choices:['어떤 것이 많고 적은지 쉽게 알 수 있다','계산을 하지 않아도 된다','자료가 줄어든다'], a:'어떤 것이 많고 적은지 쉽게 알 수 있다', hint:'종류별로 나누면 비교가 쉬워요' },

  // ── 2-6. 곱셈 ────────────────────────────────
  { id:'r_ma2_6_01', unitId:'ma2-6', type:'number', cat:'calc', level:1, q:'사탕이 2줄에 3개씩 놓여 있어요. 사탕은 모두 몇 개일까요?', a:'6', hint:'3 + 3 또는 2 × 3', fig:{ kind:'grid', rows:2, cols:3 } },
  { id:'r_ma2_6_02', unitId:'ma2-6', type:'number', cat:'calc', level:1, q:'구슬이 3줄에 4개씩 놓여 있어요. 구슬은 모두 몇 개일까요?', a:'12', hint:'4 + 4 + 4', fig:{ kind:'grid', rows:3, cols:4 } },
  { id:'r_ma2_6_03', unitId:'ma2-6', type:'number', cat:'calc', level:1, q:'그림의 점은 모두 몇 개일까요?', a:'20', hint:'5개씩 4줄', fig:{ kind:'grid', rows:4, cols:5 } },
  { id:'r_ma2_6_04', unitId:'ma2-6', type:'choice', cat:'concept', level:1, q:'3 + 3 + 3 + 3 을 곱셈식으로 바르게 나타낸 것은?', choices:['3 × 4','3 + 4','4 × 4'], a:'3 × 4', hint:'3을 4번 더했어요' },
  { id:'r_ma2_6_05', unitId:'ma2-6', type:'number', cat:'calc', level:1, q:'2 × 5 = ?', a:'10', hint:'2씩 5번' },
  { id:'r_ma2_6_06', unitId:'ma2-6', type:'number', cat:'calc', level:2, q:'5씩 3묶음은 모두 얼마일까요?', a:'15', hint:'5, 10, 15' },
  { id:'r_ma2_6_07', unitId:'ma2-6', type:'number', cat:'concept', level:2, q:'그림처럼 5의 2배는 얼마일까요?', a:'10', hint:'5씩 2줄', fig:{ kind:'grid', rows:2, cols:5 } },
  { id:'r_ma2_6_08', unitId:'ma2-6', type:'number', cat:'word', level:2, q:'자전거 한 대에 바퀴가 2개씩 있어요. 자전거 4대의 바퀴는 모두 몇 개일까요?', a:'8', hint:'2 × 4' },
  { id:'r_ma2_6_09', unitId:'ma2-6', type:'number', cat:'calc', level:2, q:'6의 3배는 얼마일까요?', a:'18', hint:'6 + 6 + 6' },
  { id:'r_ma2_6_10', unitId:'ma2-6', type:'choice', cat:'concept', level:2, q:'4 × 3 과 값이 같은 식은 무엇일까요?', choices:['3 × 4','4 + 3','4 × 4'], a:'3 × 4', hint:'곱하는 순서를 바꿔도 결과는 같아요' },
  { id:'r_ma2_6_11', unitId:'ma2-6', type:'number', cat:'concept', level:2, q:'그림의 점은 모두 몇 개일까요?', a:'9', hint:'3씩 3줄', fig:{ kind:'grid', rows:3, cols:3 } },
  { id:'r_ma2_6_12', unitId:'ma2-6', type:'number', cat:'word', level:3, q:'한 상자에 귤이 6개씩 들어 있어요. 5상자에 든 귤은 모두 몇 개일까요?', a:'30', hint:'6 × 5' },

  // ── 2-7. 네 자리 수 ──────────────────────────
  { id:'r_ma2_7_01', unitId:'ma2-7', type:'number', cat:'calc', level:1, q:'1000이 3개인 수는 무엇일까요?', a:'3000', hint:'천, 이천, 삼천' },
  { id:'r_ma2_7_02', unitId:'ma2-7', type:'number', cat:'calc', level:1, q:'1000이 2개, 100이 5개, 10이 4개, 1이 7개인 수는 무엇일까요?', a:'2547', hint:'2000 + 500 + 40 + 7' },
  { id:'r_ma2_7_03', unitId:'ma2-7', type:'number', cat:'concept', level:1, q:'"사천삼백"을 숫자로 쓰면 무엇일까요?', a:'4300', hint:'십의 자리와 일의 자리는 0' },
  { id:'r_ma2_7_04', unitId:'ma2-7', type:'number', cat:'concept', level:2, q:'6285에서 천의 자리 숫자는 무엇일까요?', a:'6', hint:'네 자리 수의 맨 앞자리' },
  { id:'r_ma2_7_05', unitId:'ma2-7', type:'number', cat:'concept', level:2, q:'6285에서 숫자 2가 나타내는 값은 얼마일까요?', a:'200', hint:'2는 백의 자리에 있어요' },
  { id:'r_ma2_7_06', unitId:'ma2-7', type:'choice', cat:'concept', level:2, q:'다음 중 가장 큰 수는 무엇일까요?', choices:['4987','5012','4999','5009'], a:'5012', hint:'천의 자리부터 비교해요' },
  { id:'r_ma2_7_07', unitId:'ma2-7', type:'number', cat:'calc', level:2, q:'2500, 3500, □ 에서 □에 알맞은 수는?', a:'4500', hint:'1000씩 뛰어 세고 있어요' },
  { id:'r_ma2_7_08', unitId:'ma2-7', type:'number', cat:'calc', level:2, q:'7800, 7900, □ 에서 □에 알맞은 수는?', a:'8000', hint:'100씩 뛰어 세면 7900 다음은?' },
  { id:'r_ma2_7_09', unitId:'ma2-7', type:'number', cat:'calc', level:2, q:'9999보다 1만큼 더 큰 수는 무엇일까요?', a:'10000', hint:'네 자리 수 중 가장 큰 수 다음은 만' },
  { id:'r_ma2_7_10', unitId:'ma2-7', type:'number', cat:'word', level:2, q:'1000원짜리 지폐 4장과 500원짜리 동전 1개가 있어요. 모두 얼마일까요?', a:'4500', hint:'4000 + 500' },
  { id:'r_ma2_7_11', unitId:'ma2-7', type:'number', cat:'calc', level:3, q:'숫자 카드 1, 4, 7, 9를 한 번씩 써서 만들 수 있는 가장 작은 네 자리 수는?', a:'1479', hint:'작은 숫자를 앞자리부터 놓아요' },

  // ── 2-8. 곱셈구구 ────────────────────────────
  { id:'r_ma2_8_01', unitId:'ma2-8', type:'number', cat:'calc', level:1, q:'3 × 7 = ?', a:'21', hint:'삼칠은 …' },
  { id:'r_ma2_8_02', unitId:'ma2-8', type:'number', cat:'calc', level:1, q:'6 × 8 = ?', a:'48', hint:'육팔은 …' },
  { id:'r_ma2_8_03', unitId:'ma2-8', type:'number', cat:'calc', level:1, q:'9 × 4 = ?', a:'36', hint:'구사는 …' },
  { id:'r_ma2_8_04', unitId:'ma2-8', type:'number', cat:'calc', level:1, q:'7 × 7 = ?', a:'49', hint:'칠칠은 …' },
  { id:'r_ma2_8_05', unitId:'ma2-8', type:'number', cat:'calc', level:1, q:'8 × 5 = ?', a:'40', hint:'5단은 끝자리가 0 또는 5' },
  { id:'r_ma2_8_06', unitId:'ma2-8', type:'number', cat:'concept', level:1, q:'그림의 점은 모두 몇 개일까요? 곱셈구구로 구해 보세요.', a:'24', hint:'6 × 4', fig:{ kind:'grid', rows:6, cols:4 } },
  { id:'r_ma2_8_07', unitId:'ma2-8', type:'number', cat:'calc', level:2, q:'□ × 5 = 35 에서 □에 알맞은 수는?', a:'7', hint:'5단에서 35가 나오는 곳' },
  { id:'r_ma2_8_08', unitId:'ma2-8', type:'number', cat:'calc', level:2, q:'4 × □ = 32 에서 □에 알맞은 수는?', a:'8', hint:'4단에서 32가 나오는 곳' },
  { id:'r_ma2_8_09', unitId:'ma2-8', type:'number', cat:'word', level:2, q:'한 봉지에 젤리가 9개씩 들어 있어요. 6봉지에 든 젤리는 모두 몇 개일까요?', a:'54', hint:'9 × 6' },
  { id:'r_ma2_8_10', unitId:'ma2-8', type:'choice', cat:'concept', level:2, q:'0 × 9 의 값은 얼마일까요?', choices:['0','9','1'], a:'0', hint:'0을 몇 번 더해도 0' },
  { id:'r_ma2_8_11', unitId:'ma2-8', type:'choice', cat:'concept', level:2, q:'1 × (어떤 수) 의 값은 항상 무엇일까요?', choices:['그 수 자신','1','0'], a:'그 수 자신', hint:'1 × 6 = 6, 1 × 9 = 9' },
  { id:'r_ma2_8_12', unitId:'ma2-8', type:'choice', cat:'concept', level:3, q:'7 × 8 에 7을 한 번 더 더한 값과 같은 곱셈식은?', choices:['7 × 9','7 × 7','8 × 8'], a:'7 × 9', hint:'7을 8번 더한 것에 7을 하나 더 → 7을 9번' },

  // ── 2-9. 시각과 시간 ─────────────────────────
  { id:'r_ma2_9_01', unitId:'ma2-9', type:'choice', cat:'concept', level:1, q:'시계가 나타내는 시각은 무엇일까요?', choices:['2시 15분','3시 15분','2시 3분'], a:'2시 15분', hint:'긴바늘이 3이면 15분', fig:{ kind:'clock', h:2, m:15 } },
  { id:'r_ma2_9_02', unitId:'ma2-9', type:'choice', cat:'concept', level:1, q:'시계가 나타내는 시각은 무엇일까요?', choices:['5시 40분','5시 8분','6시 40분'], a:'5시 40분', hint:'긴바늘이 8이면 5 × 8 = 40분', fig:{ kind:'clock', h:5, m:40 } },
  { id:'r_ma2_9_03', unitId:'ma2-9', type:'number', cat:'concept', level:1, q:'시계가 나타내는 시각은 10시 몇 분일까요? (숫자만)', a:'20', hint:'긴바늘이 4를 가리키면 5 × 4', fig:{ kind:'clock', h:10, m:20 } },
  { id:'r_ma2_9_04', unitId:'ma2-9', type:'choice', cat:'concept', level:1, q:'시계가 나타내는 시각은 무엇일까요?', choices:['8시 45분','9시 45분','8시 9분'], a:'8시 45분', hint:'짧은바늘이 9에 가깝지만 아직 8시예요', fig:{ kind:'clock', h:8, m:45 } },
  { id:'r_ma2_9_05', unitId:'ma2-9', type:'choice', cat:'concept', level:2, q:'시계가 나타내는 시각을 "몇 시 몇 분 전"으로 읽으면?', choices:['7시 5분 전','6시 5분 전','7시 55분'], a:'7시 5분 전', hint:'6시 55분은 7시가 되기 5분 전', fig:{ kind:'clock', h:6, m:55 } },
  { id:'r_ma2_9_06', unitId:'ma2-9', type:'number', cat:'concept', level:2, q:'시계의 긴바늘이 가리키는 숫자는 무엇일까요?', a:'1', hint:'5분이면 긴바늘은 12에서 한 칸 간 곳', fig:{ kind:'clock', h:3, m:5 } },
  { id:'r_ma2_9_07', unitId:'ma2-9', type:'number', cat:'concept', level:2, q:'1시간은 몇 분일까요? (숫자만)', a:'60', hint:'긴바늘이 한 바퀴 도는 시간' },
  { id:'r_ma2_9_08', unitId:'ma2-9', type:'number', cat:'concept', level:2, q:'하루는 몇 시간일까요? (숫자만)', a:'24', hint:'오전 12시간 + 오후 12시간' },
  { id:'r_ma2_9_09', unitId:'ma2-9', type:'number', cat:'concept', level:2, q:'1주일은 며칠일까요? (숫자만)', a:'7', hint:'월화수목금토일' },
  { id:'r_ma2_9_10', unitId:'ma2-9', type:'number', cat:'concept', level:2, q:'1년은 몇 개월일까요? (숫자만)', a:'12', hint:'1월부터 12월까지' },
  { id:'r_ma2_9_11', unitId:'ma2-9', type:'number', cat:'word', level:2, q:'9시에 시작한 영화가 10시 30분에 끝났어요. 영화는 몇 분 동안 했을까요? (숫자만)', a:'90', hint:'1시간 30분 = 60분 + 30분' },
  { id:'r_ma2_9_12', unitId:'ma2-9', type:'number', cat:'concept', level:2, q:'시계가 나타내는 시각은 11시 몇 분일까요? (숫자만)', a:'35', hint:'긴바늘이 7을 가리키면 5 × 7', fig:{ kind:'clock', h:11, m:35 } },
  { id:'r_ma2_9_13', unitId:'ma2-9', type:'number', cat:'word', level:3, q:'오전 8시부터 오후 2시까지는 몇 시간일까요? (숫자만)', a:'6', hint:'8시 → 12시(4시간), 12시 → 2시(2시간)' },

  // ── 2-10. 표와 그래프 ────────────────────────
  { id:'r_ma2_10_01', unitId:'ma2-10', type:'choice', cat:'concept', level:1, q:'자료를 표로 나타내면 좋은 점은 무엇일까요?', choices:['항목별 수를 한눈에 알 수 있다','그림이 예뻐진다','자료를 없앨 수 있다'], a:'항목별 수를 한눈에 알 수 있다', hint:'종류별 개수가 정리돼요' },
  { id:'r_ma2_10_02', unitId:'ma2-10', type:'number', cat:'word', level:1, q:'좋아하는 색을 조사했더니 빨강 5명, 파랑 7명, 노랑 3명이었어요. 조사한 학생은 모두 몇 명일까요?', a:'15', hint:'5 + 7 + 3' },
  { id:'r_ma2_10_03', unitId:'ma2-10', type:'choice', cat:'word', level:1, q:'빨강 5명, 파랑 7명, 노랑 3명일 때 가장 많은 학생이 좋아하는 색은?', choices:['파랑','빨강','노랑'], a:'파랑', hint:'7이 가장 큰 수' },
  { id:'r_ma2_10_04', unitId:'ma2-10', type:'number', cat:'word', level:2, q:'파랑 7명, 노랑 3명일 때 파랑을 좋아하는 학생은 노랑보다 몇 명 더 많을까요?', a:'4', hint:'7 − 3' },
  { id:'r_ma2_10_05', unitId:'ma2-10', type:'choice', cat:'concept', level:2, q:'그래프에 ○를 그릴 때 바른 방법은 무엇일까요?', choices:['아래에서 위로 빈칸 없이 차례로 그린다','위에서부터 그린다','아무 칸에나 그린다'], a:'아래에서 위로 빈칸 없이 차례로 그린다', hint:'바닥부터 쌓듯이 그려요' },
  { id:'r_ma2_10_06', unitId:'ma2-10', type:'number', cat:'word', level:2, q:'우리 반 24명 중 축구 9명, 피구 8명을 좋아하고 나머지는 줄넘기를 좋아해요. 줄넘기는 몇 명일까요?', a:'7', hint:'24 − 9 − 8' },
  { id:'r_ma2_10_07', unitId:'ma2-10', type:'choice', cat:'concept', level:2, q:'표와 그래프 중 어느 항목이 가장 많은지 한눈에 비교하기 좋은 것은?', choices:['그래프','표','둘 다 아니다'], a:'그래프', hint:'○의 높이를 비교하면 돼요' },
  { id:'r_ma2_10_08', unitId:'ma2-10', type:'choice', cat:'concept', level:2, q:'표와 그래프 중 전체 합계를 알기 편한 것은?', choices:['표','그래프','둘 다 아니다'], a:'표', hint:'표에는 합계 칸이 있어요' },
  { id:'r_ma2_10_09', unitId:'ma2-10', type:'number', cat:'word', level:2, q:'그래프에서 ○ 한 개는 학생 1명이에요. 사과 칸에 ○가 6개 있으면 사과를 좋아하는 학생은 몇 명일까요?', a:'6', hint:'○ 개수 = 학생 수' },
  { id:'r_ma2_10_10', unitId:'ma2-10', type:'number', cat:'word', level:3, q:'20명을 조사해 표를 만드는데 15명까지 적었어요. 앞으로 몇 명을 더 적어야 할까요?', a:'5', hint:'20 − 15' },

  // ══════════ 3학년 ══════════
  // ── 3-1. 덧셈과 뺄셈 ─────────────────────────
  { id:'r_ma3_1_01', unitId:'ma3-1', type:'number', cat:'calc', level:1, q:'245 + 132 = ?', a:'377', hint:'일·십·백의 자리를 각각 더해요' },
  { id:'r_ma3_1_02', unitId:'ma3-1', type:'number', cat:'calc', level:1, q:'368 + 254 = ?', a:'622', hint:'8 + 4 = 12 → 받아올림' },
  { id:'r_ma3_1_03', unitId:'ma3-1', type:'number', cat:'calc', level:2, q:'576 + 487 = ?', a:'1063', hint:'받아올림이 세 번 있어요' },
  { id:'r_ma3_1_04', unitId:'ma3-1', type:'number', cat:'calc', level:1, q:'583 − 241 = ?', a:'342', hint:'각 자리에서 그대로 빼요' },
  { id:'r_ma3_1_05', unitId:'ma3-1', type:'number', cat:'calc', level:2, q:'724 − 358 = ?', a:'366', hint:'일의 자리부터 받아내림' },
  { id:'r_ma3_1_06', unitId:'ma3-1', type:'number', cat:'calc', level:2, q:'900 − 456 = ?', a:'444', hint:'899 − 456 을 하고 1을 더해도 돼요' },
  { id:'r_ma3_1_07', unitId:'ma3-1', type:'number', cat:'word', level:2, q:'도서관에 동화책 365권과 과학책 278권이 있어요. 책은 모두 몇 권일까요?', a:'643', hint:'365 + 278' },
  { id:'r_ma3_1_08', unitId:'ma3-1', type:'number', cat:'word', level:2, q:'812명이 참가한 행사에서 547명이 먼저 돌아갔어요. 남은 사람은 몇 명일까요?', a:'265', hint:'812 − 547' },
  { id:'r_ma3_1_09', unitId:'ma3-1', type:'number', cat:'calc', level:2, q:'□ + 275 = 600 에서 □에 알맞은 수는?', a:'325', hint:'600 − 275' },
  { id:'r_ma3_1_10', unitId:'ma3-1', type:'choice', cat:'concept', level:2, q:'498 + 305 를 어림하면 약 얼마일까요?', choices:['약 800','약 700','약 900'], a:'약 800', hint:'500 + 300' },
  { id:'r_ma3_1_11', unitId:'ma3-1', type:'number', cat:'calc', level:3, q:'1000 − (325 + 418) = ?', a:'257', hint:'괄호 안 325 + 418 = 743 을 먼저' },

  // ── 3-2. 평면도형 ────────────────────────────
  { id:'r_ma3_2_01', unitId:'ma3-2', type:'choice', cat:'concept', level:1, q:'두 점을 곧게 이은 선을 무엇이라고 할까요?', choices:['선분','직선','반직선'], a:'선분', hint:'양쪽 끝이 있는 곧은 선' },
  { id:'r_ma3_2_02', unitId:'ma3-2', type:'choice', cat:'concept', level:1, q:'한 점에서 시작하여 한쪽으로 끝없이 늘인 곧은 선은 무엇일까요?', choices:['반직선','선분','곡선'], a:'반직선', hint:'시작점은 있고 끝은 없어요' },
  { id:'r_ma3_2_03', unitId:'ma3-2', type:'choice', cat:'concept', level:1, q:'그림의 각은 어떤 각일까요?', choices:['직각','직각보다 작은 각','직각보다 큰 각'], a:'직각', hint:'삼각자의 직각 부분과 꼭 맞아요', fig:{ kind:'angle', deg:90, label:'?' } },
  { id:'r_ma3_2_04', unitId:'ma3-2', type:'choice', cat:'concept', level:1, q:'그림의 각은 어떤 각일까요?', choices:['직각보다 작은 각','직각','직각보다 큰 각'], a:'직각보다 작은 각', hint:'직각보다 좁게 벌어져 있어요', fig:{ kind:'angle', deg:45, label:'?' } },
  { id:'r_ma3_2_05', unitId:'ma3-2', type:'choice', cat:'concept', level:1, q:'그림의 각은 어떤 각일까요?', choices:['직각보다 큰 각','직각','직각보다 작은 각'], a:'직각보다 큰 각', hint:'직각보다 넓게 벌어져 있어요', fig:{ kind:'angle', deg:130, label:'?' } },
  { id:'r_ma3_2_06', unitId:'ma3-2', type:'choice', cat:'concept', level:2, q:'그림처럼 한 각이 직각인 삼각형을 무엇이라고 할까요?', choices:['직각삼각형','정삼각형','이등변삼각형'], a:'직각삼각형', hint:'직각이 있는 삼각형', fig:{ kind:'polygon', n:3, shape:'right' } },
  { id:'r_ma3_2_07', unitId:'ma3-2', type:'choice', cat:'concept', level:2, q:'그림처럼 네 각이 모두 직각인 사각형을 무엇이라고 할까요?', choices:['직사각형','마름모','사다리꼴'], a:'직사각형', hint:'책, 문 같은 모양', fig:{ kind:'rect', w:5, h:3, unit:'cm' } },
  { id:'r_ma3_2_08', unitId:'ma3-2', type:'choice', cat:'concept', level:2, q:'네 각이 모두 직각이고 네 변의 길이가 모두 같은 사각형은 무엇일까요?', choices:['정사각형','직각삼각형','원'], a:'정사각형', hint:'그림의 가로와 세로가 같아요', fig:{ kind:'rect', w:4, h:4, unit:'cm' } },
  { id:'r_ma3_2_09', unitId:'ma3-2', type:'number', cat:'calc', level:2, q:'한 변이 4 cm 인 정사각형의 네 변의 길이의 합은 몇 cm 일까요? (숫자만)', a:'16', hint:'4 + 4 + 4 + 4', fig:{ kind:'rect', w:4, h:4, unit:'cm' } },
  { id:'r_ma3_2_10', unitId:'ma3-2', type:'number', cat:'calc', level:2, q:'가로 6 cm, 세로 2 cm 인 직사각형의 네 변의 길이의 합은 몇 cm 일까요? (숫자만)', a:'16', hint:'6 + 2 + 6 + 2', fig:{ kind:'rect', w:6, h:2, unit:'cm' } },
  { id:'r_ma3_2_11', unitId:'ma3-2', type:'number', cat:'concept', level:2, q:'직사각형에는 직각이 몇 개 있을까요?', a:'4', hint:'네 꼭짓점 모두 직각' },
  { id:'r_ma3_2_12', unitId:'ma3-2', type:'choice', cat:'concept', level:3, q:'정사각형은 직사각형이라고 할 수 있을까요?', choices:['그렇다','아니다','알 수 없다'], a:'그렇다', hint:'네 각이 모두 직각이면 직사각형이에요' },

  // ── 3-3. 나눗셈 ──────────────────────────────
  { id:'r_ma3_3_01', unitId:'ma3-3', type:'number', cat:'calc', level:1, q:'12 ÷ 3 = ?', a:'4', hint:'3 × □ = 12' },
  { id:'r_ma3_3_02', unitId:'ma3-3', type:'number', cat:'calc', level:1, q:'20 ÷ 5 = ?', a:'4', hint:'5단에서 20이 나오는 곳' },
  { id:'r_ma3_3_03', unitId:'ma3-3', type:'number', cat:'calc', level:1, q:'18 ÷ 6 = ?', a:'3', hint:'6 × 3 = 18' },
  { id:'r_ma3_3_04', unitId:'ma3-3', type:'number', cat:'concept', level:1, q:'구슬 24개를 그림처럼 4줄로 똑같이 놓았어요. 한 줄에 몇 개일까요?', a:'6', hint:'24 ÷ 4', fig:{ kind:'grid', rows:4, cols:6 } },
  { id:'r_ma3_3_05', unitId:'ma3-3', type:'number', cat:'word', level:1, q:'사탕 15개를 3명이 똑같이 나누어 가지면 한 명이 몇 개씩 가질까요?', a:'5', hint:'15 ÷ 3' },
  { id:'r_ma3_3_06', unitId:'ma3-3', type:'choice', cat:'concept', level:2, q:'21 ÷ 7 = 3 이 맞는지 확인하는 곱셈식은 무엇일까요?', choices:['7 × 3 = 21','21 + 7 = 28','3 + 7 = 10'], a:'7 × 3 = 21', hint:'나누는 수 × 몫 = 나누어지는 수' },
  { id:'r_ma3_3_07', unitId:'ma3-3', type:'number', cat:'calc', level:2, q:'□ ÷ 4 = 8 에서 □에 알맞은 수는?', a:'32', hint:'4 × 8' },
  { id:'r_ma3_3_08', unitId:'ma3-3', type:'number', cat:'calc', level:2, q:'45 ÷ 9 = ?', a:'5', hint:'9 × 5 = 45' },
  { id:'r_ma3_3_09', unitId:'ma3-3', type:'number', cat:'word', level:2, q:'연필 28자루를 한 명에게 4자루씩 나누어 주면 몇 명에게 줄 수 있을까요?', a:'7', hint:'28 ÷ 4' },
  { id:'r_ma3_3_10', unitId:'ma3-3', type:'number', cat:'concept', level:2, q:'30 ÷ 6 = 5 에서 몫은 얼마일까요?', a:'5', hint:'나눗셈의 결과를 몫이라고 해요' },
  { id:'r_ma3_3_11', unitId:'ma3-3', type:'number', cat:'calc', level:3, q:'56 ÷ 8 = ?', a:'7', hint:'8 × 7 = 56' },
  { id:'r_ma3_3_12', unitId:'ma3-3', type:'number', cat:'word', level:3, q:'초콜릿 63개를 9명이 똑같이 나누어 가지면 한 명이 몇 개씩 가질까요?', a:'7', hint:'63 ÷ 9' },

  // ── 3-4. 곱셈 ────────────────────────────────
  { id:'r_ma3_4_01', unitId:'ma3-4', type:'number', cat:'calc', level:1, q:'23 × 3 = ?', a:'69', hint:'20 × 3 = 60, 3 × 3 = 9' },
  { id:'r_ma3_4_02', unitId:'ma3-4', type:'number', cat:'calc', level:1, q:'14 × 5 = ?', a:'70', hint:'10 × 5 = 50, 4 × 5 = 20' },
  { id:'r_ma3_4_03', unitId:'ma3-4', type:'number', cat:'calc', level:2, q:'36 × 4 = ?', a:'144', hint:'30 × 4 = 120, 6 × 4 = 24' },
  { id:'r_ma3_4_04', unitId:'ma3-4', type:'number', cat:'calc', level:1, q:'213 × 3 = ?', a:'639', hint:'각 자리에 3을 곱해요' },
  { id:'r_ma3_4_05', unitId:'ma3-4', type:'number', cat:'calc', level:2, q:'125 × 4 = ?', a:'500', hint:'100 × 4 = 400, 25 × 4 = 100' },
  { id:'r_ma3_4_06', unitId:'ma3-4', type:'number', cat:'calc', level:2, q:'20 × 30 = ?', a:'600', hint:'2 × 3 = 6 에 0을 두 개 붙여요' },
  { id:'r_ma3_4_07', unitId:'ma3-4', type:'number', cat:'calc', level:2, q:'12 × 15 = ?', a:'180', hint:'12 × 10 = 120, 12 × 5 = 60' },
  { id:'r_ma3_4_08', unitId:'ma3-4', type:'number', cat:'word', level:2, q:'한 상자에 사과가 45개씩 들어 있어요. 6상자에 든 사과는 모두 몇 개일까요?', a:'270', hint:'45 × 6' },
  { id:'r_ma3_4_09', unitId:'ma3-4', type:'choice', cat:'concept', level:2, q:'42 × 3 을 어림하면 약 얼마일까요?', choices:['약 120','약 80','약 150'], a:'약 120', hint:'40 × 3' },
  { id:'r_ma3_4_10', unitId:'ma3-4', type:'number', cat:'calc', level:2, q:'□ × 4 = 96 에서 □에 알맞은 수는?', a:'24', hint:'96 ÷ 4' },
  { id:'r_ma3_4_11', unitId:'ma3-4', type:'number', cat:'word', level:3, q:'하루에 줄넘기를 24번씩 12일 동안 했어요. 모두 몇 번 했을까요?', a:'288', hint:'24 × 12 = 24 × 10 + 24 × 2' },
  { id:'r_ma3_4_12', unitId:'ma3-4', type:'number', cat:'calc', level:3, q:'32 × 25 = ?', a:'800', hint:'32 × 25 = 8 × 4 × 25 = 8 × 100' },

  // ── 3-5. 길이와 시간 ─────────────────────────
  { id:'r_ma3_5_01', unitId:'ma3-5', type:'number', cat:'concept', level:1, q:'그림의 1 cm 는 몇 mm 일까요? (숫자만)', a:'10', hint:'1 cm = 10 mm', fig:{ kind:'ruler', len:1, unit:'cm' } },
  { id:'r_ma3_5_02', unitId:'ma3-5', type:'number', cat:'concept', level:1, q:'자로 잰 물건의 길이는 몇 mm 일까요? (숫자만)', a:'40', hint:'4 cm = 40 mm', fig:{ kind:'ruler', len:4, unit:'cm' } },
  { id:'r_ma3_5_03', unitId:'ma3-5', type:'number', cat:'concept', level:1, q:'1 km 는 몇 m 일까요? (숫자만)', a:'1000', hint:'1 km = 1000 m' },
  { id:'r_ma3_5_04', unitId:'ma3-5', type:'number', cat:'calc', level:2, q:'3 km 500 m 는 몇 m 일까요? (숫자만)', a:'3500', hint:'3000 + 500' },
  { id:'r_ma3_5_05', unitId:'ma3-5', type:'number', cat:'concept', level:2, q:'1분은 몇 초일까요? (숫자만)', a:'60', hint:'초바늘이 한 바퀴 도는 시간' },
  { id:'r_ma3_5_06', unitId:'ma3-5', type:'choice', cat:'word', level:2, q:'시계가 나타내는 시각에서 30분 뒤는 몇 시 몇 분일까요?', choices:['9시 40분','9시 20분','10시 10분'], a:'9시 40분', hint:'9시 10분 + 30분', fig:{ kind:'clock', h:9, m:10 } },
  { id:'r_ma3_5_07', unitId:'ma3-5', type:'choice', cat:'word', level:2, q:'시계가 나타내는 시각에서 10분 뒤는 몇 시일까요?', choices:['3시','2시 60분','3시 10분'], a:'3시', hint:'2시 50분 + 10분 = 60분이 되면 다음 시', fig:{ kind:'clock', h:2, m:50 } },
  { id:'r_ma3_5_08', unitId:'ma3-5', type:'number', cat:'calc', level:2, q:'2분 30초는 몇 초일까요? (숫자만)', a:'150', hint:'60 + 60 + 30' },
  { id:'r_ma3_5_09', unitId:'ma3-5', type:'number', cat:'calc', level:2, q:'그림의 자로 잰 길이보다 2 mm 더 긴 길이는 몇 mm 일까요? (숫자만)', a:'92', hint:'9 cm = 90 mm, 90 + 2', fig:{ kind:'ruler', len:9, unit:'cm' } },
  { id:'r_ma3_5_10', unitId:'ma3-5', type:'number', cat:'word', level:2, q:'시계가 나타내는 시각에서 15분 뒤는 4시 몇 분일까요? (숫자만)', a:'35', hint:'20 + 15', fig:{ kind:'clock', h:4, m:20 } },
  { id:'r_ma3_5_11', unitId:'ma3-5', type:'number', cat:'word', level:3, q:'집에서 학교까지 1 km 200 m, 학교에서 도서관까지 800 m 예요. 집에서 학교를 거쳐 도서관까지는 몇 km 일까요? (숫자만)', a:'2', hint:'1200 m + 800 m = 2000 m' },
  { id:'r_ma3_5_12', unitId:'ma3-5', type:'number', cat:'concept', level:2, q:'자로 잰 물건의 길이는 몇 mm 일까요? (숫자만)', a:'70', hint:'7 cm = 70 mm', fig:{ kind:'ruler', len:7, unit:'cm' } },

  // ── 3-6. 분수와 소수 ─────────────────────────
  { id:'r_ma3_6_01', unitId:'ma3-6', type:'choice', cat:'concept', level:1, q:'색칠한 부분은 전체의 얼마일까요?', choices:['1/4','1/3','3/4'], a:'1/4', hint:'전체를 4로 나눈 것 중 1', fig:{ kind:'fraction', n:4, k:1, shape:'circle' } },
  { id:'r_ma3_6_02', unitId:'ma3-6', type:'choice', cat:'concept', level:1, q:'색칠한 부분은 전체의 얼마일까요?', choices:['1/3','1/2','2/3'], a:'1/3', hint:'전체를 3으로 나눈 것 중 1', fig:{ kind:'fraction', n:3, k:1, shape:'bar' } },
  { id:'r_ma3_6_03', unitId:'ma3-6', type:'choice', cat:'concept', level:1, q:'색칠한 부분은 전체의 얼마일까요?', choices:['3/4','1/4','3/3'], a:'3/4', hint:'전체 4칸 중 3칸', fig:{ kind:'fraction', n:4, k:3, shape:'circle' } },
  { id:'r_ma3_6_04', unitId:'ma3-6', type:'choice', cat:'concept', level:1, q:'색칠한 부분은 전체의 얼마일까요?', choices:['2/5','3/5','2/3'], a:'2/5', hint:'전체 5칸 중 2칸', fig:{ kind:'fraction', n:5, k:2, shape:'bar' } },
  { id:'r_ma3_6_05', unitId:'ma3-6', type:'choice', cat:'concept', level:2, q:'색칠하지 않은 부분은 전체의 얼마일까요?', choices:['1/6','5/6','1/5'], a:'1/6', hint:'6칸 중 색칠 안 된 칸은 1칸', fig:{ kind:'fraction', n:6, k:5, shape:'bar' } },
  { id:'r_ma3_6_06', unitId:'ma3-6', type:'choice', cat:'concept', level:2, q:'1/4 과 3/4 중 더 큰 분수는 무엇일까요?', choices:['3/4','1/4','같다'], a:'3/4', hint:'분모가 같으면 분자가 큰 쪽이 커요' },
  { id:'r_ma3_6_07', unitId:'ma3-6', type:'choice', cat:'concept', level:2, q:'1/3 과 1/5 중 더 큰 분수는 무엇일까요?', choices:['1/3','1/5','같다'], a:'1/3', hint:'똑같이 나눌수록(분모가 클수록) 한 조각은 작아져요' },
  { id:'r_ma3_6_08', unitId:'ma3-6', type:'choice', cat:'concept', level:2, q:'색칠한 부분을 소수로 나타내면 얼마일까요?', choices:['0.3','0.7','3.0'], a:'0.3', hint:'10칸 중 3칸 = 3/10 = 0.3', fig:{ kind:'fraction', n:10, k:3, shape:'bar' } },
  { id:'r_ma3_6_09', unitId:'ma3-6', type:'number', cat:'concept', level:2, q:'0.1이 7개인 수는 얼마일까요?', a:'0.7', hint:'0.1, 0.2, 0.3 … 7번' },
  { id:'r_ma3_6_10', unitId:'ma3-6', type:'choice', cat:'concept', level:2, q:'0.5와 0.8 중 더 큰 수는 무엇일까요?', choices:['0.8','0.5','같다'], a:'0.8', hint:'0.1이 5개와 8개' },
  { id:'r_ma3_6_11', unitId:'ma3-6', type:'number', cat:'concept', level:2, q:'3과 0.4를 합한 수를 소수로 쓰면 얼마일까요?', a:'3.4', hint:'3.4 는 "삼 점 사" 라고 읽어요' },
  { id:'r_ma3_6_12', unitId:'ma3-6', type:'number', cat:'concept', level:1, q:'전체를 똑같이 8조각으로 나누었어요. 색칠한 조각은 몇 조각일까요?', a:'4', hint:'색칠한 조각만 세어요', fig:{ kind:'fraction', n:8, k:4, shape:'circle' } },
  { id:'r_ma3_6_13', unitId:'ma3-6', type:'number', cat:'concept', level:2, q:'분수 3/7 에서 분모는 무엇일까요?', a:'7', hint:'가로선 아래에 있는 수가 분모' },

  // ── 3-7. 원 ──────────────────────────────────
  { id:'r_ma3_7_01', unitId:'ma3-7', type:'choice', cat:'concept', level:1, q:'원의 한가운데에 있는 점을 무엇이라고 할까요?', choices:['원의 중심','반지름','지름'], a:'원의 중심', hint:'컴퍼스의 침을 꽂는 곳', fig:{ kind:'shapes', items:['circle'] } },
  { id:'r_ma3_7_02', unitId:'ma3-7', type:'choice', cat:'concept', level:1, q:'원의 중심과 원 위의 한 점을 이은 선분을 무엇이라고 할까요?', choices:['반지름','지름','둘레'], a:'반지름', hint:'지름의 절반', fig:{ kind:'shapes', items:['circle'] } },
  { id:'r_ma3_7_03', unitId:'ma3-7', type:'choice', cat:'concept', level:1, q:'원의 중심을 지나면서 원 위의 두 점을 이은 선분을 무엇이라고 할까요?', choices:['지름','반지름','꼭짓점'], a:'지름', hint:'원 안에서 가장 긴 선분', fig:{ kind:'shapes', items:['circle'] } },
  { id:'r_ma3_7_04', unitId:'ma3-7', type:'number', cat:'calc', level:1, q:'반지름이 4 cm 인 원의 지름은 몇 cm 일까요? (숫자만)', a:'8', hint:'지름 = 반지름 × 2' },
  { id:'r_ma3_7_05', unitId:'ma3-7', type:'number', cat:'calc', level:1, q:'지름이 10 cm 인 원의 반지름은 몇 cm 일까요? (숫자만)', a:'5', hint:'반지름 = 지름 ÷ 2' },
  { id:'r_ma3_7_06', unitId:'ma3-7', type:'choice', cat:'concept', level:2, q:'원을 정확하게 그릴 때 쓰는 도구는 무엇일까요?', choices:['컴퍼스','각도기','삼각자'], a:'컴퍼스', hint:'침과 연필심이 달린 도구' },
  { id:'r_ma3_7_07', unitId:'ma3-7', type:'choice', cat:'concept', level:2, q:'한 원에서 반지름은 몇 개 그을 수 있을까요?', choices:['셀 수 없이 많다','1개','2개'], a:'셀 수 없이 많다', hint:'중심에서 원 위 어느 점으로든 그을 수 있어요', fig:{ kind:'shapes', items:['circle'] } },
  { id:'r_ma3_7_08', unitId:'ma3-7', type:'choice', cat:'concept', level:2, q:'한 원에서 지름과 반지름의 관계로 알맞은 것은?', choices:['지름은 반지름의 2배이다','지름과 반지름은 길이가 같다','반지름이 지름보다 길다'], a:'지름은 반지름의 2배이다', hint:'지름은 반지름 두 개를 이은 것', fig:{ kind:'shapes', items:['circle'] } },
  { id:'r_ma3_7_09', unitId:'ma3-7', type:'number', cat:'word', level:2, q:'반지름이 3 cm 인 원 두 개를 나란히 딱 붙여 놓았어요. 전체 가로 길이는 몇 cm 일까요? (숫자만)', a:'12', hint:'지름 6 cm 가 2개', fig:{ kind:'shapes', items:['circle','circle'] } },
  { id:'r_ma3_7_10', unitId:'ma3-7', type:'number', cat:'word', level:3, q:'지름이 6 cm 인 원 세 개를 한 줄로 딱 붙여 놓았어요. 전체 가로 길이는 몇 cm 일까요? (숫자만)', a:'18', hint:'6 × 3', fig:{ kind:'shapes', items:['circle','circle','circle'] } },
  { id:'r_ma3_7_11', unitId:'ma3-7', type:'choice', cat:'concept', level:2, q:'컴퍼스로 원을 그릴 때 침을 꽂는 곳은 어디일까요?', choices:['원의 중심','원 위의 점','지름의 끝'], a:'원의 중심', hint:'침을 꽂은 곳이 원의 가운데가 돼요' },

  // ── 3-8. 들이와 무게 ─────────────────────────
  { id:'r_ma3_8_01', unitId:'ma3-8', type:'number', cat:'concept', level:1, q:'1 L 는 몇 mL 일까요? (숫자만)', a:'1000', hint:'1 L = 1000 mL' },
  { id:'r_ma3_8_02', unitId:'ma3-8', type:'number', cat:'concept', level:1, q:'1 kg 은 몇 g 일까요? (숫자만)', a:'1000', hint:'1 kg = 1000 g' },
  { id:'r_ma3_8_03', unitId:'ma3-8', type:'number', cat:'calc', level:2, q:'2 L 500 mL 는 몇 mL 일까요? (숫자만)', a:'2500', hint:'2000 + 500' },
  { id:'r_ma3_8_04', unitId:'ma3-8', type:'number', cat:'calc', level:2, q:'3 kg 200 g 은 몇 g 일까요? (숫자만)', a:'3200', hint:'3000 + 200' },
  { id:'r_ma3_8_05', unitId:'ma3-8', type:'choice', cat:'concept', level:1, q:'큰 생수병에 담긴 물의 양을 나타내기에 알맞은 단위는 무엇일까요?', choices:['L','g','cm'], a:'L', hint:'들이의 단위' },
  { id:'r_ma3_8_06', unitId:'ma3-8', type:'choice', cat:'concept', level:1, q:'사과 한 개의 무게를 나타내기에 알맞은 단위는 무엇일까요?', choices:['g','L','km'], a:'g', hint:'무게의 단위 중 가벼운 것에 써요' },
  { id:'r_ma3_8_07', unitId:'ma3-8', type:'number', cat:'concept', level:2, q:'1 t 은 몇 kg 일까요? (숫자만)', a:'1000', hint:'아주 무거운 것에 쓰는 단위 톤' },
  { id:'r_ma3_8_08', unitId:'ma3-8', type:'number', cat:'word', level:2, q:'주스 1 L 300 mL 에 700 mL 를 더 부었어요. 모두 몇 L 일까요? (숫자만)', a:'2', hint:'300 + 700 = 1000 mL = 1 L' },
  { id:'r_ma3_8_09', unitId:'ma3-8', type:'number', cat:'word', level:2, q:'쌀 5 kg 중 1 kg 500 g 을 사용했어요. 남은 쌀은 몇 g 일까요? (숫자만)', a:'3500', hint:'5000 − 1500' },
  { id:'r_ma3_8_10', unitId:'ma3-8', type:'choice', cat:'concept', level:2, q:'같은 컵으로 물을 부었더니 그릇 A는 6컵, 그릇 B는 4컵이 들어갔어요. 들이가 더 큰 그릇은?', choices:['A','B','같다'], a:'A', hint:'컵이 더 많이 들어간 그릇이 더 커요' },
  { id:'r_ma3_8_11', unitId:'ma3-8', type:'number', cat:'calc', level:3, q:'4500 g 은 □ kg 500 g 입니다. □에 알맞은 수는?', a:'4', hint:'4500 = 4000 + 500' },

  // ── 3-9. 자료의 정리 ─────────────────────────
  { id:'r_ma3_9_01', unitId:'ma3-9', type:'choice', cat:'concept', level:1, q:'그림그래프란 무엇일까요?', choices:['자료의 수를 그림으로 나타낸 그래프','선으로 이어 나타낸 그래프','수만 적어 놓은 표'], a:'자료의 수를 그림으로 나타낸 그래프', hint:'그림 하나가 정해진 수를 나타내요' },
  { id:'r_ma3_9_02', unitId:'ma3-9', type:'number', cat:'word', level:1, q:'그림그래프에서 큰 그림은 10명, 작은 그림은 1명이에요. 큰 그림 2개, 작은 그림 3개는 몇 명일까요?', a:'23', hint:'20 + 3' },
  { id:'r_ma3_9_03', unitId:'ma3-9', type:'number', cat:'word', level:2, q:'그림그래프에서 큰 그림은 100개, 작은 그림은 10개예요. 큰 그림 3개, 작은 그림 4개는 몇 개일까요?', a:'340', hint:'300 + 40' },
  { id:'r_ma3_9_04', unitId:'ma3-9', type:'number', cat:'word', level:2, q:'마을별 나무 수가 가 마을 120그루, 나 마을 90그루, 다 마을 150그루예요. 나무는 모두 몇 그루일까요?', a:'360', hint:'120 + 90 + 150' },
  { id:'r_ma3_9_05', unitId:'ma3-9', type:'choice', cat:'word', level:2, q:'가 마을 120그루, 나 마을 90그루, 다 마을 150그루일 때 나무가 가장 많은 마을은?', choices:['다 마을','가 마을','나 마을'], a:'다 마을', hint:'150이 가장 큰 수' },
  { id:'r_ma3_9_06', unitId:'ma3-9', type:'number', cat:'word', level:2, q:'다 마을 150그루와 나 마을 90그루의 나무 수 차이는 몇 그루일까요?', a:'60', hint:'150 − 90' },
  { id:'r_ma3_9_07', unitId:'ma3-9', type:'choice', cat:'concept', level:2, q:'그림그래프의 좋은 점은 무엇일까요?', choices:['많고 적음을 한눈에 알기 쉽다','정확한 수를 계산하기 쉽다','자료를 모으지 않아도 된다'], a:'많고 적음을 한눈에 알기 쉽다', hint:'그림의 개수로 바로 비교돼요' },
  { id:'r_ma3_9_08', unitId:'ma3-9', type:'number', cat:'word', level:2, q:'250명을 큰 그림(100명)과 작은 그림(10명)으로 나타내면 큰 그림 2개와 작은 그림 몇 개가 필요할까요?', a:'5', hint:'250 − 200 = 50, 50은 10이 5개' },
  { id:'r_ma3_9_09', unitId:'ma3-9', type:'number', cat:'word', level:3, q:'네 반의 학생 수 합계는 100명이에요. 1반 28명, 2반 25명, 3반 22명이면 4반은 몇 명일까요?', a:'25', hint:'100 − (28 + 25 + 22)' },
  { id:'r_ma3_9_10', unitId:'ma3-9', type:'choice', cat:'concept', level:2, q:'표에서 "합계" 칸은 무엇을 알려 줄까요?', choices:['전체 수','가장 큰 수','가장 작은 수'], a:'전체 수', hint:'모든 항목을 더한 값' },
];
