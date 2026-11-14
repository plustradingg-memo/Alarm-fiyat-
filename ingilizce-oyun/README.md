# Bubu ile İngilizce

4–6 yaş, henüz okuma bilmeyen çocuklar için resimli İngilizce oyunu. Tek dosya: `index.html` (internet bağlantısı yalnızca Google Fonts yazı tipi için kullanılır; yazı tipi gelmezse sistem yazı tipiyle çalışır).

## İçindekiler

- **15 dünya, 192 kelime**: resme dokun, İngilizcesini duy (Keşfet), Bul Bakalım, Hafıza, Balon Patlat.
- **Bubu’nun Pikniği** (hikâye): elma → sepete koy, kırmızı → örtüyü seç, tavşan → çalıların arkasında bul. Sonunda çocuk 3 çıkartmadan birini kendisi seçer (rastgele ödül yok).
- **Minik Market**: ürünler tezgâha tek tek gelir ve adları söylenir; Bubu 4 şey ister (“Banana, please!”), çocuk sepete koyar.
- **Minik Dostum** (evcil hayvan): çocuk köpek yavrusu (Max), kedi yavrusu (Luna) ya da tavşan (Coco) seçer. Günlük rutin: kahvaltı (“Milk, please!”) → hava durumuna göre giyinme (“It’s rainy! Put on the boots!”) → parkta yürüyüş (“Where is the bird?”, top, su birikintisi) → banyo (sabun, su, havlu) → akşam yemeği → uyku (diş fırçalama, yatak, ışığı kapatma, yıldızları sayma). Her tamamlanan gün hayvan büyür. Gerçek zamana bağlı acıkma, üzülme ya da ceza yok; rutin yalnızca çocuk oynadıkça ilerler.
- Sürüklenen her şey **dokun-seç, sonra sepete dokun** yoluyla da yapılabilir (klavyede Enter/Boşluk).
- Yanlış cevapta ceza yok: nesne yerine süzülür, Bubu ne seçildiğini ve ipucunu söyler; yardım adım adım artar.
- Uygulama **yalnızca İngilizce konuşur**. Yönlendirmeler kısa İngilizce cümleler, el işareti ve resimlerle verilir; büyük düğmeler, sağ üstte **tekrar dinle**, sol üstte **ana sayfa**; telefonun “geri” hareketi ve Escape de çıkış yapar.

## Kayıt

Tarayıcının `localStorage` alanında `bubu-english-v1` anahtarı. Yeni alanlar eskilerin yanına eklenir:
`story.picnic { plays, stickers[], last }`, `market { visits, bought{} }`, `pet { kind, day, step, days, outfit[], muddy }`, `settings.onlineVoice`.
Eski kayıtlar (yıldız, kelimeler, hazineler, ayarlar) olduğu gibi korunur. Kayıt yalnızca o cihazdadır; adrese göre ayrı tutulur.

## Gerçek telefonda ses testi

Sesleri şimdilik telefonun kendi metin okuma motoru üretir; cihazdaki en kaliteli İngilizce ses (adında “Premium”, “Enhanced”, “Natural” geçen) otomatik seçilir. **Daha doğal ses için** cihaza yüksek kaliteli ses indirin: iPhone’da Ayarlar › Erişilebilirlik › Seslendirilen İçerik › Sesler › İngilizce › “Ava (Premium)” ya da “Zoe (Premium)”; Android’de Ayarlar › Metin okuma çıkışı › Google › Dil verilerini yükle › İngilizce (ABD). Önce cihaz üstü ses seçilir; çevrim içi (bulut) sesler metni dışarı gönderdiği için yalnızca Ebeveyn köşesinde **“Çevrim içi ses”** açılırsa kullanılır (varsayılan: kapalı).

1. Bilgisayarda depo kökünden yerel sunucu açın:
   ```bash
   python3 -m http.server 8000
   ```
   Telefonla aynı Wi‑Fi’de `http://<bilgisayarın-IP-adresi>:8000/ingilizce-oyun/` adresini açın.
2. Sağ üstteki dişliye **1 saniye basılı tutun** → Ebeveyn köşesi. “İngilizce dene” düğmesine basın; kullanılan sesin adı ekranda yazar. Adında “Premium/Enhanced” geçmiyorsa yukarıdaki yoldan yüksek kaliteli bir ses indirip sayfayı yenileyin.
3. Kontrol listesi:
   - [ ] Ana sayfadaki **Bubu’nun Pikniği**, **Minik Market** ve **Minik Dostum** kartlarına ilk dokunuşta konuşma hemen başlıyor ve hiç Türkçe konuşulmuyor.
   - [ ] iPhone’da sessiz düğmesi açık ve kapalıyken deneyin (oyun efektleri sessizde kısılabilir, konuşma devam etmeli).
   - [ ] Düşük ses ve Bluetooth kulaklıkla deneyin.
   - [ ] Konuşma sırasında ekranı kilitleyin: konuşma durmalı; geri dönünce tekrar dinle düğmesi zıplamalı, ilk dokunuşla devam etmeli.
   - [ ] Tekrar dinle düğmesine hızlıca 10 kez basın; ses kilitlenmemeli.
   - [ ] Sürükleyerek ve dokun-seç / dokun-bırak ile oynayın; iki parmakla ve ekran kenarından başlayan sürükleme denenmeli.
   - [ ] Minik Dostum’da bütün bir gün oynayın (kahvaltı → uyku → güneşe dokun); sabah hayvan büyümeli.
   - [ ] Ayarlardan “Yavaş” konuşma ve “İngiliz” aksanı (çıkartma adı “Ladybird!”) deneyin.

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
