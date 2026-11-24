# RAY ARASI

Masanın üzerine kurulmuş canlı bir maket şehrin trafiğini tek elle yönettiğin, Türkçe, dikey ekranlı bir oyun.
Bir tur 45 saniye sürer. Ana ekrandan üç moddan birini seçersin:

| Mod | Tek kontrol | Puan | Tur nasıl biter |
|---|---|---|---|
| **Demiryolu** — Makası sen yönet | Makasa dokun: ana hat ↔ yan hat | Köprüyü güvenle geçen her tren 1 puan | İki tren tek hatta karşı karşıya kalırsa acil fren |
| **Karayolu** — Kavşak sende | Ortadaki ışığa dokun: kuzey-güney ↔ doğu-batı | Kavşaktan çıkan her araç 1 puan | Bir yolun kuyruğu uyarı çizgisine dayanır ve 3 saniyede yol açılmazsa |
| **Hava Trafiği** — İniş sırasını sen ver | İndirmek istediğin uçağa dokun | Teker koyan her uçak 1 puan | Son bekleme turunu bitiren uçak başka meydana yönelirse |

Her modun rekoru ayrı kaydedilir. Araçların geliş sırası her gün değişir; aynı gün aynı modu tekrar oynayan
herkes aynı trafik akışıyla karşılaşır, böylece önceki kararını geliştirebilirsin.

## Çalıştırma

**En kolayı:** `index.html` dosyasına çift tıkla. Oyun internet olmadan da açılır (yalnızca yazı tipi
çevrimdışıyken sistem yazı tipine düşer).

**Telefonda oynamak için** klasörü yerel ağda yayınla ve telefondan aç:

```bash
cd ray-arasi
python3 -m http.server 8080
```

Sonra telefonun tarayıcısından `http://<bilgisayarın-ip-adresi>:8080` adresine gir. Tarayıcı menüsünden
"Ana ekrana ekle" dersen tam ekran uygulama gibi açılır.

Herhangi bir statik barındırma (GitHub Pages, Netlify vb.) da olur; derleme adımı yoktur.

## Kontroller

- **Dokunma / fare:** yukarıdaki tablodaki tek dokunuş.
- **Klavye (masaüstü):** Demiryolu ve Karayolu'nda `Boşluk` veya `Enter`; Hava Trafiği'nde `1`, `2`, `3`
  (soldaki, sağdaki ve alttaki bekleme rotası). `Esc` veya `P` duraklatır.
- Başka bir sekmeye ya da uygulamaya geçince süre kendiliğinden durur; dönünce "Devam Et" ile sürer.
- Ses ana ekrandaki ve duraklatma ekranındaki hoparlör düğmesiyle açılıp kapanır. Oyun sessizken de
  anlaşılır: her olayın ışıklı, renkli ya da yazılı bir karşılığı vardır.

## Oyuncunun dokunuşuna verilen karşılıklar

- **Son vagon hâlâ makastayken makasa dokunmak:** makas dönmez, halka kırmızı titrer,
  "Kilitli · son vagon geçsin" yazısı ve kısa bir uyarı sesi çıkar. Son vagon geçince aynı dokunuş makası çevirir.
- **Otobüs kavşağın ortasındayken ışığı değiştirmek:** açık yön hemen sarıya döner, yeni araç girmez;
  kavşak turuncu çerçeveyle "Kavşak boşalıyor" der. Otobüsün arka tamponu kavşaktan çıktığı anda diğer yön yeşil olur.
  Bu sırada tekrar dokunursan değişiklik geri alınır.
- **İlk uçak teker koyarken ikinci uçağı seçmek:** pist ışıkları kırmızı yanıp söner, "Pist dolu · beklemede"
  yazısı çıkar ve uçak bekleme dönüşüne devam eder. Pistten ayrılan uçak taksi yoluna geçince "Pist boş" yazar.

## Klasör yapısı

```
ray-arasi/
├── index.html              Sayfa ve arayüz iskeleti
├── css/style.css           Arayüz (levha tarzı göstergeler, tur sonu ekranı)
├── js/core.js              Matematik, günlük tohum, kayıt, ses (WebAudio), yollar, geometri yardımcıları
├── js/models.js            Oyuncak maket modelleri (tren, vagon, araçlar, uçak, ağaç, bina, sinyal)
├── js/rail.js              Demiryolu modu
├── js/road.js              Karayolu modu
├── js/air.js               Hava Trafiği modu
├── js/menu.js              Ana ekrandaki üç canlı sahne
├── js/app.js               Oyun döngüsü, ekranlar, duraklatma, rekorlar
├── js/vendor/three.min.js  three.js r149 (MIT lisansı: js/vendor/three.LICENSE)
├── assets/                 Uygulama ikonları
├── ekran-goruntuleri/      Ana ekran, üç mod, masaüstü, üç özel durum ve tur sonu görüntüleri
├── manifest.webmanifest    "Ana ekrana ekle" bilgileri
└── test/kontrol.cjs        İsteğe bağlı uçtan uca kontrol betiği
```

Bütün görseller kodla üretilir (üç boyutlu modeller, dokular, sesler); dışarıdan görsel ya da ses dosyası yüklenmez.

## Kontrol betiği (isteğe bağlı)

Gerçek dokunuşlarla menüyü, üç modu, tur sonunu, "Tekrar Oyna" ve "Mod Seç" düğmelerini, rekor kaydını,
sekme değişince duraklamayı ve yukarıdaki üç özel durumu sınar:

```bash
npm i -D playwright
npx playwright install chromium
node test/kontrol.cjs
```

Ekran görüntüleri `test/cikti/` klasörüne yazılır.

## Teknik notlar

- Sabit adımlı (1/60 sn) simülasyon kullanılır; aynı gün aynı mod her cihazda aynı akışı üretir.
- Günlük tohum: yerel tarih + mod adı. Yalnızca geliş sırası, yönü ve araç türü değişir; zorluk eğrisi her gün aynıdır.
- Rekorlar tarayıcının yerel depolamasında (`localStorage`) tutulur; gizli pencerede kalıcı olmayabilir.
- Gereksinim: WebGL destekleyen güncel bir tarayıcı (Chrome, Safari, Firefox, Edge).
