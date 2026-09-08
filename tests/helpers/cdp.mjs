// 三房共用原生 CDP 連線同有界等候；唔安裝 browser framework。
import { setTimeout as delay } from 'node:timers/promises';

export async function until(check, label, timeout = 5000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) {
    const value = await check();
    if (value) return value;
    await delay(50);
  }
  throw new Error(`等候逾時：${label}`);
}

export async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('CDP 連線逾時')); }, 5000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP 連線失敗')); }, { once: true });
  });
  let serial = 0;
  const pending = new Map();
  const listeners = [];
  socket.addEventListener('message', ({ data }) => {
    const event = JSON.parse(data);
    if (event.id) {
      const entry = pending.get(event.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(event.id);
      if (event.error) entry.reject(new Error(JSON.stringify(event.error)));
      else entry.resolve(event.result);
    } else listeners.forEach(listener => listener(event));
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP 逾時：${method}`)); }, 5000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  return {
    send,
    on: listener => listeners.push(listener),
    close() {
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('CDP 已關閉')); }
      pending.clear();
      socket.close();
    }
  };
}
