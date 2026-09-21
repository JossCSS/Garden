/* game.js
 * Ramo 3D interactivo + jardín con economía, crecimiento diario, tienda,
 * mochila y decoraciones. Guarda en MongoDB a través de /api/garden
 * (Netlify Function) y en localStorage como respaldo.
 */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const V3 = THREE.Vector3;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =====================================================================
  // Ajustes del juego (cámbialos aquí)
  // =====================================================================
  const CFG = {
    startGrid: 4,        // tamaño inicial del jardín (4 × 4)
    maxGrid: 6,          // tamaño máximo comprable
    maxHeight: 4,        // niveles extra de altura cuando el jardín está lleno
    xp: [8, 18],         // XP aleatoria por riego
    coins: [4, 12],      // monedas aleatorias por riego
    growth: 0.25,        // crecimiento por riego (4 riegos = flor adulta)
    startCoins: 60,
  };
  const LAND_PRICE = { 5: 150, 6: 320 };

  const SEEDS = [
    { id: 'margarita', name: 'Margarita', price: 10, desc: 'Sencilla, blanca y alegre.' },
    { id: 'tulipan', name: 'Tulipán', price: 15, desc: 'Pétalos cerrados como un abrazo.' },
    { id: 'lavanda', name: 'Lavanda', price: 18, desc: 'Espigas moradas que huelen a calma.' },
    { id: 'rosa', name: 'Rosa', price: 25, desc: 'La clásica, en rosa profundo.' },
    { id: 'girasol', name: 'Girasol', price: 30, desc: 'Alto y siempre buscando la luz.' },
    { id: 'hortensia', name: 'Hortensia', price: 40, desc: 'Un pompón de florecitas lilas.' },
    { id: 'lirio', name: 'Lirio', price: 50, desc: 'Pétalos largos que se curvan.' },
    { id: 'peonia', name: 'Peonía', price: 65, desc: 'Llena de pétalos, suave como nube.' },
    { id: 'luna', name: 'Flor de luna', price: 120, desc: 'Brilla un poquito, incluso de día.' },
  ];
  const DECOR = [
    { id: 'rehilete', name: 'Rehilete', price: 35, desc: 'Gira solito con el viento.' },
    { id: 'hongo', name: 'Hongos', price: 40, desc: 'Una familia de hongos con lunares.' },
    { id: 'cerca', name: 'Cerquita blanca', price: 45, desc: 'Para marcar un rincón.' },
    { id: 'farolito', name: 'Farolito de papel', price: 60, desc: 'Brilla rosa y se mece.' },
    { id: 'letrero', name: 'Letrero', price: 70, desc: 'Dice "Nuestro jardín".' },
    { id: 'casita', name: 'Casita de pájaros', price: 85, desc: 'Por si llega alguien a cantar.' },
    { id: 'globo', name: 'Globo de corazón', price: 90, desc: 'Flota y se balancea.' },
    { id: 'banca', name: 'Banca', price: 120, desc: 'Para sentarse a ver crecer las flores.' },
    { id: 'farol', name: 'Farol de jardín', price: 140, desc: 'Luz cálida para la tarde.' },
    { id: 'molino', name: 'Molino', price: 180, desc: 'Aspas de colores que no paran.' },
    { id: 'arco', name: 'Arco de flores', price: 220, desc: 'Una entrada llena de flores.' },
    { id: 'fuente', name: 'Fuente', price: 300, desc: 'Agua que salta sin parar.' },
  ];
  const seedInfo = (id) => SEEDS.find((s) => s.id === id);
  const decorInfo = (id) => DECOR.find((d) => d.id === id);
  const BOUQUET_TYPES = ['rosa', 'peonia', 'tulipan', 'lirio', 'rosa', 'margarita', 'hortensia', 'lavanda', 'rosa'];

  // Medidas del macetero
  const TILE = 1, BASE_H = 0.14, DIRT_TOP = 0.78, FRAME_TOP = 0.88, FRAME_T = 0.14;
  const BOUQUET_Y = 0.85;

  // =====================================================================
  // Estado y guardado
  // =====================================================================
  const fmtDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => fmtDay(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return fmtDay(d); };

  function freshState() {
    return {
      v: 1, placed: false, coins: CFG.startCoins, xp: 0, level: 1, grid: CFG.startGrid, heightCap: 0,
      streak: 0, lastWaterDay: null, plants: [], seeds: { margarita: 2 }, bag: {}, decor: [], nextId: 1, updatedAt: 0,
    };
  }
  function sanitize(s) {
    const o = Object.assign(freshState(), s && typeof s === 'object' ? s : {});
    o.grid = clamp(o.grid | 0, 3, CFG.maxGrid);
    o.heightCap = clamp(o.heightCap | 0, 0, CFG.maxHeight);
    o.plants = (Array.isArray(o.plants) ? o.plants : []).filter((p) =>
      p && Models.FLOWER_TYPES.includes(p.type) && p.i >= 0 && p.j >= 0 && p.i < o.grid && p.j < o.grid);
    o.decor = (Array.isArray(o.decor) ? o.decor : []).filter((d) => d && Models.DECOR_TYPES.includes(d.type));
    o.seeds = o.seeds && typeof o.seeds === 'object' ? o.seeds : {};
    o.bag = o.bag && typeof o.bag === 'object' ? o.bag : {};
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
  scene.fog = new THREE.Fog('#f9d2df', 30, 85);

  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
  const INTRO_TARGET = new V3(0, 1.75, 0);
  // en pantallas verticales (iPhone) alejamos la cámara para que quepa el ramo
  const introCam = () => new V3(0, 2.3, 4.9 * Math.max(1, Math.pow(0.8 / (innerWidth / innerHeight), 0.7)));
  camera.position.copy(introCam());

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.copy(INTRO_TARGET);
  controls.minDistance = 2.2;
  controls.maxDistance = 12;
  controls.enablePan = false;
  controls.maxPolarAngle = 1.55;
  controls.autoRotate = !reduceMotion;
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

  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshStandardMaterial({ color: '#f5bfd1', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Colinas y arbustos lejanos
  (function scenery() {
    const cols = ['#f7a8c4', '#b8e2cf', '#f9c6d8', '#d9c7f2', '#fbd0dc'];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand(-0.15, 0.15);
      const d = rand(15, 28);
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Mesh(Models.sphereGeo(1, 16, 12), Models.mat(pick(cols), { roughness: 1 }));
        const r = rand(1.2, 2.6);
        s.scale.set(r, r * 0.8, r);
        s.position.set(rand(-1.5, 1.5), r * 0.25, rand(-1, 1));
        g.add(s);
      }
      g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      scene.add(g);
    }
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
    const tex = new THREE.CanvasTexture(c);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.16, map: tex, color: '#ff9fc0', transparent: true, depthWrite: false, opacity: 0.9,
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
  // Partículas: pétalos que saltan y gotas de agua
  // =====================================================================
  const bits = [];
  const burstGeo = Models.petalGeo(0.07, 0.1, 0.2, 0.1, 0.9);
  function spawnBurst(p, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(burstGeo, Models.pmat(color || '#ff9fc0'));
      m.position.copy(p);
      m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      m.userData = { v: new V3(rand(-1, 1), rand(0.8, 2), rand(-1, 1)), life: 1, spin: rand(-6, 6), g: 2.6, floor: -1 };
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
  // Ramo
  // =====================================================================
  const bouquet = new THREE.Group();
  bouquet.position.y = BOUQUET_Y;
  scene.add(bouquet);
  const bouquetFlowers = [];
  (function buildBouquet() {
    const layout = [
      { a: 0, tilt: 0, h: 2.15 },
      ...[0, 1, 2, 3, 4].map((i) => ({ a: (i / 5) * Math.PI * 2 + 0.3, tilt: 0.3, h: 2.0 })),
      ...[0, 1, 2].map((i) => ({ a: (i / 3) * Math.PI * 2 + 1.2, tilt: 0.5, h: 1.75 })),
    ];
    layout.forEach((l, i) => {
      const holder = new THREE.Group();
      holder.rotation.y = l.a;
      const f = Models.buildFlower(BOUQUET_TYPES[i], { stemH: l.h, noLeaves: true, headScale: 1.45 });
      f.rotation.x = l.tilt;
      f.position.y = -0.62;
      holder.add(f);
      bouquet.add(holder);
      bouquetFlowers.push(f);
    });
    // envoltura de papel con una abertura al frente
    const gap = 0.9;
    const wrapGeo = new THREE.CylinderGeometry(0.88, 0.08, 1.5, 36, 6, true, gap / 2, Math.PI * 2 - gap);
    const p = wrapGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(x, z);
      const k = 1 + Math.sin(a * 9 + y * 3) * 0.035 * (y + 0.75);
      p.setXYZ(i, x * k, y + (y > 0.7 ? Math.sin(a * 5) * 0.06 : 0), z * k);
    }
    wrapGeo.computeVertexNormals();
    const wrap = new THREE.Mesh(wrapGeo, Models.pmat('#f7a8c2', { roughness: 0.8 }));
    wrap.position.y = 0.05;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.07, 1.4, 30, 1, true), Models.pmat('#fff4f8', { roughness: 0.9 }));
    inner.position.y = 0.08;
    bouquet.add(wrap, inner);
    // listón y moño
    const rib = Models.mat('#a23b6b', { roughness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 30), rib);
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.3;
    bouquet.add(ring);
    const bow = new THREE.Group();
    bow.position.set(0, -0.3, 0.3);
    [-1, 1].forEach((s) => {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 8, 20), rib);
      loop.scale.set(1, 0.6, 1); loop.position.x = s * 0.13; loop.rotation.z = s * 0.35;
      const tail = new THREE.Mesh(Models.boxGeo(0.07, 0.34, 0.015), rib);
      tail.position.set(s * 0.07, -0.18, 0.01); tail.rotation.z = s * 0.3;
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
  let tiles = [];
  const plantsGroup = new THREE.Group();
  const decorGroup = new THREE.Group();
  garden.add(plantsGroup, decorGroup);
  const plantObjs = new Map();
  const decorObjs = new Map();

  const half = () => (state.grid * TILE) / 2;
  const baseHalf = () => half() + FRAME_T + 0.3;
  const tilePos = (i, j) => new V3((i - (state.grid - 1) / 2) * TILE, DIRT_TOP, (j - (state.grid - 1) / 2) * TILE);
  const tileAt = (i, j) => tiles.find((t) => t.userData.i === i && t.userData.j === j);
  const plantAt = (i, j) => state.plants.find((p) => p.i === i && p.j === j);
  const emptyTiles = () => tiles.filter((t) => !plantAt(t.userData.i, t.userData.j));

  function yAt(x, z) {
    const ax = Math.abs(x), az = Math.abs(z), h = half();
    if (ax < h && az < h) return DIRT_TOP;
    if (ax <= h + FRAME_T && az <= h + FRAME_T) return FRAME_TOP;
    if (ax <= baseHalf() && az <= baseHalf()) return BASE_H;
    return 0;
  }

  function buildPlanter() {
    if (planter) {
      garden.remove(planter);
      tiles.forEach((t) => t.material.dispose());
    }
    planter = new THREE.Group();
    tiles = [];
    const n = state.grid, h = half(), inner = n * TILE;
    const woods = ['#c98d5e', '#bf8455', '#d39a6a'];
    // tablones de abajo
    const bw = baseHalf() * 2, board = 0.3, count = Math.ceil(bw / board);
    for (let i = 0; i < count; i++) {
      const b = new THREE.Mesh(Models.boxGeo(bw, BASE_H, board - 0.035), Models.woodMat(woods[i % 3]));
      b.position.set(0, BASE_H / 2, -bw / 2 + board * (i + 0.5));
      planter.add(b);
    }
    // costados: dos tablones por lado
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
    // postes en las esquinas
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const p = new THREE.Mesh(Models.boxGeo(FRAME_T + 0.05, FRAME_TOP - BASE_H + 0.06, FRAME_T + 0.05), Models.woodMat('#a86f45'));
      p.position.set(sx * (h + FRAME_T / 2), BASE_H + (FRAME_TOP - BASE_H + 0.06) / 2, sz * (h + FRAME_T / 2));
      planter.add(p);
    });
    // relleno de tierra
    const fillH = DIRT_TOP - 0.1 - BASE_H;
    const fill = new THREE.Mesh(Models.boxGeo(inner, fillH, inner), Models.mat('#6e4a31', { roughness: 1 }));
    fill.position.y = BASE_H + fillH / 2;
    planter.add(fill);
    // cuadros de tierra (donde se planta)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const t = new THREE.Mesh(Models.boxGeo(TILE * 0.94, 0.12, TILE * 0.94), Models.dirtMat());
        const p = tilePos(i, j);
        t.position.set(p.x, DIRT_TOP - 0.06, p.z);
        t.userData = { kind: 'tile', i, j, wet: 0 };
        planter.add(t);
        tiles.push(t);
      }
    }
    planter.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = o.userData.kind !== 'tile'; } });
    garden.add(planter);
  }

  function growthLook(g) {
    return { size: 0.3 + 0.7 * Math.min(g, 1), stretch: 1 + 0.32 * Math.max(0, g - 1) };
  }
  function applyGrowth(obj, g, animate) {
    const { size, stretch } = growthLook(g);
    const s0 = obj.scale.x, st0 = obj.userData.stem.scale.y;
    obj.userData.baseScale = size;
    if (!animate) { obj.scale.setScalar(size); Models.setStemStretch(obj, stretch); return Promise.resolve(); }
    return tween(0.7, (k) => {
      obj.scale.setScalar(s0 + (size - s0) * k);
      Models.setStemStretch(obj, st0 + (stretch - st0) * k);
    }, ease.outBack);
  }
  function spawnPlant(p, animate) {
    const f = Models.buildFlower(p.type);
    f.userData.i = p.i; f.userData.j = p.j; f.userData.plantId = p.id;
    f.position.copy(tilePos(p.i, p.j));
    f.rotation.y = rand(0, Math.PI * 2);
    f.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    plantsGroup.add(f);
    plantObjs.set(p.id, f);
    if (animate) { f.scale.setScalar(0.01); Models.setStemStretch(f, 1); applyGrowth(f, p.g, true); }
    else applyGrowth(f, p.g, false);
    return f;
  }
  function spawnDecor(d, animate) {
    const o = Models.buildDecor(d.type);
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
  function rebuildGarden() {
    buildPlanter();
    plantsGroup.clear(); plantObjs.clear();
    decorGroup.clear(); decorObjs.clear();
    state.plants.forEach((p) => spawnPlant(p, false));
    state.decor.forEach((d) => spawnDecor(d, false));
  }
  function repositionAll() {
    state.plants.forEach((p) => { const o = plantObjs.get(p.id); if (o) o.position.copy(tilePos(p.i, p.j)); });
    state.decor.forEach((d) => { const o = decorObjs.get(d.id); if (o) o.position.y = yAt(d.x, d.z); });
  }

  const can = Models.buildCan();
  can.visible = false;
  scene.add(can);

  const selRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 40), new THREE.MeshBasicMaterial({ color: '#8fd3b6', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  selRing.rotation.x = -Math.PI / 2;
  selRing.visible = false;
  scene.add(selRing);

  // =====================================================================
  // Vista, modos y cámara
  // =====================================================================
  let view = 'loading';        // loading | intro | garden
  let mode = 'view';           // view | water | plant | place | move
  let modeData = null;
  let busy = false;
  let selected = null;

  function gardenCam() {
    const n = state.grid;
    const k = Math.max(1, Math.pow(1.1 / (innerWidth / innerHeight), 0.42));
    return new V3(n * 0.95 + 2.2, n * 0.9 + 2.6, n * 1.1 + 3.4).multiplyScalar(k);
  }
  function setGardenControls() {
    controls.enablePan = true;
    controls.minDistance = 2.5;
    controls.maxDistance = 40;
    controls.maxPolarAngle = 1.42;
    controls.autoRotate = false;
  }
  function flyCamera(to, target, dur = 1.1) {
    const cf = camera.position.clone(), tf = controls.target.clone();
    return tween(dur, (k) => { camera.position.lerpVectors(cf, to, k); controls.target.lerpVectors(tf, target, k); }, ease.inOutCubic);
  }

  function setMode(m, data = null) {
    mode = m; modeData = data;
    can.visible = m === 'water';
    if (m === 'water') { const c = new V3(0, DIRT_TOP + 1.2, 0); can.position.copy(c); can.rotation.set(0, 0, 0); }
    controls.enabled = m !== 'move';
    if (m !== 'move' && m !== 'view') selectDecor(null);
    $('#modebar').classList.toggle('hidden', m === 'view');
    $('#decorbar').classList.toggle('hidden', !(m === 'view' && selected));
    document.body.dataset.mode = m;
    updateModeText();
    refreshTileHints();
  }
  function updateModeText() {
    const t = $('#modeText');
    if (mode === 'water') t.textContent = 'Toca tus flores para regarlas';
    else if (mode === 'plant') t.textContent = `Toca un cuadro vacío para plantar: ${seedInfo(modeData).name} (te quedan ${state.seeds[modeData] || 0})`;
    else if (mode === 'place') t.textContent = `Toca el suelo para colocar: ${decorInfo(modeData).name}`;
    else if (mode === 'move') t.textContent = 'Arrastra en la pantalla para moverla';
  }
  function refreshTileHints() {
    tiles.forEach((t) => {
      const on = mode === 'plant' && !plantAt(t.userData.i, t.userData.j);
      t.material.emissive.set(on ? '#ff9fc0' : '#000000');
      t.material.emissiveIntensity = on ? 0.2 : 0;
    });
  }
  function selectDecor(o) {
    selected = o;
    selRing.visible = !!o;
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
    const empty = emptyTiles();
    if (empty.length) {
      const t = pick(empty);
      const type = pick(SEEDS.filter((s) => s.price <= 50)).id;
      const p = { id: state.nextId++, type, i: t.userData.i, j: t.userData.j, g: 0.15, w: null };
      state.plants.push(p);
      setTimeout(() => { spawnPlant(p, true); spawnBurst(tilePos(p.i, p.j).add(new V3(0, 0.3, 0)), Models.flowerColor(type), 12); }, 900);
      toast(`¡Nivel ${state.level}! Brotó una flor nueva (${seedInfo(type).name}) y ganaste ${bonus} monedas.`);
    } else if (state.heightCap < CFG.maxHeight) {
      state.heightCap++;
      toast(`¡Nivel ${state.level}! Tu jardín está lleno, así que ahora tus flores pueden crecer más alto.`);
    } else {
      toast(`¡Nivel ${state.level}! Ganaste ${bonus} monedas.`);
    }
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

  let canBusy = false;
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
  async function waterTile(tile) {
    if (canBusy) return;
    canBusy = true;
    const { i, j } = tile.userData;
    const tp = tilePos(i, j);
    await pourAt(tp);
    tile.userData.wet = 1;
    const plant = plantAt(i, j);
    if (plant) {
      const obj = plantObjs.get(plant.id);
      const head = tp.clone().add(new V3(0, 1.1, 0));
      if (plant.w === today()) {
        floatText(head, 'Ya bebió agua hoy', 'muted');
        if (obj) pokeFlower(obj, null, null);
      } else {
        const mult = streakMultiplier();
        const xp = Math.round(randInt(CFG.xp[0], CFG.xp[1]) * mult);
        const coins = randInt(CFG.coins[0], CFG.coins[1]);
        plant.w = today();
        plant.g = Math.min(plant.g + CFG.growth, 1 + state.heightCap);
        state.coins += coins;
        floatText(head, `+${xp} XP`, 'xp');
        setTimeout(() => floatText(head.clone().add(new V3(0, -0.3, 0)), `+${coins}`, 'coin'), 220);
        if (obj) { applyGrowth(obj, plant.g, true); pokeFlower(obj, null, head); }
        addXP(xp);
        renderHUD();
        save();
      }
    }
    canBusy = false;
  }
  function plantSeed(tile) {
    const { i, j } = tile.userData;
    const type = modeData;
    if (plantAt(i, j)) { floatText(tilePos(i, j).add(new V3(0, 0.8, 0)), 'Ese cuadro ya tiene flor', 'muted'); return; }
    if (!(state.seeds[type] > 0)) { setMode('view'); return; }
    state.seeds[type]--;
    const p = { id: state.nextId++, type, i, j, g: 0.05, w: null };
    state.plants.push(p);
    spawnPlant(p, true);
    spawnBurst(tilePos(i, j).add(new V3(0, 0.1, 0)), '#8d5f3f', 10);
    floatText(tilePos(i, j).add(new V3(0, 0.7, 0)), 'Plantada', 'xp');
    renderHUD(); renderBag(); save();
    if (!(state.seeds[type] > 0)) setMode('view');
    else { updateModeText(); refreshTileHints(); }
  }
  function placeDecor(p) {
    const type = modeData;
    const lim = half() + 3.2;
    if (Math.hypot(p.x, p.z) > lim) { floatText(p, 'Muy lejos del jardín', 'muted'); return; }
    if (!(state.bag[type] > 0)) { setMode('view'); return; }
    state.bag[type]--;
    const d = { id: state.nextId++, type, x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: 0 };
    state.decor.push(d);
    const o = spawnDecor(d, true);
    setMode('view');
    selectDecor(o);
    renderBag(); save();
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
    state.coins -= price;
    state.grid = next;
    buildPlanter();
    repositionAll();
    refreshTileHints();
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
  function hit(e, objs) { setRay(e); return ray.intersectObjects(objs, true)[0] || null; }
  function groundPoint(e, y = 0) {
    setRay(e);
    const out = new V3();
    return ray.ray.intersectPlane(new THREE.Plane(new V3(0, 1, 0), -y), out) ? out : null;
  }
  function ownerOf(o) {
    while (o) { if (o.userData && o.userData.kind) return o; o = o.parent; }
    return null;
  }
  function pickTile(e) {
    const h = hit(e, [plantsGroup, planter]);
    if (!h) return null;
    const o = ownerOf(h.object);
    if (!o) return null;
    if (o.userData.kind === 'tile') return o;
    if (o.userData.kind === 'flower') return tileAt(o.userData.i, o.userData.j);
    return null;
  }

  const pointers = new Map();
  let down = null;
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, true);
    down = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    if (mode === 'move' && selected && pointers.size === 1) {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      dragTo(e);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) { dragTo(e); return; }
    if (mode === 'water' && e.pointerType === 'mouse' && !canBusy && view === 'garden') {
      const p = groundPoint(e, DIRT_TOP);
      if (p) can.position.lerp(p.add(new V3(-0.5, 1.15, 0)), 0.35);
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (dragging) {
      dragging = false;
      const d = state.decor.find((x) => x.id === selected.userData.decorId);
      if (d) { d.x = +selected.position.x.toFixed(2); d.z = +selected.position.z.toFixed(2); save(); }
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
    const lim = half() + 3.2;
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
    if (mode === 'water') { const t = pickTile(e); if (t) waterTile(t); return; }
    if (mode === 'plant') { const t = pickTile(e); if (t) plantSeed(t); return; }
    if (mode === 'place') { const p = groundPoint(e, 0); if (p) placeDecor(p); return; }
    if (mode === 'move') return;
    const h = hit(e, [plantsGroup, decorGroup]);
    if (!h) { selectDecor(null); return; }
    const o = ownerOf(h.object);
    if (o && o.userData.kind === 'decor') {
      selectDecor(o);
      o.userData.sq.v += 4; springy.add(o);
    } else if (o && o.userData.kind === 'flower') {
      selectDecor(null);
      pokeFlower(o, h.object, h.point);
    }
  }

  // =====================================================================
  // Transiciones
  // =====================================================================
  function seedFromBouquet() {
    const order = [];
    for (let i = 0; i < state.grid; i++) for (let j = 0; j < state.grid; j++) order.push({ i, j, d: tilePos(i, j).lengthSq() + Math.random() * 0.01 });
    order.sort((a, b) => a.d - b.d);
    BOUQUET_TYPES.forEach((type, k) => {
      const t = order[k];
      state.plants.push({ id: state.nextId++, type, i: t.i, j: t.j, g: 1, w: null });
    });
  }

  async function goToGarden() {
    if (view !== 'intro' || busy) return;
    busy = true;
    $('#placeBtn').classList.add('hidden');
    $('#intro').classList.add('hidden');
    controls.autoRotate = false;
    controls.enabled = false;
    const firstTime = !state.placed;
    bouquet.userData.bob = false;
    const y0 = bouquet.position.y;
    await tween(0.8, (k) => {
      bouquet.position.y = y0 + k * 1.8;
      bouquet.scale.setScalar(Math.max(0.01, 1 - k * 0.9));
      bouquet.rotation.y += 0.06;
    }, ease.inCubic);
    const burstAt = bouquet.position.clone();
    bouquet.visible = false;
    spawnBurst(burstAt, '#ff8fb1', 14);
    view = 'garden';
    if (firstTime) { seedFromBouquet(); state.placed = true; }
    rebuildGarden();
    const objs = [...plantObjs.values()];
    objs.forEach((o) => o.scale.setScalar(0.01));
    garden.visible = true;
    garden.scale.setScalar(0.01);
    setGardenControls();
    await Promise.all([
      flyCamera(gardenCam(), new V3(0, 0.7, 0), 1.2),
      tween(0.9, (k) => garden.scale.setScalar(Math.max(0.01, k)), ease.outBack),
    ]);
    setGardenControls();
    controls.enabled = true;
    $('#hud').classList.remove('hidden');
    $('#menuBtn').classList.remove('hidden');
    $('#bagBtn').classList.remove('hidden');
    renderHUD(); renderShop(); renderBag();
    for (const o of objs) {
      const p = state.plants.find((x) => x.id === o.userData.plantId);
      applyGrowth(o, p.g, true);
      await wait(reduceMotion ? 0 : 70);
    }
    if (firstTime) {
      save();
      toast('Tu ramo ya tiene un hogar. Riégalo cada día para que crezca.');
    } else if (state.plants.some((p) => p.w !== today())) {
      toast('Tus flores tienen sed. Toma la regadera desde la tienda.');
    }
    busy = false;
  }

  async function goToBouquet() {
    if (view !== 'garden' || busy) return;
    busy = true;
    closeDrawer(); closeBag();
    setMode('view'); selectDecor(null);
    $('#hud').classList.add('hidden');
    $('#menuBtn').classList.add('hidden');
    $('#bagBtn').classList.add('hidden');
    await tween(0.5, (k) => garden.scale.setScalar(Math.max(0.01, 1 - k)), ease.inCubic);
    garden.visible = false;
    view = 'intro';
    bouquet.visible = true;
    bouquet.position.y = BOUQUET_Y;
    bouquet.scale.setScalar(0.01);
    controls.enablePan = false;
    controls.minDistance = 2.2; controls.maxDistance = 12; controls.maxPolarAngle = 1.55;
    await Promise.all([
      flyCamera(introCam(), INTRO_TARGET, 1),
      tween(0.8, (k) => bouquet.scale.setScalar(Math.max(0.01, k)), ease.outBack),
    ]);
    bouquet.userData.bob = true;
    controls.autoRotate = !reduceMotion;
    $('#placeBtn').textContent = 'Ir al jardín';
    $('#placeBtn').classList.remove('hidden');
    $('#intro').classList.remove('hidden');
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
  function itemCard({ thumb, name, desc, price, btn, attr, disabled }) {
    return `<article class="item">
      <img src="${thumb || ''}" alt="" width="72" height="72">
      <div class="info"><h3>${name}</h3>${desc ? `<p>${desc}</p>` : ''}</div>
      <button class="btn buy" ${attr} ${disabled ? 'disabled' : ''}>${price != null ? COIN + price : btn}</button>
    </article>`;
  }
  function renderShop() {
    const body = $('#drawerBody');
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (tab === 'tools') {
      body.innerHTML = itemCard({
        thumb: thumbs.can, name: 'Regadera', desc: 'Cada flor te da XP y monedas una vez al día. Si riegas diario, tu racha sube las recompensas.',
        btn: mode === 'water' ? 'En uso' : 'Tomar', attr: 'data-tool="can"', disabled: mode === 'water',
      }) + `<p class="note">Cuando subes de nivel brota una flor nueva en un cuadro libre. Si ya no hay espacio, tus flores ganan altura.</p>`;
    } else if (tab === 'seeds') {
      body.innerHTML = SEEDS.map((s) => itemCard({ thumb: thumbs[s.id], name: s.name, desc: s.desc, price: s.price, attr: `data-seed="${s.id}"`, disabled: state.coins < s.price })).join('');
    } else if (tab === 'decor') {
      body.innerHTML = DECOR.map((d) => itemCard({ thumb: thumbs[d.id], name: d.name, desc: d.desc, price: d.price, attr: `data-decor="${d.id}"`, disabled: state.coins < d.price })).join('');
    } else {
      const next = state.grid + 1, price = LAND_PRICE[next];
      body.innerHTML = `<div class="land">
        <div class="land-grid" style="--n:${state.grid}">${'<i></i>'.repeat(state.grid * state.grid)}</div>
        <p>Tu jardín mide <b>${state.grid} × ${state.grid}</b> y tiene ${state.plants.length} de ${state.grid * state.grid} cuadros ocupados.</p>
        <p>Altura extra de tus flores: <b>${state.heightCap} de ${CFG.maxHeight}</b>.</p>
        ${price ? `<button class="btn" data-land ${state.coins < price ? 'disabled' : ''}>Ampliar a ${next} × ${next} por ${COIN}${price}</button>`
                : '<p class="note">Tu jardín ya tiene el tamaño máximo.</p>'}
      </div>`;
    }
  }
  function renderBag() {
    const body = $('#bagBody');
    const seeds = SEEDS.filter((s) => state.seeds[s.id] > 0);
    const decs = DECOR.filter((d) => state.bag[d.id] > 0);
    const full = emptyTiles().length === 0;
    if (!seeds.length && !decs.length) {
      body.innerHTML = '<p class="empty">Tu mochila está vacía. Compra semillas o decoraciones en la tienda.</p>';
      return;
    }
    const row = (thumb, name, n, attr, label, dis) => `<div class="bag-row"><img src="${thumb || ''}" alt="" width="52" height="52"><span>${name}<small>× ${n}</small></span><button class="btn small" ${attr} ${dis ? 'disabled' : ''}>${label}</button></div>`;
    body.innerHTML =
      (seeds.length ? `<h3>Semillas</h3>${full ? '<p class="note">No hay cuadros libres. Amplía tu terreno para plantar más.</p>' : ''}` +
        seeds.map((s) => row(thumbs[s.id], s.name, state.seeds[s.id], `data-use-seed="${s.id}"`, 'Plantar', full)).join('') : '') +
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

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4100);
  }
  function floatText(pos, text, cls = '') {
    const v = pos.clone().project(camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.innerHTML = cls === 'coin' ? COIN + text : text;
    el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
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
  $('#bouquetBtn').addEventListener('click', goToBouquet);
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
    if (b.dataset.tool === 'can') { closeDrawer(); setMode('water'); }
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
    if (e.key !== 'Escape') return;
    if ($('#drawer').classList.contains('open')) closeDrawer();
    else if (!$('#bag').classList.contains('hidden')) closeBag();
    else if (mode !== 'view') setMode('view');
    else selectDecor(null);
  });

  // Si el otro dispositivo cambió el jardín, lo traemos al volver a la app
  function adoptRemote(remote, notify) {
    state = sanitize(remote);
    safeSet(LS_KEY, JSON.stringify(state));
    if (view === 'garden') { setMode('view'); selectDecor(null); rebuildGarden(); renderHUD(); renderShop(); renderBag(); }
    if (notify) toast('El jardín se actualizó con los cambios del otro dispositivo.');
  }
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || busy) return;
    try {
      const r = await fetchJSON(`${API}?id=${encodeURIComponent(gardenId)}`);
      if (r.state && (r.state.updatedAt || 0) > (state.updatedAt || 0)) adoptRemote(r.state, false);
    } catch { /* sin conexión */ }
  });

  // =====================================================================
  // Miniaturas 3D para la tienda y la mochila
  // =====================================================================
  function makeThumbs() {
    const out = {};
    let r;
    try {
      r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch { return out; }
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
    const flowerShot = (id) => {
      // encuadramos la cabeza de la flor y un poco del tallo
      const f = Models.buildFlower(id, { stemH: 0.5, headScale: 1.2 });
      return shot(f);
    };
    SEEDS.forEach((x) => { out[x.id] = flowerShot(x.id); });
    DECOR.forEach((x) => { out[x.id] = shot(Models.buildDecor(x.id)); });
    out.can = shot(Models.buildCan());
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
    if (bouquet.visible) {
      swayFlowers(bouquetFlowers, elapsed);
      if (bouquet.userData.bob) bouquet.position.y = BOUQUET_Y + Math.sin(elapsed * 1.2) * 0.05;
    }
    if (garden.visible) {
      swayFlowers(plantsGroup.children, elapsed);
      decorGroup.children.forEach((o) => o.userData.update && o.userData.update(elapsed, dt));
      tiles.forEach((t) => {
        if (t.userData.wet > 0) {
          t.userData.wet = Math.max(0, t.userData.wet - dt * 0.12);
          t.material.color.set('#8d5f3f').lerp(new THREE.Color('#4e3121'), t.userData.wet);
        }
      });
      if (selected) {
        selRing.position.set(selected.position.x, selected.position.y + 0.02, selected.position.z);
        selRing.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.05);
      }
      if (mode === 'water' && !canBusy) can.rotation.z = Math.sin(elapsed * 2) * 0.05;
    }
    updateBits(dt);
    updateDrift(dt, elapsed);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();

  // =====================================================================
  // Arranque
  // =====================================================================
  (async function init() {
    const fontsReady = document.fonts ? Promise.race([document.fonts.ready, wait(2500)]) : Promise.resolve();
    const [loaded] = await Promise.all([loadState(), fontsReady]);
    state = loaded;
    thumbs = makeThumbs();
    rebuildGarden();
    view = 'intro';
    $('#placeBtn').textContent = state.placed ? 'Ir al jardín' : 'Colocarlas';
    $('#loader').classList.add('gone');
    $('#intro').classList.remove('hidden');
    $('#placeBtn').classList.remove('hidden');
    // pequeño saludo del ramo
    setTimeout(() => bouquetFlowers.forEach((f, i) => setTimeout(() => pokeFlower(f, null, null), i * 90)), 500);
  })();
})();
