const GENRE_THEMES = {
  'comedy': 'comedy',
  'drama': 'drama',
  'action': 'action',
  'horror': 'horror',
  'thriller': 'thrillers',
  'documentary': 'documentaries',
  'crime': 'crime',
};

const BG_EXTENSIONS = ['.avif', '.webp', '.jpg', '.png'];
const CATALOG_CACHE_TTL = 30 * 60 * 1000;

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
          hbomaxId releaseYear
          trailer { programId editId title url }
          images genresFormatted
          title { short full }
          summary { short full }
          imageUrlLink localizedRating
        }
        ... on Feature {
          hbomaxId releaseYear
          trailer { programId editId title url }
          images
          title { short full }
          summary { short full }
          imageUrlLink genresFormatted localizedRating
        }
      }
    }
  }
`;

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

// ─── YouTube API Singleton ───────────────────────────
let ytApiLoaded = false;
let ytApiReady = false;
const ytReadyQueue = [];

function ensureYouTubeApi() {
  if (ytApiLoaded) return;
  ytApiLoaded = true;
  const prev = globalThis.onYouTubeIframeAPIReady;
  globalThis.onYouTubeIframeAPIReady = function () {
    ytApiReady = true;
    if (prev) prev();
    ytReadyQueue.forEach(cb => cb());
    ytReadyQueue.length = 0;
  };
  if (typeof YT !== 'undefined' && YT.Player) {
    ytApiReady = true;
    return;
  }
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

function onYtReady(cb) {
  if (ytApiReady) { cb(); return; }
  ytReadyQueue.push(cb);
}

// ─── Helpers ─────────────────────────────────────────
let instanceCounter = 0;

function pickFrom(images, ...keys) {
  if (!images || typeof images !== 'object') return null;
  for (const k of keys) { if (images[k]) return images[k]; }
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
    trailerUrl: item.trailer?.url || null,
  };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function forceReflow(el) {
  return el.offsetWidth;
}

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

// ─── Component Class ─────────────────────────────────
export class HBOStageReveal {

  static defaults = {
    skin: 'default',
    availableSkins: ['default', 'batman', 'harry-potter', 'halloween', 'game-of-thrones'],
    introVideoId: null,
    graphqlEndpoint: 'http://localhost:8000/graphql',
    showSkinPicker: true,
    showGenrePicker: true,
    width: '100%',
    height: '100%',
    onReveal: null,
    onWatch: null,
  };

  constructor(container, config = {}) {
    this.id = ++instanceCounter;
    this.playerId = 'hbo-player-' + this.id;
    this.config = { ...HBOStageReveal.defaults, ...config };
    this.container = container;
    this.destroyed = false;

    this.appConfig = null;
    this.fullCatalog = [];
    this.allItems = [];
    this.currentShowId = null;
    this.selectedGenre = [];
    this.isAnimating = false;
    this.player = null;
    this.pendingPlay = false;
    this.catalogReady = false;
    this.catalogPromise = null;
    this.currentSkinId = null;
    this.skinLinkEl = null;
    this.skinFontLinkEl = null;
    this.scatterAnimFrame = null;
    this.recentIds = [];
    this.abortController = new AbortController();

    this._render();
    this.root = this.container.querySelector('.hbo-stage');
    this.$ = (sel) => this.root.querySelector(sel);
    this.$$ = (sel) => this.root.querySelectorAll(sel);

    this._bindEvents();
    this._initAsync();
  }

  _initAsync() {
    this._init();
  }

  // ─── Template ──────────────────────────────────────

  _render() {
    const c = this.config;
    this.container.innerHTML = `
    <div class="hbo-stage" style="width:${c.width};height:${c.height}">
      <div class="hbo-loading-overlay">
        <div class="loading-grain"></div>
        <div class="loading-spotlight"></div>
        <div class="loading-content">
          <div class="loading-logo">HBO</div>
          <div class="loading-bar"><div class="loading-bar-fill"></div></div>
        </div>
      </div>

      ${c.showSkinPicker ? `
      <div class="skin-picker-corner">
        <select class="skin-select">
          <option value="default">Stage Spotlight</option>
        </select>
      </div>` : ''}

      <div class="skin-bg"></div>
      <div class="skin-scatter"></div>

      <section class="frame frame-idle active">
        <div class="bg-base"></div>
        <div class="cinematic-bg"></div>
        <div class="grain-overlay"></div>
        <div class="ambient-light"></div>
        <div class="skin-hero skin-hero--idle"></div>
        <div class="idle-content">
          <h1 class="idle-title">Find Something Great to Watch</h1>
          <button class="btn btn-start">Start the Show</button>
        </div>
      </section>

      <section class="frame frame-credits">
        <div class="credits-bg"></div>
        <div class="video-wrapper">
          <div id="${this.playerId}"></div>
        </div>
      </section>

      <section class="frame frame-transition">
        <div class="blackout-bg"></div>
        <div class="spotlight-cone spotlight-cone--dim"></div>
        <div class="skin-hero skin-hero--transition"></div>
        <div class="particles particles-transition"></div>
        <div class="transition-spinner">
          <div class="transition-spinner-logo">HBO</div>
          <div class="transition-spinner-ring"></div>
        </div>
      </section>

      <section class="frame frame-reveal">
        <div class="reveal-bg"></div>
        <div class="cinematic-bg"></div>
        <div class="stage-glow"></div>
        <div class="spotlight-cone spotlight-cone--bright"></div>
        <div class="spotlight-cone spotlight-cone--accent"></div>
        <div class="spotlight-flare"></div>
        <div class="skin-hero skin-hero--reveal"></div>
        <div class="swap-flash"></div>
        <div class="theme-transition"></div>
        <div class="grain-overlay"></div>
        <div class="particles particles-reveal"></div>

        <div class="reveal-content">
          <div class="content-card">
            <div class="card-image">
              <div class="card-placeholder">
                <div class="card-placeholder-icon"></div>
              </div>
            </div>
          </div>
          <div class="reveal-info">
            <h2 class="reveal-title"></h2>
            <p class="reveal-description"></p>
          </div>
          ${c.showGenrePicker ? `
          <div class="pickers-row">
            <span class="genre-label">I'm in the mood for some</span>
            <div class="genre-picker">
              <select class="genre-select">
                <option value="">Loading…</option>
              </select>
            </div>
          </div>` : ''}
          <div class="reveal-actions">
            <button class="btn btn-primary btn-watch">Watch Now</button>
            <button class="btn btn-secondary btn-another">Try Another</button>
          </div>
        </div>
      </section>
    </div>`;
  }

  // ─── Events ────────────────────────────────────────

  _bindEvents() {
    const sig = { signal: this.abortController.signal };

    this.$('.btn-start').addEventListener('click', () => this._runFullSequence(), sig);
    this.$('.btn-another').addEventListener('click', () => this._tryAnother(), sig);
    this.$('.btn-watch').addEventListener('click', () => this._goHome(), sig);

    const genreSelect = this.$('.genre-select');
    if (genreSelect) {
      genreSelect.addEventListener('change', (e) => this._onGenreChange(e), sig);
    }

    const skinSelect = this.$('.skin-select');
    if (skinSelect) {
      skinSelect.addEventListener('change', (e) => this._switchSkin(e.target.value), sig);
    }
  }

  // ─── Init ──────────────────────────────────────────

  async _init() {
    try {
      const res = await fetch('config.json');
      this.appConfig = await res.json();
    } catch {
      this.appConfig = {
        genres: [{ label: 'All Genres', value: [] }],
        defaults: { country: 'us', lang: 'en', brands: [], franchises: [], contentType: 'BOTH', limit: 50 },
        activeSkin: 'default',
        availableSkins: ['default'],
      };
    }

    const skinId = this.config.skin || this.appConfig.activeSkin || 'default';
    const skins = this.config.availableSkins || this.appConfig.availableSkins || ['default'];

    this._populateGenreDropdown(this.appConfig.genres);
    this.selectedGenre = this.appConfig.genres[0].value;

    this.catalogPromise = this._loadCatalog();

    if (this.config.showSkinPicker) {
      await this._populateSkinDropdown(skins);
    }
    await this._loadSkin(skinId);

    const skinSelect = this.$('.skin-select');
    if (skinSelect) skinSelect.value = skinId;

    this._dismissLoadingOverlay();
    this._initPlayer();
  }

  // ─── YouTube Player ────────────────────────────────

  _initPlayer() {
    ensureYouTubeApi();
    onYtReady(() => {
      if (this.destroyed) return;
      this._createPlayer();
    });
  }

  _createPlayer() {
    const videoId = this.config.introVideoId || 'O08PQRA6MLo';
    this.player = new YT.Player(this.playerId, {
      videoId,
      playerVars: {
        autoplay: 0, controls: 0, modestbranding: 1, rel: 0,
        showinfo: 0, iv_load_policy: 3, disablekb: 1, fs: 0,
        playsinline: 1, loop: 0, mute: 0,
        origin: globalThis.location.origin,
      },
      events: {
        onReady: () => this._onPlayerReady(),
        onStateChange: (e) => this._onPlayerStateChange(e),
      },
    });
  }

  _onPlayerReady() {
    this._prebufferVideo();
    if (this.pendingPlay) {
      this.pendingPlay = false;
      this._startVideoPlayback();
    }
  }

  _onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
      this._afterVideoEnds();
    }
  }

  _prebufferVideo() {
    if (!this.player || typeof this.player.mute !== 'function') return;
    this.player.mute();
    this.player.playVideo();
    setTimeout(() => {
      if (!this.player || typeof this.player.pauseVideo !== 'function') return;
      this.player.pauseVideo();
      this.player.unMute();
      this.player.seekTo(0, true);
    }, 500);
  }

  _setIframeVisible(visible) {
    if (!this.player?.getIframe) return;
    const iframe = this.player.getIframe();
    if (!iframe) return;
    iframe.classList.toggle('playing', visible);
  }

  _startVideoPlayback() {
    if (!this.player || typeof this.player.seekTo !== 'function') return;
    this.player.seekTo(0, true);
    this._setIframeVisible(true);
    this.player.playVideo();
  }

  // ─── Skin Engine ───────────────────────────────────

  async _loadSkin(skinId) {
    const res = await fetch('skins/' + skinId + '/skin.json');
    const manifest = await res.json();
    this.currentSkinId = skinId;

    if (this.skinLinkEl) { this.skinLinkEl.remove(); this.skinLinkEl = null; }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'skins/' + skinId + '/skin.css';
    const cssLoaded = new Promise((resolve) => {
      link.onload = resolve;
      link.onerror = resolve;
    });
    document.head.appendChild(link);
    this.skinLinkEl = link;
    await cssLoaded;

    const bgUrl = await detectBackground(skinId);
    const skinBg = this.$('.skin-bg');
    if (bgUrl) {
      skinBg.style.backgroundImage = 'url(' + bgUrl + ')';
      skinBg.style.backgroundSize = 'cover';
      skinBg.style.backgroundPosition = 'center';
      skinBg.style.backgroundRepeat = 'no-repeat';
    } else {
      skinBg.style.backgroundImage = '';
    }

    this.root.dataset.skin = skinId;

    await this._loadSkinFont(manifest);
    this._applySkinText(manifest);
    this._spawnScatterLogos(skinId, manifest);
  }

  async _loadSkinFont(manifest) {
    if (this.skinFontLinkEl) { this.skinFontLinkEl.remove(); this.skinFontLinkEl = null; }

    if (manifest.fontUrl) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = manifest.fontUrl;
      const fontLoaded = new Promise((resolve) => {
        link.onload = resolve;
        link.onerror = resolve;
      });
      document.head.appendChild(link);
      this.skinFontLinkEl = link;
      await fontLoaded;
    }

    const fontFamily = manifest.fontFamily || "'Inter', sans-serif";
    this.root.style.setProperty('--font-display', fontFamily);
  }

  _applySkinText(manifest) {
    if (manifest.idle) {
      if (manifest.idle.title) this.$('.idle-title').textContent = manifest.idle.title;
      if (manifest.idle.buttonText) this.$('.btn-start').textContent = manifest.idle.buttonText;
    }
    if (manifest.reveal) {
      if (manifest.reveal.watchButtonText) this.$('.btn-watch').textContent = manifest.reveal.watchButtonText;
      if (manifest.reveal.anotherButtonText) this.$('.btn-another').textContent = manifest.reveal.anotherButtonText;
    }
    const label = this.$('.genre-label');
    if (manifest.moodText && label) label.textContent = manifest.moodText;
    if (manifest.particleColor) {
      this.root.style.setProperty('--particle-rgb', manifest.particleColor);
    }
  }

  _spawnScatterLogos(skinId, manifest) {
    const container = this.$('.skin-scatter');
    container.innerHTML = '';
    if (this.scatterAnimFrame) {
      cancelAnimationFrame(this.scatterAnimFrame);
      this.scatterAnimFrame = null;
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
        el, baseX: Math.random() * 100, baseY: Math.random() * 100,
        driftX: 0.3 + Math.random() * 0.6, driftY: 0.2 + Math.random() * 0.5,
        phaseX: Math.random() * Math.PI * 2, phaseY: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3, baseRot: Math.random() * 40 - 20,
        fadeDelay: i * 80, opacity: 0.08 + Math.random() * 0.12,
      });
    }

    icons.forEach(icon => {
      setTimeout(() => {
        icon.el.classList.add('visible');
        icon.el.style.opacity = icon.opacity;
      }, icon.fadeDelay);
    });

    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = (now - startTime) / 1000;
      for (const icon of icons) {
        const x = icon.baseX + Math.sin(elapsed * icon.driftX + icon.phaseX) * 2;
        const y = icon.baseY + Math.cos(elapsed * icon.driftY + icon.phaseY) * 2;
        const rot = icon.baseRot + Math.sin(elapsed * icon.rotSpeed) * 8;
        icon.el.style.left = x + '%';
        icon.el.style.top = y + '%';
        icon.el.style.transform = 'rotate(' + rot + 'deg)';
      }
      this.scatterAnimFrame = requestAnimationFrame(animate);
    };
    this.scatterAnimFrame = requestAnimationFrame(animate);
  }

  async _switchSkin(skinId) {
    if (skinId === this.currentSkinId || this.isAnimating) return;

    const overlay = this.$('.theme-transition');
    overlay.classList.remove('fire');
    forceReflow(overlay);
    overlay.classList.add('fire');

    await wait(300);
    await this._loadSkin(skinId);
    await wait(500);

    this.$$('.skin-hero').forEach(el => el.classList.remove('animate'));
    if (this.$('.frame-reveal').classList.contains('active')) {
      this._animateSkinHeroes();
    }
  }

  async _populateSkinDropdown(skins) {
    const select = this.$('.skin-select');
    if (!select) return;
    select.innerHTML = '';
    const labels = await Promise.all(skins.map(async (skinId) => {
      try {
        const res = await fetch('skins/' + skinId + '/skin.json');
        const data = await res.json();
        return { id: skinId, name: data.name || skinId };
      } catch { return { id: skinId, name: skinId }; }
    }));
    labels.forEach(({ id, name }) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  _animateSkinHeroes() {
    this.$$('.skin-hero').forEach(el => el.classList.add('animate'));
  }

  _resetSkinHeroes() {
    this.$$('.skin-hero').forEach(el => {
      el.classList.remove('animate');
      el.style.opacity = '';
    });
  }

  // ─── Theme (Genre) ────────────────────────────────

  _applyTheme(genreValues) {
    if (!genreValues || genreValues.length === 0) {
      delete this.root.dataset.theme;
      return;
    }
    const slug = GENRE_THEMES[genreValues[0]];
    if (slug) { this.root.dataset.theme = slug; }
    else { delete this.root.dataset.theme; }
  }

  // ─── Data Loading ──────────────────────────────────

  async _gql(query, variables = {}) {
    const res = await fetch(this.config.graphqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) console.error('GraphQL errors:', json.errors);
    return json.data;
  }

  _getCacheKey() {
    return 'hbo_catalog_' + this.id;
  }

  _getCachedCatalog() {
    try {
      const raw = localStorage.getItem(this._getCacheKey());
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.ts > CATALOG_CACHE_TTL) {
        localStorage.removeItem(this._getCacheKey());
        return null;
      }
      return cached.items;
    } catch { return null; }
  }

  _setCachedCatalog(items) {
    try {
      localStorage.setItem(this._getCacheKey(), JSON.stringify({ ts: Date.now(), items }));
    } catch { /* quota exceeded */ }
  }

  async _loadCatalog() {
    const cached = this._getCachedCatalog();
    if (cached && cached.length > 0) {
      this.fullCatalog = cached;
      this._filterByGenre();
      this.catalogReady = true;
      this._refreshCatalogInBackground();
      return this.allItems;
    }

    const d = this.appConfig ? this.appConfig.defaults : {};
    try {
      const data = await this._gql(WHAT_SHOULD_I_WATCH, {
        country: d.country || 'us', lang: d.lang || 'en', genres: [],
        brands: d.brands || [], franchises: d.franchises || [],
        contentType: d.contentType || 'BOTH', limit: d.limit || 50,
      });
      if (data?.whatShouldIWatch?.items) {
        this.fullCatalog = data.whatShouldIWatch.items.map(normalize);
        this._setCachedCatalog(this.fullCatalog);
      }
    } catch (err) {
      console.warn('GraphQL unreachable, using mock catalog:', err.message);
      this.fullCatalog = MOCK_CATALOG.slice();
    }
    if (this.fullCatalog.length === 0) {
      this.fullCatalog = MOCK_CATALOG.slice();
    }
    this._filterByGenre();
    this.catalogReady = this.fullCatalog.length > 0;
    return this.allItems;
  }

  async _refreshCatalogInBackground() {
    const d = this.appConfig ? this.appConfig.defaults : {};
    try {
      const data = await this._gql(WHAT_SHOULD_I_WATCH, {
        country: d.country || 'us', lang: d.lang || 'en', genres: [],
        brands: d.brands || [], franchises: d.franchises || [],
        contentType: d.contentType || 'BOTH', limit: d.limit || 50,
      });
      if (data?.whatShouldIWatch?.items) {
        const fresh = data.whatShouldIWatch.items.map(normalize);
        if (fresh.length > 0) {
          this.fullCatalog = fresh;
          this._setCachedCatalog(this.fullCatalog);
          this._filterByGenre();
        }
      }
    } catch { /* silent */ }
  }

  _filterByGenre() {
    if (!this.selectedGenre || this.selectedGenre.length === 0) {
      this.allItems = this.fullCatalog.slice();
      return;
    }
    const lowerGenres = this.selectedGenre.map(g => g.toLowerCase());
    this.allItems = this.fullCatalog.filter(item => {
      if (!item.genre) return false;
      const g = typeof item.genre === 'string' ? item.genre.toLowerCase() : '';
      return lowerGenres.some(lg => g.includes(lg));
    });
    if (this.allItems.length === 0) this.allItems = this.fullCatalog.slice();
  }

  _fetchRandomShow() {
    if (!this.allItems.length) return null;
    let pool = this.allItems.filter(s => !this.recentIds.includes(s.id));
    if (pool.length === 0) {
      this.recentIds.length = 0;
      pool = this.allItems.filter(s => s.id !== this.currentShowId);
      if (pool.length === 0) pool = this.allItems;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.currentShowId = pick.id;
    this.recentIds.push(pick.id);
    if (this.recentIds.length > 10) this.recentIds.shift();
    return pick;
  }

  // ─── UI Helpers ────────────────────────────────────

  _populateGenreDropdown(genres) {
    const select = this.$('.genre-select');
    if (!select) return;
    select.innerHTML = '';
    genres.forEach((g, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = g.label;
      select.appendChild(opt);
    });
  }

  _dismissLoadingOverlay() {
    const overlay = this.$('.hbo-loading-overlay');
    if (!overlay) return;
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.classList.add('hidden'), 800);
  }

  _switchFrame(from, to) {
    from.classList.remove('active');
    to.classList.add('active');
  }

  _createParticles(container, count = 20) {
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

  _applyShow(show) {
    const card = this.$('.content-card');
    const title = this.$('.reveal-title');
    const desc = this.$('.reveal-description');
    const placeholder = this.$('.card-placeholder');
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

  // ─── Animation Sequences ──────────────────────────

  _animateRevealElements() {
    const card = this.$('.content-card');
    const info = this.$('.reveal-info');
    const actions = this.$('.reveal-actions');
    const pickersRow = this.$('.pickers-row');
    const spotBright = this.$('.frame-reveal .spotlight-cone--bright');
    const spotAccent = this.$('.frame-reveal .spotlight-cone--accent');
    const flare = this.$('.spotlight-flare');
    const glow = this.$('.stage-glow');

    card.classList.add('animate');
    info.classList.add('animate');
    if (pickersRow) pickersRow.classList.add('animate');
    actions.classList.add('animate');
    spotBright.classList.add('animate');
    spotAccent.classList.add('animate');
    flare.classList.add('animate');
    glow.classList.add('animate');
    this._animateSkinHeroes();
  }

  _resetRevealElements() {
    const card = this.$('.content-card');
    const info = this.$('.reveal-info');
    const actions = this.$('.reveal-actions');
    const pickersRow = this.$('.pickers-row');
    const spotBright = this.$('.frame-reveal .spotlight-cone--bright');
    const spotAccent = this.$('.frame-reveal .spotlight-cone--accent');
    const flare = this.$('.spotlight-flare');
    const glow = this.$('.stage-glow');
    const flash = this.$('.swap-flash');

    [card, info, actions, pickersRow, spotBright, spotAccent, flare, glow].forEach(el => {
      if (!el) return;
      el.classList.remove('animate', 'swap-out', 'swap-in', 'swap-flicker', 'fire');
      el.style.opacity = '';
    });
    if (flash) flash.classList.remove('fire');
    this._resetSkinHeroes();

    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    info.style.opacity = '0';
    info.style.transform = 'translateY(12px)';
    if (pickersRow) { pickersRow.style.opacity = '0'; pickersRow.style.transform = 'translateY(12px)'; }
    actions.style.opacity = '0';
    actions.style.transform = 'translateY(12px)';
    spotBright.style.opacity = '0';
    spotAccent.style.opacity = '0';
    flare.style.opacity = '0';
    glow.style.opacity = '0';
  }

  async _runFullSequence() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    this._resetRevealElements();
    this._switchFrame(this.$('.frame-idle'), this.$('.frame-credits'));
    await wait(100);

    if (this.player && typeof this.player.playVideo === 'function') {
      this._startVideoPlayback();
    } else {
      this.pendingPlay = true;
    }
  }

  async _afterVideoEnds() {
    this._setIframeVisible(false);

    const frameCredits = this.$('.frame-credits');
    const frameTransition = this.$('.frame-transition');
    const frameReveal = this.$('.frame-reveal');
    const spotlightDim = this.$('.spotlight-cone--dim');
    const spinner = this.$('.transition-spinner');

    this._switchFrame(frameCredits, frameTransition);
    spinner.classList.add('visible');

    if (!this.catalogReady && this.catalogPromise != null) {
      await this.catalogPromise;
    }

    const show = this._fetchRandomShow();
    if (!show) { this.isAnimating = false; return; }
    this._applyShow(show);
    if (this.config.onReveal) this.config.onReveal(show);
    this._createParticles(this.$('.particles-transition'), 15);
    this._createParticles(this.$('.particles-reveal'), 25);

    await wait(200);
    spotlightDim.classList.add('animate');
    await wait(800);
    spinner.classList.remove('visible');
    await wait(200);

    this._switchFrame(frameTransition, frameReveal);
    spotlightDim.classList.remove('animate');
    spotlightDim.style.opacity = '0';
    await wait(100);
    this._animateRevealElements();

    this.isAnimating = false;
  }

  async _tryAnother() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    const card = this.$('.content-card');
    const info = this.$('.reveal-info');
    const flash = this.$('.swap-flash');
    const spotBright = this.$('.frame-reveal .spotlight-cone--bright');
    const spotAccent = this.$('.frame-reveal .spotlight-cone--accent');

    card.classList.remove('animate', 'swap-in');
    info.classList.remove('animate', 'swap-in');
    spotBright.classList.add('swap-flicker');
    spotAccent.classList.add('swap-flicker');
    card.classList.add('swap-out');
    info.classList.add('swap-out');

    await wait(350);
    flash.classList.remove('fire');
    forceReflow(flash);
    flash.classList.add('fire');
    await wait(150);

    const show = this._fetchRandomShow();
    if (!show) { this.isAnimating = false; return; }
    this._applyShow(show);
    if (this.config.onReveal) this.config.onReveal(show);
    this._createParticles(this.$('.particles-reveal'), 25);

    card.classList.remove('swap-out');
    info.classList.remove('swap-out');
    card.classList.add('swap-in');
    info.classList.add('swap-in');

    await wait(700);
    spotBright.classList.remove('swap-flicker');
    spotAccent.classList.remove('swap-flicker');
    spotBright.classList.add('animate');
    spotAccent.classList.add('animate');

    this.isAnimating = false;
  }

  _goHome() {
    this._resetRevealElements();
    this._switchFrame(this.$('.frame-reveal'), this.$('.frame-idle'));

    if (this.player && typeof this.player.stopVideo === 'function') {
      this.player.stopVideo();
    }
    if (this.config.onWatch) this.config.onWatch();

    const title = this.$('.idle-title');
    const btn = this.$('.btn-start');
    title.style.animation = 'none';
    btn.style.animation = 'none';
    forceReflow(title);
    title.style.animation = 'fadeUp 0.8s ease 0.1s forwards';
    btn.style.animation = 'fadeUp 0.8s ease 0.3s forwards';
    title.style.opacity = '0';
    title.style.transform = 'translateY(20px)';
    btn.style.opacity = '0';
    btn.style.transform = 'translateY(20px)';
  }

  async _onGenreChange(e) {
    const idx = Number.parseInt(e.target.value, 10);
    const genre = this.appConfig.genres[idx];
    if (!genre || this.isAnimating) return;

    this.isAnimating = true;
    this.selectedGenre = genre.value;
    this.currentShowId = null;
    this.recentIds.length = 0;
    this._filterByGenre();

    const card = this.$('.content-card');
    const info = this.$('.reveal-info');
    const flash = this.$('.swap-flash');
    const spotBright = this.$('.frame-reveal .spotlight-cone--bright');
    const spotAccent = this.$('.frame-reveal .spotlight-cone--accent');

    card.classList.remove('animate', 'swap-in');
    info.classList.remove('animate', 'swap-in');
    spotBright.classList.add('swap-flicker');
    spotAccent.classList.add('swap-flicker');
    card.classList.add('swap-out');
    info.classList.add('swap-out');

    await wait(350);
    const themeOverlay = this.$('.theme-transition');
    themeOverlay.classList.remove('fire');
    forceReflow(themeOverlay);
    themeOverlay.classList.add('fire');

    await wait(200);
    this._applyTheme(this.selectedGenre);

    flash.classList.remove('fire');
    forceReflow(flash);
    flash.classList.add('fire');

    await wait(150);
    const show = this._fetchRandomShow();
    if (!show) { this.isAnimating = false; return; }
    this._applyShow(show);
    this._createParticles(this.$('.particles-reveal'), 25);

    card.classList.remove('swap-out');
    info.classList.remove('swap-out');
    card.classList.add('swap-in');
    info.classList.add('swap-in');

    await wait(700);
    spotBright.classList.remove('swap-flicker');
    spotAccent.classList.remove('swap-flicker');
    spotBright.classList.add('animate');
    spotAccent.classList.add('animate');

    this.isAnimating = false;
  }

  // ─── Public API ────────────────────────────────────

  setSkin(skinId) {
    this._switchSkin(skinId);
    const select = this.$('.skin-select');
    if (select) select.value = skinId;
  }

  destroy() {
    this.destroyed = true;
    this.abortController.abort();
    if (this.scatterAnimFrame) cancelAnimationFrame(this.scatterAnimFrame);
    if (this.player && typeof this.player.destroy === 'function') this.player.destroy();
    if (this.skinLinkEl) this.skinLinkEl.remove();
    if (this.skinFontLinkEl) this.skinFontLinkEl.remove();
    this.container.innerHTML = '';
  }
}

if (globalThis.window !== undefined) {
  globalThis.HBOStageReveal = HBOStageReveal;
}
