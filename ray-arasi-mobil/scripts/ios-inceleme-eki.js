// App Store incelemesine dosya ekler (ör. Apple'ın istediği ekran kaydı): App Review Information → Attachment.
// Yükleme Apple'ın verdiği parçalara bölünerek yapılır; anahtar her çalışmada Expo'dan okunur (scripts/asc.js).
//
//   NODE_USE_ENV_PROXY=1 node scripts/ios-inceleme-eki.js <dosya.mp4|mov|png|pdf> [--surum 1.0.0]
//   NODE_USE_ENV_PROXY=1 node scripts/ios-inceleme-eki.js --liste                 (ekli dosyaları göster)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const BUNDLE = require(path.join(ROOT, 'app.json')).expo.ios.bundleIdentifier;
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'magaza', 'metinler.json'), 'utf8'));
const val = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

(async () => {
  const asc = await require('./asc')();
  const surum = val('--surum') || M.surum;
  const app = (await asc.get(`/v1/apps?filter[bundleId]=${BUNDLE}`)).data[0];
  if (!app) throw new Error('uygulama bulunamadı: ' + BUNDLE);
  const ver = (await asc.get(`/v1/apps/${app.id}/appStoreVersions?filter[versionString]=${surum}&filter[platform]=IOS`)).data[0];
  if (!ver) throw new Error('sürüm bulunamadı: ' + surum);
  const rd = (await asc.get(`/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`)).data;
  const ekler = async () => (await asc.get(`/v1/appStoreReviewDetails/${rd.id}/appStoreReviewAttachments`)).data;
  if (process.argv.includes('--liste')) {
    for (const a of await ekler()) log(a.attributes.fileName, a.attributes.fileSize, a.attributes.assetDeliveryState && a.attributes.assetDeliveryState.state);
    return;
  }
  const dosya = process.argv[2];
  if (!dosya || !fs.existsSync(dosya)) throw new Error('dosya verilmedi ya da yok');
  const veri = fs.readFileSync(dosya);
  const ad = path.basename(dosya);
  // aynı adla eski ek varsa önce kaldırılır
  for (const a of await ekler()) if (a.attributes.fileName === ad) { await asc.del(`/v1/appStoreReviewAttachments/${a.id}`); log('eski ek kaldırıldı:', ad); }
  const ek = (await asc.post('/v1/appStoreReviewAttachments', { data: { type: 'appStoreReviewAttachments', attributes: { fileName: ad, fileSize: veri.length }, relationships: { appStoreReviewDetail: { data: { type: 'appStoreReviewDetails', id: rd.id } } } } })).data;
  for (const op of ek.attributes.uploadOperations) {
    const parca = veri.subarray(op.offset, op.offset + op.length);
    const r = await fetch(op.url, { method: op.method, headers: Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value])), body: parca });
    if (!r.ok) throw new Error(`parça yüklenemedi (${op.offset}): ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  const md5 = crypto.createHash('md5').update(veri).digest('hex');
  await asc.patch(`/v1/appStoreReviewAttachments/${ek.id}`, { data: { type: 'appStoreReviewAttachments', id: ek.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
  for (let i = 0; i < 30; i++) {
    const st = (await asc.get(`/v1/appStoreReviewAttachments/${ek.id}`)).data.attributes.assetDeliveryState || {};
    if (st.state === 'COMPLETE') { log('eklendi:', ad, (veri.length / 1048576).toFixed(1) + ' MB', '→ sürüm', surum); return; }
    if (st.state === 'FAILED') throw new Error('Apple dosyayı kabul etmedi: ' + JSON.stringify(st.errors || []));
    await new Promise((r) => setTimeout(r, 4000));
  }
  log('yüklendi, Apple hâlâ işliyor:', ad);
})().catch((e) => { console.error('HATA', e.message); process.exit(1); });
