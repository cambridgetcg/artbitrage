// Unsigned · 無名 — progressive enhancement only. The page reads completely without
// this file: each artwork link opens the whole image. With it, the same link opens
// a viewer dialog. No autoplay, no audio, no background requests.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const viewer = $('unsigned-viewer'), image = $('unsigned-viewer-image'), status = $('unsigned-viewer-status');
  if (!viewer || typeof viewer.showModal !== 'function') return;
  let room, works;
  try { ({ room, works } = JSON.parse($('unsigned-data').textContent)); } catch { return; }
  if (!room || !Array.isArray(works)) return;
  const records = new Map(works.map(work => [work.id, work]));
  // Chinese runs keep their language for screen readers, as they do on the page (the same ranges as the generator).
  const CJK = /[⺀-⿿　-〿㐀-鿿豈-﫿]+/g;
  const say = (element, value) => {
    element.replaceChildren();
    let last = 0;
    for (const match of value.matchAll(CJK)) {
      if (match.index > last) element.append(value.slice(last, match.index));
      const span = document.createElement('span');
      span.lang = 'zh-Hant'; span.textContent = match[0];
      element.append(span);
      last = match.index + match[0].length;
    }
    if (last < value.length) element.append(value.slice(last));
  };
  let opener = null;
  document.querySelectorAll('[data-view-work]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const work = records.get(link.dataset.viewWork);
      if (!work || !/^\/assets\/unsigned\/[a-z0-9-]+\.jpg$/.test(work.image) || !/^https:\/\/www\.artic\.edu\/artworks\/\d+$/.test(work.source)) return;
      event.preventDefault();
      opener = link;
      // Most images show the whole work; a work can say it shows only part (the scroll shows one section).
      const view = typeof work.view === 'string' && work.view ? work.view : 'the whole work';
      $('unsigned-viewer-view').textContent = view.charAt(0).toUpperCase() + view.slice(1);
      say($('unsigned-viewer-title'), work.title);
      say($('unsigned-viewer-maker'), `Maker: ${room.blank_caption} · Recorded as: ${work.maker} · ${work.date}`);
      $('unsigned-viewer-source').href = work.source;
      // On narrow screens a work wider than 5:2 keeps up to its natural height and pans sideways.
      viewer.toggleAttribute('data-wide', work.width / work.height > 2.5);
      image.style.setProperty('--natural-height', `${work.height}px`);
      status.textContent = `Opening ${view}…`;
      image.alt = work.alt;
      image.onload = () => { status.textContent = ''; };
      image.onerror = () => { status.textContent = 'This image could not load. The museum record is still available below.'; };
      image.src = work.image;
      if (image.complete && image.naturalWidth) status.textContent = '';
      viewer.showModal();
    });
  });
  viewer.querySelector('[data-viewer-close]').addEventListener('click', () => viewer.close());
  let backdropPress = false;
  const outside = event => {
    const rect = viewer.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  viewer.addEventListener('pointerdown', event => { backdropPress = event.target === viewer && outside(event); });
  viewer.addEventListener('click', event => { if (backdropPress && event.target === viewer && outside(event)) viewer.close(); backdropPress = false; });
  // Return focus to the exact artwork, unless the visitor has already moved on.
  viewer.addEventListener('close', () => {
    const here = document.activeElement;
    if (opener && (!here || here === document.body || viewer.contains(here))) opener.focus({ preventScroll: true });
    opener = null;
  });
})();
