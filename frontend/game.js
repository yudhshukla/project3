// ═══════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════

const TILE_SIZE   = 24;
const NOISE_SCALE = 8;
const TILE_W      = 64;
const TILE_H      = 32;

let COLS = Math.floor(window.innerWidth  / TILE_SIZE);
let ROWS = Math.floor(window.innerHeight / TILE_SIZE);

// cameraX/Y are set after canvas exists (see INIT section)
let cameraX = 0;
let cameraY = 0;


// ═══════════════════════════════════════════════════════════
//  TERRAIN DEFINITIONS
// ═══════════════════════════════════════════════════════════

const TERRAIN = {
  water:    { color: '#1a5276', label: 'Water',    buildable: false },
  sand:     { color: '#d4ac6e', label: 'Beach',    buildable: true  },
  grass:    { color: '#2e7d32', label: 'Grass',    buildable: true  },
  forest:   { color: '#1b4d1e', label: 'Forest',   buildable: true  },
  mountain: { color: '#616161', label: 'Mountain', buildable: false },
};


// ═══════════════════════════════════════════════════════════
//  ZONE DEFINITIONS
//
//  levelable: false  → right-click upgrade is blocked
//  powerRadius       → Manhattan radius powered by this infra tile
//  maintenanceCost   → $ deducted per tick regardless of connectivity
// ═══════════════════════════════════════════════════════════

const ZONES = {
  // ── Core zones ──
  empty:       { color: null,      label: 'Erase',     key: '1', cost: 0,   group: 'zone' },
  residential: { color: '#4caf50', label: 'Resident',  key: '2', cost: 100, group: 'zone' },
  commercial:  { color: '#2196f3', label: 'Commercl',  key: '3', cost: 200, group: 'zone' },
  industrial:  { color: '#ff9800', label: 'Industrl',  key: '4', cost: 150, group: 'zone' },
  road:        { color: '#9e9e9e', label: 'Road',       key: '5', cost: 50,  group: 'zone' },

  // ── Green space ──
  park:        { color: '#66bb6a', label: 'Park',      key: '6', cost: 80,  group: 'green',
                 levelable: false, maintenanceCost: 1,
                 happinessBonus: 5, desc: '+5 happiness · calms nearby pollution' },

  small_park:  { color: '#81c784', label: 'Sm. Park',  key: 'q', cost: 40,  group: 'green',
                 levelable: false, maintenanceCost: 0,
                 happinessBonus: 3, desc: '+3 happiness · cheap green space' },

  // ── Safety ──
  fire_station: { color: '#ef9a9a', label: 'Fire Stn', key: '8', cost: 250, group: 'safety',
                  levelable: false, maintenanceCost: 4,
                  happinessBonus: 4, desc: '+4 happiness · fire protection' },

  police_station: { color: '#5c6bc0', label: 'Police', key: 'p', cost: 300, group: 'safety',
                  levelable: false, maintenanceCost: 5,
                  crimeReduction: 8, happinessBonus: 2,
                  desc: '-8 crime · +2 happiness · law enforcement' },

  hospital:    { color: '#ef5350', label: 'Hospital',  key: 'h', cost: 400, group: 'safety',
                 levelable: false, maintenanceCost: 8,
                 happinessBonus: 6, desc: '+6 happiness · keeps population healthy' },

  // ── Culture ──
  school:      { color: '#ce93d8', label: 'School',    key: '7', cost: 300, group: 'culture',
                 levelable: false, maintenanceCost: 5,
                 happinessBonus: 4, desc: '+4 happiness · boosts residential output' },

  library:     { color: '#ab47bc', label: 'Library',   key: 'l', cost: 200, group: 'culture',
                 levelable: false, maintenanceCost: 3,
                 happinessBonus: 4, desc: '+4 happiness · culture boost' },

  stadium:     { color: '#ff7043', label: 'Stadium',   key: 'u', cost: 800, group: 'culture',
                 levelable: false, maintenanceCost: 12,
                 happinessBonus: 10, desc: '+10 happiness · massive entertainment boost' },

  // ── Power ──
  power_plant: { color: '#fff176', label: 'Power',     key: '9', cost: 600, group: 'power',
                 levelable: false, maintenanceCost: 10,
                 powerRadius: 6, desc: 'Powers tiles within radius 6' },

  solar_farm:  { color: '#ffcc02', label: 'Solar',      key: 's', cost: 350, group: 'power',
                 levelable: false, maintenanceCost: 3,
                 powerRadius: 4, desc: 'Powers tiles within radius 4 · eco-friendly' },

  wind_turbine: { color: '#b0bec5', label: 'Wind',     key: 't', cost: 150, group: 'power',
                  levelable: false, maintenanceCost: 2,
                  powerRadius: 3, desc: 'Powers tiles within radius 3 · cheapest power' },
};


// ═══════════════════════════════════════════════════════════
//  VALUE NOISE — terrain generator
// ═══════════════════════════════════════════════════════════

function smoothstep(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t)  { return a + (b - a) * t; }

function makeControlGrid(rows, cols, scale) {
  const cw = Math.ceil(cols / scale) + 1;
  const ch = Math.ceil(rows / scale) + 1;
  return Array.from({ length: ch }, () =>
    Array.from({ length: cw }, () => Math.random())
  );
}

function sampleNoise(control, r, c, scale) {
  const cx = c / scale, cy = r / scale;
  const x0 = Math.floor(cx), y0 = Math.floor(cy);
  const tx = smoothstep(cx - x0), ty = smoothstep(cy - y0);
  const v00 = control[y0][x0],   v10 = control[y0][x0+1];
  const v01 = control[y0+1][x0], v11 = control[y0+1][x0+1];
  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
}

function noiseToTerrain(v) {
  if (v < 0.30) return 'water';
  if (v < 0.38) return 'sand';
  if (v < 0.70) return 'grass';
  if (v < 0.82) return 'forest';
  return 'mountain';
}

function generateTerrain(rows, cols) {
  const control = makeControlGrid(rows, cols, NOISE_SCALE);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      noiseToTerrain(sampleNoise(control, r, c, NOISE_SCALE))
    )
  );
}


// ═══════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════

let terrain = generateTerrain(ROWS, COLS);
let zones   = Array.from({ length: ROWS }, () => Array(COLS).fill('empty'));
let levels  = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

let population = 0;
let money      = 1000;
let happiness  = 50;
let crime      = 0;
let taxRate    = 10;
let powerRatio = 0;

const POP_MILESTONES  = [50, 100, 500, 1000, 5000];
let reachedMilestones = new Set();

let tickIntervalId = null;


// ═══════════════════════════════════════════════════════════
//  CANVAS
// ═══════════════════════════════════════════════════════════

const canvas = document.getElementById('grid-canvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();


// ═══════════════════════════════════════════════════════════
//  POWER COVERAGE
// ═══════════════════════════════════════════════════════════

function computePowerGrid() {
  const powered = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const zd = ZONES[zones[row][col]];
      if (!zd || !zd.powerRadius) continue;
      const radius = zd.powerRadius;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) + Math.abs(dc) > radius) continue;
          const r = row + dr, c = col + dc;
          if (inBounds(r, c)) powered[r][c] = true;
        }
      }
    }
  }
  return powered;
}


// ═══════════════════════════════════════════════════════════
//  DRAWING
// ═══════════════════════════════════════════════════════════

const SERVICE_ICONS = {
  park: '🌳', small_park: '🌿', school: 'S', fire_station: 'F',
  hospital: 'H', police_station: 'P', library: 'L', stadium: '🏟',
  power_plant: '⚡', solar_farm: '☀', wind_turbine: '🌀',
};

// Converts grid (row, col) to isometric screen position (top-center of diamond)
function toScreen(row, col) {
  return {
    sx: (col - row) * (TILE_W / 2) + cameraX,
    sy: (col + row) * (TILE_H / 2) + cameraY,
  };
}

const WALL_H = 14; // pixel height of building side faces

// Reusable path for the top diamond (no fill/stroke — caller does that)
function diamondPath(sx, sy) {
  ctx.beginPath();
  ctx.moveTo(sx,             sy);
  ctx.lineTo(sx + TILE_W/2, sy + TILE_H/2);
  ctx.lineTo(sx,             sy + TILE_H);
  ctx.lineTo(sx - TILE_W/2, sy + TILE_H/2);
  ctx.closePath();
}

// Fills the top diamond, then darkens it by `darken` (0 = none, 1 = black)
function drawDiamond(sx, sy, color, alpha = 1, darken = 0) {
  diamondPath(sx, sy);
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = color;
  ctx.fill();
  if (darken > 0) {
    ctx.globalAlpha = darken;
    ctx.fillStyle   = '#000';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Draws the left wall face (south-west, lighter shade)
function drawLeftFace(sx, sy, color, alpha = 1) {
  ctx.beginPath();
  ctx.moveTo(sx - TILE_W/2, sy + TILE_H/2);
  ctx.lineTo(sx,             sy + TILE_H);
  ctx.lineTo(sx,             sy + TILE_H + WALL_H);
  ctx.lineTo(sx - TILE_W/2, sy + TILE_H/2 + WALL_H);
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = color;
  ctx.fill();
  // darken the left face slightly
  ctx.globalAlpha = 0.25;
  ctx.fillStyle   = '#000';
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Draws the right wall face (south-east, darker shade)
function drawRightFace(sx, sy, color, alpha = 1) {
  ctx.beginPath();
  ctx.moveTo(sx,             sy + TILE_H);
  ctx.lineTo(sx + TILE_W/2, sy + TILE_H/2);
  ctx.lineTo(sx + TILE_W/2, sy + TILE_H/2 + WALL_H);
  ctx.lineTo(sx,             sy + TILE_H + WALL_H);
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = color;
  ctx.fill();
  // darken the right face more — simulates shadow
  ctx.globalAlpha = 0.45;
  ctx.fillStyle   = '#000';
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGrid() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const powered = computePowerGrid();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const { sx, sy } = toScreen(row, col);
      const terrainColor = TERRAIN[terrain[row][col]].color;
      const zone = zones[row][col];

      // ── Terrain top face (always flat, no walls) ──
      drawDiamond(sx, sy, terrainColor);

      if (zone !== 'empty') {
        const connected = isConnectedToRoad(row, col);
        const isPowered = powered[row][col];
        const zoneColor = ZONES[zone].color;

        let alpha = connected ? 1 : 0.4;
        if (connected && !isPowered && zone !== 'road' && zone !== 'power_plant') {
          alpha = 0.6;
        }

        // ── Zone side faces (give the 3D box look) ──
        if (zone !== 'road') {
          drawLeftFace(sx, sy, zoneColor, alpha);
          drawRightFace(sx, sy, zoneColor, alpha);
        }

        // ── Zone top face (slightly darkened if disconnected) ──
        drawDiamond(sx, sy, zoneColor, alpha, connected ? 0 : 0.15);

        // Icon or level number centered on top face
        ctx.fillStyle    = 'rgba(255,255,255,0.95)';
        ctx.font         = 'bold 10px monospace';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';

        if (SERVICE_ICONS[zone]) {
          ctx.fillText(SERVICE_ICONS[zone], sx, sy + TILE_H / 2);
        } else if (zone !== 'road') {
          ctx.fillText(levels[row][col] || '0', sx, sy + TILE_H / 2);
        }
      }

      // ── Diamond border outline ──
      diamondPath(sx, sy);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth   = 0.5;
      ctx.stroke();
    }
  }
}


// ═══════════════════════════════════════════════════════════
//  TOOLBAR
// ═══════════════════════════════════════════════════════════

const GROUP_META = {
  zone:    { label: 'Zones',   icon: '🏗' },
  green:   { label: 'Parks',   icon: '🌳' },
  safety:  { label: 'Safety',  icon: '🚒' },
  culture: { label: 'Culture', icon: '📚' },
  power:   { label: 'Power',   icon: '⚡' },
};

const groupZones = {};
Object.entries(ZONES).forEach(([key, z]) => {
  if (!groupZones[z.group]) groupZones[z.group] = [];
  groupZones[z.group].push(key);
});

let activeTool    = 'empty';
let activeGroup   = null;
const tray        = document.getElementById('tool-tray');
const groupTabBar = document.getElementById('group-tabs');

Object.entries(GROUP_META).forEach(([groupKey, meta]) => {
  const tab = document.createElement('button');
  tab.className     = 'group-tab';
  tab.dataset.group = groupKey;
  tab.innerHTML     = `<span class="tab-icon">${meta.icon}</span>${meta.label}`;
  tab.addEventListener('click', () => toggleGroup(groupKey));
  groupTabBar.appendChild(tab);
});

function toggleGroup(groupKey) {
  if (activeGroup === groupKey) {
    activeGroup = null;
    tray.innerHTML = '';
    tray.classList.remove('open');
    document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
    return;
  }
  activeGroup = groupKey;
  document.querySelectorAll('.group-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.group === groupKey)
  );

  tray.innerHTML = '';
  (groupZones[groupKey] || []).forEach(zoneKey => {
    const zone = ZONES[zoneKey];
    const btn  = document.createElement('button');
    btn.className    = 'tool-btn' + (zoneKey === activeTool ? ' selected' : '');
    btn.dataset.zone = zoneKey;
    const swatchColor = zone.color ?? '#2d2d44';
    btn.innerHTML = `
      <div class="swatch" style="background:${swatchColor}"></div>
      ${zone.label}
      <span class="key-hint">[${zone.key}]${zone.cost > 0 ? ' · $' + zone.cost : ''}</span>
    `;
    btn.addEventListener('click', () => selectTool(zoneKey));
    tray.appendChild(btn);
  });
  tray.classList.add('open');
}

function selectTool(zoneKey) {
  activeTool = zoneKey;
  document.querySelectorAll('.tool-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.zone === zoneKey)
  );
  document.getElementById('stat-tool').textContent = ZONES[zoneKey].label;
}

window.addEventListener('keydown', e => {
  const match = Object.entries(ZONES).find(([, z]) => z.key === e.key);
  if (match) {
    const [zoneKey, zone] = match;
    if (activeGroup !== zone.group) toggleGroup(zone.group);
    selectTool(zoneKey);
  }
  if (e.key === 'r' || e.key === 'R') newMap();
  if (e.key === ' ') { e.preventDefault(); togglePause(); }
  if (e.key === 'f' || e.key === 'F') setTickSpeed('fast');
});


// ═══════════════════════════════════════════════════════════
//  CITY NAMING
// ═══════════════════════════════════════════════════════════

const cityNameEl = document.getElementById('city-name');

cityNameEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); cityNameEl.blur(); }
});
cityNameEl.addEventListener('keydown', e => e.stopPropagation());


// ═══════════════════════════════════════════════════════════
//  TAX RATE SLIDER
// ═══════════════════════════════════════════════════════════

const taxSlider = document.getElementById('tax-slider');

taxSlider.addEventListener('input', () => {
  taxRate = parseInt(taxSlider.value);
  document.getElementById('stat-tax').textContent = taxRate + '%';
});


// ═══════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════

let toastTimeout = null;

function showToast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('visible'), 2000);
}


// ═══════════════════════════════════════════════════════════
//  EVENT LOG
// ═══════════════════════════════════════════════════════════

const eventLog = [];

function addEvent(msg) {
  eventLog.unshift(msg);
  if (eventLog.length > 5) eventLog.pop();
  document.getElementById('log-entries').innerHTML =
    eventLog.map(m => `<div class="log-entry">${m}</div>`).join('');
}


// ═══════════════════════════════════════════════════════════
//  DEMAND METER (RCI)
// ═══════════════════════════════════════════════════════════

function updateDemandBars(r, c, i) {
  const wantR = Math.max(0, c * 3 - r);
  const wantC = Math.max(0, r / 3 - c);
  const wantI = Math.max(0, c / 2 - i);
  const scale = 15;
  const pctR  = Math.min(100, Math.round(wantR / scale * 100));
  const pctC  = Math.min(100, Math.round(wantC / scale * 100));
  const pctI  = Math.min(100, Math.round(wantI / scale * 100));
  document.getElementById('demand-r').style.width     = pctR + '%';
  document.getElementById('demand-c').style.width     = pctC + '%';
  document.getElementById('demand-i').style.width     = pctI + '%';
  document.getElementById('demand-r-pct').textContent = pctR + '%';
  document.getElementById('demand-c-pct').textContent = pctC + '%';
  document.getElementById('demand-i-pct').textContent = pctI + '%';
}


// ═══════════════════════════════════════════════════════════
//  HAPPINESS & CRIME
// ═══════════════════════════════════════════════════════════

function computeCrime(i, policeStations) {
  const raw = i * 5 - policeStations * 8;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function computeHappiness(r, c, i, parks, schools, fireStations, hospitals, libraries, stadiums) {
  let h = 50;
  h += Math.min(30, c * 3);
  h += Math.min(25, parks * 5);
  h += Math.min(20, schools * 4);
  h += Math.min(20, fireStations * 4);
  h += Math.min(24, hospitals * 6);
  h += Math.min(16, libraries * 4);
  h += Math.min(20, stadiums * 10);
  h -= i * 4;
  h -= Math.round(crime / 5);
  h -= Math.round((taxRate - 10) * 1.2);
  if (powerRatio < 1) h -= Math.round((1 - powerRatio) * 20);
  if (money < 200) h -= 15;
  return Math.max(0, Math.min(100, Math.round(h)));
}


// ═══════════════════════════════════════════════════════════
//  TIME CONTROLS
// ═══════════════════════════════════════════════════════════

const SPEEDS     = { pause: 0, normal: 1000, fast: 300 };
let currentSpeed = 'normal';

function setTickSpeed(speed) {
  currentSpeed = speed;
  clearInterval(tickIntervalId);
  if (SPEEDS[speed] > 0) tickIntervalId = setInterval(simulateTick, SPEEDS[speed]);
  document.getElementById('btn-pause').classList.toggle('active',  speed === 'pause');
  document.getElementById('btn-normal').classList.toggle('active', speed === 'normal');
  document.getElementById('btn-fast').classList.toggle('active',   speed === 'fast');
}

function togglePause() {
  setTickSpeed(currentSpeed === 'pause' ? 'normal' : 'pause');
}

document.getElementById('btn-pause').addEventListener('click',  () => setTickSpeed('pause'));
document.getElementById('btn-normal').addEventListener('click', () => setTickSpeed('normal'));
document.getElementById('btn-fast').addEventListener('click',   () => setTickSpeed('fast'));


// ═══════════════════════════════════════════════════════════
//  MOUSE INTERACTION
// ═══════════════════════════════════════════════════════════

let isMouseDown = false;
let isPanning   = false;
let lastPanX    = 0;
let lastPanY    = 0;

function pixelToTile(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  // Convert mouse position to canvas-relative coords
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  // Invert the isometric transform
  const dx = (sx - cameraX) / (TILE_W / 2);
  const dy = (sy - cameraY) / (TILE_H / 2);
  return {
    col: Math.floor((dx + dy) / 2),
    row: Math.floor((dy - dx) / 2),
  };
}

function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function paintTile(clientX, clientY) {
  const { row, col } = pixelToTile(clientX, clientY);
  if (!inBounds(row, col)) return;

  const t = terrain[row][col];
  if (!TERRAIN[t].buildable && activeTool !== 'empty') return;
  if (zones[row][col] === activeTool) return;

  if (ZONES[activeTool].cost > money) { showToast('Not enough money!'); return; }

  if (activeTool !== 'empty')       money -= ZONES[activeTool].cost;
  if (zones[row][col] !== 'empty')  money += ZONES[zones[row][col]].cost * 0.75;

  zones[row][col]  = activeTool;
  levels[row][col] = 0;
  drawGrid();
  updateHUD();
}

canvas.addEventListener('contextmenu', e => { e.preventDefault(); levelUpZone(e.clientX, e.clientY); });

canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { isMouseDown = true; paintTile(e.clientX, e.clientY); }
  if (e.button === 1) { isPanning = true; lastPanX = e.clientX; lastPanY = e.clientY; e.preventDefault(); }
});

canvas.addEventListener('mousemove', e => {
  // Pan camera on middle-click drag
  if (isPanning) {
    cameraX += e.clientX - lastPanX;
    cameraY += e.clientY - lastPanY;
    lastPanX = e.clientX;
    lastPanY = e.clientY;
    drawGrid();
  }

  if (isMouseDown) paintTile(e.clientX, e.clientY);
  const { row, col } = pixelToTile(e.clientX, e.clientY);
  if (!inBounds(row, col)) return;

  const t    = terrain[row][col];
  const zone = zones[row][col];
  const hud  = document.getElementById('hud-tile');
  const powered = computePowerGrid();

  if (zone === 'empty') {
    hud.innerHTML = `
      <div class="tile-header">${TERRAIN[t].label}</div>
      <div class="tile-row">(${col}, ${row})</div>
      <div class="tile-row">${TERRAIN[t].buildable ? '✓ Buildable' : '⛔ Unbuildable'}</div>
    `;
    return;
  }

  const connected = isConnectedToRoad(row, col);
  const isPowered = powered[row][col];
  const lvl       = levels[row][col] || 0;
  const weight    = lvl || 1;
  const zoneData  = ZONES[zone];

  let outputLine = '—';
  if (zone === 'residential') outputLine = `+${weight * 10} pop/tick`;
  else if (zone === 'commercial') outputLine = `+$${Math.round(weight * 5 * (taxRate/10))}/tick`;
  else if (zone === 'industrial') outputLine = `-$${weight * 3}/tick · supplies commercial`;
  else if (zoneData.desc) outputLine = zoneData.desc;

  const upgradeLine = zoneData.levelable === false
    ? 'Not upgradeable'
    : lvl < 5 ? `$${Math.round((zoneData.cost / 2) * (lvl + 1))} (right-click)` : 'MAX';

  hud.innerHTML = `
    <div class="tile-header">${zoneData.label}${zoneData.levelable !== false ? ' — Lv ' + lvl : ''}</div>
    <div class="tile-row">Terrain: <span>${TERRAIN[t].label}</span></div>
    <div class="tile-row">Road:    <span>${connected ? '✓ Connected' : '✗ No road'}</span></div>
    <div class="tile-row">Power:   <span>${isPowered ? '✓ Powered' : '✗ No power'}</span></div>
    <div class="tile-row">Output:  <span>${connected ? outputLine : '(needs road)'}</span></div>
    <div class="tile-row">Upgrade: <span>${upgradeLine}</span></div>
  `;
});

window.addEventListener('mouseup', e => {
  if (e.button === 0) isMouseDown = false;
  if (e.button === 1) isPanning   = false;
});


// ═══════════════════════════════════════════════════════════
//  ROAD CONNECTIVITY
// ═══════════════════════════════════════════════════════════

function isConnectedToRoad(row, col) {
  if (zones[row][col] === 'road') return true;
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  return dirs.some(([dr,dc]) => {
    const r = row + dr, c = col + dc;
    return inBounds(r, c) && zones[r][c] === 'road';
  });
}


// ═══════════════════════════════════════════════════════════
//  ZONE LEVEL UP  (right-click)
// ═══════════════════════════════════════════════════════════

function levelUpZone(clientX, clientY) {
  const { row, col } = pixelToTile(clientX, clientY);
  if (!inBounds(row, col)) return;

  const zone = zones[row][col];
  if (zone === 'empty' || zone === 'road') return;
  if (ZONES[zone].levelable === false) { showToast('This building cannot be upgraded.'); return; }
  if (!isConnectedToRoad(row, col)) { showToast('Connect to a road first!'); return; }
  if (levels[row][col] >= 5) { showToast('Already max level!'); return; }

  const cost = Math.round((ZONES[zone].cost / 2) * (levels[row][col] + 1));
  if (money < cost) { showToast('Not enough money to level up!'); return; }

  money -= cost;
  levels[row][col]++;
  addEvent(`${ZONES[zone].label} leveled up to Lv ${levels[row][col]}!`);
  drawGrid();
  updateHUD();
}


// ═══════════════════════════════════════════════════════════
//  SIMULATION TICK
// ═══════════════════════════════════════════════════════════

function simulateTick() {
  let r = 0, c = 0, i = 0;
  let parks = 0, smallParks = 0, schools = 0, fireStations = 0;
  let hospitals = 0, policeStations = 0, libraries = 0, stadiums = 0;
  let poweredZoneTiles = 0, totalZoneTiles = 0;

  const powered = computePowerGrid();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const zone = zones[row][col];
      if (zone === 'empty' || zone === 'road') continue;

      const connected = isConnectedToRoad(row, col);
      const isPowered = powered[row][col];
      const weight    = levels[row][col] || 1;

      if (zone === 'park')            parks++;
      if (zone === 'small_park')      smallParks++;
      if (zone === 'school')          schools++;
      if (zone === 'fire_station')    fireStations++;
      if (zone === 'hospital')        hospitals++;
      if (zone === 'police_station')  policeStations++;
      if (zone === 'library')         libraries++;
      if (zone === 'stadium')         stadiums++;

      if (ZONES[zone].maintenanceCost) money -= ZONES[zone].maintenanceCost;

      if (!connected) continue;

      totalZoneTiles++;
      if (isPowered) poweredZoneTiles++;

      if (zone === 'residential') r += weight;
      if (zone === 'commercial')  c += weight;
      if (zone === 'industrial')  i += weight;
    }
  }

  powerRatio = totalZoneTiles === 0 ? 1 : poweredZoneTiles / totalZoneTiles;
  const powerEfficiency = 0.7 + powerRatio * 0.3;

  const prevCrime = crime;
  crime = computeCrime(i, policeStations);
  if (crime > 50 && prevCrime <= 50) addEvent('🚨 Crime is rising! Build police stations.');
  if (crime === 0 && prevCrime > 0)  addEvent('✅ Crime rate is now zero!');

  happiness = computeHappiness(r, c, i, parks + smallParks, schools, fireStations, hospitals, libraries, stadiums);

  const taxMultiplier       = taxRate / 10;
  const happinessMultiplier = 0.5 + (happiness / 100);
  const supplyMultiplier    = Math.min(1.5, 0.6 + (i / Math.max(1, c)) * 0.8);
  const crimeMultiplier     = 1 - (crime / 200);

  population  = Math.round(r * 10 * powerEfficiency);
  money      += Math.round(c * 5 * taxMultiplier * happinessMultiplier * supplyMultiplier * powerEfficiency * crimeMultiplier);
  money      -= i * 3;
  if (money < 0) money = 0;

  updateHUD();
  updateDemandBars(r, c, i);

  for (const milestone of POP_MILESTONES) {
    if (population >= milestone && !reachedMilestones.has(milestone)) {
      reachedMilestones.add(milestone);
      addEvent(`🏙 Population reached ${milestone}!`);
    }
  }

  if (money < 200 && money > 0) addEvent(`⚠ Low funds! $${money} left.`);
}


// ═══════════════════════════════════════════════════════════
//  HUD UPDATE
// ═══════════════════════════════════════════════════════════

function updateHUD() {
  document.getElementById('stat-pop').textContent       = population;
  document.getElementById('stat-money').textContent     = money;
  document.getElementById('stat-happiness').textContent = happiness;
  document.getElementById('happiness-fill').style.width = happiness + '%';

  const pwr = Math.round(powerRatio * 100);
  document.getElementById('stat-power').textContent     = pwr + '%';
  document.getElementById('power-fill').style.width     = pwr + '%';

  document.getElementById('stat-crime').textContent     = crime + '%';
  document.getElementById('crime-fill').style.width     = crime + '%';
}


// ═══════════════════════════════════════════════════════════
//  NEW MAP
// ═══════════════════════════════════════════════════════════

function newMap() {
  terrain           = generateTerrain(ROWS, COLS);
  zones             = Array.from({ length: ROWS }, () => Array(COLS).fill('empty'));
  levels            = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  population        = 0;
  money             = 1000;
  happiness         = 50;
  crime             = 0;
  powerRatio        = 0;
  reachedMilestones = new Set();
  addEvent('New city started.');
  drawGrid();
  updateHUD();
  updateDemandBars(0, 0, 0);
}

document.getElementById('btn-newmap').addEventListener('click', newMap);


// ═══════════════════════════════════════════════════════════
//  WINDOW RESIZE
// ═══════════════════════════════════════════════════════════

window.addEventListener('resize', () => {
  const newCols = Math.floor(window.innerWidth  / TILE_SIZE);
  const newRows = Math.floor(window.innerHeight / TILE_SIZE);
  while (zones.length  < newRows) zones.push(Array(newCols).fill('empty'));
  while (levels.length < newRows) levels.push(Array(newCols).fill(0));
  zones.forEach(row  => { while (row.length < newCols) row.push('empty'); });
  levels.forEach(row => { while (row.length < newCols) row.push(0); });
  if (newCols > COLS || newRows > ROWS) terrain = generateTerrain(newRows, newCols);
  COLS = newCols; ROWS = newRows;
  resizeCanvas();
  drawGrid();
});


// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════

// Center the map: row 0 col 0 starts at top-center of screen
cameraX = canvas.width / 2;
cameraY = TILE_H * 2;

addEvent('New city started.');
drawGrid();
updateHUD();
updateDemandBars(0, 0, 0);
setTickSpeed('normal');
