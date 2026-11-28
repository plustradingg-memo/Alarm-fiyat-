// RAY ARASI — bölüm denetimi (tarayıcısız, Node ile): 3 × 40 bölümün hepsi örnek çözümle kazanılır mı,
// köprüsüz denemesi kaybedilmesi gerekenler kaybediliyor mu, yıldız kapılarına örnek çözümle ulaşılıyor mu?
// Kullanım: node test/bolumler.cjs            (yaklaşık 1–2 dakika)
//           node test/bolumler.cjs rail 101,107   (yalnızca bir set ya da seçili bölümler)
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..', 'js') + path.sep;
const ctx = { console, Math, JSON, setTimeout: () => 0, clearTimeout: () => 0, performance: require('perf_hooks').performance, navigator: { userAgent: 'node', maxTouchPoints: 0 } };
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
const fake2d = () => new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'measureText') return () => ({ width: 10 }); if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) }); if (/^create/.test(k)) return () => ({ addColorStop() {} }); return () => {}; }, set(t, k, v) { t[k] = v; return true; } });
const el = () => ({ style: {}, width: 64, height: 64, classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, querySelector: () => el(), querySelectorAll: () => [], getContext: () => fake2d(), setAttribute() {}, appendChild() {}, dataset: {} });
ctx.document = { createElement: el, getElementById: el, querySelector: el, querySelectorAll: () => [], addEventListener() {}, body: el(), documentElement: el() };
ctx.localStorage = { getItem: (k) => (k === 'rayarasi.dil' ? '"tr"' : null), setItem() {} };
ctx.location = { search: '' };
ctx.matchMedia = () => ({ matches: false, addEventListener() {} });
vm.createContext(ctx);
for (const f of ['vendor/three.min.js', 'core.js', 'dil.js', 'en-arayuz.js', 'en-bolum.js', 'en-atolye.js', 'en-bolumler.js', 'models.js', 'lv-data.js', 'lv-net.js', 'lv-sim.js', 'lv-game.js']) vm.runInContext(fs.readFileSync(R + f, 'utf8'), ctx, { filename: f });
const LV = ctx.RA.LV;

// köprüsüz (hepsi kavşak / makas) denemede kaybedilmesi gereken bölümler: köprü burada gerçekten gerekir
const MUST_LOSE = [3, 4, 9, 10, 14, 30, 32, 17, 36, 18, 19, 104, 106, 115, 120, 126, 137, 204, 211, 219, 224, 232, 238];
function play(id, naive) {
  const def = LV.find(id);
  LV.setMode(def.mode); LV.setBoard(def.board ? def.board[0] : 20, def.board ? def.board[1] : 32);
  const level = LV.prep(def);
  const g = Object.create(LV.Game.prototype);
  Object.assign(g, { level, mode: def.mode, tx: LV.TXT[def.mode], strokes: [], choices: {}, plans: [], nextId: 1, undoStack: [], running: false, view: { buildRoads() {}, sweep() {}, kiss() {}, spots() {}, plans() {} }, hud() {}, toast() {}, flash() {}, onDeliver() {}, onEnd() {}, scene: { add() {}, remove() {} } });
  g.sim = new LV.Sim(g); g.net = LV.buildNet(level, [], {}); g.sim.setup(level, g.net);
  let rejected = 0; const add = g.addStroke.bind(g); g.addStroke = (...q) => { const r = add(...q); if (!r) rejected++; return r; };
  g.playSolution(naive); g.sim.setNet(g.net);
  for (let t = 0; t < 600 && !g.sim.ended; t += 1 / 60) g.sim.update(1 / 60);
  const u = g.net.usage, st = g.sim.stats;
  const stars = g.sim.ended === 'win' ? 1 + (u.len <= def.star2 + 0.01 ? 1 : 0) + (st.peak <= 3 ? 1 : 0) : 0;
  return { ended: g.sim.ended, del: st.delivered, peak: st.peak, len: Math.round(u.len), rejected, stars };
}

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const only = process.argv[2], pick = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const ids = new Set();
for (const set of LV.SETS) {
  if (only && set.mode !== only) continue;
  console.log('\n' + set.name.toLocaleUpperCase('tr-TR') + ' (' + set.levels.length + ' bölüm)');
  ok(set.levels.length === 40, set.name + ': 40 bölüm');
  const gates = LV.GATES_M[set.mode] || {};
  const chs = LV.CHAPTERS_M[set.mode];
  ok(chs.length === 4 && chs[0].from === 1 && chs[3].to === 40 && chs.every((c, i) => !i || c.from === chs[i - 1].to + 1), set.name + ': 4 bölge (' + chs.map((c) => c.name).join(', ') + ')');
  let sum = 0;
  for (const L of set.levels) {
    ok(!ids.has(L.id), set.name + ' ' + L.n + ': kimlik ' + L.id + ' eşsiz'); ids.add(L.id);
    if (pick && !pick.includes(L.id)) continue;
    if (gates[L.n] && !pick) ok(sum >= gates[L.n], set.name + ' ' + L.n + ': yıldız kapısı ' + gates[L.n] + ' — örnek çözümle önceki bölümlerden ' + sum + ' yıldız');
    const a = play(L.id, false);
    sum += a.stars;
    ok(a.ended === 'win' && !a.rejected, set.name + ' ' + L.n + ' (' + L.name + ', ' + (L.board || [20, 32]).join('×') + '): örnek çözüm kazandı — ' + a.del + '/' + L.goal + ', ' + a.len + '/' + L.budget + ' m, en çok ' + a.peak + ' bekleyen, ' + a.stars + '★');
    if (MUST_LOSE.includes(L.id)) { const b = play(L.id, true); ok(b.ended === 'lose', set.name + ' ' + L.n + ': köprüsüz denemede kaybedildi (' + b.del + '/' + L.goal + ')'); }
  }
}
console.log(fails ? '\nSONUÇ: ' + fails + ' kontrol başarısız' : '\nSONUÇ: tüm bölüm kontrolleri geçti');
process.exit(fails ? 1 : 0);
