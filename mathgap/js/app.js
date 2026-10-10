// 오늘의 수학 — 탑에 불을 켜며 수학 빈칸을 채우는 하루 10분(학급 RPG 학습 앱)
//  RPG 안(?sid=&n=)에서 열면 내 기록으로(classRPG_mathgap), 아니면 손님(이 기기에만). 선생님 = ?teacher=1 또는 #/t
//  흐름 = today.js(시험 scripts/unit/mathgap/today.test.mjs) · 아이 화면 = kid.js · 선생님 = teacher.js · 수학 핵심(차시 229 · 진단 엔진) = js/core(수학 빈칸 찾기에서 옮김)
import { h } from './util.js';
import { createStore } from './store.js';
import { mountKid } from './kid.js';
import { mountTeacher } from './teacher.js';

const Q = new URLSearchParams(location.search);
const TEACHER = Q.has('teacher') || location.hash.startsWith('#/t');
const store = createStore({ sid: Q.get('sid') || (TEACHER ? 'teacher' : ''), name: TEACHER ? '선생님' : (Q.get('n') || '').slice(0, 20) });
const app = document.getElementById('app');
const late = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('늦음')), ms))]);

async function start() {
  app.replaceChildren(h('div', { class: 'kcenter' }, h('div', { class: 'mid-t muted' }, '탑을 불러오는 중…')));
  if (TEACHER) return mountTeacher(app, { store });
  try {
    const [cfg, kid] = await late(Promise.all([store.config(), store.kid()]), 8000);
    mountKid(app, { store, cfg, kid });
  } catch (e) {
    console.warn('[mathgap] 불러오기 실패', e);
    app.replaceChildren(h('div', { class: 'kcenter' }, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' } },
      h('div', { class: 'mid-t' }, '탑을 불러오지 못했어요'), h('p', { class: 'lead' }, '인터넷이 잘 되는지 보고 다시 눌러 주세요.'),
      h('button', { class: 'kbtn', onclick: start }, '다시 불러오기'))));
  }
}
start();
