/* Fiyat Alarmı – tarayıcıda çalışan fiyat takip uygulaması */
(() => {
  'use strict';

  const STORE_KEY = 'fiyat-alarmi:v1';
  const MAX_HISTORY = 500;

  const CRYPTO_NAMES = {
    bitcoin: 'Bitcoin (BTC)', ethereum: 'Ethereum (ETH)', solana: 'Solana (SOL)',
    ripple: 'XRP', tether: 'Tether (USDT)', 'avalanche-2': 'Avalanche (AVAX)',
  };
  const SYMBOLS = { TRY: '₺', USD: '$', EUR: '€', GBP: '£', CHF: 'CHF ', JPY: '¥' };

  const $ = (sel, root = document) => root.querySelector(sel);

  // ---------- Durum ----------
  const defaultState = () => ({ items: [], settings: { interval: 5, sound: true } });

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const data = JSON.parse(raw);
      return { ...defaultState(), ...data, settings: { ...defaultState().settings, ...(data.settings || {}) } };
    } catch {
      return defaultState();
    }
  }

  let state = load();

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* depolama kapalı */ }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- Biçimlendirme ----------
  function fmt(value, currency) {
    if (value == null || Number.isNaN(value)) return '—';
    const digits = value < 1 ? 6 : value < 100 ? 4 : 2;
    try {
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency', currency, maximumFractionDigits: digits, minimumFractionDigits: 2,
      }).format(value);
    } catch {
      return (SYMBOLS[currency] || '') + value.toFixed(2);
    }
  }

  const fmtDate = (t) => new Date(t).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  // ---------- Fiyat & alarm mantığı ----------
  const current = (item) => item.history.length ? item.history[item.history.length - 1].p : null;

  const isHit = (item, price = current(item)) =>
    price != null && (item.direction === 'below' ? price <= item.target : price >= item.target);

  function addPrice(item, price) {
    if (!(price >= 0)) return;
    const last = item.history[item.history.length - 1];
    // Aynı fiyat tekrar geldiyse yalnızca zamanı güncelle (geçmiş şişmesin)
    if (last && last.p === price && item.type !== 'manual') {
      last.t = Date.now();
    } else {
      item.history.push({ t: Date.now(), p: price });
      if (item.history.length > MAX_HISTORY) item.history.splice(0, item.history.length - MAX_HISTORY);
    }
    checkAlarm(item);
  }

  function checkAlarm(item) {
    const hit = isHit(item);
    if (hit && !item.triggered) {
      item.triggered = true;
      item.triggeredAt = Date.now();
      fireAlarm(item);
    } else if (!hit && item.triggered) {
      item.triggered = false; // koşul bozuldu: alarm yeniden kurulur
    }
  }

  function fireAlarm(item) {
    const dirText = item.direction === 'below' ? 'altına düştü' : 'üstüne çıktı';
    const msg = `${item.name}: ${fmt(current(item), item.currency)} — hedef ${fmt(item.target, item.currency)} ${dirText}!`;
    toast('🔔 ' + msg, 'alarm', 8000);
    if (state.settings.sound) beep();
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Fiyat alarmı', { body: msg }); } catch { /* bazı tarayıcılar desteklemez */ }
    }
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.22);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch { /* ses yok */ }
  }

  // ---------- Canlı veriler ----------
  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }

  // 1 birim döviz = kaç TRY
  async function fetchFxRates(codes) {
    const list = codes.join(',');
    try {
      const data = await fetchJson(`https://api.frankfurter.dev/v1/latest?base=TRY&symbols=${list}`);
      return Object.fromEntries(codes.filter((c) => data.rates[c]).map((c) => [c, 1 / data.rates[c]]));
    } catch {
      const data = await fetchJson('https://open.er-api.com/v6/latest/TRY');
      return Object.fromEntries(codes.filter((c) => data.rates[c]).map((c) => [c, 1 / data.rates[c]]));
    }
  }

  async function fetchCrypto(ids, currencies) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${currencies.map((c) => c.toLowerCase()).join(',')}`;
    return fetchJson(url);
  }

  let refreshing = false;
  async function refreshLive({ silent = false } = {}) {
    if (refreshing) return;
    const live = state.items.filter((i) => i.type !== 'manual');
    if (!live.length) { if (!silent) toast('Güncellenecek canlı takip yok.'); return; }
    refreshing = true;
    const btn = $('#btnRefresh');
    btn.disabled = true;
    btn.textContent = '↻ Güncelleniyor...';
    const errors = [];

    const fxItems = live.filter((i) => i.type === 'fx');
    if (fxItems.length) {
      try {
        const rates = await fetchFxRates([...new Set(fxItems.map((i) => i.symbol))]);
        fxItems.forEach((i) => { if (rates[i.symbol]) addPrice(i, +rates[i.symbol].toFixed(4)); });
      } catch { errors.push('döviz'); }
    }

    const cryptoItems = live.filter((i) => i.type === 'crypto');
    if (cryptoItems.length) {
      try {
        const data = await fetchCrypto(
          [...new Set(cryptoItems.map((i) => i.symbol))],
          [...new Set(cryptoItems.map((i) => i.currency))],
        );
        cryptoItems.forEach((i) => {
          const p = data[i.symbol] && data[i.symbol][i.currency.toLowerCase()];
          if (p != null) addPrice(i, p);
        });
      } catch { errors.push('kripto'); }
    }

    state.lastRefresh = Date.now();
    save();
    render();
    refreshing = false;
    btn.disabled = false;
    btn.textContent = '↻ Güncelle';
    if (errors.length) toast(`Fiyat alınamadı: ${errors.join(', ')}. İnternet bağlantınızı kontrol edin.`);
    else if (!silent) toast('Canlı fiyatlar güncellendi.');
  }

  let timer = null;
  function schedule() {
    clearInterval(timer);
    const min = Number(state.settings.interval);
    if (min > 0) timer = setInterval(() => refreshLive({ silent: true }), min * 60 * 1000);
  }

  // ---------- Grafik ----------
  function chartSvg(item) {
    const pts = item.history;
    const W = 220, H = 90, pad = 4;
    if (pts.length < 2) {
      return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="currentColor" opacity=".5" font-size="11">Grafik için en az 2 fiyat gerekli</text></svg>`;
    }
    const vals = pts.map((d) => d.p).concat(item.target);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    const x = (t) => pad + ((t - t0) / Math.max(t1 - t0, 1)) * (W - pad * 2);
    const y = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
    const line = pts.map((d, i) => `${i ? 'L' : 'M'}${x(d.t).toFixed(1)},${y(d.p).toFixed(1)}`).join(' ');
    const area = `${line} L${x(t1).toFixed(1)},${H - pad} L${x(t0).toFixed(1)},${H - pad} Z`;
    const ty = y(item.target).toFixed(1);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Fiyat geçmişi grafiği">
      <path class="area" d="${area}"/><path class="line" d="${line}" vector-effect="non-scaling-stroke"/>
      <line class="target" x1="0" x2="${W}" y1="${ty}" y2="${ty}" vector-effect="non-scaling-stroke"/></svg>`;
  }

  // ---------- Arayüz ----------
  function render() {
    renderStats();
    const q = $('#search').value.trim().toLocaleLowerCase('tr');
    const sort = $('#sort').value;
    let items = state.items.filter((i) => !q || i.name.toLocaleLowerCase('tr').includes(q));

    const distance = (i) => {
      const c = current(i);
      if (c == null || !i.target) return Infinity;
      return isHit(i) ? -1 : Math.abs(c - i.target) / i.target;
    };
    if (sort === 'near') items.sort((a, b) => distance(a) - distance(b));
    else if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    else items.sort((a, b) => b.createdAt - a.createdAt);

    $('#empty').hidden = state.items.length > 0;
    $('#list').innerHTML = items.map(itemHtml).join('') ||
      (state.items.length ? '<p class="empty">Aramayla eşleşen sonuç yok.</p>' : '');
  }

  function itemHtml(item) {
    const c = current(item);
    const first = item.history[0] ? item.history[0].p : null;
    const prev = item.history.length > 1 ? item.history[item.history.length - 2].p : null;
    const hit = isHit(item);
    const typeLabel = { manual: 'Ürün', fx: 'Döviz', crypto: 'Kripto' }[item.type];

    let changeHtml = '';
    if (c != null && prev != null && prev !== 0 && c !== prev) {
      const pct = ((c - prev) / prev) * 100;
      changeHtml = `<span class="change ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} %${Math.abs(pct).toFixed(2)}</span>`;
    }

    let progress = 0;
    if (c != null && c > 0 && item.target > 0) {
      progress = item.direction === 'below' ? item.target / c : c / item.target;
    }
    const pctToTarget = c != null && item.target ? ((item.target - c) / c) * 100 : null;
    const remainText = hit
      ? 'Hedefe ulaşıldı ✓'
      : pctToTarget != null ? `Hedefe %${Math.abs(pctToTarget).toFixed(2)} ${pctToTarget < 0 ? 'düşüş' : 'artış'} kaldı` : '';

    const minP = item.history.length ? Math.min(...item.history.map((d) => d.p)) : null;
    const maxP = item.history.length ? Math.max(...item.history.map((d) => d.p)) : null;
    const link = item.url && /^https?:\/\//i.test(item.url)
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">ürüne git ↗</a>` : '';

    return `<article class="item ${hit ? 'alarm' : ''}" data-id="${item.id}">
      <div>
        <div class="item-title">
          ${escapeHtml(item.name)} <span class="badge">${typeLabel}</span>
          ${hit ? '<span class="badge hit">🔔 Alarm</span>' : ''} ${link}
        </div>
        <div class="price-row">
          <span class="price">${fmt(c, item.currency)}</span> ${changeHtml}
        </div>
        <div class="meta">Hedef: <strong>${item.direction === 'below' ? '≤' : '≥'} ${fmt(item.target, item.currency)}</strong> · ${remainText}</div>
        <div class="progress" title="Hedefe yakınlık"><div style="width:${Math.min(progress * 100, 100).toFixed(1)}%"></div></div>
        <div class="meta">
          ${first != null && first !== c ? `İlk: ${fmt(first, item.currency)} · ` : ''}En düşük: ${fmt(minP, item.currency)} · En yüksek: ${fmt(maxP, item.currency)}
        </div>
        <div class="item-actions">
          ${item.type === 'manual' ? '<button class="btn small primary" data-act="price">Fiyat gir</button>' : ''}
          <button class="btn small ghost" data-act="target">Hedefi değiştir</button>
          <button class="btn small ghost" data-act="dir">Koşulu çevir</button>
          <button class="btn small danger" data-act="del">Sil</button>
        </div>
      </div>
      <div class="chart-wrap">
        ${chartSvg(item)}
        <div class="meta">${item.history.length} kayıt${c != null ? ' · ' + fmtDate(item.history[item.history.length - 1].t) : ''}</div>
      </div>
    </article>`;
  }

  function renderStats() {
    const total = state.items.length;
    const hits = state.items.filter((i) => isHit(i)).length;
    const live = state.items.filter((i) => i.type !== 'manual').length;
    const last = state.lastRefresh ? fmtDate(state.lastRefresh) : '—';
    $('#stats').innerHTML = [
      ['Takip edilen', total], ['Alarmdaki', hits], ['Canlı takip', live], ['Son güncelleme', last],
    ].map(([l, v]) => `<div class="stat"><div class="label">${l}</div><div class="value">${v}</div></div>`).join('');
  }

  function toast(text, kind = '', ms = 3500) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function askPrice(title, initial) {
    return new Promise((resolve) => {
      const dlg = $('#priceDialog');
      const input = $('#priceForm').elements.price;
      $('#priceDialogTitle').textContent = title;
      input.value = initial ?? '';
      dlg.returnValue = '';
      dlg.showModal();
      input.focus();
      input.select();
      dlg.addEventListener('close', () => {
        resolve(dlg.returnValue === 'ok' ? parseFloat(input.value) : null);
      }, { once: true });
    });
  }

  // ---------- Form ----------
  const form = $('#addForm');

  function updateFormFields() {
    const type = form.elements.type.value;
    form.querySelectorAll('[data-for]').forEach((el) => {
      const show = el.dataset.for.split(' ').includes(type);
      el.hidden = !show;
      el.querySelectorAll('input, select').forEach((f) => { f.disabled = !show; });
    });
    form.elements.name.required = type === 'manual';
    form.elements.price.required = type === 'manual';
    $('#formHint').textContent = type === 'manual'
      ? 'Fiyatı siz girersiniz; her yeni fiyat geçmişe eklenir.'
      : 'Fiyat internetten otomatik alınır.';
  }

  form.addEventListener('change', (e) => { if (e.target.name === 'type') updateFormFields(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const type = f.type.value;
    const target = parseFloat(f.target.value);
    if (!(target > 0)) { toast('Geçerli bir hedef fiyat girin.'); return; }

    const item = {
      id: uid(), type, target, direction: f.direction.value,
      history: [], triggered: false, createdAt: Date.now(),
    };

    if (type === 'manual') {
      item.name = f.name.value.trim();
      item.url = f.url.value.trim();
      item.currency = f.currency.value;
    } else if (type === 'fx') {
      item.symbol = f.fx.value;
      item.name = `${item.symbol}/TRY`;
      item.currency = 'TRY';
    } else {
      item.symbol = f.crypto.value;
      item.currency = f.currency.value;
      item.name = `${CRYPTO_NAMES[item.symbol] || item.symbol} / ${item.currency}`;
    }

    state.items.push(item);
    if (type === 'manual') addPrice(item, parseFloat(f.price.value));
    save();
    form.reset();
    updateFormFields();
    render();
    toast(`"${item.name}" takibe eklendi.`);
    if (type !== 'manual') refreshLive({ silent: true });
  });

  // ---------- Liste eylemleri ----------
  $('#list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.item').dataset.id;
    const item = state.items.find((i) => i.id === id);
    if (!item) return;

    switch (btn.dataset.act) {
      case 'price': {
        const p = await askPrice(`${item.name} – yeni fiyat`, current(item));
        if (p != null && p >= 0) addPrice(item, p);
        break;
      }
      case 'target': {
        const t = await askPrice(`${item.name} – yeni hedef fiyat`, item.target);
        if (t != null && t > 0) { item.target = t; item.triggered = false; checkAlarm(item); }
        break;
      }
      case 'dir':
        item.direction = item.direction === 'below' ? 'above' : 'below';
        item.triggered = false;
        checkAlarm(item);
        break;
      case 'del':
        if (!confirm(`"${item.name}" silinsin mi?`)) return;
        state.items = state.items.filter((i) => i.id !== id);
        break;
    }
    save();
    render();
  });

  $('#search').addEventListener('input', render);
  $('#sort').addEventListener('change', render);
  $('#btnRefresh').addEventListener('click', () => refreshLive());

  // ---------- Bildirimler ----------
  function updateNotifyBtn() {
    const btn = $('#btnNotify');
    if (!('Notification' in window)) { btn.hidden = true; return; }
    btn.hidden = Notification.permission === 'granted';
    btn.disabled = Notification.permission === 'denied';
    if (Notification.permission === 'denied') btn.textContent = 'Bildirimler engelli';
  }
  $('#btnNotify').addEventListener('click', async () => {
    try { await Notification.requestPermission(); } catch { /* yok say */ }
    updateNotifyBtn();
    if (Notification.permission === 'granted') toast('Bildirimler açık. Alarmlar masaüstüne de gelecek.');
  });

  // ---------- Ayarlar ----------
  $('#interval').value = String(state.settings.interval);
  $('#sound').checked = !!state.settings.sound;
  $('#interval').addEventListener('change', (e) => {
    state.settings.interval = Number(e.target.value);
    save();
    schedule();
  });
  $('#sound').addEventListener('change', (e) => { state.settings.sound = e.target.checked; save(); });

  $('#btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fiyat-alarmi-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.items)) throw new Error('format');
      const valid = data.items.filter((i) => i && i.id && i.name && Array.isArray(i.history) && typeof i.target === 'number');
      state = { ...defaultState(), ...data, items: valid, settings: { ...defaultState().settings, ...(data.settings || {}) } };
      save();
      $('#interval').value = String(state.settings.interval);
      $('#sound').checked = !!state.settings.sound;
      schedule();
      render();
      toast(`${valid.length} takip içe aktarıldı.`);
    } catch {
      toast('Dosya okunamadı. Geçerli bir dışa aktarım dosyası seçin.');
    }
    e.target.value = '';
  });

  $('#btnClear').addEventListener('click', () => {
    if (!confirm('Tüm takipler ve fiyat geçmişi silinecek. Emin misiniz?')) return;
    state.items = [];
    save();
    render();
  });

  // Başka sekmede yapılan değişiklikleri al
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) { state = load(); render(); }
  });

  // ---------- Başlat ----------
  updateFormFields();
  updateNotifyBtn();
  render();
  schedule();
  refreshLive({ silent: true });
})();
