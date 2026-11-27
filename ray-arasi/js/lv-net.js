/* RAY ARASI — Bölümler: serbest çizilen yollardan yol ağı (kavşak, köprü, alt geçit, hemzemin geçit, şeritler) */
(function () {
  'use strict';
  const RA = window.RA;
  const LV = (RA.LV = RA.LV || {});
  // H_UP: köprü yüksekliği, RAMP: bir yandaki rampa boyu, FLAT: kesişimde düz kısım (yarısı),
  // H_W / RAMP_W: yalnızca suyun üstünden geçen alçak köprünün yüksekliği ve rampası,
  // JR: kavşak yarıçapı (şeritler buradan başlar), LO: şerit ofseti, SP: çizgi örnek aralığı
  const C = (LV.C = { H_UP: 1.2, RAMP: 2.4, H_W: 0.55, RAMP_W: 1.4, FLAT: 0.9, JR: 1.05, JJ: 0.45, LO: 0.36, ROAD_W: 1.5, SP: 0.3, BX: 9.5, BZ: 15.5, W: 20, D: 32 });
  // tahta boyutu (bölümler ilerledikçe büyür): W × D metre; yollar kenardan 0,5 m içeride kalır
  LV.setBoard = function (w, d) { C.W = w || 20; C.D = d || 32; C.BX = C.W / 2 - 0.5; C.BZ = C.D / 2 - 0.5; };

  /* ================= çizgi yardımcıları ================= */
  function stroke(id, pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; }
    return { id, pts, cum, len: cum[cum.length - 1], bb: [x0, z0, x1, z1] };
  }
  function idxAt(st, s) {
    const c = st.cum; let lo = 0, hi = c.length - 2;
    if (s <= 0) return 0; if (s >= st.len) return hi;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c[m] <= s) lo = m; else hi = m - 1; }
    return lo;
  }
  function at(st, s) {
    s = RA.clamp(s, 0, st.len);
    const i = idxAt(st, s), a = st.pts[i], b = st.pts[i + 1] || a;
    const L = st.cum[i + 1] - st.cum[i] || 1, t = RA.clamp((s - st.cum[i]) / L, 0, 1);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  }
  function tan(st, s) {
    const i = idxAt(st, RA.clamp(s, 0, st.len - 1e-6)), a = st.pts[i], b = st.pts[i + 1] || a;
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l };
  }
  function nearest(st, x, z) {
    let best = { s: 0, d: 1e9, x: 0, z: 0 };
    for (let i = 0; i < st.pts.length - 1; i++) {
      const a = st.pts[i], b = st.pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9;
      const t = RA.clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1);
      const px = a.x + dx * t, pz = a.z + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { s: st.cum[i] + Math.sqrt(l2) * t, d, x: px, z: pz };
    }
    return best;
  }
  function slicePts(st, s0, s1) {
    const out = [at(st, s0)];
    for (let i = 0; i < st.pts.length; i++) if (st.cum[i] > s0 + 1e-6 && st.cum[i] < s1 - 1e-6) out.push(st.pts[i]);
    out.push(at(st, s1));
    return out;
  }
  function segX(ax, az, bx, bz, cx, cz, dx, dz) {
    const r = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
    if (Math.abs(r) < 1e-12) return null;
    const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / r;
    const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / r;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { t, u };
  }
  function intersections(A, B) {
    const out = [];
    if (A.bb[2] < B.bb[0] || B.bb[2] < A.bb[0] || A.bb[3] < B.bb[1] || B.bb[3] < A.bb[1]) return out;
    for (let i = 0; i < A.pts.length - 1; i++) {
      const a = A.pts[i], b = A.pts[i + 1];
      const ax0 = Math.min(a.x, b.x), ax1 = Math.max(a.x, b.x), az0 = Math.min(a.z, b.z), az1 = Math.max(a.z, b.z);
      for (let j = 0; j < B.pts.length - 1; j++) {
        const c = B.pts[j], d = B.pts[j + 1];
        if (Math.max(c.x, d.x) < ax0 || Math.min(c.x, d.x) > ax1 || Math.max(c.z, d.z) < az0 || Math.min(c.z, d.z) > az1) continue;
        const r = segX(a.x, a.z, b.x, b.z, c.x, c.z, d.x, d.z); if (!r) continue;
        const x = a.x + (b.x - a.x) * r.t, z = a.z + (b.z - a.z) * r.t;
        if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 0.3)) continue;
        out.push({ sa: A.cum[i] + (A.cum[i + 1] - A.cum[i]) * r.t, sb: B.cum[j] + (B.cum[j + 1] - B.cum[j]) * r.u, x, z });
      }
    }
    return out;
  }
  function inPoly(poly, x, z) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1] || 1e-9) + a[0]) c = !c;
    }
    return c;
  }
  const posKey = (x, z) => Math.round(x * 3) + ',' + Math.round(z * 3);
  LV.geo = { stroke, at, tan, nearest, slicePts, intersections, inPoly, posKey, segX };

  /* ================= parmak izini yola çevir ================= */
  // ham noktalar → seyrekleştir, sadeleştir (RDP), yumuşat (Chaikin), eşit aralıkla örnekle
  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const a = pts[0], b = pts[pts.length - 1];
    let dmax = 0, idx = 0;
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1e-9;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i].x - a.x) * dz - (pts[i].z - a.z) * dx) / l; if (d > dmax) { dmax = d; idx = i; } }
    if (dmax <= eps) return [a, b];
    return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
  }
  function chaikin(pts, n) {
    let p = pts;
    for (let k = 0; k < n; k++) {
      if (p.length < 3) return p;
      const q = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        if (i > 0) q.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 });
        if (i < p.length - 2) q.push({ x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
      }
      q.push(p[p.length - 1]);
      p = q;
    }
    return p;
  }
  function resample(pts, sp) {
    const st = stroke(0, pts); const n = Math.max(2, Math.round(st.len / sp) + 1);
    const out = []; for (let i = 0; i < n; i++) out.push(at(st, (st.len * i) / (n - 1)));
    return out;
  }
  // Yol tasarımı gibi: çizgi birkaç düz parçaya indirilir, her köşe çember yayıyla yuvarlanır (yarıçap R_MIN…R_PREF).
  // headDir/tailDir: uç bir binaya bağlıysa yol o uçta binadan dümdüz çıkar. Köşeye yay sığmıyorsa .sharp = true.
  let R_MIN = 1.8, R_PREF = 3.5;
  const STUB = 1.2;
  // moda göre ölçüler: trenler geniş viraj ister; uçaklar geniş taksi yolu (şeritler arası) ve kavşak ister
  const MODE = { road: { R: [1.8, 3.5], LO: 0.36, JR: 1.05 }, rail: { R: [2.6, 5.0], LO: 0.36, JR: 1.05 }, air: { R: [2.0, 4.0], LO: 0.56, JR: 1.3 } };
  LV.setMode = function (m) { const q = MODE[m] || MODE.road; R_MIN = q.R[0]; R_PREF = q.R[1]; C.LO = q.LO; C.JR = q.JR; LV.mode = m; };
  function fillet(V, fixedEnds) {
    // V: köşe noktaları; dönüş: {pts, sharp}
    const n = V.length;
    if (n < 3) return { pts: V.slice(), sharp: false };
    const leg = []; for (let i = 0; i < n - 1; i++) leg.push(Math.hypot(V[i + 1].x - V[i].x, V[i + 1].z - V[i].z));
    const out = [V[0]]; let sharp = false;
    // köşelerin dönüş açıları; aradaki bacak iki köşe arasında ihtiyaca göre paylaşılır
    const TT = [0];
    for (let i = 1; i < n - 1; i++) {
      const d1x = (V[i].x - V[i - 1].x) / leg[i - 1], d1z = (V[i].z - V[i - 1].z) / leg[i - 1];
      const d2x = (V[i + 1].x - V[i].x) / leg[i], d2z = (V[i + 1].z - V[i].z) / leg[i];
      TT.push(Math.tan(Math.atan2(Math.abs(d1x * d2z - d1z * d2x), d1x * d2x + d1z * d2z) / 2));
    }
    TT.push(0);
    const share = (j, side) => { const a = TT[j], b = TT[j + 1]; if (j === 0 || j === n - 2) return leg[j] * 0.95; return leg[j] * (side === 'a' ? a : b) / (a + b || 1); };
    for (let i = 1; i < n - 1; i++) {
      const d1x = (V[i].x - V[i - 1].x) / leg[i - 1], d1z = (V[i].z - V[i - 1].z) / leg[i - 1];
      const d2x = (V[i + 1].x - V[i].x) / leg[i], d2z = (V[i + 1].z - V[i].z) / leg[i];
      const cr = d1x * d2z - d1z * d2x, dt = d1x * d2x + d1z * d2z;
      const th = Math.atan2(Math.abs(cr), dt);
      if (th < 0.02) { out.push(V[i]); continue; }
      const avail = Math.min(share(i - 1, 'b'), share(i, 'a'));
      const tt = Math.tan(th / 2);
      let R = Math.min(R_PREF, avail / tt);
      // yay sığmıyorsa: sığdığı kadar küçük yay (bacaktan taşmaz; U dönüşünde de patlamaz)
      if (R < R_MIN) sharp = true;
      if (!(R > 0.05)) { out.push(V[i]); continue; }
      const t = R * tt;
      const A = { x: V[i].x - d1x * t, z: V[i].z - d1z * t };
      const sg = cr > 0 ? 1 : -1;
      const nx = -d1z * sg, nz = d1x * sg; // dönüş tarafına dik
      const C = { x: A.x + nx * R, z: A.z + nz * R };
      const a0 = Math.atan2(A.z - C.z, A.x - C.x);
      const steps = Math.max(2, Math.ceil((th * R) / 0.15));
      for (let k = 0; k <= steps; k++) { const a = a0 + sg * th * (k / steps); out.push({ x: C.x + Math.cos(a) * R, z: C.z + Math.sin(a) * R }); }
    }
    out.push(V[n - 1]);
    return { pts: out, sharp };
  }
  // firm: ara noktalar (ör. binanın köşesinden dolaşma) korunur; düz yol yedeğine düşülmez
  LV.smoothStroke = function (raw, headDir, tailDir, firm) {
    const thin = [raw[0]];
    for (const p of raw) if (Math.hypot(p.x - thin[thin.length - 1].x, p.z - thin[thin.length - 1].z) > 0.25) thin.push(p);
    if (thin.length < 2 || thin[thin.length - 1] !== raw[raw.length - 1]) thin.push(raw[raw.length - 1]);
    let best = null;
    // önce az sadeleştir; köşeler sığmazsa daha çok sadeleştir (parmak titremesi ve gereksiz kıvrım gider)
    // son çare: iki uç arasında düz yol (yalnızca binadan çıkış kavisleri kalır)
    for (const eps of firm ? [0.35, 0.6, 0.9] : [0.35, 0.6, 0.9, 1.3, 1e9]) {
      let V = rdp(thin, eps);
      // binadan çıkış düzlüğü: sonraki köşeye dönüş için gerektiği kadar uzun (1,2–3,5 m)
      const stubLen = (E, dir, P) => { const vx = P.x - E.x, vz = P.z - E.z, l = Math.hypot(vx, vz) || 1; const th = Math.acos(RA.clamp((vx * dir.x + vz * dir.z) / l, -1, 1)); return RA.clamp(R_MIN * Math.tan(th / 2) * 1.15 + 0.2, STUB, 3.5); };
      if (headDir) { const E = V[0]; const rest = V.slice(1).filter((q) => Math.hypot(q.x - E.x, q.z - E.z) > STUB + 1.0); const L = stubLen(E, headDir, rest[0] || V[V.length - 1]); V = [E, { x: E.x + headDir.x * L, z: E.z + headDir.z * L }].concat(rest.filter((q) => Math.hypot(q.x - E.x, q.z - E.z) > L + 0.8)); }
      if (tailDir) { const E = V[V.length - 1]; const rest = V.slice(0, -1).filter((q) => Math.hypot(q.x - E.x, q.z - E.z) > STUB + 1.0); const L = stubLen(E, tailDir, rest[rest.length - 1] || V[0]); V = rest.filter((q) => Math.hypot(q.x - E.x, q.z - E.z) > L + 0.8).concat([{ x: E.x + tailDir.x * L, z: E.z + tailDir.z * L }, E]); }
      // çok kısa ara bacakları birleştir
      for (let guard = 0; guard < 40 && V.length > 3; guard++) {
        let mi = -1, ml = 1e9;
        for (let i = 1; i < V.length - 2; i++) { if ((headDir && i === 1) || (tailDir && i === V.length - 2)) continue; const l = Math.hypot(V[i + 1].x - V[i].x, V[i + 1].z - V[i].z); if (l < ml) { ml = l; mi = i; } }
        if (mi < 0 || ml > 1.0) break;
        const m = { x: (V[mi].x + V[mi + 1].x) / 2, z: (V[mi].z + V[mi + 1].z) / 2 };
        const keep1 = headDir && mi === 1, keep2 = tailDir && mi + 1 === V.length - 2;
        if (keep1) V.splice(mi + 1, 1); else if (keep2) V.splice(mi, 1); else V.splice(mi, 2, m);
      }
      const r = fillet(V);
      best = r;
      if (!r.sharp) break;
    }
    const pts = resample(best.pts, C.SP);
    pts.sharp = best.sharp;
    return pts;
  };

  /* ================= ağı kur ================= */
  // level: bölüm verisi, strokes: [{id, pts}], choices: {posKey: 'junction'|'bridge'|'tunnel'|'level'}
  // Dönüş: { ok, msg, at, ...ağ } — ok=false ise çizim kurala uymuyor (msg nedenini söyler)
  LV.buildNet = function (level, strokes, choices, opts) {
    opts = opts || {};
    const fail = (msg, x, z) => ({ ok: false, msg, at: x != null ? { x, z } : null });
    const S = strokes.map((s) => stroke(s.id, s.pts));
    const byId = new Map(S.map((s) => [s.id, s]));
    const blds = level.blds || []; // LV.prep ile hazırlanmış binalar (simülasyon aynı nesneleri kullanır)
    const rails = (level.rails || []).map((r, k) => Object.assign(stroke('r' + k, r.pts.map(([x, z]) => ({ x, z }))), { def: r, k }));
    const water = level.water || [];

    // --- düğümler ---
    const nodes = [];
    const newNode = (x, z, kind, extra) => { const n = Object.assign({ id: nodes.length, x, z, kind, arms: [] }, extra || {}); nodes.push(n); return n; };
    const findNode = (x, z, r) => nodes.find((n) => n.kind !== 'b' && Math.hypot(n.x - x, n.z - z) < (r || 0.3));
    const bNodes = blds.map((b) => newNode(b.ex, b.ez, 'b', { bld: b }));

    // her çizginin bölme noktaları
    const splits = new Map(S.map((s) => [s.id, []]));
    const addSplit = (st, s, node, why) => { const L = splits.get(st.id); if (!L.some((q) => Math.abs(q.s - s) < 0.05 && q.node === node)) L.push({ s, node, why }); };

    // --- sınırlar, binalar, su ---
    for (const st of S) {
      if (st.len < 1.2) return fail('Yol çok kısa.', st.pts[0].x, st.pts[0].z);
      for (const p of st.pts) if (Math.abs(p.x) > C.BX + 0.01 || Math.abs(p.z) > C.BZ + 0.01) return fail('Yol tahtanın dışına çıkamaz.', p.x, p.z);
      for (const b of blds) {
        for (let s = 0; s <= st.len; s += 0.3) {
          const p = at(st, s);
          const along = (p.x - b.x) * b.ux + (p.z - b.z) * b.uz, perp = -(p.x - b.x) * b.uz + (p.z - b.z) * b.ux;
          if (Math.abs(along) < b.d / 2 + 0.25 && Math.abs(perp) < b.w / 2 + 0.25) return fail('Yol binanın içinden geçemez.', p.x, p.z);
        }
      }
    }

    // --- uçlar: bina girişi, başka bir yolun üstü (T kavşak) ya da başka yolun ucu ---
    for (const st of S) {
      for (const end of [0, 1]) {
        const s = end ? st.len : 0, p = end ? st.pts[st.pts.length - 1] : st.pts[0];
        const bn = bNodes.find((n) => Math.hypot(n.x - p.x, n.z - p.z) < 0.35);
        if (bn) { addSplit(st, s, bn, 'b'); continue; }
        let node = findNode(p.x, p.z, 0.35);
        if (!node) {
          // başka bir yolun ortasına değiyor mu? (T)
          for (const o of S) {
            if (o === st) continue;
            const q = nearest(o, p.x, p.z);
            if (q.d < 0.12) {
              const sq = q.s < 0.4 ? 0 : q.s > o.len - 0.4 ? o.len : q.s;
              const qp = at(o, sq);
              node = findNode(qp.x, qp.z, 0.35) || newNode(qp.x, qp.z, 'p');
              addSplit(o, sq, node, 't');
              break;
            }
          }
        }
        if (!node) node = newNode(p.x, p.z, 'p');
        addSplit(st, s, node, 'e');
      }
    }

    // --- kendi üstünden geçen yol ---
    for (const st of S) {
      for (let i = 0; i < st.pts.length - 1; i++) for (let j = i + 3; j < st.pts.length - 1; j++) {
        const a = st.pts[i], b = st.pts[i + 1], c = st.pts[j], d = st.pts[j + 1];
        if (segX(a.x, a.z, b.x, b.z, c.x, c.z, d.x, d.z)) return fail('Yol kendi üstünden geçemez.', c.x, c.z);
      }
    }
    // --- dar açıyla kesişen yollar ---
    const angOk = (A, sa, B, sb) => { const ta = tan(A, sa), tb = tan(B, sb); return Math.abs(ta.x * tb.z - ta.z * tb.x) > 0.5; };
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) for (const x of intersections(S[i], S[j])) {
      if (x.sa < 0.2 || x.sa > S[i].len - 0.2 || x.sb < 0.2 || x.sb > S[j].len - 0.2) continue;
      if (!angOk(S[i], x.sa, S[j], x.sb)) return fail('Yollar çok dar açıyla kesişiyor; daha dik kes.', x.x, x.z);
    }
    for (const st of S) for (const r of rails) for (const x of intersections(st, r)) if (!angOk(st, x.sa, r, x.sb)) return fail('Yol rayı çok dar açıyla kesiyor; daha dik kes.', x.x, x.z);
    // --- yol-yol kesişimleri ---
    const crossings = []; // işaretler (dokununca türü değişir)
    const humps = new Map(S.map((s) => [s.id, []])); // köprü yükseltileri: {a, b} düz kısım
    let bridges = 0, tunnels = 0;
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const A = S[i], B = S[j];
      const newer = A.id > B.id ? A : B, older = newer === A ? B : A;
      for (const x of intersections(A, B)) {
        const sa = x.sa, sb = x.sb;
        if (sa < 0.2 || sa > A.len - 0.2 || sb < 0.2 || sb > B.len - 0.2) continue; // uç değmesi yukarıda ele alındı
        const key = posKey(x.x, x.z);
        const type = choices[key] || 'pending';
        crossings.push({ key, x: x.x, z: x.z, type, kind: 'road', ta: tan(A, sa), tb: tan(B, sb) });
        if (type === 'pending') continue; // oyuncu henüz seçmedi: yollar bağlanmaz, köprü de olmaz
        if (type === 'junction') {
          const node = findNode(x.x, x.z, 0.35) || newNode(x.x, x.z, 'p');
          addSplit(A, sa, node, 'x'); addSplit(B, sb, node, 'x');
        } else {
          // köprüde yeni yol, alt geçitte eski yol üstten geçer; choices[key + '^'] bunu tersine çevirir (öbür yolun rampasına yer varsa)
          const flip = !!choices[key + '^'];
          const up = (type === 'bridge') !== flip ? newer : older, dn = up === newer ? older : newer;
          const sUp = up === A ? sa : sb, sDn = dn === A ? sa : sb;
          humps.get(up.id).push({ a: sUp - C.FLAT, b: sUp + C.FLAT, x: x.x, z: x.z, low: { st: dn, s: sDn } });
          if (type === 'bridge') bridges++; else tunnels++;
        }
      }
    }
    // --- su: suyun üstünden geçen yol köprü olur ---
    for (const st of S) {
      let inW = false, a0 = 0;
      for (let s = 0; s <= st.len + 0.001; s += 0.2) {
        const p = at(st, s); const w = water.some((poly) => inPoly(poly, p.x, p.z));
        if (w && !inW) { inW = true; a0 = s; }
        if ((!w || s + 0.2 > st.len) && inW) {
          inW = false;
          if (a0 < 0.3 || s > st.len - 0.3) return fail('Yol suyun içinde bitemez.', p.x, p.z);
          humps.get(st.id).push({ a: a0 - 0.5, b: s + 0.3, x: p.x, z: p.z, water: true }); bridges++;
        }
      }
    }
    // --- dağ: dağın içinden geçen hat tünel olur (bir alt geçit hakkı) ---
    const hills = level.hills || [];
    const strokeTun = new Map(S.map((s) => [s.id, []]));
    for (const st of S) {
      let inH = false, a0 = 0;
      for (let s = 0; s <= st.len + 0.001; s += 0.2) {
        const p = at(st, s); const h = hills.some((poly) => inPoly(poly, p.x, p.z));
        if (h && !inH) { inH = true; a0 = s; }
        if ((!h || s + 0.2 > st.len) && inH) {
          inH = false;
          if (a0 < 1.0 || s > st.len - 1.0) return fail('Hat dağın içinde bitemez.', p.x, p.z);
          strokeTun.get(st.id).push({ a: a0, b: s }); tunnels++;
        }
      }
    }
    for (const c of crossings) if (hills.some((poly) => inPoly(poly, c.x, c.z))) return fail('Dağın içinde hatlar kesişemez.', c.x, c.z);
    // --- demiryolu (ve pist) kesişimleri ---
    const railHumps = rails.map(() => []);
    const gates = []; // hemzemin geçitler
    for (const st of S) for (const r of rails) {
      for (const x of intersections(st, r)) {
        const key = posKey(x.x, x.z);
        // pisti kesen taksi yolu her zaman bekleme çizgisidir (pist ne köprü ne tünel olur)
        const type = r.def.runway ? 'level' : choices[key] || 'pending';
        crossings.push({ key, x: x.x, z: x.z, type, kind: r.def.runway ? 'runway' : 'rail' });
        if (type === 'pending') continue;
        if (type === 'bridge') { humps.get(st.id).push({ a: x.sa - C.FLAT, b: x.sa + C.FLAT, x: x.x, z: x.z }); bridges++; }
        else if (type === 'tunnel') { railHumps[r.k].push({ a: x.sb - C.FLAT, b: x.sb + C.FLAT, x: x.x, z: x.z }); tunnels++; }
        else gates.push({ key, st, s: x.sa, rail: r.k, sr: x.sb, x: x.x, z: x.z, hold: r.def.runway ? 2.1 : 1.0, runway: !!r.def.runway });
      }
    }

    // --- yükseklik profilleri: çakışan köprüler tek viyadük olur ---
    const prof = (list) => {
      list.sort((p, q) => p.a - q.a);
      const out = [];
      for (const h of list) { const last = out[out.length - 1]; if (last && h.a - last.b < 2 * C.RAMP + 0.6) { last.b = Math.max(last.b, h.b); last.items.push(h); } else out.push({ a: h.a, b: h.b, items: [h] }); }
      // yalnızca su geçen köprü alçak ve kısa rampalı olur (kıyıya yakın yoldan da çıkabilsin)
      for (const g of out) { const w = g.items.every((h) => h.water); g.H = w ? C.H_W : C.H_UP; g.r = w ? C.RAMP_W : C.RAMP; }
      return out;
    };
    const elev = (pr) => (s) => {
      let y = 0;
      for (const h of pr) {
        let v = 0;
        if (s >= h.a && s <= h.b) v = 1;
        else if (s > h.a - h.r && s < h.a) v = RA.smooth((s - (h.a - h.r)) / h.r);
        else if (s > h.b && s < h.b + h.r) v = RA.smooth(1 - (s - h.b) / h.r);
        v *= h.H;
        if (v > y) y = v;
      }
      return y;
    };
    const strokeY = new Map(), strokeProf = new Map();
    for (const st of S) {
      const pr = prof(humps.get(st.id));
      strokeProf.set(st.id, pr); strokeY.set(st.id, elev(pr));
      for (const h of pr) {
        if (h.a - h.r < -0.01 || h.b + h.r > st.len + 0.01) { const p = at(st, RA.clamp(h.a, 0, st.len)); return fail('Köprünün iki yanında rampa için yer yok: yolu biraz uzat.', p.x, p.z); }
        for (const sp of splits.get(st.id)) if (sp.s > h.a - h.r - 0.4 && sp.s < h.b + h.r + 0.4) { const p = at(st, sp.s); return fail('Köprü rampasının üstünde kavşak olamaz.', p.x, p.z); }
      }
    }
    for (const st of S) for (const t of strokeTun.get(st.id)) for (const sp of splits.get(st.id)) if (sp.s > t.a - 1.2 && sp.s < t.b + 1.2) { const p = at(st, sp.s); return fail('Dağın içinde makas olamaz.', p.x, p.z); }
    const railY = rails.map((r, k) => {
      const pr = prof(railHumps[k]);
      for (const h of pr) for (const g of gates) if (g.rail === k && g.sr > h.a - h.r - 0.5 && g.sr < h.b + h.r + 0.5) return null;
      return elev(pr);
    });
    if (railY.some((f) => !f)) return fail('Demiryolu köprüsünün rampasında hemzemin geçit olamaz.');
    // alttan geçen yerde öteki yol yerde olmalı
    for (const st of S) for (const h of humps.get(st.id)) {
      if (!h.low) continue;
      if (strokeY.get(h.low.st.id)(h.low.s) > 0.25) return fail('Burada iki köprü üst üste geliyor.', h.x, h.z);
    }
    for (const g of gates) {
      if (strokeY.get(g.st.id)(g.s) > 0.05) return fail('Hemzemin geçit köprü rampasında olamaz.', g.x, g.z);
      for (const sp of splits.get(g.st.id)) if (Math.abs(sp.s - g.s) < (g.runway ? 3.3 : 1.6)) return fail(g.runway ? 'Pist geçişine çok yakın kavşak olamaz.' : 'Hemzemin geçide çok yakın kavşak olamaz.', g.x, g.z);
    }
    for (const st of S) for (const r of rails) for (const x of intersections(st, r)) {
      const yr = railY[r.k](x.sb), yv = strokeY.get(st.id)(x.sa);
      if (Math.abs(yr - yv) > 0.01 && Math.abs(yr - yv) < 0.9) return fail('Yol ile ray burada çarpışıyor.', x.x, x.z);
    }

    // --- üst üste binen yollar ---
    const chk = opts.check == null ? null : new Set([].concat(opts.check));
    for (let i = 0; i < S.length; i++) for (let j = 0; j < S.length; j++) {
      if (i === j) continue;
      const A = S[i], B = S[j];
      if (chk && !chk.has(A.id) && !chk.has(B.id)) continue; // eski yollar zaten denetlendi
      if (A.bb[2] + 2 < B.bb[0] || B.bb[2] + 2 < A.bb[0] || A.bb[3] + 2 < B.bb[1] || B.bb[3] + 2 < A.bb[1]) continue;
      const near = splits.get(A.id).map((sp) => at(A, sp.s));
      for (const c of crossings) near.push(c);
      let bad = 0;
      for (let s = 0.5; s < A.len - 0.5; s += 0.4) {
        const p = at(A, s);
        if (near.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 3.2)) continue; // kesişimin hemen çevresi doğal olarak yakın
        if (nearest(B, p.x, p.z).d < 1.5) { bad++; if (bad >= 2) return fail('Yollar birbirine çok yakın; biraz aralık bırak.', p.x, p.z); }
      }
    }

    // --- kenarlar ---
    const edges = [];
    for (const st of S) {
      const L = splits.get(st.id).sort((p, q) => p.s - q.s);
      for (let k = 0; k < L.length - 1; k++) {
        const p = L[k], q = L[k + 1];
        if (q.s - p.s < 0.05) continue;
        const e = { id: edges.length, st, s0: p.s, s1: q.s, a: p.node, b: q.node, len: q.s - p.s, y: strokeY.get(st.id) };
        edges.push(e);
        const ta = tan(st, Math.min(p.s + 0.3, q.s)), tb = tan(st, Math.max(q.s - 0.3, p.s));
        p.node.arms.push({ e, end: 'a', ang: Math.atan2(ta.z, ta.x) });
        q.node.arms.push({ e, end: 'b', ang: Math.atan2(-tb.z, -tb.x) });
      }
    }
    // kavşağın hemen ötesinde kalan kısa boş uç (ör. yol birleşme noktasını biraz aşmış): kavşağın parçası sayılır
    for (const e of edges) {
      for (const [n, o] of [[e.a, e.b], [e.b, e.a]]) {
        if (n.kind !== 'b' && o.kind !== 'b' && n.arms.length === 1 && o.arms.length >= 3 && e.len < C.JR + 0.9) {
          e.stub = true; n.arms = []; o.arms = o.arms.filter((r) => r.e !== e);
        }
      }
    }
    for (const n of nodes) {
      n.deg = n.arms.length;
      if (n.kind === 'b') { if (n.deg > 1) return fail('Bir binaya tek yol bağlanır; ikinci yolu ilk yola bağla.', n.x, n.z); continue; }
      n.kind = n.deg >= 3 ? 'j' : n.deg === 2 ? 'joint' : n.deg === 1 ? 'end' : 'none';
      if (n.deg >= 3) {
        const a = n.arms.map((r) => r.ang).sort((p, q) => p - q);
        for (let k = 0; k < a.length; k++) { const d = k === a.length - 1 ? a[0] + Math.PI * 2 - a[k] : a[k + 1] - a[k]; if (d < 0.55) return fail('Yollar çok dar açıyla birleşiyor; daha dik bağla.', n.x, n.z); }
        if (n.deg > 5) return fail('Bir kavşakta en çok 5 yol birleşir.', n.x, n.z);
      }
    }
    const trim = (n) => (n.kind === 'j' ? C.JR : n.kind === 'joint' ? C.JJ : 0);
    for (const e of edges) {
      e.ta = trim(e.a); e.tb = trim(e.b);
      if (e.stub) { e.ta = 0; e.tb = 0; continue; }
      if (e.len < e.ta + e.tb + 0.6) { const p = at(e.st, (e.s0 + e.s1) / 2); return fail('Kavşaklar birbirine çok yakın.', p.x, p.z); }
    }
    let len = 0; for (const st of S) len += st.len;
    const usage = { len, bridges, tunnels };
    if (!opts.free) {
      if (len > (level.budget || 1e9) + 0.01) return fail('Asfalt yetmiyor: daha kısa yol çiz ya da bir yolu sil.');
      if (bridges > (level.bridges || 0)) return fail(level.bridges ? 'Köprü hakkın bitti (' + level.bridges + ').' : 'Bu bölümde köprü hakkın yok.');
      if (tunnels > (level.tunnels || 0)) return fail(level.tunnels ? 'Alt geçit hakkın bitti (' + level.tunnels + ').' : 'Bu bölümde alt geçit hakkın yok.');
    }

    // --- şeritler (sağdan gidilir) ---
    const lanes = [];
    for (const e of edges) {
      if (e.stub) continue; // kısa boş uca şerit yok
      const s0 = e.s0 + e.ta, s1 = e.s1 - e.tb;
      const center = new RA.Path(slicePts(e.st, s0, s1));
      for (const dir of [1, -1]) {
        const base = dir > 0 ? center : center.reversed();
        const path = base.offset(C.LO);
        const y = dir > 0 ? (s) => e.y(s0 + (s / path.length) * (s1 - s0)) : (s) => e.y(s1 - (s / path.length) * (s1 - s0));
        const ln = { id: lanes.length, kind: 'lane', e, dir, from: dir > 0 ? e.a : e.b, to: dir > 0 ? e.b : e.a, path, len: path.length, y, gates: [], outs: [] };
        lanes.push(ln);
      }
      e.fwd = lanes[lanes.length - 2]; e.bwd = lanes[lanes.length - 1];
    }
    // hemzemin geçitler şeritlere: geçidin şerit üzerindeki konumu
    for (const g of gates) {
      for (const e of edges) {
        if (e.st !== g.st || g.s < e.s0 || g.s > e.s1) continue;
        const s0 = e.s0 + e.ta, s1 = e.s1 - e.tb, f = (g.s - s0) / (s1 - s0);
        e.fwd.gates.push({ g, s: f * e.fwd.len }); e.bwd.gates.push({ g, s: (1 - f) * e.bwd.len });
      }
    }
    // --- dönüşler (kavşak içi bağlantılar) ---
    const turns = [];
    for (const n of nodes) {
      if (n.kind !== 'j' && n.kind !== 'joint') continue;
      const ins = lanes.filter((l) => l.to === n), outs = lanes.filter((l) => l.from === n);
      n.turns = [];
      for (const a of ins) for (const b of outs) {
        if (a.e === b.e) continue; // U dönüşü yok
        const ea = a.path.at(a.len), ta = a.path.tan(a.len), sb = b.path.at(0), tb = b.path.tan(0);
        const path = new RA.PathBuilder(ea.x, ea.z, Math.atan2(ta.z, ta.x)).to(sb.x, sb.z, Math.atan2(tb.z, tb.x), 0.55).build();
        const t = { id: 't' + turns.length, kind: 'turn', node: n, inL: a, outL: b, path, len: path.length, y: () => 0, conf: [] };
        turns.push(t); n.turns.push(t); a.outs.push(t);
      }
      // çakışan dönüşler (yolları kesişen ya da aynı şeride birleşen)
      const poly = (t) => { const p = []; for (let s = 0; s <= t.len; s += 0.15) p.push(t.path.at(s)); p.push(t.path.at(t.len)); return stroke(0, p); };
      const P = n.turns.map(poly);
      for (let i = 0; i < n.turns.length; i++) for (let j = i + 1; j < n.turns.length; j++) {
        const a = n.turns[i], b = n.turns[j];
        if (a.inL === b.inL) continue;
        let c = a.outL === b.outL;
        if (!c) c = intersections(P[i], P[j]).some((x) => x.sa > 0.1 && x.sb > 0.1 && x.sa < P[i].len - 0.1 && x.sb < P[j].len - 0.1);
        if (c) { a.conf.push(b); b.conf.push(a); }
      }
      // ışık evreleri: karşılıklı kollar aynı evrede yeşil yanar
      if (n.kind === 'j') {
        const arms = n.arms.slice();
        const used = new Set(); n.phases = [];
        for (const r of arms) {
          if (used.has(r)) continue;
          used.add(r);
          const mate = arms.find((o) => !used.has(o) && Math.abs(RA.wrapAngle(o.ang - r.ang - Math.PI)) < 0.6);
          if (mate) used.add(mate);
          n.phases.push(mate ? [r.e.id, mate.e.id] : [r.e.id]);
        }
      }
    }
    // bina şeritleri
    for (const bn of bNodes) {
      bn.out = lanes.find((l) => l.from === bn) || null;
      bn.in = lanes.find((l) => l.to === bn) || null;
    }
    const pending = crossings.filter((c) => c.type === 'pending').length;
    return { ok: true, pending, S, byId, nodes, bNodes, edges, lanes, turns, crossings, gates, rails, railY, strokeY, strokeProf, strokeTun, usage, blds };
  };

  /* ================= rota (Dijkstra): binadan binaya şerit ve dönüş dizisi ================= */
  LV.route = function (net, fromLane, goalNodes, load) {
    if (!fromLane) return null;
    const dist = new Map(), prev = new Map(), done = new Set();
    const q = [[0, fromLane]];
    dist.set(fromLane, 0);
    while (q.length) {
      let bi = 0; for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i;
      const [d, l] = q.splice(bi, 1)[0];
      if (done.has(l)) continue; done.add(l);
      if (goalNodes.includes(l.to)) {
        const segs = [l]; let c = l;
        while (prev.has(c)) { const [t, pl] = prev.get(c); segs.unshift(t); segs.unshift(pl); c = pl; }
        return { segs, cost: d };
      }
      for (const t of l.outs) {
        const nl = t.outL;
        const nd = d + t.len + nl.len + (t.node.kind === 'j' ? 2.2 : 0) + (load ? load(nl) : 0);
        if (nd < (dist.has(nl) ? dist.get(nl) : 1e9)) { dist.set(nl, nd); prev.set(nl, [t, l]); q.push([nd, nl]); }
      }
    }
    return null;
  };
})();
