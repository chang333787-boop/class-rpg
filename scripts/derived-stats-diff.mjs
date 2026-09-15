#!/usr/bin/env node
// scripts/derived-stats-diff.mjs — 직업·전투 능력치 저장값 vs 파생값 대조표 (읽기만 · Firebase 쓰기 0)   [DERIVED-JOB-COMBAT-1]
//
// 왜: DERIVED-JOB-COMBAT-1 은 화면·전투가 저장값(job·combat) 대신 Utils.jobOf·combatOf 로 계산한다.
//     바뀌는 학생이 누구인지(몇 명·어느 칸) 머지 전·후에 표로 확인한다. 이름·꿈 글자는 출력하지 않는다.
//
// 쓰는 법
//   node scripts/derived-stats-diff.mjs                                   → 운영 GET(students·settings)
//   node scripts/derived-stats-diff.mjs --db http://127.0.0.1:9000 --ns demo   (에뮬레이터)
// 하지 않는 일: PUT/PATCH/DELETE 없음.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROD = 'https://class-rpg-6f409-default-rtdb.asia-southeast1.firebasedatabase.app';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.concat([[v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]]) : a), []));
const db = String(args.db || PROD).replace(/\/+$/, '');
const ns = args.ns ? '?ns=' + encodeURIComponent(args.ns) : '';

async function main() {
  const get = async (p) => { const r = await fetch(`${db}/classRPG_v3/${p}.json${ns}`); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); };   // GET 만
  const [raw, settings] = await Promise.all([get('students'), get('settings')]);
  const sb = { console: { log() {}, warn() {}, error() {} }, window: {}, setTimeout, document: { getElementById: () => null, querySelectorAll: () => [] }, localStorage: { getItem: () => null, setItem() {} }, alert() {} };
  sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gamedata.js'), 'utf8') + ';globalThis.__g = { Utils, applyShopOverrides, applyBattleSettings };', sb);
  const { Utils, applyShopOverrides, applyBattleSettings } = sb.__g;
  applyShopOverrides({ settings: settings || {} }); applyBattleSettings({ settings: settings || {} });   // 운영과 같은 장비 덮어쓰기
  if (typeof Utils.jobOf !== 'function') { console.error('이 gamedata.js 에는 Utils.jobOf 가 없음(DERIVED-JOB-COMBAT-1 전)'); return 1; }

  const byId = {};
  for (const k of Object.keys(raw || {})) { const s = raw[k]; if (!s || !s.id) continue; if (!/^\d+$/.test(k) || !byId[s.id]) byId[s.id] = s; }   // id 키 우선
  const f = (c) => ['atk', 'def', 'mag', 'spd'].map(k => (c && c[k]) || 0).join('/');
  let i = 0, jobDiff = 0, combatDiff = 0;
  console.log('학생 | Lv | 직업 같음 | 저장 직업 → 파생(꿈 글자는 <꿈>) | 전투 저장 → 파생(atk/def/mag/spd)');
  for (const s of Object.values(byId)) {
    i++;
    const d = (s.dream || '').trim();
    const mask = (j) => (j ? (d ? String(j).split(d).join('<꿈>') : String(j)) : '(없음)');
    const jd = Utils.jobOf(s), cs = f(s.combat), cd = f(Utils.combatOf(s));
    const js = (s.job || '') === jd; if (!js) jobDiff++; if (cs !== cd) combatDiff++;
    console.log(`학생${i} | ${s.level} | ${js ? '예' : '아니오'} | ${mask(s.job)} → ${mask(jd)} | ${cs === cd ? '같음 ' + cs : cs + ' → ' + cd}`);
  }
  console.log(`\n${i}명 · 직업 달라지는 학생 ${jobDiff} · 전투 달라지는 학생 ${combatDiff} · 쓰기 0`);
  return 0;
}
main().then(c => { process.exitCode = c; }, e => { console.error('실패: ' + e.message); process.exitCode = 1; });
