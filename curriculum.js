// ══════════════════════════════════════════════════
//  교육과정 학습 콘텐츠 — 단원 정의 + 기본 문제 은행
//  ------------------------------------------------
//  · gamedata.js 다음에 로드된다(클래식 <script>, 전역 상수 노출).
//  · 교과서 본문·문제를 옮겨오지 않는다. 교육과정 성취기준에 맞춰 새로 만든 문항만 담는다.
//    (교과서 내용은 저작권 대상이며, 이 앱은 향후 배포를 염두에 두므로 원칙적으로 제외)
//  · 단원명은 수학은 전 출판사 공통이지만 영어·사회는 출판사별 차이가 있어
//    교사 화면에서 수정할 수 있게 한다(customUnits로 덮어씀).
//
//  ✅ 단원 구성 검증 완료 (2026-07-31, #137 해소) — 2022 개정 교육과정
//     (3~4학년 적용 2025년~, 현재 2년차) 실사용 교과서 기준으로 교체함:
//   · 수학: 아이스크림미디어(김성여 외) 4-1 — 1~5단원은 구판과 동일,
//           6단원만 "규칙 찾기"→"규칙과 관계"(등호 식 내용 신설).
//   · 사회: 아이스크림미디어(한춘희 외) 4-1 — 3개 단원 전면 개편
//           (공공기관·주민참여는 4-2로 이동, 경제 단원이 4-1로 들어옴).
//   · 영어: 천재(함순애)본 "영어 4" — 1년 단권 12과, 1학기 = Lesson 1~6.
//   근거: 각 출판사 자습서 목차·T셀파 단원 목록·EBS 교재 등 교차 확인
//         (조사 기록은 docs/worklog/2026-07-31-curriculum-units.md).
//   ⚠️ 단, 자사 지도서/연간계획 원본은 로그인 필요라 미열람 — 세부 차시명은
//     교과서 실물과 다를 수 있음. 교사가 customUnitNames로 수정 가능.
//     단원이 바뀌면 units와 BASE_PROBLEMS의 unitId를 함께 갱신해야 한다.
// ══════════════════════════════════════════════════

// ── 학년/학기별 단원 ──
// id 규칙: <과목약자><학년><학기>-<단원번호>  예: ma4-1-3
const CURRICULUM = {
  '4-1': {
    label: '4학년 1학기',
    subjects: {
      math: {
        label: '수학', icon: '🔢',
        units: [
          { id:'ma4-1-1', no:1, name:'큰 수' },
          { id:'ma4-1-2', no:2, name:'각도' },
          { id:'ma4-1-3', no:3, name:'곱셈과 나눗셈' },
          { id:'ma4-1-4', no:4, name:'평면도형의 이동' },
          { id:'ma4-1-5', no:5, name:'막대그래프' },
          { id:'ma4-1-6', no:6, name:'규칙과 관계' },
        ],
      },
      english: {
        label: '영어', icon: '🔤',
        // 2022 개정·천재(함순애)본 "영어 4"(1년 단권 12과) 기준.
        // 1학기 범위 = Lesson 1~6 (T셀파 목차 + 자습서 4-1/4-2 분권으로 확인).
        // 2학기(L7~12: 요일·가격·소유·시각·현재진행 등)는 4-2 추가 시 반영.
        units: [
          { id:'en4-1-1', no:1, name:'My Name Is Amy (이름·인사)' },
          { id:'en4-1-2', no:2, name:'I\'m Happy (감정·안부)' },
          { id:'en4-1-3', no:3, name:'Don\'t Sit Here (금지)' },
          { id:'en4-1-4', no:4, name:'Let\'s Play Basketball (제안)' },
          { id:'en4-1-5', no:5, name:'I Want Chicken (음식·원하는 것)' },
          { id:'en4-1-6', no:6, name:'Where\'s My Cap? (위치)' },
        ],
      },
      social: {
        label: '사회', icon: '🗺️',
        // 2022 개정·아이스크림미디어 4-1 기준(자습서 목차 + EBS + 교사 퀴즈 교차확인).
        // 구 3단원(공공기관·주민 참여)은 2022 개정에서 4-2로 이동했고,
        // 구 4-2의 경제 단원이 4-1 3단원으로 들어왔다.
        units: [
          { id:'so4-1-1', no:1, name:'지도로 만나는 우리 지역' },
          { id:'so4-1-2', no:2, name:'우리 지역의 국가유산' },
          { id:'so4-1-3', no:3, name:'경제활동과 지역 간 교류' },
        ],
      },
    },
  },
};

// ── 문제 형식 ──
// { id, unitId, type, cat, level, q, a, choices?, alt?, hint?, audio? }
//   type  : 'choice'(객관식) | 'short'(단답) | 'number'(수 입력)   ← 답을 어떻게 입력하는가
//   cat   : 문제의 성격 ← type과 다른 축이다. 과목마다 값이 다르다
//             수학  'calc'    단순 계산   (213 × 30 = ?)
//                   'word'    문장제     (사탕 250개를 16개씩 담으면…)
//                   'concept' 개념·판별  (직각은 몇 도일까요?)
//             영어  'vocab'   단어·철자
//                   'expr'    표현·문장 뜻
//                   'dialog'  대화 완성
//                   'listen'  듣기 (audio 필드 필수)
//             사회  'concept' 개념·용어
//                   'apply'   사례 적용·추론
//   a     : 정답. number형은 숫자 문자열, short는 대표 정답(별칭은 alt에)
//   alt   : 정답으로 인정할 다른 표기(배열, 선택)
//   level : 1(기본) 2(보통) 3(도전)
//   audio : 듣기 문항에서 읽어 줄 영어 텍스트. 있으면 학생 화면에 🔊 버튼이 나온다
//           (Web Speech API — 단어·문장 모두 가능. 기기가 지원 안 하면 텍스트로 폴백)
const BASE_PROBLEMS = [
  // ── 수학 1. 큰 수 ─────────────────────────────
  { id:'p_ma411_01', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'10000이 3개, 1000이 5개인 수는 얼마일까요?', a:'35000', hint:'10000이 3개 → 30000, 1000이 5개 → 5000' },
  { id:'p_ma411_02', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'숫자 46208에서 백의 자리 숫자는 무엇일까요?', a:'2', hint:'오른쪽부터 일·십·백 순서로 세어 보세요' },
  { id:'p_ma411_03', unitId:'ma4-1-1', type:'choice', cat:'concept', level:1, q:'다음 중 가장 큰 수는?', choices:['58900','59000','58990','58099'], a:'59000', hint:'만의 자리부터 차례로 비교해요' },
  { id:'p_ma411_04', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'27000에서 1000씩 3번 뛰어 센 수는?', a:'30000', hint:'1000씩 커지면 천의 자리가 1씩 늘어요' },
  { id:'p_ma411_05', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'1억은 1000만이 몇 개 모인 수일까요?', a:'10', hint:'1000만 × □ = 1억' },
  { id:'p_ma411_06', unitId:'ma4-1-1', type:'choice', cat:'concept', level:2, q:'"삼천이백사십오만"을 숫자로 바르게 쓴 것은?', choices:['32450000','3245000','32045000','324500000'], a:'32450000', hint:'만 단위로 끊어서 3245|0000' },
  { id:'p_ma411_07', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'숫자 70650000에서 숫자 7이 나타내는 값은 몇만일까요? (숫자만)', a:'7000', hint:'7은 천만의 자리 → 7000만' },
  { id:'p_ma411_08', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'0, 2, 5, 8을 한 번씩 써서 만들 수 있는 가장 큰 네 자리 수는?', a:'8520', hint:'큰 숫자를 앞자리부터 놓아요' },

  // ── 수학 2. 각도 ──────────────────────────────
  { id:'p_ma412_01', unitId:'ma4-1-2', type:'choice', cat:'concept', level:1, q:'직각은 몇 도일까요?', choices:['45도','90도','180도','360도'], a:'90도', hint:'ㄱ자 모양의 각이에요' },
  { id:'p_ma412_02', unitId:'ma4-1-2', type:'choice', cat:'concept', level:1, q:'크기가 60도인 각은 어떤 각일까요?', choices:['예각','직각','둔각','평각'], a:'예각', hint:'0도보다 크고 90도보다 작으면 예각' },
  { id:'p_ma412_03', unitId:'ma4-1-2', type:'choice', cat:'concept', level:1, q:'크기가 120도인 각은 어떤 각일까요?', choices:['예각','직각','둔각','평각'], a:'둔각', hint:'90도보다 크고 180도보다 작으면 둔각' },
  { id:'p_ma412_04', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'삼각형 세 각의 크기의 합은 몇 도일까요? (숫자만)', a:'180', hint:'세 각을 모으면 일직선이 돼요' },
  { id:'p_ma412_05', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'사각형 네 각의 크기의 합은 몇 도일까요? (숫자만)', a:'360', hint:'삼각형 두 개로 나눌 수 있어요' },
  { id:'p_ma412_06', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'삼각형에서 두 각이 50도, 70도일 때 나머지 한 각은 몇 도일까요?', a:'60', hint:'180 − (50 + 70)' },
  { id:'p_ma412_07', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'사각형에서 세 각이 90도, 80도, 100도일 때 나머지 한 각은 몇 도일까요?', a:'90', hint:'360 − (90 + 80 + 100)' },

  // ── 수학 3. 곱셈과 나눗셈 ─────────────────────
  { id:'p_ma413_01', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'213 × 30 = ?', a:'6390', hint:'213 × 3 = 639, 뒤에 0을 붙여요' },
  { id:'p_ma413_02', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'150 × 40 = ?', a:'6000', hint:'15 × 4 = 60, 0을 두 개 붙여요' },
  { id:'p_ma413_03', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'324 × 21 = ?', a:'6804', hint:'324×20 = 6480, 324×1 = 324' },
  { id:'p_ma413_04', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'420 ÷ 20 = ?', a:'21', hint:'42 ÷ 2 로 생각해 보세요' },
  { id:'p_ma413_05', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'270 ÷ 30 = ?', a:'9', hint:'27 ÷ 3' },
  { id:'p_ma413_06', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'156 ÷ 12 = ?', a:'13', hint:'12 × 13 = 156' },
  { id:'p_ma413_07', unitId:'ma4-1-3', type:'number', cat:'calc', level:3, q:'145 ÷ 12 의 나머지는 얼마일까요?', a:'1', hint:'12 × 12 = 144' },
  { id:'p_ma413_08', unitId:'ma4-1-3', type:'number', cat:'word', level:3, q:'사탕 250개를 한 봉지에 16개씩 담으면 몇 봉지가 되고 몇 개가 남을까요? 남는 개수만 쓰세요.', a:'10', hint:'16 × 15 = 240' },

  // ── 수학 4. 평면도형의 이동 ───────────────────
  { id:'p_ma414_01', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'도형을 밀면 무엇이 변할까요?', choices:['모양','크기','위치','방향'], a:'위치', hint:'밀기는 자리만 옮기는 이동이에요' },
  { id:'p_ma414_02', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'도형을 뒤집거나 돌려도 변하지 않는 것은?', choices:['모양과 크기','위치','방향','색깔'], a:'모양과 크기', hint:'이동해도 도형 자체는 그대로예요' },
  { id:'p_ma414_03', unitId:'ma4-1-4', type:'choice', cat:'concept', level:2, q:'도형을 오른쪽으로 뒤집으면 어떻게 될까요?', choices:['좌우가 바뀐다','위아래가 바뀐다','아무 변화 없다','크기가 커진다'], a:'좌우가 바뀐다', hint:'거울에 비친 모습을 떠올려요' },
  { id:'p_ma414_04', unitId:'ma4-1-4', type:'choice', cat:'concept', level:2, q:'도형을 아래쪽으로 뒤집으면 어떻게 될까요?', choices:['위아래가 바뀐다','좌우가 바뀐다','변화 없다','작아진다'], a:'위아래가 바뀐다', hint:'물에 비친 모습처럼요' },
  { id:'p_ma414_05', unitId:'ma4-1-4', type:'number', cat:'calc', level:2, q:'도형을 시계 방향으로 90도씩 4번 돌리면 처음과 같아집니다. 모두 몇 도를 돌린 걸까요? (숫자만)', a:'360', hint:'90 × 4' },
  { id:'p_ma414_06', unitId:'ma4-1-4', type:'choice', cat:'concept', level:3, q:'도형을 시계 방향으로 180도 돌린 것과 같은 결과가 되는 것은?', choices:['시계 반대 방향으로 180도 돌리기','오른쪽으로 밀기','90도 돌리기','뒤집지 않기'], a:'시계 반대 방향으로 180도 돌리기', hint:'반 바퀴는 어느 쪽으로 돌려도 같아요' },

  // ── 수학 5. 막대그래프 ───────────────────────
  { id:'p_ma415_01', unitId:'ma4-1-5', type:'choice', cat:'concept', level:1, q:'막대그래프에서 막대의 길이는 무엇을 나타낼까요?', choices:['자료의 수량','자료의 이름','조사한 날짜','조사한 사람'], a:'자료의 수량', hint:'길수록 많다는 뜻이에요' },
  { id:'p_ma415_02', unitId:'ma4-1-5', type:'choice', cat:'concept', level:1, q:'막대그래프를 그릴 때 가장 먼저 정해야 할 것은?', choices:['가로와 세로에 무엇을 나타낼지','막대 색깔','제목 글씨체','종이 크기'], a:'가로와 세로에 무엇을 나타낼지', hint:'무엇을 어디에 나타낼지부터 정해요' },
  { id:'p_ma415_03', unitId:'ma4-1-5', type:'number', cat:'calc', level:2, q:'막대그래프에서 눈금 한 칸이 5명을 나타냅니다. 막대가 7칸이면 몇 명일까요?', a:'35', hint:'5 × 7' },
  { id:'p_ma415_04', unitId:'ma4-1-5', type:'number', cat:'calc', level:2, q:'눈금 한 칸이 2권인 막대그래프에서 12권을 나타내려면 몇 칸을 그려야 할까요?', a:'6', hint:'12 ÷ 2' },
  { id:'p_ma415_05', unitId:'ma4-1-5', type:'choice', cat:'concept', level:2, q:'막대그래프의 좋은 점은 무엇일까요?', choices:['많고 적음을 한눈에 비교할 수 있다','자료를 모을 수 있다','계산이 빨라진다','그림을 예쁘게 그릴 수 있다'], a:'많고 적음을 한눈에 비교할 수 있다', hint:'표보다 비교가 쉬워요' },
  { id:'p_ma415_06', unitId:'ma4-1-5', type:'number', cat:'word', level:3, q:'좋아하는 과일을 조사했더니 사과 12명, 배 8명, 귤 15명이었습니다. 조사한 학생은 모두 몇 명일까요?', a:'35', hint:'12 + 8 + 15' },

  // ── 수학 6. 규칙 찾기 ────────────────────────
  { id:'p_ma416_01', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'2, 5, 8, 11, □ … 빈칸에 알맞은 수는?', a:'14', hint:'3씩 커지고 있어요' },
  { id:'p_ma416_02', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'100, 90, 80, 70, □ … 빈칸에 알맞은 수는?', a:'60', hint:'10씩 작아져요' },
  { id:'p_ma416_03', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'1, 2, 4, 8, 16, □ … 빈칸에 알맞은 수는?', a:'32', hint:'2배씩 커져요' },
  { id:'p_ma416_04', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'110 + 20 = 130, 120 + 20 = 140, 130 + 20 = □ 규칙에 맞는 값은?', a:'150', hint:'더해지는 수가 10씩 커져요' },
  { id:'p_ma416_05', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'도형이 1개, 3개, 5개, 7개 순으로 늘어납니다. 다섯 번째에는 몇 개일까요?', a:'9', hint:'2개씩 늘어나요' },
  { id:'p_ma416_06', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'첫째 줄 1개, 둘째 줄 4개, 셋째 줄 9개… 넷째 줄에는 몇 개일까요?', a:'16', hint:'1×1, 2×2, 3×3 …' },
  // 2022 개정 신설: 등호를 사용한 식(양쪽이 같음)
  { id:'p_ma416_07', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'5 + 7 = □ + 4 에서 □에 알맞은 수는?', a:'8', hint:'등호(=)는 양쪽이 같다는 뜻이에요. 5+7을 먼저 계산해요' },
  { id:'p_ma416_08', unitId:'ma4-1-6', type:'choice', cat:'concept', level:2, q:'다음 중 옳은 식은 어느 것일까요?', choices:['20 + 5 = 15 + 10','20 + 5 = 30 − 10','20 + 5 = 5 + 30','20 + 5 = 10 + 10'], a:'20 + 5 = 15 + 10', hint:'양쪽을 각각 계산해서 같은 것을 찾아요' },

  // ── 영어 L1. My Name Is Amy (이름·인사) ──────
  { id:'p_en411_01', unitId:'en4-1-1', type:'choice', cat:'expr', level:1, q:'"Hello, my name is Jimin." 에서 이름을 말하는 표현은?', choices:['my name is','how are you','thank you','good bye'], a:'my name is', hint:'name = 이름' },
  { id:'p_en411_02', unitId:'en4-1-1', type:'short', cat:'vocab', level:1, q:'"안녕하세요"에 해당하는 영어 인사말을 쓰세요.', a:'hello', alt:['hi','Hello','Hi'], hint:'h로 시작해요' },
  { id:'p_en411_03', unitId:'en4-1-1', type:'choice', cat:'expr', level:1, q:'처음 만난 친구에게 하는 인사로 알맞은 것은?', choices:['Nice to meet you.','Good night.','See you.','I am sorry.'], a:'Nice to meet you.', hint:'만나서 반가워' },
  { id:'p_en411_05', unitId:'en4-1-1', type:'short', cat:'vocab', level:2, q:'"고맙습니다"를 영어로 두 단어로 쓰세요.', a:'thank you', alt:['Thank you','thankyou'], hint:'Thank …' },
  { id:'p_en411_06', unitId:'en4-1-1', type:'choice', cat:'dialog', level:2, q:'"What\'s your name?" 에 대한 알맞은 대답은?', choices:['My name is Mina.','I am ten years old.','It is a cat.','Yes, I do.'], a:'My name is Mina.', hint:'이름을 묻는 말이에요' },

  // ── 영어 L2. I'm Happy (감정·안부) ───────────
  { id:'p_en412_11', unitId:'en4-1-2', type:'choice', cat:'expr', level:1, q:'"I\'m happy." 의 뜻은?', choices:['나는 행복해.','나는 슬퍼.','나는 배고파.','나는 졸려.'], a:'나는 행복해.', hint:'happy = 행복한' },
  { id:'p_en412_12', unitId:'en4-1-2', type:'short', cat:'vocab', level:1, q:'"슬픈"을 뜻하는 영어 단어를 쓰세요.', a:'sad', alt:['Sad'], hint:'s로 시작하는 세 글자' },
  { id:'p_en412_13', unitId:'en4-1-2', type:'choice', cat:'dialog', level:2, q:'"How are you?" 에 대한 알맞은 대답은?', choices:['I am fine, thank you.','My name is Tom.','It is a book.','Yes, I can.'], a:'I am fine, thank you.', hint:'기분·안부를 묻는 말이에요' },
  { id:'p_en412_14', unitId:'en4-1-2', type:'choice', cat:'expr', level:2, q:'"I\'m angry." 는 어떤 기분일까요?', choices:['화가 난다','기쁘다','무섭다','심심하다'], a:'화가 난다', hint:'angry = 화난' },
  { id:'p_en412_15', unitId:'en4-1-2', type:'short', cat:'vocab', level:2, q:'"배고픈"을 뜻하는 영어 단어를 쓰세요.', a:'hungry', alt:['Hungry'], hint:'h로 시작해요' },

  // ── 영어 L3. Don't Sit Here (금지) ───────────
  { id:'p_en413_11', unitId:'en4-1-3', type:'choice', cat:'expr', level:1, q:'"Don\'t run!" 의 뜻은?', choices:['뛰지 마!','뛰어!','달려 봐!','걷지 마!'], a:'뛰지 마!', hint:'Don\'t = ~하지 마' },
  { id:'p_en413_12', unitId:'en4-1-3', type:'choice', cat:'expr', level:1, q:'"Don\'t sit here." 의 뜻은?', choices:['여기 앉지 마세요.','여기 앉으세요.','여기서 주무세요.','여기로 오세요.'], a:'여기 앉지 마세요.', hint:'sit = 앉다' },
  { id:'p_en413_13', unitId:'en4-1-3', type:'choice', cat:'dialog', level:2, q:'도서관에서 "조용히 해 주세요"라고 말하려면?', choices:['Please be quiet.','Let\'s run.','I want pizza.','How are you?'], a:'Please be quiet.', hint:'quiet = 조용한' },
  { id:'p_en413_14', unitId:'en4-1-3', type:'choice', cat:'expr', level:2, q:'"~하지 마"라고 금지할 때 문장 맨 앞에 쓰는 말은?', choices:['Don\'t','Let\'s','Please','Can'], a:'Don\'t', hint:'do not을 줄인 말이에요' },

  // ── 영어 L4. Let's Play Basketball (제안) ────
  { id:'p_en414_11', unitId:'en4-1-4', type:'choice', cat:'expr', level:1, q:'"Let\'s play soccer." 의 뜻은?', choices:['우리 축구하자.','나는 축구를 잘해.','축구는 재미있다.','축구하지 마.'], a:'우리 축구하자.', hint:'Let\'s = 우리 ~하자' },
  { id:'p_en414_12', unitId:'en4-1-4', type:'choice', cat:'dialog', level:2, q:'친구에게 "우리 배드민턴 치자"라고 제안하려면?', choices:['Let\'s play badminton.','Don\'t play badminton.','I can play badminton.','It is badminton.'], a:'Let\'s play badminton.', hint:'제안은 Let\'s로 시작해요' },
  { id:'p_en414_13', unitId:'en4-1-4', type:'choice', cat:'expr', level:2, q:'"Let\'s ~" 제안에 좋다고 대답하는 말은?', choices:['Good idea!','I am sorry to hear that.','It is Monday.','He is my dad.'], a:'Good idea!', hint:'좋은 생각이야!' },
  { id:'p_en414_14', unitId:'en4-1-4', type:'short', cat:'vocab', level:1, q:'"놀다, (운동 경기를) 하다"를 뜻하는 영어 단어를 쓰세요.', a:'play', alt:['Play'], hint:'p로 시작해요' },

  // ── 영어 L5. I Want Chicken (음식·원하는 것) ─
  { id:'p_en415_11', unitId:'en4-1-5', type:'choice', cat:'expr', level:1, q:'"I want chicken." 의 뜻은?', choices:['나는 치킨을 원해.','나는 치킨을 좋아해.','치킨은 맛있다.','나는 치킨이 있어.'], a:'나는 치킨을 원해.', hint:'want = 원하다' },
  { id:'p_en415_12', unitId:'en4-1-5', type:'choice', cat:'dialog', level:2, q:'"Do you want some pizza?" 에 "응, 부탁해"로 답하려면?', choices:['Yes, please.','No, I am not.','It is a pizza.','I am ten.'], a:'Yes, please.', hint:'공손하게 받을 때는 please' },
  { id:'p_en415_13', unitId:'en4-1-5', type:'choice', cat:'expr', level:2, q:'"What do you want?" 는 무엇을 묻는 말일까요?', choices:['원하는 것','사는 곳','요일','날씨'], a:'원하는 것', hint:'want = 원하다' },
  { id:'p_en415_14', unitId:'en4-1-5', type:'short', cat:'vocab', level:1, q:'"물"을 뜻하는 영어 단어를 쓰세요.', a:'water', alt:['Water'], hint:'w로 시작해요' },
  { id:'p_en415_15', unitId:'en4-1-5', type:'short', cat:'vocab', level:1, q:'"우유"를 뜻하는 영어 단어를 쓰세요.', a:'milk', alt:['Milk'], hint:'m으로 시작해요' },

  // ── 영어 L6. Where's My Cap? (위치) ──────────
  { id:'p_en416_11', unitId:'en4-1-6', type:'choice', cat:'expr', level:1, q:'"Where is my cap?" 는 무엇을 묻는 말일까요?', choices:['모자가 어디 있는지','모자가 얼마인지','모자가 누구 것인지','모자가 무슨 색인지'], a:'모자가 어디 있는지', hint:'where = 어디' },
  { id:'p_en416_12', unitId:'en4-1-6', type:'choice', cat:'expr', level:1, q:'"It\'s on the desk." 의 뜻은?', choices:['책상 위에 있어.','책상 아래에 있어.','책상 안에 있어.','책상 옆에 있어.'], a:'책상 위에 있어.', hint:'on = ~위에' },
  { id:'p_en416_13', unitId:'en4-1-6', type:'choice', cat:'expr', level:2, q:'"상자 안에"를 뜻하는 말은?', choices:['in the box','on the box','under the box','by the box'], a:'in the box', hint:'in = ~안에' },
  { id:'p_en416_14', unitId:'en4-1-6', type:'choice', cat:'expr', level:2, q:'"It\'s under the chair." 에서 물건은 어디에 있을까요?', choices:['의자 아래','의자 위','의자 안','의자 뒤'], a:'의자 아래', hint:'under = ~아래에' },
  { id:'p_en416_15', unitId:'en4-1-6', type:'short', cat:'vocab', level:2, q:'"어디"를 뜻하는 영어 단어를 쓰세요.', a:'where', alt:['Where'], hint:'wh로 시작해요' },

  // ── 사회 1. 지도로 만나는 우리 지역 ──────────
  { id:'p_so411_01', unitId:'so4-1-1', type:'choice', cat:'concept', level:1, q:'지도에서 방위표가 없을 때 위쪽은 어느 방향일까요?', choices:['북쪽','남쪽','동쪽','서쪽'], a:'북쪽', hint:'지도의 기본 약속이에요' },
  { id:'p_so411_02', unitId:'so4-1-1', type:'choice', cat:'concept', level:1, q:'지도에서 실제 거리를 줄인 정도를 나타내는 것은?', choices:['축척','범례','방위표','등고선'], a:'축척', hint:'얼마나 줄였는지 알려줘요' },
  { id:'p_so411_03', unitId:'so4-1-1', type:'choice', cat:'concept', level:1, q:'지도에서 기호가 무엇을 뜻하는지 알려 주는 것은?', choices:['범례','축척','방위표','좌표'], a:'범례', hint:'기호 설명표예요' },
  { id:'p_so411_04', unitId:'so4-1-1', type:'choice', cat:'concept', level:2, q:'땅의 높낮이를 나타내기 위해 같은 높이를 이은 선은?', choices:['등고선','축척','범례','경계선'], a:'등고선', hint:'높을수록 안쪽에 그려요' },
  { id:'p_so411_07', unitId:'so4-1-1', type:'choice', cat:'concept', level:1, q:'컴퓨터나 스마트폰에서 위성 사진처럼 지역의 모습을 살펴볼 수 있는 지도는?', choices:['디지털 영상 지도','등고선','범례','축척'], a:'디지털 영상 지도', hint:'확대·축소도 마음대로 할 수 있어요' },
  { id:'p_so411_08', unitId:'so4-1-1', type:'choice', cat:'apply', level:2, q:'다음 중 자연환경이 아닌 것은?', choices:['학교','산','강','바다'], a:'학교', hint:'사람이 만든 것은 인문환경이에요' },

  // ── 사회 2. 우리 지역의 국가유산 ─────────────
  //   (2024년부터 '문화재' 대신 '국가유산' 체제: 문화유산·자연유산·무형유산)
  { id:'p_so412_01', unitId:'so4-1-2', type:'choice', cat:'concept', level:1, q:'조상들이 남긴 것 중 보호할 가치가 있어 오늘날까지 전해지는 것을 무엇이라 할까요?', choices:['국가유산','자연환경','공공기관','중심지'], a:'국가유산', hint:'조상들이 물려준 소중한 것' },
  { id:'p_so412_02', unitId:'so4-1-2', type:'choice', cat:'concept', level:1, q:'건축물이나 유물처럼 형태가 있는 국가유산을 무엇이라 할까요?', choices:['문화유산','무형유산','자연유산','기록유산'], a:'문화유산', hint:'눈에 보이고 만질 수 있어요' },
  { id:'p_so412_03', unitId:'so4-1-2', type:'choice', cat:'concept', level:2, q:'판소리나 탈춤처럼 형태가 없이 사람에게서 사람으로 전해지는 국가유산은?', choices:['무형유산','문화유산','자연유산','천연기념물'], a:'무형유산', hint:'사람의 기술·솜씨로 이어져요' },
  { id:'p_so412_06', unitId:'so4-1-2', type:'choice', cat:'concept', level:2, q:'명승이나 천연기념물처럼 자연물 가운데 보호하는 국가유산을 무엇이라 할까요?', choices:['자연유산','문화유산','무형유산','기록유산'], a:'자연유산', hint:'자연이 만든 소중한 것' },
  { id:'p_so412_04', unitId:'so4-1-2', type:'choice', cat:'apply', level:2, q:'지역의 국가유산을 조사하는 방법으로 알맞지 않은 것은?', choices:['마음대로 상상해서 적기','직접 답사하기','누리집에서 찾아보기','해설사께 여쭤보기'], a:'마음대로 상상해서 적기', hint:'조사는 사실을 확인하는 일이에요' },
  { id:'p_so412_05', unitId:'so4-1-2', type:'choice', cat:'concept', level:2, q:'국가유산을 답사할 때 지켜야 할 태도로 알맞은 것은?', choices:['함부로 만지지 않는다','기념으로 조금 떼어 온다','큰 소리로 뛰어다닌다','낙서를 남긴다'], a:'함부로 만지지 않는다', hint:'모두의 소중한 유산이에요' },

  // ── 사회 3. 경제활동과 지역 간 교류 ──────────
  { id:'p_so413_01', unitId:'so4-1-3', type:'choice', cat:'concept', level:1, q:'사람들이 생활에 필요한 것을 만들고, 사고파는 것과 관련된 모든 활동을 무엇이라 할까요?', choices:['경제활동','문화 활동','봉사 활동','체육 활동'], a:'경제활동', hint:'만들고, 팔고, 사는 일 모두요' },
  { id:'p_so413_02', unitId:'so4-1-3', type:'choice', cat:'concept', level:2, q:'사람들이 원하는 것은 많은데 그것을 모두 가질 수 없는 상태를 무엇이라 할까요?', choices:['희소성','다양성','편리성','안전성'], a:'희소성', hint:'돈과 자원은 한정되어 있어요' },
  { id:'p_so413_03', unitId:'so4-1-3', type:'choice', cat:'concept', level:2, q:'합리적 선택이란 무엇일까요?', choices:['가격과 품질을 따져 가장 큰 만족을 얻도록 고르는 것','무조건 비싼 것을 사는 것','친구가 사는 것을 그대로 따라 사는 것','광고에 나오면 바로 사는 것'], a:'가격과 품질을 따져 가장 큰 만족을 얻도록 고르는 것', hint:'여러 가지를 비교해 봐요' },
  { id:'p_so413_04', unitId:'so4-1-3', type:'choice', cat:'apply', level:1, q:'상품이 어디에서 왔는지 알아보는 방법으로 알맞지 않은 것은?', choices:['눈을 감고 상상하기','포장지의 표시 살펴보기','큐아르(QR) 코드 찍어 보기','누리집에서 찾아보기'], a:'눈을 감고 상상하기', hint:'포장지에 생산지가 적혀 있어요' },
  { id:'p_so413_05', unitId:'so4-1-3', type:'choice', cat:'concept', level:2, q:'지역과 지역이 물건·기술·문화 등을 서로 주고받는 것을 무엇이라 할까요?', choices:['교류','경쟁','저축','독점'], a:'교류', hint:'서로 오가며 주고받아요' },
  { id:'p_so413_06', unitId:'so4-1-3', type:'choice', cat:'apply', level:2, q:'지역 간에 교류가 이루어지는 까닭으로 알맞은 것은?', choices:['지역마다 자연환경과 생산물이 다르기 때문','모든 지역이 똑같은 물건을 만들기 때문','교류를 하면 물건이 사라지기 때문','다른 지역과 만나면 안 되기 때문'], a:'지역마다 자연환경과 생산물이 다르기 때문', hint:'서로 다르니까 주고받을 것이 생겨요' },
  // ── 수학 1. 큰 수 (추가) ──────────────────────
  { id:'p_ma411_09', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'10000이 7개인 수는 얼마일까요?', a:'70000', hint:'10000 × 7' },
  { id:'p_ma411_10', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'숫자 85310에서 만의 자리 숫자는 무엇일까요?', a:'8', hint:'왼쪽 첫 자리가 만의 자리예요' },
  { id:'p_ma411_11', unitId:'ma4-1-1', type:'choice', cat:'concept', level:2, q:'다음 중 가장 작은 수는?', choices:['40200','40020','42000','40002'], a:'40002', hint:'앞자리부터 차례로 비교해요' },
  { id:'p_ma411_12', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'1000만이 10개 모이면 얼마일까요? (억 단위로, 숫자만 — 1억이면 1)', a:'1', hint:'1000만 × 10 = 1억' },
  { id:'p_ma411_13', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'52000에서 10000씩 3번 뛰어 센 수는?', a:'82000', hint:'10000씩 커지면 만의 자리가 1씩 늘어요' },
  { id:'p_ma411_14', unitId:'ma4-1-1', type:'choice', cat:'concept', level:2, q:'"이천삼백사십오"를 숫자로 바르게 쓴 것은?', choices:['2345','23450','20345','2045'], a:'2345', hint:'천·백·십·일 자리를 차례로 놓아요' },
  { id:'p_ma411_15', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'3, 1, 9, 4를 한 번씩 써서 만들 수 있는 가장 작은 네 자리 수는?', a:'1349', hint:'작은 숫자를 앞자리부터 놓아요' },

  // ── 수학 2. 각도 (추가) ──────────────────────
  { id:'p_ma412_08', unitId:'ma4-1-2', type:'choice', cat:'concept', level:1, q:'평각은 몇 도일까요?', choices:['90도','180도','270도','360도'], a:'180도', hint:'일직선으로 펴진 각이에요' },
  { id:'p_ma412_09', unitId:'ma4-1-2', type:'choice', cat:'concept', level:1, q:'크기가 89도인 각은 어떤 각일까요?', choices:['예각','직각','둔각','평각'], a:'예각', hint:'90도보다 작으면 예각' },
  { id:'p_ma412_10', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'45도 + 30도 = 몇 도일까요? (숫자만)', a:'75', hint:'각도끼리 더해요' },
  { id:'p_ma412_11', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'120도 − 45도 = 몇 도일까요? (숫자만)', a:'75', hint:'각도끼리 빼요' },
  { id:'p_ma412_12', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'삼각형에서 두 각이 30도, 60도일 때 나머지 한 각은 몇 도일까요?', a:'90', hint:'180 − (30 + 60)' },
  { id:'p_ma412_13', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'직각을 반으로 나눈 각은 몇 도일까요? (숫자만)', a:'45', hint:'90 ÷ 2' },
  { id:'p_ma412_14', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'사각형에서 세 각이 70도, 110도, 85도일 때 나머지 한 각은 몇 도일까요?', a:'95', hint:'360 − (70 + 110 + 85)' },
  { id:'p_ma412_15', unitId:'ma4-1-2', type:'choice', cat:'concept', level:3, q:'세 각이 모두 60도인 삼각형에서 세 각의 합은?', choices:['180도','150도','200도','120도'], a:'180도', hint:'60 × 3' },

  // ── 수학 3. 곱셈과 나눗셈 (추가) ──────────────
  { id:'p_ma413_09', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'302 × 30 = ?', a:'9060', hint:'302 × 3 = 906, 뒤에 0을 붙여요' },
  { id:'p_ma413_10', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'240 × 20 = ?', a:'4800', hint:'24 × 2 = 48, 0을 두 개 붙여요' },
  { id:'p_ma413_11', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'216 × 34 = ?', a:'7344', hint:'216×30 = 6480, 216×4 = 864' },
  { id:'p_ma413_12', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'560 ÷ 40 = ?', a:'14', hint:'56 ÷ 4 로 생각해 보세요' },
  { id:'p_ma413_13', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'391 ÷ 17 = ?', a:'23', hint:'17 × 23 = 391' },
  { id:'p_ma413_14', unitId:'ma4-1-3', type:'number', cat:'calc', level:3, q:'275 ÷ 18 의 나머지는 얼마일까요?', a:'5', hint:'18 × 15 = 270' },
  { id:'p_ma413_15', unitId:'ma4-1-3', type:'number', cat:'word', level:3, q:'색종이 432장을 24명에게 똑같이 나누어 주면 한 사람이 몇 장씩 받을까요?', a:'18', hint:'432 ÷ 24' },

  // ── 수학 4. 평면도형의 이동 (추가) ────────────
  { id:'p_ma414_07', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'도형을 왼쪽으로 밀면 무엇이 달라질까요?', choices:['위치','모양','크기','아무것도 안 달라짐'], a:'위치', hint:'밀기는 자리만 옮겨요' },
  { id:'p_ma414_08', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'도형을 위쪽으로 뒤집으면 어떻게 될까요?', choices:['위아래가 바뀐다','좌우가 바뀐다','크기가 커진다','변화 없다'], a:'위아래가 바뀐다', hint:'뒤집는 방향으로 바뀌어요' },
  { id:'p_ma414_09', unitId:'ma4-1-4', type:'number', cat:'calc', level:2, q:'도형을 시계 방향으로 90도씩 2번 돌리면 모두 몇 도를 돌린 걸까요? (숫자만)', a:'180', hint:'90 × 2' },
  { id:'p_ma414_10', unitId:'ma4-1-4', type:'choice', cat:'concept', level:2, q:'도형을 왼쪽으로 두 번 뒤집으면 어떻게 될까요?', choices:['처음과 같아진다','좌우가 바뀐다','위아래가 바뀐다','크기가 작아진다'], a:'처음과 같아진다', hint:'두 번 뒤집으면 원래대로 돌아와요' },
  { id:'p_ma414_11', unitId:'ma4-1-4', type:'number', cat:'calc', level:2, q:'도형을 시계 방향으로 90도씩 몇 번 돌려야 처음과 같아질까요? (숫자만)', a:'4', hint:'360 ÷ 90' },
  { id:'p_ma414_12', unitId:'ma4-1-4', type:'choice', cat:'concept', level:2, q:'점을 오른쪽으로 3칸, 아래로 2칸 옮겼습니다. 이런 이동을 무엇이라 할까요?', choices:['밀기','뒤집기','돌리기','늘이기'], a:'밀기', hint:'자리만 옮기는 이동이에요' },
  { id:'p_ma414_13', unitId:'ma4-1-4', type:'choice', cat:'concept', level:3, q:'도형을 시계 반대 방향으로 90도 돌린 것과 같은 결과가 되는 것은?', choices:['시계 방향으로 270도 돌리기','시계 방향으로 90도 돌리기','오른쪽으로 뒤집기','아래로 밀기'], a:'시계 방향으로 270도 돌리기', hint:'한 바퀴는 360도예요' },
  { id:'p_ma414_14', unitId:'ma4-1-4', type:'choice', cat:'concept', level:3, q:'무늬를 꾸밀 때 같은 모양을 반복해서 옮기는 방법이 아닌 것은?', choices:['색칠하기','밀기','뒤집기','돌리기'], a:'색칠하기', hint:'이동 방법은 밀기·뒤집기·돌리기 세 가지예요' },
  { id:'p_ma414_15', unitId:'ma4-1-4', type:'number', cat:'calc', level:3, q:'도형을 시계 방향으로 180도 돌린 뒤 다시 180도 돌렸습니다. 모두 몇 도를 돌린 걸까요? (숫자만)', a:'360', hint:'180 + 180' },

  // ── 수학 5. 막대그래프 (추가) ─────────────────
  { id:'p_ma415_15', unitId:'ma4-1-5', type:'choice', cat:'concept', level:1, q:'막대그래프에서 가로와 세로 중 무엇을 나타내는지 적는 곳을 무엇이라 할까요?', choices:['항목과 눈금','제목','범례','축척'], a:'항목과 눈금', hint:'가로·세로에 무엇을 나타낼지 정해요' },
  { id:'p_ma415_07', unitId:'ma4-1-5', type:'number', cat:'calc', level:1, q:'눈금 한 칸이 1명인 막대그래프에서 막대가 8칸이면 몇 명일까요?', a:'8', hint:'한 칸이 1명이에요' },
  { id:'p_ma415_08', unitId:'ma4-1-5', type:'number', cat:'calc', level:2, q:'눈금 한 칸이 5권인 막대그래프에서 막대가 6칸이면 몇 권일까요?', a:'30', hint:'5 × 6' },
  { id:'p_ma415_09', unitId:'ma4-1-5', type:'number', cat:'word', level:2, q:'좋아하는 과일을 조사했더니 사과 12명, 배 8명, 귤 15명이었습니다. 조사한 학생은 모두 몇 명일까요?', a:'35', hint:'12 + 8 + 15' },
  { id:'p_ma415_10', unitId:'ma4-1-5', type:'number', cat:'calc', level:2, q:'가장 많은 항목이 20명, 가장 적은 항목이 7명입니다. 차이는 몇 명일까요?', a:'13', hint:'20 − 7' },
  { id:'p_ma415_11', unitId:'ma4-1-5', type:'choice', cat:'concept', level:2, q:'막대그래프에서 막대가 가장 긴 항목은 무엇을 뜻할까요?', choices:['가장 많은 것','가장 적은 것','가장 비싼 것','가장 오래된 것'], a:'가장 많은 것', hint:'막대가 길수록 수가 많아요' },
  { id:'p_ma415_12', unitId:'ma4-1-5', type:'number', cat:'calc', level:3, q:'눈금 한 칸이 4명인 막대그래프에서 28명을 나타내려면 몇 칸을 그려야 할까요?', a:'7', hint:'28 ÷ 4' },
  { id:'p_ma415_13', unitId:'ma4-1-5', type:'choice', cat:'concept', level:3, q:'자료를 조사해 막대그래프로 나타내는 순서로 알맞은 것은?', choices:['자료 조사 → 표 만들기 → 막대그래프 그리기','막대그래프 그리기 → 자료 조사','표 만들기 → 자료 조사','제목 정하기 → 막대 색칠하기'], a:'자료 조사 → 표 만들기 → 막대그래프 그리기', hint:'먼저 자료를 모아야 해요' },
  { id:'p_ma415_14', unitId:'ma4-1-5', type:'number', cat:'calc', level:3, q:'눈금 한 칸이 2명인 막대그래프에서 어떤 항목의 막대가 9칸입니다. 몇 명일까요?', a:'18', hint:'2 × 9' },

  // ── 수학 6. 규칙과 관계 (추가) ────────────────
  { id:'p_ma416_09', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'5, 10, 15, 20, □ … 빈칸에 알맞은 수는?', a:'25', hint:'5씩 커지고 있어요' },
  { id:'p_ma416_10', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'81, 72, 63, 54, □ … 빈칸에 알맞은 수는?', a:'45', hint:'9씩 작아져요' },
  { id:'p_ma416_11', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'3, 9, 27, □ … 빈칸에 알맞은 수는?', a:'81', hint:'3배씩 커져요' },
  { id:'p_ma416_12', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'12 + 8 = □ + 5 에서 □에 알맞은 수는?', a:'15', hint:'12+8을 먼저 계산해요' },
  { id:'p_ma416_13', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'20 − 7 = □ − 10 에서 □에 알맞은 수는?', a:'23', hint:'20−7을 먼저 계산하고, 거기에 10을 더해요' },
  { id:'p_ma416_14', unitId:'ma4-1-6', type:'choice', cat:'concept', level:3, q:'등호(=)의 뜻으로 알맞은 것은?', choices:['양쪽의 크기가 같다','왼쪽이 더 크다','오른쪽이 더 크다','계산하라는 뜻이다'], a:'양쪽의 크기가 같다', hint:'저울이 균형을 이룬 모습이에요' },
  { id:'p_ma416_15', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'첫째 줄 2개, 둘째 줄 4개, 셋째 줄 6개… 여섯째 줄에는 몇 개일까요?', a:'12', hint:'2씩 늘어나요. 2 × 6' },

  // ── 영어 L1. My Name Is Amy (추가) ───────────
  { id:'p_en411_07', unitId:'en4-1-1', type:'choice', cat:'expr', level:1, q:'"Hi, I\'m Suho." 에서 Suho는 무엇일까요?', choices:['이름','나이','사는 곳','좋아하는 것'], a:'이름', hint:'I\'m 뒤에 이름을 말해요' },
  { id:'p_en411_08', unitId:'en4-1-1', type:'choice', cat:'expr', level:1, q:'헤어질 때 하는 인사로 알맞은 것은?', choices:['Good bye.','Nice to meet you.','My name is Tom.','Here you are.'], a:'Good bye.', hint:'안녕히 가세요' },
  { id:'p_en411_09', unitId:'en4-1-1', type:'short', cat:'vocab', level:2, q:'"이름"을 뜻하는 영어 단어를 쓰세요.', a:'name', alt:['Name'], hint:'n으로 시작하는 네 글자' },
  { id:'p_en411_10', unitId:'en4-1-1', type:'choice', cat:'dialog', level:2, q:'"Nice to meet you." 에 대한 대답으로 알맞은 것은?', choices:['Nice to meet you, too.','No, thank you.','It is a pen.','I am hungry.'], a:'Nice to meet you, too.', hint:'나도 반가워' },
  { id:'p_en411_11', unitId:'en4-1-1', type:'choice', cat:'dialog', level:2, q:'아침에 만난 선생님께 하는 인사는?', choices:['Good morning.','Good night.','See you later.','I am sorry.'], a:'Good morning.', hint:'morning = 아침' },

  // ── 영어 L2. I'm Happy (추가) ────────────────
  { id:'p_en412_16', unitId:'en4-1-2', type:'short', cat:'vocab', level:1, q:'"행복한"을 뜻하는 영어 단어를 쓰세요.', a:'happy', alt:['Happy'], hint:'h로 시작해요' },
  { id:'p_en412_17', unitId:'en4-1-2', type:'choice', cat:'expr', level:1, q:'"I\'m tired." 는 어떤 기분일까요?', choices:['피곤하다','신난다','배부르다','춥다'], a:'피곤하다', hint:'tired = 피곤한' },
  { id:'p_en412_18', unitId:'en4-1-2', type:'choice', cat:'dialog', level:2, q:'친구가 슬퍼 보일 때 물어볼 말로 알맞은 것은?', choices:['Are you okay?','How much is it?','What time is it?','Let\'s eat.'], a:'Are you okay?', hint:'괜찮니?' },
  { id:'p_en412_19', unitId:'en4-1-2', type:'short', cat:'vocab', level:2, q:'"목마른"을 뜻하는 영어 단어를 쓰세요.', a:'thirsty', alt:['Thirsty'], hint:'th로 시작해요' },
  { id:'p_en412_20', unitId:'en4-1-2', type:'choice', cat:'expr', level:2, q:'"I\'m fine." 의 뜻으로 알맞은 것은?', choices:['나는 괜찮아.','나는 배고파.','나는 다섯 살이야.','나는 학생이야.'], a:'나는 괜찮아.', hint:'fine = 좋은, 괜찮은' },

  // ── 영어 L3. Don't Sit Here (추가) ───────────
  { id:'p_en413_15', unitId:'en4-1-3', type:'choice', cat:'expr', level:1, q:'"Don\'t touch." 의 뜻은?', choices:['만지지 마.','만져 봐.','들어 봐.','보지 마.'], a:'만지지 마.', hint:'touch = 만지다' },
  { id:'p_en413_16', unitId:'en4-1-3', type:'choice', cat:'dialog', level:1, q:'복도에서 친구에게 "뛰지 마"라고 하려면?', choices:['Don\'t run.','Let\'s run.','I can run.','Do you run?'], a:'Don\'t run.', hint:'금지는 Don\'t로 시작해요' },
  { id:'p_en413_17', unitId:'en4-1-3', type:'choice', cat:'expr', level:2, q:'"Don\'t open the door." 의 뜻은?', choices:['문을 열지 마세요.','문을 닫지 마세요.','문을 여세요.','문이 열려 있어요.'], a:'문을 열지 마세요.', hint:'open = 열다' },
  { id:'p_en413_18', unitId:'en4-1-3', type:'short', cat:'vocab', level:2, q:'"밀다"를 뜻하는 영어 단어를 쓰세요.', a:'push', alt:['Push'], hint:'p로 시작하는 네 글자' },
  { id:'p_en413_19', unitId:'en4-1-3', type:'choice', cat:'expr', level:2, q:'"Don\'t" 는 무엇을 줄인 말일까요?', choices:['do not','did not','does not','done not'], a:'do not', hint:'do와 not을 합친 말이에요' },
  { id:'p_en413_20', unitId:'en4-1-3', type:'choice', cat:'expr', level:2, q:'"Don\'t be late." 의 뜻은?', choices:['늦지 마.','일찍 와.','기다려.','서두르지 마.'], a:'늦지 마.', hint:'late = 늦은' },

  // ── 영어 L4. Let's Play Basketball (추가) ────
  { id:'p_en414_15', unitId:'en4-1-4', type:'choice', cat:'expr', level:1, q:'"Let\'s go." 의 뜻은?', choices:['우리 가자.','나는 갔어.','너 갈래?','가지 마.'], a:'우리 가자.', hint:'Let\'s = 우리 ~하자' },
  { id:'p_en414_16', unitId:'en4-1-4', type:'choice', cat:'expr', level:1, q:'"Let\'s eat lunch." 는 무엇을 하자는 말일까요?', choices:['점심 먹기','아침 먹기','운동하기','공부하기'], a:'점심 먹기', hint:'lunch = 점심' },
  { id:'p_en414_17', unitId:'en4-1-4', type:'choice', cat:'expr', level:2, q:'"Let\'s ~" 제안을 거절할 때 알맞은 말은?', choices:['Sorry, I can\'t.','Good idea!','Yes, let\'s.','Sure.'], a:'Sorry, I can\'t.', hint:'미안해, 안 될 것 같아' },
  { id:'p_en414_18', unitId:'en4-1-4', type:'short', cat:'vocab', level:2, q:'"농구"를 뜻하는 영어 단어를 쓰세요.', a:'basketball', alt:['Basketball'], hint:'basket + ball' },
  { id:'p_en414_19', unitId:'en4-1-4', type:'choice', cat:'vocab', level:2, q:'"우리 같이 노래하자"를 영어로 알맞게 쓴 것은?', choices:['Let\'s sing together.','Don\'t sing.','I sing well.','Can you sing?'], a:'Let\'s sing together.', hint:'together = 함께' },
  { id:'p_en414_20', unitId:'en4-1-4', type:'short', cat:'vocab', level:1, q:'"축구"를 뜻하는 영어 단어를 쓰세요.', a:'soccer', alt:['Soccer','football','Football'], hint:'s로 시작해요' },

  // ── 영어 L5. I Want Chicken (추가) ───────────
  { id:'p_en415_16', unitId:'en4-1-5', type:'short', cat:'vocab', level:1, q:'"빵"을 뜻하는 영어 단어를 쓰세요.', a:'bread', alt:['Bread'], hint:'b로 시작해요' },
  { id:'p_en415_17', unitId:'en4-1-5', type:'choice', cat:'expr', level:1, q:'"I want water." 의 뜻은?', choices:['나는 물을 원해.','나는 물을 마셨어.','물이 차가워.','물이 없어.'], a:'나는 물을 원해.', hint:'want = 원하다' },
  { id:'p_en415_18', unitId:'en4-1-5', type:'choice', cat:'dialog', level:2, q:'음식을 권할 때 "고맙지만 괜찮아"라고 답하려면?', choices:['No, thank you.','Yes, please.','Here you are.','You\'re welcome.'], a:'No, thank you.', hint:'정중하게 거절하는 말이에요' },
  { id:'p_en415_19', unitId:'en4-1-5', type:'choice', cat:'expr', level:2, q:'"Here you are." 는 어떤 상황에서 쓸까요?', choices:['물건을 건네줄 때','헤어질 때','처음 만났을 때','사과할 때'], a:'물건을 건네줄 때', hint:'여기 있어' },
  { id:'p_en415_20', unitId:'en4-1-5', type:'short', cat:'vocab', level:1, q:'"우유"가 아니라 "주스"를 뜻하는 영어 단어를 쓰세요.', a:'juice', alt:['Juice'], hint:'j로 시작해요' },

  // ── 영어 L6. Where's My Cap? (추가) ──────────
  { id:'p_en416_16', unitId:'en4-1-6', type:'choice', cat:'expr', level:1, q:'"It\'s in the bag." 의 뜻은?', choices:['가방 안에 있어.','가방 위에 있어.','가방 아래에 있어.','가방이 없어.'], a:'가방 안에 있어.', hint:'in = ~안에' },
  { id:'p_en416_17', unitId:'en4-1-6', type:'short', cat:'vocab', level:1, q:'"책상"을 뜻하는 영어 단어를 쓰세요.', a:'desk', alt:['Desk'], hint:'d로 시작하는 네 글자' },
  { id:'p_en416_18', unitId:'en4-1-6', type:'choice', cat:'vocab', level:2, q:'"~위에"를 뜻하는 영어 단어는?', choices:['on','in','under','out'], a:'on', hint:'책상 위 = on the desk' },
  { id:'p_en416_19', unitId:'en4-1-6', type:'choice', cat:'dialog', level:2, q:'"Where is my bag?" 에 대한 대답으로 알맞은 것은?', choices:['It\'s under the chair.','It\'s a bag.','Yes, it is.','I like bags.'], a:'It\'s under the chair.', hint:'어디 있는지 답해야 해요' },
  { id:'p_en416_20', unitId:'en4-1-6', type:'short', cat:'vocab', level:1, q:'"모자"를 뜻하는 영어 단어를 쓰세요. (c로 시작)', a:'cap', alt:['Cap'], hint:'c로 시작하는 세 글자' },

  // ── 사회 1. 지도로 만나는 우리 지역 (추가) ────
  { id:'p_so411_09', unitId:'so4-1-1', type:'choice', cat:'concept', level:1, q:'위에서 내려다본 땅의 모습을 일정하게 줄여서 나타낸 것을 무엇이라 할까요?', choices:['지도','사진','그림','일기'], a:'지도', hint:'약속된 기호로 나타내요' },
  { id:'p_so411_10', unitId:'so4-1-1', type:'choice', cat:'concept', level:1, q:'지도에서 동서남북을 알려 주는 것은?', choices:['방위표','축척','범례','등고선'], a:'방위표', hint:'화살표로 북쪽을 가리켜요' },
  { id:'p_so411_11', unitId:'so4-1-1', type:'choice', cat:'concept', level:1, q:'지도에서 북쪽의 반대 방향은?', choices:['남쪽','동쪽','서쪽','북서쪽'], a:'남쪽', hint:'지도 아래쪽이에요' },
  { id:'p_so411_12', unitId:'so4-1-1', type:'choice', cat:'concept', level:2, q:'등고선에서 색이 진할수록 무엇을 나타낼까요?', choices:['땅이 높음','땅이 낮음','물이 깊음','사람이 많음'], a:'땅이 높음', hint:'높은 곳일수록 진하게 칠해요' },
  { id:'p_so411_13', unitId:'so4-1-1', type:'choice', cat:'apply', level:2, q:'다음 중 인문환경에 해당하는 것은?', choices:['도로','산','바다','하천'], a:'도로', hint:'사람이 만든 것이 인문환경이에요' },
  { id:'p_so411_14', unitId:'so4-1-1', type:'choice', cat:'apply', level:2, q:'우리 지역의 위치를 설명할 때 알맞지 않은 것은?', choices:['내가 좋아하는 색','이웃한 시·군','바다와 접해 있는지','지도에서의 방위'], a:'내가 좋아하는 색', hint:'위치는 사실로 설명해요' },
  { id:'p_so411_15', unitId:'so4-1-1', type:'choice', cat:'apply', level:2, q:'디지털 영상 지도의 좋은 점으로 알맞은 것은?', choices:['확대·축소하며 자세히 볼 수 있다','종이보다 무겁다','한 번 보면 지울 수 없다','색깔이 없다'], a:'확대·축소하며 자세히 볼 수 있다', hint:'손가락으로 크게 볼 수 있어요' },
  { id:'p_so411_16', unitId:'so4-1-1', type:'choice', cat:'apply', level:2, q:'축척이 필요한 까닭으로 알맞은 것은?', choices:['넓은 땅을 종이에 담기 위해','색을 예쁘게 칠하기 위해','글씨를 크게 쓰기 위해','지도를 접기 위해'], a:'넓은 땅을 종이에 담기 위해', hint:'실제 거리를 줄여서 그려요' },
  { id:'p_so411_17', unitId:'so4-1-1', type:'choice', cat:'concept', level:2, q:'다음 중 자연환경끼리 짝지어진 것은?', choices:['산과 하천','학교와 공원','도로와 다리','시장과 병원'], a:'산과 하천', hint:'자연이 만든 것이에요' },
  { id:'p_so411_18', unitId:'so4-1-1', type:'choice', cat:'apply', level:3, q:'지도에서 범례를 먼저 보아야 하는 까닭은?', choices:['기호가 무엇을 뜻하는지 알기 위해','지도를 접기 위해','색을 칠하기 위해','제목을 정하기 위해'], a:'기호가 무엇을 뜻하는지 알기 위해', hint:'기호 설명표예요' },
  { id:'p_so411_19', unitId:'so4-1-1', type:'choice', cat:'apply', level:3, q:'우리 지역을 조사하는 방법으로 알맞지 않은 것은?', choices:['상상해서 지어내기','지도 살펴보기','직접 답사하기','어른께 여쭤보기'], a:'상상해서 지어내기', hint:'조사는 사실을 확인하는 일이에요' },
  { id:'p_so411_20', unitId:'so4-1-1', type:'choice', cat:'concept', level:3, q:'지도에 방위표가 없을 때의 약속으로 알맞은 것은?', choices:['위쪽이 북쪽이다','위쪽이 남쪽이다','오른쪽이 북쪽이다','정해진 것이 없다'], a:'위쪽이 북쪽이다', hint:'지도의 기본 약속이에요' },

  // ── 사회 2. 우리 지역의 국가유산 (추가) ────────
  { id:'p_so412_07', unitId:'so4-1-2', type:'choice', cat:'concept', level:1, q:'국가유산을 조사할 때 직접 찾아가 보는 것을 무엇이라 할까요?', choices:['답사','상상','토론','발표'], a:'답사', hint:'현장에 직접 가는 거예요' },
  { id:'p_so412_08', unitId:'so4-1-2', type:'choice', cat:'apply', level:1, q:'다음 중 국가유산이 아닌 것은?', choices:['오늘 산 장난감','석굴암','판소리','경복궁'], a:'오늘 산 장난감', hint:'오래 전부터 전해 온 것이어야 해요' },
  { id:'p_so412_09', unitId:'so4-1-2', type:'choice', cat:'concept', level:1, q:'탈춤·판소리처럼 사람에게서 사람으로 전해지는 것은 어떤 유산일까요?', choices:['무형유산','문화유산','자연유산','기록유산'], a:'무형유산', hint:'형태가 없어요' },
  { id:'p_so412_10', unitId:'so4-1-2', type:'choice', cat:'apply', level:2, q:'국가유산을 보호해야 하는 까닭으로 알맞은 것은?', choices:['한번 사라지면 되돌릴 수 없어서','돈을 벌 수 있어서','새로 만들기 쉬워서','아무도 안 봐서'], a:'한번 사라지면 되돌릴 수 없어서', hint:'조상들이 남긴 소중한 것이에요' },
  { id:'p_so412_11', unitId:'so4-1-2', type:'choice', cat:'concept', level:2, q:'국가유산을 안내해 주는 사람을 무엇이라 할까요?', choices:['문화 해설사','운전기사','경찰관','소방관'], a:'문화 해설사', hint:'유산에 대해 설명해 줘요' },
  { id:'p_so412_12', unitId:'so4-1-2', type:'choice', cat:'apply', level:2, q:'답사를 갈 때 미리 준비할 것으로 알맞지 않은 것은?', choices:['친구 도시락 뺏을 계획','조사할 내용 정하기','사진기와 수첩','가는 길 알아보기'], a:'친구 도시락 뺏을 계획', hint:'답사 준비물과 계획을 세워요' },
  { id:'p_so412_13', unitId:'so4-1-2', type:'choice', cat:'concept', level:2, q:'천연기념물로 지정된 나무나 동물은 어떤 유산에 속할까요?', choices:['자연유산','문화유산','무형유산','기록유산'], a:'자연유산', hint:'자연이 만든 소중한 것이에요' },
  { id:'p_so412_14', unitId:'so4-1-2', type:'choice', cat:'concept', level:2, q:'국가유산 조사 방법으로 알맞은 것끼리 짝지어진 것은?', choices:['답사·누리집 검색','낙서·훼손','비밀로 하기·숨기기','상상·추측'], a:'답사·누리집 검색', hint:'사실을 확인하는 방법이에요' },
  { id:'p_so412_15', unitId:'so4-1-2', type:'choice', cat:'apply', level:3, q:'우리 지역의 역사를 알 수 있는 장소로 알맞지 않은 것은?', choices:['놀이공원','박물관','유적지','향교'], a:'놀이공원', hint:'옛 모습이 남아 있는 곳을 찾아요' },
  { id:'p_so412_16', unitId:'so4-1-2', type:'choice', cat:'apply', level:3, q:'국가유산 답사 보고서에 들어갈 내용으로 알맞지 않은 것은?', choices:['내가 좋아하는 가수 이름','답사한 날짜','알게 된 점','느낀 점'], a:'내가 좋아하는 가수 이름', hint:'답사와 관련된 내용을 적어요' },
  { id:'p_so412_17', unitId:'so4-1-2', type:'choice', cat:'concept', level:3, q:'2024년부터 \'문화재\' 대신 쓰기로 한 말은 무엇일까요?', choices:['국가유산','문화상품','전통물품','역사자료'], a:'국가유산', hint:'유산이라는 말로 바뀌었어요' },
  { id:'p_so412_18', unitId:'so4-1-2', type:'choice', cat:'concept', level:3, q:'국가유산을 아끼는 태도로 알맞은 것은?', choices:['안내판의 내용을 잘 읽고 지킨다','기념으로 조금 가져온다','올라가서 사진을 찍는다','이름을 새긴다'], a:'안내판의 내용을 잘 읽고 지킨다', hint:'모두의 유산이에요' },

  // ── 사회 3. 경제활동과 지역 간 교류 (추가) ─────
  { id:'p_so413_07', unitId:'so4-1-3', type:'choice', cat:'concept', level:1, q:'물건을 만들어 내는 활동을 무엇이라 할까요?', choices:['생산','소비','저축','교환'], a:'생산', hint:'만들어 내는 일이에요' },
  { id:'p_so413_08', unitId:'so4-1-3', type:'choice', cat:'concept', level:1, q:'돈을 내고 물건을 사서 쓰는 활동을 무엇이라 할까요?', choices:['소비','생산','기부','저축'], a:'소비', hint:'사서 쓰는 일이에요' },
  { id:'p_so413_09', unitId:'so4-1-3', type:'choice', cat:'apply', level:1, q:'다음 중 생산 활동에 해당하는 것은?', choices:['농부가 벼를 기른다','과자를 사 먹는다','영화를 본다','용돈을 받는다'], a:'농부가 벼를 기른다', hint:'무언가를 만들어 내는 일이에요' },
  { id:'p_so413_10', unitId:'so4-1-3', type:'choice', cat:'concept', level:2, q:'합리적 선택을 할 때 고려하지 않아도 되는 것은?', choices:['포장지 색깔이 내 기분에 맞는지','가격','품질','필요한 물건인지'], a:'포장지 색깔이 내 기분에 맞는지', hint:'꼭 필요한 기준을 따져요' },
  { id:'p_so413_11', unitId:'so4-1-3', type:'choice', cat:'concept', level:2, q:'상품의 생산지를 알 수 있는 방법으로 알맞은 것은?', choices:['포장지의 원산지 표시 확인','물건 무게 재기','친구에게 물어보기','색깔 보기'], a:'포장지의 원산지 표시 확인', hint:'포장지에 적혀 있어요' },
  { id:'p_so413_12', unitId:'so4-1-3', type:'choice', cat:'apply', level:2, q:'우리 지역에서 나지 않는 물건을 구할 수 있는 까닭은?', choices:['다른 지역과 교류하기 때문','우리 지역이 넓기 때문','물건이 저절로 생기기 때문','사람이 많기 때문'], a:'다른 지역과 교류하기 때문', hint:'서로 주고받아요' },
  { id:'p_so413_13', unitId:'so4-1-3', type:'choice', cat:'apply', level:2, q:'다음 중 지역 간 교류의 예로 알맞지 않은 것은?', choices:['혼자 방에서 책 읽기','다른 지역 특산물 사기','자매결연 도시와 문화 행사','다른 지역으로 여행 가기'], a:'혼자 방에서 책 읽기', hint:'교류는 서로 오가는 일이에요' },
  { id:'p_so413_14', unitId:'so4-1-3', type:'choice', cat:'concept', level:2, q:'희소성 때문에 우리는 무엇을 해야 할까요?', choices:['선택','포기 없이 다 갖기','저축만 하기','생산 중단'], a:'선택', hint:'다 가질 수 없으니 골라야 해요' },
  { id:'p_so413_15', unitId:'so4-1-3', type:'choice', cat:'concept', level:3, q:'현명한 소비 생활의 모습으로 알맞은 것은?', choices:['필요한 것을 미리 계획해 사기','충동적으로 사기','비싼 것만 사기','친구를 따라 사기'], a:'필요한 것을 미리 계획해 사기', hint:'계획을 세워요' },
  { id:'p_so413_16', unitId:'so4-1-3', type:'choice', cat:'apply', level:3, q:'지역마다 생산하는 물건이 다른 까닭으로 알맞은 것은?', choices:['자연환경과 기술이 다르기 때문','사람 수가 같기 때문','모두 같은 물건을 만들기 때문','교류를 안 하기 때문'], a:'자연환경과 기술이 다르기 때문', hint:'바다가 있는 곳과 산이 있는 곳은 달라요' },
  { id:'p_so413_17', unitId:'so4-1-3', type:'choice', cat:'apply', level:3, q:'경제적 교류가 지역에 주는 좋은 점으로 알맞은 것은?', choices:['서로 부족한 것을 채울 수 있다','물건이 사라진다','값이 무조건 오른다','사람이 줄어든다'], a:'서로 부족한 것을 채울 수 있다', hint:'서로 도움이 돼요' },
  { id:'p_so413_18', unitId:'so4-1-3', type:'choice', cat:'apply', level:3, q:'용돈 기입장을 쓰면 좋은 점으로 알맞은 것은?', choices:['돈을 어디에 썼는지 알 수 있다','돈이 저절로 늘어난다','물건값이 싸진다','생산이 늘어난다'], a:'돈을 어디에 썼는지 알 수 있다', hint:'쓴 내역을 기록해요' },
  // ── 수학 1. 큰 수 (확장) ──
  { id:'p_ma411_101', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'9999보다 1만큼 더 큰 수는 얼마일까요?', a:'10000', hint:'9999 다음 수를 세어 보세요.' },
  { id:'p_ma411_102', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'1000이 10개이면 얼마일까요?', a:'10000', hint:'1000을 열 번 더해 보세요.' },
  { id:'p_ma411_103', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'10000이 7개인 수는 얼마일까요?', a:'70000', hint:'만이 몇 개인지 세어 보세요.' },
  { id:'p_ma411_104', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'10000이 4개, 1000이 2개인 수는 얼마일까요?', a:'42000', hint:'만의 자리와 천의 자리를 차례로 써 보세요.' },
  { id:'p_ma411_105', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'30000 + 5000 + 600 + 40 + 8 은 얼마일까요?', a:'35648', hint:'자리마다 숫자를 하나씩 놓아 보세요.' },
  { id:'p_ma411_106', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'62435에서 숫자 6이 나타내는 값은 얼마일까요?', a:'60000', hint:'6이 어느 자리에 있는지 먼저 찾으세요.' },
  { id:'p_ma411_107', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'87654에서 숫자 7이 나타내는 값은 얼마일까요?', a:'7000', hint:'오른쪽부터 일, 십, 백, 천 순서로 세어 보세요.' },
  { id:'p_ma411_108', unitId:'ma4-1-1', type:'choice', cat:'concept', level:1, q:'십만은 10000이 몇 개인 수일까요?', choices:['10개','100개','1000개','10000개'], a:'10개', hint:'100000 안에 만이 몇 번 들어가는지 생각하세요.' },
  { id:'p_ma411_109', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'100000이 3개인 수는 얼마일까요?', a:'300000', hint:'십만을 세 번 더해 보세요.' },
  { id:'p_ma411_110', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'1억은 100만이 몇 개인 수일까요?', a:'100', hint:'1억은 1000만이 10개입니다.' },
  { id:'p_ma411_111', unitId:'ma4-1-1', type:'choice', cat:'concept', level:1, q:'다음 중 가장 큰 수는 어느 것일까요?', choices:['48520','48250','48052','48205'], a:'48520', hint:'자리 수가 같으면 높은 자리부터 비교하세요.' },
  { id:'p_ma411_112', unitId:'ma4-1-1', type:'number', cat:'calc', level:1, q:'20000부터 10000씩 4번 뛰어 세면 얼마가 될까요?', a:'60000', hint:'만의 자리가 1씩 커집니다.' },
  { id:'p_ma411_113', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'26000부터 1000씩 5번 뛰어 세면 얼마가 될까요?', a:'31000', hint:'천의 자리가 1씩 커집니다.' },
  { id:'p_ma411_114', unitId:'ma4-1-1', type:'number', cat:'word', level:2, q:'3억 4000만을 숫자로 쓰면 0은 모두 몇 개일까요?', a:'7', hint:'먼저 숫자로 써 보고 0을 세어 보세요.' },
  { id:'p_ma411_115', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'10000이 5개, 1000이 3개, 100이 7개인 수는 얼마일까요?', a:'53700', hint:'없는 자리에는 0을 씁니다.' },
  { id:'p_ma411_116', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'100000보다 1만큼 작은 수는 얼마일까요?', a:'99999', hint:'십만 바로 앞의 수를 생각하세요.' },
  { id:'p_ma411_117', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'954321에서 십만의 자리 숫자와 백의 자리 숫자의 합은 얼마일까요?', a:'12', hint:'두 자리의 숫자를 각각 찾아 더하세요.' },
  { id:'p_ma411_118', unitId:'ma4-1-1', type:'choice', cat:'concept', level:2, q:'65470000을 바르게 읽은 것은 어느 것일까요?', choices:['육천오백사십칠만','육천오백사십칠억','육백오십사만칠천','육천오백사십칠'], a:'육천오백사십칠만', hint:'오른쪽부터 네 자리씩 끊어 읽으세요.' },
  { id:'p_ma411_119', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'3700의 10배는 얼마일까요?', a:'37000', hint:'10배를 하면 0이 하나 더 붙습니다.' },
  { id:'p_ma411_120', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'4억은 1000만이 몇 개인 수일까요?', a:'40', hint:'1억이 1000만 10개임을 이용하세요.' },
  { id:'p_ma411_121', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'1조를 숫자로 쓰면 0은 모두 몇 개일까요?', a:'12', hint:'1억은 0이 8개입니다. 여기서 이어 생각하세요.' },
  { id:'p_ma411_122', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'3200, 4200, 5200, 6200 다음에 올 수는 얼마일까요?', a:'7200', hint:'얼마씩 커지는지 먼저 찾으세요.' },
  { id:'p_ma411_123', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'52000부터 10000씩 커지는 규칙으로 수를 늘어놓았습니다. 다섯 번째 수는 얼마일까요?', a:'92000', hint:'첫 번째 수가 52000임에 주의하세요.' },
  { id:'p_ma411_124', unitId:'ma4-1-1', type:'choice', cat:'concept', level:2, q:'다음 중 숫자 8이 8000000을 나타내는 수는 어느 것일까요?', choices:['18450000','80450000','14850000','14580000'], a:'18450000', hint:'8이 백만의 자리에 있는 수를 찾으세요.' },
  { id:'p_ma411_125', unitId:'ma4-1-1', type:'number', cat:'calc', level:2, q:'어떤 수는 10000이 9개, 100이 5개, 1이 6개인 수입니다. 어떤 수는 얼마일까요?', a:'90506', hint:'천의 자리와 십의 자리에는 0을 씁니다.' },
  { id:'p_ma411_126', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'숫자 카드 1, 3, 5, 7, 9를 한 번씩 모두 사용하여 만들 수 있는 가장 큰 다섯 자리 수는 얼마일까요?', a:'97531', hint:'높은 자리에 큰 숫자를 놓으세요.' },
  { id:'p_ma411_127', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'숫자 카드 0, 2, 4, 6, 8을 한 번씩 모두 사용하여 만들 수 있는 가장 작은 다섯 자리 수는 얼마일까요?', a:'20468', hint:'맨 앞자리에는 0을 놓을 수 없습니다.' },
  { id:'p_ma411_128', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'어떤 수부터 10000씩 3번 뛰어 세었더니 82000이 되었습니다. 어떤 수는 얼마일까요?', a:'52000', hint:'거꾸로 10000씩 3번 되돌아가 보세요.' },
  { id:'p_ma411_129', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'어떤 수부터 1000씩 4번 뛰어 세었더니 45000이 되었습니다. 어떤 수는 얼마일까요?', a:'41000', hint:'뛰어 센 만큼 다시 빼면 됩니다.' },
  { id:'p_ma411_130', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'세 자리 수 중에서 각 자리 숫자의 합이 6이고 백의 자리 숫자가 3인 가장 큰 수는 얼마일까요?', a:'330', hint:'남은 두 자리 숫자의 합이 얼마인지 먼저 구하세요.' },
  { id:'p_ma411_131', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'다섯 자리 수 중에서 만의 자리 숫자가 7이고 각 자리 숫자의 합이 10인 가장 작은 수는 얼마일까요?', a:'70003', hint:'작은 수를 만들려면 높은 자리에 0을 많이 놓으세요.' },
  { id:'p_ma411_132', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'어떤 수부터 100만씩 5번 뛰어 세었더니 3800만이 되었습니다. 어떤 수는 얼마일까요?', a:'33000000', hint:'모두 얼마만큼 뛰어 세었는지 먼저 구하세요.' },
  { id:'p_ma411_133', unitId:'ma4-1-1', type:'number', cat:'word', level:3, q:'0부터 9까지의 숫자 중에서 3□572가 34000보다 크게 되는 □에 들어갈 수 있는 숫자는 모두 몇 개일까요?', a:'6', hint:'천의 자리를 4부터 넣어 보며 확인하세요.' },
  { id:'p_ma411_134', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'어떤 수의 10배는 8억입니다. 어떤 수는 얼마일까요?', a:'80000000', hint:'10배의 반대로 0을 하나 지워 보세요.' },
  { id:'p_ma411_135', unitId:'ma4-1-1', type:'number', cat:'calc', level:3, q:'숫자 카드 2, 5, 0, 8을 한 번씩 모두 사용하여 만든 가장 큰 네 자리 수와 가장 작은 네 자리 수의 차는 얼마일까요?', a:'6462', hint:'가장 작은 수의 맨 앞에는 0을 놓을 수 없습니다.' },
  // ── 수학 2. 각도 (확장) ──
  { id:'p_ma412_101', unitId:'ma4-1-2', type:'number', cat:'calc', level:1, q:'직각의 크기는 몇 도일까요? 숫자만 쓰세요.', a:'90', hint:'ㄱ자 모양의 각입니다.' },
  { id:'p_ma412_102', unitId:'ma4-1-2', type:'number', cat:'calc', level:1, q:'45도 + 30도 는 몇 도일까요? 숫자만 쓰세요.', a:'75', hint:'각도끼리 그냥 더하면 됩니다.' },
  { id:'p_ma412_103', unitId:'ma4-1-2', type:'number', cat:'calc', level:1, q:'80도 - 25도 는 몇 도일까요? 숫자만 쓰세요.', a:'55', hint:'각도끼리 빼면 됩니다.' },
  { id:'p_ma412_104', unitId:'ma4-1-2', type:'choice', cat:'concept', level:1, q:'다음 중 예각은 어느 것일까요?', choices:['35도','95도','120도','160도'], a:'35도', hint:'예각은 직각보다 작은 각입니다.' },
  { id:'p_ma412_105', unitId:'ma4-1-2', type:'choice', cat:'concept', level:1, q:'다음 중 둔각은 어느 것일까요?', choices:['30도','60도','89도','135도'], a:'135도', hint:'둔각은 직각보다 크고 180도보다 작습니다.' },
  { id:'p_ma412_106', unitId:'ma4-1-2', type:'number', cat:'calc', level:1, q:'삼각형 세 각의 크기의 합은 몇 도일까요? 숫자만 쓰세요.', a:'180', hint:'세 각을 모으면 직선이 됩니다.' },
  { id:'p_ma412_107', unitId:'ma4-1-2', type:'number', cat:'calc', level:1, q:'사각형 네 각의 크기의 합은 몇 도일까요? 숫자만 쓰세요.', a:'360', hint:'사각형은 삼각형 2개로 나눌 수 있습니다.' },
  { id:'p_ma412_108', unitId:'ma4-1-2', type:'number', cat:'calc', level:1, q:'60도 + 75도 는 몇 도일까요? 숫자만 쓰세요.', a:'135', hint:'받아올림에 주의하며 더하세요.' },
  { id:'p_ma412_109', unitId:'ma4-1-2', type:'number', cat:'calc', level:1, q:'130도 - 45도 는 몇 도일까요? 숫자만 쓰세요.', a:'85', hint:'받아내림에 주의하며 빼세요.' },
  { id:'p_ma412_110', unitId:'ma4-1-2', type:'number', cat:'calc', level:1, q:'삼각형의 두 각의 크기가 50도, 60도입니다. 나머지 한 각은 몇 도일까요?', a:'70', hint:'180도에서 두 각을 빼세요.' },
  { id:'p_ma412_111', unitId:'ma4-1-2', type:'number', cat:'calc', level:1, q:'삼각형의 두 각의 크기가 90도, 35도입니다. 나머지 한 각은 몇 도일까요?', a:'55', hint:'세 각의 합이 180도임을 이용하세요.' },
  { id:'p_ma412_112', unitId:'ma4-1-2', type:'number', cat:'calc', level:1, q:'직각 2개를 이어 붙이면 몇 도일까요? 숫자만 쓰세요.', a:'180', hint:'90도를 두 번 더해 보세요.' },
  { id:'p_ma412_113', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'사각형의 세 각의 크기가 100도, 80도, 95도입니다. 나머지 한 각은 몇 도일까요?', a:'85', hint:'360도에서 세 각의 합을 빼세요.' },
  { id:'p_ma412_114', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'사각형의 세 각의 크기가 90도, 90도, 70도입니다. 나머지 한 각은 몇 도일까요?', a:'110', hint:'네 각의 합은 360도입니다.' },
  { id:'p_ma412_115', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'삼각형의 두 각의 크기가 각각 45도입니다. 나머지 한 각은 몇 도일까요?', a:'90', hint:'같은 각 두 개를 먼저 더하세요.' },
  { id:'p_ma412_116', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'25도 + 40도 + 65도 는 몇 도일까요? 숫자만 쓰세요.', a:'130', hint:'앞의 두 각을 먼저 더해 보세요.' },
  { id:'p_ma412_117', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'180도에서 30도와 45도를 뺀 각도는 몇 도일까요?', a:'105', hint:'뺄 두 각을 먼저 더한 뒤 한 번에 빼세요.' },
  { id:'p_ma412_118', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'한 직선 위에 두 각이 나란히 있습니다. 한 각이 115도이면 다른 한 각은 몇 도일까요?', a:'65', hint:'직선이 이루는 각은 180도입니다.' },
  { id:'p_ma412_119', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'시계가 3시 정각을 가리킬 때 긴바늘과 짧은바늘이 이루는 작은 쪽 각은 몇 도일까요?', a:'90', hint:'시계 한 칸은 30도입니다.' },
  { id:'p_ma412_120', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'시계가 6시 정각을 가리킬 때 긴바늘과 짧은바늘이 이루는 각은 몇 도일까요?', a:'180', hint:'두 바늘이 몇 칸 떨어져 있는지 세어 보세요.' },
  { id:'p_ma412_121', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'35도 + 48도 + 52도 는 몇 도일까요? 숫자만 쓰세요.', a:'135', hint:'뒤의 두 각을 먼저 더하면 편합니다.' },
  { id:'p_ma412_122', unitId:'ma4-1-2', type:'choice', cat:'concept', level:2, q:'다음 각도 중 직각보다 크고 180도보다 작은 각은 어느 것일까요?', choices:['45도','88도','90도','110도'], a:'110도', hint:'90도보다 큰 각을 찾으세요.' },
  { id:'p_ma412_123', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'삼각형에서 두 각의 크기가 서로 같고 나머지 한 각이 80도입니다. 크기가 같은 한 각은 몇 도일까요?', a:'50', hint:'남은 각도를 똑같이 둘로 나누세요.' },
  { id:'p_ma412_124', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'사각형에서 세 각의 크기가 모두 85도입니다. 나머지 한 각은 몇 도일까요?', a:'105', hint:'85도를 세 번 더한 뒤 360도에서 빼세요.' },
  { id:'p_ma412_125', unitId:'ma4-1-2', type:'number', cat:'calc', level:2, q:'시계가 4시 정각을 가리킬 때 긴바늘과 짧은바늘이 이루는 작은 쪽 각은 몇 도일까요?', a:'120', hint:'한 칸이 30도이고 네 칸 떨어져 있습니다.' },
  { id:'p_ma412_126', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'어떤 각에 40도를 더해야 하는데 잘못하여 40도를 뺐더니 25도가 되었습니다. 바르게 계산하면 몇 도일까요?', a:'105', hint:'먼저 어떤 각이 몇 도인지 거꾸로 구하세요.' },
  { id:'p_ma412_127', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'두 각의 크기의 합은 140도이고 차는 20도입니다. 큰 각은 몇 도일까요?', a:'80', hint:'합에 차를 더한 뒤 반으로 나누어 보세요.' },
  { id:'p_ma412_128', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'삼각형에서 한 각의 크기가 나머지 두 각의 크기의 합과 같습니다. 그 각은 몇 도일까요?', a:'90', hint:'세 각의 합 180도를 똑같이 둘로 나누어 보세요.' },
  { id:'p_ma412_129', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'삼각형에서 두 각의 크기가 서로 같고 나머지 한 각은 그 각보다 30도 더 큽니다. 가장 큰 각은 몇 도일까요?', a:'80', hint:'같은 각을 세 번 더한 값이 150도임을 이용하세요.' },
  { id:'p_ma412_130', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'한 직선 위에 세 각이 나란히 있습니다. 두 각이 40도, 65도일 때 나머지 한 각은 몇 도일까요?', a:'75', hint:'세 각의 합이 180도가 되어야 합니다.' },
  { id:'p_ma412_131', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'사각형 네 각의 크기의 합에서 삼각형 세 각의 크기의 합을 빼면 몇 도일까요?', a:'180', hint:'두 도형의 각의 합을 각각 떠올리세요.' },
  { id:'p_ma412_132', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'삼각형 2개를 겹치지 않게 이어 붙여 사각형 하나를 만들었습니다. 이 사각형의 네 각의 크기의 합은 몇 도일까요?', a:'360', hint:'삼각형 하나의 각의 합을 두 번 생각하세요.' },
  { id:'p_ma412_133', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'어떤 각의 크기를 2배 하면 130도입니다. 어떤 각에 45도를 더하면 몇 도일까요?', a:'110', hint:'어떤 각을 먼저 구한 뒤 더하세요.' },
  { id:'p_ma412_134', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'삼각형에서 한 각이 25도입니다. 나머지 두 각 중 한 각은 다른 한 각보다 45도 더 큽니다. 가장 큰 각은 몇 도일까요?', a:'100', hint:'나머지 두 각의 합을 먼저 구하세요.' },
  { id:'p_ma412_135', unitId:'ma4-1-2', type:'number', cat:'calc', level:3, q:'사각형에서 네 각 중 두 각은 각각 직각입니다. 나머지 두 각 중 한 각은 다른 한 각의 2배일 때 작은 각은 몇 도일까요?', a:'60', hint:'남은 두 각의 합을 먼저 구한 뒤 3으로 나누어 보세요.' },
  // ── 수학 3. 곱셈과 나눗셈 (확장) ──
  { id:'p_ma413_101', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'213 × 30 은 얼마일까요?', a:'6390', hint:'213 × 3을 구한 뒤 0을 하나 붙이세요.' },
  { id:'p_ma413_102', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'145 × 20 은 얼마일까요?', a:'2900', hint:'145 × 2를 먼저 구하세요.' },
  { id:'p_ma413_103', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'302 × 40 은 얼마일까요?', a:'12080', hint:'302 × 4를 구한 뒤 0을 붙이세요.' },
  { id:'p_ma413_104', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'250 × 60 은 얼마일까요?', a:'15000', hint:'25 × 6을 구한 뒤 0을 두 개 붙이세요.' },
  { id:'p_ma413_105', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'124 × 32 는 얼마일까요?', a:'3968', hint:'30을 곱한 값과 2를 곱한 값을 더하세요.' },
  { id:'p_ma413_106', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'236 × 24 는 얼마일까요?', a:'5664', hint:'20을 곱한 값과 4를 곱한 값을 더하세요.' },
  { id:'p_ma413_107', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'450 ÷ 15 는 얼마일까요?', a:'30', hint:'15에 몇을 곱해야 450이 되는지 생각하세요.' },
  { id:'p_ma413_108', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'720 ÷ 24 는 얼마일까요?', a:'30', hint:'24 × 30을 떠올려 보세요.' },
  { id:'p_ma413_109', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'384 ÷ 16 은 얼마일까요?', a:'24', hint:'16 × 20부터 어림해 보세요.' },
  { id:'p_ma413_110', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'690 ÷ 30 은 얼마일까요?', a:'23', hint:'69 ÷ 3을 먼저 생각해 보세요.' },
  { id:'p_ma413_111', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'187 ÷ 11 은 얼마일까요?', a:'17', hint:'11 × 17을 확인해 보세요.' },
  { id:'p_ma413_112', unitId:'ma4-1-3', type:'number', cat:'calc', level:1, q:'96 ÷ 12 는 얼마일까요?', a:'8', hint:'12단 곱셈을 떠올려 보세요.' },
  { id:'p_ma413_113', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'315 × 27 은 얼마일까요?', a:'8505', hint:'20을 곱한 값과 7을 곱한 값을 더하세요.' },
  { id:'p_ma413_114', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'408 × 35 는 얼마일까요?', a:'14280', hint:'십의 자리부터 차례로 곱해 보세요.' },
  { id:'p_ma413_115', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'152 × 43 은 얼마일까요?', a:'6536', hint:'40을 곱한 값과 3을 곱한 값을 더하세요.' },
  { id:'p_ma413_116', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'507 × 26 은 얼마일까요?', a:'13182', hint:'가운데 0에 주의하며 계산하세요.' },
  { id:'p_ma413_117', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'621 × 18 은 얼마일까요?', a:'11178', hint:'10을 곱한 값과 8을 곱한 값을 더하세요.' },
  { id:'p_ma413_118', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'275 × 48 은 얼마일까요?', a:'13200', hint:'275 × 50에서 275 × 2를 빼도 됩니다.' },
  { id:'p_ma413_119', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'918 ÷ 27 은 얼마일까요?', a:'34', hint:'27 × 30부터 어림해 보세요.' },
  { id:'p_ma413_120', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'552 ÷ 23 은 얼마일까요?', a:'24', hint:'23 × 20을 빼고 남은 수를 다시 나누세요.' },
  { id:'p_ma413_121', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'851 ÷ 37 은 얼마일까요?', a:'23', hint:'37 × 20부터 어림해 보세요.' },
  { id:'p_ma413_122', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'365 ÷ 14 의 나머지는 얼마일까요?', a:'1', hint:'몫을 먼저 구한 뒤 남는 수를 찾으세요.' },
  { id:'p_ma413_123', unitId:'ma4-1-3', type:'number', cat:'calc', level:2, q:'500 ÷ 24 의 나머지는 얼마일까요?', a:'20', hint:'24 × 20을 빼 보세요.' },
  { id:'p_ma413_124', unitId:'ma4-1-3', type:'number', cat:'word', level:2, q:'한 상자에 사탕이 132개씩 들어 있습니다. 25상자에 들어 있는 사탕은 모두 몇 개일까요?', a:'3300', hint:'상자 수와 한 상자의 개수를 곱하세요.' },
  { id:'p_ma413_125', unitId:'ma4-1-3', type:'number', cat:'word', level:2, q:'색종이 480장을 16명에게 똑같이 나누어 주면 한 명이 몇 장씩 받을까요?', a:'30', hint:'전체 수를 사람 수로 나누세요.' },
  { id:'p_ma413_126', unitId:'ma4-1-3', type:'number', cat:'calc', level:3, q:'어떤 수에 24를 곱해야 하는데 잘못하여 24를 더했더니 56이 되었습니다. 바르게 계산한 값은 얼마일까요?', a:'768', hint:'먼저 어떤 수를 거꾸로 구하세요.' },
  { id:'p_ma413_127', unitId:'ma4-1-3', type:'number', cat:'calc', level:3, q:'어떤 수를 15로 나누어야 하는데 잘못하여 15를 곱했더니 900이 되었습니다. 바르게 계산한 값은 얼마일까요?', a:'4', hint:'900을 15로 나누면 어떤 수를 알 수 있습니다.' },
  { id:'p_ma413_128', unitId:'ma4-1-3', type:'number', cat:'word', level:3, q:'연필 한 다스는 12자루입니다. 5다스를 사서 24명에게 똑같이 나누어 주면 몇 자루가 남을까요?', a:'12', hint:'전체 자루 수를 먼저 구하세요.' },
  { id:'p_ma413_129', unitId:'ma4-1-3', type:'number', cat:'word', level:3, q:'사과 250개를 한 상자에 18개씩 담으려고 합니다. 상자에 다 담고 남는 사과는 몇 개일까요?', a:'16', hint:'나눗셈의 나머지를 구하는 문제입니다.' },
  { id:'p_ma413_130', unitId:'ma4-1-3', type:'number', cat:'word', level:3, q:'학생 620명이 45명씩 탈 수 있는 버스에 모두 타려고 합니다. 버스는 적어도 몇 대 필요할까요?', a:'14', hint:'남는 학생도 버스를 타야 합니다.' },
  { id:'p_ma413_131', unitId:'ma4-1-3', type:'number', cat:'calc', level:3, q:'27 × □ = 810 입니다. □에 알맞은 수는 얼마일까요?', a:'30', hint:'곱셈을 나눗셈으로 바꾸어 생각하세요.' },
  { id:'p_ma413_132', unitId:'ma4-1-3', type:'number', cat:'word', level:3, q:'초콜릿이 24개씩 들어 있는 상자가 15개 있습니다. 이 초콜릿을 30명에게 똑같이 나누어 주면 한 명이 몇 개씩 받을까요?', a:'12', hint:'전체 개수를 먼저 구한 뒤 나누세요.' },
  { id:'p_ma413_133', unitId:'ma4-1-3', type:'number', cat:'calc', level:3, q:'1분에 145 m를 가는 자전거가 있습니다. 같은 빠르기로 25분 동안 가면 몇 m를 갈까요?', a:'3625', hint:'1분에 가는 거리에 시간을 곱하세요.' },
  { id:'p_ma413_134', unitId:'ma4-1-3', type:'number', cat:'word', level:3, q:'초콜릿 300개를 한 봉지에 16개씩 담았습니다. 남은 초콜릿을 한 봉지에 4개씩 담으면 봉지는 몇 개 더 필요할까요?', a:'3', hint:'먼저 남는 초콜릿 수를 구하세요.' },
  { id:'p_ma413_135', unitId:'ma4-1-3', type:'number', cat:'calc', level:3, q:'숫자 카드 3, 5, 7을 한 번씩 모두 사용하여 만든 가장 큰 세 자리 수를 24로 나누었을 때의 몫은 얼마일까요?', a:'31', hint:'가장 큰 수를 먼저 만들고 나누세요.' },
  // ── 수학 4. 평면도형의 이동 (확장) ──
  { id:'p_ma414_101', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'도형을 밀면 무엇이 달라질까요?', choices:['모양','크기','위치','모양과 크기 모두'], a:'위치', hint:'밀기는 자리만 옮기는 이동입니다.' },
  { id:'p_ma414_102', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'도형을 오른쪽으로 뒤집으면 도형의 어느 쪽이 서로 바뀔까요?', choices:['위쪽과 아래쪽','왼쪽과 오른쪽','앞쪽과 뒤쪽','아무것도 바뀌지 않습니다'], a:'왼쪽과 오른쪽', hint:'거울에 비친 모습을 떠올리세요.' },
  { id:'p_ma414_103', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'도형을 위쪽으로 뒤집으면 도형의 어느 쪽이 서로 바뀔까요?', choices:['위쪽과 아래쪽','왼쪽과 오른쪽','앞쪽과 뒤쪽','바뀌지 않습니다'], a:'위쪽과 아래쪽', hint:'물에 비친 모습을 떠올리세요.' },
  { id:'p_ma414_104', unitId:'ma4-1-4', type:'number', cat:'word', level:1, q:'도형을 시계 방향으로 90도씩 2번 돌리면 모두 몇 도를 돌린 것일까요?', a:'180', hint:'90도를 두 번 더하세요.' },
  { id:'p_ma414_105', unitId:'ma4-1-4', type:'number', cat:'word', level:1, q:'도형을 시계 방향으로 90도씩 3번 돌리면 모두 몇 도를 돌린 것일까요?', a:'270', hint:'90도를 세 번 더하세요.' },
  { id:'p_ma414_106', unitId:'ma4-1-4', type:'number', cat:'word', level:1, q:'도형을 시계 방향으로 90도씩 4번 돌리면 모두 몇 도를 돌린 것일까요?', a:'360', hint:'한 바퀴는 몇 도인지 생각하세요.' },
  { id:'p_ma414_107', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'도형을 시계 방향으로 360도 돌리면 어떻게 될까요?', choices:['처음 도형과 같습니다','좌우가 바뀝니다','위아래가 바뀝니다','크기가 커집니다'], a:'처음 도형과 같습니다', hint:'한 바퀴를 완전히 돌린 것입니다.' },
  { id:'p_ma414_108', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'도형을 오른쪽으로 2번 뒤집으면 어떻게 될까요?', choices:['처음 도형과 같습니다','좌우가 바뀝니다','위아래가 바뀝니다','크기가 작아집니다'], a:'처음 도형과 같습니다', hint:'뒤집고 다시 뒤집으면 어떻게 되는지 그려 보세요.' },
  { id:'p_ma414_109', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'밀기, 뒤집기, 돌리기를 해도 변하지 않는 것은 무엇일까요?', choices:['도형의 위치','도형의 모양과 크기','도형의 방향','도형이 놓인 자리'], a:'도형의 모양과 크기', hint:'이동은 도형 자체를 바꾸지 않습니다.' },
  { id:'p_ma414_110', unitId:'ma4-1-4', type:'number', cat:'calc', level:1, q:'숫자 8을 시계 방향으로 180도 돌리면 어떤 숫자가 될까요?', a:'8', hint:'8을 거꾸로 돌려 보세요.' },
  { id:'p_ma414_111', unitId:'ma4-1-4', type:'number', cat:'calc', level:1, q:'숫자 6을 시계 방향으로 180도 돌리면 어떤 숫자가 될까요?', a:'9', hint:'종이에 6을 쓰고 거꾸로 돌려 보세요.' },
  { id:'p_ma414_112', unitId:'ma4-1-4', type:'choice', cat:'concept', level:1, q:'도형을 왼쪽으로 뒤집은 것과 결과가 같은 것은 무엇일까요?', choices:['오른쪽으로 뒤집기','위쪽으로 뒤집기','아래쪽으로 뒤집기','시계 방향으로 90도 돌리기'], a:'오른쪽으로 뒤집기', hint:'좌우가 바뀌는 이동을 찾으세요.' },
  { id:'p_ma414_113', unitId:'ma4-1-4', type:'number', cat:'calc', level:2, q:'시계 방향으로 90도 돌린 것은 시계 반대 방향으로 몇 도 돌린 것과 같을까요?', a:'270', hint:'한 바퀴 360도에서 90도를 빼 보세요.' },
  { id:'p_ma414_114', unitId:'ma4-1-4', type:'number', cat:'calc', level:2, q:'시계 방향으로 270도 돌린 것은 시계 반대 방향으로 몇 도 돌린 것과 같을까요?', a:'90', hint:'360도에서 270도를 빼 보세요.' },
  { id:'p_ma414_115', unitId:'ma4-1-4', type:'number', cat:'calc', level:2, q:'시계 방향으로 180도 돌린 것은 시계 반대 방향으로 몇 도 돌린 것과 같을까요?', a:'180', hint:'반 바퀴는 어느 쪽으로 돌려도 같습니다.' },
  { id:'p_ma414_116', unitId:'ma4-1-4', type:'choice', cat:'concept', level:2, q:'도형을 시계 방향으로 90도 돌리기를 2번 한 것과 결과가 같은 것은 무엇일까요?', choices:['시계 방향으로 180도 돌리기','시계 방향으로 90도 돌리기','오른쪽으로 뒤집기','오른쪽으로 밀기'], a:'시계 방향으로 180도 돌리기', hint:'돌린 각도를 모두 더해 보세요.' },
  { id:'p_ma414_117', unitId:'ma4-1-4', type:'number', cat:'calc', level:2, q:'수 카드에 적힌 108을 시계 방향으로 180도 돌리면 어떤 수가 될까요?', a:'801', hint:'숫자의 순서와 모양이 모두 바뀝니다.' },
  { id:'p_ma414_118', unitId:'ma4-1-4', type:'number', cat:'calc', level:2, q:'수 카드에 적힌 619를 시계 방향으로 180도 돌리면 어떤 수가 될까요?', a:'619', hint:'6과 9가 서로 바뀌는 것에 주의하세요.' },
  { id:'p_ma414_119', unitId:'ma4-1-4', type:'choice', cat:'concept', level:2, q:'다음 숫자 중 왼쪽으로 뒤집었을 때 모양이 변하지 않는 것은 무엇일까요?', choices:['0','3','6','7'], a:'0', hint:'좌우가 똑같이 생긴 숫자를 찾으세요.' },
  { id:'p_ma414_120', unitId:'ma4-1-4', type:'choice', cat:'concept', level:2, q:'다음 숫자 중 위쪽으로 뒤집었을 때 모양이 변하지 않는 것은 무엇일까요?', choices:['3','5','6','7'], a:'3', hint:'위아래가 똑같이 생긴 숫자를 찾으세요.' },
  { id:'p_ma414_121', unitId:'ma4-1-4', type:'number', cat:'word', level:2, q:'도형을 시계 방향으로 90도씩 6번 돌리면 모두 몇 도를 돌린 것일까요?', a:'540', hint:'90도를 여섯 번 더하세요.' },
  { id:'p_ma414_122', unitId:'ma4-1-4', type:'choice', cat:'concept', level:2, q:'무늬를 만들 때 한 모양을 오른쪽으로 계속 밀어 이어 붙이면 무늬는 어느 방향으로 이어질까요?', choices:['오른쪽','왼쪽','위쪽','아래쪽'], a:'오른쪽', hint:'민 방향으로 무늬가 늘어납니다.' },
  { id:'p_ma414_123', unitId:'ma4-1-4', type:'number', cat:'calc', level:2, q:'수 카드에 적힌 96을 시계 방향으로 180도 돌리면 어떤 수가 될까요?', a:'96', hint:'9는 6이 되고 6은 9가 됩니다.' },
  { id:'p_ma414_124', unitId:'ma4-1-4', type:'choice', cat:'concept', level:2, q:'도형을 아래쪽으로 뒤집기를 3번 한 것과 결과가 같은 것은 무엇일까요?', choices:['아래쪽으로 뒤집기를 1번 한 것','처음 도형 그대로','시계 방향으로 90도 돌린 것','오른쪽으로 뒤집은 것'], a:'아래쪽으로 뒤집기를 1번 한 것', hint:'두 번 뒤집으면 처음으로 돌아옵니다.' },
  { id:'p_ma414_125', unitId:'ma4-1-4', type:'number', cat:'word', level:2, q:'도형을 시계 반대 방향으로 90도씩 5번 돌리면 모두 몇 도를 돌린 것일까요?', a:'450', hint:'90도를 다섯 번 더하세요.' },
  { id:'p_ma414_126', unitId:'ma4-1-4', type:'number', cat:'calc', level:3, q:'도형을 시계 방향으로 90도씩 7번 돌렸습니다. 이것은 시계 방향으로 몇 도만 돌린 것과 결과가 같을까요?', a:'270', hint:'한 바퀴 360도는 없는 것과 같습니다.' },
  { id:'p_ma414_127', unitId:'ma4-1-4', type:'number', cat:'calc', level:3, q:'도형을 시계 방향으로 180도씩 3번 돌렸습니다. 이것은 시계 방향으로 몇 도만 돌린 것과 결과가 같을까요?', a:'180', hint:'모두 몇 도인지 구한 뒤 360도를 빼 보세요.' },
  { id:'p_ma414_128', unitId:'ma4-1-4', type:'choice', cat:'concept', level:3, q:'도형을 오른쪽으로 뒤집고 다시 위쪽으로 뒤집었습니다. 이 결과와 같은 것은 무엇일까요?', choices:['시계 방향으로 180도 돌리기','시계 방향으로 90도 돌리기','오른쪽으로 밀기','처음 도형 그대로'], a:'시계 방향으로 180도 돌리기', hint:'좌우와 위아래가 모두 바뀌었습니다.' },
  { id:'p_ma414_129', unitId:'ma4-1-4', type:'choice', cat:'concept', level:3, q:'도형을 시계 방향으로 90도 돌린 다음 시계 반대 방향으로 90도 돌리면 어떻게 될까요?', choices:['처음 도형과 같습니다','180도 돌린 것과 같습니다','좌우가 바뀝니다','위아래가 바뀝니다'], a:'처음 도형과 같습니다', hint:'돌린 만큼 되돌아온 것입니다.' },
  { id:'p_ma414_130', unitId:'ma4-1-4', type:'number', cat:'calc', level:3, q:'수 카드에 적힌 1089를 시계 방향으로 180도 돌리면 어떤 수가 될까요?', a:'6801', hint:'숫자의 순서를 뒤집고 9는 6으로 바꾸세요.' },
  { id:'p_ma414_131', unitId:'ma4-1-4', type:'number', cat:'calc', level:3, q:'어떤 수 카드를 시계 방향으로 180도 돌렸더니 108이 되었습니다. 처음 수는 얼마일까요?', a:'801', hint:'한 번 더 180도 돌리면 처음으로 돌아옵니다.' },
  { id:'p_ma414_132', unitId:'ma4-1-4', type:'number', cat:'calc', level:3, q:'도형을 시계 방향으로 90도씩 돌릴 때 처음 도형과 같아지려면 적어도 몇 번 돌려야 할까요?', a:'4', hint:'한 바퀴가 되어야 처음과 같아집니다.' },
  { id:'p_ma414_133', unitId:'ma4-1-4', type:'choice', cat:'concept', level:3, q:'도형을 위쪽으로 뒤집은 다음 아래쪽으로 다시 뒤집었습니다. 결과는 어떻게 될까요?', choices:['처음 도형과 같습니다','좌우가 바뀝니다','시계 방향으로 90도 돌린 것과 같습니다','시계 방향으로 180도 돌린 것과 같습니다'], a:'처음 도형과 같습니다', hint:'같은 방향으로 두 번 뒤집은 것과 같습니다.' },
  { id:'p_ma414_134', unitId:'ma4-1-4', type:'number', cat:'calc', level:3, q:'도형을 시계 반대 방향으로 90도씩 3번 돌렸습니다. 이것은 시계 방향으로 몇 도 돌린 것과 결과가 같을까요?', a:'90', hint:'반대 방향으로 270도 돌린 셈입니다.' },
  { id:'p_ma414_135', unitId:'ma4-1-4', type:'choice', cat:'concept', level:3, q:'한 모양을 시계 방향으로 90도씩 돌려 가며 이어 붙여 무늬를 만들었습니다. 처음과 똑같은 모양은 몇 번째마다 다시 나타날까요?', choices:['2번째마다','3번째마다','4번째마다','5번째마다'], a:'4번째마다', hint:'90도씩 몇 번 돌리면 한 바퀴가 되는지 세어 보세요.' },
  // ── 수학 5. 막대그래프 (확장) ──
  { id:'p_ma415_101', unitId:'ma4-1-5', type:'choice', cat:'concept', level:1, q:'막대그래프에서 막대의 길이는 무엇을 나타낼까요?', choices:['조사한 수의 크기','조사한 날짜','조사한 장소','조사한 사람의 이름'], a:'조사한 수의 크기', hint:'막대가 길수록 수가 큽니다.' },
  { id:'p_ma415_102', unitId:'ma4-1-5', type:'number', cat:'calc', level:1, q:'세로 눈금 한 칸이 5명을 나타냅니다. 막대가 7칸이면 몇 명일까요?', a:'35', hint:'한 칸의 크기에 칸 수를 곱하세요.' },
  { id:'p_ma415_103', unitId:'ma4-1-5', type:'number', cat:'calc', level:1, q:'세로 눈금 한 칸이 2권을 나타냅니다. 막대가 8칸이면 몇 권일까요?', a:'16', hint:'2씩 여덟 번 더해 보세요.' },
  { id:'p_ma415_104', unitId:'ma4-1-5', type:'number', cat:'calc', level:1, q:'세로 눈금 한 칸이 10개를 나타냅니다. 막대가 6칸이면 몇 개일까요?', a:'60', hint:'한 칸의 크기에 칸 수를 곱하세요.' },
  { id:'p_ma415_105', unitId:'ma4-1-5', type:'number', cat:'calc', level:1, q:'세로 눈금 한 칸이 3명을 나타냅니다. 막대가 9칸이면 몇 명일까요?', a:'27', hint:'3단 곱셈을 이용하세요.' },
  { id:'p_ma415_106', unitId:'ma4-1-5', type:'number', cat:'calc', level:1, q:'세로 눈금 5칸이 50명을 나타냅니다. 눈금 한 칸은 몇 명을 나타낼까요?', a:'10', hint:'전체를 칸 수로 나누세요.' },
  { id:'p_ma415_107', unitId:'ma4-1-5', type:'number', cat:'calc', level:1, q:'세로 눈금 10칸이 100권을 나타냅니다. 눈금 한 칸은 몇 권을 나타낼까요?', a:'10', hint:'100을 10으로 나누세요.' },
  { id:'p_ma415_108', unitId:'ma4-1-5', type:'choice', cat:'concept', level:1, q:'막대그래프에서 가장 많은 항목을 한눈에 알아내는 방법은 무엇일까요?', choices:['막대의 길이가 가장 긴 것을 찾습니다','막대의 색깔을 봅니다','제목을 읽습니다','가로 눈금의 이름 순서를 봅니다'], a:'막대의 길이가 가장 긴 것을 찾습니다', hint:'막대그래프의 가장 큰 장점을 생각하세요.' },
  { id:'p_ma415_109', unitId:'ma4-1-5', type:'number', cat:'word', level:1, q:'좋아하는 과일을 조사했더니 사과 12명, 포도 9명이었습니다. 두 과일을 좋아하는 학생은 모두 몇 명일까요?', a:'21', hint:'두 수를 더하세요.' },
  { id:'p_ma415_110', unitId:'ma4-1-5', type:'number', cat:'word', level:1, q:'축구를 좋아하는 학생은 15명, 야구를 좋아하는 학생은 8명입니다. 축구를 좋아하는 학생은 몇 명 더 많을까요?', a:'7', hint:'큰 수에서 작은 수를 빼세요.' },
  { id:'p_ma415_111', unitId:'ma4-1-5', type:'choice', cat:'concept', level:1, q:'막대그래프에서 눈금 한 칸의 크기를 정하는 알맞은 방법은 무엇일까요?', choices:['가장 큰 수를 나타낼 수 있게 정합니다','아무 수나 정합니다','항상 1로 정합니다','가장 작은 수로 정합니다'], a:'가장 큰 수를 나타낼 수 있게 정합니다', hint:'가장 긴 막대도 그릴 수 있어야 합니다.' },
  { id:'p_ma415_112', unitId:'ma4-1-5', type:'number', cat:'calc', level:1, q:'세로 눈금 한 칸이 4명일 때 20명을 나타내려면 막대는 몇 칸이어야 할까요?', a:'5', hint:'20을 4로 나누세요.' },
  { id:'p_ma415_113', unitId:'ma4-1-5', type:'number', cat:'calc', level:2, q:'눈금 한 칸이 5권일 때 막대가 12칸인 항목은 몇 권일까요?', a:'60', hint:'5 × 12를 계산하세요.' },
  { id:'p_ma415_114', unitId:'ma4-1-5', type:'number', cat:'calc', level:2, q:'눈금 한 칸이 2명일 때 24명을 나타내려면 막대는 몇 칸이어야 할까요?', a:'12', hint:'24를 2로 나누세요.' },
  { id:'p_ma415_115', unitId:'ma4-1-5', type:'number', cat:'word', level:2, q:'네 반의 학생 수가 25명, 24명, 26명, 23명입니다. 네 반의 학생은 모두 몇 명일까요?', a:'98', hint:'네 수를 차례로 더하세요.' },
  { id:'p_ma415_116', unitId:'ma4-1-5', type:'number', cat:'word', level:2, q:'조사한 학생은 모두 120명입니다. 봄 40명, 여름 35명, 가을 25명이면 겨울을 좋아하는 학생은 몇 명일까요?', a:'20', hint:'전체에서 세 계절의 학생 수를 빼세요.' },
  { id:'p_ma415_117', unitId:'ma4-1-5', type:'number', cat:'word', level:2, q:'가장 긴 막대는 18칸, 가장 짧은 막대는 5칸입니다. 눈금 한 칸이 2명이면 두 항목의 학생 수의 차는 몇 명일까요?', a:'26', hint:'칸 수의 차를 먼저 구하세요.' },
  { id:'p_ma415_118', unitId:'ma4-1-5', type:'number', cat:'calc', level:2, q:'눈금 한 칸이 10개일 때 막대가 7칸인 상자와 4칸인 상자의 물건 수의 합은 몇 개일까요?', a:'110', hint:'칸 수를 먼저 더한 뒤 곱하세요.' },
  { id:'p_ma415_119', unitId:'ma4-1-5', type:'number', cat:'calc', level:2, q:'눈금 한 칸이 5명인 그래프에서 어떤 항목이 45명입니다. 이 항목의 막대는 몇 칸일까요?', a:'9', hint:'45를 5로 나누세요.' },
  { id:'p_ma415_120', unitId:'ma4-1-5', type:'choice', cat:'concept', level:2, q:'눈금 한 칸의 크기를 10에서 5로 바꾸면 같은 수를 나타내는 막대의 칸 수는 어떻게 될까요?', choices:['2배로 늘어납니다','반으로 줄어듭니다','변하지 않습니다','3배로 늘어납니다'], a:'2배로 늘어납니다', hint:'한 칸이 작아지면 칸이 더 많이 필요합니다.' },
  { id:'p_ma415_121', unitId:'ma4-1-5', type:'number', cat:'word', level:2, q:'모둠별 학생 수가 1모둠 14명, 2모둠 11명, 3모둠 9명입니다. 가장 많은 모둠과 가장 적은 모둠의 차는 몇 명일까요?', a:'5', hint:'가장 큰 수와 가장 작은 수를 찾으세요.' },
  { id:'p_ma415_122', unitId:'ma4-1-5', type:'number', cat:'calc', level:2, q:'눈금 한 칸이 4권인 그래프에서 두 항목의 막대가 각각 6칸, 9칸입니다. 두 항목의 책 수의 합은 몇 권일까요?', a:'60', hint:'칸 수를 더한 뒤 4를 곱하세요.' },
  { id:'p_ma415_123', unitId:'ma4-1-5', type:'choice', cat:'concept', level:2, q:'막대그래프를 그릴 때 가장 먼저 해야 할 일은 무엇일까요?', choices:['가로와 세로에 무엇을 나타낼지 정합니다','막대를 먼저 그립니다','제목을 지웁니다','눈금을 모두 지웁니다'], a:'가로와 세로에 무엇을 나타낼지 정합니다', hint:'그래프의 뼈대를 먼저 정해야 합니다.' },
  { id:'p_ma415_124', unitId:'ma4-1-5', type:'number', cat:'calc', level:2, q:'눈금 한 칸이 3개인 그래프에서 막대가 11칸인 항목은 몇 개일까요?', a:'33', hint:'3 × 11을 계산하세요.' },
  { id:'p_ma415_125', unitId:'ma4-1-5', type:'number', cat:'word', level:2, q:'조사한 학생 수의 합은 84명이고 그중 남학생은 46명입니다. 여학생은 몇 명일까요?', a:'38', hint:'전체에서 남학생 수를 빼세요.' },
  { id:'p_ma415_126', unitId:'ma4-1-5', type:'number', cat:'word', level:3, q:'네 항목의 학생 수의 합은 96명입니다. 세 항목이 각각 28명, 19명, 25명일 때 나머지 한 항목은 몇 명일까요?', a:'24', hint:'세 항목의 합을 먼저 구한 뒤 빼세요.' },
  { id:'p_ma415_127', unitId:'ma4-1-5', type:'number', cat:'word', level:3, q:'가와 나의 학생 수의 합은 45명이고 가는 나의 2배입니다. 나는 몇 명일까요?', a:'15', hint:'나를 1묶음으로 보면 모두 3묶음입니다.' },
  { id:'p_ma415_128', unitId:'ma4-1-5', type:'number', cat:'calc', level:3, q:'눈금 한 칸의 크기를 모릅니다. 막대가 8칸인 항목이 56명일 때 막대가 5칸인 항목은 몇 명일까요?', a:'35', hint:'먼저 한 칸의 크기를 구하세요.' },
  { id:'p_ma415_129', unitId:'ma4-1-5', type:'number', cat:'calc', level:3, q:'눈금 한 칸이 5명인 그래프에서 가 항목의 막대는 나 항목의 막대보다 4칸 더 깁니다. 가는 나보다 몇 명 더 많을까요?', a:'20', hint:'칸 수의 차에 한 칸의 크기를 곱하세요.' },
  { id:'p_ma415_130', unitId:'ma4-1-5', type:'number', cat:'calc', level:3, q:'세 항목의 합은 140개입니다. 가는 나보다 20개 많고 다는 나와 같습니다. 나는 몇 개일까요?', a:'40', hint:'140에서 20을 뺀 뒤 3으로 나누어 보세요.' },
  { id:'p_ma415_131', unitId:'ma4-1-5', type:'number', cat:'calc', level:3, q:'눈금 한 칸이 2명일 때 어떤 항목의 막대는 14칸입니다. 눈금 한 칸을 4명으로 바꾸면 이 항목의 막대는 몇 칸이 될까요?', a:'7', hint:'먼저 그 항목이 몇 명인지 구하세요.' },
  { id:'p_ma415_132', unitId:'ma4-1-5', type:'number', cat:'word', level:3, q:'두 항목의 학생 수의 합은 68명이고 한 항목이 다른 항목보다 12명 많습니다. 많은 쪽은 몇 명일까요?', a:'40', hint:'합에 차를 더한 뒤 반으로 나누어 보세요.' },
  { id:'p_ma415_133', unitId:'ma4-1-5', type:'number', cat:'word', level:3, q:'강아지와 고양이를 좋아하는 학생은 모두 80명입니다. 강아지를 좋아하는 학생은 고양이를 좋아하는 학생의 3배일 때 강아지를 좋아하는 학생은 몇 명일까요?', a:'60', hint:'고양이를 1묶음으로 보면 모두 4묶음입니다.' },
  { id:'p_ma415_134', unitId:'ma4-1-5', type:'number', cat:'calc', level:3, q:'눈금 한 칸이 5권인 그래프에서 세 항목의 막대가 각각 7칸, 4칸, 9칸입니다. 세 항목의 책 수의 합에서 가장 적은 항목의 책 수를 빼면 몇 권일까요?', a:'80', hint:'칸 수로 먼저 계산한 뒤 5를 곱해도 됩니다.' },
  { id:'p_ma415_135', unitId:'ma4-1-5', type:'number', cat:'word', level:3, q:'두 반의 학생 수의 합은 51명입니다. 1반은 2반보다 3명 적을 때 2반은 몇 명일까요?', a:'27', hint:'51에 3을 더한 뒤 반으로 나누어 보세요.' },
  // ── 수학 6. 규칙과 관계 (확장) ──
  { id:'p_ma416_101', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'2, 5, 8, 11 다음에 올 수는 얼마일까요?', a:'14', hint:'얼마씩 커지는지 찾으세요.' },
  { id:'p_ma416_102', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'100, 90, 80, 70 다음에 올 수는 얼마일까요?', a:'60', hint:'얼마씩 작아지는지 찾으세요.' },
  { id:'p_ma416_103', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'1, 2, 4, 8 다음에 올 수는 얼마일까요?', a:'16', hint:'앞의 수에 몇을 곱했는지 보세요.' },
  { id:'p_ma416_104', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'3, 6, 12, 24 다음에 올 수는 얼마일까요?', a:'48', hint:'앞의 수의 2배가 되고 있습니다.' },
  { id:'p_ma416_105', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'25 + 15 = 20 + □ 입니다. □에 알맞은 수는 얼마일까요?', a:'20', hint:'왼쪽을 먼저 계산해 보세요.' },
  { id:'p_ma416_106', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'34 + 16 = □ + 20 입니다. □에 알맞은 수는 얼마일까요?', a:'30', hint:'양쪽의 크기가 같아야 합니다.' },
  { id:'p_ma416_107', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'8 × 6 = 12 × □ 입니다. □에 알맞은 수는 얼마일까요?', a:'4', hint:'왼쪽 값을 구한 뒤 12로 나누세요.' },
  { id:'p_ma416_108', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'45 - 12 = 40 - □ 입니다. □에 알맞은 수는 얼마일까요?', a:'7', hint:'왼쪽을 먼저 계산해 보세요.' },
  { id:'p_ma416_109', unitId:'ma4-1-6', type:'choice', cat:'concept', level:1, q:'등호(=)는 무엇을 나타낼까요?', choices:['양쪽의 크기가 같음','왼쪽이 더 큼','오른쪽이 더 큼','계산을 시작함'], a:'양쪽의 크기가 같음', hint:'저울이 평평한 모습을 떠올리세요.' },
  { id:'p_ma416_110', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'5, 10, 15, 20 다음에 올 수는 얼마일까요?', a:'25', hint:'5씩 커지고 있습니다.' },
  { id:'p_ma416_111', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'1, 3, 5, 7 다음에 올 수는 얼마일까요?', a:'9', hint:'홀수가 차례로 나옵니다.' },
  { id:'p_ma416_112', unitId:'ma4-1-6', type:'number', cat:'calc', level:1, q:'30 + 20 = 25 + □ 입니다. □에 알맞은 수는 얼마일까요?', a:'25', hint:'왼쪽의 합을 먼저 구하세요.' },
  { id:'p_ma416_113', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'1, 4, 9, 16 다음에 올 수는 얼마일까요?', a:'25', hint:'같은 수를 두 번 곱한 수입니다.' },
  { id:'p_ma416_114', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'7 × 8 = □ × 4 입니다. □에 알맞은 수는 얼마일까요?', a:'14', hint:'왼쪽 값을 구한 뒤 4로 나누세요.' },
  { id:'p_ma416_115', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'100 - 35 = □ + 25 입니다. □에 알맞은 수는 얼마일까요?', a:'40', hint:'왼쪽 값에서 25를 빼세요.' },
  { id:'p_ma416_116', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'2, 6, 18, 54 다음에 올 수는 얼마일까요?', a:'162', hint:'앞의 수의 3배가 되고 있습니다.' },
  { id:'p_ma416_117', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'1, 3, 6, 10 다음에 올 수는 얼마일까요?', a:'15', hint:'더해지는 수가 1씩 커지고 있습니다.' },
  { id:'p_ma416_118', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'100 ÷ 4 = 25, 200 ÷ 8 = 25, 300 ÷ 12 = 25 입니다. 400 ÷ □ = 25 일 때 □에 알맞은 수는 얼마일까요?', a:'16', hint:'나누는 수가 4씩 커지고 있습니다.' },
  { id:'p_ma416_119', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'11 × 11 = 121, 111 × 111 = 12321 입니다. 규칙에 따라 1111 × 1111 은 얼마일까요?', a:'1234321', hint:'가운데 수가 1씩 커지는 모양을 살펴보세요.' },
  { id:'p_ma416_120', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'□ + 27 = 15 + 42 입니다. □에 알맞은 수는 얼마일까요?', a:'30', hint:'오른쪽을 먼저 계산하세요.' },
  { id:'p_ma416_121', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'48 ÷ 6 = □ ÷ 12 입니다. □에 알맞은 수는 얼마일까요?', a:'96', hint:'왼쪽 값에 12를 곱해 보세요.' },
  { id:'p_ma416_122', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'5, 9, 13, 17 다음에 올 수는 얼마일까요?', a:'21', hint:'4씩 커지고 있습니다.' },
  { id:'p_ma416_123', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'성냥개비로 삼각형을 이어 붙여 만듭니다. 1개는 3개비, 2개는 5개비, 3개는 7개비가 필요합니다. 4개를 만들려면 몇 개비가 필요할까요?', a:'9', hint:'삼각형이 하나 늘 때마다 2개비씩 늘어납니다.' },
  { id:'p_ma416_124', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'64, 32, 16, 8 다음에 올 수는 얼마일까요?', a:'4', hint:'앞의 수를 2로 나누고 있습니다.' },
  { id:'p_ma416_125', unitId:'ma4-1-6', type:'number', cat:'calc', level:2, q:'15 + □ = 23 + 17 입니다. □에 알맞은 수는 얼마일까요?', a:'25', hint:'오른쪽의 합을 먼저 구하세요.' },
  { id:'p_ma416_126', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'1, 4, 9, 16 과 같은 규칙으로 수를 늘어놓았습니다. 10번째 수는 얼마일까요?', a:'100', hint:'몇 번째 수인지와 같은 수를 두 번 곱해 보세요.' },
  { id:'p_ma416_127', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'5, 9, 13, 17 과 같은 규칙으로 수를 늘어놓았습니다. 20번째 수는 얼마일까요?', a:'81', hint:'첫째 수에 4를 19번 더한 것과 같습니다.' },
  { id:'p_ma416_128', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'3, 7, 11, 15 와 같은 규칙으로 수를 늘어놓았습니다. 15번째 수는 얼마일까요?', a:'59', hint:'몇 번 더해야 하는지 세어 보세요.' },
  { id:'p_ma416_129', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'1, 3, 5, 7 과 같이 홀수를 차례로 늘어놓았습니다. 12번째 수는 얼마일까요?', a:'23', hint:'번째 수를 두 배 한 뒤 1을 빼 보세요.' },
  { id:'p_ma416_130', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'성냥개비로 삼각형을 이어 붙여 만듭니다. 1개는 3개비, 2개는 5개비, 3개는 7개비가 필요합니다. 10개를 만들려면 몇 개비가 필요할까요?', a:'21', hint:'삼각형 하나가 늘 때마다 2개비씩 늘어납니다.' },
  { id:'p_ma416_131', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'바둑돌을 1개, 3개, 6개, 10개 순서로 늘어놓습니다. 8번째에 놓는 바둑돌은 몇 개일까요?', a:'36', hint:'1부터 8까지 차례로 모두 더해 보세요.' },
  { id:'p_ma416_132', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'어떤 수에 15를 더해야 하는데 잘못하여 15를 뺐더니 28이 되었습니다. 바르게 계산한 값은 얼마일까요?', a:'58', hint:'먼저 어떤 수를 거꾸로 구하세요.' },
  { id:'p_ma416_133', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'□ + 18 = 47 - 12 입니다. □에 알맞은 수는 얼마일까요?', a:'17', hint:'오른쪽을 먼저 계산한 뒤 18을 빼세요.' },
  { id:'p_ma416_134', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'2, 4, 8, 16 과 같은 규칙으로 수를 늘어놓았습니다. 8번째 수는 얼마일까요?', a:'256', hint:'2배씩 계속 커집니다. 차례로 써 보세요.' },
  { id:'p_ma416_135', unitId:'ma4-1-6', type:'number', cat:'calc', level:3, q:'6, 11, 16, 21 과 같은 규칙으로 수를 늘어놓았습니다. 100보다 큰 수가 처음 나오는 것은 몇 번째일까요?', a:'20', hint:'5씩 커집니다. 100에 가까운 수부터 찾아보세요.' },
  // ── 영어 L1. My Name Is Amy — 듣기 ──
  { id:'p_en411_301', unitId:'en4-1-1', type:'choice', cat:'listen', level:1, audio:'Good morning.', q:'듣고 알맞은 뜻을 고르세요.', choices:['좋은 아침이야.','좋은 밤이야.','잘 가.','고마워.'], a:'좋은 아침이야.', hint:'아침에 만나서 하는 인사예요' },
  { id:'p_en411_302', unitId:'en4-1-1', type:'choice', cat:'listen', level:1, audio:'See you later.', q:'듣고 알맞은 뜻을 고르세요.', choices:['나중에 봐.','처음 뵙겠습니다.','미안해.','도와줘.'], a:'나중에 봐.', hint:'헤어질 때 하는 말이에요' },
  { id:'p_en411_303', unitId:'en4-1-1', type:'choice', cat:'listen', level:2, audio:'My name is Amy.', q:'듣고 알맞은 뜻을 고르세요.', choices:['내 이름은 Amy야.','나는 Amy를 알아.','Amy는 내 동생이야.','Amy를 불러 줘.'], a:'내 이름은 Amy야.', hint:'이름을 소개하고 있어요' },
  { id:'p_en411_304', unitId:'en4-1-1', type:'choice', cat:'listen', level:2, audio:'This is my friend Suho.', q:'듣고 알맞은 뜻을 고르세요.', choices:['이 아이는 내 친구 수호야.','나는 수호를 만나고 싶어.','수호는 우리 형이야.','수호는 학교에 있어.'], a:'이 아이는 내 친구 수호야.', hint:'This is ~ = 이 사람은 ~야' },
  { id:'p_en411_305', unitId:'en4-1-1', type:'choice', cat:'listen', level:3, audio:'I\'m a new student.', q:'듣고 알맞은 뜻을 고르세요.', choices:['나는 새로 온 학생이야.','나는 선생님이야.','나는 학교에 안 가.','나는 열 살이야.'], a:'나는 새로 온 학생이야.', hint:'new = 새로운, student = 학생' },
  { id:'p_en411_306', unitId:'en4-1-1', type:'choice', cat:'listen', level:3, audio:'How do you spell your name?', q:'듣고 알맞은 뜻을 고르세요.', choices:['네 이름은 철자가 어떻게 되니?','네 이름은 무엇이니?','너는 몇 살이니?','너는 어디에 사니?'], a:'네 이름은 철자가 어떻게 되니?', hint:'spell = 철자를 말하다' },
  { id:'p_en411_307', unitId:'en4-1-1', type:'short', cat:'listen', level:1, audio:'name', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'name', alt:['Name'], hint:'n으로 시작하는 네 글자, 이름이라는 뜻' },
  { id:'p_en411_308', unitId:'en4-1-1', type:'short', cat:'listen', level:1, audio:'hello', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'hello', alt:['Hello'], hint:'h로 시작하는 인사말' },
  { id:'p_en411_309', unitId:'en4-1-1', type:'short', cat:'listen', level:1, audio:'nice', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'nice', alt:['Nice'], hint:'좋은, 멋진이라는 뜻이에요' },
  { id:'p_en411_310', unitId:'en4-1-1', type:'short', cat:'listen', level:2, audio:'morning', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'morning', alt:['Morning'], hint:'아침이라는 뜻, m으로 시작해요' },
  { id:'p_en411_311', unitId:'en4-1-1', type:'choice', cat:'listen', level:1, audio:'Good bye.', q:'듣고 알맞은 상황을 고르세요.', choices:['헤어지며 손을 흔드는 모습','처음 만나 악수하는 모습','밥을 먹는 모습','책을 읽는 모습'], a:'헤어지며 손을 흔드는 모습', hint:'헤어질 때 하는 인사예요' },
  { id:'p_en411_312', unitId:'en4-1-1', type:'choice', cat:'listen', level:2, audio:'Hi, I\'m Tom.', q:'듣고 알맞은 상황을 고르세요.', choices:['친구들 앞에서 자기 이름을 말하는 모습','친구를 찾아다니는 모습','선생님께 사과하는 모습','가게에서 물건을 사는 모습'], a:'친구들 앞에서 자기 이름을 말하는 모습', hint:'자기를 소개하고 있어요' },
  { id:'p_en411_313', unitId:'en4-1-1', type:'choice', cat:'listen', level:2, audio:'Nice to meet you.', q:'듣고 알맞은 상황을 고르세요.', choices:['처음 만난 친구와 반갑게 인사하는 모습','친구와 헤어지며 손을 흔드는 모습','교실에서 청소하는 모습','운동장에서 달리는 모습'], a:'처음 만난 친구와 반갑게 인사하는 모습', hint:'meet = 만나다' },
  { id:'p_en411_314', unitId:'en4-1-1', type:'choice', cat:'listen', level:2, audio:'What\'s your name?', q:'듣고 알맞은 대답을 고르세요.', choices:['My name is Mina.','I\'m fine, thank you.','It\'s on the desk.','Let\'s play soccer.'], a:'My name is Mina.', hint:'이름을 묻고 있어요' },
  { id:'p_en411_315', unitId:'en4-1-1', type:'choice', cat:'listen', level:3, audio:'Is your name Amy?', q:'듣고 알맞은 대답을 고르세요.', choices:['Yes, my name is Amy.','I\'m ten years old.','It\'s in the box.','Let\'s go home.'], a:'Yes, my name is Amy.', hint:'이름이 맞는지 확인하고 있어요' },
  // ── 영어 L2. I'm Happy — 듣기 ──
  { id:'p_en412_301', unitId:'en4-1-2', type:'choice', cat:'listen', level:1, audio:'I\'m sad.', q:'듣고 알맞은 뜻을 고르세요.', choices:['나는 슬퍼.','나는 기뻐.','나는 배고파.','나는 졸려.'], a:'나는 슬퍼.', hint:'sad = 슬픈' },
  { id:'p_en412_302', unitId:'en4-1-2', type:'choice', cat:'listen', level:1, audio:'I\'m sleepy.', q:'듣고 알맞은 뜻을 고르세요.', choices:['나는 졸려.','나는 화났어.','나는 목말라.','나는 신나.'], a:'나는 졸려.', hint:'sleep = 자다' },
  { id:'p_en412_303', unitId:'en4-1-2', type:'choice', cat:'listen', level:2, audio:'How are you today?', q:'듣고 알맞은 뜻을 고르세요.', choices:['오늘 기분이 어떠니?','오늘 무엇을 하니?','오늘 어디에 가니?','오늘은 며칠이니?'], a:'오늘 기분이 어떠니?', hint:'안부를 묻는 말이에요' },
  { id:'p_en412_304', unitId:'en4-1-2', type:'choice', cat:'listen', level:2, audio:'I\'m fine, thank you.', q:'듣고 알맞은 뜻을 고르세요.', choices:['나는 잘 지내, 고마워.','나는 아파, 미안해.','나는 배고파, 도와줘.','나는 집에 갈래, 잘 가.'], a:'나는 잘 지내, 고마워.', hint:'fine = 좋은, 괜찮은' },
  { id:'p_en412_305', unitId:'en4-1-2', type:'choice', cat:'listen', level:3, audio:'I\'m not happy today.', q:'듣고 알맞은 뜻을 고르세요.', choices:['나는 오늘 기분이 좋지 않아.','나는 오늘 아주 행복해.','나는 오늘 학교에 안 가.','나는 오늘 아주 바빠.'], a:'나는 오늘 기분이 좋지 않아.', hint:'not이 들어 있는지 잘 들어 보세요' },
  { id:'p_en412_306', unitId:'en4-1-2', type:'choice', cat:'listen', level:3, audio:'Are you sad or angry?', q:'듣고 알맞은 뜻을 고르세요.', choices:['너는 슬프니, 아니면 화났니?','너는 슬프고 화도 났구나.','너는 슬프지 않구나.','너는 왜 웃고 있니?'], a:'너는 슬프니, 아니면 화났니?', hint:'or = 아니면' },
  { id:'p_en412_307', unitId:'en4-1-2', type:'short', cat:'listen', level:1, audio:'sad', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'sad', alt:['Sad'], hint:'s로 시작하는 세 글자, 슬픈' },
  { id:'p_en412_308', unitId:'en4-1-2', type:'short', cat:'listen', level:1, audio:'happy', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'happy', alt:['Happy'], hint:'h로 시작해요, 행복한' },
  { id:'p_en412_309', unitId:'en4-1-2', type:'short', cat:'listen', level:1, audio:'angry', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'angry', alt:['Angry'], hint:'a로 시작해요, 화난' },
  { id:'p_en412_310', unitId:'en4-1-2', type:'short', cat:'listen', level:2, audio:'sleepy', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'sleepy', alt:['Sleepy'], hint:'sleep에 y를 붙인 말이에요' },
  { id:'p_en412_311', unitId:'en4-1-2', type:'choice', cat:'listen', level:1, audio:'I\'m hungry.', q:'듣고 알맞은 상황을 고르세요.', choices:['배를 만지며 밥을 기다리는 모습','침대에서 잠을 자는 모습','친구와 축구를 하는 모습','책을 읽고 있는 모습'], a:'배를 만지며 밥을 기다리는 모습', hint:'hungry = 배고픈' },
  { id:'p_en412_312', unitId:'en4-1-2', type:'choice', cat:'listen', level:2, audio:'I\'m very tired.', q:'듣고 알맞은 상황을 고르세요.', choices:['운동을 마치고 힘없이 앉아 쉬는 모습','신나게 웃으며 뛰어노는 모습','맛있게 밥을 먹는 모습','큰 소리로 노래하는 모습'], a:'운동을 마치고 힘없이 앉아 쉬는 모습', hint:'tired = 피곤한' },
  { id:'p_en412_313', unitId:'en4-1-2', type:'choice', cat:'listen', level:2, audio:'My sister is happy.', q:'듣고 알맞은 상황을 고르세요.', choices:['언니가 활짝 웃고 있는 모습','언니가 울고 있는 모습','언니가 화를 내는 모습','언니가 졸고 있는 모습'], a:'언니가 활짝 웃고 있는 모습', hint:'sister = 언니, 누나, 여동생' },
  { id:'p_en412_314', unitId:'en4-1-2', type:'choice', cat:'listen', level:2, audio:'How are you?', q:'듣고 알맞은 대답을 고르세요.', choices:['I\'m fine, thank you.','My name is Tom.','It\'s on the desk.','Let\'s play badminton.'], a:'I\'m fine, thank you.', hint:'기분과 안부를 묻고 있어요' },
  { id:'p_en412_315', unitId:'en4-1-2', type:'choice', cat:'listen', level:3, audio:'Are you okay?', q:'듣고 알맞은 대답을 고르세요.', choices:['Yes, I\'m okay.','It\'s under the desk.','My name is Amy.','I want some water.'], a:'Yes, I\'m okay.', hint:'괜찮은지 묻고 있어요' },
  // ── 영어 L3. Don't Sit Here — 듣기 ──
  { id:'p_en413_301', unitId:'en4-1-3', type:'choice', cat:'listen', level:1, audio:'Don\'t run.', q:'듣고 알맞은 뜻을 고르세요.', choices:['뛰지 마.','뛰어 봐.','일어나.','앉아.'], a:'뛰지 마.', hint:'Don\'t = ~하지 마' },
  { id:'p_en413_302', unitId:'en4-1-3', type:'choice', cat:'listen', level:1, audio:'Sit down, please.', q:'듣고 알맞은 뜻을 고르세요.', choices:['앉으세요.','일어나세요.','문을 여세요.','밖으로 나가세요.'], a:'앉으세요.', hint:'sit = 앉다' },
  { id:'p_en413_303', unitId:'en4-1-3', type:'choice', cat:'listen', level:2, audio:'Don\'t touch the flowers.', q:'듣고 알맞은 뜻을 고르세요.', choices:['꽃을 만지지 마세요.','꽃에 물을 주세요.','꽃을 그려 보세요.','꽃을 사 오세요.'], a:'꽃을 만지지 마세요.', hint:'touch = 만지다' },
  { id:'p_en413_304', unitId:'en4-1-3', type:'choice', cat:'listen', level:2, audio:'Please be quiet in the library.', q:'듣고 알맞은 뜻을 고르세요.', choices:['도서관에서는 조용히 해 주세요.','도서관에서 책을 빌려 주세요.','도서관에 가지 마세요.','도서관에서 노래해 주세요.'], a:'도서관에서는 조용히 해 주세요.', hint:'quiet = 조용한' },
  { id:'p_en413_305', unitId:'en4-1-3', type:'choice', cat:'listen', level:3, audio:'Don\'t open the window now.', q:'듣고 알맞은 뜻을 고르세요.', choices:['지금 창문을 열지 마세요.','지금 창문을 여세요.','지금 문을 닫으세요.','지금 밖으로 나가세요.'], a:'지금 창문을 열지 마세요.', hint:'Don\'t가 앞에 붙었는지 잘 들어 보세요' },
  { id:'p_en413_306', unitId:'en4-1-3', type:'choice', cat:'listen', level:3, audio:'Don\'t eat here. Eat outside.', q:'듣고 알맞은 뜻을 고르세요.', choices:['여기서 먹지 말고 밖에서 먹으렴.','여기서 먹어도 괜찮아.','밖에서는 먹지 마.','여기서는 놀지 마.'], a:'여기서 먹지 말고 밖에서 먹으렴.', hint:'outside = 바깥에서' },
  { id:'p_en413_307', unitId:'en4-1-3', type:'short', cat:'listen', level:1, audio:'run', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'run', alt:['Run'], hint:'r로 시작하는 세 글자, 달리다' },
  { id:'p_en413_308', unitId:'en4-1-3', type:'short', cat:'listen', level:1, audio:'sit', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'sit', alt:['Sit'], hint:'s로 시작하는 세 글자, 앉다' },
  { id:'p_en413_309', unitId:'en4-1-3', type:'short', cat:'listen', level:1, audio:'stand', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'stand', alt:['Stand'], hint:'st로 시작해요, 서다' },
  { id:'p_en413_310', unitId:'en4-1-3', type:'short', cat:'listen', level:2, audio:'push', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'push', alt:['Push'], hint:'p로 시작해요, 밀다' },
  { id:'p_en413_311', unitId:'en4-1-3', type:'choice', cat:'listen', level:1, audio:'Don\'t swim here.', q:'듣고 알맞은 상황을 고르세요.', choices:['수영 금지 표지판이 있는 강가','수영장에서 수영을 배우는 모습','교실에서 공부하는 모습','식탁에서 밥을 먹는 모습'], a:'수영 금지 표지판이 있는 강가', hint:'swim = 수영하다' },
  { id:'p_en413_312', unitId:'en4-1-3', type:'choice', cat:'listen', level:2, audio:'Don\'t run in the hallway.', q:'듣고 알맞은 상황을 고르세요.', choices:['복도에서 천천히 걸어가는 모습','운동장에서 달리기를 하는 모습','교실에서 그림을 그리는 모습','급식실에서 밥을 먹는 모습'], a:'복도에서 천천히 걸어가는 모습', hint:'hallway = 복도' },
  { id:'p_en413_313', unitId:'en4-1-3', type:'choice', cat:'listen', level:2, audio:'Be quiet, please.', q:'듣고 알맞은 상황을 고르세요.', choices:['입에 손가락을 대고 조용히 하라고 하는 모습','큰 소리로 노래를 부르는 모습','친구와 뛰어노는 모습','손을 씻고 있는 모습'], a:'입에 손가락을 대고 조용히 하라고 하는 모습', hint:'quiet = 조용한' },
  { id:'p_en413_314', unitId:'en4-1-3', type:'choice', cat:'listen', level:2, audio:'Can I sit here?', q:'듣고 알맞은 대답을 고르세요.', choices:['No, don\'t sit here.','It\'s a nice day.','My name is Amy.','I want some milk.'], a:'No, don\'t sit here.', hint:'여기 앉아도 되는지 묻고 있어요' },
  { id:'p_en413_315', unitId:'en4-1-3', type:'choice', cat:'listen', level:3, audio:'May I open the door?', q:'듣고 알맞은 대답을 고르세요.', choices:['Yes, you may.','Yes, I\'m fine.','It\'s on the chair.','Let\'s eat pizza.'], a:'Yes, you may.', hint:'해도 되는지 허락을 묻고 있어요' },
  // ── 영어 L4. Let's Play Basketball — 듣기 ──
  { id:'p_en414_301', unitId:'en4-1-4', type:'choice', cat:'listen', level:1, audio:'Let\'s go.', q:'듣고 알맞은 뜻을 고르세요.', choices:['가자.','오지 마.','앉아.','기다려.'], a:'가자.', hint:'Let\'s = 우리 ~하자' },
  { id:'p_en414_302', unitId:'en4-1-4', type:'choice', cat:'listen', level:1, audio:'Good idea!', q:'듣고 알맞은 뜻을 고르세요.', choices:['좋은 생각이야!','안 돼!','미안해!','고마워!'], a:'좋은 생각이야!', hint:'idea = 생각' },
  { id:'p_en414_303', unitId:'en4-1-4', type:'choice', cat:'listen', level:2, audio:'Let\'s play basketball.', q:'듣고 알맞은 뜻을 고르세요.', choices:['우리 농구하자.','나는 농구를 잘해.','농구는 재미있어.','농구는 하지 말자.'], a:'우리 농구하자.', hint:'basketball = 농구' },
  { id:'p_en414_304', unitId:'en4-1-4', type:'choice', cat:'listen', level:2, audio:'Sorry, I can\'t.', q:'듣고 알맞은 뜻을 고르세요.', choices:['미안하지만 안 되겠어.','미안해, 내가 할게.','괜찮아, 고마워.','좋아, 그렇게 하자.'], a:'미안하지만 안 되겠어.', hint:'제안을 거절하는 말이에요' },
  { id:'p_en414_305', unitId:'en4-1-4', type:'choice', cat:'listen', level:3, audio:'Let\'s play badminton after school.', q:'듣고 알맞은 뜻을 고르세요.', choices:['방과 후에 배드민턴을 치자.','학교 수업 시간에 배드민턴을 치자.','배드민턴은 치지 말자.','방과 후에 바로 집에 가자.'], a:'방과 후에 배드민턴을 치자.', hint:'after school = 방과 후에' },
  { id:'p_en414_306', unitId:'en4-1-4', type:'choice', cat:'listen', level:3, audio:'Let\'s sing and dance together.', q:'듣고 알맞은 뜻을 고르세요.', choices:['우리 함께 노래하고 춤추자.','우리 노래만 부르자.','나는 노래를 잘 불러.','우리 춤은 추지 말자.'], a:'우리 함께 노래하고 춤추자.', hint:'and로 두 가지를 이어 말했어요' },
  { id:'p_en414_307', unitId:'en4-1-4', type:'short', cat:'listen', level:1, audio:'play', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'play', alt:['Play'], hint:'p로 시작해요, 놀다·운동을 하다' },
  { id:'p_en414_308', unitId:'en4-1-4', type:'short', cat:'listen', level:1, audio:'jump', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'jump', alt:['Jump'], hint:'j로 시작하는 네 글자, 뛰어오르다' },
  { id:'p_en414_309', unitId:'en4-1-4', type:'short', cat:'listen', level:1, audio:'swim', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'swim', alt:['Swim'], hint:'sw로 시작해요, 수영하다' },
  { id:'p_en414_310', unitId:'en4-1-4', type:'short', cat:'listen', level:2, audio:'sing', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'sing', alt:['Sing'], hint:'s로 시작하고 ing로 끝나요, 노래하다' },
  { id:'p_en414_311', unitId:'en4-1-4', type:'choice', cat:'listen', level:1, audio:'Let\'s swim.', q:'듣고 알맞은 상황을 고르세요.', choices:['친구와 함께 수영장에 들어가는 모습','자전거를 타고 달리는 모습','식당에서 밥을 먹는 모습','도서관에서 책을 읽는 모습'], a:'친구와 함께 수영장에 들어가는 모습', hint:'swim = 수영하다' },
  { id:'p_en414_312', unitId:'en4-1-4', type:'choice', cat:'listen', level:2, audio:'Let\'s ride a bike.', q:'듣고 알맞은 상황을 고르세요.', choices:['친구와 자전거를 타러 가는 모습','공원에서 공을 차는 모습','무대에서 노래하는 모습','교실을 청소하는 모습'], a:'친구와 자전거를 타러 가는 모습', hint:'bike = 자전거' },
  { id:'p_en414_313', unitId:'en4-1-4', type:'choice', cat:'listen', level:2, audio:'Let\'s play soccer together.', q:'듣고 알맞은 상황을 고르세요.', choices:['운동장에서 축구공을 차는 모습','교실에서 그림을 그리는 모습','도서관에서 책을 고르는 모습','급식실에서 밥을 먹는 모습'], a:'운동장에서 축구공을 차는 모습', hint:'soccer = 축구' },
  { id:'p_en414_314', unitId:'en4-1-4', type:'choice', cat:'listen', level:2, audio:'Let\'s go to the park.', q:'듣고 알맞은 대답을 고르세요.', choices:['Sounds good!','My name is Jinu.','It\'s in the box.','I\'m nine years old.'], a:'Sounds good!', hint:'같이 가자고 제안하고 있어요' },
  { id:'p_en414_315', unitId:'en4-1-4', type:'choice', cat:'listen', level:3, audio:'Can you play badminton with me?', q:'듣고 알맞은 대답을 고르세요.', choices:['Sure, let\'s play.','It\'s on the desk.','I\'m very sad.','No, it\'s a cap.'], a:'Sure, let\'s play.', hint:'함께 하자고 묻고 있어요' },
  // ── 영어 L5. I Want Chicken — 듣기 ──
  { id:'p_en415_301', unitId:'en4-1-5', type:'choice', cat:'listen', level:1, audio:'I want milk.', q:'듣고 알맞은 뜻을 고르세요.', choices:['나는 우유를 원해.','나는 우유를 싫어해.','우유가 하나도 없어.','우유를 사다 줘.'], a:'나는 우유를 원해.', hint:'want = 원하다' },
  { id:'p_en415_302', unitId:'en4-1-5', type:'choice', cat:'listen', level:1, audio:'Here you are.', q:'듣고 알맞은 뜻을 고르세요.', choices:['여기 있어.','저기를 봐.','너 어디 있니?','이리로 와.'], a:'여기 있어.', hint:'물건을 건네줄 때 하는 말이에요' },
  { id:'p_en415_303', unitId:'en4-1-5', type:'choice', cat:'listen', level:2, audio:'I want some bread.', q:'듣고 알맞은 뜻을 고르세요.', choices:['나는 빵을 좀 먹고 싶어.','나는 빵을 다 먹었어.','우리 빵을 만들자.','빵 가게가 문을 닫았어.'], a:'나는 빵을 좀 먹고 싶어.', hint:'bread = 빵' },
  { id:'p_en415_304', unitId:'en4-1-5', type:'choice', cat:'listen', level:2, audio:'Do you want some juice?', q:'듣고 알맞은 뜻을 고르세요.', choices:['주스를 좀 마실래?','주스를 다 마셨니?','주스는 어디에 있니?','우리 주스를 만들자.'], a:'주스를 좀 마실래?', hint:'상대에게 권하는 말이에요' },
  { id:'p_en415_305', unitId:'en4-1-5', type:'choice', cat:'listen', level:3, audio:'What do you want to eat?', q:'듣고 알맞은 뜻을 고르세요.', choices:['무엇을 먹고 싶니?','언제 밥을 먹니?','누구와 밥을 먹니?','어디에서 밥을 먹니?'], a:'무엇을 먹고 싶니?', hint:'맨 앞에 나온 말을 잘 들어 보세요' },
  { id:'p_en415_306', unitId:'en4-1-5', type:'choice', cat:'listen', level:3, audio:'I want chicken and rice, please.', q:'듣고 알맞은 뜻을 고르세요.', choices:['치킨과 밥을 주세요.','치킨만 주세요.','밥은 빼고 주세요.','치킨은 좋아하지 않아요.'], a:'치킨과 밥을 주세요.', hint:'and로 두 가지를 이어 말했어요' },
  { id:'p_en415_307', unitId:'en4-1-5', type:'short', cat:'listen', level:1, audio:'milk', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'milk', alt:['Milk'], hint:'m으로 시작하는 네 글자, 우유' },
  { id:'p_en415_308', unitId:'en4-1-5', type:'short', cat:'listen', level:1, audio:'egg', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'egg', alt:['Egg'], hint:'e로 시작하는 세 글자, 달걀' },
  { id:'p_en415_309', unitId:'en4-1-5', type:'short', cat:'listen', level:1, audio:'fish', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'fish', alt:['Fish'], hint:'f로 시작해요, 물고기·생선' },
  { id:'p_en415_310', unitId:'en4-1-5', type:'short', cat:'listen', level:2, audio:'water', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'water', alt:['Water'], hint:'w로 시작해요, 물' },
  { id:'p_en415_311', unitId:'en4-1-5', type:'choice', cat:'listen', level:1, audio:'I want water.', q:'듣고 알맞은 상황을 고르세요.', choices:['목이 말라 컵을 내미는 모습','운동장에서 공을 차는 모습','책상에서 글씨를 쓰는 모습','손을 씻고 있는 모습'], a:'목이 말라 컵을 내미는 모습', hint:'water = 물' },
  { id:'p_en415_312', unitId:'en4-1-5', type:'choice', cat:'listen', level:2, audio:'I want a hamburger.', q:'듣고 알맞은 상황을 고르세요.', choices:['가게에서 햄버거를 주문하는 모습','공원에서 자전거를 타는 모습','교실에서 발표하는 모습','침대에서 잠을 자는 모습'], a:'가게에서 햄버거를 주문하는 모습', hint:'want = 원하다' },
  { id:'p_en415_313', unitId:'en4-1-5', type:'choice', cat:'listen', level:2, audio:'Do you want some cake?', q:'듣고 알맞은 상황을 고르세요.', choices:['친구에게 케이크 접시를 내밀며 권하는 모습','혼자 조용히 책을 읽는 모습','운동장에서 달리기를 하는 모습','칠판을 지우고 있는 모습'], a:'친구에게 케이크 접시를 내밀며 권하는 모습', hint:'권하는 말이에요' },
  { id:'p_en415_314', unitId:'en4-1-5', type:'choice', cat:'listen', level:2, audio:'What do you want?', q:'듣고 알맞은 대답을 고르세요.', choices:['I want pizza.','I\'m eleven years old.','It\'s under the bed.','Let\'s go home.'], a:'I want pizza.', hint:'원하는 것을 묻고 있어요' },
  { id:'p_en415_315', unitId:'en4-1-5', type:'choice', cat:'listen', level:3, audio:'Do you want some more soup?', q:'듣고 알맞은 대답을 고르세요.', choices:['No, thank you.','My name is Suho.','It\'s in the bag.','Let\'s play soccer.'], a:'No, thank you.', hint:'더 먹을지 묻고 있어요' },
  // ── 영어 L6. Where's My Cap? — 듣기 ──
  { id:'p_en416_301', unitId:'en4-1-6', type:'choice', cat:'listen', level:1, audio:'Where\'s my cap?', q:'듣고 알맞은 뜻을 고르세요.', choices:['내 모자가 어디 있지?','내 모자는 무슨 색이지?','이건 누구 모자지?','모자를 써도 될까?'], a:'내 모자가 어디 있지?', hint:'where = 어디' },
  { id:'p_en416_302', unitId:'en4-1-6', type:'choice', cat:'listen', level:2, audio:'It\'s on the desk.', q:'듣고 알맞은 뜻을 고르세요.', choices:['책상 위에 있어.','책상 아래에 있어.','책상 안에 있어.','책상이 하나 있어.'], a:'책상 위에 있어.', hint:'on = ~위에' },
  { id:'p_en416_303', unitId:'en4-1-6', type:'choice', cat:'listen', level:2, audio:'My bag is under the chair.', q:'듣고 알맞은 뜻을 고르세요.', choices:['내 가방은 의자 아래에 있어.','내 가방은 의자 위에 있어.','내 가방은 책상 아래에 있어.','내 가방은 침대 위에 있어.'], a:'내 가방은 의자 아래에 있어.', hint:'under = ~아래에' },
  { id:'p_en416_304', unitId:'en4-1-6', type:'choice', cat:'listen', level:2, audio:'The ball is in the box.', q:'듣고 알맞은 뜻을 고르세요.', choices:['공은 상자 안에 있어.','공은 상자 위에 있어.','공은 침대 아래에 있어.','공은 가방 안에 있어.'], a:'공은 상자 안에 있어.', hint:'in = ~안에' },
  { id:'p_en416_305', unitId:'en4-1-6', type:'choice', cat:'listen', level:3, audio:'It\'s not on the bed.', q:'듣고 알맞은 뜻을 고르세요.', choices:['침대 위에는 없어.','침대 위에 있어.','침대 아래에 있어.','침대가 하나 있어.'], a:'침대 위에는 없어.', hint:'not이 들어 있는지 잘 들어 보세요' },
  { id:'p_en416_306', unitId:'en4-1-6', type:'choice', cat:'listen', level:3, audio:'Look under the table, please.', q:'듣고 알맞은 뜻을 고르세요.', choices:['탁자 아래를 봐 주세요.','탁자 위를 봐 주세요.','탁자를 옮겨 주세요.','탁자를 닦아 주세요.'], a:'탁자 아래를 봐 주세요.', hint:'under = ~아래에' },
  { id:'p_en416_307', unitId:'en4-1-6', type:'short', cat:'listen', level:1, audio:'cap', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'cap', alt:['Cap'], hint:'c로 시작하는 세 글자, 모자' },
  { id:'p_en416_308', unitId:'en4-1-6', type:'short', cat:'listen', level:1, audio:'bag', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'bag', alt:['Bag'], hint:'b로 시작하는 세 글자, 가방' },
  { id:'p_en416_309', unitId:'en4-1-6', type:'short', cat:'listen', level:1, audio:'desk', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'desk', alt:['Desk'], hint:'d로 시작해요, 책상' },
  { id:'p_en416_310', unitId:'en4-1-6', type:'short', cat:'listen', level:1, audio:'under', q:'듣고 알맞은 영어 단어를 쓰세요.', a:'under', alt:['Under'], hint:'u로 시작해요, ~아래에' },
  { id:'p_en416_311', unitId:'en4-1-6', type:'choice', cat:'listen', level:2, audio:'It\'s under the chair.', q:'듣고 알맞은 상황을 고르세요.', choices:['의자 아래를 들여다보며 물건을 찾는 모습','의자 위에 앉아 책을 읽는 모습','의자를 번쩍 드는 모습','의자를 깨끗이 닦는 모습'], a:'의자 아래를 들여다보며 물건을 찾는 모습', hint:'under = ~아래에' },
  { id:'p_en416_312', unitId:'en4-1-6', type:'choice', cat:'listen', level:2, audio:'The cat is in the box.', q:'듣고 알맞은 상황을 고르세요.', choices:['고양이가 상자 안에 들어가 있는 모습','고양이가 상자 위에 앉아 있는 모습','고양이가 나무 아래에 있는 모습','고양이가 밥을 먹고 있는 모습'], a:'고양이가 상자 안에 들어가 있는 모습', hint:'in과 on을 구별해 들어 보세요' },
  { id:'p_en416_313', unitId:'en4-1-6', type:'choice', cat:'listen', level:2, audio:'The books are on the table.', q:'듣고 알맞은 상황을 고르세요.', choices:['탁자 위에 책이 놓여 있는 모습','탁자 아래에 책이 쌓여 있는 모습','가방 안에 책이 들어 있는 모습','책장에 책을 꽂는 모습'], a:'탁자 위에 책이 놓여 있는 모습', hint:'on = ~위에' },
  { id:'p_en416_314', unitId:'en4-1-6', type:'choice', cat:'listen', level:1, audio:'Where\'s my bag?', q:'듣고 알맞은 대답을 고르세요.', choices:['It\'s under the desk.','I\'m fine, thank you.','My name is Amy.','Let\'s play basketball.'], a:'It\'s under the desk.', hint:'물건이 어디 있는지 묻고 있어요' },
  { id:'p_en416_315', unitId:'en4-1-6', type:'choice', cat:'listen', level:3, audio:'Is my cap on the bed?', q:'듣고 알맞은 대답을 고르세요.', choices:['No, it\'s under the bed.','Yes, I want a new cap.','It\'s a very nice bag.','I\'m happy today.'], a:'No, it\'s under the bed.', hint:'on과 under를 구별해 들어 보세요' },
];

// ── 4-2 이관 대기 문항 (2022 개정에서 4학년 2학기 범위로 이동) ──
//   중심지(구 4-1 1단원)·공공기관과 주민 참여(구 4-1 3단원)는 2022 개정에서
//   4-2(민주주의와 자치 / 지역문제 해결) 쪽 범위가 됐다. 4-2 단원을 추가할 때
//   아래 문항을 되살리되, unitId와 id는 그때 새로 부여할 것(현행 id와 충돌 방지).
// { q:'사람들이 많이 모여 물건을 사고팔거나 일을 보러 가는 곳을 무엇이라 할까요?', choices:['중심지','변두리','농촌','산지'], a:'중심지', hint:'시청·시장·터미널이 모인 곳' },
// { q:'다음 중 중심지에서 볼 수 있는 시설이 아닌 것은?', choices:['넓은 논과 밭','시청','버스 터미널','백화점'], a:'넓은 논과 밭', hint:'중심지에는 사람과 시설이 모여요' },
// { q:'주민 전체의 이익을 위해 나라나 지방자치단체가 세운 기관을 무엇이라 할까요?', choices:['공공기관','회사','시장','가게'], a:'공공기관', hint:'모두를 위해 일하는 곳' },
// { q:'다음 중 공공기관이 아닌 곳은?', choices:['백화점','도서관','소방서','경찰서'], a:'백화점', hint:'이익을 얻으려는 곳은 공공기관이 아니에요' },
// { q:'불을 끄고 위급한 사람을 구조하는 공공기관은?', choices:['소방서','우체국','도서관','보건소'], a:'소방서', hint:'119' },
// { q:'예방접종과 건강 상담을 도와주는 공공기관은?', choices:['보건소','경찰서','교육청','시청'], a:'보건소', hint:'건강을 돌봐요' },
// { q:'지역 문제를 해결하기 위한 주민 참여 방법으로 알맞지 않은 것은?', choices:['혼자 화를 내고 그만두기','주민 회의에 참여하기','서명 운동하기','공공기관에 건의하기'], a:'혼자 화를 내고 그만두기', hint:'함께 의견을 모아야 해결돼요' },
// { q:'지역의 여러 사람이 함께 겪는 어려움을 무엇이라 할까요?', choices:['지역 문제','개인 취미','학급 규칙','가족 행사'], a:'지역 문제', hint:'쓰레기·주차·소음 같은 것' },

// ── 영어 이관 대기 문항 (천재 함순애본 1학기 L1~6 범위 밖) ──
//   시각/하루 일과 → 함순애 L10 "What Time Is It?"(2학기, 4-2 추가 시 되살림).
//   숫자 → L8 "How Much Is It?"(가격, 2학기)에서 활용 가능.
//   나이·좋아하는 것·can·날씨 → 함순애 4학년 범위 밖(타 학년/타 출판사 주제).
//   되살릴 때 unitId와 id는 새로 부여할 것.
// { q:'숫자 7을 영어로 쓰세요.', a:'seven', alt:['Seven'], hint:'s로 시작해요' },
// { q:'숫자 10을 영어로 쓰세요.', a:'ten', alt:['Ten'], hint:'t로 시작해요' },
// { q:'"How old are you?" 는 무엇을 묻는 말일까요?', choices:['나이','이름','사는 곳','좋아하는 색'], a:'나이', hint:'old = 나이가 든' },
// { q:'"I am eleven years old." 는 몇 살이라는 뜻일까요?', choices:['11살','7살','12살','9살'], a:'11살', hint:'eleven = 11' },
// { q:'숫자 12를 영어로 쓰세요.', a:'twelve', alt:['Twelve'], hint:'tw로 시작해요' },
// { q:'"I like apples." 의 뜻으로 알맞은 것은?', choices:['나는 사과를 좋아해.','나는 사과가 있어.','나는 사과를 먹었어.','사과는 빨갛다.'], a:'나는 사과를 좋아해.', hint:'like = 좋아하다' },
// { q:'"Do you like pizza?" 에 대한 대답으로 알맞은 것은?', choices:['Yes, I do.','Yes, I am.','No, it is.','I am ten.'], a:'Yes, I do.', hint:'Do로 물으면 do로 답해요' },
// { q:'"파란색"을 영어로 쓰세요.', a:'blue', alt:['Blue'], hint:'b로 시작해요' },
// { q:'"빨간색"을 영어로 쓰세요.', a:'red', alt:['Red'], hint:'r로 시작해요' },
// { q:'"What color do you like?" 는 무엇을 묻는 말일까요?', choices:['좋아하는 색','좋아하는 음식','나이','이름'], a:'좋아하는 색', hint:'color = 색' },
// { q:'"I can swim." 의 뜻은?', choices:['나는 수영할 수 있어.','나는 수영을 좋아해.','나는 수영했어.','수영은 재미있어.'], a:'나는 수영할 수 있어.', hint:'can = ~할 수 있다' },
// { q:'"Can you skate?" 에 "아니오"로 답하려면?', choices:['No, I can\'t.','No, I am not.','Yes, I can.','No, I don\'t.'], a:'No, I can\'t.', hint:'can으로 물으면 can으로 답해요' },
// { q:'"달리다"를 영어로 쓰세요.', a:'run', alt:['Run'], hint:'r로 시작하는 세 글자' },
// { q:'"노래하다"를 영어로 쓰세요.', a:'sing', alt:['Sing'], hint:'s로 시작해요' },
// { q:'"How is the weather?" 는 무엇을 묻는 말일까요?', choices:['날씨','요일','시간','나이'], a:'날씨', hint:'weather = 날씨' },
// { q:'"비가 오는"을 뜻하는 영어 단어를 쓰세요.', a:'rainy', alt:['Rainy'], hint:'rain + y' },
// { q:'"맑은, 화창한"을 뜻하는 영어 단어를 쓰세요.', a:'sunny', alt:['Sunny'], hint:'sun + ny' },
// { q:'"It is snowy." 는 어떤 날씨일까요?', choices:['눈이 온다','바람이 분다','덥다','흐리다'], a:'눈이 온다', hint:'snow = 눈' },
// { q:'"겨울"을 영어로 쓰세요.', a:'winter', alt:['Winter'], hint:'w로 시작해요' },
// { q:'"What time is it?" 는 무엇을 묻는 말일까요?', choices:['시간','날씨','이름','나이'], a:'시간', hint:'time = 시간' },
// { q:'"It is seven o\'clock." 는 몇 시일까요?', choices:['7시','9시','11시','6시'], a:'7시', hint:'seven = 7' },
// { q:'"아침"을 뜻하는 영어 단어를 쓰세요.', a:'morning', alt:['Morning'], hint:'m로 시작해요' },
// { q:'"I get up at seven." 의 뜻은?', choices:['나는 7시에 일어난다.','나는 7시에 잔다.','나는 7살이다.','나는 7시에 먹는다.'], a:'나는 7시에 일어난다.', hint:'get up = 일어나다' },

// ── 조회 헬퍼 (영어 단어장 패턴과 동일하게 기본 + 교사 추가를 합쳐서 제공) ──
const CurriculumUtils = {
  // 현재 학기(설정에서 지정, 없으면 4-1)
  termKey() {
    const s = (typeof DB !== 'undefined') ? (DB.getSettings() || {}) : {};
    return s.curriculumTerm || '4-1';
  },
  term() { return CURRICULUM[this.termKey()] || CURRICULUM['4-1']; },

  // 과목 목록 [{key, label, icon, units[]}]
  subjects() {
    const t = this.term();
    return Object.entries(t.subjects).map(([key, v]) => ({ key, ...v, units: this.units(key) }));
  },

  // 단원 목록 — 교사가 이름을 바꿨으면(customUnitNames) 그 이름을 쓴다
  units(subjectKey) {
    const t = this.term();
    const base = (t.subjects[subjectKey] || {}).units || [];
    const s = (typeof DB !== 'undefined') ? (DB.getSettings() || {}) : {};
    const overrides = s.customUnitNames || {};
    return base.map(u => ({ ...u, name: overrides[u.id] || u.name }));
  },

  unitById(unitId) {
    for (const s of this.subjects()) {
      const u = s.units.find(x => x.id === unitId);
      if (u) return { ...u, subjectKey: s.key, subjectLabel: s.label, icon: s.icon };
    }
    return null;
  },

  // 기본 문제 + 교사가 추가한 문제
  allProblems() {
    const custom = (typeof DB !== 'undefined') ? (DB.getCustomProblems ? DB.getCustomProblems() : []) : [];
    return [...BASE_PROBLEMS, ...custom];
  },
  problemsByUnit(unitId) { return this.allProblems().filter(p => p.unitId === unitId); },
  problemsBySubject(subjectKey) {
    const ids = new Set(this.units(subjectKey).map(u => u.id));
    return this.allProblems().filter(p => ids.has(p.unitId));
  },

  // 교사가 켜 둔 단원(없으면 전체 허용)
  activeUnitIds() {
    const s = (typeof DB !== 'undefined') ? (DB.getSettings() || {}) : {};
    const list = s.activeProblemUnits;
    return Array.isArray(list) && list.length ? list : null;
  },

  // 정답 판정 — 초등 대상이라 관대하게(공백/대소문자 무시, 별칭 허용)
  isCorrect(problem, userAnswer) {
    if (!problem) return false;
    const norm = v => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, '');
    const ua = norm(userAnswer);
    if (!ua) return false;
    if (ua === norm(problem.a)) return true;
    return (problem.alt || []).some(x => norm(x) === ua);
  },
};
