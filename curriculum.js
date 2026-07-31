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
// { id, unitId, type, q, a, choices?, hint?, level }
//   type  : 'choice'(객관식) | 'short'(단답) | 'number'(수 입력)
//   a     : 정답. number형은 숫자 문자열, short는 대표 정답(별칭은 alt에)
//   alt   : 정답으로 인정할 다른 표기(배열, 선택)
//   level : 1(기본) 2(보통) 3(도전)
const BASE_PROBLEMS = [
  // ── 수학 1. 큰 수 ─────────────────────────────
  { id:'p_ma411_01', unitId:'ma4-1-1', type:'number', level:1, q:'10000이 3개, 1000이 5개인 수는 얼마일까요?', a:'35000', hint:'10000이 3개 → 30000, 1000이 5개 → 5000' },
  { id:'p_ma411_02', unitId:'ma4-1-1', type:'number', level:1, q:'숫자 46208에서 백의 자리 숫자는 무엇일까요?', a:'2', hint:'오른쪽부터 일·십·백 순서로 세어 보세요' },
  { id:'p_ma411_03', unitId:'ma4-1-1', type:'choice', level:1, q:'다음 중 가장 큰 수는?', choices:['58900','59000','58990','58099'], a:'59000', hint:'만의 자리부터 차례로 비교해요' },
  { id:'p_ma411_04', unitId:'ma4-1-1', type:'number', level:2, q:'27000에서 1000씩 3번 뛰어 센 수는?', a:'30000', hint:'1000씩 커지면 천의 자리가 1씩 늘어요' },
  { id:'p_ma411_05', unitId:'ma4-1-1', type:'number', level:2, q:'1억은 1000만이 몇 개 모인 수일까요?', a:'10', hint:'1000만 × □ = 1억' },
  { id:'p_ma411_06', unitId:'ma4-1-1', type:'choice', level:2, q:'"삼천이백사십오만"을 숫자로 바르게 쓴 것은?', choices:['32450000','3245000','32045000','324500000'], a:'32450000', hint:'만 단위로 끊어서 3245|0000' },
  { id:'p_ma411_07', unitId:'ma4-1-1', type:'number', level:2, q:'숫자 70650000에서 숫자 7이 나타내는 값은 몇만일까요? (숫자만)', a:'7000', hint:'7은 천만의 자리 → 7000만' },
  { id:'p_ma411_08', unitId:'ma4-1-1', type:'number', level:3, q:'0, 2, 5, 8을 한 번씩 써서 만들 수 있는 가장 큰 네 자리 수는?', a:'8520', hint:'큰 숫자를 앞자리부터 놓아요' },

  // ── 수학 2. 각도 ──────────────────────────────
  { id:'p_ma412_01', unitId:'ma4-1-2', type:'choice', level:1, q:'직각은 몇 도일까요?', choices:['45도','90도','180도','360도'], a:'90도', hint:'ㄱ자 모양의 각이에요' },
  { id:'p_ma412_02', unitId:'ma4-1-2', type:'choice', level:1, q:'크기가 60도인 각은 어떤 각일까요?', choices:['예각','직각','둔각','평각'], a:'예각', hint:'0도보다 크고 90도보다 작으면 예각' },
  { id:'p_ma412_03', unitId:'ma4-1-2', type:'choice', level:1, q:'크기가 120도인 각은 어떤 각일까요?', choices:['예각','직각','둔각','평각'], a:'둔각', hint:'90도보다 크고 180도보다 작으면 둔각' },
  { id:'p_ma412_04', unitId:'ma4-1-2', type:'number', level:2, q:'삼각형 세 각의 크기의 합은 몇 도일까요? (숫자만)', a:'180', hint:'세 각을 모으면 일직선이 돼요' },
  { id:'p_ma412_05', unitId:'ma4-1-2', type:'number', level:2, q:'사각형 네 각의 크기의 합은 몇 도일까요? (숫자만)', a:'360', hint:'삼각형 두 개로 나눌 수 있어요' },
  { id:'p_ma412_06', unitId:'ma4-1-2', type:'number', level:2, q:'삼각형에서 두 각이 50도, 70도일 때 나머지 한 각은 몇 도일까요?', a:'60', hint:'180 − (50 + 70)' },
  { id:'p_ma412_07', unitId:'ma4-1-2', type:'number', level:3, q:'사각형에서 세 각이 90도, 80도, 100도일 때 나머지 한 각은 몇 도일까요?', a:'90', hint:'360 − (90 + 80 + 100)' },

  // ── 수학 3. 곱셈과 나눗셈 ─────────────────────
  { id:'p_ma413_01', unitId:'ma4-1-3', type:'number', level:1, q:'213 × 30 = ?', a:'6390', hint:'213 × 3 = 639, 뒤에 0을 붙여요' },
  { id:'p_ma413_02', unitId:'ma4-1-3', type:'number', level:1, q:'150 × 40 = ?', a:'6000', hint:'15 × 4 = 60, 0을 두 개 붙여요' },
  { id:'p_ma413_03', unitId:'ma4-1-3', type:'number', level:2, q:'324 × 21 = ?', a:'6804', hint:'324×20 = 6480, 324×1 = 324' },
  { id:'p_ma413_04', unitId:'ma4-1-3', type:'number', level:2, q:'420 ÷ 20 = ?', a:'21', hint:'42 ÷ 2 로 생각해 보세요' },
  { id:'p_ma413_05', unitId:'ma4-1-3', type:'number', level:2, q:'270 ÷ 30 = ?', a:'9', hint:'27 ÷ 3' },
  { id:'p_ma413_06', unitId:'ma4-1-3', type:'number', level:2, q:'156 ÷ 12 = ?', a:'13', hint:'12 × 13 = 156' },
  { id:'p_ma413_07', unitId:'ma4-1-3', type:'number', level:3, q:'145 ÷ 12 의 나머지는 얼마일까요?', a:'1', hint:'12 × 12 = 144' },
  { id:'p_ma413_08', unitId:'ma4-1-3', type:'number', level:3, q:'사탕 250개를 한 봉지에 16개씩 담으면 몇 봉지가 되고 몇 개가 남을까요? 남는 개수만 쓰세요.', a:'10', hint:'16 × 15 = 240' },

  // ── 수학 4. 평면도형의 이동 ───────────────────
  { id:'p_ma414_01', unitId:'ma4-1-4', type:'choice', level:1, q:'도형을 밀면 무엇이 변할까요?', choices:['모양','크기','위치','방향'], a:'위치', hint:'밀기는 자리만 옮기는 이동이에요' },
  { id:'p_ma414_02', unitId:'ma4-1-4', type:'choice', level:1, q:'도형을 뒤집거나 돌려도 변하지 않는 것은?', choices:['모양과 크기','위치','방향','색깔'], a:'모양과 크기', hint:'이동해도 도형 자체는 그대로예요' },
  { id:'p_ma414_03', unitId:'ma4-1-4', type:'choice', level:2, q:'도형을 오른쪽으로 뒤집으면 어떻게 될까요?', choices:['좌우가 바뀐다','위아래가 바뀐다','아무 변화 없다','크기가 커진다'], a:'좌우가 바뀐다', hint:'거울에 비친 모습을 떠올려요' },
  { id:'p_ma414_04', unitId:'ma4-1-4', type:'choice', level:2, q:'도형을 아래쪽으로 뒤집으면 어떻게 될까요?', choices:['위아래가 바뀐다','좌우가 바뀐다','변화 없다','작아진다'], a:'위아래가 바뀐다', hint:'물에 비친 모습처럼요' },
  { id:'p_ma414_05', unitId:'ma4-1-4', type:'number', level:2, q:'도형을 시계 방향으로 90도씩 4번 돌리면 처음과 같아집니다. 모두 몇 도를 돌린 걸까요? (숫자만)', a:'360', hint:'90 × 4' },
  { id:'p_ma414_06', unitId:'ma4-1-4', type:'choice', level:3, q:'도형을 시계 방향으로 180도 돌린 것과 같은 결과가 되는 것은?', choices:['시계 반대 방향으로 180도 돌리기','오른쪽으로 밀기','90도 돌리기','뒤집지 않기'], a:'시계 반대 방향으로 180도 돌리기', hint:'반 바퀴는 어느 쪽으로 돌려도 같아요' },

  // ── 수학 5. 막대그래프 ───────────────────────
  { id:'p_ma415_01', unitId:'ma4-1-5', type:'choice', level:1, q:'막대그래프에서 막대의 길이는 무엇을 나타낼까요?', choices:['자료의 수량','자료의 이름','조사한 날짜','조사한 사람'], a:'자료의 수량', hint:'길수록 많다는 뜻이에요' },
  { id:'p_ma415_02', unitId:'ma4-1-5', type:'choice', level:1, q:'막대그래프를 그릴 때 가장 먼저 정해야 할 것은?', choices:['가로와 세로에 무엇을 나타낼지','막대 색깔','제목 글씨체','종이 크기'], a:'가로와 세로에 무엇을 나타낼지', hint:'무엇을 어디에 나타낼지부터 정해요' },
  { id:'p_ma415_03', unitId:'ma4-1-5', type:'number', level:2, q:'막대그래프에서 눈금 한 칸이 5명을 나타냅니다. 막대가 7칸이면 몇 명일까요?', a:'35', hint:'5 × 7' },
  { id:'p_ma415_04', unitId:'ma4-1-5', type:'number', level:2, q:'눈금 한 칸이 2권인 막대그래프에서 12권을 나타내려면 몇 칸을 그려야 할까요?', a:'6', hint:'12 ÷ 2' },
  { id:'p_ma415_05', unitId:'ma4-1-5', type:'choice', level:2, q:'막대그래프의 좋은 점은 무엇일까요?', choices:['많고 적음을 한눈에 비교할 수 있다','자료를 모을 수 있다','계산이 빨라진다','그림을 예쁘게 그릴 수 있다'], a:'많고 적음을 한눈에 비교할 수 있다', hint:'표보다 비교가 쉬워요' },
  { id:'p_ma415_06', unitId:'ma4-1-5', type:'number', level:3, q:'좋아하는 과일을 조사했더니 사과 12명, 배 8명, 귤 15명이었습니다. 조사한 학생은 모두 몇 명일까요?', a:'35', hint:'12 + 8 + 15' },

  // ── 수학 6. 규칙 찾기 ────────────────────────
  { id:'p_ma416_01', unitId:'ma4-1-6', type:'number', level:1, q:'2, 5, 8, 11, □ … 빈칸에 알맞은 수는?', a:'14', hint:'3씩 커지고 있어요' },
  { id:'p_ma416_02', unitId:'ma4-1-6', type:'number', level:1, q:'100, 90, 80, 70, □ … 빈칸에 알맞은 수는?', a:'60', hint:'10씩 작아져요' },
  { id:'p_ma416_03', unitId:'ma4-1-6', type:'number', level:2, q:'1, 2, 4, 8, 16, □ … 빈칸에 알맞은 수는?', a:'32', hint:'2배씩 커져요' },
  { id:'p_ma416_04', unitId:'ma4-1-6', type:'number', level:2, q:'110 + 20 = 130, 120 + 20 = 140, 130 + 20 = □ 규칙에 맞는 값은?', a:'150', hint:'더해지는 수가 10씩 커져요' },
  { id:'p_ma416_05', unitId:'ma4-1-6', type:'number', level:2, q:'도형이 1개, 3개, 5개, 7개 순으로 늘어납니다. 다섯 번째에는 몇 개일까요?', a:'9', hint:'2개씩 늘어나요' },
  { id:'p_ma416_06', unitId:'ma4-1-6', type:'number', level:3, q:'첫째 줄 1개, 둘째 줄 4개, 셋째 줄 9개… 넷째 줄에는 몇 개일까요?', a:'16', hint:'1×1, 2×2, 3×3 …' },
  // 2022 개정 신설: 등호를 사용한 식(양쪽이 같음)
  { id:'p_ma416_07', unitId:'ma4-1-6', type:'number', level:2, q:'5 + 7 = □ + 4 에서 □에 알맞은 수는?', a:'8', hint:'등호(=)는 양쪽이 같다는 뜻이에요. 5+7을 먼저 계산해요' },
  { id:'p_ma416_08', unitId:'ma4-1-6', type:'choice', level:2, q:'다음 중 옳은 식은 어느 것일까요?', choices:['20 + 5 = 15 + 10','20 + 5 = 30 − 10','20 + 5 = 5 + 30','20 + 5 = 10 + 10'], a:'20 + 5 = 15 + 10', hint:'양쪽을 각각 계산해서 같은 것을 찾아요' },

  // ── 영어 L1. My Name Is Amy (이름·인사) ──────
  { id:'p_en411_01', unitId:'en4-1-1', type:'choice', level:1, q:'"Hello, my name is Jimin." 에서 이름을 말하는 표현은?', choices:['my name is','how are you','thank you','good bye'], a:'my name is', hint:'name = 이름' },
  { id:'p_en411_02', unitId:'en4-1-1', type:'short', level:1, q:'"안녕하세요"에 해당하는 영어 인사말을 쓰세요.', a:'hello', alt:['hi','Hello','Hi'], hint:'h로 시작해요' },
  { id:'p_en411_03', unitId:'en4-1-1', type:'choice', level:1, q:'처음 만난 친구에게 하는 인사로 알맞은 것은?', choices:['Nice to meet you.','Good night.','See you.','I am sorry.'], a:'Nice to meet you.', hint:'만나서 반가워' },
  { id:'p_en411_05', unitId:'en4-1-1', type:'short', level:2, q:'"고맙습니다"를 영어로 두 단어로 쓰세요.', a:'thank you', alt:['Thank you','thankyou'], hint:'Thank …' },
  { id:'p_en411_06', unitId:'en4-1-1', type:'choice', level:2, q:'"What\'s your name?" 에 대한 알맞은 대답은?', choices:['My name is Mina.','I am ten years old.','It is a cat.','Yes, I do.'], a:'My name is Mina.', hint:'이름을 묻는 말이에요' },

  // ── 영어 L2. I'm Happy (감정·안부) ───────────
  { id:'p_en412_11', unitId:'en4-1-2', type:'choice', level:1, q:'"I\'m happy." 의 뜻은?', choices:['나는 행복해.','나는 슬퍼.','나는 배고파.','나는 졸려.'], a:'나는 행복해.', hint:'happy = 행복한' },
  { id:'p_en412_12', unitId:'en4-1-2', type:'short', level:1, q:'"슬픈"을 뜻하는 영어 단어를 쓰세요.', a:'sad', alt:['Sad'], hint:'s로 시작하는 세 글자' },
  { id:'p_en412_13', unitId:'en4-1-2', type:'choice', level:2, q:'"How are you?" 에 대한 알맞은 대답은?', choices:['I am fine, thank you.','My name is Tom.','It is a book.','Yes, I can.'], a:'I am fine, thank you.', hint:'기분·안부를 묻는 말이에요' },
  { id:'p_en412_14', unitId:'en4-1-2', type:'choice', level:2, q:'"I\'m angry." 는 어떤 기분일까요?', choices:['화가 난다','기쁘다','무섭다','심심하다'], a:'화가 난다', hint:'angry = 화난' },
  { id:'p_en412_15', unitId:'en4-1-2', type:'short', level:2, q:'"배고픈"을 뜻하는 영어 단어를 쓰세요.', a:'hungry', alt:['Hungry'], hint:'h로 시작해요' },

  // ── 영어 L3. Don't Sit Here (금지) ───────────
  { id:'p_en413_11', unitId:'en4-1-3', type:'choice', level:1, q:'"Don\'t run!" 의 뜻은?', choices:['뛰지 마!','뛰어!','달려 봐!','걷지 마!'], a:'뛰지 마!', hint:'Don\'t = ~하지 마' },
  { id:'p_en413_12', unitId:'en4-1-3', type:'choice', level:1, q:'"Don\'t sit here." 의 뜻은?', choices:['여기 앉지 마세요.','여기 앉으세요.','여기서 주무세요.','여기로 오세요.'], a:'여기 앉지 마세요.', hint:'sit = 앉다' },
  { id:'p_en413_13', unitId:'en4-1-3', type:'choice', level:2, q:'도서관에서 "조용히 해 주세요"라고 말하려면?', choices:['Please be quiet.','Let\'s run.','I want pizza.','How are you?'], a:'Please be quiet.', hint:'quiet = 조용한' },
  { id:'p_en413_14', unitId:'en4-1-3', type:'choice', level:2, q:'"~하지 마"라고 금지할 때 문장 맨 앞에 쓰는 말은?', choices:['Don\'t','Let\'s','Please','Can'], a:'Don\'t', hint:'do not을 줄인 말이에요' },

  // ── 영어 L4. Let's Play Basketball (제안) ────
  { id:'p_en414_11', unitId:'en4-1-4', type:'choice', level:1, q:'"Let\'s play soccer." 의 뜻은?', choices:['우리 축구하자.','나는 축구를 잘해.','축구는 재미있다.','축구하지 마.'], a:'우리 축구하자.', hint:'Let\'s = 우리 ~하자' },
  { id:'p_en414_12', unitId:'en4-1-4', type:'choice', level:2, q:'친구에게 "우리 배드민턴 치자"라고 제안하려면?', choices:['Let\'s play badminton.','Don\'t play badminton.','I can play badminton.','It is badminton.'], a:'Let\'s play badminton.', hint:'제안은 Let\'s로 시작해요' },
  { id:'p_en414_13', unitId:'en4-1-4', type:'choice', level:2, q:'"Let\'s ~" 제안에 좋다고 대답하는 말은?', choices:['Good idea!','I am sorry to hear that.','It is Monday.','He is my dad.'], a:'Good idea!', hint:'좋은 생각이야!' },
  { id:'p_en414_14', unitId:'en4-1-4', type:'short', level:1, q:'"놀다, (운동 경기를) 하다"를 뜻하는 영어 단어를 쓰세요.', a:'play', alt:['Play'], hint:'p로 시작해요' },

  // ── 영어 L5. I Want Chicken (음식·원하는 것) ─
  { id:'p_en415_11', unitId:'en4-1-5', type:'choice', level:1, q:'"I want chicken." 의 뜻은?', choices:['나는 치킨을 원해.','나는 치킨을 좋아해.','치킨은 맛있다.','나는 치킨이 있어.'], a:'나는 치킨을 원해.', hint:'want = 원하다' },
  { id:'p_en415_12', unitId:'en4-1-5', type:'choice', level:2, q:'"Do you want some pizza?" 에 "응, 부탁해"로 답하려면?', choices:['Yes, please.','No, I am not.','It is a pizza.','I am ten.'], a:'Yes, please.', hint:'공손하게 받을 때는 please' },
  { id:'p_en415_13', unitId:'en4-1-5', type:'choice', level:2, q:'"What do you want?" 는 무엇을 묻는 말일까요?', choices:['원하는 것','사는 곳','요일','날씨'], a:'원하는 것', hint:'want = 원하다' },
  { id:'p_en415_14', unitId:'en4-1-5', type:'short', level:1, q:'"물"을 뜻하는 영어 단어를 쓰세요.', a:'water', alt:['Water'], hint:'w로 시작해요' },
  { id:'p_en415_15', unitId:'en4-1-5', type:'short', level:1, q:'"우유"를 뜻하는 영어 단어를 쓰세요.', a:'milk', alt:['Milk'], hint:'m으로 시작해요' },

  // ── 영어 L6. Where's My Cap? (위치) ──────────
  { id:'p_en416_11', unitId:'en4-1-6', type:'choice', level:1, q:'"Where is my cap?" 는 무엇을 묻는 말일까요?', choices:['모자가 어디 있는지','모자가 얼마인지','모자가 누구 것인지','모자가 무슨 색인지'], a:'모자가 어디 있는지', hint:'where = 어디' },
  { id:'p_en416_12', unitId:'en4-1-6', type:'choice', level:1, q:'"It\'s on the desk." 의 뜻은?', choices:['책상 위에 있어.','책상 아래에 있어.','책상 안에 있어.','책상 옆에 있어.'], a:'책상 위에 있어.', hint:'on = ~위에' },
  { id:'p_en416_13', unitId:'en4-1-6', type:'choice', level:2, q:'"상자 안에"를 뜻하는 말은?', choices:['in the box','on the box','under the box','by the box'], a:'in the box', hint:'in = ~안에' },
  { id:'p_en416_14', unitId:'en4-1-6', type:'choice', level:2, q:'"It\'s under the chair." 에서 물건은 어디에 있을까요?', choices:['의자 아래','의자 위','의자 안','의자 뒤'], a:'의자 아래', hint:'under = ~아래에' },
  { id:'p_en416_15', unitId:'en4-1-6', type:'short', level:2, q:'"어디"를 뜻하는 영어 단어를 쓰세요.', a:'where', alt:['Where'], hint:'wh로 시작해요' },

  // ── 사회 1. 지도로 만나는 우리 지역 ──────────
  { id:'p_so411_01', unitId:'so4-1-1', type:'choice', level:1, q:'지도에서 방위표가 없을 때 위쪽은 어느 방향일까요?', choices:['북쪽','남쪽','동쪽','서쪽'], a:'북쪽', hint:'지도의 기본 약속이에요' },
  { id:'p_so411_02', unitId:'so4-1-1', type:'choice', level:1, q:'지도에서 실제 거리를 줄인 정도를 나타내는 것은?', choices:['축척','범례','방위표','등고선'], a:'축척', hint:'얼마나 줄였는지 알려줘요' },
  { id:'p_so411_03', unitId:'so4-1-1', type:'choice', level:1, q:'지도에서 기호가 무엇을 뜻하는지 알려 주는 것은?', choices:['범례','축척','방위표','좌표'], a:'범례', hint:'기호 설명표예요' },
  { id:'p_so411_04', unitId:'so4-1-1', type:'choice', level:2, q:'땅의 높낮이를 나타내기 위해 같은 높이를 이은 선은?', choices:['등고선','축척','범례','경계선'], a:'등고선', hint:'높을수록 안쪽에 그려요' },
  { id:'p_so411_07', unitId:'so4-1-1', type:'choice', level:1, q:'컴퓨터나 스마트폰에서 위성 사진처럼 지역의 모습을 살펴볼 수 있는 지도는?', choices:['디지털 영상 지도','등고선','범례','축척'], a:'디지털 영상 지도', hint:'확대·축소도 마음대로 할 수 있어요' },
  { id:'p_so411_08', unitId:'so4-1-1', type:'choice', level:2, q:'다음 중 자연환경이 아닌 것은?', choices:['학교','산','강','바다'], a:'학교', hint:'사람이 만든 것은 인문환경이에요' },

  // ── 사회 2. 우리 지역의 국가유산 ─────────────
  //   (2024년부터 '문화재' 대신 '국가유산' 체제: 문화유산·자연유산·무형유산)
  { id:'p_so412_01', unitId:'so4-1-2', type:'choice', level:1, q:'조상들이 남긴 것 중 보호할 가치가 있어 오늘날까지 전해지는 것을 무엇이라 할까요?', choices:['국가유산','자연환경','공공기관','중심지'], a:'국가유산', hint:'조상들이 물려준 소중한 것' },
  { id:'p_so412_02', unitId:'so4-1-2', type:'choice', level:1, q:'건축물이나 유물처럼 형태가 있는 국가유산을 무엇이라 할까요?', choices:['문화유산','무형유산','자연유산','기록유산'], a:'문화유산', hint:'눈에 보이고 만질 수 있어요' },
  { id:'p_so412_03', unitId:'so4-1-2', type:'choice', level:2, q:'판소리나 탈춤처럼 형태가 없이 사람에게서 사람으로 전해지는 국가유산은?', choices:['무형유산','문화유산','자연유산','천연기념물'], a:'무형유산', hint:'사람의 기술·솜씨로 이어져요' },
  { id:'p_so412_06', unitId:'so4-1-2', type:'choice', level:2, q:'명승이나 천연기념물처럼 자연물 가운데 보호하는 국가유산을 무엇이라 할까요?', choices:['자연유산','문화유산','무형유산','기록유산'], a:'자연유산', hint:'자연이 만든 소중한 것' },
  { id:'p_so412_04', unitId:'so4-1-2', type:'choice', level:2, q:'지역의 국가유산을 조사하는 방법으로 알맞지 않은 것은?', choices:['마음대로 상상해서 적기','직접 답사하기','누리집에서 찾아보기','해설사께 여쭤보기'], a:'마음대로 상상해서 적기', hint:'조사는 사실을 확인하는 일이에요' },
  { id:'p_so412_05', unitId:'so4-1-2', type:'choice', level:2, q:'국가유산을 답사할 때 지켜야 할 태도로 알맞은 것은?', choices:['함부로 만지지 않는다','기념으로 조금 떼어 온다','큰 소리로 뛰어다닌다','낙서를 남긴다'], a:'함부로 만지지 않는다', hint:'모두의 소중한 유산이에요' },

  // ── 사회 3. 경제활동과 지역 간 교류 ──────────
  { id:'p_so413_01', unitId:'so4-1-3', type:'choice', level:1, q:'사람들이 생활에 필요한 것을 만들고, 사고파는 것과 관련된 모든 활동을 무엇이라 할까요?', choices:['경제활동','문화 활동','봉사 활동','체육 활동'], a:'경제활동', hint:'만들고, 팔고, 사는 일 모두요' },
  { id:'p_so413_02', unitId:'so4-1-3', type:'choice', level:2, q:'사람들이 원하는 것은 많은데 그것을 모두 가질 수 없는 상태를 무엇이라 할까요?', choices:['희소성','다양성','편리성','안전성'], a:'희소성', hint:'돈과 자원은 한정되어 있어요' },
  { id:'p_so413_03', unitId:'so4-1-3', type:'choice', level:2, q:'합리적 선택이란 무엇일까요?', choices:['가격과 품질을 따져 가장 큰 만족을 얻도록 고르는 것','무조건 비싼 것을 사는 것','친구가 사는 것을 그대로 따라 사는 것','광고에 나오면 바로 사는 것'], a:'가격과 품질을 따져 가장 큰 만족을 얻도록 고르는 것', hint:'여러 가지를 비교해 봐요' },
  { id:'p_so413_04', unitId:'so4-1-3', type:'choice', level:1, q:'상품이 어디에서 왔는지 알아보는 방법으로 알맞지 않은 것은?', choices:['눈을 감고 상상하기','포장지의 표시 살펴보기','큐아르(QR) 코드 찍어 보기','누리집에서 찾아보기'], a:'눈을 감고 상상하기', hint:'포장지에 생산지가 적혀 있어요' },
  { id:'p_so413_05', unitId:'so4-1-3', type:'choice', level:2, q:'지역과 지역이 물건·기술·문화 등을 서로 주고받는 것을 무엇이라 할까요?', choices:['교류','경쟁','저축','독점'], a:'교류', hint:'서로 오가며 주고받아요' },
  { id:'p_so413_06', unitId:'so4-1-3', type:'choice', level:2, q:'지역 간에 교류가 이루어지는 까닭으로 알맞은 것은?', choices:['지역마다 자연환경과 생산물이 다르기 때문','모든 지역이 똑같은 물건을 만들기 때문','교류를 하면 물건이 사라지기 때문','다른 지역과 만나면 안 되기 때문'], a:'지역마다 자연환경과 생산물이 다르기 때문', hint:'서로 다르니까 주고받을 것이 생겨요' },
  // ── 수학 1. 큰 수 (추가) ──────────────────────
  { id:'p_ma411_09', unitId:'ma4-1-1', type:'number', level:1, q:'10000이 7개인 수는 얼마일까요?', a:'70000', hint:'10000 × 7' },
  { id:'p_ma411_10', unitId:'ma4-1-1', type:'number', level:1, q:'숫자 85310에서 만의 자리 숫자는 무엇일까요?', a:'8', hint:'왼쪽 첫 자리가 만의 자리예요' },
  { id:'p_ma411_11', unitId:'ma4-1-1', type:'choice', level:2, q:'다음 중 가장 작은 수는?', choices:['40200','40020','42000','40002'], a:'40002', hint:'앞자리부터 차례로 비교해요' },
  { id:'p_ma411_12', unitId:'ma4-1-1', type:'number', level:2, q:'1000만이 10개 모이면 얼마일까요? (억 단위로, 숫자만 — 1억이면 1)', a:'1', hint:'1000만 × 10 = 1억' },
  { id:'p_ma411_13', unitId:'ma4-1-1', type:'number', level:2, q:'52000에서 10000씩 3번 뛰어 센 수는?', a:'82000', hint:'10000씩 커지면 만의 자리가 1씩 늘어요' },
  { id:'p_ma411_14', unitId:'ma4-1-1', type:'choice', level:2, q:'"이천삼백사십오"를 숫자로 바르게 쓴 것은?', choices:['2345','23450','20345','2045'], a:'2345', hint:'천·백·십·일 자리를 차례로 놓아요' },
  { id:'p_ma411_15', unitId:'ma4-1-1', type:'number', level:3, q:'3, 1, 9, 4를 한 번씩 써서 만들 수 있는 가장 작은 네 자리 수는?', a:'1349', hint:'작은 숫자를 앞자리부터 놓아요' },

  // ── 수학 2. 각도 (추가) ──────────────────────
  { id:'p_ma412_08', unitId:'ma4-1-2', type:'choice', level:1, q:'평각은 몇 도일까요?', choices:['90도','180도','270도','360도'], a:'180도', hint:'일직선으로 펴진 각이에요' },
  { id:'p_ma412_09', unitId:'ma4-1-2', type:'choice', level:1, q:'크기가 89도인 각은 어떤 각일까요?', choices:['예각','직각','둔각','평각'], a:'예각', hint:'90도보다 작으면 예각' },
  { id:'p_ma412_10', unitId:'ma4-1-2', type:'number', level:2, q:'45도 + 30도 = 몇 도일까요? (숫자만)', a:'75', hint:'각도끼리 더해요' },
  { id:'p_ma412_11', unitId:'ma4-1-2', type:'number', level:2, q:'120도 − 45도 = 몇 도일까요? (숫자만)', a:'75', hint:'각도끼리 빼요' },
  { id:'p_ma412_12', unitId:'ma4-1-2', type:'number', level:2, q:'삼각형에서 두 각이 30도, 60도일 때 나머지 한 각은 몇 도일까요?', a:'90', hint:'180 − (30 + 60)' },
  { id:'p_ma412_13', unitId:'ma4-1-2', type:'number', level:2, q:'직각을 반으로 나눈 각은 몇 도일까요? (숫자만)', a:'45', hint:'90 ÷ 2' },
  { id:'p_ma412_14', unitId:'ma4-1-2', type:'number', level:3, q:'사각형에서 세 각이 70도, 110도, 85도일 때 나머지 한 각은 몇 도일까요?', a:'95', hint:'360 − (70 + 110 + 85)' },
  { id:'p_ma412_15', unitId:'ma4-1-2', type:'choice', level:3, q:'세 각이 모두 60도인 삼각형에서 세 각의 합은?', choices:['180도','150도','200도','120도'], a:'180도', hint:'60 × 3' },

  // ── 수학 3. 곱셈과 나눗셈 (추가) ──────────────
  { id:'p_ma413_09', unitId:'ma4-1-3', type:'number', level:1, q:'302 × 30 = ?', a:'9060', hint:'302 × 3 = 906, 뒤에 0을 붙여요' },
  { id:'p_ma413_10', unitId:'ma4-1-3', type:'number', level:1, q:'240 × 20 = ?', a:'4800', hint:'24 × 2 = 48, 0을 두 개 붙여요' },
  { id:'p_ma413_11', unitId:'ma4-1-3', type:'number', level:2, q:'216 × 34 = ?', a:'7344', hint:'216×30 = 6480, 216×4 = 864' },
  { id:'p_ma413_12', unitId:'ma4-1-3', type:'number', level:2, q:'560 ÷ 40 = ?', a:'14', hint:'56 ÷ 4 로 생각해 보세요' },
  { id:'p_ma413_13', unitId:'ma4-1-3', type:'number', level:2, q:'391 ÷ 17 = ?', a:'23', hint:'17 × 23 = 391' },
  { id:'p_ma413_14', unitId:'ma4-1-3', type:'number', level:3, q:'275 ÷ 18 의 나머지는 얼마일까요?', a:'5', hint:'18 × 15 = 270' },
  { id:'p_ma413_15', unitId:'ma4-1-3', type:'number', level:3, q:'색종이 432장을 24명에게 똑같이 나누어 주면 한 사람이 몇 장씩 받을까요?', a:'18', hint:'432 ÷ 24' },

  // ── 수학 4. 평면도형의 이동 (추가) ────────────
  { id:'p_ma414_07', unitId:'ma4-1-4', type:'choice', level:1, q:'도형을 왼쪽으로 밀면 무엇이 달라질까요?', choices:['위치','모양','크기','아무것도 안 달라짐'], a:'위치', hint:'밀기는 자리만 옮겨요' },
  { id:'p_ma414_08', unitId:'ma4-1-4', type:'choice', level:1, q:'도형을 위쪽으로 뒤집으면 어떻게 될까요?', choices:['위아래가 바뀐다','좌우가 바뀐다','크기가 커진다','변화 없다'], a:'위아래가 바뀐다', hint:'뒤집는 방향으로 바뀌어요' },
  { id:'p_ma414_09', unitId:'ma4-1-4', type:'number', level:2, q:'도형을 시계 방향으로 90도씩 2번 돌리면 모두 몇 도를 돌린 걸까요? (숫자만)', a:'180', hint:'90 × 2' },
  { id:'p_ma414_10', unitId:'ma4-1-4', type:'choice', level:2, q:'도형을 왼쪽으로 두 번 뒤집으면 어떻게 될까요?', choices:['처음과 같아진다','좌우가 바뀐다','위아래가 바뀐다','크기가 작아진다'], a:'처음과 같아진다', hint:'두 번 뒤집으면 원래대로 돌아와요' },
  { id:'p_ma414_11', unitId:'ma4-1-4', type:'number', level:2, q:'도형을 시계 방향으로 90도씩 몇 번 돌려야 처음과 같아질까요? (숫자만)', a:'4', hint:'360 ÷ 90' },
  { id:'p_ma414_12', unitId:'ma4-1-4', type:'choice', level:2, q:'점을 오른쪽으로 3칸, 아래로 2칸 옮겼습니다. 이런 이동을 무엇이라 할까요?', choices:['밀기','뒤집기','돌리기','늘이기'], a:'밀기', hint:'자리만 옮기는 이동이에요' },
  { id:'p_ma414_13', unitId:'ma4-1-4', type:'choice', level:3, q:'도형을 시계 반대 방향으로 90도 돌린 것과 같은 결과가 되는 것은?', choices:['시계 방향으로 270도 돌리기','시계 방향으로 90도 돌리기','오른쪽으로 뒤집기','아래로 밀기'], a:'시계 방향으로 270도 돌리기', hint:'한 바퀴는 360도예요' },
  { id:'p_ma414_14', unitId:'ma4-1-4', type:'choice', level:3, q:'무늬를 꾸밀 때 같은 모양을 반복해서 옮기는 방법이 아닌 것은?', choices:['색칠하기','밀기','뒤집기','돌리기'], a:'색칠하기', hint:'이동 방법은 밀기·뒤집기·돌리기 세 가지예요' },
  { id:'p_ma414_15', unitId:'ma4-1-4', type:'number', level:3, q:'도형을 시계 방향으로 180도 돌린 뒤 다시 180도 돌렸습니다. 모두 몇 도를 돌린 걸까요? (숫자만)', a:'360', hint:'180 + 180' },

  // ── 수학 5. 막대그래프 (추가) ─────────────────
  { id:'p_ma415_15', unitId:'ma4-1-5', type:'choice', level:1, q:'막대그래프에서 가로와 세로 중 무엇을 나타내는지 적는 곳을 무엇이라 할까요?', choices:['항목과 눈금','제목','범례','축척'], a:'항목과 눈금', hint:'가로·세로에 무엇을 나타낼지 정해요' },
  { id:'p_ma415_07', unitId:'ma4-1-5', type:'number', level:1, q:'눈금 한 칸이 1명인 막대그래프에서 막대가 8칸이면 몇 명일까요?', a:'8', hint:'한 칸이 1명이에요' },
  { id:'p_ma415_08', unitId:'ma4-1-5', type:'number', level:2, q:'눈금 한 칸이 5권인 막대그래프에서 막대가 6칸이면 몇 권일까요?', a:'30', hint:'5 × 6' },
  { id:'p_ma415_09', unitId:'ma4-1-5', type:'number', level:2, q:'좋아하는 과일을 조사했더니 사과 12명, 배 8명, 귤 15명이었습니다. 조사한 학생은 모두 몇 명일까요?', a:'35', hint:'12 + 8 + 15' },
  { id:'p_ma415_10', unitId:'ma4-1-5', type:'number', level:2, q:'가장 많은 항목이 20명, 가장 적은 항목이 7명입니다. 차이는 몇 명일까요?', a:'13', hint:'20 − 7' },
  { id:'p_ma415_11', unitId:'ma4-1-5', type:'choice', level:2, q:'막대그래프에서 막대가 가장 긴 항목은 무엇을 뜻할까요?', choices:['가장 많은 것','가장 적은 것','가장 비싼 것','가장 오래된 것'], a:'가장 많은 것', hint:'막대가 길수록 수가 많아요' },
  { id:'p_ma415_12', unitId:'ma4-1-5', type:'number', level:3, q:'눈금 한 칸이 4명인 막대그래프에서 28명을 나타내려면 몇 칸을 그려야 할까요?', a:'7', hint:'28 ÷ 4' },
  { id:'p_ma415_13', unitId:'ma4-1-5', type:'choice', level:3, q:'자료를 조사해 막대그래프로 나타내는 순서로 알맞은 것은?', choices:['자료 조사 → 표 만들기 → 막대그래프 그리기','막대그래프 그리기 → 자료 조사','표 만들기 → 자료 조사','제목 정하기 → 막대 색칠하기'], a:'자료 조사 → 표 만들기 → 막대그래프 그리기', hint:'먼저 자료를 모아야 해요' },
  { id:'p_ma415_14', unitId:'ma4-1-5', type:'number', level:3, q:'눈금 한 칸이 2명인 막대그래프에서 어떤 항목의 막대가 9칸입니다. 몇 명일까요?', a:'18', hint:'2 × 9' },

  // ── 수학 6. 규칙과 관계 (추가) ────────────────
  { id:'p_ma416_09', unitId:'ma4-1-6', type:'number', level:1, q:'5, 10, 15, 20, □ … 빈칸에 알맞은 수는?', a:'25', hint:'5씩 커지고 있어요' },
  { id:'p_ma416_10', unitId:'ma4-1-6', type:'number', level:1, q:'81, 72, 63, 54, □ … 빈칸에 알맞은 수는?', a:'45', hint:'9씩 작아져요' },
  { id:'p_ma416_11', unitId:'ma4-1-6', type:'number', level:2, q:'3, 9, 27, □ … 빈칸에 알맞은 수는?', a:'81', hint:'3배씩 커져요' },
  { id:'p_ma416_12', unitId:'ma4-1-6', type:'number', level:2, q:'12 + 8 = □ + 5 에서 □에 알맞은 수는?', a:'15', hint:'12+8을 먼저 계산해요' },
  { id:'p_ma416_13', unitId:'ma4-1-6', type:'number', level:2, q:'20 − 7 = □ − 10 에서 □에 알맞은 수는?', a:'23', hint:'20−7을 먼저 계산하고, 거기에 10을 더해요' },
  { id:'p_ma416_14', unitId:'ma4-1-6', type:'choice', level:3, q:'등호(=)의 뜻으로 알맞은 것은?', choices:['양쪽의 크기가 같다','왼쪽이 더 크다','오른쪽이 더 크다','계산하라는 뜻이다'], a:'양쪽의 크기가 같다', hint:'저울이 균형을 이룬 모습이에요' },
  { id:'p_ma416_15', unitId:'ma4-1-6', type:'number', level:3, q:'첫째 줄 2개, 둘째 줄 4개, 셋째 줄 6개… 여섯째 줄에는 몇 개일까요?', a:'12', hint:'2씩 늘어나요. 2 × 6' },

  // ── 영어 L1. My Name Is Amy (추가) ───────────
  { id:'p_en411_07', unitId:'en4-1-1', type:'choice', level:1, q:'"Hi, I\'m Suho." 에서 Suho는 무엇일까요?', choices:['이름','나이','사는 곳','좋아하는 것'], a:'이름', hint:'I\'m 뒤에 이름을 말해요' },
  { id:'p_en411_08', unitId:'en4-1-1', type:'choice', level:1, q:'헤어질 때 하는 인사로 알맞은 것은?', choices:['Good bye.','Nice to meet you.','My name is Tom.','Here you are.'], a:'Good bye.', hint:'안녕히 가세요' },
  { id:'p_en411_09', unitId:'en4-1-1', type:'short', level:2, q:'"이름"을 뜻하는 영어 단어를 쓰세요.', a:'name', alt:['Name'], hint:'n으로 시작하는 네 글자' },
  { id:'p_en411_10', unitId:'en4-1-1', type:'choice', level:2, q:'"Nice to meet you." 에 대한 대답으로 알맞은 것은?', choices:['Nice to meet you, too.','No, thank you.','It is a pen.','I am hungry.'], a:'Nice to meet you, too.', hint:'나도 반가워' },
  { id:'p_en411_11', unitId:'en4-1-1', type:'choice', level:2, q:'아침에 만난 선생님께 하는 인사는?', choices:['Good morning.','Good night.','See you later.','I am sorry.'], a:'Good morning.', hint:'morning = 아침' },

  // ── 영어 L2. I'm Happy (추가) ────────────────
  { id:'p_en412_16', unitId:'en4-1-2', type:'short', level:1, q:'"행복한"을 뜻하는 영어 단어를 쓰세요.', a:'happy', alt:['Happy'], hint:'h로 시작해요' },
  { id:'p_en412_17', unitId:'en4-1-2', type:'choice', level:1, q:'"I\'m tired." 는 어떤 기분일까요?', choices:['피곤하다','신난다','배부르다','춥다'], a:'피곤하다', hint:'tired = 피곤한' },
  { id:'p_en412_18', unitId:'en4-1-2', type:'choice', level:2, q:'친구가 슬퍼 보일 때 물어볼 말로 알맞은 것은?', choices:['Are you okay?','How much is it?','What time is it?','Let\'s eat.'], a:'Are you okay?', hint:'괜찮니?' },
  { id:'p_en412_19', unitId:'en4-1-2', type:'short', level:2, q:'"목마른"을 뜻하는 영어 단어를 쓰세요.', a:'thirsty', alt:['Thirsty'], hint:'th로 시작해요' },
  { id:'p_en412_20', unitId:'en4-1-2', type:'choice', level:2, q:'"I\'m fine." 의 뜻으로 알맞은 것은?', choices:['나는 괜찮아.','나는 배고파.','나는 다섯 살이야.','나는 학생이야.'], a:'나는 괜찮아.', hint:'fine = 좋은, 괜찮은' },

  // ── 영어 L3. Don't Sit Here (추가) ───────────
  { id:'p_en413_15', unitId:'en4-1-3', type:'choice', level:1, q:'"Don\'t touch." 의 뜻은?', choices:['만지지 마.','만져 봐.','들어 봐.','보지 마.'], a:'만지지 마.', hint:'touch = 만지다' },
  { id:'p_en413_16', unitId:'en4-1-3', type:'choice', level:1, q:'복도에서 친구에게 "뛰지 마"라고 하려면?', choices:['Don\'t run.','Let\'s run.','I can run.','Do you run?'], a:'Don\'t run.', hint:'금지는 Don\'t로 시작해요' },
  { id:'p_en413_17', unitId:'en4-1-3', type:'choice', level:2, q:'"Don\'t open the door." 의 뜻은?', choices:['문을 열지 마세요.','문을 닫지 마세요.','문을 여세요.','문이 열려 있어요.'], a:'문을 열지 마세요.', hint:'open = 열다' },
  { id:'p_en413_18', unitId:'en4-1-3', type:'short', level:2, q:'"밀다"를 뜻하는 영어 단어를 쓰세요.', a:'push', alt:['Push'], hint:'p로 시작하는 네 글자' },
  { id:'p_en413_19', unitId:'en4-1-3', type:'choice', level:2, q:'"Don\'t" 는 무엇을 줄인 말일까요?', choices:['do not','did not','does not','done not'], a:'do not', hint:'do와 not을 합친 말이에요' },
  { id:'p_en413_20', unitId:'en4-1-3', type:'choice', level:2, q:'"Don\'t be late." 의 뜻은?', choices:['늦지 마.','일찍 와.','기다려.','서두르지 마.'], a:'늦지 마.', hint:'late = 늦은' },

  // ── 영어 L4. Let's Play Basketball (추가) ────
  { id:'p_en414_15', unitId:'en4-1-4', type:'choice', level:1, q:'"Let\'s go." 의 뜻은?', choices:['우리 가자.','나는 갔어.','너 갈래?','가지 마.'], a:'우리 가자.', hint:'Let\'s = 우리 ~하자' },
  { id:'p_en414_16', unitId:'en4-1-4', type:'choice', level:1, q:'"Let\'s eat lunch." 는 무엇을 하자는 말일까요?', choices:['점심 먹기','아침 먹기','운동하기','공부하기'], a:'점심 먹기', hint:'lunch = 점심' },
  { id:'p_en414_17', unitId:'en4-1-4', type:'choice', level:2, q:'"Let\'s ~" 제안을 거절할 때 알맞은 말은?', choices:['Sorry, I can\'t.','Good idea!','Yes, let\'s.','Sure.'], a:'Sorry, I can\'t.', hint:'미안해, 안 될 것 같아' },
  { id:'p_en414_18', unitId:'en4-1-4', type:'short', level:2, q:'"농구"를 뜻하는 영어 단어를 쓰세요.', a:'basketball', alt:['Basketball'], hint:'basket + ball' },
  { id:'p_en414_19', unitId:'en4-1-4', type:'choice', level:2, q:'"우리 같이 노래하자"를 영어로 알맞게 쓴 것은?', choices:['Let\'s sing together.','Don\'t sing.','I sing well.','Can you sing?'], a:'Let\'s sing together.', hint:'together = 함께' },
  { id:'p_en414_20', unitId:'en4-1-4', type:'short', level:1, q:'"축구"를 뜻하는 영어 단어를 쓰세요.', a:'soccer', alt:['Soccer','football','Football'], hint:'s로 시작해요' },

  // ── 영어 L5. I Want Chicken (추가) ───────────
  { id:'p_en415_16', unitId:'en4-1-5', type:'short', level:1, q:'"빵"을 뜻하는 영어 단어를 쓰세요.', a:'bread', alt:['Bread'], hint:'b로 시작해요' },
  { id:'p_en415_17', unitId:'en4-1-5', type:'choice', level:1, q:'"I want water." 의 뜻은?', choices:['나는 물을 원해.','나는 물을 마셨어.','물이 차가워.','물이 없어.'], a:'나는 물을 원해.', hint:'want = 원하다' },
  { id:'p_en415_18', unitId:'en4-1-5', type:'choice', level:2, q:'음식을 권할 때 "고맙지만 괜찮아"라고 답하려면?', choices:['No, thank you.','Yes, please.','Here you are.','You\'re welcome.'], a:'No, thank you.', hint:'정중하게 거절하는 말이에요' },
  { id:'p_en415_19', unitId:'en4-1-5', type:'choice', level:2, q:'"Here you are." 는 어떤 상황에서 쓸까요?', choices:['물건을 건네줄 때','헤어질 때','처음 만났을 때','사과할 때'], a:'물건을 건네줄 때', hint:'여기 있어' },
  { id:'p_en415_20', unitId:'en4-1-5', type:'short', level:1, q:'"우유"가 아니라 "주스"를 뜻하는 영어 단어를 쓰세요.', a:'juice', alt:['Juice'], hint:'j로 시작해요' },

  // ── 영어 L6. Where's My Cap? (추가) ──────────
  { id:'p_en416_16', unitId:'en4-1-6', type:'choice', level:1, q:'"It\'s in the bag." 의 뜻은?', choices:['가방 안에 있어.','가방 위에 있어.','가방 아래에 있어.','가방이 없어.'], a:'가방 안에 있어.', hint:'in = ~안에' },
  { id:'p_en416_17', unitId:'en4-1-6', type:'short', level:1, q:'"책상"을 뜻하는 영어 단어를 쓰세요.', a:'desk', alt:['Desk'], hint:'d로 시작하는 네 글자' },
  { id:'p_en416_18', unitId:'en4-1-6', type:'choice', level:2, q:'"~위에"를 뜻하는 영어 단어는?', choices:['on','in','under','out'], a:'on', hint:'책상 위 = on the desk' },
  { id:'p_en416_19', unitId:'en4-1-6', type:'choice', level:2, q:'"Where is my bag?" 에 대한 대답으로 알맞은 것은?', choices:['It\'s under the chair.','It\'s a bag.','Yes, it is.','I like bags.'], a:'It\'s under the chair.', hint:'어디 있는지 답해야 해요' },
  { id:'p_en416_20', unitId:'en4-1-6', type:'short', level:1, q:'"모자"를 뜻하는 영어 단어를 쓰세요. (c로 시작)', a:'cap', alt:['Cap'], hint:'c로 시작하는 세 글자' },

  // ── 사회 1. 지도로 만나는 우리 지역 (추가) ────
  { id:'p_so411_09', unitId:'so4-1-1', type:'choice', level:1, q:'위에서 내려다본 땅의 모습을 일정하게 줄여서 나타낸 것을 무엇이라 할까요?', choices:['지도','사진','그림','일기'], a:'지도', hint:'약속된 기호로 나타내요' },
  { id:'p_so411_10', unitId:'so4-1-1', type:'choice', level:1, q:'지도에서 동서남북을 알려 주는 것은?', choices:['방위표','축척','범례','등고선'], a:'방위표', hint:'화살표로 북쪽을 가리켜요' },
  { id:'p_so411_11', unitId:'so4-1-1', type:'choice', level:1, q:'지도에서 북쪽의 반대 방향은?', choices:['남쪽','동쪽','서쪽','북서쪽'], a:'남쪽', hint:'지도 아래쪽이에요' },
  { id:'p_so411_12', unitId:'so4-1-1', type:'choice', level:2, q:'등고선에서 색이 진할수록 무엇을 나타낼까요?', choices:['땅이 높음','땅이 낮음','물이 깊음','사람이 많음'], a:'땅이 높음', hint:'높은 곳일수록 진하게 칠해요' },
  { id:'p_so411_13', unitId:'so4-1-1', type:'choice', level:2, q:'다음 중 인문환경에 해당하는 것은?', choices:['도로','산','바다','하천'], a:'도로', hint:'사람이 만든 것이 인문환경이에요' },
  { id:'p_so411_14', unitId:'so4-1-1', type:'choice', level:2, q:'우리 지역의 위치를 설명할 때 알맞지 않은 것은?', choices:['내가 좋아하는 색','이웃한 시·군','바다와 접해 있는지','지도에서의 방위'], a:'내가 좋아하는 색', hint:'위치는 사실로 설명해요' },
  { id:'p_so411_15', unitId:'so4-1-1', type:'choice', level:2, q:'디지털 영상 지도의 좋은 점으로 알맞은 것은?', choices:['확대·축소하며 자세히 볼 수 있다','종이보다 무겁다','한 번 보면 지울 수 없다','색깔이 없다'], a:'확대·축소하며 자세히 볼 수 있다', hint:'손가락으로 크게 볼 수 있어요' },
  { id:'p_so411_16', unitId:'so4-1-1', type:'choice', level:2, q:'축척이 필요한 까닭으로 알맞은 것은?', choices:['넓은 땅을 종이에 담기 위해','색을 예쁘게 칠하기 위해','글씨를 크게 쓰기 위해','지도를 접기 위해'], a:'넓은 땅을 종이에 담기 위해', hint:'실제 거리를 줄여서 그려요' },
  { id:'p_so411_17', unitId:'so4-1-1', type:'choice', level:2, q:'다음 중 자연환경끼리 짝지어진 것은?', choices:['산과 하천','학교와 공원','도로와 다리','시장과 병원'], a:'산과 하천', hint:'자연이 만든 것이에요' },
  { id:'p_so411_18', unitId:'so4-1-1', type:'choice', level:3, q:'지도에서 범례를 먼저 보아야 하는 까닭은?', choices:['기호가 무엇을 뜻하는지 알기 위해','지도를 접기 위해','색을 칠하기 위해','제목을 정하기 위해'], a:'기호가 무엇을 뜻하는지 알기 위해', hint:'기호 설명표예요' },
  { id:'p_so411_19', unitId:'so4-1-1', type:'choice', level:3, q:'우리 지역을 조사하는 방법으로 알맞지 않은 것은?', choices:['상상해서 지어내기','지도 살펴보기','직접 답사하기','어른께 여쭤보기'], a:'상상해서 지어내기', hint:'조사는 사실을 확인하는 일이에요' },
  { id:'p_so411_20', unitId:'so4-1-1', type:'choice', level:3, q:'지도에 방위표가 없을 때의 약속으로 알맞은 것은?', choices:['위쪽이 북쪽이다','위쪽이 남쪽이다','오른쪽이 북쪽이다','정해진 것이 없다'], a:'위쪽이 북쪽이다', hint:'지도의 기본 약속이에요' },

  // ── 사회 2. 우리 지역의 국가유산 (추가) ────────
  { id:'p_so412_07', unitId:'so4-1-2', type:'choice', level:1, q:'국가유산을 조사할 때 직접 찾아가 보는 것을 무엇이라 할까요?', choices:['답사','상상','토론','발표'], a:'답사', hint:'현장에 직접 가는 거예요' },
  { id:'p_so412_08', unitId:'so4-1-2', type:'choice', level:1, q:'다음 중 국가유산이 아닌 것은?', choices:['오늘 산 장난감','석굴암','판소리','경복궁'], a:'오늘 산 장난감', hint:'오래 전부터 전해 온 것이어야 해요' },
  { id:'p_so412_09', unitId:'so4-1-2', type:'choice', level:1, q:'탈춤·판소리처럼 사람에게서 사람으로 전해지는 것은 어떤 유산일까요?', choices:['무형유산','문화유산','자연유산','기록유산'], a:'무형유산', hint:'형태가 없어요' },
  { id:'p_so412_10', unitId:'so4-1-2', type:'choice', level:2, q:'국가유산을 보호해야 하는 까닭으로 알맞은 것은?', choices:['한번 사라지면 되돌릴 수 없어서','돈을 벌 수 있어서','새로 만들기 쉬워서','아무도 안 봐서'], a:'한번 사라지면 되돌릴 수 없어서', hint:'조상들이 남긴 소중한 것이에요' },
  { id:'p_so412_11', unitId:'so4-1-2', type:'choice', level:2, q:'국가유산을 안내해 주는 사람을 무엇이라 할까요?', choices:['문화 해설사','운전기사','경찰관','소방관'], a:'문화 해설사', hint:'유산에 대해 설명해 줘요' },
  { id:'p_so412_12', unitId:'so4-1-2', type:'choice', level:2, q:'답사를 갈 때 미리 준비할 것으로 알맞지 않은 것은?', choices:['친구 도시락 뺏을 계획','조사할 내용 정하기','사진기와 수첩','가는 길 알아보기'], a:'친구 도시락 뺏을 계획', hint:'답사 준비물과 계획을 세워요' },
  { id:'p_so412_13', unitId:'so4-1-2', type:'choice', level:2, q:'천연기념물로 지정된 나무나 동물은 어떤 유산에 속할까요?', choices:['자연유산','문화유산','무형유산','기록유산'], a:'자연유산', hint:'자연이 만든 소중한 것이에요' },
  { id:'p_so412_14', unitId:'so4-1-2', type:'choice', level:2, q:'국가유산 조사 방법으로 알맞은 것끼리 짝지어진 것은?', choices:['답사·누리집 검색','낙서·훼손','비밀로 하기·숨기기','상상·추측'], a:'답사·누리집 검색', hint:'사실을 확인하는 방법이에요' },
  { id:'p_so412_15', unitId:'so4-1-2', type:'choice', level:3, q:'우리 지역의 역사를 알 수 있는 장소로 알맞지 않은 것은?', choices:['놀이공원','박물관','유적지','향교'], a:'놀이공원', hint:'옛 모습이 남아 있는 곳을 찾아요' },
  { id:'p_so412_16', unitId:'so4-1-2', type:'choice', level:3, q:'국가유산 답사 보고서에 들어갈 내용으로 알맞지 않은 것은?', choices:['내가 좋아하는 가수 이름','답사한 날짜','알게 된 점','느낀 점'], a:'내가 좋아하는 가수 이름', hint:'답사와 관련된 내용을 적어요' },
  { id:'p_so412_17', unitId:'so4-1-2', type:'choice', level:3, q:'2024년부터 \'문화재\' 대신 쓰기로 한 말은 무엇일까요?', choices:['국가유산','문화상품','전통물품','역사자료'], a:'국가유산', hint:'유산이라는 말로 바뀌었어요' },
  { id:'p_so412_18', unitId:'so4-1-2', type:'choice', level:3, q:'국가유산을 아끼는 태도로 알맞은 것은?', choices:['안내판의 내용을 잘 읽고 지킨다','기념으로 조금 가져온다','올라가서 사진을 찍는다','이름을 새긴다'], a:'안내판의 내용을 잘 읽고 지킨다', hint:'모두의 유산이에요' },

  // ── 사회 3. 경제활동과 지역 간 교류 (추가) ─────
  { id:'p_so413_07', unitId:'so4-1-3', type:'choice', level:1, q:'물건을 만들어 내는 활동을 무엇이라 할까요?', choices:['생산','소비','저축','교환'], a:'생산', hint:'만들어 내는 일이에요' },
  { id:'p_so413_08', unitId:'so4-1-3', type:'choice', level:1, q:'돈을 내고 물건을 사서 쓰는 활동을 무엇이라 할까요?', choices:['소비','생산','기부','저축'], a:'소비', hint:'사서 쓰는 일이에요' },
  { id:'p_so413_09', unitId:'so4-1-3', type:'choice', level:1, q:'다음 중 생산 활동에 해당하는 것은?', choices:['농부가 벼를 기른다','과자를 사 먹는다','영화를 본다','용돈을 받는다'], a:'농부가 벼를 기른다', hint:'무언가를 만들어 내는 일이에요' },
  { id:'p_so413_10', unitId:'so4-1-3', type:'choice', level:2, q:'합리적 선택을 할 때 고려하지 않아도 되는 것은?', choices:['포장지 색깔이 내 기분에 맞는지','가격','품질','필요한 물건인지'], a:'포장지 색깔이 내 기분에 맞는지', hint:'꼭 필요한 기준을 따져요' },
  { id:'p_so413_11', unitId:'so4-1-3', type:'choice', level:2, q:'상품의 생산지를 알 수 있는 방법으로 알맞은 것은?', choices:['포장지의 원산지 표시 확인','물건 무게 재기','친구에게 물어보기','색깔 보기'], a:'포장지의 원산지 표시 확인', hint:'포장지에 적혀 있어요' },
  { id:'p_so413_12', unitId:'so4-1-3', type:'choice', level:2, q:'우리 지역에서 나지 않는 물건을 구할 수 있는 까닭은?', choices:['다른 지역과 교류하기 때문','우리 지역이 넓기 때문','물건이 저절로 생기기 때문','사람이 많기 때문'], a:'다른 지역과 교류하기 때문', hint:'서로 주고받아요' },
  { id:'p_so413_13', unitId:'so4-1-3', type:'choice', level:2, q:'다음 중 지역 간 교류의 예로 알맞지 않은 것은?', choices:['혼자 방에서 책 읽기','다른 지역 특산물 사기','자매결연 도시와 문화 행사','다른 지역으로 여행 가기'], a:'혼자 방에서 책 읽기', hint:'교류는 서로 오가는 일이에요' },
  { id:'p_so413_14', unitId:'so4-1-3', type:'choice', level:2, q:'희소성 때문에 우리는 무엇을 해야 할까요?', choices:['선택','포기 없이 다 갖기','저축만 하기','생산 중단'], a:'선택', hint:'다 가질 수 없으니 골라야 해요' },
  { id:'p_so413_15', unitId:'so4-1-3', type:'choice', level:3, q:'현명한 소비 생활의 모습으로 알맞은 것은?', choices:['필요한 것을 미리 계획해 사기','충동적으로 사기','비싼 것만 사기','친구를 따라 사기'], a:'필요한 것을 미리 계획해 사기', hint:'계획을 세워요' },
  { id:'p_so413_16', unitId:'so4-1-3', type:'choice', level:3, q:'지역마다 생산하는 물건이 다른 까닭으로 알맞은 것은?', choices:['자연환경과 기술이 다르기 때문','사람 수가 같기 때문','모두 같은 물건을 만들기 때문','교류를 안 하기 때문'], a:'자연환경과 기술이 다르기 때문', hint:'바다가 있는 곳과 산이 있는 곳은 달라요' },
  { id:'p_so413_17', unitId:'so4-1-3', type:'choice', level:3, q:'경제적 교류가 지역에 주는 좋은 점으로 알맞은 것은?', choices:['서로 부족한 것을 채울 수 있다','물건이 사라진다','값이 무조건 오른다','사람이 줄어든다'], a:'서로 부족한 것을 채울 수 있다', hint:'서로 도움이 돼요' },
  { id:'p_so413_18', unitId:'so4-1-3', type:'choice', level:3, q:'용돈 기입장을 쓰면 좋은 점으로 알맞은 것은?', choices:['돈을 어디에 썼는지 알 수 있다','돈이 저절로 늘어난다','물건값이 싸진다','생산이 늘어난다'], a:'돈을 어디에 썼는지 알 수 있다', hint:'쓴 내역을 기록해요' },
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
