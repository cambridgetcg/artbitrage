/* The visit stays an ordinary, navigable document. Sound and viewers are opt-in. */
(() => {
  'use strict';
  const rooms = [...document.querySelectorAll('.gallery-room')];
  const stops = [...document.querySelectorAll('.room-stops a')];
  const planStops = [...document.querySelectorAll('[data-map-room]')];
  const count = document.getElementById('room-count');
  let activeRoom = 0;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = document.getElementById('motion-toggle');
  const motionLabel = document.getElementById('motion-label');
  const driftButton = document.getElementById('drift-toggle');
  const driftStatus = document.getElementById('drift-status');
  let drifting = false;
  let driftTimer;

  function setMotion(on) {
    const enabled = on && !reducedMotion.matches;
    document.body.dataset.motion = enabled ? 'on' : 'off';
    document.querySelectorAll('[data-breathing]').forEach(host => {
      host.dataset.breathMotion = enabled ? 'on' : 'off';
      host.breathing?.pause();
    });
    motionButton.setAttribute('aria-pressed', String(enabled));
    motionLabel.textContent = enabled ? 'Motion on' : 'Motion off';
    if (!enabled) stopDrift();
  }

  function stopDrift() {
    clearTimeout(driftTimer);
    if (drifting) driftStatus.textContent = 'Drifting paused. Wander at your own pace.';
    drifting = false;
    driftButton.setAttribute('aria-pressed', 'false');
    driftButton.textContent = 'Start drifting ▷';
  }

  function nextDrift() {
    clearTimeout(driftTimer);
    driftTimer = setTimeout(() => {
      if (!drifting || document.hidden) return stopDrift();
      if (activeRoom >= rooms.length - 1) {
        stopDrift();
        driftStatus.textContent = 'You have reached the last room. Stay a while, or choose where to wander next.';
        return;
      }
      const next = activeRoom + 1;
      rooms[next].scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${rooms[next].id}`);
      markRoom(next);
      driftStatus.textContent = `Room ${next + 1} of 5. ${rooms[next].dataset.name}.`;
      nextDrift();
    }, 45000);
  }

  driftButton.hidden = false;
  motionButton.hidden = false;
  driftButton.addEventListener('click', () => {
    if (drifting) return stopDrift();
    if (reducedMotion.matches) return;
    if (activeRoom === rooms.length - 1) {
      rooms[0].scrollIntoView({ behavior: 'instant', block: 'start' });
      history.replaceState(null, '', '#water');
      markRoom(0);
    }
    setMotion(true);
    drifting = true;
    driftButton.setAttribute('aria-pressed', 'true');
    driftButton.textContent = 'Pause drift Ⅱ';
    driftStatus.textContent = 'Drifting begins. Each room stays for 45 seconds. Scroll, use a control, or pause to linger.';
    nextDrift();
  });
  motionButton.addEventListener('click', () => setMotion(document.body.dataset.motion !== 'on'));
  function followMotionPreference() {
    motionButton.disabled = reducedMotion.matches;
    driftButton.disabled = reducedMotion.matches;
    motionButton.title = reducedMotion.matches ? 'Your device prefers reduced motion' : 'Pause or resume the drifting artwork and light';
    setMotion(!reducedMotion.matches);
  }
  reducedMotion.addEventListener('change', followMotionPreference);
  followMotionPreference();
  // Any deliberate interaction gives the visitor control of the pace again.
  window.addEventListener('wheel', stopDrift, { passive: true });
  window.addEventListener('touchstart', event => {
    if (!event.target.closest('#drift-toggle')) stopDrift();
  }, { passive: true });
  document.addEventListener('click', event => {
    if (event.target.closest('a, button, summary, input, select') && !event.target.closest('#drift-toggle')) stopDrift();
  });
  document.addEventListener('keydown', event => {
    if (event.key === ' ' && event.target.closest('#drift-toggle')) return;
    if (['Tab', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) stopDrift();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopDrift(); });
  window.addEventListener('pagehide', stopDrift);

  function markRoom(index) {
    activeRoom = index;
    rooms.forEach((room, i) => room.classList.toggle('is-active', i === index));
    [stops, planStops].forEach(links => links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }));
    count.textContent = `${String(index + 1).padStart(2, '0')} / 05`;
    document.body.dataset.room = rooms[index].id;
  }

  // Track the room at eye level. Scrolling stays entirely under visitor control.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) markRoom(Number(entry.target.dataset.room));
    }, { rootMargin: '-25% 0px -60% 0px', threshold: 0 });
    rooms.forEach(room => observer.observe(room));
  }

  const returnFocus = new WeakMap();
  document.querySelectorAll('.visit-dialog').forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => returnFocus.get(dialog)?.focus({ preventScroll: true }));
  });
  function openDialog(dialog, opener) {
    returnFocus.set(dialog, opener);
    dialog.showModal();
  }

  const map = document.getElementById('room-map');
  const mapButton = document.getElementById('room-map-toggle');
  const viewer = document.getElementById('art-viewer');
  const previousWork = document.getElementById('viewer-previous');
  const nextWork = document.getElementById('viewer-next');
  let viewerWorks = [];
  let viewerIndex = 0;
  const behindStories = { water: 'seurat', 'hokusai-great-wave': 'wave', form: 'jar' };
  function showWork(index) {
    if (index < 0 || index >= viewerWorks.length) return;
    viewerIndex = index;
    const link = viewerWorks[index];
    const behind = document.getElementById('viewer-behind');
    const story = behindStories[link.dataset.art];
    behind.href = `/behind-the-work#${story || 'care'}`;
    behind.textContent = story ? 'Behind this work ↗' : 'Making & caring for art ↗';
    behind.hidden = false;
    const exhibit = link.closest('.exhibit');
    const image = link.querySelector('img');
    const enlarged = document.getElementById('viewer-image');
    enlarged.src = image.currentSrc || image.src;
    enlarged.alt = image.alt;
    document.getElementById('viewer-title').textContent = exhibit.querySelector('cite').textContent;
    document.getElementById('viewer-maker').textContent = exhibit.querySelector('.work-heading p').textContent;
    document.getElementById('viewer-source').href = exhibit.querySelector('.museum-source').href;
    document.getElementById('viewer-position').textContent = `${link.closest('.gallery-room').dataset.name} · ${index + 1} of ${viewerWorks.length}`;
    const focusedControl = document.activeElement;
    previousWork.disabled = index === 0;
    nextWork.disabled = index === viewerWorks.length - 1;
    // Keep keyboard focus in the viewer when its current button reaches an end.
    if (viewer.open && index === viewerWorks.length - 1 && focusedControl === nextWork) previousWork.focus();
    if (viewer.open && index === 0 && focusedControl === previousWork) nextWork.focus();
  }
  if (typeof map.showModal === 'function') {
    mapButton.hidden = false;
    mapButton.addEventListener('click', () => openDialog(map, mapButton));
    planStops.forEach(link => link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const index = Number(link.dataset.mapRoom);
      const destination = rooms[index];
      returnFocus.delete(map);
      map.close();
      location.hash = destination.id;
      destination.focus({ preventScroll: true });
      markRoom(index);
    }));
    document.querySelectorAll('.artwork-view').forEach(link => link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      viewerWorks = [...link.closest('.gallery-room').querySelectorAll('.artwork-view')];
      showWork(viewerWorks.indexOf(link));
      openDialog(viewer, link);
    }));
    previousWork.addEventListener('click', () => showWork(viewerIndex - 1));
    nextWork.addEventListener('click', () => showWork(viewerIndex + 1));
    viewer.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      showWork(viewerIndex + (event.key === 'ArrowRight' ? 1 : -1));
    });
  }

  // Visitors can rearrange these works without changing their source records.
  const encounter = document.getElementById('encounter-dialog');
  const encounterSection = document.getElementById('between-works');
  const workLinks = [...document.querySelectorAll('.gallery-room .artwork-view[data-art]')];
  const works = new Map(workLinks.map(link => {
    const exhibit = link.closest('.exhibit');
    const image = link.querySelector('img');
    return [link.dataset.art, {
      id: link.dataset.art,
      title: exhibit.querySelector('cite').textContent,
      maker: exhibit.querySelector('.work-heading p').textContent.trim(),
      src: image.getAttribute('src'),
      alt: image.alt,
      source: exhibit.querySelector('.museum-source').href,
      room: link.closest('.gallery-room'),
    }];
  }));
  const starters = [...document.querySelectorAll('.echo-card')].map(card => ({
    pair: card.dataset.pair.split(','),
    prompt: card.querySelector('.echo-description').textContent,
    question: card.querySelector('.echo-question').textContent,
  }));
  const selects = [document.getElementById('encounter-left'), document.getElementById('encounter-right')];
  const figures = [...encounter.querySelectorAll('.encounter-work')];
  const stage = encounter.querySelector('.encounter-stage');
  const besideButton = document.getElementById('encounter-beside');
  const layerButton = document.getElementById('encounter-layer');
  const mix = document.getElementById('encounter-mix');
  const shareURL = document.getElementById('encounter-url');
  const shareStatus = document.getElementById('encounter-status');
  let pair = starters[0].pair.slice();
  let arrangement = 'beside';

  function validPair(ids) {
    return ids.length === 2 && ids[0] !== ids[1] && ids.every(id => works.has(id));
  }

  function updateEncounterLink() {
    // Only the chosen works and display settings travel in a shared link.
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('pair', pair.join(','));
    if (arrangement === 'layer') {
      url.searchParams.set('view', 'layer');
      url.searchParams.set('mix', mix.value);
    }
    url.hash = 'between-works';
    shareURL.value = url.href;
    shareStatus.textContent = '';
  }

  function arrangeEncounter() {
    const layered = arrangement === 'layer';
    stage.dataset.view = arrangement;
    stage.style.setProperty('--mix', String(Number(mix.value) / 100));
    besideButton.setAttribute('aria-pressed', String(!layered));
    layerButton.setAttribute('aria-pressed', String(layered));
    encounter.querySelector('.layer-control').hidden = !layered;
    document.getElementById('encounter-balance').value = `${mix.value}%`;
    mix.setAttribute('aria-valuetext', `${mix.value}% ${works.get(pair[1]).title}`);
    document.getElementById('encounter-note').textContent = layered
      ? 'A layered study of two images. Move to 0% or 100% to see either alone. Return to Beside each other to view both unchanged. Displayed sizes are not the objects’ relative sizes.'
      : 'Whole images fitted to your screen; their displayed sizes do not represent the objects’ relative sizes.';
    updateEncounterLink();
  }

  function renderEncounter() {
    pair.forEach((id, index) => {
      const work = works.get(id);
      const figure = figures[index];
      const image = figure.querySelector('img');
      image.src = work.src;
      image.alt = work.alt;
      figure.querySelector('h3').textContent = work.title;
      figure.querySelector('figcaption p').textContent = work.maker;
      figure.querySelector('figcaption a').href = work.source;
      selects[index].value = id;
      [...selects[index].options].forEach(option => { option.disabled = option.value === pair[1 - index]; });
    });
    const starter = starters.find(item => item.pair.every(id => pair.includes(id)));
    document.getElementById('encounter-prompt').textContent = starter?.prompt || 'You brought these works together. Give each a moment, then look at the space between them.';
    document.getElementById('encounter-question').textContent = starter?.question || 'What changes when you look from one to the other—a colour, a rhythm, a feeling? A difference can be a connection too.';
    encounter.querySelectorAll('[data-pair]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.pair.split(',').every(id => pair.includes(id))));
    });
    arrangeEncounter();
  }

  function openEncounter(ids, opener, view = 'beside', balance = 50) {
    if (!validPair(ids)) return;
    stopDrift();
    pair = ids.slice();
    arrangement = view;
    mix.value = String(balance);
    renderEncounter();
    openDialog(encounter, opener);
    encounter.scrollTop = 0;
  }

  if (typeof encounter.showModal === 'function') {
    selects.forEach((select, index) => {
      rooms.forEach(room => {
        const group = document.createElement('optgroup');
        group.label = room.dataset.name;
        for (const work of works.values()) {
          if (work.room !== room) continue;
          const option = document.createElement('option');
          option.value = work.id;
          option.textContent = work.title;
          group.append(option);
        }
        select.append(group);
      });
      select.addEventListener('change', () => {
        const candidate = pair.slice();
        candidate[index] = select.value;
        if (validPair(candidate)) pair = candidate;
        renderEncounter();
      });
    });
    document.querySelectorAll('[data-encounter]').forEach(opener => {
      opener.hidden = false;
      opener.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openEncounter(opener.dataset.encounter.split(','), opener);
      });
    });
    encounter.querySelectorAll('[data-pair]').forEach(button => button.addEventListener('click', () => {
      pair = button.dataset.pair.split(',');
      mix.value = '50';
      renderEncounter();
    }));
    besideButton.addEventListener('click', () => { arrangement = 'beside'; arrangeEncounter(); });
    layerButton.addEventListener('click', () => { arrangement = 'layer'; arrangeEncounter(); });
    mix.addEventListener('input', arrangeEncounter);
    document.getElementById('encounter-copy').addEventListener('click', async () => {
      const value = shareURL.value;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(value);
        if (shareURL.value === value) shareStatus.textContent = 'Link copied. This pairing can meet someone else.';
      } catch {
        if (shareURL.value !== value) return;
        shareURL.focus();
        shareURL.select();
        shareStatus.textContent = 'Select and copy the link above to keep this pairing.';
      }
    });
    const pairButton = document.getElementById('viewer-pair');
    pairButton.hidden = false;
    pairButton.addEventListener('click', () => {
      const id = viewerWorks[viewerIndex].dataset.art;
      const starter = starters.find(item => item.pair.includes(id));
      const partner = starter
        ? starter.pair.find(other => other !== id)
        : [...works.values()].find(other => other.room !== works.get(id).room).id;
      const opener = returnFocus.get(viewer) || viewerWorks[viewerIndex];
      returnFocus.delete(viewer);
      viewer.close();
      openEncounter([id, partner], opener);
    });
  }

  // A pause belongs to the work the visitor is already spending time with.
  const breathingDialog = document.getElementById('breathing-dialog');
  const breathingHost = document.getElementById('gallery-breath-host');
  const breathButton = document.getElementById('breath-toggle');
  const viewerRest = document.getElementById('viewer-rest');
  function openRest(id, opener) {
    const work = works.get(id);
    if (!work) return;
    stopDrift();
    breathingHost.breathing?.pause();
    const image = document.getElementById('breathing-work-image');
    image.src = work.src;
    image.alt = work.alt;
    document.getElementById('breathing-backdrop').src = work.src;
    document.getElementById('breathing-work-title').textContent = work.title;
    document.getElementById('breathing-work-maker').textContent = work.maker;
    document.getElementById('breathing-work-source').href = work.source;
    const destination = new URL('/trip', location.origin);
    destination.searchParams.set('work', work.id);
    destination.searchParams.set('room', work.room.id);
    document.getElementById('breathing-trip').href = destination.pathname + destination.search;
    openDialog(breathingDialog, opener);
    breathingDialog.scrollTop = 0;
  }
  if (typeof breathingDialog.showModal === 'function') {
    document.body.classList.add('breathing-available');
    breathButton.hidden = false;
    viewerRest.hidden = false;
    breathButton.addEventListener('click', () => {
      const room = rooms[activeRoom];
      const top = document.querySelector('.visit-header').getBoundingClientRect().bottom;
      const bottom = document.querySelector('.visit-route').getBoundingClientRect().top;
      const middle = (top + bottom) / 2;
      const visible = workLinks.filter(link => link.closest('.gallery-room') === room)
        .map(link => ({ link, rect: link.closest('.exhibit').getBoundingClientRect() }))
        .filter(({ rect }) => rect.bottom > top && rect.top < bottom)
        .sort((a, b) => Math.abs((a.rect.top + a.rect.bottom) / 2 - middle) - Math.abs((b.rect.top + b.rect.bottom) / 2 - middle));
      openRest((visible[0]?.link || room.querySelector('.artwork-view')).dataset.art, breathButton);
    });
    document.querySelectorAll('[data-rest-work]').forEach(link => {
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openRest(link.dataset.restWork, link);
      });
    });
    viewerRest.addEventListener('click', () => {
      const link = viewerWorks[viewerIndex];
      const opener = returnFocus.get(viewer) || link;
      returnFocus.delete(viewer);
      viewer.close();
      openRest(link.dataset.art, opener);
    });
  }

  const audioButton = document.getElementById('sound-toggle');
  const audioLabel = document.getElementById('sound-label');
  const audioStatus = document.getElementById('sound-status');
  const volumeLabel = document.querySelector('.volume-control');
  const volume = document.getElementById('sound-volume');
  const soundtrack = document.getElementById('gallery-soundtrack');
  const quietSound = document.getElementById('breathing-sound');
  const quietVolume = document.getElementById('breathing-volume');
  const quietSoundStatus = document.getElementById('breathing-sound-status');
  let pending = false;
  let requested = false;
  let revision = 0;
  let statusTimer;

  function soundMessage(message, temporary = false) {
    clearTimeout(statusTimer);
    audioStatus.textContent = message;
    quietSoundStatus.textContent = message;
    if (temporary) statusTimer = setTimeout(() => { audioStatus.textContent = ''; quietSoundStatus.textContent = ''; }, 4500);
  }

  function soundUI() {
    const playing = !soundtrack.paused;
    audioButton.setAttribute('aria-pressed', String(playing));
    audioLabel.textContent = playing || pending ? 'Pause music' : 'Play music';
    volumeLabel.hidden = !playing;
    quietSound.setAttribute('aria-pressed', String(playing));
    quietSound.textContent = playing || pending ? 'Pause music' : 'Play music';
    document.getElementById('breathing-volume-control').hidden = !playing;
  }

  function stopSound(message = '') {
    revision++;
    requested = false;
    pending = false;
    soundtrack.pause();
    soundUI();
    soundMessage(message, Boolean(message));
  }

  function soundFailed() {
    stopSound();
    soundMessage('Music could not start. Try Play music again, or open the soundtrack under Music for wandering in the first room.');
  }

  function startSound() {
    const request = ++revision;
    requested = true;
    pending = true;
    soundMessage('Loading Rooms of Light…');
    soundUI();
    try {
      if (soundtrack.error) soundtrack.load();
      // Keep play() inside the visitor's gesture, before any asynchronous work.
      const playback = soundtrack.play();
      Promise.resolve(playback).then(() => {
        if (request !== revision) {
          // A cancelled request must not revive sound or stop a newer request.
          if (!requested) soundtrack.pause();
          return;
        }
        if (document.hidden) return stopSound();
        pending = false;
        soundUI();
      }).catch(() => {
        if (request === revision) soundFailed();
      });
    } catch {
      if (request === revision) soundFailed();
    }
  }

  soundtrack.volume = Number(volume.value) / 100;
  audioButton.hidden = false;
  [audioButton, quietSound].forEach(button => button.addEventListener('click', () => {
    if (pending || !soundtrack.paused) stopSound('Music paused.');
    else startSound();
  }));
  soundtrack.addEventListener('play', () => {
    if (document.hidden) return stopSound();
    if (soundtrack.paused) return;
    requested = true;
    soundUI();
  });
  soundtrack.addEventListener('playing', () => {
    if (document.hidden) return stopSound();
    if (soundtrack.paused) return;
    pending = false;
    requested = true;
    soundUI();
    soundMessage('Rooms of Light is playing.', true);
  });
  soundtrack.addEventListener('pause', () => {
    if (!soundtrack.paused) return;
    revision++;
    pending = false;
    requested = false;
    soundUI();
    // A native-control pause can interrupt loading too. Keep failure guidance
    // intact when a queued pause event follows an error.
    if (audioStatus.textContent.startsWith('Loading') || audioStatus.textContent === 'Rooms of Light is playing.') {
      soundMessage('Music paused.', true);
    }
  });
  soundtrack.addEventListener('waiting', () => {
    if (!soundtrack.paused) soundMessage('Loading the next moment…');
  });
  soundtrack.addEventListener('error', soundFailed);
  soundtrack.addEventListener('volumechange', () => {
    volume.value = soundtrack.muted ? '0' : String(Math.round(soundtrack.volume * 100));
    quietVolume.value = volume.value;
  });
  [volume, quietVolume].forEach(input => input.addEventListener('input', () => {
    soundtrack.volume = Number(input.value) / 100;
    soundtrack.muted = false;
    volume.value = input.value;
    quietVolume.value = input.value;
  }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopSound();
  });
  window.addEventListener('pagehide', () => stopSound());

  const initialRoom = rooms.findIndex(room => `#${room.id}` === location.hash);
  markRoom(initialRoom < 0 ? (location.hash === '#between-works' ? 4 : 0) : initialRoom);

  // A shared meeting is bounded by the local catalogue; URL text never becomes
  // markup, an image URL, or a request to an outside service.
  const params = new URLSearchParams(location.search);
  const sharedPair = (params.get('pair') || '').split(',');
  const sharedView = params.get('view') || 'beside';
  const sharedMix = params.get('mix');
  const validMix = sharedMix === null || (/^\d{1,3}$/.test(sharedMix) && Number(sharedMix) <= 100);
  if (typeof encounter.showModal === 'function' && params.getAll('pair').length === 1
      && validPair(sharedPair) && ['beside', 'layer'].includes(sharedView) && validMix) {
    encounterSection.scrollIntoView({ behavior: 'instant', block: 'start' });
    openEncounter(sharedPair, encounterSection, sharedView, sharedMix === null ? 50 : Number(sharedMix));
  }
})();
