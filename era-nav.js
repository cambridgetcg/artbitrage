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
  ];

  var currentEra = document.body.getAttribute('data-era') || '';

  var nav = document.createElement('nav');
  nav.className = 'era-nav';

  var inner = document.createElement('div');
  inner.className = 'era-nav-inner';

  // Brand
  var brand = document.createElement('div');
  brand.className = 'era-nav-brand';
  brand.innerHTML = '<a href="/">ARTBITRAGE</a>';
  inner.appendChild(brand);

  // Links
  var links = document.createElement('div');
  links.className = 'era-nav-links';
  ERAS.forEach(function (era) {
    var a = document.createElement('a');
    a.className = 'era-nav-link' + (era.id === currentEra ? ' active' : '');
    a.href = era.href;
    a.textContent = era.label;
    links.appendChild(a);
  });
  inner.appendChild(links);

  // Back to main
  var back = document.createElement('a');
  back.className = 'era-nav-back';
  back.href = '/';
  back.textContent = '← gallery';
  inner.appendChild(back);

  nav.appendChild(inner);
  document.body.insertBefore(nav, document.body.firstChild);

  // Ambient particles
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
  };

  var colors = particleColors[currentEra] || ['#ff6b9d', '#ffd700', '#00f0ff'];
  var pContainer = document.createElement('div');
  pContainer.className = 'era-particles';
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