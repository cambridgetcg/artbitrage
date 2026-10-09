/* One optional breathing guide. It never starts itself or produces sound. */
(() => {
  'use strict';
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const template = document.createElement('template');
  template.innerHTML = `
    <div class="breath-module">
      <div class="breath-orbit" aria-hidden="true"><div class="breath-ring"></div><span class="breath-centre"></span></div>
      <div class="breath-cue"><p class="breath-phase" aria-live="off" aria-atomic="true">Your own pace.</p><p class="breath-count">There is no count to keep.</p></div>
      <div class="breath-options"><label>Rhythm<select class="breath-rhythm"><option value="even">Even · 4 in / 4 out</option><option value="longer">Longer out · 4 in / 7 out</option></select></label><button class="breath-switch" type="button" aria-pressed="false">Start guide</button></div>
      <p class="breath-permission">Follow only as feels comfortable. You can stop the guide and breathe in your own rhythm.</p>
      <p class="breath-status" role="status" aria-live="polite"></p>
    </div>`;

  document.querySelectorAll('[data-breathing]').forEach(host => {
    if (host.breathing) return;
    host.replaceChildren(template.content.cloneNode(true));
    const ring = host.querySelector('.breath-ring');
    const phaseLabel = host.querySelector('.breath-phase');
    const countLabel = host.querySelector('.breath-count');
    const rhythm = host.querySelector('.breath-rhythm');
    const toggle = host.querySelector('.breath-switch');
    const status = host.querySelector('.breath-status');
    let running = false;
    let timer;
    let animation;

    function stillRing() {
      return motionPreference.matches || host.dataset.breathMotion === 'off';
    }
    function pause(message = '') {
      clearTimeout(timer);
      animation?.cancel();
      animation = null;
      running = false;
      host.dataset.breathRunning = 'false';
      host.dataset.breathPhase = 'rest';
      toggle.textContent = 'Start guide';
      toggle.setAttribute('aria-pressed', 'false');
      phaseLabel.setAttribute('aria-live', 'off');
      phaseLabel.textContent = 'Your own pace.';
      countLabel.textContent = 'There is no count to keep.';
      status.textContent = message;
    }
    function phase(next) {
      if (!running) return;
      if (document.hidden || !host.getClientRects().length) return pause();
      const inhale = next === 'in';
      const seconds = inhale || rhythm.value === 'even' ? 4 : 7;
      host.dataset.breathPhase = next;
      phaseLabel.textContent = inhale ? 'Breathe in' : 'Breathe out';
      countLabel.textContent = `${seconds} seconds · gently`;
      animation?.cancel();
      animation = null;
      if (!stillRing() && typeof ring.animate === 'function') {
        animation = ring.animate([
          { transform: `scale(${inhale ? '.72' : '1'})` },
          { transform: `scale(${inhale ? '1' : '.72'})` },
        ], { duration: seconds * 1000, easing: 'ease-in-out', fill: 'forwards' });
      }
      timer = setTimeout(() => phase(inhale ? 'out' : 'in'), seconds * 1000);
    }
    function start() {
      if (running || document.hidden || !host.getClientRects().length) return;
      running = true;
      host.dataset.breathRunning = 'true';
      toggle.textContent = 'Pause guide';
      toggle.setAttribute('aria-pressed', 'true');
      phaseLabel.setAttribute('aria-live', 'polite');
      status.textContent = stillRing()
        ? 'Guide started. The ring stays still; the words follow your chosen rhythm.'
        : 'Guide started. The ring opens as you breathe in and settles as you breathe out.';
      phase('in');
    }
    toggle.addEventListener('click', () => running ? pause('Guide paused. Take your own time.') : start());
    rhythm.addEventListener('change', () => pause('Rhythm changed. Start whenever you are ready.'));
    const onHidden = () => { if (document.hidden) pause(); };
    const onPageHide = () => pause();
    const onMotion = () => pause('Motion preference changed. Start whenever you are ready.');
    const onClose = () => pause();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    motionPreference.addEventListener('change', onMotion);
    const dialog = host.closest('dialog');
    dialog?.addEventListener('close', onClose);
    host.breathing = {
      start,
      pause,
      get running() { return running; },
      destroy() {
        pause();
        document.removeEventListener('visibilitychange', onHidden);
        window.removeEventListener('pagehide', onPageHide);
        motionPreference.removeEventListener('change', onMotion);
        dialog?.removeEventListener('close', onClose);
      },
    };
    pause();
    host.dispatchEvent(new CustomEvent('breathing-ready', { bubbles: true }));
  });
})();
