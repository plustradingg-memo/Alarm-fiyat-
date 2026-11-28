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

## Derleme ve mağazaya gönderme (EAS)

> **Kural:** Her derlemeden önce proje sahibine "geliştirmeye devam mı, derleyip mağazaya sunayım mı?" diye sorulur.
> Derleme yalnızca onaydan sonra başlatılır.

Gerekenler:

1. **Expo hesabı** (ücretsiz) ve bir erişim anahtarı (`EXPO_TOKEN`). İlk seferde projeyi hesaba bağla:
   `npx eas-cli@latest init` (app.json'a `extra.eas.projectId` ekler).
2. **Google Play Console** geliştirici hesabı. Uygulamayı Play Console'da oluştur. **İlk AAB dosyasını Play Console'a
   elle yükle** (Google, API ile ilk yüklemeye izin vermez). Sonraki sürümler için bir Google Cloud hizmet hesabı
   anahtarı oluşturup Expo panosuna ekle; `eas submit` gerisini yapar.
3. **Apple Developer Program** üyeliği. App Store Connect'te uygulamayı `com.rayarasi.oyun` paket kimliğiyle oluştur,
   bir App Store Connect API anahtarı üret ve Expo panosuna ekle; imzalama sertifikalarını EAS kendisi yönetir.

Komutlar:

```bash
npm run derle:android
```

```bash
npm run derle:ios
```

```bash
npm run gonder:android
```

```bash
npm run gonder:ios
```

Sürüm adı `app.json` içindeki `version` alanıdır (ör. 1.0.0 → 1.0.1). Derleme numaraları (`versionCode`,
`buildNumber`) EAS sunucusunda tutulur ve her üretim derlemesinde kendiliğinden artar. Android gönderimleri önce
**dahili test** kanalına taslak olarak gider; yayına almayı Play Console'dan yaparsın.

`deneme` profili, telefona doğrudan kurulabilen bir Android APK'sı üretir (`eas build -p android --profile deneme`).

## Mağaza materyalleri

`magaza/metinler.md` iki mağazanın bütün metin alanlarını (ad, alt başlık, kısa ve tam açıklama, anahtar kelimeler,
yaş sınırı, gizlilik yanıtları) içerir. `magaza/gorseller/` App Store 6,9" (1320 × 2868) ve Google Play
(1080 × 1920) ekran görüntülerini, Play öne çıkan görselini (1024 × 500) ve 512 × 512 simgeyi içerir.
Gizlilik politikası https://claude.ai/artifact/DxHtw1N5hzeWtr92DNNGgT adresinde yayımlandı (kaynağı
`magaza/gizlilik-politikasi.html`); sayfa Paylaş menüsünden herkese açık yapılınca iki mağazaya da bu adres yazılır.

Görselleri yeniden üretmek için (Playwright ve Chromium gerekir):

```bash
npm run paketle && node scripts/magaza.cjs
```
