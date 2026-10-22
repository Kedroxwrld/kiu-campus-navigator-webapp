/* ============================================================================
   KIU Campus Navigator — pedestrian routing engine

   Builds a walkable graph from the campus roads + building entrances, then
   answers "how do I walk from A to B?" with a shortest path, real metre
   distances, an estimated walking time and human-readable turn instructions.
   ========================================================================== */

window.KIU_ROUTER = (function () {
  'use strict';

  var DATA = window.KIU_DATA;
  var M_PER_DEG_LAT = DATA.meta.mPerDegLat;
  var COS_LAT = Math.cos((DATA.meta.coordinates.lat * Math.PI) / 180);
  var M_PER_DEG_LNG = M_PER_DEG_LAT * COS_LAT;

  /* ---------------------------------------------------------- projection */
  function toLatLng(pt) {
    return [
      DATA.meta.coordinates.lat + pt.y / M_PER_DEG_LAT,
      DATA.meta.coordinates.lng + pt.x / M_PER_DEG_LNG
    ];
  }

  function toLatLngXY(x, y) {
    return toLatLng({ x: x, y: y });
  }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ============================================================== GRAPH ==
     nodes : { key, x, y, id }
     adj   : { key: [ edge, ... ] }
     edge  : { to, len, roadId, roadName, kind }
     ====================================================================== */
  var G = { nodes: {}, nodeList: [], adj: {}, edges: [] };
  var doorInfo = {}; // locationId -> { nodeKey, viaRoadName, walkwayLen }

  function nodeKey(x, y) {
    return Math.round(x * 10) / 10 + '_' + Math.round(y * 10) / 10;
  }

  function getOrCreateNode(x, y) {
    var k = nodeKey(x, y);
    if (G.nodes[k]) return G.nodes[k];
    // merge nodes that are practically the same point (projection rounding)
    for (var i = 0; i < G.nodeList.length; i++) {
      var n = G.nodeList[i];
      if (Math.abs(n.x - x) < 0.75 && Math.abs(n.y - y) < 0.75) return n;
    }
    var node = { key: k, x: x, y: y };
    G.nodes[k] = node;
    G.nodeList.push(node);
    G.adj[k] = [];
    return node;
  }

  function addEdge(a, b, len, roadId, roadName, kind) {
    if (!a || !b || a.key === b.key) return;
    var edge = { to: b.key, len: len, roadId: roadId, roadName: roadName, kind: kind || 'road' };
    G.edges.push(edge);
    G.adj[a.key].push({ to: b.key, len: len, roadId: roadId, roadName: roadName, kind: kind || 'road' });
    G.adj[b.key].push({ to: a.key, len: len, roadId: roadId, roadName: roadName, kind: kind || 'road' });
  }

  /* ------------------------------------------- segment intersection maths */
  function segIntersection(p1, p2, p3, p4) {
    var d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 1e-9) return null;
    var t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    var u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
    return {
      t: t,
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };
  }

  function projectOnSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) return { t: 0, x: a.x, y: a.y, d: dist(p, a) };
    var t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    var x = a.x + t * dx, y = a.y + t * dy;
    return { t: t, x: x, y: y, d: dist(p, { x: x, y: y }) };
  }

  /* ------------------------------------------------------------- builder */
  function build() {
    G = { nodes: {}, nodeList: [], adj: {}, edges: [] };
    doorInfo = {};

    var roads = DATA.roads;
    var i, j, s, t;

    // splits[roadIdx][segIdx] = [ {t,x,y}, ... ]
    var splits = [];
    for (i = 0; i < roads.length; i++) {
      splits.push([]);
      for (s = 0; s < roads[i].points.length - 1; s++) splits[i].push([]);
    }

    function addSplit(ri, si, t, x, y) {
      var arr = splits[ri][si];
      for (var q = 0; q < arr.length; q++) {
        if (Math.abs(arr[q].t - t) < 1e-6) return;
      }
      arr.push({ t: t, x: x, y: y });
    }

    // 1) road x road intersections
    for (i = 0; i < roads.length; i++) {
      for (j = i + 1; j < roads.length; j++) {
        for (s = 0; s < roads[i].points.length - 1; s++) {
          for (t = 0; t < roads[j].points.length - 1; t++) {
            var a = { x: roads[i].points[s][0], y: roads[i].points[s][1] };
            var b = { x: roads[i].points[s + 1][0], y: roads[i].points[s + 1][1] };
            var c = { x: roads[j].points[t][0], y: roads[j].points[t][1] };
            var d = { x: roads[j].points[t + 1][0], y: roads[j].points[t + 1][1] };
            var hit = segIntersection(a, b, c, d);
            if (hit) {
              addSplit(i, s, hit.t, hit.x, hit.y);
              addSplit(j, t, hit.u, hit.x, hit.y);
            }
          }
        }
      }
    }

    // 2) door projections onto the nearest road segment
    var projections = {};
    DATA.locations.forEach(function (loc) {
      var door = loc.door;
      var best = null;
      for (var ri = 0; ri < roads.length; ri++) {
        for (var si = 0; si < roads[ri].points.length - 1; si++) {
          var a = { x: roads[ri].points[si][0], y: roads[ri].points[si][1] };
          var b = { x: roads[ri].points[si + 1][0], y: roads[ri].points[si + 1][1] };
          var pr = projectOnSegment(door, a, b);
          if (!best || pr.d < best.d) {
            best = { ri: ri, si: si, t: pr.t, x: pr.x, y: pr.y, d: pr.d, road: roads[ri] };
          }
        }
      }
      projections[loc.id] = best;
      addSplit(best.ri, best.si, best.t, best.x, best.y);
    });

    // 3) materialise road nodes + edges
    roads.forEach(function (road, ri) {
      for (var si = 0; si < road.points.length - 1; si++) {
        var a = { x: road.points[si][0], y: road.points[si][1] };
        var b = { x: road.points[si + 1][0], y: road.points[si + 1][1] };
        var pts = [{ t: 0, x: a.x, y: a.y }].concat(
          splits[ri][si].slice().sort(function (p, q) { return p.t - q.t; })
        ).concat([{ t: 1, x: b.x, y: b.y }]);

        var prevNode = null;
        for (var k = 0; k < pts.length; k++) {
          var node = getOrCreateNode(pts[k].x, pts[k].y);
          if (prevNode) {
            var len = dist({ x: prevNode.x, y: prevNode.y }, { x: node.x, y: node.y });
            addEdge(prevNode, node, len, road.id, road.name, road.external ? 'highway' : 'road');
          }
          prevNode = node;
        }
      }
    });

    // 4) door nodes + entrance walkways
    DATA.locations.forEach(function (loc) {
      var proj = projections[loc.id];
      var roadNode = getOrCreateNode(proj.x, proj.y);
      var doorNode = getOrCreateNode(loc.door.x, loc.door.y);
      var walkway = dist(doorNode, roadNode);
      if (doorNode.key !== roadNode.key) {
        addEdge(roadNode, doorNode, walkway, 'walk-' + loc.id, 'entrance walkway', 'walkway');
      }
      doorInfo[loc.id] = {
        nodeKey: doorNode.key,
        roadKey: roadNode.key,
        roadName: proj.road.name,
        walkway: walkway,
        node: doorNode
      };
    });
  }

  /* ------------------------------------------------------------ dijkstra */
  function shortestPath(fromKey, toKey) {
    if (fromKey === toKey) return { nodes: [fromKey], edges: [], distance: 0 };
    var distMap = {}, prev = {}, visited = {}, queue = [];
    G.nodeList.forEach(function (n) { distMap[n.key] = Infinity; });
    distMap[fromKey] = 0;
    queue.push({ key: fromKey, d: 0 });

    while (queue.length) {
      queue.sort(function (a, b) { return a.d - b.d; });
      var cur = queue.shift();
      if (visited[cur.key]) continue;
      visited[cur.key] = true;
      if (cur.key === toKey) break;

      var list = G.adj[cur.key] || [];
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (visited[e.to]) continue;
        var nd = cur.d + e.len;
        if (nd < distMap[e.to]) {
          distMap[e.to] = nd;
          prev[e.to] = { from: cur.key, edge: e };
          queue.push({ key: e.to, d: nd });
        }
      }
    }

    if (distMap[toKey] === Infinity) return null;

    var pathNodes = [toKey], pathEdges = [], k = toKey;
    while (k !== fromKey) {
      var step = prev[k];
      if (!step) return null;
      pathEdges.unshift(step.edge);
      pathNodes.unshift(step.from);
      k = step.from;
    }
    return { nodes: pathNodes, edges: pathEdges, distance: distMap[toKey] };
  }

  /* ----------------------------------------------------- turn-by-turn UI */
  var COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

  function bearing(a, b) {
    var deg = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
    return (deg + 360) % 360;
  }

  function compassOf(deg) {
    return COMPASS[Math.round(deg / 45) % 8];
  }

  function normaliseDelta(d) {
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  }

  function formatDistance(m) {
    if (m < 950) return Math.round(m / 5) * 5 + ' m';
    return (m / 1000).toFixed(1) + ' km';
  }

  function buildSteps(path, startLoc, destLoc) {
    var steps = [];
    var nodes = path.nodes.map(function (k) { return G.nodes[k]; });
    var legs = [];

    // group consecutive edges of the same road into a single leg
    for (var i = 0; i < path.edges.length; i++) {
      var e = path.edges[i];
      var from = nodes[i], to = nodes[i + 1];
      var last = legs[legs.length - 1];
      if (last && last.roadId === e.roadId && last.kind === e.kind) {
        last.len += e.len;
        last.to = to;
      } else {
        legs.push({
          roadId: e.roadId,
          roadName: e.roadName,
          kind: e.kind,
          len: e.len,
          from: from,
          to: to,
          bearing: bearing(from, to)
        });
      }
    }

    var startInfo = doorInfo[startLoc.id];
    var destInfo = doorInfo[destLoc.id];

    legs.forEach(function (leg, idx) {
      var prev = idx > 0 ? legs[idx - 1] : null;
      var isFirst = idx === 0;
      var isLast = idx === legs.length - 1;

      if (leg.kind === 'walkway') {
        if (isFirst) {
          steps.push({
            icon: 'i-door',
            title: 'Leave ' + startLoc.shortName || startLoc.name,
            detail: 'through the ' + (startInfo.roadName || 'entrance') + ' entrance',
            distance: leg.len,
            tone: 'start'
          });
        } else if (isLast) {
          steps.push({
            icon: 'i-walk',
            title: 'Follow the walkway to ' + destLoc.shortName,
            detail: 'entrance off ' + (destInfo.roadName || 'the campus road'),
            distance: leg.len,
            tone: 'walk'
          });
        } else {
          steps.push({
            icon: 'i-walk',
            title: 'Take the entrance walkway',
            detail: 'towards ' + destLoc.shortName,
            distance: leg.len,
            tone: 'walk'
          });
        }
        return;
      }

      if (isFirst) {
        steps.push({
          icon: 'i-walk',
          title: 'Head ' + compassOf(leg.bearing) + ' on ' + leg.roadName,
          detail: '',
          distance: leg.len,
          tone: 'start'
        });
        return;
      }

      var delta = normaliseDelta(leg.bearing - prev.bearing);
      var turn;
      if (delta > 25) turn = 'Turn right onto ' + leg.roadName;
      else if (delta < -25) turn = 'Turn left onto ' + leg.roadName;
      else if (leg.roadId === prev.roadId) turn = 'Continue on ' + leg.roadName;
      else turn = 'Continue onto ' + leg.roadName;

      steps.push({
        icon: delta > 25 ? 'i-arrow-right' : (delta < -25 ? 'i-arrow-left' : 'i-navigation'),
        title: turn,
        detail: 'for ' + formatDistance(leg.len),
        distance: leg.len,
        tone: 'turn'
      });
    });

    steps.push({
      icon: 'i-flag',
      title: 'Arrive at ' + destLoc.shortName,
      detail: destInfo.roadName ? 'entrance off ' + destInfo.roadName : 'campus entrance',
      distance: 0,
      tone: 'arrive'
    });

    return steps;
  }

  /* ---------------------------------------------------------- public API */
  function route(fromId, toId) {
    var startLoc = DATA.byId(fromId);
    var destLoc = DATA.byId(toId);
    if (!startLoc || !destLoc) return null;

    if (fromId === toId) {
      return {
        from: startLoc,
        to: destLoc,
        distance: 0,
        minutes: 0,
        steps: [{
          icon: 'i-flag',
          title: 'You are already at ' + destLoc.shortName,
          detail: 'Nothing to walk — pick another destination.',
          distance: 0,
          tone: 'arrive'
        }],
        path: [],
        same: true
      };
    }

    var a = doorInfo[fromId], b = doorInfo[toId];
    if (!a || !b) return null;
    var path = shortestPath(a.nodeKey, b.nodeKey);
    if (!path) return null;

    var minutes = Math.max(1, Math.round(path.distance / DATA.meta.walkingSpeed / 60));
    var steps = buildSteps(path, startLoc, destLoc);

    var points = path.nodes.map(function (k) {
      var n = G.nodes[k];
      return { x: n.x, y: n.y };
    });
    // finish at the visible marker of the destination building
    points.push({ x: destLoc.mark.x, y: destLoc.mark.y });

    return {
      from: startLoc,
      to: destLoc,
      distance: path.distance,
      minutes: minutes,
      steps: steps,
      path: points,
      same: false
    };
  }

  /* straight-line helper for "as the crow flies" context in the UI */
  function straightLine(fromId, toId) {
    var a = DATA.byId(fromId), b = DATA.byId(toId);
    if (!a || !b) return 0;
    return dist(a.mark, b.mark);
  }

  build();

  return {
    build: build,
    route: route,
    toLatLng: toLatLng,
    toLatLngXY: toLatLngXY,
    straightLine: straightLine,
    formatDistance: formatDistance,
    graph: G,
    doorInfo: doorInfo
  };
})();
