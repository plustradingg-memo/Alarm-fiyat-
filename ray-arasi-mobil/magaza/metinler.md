# Ray Arası — mağaza metinleri (Türkçe)

App Store Connect ve Google Play Console'a kopyala-yapıştır yapılacak metinler. Uzunluk sınırları parantez içinde.

## Ortak

| Alan | Değer |
|---|---|
| Uygulama adı (30) | Ray Arası |
| Paket kimliği | `com.rayarasi.oyun` (iOS bundle ID ve Android paket adı; ilk yüklemeden sonra değiştirilemez) |
| Sürüm | 1.0.0 |
| Kategori | Oyunlar › Bulmaca (App Store ikinci kategori: Strateji) |
| Fiyat | Ücretsiz; reklam yok, uygulama içi satın alma yok |
| Yaş sınırı | App Store 4+, Google Play "Herkes" / PEGI 3 (şiddet, kumar, kullanıcı içeriği yok) |
| İnternet | Gerekmez; oyun tamamen çevrimdışı çalışır |
| Gizlilik | Hiçbir veri toplanmaz, paylaşılmaz (ilerleme yalnızca cihazda tutulur) — bkz. `gizlilik-politikasi.html` |

## App Store

**Alt başlık (30):** Yol, ray ve pist bulmacası

**Tanıtım metni (170):** Yolu parmağınla çiz, kesişimleri köprü ve alt geçitle ayır, trafiği tıkatmadan akıt! Karayolu, demiryolu ve havalimanında 120 bölüm seni bekliyor.

**Anahtar kelimeler (100):** trafik,bulmaca,yol,köprü,tren,demiryolu,havalimanı,uçak,kavşak,şehir,strateji,çizim,zeka

**Bu sürümdeki yenilikler:** İlk sürüm: üç dünyada 120 bölüm, yıldız kapıları ve yoğun saatler.

**İnceleme notu (App Review):** Oyun tamamen çevrimdışıdır, hesap ya da giriş gerekmez. İlk bölüm açıktır; parmağınızı bir evin önündeki işaretten aynı renkteki binaya sürükleyip ▶ düğmesine basın.

## Google Play

**Kısa açıklama (80):** Yolu parmağınla çiz, kesişimleri köprüyle ayır, trafiği tıkatmadan akıt!

## Tam açıklama (her iki mağaza, 4000)

Ray Arası, parmağınla yol çizdiğin sevimli bir 3B trafik bulmacası.

Evleri aynı renkteki iş yerlerine bağla, ▶'ye bas ve arabaların akışını izle. Yollar kesişince karar senin: ışıklı kavşak mı, köprü mü, alt geçit mi? Köprü ve alt geçit hakların sınırlı, asfaltın da. Bir ev çok bekletilirse trafik tıkanır!

ÜÇ DÜNYA, 120 BÖLÜM
• Karayolu: evler, iş yerleri, kavşaklar, nehirler, dağlar ve hemzemin geçitler.
• Demiryolu: uzun trenler, makaslar, nehir köprüleri ve dağ tünelleri.
• Havalimanı: uçakları indir, kapıya yanaştır, yolcuyu al ve kaldır; pist geçişlerinde sırayı bekle.

HER BÖLGEDE YENİ BİR SINAV
• Bölgeler ilerledikçe haritalar büyür, renkler ve kesişimler çoğalır.
• Yoğun saatlerde trafik birden artar; ağın dayanıyor mu?
• Yıldız kapıları: her bölgenin son bölümüne geçmek için yeterince yıldız topla.

ÇİZMESİ KOLAY
• Eğri ya da düz, nasıl çizersen çiz; oyun yolunu toparlar, binalara ve yollara kendisi bağlar.
• Köprüyü yol çizmeden önce de kurabilirsin; yapılabilecek yerler parlar.
• İki parmakla yakınlaştır ve kaydır; trafiği 2×, 4× ya da 8× hızlandır.

SERBEST ATÖLYE
Bölümlerin dışında ızgaralı atölyede kendi şehrini, demiryolunu ya da havalimanını büyüt.

Reklam yok, uygulama içi satın alma yok, internet gerekmez. İlerlemen yalnızca cihazında saklanır.

## Görseller (`gorseller/`)

| Dosya | Nereye |
|---|---|
| `ios/1-…6-….jpg` (1320 × 2868) | App Store › iPhone 6,9" ekran görüntüleri |
| `android/1-…6-….jpg` (1080 × 1920) | Google Play › Telefon ekran görüntüleri |
| `play-one-cikan-gorsel.png` (1024 × 500) | Google Play › Öne çıkan görsel |
| `play-simge-512.png` (512 × 512) | Google Play › Uygulama simgesi |

App Store simgesi derlemenin içinden gelir (`assets/icon.png`, 1024 × 1024).

## Doldurman gereken alanlar

Adım adım sıra ve hazır form yanıtları: `YAPILACAKLAR.md`. App Store'un metin, görsel, kategori ve yaş
derecelendirmesi alanları `store.config.json` dosyasında hazır; `npm run magaza:ios` ile yüklenir.


- **Gizlilik politikası adresi** (iki mağaza da zorunlu tutar): https://github.com/plustradingg-memo/Alarm-fiyat-/blob/2d7c9c78de1f42003d9b76ee648b17596077db0e/ray-arasi-mobil/magaza/gizlilik-politikasi.md
  (giriş istemeden açılır; aynı içerik https://claude.ai/artifact/DxHtw1N5hzeWtr92DNNGgT adresinde de var, o sayfa
  Paylaş menüsünden herkese açık yapılırsa kullanılabilir)
- **Destek adresi** (App Store): https://github.com/plustradingg-memo/Alarm-fiyat-/blob/2d7c9c78de1f42003d9b76ee648b17596077db0e/ray-arasi-mobil/magaza/destek.md
- **Telif hakkı** (App Store): `store.config.json` içinde "2026 Ray Arası" yazılı; istersen adınla değiştir.
- **Geliştirici e-postası** (Google Play mağaza girişi).
- **App Store › Uygulama Gizliliği:** "Veri toplamıyoruz" seç.
- **Google Play › Veri güvenliği:** "Uygulama hiçbir kullanıcı verisi toplamıyor veya paylaşmıyor" seç; reklam içermiyor; hedef kitle 13 yaş ve üstü önerilir (çocuklara yönelik "Aileler" programı ek koşullar ister).
