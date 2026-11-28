// Trafik Ustası / Traffic Maestro — mobil uygulama kabuğu: oyun (tek HTML, çevrimdışı) tam ekran WebView içinde çalışır.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import OYUN from './oyun/oyun';

// açılış ekranı: simgesiz, ana ekranın gökyüzü renginde; oyun ilk kareyi çizince yumuşakça kaybolur
SplashScreen.preventAutoHideAsync().catch(() => {});
try { SplashScreen.setOptions({ fade: true, duration: 250 }); } catch (e) {}
let acildi = false; // oyun "hazır" diyemezse de (ör. WebGL yok) sayfa yüklendikten 2,5 sn sonra kapanır
const acilisiGizle = () => { if (acildi) return; acildi = true; SplashScreen.hideAsync().catch(() => {}); };

// oyunun sanal adresi: kayıtlar (yıldızlar, ayarlar) bu adrese bağlı yerel depoda tutulur — değiştirme
const ADRES = 'https://oyun.rayarasi.local/'; // ilk çalışma adından kaldı; kayıtları korumak için aynen kalır
// cihaz dili oyuna iletilir: Türkçe cihazda oyun Türkçe, diğerlerinde İngilizce açılır (oyun içinden değiştirilebilir)
const CIHAZ_DILI = (() => { try { return Intl.DateTimeFormat().resolvedOptions().locale || ''; } catch (e) { return ''; } })();
// her ekranın üst (çentik) ve alt (sistem çubuğu) rengi
const RENK = {
  menu: { ust: '#87c3e1', alt: '#8cc966', yazi: 'dark' },
  level: { ust: '#f3efe4', alt: '#ffffff', yazi: 'dark' },
  workshop: { ust: '#647474', alt: '#ffffff', yazi: 'light' },
};

function Oyun() {
  const web = useRef(null);
  const kenar = useSafeAreaInsets();
  const [ekran, setEkran] = useState('menu');
  const r = RENK[ekran] || RENK.menu;
  const calistir = (js) => web.current && web.current.injectJavaScript(js + '; true;');

  // Android geri tuşu: bölümde ya da atölyedeyken ana ekrana döner, ana ekrandayken uygulamadan çıkar
  useEffect(() => {
    const abone = BackHandler.addEventListener('hardwareBackPress', () => { calistir('window.__rayGeri && window.__rayGeri()'); return true; });
    return () => abone.remove();
  }, []);
  // arka plana geçince ses kesilir, çalışan bölüm duraklar
  useEffect(() => {
    const abone = AppState.addEventListener('change', (d) => calistir('window.__rayDurum && window.__rayDurum(' + (d === 'active') + ')'));
    return () => abone.remove();
  }, []);

  const mesaj = useCallback((e) => {
    const m = e.nativeEvent.data || '';
    if (m === 'hazir') acilisiGizle();
    else if (m === 'cik') BackHandler.exitApp();
    else if (m.startsWith('ekran:')) setEkran(m.slice(6));
  }, []);

  return (
    <View style={[styles.kap, { backgroundColor: r.alt }]}>
      <StatusBar style={r.yazi} />
      <View style={{ height: kenar.top, backgroundColor: r.ust }} />
      <WebView
        ref={web}
        style={[styles.web, { marginLeft: kenar.left, marginRight: kenar.right, marginBottom: kenar.bottom }]}
        source={{ html: OYUN, baseUrl: ADRES }}
        injectedJavaScriptBeforeContentLoaded={'window.__cihazDili = ' + JSON.stringify(CIHAZ_DILI) + '; true;'}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(q) => q.url === ADRES || q.url.startsWith('about:') || q.url.startsWith('data:')}
        onMessage={mesaj}
        onLoadEnd={() => setTimeout(acilisiGizle, 2500)}
        onContentProcessDidTerminate={() => web.current && web.current.reload()}
        onRenderProcessGone={() => web.current && web.current.reload()}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsLinkPreview={false}
        bounces={false}
        scrollEnabled={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        setSupportMultipleWindows={false}
        textZoom={100}
        hideKeyboardAccessoryView
        webviewDebuggingEnabled={__DEV__}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Oyun />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  kap: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
});
