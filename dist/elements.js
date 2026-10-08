/* Five ways of looking. Every change begins with a visitor's choice. */
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('elements-data').textContent);
  const phases = new Map(data.phases.map(phase => [phase.id, phase]));
  const works = new Map(data.works.map(work => [work.id, work]));
  const contentHashes = new Set(['#about-phases', '#elements-stage', '#main']);
  const panels = [...document.querySelectorAll('[data-phase-panel]')];
  const status = document.getElementById('elements-status');
  const retry = document.getElementById('elements-retry');
  let currentPhase = data.phases[0].id, currentWork = phases.get(currentPhase).works[0];
  let revision = 0, cancelImage = null, pending = null;
  const ordinaryClick = event => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  const route = (phase, work) => `${location.pathname}?work=${encodeURIComponent(work)}#${phase}`;
  function targetFromURL() {
    const phase = phases.has(location.hash.slice(1)) ? location.hash.slice(1) : data.phases[0].id;
    const requested = new URLSearchParams(location.search).get('work');
    return { phase, work: phases.get(phase).works.includes(requested) ? requested : phases.get(phase).works[0] };
  }
  function cancel() {
    revision++; cancelImage?.(); cancelImage = null; pending = null;
    status.textContent = ''; retry.hidden = true;
    document.getElementById('elements-stage').removeAttribute('aria-busy');
  }
  function ready(src, token) {
    return new Promise(resolve => {
      const image = new Image(); let settled = false;
      const finish = ok => {
        if (settled) return; settled = true; clearTimeout(timer);
        image.onload = image.onerror = null;
        if (cancelImage === stop) cancelImage = null;
        resolve(ok && token === revision);
      };
      const stop = () => finish(false);
      const timer = setTimeout(() => finish(false), 8000);
      cancelImage = stop; image.onload = () => finish(true); image.onerror = () => finish(false); image.src = src;
    });
  }
  function reveal(phaseId, workId, focusHeading = false) {
    const phase = phases.get(phaseId), work = works.get(workId), panel = document.getElementById(phaseId);
    const image = panel.querySelector('[data-main-image]');
    image.src = work.image; image.alt = work.alt; image.width = work.width; image.height = work.height;
    panel.querySelector('[data-full-image]').href = work.image;
    panel.querySelector('[data-full-image]').setAttribute('aria-label', `Open the whole image of ${work.title}`);
    panel.querySelector('.art-atmosphere').style.backgroundImage = `url("${work.image}")`;
    panel.querySelector('[data-work-title]').textContent = work.title;
    panel.querySelector('[data-work-maker]').textContent = [work.maker, work.date].filter(Boolean).join(' · ');
    panel.querySelector('[data-work-medium]').textContent = work.medium;
    panel.querySelector('[data-work-source]').href = work.source;
    panel.querySelector('[data-work-prompt]').textContent = work.looking[0];
    panel.querySelector('[data-work-affinity]').textContent = work.affinity[phaseId];
    panel.querySelector('[data-work-stay]').href = `/trip?from=elements&phase=${phaseId}&work=${encodeURIComponent(work.id)}`;
    panel.querySelector('[data-work-behind]').href = work.behind || '/behind-the-work#care';
    const other = work.phases.find(id => id !== phaseId), echo = panel.querySelector('[data-work-echo]');
    echo.hidden = !other;
    if (other) { echo.href = route(other, workId); echo.textContent = `See this work through ${phases.get(other).title} ↗`; }
    panel.querySelectorAll('[data-work-choice]').forEach(link => {
      if (link.dataset.workChoice === workId) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    panels.forEach(item => { item.hidden = item.id !== phaseId; item.inert = item.id !== phaseId; });
    document.querySelectorAll('#phase-nav [data-phase-link]').forEach(link => {
      if (link.dataset.phaseLink === phaseId) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    currentPhase = phaseId; currentWork = workId;
    document.body.dataset.phase = phaseId;
    if (focusHeading) panel.querySelector('[data-phase-heading]').focus();
  }
  async function choose(phase, work, { historyMode = 'push', focusHeading = false } = {}) {
    if (!phases.has(phase) || !phases.get(phase).works.includes(work) || !works.has(work)) return;
    cancel(); const token = revision;
    const request = { phase, work, historyMode, focusHeading };
    pending = request; status.textContent = 'Opening a work…';
    document.getElementById('elements-stage').setAttribute('aria-busy', 'true');
    const loaded = await ready(works.get(work).image, token);
    if (token !== revision) return;
    document.getElementById('elements-stage').removeAttribute('aria-busy');
    if (!loaded) {
      status.textContent = 'That image could not load just now. This work is still here; try again or follow another door.';
      retry.hidden = false;
      // A failed history navigation must not leave the address describing a
      // different work from the one still on display.
      if (historyMode !== 'none') history.replaceState(null, '', route(currentPhase, currentWork));
      return;
    }
    const focusWasRetry = document.activeElement === retry;
    pending = null; status.textContent = ''; retry.hidden = true;
    reveal(phase, work, focusHeading || focusWasRetry);
    const destination = route(phase, work);
    if (historyMode !== 'none' && `${location.pathname}${location.search}${location.hash}` !== destination) {
      if (historyMode === 'push') history.pushState(null, '', destination);
      else history.replaceState(null, '', destination);
    }
  }
  function phaseClick(event) {
    if (!ordinaryClick(event)) return;
    const link = event.currentTarget, phase = link.getAttribute('href').slice(1);
    if (!phases.has(phase)) return;
    event.preventDefault();
    choose(phase, phases.get(phase).works[0], { focusHeading: link.hasAttribute('data-phase-next') });
  }
  document.querySelectorAll('[data-phase-link], [data-phase-next]').forEach(link => link.addEventListener('click', phaseClick));
  document.querySelectorAll('[data-work-choice]').forEach(link => link.addEventListener('click', event => {
    if (!ordinaryClick(event)) return;
    event.preventDefault(); choose(link.closest('[data-phase-panel]').id, link.dataset.workChoice);
  }));
  document.querySelectorAll('[data-work-echo]').forEach(link => link.addEventListener('click', event => {
    if (!ordinaryClick(event)) return;
    event.preventDefault();
    const target = new URL(link.href);
    choose(target.hash.slice(1), target.searchParams.get('work'), { focusHeading: true });
  }));
  retry.addEventListener('click', () => { if (pending) choose(pending.phase, pending.work, { ...pending, focusHeading: true }); });
  let historyScheduled = false;
  function followHistory() {
    if (contentHashes.has(location.hash)) { cancel(); return; }
    // A back traversal can emit both popstate and hashchange. Read its final
    // address once, without issuing two competing image loads.
    if (historyScheduled) return;
    historyScheduled = true;
    queueMicrotask(() => {
      historyScheduled = false;
      const target = targetFromURL();
      if (pending?.phase === target.phase && pending?.work === target.work) return;
      choose(target.phase, target.work, { historyMode: 'replace', focusHeading: true });
    });
  }
  window.addEventListener('popstate', followHistory); window.addEventListener('hashchange', followHistory);
  function restWhenAway() {
    const interrupted = Boolean(pending); cancel();
    if (interrupted && !contentHashes.has(location.hash)) history.replaceState(null, '', route(currentPhase, currentWork));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) restWhenAway(); });
  window.addEventListener('pagehide', restWhenAway);
  document.body.dataset.enhanced = 'true';
  reveal(currentPhase, currentWork);
  const first = targetFromURL();
  choose(first.phase, first.work, { historyMode: contentHashes.has(location.hash) ? 'none' : 'replace' });
})();
