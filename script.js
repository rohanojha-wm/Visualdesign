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

  async function loadCatalog() {
    const d = appConfig ? appConfig.defaults : {};
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
    }
    filterByGenre();
    catalogReady = fullCatalog.length > 0;
    return allItems;
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
      hboPlayer.playVideo();
    }
  }

  async function afterVideoEnds() {
    const frameCredits = $('#frame-credits');
    const frameTransition = $('#frame-transition');
    const frameReveal = $('#frame-reveal');
    const spotlightDim = $('.spotlight-cone--dim');

    switchFrame(frameCredits, frameTransition);
    await wait(200);
    spotlightDim.classList.add('animate');

    await wait(1000);

    // Frame 3 → Frame 4/5: Stage Reveal
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
    const genrePicker = $('#genre-picker');
    const spotBright = $('#frame-reveal .spotlight-cone--bright');
    const spotAccent = $('#frame-reveal .spotlight-cone--accent');
    const flare = $('.spotlight-flare');
    const glow = $('.stage-glow');

    card.classList.add('animate');
    info.classList.add('animate');
    genrePicker.classList.add('animate');
    actions.classList.add('animate');
    spotBright.classList.add('animate');
    spotAccent.classList.add('animate');
    flare.classList.add('animate');
    glow.classList.add('animate');
  }

  function resetRevealElements() {
    const card = $('#content-card');
    const info = $('#reveal-info');
    const actions = $('#reveal-actions');
    const genrePicker = $('#genre-picker');
    const spotBright = $('#frame-reveal .spotlight-cone--bright');
    const spotAccent = $('#frame-reveal .spotlight-cone--accent');
    const flare = $('.spotlight-flare');
    const glow = $('.stage-glow');
    const flash = $('#swap-flash');

    [card, info, actions, genrePicker, spotBright, spotAccent, flare, glow].forEach(el => {
      el.classList.remove('animate', 'swap-out', 'swap-in', 'swap-flicker', 'fire');
      el.style.opacity = '';
    });
    flash.classList.remove('fire');

    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    info.style.opacity = '0';
    info.style.transform = 'translateY(12px)';
    genrePicker.style.opacity = '0';
    genrePicker.style.transform = 'translateY(12px)';
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

    const btn = $('#btn-start');
    btn.classList.add('loading');
    btn.disabled = true;

    if (!catalogReady && catalogPromise) {
      await catalogPromise;
    }

    const frameIdle = $('#frame-idle');
    const frameCredits = $('#frame-credits');

    resetRevealElements();

    const show = fetchRandomShow();
    if (!show) {
      btn.classList.remove('loading');
      btn.disabled = false;
      isAnimating = false;
      return;
    }
    applyShow(show);
    createParticles($('#particles-transition'), 15);
    createParticles($('#particles-reveal'), 25);

    switchFrame(frameIdle, frameCredits);
    await wait(100);

    if (hboPlayer && typeof hboPlayer.playVideo === 'function') {
      startVideoPlayback();
    } else {
      pendingPlay = true;
    }

    btn.classList.remove('loading');
    btn.disabled = false;
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

  async function init() {
    const btn = $('#btn-start');
    btn.classList.add('loading');

    try {
      const res = await fetch('config.json');
      appConfig = await res.json();
    } catch (e) {
      console.warn('Could not load config.json, using defaults');
      appConfig = {
        genres: [{ label: 'All Genres', value: [] }],
        defaults: { country: 'us', lang: 'en', brands: [], franchises: [], contentType: 'SHOWS', limit: 50 }
      };
    }

    populateGenreDropdown(appConfig.genres);
    selectedGenre = appConfig.genres[0].value;

    catalogPromise = loadCatalog();
    await catalogPromise;
    btn.classList.remove('loading');
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

  init();
})();
