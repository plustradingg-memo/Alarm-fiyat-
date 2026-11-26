/* RAY ARASI — Bölümler: oyun ekranı (serbest çizim, kesişim türü, silme, geri al, başlat, kazan/kaybet, yıldızlar) */
(function () {
  'use strict';
  const RA = window.RA;
  const LV = RA.LV;
  const T = THREE;
  const $ = (id) => document.getElementById(id);
  const G = LV.geo;
  const CYCLE = { road: ['junction', 'bridge', 'tunnel'], rail: ['level', 'bridge', 'tunnel'] };
  const TNAME = { junction: 'kavşak', level: 'hemzemin geçit', bridge: 'köprü', tunnel: 'alt geçit' };

  // kendini kesen ilmekleri at (ilmek kesilip yol düz devam eder)
  function unloop(pts) {
    for (let guard = 0; guard < 30; guard++) {
      let hit = null;
      for (let i = 0; i < pts.length - 1 && !hit; i++) for (let j = i + 2; j < pts.length - 1; j++) {
        const a = pts[i], b = pts[i + 1], c = pts[j], d = pts[j + 1];
        const r = G.segX(a.x, a.z, b.x, b.z, c.x, c.z, d.x, d.z);
        if (r) { hit = { i, j, x: a.x + (b.x - a.x) * r.t, z: a.z + (b.z - a.z) * r.t }; break; }
      }
      if (!hit) return pts;
      pts = pts.slice(0, hit.i + 1).concat([{ x: hit.x, z: hit.z }], pts.slice(hit.j + 1));
    }
    return pts;
  }

  LV.progress = {
    get() { return RA.store.get('lv.stars', {}) || {}; },
    stars(id) { return this.get()[id] || 0; },
    unlocked(id) { return id === 1 || this.stars(id - 1) > 0; },
    set(id, n) { const p = this.get(); if ((p[id] || 0) < n) { p[id] = n; RA.store.set('lv.stars', p); } },
  };

  class LvGame {
    constructor(app) {
      this.app = app;
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x2b3a42);
      this.camera = new T.PerspectiveCamera(28, 0.5, 0.5, 420);
      this.lights = RA.makeLights(this.scene, { sky: 0xe6f0ff, ground: 0x7a6a4a, hemi: 0.78, sun: 0xffe2b8, sunI: 2.0, sunPos: [-12, 26, 10], sunTarget: [0, 0, 0], shadowSize: 20, fill: 0xbfd4ff, fillI: 0.25 });
      this.view = new LV.View(this.scene);
      this.sim = new LV.Sim(this);
      this.tool = 'road';
      this.bindUI(); this.bindInput();
    }

    /* ---------- bölüm aç ---------- */
    open(id) {
      const def = LV.LEVELS.find((l) => l.id === id) || LV.LEVELS[0];
      clearTimeout(this.endT); clearTimeout(this.hintT); // önceki bölümden bekleyen kart / ipucu yeni bölüme düşmesin
      this.level = LV.prep(def);
      this.strokes = []; this.choices = {}; this.nextId = 1; this.undoStack = [];
      this.started = false; this.running = false; this.ended = null;
      this.setSpeed(1);
      this.net = LV.buildNet(this.level, [], {});
      this.view.buildBase(this.level, this.net);
      this.view.buildRoads(this.level, this.net);
      this.view.hint(null);
      this.sim.setup(this.level, this.net);
      $('lv-title').textContent = 'Bölüm ' + def.id + ' · ' + def.name;
      this.setTool('road'); this.closePick();
      this.updPlay(); this.hud(true);
      this.showCard('intro');
    }
    snapshot() { return { strokes: this.strokes.map((s) => ({ id: s.id, pts: s.pts })), choices: Object.assign({}, this.choices), nextId: this.nextId }; }
    // yeni ağı dene; kurala uyuyorsa uygula
    tryCommit(strokes, choices, okMsg, check, silent) {
      const res = LV.buildNet(this.level, strokes, choices, { check });
      if (!res.ok) { this.lastFail = res; if (!silent) { this.toast(res.msg, true); RA.audio.play('denied'); RA.vibrate([20, 40, 20]); if (res.at) this.flash(res.at); } return false; }
      // yolların kavuştuğu yeni noktalar (kavşak, birleşme, bina girişi): öpüşme animasyonu
      const old = this.net, kisses = [];
      for (const n of res.nodes) {
        if (!(n.kind === 'j' || n.kind === 'joint' || (n.kind === 'b' && n.deg > 0))) continue;
        const o = old && old.nodes.find((q) => Math.hypot(q.x - n.x, q.z - n.z) < 0.4);
        if (!o || o.deg < n.deg) kisses.push(n);
      }
      setTimeout(() => { kisses.forEach((n, k) => setTimeout(() => this.view.kiss(n.x, n.z), k * 90)); if (kisses.length) RA.audio.play('point'); }, 260);
      this.undoStack.push(this.snapshot()); if (this.undoStack.length > 40) this.undoStack.shift();
      this.strokes = strokes; this.choices = choices; this.net = res;
      this.view.buildRoads(this.level, res);
      this.sim.setNet(res);
      this.hud(true);
      if (okMsg) this.toast(okMsg);
      RA.audio.play('switch');
      return true;
    }
    undo() {
      const s = this.undoStack.pop(); if (!s) return;
      const res = LV.buildNet(this.level, s.strokes, s.choices, {});
      if (!res.ok) return;
      this.strokes = s.strokes; this.choices = s.choices; this.nextId = Math.max(this.nextId, s.nextId); this.net = res;
      this.view.buildRoads(this.level, res); this.sim.setNet(res); this.hud(true);
      this.toast('Geri alındı.');
    }

    /* ---------- çizim ---------- */
    // ham noktalar (zemin) → uçları binaya / yola yapıştır, yumuşat, kesişim türlerini ata, dene
    // Çizilen yolu düzelterek ekler: ilmekleri atar, uçları binaya/yola/kavşağa yapıştırır, virajları genişletir,
    // var olan yolun yanından giden kısmı o yolla birleştirir, kavşağın dibinden geçen yolu kavşaktan geçirir.
    addStroke(raw, crossTool, quiet) {
      if (!raw || raw.length < 2) return false;
      const net = this.net;
      raw = raw.map((p) => ({ x: RA.clamp(p.x, -LV.C.BX, LV.C.BX), z: RA.clamp(p.z, -LV.C.BZ, LV.C.BZ) }));
      raw = unloop(raw);
      { const d = [raw[0]]; for (let i = 1; i < raw.length; i++) { const a = raw[i - 1], b = raw[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4); for (let j = 1; j <= n; j++) d.push({ x: a.x + (b.x - a.x) * j / n, z: a.z + (b.z - a.z) * j / n }); } raw = d; }
      // binaların üstünden geçen kısım binanın yanından dolaşır
      const deflect = (pts, keepHead, keepTail, m) => pts.map((p, i) => {
        if ((keepHead && i < 4) || (keepTail && i > pts.length - 5)) return p;
        let q = p;
        for (const b of this.level.blds) {
          const dx = q.x - b.x, dz = q.z - b.z, al = dx * b.ux + dz * b.uz, pe = -dx * b.uz + dz * b.ux;
          const ha = b.d / 2 + m, hp = b.w / 2 + m;
          if (Math.abs(al) >= ha || Math.abs(pe) >= hp) continue;
          if (ha - Math.abs(al) < hp - Math.abs(pe)) { const na = Math.sign(al || 1) * ha; q = { x: b.x + b.ux * na - b.uz * pe, z: b.z + b.uz * na + b.ux * pe }; }
          else { const np = Math.sign(pe || 1) * hp; q = { x: b.x + b.ux * al - b.uz * np, z: b.z + b.uz * al + b.ux * np }; }
        }
        return q;
      });
      const hitsBld = (pts, keepHead, keepTail) => pts.some((p, i) => !((keepHead && i < 4) || (keepTail && i > pts.length - 5)) && this.level.blds.some((b) => { const dx = p.x - b.x, dz = p.z - b.z; return Math.abs(dx * b.ux + dz * b.uz) < b.d / 2 + 0.3 && Math.abs(-dx * b.uz + dz * b.ux) < b.w / 2 + 0.3; }));
      // yolun üstündeki düğümler (kavşak, uç, bina girişi) ve köprü bölgeleri
      const nodesOn = (st) => { const out = []; for (const n of net.nodes) { if (!n.deg && n.kind !== 'end') continue; const q = G.nearest(st, n.x, n.z); if (q.d < 0.06) out.push({ s: q.s, n }); } return out; };
      // kavşağa yeni kol: var olan kolların arasındaki en uygun boşluktan (istenen yöne en yakın) çıkış yönü
      const nodeDir = (node, toward) => {
        const angs = node.arms.map((r) => r.ang).sort((x, y) => x - y);
        const pref = Math.atan2(toward.z, toward.x);
        if (!angs.length) return toward;
        let best = null;
        for (let k = 0; k < angs.length; k++) {
          const a0 = angs[k], a1 = k === angs.length - 1 ? angs[0] + Math.PI * 2 : angs[k + 1];
          if (a1 - a0 < 1.35) continue;
          let pa = pref; while (pa < a0) pa += Math.PI * 2; while (pa > a0 + Math.PI * 2) pa -= Math.PI * 2;
          const a = RA.clamp(pa, a0 + 0.68, a1 - 0.68), sc = Math.abs(RA.wrapAngle(a - pref));
          if (!best || sc < best.sc) best = { a, sc };
        }
        return best ? { x: Math.cos(best.a), z: Math.sin(best.a) } : toward;
      };
      const unit = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
      const snapRoad = (p, R, hint) => {
        let best = null;
        for (const st of net.S) { const q = G.nearest(st, p.x, p.z); if (q.d < R && (!best || q.d < best.d)) best = { st, s: q.s, d: q.d }; }
        if (!best) return null;
        const st = best.st; let s = best.s;
        const ns = nodesOn(st);
        const h = hint || p;
        // yakında kavşak ya da yol ucu varsa ona yapış (kolların arasından girer)
        let nn = null; for (const q of ns) if (q.n.kind !== 'b' && q.n.arms.length < 4 && Math.abs(q.s - s) < 2.6 && (!nn || Math.abs(q.s - s) < Math.abs(nn.s - s))) nn = q;
        if (nn) return { x: nn.n.x, z: nn.n.z, node: nn.n, dir: nodeDir(nn.n, unit(h.x - nn.n.x, h.z - nn.n.z)) };
        // dolu (4 kollu) kavşağın dibine bağlanma: biraz öteye kay
        for (const q of ns) if (q.n.kind !== 'b' && Math.abs(q.s - s) < 3.1) s = q.s + (s >= q.s ? 3.1 : -3.1);
        // kavşak olmayan kesişimin (? işareti, köprü, alt geçit, hemzemin) dibine bağlanma: kesişimden uzak dur
        for (const c of net.crossings) { if (c.type === 'junction') continue; const q = G.nearest(st, c.x, c.z); if (q.d < 0.1 && Math.abs(q.s - s) < 3.2) s = q.s + (s >= q.s ? 3.2 : -3.2); }
        // bina girişinden uzak dur
        for (const q of ns) if (q.n.kind === 'b' && Math.abs(q.s - s) < 2.8) s = q.s + (q.s < 1 ? 2.8 : -2.8);
        // köprü / rampa üstüne bağlanılmaz: köprünün dışına kaydır
        for (const h of net.strokeProf.get(st.id) || []) { const a0 = h.a - h.r - 0.6, b0 = h.b + h.r + 0.6; if (s > a0 && s < b0) s = s - a0 < b0 - s && a0 > 0.5 ? a0 : b0; }
        s = RA.clamp(s, 0, st.len);
        // yola dik bağlan (yatık birleşme olmaz)
        const pt = G.at(st, s), t = G.tan(st, s); let nx = -t.z, nz = t.x;
        if ((h.x - pt.x) * nx + (h.z - pt.z) * nz < 0) { nx = -nx; nz = -nz; }
        return { x: pt.x, z: pt.z, dir: { x: nx, z: nz } };
      };
      const snapEnd = (p, hint) => {
        // bina: girişin yakını ya da binanın üstü
        let best = null, bd = 1.8;
        for (const bn of net.bNodes) { const b = bn.bld; const d = Math.min(Math.hypot(bn.x - p.x, bn.z - p.z), Math.hypot(b.x - p.x, b.z - p.z) - 0.6); if (d < bd) { bd = d; best = bn; } }
        if (best) {
          const b = best.bld;
          if (best.deg === 0) return { pt: { x: b.ex, z: b.ez }, dir: { x: b.ux, z: b.uz }, b };
          // binanın zaten yolu var: yeni yol o yola birleşir
          const st = net.S.find((q) => Math.hypot(q.pts[0].x - b.ex, q.pts[0].z - b.ez) < 0.3 || Math.hypot(q.pts[q.pts.length - 1].x - b.ex, q.pts[q.pts.length - 1].z - b.ez) < 0.3);
          if (st) { const fromStart = Math.hypot(st.pts[0].x - b.ex, st.pts[0].z - b.ez) < 0.3; const q = G.at(st, fromStart ? Math.min(3.2, st.len) : Math.max(0, st.len - 3.2)); const r = snapRoad(q, 0.5, hint); if (r) return { pt: r, dir: r.dir, road: true, near: b }; }
        }
        const r = snapRoad(p, 1.3, hint);
        return r ? { pt: r, dir: r.dir, road: true } : { pt: null };
      };
      const nR = raw.length;
      const a = snapEnd(raw[0], raw[Math.min(4, nR - 1)]), b = snapEnd(raw[nR - 1], raw[Math.max(0, nR - 5)]);
      if (a.b && b.b && a.b === b.b) { if (!quiet) this.toast('Yolun iki ucu aynı binada kaldı: bir binadan başka bir binaya ya da yola çiz.'); return false; }
      const head = a.pt || raw[0], tail = b.pt || raw[raw.length - 1];
      if (Math.hypot(head.x - tail.x, head.z - tail.z) < 1.0) { if (!quiet) this.toast(a.pt && b.pt ? 'Bu iki nokta zaten bağlı.' : 'Yol çok kısa: biraz daha uzun çiz.'); return false; }
      // binaya bağlanan uçta binanın üstünden / önünden geçen fazlalık atılır (yol girişten başlar)
      const nearB = (p, B) => { const dx = p.x - B.x, dz = p.z - B.z, al = dx * B.ux + dz * B.uz, pe = -dx * B.uz + dz * B.ux; return (Math.abs(al) < B.d / 2 + 0.9 && Math.abs(pe) < B.w / 2 + 0.9) || Math.hypot(p.x - B.ex, p.z - B.ez) < 1.4; };
      let i0 = 0, i1 = nR - 1;
      const hb = a.b || a.near, tb = b.b || b.near;
      if (hb) for (let i = 0; i < nR / 2; i++) if (nearB(raw[i], hb)) i0 = i;
      if (tb) for (let i = nR - 1; i > nR / 2; i--) if (nearB(raw[i], tb)) i1 = i;
      // aradaki çizim binaların üstünden geçiyorsa yanlarına kaydırılır
      const mid = deflect(raw.slice(i0 + 1, i1), false, false, 1.1).filter((p) => Math.hypot(p.x - head.x, p.z - head.z) > 0.8 && Math.hypot(p.x - tail.x, p.z - tail.z) > 0.8);
      // yol bir binanın üstünden geçiyorsa binanın köşelerinden dolaşan ara noktalar koy (kısa yandan)
      const detour = (pts, keepHead, keepTail) => {
        for (const b of this.level.blds) {
          const loc = (p) => { const dx = p.x - b.x, dz = p.z - b.z; return { a: dx * b.ux + dz * b.uz, p: -dx * b.uz + dz * b.ux }; };
          const ha = b.d / 2 + 0.35, hp = b.w / 2 + 0.35;
          let i0 = -1, i1 = -1;
          for (let i = 0; i < pts.length; i++) { if ((keepHead && i < 4) || (keepTail && i > pts.length - 5)) continue; const q = loc(pts[i]); if (Math.abs(q.a) < ha && Math.abs(q.p) < hp) { if (i0 < 0) i0 = i; i1 = i; } }
          if (i0 < 0) continue;
          const A = loc(pts[Math.max(0, i0 - 1)]), B = loc(pts[Math.min(pts.length - 1, i1 + 1)]);
          const ca = b.d / 2 + 1.5, cp = b.w / 2 + 1.5;
          const cs = [[ca, -cp], [ca, cp], [-ca, cp], [-ca, -cp]].map(([a, p]) => ({ a, p, g: Math.atan2(p, a) }));
          const gA = Math.atan2(A.p, A.a), gB = Math.atan2(B.p, B.a), TAU = Math.PI * 2, md = (x) => ((x % TAU) + TAU) % TAU;
          const dB = md(gB - gA);
          const ccw = cs.filter((c) => md(c.g - gA) < dB).sort((x, y) => md(x.g - gA) - md(y.g - gA));
          const cw = cs.filter((c) => md(c.g - gA) > dB).sort((x, y) => md(y.g - gA) - md(x.g - gA));
          const plen = (L) => { let l = 0, prev = A; for (const c of L.concat([B])) { l += Math.hypot(c.a - prev.a, c.p - prev.p); prev = c; } return l; };
          const route = plen(ccw) <= plen(cw) ? ccw : cw;
          const W = route.map((c) => ({ x: RA.clamp(b.x + b.ux * c.a - b.uz * c.p, -LV.C.BX + 0.1, LV.C.BX - 0.1), z: RA.clamp(b.z + b.uz * c.a + b.ux * c.p, -LV.C.BZ + 0.1, LV.C.BZ - 0.1) }));
          pts = pts.slice(0, Math.max(1, i0)).concat(W, pts.slice(Math.min(pts.length - 1, i1 + 1)));
        }
        return pts;
      };
      const smooth = (pts, hd, td) => {
        let q = LV.smoothStroke(pts, hd, td); q[0] = pts[0]; q[q.length - 1] = pts[pts.length - 1];
        // yumuşatma yolu binanın üstüne çektiyse binanın köşesinden dolaştırıp yeniden yumuşat
        for (let k = 0; k < 3 && hitsBld(q, !!hd, !!td); k++) { const d = k < 2 ? detour(q, !!hd, !!td) : deflect(q, !!hd, !!td, 1.3); q = LV.smoothStroke(d, hd, td, true); q[0] = pts[0]; q[q.length - 1] = pts[pts.length - 1]; }
        return q;
      };
      let parts = [{ pts: smooth([head].concat(mid, [tail]), a.dir || null, b.dir || null), hd: a.dir || null, td: b.dir || null, ha: !!a.pt, ta: !!b.pt }];

      // 1) var olan yolun yanından (paralel) giden kısımlar o yolla birleşir: yol ona "kavuşur"
      const splitAlong = (pt) => {
        const S0 = G.stroke(0, pt.pts), near = [];
        for (let s = 0; s <= S0.len + 1e-6; s += 0.3) {
          const p = G.at(S0, s), t = G.tan(S0, s);
          let nr = false;
          if (!((pt.ha && s < 1.6) || (pt.ta && s > S0.len - 1.6))) for (const o of net.S) { const q = G.nearest(o, p.x, p.z); if (q.d < 2.2) { const to = G.tan(o, q.s); if (Math.abs(t.x * to.x + t.z * to.z) > 0.78) nr = true; } }
          near.push({ s, nr });
        }
        if (!near.some((q) => q.nr)) return [pt];
        const out = []; let k = 0;
        while (k < near.length) {
          const st0 = k; const isNear = near[k].nr;
          while (k < near.length && near[k].nr === isNear) k++;
          if (isNear) continue;
          let s0 = near[st0].s, s1 = near[k - 1].s; if (k === near.length) s1 = S0.len;
          if (s1 - s0 < 1.5) continue;
          let pts = G.slicePts(S0, s0, s1);
          const startCut = st0 > 0, endCut = k < near.length;
          let hd = pt.hd, td = pt.td;
          if (startCut) { hd = null; const r = snapRoad(pts[0], 2.4, pts[Math.min(5, pts.length - 1)]); if (r) { pts = [r].concat(pts.filter((q) => Math.hypot(q.x - r.x, q.z - r.z) > 0.9)); hd = r.dir; } }
          if (endCut) { td = null; const r = snapRoad(pts[pts.length - 1], 2.4, pts[Math.max(0, pts.length - 6)]); if (r) { pts = pts.filter((q) => Math.hypot(q.x - r.x, q.z - r.z) > 0.9).concat([r]); td = r.dir; } }
          if (pts.length < 2 || Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].z - pts[pts.length - 1].z) < 1.2) continue;
          out.push({ pts: smooth(pts, hd, td), hd, td, ha: startCut || pt.ha, ta: endCut || pt.ta });
        }
        return out;
      };
      parts = [].concat(...parts.map(splitAlong));
      // 2) bir kavşağın ya da yol ucunun dibinden geçen yol o noktadan geçer (yakın iki kavşak olmaz)
      for (let guard = 0; guard < 8; guard++) {
        let changed = false;
        for (let k = 0; k < parts.length && !changed; k++) {
          const S0 = G.stroke(0, parts[k].pts);
          for (const o of net.S) {
            for (const x of G.intersections(S0, o)) {
              if (x.sa < 0.3 || x.sa > S0.len - 0.3) continue;
              const nn = nodesOn(o).find((q) => q.n.kind !== 'b' && Math.abs(q.s - x.sb) < 2.6);
              if (!nn) continue;
              const P = { x: nn.n.x, z: nn.n.z }, pt = parts[k];
              const A = G.slicePts(S0, 0, x.sa).filter((q) => Math.hypot(q.x - P.x, q.z - P.z) > 0.9).concat([P]);
              const B = [P].concat(G.slicePts(S0, x.sa, S0.len).filter((q) => Math.hypot(q.x - P.x, q.z - P.z) > 0.9));
              const np = [];
              const dA = A.length > 2 ? nodeDir(nn.n, unit(A[A.length - 3].x - P.x, A[A.length - 3].z - P.z)) : null;
              const dB = B.length > 2 ? nodeDir(nn.n, unit(B[2].x - P.x, B[2].z - P.z)) : null;
              // boşta biten kısa artık (kavşağı az farkla aşan uç) atılır
              const plen = (Q) => { let l = 0; for (let i = 1; i < Q.length; i++) l += Math.hypot(Q[i].x - Q[i - 1].x, Q[i].z - Q[i - 1].z); return l; };
              if (!pt.ha && plen(A) < 3.5) A.length = 1;
              if (!pt.ta && plen(B) < 3.5) B.length = 1;
              if (A.length > 1 && Math.hypot(A[0].x - P.x, A[0].z - P.z) > 1.2) np.push({ pts: smooth(A, pt.hd, dA), hd: pt.hd, td: dA, ha: pt.ha, ta: true });
              if (B.length > 1 && Math.hypot(B[B.length - 1].x - P.x, B[B.length - 1].z - P.z) > 1.2) np.push({ pts: smooth(B, dB, pt.td), hd: dB, td: pt.td, ha: true, ta: pt.ta });
              parts.splice(k, 1, ...np); changed = true; break;
            }
            if (changed) break;
          }
        }
        if (!changed) break;
      }
      // 3) boşta kalan uç başka bir yolu az farkla aştıysa uç kesilir: yol oraya birleşir
      parts = parts.map((pt) => {
        let st = G.stroke(0, pt.pts);
        const cuts = []; for (const o of net.S) for (const x of G.intersections(st, o)) cuts.push(x.sa);
        cuts.sort((p, q) => p - q);
        let s0 = 0, s1 = st.len;
        if (!pt.ha && !pt.hd && cuts.length && cuts[0] < 2.5) s0 = cuts[0];
        if (!pt.ta && !pt.td && cuts.length && st.len - cuts[cuts.length - 1] < 2.5) s1 = cuts[cuts.length - 1];
        if ((s0 > 0 || s1 < st.len) && s1 - s0 > 1.5) st = G.stroke(0, G.slicePts(st, s0, s1));
        return Object.assign({}, pt, { pts: st.pts });
      }).filter((pt) => G.stroke(0, pt.pts).len >= 1.2);
      if (!parts.length) { if (!quiet) this.toast('Bu yol zaten var olan yolun üstünde; yeni bir yol gerekmedi.'); return false; }

      // 4) son rötuş: tahtada kal, ilmek yapma, başka yola yapışık gitme, yola/raya yatık girme
      const BXm = LV.C.BX - 0.05, BZm = LV.C.BZ - 0.05;
      const water = this.level.water || [];
      const inWater = (p) => water.some((poly) => G.inPoly(poly, p.x, p.z));
      const inBld = (p, m) => this.level.blds.some((b) => { const dx = p.x - b.x, dz = p.z - b.z; return Math.abs(dx * b.ux + dz * b.uz) < b.d / 2 + m && Math.abs(-dx * b.uz + dz * b.ux) < b.w / 2 + m; });
      const onRoad = (p) => { let best = null; for (const st of net.S) { const q = G.nearest(st, p.x, p.z); if (q.d < 0.15 && (!best || q.d < best.d)) best = { st, s: q.s, d: q.d }; } return best; };
      const resm = (pt, pts, hd, td) => { const h = hd === undefined ? pt.hd : hd, t = td === undefined ? pt.td : td; return Object.assign({}, pt, { pts: smooth(pts, h, t), hd: h, td: t }); };
      const clampPts = (pts) => pts.map((q) => ({ x: RA.clamp(q.x, -BXm, BXm), z: RA.clamp(q.z, -BZm, BZm) }));
      const others = () => net.S.concat(net.rails);
      // diğer yollara 2,3 m'den fazla yaklaşmasın (kesişim ve bağlantı çevresi hariç): itilen kısım yumuşakça kayar
      const repel = (pt) => {
        const S0 = G.stroke(0, pt.pts), keep = [];
        if (pt.ha) keep.push(pt.pts[0]); if (pt.ta) keep.push(pt.pts[pt.pts.length - 1]);
        for (const o of net.S) for (const x of G.intersections(S0, o)) keep.push(x);
        const n0 = pt.pts.length, free = pt.pts.map((p, i) => i > 0 && i < n0 - 1 && !keep.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 3.0));
        let pts = pt.pts.map((p) => ({ x: p.x, z: p.z })), moved = false;
        const push = () => {
          let any = false;
          for (let i = 0; i < n0; i++) { if (!free[i]) continue; for (const o of net.S) { const n = G.nearest(o, pts[i].x, pts[i].z); if (n.d < 2.2 && n.d > 1e-3) { const c = G.at(o, n.s), k = 2.3 / n.d; pts[i] = { x: c.x + (pts[i].x - c.x) * k, z: c.z + (pts[i].z - c.z) * k }; any = true; } } }
          return any;
        };
        for (let it = 0; it < 5; it++) {
          if (!push()) break;
          moved = true;
          for (let r = 0; r < 3; r++) pts = pts.map((p, i) => (free[i] ? { x: (pts[i - 1].x + 2 * p.x + pts[i + 1].x) / 4, z: (pts[i - 1].z + 2 * p.z + pts[i + 1].z) / 4 } : p));
        }
        if (moved) push();
        return moved ? Object.assign({}, pt, { pts: clampPts(pts) }) : pt;
      };
      // yatık kesişimi dikleştir: kesişimin çevresini öteki yolun normali boyunca geçir
      const perpX = (pt, X, O, L0, off) => {
        const S0 = G.stroke(0, pt.pts), s = G.nearest(S0, X.x, X.z).s;
        const qo = G.nearest(O, X.x, X.z), to = G.tan(O, qo.s), C0 = G.at(O, qo.s), ta = G.tan(S0, s);
        let nx = -to.z, nz = to.x; if (nx * ta.x + nz * ta.z < 0) { nx = -nx; nz = -nz; }
        const L = Math.min(L0 || 3.6, s - 0.3, S0.len - s - 0.3); if (L < 1.4) return null;
        const o = Math.min(off || 1.6, L * 0.6);
        const pts = G.slicePts(S0, 0, s - L).concat([{ x: C0.x - nx * o, z: C0.z - nz * o }, { x: C0.x + nx * o, z: C0.z + nz * o }], G.slicePts(S0, s + L, S0.len));
        return resm(pt, clampPts(pts));
      };
      const shallow = (pt) => {
        const S0 = G.stroke(0, pt.pts);
        for (const o of others()) for (const x of G.intersections(S0, o)) {
          if (x.sa < 0.3 || x.sa > S0.len - 0.3) continue;
          const ta = G.tan(S0, x.sa), tb = G.tan(o, x.sb);
          if (Math.abs(ta.x * tb.z - ta.z * tb.x) < 0.62) return { X: x, O: o };
        }
        return null;
      };
      const tidy = (pt) => {
        let q = Object.assign({}, pt, { pts: clampPts(pt.pts) });
        const u = unloop(q.pts); if (u.length !== q.pts.length) q = resm(q, u);
        q = repel(q);
        for (let k = 0; k < 4; k++) { const sh = shallow(q); if (!sh) break; const v = perpX(q, sh.X, sh.O, k % 2 ? 4.6 : 3.6, k % 2 ? 2.3 : 1.6); if (!v) break; q = v; }
        return Object.assign({}, q, { pts: clampPts(q.pts) });
      };
      // boşta kalan uç suyun içinde ya da suya çok yakınsa: karşı kıyıya uzat, olmazsa sudan önce bitir
      const waterEnd = (pt, end) => {
        const S0 = G.stroke(0, pt.pts), L = S0.len, sAt = (d) => (end ? L - d : d);
        let wd = null; for (let d = 0; d <= LV.C.RAMP_W + 1.2; d += 0.2) if (inWater(G.at(S0, sAt(d)))) { wd = d; break; }
        if (wd == null) return null;
        const p0 = G.at(S0, sAt(0)), t = G.tan(S0, sAt(0)), dir = end ? t : { x: -t.x, z: -t.z };
        for (let ext = 0.6; ext <= 9; ext += 0.6) {
          let okx = true, lastW = inWater(p0) ? 0 : -1;
          for (let d = 0.2; d <= ext + 1e-6; d += 0.2) { const q = { x: p0.x + dir.x * d, z: p0.z + dir.z * d }; if (Math.abs(q.x) > BXm || Math.abs(q.z) > BZm || inBld(q, 0.4)) { okx = false; break; } if (inWater(q)) lastW = d; }
          if (!okx) break;
          const landAfter = lastW < 0 ? ext + wd : ext - lastW;
          if (landAfter >= LV.C.RAMP_W + 0.9) { const E = { x: p0.x + dir.x * ext, z: p0.z + dir.z * ext }; return Object.assign({}, pt, { pts: end ? pt.pts.concat([E]) : [E].concat(pt.pts) }); }
        }
        // uzatılamıyor: suya girmeden bitir
        let cut = null; for (let d = wd; d < L; d += 0.2) if (!inWater(G.at(S0, sAt(d)))) { cut = d; break; }
        for (let d = 0; d < L; d += 0.2) { if (inWater(G.at(S0, sAt(d)))) continue; let wet = false; for (let e = d; e < d + LV.C.RAMP_W + 1.0 && e < L; e += 0.2) if (inWater(G.at(S0, sAt(e)))) { wet = true; break; } if (!wet) { cut = d; break; } }
        if (cut == null || L - cut < 1.5) return null;
        const pts = end ? G.slicePts(S0, 0, L - cut) : G.slicePts(S0, cut, L);
        return Object.assign({}, pt, { pts, hd: end ? pt.hd : null, td: end ? null : pt.td, ha: end ? pt.ha : false, ta: end ? false : pt.ta });
      };
      // ucu yeniden bağla: yeni nokta ve yaklaşma yönüyle
      const reend = (pt, end, P, dir) => {
        if (!end) { const pts = [P].concat(pt.pts.slice(1).filter((q) => Math.hypot(q.x - P.x, q.z - P.z) > 1.2)); return pts.length < 2 ? null : resm(pt, pts, dir, undefined); }
        const pts = pt.pts.slice(0, -1).filter((q) => Math.hypot(q.x - P.x, q.z - P.z) > 1.2).concat([P]); return pts.length < 2 ? null : resm(pt, pts, undefined, dir);
      };
      // uca yakın sorun: ucu yakındaki kavşağa al, yol boyunca kaydır, en son boşta bırak
      const endFix = (ps, pt, end) => {
        const pts = pt.pts, P = end ? pts[pts.length - 1] : pts[0], out = [];
        const back = end ? pts[Math.max(0, pts.length - 9)] : pts[Math.min(8, pts.length - 1)];
        if (net.bNodes.some((n) => Math.hypot(n.x - P.x, n.z - P.z) < 0.35)) return out; // binaya bağlı uç oynamaz
        const r = onRoad(P);
        if (r) {
          for (const q of nodesOn(r.st)) if (q.n.kind !== 'b' && Math.abs(q.s - r.s) > 0.2 && Math.abs(q.s - r.s) < 4.6) out.push(() => reend(pt, end, { x: q.n.x, z: q.n.z }, nodeDir(q.n, unit(back.x - q.n.x, back.z - q.n.z))));
          // bu çizimin öteki parçasının aynı yola bağlandığı nokta
          for (const o of ps) if (o !== pt) for (const E of [o.pts[0], o.pts[o.pts.length - 1]]) { const q = G.nearest(r.st, E.x, E.z); if (q.d < 0.15 && Math.abs(q.s - r.s) > 0.2 && Math.abs(q.s - r.s) < 4.6) out.push(() => reend(pt, end, E, unit(back.x - E.x, back.z - E.z))); }
          for (const ds of [2.6, -2.6, 4.4, -4.4]) {
            const s1 = r.s + ds; if (s1 < 0.6 || s1 > r.st.len - 0.6) continue;
            const c = G.at(r.st, s1), t = G.tan(r.st, s1); let nx = -t.z, nz = t.x; if ((back.x - c.x) * nx + (back.z - c.z) * nz < 0) { nx = -nx; nz = -nz; }
            out.push(() => reend(pt, end, { x: c.x, z: c.z }, { x: nx, z: nz }));
          }
        }
        // boşta bırak (yola 2 m kala biter) ya da boşta uç ise kısalt
        const S0 = G.stroke(0, pts);
        for (const cut of [1.6, 3.0]) if (S0.len - cut > 1.5) out.push(() => { const q = end ? G.slicePts(S0, 0, S0.len - cut) : G.slicePts(S0, cut, S0.len); return Object.assign({}, pt, { pts: q, hd: end ? pt.hd : null, td: end ? null : pt.td, ha: end ? pt.ha : false, ta: end ? false : pt.ta }); });
        return out;
      };
      const RES = /Asfalt yetmiyor|hakkın/;
      const repair = (ps, f) => {
        const m = f.msg || '', X = f.at;
        let k = 0, bd = 1e9;
        if (X) ps.forEach((pt, i) => { const d = G.nearest(G.stroke(0, pt.pts), X.x, X.z).d; if (d < bd) { bd = d; k = i; } });
        const pt = ps[k], vs = [];
        // seçenekler gerektiğinde hesaplanır (çoğu zaman ilki yeter)
        if (/binanın içinden/.test(m)) { vs.push(() => resm(pt, deflect(pt.pts, pt.ha, pt.ta, 1.6))); vs.push(() => resm(pt, deflect(pt.pts, pt.ha, pt.ta, 2.2))); }
        if (/kendi üstünden/.test(m)) vs.push(() => resm(pt, unloop(pt.pts)));
        if (/tahtanın dışına/.test(m)) vs.push(() => Object.assign({}, pt, { pts: clampPts(pt.pts) }));
        if (/çok yakın;/.test(m)) vs.push(() => repel(pt));
        if (/dar açıyla kes/.test(m) && X) for (const [L0, off] of [[3.6, 1.6], [4.6, 2.3], [5.6, 3.0]]) vs.push(() => { const o = others().find((q) => G.nearest(q, X.x, X.z).d < 0.25 && G.nearest(G.stroke(0, pt.pts), X.x, X.z).d < 0.25); return o ? perpX(pt, X, o, L0, off) : null; });
        if (/suyun|rampa/.test(m)) for (const end of [0, 1]) if (!(end ? pt.ta : pt.ha)) vs.push(() => waterEnd(pt, end));
        if (X) for (const end of [0, 1]) { const E = end ? pt.pts[pt.pts.length - 1] : pt.pts[0]; if (Math.hypot(E.x - X.x, E.z - X.z) < 4.8) vs.push(...endFix(ps, pt, end)); }
        // son çare: iki ucu düz yolla bağla
        vs.push(() => resm(pt, [pt.pts[0], pt.pts[pt.pts.length - 1]]));
        return { k, vs: vs.map((mk) => () => { const v = mk(); return v && v.pts && v.pts.length >= 2 && G.stroke(0, v.pts).len >= 1.2 ? tidy(v) : null; }) };
      };

      // yeni kesişimler belirsiz başlar: türünü oyuncu işarete dokunup seçer (çözüm/ipucu yolları türüyle gelir)
      const before = this.net.crossings.length;
      let add = [];
      const commit = (ps) => {
        const choices = Object.assign({}, this.choices);
        add = ps.map((pt, i) => ({ id: this.nextId + i, pts: pt.pts }));
        for (const np of add) {
          const st = G.stroke(np.id, np.pts);
          for (const o of net.S.concat(add.filter((q) => q !== np).map((q) => G.stroke(q.id, q.pts)))) for (const x of G.intersections(st, o)) { const k = G.posKey(x.x, x.z); if (!(k in choices) && x.sa > 0.2 && x.sa < st.len - 0.2) choices[k] = crossTool || 'pending'; }
          for (const r of net.rails) for (const x of G.intersections(st, r)) { const k = G.posKey(x.x, x.z); if (!(k in choices)) choices[k] = crossTool ? (crossTool === 'junction' ? 'level' : crossTool) : 'pending'; }
        }
        return this.tryCommit(this.strokes.concat(add), choices, null, add.map((q) => q.id), true);
      };
      parts = parts.map(tidy).filter((pt) => G.stroke(0, pt.pts).len >= 1.2);
      // iki yol arasında kalan çok kısa bağlantı (yollar zaten yan yana): anlamsız, atılır
      const atRoad = (p) => !!onRoad(p) || net.nodes.some((n) => n.deg > 0 && n.kind !== 'b' && Math.hypot(n.x - p.x, n.z - p.z) < 0.2);
      parts = parts.filter((pt) => !(G.stroke(0, pt.pts).len < 3.6 && atRoad(pt.pts[0]) && atRoad(pt.pts[pt.pts.length - 1])));
      if (!parts.length) { if (!quiet) this.toast('Bu yol zaten var olan yolun üstünde; yeni bir yol gerekmedi.'); return false; }
      // kural dışı kalırsa hata göstermeden onar: sorunun olduğu yere göre yolu değiştirip yeniden dene
      const T0 = performance.now();
      const fix = (ps) => {
        let cur = ps.slice(), tries = 0;
        if (commit(cur)) return true;
        if (this.dbg) this.dbg.push({ parts: cur.map((q) => ({ a: q.pts[0], b: q.pts[q.pts.length - 1], n: q.pts.length, ha: q.ha, ta: q.ta, hd: !!q.hd, td: !!q.td })), first: this.lastFail.msg, fat: this.lastFail.at });
        while (tries < 36 && performance.now() - T0 < 450) {
          const f = this.lastFail; if (!f || RES.test(f.msg)) return false;
          const { k, vs } = repair(cur, f);
          let moved = false;
          for (const mk of vs) {
            const v = mk(); if (!v) continue;
            const cand = cur.slice(); cand[k] = v; tries++;
            if (commit(cand)) return true;
            const g = this.lastFail;
            if (this.dbg) this.dbg.push({ k, from: f.msg, fat: f.at, to: g.msg, at: g.at, n: cand.length });
            if (g.msg !== f.msg || !g.at || !f.at || Math.hypot(g.at.x - f.at.x, g.at.z - f.at.z) > 1.2) { cur = cand; moved = true; break; }
            if (tries >= 36 || performance.now() - T0 > 450) break;
          }
          if (!moved) return false;
        }
        return false;
      };
      let ok = fix(parts);
      // parçalar birlikte sığmadıysa sığanları tek tek ekle
      if (!ok && parts.length > 1) { let any = false; const base = this.nextId; for (const pt of parts) { if (fix([pt])) { any = true; this.nextId += 1; } } if (any) { this.nextId = base; ok = true; add = this.strokes.filter((q) => q.id >= base); } }
      // hâlâ olmadıysa: her parçanın en sade hâli (iki ucu düz bağlayan yol; gerekirse uçları yoldan biraz önce biter)
      if (!ok) {
        const base = this.nextId; let any = false;
        for (const pt of parts) {
          const S0 = G.stroke(0, pt.pts), P0 = pt.pts[0], P1 = pt.pts[pt.pts.length - 1];
          const free = (c0, c1) => (S0.len - c0 - c1 > 1.6 ? Object.assign({}, pt, { pts: G.slicePts(S0, c0, S0.len - c1), hd: c0 ? null : pt.hd, td: c1 ? null : pt.td, ha: c0 ? false : pt.ha, ta: c1 ? false : pt.ta }) : null);
          const ladder = [() => resm(pt, [P0, P1]), () => free(pt.ha && !pt.hd ? 0 : 0, 0), () => free(pt.ha && !net.bNodes.some((n) => Math.hypot(n.x - P0.x, n.z - P0.z) < 0.35) ? 1.8 : 0, pt.ta && !net.bNodes.some((n) => Math.hypot(n.x - P1.x, n.z - P1.z) < 0.35) ? 1.8 : 0)];
          for (const mk of ladder) { let v = mk(); if (!v || G.stroke(0, v.pts).len < 1.2) continue; v = tidy(v); if (commit([v])) { any = true; this.nextId += 1; break; } }
        }
        if (any) { this.nextId = base; ok = true; add = this.strokes.filter((q) => q.id >= base); }
      }
      const used = add;
      if (!ok) {
        const r = this.lastFail;
        if (r && RES.test(r.msg)) { this.toast(r.msg, true); RA.audio.play('denied'); return false; }
        if (!quiet) { this.toast('Bu yolu buraya yerleştiremedim; biraz daha açık bir yerden çizmeyi dene.'); RA.audio.play('tap'); }
        return false;
      }
      this.nextId = Math.max(this.nextId, ...used.map((q) => q.id + 1));
      for (const np of used) this.view.sweep(np.pts);
      if (!quiet) {
        const conn = [a.b, b.b].filter(Boolean), nb = this.net.crossings.length - before, partsMsg = [];
        if (conn.length) partsMsg.push(conn.map((x) => LV.COLORS[x.color].name.toLowerCase() + ' ' + (x.kind === 'house' ? 'ev' : 'iş yeri')).join(' ve ') + ' bağlandı');
        if (nb > 0) partsMsg.push(nb + ' kesişim: türünü seçmek için turuncu ? işaretine dokun');
        const msg = partsMsg.length ? partsMsg.join(' · ') + '.' : 'Yol eklendi.';
        this.toast(msg.charAt(0).toLocaleUpperCase('tr-TR') + msg.slice(1));
      }
      // trafik akarken belirsiz kesişim oluştu: durdur ve seçtir
      if (this.net.pending && this.running) { this.running = false; this.updPlay(); this.openPick(this.net.crossings.find((c) => c.type === 'pending')); this.toast('Trafik durdu: yeni kesişimin türünü seç.'); }
      return true;
    }
    // kesişim seçim kutusu
    openPick(c) {
      if (!c) return;
      this.pickC = c;
      const el = $('lv-pick'), L = this.level, u = this.net.usage;
      const order = CYCLE[c.kind];
      const left = { bridge: (L.bridges || 0) - u.bridges + (c.type === 'bridge' ? 1 : 0), tunnel: (L.tunnels || 0) - u.tunnels + (c.type === 'tunnel' ? 1 : 0) };
      el.querySelectorAll('[data-pick]').forEach((b, k) => {
        const t = order[k]; b.dataset.pick = t;
        b.querySelector('span').textContent = t === 'level' ? 'Hemzemin' : t === 'junction' ? 'Kavşak' : t === 'bridge' ? 'Köprü' : 'Alt geçit';
        const n = t === 'bridge' || t === 'tunnel' ? left[t] : null;
        // bu seçenek burada olur mu? (rampa yeri, yakın kavşak…) olmayan seçenek baştan kapalı
        const fits = t === c.type || LV.buildNet(this.level, this.strokes, Object.assign({}, this.choices, { [c.key]: t }), {}).ok;
        b.querySelector('b').textContent = n != null && n <= 0 ? 'hak yok' : !fits ? 'yer yok' : n == null ? '' : n + ' hak';
        b.disabled = (n != null && n <= 0) || !fits;
        b.classList.toggle('on', c.type === t);
        b.dataset.kind = t;
      });
      el.querySelector('p').textContent = c.kind === 'rail' ? 'Yol rayı nasıl geçsin?' : 'Bu kesişim ne olsun?';
      el.hidden = false;
      // işaretin yanına yerleştir
      const q = RA.project(new T.Vector3(c.x, 2.0, c.z), this.camera, this.app.w, this.app.h);
      const w = el.offsetWidth || 260, h = el.offsetHeight || 110;
      el.style.left = RA.clamp(q.x - w / 2, 8, this.app.w - w - 8) + 'px';
      el.style.top = RA.clamp(q.y - h - 34, 70, this.app.h - h - 160) + 'px';
      RA.audio.play('tap');
    }
    closePick() { const el = $('lv-pick'); if (el) el.hidden = true; this.pickC = null; }
    choose(t) {
      const c = this.pickC; if (!c) return;
      const choices = Object.assign({}, this.choices, { [c.key]: t });
      if (this.tryCommit(this.strokes, choices, 'Kesişim: ' + TNAME[t] + '.')) { this.closePick(); if (t !== 'junction' && t !== 'level') this.view.kiss(c.x, c.z, 1.4); }
    }
    eraseAt(p) {
      let best = null, bd = 1.0;
      for (const e of this.net.edges) {
        const n = G.nearest(e.st, p.x, p.z);
        if (n.s < e.s0 - 0.01 || n.s > e.s1 + 0.01) continue;
        if (n.d < bd) { bd = n.d; best = e; }
      }
      if (!best) { this.toast('Silmek için bir yolun üstüne dokun.'); return; }
      const st = this.strokes.find((s) => s.id === best.st.id);
      const S = G.stroke(st.id, st.pts);
      const parts = [];
      if (best.s0 > 1.2) parts.push(G.slicePts(S, 0, best.s0));
      if (S.len - best.s1 > 1.2) parts.push(G.slicePts(S, best.s1, S.len));
      const strokes = this.strokes.filter((s) => s !== st);
      for (const pts of parts) strokes.push({ id: this.nextId++, pts });
      this.tryCommit(strokes, this.choices, 'Yol silindi.');
    }

    /* ---------- arayüz ---------- */
    bindUI() {
      document.querySelectorAll('#lv [data-lvtool]').forEach((b) => b.addEventListener('click', () => this.setTool(b.dataset.lvtool)));
      $('lv-pick').addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b && !b.disabled) this.choose(b.dataset.pick); });
      $('lv-back').addEventListener('click', () => this.app.showMenu());
      $('lv-undo').addEventListener('click', () => this.undo());
      $('lv-play').addEventListener('click', () => this.togglePlay());
      $('lv-speed').addEventListener('click', () => { const S = [1, 2, 4, 8]; this.setSpeed(S[(S.indexOf(this.speed) + 1) % S.length]); });
      $('lv-hint').addEventListener('click', () => this.showHint());
      $('lv-card').addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act;
        if (act === 'start') this.hideCard();
        else if (act === 'next') { const nx = LV.LEVELS.find((l) => l.id === this.level.id + 1); if (nx) this.open(nx.id); else this.app.showMenu(); }
        else if (act === 'retry') this.restart(true);
        else if (act === 'reset') this.restart(false);
        else if (act === 'menu') this.app.showMenu();
      });
    }
    // hız: 1× 2× 4× 8× (her karede simülasyon adımı o kadar kez çalışır; adım küçük kaldığı için araçlar doğru davranır)
    setSpeed(v) {
      this.speed = v;
      const b = $('lv-speed'); b.textContent = v + '×'; b.dataset.v = v; b.setAttribute('aria-label', 'Hız: ' + v + ' kat (değiştirmek için dokun)');
    }
    setTool(t) {
      this.tool = t;
      document.querySelectorAll('#lv [data-lvtool]').forEach((b) => { const on = b.dataset.lvtool === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });

    }
    togglePlay() {
      if (this.ended) return;
      if (!this.running && this.net.pending) { this.toast('Önce kesişimleri belirle: turuncu ? işaretine dokun.'); this.openPick(this.net.crossings.find((c) => c.type === 'pending')); return; }
      if (!this.started) {
        if (!this.net.bNodes.some((n) => n.bld.kind === 'house' && n.deg > 0)) { this.toast('Önce evlerden iş yerlerine yol çiz.', true); return; }
        this.started = true; this.running = true; this.view.hint(null);
        this.toast('Trafik başladı! Çizmeye devam edebilirsin; sıkışan yeri köprü ya da yeni yolla rahatlat.');
      } else this.running = !this.running;
      this.updPlay();
    }
    updPlay() {
      const b = $('lv-play');
      b.classList.toggle('run', this.running);
      b.querySelector('span').textContent = !this.started ? 'Başlat' : this.running ? 'Duraklat' : 'Devam';
      $('lv-speed').hidden = !this.started;
    }
    restart(keep) {
      const s = keep ? this.snapshot() : null;
      this.open(this.level.id);
      this.hideCard();
      if (s && s.strokes.length) { const res = LV.buildNet(this.level, s.strokes, s.choices, {}); if (res.ok) { this.strokes = s.strokes; this.choices = s.choices; this.nextId = s.nextId; this.net = res; this.view.buildRoads(this.level, res); this.sim.setNet(res); this.hud(true); } }
      this.toast(keep ? 'Yolların duruyor. Düzelt ve ▶ ile yeniden başlat.' : 'Bölüm baştan başladı.');
    }
    showHint() {
      const paths = this.level.solution.map(([, raw]) => { const b0 = this.level.blds.find((b) => Math.hypot(b.ex - raw[0][0], b.ez - raw[0][1]) < 0.4), b1 = this.level.blds.find((b) => Math.hypot(b.ex - raw[raw.length - 1][0], b.ez - raw[raw.length - 1][1]) < 0.4); return LV.smoothStroke(raw.map(([x, z]) => ({ x, z })), b0 && { x: b0.ux, z: b0.uz }, b1 && { x: b1.ux, z: b1.uz }); });
      this.view.hint(paths);
      this.toast('İpucu: ' + this.level.tip);
      clearTimeout(this.hintT); this.hintT = setTimeout(() => this.view.hint(null), 6000);
    }
    // çözüm yollarını sırayla çiz (testler ve ipucu için)
    playSolution() {
      for (const [tool, raw] of this.level.solution) this.addStroke(raw.map(([x, z]) => ({ x, z })), tool === 'road' ? 'junction' : tool, true);
      return this.strokes.length;
    }
    showCard(kind, extra) {
      const L = this.level, c = $('lv-card');
      const res = (L.budget ? '<li><b>' + L.budget + ' m</b> asfalt</li>' : '') + (L.bridges ? '<li><b>' + L.bridges + '</b> köprü</li>' : '') + (L.tunnels ? '<li><b>' + L.tunnels + '</b> alt geçit</li>' : '');
      let html = '';
      if (kind === 'intro') {
        html = '<p class="lv-kicker">Bölüm ' + L.id + '</p><h2>' + L.name + '</h2><p>' + L.intro + '</p>' +
          '<div class="lv-goalbox"><span>Hedef</span><b>' + L.goal + ' araç ulaştır</b><small>Bir ev ' + LV.Sim.PENDING_CAP + ' kişiyi bekletirse kaybedersin.</small></div>' +
          '<ul class="lv-res">' + res + '</ul><div class="lv-btns"><button data-act="start" class="primary" type="button">Kurmaya başla</button></div>';
      } else if (kind === 'win') {
        const s = extra;
        html = '<p class="lv-kicker">Bölüm ' + L.id + ' tamam</p><h2>Harika!</h2><div class="lv-stars">' + [1, 2, 3].map((k) => '<i class="' + (k <= s.stars ? 'on' : '') + '">★</i>').join('') + '</div>' +
          '<ul class="lv-crit"><li class="ok">' + L.goal + ' araç ulaştı</li><li class="' + (s.c2 ? 'ok' : '') + '">En çok ' + L.star2 + ' m asfalt (' + Math.round(s.len) + ' m)</li><li class="' + (s.c3 ? 'ok' : '') + '">Hiçbir ev 3 kişiden fazla bekletmedi (en çok ' + s.peak + ')</li></ul>' +
          '<div class="lv-btns">' + (LV.LEVELS.some((l) => l.id === L.id + 1) ? '<button data-act="next" class="primary" type="button">Sonraki bölüm</button>' : '<button data-act="menu" class="primary" type="button">Bütün bölümler bitti!</button>') + '<button data-act="retry" type="button">Daha iyisini dene</button><button data-act="menu" type="button">Bölümler</button></div>';
      } else {
        const h = extra;
        html = '<p class="lv-kicker">Bölüm ' + L.id + '</p><h2>Trafik tıkandı</h2><p>' + LV.COLORS[h.b.color].name + ' evdekiler ' + LV.Sim.PENDING_CAP + ' kişi bekledi' + (h.noRoute ? ': gidecekleri iş yerine yol yok.' : '; yollar onları taşıyamadı.') + ' Sıkışan yeri köprü, alt geçit ya da ikinci bir yolla rahatlat.</p>' +
          '<p class="lv-note">' + this.sim.stats.delivered + ' / ' + L.goal + ' araç ulaştı</p>' +
          '<div class="lv-btns"><button data-act="retry" class="primary" type="button">Yollarımla tekrar dene</button><button data-act="reset" type="button">Boş tahtayla başla</button><button data-act="menu" type="button">Bölümler</button></div>';
      }
      c.innerHTML = '<div class="lv-cardbox">' + html + '</div>';
      c.hidden = false; c.dataset.kind = kind;
    }
    hideCard() { $('lv-card').hidden = true; if (!this.started && this.level.id <= 3) this.toast(this.level.tip); }
    onDeliver() { if (this.sim.stats.delivered % 5 === 0) RA.audio.play('tap'); }
    onEnd(kind, h) {
      this.running = false; this.ended = kind; this.updPlay();
      if (kind === 'win') {
        const len = this.net.usage.len, peak = this.sim.stats.peak;
        const c2 = len <= this.level.star2 + 0.01, c3 = peak <= 3;
        const stars = 1 + (c2 ? 1 : 0) + (c3 ? 1 : 0);
        LV.progress.set(this.level.id, stars);
        RA.audio.play('record');
        this.endT = setTimeout(() => this.showCard('win', { stars, c2, c3, len, peak }), 700);
      } else {
        RA.audio.play('end');
        this.endT = setTimeout(() => this.showCard('lose', h), 700);
      }
    }
    hud(force) {
      const L = this.level, u = this.net.usage, st = this.sim.stats || { delivered: 0 };
      $('lv-goaltxt').textContent = st.delivered + ' / ' + L.goal;
      $('lv-goalbar').style.width = Math.min(100, (st.delivered / L.goal) * 100) + '%';
      if (force) {
        $('lv-budgettxt').textContent = Math.round(u.len) + ' / ' + L.budget + ' m';
        const f = u.len / L.budget;
        const bb = $('lv-budgetbar'); bb.style.width = Math.min(100, f * 100) + '%'; bb.dataset.lv = f > 0.9 ? 'bad' : f > 0.7 ? 'mid' : 'ok';
        $('lv-nb').textContent = Math.max(0, (L.bridges || 0) - u.bridges);
        $('lv-nt').textContent = Math.max(0, (L.tunnels || 0) - u.tunnels);
        $('lv-tok-b').classList.toggle('none', !L.bridges); $('lv-tok-t').classList.toggle('none', !L.tunnels);
        $('lv-undo').disabled = !this.undoStack.length;
      }
    }
    toast(msg, err) {
      const el = $('lv-toast'); if (!msg) return;
      el.textContent = msg; el.hidden = false; el.classList.toggle('err', !!err);
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
      clearTimeout(this.toastT); this.toastT = setTimeout(() => { el.hidden = true; }, err ? 3200 : 3400);
    }
    flash(p) {
      const m = new T.Mesh(new T.RingGeometry(0.6, 0.95, 28), new T.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.4, p.z); m.renderOrder = 30; this.scene.add(m);
      let t = 0; const tick = () => { t += 0.05; m.material.opacity = 0.9 * (1 - t); m.scale.setScalar(1 + t); if (t < 1) requestAnimationFrame(tick); else { this.scene.remove(m); m.geometry.dispose(); } }; tick();
    }

    /* ---------- dokunma ---------- */
    ground(x, y) { return RA.screenToGround(x, y, this.camera, this.app.w, this.app.h, 0); }
    markAt(x, y) {
      let best = null, bd = 30;
      for (const mk of this.view.marks || []) {
        const q = RA.project(new T.Vector3(mk.c.x, 2.0, mk.c.z), this.camera, this.app.w, this.app.h);
        const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = mk.c; }
      }
      return best;
    }
    bindInput() {
      const st = this.app.stage;
      const local = (e) => { const r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      st.addEventListener('pointerdown', (e) => {
        if (this.app.state !== 'level' || e.target.closest('button, .lv-bar, .lv-top, .lv-card, .lv-pick')) return;
        if (!$('lv-card').hidden || this.ended) return;
        RA.audio.unlock(); e.preventDefault();
        const p = local(e);
        try { st.setPointerCapture(e.pointerId); } catch (err) { /* yok */ }
        const g = this.ground(p.x, p.y);
        this.drag = { id: e.pointerId, x0: p.x, y0: p.y, moved: false, raw: g ? [{ x: g.x, z: g.z }] : [] };
        if (this.pickC && !this.markAt(p.x, p.y)) this.closePick();
      }, { passive: false });
      st.addEventListener('pointermove', (e) => {
        const d = this.drag; if (!d || e.pointerId !== d.id) return;
        const p = local(e);
        if (Math.hypot(p.x - d.x0, p.y - d.y0) > 9) d.moved = true;
        if (!d.moved || this.tool !== 'road') return;
        const g = this.ground(p.x, p.y); if (!g) return;
        const last = d.raw[d.raw.length - 1];
        if (!last || Math.hypot(g.x - last.x, g.z - last.z) > 0.12) d.raw.push({ x: RA.clamp(g.x, -LV.C.BX, LV.C.BX), z: RA.clamp(g.z, -LV.C.BZ, LV.C.BZ) });
        let L = 0; for (let k = 1; k < d.raw.length; k++) L += Math.hypot(d.raw[k].x - d.raw[k - 1].x, d.raw[k].z - d.raw[k - 1].z);
        this.view.preview(d.raw, this.net.usage.len + L * 0.95 <= this.level.budget);
      });
      const end = (e) => {
        const d = this.drag; if (!d || e.pointerId !== d.id) return;
        this.drag = null; this.view.preview(null);
        if (e.type === 'pointercancel') return;
        const p = local(e);
        if (!d.moved) {
          const mk = this.markAt(p.x, p.y);
          if (mk) { this.openPick(mk); return; }
          if (this.pickC) { this.closePick(); return; }
          const g = this.ground(p.x, p.y);
          if (g && this.tool === 'erase') this.eraseAt(g);
          else if (g && this.tool === 'road') this.toast('Çizmek için parmağını sürükle: bir evin önünden aynı renkteki binanın önüne.');
          return;
        }
        if (this.tool === 'road') this.addStroke(d.raw);
        else if (this.tool === 'erase') { const g = this.ground(p.x, p.y); if (g) this.eraseAt(g); }
      };
      st.addEventListener('pointerup', end);
      st.addEventListener('pointercancel', end);
    }

    /* ---------- döngü ---------- */
    update(dt) { for (let k = 0; k < this.speed && this.running; k++) this.sim.update(dt); }
    frame(dt) {
      this.view.frame(this.sim, performance.now() / 1000, this.running);
      const now = performance.now();
      if (!this.lastHud || now - this.lastHud > 200) { this.lastHud = now; this.hud(false); }
    }
    resize(w, h) {
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      const top = $('lv').querySelector('.lv-top'), bar = $('lv').querySelector('.lv-bar');
      const sr = this.app.stage.getBoundingClientRect();
      const tb = top && top.offsetHeight ? top.getBoundingClientRect().bottom - sr.top + 6 : 70;
      const bb = bar && bar.offsetHeight ? sr.bottom - bar.getBoundingClientRect().top + 6 : 150;
      const tilt = T.MathUtils.degToRad(w / h > 0.75 ? 52 : 57);
      const dir = new T.Vector3(0, Math.sin(tilt), Math.cos(tilt));
      const r = RA.fitCamera(this.camera, { dir, target: new T.Vector3(0, 0, 0), points: [[-10.4, 0, -16.4], [10.4, 0, -16.4], [-10.4, 0, 16.4], [10.4, 0, 16.4], [0, 2.2, -16]], margin: { top: tb / h, bottom: bb / h, left: 0.0, right: 0.0 } });
      this.camera.position.copy(r.target).addScaledVector(dir, r.dist); this.camera.lookAt(r.target); this.camera.updateMatrixWorld(true);
      const sun = this.lights.sun; sun.target.position.set(0, 0, 0); sun.position.set(-12, 26, 10);
      const sc = sun.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.far = 120; sc.updateProjectionMatrix(); sun.target.updateMatrixWorld();
    }
  }
  LV.Game = LvGame;
})();
