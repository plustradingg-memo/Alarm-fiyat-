# Ray Arası — sana kalan işler

Hazırlanabilen her şey hazır: uygulama, simgeler, ekran görüntüleri, metinler, gizlilik ve destek sayfaları,
App Store bilgileri (`store.config.json`, tek komutla yüklenir), Expo projesi. Aşağıdakiler yalnızca senin
hesaplarınla yapılabiliyor. Sırayla gidersen toplam yaklaşık 30–40 dakika.

**Hazır adresler (giriş istemeden açılır, iki mağazaya da bunları yaz)**

- Gizlilik politikası: https://github.com/plustradingg-memo/Alarm-fiyat-/blob/2d7c9c78de1f42003d9b76ee648b17596077db0e/ray-arasi-mobil/magaza/gizlilik-politikasi.md
- Destek: https://github.com/plustradingg-memo/Alarm-fiyat-/blob/2d7c9c78de1f42003d9b76ee648b17596077db0e/ray-arasi-mobil/magaza/destek.md

---

## A. App Store (Apple)

### A1. API anahtarı oluştur ve Expo'ya yükle (5 dk) — iOS derlemesi bunu bekliyor

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys** → **+**
   (Generate API Key). Ad: `EAS`, erişim: **Admin**.
2. **.p8 dosyasını indir** (yalnızca bir kez indirilebilir). **Key ID** ve sayfanın üstündeki **Issuer ID**'yi not al.
3. expo.dev → **plustradinggs-team** → **ray-arasi** projesi → **Credentials** → **iOS** → `com.rayarasi.oyun` →
   **App Store Connect API Key** ekle (.p8 + Key ID + Issuer ID). Bu satırı göremezsen bana "derle" demen yeter:
   ilk iOS denemesinden sonra görünür.

### A2. Uygulama kaydını oluştur (3 dk)

1. App Store Connect → **Apps** → **+** → **New App**
   - Platforms: **iOS** · Name: **Ray Arası** · Primary Language: **Turkish**
   - Bundle ID: **com.rayarasi.oyun** (listede yoksa: developer.apple.com → Certificates, Identifiers & Profiles →
     Identifiers → **+** → App IDs → App → Explicit: `com.rayarasi.oyun`, açıklama `Ray Arasi`)
   - SKU: `rayarasi` · User Access: Full Access
2. Uygulamanın **App Information** sayfasındaki **Apple ID** numarasını bana gönder. **Bana vermen gereken tek bilgi bu.**

Metinler, ekran görüntüleri, kategoriler, yaş derecelendirmesi, destek ve gizlilik adresleri, telif satırını ben
yüklerim (`eas metadata:push`).

### A3. Benim yükleyemediğim üç alan (5 dk, derlemeden sonra)

1. **App Privacy** → Get Started → **"No, we do not collect data from this app"** → Publish.
2. **Pricing and Availability** → Price: **Free** → bütün ülkeler.
3. **App Review Information** → adın, telefonun, e-postan (yalnızca Apple görür). Sign-in required: **kapalı**.
   Notes alanına yapıştır:
   > Oyun tamamen çevrimdışıdır, hesap ya da giriş gerekmez. İlk bölüm açıktır; parmağınızı bir evin önündeki
   > işaretten aynı renkteki binaya sürükleyip ▶ düğmesine basın.

Sonra sürüm sayfasında derlemeyi seç → **Add for Review** → **Submit**. Onaylanınca kendiliğinden yayına girer.

Not: Apple, AB'de satış için **tacir (trader) beyanı** ister (Business → Agreements / DSA). Tacir dersen adres,
telefon ve e-postan AB mağazasında görünür; değilsen "not a trader" seç.

---

## B. Google Play

### B1. Uygulamayı oluştur (3 dk)

Play Console → **Create app** → Ad: **Ray Arası** · Varsayılan dil: **Türkçe** · **Oyun** · **Ücretsiz** → iki
beyanı işaretle → Create.

### B2. Uygulama içeriği formları (10 dk) — hazır yanıtlar

| Form | Yanıt |
|---|---|
| Gizlilik politikası | https://github.com/plustradingg-memo/Alarm-fiyat-/blob/2d7c9c78de1f42003d9b76ee648b17596077db0e/ray-arasi-mobil/magaza/gizlilik-politikasi.md |
| Uygulama erişimi | Tüm işlevler özel erişim olmadan kullanılabilir |
| Reklamlar | Hayır, reklam içermiyor |
| İçerik derecelendirmesi | Kategori **Oyun**; şiddet, cinsellik, küfür, uyuşturucu, kumar, kullanıcı etkileşimi, konum paylaşımı, dijital satın alma sorularının **hepsine Hayır** (sonuç: PEGI 3 / Herkes) |
| Hedef kitle | **13–15, 16–17, 18+** (13 altını seçersen "Aileler" programının ek kuralları gelir) |
| Veri güvenliği | "Uygulamanız kullanıcı verisi topluyor veya paylaşıyor mu?" → **Hayır** |
| Haber uygulaması / Devlet / Finans / Sağlık | Hayır / hiçbiri |

### B3. Mağaza girişi (10 dk)

- Uygulama adı, kısa ve tam açıklama: `magaza/metinler.md` içinden kopyala.
- Uygulama simgesi: `magaza/gorseller/play-simge-512.png`
- Öne çıkan görsel: `magaza/gorseller/play-one-cikan-gorsel.png`
- Telefon ekran görüntüleri: `magaza/gorseller/android/` içindeki 6 dosya.
- Mağaza ayarları: Kategori **Oyun › Bulmaca**; iletişim e-postası (herkese görünür).

### B4. İlk yükleme (5 dk, Android derlemesinden sonra)

1. Ben derleyince Expo'daki derleme sayfasında **.aab** dosyası olur; indir.
2. Play Console → **Test** → **Kapalı test** (ya da Dahili test) → **Yeni sürüm oluştur** → Google Play uygulama
   imzalamasını kabul et → .aab'yi yükle → sürüm notu: `İlk sürüm` → **İncelemeye gönder**.
3. **Kişisel ve yeni bir geliştirici hesabıysa:** Google, üretime geçmeden önce en az **12 test kullanıcısıyla
   14 gün** kapalı test ister (Play Console bunu açıkça gösterir). Test kullanıcılarının e-postalarını kapalı test
   listesine ekle. Şirket hesaplarında bu şart yoktur.

İlk yüklemeden sonraki sürümleri otomatik gönderebilmem için (isteğe bağlı): Google Cloud'da bir hizmet hesabı ve
JSON anahtarı oluştur, Play Console → Kullanıcılar ve izinler'de bu hesaba yayın izni ver, JSON'u expo.dev →
ray-arasi → Credentials → Android → Google Service Account Key olarak yükle.

---

## Bana söylemen yeterli olanlar

- "**derle**" → Android derlemesini hemen başlatırım; iOS'u A1 bitince derleyip App Store Connect'e yüklerim.
- **Apple ID numarası** (A2) → App Store bilgilerini ve derlemeyi gönderirim.
