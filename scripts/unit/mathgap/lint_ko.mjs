// 한국어 글 검사기(10-11 교사 '비문 · 맞춤법 · 어순까지 검열') — 기계로 잡을 수 있는 것은 모두 여기서 잡는다
//   ① 수 · 단위 뒤 조사(받침 맞춤 — 3/4은 · 24예요 · 2 m를 · 5 kg을) ② 아는 낱말 뒤 조사 ③ 띄어쓰기(1 m · 3개 · 할 수 있다 · 문장부호)
//   ④ 자주 틀리는 맞춤법 ⑤ 같은 말 되풀이 ⑥ 빈 값(undefined · NaN)
//   사람 교정 읽기(QUALITY.md)가 못 보는 것을 남기지 않도록, 새 글 틀을 만들면 이 검사를 통과해야 한다.
const DIGIT_BAT = [true, true, false, true, false, false, true, true, true, false];   // 영 일 이 삼 사 오 육 칠 팔 구
const DIGIT_RIEUL = [false, true, false, false, false, false, false, true, true, false];
// 수 글자(정수 · 소수 · 분수 · 대분수)를 소리 내어 읽을 때 마지막 소리 — 분수는 분자를 마지막에 읽음
export function numSound(t) {
  let s = String(t).trim();
  if (s.includes('/')) s = s.slice(0, s.indexOf('/'));
  s = s.split(' ').pop();
  if (s.includes('.')) { const d = s.split('.')[1]; const k = Number(d[d.length - 1]); return { bat: DIGIT_BAT[k], rieul: DIGIT_RIEUL[k] }; }
  const n = s.replace(/^0+(?=\d)/, '');
  const last = Number(n[n.length - 1]);
  if (last) return { bat: DIGIT_BAT[last], rieul: DIGIT_RIEUL[last] };
  return { bat: true, rieul: false };   // 십 · 백 · 천 · 만 · 영 — 모두 받침
}
// 로마자 단위를 읽은 소리
const UNIT_SOUND = { m: { bat: false }, cm: { bat: false }, mm: { bat: false }, km: { bat: false }, L: { bat: false }, mL: { bat: false }, kg: { bat: true }, g: { bat: true }, t: { bat: false }, '%': { bat: false } };
export function hangulSound(ch) {
  const h = ch.charCodeAt(0) - 0xac00;
  if (h < 0 || h > 11171) return null;
  const jong = h % 28;
  return { bat: jong > 0, rieul: jong === 8 };
}
// 조사 짝 — [받침 있을 때, 없을 때]
const PAIRS = [['이었', '였'], ['이에요', '예요'], ['으로', '로'], ['과', '와'], ['은', '는'], ['을', '를'], ['이', '가'], ['이나', '나'], ['이면', '면'], ['이고', '고'], ['이라', '라']];
// 조사가 맞는지(소리 → 조사)
function particleOk(sound, p) {
  for (const [w, wo] of PAIRS) {
    if (p !== w && p !== wo) continue;
    if (w === '으로') return p === (sound.bat && !sound.rieul ? '으로' : '로');
    if (w === '이면' || w === '이고' || w === '이라') return p === w || !sound.bat;   // 받침 없을 때 '이고 · 이면'도 표준(빼도 됨)
    return p === (sound.bat ? w : wo);
  }
  return true;
}
// 수(+ 단위) 뒤에 바로 붙은 조사 — '3/4은' · '24이에요' · '2 m를' · '5 kg을'
const NUMRE = /(\d+ \d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)( ?(?:mL|km|cm|mm|kg|m|L|g|%))?(이었|였|이에요|예요|으로|로|과|와|은|는|을|를|이|가)(?![가-힣])/g;
export function lintKo(text, { nouns = [] } = {}) {
  const out = [], t = String(text);
  if (/undefined|NaN|null|\[object/.test(t)) out.push(`빈 값: ${t}`);
  // ① 수 · 단위 뒤 조사
  for (const m of t.matchAll(NUMRE)) {
    const sound = m[2] ? UNIT_SOUND[m[2].trim()] : numSound(m[1]);
    if (sound && !particleOk(sound, m[3])) out.push(`조사: '${m[0]}'`);
  }
  // ② 아는 낱말 뒤 조사
  for (const w of nouns) {
    const re = new RegExp(`${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(이었|였|이에요|예요|으로|로|과|와|은|는|을|를|이|가)(?![가-힣])`, 'g');
    for (const m of t.matchAll(re)) {
      const prev = t[m.index - 1];
      if (prev && /[가-힣]/.test(prev)) continue;   // 더 긴 낱말의 끝(사과 ⊂ 개사과)
      const s = hangulSound(w[w.length - 1]);
      if (s && !particleOk(s, m[1])) out.push(`조사: '${m[0]}'`);
    }
  }
  // ③ 띄어쓰기
  if (/ {2,}/.test(t)) out.push('띄어쓰기: 빈칸 두 개');
  if (/ [.,?!]/.test(t)) out.push('띄어쓰기: 문장부호 앞 빈칸');
  if (/[.?!,][가-힣0-9]/.test(t.replace(/\d[.,]\d/g, ''))) out.push('띄어쓰기: 문장부호 뒤 빈칸 없음');
  for (const m of t.matchAll(/(\d)(mL|km|cm|mm|kg|m|L)(?![a-zA-Z])/g)) out.push(`띄어쓰기: '${m[0]}' → 수와 단위 사이를 띄워요`);
  for (const m of t.matchAll(/\d (개|권|장|자루|명|봉지|상자|묶음|송이|원|번|쪽|컵|병|도막|걸음|줄|층|반|모둠|살|시간|분|초|일|배)(?![가-힣])(?! 수)/g)) out.push(`띄어쓰기: '${m[0]}' → 수와 한글 단위는 붙여요`);
  if (/(할|볼|갈|살|풀|쓸|읽을|담을|꽂을|가질|알|셀|잴|나눌|먹을|만들)수(?!록)/.test(t)) out.push("띄어쓰기: '할수' → '할 수'");
  if (/수있|수없/.test(t)) out.push("띄어쓰기: '수있다' → '수 있다'");
  if (/것같/.test(t)) out.push("띄어쓰기: '것같다' → '것 같다'");
  // ④ 자주 틀리는 맞춤법
  const SPELL = [[/몇일(?!까)/, '며칠'], ['되요', '돼요'], ['안되', '안 되'], ['할께', '할게'], ['볼께', '볼게'], ['줄께', '줄게'], ['갈께', '갈게'], ['드릴께', '드릴게'], ['갯수', '개수'], ['웬지', '왠지'], ['어떻해', '어떡해'], ['금새', '금세'], ['오랫만', '오랜만'], ['일일히', '일일이'], ['깨끗히', '깨끗이'], ['곰곰히', '곰곰이'], ['틈틈히', '틈틈이'], ['설겆이', '설거지'], ['희안', '희한'], ['역활', '역할'], ['몇칠', '며칠'], ['뵈요', '봬요'], ['되서', '돼서'], ['됬', '됐'], ['않되', '안 되'], ['구지', '굳이'], ['어의없', '어이없'], ['떡볶기', '떡볶이'], ['문안하', '무난하'], ['낳았어요', '나았어요'], ['맞추어 보', '맞혀 보'], ['정답을 맞추', '정답을 맞히']];
  for (const [bad, good] of SPELL) if (bad instanceof RegExp ? bad.test(t) : t.includes(bad)) out.push(`맞춤법: '${bad instanceof RegExp ? bad.source.replace(/\(.*\)/, '') : bad}' → '${good}'`);
  // ⑤ 같은 말 되풀이 — 같은 어절이 바로 이어짐 · 두 어절 묶음이 세 번 이상
  const words = t.split(/\s+/).filter(Boolean);
  for (let i = 1; i < words.length; i++) if (words[i] === words[i - 1] && /[가-힣]{2,}/.test(words[i])) out.push(`되풀이: '${words[i]} ${words[i]}'`);
  const pairs = {};
  for (let i = 1; i < words.length; i++) { const k = `${words[i - 1]} ${words[i]}`.replace(/[.,?!]/g, ''); if (/[가-힣]{2,}/.test(k) && !/\d/.test(k)) pairs[k] = (pairs[k] || 0) + 1; }
  for (const [k, n] of Object.entries(pairs)) if (n >= 3) out.push(`되풀이: '${k}' ${n}번`);
  return out;
}
