# Trafik Ustası / Traffic Maestro — mağaza bilgileri

Bütün mağaza metinleri (ad, alt başlık, açıklamalar, anahtar kelimeler, sürüm notları, inceleme notu, yaş
derecelendirmesi yanıtları) **`metinler.json`** dosyasındadır; mağazalara `scripts/ios-yayinla.js` ve
`scripts/play-yayinla.js` buradan yükler. Bu sayfa özet ve elle doldurulan formların yanıtlarıdır.

| | Türkçe | İngilizce |
|---|---|---|
| Mağaza adı (30) | Trafik Ustası: Yol Çiz | Traffic Maestro: Draw Roads |
| Telefondaki ad | Trafik Ustası | Traffic Maestro |
| Alt başlık (App Store, 30) | Köprü, tren ve uçak bulmacası | Bridges, trains and planes |
| Oyun dili | Telefon Türkçeyse Türkçe, değilse İngilizce; ana ekrandaki TR / EN düğmesiyle değişir | |

- **Paket kimliği:** `com.trafikustasi.oyun` (iOS ve Android; ilk yüklemeden sonra değişmez)
- **Kategori:** Oyunlar › Bulmaca (alt: Strateji; App Store ikincil: Eğlence)
- **Fiyat:** ücretsiz; reklam yok, uygulama içi satın alma yok, internet gerekmez
- **Yaş:** App Store 4+, Google Play PEGI 3 / Herkes
- **Gizlilik politikası:** https://github.com/plustradingg-memo/Alarm-fiyat-/blob/033080797c338ccd850ced94bedb28251297b95c/ray-arasi-mobil/magaza/gizlilik-politikasi.md
- **Destek:** https://github.com/plustradingg-memo/Alarm-fiyat-/blob/033080797c338ccd850ced94bedb28251297b95c/ray-arasi-mobil/magaza/destek.md
- **Telif:** 2026 Trafik Ustası

## Görseller (`gorseller/`)

| Klasör / dosya | Nereye |
|---|---|
| `ios/` (Türkçe), `ios-en/` (İngilizce), 1320 × 2868 | App Store › iPhone 6,9" ekran görüntüleri |
| `android/` (Türkçe), `android-en/` (İngilizce), 1080 × 1920 | Google Play › Telefon ekran görüntüleri |
| `play-one-cikan-gorsel.png`, `play-one-cikan-gorsel-en.png` (1024 × 500) | Google Play › Öne çıkan görsel |
| `play-simge-512.png` | Google Play › Uygulama simgesi |

Görselleri yeniden üretmek için: `npm run paketle && node scripts/magaza.cjs` (Playwright gerekir).

## Elle doldurulan formlar

- **App Store › App Privacy:** "No, we do not collect data from this app".
- **Google Play › Uygulama içeriği:** `YAPILACAKLAR.md` içindeki tablo.
