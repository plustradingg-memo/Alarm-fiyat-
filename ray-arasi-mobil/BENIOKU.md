# Ray Arası — mobil uygulama (Expo)

Bu klasör, `../ray-arasi` içindeki oyunu **App Store** ve **Google Play** için bir Expo (React Native) uygulamasına
sarar. Oyun kodu değişmez: `scripts/paketle.cjs` oyunun HTML, CSS, JS dosyalarını ve yazı tiplerini tek bir HTML'e
gömer (`oyun/oyun.js`), uygulama da bunu tam ekran bir WebView içinde **çevrimdışı** çalıştırır. Oyun dışarıya
hiçbir istek göndermez; ilerleme cihazda saklanır.

- Expo SDK 58 (React Native 0.88), `react-native-webview`, `expo-splash-screen`, `react-native-safe-area-context`
- Dikey ekran, iPhone (iPad'de iPhone uyumluluk modunda açılır) ve Android telefon/tablet
- Android geri tuşu: bölümde ya da atölyedeyken ana ekrana döner, ana ekranda uygulamadan çıkar
- Uygulama arka plana geçince ses kesilir, çalışan bölüm duraklar
- Çentik ve alt çubuk alanı o anki ekranın rengini alır

## Klasörler

```
ray-arasi-mobil/
├── App.js                  Uygulama kabuğu (WebView, geri tuşu, arka plan, güvenli alan)
├── app.json                Ad, paket kimliği (com.rayarasi.oyun), simgeler, açılış ekranı, izinler
├── eas.json                EAS derleme ve mağazaya gönderme profilleri
├── oyun/
│   ├── oyun.js             Üretilir (git'e girmez): tek HTML olarak paketlenmiş oyun
│   └── fontlar/            Overpass yazı tipleri (SIL Open Font License, OFL.txt)
├── assets/                 Uygulama simgesi, Android uyarlanabilir simge katmanları, açılış görseli
├── magaza/                 Mağaza metinleri, gizlilik politikası, ekran görüntüleri, Play görselleri
└── scripts/
    ├── paketle.cjs         Oyunu ../ray-arasi'den paketler (npm install sonrası kendiliğinden çalışır)
    ├── simge.cjs           Simgeleri SVG'den üretir (Playwright gerekir)
    └── magaza.cjs          Mağaza ekran görüntülerini üretir (Playwright gerekir)
```

## Geliştirme

```bash
npm install
```

```bash
npm start
```

Oyunda bir değişiklik yaptıktan sonra `npm run paketle` uygulamadaki kopyayı yeniler (`npm start` bunu kendisi de yapar).
Paket eklerken her zaman `npx expo install <paket>` kullan; SDK ile uyumlu sürümü seçer.

## Derleme ve mağazaya gönderme

**Kurallar** (sahibinin isteği, 28 Kasım 2026):

- Bütün derlemeler Expo'da (EAS) yapılır. Ekip hesabı `plustradinggs-team` (Starter planı), proje `@plustradinggs-team/ray-arasi`.
- **Derlemeden önce sahibine sorulur.** Küçük değişiklikler bir sonraki sürümle gidebilir; kararı sahibi verir.
- Derlemeden sonra App Store ve Google Play adımları betiklerle yapılır, sahibine yalnızca sonuç yazılır. iPhone
  sürümü onaylanınca kendiliğinden yayına girer. Reddedilirse sebebi okunup düzeltilir. İnceleme sonuçları
  zamanlanmış kontrolle izlenir.
- Anahtarlar Expo ekip hesabında durur ve her çalışmada oradan okunur, diske yazılmaz: Apple için App Manager
  rolündeki App Store Connect API anahtarı, Google için Play Console'da yönetici olan hizmet hesabı.
- Planet Merge (`plustradingg-memo/9-Kas-m-`) başka bir oturumda geliştirilir: o depoya ve o uygulamanın mağaza
  sayfalarına dokunulmaz. Buradaki betikler oradakilerden uyarlanmıştır.

**Bir kez yapılanlar** (28 Kasım 2026): Apple'da `com.rayarasi.oyun` paket kimliği kaydedildi
(`scripts/eas-ios-anahtar.js` App Store Connect anahtarını bu uygulamanın iOS kimlik bilgilerine bağladı,
`scripts/eas-ios-imza.js` ekibin dağıtım sertifikasıyla bir App Store profili oluşturup Expo'ya bağladı). Bu sayede
iOS derlemesi bilgisayarsız, etkileşimsiz yapılır. Android imza anahtarını EAS ilk derlemede oluşturdu.

**Her sürümde:**

1. Oyun değiştiyse `npm run paketle`. `app.json` içindeki `version` ile `magaza/metinler.json` içindeki `surum`
   aynı olmalı; `yenilikler` (TR/EN) ve gerekiyorsa açıklama ve görseller güncellenir.
2. Sahibine sorulur, onay gelirse derlenir:

```bash
npx eas-cli build --platform ios --profile production --non-interactive --no-wait
```

```bash
npx eas-cli build --platform android --profile production --non-interactive --no-wait
```

3. **iPhone:** derleme App Store Connect'e yüklenir, sonra sürüm hazırlanıp incelemeye gönderilir. Betik
   işlenmeyi bekler, sürümü açar, derlemeyi bağlar, metinleri ve değişmişse ekran görüntülerini yükler; ilk
   sürümde telif, kategori, yaş derecelendirmesi, ücretsiz fiyat ve ülkeleri de ayarlar.

```bash
npx eas-cli submit --platform ios --id <derleme-kimliği> --profile production --non-interactive --no-wait
```

```bash
NODE_USE_ENV_PROXY=1 node scripts/ios-yayinla.js --build <derleme-numarası>
```

4. **Android:** AAB indirilir (`npx eas-cli build:view <kimlik> --json` → `artifacts.buildUrl`) ve yüklenir:

```bash
NODE_USE_ENV_PROXY=1 node scripts/play-yayinla.js --aab <dosya.aab> --kanal alpha
```

5. Durum (yalnızca okur): `npm run durum`.

Node'un `fetch`i bu ortamda vekil sunucuyu ancak `NODE_USE_ENV_PROXY=1` ile kullanır. Gereken ağ izinleri:
`api.expo.dev`, `expo.dev`, `wf-artifacts.eascdn.net`, `api.appstoreconnect.apple.com`,
`northamerica-1.object-storage.apple.com`, `androidpublisher.googleapis.com`, `oauth2.googleapis.com`.

Google, yeni bir uygulamanın **ilk** sürümünü yalnızca Play Console'dan elle yüklemeye izin verir; Apple da uygulama
kaydının ilk açılışını yalnızca App Store Connect sitesinden yaptırır. Sahibine kalan bu adımlar
`magaza/YAPILACAKLAR.md` dosyasında.

## Mağaza materyalleri

`magaza/metinler.json` iki mağazanın bütün metinlerini (ad, alt başlık, açıklamalar, anahtar kelimeler, sürüm
notları, inceleme notu, yaş derecelendirmesi yanıtları) tek dosyada tutar; betikler buradan okur.
`magaza/metinler.md` aynı bilgilerin okunur hâli ve form yanıtlarıdır. `magaza/gorseller/` App Store 6,9" (1320 × 2868) ve Google Play
(1080 × 1920) ekran görüntülerini, Play öne çıkan görselini (1024 × 500) ve 512 × 512 simgeyi içerir.
Gizlilik politikası ve destek sayfası depoda (`magaza/gizlilik-politikasi.md`, `magaza/destek.md`) ve GitHub'da
giriş istemeden açılır; adresleri `magaza/metinler.json` ve `magaza/YAPILACAKLAR.md` dosyalarında.

Sana kalan adımlar (hesap gerektiren işler) ve hazır form yanıtları: `magaza/YAPILACAKLAR.md`.

Görselleri yeniden üretmek için (Playwright ve Chromium gerekir):

```bash
npm run paketle && node scripts/magaza.cjs
```
