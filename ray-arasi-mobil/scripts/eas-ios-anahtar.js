// Expo ekip hesabındaki App Store Connect API anahtarını (App Manager) Ray Arası'nın iOS kimlik bilgilerine bağlar:
// EAS iOS derlemesi ve App Store'a gönderim bilgisayarsız, etkileşimsiz yapılabilsin. Anahtarın kendisi Expo'da kalır,
// bu betik onu okumaz ve diske yazmaz. Bir kez çalıştırmak yeter; yeniden çalıştırmak zararsızdır.
//   NODE_USE_ENV_PROXY=1 node scripts/eas-ios-anahtar.js
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
  const a = (await q(`query($a: String!, $b: String!) { account { byName(accountName: $a) { id
      appStoreConnectApiKeysPaginated(first: 10) { edges { node { id roles keyIdentifier appleTeam { id appleTeamIdentifier } } } }
      appleAppIdentifiers(bundleIdentifier: $b) { id bundleIdentifier } } } }`, { a: ACCOUNT, b: BUNDLE })).account.byName;
  const keys = a.appStoreConnectApiKeysPaginated.edges.map((e) => e.node);
  const key = keys.find((k) => (k.roles || []).some((r) => r === 'ADMIN' || r === 'APP_MANAGER')) || keys[0];
  if (!key) throw new Error('Expo hesabında App Store Connect anahtarı yok');
  if (!key.appleTeam) throw new Error('anahtarın Apple ekibi Expo\'da kayıtlı değil');
  console.log('anahtar', key.keyIdentifier, (key.roles || []).join(','), 'ekip', key.appleTeam.appleTeamIdentifier);
  let ident = a.appleAppIdentifiers[0];
  if (!ident) {
    ident = (await q(`mutation($i: AppleAppIdentifierInput!, $acc: ID!) { appleAppIdentifier { createAppleAppIdentifier(appleAppIdentifierInput: $i, accountId: $acc) { id bundleIdentifier } } }`,
      { i: { bundleIdentifier: BUNDLE, appleTeamId: key.appleTeam.id }, acc: a.id })).appleAppIdentifier.createAppleAppIdentifier;
    console.log('Expo\'da paket kimliği oluşturuldu', ident.bundleIdentifier);
  }
  const app = (await q(`query($p: String!, $i: String!) { app { byId(appId: $p) { id fullName iosAppCredentials(filter: { appleAppIdentifierId: $i }) { id
      appStoreConnectApiKeyForSubmissions { id } appStoreConnectApiKeyForBuilds { id } } } } }`, { p: PROJECT, i: ident.id })).app.byId;
  let cred = app.iosAppCredentials[0];
  if (!cred) {
    cred = (await q(`mutation($in: IosAppCredentialsInput!, $app: ID!, $i: ID!) { iosAppCredentials { createIosAppCredentials(iosAppCredentialsInput: $in, appId: $app, appleAppIdentifierId: $i) { id } } }`,
      { in: { appleTeamId: key.appleTeam.id, appStoreConnectApiKeyForSubmissionsId: key.id, appStoreConnectApiKeyForBuildsId: key.id }, app: app.id, i: ident.id })).iosAppCredentials.createIosAppCredentials;
    console.log('iOS kimlik bilgileri oluşturuldu ve anahtar bağlandı:', app.fullName);
    return;
  }
  if (!cred.appStoreConnectApiKeyForSubmissions || cred.appStoreConnectApiKeyForSubmissions.id !== key.id) {
    await q(`mutation($c: ID!, $k: ID!) { iosAppCredentials { setAppStoreConnectApiKeyForSubmissions(id: $c, ascApiKeyId: $k) { id } } }`, { c: cred.id, k: key.id });
    console.log('gönderim anahtarı bağlandı');
  }
  if (!cred.appStoreConnectApiKeyForBuilds || cred.appStoreConnectApiKeyForBuilds.id !== key.id) {
    await q(`mutation($c: ID!, $k: ID!) { iosAppCredentials { setAppStoreConnectApiKeyForBuilds(id: $c, ascApiKeyId: $k) { id } } }`, { c: cred.id, k: key.id });
    console.log('derleme anahtarı bağlandı');
  }
  console.log('tamam:', app.fullName, BUNDLE);
})().catch((e) => { console.error('HATA', e.message); process.exit(1); });
