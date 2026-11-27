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
    rd: { name: 'Kırmızı', hex: 0xe0342f, css: '#e0342f', roof: 0xb52a26 },
    tq: { name: 'Turkuaz', hex: 0x12a8a0, css: '#12a8a0', roof: 0x0e8a83 },
    pk: { name: 'Pembe', hex: 0xe25ca8, css: '#e25ca8', roof: 0xc0478c },
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
      intro: 'İki renk, iki yol. Yollar kesişince turuncu ? çıkar: dokunup Kavşak seç. Işıklı kavşağı yapay zekâ yönetir.',
      tip: 'Her evi kendi rengindeki binaya bağla. Yollar ortada kesişebilir.',
      houses: [{ x: -6, z: 11, dir: 'N', color: 'or' }, { x: 6, z: 11, dir: 'N', color: 'bl' }],
      dests: [{ x: 6, z: -11, dir: 'S', color: 'or', type: 'fabrika' }, { x: -6, z: -11, dir: 'S', color: 'bl', type: 'okul' }],
      solution: [['road', [[-6, 9.3], [6, -9.1]]], ['road', [[6, 9.3], [-6, -9.1]]]],
    },
    {
      id: 3, name: 'İlk köprü', goal: 30, spawn: 1.6, budget: 60, star2: 48, bridges: 1, tunnels: 0,
      intro: 'Trafik arttı. Kavşakta ışık beklemek yerine yollardan birini köprüyle öbürünün üstünden geçir.',
      tip: 'İki yolu çiz. Sonra alttaki "Köprü" düğmesine bas: köprü yapabileceğin yerler parlar, kesişime dokun. (Turuncu ? işaretine dokunup Köprü de seçebilirsin.)',
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
      tip: 'Rayı kesen yolu çiz, sonra alttaki "Alt geçit"e basıp parlayan yere dokun: tren rayı yükselir, araçlar altından durmadan geçer.',
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
      solution: [['tunnel', [[-6, 10.8], [-6, 2], [5.5, -2], [6, -10.1]]], ['road', [[6, 10.8], [6, 2], [-5.5, -2], [-6, -10.1]]]],
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
      tip: 'Bütün yolları çiz. Sonra "Köprü"ye basıp bir yatay yolun kesişimlerine, "Alt geçit"e basıp öbürününkilere dokun: dikey yolların üstünden ve altından geçsinler.',
      houses: [{ x: -2.6, z: 13, dir: 'N', color: 'or' }, { x: 2.6, z: 13, dir: 'N', color: 'bl' }, { x: -8.6, z: -5, dir: 'E', color: 'gr' }, { x: 8.6, z: 5, dir: 'W', color: 'pu' }],
      dests: [{ x: -2.6, z: -12.5, dir: 'S', color: 'or', type: 'fabrika' }, { x: 2.6, z: -12.5, dir: 'S', color: 'bl', type: 'ofis' }, { x: 8.6, z: -5, dir: 'W', color: 'gr', type: 'okul' }, { x: -8.6, z: 5, dir: 'E', color: 'pu', type: 'avm' }],
      solution: [['road', [[-2.6, 11.3], [-2.6, -10.6]]], ['road', [[2.6, 11.3], [2.6, -10.6]]], ['bridge', [[-6.9, -5], [6.7, -5]]], ['tunnel', [[6.9, 5], [-6.7, 5]]]],
    },
    /* ---------- 11–20: haritalar büyür, engeller bir arada ---------- */
    {
      id: 11, name: 'Nehir ve ray', board: [24, 38], goal: 36, spawn: 3.0, budget: 92, star2: 82, bridges: 3, tunnels: 1,
      intro: 'Şehir büyüdü: tahta artık daha geniş. Nehir ve demiryolu birlikte; üç renk ortada kesişiyor.',
      tip: 'Dikey iki yolu nehirden köprüyle geçir, yeşil yolu ortadan çiz. Sonra kalabalık kesişimi köprü, rayı alt geçit yap. İki parmakla yakınlaştırabilirsin.',
      water: [[[-12.5, -4.4], [12.5, -3.8], [12.5, -1.6], [-12.5, -2.2]]],
      rails: [{ pts: [[-12.8, -10], [12.8, -10]], every: 10, cars: 3, first: 3 }],
      houses: [{ x: -6, z: 17, dir: 'N', color: 'or' }, { x: 6, z: 17, dir: 'N', color: 'bl' }, { x: -10.4, z: 7, dir: 'E', color: 'gr' }],
      dests: [{ x: -6, z: -16.8, dir: 'S', color: 'or', type: 'fabrika' }, { x: 6, z: -16.8, dir: 'S', color: 'bl', type: 'ofis' }, { x: 10.2, z: 7, dir: 'W', color: 'gr', type: 'okul' }],
      solution: [['road', [[-6, 15.3], [-6, -14.9]]], ['road', [[6, 15.3], [6, -14.9]]], ['road', [[-8.7, 7], [8.3, 7]]], ['set', [6, 7], 'bridge'], ['set', [-6, -10], 'tunnel']],
    },
    {
      id: 12, name: 'Tek köprü', board: [24, 38], goal: 26, spawn: 3.1, budget: 70, star2: 64, bridges: 1, tunnels: 1,
      intro: 'Nehri geçmek için tek köprü hakkın var ama iki yol nehrin öbür yanına gidiyor. Yolları köprüden önce birleştir, sonra ayır.',
      tip: 'Turuncu yolu ortadan nehri geçirip sağa çiz; mavi yolu nehirden önce ona bağla, raydan önce sola ayır.',
      water: [[[-12.5, 0.2], [12.5, 0.8], [12.5, 3], [-12.5, 2.4]]],
      rails: [{ pts: [[-12.8, -9.5], [12.8, -9.5]], every: 11, cars: 3, first: 4 }],
      houses: [{ x: -6, z: 17, dir: 'N', color: 'or' }, { x: 6, z: 17, dir: 'N', color: 'bl' }],
      dests: [{ x: 6, z: -16.8, dir: 'S', color: 'or', type: 'fabrika' }, { x: -6, z: -16.8, dir: 'S', color: 'bl', type: 'avm' }],
      solution: [['road', [[-6, 15.3], [-6, 11], [0, 7.4], [0, -4.6], [6, -6.6], [6, -14.9]]], ['road', [[6, 15.3], [6, 11], [0.4, 7.8]]], ['road', [[-0.4, -1.6], [-5.6, -5.6], [-6, -14.9]]], ['set', [6, -9.5], 'tunnel']],
    },
    {
      id: 13, name: 'Göl', board: [24, 38], goal: 30, spawn: 2.6, budget: 76, star2: 68, bridges: 2, tunnels: 1,
      intro: 'Şehrin ortasında bir göl var. Yeşil yol gölün üstünden köprüyle mi geçsin, yoksa dolaşıp kesişimleri mi çoğaltsın?',
      tip: 'Yeşil yolu gölün üstünden dümdüz çiz (köprü olur). Turuncu ve mavi yollar gölün üstünden ve altından geçsin; kesişimlerden birini alt geçit yap.',
      water: [[[-4, -5], [0, -6.4], [4, -5], [4.6, 0], [3.6, 5], [0, 6.2], [-3.8, 5], [-4.4, 0]]],
      houses: [{ x: -10.4, z: -10, dir: 'E', color: 'or' }, { x: 10.4, z: 10, dir: 'W', color: 'bl' }, { x: 0, z: 17, dir: 'N', color: 'gr' }],
      dests: [{ x: 10.2, z: -10, dir: 'W', color: 'or', type: 'fabrika' }, { x: -10.2, z: 10, dir: 'E', color: 'bl', type: 'okul' }, { x: 0, z: -16.8, dir: 'S', color: 'gr', type: 'hastane' }],
      solution: [['road', [[-8.7, -10], [8.3, -10]]], ['road', [[8.7, 10], [-8.3, 10]]], ['road', [[0, 15.3], [0, -14.9]]], ['set', [0, -10], 'tunnel']],
    },
    {
      id: 14, name: 'Dağ yolu', board: [28, 44], goal: 34, spawn: 2.4, budget: 130, star2: 120, bridges: 2, tunnels: 1,
      intro: 'Harita yine büyüdü. Solda bir dağ var: yolu dağın içinden tünelle geçir ya da etrafından dolaş.',
      tip: 'Turuncu yolu dağın üstünden dümdüz çiz: dağın içi tünel olur. Yeşil yolu ortadan dolaştır; iki kesişimi köprü yap.',
      hills: [[[-14.5, -2.6], [-3, -3.2], [-2.6, 3.4], [-14.5, 2.8]]],
      houses: [{ x: -7.5, z: 20, dir: 'N', color: 'or' }, { x: 7.5, z: 20, dir: 'N', color: 'bl' }, { x: -12.4, z: 12, dir: 'E', color: 'gr' }],
      dests: [{ x: -7.5, z: -19.8, dir: 'S', color: 'or', type: 'fabrika' }, { x: 7.5, z: -19.8, dir: 'S', color: 'bl', type: 'avm' }, { x: 12.2, z: -12, dir: 'W', color: 'gr', type: 'ofis' }],
      solution: [['road', [[-7.5, 18.3], [-7.5, -17.9]]], ['road', [[7.5, 18.3], [7.5, -17.9]]], ['road', [[-10.7, 12], [0, 12], [0, -12], [10.3, -12]]], ['set', [-7.5, 12], 'bridge'], ['set', [7.5, -12], 'bridge']],
    },
    {
      id: 15, name: 'İki ray', board: [28, 44], goal: 40, spawn: 2.8, budget: 145, star2: 136, bridges: 1, tunnels: 3,
      intro: 'İki demiryolu şehri üç parçaya bölüyor ve trenler sık geçiyor. Hangi geçitleri alt geçit yapacağını seç.',
      tip: 'Üç dikey yolu ve mor yatay yolu çiz. En kalabalık hemzemin geçitleri alt geçit yap, ortadaki kesişimi köprü.',
      rails: [{ pts: [[-14.8, -8], [14.8, -8]], every: 9, cars: 3, first: 2 }, { pts: [[-14.8, 8], [14.8, 8]], every: 9, cars: 4, first: 6 }],
      houses: [{ x: -8, z: 20, dir: 'N', color: 'or' }, { x: 0, z: 20, dir: 'N', color: 'bl' }, { x: 8, z: 20, dir: 'N', color: 'gr' }, { x: -12.4, z: 0, dir: 'E', color: 'pu' }],
      dests: [{ x: -8, z: -19.8, dir: 'S', color: 'or', type: 'fabrika' }, { x: 0, z: -19.8, dir: 'S', color: 'bl', type: 'okul' }, { x: 8, z: -19.8, dir: 'S', color: 'gr', type: 'avm' }, { x: 12.2, z: 0, dir: 'W', color: 'pu', type: 'stadyum' }],
      solution: [['road', [[-8, 18.3], [-8, -17.9]]], ['road', [[0, 18.3], [0, -17.9]]], ['road', [[8, 18.3], [8, -17.9]]], ['road', [[-10.7, 0], [10.3, 0]]], ['set', [0, 0], 'bridge'], ['set', [0, 8], 'tunnel'], ['set', [0, -8], 'tunnel'], ['set', [-8, 8], 'tunnel']],
    },
    {
      id: 16, name: 'İki nehir', board: [28, 44], goal: 36, spawn: 3.8, budget: 96, star2: 88, bridges: 2, tunnels: 1,
      intro: 'İki nehir ve yalnızca iki köprü hakkı. Üç yol da iki nehri geçecek: ortak bir ana yol kur.',
      tip: 'Yeşil yolu ortadan dümdüz çiz (ana yol). Turuncu ve mavi yolları alttaki nehirden önce ana yola bağla, üstteki nehirden sonra ayır.',
      water: [[[-14.5, -9.2], [14.5, -8.6], [14.5, -6.6], [-14.5, -7.2]], [[-14.5, 7], [14.5, 7.6], [14.5, 9.6], [-14.5, 9]]],
      houses: [{ x: -8, z: 20, dir: 'N', color: 'or' }, { x: 8, z: 20, dir: 'N', color: 'bl' }, { x: 0, z: 20, dir: 'N', color: 'gr' }],
      dests: [{ x: 8, z: -19.8, dir: 'S', color: 'or', type: 'fabrika' }, { x: -8, z: -19.8, dir: 'S', color: 'bl', type: 'okul' }, { x: 0, z: -19.8, dir: 'S', color: 'gr', type: 'hastane' }],
      solution: [['road', [[0, 18.3], [0, -17.9]]], ['road', [[-8, 18.3], [-8, 15.4], [-0.4, 12.4]]], ['road', [[8, 18.3], [8, 15.4], [0.4, 12.4]]], ['road', [[0.4, -12.4], [8, -15.4], [8, -17.9]]], ['road', [[-0.4, -12.4], [-8, -15.4], [-8, -17.9]]]],
    },
    {
      id: 17, name: 'Metropol', board: [32, 50], goal: 50, spawn: 2.5, budget: 196, star2: 184, bridges: 5, tunnels: 2,
      intro: 'Dev bir şehir: beş renk, bir nehir ve bir demiryolu. Üç ana cadde nehri ve rayı, iki yatay cadde onları kesiyor.',
      tip: 'Üç dikey caddeyi ve iki yatay caddeyi çiz. Nehir köprüleri kendiliğinden olur; kalan köprü ve alt geçitleri en kalabalık kesişimlere koy.',
      water: [[[-16.5, 3], [16.5, 3.6], [16.5, 5.8], [-16.5, 5.2]]],
      rails: [{ pts: [[-16.8, -10], [16.8, -10]], every: 9, cars: 3, first: 3 }],
      houses: [{ x: -10, z: 23, dir: 'N', color: 'or' }, { x: 0, z: 23, dir: 'N', color: 'bl' }, { x: 10, z: 23, dir: 'N', color: 'gr' }, { x: -14.4, z: -4, dir: 'E', color: 'pu' }, { x: 14.4, z: 14, dir: 'W', color: 'rd' }],
      dests: [{ x: -10, z: -22.8, dir: 'S', color: 'or', type: 'fabrika' }, { x: 0, z: -22.8, dir: 'S', color: 'bl', type: 'ofis' }, { x: 10, z: -22.8, dir: 'S', color: 'gr', type: 'avm' }, { x: 14.2, z: -4, dir: 'W', color: 'pu', type: 'stadyum' }, { x: -14.2, z: 14, dir: 'E', color: 'rd', type: 'hastane' }],
      solution: [['road', [[-10, 21.3], [-10, -20.9]]], ['road', [[0, 21.3], [0, -20.9]]], ['road', [[10, 21.3], [10, -20.9]]], ['road', [[-12.7, -4], [12.3, -4]]], ['road', [[12.7, 14], [-12.3, 14]]], ['set', [0, -4], 'bridge'], ['set', [0, 14], 'bridge'], ['set', [0, -10], 'tunnel'], ['set', [-10, -10], 'tunnel']],
    },
    {
      id: 18, name: 'Kavşak ağı', board: [32, 50], goal: 60, spawn: 2.5, budget: 230, star2: 214, bridges: 3, tunnels: 3,
      intro: 'Altı renk, altı cadde ve dokuz kesişim. Hepsi kavşak olursa şehir kilitlenir; köprü ve alt geçitleri akıllıca dağıt.',
      tip: 'Üç dikey ve üç yatay caddeyi çiz. Köprüleri ve alt geçitleri çapraz olarak dağıt: her caddede en az bir kesişim ayrılsın.',
      houses: [{ x: -8, z: 23, dir: 'N', color: 'or' }, { x: 0, z: 23, dir: 'N', color: 'bl' }, { x: 8, z: 23, dir: 'N', color: 'gr' }, { x: -14.4, z: -12, dir: 'E', color: 'pu' }, { x: 14.4, z: 0, dir: 'W', color: 'rd' }, { x: -14.4, z: 12, dir: 'E', color: 'tq' }],
      dests: [{ x: -8, z: -22.8, dir: 'S', color: 'or', type: 'fabrika' }, { x: 0, z: -22.8, dir: 'S', color: 'bl', type: 'okul' }, { x: 8, z: -22.8, dir: 'S', color: 'gr', type: 'avm' }, { x: 14.2, z: -12, dir: 'W', color: 'pu', type: 'ofis' }, { x: -14.2, z: 0, dir: 'E', color: 'rd', type: 'hastane' }, { x: 14.2, z: 12, dir: 'W', color: 'tq', type: 'stadyum' }],
      solution: [['road', [[-8, 21.3], [-8, -20.9]]], ['road', [[0, 21.3], [0, -20.9]]], ['road', [[8, 21.3], [8, -20.9]]], ['road', [[-12.7, -12], [12.3, -12]]], ['road', [[12.7, 0], [-12.3, 0]]], ['road', [[-12.7, 12], [12.3, 12]]],
        ['set', [0, 0], 'bridge'], ['set', [-8, -12], 'bridge'], ['set', [8, 12], 'bridge'], ['set', [8, -12], 'tunnel'], ['set', [-8, 12], 'tunnel'], ['set', [0, 12], 'tunnel']],
    },
    {
      id: 19, name: 'Dağ, nehir, ray', board: [32, 50], goal: 44, spawn: 2.8, budget: 152, star2: 142, bridges: 4, tunnels: 3,
      intro: 'Dağ, nehir ve demiryolu aynı haritada. Mavi cadde dağın içinden geçer; nehri ve rayı da hesaba kat.',
      tip: 'Dikey iki caddeyi çiz (mavi dağdan tünelle geçer), iki yatay caddeyi de. Nehir köprüleri kendiliğinden olur; kalan köprü ve alt geçitleri kesişimlere koy.',
      hills: [[[3, -6.5], [16.5, -7], [16.5, 1.5], [3.5, 1.8]]],
      water: [[[-16.5, 9], [16.5, 9.6], [16.5, 11.8], [-16.5, 11.2]]],
      rails: [{ pts: [[-16.8, -15], [16.8, -15]], every: 10, cars: 3, first: 3 }],
      houses: [{ x: -10, z: 23, dir: 'N', color: 'or' }, { x: 10, z: 23, dir: 'N', color: 'bl' }, { x: -14.4, z: -10, dir: 'E', color: 'gr' }, { x: 14.4, z: 17, dir: 'W', color: 'pu' }],
      dests: [{ x: -10, z: -22.8, dir: 'S', color: 'or', type: 'fabrika' }, { x: 10, z: -22.8, dir: 'S', color: 'bl', type: 'ofis' }, { x: 14.2, z: -10, dir: 'W', color: 'gr', type: 'okul' }, { x: -14.2, z: 17, dir: 'E', color: 'pu', type: 'avm' }],
      solution: [['road', [[-10, 21.3], [-10, -20.9]]], ['road', [[10, 21.3], [10, -20.9]]], ['road', [[-12.7, -10], [12.3, -10]]], ['road', [[12.7, 17], [-12.3, 17]]], ['set', [-10, -10], 'bridge'], ['set', [10, 17], 'bridge'], ['set', [10, -15], 'tunnel'], ['set', [-10, -15], 'tunnel']],
    },
    {
      id: 20, name: 'Megakent', board: [32, 50], goal: 64, spawn: 2.6, budget: 236, star2: 220, bridges: 6, tunnels: 4,
      intro: 'Son bölüm: altı renk, nehir, demiryolu ve dağ. Şimdiye kadar öğrendiğin her şeyi kullan.',
      tip: 'Altı caddeyi çiz: dikeyler nehri köprüyle geçer, turkuaz cadde dağdan tünelle. Kalan köprü ve alt geçitleri en kalabalık kesişimlere ve geçitlere dağıt.',
      water: [[[-16.5, 5.4], [16.5, 6], [16.5, 8.2], [-16.5, 7.6]]],
      rails: [{ pts: [[-16.8, -18], [16.8, -18]], every: 10, cars: 3, first: 3 }],
      hills: [[[-16.5, 14.6], [-10.5, 14.2], [-10.2, 19.4], [-16.5, 19.8]]],
      houses: [{ x: -6, z: 23, dir: 'N', color: 'or' }, { x: 2, z: 23, dir: 'N', color: 'bl' }, { x: 9, z: 23, dir: 'N', color: 'gr' }, { x: -14.4, z: -12, dir: 'E', color: 'pu' }, { x: 14.4, z: 0, dir: 'W', color: 'rd' }, { x: -14.4, z: 12, dir: 'E', color: 'tq' }],
      dests: [{ x: -6, z: -22.8, dir: 'S', color: 'or', type: 'fabrika' }, { x: 2, z: -22.8, dir: 'S', color: 'bl', type: 'okul' }, { x: 9, z: -22.8, dir: 'S', color: 'gr', type: 'avm' }, { x: 14.2, z: -12, dir: 'W', color: 'pu', type: 'ofis' }, { x: -14.2, z: 0, dir: 'E', color: 'rd', type: 'hastane' }, { x: 14.2, z: 17, dir: 'W', color: 'tq', type: 'stadyum' }],
      solution: [['road', [[-6, 21.3], [-6, -20.9]]], ['road', [[2, 21.3], [2, -20.9]]], ['road', [[9, 21.3], [9, -20.9]]], ['road', [[-12.7, -12], [12.3, -12]]], ['road', [[12.7, 0], [-12.3, 0]]], ['road', [[-12.7, 12], [-8, 12], [-4, 17], [12.3, 17]]],
        ['set', [2, 0], 'bridge'], ['set', [-6, -12], 'bridge'], ['set', [9, 17], 'bridge'], ['set', [9, -12], 'tunnel'], ['set', [2, -18], 'tunnel'], ['set', [-6, -18], 'tunnel']],
    },
  ];

  /* ================= DEMİRYOLU BÖLÜMLERİ =================
     İstasyondan (renkli) aynı renkteki gara tren hattı döşenir. Trenler uzundur: kavşaktan (makastan) geçmeleri
     uzun sürer, bu yüzden yoğun kesişimde köprü daha da değerlidir. Dağın içinden geçen hat tünel olur (alt geçit hakkı). */
  LV.RAIL = [
    {
      id: 101, name: 'İlk hat', goal: 6, spawn: 3.4, budget: 40, star2: 26, bridges: 0, tunnels: 0,
      intro: 'Turuncu istasyondaki yolcular limana gidecek. İstasyondan limana bir ray hattı döşe.',
      tip: 'Parmağını istasyonun önündeki işaretten başlatıp limanın önüne kadar sürükle, sonra ▶ ile trenleri başlat.',
      houses: [{ x: 0, z: 12, dir: 'N', color: 'or' }],
      dests: [{ x: 0, z: -11, dir: 'S', color: 'or', type: 'liman' }],
      solution: [['road', [[0, 10.4], [0, -9.1]]]],
    },
    {
      id: 102, name: 'Makas', goal: 14, spawn: 3.6, budget: 52, star2: 46, bridges: 0, tunnels: 0,
      intro: 'İki istasyon, iki gar ve az ray. Hatları birleştir: trenler makastan kendi yollarına ayrılır.',
      tip: 'İki istasyonun hattını ortada bir ana hatta birleştir, yukarıda yeniden ikiye ayır. Makaslar kendiliğinden kurulur.',
      houses: [{ x: -5, z: 12, dir: 'N', color: 'or' }, { x: 5, z: 12, dir: 'N', color: 'bl' }],
      dests: [{ x: -5, z: -11, dir: 'S', color: 'or', type: 'gar' }, { x: 5, z: -11, dir: 'S', color: 'bl', type: 'maden' }],
      solution: [['road', [[-5, 10.4], [0, 4], [0, -4], [-5, -9.1]]], ['road', [[5, 10.4], [0, 4.6]]], ['road', [[0, -4.6], [5, -9.1]]]],
    },
    {
      id: 103, name: 'Dağ', goal: 8, spawn: 3.2, budget: 34, star2: 26, bridges: 0, tunnels: 1,
      intro: 'İstasyonla gar arasında bir dağ var. Dolaşmaya ray yetmez: dağın içinden tünelle geç.',
      tip: 'Hattı dağın üstünden düz çiz: dağın içinde kalan kısım kendiliğinden tünel olur ve bir alt geçit (tünel) hakkı kullanır.',
      hills: [[[-10.5, -3.5], [10.5, -4.5], [10.5, 2.5], [-10.5, 3.2]]],
      houses: [{ x: 0, z: 12, dir: 'N', color: 'gr' }],
      dests: [{ x: 0, z: -11, dir: 'S', color: 'gr', type: 'gar' }],
      solution: [['road', [[0, 10.4], [0, -9.1]]]],
    },
    {
      id: 104, name: 'Köprülü hat', goal: 22, spawn: 2.2, budget: 64, star2: 54, bridges: 1, tunnels: 0,
      intro: 'İki yoğun hat ortada kesişiyor. Uzun trenler makasta birbirini bekler; bir hattı köprüyle geçir.',
      tip: 'İki hattı çiz. Sonra alttaki "Köprü"ye basıp kesişime dokun: bir hat öbürünün üstünden geçer.',
      houses: [{ x: -6, z: 12, dir: 'N', color: 'or' }, { x: 6, z: 12, dir: 'N', color: 'bl' }],
      dests: [{ x: 6, z: -11, dir: 'S', color: 'or', type: 'liman' }, { x: -6, z: -11, dir: 'S', color: 'bl', type: 'maden' }],
      solution: [['road', [[-6, 10.4], [6, -9.1]]], ['bridge', [[6, 10.4], [-6, -9.1]]]],
    },
    {
      id: 105, name: 'Nehir ve dağ', goal: 16, spawn: 3.0, budget: 46, star2: 42, bridges: 2, tunnels: 1,
      intro: 'Nehir şehri ikiye bölüyor, sağda bir dağ var. Nehri köprüyle, dağı tünelle geç; ray az.',
      tip: 'İki hattı da dümdüz çiz: nehri kesen kısım kendiliğinden köprü, dağın içinde kalan kısım tünel olur.',
      water: [[[-10.5, -2.4], [10.5, -1.6], [10.5, 0.4], [-10.5, -0.4]]],
      hills: [[[3.2, 3.5], [10.5, 3.2], [10.5, 8.2], [3.6, 8.6]]],
      houses: [{ x: -6, z: 12, dir: 'N', color: 'or' }, { x: 6.5, z: 12.2, dir: 'N', color: 'bl' }],
      dests: [{ x: -6, z: -11, dir: 'S', color: 'or', type: 'gar' }, { x: 6.5, z: -11, dir: 'S', color: 'bl', type: 'liman' }],
      solution: [['road', [[-6, 10.4], [-6, -9.1]]], ['road', [[6.5, 10.6], [6.5, -9.1]]]],
    },
    {
      id: 106, name: 'Büyük gar', goal: 30, spawn: 2.6, budget: 70, star2: 62, bridges: 1, tunnels: 1,
      intro: 'Üç hat, iki kesişim ve sık seferler. Hangi kesişim makas, hangisi köprü ya da tünel olsun?',
      tip: 'Dikey iki hattı çiz, yatay mor hattı ikisini de keserek çiz. Sonra kesişimlerden birini köprü, öbürünü tünel yap.',
      houses: [{ x: -3, z: 13, dir: 'N', color: 'or' }, { x: 3, z: 13, dir: 'N', color: 'bl' }, { x: -8.6, z: 2, dir: 'E', color: 'pu' }],
      dests: [{ x: -3, z: -12.5, dir: 'S', color: 'or', type: 'gar' }, { x: 3, z: -12.5, dir: 'S', color: 'bl', type: 'liman' }, { x: 8.6, z: 2, dir: 'W', color: 'pu', type: 'maden' }],
      solution: [['road', [[-3, 11.4], [-3, -10.6]]], ['road', [[3, 11.4], [3, -10.6]]], ['road', [[-6.9, 2], [6.9, 2]]], ['set', [-3, 2], 'bridge'], ['set', [3, 2], 'tunnel']],
    },
  ];

  /* ================= HAVALİMANI BÖLÜMLERİ =================
     Uçaklar pistten iner, pist çıkışından (İNİŞ) taksi yolundan kendi renkli kapısına gider, yolcu indirip bindirir,
     sonra kalkış noktasına (KALKIŞ) gidip havalanır. Hedef: kalkan uçak sayısı. Taksi yolu pisti keserse uçaklar
     pistte trafik varken bekler (bekleme çizgisi). */
  LV.AIR = [
    {
      id: 201, name: 'İlk uçuş', goal: 4, spawn: 5.5, budget: 52, star2: 40, bridges: 0, tunnels: 0, dwell: 2.5,
      intro: 'Uçaklar inip turuncu kapıya yanaşacak, sonra kalkacak. İniş noktasından kapıya, kapıdan kalkış noktasına taksi yolu çiz.',
      tip: 'İNİŞ işaretinden kapıya bir taksi yolu, kapıdan KALKIŞ işaretine bir taksi yolu daha çiz.',
      rails: [{ pts: [[-10.8, -13.2], [10.8, -13.2]], runway: true, every: 9, first: 4 }],
      houses: [{ x: -6, z: -10.6, dir: 'S', role: 'arr', colors: ['or'] }],
      dests: [{ x: 0, z: 11, dir: 'N', color: 'or', role: 'gate' }, { x: 6, z: -10.6, dir: 'S', role: 'dep' }],
      solution: [['road', [[-6, -9.2], [-1.4, 6], [-0.2, 9.4]]], ['road', [[0.2, 9.4], [1.4, 6], [6, -9.2]]]],
    },
    {
      id: 202, name: 'İki kapı', goal: 8, spawn: 4.0, budget: 62, star2: 54, bridges: 0, tunnels: 0, dwell: 2.5,
      intro: 'İki havayolu, iki kapı. Taksi yollarını ortak bir ana yolda birleştir; beton az.',
      tip: 'İnişten aşağı inen ana taksi yolunu iki kapıya ayır; kapılardan kalkışa giden yolları da birleştir.',
      rails: [{ pts: [[-10.8, -13.2], [10.8, -13.2]], runway: true, every: 9, first: 4 }],
      houses: [{ x: -6, z: -10.6, dir: 'S', role: 'arr', colors: ['or', 'bl'] }],
      dests: [{ x: -4, z: 11, dir: 'N', color: 'or', role: 'gate' }, { x: 4, z: 11, dir: 'N', color: 'bl', role: 'gate' }, { x: 6, z: -10.6, dir: 'S', role: 'dep' }],
      solution: [['road', [[-6, -9.2], [-4.4, 0], [-4, 9.4]]], ['road', [[-4.4, 1.2], [3.6, 6.6], [4, 9.4]]], ['road', [[4, 9.4], [4.4, 0], [6, -9.2]]], ['road', [[-4, 9.4], [-3.4, 7.4], [4.2, 3.4]]]],
    },
    {
      id: 203, name: 'Pisti geç', goal: 8, spawn: 3.6, budget: 60, star2: 50, bridges: 0, tunnels: 0, dwell: 2.5,
      intro: 'Terminal ile inişler arasında ikinci bir pist var. Taksi yolu pisti keserse uçaklar pistte trafik varken bekleme çizgisinde durur.',
      tip: 'Ortadaki pisti dik kesen yollar çiz: kesişim kendiliğinden bekleme çizgisi olur. Pisti kesen yol sayısını az tut.',
      rails: [{ pts: [[-10.8, -13.2], [10.8, -13.2]], runway: true, every: 9, first: 4 }, { pts: [[-10.8, 0], [10.8, 0]], runway: true, every: 6, first: 2 }],
      houses: [{ x: -6, z: -10.6, dir: 'S', role: 'arr', colors: ['gr'] }],
      dests: [{ x: 0, z: 11, dir: 'N', color: 'gr', role: 'gate' }, { x: 6, z: -10.6, dir: 'S', role: 'dep' }],
      solution: [['road', [[-6, -9.2], [-6, 6], [-0.2, 9.4]]], ['road', [[0.2, 9.4], [6, 6], [6, -9.2]]]],
    },
    {
      id: 204, name: 'Taksi köprüsü', goal: 14, spawn: 2.0, budget: 80, star2: 70, bridges: 1, tunnels: 0, dwell: 2.5,
      intro: 'Gelen ve giden uçakların yolları ortada kesişiyor. Yoğun saatte bir taksi yolunu köprüyle geçir.',
      tip: 'İnişten A kapısına ve B kapısından kalkışa çapraz yollar çiz, iki yanı da birer yolla bağla. Sonra "Köprü"ye basıp ortadaki kesişime dokun.',
      rails: [{ pts: [[-10.8, -13.2], [10.8, -13.2]], runway: true, every: 8, first: 4 }],
      houses: [{ x: 6, z: -10.6, dir: 'S', role: 'arr', colors: ['or', 'bl'] }],
      dests: [{ x: -5, z: 11, dir: 'N', color: 'or', role: 'gate' }, { x: 5, z: 11, dir: 'N', color: 'bl', role: 'gate' }, { x: -6, z: -10.6, dir: 'S', role: 'dep' }],
      solution: [['road', [[6, -9.2], [-5, 9.4]]], ['bridge', [[5, 9.4], [-6, -9.2]]], ['road', [[5.6, -6.6], [5.2, 0], [4.6, 6.6]]], ['road', [[-4.6, 6.6], [-5.2, 0], [-5.6, -6.6]]]],
    },
    {
      id: 205, name: 'Yoğun saat', goal: 18, spawn: 2.6, budget: 96, star2: 84, bridges: 1, tunnels: 1, dwell: 2.2,
      intro: 'Üç havayolu ve sık iniş. İnişler solda, kalkış sağda; gelen ve giden yollar kesişecek. Kesişimleri köprü ve alt geçitle ayır.',
      tip: 'Soldan üç kapıya, kapılardan sağdaki kalkışa yol çiz; yukarıda bir bağlantı yolu A kapısının uçaklarını kalkışa götürür. Gelen ve giden yolların kesiştiği yeri alt geçit ya da köprü yap.',
      rails: [{ pts: [[-10.8, -13.2], [10.8, -13.2]], runway: true, every: 8, first: 4 }],
      houses: [{ x: -6.5, z: -10.6, dir: 'S', role: 'arr', colors: ['or', 'bl', 'gr'] }],
      dests: [{ x: -6, z: 11, dir: 'N', color: 'or', role: 'gate' }, { x: 0, z: 11, dir: 'N', color: 'bl', role: 'gate' }, { x: 6, z: 11, dir: 'N', color: 'gr', role: 'gate' }, { x: 6.5, z: -10.6, dir: 'S', role: 'dep' }],
      solution: [['road', [[-6.5, -9.2], [-6.2, 9.4]]], ['road', [[-6.4, 2], [-0.3, 5], [0, 9.4]]], ['road', [[-6.4, -2], [5.6, 4], [6, 9.4]]], ['road', [[6.3, 7], [7.8, 2], [6.5, -9.2]]],
        ['road', [[0.3, 7.2], [4, 1], [7.6, -1]]], ['road', [[-6.4, -7.2], [6.6, -7.2]]], ['set', [3.1, 2.6], 'tunnel']],
    },
    {
      id: 206, name: 'İki pist', goal: 18, spawn: 2.5, budget: 84, star2: 72, bridges: 1, tunnels: 1, dwell: 2.2,
      intro: 'Üstteki pistte uçaklar iner, alttaki pistten kalkar. Terminal ortada; iki pisti de bekleme çizgisiyle kesmeden kurmaya çalış.',
      tip: 'İniş tarafından kapılara, kapılardan kalkış tarafına yol çiz. Gelen ve giden yollar kesişirse köprü yap.',
      rails: [{ pts: [[-10.8, -13.2], [10.8, -13.2]], runway: true, every: 9, first: 3 }, { pts: [[-10.8, 13.4], [10.8, 13.4]], runway: true, every: 9, first: 7 }],
      houses: [{ x: -6, z: -10.6, dir: 'S', role: 'arr', colors: ['or', 'pu'] }],
      dests: [{ x: -3.6, z: 0, dir: 'W', color: 'or', role: 'gate' }, { x: 3.6, z: 0, dir: 'E', color: 'pu', role: 'gate' }, { x: 6, z: 10.8, dir: 'N', role: 'dep' }],
      solution: [['road', [[-6, -9.2], [-6.4, 0], [-5.4, 0]]], ['road', [[-6.4, -2], [0, -5], [6.4, -2], [6.4, 0], [5.4, 0]]], ['road', [[-5.4, 0.2], [-6, 5], [6, 9.4]]], ['road', [[5.4, 0.2], [6.6, 4], [6, 9.2]]]],
    },
  ];

  // bölüm setleri (ana ekrandaki sekmeler)
  LV.SETS = [
    { mode: 'road', name: 'Karayolu', levels: LV.LEVELS },
    { mode: 'rail', name: 'Demiryolu', levels: LV.RAIL },
    { mode: 'air', name: 'Havalimanı', levels: LV.AIR },
  ];
  for (const set of LV.SETS) set.levels.forEach((L, k) => { L.mode = set.mode; L.n = k + 1; });
  LV.ALL = [].concat(...LV.SETS.map((s) => s.levels));
  LV.find = (id) => LV.ALL.find((l) => l.id === id);
  LV.setOf = (id) => LV.SETS.find((s) => s.levels.some((l) => l.id === id)) || LV.SETS[0];

  // moda göre sözcükler
  LV.TXT = {
    road: { veh: 'araç', draw: 'Yol çiz', mat: 'asfalt', Mat: 'Asfalt', way: 'yol', Way: 'Yol', house: 'ev', dest: 'iş yeri', jn: 'kavşak', Jn: 'Kavşak', waitWho: 'kişi', lose: 'Trafik tıkandı', first: 'Önce evlerden iş yerlerine yol çiz.' },
    rail: { veh: 'tren', draw: 'Ray döşe', mat: 'ray', Mat: 'Ray', way: 'hat', Way: 'Hat', house: 'istasyon', dest: 'gar', jn: 'makas', Jn: 'Makas', waitWho: 'sefer', lose: 'Hatlar tıkandı', first: 'Önce istasyonlardan aynı renkteki gara hat döşe.' },
    air: { veh: 'uçak', draw: 'Taksi yolu', mat: 'beton', Mat: 'Beton', way: 'taksi yolu', Way: 'Taksi yolu', house: 'iniş', dest: 'kapı', jn: 'kavşak', Jn: 'Kavşak', waitWho: 'uçak', lose: 'Hava trafiği tıkandı', first: 'Önce inişten kapılara, kapılardan kalkışa taksi yolu çiz.' },
  };

  // bina ölçüleri ve giriş noktası (yol buradan bağlanır)
  LV.prep = function (def) {
    const L = Object.assign({}, def);
    L.mode = L.mode || 'road';
    const size = (b, kind) => {
      if (b.role === 'arr' || b.role === 'dep') return [2.0, 1.0];
      if (b.role === 'gate') return [2.6, 1.8];
      if (L.mode === 'rail') return kind === 'house' ? [2.8, 1.6] : [3.0, 2.0];
      return kind === 'house' ? [2.6, 1.8] : [3.0, 2.2];
    };
    const mk = (b, kind, k) => {
      const [ux, uz] = DIR[b.dir];
      const [w, d] = size(b, kind);
      const e = d / 2 + 0.8;
      return Object.assign({ kind, key: kind[0] + k, ux, uz, w, d, ex: b.x + ux * e, ez: b.z + uz * e, pulse: 0 }, b);
    };
    L.houses = def.houses.map((b, k) => mk(b, 'house', k));
    L.dests = def.dests.map((b, k) => mk(b, 'dest', k));
    L.blds = L.houses.concat(L.dests);
    return L;
  };
})();
