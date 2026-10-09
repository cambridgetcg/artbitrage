/* A visitor chooses the colour story. The complete chapter works without JS. */
(() => {
  'use strict';
  const controls = document.getElementById('colour-story-controls');
  const buttons = [...controls.querySelectorAll('[data-colour]')];
  const stories = [...document.querySelectorAll('.colour-story')];
  const stage = document.getElementById('colour-stage');
  const ids = new Set(stories.map(story => story.id));
  function choose(id, updateURL = false) {
    if (!ids.has(id)) return;
    stories.forEach(story => { story.hidden = story.id !== id; });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.colour === id)));
    stage.dataset.colour = id;
    if (updateURL) history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  }
  controls.hidden = false;
  buttons.forEach(button => {
    button.setAttribute('aria-controls', button.dataset.colour);
    button.addEventListener('click', () => choose(button.dataset.colour, true));
  });
  choose(ids.has(location.hash.slice(1)) ? location.hash.slice(1) : 'ultramarine');
  window.addEventListener('hashchange', () => choose(location.hash.slice(1)));
})();
