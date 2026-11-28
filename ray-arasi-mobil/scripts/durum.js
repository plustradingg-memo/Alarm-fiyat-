// Ray Arası'nın App Store Connect ve Google Play'deki durumunu yazar (yalnızca okur, hiçbir şeyi değiştirmez).
//   NODE_USE_ENV_PROXY=1 node scripts/durum.js
const BUNDLE = 'com.rayarasi.oyun';
(async () => {
  try {
    const asc = await require('./asc')();
    const apps = (await asc.get(`/v1/apps?filter[bundleId]=${BUNDLE}`)).data;
    if (!apps.length) console.log('App Store: uygulama kaydı yok (' + BUNDLE + ')');
    for (const a of apps) {
      console.log('App Store:', a.attributes.name, 'Apple ID', a.id, 'dil', a.attributes.primaryLocale);
      const vs = (await asc.get(`/v1/apps/${a.id}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,releaseType`)).data;
      for (const v of vs) console.log('  sürüm', v.attributes.versionString, v.attributes.appStoreState, v.attributes.releaseType || '');
      const bs = (await asc.get(`/v1/builds?filter[app]=${a.id}&limit=5&sort=-uploadedDate&fields[builds]=version,processingState,uploadedDate`)).data;
      for (const b of bs) console.log('  derleme', b.attributes.version, b.attributes.processingState, b.attributes.uploadedDate);
    }
    const ids = (await asc.get(`/v1/bundleIds?filter[identifier]=${BUNDLE}`)).data;
    console.log('Apple paket kimliği kayıtlı mı:', ids.some((b) => b.attributes.identifier === BUNDLE) ? 'evet' : 'hayır');
  } catch (e) { console.log('App Store HATA:', e.message); }
  try {
    const play = await require('./play')();
    console.log('Google hizmet hesabı:', play.clientEmail);
    const e = await play.edit(BUNDLE);
    const tracks = (await e.get('tracks')).tracks || [];
    for (const t of tracks) for (const r of t.releases || []) console.log('Google Play:', t.track, r.status, (r.versionCodes || []).join(','), r.name || '');
    if (!tracks.some((t) => (t.releases || []).length)) console.log('Google Play: uygulama var, henüz sürüm yok');
    await e.discard();
  } catch (e) { console.log('Google Play:', /404|not found|Package not found/i.test(e.message) ? 'uygulama kaydı yok ya da hizmet hesabı göremiyor (' + e.message.slice(0, 160) + ')' : 'HATA ' + e.message); }
})();
