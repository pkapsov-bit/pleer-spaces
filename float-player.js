/*! Spaces Float Player 1.0 — плавающий плеер для мобильных сайтов.
   Основа и идея: Spaces Cyber Player © @https (https://spcs.me). Подпись автора оставлена в меню плеера.
   Работает прямо в странице: без chrome.* API, поэтому подходит и для закладки в обычном Chrome на телефоне. */
(function () {
  'use strict';
  if (window.__fp) { window.__fp.toggle(); return; }

  const VERSION = '1.0';
  const SIGN_TEXT = 'Автор @https';
  const SIGN_HREF = 'https://spcs.me';

  /* ---------- утилиты ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('fp:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('fp:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const fmt = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const abs = (u, base) => { try { return new URL(u, base || location.href).href; } catch (e) { return u; } };
  const svg = (b) => '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">' + b + '</svg>';
  const ST = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const IC = {
    play: svg('<path d="M8 5v14l11-7z"/>'),
    pause: svg('<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'),
    dots: svg('<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>'),
    down: svg('<path d="M6 9l6 6 6-6" ' + ST + '/>'),
    prev: svg('<path d="M6 6h2v12H6zM9.5 12 18 18V6z"/>'),
    next: svg('<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/>'),
    shuffle: svg('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" ' + ST + '/>'),
    repeat: svg('<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" ' + ST + '/>'),
    repeat1: svg('<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" ' + ST + '/><text x="12" y="15.5" font-size="8" font-weight="700" text-anchor="middle" fill="currentColor">1</text>')
  };

  /* ---------- состояние ---------- */
  const audio = new Audio();
  audio.preload = 'auto';
  let queue = store.get('queue', []);
  let idx = store.get('idx', -1);
  let shuffle = !!store.get('shuffle', false);
  let repeat = store.get('repeat', 'off');
  let pjaxOn = store.get('pjax', true);
  let pos = store.get('pos', { side: 'r', y: 0.7 });
  let pageTracks = [], lastSig = '', hist = [], errStreak = 0;
  let hidden = false, isOpen = false, tab = 'page', seeking = false, armed = false, lastDrag = 0;
  const foreign = new Set();
  if (!Array.isArray(queue)) queue = [];
  if (!queue[idx]) idx = -1;
  if (!pos || (pos.side !== 'l' && pos.side !== 'r') || typeof pos.y !== 'number') pos = { side: 'r', y: 0.7 };

  const cur = () => queue[idx] || null;
  const curId = () => (cur() ? cur().id : null);
  const sigOf = (a) => a.map((t) => t.id).join('|');
  const label = (t) => (t.artist ? t.artist + ' — ' : '') + t.title;
  const dur = () => (isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (cur() ? cur().duration : 0)) || 0;
  const sameQueue = (a) => a.length === queue.length && sigOf(a) === sigOf(queue);

  /* ---------- стили ---------- */
  const DW = 114, DH = 64;
  const CSS = `
:host{all:initial}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;touch-action:manipulation}
a{color:inherit}
.ui{font:500 15px/1.3 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#fff}
.off{display:none!important}

.dock{position:fixed;left:0;top:0;z-index:2147483645;width:${DW}px;height:${DH}px;display:flex;align-items:center;justify-content:space-between;padding:6px;
  border-radius:32px;background:rgba(12,12,12,.92);border:1px solid rgba(255,255,255,.2);box-shadow:0 6px 22px rgba(0,0,0,.55);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);touch-action:none;user-select:none;-webkit-user-select:none;
  -webkit-touch-callout:none;will-change:transform;transition:opacity .2s}
.dock.snap{transition:transform .28s cubic-bezier(.2,.8,.2,1),opacity .2s}
.dock.drag{box-shadow:0 12px 32px rgba(0,0,0,.7);opacity:.92}
.open .dock{opacity:0;pointer-events:none}
.mb{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:22px;color:#ddd;background:rgba(255,255,255,.08)}

.pb{position:relative;flex:none;width:52px;height:52px;border-radius:50%;font-size:26px;color:#fff}
.ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(#fff,#4a4a4a,#d6d6d6,#6c6c6c,#fff)}
.playing .ring{animation:spin 3s linear infinite}
.disk{position:absolute;inset:2px;border-radius:50%;background:#111;display:grid;place-items:center}
@keyframes spin{to{transform:rotate(360deg)}}

.nav{position:fixed;left:0;top:0;height:3px;width:100%;z-index:2147483646;background:#fff;transform-origin:left;transform:scaleX(0);opacity:0;pointer-events:none}
.loading .nav{opacity:1;animation:load 1.6s cubic-bezier(.1,.7,.3,1) forwards}
@keyframes load{to{transform:scaleX(.9)}}

.scrim{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .2s;touch-action:none}
.open .scrim{opacity:1;pointer-events:auto}
.sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;margin:0 auto;width:100%;max-width:480px;
  max-height:80vh;max-height:80dvh;display:flex;flex-direction:column;gap:10px;
  padding:6px 16px calc(12px + env(safe-area-inset-bottom,0px));border-radius:20px 20px 0 0;
  background:linear-gradient(160deg,#1c1c1c,#080808);border:1px solid rgba(255,255,255,.14);border-bottom:0;
  box-shadow:0 -10px 40px rgba(0,0,0,.6);transform:translateY(105%);visibility:hidden;
  transition:transform .28s cubic-bezier(.2,.8,.2,1),visibility 0s .28s}
.open .sheet{transform:none;visibility:visible;transition:transform .28s cubic-bezier(.2,.8,.2,1),visibility 0s}

.hd{position:relative;display:flex;align-items:center;justify-content:space-between;min-height:48px;padding-top:8px;touch-action:none}
.grab{position:absolute;left:50%;top:4px;width:38px;height:4px;margin-left:-19px;border-radius:2px;background:rgba(255,255,255,.25)}
.sig{font-size:14px;font-weight:700;color:#cfcfcf;text-decoration:none;padding:8px 0}
.cl{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:26px;color:#ddd}

.now{display:flex;gap:12px;align-items:center;min-width:0}
.cover{position:relative;flex:none;width:58px;height:58px;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#ffffff26,#00000066);
  border:1px solid rgba(255,255,255,.18);display:grid;place-items:center;font-size:22px;color:#fff9}
.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.1)}
.meta{min-width:0;flex:1}
.title{font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.artist{font-size:14px;color:#9aa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.artist.err{color:#f0f0f0;white-space:normal}

.seek{display:flex;align-items:center;gap:8px}
.t{font-size:13px;color:#9aa;min-width:36px;font-variant-numeric:tabular-nums}
.t.dur{text-align:right}
.bar{flex:1;height:36px;display:flex;align-items:center;touch-action:none}
.track{position:relative;width:100%;height:4px;border-radius:2px;background:rgba(255,255,255,.16)}
.fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:2px;background:#fff}
.knob{position:absolute;top:50%;left:0;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#fff;box-shadow:0 0 8px rgba(255,255,255,.7)}

.ctl{display:flex;align-items:center;justify-content:space-between;padding:0 4px}
.cb{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;font-size:26px;color:#c8c8c8}
.cb.sm{font-size:21px}
.cb.sm.on{color:#fff;background:rgba(255,255,255,.18)}
.ctl .pb{width:60px;height:60px;font-size:30px}

.tabs{display:flex;gap:8px}
.tab{flex:1;height:38px;border-radius:10px;background:rgba(255,255,255,.08);font-size:14px;color:#bbb}
.tab.on{background:#fff;color:#000;font-weight:700}

.list{position:relative;min-height:60px;flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
  display:flex;flex-direction:column;gap:2px}
.row{display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center;min-height:48px;padding:6px 8px;border-radius:8px;
  border-left:3px solid transparent;color:#b8b8b8;font-size:15px}
.row:active{background:rgba(255,255,255,.1)}
.row.active{background:rgba(255,255,255,.14);color:#fff;border-left-color:#fff}
.row .n,.row .d{font-size:12px;color:#8a8a8a;font-variant-numeric:tabular-nums}
.row .n{text-align:center}
.row.on .n{color:#fff}
.row .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.empty{padding:18px 8px;color:#8a8a8a;text-align:center}

.foot{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;color:#aaa}
.opt{display:flex;align-items:center;gap:10px;min-height:44px;text-align:left}
.sw{position:relative;flex:none;width:40px;height:24px;border-radius:12px;background:rgba(255,255,255,.2);transition:background .2s}
.sw::after{content:'';position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s}
.sw.on{background:#4caf50}
.sw.on::after{transform:translateX(16px)}
.hide{min-height:44px;padding:0 12px;border-radius:10px;background:rgba(255,255,255,.08);color:#ddd}

.toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));z-index:2147483647;max-width:88vw;padding:10px 16px;
  border-radius:12px;background:rgba(12,12,12,.96);border:1px solid rgba(255,255,255,.2);text-align:center;font-size:14px;
  transform:translateX(-50%);opacity:0;pointer-events:none;transition:opacity .2s}
.tst .toast{opacity:1}
@media (prefers-reduced-motion:reduce){.playing .ring{animation:none}.sheet,.dock.snap{transition:none}}
`;

  /* ---------- DOM ---------- */
  const host = document.createElement('div');
  host.id = 'fp-host';
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' + CSS + '</style>' +
    '<div class="ui">' +
      '<div class="nav"></div>' +
      '<div class="dock off">' +
        '<button class="pb" data-act="play" aria-label="Играть / пауза"><span class="ring"></span><span class="disk"></span></button>' +
        '<button class="mb" data-act="open" aria-label="Меню плеера">' + IC.dots + '</button>' +
      '</div>' +
      '<div class="scrim" data-act="close"></div>' +
      '<div class="sheet" role="dialog" aria-label="Плеер">' +
        '<div class="hd"><span class="grab"></span>' +
          '<a class="sig" href="' + SIGN_HREF + '" target="_blank" rel="noopener">' + SIGN_TEXT + '</a>' +
          '<button class="cl" data-act="close" aria-label="Свернуть">' + IC.down + '</button></div>' +
        '<div class="now"><div class="cover"><span>♪</span><img alt="" hidden></div>' +
          '<div class="meta"><div class="title">Выберите трек</div><div class="artist">&nbsp;</div></div></div>' +
        '<div class="seek"><span class="t cur">0:00</span><div class="bar"><div class="track"><div class="fill"></div><div class="knob"></div></div></div><span class="t dur">0:00</span></div>' +
        '<div class="ctl">' +
          '<button class="cb sm" data-act="shuffle" aria-label="Перемешать">' + IC.shuffle + '</button>' +
          '<button class="cb" data-act="prev" aria-label="Предыдущий">' + IC.prev + '</button>' +
          '<button class="pb" data-act="play" aria-label="Играть / пауза"><span class="ring"></span><span class="disk"></span></button>' +
          '<button class="cb" data-act="next" aria-label="Следующий">' + IC.next + '</button>' +
          '<button class="cb sm" data-act="repeat" aria-label="Повтор">' + IC.repeat + '</button>' +
        '</div>' +
        '<div class="tabs off"><button class="tab" data-tab="page"></button><button class="tab" data-tab="queue"></button></div>' +
        '<div class="list"></div>' +
        '<div class="foot">' +
          '<button class="opt" data-act="pjax" role="switch" aria-checked="true"><span class="sw"></span><span>Не прерывать музыку при переходах</span></button>' +
          '<button class="hide" data-act="hide">Скрыть</button>' +
        '</div>' +
      '</div>' +
      '<div class="toast"></div>' +
    '</div>';
  document.documentElement.appendChild(host);

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => Array.from(root.querySelectorAll(s));
  const ui = $('.ui'), dock = $('.dock'), sheet = $('.sheet'), hd = $('.hd'), list = $('.list'), tabsEl = $('.tabs');
  const titleEl = $('.title'), artistEl = $('.artist'), coverImg = $('.cover img');
  const curEl = $('.cur'), durEl = $('.dur'), bar = $('.bar'), fill = $('.fill'), knob = $('.knob');
  const btnShuffle = $('[data-act=shuffle]'), btnRepeat = $('[data-act=repeat]'), btnPjax = $('[data-act=pjax]');
  coverImg.onerror = () => { coverImg.hidden = true; };

  /* ---------- треки на странице ---------- */
  const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(\?|#|$)/i;
  const nameOf = (u) => {
    try { return decodeURIComponent(new URL(u).pathname.split('/').pop() || '').replace(AUDIO_EXT, '') || 'Без названия'; }
    catch (e) { return 'Без названия'; }
  };
  function scanTracks() {
    const map = new Map();
    document.querySelectorAll('.player_item[data-src]').forEach((n) => {
      const src = n.dataset.src;
      if (!src) return;
      const id = n.dataset.nid || src;
      if (map.has(id)) return;
      map.set(id, {
        id, src: abs(src),
        title: (n.dataset.title || '').trim() || 'Без названия',
        artist: (n.dataset.artist || '').trim(),
        cover: n.dataset.cover ? abs(n.dataset.cover) : '',
        duration: Number(n.dataset.durationValue) || 0
      });
    });
    if (map.size) return Array.from(map.values());
    document.querySelectorAll('audio[src],audio source[src],a[href]').forEach((n) => {
      const raw = n.getAttribute('src') || n.getAttribute('href');
      if (!raw || !AUDIO_EXT.test(raw)) return;
      const src = abs(raw);
      if (map.has(src)) return;
      let title = '';
      if (n.tagName === 'A') title = (n.textContent || '').trim();
      else { const a = n.closest('audio'); title = a ? (a.getAttribute('title') || '').trim() : ''; }
      map.set(src, { id: src, src, title: title || nameOf(src), artist: '', cover: '', duration: 0 });
    });
    return Array.from(map.values());
  }
  function syncPage() {
    if (document.hidden) return;
    const found = scanTracks(), sig = sigOf(found);
    if (sig === lastSig) return;
    lastSig = sig;
    pageTracks = found;
    tab = 'page';
    syncTabs(); renderList(); updateVisibility();
  }
  let scanT = 0;
  const scheduleScan = () => { clearTimeout(scanT); scanT = setTimeout(syncPage, 400); };
  new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) store.set('time', audio.currentTime || 0); else scheduleScan();
  });

  /* ---------- отрисовка ---------- */
  const listArr = () => (tab === 'queue' ? queue : pageTracks);
  function syncTabs() {
    const both = pageTracks.length && queue.length && sigOf(pageTracks) !== sigOf(queue);
    if (!pageTracks.length) tab = 'queue';
    else if (!both) tab = 'page';
    tabsEl.classList.toggle('off', !both);
    $('[data-tab=page]').textContent = 'На странице · ' + pageTracks.length;
    $('[data-tab=queue]').textContent = 'Очередь · ' + queue.length;
    $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  }
  function renderList() {
    const arr = listArr();
    list.textContent = '';
    if (!arr.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'На этой странице нет треков';
      list.appendChild(e);
      return;
    }
    const frag = document.createDocumentFragment();
    arr.forEach((t, i) => {
      const r = document.createElement('div');
      r.className = 'row';
      r.dataset.i = i;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = i + 1;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = label(t);
      const d = document.createElement('span'); d.className = 'd'; d.textContent = t.duration ? fmt(t.duration) : '';
      r.append(n, nm, d);
      frag.appendChild(r);
    });
    list.appendChild(frag);
    markActive(true);
  }
  function markActive(center) {
    const id = curId(), arr = listArr(), playing = !audio.paused;
    list.querySelectorAll('.row').forEach((r) => {
      const t = arr[Number(r.dataset.i)], a = !!t && t.id === id;
      r.classList.toggle('active', a);
      r.classList.toggle('on', a && playing);
      if (a && center && isOpen) list.scrollTop = r.offsetTop - list.clientHeight / 2 + r.offsetHeight / 2;
    });
  }
  function renderNow() {
    const t = cur();
    if (!t) { titleEl.textContent = 'Выберите трек'; artistEl.textContent = '\u00a0'; coverImg.hidden = true; return; }
    titleEl.textContent = t.title;
    artistEl.textContent = t.artist || '\u00a0';
    artistEl.classList.remove('err');
    if (t.cover) { coverImg.hidden = false; coverImg.src = t.cover; } else coverImg.hidden = true;
  }
  function setPlayUI() {
    const playing = !audio.paused;
    $$('[data-act=play] .disk').forEach((d) => { d.innerHTML = playing ? IC.pause : IC.play; });
    ui.classList.toggle('playing', playing);
    markActive(false);
  }
  function progress(force) {
    if (seeking && !force) return;
    const d = dur(), c = audio.currentTime || 0, p = d ? Math.min(100, c / d * 100) : 0;
    fill.style.width = p + '%';
    knob.style.left = p + '%';
    curEl.textContent = fmt(c);
    durEl.textContent = fmt(d);
  }
  function applyModes() {
    btnShuffle.classList.toggle('on', shuffle);
    btnRepeat.classList.toggle('on', repeat !== 'off');
    btnRepeat.innerHTML = repeat === 'one' ? IC.repeat1 : IC.repeat;
  }
  function applyPjaxSwitch() {
    $('.sw').classList.toggle('on', pjaxOn);
    btnPjax.setAttribute('aria-checked', pjaxOn ? 'true' : 'false');
  }
  let toastT = 0;
  function toast(msg) {
    $('.toast').textContent = msg;
    ui.classList.add('tst');
    clearTimeout(toastT);
    toastT = setTimeout(() => ui.classList.remove('tst'), 2600);
  }
  function updateVisibility() {
    const show = !hidden && (pageTracks.length > 0 || queue.length > 0);
    dock.classList.toggle('off', !show);
    if (show) place(false);
    else if (isOpen) setOpen(false);
  }
  function setOpen(v) {
    isOpen = !!v;
    ui.classList.toggle('open', isOpen);
    if (isOpen) { syncTabs(); renderList(); progress(true); }
  }

  /* ---------- плавающая кнопка: позиция и перетаскивание ---------- */
  function calcXY() {
    const W = innerWidth, H = innerHeight, m = 8;
    const x = pos.side === 'l' ? m : W - DW - m;
    const y = Math.round(Math.min(Math.max(pos.y * (H - DH), m), H - DH - m));
    return { x, y };
  }
  function place(anim) {
    const p = calcXY();
    dock.classList.toggle('snap', !!anim);
    dock.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)';
  }
  let dg = null;
  dock.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    const p = calcXY();
    dg = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, x: p.x, y: p.y, moved: false };
  });
  dock.addEventListener('pointermove', (e) => {
    if (!dg || e.pointerId !== dg.id) return;
    const dx = e.clientX - dg.sx, dy = e.clientY - dg.sy;
    if (!dg.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      dg.moved = true;
      try { dock.setPointerCapture(e.pointerId); } catch (err) {}
      dock.classList.remove('snap');
      dock.classList.add('drag');
    }
    dg.x = Math.min(Math.max(0, dg.ox + dx), innerWidth - DW);
    dg.y = Math.min(Math.max(0, dg.oy + dy), innerHeight - DH);
    dock.style.transform = 'translate3d(' + dg.x + 'px,' + dg.y + 'px,0)';
  });
  const endDrag = (e) => {
    if (!dg || (e && e.pointerId !== dg.id)) return;
    const d = dg;
    dg = null;
    dock.classList.remove('drag');
    if (!d.moved) return;
    lastDrag = Date.now();
    const free = innerHeight - DH;
    pos = { side: d.x + DW / 2 < innerWidth / 2 ? 'l' : 'r', y: free > 0 ? Math.min(1, Math.max(0, d.y / free)) : 0.7 };
    store.set('pos', pos);
    place(true);
  };
  dock.addEventListener('pointerup', endDrag);
  dock.addEventListener('pointercancel', endDrag);
  dock.addEventListener('contextmenu', (e) => e.preventDefault());
  let rz = 0;
  const onResize = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => place(false)); };
  addEventListener('resize', onResize);
  addEventListener('orientationchange', onResize);

  /* свайп вниз по шапке закрывает меню */
  let sw = null;
  hd.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button,a')) return;
    sw = { id: e.pointerId, y: e.clientY, dy: 0 };
    try { hd.setPointerCapture(e.pointerId); } catch (err) {}
    sheet.style.transition = 'none';
  });
  hd.addEventListener('pointermove', (e) => {
    if (!sw || e.pointerId !== sw.id) return;
    sw.dy = Math.max(0, e.clientY - sw.y);
    sheet.style.transform = 'translateY(' + sw.dy + 'px)';
  });
  const endSwipe = () => {
    if (!sw) return;
    const dy = sw.dy;
    sw = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 80) setOpen(false);
  };
  hd.addEventListener('pointerup', endSwipe);
  hd.addEventListener('pointercancel', endSwipe);

  /* ---------- очередь и воспроизведение ---------- */
  const rnd = (n) => Math.floor(Math.random() * n);
  function persistQueue() { store.set('queue', queue); store.set('idx', idx); }
  function playSafe() {
    armed = true;
    const p = audio.play();
    if (p && p.catch) p.catch((err) => {
      if (err && err.name === 'NotAllowedError') toast('Нажмите ▶, чтобы запустить');
    });
  }
  function load(i, autoplay, startAt) {
    const t = queue[i];
    if (!t) return;
    idx = i;
    audio.preload = autoplay ? 'auto' : 'metadata';
    audio.src = t.src;
    if (startAt) audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = startAt; } catch (e) {} }, { once: true });
    setMedia(t);
    if (autoplay) playSafe();
    persistQueue();
    store.set('time', startAt || 0);
    renderNow(); syncTabs(); markActive(true); progress(true);
  }
  function setQueue(tracks, index, autoplay) {
    queue = tracks.slice();
    hist = [];
    idx = -1;
    load(index, autoplay);
    syncTabs();
  }
  function pickNext(auto) {
    const n = queue.length;
    if (!n) return -1;
    if (shuffle && n > 1) { let x; do { x = rnd(n); } while (x === idx); return x; }
    const x = idx + 1;
    if (x < n) return x;
    return (repeat === 'all' || !auto) ? 0 : -1;
  }
  function next(auto) {
    if (auto && repeat === 'one') { audio.currentTime = 0; playSafe(); return; }
    const x = pickNext(auto);
    if (x < 0) { setPlayUI(); return; }
    if (idx >= 0) { hist.push(idx); if (hist.length > 100) hist.shift(); }
    load(x, true);
  }
  function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (hist.length) { load(hist.pop(), true); return; }
    if (!queue.length) return;
    load(idx > 0 ? idx - 1 : (repeat === 'all' ? queue.length - 1 : 0), true);
  }
  function togglePlay() {
    if (!queue.length) {
      if (!pageTracks.length) { toast('На странице нет треков'); return; }
      setQueue(pageTracks, shuffle ? rnd(pageTracks.length) : 0, true);
      return;
    }
    if (!cur()) { load(0, true); return; }
    if (audio.paused) {
      if (audio.error) load(idx, true, audio.currentTime || Number(store.get('time', 0)) || 0);
      else playSafe();
    } else audio.pause();
  }
  function seekTo(sec) {
    try { audio.currentTime = Math.max(0, sec); } catch (e) {}
    progress(true);
  }
  function rowClick(i) {
    const arr = listArr(), t = arr[i];
    if (!t) return;
    if (sameQueue(arr)) {
      if (t.id === curId()) togglePlay(); else { if (idx >= 0) hist.push(idx); load(i, true); }
    } else if (t.id === curId() && queue.length) togglePlay();
    else setQueue(arr, i, true);
  }

  /* ---------- события аудио ---------- */
  function pauseForeign() {
    const all = new Set(foreign);
    document.querySelectorAll('audio,video').forEach((m) => all.add(m));
    all.forEach((m) => { if (m !== audio && !m.paused) { try { m.pause(); } catch (e) {} } });
  }
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (this !== audio) foreign.add(this);
    return origPlay.apply(this, arguments);
  };
  let lastPersist = 0, lastPos = 0;
  audio.addEventListener('play', () => { pauseForeign(); setPlayUI(); setMediaState(); });
  audio.addEventListener('pause', () => { setPlayUI(); setMediaState(); store.set('time', audio.currentTime || 0); });
  audio.addEventListener('playing', () => { errStreak = 0; });
  audio.addEventListener('ended', () => next(true));
  audio.addEventListener('durationchange', () => { progress(false); updatePosition(); });
  audio.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (isOpen) progress(false);
    if (now - lastPos > 1000) { lastPos = now; updatePosition(); }
    if (now - lastPersist > 2000) { lastPersist = now; store.set('time', audio.currentTime || 0); }
  });
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src') || !armed) return;
    artistEl.textContent = 'Не загрузился трек (ссылка могла устареть — обновите страницу)';
    artistEl.classList.add('err');
    toast('Не удалось загрузить трек');
    errStreak++;
    if (queue.length > 1 && errStreak < Math.min(queue.length, 5)) setTimeout(() => next(false), 1200);
  });
  addEventListener('pagehide', () => store.set('time', audio.currentTime || 0));

  /* ---------- шторка уведомлений / экран блокировки ---------- */
  function setMedia(t) {
    try {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, artwork: t.cover ? [{ src: t.cover }] : [] });
    } catch (e) {}
  }
  function setMediaState() {
    try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing'; } catch (e) {}
  }
  function updatePosition() {
    try {
      if (!('mediaSession' in navigator) || !isFinite(audio.duration) || audio.duration <= 0) return;
      navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime || 0, audio.duration) });
    } catch (e) {}
  }
  try {
    const ms = navigator.mediaSession;
    const set = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) {} };
    set('play', () => { if (!cur() && queue.length) load(0, true); else playSafe(); });
    set('pause', () => audio.pause());
    set('previoustrack', () => prev());
    set('nexttrack', () => next(false));
    set('seekto', (d) => { if (d.seekTime != null) seekTo(d.seekTime); });
    set('seekbackward', (d) => seekTo(audio.currentTime - (d.seekOffset || 10)));
    set('seekforward', (d) => seekTo(audio.currentTime + (d.seekOffset || 10)));
  } catch (e) {}

  /* ---------- управление ---------- */
  root.addEventListener('click', (e) => {
    if (Date.now() - lastDrag < 300) return;
    const row = e.target.closest('.row');
    if (row) { rowClick(Number(row.dataset.i)); return; }
    const tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; syncTabs(); renderList(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'play': togglePlay(); break;
      case 'prev': if (!queue.length) togglePlay(); else prev(); break;
      case 'next': if (!queue.length) togglePlay(); else next(false); break;
      case 'shuffle': shuffle = !shuffle; store.set('shuffle', shuffle); applyModes(); break;
      case 'repeat': repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'; store.set('repeat', repeat); applyModes(); break;
      case 'open': setOpen(true); break;
      case 'close': setOpen(false); break;
      case 'pjax': pjaxOn = !pjaxOn; store.set('pjax', pjaxOn); applyPjaxSwitch(); break;
      case 'hide': hidden = true; setOpen(false); updateVisibility(); toast('Плеер скрыт до перезагрузки страницы'); break;
    }
  });

  const barPct = (e) => { const r = bar.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
  const previewSeek = (e) => {
    const p = barPct(e);
    fill.style.width = p * 100 + '%';
    knob.style.left = p * 100 + '%';
    curEl.textContent = fmt(p * dur());
  };
  bar.addEventListener('pointerdown', (e) => {
    if (!dur()) return;
    seeking = true;
    try { bar.setPointerCapture(e.pointerId); } catch (err) {}
    previewSeek(e);
  });
  bar.addEventListener('pointermove', (e) => { if (seeking) previewSeek(e); });
  bar.addEventListener('pointerup', (e) => {
    if (!seeking) return;
    seeking = false;
    seekTo(barPct(e) * dur());
  });
  bar.addEventListener('pointercancel', () => { seeking = false; progress(true); });

  /* ---------- переходы по сайту без перезагрузки (музыка не прерывается) ---------- */
  const SKIP_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|zip|rar|7z|pdf|apk|jpe?g|png|gif|webp|mp4|webm|txt|doc|docx)$/i;
  const keyOf = (u) => u.pathname + u.search;
  let shownKey = keyOf(location), navTok = 0;
  const scriptsKey = (doc, base) => Array.from(doc.querySelectorAll('script[src]')).map((s) => abs(s.getAttribute('src'), base)).join('|');
  let shownScripts = scriptsKey(document, location.href);
  const loadedSrc = new Set(Array.from(document.querySelectorAll('script[src]')).map((s) => s.src));

  function swap(doc, base) {
    document.title = doc.title;
    const haveCss = new Set(Array.from(document.head.querySelectorAll('link[rel~=stylesheet]')).map((l) => l.href));
    doc.head.querySelectorAll('link[rel~=stylesheet]').forEach((l) => {
      const h = abs(l.getAttribute('href'), base);
      if (haveCss.has(h)) return;
      const c = document.createElement('link');
      c.rel = 'stylesheet'; c.href = h;
      document.head.appendChild(c);
    });
    const haveStyle = new Set(Array.from(document.head.querySelectorAll('style')).map((s) => s.textContent));
    doc.head.querySelectorAll('style').forEach((s) => { if (!haveStyle.has(s.textContent)) document.head.appendChild(document.importNode(s, true)); });
    const nb = document.adoptNode(doc.body);
    nb.querySelectorAll('script').forEach((old) => {
      const src = old.getAttribute('src');
      const full = src ? abs(src, base) : '';
      if (full && loadedSrc.has(full)) { old.remove(); return; }
      if (full) loadedSrc.add(full);
      const s = document.createElement('script');
      Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.textContent = old.textContent;
      s.async = false;
      old.replaceWith(s);
    });
    document.body.replaceWith(nb);
  }
  async function pjaxGo(url, push, restoreY) {
    const my = ++navTok;
    ui.classList.remove('loading');
    void ui.offsetWidth;
    ui.classList.add('loading');
    try {
      const res = await fetch(url, { credentials: 'same-origin', redirect: 'follow' });
      if (my !== navTok) return;
      const finalURL = new URL(res.url);
      if (!res.ok || finalURL.origin !== location.origin || !/html/i.test(res.headers.get('content-type') || '')) throw new Error('nav');
      const html = await res.text();
      if (my !== navTok) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const key = scriptsKey(doc, finalURL.href);
      if (!doc.body || key !== shownScripts) throw new Error('layout');
      const hash = new URL(url, location.href).hash;
      if (!finalURL.hash && hash) finalURL.hash = hash;
      if (push) {
        try { history.replaceState(Object.assign({}, history.state, { fpY: scrollY }), ''); } catch (e) {}
        history.pushState({ fp: 1 }, '', finalURL.href);
      }
      swap(doc, finalURL.href);
      shownScripts = key;
      shownKey = keyOf(location);
      let target = null;
      if (location.hash) { try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {} }
      if (target) target.scrollIntoView(); else scrollTo(0, restoreY || 0);
      lastSig = '';
      syncPage();
      ui.classList.remove('loading');
    } catch (e) {
      if (my === navTok) location.href = url;
    }
  }
  document.addEventListener('click', (e) => {
    if (!pjaxOn || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    let u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (!/^https?:$/.test(u.protocol) || u.origin !== location.origin || SKIP_EXT.test(u.pathname)) return;
    if (keyOf(u) === keyOf(location)) {
      if (u.hash && u.hash !== location.hash) return;
      e.preventDefault();
      pjaxGo(u.href, false, scrollY);
      return;
    }
    e.preventDefault();
    pjaxGo(u.href, true);
  });
  document.addEventListener('submit', (e) => {
    if (!pjaxOn || e.defaultPrevented) return;
    const f = e.target;
    if (!(f instanceof HTMLFormElement) || (f.method || 'get').toLowerCase() !== 'get' || (f.target && f.target !== '_self')) return;
    let u;
    try { u = new URL(f.getAttribute('action') || location.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || f.querySelector('input[type=file]')) return;
    const sp = new URLSearchParams();
    let fd;
    try { fd = new FormData(f, e.submitter || undefined); } catch (err) { fd = new FormData(f); }
    fd.forEach((v, k) => { if (typeof v === 'string') sp.append(k, v); });
    u.search = sp.toString();
    e.preventDefault();
    pjaxGo(u.href, true);
  });
  addEventListener('popstate', (e) => {
    if (keyOf(location) === shownKey) return;
    if (pjaxOn) pjaxGo(location.href, false, (e.state && e.state.fpY) || 0);
    else location.reload();
  });

  /* ---------- запуск ---------- */
  if (cur()) {
    const t = cur(), st = Number(store.get('time', 0)) || 0;
    audio.preload = 'metadata';
    audio.src = t.src;
    if (st > 1) audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = st; } catch (e) {} }, { once: true });
    setMedia(t);
  }
  renderNow(); applyModes(); applyPjaxSwitch(); setPlayUI(); progress(true);
  syncPage();
  updateVisibility();

  window.__fp = {
    version: VERSION,
    toggle() {
      if (!pageTracks.length && !queue.length) { toast('На этой странице нет треков'); return; }
      hidden = !hidden;
      updateVisibility();
    },
    open() { hidden = false; updateVisibility(); setOpen(true); },
    close() { setOpen(false); }
  };
})();
