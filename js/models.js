/* models.js
 * Modelos 3D hechos con código (sin archivos externos): flores, decoraciones,
 * regadera y materiales. Requiere THREE como global.
 */
window.Models = (() => {
  'use strict';

  const geoCache = new Map();
  const matCache = new Map();
  const cached = (map, key, make) => {
    let v = map.get(key);
    if (!v) { v = make(); map.set(key, v); }
    return v;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- Materiales ----------
  function mat(color, o = {}) {
    return cached(matCache, color + JSON.stringify(o), () =>
      new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.65, metalness: 0 }, o)));
  }
  const pmat = (color, o = {}) => mat(color, Object.assign({ side: THREE.DoubleSide, roughness: 0.5 }, o));

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  let woodTexture = null;
  function woodTex() {
    if (woodTexture) return woodTexture;
    woodTexture = canvasTex(256, 64, (x, w, h) => {
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 46; i++) {
        x.strokeStyle = `rgba(80,40,20,${0.04 + Math.random() * 0.1})`;
        x.lineWidth = 0.6 + Math.random() * 1.8;
        x.beginPath();
        const y = Math.random() * h;
        x.moveTo(0, y);
        for (let k = 0; k <= w; k += 12) x.lineTo(k, y + Math.sin(k * 0.025 + i) * 2.2);
        x.stroke();
      }
      for (let k = 0; k < 3; k++) {
        x.fillStyle = 'rgba(90,45,20,.18)';
        x.beginPath();
        x.ellipse(Math.random() * w, Math.random() * h, 7, 3, 0, 0, Math.PI * 2);
        x.fill();
      }
    });
    return woodTexture;
  }
  const woodMat = (color = '#c98d5e') =>
    cached(matCache, 'wood' + color, () => new THREE.MeshStandardMaterial({ color, map: woodTex(), roughness: 0.85 }));

  let dirtTexture = null;
  function dirtMat() {
    if (!dirtTexture) {
      dirtTexture = canvasTex(128, 128, (x, w, h) => {
        x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
          x.fillStyle = `rgba(60,30,15,${Math.random() * 0.22})`;
          const s = Math.random() * 3 + 0.5;
          x.fillRect(Math.random() * w, Math.random() * h, s, s);
        }
        // surcos
        x.strokeStyle = 'rgba(50,25,10,.18)'; x.lineWidth = 3;
        for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(0, k * 32); x.lineTo(w, k * 32 + 2); x.stroke(); }
      });
    }
    return new THREE.MeshStandardMaterial({ color: '#8d5f3f', map: dirtTexture, roughness: 1 });
  }

  // ---------- Geometrías ----------
  /** Pétalo curvo: base en el origen, crece hacia +Y y mira hacia +Z. */
  function petalGeo(w, h, cup = 0.3, curl = 0.1, tip = 0.92, ruffle = 0) {
    const key = ['p', w, h, cup, curl, tip, ruffle].join(',');
    return cached(geoCache, key, () => {
      const g = new THREE.PlaneGeometry(1, 1, 6, 8);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i);
        const t = p.getY(i) + 0.5;
        const s = 0.08 + (tip - 0.08) * t;
        const prof = Math.pow(Math.sin(Math.PI * s), 0.6) * (0.3 + 0.7 * Math.min(1, t * 2.2));
        const e = (2 * u) * (2 * u);
        let z = -cup * e * w * 0.9 * prof + curl * t * t * h;
        if (ruffle) z += Math.sin(u * 18 + t * 7) * ruffle * t * w;
        p.setXYZ(i, u * w * prof, t * h, z);
      }
      g.computeVertexNormals();
      return g;
    });
  }

  function stemGeo(h, bend, r) {
    return cached(geoCache, `stem${h.toFixed(2)},${bend.toFixed(2)},${r}`, () => {
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(bend * 0.4, h * 0.35, 0),
        new THREE.Vector3(bend * 0.9, h * 0.7, 0),
        new THREE.Vector3(bend, h, 0),
      ]);
      return new THREE.TubeGeometry(c, 14, r, 6, false);
    });
  }

  const sphereGeo = (r, ws = 16, hs = 12) => cached(geoCache, `s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
  const boxGeo = (w, h, d) => cached(geoCache, `b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cylGeo = (rt, rb, h, seg = 16, open = false) =>
    cached(geoCache, `c${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));

  const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
  const box = (w, h, d, m, x, y, z) => mesh(boxGeo(w, h, d), m, x, y, z);
  const cyl = (rt, rb, h, seg, m, x, y, z) => mesh(cylGeo(rt, rb, h, seg), m, x, y, z);
  const sph = (r, m, x, y, z) => mesh(sphereGeo(r), m, x, y, z);

  function floretGeo() {
    return cached(geoCache, 'floret', () => {
      const s = new THREE.Shape();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const r = 0.05 * (0.5 + 0.5 * Math.abs(Math.cos(2 * a)));
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      return new THREE.ShapeGeometry(s);
    });
  }

  // ---------- Flores ----------
  function ringPetals(head, petals, c) {
    const { n, w, h, cup = 0.3, curl = 0.1, tip = 0.92, open, r = 0, y = 0, color, off = 0, ruffle = 0, jitter = 0.1, glow } = c;
    const geo = petalGeo(w, h, cup, curl, tip, ruffle);
    const m = pmat(color, glow ? { emissive: glow, emissiveIntensity: 0.55 } : {});
    for (let i = 0; i < n; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = off + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * jitter;
      pivot.position.y = y;
      const me = new THREE.Mesh(geo, m);
      me.position.z = r;
      const rest = open + (Math.random() - 0.5) * jitter;
      me.rotation.x = rest;
      me.userData.petal = { rest, a: 0, v: 0, mode: 'rot' };
      pivot.add(me);
      head.add(pivot);
      petals.push(me);
    }
  }

  function center(head, r, color, flat = 0.55, y = 0) {
    const c = sph(r, mat(color, { roughness: 0.9 }), 0, y, 0);
    c.scale.y = flat;
    head.add(c);
    return c;
  }

  function addLeaves(root, n, h, long) {
    const g = petalGeo(long ? 0.12 : 0.17, long ? 0.55 : 0.34, 0.3, 0.3, 1.0);
    const m = pmat('#6fbf8a');
    for (let i = 0; i < n; i++) {
      const piv = new THREE.Group();
      piv.rotation.y = i * 2.4 + Math.random();
      piv.position.y = h * (0.1 + (0.22 * i) / n);
      const me = new THREE.Mesh(g, m);
      me.rotation.x = long ? 0.35 : 0.95;
      piv.add(me);
      root.add(piv);
    }
  }

  const FLOWERS = {
    margarita: {
      stemH: 0.85, leaves: 2, color: '#ffffff',
      build(h, P) {
        ringPetals(h, P, { n: 16, w: 0.075, h: 0.26, cup: 0.15, curl: -0.04, tip: 0.96, open: 1.35, r: 0.05, color: '#ffffff' });
        ringPetals(h, P, { n: 14, w: 0.07, h: 0.21, cup: 0.15, open: 1.15, r: 0.04, y: 0.012, off: 0.2, color: '#fff2f7' });
        center(h, 0.075, '#ffc94d', 0.55, 0.02);
      },
    },
    tulipan: {
      stemH: 1.0, leaves: 2, long: true, color: '#ff6f9c',
      build(h, P) {
        ringPetals(h, P, { n: 3, w: 0.2, h: 0.34, cup: 0.55, curl: 0.02, tip: 0.97, open: 0.18, r: 0.03, color: '#ff6f9c' });
        ringPetals(h, P, { n: 3, w: 0.21, h: 0.33, cup: 0.55, tip: 0.97, open: 0.3, r: 0.05, off: Math.PI / 3, color: '#ff8fb1' });
      },
    },
    lavanda: {
      stemH: 1.1, leaves: 3, long: true, color: '#9b7fd4', stemR: 0.018,
      build(h, P) {
        const cols = ['#9b7fd4', '#8a6bcb', '#b39ddb'];
        for (let i = 0; i < 26; i++) {
          const t = i / 26;
          const a = i * 2.4;
          const r = 0.038 * (1 - t * 0.5);
          const b = sph(0.03, mat(cols[i % 3]), Math.cos(a) * r, -0.4 + t * 0.46, Math.sin(a) * r);
          b.scale.set(1, 1.5, 1);
          b.userData.petal = { rest: 0, a: 0, v: 0, mode: 'scale', base: 1 };
          h.add(b); P.push(b);
        }
      },
    },
    rosa: {
      stemH: 1.05, leaves: 3, color: '#e84a7f',
      build(h, P) {
        const c = ['#b3134f', '#d81b60', '#e84a7f', '#f06a95'];
        ringPetals(h, P, { n: 3, w: 0.1, h: 0.14, cup: 0.75, open: 0.05, color: c[0], tip: 0.9 });
        ringPetals(h, P, { n: 4, w: 0.13, h: 0.17, cup: 0.65, open: 0.25, r: 0.02, off: 0.5, color: c[1] });
        ringPetals(h, P, { n: 5, w: 0.17, h: 0.2, cup: 0.6, curl: 0.05, open: 0.6, r: 0.04, off: 0.2, color: c[2] });
        ringPetals(h, P, { n: 6, w: 0.2, h: 0.22, cup: 0.5, curl: 0.14, open: 1.0, r: 0.06, off: 0.7, color: c[3] });
      },
    },
    girasol: {
      stemH: 1.3, leaves: 3, color: '#ffc93c', stemR: 0.035,
      build(h, P) {
        h.rotation.x = -0.25;
        ringPetals(h, P, { n: 14, w: 0.1, h: 0.3, cup: 0.2, tip: 1, open: 1.45, r: 0.12, color: '#ffc93c' });
        ringPetals(h, P, { n: 14, w: 0.09, h: 0.26, cup: 0.2, tip: 1, open: 1.25, r: 0.11, off: 0.22, color: '#ffb300' });
        const d = cyl(0.15, 0.13, 0.06, 24, mat('#6d4c41', { roughness: 1 }), 0, 0.03, 0);
        h.add(d);
      },
    },
    hortensia: {
      stemH: 0.95, leaves: 3, color: '#b9a6f0',
      build(h, P) {
        center(h, 0.17, '#9fcf9f', 1, 0.1);
        const cols = ['#b9a6f0', '#a8c4ff', '#d7b8f5', '#c7d6ff'];
        const N = 38;
        for (let i = 0; i < N; i++) {
          const y = 1 - (i / (N - 1)) * 1.3;
          const rr = Math.sqrt(Math.max(0, 1 - y * y));
          const a = i * 2.399963;
          const dir = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr).normalize();
          const f = new THREE.Mesh(floretGeo(), pmat(cols[i % 4]));
          f.position.copy(dir).multiplyScalar(0.2).add(new THREE.Vector3(0, 0.1, 0));
          f.lookAt(f.position.clone().add(dir));
          f.userData.petal = { rest: 0, a: 0, v: 0, mode: 'scale', base: 1 };
          h.add(f); P.push(f);
        }
      },
    },
    lirio: {
      stemH: 1.15, leaves: 2, long: true, color: '#fde2ec',
      build(h, P) {
        ringPetals(h, P, { n: 6, w: 0.15, h: 0.42, cup: 0.35, curl: 0.35, tip: 1, open: 0.75, r: 0.02, color: '#fde2ec' });
        ringPetals(h, P, { n: 3, w: 0.08, h: 0.3, cup: 0.2, curl: 0.2, tip: 1, open: 0.5, r: 0.01, off: 0.5, color: '#f7b6cd' });
        const sm = mat('#cde6b8');
        const tipm = mat('#e8833a');
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const g = new THREE.Group();
          g.rotation.y = a;
          const s = cyl(0.006, 0.006, 0.28, 5, sm, 0, 0.14, 0);
          g.rotation.x = 0; s.rotation.x = 0.35; s.position.z = 0.05;
          const tp = sph(0.018, tipm, 0, 0.27, 0.14);
          tp.scale.set(0.7, 1.4, 0.7);
          g.add(s, tp); h.add(g);
        }
      },
    },
    peonia: {
      stemH: 1.0, leaves: 3, color: '#f7a6c1',
      build(h, P) {
        const c = ['#f06c9b', '#f48fb1', '#f7a6c1', '#f9bfd2', '#fcd5e3'];
        const rings = [[4, 0.1, 0.13, 0.1], [6, 0.14, 0.17, 0.4], [7, 0.18, 0.2, 0.7], [8, 0.21, 0.22, 1.0], [9, 0.23, 0.23, 1.3]];
        rings.forEach(([n, w, hh, open], k) =>
          ringPetals(h, P, { n, w, h: hh, cup: 0.6, curl: 0.1, tip: 0.85, open, r: 0.015 * k, off: k * 0.6, ruffle: 0.08, color: c[k] }));
      },
    },
    luna: {
      stemH: 1.1, leaves: 2, color: '#cfe8ff',
      build(h, P) {
        ringPetals(h, P, { n: 6, w: 0.16, h: 0.38, cup: 0.35, curl: 0.3, tip: 1, open: 0.9, r: 0.02, color: '#e8f4ff', glow: '#9fd0ff' });
        ringPetals(h, P, { n: 5, w: 0.1, h: 0.24, cup: 0.4, curl: 0.1, tip: 1, open: 0.45, off: 0.3, color: '#f3e8ff', glow: '#d6b8ff' });
        const c = sph(0.05, mat('#ffffff', { emissive: '#fff1a8', emissiveIntensity: 1 }), 0, 0.06, 0);
        h.add(c);
      },
    },
  };

  function buildFlower(type, opts = {}) {
    const def = FLOWERS[type] || FLOWERS.margarita;
    const root = new THREE.Group();
    const petals = [];
    const stemH = opts.stemH || def.stemH;
    const bend = (Math.random() - 0.5) * 0.14;
    const stem = new THREE.Mesh(stemGeo(stemH, bend, def.stemR || 0.026), mat('#5fae7c', { roughness: 0.8 }));
    root.add(stem);
    const headPivot = new THREE.Group();
    headPivot.position.set(bend, stemH, 0);
    const head = new THREE.Group();
    head.rotation.y = Math.random() * Math.PI * 2;
    headPivot.add(head);
    root.add(headPivot);
    def.build(head, petals);
    if (!opts.noLeaves) addLeaves(root, def.leaves || 2, stemH, def.long);
    if (opts.headScale) headPivot.scale.setScalar(opts.headScale);
    root.userData = {
      kind: 'flower', type, petals, stem, headPivot, stemH,
      wob: { a: 0, v: 0, b: 0, w: 0 }, phase: Math.random() * 6.28, color: def.color,
    };
    return root;
  }

  function setStemStretch(f, s) {
    f.userData.stem.scale.y = s;
    f.userData.headPivot.position.y = f.userData.stemH * s;
  }

  // ---------- Decoraciones ----------
  function heartShape() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.9);
    s.bezierCurveTo(-0.2, -0.6, -1, -0.3, -1, 0.25);
    s.bezierCurveTo(-1, 0.75, -0.4, 1, 0, 0.55);
    s.bezierCurveTo(0.4, 1, 1, 0.75, 1, 0.25);
    s.bezierCurveTo(1, -0.3, 0.2, -0.6, 0, -0.9);
    return s;
  }

  function signTexture(text) {
    const t = canvasTex(512, 200, (x, w, h) => {
      x.fillStyle = '#f3c9a4'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(120,60,30,.25)'; x.lineWidth = 2;
      for (let i = 0; i < 12; i++) { x.beginPath(); const y = Math.random() * h; x.moveTo(0, y); x.bezierCurveTo(w / 3, y + 6, (2 * w) / 3, y - 6, w, y); x.stroke(); }
      x.fillStyle = '#8f2d5c';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      let size = 84;
      x.font = `800 ${size}px Sniglet, "Arial Rounded MT Bold", sans-serif`;
      while (x.measureText(text).width > w - 50 && size > 30) { size -= 4; x.font = `800 ${size}px Sniglet, sans-serif`; }
      x.fillText(text, w / 2, h / 2 + 4);
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  const DECOR = {
    farolito() {
      const g = new THREE.Group();
      const w = woodMat('#b9825a');
      g.add(box(0.07, 1.35, 0.07, w, 0, 0.675, 0));
      g.add(box(0.42, 0.05, 0.05, w, 0.19, 1.3, 0));
      const piv = new THREE.Group();
      piv.position.set(0.36, 1.28, 0);
      piv.add(cyl(0.006, 0.006, 0.12, 4, mat('#8f2d5c'), 0, -0.06, 0));
      const lamp = sph(0.17, mat('#ffc1d6', { emissive: '#ff8fb1', emissiveIntensity: 0.75 }), 0, -0.3, 0);
      lamp.scale.y = 1.15;
      piv.add(lamp);
      piv.add(cyl(0.08, 0.1, 0.05, 12, mat('#8f2d5c'), 0, -0.12, 0));
      piv.add(cyl(0.1, 0.08, 0.05, 12, mat('#8f2d5c'), 0, -0.49, 0));
      const ribM = mat('#f48fb1');
      for (let i = -1; i <= 1; i++) {
        const rib = new THREE.Mesh(cached(geoCache, 'ribT', () => new THREE.TorusGeometry(0.172, 0.006, 6, 24)), ribM);
        rib.rotation.x = Math.PI / 2; rib.position.y = -0.3 + i * 0.1; rib.scale.setScalar(1 - Math.abs(i) * 0.14);
        piv.add(rib);
      }
      piv.add(cyl(0.012, 0.004, 0.14, 5, mat('#ff6f9c'), 0, -0.58, 0));
      g.add(piv);
      g.userData.update = (t) => { piv.rotation.z = Math.sin(t * 1.4) * 0.09; piv.rotation.x = Math.cos(t * 1.1) * 0.05; };
      return g;
    },
    rehilete() {
      const g = new THREE.Group();
      g.add(cyl(0.02, 0.02, 1.05, 6, mat('#ffffff'), 0, 0.525, 0));
      const hub = new THREE.Group();
      hub.position.set(0, 1.0, 0.05);
      const cols = ['#f48fb1', '#8fd3b6', '#ffd166', '#b39ddb'];
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(0.3, 0.02); s.quadraticCurveTo(0.26, 0.22, 0, 0.3); s.lineTo(0, 0);
      const bg = cached(geoCache, 'blade', () => new THREE.ShapeGeometry(s));
      cols.forEach((c, i) => { const b = new THREE.Mesh(bg, pmat(c)); b.rotation.z = (i * Math.PI) / 2; hub.add(b); });
      hub.add(sph(0.035, mat('#ffffff'), 0, 0, 0.01));
      g.add(hub);
      g.userData.update = (t, dt) => { hub.rotation.z -= dt * (2.5 + Math.sin(t * 0.7) * 1.5); };
      return g;
    },
    banca() {
      const g = new THREE.Group();
      const w = woodMat('#f0b9cc');
      const leg = woodMat('#c98d5e');
      for (let i = 0; i < 3; i++) g.add(box(1.25, 0.05, 0.13, w, 0, 0.46, -0.16 + i * 0.16));
      [[-0.52, -0.18], [0.52, -0.18], [-0.52, 0.18], [0.52, 0.18]].forEach(([x, z]) => g.add(box(0.07, 0.44, 0.07, leg, x, 0.22, z)));
      [-0.52, 0.52].forEach((x) => g.add(box(0.07, 0.5, 0.07, leg, x, 0.72, -0.2)));
      g.add(box(1.25, 0.12, 0.04, w, 0, 0.72, -0.22));
      g.add(box(1.25, 0.12, 0.04, w, 0, 0.9, -0.22));
      return g;
    },
    hongo() {
      const g = new THREE.Group();
      const make = (s, x, z) => {
        const m = new THREE.Group();
        m.add(cyl(0.1, 0.14, 0.42, 14, mat('#fff3e6'), 0, 0.21, 0));
        const cap = new THREE.Mesh(cached(geoCache, 'cap', () => new THREE.SphereGeometry(0.34, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#ff6f91'));
        cap.position.y = 0.38; cap.scale.y = 0.75;
        m.add(cap);
        for (let i = 0; i < 8; i++) {
          const a = i * 2.3, el = 0.35 + (i % 3) * 0.35;
          const d = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el) * 0.75, Math.sin(a) * Math.cos(el)).multiplyScalar(0.34);
          const sp = sph(0.045, mat('#ffffff'), d.x, 0.38 + d.y, d.z);
          sp.scale.y = 0.5;
          m.add(sp);
        }
        m.scale.setScalar(s); m.position.set(x, 0, z);
        g.add(m);
      };
      make(1, 0, 0); make(0.55, 0.38, 0.22); make(0.4, -0.3, 0.3);
      return g;
    },
    cerca() {
      const g = new THREE.Group();
      const w = woodMat('#fffafc');
      g.add(box(1.3, 0.06, 0.04, w, 0, 0.22, -0.03));
      g.add(box(1.3, 0.06, 0.04, w, 0, 0.48, -0.03));
      for (let i = 0; i < 6; i++) {
        const x = -0.55 + i * 0.22;
        g.add(box(0.11, 0.6, 0.04, w, x, 0.3, 0));
        const tip = new THREE.Mesh(cylGeo(0, 0.08, 0.1, 4), w);
        tip.position.set(x, 0.65, 0); tip.rotation.y = Math.PI / 4; tip.scale.z = 0.35;
        g.add(tip);
      }
      return g;
    },
    letrero(opts = {}) {
      const g = new THREE.Group();
      const w = woodMat('#c98d5e');
      g.add(box(0.07, 0.9, 0.07, w, -0.38, 0.45, 0));
      g.add(box(0.07, 0.9, 0.07, w, 0.38, 0.45, 0));
      g.add(box(0.98, 0.4, 0.05, w, 0, 0.72, 0));
      const face = new THREE.Mesh(cached(geoCache, 'signFace', () => new THREE.PlaneGeometry(0.94, 0.36)),
        new THREE.MeshStandardMaterial({ map: signTexture(opts.text || 'Nuestro jardín'), roughness: 0.9 }));
      face.position.set(0, 0.72, 0.027);
      g.add(face);
      g.add(sph(0.05, mat('#ff6f9c'), 0.42, 0.93, 0.03));
      g.add(sph(0.04, mat('#ffd166'), 0.34, 0.95, 0.03));
      return g;
    },
    casita() {
      const g = new THREE.Group();
      g.add(box(0.07, 1.05, 0.07, woodMat('#c98d5e'), 0, 0.525, 0));
      g.add(box(0.36, 0.32, 0.32, woodMat('#ffe0ec'), 0, 1.2, 0));
      const roof = new THREE.Mesh(cylGeo(0, 0.33, 0.24, 4), mat('#a23b6b'));
      roof.position.y = 1.48; roof.rotation.y = Math.PI / 4;
      g.add(roof);
      const hole = new THREE.Mesh(cached(geoCache, 'hole', () => new THREE.CircleGeometry(0.06, 20)), mat('#4a2233'));
      hole.position.set(0, 1.24, 0.162);
      g.add(hole);
      const perch = cyl(0.012, 0.012, 0.1, 6, woodMat('#c98d5e'), 0, 1.13, 0.2);
      perch.rotation.x = Math.PI / 2;
      g.add(perch);
      return g;
    },
    globo() {
      const g = new THREE.Group();
      g.add(box(0.12, 0.08, 0.12, mat('#ffd166'), 0, 0.04, 0));
      const fl = new THREE.Group();
      const str = cyl(0.005, 0.005, 1.2, 4, mat('#ffffff'), 0, 0.6, 0);
      const hg = cached(geoCache, 'heart', () => {
        const e = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 4, curveSegments: 18 });
        e.center();
        return e;
      });
      const heart = new THREE.Mesh(hg, mat('#ff5c8a', { roughness: 0.25, metalness: 0.1 }));
      heart.scale.setScalar(0.24); heart.position.y = 1.4;
      fl.add(str, heart);
      g.add(fl);
      g.userData.update = (t) => { fl.rotation.z = Math.sin(t * 0.9) * 0.08; heart.rotation.y = Math.sin(t * 0.6) * 0.5; heart.position.y = 1.4 + Math.sin(t * 1.6) * 0.04; };
      return g;
    },
    farol() {
      const g = new THREE.Group();
      const m = mat('#4f7f73', { roughness: 0.4, metalness: 0.3 });
      g.add(cyl(0.12, 0.16, 0.12, 12, m, 0, 0.06, 0));
      g.add(cyl(0.035, 0.045, 1.5, 10, m, 0, 0.8, 0));
      g.add(box(0.2, 0.24, 0.2, mat('#fff2c4', { emissive: '#ffe08a', emissiveIntensity: 0.9 }), 0, 1.66, 0));
      const top = new THREE.Mesh(cylGeo(0.02, 0.2, 0.14, 4), m);
      top.position.y = 1.85; top.rotation.y = Math.PI / 4;
      g.add(top);
      g.add(sph(0.035, m, 0, 1.94, 0));
      g.add(box(0.24, 0.03, 0.24, m, 0, 1.53, 0));
      return g;
    },
    molino() {
      const g = new THREE.Group();
      g.add(cyl(0.16, 0.3, 1.1, 6, woodMat('#fff3f6'), 0, 0.55, 0));
      g.add(new THREE.Mesh(cylGeo(0, 0.24, 0.32, 6), mat('#f48fb1')));
      g.children[1].position.y = 1.26;
      g.add(box(0.12, 0.2, 0.02, mat('#a23b6b'), 0, 0.25, 0.27));
      const hub = new THREE.Group();
      hub.position.set(0, 1.05, 0.22);
      const cols = ['#ffd166', '#8fd3b6', '#b39ddb', '#ff8fb1'];
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Group();
        arm.rotation.z = (i * Math.PI) / 2;
        arm.add(box(0.1, 0.52, 0.02, woodMat(cols[i]), 0, 0.3, 0));
        hub.add(arm);
      }
      hub.add(sph(0.04, mat('#ffffff'), 0, 0, 0.02));
      g.add(hub);
      g.userData.update = (t, dt) => { hub.rotation.z += dt * 1.2; };
      return g;
    },
    arco() {
      const g = new THREE.Group();
      const w = mat('#fff7fa');
      g.add(cyl(0.045, 0.05, 1.0, 8, w, -0.7, 0.5, 0));
      g.add(cyl(0.045, 0.05, 1.0, 8, w, 0.7, 0.5, 0));
      const arc = new THREE.Mesh(cached(geoCache, 'arc', () => new THREE.TorusGeometry(0.7, 0.045, 8, 32, Math.PI)), w);
      arc.position.y = 1.0;
      g.add(arc);
      const cols = ['#ff8fb1', '#f7a6c1', '#b39ddb', '#ffffff', '#ffd166'];
      for (let i = 0; i < 26; i++) {
        const a = (i / 25) * Math.PI;
        const x = Math.cos(a) * 0.7, y = 1 + Math.sin(a) * 0.7;
        const leaf = sph(0.06, mat('#8fd3b6'), x + rnd(-0.04, 0.04), y + rnd(-0.04, 0.04), rnd(-0.06, 0.06));
        g.add(leaf);
        if (i % 2 === 0) g.add(sph(0.055, mat(cols[i % 5]), x, y + 0.02, 0.07 * (i % 4 === 0 ? 1 : -1)));
      }
      for (let i = 0; i < 8; i++) {
        const s = i < 4 ? -0.7 : 0.7;
        g.add(sph(0.05, mat('#8fd3b6'), s + rnd(-0.03, 0.03), 0.2 + (i % 4) * 0.22, rnd(-0.05, 0.05)));
      }
      return g;
    },
    fuente() {
      const g = new THREE.Group();
      const stone = mat('#f3d5de', { roughness: 0.9 });
      g.add(cyl(0.55, 0.6, 0.26, 28, stone, 0, 0.13, 0));
      g.add(cyl(0.5, 0.5, 0.02, 28, mat('#9fd8ef', { transparent: true, opacity: 0.85, roughness: 0.15 }), 0, 0.25, 0));
      g.add(cyl(0.08, 0.11, 0.48, 12, stone, 0, 0.5, 0));
      g.add(cyl(0.26, 0.12, 0.12, 20, stone, 0, 0.76, 0));
      g.add(cyl(0.22, 0.22, 0.02, 20, mat('#9fd8ef', { transparent: true, opacity: 0.85 }), 0, 0.81, 0));
      g.add(sph(0.05, stone, 0, 0.86, 0));
      const dm = mat('#bfe8f7', { transparent: true, opacity: 0.9 });
      const drops = [];
      for (let i = 0; i < 26; i++) { const d = sph(0.018, dm, 0, 0, 0); drops.push(d); g.add(d); }
      g.userData.update = (t) => {
        drops.forEach((d, i) => {
          const p = (t * 0.55 + i / drops.length) % 1;
          const a = i * 2.4;
          const r = 0.08 + p * 0.36;
          d.position.set(Math.cos(a) * r, 0.86 + 1.2 * p * (0.5 - p) * 1.1, Math.sin(a) * r);
        });
      };
      return g;
    },
  };

  function buildDecor(type, opts) {
    const g = (DECOR[type] || DECOR.hongo)(opts);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData.kind = 'decor';
    g.userData.type = type;
    return g;
  }

  // ---------- Regadera ----------
  function buildCan() {
    const g = new THREE.Group();
    const m = mat('#8fd3b6', { roughness: 0.35, metalness: 0.25 });
    const dark = mat('#5fae94', { roughness: 0.35, metalness: 0.25 });
    g.add(cyl(0.18, 0.2, 0.3, 22, m, 0, 0, 0));
    g.add(cyl(0.185, 0.185, 0.03, 22, dark, 0, 0.15, 0));
    const spout = cyl(0.025, 0.04, 0.42, 10, m, 0.27, 0.08, 0);
    spout.rotation.z = -1.0;
    g.add(spout);
    const rose = cyl(0.07, 0.035, 0.06, 14, dark, 0.44, 0.2, 0);
    rose.rotation.z = -1.0;
    g.add(rose);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 20, Math.PI), dark);
    handle.position.set(-0.02, 0.15, 0);
    g.add(handle);
    const tip = new THREE.Object3D();
    tip.position.set(0.47, 0.22, 0);
    g.add(tip);
    g.add(sph(0.05, mat('#ff8fb1'), -0.2, 0.02, 0));
    g.userData.tip = tip;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  return {
    mat, pmat, woodMat, dirtMat, petalGeo, sphereGeo, boxGeo,
    buildFlower, setStemStretch, buildDecor, buildCan,
    FLOWER_TYPES: Object.keys(FLOWERS),
    DECOR_TYPES: Object.keys(DECOR),
    flowerColor: (t) => (FLOWERS[t] || FLOWERS.margarita).color,
  };
})();
