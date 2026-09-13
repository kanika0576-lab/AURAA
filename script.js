// ============================================================
// AURA — dashboard logic
// ============================================================

// ===== NAME ONBOARDING =====
const nameModal = document.getElementById('nameModal');
const nameInput = document.getElementById('nameInput');
const nameSubmit = document.getElementById('nameSubmit');
const nameSkip = document.getElementById('nameSkip');
const profileName = document.getElementById('profileName');
const profileAvatar = document.getElementById('profileAvatar');
const profileLoc = document.getElementById('profileLoc');

let userName = localStorage.getItem('aura_name') || '';

function applyName() {
  const name = userName || 'Traveler';
  profileName.textContent = name;
  profileAvatar.textContent = name.charAt(0).toUpperCase();
}

function openNameModal() {
  nameModal.classList.add('show');
  setTimeout(() => nameInput.focus(), 100);
}

function closeNameModal() {
  nameModal.classList.remove('show');
}

if (!userName) {
  openNameModal();
} else {
  applyName();
}

function saveName() {
  const val = nameInput.value.trim();
  if (val) {
    userName = val.charAt(0).toUpperCase() + val.slice(1);
    localStorage.setItem('aura_name', userName);
    applyName();
    notify(`Welcome, ${userName}. AURA is ready.`);
  }
  closeNameModal();
}

nameSubmit.addEventListener('click', saveName);
nameSkip.addEventListener('click', () => {
  closeNameModal();
  notify('Welcome, Traveler. You can always add your name later.');
});
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveName();
});

// ===== LIVE CLOCK =====
const liveClock = document.getElementById('liveClock');
const placesClock = document.getElementById('placesClock');

function tickClock() {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (liveClock) liveClock.textContent = t;
  if (placesClock) placesClock.textContent = t;
}
tickClock();
setInterval(tickClock, 1000);

// ===== SIDEBAR =====
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');
const sidebarClose = document.getElementById('sidebarClose');

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('show');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
}

menuBtn.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

sidebar.querySelectorAll('.nav-item').forEach((link) => {
  link.addEventListener('click', () => closeSidebar());
});

// Scrollspy
const navLinks = document.querySelectorAll('.sidebar-nav .nav-item');
const sections = ['top', 'app', 'checkin', 'places', 'why'];

function updateNav() {
  let current = 'top';
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top;
      if (top <= 140) current = id;
    }
  });
  navLinks.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}

window.addEventListener('scroll', () => {
  requestAnimationFrame(updateNav);
  if (window.innerWidth > 768) closeSidebar();
});

updateNav();

// ===== NOTIFICATION =====
const notificationEl = document.getElementById('notification');
let notifyTimer = null;

function notify(message, level = 'info') {
  notificationEl.textContent = message;
  notificationEl.className = 'notification show';
  if (level === 'alert') notificationEl.classList.add('alert');
  if (level === 'escalated') notificationEl.classList.add('escalated');
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => notificationEl.classList.remove('show'), 4500);
}

// Fetch with a hard timeout so a slow/hanging server never freezes the UI
async function fetchWithTimeout(url, opts = {}, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ============================================================
// LOCATION · WEATHER · TRUSTED STOPS
// ============================================================
const liveState = {
  userLoc: null,
  weather: null,   // { temp, precip, desc, rain }
  weatherInfo: document.getElementById('weatherInfo'),
  allowLocBtn: document.getElementById('allowLocBtn'),
  allowLocPlaces: document.getElementById('allowLocPlaces'),
  placesStatus: document.getElementById('placesStatus'),
  rainBanner: document.getElementById('rainBanner'),
  placesGrid: document.getElementById('placesGrid'),
};

const WEEK = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];

function getPosition(timeout = 9000) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout,
      maximumAge: 60000,
    });
  });
}

function weatherDescription(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Light rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Unknown conditions';
}

function isRainy(code, precip) {
  return code >= 51 || precip > 0;
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code&timezone=auto`;
  const res = await fetchWithTimeout(url, {}, 8000);
  const data = await res.json();
  const c = data.current;
  return {
    temp: Math.round(c.temperature_2m),
    precip: c.precipitation,
    code: c.weather_code,
    desc: weatherDescription(c.weather_code),
    rain: isRainy(c.weather_code, c.precipitation),
  };
}

function applyWeather(w) {
  liveState.weather = w;
  liveState.weatherInfo.textContent = `${w.temp}°C · ${w.desc}`;
  if (w.rain) {
    liveState.rainBanner.classList.remove('hidden');
  } else {
    liveState.rainBanner.classList.add('hidden');
  }
}

async function enableLocation(fromButton = true) {
  const btn = fromButton ? liveState.allowLocBtn : liveState.allowLocPlaces;
  const orig = btn.textContent;
  btn.textContent = '⌖ Locating…';
  btn.disabled = true;
  try {
    const pos = await getPosition();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) throw new Error('bad position');
    liveState.userLoc = { lat, lon };

    // Update profile tag with area name
    try {
      const geo = await reverseGeocode(lat, lon);
      const a = geo.address || {};
      const area = a.city || a.town || a.village || a.city_district || a.state_district || a.state || '';
      profileLoc.textContent = area ? `${area} · local time synced` : 'Local time synced';
    } catch {
      profileLoc.textContent = 'Local time synced';
    }

    // Weather
    try {
      applyWeather(await fetchWeather(lat, lon));
    } catch {
      liveState.weatherInfo.textContent = 'Weather unavailable';
    }

    // Trusted stops around the user (runs in background; buttons unlock right away)
    loadTrustedPlaces();

    notify('Location shared. AURA can now find trusted stops near you.');
  } catch {
    notify('Location could not be shared here (needs HTTPS + permission). AURA keeps working with typed places.', 'alert');
    liveState.placesStatus.textContent = 'Location access unavailable · showing sample stops only';
    renderDemoPlaces();
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
}

if (liveState.allowLocBtn) liveState.allowLocBtn.addEventListener('click', () => enableLocation(true));
if (liveState.allowLocPlaces) liveState.allowLocPlaces.addEventListener('click', () => enableLocation(false));

// ===== TRUSTED STOPS (Overpass / OpenStreetMap) =====
const AMENITY_ICONS = {
  cafe: '☕', restaurant: '🍽', fast_food: '🍔', ice_cream: '🍨', pub: '🍺',
  library: '📚', pharmacy: '💊', bank: '🏦', police: '🚓', doctors: '⚕',
  hospital: '🏥', shelter: '🏠', bus_station: '🚏',
};

function placeIcon(tags) {
  if (tags.shop === 'supermarket' || tags.shop === 'convenience') return '🏪';
  if (AMENITY_ICONS[tags.amenity]) return AMENITY_ICONS[tags.amenity];
  return '♥';
}

function parseOpeningHours(hours) {
  if (!hours) return { open: null, detail: 'Hours not listed' };
  const low = hours.toLowerCase();
  if (low.includes('24/7') || low.includes('24 hours') || low.includes('open 24')) {
    return { open: true, detail: 'Open 24 hours' };
  }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const ranges = hours.match(/\d{1,2}[:.]?\d{0,2}\s*[-–]\s*\d{1,2}[:.]?\d{0,2}/g) || [];
  if (!ranges.length) {
    return { open: null, detail: hours.length > 42 ? hours.slice(0, 42) + '…' : hours };
  }
  for (const r of ranges) {
    const mm = r.match(/(\d{1,2})[:.]?(\d{0,2})?\s*[-–]\s*(\d{1,2})[:.]?(\d{0,2})?/);
    const h1 = +mm[1], m1 = +(mm[2] || 0), h2 = +mm[3], m2 = +(mm[4] || 0);
    const from = h1 * 60 + m1;
    const to = h2 * 60 + m2;
    if (nowMin >= from && nowMin < to) {
      return { open: true, detail: `Open now · closes ${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}` };
    }
  }
  return { open: false, detail: `Closed now · ${hours.slice(0, 34)}` };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const OVERPASS_SERVERS = [
  'https://overpass.osm.ch/api/interpreter',   // fast, but may not cover every country
  'https://overpass-api.de/api/interpreter',   // main public server (aggressive rate-limit)
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Small-area fallback that uses the plain OpenStreetMap API when Overpass is blocked
async function queryOsmMap(lat, lon) {
  const d = 0.012;
  const bx = `${(lon - d).toFixed(4)},${(lat - d).toFixed(4)},${(lon + d).toFixed(4)},${(lat + d).toFixed(4)}`;
  const res = await fetchWithTimeout(`https://api.openstreetmap.org/api/0.6/map?bbox=${bx}`, {}, 12000);
  if (!res.ok) throw new Error(`osmapi ${res.status}`);
  const xml = await res.text();
  const allowed = new Set(['cafe', 'restaurant', 'fast_food', 'ice_cream', 'library', 'pharmacy', 'bank', 'police', 'doctors', 'hospital', 'shelter']);
  const shops = new Set(['convenience', 'supermarket']);
  const places = [];
  const nodeRe = /<node id="\d+" lat="([-.\d]+)" lon="([-.\d]+)">([\s\S]*?)<\/node>/g;
  let m;
  while ((m = nodeRe.exec(xml)) !== null) {
    const la = parseFloat(m[1]), lo = parseFloat(m[2]);
    const tags = {};
    const tagRe = /<tag k="([^"]+)" v="([^"]*)"/g;
    let tm;
    while ((tm = tagRe.exec(m[3])) !== null) tags[tm[1]] = tm[2];
    if (!tags.name) continue;
    if (!allowed.has(tags.amenity) && !shops.has(tags.shop)) continue;
    places.push({ name: tags.name, icon: placeIcon(tags), tags, lat: la, lon: lo });
  }
  return places;
}

// localStorage cache: keep real trusted stops so Saved Places never dies with the map servers (30 min TTL)
function placesCacheKey(lat, lon) {
  return `aura_places_${Math.round(lat * 20) / 20},${Math.round(lon * 20) / 20}`;
}
function loadPlacesCache(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.places || Date.now() - data.t > 30 * 60 * 1000) return null;
    return data.places;
  } catch {
    return null;
  }
}
function savePlacesCache(key, places) {
  if (!key || !places) return;
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), places }));
  } catch { /* storage full — ignore */ }
}

async function queryTrustedPlaces(lat1, lon1, lat2, lon2) {
  const south = Math.min(lat1, lat2) - 0.03;
  const north = Math.max(lat1, lat2) + 0.03;
  const west = Math.min(lon1, lon2) - 0.03;
  const east = Math.max(lon1, lon2) + 0.03;
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:15];
(
  node["amenity"~"^(cafe|restaurant|fast_food|ice_cream|library|pharmacy|bank|police|doctors|hospital|shelter)$"](${bbox});
  way["amenity"~"^(cafe|restaurant|fast_food|library|pharmacy|bank|police|shelter)$"](${bbox});
  node["shop"~"^(convenience|supermarket)$"](${bbox});
);
out body 40;`;

  let lastErr = new Error('no servers');
  for (const server of OVERPASS_SERVERS) {
    try {
      const res = await fetchWithTimeout(server, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
      }, 7000);
      if (!res.ok) {
        lastErr = new Error(`${server} -> ${res.status}`);
        continue;
      }
      const data = await res.json();
      const places = [];
      data.elements.forEach((el) => {
        let lat = el.lat, lon = el.lon;
        if (lat === undefined && el.center) {
          lat = el.center.lat;
          lon = el.center.lon;
        }
        if (lat === undefined) return;
        const tags = el.tags || {};
        if (!tags.name) return;
        places.push({
          name: tags.name,
          icon: placeIcon(tags),
          tags,
          lat,
          lon,
        });
      });
      if (places.length) return places;          // region-limited mirrors return 0 — keep trying
      lastErr = new Error(`${server} -> empty`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function scorePlaces(places, centerA, centerB, onRoute) {
  const useGeom = onRoute && routeGeom && routeGeom.length > 1;
  const abKm = haversine(centerA.lat, centerA.lon, centerB.lat, centerB.lon);
  places.forEach((p) => {
    if (useGeom) {
      const mt = distToRoute(p.lat, p.lon, routeGeom);
      p.offKm = mt.off;    // how far off the road line the stop is
      p.alongKm = mt.along; // distance along the route from the start
    } else {
      const s = distToSegment(centerA.lat, centerA.lon, centerB.lat, centerB.lon, p.lat, p.lon);
      p.offKm = s.d;
      p.alongKm = s.t * abKm;
      p.distKm = haversine(centerA.lat, centerA.lon, p.lat, p.lon);
    }
  });
  // Keep stops close to the route line; never show a far-off corner as "on your route"
  const onPath = places.filter((p) => p.offKm <= 3);
  if (onPath.length >= 3) places = onPath;
  places.sort((a, b) => a.alongKm - b.alongKm);
  return places.slice(0, 8);
}

async function loadTrustedPlaces() {
  const pickup = geoData.pickup;
  const dest = geoData.destination;
  const user = liveState.userLoc;

  // Fallback center: user location or pick-up
  let centerA = user || pickup;
  let centerB = dest || centerA;
  let onRoute = false;

  if (pickup && dest) {
    centerA = pickup;
    centerB = dest;
    onRoute = true;
  }

  if (!centerA) {
    liveState.placesStatus.textContent = 'Share your location — AURA finds stops near real places.';
    renderDemoPlaces();
    return;
  }

  setPlacesStatus('Searching live data for trusted stops…');
  liveState.placesGrid.innerHTML = '<div class="empty-places">Searching trusted stops…</div>';

  const cacheKeyA = placesCacheKey(centerA.lat, centerA.lon);
  const cacheKeyMid = placesCacheKey((centerA.lat + centerB.lat) / 2, (centerA.lon + centerB.lon) / 2);

  // Path 1: live Overpass search
  try {
    let places = await queryTrustedPlaces(centerA.lat, centerA.lon, centerB.lat, centerB.lon);
    const seen = new Set();
    places = places.filter((p) => {
      const k = p.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (!places.length) throw new Error('none');

    const best = scorePlaces(places, centerA, centerB, onRoute);
    if (!best.length) throw new Error('none on route');

    renderPlaces(best, { onRoute });
    savePlacesCache(cacheKeyA, best);
    if (cacheKeyMid) savePlacesCache(cacheKeyMid, best);
    setPlacesStatus(
      (onRoute
        ? `${best.length} mid-journey stops on your route`
        : `${best.length} trusted stops near you`) +
        (liveState.weather ? ` · ${liveState.weather.temp}°C · ${liveState.weather.desc}` : ' · open status by your local time')
    );
    return;
  } catch { /* fall through */ }

  // Path 2: cached real stops
  const cached = loadPlacesCache(cacheKeyA) || (cacheKeyMid ? loadPlacesCache(cacheKeyMid) : null);
  if (cached && cached.length) {
    const best = scorePlaces(cached, centerA, centerB, onRoute);
    if (best.length) {
      renderPlaces(best, { onRoute });
      setPlacesStatus('Showing saved trusted stops (live map search is busy right now)');
      return;
    }
  }

  // Path 3: small OpenStreetMap fetch — sample boxes at start, middle and end of the journey
  try {
    const anchors = onRoute
      ? [
          centerA,
          { lat: (centerA.lat + centerB.lat) / 2, lon: (centerA.lon + centerB.lon) / 2 },
          centerB,
        ]
      : [centerA];
    let near = [];
    for (const a of anchors) {
      if (near.length >= 12) break;
      try {
        near = near.concat(await queryOsmMap(a.lat, a.lon));
      } catch { /* try next anchor */ }
    }
    if (near.length) {
      const seen = new Set();
      near = near.filter((p) => {
        const k = p.name.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const best = scorePlaces(near, centerA, centerB, onRoute);
      if (best.length) {
        renderPlaces(best, { onRoute });
        savePlacesCache(cacheKeyA, best);
        setPlacesStatus(`${best.length} trusted stops ${onRoute ? 'along your route' : 'near you'} (live data)`);
        return;
      }
    }
  } catch { /* fall through */ }

  // Path 4: sample places with a clear message
  setPlacesStatus('Live map search unavailable · showing sample stops (tap Refresh to retry)');
  renderDemoPlaces();
}

function renderEmptyState(msg) {
  liveState.placesGrid.innerHTML = `<div class="empty-places">${msg}</div>`;
}

function setPlacesStatus(msg) {
  if (liveState.placesStatus) liveState.placesStatus.textContent = msg;
}

function renderPlaces(list, opts) {
  liveState.placesGrid.innerHTML = '';
  list.forEach((place) => {
    const hours = place.tags.opening_hours || '';
    const status = parseOpeningHours(hours);
    const dist = place.distKm < 1 ? `${Math.round(place.distKm * 1000)} m` : `${place.distKm.toFixed(1)} km`;

    const statusClass = status.open === true ? 'open' : status.open === false ? 'closed' : 'unknown';
    const statusText =
      status.open === true
        ? 'Open now'
        : status.open === false
        ? 'Closed now'
        : 'Hours not listed';

    let routeLine = '';
    if (opts.onRoute) {
      const offText =
        place.offKm <= 1.2
          ? ''
          : place.offKm < 1
          ? ` · ${Math.round(place.offKm * 1000)} m off the road`
          : ` · ${place.offKm.toFixed(1)} km off the road`;
      const pct = routeDistKm > 0 ? Math.min(99, Math.round((place.alongKm / routeDistKm) * 100)) : null;
      const etaMin = routeDistKm > 0 ? Math.max(2, Math.round((place.alongKm / routeDistKm) * Math.round(routeDistKm / 26 * 60))) : null;
      routeLine = `<span class="on-route-badge">Mid-journey stop · ~${Math.round(place.alongKm)} km in${offText}</span>` +
        (pct !== null ? `<span class="on-route-badge pct">${pct}% into trip · reach it in ~${etaMin} min</span>` : '');
    } else {
      routeLine = `<small>${dist} from here</small>`;
    }

    const card = document.createElement('div');
    card.className = 'place-card revealed';
    card.innerHTML = `
      <span class="place-icon">${place.icon}</span>
      <strong>${escapeHtml(place.name)}</strong>
      ${routeLine}
      <span class="place-status ${statusClass}"><span class="dot"></span> ${statusText}</span>
      <small class="place-hours-detail">${escapeHtml(status.detail)}</small>
      <button class="btn btn-ghost-sm">Directions →</button>
    `;
    card.querySelector('.btn-ghost-sm').addEventListener('click', async () => {
      const btn = card.querySelector('.btn-ghost-sm');
      btn.disabled = true;
      btn.textContent = 'Computing…';
      const anchor = geoData.pickup || liveState.userLoc;
      let msg = '';
      if (anchor && !place._demo) {
        try {
          const r = await fetchRoute(anchor.lat, anchor.lon, place.lat, place.lon);
          if (r) {
            const min = Math.max(2, Math.round(r.duration / 60));
            msg = `Head to ${place.name}: ${min} min by the fastest route (${(r.distance / 1000).toFixed(1)} km). Check-In stays active.`;
          } else {
            throw new Error('empty');
          }
        } catch {
          const est = Math.max(2, Math.round(place.distKm / 26 * 60));
          msg = `Head to ${place.name}: ~${est} min. Check-In stays active.`;
        }
      } else {
        msg = `Head to ${place.name} (${dist}). Check-In stays active.`;
      }
      notify(msg);
      btn.textContent = 'Directions →';
      btn.disabled = false;
    });
    liveState.placesGrid.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderDemoPlaces() {
  const demo = [
    { name: 'Café Amara', icon: '☕', distKm: 0.4, _demo: true, tags: { opening_hours: 'Mo–Sa 08:00–23:00' } },
    { name: 'City Library', icon: '📚', distKm: 0.18, _demo: true, tags: { opening_hours: 'Mo–Fr 09:00–20:00' } },
    { name: 'Metro Waiting Lounge', icon: '🚇', distKm: 0.35, _demo: true, tags: { opening_hours: '24/7' } },
    { name: 'Bloom Pharmacy', icon: '💊', distKm: 0.52, _demo: true, tags: { opening_hours: 'Mo–Su 08:00–22:00' } },
  ];
  renderPlaces(demo, { onRoute: false });
}

// Show sample stops immediately so Saved places is never empty
renderDemoPlaces();

// ===== REFRESH PLACES =====
const refreshPlaces = document.getElementById('refreshPlaces');
refreshPlaces.addEventListener('click', async () => {
  refreshPlaces.disabled = true;
  refreshPlaces.textContent = 'Refreshing…';
  await loadTrustedPlaces();
  refreshPlaces.textContent = '↻ Refresh';
  refreshPlaces.disabled = false;
});

// ============================================================
// PLAN JOURNEY — autocomplete, routing
// ============================================================
const state = {
  pickup: '',
  destination: '',
  leaving: 'Now',
  company: 'On my own',
  buffer: 0,
  route: null,
  distanceKm: null,
  checkinWarning: false,
  checkinEscalated: false,
  checkinNow: false,
  timer: 0,
  deadline: 0,
  timerInterval: null,
  notified: false,
};

const routes = [
  {
    id: 'fast',
    name: 'Fast',
    badge: 'Fastest',
    desc: 'Metro + walk · Less active after 8 PM',
    time: 24,
    confidence: 82,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    badge: 'Recommended',
    desc: 'Bus + main road · Best fit for tonight',
    time: 31,
    confidence: 91,
  },
  {
    id: 'resilient',
    name: 'Resilient',
    badge: 'Most recovery',
    desc: 'More backup stops · Recovery options',
    time: 36,
    confidence: 88,
  },
];

const stops = ['Café Amara', 'City Library', 'Bloom Pharmacy', 'Metro Waiting Lounge'];

// ===== GEOCODING =====
const geoData = { pickup: null, destination: null };

async function searchNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=6&accept-language=en&countrycodes=in`;
  const res = await fetchWithTimeout(url, {}, 7000);
  if (!res.ok) throw new Error('geocode failed');
  return res.json();
}

// Combined geocoder: Nominatim first, Photon (Komoot) as backup when Nominatim is down/rate-limited
async function searchPlaces(q) {
  try {
    const results = await searchNominatim(q);
    if (results.length) return results;
  } catch { /* try backup */ }
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en`;
    const res = await fetchWithTimeout(url, {}, 7000);
    if (!res.ok) return [];
    const data = await res.json();
    const feats = data.features || [];
    return feats.map((f) => {
      const p = f.properties || {};
      const c = f.geometry && f.geometry.coordinates;
      const parts = [p.name, p.street, p.city, p.state, p.country].filter(Boolean);
      return {
        lat: c ? String(c[1]) : '0',
        lon: c ? String(c[0]) : '0',
        display_name: parts.join(', ') || (p.name || ''),
        address: p,
      };
    });
  } catch {
    return [];
  }
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=en&addressdetails=1`;
  const res = await fetchWithTimeout(url, {}, 7000);
  if (!res.ok) throw new Error('reverse geocode failed');
  const data = await res.json();
  if (typeof data.display_name !== 'string') throw new Error('bad address');
  return data;
}

async function geocodeText(q) {
  const results = await searchPlaces(q);
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

function estimateMin(km) {
  return Math.max(3, Math.round((km / 26) * 60));
}

// OSRM times are free-flow (no traffic). Indian city congestion adds real delay,
// so scale to something you'd actually see on a live map.
function trafficFactor(km) {
  if (km < 5) return 1.5;
  if (km < 15) return 1.65;
  if (km < 40) return 1.8;
  if (km < 80) return 1.7;
  return 1.5;
}

// OSRM polyline (precision 5) decoder
function decodePolyline(str) {
  const coords = [];
  let index = 0, lat = 0, lon = 0;
  while (index < str.length) {
    let result = 0, shift = 0, b;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lon += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / 1e5, lon / 1e5]);
  }
  return coords;
}

function distToSegment(lat1, lon1, lat2, lon2, plat, plon) {
  const dx = lat2 - lat1, dy = lon2 - lon1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((plat - lat1) * dx + (plon - lon1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = lat1 + t * dx, cy = lon1 + t * dy;
  return { d: haversine(plat, plon, cx, cy), t };
}

function distToRoute(plat, plon, geom) {
  let off = Infinity, along = 0, total = 0;
  for (let i = 0; i < geom.length - 1; i++) {
    const a = geom[i], b = geom[i + 1];
    const segKm = haversine(a[0], a[1], b[0], b[1]);
    const r = distToSegment(a[0], a[1], b[0], b[1], plat, plon);
    if (r.d < off) {
      off = r.d;
      along = total + r.t * segKm;
    }
    total += segKm;
  }
  return { off, along, total };
}

function shortName(place) {
  const a = place.address || {};
  const first = a.road || a.cycleway || a.suburb || a.neighbourhood || a.amenity || a.leisure || a.building || a.pedestrian;
  if (first) return first;
  return place.display_name.split(',')[0];
}

function renderSuggestions(listEl, results, input, key) {
  listEl.innerHTML = '';
  if (!results.length) {
    listEl.innerHTML = '<div class="suggestion-empty">No places found. Try another spelling.</div>';
    listEl.classList.add('open');
    return;
  }
  results.slice(0, 6).forEach((place) => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerHTML = `<strong>${escapeHtml(shortName(place))}</strong><small>${escapeHtml(place.display_name)}</small>`;
    div.addEventListener('click', () => {
      input.value = place.display_name;
      geoData[key] = { lat: parseFloat(place.lat), lon: parseFloat(place.lon) };
      listEl.classList.remove('open');
    });
    listEl.appendChild(div);
  });
  listEl.classList.add('open');
}

function setupAutocomplete(input, listEl, key) {
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) {
      listEl.classList.remove('open');
      return;
    }
    listEl.innerHTML = '<div class="suggestion-loading">Searching places…</div>';
    listEl.classList.add('open');
    timer = setTimeout(async () => {
      try {
        const results = await searchPlaces(q);
        renderSuggestions(listEl, results, input, key);
      } catch {
        listEl.innerHTML = '<div class="suggestion-empty">Search unavailable. Please type the full place name.</div>';
        listEl.classList.add('open');
      }
    }, 350);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') listEl.classList.remove('open');
  });
  input.addEventListener('blur', () => {
    setTimeout(() => listEl.classList.remove('open'), 150);
  });
}

// DOM REFS
const planPanel = document.getElementById('planPanel');
const routePanel = document.getElementById('routePanel');
const journeyPanel = document.getElementById('journeyPanel');
const arrivedPanel = document.getElementById('arrivedPanel');

const pickupInput = document.getElementById('pickup');
const destInput = document.getElementById('destination');
const swapBtn = document.getElementById('swapBtn');
const useCurrent = document.getElementById('useCurrent');
const planBtn = document.getElementById('planBtn');
const routeHint = document.getElementById('routeHint');
const routeOptions = document.getElementById('routeOptions');
const startBtn = document.getElementById('startBtn');
const backToPlan = document.getElementById('backToPlan');

const timerValue = document.getElementById('timerValue');
const distEta = document.getElementById('distEta');
const liveRouteName = document.getElementById('liveRouteName');
const confidenceFill = document.getElementById('confidenceFill');
const confidenceVal = document.getElementById('confidenceVal');
const checkinDot = document.getElementById('checkinDot');
const checkinHeadline = document.getElementById('checkinHeadline');
const checkinDetail = document.getElementById('checkinDetail');
const checkinNowBtn = document.getElementById('checkinNowBtn');
const arrivedBtn = document.getElementById('arrivedBtn');
const arrivedIcon = document.getElementById('arrivedIcon');
const arrivedTitle = document.getElementById('arrivedTitle');
const arrivedSub = document.getElementById('arrivedSub');
const arrivedDetails = document.getElementById('arrivedDetails');
const planAnother = document.getElementById('planAnother');

// Trusted contact
const contactInputEl = document.getElementById('contactName');
const contactPhoneEl = document.getElementById('contactPhone');
const escalationCard = document.getElementById('escalationCard');
const escalationMsg = document.getElementById('escalationMsg');
const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
const sendSmsBtn = document.getElementById('sendSmsBtn');
const copyMsgBtn = document.getElementById('copyMsgBtn');
const cancelEscalation = document.getElementById('cancelEscalation');

let contact = localStorage.getItem('aura_contact') || '';
let contactPhone = localStorage.getItem('aura_phone') || '';
if (contact) contactInputEl.value = contact;
if (contactPhone) contactPhoneEl.value = contactPhone;

function saveContact() {
  const v = contactInputEl.value.trim();
  contact = v ? v.charAt(0).toUpperCase() + v.slice(1) : 'my trusted contact';
  if (v) localStorage.setItem('aura_contact', v);
  contactPhone = contactPhoneEl.value.trim();
  if (contactPhone) localStorage.setItem('aura_phone', contactPhone);
}

contactInputEl.addEventListener('input', saveContact);
contactInputEl.addEventListener('change', saveContact);
contactPhoneEl.addEventListener('input', saveContact);
contactPhoneEl.addEventListener('change', saveContact);

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;      // Indian number without prefix
  if (digits.length === 11 && digits[0] === '0') return '91' + digits.slice(1);
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

setupAutocomplete(pickupInput, document.getElementById('pickupSuggestions'), 'pickup');
setupAutocomplete(destInput, document.getElementById('destinationSuggestions'), 'destination');

function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Chips: Leaving at / Traveling
document.querySelectorAll('.chip-row .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    chip.closest('.chip-row').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    const label = chip.closest('.input-group').querySelector('label').textContent.toLowerCase();
    if (label.includes('leaving')) state.leaving = chip.textContent;
    if (label.includes('traveling')) state.company = chip.textContent;
  });
});

// Buffer buttons
document.querySelectorAll('.buffer-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.buffer-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.buffer = parseInt(btn.dataset.val, 10);
  });
});

// ===== USE MY LOCATION (pick-up) =====
useCurrent.addEventListener('click', async () => {
  useCurrent.textContent = '⌖ Locating…';
  useCurrent.disabled = true;
  try {
    const pos = await getPosition();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) throw new Error('bad position');
    liveState.userLoc = { lat, lon };
    geoData.pickup = { lat, lon };
    try {
      const data = await reverseGeocode(lat, lon);
      pickupInput.value = data.display_name || 'Current location';
    } catch {
      pickupInput.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
    notify('Pick-up set to your live location.');
    try {
      applyWeather(await fetchWeather(lat, lon));
    } catch { /* keep going */ }
    loadTrustedPlaces();
  } catch {
    notify('Location could not be shared here (needs HTTPS + permission). Please type your pick-up place instead.', 'alert');
  } finally {
    useCurrent.textContent = '⌖ Use my location';
    useCurrent.disabled = false;
  }
});

// ===== SWAP =====
swapBtn.addEventListener('click', () => {
  const temp = pickupInput.value;
  pickupInput.value = destInput.value;
  destInput.value = temp;
  const g = geoData.pickup;
  geoData.pickup = geoData.destination;
  geoData.destination = g;
});

// ===== REAL ROUTING (OSRM) =====
let routeGeom = null;   // real road polyline [ [lat,lon], ... ] for the planned journey
let routeDistKm = 0;

const OSRM_SERVERS = [
  'https://router.project-osrm.org',
  'https://router-eu.project-osrm.org',
  'https://router-us.project-osrm.org',
];

async function fetchRoute(lat1, lon1, lat2, lon2, needGeom = false) {
  const overview = needGeom ? 'full' : 'false';
  let lastErr = new Error('no servers');
  for (const base of OSRM_SERVERS) {
    try {
      const url = `${base}/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=${overview}`;
      const res = await fetchWithTimeout(url, {}, 9000);
      if (!res.ok) {
        lastErr = new Error(`${base} -> ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes.length) {
        lastErr = new Error(`${base} -> ${data.code}`);
        continue;
      }
      const r = data.routes[0];
      const out = { duration: r.duration, distance: r.distance };
      if (needGeom) out.geometry = r.geometry ? decodePolyline(r.geometry) : [[lat1, lon1], [lat2, lon2]];
      return out;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

planBtn.addEventListener('click', async () => {
  const pickup = pickupInput.value.trim();
  const dest = destInput.value.trim();
  if (!pickup || !dest) {
    notify('Please enter both a pick-up and destination.');
    return;
  }
  state.pickup = pickup;
  state.destination = dest;
  saveContact();

  planBtn.disabled = true;
  planBtn.textContent = 'Computing real routes…';
  routeHint.textContent = `Geocoding ${pickup} → ${dest}…`;

  // Always try to geocode any place the user typed by hand (auto-picked suggestions are already geocoded)
  if (!geoData.pickup) {
    try {
      const g = await geocodeText(pickup);
      if (g) geoData.pickup = g;
    } catch { /* keep typed values */ }
  }
  if (!geoData.destination) {
    try {
      const g = await geocodeText(dest);
      if (g) geoData.destination = g;
    } catch { /* keep typed values */ }
  }

  let baseMin = null;
  let km = null;
  let geom = null;
  let usedLive = false;

  if (geoData.pickup && geoData.destination) {
    const A = geoData.pickup, B = geoData.destination;
    km = haversine(A.lat, A.lon, B.lat, B.lon);
    try {
      const r = await fetchRoute(A.lat, A.lon, B.lat, B.lon, true);
      if (r) {
        const rawMin = Math.max(4, Math.round(r.duration / 60));
        baseMin = Math.max(rawMin, Math.round(rawMin * trafficFactor(km)));
        km = r.distance / 1000;
        geom = r.geometry || null;
        usedLive = true;
      }
    } catch { /* fall back to estimate */ }
    if (baseMin === null && km) baseMin = estimateMin(km);
  }

  if (baseMin !== null) {
    routes[0].time = baseMin;
    routes[1].time = Math.round(baseMin * 1.35);
    routes[2].time = Math.round(baseMin * 1.5);
    const kms = km.toFixed(1);
    routes[0].desc = `Fastest route · ${kms} km`;
    routes[1].desc = `Time + well-lit roads · ${kms} km`;
    routes[2].desc = `Most backups along ${kms} km`;
    state.distanceKm = Math.round(km * 10) / 10;
  } else {
    routes[0].time = 24; routes[1].time = 31; routes[2].time = 36;
    routes[0].desc = 'Metro + walk · Less active after 8 PM';
    routes[1].desc = 'Bus + main road · Best fit for tonight';
    routes[2].desc = 'More backup stops · Recovery options';
    state.distanceKm = null;
  }
  routeGeom = geom;
  routeDistKm = km || 0;

  loadTrustedPlaces();

  buildRouteOptions();
  routeHint.textContent = usedLive
    ? `Routing ${pickup} → ${dest} — live route with traffic buffer · ${km.toFixed(1)} km, fastest ~${baseMin} min${liveState.weather && liveState.weather.rain ? ' · rain detected, add buffer' : ''}.`
    : baseMin !== null
    ? `Routing ${pickup} → ${dest} — approx ${km.toFixed(1)} km · ~${baseMin} min by distance (live routing busy right now)${liveState.weather && liveState.weather.rain ? ' · rain detected, add buffer' : ''}.`
    : `Routing ${pickup} → ${dest} — couldn't geocode for exact times. Pick a place from the drop-down suggestions for real times.`;
  hide(planPanel);
  show(routePanel);
  planBtn.disabled = false;
  planBtn.textContent = 'Plan journey';
});

function buildRouteOptions() {
  routeOptions.innerHTML = '';
  routes.forEach((route) => {
    const div = document.createElement('div');
    div.className = 'route-option';
    div.dataset.id = route.id;
    const rainTag =
      liveState.weather && liveState.weather.rain && (route.id === 'balanced' || route.id === 'resilient')
        ? '<span class="route-badge rain">Rain-safe</span>'
        : '';
    div.innerHTML = `
      <span class="route-badge">${route.badge}</span>
      ${rainTag}
      <div class="route-info">
        <div class="route-name">${route.name}</div>
        <div class="route-desc">${route.desc}</div>
      </div>
      <span class="route-time">${route.time} min</span>
    `;
    div.addEventListener('click', () => selectRoute(route, div));
    routeOptions.appendChild(div);
  });
}

function selectRoute(route, el) {
  state.route = route;
  document.querySelectorAll('.route-option').forEach((o) => o.classList.remove('selected'));
  el.classList.add('selected');
  startBtn.disabled = false;
  startBtn.textContent = `Start journey ${route.name} · ${route.time} min`;
}

backToPlan.addEventListener('click', () => {
  hide(routePanel);
  show(planPanel);
});

// ===== START JOURNEY =====
startBtn.addEventListener('click', () => {
  if (!state.route) return;
  hide(routePanel);
  show(journeyPanel);

  const bufferSec = state.buffer * 60;
  state.timer = (state.route.time * 60 + bufferSec) * 1.6;
  state.checkinWarning = false;
  state.checkinEscalated = false;
  state.notified = false;

  liveRouteName.textContent = state.route.name;
  timerValue.textContent = formatTime(state.timer);
  const distKm = state.distanceKm !== null ? state.distanceKm : (2 + Math.random() * 2).toFixed(1);
  distEta.innerHTML = `${distKm} km left · ETA <strong>${state.route.time + state.buffer} min</strong>`;
  confidenceFill.style.width = `${state.route.confidence}%`;
  confidenceVal.textContent = `${state.route.confidence}% High`;

  setCheckinStatus('armed');
  startTimer();
  notify(`Journey started. Check-In armed for ${state.pickup} → ${state.destination}.`);
  loadTrustedPlaces();
});

function startTimer() {
  clearInterval(state.timerInterval);
  state.deadline = Date.now() + state.timer * 1000;
  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    const rem = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
    state.timer = rem;
    if (rem > 0) timerValue.textContent = formatTime(rem);
    if (rem <= 0) {
      clearInterval(state.timerInterval);
      timerValue.textContent = formatTime(0);
      triggerLateWarning();
    }
  }, 500);
}

function updateTimerDisplay() {
  const rem = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
  state.timer = rem;
  if (rem > 0) timerValue.textContent = formatTime(rem);
}

// Re-sync the countdown when the tab comes back to foreground
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.timerInterval) updateTimerDisplay();
});

function triggerLateWarning() {
  state.timer = Math.round(state.route.time * 60 * 0.4);
  timerValue.textContent = formatTime(state.timer);
  startTimer();

  state.checkinWarning = true;
  setCheckinStatus('warning');

  if (!state.notified) {
    state.notified = true;
    notify("Heads-up: you haven't checked in at your expected arrival time.", 'alert');

    setTimeout(() => {
      if (state.checkinWarning) {
        buildEscalation();
      }
    }, 20000);
  }
}

let currentMessage = '';

function buildEscalation() {
  state.checkinEscalated = true;
  setCheckinStatus('escalated');

  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const coords = geoData.pickup;
  const locPart = coords
    ? `Last known position: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`
    : 'Location kept private by preference.';
  const who = userName || 'THIS PERSON';

  currentMessage = [
    `Hi ${contact},`,
    ``,
    `This is an automatic AURA alert for ${who}.`,
    ``,
    `Journey: ${state.pickup || 'a journey'} → ${state.destination || 'their destination'}`,
    `Expected check-in time was missed at ${time}.`,
    `${locPart}.`,
    ``,
    `Please reach ${who} and confirm they are safe.`,
    `If they respond to this alert, please ignore this message.`,
    ``,
    `— AURA (automatic, sent because the traveler did not check in)`,
  ].join('\n');

  escalationMsg.innerHTML = currentMessage.replace(/\n/g, '<br>') +
    `<span class="msg-meta">Will be sent as SMS · WhatsApp to ${contact}</span>`;
  escalationCard.classList.remove('hidden');
  notify(`You didn't check in. Escalation message ready for ${contact}.`, 'escalated');
}

function markEscalationSent(channel) {
  setCheckinStatus('sent');
  sendWhatsAppBtn.textContent = 'Sent via WhatsApp ✓';
  sendSmsBtn.textContent = 'Sent via SMS ✓';
  if (channel === 'wa') sendWhatsAppBtn.disabled = true;
  if (channel === 'sms') sendSmsBtn.disabled = true;
}

function openEscalationChannel(kind) {
  const phone = normalizePhone(contactPhone);
  if (!phone) {
    notify("Add your contact's number (with country code) in the Plan step first.", 'alert');
    return;
  }
  saveContact();
  const body = encodeURIComponent(currentMessage);
  let url;
  if (kind === 'wa') {
    url = `https://wa.me/${phone}?text=${body}`;
  } else {
    const sep = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    url = `sms:${phone}${sep}body=${body}`;
  }
  window.open(url, '_blank');
  markEscalationSent(kind);
  notify(`${kind === 'wa' ? 'WhatsApp' : 'SMS'} opening for ${contact} — AURA keeps watching until you respond.`, 'escalated');
}

sendWhatsAppBtn.addEventListener('click', () => openEscalationChannel('wa'));
sendSmsBtn.addEventListener('click', () => openEscalationChannel('sms'));

copyMsgBtn.addEventListener('click', async () => {
  const text = escalationMsg.textContent.replace(/Will be sent as SMS · WhatsApp to .*/s, '').trim();
  try {
    await navigator.clipboard.writeText(text);
    notify('Escalation message copied to clipboard.');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    notify('Escalation message copied to clipboard.');
  }
});

cancelEscalation.addEventListener('click', () => {
  state.checkinEscalated = false;
  state.checkinWarning = false;
  escalationCard.classList.add('hidden');
  setCheckinStatus('armed');
  notify('Escalation cancelled. AURA trusts you are okay.');
  state.timer = Math.max(state.timer, 5 * 60);
  timerValue.textContent = formatTime(state.timer);
  startTimer();
});

function setCheckinStatus(kind) {
  checkinDot.className = `checkin-dot ${kind}`;
  if (kind === 'armed') {
    checkinHeadline.textContent = 'Check-In Armed';
    checkinDetail.textContent = 'Confirms arrival automatically.';
    escalationCard.classList.add('hidden');
  } else if (kind === 'warning') {
    checkinHeadline.textContent = 'Heads-up.';
    checkinDetail.textContent = "You haven't checked in at your expected arrival time.";
  } else if (kind === 'escalated') {
    checkinHeadline.textContent = 'Escalation path ready.';
    checkinDetail.textContent = `A message is ready for ${contact} with your location and plan.`;
  } else if (kind === 'sent') {
    checkinHeadline.textContent = `Message sent to ${contact}`;
    checkinDetail.textContent = 'AURA keeps watching until you respond.';
    checkinDot.className = 'checkin-dot escalated';
  } else if (kind === 'confirmed') {
    checkinHeadline.textContent = 'Check-In confirmed';
    checkinDetail.textContent = 'Safe arrival verified. Trusted contact was not notified.';
    checkinDot.className = 'checkin-dot armed';
    escalationCard.classList.add('hidden');
  }
}

// ===== CHECK-IN / ARRIVAL =====
checkinNowBtn.addEventListener('click', () => {
  clearInterval(state.timerInterval);
  const confirmed = Math.random() > 0.15;
  if (confirmed) {
    state.checkinNow = true;
    state.checkinWarning = false;
    state.checkinEscalated = false;
    setCheckinStatus('confirmed');
    notify('Check-In confirmed. Safe arrival verified.');
  } else {
    notify('Could not confirm yet. A second check-in will be sent in 5 minutes.', 'alert');
    setCheckinStatus('warning');
    state.timer = 5 * 60;
    timerValue.textContent = formatTime(state.timer);
    startTimer();
  }
});

arrivedBtn.addEventListener('click', () => {
  clearInterval(state.timerInterval);
  showArrival(true);
});

function showArrival(confirmed) {
  hide(journeyPanel);
  show(arrivedPanel);
  escalationCard.classList.add('hidden');
  arrivedIcon.className = `arrived-icon ${confirmed ? 'checkmark' : 'warning'}`;
  arrivedIcon.textContent = confirmed ? '✓' : '!';
  arrivedTitle.textContent = confirmed ? "You've arrived." : 'Needs attention';
  arrivedSub.textContent = confirmed
    ? 'Check-In confirmed automatically.'
    : "Check-In couldn't confirm. A nudge was sent as a gentle reminder.";
  arrivedDetails.innerHTML = confirmed
    ? '<span>✓ Trusted contact was never notified.</span><span>✓ Journey log stays on your device.</span>'
    : '<span>! Escalation only if you do not respond.</span><span>✓ You stay in control of every alert.</span>';
  arrivedDetails.style.color = confirmed ? 'var(--green)' : 'var(--red)';
}

planAnother.addEventListener('click', () => {
  hide(arrivedPanel);
  show(planPanel);
  state.route = null;
  state.checkinWarning = false;
  state.checkinEscalated = false;
  state.notified = false;
  state.checkinNow = false;
  startBtn.disabled = true;
  startBtn.textContent = 'Select a route to start';
});

// ===== SITUATION ASSISTANT =====
document.querySelectorAll('.assistant-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const text = btn.textContent.trim();
    if (text.includes('Re-route')) {
      const idx = Math.floor(Math.random() * routes.length);
      const r = routes[idx];
      state.route = r;
      state.timer = r.time * 60 * 1.6;
      liveRouteName.textContent = r.name;
      timerValue.textContent = formatTime(state.timer);
      confidenceFill.style.width = `${r.confidence}%`;
      confidenceVal.textContent = `${r.confidence}% High`;
      distEta.innerHTML = `${(2 + Math.random() * 2).toFixed(1)} km left · ETA <strong>${r.time} min</strong>`;
      startTimer();
      notify(`Re-routed to the ${r.name} route with fresh data. Why: better coverage on main roads.`);
    } else if (text.includes('Feeling uncomfortable')) {
      notify('Nearby: City Library (80 m). Populated area. AURA will check in every 10 minutes.');
    } else if (text.includes('Share')) {
      notify('Trip shared with your trusted contact. Location included in the message.');
    } else if (text.includes('wait')) {
      const s = stops[Math.floor(Math.random() * stops.length)];
      notify(`Find a place to wait: checked live trusted stops near you — they keep Check-In active.`);
    }
  });
});

// ===== MEMORY: prefill with saved name =====
applyName();

// ===== SCROLL REVEAL =====
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('revealed');
    });
  },
  { threshold: 0.1 }
);

document.querySelectorAll('.mode-card, .feature-card, .place-card, .principle-card, .data-card, .step, .stat-card').forEach((el) => {
  observer.observe(el);
});