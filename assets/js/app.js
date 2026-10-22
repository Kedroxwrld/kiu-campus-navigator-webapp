/* ============================================================================
   KIU Campus Navigator — application layer
   UI state, search & filtering, the directions panel, bookmarks, the visitor
   essentials and the mobile bottom-sheet behaviour.
   ========================================================================== */

(function () {
  'use strict';

  var DATA = window.KIU_DATA;
  var ROUTER = window.KIU_ROUTER;
  var MAP = window.KIU_MAP;

  var LS = {
    bookmarks: 'kiu.nav.bookmarks',
    recents: 'kiu.nav.recents',
    seen: 'kiu.nav.welcomeSeen'
  };

  var state = {
    category: 'all',
    quick: [],
    query: '',
    selected: null,
    route: null,
    routeFrom: 'gate',
    routeTo: 'library',
    bookmarks: load(LS.bookmarks, []),
    recents: load(LS.recents, []),
    tab: 'explore',
    faqOpen: 0
  };

  var panels = {};
  var els = {};
  var sheet = null;
  var snap = 'peek';

  /* ------------------------------------------------------------- storage */
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  /* --------------------------------------------------------------- utils */
  function el(html) {
    var t = document.createElement('div');
    t.innerHTML = html.trim();
    return t.firstElementChild;
  }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name, cls) {
    return '<svg class="' + (cls || 'h-4 w-4') + '"><use href="#' + name + '"/></svg>';
  }
  function catOf(id) { return DATA.category(id); }

  function isMobile() {
    return window.matchMedia('(max-width: 1023px)').matches;
  }

  /* ------------------------------------------------------------- search */
  // Index of `needle` inside `hay` only when it starts a word.
  function wordStart(hay, needle) {
    var i = hay.indexOf(needle);
    while (i !== -1) {
      var before = i === 0 ? ' ' : hay.charAt(i - 1);
      if (!/[a-z0-9]/.test(before)) return i;
      i = hay.indexOf(needle, i + 1);
    }
    return -1;
  }

  // The part of a name before any qualifier, e.g. "ATM & Banking Point (Main Gate)".
  function primaryName(name) {
    var p = name.indexOf('(');
    return (p === -1 ? name : name.slice(0, p)).trim().toLowerCase();
  }

  function searchLocations(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return [];
    var out = [];
    DATA.locations.forEach(function (loc) {
      var score = 0;
      var name = loc.name.toLowerCase();
      var short = (loc.shortName || '').toLowerCase();
      var pname = primaryName(loc.name);
      var tags = loc.tags || [];
      if (name === q) score = 100;
      else if (pname === q) score = 96;
      else if (short === q) score = 94;
      else if (name.indexOf(q) === 0) score = 90;
      else if (pname.indexOf(q) === 0) score = 86;
      else if (short.indexOf(q) === 0) score = 82;
      else if (wordStart(pname, q) !== -1) score = 78;
      else if (wordStart(name, q) !== -1) score = 74;
      else if (wordStart(short, q) !== -1) score = 70;
      else if (name.indexOf(q) !== -1) score = 58;
      else if (short.indexOf(q) !== -1) score = 52;
      else if (tags.some(function (t) { return t.indexOf(q) === 0; })) score = 40;
      else if (tags.some(function (t) { return t.indexOf(q) !== -1; })) score = 28;
      else if (catOf(loc.category).label.toLowerCase().indexOf(q) !== -1) score = 14;
      else if (loc.blurb.toLowerCase().indexOf(q) !== -1) score = 10;
      if (score > 0) out.push({ loc: loc, score: score, len: (loc.name || '').length });
    });
    out.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.len !== b.len) return a.len - b.len;   // the tighter name is the better answer
      return a.loc.name.localeCompare(b.loc.name);
    });
    return out.map(function (o) { return o.loc; });
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return esc(text);
    return esc(text.slice(0, i)) + '<mark class="kiu-mark">' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }

  /* ------------------------------------------------------- visible set */
  function visibleLocations() {
    if (state.query.trim()) return searchLocations(state.query);
    return DATA.locations.filter(function (loc) {
      if (state.category !== 'all' && loc.category !== state.category) return false;
      if (state.quick.length) {
        var ok = state.quick.every(function (q) {
          return (loc.quick || []).indexOf(q) !== -1;
        });
        if (!ok) return false;
      }
      return true;
    });
  }

  /* ============================================================ TEMPLATES */

  function searchHTML() {
    return '' +
      '<div class="kiu-search">' +
      '  <div class="relative">' +
      '    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">' + icon('i-search', 'h-5 w-5') + '</span>' +
      '    <input id="kiuSearch" type="text" role="combobox" aria-expanded="false" aria-controls="kiuSearchList" aria-autocomplete="list" autocomplete="off" spellcheck="false"' +
      '      data-role="search-input" placeholder="Search rooms, departments, services…"' +
      '      class="w-full h-14 pl-12 pr-14 rounded-2xl bg-white border border-slate-200 text-[15px] text-ink placeholder:text-slate-400 shadow-soft outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition-all duration-300 ease-calm" />' +
      '    <button type="button" data-action="clear-search" aria-label="Clear search"' +
      '      class="absolute right-1 top-1 h-12 w-12 grid place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200">' +
      icon('i-x', 'h-4 w-4') +
      '</button>' +
      '    <div id="kiuSearchList" role="listbox" aria-label="Search results"' +
      '      class="kiu-drop absolute left-0 right-0 top-[calc(100%+8px)] z-[700] hidden max-h-[min(60vh,420px)] overflow-y-auto scroll-slim"></div>' +
      '  </div>' +
      '</div>';
  }

  function segmentsHTML() {
    var segs = [{ id: 'all', label: 'All' }].concat(
      DATA.categories.map(function (c) { return { id: c.id, label: c.short }; })
    );
    return '<div class="kiu-seg-group" role="tablist" aria-label="Filter by category">' +
      segs.map(function (s) {
        return '<button type="button" role="tab" data-filter="' + s.id + '" class="kiu-seg" data-active="false">' + s.label + '</button>';
      }).join('') +
      '</div>';
  }

  function chipsHTML() {
    var chips = DATA.quickFilters.map(function (q) {
      return '<button type="button" data-quick="' + q.id + '" class="kiu-chip" aria-pressed="false">' +
        icon(q.icon, 'h-4 w-4') + '<span>' + q.label + '</span></button>';
    }).join('');
    return '<div class="kiu-chip-row" role="group" aria-label="Quick filters">' + chips + '</div>';
  }

  function routeSelectHTML(role, value) {
    var opts = DATA.locations.map(function (l) {
      var c = catOf(l.category);
      return '<option value="' + l.id + '"' + (l.id === value ? ' selected' : '') + '>' +
        esc(l.shortName) + ' — ' + esc(c.short) + '</option>';
    }).join('');
    return '<select class="kiu-select" data-role="' + role + '" aria-label="' +
      (role === 'route-from' ? 'Start point' : 'Destination') + '">' + opts + '</select>';
  }

  function routeHTML() {
    return '' +
      '<div class="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-soft">' +
      '  <div class="flex items-center justify-between gap-2 mb-3">' +
      '    <h2 class="kiu-eyebrow">Get directions</h2>' +
      '    <button type="button" data-action="clear-route" class="inline-flex items-center min-h-[44px] px-2 -my-1 text-[12.5px] font-semibold text-slate-400 hover:text-brand-700 transition-colors duration-200">Clear</button>' +
      '  </div>' +
      '  <div class="space-y-2">' +
      '    <div class="kiu-field"><span class="kiu-field-ic is-start">' + icon('i-pin', 'h-4 w-4') + '</span>' +
      '      <span class="kiu-field-label">Start</span>' +
      routeSelectHTML('route-from', state.routeFrom) +
      '    </div>' +
      '    <div class="flex justify-end -my-2">' +
      '      <button type="button" data-action="swap-route" aria-label="Swap start and destination"' +
      '        class="h-12 w-12 rounded-xl grid place-items-center text-slate-500 bg-slate-100 hover:bg-brand-100 hover:text-brand-700 transition-colors duration-200">' +
      icon('i-swap', 'h-4 w-4') + '</button>' +
      '    </div>' +
      '    <div class="kiu-field"><span class="kiu-field-ic is-end">' + icon('i-flag', 'h-4 w-4') + '</span>' +
      '      <span class="kiu-field-label">To</span>' +
      routeSelectHTML('route-to', state.routeTo) +
      '    </div>' +
      '  </div>' +
      '  <button type="button" data-action="compute-route" class="kiu-cta mt-3">' +
      icon('i-navigation', 'h-5 w-5') + '<span>Show walking route</span></button>' +
      '  <div data-role="route-results" class="mt-3"></div>' +
      '</div>';
  }

  function listHTML() {
    var items = visibleLocations();
    if (!items.length) {
      return '<div class="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-6 text-center">' +
        '<p class="text-[14px] font-semibold text-slate-600">No match on campus</p>' +
        '<p class="text-[13px] text-slate-400 mt-1">Try “library”, “bursar”, “hostel” or “ICT lab”.</p>' +
        '</div>';
    }
    return '<ul class="space-y-2">' + items.map(function (loc) {
      var c = catOf(loc.category);
      var saved = state.bookmarks.indexOf(loc.id) !== -1;
      return '<li>' +
        '<div class="kiu-loc" data-loc="' + loc.id + '">' +
        '  <button type="button" data-action="focus-loc" data-loc="' + loc.id + '" class="kiu-loc-main">' +
        '    <span class="kiu-loc-ic" style="--c:' + c.color + '">' + icon(loc.icon, 'h-[18px] w-[18px]') + '</span>' +
        '    <span class="min-w-0 flex-1 text-left">' +
        '      <span class="kiu-loc-name">' + highlight(loc.shortName, state.query) + '</span>' +
        '      <span class="kiu-loc-sub">' + highlight(loc.blurb, state.query) + '</span>' +
        '    </span>' +
        '  </button>' +
        '  <button type="button" data-action="bookmark" data-loc="' + loc.id + '" aria-label="' +
        (saved ? 'Remove from saved places' : 'Save this place') + '" aria-pressed="' + saved + '" class="kiu-loc-save' + (saved ? ' is-on' : '') + '">' +
        icon(saved ? 'i-bookmark-filled' : 'i-bookmark', 'h-[18px] w-[18px]') + '</button>' +
        '</div></li>';
    }).join('') + '</ul>';
  }

  function essentialsHTML() {
    var dials = DATA.contacts.slice(0, 3).map(function (c) {
      return '<a href="tel:' + esc(c.phone.replace(/\s/g, '')) + '" class="kiu-dial" data-accent="' + c.accent + '">' +
        '<span class="kiu-dial-ic">' + icon(c.icon, 'h-5 w-5') + '</span>' +
        '<span class="min-w-0 flex-1 text-left">' +
        '<span class="kiu-dial-label">' + esc(c.label) + '</span>' +
        '<span class="kiu-dial-note">' + esc(c.note) + '</span>' +
        '</span>' +
        '<span class="kiu-dial-phone">' + esc(c.phone) + '</span>' +
        '</a>';
    }).join('');

    var faqs = DATA.faqs.map(function (f, i) {
      return '<div class="kiu-faq' + (state.faqOpen === i ? ' is-open' : '') + '" data-faq="' + i + '">' +
        '<button type="button" data-action="faq" data-index="' + i + '" class="kiu-faq-q" aria-expanded="' + (state.faqOpen === i) + '" aria-controls="faq-panel-' + i + '">' +
        '<span class="flex-1 text-left">' + esc(f.q) + '</span>' +
        '<span class="kiu-faq-chevron">' + icon('i-chevron-down', 'h-4 w-4') + '</span>' +
        '</button>' +
        '<div id="faq-panel-' + i + '" class="kiu-faq-panel" role="region"><div class="kiu-faq-inner">' + f.a + '</div></div>' +
        '</div>';
    }).join('');

    var saved = state.bookmarks.length
      ? '<ul class="space-y-2">' + state.bookmarks.map(function (id) {
          var loc = DATA.byId(id);
          if (!loc) return '';
          var c = catOf(loc.category);
          return '<li><div class="kiu-loc is-saved">' +
            '<button type="button" data-action="focus-loc" data-loc="' + loc.id + '" class="kiu-loc-main">' +
            '<span class="kiu-loc-ic" style="--c:' + c.color + '">' + icon(loc.icon, 'h-[18px] w-[18px]') + '</button>' +
            '<span class="min-w-0 flex-1 text-left">' +
            '<span class="kiu-loc-name">' + esc(loc.shortName) + '</span>' +
            '<span class="kiu-loc-sub">' + esc(c.short) + '</span>' +
            '</span>' +
            '</button>' +
            '<button type="button" data-action="bookmark" data-loc="' + loc.id + '" aria-label="Remove saved place" class="kiu-loc-save is-on">' +
            icon('i-bookmark-filled', 'h-[18px] w-[18px]') + '</button>' +
            '</div></li>';
        }).join('') + '</ul>'
      : '<p class="text-[13px] text-slate-400 leading-relaxed">Tap the bookmark on any place to keep it here. Saved places stay on this device — nothing is uploaded.</p>';

    return '' +
      '<section>' +
      '  <h2 class="kiu-eyebrow mb-2.5">Emergency &amp; security</h2>' +
      '  <div class="space-y-2">' + dials + '</div>' +
      '  <p class="mt-2 text-[11.5px] leading-relaxed text-slate-400">KIU extension numbers are placeholders — replace them with the official lines published by the University. National lines: Police 999, Ambulance &amp; Fire 912.</p>' +
      '</section>' +
      '<section>' +
      '  <h2 class="kiu-eyebrow mb-1">First-time visitor guide</h2>' +
      '  <div class="rounded-3xl border border-slate-200/80 bg-white px-4 shadow-soft divide-y divide-slate-100">' + faqs + '</div>' +
      '</section>' +
      '<section>' +
      '  <h2 class="kiu-eyebrow mb-2">Saved places</h2>' + saved +
      '</section>';
  }

  /* ============================================================== RENDER */

  function renderSearchDropdown() {
    var box = els.searchList;
    if (!box) return;
    var q = state.query.trim();

    if (!q) {
      var recent = state.recents.length
        ? '<div class="kiu-drop-head">Recent searches</div>' +
          state.recents.map(function (r) {
            return '<button type="button" data-action="use-recent" data-q="' + esc(r) + '" class="kiu-drop-item is-recent">' +
              icon('i-clock', 'h-4 w-4') + '<span class="flex-1 text-left">' + esc(r) + '</span></button>';
          }).join('')
        : '';
      box.innerHTML = recent;
      toggleDrop(recent ? true : false);
      return;
    }

    var results = searchLocations(q);
    if (!results.length) {
      box.innerHTML = '<div class="kiu-drop-empty">Nothing on campus matches “' + esc(q) + '”.<br>Try a shorter word.</div>';
      toggleDrop(true);
      return;
    }

    box.innerHTML = '<div class="kiu-drop-head">' + results.length + ' place' + (results.length > 1 ? 's' : '') + ' found</div>' +
      results.slice(0, 8).map(function (loc) {
        var c = catOf(loc.category);
        return '<button type="button" role="option" data-action="pick-search" data-loc="' + loc.id + '" class="kiu-drop-item">' +
          '<span class="kiu-loc-ic" style="--c:' + c.color + '">' + icon(loc.icon, 'h-[18px] w-[18px]') + '</span>' +
          '<span class="min-w-0 flex-1 text-left">' +
          '<span class="kiu-loc-name">' + highlight(loc.name, q) + '</span>' +
          '<span class="kiu-loc-sub">' + esc(c.label) + '</span>' +
          '</span></button>';
      }).join('');
    toggleDrop(true);
  }

  function toggleDrop(open) {
    if (!els.searchList) return;
    els.searchList.classList.toggle('hidden', !open);
    if (els.searchInput) els.searchInput.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function renderList() {
    var body = '<div class="flex items-baseline justify-between gap-3 mb-3">' +
      '<h2 class="kiu-eyebrow">On campus</h2>' +
      '<span class="text-[12px] font-semibold text-slate-400" data-role="count"></span>' +
      '</div>' + listHTML();
    els.listDesktop.innerHTML = body;
    els.listMobile.innerHTML = body;
    var count = visibleLocations().length;
    var counters = document.querySelectorAll('[data-role="count"]');
    for (var i = 0; i < counters.length; i++) {
      counters[i].textContent = count + (count === 1 ? ' place' : ' places');
    }
    MAP.dimMarkers(state.query.trim() || state.quick.length || state.category !== 'all'
      ? visibleLocations().map(function (l) { return l.id; })
      : null);
  }

  function renderEssentials() {
    els.essDesktop.innerHTML = essentialsHTML();
    els.essMobile.innerHTML = essentialsHTML();
  }

  function renderFilters() {
    var segs = document.querySelectorAll('[data-filter]');
    for (var i = 0; i < segs.length; i++) {
      var on = segs[i].getAttribute('data-filter') === state.category;
      segs[i].setAttribute('data-active', on ? 'true' : 'false');
      segs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    var chips = document.querySelectorAll('[data-quick]');
    for (var j = 0; j < chips.length; j++) {
      var active = state.quick.indexOf(chips[j].getAttribute('data-quick')) !== -1;
      chips[j].classList.toggle('is-on', active);
      chips[j].setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function renderRouteResults() {
    var box = panels.route.querySelector('[data-role="route-results"]');
    if (!box) return;
    var r = state.route;
    if (!r) { box.innerHTML = ''; return; }

    var from = r.from, to = r.to;
    var steps = r.steps.map(function (s, i) {
      return '<li class="kiu-step' + (s.tone === 'arrive' ? ' is-arrive' : '') + '">' +
        '<span class="kiu-step-ic">' + icon(s.icon, 'h-4 w-4') + '</span>' +
        '<span class="min-w-0 flex-1">' +
        '<span class="kiu-step-title">' + esc(s.title) + '</span>' +
        (s.detail ? '<span class="kiu-step-detail">' + esc(s.detail) + '</span>' : '') +
        '</span>' +
        (s.distance > 0 ? '<span class="kiu-step-dist">' + ROUTER.formatDistance(s.distance) + '</span>' : '') +
        '</li>';
    }).join('');

    var saved = state.bookmarks.indexOf(to.id) !== -1;

    box.innerHTML = '' +
      '<div class="kiu-route-sum">' +
      '  <div><strong>' + ROUTER.formatDistance(r.distance) + '</strong><span>Distance</span></div>' +
      '  <div><strong>' + r.minutes + ' min</strong><span>Walking time</span></div>' +
      '  <div><strong>' + r.steps.length + '</strong><span>Steps</span></div>' +
      '</div>' +
      '<div class="kiu-route-ends">' + icon('i-flag', 'h-3.5 w-3.5') + '<span>' + esc(from.shortName) + '</span>' +
      '<span class="kiu-route-arrow">' + icon('i-arrow-right', 'h-3.5 w-3.5') + '</span>' +
      '<span>' + esc(to.shortName) + '</span></div>' +
      '<ol class="kiu-steps">' + steps + '</ol>' +
      '<div class="flex gap-2 mt-3">' +
      '  <button type="button" data-action="play-route" class="kiu-cta is-ghost flex-1">' + icon('i-walk', 'h-4 w-4') + '<span>Replay route</span></button>' +
      '  <button type="button" data-action="bookmark" data-loc="' + to.id + '" class="kiu-cta is-ghost flex-1">' + icon(saved ? 'i-bookmark-filled' : 'i-bookmark', 'h-4 w-4') + '<span>' + (saved ? 'Saved' : 'Save') + '</span></button>' +
      '</div>';
  }

  function renderLegend() {
    var html = '<div class="kiu-legend">' +
      '<p class="kiu-legend-title">Campus key</p>' +
      DATA.categories.map(function (c) {
        return '<span class="kiu-legend-item"><i style="background:' + c.color + '"></i>' + esc(c.short) + '</span>';
      }).join('') +
      '<span class="kiu-legend-item"><i class="is-road"></i>Walkway</span>' +
      '<span class="kiu-legend-item"><i class="is-green"></i>Green space</span>' +
      '</div>';
    els.legend.innerHTML = html;
  }

  /* ============================================================ ACTIONS */

  function selectLocation(id, fromMap) {
    var loc = DATA.byId(id);
    if (!loc) return;
    state.selected = id;
    MAP.setSelected(id);
    MAP.openPopup(loc);
    if (!fromMap) {
      MAP.focus(loc);
    }
    var cards = document.querySelectorAll('.kiu-loc[data-loc="' + id + '"]');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.add('is-active');
      if (cards[i].scrollIntoView) cards[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    if (isMobile()) setSheet('peek');
  }

  function computeRoute(opts) {
    var from = state.routeFrom, to = state.routeTo;
    if (opts && opts.to) { to = opts.to; state.routeTo = to; }
    if (opts && opts.from) { from = opts.from; state.routeFrom = from; }
    if (from === to) {
      state.route = ROUTER.route(from, to);
      renderRouteResults();
      MAP.showRoute(null);
      toast('Start and destination are the same place.', 'info');
      return;
    }
    var result = ROUTER.route(from, to);
    if (!result) {
      toast('We could not find a walking path between those two places.', 'error');
      return;
    }
    state.route = result;
    renderRouteResults();
    MAP.showRoute(result, true);
    announce('Route from ' + result.from.shortName + ' to ' + result.to.shortName +
      '. ' + ROUTER.formatDistance(result.distance) + ', about ' + result.minutes + ' minutes on foot.');
  }

  function toggleBookmark(id) {
    var i = state.bookmarks.indexOf(id);
    if (i === -1) {
      state.bookmarks.unshift(id);
      var loc = DATA.byId(id);
      toast('Saved ' + (loc ? loc.shortName : 'place') + ' to your favourites.', 'success');
    } else {
      state.bookmarks.splice(i, 1);
      toast('Removed from favourites.', 'info');
    }
    save(LS.bookmarks, state.bookmarks);
    renderList();
    renderEssentials();
    renderRouteResults();
  }

  function pushRecent(q) {
    q = (q || '').trim();
    if (!q) return;
    var i = state.recents.indexOf(q);
    if (i !== -1) state.recents.splice(i, 1);
    state.recents.unshift(q);
    state.recents = state.recents.slice(0, 5);
    save(LS.recents, state.recents);
  }

  /* ------------------------------------------------------------- toast */
  var toastEl = null, toastTimer = null;
  function toast(message, tone) {
    if (!toastEl) {
      toastEl = el('<div id="kiuToast" role="status" aria-live="polite" class="kiu-toast"></div>');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.setAttribute('data-tone', tone || 'info');
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3200);
  }

  function announce(msg) {
    var live = document.getElementById('live');
    if (live) live.textContent = msg;
  }

  /* ------------------------------------------------------------- modal */
  function openModal(kind) {
    var body = document.getElementById('modal-body');
    if (kind === 'about') {
      var w = DATA.welcome;
      body.innerHTML = '' +
        '<div class="h-12 w-12 rounded-2xl bg-brand-700 grid place-items-center mb-4">' + icon('i-compass', 'h-6 w-6 text-white') + '</div>' +
        '<h2 class="text-[20px] font-extrabold tracking-tight">' + esc(w.title) + '</h2>' +
        '<p class="text-[14px] leading-relaxed text-slate-600 mt-2">' + esc(w.body) + '</p>' +
        '<ul class="mt-4 space-y-3">' + w.tips.map(function (t) {
          return '<li class="flex gap-3 items-start">' +
            '<span class="kiu-tip-ic">' + icon(t.icon, 'h-4 w-4') + '</span>' +
            '<span><span class="block text-[13.5px] font-bold">' + esc(t.title) + '</span>' +
            '<span class="block text-[13px] text-slate-500 leading-relaxed mt-0.5">' + esc(t.text) + '</span></span>' +
            '</li>';
        }).join('') + '</ul>' +
        '<div class="mt-5 rounded-2xl bg-sage px-4 py-3 text-[12.5px] text-brand-800 leading-relaxed">' +
        'This navigator uses an illustrative campus plan. Walking times assume a calm pace of about 1.35 m/s and exclude queues and stairs. Confirm hours and contacts with the University Registrar.' +
        '</div>' +
        '<button type="button" data-action="close-modal" class="kiu-cta mt-4">Got it</button>';
    }
    var modal = document.getElementById('modal');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    var focusable = modal.querySelector('button');
    if (focusable) setTimeout(function () { focusable.focus(); }, 260);
  }

  function closeModal() {
    var modal = document.getElementById('modal');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  /* ==================================================== MOBILE BOTTOM SHEET */
  var SNAPS = { peek: 190, half: 0.46, full: 0 };

  function sheetTranslate() {
    var h = sheet.offsetHeight;
    var v = SNAPS[snap];
    return typeof v === 'number' && v < 1 ? h * v : h - v;
  }

  function setTranslate(px) {
    sheet.style.transform = 'translateY(' + px + 'px)';
    updateOffset();
  }

  function updateOffset() {
    var h = sheet.offsetHeight;
    var ty = sheetTranslate();
    var visible = Math.max(0, h - ty);
    document.documentElement.style.setProperty('--sheet-offset', Math.round(visible) + 'px');
  }

  function setSheet(name) {
    snap = name;
    var h = sheet.offsetHeight;
    var v = SNAPS[name];
    var ty = (typeof v === 'number' && v < 1) ? h * v : h - v;
    sheet.style.transform = 'translateY(' + ty + 'px)';
    sheet.dataset.snap = name;
    updateOffset();
  }

  function setTab(tab) {
    state.tab = tab;
    var btns = els.sheetTabs.querySelectorAll('[data-tab]');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-tab') === tab;
      btns[i].setAttribute('data-active', on ? 'true' : 'false');
      btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    var panes = els.sheetPanes.querySelectorAll('[data-pane]');
    for (var j = 0; j < panes.length; j++) {
      panes[j].classList.toggle('hidden', panes[j].getAttribute('data-pane') !== tab);
    }
    if (tab === 'route') mountPanels();
  }

  function initSheet() {
    sheet = document.getElementById('sheet');
    els.sheetTabs = document.getElementById('sheet-tabs');
    els.sheetPanes = document.getElementById('sheet-panes');

    els.sheetTabs.innerHTML = [
      { id: 'explore', label: 'Explore', icon: 'i-grid' },
      { id: 'route', label: 'Directions', icon: 'i-route' },
      { id: 'essentials', label: 'Essentials', icon: 'i-info' }
    ].map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t.id + '" data-active="false" class="kiu-sheet-tab">' +
        icon(t.icon, 'h-4 w-4') + '<span>' + t.label + '</span></button>';
    }).join('');

    var grip = document.getElementById('sheet-grip');
    var drag = { active: false, startY: 0, startTy: 0 };

    grip.addEventListener('pointerdown', function (e) {
      drag.active = true;
      drag.startY = e.clientY;
      drag.startTy = sheetTranslate();
      sheet.classList.add('is-dragging');
      try { grip.setPointerCapture(e.pointerId); } catch (err) { }
      e.preventDefault();
    });

    grip.addEventListener('pointermove', function (e) {
      if (!drag.active) return;
      var h = sheet.offsetHeight;
      var ty = Math.min(h, Math.max(0, drag.startTy + (e.clientY - drag.startY)));
      setTranslate(ty);
    });

    function endDrag(e) {
      if (!drag.active) return;
      drag.active = false;
      sheet.classList.remove('is-dragging');
      var h = sheet.offsetHeight;
      var ty = sheetTranslate();
      var best = 'peek', bestD = Infinity;
      Object.keys(SNAPS).forEach(function (name) {
        var v = SNAPS[name];
        var target = (typeof v === 'number' && v < 1) ? h * v : h - v;
        var d = Math.abs(target - ty);
        if (d < bestD) { bestD = d; best = name; }
      });
      setSheet(best);
      if (e && e.cancelable) e.preventDefault();
    }
    grip.addEventListener('pointerup', endDrag);
    grip.addEventListener('pointercancel', endDrag);
    grip.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setSheet(snap === 'peek' ? 'half' : 'peek');
      }
    });

    els.sheetTabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (!b) return;
      var tab = b.getAttribute('data-tab');
      setTab(tab);
      if (snap === 'peek') setSheet(tab === 'explore' ? 'peek' : 'half');
    });

    setTab('explore');
    setSheet('peek');
  }

  /* ============================================================== MOUNT */
  function mountPanels() {
    var mobile = isMobile();

    var searchSlot = mobile
      ? document.getElementById('slot-search-mobile')
      : document.getElementById('slot-search-desktop');
    var chipsSlot = mobile
      ? document.getElementById('slot-chips-mobile')
      : document.getElementById('slot-chips-desktop');
    var segSlot = mobile
      ? document.getElementById('slot-segments-mobile')
      : document.getElementById('slot-segments-desktop');
    var routeSlot = mobile
      ? els.sheetPanes.querySelector('[data-pane="route"]')
      : document.getElementById('slot-route-desktop');

    if (panels.search.parentNode !== searchSlot) searchSlot.appendChild(panels.search);
    if (panels.chips.parentNode !== chipsSlot) chipsSlot.appendChild(panels.chips);
    if (panels.segments.parentNode !== segSlot) segSlot.appendChild(panels.segments);
    if (panels.route.parentNode !== routeSlot) routeSlot.appendChild(panels.route);

    els.searchInput = panels.search.querySelector('[data-role="search-input"]');
    els.searchList = panels.search.querySelector('#kiuSearchList');
  }

  /* ============================================================== EVENTS */
  function onClick(e) {
    var t = e.target;
    var actionEl = t.closest('[data-action]');
    var locEl = t.closest('[data-loc]');

    /* category filters */
    var seg = t.closest('[data-filter]');
    if (seg) {
      state.category = seg.getAttribute('data-filter');
      state.query = '';
      if (els.searchInput) els.searchInput.value = '';
      renderFilters();
      renderList();
      toggleDrop(false);
      announce(visibleLocations().length + ' places shown.');
      return;
    }

    /* quick chips */
    var chip = t.closest('[data-quick]');
    if (chip) {
      var q = chip.getAttribute('data-quick');
      var idx = state.quick.indexOf(q);
      if (idx === -1) state.quick.push(q); else state.quick.splice(idx, 1);
      renderFilters();
      renderList();
      return;
    }

    if (!actionEl) return;
    var action = actionEl.getAttribute('data-action');

    switch (action) {
      case 'clear-search':
        state.query = '';
        if (els.searchInput) { els.searchInput.value = ''; els.searchInput.focus(); }
        renderList();
        renderSearchDropdown();
        break;

      case 'use-recent':
        state.query = actionEl.getAttribute('data-q');
        if (els.searchInput) els.searchInput.value = state.query;
        renderSearchDropdown();
        renderList();
        break;

      case 'pick-search':
        var pickId = actionEl.getAttribute('data-loc');
        state.query = '';
        if (els.searchInput) els.searchInput.value = '';
        pushRecent(DATA.byId(pickId).shortName);
        toggleDrop(false);
        renderList();
        selectLocation(pickId, false);
        break;

      case 'focus-loc':
        var id = actionEl.getAttribute('data-loc');
        selectLocation(id, false);
        break;

      case 'bookmark':
        toggleBookmark(actionEl.getAttribute('data-loc'));
        break;

      case 'swap-route':
        var tmp = state.routeFrom; state.routeFrom = state.routeTo; state.routeTo = tmp;
        panels.route.querySelector('[data-role="route-from"]').value = state.routeFrom;
        panels.route.querySelector('[data-role="route-to"]').value = state.routeTo;
        break;

      case 'compute-route':
        computeRoute();
        if (isMobile()) { setTab('route'); setSheet('half'); }
        break;

      case 'clear-route':
        state.route = null;
        renderRouteResults();
        MAP.clearRoute();
        break;

      case 'play-route':
        if (state.route) {
          MAP.showRoute(state.route, true);
          toast('Replaying the route on the map.', 'info');
        }
        break;

      case 'directions-to':
        var destId = actionEl.getAttribute('data-loc');
        state.routeTo = destId;
        panels.route.querySelector('[data-role="route-to"]').value = destId;
        computeRoute();
        if (isMobile()) { setTab('route'); setSheet('half'); }
        break;

      case 'directions-from':
        var startId = actionEl.getAttribute('data-loc');
        state.routeFrom = startId;
        panels.route.querySelector('[data-role="route-from"]').value = startId;
        computeRoute();
        break;

      case 'open-route':
        setTab('route');
        setSheet('half');
        break;

      case 'locate':
        simulateLocate();
        break;

      case 'recenter':
        MAP.fitCampus();
        break;

      case 'zoom-in':
        MAP.zoomIn();
        break;

      case 'zoom-out':
        MAP.zoomOut();
        break;

      case 'faq':
        var idx = parseInt(actionEl.getAttribute('data-index'), 10);
        state.faqOpen = state.faqOpen === idx ? -1 : idx;
        renderEssentials();
        break;

      case 'open-about':
        openModal('about');
        break;

      case 'close-modal':
        closeModal();
        break;

      case 'mock-locate':
        MAP.setMockLocation(actionEl.getAttribute('data-loc'), actionEl.getAttribute('data-label'));
        break;
    }
  }

  function simulateLocate() {
    var gate = DATA.byId('gate');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function () {
        toast('GPS acquired — showing the Main Gate as your position.', 'success');
        MAP.setMockLocation('gate', 'Main Gate (simulated)');
      }, function () {
        toast('Location unavailable on this device — showing the Main Gate (simulated).', 'info');
        MAP.setMockLocation('gate', 'Main Gate (simulated)');
      }, { timeout: 4000 });
    } else {
      MAP.setMockLocation('gate', 'Main Gate (simulated)');
    }
  }

  function onInput(e) {
    var role = e.target.getAttribute && e.target.getAttribute('data-role');
    if (role === 'search-input') {
      state.query = e.target.value;
      renderSearchDropdown();
      renderList();
      return;
    }
    if (role === 'route-from') { state.routeFrom = e.target.value; return; }
    if (role === 'route-to') { state.routeTo = e.target.value; return; }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (document.getElementById('modal').classList.contains('is-open')) { closeModal(); return; }
      toggleDrop(false);
      if (isMobile() && snap !== 'peek') setSheet('peek');
      return;
    }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      e.preventDefault();
      if (els.searchInput) { els.searchInput.focus(); els.searchInput.select(); }
      return;
    }
    if (e.key === 'Enter' && document.activeElement === els.searchInput) {
      var first = els.searchList.querySelector('[data-action="pick-search"]');
      if (first) { e.preventDefault(); first.click(); }
      return;
    }
    if (e.key === 'ArrowDown' && document.activeElement === els.searchInput) {
      var f = els.searchList.querySelector('[data-action="pick-search"]');
      if (f) { e.preventDefault(); f.focus(); }
    }
  }

  /* ================================================================ INIT */
  function init() {
    els.drawer = document.getElementById('drawer');
    els.listDesktop = document.getElementById('slot-list-desktop');
    els.essDesktop = document.getElementById('slot-essentials-desktop');
    els.legend = document.getElementById('legend');
    els.mobileExplore = document.querySelector('[data-pane="explore"]');
    els.mobileEss = document.querySelector('[data-pane="essentials"]');

    panels.search = el(searchHTML());
    panels.segments = el(segmentsHTML());
    panels.chips = el(chipsHTML());
    panels.route = el(routeHTML());

    initSheet();
    mountPanels();

    els.listMobile = document.getElementById('slot-list-mobile');
    els.essMobile = els.mobileEss;

    renderLegend();
    renderFilters();
    renderList();
    renderEssentials();
    renderRouteResults();

    MAP.init();

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onInput);
    document.addEventListener('keydown', onKeyDown);

    document.querySelectorAll('[data-basemap]').forEach(function (b) {
      b.addEventListener('click', function () { MAP.setBasemap(b.getAttribute('data-basemap')); });
    });

    // outside click closes the search dropdown
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.kiu-search')) toggleDrop(false);
    });

    // keep panels in the right place when the viewport changes
    var mq = window.matchMedia('(max-width: 1023px)');
    var onChange = function () {
      mountPanels();
      setSheet(snap);
      updateOffset();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);

    window.addEventListener('resize', function () { updateOffset(); });
    window.addEventListener('orientationchange', function () { setTimeout(updateOffset, 250); });

    // first-visit welcome
    if (!load(LS.seen, false)) {
      save(LS.seen, true);
      setTimeout(function () { openModal('about'); }, 700);
    }
  }

  /* --------------------------------------------------- popup card markup */
  function popupHTML(loc) {
    var c = catOf(loc.category);
    var saved = state.bookmarks.indexOf(loc.id) !== -1;
    var info = (loc.info || []).map(function (r) {
      return '<div class="kiu-pop-row"><dt>' + esc(r.label) + '</dt><dd>' + esc(r.value) + '</dd></div>';
    }).join('');
    return '' +
      '<div class="kiu-pop-card">' +
      '<div class="flex items-start gap-2.5">' +
      '<span class="kiu-loc-ic" style="--c:' + c.color + '">' + icon(loc.icon, 'h-[18px] w-[18px]') + '</span>' +
      '<span class="min-w-0 flex-1">' +
      '<span class="block text-[10.5px] font-extrabold uppercase tracking-[0.14em]" style="color:' + c.color + '">' + esc(c.short) + '</span>' +
      '<span class="block text-[15px] font-extrabold leading-tight mt-0.5 text-ink">' + esc(loc.name) + '</span>' +
      '</span></div>' +
      '<p class="kiu-pop-blurb">' + esc(loc.blurb) + '</p>' +
      (info ? '<dl class="kiu-pop-list">' + info + '</dl>' : '') +
      '<div class="kiu-pop-actions">' +
      '<button type="button" data-action="directions-to" data-loc="' + loc.id + '" class="kiu-pop-btn is-primary">' + icon('i-navigation', 'h-4 w-4') + '<span>Directions</span></button>' +
      '<button type="button" data-action="directions-from" data-loc="' + loc.id + '" class="kiu-pop-btn">' + icon('i-walk', 'h-4 w-4') + '<span>Start here</span></button>' +
      '<button type="button" data-action="bookmark" data-loc="' + loc.id + '" class="kiu-pop-btn' + (saved ? ' is-on' : '') + '" aria-label="Save place">' + icon(saved ? 'i-bookmark-filled' : 'i-bookmark', 'h-4 w-4') + '</button>' +
      '</div>' +
      '</div>';
  }

  window.KIU_APP = {
    state: state,
    init: init,
    select: selectLocation,
    popupHTML: popupHTML,
    toast: toast,
    announce: announce,
    onBasemapChange: function () { }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
