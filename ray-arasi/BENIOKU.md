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

## Atölye: kendin kur

Ana ekranın üstündeki **45 sn Görev / Atölye: Kendin Kur** seçicisiyle Atölye'ye geçilir. Atölye'de süre ve puan
yoktur; maket tahtasına kendi ağını çizer, trafiği izlersin. Üç kartın her biri kendi örnek düzeniyle açılır ve
çizdiğin her şey o kart için ayrı kaydedilir. Hepsinde aynı araçlar vardır, yani yolu, rayı ve havalimanını tek
tahtada birlikte kurabilirsin.

**Çizmek:** alttaki araçlardan birini seç (Yol, Ray, Taksi yolu, Pist) ve parmağını kareler üzerinde sürükle.
Tahtanın kenarından dışarı doğru çizersen araçlar ve trenler oradan girip çıkar.

**Kesişim türü** (ikinci sıra), çizdiğin hat başka bir hattın üstünden geçtiğinde ne olacağını seçer:

| Seçim | Yol | Ray | Havalimanı |
|---|---|---|---|
| **Kavşak** | Aynı seviyede kavşak, ışıklı | Hatta değen hat makas olur; dik kesen hat hemzemin ray kesişimi olur | Taksi yolu piste bağlanır, pist girişinde dur ışıkları |
| **Köprü** | Yeni yol diğerinin üstünden geçer | Ray köprüsü | Taksi yolu köprüsü |
| **Alt geçit** | Yeni yol altından batıp çıkar | Ray tüneli | Taksi yolu alt geçidi |

Yol ile ray aynı seviyede kesişirse otomatik bariyerli **hemzemin geçit** kurulur. Yol ya da ray pisti kesince
kendiliğinden pistin altından alt geçitle geçer. Köprü ve alt geçidin iki yanında rampa için düz birer kare gerekir.
Kurala uymayan çizim yapılmaz; nedeni ekranda kırmızı bir notla yazılır. **Sil** aracı üzerinden geçtiğin kareleri
temizler, **↶** son değişikliği geri alır. Sağ üstteki **⋯** menüsünden örnek düzen yüklenir ya da tahta temizlenir.
**−/+** trafik yoğunluğunu ayarlar.

**Yapay zekâ (YZ düğmesi açıkken):**
- Kavşak ışıkları her yöndeki bekleyen araç sayısına ve bekleme süresine bakarak kendiliğinden değişir.
  Açık yönde kavşağa girmiş son araç çıkmadan öbür yön yeşil olmaz. Kavşak boşken ışıklar sarı yanıp söner.
- Hemzemin geçitte tren yaklaşınca kırmızı ışıklar yanıp söner, bariyerler iner. Araçlar raydan çekilmeden tren
  geçmez.
- Ray sinyalleri hattı bloklara ayırır. Makaslar trenleri boş hatta yönlendirir. Çıkmaz ray uçları istasyondur:
  tren durur, bekler ve geri döner. Karşılıklı sıkışan trenlerden biri geri çekilir.
- Kule, bekleyen uçakları sıraya koyup iniş izni verir. İnen uçak kapıya (taksi yolunun çıkmaz ucu) gider,
  bekler, geri itilir ve kalkar. Pist doluyken taksi yolundaki dur ışıkları kırmızı kalır.

**Elle yönetim (YZ kapalıyken):** İzle aracıyla bir kavşağa dokunarak ışığı değiştirirsin. Makasa dokunarak yönünü
çevirirsin. Bekleyen bir uçağa dokunarak iniş ya da kalkış izni verirsin. Güvenlik kilitleri (bariyerler, blok
sinyalleri, pist doluluğu) elle yönetimde de çalışmaya devam eder.

Atölye çizimleri tarayıcının yerel depolamasında saklanır; sayfayı yenileyince tahta olduğu gibi gelir.

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
├── js/menu.js              Ana ekrandaki üç canlı sahne ve Görev/Atölye seçici
├── js/ws-grid.js           Atölye: ızgara, çizim/silme kuralları, örnek düzenler
├── js/ws-net.js            Atölye: şerit ve hat geometrisi, rampa yükseklikleri, rota arama
├── js/ws-build.js          Atölye: maket tahtası, köprü/alt geçit yapıları, ışık ve sinyaller
├── js/ws-sim.js            Atölye: araçlar, trenler, uçaklar ve yapay zekâ denetleyicileri
├── js/workshop.js          Atölye ekranı: araç çubuğu, parmakla çizim, geri al
├── js/app.js               Oyun döngüsü, ekranlar, duraklatma, rekorlar
├── js/vendor/three.min.js  three.js r149 (MIT lisansı: js/vendor/three.LICENSE)
├── assets/                 Uygulama ikonları
├── ekran-goruntuleri/      Ana ekran, üç mod, masaüstü, üç özel durum, tur sonu ve Atölye görüntüleri
├── manifest.webmanifest    "Ana ekrana ekle" bilgileri
└── test/kontrol.cjs        İsteğe bağlı uçtan uca kontrol betiği
```

Bütün görseller kodla üretilir (üç boyutlu modeller, dokular, sesler); dışarıdan görsel ya da ses dosyası yüklenmez.

## Kontrol betiği (isteğe bağlı)

Gerçek dokunuşlarla menüyü, üç modu, tur sonunu, "Tekrar Oyna" ve "Mod Seç" düğmelerini, rekor kaydını,
sekme değişince duraklamayı ve yukarıdaki üç özel durumu sınar. Atölye için şunları dener: parmakla yol çizme,
kavşak, köprü, alt geçit, hatalı çizimin reddi, silme, geri alma, yapay zekâ ışıkları, elle yönetim, kaydın
korunması, trenler, hemzemin geçit ve uçak iniş-kalkışları:

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
