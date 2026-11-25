# RAY ARASI

Masanın üzerindeki maket tahtasında sade bir şehirle başlayıp yolunu, demiryolunu ve havalimanını kendin
büyüttüğün Türkçe, dikey ekranlı bir oyun. Şehir yeni yerler ister, trafik büyür ve sıkışır; sen düzenleyerek
çözersin. Süre yok: kur, izle, dene. Işıkları yapay zekâya bırakabilir ya da elle yönetebilirsin.

Ana ekranda üç kart vardır. Her kart sade, düz dört hatla açılır ve çizdiğin her şey o kart için ayrı kaydedilir:

| Kart | Başlangıç (4 düz hat) | Bu kartın özel talebi |
|---|---|---|
| **Karayolu** | İki dikey, iki yatay düz yol; dört ışıklı kavşak | Mahalle, okul, AVM, ofis, hastane, fabrika, stadyum |
| **Demiryolu** | İki düz ray hattı, onları kesen iki düz yol; dört bariyerli hemzemin geçit | İstasyon (raydan kol çek) |
| **Havalimanı** | Bir pist, pistten çıkan tek kapılı düz taksi yolu, iki düz yol | Yolcu kapısı (taksi yolunu uzat) |

Hazır, dolu bir düzen görmek istersen sağ üstteki **⋯** menüsünden **Örnek düzeni yükle**; baştan başlamak için
**Yeni şehir (4 düz yol)**.

Tahta 12 × 20 karedir. Hepsinde aynı araçlar vardır, yani yolu, rayı ve havalimanını tek tahtada birlikte kurabilirsin.

## Talepler: şehir büyür

- Birkaç saniye sonra ilk **talep** gelir: tahtada turuncu işaretli, yarı saydam bir bina taslağı belirir
  (ör. *Mahalle yol istiyor*). Sonra her yarım dakikada bir yenisi gelir (aynı anda en çok 3 bekleyen, toplam 16 yer).
- Üstteki turuncu **talep** düğmesine dokununca kamera sıradaki talebe gider ve ne yapman gerektiği yazılır.
- **Bağlamak için** yolu o kareye kadar çiz; yol binada biter (çıkmaz uç = binanın girişi). Yanında yol varsa
  **Otopark** aracıyla o kareye dokunmak da yeter. İstasyon talebine ray, kapı talebine taksi yolu çekilir.
- Bağlanan yer kendi binasıyla görünür (evler, okul, AVM, hastane, fabrika, ofis kulesi, stadyum) ve araçlar oraya
  gidip gelmeye başlar. Mahalleler çok araç gönderir, AVM ve stadyum çok araç çeker. İstasyonlar tren, kapılar uçak
  sayısını artırır.
- Uzun süre bağlanmayan talebin işareti kırmızıya döner ve memnuniyeti düşürür.

## Trafik sıkışır, memnuniyet düşer

- Her bağlanan yer zamanla büyür; yoldaki araç sayısı şehirle birlikte artar (en çok 44 araç).
- Bir kavşağın, hemzemin geçidin ya da otopark girişinin önünde 5'ten çok araç birikince ya da biri 15 saniyeden
  uzun beklerse orası **sıkışık** sayılır: yerde kırmızı halka yanar, talep düğmesi kırmızı **sıkışık** olur ve ona
  dokununca kamera oraya gider.
- Üst şeritteki **memnuniyet** çubuğu; araçların yolda durarak geçirdiği süreye, sıkışık kavşaklara, bekleyen
  taleplere ve kımıldayamadığı için vazgeçen araçlara göre değişir. Yanında şehrin **nüfusu** yazar.
- Çözüm senin elinde: kalabalık kavşağı köprü ya da alt geçitle ayır, trafiği dağıtacak paralel yol aç, demiryolunda
  hemzemin geçitleri alt geçide çevir, havalimanında taksi yolunu çoğalt.

## Araçlar nereye gider?

Arabalar amaçsızca dolaşmaz. Her araç bir yolculuğa çıkar ve gideceği yeri baştan bilir:

- **Şehir dışından gelir** (tahtanın kenarındaki yol ucu) ve bir binaya, otoparka ya da başka bir şehir çıkışına gider.
- **Otoparka ya da binaya varınca** bariyer kalkar, araç içeri girip kaybolur (otoparkta çatıda bir yer dolar).
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

Çizimler ve talepler tarayıcının yerel depolamasında saklanır; sayfayı yenileyince şehir olduğu gibi gelir.
Önceki bir sürümde kalmış bir çizim varsa şehir 4 düz yolla baştan başlar; **↶** ile eski çizim geri gelir
(eski büyük tahtadan geliyorsa ortaya yerleşir, sığmayan kenarlar kesilir).

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
├── js/ws-grid.js           Izgara, çizim/silme kuralları, başlangıç (4 düz hat) ve örnek düzenler
├── js/ws-net.js            Şerit ve hat geometrisi, rampa yükseklikleri, kavşak çakışmaları, rota arama
├── js/ws-build.js          Maket tahtası, köprü/alt geçit yapıları, katlı otoparklar, ışıklar, bariyerler, sinyaller
├── js/ws-sim.js            Araç yolculukları ve otoparklar, trenler, uçaklar, yapay zekâ denetleyicileri
├── js/ws-city.js           Şehir: talepler, bina modelleri, memnuniyet, nüfus, sıkışma ölçümü
├── js/workshop.js          Atölye ekranı: araç çubuğu, parmakla çizim, yakınlaştırma/kaydırma, geri al
├── js/menu.js              Ana ekrandaki üç canlı sahne
├── js/app.js               Oluşturucu, ekranlar ve döngü
├── js/vendor/three.min.js  three.js r149 (MIT lisansı: js/vendor/three.LICENSE)
├── assets/                 Uygulama ikonları
├── ekran-goruntuleri/      Ana ekran, 4 düz yollu başlangıç, talep, büyüyüp sıkışan şehir, demiryolu, havalimanı, masaüstü
├── manifest.webmanifest    "Ana ekrana ekle" bilgileri
└── test/kontrol.cjs        İsteğe bağlı uçtan uca kontrol betiği
```

Bütün görseller kodla üretilir (üç boyutlu modeller, dokular, sesler); dışarıdan görsel ya da ses dosyası yüklenmez.

## Kontrol betiği (isteğe bağlı)

Gerçek dokunuş ve sürüklemelerle şunları dener: ana ekran, 4 düz yolla başlayan şehir, parmakla yol çizme, kavşak,
köprü, alt geçit, hatalı çizimin reddi, silme, geri alma, Otopark aracı, talebin gelmesi ve işareti, talep
düğmesinin kamerayı götürmesi, talebi yolla bağlama ve binanın oluşması, araçların binaya girip kaybolması ve
oradan yeni araçların çıkması, U dönüşü ve kalıcı kilitlenme olmaması, trafiğin şehirle büyümesi, sıkışma halkası,
memnuniyet ve nüfus, + / − / tümü düğmeleri, kaydırma ve iki parmakla yakınlaştırma, yapay zekâ ışıkları, elle
yönetim, kaydın korunması, Yeni şehir, eski kaydın taşınması, trenler ve istasyon talebi, hemzemin geçit, uçak
iniş-kalkışları ve kapı talebi:

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
- Kavşağı tıkama kuralı: araç, arka arkaya gelen kavşak karelerinin hepsi boş, ışıkları yeşil ve çıkışta yer
  yoksa ilk kareye girmez; hemzemin geçitte rayların üstünde beklemez. Yine de 45 saniyeden uzun kımıldayamayan
  araç vazgeçip kaybolur, böylece trafik sıkışsa da sonsuza kadar donmaz.
- Uçaklar taksi yolunda gidecekleri yolun tamamını (kapıya ya da piste kadar) tek seferde ayırır; tek şeritli
  taksi yollarında karşılıklı kilitlenmez. Kule kalkışları sıraya göre verir, uzun bekleyen kalkış varken iniş
  izni vermez. Kapısı kalmayan uçak yeni kapı arar, yoksa tekrar kalkar.
- Gereksinim: WebGL destekleyen güncel bir tarayıcı (Chrome, Safari, Firefox, Edge).
