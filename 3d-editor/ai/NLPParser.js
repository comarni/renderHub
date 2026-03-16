/* ═══════════════════════════════════════════════════════════════
   NLPParser — Natural Language → generation parameters
   Supports Spanish and English.
   ═══════════════════════════════════════════════════════════════ */

/** Strip diacritics and lowercase a string for lookup. */
function norm(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* ── Dictionaries ────────────────────────────────────────────── */

/** Maps word → internal type key */
const OBJECTS_RAW = {
  // Spanish
  perro: 'dog', perros: 'dog', perrita: 'dog', perrito: 'dog',
  gato: 'cat', gatos: 'cat', gatito: 'cat', gatita: 'cat', minino: 'cat',
  coche: 'car', coches: 'car', carro: 'car', carros: 'car',
  auto: 'car', autos: 'car', automovil: 'car', automóvil: 'car', vehiculo: 'car',
  casa: 'house', casas: 'house', hogar: 'house', chalet: 'house',
  arbol: 'tree', áarbol: 'tree', arboles: 'tree', pino: 'tree', pinos: 'tree',
  silla: 'chair', sillas: 'chair', butaca: 'chair', butacas: 'chair',
  mesa: 'table', mesas: 'table', escritorio: 'table', escritorios: 'table',
  robot: 'robot', robots: 'robot', androide: 'robot', androides: 'robot',
  persona: 'human', personas: 'human',
  humano: 'human', humanos: 'human', humana: 'human', humanas: 'human',
  hombre: 'human', mujer: 'human', chico: 'human', chica: 'human',
  // English
  dog: 'dog', dogs: 'dog', puppy: 'dog', pup: 'dog',
  cat: 'cat', cats: 'cat', kitten: 'cat',
  car: 'car', cars: 'car', vehicle: 'car', automobile: 'car', truck: 'car',
  house: 'house', houses: 'house', home: 'house', building: 'house',
  tree: 'tree', trees: 'tree', pine: 'tree',
  chair: 'chair', chairs: 'chair',
  table: 'table', tables: 'table', desk: 'table',
  robot: 'robot', robots: 'robot', android: 'robot', bot: 'robot',
  human: 'human', humans: 'human', person: 'human', people: 'human',
  man: 'human', woman: 'human', figure: 'human',
};

/** Maps word → scale multiplier */
const SIZES_RAW = {
  // Spanish
  enorme: 2.5, enormes: 2.5, gigante: 3.0, gigantes: 3.0,
  gigantesco: 3.0, gigantesca: 3.0,
  grande: 1.5, grandes: 1.5, gran: 1.5,
  mediano: 1.0, mediana: 1.0, medianos: 1.0,
  pequeño: 0.6, pequeña: 0.6, pequeños: 0.6, pequeñas: 0.6,
  chico: 0.6, chica: 0.6, mini: 0.5, minusculo: 0.4, minuscula: 0.4,
  // English
  huge: 2.5, enormous: 2.5, giant: 3.0, gigantic: 3.0,
  large: 1.5, big: 1.5,
  medium: 1.0, normal: 1.0,
  small: 0.6, little: 0.6, micro: 0.5, tiny: 0.4,
};

/** Maps word → hex color string */
const COLORS_RAW = {
  // Spanish
  rojo: '#cc2200', roja: '#cc2200', rojos: '#cc2200', rojas: '#cc2200',
  azul: '#1a5fa8', azules: '#1a5fa8',
  verde: '#2a8c3a', verdes: '#2a8c3a',
  amarillo: '#e8c840', amarilla: '#e8c840', amarillos: '#e8c840',
  negro: '#111111', negra: '#111111', negros: '#111111', negras: '#111111',
  blanco: '#f5f5f5', blanca: '#f5f5f5', blancos: '#f5f5f5', blancas: '#f5f5f5',
  gris: '#808080', grises: '#808080',
  naranja: '#e86430', naranjas: '#e86430',
  morado: '#703090', morada: '#703090', morados: '#703090', moradas: '#703090',
  rosa: '#e8609a', rosas: '#e8609a',
  marron: '#8B562E', marrón: '#8B562E', marrones: '#8B562E',
  dorado: '#d4aa00', dorada: '#d4aa00', oro: '#d4aa00',
  plateado: '#b0b0b0', plata: '#b0b0b0',
  cian: '#00cccc', violeta: '#6622aa',
  // English
  red: '#cc2200', blue: '#1a5fa8', green: '#2a8c3a', yellow: '#e8c840',
  black: '#111111', white: '#f5f5f5', gray: '#808080', grey: '#808080',
  orange: '#e86430', purple: '#703090', pink: '#e8609a', brown: '#8B562E',
  gold: '#d4aa00', silver: '#b0b0b0', cyan: '#00cccc', violet: '#6622aa',
};

/** Spanish number words (1–10) */
const NUMBERS_ES = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};

/* ── Pre-normalise all dictionary keys once at load time ─────── */
function buildNorm(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    out[norm(k)] = v;
  }
  return out;
}

const OBJECTS = buildNorm(OBJECTS_RAW);
const SIZES   = buildNorm(SIZES_RAW);
const COLORS  = buildNorm(COLORS_RAW);

/* ── NLPParser class ────────────────────────────────────────── */

export class NLPParser {
  /**
   * Parse free-form text in Spanish or English.
   *
   * @param {string} text
   * @returns {{ type: string, scale: number, color: string|null, count: number } | null}
   *   Returns null if no known object type is found.
   */
  parse(text) {
    // Normalise: lowercase + strip diacritics + remove punctuation
    const lower = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[¿¡!?.,:;()\-]/g, ' ');

    const words = lower.split(/\s+/).filter(Boolean);

    let type  = null;
    let scale = 1.0;
    let color = null;
    let count = 1;

    for (const word of words) {
      if (!type && OBJECTS[word])           type  = OBJECTS[word];
      if (SIZES[word]   !== undefined)      scale = SIZES[word];
      if (COLORS[word])                     color = COLORS[word];
      if (NUMBERS_ES[word])                 count = NUMBERS_ES[word];
      const asInt = parseInt(word, 10);
      if (!isNaN(asInt) && asInt >= 1 && asInt <= 20) count = asInt;
    }

    if (!type) return null;

    return { type, scale, color, count: Math.max(1, Math.min(count, 10)) };
  }

  /** List of all supported object types. */
  get supportedObjects() {
    return [...new Set(Object.values(OBJECTS_RAW))].sort();
  }
}
