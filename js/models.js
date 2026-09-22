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
        for (let i = 0; i < 40; i++) {
          x.fillStyle = `rgba(40,20,8,${Math.random() * 0.12})`;
          x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 6, 2 + Math.random() * 4, Math.random() * 3, 0, Math.PI * 2); x.fill();
        }
      });
    }
    const t = dirtTexture.clone(); t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: '#8d5f3f', map: t, roughness: 1 });
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
  // Textura suave para pétalos: base más oscura, nervaduras finas y borde claro
  let petalTexture = null;
  function petalTex() {
    if (petalTexture) return petalTexture;
    petalTexture = canvasTex(128, 128, (x, w, h) => {
      const g = x.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, '#c9b7bd'); g.addColorStop(0.35, '#f3eef0'); g.addColorStop(1, '#ffffff');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) {
        const cx = w / 2 + (i - 4) * 9;
        x.strokeStyle = `rgba(150,110,125,${0.12 + Math.random() * 0.1})`;
        x.lineWidth = i === 4 ? 2.2 : 1;
        x.beginPath(); x.moveTo(w / 2, h);
        x.quadraticCurveTo(cx, h * 0.55, w / 2 + (i - 4) * 14, h * 0.08);
        x.stroke();
      }
      for (let i = 0; i < 260; i++) {
        x.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
        x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
    });
    petalTexture.wrapS = petalTexture.wrapT = THREE.ClampToEdgeWrapping;
    return petalTexture;
  }
  function petalMat(color, glow) {
    return cached(matCache, 'petal' + color + (glow || ''), () => new THREE.MeshStandardMaterial({
      color, map: petalTex(), side: THREE.DoubleSide, roughness: 0.55,
      emissive: glow || '#000000', emissiveIntensity: glow ? 0.55 : 0,
    }));
  }

  function ringPetals(head, petals, c) {
    const { n, w, h, cup = 0.3, curl = 0.1, tip = 0.92, open, r = 0, y = 0, color, off = 0, ruffle = 0, jitter = 0.1, glow, plain } = c;
    const geo = petalGeo(w, h, cup, curl, tip, ruffle);
    const m = plain ? pmat(color) : petalMat(color, glow);
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

  const pickR = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const scaleBud = (m) => { m.userData.petal = { rest: 0, a: 0, v: 0, mode: 'scale' }; return m; };

  // Cada flor tiene varios tonos (tones); build recibe los colores del tono elegido.
  const FLOWERS = {
    margarita: {
      stemH: 0.85, leaves: 2,
      tones: [['#ffffff', '#fff2f7', '#ffc94d'], ['#ffc2d6', '#ffdbe8', '#ffc94d'], ['#d9c7ff', '#ebe0ff', '#ffd166']],
      build(h, P, c) {
        ringPetals(h, P, { n: 16, w: 0.075, h: 0.26, cup: 0.15, curl: -0.04, tip: 0.96, open: 1.35, r: 0.05, color: c[0] });
        ringPetals(h, P, { n: 14, w: 0.07, h: 0.21, cup: 0.15, open: 1.15, r: 0.04, y: 0.012, off: 0.2, color: c[1] });
        center(h, 0.075, c[2], 0.55, 0.02);
      },
    },
    nube: {
      stemH: 0.8, leaves: 0, stemR: 0.012,
      tones: [['#ffffff', '#fbf3f6'], ['#ffd6e4', '#ffe9f0']],
      build(h, P, c) {
        const tw = mat('#7fb68d');
        for (let i = 0; i < 9; i++) {
          const a = i * 2.4, r = 0.06 + (i % 3) * 0.05, y = -0.1 + (i % 4) * 0.045;
          const t = cyl(0.004, 0.004, 0.2, 4, tw, Math.cos(a) * r * 0.5, y - 0.07, Math.sin(a) * r * 0.5);
          t.rotation.z = -Math.cos(a) * 0.5; t.rotation.x = Math.sin(a) * 0.5;
          h.add(t);
          for (let k = 0; k < 4; k++) {
            const b = sph([0.022, 0.027, 0.032][k % 3], mat(c[k % 2]), Math.cos(a) * r + rnd(-0.03, 0.03), y + rnd(-0.02, 0.04), Math.sin(a) * r + rnd(-0.03, 0.03));
            h.add(scaleBud(b)); P.push(b);
          }
        }
      },
    },
    tulipan: {
      stemH: 1.0, leaves: 2, long: true,
      tones: [['#ff6f9c', '#ff8fb1'], ['#e53950', '#f25c6e'], ['#ffd166', '#ffe08a'], ['#ffffff', '#fff0f5'], ['#a77be0', '#c09bef'], ['#ff9a5c', '#ffb784']],
      build(h, P, c) {
        ringPetals(h, P, { n: 3, w: 0.2, h: 0.34, cup: 0.55, curl: 0.02, tip: 0.97, open: 0.18, r: 0.03, color: c[0] });
        ringPetals(h, P, { n: 3, w: 0.21, h: 0.33, cup: 0.55, tip: 0.97, open: 0.3, r: 0.05, off: Math.PI / 3, color: c[1] });
      },
    },
    lavanda: {
      stemH: 1.1, leaves: 3, long: true, stemR: 0.018,
      tones: [['#9b7fd4', '#8a6bcb', '#b39ddb'], ['#c9b3f0', '#b8a0ea', '#dccbf7']],
      build(h, P, c) {
        for (let i = 0; i < 26; i++) {
          const t = i / 26, a = i * 2.4, r = 0.038 * (1 - t * 0.5);
          const b = sph(0.03, mat(c[i % 3]), Math.cos(a) * r, -0.4 + t * 0.46, Math.sin(a) * r);
          b.scale.set(1, 1.5, 1);
          h.add(scaleBud(b)); P.push(b);
        }
      },
    },
    campanilla: {
      stemH: 0.9, leaves: 2, long: true,
      tones: [['#7e9cf5', '#98b0f8'], ['#b89cf0', '#cdb6f5'], ['#ffffff', '#f3f0ff']],
      build(h, P, c) {
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1;
          const g = new THREE.Group();
          g.position.set(Math.cos(a) * 0.09, -k * 0.13, Math.sin(a) * 0.09);
          g.rotation.set(Math.PI * 0.8, a, 0);
          ringPetals(g, P, { n: 5, w: 0.09, h: 0.15, cup: 0.5, curl: -0.12, tip: 0.9, open: 0.3, color: c[k % 2] });
          h.add(g);
        }
      },
    },
    cosmos: {
      stemH: 1.05, leaves: 2, stemR: 0.018,
      tones: [['#f48fb1', '#ffcf40'], ['#d6408b', '#ffcf40'], ['#ffffff', '#ffcf40'], ['#ff9f7a', '#ffd166']],
      build(h, P, c) {
        ringPetals(h, P, { n: 8, w: 0.13, h: 0.22, cup: 0.05, tip: 0.86, ruffle: 0.06, open: 1.35, r: 0.03, color: c[0] });
        center(h, 0.05, c[1], 0.6, 0.02);
      },
    },
    rosa: {
      stemH: 1.05, leaves: 3,
      tones: [
        ['#b3134f', '#d81b60', '#e84a7f', '#f06a95'], ['#8e0e25', '#b71c2e', '#d32f3f', '#e5505e'],
        ['#f3e9e4', '#f7f0ec', '#fbf6f3', '#ffffff'], ['#f5b82e', '#f7c64d', '#f9d46e', '#fbe092'],
        ['#f29a8a', '#f5ad9f', '#f8c1b5', '#fbd4cb'],
      ],
      build(h, P, c) {
        ringPetals(h, P, { n: 3, w: 0.1, h: 0.14, cup: 0.75, open: 0.05, color: c[0], tip: 0.9 });
        ringPetals(h, P, { n: 4, w: 0.13, h: 0.17, cup: 0.65, open: 0.25, r: 0.02, off: 0.5, color: c[1] });
        ringPetals(h, P, { n: 5, w: 0.17, h: 0.2, cup: 0.6, curl: 0.05, open: 0.6, r: 0.04, off: 0.2, color: c[2] });
        ringPetals(h, P, { n: 6, w: 0.2, h: 0.22, cup: 0.5, curl: 0.14, open: 1.0, r: 0.06, off: 0.7, color: c[3] });
      },
    },
    amapola: {
      stemH: 1.0, leaves: 2, stemR: 0.018,
      tones: [['#e53935', '#ef5350'], ['#ff7043', '#ff8a65'], ['#ff8a80', '#ffab9f'], ['#fff5f5', '#ffffff']],
      build(h, P, c) {
        ringPetals(h, P, { n: 4, w: 0.27, h: 0.24, cup: 0.5, tip: 0.8, ruffle: 0.06, open: 0.8, r: 0.02, color: c[0] });
        ringPetals(h, P, { n: 4, w: 0.24, h: 0.21, cup: 0.5, tip: 0.8, ruffle: 0.05, open: 0.55, r: 0.01, off: Math.PI / 4, color: c[1] });
        center(h, 0.045, '#2b1b24', 0.8, 0.04);
        for (let i = 0; i < 10; i++) { const a = i * 0.63; h.add(sph(0.012, mat('#3a2230'), Math.cos(a) * 0.06, 0.05, Math.sin(a) * 0.06)); }
      },
    },
    clavel: {
      stemH: 0.95, leaves: 2, long: true, stemR: 0.018,
      tones: [['#f06c9b', '#f48fb1', '#f7a6c1'], ['#d32f3f', '#e04d5c', '#ea6a78'], ['#ffffff', '#fff2f6', '#ffe4ee']],
      build(h, P, c) {
        [[8, 0.1, 0.12, 0.3], [10, 0.12, 0.14, 0.7], [12, 0.13, 0.15, 1.1]].forEach(([n, w, hh, open], k) =>
          ringPetals(h, P, { n, w, h: hh, cup: 0.4, tip: 0.8, ruffle: 0.25, open, r: 0.01 * k, off: k * 0.5, color: c[k] }));
      },
    },
    girasol: {
      stemH: 1.3, leaves: 3, stemR: 0.035,
      tones: [['#ffc93c', '#ffb300', '#6d4c41'], ['#ff9f43', '#f57f17', '#5d4037']],
      build(h, P, c) {
        h.rotation.x = -0.25;
        ringPetals(h, P, { n: 14, w: 0.1, h: 0.3, cup: 0.2, tip: 1, open: 1.45, r: 0.12, color: c[0] });
        ringPetals(h, P, { n: 14, w: 0.09, h: 0.26, cup: 0.2, tip: 1, open: 1.25, r: 0.11, off: 0.22, color: c[1] });
        h.add(cyl(0.15, 0.13, 0.06, 24, mat(c[2], { roughness: 1 }), 0, 0.03, 0));
      },
    },
    hortensia: {
      stemH: 0.95, leaves: 3,
      tones: [['#b9a6f0', '#a8c4ff', '#d7b8f5', '#c7d6ff'], ['#f7a8c4', '#fbc3d6', '#f48fb1', '#ffd1e0'], ['#8fb8ff', '#a6c8ff', '#7aa6f5', '#bcd6ff']],
      build(h, P, c) {
        center(h, 0.17, '#9fcf9f', 1, 0.1);
        const N = 38;
        for (let i = 0; i < N; i++) {
          const y = 1 - (i / (N - 1)) * 1.3;
          const rr = Math.sqrt(Math.max(0, 1 - y * y));
          const a = i * 2.399963;
          const dir = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr).normalize();
          const f = new THREE.Mesh(floretGeo(), pmat(c[i % 4]));
          f.position.copy(dir).multiplyScalar(0.2).add(new THREE.Vector3(0, 0.1, 0));
          f.lookAt(f.position.clone().add(dir));
          h.add(scaleBud(f)); P.push(f);
        }
      },
    },
    lirio: {
      stemH: 1.15, leaves: 2, long: true,
      tones: [['#fde2ec', '#f7b6cd'], ['#ff9a4d', '#ffb77a'], ['#ffffff', '#f4f4f4'], ['#ffd6a5', '#ffc38a']],
      build(h, P, c) {
        ringPetals(h, P, { n: 6, w: 0.15, h: 0.42, cup: 0.35, curl: 0.35, tip: 1, open: 0.75, r: 0.02, color: c[0] });
        ringPetals(h, P, { n: 3, w: 0.08, h: 0.3, cup: 0.2, curl: 0.2, tip: 1, open: 0.5, r: 0.01, off: 0.5, color: c[1] });
        const sm = mat('#cde6b8'), tipm = mat('#e8833a');
        for (let i = 0; i < 6; i++) {
          const g = new THREE.Group();
          g.rotation.y = (i / 6) * Math.PI * 2;
          const st = cyl(0.006, 0.006, 0.28, 5, sm, 0, 0.14, 0.05);
          st.rotation.x = 0.35;
          const tp = sph(0.018, tipm, 0, 0.27, 0.14);
          tp.scale.set(0.7, 1.4, 0.7);
          g.add(st, tp); h.add(g);
        }
      },
    },
    peonia: {
      stemH: 1.0, leaves: 3,
      tones: [
        ['#f06c9b', '#f48fb1', '#f7a6c1', '#f9bfd2', '#fcd5e3'],
        ['#fbe5ec', '#fdeef2', '#fff5f7', '#ffffff', '#ffffff'],
        ['#ff7f6e', '#ff9282', '#ffa697', '#ffbaad', '#ffcdc3'],
      ],
      build(h, P, c) {
        [[4, 0.1, 0.13, 0.1], [6, 0.14, 0.17, 0.4], [7, 0.18, 0.2, 0.7], [8, 0.21, 0.22, 1.0], [9, 0.23, 0.23, 1.3]].forEach(([n, w, hh, open], k) =>
          ringPetals(h, P, { n, w, h: hh, cup: 0.6, curl: 0.1, tip: 0.85, open, r: 0.015 * k, off: k * 0.6, ruffle: 0.08, color: c[k] }));
      },
    },
    luna: {
      stemH: 1.1, leaves: 2,
      tones: [['#e8f4ff', '#f3e8ff', '#9fd0ff', '#d6b8ff']],
      build(h, P, c) {
        ringPetals(h, P, { n: 6, w: 0.16, h: 0.38, cup: 0.35, curl: 0.3, tip: 1, open: 0.9, r: 0.02, color: c[0], glow: c[2] });
        ringPetals(h, P, { n: 5, w: 0.1, h: 0.24, cup: 0.4, curl: 0.1, tip: 1, open: 0.45, off: 0.3, color: c[1], glow: c[3] });
        h.add(sph(0.05, mat('#ffffff', { emissive: '#fff1a8', emissiveIntensity: 1 }), 0, 0.06, 0));
      },
    },
    // ---------- Plantas (no flores) ----------
    trebol: {
      plant: true, tones: [['#6fbf7a', '#86cc8e', '#ffffff'], ['#7fae62', '#98c47a', '#ffc2d6']],
      build(h, P, c) {
        const lg = cached(geoCache, 'clover', () => new THREE.CircleGeometry(0.045, 12));
        for (let i = 0; i < 11; i++) {
          const a = i * 2.4, r = 0.05 + (i % 4) * 0.05;
          const g = new THREE.Group();
          g.position.set(Math.cos(a) * r, 0.04 + (i % 3) * 0.03, Math.sin(a) * r);
          for (let k = 0; k < 3; k++) {
            const l = new THREE.Mesh(lg, pmat(c[k % 2]));
            l.rotation.set(-Math.PI / 2 + 0.3, 0, (k * Math.PI * 2) / 3);
            l.position.set(Math.cos(k * 2.09) * 0.035, 0, Math.sin(k * 2.09) * 0.035);
            g.add(l);
          }
          g.add(cyl(0.004, 0.004, 0.08, 4, mat('#5fae7c'), 0, -0.03, 0));
          h.add(g);
        }
        [[0.08, 0.02], [-0.1, 0.08], [0.02, -0.12]].forEach(([x, z]) => {
          const f = sph(0.035, mat(c[2]), x, 0.13, z);
          f.scale.y = 1.2;
          h.add(scaleBud(f)); P.push(f);
        });
      },
    },
    suculenta: {
      plant: true, tones: [['#8fc9a8', '#a7d8bc'], ['#9fb8d8', '#b8cbe5'], ['#c3a0d6', '#d6bde3'], ['#b7d98f', '#f2a0b8']],
      build(h, P, c) {
        [[5, 0.1, 0.14, 0.25], [7, 0.12, 0.17, 0.75], [9, 0.13, 0.18, 1.2]].forEach(([n, w, hh, open], k) =>
          ringPetals(h, P, { n, w, h: hh, cup: 0.7, curl: 0.05, tip: 1, open, r: 0.01 * k, y: 0.02, off: k * 0.4, color: c[k === 2 ? 1 : 0], plain: true }));
      },
    },
    cactus: {
      plant: true, tones: [['#6fb98a', '#ff8fb1'], ['#7fb8a8', '#ffd166'], ['#8cbf6b', '#ffffff']],
      build(h, P, c) {
        const m = mat(c[0], { roughness: 0.8, flatShading: true });
        const body = cyl(0.11, 0.12, 0.42, 8, m, 0, 0.21, 0);
        h.add(body, sph(0.11, m, 0, 0.42, 0));
        [[1, 0.2, 0.18], [-1, 0.28, 0.14]].forEach(([s, y, len]) => {
          const arm = cyl(0.05, 0.05, 0.12, 8, m, s * 0.14, y, 0);
          arm.rotation.z = (s * Math.PI) / 2;
          const up = cyl(0.05, 0.05, len, 8, m, s * 0.2, y + len / 2, 0);
          h.add(arm, up, sph(0.05, m, s * 0.2, y + len, 0));
        });
        const fl = new THREE.Group();
        fl.position.y = 0.5;
        ringPetals(fl, P, { n: 6, w: 0.06, h: 0.08, cup: 0.4, open: 0.9, color: c[1] });
        h.add(fl);
        for (let i = 0; i < 24; i++) {
          const a = i * 2.4, y = 0.04 + (i / 24) * 0.4;
          h.add(sph(0.008, mat('#fff8e1'), Math.cos(a) * 0.118, y, Math.sin(a) * 0.118));
        }
      },
    },
    pampa: {
      plant: true, tones: [['#8cc49a', '#f3dde5'], ['#9dc28a', '#f5e6c8'], ['#88bfa0', '#e8d3f0']],
      build(h, P, c) {
        ringPetals(h, [], { n: 16, w: 0.04, h: 0.62, cup: 0.2, curl: 0.45, tip: 1, open: 0.35, color: c[0], plain: true, jitter: 0.4 });
        for (let i = 0; i < 5; i++) {
          const a = i * 1.26, lean = 0.12;
          const st = cyl(0.006, 0.006, 0.75, 4, mat('#b9c79a'), Math.cos(a) * lean * 0.5, 0.37, Math.sin(a) * lean * 0.5);
          st.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18);
          h.add(st);
          const pl = sph(0.05, mat(c[1], { roughness: 1 }), Math.cos(a) * lean, 0.8, Math.sin(a) * lean);
          pl.scale.set(0.9, 2.6, 0.9);
          h.add(scaleBud(pl)); P.push(pl);
        }
      },
    },
    helecho: {
      plant: true, tones: [['#5fae7c', '#7cc594'], ['#6fae5f', '#8cc47a']],
      build(h, P, c) {
        ringPetals(h, P, { n: 10, w: 0.13, h: 0.55, cup: 0.15, curl: 0.4, tip: 1, ruffle: 0.22, open: 0.75, color: c[0], plain: true, jitter: 0.3 });
        ringPetals(h, P, { n: 6, w: 0.11, h: 0.42, cup: 0.15, curl: 0.3, tip: 1, ruffle: 0.2, open: 0.35, off: 0.3, color: c[1], plain: true });
      },
    },
    fresa: {
      plant: true, tones: [['#6fbf8a', '#ef3b5d'], ['#7cc594', '#ff6f8f']],
      build(h, P, c) {
        const lg = petalGeo(0.12, 0.14, 0.3, 0.05, 0.85, 0.05);
        for (let i = 0; i < 7; i++) {
          const g = new THREE.Group();
          g.rotation.y = i * 0.9;
          g.add(cyl(0.006, 0.006, 0.22, 4, mat('#5fae7c'), 0, 0.09, 0.05));
          for (let k = -1; k <= 1; k++) {
            const l = new THREE.Mesh(lg, pmat(c[0]));
            l.position.set(0, 0.18, 0.08);
            l.rotation.set(1.1, k * 0.7, 0);
            g.add(l);
          }
          h.add(g);
        }
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05 + 0.3, r = 0.16;
          const b = new THREE.Mesh(cached(geoCache, 'berry', () => new THREE.ConeGeometry(0.035, 0.06, 10)), mat(c[1], { roughness: 0.4 }));
          b.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
          b.rotation.x = Math.PI;
          h.add(scaleBud(b)); P.push(b);
          h.add(sph(0.018, mat('#6fbf8a'), b.position.x, 0.08, b.position.z));
        }
        const fl = new THREE.Group();
        fl.position.set(0, 0.24, 0);
        ringPetals(fl, P, { n: 5, w: 0.05, h: 0.05, cup: 0.3, open: 1.3, color: '#ffffff' });
        fl.add(sph(0.015, mat('#ffd166'), 0, 0.01, 0));
        h.add(fl);
      },
    },
    bambu: {
      plant: true, tones: [['#8cc47a', '#a9d88f'], ['#b8c96a', '#d0dc8a']],
      build(h, P, c) {
        const m = mat(c[0], { roughness: 0.5 });
        const node = mat('#6f9e52');
        [[0, 0, 1.3], [0.1, 0.06, 1.05], [-0.08, 0.08, 0.9], [0.03, -0.1, 1.15]].forEach(([x, z, H]) => {
          const segs = Math.round(H / 0.26);
          for (let k = 0; k < segs; k++) {
            h.add(cyl(0.03, 0.032, 0.25, 8, m, x, k * 0.26 + 0.125, z));
            const ring = new THREE.Mesh(cached(geoCache, 'bnode', () => new THREE.TorusGeometry(0.032, 0.007, 4, 12)), node);
            ring.rotation.x = Math.PI / 2; ring.position.set(x, k * 0.26 + 0.25, z);
            h.add(ring);
          }
          const top = new THREE.Group();
          top.position.set(x, segs * 0.26, z);
          ringPetals(top, P, { n: 5, w: 0.05, h: 0.28, cup: 0.2, curl: 0.3, tip: 1, open: 1.1, color: c[1], plain: true, jitter: 0.5 });
          h.add(top);
        });
      },
    },
    monstera: {
      plant: true, tones: [['#3f9a6b', '#4fae7c'], ['#4a9e6e', '#e6f2d9']],
      build(h, P, c) {
        const lg = petalGeo(0.36, 0.42, 0.18, 0.2, 0.88, 0.04);
        for (let i = 0; i < 6; i++) {
          const g = new THREE.Group();
          g.rotation.y = i * 1.05 + Math.random() * 0.3;
          const len = 0.35 + (i % 3) * 0.1;
          const st = cyl(0.012, 0.015, len, 5, mat('#4f9e6a'), 0, len / 2, 0.08);
          st.rotation.x = 0.45;
          g.add(st);
          const leaf = new THREE.Mesh(lg, pmat(i % 3 === 0 ? c[1] : c[0], { roughness: 0.45 }));
          leaf.position.set(0, len * 0.9, len * 0.45);
          const rest = 1.0;
          leaf.rotation.x = rest;
          leaf.userData.petal = { rest, a: 0, v: 0, mode: 'rot' };
          g.add(leaf); h.add(g); P.push(leaf);
        }
      },
    },
    cerezo: { tree: true, slots: 3, stemH: 1.1, tones: [['#ffc1d9', '#ffd6e6', '#ffe6ef', '#f7a8c4'], ['#ffffff', '#fff3f7', '#ffe9f1', '#fde0ea']] },
    jacaranda: { tree: true, slots: 3, stemH: 1.2, tones: [['#a78bdb', '#b9a0e6', '#9575cd', '#c5b3ee']] },
  };

  function branchGeo(a, b, r) {
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.08, 0));
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 6, r, 5, false);
  }

  function buildTree(type, def, c) {
    const V = THREE.Vector3;
    const root = new THREE.Group();
    const P = [];
    const H = def.stemH;
    const bend = Math.round(rnd(-0.12, 0.12) * 50) / 50;
    const bark = mat('#8a5a3c', { roughness: 0.95 });
    const trunk = new THREE.Mesh(stemGeo(H, bend, 0.075), bark);
    root.add(trunk, cyl(0.09, 0.15, 0.12, 8, bark, 0, 0.06, 0));
    const headPivot = new THREE.Group();
    headPivot.position.set(bend, H, 0);
    root.add(headPivot);
    const canopy = new THREE.Group();
    canopy.rotation.y = rnd(0, 6.28);
    headPivot.add(canopy);
    const ends = [new V(0, 0.72, 0)];
    canopy.add(new THREE.Mesh(branchGeo(new V(0, 0, 0), ends[0], 0.05), bark));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rnd(-0.3, 0.3);
      const len = rnd(0.45, 0.75), up = rnd(0.2, 0.55);
      const e = new V(Math.cos(a) * len, up, Math.sin(a) * len);
      canopy.add(new THREE.Mesh(branchGeo(new V(0, rnd(0, 0.25), 0), e, 0.035), bark));
      ends.push(e);
    }
    ends.forEach((e) => {
      for (let k = 0; k < 7; k++) {
        const s = sph([0.13, 0.17, 0.21][k % 3], mat(c[k % c.length], { roughness: 0.85 }), e.x + rnd(-0.17, 0.17), e.y + rnd(-0.06, 0.18), e.z + rnd(-0.17, 0.17));
        canopy.add(scaleBud(s)); P.push(s);
      }
      canopy.add(sph(0.09, mat('#8fcf9a'), e.x + rnd(-0.2, 0.2), e.y - 0.05, e.z + rnd(-0.2, 0.2)));
    });
    root.userData = {
      kind: 'flower', type, petals: P, stem: trunk, headPivot, stemH: H, tree: true,
      wob: { a: 0, v: 0, b: 0, w: 0 }, phase: Math.random() * 6.28, color: c[0],
    };
    return root;
  }

  function buildPlant(type, def, c, opts) {
    const root = new THREE.Group();
    const P = [];
    const stem = new THREE.Object3D();
    root.add(stem);
    const headPivot = new THREE.Group();
    const head = new THREE.Group();
    head.rotation.y = Math.random() * Math.PI * 2;
    headPivot.add(head);
    root.add(headPivot);
    def.build(head, P, c);
    const hs = opts.headScale || 1;
    headPivot.scale.setScalar(hs);
    root.userData = {
      kind: 'flower', type, petals: P, stem, headPivot, stemH: 0, plant: true, hs,
      wob: { a: 0, v: 0, b: 0, w: 0 }, phase: Math.random() * 6.28, color: c[0],
    };
    return root;
  }

  function buildFlower(type, opts = {}) {
    const def = FLOWERS[type] || FLOWERS.margarita;
    const ti = Math.max(0, Math.min(def.tones.length - 1, opts.tone | 0));
    const c = def.tones[ti];
    if (def.tree) return buildTree(type, def, c);
    if (def.plant) return buildPlant(type, def, c, opts);
    const root = new THREE.Group();
    const petals = [];
    const stemH = opts.stemH || def.stemH;
    const bend = Math.round(((Math.random() - 0.5) * 0.14) * 50) / 50;
    const stem = new THREE.Mesh(stemGeo(stemH, bend, def.stemR || 0.026), mat('#5fae7c', { roughness: 0.8 }));
    root.add(stem);
    const headPivot = new THREE.Group();
    headPivot.position.set(bend, stemH, 0);
    const head = new THREE.Group();
    head.rotation.y = Math.random() * Math.PI * 2;
    headPivot.add(head);
    root.add(headPivot);
    def.build(head, petals, c);
    if (!opts.noLeaves && def.leaves) addLeaves(root, def.leaves, stemH, def.long);
    if (opts.headScale) headPivot.scale.setScalar(opts.headScale);
    root.userData = {
      kind: 'flower', type, petals, stem, headPivot, stemH, hs: opts.headScale || 1,
      wob: { a: 0, v: 0, b: 0, w: 0 }, phase: Math.random() * 6.28, color: c[0],
    };
    return root;
  }

  function setStemStretch(f, s) {
    if (f.userData.plant) { f.userData.headPivot.scale.y = (f.userData.hs || 1) * s; return; }
    f.userData.stem.scale.y = s;
    f.userData.headPivot.position.y = f.userData.stemH * s;
  }

  /** Ramillete de hojas anchas para rellenar la orilla del ramo. */
  function buildFern() {
    const g = new THREE.Group();
    const cols = ['#6fbf8a', '#86c99a', '#5fae7c'];
    const lg = petalGeo(0.2, 0.46, 0.35, 0.2, 1);
    for (let i = 0; i < 3; i++) {
      const piv = new THREE.Group();
      piv.rotation.y = (i - 1) * 0.55;
      const l = new THREE.Mesh(lg, pmat(cols[i]));
      l.rotation.x = 0.35 + i * 0.08;
      l.scale.setScalar(1 - Math.abs(i - 1) * 0.15);
      piv.add(l); g.add(piv);
    }
    return g;
  }

  // ---------- Obstáculos (se quitan con la pala) ----------
  function buildObstacle(type) {
    const g = new THREE.Group();
    if (type === 'tronco') {
      const bark = mat('#8a5a3c', { roughness: 1 });
      g.add(cyl(0.26, 0.3, 0.34, 14, bark, 0, 0.17, 0));
      g.add(cyl(0.245, 0.245, 0.02, 14, mat('#e2bf95'), 0, 0.345, 0));
      const ring = new THREE.Mesh(cached(geoCache, 'stumpRing', () => new THREE.TorusGeometry(0.13, 0.01, 4, 20)), mat('#c49a6c'));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.356;
      g.add(ring);
      for (let i = 0; i < 4; i++) {
        const r = cyl(0.05, 0.08, 0.35, 6, bark, 0, 0.05, 0);
        const a = i * 1.6 + 0.3;
        r.position.set(Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3);
        r.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
        g.add(r);
      }
      g.add(sph(0.04, mat('#ff6f91'), 0.08, 0.38, 0.05));
    } else if (type === 'maleza') {
      const m = pmat('#4e8c5a'), m2 = pmat('#6b9e5e');
      const bg = petalGeo(0.07, 0.48, 0.2, 0.3, 1);
      for (let i = 0; i < 14; i++) {
        const piv = new THREE.Group();
        piv.rotation.y = i * 2.4;
        piv.position.set(rnd(-0.12, 0.12), 0, rnd(-0.12, 0.12));
        const b = new THREE.Mesh(bg, i % 2 ? m : m2);
        b.rotation.x = rnd(0.2, 0.7);
        b.scale.setScalar(rnd(0.7, 1.2));
        piv.add(b); g.add(piv);
      }
      for (let i = 0; i < 3; i++) {
        const t = cyl(0.01, 0.015, 0.5, 4, mat('#7a5a3a'), rnd(-0.1, 0.1), 0.22, rnd(-0.1, 0.1));
        t.rotation.set(rnd(-0.4, 0.4), 0, rnd(-0.4, 0.4));
        g.add(t);
      }
    } else {
      const m = mat('#b7aab8', { roughness: 1, flatShading: true });
      const m2 = mat('#a497a6', { roughness: 1, flatShading: true });
      const dg = cached(geoCache, 'dodec', () => new THREE.DodecahedronGeometry(0.3, 0));
      [[0, 0, 1, m], [0.3, 0.1, 0.55, m2], [-0.2, 0.25, 0.4, m2]].forEach(([x, z, s, mm]) => {
        const r = new THREE.Mesh(dg, mm);
        r.scale.set(1.2 * s, 0.7 * s, s);
        r.position.set(x, 0.15 * s, z);
        r.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
        g.add(r);
      });
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData.kind = 'obstacle';
    g.userData.type = type;
    return g;
  }

  const grassGeo = () => petalGeo(0.05, 0.3, 0.15, 0.25, 1);

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
      g.add(box(0.98, 0.4, 0.05, woodMat('#e8b88f'), 0, 0.72, 0));
      const text = (opts.text || '').trim();
      if (text) {
        const face = new THREE.Mesh(cached(geoCache, 'signFace', () => new THREE.PlaneGeometry(0.94, 0.36)),
          new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.9 }));
        face.position.set(0, 0.72, 0.027);
        g.add(face);
      }
      g.add(sph(0.05, mat('#ff6f9c'), 0.42, 0.93, 0.03));
      g.add(sph(0.04, mat('#ffd166'), 0.34, 0.95, 0.03));
      g.add(sph(0.035, mat('#8fd3b6'), -0.4, 0.94, 0.03));
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
    caminito() {
      const g = new THREE.Group();
      const m = mat('#e9dde6', { roughness: 1, flatShading: true });
      for (let i = 0; i < 4; i++) {
        const st = new THREE.Mesh(cylGeo(0.22, 0.24, 0.06, 9), m);
        st.position.set(rnd(-0.1, 0.1), 0.03, -0.75 + i * 0.5);
        st.rotation.y = rnd(0, 3);
        st.scale.set(rnd(0.85, 1.1), 1, rnd(0.8, 1.05));
        g.add(st);
      }
      return g;
    },
    arbusto() {
      const g = new THREE.Group();
      const greens = ['#7cc594', '#8fd3a6', '#6fb987'];
      [[0, 0.3, 0, 0.34], [0.25, 0.22, 0.1, 0.26], [-0.24, 0.22, -0.05, 0.27], [0.05, 0.22, 0.25, 0.24], [-0.05, 0.2, -0.26, 0.24]].forEach(([x, y, z, r], i) => {
        const b = new THREE.Mesh(sphereGeo(1, 14, 10), mat(greens[i % 3], { roughness: 0.95 }));
        b.scale.setScalar(r); b.position.set(x, y, z);
        g.add(b);
      });
      const cols = ['#ff8fb1', '#ffffff', '#ffd166'];
      for (let i = 0; i < 14; i++) {
        const y = rnd(0.15, 1), a = rnd(0, 6.28), rr = Math.sqrt(1 - y * y);
        g.add(sph(0.035, mat(cols[i % 3]), Math.cos(a) * rr * 0.38, 0.3 + y * 0.3, Math.sin(a) * rr * 0.38));
      }
      return g;
    },
    estanque() {
      const g = new THREE.Group();
      const dg = cached(geoCache, 'pebble', () => new THREE.DodecahedronGeometry(0.1, 0));
      const sm = mat('#cfc3d0', { roughness: 1, flatShading: true });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = new THREE.Mesh(dg, sm);
        r.position.set(Math.cos(a) * 0.62, 0.05, Math.sin(a) * 0.62);
        r.scale.set(rnd(0.9, 1.3), 0.6, rnd(0.9, 1.3));
        r.rotation.set(rnd(0, 3), rnd(0, 3), 0);
        g.add(r);
      }
      g.add(cyl(0.6, 0.6, 0.03, 28, mat('#9fd8ef', { transparent: true, opacity: 0.85, roughness: 0.1 }), 0, 0.035, 0));
      const padG = cached(geoCache, 'pad', () => new THREE.CircleGeometry(0.11, 18, 0.4, Math.PI * 2 - 0.4));
      [[0.2, 0.1], [-0.18, -0.15], [0.05, -0.28]].forEach(([x, z], i) => {
        const p = new THREE.Mesh(padG, pmat('#7cc594'));
        p.rotation.set(-Math.PI / 2, 0, i * 2);
        p.position.set(x, 0.055, z);
        g.add(p);
      });
      const fl = new THREE.Group();
      fl.position.set(0.2, 0.06, 0.1);
      ringPetals(fl, [], { n: 6, w: 0.05, h: 0.08, cup: 0.4, open: 0.9, color: '#ffc1d9' });
      g.add(fl);
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

  // ---------- Mascotas ----------
  const ell = (rx, ry, rz, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(sphereGeo(1, 16, 12), m); o.scale.set(rx, ry, rz); o.position.set(x, y, z); return o; };
  const PET_DEFS = {
    gato: { body: '#f4a95b', belly: '#fff3e6', ear: 'point', tail: 'up', inner: '#ffb3c6' },
    perro: { body: '#d9a066', belly: '#fff1dc', ear: 'flop', earColor: '#a8703f', tail: 'short' },
    conejo: { body: '#f3eef2', belly: '#ffffff', ear: 'long', inner: '#ffc2d6', tail: 'pom', hop: true },
    cerdito: { body: '#f9b8c6', belly: '#fcd0da', ear: 'point', inner: '#f48fb1', tail: 'curl', snout: '#f48fb1' },
    zorro: { body: '#f08a3c', belly: '#ffffff', ear: 'point', earTip: '#3a2a2a', tail: 'bush', legColor: '#3a2a2a' },
    panda: { body: '#ffffff', belly: '#ffffff', ear: 'round', earColor: '#2e2a33', tail: 'short', legColor: '#2e2a33', patches: true },
    pinguino: { biped: true, body: '#2e2a3a', belly: '#ffffff', beak: '#ff9f43', feet: '#ff9f43' },
    pato: { biped: true, duck: true, body: '#ffd65c', belly: '#ffe38a', beak: '#ff9f43', feet: '#ff9f43' },
  };

  function petFace(head, r, d, zf) {
    const black = mat('#2b2230', { roughness: 0.3 });
    const white = mat('#ffffff');
    [-1, 1].forEach((s) => {
      head.add(sph(0.022, black, s * r * 0.4, r * 0.2, zf));
      head.add(sph(0.008, white, s * r * 0.4 + 0.007, r * 0.2 + 0.01, zf + 0.018));
      head.add(sph(0.02, mat('#ff9fb8'), s * r * 0.62, -r * 0.18, zf - 0.02));
    });
  }

  function buildPet(type) {
    const d = PET_DEFS[type] || PET_DEFS.gato;
    const g = new THREE.Group();
    const root = new THREE.Group();
    g.add(root);
    const legs = [], wings = [];
    const bm = mat(d.body, { roughness: 0.75 }), wm = mat(d.belly, { roughness: 0.8 });
    const head = new THREE.Group();
    let tailPivot = null;

    if (d.biped) {
      if (d.duck) {
        root.add(ell(0.15, 0.13, 0.2, bm, 0, 0.2, 0));
        head.position.set(0, 0.38, 0.12);
        head.add(ell(0.1, 0.1, 0.1, bm));
        head.add(ell(0.05, 0.018, 0.06, mat(d.beak), 0, -0.02, 0.11));
        petFace(head, 0.1, d, 0.085);
        const tail = ell(0.05, 0.04, 0.06, bm, 0, 0.27, -0.2);
        tail.rotation.x = -0.6;
        root.add(tail);
      } else {
        root.add(ell(0.15, 0.21, 0.14, bm, 0, 0.23, 0));
        root.add(ell(0.11, 0.16, 0.07, wm, 0, 0.21, 0.08));
        head.position.set(0, 0.45, 0.02);
        head.add(ell(0.11, 0.1, 0.1, bm));
        head.add(ell(0.08, 0.06, 0.05, wm, 0, -0.01, 0.06));
        const beak = new THREE.Mesh(cached(geoCache, 'beak', () => new THREE.ConeGeometry(0.025, 0.07, 8)), mat(d.beak));
        beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.02, 0.12);
        head.add(beak);
        petFace(head, 0.1, d, 0.09);
      }
      [-1, 1].forEach((s) => {
        const w = new THREE.Group();
        w.position.set(s * 0.14, 0.3, 0);
        const wing = ell(0.03, 0.11, 0.07, bm, 0, -0.08, 0);
        w.add(wing); root.add(w); wings.push(w);
        const leg = new THREE.Group();
        leg.position.set(s * 0.06, 0.06, 0.02);
        leg.add(cyl(0.012, 0.012, 0.06, 5, mat(d.feet), 0, -0.03, 0));
        leg.add(ell(0.045, 0.012, 0.065, mat(d.feet), 0, -0.058, 0.03));
        g.add(leg); legs.push(leg);
      });
    } else {
      const lm = mat(d.legColor || d.body, { roughness: 0.75 });
      root.add(ell(0.15, 0.13, 0.22, bm, 0, 0.22, 0));
      root.add(ell(0.11, 0.08, 0.17, wm, 0, 0.17, 0.03));
      head.position.set(0, 0.37, 0.19);
      head.add(ell(0.14, 0.13, 0.13, bm));
      head.add(ell(0.075, 0.055, 0.06, wm, 0, -0.035, 0.1));
      head.add(sph(0.022, mat(d.snout || '#3a2a2a'), 0, -0.01, 0.155));
      if (d.snout) { const sn = ell(0.05, 0.04, 0.02, mat(d.snout), 0, -0.03, 0.15); head.add(sn); }
      petFace(head, 0.14, d, 0.11);
      if (d.patches) [-1, 1].forEach((s) => { const p = ell(0.035, 0.045, 0.02, mat('#2e2a33'), s * 0.055, 0.03, 0.115); p.rotation.z = s * 0.4; head.add(p); });
      [-1, 1].forEach((s) => {
        const em = mat(d.earColor || d.body, { roughness: 0.75 });
        if (d.ear === 'point') {
          const e = new THREE.Mesh(cached(geoCache, 'ear', () => new THREE.ConeGeometry(0.055, 0.11, 4)), em);
          e.position.set(s * 0.08, 0.13, -0.01); e.rotation.z = -s * 0.35;
          head.add(e);
          if (d.inner) { const i = new THREE.Mesh(cached(geoCache, 'earIn', () => new THREE.ConeGeometry(0.03, 0.07, 4)), mat(d.inner)); i.position.set(s * 0.078, 0.12, 0.015); i.rotation.z = -s * 0.35; head.add(i); }
          if (d.earTip) { const t = new THREE.Mesh(cached(geoCache, 'earTip', () => new THREE.ConeGeometry(0.025, 0.04, 4)), mat(d.earTip)); t.position.set(s * 0.1, 0.18, -0.01); t.rotation.z = -s * 0.35; head.add(t); }
        } else if (d.ear === 'flop') {
          const e = ell(0.04, 0.09, 0.03, em, s * 0.13, 0.0, 0); e.rotation.z = s * 0.35; head.add(e);
        } else if (d.ear === 'long') {
          const e = ell(0.035, 0.14, 0.022, em, s * 0.05, 0.2, -0.02); e.rotation.z = -s * 0.15; head.add(e);
          const i = ell(0.02, 0.1, 0.01, mat(d.inner), s * 0.05, 0.2, -0.002); i.rotation.z = -s * 0.15; head.add(i);
        } else {
          head.add(sph(0.045, em, s * 0.1, 0.11, -0.01));
        }
      });
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.085, 0.14, sz * 0.12);
        leg.add(cyl(0.035, 0.03, 0.14, 7, lm, 0, -0.07, 0));
        leg.add(sph(0.034, lm, 0, -0.135, 0.01));
        g.add(leg); legs.push(leg);
      });
      tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0.26, -0.2);
      if (d.tail === 'up') { const t = cyl(0.025, 0.02, 0.24, 6, bm, 0, 0.12, -0.02); t.rotation.x = -0.35; tailPivot.add(t); tailPivot.rotation.x = -0.5; }
      else if (d.tail === 'short') tailPivot.add(ell(0.035, 0.035, 0.06, mat(d.legColor || d.body), 0, 0.02, -0.02));
      else if (d.tail === 'pom') tailPivot.add(sph(0.05, wm, 0, -0.02, 0));
      else if (d.tail === 'curl') { const t = new THREE.Mesh(cached(geoCache, 'curl', () => new THREE.TorusGeometry(0.035, 0.012, 6, 14, 5)), bm); t.rotation.y = Math.PI / 2; tailPivot.add(t); }
      else if (d.tail === 'bush') { const t = ell(0.07, 0.07, 0.16, bm, 0, 0.05, -0.12); t.rotation.x = -0.5; tailPivot.add(t, ell(0.045, 0.045, 0.06, wm, 0, 0.12, -0.25)); }
      root.add(tailPivot);
    }
    root.add(head);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.userData = { kind: 'pet', type, root, head, legs, wings, tailPivot, biped: !!d.biped, hop: !!d.hop };
    return g;
  }

  // ---------- Pala ----------
  function buildShovel() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.y = 0.15;
    g.add(inner);
    const wood = woodMat('#c98d5e');
    const metal = mat('#b9c6cc', { metalness: 0.6, roughness: 0.3 });
    inner.add(cyl(0.025, 0.025, 1.0, 8, wood, 0, 0.62, 0));
    inner.add(box(0.22, 0.045, 0.045, mat('#e0668f'), 0, 1.14, 0));
    inner.add(box(0.035, 0.12, 0.035, mat('#e0668f'), -0.09, 1.09, 0));
    inner.add(box(0.035, 0.12, 0.035, mat('#e0668f'), 0.09, 1.09, 0));
    inner.add(cyl(0.04, 0.05, 0.12, 10, metal, 0, 0.16, 0));
    const s = new THREE.Shape();
    s.moveTo(-0.12, 0.12); s.lineTo(0.12, 0.12);
    s.quadraticCurveTo(0.13, -0.06, 0, -0.15);
    s.quadraticCurveTo(-0.13, -0.06, -0.12, 0.12);
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false }), metal);
    blade.position.z = -0.008;
    inner.add(blade);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  return {
    mat, pmat, woodMat, dirtMat, petalGeo, sphereGeo, boxGeo, grassGeo,
    buildFlower, setStemStretch, buildDecor, buildCan, buildShovel, buildFern, buildObstacle, buildPet,
    PET_TYPES: Object.keys(PET_DEFS),
    FLOWER_TYPES: Object.keys(FLOWERS),
    DECOR_TYPES: Object.keys(DECOR),
    isTree: (t) => !!(FLOWERS[t] && FLOWERS[t].tree),
    isPlant: (t) => !!(FLOWERS[t] && FLOWERS[t].plant),
    toneCount: (t) => (FLOWERS[t] ? FLOWERS[t].tones.length : 1),
    flowerColor: (t, tone = 0) => { const f = FLOWERS[t] || FLOWERS.margarita; return f.tones[Math.min(tone, f.tones.length - 1)][0]; },
  };
})();
