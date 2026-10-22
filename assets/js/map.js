/* ============================================================================
   KIU Campus Navigator — map layer
   Leaflet map + a vector campus plan drawn as SVG, category pins, popups and
   an animated dotted walking route.
   ========================================================================== */

window.KIU_MAP = (function () {
  'use strict';

  var DATA = window.KIU_DATA;
  var ROUTER = window.KIU_ROUTER;

  var map = null;
  var planRenderer = null;
  var routeRenderer = null;
  var markers = {};
  var labelMarkers = {};
  var basemaps = {};
  var currentBasemap = 'plan';
  var groundLayer = null;
  var buildingLayers = [];
  var routeLayers = [];
  var traveler = null;
  var travelerTimer = null;
  var mockLocation = null;
  var selectedId = null;

  /* ------------------------------------------------------------ helpers */
  function rectPoints(r) {
    return [
      { x: r.x1, y: r.y1 }, { x: r.x2, y: r.y1 },
      { x: r.x2, y: r.y2 }, { x: r.x1, y: r.y2 }
    ];
  }

  function roundRectPoints(r) {
    var pts = [], rad = r.radius || 18, n = 7;
    var x1 = r.x1, y1 = r.y1, x2 = r.x2, y2 = r.y2;
    function arc(cx, cy, a0, a1) {
      for (var i = 0; i <= n; i++) {
        var a = a0 + ((a1 - a0) * i) / n;
        pts.push({ x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) });
      }
    }
    arc(x2 - rad, y1 + rad, -Math.PI / 2, 0);
    arc(x2 - rad, y2 - rad, 0, Math.PI / 2);
    arc(x1 + rad, y2 - rad, Math.PI / 2, Math.PI);
    arc(x1 + rad, y1 + rad, Math.PI, Math.PI * 1.5);
    return pts;
  }

  function toLL(points) {
    return points.map(function (p) {
      var x = (p instanceof Array) ? p[0] : p.x;
      var y = (p instanceof Array) ? p[1] : p.y;
      return ROUTER.toLatLng({ x: x, y: y });
    });
  }

  function catOf(id) { return DATA.category(id); }

  /* -------------------------------------------------------------- basemap */
  function addBasemaps() {
    basemaps.plan = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    );
    basemaps.street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    basemaps.satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }
    );
  }

  function setBasemap(id) {
    if (!basemaps[id]) return;
    if (currentBasemap === id) return;
    if (basemaps[currentBasemap]) map.removeLayer(basemaps[currentBasemap]);
    basemaps[id].addTo(map);
    currentBasemap = id;
    map.getContainer().classList.toggle('is-satellite', id === 'satellite');
    if (groundLayer) groundLayer.setStyle({ opacity: id === 'satellite' ? 0.25 : 0.93 });
    buildingLayers.forEach(function (l) {
      if (l.fillOpacity !== undefined) {
        l.setStyle({ fillOpacity: id === 'satellite' ? 0.55 : 0.9 });
      }
    });
    var btns = document.querySelectorAll('[data-basemap]');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-basemap') === id;
      btns[i].classList.toggle('bg-brand-700', on);
      btns[i].classList.toggle('text-white', on);
      btns[i].classList.toggle('text-slate-600', !on);
    }
    if (window.KIU_APP) window.KIU_APP.onBasemapChange(id);
  }

  /* --------------------------------------------------------- campus plan */
  function drawPlan() {
    planRenderer = L.svg({ pane: 'plan', padding: 0.5 });
    routeRenderer = L.svg({ pane: 'route', padding: 0.5 });

    // campus ground
    groundLayer = L.polygon(toLL(roundRectPoints(DATA.boundary)), {
      pane: 'plan',
      renderer: planRenderer,
      color: '#006837',
      weight: 2,
      opacity: 0.32,
      dashArray: '7 8',
      fillColor: '#F1F6F1',
      fillOpacity: 0.93,
      interactive: false
    }).addTo(map);

    // green spaces
    DATA.greens.forEach(function (g) {
      L.polygon(toLL(g.points), {
        pane: 'plan', renderer: planRenderer, interactive: false,
        color: '#B7DCC3', weight: 1, opacity: 0.8,
        fillColor: '#DDEFE3', fillOpacity: 0.95
      }).addTo(map);
    });

    // paved plazas
    DATA.plazas.forEach(function (p) {
      L.polygon(toLL(p.points), {
        pane: 'plan', renderer: planRenderer, interactive: false,
        color: '#D9DED8', weight: 1, opacity: 0.9,
        fillColor: '#EAEDE8', fillOpacity: 0.95
      }).addTo(map);
    });

    // roads
    DATA.roads.forEach(function (r) {
      var pts = toLL(r.points.map(function (p) { return { x: p[0], y: p[1] }; }));
      var wide = r.external;
      L.polyline(pts, {
        pane: 'plan', renderer: planRenderer, interactive: false,
        color: '#C4CFC6', weight: wide ? 20 : 13, opacity: 0.55, lineCap: 'round', lineJoin: 'round'
      }).addTo(map);
      L.polyline(pts, {
        pane: 'plan', renderer: planRenderer, interactive: false,
        color: '#FFFFFF', weight: wide ? 16 : 10, opacity: 0.96, lineCap: 'round', lineJoin: 'round'
      }).addTo(map);
      if (wide) {
        L.polyline(pts, {
          pane: 'plan', renderer: planRenderer, interactive: false,
          color: '#B7C3B8', weight: 1.6, opacity: 0.9, dashArray: '9 13'
        }).addTo(map);
      }
    });

    // building footprints
    DATA.locations.forEach(function (loc) {
      var cat = catOf(loc.category);
      var shadow = {
        x1: loc.rect.x1 + 4, y1: loc.rect.y1 - 4,
        x2: loc.rect.x2 + 4, y2: loc.rect.y2 - 4
      };
      L.polygon(toLL(rectPoints(shadow)), {
        pane: 'plan', renderer: planRenderer, interactive: false,
        color: '#0F172A', weight: 0, opacity: 0,
        fillColor: '#0F172A', fillOpacity: 0.10
      }).addTo(map);

      var body = L.polygon(toLL(rectPoints(loc.rect)), {
        pane: 'plan', renderer: planRenderer, interactive: false,
        color: cat.color, weight: 1.4, opacity: 0.55,
        fillColor: cat.soft, fillOpacity: 0.9
      }).addTo(map);
      buildingLayers.push(body);
    });

    // building labels
    DATA.locations.forEach(function (loc) {
      var icon = L.divIcon({
        className: 'kiu-label-wrap',
        html: '<span class="kiu-plan-label">' + loc.shortName + '</span>',
        iconSize: [160, 18],
        iconAnchor: [80, 9]
      });
      var m = L.marker(ROUTER.toLatLng(loc.mark), {
        pane: 'labels', icon: icon, interactive: false, keyboard: false, opacity: 0
      }).addTo(map);
      labelMarkers[loc.id] = m;
    });
  }

  /* -------------------------------------------------------------- markers */
  function pinIcon(loc, active) {
    var cat = catOf(loc.category);
    return L.divIcon({
      className: 'kiu-pin-wrap',
      html:
        '<span class="kiu-pin' + (active ? ' is-active' : '') + '" style="--c:' + cat.color + '">' +
        '<svg class="kiu-pin-ic"><use href="#i-' + loc.icon.replace('i-', '') + '"/></svg>' +
        '</span>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -18]
    });
  }

  function createMarkers() {
    DATA.locations.forEach(function (loc) {
      var m = L.marker(ROUTER.toLatLng(loc.mark), {
        icon: pinIcon(loc, false),
        riseOnHover: true,
        title: loc.name,
        keyboard: true,
        alt: loc.name
      }).addTo(map);

      m.on('click', function () {
        if (window.KIU_APP) window.KIU_APP.select(loc.id, true);
      });

      markers[loc.id] = m;
    });
  }

  /* --------------------------------------------------------- interactions */
  function setSelected(id) {
    selectedId = id;
    Object.keys(markers).forEach(function (mid) {
      var loc = DATA.byId(mid);
      var active = mid === id;
      markers[mid].setIcon(pinIcon(loc, active));
      var el = markers[mid].getElement();
      if (el) {
        el.classList.toggle('is-selected', active);
        el.setAttribute('aria-label', loc.name + (active ? ' (selected)' : ''));
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
      }
    });
  }

  function dimMarkers(matchIds) {
    Object.keys(markers).forEach(function (mid) {
      var el = markers[mid].getElement();
      if (!el) return;
      if (!matchIds) {
        el.classList.remove('is-dimmed');
        el.style.opacity = '';
      } else {
        var on = matchIds.indexOf(mid) !== -1;
        el.classList.toggle('is-dimmed', !on);
        el.style.opacity = on ? '1' : '0.32';
      }
    });
  }

  function focus(loc, zoom) {
    var target = ROUTER.toLatLng(loc.mark);
    map.flyTo(target, zoom || Math.max(map.getZoom(), 18), { duration: 0.9 });
  }

  function fitCampus() {
    var b = L.latLngBounds(toLL(roundRectPoints(DATA.boundary)));
    map.fitBounds(b, { padding: [40, 40] });
  }

  /* ------------------------------------------------------------- popups */
  function openPopup(loc) {
    var m = markers[loc.id];
    if (!m) return;
    var html = window.KIU_APP ? window.KIU_APP.popupHTML(loc) : '<b>' + loc.name + '</b>';
    m.bindPopup(html, {
      className: 'kiu-popup',
      maxWidth: 320,
      minWidth: 250,
      autoPanPadding: [30, 30],
      offset: [0, -12]
    }).openPopup();
  }

  /* --------------------------------------------------------------- route */
  function clearRoute() {
    routeLayers.forEach(function (l) {
      map.removeLayer(l);
    });
    routeLayers = [];
    if (traveler) { map.removeLayer(traveler); traveler = null; }
    if (travelerTimer) { cancelAnimationFrame(travelerTimer); travelerTimer = null; }
  }

  function showRoute(result, animate) {
    clearRoute();
    if (!result || !result.path || result.path.length < 2) return;

    var latlngs = result.path.map(function (p) { return ROUTER.toLatLng(p); });

    var casing = L.polyline(latlngs, {
      pane: 'route', renderer: routeRenderer, interactive: false,
      color: '#FFFFFF', weight: 11, opacity: 0.95, lineCap: 'round', lineJoin: 'round'
    }).addTo(map);

    var line = L.polyline(latlngs, {
      pane: 'route', renderer: routeRenderer, interactive: false,
      color: '#006837', weight: 5.5, opacity: 0.98,
      lineCap: 'round', lineJoin: 'round', className: 'kiu-route-dash'
    }).addTo(map);

    routeLayers.push(casing, line);

    // start / end flags
    var startIcon = L.divIcon({
      className: 'kiu-pin-wrap',
      html: '<span class="kiu-route-pin is-start"><svg class="kiu-pin-ic"><use href="#i-flag"/></svg></span>',
      iconSize: [28, 28], iconAnchor: [14, 14]
    });
    var endIcon = L.divIcon({
      className: 'kiu-pin-wrap',
      html: '<span class="kiu-route-pin is-end"><svg class="kiu-pin-ic"><use href="#i-pin"/></svg></span>',
      iconSize: [28, 28], iconAnchor: [14, 14]
    });
    var s = L.marker(latlngs[0], { icon: startIcon, interactive: false, zIndexOffset: 500 }).addTo(map);
    var e = L.marker(latlngs[latlngs.length - 1], { icon: endIcon, interactive: false, zIndexOffset: 500 }).addTo(map);
    routeLayers.push(s, e);

    var bounds = L.latLngBounds(latlngs).pad(0.25);
    map.flyToBounds(bounds, { padding: [70, 70], duration: 1, maxZoom: 18 });

    if (animate !== false) animateTraveler(result.path);
  }

  function animateTraveler(pathPoints) {
    if (traveler) { map.removeLayer(traveler); traveler = null; }
    var icon = L.divIcon({
      className: 'kiu-pin-wrap',
      html: '<span class="kiu-traveler"></span>',
      iconSize: [22, 22], iconAnchor: [11, 11]
    });
    traveler = L.marker(ROUTER.toLatLng(pathPoints[0]), { icon: icon, interactive: false, zIndexOffset: 800 }).addTo(map);

    // cumulative distances in local metres
    var cum = [0], total = 0;
    for (var i = 1; i < pathPoints.length; i++) {
      var dx = pathPoints[i].x - pathPoints[i - 1].x;
      var dy = pathPoints[i].y - pathPoints[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
      cum.push(total);
    }
    if (total <= 0) return;

    var duration = Math.min(11000, Math.max(3200, total * 14));
    var startTime = null;

    function frame(ts) {
      if (!startTime) startTime = ts;
      var t = Math.min(1, (ts - startTime) / duration);
      var eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
      var target = eased * total;
      var seg = 1;
      while (seg < cum.length - 1 && cum[seg] < target) seg++;
      var prev = cum[seg - 1], span = cum[seg] - prev || 1;
      var f = (target - prev) / span;
      var a = pathPoints[seg - 1], b = pathPoints[seg];
      var pt = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      traveler.setLatLng(ROUTER.toLatLng(pt));
      if (t < 1) {
        travelerTimer = requestAnimationFrame(frame);
      } else {
        traveler.getElement() && traveler.getElement().classList.add('is-arrived');
      }
    }
    travelerTimer = requestAnimationFrame(frame);
  }

  /* ----------------------------------------------------- mock geolocation */
  function setMockLocation(locId, label) {
    if (mockLocation) { map.removeLayer(mockLocation); mockLocation = null; }
    if (!locId) return;
    var loc = DATA.byId(locId);
    var icon = L.divIcon({
      className: 'kiu-pin-wrap',
      html: '<span class="kiu-me"><span class="kiu-me-pulse"></span><span class="kiu-me-dot"></span></span>',
      iconSize: [28, 28], iconAnchor: [14, 14]
    });
    mockLocation = L.marker(ROUTER.toLatLng(loc.mark), { icon: icon, interactive: false, zIndexOffset: 900 }).addTo(map);
    map.flyTo(ROUTER.toLatLng(loc.mark), 18, { duration: 0.9 });
    if (window.KIU_APP) {
      window.KIU_APP.toast('Simulated position: ' + (label || loc.name), 'info');
    }
  }

  /* ------------------------------------------------------------- controls */
  function zoomIn() { map.zoomIn(); }
  function zoomOut() { map.zoomOut(); }

  function zoomLabel() {
    return map.getZoom();
  }

  function onZoomEnd() {
    var z = map.getZoom();
    var show = z >= 17;
    Object.keys(labelMarkers).forEach(function (k) {
      var el = labelMarkers[k].getElement();
      if (el) el.style.opacity = show ? '1' : '0';
    });
  }

  /* ----------------------------------------------------------------- init */
  function init() {
    var centre = ROUTER.toLatLng({ x: 0, y: 0 });

    map = L.map('map', {
      center: centre,
      zoom: 17,
      minZoom: 15,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
      tap: true,
      inertia: true,
      worldCopyJump: false
    });

    map.createPane('plan');
    map.getPane('plan').style.zIndex = 380;
    map.createPane('labels');
    map.getPane('labels').style.zIndex = 410;
    map.createPane('route');
    map.getPane('route').style.zIndex = 450;

    addBasemaps();
    basemaps.plan.addTo(map);
    currentBasemap = 'plan';

    drawPlan();
    createMarkers();
    fitCampus();
    map.on('zoomend', onZoomEnd);
    onZoomEnd();

    // gentle "welcome" drift so the map feels alive on load
    setTimeout(function () {
      if (!window.KIU_APP || !window.KIU_APP.state.route) {
        map.panBy([0, 60], { animate: true, duration: 1.1 });
      }
    }, 900);

    return map;
  }

  return {
    init: init,
    get map() { return map; },
    markers: markers,
    setBasemap: setBasemap,
    setSelected: setSelected,
    dimMarkers: dimMarkers,
    focus: focus,
    fitCampus: fitCampus,
    openPopup: openPopup,
    showRoute: showRoute,
    clearRoute: clearRoute,
    animateTraveler: animateTraveler,
    setMockLocation: setMockLocation,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    zoomLevel: zoomLabel
  };
})();
