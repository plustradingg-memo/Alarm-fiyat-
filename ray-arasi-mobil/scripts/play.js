// Google Play Developer API yardımcısı. Hizmet hesabı anahtarı Expo hesabında saklıdır (Play Console'da yetkili);
// her çalışmada Expo'dan okunur, diske yazılmaz. EXPO_TOKEN gerekir. Node fetch vekil için NODE_USE_ENV_PROXY=1 ister.
// Kullanım: const play = await require('./play')(); const e = await play.edit('com.trafikustasi.oyun'); ...
const crypto = require('crypto');

const EXPO = 'https://api.expo.dev/graphql';
const ACCOUNT = process.env.EXPO_ACCOUNT || 'plustradinggs-team';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/';

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
    `query($a: String!) { account { byName(accountName: $a) { googleServiceAccountKeysPaginated(first: 10) { edges { node { id createdAt } } } } } }`,
    { a: ACCOUNT },
  );
  const keys = d.account.byName.googleServiceAccountKeysPaginated.edges.map((e) => e.node).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!keys.length) throw new Error('Expo hesabında Google hizmet hesabı anahtarı yok');
  const k = await expoQuery(`query($id: ID!) { googleServiceAccountKey { byId(id: $id) { keyJson } } }`, { id: keys[0].id });
  return { id: keys[0].id, ...JSON.parse(k.googleServiceAccountKey.byId.keyJson) };
}

const b64u = (b) => Buffer.from(b).toString('base64url');
async function token(key) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), key.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + body + '.' + b64u(sig) }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google girişi: ' + JSON.stringify(j).slice(0, 300));
  return j.access_token;
}

module.exports = async function play() {
  const key = await loadKey();
  const tok = await token(key);
  async function call(method, url, body, type) {
    const r = await fetch(url.startsWith('http') ? url : API + url, {
      method,
      headers: { authorization: 'Bearer ' + tok, ...(body !== undefined ? { 'content-type': type || 'application/json' } : {}) },
      body: body === undefined ? undefined : type ? body : JSON.stringify(body),
    });
    const text = await r.text();
    const j = text ? JSON.parse(text) : {};
    if (!r.ok) throw new Error(`${method} ${url} → ${r.status}: ${(j.error && j.error.message) || text.slice(0, 300)}`);
    return j;
  }
  return {
    keyId: key.id,
    clientEmail: key.client_email,
    call,
    /** Yeni bir düzenleme açar: { id, get, put, patch, post, commit, discard } (yollar düzenlemeye göre) */
    async edit(pkg) {
      const e = await call('POST', `${pkg}/edits`, {});
      const base = `${pkg}/edits/${e.id}`;
      return {
        id: e.id,
        get: (p) => call('GET', `${base}/${p}`),
        put: (p, b) => call('PUT', `${base}/${p}`, b),
        patch: (p, b) => call('PATCH', `${base}/${p}`, b),
        post: (p, b, type) => call('POST', `${base}/${p}`, b, type),
        commit: (q) => call('POST', `${base}:commit${q ? '?' + q : ''}`, {}),
        discard: () => call('DELETE', base),
      };
    },
  };
};
