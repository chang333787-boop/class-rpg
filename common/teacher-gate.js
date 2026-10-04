// 선생님 화면 문 — 하위 앱 공통 [SUBAPP-COMMON-1]
//  명화 탐정 · 기초 코딩 · 먹 연구소 · 음악실 · 물감 연구소 · 무늬 공방 · 판화 놀이의 teacher.js 가 같은 꼴로 쓰던 것을 모았다(생각판은 문 모양이 달라 app.js 에 따로).
//  · 손님(이 기기에만 저장)이면 바로 연다 — 볼 것은 이 기기 기록뿐
//  · 이 창에서 한 번 통과했으면 바로 — sessionStorage[key] = '1'(관리 화면이 학습 앱을 열 때 미리 세워 둔다). key 는 앱마다 '<앱>.teacher' 그대로
//  · 아니면 관리자 비밀번호를 묻고 store.teacherOK(pw) 로 확인(→ common/rpg-firebase.js adminPwOK)
import { toast } from './util.js';

export async function teacherGate(ctx, key) {
  if (ctx.store.me.guest) return true;
  try { if (sessionStorage.getItem(key) === '1') return true; } catch {}
  const pw = prompt('선생님 화면이에요. 관리자 비밀번호를 넣어 주세요');
  if (!pw) return false;
  try { if (await ctx.store.teacherOK(pw)) { try { sessionStorage.setItem(key, '1'); } catch {} return true; } } catch (e) { console.warn(e); }
  toast('비밀번호가 맞지 않아요');
  return false;
}
