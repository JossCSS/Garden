/* game.js
 * Ramo 3D (solo la primera vez) + jardín libre: flores en cualquier lugar, pasto que
 * brota al regar, pala para quitar piedras, tienda, mochila, decoraciones y reinicio.
 * Guarda en MongoDB por /api/garden (Netlify Function) y en el dispositivo como respaldo.
 */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const V3 = THREE.Vector3;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =====================================================================
  // Ajustes del juego (cámbialos aquí)
  // =====================================================================
  const CFG = {
    startGrid: 4,        // tamaño inicial del jardín (4 × 4)
    maxGrid: 6,          // tamaño máximo comprable
    maxHeight: 4,        // niveles extra de altura cuando el jardín está lleno
    slotsPerCell: 1.5,   // cuántas plantas caben por cada metro cuadrado de tierra
    xp: [8, 18],         // XP aleatoria por flor regada
    coins: [4, 12],      // monedas aleatorias por flor regada
    growth: 0.25,        // crecimiento por riego (4 riegos = flor adulta)
    startCoins: 60,
    grassMax: 220,       // máximo de manchitas de pasto dentro del jardín
  };
  const LAND_PRICE = { 5: 150, 6: 320 };

  const SEEDS = [
    { id: 'margarita', name: 'Margarita', price: 10, desc: 'Sencilla y alegre.' },
    { id: 'nube', name: 'Nube', price: 12, desc: 'Ramitas con bolitas diminutas.' },
    { id: 'tulipan', name: 'Tulipán', price: 15, desc: 'Pétalos cerrados como un abrazo.' },
    { id: 'lavanda', name: 'Lavanda', price: 18, desc: 'Espigas que huelen a calma.' },
    { id: 'campanilla', name: 'Campanilla', price: 20, desc: 'Tres campanitas colgando.' },
    { id: 'cosmos', name: 'Cosmos', price: 22, desc: 'Pétalos anchos y onduladitos.' },
    { id: 'rosa', name: 'Rosa', price: 25, desc: 'La clásica, en muchos colores.' },
    { id: 'amapola', name: 'Amapola', price: 28, desc: 'Pétalos finos como papel.' },
    { id: 'clavel', name: 'Clavel', price: 30, desc: 'Orillas rizadas y esponjosas.' },
    { id: 'girasol', name: 'Girasol', price: 30, desc: 'Alto y siempre buscando la luz.' },
    { id: 'hortensia', name: 'Hortensia', price: 40, desc: 'Un pompón de florecitas.' },
    { id: 'lirio', name: 'Lirio', price: 50, desc: 'Pétalos largos que se curvan.' },
    { id: 'peonia', name: 'Peonía', price: 65, desc: 'Llena de pétalos, suave como nube.' },
    { id: 'luna', name: 'Flor de luna', price: 120, desc: 'Brilla un poquito, incluso de día.' },
    { id: 'cerezo', name: 'Cerezo', price: 150, desc: 'Árbol de flores rosas. Ocupa más espacio.' },
    { id: 'jacaranda', name: 'Jacaranda', price: 170, desc: 'Árbol de flores moradas. Ocupa más espacio.' },
  ];
  const DECOR = [
    { id: 'caminito', name: 'Caminito de piedras', price: 30, desc: 'Piedras planas para pisar.' },
    { id: 'rehilete', name: 'Rehilete', price: 35, desc: 'Gira solito con el viento.' },
    { id: 'hongo', name: 'Hongos', price: 40, desc: 'Una familia de hongos con lunares.' },
    { id: 'cerca', name: 'Cerquita blanca', price: 45, desc: 'Para marcar un rincón.' },
    { id: 'arbusto', name: 'Arbusto florido', price: 55, desc: 'Redondito y con florecitas.' },
    { id: 'farolito', name: 'Farolito de papel', price: 60, desc: 'Brilla rosa y se mece.' },
    { id: 'letrero', name: 'Letrero', price: 70, desc: 'Escríbele lo que tú quieras.' },
    { id: 'casita', name: 'Casita de pájaros', price: 85, desc: 'Por si llega alguien a cantar.' },
    { id: 'globo', name: 'Globo de corazón', price: 90, desc: 'Flota y se balancea.' },
    { id: 'banca', name: 'Banca', price: 120, desc: 'Para sentarse a ver crecer las flores.' },
    { id: 'farol', name: 'Farol de jardín', price: 140, desc: 'Luz cálida para la tarde.' },
    { id: 'estanque', name: 'Estanque', price: 160, desc: 'Agua quieta con hojas flotando.' },
    { id: 'molino', name: 'Molino', price: 180, desc: 'Aspas de colores que no paran.' },
    { id: 'arco', name: 'Arco de flores', price: 220, desc: 'Una entrada llena de flores.' },
    { id: 'fuente', name: 'Fuente', price: 300, desc: 'Agua que salta sin parar.' },
  ];
  const seedInfo = (id) => SEEDS.find((s) => s.id === id);
  const decorInfo = (id) => DECOR.find((d) => d.id === id);
  const isTree = (t) => Models.isTree(t);
  const slotsOf = (t) => (isTree(t) ? 3 : 1);

  // Ramo inicial: tipo y tono
  const BOUQUET = [
    ['rosa', 0], ['peonia', 0], ['rosa', 2], ['tulipan', 0], ['lirio', 0], ['hortensia', 1], ['rosa', 4],
    ['margarita', 0], ['clavel', 0], ['lavanda', 0], ['cosmos', 0], ['peonia', 1], ['rosa', 0], ['tulipan', 3],
    ['campanilla', 0], ['amapola', 2], ['hortensia', 0],
  ];

  // Medidas del macetero
  const BASE_H = 0.14, DIRT_TOP = 0.78, FRAME_TOP = 0.88, FRAME_T = 0.14;
  const BOUQUET_Y = 0.85;

  // =====================================================================
  // Estado
  // =====================================================================
  const fmtDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => fmtDay(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return fmtDay(d); };
  const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

  const halfOf = (n) => n / 2;
  const baseHalfOf = (n) => halfOf(n) + FRAME_T + 0.3;

  function genObstacles(s) {
    const types = ['piedra', 'piedra', 'tronco', 'maleza', 'piedra', 'maleza', 'tronco', 'piedra', 'maleza', 'piedra', 'piedra', 'tronco'];
    const out = [];
    for (const type of types) {
      for (let k = 0; k < 60; k++) {
        const a = rand(0, Math.PI * 2), r = rand(baseHalfOf(s.grid) + 0.55, 5.4);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 0.95)) continue;
        out.push({ id: s.nextId++, type, x: +x.toFixed(2), z: +z.toFixed(2), s: +rand(0.8, 1.2).toFixed(2), r: +rand(0, 6.28).toFixed(2) });
        break;
      }
    }
    return out;
  }
  function freshState() {
    const s = {
      v: 2, placed: false, coins: CFG.startCoins, xp: 0, level: 1, grid: CFG.startGrid, heightCap: 0,
      streak: 0, lastWaterDay: null, plants: [], grass: [], seeds: { margarita: 2 }, bag: {}, decor: [],
      obstacles: [], nextId: 1, updatedAt: 0,
    };
    s.obstacles = genObstacles(s);
    return s;
  }
  function sanitize(src) {
    const base = freshState();
    const o = Object.assign(base, src && typeof src === 'object' ? src : {});
    o.grid = clamp(o.grid | 0, 3, CFG.maxGrid);
    o.heightCap = clamp(o.heightCap | 0, 0, CFG.maxHeight);
    const h = halfOf(o.grid) - 0.15;
    o.plants = (Array.isArray(o.plants) ? o.plants : []).filter((p) => p && Models.FLOWER_TYPES.includes(p.type)).map((p) => {
      if (p.x == null && p.i != null) { // jardines de la versión con cuadritos
        p.x = p.i - (o.grid - 1) / 2 + rand(-0.2, 0.2);
        p.z = p.j - (o.grid - 1) / 2 + rand(-0.2, 0.2);
        delete p.i; delete p.j;
      }
      p.x = clamp(+p.x || 0, -h, h); p.z = clamp(+p.z || 0, -h, h);
      if (p.k == null) p.k = +rand(0.8, 1.25).toFixed(2);
      if (p.v == null) p.v = +rand(0.35, 1).toFixed(2);
      if (p.tone == null) p.tone = 0;
      p.g = +p.g || 0.05;
      return p;
    });
    o.grass = Array.isArray(o.grass) ? o.grass.slice(0, CFG.grassMax) : [];
    o.decor = (Array.isArray(o.decor) ? o.decor : []).filter((d) => d && Models.DECOR_TYPES.includes(d.type));
    o.obstacles = Array.isArray(o.obstacles) ? o.obstacles : [];
    o.seeds = o.seeds && typeof o.seeds === 'object' ? o.seeds : {};
    o.bag = o.bag && typeof o.bag === 'object' ? o.bag : {};
    o.v = 2;
    return o;
  }

  const API = '/api/garden';
  const params = new URLSearchParams(location.search);
  let gardenId = params.get('jardin') || safeGet('jardin:id');
  if (!gardenId || !/^[\w-]{3,64}$/.test(gardenId)) {
    gardenId = 'j-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  safeSet('jardin:id', gardenId);
  const LS_KEY = 'jardin:state:' + gardenId;

  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* modo privado */ } }

  async function fetchJSON(url, opts = {}, ms = 7000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try {
      const r = await fetch(url, Object.assign({}, opts, { signal: c.signal }));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function loadState() {
    let local = null;
    try { local = JSON.parse(safeGet(LS_KEY)); } catch { /* nada */ }
    let remote = null;
    try {
      const r = await fetchJSON(`${API}?id=${encodeURIComponent(gardenId)}`);
      remote = r.state;
    } catch { /* sin servidor: usamos el dispositivo */ }
    const useRemote = remote && (!local || (remote.updatedAt || 0) >= (local.updatedAt || 0));
    return sanitize(useRemote ? remote : local);
  }

  let state = freshState();
  let saveTimer = null;
  function save() {
    state.updatedAt = Date.now();
    safeSet(LS_KEY, JSON.stringify(state));
    setSaveLabel('Guardando…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushRemote, 700);
  }
  async function pushRemote() {
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(gardenId)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }),
      });
      if (r.status === 409) {
        // otro dispositivo guardó algo más nuevo: lo adoptamos
        const data = await r.json();
        if (data.state) adoptRemote(data.state, true);
        return;
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setSaveLabel('Guardado');
    } catch {
      setSaveLabel('Guardado solo en este dispositivo');
    }
  }
  function setSaveLabel(t) {
    const el = $('#saveState');
    el.textContent = t;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // =====================================================================
  // Escena
  // =====================================================================
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#f9d2df', 26, 75);

  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
  const INTRO_TARGET = new V3(0, 1.8, 0);
  const introCam = () => new V3(0, 2.4, 5.0 * Math.max(1, Math.pow(0.8 / (innerWidth / innerHeight), 0.7)));
  camera.position.copy(introCam());

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.copy(INTRO_TARGET);
  controls.minDistance = 2.2;
  controls.maxDistance = 12;
  controls.enablePan = false;
  controls.maxPolarAngle = 1.55;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 1.1;
  let idleTimer = null;
  controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idleTimer); });
  controls.addEventListener('end', () => {
    if (view !== 'intro' || reduceMotion) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { controls.autoRotate = view === 'intro'; }, 6000);
  });

  function skyTexture() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#ffeef5'); g.addColorStop(0.55, '#fbd3e1'); g.addColorStop(1, '#f5b3c8');
    x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    return new THREE.CanvasTexture(c);
  }

  scene.add(new THREE.HemisphereLight('#ffffff', '#f2a2bd', 0.62));
  const sun = new THREE.DirectionalLight('#fff6f0', 0.62);
  sun.position.set(5, 11, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 64), new THREE.MeshStandardMaterial({ color: '#f5bfd1', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- Terreno de alrededor: pasto, flores silvestres, árboles, colinas ----------
  const ambientTrees = [];
  function instanced(geo, mat, n) {
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    return im;
  }
  (function surroundings() {
    const o = new THREE.Object3D(), col = new THREE.Color();
    // colinas lejanas
    const hills = ['#f7a8c4', '#b8e2cf', '#f9c6d8', '#d9c7f2', '#fbd0dc'];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(-0.15, 0.15), d = rand(32, 44), r = rand(4, 7);
      const s = new THREE.Mesh(Models.sphereGeo(1, 20, 14), Models.mat(pick(hills), { roughness: 1 }));
      s.scale.set(r * 1.6, r * 0.7, r);
      s.position.set(Math.cos(a) * d, -r * 0.15, Math.sin(a) * d);
      s.rotation.y = -a;
      scene.add(s);
    }
    // pasto en matitas
    const grassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.9 });
    const greens = ['#9ad7a8', '#b3e2b6', '#86c99a', '#c5ead0'];
    const TU = 360, PER = 6;
    const meadow = instanced(Models.grassGeo(), grassMat, TU * PER);
    for (let i = 0; i < TU; i++) {
      const a = rand(0, Math.PI * 2), r = 6 + Math.pow(Math.random(), 0.8) * 20;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, sc = rand(0.8, 1.4);
      for (let k = 0; k < PER; k++) {
        o.position.set(cx + rand(-0.12, 0.12) * sc, 0, cz + rand(-0.12, 0.12) * sc);
        o.rotation.set(rand(-0.35, 0.35), rand(0, 6.28), 0);
        o.scale.set(sc, sc * rand(0.6, 1.1), sc);
        o.updateMatrix();
        meadow.setMatrixAt(i * PER + k, o.matrix);
        meadow.setColorAt(i * PER + k, col.set(pick(greens)));
      }
    }
    scene.add(meadow);
    // matitas de pasto cerca del jardín
    const tufts = instanced(Models.grassGeo(), grassMat, 420);
    for (let i = 0; i < 60; i++) {
      const a = rand(0, Math.PI * 2), r = rand(3.2, 6);
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      for (let k = 0; k < 7; k++) {
        o.position.set(cx + rand(-0.15, 0.15), 0, cz + rand(-0.15, 0.15));
        o.rotation.set(rand(-0.3, 0.3), rand(0, 6.28), 0);
        o.scale.set(1, rand(0.7, 1.3), 1);
        o.updateMatrix();
        tufts.setMatrixAt(i * 7 + k, o.matrix);
        tufts.setColorAt(i * 7 + k, col.set(pick(greens)));
      }
    }
    scene.add(tufts);
    // flores silvestres
    const F = 320;
    const wild = instanced(Models.sphereGeo(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), F);
    const wcols = ['#ffffff', '#ffd166', '#ff9fc0', '#c9b3f0', '#ff7fa8', '#a8c4ff'];
    for (let i = 0; i < F; i++) {
      const a = rand(0, Math.PI * 2), r = rand(3.4, 22);
      o.position.set(Math.cos(a) * r, 0.14, Math.sin(a) * r);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(rand(0.8, 1.4));
      o.updateMatrix();
      wild.setMatrixAt(i, o.matrix);
      wild.setColorAt(i, col.set(pick(wcols)));
    }
    scene.add(wild);
    // árboles lejanos
    [[-8, -9, 'cerezo'], [10, -7.5, 'jacaranda'], [-12, 4, 'cerezo'], [12.5, 6, 'cerezo'], [-5, 12.5, 'jacaranda'], [6, 13, 'cerezo'], [0, -14, 'cerezo']].forEach(([x, z, t]) => {
      const tr = Models.buildFlower(t, { tone: 0 });
      tr.position.set(x, 0, z);
      tr.scale.setScalar(rand(1.7, 2.3));
      tr.rotation.y = rand(0, 6.28);
      tr.traverse((m) => { if (m.isMesh) m.castShadow = false; });
      scene.add(tr);
      ambientTrees.push(tr);
    });
  })();

  // Pétalos que flotan en el aire
  const drift = (function makeDrift() {
    const N = 90;
    const pos = new Float32Array(N * 3);
    const vel = [];
    for (let i = 0; i < N; i++) {
      pos.set([rand(-12, 12), rand(0.2, 8), rand(-12, 12)], i * 3);
      vel.push([rand(-0.25, 0.25), rand(-0.35, -0.12), rand(-0.1, 0.25)]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    x.beginPath(); x.ellipse(32, 32, 14, 24, 0.6, 0, Math.PI * 2); x.fill();
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.16, map: new THREE.CanvasTexture(c), color: '#ff9fc0', transparent: true, depthWrite: false, opacity: 0.9,
    }));
    pts.userData.vel = vel;
    scene.add(pts);
    return pts;
  })();
  function updateDrift(dt, t) {
    const p = drift.geometry.attributes.position;
    const v = drift.userData.vel;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + (v[i][0] + Math.sin(t + i) * 0.15) * dt;
      let y = p.getY(i) + v[i][1] * dt;
      let z = p.getZ(i) + v[i][2] * dt;
      if (y < 0.05) { y = rand(6, 8); x = rand(-12, 12); z = rand(-12, 12); }
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  }

  // =====================================================================
  // Tweens y resortes
  // =====================================================================
  const ease = {
    outCubic: (k) => 1 - Math.pow(1 - k, 3),
    inCubic: (k) => k * k * k,
    inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    outBack: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  };
  const tweens = [];
  function tween(dur, fn, e = ease.outCubic) {
    return new Promise((res) => tweens.push({ t: 0, dur: reduceMotion ? Math.min(dur, 0.15) : dur, fn, e, res }));
  }
  function updateTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.e(k));
      if (k >= 1) { tweens.splice(i, 1); tw.res(); }
    }
  }

  const K = 120, C = 6.5;
  const springy = new Set();
  function kick(m, s) {
    const p = m.userData.petal;
    if (p) p.v += s * rand(0.6, 1.2);
  }
  function pokeFlower(flower, petalMesh, point) {
    const P = flower.userData.petals;
    const idx = P.indexOf(petalMesh);
    if (idx >= 0) {
      kick(P[idx], 9);
      [-1, 1].forEach((d) => { const n = P[(idx + d + P.length) % P.length]; if (n) kick(n, 4); });
      [-2, 2].forEach((d) => { const n = P[(idx + d + P.length) % P.length]; if (n) kick(n, 2); });
    } else {
      P.forEach((m) => kick(m, 3.5));
    }
    const w = flower.userData.wob;
    w.v += rand(-3, 3);
    w.w += rand(-3, 3);
    springy.add(flower);
    if (point) spawnBurst(point, flower.userData.color, 6);
  }
  function stepSprings(dt) {
    const steps = 2, h = dt / steps;
    for (const f of springy) {
      let moving = false;
      for (let s = 0; s < steps; s++) {
        for (const m of f.userData.petals || []) {
          const p = m.userData.petal;
          if (!p || (p.a === 0 && p.v === 0)) continue;
          p.v += (-K * p.a - C * p.v) * h;
          p.a += p.v * h;
        }
        const w = f.userData.wob;
        if (w) {
          w.v += (-60 * w.a - 5 * w.v) * h; w.a += w.v * h;
          w.w += (-60 * w.b - 5 * w.w) * h; w.b += w.w * h;
        }
        const sq = f.userData.sq;
        if (sq) { sq.v += (-140 * sq.a - 7 * sq.v) * h; sq.a += sq.v * h; }
      }
      for (const m of f.userData.petals || []) {
        const p = m.userData.petal;
        if (!p) continue;
        if (Math.abs(p.a) < 1e-4 && Math.abs(p.v) < 1e-3) { p.a = 0; p.v = 0; } else moving = true;
        if (p.mode === 'scale') m.scale.setScalar(1 + p.a * 0.35);
        else m.rotation.x = p.rest + p.a * 0.45;
      }
      const w = f.userData.wob;
      if (w && (Math.abs(w.a) + Math.abs(w.b) + Math.abs(w.v) + Math.abs(w.w) > 1e-3)) moving = true;
      const sq = f.userData.sq;
      if (sq) {
        if (Math.abs(sq.a) + Math.abs(sq.v) > 1e-3) moving = true; else { sq.a = 0; sq.v = 0; }
        const b = f.userData.baseScale || 1;
        f.scale.set(b * (1 - sq.a * 0.5), b * (1 + sq.a), b * (1 - sq.a * 0.5));
      }
      if (!moving) springy.delete(f);
    }
  }
  function swayFlowers(list, t) {
    for (const f of list) {
      const u = f.userData;
      if (!u.headPivot) continue;
      const w = u.wob;
      u.headPivot.rotation.z = w.a * 0.35 + Math.sin(t * 1.3 + u.phase) * 0.035;
      u.headPivot.rotation.x = w.b * 0.35 + Math.cos(t * 1.1 + u.phase) * 0.03;
    }
  }

  // =====================================================================
  // Partículas: pétalos que saltan, tierra y gotas de agua
  // =====================================================================
  const bits = [];
  const burstGeo = Models.petalGeo(0.07, 0.1, 0.2, 0.1, 0.9);
  const clodGeo = new THREE.DodecahedronGeometry(0.04, 0);
  function spawnBurst(p, color, n = 8, clod = false) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(clod ? clodGeo : burstGeo, clod ? Models.mat(color) : Models.pmat(color || '#ff9fc0'));
      m.position.copy(p);
      m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      m.userData = { v: new V3(rand(-1, 1), rand(0.8, 2), rand(-1, 1)), life: 1, spin: rand(-6, 6), g: clod ? 5 : 2.6, floor: -1 };
      scene.add(m); bits.push(m);
    }
  }
  const dropGeo = new THREE.SphereGeometry(0.028, 8, 6);
  const dropMat = new THREE.MeshStandardMaterial({ color: '#8fd0f0', transparent: true, opacity: 0.85, roughness: 0.1 });
  function spawnDrop(p) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.position.copy(p);
    m.scale.set(1, 1.6, 1);
    m.userData = { v: new V3(rand(0.15, 0.55), rand(-0.6, -0.2), rand(-0.25, 0.25)), life: 2, spin: 0, g: 6, floor: DIRT_TOP };
    scene.add(m); bits.push(m);
  }
  function updateBits(dt) {
    for (let i = bits.length - 1; i >= 0; i--) {
      const m = bits[i], u = m.userData;
      u.v.y -= u.g * dt;
      m.position.addScaledVector(u.v, dt);
      m.rotation.x += u.spin * dt; m.rotation.y += u.spin * 0.7 * dt;
      u.life -= dt * (u.floor > 0 ? 0.5 : 0.9);
      if (u.floor < 0) m.scale.setScalar(Math.max(0.01, u.life));
      if (u.life <= 0 || (u.floor > 0 && m.position.y < u.floor)) { scene.remove(m); bits.splice(i, 1); }
    }
  }

  // =====================================================================
  // Ramo (más lleno: flores en domo, nube y helechos)
  // =====================================================================
  const bouquet = new THREE.Group();
  bouquet.position.y = BOUQUET_Y;
  bouquet.visible = false;
  scene.add(bouquet);
  const bouquetFlowers = [];
  (function buildBouquet() {
    const layout = [
      { a: 0, tilt: 0, h: 2.2 },
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ a: (i / 6) * Math.PI * 2 + 0.2, tilt: 0.2, h: 2.1 })),
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ a: (i / 10) * Math.PI * 2 + 0.5, tilt: 0.4, h: 1.92 })),
    ];
    layout.forEach((l, i) => {
      const [type, tone] = BOUQUET[i];
      const holder = new THREE.Group();
      holder.rotation.y = l.a;
      const hs = { hortensia: 1.05, lavanda: 1.3, campanilla: 1.35 }[type] || 1.5;
      const f = Models.buildFlower(type, { stemH: l.h + rand(-0.05, 0.05), noLeaves: true, headScale: hs, tone });
      f.rotation.x = l.tilt + rand(-0.04, 0.04);
      f.position.y = -0.62;
      holder.add(f);
      bouquet.add(holder);
      bouquetFlowers.push(f);
    });
    // relleno: nube (gypsophila) entre las flores
    for (let i = 0; i < 9; i++) {
      const holder = new THREE.Group();
      holder.rotation.y = (i / 9) * Math.PI * 2 + 0.15;
      const f = Models.buildFlower('nube', { stemH: 1.95, noLeaves: true, headScale: 1.15 });
      f.rotation.x = 0.33 + (i % 2) * 0.12;
      f.position.y = -0.62;
      holder.add(f);
      bouquet.add(holder);
      bouquetFlowers.push(f);
    }
    // helechos asomándose por la orilla
    for (let i = 0; i < 8; i++) {
      const holder = new THREE.Group();
      holder.rotation.y = (i / 8) * Math.PI * 2 + 0.4;
      const fern = Models.buildFern();
      fern.rotation.x = 0.55;
      fern.position.set(0, 0.62, 0.72);
      holder.add(fern);
      bouquet.add(holder);
    }
    // envoltura de papel con abertura al frente
    const gap = 0.9;
    const wrapGeo = new THREE.CylinderGeometry(1.0, 0.1, 1.55, 40, 6, true, gap / 2, Math.PI * 2 - gap);
    const p = wrapGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(x, z);
      const k = 1 + Math.sin(a * 9 + y * 3) * 0.035 * (y + 0.78);
      p.setXYZ(i, x * k, y + (y > 0.7 ? Math.sin(a * 5) * 0.07 : 0), z * k);
    }
    wrapGeo.computeVertexNormals();
    const wrap = new THREE.Mesh(wrapGeo, Models.pmat('#f7a8c2', { roughness: 0.8 }));
    wrap.position.y = 0.05;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.08, 1.45, 34, 1, true), Models.pmat('#fff4f8', { roughness: 0.9 }));
    inner.position.y = 0.08;
    // segunda capa de papel, rosa pálido, un poco más alta
    const layer = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.12, 1.3, 36, 1, true, Math.PI - 0.9, 1.8), Models.pmat('#fbd0dc', { roughness: 0.85 }));
    layer.position.y = 0.2;
    bouquet.add(wrap, inner, layer);
    const rib = Models.mat('#a23b6b', { roughness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 8, 30), rib);
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.3;
    bouquet.add(ring);
    const bow = new THREE.Group();
    bow.position.set(0, -0.3, 0.32);
    [-1, 1].forEach((s) => {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 20), rib);
      loop.scale.set(1, 0.6, 1); loop.position.x = s * 0.14; loop.rotation.z = s * 0.35;
      const tail = new THREE.Mesh(Models.boxGeo(0.07, 0.36, 0.015), rib);
      tail.position.set(s * 0.07, -0.19, 0.01); tail.rotation.z = s * 0.3;
      bow.add(loop, tail);
    });
    bow.add(new THREE.Mesh(Models.sphereGeo(0.05), rib));
    bouquet.add(bow);
    bouquet.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    bouquet.userData = { bob: true, sq: { a: 0, v: 0 }, baseScale: 1 };
  })();

  // =====================================================================
  // Jardín
  // =====================================================================
  const garden = new THREE.Group();
  garden.visible = false;
  scene.add(garden);
  let planter = null;
  let bed = null;
  const plantsGroup = new THREE.Group();
  const decorGroup = new THREE.Group();
  const obstGroup = new THREE.Group();
  garden.add(plantsGroup, decorGroup, obstGroup);
  const plantObjs = new Map();
  const decorObjs = new Map();

  const half = () => halfOf(state.grid);
  const baseHalf = () => baseHalfOf(state.grid);
  const capacity = () => Math.floor(state.grid * state.grid * CFG.slotsPerCell);
  const usedSlots = () => state.plants.reduce((a, p) => a + slotsOf(p.type), 0);
  const maxG = (p) => 1 + state.heightCap * p.v;

  function yAt(x, z) {
    const ax = Math.abs(x), az = Math.abs(z), h = half();
    if (ax < h && az < h) return DIRT_TOP;
    if (ax <= h + FRAME_T && az <= h + FRAME_T) return FRAME_TOP;
    if (ax <= baseHalf() && az <= baseHalf()) return BASE_H;
    return 0;
  }
  function spotFree(x, z, type, ignoreId) {
    for (const p of state.plants) {
      if (p.id === ignoreId) continue;
      const need = isTree(type) || isTree(p.type) ? 0.85 : 0.3;
      if (Math.hypot(p.x - x, p.z - z) < need) return false;
    }
    return true;
  }
  function findSpot(type, near) {
    const h = half() - (isTree(type) ? 0.45 : 0.2);
    for (let k = 0; k < 90; k++) {
      let x, z;
      if (near && Math.random() < 0.75) { x = near.x + gauss() * near.s; z = near.z + gauss() * near.s; }
      else { x = rand(-h, h); z = rand(-h, h); }
      if (Math.abs(x) > h || Math.abs(z) > h) continue;
      if (spotFree(x, z, type)) return { x, z };
    }
    return null;
  }
  function newPlant(type, x, z, g, tone) {
    return {
      id: state.nextId++, type, tone: tone != null ? tone : randInt(0, Models.toneCount(type) - 1),
      x: +x.toFixed(2), z: +z.toFixed(2), g, w: null,
      k: +rand(0.8, 1.25).toFixed(2), v: +rand(0.35, 1).toFixed(2),
    };
  }

  function buildPlanter() {
    if (planter) {
      garden.remove(planter);
      if (bed) bed.material.map.dispose();
    }
    planter = new THREE.Group();
    const n = state.grid, h = half(), inner = n;
    const woods = ['#c98d5e', '#bf8455', '#d39a6a'];
    const bw = baseHalf() * 2, board = 0.3, count = Math.ceil(bw / board);
    for (let i = 0; i < count; i++) {
      const b = new THREE.Mesh(Models.boxGeo(bw, BASE_H, board - 0.035), Models.woodMat(woods[i % 3]));
      b.position.set(0, BASE_H / 2, -bw / 2 + board * (i + 0.5));
      planter.add(b);
    }
    const fh = (FRAME_TOP - BASE_H) / 2;
    for (let lvl = 0; lvl < 2; lvl++) {
      const y = BASE_H + fh * (lvl + 0.5);
      [-1, 1].forEach((s) => {
        const ns = new THREE.Mesh(Models.boxGeo(inner + FRAME_T * 2, fh - 0.02, FRAME_T), Models.woodMat(woods[(lvl + (s > 0 ? 1 : 0)) % 3]));
        ns.position.set(0, y, s * (h + FRAME_T / 2));
        const ew = new THREE.Mesh(Models.boxGeo(FRAME_T, fh - 0.02, inner), Models.woodMat(woods[(lvl + 2) % 3]));
        ew.position.set(s * (h + FRAME_T / 2), y, 0);
        planter.add(ns, ew);
      });
    }
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const p = new THREE.Mesh(Models.boxGeo(FRAME_T + 0.05, FRAME_TOP - BASE_H + 0.06, FRAME_T + 0.05), Models.woodMat('#a86f45'));
      p.position.set(sx * (h + FRAME_T / 2), BASE_H + (FRAME_TOP - BASE_H + 0.06) / 2, sz * (h + FRAME_T / 2));
      planter.add(p);
    });
    const fillH = DIRT_TOP - 0.03 - BASE_H;
    const fill = new THREE.Mesh(Models.boxGeo(inner, fillH, inner), Models.mat('#6e4a31', { roughness: 1 }));
    fill.position.y = BASE_H + fillH / 2;
    planter.add(fill);
    // una sola superficie de tierra, con relieve suave (sin cuadritos)
    const g = new THREE.PlaneGeometry(inner, inner, n * 8, n * 8);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const edge = Math.min(h - Math.abs(x), h - Math.abs(z));
      const k = Math.min(1, edge / 0.25);
      pos.setY(i, (Math.sin(x * 3.1) * Math.cos(z * 2.7) * 0.012 + Math.sin(x * 7 + z * 5) * 0.006) * k);
    }
    g.computeVertexNormals();
    const m = Models.dirtMat();
    m.map.repeat.set(n * 0.8, n * 0.8);
    bed = new THREE.Mesh(g, m);
    bed.position.y = DIRT_TOP;
    bed.userData.kind = 'bed';
    bed.receiveShadow = true;
    planter.add(bed);
    planter.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = o !== bed; } });
    garden.add(planter);
  }

  // ---------- Pasto que brota al regar ----------
  const GRASS_BLADES = 12;
  const grassIM = instanced(Models.grassGeo(), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.9 }), CFG.grassMax * GRASS_BLADES);
  grassIM.count = 0;
  grassIM.frustumCulled = false;
  grassIM.receiveShadow = true;
  garden.add(grassIM);
  const grassGreens = ['#7fc98f', '#9ad7a8', '#6bb77f', '#b3e2b6'];
  const grassGrowth = (p) => Math.min(1, 0.4 + Math.max(0, dayNum() - p.d) * 0.12 + (p.n - 1) * 0.12);
  function rebuildGrass() {
    const o = new THREE.Object3D(), col = new THREE.Color();
    let i = 0;
    for (const p of state.grass) {
      const gg = grassGrowth(p);
      for (let b = 0; b < GRASS_BLADES; b++) {
        const seed = p.s * 31 + b;
        const ang = hash(seed) * 6.283, r = Math.sqrt(hash(seed + 1)) * (0.12 + gg * 0.12);
        o.position.set(p.x + Math.cos(ang) * r, DIRT_TOP, p.z + Math.sin(ang) * r);
        o.rotation.set((hash(seed + 2) - 0.5) * 0.6, hash(seed + 3) * 6.28, 0);
        const hgt = (0.3 + 0.7 * gg) * (0.6 + hash(seed + 4) * 0.6);
        o.scale.set(0.9, hgt, 0.9);
        o.updateMatrix();
        grassIM.setMatrixAt(i, o.matrix);
        grassIM.setColorAt(i, col.set(grassGreens[Math.floor(hash(seed + 5) * 4)]));
        i++;
      }
    }
    grassIM.count = i;
    grassIM.instanceMatrix.needsUpdate = true;
    grassIM.instanceColor.needsUpdate = true;
  }
  function addGrass(pt) {
    const h = half() - 0.08;
    const x = clamp(pt.x + rand(-0.12, 0.12), -h, h), z = clamp(pt.z + rand(-0.12, 0.12), -h, h);
    const near = state.grass.find((g) => Math.hypot(g.x - x, g.z - z) < 0.26);
    if (near) { near.n = Math.min(10, near.n + 1); rebuildGrass(); return false; }
    if (state.grass.length >= CFG.grassMax) return false;
    state.grass.push({ x: +x.toFixed(2), z: +z.toFixed(2), d: dayNum(), n: 1, s: randInt(1, 999999) });
    rebuildGrass();
    return true;
  }

  // ---------- Manchas de tierra mojada ----------
  const wets = [];
  const wetGeo = new THREE.CircleGeometry(0.42, 24);
  function wetSpot(p) {
    const m = new THREE.Mesh(wetGeo, new THREE.MeshBasicMaterial({ color: '#3d2618', transparent: true, opacity: 0.35, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, DIRT_TOP + 0.025, p.z);
    m.userData.life = 1;
    garden.add(m); wets.push(m);
  }
  function updateWets(dt) {
    for (let i = wets.length - 1; i >= 0; i--) {
      const m = wets[i];
      m.userData.life -= dt / 12;
      m.material.opacity = 0.35 * Math.max(0, m.userData.life);
      if (m.userData.life <= 0) { garden.remove(m); m.material.dispose(); wets.splice(i, 1); }
    }
  }

  // ---------- Plantas, decoraciones y obstáculos ----------
  function growthLook(p) {
    return { size: (0.3 + 0.7 * Math.min(p.g, 1)) * p.k, stretch: 1 + 0.32 * Math.max(0, p.g - 1) };
  }
  function applyGrowth(obj, p, animate) {
    const { size, stretch } = growthLook(p);
    const s0 = obj.scale.x, st0 = obj.userData.stem.scale.y;
    obj.userData.baseScale = size;
    if (!animate) { obj.scale.setScalar(size); Models.setStemStretch(obj, stretch); return Promise.resolve(); }
    return tween(0.7, (k) => {
      obj.scale.setScalar(Math.max(0.01, s0 + (size - s0) * k));
      Models.setStemStretch(obj, st0 + (stretch - st0) * k);
    }, ease.outBack);
  }
  function spawnPlant(p, animate) {
    const f = Models.buildFlower(p.type, { tone: p.tone });
    f.userData.plantId = p.id;
    f.position.set(p.x, DIRT_TOP, p.z);
    f.rotation.y = hash(p.id) * Math.PI * 2;
    f.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    plantsGroup.add(f);
    plantObjs.set(p.id, f);
    if (animate) { f.scale.setScalar(0.01); applyGrowth(f, p, true); }
    else applyGrowth(f, p, false);
    return f;
  }
  function spawnDecor(d, animate) {
    const o = Models.buildDecor(d.type, { text: d.text || '' });
    o.userData.decorId = d.id;
    o.userData.sq = { a: 0, v: 0 };
    o.userData.baseScale = 1;
    o.position.set(d.x, yAt(d.x, d.z), d.z);
    o.rotation.y = d.r || 0;
    decorGroup.add(o);
    decorObjs.set(d.id, o);
    if (animate) { o.userData.sq.v = 6; springy.add(o); }
    return o;
  }
  function spawnObstacle(ob) {
    const o = Models.buildObstacle(ob.type);
    o.userData.obstId = ob.id;
    o.userData.sq = { a: 0, v: 0 };
    o.userData.baseScale = ob.s;
    o.position.set(ob.x, 0, ob.z);
    o.rotation.y = ob.r;
    o.scale.setScalar(ob.s);
    obstGroup.add(o);
    return o;
  }
  function rebuildGarden() {
    buildPlanter();
    plantsGroup.clear(); plantObjs.clear();
    decorGroup.clear(); decorObjs.clear();
    obstGroup.clear();
    state.plants.forEach((p) => spawnPlant(p, false));
    state.decor.forEach((d) => spawnDecor(d, false));
    state.obstacles.forEach((o) => spawnObstacle(o));
    rebuildGrass();
  }
  function blockingObstacles(n) {
    const lim = baseHalfOf(n) + 0.35;
    return state.obstacles.filter((o) => Math.abs(o.x) < lim && Math.abs(o.z) < lim);
  }
  function obstacleNear(x, z) {
    return state.obstacles.find((o) => Math.hypot(o.x - x, o.z - z) < 0.45 * o.s + 0.3);
  }

  // ---------- Herramientas ----------
  const can = Models.buildCan();
  can.visible = false;
  scene.add(can);
  const shovel = Models.buildShovel();
  shovel.visible = false;
  scene.add(shovel);

  const selRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 40), new THREE.MeshBasicMaterial({ color: '#8fd3b6', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  selRing.rotation.x = -Math.PI / 2;
  selRing.visible = false;
  scene.add(selRing);

  // =====================================================================
  // Vista, modos y cámara
  // =====================================================================
  let view = 'loading';        // loading | intro | garden
  let mode = 'view';           // view | water | shovel | plant | place | move
  let modeData = null;
  let busy = false;
  let toolBusy = false;
  let selected = null;

  function gardenCam() {
    const n = state.grid;
    const k = Math.max(1, Math.pow(1.1 / (innerWidth / innerHeight), 0.42));
    return new V3(n * 0.95 + 2.6, n * 0.9 + 3.0, n * 1.1 + 3.9).multiplyScalar(k);
  }
  function setGardenControls() {
    controls.enablePan = true;
    controls.minDistance = 2.5;
    controls.maxDistance = 40;
    controls.maxPolarAngle = 1.42;
    controls.autoRotate = false;
  }
  function setIntroControls() {
    controls.enablePan = false;
    controls.minDistance = 2.2;
    controls.maxDistance = 12;
    controls.maxPolarAngle = 1.55;
  }
  function flyCamera(to, target, dur = 1.1) {
    const cf = camera.position.clone(), tf = controls.target.clone();
    return tween(dur, (k) => { camera.position.lerpVectors(cf, to, k); controls.target.lerpVectors(tf, target, k); }, ease.inOutCubic);
  }

  function setMode(m, data = null) {
    mode = m; modeData = data;
    can.visible = m === 'water';
    shovel.visible = m === 'shovel';
    if (m === 'water') { can.position.set(0, DIRT_TOP + 1.2, 0); can.rotation.set(0, 0, 0); }
    if (m === 'shovel') { shovel.position.set(0.3, DIRT_TOP + 0.5, 0.3); shovel.rotation.set(0, 0, 0.35); }
    controls.enabled = m !== 'move';
    if (m !== 'move' && m !== 'view') selectDecor(null);
    $('#modebar').classList.toggle('hidden', m === 'view');
    $('#decorbar').classList.toggle('hidden', !(m === 'view' && selected));
    document.body.dataset.mode = m;
    updateModeText();
  }
  function updateModeText() {
    const t = $('#modeText');
    if (mode === 'water') t.textContent = 'Toca tus flores o la tierra para regar';
    else if (mode === 'shovel') t.textContent = 'Toca piedras, troncos o maleza para quitarlos';
    else if (mode === 'plant') t.textContent = `Toca la tierra para plantar: ${seedInfo(modeData).name} (te quedan ${state.seeds[modeData] || 0})`;
    else if (mode === 'place') t.textContent = `Toca el suelo para colocar: ${decorInfo(modeData).name}`;
    else if (mode === 'move') t.textContent = 'Arrastra en la pantalla para moverla';
  }
  function selectDecor(o) {
    selected = o;
    selRing.visible = !!o;
    const isSign = !!o && o.userData.type === 'letrero';
    $('#signBtn').classList.toggle('hidden', !isSign);
    $('#decorbar').classList.toggle('hidden', !o || mode !== 'view');
  }

  // =====================================================================
  // Acciones del juego
  // =====================================================================
  const xpNeed = (l) => 40 + l * 25;
  function addXP(n) {
    state.xp += n;
    while (state.xp >= xpNeed(state.level)) {
      state.xp -= xpNeed(state.level);
      state.level++;
      levelUp();
    }
  }
  function levelUp() {
    const bonus = 15 + state.level * 5;
    state.coins += bonus;
    const parts = [`¡Nivel ${state.level}! Ganaste ${bonus} monedas`];
    // solo unas cuantas flores dan un estirón
    const growable = shuffle(state.plants.filter((p) => p.g < maxG(p)));
    const lucky = growable.slice(0, Math.min(growable.length, randInt(2, 3)));
    lucky.forEach((p, i) => {
      p.g = Math.min(p.g + 0.35, maxG(p));
      const o = plantObjs.get(p.id);
      if (o) setTimeout(() => { applyGrowth(o, p, true); spawnBurst(o.position.clone().add(new V3(0, 0.9, 0)), '#fff4a8', 6); }, 700 + i * 250);
    });
    if (lucky.length) parts.push(`${lucky.length === 1 ? 'una flor dio' : `${lucky.length} flores dieron`} un estirón`);
    // brota una flor nueva si hay espacio
    const type = pick(SEEDS.filter((s) => s.price <= 50)).id;
    const spot = usedSlots() + 1 <= capacity() ? findSpot(type) : null;
    if (spot) {
      const p = newPlant(type, spot.x, spot.z, 0.15);
      state.plants.push(p);
      setTimeout(() => { spawnPlant(p, true); spawnBurst(new V3(p.x, DIRT_TOP + 0.3, p.z), Models.flowerColor(type, p.tone), 12); }, 1200);
      parts.push(`brotó una ${seedInfo(type).name.toLowerCase()}`);
    } else if (state.heightCap < CFG.maxHeight) {
      state.heightCap++;
      parts.push('tus flores ya pueden crecer más alto');
    }
    toast(parts.join(', ') + '.');
  }
  function streakMultiplier() {
    const t = today();
    if (state.lastWaterDay !== t) {
      state.streak = state.lastWaterDay === yesterday() ? state.streak + 1 : 1;
      state.lastWaterDay = t;
      if (state.streak > 1) toast(`Llevas ${state.streak} días seguidos regando. Tus recompensas suben.`);
    }
    return 1 + Math.min(state.streak - 1, 6) * 0.1;
  }

  async function pourAt(p) {
    const from = can.position.clone();
    const to = p.clone().add(new V3(-0.5, 1.15, 0));
    await tween(0.3, (k) => can.position.lerpVectors(from, to, k));
    await tween(0.22, (k) => { can.rotation.z = -0.75 * k; });
    const tipW = new V3();
    const start = performance.now();
    await new Promise((res) => {
      const iv = setInterval(() => {
        can.userData.tip.getWorldPosition(tipW);
        spawnDrop(tipW); spawnDrop(tipW);
        if (performance.now() - start > 650) { clearInterval(iv); res(); }
      }, 30);
    });
    await tween(0.22, (k) => { can.rotation.z = -0.75 * (1 - k); });
  }
  async function waterAt(pt) {
    if (toolBusy) return;
    toolBusy = true;
    await pourAt(pt);
    wetSpot(pt);
    const sprouted = addGrass(pt);
    const t = today();
    const near = state.plants.filter((p) => Math.hypot(p.x - pt.x, p.z - pt.z) < (isTree(p.type) ? 0.8 : 0.5));
    let xp = 0, coins = 0, already = 0;
    let mult = null;
    for (const p of near) {
      const obj = plantObjs.get(p.id);
      if (obj) pokeFlower(obj, null, null);
      if (p.w === t) { already++; continue; }
      if (mult == null) mult = streakMultiplier();
      xp += Math.round(randInt(CFG.xp[0], CFG.xp[1]) * mult);
      coins += randInt(CFG.coins[0], CFG.coins[1]);
      p.w = t;
      p.g = Math.min(p.g + CFG.growth, maxG(p));
      if (obj) applyGrowth(obj, p, true);
    }
    const head = pt.clone().add(new V3(0, 1.1, 0));
    if (xp) {
      state.coins += coins;
      floatText(head, `+${xp} XP`, 'xp');
      setTimeout(() => floatText(head.clone().add(new V3(0, -0.3, 0)), `+${coins}`, 'coin'), 220);
      addXP(xp);
    } else if (already) {
      floatText(head, already === 1 ? 'Ya bebió agua hoy' : 'Ya bebieron agua hoy', 'muted');
    } else if (sprouted) {
      floatText(head, 'Brotó pastito', 'xp');
    }
    renderHUD();
    save();
    toolBusy = false;
  }

  async function shovelDig(p, times = 1) {
    const from = shovel.position.clone();
    const above = new V3(p.x + 0.12, p.y + 0.75, p.z + 0.12);
    await tween(0.28, (k) => shovel.position.lerpVectors(from, above, k));
    for (let i = 0; i < times; i++) {
      await tween(0.16, (k) => { shovel.position.y = above.y - k * 0.6; shovel.rotation.z = 0.35 - k * 0.3; }, ease.inCubic);
      spawnBurst(new V3(p.x, p.y + 0.05, p.z), '#7a5236', 7, true);
      await tween(0.22, (k) => { shovel.position.y = above.y - 0.6 + k * 0.6; shovel.rotation.z = 0.05 + k * 0.5; });
    }
    shovel.rotation.z = 0.35;
  }
  async function digObstacle(o) {
    const ob = state.obstacles.find((x) => x.id === o.userData.obstId);
    if (!ob) return;
    toolBusy = true;
    await shovelDig(o.position.clone(), 2);
    const s0 = o.scale.x;
    await tween(0.35, (k) => { o.scale.setScalar(Math.max(0.01, s0 * (1 - k))); o.position.y = -k * 0.2; }, ease.inCubic);
    obstGroup.remove(o);
    state.obstacles = state.obstacles.filter((x) => x !== ob);
    const coins = randInt(3, 10);
    state.coins += coins;
    const head = new V3(ob.x, 1, ob.z);
    floatText(head, `+${coins}`, 'coin');
    if (Math.random() < 0.3) {
      const s = pick(SEEDS.filter((x) => x.price <= 30));
      state.seeds[s.id] = (state.seeds[s.id] || 0) + 1;
      setTimeout(() => floatText(head.clone().add(new V3(0, -0.35, 0)), `Encontraste una semilla: ${s.name}`, 'xp'), 250);
      bumpBag();
    }
    renderHUD(); renderShop(); renderBag(); save();
    toolBusy = false;
  }
  async function shovelTap(e) {
    if (toolBusy) return;
    const h = hit(e, [obstGroup]);
    const o = h && ownerOf(h.object);
    if (o && o.userData.kind === 'obstacle') { await digObstacle(o); return; }
    const bh = bed && hit(e, [bed]);
    if (bh) {
      const gi = state.grass.findIndex((g) => Math.hypot(g.x - bh.point.x, g.z - bh.point.z) < 0.3);
      toolBusy = true;
      await shovelDig(bh.point);
      if (gi >= 0) { state.grass.splice(gi, 1); rebuildGrass(); floatText(bh.point.clone().add(new V3(0, 0.6, 0)), 'Quitaste el pasto', 'muted'); save(); }
      toolBusy = false;
      return;
    }
    const gp = groundPoint(e, 0);
    if (gp && gp.length() < 12) { toolBusy = true; await shovelDig(gp); toolBusy = false; }
  }

  function plantSeedAt(pt) {
    const type = modeData;
    if (!(state.seeds[type] > 0)) { setMode('view'); return; }
    const head = pt.clone().add(new V3(0, 0.7, 0));
    const edge = half() - (isTree(type) ? 0.45 : 0.15);
    if (Math.abs(pt.x) > edge || Math.abs(pt.z) > edge) { floatText(head, 'Muy cerca de la orilla', 'muted'); return; }
    if (usedSlots() + slotsOf(type) > capacity()) { floatText(head, 'Ya no cabe más. Amplía tu terreno.', 'muted'); return; }
    if (!spotFree(pt.x, pt.z, type)) { floatText(head, isTree(type) ? 'Un árbol necesita más espacio' : 'Muy pegada a otra planta', 'muted'); return; }
    state.seeds[type]--;
    const p = newPlant(type, pt.x, pt.z, 0.05);
    state.plants.push(p);
    spawnPlant(p, true);
    spawnBurst(new V3(pt.x, DIRT_TOP + 0.05, pt.z), '#7a5236', 8, true);
    floatText(head, 'Plantada', 'xp');
    renderHUD(); renderBag(); save();
    if (!(state.seeds[type] > 0)) setMode('view'); else updateModeText();
  }
  async function placeDecor(p) {
    const type = modeData;
    const lim = half() + 3.4;
    if (Math.hypot(p.x, p.z) > lim) { floatText(p, 'Muy lejos del jardín', 'muted'); return; }
    if (obstacleNear(p.x, p.z)) { floatText(p, 'Algo estorba aquí. Quítalo con la pala.', 'muted'); return; }
    if (!(state.bag[type] > 0)) { setMode('view'); return; }
    state.bag[type]--;
    const d = { id: state.nextId++, type, x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: 0 };
    state.decor.push(d);
    let o = spawnDecor(d, true);
    setMode('view');
    selectDecor(o);
    renderHUD(); renderBag(); save();
    if (type === 'letrero') await editSign();
  }
  async function editSign() {
    if (!selected || selected.userData.type !== 'letrero') return;
    const d = state.decor.find((x) => x.id === selected.userData.decorId);
    if (!d) return;
    const val = await askModal({
      title: 'Escribe en el letrero', text: 'Hasta 22 letras. Déjalo vacío si lo quieres sin nada.',
      input: true, value: d.text || '', ok: 'Guardar',
    });
    if (val === null) return;
    d.text = val.trim().slice(0, 22);
    const old = selected;
    decorGroup.remove(old);
    decorObjs.delete(d.id);
    const o = spawnDecor(d, true);
    selectDecor(o);
    save();
  }
  function buy(kind, id) {
    const info = kind === 'seed' ? seedInfo(id) : decorInfo(id);
    if (!info || state.coins < info.price) return;
    state.coins -= info.price;
    const bucket = kind === 'seed' ? state.seeds : state.bag;
    bucket[id] = (bucket[id] || 0) + 1;
    toast(`Se guardó en tu mochila: ${info.name}.`);
    bumpBag();
    renderHUD(); renderShop(); renderBag(); save();
  }
  function buyLand() {
    const next = state.grid + 1;
    const price = LAND_PRICE[next];
    if (!price || state.coins < price) return;
    const blockers = blockingObstacles(next);
    if (blockers.length) {
      toast(`Primero quita con la pala ${blockers.length === 1 ? 'lo que estorba' : `las ${blockers.length} cosas que estorban`} alrededor del jardín.`);
      blockers.forEach((b) => {
        const o = obstGroup.children.find((c) => c.userData.obstId === b.id);
        if (o) { o.userData.sq.v += 5; springy.add(o); }
      });
      closeDrawer();
      return;
    }
    state.coins -= price;
    state.grid = next;
    buildPlanter();
    state.decor.forEach((d) => { const o = decorObjs.get(d.id); if (o) o.position.y = yAt(d.x, d.z); });
    garden.scale.setScalar(0.9);
    tween(0.6, (k) => garden.scale.setScalar(0.9 + 0.1 * k), ease.outBack);
    setGardenControls();
    flyCamera(gardenCam(), new V3(0, 0.7, 0), 0.9);
    toast(`Tu jardín ahora mide ${next} × ${next}. Hay espacio para más flores.`);
    renderHUD(); renderShop(); save();
  }

  // =====================================================================
  // Entrada: toques, arrastres y raycast
  // =====================================================================
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function setRay(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function hit(e, objs) { setRay(e); return ray.intersectObjects(objs.filter(Boolean), true)[0] || null; }
  function groundPoint(e, y = 0) {
    setRay(e);
    const out = new V3();
    return ray.ray.intersectPlane(new THREE.Plane(new V3(0, 1, 0), -y), out) ? out : null;
  }
  function ownerOf(o) {
    while (o) { if (o.userData && o.userData.kind) return o; o = o.parent; }
    return null;
  }
  /** Punto de la tierra tocado (o la base de la flor tocada). */
  function bedPoint(e) {
    const h = hit(e, [plantsGroup, bed]);
    if (!h) return null;
    const o = ownerOf(h.object);
    if (o && o.userData.kind === 'flower') return new V3(o.position.x, DIRT_TOP, o.position.z);
    if (o && o.userData.kind === 'bed') return new V3(h.point.x, DIRT_TOP, h.point.z);
    return null;
  }

  const pointers = new Map();
  let down = null;
  let dragging = false;
  let dragStart = null;
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, true);
    down = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    if (mode === 'move' && selected && pointers.size === 1) {
      dragging = true;
      dragStart = selected.position.clone();
      canvas.setPointerCapture(e.pointerId);
      dragTo(e);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) { dragTo(e); return; }
    if (e.pointerType !== 'mouse' || toolBusy || view !== 'garden') return;
    if (mode === 'water') {
      const p = groundPoint(e, DIRT_TOP);
      if (p) can.position.lerp(p.add(new V3(-0.5, 1.15, 0)), 0.35);
    } else if (mode === 'shovel') {
      const p = groundPoint(e, 0);
      if (p) shovel.position.lerp(p.add(new V3(0.12, 0.8, 0.12)), 0.35);
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (dragging) {
      dragging = false;
      const d = state.decor.find((x) => x.id === selected.userData.decorId);
      if (d) {
        if (obstacleNear(selected.position.x, selected.position.z)) {
          selected.position.copy(dragStart);
          floatText(selected.position.clone().add(new V3(0, 1, 0)), 'Algo estorba ahí. Usa la pala.', 'muted');
        } else { d.x = +selected.position.x.toFixed(2); d.z = +selected.position.z.toFixed(2); save(); }
      }
      return;
    }
    if (!down || e.type === 'pointercancel') { down = null; return; }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dt = performance.now() - down.t;
    down = null;
    if (moved < 10 && dt < 500) onTap(e);
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  function dragTo(e) {
    const p = groundPoint(e, 0);
    if (!p || !selected) return;
    const lim = half() + 3.4;
    const d = Math.hypot(p.x, p.z);
    if (d > lim) p.multiplyScalar(lim / d);
    selected.position.set(p.x, yAt(p.x, p.z), p.z);
  }

  function onTap(e) {
    if (busy) return;
    if (view === 'intro') {
      const h = hit(e, [bouquet]);
      if (!h) return;
      const o = ownerOf(h.object);
      if (o && o.userData.kind === 'flower') pokeFlower(o, h.object, h.point);
      else { bouquet.userData.sq.v += 3; springy.add(bouquet); spawnBurst(h.point, '#f7a8c2', 5); }
      return;
    }
    if (view !== 'garden') return;
    if (mode === 'water') { const p = bedPoint(e); if (p) waterAt(p); return; }
    if (mode === 'shovel') { shovelTap(e); return; }
    if (mode === 'plant') { const p = bedPoint(e); if (p) plantSeedAt(p); return; }
    if (mode === 'place') { const p = groundPoint(e, 0); if (p) placeDecor(p); return; }
    if (mode === 'move') return;
    const h = hit(e, [plantsGroup, decorGroup, obstGroup]);
    if (!h) { selectDecor(null); return; }
    const o = ownerOf(h.object);
    if (o && o.userData.kind === 'decor') {
      selectDecor(o);
      o.userData.sq.v += 4; springy.add(o);
    } else if (o && o.userData.kind === 'flower') {
      selectDecor(null);
      pokeFlower(o, h.object, h.point);
    } else if (o && o.userData.kind === 'obstacle') {
      selectDecor(null);
      o.userData.sq.v += 3; springy.add(o);
      floatText(h.point.clone().add(new V3(0, 0.5, 0)), 'Quítalo con la pala', 'muted');
    }
  }

  // =====================================================================
  // Transiciones
  // =====================================================================
  function seedFromBouquet() {
    const h = half() - 0.3;
    const centers = [0, 1, 2].map(() => ({ x: rand(-h * 0.6, h * 0.6), z: rand(-h * 0.6, h * 0.6), s: pick([0.22, 0.35, 0.6]) }));
    BOUQUET.forEach(([type, tone]) => {
      const spot = findSpot(type, Math.random() < 0.85 ? pick(centers) : null);
      if (!spot) return;
      state.plants.push(newPlant(type, spot.x, spot.z, +rand(0.5, 1).toFixed(2), tone));
    });
  }
  function showGardenUI(show) {
    ['#hud', '#menuBtn', '#bagBtn'].forEach((s) => $(s).classList.toggle('hidden', !show));
  }
  async function popPlants() {
    const objs = [...plantObjs.values()];
    objs.forEach((o) => o.scale.setScalar(0.01));
    for (const o of objs) {
      const p = state.plants.find((x) => x.id === o.userData.plantId);
      if (p) applyGrowth(o, p, true);
      await wait(reduceMotion ? 0 : 60);
    }
  }
  function greet() {
    if (state.plants.some((p) => p.w !== today())) toast('Tus flores tienen sed. Toma la regadera desde la tienda.');
  }

  async function goToGarden() {
    if (view !== 'intro' || busy) return;
    busy = true;
    $('#placeBtn').classList.add('hidden');
    $('#intro').classList.add('hidden');
    controls.autoRotate = false;
    controls.enabled = false;
    bouquet.userData.bob = false;
    const y0 = bouquet.position.y;
    await tween(0.8, (k) => {
      bouquet.position.y = y0 + k * 1.8;
      bouquet.scale.setScalar(Math.max(0.01, 1 - k * 0.9));
      bouquet.rotation.y += 0.06;
    }, ease.inCubic);
    spawnBurst(bouquet.position.clone(), '#ff8fb1', 14);
    bouquet.visible = false;
    view = 'garden';
    if (!state.placed) { seedFromBouquet(); state.placed = true; }
    rebuildGarden();
    plantObjs.forEach((o) => o.scale.setScalar(0.01));
    garden.visible = true;
    garden.scale.setScalar(0.01);
    setGardenControls();
    await Promise.all([
      flyCamera(gardenCam(), new V3(0, 0.7, 0), 1.2),
      tween(0.9, (k) => garden.scale.setScalar(Math.max(0.01, k)), ease.outBack),
    ]);
    controls.enabled = true;
    showGardenUI(true);
    renderHUD(); renderShop(); renderBag();
    await popPlants();
    save();
    toast('Tu ramo ya tiene un hogar. Riégalo cada día para que crezca.');
    busy = false;
  }

  /** Visitas siguientes: directo al jardín, sin ramo. */
  async function enterGarden() {
    view = 'garden';
    bouquet.visible = false;
    rebuildGarden();
    garden.visible = true;
    setGardenControls();
    camera.position.copy(gardenCam()).multiplyScalar(1.35);
    controls.target.set(0, 0.7, 0);
    showGardenUI(true);
    renderHUD(); renderShop(); renderBag();
    flyCamera(gardenCam(), new V3(0, 0.7, 0), 1.4);
    await popPlants();
    greet();
  }

  function showIntro(firstLoad) {
    view = 'intro';
    garden.visible = false;
    showGardenUI(false);
    setIntroControls();
    bouquet.visible = true;
    bouquet.position.y = BOUQUET_Y;
    bouquet.rotation.y = 0;
    bouquet.userData.bob = true;
    controls.autoRotate = !reduceMotion;
    $('#placeBtn').textContent = 'Colocarlas';
    $('#placeBtn').classList.remove('hidden');
    $('#intro').classList.remove('hidden');
    if (firstLoad) { bouquet.scale.setScalar(1); return Promise.resolve(); }
    bouquet.scale.setScalar(0.01);
    return Promise.all([
      flyCamera(introCam(), INTRO_TARGET, 1),
      tween(0.8, (k) => bouquet.scale.setScalar(Math.max(0.01, k)), ease.outBack),
    ]);
  }

  async function resetAll() {
    const ok = await askModal({
      title: '¿Empezar de cero?',
      text: 'Se borran tus flores, monedas, decoraciones y nivel, en este y en los otros dispositivos. Vuelves a recibir el ramo.',
      ok: 'Borrar y empezar', danger: true,
    });
    if (!ok || busy) return;
    busy = true;
    closeDrawer(); closeBag();
    setMode('view'); selectDecor(null);
    showGardenUI(false);
    await tween(0.5, (k) => garden.scale.setScalar(Math.max(0.01, 1 - k)), ease.inCubic);
    state = freshState();
    save();
    rebuildGarden();
    garden.scale.setScalar(1);
    await showIntro(false);
    busy = false;
  }

  // =====================================================================
  // Interfaz
  // =====================================================================
  const COIN = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#f5c04e"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#d99a1e" stroke-width="2"/><path d="M12 8.5l1.1 2.3 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill="#fff4cf"/></svg>';
  let thumbs = {};

  function renderHUD() {
    $('#lvNum').textContent = state.level;
    const need = xpNeed(state.level);
    $('#xpFill').style.width = `${Math.min(100, (100 * state.xp) / need)}%`;
    $('#xpText').textContent = `${Math.floor(state.xp)} de ${need} XP`;
    $('#coinNum').textContent = state.coins;
    const t = today();
    const alive = state.streak > 0 && (state.lastWaterDay === t || state.lastWaterDay === yesterday());
    $('#streakText').textContent = alive ? `Racha de ${state.streak} ${state.streak === 1 ? 'día' : 'días'}` : 'Sin racha todavía';
    const watered = state.plants.filter((p) => p.w === t).length;
    $('#waterText').textContent = `Regadas hoy: ${watered} de ${state.plants.length}`;
    const count = Object.values(state.seeds).reduce((a, b) => a + (b || 0), 0) + Object.values(state.bag).reduce((a, b) => a + (b || 0), 0);
    $('#bagCount').textContent = count;
    $('#bagCount').classList.toggle('hidden', count === 0);
    $('#drawerCoins').innerHTML = `${COIN}<b>${state.coins}</b>`;
  }
  function bumpBag() {
    const b = $('#bagBtn');
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }

  let tab = 'tools';
  function itemCard({ thumb, name, desc, price, btn, attr, disabled, tag }) {
    return `<article class="item">
      <img src="${thumb || ''}" alt="" width="72" height="72">
      <div class="info"><h3>${name}</h3>${desc ? `<p>${desc}</p>` : ''}${tag ? `<span class="tag">${tag}</span>` : ''}</div>
      <button class="btn buy" ${attr} ${disabled ? 'disabled' : ''}>${price != null ? COIN + price : btn}</button>
    </article>`;
  }
  function renderShop() {
    const body = $('#drawerBody');
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (tab === 'tools') {
      body.innerHTML =
        itemCard({ thumb: thumbs.can, name: 'Regadera', desc: 'Cada flor da XP y monedas una vez al día, y donde riegas brota pastito.', btn: mode === 'water' ? 'En uso' : 'Tomar', attr: 'data-tool="water"', disabled: mode === 'water' }) +
        itemCard({ thumb: thumbs.shovel, name: 'Pala', desc: 'Quita piedras, troncos y maleza. A veces encuentras monedas o semillas.', btn: mode === 'shovel' ? 'En uso' : 'Tomar', attr: 'data-tool="shovel"', disabled: mode === 'shovel' }) +
        '<p class="note">Al subir de nivel, algunas flores dan un estirón y brota una nueva donde haya espacio.</p>';
    } else if (tab === 'seeds') {
      body.innerHTML = SEEDS.map((s) => itemCard({
        thumb: thumbs[s.id], name: s.name, desc: s.desc, price: s.price, attr: `data-seed="${s.id}"`, disabled: state.coins < s.price,
        tag: Models.toneCount(s.id) > 1 ? `${Models.toneCount(s.id)} tonos al azar` : '',
      })).join('');
    } else if (tab === 'decor') {
      body.innerHTML = DECOR.map((d) => itemCard({ thumb: thumbs[d.id], name: d.name, desc: d.desc, price: d.price, attr: `data-decor="${d.id}"`, disabled: state.coins < d.price })).join('');
    } else {
      const next = state.grid + 1, price = LAND_PRICE[next];
      const blockers = price ? blockingObstacles(next).length : 0;
      body.innerHTML = `<div class="land">
        <div class="land-grid" style="--n:${state.grid}"></div>
        <p>Tu jardín mide <b>${state.grid} × ${state.grid}</b>. Espacio usado: <b>${usedSlots()} de ${capacity()}</b> (los árboles ocupan 3).</p>
        <p>Altura extra de tus flores: <b>${state.heightCap} de ${CFG.maxHeight}</b>.</p>
        ${price ? (blockers ? `<p class="note warn">Para ampliar, primero quita con la pala ${blockers === 1 ? 'lo que estorba' : `las ${blockers} cosas que estorban`} junto al jardín.</p>` : '') +
          `<button class="btn" data-land ${state.coins < price || blockers ? 'disabled' : ''}>Ampliar a ${next} × ${next} por ${COIN}${price}</button>`
        : '<p class="note">Tu jardín ya tiene el tamaño máximo.</p>'}
      </div>`;
    }
  }
  function renderBag() {
    const body = $('#bagBody');
    const seeds = SEEDS.filter((s) => state.seeds[s.id] > 0);
    const decs = DECOR.filter((d) => state.bag[d.id] > 0);
    if (!seeds.length && !decs.length) {
      body.innerHTML = '<p class="empty">Tu mochila está vacía. Compra semillas o decoraciones en la tienda.</p>';
      return;
    }
    const free = capacity() - usedSlots();
    const row = (thumb, name, n, attr, label, dis) => `<div class="bag-row"><img src="${thumb || ''}" alt="" width="52" height="52"><span>${name}<small>× ${n}</small></span><button class="btn small" ${attr} ${dis ? 'disabled' : ''}>${label}</button></div>`;
    body.innerHTML =
      (seeds.length ? `<h3>Semillas</h3>${free < 1 ? '<p class="note">Ya no hay espacio. Amplía tu terreno para plantar más.</p>' : ''}` +
        seeds.map((s) => row(thumbs[s.id], s.name, state.seeds[s.id], `data-use-seed="${s.id}"`, 'Plantar', free < slotsOf(s.id))).join('') : '') +
      (decs.length ? '<h3>Decoraciones</h3>' + decs.map((d) => row(thumbs[d.id], d.name, state.bag[d.id], `data-use-decor="${d.id}"`, 'Colocar')).join('') : '');
  }

  function openDrawer() {
    closeBag();
    renderShop();
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#scrim').classList.remove('hidden');
  }
  function closeDrawer() {
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#scrim').classList.add('hidden');
  }
  function openBag() { closeDrawer(); renderBag(); $('#bag').classList.remove('hidden'); }
  function closeBag() { $('#bag').classList.add('hidden'); }

  function askModal({ title, text, input = false, value = '', ok = 'Aceptar', cancel = 'Cancelar', danger = false }) {
    return new Promise((resolve) => {
      const m = $('#modal'), inp = $('#modalInput'), okB = $('#modalOk'), cB = $('#modalCancel');
      $('#modalTitle').textContent = title;
      $('#modalText').textContent = text || '';
      inp.classList.toggle('hidden', !input);
      inp.value = value;
      okB.textContent = ok; cB.textContent = cancel;
      okB.classList.toggle('danger', danger);
      m.classList.remove('hidden');
      if (input) setTimeout(() => inp.focus(), 50); else okB.focus();
      const done = (v) => {
        m.classList.add('hidden');
        okB.onclick = cB.onclick = inp.onkeydown = m.onclick = null;
        resolve(v);
      };
      okB.onclick = () => done(input ? inp.value : true);
      cB.onclick = () => done(input ? null : false);
      inp.onkeydown = (e) => { if (e.key === 'Enter') done(inp.value); };
      m.onclick = (e) => { if (e.target === m) done(input ? null : false); };
    });
  }

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4300);
  }
  function floatText(pos, text, cls = '') {
    const v = pos.clone().project(camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.innerHTML = cls === 'coin' ? COIN + text : text;
    el.style.left = `${clamp((v.x * 0.5 + 0.5) * innerWidth, 90, innerWidth - 90)}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    $('#floats').appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  async function share() {
    const url = `${location.origin}${location.pathname}?jardin=${encodeURIComponent(gardenId)}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Nuestro jardín', text: 'Ayúdame a regar nuestro jardín', url });
      else { await navigator.clipboard.writeText(url); toast('Enlace copiado. Quien lo abra cuidará este mismo jardín.'); }
    } catch { /* cancelado */ }
  }

  // Eventos de la interfaz
  $('#placeBtn').addEventListener('click', goToGarden);
  $('#menuBtn').addEventListener('click', openDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  $('#bagBtn').addEventListener('click', () => ($('#bag').classList.contains('hidden') ? openBag() : closeBag()));
  $('#bagClose').addEventListener('click', closeBag);
  $('#shareBtn').addEventListener('click', share);
  $('#resetBtn').addEventListener('click', resetAll);
  $('#modeDone').addEventListener('click', () => { if (mode === 'move') save(); setMode('view'); });
  document.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    renderShop();
  });
  $('#drawerBody').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.tool) { closeDrawer(); setMode(b.dataset.tool); }
    else if (b.dataset.seed) buy('seed', b.dataset.seed);
    else if (b.dataset.decor) buy('decor', b.dataset.decor);
    else if (b.hasAttribute('data-land')) buyLand();
  });
  $('#bagBody').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    closeBag();
    if (b.dataset.useSeed) setMode('plant', b.dataset.useSeed);
    else if (b.dataset.useDecor) setMode('place', b.dataset.useDecor);
  });
  $('#decorbar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !selected) return;
    const d = state.decor.find((x) => x.id === selected.userData.decorId);
    if (!d) return;
    const act = b.dataset.act;
    if (act === 'move') setMode('move');
    else if (act === 'text') editSign();
    else if (act === 'rotate') {
      d.r = ((d.r || 0) + Math.PI / 4) % (Math.PI * 2);
      const o = selected, r0 = o.rotation.y, r1 = r0 + Math.PI / 4;
      tween(0.3, (k) => { o.rotation.y = r0 + (r1 - r0) * k; }, ease.outBack);
      save();
    } else if (act === 'store') {
      state.decor = state.decor.filter((x) => x !== d);
      state.bag[d.type] = (state.bag[d.type] || 0) + 1;
      decorGroup.remove(selected);
      decorObjs.delete(d.id);
      selectDecor(null);
      toast(`Se guardó en tu mochila: ${decorInfo(d.type).name}.`);
      bumpBag(); renderHUD(); renderBag(); save();
    } else if (act === 'close') selectDecor(null);
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !$('#modal').classList.contains('hidden')) return;
    if ($('#drawer').classList.contains('open')) closeDrawer();
    else if (!$('#bag').classList.contains('hidden')) closeBag();
    else if (mode !== 'view') setMode('view');
    else selectDecor(null);
  });

  // Cambios hechos desde el otro dispositivo
  function adoptRemote(remote, notify) {
    state = sanitize(remote);
    safeSet(LS_KEY, JSON.stringify(state));
    if (view === 'garden') {
      setMode('view'); selectDecor(null);
      if (!state.placed) { rebuildGarden(); showIntro(false); }
      else { rebuildGarden(); renderHUD(); renderShop(); renderBag(); }
    } else if (view === 'intro' && state.placed) {
      $('#placeBtn').classList.add('hidden'); $('#intro').classList.add('hidden');
      enterGarden();
    }
    if (notify) toast('El jardín se actualizó con los cambios del otro dispositivo.');
  }
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || busy) return;
    try {
      const r = await fetchJSON(`${API}?id=${encodeURIComponent(gardenId)}`);
      if (r.state && (r.state.updatedAt || 0) > (state.updatedAt || 0)) adoptRemote(r.state, false);
      else if (view === 'garden') { rebuildGrass(); renderHUD(); }
    } catch { /* sin conexión */ }
  });

  // =====================================================================
  // Miniaturas 3D para la tienda y la mochila
  // =====================================================================
  function makeThumbs() {
    const out = {};
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return out; }
    r.setPixelRatio(1);
    r.setSize(160, 160);
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight('#ffffff', '#f4a7c0', 1.0));
    const d = new THREE.DirectionalLight('#ffffff', 0.7);
    d.position.set(2, 4, 3);
    s.add(d);
    const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
    const size = new V3(), c = new V3();
    const shot = (obj) => {
      s.add(obj);
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      box.getSize(size); box.getCenter(c);
      const R = Math.max(size.x, size.y, size.z);
      cam.position.set(c.x + R * 0.9, c.y + R * 0.5, c.z + R * 1.55);
      cam.lookAt(c);
      r.render(s, cam);
      const url = r.domElement.toDataURL('image/png');
      s.remove(obj);
      return url;
    };
    SEEDS.forEach((x) => { out[x.id] = shot(isTree(x.id) ? Models.buildFlower(x.id) : Models.buildFlower(x.id, { stemH: 0.5, headScale: 1.2, noLeaves: true })); });
    DECOR.forEach((x) => { out[x.id] = shot(Models.buildDecor(x.id, { text: x.id === 'letrero' ? '' : undefined })); });
    out.can = shot(Models.buildCan());
    const sh = Models.buildShovel(); sh.rotation.z = 0.5;
    out.shovel = shot(sh);
    r.dispose();
    if (r.forceContextLoss) r.forceContextLoss();
    return out;
  }

  // =====================================================================
  // Bucle principal
  // =====================================================================
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  let elapsed = 0;
  function loop() {
    requestAnimationFrame(loop);
    const raw = Math.min(clock.getDelta(), 0.25);
    const dt = Math.min(raw, 1 / 20);
    elapsed += dt;
    updateTweens(raw);
    stepSprings(dt);
    swayFlowers(ambientTrees, elapsed * 0.6);
    if (bouquet.visible) {
      swayFlowers(bouquetFlowers, elapsed);
      if (bouquet.userData.bob) bouquet.position.y = BOUQUET_Y + Math.sin(elapsed * 1.2) * 0.05;
    }
    if (garden.visible) {
      swayFlowers(plantsGroup.children, elapsed);
      decorGroup.children.forEach((o) => o.userData.update && o.userData.update(elapsed, dt));
      updateWets(dt);
      if (selected) {
        selRing.position.set(selected.position.x, selected.position.y + 0.02, selected.position.z);
        selRing.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.05);
      }
      if (mode === 'water' && !toolBusy) can.rotation.z = Math.sin(elapsed * 2) * 0.05;
      if (mode === 'shovel' && !toolBusy) shovel.position.y += Math.sin(elapsed * 2.4) * 0.0015;
    }
    updateBits(dt);
    updateDrift(dt, elapsed);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();

  // Ayuda para pruebas: abre la página con ?debug=1
  if (params.get('debug') === '1') {
    window.__jardin = {
      get state() { return state; },
      screenOf(x, y, z) { const v = new V3(x, y, z).project(camera); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; },
    };
  }

  // =====================================================================
  // Arranque
  // =====================================================================
  (async function init() {
    const fontsReady = document.fonts ? Promise.race([document.fonts.ready, wait(2500)]) : Promise.resolve();
    const [loaded] = await Promise.all([loadState(), fontsReady]);
    state = loaded;
    thumbs = makeThumbs();
    $('#loader').classList.add('gone');
    if (state.placed) {
      await enterGarden();
    } else {
      rebuildGarden();
      await showIntro(true);
      setTimeout(() => bouquetFlowers.forEach((f, i) => setTimeout(() => pokeFlower(f, null, null), i * 60)), 500);
    }
  })();
})();
