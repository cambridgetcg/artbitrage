(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let works;
  try { works = JSON.parse($('noticing-data').textContent).works; } catch { return; }
  const records = new Map(works.map(work => [work.id, work]));
  const viewer = $('noticing-viewer'), image = $('noticing-viewer-image');
  let opener = null;
  if (typeof viewer.showModal === 'function') {
    document.querySelectorAll('[data-view-work]').forEach(link => {
      link.addEventListener('click', event => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const work = records.get(link.dataset.viewWork);
        if (!work) return;
        event.preventDefault();
        opener = link;
        $('noticing-viewer-title').textContent = work.title;
        $('noticing-viewer-maker').textContent = `${work.maker} · ${work.date}`;
        $('noticing-viewer-source').href = work.source;
        $('noticing-viewer-stay').href = `/trip?from=noticing&work=${encodeURIComponent(work.id)}`;
        $('noticing-viewer-status').textContent = 'Opening the whole work…';
        image.alt = work.alt;
        image.onload = () => { $('noticing-viewer-status').textContent = ''; };
        image.onerror = () => { $('noticing-viewer-status').textContent = 'This image could not load. The museum record is still available below.'; };
        image.src = work.image;
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
    viewer.addEventListener('close', () => { opener?.focus({ preventScroll: true }); });
  }
  // The pointer sits on the displayed reproduction, including its contain margins.
  // It never changes, crops or recolours the artwork.
  document.querySelectorAll('[data-detail-toggle]').forEach(button => {
    const work = records.get(button.dataset.detailToggle);
    const section = button.closest('.noticing-work');
    const art = section.querySelector('[data-view-work] img');
    const field = section.querySelector('.work-field'), marker = section.querySelector('.detail-mark');
    if (!work?.detail) return;
    const position = () => {
      if (button.getAttribute('aria-pressed') !== 'true' || !art.naturalWidth) return;
      const box = art.getBoundingClientRect(), base = field.getBoundingClientRect();
      const scale = Math.min(box.width / art.naturalWidth, box.height / art.naturalHeight);
      const width = art.naturalWidth * scale, height = art.naturalHeight * scale;
      const detail = work.detail;
      marker.style.left = `${box.left - base.left + (box.width - width) / 2 + width * detail.x}px`;
      marker.style.top = `${box.top - base.top + (box.height - height) / 2 + height * detail.y}px`;
      marker.style.width = `${width * detail.w}px`;
      marker.style.height = `${height * detail.h}px`;
    };
    const ready = () => { button.hidden = !art.naturalWidth; position(); };
    art.addEventListener('load', ready);
    art.addEventListener('error', () => { button.hidden = true; marker.hidden = true; button.setAttribute('aria-pressed', 'false'); });
    ready();
    button.addEventListener('click', () => {
      const active = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(active));
      marker.hidden = !active;
      button.innerHTML = active ? 'Let the whole work breathe <span aria-hidden="true">−</span>' : 'Follow my eye <span aria-hidden="true">＋</span>';
      position();
    });
    if ('ResizeObserver' in window) new ResizeObserver(position).observe(field);
    else window.addEventListener('resize', position);
  });
})();
