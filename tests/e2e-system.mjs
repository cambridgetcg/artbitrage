// --browser 用原生 Chrome；日期／加速／延遲網絡 fixture 全部明標，唔扮 live。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { withBrowser, until, delay, origin } from './helpers/browser.mjs';
const source = await readFile(new URL('../system.html', import.meta.url), 'utf8');
assert.equal(source, await readFile(new URL('../dist/system.html', import.meta.url), 'utf8'));
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
new Script(script);
assert.match(source, /<section id="second-look" lang="yue-Hant" aria-labelledby=/);
assert.match(source, /id="second-look-body" hidden/);
assert.match(source, /冇額外 XP、streak、排名或解鎖/);
assert.doesNotMatch(source, /nothing left to teach|timer is watching|truly beheld|counts while you look/);
assert.match(script, /function visibleClock/); assert.match(script, /performance.now\(\)/);
assert.match(script, /document.hasFocus\(\)/); assert.match(script, /new AbortController/);
assert.ok(script.indexOf('toastQueue = []') < script.indexOf('rollover();'));
assert.doesNotMatch(script, /fetch\('\/catalog|readJSON\('\/catalog/);
assert.equal((script.match(/localStorage\.setItem/g) || []).length, 1);
const secondCode = script.slice(script.indexOf('function renderSecondLook'), script.indexOf('/* ---- status ---- */'));
assert.doesNotMatch(secondCode, /\bsave\(|localStorage|sessionStorage|st\.xp|st\.streak|st\.quests/);
console.log('System 靜態 PASS：mirrors、shared clock／date binding／abort、static #second-look、回望無 storage／award、page-relative catalog。');
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'));

const date = '2026-09-08', yesterday = '2026-09-07';
const artworks = Array.from({length:5}, (_, i) => ({ image:`/art/fixture-${i}.svg`, thumbnail:`/art/fixture-${i}.svg`,
  title:`本地測試畫 ${i} · LOCAL FIXTURE`, artist:'Artbitrage browser fixture（非館藏）', date:'2026 · synthetic',
  medium:'SVG 測試紙', source_name:'本機 fixture，唔係博物館記錄', url:'#fixture' }));
const wing = {wing:'fixture',title:'本地測試分區',description:'只供 regression，冇遠端資料。'};
const index = {wings:[wing]};
const daySeed = s => [...s].reduce((h,c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
const picked = s => Array.from({length:3}, (_, i) => artworks[(daySeed(s) + i * 13) % artworks.length]);
const legacy = overrides => ({player:true,xp:200,streak:2,lastDay:date,doneDay:yesterday,beheldToday:[],placardRead:false,
  shadows:[{image:'/art/legacy.svg',title:'舊影軍 · LEGACY',url:'#legacy'}],quests:2,born:'2026-09-01',...overrides});
// 呢個日期係 fixture；performance.now 仍然原速，直到測試明確裝加速器。
const clockInit = `window.__day = '${date}T12:00:00'; (() => {
  const RealDate = Date;
  window.Date = class extends RealDate { constructor(...args){super(...(args.length ? args : [window.__day]));} static now(){ return new RealDate(window.__day).valueOf(); } };
})();`;
function init(state, extra = '') {
  return clockInit + (state === undefined ? '' : `localStorage.setItem('artbitrage-system', ${JSON.stringify(JSON.stringify(state))}); localStorage.setItem('unrelated-keep', '原樣留');`) + `
  window.__writes = 0; (() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(...args){window.__writes++; return set.apply(this,args);}; })();
  ` + extra;
}
const image = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700"><rect width="900" height="700" fill="#18272d"/><path d="M0 540L270 140L500 450L750 80L900 290V700H0Z" fill="#587778"/><circle cx="604" cy="238" r="96" fill="#e0c899"/><path d="M0 550Q290 370 520 557T900 560V700H0Z" fill="#263e48"/><path d="M0 623Q300 451 520 611T900 632" fill="none" stroke="#99bcc4" stroke-width="3"/><text x="42" y="660" font-family="monospace" font-size="18" fill="#e9e6df">LOCAL FIXTURE / NOT A MUSEUM WORK</text></svg>`;
function fixture(prefix = '/', works = artworks) {
  return url => {
    if (url.pathname === prefix + 'catalog/index.json') return {body:JSON.stringify(index),type:'application/json'};
    if (url.pathname === prefix + 'catalog/fixture.json') return {body:JSON.stringify({artworks:works}),type:'application/json'};
    if (url.pathname.startsWith(prefix + 'art/')) return {body:image,type:'image/svg+xml'};
    return null;
  };
}

if (process.argv.includes('--browser')) await withBrowser('system', async b => {
  const {load,evaluate,send,cdp,click,shot,viewport,media,requests} = b;
  const readState = () => evaluate(`JSON.parse(localStorage.getItem('artbitrage-system'))`);
  const stored = () => evaluate(`JSON.stringify({local:{...localStorage},session:{...sessionStorage},writes:__writes})`);
  const ready = () => until(() => evaluate(`document.querySelectorAll('.qwork').length === 3`), '三幅 fixture 載入');
  const open = async (state, extra = '', path = '/system.html', works = artworks) => {
    await load({html:source,path,init:init(state,extra),route:fixture(path.startsWith('/artbitrage/') ? '/artbitrage/' : '/',works)});
    await ready();
  };
  const progress = () => evaluate(`document.querySelector('#quest-progress').textContent`);
  const fill = (i=0) => evaluate(`Number(document.querySelectorAll('.qbar i')[${i}].style.transform.match(/[\\d.]+/)[0])`);
  const advance = async ms => {
    // 只喺明確 fixture 測試先改 monotonic clock；唔碰 GAZE_SECONDS。
    await evaluate(`if(!window.__fast){ window.__offset=0; const real=performance.now.bind(performance); performance.now=()=>real()+window.__offset; window.__fast=true; } window.__offset+=${ms};`);
    await delay(180);
  };
  const begin = i => click(`.qwork:nth-child(${i+1}) button`);
  const arise = i => until(() => evaluate(`document.querySelector('.qwork:nth-child(${i+1}) button')?.textContent.includes('ARISE')`), 'ARISE');
  const bothAttention = () => evaluate(`({hidden:document.hidden,focused:document.hasFocus()})`);
  const hide = async () => {
    const other = await cdp.send('Target.createTarget',{url:'about:blank'});
    const attached = await cdp.send('Target.attachToTarget',{targetId:other.targetId,flatten:true});
    await cdp.send('Page.bringToFront',{},attached.sessionId);
    await until(async () => { const v=await bothAttention(); return v.hidden && !v.focused; }, '真 hidden + unfocused');
    return other.targetId;
  };
  const show = async other => {
    await send('Page.bringToFront');
    await until(async () => {const v=await bothAttention();return !v.hidden && v.focused;}, '真 visible + focused');
    await cdp.send('Target.closeTarget',{targetId:other});
  };
  const completeFixture = async () => {
    for(let i=0;i<3;i++) await begin(i);
    await advance(20100);
    for(let i=0;i<3;i++){await arise(i);await begin(i);}
    await click('#pl-read');
    assert.equal((await readState()).doneDay,date);
  };
  await open(legacy());
  let st = await readState(); assert.deepEqual(st,legacy());
  assert.match(await evaluate(`document.querySelector('#second-look').innerText`), /每日三幅/);
  assert.equal(await evaluate(`document.querySelector('#second-look-body').hidden`),true);
  await evaluate(`location.hash='#second-look'`);
  await until(()=>evaluate(`(() => {const r=document.querySelector('#second-look-title').getBoundingClientRect(); return r.top >= 0 && r.bottom < innerHeight;})()`),'未完成任務亦可直接到 #second-look 介紹');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.qimg img'),n=>n.getAttribute('src'))`),picked(date).map(w=>w.image.slice(1)), '舊 daySeed 揀畫順序不變');
  await evaluate(`document.querySelector('#quest').scrollIntoView({behavior:'instant'})`);
  await until(()=>evaluate(`Array.from(document.querySelectorAll('#quest .rise'),n=>getComputedStyle(n).opacity).every(v=>v==='1')`),'daily 入場完成');
  await shot('desktop-daily-fixture','#quest');

  // 原速：真分頁 hidden + focus 暫停後續計，至少 20 秒可見聚焦先 ARISE。
  await begin(0);
  const started = performance.now();
  await delay(1250);
  const other = await hide();
  await delay(100); const paused = await fill();
  assert.ok(paused > .04 && paused < .15, String(paused));
  await delay(1500); assert.equal(await fill(),paused,'真 hidden 時 elapsed 保留不前進');
  await show(other);
  await delay(250); assert.ok(await fill() > paused);
  await delay(15000);
  assert.ok(!await evaluate(`document.querySelector('.qwork button').textContent.includes('ARISE')`), '原速不足 20 秒唔 ARISE');
  await until(() => evaluate(`document.querySelector('.qwork button').textContent.includes('ARISE')`),'原速 20 秒 ARISE',7000);
  const wallMS = performance.now()-started;
  assert.ok(wallMS >= 21400 && wallMS < 27000, String(wallMS));
  await evaluate(`window.__arise=document.querySelector('.qwork button'); for(let i=0;i<8;i++) __arise.dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
  st=await readState(); assert.equal(st.xp,210); assert.equal(st.shadows.length,2); assert.equal(st.beheldToday.length,1);
  assert.deepEqual(st.shadows[1],legacy().shadows[0]);
  await evaluate(`__arise.click(); __arise.dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
  assert.equal((await readState()).xp,210, 'detached ARISE 唔可以 award');
  console.log(`System 原速 PASS：${Math.round(wallMS)}ms wall（包含真 hidden/unfocused 暫停），20 秒可見聚焦後先 ARISE；rapid/detached award 一次。`);

  // 後續全部明標加速 fixture；cancel 必須真重置。
  await begin(1); await advance(6500); assert.ok(await fill(1) > .3);
  await begin(1); assert.equal(await fill(1),0);
  await begin(1); await begin(2); await advance(20100);
  await arise(1); await arise(2); await begin(1); await begin(2);
  assert.equal((await readState()).xp,230);
  assert.match(await progress(),/gaze 3 \/ 3/);
  await evaluate(`window.__placard = document.querySelector('#pl-read').onclick; for(let i=0;i<8;i++) __placard();`);
  st=await readState(); assert.equal(st.xp,285); assert.equal(st.streak,3); assert.equal(st.quests,3);
  assert.equal(st.shadows.length,4);
  const before = await stored();
  assert.equal(await evaluate(`document.querySelector('#second-look-body').hidden`),false);
  assert.equal(await evaluate(`document.querySelector('.second-figure img').getAttribute('src')`),picked(date)[0].image.slice(1));
  await click('#second-look-start'); await advance(4000); await click('#second-look-start');
  assert.match(await evaluate(`document.querySelector('#second-look-status').textContent`),/唔急/);
  await click('#second-look-skip'); assert.match(await evaluate(`document.querySelector('#second-look-status').textContent`),/略過/);
  await click('#second-look-start'); await advance(5000);
  const hiddenAgain = await hide(); const statusPaused = await evaluate(`document.querySelector('#second-look-status').textContent`);
  await advance(90000); assert.equal(await evaluate(`document.querySelector('#second-look-status').textContent`),statusPaused);
  await show(hiddenAgain); await delay(250);
  assert.equal(await evaluate(`document.querySelector('.second-room').classList.contains('turned')`),false,'hidden gap 唔計');
  await advance(15100);
  assert.equal(await evaluate(`document.querySelector('.second-room').classList.contains('turned')`),true);
  assert.match(await evaluate(`document.querySelector('#second-look-status').textContent`),/回望過/);
  assert.equal(await stored(),before,'回望、cancel、skip、hidden/focus、完成都唔寫 storage');
  await until(()=>evaluate(`getComputedStyle(document.querySelector('#toast')).opacity === '0'`),'舊 quest toast 收起');
  await evaluate(`document.querySelector('#second-look').scrollIntoView({behavior:'instant'})`);
  await shot('desktop-second-look-fixture','#second-look');
  for(const width of [390,320]) {
    await viewport(width,900,true);
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`),'mobile 唔 overflow');
    if(width===390) await shot('mobile-second-look-fixture','#second-look');
  }
  await viewport(1440);
  await media([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert.equal(await evaluate(`document.getAnimations().filter(a=>document.querySelector('#second-look').contains(a.effect.target)).length`),0);
  await shot('reduced-second-look-fixture','#second-look');
  await media([], 'print'); await shot('print-second-look-fixture','#second-look');
  await media([{name:'forced-colors',value:'active'}]); await shot('forced-colors-second-look-fixture','#second-look');
  await media();
  await open(undefined);
  assert.equal(await evaluate(`document.querySelector('.second-room').classList.contains('turned')`),false,'reload 無永久理解徽章');
  assert.equal((await readState()).xp,285);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await evaluate(`document.querySelector('#second-look-start').focus()`);
  assert.ok(await evaluate(`document.activeElement.matches(':focus-visible') && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 1.5`));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.match(await evaluate(`document.querySelector('#second-look-status').textContent`),/再望中/);

  // 明標 blur-only fixture：visible 但冇 focus，唔可偷偷計空隙。
  await evaluate(`window.__focused=true; document.hasFocus=()=>window.__focused;`);
  await advance(5000);
  await evaluate(`window.__focused=false; window.dispatchEvent(new Event('blur'));`);
  await advance(60000);
  assert.equal(await evaluate(`document.querySelector('.second-room').classList.contains('turned')`),false);
  await evaluate(`window.__focused=true; window.dispatchEvent(new Event('focus'));`);
  await delay(150);
  assert.equal(await evaluate(`document.querySelector('.second-room').classList.contains('turned')`),false);
  await advance(15100);
  assert.equal(await evaluate(`document.querySelector('.second-room').classList.contains('turned')`),true);
  console.log('System 回望 PASS：同一首幅、cancel／skip、真 hidden/focus、fixture blur-only、keyboard、reload reset；local/session storage bytes + writes 完全不變。');

  // 舊 duplicate array 唔刪；progress 只計今日 distinct image IDs。
  const duplicate = legacy({beheldToday:[artworks[0].image,artworks[0].image,artworks[0].image]});
  await open(duplicate); assert.match(await progress(),/gaze 1 \/ 3/);
  assert.deepEqual((await readState()).beheldToday,duplicate.beheldToday);
  assert.equal(await evaluate(`document.querySelector('#placard-step').hidden`),true);
  // 早期 rollover toast crash + 舊 calendar 計法，XP／shadows 留原樣。
  await open(legacy({lastDay:'2026-09-06',doneDay:'2026-09-06',beheldToday:['old'],placardRead:true}));
  st=await readState(); assert.equal(st.streak,0); assert.equal(st.xp,200); assert.deepEqual(st.shadows,legacy().shadows);
  assert.deepEqual(st.beheldToday,[]); assert.equal(st.placardRead,false);
  assert.match(await evaluate(`document.querySelector('#toast-body').textContent`),/連日記錄由零/);
  await open(legacy({lastDay:yesterday})); assert.equal((await readState()).streak,2);

  // 午夜：舊 start／interval／ARISE／placard closure／回望都失效。
  const intervals = `window.__ticks=[]; (()=>{ const set=window.setInterval; window.setInterval=(fn,ms)=>{window.__ticks.push(fn);return set(fn,ms);}; })();`;
  await open(legacy(),intervals);
  await evaluate(`window.__oldStart=document.querySelector('.qwork button'); window.__day='2026-09-09T00:00:01'; __oldStart.click();`);
  await ready(); assert.match(await evaluate(`document.querySelector('#quest-date').textContent`),/2026-09-09/);
  assert.equal((await readState()).xp,200); assert.match(await progress(),/gaze 0 \/ 3/);
  await open(legacy(),intervals);
  await begin(0); await advance(8000);
  await evaluate(`window.__oldTick=__ticks[0]; window.__day='2026-09-09T00:00:01'; __oldTick();`);
  await ready(); await evaluate(`__oldTick(); __oldTick();`); await advance(21000);
  assert.equal((await readState()).xp,200); assert.match(await progress(),/gaze 0 \/ 3/);
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('.qwork button'),b=>b.textContent).every(t=>!t.includes('ARISE'))`));
  await open(legacy()); await begin(0); await advance(20100); await arise(0);
  await evaluate(`window.__oldArise=document.querySelector('.qwork button'); window.__day='2026-09-09T00:00:01'; __oldArise.click();`);
  await ready(); await evaluate(`__oldArise.dispatchEvent(new MouseEvent('click'));`); assert.equal((await readState()).xp,200);
  await open(legacy({beheldToday:picked(date).map(w=>w.image)}));
  await evaluate(`window.__oldPlacard=document.querySelector('#pl-read').onclick; window.__day='2026-09-09T00:00:01'; __oldPlacard();`);
  await ready(); await evaluate(`__oldPlacard();`); assert.equal((await readState()).xp,200); assert.equal((await readState()).quests,2);
  await open(legacy({doneDay:date,placardRead:true,beheldToday:picked(date).map(w=>w.image)}));
  await click('#second-look-start'); await advance(5000);
  await evaluate(`window.__day='2026-09-09T00:00:01'; window.dispatchEvent(new Event('focus'));`);
  await ready(); await advance(20100);
  assert.equal(await evaluate(`document.querySelector('#second-look-body').hidden`),true); assert.equal((await readState()).xp,200);
  // 卸載 callback fixture：pagehide 後舊時計唔寫；真正頁面導航亦喺下一個 open 測。
  await open(legacy(),intervals); await begin(0);
  await evaluate(`window.dispatchEvent(new PageTransitionEvent('pagehide')); __ticks.forEach(fn=>fn());`);
  await advance(20100); assert.equal((await readState()).xp,200);
  console.log('System date/lifecycle fixture PASS：distinct legacy、隔日 toast、舊 streak／XP／shadows、午夜 start/tick/ARISE/placard/回望、disposed callbacks。');

  // 故意忽略 abort 嘅晚返 adapter：分開測 response、json、reject；唔靠 abort 假裝有 guards。
  for (const [at,stage,fail] of [['index','fetch',true],['index','fetch',false],['index','json',true],['shard','fetch',false],['shard','json',true],['shard','json',false]]) {
    const extra = `(() => { const native=window.fetch; let held=false;
      window.fetch=function(url,options){
        const target=${JSON.stringify(at)}==='index' ? String(url).endsWith('index.json') : String(url).endsWith('fixture.json');
        if(!target || held) return native(url,options);
        held=true; window.__aborted=false; options.signal.addEventListener('abort',()=>window.__aborted=true);
        const value=${JSON.stringify(at==='index'?index:{artworks})};
        const deferred=()=>new Promise((resolve,reject)=>{window.__release=()=>${fail ? "reject(new DOMException('fixture late failure','AbortError'))" : 'resolve(value)'};});
        if(${JSON.stringify(stage)}==='fetch') return deferred().then(v=>({ok:true,json:()=>Promise.resolve(v)}));
        return Promise.resolve({ok:true,json:deferred});
      };
    })();`;
    await load({html:source,init:init(legacy(),extra),route:fixture()});
    await until(()=>evaluate(`typeof __release === 'function'`),'舊 fixture 已停喺指定 seam');
    await evaluate(`window.__day='2026-09-09T00:00:01'; window.dispatchEvent(new Event('focus'));`);
    await ready();
    const currentUI = await evaluate(`document.querySelector('#quest').innerHTML`);
    assert.equal(await evaluate(`__aborted`),true);
    await evaluate(`__release()`); await delay(180);
    assert.equal(await evaluate(`document.querySelector('#quest').innerHTML`),currentUI,`late ${at}/${stage}/${fail} 唔覆蓋新日`);
  }
  console.log('System async fixture PASS：6 個 late fetch/json/error seams、abort catch、每次新日 UI 原樣保留。');

  // 少於三件唔偷偷減要求；長度 13 原步幅走唔晒亦要誠實補足。
  await load({html:source,init:init(legacy()),route:fixture('/',[artworks[0],artworks[0],artworks[1],{title:'冇 image'}])});
  await until(()=>evaluate(`!!document.querySelector('.quest-fallback')`),'不足三幅 fallback');
  assert.equal(await evaluate(`document.querySelectorAll('.qwork').length`),0);
  assert.match(await evaluate(`document.querySelector('.quest-fallback').textContent`),/唔減低三幅要求/);
  assert.equal((await readState()).xp,200);
  const thirteen=Array.from({length:13},(_,i)=>({...artworks[i%5],image:`/art/thirteen-${i}.svg`}));
  await open(legacy(),'','/system.html',thirteen);
  assert.equal(await evaluate(`new Set(Array.from(document.querySelectorAll('.qimg img'),n=>n.src)).size`),3);
  for(const xp of [0,200,500,900,1400,2000]) {
    await open(legacy({xp}));
    const links=await evaluate(`Array.from(document.querySelectorAll('.g-go'),n=>({href:n.getAttribute('href'),text:n.textContent,disabled:n.hasAttribute('disabled')}))`);
    assert.equal(links.length,6); assert.ok(links.every(n=>n.href && !n.disabled && ['enter','enter anyway'].includes(n.text)));
    assert.deepEqual(links.map(n=>n.href),['river.html','/#reading','rhymes.html','dark-continent.html','greed-island.html','studio.html']);
    if(xp===0) assert.equal(links.filter(n=>n.text==='enter anyway').length,5);
    if(xp===2000) assert.match(await evaluate(`document.querySelector('#xp-note').textContent`),/仍然可以再學/);
  }
  // /system 原根域入口同 GitHub /artbitrage/system.html 真 daily + 回望。
  for(const path of ['/system','/artbitrage/system.html']) {
    const from=requests.length;
    await open(legacy(),' ',path); await completeFixture();
    await click('#second-look-start'); await advance(20100);
    assert.equal(await evaluate(`document.querySelector('.second-room').classList.contains('turned')`),true);
    const prefix=path.startsWith('/artbitrage/')?'/artbitrage/':'/';
    assert.ok(requests.slice(from).some(r=>r.url===origin+prefix+'catalog/index.json'));
    assert.ok(requests.slice(from).some(r=>r.url===origin+prefix+'catalog/fixture.json'));
    assert.equal(await evaluate(`document.querySelector('.second-figure img').src`),origin+prefix+picked(date)[0].image.slice(1));
    assert.ok(await evaluate(`document.querySelector('.second-figure img').naturalWidth > 0`));
    assert.equal((await readState()).beheldToday[0],picked(date)[0].image,'storage image ID仍然以 /art/ 開頭');
  }
  // 影像失敗只留標籤，唔裝成已取到畫；storage 拒絕／壞 JSON 都唔封門。
  const remote=artworks.map(w=>({...w,image:'https://external.invalid/'+w.image,thumbnail:'https://external.invalid/'+w.thumbnail}));
  const remotePicked=picked(date).map(w=>'https://external.invalid/'+w.image);
  await open(legacy({doneDay:date,placardRead:true,beheldToday:remotePicked}),'','/system.html',remote);
  await until(()=>evaluate(`document.querySelector('.second-figure').classList.contains('rests')`),'影像 fail soft');
  assert.match(await evaluate(`document.querySelector('.second-figure figcaption').textContent`),/本地測試畫/);
  await shot('image-refused-second-look','#second-look');
  await open(undefined,`Object.defineProperty(window,'localStorage',{get(){throw new Error('fixture storage 拒絕');}});`);
  assert.equal(await evaluate(`document.querySelector('#st-level').textContent`),'1');
  await open(undefined,`localStorage.setItem('artbitrage-system','{broken');`);
  assert.equal((await readState()).xp,0);
  await open({xp:-1,streak:'bad',beheldToday:[null,7],shadows:[{},null],player:'bad'});
  assert.equal((await readState()).xp,0); assert.equal((await readState()).streak,0);
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  await load({html:source,route:fixture()});
  assert.match(await evaluate(`document.querySelector('#second-look').innerText`),/影回望/);
  assert.equal(await evaluate(`document.querySelectorAll('.g-go').length`),6);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#second-look-body')).display`),'none');
  await shot('no-js-second-look','#second-look');
  await viewport(320);
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  await send('Emulation.setScriptExecutionDisabled',{value:false});
  console.log('System browser PASS：legacy／rank gates／少於三件／步幅13／root+GitHub子路徑 daily及回望／圖片拒絕／storage拒絕與損壞／noJS／mobile／reduced／print／forced-colors。');
});
