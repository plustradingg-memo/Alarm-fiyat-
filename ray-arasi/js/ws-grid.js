/* RAY ARASI — Atölye: ızgara veri modeli, çizim/silme kuralları, örnek düzenler */
(function () {
  'use strict';
  const RA = window.RA;
  const WS = (RA.WS = RA.WS || {});

  const DIRS = ['N', 'E', 'S', 'W'];
  const BIT = { N: 1, E: 2, S: 4, W: 8 };
  const DV = { N: { x: 0, z: -1 }, E: { x: 1, z: 0 }, S: { x: 0, z: 1 }, W: { x: -1, z: 0 } };
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const AXIS = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' };
  const FAMILY = { road: 'road', rail: 'rail', taxi: 'air', runway: 'air' };
  Object.assign(WS, { DIRS, BIT, DV, OPP, AXIS, FAMILY, COLS: 8, ROWS: 13, S: 2.0 });

  const ports = (m) => DIRS.filter((d) => m & BIT[d]);
  const count = (m) => ports(m).length;
  const isStraight = (m) => m === (BIT.N | BIT.S) || m === (BIT.E | BIT.W);
  const axisOf = (m) => (m === (BIT.N | BIT.S) ? 'NS' : m === (BIT.E | BIT.W) ? 'EW' : null);
  WS.ports = ports; WS.portCount = count; WS.isStraight = isStraight; WS.axisOf = axisOf;

  class Grid {
    constructor(cols, rows) {
      this.cols = cols || WS.COLS; this.rows = rows || WS.ROWS;
      this.cells = [];
      for (let k = 0; k < this.cols * this.rows; k++) this.cells.push({ pieces: [] });
    }
    inside(i, j) { return i >= 0 && j >= 0 && i < this.cols && j < this.rows; }
    cell(i, j) { return this.inside(i, j) ? this.cells[j * this.cols + i] : null; }
    each(fn) { for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) fn(this.cells[j * this.cols + i], i, j); }
    serialize() {
      const out = [];
      this.each((c, i, j) => c.pieces.forEach((p) => out.push([i, j, p.type, p.m, p.lv, p.ax || ''])));
      return { v: 1, cols: this.cols, rows: this.rows, p: out };
    }
    static load(o) {
      const g = new Grid(o && o.cols, o && o.rows);
      if (o && o.p) o.p.forEach(([i, j, type, m, lv, ax]) => { const c = g.cell(i, j); if (c && c.pieces.length < 2) c.pieces.push({ type, m, lv, ax: ax || undefined }); });
      normalize(g);
      return g;
    }
    clone() { return Grid.load(this.serialize()); }
    isEmpty() { return this.cells.every((c) => !c.pieces.length); }
  }
  WS.Grid = Grid;

  // Komşudaki, aynı aileden ve karşılık gelen kapısı olan parça
  function mate(g, i, j, d, fam) {
    const n = { i: i + DV[d].x, j: j + DV[d].z };
    const c = g.cell(n.i, n.j);
    if (!c) return null;
    for (let k = 0; k < c.pieces.length; k++) { const q = c.pieces[k]; if (FAMILY[q.type] === fam && q.m & BIT[OPP[d]]) return { i: n.i, j: n.j, k, p: q }; }
    return null;
  }
  WS.mate = mate;

  // Köprü/alt geçit parçasının rampaları geçerli mi? (eksen boyunca iki yanda düz, tek parça)
  function elevatedOk(g, i, j, p) {
    const ax = axisOf(p.m);
    if (!ax) return false;
    for (const d of ax === 'NS' ? ['N', 'S'] : ['E', 'W']) {
      const n = { i: i + DV[d].x, j: j + DV[d].z };
      const c = g.cell(n.i, n.j);
      if (!c) return false;
      const q = c.pieces.find((x) => FAMILY[x.type] === FAMILY[p.type] && x.m & BIT[OPP[d]]);
      if (!q || q.type !== p.type) return false;
      if (q.lv === p.lv) continue; // kesintisiz viyadük
      if (q.lv !== 0 || c.pieces.length !== 1 || axisOf(q.m) !== ax) return false;
      // rampanın öbür ucu da yükseltilmiş olamaz (iki yönlü rampa yok)
      const far = { i: n.i + DV[d].x, j: n.j + DV[d].z };
      const fc = g.cell(far.i, far.j);
      if (fc) { const fq = fc.pieces.find((x) => FAMILY[x.type] === FAMILY[p.type] && x.m & BIT[OPP[d]]); if (fq && fq.lv !== 0 && fq.lv !== p.lv) return false; }
    }
    return true;
  }

  // Sarkan kapıları temizle, geçersiz köprüleri kaldır; değişmeyene kadar tekrarla
  function normalize(g) {
    let changed = true, guard = 0;
    while (changed && guard++ < 20) {
      changed = false;
      g.each((c, i, j) => {
        for (let k = c.pieces.length - 1; k >= 0; k--) {
          const p = c.pieces[k];
          const fam = FAMILY[p.type];
          for (const d of ports(p.m)) {
            const ni = i + DV[d].x, nj = j + DV[d].z;
            if (!g.inside(ni, nj)) { if (fam === 'air') { p.m &= ~BIT[d]; changed = true; } continue; }
            if (!mate(g, i, j, d, fam)) { p.m &= ~BIT[d]; changed = true; }
          }
          if (p.lv !== 0 && !elevatedOk(g, i, j, p)) { c.pieces.splice(k, 1); changed = true; continue; }
          if (p.type === 'runway' && p.ax && !(p.m & (p.ax === 'NS' ? BIT.N | BIT.S : BIT.E | BIT.W)) && count(p.m) === 0) { c.pieces.splice(k, 1); changed = true; continue; }
          if (!p.m) { c.pieces.splice(k, 1); changed = true; }
        }
      });
    }
    return g;
  }
  WS.normalize = normalize;

  // Parmak izinden hücre dizisi (dışarıdaki hücreler de olabilir), dik komşuluğa tamamlanmış
  WS.strokeCells = function (pts) {
    const out = [];
    for (const p of pts) {
      if (!out.length) { out.push({ i: p.i, j: p.j }); continue; }
      let last = out[out.length - 1];
      if (last.i === p.i && last.j === p.j) continue;
      // köşegen ya da atlama: önce yatay sonra dikey tamamla
      while (last.i !== p.i || last.j !== p.j) {
        const di = Math.sign(p.i - last.i), dj = Math.sign(p.j - last.j);
        const nx = Math.abs(p.i - last.i) >= Math.abs(p.j - last.j) && di ? { i: last.i + di, j: last.j } : { i: last.i, j: last.j + dj };
        // geri dönüşü (aynı hücreye) kısalt
        if (out.length > 1) { const pv = out[out.length - 2]; if (pv.i === nx.i && pv.j === nx.j) { out.pop(); last = out[out.length - 1]; continue; } }
        out.push(nx); last = nx;
      }
    }
    return out;
  };
  const dirTo = (a, b) => (b.i > a.i ? 'E' : b.i < a.i ? 'W' : b.j > a.j ? 'S' : 'N');

  /* ---------- Çizim ----------
   * type: road | rail | taxi | runway ; style: grade (kavşak) | bridge (köprü) | tunnel (alt geçit)
   * Dönüş: { ok, msg, info } — başarısızsa ızgara değişmez.
   */
  WS.applyStroke = function (grid, seq, type, style) {
    if (type === 'runway') style = 'grade'; // pist her zaman zeminde
    const g = grid.clone();
    const fam = FAMILY[type];
    const inIdx = [];
    seq.forEach((c, k) => { if (g.inside(c.i, c.j)) inIdx.push(k); });
    if (inIdx.length < 1) return { ok: false, msg: '' };
    // her hücre için bu geçişin kapıları
    const steps = [];
    for (const k of inIdx) {
      let m = 0;
      if (k > 0) m |= BIT[dirTo(seq[k], seq[k - 1])];
      if (k < seq.length - 1) m |= BIT[dirTo(seq[k], seq[k + 1])];
      if (fam === 'air') { // havalimanı kenardan dışarı çıkmaz
        for (const d of ports(m)) if (!g.inside(seq[k].i + DV[d].x, seq[k].j + DV[d].z)) m &= ~BIT[d];
      }
      steps.push({ i: seq[k].i, j: seq[k].j, m, end: k === inIdx[0] || k === inIdx[inIdx.length - 1] });
    }
    if (steps.length === 1 && count(steps[0].m) < 1) return { ok: false, msg: '' };
    if (type === 'runway') {
      const sameI = steps.every((s) => s.i === steps[0].i), sameJ = steps.every((s) => s.j === steps[0].j);
      if (!sameI && !sameJ) return { ok: false, msg: 'Pist yalnızca düz bir çizgi olarak çizilir.' };
      if (steps.length < 3) return { ok: false, msg: 'Pist en az üç kare uzunluğunda olmalı.' };
    }
    const runAx = type === 'runway' ? (steps[0].i === steps[steps.length - 1].i ? 'NS' : 'EW') : null;
    let info = '';
    const elevated = [];
    for (const st of steps) {
      const c = g.cell(st.i, st.j);
      const E = c.pieces;
      const straight = isStraight(st.m);
      if (!E.length) { c.pieces.push({ type, m: st.m, lv: 0, ax: runAx || undefined }); continue; }
      const same = E.find((p) => FAMILY[p.type] === fam && p.lv === 0);
      const sep = style !== 'grade' && !st.end && straight;
      if (sep) {
        // köprü / alt geçit: mevcut tek parçanın üstünden ya da altından dik geçiş
        if (E.length !== 1 || E[0].lv !== 0 || !isStraight(E[0].m) || axisOf(E[0].m) === axisOf(st.m)) {
          return { ok: false, msg: (style === 'bridge' ? 'Köprü' : 'Alt geçit') + ' yalnızca düz bir yolun ya da rayın dik üstünden geçer.' };
        }
        if (E[0].type === 'runway' && style === 'bridge') return { ok: false, msg: 'Pistin üstüne köprü kurulamaz; alt geçit kullan.' };
        const lv = style === 'bridge' ? 1 : -1;
        c.pieces.push({ type, m: st.m, lv });
        elevated.push(st);
        continue;
      }
      if (same) {
        if (type === 'rail' && same.type === 'rail' && straight && isStraight(same.m) && axisOf(same.m) !== axisOf(st.m) && E.length === 1 && !st.end) {
          c.pieces.push({ type, m: st.m, lv: 0 }); info = info || 'Raylar hemzemin kesişti (makas yok).';
          continue;
        }
        if (type === 'runway' && same.type !== 'runway') { same.type = 'runway'; same.ax = runAx; }
        if (same.type === 'runway' && type === 'runway' && same.ax && same.ax !== runAx) return { ok: false, msg: 'İki pist aynı karede kesişemez.' };
        same.m |= st.m;
        continue;
      }
      // farklı aileler aynı seviyede karşılaşıyor
      const other = E.find((p) => p.lv === 0);
      if (other && other.type === 'runway' && (type === 'road' || type === 'rail')) {
        if (!straight || st.end || E.length !== 1 || axisOf(st.m) === other.ax) return { ok: false, msg: 'Yol ve ray pisti yalnızca dik açıyla, alt geçitle geçebilir.' };
        c.pieces.push({ type, m: st.m, lv: -1 }); elevated.push(st);
        info = (type === 'road' ? 'Yol' : 'Ray') + ' pistin altından alt geçitle geçti.';
        continue;
      }
      if (type === 'runway') return { ok: false, msg: 'Pist yol ya da ray üstüne çizilemez. Önce o kareyi sil.' };
      if (!straight || st.end || E.length !== 1 || !isStraight(other.m) || axisOf(other.m) === axisOf(st.m)) {
        return { ok: false, msg: 'Hemzemin geçit için düz ve dik bir kesişim gerekir.' };
      }
      c.pieces.push({ type, m: st.m, lv: 0 });
      info = info || (fam === 'rail' || FAMILY[other.type] === 'rail' ? 'Hemzemin geçit kuruldu: bariyerler ve ışıklar otomatik.' : 'Kesişim kuruldu: ışıklar otomatik.');
    }
    // köprü ve alt geçitlerin rampaları geçerli mi?
    for (const st of elevated) {
      const c = g.cell(st.i, st.j);
      const p = c.pieces.find((x) => x.lv !== 0 && x.type === type);
      if (!p || !elevatedOk(g, st.i, st.j, p)) return { ok: false, msg: 'Köprü ve alt geçidin iki yanında rampa için boş, düz birer kare gerekir.' };
    }
    // mevcut köprüler bozuldu mu?
    let broken = false;
    g.each((c, i, j) => c.pieces.forEach((p) => { if (p.lv !== 0 && !elevatedOk(g, i, j, p)) broken = true; }));
    if (broken) return { ok: false, msg: 'Rampaların üzerine kavşak kurulamaz.' };
    normalize(g);
    grid.cells = g.cells;
    return { ok: true, info };
  };

  WS.eraseStroke = function (grid, seq) {
    let n = 0;
    for (const s of seq) { const c = grid.cell(s.i, s.j); if (c && c.pieces.length) { c.pieces = []; n++; } }
    if (n) normalize(grid);
    return n;
  };

  /* ---------- Örnek düzenler ---------- */
  const line = (i0, j0, i1, j1) => { const a = []; const n = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0)); for (let k = 0; k <= n; k++) a.push({ i: i0 + Math.sign(i1 - i0) * k, j: j0 + Math.sign(j1 - j0) * k }); return a; };
  const path = (...pts) => { const a = []; for (let k = 0; k < pts.length - 1; k++) { const l = line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]); a.push(...(k ? l.slice(1) : l)); } return a; };
  WS.templates = {
    road: [
      ['road', 'grade', path([2, -1], [2, 13])],
      ['road', 'grade', path([5, -1], [5, 13])],
      ['road', 'grade', path([-1, 3], [8, 3])],
      ['road', 'grade', path([-1, 7], [4, 7])],
      ['road', 'tunnel', path([4, 7], [8, 7])],
      ['road', 'bridge', path([-1, 10], [5, 10])],
      ['road', 'grade', path([5, 5], [7, 5])],
    ],
    rail: [
      ['rail', 'grade', path([3, -1], [3, 13])],
      ['rail', 'grade', path([3, 2], [6, 2], [6, 9], [3, 9])],
      ['rail', 'grade', path([-1, 5], [5, 5])],
      ['rail', 'bridge', path([5, 5], [8, 5])],
      ['rail', 'grade', path([3, 7], [0, 7])],
      ['road', 'grade', path([-1, 11], [8, 11])],
      ['road', 'bridge', path([8, 3], [4, 3])],
    ],
    air: [
      ['runway', 'grade', path([2, 1], [2, 9])],
      ['taxi', 'grade', path([2, 1], [4, 1], [4, 9], [2, 9])],
      ['taxi', 'grade', path([2, 5], [4, 5])],
      ['taxi', 'grade', path([4, 3], [6, 3])],
      ['taxi', 'grade', path([4, 7], [6, 7])],
      ['taxi', 'grade', path([4, 2], [5, 2])],
      ['road', 'grade', path([-1, 11], [8, 11])],
      ['road', 'grade', path([-1, 4], [8, 4])],
    ],
  };
  // Ray örneğinde yan yol köprüsü bozulmasın diye sıra önemli; örnek yüklenirken uyarılar yok sayılır
  WS.template = function (key) {
    const g = new Grid();
    for (const [type, style, seq] of WS.templates[key] || []) WS.applyStroke(g, seq, type, style);
    return g;
  };
})();
