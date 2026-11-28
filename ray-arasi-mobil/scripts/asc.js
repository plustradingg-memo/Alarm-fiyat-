// App Store Connect API yardımcısı. Anahtar (App Manager rolü) Expo hesabında saklıdır; her çalışmada Expo'dan
// okunur, diske yazılmaz. EXPO_TOKEN gerekir (bu ortamda vekil sunucu ekler).
// Kullanım (modül): const asc = await require('./asc')(); await asc.get('/v1/apps?filter[bundleId]=...')
const crypto = require('crypto');

const EXPO = 'https://api.expo.dev/graphql';
const ACCOUNT = process.env.EXPO_ACCOUNT || 'plustradinggs-team';

async function expoQuery(query, variables) {
  const r = await fetch(EXPO, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (process.env.EXPO_TOKEN || 'proxy-injected') },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error('Expo: ' + j.errors.map((e) => e.message).join('; '));
  return j.data;
}

async function loadKey() {
  const d = await expoQuery(
    `query($a: String!) { account { byName(accountName: $a) { appStoreConnectApiKeysPaginated(first: 10) { edges { node { id roles } } } } } }`,
    { a: ACCOUNT },
  );
  const keys = d.account.byName.appStoreConnectApiKeysPaginated.edges.map((e) => e.node);
  const pick = keys.find((k) => (k.roles || []).some((r) => r === 'ADMIN' || r === 'APP_MANAGER')) || keys[0];
  if (!pick) throw new Error('Expo hesabında App Store Connect anahtarı yok');
  const k = await expoQuery(`query($id: ID!) { appStoreConnectApiKey { byId(id: $id) { issuerIdentifier keyIdentifier keyP8 } } }`, { id: pick.id });
  return k.appStoreConnectApiKey.byId;
}

const b64u = (b) => Buffer.from(b).toString('base64url');
function jwt({ issuerIdentifier, keyIdentifier, keyP8 }) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: keyIdentifier, typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: issuerIdentifier, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: keyP8, dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}

module.exports = async function asc() {
  const key = await loadKey();
  let tok = null;
  let tokAt = 0;
  const auth = () => {
    if (!tok || Date.now() - tokAt > 10 * 60 * 1000) {
      tok = jwt(key);
      tokAt = Date.now();
    }
    return 'Bearer ' + tok;
  };
  async function call(method, path, body) {
    const r = await fetch(path.startsWith('http') ? path : 'https://api.appstoreconnect.apple.com' + path, {
      method,
      headers: { authorization: auth(), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    const j = text ? JSON.parse(text) : {};
    if (!r.ok) {
      // Apple bazı reddetmelerde asıl sebebi meta.associatedErrors içinde verir
      const assoc = (j.errors || []).flatMap((e) => Object.values((e.meta && e.meta.associatedErrors) || {}).flat()).map((e) => e.detail || e.title || e.code);
      throw new Error(`${method} ${path} → ${r.status}: ${(j.errors || []).map((e) => e.detail || e.title).join('; ') || text.slice(0, 300)}${assoc.length ? ' | ' + assoc.join(' | ') : ''}`);
    }
    return j;
  }
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p, b) => call('DELETE', p, b), // ilişki silmede gövde gerekir
  };
};
