/* Core content works without JavaScript; search reads the static museum catalogue. */
// The homepage is the gallery's foyer; each chosen view leads into its room.
(() => {
  const hero = document.getElementById('arrival');
  const controls = document.querySelector('.arrival-views');
  if (!hero || !controls) return;
  const works = {
    water: { title: 'Markandeya Viewing Krishna in the Cosmic Ocean', maker: 'Northern India, Basohli · c. 1680', source: 'https://clevelandart.org/art/1967.241', museum: 'Cleveland Museum of Art' },
    dusk: { title: 'Two Men Contemplating the Moon', maker: 'Caspar David Friedrich · c. 1825–30', source: 'https://www.metmuseum.org/art/collection/search/438417', museum: 'The Metropolitan Museum of Art' },
    form: { title: 'Vase (Meiping) with Waves', maker: 'China · Yuan dynasty · Jizhou ware · 1200s–1300s', source: 'https://clevelandart.org/art/1980.186', museum: 'Cleveland Museum of Art' },
    poems: { title: 'Leaf from a Book of Hours: St. Matthew', maker: 'Limbourg Brothers · c. 1415–20', source: 'https://clevelandart.org/art/2005.204', museum: 'Cleveland Museum of Art' },
    colour: { title: 'Orpheus', maker: 'Odilon Redon · c. 1903–10', source: 'https://clevelandart.org/art/1926.25', museum: 'Cleveland Museum of Art' },
  };
  const pictures = [...document.querySelectorAll('[data-hero-scene]')];
  const credit = document.getElementById('arrival-credit');
  const artLink = document.getElementById('arrival-art-open');
  let current = 'water';
  controls.hidden = false;
  controls.addEventListener('click', event => {
    const button = event.target.closest('button[data-arrival]');
    if (!button || !works[button.dataset.arrival]) return;
    current = button.dataset.arrival;
    const work = works[current];
    const picture = pictures.find(image => image.dataset.heroScene === current);
    controls.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    pictures.forEach(image => {
      const active = image === picture;
      image.classList.toggle('is-current', active);
      image.setAttribute('aria-hidden', String(!active));
    });
    hero.dataset.view = current;
    credit.querySelector('cite').textContent = work.title;
    credit.querySelector('span').textContent = work.maker;
    document.getElementById('arrival-aura').src = picture.getAttribute('src');
    document.getElementById('begin-visit').href = `visit.html#${current}`;
    artLink.href = picture.getAttribute('src');
  });

  const motion = document.getElementById('home-motion');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let requestedMotion = true;
  function updateMotion() {
    const enabled = requestedMotion && !preference.matches;
    document.body.dataset.motion = enabled ? 'on' : 'off';
    motion.setAttribute('aria-pressed', String(enabled));
    motion.querySelector('span:last-child').textContent = enabled ? 'Motion on' : 'Motion off';
    motion.disabled = preference.matches;
    motion.title = preference.matches ? 'Your device prefers reduced motion' : 'Pause or resume the drifting artwork and light';
  }
  motion.hidden = false;
  motion.addEventListener('click', () => { requestedMotion = !requestedMotion; updateMotion(); });
  preference.addEventListener('change', updateMotion);
  updateMotion();
  let inView = true;
  const updateVisibility = () => hero.classList.toggle('is-visible', inView && !document.hidden);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; updateVisibility(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', updateVisibility);
  updateVisibility();

  const viewer = document.getElementById('arrival-viewer');
  if (typeof viewer.showModal !== 'function') return;
  artLink.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const picture = pictures.find(image => image.dataset.heroScene === current);
    const work = works[current];
    const image = document.getElementById('arrival-viewer-image');
    image.src = picture.getAttribute('src');
    image.alt = picture.alt;
    document.getElementById('arrival-viewer-title').textContent = work.title;
    document.getElementById('arrival-viewer-maker').textContent = work.maker;
    const source = document.getElementById('arrival-viewer-source');
    source.href = work.source;
    source.textContent = `${work.museum} · CC0 ↗`;
    viewer.showModal();
  });
  viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => artLink.focus({ preventScroll: true }));
})();

(() => {
  'use strict';
  const form = document.getElementById('search-form');
  const input = document.getElementById('q');
  const status = document.getElementById('search-status');
  const results = document.getElementById('results');
  const more = document.getElementById('search-more');
  let catalogue;
  let requestId = 0;
  let matches = [];
  let shown = 0;
  let activeQuery = '';
  const pageSize = 12;
  const normalize = text => String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  function https(value) {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
    catch { return ''; }
  }
  function imageURL(value) {
    const url = https(value);
    return /^https:\/\/artbitrage\.io\/(?:art|assets)\//.test(url) ? url.slice('https://artbitrage.io'.length) : url;
  }
  function node(tag, text) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    return element;
  }
  async function load() {
    if (!catalogue) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      catalogue = fetch('catalog/all.json', { signal: controller.signal }).then(response => {
        if (!response.ok) throw new Error('catalogue unavailable');
        return response.json();
      }).then(data => {
        if (!Array.isArray(data.artworks)) throw new Error('invalid catalogue');
        return data.artworks;
      }).catch(error => { catalogue = undefined; throw error; }).finally(() => clearTimeout(timeout));
    }
    return catalogue;
  }
  function renderMore() {
    const batch = matches.slice(shown, shown + pageSize);
    for (const work of batch) {
      const article = node('article'); article.className = 'result';
      const imageUrl = imageURL(work.thumbnail || work.image);
      if (imageUrl) {
        const image = node('img'); image.src = imageUrl;
        image.alt = work.title || 'Artwork'; image.loading = 'lazy';
        image.width = 400; image.height = 300;
        image.addEventListener('error', () => image.remove(), { once: true });
        article.append(image);
      }
      article.append(node('h3', work.title || 'Untitled'));
      article.append(node('p', [work.artist, work.date].filter(Boolean).join(' · ')));
      article.append(node('p', work.source_name || 'Museum collection'));
      const rightsText = work.license || 'unverified — check the source before reuse';
      article.append(node('p', 'Source rights · ' + rightsText + '. Check the museum record before reuse.'));
      const source = https(work.url);
      if (source) { const link = node('a', 'View at the museum ↗'); link.href = source; article.append(link); }
      results.append(article);
    }
    shown += batch.length;
    more.hidden = shown >= matches.length;
    status.textContent = matches.length ? `Showing ${shown} of ${matches.length} ${matches.length === 1 ? 'work' : 'works'} for “${activeQuery}”.` : `No works found for “${activeQuery}”. Try an artist, a title, or another word.`;
  }
  async function search(event) {
    event?.preventDefault();
    const query = input.value.trim();
    const thisRequest = ++requestId;
    activeQuery = query;
    results.replaceChildren(); more.hidden = true; matches = []; shown = 0;
    if (!query) { status.textContent = 'Enter a word, an artist, or a title to begin.'; return; }
    status.textContent = 'Looking through the collection…';
    try {
      const works = await load();
      if (thisRequest !== requestId) return;
      const terms = normalize(query).split(/\s+/);
      matches = works.filter(work => {
        const text = normalize([work.title, work.artist, work.medium, work.wing, work.note, work.source_name].join(' '));
        return terms.every(term => text.includes(term));
      });
      renderMore();
    } catch {
      if (thisRequest !== requestId) return;
      status.textContent = 'The catalogue could not load just now. Try again, or follow the River link below the search box.';
    }
  }
  form.addEventListener('submit', search);
  more.addEventListener('click', renderMore);
  document.querySelectorAll('[data-query]').forEach(button => {
    button.addEventListener('click', () => { input.value = button.dataset.query; search(); });
  });
})();
