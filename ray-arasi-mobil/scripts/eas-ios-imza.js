// Uygulamanın (app.json'daki paket kimliği) App Store imza bilgilerini hazırlar: Expo ekip hesabındaki geçerli dağıtım sertifikasıyla Apple'da
// o paket kimliği için bir App Store profili oluşturur, Expo'ya yükler ve uygulamanın derleme kimlik bilgilerine
// bağlar. Böylece `eas build --platform ios --non-interactive` bilgisayarsız çalışır. Sertifikanın özel anahtarı
// okunmaz; profil yalnızca bellekte tutulur, diske yazılmaz. Yeniden çalıştırmak zararsızdır.
//   NODE_USE_ENV_PROXY=1 node scripts/eas-ios-imza.js
const path = require('path');
const EXPO = 'https://api.expo.dev/graphql';
const ACCOUNT = process.env.EXPO_ACCOUNT || 'plustradinggs-team';
const CFG = require(path.join(__dirname, '..', 'app.json')).expo;
const PROJECT = CFG.extra.eas.projectId, BUNDLE = CFG.ios.bundleIdentifier;
async function q(query, variables) {
  const r = await fetch(EXPO, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (process.env.EXPO_TOKEN || 'proxy-injected') }, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (j.errors) throw new Error('Expo: ' + j.errors.map((e) => e.message).join('; '));
  return j.data;
}
(async () => {
  const asc = await require('./asc')();
  const acc = (await q(`query($a: String!, $b: String!) { account { byName(accountName: $a) { id
      appleDistributionCertificatesPaginated(first: 20) { edges { node { id serialNumber developerPortalIdentifier validityNotAfter appleTeam { id appleTeamIdentifier } } } }
      appleAppIdentifiers(bundleIdentifier: $b) { id } } } }`, { a: ACCOUNT, b: BUNDLE })).account.byName;
  const ident = acc.appleAppIdentifiers[0];
  if (!ident) throw new Error('önce scripts/eas-ios-anahtar.js çalıştırılmalı');
  const app = (await q(`query($p: String!, $i: String!) { app { byId(appId: $p) { iosAppCredentials(filter: { appleAppIdentifierId: $i }) { id appleTeam { appleTeamIdentifier }
      iosAppBuildCredentialsList { id iosDistributionType distributionCertificate { id } provisioningProfile { id } } } } } }`, { p: PROJECT, i: ident.id })).app.byId;
  const cred = app.iosAppCredentials[0];
  if (!cred) throw new Error('önce scripts/eas-ios-anahtar.js çalıştırılmalı');
  const have = (cred.iosAppBuildCredentialsList || []).find((b) => b.iosDistributionType === 'APP_STORE');
  if (have && have.distributionCertificate && have.provisioningProfile) { console.log('imza bilgileri zaten hazır'); return; }

  // Apple'da geçerli olan, Expo'da kayıtlı dağıtım sertifikası
  const team = cred.appleTeam && cred.appleTeam.appleTeamIdentifier;
  const apple = (await asc.get('/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=50')).data;
  const now = new Date();
  const certs = acc.appleDistributionCertificatesPaginated.edges.map((e) => e.node)
    .filter((c) => (!team || !c.appleTeam || c.appleTeam.appleTeamIdentifier === team) && new Date(c.validityNotAfter) > now)
    .map((c) => ({ c, a: apple.find((x) => x.attributes.serialNumber && x.attributes.serialNumber.toUpperCase() === String(c.serialNumber).toUpperCase()) }))
    .filter((x) => x.a)
    .sort((x, y) => (x.c.validityNotAfter < y.c.validityNotAfter ? 1 : -1));
  if (!certs.length) throw new Error('Expo hesabında Apple\'da geçerli bir dağıtım sertifikası yok');
  const { c: cert, a: appleCert } = certs[0];
  console.log('sertifika', appleCert.attributes.name || appleCert.id, 'geçerlilik', cert.validityNotAfter.slice(0, 10));

  // Apple'da App Store profili
  const bid = (await asc.get(`/v1/bundleIds?filter[identifier]=${BUNDLE}`)).data.find((b) => b.attributes.identifier === BUNDLE);
  if (!bid) throw new Error('Apple\'da paket kimliği kayıtlı değil: ' + BUNDLE);
  const prof = (await asc.post('/v1/profiles', { data: { type: 'profiles', attributes: { name: `${BUNDLE} App Store ${now.toISOString().slice(0, 10)}`, profileType: 'IOS_APP_STORE' },
    relationships: { bundleId: { data: { type: 'bundleIds', id: bid.id } }, certificates: { data: [{ type: 'certificates', id: appleCert.id }] } } } })).data;
  console.log('Apple profili oluşturuldu', prof.attributes.name);

  // Expo'ya yükle ve bağla
  const pp = (await q(`mutation($in: AppleProvisioningProfileInput!, $acc: ID!, $i: ID!) { appleProvisioningProfile { createAppleProvisioningProfile(appleProvisioningProfileInput: $in, accountId: $acc, appleAppIdentifierId: $i) { id } } }`,
    { in: { appleProvisioningProfile: prof.attributes.profileContent, developerPortalIdentifier: prof.id }, acc: acc.id, i: ident.id })).appleProvisioningProfile.createAppleProvisioningProfile;
  if (have) {
    await q(`mutation($b: ID!, $d: ID!) { iosAppBuildCredentials { setDistributionCertificate(id: $b, distributionCertificateId: $d) { id } } }`, { b: have.id, d: cert.id });
    await q(`mutation($b: ID!, $p: ID!) { iosAppBuildCredentials { setProvisioningProfile(id: $b, provisioningProfileId: $p) { id } } }`, { b: have.id, p: pp.id });
  } else {
    await q(`mutation($in: IosAppBuildCredentialsInput!, $c: ID!) { iosAppBuildCredentials { createIosAppBuildCredentials(iosAppBuildCredentialsInput: $in, iosAppCredentialsId: $c) { id } } }`,
      { in: { iosDistributionType: 'APP_STORE', distributionCertificateId: cert.id, provisioningProfileId: pp.id }, c: cred.id });
  }
  console.log('tamam: App Store imza bilgileri Expo\'da hazır');
})().catch((e) => { console.error('HATA', e.message); process.exit(1); });
