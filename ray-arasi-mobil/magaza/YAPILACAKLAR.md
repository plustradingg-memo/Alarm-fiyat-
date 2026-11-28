# Trafik Ustası / Traffic Maestro — sana kalan işler

Mağaza işlerinin hepsi bende (betikler, Expo'daki anahtarlar). Aşağıdakiler Apple ve Google'ın API'ye açmadığı,
yalnızca senin yapabileceğin adımlar. Toplam yaklaşık 15–20 dakika; bittiğinde bana haber vermene gerek yok,
zamanlanmış kontrol fark eder ve kalanını ben yaparım.

Hazır adresler (giriş istemeden açılır):

- Gizlilik politikası: https://github.com/plustradingg-memo/Alarm-fiyat-/blob/033080797c338ccd850ced94bedb28251297b95c/ray-arasi-mobil/magaza/gizlilik-politikasi.md
- Destek: https://github.com/plustradingg-memo/Alarm-fiyat-/blob/033080797c338ccd850ced94bedb28251297b95c/ray-arasi-mobil/magaza/destek.md

## App Store (Apple) — tamamlandı, incelemede

Uygulama kaydı ve App Privacy yapıldı. 1.0.0 incelemeye gönderildi (28 Kasım), onaylanınca kendiliğinden yayına girer.
Çin anakarası satıştan çıkarıldı: Apple orada oyun lisansı ve ek belgeler istiyor ("App Compliance" sayfasındaki
iki eksik bundandı). İstersen sonra eklenir.

**AB'deki 27 ülke için gerekli (senin beyanın):** App Store Connect → **Business** (ya da uygulamada **App Compliance**)
→ **Digital Services Act → Set Up**. Apple "tacir" (trader) olup olmadığını soruyor; bu beyan verilmeden oyun AB'de
satışa çıkmaz (Apple'ın verdiği durum: `TRADER_STATUS_NOT_PROVIDED`, 27 ülke). Ücretsiz, reklamsız, satın almasız ve
gelir getirmeyen bir oyun için genelde **"tacir değilim"** seçilir; tacir seçilirse adın, adresin, telefonun ve
e-postan AB mağazasında herkese gösterilir. Hukuki beyan olduğu için bunu ben yapmıyorum.

Çin anakarası kapalı kalıyor: orada oyun yayınlamak için devletin oyun lisansı (ISBN) gerekiyor; bireysel geliştirici
olarak alınamıyor. Diğer 174 ülkenin hepsi açık (AB, beyandan sonra).

<details><summary>Yapılmış adımlar</summary>


1. **Uygulama kaydını aç** (Apple bunu API'ye açmıyor): App Store Connect → **Apps** → **+** → **New App**
   - Platforms: **iOS** · Name: **Trafik Ustası: Yol Çiz** · Primary Language: **Turkish**
   - Bundle ID: **com.trafikustasi.oyun** (kaydettim, listede "Trafik Ustasi" diye çıkar) · SKU: `trafikustasi` · User Access: Full Access
   - İngilizce mağaza sayfasını ("Traffic Maestro: Draw Roads") ben eklerim.
2. **App Privacy** → Get Started → **"No, we do not collect data from this app"** → **Publish** (bu form da API'de yok).

Metinler, ekran görüntüleri, kategori, yaş derecelendirmesi, fiyat, ülkeler, inceleme notu, derleme ve incelemeye
gönderme bende.

</details>

## Google Play — kalan: kurulum formları, ülkeler, test kullanıcıları (~15 dk)

Uygulama oluşturuldu; sürüm dahili testte (son: sürüm kodu 3) ve kapalı test kanalında taslak olarak bekliyor.
**Veri güvenliği** formunu API ile ben doldurdum (veri toplanmıyor / paylaşılmıyor). Aşağıdakiler Google'ın
API'sinde yok; Play Console → **Kontrol paneli → Oyununuzun kurulumunu tamamlayın** listesinden sırayla:

| Adım | Yanıt |
|---|---|
| Gizlilik politikasını ayarlayın | https://github.com/plustradingg-memo/Alarm-fiyat-/blob/033080797c338ccd850ced94bedb28251297b95c/ray-arasi-mobil/magaza/gizlilik-politikasi.md |
| Oturum açma bilgileri | **Tüm işlevler özel erişim gerektirmeden kullanılabilir** |
| Reklam | **Hayır**, uygulamam reklam içermiyor |
| İçerik derecelendirme | E-posta adresin · Kategori **Oyun** · bütün sorulara **Hayır** (şiddet, korku, cinsellik, küfür, uyuşturucu, kumar, kullanıcı etkileşimi/paylaşım, konum paylaşımı, dijital satın alma) → Kaydet → **Derecelendirmeyi gönder** |
| Hedef kitle | **13–15, 16–17, 18 ve üzeri** · çocuklara hitap etmiyor → Hayır |
| Veri güvenliği | ✓ yapıldı (API) — listede hâlâ açık görünürse içine girip yalnızca **Gönder**'e bas |
| Resmi kurum uygulamaları | **Hayır** |
| Finans ile ilgili özellikler | **Uygulamam finansal özellik sunmuyor** |
| Sağlık | **Sağlık özelliği yok** |
| Kategori ve iletişim bilgileri | Uygulama türü **Oyun**, kategori **Bulmaca** · iletişim e-postası (mağazada herkese görünür) |

**Ülkeler (tüm ülkeler):** **Test → Kapalı test → Ülkeler/bölgeler → Ülke/bölge ekle → hepsini seç** (üretime
geçerken **Üretim → Ülkeler/bölgeler** için de aynısı). Google bunu da API'ye açmıyor.

**Kapalı test kullanıcıları:** hesap kişisel olduğu için Google üretime geçmeden önce en az 12 kişiyle 14 gün kapalı
test istiyor (Planet Merge'deki gibi). **Test → Kapalı test → Test kullanıcıları**: Planet Merge için kullandığın
e-posta listesini seç. Kapalı teste sürümü ben gönderirim (zamanlanmış kontrol formlar bitince kendiliğinden yapar).

<details><summary>Yapılmış adımlar</summary>

1. Uygulama oluşturuldu (Trafik Ustası: Yol Çiz · Türkçe · Oyun · Ücretsiz).
2. İlk sürüm elle yüklendi (Google ilk yüklemeyi yalnızca elle kabul ediyor); sonrakiler API ile.
3. Mağaza metni (TR/EN), ekran görüntüleri, öne çıkan görsel, simge: API ile.
4. Veri güvenliği: API ile (`scripts/play-veri-guvenligi.js`).

</details>
