/*
 * Sidebar Icon Colors for Home Assistant
 * https://github.com/BacklyB/ha-sidebar-icon-colors
 *
 * Colors the icons in the Home Assistant sidebar and in dashboard view tabs
 * (single color, gradient, four quarters, tiles). Configured with a card.
 * Settings are stored server-side (frontend system data) and apply to all users.
 *
 * Load it as a frontend module (frontend: extra_module_url) so the colors
 * are there right after start, not only once a dashboard has been opened.
 *
 * License: MIT
 */
(() => {
  if (window.__sidebarIconColors) return;
  window.__sidebarIconColors = true;

  const VERSION = '1.0.0';
  const KEY = 'sidebar_icon_colors';
  const EVT = 'sidebar-icon-colors-changed';
  const NS = 'http://www.w3.org/2000/svg';
  const LOG = '[sidebar-icon-colors]';

  // ---------- Translations ----------
  const STR = {
    en: {
      mode_standard: 'Default (unchanged)',
      mode_single: 'Single color',
      mode_gradient: 'Gradient',
      mode_quad: '4 quarters',
      mode_tiles: 'Tiles (dashboard icons only)',
      c_color: 'Color', c_start: 'Start', c_end: 'End',
      c_tl: 'top left', c_tr: 'top right', c_bl: 'bottom left', c_br: 'bottom right',
      item_config: 'Settings', item_notifications: 'Notifications',
      title: 'Color icons',
      hint: 'Changes show up right away as a preview. Only "Save" stores them permanently for all users.',
      tab_sidebar: 'Sidebar', tab_tabs: 'Dashboard tabs',
      search: 'Search entry …', only_set: 'customized only',
      save: 'Save', discard: 'Discard',
      discarded: 'Changes discarded.', unsaved: 'Not saved',
      saving: 'Saving …', saved: 'Saved ✓', save_error: 'Error while saving: ',
      admin_only: 'Only administrators can save.',
      no_sidebar: 'Sidebar not found – please reload the page.',
      loading_views: 'Loading views …',
      no_tabs: 'No tabs known yet. Open this dashboard once in this browser, then its tabs will show up here. (Tabs without an icon cannot be colored.)',
      no_match: 'No matching entries.',
      view: 'View ',
      card_name: 'Sidebar Icon Colors',
      card_desc: 'Color the icons in the sidebar and in dashboard tabs (single color, gradient, 4 quarters, tiles).'
    },
    de: {
      mode_standard: 'Standard (unverändert)',
      mode_single: 'Eine Farbe',
      mode_gradient: 'Farbverlauf',
      mode_quad: '4 Viertel',
      mode_tiles: 'Kacheln (nur Dashboard-Icons)',
      c_color: 'Farbe', c_start: 'Start', c_end: 'Ende',
      c_tl: 'oben links', c_tr: 'oben rechts', c_bl: 'unten links', c_br: 'unten rechts',
      item_config: 'Einstellungen', item_notifications: 'Benachrichtigungen',
      title: 'Icons einfärben',
      hint: 'Änderungen siehst du sofort als Vorschau. Erst „Speichern“ übernimmt sie dauerhaft für alle Benutzer.',
      tab_sidebar: 'Seitenleiste', tab_tabs: 'Dashboard-Tabs',
      search: 'Eintrag suchen …', only_set: 'nur angepasste',
      save: 'Speichern', discard: 'Verwerfen',
      discarded: 'Änderungen verworfen.', unsaved: 'Nicht gespeichert',
      saving: 'Speichere …', saved: 'Gespeichert ✓', save_error: 'Fehler beim Speichern: ',
      admin_only: 'Nur Administratoren können speichern.',
      no_sidebar: 'Seitenleiste nicht gefunden – Seite bitte neu laden.',
      loading_views: 'Lade Ansichten …',
      no_tabs: 'Noch keine Tabs bekannt. Öffne dieses Dashboard einmal in diesem Browser, dann erscheinen seine Tabs hier. (Tabs ohne Icon lassen sich nicht einfärben.)',
      no_match: 'Keine passenden Einträge.',
      view: 'Ansicht ',
      card_name: 'Icons einfärben',
      card_desc: 'Icons in Seitenleiste und Dashboard-Tabs farbig gestalten (eine Farbe, Verlauf, 4 Viertel, Kacheln).'
    }
  };
  function lang() {
    const h = getHass();
    const l = (h && (h.locale && h.locale.language || h.language)) || navigator.language || 'en';
    return String(l).toLowerCase().startsWith('de') ? 'de' : 'en';
  }
  const t = k => STR[lang()][k] || STR.en[k] || k;

  // ---------- Constants ----------
  const TILE_ICONS = {
    'mdi:view-dashboard-outline': ['M3,3H11V13H3Z M5,5V11H9V5Z', 'M13,3H21V9H13Z M15,5V7H19V5Z', 'M3,15H11V21H3Z M5,17V19H9V17Z', 'M13,11H21V21H13Z M15,13V19H19V13Z'],
    'mdi:view-dashboard': ['M3,3H11V13H3Z', 'M13,3H21V9H13Z', 'M3,15H11V21H3Z', 'M13,11H21V21H13Z']
  };
  const TILE_PATH_PREFIX = { 'M13,3V9H21V3M13,21H21V11H13M3,21H11V15H3M3,13H11V3': 'mdi:view-dashboard' };
  const MODES = { standard: 0, single: 1, gradient: 2, quad: 4, tiles: 4 };
  const COLOR_LABELS = { 1: ['c_color'], 2: ['c_start', 'c_end'], 4: ['c_tl', 'c_tr', 'c_bl', 'c_br'] };
  const DEFAULT_COLORS = ['#E53935', '#FDD835', '#43A047', '#1E88E5'];
  const DEFAULT_CONFIG = { items: {}, tabs: {} };
  // Fixed entries at the bottom of the sidebar (not panels)
  const EXTRA_ITEMS = { 'sidebar-config': 'item_config', 'sidebar-notifications': 'item_notifications' };
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---------- Helpers ----------
  function* walk(n) {
    if (!n) return;
    if (n.nodeType === 1) { yield n; if (n.shadowRoot) yield* walk(n.shadowRoot); }
    for (const c of n.children || []) yield* walk(c);
  }
  function getHass() {
    const ha = document.querySelector('home-assistant');
    return ha && ha.hass ? ha.hass : null;
  }
  function findFirst(tag, from) {
    for (const el of walk(from || document.documentElement)) if (el.tagName === tag) return el;
    return null;
  }

  let sidebarCache = null;
  function findSidebar() {
    if (sidebarCache && sidebarCache.isConnected) return sidebarCache;
    sidebarCache = findFirst('HA-SIDEBAR');
    return sidebarCache;
  }
  function sidebarHosts() {
    const sb = findSidebar();
    if (!sb) return [];
    const out = [];
    for (const el of walk(sb)) if (el.id && (el.id.startsWith('sidebar-panel-') || EXTRA_ITEMS[el.id])) out.push(el);
    return out;
  }

  let rootCache = null, rootSearchPath = null, rootSearchTime = 0;
  function findHuiRoot() {
    if (rootCache && rootCache.isConnected) return rootCache;
    const now = Date.now();
    if (location.pathname === rootSearchPath && now - rootSearchTime < 5000) return null;
    rootSearchPath = location.pathname; rootSearchTime = now;
    rootCache = findFirst('HUI-ROOT');
    return rootCache;
  }

  function originalIcon(host) {
    return host.querySelector(':scope > [slot="start"]:not(.sic-icon)');
  }
  function iconInfoFromEl(ic) {
    if (!ic) return { path: null, name: null };
    let path = null;
    let name = ic.icon || ic.getAttribute('icon') || null;
    if (ic.tagName === 'HA-SVG-ICON') path = ic.path || null;
    else if (ic.shadowRoot) {
      const s = ic.shadowRoot.querySelector('ha-svg-icon');
      path = s ? s.path || null : null;
    }
    if (!name && path) for (const [p, n] of Object.entries(TILE_PATH_PREFIX)) if (path.startsWith(p)) name = n;
    return { path, name };
  }
  function hostName(host) {
    if (EXTRA_ITEMS[host.id]) return t(EXTRA_ITEMS[host.id]);
    const el = host.querySelector('.item-text');
    return (el ? el.textContent : host.id.replace('sidebar-panel-', '')).replace(/\s+/g, ' ').trim();
  }

  // Resolve an icon's SVG path via a hidden ha-icon (used for the tab previews)
  const pathCache = new Map();
  let hiddenBox = null;
  function resolveIconPath(icon) {
    if (!icon) return Promise.resolve(null);
    if (pathCache.has(icon)) return pathCache.get(icon);
    const p = new Promise(resolve => {
      if (!hiddenBox) {
        hiddenBox = document.createElement('div');
        hiddenBox.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;';
        document.body.appendChild(hiddenBox);
      }
      const el = document.createElement('ha-icon');
      el.setAttribute('icon', icon);
      hiddenBox.appendChild(el);
      let tries = 0;
      const timer = setInterval(() => {
        const { path } = iconInfoFromEl(el);
        if (path || ++tries > 40) { clearInterval(timer); el.remove(); resolve(path || null); }
      }, 100);
    });
    pathCache.set(icon, p);
    return p;
  }

  let uid = 0;
  function buildSvg(path, iconName, entry, size = 24) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.cssText = `width:${size}px;height:${size}px;flex:none;display:block;`;
    const c = entry.colors && entry.colors.length ? entry.colors : DEFAULT_COLORS;
    const id = 'sic' + (++uid) + Math.random().toString(36).slice(2, 7);
    const mk = (tag, attrs) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    };
    let mode = entry.mode;
    if (mode === 'tiles' && !TILE_ICONS[iconName]) mode = 'quad';
    if (mode === 'single') {
      svg.appendChild(mk('path', { d: path, fill: c[0] }));
    } else if (mode === 'gradient') {
      const defs = mk('defs', {});
      const g = mk('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' });
      g.appendChild(mk('stop', { offset: '0%', 'stop-color': c[0] }));
      g.appendChild(mk('stop', { offset: '100%', 'stop-color': c[1] || c[0] }));
      defs.appendChild(g); svg.appendChild(defs);
      svg.appendChild(mk('path', { d: path, fill: `url(#${id})` }));
    } else if (mode === 'quad') {
      const defs = mk('defs', {});
      const cp = mk('clipPath', { id });
      cp.appendChild(mk('path', { d: path }));
      defs.appendChild(cp); svg.appendChild(defs);
      const g = mk('g', { 'clip-path': `url(#${id})` });
      [[0, 0], [12, 0], [0, 12], [12, 12]].forEach(([x, y], i) =>
        g.appendChild(mk('rect', { x, y, width: 12, height: 12, fill: c[i] || c[0] })));
      svg.appendChild(g);
    } else if (mode === 'tiles') {
      TILE_ICONS[iconName].forEach((d, i) => svg.appendChild(mk('path', { d, fill: c[i] || c[0], 'fill-rule': 'evenodd' })));
    }
    return svg;
  }

  // Replace an original icon with the colored version, or restore it
  function swapIcon(parent, orig, entry, slot) {
    const existing = parent.querySelectorAll(':scope > .sic-icon');
    if (!entry || entry.mode === 'standard' || !(entry.mode in MODES)) {
      existing.forEach(e => e.remove());
      if (orig && orig.style.display === 'none') orig.style.display = '';
      return;
    }
    if (!orig) return;
    const { path, name } = iconInfoFromEl(orig);
    if (!path) return;
    const sig = JSON.stringify(entry) + '|' + path.length + '|' + name;
    if (existing.length === 1 && existing[0].dataset.sig === sig && orig.style.display === 'none') return;
    existing.forEach(e => e.remove());
    const svg = buildSvg(path, name, entry);
    svg.classList.add('sic-icon');
    if (slot) svg.setAttribute('slot', slot);
    svg.dataset.sig = sig;
    orig.style.display = 'none';
    orig.after(svg);
  }

  // ---------- Configuration ----------
  let config = null, preview = null;
  async function loadConfig() {
    const hass = getHass();
    if (!hass || !hass.connection) return;
    try {
      const res = await hass.connection.sendMessagePromise({ type: 'frontend/get_system_data', key: KEY });
      config = res && res.value ? res.value : clone(DEFAULT_CONFIG);
    } catch (e) {
      console.warn(LOG, 'loading failed', e);
      if (!config) config = clone(DEFAULT_CONFIG);
    }
    if (!config.items) config.items = {};
    if (!config.tabs) config.tabs = {};
    apply();
  }
  async function saveConfig(c) {
    await getHass().connection.sendMessagePromise({ type: 'frontend/set_system_data', key: KEY, value: c });
    config = clone(c); preview = null;
    window.dispatchEvent(new CustomEvent(EVT));
    apply();
  }

  // Remember the last seen tabs per dashboard (needed for strategy dashboards)
  const SEEN_PREFIX = 'icon-farben-tabs:';
  function rememberTabs(dash, list) {
    if (!list.length) return;
    try {
      const s = JSON.stringify(list);
      if (localStorage.getItem(SEEN_PREFIX + dash) !== s) localStorage.setItem(SEEN_PREFIX + dash, s);
    } catch (e) { /* storage not available */ }
  }
  function seenTabs(dash) {
    try { return JSON.parse(localStorage.getItem(SEEN_PREFIX + dash) || 'null'); } catch (e) { return null; }
  }

  // ---------- Apply ----------
  function apply() {
    const cfg = preview || config;
    if (!cfg) return;
    try {
      for (const host of sidebarHosts()) swapIcon(host, originalIcon(host), (cfg.items || {})[host.id], 'start');
    } catch (e) { console.warn(LOG, e); }
    try {
      const root = findHuiRoot();
      if (root && root.shadowRoot && root.lovelace) {
        const dash = root.lovelace.urlPath || 'lovelace';
        const views = (root.lovelace.config && root.lovelace.config.views) || [];
        const seen = [];
        for (const tab of root.shadowRoot.querySelectorAll('ha-tab-group-tab')) {
          const idx = Number(tab.getAttribute('panel'));
          const vp = tab.dataset.path || (views[idx] && views[idx].path) || String(idx);
          const orig = tab.querySelector(':scope > ha-icon:not(.sic-icon)');
          const key = dash + '/' + vp;
          swapIcon(tab, orig, (cfg.tabs || {})[key], null);
          const icon = orig && (orig.icon || orig.getAttribute('icon'));
          if (icon && !tab.classList.contains('hide-tab')) seen.push({ key, title: tab.getAttribute('aria-label') || vp, icon });
        }
        rememberTabs(dash, seen);
      }
    } catch (e) { console.warn(LOG, e); }
  }

  window.addEventListener(EVT, () => { if (!preview) loadConfig(); });
  (function boot() {
    if (!getHass()) return setTimeout(boot, 500);
    loadConfig();
    setInterval(apply, 1000);
    setInterval(() => { if (!preview) loadConfig(); }, 60000);
  })();

  // ---------- Editor card ----------
  class SidebarIconColorsCard extends HTMLElement {
    setConfig(c) { this._cfg = c || {}; }
    getCardSize() { return 8; }
    static getStubConfig() { return {}; }
    set hass(h) { this._hass = h; if (!this._rendered) this._init(); }
    disconnectedCallback() { if (preview) { preview = null; apply(); } }

    async _init() {
      this._rendered = true;
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          ha-card { padding: 16px; }
          h2 { margin: 0 0 4px; font-size: 20px; font-weight: 500; }
          .hint { color: var(--secondary-text-color); font-size: 13px; margin-bottom: 12px; }
          .tabs { display: flex; gap: 6px; margin-bottom: 12px; }
          .tabs button { background: var(--secondary-background-color); color: var(--primary-text-color); }
          .tabs button.on { background: var(--primary-color); color: var(--text-primary-color, #fff); }
          .row { display: grid; grid-template-columns: 32px 1fr; gap: 4px 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--divider-color); }
          .prev { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
          .name { font-weight: 500; }
          .sub { color: var(--secondary-text-color); font-weight: 400; font-size: 12px; margin-left: 6px; }
          .controls { grid-column: 2; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
          select, .filter { padding: 6px; border-radius: 6px; background: var(--card-background-color); color: var(--primary-text-color); border: 1px solid var(--divider-color); }
          .filter { flex: 1; min-width: 140px; }
          label.c { display: flex; flex-direction: column; align-items: center; font-size: 11px; color: var(--secondary-text-color); }
          input[type=color] { width: 36px; height: 28px; border: none; background: none; padding: 0; cursor: pointer; }
          .bar { display: flex; gap: 8px; align-items: center; margin: 4px 0 8px; flex-wrap: wrap; }
          button { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; }
          .save { background: var(--primary-color); color: var(--text-primary-color, #fff); }
          .reset { background: var(--secondary-background-color); color: var(--primary-text-color); }
          .status, .only { font-size: 13px; color: var(--secondary-text-color); }
          .only { display: flex; gap: 4px; align-items: center; }
          .dashsel { display: none; }
        </style>
        <ha-card>
          <h2></h2>
          <div class="hint"></div>
          <div class="tabs"><button data-t="sidebar" class="on"></button><button data-t="tabs"></button></div>
          <div class="bar">
            <select class="dashsel"></select>
            <input class="filter">
            <label class="only"><input type="checkbox" class="onlyset"> <span></span></label>
          </div>
          <div class="list"></div>
          <div class="bar">
            <button class="save"></button>
            <button class="reset"></button>
            <span class="status"></span>
          </div>
        </ha-card>`;
      const $ = s => this.shadowRoot.querySelector(s);
      $('h2').textContent = t('title');
      $('.hint').textContent = t('hint');
      $('.tabs [data-t=sidebar]').textContent = t('tab_sidebar');
      $('.tabs [data-t=tabs]').textContent = t('tab_tabs');
      $('.filter').placeholder = t('search');
      $('.only span').textContent = t('only_set');
      $('.save').textContent = t('save');
      $('.reset').textContent = t('discard');
      this._status = $('.status');
      this._mode = 'sidebar';
      $('.save').addEventListener('click', () => this._save());
      $('.reset').addEventListener('click', () => { preview = null; this._draft = null; apply(); this._renderList(); this._setStatus(t('discarded')); });
      $('.filter').addEventListener('input', () => this._renderList());
      $('.onlyset').addEventListener('change', () => this._renderList());
      $('.dashsel').addEventListener('change', () => this._renderList());
      this.shadowRoot.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
        this._mode = b.dataset.t;
        this.shadowRoot.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
        $('.dashsel').style.display = this._mode === 'tabs' ? 'block' : 'none';
        this._renderList();
      }));
      if (!this._hass.user || !this._hass.user.is_admin) {
        this._setStatus(t('admin_only'));
        $('.save').disabled = true;
      }
      this._fillDashboards();
      if (!config) await loadConfig();
      this._renderList();
      setTimeout(() => this._refreshPreviews(), 1500);
    }

    _fillDashboards() {
      const sel = this.shadowRoot.querySelector('.dashsel');
      const dash = Object.values(this._hass.panels || {})
        .filter(p => p.component_name === 'lovelace')
        .map(p => ({ url: p.url_path, title: p.title || p.url_path }))
        .sort((a, b) => a.title.localeCompare(b.title));
      // Preselect the dashboard currently open, if any
      const current = location.pathname.split('/')[1];
      sel.innerHTML = '';
      for (const d of dash) {
        const o = document.createElement('option');
        o.value = d.url; o.textContent = d.title.replace(/\s+/g, ' ');
        if (d.url === current) o.selected = true;
        sel.appendChild(o);
      }
    }

    async _loadViews(url) {
      this._viewCache = this._viewCache || {};
      if (this._viewCache[url]) return this._viewCache[url];
      const msg = { type: 'lovelace/config' };
      if (url !== 'lovelace') msg.url_path = url;
      let views = null;
      try {
        const cfg = await this._hass.connection.sendMessagePromise(msg);
        if (cfg && Array.isArray(cfg.views) && !cfg.strategy) {
          views = cfg.views.map((v, i) => ({ v, i })).filter(({ v }) => !v.subview && v.icon)
            .map(({ v, i }) => ({ key: url + '/' + (v.path || String(i)), title: v.title || v.path || (t('view') + (i + 1)), icon: v.icon }));
        }
      } catch (e) { /* e.g. auto-generated dashboard */ }
      // Strategy dashboards: tabs only exist in the browser -> use the last seen ones
      if (!views || !views.length) views = seenTabs(url);
      if (views && views.length) this._viewCache[url] = views;
      return views;
    }

    _draftCfg() {
      if (!this._draft) this._draft = clone(config || DEFAULT_CONFIG);
      if (!this._draft.items) this._draft.items = {};
      if (!this._draft.tabs) this._draft.tabs = {};
      return this._draft;
    }
    _setStatus(s) { if (this._status) this._status.textContent = s; }
    _changed() { preview = clone(this._draft); apply(); this._setStatus(t('unsaved')); }

    async _renderList() {
      const token = (this._renderToken = (this._renderToken || 0) + 1);
      const list = this.shadowRoot.querySelector('.list');
      const q = this.shadowRoot.querySelector('.filter').value.trim().toLowerCase();
      const onlySet = this.shadowRoot.querySelector('.onlyset').checked;
      const cfg = this._draft || config || DEFAULT_CONFIG;
      let targets = [];
      if (this._mode === 'sidebar') {
        targets = sidebarHosts().map(host => ({
          store: 'items', key: host.id, name: hostName(host),
          info: () => Promise.resolve(iconInfoFromEl(originalIcon(host)))
        }));
        if (!targets.length) { list.textContent = t('no_sidebar'); return; }
      } else {
        const url = this.shadowRoot.querySelector('.dashsel').value;
        list.textContent = t('loading_views');
        const views = await this._loadViews(url);
        if (token !== this._renderToken) return;
        if (!views || !views.length) { list.textContent = t('no_tabs'); return; }
        targets = views.map(v => ({
          store: 'tabs', key: v.key, name: v.title, sub: v.icon,
          info: () => resolveIconPath(v.icon).then(path => ({ path, name: v.icon }))
        }));
      }
      list.innerHTML = '';
      for (const tg of targets) {
        const entry = ((cfg[tg.store] || {})[tg.key]) || { mode: 'standard' };
        if (q && !tg.name.toLowerCase().includes(q)) continue;
        if (onlySet && (!entry.mode || entry.mode === 'standard')) continue;
        list.appendChild(this._row(tg, entry));
      }
      if (!list.children.length) list.textContent = t('no_match');
    }

    _row(tg, entry) {
      const row = document.createElement('div');
      row.className = 'row';
      row._target = tg;
      const prev = document.createElement('div');
      prev.className = 'prev';
      const nm = document.createElement('div');
      nm.className = 'name';
      nm.textContent = tg.name;
      if (tg.sub) { const s = document.createElement('span'); s.className = 'sub'; s.textContent = tg.sub; nm.appendChild(s); }
      const controls = document.createElement('div');
      controls.className = 'controls';
      const sel = document.createElement('select');
      for (const k of Object.keys(MODES)) {
        const o = document.createElement('option');
        o.value = k; o.textContent = t('mode_' + k);
        if (k === entry.mode) o.selected = true;
        sel.appendChild(o);
      }
      tg.info().then(({ name }) => { if (!TILE_ICONS[name]) sel.querySelector('option[value=tiles]').disabled = true; });
      const colorsWrap = document.createElement('div');
      colorsWrap.style.cssText = 'display:flex;gap:6px;';
      controls.append(sel, colorsWrap);

      const get = () => this._draftCfg()[tg.store][tg.key];
      const draw = () => {
        const e = get() || { mode: 'standard' };
        colorsWrap.innerHTML = '';
        const n = MODES[e.mode] || 0;
        for (let i = 0; i < n; i++) {
          const lab = document.createElement('label');
          lab.className = 'c';
          const inp = document.createElement('input');
          inp.type = 'color';
          inp.value = (e.colors && e.colors[i]) || DEFAULT_COLORS[i];
          inp.addEventListener('input', () => {
            const ee = get();
            if (!ee) return;
            if (!ee.colors) ee.colors = [...DEFAULT_COLORS];
            ee.colors[i] = inp.value;
            this._changed();
            this._drawPreview(tg, prev, ee);
          });
          lab.append(inp, document.createTextNode(t(COLOR_LABELS[n][i])));
          colorsWrap.appendChild(lab);
        }
        this._drawPreview(tg, prev, e);
      };
      sel.addEventListener('change', () => {
        const store = this._draftCfg()[tg.store];
        if (sel.value === 'standard') delete store[tg.key];
        else {
          const e = store[tg.key] || (store[tg.key] = { mode: sel.value, colors: [...DEFAULT_COLORS] });
          e.mode = sel.value;
          if (!e.colors) e.colors = [...DEFAULT_COLORS];
        }
        this._changed();
        draw();
      });
      row.append(prev, nm, controls);
      draw();
      return row;
    }

    _drawPreview(tg, prevEl, entry) {
      tg.info().then(({ path, name }) => {
        prevEl.innerHTML = '';
        if (!path) return;
        const e = (!entry || entry.mode === 'standard' || !(entry.mode in MODES)) ? { mode: 'single', colors: ['#9e9e9e'] } : entry;
        prevEl.appendChild(buildSvg(path, name, e));
      });
    }

    _refreshPreviews() {
      const cfg = this._draft || config || DEFAULT_CONFIG;
      for (const row of this.shadowRoot.querySelectorAll('.row')) {
        const tg = row._target;
        this._drawPreview(tg, row.querySelector('.prev'), (cfg[tg.store] || {})[tg.key]);
      }
    }

    async _save() {
      try {
        this._setStatus(t('saving'));
        await saveConfig(this._draftCfg());
        this._draft = null;
        this._setStatus(t('saved'));
      } catch (e) {
        console.warn(LOG, e);
        this._setStatus(t('save_error') + (e.message || e.code || JSON.stringify(e)));
      }
    }
  }

  if (!customElements.get('sidebar-icon-colors-card')) customElements.define('sidebar-icon-colors-card', SidebarIconColorsCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.some(c => c.type === 'sidebar-icon-colors-card')) {
    window.customCards.push({ type: 'sidebar-icon-colors-card', name: t('card_name'), description: t('card_desc') });
  }
  console.info(`%c SIDEBAR-ICON-COLORS %c ${VERSION} `, 'background:#1E88E5;color:#fff', 'background:#333;color:#fff');
})();
