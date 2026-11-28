# Ray Arası — sana kalan işler

Mağaza işlerinin hepsi bende (betikler, Expo'daki anahtarlar). Aşağıdakiler Apple ve Google'ın API'ye açmadığı,
yalnızca senin yapabileceğin adımlar. Toplam yaklaşık 15–20 dakika; bittiğinde bana haber vermene gerek yok,
zamanlanmış kontrol fark eder ve kalanını ben yaparım.

Hazır adresler (giriş istemeden açılır):

- Gizlilik politikası: https://github.com/plustradingg-memo/Alarm-fiyat-/blob/2d7c9c78de1f42003d9b76ee648b17596077db0e/ray-arasi-mobil/magaza/gizlilik-politikasi.md
- Destek: https://github.com/plustradingg-memo/Alarm-fiyat-/blob/2d7c9c78de1f42003d9b76ee648b17596077db0e/ray-arasi-mobil/magaza/destek.md

## App Store (Apple) — 3 dk

1. **Uygulama kaydını aç** (Apple bunu API'ye açmıyor): App Store Connect → **Apps** → **+** → **New App**
   - Platforms: **iOS** · Name: **Ray Arası** · Primary Language: **Turkish**
   - Bundle ID: **com.rayarasi.oyun** (kaydettim, listede çıkar) · SKU: `rayarasi` · User Access: Full Access
2. **App Privacy** → Get Started → **"No, we do not collect data from this app"** → **Publish** (bu form da API'de yok).

Metinler, ekran görüntüleri, kategori, yaş derecelendirmesi, fiyat, ülkeler, inceleme notu, derleme ve incelemeye
gönderme bende.

## Google Play — 15 dk

1. **Uygulamayı oluştur:** Play Console → **Uygulama oluştur** → Ad **Ray Arası** · Dil **Türkçe** · **Oyun** ·
   **Ücretsiz** → beyanları işaretle → Oluştur.
2. **İlk sürümü yükle** (Google ilk yüklemeyi yalnızca elle kabul ediyor):
   - Derleme dosyası (sürüm 1.0.0, kod 2): https://expo.dev/artifacts/eas/iMVhv1Jh_6YvwUDfkQiQ_HOkEagcvvR1sy01bmDWuwI.aab
   - **Test** → **Dahili test** → **Yeni sürüm oluştur** → Google Play uygulama imzalamasını kabul et → .aab'yi
     yükle → sürüm notu: `İlk sürüm` → **Kaydet** → **İncele** → **Dahili teste yayınla**.
3. **Uygulama içeriği formları** (API'de yok) — hazır yanıtlar:

| Form | Yanıt |
|---|---|
| Gizlilik politikası | https://github.com/plustradingg-memo/Alarm-fiyat-/blob/2d7c9c78de1f42003d9b76ee648b17596077db0e/ray-arasi-mobil/magaza/gizlilik-politikasi.md |
| Uygulama erişimi | Tüm işlevler özel erişim olmadan kullanılabilir |
| Reklamlar | Hayır, reklam içermiyor |
| İçerik derecelendirmesi | Kategori **Oyun**; şiddet, cinsellik, küfür, uyuşturucu, kumar, kullanıcı etkileşimi, konum paylaşımı, dijital satın alma sorularının **hepsine Hayır** (sonuç: PEGI 3 / Herkes) |
| Hedef kitle | **13–15, 16–17, 18+** |
| Veri güvenliği | "Uygulamanız kullanıcı verisi topluyor veya paylaşıyor mu?" → **Hayır** |
| Haber / Devlet / Finans / Sağlık | Hayır / hiçbiri |
| Mağaza ayarları | Kategori **Oyun › Bulmaca**; iletişim e-postası (herkese görünür) |

4. **Kapalı test kullanıcıları:** hesabın kişisel olduğu için Google üretime geçmeden önce en az 12 kişiyle 14 gün
   kapalı test istiyor (Planet Merge'deki gibi). **Test** → **Kapalı test** → **Test kullanıcıları** bölümünde
   Planet Merge için kullandığın e-posta listesini seç. Kapalı teste sürümü ben gönderirim.

İlk yüklemeden sonra mağaza metni, ekran görüntüleri, öne çıkan görsel, simge ve bütün sonraki sürümler bende.
