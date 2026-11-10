export const BOARD = [
  { id: 0, name: 'Start', type: 'start', subtitle: 'Los geht’s!' },
  { id: 1, name: 'Mohnweg', type: 'property', group: 'copper', color: '#9B6847', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
  { id: 2, name: 'Stadtpost', type: 'chest', subtitle: 'Gemeinschaft' },
  { id: 3, name: 'Kieselstraße', type: 'property', group: 'copper', color: '#9B6847', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
  { id: 4, name: 'Stadtkasse', type: 'tax', amount: 200, subtitle: 'Steuer' },
  { id: 5, name: 'Nordbahnhof', type: 'rail', price: 200, rent: [25, 50, 100, 200] },
  { id: 6, name: 'Lindenallee', type: 'property', group: 'sky', color: '#8BCDEB', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { id: 7, name: 'Überraschung', type: 'chance', subtitle: 'Ereigniskarte' },
  { id: 8, name: 'Wolkenplatz', type: 'property', group: 'sky', color: '#8BCDEB', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { id: 9, name: 'Seeblick', type: 'property', group: 'sky', color: '#8BCDEB', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
  { id: 10, name: 'Zu Besuch', type: 'jail', subtitle: 'Nur zu Besuch' },
  { id: 11, name: 'Rosengarten', type: 'property', group: 'rose', color: '#D86E9A', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { id: 12, name: 'Lichtwerk', type: 'utility', price: 150, utility: true },
  { id: 13, name: 'Kirschgasse', type: 'property', group: 'rose', color: '#D86E9A', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { id: 14, name: 'Blütenhof', type: 'property', group: 'rose', color: '#D86E9A', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
  { id: 15, name: 'Südbahnhof', type: 'rail', price: 200, rent: [25, 50, 100, 200] },
  { id: 16, name: 'Goldmarkt', type: 'property', group: 'amber', color: '#F2BE52', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { id: 17, name: 'Stadtpost', type: 'chest', subtitle: 'Gemeinschaft' },
  { id: 18, name: 'Sonnenufer', type: 'property', group: 'amber', color: '#F2BE52', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { id: 19, name: 'Panoramapark', type: 'property', group: 'amber', color: '#F2BE52', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
  { id: 20, name: 'Freier Platz', type: 'parking', subtitle: 'Durchatmen' },
  { id: 21, name: 'Hafenstraße', type: 'property', group: 'coral', color: '#E98562', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { id: 22, name: 'Überraschung', type: 'chance', subtitle: 'Ereigniskarte' },
  { id: 23, name: 'Musikviertel', type: 'property', group: 'coral', color: '#E98562', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { id: 24, name: 'Leuchtturmbogen', type: 'property', group: 'coral', color: '#E98562', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
  { id: 25, name: 'Westbahnhof', type: 'rail', price: 200, rent: [25, 50, 100, 200] },
  { id: 26, name: 'Waldpromenade', type: 'property', group: 'jade', color: '#58B99A', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { id: 27, name: 'Farnweg', type: 'property', group: 'jade', color: '#58B99A', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { id: 28, name: 'Wasserwerk', type: 'utility', price: 150, utility: true },
  { id: 29, name: 'Grüne Höhe', type: 'property', group: 'jade', color: '#58B99A', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
  { id: 30, name: 'Ab ins Büro', type: 'gotojail', subtitle: 'Direkt ins Gefängnis' },
  { id: 31, name: 'Sternenplatz', type: 'property', group: 'indigo', color: '#687BE0', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { id: 32, name: 'Kunstquartier', type: 'property', group: 'indigo', color: '#687BE0', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { id: 33, name: 'Stadtpost', type: 'chest', subtitle: 'Gemeinschaft' },
  { id: 34, name: 'Aussichtsturm', type: 'property', group: 'indigo', color: '#687BE0', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
  { id: 35, name: 'Flughafenbahn', type: 'rail', price: 200, rent: [25, 50, 100, 200] },
  { id: 36, name: 'Überraschung', type: 'chance', subtitle: 'Ereigniskarte' },
  { id: 37, name: 'Kronenviertel', type: 'property', group: 'plum', color: '#A17BCB', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
  { id: 38, name: 'Luxusabgabe', type: 'tax', amount: 100, subtitle: 'Steuer' },
  { id: 39, name: 'Palaisboulevard', type: 'property', group: 'plum', color: '#A17BCB', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 }
];

export const GROUPS = Object.fromEntries(
  [...new Set(BOARD.filter(s => s.group).map(s => s.group))].map(group => [group, BOARD.filter(s => s.group === group).map(s => s.id)])
);

export const CARD_DECKS = {
  chance: [
    { text: 'Direkt zum Start! Du erhältst 200 M.', move: 0, passGo: true },
    { text: 'Ein schöner Bonus: Du erhältst 150 M.', cash: 150 },
    { text: 'Die Stadt braucht dich: Zahle 100 M.', cash: -100 },
    { text: 'Rücke drei Felder zurück.', back: 3 },
    { text: 'Fahre zum Sternenplatz.', move: 31, passGo: true },
    { text: 'Auf zur nächsten Bahnstation!', nextRail: true },
    { text: 'Ein freier Tag hinter Gittern? Ab ins Gefängnis.', jail: true },
    { text: 'Du hast einen Haftfrei-Pass erhalten.', getOut: true },
    { text: 'Kleine Reparaturen: Zahle 25 M. je Haus und 100 M. je Hotel.', repairs: true },
    { text: 'Dein Einsatz zahlt sich aus: Erhalte 50 M. von jedem Mitspieler.', fromEach: 50 }
  ],
  chest: [
    { text: 'Ein Geschenk aus der Nachbarschaft: Erhalte 100 M.', cash: 100 },
    { text: 'Die Kasse klingelt: Erhalte 200 M.', cash: 200 },
    { text: 'Die Gemeinschaft sammelt für dich: Erhalte 50 M.', cash: 50 },
    { text: 'Ein kleiner Beitrag fürs Viertel: Zahle 50 M.', cash: -50 },
    { text: 'Du rückst zum Start vor und erhältst 200 M.', move: 0, passGo: true },
    { text: 'Du musst ins Gefängnis. Dein Zug endet.', jail: true },
    { text: 'Hier ist dein Haftfrei-Pass.', getOut: true },
    { text: 'Die Stadtwerke schicken eine Rechnung über 40 M.', cash: -40 },
    { text: 'Deine Anlage bringt 100 M. ein.', cash: 100 },
    { text: 'Straßenfest! Jeder Mitspieler zahlt dir 20 M.', fromEach: 20 }
  ]
};
