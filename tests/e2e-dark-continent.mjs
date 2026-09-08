// 靜態先守住原文 bytes；--browser 先係真互動同畫面測試。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { withBrowser, delay } from './helpers/browser.mjs';
const source = await readFile(new URL('../dark-continent.html', import.meta.url), 'utf8');
assert.equal(source, await readFile(new URL('../dist/dark-continent.html', import.meta.url), 'utf8'));
const hashes = {
  threats: '366ceed3405ae1ae1f1848047a6fbf8f333a273726e71a24e5a6bda11a90f4c1',
  guides: '98ba762f551ea328bfba8209393f1f656b4f58b0a8d83d295b5ad469db8d655f',
  vows: 'ce3223d68303c1df9bcc52edb92f22558fa166d549cd7429b86e0e208a184156'
};
for (const [id, hash] of Object.entries(hashes)) {
  const block = source.match(new RegExp(`<section id="${id}">[\\s\\S]*?</section>`))[0];
  assert.equal(createHash('sha256').update(block).digest('hex'), hash, `${id} 整段原文唔可以變`);
}
const idx = JSON.parse(await readFile(new URL('../catalog/index.json', import.meta.url)));
const all = JSON.parse(await readFile(new URL('../catalog/all.json', import.meta.url)));
assert.equal(idx.total, 601); assert.equal(idx.wings.reduce((n, w) => n + w.count, 0), 601);
assert.equal(idx.unique_works, 591); assert.equal(all.artworks.length, 591);
assert.equal(all.artworks.filter(w => !w.artist?.trim()).length, 186);
assert.doesNotMatch(source, /99\.91%|0\.09%|601 WORKS|unsigned|無名氏 Anonymous/);
assert.match(source, /2026-07-10 頁面歷史報數/); assert.match(source, /唔係原作 canon/);
const sounding = source.match(/<section id="understanding-sounding"[\s\S]*?<\/section>/)[0];
assert.match(sounding, /class="sounding-controls" hidden/);
assert.match(sounding, /system.html#second-look/); assert.match(sounding, /still-we-meet.html/);
assert.equal((sounding.match(/<button /g) || []).length, 3);
assert.doesNotMatch(sounding, /class="[^"]*rise|<img|<input|<form/);
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach(script => new Script(script));
assert.doesNotMatch(scripts.join('\n'), /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|setTimeout|setInterval)\b/);
console.log('Dark 靜態 PASS：5 threats／5 guides／4 vows 固定 SHA-256；591／601／186；歷史口徑、三層、mirrors、無新增 I/O。');
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'));
if (process.argv.includes('--browser')) await withBrowser('dark-continent', async b => {
  const { evaluate, load, viewport, media, send, click, shot, requests } = b;
  const view = () => evaluate(`(() => {
    const root = document.querySelector('#understanding-sounding');
    const shown = n => getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility === 'visible';
    return { width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
      controls:shown(root.querySelector('.sounding-controls')),
      layers:[...root.querySelectorAll('[data-layer]')].map(n => shown(n)),
      pressed:[...root.querySelectorAll('button')].map(n => n.getAttribute('aria-pressed')),
      buttons:[...root.querySelectorAll('button')].map(n => ({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})),
      blank:root.querySelector('.unknown-space').outerHTML,
      text:root.innerText, legend:root.querySelector('.sounding-legend').innerText,
      animations:document.getAnimations().filter(a=>root.contains(a.effect.target)).length,
      paths:[...root.querySelectorAll('[data-layer]')].map(n => n.getAttribute('stroke-dasharray') || n.innerHTML)
    };
  })()`);
  const readable = v => {
    assert.ok(v.scrollWidth <= v.width + 1, `overflow ${v.scrollWidth}/${v.width}`);
    assert.match(v.text, /未明唔係失敗/); assert.match(v.legend, /眼前[\s\S]*記錄[\s\S]*推想/);
    assert.equal(v.animations, 0);
  };
  await media([{ name:'prefers-reduced-motion', value:'no-preference' }]);
  await load({ html:source });
  await evaluate(`document.querySelector('#understanding-sounding').scrollIntoView({behavior:'instant'})`);
  const initial = await view(); readable(initial);
  assert.ok(initial.controls && initial.buttons.every(n => n.w >= 44 && n.h >= 44));
  await delay(150);
  const requestCount = requests.length;
  for (const mask of [0, 5, 2, 7, 1, 6, 3, 4, 0, 7]) {
    for (const [i, layer] of ['present','record','conjecture'].entries()) {
      if ((await view()).layers[i] !== !!(mask & (1 << i))) await click(`[data-toggle="${layer}"]`);
    }
    const current = await view();
    assert.deepEqual(current.layers, [0,1,2].map(i => !!(mask & (1 << i))));
    assert.deepEqual(current.pressed, current.layers.map(String));
    assert.equal(current.blank, initial.blank, '暗位永遠唔被圖層填滿');
    readable(current);
  }
  assert.equal(requests.length, requestCount, 'toggle 唔准產生 request');
  assert.deepEqual(await evaluate(`Object.keys(localStorage)`), []);
  await shot('desktop-sounding', '#understanding-sounding');
  await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
  await send('Input.dispatchKeyEvent', { type:'keyUp', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
  await evaluate(`document.querySelector('[data-toggle="conjecture"]').focus()`);
  assert.ok(await evaluate(`document.activeElement.matches(':focus-visible') && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2`));
  await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r' });
  await send('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  assert.deepEqual((await view()).layers, [true,true,false]);
  await click('[data-toggle="conjecture"]');
  for (const width of [390,320,740,741]) {
    await viewport(width,900,true); readable(await view());
    if (width === 390) await shot('mobile-sounding', '#understanding-sounding');
  }
  await viewport(1440);
  await media([{name:'prefers-reduced-motion',value:'reduce'}]);
  readable(await view()); await shot('reduced-sounding', '#understanding-sounding');
  await media([], 'print'); assert.equal((await view()).controls, false); readable(await view());
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.sounding-map text'),n=>getComputedStyle(n).fill)`), ['rgb(17, 17, 17)','rgb(17, 17, 17)']);
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('.sounding-doors a'),n=>getComputedStyle(n).color).every(c=>c==='rgb(17, 17, 17)')`));
  await shot('print-sounding', '#understanding-sounding');
  await media([{name:'forced-colors',value:'active'}]);
  readable(await view()); assert.ok((await view()).layers.every(Boolean));
  await shot('forced-colors-sounding', '#understanding-sounding');
  await media();
  await send('Emulation.setScriptExecutionDisabled', {value:true});
  await load({html:source});
  const noJS = await view(); readable(noJS); assert.equal(noJS.controls,false); assert.ok(noJS.layers.every(Boolean));
  await shot('no-js-sounding', '#understanding-sounding');
  await viewport(320); readable(await view());
  await send('Emulation.setScriptExecutionDisabled', {value:false});
  await viewport(1440);
  // 第二個 listener 故意失敗；首個已安裝 listener 必須一齊撤回。
  await load({html:source, init:`(() => { const add = EventTarget.prototype.addEventListener; EventTarget.prototype.addEventListener = function(type,...args){ if(type === 'click' && this.dataset?.toggle === 'record') throw new Error('fixture 初始化失敗'); return add.call(this,type,...args); }; })();`});
  readable(await view()); assert.equal((await view()).controls,false);
  await click('[data-toggle="present"]');
  assert.ok((await view()).layers.every(Boolean), '初始化失敗唔留半套 listener');
  assert.deepEqual(await evaluate(`Object.keys(localStorage)`), []);
  console.log('Dark browser PASS：8 種組合／收回／暗位、原生 keyboard focus、390/320/740/741px、noJS、初始化失敗還原、reduced、print、forced-colors；toggle 零 I/O。');
});
