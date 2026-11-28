// Trafik Ustası (Traffic Maestro) iPhone sürümünü App Store'da yayına hazırlar ve incelemeye gönderir (App Store Connect API).
// Planet Merge'ün betiğinden uyarlandı (plustradingg-memo/9-Kas-m-, gezegen-ios/scripts/ios-yayinla.js).
// Metinler: magaza/metinler.json. Önce derleme EAS'ta yapılıp App Store Connect'e yüklenmiş olmalı (eas submit).
// Anahtar her çalışmada Expo'dan okunur (scripts/asc.js), diske yazılmaz.
//
//   NODE_USE_ENV_PROXY=1 node scripts/ios-yayinla.js --build 3 [--incelemedekini-degistir] [--gorselsiz] [--gonderme]
//   NODE_USE_ENV_PROXY=1 node scripts/ios-yayinla.js --yalniz-sayfa [--gorselsiz]   (derlemesiz: sayfa, ayarlar, görseller)
//
// --build N                    App Store Connect'e yüklenmiş derleme numarası (işlenmesi bitene kadar beklenir)
// --incelemedekini-degistir    İncelemede bekleyen eski sürüm varsa incelemeden çekilir, numarası bu sürüme çevrilir
// --gorselsiz                  Ekran görüntülerine dokunma
// --gonderme                   Her şeyi hazırla ama incelemeye gönderme
// --iletisim-kaynak PAKET      İnceleme iletişim bilgisi yoksa sahibinin başka bir uygulamasından yalnızca okunur
//
// İlk sürümde (ve eksik kaldıkça) şunlar da kurulur: telif, kategori, yaş derecelendirmesi, içerik hakları, ücretsiz
// fiyat, ülkeler (ios_ayarlar.haricUlkeler dışında hepsi), inceleme notu. İnceleme iletişim bilgisi bir kez verilir (INCELEME_AD, INCELEME_SOYAD,
// INCELEME_TEL, INCELEME_EPOSTA ortam değişkenleri; depoya yazılmaz); sonraki sürümler öncekinden kopyalar.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const BUNDLE = require(path.join(ROOT, 'app.json')).expo.ios.bundleIdentifier;
const SHOT_TYPE = 'APP_IPHONE_67'; // 6,9" / 6,7" ekran (1320 × 2868)
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'magaza', 'metinler.json'), 'utf8'));
const arg = (k) => process.argv.includes(k);
const val = (k) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const EDITABLE = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];
const SHOT_RE = /^(\d+)-.+\.(png|jpe?g)$/i;

// Apple'ın tanımadığı bir alan olursa o alanı atlayıp yeniden dener (API sürümleri arasında yaş soruları değişebiliyor)
async function patchTolerant(asc, url, type, id, attributes) {
  let attrs = { ...attributes };
  for (let i = 0; i < 12; i++) {
    try {
      return await asc.patch(url, { data: { type, id, attributes: attrs } });
    } catch (e) {
      // Apple yeni bir soru eklediyse (ör. socialMedia) "hayır" yanıtıyla eklenir
      const need = /provide a value for the attribute '(\w+)'/.exec(e.message);
      if (need && !(need[1] in attrs)) { attrs[need[1]] = false; log('  yeni yaş sorusu "hayır" yanıtıyla eklendi:', need[1]); continue; }
      const bad = Object.keys(attrs).find((k) => e.message.includes(`'${k}'`) || e.message.includes(`/${k}`) || e.message.includes(` ${k} `));
      if (!bad) throw e;
      log('  Apple bu alanı kabul etmedi, atlandı:', bad);
      delete attrs[bad];
    }
  }
}

(async () => {
  const BUILD = val('--build');
  const ONLY_PAGE = arg('--yalniz-sayfa'); // derleme olmadan sayfayı hazırla (metinler, görseller, ayarlar)
  if (!BUILD && !ONLY_PAGE) throw new Error('--build gerekli (ya da --yalniz-sayfa)');
  const asc = await require('./asc')();
  const app = (await asc.get(`/v1/apps?filter[bundleId]=${BUNDLE}`)).data[0];
  if (!app) throw new Error(`App Store Connect'te ${BUNDLE} için uygulama kaydı yok (kayıt yalnızca App Store Connect sitesinden açılabilir)`);
  log('uygulama', app.attributes.name, app.id);

  // 1) derleme işlenene kadar bekle
  let build;
  for (let i = 0; i < 90 && BUILD; i++) {
    const r = await asc.get(`/v1/builds?filter[app]=${app.id}&filter[version]=${BUILD}&filter[preReleaseVersion.version]=${M.surum}&fields[builds]=version,processingState`);
    build = r.data[0];
    if (build && build.attributes.processingState === 'VALID') break;
    if (build && ['FAILED', 'INVALID'].includes(build.attributes.processingState)) throw new Error('derleme işlenemedi: ' + build.attributes.processingState);
    if (i === 0) log('derleme', BUILD, build ? build.attributes.processingState : 'henüz görünmüyor', '— bekleniyor');
    await sleep(60000);
  }
  if (BUILD && (!build || build.attributes.processingState !== 'VALID')) throw new Error('derleme 90 dakikada hazır olmadı');
  if (BUILD) log('derleme hazır', BUILD);

  // 2) düzenlenebilir sürüm (gerekirse incelemedekini geri çek)
  const versions = async () => (await asc.get(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10&fields[appStoreVersions]=versionString,appStoreState,createdDate`)).data;
  let vs = await versions();
  const firstRelease = !vs.some((v) => ['READY_FOR_SALE', 'REPLACED_WITH_NEW_VERSION', 'REMOVED_FROM_SALE', 'DEVELOPER_REMOVED_FROM_SALE'].includes(v.attributes.appStoreState));
  let ver = vs.find((v) => EDITABLE.includes(v.attributes.appStoreState));
  const waiting = vs.find((v) => v.attributes.appStoreState === 'WAITING_FOR_REVIEW');
  if (!ver && waiting) {
    if (!arg('--incelemedekini-degistir')) throw new Error(`${waiting.attributes.versionString} incelemede bekliyor; değiştirmek için --incelemedekini-degistir`);
    const subs = (await asc.get(`/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=WAITING_FOR_REVIEW`)).data;
    for (const s of subs) {
      await asc.patch(`/v1/reviewSubmissions/${s.id}`, { data: { type: 'reviewSubmissions', id: s.id, attributes: { canceled: true } } });
      log('incelemeden çekildi:', waiting.attributes.versionString);
    }
    for (let i = 0; i < 30 && !ver; i++) {
      await sleep(10000);
      vs = await versions();
      ver = vs.find((v) => v.id === waiting.id && EDITABLE.includes(v.attributes.appStoreState));
    }
    if (!ver) throw new Error('geri çekilen sürüm düzenlenebilir olmadı');
  }
  if (!ver) {
    ver = (await asc.post('/v1/appStoreVersions', { data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: M.surum }, relationships: { app: { data: { type: 'apps', id: app.id } } } } })).data;
    log('yeni sürüm açıldı', M.surum);
  } else if (ver.attributes.versionString !== M.surum) {
    await asc.patch(`/v1/appStoreVersions/${ver.id}`, { data: { type: 'appStoreVersions', id: ver.id, attributes: { versionString: M.surum } } });
    log('sürüm numarası', ver.attributes.versionString, '→', M.surum);
  }
  if (build) {
    await asc.patch(`/v1/appStoreVersions/${ver.id}/relationships/build`, { data: { type: 'builds', id: build.id } });
    log('derleme sürüme bağlandı');
  }
  // Onaylanınca kendiliğinden yayına girsin; telif satırı
  const A = M.ios_ayarlar || {};
  await asc.patch(`/v1/appStoreVersions/${ver.id}`, { data: { type: 'appStoreVersions', id: ver.id, attributes: { releaseType: 'AFTER_APPROVAL', ...(A.telif ? { copyright: A.telif } : {}) } } });
  log('onaylanınca otomatik yayın: açık');

  // 3) uygulama bilgisi: ad, alt başlık, gizlilik adresi; kategori ve yaş derecelendirmesi
  const infos = (await asc.get(`/v1/apps/${app.id}/appInfos`)).data;
  const info = infos.find((i) => (i.attributes.state || i.attributes.appStoreState) !== 'READY_FOR_DISTRIBUTION') || infos[0];
  if (info && M.ios_bilgi) {
    const ilocs = (await asc.get(`/v1/appInfos/${info.id}/appInfoLocalizations`)).data;
    for (const [locale, t] of Object.entries(M.ios_bilgi)) {
      const l = ilocs.find((x) => x.attributes.locale === locale);
      if (!l) {
        // yeni dil (ör. İngilizce): mağaza sayfası o dilde de açılır
        await asc.post('/v1/appInfoLocalizations', { data: { type: 'appInfoLocalizations', attributes: { locale, ...t }, relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } } } });
        log('uygulama bilgisine dil eklendi:', locale);
        continue;
      }
      const diff = Object.fromEntries(Object.entries(t).filter(([k, v]) => l.attributes[k] !== v));
      if (!Object.keys(diff).length) continue;
      await asc.patch(`/v1/appInfoLocalizations/${l.id}`, { data: { type: 'appInfoLocalizations', id: l.id, attributes: diff } });
      log('uygulama bilgisi güncellendi:', locale, Object.keys(diff).join(', '));
    }
  }
  if (info && A.kategori) {
    const K = A.kategori, rel = (id) => (id ? { data: { type: 'appCategories', id } } : undefined);
    const relationships = Object.fromEntries(Object.entries({ primaryCategory: rel(K.birincil), primarySubcategoryOne: rel(K.alt1), primarySubcategoryTwo: rel(K.alt2), secondaryCategory: rel(K.ikincil) }).filter(([, v]) => v));
    try {
      await asc.patch(`/v1/appInfos/${info.id}`, { data: { type: 'appInfos', id: info.id, relationships } });
      log('kategori:', [K.birincil, K.alt1, K.alt2, K.ikincil].filter(Boolean).join(', '));
    } catch (e) { log('UYARI: kategori ayarlanamadı:', e.message); }
  }
  if (info && A.yas) {
    try {
      const decl = (await asc.get(`/v1/appInfos/${info.id}/ageRatingDeclaration`)).data;
      await patchTolerant(asc, `/v1/ageRatingDeclarations/${decl.id}`, 'ageRatingDeclarations', decl.id, A.yas);
      log('yaş derecelendirmesi: bütün sorular "yok / hayır"');
    } catch (e) { log('UYARI: yaş derecelendirmesi ayarlanamadı:', e.message); }
  }
  if (A.icerikHaklari && app.attributes.contentRightsDeclaration !== A.icerikHaklari) {
    try {
      await asc.patch(`/v1/apps/${app.id}`, { data: { type: 'apps', id: app.id, attributes: { contentRightsDeclaration: A.icerikHaklari } } });
      log('içerik hakları beyanı:', A.icerikHaklari);
    } catch (e) { log('UYARI: içerik hakları beyanı yapılamadı:', e.message); }
  }

  // 4) fiyat (ücretsiz) ve ülkeler (hariç tutulanlar dışında hepsi) — yalnızca daha önce ayarlanmadıysa
  let fiyatVar = false;
  try {
    const ps = await asc.get(`/v1/apps/${app.id}/appPriceSchedule?include=manualPrices`);
    fiyatVar = (ps.included || []).some((x) => x.type === 'appPrices'); // takvim boş da dönebiliyor
  } catch (e) { if (!/404/.test(e.message)) throw e; }
  if (fiyatVar) log('fiyat zaten ayarlı');
  else {
    const free = (await asc.get(`/v1/apps/${app.id}/appPricePoints?filter[territory]=USA&limit=200`)).data.find((p) => Number(p.attributes.customerPrice) === 0);
    if (!free) throw new Error('ücretsiz fiyat noktası bulunamadı');
    await asc.post('/v1/appPriceSchedules', {
      data: { type: 'appPriceSchedules', relationships: { app: { data: { type: 'apps', id: app.id } }, baseTerritory: { data: { type: 'territories', id: 'USA' } }, manualPrices: { data: [{ type: 'appPrices', id: '${ucretsiz}' }] } } },
      included: [{ type: 'appPrices', id: '${ucretsiz}', attributes: { startDate: null }, relationships: { appPricePoint: { data: { type: 'appPricePoints', id: free.id } } } }],
    });
    log('fiyat: ücretsiz');
  }
  // Satışa kapalı ülkeler (metinler.json → ios_ayarlar.haricUlkeler). Çin anakarası: oyun lisansı ve ek belgeler ister.
  const haric = new Set(A.haricUlkeler || []);
  let av = null;
  try {
    av = (await asc.get(`/v1/apps/${app.id}/appAvailabilityV2`)).data;
  } catch (e) { if (!/404/.test(e.message)) throw e; }
  if (av) {
    let next = `/v2/appAvailabilities/${av.id}/territoryAvailabilities?include=territory&limit=200`;
    const mevcut = [];
    while (next) { const r = await asc.get(next); mevcut.push(...r.data); next = r.links && r.links.next; }
    for (const t of mevcut) {
      const id = (t.relationships.territory.data || {}).id;
      if (haric.has(id) && t.attributes.available) {
        await asc.patch(`/v1/territoryAvailabilities/${t.id}`, { data: { type: 'territoryAvailabilities', id: t.id, attributes: { available: false } } });
        log('satıştan çıkarıldı:', id);
      }
    }
    log('ülkeler zaten ayarlı' + (haric.size ? ` (hariç: ${[...haric].join(', ')})` : ''));
  } else {
    const terr = [];
    let next = '/v1/territories?limit=200';
    while (next) { const r = await asc.get(next); terr.push(...r.data); next = r.links && r.links.next; }
    await asc.post('/v2/appAvailabilities', {
      data: { type: 'appAvailabilities', attributes: { availableInNewTerritories: true }, relationships: { app: { data: { type: 'apps', id: app.id } }, territoryAvailabilities: { data: terr.map((t) => ({ type: 'territoryAvailabilities', id: '${' + t.id + '}' })) } } },
      included: terr.map((t) => ({ type: 'territoryAvailabilities', id: '${' + t.id + '}', attributes: { available: !haric.has(t.id) }, relationships: { territory: { data: { type: 'territories', id: t.id } } } })),
    });
    log(`ülkeler: ${terr.length - haric.size} / ${terr.length}` + (haric.size ? ` (hariç: ${[...haric].join(', ')})` : ''));
  }

  // 5) inceleme bilgisi: iletişim + not (iletişim ilk seferde ortam değişkeninden, sonra önceki sürümden)
  let rd = null;
  try { rd = (await asc.get(`/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`)).data; } catch (e) { if (!/404/.test(e.message)) throw e; }
  let contact = { contactFirstName: process.env.INCELEME_AD, contactLastName: process.env.INCELEME_SOYAD, contactPhone: process.env.INCELEME_TEL, contactEmail: process.env.INCELEME_EPOSTA };
  const copyFrom = async (versionList) => {
    for (const v of versionList) {
      try {
        const p = (await asc.get(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`)).data;
        if (p && p.attributes.contactEmail) return Object.fromEntries(Object.keys(contact).map((k) => [k, p.attributes[k]]));
      } catch (e) { /* bu sürümde inceleme bilgisi yok */ }
    }
    return null;
  };
  if (!contact.contactEmail) contact = (await copyFrom(vs.filter((x) => x.id !== ver.id))) || contact;
  // Sahibinin izniyle (28 Kasım 2026) ilk sürümde iletişim bilgisi başka bir uygulamasından YALNIZCA OKUNUR:
  // --iletisim-kaynak <paket-kimliği>. O uygulamada hiçbir şey değiştirilmez; bilgi ekrana yazılmaz.
  const src = val('--iletisim-kaynak');
  if (!contact.contactEmail && src) {
    const other = (await asc.get(`/v1/apps?filter[bundleId]=${src}`)).data[0];
    if (other) {
      const ovs = (await asc.get(`/v1/apps/${other.id}/appStoreVersions?filter[platform]=IOS&limit=10&fields[appStoreVersions]=versionString`)).data;
      contact = (await copyFrom(ovs)) || contact;
    }
    log('inceleme iletişim bilgisi kaynağı:', src, contact.contactEmail ? '(okundu)' : '(bulunamadı)');
  }
  const have = rd && rd.attributes;
  const want = { ...(have && have.contactEmail ? {} : Object.fromEntries(Object.entries(contact).filter(([, v]) => v))), demoAccountRequired: false, notes: A.incelemeNotu };
  if (rd) await asc.patch(`/v1/appStoreReviewDetails/${rd.id}`, { data: { type: 'appStoreReviewDetails', id: rd.id, attributes: want } });
  else await asc.post('/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes: want, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
  log('inceleme bilgisi:', (have && have.contactEmail) || contact.contactEmail ? 'iletişim var' : 'UYARI: iletişim bilgisi eksik', '+ not');

  // 6) metinler ("Yenilikler" ilk sürümde Apple'a gönderilemez)
  const locs = (await asc.get(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)).data;
  for (const [locale, t] of Object.entries(M.ios)) {
    let loc = locs.find((l) => l.attributes.locale === locale);
    if (!loc) {
      loc = (await asc.post('/v1/appStoreVersionLocalizations', { data: { type: 'appStoreVersionLocalizations', attributes: { locale }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } })).data;
      log('dil eklendi:', locale);
    }
    const whatsNew = M.yenilikler[locale.startsWith('tr') ? 'tr' : 'en'];
    await asc.patch(`/v1/appStoreVersionLocalizations/${loc.id}`, { data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { ...t, ...(firstRelease ? {} : { whatsNew }) } } });
    log('metinler güncellendi:', locale, firstRelease ? '(ilk sürüm: "Yenilikler" yok)' : '');

    // 7) ekran görüntüleri (aynıysa dokunulmaz)
    if (arg('--gorselsiz')) continue;
    const dir = path.join(ROOT, M.gorseller.ios[locale] || '-');
    if (!M.gorseller.ios[locale] || !fs.existsSync(dir)) { log('ekran görüntüsü klasörü yok, atlandı:', locale); continue; }
    const files = fs.readdirSync(dir).filter((f) => SHOT_RE.test(f)).sort((a, b) => Number(a.match(SHOT_RE)[1]) - Number(b.match(SHOT_RE)[1]));
    const md5s = files.map((f) => crypto.createHash('md5').update(fs.readFileSync(path.join(dir, f))).digest('hex'));
    const sets = (await asc.get(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`)).data;
    let set = sets.find((s) => s.attributes.screenshotDisplayType === SHOT_TYPE);
    if (!set) set = (await asc.post('/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: SHOT_TYPE }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } } })).data;
    const cur = (await asc.get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data;
    if (cur.map((s) => s.attributes.sourceFileChecksum).join() === md5s.join()) {
      log('ekran görüntüleri zaten güncel:', locale);
      continue;
    }
    const upload = async (i) => {
      const buf = fs.readFileSync(path.join(dir, files[i]));
      const shot = (await asc.post('/v1/appScreenshots', { data: { type: 'appScreenshots', attributes: { fileName: files[i], fileSize: buf.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } })).data;
      try {
        for (const op of shot.attributes.uploadOperations) {
          const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
          const r = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
          if (!r.ok) throw new Error(`görsel yüklenemedi (${new URL(op.url).host}): ${r.status}`);
        }
      } catch (err) {
        await asc.del(`/v1/appScreenshots/${shot.id}`).catch(() => {});
        throw new Error(`${err.message}${err.cause ? ' ' + err.cause.message : ''} [adres: ${new URL(shot.attributes.uploadOperations[0].url).host}]`);
      }
      await asc.patch(`/v1/appScreenshots/${shot.id}`, { data: { type: 'appScreenshots', id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5s[i] } } });
    };
    // Önce ilki denenir: yükleme yapılamazsa eski görseller yerinde kalır
    try {
      await upload(0);
    } catch (err) {
      log('UYARI: ekran görüntüleri yüklenemedi, eskileri kaldı:', locale, err.message);
      continue;
    }
    for (const s of cur) await asc.del(`/v1/appScreenshots/${s.id}`);
    for (let i = 1; i < files.length; i++) await upload(i);
    for (let i = 0; i < 30; i++) {
      const st = (await asc.get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data.map((s) => s.attributes.assetDeliveryState && s.attributes.assetDeliveryState.state);
      if (st.every((x) => x === 'COMPLETE')) break;
      if (st.some((x) => x === 'FAILED')) throw new Error('Apple bir ekran görüntüsünü kabul etmedi: ' + locale);
      await sleep(5000);
    }
    log('ekran görüntüleri yüklendi:', locale, files.length);
  }

  // 8) incelemeye gönder
  if (arg('--gonderme') || ONLY_PAGE) {
    log('hazır; incelemeye gönderilmedi (--gonderme)');
    return;
  }
  // Apple bilgi istediyse ya da reddettiyse gönderim "UNRESOLVED_ISSUES" durumunda kalır: aynı gönderim yeniden gönderilir
  let sub = (await asc.get(`/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=UNRESOLVED_ISSUES,READY_FOR_REVIEW&filter[platform]=IOS`)).data[0];
  if (sub) log('açık gönderim kullanılıyor:', sub.attributes.state);
  if (!sub) sub = (await asc.post('/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: app.id } } } } })).data;
  const items = (await asc.get(`/v1/reviewSubmissions/${sub.id}/items`)).data;
  if (!items.length) await asc.post('/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
  await asc.patch(`/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } });
  vs = await versions();
  log('incelemeye gönderildi:', M.surum, '→', vs.find((v) => v.id === ver.id).attributes.appStoreState);
})().catch((e) => {
  console.error('HATA', e.message);
  process.exit(1);
});
