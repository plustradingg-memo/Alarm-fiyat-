/* RAY ARASI — Bölümler: araçlar, kavşak ışıkları, trenler ve hemzemin geçitler, evler ve teslimatlar */
(function () {
  'use strict';
  const RA = window.RA;
  const LV = RA.LV;
  const T = THREE;
  const M = RA.M;
  const SC = 0.72;
  const CARP = { L: 1.45 * SC, v0: 2.7, a: 2.6, b: 3.2, T: 0.45, s0: 0.3 };
  const TRAIN_V = 3.4, WARN = 6;
  const PENDING_CAP = 8, GIVE_UP = 40;
  let uid = 1;

  class LvSim {
    constructor(game) {
      this.game = game; this.scene = game.scene;
      this.cars = []; this.trains = []; this.t = 0;
      this.rnd = RA.rng(7);
    }
    setup(level, net) {
      this.clear();
      this.level = level; this.t = 0; this.rnd = RA.rng(level.id * 101 + 7);
      this.stats = { delivered: 0, giveUp: 0, peak: 0, launched: 0 };
      this.ended = null;
      this.houses = level.blds.filter((b) => b.kind === 'house').map((b, k) => ({ b, pending: 0, timer: 1.2 + k * 0.9, warnNoRoute: 0 }));
      this.railT = (level.rails || []).map((r, k) => ({ t: (r.first != null ? r.first : 3) + k * 2, dir: 1 }));
      this.setNet(net);
    }
    clear() {
      for (const c of this.cars) this.scene.remove(c.g);
      for (const tr of this.trains) tr.units.forEach((u) => this.scene.remove(u.g));
      this.cars = []; this.trains = [];
    }
    // ağ değişti (çizim/silme): ışıklar yeniden kurulur, yoldaki araçlar en yakın şeride taşınır
    setNet(net) {
      const old = this.ctl || new Map();
      this.net = net;
      this.ctl = new Map();
      for (const n of net.nodes) n.resv = new Map(); // kavşağa girmiş ya da girmeye karar vermiş araçlar → dönüşleri
      for (const n of net.nodes) if (n.kind === 'j' && n.deg >= 4) {
        const key = Math.round(n.x * 4) + ',' + Math.round(n.z * 4);
        const o = old.get(key);
        this.ctl.set(key, { key, n, cur: o && o.cur < n.phases.length ? o.cur : 0, tg: 0, amber: 0, clearing: false, next: 0, dem: [] });
        n.ctl = this.ctl.get(key);
      }
      this.gateSt = new Map();
      for (const g of net.gates) this.gateSt.set(g.key, (this.gateSt.get(g.key)) || { closed: false, arm: 0 });
      for (const c of [...this.cars]) {
        if (c.fade) continue;
        c.cleared = false; c.arrive = null;
        const P = c.seg.path.at(c.s), Tn = c.seg.path.tan(c.s);
        let best = null, bd = 0.7;
        for (const l of net.lanes) {
          const q = l.path.nearest(P.x, P.z);
          if (q.d >= bd) continue;
          const t2 = l.path.tan(q.s);
          if (t2.x * Tn.x + t2.z * Tn.z < 0.6) continue;
          bd = q.d; best = { l, s: q.s };
        }
        const r = best && this.routeFor(best.l, c.color);
        if (!r) { this.dropCar(c, true); continue; }
        c.segs = r.segs; c.idx = 0; c.seg = best.l; c.s = Math.min(best.s, best.l.len - 0.05);
      }
    }
    destNodes(color) { return this.net.bNodes.filter((n) => n.bld.kind === 'dest' && n.bld.color === color && n.in); }
    routeFor(lane, color) {
      const goals = this.destNodes(color);
      if (!goals.length) return null;
      const load = (l) => (this.load && this.load.get(l)) || 0;
      return LV.route(this.net, lane, goals, (l) => load(l) * 0.9);
    }

    /* ---------- ana adım ---------- */
    update(dt) {
      if (this.ended) return;
      this.t += dt;
      // şerit yükleri (rota seçiminde sıkışık yoldan kaçınmak için)
      this.load = new Map();
      for (const c of this.cars) if (c.seg.kind === 'lane') this.load.set(c.seg, (this.load.get(c.seg) || 0) + 1);
      this.updateSignals(dt);
      this.updateTrains(dt);
      this.spawn(dt);
      this.updateCars(dt);
      this.checkEnd();
    }

    /* ---------- evler ---------- */
    spawn(dt) {
      const L = this.level;
      const prog = RA.clamp(this.stats.delivered / L.goal, 0, 1);
      for (const h of this.houses) {
        const iv = (h.b.every || L.spawn) * RA.lerp(1.2, 0.85, prog);
        h.timer -= dt;
        if (h.timer <= 0) { h.timer += iv; h.pending++; }
        const bn = this.net.bNodes.find((n) => n.bld === h.b);
        h.noRoute = false;
        if (h.pending > 0 && bn && bn.out) {
          const lane = bn.out;
          const free = !this.cars.some((c) => c.seg === lane && c.s < CARP.L + 0.7);
          if (free) {
            const r = this.routeFor(lane, h.b.color);
            if (r) { h.pending--; this.makeCar(h, r); }
            else h.noRoute = true;
          }
        } else if (h.pending > 0) h.noRoute = true;
        this.stats.peak = Math.max(this.stats.peak, h.pending);
      }
    }
    makeCar(h, r) {
      const col = LV.COLORS[h.b.color];
      const g = this.rnd() < 0.12 ? M.bus(col.hex) : M.car(col.hex);
      const isBus = g.userData.L > 2;
      RA.compact(g); g.scale.setScalar(SC);
      g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      this.scene.add(g);
      const c = { id: uid++, color: h.b.color, house: h, g, segs: r.segs, idx: 0, seg: r.segs[0], s: 0, v: 0.6, L: isBus ? 3.3 * SC : CARP.L, P: isBus ? Object.assign({}, CARP, { v0: 2.3, a: 1.8 }) : CARP, still: 0, appear: 0.0001, fade: 0 };
      g.scale.setScalar(SC * 0.3);
      this.cars.push(c); this.stats.launched++;
      this.place(c);
      return c;
    }
    dropCar(c, back) {
      if (back && c.house) c.house.pending++;
      this.release(c);
      this.scene.remove(c.g);
      const i = this.cars.indexOf(c); if (i >= 0) this.cars.splice(i, 1);
    }

    /* ---------- kavşak ışıkları (yapay zekâ): bekleyen araç sayısına göre ---------- */
    phaseOf(ctl, t) { const e = t.inL.e.id; return ctl.n.phases.findIndex((p) => p.includes(e)); }
    // Yeşil yöne yakın araç kalmayınca (en az 4 sn yeşilden sonra) ya da en çok 12 sn sonra bekleyen yöne geçer.
    updateSignals(dt) {
      const near = new Map(), close = new Map();
      for (const c of this.cars) {
        if (c.fade || c.seg.kind !== 'lane') continue;
        const nx = c.segs[c.idx + 1];
        if (!nx || nx.kind !== 'turn' || !nx.node.ctl) continue;
        const rem = c.seg.len - c.s; if (rem > 8) continue;
        const ctl = nx.node.ctl, ph = this.phaseOf(ctl, nx);
        if (!near.has(ctl)) { near.set(ctl, []); close.set(ctl, []); }
        near.get(ctl)[ph] = (near.get(ctl)[ph] || 0) + 1;
        if (rem < 4.5) close.get(ctl)[ph] = (close.get(ctl)[ph] || 0) + 1;
      }
      for (const ctl of this.ctl.values()) {
        const dem = near.get(ctl) || [], cl = close.get(ctl) || [];
        ctl.dem = dem;
        const P = ctl.n.phases.length;
        if (ctl.clearing) {
          // önceki evrenin araçları kavşaktan çıkınca yeni evre yeşil
          const busy = this.cars.some((c) => c.seg.kind === 'turn' && c.seg.node === ctl.n && this.phaseOf(ctl, c.seg) === ctl.cur);
          ctl.amber -= dt;
          if (!busy && ctl.amber <= 0) { ctl.cur = ctl.next; ctl.clearing = false; ctl.tg = 0; }
          continue;
        }
        ctl.tg += dt;
        let best = -1, bv = 0;
        for (let k = 1; k < P; k++) { const q = (ctl.cur + k) % P; if ((dem[q] || 0) > bv) { bv = dem[q]; best = q; } }
        if (best < 0) continue;
        const gapOut = !(cl[ctl.cur] > 0) && ctl.tg > 2;
        if ((gapOut && ctl.tg > (dem[ctl.cur] ? 4 : 1)) || ctl.tg > 12) { ctl.next = best; ctl.clearing = true; ctl.amber = 0.7; }
      }
    }
    green(ctl, t) { return !ctl.clearing && this.phaseOf(ctl, t) === ctl.cur; }

    /* ---------- trenler ve hemzemin geçitler ---------- */
    updateTrains(dt) {
      const net = this.net;
      (this.level.rails || []).forEach((r, k) => {
        const st = this.railT[k];
        st.t -= dt;
        if (st.t <= 0) {
          st.t = r.every || 10;
          const rail = net.rails[k];
          const path = new RA.Path(rail.pts);
          const dir = st.dir; st.dir = -st.dir;
          const units = M.train(r.kind || 'passenger', RA.rng(k * 31 + Math.floor(this.t)), r.cars || 3);
          let off = 0; units.forEach((u) => { u.off = off + u.len / 2; off += u.len + 0.12; RA.compact(u.g); u.g.scale.setScalar(0.85); this.scene.add(u.g); });
          this.trains.push({ k, dir, path, s: -1, len: off * 0.85, units });
        }
      });
      for (const tr of [...this.trains]) {
        tr.s += TRAIN_V * dt;
        const railY = net.railY[tr.k];
        const L = tr.path.length;
        const F = {}, R = {};
        const pos = (d, out) => { const s = tr.dir > 0 ? d : L - d; tr.path.at(s, out); out.y = railY(RA.clamp(s, 0, L)); return out; };
        let vis = false;
        tr.units.forEach((u) => {
          const c = tr.s - u.off * 0.85, hh = (u.len / 2 - 0.26) * 0.85;
          pos(c + hh, F); pos(c - hh, R);
          const x = (F.x + R.x) / 2, z = (F.z + R.z) / 2;
          u.g.position.set(x, (F.y + R.y) / 2 + 0.06, z);
          u.g.rotation.set(0, -Math.atan2(F.z - R.z, F.x - R.x), Math.atan2(F.y - R.y, Math.hypot(F.x - R.x, F.z - R.z)));
          u.g.visible = Math.abs(x) < 10.3 && Math.abs(z) < 16.3;
          if (u.g.visible) vis = true;
          if (u.g.userData.wheels) u.g.userData.wheels.forEach((w) => (w.rotation.y -= TRAIN_V * dt * 3));
        });
        if (tr.s - tr.len > L + 2) { tr.units.forEach((u) => this.scene.remove(u.g)); this.trains.splice(this.trains.indexOf(tr), 1); }
      }
      // geçit: tren yaklaşırken kapanır, geçince açılır
      for (const g of net.gates) {
        const gs = this.gateSt.get(g.key);
        const L = net.rails[g.rail].len;
        let closed = false;
        for (const tr of this.trains) {
          if (tr.k !== g.rail) continue;
          const sg = tr.dir > 0 ? g.sr : L - g.sr;
          if (tr.s > sg - WARN && tr.s - tr.len < sg + 1.4) closed = true;
        }
        gs.closed = closed;
        gs.arm = RA.clamp(gs.arm + (closed ? dt * 1.6 : -dt * 1.2), 0, 1);
      }
    }

    /* ---------- araçlar ---------- */
    // Kavşağa giriş: ışıklı kavşakta (4+ kol) yeşil gerekir; yolunu kesen dönüşte araç varsa ya da o yönden
    // daha önce gelip bekleyen varsa girilmez (önce gelen önce geçer); çıkışta yer yoksa kavşak tıkanmaz.
    canEnter(c, t, bk) {
      const n = t.node;
      if (n.ctl && !this.green(n.ctl, t)) return false;
      for (const [o, ot] of n.resv) if (o !== c && t.conf.includes(ot)) return false;
      if (n.kind === 'j') {
        for (const o of this.waitAt.get(n) || []) {
          if (o === c || !o.arrive) continue;
          const ot = o.segs[o.idx + 1];
          if (!t.conf.includes(ot)) continue;
          if (n.ctl && !this.green(n.ctl, ot)) continue;
          const ca = c.arrive != null ? c.arrive : this.t;
          if (o.arrive < ca - 0.01 || (Math.abs(o.arrive - ca) <= 0.01 && o.id < c.id)) return false;
        }
      }
      const out = bk.get(t.outL) || [];
      for (const o of out) if (o.s - o.L < c.L + 0.4) return false;
      return true;
    }
    release(c) { if (c.resNode) { c.resNode.resv.delete(c); c.resNode = null; } }
    updateCars(dt) {
      const bk = new Map();
      for (const c of this.cars) { if (!bk.has(c.seg)) bk.set(c.seg, []); bk.get(c.seg).push(c); }
      // kavşak ağzında bekleyenler (geliş sırası için)
      this.waitAt = new Map();
      for (const c of this.cars) {
        if (c.fade || c.seg.kind !== 'lane') continue;
        const nx = c.segs[c.idx + 1];
        if (!nx || nx.kind !== 'turn' || c.seg.len - c.s > 1.4) { c.arrive = null; continue; }
        if (c.arrive == null) c.arrive = this.t;
        if (!this.waitAt.has(nx.node)) this.waitAt.set(nx.node, []);
        this.waitAt.get(nx.node).push(c);
      }
      for (let n = this.cars.length - 1; n >= 0; n--) {
        const c = this.cars[n];
        if (c.fade) { c.fade += dt; c.g.scale.setScalar(SC * Math.max(0.01, 1 - c.fade / 0.35)); if (c.fade > 0.35) { this.scene.remove(c.g); this.cars.splice(n, 1); } continue; }
        if (c.appear) { c.appear += dt; c.g.scale.setScalar(SC * Math.min(1, 0.3 + c.appear * 2)); if (c.appear > 0.35) { c.appear = 0; c.g.scale.setScalar(SC); } }
        const P = c.P;
        let gap = 1e9, dv = 0;
        const rem = c.seg.len - c.s;
        for (const o of bk.get(c.seg) || []) if (o !== c && !o.fade && o.s > c.s) { const g2 = o.s - o.L - c.s; if (g2 < gap) { gap = g2; dv = c.v - o.v; } }
        // ileriki parçalardaki araçlar
        let acc = rem;
        for (let k = c.idx + 1; k < c.segs.length && acc < 7; k++) {
          const sg = c.segs[k];
          for (const o of bk.get(sg) || []) if (!o.fade) { const g2 = acc + o.s - o.L; if (g2 < gap) { gap = g2; dv = c.v - o.v; } }
          acc += sg.len;
        }
        // kavşağa giriş izni
        const nx = c.segs[c.idx + 1];
        if (nx && nx.kind === 'turn' && rem < 3 && !c.cleared) {
          if (this.canEnter(c, nx, bk)) { if (rem < 0.7) { c.cleared = true; nx.node.resv.set(c, nx); c.resNode = nx.node; } }
          else { const g2 = rem - 0.12; if (g2 < gap) { gap = Math.max(0.001, g2); dv = c.v; } }
        }
        // hemzemin geçit: bariyer kapalıysa ya da karşıda yer yoksa geçide girme
        if (c.seg.kind === 'lane') for (const gt of c.seg.gates) {
          const d = gt.s - 1.0 - c.s; if (d < -0.3 || d > 6) continue;
          const gs = this.gateSt.get(gt.g.key);
          let block = gs && (gs.closed || gs.arm > 0.05);
          if (!block) { for (const o of bk.get(c.seg) || []) if (o !== c && o.s > gt.s && o.s - o.L < gt.s + 1.2 + c.L) block = true; }
          if (block && d > -0.05) { const g2 = Math.max(0.001, d); if (g2 < gap) { gap = g2; dv = c.v; } }
        }
        const sStar = P.s0 + Math.max(0, c.v * P.T + (c.v * dv) / (2 * Math.sqrt(P.a * P.b)));
        let a = P.a * (1 - Math.pow(c.v / P.v0, 4) - Math.pow(sStar / Math.max(gap, 0.01), 2));
        a = Math.max(a, -9);
        c.v = Math.max(0, c.v + a * dt);
        if (gap < 0.02) c.v = 0;
        c.s += c.v * dt;
        c.still = c.v < 0.12 ? c.still + dt : 0;
        if (c.still > GIVE_UP) { this.stats.giveUp++; this.dropCar(c, true); continue; }
        while (c.s >= c.seg.len) {
          if (c.idx >= c.segs.length - 1) break;
          if (c.seg.kind === 'turn') this.release(c); // kavşaktan çıktı
          c.s -= c.seg.len; c.idx++; c.seg = c.segs[c.idx]; c.cleared = false; c.arrive = null;
        }
        if (c.idx >= c.segs.length - 1 && c.s >= c.seg.len - 0.05) {
          // vardı: iş yerine girip kaybolur
          this.stats.delivered++; c.fade = 0.0001; this.release(c);
          const dn = c.seg.to; if (dn && dn.bld) dn.bld.pulse = 1;
          this.game.onDeliver(c);
          continue;
        }
        this.place(c);
      }
    }
    place(c) {
      const seg = c.seg, s = Math.min(c.s, seg.len);
      const P = seg.path.at(s), Tn = seg.path.tan(s);
      const y = seg.y(s);
      const yb = seg.y(Math.max(0, s - 0.5)), yf = seg.y(Math.min(seg.len, s + 0.5));
      c.g.position.set(P.x, y + 0.02, P.z);
      c.g.rotation.set(0, -Math.atan2(Tn.z, Tn.x), Math.atan2(yf - yb, 1));
    }

    checkEnd() {
      if (this.stats.delivered >= this.level.goal) { this.ended = 'win'; this.game.onEnd('win'); return; }
      const h = this.houses.find((q) => q.pending >= PENDING_CAP);
      if (h) { this.ended = 'lose'; this.game.onEnd('lose', h); }
    }
  }
  LvSim.PENDING_CAP = PENDING_CAP;
  LV.Sim = LvSim;
})();
