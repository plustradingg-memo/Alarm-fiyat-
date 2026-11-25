/* RAY ARASI — Atölye simülasyonu: arabalar, trenler, uçaklar ve yapay zekâ denetleyicileri */
(function () {
  'use strict';
  const RA = window.RA;
  const WS = RA.WS;
  const T = THREE;
  const M = RA.M;
  const { DV, OPP, AXIS } = WS;
  const S = WS.S;
  const SC = 0.72;              // araç ölçeği (karelere sığsın)
  const PSC = 0.72;             // uçak ölçeği
  const CAR = {
    car: { L: 1.45 * SC, ovF: 0.3 * SC, ovR: 0.3 * SC, v0: 2.6, a: 2.4, b: 3.0, T: 0.45, s0: 0.28 },
    taxi: { L: 1.45 * SC, ovF: 0.3 * SC, ovR: 0.3 * SC, v0: 2.8, a: 2.6, b: 3.0, T: 0.42, s0: 0.28 },
    bus: { L: 3.3 * SC, ovF: 0.62 * SC, ovR: 0.78 * SC, v0: 2.2, a: 1.6, b: 2.6, T: 0.55, s0: 0.32 },
  };
  const CAR_COLORS = [0xd8432f, 0x2f6fd6, 0xeeeeee, 0x2f9e5a, 0xf08a24, 0x8a96a3, 0x1a9e9a, 0x7a4fc2];
  const V_TRAIN = 2.3, V_TAXI = 1.5;
  let uid = 1;

  /* ================= Yol üstünde ilerleyen çok parçalı taşıyıcı (tren, yerdeki uçak) ================= */
  class Mover {
    constructor(sim, owner, L) { this.sim = sim; this.owner = owner; this.L = L; this.segs = []; this.s = 0; this.v = 0; this.plan = []; this.planEnd = null; this.held = new Set(); this.wait = 0; this.blocked = null; this.blockOwner = null; }
    get net() { return this.sim.net; }
    head() { return this.segs[this.segs.length - 1]; }
    total() { let t = this.s; for (let n = 0; n < this.segs.length - 1; n++) t += this.segs[n].len; return t; }
    keysOf(m) {
      if (!m || m.virtual) return [];
      const k = [m.res];
      if (m.fam === 'air') { const rw = this.net.rwOfCell.get(m.cell); if (rw && this.net.piece(m.i, m.j, m.k) && this.net.piece(m.i, m.j, m.k).type === 'runway') k.push(rw.key); }
      return k;
    }
    tryReserve(m) {
      const ks = this.keysOf(m);
      for (const key of ks) {
        if (this.held.has(key)) continue;
        const own = this.sim.res.get(key);
        if (own && own !== this.owner) { this.blockOwner = own; return false; }
        const xc = this.sim.xc.get(key);
        if (xc) { xc.request = true; if (xc.state !== 'closed') { this.blockOwner = null; return false; } }
        if (key.startsWith('rw') && !this.sim.towerGrant(key, this.owner)) { this.blockOwner = null; return false; }
      }
      for (const key of ks) { this.sim.res.set(key, this.owner); this.held.add(key); }
      return true;
    }
    stillNeeded(key) {
      for (const m of this.segs) if (this.keysOf(m).includes(key)) return true;
      for (const m of this.plan) if (this.held.has(key) && this.keysOf(m).includes(key)) return true;
      return false;
    }
    release(key) { this.held.delete(key); if (this.sim.res.get(key) === this.owner) this.sim.res.delete(key); }
    releaseAll() { for (const k of [...this.held]) this.release(k); }
    tidy() {
      let tot = this.total();
      const dropped = [];
      while (this.segs.length > 1 && tot - this.segs[0].len > this.L + 0.12) { const g = this.segs.shift(); tot -= g.len; dropped.push(g); }
      for (const g of dropped) for (const key of this.keysOf(g)) if (!this.stillNeeded(key)) this.release(key);
      for (const key of [...this.held]) if (!this.stillNeeded(key) && !key.startsWith('rw')) this.release(key);
    }
    step(dt, P) {
      // planı ileriye doğru uzat
      let ahead = this.head().len - this.s; for (const m of this.plan) ahead += m.len;
      while (!this.planEnd && ahead < P.look) {
        const last = this.plan.length ? this.plan[this.plan.length - 1] : this.head();
        const r = P.choose(last);
        if (r === 'exit') { const vo = this.net.virtualOut(last); this.plan.push(vo); this.planEnd = 'exit'; ahead += vo.len; break; }
        if (!r || r === 'stop') { this.planEnd = 'stop'; break; }
        this.plan.push(r); ahead += r.len;
      }
      // yer ayırt (sinyal / makas / pist izni)
      let dist = this.head().len - this.s, limit = Infinity;
      this.blocked = null;
      for (let n = 0; n < this.plan.length; n++) {
        const m = this.plan[n];
        if (!this.tryReserve(m)) { limit = dist - 0.08; this.blocked = m; this.blockIdx = n; break; }
        dist += m.len;
      }
      if (limit === Infinity && this.planEnd === 'stop') limit = dist - 0.02;
      const vmax = P.vmax;
      const vt = Math.min(vmax, Math.sqrt(2 * P.dec * Math.max(0, limit)));
      if (this.v < vt) this.v = Math.min(vt, this.v + P.acc * dt); else this.v = Math.max(vt, this.v - P.dec * 2.2 * dt);
      this.s += this.v * dt;
      // yalnızca yeri ayrılmış hareketlere geçilebilir; ayrılmamış bloğun sınırında kesin dur
      let allowed = this.blocked ? this.blockIdx : this.plan.length;
      while (this.s > this.head().len && allowed > 0) { this.s -= this.head().len; this.segs.push(this.plan.shift()); allowed--; if (this.blocked) this.blockIdx--; }
      if (this.s > this.head().len) { this.s = this.head().len; if (this.blocked || !this.plan.length) this.v = Math.min(this.v, 0.2); }
      this.wait = this.v < 0.05 ? this.wait + dt : 0;
      // uzun bekleme: engellenen daldan vazgeç, başka yol seç
      if (this.blocked && this.wait > 1.6 && P.replan && this.blockIdx > 0 && this.blockIdx < this.plan.length) {
        this.plan.length = this.blockIdx; this.planEnd = null; this.wait = 1.0;
      }
      this.tidy();
    }
    pointBack(d, out) {
      let n = this.segs.length - 1, rem = d, pos = this.s;
      while (rem > pos && n > 0) { rem -= pos; n--; pos = this.segs[n].len; }
      const m = this.segs[n]; const ss = Math.max(0, pos - rem);
      m.path.at(ss, out); out.y = m.virtual ? m.h0 : this.net.y(m, ss); out.m = m;
      return out;
    }
    reverse() {
      if (this.segs.some((m) => m.virtual)) return false;
      const tot = this.total(), tailOff = Math.max(0, tot - this.L);
      for (const m of this.plan) for (const key of this.keysOf(m)) if (this.held.has(key) && !this.segs.some((g) => this.keysOf(g).includes(key))) this.release(key);
      const ns = [];
      for (let n = this.segs.length - 1; n >= 0; n--) { const m = this.segs[n]; const r = this.net.movement(m.i, m.j, m.k, m.dout, m.din); if (!r) return false; ns.unshift(r); }
      ns.reverse();
      const old0 = this.segs[0];
      this.segs = ns; this.s = Math.max(0.01, old0.len - tailOff);
      this.plan = []; this.planEnd = null; this.v = 0; this.wait = 0;
      return true;
    }
  }

  /* ================= Simülasyon ================= */
  class Sim {
    constructor(ws) {
      this.ws = ws; this.scene = ws.scene;
      this.cars = []; this.trains = []; this.planes = [];
      this.res = new Map(); this.jc = new Map(); this.xc = new Map();
      this.ai = true; this.density = 3; this.t = 0;
      this.rnd = RA.rng(20261125);
      this.stats = { cars: 0, waitSum: 0, waitN: 0, trains: 0, land: 0, takeoff: 0 };
      this.spawnT = new Map(); this.trainT = 0; this.planeT = 2; this.codeN = 100;
      this.towerQ = [];
    }

    setNet(net, dyn) {
      const prevJ = this.jc;
      this.net = net; this.dyn = dyn;
      this.jc = new Map(); this.xc = new Map();
      for (const d of dyn.junctions) {
        const old = prevJ.get(d.key);
        const axes = new Set(d.ports.map((p) => AXIS[p]));
        this.jc.set(d.key, Object.assign({ key: d.key, i: d.i, j: d.j, k: d.k, ports: d.ports, axes, green: [...axes][0], pending: null, from: null, tg: 0, flash: false, idle: 0, dyn: d }, old ? { green: old.green, flash: old.flash } : {}, { dyn: d, ports: d.ports, axes, pending: null, from: null }));
      }
      for (const d of dyn.crossings) this.xc.set(d.key, { key: d.key, kind: d.kind, i: d.i, j: d.j, state: 'open', t: 0, arm: 1, request: false, dyn: d });
      // ajanları yeni ağa taşı
      const remap = (m) => {
        if (!m || m.virtual) return m;
        const c = net.g.cell(m.i, m.j); if (!c) return null;
        for (let k = 0; k < c.pieces.length; k++) {
          const p = c.pieces[k];
          if (WS.FAMILY[p.type] !== m.fam) continue;
          const ok = (d) => d === 'C' || (p.m & WS.BIT[d]) || (p.type === 'runway');
          if (ok(m.din) && ok(m.dout)) { const r = net.movement(m.i, m.j, k, m.din, m.dout); if (r && Math.abs(r.h0 - m.h0) < 0.01 && Math.abs(r.h1 - m.h1) < 0.01) return r; }
        }
        return null;
      };
      this.res.clear();
      for (const c of [...this.cars]) { const nm = remap(c.mv); if (!nm) { this.killCar(c, true); continue; } c.mv = nm; c.prev = remap(c.prev) || null; c.plan = []; }
      for (const tr of [...this.trains]) {
        const segs = tr.mv.segs.map(remap);
        if (segs.some((x) => !x)) { this.killTrain(tr, true); continue; }
        tr.mv.segs = segs; tr.mv.plan = []; tr.mv.planEnd = null; tr.mv.held.clear();
        // düzenleme iki taşıtı aynı bloğa düşürdüyse sonradan geleni kaldır
        if (segs.some((m) => tr.mv.keysOf(m).some((k) => this.res.has(k) && this.res.get(k) !== tr))) { this.killTrain(tr, true); continue; }
        for (const m of segs) for (const k of tr.mv.keysOf(m)) { this.res.set(k, tr); tr.mv.held.add(k); }
      }
      for (const p of [...this.planes]) {
        if (p.mv) {
          const segs = p.mv.segs.map(remap);
          if (segs.some((x) => !x)) { this.killPlane(p, true); continue; }
          p.mv.segs = segs; p.mv.plan = []; p.mv.planEnd = null; p.mv.held.clear(); p.route = null; p.needRoute = true;
          if (segs.some((m) => p.mv.keysOf(m).some((k) => this.res.has(k) && this.res.get(k) !== p))) { this.killPlane(p, true); continue; }
          for (const m of segs) for (const k of p.mv.keysOf(m)) { this.res.set(k, p); p.mv.held.add(k); }
        } else if (p.rw) {
          const rw = net.runways.find((r) => r.cells.length === p.rw.cells.length && r.cells[0].i === p.rw.cells[0].i && r.cells[0].j === p.rw.cells[0].j && r.ax === p.rw.ax);
          if (!rw) { this.goAround(p); continue; }
          p.rw = rw; if (p.state === 'approach') this.res.set(rw.key, p);
        }
      }
      this.towerQ = this.towerQ.filter((q) => this.planes.includes(q.p));
    }

    /* ---------- yardımcılar ---------- */
    pick(arr) { return arr[Math.floor(this.rnd() * arr.length) % arr.length]; }
    toast(msg) { this.ws.toast(msg); }

    /* ================= ARABALAR ================= */
    makeCar(mv, s, v) {
      const r = this.rnd();
      const type = r < 0.1 ? 'bus' : r < 0.32 ? 'taxi' : 'car';
      const g = type === 'bus' ? M.bus(this.pick([0x2a7fb8, 0x1c9a6a, 0xe0662a])) : type === 'taxi' ? M.taxi() : M.car(this.pick(CAR_COLORS));
      RA.compact(g);
      g.scale.setScalar(SC);
      g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      this.scene.add(g);
      const P = CAR[type];
      const c = { kind: 'car', id: uid++, type, P, L: P.L, g, mv, prev: null, s, v, acc: 0, plan: [], wait: 0, waitTot: 0, trip: 0, commit: null, wheelA: 0, rear: null, fade: 0 };
      this.cars.push(c);
      this.placeCar(c, true);
      return c;
    }
    killCar(c, quick) { if (quick) { this.scene.remove(c.g); this.cars.splice(this.cars.indexOf(c), 1); return; } c.fade = 0.0001; }
    chooseCar(c, from) {
      const a = this.net.after(from);
      if (!a) return null;
      if (a.out) return { exit: true, len: 1.6 };
      const opts = this.net.options(a.i, a.j, a.k, a.din);
      if (opts.length === 1) return this.net.movement(a.i, a.j, a.k, a.din, opts[0]);
      const w = opts.map((d) => (d === OPP[a.din] ? 1.6 : 1));
      let t = this.rnd() * w.reduce((x, y) => x + y, 0), pick = opts[0];
      for (let n = 0; n < opts.length; n++) { t -= w[n]; if (t <= 0) { pick = opts[n]; break; } }
      return this.net.movement(a.i, a.j, a.k, a.din, pick);
    }
    ensurePlan(c) {
      while (c.plan.length < 2) {
        const last = c.plan.length ? c.plan[c.plan.length - 1] : c.mv;
        if (last.exit) break;
        const n = this.chooseCar(c, last);
        if (!n) break;
        c.plan.push(n);
      }
    }
    // kavşağa / geçide girebilir mi?
    canEnter(c, nx, buckets) {
      const net = this.net;
      const jk = nx.i + ',' + nx.j + ',' + nx.k;
      const J = this.jc.get(jk);
      const x = this.xc.get('c' + nx.i + ',' + nx.j);
      const nx2 = c.plan[1];
      const spaceAfter = () => {
        if (!nx2 || nx2.exit) return true;
        const b = buckets.get(nx2.pk) || [];
        for (const o of b) if (o.mv.din === nx2.din && o.s - o.L < c.L + 0.3) return false;
        return true;
      };
      if (J) {
        const ax = AXIS[nx.din];
        const go = J.flash || J.green === ax || c.commit === J.key;
        if (!go) return { ok: false, red: true };
        const inside = buckets.get(nx.pk) || [];
        for (const o of inside) if (o !== c && net.conflicts(o.mv, nx)) return { ok: false };
        if (!spaceAfter()) return { ok: false };
        return { ok: true };
      }
      if (x && (x.kind === 'level' || x.kind === 'taxiRoad')) {
        if (x.state !== 'open' || this.res.has(x.key)) return { ok: false, red: true };
        if (!spaceAfter()) return { ok: false };
        return { ok: true };
      }
      return { ok: true };
    }
    updateCars(dt) {
      const net = this.net;
      const buckets = new Map();
      for (const c of this.cars) { const k = c.mv.pk; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(c); }
      for (let n = this.cars.length - 1; n >= 0; n--) {
        const c = this.cars[n];
        if (c.fade) { c.fade += dt; c.g.scale.setScalar(SC * Math.max(0.01, 1 - c.fade / 0.4)); if (c.fade > 0.4) { this.scene.remove(c.g); this.cars.splice(n, 1); } continue; }
        if (c.mv.exitV) { c.s += c.v * dt; this.placeCar(c); if (c.s > 1.6) { this.finishTrip(c); this.scene.remove(c.g); this.cars.splice(n, 1); } continue; }
        this.ensurePlan(c);
        const P = c.P;
        let gap = 1e9, dv = 0;
        const rem = c.mv.len - c.s;
        // aynı karedeki öndeki araçlar
        for (const o of buckets.get(c.mv.pk) || []) {
          if (o === c || o.fade) continue;
          if (o.mv.din === c.mv.din && o.s > c.s && (o.mv.dout === c.mv.dout || o.s < 0.45 * S)) { const g2 = o.s - o.L - c.s; if (g2 < gap) { gap = g2; dv = c.v - o.v; } }
          else if (o.mv.dout === c.mv.dout && o.mv.din !== c.mv.din && o.mv.len - o.s < rem && o.mv.len - o.s < 0.5 * S) { const g2 = rem - (o.mv.len - o.s) - o.L; if (g2 > -0.2 && g2 < gap) { gap = g2; dv = c.v - o.v; } }
        }
        // sonraki karelerdeki araçlar
        let acc0 = rem;
        for (let q = 0; q < c.plan.length && acc0 < 4; q++) {
          const nx = c.plan[q]; if (nx.exit) break;
          for (const o of buckets.get(nx.pk) || []) { if (o.fade || o.mv.din !== nx.din) continue; const g2 = acc0 + o.s - o.L; if (g2 < gap) { gap = g2; dv = c.v - o.v; } }
          acc0 += nx.len;
        }
        // ışık / bariyer / kavşak izni
        let red = false;
        const nx = c.plan[0];
        if (nx && !nx.exit && rem < 2.2) {
          const r = this.canEnter(c, nx, buckets);
          if (!r.ok) { const g2 = rem - 0.12; if (g2 < gap) { gap = Math.max(0.001, g2); dv = c.v; } red = !!r.red; }
        }
        if (!nx && rem < 2) { const g2 = rem - 0.1; if (g2 < gap) { gap = Math.max(0.001, g2); dv = c.v; } }
        const sStar = P.s0 + Math.max(0, c.v * P.T + (c.v * dv) / (2 * Math.sqrt(P.a * P.b)));
        let a = P.a * (1 - Math.pow(c.v / P.v0, 4) - Math.pow(sStar / Math.max(gap, 0.01), 2));
        a = Math.max(a, -8); c.acc = a;
        c.v = Math.max(0, c.v + a * dt);
        if (gap < 0.03) c.v = 0;
        if (c.v < 0.1 && red) { c.wait += dt; c.waitTot += dt; } else c.wait = 0;
        c.s += c.v * dt;
        c.wheelA += (c.v * dt) / (0.14 * SC);
        if (c.s >= c.mv.len) {
          const nxt = c.plan.shift();
          if (!nxt) { c.s = c.mv.len; c.v = 0; }
          else if (nxt.exit) { const vo = net.virtualOut(c.mv); c.prev = c.mv; c.mv = Object.assign({}, vo, { exitV: true, pk: 'out' }); c.s = 0; }
          else {
            c.s -= c.mv.len; c.prev = c.mv; c.mv = nxt; c.trip++;
            if (c.commit && !this.jc.get(nxt.i + ',' + nxt.j + ',' + nxt.k)) c.commit = null;
            // çıkmaz sokak: otoparka girip kaybol
            if (nxt.kind === 'uturn' && c.trip > 3 && this.rnd() < 0.65) c.parkOut = true;
          }
        }
        if (c.parkOut && c.mv.kind === 'uturn' && c.s > c.mv.len * 0.45) { this.finishTrip(c); c.fade = 0.0001; }
        this.placeCar(c);
      }
    }
    finishTrip(c) { this.stats.cars++; this.stats.waitSum += c.waitTot; this.stats.waitN++; }
    placeCar(c, init) {
      const P = c.P;
      const F = {};
      const at = (d, out) => { if (d <= c.s || !c.prev) { const ss = Math.max(0, c.s - d); c.mv.path.at(ss, out); out.y = c.mv.exitV || c.mv.virtual ? c.mv.h0 : this.net.y(c.mv, ss); return out; } const ss = Math.max(0, c.prev.len - (d - c.s)); c.prev.path.at(ss, out); out.y = c.prev.virtual ? c.prev.h0 : this.net.y(c.prev, ss); return out; };
      at(P.ovF, F);
      const wb = P.L - P.ovF - P.ovR;
      if (!c.rear || init) { const R = at(P.ovF + wb, {}); c.rear = { x: R.x, z: R.z, y: R.y }; }
      let dx = F.x - c.rear.x, dz = F.z - c.rear.z; const d = Math.hypot(dx, dz) || 1;
      c.rear.x = F.x - (dx / d) * wb; c.rear.z = F.z - (dz / d) * wb;
      const Ry = at(P.ovF + wb, {}).y;
      dx /= d; dz /= d;
      const cx = c.rear.x + dx * (P.L / 2 - P.ovR), cz = c.rear.z + dz * (P.L / 2 - P.ovR);
      const yaw = Math.atan2(dz, dx);
      c.g.position.set(cx, (F.y + Ry) / 2 + 0.025, cz);
      c.g.visible = Math.abs(cx) < (this.net.cols * S) / 2 + 0.15 && Math.abs(cz) < (this.net.rows * S) / 2 + 0.15;
      c.g.rotation.set(0, -yaw, Math.atan2(F.y - Ry, wb));
      const ud = c.g.userData;
      ud.wheels.forEach((w) => (w.rotation.y = -c.wheelA));
      const braking = c.acc < -0.6 || c.v < 0.05;
      ud.brake.emissiveIntensity = braking ? 3.0 : 0.35; ud.brakeHalo.material.opacity = braking ? 0.7 : 0;
    }
    spawnCars(dt) {
      const net = this.net;
      const target = 8 + this.density * 9;
      const roadEntries = net.entries.filter((e) => e.fam === 'road');
      const interval = RA.lerp(8.5, 2.2, (this.density - 1) / 4);
      const free = (mv, s) => !this.cars.some((o) => o.mv.pk === mv.pk && o.mv.din === mv.din && Math.abs(o.s - s) < o.L + 0.5);
      for (const e of roadEntries) {
        const key = e.i + ',' + e.j + ',' + e.d;
        let t = this.spawnT.get(key); if (t == null) t = this.rnd() * interval;
        t -= dt;
        if (t <= 0 && this.cars.length < target) {
          const opts = net.options(e.i, e.j, e.k, e.d);
          const mv = net.movement(e.i, e.j, e.k, e.d, this.pick(opts));
          if (mv && free(mv, 0)) { this.makeCar(mv, 0, 1.8); t = interval * (0.6 + this.rnd() * 0.8); } else t = 0.4;
        }
        this.spawnT.set(key, t);
      }
      // giriş yoksa (kapalı ağ) ya da otoparklardan çıkış
      const roads = net.list.filter((x) => x.fam === 'road');
      if (!roads.length) return;
      this.parkT = (this.parkT || 0) - dt;
      if (this.parkT <= 0 && this.cars.length < target && (!roadEntries.length || net.parkings.length)) {
        this.parkT = roadEntries.length ? interval * 1.5 : interval * 0.5;
        let mv = null, s = 0;
        if (net.parkings.length && this.rnd() < 0.7) { const pk = this.pick(net.parkings); mv = net.movement(pk.i, pk.j, pk.k, pk.ports[0], pk.ports[0]); s = mv.len * 0.6; }
        else { const r = this.pick(roads); if (r.ports.length === 2 && r.p.lv === 0) { mv = net.movement(r.i, r.j, r.k, r.ports[0], r.ports[1]); s = 0.2; } }
        if (mv && free(mv, s)) this.makeCar(mv, s, 0.5);
      }
    }

    /* ---------- kavşak yapay zekâsı ---------- */
    updateJunctions(dt) {
      for (const J of this.jc.values()) {
        const dem = { NS: 0, EW: 0 };
        for (const c of this.cars) {
          for (let q = 0; q < Math.min(2, c.plan.length); q++) {
            const nx = c.plan[q];
            if (nx && !nx.exit && nx.i === J.i && nx.j === J.j && nx.k === J.k) { dem[AXIS[nx.din]] += (q === 0 ? 1 : 0.5) * (1 + c.wait * 0.35); break; }
          }
        }
        J.dem = dem;
        if (J.pending) {
          const busy = this.cars.some((c) => (c.mv.i === J.i && c.mv.j === J.j && c.mv.k === J.k && AXIS[c.mv.din] === J.from && !c.fade) || c.commit === J.key && c.plan[0] && c.plan[0].i === J.i && c.plan[0].j === J.j);
          if (!busy) { J.green = J.pending; J.pending = null; J.from = null; J.tg = 0; }
          continue;
        }
        if (!this.ai) { J.flash = false; continue; }
        const tot = dem.NS + dem.EW;
        if (tot === 0) { J.idle += dt; if (J.idle > 2.5 && !J.flash) J.flash = true; continue; }
        J.idle = 0;
        if (J.flash) { J.flash = false; J.green = dem.NS >= dem.EW ? 'NS' : 'EW'; J.tg = 0; continue; }
        J.tg += dt;
        const cur = J.green, oth = cur === 'NS' ? 'EW' : 'NS';
        if (!J.axes.has(oth)) continue;
        if (J.tg > 2.2 && dem[oth] > 0 && (dem[cur] === 0 || J.tg > 9 || dem[oth] > dem[cur] * 1.8 + 1)) this.switchJ(J, oth);
      }
    }
    switchJ(J, to) {
      if (J.pending) { J.green = J.from; J.pending = null; J.from = null; return; }
      if (J.flash) { J.flash = false; J.green = to; J.tg = 0; return; }
      J.from = J.green; J.pending = to; J.green = null; J.tg = 0;
      for (const c of this.cars) {
        const nx = c.plan[0];
        if (!nx || nx.exit || nx.i !== J.i || nx.j !== J.j || AXIS[nx.din] !== J.from) continue;
        const rem = c.mv.len - c.s;
        if (rem < 0.2 || (c.v * c.v) / (2 * Math.max(0.01, rem)) > 4.0) c.commit = J.key;
      }
    }

    /* ---------- hemzemin geçitler ---------- */
    updateCrossings(dt) {
      for (const X of this.xc.values()) {
        const held = this.res.has(X.key);
        const req = X.request || held;
        X.request = false;
        X.t += dt;
        const carsIn = this.cars.some((c) => c.mv.cell === X.i + ',' + X.j && !c.fade);
        if (X.state === 'open') { if (req) { X.state = 'warn'; X.t = 0; } }
        else if (X.state === 'warn') { X.arm = Math.max(0, X.arm - dt / 1.0); if (X.t > 1.0 && !carsIn) X.state = 'closed'; }
        else if (X.state === 'closed') { X.arm = 0; if (!req) { X.state = 'raise'; X.t = 0; } }
        else if (X.state === 'raise') { X.arm = Math.min(1, X.arm + dt / 0.8); if (req) { X.state = 'warn'; X.t = 0; } else if (X.arm >= 1) X.state = 'open'; }
      }
    }

    /* ================= TRENLER ================= */
    makeTrain(segs, s) {
      const units = M.train(this.rnd() < 0.5 ? 'passenger' : 'freight', RA.rng(Math.floor(this.rnd() * 1e9)), 1 + Math.floor(this.rnd() * 2));
      let off = 0;
      units.forEach((u, n) => { RA.compact(u.g); u.g.scale.setScalar(SC); u.len *= SC; u.off = off + u.len / 2; off += u.len + (n < units.length - 1 ? 0.09 : 0); u.g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.scene.add(u.g); });
      const tr = { kind: 'train', id: uid++, units, len: off, dwell: 0, wheelA: 0, fade: 0, revT: 0 };
      tr.mv = new Mover(this, tr, off);
      tr.mv.segs = segs; tr.mv.s = s; tr.mv.v = 0.6;
      for (const m of segs) for (const k of tr.mv.keysOf(m)) { this.res.set(k, tr); tr.mv.held.add(k); }
      this.trains.push(tr);
      this.placeTrain(tr);
      return tr;
    }
    killTrain(tr, quick) {
      // kaybolurken bloklarını tutar; tamamen kaybolunca bırakır
      if (quick) { tr.mv.releaseAll(); tr.units.forEach((u) => this.scene.remove(u.g)); const n = this.trains.indexOf(tr); if (n >= 0) this.trains.splice(n, 1); return; }
      tr.fade = 0.0001;
    }
    chooseRail(tr, from) {
      const net = this.net;
      const a = net.after(from);
      if (!a) return 'stop';
      if (a.out) return 'exit';
      const opts = net.options(a.i, a.j, a.k, a.din);
      if (opts.length === 1) return net.movement(a.i, a.j, a.k, a.din, opts[0]);
      const p = net.piece(a.i, a.j, a.k);
      if (!this.ai && p.set && p.set[a.din] && opts.includes(p.set[a.din])) return net.movement(a.i, a.j, a.k, a.din, p.set[a.din]);
      // YZ: boş olan dala yönel, düz gitmeyi biraz tercih et
      const sc = opts.map((d) => {
        const m = net.movement(a.i, a.j, a.k, a.din, d);
        const af = net.after(m);
        let w = d === OPP[a.din] ? 1.3 : 1;
        if (af && !af.out) { const own = this.res.get(net.resKey(af.i, af.j, af.k)); if (own && own !== tr) w *= 0.15; }
        return w;
      });
      let t = this.rnd() * sc.reduce((x, y) => x + y, 0), pick = opts[0];
      for (let n = 0; n < opts.length; n++) { t -= sc[n]; if (t <= 0) { pick = opts[n]; break; } }
      return net.movement(a.i, a.j, a.k, a.din, pick);
    }
    updateTrains(dt) {
      for (let n = this.trains.length - 1; n >= 0; n--) {
        const tr = this.trains[n];
        if (tr.fade) { tr.fade += dt; const f = Math.max(0.01, 1 - tr.fade / 0.6); tr.units.forEach((u) => u.g.scale.setScalar(SC * f)); if (tr.fade > 0.6) this.killTrain(tr, true); continue; }
        const mv = tr.mv;
        mv.step(dt, { look: 4.6, vmax: V_TRAIN, acc: 1.1, dec: 2.4, replan: true, choose: (m) => this.chooseRail(tr, m) });
        tr.wheelA += (mv.v * dt) / (0.11 * SC);
        // istasyon (çıkmaz): dur, bekle, geri dön
        const h = mv.head();
        if (mv.planEnd === 'stop' && !mv.plan.length && h.dout === 'C' && mv.v < 0.03 && mv.s >= h.len - 0.06) {
          tr.dwell += dt;
          if (tr.dwell > 2.2) { tr.dwell = 0; this.stats.trains++; if (this.reverseTrain(tr)) {} }
        } else tr.dwell = 0;
        // karşılıklı kilitlenme: daha uzun bekleyen geri döner
        if (mv.wait > 2.4 && mv.blockOwner && mv.blockOwner.kind === 'train') {
          const o = mv.blockOwner;
          if (o.mv.wait > 0.8 && o.mv.blockOwner === tr && mv.wait >= o.mv.wait) { this.reverseTrain(tr); }
          else if (mv.wait > 6) this.reverseTrain(tr);
        }
        if (mv.wait > 16) { this.toast('Sıkışan bir tren depoya çekildi.'); this.killTrain(tr); continue; }
        // tahtanın dışına çıkış
        if (mv.planEnd === 'exit' && mv.segs.every((m) => m.virtual) && mv.s > tr.len + 0.2) { this.stats.trains++; this.killTrain(tr, true); continue; }
        this.placeTrain(tr);
      }
    }
    reverseTrain(tr) {
      if (tr.revT > this.t - 1.5) return false;
      if (!tr.mv.reverse()) return false;
      tr.revT = this.t;
      tr.units.forEach((u) => (u.off = tr.len - u.off));
      return true;
    }
    placeTrain(tr) {
      const F = {}, R = {};
      const net = this.net;
      const hx = (net.cols * S) / 2 + 0.2, hz = (net.rows * S) / 2 + 0.2;
      for (const u of tr.units) {
        const hb = u.len / 2 - 0.19 * SC;
        tr.mv.pointBack(u.off - hb, F); tr.mv.pointBack(u.off + hb, R);
        const x = (F.x + R.x) / 2, z = (F.z + R.z) / 2;
        u.g.position.set(x, (F.y + R.y) / 2 + (0.13 + 0.06) - M.RAIL_TOP * SC, z);
        u.g.rotation.set(0, -Math.atan2(F.z - R.z, F.x - R.x), Math.atan2(F.y - R.y, Math.hypot(F.x - R.x, F.z - R.z)));
        u.g.userData.wheels.forEach((w) => (w.rotation.y = -tr.wheelA));
        u.g.visible = Math.abs(x) < hx && Math.abs(z) < hz;
      }
    }
    spawnTrains(dt) {
      const net = this.net;
      const target = Math.min(7, this.density + 1);
      const rails = net.list.filter((x) => x.fam === 'rail');
      if (!rails.length || this.trains.length >= target) return;
      this.trainT -= dt; if (this.trainT > 0) return;
      this.trainT = 3.5 + this.rnd() * 2;
      const entries = net.entries.filter((e) => e.fam === 'rail');
      if (entries.length && this.rnd() < 0.75) {
        const e = this.pick(entries);
        const opts = net.options(e.i, e.j, e.k, e.d);
        const first = net.movement(e.i, e.j, e.k, e.d, this.pick(opts));
        if (!first || this.res.has(first.res)) return;
        const L = 2.4;
        const vin = net.virtualIn(first, L);
        const tr = this.makeTrain([vin], vin.len);
        tr.mv.plan = [first]; tr.mv.v = 1.2;
        return;
      }
      // tahta içinde boş, düz bir hatta yerleştir
      for (let tries = 0; tries < 12; tries++) {
        const r = this.pick(rails);
        if (r.ports.length !== 2 || r.p.lv !== 0) continue;
        const segs = this.backtrack(r, 2.6);
        if (!segs) continue;
        if (segs.some((m) => this.res.has(m.res))) continue;
        this.makeTrain(segs, segs[segs.length - 1].len * 0.6);
        return;
      }
    }
    backtrack(r, L) {
      const net = this.net;
      const segs = [net.movement(r.i, r.j, r.k, r.ports[0], r.ports[1])];
      let tot = segs[0].len * 0.6, cur = segs[0];
      while (tot < L + 0.3) {
        const mt = WS.mate(net.g, cur.i, cur.j, cur.din, 'rail');
        if (!mt) return null;
        const ps = WS.ports(mt.p.m).filter((d) => d !== OPP[cur.din]);
        if (ps.length !== 1) return null;
        const m = net.movement(mt.i, mt.j, mt.k, ps[0], OPP[cur.din]);
        segs.unshift(m); tot += m.len; cur = m;
      }
      return segs;
    }

    /* ================= UÇAKLAR ================= */
    makePlane() {
      const g = M.plane(this.pick([0x2f6fd6, 0xe0402f, 0x1f9d61, 0x7a4fc2, 0xf08a24]));
      const gearSet = new Set(); g.userData.gear.traverse((o) => gearSet.add(o));
      RA.compact(g, (o) => gearSet.has(o));
      g.scale.setScalar(PSC);
      g.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
      const shadow = RA.blobShadow(1.5, 1.3, 0.4);
      this.scene.add(g, shadow);
      const p = { kind: 'plane', id: uid++, code: 'RA ' + (this.codeN++), g, shadow, state: 'inbound', x: 0, z: 0, alt: 3, head: 0, roll: 0, pitch: 0, t: 0, fade: 0 };
      this.planes.push(p);
      return p;
    }
    killPlane(p, quick) {
      this.towerQ = this.towerQ.filter((q) => q.p !== p);
      if (!quick) { p.fade = 0.0001; return; }
      if (p.mv) p.mv.releaseAll();
      for (const [k, o] of this.res) if (o === p) this.res.delete(k);
      if (p.gateKey && this.claim) this.claim.delete(p.gateKey);
      this.scene.remove(p.g, p.shadow); const n = this.planes.indexOf(p); if (n >= 0) this.planes.splice(n, 1);
    }
    // inişten sonra kapıya giden yol
    landingPlan(rw, dir) {
      const net = this.net;
      const cells = dir === rw.d1 ? rw.cells : rw.cells.slice().reverse();
      const back = OPP[dir];
      for (let n = 1; n < cells.length; n++) {
        const cc = cells[n];
        const p = net.piece(cc.i, cc.j, cc.k);
        const sides = WS.ports(p.m).filter((d) => AXIS[d] !== rw.ax);
        if (n === cells.length - 1 && p.m & WS.BIT[dir]) sides.push(dir);
        for (const sd of sides) {
          const mExit = net.movement(cc.i, cc.j, cc.k, back, sd);
          const a = net.after(mExit); if (!a || a.out) continue;
          const r = net.route({ i: a.i, j: a.j, k: a.k, din: a.din }, (s) => { const q = net.piece(s.i, s.j, s.k); return q && q.type === 'taxi' && WS.portCount(q.m) === 1 && !this.claim.has(s.i + ',' + s.j); }, (s) => net.rwOfCell.has(s.i + ',' + s.j));
          if (!r && !(net.piece(a.i, a.j, a.k).type === 'taxi' && WS.portCount(net.piece(a.i, a.j, a.k).m) === 1)) continue;
          const mvs = [];
          for (let q = 0; q <= n; q++) mvs.push(net.movement(cells[q].i, cells[q].j, cells[q].k, back, q === n ? sd : dir));
          const goal = r ? r.goal : { i: a.i, j: a.j, k: a.k, din: a.din };
          if (r) mvs.push(...r.mvs);
          mvs.push(net.movement(goal.i, goal.j, goal.k, goal.din, 'C'));
          return { mvs, gate: goal.i + ',' + goal.j, exitIdx: n };
        }
      }
      return null;
    }
    departurePlan(p, start) {
      const net = this.net;
      const h = p.mv.head();
      start = start || { i: h.i, j: h.j, k: h.k, din: 'C' };
      const r = net.route(start, (s) => net.rwOfCell.has(s.i + ',' + s.j) && net.piece(s.i, s.j, s.k).type === 'runway' && AXIS[s.din] !== net.rwOfCell.get(s.i + ',' + s.j).ax, (s) => false);
      if (!r) return null;
      const rw = net.rwOfCell.get(r.goal.i + ',' + r.goal.j);
      const idx = rw.cells.findIndex((c) => c.i === r.goal.i && c.j === r.goal.j);
      const ahead1 = rw.cells.length - 1 - idx, ahead0 = idx;
      const dir = ahead1 >= ahead0 ? rw.d1 : rw.d0;
      const cells = dir === rw.d1 ? rw.cells.slice(idx) : rw.cells.slice(0, idx + 1).reverse();
      if (cells.length < 2) return null;
      const mvs = [...r.mvs];
      mvs.push(net.movement(cells[0].i, cells[0].j, cells[0].k, r.goal.din, dir));
      for (let q = 1; q < cells.length; q++) mvs.push(net.movement(cells[q].i, cells[q].j, cells[q].k, OPP[dir], dir));
      return { mvs, rw, dir };
    }
    towerGrant(key, owner) {
      if (this.res.get(key) === owner) return true;
      if (this.res.has(key)) return false;
      if (owner.kind !== 'plane') return false;
      const q = this.towerQ.find((x) => x.p === owner);
      if (!q) this.towerQ.push({ p: owner, key, type: owner.state === 'ground' && owner.departing ? 'depart' : 'cross', t: this.t });
      if (!this.ai) return !!owner.cleared;
      // YZ kule: uzun bekleyen inişe öncelik
      const landWait = this.towerQ.filter((x) => x.key === key && x.type === 'land').reduce((m, x) => Math.max(m, this.t - x.t), 0);
      const mine = this.towerQ.find((x) => x.p === owner);
      if (landWait > 7 && this.t - mine.t < 14) return false;
      this.towerQ = this.towerQ.filter((x) => x.p !== owner);
      return true;
    }
    updatePlanes(dt) {
      const net = this.net;
      if (!this.claim) this.claim = new Map();
      // kule: iniş izinleri
      for (const rw of net.runways) {
        if (this.res.has(rw.key)) continue;
        const hold = this.planes.filter((p) => p.state === 'hold' && p.rw === rw);
        if (!hold.length) continue;
        const depWait = this.towerQ.filter((x) => x.key === rw.key && x.type !== 'land').reduce((m, x) => Math.max(m, this.t - x.t), 0);
        hold.sort((a, b) => a.holdT0 - b.holdT0);
        const p = hold[0];
        if (this.ai) { if (depWait > 5 && this.t - p.holdT0 < 10) continue; this.clearLanding(p); }
        else if (p.cleared) this.clearLanding(p);
      }
      for (let n = this.planes.length - 1; n >= 0; n--) {
        const p = this.planes[n];
        p.t += dt;
        if (p.fade) { p.fade += dt; const f = Math.max(0.01, 1 - p.fade / 0.6); p.g.scale.setScalar(PSC * f); p.shadow.material.opacity *= f; if (p.fade > 0.6) this.killPlane(p, true); continue; }
        if (p.state === 'inbound' || p.state === 'approach' || p.state === 'climb' || p.state === 'away') {
          const sp = p.state === 'approach' ? 3.2 : p.state === 'climb' ? 4.2 : 2.6;
          p.s += sp * dt;
          if (p.state === 'approach') p.alt = p.altFn(p.s);
          if (p.state === 'climb') p.alt = Math.min(5, p.alt + 1.1 * dt);
          if (p.state === 'away') p.alt = Math.min(5, p.alt + 0.6 * dt);
          if (p.s >= p.path.length) {
            if (p.state === 'inbound') { p.state = 'hold'; p.phi = Math.atan2(p.z - p.hc.z, p.x - p.hc.x); p.holdT0 = this.t; this.towerQ.push({ p, key: p.rw.key, type: 'land', t: this.t }); }
            else if (p.state === 'approach') this.touchdown(p);
            else { this.killPlane(p, true); continue; }
          } else this.flyPath(p, dt);
        } else if (p.state === 'hold') {
          p.phi += (2.0 / p.hr) * dt * p.hdir;
          p.x = p.hc.x + Math.cos(p.phi) * p.hr; p.z = p.hc.z + Math.sin(p.phi) * p.hr;
          p.head = p.phi + p.hdir * Math.PI / 2; p.roll = RA.damp(p.roll, p.hdir * 0.4, 3, dt);
          p.alt = RA.damp(p.alt, p.halt, 2, dt);
          if (!net.runways.includes(p.rw)) this.goAround(p);
        } else if (p.state === 'ground') {
          if (p.needRoute) this.reroute(p);
          const onRw = p.mv.head().type === 'runway';
          if (p.rollV != null) p.rollV = Math.max(V_TAXI, p.rollV - 2.0 * dt);
          let vmax = p.departing && p.rolling ? 4.6 : onRw && p.rollV ? p.rollV : V_TAXI;
          p.mv.step(dt, { look: 2.6, vmax, acc: p.rolling ? 1.6 : 0.9, dec: p.rolling ? 3 : 1.8, choose: () => (p.route && p.route.length ? p.route.shift() : p.departing && p.rolling ? 'exit' : 'stop') });
          const h = p.mv.head();
          if (p.departing && !p.rolling && h.type === 'runway' && AXIS[h.din] === AXIS[h.dout]) { p.rolling = true; this.toastOnce('Kule kalkış izni verdi.'); }
          if (!p.rolling && !onRw) p.rollV = null;
          // kapıya vardı
          if (h.dout === 'C' && p.mv.s >= h.len - 0.05 && p.mv.v < 0.05 && !p.departing) { p.state = 'parked'; p.dwell = 6 + this.rnd() * 4; p.pushT = 0; }
          // kalkış
          if (p.rolling) {
            const d = p.mv.head().virtual ? p.mv.s : 0;
            p.alt = p.mv.v > 3.4 ? Math.min(3, (p.alt || 0) + (p.mv.v - 3.2) * 0.9 * dt) : 0;
            if (p.mv.head().virtual && d > 2.5) { this.liftoff(p); continue; }
          } else p.alt = 0;
          this.placeGround(p, dt);
        } else if (p.state === 'parked') {
          p.dwell -= dt;
          if (p.dwell < 0) {
            // geri itme: yerinde 180° dön
            p.pushT += dt;
            const k = Math.min(1, p.pushT / 2.2);
            p.yawOff = Math.PI * RA.smooth(k);
            if (k >= 1) {
              p.yawOff = 0;
              const h = p.mv.head();
              const rev = net.movement(h.i, h.j, h.k, 'C', h.din);
              p.mv.segs = [rev]; p.mv.s = 0.05; p.mv.plan = []; p.mv.planEnd = null;
              const dp = this.departurePlan(p);
              if (!dp) { p.dwell = 4; p.pushT = 0; p.yawOff = Math.PI; p.mv.segs = [h]; p.mv.s = h.len; this.toastOnce('Kalkış için piste giden bir taksi yolu gerekli.'); }
              else { if (p.gateKey) this.claim.delete(p.gateKey); p.gateKey = null; p.route = dp.mvs.slice(1); p.departing = true; p.state = 'ground'; p.cleared = false; }
            }
          }
          this.placeGround(p, dt);
        }
        this.placePlane(p);
      }
    }
    toastOnce(msg) { if (this.lastToast !== msg || this.t - (this.lastToastT || 0) > 12) { this.lastToast = msg; this.lastToastT = this.t; if (!/Kule/.test(msg)) this.toast(msg); } }
    reroute(p) {
      p.needRoute = false;
      const h = p.mv.head();
      if (p.departing) {
        const a = this.net.after(h);
        if (!a || a.out || p.rolling) { p.route = []; return; }
        const dp = this.departurePlan(p, { i: a.i, j: a.j, k: a.k, din: a.din });
        p.route = dp ? dp.mvs : [];
      } else {
        const a = this.net.after(h);
        if (!a || a.out) { p.route = []; return; }
        const r = this.net.route({ i: a.i, j: a.j, k: a.k, din: a.din }, (s) => { const q = this.net.piece(s.i, s.j, s.k); return q && q.type === 'taxi' && WS.portCount(q.m) === 1; });
        p.route = r ? [...r.mvs, this.net.movement(r.goal.i, r.goal.j, r.goal.k, r.goal.din, 'C')] : [];
      }
    }
    clearLanding(p) {
      const net = this.net;
      this.res.set(p.rw.key, p);
      this.towerQ = this.towerQ.filter((x) => x.p !== p);
      const dir = p.dir;
      const cells = dir === p.rw.d1 ? p.rw.cells : p.rw.cells.slice().reverse();
      const c0 = cells[0];
      const thr = { x: net.cx(c0.i) - DV[dir].x * S / 2, z: net.cz(c0.j) - DV[dir].z * S / 2 };
      const faf = { x: thr.x - DV[dir].x * 3.4, z: thr.z - DV[dir].z * 3.4 };
      const td = { x: thr.x + DV[dir].x * 0.5, z: thr.z + DV[dir].z * 0.5 };
      const th = Math.atan2(DV[dir].z, DV[dir].x);
      const pb = new RA.PathBuilder(p.x, p.z, p.head);
      const brg = Math.atan2(faf.z - p.z, faf.x - p.x);
      const dTh = RA.wrapAngle(brg - p.head);
      if (Math.abs(dTh) > 0.6) pb.arc(1.3, dTh * 0.7);
      pb.to(faf.x, faf.z, th, 0.8);
      const sF = pb.build().length;
      pb.line(3.9);
      p.path = pb.build(); p.s = 0; p.state = 'approach';
      const a0 = p.alt, sTD = p.path.length;
      p.altFn = (s) => (s < sF ? RA.lerp(a0, 1.1, RA.smooth(s / sF)) : Math.max(0, 1.1 * (1 - (s - sF) / (sTD - sF))));
      p.cleared = false;
      void td;
    }
    touchdown(p) {
      const net = this.net;
      const dir = p.dir, rw = p.rw;
      const plan = this.landingPlan(rw, dir);
      this.stats.land++;
      p.state = 'ground'; p.alt = 0; p.rollV = 3.2; p.departing = false; p.rolling = false;
      p.mv = new Mover(this, p, 1.0);
      if (!plan) {
        // kapı yok: pistin sonunda tekrar kalk (dokun-kalk)
        this.toastOnce('Uçakların park edeceği bir kapı yok: taksi yoluna çıkmaz bir uç ekle.');
        const cells = dir === rw.d1 ? rw.cells : rw.cells.slice().reverse();
        const mvs = cells.map((c) => net.movement(c.i, c.j, c.k, OPP[dir], dir));
        p.mv.segs = [mvs[0]]; p.mv.s = 0.5; p.mv.v = 3.2; p.route = mvs.slice(1); p.departing = true; p.rolling = true;
      } else {
        p.mv.segs = [plan.mvs[0]]; p.mv.s = 0.5; p.mv.v = 3.2; p.route = plan.mvs.slice(1);
        p.gateKey = plan.gate; this.claim.set(plan.gate, p);
      }
      for (const k of p.mv.keysOf(p.mv.segs[0])) { this.res.set(k, p); p.mv.held.add(k); }
      p.mv.held.add(rw.key);
      RA.audio.play('land');
    }
    liftoff(p) {
      this.stats.takeoff++;
      p.mv.releaseAll();
      const h = p.mv.head(); const P = h.path.at(p.mv.s);
      p.x = P.x; p.z = P.z; p.head = h.path.heading(p.mv.s);
      p.path = new RA.PathBuilder(p.x, p.z, p.head).line(9).build(); p.s = 0;
      p.state = 'climb'; p.mv = null;
    }
    goAround(p) {
      for (const [k, o] of this.res) if (o === p) this.res.delete(k);
      this.towerQ = this.towerQ.filter((x) => x.p !== p);
      p.path = new RA.PathBuilder(p.x, p.z, p.head).arc(2, 1.2).line(12).build(); p.s = 0; p.state = 'away';
    }
    flyPath(p, dt) {
      const q = p.path.at(p.s); const prev = p.head;
      p.x = q.x; p.z = q.z; p.head = p.path.heading(p.s);
      const turn = dt ? RA.wrapAngle(p.head - prev) / dt : 0;
      p.roll = dt ? RA.damp(p.roll, RA.clamp(turn * 0.35, -0.6, 0.6), 4, dt) : 0;
      p.pitch = p.state === 'climb' ? 0.14 : p.state === 'approach' && p.alt < 0.4 ? 0.06 : 0;
    }
    placeGround(p, dt) {
      const F = p.mv.pointBack(0.05, {}), R = p.mv.pointBack(0.95, {});
      p.x = (F.x + R.x) / 2; p.z = (F.z + R.z) / 2; p.gy = (F.y + R.y) / 2;
      const hd = Math.atan2(F.z - R.z, F.x - R.x);
      p.head = hd + (p.yawOff || 0);
      p.roll = dt ? RA.damp(p.roll, 0, 5, dt) : 0;
      p.pitch = p.rolling && p.mv.v > 3.2 ? 0.1 : 0;
    }
    placePlane(p) {
      const gy = p.state === 'ground' || p.state === 'parked' ? p.gy || 0 : 0;
      p.g.position.set(p.x, gy + p.alt + 0.33 * PSC, p.z);
      p.g.rotation.set(p.roll, -p.head, p.pitch);
      const ud = p.g.userData;
      ud.gear.visible = p.alt < 1.4;
      const now = this.t;
      ud.strobe.material.opacity = (now * 1.3 + p.id * 0.37) % 1 < 0.1 ? 1 : 0;
      ud.landing.material.opacity = p.state === 'approach' ? 0.9 : 0.15;
      p.shadow.position.set(p.x + p.alt * 0.4, gy + 0.05, p.z + p.alt * 0.2);
      p.shadow.rotation.z = -p.head + Math.PI / 2;
      p.shadow.material.opacity = RA.clamp(0.5 - p.alt * 0.08, 0.15, 0.5);
    }
    spawnPlanes(dt) {
      const net = this.net;
      if (!net.runways.length) return;
      const target = Math.min(7, 2 + this.density);
      if (this.planes.length >= target) return;
      this.planeT -= dt; if (this.planeT > 0) return;
      this.planeT = 6 + this.rnd() * 4;
      if (!this.claim) this.claim = new Map();
      const rw = this.pick(net.runways);
      // iniş yönü: kapıya çıkışı olan yön
      let dir = null;
      for (const d of this.rnd() < 0.5 ? [rw.d1, rw.d0] : [rw.d0, rw.d1]) if (this.landingPlan(rw, d)) { dir = d; break; }
      if (!dir) dir = rw.d1;
      const cells = dir === rw.d1 ? rw.cells : rw.cells.slice().reverse();
      const c0 = cells[0];
      const thr = { x: net.cx(c0.i) - DV[dir].x * S / 2, z: net.cz(c0.j) - DV[dir].z * S / 2 };
      const side = { x: -DV[dir].z, z: DV[dir].x };
      const sgn = (thr.x * side.x + thr.z * side.z) > 0 ? -1 : 1;
      const p = this.makePlane();
      p.rw = rw; p.dir = dir;
      p.hc = { x: thr.x - DV[dir].x * 4.2 + side.x * 2.6 * sgn, z: thr.z - DV[dir].z * 4.2 + side.z * 2.6 * sgn };
      p.hr = 1.9; p.hdir = sgn > 0 ? 1 : -1;
      const nHold = this.planes.filter((q) => q.rw === rw && (q.state === 'hold' || q.state === 'inbound')).length;
      p.halt = 2.8 + nHold * 0.5; p.alt = p.halt + 0.8;
      const ang = this.rnd() * Math.PI * 2;
      const start = { x: p.hc.x + Math.cos(ang) * 16, z: p.hc.z + Math.sin(ang) * 16 };
      const e = { x: p.hc.x + Math.cos(ang) * p.hr, z: p.hc.z + Math.sin(ang) * p.hr };
      p.path = new RA.PathBuilder(start.x, start.z, Math.atan2(e.z - start.z, e.x - start.x)).to(e.x, e.z, ang + p.hdir * Math.PI / 2, 0.7).build();
      p.s = 0; p.x = start.x; p.z = start.z;
    }

    /* ================= DOKUNMA (YZ kapalıyken elle yönetim) ================= */
    tapJunction(J) { const to = J.green === 'NS' ? 'EW' : J.green === 'EW' ? 'NS' : J.pending === 'NS' ? 'EW' : 'NS'; this.switchJ(J, to); }
    tapPlane(p) {
      const busy = (key) => this.res.has(key) && this.res.get(key) !== p;
      if (p.state === 'hold') { if (busy(p.rw.key)) return 'busy'; this.clearLanding(p); return 'ok'; }
      if (p.state === 'ground' && p.mv && p.mv.blocked) { const key = p.mv.keysOf(p.mv.blocked).find((k) => k.startsWith('rw')); if (key && busy(key)) return 'busy'; p.cleared = true; return 'ok'; }
      return 'none';
    }
    tapSwitch(i, j, k) {
      const p = this.net.piece(i, j, k);
      if (!p || WS.portCount(p.m) < 3) return false;
      p.set = p.set || {};
      // her giriş için bir sonraki çıkışa geç
      for (const din of WS.ports(p.m)) {
        const opts = this.net.options(i, j, k, din);
        if (opts.length < 2) continue;
        const cur = p.set[din] && opts.includes(p.set[din]) ? opts.indexOf(p.set[din]) : -1;
        p.set[din] = opts[(cur + 1) % opts.length];
      }
      return true;
    }

    /* ================= ana adım ================= */
    update(dt) {
      if (!this.net) return;
      this.t += dt;
      this.spawnCars(dt); this.spawnTrains(dt); this.spawnPlanes(dt);
      this.updateJunctions(dt);
      this.updateCrossings(dt);
      this.updateCars(dt);
      this.updateTrains(dt);
      this.updatePlanes(dt);
    }
    // ışık ve sinyal görünümleri
    visuals() {
      const now = performance.now() / 1000;
      const blink = Math.floor(now * 2.4) % 2 === 0;
      for (const J of this.jc.values()) {
        const d = J.dyn;
        const st = (ax) => (J.flash ? (blink ? 'yellow' : 'off') : J.green === ax ? 'green' : J.from === ax ? 'yellow' : 'red');
        for (const ax of ['NS', 'EW']) {
          const s = st(ax);
          d.head.userData.setAxis(ax, s === 'off' ? 'none' : s);
        }
        for (const port of d.ports) {
          const s = st(AXIS[port]);
          const mt = d.bars[port];
          mt.color.setHex(s === 'green' ? 0x22e06a : s === 'yellow' ? 0xffb400 : s === 'off' ? 0x333333 : 0xff3020);
          mt.opacity = s === 'off' ? 0.15 : 0.9;
        }
      }
      for (const X of this.xc.values()) {
        const active = X.state !== 'open';
        X.dyn.gates.forEach((gt, n) => {
          const on = active && (Math.floor(now * 3) + n) % 2 === 0;
          gt.lm.emissiveIntensity = on ? 3 : 0.1; gt.halo.material.opacity = on ? 0.9 : 0;
          if (gt.arm) gt.arm.rotation.z = (Math.PI / 2) * 0.92 * X.arm;
        });
      }
      for (const sg of this.dyn.railSignals) {
        const key = this.net.resKey(sg.i, sg.j, sg.k);
        const own = this.res.get(key);
        let green = false;
        if (own && own.kind === 'train') { const m = own.mv; green = [...m.segs, ...m.plan].some((x) => x.i === sg.i && x.j === sg.j && x.din === sg.d); }
        const s = green ? 'green' : 'red';
        if (sg.state !== s) { sg.obj.userData.set(s); sg.state = s; }
      }
      for (const sb of this.dyn.stopbars) {
        const own = sb.rw && this.res.get(sb.rw.key);
        const green = own && own.kind === 'plane' && own.mv && [...own.mv.segs, ...own.mv.plan].some((x) => x.i === sb.i && x.j === sb.j && (x.din === sb.d || x.dout === sb.d));
        sb.mat.emissive.setHex(green ? 0x22e06a : 0xff2a1f);
      }
    }
    clearAll() {
      [...this.cars].forEach((c) => this.killCar(c, true));
      [...this.trains].forEach((t) => this.killTrain(t, true));
      [...this.planes].forEach((p) => this.killPlane(p, true));
      this.res.clear(); this.towerQ = []; if (this.claim) this.claim.clear();
    }
  }
  WS.Sim = Sim;
})();
