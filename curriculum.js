// ══════════════════════════════════════════════════
//  교육과정 학습 콘텐츠 — 단원 정의 + 기본 문제 은행
//  ------------------------------------------------
//  · gamedata.js 다음에 로드된다(클래식 <script>, 전역 상수 노출).
//  · 교과서 본문·문제를 옮겨오지 않는다. 교육과정 성취기준에 맞춰 새로 만든 문항만 담는다.
//    (교과서 내용은 저작권 대상이며, 이 앱은 향후 배포를 염두에 두므로 원칙적으로 제외)
//  · 단원명은 수학은 전 출판사 공통이지만 영어·사회는 출판사별 차이가 있어
//    교사 화면에서 수정할 수 있게 한다(customUnits로 덮어씀).
//
//  ⚠️⚠️ 단원 구성 **미검증** — 실제 교과서와 대조 필요 (2026-07-30 사용자 지적) ⚠️⚠️
//   · 영어: 초등 영어는 검정교과서라 출판사마다 단원이 완전히 다르다.
//           아래 6단원은 실제 교과서 단원이 아니라 **작성자가 임의로 묶은 주제**다.
//           반드시 실제 사용 교과서(출판사)의 목차로 교체할 것.
//   · 사회: **2022 개정 교육과정이 2024년부터 3~4학년에 적용**됐는데, 아래 3단원은
//           2015 개정 기준일 가능성이 크다. 현행 교육과정 확인 후 교체 필요.
//   · 수학: 단원 구성이 비교적 안정적이나 역시 2022 개정 기준인지 미확인.
//   → 확인 방법: 학교 교육과정(연간계획) 문서 / 교과서 목차 / 지도서.
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
          { id:'ma4-1-6', no:6, name:'규칙 찾기' },
        ],
      },
      english: {
        label: '영어', icon: '🔤',
        // 단원명은 출판사마다 다르므로 성취기준 주제로 정리(교사가 수정 가능)
        units: [
          { id:'en4-1-1', no:1, name:'인사와 소개' },
          { id:'en4-1-2', no:2, name:'숫자와 나이' },
          { id:'en4-1-3', no:3, name:'좋아하는 것' },
          { id:'en4-1-4', no:4, name:'할 수 있는 일' },
          { id:'en4-1-5', no:5, name:'날씨와 계절' },
          { id:'en4-1-6', no:6, name:'하루 일과' },
        ],
      },
      social: {
        label: '사회', icon: '🗺️',
        units: [
          { id:'so4-1-1', no:1, name:'지역의 위치와 특성' },
          { id:'so4-1-2', no:2, name:'우리가 알아보는 지역의 역사' },
          { id:'so4-1-3', no:3, name:'지역의 공공기관과 주민 참여' },
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

  // ── 영어 1. 인사와 소개 ──────────────────────
  { id:'p_en411_01', unitId:'en4-1-1', type:'choice', level:1, q:'"Hello, my name is Jimin." 에서 이름을 말하는 표현은?', choices:['my name is','how are you','thank you','good bye'], a:'my name is', hint:'name = 이름' },
  { id:'p_en411_02', unitId:'en4-1-1', type:'short', level:1, q:'"안녕하세요"에 해당하는 영어 인사말을 쓰세요.', a:'hello', alt:['hi','Hello','Hi'], hint:'h로 시작해요' },
  { id:'p_en411_03', unitId:'en4-1-1', type:'choice', level:1, q:'처음 만난 친구에게 하는 인사로 알맞은 것은?', choices:['Nice to meet you.','Good night.','See you.','I am sorry.'], a:'Nice to meet you.', hint:'만나서 반가워' },
  { id:'p_en411_04', unitId:'en4-1-1', type:'choice', level:2, q:'"How are you?" 에 대한 알맞은 대답은?', choices:['I am fine, thank you.','My name is Tom.','It is a book.','Yes, I can.'], a:'I am fine, thank you.', hint:'기분·안부를 묻는 말이에요' },
  { id:'p_en411_05', unitId:'en4-1-1', type:'short', level:2, q:'"고맙습니다"를 영어로 두 단어로 쓰세요.', a:'thank you', alt:['Thank you','thankyou'], hint:'Thank …' },

  // ── 영어 2. 숫자와 나이 ──────────────────────
  { id:'p_en412_01', unitId:'en4-1-2', type:'short', level:1, q:'숫자 7을 영어로 쓰세요.', a:'seven', alt:['Seven'], hint:'s로 시작해요' },
  { id:'p_en412_02', unitId:'en4-1-2', type:'short', level:1, q:'숫자 10을 영어로 쓰세요.', a:'ten', alt:['Ten'], hint:'t로 시작해요' },
  { id:'p_en412_03', unitId:'en4-1-2', type:'choice', level:2, q:'"How old are you?" 는 무엇을 묻는 말일까요?', choices:['나이','이름','사는 곳','좋아하는 색'], a:'나이', hint:'old = 나이가 든' },
  { id:'p_en412_04', unitId:'en4-1-2', type:'choice', level:2, q:'"I am eleven years old." 는 몇 살이라는 뜻일까요?', choices:['11살','7살','12살','9살'], a:'11살', hint:'eleven = 11' },
  { id:'p_en412_05', unitId:'en4-1-2', type:'short', level:2, q:'숫자 12를 영어로 쓰세요.', a:'twelve', alt:['Twelve'], hint:'tw로 시작해요' },

  // ── 영어 3. 좋아하는 것 ──────────────────────
  { id:'p_en413_01', unitId:'en4-1-3', type:'choice', level:1, q:'"I like apples." 의 뜻으로 알맞은 것은?', choices:['나는 사과를 좋아해.','나는 사과가 있어.','나는 사과를 먹었어.','사과는 빨갛다.'], a:'나는 사과를 좋아해.', hint:'like = 좋아하다' },
  { id:'p_en413_02', unitId:'en4-1-3', type:'choice', level:2, q:'"Do you like pizza?" 에 대한 대답으로 알맞은 것은?', choices:['Yes, I do.','Yes, I am.','No, it is.','I am ten.'], a:'Yes, I do.', hint:'Do로 물으면 do로 답해요' },
  { id:'p_en413_03', unitId:'en4-1-3', type:'short', level:1, q:'"파란색"을 영어로 쓰세요.', a:'blue', alt:['Blue'], hint:'b로 시작해요' },
  { id:'p_en413_04', unitId:'en4-1-3', type:'short', level:1, q:'"빨간색"을 영어로 쓰세요.', a:'red', alt:['Red'], hint:'r로 시작해요' },
  { id:'p_en413_05', unitId:'en4-1-3', type:'choice', level:2, q:'"What color do you like?" 는 무엇을 묻는 말일까요?', choices:['좋아하는 색','좋아하는 음식','나이','이름'], a:'좋아하는 색', hint:'color = 색' },

  // ── 영어 4. 할 수 있는 일 ────────────────────
  { id:'p_en414_01', unitId:'en4-1-4', type:'choice', level:1, q:'"I can swim." 의 뜻은?', choices:['나는 수영할 수 있어.','나는 수영을 좋아해.','나는 수영했어.','수영은 재미있어.'], a:'나는 수영할 수 있어.', hint:'can = ~할 수 있다' },
  { id:'p_en414_02', unitId:'en4-1-4', type:'choice', level:2, q:'"Can you skate?" 에 "아니오"로 답하려면?', choices:['No, I can\'t.','No, I am not.','Yes, I can.','No, I don\'t.'], a:'No, I can\'t.', hint:'can으로 물으면 can으로 답해요' },
  { id:'p_en414_03', unitId:'en4-1-4', type:'short', level:1, q:'"달리다"를 영어로 쓰세요.', a:'run', alt:['Run'], hint:'r로 시작하는 세 글자' },
  { id:'p_en414_04', unitId:'en4-1-4', type:'short', level:2, q:'"노래하다"를 영어로 쓰세요.', a:'sing', alt:['Sing'], hint:'s로 시작해요' },

  // ── 영어 5. 날씨와 계절 ──────────────────────
  { id:'p_en415_01', unitId:'en4-1-5', type:'choice', level:1, q:'"How is the weather?" 는 무엇을 묻는 말일까요?', choices:['날씨','요일','시간','나이'], a:'날씨', hint:'weather = 날씨' },
  { id:'p_en415_02', unitId:'en4-1-5', type:'short', level:1, q:'"비가 오는"을 뜻하는 영어 단어를 쓰세요.', a:'rainy', alt:['Rainy'], hint:'rain + y' },
  { id:'p_en415_03', unitId:'en4-1-5', type:'short', level:1, q:'"맑은, 화창한"을 뜻하는 영어 단어를 쓰세요.', a:'sunny', alt:['Sunny'], hint:'sun + ny' },
  { id:'p_en415_04', unitId:'en4-1-5', type:'choice', level:2, q:'"It is snowy." 는 어떤 날씨일까요?', choices:['눈이 온다','바람이 분다','덥다','흐리다'], a:'눈이 온다', hint:'snow = 눈' },
  { id:'p_en415_05', unitId:'en4-1-5', type:'short', level:2, q:'"겨울"을 영어로 쓰세요.', a:'winter', alt:['Winter'], hint:'w로 시작해요' },

  // ── 영어 6. 하루 일과 ────────────────────────
  { id:'p_en416_01', unitId:'en4-1-6', type:'choice', level:1, q:'"What time is it?" 는 무엇을 묻는 말일까요?', choices:['시간','날씨','이름','나이'], a:'시간', hint:'time = 시간' },
  { id:'p_en416_02', unitId:'en4-1-6', type:'choice', level:2, q:'"It is seven o\'clock." 는 몇 시일까요?', choices:['7시','9시','11시','6시'], a:'7시', hint:'seven = 7' },
  { id:'p_en416_03', unitId:'en4-1-6', type:'short', level:1, q:'"아침"을 뜻하는 영어 단어를 쓰세요.', a:'morning', alt:['Morning'], hint:'m로 시작해요' },
  { id:'p_en416_04', unitId:'en4-1-6', type:'choice', level:2, q:'"I get up at seven." 의 뜻은?', choices:['나는 7시에 일어난다.','나는 7시에 잔다.','나는 7살이다.','나는 7시에 먹는다.'], a:'나는 7시에 일어난다.', hint:'get up = 일어나다' },

  // ── 사회 1. 지역의 위치와 특성 ───────────────
  { id:'p_so411_01', unitId:'so4-1-1', type:'choice', level:1, q:'지도에서 방위표가 없을 때 위쪽은 어느 방향일까요?', choices:['북쪽','남쪽','동쪽','서쪽'], a:'북쪽', hint:'지도의 기본 약속이에요' },
  { id:'p_so411_02', unitId:'so4-1-1', type:'choice', level:1, q:'지도에서 실제 거리를 줄인 정도를 나타내는 것은?', choices:['축척','범례','방위표','등고선'], a:'축척', hint:'얼마나 줄였는지 알려줘요' },
  { id:'p_so411_03', unitId:'so4-1-1', type:'choice', level:1, q:'지도에서 기호가 무엇을 뜻하는지 알려 주는 것은?', choices:['범례','축척','방위표','좌표'], a:'범례', hint:'기호 설명표예요' },
  { id:'p_so411_04', unitId:'so4-1-1', type:'choice', level:2, q:'땅의 높낮이를 나타내기 위해 같은 높이를 이은 선은?', choices:['등고선','축척','범례','경계선'], a:'등고선', hint:'높을수록 안쪽에 그려요' },
  { id:'p_so411_05', unitId:'so4-1-1', type:'choice', level:2, q:'사람들이 많이 모여 물건을 사고팔거나 일을 보러 가는 곳을 무엇이라 할까요?', choices:['중심지','변두리','농촌','산지'], a:'중심지', hint:'시청·시장·터미널이 모인 곳' },
  { id:'p_so411_06', unitId:'so4-1-1', type:'choice', level:2, q:'다음 중 중심지에서 볼 수 있는 시설이 아닌 것은?', choices:['넓은 논과 밭','시청','버스 터미널','백화점'], a:'넓은 논과 밭', hint:'중심지에는 사람과 시설이 모여요' },

  // ── 사회 2. 지역의 역사 ──────────────────────
  { id:'p_so412_01', unitId:'so4-1-2', type:'choice', level:1, q:'옛날 사람들이 남긴 건축물·유물처럼 오늘날까지 전해지는 것을 무엇이라 할까요?', choices:['문화유산','자연환경','공공기관','중심지'], a:'문화유산', hint:'조상들이 물려준 것' },
  { id:'p_so412_02', unitId:'so4-1-2', type:'choice', level:1, q:'건축물이나 유물처럼 형태가 있는 문화유산을 무엇이라 할까요?', choices:['유형 문화유산','무형 문화유산','자연유산','기록유산'], a:'유형 문화유산', hint:'눈에 보이고 만질 수 있어요' },
  { id:'p_so412_03', unitId:'so4-1-2', type:'choice', level:2, q:'판소리나 탈춤처럼 형태가 없는 문화유산은?', choices:['무형 문화유산','유형 문화유산','자연유산','천연기념물'], a:'무형 문화유산', hint:'사람의 기술·솜씨로 이어져요' },
  { id:'p_so412_04', unitId:'so4-1-2', type:'choice', level:2, q:'지역의 문화유산을 조사하는 방법으로 알맞지 않은 것은?', choices:['마음대로 상상해서 적기','문화유산 답사하기','누리집에서 찾아보기','문화 해설사께 여쭤보기'], a:'마음대로 상상해서 적기', hint:'조사는 사실을 확인하는 일이에요' },
  { id:'p_so412_05', unitId:'so4-1-2', type:'choice', level:2, q:'문화유산을 답사할 때 지켜야 할 태도로 알맞은 것은?', choices:['함부로 만지지 않는다','기념으로 조금 떼어 온다','큰 소리로 뛰어다닌다','낙서를 남긴다'], a:'함부로 만지지 않는다', hint:'모두의 소중한 유산이에요' },

  // ── 사회 3. 공공기관과 주민 참여 ─────────────
  { id:'p_so413_01', unitId:'so4-1-3', type:'choice', level:1, q:'주민 전체의 이익을 위해 나라나 지방자치단체가 세운 기관을 무엇이라 할까요?', choices:['공공기관','회사','시장','가게'], a:'공공기관', hint:'모두를 위해 일하는 곳' },
  { id:'p_so413_02', unitId:'so4-1-3', type:'choice', level:1, q:'다음 중 공공기관이 아닌 곳은?', choices:['백화점','도서관','소방서','경찰서'], a:'백화점', hint:'이익을 얻으려는 곳은 공공기관이 아니에요' },
  { id:'p_so413_03', unitId:'so4-1-3', type:'choice', level:1, q:'불을 끄고 위급한 사람을 구조하는 공공기관은?', choices:['소방서','우체국','도서관','보건소'], a:'소방서', hint:'119' },
  { id:'p_so413_04', unitId:'so4-1-3', type:'choice', level:2, q:'예방접종과 건강 상담을 도와주는 공공기관은?', choices:['보건소','경찰서','교육청','시청'], a:'보건소', hint:'건강을 돌봐요' },
  { id:'p_so413_05', unitId:'so4-1-3', type:'choice', level:2, q:'지역 문제를 해결하기 위한 주민 참여 방법으로 알맞지 않은 것은?', choices:['혼자 화를 내고 그만두기','주민 회의에 참여하기','서명 운동하기','공공기관에 건의하기'], a:'혼자 화를 내고 그만두기', hint:'함께 의견을 모아야 해결돼요' },
  { id:'p_so413_06', unitId:'so4-1-3', type:'choice', level:2, q:'지역의 여러 사람이 함께 겪는 어려움을 무엇이라 할까요?', choices:['지역 문제','개인 취미','학급 규칙','가족 행사'], a:'지역 문제', hint:'쓰레기·주차·소음 같은 것' },
];

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
