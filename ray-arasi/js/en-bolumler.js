/* İngilizce bölüm metinleri: kimlik → { name, intro, tip }. Kaynak: js/lv-data.js (Türkçe). */
(function () {
  const RA = window.RA;
  Object.assign(RA.LV_EN, {
    // ---------- Karayolu: Köy (1–10) ----------
    1: {
      name: 'First Road',
      intro: 'The people in the orange house work at the orange factory. Draw a road from the front of the house to the front of the factory.',
      tip: 'Start your finger on the marker in front of the orange house and drag it to the marker in front of the factory, then press ▶ to start the traffic.',
    },
    21: {
      name: 'Two Houses',
      intro: 'Two colors, two houses, two workplaces. Connect each house to the building of its color; the roads don’t have to cross.',
      tip: 'Draw both roads straight up.',
    },
    2: {
      name: 'Junction',
      intro: 'Two colors, two roads. Where roads cross, an orange ? appears: tap it and pick Junction. The AI runs the traffic lights.',
      tip: 'Connect each house to the building of its color. The roads can cross in the middle.',
    },
    22: {
      name: 'Three Roads',
      intro: 'The green road will cross both other roads. An orange ? appears at each crossing: tap it and pick Junction.',
      tip: 'Draw the two vertical roads, then the horizontal green one. Tap each ? and pick Junction.',
    },
    3: {
      name: 'First Bridge',
      intro: 'Traffic is up. Instead of waiting at the lights, take one road over the other on a bridge.',
      tip: 'Draw both roads. Then press the "Bridge" button at the bottom: the spots where you can build one light up, so tap the crossing. (You can also tap the orange ? and pick Bridge.)',
    },
    4: {
      name: 'Shared Road',
      intro: 'Asphalt is short. Both orange houses go to the same factory: merge their roads, one main road is enough.',
      tip: 'Draw a main road down from the factory and connect both houses’ roads to it. The blue road will cross the main road.',
    },
    5: {
      name: 'The River',
      intro: 'A river splits the city in two. The water can only be crossed by bridge; you have two bridges.',
      tip: 'A road across the river becomes a bridge automatically. Keep the spot where the roads cross each other away from the river.',
    },
    6: {
      name: 'Level Crossing',
      intro: 'Trains run often on this railway. When the barrier drops at the level crossing, cars have to wait.',
      tip: 'Draw the road across the tracks, then press "Underpass" at the bottom and tap the glowing spot: the track is raised and cars pass under it without stopping.',
    },
    23: {
      name: 'Bridged River',
      intro: 'A river and a crossing road. Roads over the river become bridges automatically; put your third bridge on the busy crossing.',
      tip: 'Draw all three roads, then press "Bridge" and tap the crossing on the right.',
    },
    7: {
      name: 'Three Colors',
      intro: 'Three colors, three roads, and they all cross each other. Which crossing should be a junction, and which a bridge?',
      tip: 'Separate the busy crossings with a bridge or underpass; quieter ones can stay junctions.',
    },

    // ---------- Karayolu: Kasaba (11–20) ----------
    8: {
      name: 'River and Rail',
      intro: 'Railway below, river above. Use your bridges and underpass wisely.',
      tip: 'Cross the river with two bridges; at the railway, send the busiest road through the underpass.',
    },
    9: {
      name: 'The Lake',
      intro: 'There’s a lake in the middle of town. Going around is long, and you have just one bridge to cross it.',
      tip: 'Take the orange road over the lake on a bridge and send the blue road around the lake’s left side. Make their crossing an underpass.',
    },
    10: {
      name: 'Big Junction',
      intro: 'Four colors, four crossings and heavy traffic. Use everything you’ve learned so far.',
      tip: 'Draw all the roads. Press "Bridge" and tap one horizontal road’s crossings, then press "Underpass" and tap the other’s: they’ll pass over and under the vertical roads.',
    },
    24: {
      name: 'Town Roads',
      intro: 'The town grew and so did the board. Three vertical streets, one horizontal: a bridge at one crossing, an underpass at another.',
      tip: 'Draw all four streets. Make the middle crossing a bridge and the right one an underpass.',
    },
    25: {
      name: 'New Bridges',
      intro: 'A river, a railway and a horizontal street up top. Share out your bridges and underpass.',
      tip: 'Take both vertical streets over the river on bridges. Make one crossing with the top street a bridge and the busy level crossing an underpass.',
    },
    11: {
      name: 'Wide River',
      intro: 'The city grew: the board is wider now. A river and a railway together, and three colors cross in the middle.',
      tip: 'Take the two vertical roads over the river on bridges and draw the green road through the middle. Then make the busy crossing a bridge and the railway crossing an underpass. Pinch with two fingers to zoom.',
    },
    26: {
      name: 'Lakeside',
      intro: 'A lake on the left, a railway below. Should the orange street go over the lake or around it?',
      tip: 'Draw the orange street straight over the lake (it becomes a bridge). Make its crossing with the green street a junction and the level crossing on the right an underpass.',
    },
    12: {
      name: 'One Bridge',
      intro: 'You have just one bridge to cross the river, but two roads need the other side. Merge the roads before the bridge, then split them.',
      tip: 'Run the orange road over the river in the middle, then to the right. Join the blue road to it before the river; split it off to the left before the railway.',
    },
    27: {
      name: 'Mountain Pass',
      intro: 'A mountain fills the left half. The orange street can tunnel through it; going around takes a long time.',
      tip: 'Draw the orange street straight over the mountain: the inside becomes a tunnel. Make its crossing with the green street a bridge.',
    },
    13: {
      name: 'Lake Crossing',
      intro: 'There’s a lake in the middle of town. Should the green road cross it on a bridge, or go around and add more crossings?',
      tip: 'Draw the green road straight over the lake (it becomes a bridge). Run the orange and blue roads past the top and bottom of the lake; make one of the crossings an underpass.',
    },

    // ---------- Karayolu: Şehir (21–30) ----------
    28: {
      name: 'Rail City',
      intro: 'The city grew again. One railway and four streets: four crossings, two level crossings.',
      tip: 'Draw all four streets. Make two diagonally opposite crossings bridges and both level crossings underpasses.',
    },
    14: {
      name: 'Mountain Road',
      intro: 'The map grew again. There’s a mountain on the left: tunnel the road through it, or go around.',
      tip: 'Draw the orange road straight over the mountain: the inside becomes a tunnel. Route the green road through the middle; make two crossings bridges.',
    },
    29: {
      name: 'Bridged Rivers',
      intro: 'A horizontal street between two rivers. Four bridges go on the rivers, and one on a crossing in between.',
      tip: 'Draw all three streets; the river bridges build themselves. Make the right crossing a bridge.',
    },
    15: {
      name: 'Two Railways',
      intro: 'Two railways cut the city into three parts, and trains pass often. Choose which crossings get underpasses.',
      tip: 'Draw the three vertical roads and the horizontal purple road. Make the busiest level crossings underpasses and the middle crossing a bridge.',
    },
    30: {
      name: 'Junction Quartet',
      intro: 'Four streets, four crossings and rush hours: now and then traffic suddenly surges. Put the bridge and underpass where it’s busiest.',
      tip: 'Draw all four streets. Of two diagonally opposite crossings, make one a bridge and the other an underpass.',
    },
    16: {
      name: 'Two Rivers',
      intro: 'Two rivers and only two bridges. All three roads must cross both rivers: build a shared main road.',
      tip: 'Draw the green road straight up the middle (the main road). Join the orange and blue roads to it before the lower river and split them off after the upper river.',
    },
    31: {
      name: 'Mountain and Lake',
      intro: 'A mountain on the left, a lake on the right. The orange street tunnels through the mountain, the blue one bridges the lake.',
      tip: 'Draw all four streets. Make the upper crossing on the left a bridge and the lower crossing on the right an underpass.',
    },
    32: {
      name: 'Busy Street',
      intro: 'Three vertical streets, one horizontal street, a railway and rush hours.',
      tip: 'Draw all four streets. Make the middle crossing a bridge, and the middle and left level crossings underpasses.',
    },
    33: {
      name: 'River Junction',
      intro: 'A river cuts through the middle of the city; three streets cross it, and two horizontal streets cross them.',
      tip: 'Draw all five streets. Make the two middle crossings bridges and the bottom-right one an underpass.',
    },
    34: {
      name: 'Downtown',
      intro: 'Five colors, six crossings and rush hours. Beat this level to move on to the Metropolis.',
      tip: 'Draw all five streets. Put a bridge and an underpass on the two middle crossings, and one more of each in the corners.',
    },

    // ---------- Karayolu: Metropol (31–40) ----------
    35: {
      name: 'Port City',
      intro: 'Welcome to the Metropolis region. A river, a railway, three streets and a horizontal street along the bottom.',
      tip: 'Draw all four streets. Make the middle crossing a bridge, and the middle and right level crossings underpasses.',
    },
    17: {
      name: 'Metropolis',
      intro: 'A huge city: five colors, a river and a railway. Three main streets cross the river and the railway, and two horizontal streets cross them.',
      tip: 'Draw the three vertical and two horizontal streets. The river bridges build themselves; put the remaining bridges and underpasses on the busiest crossings.',
    },
    36: {
      name: 'Double Rail',
      intro: 'Two railways with a river between them. There are six level crossings; choose your underpasses carefully.',
      tip: 'Draw all four streets. Make the middle crossing with the horizontal street a bridge and the three busiest level crossings underpasses.',
    },
    18: {
      name: 'Junction Grid',
      intro: 'Six colors, six streets and nine crossings. If they’re all junctions, the city locks up; spread your bridges and underpasses wisely.',
      tip: 'Draw three vertical and three horizontal streets. Spread the bridges and underpasses diagonally so every street has at least one separated crossing.',
    },
    37: {
      name: 'Between Mountains',
      intro: 'Two mountains, five streets. The side streets tunnel through the mountains; separate the crossings well.',
      tip: 'Draw all five streets: the left and right ones tunnel through the mountains. Put a bridge and an underpass on the two middle crossings, and one of each in the corners.',
    },
    19: {
      name: 'Mountain, River, Rail',
      intro: 'A mountain, a river and a railway on one map. The blue street goes through the mountain; plan for the river and railway too.',
      tip: 'Draw the two vertical streets (blue tunnels through the mountain) and the two horizontal ones. The river bridges build themselves; put the remaining bridges and underpasses on the crossings.',
    },
    38: {
      name: 'Night Traffic',
      intro: 'Five colors, a river and frequent rush hours. Every wave puts the city to the test.',
      tip: 'Draw all five streets. Make the two middle crossings bridges and the two corner ones underpasses.',
    },
    39: {
      name: 'Islands',
      intro: 'Two rivers and a lake in the middle: the city is split into islands. Plenty of bridges, but long roads.',
      tip: 'Draw all five streets; the river and lake bridges build themselves. Make the upper middle crossing a bridge and the lower one an underpass.',
    },
    40: {
      name: 'The Big Test',
      intro: 'Six colors, nine crossings, a railway and rush hours. The last test before Megacity.',
      tip: 'Draw all six streets. Spread the bridges along one diagonal, and put the underpasses on the other diagonal and the middle level crossing.',
    },
    20: {
      name: 'Megacity',
      intro: 'The final level: six colors, a river, a railway and a mountain. Use everything you’ve learned so far.',
      tip: 'Draw all six streets: the vertical ones bridge the river, the teal one tunnels through the mountain. Spread the remaining bridges and underpasses over the busiest crossings and level crossings.',
    },

    // ---------- Demiryolu: Banliyö (1–10) ----------
    101: {
      name: 'First Line',
      intro: 'Passengers at the orange station are heading to the port. Lay a track from the station to the port.',
      tip: 'Start your finger on the marker in front of the station and drag it to the front of the port, then press ▶ to start the trains.',
    },
    107: {
      name: 'Two Lines',
      intro: 'Two stations, two terminals. Connect each station to the terminal of its color; the lines don’t have to cross.',
      tip: 'Lay both lines straight up.',
    },
    102: {
      name: 'Switch',
      intro: 'Two stations, two terminals and little track. Merge the lines: trains split off onto their own routes at the switch.',
      tip: 'Merge both stations’ lines into one main line in the middle, then split it in two again at the top. The switches are set up automatically.',
    },
    108: {
      name: 'Crossing Lines',
      intro: 'The green line will cross the orange line. A ? appears at the crossing: tap it and pick Switch; trains take turns through the crossing.',
      tip: 'Lay both lines, then tap the ? and pick Switch.',
    },
    103: {
      name: 'The Mountain',
      intro: 'There’s a mountain between the station and the terminal. You don’t have enough track to go around: tunnel through it.',
      tip: 'Draw the line straight over the mountain: the part inside becomes a tunnel automatically and uses up one tunnel.',
    },
    109: {
      name: 'Twin Tunnels',
      intro: 'A mountain range blocks both lines. A line through a mountain becomes a tunnel; you have two tunnels.',
      tip: 'Lay both lines straight over the mountains: the parts inside become tunnels automatically.',
    },
    104: {
      name: 'Rail Bridge',
      intro: 'Two busy lines cross in the middle. Long trains wait for each other at the switch; take one line over on a bridge.',
      tip: 'Draw both lines. Then press "Bridge" at the bottom and tap the crossing: one line passes over the other.',
    },
    110: {
      name: 'River Bridges',
      intro: 'The river cuts both lines, and lower down the green line runs across them. River bridges build themselves.',
      tip: 'Lay all three lines: the parts over the river become bridges. Make the green line’s crossings switches.',
    },
    105: {
      name: 'River and Mountain',
      intro: 'A river splits the city in two, and there’s a mountain on the right. Bridge the river, tunnel the mountain; track is short.',
      tip: 'Draw both lines dead straight: the part over the river becomes a bridge and the part inside the mountain a tunnel, automatically.',
    },
    106: {
      name: 'Grand Terminal',
      intro: 'Three lines, two crossings and frequent trips. Which crossing gets a switch, and which a bridge or tunnel?',
      tip: 'Draw the two vertical lines, then the horizontal purple line across both. Make one crossing a bridge and the other a tunnel.',
    },

    // ---------- Demiryolu: Bölge hattı (11–20) ----------
    111: {
      name: 'Regional Line',
      intro: 'Welcome to the Regional line: the map is bigger. The green line crosses two lines; separate one crossing with a bridge.',
      tip: 'Lay all three lines. Press "Bridge" and tap the right crossing; leave the left one as a switch.',
    },
    112: {
      name: 'Long Switch',
      intro: 'The switch line is back, but longer and with rush hours: now and then, trips get more frequent.',
      tip: 'Merge both stations’ lines into one main line in the middle, then split it in two again at the top.',
    },
    113: {
      name: 'Three Bridges',
      intro: 'The river cuts all three lines, and there’s a hill on the right. The bridges and the tunnel build themselves.',
      tip: 'Lay all three lines straight: the parts over the river become bridges, the inside of the hill a tunnel.',
    },
    114: {
      name: 'Four Switches',
      intro: 'Two vertical lines, two horizontal: four crossings. Separate the two busiest with a bridge and a tunnel.',
      tip: 'Lay all four lines. Make the top-left crossing a bridge and the bottom-right one a tunnel.',
    },
    115: {
      name: 'Diagonal Bridge',
      intro: 'Two busy diagonal lines and rush hours. Don’t make long trains wait at the switch: separate the crossing with a bridge.',
      tip: 'Lay the two diagonal lines, then make their crossing a bridge.',
    },
    116: {
      name: 'Ridge Pass',
      intro: 'A mountain range cuts both lines, and up top the green line runs across both.',
      tip: 'Lay all three lines: the inside of the mountain becomes a tunnel. Make the right crossing a bridge.',
    },
    117: {
      name: 'Triple Crossing',
      intro: 'The purple line crosses three lines at once, and now and then trips get more frequent.',
      tip: 'Lay all four lines. Make the middle crossing a bridge and the right one a tunnel.',
    },
    118: {
      name: 'Big River',
      intro: 'River and mountain again, but the map is big and trips are frequent.',
      tip: 'Lay both lines straight: the part over the river becomes a bridge, the inside of the mountain a tunnel.',
    },
    119: {
      name: 'Opposite Way',
      intro: 'The purple line comes from the opposite direction, and there’s a river in the middle. Share out your bridges and tunnel.',
      tip: 'Lay all four lines. Make the top-right crossing a bridge and the bottom-left one a tunnel.',
    },
    120: {
      name: 'Regional Terminal',
      intro: 'The Regional line’s final test: three lines, two crossings and rush hours.',
      tip: 'Lay the two vertical lines and the horizontal purple line. Make one crossing a bridge and the other a tunnel.',
    },

    // ---------- Demiryolu: Ana hat (21–30) ----------
    121: {
      name: 'Main Line',
      intro: 'Welcome to the Main line. Five lines, six crossings: put the bridges and the tunnel on the busiest ones.',
      tip: 'Lay all five lines. Put a bridge and a tunnel on the two middle crossings, and another bridge at the top right.',
    },
    122: {
      name: 'River and Ridges',
      intro: 'A river and a mountain range cut all three lines, with the purple line along the top.',
      tip: 'Lay all four lines: the river becomes bridges, the mountain tunnels. Make the upper middle crossing a bridge.',
    },
    123: {
      name: 'Three Across',
      intro: 'Two vertical lines, three horizontal lines and rush hours. You can separate three of the six crossings.',
      tip: 'Lay all five lines. Put bridges at top left and middle right, and a tunnel at bottom left.',
    },
    124: {
      name: 'Lakeshore',
      intro: 'A lake on the left, the purple line up top. The orange line crosses the lake on a bridge.',
      tip: 'Lay all four lines. Make the middle crossing with the purple line a bridge and the right one a tunnel.',
    },
    125: {
      name: 'Four Lines',
      intro: 'Four parallel lines: the river cuts them all, the mountain on the right cuts two. No crossings, but trips are frequent.',
      tip: 'Lay all four lines straight.',
    },
    126: {
      name: 'Main Terminal',
      intro: 'The grand terminal is back, but on the Main line: long lines, frequent trips.',
      tip: 'Lay the two vertical lines and the horizontal purple line. Make one crossing a bridge and the other a tunnel.',
    },
    127: {
      name: 'Crossing Web',
      intro: 'Five lines, six crossings; you can separate four. Which ones stay switches?',
      tip: 'Lay all five lines. Put a bridge and a tunnel on the two middle crossings, and one of each in the corners too.',
    },
    128: {
      name: 'Long Cross',
      intro: 'The red line crosses four lines at once. You can separate three crossings.',
      tip: 'Lay all five lines. Put a bridge and a tunnel on the two inner crossings, and another bridge on the right one.',
    },
    129: {
      name: 'Nine Switches',
      intro: 'Six lines, nine crossings and rush hours. You can separate five of them.',
      tip: 'Lay all six lines. Make the center and one diagonal bridges, and the ends of the other diagonal tunnels.',
    },
    130: {
      name: 'Main Line Test',
      intro: 'A river, five lines, six crossings and rush hours. Beat this level to move on to High-speed rail.',
      tip: 'Lay all five lines. Make the two middle crossings bridges and the two corner ones tunnels.',
    },

    // ---------- Demiryolu: Hızlı tren (31–40) ----------
    131: {
      name: 'High-Speed Rail',
      intro: 'Welcome to the High-speed rail region. The mountain on the left sends the orange line into a tunnel.',
      tip: 'Lay all five lines. Make the upper middle crossing a bridge, the lower middle one a tunnel, and the top-right one a bridge.',
    },
    132: {
      name: 'Mountain Tunnels',
      intro: 'A long mountain range cuts all four lines, and along the top the red line runs across all four.',
      tip: 'Lay all five lines: the inside of the mountain becomes tunnels. Make the two inner crossings bridges.',
    },
    133: {
      name: 'Rail Network',
      intro: 'Six lines, nine crossings and rush hours. You can separate six of them.',
      tip: 'Lay all six lines. Make the center and one diagonal bridges, and the other diagonal’s ends and the bottom middle tunnels.',
    },
    134: {
      name: 'River Express',
      intro: 'River and mountain, now at high-speed pace: trips are very frequent.',
      tip: 'Lay both lines straight: the part over the river becomes a bridge, the inside of the mountain a tunnel.',
    },
    135: {
      name: 'Five Lines',
      intro: 'Five parallel lines: the river cuts them all, the mountain on the left cuts two. No crossings, but the rush hours are tough.',
      tip: 'Lay all five lines straight.',
    },
    136: {
      name: 'Express Junctions',
      intro: 'Two horizontal lines, one on each side of the river: four river bridges and eight crossings.',
      tip: 'Lay all six lines. Of the four inner crossings, make one diagonal pair bridges and the other pair tunnels.',
    },
    137: {
      name: 'Central Terminal',
      intro: 'The city’s central terminal: three long lines, two crossings and very frequent trips.',
      tip: 'Lay the two vertical lines and the horizontal purple line. Make one crossing a bridge and the other a tunnel.',
    },
    138: {
      name: 'Eight Crossings',
      intro: 'Four vertical lines, two horizontal: you can separate six of the eight crossings.',
      tip: 'Lay all six lines. Put a bridge or tunnel on the four inner crossings and on two corners.',
    },
    139: {
      name: 'Island Line',
      intro: 'Two rivers split the city into three; six river bridges build themselves.',
      tip: 'Lay all five lines. Make the upper middle crossing a bridge and the lower one a tunnel.',
    },
    140: {
      name: 'High-Speed Network',
      intro: 'Seven lines, twelve crossings and rush hours. The railway’s final test.',
      tip: 'Lay all seven lines. Separate eight crossings with bridges and tunnels, spread out along the diagonals.',
    },

    // ---------- Havalimanı: Küçük havalimanı (1–10) ----------
    201: {
      name: 'First Flight',
      intro: 'Planes will land, taxi to the orange gate, then take off. Draw a taxiway from arrivals to the gate and from the gate to departures.',
      tip: 'Draw a taxiway from the ARRIVALS sign to the gate, then another from the gate to the DEPARTURES sign.',
    },
    207: {
      name: 'Short Loop',
      intro: 'This time arrivals are on the left, departures on the right. Planes come along the apron to the gate, then carry on to departures.',
      tip: 'Go down from arrivals, draw a horizontal apron past the front of the gate, then go up to departures. Link the gate to the apron with a short taxiway.',
    },
    202: {
      name: 'Two Gates',
      intro: 'Two airlines, two gates. Merge the taxiways into one shared main taxiway; concrete is short.',
      tip: 'Split the main taxiway coming down from arrivals to the two gates; merge the routes from the gates to departures too.',
    },
    208: {
      name: 'The Apron',
      intro: 'Two gates share the same apron. One U-shaped taxiway and two short links are enough.',
      tip: 'Draw a U-shaped taxiway from arrivals to departures and connect both gates to the apron.',
    },
    203: {
      name: 'Cross the Runway',
      intro: 'There’s a second runway between the terminal and arrivals. If a taxiway crosses it, planes stop at the hold line while the runway is busy.',
      tip: 'Draw taxiways that cross the middle runway at right angles: the crossing becomes a hold line automatically. Keep runway crossings to a minimum.',
    },
    209: {
      name: 'Middle Runway',
      intro: 'There’s a second runway between arrivals and the apron. Where a taxiway crosses it, planes stop at the hold line.',
      tip: 'Draw the U-shaped taxiway; it crosses the runway twice at right angles. Connect the gates to the apron.',
    },
    204: {
      name: 'Taxiway Bridge',
      intro: 'The routes of arriving and departing planes cross in the middle. At rush hour, take one taxiway over on a bridge.',
      tip: 'Draw diagonal taxiways from arrivals to Gate A and from Gate B to departures, and link each side with a taxiway. Then press "Bridge" and tap the middle crossing.',
    },
    210: {
      name: 'Two Rows of Gates',
      intro: 'Gates on both sides of the apron: the top gate faces down, the bottom ones face up.',
      tip: 'Draw the U-shaped taxiway and connect all three gates to the apron with short links.',
    },
    205: {
      name: 'Rush Hour',
      intro: 'Three airlines and frequent arrivals. Arrivals on the left, departures on the right; incoming and outgoing routes will cross. Separate the crossings with a bridge and an underpass.',
      tip: 'Draw taxiways from the left to the three gates and from the gates to departures on the right; a link at the top takes Gate A’s planes to departures. Make the spot where incoming and outgoing routes cross an underpass or a bridge.',
    },
    206: {
      name: 'Two Runways',
      intro: 'Planes land on the top runway and take off from the bottom one. The terminal is in the middle; try to build without crossing either runway, so there are no hold lines.',
      tip: 'Draw taxiways from the arrivals side to the gates and from the gates to the departures side. If incoming and outgoing routes cross, make it a bridge.',
    },

    // ---------- Havalimanı: Bölge havalimanı (11–20) ----------
    211: {
      name: 'Big Bridge',
      intro: 'The taxiway bridge is back, now with rush hours: incoming and outgoing routes cross in the middle.',
      tip: 'Draw diagonal taxiways from arrivals to Gate A and from Gate B to departures, link the sides, and make the middle crossing a bridge.',
    },
    212: {
      name: 'Three Gates',
      intro: 'Welcome to the Regional airport: the map is bigger and there are three airlines.',
      tip: 'Draw the U-shaped taxiway and connect the three gates to the apron.',
    },
    213: {
      name: 'Reverse Runway',
      intro: 'Arrivals on the right, departures on the left, with a second runway in between. Keep runway crossings to a minimum.',
      tip: 'Draw two taxiways that cross the middle runway at right angles: one goes down to the gate, the other up to departures.',
    },
    214: {
      name: 'Runway Traffic',
      intro: 'Arrivals on the right, departures on the left, and a busy runway in between. Planes queue to cross it.',
      tip: 'Draw the U-shaped taxiway; it crosses the runway twice at right angles. Connect the three gates to the apron.',
    },
    215: {
      name: 'Busy Apron',
      intro: 'A two-gate terminal and rush hours: from time to time, planes arrive more often.',
      tip: 'Split the main taxiway coming down from arrivals to the two gates; merge the routes from the gates to departures too.',
    },
    216: {
      name: 'Double Row',
      intro: 'Four gates face each other across the apron; at rush hour the apron fills up.',
      tip: 'Draw the U-shaped taxiway and connect facing gates to the apron at the same point.',
    },
    217: {
      name: 'Regional Rush',
      intro: 'Three airlines, crossing routes and rush hours. Separate the crossing with an underpass.',
      tip: 'Draw taxiways from the left to the three gates and from the gates to departures on the right; make the spot where incoming and outgoing routes cross an underpass.',
    },
    218: {
      name: 'Mirror Apron',
      intro: 'Arrivals on the right, a runway in the middle and two rows of gates.',
      tip: 'Draw the U-shaped taxiway and connect the four gates to the apron.',
    },
    219: {
      name: 'Mirror Bridge',
      intro: 'The taxiway bridge, mirrored: arrivals on the left, departures on the right. Separate the middle crossing with a bridge.',
      tip: 'Draw the two diagonal taxiways and the side links, then make the middle crossing a bridge.',
    },
    220: {
      name: 'Regional Runways',
      intro: 'Arrivals runway at the top, departures runway at the bottom; gates on both sides of the central apron. The Regional airport’s final test.',
      tip: 'Go down from arrivals, draw a horizontal apron across the middle, then down from its far end to departures. Connect the gates to the apron.',
    },

    // ---------- Havalimanı: Uluslararası (21–30) ----------
    221: {
      name: 'International',
      intro: 'Welcome to the International terminal: five gates in two rows.',
      tip: 'Draw the U-shaped taxiway and connect the five gates to the apron.',
    },
    222: {
      name: 'Night Flights',
      intro: 'Arrivals on the right, departures on the left; the routes of three airlines cross.',
      tip: 'Draw from the right to the three gates and on to departures on the left; make the crossing an underpass.',
    },
    223: {
      name: 'Four Gates',
      intro: 'Four gates and a busy middle runway. Planes cross the runway twice.',
      tip: 'Draw the U-shaped taxiway and connect the four gates to the apron.',
    },
    224: {
      name: 'Bridge Time',
      intro: 'Long diagonal taxiways and frequent rush hours. Without a bridge, the apron locks up.',
      tip: 'Draw the two diagonal taxiways and the side links, then make the middle crossing a bridge.',
    },
    225: {
      name: 'Six Gates',
      intro: 'Six gates in two rows; arrivals on the right.',
      tip: 'Draw the U-shaped taxiway and connect the six gates to the apron.',
    },
    226: {
      name: 'Diagonal Runways',
      intro: 'Arrivals top right, departures bottom left; five gates on both sides of the central apron.',
      tip: 'Go down from arrivals, draw a horizontal apron across the middle, then down from its far end to departures. Connect the gates to the apron.',
    },
    227: {
      name: 'Transfers',
      intro: 'Six gates, a middle runway and rush hours: transfer passengers are waiting.',
      tip: 'Draw the U-shaped taxiway and connect the six gates to the apron.',
    },
    228: {
      name: 'Runway Crossing',
      intro: 'A busy middle runway and long taxiways. Keep runway crossings to a minimum.',
      tip: 'Draw two taxiways that cross the middle runway at right angles: one goes down to the gate, the other up to departures.',
    },
    229: {
      name: 'Crowded Terminal',
      intro: 'Three airlines, long routes and frequent rush hours.',
      tip: 'Draw from the left to the three gates and on to departures on the right; make the crossing an underpass.',
    },
    230: {
      name: 'International Test',
      intro: 'Seven gates, a middle runway and rush hours. Beat this level to move on to the Mega airport.',
      tip: 'Draw the U-shaped taxiway and connect the seven gates to the apron.',
    },

    // ---------- Havalimanı: Mega havalimanı (31–40) ----------
    231: {
      name: 'Mega Apron',
      intro: 'Welcome to the Mega airport: one long apron and six gates.',
      tip: 'Draw the U-shaped taxiway and connect the six gates to the apron.',
    },
    232: {
      name: 'Mega Bridge',
      intro: 'Very long diagonal taxiways, frequent arrivals and rush hours.',
      tip: 'Draw the two diagonal taxiways and the side links, then make the middle crossing a bridge.',
    },
    233: {
      name: 'Night Runway',
      intro: 'Arrivals on the right, a busy middle runway, six gates and rush hours.',
      tip: 'Draw the U-shaped taxiway and connect the six gates to the apron.',
    },
    234: {
      name: 'Parallel Runways',
      intro: 'Two long runways with a six-gate terminal between them; at rush hour, arrivals and departures pick up.',
      tip: 'Go down from arrivals, draw a horizontal apron across the middle, then down from its far end to departures. Connect the gates to the apron.',
    },
    235: {
      name: 'Five Gates',
      intro: 'A long five-gate apron and a busy middle runway.',
      tip: 'Draw the U-shaped taxiway and connect the five gates to the apron.',
    },
    236: {
      name: 'Holiday Season',
      intro: 'Holiday season: three airlines, crossing routes and frequent rush hours.',
      tip: 'Draw from the right to the three gates and on to departures on the left; make the crossing an underpass.',
    },
    237: {
      name: 'Seven Gates',
      intro: 'Seven gates, two rows and rush hours.',
      tip: 'Draw the U-shaped taxiway and connect the seven gates to the apron.',
    },
    238: {
      name: 'Final Bridge',
      intro: 'The longest diagonal taxiways and the most frequent arrivals. Put the bridge in the right place.',
      tip: 'Draw the two diagonal taxiways and the side links, then make the middle crossing a bridge.',
    },
    239: {
      name: 'Giant Runways',
      intro: 'Two giant runways with a seven-gate terminal between them; rush hours come often.',
      tip: 'Go down from arrivals, draw a horizontal apron across the middle, then down from its far end to departures. Connect the gates to the apron.',
    },
    240: {
      name: 'Mega Airport',
      intro: 'Seven gates, a busy middle runway and rush hours. The airport’s final test.',
      tip: 'Draw the U-shaped taxiway and connect the seven gates to the apron.',
    },
  });
})();
