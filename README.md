# Fiyat Alarmı – Elektronik indirim takibi

Türk e-ticaret sitelerindeki (Trendyol, Hepsiburada, Amazon.com.tr, n11, Teknosa, Vatan, MediaMarkt, PttAVM, İtopya, İncehesap…)
elektronik ürünlerin fiyatlarını **her 30 dakikada bir otomatik kontrol eder**, indirim olunca **Telegram'dan ve e-postayla haber verir**,
fiyat geçmişini bir web sayfasında gösterir. Sunucu kiralamanız gerekmez; her şey GitHub üzerinde ücretsiz çalışır.

```
products.json ──► GitHub Actions (30 dk'da bir) ──► data/prices.json ──► Web sitesi (GitHub Pages)
                         │
                         └──► Telegram mesajı + GitHub issue (e-posta)
```

## Alarm ne zaman çalar?

- Fiyat **hedef fiyatın** altına indiğinde (hedef verdiyseniz)
- Fiyat bir önceki kontrole göre **%5 veya daha fazla** düştüğünde (`minIndirimYuzdesi` ile değiştirilebilir)
- Stokta olmayan ürün **yeniden stoğa** girdiğinde

Aynı indirim için tekrar tekrar mesaj gelmez; fiyat hedefin üstüne çıkıp yeniden düşerse alarm tekrar çalar.

## Kurulum (bir kez, ~5 dakika)

1. **Ürün ekleyin:** `products.json` dosyasını düzenleyin:

   ```json
   {
     "ayarlar": { "minIndirimYuzdesi": 5, "stokBildirimi": true },
     "urunler": [
       { "url": "https://www.trendyol.com/apple/iphone-15-128-gb-p-123456", "hedefFiyat": 45000 },
       { "url": "https://www.hepsiburada.com/sony-wh-1000xm5-p-HBC000", "hedefFiyat": 9000, "ad": "Sony XM5" },
       { "url": "https://www.amazon.com.tr/dp/B0XXXXXXX", "minIndirimYuzdesi": 10 }
     ]
   }
   ```

   | Alan | Açıklama |
   |---|---|
   | `url` | Ürün sayfasının bağlantısı (zorunlu) |
   | `hedefFiyat` | Bu fiyatın altına inince alarm (₺, isteğe bağlı) |
   | `ad` | Sitede görünecek kısa ad (isteğe bağlı; yoksa sayfadan alınır) |
   | `minIndirimYuzdesi` | Bu ürün için yüzde düşüş eşiği (isteğe bağlı) |
   | `aktif` | `false` yaparsanız ürün geçici olarak kontrol edilmez |

   Web sitesindeki **"Ürün ekle"** bölümü bu satırı sizin için hazırlar.

2. **Telegram bildirimi** (önerilir):
   - Telegram'da [@BotFather](https://t.me/BotFather)'a `/newbot` yazın, bot oluşturun ve verdiği **token**'ı alın.
   - Botunuza bir mesaj gönderin, sonra [@userinfobot](https://t.me/userinfobot)'tan **chat ID**'nizi öğrenin.
   - Depoda **Settings → Secrets and variables → Actions → New repository secret**:
     - `TELEGRAM_BOT_TOKEN` = bot token'ı
     - `TELEGRAM_CHAT_ID` = chat ID (birden fazla kişi için virgülle ayırın)

3. **E-posta bildirimi:** Ek ayar gerekmez. Her alarm için depoda bir *issue* açılır; GitHub size e-posta gönderir
   (GitHub bildirim ayarlarınızda e-posta açık olmalı). İstemiyorsanız **Settings → Secrets and variables → Actions → Variables**
   kısmına `ISSUE_BILDIRIMI` = `false` ekleyin.

4. **Web sitesini açın:** **Settings → Pages → Build and deployment → Branch** bölümünden bu dalı ve `/ (root)` klasörünü seçin.
   Site `https://<kullanıcı-adı>.github.io/<depo-adı>/` adresinde yayınlanır.

5. **İlk kontrolü başlatın:** **Actions → Fiyat kontrolü → Run workflow**. Sonra kendiliğinden 30 dakikada bir çalışır.

## Nasıl çalışır?

`scripts/check-prices.mjs` her ürün sayfasını indirir ve fiyatı şu sırayla bulur:
siteye özel seçiciler → sayfadaki schema.org (JSON-LD) ürün bilgisi → meta etiketleri → sayfaya gömülü JSON.
Bot korumasına takılan sayfalar aynı çalıştırmada gerçek bir tarayıcıyla (Playwright/Chromium) yeniden denenir.
Sonuçlar `data/prices.json` dosyasına yazılır ve depoya kaydedilir; web sitesi bu dosyayı okur.

## Yerelde çalıştırma

```bash
npm install
npm test                 # fiyat ayrıştırma testleri
npm run kontrol          # fiyatları şimdi kontrol et (Telegram için TELEGRAM_* ortam değişkenlerini verin)
python3 -m http.server   # siteyi http://localhost:8000 adresinde aç
```

## Bilinmesi gerekenler

- **Bazı siteler bot koruması kullanır.** Özellikle Hepsiburada ve zaman zaman Trendyol, GitHub sunucularından gelen istekleri engelleyebilir.
  Engellenen ürünler sitede "⚠ Kontrol edilemedi" olarak görünür. Sürekli engelleniyorsa betiği kendi bilgisayarınızda veya
  Türkiye'deki bir sunucuda (`npm run kontrol` + zamanlanmış görev) çalıştırmak çoğunlukla sorunu çözer.
- Siteler sayfa tasarımını değiştirirse seçicilerin güncellenmesi gerekebilir: `scripts/lib/extract.mjs` içindeki `SECICILER`.
- GitHub zamanlanmış görevleri yoğun saatlerde birkaç dakika geciktirebilir; 60 gün işlem görmeyen depolarda zamanlama durdurulur.
- Özel (private) depolarda GitHub Actions ücretsiz dakika sınırı vardır (aylık 2000 dk). Gerekirse
  `.github/workflows/fiyat-kontrol.yml` içindeki `*/30` değerini `0 * * * *` (saatte bir) yapın.
- Lütfen siteleri çok sık kontrol etmeyin; istekler arasında birkaç saniye beklenir.
