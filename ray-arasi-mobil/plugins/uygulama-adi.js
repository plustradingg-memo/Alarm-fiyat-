// Telefonda görünen uygulama adı. app.json'daki `name` ASCII tutulur ("Ray Arasi"): EAS'ın imza adımı Xcode hedef
// adını eski bir kuralla üretiyor ve "ı" harfini atıyor ("RayAras"), Expo'nun yerel yapı aracı ise "RayArasi"
// üretiyor; ad ASCII olunca ikisi aynı olur. Görünen ad iOS'ta CFBundleDisplayName ile, Android'de burada verilir.
const { withStringsXml, AndroidConfig } = require('expo/config-plugins');

module.exports = function uygulamaAdi(config, { ad }) {
  return withStringsXml(config, (c) => {
    c.modResults = AndroidConfig.Strings.setStringItem([{ $: { name: 'app_name', translatable: 'false' }, _: ad }], c.modResults);
    return c;
  });
};
