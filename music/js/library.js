// 미리 넣어 둔 곡 — 모두 저작권이 끝난 옛 가락(외국 민요·고전). 가사는 넣지 않는다(계이름만).
//  적는 법: 마디는 |, 음은 '음이름/칸 수'. R = 쉼표. 한 칸 = sub 에 따라 8분음표(2·3) 또는 16분음표(4).
//  예) 'G4/1 E4/1 E4/2' = 솔(8분) 미(8분) 미(4분)
//  나비야 = 독일 민요 'Hänschen klein' 가락(일본 '蝶々'를 거쳐 들어온 우리 동요). 계이름은 동요 계이름 모음 두 곳과 대조.

export const LIBRARY = [
  {
    key: 'nabiya', title: '나비야', origin: '독일 민요', level: 1, beats: 2, sub: 2, tempo: 96, scale: 'major', inst: 'recorder',
    melody: 'G4/1 E4/1 E4/2 | F4/1 D4/1 D4/2 | C4/1 D4/1 E4/1 F4/1 | G4/1 G4/1 G4/2 |'
          + 'G4/1 E4/1 E4/1 E4/1 | F4/1 D4/1 D4/2 | C4/1 E4/1 G4/1 G4/1 | E4/1 E4/1 E4/2 |'
          + 'D4/1 D4/1 D4/1 D4/1 | D4/1 E4/1 F4/2 | E4/1 E4/1 E4/1 E4/1 | E4/1 F4/1 G4/2 |'
          + 'G4/1 E4/1 E4/2 | F4/1 D4/1 D4/2 | C4/1 E4/1 G4/1 G4/1 | E4/1 E4/1 E4/2',
  },
  {
    key: 'star', title: '작은 별', origin: '프랑스 민요', level: 1, beats: 4, sub: 2, tempo: 92, scale: 'major', inst: 'xylo',
    melody: 'C4/2 C4/2 G4/2 G4/2 | A4/2 A4/2 G4/4 | F4/2 F4/2 E4/2 E4/2 | D4/2 D4/2 C4/4 |'
          + 'G4/2 G4/2 F4/2 F4/2 | E4/2 E4/2 D4/4 | G4/2 G4/2 F4/2 F4/2 | E4/2 E4/2 D4/4 |'
          + 'C4/2 C4/2 G4/2 G4/2 | A4/2 A4/2 G4/4 | F4/2 F4/2 E4/2 E4/2 | D4/2 D4/2 C4/4',
  },
  {
    key: 'airplane', title: '비행기', origin: '미국 민요', level: 1, beats: 4, sub: 2, tempo: 100, scale: 'major', inst: 'piano',
    melody: 'E4/2 D4/2 C4/2 D4/2 | E4/2 E4/2 E4/4 | D4/2 D4/2 D4/4 | E4/2 G4/2 G4/4 |'
          + 'E4/2 D4/2 C4/2 D4/2 | E4/2 E4/2 E4/4 | D4/2 D4/2 E4/2 D4/2 | C4/8',
  },
  {
    key: 'london', title: '런던 다리', origin: '영국 민요', level: 2, beats: 4, sub: 2, tempo: 100, scale: 'major', inst: 'marimba',
    melody: 'G4/3 A4/1 G4/2 F4/2 | E4/2 F4/2 G4/4 | D4/2 E4/2 F4/4 | E4/2 F4/2 G4/4 |'
          + 'G4/3 A4/1 G4/2 F4/2 | E4/2 F4/2 G4/4 | D4/4 G4/4 | E4/2 C4/6',
  },
  {
    key: 'joy', title: '환희의 송가', origin: '베토벤', level: 2, beats: 4, sub: 2, tempo: 104, key2: 7, scale: 'major', inst: 'recorder',
    // 사장조(솔 시작)로 — 리코더 왼손 음(솔·라·시·도·레) 위주라 처음 배우는 아이에게 맞다
    melody: 'B4/2 B4/2 C5/2 D5/2 | D5/2 C5/2 B4/2 A4/2 | G4/2 G4/2 A4/2 B4/2 | B4/3 A4/1 A4/4 |'
          + 'B4/2 B4/2 C5/2 D5/2 | D5/2 C5/2 B4/2 A4/2 | G4/2 G4/2 A4/2 B4/2 | A4/3 G4/1 G4/4 |'
          + 'A4/2 A4/2 B4/2 G4/2 | A4/2 B4/1 C5/1 B4/2 G4/2 | A4/2 B4/1 C5/1 B4/2 A4/2 | G4/2 A4/2 D4/4 |'
          + 'B4/2 B4/2 C5/2 D5/2 | D5/2 C5/2 B4/2 A4/2 | G4/2 G4/2 A4/2 B4/2 | A4/3 G4/1 G4/4',
  },
  {
    key: 'jingle', title: '징글벨', origin: '미국 캐럴', level: 2, beats: 4, sub: 2, tempo: 116, scale: 'major', inst: 'xylo',
    melody: 'E4/2 E4/2 E4/4 | E4/2 E4/2 E4/4 | E4/2 G4/2 C4/3 D4/1 | E4/8 |'
          + 'F4/2 F4/2 F4/3 F4/1 | F4/2 E4/2 E4/2 E4/1 E4/1 | E4/2 D4/2 D4/2 E4/2 | D4/4 G4/4 |'
          + 'E4/2 E4/2 E4/4 | E4/2 E4/2 E4/4 | E4/2 G4/2 C4/3 D4/1 | E4/8 |'
          + 'F4/2 F4/2 F4/3 F4/1 | F4/2 E4/2 E4/2 E4/1 E4/1 | G4/2 G4/2 F4/2 D4/2 | C4/8',
  },
  {
    key: 'birthday', title: '생일 축하 노래', origin: '미국 노래', level: 3, beats: 3, sub: 2, tempo: 100, scale: 'major', inst: 'piano',
    // 첫 마디는 못갖춘마디라 앞을 쉼표로 채웠다(솔솔이 셋째 박)
    melody: 'R/4 G4/1 G4/1 | A4/2 G4/2 C5/2 | B4/4 G4/1 G4/1 | A4/2 G4/2 D5/2 | C5/4 G4/1 G4/1 |'
          + 'G5/2 E5/2 C5/2 | B4/2 A4/2 F5/1 F5/1 | E5/2 C5/2 D5/2 | C5/6',
  },
  // ── 리코더 첫걸음 연습곡(직접 지은 짧은 가락) ──
  {
    key: 'sola', title: '솔·라·시 연습', origin: '연습곡', level: 0, beats: 4, sub: 2, tempo: 80, scale: 'major', inst: 'recorder', practice: true,
    melody: 'B4/2 A4/2 G4/4 | B4/2 A4/2 G4/4 | G4/2 G4/2 A4/2 A4/2 | B4/2 A4/2 G4/4',
  },
  {
    key: 'dore', title: '도·레·미 연습', origin: '연습곡', level: 0, beats: 4, sub: 2, tempo: 80, scale: 'major', inst: 'recorder', practice: true,
    melody: 'C4/2 D4/2 E4/4 | E4/2 D4/2 C4/4 | C4/2 E4/2 D4/2 C4/2 | D4/2 E4/2 C4/4',
  },
];
