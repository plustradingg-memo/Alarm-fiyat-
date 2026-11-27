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
  // demiryolu bölümlerinde tren, havalimanında uçak (uzun araç: makastan kuyruğu çıkınca ayrılır)
  const VEH = { rail: { v0: 3.2, a: 1.3, b: 2.6, T: 0.7, s0: 0.45 }, air: { v0: 2.3, a: 1.1, b: 2.4, T: 0.8, s0: 0.5 } };
  const TS = 0.52, PS = 0.56, RPS = 0.62;
  const LAND = 2.4; // iniş süresi (pist çıkışına varış)
  let uid = 1;

  class LvSim {
    constructor(game) {
      this.game = game; this.scene = game.scene;
      this.cars = []; this.trains = []; this.fx = []; this.t = 0;
      this.rnd = RA.rng(7);
    }
    setup(level, net) {
      this.clear();
      this.level = level; this.t = 0; this.rnd = RA.rng(level.id * 101 + 7);
      this.mode = level.mode || 'road';
      this.stats = { delivered: 0, giveUp: 0, peak: 0, launched: 0 };
      this.ended = null;
      // üreten yerler: evler / istasyonlar / iniş noktaları; havalimanında kapılar da kalkış için uçak çıkarır
      this.houses = level.blds.filter((b) => b.kind === 'house' || b.role === 'gate').map((b, k) => ({ b, pending: 0, timer: b.role === 'gate' ? Infinity : 1.2 + k * 0.9, warnNoRoute: 0, k: 0, queue: [], dep: b.role === 'gate', landing: 0 }));
      this.railT = (level.rails || []).map((r, k) => ({ t: (r.first != null ? r.first : 3) + k * 2, dir: 1 }));
      this.setNet(net);
    }
    clear() {
      for (const c of this.cars) this.vehOut(c);
      for (const f of this.fx || []) this.scene.remove(f.g);
      this.fx = [];
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
        const r = best && this.routeFor(best.l, c.color, c.dep);
        if (!r) { this.dropCar(c, true); continue; }
        c.segs = r.segs; c.idx = 0; c.seg = best.l; c.s = Math.min(best.s, best.l.len - 0.05);
      }
    }
    destNodes(color, dep) { return this.net.bNodes.filter((n) => n.in && (dep ? n.bld.role === 'dep' : n.bld.kind === 'dest' && n.bld.color === color)); }
    routeFor(lane, color, dep) {
      const goals = this.destNodes(color, dep);
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
      this.updateFx(dt);
      this.spawn(dt);
      this.updateCars(dt);
      this.checkEnd();
    }

    /* ---------- evler ---------- */
    spawn(dt) {
      const L = this.level;
      const prog = RA.clamp(this.stats.delivered / L.goal, 0, 1);
      // yoğun saat: belli aralıklarla bir süre evlerden daha sık araç çıkar
      let rushK = 1;
      if (L.rush) {
        const on = this.t % L.rush.every > L.rush.every - L.rush.dur;
        if (on !== !!this.rushOn) { this.rushOn = on; if (this.game.onRush) this.game.onRush(on); }
        if (on) rushK = L.rush.k;
      }
      for (const h of this.houses) {
        if (h.dep) { while (h.queue.length && h.queue[0] <= this.t) { h.queue.shift(); h.pending++; } } // kapıda işi biten uçak kalkışa hazır
        else {
          const iv = (h.b.every || L.spawn) * RA.lerp(1.2, 0.85, prog) * rushK;
          h.timer -= dt;
          if (h.timer <= 0) {
            h.timer += iv;
            if (h.b.role === 'arr') { h.landing++; this.landFx(h); } // uçak iniyor: piste değince sıraya girer
            else h.pending++;
          }
        }
        const bn = this.net.bNodes.find((n) => n.bld === h.b);
        h.noRoute = false;
        if (h.pending > 0 && bn && bn.out) {
          const lane = bn.out;
          const free = !this.cars.some((c) => c.seg === lane && (this.mode === 'road' ? c.s < CARP.L + 0.7 : c.s - c.L < 0.7));
          if (free) {
            const color = h.b.colors ? h.b.colors[h.k % h.b.colors.length] : h.b.color;
            const r = this.routeFor(lane, color, h.dep);
            if (r) { h.pending--; h.k++; if (this.mode === 'road') this.makeCar(h, r); else this.makeVeh(h, r, color); }
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
    // tren (lokomotif + vagonlar) ya da uçak
    makeVeh(h, r, color) {
      const col = LV.COLORS[color] || { hex: 0x7a8794 };
      const c = { id: uid++, color, house: h, dep: h.dep, segs: r.segs, idx: 0, seg: r.segs[0], s: 0, v: 0.5, still: 0, appear: 0.0001, fade: 0, odo: 0, tailQ: [] };
      if (this.mode === 'rail') {
        const dst = this.level.blds.find((b) => b.kind === 'dest' && b.color === color);
        const freight = dst && dst.type === 'maden';
        const us = [{ g: M.loco(col.hex, 0xf6e7b8, 1.2), len: 1.2 }];
        for (let i = 0; i < 2; i++) us.push(freight ? { g: M.hopper(0x5a5048, 1.0), len: 1.0 } : { g: M.coach(col.hex, 1.0), len: 1.0 });
        let off = 0;
        for (const u of us) { RA.compact(u.g); u.g.traverse((o) => { if (o.isMesh) o.castShadow = false; }); u.off = off; u.len *= TS; off += u.len + 0.1 * TS; this.scene.add(u.g); }
        c.units = us; c.sc = TS; c.L = off; c.P = VEH.rail; c.long = true;
      } else {
        const g = M.plane(col.hex); g.userData.gear.visible = true; g.userData.landing.material.opacity = 0;
        this.scene.add(g);
        c.g = g; c.sc = PS; c.L = 2.05 * PS; c.P = VEH.air; c.long = true; c.yOff = 0.33 * PS;
      }
      this.setScale(c, 0.3);
      this.cars.push(c); this.stats.launched++;
      this.place(c);
      return c;
    }
    setScale(c, f) { if (c.units) c.units.forEach((u) => u.g.scale.setScalar(c.sc * f)); else c.g.scale.setScalar((c.sc || SC) * f); }
    vehOut(c) { if (c.units) c.units.forEach((u) => this.scene.remove(u.g)); else this.scene.remove(c.g); }
    // baştan geriye d metre: araç rotası boyunca (rota başından önceyse ilk parçanın gerisine uzatılır)
    posBack(c, d, out) {
      let s = c.s - d, k = c.idx;
      while (s < 0 && k > 0) { k--; s += c.segs[k].len; }
      const sg = c.segs[k];
      if (s < 0) { const P0 = sg.path.at(0), T0 = sg.path.tan(0); out.x = P0.x + T0.x * s; out.z = P0.z + T0.z * s; out.y = sg.y(0); return out; }
      s = Math.min(s, sg.len); sg.path.at(s, out); out.y = sg.y(s); return out;
    }
    dropCar(c, back) {
      if (back && c.house) c.house.pending++;
      this.release(c);
      this.vehOut(c);
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
          if (r.runway) {
            // pist trafiği: sırayla iniş ve kalkış (bekleme çizgisindeki uçaklar bunu bekler)
            const pl = M.plane(RA.pick([0xd8432f, 0x2f7fe0, 0x22a45a, 0x9050d8, 0x34495e], this.rnd)); pl.scale.setScalar(RPS); this.scene.add(pl);
            const land = (st.n = (st.n || 0) + 1) % 2 === 1;
            this.trains.push({ k, dir, path, s: -1, len: 1.3, units: [{ g: pl, off: 0.65 / 0.85, len: 1.3 }], runway: true, land, v: 6.5 });
          } else {
            const units = M.train(r.kind || 'passenger', RA.rng(k * 31 + Math.floor(this.t)), r.cars || 3);
            let off = 0; units.forEach((u) => { u.off = off + u.len / 2; off += u.len + 0.12; RA.compact(u.g); u.g.scale.setScalar(0.85); this.scene.add(u.g); });
            this.trains.push({ k, dir, path, s: -1, len: off * 0.85, units });
          }
        }
      });
      for (const tr of [...this.trains]) {
        if (tr.runway) {
          tr.s += tr.v * dt;
          const L = tr.path.length, g = tr.units[0].g, F = {}, R = {};
          const at = (d, out) => { tr.path.at(RA.clamp(tr.dir > 0 ? d : L - d, 0, L), out); return out; };
          at(tr.s, F); at(tr.s - 0.6, R);
          // iniş: tahtaya alçalarak girer; kalkış: pistin sonuna doğru yükselir
          const alt = (d) => (tr.land ? Math.max(0, (3.5 - d) * 0.28) : Math.max(0, (d - (L - 9)) * 0.26));
          const y = alt(tr.s);
          g.position.set(F.x, y + 0.2, F.z);
          g.rotation.set(0, -Math.atan2(F.z - R.z, F.x - R.x), Math.atan2(alt(tr.s) - alt(tr.s - 0.6), 0.6));
          g.userData.gear.visible = y < 0.8; g.userData.landing.material.opacity = 0.9;
          g.visible = Math.abs(F.x) < LV.C.W / 2 + 0.6 && Math.abs(F.z) < LV.C.D / 2 + 0.6;
          if (tr.s - tr.len > L + 2) { this.scene.remove(g); this.trains.splice(this.trains.indexOf(tr), 1); }
          continue;
        }
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
          u.g.visible = Math.abs(x) < LV.C.W / 2 + 0.3 && Math.abs(z) < LV.C.D / 2 + 0.3;
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
          if (tr.runway ? tr.s > sg - 13 && tr.s - tr.len < sg + 2.4 : tr.s > sg - WARN && tr.s - tr.len < sg + 1.4) closed = true;
        }
        gs.closed = closed;
        gs.arm = RA.clamp(gs.arm + (closed ? dt * 1.6 : -dt * 1.2), 0, 1);
      }
    }

    /* ---------- havalimanı: iniş ve kalkış gösterisi (yalnız görüntü) ---------- */
    runwayNear(x, z) {
      let best = null;
      (this.net.rails || []).forEach((r) => { if (!r.def.runway) return; const q = LV.geo.nearest(r, x, z); if (!best || q.d < best.q.d) best = { r, q }; });
      return best;
    }
    // uçak piste alçalıp iner, pist çıkışına yuvarlanır; varınca iniş noktasında sıraya girer
    landFx(h) {
      const b = h.b, rn = this.runwayNear(b.x, b.z);
      const done = () => { h.landing--; h.pending++; };
      if (!rn) { done(); return; }
      const path = new RA.Path(rn.r.pts), sEnd = rn.q.s, dir = sEnd > path.length / 2 ? 1 : -1;
      const cols = b.colors || [], cc = cols.length ? LV.COLORS[cols[(h.k + h.pending + h.landing - 1) % cols.length]] : null;
      const g = M.plane(cc ? cc.hex : 0x7a8794);
      g.scale.setScalar(RPS); this.scene.add(g);
      const dist = 15, sStart = sEnd - dir * dist;
      this.fx.push({ g, t: 0, dur: LAND, step: (f) => {
        const k = RA.clamp(f.t / f.dur, 0, 1), e = 1 - (1 - k) * (1 - k); // yavaşlayarak
        const s0 = sStart + dir * dist * e, P = path.at(RA.clamp(s0, -20, path.length + 20)), T0 = path.tan(RA.clamp(s0, 0, path.length));
        const ext = s0 < 0 ? s0 : s0 > path.length ? s0 - path.length : 0;
        const y = Math.max(0, (0.45 - k) * 5.5);
        g.position.set(P.x + T0.x * ext, 0.2 + y, P.z + T0.z * ext); g.rotation.set(0, -Math.atan2(T0.z * dir, T0.x * dir), y > 0 ? -0.12 : 0);
        g.userData.gear.visible = y < 1.2; g.visible = Math.abs(g.position.x) < LV.C.W / 2 + 0.6;
        if (k >= 1) { done(); return false; }
        return true;
      } });
    }
    // kalkış noktasına varan uçak pistte hızlanıp havalanır
    takeoffFx(dn, color) {
      if (!dn) return;
      const rn = this.runwayNear(dn.x, dn.z); if (!rn) return;
      const path = new RA.Path(rn.r.pts), s0 = rn.q.s, dir = s0 < path.length / 2 ? 1 : -1;
      const g = M.plane((LV.COLORS[color] || { hex: 0x7a8794 }).hex); g.scale.setScalar(RPS); this.scene.add(g);
      this.fx.push({ g, t: 0, dur: 4, step: (f) => {
        const u = 1.2 * f.t * f.t + 0.4 * f.t, s = s0 + dir * u, P = path.at(RA.clamp(s, 0, path.length)), T0 = path.tan(RA.clamp(s, 0, path.length));
        const y = Math.max(0, (u - 5) * 0.3);
        g.position.set(P.x, 0.2 + y, P.z); g.rotation.set(0, -Math.atan2(T0.z * dir, T0.x * dir), y > 0 ? 0.22 : 0);
        g.userData.gear.visible = y < 0.6; g.userData.landing.material.opacity = 0.9; g.visible = Math.abs(P.x) < LV.C.W / 2 + 0.6 && u < 26;
        return f.t < f.dur;
      } });
    }
    updateFx(dt) {
      for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; if (!f.step(f)) { this.scene.remove(f.g); this.fx.splice(i, 1); } }
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
    release(c) {
      if (c.resNode) { c.resNode.resv.delete(c); c.resNode = null; }
      if (c.tailQ) { for (const q of c.tailQ) q.node.resv.delete(c); c.tailQ = []; }
    }
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
        if (c.fade) { c.fade += dt; this.setScale(c, Math.max(0.01, 1 - c.fade / 0.35)); if (c.fade > 0.35) { this.vehOut(c); this.cars.splice(n, 1); } continue; }
        if (c.appear) { c.appear += dt; this.setScale(c, Math.min(1, 0.3 + c.appear * 2)); if (c.appear > 0.35) { c.appear = 0; this.setScale(c, 1); } }
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
          const hold = gt.g.hold || 1.0;
          const d = gt.s - hold - c.s; if (d < -0.3 || d > 6) continue;
          const gs = this.gateSt.get(gt.g.key);
          let block = gs && (gs.closed || gs.arm > 0.05);
          if (!block) { for (const o of bk.get(c.seg) || []) if (o !== c && o.s > gt.s && o.s - o.L < gt.s + hold + 0.2 + c.L) block = true; }
          if (block && d > -0.05) { const g2 = Math.max(0.001, d); if (g2 < gap) { gap = g2; dv = c.v; } }
        }
        const sStar = P.s0 + Math.max(0, c.v * P.T + (c.v * dv) / (2 * Math.sqrt(P.a * P.b)));
        let a = P.a * (1 - Math.pow(c.v / P.v0, 4) - Math.pow(sStar / Math.max(gap, 0.01), 2));
        a = Math.max(a, -9);
        c.v = Math.max(0, c.v + a * dt);
        if (gap < 0.02) c.v = 0;
        c.s += c.v * dt;
        if (c.long) {
          // uzun araç: kuyruğu kavşaktan çıkınca kavşak serbest kalır
          c.odo += c.v * dt;
          while (c.tailQ.length && c.odo >= c.tailQ[0].at) c.tailQ.shift().node.resv.delete(c);
        }
        c.still = c.v < 0.12 ? c.still + dt : 0;
        if (c.still > GIVE_UP) { this.stats.giveUp++; this.dropCar(c, true); continue; }
        while (c.s >= c.seg.len) {
          if (c.idx >= c.segs.length - 1) break;
          if (c.seg.kind === 'turn') { // kavşaktan çıktı
            if (c.long) { c.tailQ.push({ node: c.seg.node, at: c.odo - (c.s - c.seg.len) + c.L + 0.1 }); if (c.resNode === c.seg.node) c.resNode = null; }
            else this.release(c);
          }
          c.s -= c.seg.len; c.idx++; c.seg = c.segs[c.idx]; c.cleared = false; c.arrive = null;
        }
        if (c.idx >= c.segs.length - 1 && c.s >= c.seg.len - 0.05) {
          // vardı: iş yerine girip kaybolur (havalimanında: kapıya yanaşır ya da kalkar)
          c.fade = 0.0001; this.release(c);
          const dn = c.seg.to; if (dn && dn.bld) dn.bld.pulse = 1;
          if (this.mode !== 'air' || c.dep) this.stats.delivered++;
          if (this.mode === 'air') {
            if (c.dep) this.takeoffFx(dn, c.color);
            else { const gh = this.houses.find((q) => q.b === (dn && dn.bld)); if (gh) gh.queue.push(this.t + (this.level.dwell || 2.5)); }
          }
          this.game.onDeliver(c);
          continue;
        }
        this.place(c);
      }
    }
    place(c) {
      if (c.units) {
        const F = this._F || (this._F = {}), R = this._R || (this._R = {});
        for (const u of c.units) {
          this.posBack(c, u.off + u.len * 0.18, F); this.posBack(c, u.off + u.len * 0.82, R);
          u.g.position.set((F.x + R.x) / 2, (F.y + R.y) / 2 + 0.02, (F.z + R.z) / 2);
          u.g.rotation.set(0, -Math.atan2(F.z - R.z, F.x - R.x), Math.atan2(F.y - R.y, Math.hypot(F.x - R.x, F.z - R.z)));
          if (u.g.userData.wheels) u.g.userData.wheels.forEach((w) => (w.rotation.y -= c.v * 0.05));
        }
        return;
      }
      const seg = c.seg, s = Math.min(c.s, seg.len);
      const P = seg.path.at(s), Tn = seg.path.tan(s);
      const y = seg.y(s);
      const yb = seg.y(Math.max(0, s - 0.5)), yf = seg.y(Math.min(seg.len, s + 0.5));
      c.g.position.set(P.x, y + 0.02 + (c.yOff || 0), P.z);
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
