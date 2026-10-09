/* ═══════════════════════════════════════════════════════════════
 * ARTBITRAGE — era-nav.js
 *
 * Injects the shared era navigation bar into any era page.
 * Each era page just sets data-era="renaissance" on <body>
 * and includes this script. The nav highlights the current era.
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  var ERAS = [
    { id: 'prehistoric',   label: 'Prehistoric',     href: '/prehistoric' },
    { id: 'medieval',      label: 'Medieval',         href: '/medieval' },
    { id: 'renaissance',   label: 'Renaissance',      href: '/renaissance' },
    { id: 'baroque',       label: 'Baroque',           href: '/baroque' },
    { id: 'romanticism',   label: 'Romanticism',      href: '/romanticism' },
    { id: 'impressionism', label: 'Impressionism',    href: '/impressionism' },
    { id: 'modernism',     label: 'Modernism',         href: '/modernism' },
    { id: 'popart',        label: 'Pop Art',           href: '/popart' },
    { id: 'ai',            label: 'AI Art',            href: '/ai' },
    { id: 'wine',          label: 'Wine',              href: '/wine' },
    { id: 'cigar',         label: 'Cigar',             href: '/cigar' },
    { id: 'trade',         label: 'Trade',             href: '/trade' },
    { id: 'pigments',      label: 'Pigments',          href: '/pigments' },
  ];

  var currentEra = document.body.getAttribute('data-era') || '';

  var nav = document.createElement('nav');
  nav.className = 'visitor-nav era-nav';
  nav.setAttribute('aria-label', 'Main navigation');

  var inner = document.createElement('div');
  inner.className = 'visitor-nav-inner';

  // Brand
  var brand = document.createElement('a');
  brand.className = 'visitor-nav-brand';
  brand.href = '/';
  brand.textContent = 'Artbitrage';
  inner.appendChild(brand);

  var primary = document.createElement('div');
  primary.className = 'visitor-nav-primary';
  [
    { label: 'Why', href: '/#why' },
    { label: 'Visitor guide', href: '/map' },
    { label: 'River', href: '/river' },
  ].forEach(function (item) {
    var link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    primary.appendChild(link);
  });
  inner.appendChild(primary);

  // Native disclosure keeps every room reachable on small screens and by keyboard.
  var rooms = document.createElement('details');
  rooms.className = 'visitor-nav-menu';
  var summary = document.createElement('summary');
  summary.textContent = 'Explore rooms';
  rooms.appendChild(summary);
  var links = document.createElement('div');
  links.className = 'visitor-nav-rooms era-nav-links';
  ERAS.forEach(function (era) {
    var a = document.createElement('a');
    a.className = 'era-nav-link' + (era.id === currentEra ? ' active' : '');
    a.href = era.href;
    a.textContent = era.label;
    if (era.id === currentEra) a.setAttribute('aria-current', 'page');
    links.appendChild(a);
  });
  rooms.appendChild(links);
  inner.appendChild(rooms);

  rooms.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && rooms.open) {
      rooms.open = false;
      summary.focus();
    }
  });
  document.addEventListener('click', function (event) {
    if (rooms.open && !rooms.contains(event.target)) rooms.open = false;
  });

  nav.appendChild(inner);
  document.body.insertBefore(nav, document.body.firstChild);
  var skip = document.createElement('a');
  skip.className = 'visitor-skip';
  skip.href = '#visitor-content';
  skip.textContent = 'Skip to content';
  document.body.insertBefore(skip, nav);

  /* ── Key Works → honest "look it up" links ──────────────────────
   * Each era page names real masterpieces (Mona Lisa, Guernica, ...)
   * but cannot embed the image without risking the WRONG image under
   * a famous name. Truth over decoration: we turn each title into a
   * link to an authoritative search at Wikimedia Commons + Google
   * Arts & Culture, so a reader can verify the real work themselves.
   * Graceful: if no .kw-title exists, this is a no-op.            */
  function enhanceContent() {
    var hero = document.querySelector('.era-hero');
    if (hero) {
      if (!hero.id) hero.id = 'visitor-content';
      skip.href = '#' + hero.id;
      hero.setAttribute('tabindex', '-1');
    }
    try {
      var titles = document.querySelectorAll('.key-work .kw-title');
      Array.prototype.forEach.call(titles, function (el) {
        if (el.querySelector('a')) return; // already linked
        var name = (el.textContent || '').trim();
        if (!name) return;
        var infoEl = el.parentNode;
        var artistEl = infoEl ? infoEl.querySelector('.kw-artist') : null;
        var artist = artistEl ? (artistEl.textContent || '').split('·')[0].trim() : '';
        var query = encodeURIComponent((artist ? artist + ' ' : '') + name);

        var look = document.createElement('span');
        look.className = 'kw-look';
        var commons = document.createElement('a');
        commons.href = 'https://commons.wikimedia.org/w/index.php?search=' + query + '&title=Special:MediaSearch&type=image';
        commons.target = '_blank';
        commons.rel = 'noopener noreferrer';
        commons.textContent = 'see it ↗';
        commons.title = 'View "' + name + '" on Wikimedia Commons (free / public-domain media)';

        var gac = document.createElement('a');
        gac.href = 'https://artsandculture.google.com/search?q=' + query;
        gac.target = '_blank';
        gac.rel = 'noopener noreferrer';
        gac.textContent = 'explore ↗';
        gac.title = 'Explore "' + name + '" on Google Arts & Culture';

        look.appendChild(commons);
        look.appendChild(document.createTextNode(' · '));
        look.appendChild(gac);
        el.appendChild(document.createTextNode(' '));
        el.appendChild(look);
      });
    } catch (e) { /* never break the page over an enhancement */ }
  }
  // Era pages include this script before their content has been parsed.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceContent, { once: true });
  } else {
    enhanceContent();
  }

  // Ambient particles
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var particleColors = {
    prehistoric: ['#8b6f47', '#c4985a', '#6b4e2e'],
    medieval: ['#c41e3a', '#1a1a2e', '#8b0000'],
    renaissance: ['#c9a227', '#8b6914', '#ffd700'],
    baroque: ['#d4af37', '#1a0f0a', '#c0392b'],
    romanticism: ['#2c5f5a', '#c0392b', '#7f8c8d'],
    impressionism: ['#7ec8e3', '#ffb6c1', '#ddca7e'],
    modernism: ['#666666', '#e74c3c', '#2c3e50'],
    popart: ['#ff1493', '#ffeb3b', '#00bcd4'],
    ai: ['#a78bfa', '#00f0ff', '#ff6b9d'],
    wine: ['#c94f6d', '#722f37', '#d4af37'],
    cigar: ['#c98e4f', '#8b5a2b', '#e3d3bc'],
    pigments: ['#1346a6', '#b98a3e', '#66023c'],
  };

  var colors = particleColors[currentEra] || ['#ff6b9d', '#ffd700', '#00f0ff'];
  var pContainer = document.createElement('div');
  pContainer.className = 'era-particles';
  pContainer.setAttribute('aria-hidden', 'true');
  for (var i = 0; i < 25; i++) {
    var p = document.createElement('div');
    p.className = 'era-particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 25 + 's';
    p.style.animationDuration = (18 + Math.random() * 12) + 's';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    pContainer.appendChild(p);
  }
  document.body.appendChild(pContainer);
})();
