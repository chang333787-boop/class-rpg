// ⬛ 네모로(DECO-FLOOR-RECT-1) — 진짜 터치(CDP Input.dispatchTouchEvent)로 잰다. 놀이판(운영 DB 미접속)을 띄워 쓴다.
//  사용: node scripts/unit/deco-save-count/touch-rect.mjs [1366x610]   → 단계별 상태 JSON + 사진(임시 폴더)
//  ① 한 손가락 끌기 = 네모(끄는 동안 안 칠함 · 떼면 한꺼번에 · 저장 1번) ② ↩ 한 번 = 통째 ③ 상한 400 ④ 두 손가락 = 화면(안 칠함) ⑤ 한 번 누름 = 한 칸 ⑥ 끌어서로 돌아가기
import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
const HERE=path.dirname(fileURLToPath(import.meta.url)), WT=path.resolve(HERE,'..','..','..');
const OUT=path.join(os.tmpdir(),'deco_touch_rect'); fs.mkdirSync(OUT,{recursive:true});
const [W,H]=(process.argv.slice(2).find(a=>/^\d+x\d+$/.test(a))||'1366x610').split('x').map(Number);
//  [DECO-GPU-1] 그래픽칩으로 그린다 — 맥은 Metal(--use-angle=metal --use-gl=angle · 보스 09-24). 크롬북도 GPU 가 있어 이쪽이 실제에 가깝다.
//  그래픽칩이 없는 기기만 --soft(옛 --disable-gpu). 맥이 아니면 브라우저 기본값.
const GPU_ARGS=process.argv.includes('--soft')?['--disable-gpu']:process.platform==='darwin'?['--use-angle=metal','--use-gl=angle']:[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const pp=await freePort(); const play=spawn(process.execPath,[path.join(WT,'scripts/unit/deco-save-count/play.mjs'),String(pp)],{stdio:'ignore',env:{...process.env}}); await sleep(700);
const prof=fs.mkdtempSync(path.join(os.tmpdir(),'trect_')); const dbg=await freePort();
const BROWSER=process.env.BROWSER||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const ch=spawn(BROWSER,['--headless=new',...GPU_ARGS,'--no-first-run',`--remote-debugging-port=${dbg}`,`--user-data-dir=${prof}`,`--window-size=${W},${H}`,'about:blank'],{stdio:'ignore'});
const res={};
try{ let t; for(let i=0;i<60;i++){await sleep(150);try{t=await(await fetch(`http://127.0.0.1:${dbg}/json`)).json();if(t.length)break;}catch(e){}}
const ws=new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.addEventListener('open',r));
let id=0;const pend=new Map(); const exc=[]; ws.addEventListener('message',m=>{const d=JSON.parse(m.data);if(d.id&&pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id);} if(d.method==='Runtime.exceptionThrown')exc.push(JSON.stringify(d.params.exceptionDetails).slice(0,300));});
const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,500));return r.result.result.value;};
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:true}); await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate',{url:`http://127.0.0.1:${pp}/student.html`});
for(let i=0;i<400;i++){await sleep(100);try{if(await ev(`typeof CUR!=='undefined'&&!!CUR&&!!document.querySelector('[onclick*="openHouseTab"]')`))break;}catch(e){}}
await sleep(800);
await ev(`(async()=>{openHouseTab('deco');openInteriorFullscreen();await new Promise(r=>setTimeout(r,1200));
  CUR.houseDecorations=[]; CUR.yardFloor={}; window.__saves=0; const o=DB.saveStudent; DB.saveStudent=function(){window.__saves++; return o.apply(this,arguments);};
  setDecoMode('floor'); ifSyncModeBtn(); await new Promise(r=>setTimeout(r,300));
  const pk=document.getElementById('if-floor-picker'); [...pk.querySelectorAll('.pk-chip')].find(b=>b.textContent==='튤립').click();
  pk.querySelector('.pk-dot[data-col="red"]').click(); pk.querySelector('.pk-seg-b[data-v="rect"]').click(); decoZoomFit(); await new Promise(r=>setTimeout(r,500)); })()`);
const pt=async(r,c)=>JSON.parse(await ev(`(()=>{const cv=document.querySelector('#if-topview canvas'),R=cv.getBoundingClientRect(),C=_dC;return JSON.stringify({x:R.left+((${c}+.5)*C-_dPanX)*R.width/_dW,y:R.top+((${r}+.5)*C-_dPanY)*R.height/_dH});})()`));
const touch=(type,points)=>send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({x:p.x,y:p.y,id:i,radiusX:4,radiusY:4,force:1}))});
const shot=async n=>{const r=await send('Page.captureScreenshot',{format:'jpeg',quality:85});fs.writeFileSync(path.join(OUT,`${n}_${W}x${H}.jpg`),Buffer.from(r.result.data,'base64'));};
const state=async()=>JSON.parse(await ev(`JSON.stringify({tool:DECO_FLOOR_TOOL, tile:CUR_FLOOR_TILE, keys:Object.keys(_yardFloorGet(CUR)).length, vals:[...new Set(Object.values(_yardFloorGet(CUR)))], undo:_decoUndo.length, saves:window.__saves, zoom:_dZoom, prev:!!_decoRectPrev, tip:(document.getElementById('if-rect-tip')||{}).textContent||'', tipShown:!!document.getElementById('if-rect-tip')&&!document.getElementById('if-rect-tip').hidden})`));
// ① 한 손가락 끌기 = 네모 (3,3)→(8,14)
const a=await pt(8,3), b=await pt(13,14);
await touch('touchStart',[a]); await sleep(60);
for(let i=1;i<=10;i++){ await touch('touchMove',[{x:a.x+(b.x-a.x)*i/10,y:a.y+(b.y-a.y)*i/10}]); await sleep(40); }
await sleep(250); res.끄는중=await state(); await shot('1_dragging');
await touch('touchEnd',[]); await sleep(700); res.뗀뒤=await state(); await shot('2_released');
// ② ↩ 한 번 = 네모 통째
await ev(`decoUndo()`); await sleep(600); res.되돌림=await state();
// ③ 상한 — 판 끝에서 끝까지
const c0=await pt(0,0), c1=await pt(40,70);
await touch('touchStart',[c0]); await sleep(60);
for(let i=1;i<=12;i++){ await touch('touchMove',[{x:c0.x+(c1.x-c0.x)*i/12,y:c0.y+(c1.y-c0.y)*i/12}]); await sleep(40);} await sleep(250);
res.상한끄는중=await state(); await shot('3_capped');
await touch('touchEnd',[]); await sleep(700); res.상한뒤=await state(); await ev(`decoUndo()`); await sleep(300);
// ④ 두 손가락 = 화면(네모 안 칠함)
const z0=await ev('_dZoom'); const p1=await pt(10,10), p2=await pt(10,14);
await touch('touchStart',[p1]); await sleep(40); await touch('touchMove',[{x:p1.x+20,y:p1.y+10}]); await sleep(40);
await touch('touchStart',[{x:p1.x+20,y:p1.y+10},p2]); await sleep(40);
for(let i=1;i<=8;i++){ await touch('touchMove',[{x:p1.x+20-i*12,y:p1.y+10},{x:p2.x+i*12,y:p2.y}]); await sleep(40);} 
await touch('touchEnd',[]); await sleep(600); res.두손가락=Object.assign(await state(),{zoom0:z0});
// ⑤ 한 번 누름 = 한 칸
await ev(`decoZoomFit()`); await sleep(400);
const q=await pt(20,20); await touch('touchStart',[q]); await sleep(50); await touch('touchEnd',[]); await sleep(600); res.한번누름=await state();
// ⑥ 끌어서 도구로 돌아가면 예전처럼 줄 칠하기
await ev(`decoUndo(); document.querySelector('#if-floor-picker .pk-seg-b[data-v="drag"]').click()`); await sleep(200);
const d0=await pt(5,20), d1=await pt(5,26); await touch('touchStart',[d0]); for(let i=1;i<=6;i++){await touch('touchMove',[{x:d0.x+(d1.x-d0.x)*i/6,y:d0.y}]); await sleep(40);} await touch('touchEnd',[]); await sleep(600);
res.끌어서=await state(); res.기억=await ev(`localStorage.getItem('deco_floor_tool_v1')`);
res.예외=exc;
console.log(JSON.stringify(res,null,1)); console.log('사진:', OUT);
}finally{ch.kill('SIGKILL');play.kill();}
