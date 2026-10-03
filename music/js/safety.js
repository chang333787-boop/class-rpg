// 고운 말 거르기 — 우리 반 음악회(반 친구 모두가 보는 곳)에 올리는 곡 제목·노랫말.
//  띄어쓰기·숫자·기호를 끼워 넣어도 찾고(씨 1 발 → 씨발), 흔한 낱말 속 우연한 겹침은 먼저 빼 둔다(시발점·시바견·불이 꺼져 등).
//  일부러 넣지 않은 것: '새끼'(새끼 고양이) · '보지·자지'(보지 마·자지 마) · '꺼져'(불이 꺼져) · '죽어'(꽃이 죽어요) · '미친'(영향을 미친).
//  막는 곳은 '올리기'뿐 — 나만 보는 곡은 저장된다. 선생님은 선생님 화면에서 표시를 본다.
const BAD = [
  '씨발', '시발', '씨팔', '시팔', '씨바', '시바', '씹', 'ㅅㅂ', 'ㅆㅂ', '병신', '븅신', '빙신', 'ㅂㅅ', '개새끼', '개새기', '개색기', '개세끼', '개쉐',
  '지랄', 'ㅈㄹ', '좆', '존나', '졸라', 'ㅈㄴ', '닥쳐', '엿먹', '엠창', '니애미', '니미', '느금', '염병', '쌍놈', '쌍년', '또라이', '등신', '찐따',
  '미친놈', '미친년', '미친새끼', 'ㅁㅊ', '죽여', '죽일', '뒤져', '뒈져', '섹스', '야동', '자위', '성교',
  'fuck', 'shit', 'bitch', 'porn', 'sex', 'dick', 'pussy',
];
const ALLOW = ['시발점', '시발역', '시바견', '시바이누', '씹고', '씹어', '씹는', '씹으'];
const norm = s => String(s || '').toLowerCase().replace(/[\s\d\p{P}\p{S}_]+/gu, '');

// 찾은 낱말 목록(없으면 빈 배열)
export function badWords(text) {
  let t = norm(text);
  for (const a of ALLOW) t = t.split(a).join('');
  return BAD.filter(w => t.includes(w));
}
// 곡에서 올리면 안 되는 곳 — { title: [...], lyrics: [...] }
export function songBad(song) {
  const lyrics = [...(song.notes || [])].sort((a, z) => a.s - z.s).map(n => n.w || '').join('');
  return { title: badWords(song.title), lyrics: badWords(lyrics) };
}
export const hidden = w => w.length <= 1 ? '*' : w[0] + '*'.repeat(w.length - 1);
