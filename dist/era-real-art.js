/* ═══════════════════════════════════════════════════════════════
 * ARTBITRAGE — era-real-art.js
 *
 * Fetches real museum artworks matching the current era and
 * injects them into the page. Each era page includes this script
 * with data-era on the body.
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  var era = document.body.getAttribute('data-era') || '';
  if (!era) return;

  // Create the real art section
  var section = document.createElement('section');
  section.className = 'era-section era-section-wide';
  section.innerHTML = '<div class="era-section-label">Real museum artworks</div>' +
    '<h2>Real art from the <em>' + era + '</em> era</h2>' +
    '<p>Live from the Metropolitan Museum of Art open access collection. Click any piece to view at the museum.</p>' +
    '<div class="era-real-grid" id="era-real-grid"></div>';

  // Insert before footer
  var footer = document.querySelector('.era-footer');
  if (footer) {
    document.body.insertBefore(section, footer);
  } else {
    document.body.appendChild(section);
  }

  // Add inline styles
  var style = document.createElement('style');
  style.textContent = '\
    .era-real-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:1rem; margin:1.5rem 0; }\
    .era-real-card { background:var(--era-surface); border:1px solid rgba(255,255,255,0.06); border-radius:10px; overflow:hidden; transition:all .3s; position:relative; }\
    .era-real-card:hover { border-color:var(--era-accent); transform:translateY(-3px); }\
    .era-real-card .erc-img { width:100%; height:180px; background:var(--era-bg); display:flex; align-items:center; justify-content:center; overflow:hidden; }\
    .era-real-card .erc-img img { width:100%; height:100%; object-fit:cover; }\
    .era-real-card .erc-img .no-img { color:var(--era-dim); font-size:.8rem; font-style:italic; }\
    .era-real-card .erc-info { padding:.8rem; }\
    .era-real-card .erc-title { font-size:.9rem; font-weight:bold; line-height:1.3; margin-bottom:.2rem; }\
    .era-real-card .erc-artist { font-size:.78rem; color:var(--era-dim); margin-bottom:.1rem; }\
    .era-real-card .erc-date { font-family:monospace; font-size:.7rem; color:var(--era-accent); }\
    .era-real-card .erc-link { margin-top:.4rem; }\
    .era-real-card .erc-link a { font-family:monospace; font-size:.65rem; color:var(--era-dim); }\
    .era-real-card .erc-link a:hover { color:var(--era-accent); }\
  ';
  document.head.appendChild(style);

  // Fetch era-matched artworks
  fetch('/api/era-catalog?era=' + encodeURIComponent(era))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var grid = document.getElementById('era-real-grid');
      if (!grid) return;
      var artworks = data.artworks || [];
      if (artworks.length === 0) {
        grid.innerHTML = '<p style="color:var(--era-dim);font-style:italic;">No museum artworks found for this era yet.</p>';
        return;
      }

      grid.innerHTML = artworks.map(function (a) {
        var imgHtml = a.image && a.image.length > 0
          ? '<img src="/api/img?url=' + encodeURIComponent(a.image) + '" alt="' + (a.title || '') + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<span class=no-img>image unavailable</span>\'">'
          : '<span class="no-img">no image</span>';
        return '<div class="era-real-card">' +
          '<div class="erc-img">' + imgHtml + '</div>' +
          '<div class="erc-info">' +
            '<div class="erc-title">' + (a.title || 'Untitled') + '</div>' +
            (a.artist ? '<div class="erc-artist">' + a.artist + '</div>' : '') +
            (a.date ? '<div class="erc-date">' + a.date + '</div>' : '') +
            (a.url ? '<div class="erc-link"><a href="' + a.url + '" target="_blank" rel="noopener">view at museum →</a></div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function (e) {
      var grid = document.getElementById('era-real-grid');
      if (grid) grid.innerHTML = '<p style="color:var(--era-dim);">Unable to load museum artworks.</p>';
    });
})();