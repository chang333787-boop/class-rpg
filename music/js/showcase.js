// 예시 작품 — '음악 좋아하는 4학년 친구'가 이 음악실 도구만으로 만든 곡 · 비트 [MUSIC-SHOWCASE-1]
//  선생님 10-10: "비트랑 오케스트라를 음악적 재능이 있는 4학년이라고 생각하고 만들어 봐 — 애들에게 이걸로 할 수 있는 가능성을 제시해 줘야 돼".
//  · 모두 새로 지은 곡(저작권 없음) · 아이가 실제로 고를 수 있는 것만 썼다: 작곡 = 16마디 · 다장조 · 반 박 칸 · 마디마다 고른 화음 · 화음 칸 · 오케스트라 편성/칸/셈여림/점점 느리게
//    비트 = 16칸(12칸) · 패턴 A~D · 순서 8칸 · 북/가락/베이스/화음 · 통통 튀는 정도 · 4번째 반복 필인.
//  · 첫 화면 '🌟 이렇게도 만들 수 있어요'와 비트 '시작 카드'에서 연다 → 작품 노트(어떻게 만들었나 · 해 볼 것) → ▶ 들어 보기 → 바꿔서 내 것으로 저장.
//  · 작곡 곡: 가락 글은 library 꼴(음이름/칸 · R 쉼 · ~ 붙임줄 · | 마디). 화음 칸은 성부마다 한 줄(같은 때 시작한 음 = 화음 하나).
//  · 비트: 패턴마다 시작 카드와 같은 글자 줄(X 세게 · x 보통 · . 빈칸 / 가락 0~7 · 베이스 0~5 · x 쉼 · . 이어짐).
import { parseMelody, normalize } from './song.js';

export const EX_BY = '4학년 음악 친구';
//  쉼 마디 n 개(화음 칸 성부의 앞뒤 채우기) — bs = 한 마디 칸 수
const rests = (n, bs) => Array(n).fill('R/' + bs).join(' | ');

// ── 작곡 + 오케스트라 ──
//  parts 순서: strings 현악기 화음 · bass 낮은 현 · winds 목관 화음 · brass 금관 · harp 하프 · perc 타악기 · sparkle 반짝이
const P7 = (strings, bass, winds, brass, harp, perc, sparkle) => ({ strings, bass, winds, brass, harp, perc, sparkle });
export const EX_SONGS = [
  {
    key: 'hero', title: '용사의 출발', em: '🎬', kind: '작곡 · 영화 음악', line: '트럼펫이 부르는 용사의 노래 — 마지막엔 목관이 화음으로 함께해요',
    beats: 4, sub: 2, tempo: 100, inst: 'trumpet', level: 3, reverb: 0.4,
    orch: { on: true, preset: 'film', parts: P7(true, true, true, true, true, true, false), dyn: 'cresc', rit: true },
    //  1~4 주제(열린 끝 · 솔 화음) | 5~8 같은 주제 · 끝만 바꿔 마침(파 → 미) | 9~12 같은 음을 빠르게 되풀이 — 두근두근 | 13~16 주제로 돌아와 마침(레 → 도)
    melody: 'G4/2 C5/2 E5/3 C5/1 | F5/2 E5/2 D5/2 C5/2 | D5/3 B4/1 G4/2 B4/2 | D5/6 R/2 |'
          + 'G4/2 C5/2 E5/3 C5/1 | F5/2 E5/2 D5/2 C5/2 | B4/2 D5/2 G5/3 F5/1 | E5/6 R/2 |'
          + 'F5/1 F5/1 F5/1 E5/1 F5/2 A5/2 | G5/4 E5/2 C5/2 | F5/1 F5/1 F5/1 E5/1 F5/2 A5/2 | G5/6 R/2 |'
          + 'G4/2 C5/2 E5/3 C5/1 | F5/2 E5/2 D5/2 C5/2 | D5/3 E5/1 F5/2 D5/2 | C5/8',
    chords: ['I', 'IV', 'V', 'V', 'I', 'IV', 'V', 'I', 'IV', 'I', 'IV', 'V', 'I', 'IV', 'V', 'I'],
    //  화음 칸(13~16마디만) — 가락 아래 3도 · 6도 화음 음 · 마지막은 미 + 솔(가락 도와 함께 도 화음)
    harm: [rests(12, 8) + ' | E4/4 G4/4 | A4/4 F4/4 | B4/8 | E4/8', rests(15, 8) + ' | G4/8'],
    notes: [
      '1~4마디 = 주제: 솔 → 도로 4도 뛰어오르는 시작이 \'출발!\' 느낌 · 끝은 솔 화음에서 멈춰 \'아직 안 끝났어\'',
      '5~8마디 = 주제를 한 번 더 — 끝만 바꿔서(파 → 미) 도 화음으로 마쳐요(반복 + 작은 변화)',
      '9~12마디 = 같은 음을 빠르게 되풀이(파파파미) → 두근두근 · 높은 음으로 분위기 바꾸기',
      '13~16마디 = 주제로 돌아와요 · 화음 칸에 3도 아래 음을 놓아 목관(클라리넷)이 함께 불어요',
      '화음은 마디마다 직접 골랐어요(도 · 파 · 솔) · 셈여림 = 점점 크게 · 끝 = 점점 느리게',
    ],
    tryIt: ['가락 악기를 호른이나 바이올린으로 바꿔 보세요', '편성을 \'현악 합주\'로 바꾸면 같은 가락이 어떻게 들리나요?'],
  },
  {
    key: 'fairywaltz', title: '요정 숲의 왈츠', em: '💃', kind: '작곡 · 왈츠', line: '쿵 짝 짝 세 박자 — 플루트와 클라리넷이 둘이서 춤춰요',
    beats: 3, sub: 2, tempo: 132, inst: 'flute', level: 3, reverb: 0.3,
    orch: { on: true, preset: 'waltz', parts: P7(true, true, true, true, true, true, false), dyn: 'arch', rit: true },
    //  긴 음(2박) + 짧은 음(1박) = 왈츠 걸음 · 1~2마디 = 9~10마디(되풀이) · 15~16 시 → 도(이끔음)로 마침
    melody: 'E5/4 G5/2 | C6/4 B5/2 | A5/4 G5/2 | E5/6 |'
          + 'D5/4 F5/2 | B5/4 A5/2 | G5/4 F5/2 | E5/6 |'
          + 'E5/4 G5/2 | C6/4 B5/2 | A5/2 C6/2 A5/2 | G5/6 |'
          + 'F5/4 A5/2 | G5/4 E5/2 | D5/4 B4/2 | C5/6',
    chords: ['I', 'I', 'IV', 'I', 'V', 'V', 'V', 'I', 'I', 'I', 'IV', 'I', 'IV', 'I', 'V', 'I'],
    //  화음 칸(9~12마디) — 가락 아래 3도 · 6도로 나란히(클라리넷 이중주)
    harm: [rests(8, 6) + ' | C5/4 E5/2 | E5/4 G5/2 | F5/2 A5/2 F5/2 | E5/6 | ' + rests(4, 6)],
    notes: [
      '세 박자(3/4) — 첫 박에 긴 음(2박) + 셋째 박에 짧은 음 = 빙글빙글 왈츠 걸음',
      '1~2마디 가락이 9~10마디에 그대로 다시 나와요 → 귀에 쏙 남아요',
      '9~12마디는 화음 칸에 3도 아래 음을 나란히 놓아 클라리넷이 플루트와 이중주',
      '하프 칸을 켜서 화음을 오르내리며 반짝 · 셈여림 = 작게 → 크게 → 작게',
      '마지막 \'시 → 도\'는 집으로 돌아오는 느낌(이끔음)',
    ],
    tryIt: ['편성을 \'동화 나라\'로 바꿔 보세요 — 첼레스타가 가락을 불어요', '빠르기를 120으로 낮추면 어떤 춤이 될까요?'],
  },
  {
    key: 'sportsmarch', title: '운동회 행진곡', em: '🥁', kind: '작곡 · 행진곡', line: '도도도미 솔! 트럼펫 팡파르와 작은북 발걸음',
    beats: 4, sub: 2, tempo: 116, inst: 'trumpet', level: 2, reverb: 0.16,
    orch: { on: true, preset: 'march', parts: P7(false, false, true, true, false, true, true), dyn: 'flat', rit: false },
    //  1 · 3마디 = 같은 리듬 다른 높이(도도도미 솔 / 시시시레 솔) · 8 · 12마디 끝 '솔' = 다음 마디로 들어가는 발걸음
    melody: 'C5/1 C5/1 C5/1 E5/1 G5/4 | E5/3 C5/1 E5/2 G5/2 | B4/1 B4/1 B4/1 D5/1 G5/4 | F5/3 D5/1 B4/2 G4/2 |'
          + 'C5/1 C5/1 C5/1 E5/1 G5/4 | A5/3 G5/1 F5/2 A5/2 | G5/2 F5/2 E5/2 D5/2 | C5/4 R/2 G4/2 |'
          + 'A4/2 C5/2 F5/3 E5/1 | E5/4 C5/2 G4/2 | B4/2 D5/2 G5/3 F5/1 | E5/4 R/2 G4/2 |'
          + 'C5/1 C5/1 C5/1 E5/1 G5/4 | A5/3 G5/1 F5/2 A5/2 | G5/2 F5/2 D5/2 B4/2 | C5/2 G4/2 C5/2 R/2',
    chords: ['I', 'I', 'V', 'V', 'I', 'IV', 'V', 'I', 'IV', 'I', 'V', 'I', 'I', 'IV', 'V', 'I'],
    harm: [],
    notes: [
      '팡파르 = 같은 음을 세 번(도도도) 다음 높이 뛰기(미 솔!)',
      '1마디와 3마디는 리듬이 같고 높이만 달라요(도도도미 → 시시시레) — 따라 부르기 쉬워요',
      '8 · 12마디 끝의 \'솔\'은 다음 마디로 들어가는 준비 발걸음',
      '행진곡은 끝까지 같은 빠르기로 걸어요(점점 느리게 끄기) · 목관은 저절로 3도 아래',
    ],
    tryIt: ['빠르기를 +8 해 보세요 — 더 씩씩해져요', '반짝이 칸을 끄고 켜 보며 글로켄슈필 소리를 찾아보세요'],
  },
];

// 예시 곡 → 곡(작곡 화면 · 듣기 · 연습 · 리듬이 그대로 쓰는 모양) · id = 'ex_<키>' · lib 처럼 다뤄 작곡에서 열면 '바꿔 쓰기' 새 곡이 된다
export function exampleSong(key) {
  const x = EX_SONGS.find(e => e.key === key);
  if (!x) return null;
  const bs = x.beats * x.sub;
  const { notes, bars } = parseMelody(x.melody, bs);
  const harm = (x.harm || []).flatMap(v => parseMelody(v, bs).notes);
  return normalize({
    v: 1, id: 'ex_' + x.key, lib: true, lk: 'ex_' + x.key, title: x.title, origin: EX_BY, level: x.level,
    beats: x.beats, sub: x.sub, bars, tempo: x.tempo, key: 0, scale: 'major', inst: x.inst,
    notes, harm, chords: x.chords, acc: { chord: true, bass: true, drum: 'basic' }, mood: null, reverb: x.reverb, orch: x.orch,
  });
}

// ── 비트 ──  pats = 패턴 A~D(시작 카드와 같은 글자 줄) · arr = 순서(0 = A … 3 = D) · mode 'song' = 이어 붙인 순서대로
export const EX_BEATS = [
  {
    key: 'monsterparty', title: '몬스터 댄스 파티', em: '🕺', kind: '비트 · 전자 북', line: '패턴 넷으로 화음 네 개 — A B A B 다음 C D 로 신나게!',
    grid: '16', bpm: 112, swing: 0, kit: 'elec', lead: 'synth', fill: true, arr: [0, 1, 0, 1, 2, 3, 2, 3], show: [],
    pats: [
      { d: { kick: 'X... .... X.x. ....', snare: '.... X... .... X...', hatc: 'x.x. x.x. x.x. x.x.', hato: '.... .... .... ..x.' },
        b: '0... ..0. 3... ..3.', c: ['I', null, 'V', null], cs: 'oom', m: '2.23 ..2. 1..0 1.x.' },          // 미 미솔 · 미 | 레 · 도 레 (도 → 솔 화음)
      { d: { kick: 'X... .... X.x. ....', snare: '.... X... .... X...', hatc: 'x.x. x.x. x.x. x.x.', hato: '.... .... .... ..x.' },
        b: '4... ..4. 0... ..0.', c: ['vi', null, 'IV', null], cs: 'oom', m: '4.45 ..4. 4..3 2.x.' },          // 라 라높은도 · 라 | 라 · 솔 미 (라 → 파 화음 · 미로 내려와 A 로)
      { d: { kick: 'X... ..x. X.x. ....', snare: '.... X... .... X...', clap: '.... X... .... X...', hatc: 'x... x... x... x...', hato: '..x. ..x. ..x. ..x.' },
        b: '0.0. ..0. 3.3. ..3.', c: ['I', null, 'V', null], cs: 'oom', m: '7.76 ..5. 6..5 6.x.' },          // A 를 복사 → 가락을 높게 + 박수 · 치이
      { d: { kick: 'X... ..x. X.x. ....', snare: '.... X... .... X...', clap: '.... X... .... X...', hatc: 'x... x... x... x...', hato: '..x. ..x. ..x. ..x.' },
        b: '4.4. ..4. 0.0. ..0.', c: ['vi', null, 'IV', null], cs: 'oom', m: '5.57 ..7. 5..4 3...' },          // 높은 도 높은 미 | 높은 도 · 라 솔 — 솔로 끝나 다시 A 로
    ],
    notes: [
      '패턴 하나에 화음 둘 — A(도 → 솔) + B(라 → 파) = 화음 네 개짜리 두 마디가 돼요',
      'C 는 A 를 복사해서 가락만 높게 바꾸고 박수 · 치이(엇박)를 더했어요 — D 는 B 를 같은 방법으로',
      '순서 = A B A B C D C D — 네 마디 반복하고, 바뀐 네 마디',
      '\'4번째 반복마다 살짝 바꾸기\'를 켜서 네 마디 끝마다 북이 굴러요(필인)',
    ],
    tryIt: ['C 를 고르고 아이디어 → \'메아리 ⤵\'를 눌러 보세요', '가락 악기를 글로켄으로 바꿔 보세요'],
  },
  {
    key: 'rainyday', title: '비 오는 날 숙제', em: '🌧️', kind: '비트 · 진짜 북', line: '통통 튀는 피아노 비트 — 잠깐 북이 멈췄다가 다시!',
    grid: '16', bpm: 84, swing: 33, kit: 'real', lead: 'piano', fill: false, arr: [0, 1, 0, 1, 2, 2, 0, 3], show: [],
    pats: [
      { d: { kick: 'X... .... ..x. ....', snare: '.... X... .... X...', hatc: 'x.x. x.x. x.x. x.x.' },
        b: '4... .... 0... ....', c: ['vi', null, 'IV', null], cs: 'long', m: '5..4 ..2. 4... ..x.' },          // 높은 도 라 미 | 라 —
      { d: { kick: 'X... .... ..x. ....', snare: '.... X... .... X...', hatc: 'x.x. x.x. x.x. x.x.' },
        b: '0... .... 3... ....', c: ['I', null, 'V', null], cs: 'long', m: '3..2 ..0. 1... ..x.' },          // 솔 미 도 | 레 —
      { d: {}, b: '4... .... 0... ....', c: ['vi', null, 'IV', null], cs: 'long', m: '7... 6... 5... 4...' },   // 북 없음 — 높은 미 레 도 라
      { d: { kick: 'X... ..x. ..x. ....', snare: '.... X... .... X..x', hatc: 'x.xx x.xx x.xx x.xx' },
        b: '0..0 ..0. 3..3 ..3.', c: ['I', null, 'V', null], cs: 'long', m: '3..2 ..0. 1... 3.x.' },          // 다시 들어온 북 — 칙을 더 잘게
    ],
    notes: [
      '진짜 북 + 피아노 · 통통 튀는 정도 33% — 둘째 칸이 살짝 늦게 와서 걸음이 통통 튀어요',
      'C 는 북을 다 뺐어요 — 잠깐 비가 그친 것처럼. 빼는 것도 비트예요!',
      'D 에서 북이 돌아올 때 칙을 더 잘게(x.xx) · 짝 앞에 작은 짝 하나 더',
      '순서 = A B A B C C A D — 두 마디씩 짝을 지어 이어 붙였어요',
    ],
    tryIt: ['통통 튀는 정도를 0% 로 바꿔 보세요 — 느낌이 어떻게 달라지나요?', 'C 에 칙만 다시 넣어 보세요'],
  },
  {
    key: 'janggu', title: '장구 신나라', em: '🪘', kind: '비트 · 우리 장단', line: '굿거리 장단 위에 대금 가락 — 꽹과리로 신나게!',
    grid: '12', bpm: 76, swing: 0, kit: 'kor', lead: 'daegeum', fill: true, arr: [0, 1, 0, 1, 2, 3, 2, 3], show: ['shaker', 'cymbal'],
    pats: [
      { d: { kick: 'X.. ... ... ...', clap: 'X.. ... ... ...', tom: '..X ... ..X ...', shaker: '... X.. X.. X..', cymbal: '... ..x ... ..x', hato: 'x.. ... ... ...' },
        b: '0.. ... ... ...', c: [null, null, null, null], cs: 'long', m: '3.. 4.3 5.. 4..' },                // 솔 — 라 솔 | 높은 도 — 라 —
      { d: { kick: 'X.. ... ... ...', clap: 'X.. ... ... ...', tom: '..X ... ..X ...', shaker: '... X.. X.. X..', cymbal: '... ..x ... ..x' },
        b: '0.. ... ... ...', c: [null, null, null, null], cs: 'long', m: '3.4 3.2 0.. ...' },                // 솔 라 솔 미 | 도 — — —
      { d: { kick: 'X.. ... X.. ...', clap: 'X.. ... ... ...', tom: '..X ... ..X ...', shaker: '... X.. ... X..', cymbal: '... ..x ... ..x', hatc: 'X.x x.x X.x x.x', hato: 'x.. ... ... ...' },
        b: '0.. ... 3.. ...', c: [null, null, null, null], cs: 'long', m: '5.. 6.5 7.. 6..' },                // 꽹과리 + 높은 가락
      { d: { kick: 'X.. ... X.. ...', clap: 'X.. ... ... ...', tom: '..X ... ..X ...', shaker: '... X.. ... X..', cymbal: '... ..x ..x ..x', hatc: 'X.x x.x X.x X..' },
        b: '0.. ... 3.. ...', c: [null, null, null, null], cs: 'long', m: '5.6 5.4 3.. ...' },                // 높은 도 높은 레 높은 도 라 | 솔 —
    ],
    notes: [
      '굿거리 장단(덩 · 기덕 | 쿵 · 더러러러 | 쿵 · 기덕 | 쿵 · 더러러러) — 한 박이 세 칸(12칸)',
      '화음 없이 베이스 \'도\'만 길게 — 우리 음악은 화음 대신 가락과 장단으로 끌고 가요',
      'A · B = 대금이 묻고 대답하기(솔 라 솔 높은 도 … → … 미 도)',
      'C · D 는 꽹과리를 더하고 가락을 높여 신나게 — 4번째 반복마다 장구가 굴러요',
    ],
    tryIt: ['가락 악기를 가야금으로 바꿔 보세요', 'C 의 꽹과리를 지우고 들어 보세요 — 무엇이 달라지나요?'],
  },
];
