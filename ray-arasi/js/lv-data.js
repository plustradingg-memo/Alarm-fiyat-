/* RAY ARASI — Bölümler: bölüm tasarımları (evler, iş yerleri, nehir, demiryolu, hedefler) */
(function () {
  'use strict';
  const RA = window.RA;
  const LV = (RA.LV = RA.LV || {});

  LV.COLORS = {
    or: { name: 'Turuncu', hex: 0xff8a1f, css: '#ff8a1f', roof: 0xe2661a },
    bl: { name: 'Mavi', hex: 0x2f7fe0, css: '#2f7fe0', roof: 0x2a62b8 },
    gr: { name: 'Yeşil', hex: 0x22a45a, css: '#22a45a', roof: 0x1d8a4b },
    pu: { name: 'Mor', hex: 0x9050d8, css: '#9050d8', roof: 0x7340b4 },
  };
  const DIR = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

  // Tahta: x ∈ [-10, 10], z ∈ [-16, 16] (z eksi = ekranın üstü). Ev ve iş yerinin girişi "dir" yönündedir.
  // spawn: her evden kaç saniyede bir araç çıkar; goal: kaç araç ulaşınca bölüm biter;
  // budget: asfalt (yol uzunluğu), bridges/tunnels: köprü ve alt geçit hakkı; star2: 2. yıldız için en fazla asfalt.
  // solution: çözüm yolları (İpucu ve testler): [araç, [[x,z],...]]  araç: yol | köprü | alt geçit ile çizilir
  LV.LEVELS = [
    {
      id: 1, name: 'İlk yol', goal: 8, spawn: 2.6, budget: 40, star2: 25, bridges: 0, tunnels: 0,
      intro: 'Turuncu evdekiler turuncu fabrikada çalışıyor. Evin önünden fabrikanın önüne bir yol çiz.',
      tip: 'Parmağını turuncu evin önündeki işaretten başlatıp fabrikanın önündeki işarete kadar sürükle, sonra ▶ ile trafiği başlat.',
      houses: [{ x: -5, z: 11, dir: 'N', color: 'or' }],
      dests: [{ x: 5, z: -11, dir: 'S', color: 'or', type: 'fabrika' }],
      solution: [['road', [[-5, 9.3], [5, -9.1]]]],
    },
    {
      id: 2, name: 'Kavşak', goal: 16, spawn: 2.8, budget: 60, star2: 48, bridges: 0, tunnels: 0,
      intro: 'İki renk, iki yol. Yollar kesişince ışıklı kavşak olur; ışıkları yapay zekâ yönetir.',
      tip: 'Her evi kendi rengindeki binaya bağla. Yollar ortada kesişebilir.',
      houses: [{ x: -6, z: 11, dir: 'N', color: 'or' }, { x: 6, z: 11, dir: 'N', color: 'bl' }],
      dests: [{ x: 6, z: -11, dir: 'S', color: 'or', type: 'fabrika' }, { x: -6, z: -11, dir: 'S', color: 'bl', type: 'okul' }],
      solution: [['road', [[-6, 9.3], [6, -9.1]]], ['road', [[6, 9.3], [-6, -9.1]]]],
    },
    {
      id: 3, name: 'İlk köprü', goal: 30, spawn: 1.6, budget: 60, star2: 48, bridges: 1, tunnels: 0,
      intro: 'Trafik arttı. Kavşakta ışık beklemek yerine yollardan birini köprüyle öbürünün üstünden geçir.',
      tip: 'Alttan "Köprü"yü seçip ikinci yolu çiz ya da çizdikten sonra kesişme işaretine dokun: kavşak → köprü → alt geçit.',
      houses: [{ x: -6, z: 11, dir: 'N', color: 'or' }, { x: 6, z: 11, dir: 'N', color: 'bl' }],
      dests: [{ x: 6, z: -11, dir: 'S', color: 'or', type: 'fabrika' }, { x: -6, z: -11, dir: 'S', color: 'bl', type: 'okul' }],
      solution: [['road', [[-6, 9.3], [6, -9.1]]], ['bridge', [[6, 9.3], [-6, -9.1]]]],
    },
    {
      id: 4, name: 'Ortak yol', goal: 30, spawn: 2.6, budget: 46, star2: 43, bridges: 1, tunnels: 0,
      intro: 'Asfalt az. İki turuncu ev aynı fabrikaya gidiyor: yollarını birleştir, tek ana yol yeter.',
      tip: 'Fabrikadan aşağı bir ana yol çiz; iki evin yolunu bu ana yola bağla. Mavi yol ana yolu kesecek.',
      houses: [{ x: -7, z: 12, dir: 'N', color: 'or' }, { x: 7, z: 12, dir: 'N', color: 'or' }, { x: -8, z: 1, dir: 'E', color: 'bl' }],
      dests: [{ x: 0, z: -11, dir: 'S', color: 'or', type: 'fabrika' }, { x: 8, z: 1, dir: 'W', color: 'bl', type: 'avm' }],
      solution: [['road', [[0, -9.1], [0, 6]]], ['road', [[-7, 10.3], [-3, 7.5], [0, 6]]], ['road', [[7, 10.3], [3, 7.5], [0, 6]]], ['bridge', [[-6.3, 1], [6.1, 1]]]],
    },
    {
      id: 5, name: 'Nehir', goal: 24, spawn: 2.7, budget: 64, star2: 54, bridges: 2, tunnels: 0,
      intro: 'Şehri bir nehir ikiye bölüyor. Suyun üstünden ancak köprüyle geçilir; iki köprü hakkın var.',
      tip: 'Nehri kesen yol kendiliğinden köprü olur. Yolların birbirini kestiği yeri nehirden uzak tut.',
      water: [[[-10.5, -2], [10.5, -1.2], [10.5, 1.4], [-10.5, 0.6]]],
      houses: [{ x: -6, z: 12, dir: 'N', color: 'or' }, { x: 6, z: 12, dir: 'N', color: 'bl' }],
      dests: [{ x: 6, z: -11, dir: 'S', color: 'or', type: 'fabrika' }, { x: -6, z: -11, dir: 'S', color: 'bl', type: 'ofis' }],
      solution: [['road', [[-6, 10.3], [-2, 7.6], [4.6, 5], [5.6, -3], [6, -9.1]]], ['road', [[6, 10.3], [2, 7.6], [-4.6, 5], [-5.6, -3], [-6, -9.1]]]],
    },
    {
      id: 6, name: 'Hemzemin geçit', goal: 30, spawn: 2.0, budget: 52, star2: 44, bridges: 0, tunnels: 1,
      intro: 'Demiryolundan sık sık tren geçiyor. Hemzemin geçitte bariyer inince araçlar bekler.',
      tip: 'Bir yolu "Alt geçit"le çiz: tren rayı yükselir, araçlar altından durmadan geçer.',
      rails: [{ pts: [[-10.8, -1], [10.8, -1]], every: 11, cars: 3, first: 2 }],
      houses: [{ x: -5, z: 12, dir: 'N', color: 'or' }, { x: 5, z: 12, dir: 'N', color: 'gr' }],
      dests: [{ x: -5, z: -11, dir: 'S', color: 'or', type: 'fabrika' }, { x: 5, z: -11, dir: 'S', color: 'gr', type: 'avm' }],
      solution: [['road', [[-5, 10.3], [-5, -9.1]]], ['tunnel', [[5, 10.3], [5, -9.1]]]],
    },
    {
      id: 7, name: 'Üç renk', goal: 40, spawn: 2.4, budget: 72, star2: 62, bridges: 2, tunnels: 2,
      intro: 'Üç renk, üç yol ve hepsi birbirini kesiyor. Hangi kesişim kavşak, hangisi köprü olsun?',
      tip: 'Kalabalık kesişimleri köprü ya da alt geçitle ayır; az kullanılanlar kavşak kalabilir.',
      houses: [{ x: -7, z: 12, dir: 'N', color: 'or' }, { x: 7, z: 12, dir: 'N', color: 'gr' }, { x: -8, z: -5, dir: 'E', color: 'bl' }],
      dests: [{ x: 7, z: -12, dir: 'S', color: 'or', type: 'fabrika' }, { x: -7, z: -12, dir: 'S', color: 'gr', type: 'okul' }, { x: 8, z: -5, dir: 'W', color: 'bl', type: 'ofis' }],
      solution: [['road', [[-7, 10.3], [7, -10.1]]], ['bridge', [[7, 10.3], [-7, -10.1]]], ['tunnel', [[-6.3, -5], [6.1, -5]]]],
    },
    {
      id: 8, name: 'Nehir ve ray', goal: 32, spawn: 2.9, budget: 76, star2: 66, bridges: 2, tunnels: 1,
      intro: 'Aşağıda demiryolu, yukarıda nehir. Köprülerini ve alt geçidini akıllıca kullan.',
      tip: 'Nehri iki köprüyle geç; demiryolunda en kalabalık yolu alt geçitten geçir.',
      water: [[[-10.5, -6.2], [10.5, -5.4], [10.5, -3.4], [-10.5, -4.2]]],
      rails: [{ pts: [[-10.8, 5], [10.8, 5]], every: 11, cars: 3, first: 3 }],
      houses: [{ x: -6, z: 12.5, dir: 'N', color: 'or' }, { x: 6, z: 12.5, dir: 'N', color: 'bl' }],
      dests: [{ x: 6, z: -12, dir: 'S', color: 'or', type: 'fabrika' }, { x: -6, z: -12, dir: 'S', color: 'bl', type: 'hastane' }],
      solution: [['tunnel', [[-6, 10.8], [-6, 1.5], [0, 0.5], [6, -1], [6, -10.1]]], ['road', [[6, 10.8], [6.8, 3], [3, -0.8], [-6, -1.6], [-6, -10.1]]]],
    },
    {
      id: 9, name: 'Göl', goal: 40, spawn: 2.5, budget: 80, star2: 70, bridges: 1, tunnels: 1,
      intro: 'Şehrin ortasında bir göl var. Etrafından dolaşmak uzun; üstünden geçmek için tek köprü hakkın var.',
      tip: 'Turuncu yol gölün üstünden köprüyle geçsin; mavi yol gölün solundan dolaşsın. Kesiştikleri yeri alt geçit yap.',
      water: [[[-3.4, -4.6], [0, -5.6], [3.4, -4.6], [3.9, 0], [3.4, 4.6], [0, 5.6], [-3.4, 4.6], [-3.9, 0]]],
      houses: [{ x: -6, z: 12.5, dir: 'N', color: 'or' }, { x: 0, z: 13, dir: 'N', color: 'bl' }, { x: 6, z: 12.5, dir: 'N', color: 'gr' }],
      dests: [{ x: 0, z: -12.5, dir: 'S', color: 'or', type: 'fabrika' }, { x: -6, z: -12, dir: 'S', color: 'bl', type: 'avm' }, { x: 6, z: -12, dir: 'S', color: 'gr', type: 'okul' }],
      solution: [['road', [[6, 10.8], [6, -10.1]]], ['road', [[0, 11.3], [-1.5, 9.5], [-5.6, 6.5], [-5.8, -4], [-6, -10.1]]], ['tunnel', [[-6, 10.8], [-4.2, 9.3], [-0.6, 7.6], [0, 5], [0, -10.6]]]],
    },
    {
      id: 10, name: 'Büyük kavşak', goal: 48, spawn: 2.3, budget: 84, star2: 76, bridges: 2, tunnels: 2,
      intro: 'Dört renk, dört kesişim ve yoğun trafik. Şimdiye kadar öğrendiğin her şeyi kullan.',
      tip: 'Yatay yollardan birini köprüyle, öbürünü alt geçitle çiz: dikey yolların üstünden ve altından geçsinler.',
      houses: [{ x: -2.6, z: 13, dir: 'N', color: 'or' }, { x: 2.6, z: 13, dir: 'N', color: 'bl' }, { x: -8.6, z: -5, dir: 'E', color: 'gr' }, { x: 8.6, z: 5, dir: 'W', color: 'pu' }],
      dests: [{ x: -2.6, z: -12.5, dir: 'S', color: 'or', type: 'fabrika' }, { x: 2.6, z: -12.5, dir: 'S', color: 'bl', type: 'ofis' }, { x: 8.6, z: -5, dir: 'W', color: 'gr', type: 'okul' }, { x: -8.6, z: 5, dir: 'E', color: 'pu', type: 'avm' }],
      solution: [['road', [[-2.6, 11.3], [-2.6, -10.6]]], ['road', [[2.6, 11.3], [2.6, -10.6]]], ['bridge', [[-6.9, -5], [6.7, -5]]], ['tunnel', [[6.9, 5], [-6.7, 5]]]],
    },
  ];

  // bina ölçüleri ve giriş noktası (yol buradan bağlanır)
  LV.prep = function (def) {
    const L = Object.assign({}, def);
    const mk = (b, kind, k) => {
      const [ux, uz] = DIR[b.dir];
      const w = kind === 'house' ? 2.6 : 3.0, d = kind === 'house' ? 1.8 : 2.2;
      const e = d / 2 + 0.8;
      return Object.assign({ kind, key: kind[0] + k, ux, uz, w, d, ex: b.x + ux * e, ez: b.z + uz * e, pulse: 0 }, b);
    };
    L.houses = def.houses.map((b, k) => mk(b, 'house', k));
    L.dests = def.dests.map((b, k) => mk(b, 'dest', k));
    L.blds = L.houses.concat(L.dests);
    return L;
  };
})();
