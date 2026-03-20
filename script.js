(() => {
  'use strict';

  const HBO_VIDEO_ID = 'O08PQRA6MLo';
  const GQL_ENDPOINT = 'http://localhost:8000/graphql';

  let appConfig = null;
  let fullCatalog = [];
  let allItems = [];
  let currentShowId = null;
  let selectedGenre = [];
  let isAnimating = false;
  let hboPlayer = null;
  let ytReady = false;
  let pendingPlay = false;
  let catalogReady = false;
  let catalogPromise = null;
  let currentSkinId = null;
  let currentSkinManifest = null;
  let skinLinkEl = null;
  let skinFontLinkEl = null;

  const $ = (sel) => document.querySelector(sel);

  const GENRE_THEMES = {
    'comedy': 'comedy',
    'drama': 'drama',
    'action': 'action',
    'horror': 'horror',
    'thriller': 'thrillers',
    'documentary': 'documentaries',
    'crime': 'crime',
  };

  function applyTheme(genreValues) {
    const app = $('#app');
    if (!genreValues || genreValues.length === 0) {
      delete app.dataset.theme;
      return;
    }
    const slug = GENRE_THEMES[genreValues[0]];
    if (slug) {
      app.dataset.theme = slug;
    } else {
      delete app.dataset.theme;
    }
  }

  // ─── Skin Engine ─────────────────────────────────

  const BG_EXTENSIONS = ['.avif', '.webp', '.jpg', '.png'];

  function detectBackground(skinId) {
    const base = 'skins/' + skinId + '/background';
    return new Promise((resolve) => {
      let found = false;
      let checked = 0;
      for (const ext of BG_EXTENSIONS) {
        const img = new Image();
        img.onload = () => { if (!found) { found = true; resolve(base + ext); } };
        img.onerror = () => { checked++; if (checked === BG_EXTENSIONS.length && !found) resolve(null); };
        img.src = base + ext;
      }
    });
  }

  async function loadSkin(skinId) {
    const manifestRes = await fetch('skins/' + skinId + '/skin.json');
    const manifest = await manifestRes.json();
    currentSkinManifest = manifest;
    currentSkinId = skinId;

    if (skinLinkEl) {
      skinLinkEl.remove();
      skinLinkEl = null;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'skins/' + skinId + '/skin.css';
    link.id = 'skin-stylesheet';
    const cssLoaded = new Promise((resolve) => {
      link.onload = resolve;
      link.onerror = resolve;
    });
    document.head.appendChild(link);
    skinLinkEl = link;

    await cssLoaded;

    const bgUrl = await detectBackground(skinId);
    const skinBg = $('#skin-bg');
    if (bgUrl) {
      skinBg.style.backgroundImage = 'url(' + bgUrl + ')';
      skinBg.style.backgroundSize = 'cover';
      skinBg.style.backgroundPosition = 'center';
      skinBg.style.backgroundRepeat = 'no-repeat';
    } else {
      skinBg.style.backgroundImage = '';
    }

    $('#app').dataset.skin = skinId;

    await loadSkinFont(manifest);
    applySkinText(manifest);
    spawnScatterLogos(skinId, manifest);
  }

  async function loadSkinFont(manifest) {
    if (skinFontLinkEl) {
      skinFontLinkEl.remove();
      skinFontLinkEl = null;
    }

    if (manifest.fontUrl) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = manifest.fontUrl;
      link.id = 'skin-font-stylesheet';
      const fontLoaded = new Promise((resolve) => {
        link.onload = resolve;
        link.onerror = resolve;
      });
      document.head.appendChild(link);
      skinFontLinkEl = link;
      await fontLoaded;
    }

    const fontFamily = manifest.fontFamily || "'Inter', sans-serif";
    document.documentElement.style.setProperty('--font-display', fontFamily);
  }

  function applySkinText(manifest) {
    if (manifest.idle) {
      if (manifest.idle.title) $('#idle-title').textContent = manifest.idle.title;
      if (manifest.idle.buttonText) $('#btn-start').textContent = manifest.idle.buttonText;
    }
    if (manifest.reveal) {
      if (manifest.reveal.watchButtonText) $('#btn-watch').textContent = manifest.reveal.watchButtonText;
      if (manifest.reveal.anotherButtonText) $('#btn-another').textContent = manifest.reveal.anotherButtonText;
    }
    if (manifest.moodText) {
      const label = $('.genre-label');
      if (label) label.textContent = manifest.moodText;
    }
    if (manifest.particleColor) {
      document.documentElement.style.setProperty('--particle-rgb', manifest.particleColor);
    }
  }

  let scatterAnimFrame = null;

  function spawnScatterLogos(skinId, manifest) {
    const container = $('#skin-scatter');
    container.innerHTML = '';
    if (scatterAnimFrame) {
      cancelAnimationFrame(scatterAnimFrame);
      scatterAnimFrame = null;
    }

    const logos = manifest.scatterFiles;
    if (!logos || logos.length === 0) return;

    const count = manifest.scatterCount || 16;
    const icons = [];

    for (let i = 0; i < count; i++) {
      const src = 'skins/' + skinId + '/' + logos[i % logos.length];
      const size = 28 + Math.random() * 50;
      const el = document.createElement('div');
      el.className = 'scatter-icon';
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.left = Math.random() * 100 + '%';
      el.style.top = Math.random() * 100 + '%';
      el.style.transform = 'rotate(' + (Math.random() * 40 - 20) + 'deg)';

      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      el.appendChild(img);
      container.appendChild(el);

      icons.push({
        el,
        baseX: Math.random() * 100,
        baseY: Math.random() * 100,
        driftX: 0.3 + Math.random() * 0.6,
        driftY: 0.2 + Math.random() * 0.5,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        baseRot: Math.random() * 40 - 20,
        fadeDelay: i * 80,
        opacity: 0.08 + Math.random() * 0.12,
      });
    }

    icons.forEach(icon => {
      setTimeout(() => {
        icon.el.classList.add('visible');
        icon.el.style.opacity = icon.opacity;
      }, icon.fadeDelay);
    });

    const startTime = performance.now();

    function animateScatter(now) {
      const elapsed = (now - startTime) / 1000;
      for (const icon of icons) {
        const x = icon.baseX + Math.sin(elapsed * icon.driftX + icon.phaseX) * 2;
        const y = icon.baseY + Math.cos(elapsed * icon.driftY + icon.phaseY) * 2;
        const rot = icon.baseRot + Math.sin(elapsed * icon.rotSpeed) * 8;
        icon.el.style.left = x + '%';
        icon.el.style.top = y + '%';
        icon.el.style.transform = 'rotate(' + rot + 'deg)';
      }
      scatterAnimFrame = requestAnimationFrame(animateScatter);
    }

    scatterAnimFrame = requestAnimationFrame(animateScatter);
  }

  async function switchSkin(skinId) {
    if (skinId === currentSkinId || isAnimating) return;

    const overlay = $('#theme-transition');
    overlay.classList.remove('fire');
    void overlay.offsetWidth;
    overlay.classList.add('fire');

    await wait(300);
    await loadSkin(skinId);
    await wait(500);

    const heroEls = document.querySelectorAll('.skin-hero');
    heroEls.forEach(el => el.classList.remove('animate'));

    if ($('#frame-reveal').classList.contains('active')) {
      animateSkinHeroes();
    }
  }

  async function populateSkinDropdown(skins) {
    const select = $('#skin-select');
    select.innerHTML = '';
    const labels = await Promise.all(skins.map(async (skinId) => {
      try {
        const res = await fetch('skins/' + skinId + '/skin.json');
        const data = await res.json();
        return { id: skinId, name: data.name || skinId };
      } catch {
        return { id: skinId, name: skinId };
      }
    }));
    labels.forEach(({ id, name }) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  function animateSkinHeroes() {
    document.querySelectorAll('.skin-hero').forEach(el => {
      el.classList.add('animate');
    });
  }

  function resetSkinHeroes() {
    document.querySelectorAll('.skin-hero').forEach(el => {
      el.classList.remove('animate');
      el.style.opacity = '';
    });
  }

  // ─── GraphQL client ───────────────────────────────

  async function gql(query, variables = {}) {
    const res = await fetch(GQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) {
      console.error('GraphQL errors:', json.errors);
    }
    return json.data;
  }

  // ─── Query ────────────────────────────────────────

  const WHAT_SHOULD_I_WATCH = `
    query WhatShouldIWatch(
      $country: String!
      $lang: String!
      $genres: [String]
      $brands: [String]
      $franchises: [String]
      $contentType: QuizContentType
      $limit: Int
    ) {
      whatShouldIWatch(
        country: $country
        lang: $lang
        genres: $genres
        brands: $brands
        franchises: $franchises
        contentType: $contentType
        limit: $limit
      ) {
        items {
          ... on Series {
            hbomaxId
            releaseYear
            trailer { programId editId title url }
            images
            genresFormatted
            title { short full }
            summary { short full }
            imageUrlLink
            localizedRating
          }
          ... on Feature {
            hbomaxId
            releaseYear
            trailer { programId editId title url }
            images
            title { short full }
            summary { short full }
            imageUrlLink
            genresFormatted
            localizedRating
          }
        }
      }
    }
  `;

  // ─── Normalize API response into a flat item ──────

  function pickFrom(images, ...keys) {
    if (!images || typeof images !== 'object') return null;
    for (const k of keys) {
      if (images[k]) return images[k];
    }
    return null;
  }

  function normalize(item) {
    const imgs = item.images;
    return {
      id: item.hbomaxId,
      title: (item.title && (item.title.full || item.title.short)) || 'Untitled',
      description: (item.summary && (item.summary.short || item.summary.full)) || '',
      image: pickFrom(imgs, 'poster-with-logo', 'cover-artwork', 'default', 'cover-artwork-square'),
      year: item.releaseYear || '',
      genre: item.genresFormatted || '',
      rating: item.localizedRating || '',
      trailerUrl: (item.trailer && item.trailer.url) || null,
    };
  }

  // ─── Data loading ─────────────────────────────────

  const MOCK_CATALOG = [
    { id: 'mock-1', title: 'The Last of Us', description: 'In a post-apocalyptic world, a hardened survivor escorts a teenage girl across a dangerous landscape.', image: null, year: '2023', genre: 'Drama, Action', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-2', title: 'Succession', description: 'The Roy family — owners of a global media empire — fight for control of the company amidst family drama.', image: null, year: '2018', genre: 'Drama', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-3', title: 'White Lotus', description: 'Social satire set at an exclusive tropical resort, following vacationers as darker dynamics emerge.', image: null, year: '2021', genre: 'Drama, Comedy', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-4', title: 'Euphoria', description: 'A group of high school students navigate love, identity, and addiction in a digital age.', image: null, year: '2019', genre: 'Drama', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-5', title: 'House of the Dragon', description: 'Set 200 years before Game of Thrones, this saga chronicles the Targaryen civil war.', image: null, year: '2022', genre: 'Fantasy, Drama, Action', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-6', title: 'True Detective', description: 'Anthology series with separate seasons exploring dark crimes and the detectives pursuing them.', image: null, year: '2014', genre: 'Crime, Thriller, Drama', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-7', title: 'Barry', description: 'A hit man from the Midwest moves to Los Angeles and gets caught up in the city\'s theatre arts scene.', image: null, year: '2018', genre: 'Comedy, Drama, Crime', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-8', title: 'Hacks', description: 'A legendary Las Vegas comedian and a struggling young comedy writer form an unexpected mentorship.', image: null, year: '2021', genre: 'Comedy, Drama', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-9', title: 'The Penguin', description: 'Oz Cobb rises through Gotham\'s underworld to seize control of the city\'s criminal empire.', image: null, year: '2024', genre: 'Crime, Drama, Action', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-10', title: 'Dune: Part Two', description: 'Paul Atreides unites with the Fremen to wage war against House Harkonnen for control of Arrakis.', image: null, year: '2024', genre: 'Sci-Fi, Action, Drama', rating: 'PG-13', trailerUrl: null },
    { id: 'mock-11', title: 'Insecure', description: 'Follows the awkward experiences and racy tribulations of a modern-day African-American woman.', image: null, year: '2016', genre: 'Comedy, Drama, Romance', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-12', title: 'Curb Your Enthusiasm', description: 'Larry David\'s fictionalized version of himself navigates social norms in Los Angeles.', image: null, year: '2000', genre: 'Comedy', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-13', title: 'The Batman', description: 'Batman ventures into Gotham\'s underworld to unmask the Riddler, a sadistic killer targeting the city\'s elite.', image: null, year: '2022', genre: 'Action, Crime, Drama', rating: 'PG-13', trailerUrl: null },
    { id: 'mock-14', title: 'Fantastic Beasts', description: 'Magizoologist Newt Scamander arrives in New York with a suitcase full of magical creatures.', image: null, year: '2016', genre: 'Fantasy, Action', rating: 'PG-13', trailerUrl: null },
    { id: 'mock-15', title: 'It', description: 'Kids confront a shape-shifting evil clown that has been terrorizing their small Maine town.', image: null, year: '2017', genre: 'Horror, Thriller', rating: 'R', trailerUrl: null },
    { id: 'mock-16', title: 'Westworld', description: 'In a futuristic theme park populated by androids, guests indulge every desire until the hosts begin to evolve.', image: null, year: '2016', genre: 'Sci-Fi, Drama, Thriller', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-17', title: 'Game of Thrones', description: 'Nine noble families wage war against each other for control of the mythical land of Westeros.', image: null, year: '2011', genre: 'Fantasy, Drama, Action', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-18', title: 'Mare of Easttown', description: 'A detective in a small Pennsylvania town investigates a murder while trying to keep her life from falling apart.', image: null, year: '2021', genre: 'Crime, Drama, Thriller', rating: 'TV-MA', trailerUrl: null },
    { id: 'mock-19', title: 'Harry Potter and the Sorcerer\'s Stone', description: 'An orphaned boy discovers he is a wizard and enrolls in Hogwarts School of Witchcraft and Wizardry.', image: null, year: '2001', genre: 'Fantasy, Action', rating: 'PG', trailerUrl: null },
    { id: 'mock-20', title: 'The Conjuring', description: 'Paranormal investigators help a family terrorized by a dark presence in their farmhouse.', image: null, year: '2013', genre: 'Horror, Thriller', rating: 'R', trailerUrl: null },
  ];

  const CATALOG_CACHE_KEY = 'hbo_catalog_cache';
  const CATALOG_CACHE_TTL = 30 * 60 * 1000;

  function getCachedCatalog() {
    try {
      const raw = localStorage.getItem(CATALOG_CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.ts > CATALOG_CACHE_TTL) {
        localStorage.removeItem(CATALOG_CACHE_KEY);
        return null;
      }
      return cached.items;
    } catch { return null; }
  }

  function setCachedCatalog(items) {
    try {
      localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
    } catch { /* quota exceeded — ignore */ }
  }

  async function loadCatalog() {
    const cached = getCachedCatalog();
    if (cached && cached.length > 0) {
      fullCatalog = cached;
      filterByGenre();
      catalogReady = true;
      refreshCatalogInBackground();
      return allItems;
    }

    const d = appConfig ? appConfig.defaults : {};
    try {
      const data = await gql(WHAT_SHOULD_I_WATCH, {
        country: d.country || 'us',
        lang: d.lang || 'en',
        genres: [],
        brands: d.brands || [],
        franchises: d.franchises || [],
        contentType: d.contentType || 'BOTH',
        limit: d.limit || 50,
      });
      if (data && data.whatShouldIWatch && data.whatShouldIWatch.items) {
        fullCatalog = data.whatShouldIWatch.items.map(normalize);
        setCachedCatalog(fullCatalog);
      }
    } catch (err) {
      console.warn('GraphQL unreachable, using mock catalog:', err.message);
      fullCatalog = MOCK_CATALOG.slice();
    }
    if (fullCatalog.length === 0) {
      console.warn('Empty catalog from API, falling back to mock data');
      fullCatalog = MOCK_CATALOG.slice();
    }
    filterByGenre();
    catalogReady = fullCatalog.length > 0;
    return allItems;
  }

  async function refreshCatalogInBackground() {
    const d = appConfig ? appConfig.defaults : {};
    try {
      const data = await gql(WHAT_SHOULD_I_WATCH, {
        country: d.country || 'us',
        lang: d.lang || 'en',
        genres: [],
        brands: d.brands || [],
        franchises: d.franchises || [],
        contentType: d.contentType || 'BOTH',
        limit: d.limit || 50,
      });
      if (data && data.whatShouldIWatch && data.whatShouldIWatch.items) {
        const fresh = data.whatShouldIWatch.items.map(normalize);
        if (fresh.length > 0) {
          fullCatalog = fresh;
          setCachedCatalog(fullCatalog);
          filterByGenre();
        }
      }
    } catch { /* silent background refresh */ }
  }

  function filterByGenre() {
    if (!selectedGenre || selectedGenre.length === 0) {
      allItems = fullCatalog.slice();
      return;
    }
    const lowerGenres = selectedGenre.map(g => g.toLowerCase());
    allItems = fullCatalog.filter(item => {
      if (!item.genre) return false;
      const itemGenre = typeof item.genre === 'string' ? item.genre.toLowerCase() : '';
      return lowerGenres.some(g => itemGenre.includes(g));
    });
    if (allItems.length === 0) {
      allItems = fullCatalog.slice();
    }
  }

  const recentIds = [];
  const RECENT_LIMIT = 10;

  function fetchRandomShow() {
    if (!allItems.length) return null;
    let pool = allItems.filter(s => !recentIds.includes(s.id));
    if (pool.length === 0) {
      recentIds.length = 0;
      pool = allItems.filter(s => s.id !== currentShowId);
      if (pool.length === 0) pool = allItems;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    currentShowId = pick.id;
    recentIds.push(pick.id);
    if (recentIds.length > RECENT_LIMIT) recentIds.shift();
    return pick;
  }

  // YouTube IFrame API callback
  window.onYouTubeIframeAPIReady = function () {
    ytReady = true;
    createPlayer();
  };

  function createPlayer() {
    hboPlayer = new YT.Player('hbo-player', {
      videoId: HBO_VIDEO_ID,
      playerVars: {
        autoplay: 0,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 0,
        playsinline: 1,
        loop: 0,
        mute: 0,
        origin: window.location.origin
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange
      }
    });
  }

  function prebufferVideo() {
    if (hboPlayer && typeof hboPlayer.mute === 'function') {
      hboPlayer.mute();
      hboPlayer.playVideo();
      setTimeout(() => {
        if (hboPlayer && typeof hboPlayer.pauseVideo === 'function') {
          hboPlayer.pauseVideo();
          hboPlayer.unMute();
          hboPlayer.seekTo(0, true);
        }
      }, 500);
    }
  }

  function setIframeVisible(visible) {
    if (!hboPlayer || !hboPlayer.getIframe) return;
    const iframe = hboPlayer.getIframe();
    if (!iframe) return;
    if (visible) {
      iframe.classList.add('playing');
    } else {
      iframe.classList.remove('playing');
    }
  }

  function onPlayerReady() {
    prebufferVideo();
    if (pendingPlay) {
      pendingPlay = false;
      startVideoPlayback();
    }
  }

  function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
      afterVideoEnds();
    }
  }

  function startVideoPlayback() {
    if (hboPlayer && typeof hboPlayer.seekTo === 'function') {
      hboPlayer.seekTo(0, true);
      setIframeVisible(true);
      hboPlayer.playVideo();
    }
  }

  async function afterVideoEnds() {
    setIframeVisible(false);

    const frameCredits = $('#frame-credits');
    const frameTransition = $('#frame-transition');
    const frameReveal = $('#frame-reveal');
    const spotlightDim = $('.spotlight-cone--dim');
    const spinner = $('#transition-spinner');

    switchFrame(frameCredits, frameTransition);
    spinner.classList.add('visible');

    if (!catalogReady && catalogPromise) {
      await catalogPromise;
    }

    const show = fetchRandomShow();
    if (!show) { isAnimating = false; return; }
    applyShow(show);
    createParticles($('#particles-transition'), 15);
    createParticles($('#particles-reveal'), 25);

    await wait(200);
    spotlightDim.classList.add('animate');

    await wait(800);
    spinner.classList.remove('visible');

    await wait(200);

    switchFrame(frameTransition, frameReveal);
    spotlightDim.classList.remove('animate');
    spotlightDim.style.opacity = '0';
    await wait(100);
    animateRevealElements();

    isAnimating = false;
  }

  function switchFrame(from, to) {
    from.classList.remove('active');
    to.classList.add('active');
  }

  function createParticles(container, count = 20) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 2 + Math.random() * 2;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = (40 + Math.random() * 60) + '%';
      p.style.animationDuration = (4 + Math.random() * 6) + 's';
      p.style.animationDelay = Math.random() * 4 + 's';
      p.style.opacity = 0.1 + Math.random() * 0.3;
      container.appendChild(p);
    }
  }

  function applyShow(show) {
    const card = $('#content-card');
    const title = $('#reveal-title');
    const desc = $('#reveal-description');
    const placeholder = $('#card-placeholder');
    const icon = placeholder.querySelector('.card-placeholder-icon');

    card.className = 'content-card';

    if (show.image) {
      placeholder.style.backgroundImage = 'url(' + show.image + ')';
      placeholder.style.backgroundSize = 'cover';
      placeholder.style.backgroundPosition = 'center';
      placeholder.style.backgroundColor = '#1a1a2e';
      if (icon) icon.style.display = 'none';
    } else {
      placeholder.style.backgroundImage = '';
      placeholder.style.backgroundColor = '#1a1a2e';
      if (icon) icon.style.display = '';
    }

    title.textContent = show.title;
    desc.textContent = show.description;
  }

  function animateRevealElements() {
    const card = $('#content-card');
    const info = $('#reveal-info');
    const actions = $('#reveal-actions');
    const pickersRow = $('#pickers-row');
    const spotBright = $('#frame-reveal .spotlight-cone--bright');
    const spotAccent = $('#frame-reveal .spotlight-cone--accent');
    const flare = $('.spotlight-flare');
    const glow = $('.stage-glow');

    card.classList.add('animate');
    info.classList.add('animate');
    pickersRow.classList.add('animate');
    actions.classList.add('animate');
    spotBright.classList.add('animate');
    spotAccent.classList.add('animate');
    flare.classList.add('animate');
    glow.classList.add('animate');
    animateSkinHeroes();
  }

  function resetRevealElements() {
    const card = $('#content-card');
    const info = $('#reveal-info');
    const actions = $('#reveal-actions');
    const pickersRow = $('#pickers-row');
    const spotBright = $('#frame-reveal .spotlight-cone--bright');
    const spotAccent = $('#frame-reveal .spotlight-cone--accent');
    const flare = $('.spotlight-flare');
    const glow = $('.stage-glow');
    const flash = $('#swap-flash');

    [card, info, actions, pickersRow, spotBright, spotAccent, flare, glow].forEach(el => {
      el.classList.remove('animate', 'swap-out', 'swap-in', 'swap-flicker', 'fire');
      el.style.opacity = '';
    });
    flash.classList.remove('fire');
    resetSkinHeroes();

    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    info.style.opacity = '0';
    info.style.transform = 'translateY(12px)';
    pickersRow.style.opacity = '0';
    pickersRow.style.transform = 'translateY(12px)';
    actions.style.opacity = '0';
    actions.style.transform = 'translateY(12px)';
    spotBright.style.opacity = '0';
    spotAccent.style.opacity = '0';
    flare.style.opacity = '0';
    glow.style.opacity = '0';
  }

  async function runFullSequence() {
    if (isAnimating) return;
    isAnimating = true;

    const frameIdle = $('#frame-idle');
    const frameCredits = $('#frame-credits');

    resetRevealElements();

    switchFrame(frameIdle, frameCredits);
    await wait(100);

    if (hboPlayer && typeof hboPlayer.playVideo === 'function') {
      startVideoPlayback();
    } else {
      pendingPlay = true;
    }
  }

  async function tryAnother() {
    if (isAnimating) return;
    isAnimating = true;

    const card = $('#content-card');
    const info = $('#reveal-info');
    const flash = $('#swap-flash');
    const spotBright = $('#frame-reveal .spotlight-cone--bright');
    const spotAccent = $('#frame-reveal .spotlight-cone--accent');

    card.classList.remove('animate', 'swap-in');
    info.classList.remove('animate', 'swap-in');

    // Spotlight flicker + card 3D flip out
    spotBright.classList.add('swap-flicker');
    spotAccent.classList.add('swap-flicker');
    card.classList.add('swap-out');
    info.classList.add('swap-out');

    await wait(350);

    // Fire the radial light burst at the swap moment
    flash.classList.remove('fire');
    void flash.offsetWidth;
    flash.classList.add('fire');

    await wait(150);

    const show = fetchRandomShow();
    if (!show) { isAnimating = false; return; }
    applyShow(show);
    createParticles($('#particles-reveal'), 25);

    card.classList.remove('swap-out');
    info.classList.remove('swap-out');
    card.classList.add('swap-in');
    info.classList.add('swap-in');

    await wait(700);

    // Restore spotlight breathing
    spotBright.classList.remove('swap-flicker');
    spotAccent.classList.remove('swap-flicker');
    spotBright.classList.add('animate');
    spotAccent.classList.add('animate');

    isAnimating = false;
  }

  function goHome() {
    const frameReveal = $('#frame-reveal');
    const frameIdle = $('#frame-idle');

    resetRevealElements();
    switchFrame(frameReveal, frameIdle);

    if (hboPlayer && typeof hboPlayer.stopVideo === 'function') {
      hboPlayer.stopVideo();
    }

    const title = $('.idle-title');
    const btn = $('.btn-start');
    title.style.animation = 'none';
    btn.style.animation = 'none';
    void title.offsetWidth;
    title.style.animation = '';
    btn.style.animation = '';
    title.style.animation = 'fadeUp 0.8s ease 0.1s forwards';
    btn.style.animation = 'fadeUp 0.8s ease 0.3s forwards';
    title.style.opacity = '0';
    title.style.transform = 'translateY(20px)';
    btn.style.opacity = '0';
    btn.style.transform = 'translateY(20px)';
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function populateGenreDropdown(genres) {
    const select = $('#genre-select');
    select.innerHTML = '';
    genres.forEach((g, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = g.label;
      select.appendChild(opt);
    });
  }

  function dismissLoadingOverlay() {
    const overlay = $('#loading-overlay');
    if (!overlay) return;
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.classList.add('hidden'), 800);
  }

  async function init() {
    try {
      const res = await fetch('config.json');
      appConfig = await res.json();
    } catch (e) {
      console.warn('Could not load config.json, using defaults');
      appConfig = {
        genres: [{ label: 'All Genres', value: [] }],
        defaults: { country: 'us', lang: 'en', brands: [], franchises: [], contentType: 'BOTH', limit: 50 },
        activeSkin: 'default',
        availableSkins: ['default']
      };
    }

    if (!appConfig.availableSkins) appConfig.availableSkins = ['default'];
    if (!appConfig.activeSkin) appConfig.activeSkin = 'default';

    populateGenreDropdown(appConfig.genres);
    selectedGenre = appConfig.genres[0].value;

    catalogPromise = loadCatalog();

    populateSkinDropdown(appConfig.availableSkins);
    await loadSkin(appConfig.activeSkin);
    $('#skin-select').value = appConfig.activeSkin;

    dismissLoadingOverlay();
  }

  // Event listeners
  $('#btn-start').addEventListener('click', runFullSequence);
  $('#btn-another').addEventListener('click', tryAnother);
  $('#btn-watch').addEventListener('click', goHome);

  $('#genre-select').addEventListener('change', async (e) => {
    const idx = Number.parseInt(e.target.value, 10);
    const genre = appConfig.genres[idx];
    if (!genre || isAnimating) return;

    isAnimating = true;
    selectedGenre = genre.value;
    currentShowId = null;
    recentIds.length = 0;
    filterByGenre();

    const card = $('#content-card');
    const info = $('#reveal-info');
    const flash = $('#swap-flash');
    const spotBright = $('#frame-reveal .spotlight-cone--bright');
    const spotAccent = $('#frame-reveal .spotlight-cone--accent');

    card.classList.remove('animate', 'swap-in');
    info.classList.remove('animate', 'swap-in');
    spotBright.classList.add('swap-flicker');
    spotAccent.classList.add('swap-flicker');
    card.classList.add('swap-out');
    info.classList.add('swap-out');

    await wait(350);

    const themeOverlay = $('#theme-transition');
    themeOverlay.classList.remove('fire');
    void themeOverlay.offsetWidth;
    themeOverlay.classList.add('fire');

    await wait(200);
    applyTheme(selectedGenre);

    flash.classList.remove('fire');
    void flash.offsetWidth;
    flash.classList.add('fire');

    await wait(150);

    const show = fetchRandomShow();
    if (!show) { isAnimating = false; return; }
    applyShow(show);
    createParticles($('#particles-reveal'), 25);

    card.classList.remove('swap-out');
    info.classList.remove('swap-out');
    card.classList.add('swap-in');
    info.classList.add('swap-in');

    await wait(700);

    spotBright.classList.remove('swap-flicker');
    spotAccent.classList.remove('swap-flicker');
    spotBright.classList.add('animate');
    spotAccent.classList.add('animate');

    isAnimating = false;
  });

  $('#skin-select').addEventListener('change', (e) => {
    switchSkin(e.target.value);
  });

  init();
})();
