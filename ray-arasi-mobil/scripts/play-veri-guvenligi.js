// Google Play "Veri güvenliği" formunu API ile doldurur: Trafik Ustası hiçbir kullanıcı verisi toplamaz ya da paylaşmaz
// (çevrimdışı oyun; hesap, reklam, analiz, ağ isteği yok). Apple'daki "Data Not Collected" beyanıyla aynı.
// Biçim: Play Console'daki Veri güvenliği CSV şablonu (ilk satır başlık).
//   NODE_USE_ENV_PROXY=1 node scripts/play-veri-guvenligi.js
const path = require('path');
const PKG = require(path.join(__dirname, '..', 'app.json')).expo.android.package;
const CSV = [
  'Question ID (machine readable),Response ID (machine readable),Response value,Answer requirement,Human-friendly question label',
  'PSL_DATA_COLLECTION_COLLECTS_PERSONAL_DATA,,false,REQUIRED,Does your app collect or share any of the required user data types?',
].join('\n') + '\n';
(async () => {
  const play = await require('./play')();
  const r = await play.call('POST', `${PKG}/dataSafety`, { safetyLabels: CSV });
  console.log('Veri güvenliği formu kaydedildi: veri toplanmıyor / paylaşılmıyor', JSON.stringify(r || {}));
})().catch((e) => { console.error('HATA', e.message); process.exit(1); });
