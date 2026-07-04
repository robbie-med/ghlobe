/* === i18n translations === */
const T = {
  en: {
    globe: '🌐 Globe', mercator: '🗺 Mercator',
    style: 'Style', atlas: 'Atlas', satellite: 'Satellite',
    'satellite-borders': 'Satellite + Borders',
    roads: 'Roads', rivers: 'Rivers',
    select: 'Select', auto: 'Auto', country: 'Country', state: 'State/Province',
    area: 'Area',
    loading: 'Loading data…',
    'click-hint': 'Click a country or state/province to select it',
    'drag-hint': 'Drag selected region to compare sizes',
    color: 'Color', opacity: 'Opacity',
    clear: 'Clear Selection'
  },
  ko: {
    globe: '🌐 지구본', mercator: '🗺 메르카토르',
    style: '스타일', atlas: '지도책', satellite: '위성',
    'satellite-borders': '위성 + 국경',
    roads: '도로', rivers: '하천',
    select: '선택', auto: '자동', country: '국가', state: '주/도',
    area: '면적',
    loading: '데이터 로딩 중…',
    'click-hint': '국가 또는 주/도를 클릭하여 선택하세요',
    'drag-hint': '선택한 지역을 드래그하여 크기 비교',
    color: '색상', opacity: '불투명도',
    clear: '선택 해제'
  },
  zh: {
    globe: '🌐 地球', mercator: '🗺 墨卡托',
    style: '样式', atlas: '地图集', satellite: '卫星',
    'satellite-borders': '卫星 + 边界',
    roads: '道路', rivers: '河流',
    select: '选择', auto: '自动', country: '国家', state: '省/州',
    area: '面积',
    loading: '加载数据…',
    'click-hint': '点击国家或省/州以选择',
    'drag-hint': '拖动所选区域以比较大小',
    color: '颜色', opacity: '透明度',
    clear: '清除选择'
  },
  fr: {
    globe: '🌐 Globe', mercator: '🗺 Mercator',
    style: 'Style', atlas: 'Atlas', satellite: 'Satellite',
    'satellite-borders': 'Satellite + Frontières',
    roads: 'Routes', rivers: 'Rivières',
    select: 'Sélection', auto: 'Auto', country: 'Pays', state: 'Région/Province',
    area: 'Superficie',
    loading: 'Chargement…',
    'click-hint': 'Cliquez sur un pays ou une province',
    'drag-hint': 'Faites glisser pour comparer les tailles',
    color: 'Couleur', opacity: 'Opacité',
    clear: 'Effacer'
  },
  ar: {
    globe: '🌐 كرة أرضية', mercator: '🗺 ميركاتور',
    style: 'النمط', atlas: 'أطلس', satellite: 'قمر صناعي',
    'satellite-borders': 'قمر صناعي + حدود',
    roads: 'طرق', rivers: 'أنهار',
    select: 'تحديد', auto: 'تلقائي', country: 'دولة', state: 'ولاية/مقاطعة',
    area: 'المساحة',
    loading: 'جاري التحميل…',
    'click-hint': 'انقر على دولة أو مقاطعة/ولاية لتحديدها',
    'drag-hint': 'اسحب المنطقة المحددة لمقارنة الأحجام',
    color: 'لون', opacity: 'شفافية',
    clear: 'إلغاء التحديد'
  },
  ru: {
    globe: '🌐 Глобус', mercator: '🗺 Меркатор',
    style: 'Стиль', atlas: 'Атлас', satellite: 'Спутник',
    'satellite-borders': 'Спутник + Границы',
    roads: 'Дороги', rivers: 'Реки',
    select: 'Выбор', auto: 'Авто', country: 'Страна', state: 'Регион',
    area: 'Площадь',
    loading: 'Загрузка…',
    'click-hint': 'Нажмите на страну или регион',
    'drag-hint': 'Перетащите для сравнения размеров',
    color: 'Цвет', opacity: 'Прозрачность',
    clear: 'Сбросить'
  }
};

/* === State === */
let lang = 'en';
let proj = 'globe';
let styleName = 'atlas';
let pickMode = 'auto';      // 'auto' | 'country' | 'state'
let dataLoaded = false;
let selectedSource = null;  // 'countries' | 'admin1'
let selectedFeature = null;
let selectedAreaKm2 = 0;
let dragState = null;       // { start, feature } during drag
let countriesData = null;   // full-resolution originals (tile geometry is clipped/simplified)
let admin1Data = null;

/* ======== Helpers ======== */

function t(key) {
  return (T[lang] && T[lang][key]) || (T.en[key] || key);
}

function hashColor(str, s, l) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, ${s}%, ${l}%)`;
}

/* ======== Spherical math ========
   Dragging translates the shape by a rigid rotation of the sphere, so its
   true area and shape are preserved wherever it lands — the projection then
   shows honestly how big it is at the new latitude. */

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const EARTH_R_KM = 6371.0088;

function lngLatToVec(lng, lat) {
  const λ = lng * D2R, φ = lat * D2R, c = Math.cos(φ);
  return [c * Math.cos(λ), c * Math.sin(λ), Math.sin(φ)];
}

function vecToLngLat(v) {
  return [Math.atan2(v[1], v[0]) * R2D, Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D];
}

function axisAngleMatrix(u, angle) {
  const [x, y, z] = u, c = Math.cos(angle), s = Math.sin(angle), k = 1 - c;
  return [
    [k * x * x + c,     k * x * y - s * z, k * x * z + s * y],
    [k * x * y + s * z, k * y * y + c,     k * y * z - s * x],
    [k * x * z - s * y, k * y * z + s * x, k * z * z + c]
  ];
}

function matMul(A, B) {
  const M = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      M[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
  return M;
}

function applyMat(M, v) {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]
  ];
}

// Rotation carrying (lng0,lat0) to (lng1,lat1) while keeping north up:
// spin about the pole by ΔLng, then tilt along the target meridian by ΔLat.
function dragRotation(lng0, lat0, lng1, lat1) {
  const Rz = axisAngleMatrix([0, 0, 1], (lng1 - lng0) * D2R);
  const meridianAxis = [-Math.sin(lng1 * D2R), Math.cos(lng1 * D2R), 0];
  const Rm = axisAngleMatrix(meridianAxis, (lat0 - lat1) * D2R);
  return matMul(Rm, Rz);
}

// Rotate a ring, then unwrap longitudes so consecutive points never jump
// across the antimeridian, and shift the ring within 180° of refLng.
function rotateRing(ring, M, refLng) {
  const out = new Array(ring.length);
  for (let i = 0; i < ring.length; i++) {
    const p = vecToLngLat(applyMat(M, lngLatToVec(ring[i][0], ring[i][1])));
    if (i > 0) p[0] -= 360 * Math.round((p[0] - out[i - 1][0]) / 360);
    out[i] = p;
  }
  const shift = 360 * Math.round((out[0][0] - refLng) / 360);
  if (shift) for (const p of out) p[0] -= shift;
  return out;
}

function rotateGeometry(geom, M, refLng) {
  const rotPoly = rings => rings.map(r => rotateRing(r, M, refLng));
  if (geom.type === 'Polygon')
    return { type: 'Polygon', coordinates: rotPoly(geom.coordinates) };
  return { type: 'MultiPolygon', coordinates: geom.coordinates.map(rotPoly) };
}

/* True spherical area (km²) — invariant under the drag rotation */
function ringAreaKm2(ring) {
  let sum = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [l1, f1] = ring[i], [l2, f2] = ring[(i + 1) % n];
    sum += (l2 - l1) * D2R * (2 + Math.sin(f1 * D2R) + Math.sin(f2 * D2R));
  }
  return sum * EARTH_R_KM * EARTH_R_KM / 2;
}

function geomAreaKm2(geom) {
  const polyArea = rings => Math.abs(rings.reduce((a, r) => a + ringAreaKm2(r), 0));
  if (geom.type === 'Polygon') return polyArea(geom.coordinates);
  return geom.coordinates.reduce((a, p) => a + polyArea(p), 0);
}

/* ======== Map ======== */

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    projection: { type: 'globe' },
    sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 1, 8, 0] },
    sources: {},
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#aaccdd' } }]
  },
  center: [0, 30],
  zoom: 1.8,
  minZoom: 0.5,
  maxZoom: 18,
  attributionControl: false
});

map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right');

map.on('load', initApp);

map.on('error', (e) => {
  console.error('Map error:', e.error);
  // Only alarm the user if the map never came up (likely WebGL)
  if (!dataLoaded) {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
      loader.classList.remove('hidden');
      loader.innerHTML = '<span style="color:#f66">⚠ Map failed to load — check that WebGL is enabled</span>';
    }
  }
});

// Safety: surface a warning if the map never loads
setTimeout(() => {
  const loader = document.getElementById('loading-indicator');
  if (loader && !dataLoaded) {
    loader.classList.remove('hidden');
    loader.innerHTML = '<span style="color:#f66">⚠ Map failed to load — check WebGL is enabled</span>';
  }
}, 30000);

/* ======== Init ======== */

async function initApp() {
  bindUI();
  // Fetch in parallel, then add layers in fixed order (countries below admin1)
  await Promise.all([loadCountries(), loadAdmin1()]);
  addCountryLayers();
  addAdmin1Layers();
  dataLoaded = true;
  document.getElementById('loading-indicator').classList.add('hidden');
  applyStyle(styleName);
  updateUI();
}

/* ======== Data Loading ======== */

async function loadCountries() {
  const geojson = await fetch('countries.json').then(r => r.json());

  geojson.features.forEach((f, i) => {
    f.id = i;
    f.properties.color = hashColor(f.properties.name || '', 58, 68);
  });
  countriesData = geojson;
}

function addCountryLayers() {
  map.addSource('countries', { type: 'geojson', data: countriesData });

  map.addLayer({
    id: 'countries-fill', source: 'countries', type: 'fill',
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.75 }
  });
  map.addLayer({
    id: 'countries-line', source: 'countries', type: 'line',
    paint: { 'line-color': '#334455', 'line-width': 0.7 }
  });
}

async function loadAdmin1() {
  const geojson = await fetch('admin1.json').then(r => r.json());

  geojson.features.forEach((f, i) => {
    f.id = i;
    f.properties.color = hashColor((f.properties.name || '') + (f.properties.admin || ''), 58, 74);
  });
  admin1Data = geojson;
}

function addAdmin1Layers() {
  map.addSource('admin1', { type: 'geojson', data: admin1Data });

  map.addLayer({
    id: 'admin1-fill', source: 'admin1', type: 'fill',
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.45 },
    minzoom: 2
  });
  map.addLayer({
    id: 'admin1-line', source: 'admin1', type: 'line',
    paint: { 'line-color': '#8899aa', 'line-width': 0.35, 'line-dasharray': [2, 3] },
    minzoom: 2
  });
}

/* ======== Style Switching ======== */

function applyStyle(name) {
  styleName = name;
  const hasSatellite = name === 'satellite' || name === 'satellite-borders';
  const showBorders = name === 'atlas' || name === 'satellite-borders';

  // Satellite raster
  if (hasSatellite) {
    if (!map.getSource('esri')) {
      map.addSource('esri', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256
      });
      map.addLayer({ id: 'esri-layer', source: 'esri', type: 'raster' }, 'countries-fill');
    }
    map.setLayoutProperty('esri-layer', 'visibility', 'visible');
    map.setPaintProperty('bg', 'background-color', '#000');
  } else {
    if (map.getLayer('esri-layer')) map.setLayoutProperty('esri-layer', 'visibility', 'none');
    map.setPaintProperty('bg', 'background-color', '#aaccdd');
  }

  // Fills stay visible at opacity 0 in satellite modes so clicks still hit them
  map.setPaintProperty('countries-fill', 'fill-opacity', name === 'atlas' ? 0.75 : 0);
  map.setPaintProperty('admin1-fill', 'fill-opacity', name === 'atlas' ? 0.45 : 0);

  // Borders
  const borderColor = hasSatellite ? '#88ccff' : '#334455';
  const borderWidth = hasSatellite ? 1.2 : 0.7;
  map.setLayoutProperty('countries-line', 'visibility', showBorders ? 'visible' : 'none');
  if (showBorders) {
    map.setPaintProperty('countries-line', 'line-color', borderColor);
    map.setPaintProperty('countries-line', 'line-width', borderWidth);
  }

  map.setLayoutProperty('admin1-line', 'visibility', showBorders ? 'visible' : 'none');
  if (showBorders) {
    map.setPaintProperty('admin1-line', 'line-color', hasSatellite ? '#88bbdd' : '#8899aa');
    map.setPaintProperty('admin1-line', 'line-width', hasSatellite ? 0.5 : 0.35);
  }
}

/* ======== Roads & Rivers ======== */

const VECTOR_TILE_URL = 'https://tiles.basemaps.cartocdn.com/vectortiles/carto.streets/v1/{z}/{x}/{y}.mvt';

function ensureOSMVectorSource() {
  if (!map.getSource('osm-vector')) {
    map.addSource('osm-vector', {
      type: 'vector',
      tiles: [VECTOR_TILE_URL],
      minzoom: 0,
      maxzoom: 14,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/">OSM</a>'
    });
  }
}

function toggleRoads(on) {
  if (on) {
    ensureOSMVectorSource();
    if (!map.getLayer('roads-layer')) {
      map.addLayer({
        id: 'roads-layer', source: 'osm-vector', 'source-layer': 'transportation',
        type: 'line', minzoom: 4,
        paint: {
          'line-color': '#ffcc44',
          'line-width': ['interpolate', ['linear'], ['zoom'],
            4, 0.3, 8, 1, 12, 2.5
          ],
          'line-opacity': 0.75
        },
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]]
      });
    }
    map.setLayoutProperty('roads-layer', 'visibility', 'visible');
  } else {
    if (map.getLayer('roads-layer')) map.setLayoutProperty('roads-layer', 'visibility', 'none');
  }
}

function toggleRivers(on) {
  if (on) {
    ensureOSMVectorSource();
    if (!map.getLayer('rivers-layer')) {
      map.addLayer({
        id: 'rivers-layer', source: 'osm-vector', 'source-layer': 'waterway',
        type: 'line', minzoom: 3,
        paint: {
          'line-color': '#4499cc',
          'line-width': ['interpolate', ['linear'], ['zoom'],
            3, 0.2, 8, 0.8, 12, 2
          ],
          'line-opacity': 0.7
        },
        filter: ['==', ['get', 'class'], 'river']
      });
    }
    map.setLayoutProperty('rivers-layer', 'visibility', 'visible');
  } else {
    if (map.getLayer('rivers-layer')) map.setLayoutProperty('rivers-layer', 'visibility', 'none');
  }
}

/* ======== Selection ======== */

map.on('click', (e) => {
  if (dragState) return;

  // Don't deselect when clicking on the selected entity
  if (map.getLayer('selected-fill')) {
    const selFeatures = map.queryRenderedFeatures(e.point, { layers: ['selected-fill'] });
    if (selFeatures.length) return;
  }

  const layersFor = {
    auto: ['admin1-fill', 'countries-fill'],
    country: ['countries-fill'],
    state: ['admin1-fill']
  };
  let features = map.queryRenderedFeatures(e.point, { layers: layersFor[pickMode] });
  // In state mode fall back to the country when no admin1 is under the cursor
  if (!features.length && pickMode === 'state') {
    features = map.queryRenderedFeatures(e.point, { layers: ['countries-fill'] });
  }

  if (!features.length) {
    clearSelection();
    return;
  }

  // queryRenderedFeatures returns tile geometry (clipped + zoom-simplified),
  // so look up the full-resolution original by id instead.
  const hit = features[0];
  const src = hit.source;
  const data = src === 'admin1' ? admin1Data : countriesData;
  const original = data.features[hit.id];
  if (original) selectFeature(original, src);
});

function selectFeature(feature, sourceName) {
  selectedSource = sourceName;
  selectedFeature = JSON.parse(JSON.stringify(feature));
  selectedAreaKm2 = geomAreaKm2(selectedFeature.geometry);

  const geojson = { type: 'FeatureCollection', features: [selectedFeature] };

  if (map.getSource('selected')) {
    map.getSource('selected').setData(geojson);
  } else {
    map.addSource('selected', { type: 'geojson', data: geojson });
    map.addLayer({ id: 'selected-fill', source: 'selected', type: 'fill',
      paint: { 'fill-color': '#ff6b35', 'fill-opacity': 0.75 } });
    map.addLayer({ id: 'selected-outline', source: 'selected', type: 'line',
      paint: { 'line-color': '#ff4400', 'line-width': 2 } });
  }

  applyEntityStyle();
  updateSidebar();
}

function clearSelection() {
  selectedSource = null;
  selectedFeature = null;
  selectedAreaKm2 = 0;
  if (map.getLayer('selected-outline')) { map.removeLayer('selected-outline'); map.removeLayer('selected-fill'); }
  if (map.getSource('selected')) map.removeSource('selected');
  updateSidebar();
}

function applyEntityStyle() {
  if (!map.getLayer('selected-fill')) return;
  const color = document.getElementById('entity-color').value;
  const opacity = parseInt(document.getElementById('entity-opacity').value) / 100;
  map.setPaintProperty('selected-fill', 'fill-color', color);
  map.setPaintProperty('selected-fill', 'fill-opacity', opacity);
}

/* ======== Drag (rigid rotation on the sphere) ======== */

const clampLat = lat => Math.max(-85, Math.min(85, lat));

function startDrag(e) {
  if (!selectedFeature) return;
  e.preventDefault();
  dragState = {
    start: e.lngLat,
    feature: JSON.parse(JSON.stringify(selectedFeature))
  };
  map.dragPan.disable();
  map.getCanvas().style.cursor = 'grabbing';
}

function moveDrag(e) {
  if (!dragState || !e.lngLat) return;
  const M = dragRotation(
    dragState.start.lng, clampLat(dragState.start.lat),
    e.lngLat.lng, clampLat(e.lngLat.lat)
  );
  const moved = {
    type: 'Feature',
    properties: dragState.feature.properties,
    geometry: rotateGeometry(dragState.feature.geometry, M, e.lngLat.lng)
  };
  selectedFeature = moved;
  map.getSource('selected').setData({ type: 'FeatureCollection', features: [moved] });
}

function endDrag() {
  if (!dragState) return;
  dragState = null;
  map.dragPan.enable();
  map.getCanvas().style.cursor = '';
}

map.on('mousedown', 'selected-fill', startDrag);
map.on('mousedown', 'selected-outline', startDrag);
map.on('mousemove', moveDrag);
map.on('mouseup', endDrag);

map.on('touchstart', 'selected-fill', (e) => {
  if (e.points && e.points.length === 1) startDrag(e);
});
map.on('touchmove', moveDrag);
map.on('touchend', endDrag);
map.on('touchcancel', endDrag);

/* Cursor feedback on hover */
function onSelectedEnter() { if (!dragState) map.getCanvas().style.cursor = 'grab'; }
function onSelectedLeave() { if (!dragState) map.getCanvas().style.cursor = ''; }
map.on('mouseenter', 'selected-fill', onSelectedEnter);
map.on('mouseenter', 'selected-outline', onSelectedEnter);
map.on('mouseleave', 'selected-fill', onSelectedLeave);
map.on('mouseleave', 'selected-outline', onSelectedLeave);

/* ======== Sidebar ======== */

function updateSidebar() {
  const empty = document.getElementById('entity-empty');
  const info = document.getElementById('entity-info');
  if (selectedFeature) {
    empty.style.display = 'none';
    info.style.display = 'flex';
    const props = selectedFeature.properties;
    let displayName = props.name || '(unknown)';
    const nameKey = 'name_' + lang.replace('-', '_').toLowerCase();
    if (props[nameKey]) displayName = props[nameKey];
    if (selectedSource === 'admin1' && props.admin) {
      displayName += ', ' + props.admin;
    }
    document.getElementById('entity-name').textContent = displayName;
    document.getElementById('entity-area').textContent =
      t('area') + ': ' + Math.round(selectedAreaKm2).toLocaleString() + ' km²';
  } else {
    empty.style.display = 'block';
    info.style.display = 'none';
  }
}

/* ======== UI Binding ======== */

function bindUI() {
  // Projection toggle
  document.getElementById('btn-projection').addEventListener('click', () => {
    proj = proj === 'globe' ? 'mercator' : 'globe';
    map.setProjection({ type: proj });
    updateUI();
  });

  // Style selector
  document.getElementById('sel-style').addEventListener('change', (e) => {
    applyStyle(e.target.value);
  });

  // Pick mode
  document.getElementById('sel-pick').addEventListener('change', (e) => {
    pickMode = e.target.value;
  });

  // Roads toggle
  document.getElementById('chk-roads').addEventListener('change', (e) => {
    toggleRoads(e.target.checked);
  });

  // Rivers toggle
  document.getElementById('chk-rivers').addEventListener('change', (e) => {
    toggleRivers(e.target.checked);
  });

  // Language selector
  document.getElementById('sel-lang').addEventListener('change', (e) => {
    switchLang(e.target.value);
  });

  // Entity controls
  document.getElementById('entity-color').addEventListener('input', applyEntityStyle);
  document.getElementById('entity-opacity').addEventListener('input', applyEntityStyle);
  document.getElementById('btn-clear').addEventListener('click', clearSelection);
}

function switchLang(newLang) {
  lang = newLang;
  document.documentElement.lang = newLang;
  document.documentElement.dir = (newLang === 'ar') ? 'rtl' : 'ltr';
  updateUI();
}

function updateUI() {
  const btn = document.getElementById('btn-projection');
  btn.textContent = t(proj === 'globe' ? 'globe' : 'mercator');

  // Update all data-i18n elements (handles text nodes and SPAN children)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (el.tagName === 'OPTION' || el.tagName === 'SPAN') {
      el.textContent = t(key);
    } else {
      // Replace only direct text nodes, leave child elements alone
      el.childNodes.forEach(n => {
        if (n.nodeType === 3) n.textContent = t(key);
      });
    }
  });

  // Update style select options (their value IS the i18n key)
  document.querySelectorAll('#sel-style option').forEach(opt => {
    opt.textContent = t(opt.value);
  });

  updateSidebar();
}
