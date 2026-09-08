// 私人 Chrome + 拒絕 proxy；CDP 只 fulfill 測試 bytes，其餘一律拒絕。
// 呢個唔係 OS 全程序封網，亦唔借用真人 profile／登入。
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, chmod, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { connect, until } from './cdp.mjs';
export { until, delay };
export const origin = 'http://127.0.0.1:48179'; // 冇 server；所有 request 喺 CDP fulfill 或拒絕。

export async function withBrowser(name, run) {
  const work = await mkdtemp(join(tmpdir(), `${name}-test-`));
  const pictures = await mkdtemp(join(tmpdir(), `${name}-png-`));
  let proxy, chrome, cdp, budget, interrupted;
  let stderr = '', closing = false;
  const screenshots = [], exceptions = [], requests = [], fixtureErrors = [];
  try {
    await chmod(work, 0o700); await chmod(pictures, 0o700);
    const profile = join(work, 'profile');
    await mkdir(profile, { mode: 0o700 });
    proxy = createServer(socket => socket.destroy());
    await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(0, '127.0.0.1', resolve); });
    chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
      `--proxy-server=http://127.0.0.1:${proxy.address().port}`, '--proxy-bypass-list=<-loopback>',
      '--host-resolver-rules=MAP * ~NOTFOUND', '--disable-quic', '--headless=new',
      '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-component-update', '--disable-sync', '--disable-domain-reliability', '--disable-default-apps',
      '--metrics-recording-only', '--safebrowsing-disable-auto-update', '--password-store=basic',
      '--use-mock-keychain', '--window-size=1440,1000', 'about:blank'
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let chromeError;
    chrome.on('error', error => { chromeError = error; });
    chrome.stderr.on('data', data => { stderr = (stderr + data).slice(-3000); });
    const stop = new Promise((_, reject) => {
      budget = setTimeout(() => reject(new Error('browser 測試超過 240 秒')), 240000);
      interrupted = () => reject(new Error('測試收到停止訊號'));
      process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
    });
    await Promise.race([stop, (async () => {
      const portFile = await until(async () => {
        if (chromeError) throw chromeError;
        if (chrome.exitCode !== null) throw new Error(`Chrome 提早退出：${stderr}`);
        try { return await readFile(join(profile, 'DevToolsActivePort'), 'utf8'); } catch { return false; }
      }, 'Chrome 啟動', 15000);
      const [port, endpoint] = portFile.trim().split('\n');
      assert.match(port, /^\d+$/); assert.ok(endpoint.startsWith('/devtools/browser/'));
      cdp = await connect(`ws://127.0.0.1:${port}${endpoint}`);
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      const send = (method, params = {}) => cdp.send(method, params, sessionId);
      let responder = () => null;
      const loaded = new Set();
      cdp.on(event => {
        if (event.sessionId !== sessionId || closing) return;
        if (event.method === 'Page.lifecycleEvent' && event.params.name === 'load') loaded.add(event.params.loaderId);
        if (event.method === 'Runtime.exceptionThrown') exceptions.push(event.params.exceptionDetails);
        if (event.method !== 'Fetch.requestPaused') return;
        const { requestId, request, resourceType } = event.params;
        requests.push({ url: request.url, resourceType });
        (async () => {
          const url = new URL(request.url);
          const response = url.origin === origin ? await responder(url, resourceType) : null;
          if (!response) return send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
          return send('Fetch.fulfillRequest', {
            requestId, responseCode: response.status || 200,
            responseHeaders: [{ name: 'Content-Type', value: response.type || 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }],
            body: Buffer.from(response.body).toString('base64')
          });
        })().catch(error => { if (!closing) fixtureErrors.push(error.message); });
      });
      await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
      await send('Page.setLifecycleEventsEnabled', { enabled:true });
      await send('Network.setCacheDisabled', { cacheDisabled: true });
      await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
        return result.result.value;
      };
      let initId;
      const load = async ({ html, path = `/${name}.html`, init = '', route = () => null }) => {
        if (initId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: initId });
        initId = init ? (await send('Page.addScriptToEvaluateOnNewDocument', { source: init })).identifier : null;
        responder = (url, resourceType) => resourceType === 'Document' && url.pathname === path ? { body: html } : route(url, resourceType);
        const navigation = await send('Page.navigate', { url: origin + path });
        assert.ok(!navigation.errorText, navigation.errorText);
        await until(() => loaded.has(navigation.loaderId), '呢次 navigation 嘅 load event');
        await until(() => evaluate(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)} && !!document.querySelector('main')`), 'HTML 載入');
        await send('Page.bringToFront');
      };
      const viewport = async (width, height = 1000, mobile = false) => {
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
        await delay(100);
      };
      const media = async (features = [], type = '') => {
        await send('Emulation.setEmulatedMedia', { media: type, features }); await delay(100);
      };
      const shot = async (label, selector) => {
        let clip;
        if (selector) {
          clip = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x + scrollX,y:r.y + scrollY,width:r.width,height:r.height,scale:1}; })()`);
        }
        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!clip, ...(clip ? { clip } : {}) });
        const path = join(pictures, `${label}.png`);
        await writeFile(path, Buffer.from(data, 'base64'), { mode: 0o600 });
        screenshots.push(path); console.log(`私人 PNG：${path}`);
      };
      const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
      await viewport(1440);
      await run({ send, cdp, evaluate, load, viewport, media, shot, click, requests, exceptions, fixtureErrors });
      assert.deepEqual(exceptions, [], '冇未處理 browser exception');
      assert.deepEqual(fixtureErrors, [], 'CDP fixtures 本身唔可以失敗');
      console.log(JSON.stringify({ result: 'PASS', screenshots, interceptedRequests: requests.length,
        limits: ['所有網絡資料係 CDP fixtures；external fonts/images 全部拒絕，冇 live API／模型請求。', '只測本機 Chrome；no JS／reduced-motion／print／forced-colors 係 browser emulation，未做人手讀屏、實機手機或實體列印。', '原生 sandbox 保留；拒絕 proxy 唔係 OS 全程序封網。'] }, null, 2));
    })()]);
  } catch (error) {
    console.error(`Chrome 短診斷：${stderr}`); throw error;
  } finally {
    closing = true; clearTimeout(budget);
    if (interrupted) { process.off('SIGINT', interrupted); process.off('SIGTERM', interrupted); }
    cdp?.close();
    if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill('SIGTERM');
      await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), delay(3000)]);
      if (chrome.exitCode === null && chrome.signalCode === null) {
        chrome.kill('SIGKILL'); await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), delay(2000)]);
      }
    }
    if (proxy?.listening) await new Promise(resolve => proxy.close(resolve));
    await rm(work, { recursive: true, force: true });
    console.log(`Chrome/profile／拒絕 proxy 已清理；私人 PNG 留喺 ${pictures}`);
  }
}
