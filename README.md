# Fiyat Alarmı

Ürün, döviz ve kripto fiyatlarını takip eden, hedef fiyata ulaşıldığında alarm veren basit bir web sitesi.
Sunucu veya kurulum gerektirmez; saf HTML/CSS/JavaScript'tir.

## Özellikler

- **Ürün takibi (elle fiyat):** Ürün adı, bağlantısı, güncel fiyatı ve hedef fiyatı girin. Her yeni fiyat geçmişe eklenir.
- **Canlı döviz kurları:** USD, EUR, GBP, CHF, JPY / TRY ([Frankfurter](https://frankfurter.dev) – ECB verisi, yedek: open.er-api.com).
- **Canlı kripto fiyatları:** BTC, ETH, SOL, XRP, USDT, AVAX ([CoinGecko](https://www.coingecko.com)) – TRY, USD veya EUR cinsinden.
- **Alarm:** "altına düşünce" veya "üstüne çıkınca" koşulu; ekranda uyarı, sesli uyarı ve tarayıcı bildirimi.
  Koşul bozulunca alarm kendiliğinden yeniden kurulur.
- Fiyat geçmişi grafiği (hedef çizgisiyle), en düşük/en yüksek fiyat, hedefe kalan yüzde.
- Arama, sıralama (en yeni / hedefe en yakın / isim).
- Otomatik güncelleme aralığı (1 dk – 1 saat).
- Verileri JSON olarak dışa/içe aktarma. Tüm veriler tarayıcının `localStorage` alanında saklanır.

## Çalıştırma

`index.html` dosyasını tarayıcıda açmanız yeterli. Ya da yerel sunucuyla:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

### GitHub Pages ile yayınlama

Depo ayarlarında **Settings → Pages → Branch** kısmından bu dalı ve `/ (root)` klasörünü seçin.

## Notlar

- Canlı fiyatlar ve alarmlar yalnızca sayfa açıkken kontrol edilir.
- Tarayıcılar, başka sitelerden (ör. e-ticaret siteleri) doğrudan fiyat okumaya izin vermediği (CORS) için ürün fiyatları elle girilir.
