/* RAY ARASI — Atölye: ızgaradan hareket ağı (şerit yolları, yükseklikler, kavşak çakışmaları, rota) */
(function () {
  'use strict';
  const RA = window.RA;
  const WS = RA.WS;
  const { DV, OPP, BIT, AXIS, FAMILY } = WS;
  const S = WS.S;
  const H_UP = (WS.H_UP = 1.15), H_DN = (WS.H_DN = -1.05);
  const LO = (WS.LANE = 0.37);     // yol şerit ekseni
  const STOP_RAIL = 0.58;          // ray çıkmazında tampon noktası

  class Net {
    constructor(grid) {
      this.g = grid;
      this.cols = grid.cols; this.rows = grid.rows;
      this.ox = -((this.cols - 1) / 2) * S; this.oz = -((this.rows - 1) / 2) * S;
      this.mv = new Map();
      this.conf = new Map();
      this.analyze();
    }
    cx(i) { return this.ox + i * S; }
    cz(j) { return this.oz + j * S; }
    piece(i, j, k) { const c = this.g.cell(i, j); return c ? c.pieces[k] : null; }
    cellKey(i, j) { return i + ',' + j; }
    pieceKey(i, j, k) { return i + ',' + j + ',' + k; }
    // aynı seviyede iki parça varsa (hemzemin geçit, ray kesişimi) tüm kare tek blok
    resKey(i, j, k) {
      const c = this.g.cell(i, j); const p = c.pieces[k];
      if (p.lv === 0 && c.pieces.filter((q) => q.lv === 0).length > 1) return 'c' + i + ',' + j;
      return 'p' + i + ',' + j + ',' + k;
    }
    edgeH(i, j, k, d) {
      const p = this.piece(i, j, k);
      if (p.lv) return p.lv > 0 ? H_UP : H_DN;
      if (d === 'C') return 0;
      const m = WS.mate(this.g, i, j, d, FAMILY[p.type]);
      if (m && m.p.lv) return m.p.lv > 0 ? H_UP : H_DN;
      return 0;
    }

    analyze() {
      const g = this.g;
      this.list = []; this.junctions = []; this.crossings = []; this.entries = [];
      this.gates = []; this.stations = []; this.parkings = []; this.railSignals = [];
      g.each((c, i, j) => {
        const lv0 = c.pieces.filter((p) => p.lv === 0);
        c.pieces.forEach((p, k) => {
          const fam = FAMILY[p.type];
          const ports = WS.ports(p.m);
          const info = { i, j, k, p, fam, ports, key: this.pieceKey(i, j, k) };
          this.list.push(info);
          for (const d of ports) if (!g.inside(i + DV[d].x, j + DV[d].z) && p.lv === 0) this.entries.push({ i, j, k, d, fam });
          if (fam === 'road' && ports.length >= 3 && p.lv === 0 && c.pieces.length === 1) this.junctions.push(info);
          if (ports.length === 1 && p.lv === 0) {
            if (p.type === 'taxi') this.gates.push(info);
            if (fam === 'rail') this.stations.push(info);
            if (fam === 'road') this.parkings.push(info);
          }
          if (fam === 'rail' && p.lv === 0 && (ports.length >= 3 || lv0.length > 1)) for (const d of ports) this.railSignals.push({ i, j, k, d });
        });
        if (lv0.length > 1) {
          const fams = lv0.map((p) => FAMILY[p.type]);
          const kind = fams.includes('road') && fams.includes('rail') ? 'level' : fams.includes('road') && fams.includes('air') ? 'taxiRoad' : fams[0] === 'rail' && fams[1] === 'rail' ? 'diamond' : 'mixed';
          this.crossings.push({ i, j, kind, key: 'c' + i + ',' + j, pieces: lv0.map((p) => c.pieces.indexOf(p)) });
        }
      });
      // pist şeritleri
      this.runways = [];
      const seen = new Set();
      g.each((c, i, j) => c.pieces.forEach((p, k) => {
        if (p.type !== 'runway' || seen.has(i + ',' + j)) return;
        const ax = p.ax || 'NS';
        const [d0, d1] = ax === 'NS' ? ['N', 'S'] : ['W', 'E'];
        // başa git
        let a = { i, j };
        for (;;) { const cp = g.cell(a.i, a.j).pieces.find((q) => q.type === 'runway'); if (!(cp.m & BIT[d0])) break; const n = { i: a.i + DV[d0].x, j: a.j + DV[d0].z }; const nc = g.cell(n.i, n.j); if (!nc || !nc.pieces.find((q) => q.type === 'runway')) break; a = n; }
        const cells = [];
        for (let b = a; ;) {
          const cc = g.cell(b.i, b.j); const kk = cc.pieces.findIndex((q) => q.type === 'runway');
          cells.push({ i: b.i, j: b.j, k: kk }); seen.add(b.i + ',' + b.j);
          if (!(cc.pieces[kk].m & BIT[d1])) break;
          const n = { i: b.i + DV[d1].x, j: b.j + DV[d1].z }; const nc = g.cell(n.i, n.j);
          if (!nc || !nc.pieces.find((q) => q.type === 'runway')) break; b = n;
        }
        if (cells.length >= 3) this.runways.push({ id: this.runways.length, ax, d0, d1, cells, key: 'rw' + this.runways.length });
      }));
      this.rwOfCell = new Map();
      this.runways.forEach((r) => r.cells.forEach((c) => this.rwOfCell.set(c.i + ',' + c.j, r)));
      this.crossAt = new Map(); this.crossings.forEach((x) => this.crossAt.set(x.i + ',' + x.j, x));
      this.juncAt = new Map(); this.junctions.forEach((x) => this.juncAt.set(x.i + ',' + x.j + ',' + x.k, x));
    }

    /* ---------- hareket (bir parçadan din kapısından girip dout'tan çıkış) ---------- */
    movement(i, j, k, din, dout) {
      const key = i + ',' + j + ',' + k + ',' + din + ',' + dout;
      let m = this.mv.get(key);
      if (m) return m;
      const p = this.piece(i, j, k);
      if (!p) return null;
      const fam = FAMILY[p.type];
      const C = { x: this.cx(i), z: this.cz(j) };
      const edge = (d, off) => ({ x: C.x + DV[d].x * S / 2 + (off ? off.x : 0), z: C.z + DV[d].z * S / 2 + (off ? off.z : 0) });
      const right = (h) => ({ x: -h.z, z: h.x });
      const neg = (v) => ({ x: -v.x, z: -v.z });
      let pts = [], kind = 'straight';
      const arc = (K, A, B, n) => {
        const r = Math.hypot(A.x - K.x, A.z - K.z);
        const a0 = Math.atan2(A.z - K.z, A.x - K.x), a1 = Math.atan2(B.z - K.z, B.x - K.x);
        const da = RA.wrapAngle(a1 - a0);
        const out = []; for (let t = 0; t <= n; t++) { const a = a0 + (da * t) / n; out.push({ x: K.x + Math.cos(a) * r, z: K.z + Math.sin(a) * r }); }
        return out;
      };
      if (fam === 'road') {
        if (din === dout) {
          kind = 'uturn';
          const h = neg(DV[din]); const rI = right(h);
          const E = edge(din, { x: rI.x * LO, z: rI.z * LO });
          const A = { x: C.x + rI.x * LO + h.x * 0.15, z: C.z + rI.z * LO + h.z * 0.15 };
          const B = { x: C.x - rI.x * LO + h.x * 0.15, z: C.z - rI.z * LO + h.z * 0.15 };
          const K = { x: C.x + h.x * 0.15, z: C.z + h.z * 0.15 };
          const a0 = Math.atan2(A.z - K.z, A.x - K.x);
          const mid = { x: K.x + h.x * LO, z: K.z + h.z * LO };
          const am = Math.atan2(mid.z - K.z, mid.x - K.x);
          const sgn = RA.wrapAngle(am - a0) > 0 ? 1 : -1;
          pts.push(E, A);
          for (let t = 1; t <= 12; t++) { const a = a0 + sgn * Math.PI * t / 12; pts.push({ x: K.x + Math.cos(a) * LO, z: K.z + Math.sin(a) * LO }); }
          const X = edge(din, { x: -rI.x * LO, z: -rI.z * LO });
          pts.push(X);
        } else {
          const ri = right(neg(DV[din])), ro = right(DV[dout]);
          const E = edge(din, { x: ri.x * LO, z: ri.z * LO });
          const X = edge(dout, { x: ro.x * LO, z: ro.z * LO });
          if (dout === OPP[din]) pts = [E, X];
          else {
            const K = { x: C.x + (DV[din].x + DV[dout].x) * S / 2, z: C.z + (DV[din].z + DV[dout].z) * S / 2 };
            pts = arc(K, E, X, 14);
            const cross = (-DV[din].x) * DV[dout].z - (-DV[din].z) * DV[dout].x;
            kind = cross > 0 ? 'right' : 'left';
          }
        }
      } else {
        const stopOff = fam === 'rail' ? STOP_RAIL : 0;
        if (dout === 'C') { const E = edge(din); pts = [E, { x: C.x - DV[din].x * stopOff, z: C.z - DV[din].z * stopOff }]; kind = 'end'; }
        else if (din === 'C') { pts = [{ x: C.x - DV[dout].x * stopOff, z: C.z - DV[dout].z * stopOff }, edge(dout)]; kind = 'start'; }
        else if (dout === OPP[din]) pts = [edge(din), edge(dout)];
        else if (din !== dout) {
          const K = { x: C.x + (DV[din].x + DV[dout].x) * S / 2, z: C.z + (DV[din].z + DV[dout].z) * S / 2 };
          pts = arc(K, edge(din), edge(dout), 16); kind = 'turn';
        } else return null;
      }
      const path = new RA.Path(pts);
      const h0 = this.edgeH(i, j, k, din), h1 = this.edgeH(i, j, k, dout);
      m = { key, i, j, k, din, dout, fam, type: p.type, path, len: path.length, h0, h1, kind, res: this.resKey(i, j, k), cell: i + ',' + j, pk: this.pieceKey(i, j, k) };
      this.mv.set(key, m);
      return m;
    }
    y(m, s) { if (m.h0 === m.h1) return m.h0; return m.h0 + (m.h1 - m.h0) * RA.smooth(s / m.len); }

    // hareketin çıkışındaki komşu parça
    after(m) {
      if (m.virtual || m.dout === 'C') return null;
      const ni = m.i + DV[m.dout].x, nj = m.j + DV[m.dout].z;
      if (!this.g.inside(ni, nj)) return { out: true, d: m.dout, i: m.i, j: m.j };
      const mt = WS.mate(this.g, m.i, m.j, m.dout, m.fam);
      if (!mt) return null;
      return { i: mt.i, j: mt.j, k: mt.k, din: OPP[m.dout], p: mt.p };
    }
    // bir parçaya din'den girince seçilebilecek çıkışlar
    options(i, j, k, din) {
      const p = this.piece(i, j, k); if (!p) return [];
      const fam = FAMILY[p.type];
      const ps = WS.ports(p.m).filter((d) => d !== din);
      if (!ps.length) return fam === 'road' ? [din] : ['C'];
      return ps;
    }
    // sanal giriş/çıkış (tahtanın dışı)
    virtualOut(m) {
      const e = m.path.at(m.len), t = m.path.tan(m.len);
      return { virtual: true, path: new RA.Path([e, { x: e.x + t.x * 5, z: e.z + t.z * 5 }]), len: 5, h0: m.h1, h1: m.h1, res: null, fam: m.fam, key: 'vo' + m.key };
    }
    virtualIn(first, L) {
      const s = first.path.at(0), t = first.path.tan(0);
      const d = L + 1.0;
      return { virtual: true, path: new RA.Path([{ x: s.x - t.x * d, z: s.z - t.z * d }, s]), len: d, h0: first.h0, h1: first.h0, res: null, fam: first.fam, key: 'vi' + first.key };
    }

    // kavşaktaki iki hareket çakışıyor mu?
    conflicts(a, b) {
      if (a.din === b.din) return false;
      const key = a.key < b.key ? a.key + '|' + b.key : b.key + '|' + a.key;
      let v = this.conf.get(key);
      if (v != null) return v;
      v = false;
      const P = {}, Q = {};
      for (let x = 0; x <= 14 && !v; x++) {
        a.path.at((a.len * x) / 14, P);
        for (let y = 0; y <= 14; y++) { b.path.at((b.len * y) / 14, Q); if ((P.x - Q.x) ** 2 + (P.z - Q.z) ** 2 < 0.45 * 0.45) { v = true; break; } }
      }
      if (a.dout === b.dout) v = true;
      this.conf.set(key, v);
      return v;
    }

    // hava ağı: (i,j,k,din) durumundan hedef parçaya en kısa rota (hareket listesi)
    route(start, isGoal, avoid) {
      const q = [start]; const prev = new Map(); const sk = (s) => s.i + ',' + s.j + ',' + s.k + ',' + s.din;
      prev.set(sk(start), null);
      let goal = null;
      while (q.length) {
        const s = q.shift();
        if (isGoal(s) && s !== start) { goal = s; break; }
        for (const dout of this.options(s.i, s.j, s.k, s.din)) {
          if (dout === 'C') continue;
          const m = this.movement(s.i, s.j, s.k, s.din, dout); if (!m) continue;
          const a = this.after(m); if (!a || a.out) continue;
          if (avoid && avoid(a)) continue;
          const ns = { i: a.i, j: a.j, k: a.k, din: a.din, via: dout };
          const key = sk(ns); if (prev.has(key)) continue;
          prev.set(key, s); q.push(ns);
        }
      }
      if (!goal) return null;
      const states = []; for (let s = goal; s; s = prev.get(sk(s))) states.unshift(s);
      const mvs = [];
      for (let n = 0; n < states.length - 1; n++) mvs.push(this.movement(states[n].i, states[n].j, states[n].k, states[n].din, states[n + 1].via));
      return { mvs, goal };
    }
  }
  WS.Net = Net;
})();
