// Alarm bildirimleri: Telegram ve/veya GitHub issue (e-posta bildirimi için).

const fmt = (n) => n == null ? '—' : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function alarmMetni(a, { html = false } = {}) {
  const b = (s) => html ? `<b>${esc(s)}</b>` : s;
  const lines = [
    `🔔 ${b(a.ad)}`,
    `🏷️ ${a.site}: ${b(fmt(a.fiyat))}${a.oncekiFiyat ? ` (önceki ${fmt(a.oncekiFiyat)})` : ''}`,
    ...a.nedenler.map((n) => `• ${html ? esc(n) : n}`),
    a.url,
  ];
  return lines.join('\n');
}

async function telegram(alarmlar) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chats = (process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!token || !chats.length) return false;
  for (const chat of chats) {
    for (const a of alarmlar) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: alarmMetni(a, { html: true }), parse_mode: 'HTML' }),
      });
      if (!res.ok) console.error(`Telegram hatası (${chat}): ${res.status} ${await res.text()}`);
    }
  }
  return true;
}

async function githubIssue(alarmlar) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo || process.env.ISSUE_BILDIRIMI === 'false') return false;
  const baslik = alarmlar.length === 1
    ? `🔔 İndirim: ${alarmlar[0].ad.slice(0, 80)} – ${fmt(alarmlar[0].fiyat)}`
    : `🔔 ${alarmlar.length} üründe indirim`;
  const govde = alarmlar.map((a) => alarmMetni(a).split('\n').join('  \n')).join('\n\n---\n\n');
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: baslik, body: govde, labels: ['fiyat-alarmi'] }),
  });
  if (!res.ok) console.error(`GitHub issue oluşturulamadı: ${res.status} ${await res.text()}`);
  return res.ok;
}

export async function bildir(alarmlar) {
  if (!alarmlar.length) return;
  for (const a of alarmlar) console.log('\n' + alarmMetni(a));
  const results = await Promise.allSettled([telegram(alarmlar), githubIssue(alarmlar)]);
  results.forEach((r) => { if (r.status === 'rejected') console.error('Bildirim hatası:', r.reason); });
}
