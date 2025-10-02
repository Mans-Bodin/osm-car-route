// start and stop
const start = [58.4005773, 15.658248];
const end   = [58.4074017, 15.6330793];

// Hastighet i km/h för bilen
const speedKmh = 100;

// Initiera karta
const map = L.map('map');
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap-bidragsgivare'
}).addTo(map);

// Markera start och mål
const startMarker = L.marker(start, { title: 'Start' }).addTo(map);
const endMarker   = L.marker(end,   { title: 'Mål'   }).addTo(map);

const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;

fetch(url)
  .then(r => r.json())
  .then(data => {
    if (!data.routes || !data.routes.length) throw new Error('Ingen rutt hittades');
    const coords = data.routes[0].geometry.coordinates;
    const latlngs = coords.map(c => [c[1], c[0]]);

    const routeLine = L.polyline(latlngs, { color: '#0ea5e9', weight: 5, opacity: 0.9, className: 'route-line' }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });

    const { cum, total } = cumulativeDistances(latlngs);

    // Skapa bil-markör
    const carIcon = L.divIcon({
      className: 'car-wrapper',
      html: '<div class="car">🚗</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    const car = L.marker(latlngs[0], { icon: carIcon, interactive: false }).addTo(map);

    // speed animering
    const speedMps = (speedKmh * 1000) / 3600;
    let t0 = null;

    function frame(ts) {
      if (!t0) t0 = ts;
      const elapsed = (ts - t0) / 1000;
      let d = elapsed * speedMps;

      if (d >= total) {
        t0 = ts;
        d = 0;
      }

      const p = pointAtDistance(latlngs, cum, d);
      car.setLatLng(p.latlng);

    //   const nextRef = p.nextIndex < latlngs.length ? latlngs[p.nextIndex] : latlngs[latlngs.length - 1];
    //   const ang = bearing(p.latlng, nextRef); 
    //   const cssAngle = ang - 90; 
    //   const el = car.getElement();
    //   if (el) {
    //     const inner = el.querySelector('.car');
    //     if (inner) inner.style.transform = `rotate(${cssAngle}deg)`;
    //   }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  })
  .catch(err => {
    console.error(err);
    alert('Kunde inte hämta rutt: ' + err.message);
  });

function cumulativeDistances(latlngs) {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < latlngs.length; i++) {
    const a = L.latLng(latlngs[i - 1][0], latlngs[i - 1][1]);
    const b = L.latLng(latlngs[i][0],     latlngs[i][1]);
    const d = a.distanceTo(b); // meter
    total += d;
    cum.push(total);
  }
  return { cum, total };
}

function pointAtDistance(latlngs, cum, d) {
  // Om utanför spannet
  if (d <= 0) return { latlng: L.latLng(latlngs[0][0], latlngs[0][1]), nextIndex: 1 };
  if (d >= cum[cum.length - 1]) {
    const last = latlngs[latlngs.length - 1];
    return { latlng: L.latLng(last[0], last[1]), nextIndex: latlngs.length - 1 };
  }
 
  let i = 0;
  while (i < cum.length - 1 && !(cum[i] <= d && d < cum[i + 1])) i++;
  const a = latlngs[i];
  const b = latlngs[i + 1];
  const segLen = cum[i + 1] - cum[i];
  const t = segLen > 0 ? (d - cum[i]) / segLen : 0;
  const lat = a[0] + (b[0] - a[0]) * t;
  const lon = a[1] + (b[1] - a[1]) * t;
  return { latlng: L.latLng(lat, lon), nextIndex: i + 1 };
}

// Geodetisk bäring (grader): 0=N, 90=E
function bearing(aLatLng, bLatLng) {
  const toRad = x => (x * Math.PI) / 180;
  const toDeg = x => (x * 180) / Math.PI;
  const φ1 = toRad(aLatLng.lat), φ2 = toRad(bLatLng[0]);
  const λ1 = toRad(aLatLng.lng), λ2 = toRad(bLatLng[1]);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  let θ = toDeg(Math.atan2(y, x));
  if (θ < 0) θ += 360;
  return θ;
}
