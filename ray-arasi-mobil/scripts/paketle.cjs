// Oyunu (../ray-arasi) uygulamanın içine gömülecek tek bir HTML'e paketler → oyun/oyun.js
// Bütün CSS, JS ve yazı tipleri içeri gömülür: uygulama çevrimdışı çalışır, dışarıya hiçbir istek göndermez.
// `npm install` sonrası (postinstall) ve EAS derlemesinde kendiliğinden çalışır; elle: npm run paketle
'use strict';
const fs = require('fs'), path = require('path');
const KOK = path.join(__dirname, '..'), OYUN = path.join(KOK, '..', 'ray-arasi'), FONT = path.join(KOK, 'oyun', 'fontlar');
const oku = (f) => fs.readFileSync(path.join(OYUN, f), 'utf8');
let html = oku('index.html');

// web'e özgü satırlar (manifest, simge, dış yazı tipi bağlantıları) atılır
html = html.split('\n').filter((l) => !/rel="(manifest|icon|apple-touch-icon|preconnect)"|fonts\.googleapis\.com|apple-mobile-web-app|mobile-web-app-capable/.test(l)).join('\n');

// yazı tipleri: base64 olarak gömülür
const fontCss = fs.readFileSync(path.join(FONT, 'fontlar.css'), 'utf8').replace(/url\(([\w.-]+\.woff2)\)/g, (_, f) => 'url(data:font/woff2;base64,' + fs.readFileSync(path.join(FONT, f)).toString('base64') + ')');

// stil ve betikler içeri alınır (</script dizisi betiği erken kapatmasın)
let n = 0;
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => { n++; return '<style>\n' + fontCss + '\n' + oku(f) + '\n</style>'; });
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => { n++; return '<script>\n' + oku(f).replace(/<\/script/gi, '<\\/script') + '\n</script>'; });
if (/<(script|link)[^>]+(src|href)="(?!data:)/.test(html)) throw new Error('Gömülmemiş dış dosya kaldı');

// uygulama köprüsü: Android geri tuşu ve arka plana geçiş
const KOPRU = `<script>
(function () {
  // geri tuşu: bölüm ya da atölyedeyken ana ekrana dön, ana ekrandayken uygulamadan çık
  window.__rayGeri = function () {
    var app = window.RA && RA.app;
    if (app && app.state !== 'menu') { app.showMenu(); return; }
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('cik');
  };
  // uygulama arka plana geçince ses durur ve çalışan bölüm duraklatılır
  window.__rayDurum = function (aktif) {
    try { var a = window.RA && RA.audio; if (a && a.ctx) { if (aktif) a.ctx.resume(); else a.ctx.suspend(); } } catch (e) {}
    try { var app = window.RA && RA.app; if (!aktif && app && app.state === 'level' && app.lv && app.lv.running) app.lv.togglePlay(); } catch (e) {}
  };
  // ekran değişince uygulamaya bildir: çentik ve alt çubuk alanı ekranın rengini alır
  function bildir() { if (window.ReactNativeWebView && window.RA && RA.app) window.ReactNativeWebView.postMessage('ekran:' + RA.app.state); }
  function bagla() {
    var app = window.RA && RA.app; if (!app || app.__kopru) return;
    app.__kopru = true;
    ['showMenu', 'openLevel', 'openWorkshop'].forEach(function (k) { var f = app[k]; app[k] = function () { var r = f.apply(app, arguments); bildir(); return r; }; });
    bildir();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bagla); else bagla();
  document.documentElement.classList.add('uygulama');
})();
</script>`;
html = html.replace('</body>', KOPRU + '\n</body>');

const cikti = path.join(KOK, 'oyun', 'oyun.js');
fs.writeFileSync(cikti, '// Kendiliğinden üretilir (scripts/paketle.cjs) — elle düzenleme; kaynak: ../ray-arasi\nexport default ' + JSON.stringify(html) + ';\n');
console.log('Ray Arası paketlendi: ' + n + ' dosya gömüldü, ' + Math.round(html.length / 1024) + ' KB → oyun/oyun.js');
