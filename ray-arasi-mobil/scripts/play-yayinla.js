// Trafik Ustası (Traffic Maestro) Android sürümünü Google Play'e yükler (Google Play Developer API): AAB, sürüm notları, mağaza metni,
// ekran görüntüleri, öne çıkan görsel ve simge (aynıysa dokunulmaz). Metinler: magaza/metinler.json.
// Planet Merge'ün betiğinden uyarlandı (plustradingg-memo/9-Kas-m-, gezegen-ios/scripts/play-yayinla.js).
// Hizmet hesabı anahtarı her çalışmada Expo'dan okunur (scripts/play.js), diske yazılmaz.
// Not: Google, yeni bir uygulamanın İLK sürümünü yalnızca Play Console'dan elle yüklemeye izin verir.
//
//   NODE_USE_ENV_PROXY=1 node scripts/play-yayinla.js --aab <dosya.aab> --kanal internal|alpha|production [--gorselsiz] [--deneme]
//   NODE_USE_ENV_PROXY=1 node scripts/play-yayinla.js --surum-kodu 2 --kanal alpha                 (yüklenmiş sürümü kanala taşı)
//   NODE_USE_ENV_PROXY=1 node scripts/play-yayinla.js --yalniz-sayfa [--gorselsiz] [--deneme]   (AAB yok: yalnızca mağaza sayfası)
//
// --kanal         internal = dahili test, alpha = kapalı test, production = üretim (herkes)
// --surum-kodu N  AAB yüklemeden, daha önce yüklenmiş N sürüm kodunu kanala koyar (ör. dahili testten kapalı teste)
// --yalniz-sayfa  derleme yüklemeden yalnızca metinleri ve görselleri günceller
// --deneme        her şeyi hazırla, sonunda kaydetme (düzenleme atılır)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PKG = require(path.join(ROOT, 'app.json')).expo.android.package;
const UP = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/';
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'magaza', 'metinler.json'), 'utf8'));
const arg = (k) => process.argv.includes(k);
const val = (k) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const SHOT_RE = /^(\d+)-.+\.(png|jpe?g)$/i;
const mime = (f) => (/\.png$/i.test(f) ? 'image/png' : 'image/jpeg');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

(async () => {
  const AAB = val('--aab');
  const TRACK = val('--kanal');
  const ONLY_PAGE = arg('--yalniz-sayfa');
  const CODE = val('--surum-kodu');
  if (!ONLY_PAGE && ((!AAB && !CODE) || !TRACK)) throw new Error('--aab (ya da --surum-kodu) ve --kanal gerekli (ya da --yalniz-sayfa)');
  const play = await require('./play')();
  const e = await play.edit(PKG);
  try {
    // 1) mağaza metni (önce: sürüm notları yalnızca sayfası olan dillerde yazılabilir)
    for (const [lang, t] of Object.entries(M.play || {})) {
      await e.put(`listings/${lang}`, { language: lang, ...t });
      log('mağaza metni güncellendi:', lang);
    }
    const langs = ((await e.get('listings')).listings || []).map((l) => l.language);

    // 2) AAB, kanal ve sürüm notları
    if (!ONLY_PAGE) {
      let vc;
      if (AAB) {
        const up = await play.call('POST', `${UP}${PKG}/edits/${e.id}/bundles?uploadType=media`, fs.readFileSync(AAB), 'application/octet-stream');
        vc = String(up.versionCode);
        log('AAB yüklendi, sürüm kodu', vc);
      } else {
        vc = String(CODE);
        const known = ((await e.get('bundles')).bundles || []).map((b) => String(b.versionCode));
        if (!known.includes(vc)) throw new Error(`sürüm kodu ${vc} Play'de yüklü değil (yüklü: ${known.join(', ') || 'yok'})`);
        log('yüklü sürüm kanala taşınıyor, sürüm kodu', vc);
      }
      const releaseNotes = [];
      for (const lang of langs) {
        const text = M.android_yenilikler[lang.startsWith('tr') ? 'tr' : 'en'];
        if (text.length > 500) throw new Error(`sürüm notu 500 harften uzun (${lang})`);
        releaseNotes.push({ language: lang, text });
      }
      const release = (status) => ({ track: TRACK, releases: [{ name: `${vc} (${M.surum})`, versionCodes: [vc], status, releaseNotes }] });
      try {
        await play.call('PUT', `${PKG}/edits/${e.id}/tracks/${TRACK}`, release('completed'));
      } catch (err) {
        // Henüz yayınlanmamış (taslak) uygulamada Google yalnızca taslak sürüme izin verir
        if (!/draft/i.test(err.message)) throw err;
        await play.call('PUT', `${PKG}/edits/${e.id}/tracks/${TRACK}`, release('draft'));
        log('uygulama henüz taslak: sürüm taslak olarak kaydedildi');
      }
      log('kanal', TRACK, '→', vc);
    }

    // 3) ekran görüntüleri, öne çıkan görsel ve simge (aynıysa dokunulmaz)
    if (!arg('--gorselsiz')) {
      for (const [lang, rel] of Object.entries(M.gorseller.play)) {
        const dir = path.join(ROOT, rel);
        const files = fs.readdirSync(dir).filter((f) => SHOT_RE.test(f)).sort((a, b) => Number(a.match(SHOT_RE)[1]) - Number(b.match(SHOT_RE)[1]));
        const sums = files.map((f) => sha(path.join(dir, f)));
        const cur = ((await e.get(`listings/${lang}/phoneScreenshots`)).images || []).map((i) => i.sha256);
        if (cur.join() !== sums.join()) {
          await play.call('DELETE', `${PKG}/edits/${e.id}/listings/${lang}/phoneScreenshots`);
          for (const f of files) await play.call('POST', `${UP}${PKG}/edits/${e.id}/listings/${lang}/phoneScreenshots?uploadType=media`, fs.readFileSync(path.join(dir, f)), mime(f));
          log('ekran görüntüleri yüklendi:', lang, files.length);
        } else log('ekran görüntüleri zaten güncel:', lang);
        const dilli = (v) => (v && typeof v === 'object' ? v[lang] : v); // dile göre ayrı görsel olabilir
        for (const [kind, rel2] of [['featureGraphic', dilli(M.gorseller.play_one_cikan)], ['icon', dilli(M.gorseller.play_simge)]]) {
          if (!rel2) continue;
          const f = path.join(ROOT, rel2);
          const curImg = ((await e.get(`listings/${lang}/${kind}`)).images || []).map((i) => i.sha256);
          if (curImg.join() === sha(f)) continue;
          await play.call('DELETE', `${PKG}/edits/${e.id}/listings/${lang}/${kind}`);
          await play.call('POST', `${UP}${PKG}/edits/${e.id}/listings/${lang}/${kind}?uploadType=media`, fs.readFileSync(f), mime(f));
          log(kind === 'icon' ? 'simge yüklendi:' : 'öne çıkan görsel yüklendi:', lang);
        }
      }
    }

    // 4) kaydet (Google incelemesine gider)
    if (arg('--deneme')) {
      await e.discard();
      log('deneme: hiçbir şey kaydedilmedi');
      return;
    }
    await e.commit();
    log('kaydedildi: Google Play incelemesine gönderildi');
  } catch (err) {
    await e.discard().catch(() => {});
    throw err;
  }
})().catch((err) => {
  console.error('HATA', err.message);
  process.exit(1);
});
