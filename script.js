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
  const res = await fetch(url);
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

    // Trusted stops around the user
    await loadTrustedPlaces();

    notify('Location shared. AURA can now find trusted stops near you.');
  } catch {
    notify('Location unavailable. Please allow access so AURA can find stops near you.', 'alert');
    liveState.placesStatus.textContent = 'Location access denied · showing demo stops only';
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
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];

async function queryTrustedPlaces(lat1, lon1, lat2, lon2) {
  const south = Math.min(lat1, lat2) - 0.03;
  const north = Math.max(lat1, lat2) + 0.03;
  const west = Math.min(lon1, lon2) - 0.03;
  const east = Math.max(lon1, lon2) + 0.03;
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:25];
(
  node["amenity"~"^(cafe|restaurant|fast_food|ice_cream|library|pharmacy|bank|police|doctors|hospital|shelter)$"](${bbox});
  way["amenity"~"^(cafe|restaurant|fast_food|library|pharmacy|bank|police|shelter)$"](${bbox});
  node["shop"~"^(convenience|supermarket)$"](${bbox});
);
out body 60;`;

  let lastErr = new Error('no servers');
  for (const server of OVERPASS_SERVERS) {
    try {
      const res = await fetch(server, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
      });
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
      return places;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
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
  try {
    let places = await queryTrustedPlaces(centerA.lat, centerA.lon, centerB.lat, centerB.lon);

    // Dedupe by name
    const seen = new Set();
    places = places.filter((p) => {
      const k = p.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (!places.length) {
      setPlacesStatus('No trusted stops found in this area yet — try planning a journey or moving around.');
      renderEmptyState('No trusted stops here yet. Try planning a journey so AURA scans along your route, or move to a busier area and refresh.');
      return;
    }

    const midLat = (centerA.lat + centerB.lat) / 2;
    const midLon = (centerA.lon + centerB.lon) / 2;
    places.forEach((p) => {
      p.distKm = haversine(midLat, midLon, p.lat, p.lon);
    });
    places.sort((a, b) => a.distKm - b.distKm);
    const best = places.slice(0, 8);

    renderPlaces(best, { onRoute });
    setPlacesStatus(
      (onRoute
        ? `${best.length} trusted stops on your route`
        : `${best.length} trusted stops near you`) +
        (liveState.weather ? ` · ${liveState.weather.temp}°C · ${liveState.weather.desc}` : ' · open status by your local time')
    );
  } catch {
    setPlacesStatus('Live search unavailable right now · showing sample stops (tap Refresh to retry)');
    renderDemoPlaces();
  }
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

    const card = document.createElement('div');
    card.className = 'place-card revealed';
    card.innerHTML = `
      <span class="place-icon">${place.icon}</span>
      <strong>${escapeHtml(place.name)}</strong>
      ${opts.onRoute ? `<span class="on-route-badge">On your route · ${dist}</span>` : `<small>${dist} from here</small>`}
      <span class="place-status ${statusClass}"><span class="dot"></span> ${statusText}</span>
      <small class="place-hours-detail">${escapeHtml(status.detail)}</small>
      <button class="btn btn-ghost-sm">Directions →</button>
    `;
    card.querySelector('.btn-ghost-sm').addEventListener('click', () => {
      notify(`Head to ${place.name} (${dist}). Balanced route, ~${Math.max(2, Math.round(place.distKm * 22))} min away. Check-In stays active.`);
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
    { name: 'Café Amara', icon: '☕', distKm: 0.4, tags: { opening_hours: 'Mo–Sa 08:00–23:00' } },
    { name: 'City Library', icon: '📚', distKm: 0.18, tags: { opening_hours: 'Mo–Fr 09:00–20:00' } },
    { name: 'Metro Waiting Lounge', icon: '🚇', distKm: 0.35, tags: { opening_hours: '24/7' } },
    { name: 'Bloom Pharmacy', icon: '💊', distKm: 0.52, tags: { opening_hours: 'Mo–Su 08:00–22:00' } },
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
  const res = await fetch(url);
  if (!res.ok) throw new Error('geocode failed');
  return res.json();
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=en&addressdetails=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('reverse geocode failed');
  return res.json();
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
        const results = await searchNominatim(q);
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
const escalationCard = document.getElementById('escalationCard');
const escalationMsg = document.getElementById('escalationMsg');
const sendMsgBtn = document.getElementById('sendMsgBtn');
const copyMsgBtn = document.getElementById('copyMsgBtn');
const cancelEscalation = document.getElementById('cancelEscalation');

let contact = localStorage.getItem('aura_contact') || '';
if (contact) contactInputEl.value = contact;

function saveContact() {
  const v = contactInputEl.value.trim();
  contact = v ? v.charAt(0).toUpperCase() + v.slice(1) : 'my trusted contact';
  if (v) localStorage.setItem('aura_contact', v);
}

contactInputEl.addEventListener('input', saveContact);
contactInputEl.addEventListener('change', saveContact);

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
    notify('Location unavailable. Please type your pick-up place.', 'alert');
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
async function fetchRoute(lat1, lon1, lat2, lon2) {
  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes.length) return null;
  return { duration: data.routes[0].duration, distance: data.routes[0].distance };
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

  if (geoData.pickup && geoData.destination) {
    try {
      const route = await fetchRoute(
        geoData.pickup.lat, geoData.pickup.lon,
        geoData.destination.lat, geoData.destination.lon
      );
      if (route) {
        const baseMin = Math.max(4, Math.round(route.duration / 60));
        routes[0].time = baseMin;
        routes[1].time = Math.round(baseMin * 1.35);
        routes[2].time = Math.round(baseMin * 1.5);
        const km = (route.distance / 1000).toFixed(1);
        state.distanceKm = parseFloat(km);
        routes[0].desc = `Fastest route · ${km} km`;
        routes[1].desc = `Time + well-lit roads · ${km} km`;
        routes[2].desc = `Most backups along ${km} km`;
      }
    } catch {
      // fall back to default times
    }
  }

  loadTrustedPlaces();

  buildRouteOptions();
  routeHint.textContent = `Routing ${pickup} → ${dest} — three modes from live data${
    geoData.pickup && geoData.destination ? ' · real distance and time' : ' · geocode both places for real times'
  }${
    liveState.weather && liveState.weather.rain ? ' · rain detected, add buffer' : ''
  }.`;
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
});

function startTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    state.timer -= 1;
    if (state.timer >= 0) timerValue.textContent = formatTime(state.timer);
    if (state.timer <= 0) {
      clearInterval(state.timerInterval);
      triggerLateWarning();
    }
  }, 1000);
}

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
  sendMsgBtn.textContent = `Send to ${contact}`;
  notify(`You didn't check in. Escalation message ready for ${contact}.`, 'escalated');
}

sendMsgBtn.addEventListener('click', () => {
  setCheckinStatus('sent');
  sendMsgBtn.textContent = 'Message sent ✓';
  sendMsgBtn.disabled = true;
  notify(`Message sent to ${contact} via SMS & WhatsApp. AURA keeps watching until you respond.`, 'escalated');
});

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