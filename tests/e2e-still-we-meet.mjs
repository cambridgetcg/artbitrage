// 本地合約；--browser 用一次性 profile。作品零外連，唔冒稱整個 Chrome 離線。
import assert from 'node:assert/strict';
import { connect, until } from './helpers/cdp.mjs';
import { readFile, writeFile, mkdtemp, mkdir, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { Script } from 'node:vm';
import { setTimeout as delay } from 'node:timers/promises';

const source = await readFile(new URL('../still-we-meet.html', import.meta.url), 'utf8');
const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const yue = ['你講嗰場雨，', '我只聽見簷邊滴水。', '我唔再急住', '替你叫佢做晴天。', '張凳移開少少，', '等你嗰句，慢慢落地。'];
const en = ['My map keeps its own north.', 'I unfold the corner', 'that has covered your handwriting.', 'The road stops at the edge of this sheet.', 'Yours continues somewhere', 'I cannot point to.'];
const wall = ['我唔使成為你，', '先至可以', '為你留白。'];
for (const file of ['still-we-meet.html', 'index.html']) {
  assert.deepEqual(await readFile(new URL(`../${file}`, import.meta.url)), await readFile(new URL(`../dist/${file}`, import.meta.url)), `${file} 兩份 bytes 要一樣`);
}
const articles = [...source.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)];
assert.equal(articles.length, 2);
for (const [i, lines] of [yue, en].entries()) {
  assert.match(articles[i][1], new RegExp(`lang="${i ? 'en' : 'yue-Hant'}"`));
  assert.doesNotMatch(articles[i][1], /hidden|inert/);
  assert.ok(articles[i][2].includes(lines.map(line => `<span>${line}</span>`).join('')));
}
assert.ok(source.includes(`<p class="wall-poem">${wall.map(line => `<span>${line}</span>`).join('')}</p>`));
assert.equal((source.match(/<button\b/g) || []).length, 3);
for (const id of ['pause', 'replay', 'unfold']) assert.match(source, new RegExp(`<button type="button" id="${id}">`));
assert.match(source, /href="index.html#wings"/);
assert.match(source, /data-state="static"/);
assert.match(source, /class="controls"[^>]* hidden/);
assert.doesNotMatch(source, /aria-live|role="(?:status|alert)"|<[^>]+(?:src|srcset|poster)=|@import|url\s*\(|https?:\/\//i);
assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|cookie|serviceWorker|setInterval|setTimeout)\b/);
assert.doesNotMatch(source, /<\s*(?:iframe|img|audio|video|form|link|canvas)\b/i);
assert.deepEqual([...source.matchAll(/href="([^"]+)"/g)].map(match => match[1]), ['index.html#wings']);
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1);
new Script(scripts[0][1]);
const wings = home.split('<div class="wings rise">')[1].split('</div>')[0];
const doors = [...wings.matchAll(/<a href="([^"]+)"/g)].map(match => match[1]);
assert.equal(doors.filter(href => href === 'still-we-meet.html').length, 1);
assert.equal(doors[doors.indexOf('maybe.html') + 1], 'still-we-meet.html');
assert.equal(doors[doors.indexOf('still-we-meet.html') + 1], 'rhymes.html');
assert.ok(doors.includes('depths.html#fighting-temeraire-civilisation'));
assert.match(wings, /遇 · 未必同感，仍可相遇/);
assert.match(wings, /兩頁唔成為同一句，只係為對方留出可讀嘅位置。/);
console.log('靜態合約通過：雙聲部、牆詩、控制、單一入口、mirror、零外部資源。');
assert.ok(process.argv.slice(2).every(arg => arg === '--browser'), '只接受 --browser');
if (process.argv.includes('--browser')) await browser();

// 呢啲觀察只讀 DOM、實際字行邊界同原生 animation，唔更改作品時間。
function observe() {
  const rect = element => {
    const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
    return { x, y, width, height, right, bottom };
  };
  const visible = element => {
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) < .99) return false;
    }
    return true;
  };
  return {
    state: document.querySelector('.room').dataset.state,
    hidden: document.hidden,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    controlsVisible: visible(document.querySelector('.controls')),
    buttons: [...document.querySelectorAll('button')].map(element => ({ text: element.textContent, disabled: element.disabled || false, ...rect(element) })),
    wall: { visible: visible(document.querySelector('.wall-poem')), ...rect(document.querySelector('.wall-poem')) },
    sheets: [...document.querySelectorAll('.sheet')].map(element => ({
      ...rect(element),
      visible: visible(element) && [...element.querySelectorAll('.poem span')].every(visible),
      text: element.querySelector('.poem').innerText,
      transform: getComputedStyle(element).transform,
      lines: [...element.querySelectorAll('.poem span')].flatMap(span => {
        const range = document.createRange();
        range.selectNodeContents(span);
        return [...range.getClientRects()].map(({ x, y, right, bottom }) => ({ x, y, right, bottom }));
      })
    })),
    animations: document.getAnimations().map(animation => ({
      time: animation.currentTime,
      playState: animation.playState,
      ...animation.effect.getTiming()
    }))
  };
}
function separated(view) {
  const [a, b] = view.sheets;
  return b.x >= a.right + 20 || b.y >= a.bottom + 20;
}
function overlap(view) {
  const [a, b] = view.sheets;
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
}
function readable(view) {
  assert.ok(separated(view), '兩頁要留真空白');
  assert.ok(view.scrollWidth <= view.width + 1, '唔可以橫向 overflow');
  assert.ok(view.wall.visible, '牆詩唔可以隱藏');
  view.sheets.forEach((sheet, i) => {
    assert.ok(sheet.visible);
    assert.equal(sheet.text.replace(/\s+/g, ''), (i ? en : yue).join('').replace(/\s+/g, ''));
    for (const line of sheet.lines) {
      assert.ok(line.x >= sheet.x && line.right <= sheet.right + 1 && line.y >= sheet.y && line.bottom <= sheet.bottom + 1, '每行字都要喺紙內');
    }
  });
}

async function browser() {
  const work = await mkdtemp(join(tmpdir(), 'still-we-meet-test-'));
  const pictures = await mkdtemp(join(tmpdir(), 'still-we-meet-png-'));
  await chmod(work, 0o700);
  await chmod(pictures, 0o700);
  const profile = join(work, 'profile');
  await mkdir(profile, { mode: 0o700 });
  const pagePath = join(work, 'still-we-meet.html');
  await writeFile(pagePath, source);
  // 只拒絕、唔讀或轉發內容嘅本機 proxy；唔假設某個固定 port 無服務。
  const refuseProxy = createServer(socket => socket.destroy());
  try {
    await new Promise((resolve, reject) => {
      refuseProxy.once('error', reject);
      refuseProxy.listen(0, '127.0.0.1', resolve);
    });
  } catch (error) {
    await rm(work, { recursive: true, force: true });
    await rm(pictures, { recursive: true, force: true });
    throw new Error('未建立本機拒絕 proxy；Chrome 未啟動。', { cause: error });
  }
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    `--proxy-server=http://127.0.0.1:${refuseProxy.address().port}`,
    '--proxy-bypass-list=<-loopback>', '--host-resolver-rules=MAP * ~NOTFOUND', '--disable-quic',
    '--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync',
    '--disable-domain-reliability', '--disable-default-apps', '--metrics-recording-only',
    '--safebrowsing-disable-auto-update', '--password-store=basic', '--use-mock-keychain',
    '--window-size=1440,1000', 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeError;
  chrome.on('error', error => { chromeError = error; });
  // 唔印 Chrome 雜訊；只喺失敗時保留短尾，亦唔寫入 repo。
  let stderr = '';
  chrome.stderr.on('data', data => { stderr = (stderr + data).slice(-3000); });
  let cdp;
  let budget;
  let interrupted;
  const screenshots = [];
  const requests = [];
  const exceptions = [];
  const limits = ['只實測本機 Chrome；未做人手讀屏、實機手機、OS 高對比或實體列印。', '300%／400% 用 CSS zoom 同對應窄 viewport 測 reflow，唔冒稱已按瀏覽器 UI 縮放。', '保留 Chrome 原生 sandbox；拒絕 proxy／DNS 規則只係收窄背景連線，唔係 OS 全程序封網或整部機離線保證。'];
  try {
    const stop = new Promise((_, reject) => {
      budget = setTimeout(() => reject(new Error('整個 browser 測試超過 150 秒')), 150000);
      interrupted = () => reject(new Error('測試收到停止訊號'));
      process.once('SIGINT', interrupted);
      process.once('SIGTERM', interrupted);
    });
    await Promise.race([stop, (async () => {
      const portFile = await until(async () => {
        if (chromeError) throw chromeError;
        if (chrome.exitCode !== null) throw new Error(`Chrome 提早退出：${stderr}`);
        try { return await readFile(join(profile, 'DevToolsActivePort'), 'utf8'); } catch { return false; }
      }, 'Chrome 啟動', 15000);
      const [port, endpoint] = portFile.trim().split('\n');
      assert.match(port, /^\d+$/);
      assert.ok(endpoint.startsWith('/devtools/browser/'));
      cdp = await connect(`ws://127.0.0.1:${port}${endpoint}`);
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      const send = (method, params = {}) => cdp.send(method, params, sessionId);
      cdp.on(event => {
        if (event.sessionId !== sessionId) return;
        if (event.method === 'Network.requestWillBeSent' && /^https?:/.test(event.params.request.url)) requests.push(event.params.request.url);
        if (event.method === 'Runtime.exceptionThrown') exceptions.push(event.params.exceptionDetails.text);
      });
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Network.enable');
      await send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
      const evaluate = async expression => {
        const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        assert.ok(!value.exceptionDetails, JSON.stringify(value.exceptionDetails));
        return value.result.value;
      };
      const view = () => evaluate(`(${observe.toString()})()`);
      const click = id => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
      const viewport = async (width, height, mobile = false) => {
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
        await delay(100);
      };
      const media = async (features = [], type = '') => {
        await send('Emulation.setEmulatedMedia', { media: type, features });
        await delay(100);
      };
      const load = async () => {
        await send('Page.navigate', { url: pathToFileURL(pagePath).href });
        await until(() => evaluate(`document.readyState === 'complete' && !!document.querySelector('.sheet')`), '作品載入');
      };
      const shot = async (name, full = true) => {
        const { cssContentSize } = await send('Page.getLayoutMetrics');
        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(full ? { clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 } } : {}) });
        const path = join(pictures, `${name}.png`);
        await writeFile(path, Buffer.from(data, 'base64'), { mode: 0o600 });
        screenshots.push(path);
        console.log(`本地截圖：${path}`);
      };
      const settled = async () => {
        await until(async () => (await view()).state === 'settled', '紙頁收定', 14000);
        readable(await view());
      };

      await viewport(1440, 1000);
      await media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      await load();
      const initial = await view();
      assert.equal(initial.state, 'running');
      assert.equal(initial.animations.length, 2);
      assert.deepEqual(initial.animations.map(a => [a.duration, a.delay, a.iterations]), [[12000, 0, 1], [11100, 900, 1]]);
      assert.ok(overlap(initial) > 30000, '開頭要真重疊');
      assert.ok(initial.sheets.every(sheet => sheet.visible), '文字唔可以靠全透明出場');
      assert.ok(initial.wall.visible && initial.wall.bottom < 1000);
      assert.ok(initial.buttons.every(button => button.width >= 44 && button.height >= 44));
      assert.ok(await evaluate(`(() => { const r = document.querySelector('.back').getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })()`));
      await shot('desktop-overlap');
      await delay(Math.max(0, 5800 - (await view()).animations[0].time));
      const middle = await view();
      assert.equal(middle.state, 'running');
      assert.ok(middle.sheets[0].x < initial.sheets[0].x - 40 && middle.sheets[1].x > initial.sheets[1].x + 40, '兩頁都要真正讓開');
      assert.ok(overlap(middle) < overlap(initial));
      await shot('desktop-middle');
      await delay(Math.max(0, 11500 - (await view()).animations[0].time));
      assert.equal((await view()).state, 'running', '原速 11.5 秒仲未完');
      const beforeFinish = performance.now();
      await settled();
      assert.ok(performance.now() - beforeFinish < 2000, '原速約 12 秒收定');
      await shot('desktop-final');
      await delay(300);
      assert.equal((await view()).animations.length, 0, '只播一次，收定唔留動畫');

      await click('replay');
      await delay(700);
      await click('pause');
      await delay(100);
      const paused = await view();
      assert.equal(paused.state, 'paused');
      assert.equal(paused.buttons[0].text, '繼續');
      await delay(450);
      const held = await view();
      held.animations.forEach((a, i) => assert.ok(Math.abs(a.time - paused.animations[i].time) < 1));
      assert.deepEqual(held.sheets, paused.sheets);
      await click('pause');
      await delay(400);
      assert.equal((await view()).state, 'running');
      assert.ok((await view()).animations[0].time > held.animations[0].time + 250);
      for (let i = 0; i < 6; i++) {
        await click('replay');
        await delay(30);
        const replayed = await view();
        assert.equal(replayed.animations.length, 2);
        assert.ok(replayed.animations.every(a => a.time < 250));
      }
      await click('unfold');
      await settled();
      assert.equal((await view()).animations.length, 0);

      // 真分頁切換：要讀到 document.hidden，唔用偽造 visibilitychange 冒充。
      await click('replay');
      const other = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const attached = await cdp.send('Target.attachToTarget', { targetId: other.targetId, flatten: true });
      await cdp.send('Page.bringToFront', {}, attached.sessionId);
      await until(async () => (await view()).hidden, '真分頁隱藏');
      await delay(100);
      const hidden = await view();
      assert.equal(hidden.state, 'paused');
      await send('Page.bringToFront');
      await until(async () => !(await view()).hidden, '返作品分頁');
      await delay(200);
      assert.equal((await view()).state, 'paused');
      assert.ok(Math.abs((await view()).animations[0].time - hidden.animations[0].time) < 1);
      await cdp.send('Target.closeTarget', { targetId: other.targetId });
      await click('pause');
      assert.equal((await view()).state, 'running');

      await media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await settled();
      assert.equal((await view()).buttons[1].disabled, true);
      await media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      await delay(150);
      assert.equal((await view()).state, 'settled', '關閉減少動態唔自動重播');
      await media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await load();
      await settled();
      await shot('reduced-motion');
      await media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      await click('replay');
      await viewport(390, 844, true);
      await settled();
      assert.ok((await view()).sheets[1].y > (await view()).sheets[0].bottom);
      await click('replay');
      await delay(100);
      const mobileStart = await view();
      assert.ok(overlap(mobileStart) > 10000);
      assert.ok(mobileStart.scrollWidth <= mobileStart.width + 1);
      await shot('mobile-overlap');
      await settled();
      await shot('mobile-final');
      await click('replay');
      await viewport(1440, 1000);
      await settled();

      // 原生鍵盤啟動、焦點同頁面 Space 唔被搶走。
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await evaluate(`document.getElementById('replay').focus()`);
      const focus = await evaluate(`({ visible: document.activeElement.matches(':focus-visible'), width: getComputedStyle(document.activeElement).outlineWidth })`);
      assert.ok(focus.visible && parseFloat(focus.width) >= 2);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: String.fromCharCode(13) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      assert.equal((await view()).state, 'running');
      await click('unfold');
      await evaluate('document.activeElement.blur()');
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
      assert.equal((await view()).state, 'settled');
      await evaluate('scrollTo(0, 0)');

      for (const width of [760, 761, 320, 240, 480, 360]) {
        await viewport(width, 900);
        readable(await view());
        if (width === 480 || width === 360) await shot(`reflow-${144000 / width}`);
      }
      await viewport(1440, 1000);
      for (const zoom of [3, 4]) {
        await evaluate(`document.documentElement.style.zoom = '${zoom}'`);
        readable(await view());
        await shot(`zoom-${zoom * 100}`, false);
      }
      await evaluate("document.documentElement.style.zoom = ''");

      await click('replay');
      await media([], 'print');
      await settled();
      await shot('print');
      await media([{ name: 'forced-colors', value: 'active' }]);
      await settled();
      await shot('forced-colors');
      await media([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      assert.equal((await view()).state, 'settled');

      // 實際組合紙色同牆色；紙紋只係微量，保留高於 AA 嘅餘量。
      const contrast = await evaluate(`(() => {
        const rgb = value => value.match(/[\\d.]+/g).map(Number);
        const lum = channels => channels.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
        const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
        const backdrops = [rgb(getComputedStyle(document.body).backgroundColor), [39, 43, 43]];
        return [...document.querySelectorAll('.poem, .wall-poem, .room-name, .english-title, button, .back')].map(el => Math.min(...backdrops.map(wall => {
          const sheet = el.closest('.sheet');
          let bg = wall;
          if (sheet) { const paper = rgb(getComputedStyle(sheet).backgroundColor); bg = paper.slice(0, 3).map((v, i) => v * (paper[3] ?? 1) + wall[i] * (1 - (paper[3] ?? 1))); }
          return ratio(rgb(getComputedStyle(el).color), bg);
        })));
      })()`);
      assert.ok(contrast.every(value => value >= 4.5), JSON.stringify(contrast));
      console.log(`文字對比最低 ${Math.min(...contrast).toFixed(2)}:1；紙紋由 PNG 另行檢視。`);

      await send('Emulation.setScriptExecutionDisabled', { value: true });
      await load();
      const noJS = await view();
      assert.equal(noJS.state, 'static');
      assert.equal(noJS.controlsVisible, false);
      assert.equal(noJS.animations.length, 0);
      readable(noJS);
      await shot('no-js');
      await viewport(320, 900);
      readable(await view());
      await send('Emulation.setScriptExecutionDisabled', { value: false });
      await viewport(1440, 1000);
      const broken = await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.KeyframeEffect = class { constructor() { throw new Error("測試初始化失敗"); } };' });
      await load();
      readable(await view());
      assert.equal((await view()).animations.length, 0);
      assert.equal((await view()).state, 'static');
      assert.equal((await view()).controlsVisible, false);
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: broken.identifier });
      assert.deepEqual(requests, [], '作品唔可以嘗試 HTTP(S) request，連被攔截嘅都計');
      assert.deepEqual(exceptions, [], '作品唔可以有未處理例外');
      console.log(JSON.stringify({ result: 'PASS', screenshots, httpRequests: requests.length, limits }, null, 2));
    })()]);
  } catch (error) {
    console.error(`本機 Chrome 失敗時嘅短診斷：${stderr}`);
    throw error;
  } finally {
    clearTimeout(budget);
    if (interrupted) { process.off('SIGINT', interrupted); process.off('SIGTERM', interrupted); }
    cdp?.close();
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill('SIGTERM');
      await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), delay(3000)]);
      if (chrome.exitCode === null && chrome.signalCode === null) {
        chrome.kill('SIGKILL');
        await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), delay(2000)]);
      }
    }
    await new Promise(resolve => refuseProxy.close(resolve));
    await rm(work, { recursive: true, force: true });
    console.log(`Chrome/profile／拒絕 proxy 已清理；私人 PNG 留喺 ${pictures}`);
  }
}
