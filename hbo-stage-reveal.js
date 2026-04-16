import { gsap } from 'https://esm.sh/gsap@3.13.0';

// Module-level reduced-motion flag — read by every tween helper below
const _mm = gsap.matchMedia();
let _reducedMotion = false;
_mm.add(
  { reduceMotion: '(prefers-reduced-motion: reduce)' },
  (ctx) => { _reducedMotion = ctx.conditions.reduceMotion; },
);

/** Maps first genre value from config → `data-theme` slug (must match hbo-stage-reveal.css) */
const GENRE_THEMES = {
  comedy: 'comedy',
  drama: 'drama',
  action: 'action',
  'sci-fi': 'sci-fi',
  horror: 'horror',
  romance: 'romance',
  thriller: 'thriller',
  documentary: 'documentary',
  fantasy: 'fantasy',
  animation: 'animation',
  crime: 'crime',
};

/**
 * Mirrors VIBE_MAPPINGS from dotcom-graphql/source/schemas/constants/vibeMappings.ts.
 * id   → passed as vibeTags[] to GQL
 * genres → used for client-side _filterByGenre + _applyTheme
 */
const VIBE_OPTIONS = [
  { id: 'edge-of-my-seat', label: 'Edge of My Seat', genres: ['action', 'thriller', 'horror', 'crime'] },
  { id: 'cerebral',        label: 'Cerebral',        genres: ['documentary', 'drama', 'sci-fi', 'mystery'] },
  { id: 'feel-good',       label: 'Feel Good',       genres: ['comedy', 'romance', 'animation', 'family'] },
  { id: 'epic-adventure',  label: 'Epic Adventure',  genres: ['fantasy', 'adventure', 'action', 'sci-fi'] },
  { id: 'binge-worthy',    label: 'Binge-Worthy',    genres: ['drama', 'thriller', 'crime', 'mystery'] },
];

const BG_EXTENSIONS = ['.avif', '.webp', '.jpg', '.png'];
const CATALOG_CACHE_TTL = 30 * 60 * 1000;
/** Items per getDiscoveryExperience call; next calls pass cumulative excludeIds. */
const HERO_POOL_LIMIT = 10;
/** Abort hung GraphQL requests; normal responses should finish well under this. */
const GQL_FETCH_TIMEOUT_MS = 25000;

const GET_DISCOVERY_EXPERIENCE = `
  query GetDiscoveryExperience($input: DiscoveryInput!) {
    getDiscoveryExperience(input: $input) {
      heroContentPool {
        hbomaxId
        releaseYear
        imageUrlLink
        images
        primaryGenre
        secondaryGenre
        genresFormatted
        matchReason
        title { short full }
        summary { short full }
      }
      themeMetadata {
        themeId
        name
        visualDesignSkinId
        fontFamily
        stageCopy
        particleColor
        scatterFiles
        scatterCount
        ambientAudio
        ambientVolume
        ambientVersion
        introVideoId
      }
    }
  }
`;

const GET_THEME_METADATA = `
  query GetThemeMetadata($themeId: String!) {
    getThemeMetadata(themeId: $themeId) {
      themeId
      name
      visualDesignSkinId
      fontFamily
      stageCopy
      particleColor
      scatterFiles
      scatterCount
      ambientAudio
      ambientVolume
      ambientVersion
      introVideoId
    }
  }
`;

/**
 * Convert a GQL ThemeMetadata response into the manifest shape expected by
 * _loadSkinFont / _applySkinText / _spawnScatterLogos / _setupSkinAmbient.
 * Falls back gracefully for any missing fields.
 */
function manifestFromThemeMetadata(tm) {
  const copy = tm.stageCopy || {};
  return {
    name:           tm.name,
    fontFamily:     tm.fontFamily || null,
    moodText:       copy.moodText || null,
    idle:           copy.idle || {},
    reveal:         copy.reveal || {},
    particleColor:  tm.particleColor || null,
    scatterFiles:   tm.scatterFiles || [],
    scatterCount:   tm.scatterCount ?? 16,
    ambientAudio:   tm.ambientAudio || null,
    ambientVolume:  typeof tm.ambientVolume === 'number' ? tm.ambientVolume : 0.2,
    ambientVersion: tm.ambientVersion ?? null,
    introVideoId:   tm.introVideoId || null,
  };
}

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
  // imageUrlLink from GQL is the content *page* path (slug URL), not a poster — use localized images map.
  const poster = pickFrom(
    item.images,
    'cover-artwork-horizontal',
    'cover-artwork-square',
    'poster-with-logo',
    '1280_v2',
    'default',
  );
  return {
    id:          item.hbomaxId,
    title:       (item.title && (item.title.full || item.title.short)) || 'Untitled',
    description: (item.summary && (item.summary.short || item.summary.full)) || item.matchReason || '',
    image:       poster || null,
    year:        item.releaseYear || '',
    genre:       item.genresFormatted || [item.primaryGenre, item.secondaryGenre].filter(Boolean).join(', '),
    contentUrl:  item.imageUrlLink ? `https://www.hbomax.com${item.imageUrlLink}` : null,
    rating:      '',
    trailerUrl:  null,
  };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function forceReflow(el) {
  return el.offsetWidth;
}

async function loadImageForShareCard(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);
    return img;
  } catch {
    try {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        im.onload = resolve;
        im.onerror = reject;
        im.src = url;
      });
      return im;
    } catch {
      return null;
    }
  }
}

function wrapCanvasOverflowLine(ctx, lines, words, startIndex, maxWidth, maxLines) {
  let rest = words.slice(startIndex).join(' ');
  while (rest.length > 4 && ctx.measureText(rest + '…').width > maxWidth) {
    rest = rest.slice(0, -1);
  }
  lines.push(rest + '…');
  return lines.slice(0, maxLines);
}

function wrapCanvasLines(ctx, text, maxWidth, maxLines) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length >= maxLines - 1) {
        return wrapCanvasOverflowLine(ctx, lines, words, i, maxWidth, maxLines);
      }
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function slugifyShareFilename(title) {
  let s = String(title).toLowerCase().replaceAll(/[^a-z0-9]+/gi, '-');
  s = s.replace(/^-+/, '').replace(/-+$/, '');
  return s.slice(0, 48) || 'pick';
}

function appendUrlCacheBust(url, version) {
  if (version == null || version === '') return url;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'v=' + encodeURIComponent(String(version));
}

/** Resolve relative paths against the page URL (needed for fetch). */
function resolveMediaUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return globalThis.location.origin + pathOrUrl;
  return new URL(pathOrUrl, globalThis.location.href).href;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
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
    onShare: null,
    showAmbientToggle: true,
    showShareButton: true,
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
    /** Currently selected VIBE_OPTIONS entry (null = All Vibes). */
    this.selectedVibe = VIBE_OPTIONS[0];
    this.isAnimating = false;
    this.player = null;
    this.pendingPlay = false;
    this.catalogReady = false;
    this.catalogPromise = null;
    this.currentSkinId = null;
    this.skinLinkEl = null;
    this.skinFontLinkEl = null;
    this._scatterTweens = [];
    this.recentIds = [];
    /** Cumulative content ids from GQL — sent as excludeIds on the next hero fetch. */
    this.apiExcludedIds = [];
    this.abortController = new AbortController();

    this.ambientSkinAudio = null;
    this.ambientThemeAudio = null;
    this.skinAmbientVolume = 0.2;
    this.themeAmbientVolume = 0.16;
    this.audioUnlocked = false;
    this.ambientVideoPaused = false;
    this.ambientUserMuted = globalThis.localStorage?.getItem('hbo_stage_ambient_muted') === '1';

    this.currentShow = null;
    this.currentSkinManifest = null;
    /** Keyed by themeId/skinId. Populated from getDiscoveryExperience.themeMetadata. */
    this._themeMetadataCache = new Map();
    this.ambientSkinBlobUrl = null;
    this.ambientThemeBlobUrl = null;

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
        <div class="custom-dropdown skin-dropdown" role="listbox" aria-label="Select theme">
          <button class="custom-dropdown-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
            <span class="custom-dropdown-value">Loading…</span>
            <svg class="custom-dropdown-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
              <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="custom-dropdown-menu"></div>
        </div>
      </div>` : ''}

      ${c.showAmbientToggle === false ? '' : `
      <button type="button" class="hbo-ambient-toggle" aria-label="Ambient sound" title="Ambient sound"></button>`}

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
              <a class="card-poster-link" target="_blank" rel="noopener noreferrer">
                <div class="card-placeholder">
                  <img class="card-poster-img" alt="" decoding="async" loading="eager" />
                  <div class="card-placeholder-icon"></div>
                </div>
              </a>
            </div>
          </div>
          <div class="reveal-info">
            <h2 class="reveal-title"></h2>
            <p class="reveal-description"></p>
          </div>
          ${c.showGenrePicker ? `
          <div class="pickers-row">
            <span class="genre-label">Mood</span>
            <div class="genre-picker">
              <div class="custom-dropdown genre-dropdown" role="listbox" aria-label="Select mood">
                <button class="custom-dropdown-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
                  <span class="custom-dropdown-value">Loading…</span>
                  <svg class="custom-dropdown-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="custom-dropdown-menu"></div>
              </div>
            </div>
          </div>` : ''}
          <div class="reveal-actions">
            <a class="btn btn-primary btn-watch" target="_blank" rel="noopener noreferrer">Watch Now</a>
            <button type="button" class="btn btn-secondary btn-trailer" disabled>Watch Trailer</button>
            <button type="button" class="btn btn-secondary btn-another">Try Another</button>
            ${c.showShareButton === false ? '' : `
            <button type="button" class="btn btn-secondary btn-share">Share</button>`}
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

    const shareBtn = this.$('.btn-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this._shareCanvasCard(), sig);
    }

    // Custom dropdown: open/close on trigger click
    this.root.addEventListener('click', (e) => {
      const trigger = e.target.closest('.custom-dropdown-trigger');
      if (trigger) {
        e.stopPropagation();
        const dropdown = trigger.closest('.custom-dropdown');
        const isOpen = dropdown.classList.contains('is-open');
        this.$$('.custom-dropdown.is-open').forEach(d => {
          d.classList.remove('is-open');
          const t = d.querySelector('.custom-dropdown-trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          dropdown.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
        return;
      }
      this.$$('.custom-dropdown.is-open').forEach(d => {
        d.classList.remove('is-open');
        const t = d.querySelector('.custom-dropdown-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }, sig);

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      this.$$('.custom-dropdown.is-open').forEach(d => {
        d.classList.remove('is-open');
        const t = d.querySelector('.custom-dropdown-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }, sig);

    // Genre dropdown item selection
    const genreMenu = this.$('.genre-dropdown .custom-dropdown-menu');
    if (genreMenu) {
      genreMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-dropdown-item');
        if (!item) return;
        const dropdown = genreMenu.closest('.custom-dropdown');
        dropdown.classList.remove('is-open');
        const trigger = dropdown.querySelector('.custom-dropdown-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        genreMenu.querySelectorAll('.custom-dropdown-item').forEach(i => i.classList.remove('is-selected'));
        item.classList.add('is-selected');
        const valEl = dropdown.querySelector('.custom-dropdown-value');
        if (valEl) valEl.textContent = item.textContent.trim();
        this._unlockAmbientAudio();
        this._onGenreChange({ target: { value: item.dataset.value } });
      }, sig);
    }

    // Skin dropdown item selection
    const skinMenu = this.$('.skin-dropdown .custom-dropdown-menu');
    if (skinMenu) {
      skinMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-dropdown-item');
        if (!item) return;
        const dropdown = skinMenu.closest('.custom-dropdown');
        dropdown.classList.remove('is-open');
        const trigger = dropdown.querySelector('.custom-dropdown-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        skinMenu.querySelectorAll('.custom-dropdown-item').forEach(i => i.classList.remove('is-selected'));
        item.classList.add('is-selected');
        const valEl = dropdown.querySelector('.custom-dropdown-value');
        if (valEl) valEl.textContent = item.textContent.trim();
        this._unlockAmbientAudio();
        this._switchSkin(item.dataset.value);
      }, sig);
    }

    const ambBtn = this.$('.hbo-ambient-toggle');
    if (ambBtn) {
      ambBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleAmbientMute();
      }, sig);
      this._updateAmbientToggleUi();
    }

    this.root.addEventListener('pointerdown', () => this._unlockAmbientAudio(), { once: true, signal: this.abortController.signal });
  }

  // ─── Init ──────────────────────────────────────────

  async _init() {
    try {
      try {
        const res = await fetch('config.json');
        this.appConfig = await res.json();
      } catch {
        this.appConfig = {
          defaults: { country: 'us', lang: 'en' },
          activeSkin: 'default',
          availableSkins: ['default'],
          themeAmbient: {},
          themeAmbientVolume: 0.16,
        };
      }

      const skinId = this.config.skin || this.appConfig.activeSkin || 'default';
      const skins = this.config.availableSkins || this.appConfig.availableSkins || ['default'];

      this._populateGenreDropdown(VIBE_OPTIONS);
      this.selectedVibe = VIBE_OPTIONS[0];
      this.selectedGenre = VIBE_OPTIONS[0].genres;

      this.catalogPromise = this._loadCatalog();

      if (this.config.showSkinPicker) {
        await this._populateSkinDropdown(skins);
      }
      await this._loadSkin(skinId);

      this._syncSkinDropdownValue(skinId);

      this._initPlayer();
    } catch (e) {
      console.warn('Stage init failed:', e);
    } finally {
      this._dismissLoadingOverlay();
    }
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
    let manifest = null;

    // Use cached themeMetadata if available (populated from getDiscoveryExperience in Task 8)
    const cached = this._themeMetadataCache?.get(skinId);
    if (cached) {
      manifest = manifestFromThemeMetadata(cached);
    }

    // Otherwise fetch from GQL
    if (!manifest) {
      try {
        const data = await this._gql(GET_THEME_METADATA, { themeId: skinId });
        const tm = data?.getThemeMetadata;
        if (tm) {
          if (this._themeMetadataCache) this._themeMetadataCache.set(skinId, tm);
          manifest = manifestFromThemeMetadata(tm);
        }
      } catch (e) {
        console.warn('getThemeMetadata GQL failed, falling back to skin.json:', e.message);
      }
    }

    // Final fallback: skin.json
    if (!manifest) {
      try {
        const res = await fetch('skins/' + skinId + '/skin.json', { cache: 'no-store' });
        manifest = await res.json();
      } catch (e) {
        console.warn('skin.json fallback also failed:', e.message);
        manifest = {};
      }
    }

    this.currentSkinManifest = manifest;
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
    await this._setupSkinAmbient(manifest, skinId);
    await this._syncThemeAmbient();
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
    if (label) {
      if (manifest.moodText) {
        label.textContent = manifest.moodText;
        label.classList.add('has-mood-text');
      } else {
        label.textContent = 'Mood';
        label.classList.remove('has-mood-text');
      }
    }
    if (manifest.particleColor) {
      this.root.style.setProperty('--particle-rgb', manifest.particleColor);
    }
  }

  _spawnScatterLogos(skinId, manifest) {
    const container = this.$('.skin-scatter');
    container.innerHTML = '';

    // Kill any tweens from a previous skin's scatter icons
    if (this._scatterTweens) {
      this._scatterTweens.forEach(t => t.kill());
    }
    this._scatterTweens = [];

    const logos = manifest.scatterFiles;
    if (!logos || logos.length === 0) return;

    const count = manifest.scatterCount || 16;

    for (let i = 0; i < count; i++) {
      const src = 'skins/' + skinId + '/' + logos[i % logos.length];
      const size = 28 + Math.random() * 50;
      const el = document.createElement('div');
      el.className = 'scatter-icon';
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      // Position with transforms (not left/top) so GSAP can own them
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';

      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      el.appendChild(img);
      container.appendChild(el);

      const baseX = Math.random() * (container.offsetWidth || window.innerWidth);
      const baseY = Math.random() * (container.offsetHeight || window.innerHeight);
      const driftX = 12 + Math.random() * 18;
      const driftY = 8 + Math.random() * 14;
      const duration = 5.5 + Math.random() * 6;
      const baseRot = Math.random() * 40 - 20;
      const rotRange = 8 + Math.random() * 10;
      const opacity = 0.08 + Math.random() * 0.12;
      const delay = i * 0.08;

      // Set starting position
      gsap.set(el, { x: baseX, y: baseY, rotation: baseRot, autoAlpha: 0 });

      // Fade in with stagger
      const tf = gsap.to(el, { autoAlpha: opacity, duration: 0.6, delay });

      // Horizontal drift loop
      const tx = gsap.to(el, {
        x: baseX + driftX,
        duration: duration * 0.6,
        delay,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });

      // Vertical drift loop (different period for organic feel)
      const ty = gsap.to(el, {
        y: baseY + driftY,
        duration: duration,
        delay,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });

      // Rotation loop
      const tr = gsap.to(el, {
        rotation: baseRot + rotRange,
        duration: duration * 1.3,
        delay,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });

      this._scatterTweens.push(tf, tx, ty, tr);
    }
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
    const menu = this.$('.skin-dropdown .custom-dropdown-menu');
    if (!menu) return;
    menu.innerHTML = '';
    const labels = await Promise.all(skins.map(async (skinId) => {
      try {
        const data = await this._gql(GET_THEME_METADATA, { themeId: skinId });
        const name = data?.getThemeMetadata?.name;
        return { id: skinId, name: name || skinId };
      } catch {
        try {
          const res = await fetch('skins/' + skinId + '/skin.json', { cache: 'no-store' });
          const d = await res.json();
          return { id: skinId, name: d.name || skinId };
        } catch {
          return { id: skinId, name: skinId };
        }
      }
    }));
    labels.forEach(({ id, name }, i) => {
      const item = document.createElement('div');
      item.className = 'custom-dropdown-item' + (i === 0 ? ' is-selected' : '');
      item.setAttribute('role', 'option');
      item.dataset.value = id;
      item.textContent = name;
      menu.appendChild(item);
    });
  }

  _syncSkinDropdownValue(skinId) {
    const items = this.$$('.skin-dropdown .custom-dropdown-item');
    items.forEach(item => item.classList.toggle('is-selected', item.dataset.value === skinId));
    const selected = this.$('.skin-dropdown .custom-dropdown-item.is-selected');
    const valEl = this.$('.skin-dropdown .custom-dropdown-value');
    if (valEl && selected) valEl.textContent = selected.textContent.trim();
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

  async _applyTheme(genreValues) {
    if (!genreValues || genreValues.length === 0) {
      delete this.root.dataset.theme;
      await this._syncThemeAmbient();
      return;
    }
    const key = genreValues[0];
    const slug = GENRE_THEMES[key];
    if (slug) {
      this.root.dataset.theme = slug;
    } else {
      delete this.root.dataset.theme;
    }
    await this._syncThemeAmbient();
  }

  // ─── Ambient audio (per skin + optional genre layer) ─

  _unlockAmbientAudio() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    this._refreshAmbientPlayback();
  }

  _setAmbientVideoPaused(on) {
    this.ambientVideoPaused = on;
    this._refreshAmbientPlayback();
  }

  _toggleAmbientMute() {
    this.ambientUserMuted = !this.ambientUserMuted;
    try {
      globalThis.localStorage?.setItem('hbo_stage_ambient_muted', this.ambientUserMuted ? '1' : '0');
    } catch { /* ignore */ }
    this._updateAmbientToggleUi();
    this._refreshAmbientPlayback();
  }

  _updateAmbientToggleUi() {
    const btn = this.$('.hbo-ambient-toggle');
    if (!btn) return;
    btn.classList.toggle('is-muted', this.ambientUserMuted);
    btn.setAttribute('aria-label', this.ambientUserMuted ? 'Unmute ambient sound' : 'Mute ambient sound');
    btn.setAttribute('title', this.ambientUserMuted ? 'Unmute ambient sound' : 'Mute ambient sound');
  }

  _refreshAmbientPlayback() {
    if (this.destroyed) return;
    const shouldPlay = this.audioUnlocked && !this.ambientUserMuted && !this.ambientVideoPaused;

    const apply = (el, baseVol) => {
      if (!el) return;
      if (!shouldPlay) {
        el.pause();
        el.volume = 0;
        return;
      }
      el.volume = Math.min(1, Math.max(0, baseVol));
      el.play().catch(() => {});
    };

    apply(this.ambientSkinAudio, this.skinAmbientVolume);
    apply(this.ambientThemeAudio, this.themeAmbientVolume);
  }

  _disposeSkinAmbientOnly() {
    if (this.ambientSkinAudio) {
      this.ambientSkinAudio.pause();
      this.ambientSkinAudio.removeAttribute('src');
      this.ambientSkinAudio.load();
      this.ambientSkinAudio = null;
    }
    if (this.ambientSkinBlobUrl) {
      URL.revokeObjectURL(this.ambientSkinBlobUrl);
      this.ambientSkinBlobUrl = null;
    }
  }

  _disposeThemeAmbientOnly() {
    if (this.ambientThemeAudio) {
      this.ambientThemeAudio.pause();
      this.ambientThemeAudio.removeAttribute('src');
      this.ambientThemeAudio.load();
      this.ambientThemeAudio = null;
    }
    if (this.ambientThemeBlobUrl) {
      URL.revokeObjectURL(this.ambientThemeBlobUrl);
      this.ambientThemeBlobUrl = null;
    }
  }

  _disposeAmbientAudio() {
    this._disposeSkinAmbientOnly();
    this._disposeThemeAmbientOnly();
  }

  async _setupSkinAmbient(manifest, skinId) {
    this._disposeSkinAmbientOnly();
    if (!manifest.ambientAudio) return;

    let src = manifest.ambientAudio;
    if (!src.startsWith('http') && !src.startsWith('/')) {
      src = 'skins/' + skinId + '/' + src;
    }
    src = appendUrlCacheBust(src, manifest.ambientVersion);
    const resolved = resolveMediaUrl(src);

    this.skinAmbientVolume = typeof manifest.ambientVolume === 'number' ? manifest.ambientVolume : 0.2;

    try {
      const res = await fetch(resolved, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      this.ambientSkinBlobUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.ambientSkinBlobUrl);
      audio.loop = true;
      audio.preload = 'auto';
      this.ambientSkinAudio = audio;
      audio.addEventListener('error', () => { /* ignore */ });
    } catch (e) {
      console.warn('Ambient fetch failed, using direct URL:', e);
      const audio = new Audio(resolved);
      audio.loop = true;
      audio.preload = 'auto';
      this.ambientSkinAudio = audio;
      audio.addEventListener('error', () => { /* ignore */ });
    } finally {
      this._refreshAmbientPlayback();
    }
  }

  async _syncThemeAmbient() {
    this._disposeThemeAmbientOnly();
    const theme = this.root.dataset.theme;
    const map = this.appConfig?.themeAmbient;
    if (!theme || !map || typeof map !== 'object') return;

    const pathOrUrl = map[theme];
    if (!pathOrUrl || typeof pathOrUrl !== 'string') return;

    this.themeAmbientVolume = typeof this.appConfig.themeAmbientVolume === 'number'
      ? this.appConfig.themeAmbientVolume
      : 0.16;

    const resolved = resolveMediaUrl(pathOrUrl);
    try {
      const res = await fetch(resolved, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      this.ambientThemeBlobUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.ambientThemeBlobUrl);
      audio.loop = true;
      audio.preload = 'auto';
      this.ambientThemeAudio = audio;
      audio.addEventListener('error', () => { /* ignore */ });
    } catch (e) {
      console.warn('Theme ambient fetch failed:', e);
    } finally {
      this._refreshAmbientPlayback();
    }
  }

  // ─── Data Loading ──────────────────────────────────

  async _gql(query, variables = {}) {
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), GQL_FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(this.config.graphqlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`GraphQL HTTP ${res.status}: ${json?.errors?.[0]?.message || res.statusText}`);
    }
    if (json.errors?.length) {
      const msg = json.errors.map((e) => e.message).join('; ');
      console.error('GraphQL errors:', json.errors);
      throw new Error(msg);
    }
    return json.data;
  }

  /** Matches dotcom-graphql `DiscoveryInput` (country required). */
  _discoveryGqlInput() {
    const d = this.appConfig?.defaults || {};
    const themeId = this.config.skin || this.appConfig?.activeSkin || 'default';
    const vibeTags = this.selectedVibe?.id ? [this.selectedVibe.id] : [];
    return {
      country: String(d.country || 'us').toLowerCase(),
      lang: d.lang || 'en',
      tenant: 'max',
      themeId,
      vibeTags,
      excludeIds: [...this.apiExcludedIds],
      limit: HERO_POOL_LIMIT,
    };
  }

  _getCacheKey() {
    // v5: includes vibe so each vibe selection has its own cache entry
    const vibeKey = this.selectedVibe?.id ?? 'all';
    return `hbo_catalog_v7_${this.id}_${vibeKey}`;
  }

  _clearCachedCatalog() {
    try { localStorage.removeItem(this._getCacheKey()); } catch { /* ignore */ }
  }

  _isMockCatalog() {
    return (
      this.fullCatalog.length > 0 &&
      String(this.fullCatalog[0].id || '').startsWith('mock-')
    );
  }

  _syncExcludedIdsFromCatalog() {
    if (this._isMockCatalog()) {
      this.apiExcludedIds = [];
      return;
    }
    this.apiExcludedIds = this.fullCatalog.map((s) => s.id).filter(Boolean);
  }

  async _fetchMoreHeroesFromApi() {
    if (this._isMockCatalog()) return;
    try {
      const data = await this._gql(GET_DISCOVERY_EXPERIENCE, {
        input: this._discoveryGqlInput(),
      });
      const pool = data?.getDiscoveryExperience?.heroContentPool;
      if (!Array.isArray(pool) || pool.length === 0) return;
      const batch = pool.map(normalize);
      const seen = new Set(this.fullCatalog.map((s) => s.id));
      for (const item of batch) {
        if (item.id && !seen.has(item.id)) {
          this.fullCatalog.push(item);
          seen.add(item.id);
        }
      }
      this._syncExcludedIdsFromCatalog();
      this._setCachedCatalog(this.fullCatalog);
      this._filterByGenre();
    } catch (e) {
      console.warn('Additional hero batch failed:', e.message);
    }
  }

  async _maybeRefillHeroPool() {
    if (!this.fullCatalog.length || this._isMockCatalog()) return;
    let unseen = this.allItems.filter((s) => !this.recentIds.includes(s.id));
    if (unseen.length > 0) return;
    await this._fetchMoreHeroesFromApi();
    unseen = this.allItems.filter((s) => !this.recentIds.includes(s.id));
    if (unseen.length === 0) this.recentIds.length = 0;
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
      this._syncExcludedIdsFromCatalog();
      this._filterByGenre();
      this.catalogReady = true;
      this._refreshCatalogInBackground();
      return this.allItems;
    }

    let gotHeroPool = false;
    try {
      const data = await this._gql(GET_DISCOVERY_EXPERIENCE, {
        input: this._discoveryGqlInput(),
      });
      const pool = data?.getDiscoveryExperience?.heroContentPool;
      const tm = data?.getDiscoveryExperience?.themeMetadata;
      if (tm?.themeId) {
        this._themeMetadataCache.set(tm.themeId, tm);
        if (tm.visualDesignSkinId && tm.visualDesignSkinId !== tm.themeId) {
          this._themeMetadataCache.set(tm.visualDesignSkinId, tm);
        }
      }
      if (Array.isArray(pool)) {
        this.fullCatalog = pool.map(normalize);
        this._syncExcludedIdsFromCatalog();
        this._setCachedCatalog(this.fullCatalog);
        gotHeroPool = true;
      }
    } catch (err) {
      console.warn('GraphQL unreachable, using mock catalog:', err.message);
      this.fullCatalog = MOCK_CATALOG.slice();
    }
    if (!gotHeroPool && this.fullCatalog.length === 0) {
      this.fullCatalog = MOCK_CATALOG.slice();
    }
    this._filterByGenre();
    this.catalogReady = this.fullCatalog.length > 0;
    return this.allItems;
  }

  async _refreshCatalogInBackground() {
    try {
      const data = await this._gql(GET_DISCOVERY_EXPERIENCE, {
        input: this._discoveryGqlInput(),
      });
      const pool = data?.getDiscoveryExperience?.heroContentPool;
      if (Array.isArray(pool) && pool.length > 0) {
        const fresh = pool.map(normalize);
        const seen = new Set(this.fullCatalog.map((s) => s.id));
        for (const item of fresh) {
          if (item.id && !seen.has(item.id)) {
            this.fullCatalog.push(item);
            seen.add(item.id);
          }
        }
        this._syncExcludedIdsFromCatalog();
        this._setCachedCatalog(this.fullCatalog);
        this._filterByGenre();
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

  async _fetchRandomShow() {
    await this._maybeRefillHeroPool();
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
    if (this.recentIds.length > Math.max(10, this.allItems.length)) this.recentIds.shift();
    return pick;
  }

  // ─── UI Helpers ────────────────────────────────────

  _populateGenreDropdown(vibeOptions) {
    const menu = this.$('.genre-dropdown .custom-dropdown-menu');
    const valEl = this.$('.genre-dropdown .custom-dropdown-value');
    if (!menu) return;
    menu.innerHTML = '';
    vibeOptions.forEach((v, i) => {
      const item = document.createElement('div');
      item.className = 'custom-dropdown-item' + (i === 0 ? ' is-selected' : '');
      item.setAttribute('role', 'option');
      item.dataset.value = i;
      item.textContent = v.label;
      menu.appendChild(item);
    });
    if (valEl && vibeOptions.length > 0) valEl.textContent = vibeOptions[0].label;
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
    const posterLink = this.$('.card-poster-link');
    const watchBtn   = this.$('.btn-watch');
    const placeholder = this.$('.card-placeholder');
    const icon = placeholder.querySelector('.card-placeholder-icon');
    const posterImg = placeholder.querySelector('.card-poster-img');

    card.className = 'content-card';

    if (show.contentUrl) {
      if (posterLink) {
        posterLink.href = show.contentUrl;
        posterLink.style.cursor = 'pointer';
      }
      if (watchBtn) {
        watchBtn.href = show.contentUrl;
        watchBtn.removeAttribute('disabled');
        watchBtn.style.pointerEvents = '';
      }
    } else {
      if (posterLink) {
        posterLink.removeAttribute('href');
        posterLink.style.cursor = 'default';
      }
      if (watchBtn) {
        watchBtn.removeAttribute('href');
        watchBtn.style.pointerEvents = 'none';
      }
    }

    placeholder.style.backgroundImage = '';
    if (posterImg) {
      posterImg.classList.remove('is-visible');
      posterImg.removeAttribute('src');
    }
    placeholder.classList.remove('has-poster');

    if (show.image && posterImg) {
      posterImg.src = show.image;
      posterImg.classList.add('is-visible');
      placeholder.classList.add('has-poster');
      placeholder.style.backgroundColor = '#0a0a12';
      if (icon) icon.style.display = 'none';
    } else {
      placeholder.style.backgroundColor = '#1a1a2e';
      if (icon) icon.style.display = '';
    }

    title.textContent = show.title;
    desc.textContent = show.description;
    this.currentShow = show;
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

    const watchBtn = this.$('.btn-watch');
    if (watchBtn) {
      watchBtn.classList.remove('reveal-pulse');
      forceReflow(watchBtn);
      watchBtn.classList.add('reveal-pulse');
    }
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
    const watchBtn = this.$('.btn-watch');
    if (watchBtn) watchBtn.classList.remove('reveal-pulse');
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

    this.currentShow = null;
    this._unlockAmbientAudio();
    this._resetRevealElements();
    this._switchFrame(this.$('.frame-idle'), this.$('.frame-credits'));
    this._setAmbientVideoPaused(true);
    await wait(100);

    if (this.player && typeof this.player.playVideo === 'function') {
      this._startVideoPlayback();
    } else {
      this.pendingPlay = true;
    }
  }

  async _afterVideoEnds() {
    this._setIframeVisible(false);
    this._setAmbientVideoPaused(false);

    const frameCredits = this.$('.frame-credits');
    const frameTransition = this.$('.frame-transition');
    const frameReveal = this.$('.frame-reveal');
    const spotlightDim = this.$('.spotlight-cone--dim');
    const spinner = this.$('.transition-spinner');

    this._switchFrame(frameCredits, frameTransition);
    spinner.classList.add('visible');

    // Wait for the in-flight catalog load — do not inject mocks while GQL may still succeed
    // (an earlier 8s race + _ensurePlayableCatalog was picking mock titles before real data arrived).
    if (this.catalogPromise != null) {
      await this.catalogPromise;
    }
    if (this.allItems.length === 0 && this.fullCatalog.length > 0) {
      this._filterByGenre();
    }
    if (this.allItems.length === 0 && this.fullCatalog.length === 0) {
      this.fullCatalog = MOCK_CATALOG.slice();
      this._filterByGenre();
      this.catalogReady = this.fullCatalog.length > 0;
    }

    const show = await this._fetchRandomShow();
    if (!show) {
      spinner.classList.remove('visible');
      this.isAnimating = false;
      return;
    }
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

    const show = await this._fetchRandomShow();
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
    this._unlockAmbientAudio();
    this._setAmbientVideoPaused(false);
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
    const vibe = VIBE_OPTIONS[idx];
    if (!vibe || this.isAnimating) return;

    this.isAnimating = true;
    const prevVibeId = this.selectedVibe?.id ?? null;
    this.selectedVibe = vibe;
    this.selectedGenre = vibe.genres;
    this.currentShowId = null;
    this.recentIds.length = 0;
    this._filterByGenre();

    // When vibe changes, wipe the cached pool and fetch a fresh batch from GQL
    // so excludeIds + vibeTags both reflect the new selection.
    if (prevVibeId !== vibe.id) {
      this.fullCatalog = [];
      this.allItems = [];
      this.apiExcludedIds = [];
      this._clearCachedCatalog();
      this.catalogPromise = this._loadCatalog();
    }

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
    await this._applyTheme(this.selectedGenre);

    // If we just triggered a fresh GQL load, wait for it before picking a show
    if (this.catalogPromise) await this.catalogPromise;
    if (this.allItems.length === 0 && this.fullCatalog.length > 0) this._filterByGenre();

    flash.classList.remove('fire');
    forceReflow(flash);
    flash.classList.add('fire');

    await wait(150);
    const show = await this._fetchRandomShow();
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

  async _buildShareCanvas() {
    const W = 1200;
    const H = 630;
    const show = this.currentShow;
    if (!show) return null;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const styles = getComputedStyle(this.root);
    const accent = (styles.getPropertyValue('--accent') || '#5A31F4').trim();
    const accentRgb = (styles.getPropertyValue('--accent-rgb') || '90, 49, 244').trim();

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#12121a');
    bg.addColorStop(1, '#06060c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 12, H);

    const pad = 56;
    const posterW = 360;
    const posterH = 540;
    const posterX = pad;
    const posterY = pad;

    const img = await loadImageForShareCard(show.image);
    if (img) {
      ctx.save();
      roundRectPath(ctx, posterX, posterY, posterW, posterH, 14);
      ctx.clip();
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.max(posterW / iw, posterH / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = posterX + (posterW - dw) / 2;
      const dy = posterY + (posterH - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      roundRectPath(ctx, posterX, posterY, posterW, posterH, 14);
      ctx.stroke();
    } else {
      const pg = ctx.createLinearGradient(posterX, posterY, posterX + posterW, posterY + posterH);
      pg.addColorStop(0, `rgba(${accentRgb}, 0.45)`);
      pg.addColorStop(1, '#1a1a2e');
      ctx.fillStyle = pg;
      roundRectPath(ctx, posterX, posterY, posterW, posterH, 14);
      ctx.fill();
    }

    const textX = posterX + posterW + 48;
    const textW = W - textX - pad;
    const skinLabel = this.currentSkinManifest?.name || this.currentSkinId || 'HBO';

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(String(skinLabel).toUpperCase(), textX, 108);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 40px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    const titleLines = wrapCanvasLines(ctx, show.title, textW, 3);
    let ty = 168;
    for (const tl of titleLines) {
      ctx.fillText(tl, textX, ty);
      ty += 50;
    }

    const meta = [show.year, show.genre].filter(Boolean).join(' · ');
    if (meta) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '400 17px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(meta, textX, ty + 8);
      ty += 36;
    }

    ctx.fillStyle = '#b3b3b3';
    ctx.font = '400 20px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    const descLines = wrapCanvasLines(ctx, show.description || '', textW, 5);
    ty += 24;
    for (const dl of descLines) {
      ctx.fillText(dl, textX, ty);
      ty += 28;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '600 20px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('HBO', textX, H - 52);

    return canvas;
  }

  async _shareCanvasCard() {
    if (this.isAnimating || !this.currentShow) return;
    const btn = this.$('.btn-share');
    if (btn) btn.disabled = true;
    try {
      const canvas = await this._buildShareCanvas();
      if (!canvas) return;

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not export image'))), 'image/png', 0.92);
      });

      const fname = `hbo-pick-${slugifyShareFilename(this.currentShow.title)}.png`;
      const file = new File([blob], fname, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: this.currentShow.title,
            text: (this.currentShow.description || '').slice(0, 240),
          });
          if (this.config.onShare) this.config.onShare({ kind: 'share', filename: fname });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (this.config.onShare) this.config.onShare({ kind: 'download', filename: fname });
    } catch (e) {
      console.warn('Share card failed:', e);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ─── Public API ────────────────────────────────────

  setSkin(skinId) {
    this._switchSkin(skinId);
    this._syncSkinDropdownValue(skinId);
  }

  /** Generates and shares or downloads a 1200×630 PNG card for the current recommendation. */
  shareCard() {
    return this._shareCanvasCard();
  }

  destroy() {
    this.destroyed = true;
    this.abortController.abort();
    this._disposeAmbientAudio();
    if (this._scatterTweens) this._scatterTweens.forEach(t => t.kill());
    if (this.player && typeof this.player.destroy === 'function') this.player.destroy();
    if (this.skinLinkEl) this.skinLinkEl.remove();
    if (this.skinFontLinkEl) this.skinFontLinkEl.remove();
    this.container.innerHTML = '';
  }
}

if (globalThis.window !== undefined) {
  globalThis.HBOStageReveal = HBOStageReveal;
}
