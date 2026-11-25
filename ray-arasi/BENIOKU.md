# RAY ARASI

Masanın üzerindeki maket tahtasına kendi yolunu, demiryolunu ve havalimanını kurduğun, trafiği yapay zekâya
yönettirdiğin ya da elle yönettiğin Türkçe, dikey ekranlı bir oyun. Süre ve puan yok: kur, izle, dene.

Ana ekranda üç kart vardır. Her kart kendi örnek düzeniyle açılır ve çizdiğin her şey o kart için ayrı kaydedilir:

| Kart | Örnek düzende neler var |
|---|---|
| **Demiryolu** | İki ana hat, makaslı geçişler, geçiş yan hattı, ray köprüsü, hemzemin ray kesişimi, iki istasyon, bariyerli hemzemin geçitler, rayların altından geçen yol, ayrı bir döngü hattı, üç otopark |
| **Karayolu** | Üç cadde, dört sokak, ışıklı kavşaklar, bir köprü, bir alt geçit, altı katlı otopark |
| **Havalimanı** | İki pist, paralel taksi yolu, kapılar, pistin altından geçen yol, taksi yolunu kesen ışıklı yol, havalimanı treni, dört otopark |

Tahta 12 × 20 karedir. Hepsinde aynı araçlar vardır, yani yolu, rayı ve havalimanını tek tahtada birlikte kurabilirsin.

## Araçlar nereye gider?

Arabalar amaçsızca dolaşmaz. Her araç bir yolculuğa çıkar ve gideceği yeri baştan bilir:

- **Şehir dışından gelir** (tahtanın kenarındaki yol ucu) ve bir otoparka ya da başka bir şehir çıkışına gider.
- **Otoparka varınca** bariyer kalkar, araç içeri girip kaybolur, binanın çatısında bir yer dolar.
- **Bir süre sonra otoparktan başka bir araç çıkar** ve başka bir otoparka ya da şehir dışına gider. Dolu otopark
  daha sık araç gönderir; dolu otoparkın ışığı kırmızı yanar ve oraya yeni araç yönlendirilmez.
- Araçlar en kısa yolu seçer, U dönüşü yapmaz, bir otoparkın içinden geçip gitmez.
- Otoparkın caddeye bağlandığı yerde ışık yoktur: otoparktan çıkan araç ana yoldan gelene yol verir.

## Kurmak

Alttaki çubuktan bir araç seç (Yol, Ray, Taksi yolu, Pist) ve parmağını kareler üzerinde sürükle. Tahtanın
kenarından dışarı doğru çizersen araçlar ve trenler oradan girip çıkar (şehir dışı).

**Otopark** aracıyla bir yolun yanındaki boş kareye dokun: oraya katlı otopark kurulur ve yola bağlanır. Tahtanın
içinde biten her yol ucu da otomatik olarak otopark olur.

**Kesişim türü** (ikinci sıra), çizdiğin hat başka bir hattın üstünden geçtiğinde ne olacağını seçer:

| Seçim | Yol | Ray | Havalimanı |
|---|---|---|---|
| **Kavşak** | Aynı seviyede kavşak, ışıklı | Hatta değen hat makas olur; dik kesen hat hemzemin ray kesişimi olur | Taksi yolu piste bağlanır, pist girişinde dur ışıkları |
| **Köprü** | Yeni yol diğerinin üstünden geçer | Ray köprüsü | Taksi yolu köprüsü |
| **Alt geçit** | Yeni yol altından batıp çıkar | Ray tüneli | Taksi yolu alt geçidi |

- Yol ile ray aynı seviyede kesişirse otomatik bariyerli **hemzemin geçit** kurulur.
- Yol ya da ray pisti keserse kendiliğinden pistin altından alt geçitle geçer.
- Köprü ve alt geçidin iki yanında rampa için düz birer kare gerekir.
- Kurala uymayan çizim yapılmaz; nedeni ekranda kırmızı bir notla yazılır.
- **Sil** aracı üzerinden geçtiğin kareleri temizler, **↶** son değişikliği geri alır.
- Sağ üstteki **⋯** menüsünden örnek düzen yüklenir ya da tahta temizlenir. **−/+** trafik yoğunluğunu ayarlar.

## Görünüm

- Açılışta tahtanın tamamı görünür.
- **İki parmakla** açıp kapatarak yakınlaşıp uzaklaşırsın; iki parmağı birlikte sürükleyince harita kayar.
- **İzle** aracıyla tek parmakla sürükleyince harita kayar. Diğer araçlarla tek parmak çizer.
- Sağdaki **+ / −** düğmeleri yakınlaştırır ve uzaklaştırır, **⤢** tüm tahtayı yeniden gösterir.
- Masaüstünde fare tekerleği yakınlaştırır, sağ tuşla sürükleme kaydırır. Ok tuşları kaydırır, `+` `−` `0`
  yakınlaştırır, `Ctrl+Z` geri alır.

## Yapay zekâ

**YZ düğmesi açıkken:**
- Kavşak ışıkları her yöndeki bekleyen araç sayısına ve bekleme süresine bakarak kendiliğinden değişir.
  Açık yönde kavşağa girmiş son araç çıkmadan öbür yön yeşil olmaz. Kavşak boşken ışıklar sarı yanıp söner.
- Hemzemin geçitte tren yaklaşınca kırmızı ışıklar yanıp söner, bariyerler iner. Araçlar raydan çekilmeden tren
  geçmez.
- Ray sinyalleri hattı bloklara ayırır; iki tren aynı bloğa giremez. Makaslar trenleri boş hatta yönlendirir.
  Çıkmaz ray uçları istasyondur: tren durur, bekler ve geri döner. Karşılıklı sıkışan trenlerden biri geri çekilir.
- Kule, bekleyen uçakları sıraya koyup iniş izni verir. İnen uçak kapıya (taksi yolunun çıkmaz ucu) gider,
  bekler, geri itilir ve kalkar. Pist doluyken taksi yolundaki dur ışıkları kırmızı kalır.

**YZ kapalıyken** İzle aracıyla bir kavşağa dokunarak ışığı değiştirirsin. Makasa dokunarak yönünü çevirirsin.
Bekleyen bir uçağa dokunarak iniş ya da kalkış izni verirsin. Güvenlik kilitleri (bariyerler, blok sinyalleri,
pist doluluğu) elle yönetimde de çalışmaya devam eder.

Çizimler tarayıcının yerel depolamasında saklanır; sayfayı yenileyince tahta olduğu gibi gelir. Önceki sürümün
büyük tahtasında kalmış bir çizim varsa yeni örnek düzen açılır; **↶** ile eski çizim yeni tahtanın ortasına
yerleştirilmiş olarak geri gelir (tahtaya sığmayan kenarlar kesilir).

## Çalıştırma

**En kolayı:** `index.html` dosyasına çift tıkla. Oyun internet olmadan da açılır; yalnızca yazı tipi
çevrimdışıyken sistem yazı tipine geçer.

**Telefonda oynamak için** klasörü yerel ağda yayınla ve telefondan aç:

```bash
cd ray-arasi
python3 -m http.server 8080
```

Sonra telefonun tarayıcısından `http://<bilgisayarın-ip-adresi>:8080` adresine gir. Tarayıcı menüsünden
"Ana ekrana ekle" dersen tam ekran uygulama gibi açılır. Herhangi bir statik barındırma (GitHub Pages, Netlify vb.)
da olur; derleme adımı yoktur.

## Klasör yapısı

```
ray-arasi/
├── index.html              Sayfa ve arayüz iskeleti
├── css/style.css           Arayüz (emaye levha tarzı düğmeler ve araç çubuğu)
├── js/core.js              Matematik, kayıt, ses (WebAudio), yollar, geometri yardımcıları
├── js/models.js            Oyuncak maket modelleri (tren, vagon, araçlar, uçak, ağaç, bina, ışık, sinyal)
├── js/ws-grid.js           Izgara, çizim/silme kuralları, örnek düzenler
├── js/ws-net.js            Şerit ve hat geometrisi, rampa yükseklikleri, kavşak çakışmaları, rota arama
├── js/ws-build.js          Maket tahtası, köprü/alt geçit yapıları, katlı otoparklar, ışıklar, bariyerler, sinyaller
├── js/ws-sim.js            Araç yolculukları ve otoparklar, trenler, uçaklar, yapay zekâ denetleyicileri
├── js/workshop.js          Atölye ekranı: araç çubuğu, parmakla çizim, yakınlaştırma/kaydırma, geri al
├── js/menu.js              Ana ekrandaki üç canlı sahne
├── js/app.js               Oluşturucu, ekranlar ve döngü
├── js/vendor/three.min.js  three.js r149 (MIT lisansı: js/vendor/three.LICENSE)
├── assets/                 Uygulama ikonları
├── ekran-goruntuleri/      Ana ekran, üç atölye, otopark ve diğer yakın planlar, masaüstü görüntüsü
├── manifest.webmanifest    "Ana ekrana ekle" bilgileri
└── test/kontrol.cjs        İsteğe bağlı uçtan uca kontrol betiği
```

Bütün görseller kodla üretilir (üç boyutlu modeller, dokular, sesler); dışarıdan görsel ya da ses dosyası yüklenmez.

## Kontrol betiği (isteğe bağlı)

Gerçek dokunuş ve sürüklemelerle şunları dener: ana ekran, üç atölye, 12 × 20 tahta, parmakla yol çizme, kavşak,
köprü, alt geçit, hatalı çizimin reddi, silme, geri alma, Otopark aracı, araçların otoparka girip kaybolması ve
otoparktan yeni araçların çıkması, U dönüşü ve takılan araç olmaması, + / − / tümü düğmeleri, tek parmakla kaydırma,
iki parmakla yakınlaştırma, yapay zekâ ışıkları, elle yönetim, kaydın korunması, trenler, hemzemin geçit ve iki
pistte uçak iniş-kalkışları:

```bash
npm i -D playwright
npx playwright install chromium
node test/kontrol.cjs
```

Ekran görüntüleri `test/cikti/` klasörüne yazılır.

## Teknik notlar

- Sabit adımlı (1/60 sn) simülasyon. Trenler ve uçaklar blok rezervasyonuyla ilerler; ayrılmamış bir bloğa
  hiçbir koşulda girmezler.
- Araç rotaları yol ağında genişlik öncelikli aramayla bulunur; tahta değiştiğinde yoldaki araçların rotası
  yeniden hesaplanır. Kavşak ışığı sarı evredeyken tahta düzenlenirse ışık kaldığı yerden devam eder.
- Gereksinim: WebGL destekleyen güncel bir tarayıcı (Chrome, Safari, Firefox, Edge).
