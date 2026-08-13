export const LEVEL_TITLES = {
  1: 'CIVILIAN', 5: 'ROOKIE', 10: 'MERCENARY',
  15: 'SOLO', 20: 'NETRUNNER', 30: 'FIXER',
  40: 'CORPO', 50: 'NIGHT CITY LEGEND', 60: 'CYBERPSYCHO',
  70: 'MAXTAC', 80: 'TRAUMA TEAM', 90: 'AFTERLIFE LEGEND',
  100: 'CHOOMBA SUPREME'
};

export function getTitle(level) {
  const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
  for (const k of keys) { if (level >= k) return LEVEL_TITLES[k]; }
  return `EDGE RUNNER LVL ${level}`;
}

export const CONFIG = {
  backgrounds: [
    'fondos/isabela.mp4', 'fondos/bloodborne.mp4', 'fondos/ciri.mp4', 'fondos/claire.mp4',
    'fondos/geral.mp4', 'fondos/grace.mp4', 'fondos/gustave.mp4', 'fondos/jill.mp4',
    'fondos/karlach.mp4', 'fondos/laezel.mp4', 'fondos/leon.mp4', 'fondos/lune.mp4',
    'fondos/maelle.mp4', 'fondos/senua.mp4', 'fondos/shadow.mp4', 'fondos/triss.mp4',
    'fondos/yenn.mp4', 'fondos/kratos.mp4', 'fondos/mrx.mp4', 'fondos/panam.mp4',
    'fondos/jynx.mp4', 'fondos/claire2.mp4', 'fondos/sciel.mp4', 'fondos/samu.mp4'
  ].sort(() => Math.random() - 0.5),
  bgInterval: 15000,
  menuInterval: 20000,
  countdownMinutes: 5,
};

export const MENU_ITEMS = [
  { id: 'horario',  title: 'HORARIOS',         sub: 'Stream Schedule' },
  { id: 'topcanal', title: 'TOP',              sub: 'Community Feed' },
  { id: 'item1',    title: 'ULTIMOS DIRECTOS', sub: 'Archive' },
];

export const MENU_DURATIONS = {
  horario: 15000,
  topcanal: 40000,
  item1: 10000,
};

export const DAY_NAMES = {
  lunes: 'LUNES', martes: 'MARTES', miercoles: 'MIERCOLES',
  jueves: 'JUEVES', viernes: 'VIERNES', sabado: 'SABADO', domingo: 'DOMINGO',
};

export const DAY_KEYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
