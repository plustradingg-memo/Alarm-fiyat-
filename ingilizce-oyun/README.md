# Bubu ile İngilizce

4–6 yaş, henüz okuma bilmeyen çocuklar için resimli İngilizce oyunu. Tek dosya: `index.html` (internet bağlantısı yalnızca Google Fonts yazı tipi için kullanılır; yazı tipi gelmezse sistem yazı tipiyle çalışır).

## İçindekiler

- **15 dünya, 192 kelime**: resme dokun, İngilizcesini duy (Keşfet), Bul Bakalım, Hafıza, Balon Patlat.
- **Bubu’nun Pikniği** (hikâye): elma → sepete koy, kırmızı → örtüyü seç, tavşan → çalıların arkasında bul. Sonunda çocuk 3 çıkartmadan birini kendisi seçer (rastgele ödül yok).
- **Minik Market**: ürünler tezgâha tek tek gelir ve adları söylenir; Bubu 4 şey ister (“Banana, please!”), çocuk sepete koyar.
- Sürüklenen her şey **dokun-seç, sonra sepete dokun** yoluyla da yapılabilir (klavyede Enter/Boşluk).
- Yanlış cevapta ceza yok: nesne yerine süzülür, Bubu ne seçildiğini ve ipucunu söyler; yardım adım adım artar.
- Hikâye ve markette: sesli yönlendirme (Türkçe), büyük düğmeler, sağ üstte **tekrar dinle**, sol üstte **ana sayfa**; telefonun “geri” hareketi ve Escape de çıkış yapar.

## Kayıt

Tarayıcının `localStorage` alanında `bubu-english-v1` anahtarı. Yeni alanlar eskilerin yanına eklenir:
`story.picnic { plays, stickers[] }`, `market { visits, bought{} }`, `settings.trVoice`.
Eski kayıtlar (yıldız, kelimeler, hazineler, ayarlar) olduğu gibi korunur. Kayıt yalnızca o cihazdadır; adrese göre ayrı tutulur.

## Gerçek telefonda ses testi

Sesleri telefonun kendi metin okuma motoru üretir. Türkçe yönlendirme için **yalnızca cihaz üstündeki** Türkçe ses kullanılır; yoksa yönergeler el işareti ve resimle gösterilir.

1. Bilgisayarda depo kökünden yerel sunucu açın:
   ```bash
   python3 -m http.server 8000
   ```
   Telefonla aynı Wi‑Fi’de `http://<bilgisayarın-IP-adresi>:8000/ingilizce-oyun/` adresini açın.
2. Sağ üstteki dişliye **1 saniye basılı tutun** → Ebeveyn köşesi. “İngilizce dene” ve “Türkçe dene” düğmelerine basın; iki sesin adı ekranda yazar.
3. Türkçe ses “bulunamadı” diyorsa:
   - **iPhone**: Ayarlar › Erişilebilirlik › Seslendirilen İçerik › Sesler › Türkçe (ör. Yelda) indirin.
   - **Android**: Ayarlar › Genel yönetim (veya Sistem) › Dil › Metin okuma çıkışı › Google › Dil verilerini yükle › Türkçe.
4. Kontrol listesi:
   - [ ] Ana sayfadaki **Bubu’nun Pikniği** kartına ilk dokunuşta Türkçe konuşma hemen başlıyor.
   - [ ] Türkçe → İngilizce geçişinde “Red!” gibi kısa kelimeler kesilmiyor, aradaki boşluk 1 saniyeden kısa.
   - [ ] iPhone’da sessiz düğmesi açık ve kapalıyken deneyin (oyun efektleri sessizde kısılabilir, konuşma devam etmeli).
   - [ ] Düşük ses ve Bluetooth kulaklıkla deneyin.
   - [ ] Konuşma sırasında ekranı kilitleyin: konuşma durmalı; geri dönünce tekrar dinle düğmesi zıplamalı.
   - [ ] Tekrar dinle düğmesine hızlıca 10 kez basın; ses kilitlenmemeli.
   - [ ] Sürükleyerek ve dokun-seç / dokun-bırak ile oynayın; iki parmakla ve ekran kenarından başlayan sürükleme denenmeli.
   - [ ] Ayarlardan “Yavaş” konuşma ve “İngiliz” aksanı (çıkartma adı “Ladybird!”) deneyin.
   - [ ] “Türkçe sesli yönlendirme”yi kapatın: hikâye el işaretleri ve resimlerle yine anlaşılır olmalı.

## Otomatik test

Playwright ile uçtan uca test (konuşma motoru sahtelenir, hangi cümlenin hangi dilde istendiği kaydedilir):

```bash
npm install --no-save playwright@1.48.2
```
```bash
npx playwright install chromium
```
```bash
node ingilizce-oyun/test/e2e.mjs
```

Ekran görüntüleri `ingilizce-oyun/test/shots/` klasörüne yazılır (depoya eklenmez).
