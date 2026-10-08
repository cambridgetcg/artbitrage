(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const door = $('trip-door'), gallery = $('trip-gallery');
  const stage = $('trip-stage'), layers = [...stage.querySelectorAll('.trip-layer')];
  const breathHost = $('trip-breath-host');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const rooms = new Set(['water', 'dusk', 'form', 'poems', 'colour']);
  const params = new URLSearchParams(location.search), requestedWork = params.get('work');
  const fromElements = params.get('from') === 'elements';
  const fromNoticing = params.get('from') === 'noticing';
  const elementPhases = new Set(['wood', 'fire', 'earth', 'metal', 'water']);
  if (rooms.has(params.get('room'))) $('trip-return').href = `/visit#${params.get('room')}`;
  const fallback = {
    id: 'form', title: 'Moon Jar', maker: 'Korea · Joseon dynasty',
    image: '/assets/welcome/moon-jar.jpg',
    alt: 'A rounded white porcelain moon jar with a gently uneven outline.',
    source: 'https://www.artic.edu/artworks/158472', route: 'quiet-forms',
    looking: ['Follow the outline of the jar, from its small rim to its rounded sides.', 'Notice where the white surface meets shadow. Let your eyes stay with one soft edge.']
  };
  const routes = {
    'water-air': 'Open water, reflections, and room to look.',
    'quiet-forms': 'Rounded edges, woven textures, and the shapes of ordinary things.',
    'colour-light': 'Gardens, small marks, and brighter rhythms of colour.',
    wider: 'The original collection: a wider range of moods, including intense scenes, conflict, and loss.'
  };
  let legacy = [];
  try {
    legacy = JSON.parse($('dataset').textContent).works.map((w, i) => ({
      id: `legacy-${i}`, title: w.t, maker: w.a, image: w.img,
      alt: `${w.t} — ${w.a}`, source: null
    })).filter(w => typeof w.image === 'string' && /^\/art\/[^/]+\.jpg$/.test(w.image));
  } catch {}
  let curated = [fallback], catalogueFailed = false;
  let collection = 'water-air', order = [], cursor = -1;
  let current = null, currentLayer = 0, practice = 'look';
  let drifting = false, driftTimer, creditTimer, loading = false, imageRevision = 0, cancelImage = null;
  let entryTouched = false, opened = false, lookingIndex = 0, anchorIndex = 0;
  const validWork = w => w && typeof w.id === 'string' && typeof w.title === 'string'
    && typeof w.maker === 'string' && typeof w.alt === 'string'
    && /^\/assets\/(?:trip|visit|welcome|guide|elements|noticing)\/[a-z0-9-]+\.jpg$/.test(w.image)
    && /^https:\/\/www\.artic\.edu\/artworks\/\d+(?:\/[a-z0-9-]+)?$/.test(w.source);
  async function fetchJSON(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(path, { signal: controller.signal });
      if (!response.ok) throw new Error('Catalogue unavailable');
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  function collectionNote() {
    $('trip-collection-note').textContent = routes[collection] +
      (catalogueFailed && collection !== 'wider' ? ' This path could not load just now; the Moon Jar is here to stay with.' : '');
  }
  // Cache the catalogue; a late response never chooses a mode, path or image.
  const catalogueReady = fetchJSON('/assets/trip/works.json').then(data => {
    const records = Array.isArray(data?.works) ? data.works.filter(w => validWork(w)
      && ['water-air', 'quiet-forms', 'colour-light'].includes(w.route)
      && Array.isArray(w.looking) && w.looking.length >= 2 && w.looking.every(p => typeof p === 'string')) : [];
    if (!records.length) throw new Error('Empty catalogue');
    curated = records;
    if (current) { showLooking(); showAnchor(); }
  }).catch(() => { catalogueFailed = true; }).finally(collectionNote);
  function shuffled(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function pool() {
    if (collection === 'wider') return legacy;
    const works = curated.filter(w => w.route === collection);
    return works.length ? works : [fallback];
  }
  function resetOrder() {
    order = shuffled(pool()); cursor = -1;
    if (order.length > 1 && order[0].image === current?.image) [order[0], order[1]] = [order[1], order[0]];
  }
  function nextCandidate() {
    if (++cursor >= order.length) { resetOrder(); cursor = 0; }
    return order[cursor];
  }
  function message(text) { $('trip-art-status').textContent = text; }
  function updateDrift() {
    document.body.dataset.drifting = String(drifting);
    $('trip-pause').setAttribute('aria-pressed', String(drifting));
    $('trip-pause').textContent = practice === 'ground' ? 'Held still' : reduced.matches ? 'Still view' : drifting ? 'Pause drift' : 'Let works drift';
    $('trip-pause').disabled = reduced.matches || practice === 'ground';
    $('trip-motion-note').hidden = !reduced.matches;
  }
  function cancelLoading() {
    imageRevision++; cancelImage?.(); cancelImage = null;
    if (loading) message('');
    loading = false; $('trip-next').disabled = false;
  }
  function pauseDrift() {
    clearTimeout(driftTimer); drifting = false; cancelLoading();
    layers.forEach(layer => layer.getAnimations?.().forEach(animation => animation.finish()));
    clearTimeout(creditTimer); renderCredits(current ? [current] : []);
    updateDrift();
  }
  function scheduleDrift(delay = 55000) {
    clearTimeout(driftTimer);
    if (drifting && !document.hidden && document.body.dataset.mode === 'art' && practice !== 'ground')
      driftTimer = setTimeout(() => loadNext(true), delay);
  }
  function beginDrift() {
    if (reduced.matches || document.hidden || practice === 'ground') return;
    drifting = true; updateDrift();
    if (current) scheduleDrift(); else loadNext(false);
  }
  function imageReady(src, token) {
    return new Promise(resolve => {
      const image = new Image(); let done = false;
      const finish = ok => {
        if (done) return; done = true; clearTimeout(timer);
        image.onload = image.onerror = null;
        if (cancelImage === cancel) cancelImage = null;
        resolve(ok && token === imageRevision);
      };
      const cancel = () => finish(false);
      const timer = setTimeout(() => finish(false), 8000);
      cancelImage = cancel; image.onload = () => finish(true); image.onerror = () => finish(false); image.src = src;
    });
  }
  function lookingLines() {
    const enriched = curated.find(w => w.id === current?.id);
    return current?.looking || enriched?.looking || [
      'Let your eyes find one colour or shape in the artwork. You can stay there a while.',
      'Follow an edge in the picture. Notice where it curves, meets another shape, or disappears.'
    ];
  }
  function showLooking() { $('trip-looking-prompt').textContent = lookingLines()[lookingIndex % 2]; }
  function showAnchor() {
    const details = lookingLines();
    const lines = [
      ['In the artwork', details[0]],
      ['In your room', 'Look away from the screen for a moment. Find a colour in the room around you.'],
      ['Back with the work', details[1]],
      ['Where you are', 'Notice the support beneath your feet, seat, or back. You can stay just as you are.'],
      ['Around you', 'If you like, notice a sound nearby. Then listen for one farther away. Silence is welcome too.'],
      ['At your own pace', 'Let an ordinary breath come and go. Stay here, look again, or return to your day.']
    ];
    $('trip-anchor-step').textContent = `${anchorIndex + 1} / ${lines.length} · ${lines[anchorIndex][0]}`;
    $('trip-anchor-prompt').textContent = lines[anchorIndex][1];
  }
  function renderCredits(works) {
    const credit = $('trip-art-credit'); credit.replaceChildren(); credit.hidden = true;
    const seen = new Set();
    for (const work of works) {
      if (seen.has(work.id)) continue;
      seen.add(work.id);
      if (typeof work.attribution === 'string' && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(work.attributionSource)
        && work.attributionLicense === 'https://creativecommons.org/licenses/by-sa/4.0/') {
        const photo = document.createElement('a'), license = document.createElement('a');
        photo.href = work.attributionSource; photo.textContent = `${work.title} · ${work.attribution}`;
        license.href = work.attributionLicense; license.textContent = 'Licence ↗';
        if (credit.childNodes.length) credit.append(document.createTextNode(' · '));
        credit.append(photo, document.createTextNode(' · '), license); credit.hidden = false;
      }
    }
  }
  function showWork(work, animated = false) {
    const previous = current;
    const next = current ? 1 - currentLayer : currentLayer;
    const image = layers[next].querySelector('img'); image.src = work.image; image.alt = work.alt || `${work.title} — ${work.maker}`;
    layers.forEach((layer, i) => {
      layer.style.transitionDuration = animated && !reduced.matches ? '12s' : '0s';
      layer.classList.toggle('is-current', i === next); layer.setAttribute('aria-hidden', String(i !== next));
    });
    currentLayer = next; current = work; lookingIndex = 0; anchorIndex = 0;
    stage.dataset.work = work.id;
    stage.querySelector('.trip-glow').style.backgroundImage = `url("${work.image}")`;
    $('trip-art-title').textContent = work.title;
    $('trip-art-maker').textContent = [work.maker, work.date].filter(Boolean).join(' · ');
    const source = $('trip-art-source'); source.href = work.source || '/atlas';
    source.textContent = work.source ? 'View the museum record ↗' : 'Explore the Atlas ↗';
    clearTimeout(creditTimer);
    const fading = animated && !reduced.matches && previous;
    renderCredits(fading ? [work, previous] : [work]);
    if (fading && previous.attribution) creditTimer = setTimeout(() => renderCredits(current ? [current] : []), 12000);
    showLooking(); showAnchor(); message(''); $('trip-retry').hidden = true;
  }
  async function loadNext(animated = false) {
    clearTimeout(driftTimer); cancelLoading();
    const token = imageRevision, selected = collection;
    loading = true; $('trip-next').disabled = true; message('Looking for the next work…');
    if (selected !== 'wider') await catalogueReady;
    if (token !== imageRevision || collection !== selected) return;
    if (!order.length) resetOrder();
    const deadline = performance.now() + 20000;
    for (let tries = 0; tries < pool().length && performance.now() < deadline; tries++) {
      const candidate = nextCandidate(); if (!candidate) break;
      if (await imageReady(candidate.image, token)) {
        if (token !== imageRevision || collection !== selected) return;
        showWork(candidate, animated); loading = false; $('trip-next').disabled = false;
        if (drifting) scheduleDrift(animated ? 67000 : 55000);
        return;
      }
      if (token !== imageRevision) return;
    }
    if (token !== imageRevision) return;
    pauseDrift(); message('The pictures could not load just now. You can stay with this work, try another, or take a breath.');
    $('trip-retry').hidden = false;
  }
  function setPractice(next) {
    if (next !== 'breathe') breathHost.breathing?.pause();
    practice = next;
    if (next === 'ground') { pauseDrift(); anchorIndex = 0; showAnchor(); }
    document.body.dataset.practice = next;
    [['look', 'trip-look', 'trip-look-surface'], ['breathe', 'trip-breathe', 'trip-breath-surface'], ['ground', 'trip-anchor', 'trip-anchor-surface']].forEach(([name, button, panel]) => {
      $(button).setAttribute('aria-pressed', String(next === name));
      $(panel).hidden = next !== name; $(panel).inert = next !== name;
    });
    updateDrift();
  }
  function enterArt() {
    entryTouched = true; $('trip-entry-status').textContent = '';
    door.hidden = true; door.inert = true; gallery.hidden = false; gallery.inert = false;
    document.body.dataset.mode = 'art'; gallery.focus({ preventScroll: true });
    if (!current) showWork(fallback);
  }
  function enterDoor() {
    pauseDrift(); stopSound(); breathHost.breathing?.pause();
    gallery.hidden = true; gallery.inert = true; door.hidden = false; door.inert = false;
    document.body.dataset.mode = 'entry'; $('trip-start').focus({ preventScroll: true });
  }
  function enterFromDoor(mode, drift) {
    pauseDrift(); enterArt(); setPractice(mode);
    if (drift && !reduced.matches) beginDrift();
    if (!opened) { opened = true; loadNext(false); }
  }
  $('trip-start').hidden = false; $('trip-just-breathe').hidden = false;
  $('trip-start').addEventListener('click', () => enterFromDoor('look', true));
  $('trip-just-breathe').addEventListener('click', () => enterFromDoor('breathe', false));
  $('trip-look').addEventListener('click', () => setPractice('look'));
  $('trip-breathe').addEventListener('click', () => setPractice('breathe'));
  $('trip-anchor').addEventListener('click', () => setPractice('ground'));
  $('trip-pause').addEventListener('click', () => drifting ? pauseDrift() : beginDrift());
  $('trip-next').addEventListener('click', () => { pauseDrift(); loadNext(false); });
  $('trip-retry').addEventListener('click', () => { pauseDrift(); loadNext(false); });
  $('trip-exit').addEventListener('click', enterDoor);
  $('trip-looking-next').addEventListener('click', () => { lookingIndex = (lookingIndex + 1) % 2; showLooking(); });
  $('trip-anchor-next').addEventListener('click', () => { anchorIndex = (anchorIndex + 1) % 6; showAnchor(); });
  $('trip-collection').addEventListener('change', event => {
    const selected = event.target.value; if (!Object.hasOwn(routes, selected)) return;
    pauseDrift(); collection = selected; order = []; cursor = -1; collectionNote(); loadNext(false);
  });
  breathHost.addEventListener('breathing-ready', () => { if (practice !== 'breathe') breathHost.breathing?.pause(); });
  reduced.addEventListener('change', () => { if (reduced.matches) pauseDrift(); updateDrift(); });
  updateDrift(); showLooking(); showAnchor();
 // One optional drone. Starting, cancellation and failure are explicit states.
 let context=null,master=null,soundOn=false,audioPending=false,audioWanted=false,audioRevision=0;
 const soundButtons=[...document.querySelectorAll('[data-trip-sound]')];
 function audioMessage(text){document.querySelectorAll('[data-audio-status]').forEach(el=>el.textContent=text);}
 function audioUI(){soundButtons.forEach(button=>{button.setAttribute('aria-pressed',String(soundOn));button.textContent=audioPending?'Cancel sound':soundOn?'Sound on':'Sound off';});document.querySelector('.trip-volume').hidden=!soundOn;}
 function buildAudio(){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Audio unavailable');context=new AC();master=context.createGain();master.gain.value=0;master.connect(context.destination);const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=400;filter.Q.value=.4;filter.connect(master);[0,3].forEach(detune=>{const voice=context.createOscillator();voice.type='sine';voice.frequency.value=110;voice.detune.value=detune;voice.connect(filter);voice.start();});}
 function mute(){if(!context||!master)return;try{master.gain.cancelScheduledValues(context.currentTime);master.gain.setValueAtTime(0,context.currentTime);Promise.resolve(context.suspend()).catch(()=>{});}catch{}}
 function stopSound(text=''){audioRevision++;audioWanted=false;audioPending=false;soundOn=false;mute();audioUI();audioMessage(text);}
 async function startSound(){const request=++audioRevision;audioWanted=true;audioPending=true;audioMessage('Starting a quiet sound…');audioUI();try{if(!context)buildAudio();await context.resume();if(request!==audioRevision){if(!audioWanted)mute();return;}if(document.hidden){stopSound();return;}if(context.state&&context.state!=='running')throw new Error('Audio did not start');audioPending=false;soundOn=true;master.gain.cancelScheduledValues(context.currentTime);master.gain.setValueAtTime(0,context.currentTime);master.gain.linearRampToValueAtTime(Number($('trip-volume').value)/100*.08,context.currentTime+6);audioUI();audioMessage('A quiet sound is playing. You can turn it off at any time.');}catch{if(request===audioRevision)stopSound('Sound could not start. Try again when you like; the room also works in silence.');}}
 soundButtons.forEach(button=>button.addEventListener('click',()=>{if(soundOn||audioPending)stopSound('Sound off.');else startSound();}));
 $('trip-volume').addEventListener('input',()=>{if(context&&master&&soundOn){master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(Number($('trip-volume').value)/100*.08,context.currentTime,.15);}});
 function restWhenAway(){pauseDrift();breathHost.breathing?.pause();stopSound();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)restWhenAway();});window.addEventListener('pagehide',restWhenAway);
 // A pebble is sent only by this explicit action, with an honest receipt.
 const pebble=$('trip-pebble');pebble.hidden=false;pebble.addEventListener('click',async()=>{pebble.disabled=true;$('trip-pebble-status').textContent='Leaving a pebble…';try{const response=await fetch('/api/pebbles',{method:'POST',headers:{'content-type':'application/json'},body:'{"at":"trip"}'});if(!response.ok)throw new Error('Pebble not accepted');$('trip-pebble-status').textContent='A pebble on the cairn. Thank you for being here.';pebble.textContent='A pebble left';}catch{$('trip-pebble-status').textContent='The pebble could not be left just now. You can try again.';pebble.disabled=false;}});
  // A gallery handoff is still and keeps the originating room. Only verified
  // local records can supply image paths and external source links.
  if (requestedWork && /^[a-z0-9-]{1,80}$/.test(requestedWork)) {
    $('trip-entry-status').textContent = 'Opening the work you brought with you…';
    fetchJSON(fromNoticing ? '/assets/noticing/works.json' : fromElements ? '/assets/elements/works.json' : '/assets/visit/works.json').then(async catalogue => {
      const records = fromElements || fromNoticing ? catalogue?.works : catalogue;
      if (entryTouched) return;
      const work = Array.isArray(records) ? records.find(item => item?.id === requestedWork) : null;
      const phase = fromElements && Array.isArray(work?.phases)
        ? (work.phases.includes(params.get('phase')) && elementPhases.has(params.get('phase'))
          ? params.get('phase') : work.phases.find(id => elementPhases.has(id))) : null;
      if (!validWork(work) || (fromElements ? !phase : !fromNoticing && !rooms.has(work.room))) throw new Error('Unknown work');
      const token = ++imageRevision;
      if (!await imageReady(work.image, token)) throw new Error('Image unavailable');
      if (entryTouched || token !== imageRevision) return;
      $('trip-return').href = fromNoticing ? `/noticing#${encodeURIComponent(work.id)}` : fromElements ? `/elements?work=${encodeURIComponent(work.id)}#${phase}` : `/visit#${work.room}`;
      if (fromNoticing) $('trip-return').textContent = 'Back to the notebook ↗';
      else if (fromElements) $('trip-return').textContent = 'Back to the five phases ↗';
      enterArt(); pauseDrift(); opened = true; showWork(work);
      message('The work you brought is staying still. Breathe, ground, or let works drift whenever you like.');
    }).catch(() => {
      if (!entryTouched) $('trip-entry-status').textContent = 'That work could not be opened just now. The quiet room is still here for you.';
    });
  }
})();
