#!/usr/bin/env node
/**
 * tools/build-map.js
 *
 * Builds assets/map-tiers.svg from tools/data/batch8-tiers.csv plus the three
 * OpenDataDE tri-state ZCTA GeoJSON files, then injects the same SVG markup
 * into index.html between the <!-- MAP_SVG:START/END --> markers so the page
 * carries the map inline (needed for CSS hover/JS tooltip access into the
 * SVG's own paths -- an <img> can't be reached that way, and fetch() of a
 * local file fails under file:// with no server). Re-running this script
 * regenerates both the standalone asset and the inlined copy from one source
 * of truth, so they can't drift apart.
 *
 * Node stdlib only: fs, path. No npm install, per this repo's no-build-step
 * rule.
 *
 * ---- Why the source GeoJSON isn't shipped in the repo ----
 * The three input files total ~95MB (4,187 polygons / 4.3M coordinates) --
 * full-state ZCTA boundaries, not just the tri-state scoring footprint. That
 * is committed nowhere; only this script, the CSV, and the built SVG are.
 * See tools/data/.gitignore.
 *
 * ---- Method ----
 * 1. Load batch8-tiers.csv (zip -> tier/score).
 * 2. Load the 3 GeoJSON files, keep only features whose ZCTA5CE10 falls in
 *    the same tri-state prefix range score_zips.py scores (NJ 07/08, NY
 *    10/11, PA 19 excluding 197-199 DE-adjacent). This is both the
 *    geographically correct choice (SpotWise's whole coverage area is this
 *    NYC-to-Philadelphia corridor, not "all of New York State") and most of
 *    the file-size win: it drops ~85-90% of NY/PA's polygons before any
 *    simplification runs.
 * 3. Project lon/lat to a flat pixel space (equirectangular, centered at the
 *    mean latitude of the in-scope area -- the region is small enough that a
 *    single cosine correction is a fine approximation for a choropleth
 *    inset, not a navigational map).
 * 4. Simplify every scored ZIP's ring with Douglas-Peucker in that projected
 *    space, drop rings below a tiny area threshold, round to 1 decimal.
 * 5. Emit one <path> per scored ZIP (data-zip/data-tier/data-score, class
 *    "zip tier-<tier>"). Unscored tri-state land is no longer drawn (removed
 *    2026-09-23, final paper polish) -- the base layer is now the three full
 *    state outlines (tools/data/us-states.json, PublicaMundi/MappingAPI),
 *    projected into the same frame, so the map reads as NJ/NY/PA rather
 *    than context shapes with no label. See the "state outline base layer"
 *    block below for the crop-vs-full-state decision and its fallback.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const OUT_SVG = path.join(ROOT, 'assets', 'map-tiers.svg');
const INDEX_HTML = path.join(ROOT, 'index.html');

// ---- state outline base layer (added 2026-09-23, final paper polish) -----
// Public US states GeoJSON (PublicaMundi/MappingAPI), fetched once with curl
// into tools/data/us-states.json (gitignored alongside the ZCTA source
// files -- see tools/data/.gitignore note in the repo root .gitignore).
// Fallback per the task spec if that URL/the folium mirror are both
// unreachable: build state silhouettes from the union-by-fill of all ZIP
// polygons per state instead. Not implemented here because the primary
// source was reachable -- see the dev report for the fetch confirmation.
const STATES_FILE = path.join(DATA_DIR, 'us-states.json');
const STATE_NAMES = ['New Jersey', 'New York', 'Pennsylvania'];

// ---- tunables -----------------------------------------------------------
// Douglas-Peucker epsilon, in projected px (see TARGET_WIDTH below for what
// a "px" is here). Tuned empirically against the ~1.5MB budget -- see the
// dev report for the sizes each pass produced.
const SCORED_TOLERANCE = 0.25;
const MIN_RING_AREA = 3; // px^2 in projected space; smaller rings are dropped
const TARGET_WIDTH = 900; // projected-space width budget, arbitrary units
const ROUND_DECIMALS = 1;

// ---- tri-state scoring filter (mirrors CLAUDE.md's "Tri-State Zip Filter"
// in the retail-investment-dashboard repo: NJ 07x/08x, NY 10x/11x, PA 19x
// excluding 197/198/199) ----
function inTriState(zip) {
  return /^(07|08)/.test(zip) || /^(10|11)/.test(zip) || (/^19/.test(zip) && !/^19[789]/.test(zip));
}

// ---- tiny quote-aware CSV parser (no external deps) ----------------------
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function loadTiers() {
  const text = fs.readFileSync(path.join(DATA_DIR, 'batch8-tiers.csv'), 'utf8');
  const rows = parseCSV(text);
  const header = rows[0];
  const idx = {};
  header.forEach((h, i) => { idx[h.trim()] = i; });
  const map = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[idx.zip]) continue;
    const zip = r[idx.zip].trim();
    map.set(zip, { tier: r[idx.tier].trim(), score: r[idx.score].trim() });
  }
  return map;
}

// ---- geometry helpers ------------------------------------------------------
function ringArea(ring) { // shoelace, in projected coords
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a) / 2;
}

function perpDist(pt, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(pt[0] - a[0], pt[1] - a[1]);
  const t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const px = a[0] + t * dx, py = a[1] + t * dy;
  return Math.hypot(pt[0] - px, pt[1] - py);
}

function douglasPeucker(points, epsilon) {
  if (points.length < 3) return points.slice();
  let maxD = -1, idx = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpDist(points[i], points[0], points[end]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > epsilon) {
    const left = douglasPeucker(points.slice(0, idx + 1), epsilon);
    const right = douglasPeucker(points.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[end]];
}

// Closed-ring simplification: pick the point farthest from ring[0] as a
// second anchor (rather than running DP on a ring where point 0 and the
// last point are the same coordinate, which degenerates badly), simplify
// each half, then splice back together and re-close.
function simplifyRing(ring, epsilon) {
  if (ring.length <= 4) return ring;
  let maxD = -1, kIdx = 1;
  for (let i = 1; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > maxD) { maxD = d; kIdx = i; }
  }
  const arc1 = douglasPeucker(ring.slice(0, kIdx + 1), epsilon);
  const arc2 = douglasPeucker(ring.slice(kIdx), epsilon);
  const merged = arc1.slice(0, -1).concat(arc2);
  if (merged.length > 1) merged[merged.length - 1] = merged[0].slice();
  return merged;
}

function round(n) {
  const f = Math.pow(10, ROUND_DECIMALS);
  return Math.round(n * f) / f;
}

function ringToPath(ring) {
  let d = '';
  for (let i = 0; i < ring.length; i++) {
    d += (i === 0 ? 'M' : 'L') + round(ring[i][0]) + ',' + round(ring[i][1]) + ' ';
  }
  return d + 'Z';
}

function geometryToPolys(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

// ---- main -----------------------------------------------------------------
function main() {
  const tiers = loadTiers();
  console.log('[build-map] Loaded', tiers.size, 'scored zips from CSV');

  const files = [
    'nj_new_jersey_zip_codes_geo.min.json',
    'ny_new_york_zip_codes_geo.min.json',
    'pa_pennsylvania_zip_codes_geo.min.json',
  ];

  // Pass 1: collect in-scope raw features (tri-state prefix only) + bbox.
  let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
  const rawFeatures = [];
  for (const file of files) {
    const full = path.join(DATA_DIR, file);
    if (!fs.existsSync(full)) {
      console.error('[build-map] Missing input file:', full);
      process.exit(1);
    }
    const j = JSON.parse(fs.readFileSync(full, 'utf8'));
    let kept = 0;
    for (const f of j.features) {
      const zip = f.properties && f.properties.ZCTA5CE10;
      if (!zip || !inTriState(zip)) continue;
      const polys = geometryToPolys(f.geometry);
      if (!polys.length) continue;
      rawFeatures.push({ zip, polys });
      kept++;
      for (const poly of polys) for (const ring of poly) for (const c of ring) {
        const lon = c[0], lat = c[1];
        if (lon < lonMin) lonMin = lon;
        if (lon > lonMax) lonMax = lon;
        if (lat < latMin) latMin = lat;
        if (lat > latMax) latMax = lat;
      }
    }
    console.log('[build-map]', file, '-> total', j.features.length, 'in-scope', kept);
  }
  console.log('[build-map] In-scope features total:', rawFeatures.length);
  console.log('[build-map] Lon/lat bbox:', lonMin.toFixed(3), lonMax.toFixed(3), latMin.toFixed(3), latMax.toFixed(3));

  const latMid = (latMin + latMax) / 2;
  const cosLat = Math.cos((latMid * Math.PI) / 180);
  const K = TARGET_WIDTH / ((lonMax - lonMin) * cosLat);
  const project = (c) => [(c[0] - lonMin) * cosLat * K, (latMax - c[1]) * K];
  const width = (lonMax - lonMin) * cosLat * K;
  const height = (latMax - latMin) * K;

  const scoredPaths = [];
  const drawnZips = new Set();
  const renderedTierCounts = {};

  // ---- 08032, 08739, 11249, 19481: scored zips with NO polygon in either
  // source ZCTA file (verified via the "Missing geometry for" log line
  // below, unchanged by this map-base-layer change). They are simply
  // absent from the drawing -- there is no shape to draw -- while the
  // caption/copy everywhere else keeps the true scored count, 1,213. Per
  // Sameer 2026-09-23: 08032 (NJ, Pass), 08739 (NJ, Momentum),
  // 11249 (NY, Pass), 19481 (PA, Momentum).
  const KNOWN_MISSING_GEOMETRY = ['08032', '08739', '11249', '19481'];

  for (const { zip, polys } of rawFeatures) {
    const scored = tiers.get(zip);
    if (!scored) continue; // unscored land no longer drawn -- see state outlines below
    const tolerance = SCORED_TOLERANCE;
    const ringPaths = [];

    for (const poly of polys) {
      poly.forEach((ring, ringIdx) => {
        const projected = ring.map(project);
        const isOuterOfScored = ringIdx === 0;
        let simplified = simplifyRing(projected, tolerance);

        if (isOuterOfScored) {
          // A scored zip's own outer ring is the product's data and must
          // never be dropped. Some real shapes (e.g. Roosevelt Island,
          // Battery Park City -- long/thin or small relative to the chosen
          // tolerance) simplify all the way down to a degenerate 2-point
          // line at the standard tolerance. Back off geometrically until a
          // real ring survives, falling back to the untouched (just
          // projected + rounded) ring if it still doesn't -- never to an
          // empty/absent path.
          let backoff = tolerance, tries = 0;
          while (simplified.length < 4 && tries < 6) {
            backoff = backoff / 4;
            simplified = simplifyRing(projected, backoff);
            tries++;
          }
          if (simplified.length < 4) simplified = projected;
        }

        if (simplified.length < 4) return; // degenerate, and not a scored outer ring
        const area = ringArea(simplified);
        // Only prune tiny holes and tiny unscored slivers/islands.
        if (!isOuterOfScored && area < MIN_RING_AREA) return;
        ringPaths.push(ringToPath(simplified));
      });
    }
    if (!ringPaths.length) continue;
    const d = ringPaths.join(' ');

    drawnZips.add(zip);
    const tierClass = scored.tier.toLowerCase();
    renderedTierCounts[scored.tier] = (renderedTierCounts[scored.tier] || 0) + 1;
    scoredPaths.push(
      '<path class="zip tier-' + tierClass + '" data-zip="' + zip +
      '" data-tier="' + scored.tier + '" data-score="' + scored.score + '" d="' + d + '"/>'
    );
  }

  const missing = [...tiers.keys()].filter((z) => !drawnZips.has(z)).sort();
  console.log('[build-map] Scored zips drawn:', drawnZips.size, '/', tiers.size);
  console.log('[build-map] Missing geometry for (' + missing.length + '):', missing.join(', '));
  console.log('[build-map] Rendered tier counts:', JSON.stringify(renderedTierCounts));
  const missingMismatch = missing.length !== KNOWN_MISSING_GEOMETRY.length ||
    !missing.every((z) => KNOWN_MISSING_GEOMETRY.includes(z));
  if (missingMismatch) {
    console.warn('[build-map] WARNING: missing-geometry list no longer matches the documented four zips (' +
      KNOWN_MISSING_GEOMETRY.join(', ') + ') -- update the KNOWN_MISSING_GEOMETRY comment above.');
  }

  // ---- state outline base layer --------------------------------------
  let stateOutlinePaths = [];
  if (fs.existsSync(STATES_FILE)) {
    const statesJson = JSON.parse(fs.readFileSync(STATES_FILE, 'utf8'));
    for (const stateName of STATE_NAMES) {
      const feature = statesJson.features.find((f) => f.properties && f.properties.name === stateName);
      if (!feature) {
        console.warn('[build-map] WARNING: state outline not found for', stateName);
        continue;
      }
      const polys = geometryToPolys(feature.geometry);
      const ringPaths = [];
      for (const poly of polys) {
        for (const ring of poly) {
          // Source is already coarse (32-68 pts/state) -- project + round,
          // no Douglas-Peucker needed. Points outside the tri-state viewBox
          // (the corridor bbox, see the crop-vs-full-state note in the dev
          // report) are left as-is; the SVG viewBox clips them, so only the
          // full NJ outline plus the parts of NY/PA inside the corridor
          // actually render.
          const projected = ring.map(project);
          ringPaths.push(ringToPath(projected));
        }
      }
      if (ringPaths.length) {
        stateOutlinePaths.push(
          '<path class="state-outline" data-state="' + stateName + '" d="' + ringPaths.join(' ') + '"/>'
        );
      }
    }
    console.log('[build-map] State outlines drawn:', stateOutlinePaths.length, '/', STATE_NAMES.length);
  } else {
    console.error('[build-map] Missing state outline source:', STATES_FILE,
      '-- base layer will be skipped. See tools/build-map.js header for the fetch/fallback plan.');
  }

  const svg =
    '<svg viewBox="0 0 ' + round(width) + ' ' + round(height) + '" ' +
    'xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="map-tiers-title">\n' +
    '<title id="map-tiers-title">Tri-state ZIP codes colored by SpotWise momentum tier</title>\n' +
    '<g class="map-states">\n' + stateOutlinePaths.join('\n') + '\n</g>\n' +
    '<g class="map-scored">\n' + scoredPaths.join('\n') + '\n</g>\n' +
    '</svg>\n';

  fs.mkdirSync(path.dirname(OUT_SVG), { recursive: true });
  fs.writeFileSync(OUT_SVG, svg, 'utf8');
  const bytes = fs.statSync(OUT_SVG).size;
  console.log('[build-map] Wrote', OUT_SVG, '(' + (bytes / 1024 / 1024).toFixed(3) + ' MB)');

  // Inject the same markup into index.html between the marker comments, so
  // the page carries it inline (see file header for why: hover/tooltip need
  // DOM access into the SVG's own paths).
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const startMarker = '<!-- MAP_SVG:START -->';
  const endMarker = '<!-- MAP_SVG:END -->';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    console.error('[build-map] Could not find MAP_SVG markers in index.html -- not injected.');
    process.exit(1);
  }
  const newHtml =
    html.slice(0, startIdx + startMarker.length) +
    '\n' + svg +
    html.slice(endIdx);
  fs.writeFileSync(INDEX_HTML, newHtml, 'utf8');
  console.log('[build-map] Injected SVG into index.html between MAP_SVG markers.');

  if (bytes > 1.5 * 1024 * 1024) {
    console.warn('[build-map] WARNING: SVG is over the ~1.5MB budget. Increase SCORED_TOLERANCE and re-run.');
  }
}

main();
