const { Language, Word, EtymologicalConnection, LanguageGraph } = require('../models/types');

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function createSampleData() {
  const graph = new LanguageGraph();

  // Add languages
  const languages = [
    new Language('en', 'English', 'Germanic'),
    new Language('es', 'Spanish', 'Romance'),
    new Language('fr', 'French', 'Romance'),
    new Language('de', 'German', 'Germanic'),
    new Language('it', 'Italian', 'Romance'),
    new Language('pt', 'Portuguese', 'Romance'),
    new Language('nl', 'Dutch', 'Germanic'),
    new Language('la', 'Latin', 'Italic'),
    new Language('gr', 'Greek', 'Hellenic')
  ];

  languages.forEach(lang => graph.languages.set(lang.code, lang));

  // Sample words with etymological connections - focused on English and Spanish depth
  const sampleWords = [
    // WATER FAMILY - Deep connections
    { id: 'w1', text: 'water', language: 'en', pos: 'noun', def: 'colorless liquid essential for life' },
    { id: 'w2', text: 'agua', language: 'es', pos: 'noun', def: 'líquido incoloro esencial para la vida' },
    { id: 'w3', text: 'eau', language: 'fr', pos: 'noun', def: 'liquide incolore essentiel à la vie' },
    { id: 'w4', text: 'Wasser', language: 'de', pos: 'noun', def: 'farblose Flüssigkeit, die für das Leben unerlässlich ist' },
    { id: 'w5', text: 'acqua', language: 'it', pos: 'noun', def: 'liquido incolore essenziale per la vita' },
    { id: 'w6', text: 'aqua', language: 'la', pos: 'noun', def: 'colorless liquid essential for life' },

    // Water-related English words
    { id: 'w50', text: 'aquatic', language: 'en', pos: 'adjective', def: 'relating to water' },
    { id: 'w51', text: 'aquarium', language: 'en', pos: 'noun', def: 'tank for aquatic animals' },
    { id: 'w52', text: 'aqueduct', language: 'en', pos: 'noun', def: 'channel for conveying water' },
    { id: 'w53', text: 'waterfall', language: 'en', pos: 'noun', def: 'cascade of falling water' },
    { id: 'w54', text: 'watershed', language: 'en', pos: 'noun', def: 'area draining into a river' },

    // Water-related Spanish words
    { id: 'w55', text: 'acuático', language: 'es', pos: 'adjective', def: 'relacionado con el agua' },
    { id: 'w56', text: 'acuario', language: 'es', pos: 'noun', def: 'tanque para animales acuáticos' },
    { id: 'w57', text: 'acueducto', language: 'es', pos: 'noun', def: 'canal para transportar agua' },
    { id: 'w58', text: 'cascada', language: 'es', pos: 'noun', def: 'caída de agua' },
    { id: 'w59', text: 'aguacero', language: 'es', pos: 'noun', def: 'heavy rainfall' },

    // FAMILY RELATIONSHIPS - Deep connections
    { id: 'w7', text: 'mother', language: 'en', pos: 'noun', def: 'female parent' },
    { id: 'w8', text: 'madre', language: 'es', pos: 'noun', def: 'progenitora femenina' },
    { id: 'w9', text: 'mère', language: 'fr', pos: 'noun', def: 'parent femelle' },
    { id: 'w10', text: 'Mutter', language: 'de', pos: 'noun', def: 'weiblicher Elternteil' },
    { id: 'w11', text: 'madre', language: 'it', pos: 'noun', def: 'genitore femminile' },
    { id: 'w12', text: 'mater', language: 'la', pos: 'noun', def: 'female parent' },

    { id: 'w13', text: 'brother', language: 'en', pos: 'noun', def: 'male sibling' },
    { id: 'w14', text: 'hermano', language: 'es', pos: 'noun', def: 'hermano masculino' },
    { id: 'w15', text: 'frère', language: 'fr', pos: 'noun', def: 'frère masculin' },
    { id: 'w16', text: 'Bruder', language: 'de', pos: 'noun', def: 'männlicher Geschwister' },
    { id: 'w17', text: 'fratello', language: 'it', pos: 'noun', def: 'fratello maschio' },
    { id: 'w18', text: 'frater', language: 'la', pos: 'noun', def: 'male sibling' },

    // Extended family - English
    { id: 'w60', text: 'father', language: 'en', pos: 'noun', def: 'male parent' },
    { id: 'w61', text: 'sister', language: 'en', pos: 'noun', def: 'female sibling' },
    { id: 'w62', text: 'parent', language: 'en', pos: 'noun', def: 'mother or father' },
    { id: 'w63', text: 'family', language: 'en', pos: 'noun', def: 'group of related people' },
    { id: 'w64', text: 'maternal', language: 'en', pos: 'adjective', def: 'relating to a mother' },
    { id: 'w65', text: 'paternal', language: 'en', pos: 'adjective', def: 'relating to a father' },
    { id: 'w66', text: 'fraternal', language: 'en', pos: 'adjective', def: 'relating to brothers' },

    // Extended family - Spanish
    { id: 'w67', text: 'padre', language: 'es', pos: 'noun', def: 'progenitor masculino' },
    { id: 'w68', text: 'hermana', language: 'es', pos: 'noun', def: 'hermana femenina' },
    { id: 'w69', text: 'familia', language: 'es', pos: 'noun', def: 'grupo de personas relacionadas' },
    { id: 'w70', text: 'materno', language: 'es', pos: 'adjective', def: 'relacionado con la madre' },
    { id: 'w71', text: 'paterno', language: 'es', pos: 'adjective', def: 'relacionado con el padre' },
    { id: 'w72', text: 'fraterno', language: 'es', pos: 'adjective', def: 'relacionado con hermanos' },

    // HOUSE/HOME FAMILY - Deep connections
    { id: 'w80', text: 'house', language: 'en', pos: 'noun', def: 'building for human habitation' },
    { id: 'w81', text: 'casa', language: 'es', pos: 'noun', def: 'edificio para habitación humana' },
    { id: 'w82', text: 'home', language: 'en', pos: 'noun', def: 'place where one lives' },
    { id: 'w83', text: 'hogar', language: 'es', pos: 'noun', def: 'lugar donde uno vive' },

    // House-related English
    { id: 'w84', text: 'housing', language: 'en', pos: 'noun', def: 'accommodation' },
    { id: 'w85', text: 'household', language: 'en', pos: 'noun', def: 'family living together' },
    { id: 'w86', text: 'domestic', language: 'en', pos: 'adjective', def: 'relating to home' },
    { id: 'w87', text: 'domicile', language: 'en', pos: 'noun', def: 'place of residence' },

    // House-related Spanish
    { id: 'w88', text: 'casero', language: 'es', pos: 'adjective', def: 'relacionado con la casa' },
    { id: 'w89', text: 'doméstico', language: 'es', pos: 'adjective', def: 'relacionado con el hogar' },
    { id: 'w90', text: 'domicilio', language: 'es', pos: 'noun', def: 'lugar de residencia' },

    // FOOD/EAT FAMILY - Deep connections
    { id: 'w100', text: 'eat', language: 'en', pos: 'verb', def: 'consume food' },
    { id: 'w101', text: 'comer', language: 'es', pos: 'verb', def: 'consumir alimentos' },
    { id: 'w102', text: 'food', language: 'en', pos: 'noun', def: 'substance consumed for nutrition' },
    { id: 'w103', text: 'comida', language: 'es', pos: 'noun', def: 'sustancia consumida para nutrición' },

    // Food-related English
    { id: 'w104', text: 'edible', language: 'en', pos: 'adjective', def: 'safe to eat' },
    { id: 'w105', text: 'restaurant', language: 'en', pos: 'noun', def: 'place serving food' },
    { id: 'w106', text: 'kitchen', language: 'en', pos: 'noun', def: 'room for cooking' },
    { id: 'w107', text: 'meal', language: 'en', pos: 'noun', def: 'eating occasion' },
    { id: 'w108', text: 'dining', language: 'en', pos: 'noun', def: 'act of eating' },

    // Food-related Spanish
    { id: 'w109', text: 'comestible', language: 'es', pos: 'adjective', def: 'seguro para comer' },
    { id: 'w110', text: 'restaurante', language: 'es', pos: 'noun', def: 'lugar que sirve comida' },
    { id: 'w111', text: 'cocina', language: 'es', pos: 'noun', def: 'habitación para cocinar' },
    { id: 'w112', text: 'comedor', language: 'es', pos: 'noun', def: 'lugar para comer' },

    // NATURE ELEMENTS
    { id: 'w19', text: 'fire', language: 'en', pos: 'noun', def: 'combustion producing heat and light' },
    { id: 'w20', text: 'fuego', language: 'es', pos: 'noun', def: 'combustión que produce calor y luz' },
    { id: 'w21', text: 'feu', language: 'fr', pos: 'noun', def: 'combustion produisant chaleur et lumière' },
    { id: 'w22', text: 'Feuer', language: 'de', pos: 'noun', def: 'Verbrennung die Wärme und Licht erzeugt' },
    { id: 'w23', text: 'fuoco', language: 'it', pos: 'noun', def: 'combustione che produce calore e luce' },
    { id: 'w24', text: 'ignis', language: 'la', pos: 'noun', def: 'combustion producing heat and light' },

    // More nature - English/Spanish focus
    { id: 'w120', text: 'earth', language: 'en', pos: 'noun', def: 'the planet we live on' },
    { id: 'w121', text: 'tierra', language: 'es', pos: 'noun', def: 'el planeta en que vivimos' },
    { id: 'w122', text: 'sky', language: 'en', pos: 'noun', def: 'space above earth' },
    { id: 'w123', text: 'cielo', language: 'es', pos: 'noun', def: 'espacio sobre la tierra' },
    { id: 'w124', text: 'sun', language: 'en', pos: 'noun', def: 'star at center of solar system' },
    { id: 'w125', text: 'sol', language: 'es', pos: 'noun', def: 'estrella en el centro del sistema solar' },
    { id: 'w126', text: 'moon', language: 'en', pos: 'noun', def: 'natural satellite of Earth' },
    { id: 'w127', text: 'luna', language: 'es', pos: 'noun', def: 'satélite natural de la Tierra' },

    // COMMON VERBS - English/Spanish depth
    { id: 'w140', text: 'love', language: 'en', pos: 'verb', def: 'feel affection for' },
    { id: 'w141', text: 'amar', language: 'es', pos: 'verb', def: 'sentir afecto por' },
    { id: 'w142', text: 'work', language: 'en', pos: 'verb', def: 'engage in activity' },
    { id: 'w143', text: 'trabajar', language: 'es', pos: 'verb', def: 'participar en actividad' },
    { id: 'w144', text: 'speak', language: 'en', pos: 'verb', def: 'talk or communicate' },
    { id: 'w145', text: 'hablar', language: 'es', pos: 'verb', def: 'hablar o comunicar' },
    { id: 'w146', text: 'think', language: 'en', pos: 'verb', def: 'use one\'s mind' },
    { id: 'w147', text: 'pensar', language: 'es', pos: 'verb', def: 'usar la mente' },

    // Work-related English
    { id: 'w148', text: 'worker', language: 'en', pos: 'noun', def: 'person who works' },
    { id: 'w149', text: 'workplace', language: 'en', pos: 'noun', def: 'place of employment' },
    { id: 'w150', text: 'job', language: 'en', pos: 'noun', def: 'paid position' },

    // Work-related Spanish
    { id: 'w151', text: 'trabajador', language: 'es', pos: 'noun', def: 'persona que trabaja' },
    { id: 'w152', text: 'trabajo', language: 'es', pos: 'noun', def: 'actividad laboral' },
    { id: 'w153', text: 'empleo', language: 'es', pos: 'noun', def: 'posición remunerada' },

    // CROSS-LANGUAGE PHRASES AND COMPOUND WORDS
    // Time expressions
    { id: 'w160', text: 'good morning', language: 'en', pos: 'phrase', def: 'greeting used in the morning' },
    { id: 'w161', text: 'buenos días', language: 'es', pos: 'phrase', def: 'saludo usado en la mañana' },
    { id: 'w162', text: 'good night', language: 'en', pos: 'phrase', def: 'farewell greeting for evening' },
    { id: 'w163', text: 'buenas noches', language: 'es', pos: 'phrase', def: 'saludo de despedida para la noche' },

    // Common expressions
    { id: 'w164', text: 'thank you', language: 'en', pos: 'phrase', def: 'expression of gratitude' },
    { id: 'w165', text: 'gracias', language: 'es', pos: 'phrase', def: 'expresión de gratitud' },
    { id: 'w166', text: 'please', language: 'en', pos: 'phrase', def: 'polite request word' },
    { id: 'w167', text: 'por favor', language: 'es', pos: 'phrase', def: 'palabra de petición cortés' },

    // Compound words - English
    { id: 'w170', text: 'grandfather', language: 'en', pos: 'noun', def: 'father of one\'s parent' },
    { id: 'w171', text: 'grandmother', language: 'en', pos: 'noun', def: 'mother of one\'s parent' },
    { id: 'w172', text: 'bedroom', language: 'en', pos: 'noun', def: 'room for sleeping' },
    { id: 'w173', text: 'bathroom', language: 'en', pos: 'noun', def: 'room for bathing' },

    // Compound words - Spanish
    { id: 'w174', text: 'abuelo', language: 'es', pos: 'noun', def: 'padre del padre o madre' },
    { id: 'w175', text: 'abuela', language: 'es', pos: 'noun', def: 'madre del padre o madre' },
    { id: 'w176', text: 'dormitorio', language: 'es', pos: 'noun', def: 'habitación para dormir' },
    { id: 'w177', text: 'baño', language: 'es', pos: 'noun', def: 'habitación para bañarse' },

    // Color family - cross-language
    { id: 'w180', text: 'red', language: 'en', pos: 'adjective', def: 'color of blood or fire' },
    { id: 'w181', text: 'rojo', language: 'es', pos: 'adjective', def: 'color de la sangre o fuego' },
    { id: 'w182', text: 'blue', language: 'en', pos: 'adjective', def: 'color of the sky' },
    { id: 'w183', text: 'azul', language: 'es', pos: 'adjective', def: 'color del cielo' },
    { id: 'w184', text: 'green', language: 'en', pos: 'adjective', def: 'color of grass' },
    { id: 'w185', text: 'verde', language: 'es', pos: 'adjective', def: 'color de la hierba' },

    // Body parts - cross-language
    { id: 'w190', text: 'hand', language: 'en', pos: 'noun', def: 'part of body at end of arm' },
    { id: 'w191', text: 'mano', language: 'es', pos: 'noun', def: 'parte del cuerpo al final del brazo' },
    { id: 'w192', text: 'foot', language: 'en', pos: 'noun', def: 'part of body at end of leg' },
    { id: 'w193', text: 'pie', language: 'es', pos: 'noun', def: 'parte del cuerpo al final de la pierna' },
    { id: 'w194', text: 'head', language: 'en', pos: 'noun', def: 'uppermost part of body' },
    { id: 'w195', text: 'cabeza', language: 'es', pos: 'noun', def: 'parte superior del cuerpo' },

    // Numbers - cross-language
    { id: 'w200', text: 'one', language: 'en', pos: 'number', def: 'the number 1' },
    { id: 'w201', text: 'uno', language: 'es', pos: 'number', def: 'el número 1' },
    { id: 'w202', text: 'two', language: 'en', pos: 'number', def: 'the number 2' },
    { id: 'w203', text: 'dos', language: 'es', pos: 'number', def: 'el número 2' },
    { id: 'w204', text: 'three', language: 'en', pos: 'number', def: 'the number 3' },
    { id: 'w205', text: 'tres', language: 'es', pos: 'number', def: 'el número 3' },

    // Latin connections
    { id: 'w210', text: 'manus', language: 'la', pos: 'noun', def: 'hand' },
    { id: 'w211', text: 'pes', language: 'la', pos: 'noun', def: 'foot' },
    { id: 'w212', text: 'caput', language: 'la', pos: 'noun', def: 'head' },
    { id: 'w213', text: 'unus', language: 'la', pos: 'number', def: 'one' },
    { id: 'w214', text: 'duo', language: 'la', pos: 'number', def: 'two' },
    { id: 'w215', text: 'tres', language: 'la', pos: 'number', def: 'three' }
  ];

  // Add words to graph
  sampleWords.forEach(wordData => {
    const word = new Word(wordData.id, wordData.text, wordData.language, wordData.pos, wordData.def);
    graph.addWord(word);
  });

  // Create etymological connections
  const connections = [
    // WATER FAMILY CONNECTIONS
    // Romance languages from Latin (water)
    new EtymologicalConnection(generateId(), 'w6', 'w2', 'derivative', 0.95, 'Spanish agua from Latin aqua'),
    new EtymologicalConnection(generateId(), 'w6', 'w3', 'derivative', 0.90, 'French eau from Latin aqua via VL *aqua'),
    new EtymologicalConnection(generateId(), 'w6', 'w5', 'derivative', 0.95, 'Italian acqua from Latin aqua'),

    // Germanic cognates (water)
    new EtymologicalConnection(generateId(), 'w1', 'w4', 'cognate', 0.85, 'English water and German Wasser from Proto-Germanic *watōr'),

    // English water-related words from Latin aqua
    new EtymologicalConnection(generateId(), 'w6', 'w50', 'derivative', 0.95, 'aquatic from Latin aquaticus'),
    new EtymologicalConnection(generateId(), 'w6', 'w51', 'derivative', 0.95, 'aquarium from Latin aquarium'),
    new EtymologicalConnection(generateId(), 'w6', 'w52', 'derivative', 0.95, 'aqueduct from Latin aquaeductus'),

    // English water semantic connections
    new EtymologicalConnection(generateId(), 'w1', 'w53', 'semantic', 0.90, 'waterfall contains water'),
    new EtymologicalConnection(generateId(), 'w1', 'w54', 'semantic', 0.85, 'watershed relates to water drainage'),

    // Spanish water-related words from Latin aqua
    new EtymologicalConnection(generateId(), 'w6', 'w55', 'derivative', 0.95, 'acuático from Latin aquaticus'),
    new EtymologicalConnection(generateId(), 'w6', 'w56', 'derivative', 0.95, 'acuario from Latin aquarium'),
    new EtymologicalConnection(generateId(), 'w6', 'w57', 'derivative', 0.95, 'acueducto from Latin aquaeductus'),

    // Spanish water semantic connections
    new EtymologicalConnection(generateId(), 'w2', 'w58', 'semantic', 0.85, 'cascada involves falling water'),
    new EtymologicalConnection(generateId(), 'w2', 'w59', 'semantic', 0.90, 'aguacero is heavy water from sky'),

    // SAME-LANGUAGE ETYMOLOGICAL CONNECTIONS
    // English water family - etymological relationships
    new EtymologicalConnection(generateId(), 'w1', 'w53', 'derivative', 0.95, 'waterfall derived from water + fall'),
    new EtymologicalConnection(generateId(), 'w1', 'w54', 'derivative', 0.95, 'watershed derived from water + shed'),
    new EtymologicalConnection(generateId(), 'w50', 'w51', 'cognate', 0.90, 'aquatic and aquarium both from Latin aqua root'),
    new EtymologicalConnection(generateId(), 'w50', 'w52', 'cognate', 0.90, 'aquatic and aqueduct both from Latin aqua root'),

    // Spanish water family - etymological relationships
    new EtymologicalConnection(generateId(), 'w2', 'w59', 'derivative', 0.85, 'aguacero derived from agua + -cero suffix'),
    new EtymologicalConnection(generateId(), 'w55', 'w56', 'cognate', 0.90, 'acuático and acuario both from Latin aqua root'),
    new EtymologicalConnection(generateId(), 'w55', 'w57', 'cognate', 0.90, 'acuático and acueducto both from Latin aqua root'),

    // FAMILY RELATIONSHIPS CONNECTIONS
    // Romance languages from Latin (mother)
    new EtymologicalConnection(generateId(), 'w12', 'w8', 'derivative', 0.95, 'Spanish madre from Latin mater'),
    new EtymologicalConnection(generateId(), 'w12', 'w9', 'derivative', 0.90, 'French mère from Latin mater'),
    new EtymologicalConnection(generateId(), 'w12', 'w11', 'derivative', 0.95, 'Italian madre from Latin mater'),

    // Germanic cognates (mother)
    new EtymologicalConnection(generateId(), 'w7', 'w10', 'cognate', 0.85, 'English mother and German Mutter from Proto-Germanic *mōdēr'),

    // Romance languages from Latin (brother)
    new EtymologicalConnection(generateId(), 'w18', 'w14', 'derivative', 0.95, 'Spanish hermano from Latin frater'),
    new EtymologicalConnection(generateId(), 'w18', 'w15', 'derivative', 0.90, 'French frère from Latin frater'),
    new EtymologicalConnection(generateId(), 'w18', 'w17', 'derivative', 0.95, 'Italian fratello from Latin frater'),

    // Germanic cognates (brother)
    new EtymologicalConnection(generateId(), 'w13', 'w16', 'cognate', 0.85, 'English brother and German Bruder from Proto-Germanic *brōþēr'),

    // Family semantic connections - English
    new EtymologicalConnection(generateId(), 'w7', 'w62', 'semantic', 0.95, 'mother is a parent'),
    new EtymologicalConnection(generateId(), 'w60', 'w62', 'semantic', 0.95, 'father is a parent'),
    new EtymologicalConnection(generateId(), 'w13', 'w61', 'semantic', 0.90, 'brother and sister are siblings'),
    new EtymologicalConnection(generateId(), 'w7', 'w63', 'semantic', 0.90, 'mother is part of family'),
    new EtymologicalConnection(generateId(), 'w12', 'w64', 'derivative', 0.95, 'maternal from Latin mater'),
    new EtymologicalConnection(generateId(), 'w18', 'w66', 'derivative', 0.95, 'fraternal from Latin frater'),

    // Family semantic connections - Spanish
    new EtymologicalConnection(generateId(), 'w8', 'w69', 'semantic', 0.90, 'madre is part of familia'),
    new EtymologicalConnection(generateId(), 'w67', 'w69', 'semantic', 0.90, 'padre is part of familia'),
    new EtymologicalConnection(generateId(), 'w14', 'w68', 'semantic', 0.90, 'hermano and hermana are siblings'),
    new EtymologicalConnection(generateId(), 'w12', 'w70', 'derivative', 0.95, 'materno from Latin mater'),
    new EtymologicalConnection(generateId(), 'w18', 'w72', 'derivative', 0.95, 'fraterno from Latin frater'),

    // HOUSE/HOME CONNECTIONS
    // House semantic connections - English/Spanish
    new EtymologicalConnection(generateId(), 'w80', 'w82', 'semantic', 0.85, 'house and home both relate to dwelling'),
    new EtymologicalConnection(generateId(), 'w81', 'w83', 'semantic', 0.85, 'casa and hogar both relate to dwelling'),

    // English house-related connections
    new EtymologicalConnection(generateId(), 'w80', 'w84', 'derivative', 0.95, 'housing from house'),
    new EtymologicalConnection(generateId(), 'w80', 'w85', 'semantic', 0.90, 'household relates to house'),
    new EtymologicalConnection(generateId(), 'w82', 'w86', 'semantic', 0.85, 'domestic relates to home'),
    new EtymologicalConnection(generateId(), 'w87', 'w90', 'cognate', 0.95, 'domicile and domicilio from Latin domus'),

    // Spanish house-related connections
    new EtymologicalConnection(generateId(), 'w81', 'w88', 'derivative', 0.95, 'casero from casa'),
    new EtymologicalConnection(generateId(), 'w83', 'w89', 'semantic', 0.85, 'doméstico relates to hogar'),

    // FOOD/EAT CONNECTIONS
    // Semantic food connections
    new EtymologicalConnection(generateId(), 'w100', 'w102', 'semantic', 0.95, 'eat relates to food'),
    new EtymologicalConnection(generateId(), 'w101', 'w103', 'semantic', 0.95, 'comer relates to comida'),

    // English food-related connections
    new EtymologicalConnection(generateId(), 'w100', 'w104', 'derivative', 0.90, 'edible relates to ability to eat'),
    new EtymologicalConnection(generateId(), 'w102', 'w105', 'semantic', 0.85, 'restaurant serves food'),
    new EtymologicalConnection(generateId(), 'w102', 'w106', 'semantic', 0.85, 'kitchen is for preparing food'),
    new EtymologicalConnection(generateId(), 'w100', 'w107', 'semantic', 0.90, 'meal is eating occasion'),
    new EtymologicalConnection(generateId(), 'w100', 'w108', 'derivative', 0.85, 'dining is act of eating'),

    // Spanish food-related connections
    new EtymologicalConnection(generateId(), 'w101', 'w109', 'derivative', 0.90, 'comestible relates to ability to comer'),
    new EtymologicalConnection(generateId(), 'w103', 'w110', 'semantic', 0.85, 'restaurante serves comida'),
    new EtymologicalConnection(generateId(), 'w103', 'w111', 'semantic', 0.85, 'cocina is for preparing comida'),
    new EtymologicalConnection(generateId(), 'w101', 'w112', 'semantic', 0.90, 'comedor is place for comer'),

    // Cross-language food connections
    new EtymologicalConnection(generateId(), 'w105', 'w110', 'borrowing', 0.90, 'restaurant and restaurante from French'),

    // NATURE ELEMENTS CONNECTIONS
    // Romance languages from Latin (fire)
    new EtymologicalConnection(generateId(), 'w24', 'w20', 'derivative', 0.90, 'Spanish fuego from Latin focus, influenced by ignis'),
    new EtymologicalConnection(generateId(), 'w24', 'w21', 'derivative', 0.85, 'French feu from Latin focus'),
    new EtymologicalConnection(generateId(), 'w24', 'w23', 'derivative', 0.90, 'Italian fuoco from Latin focus'),

    // Germanic cognates (fire)
    new EtymologicalConnection(generateId(), 'w19', 'w22', 'cognate', 0.85, 'English fire and German Feuer from Proto-Germanic *fōr'),

    // Nature semantic connections
    new EtymologicalConnection(generateId(), 'w120', 'w121', 'cognate', 0.80, 'earth and tierra both mean ground/planet'),
    new EtymologicalConnection(generateId(), 'w122', 'w123', 'cognate', 0.75, 'sky and cielo both mean heaven/atmosphere'),
    new EtymologicalConnection(generateId(), 'w124', 'w125', 'cognate', 0.85, 'sun and sol from same Indo-European root'),
    new EtymologicalConnection(generateId(), 'w126', 'w127', 'cognate', 0.85, 'moon and luna from different roots but same concept'),

    // VERB CONNECTIONS
    // Verb semantic connections
    new EtymologicalConnection(generateId(), 'w140', 'w141', 'cognate', 0.80, 'love and amar from different roots, same concept'),
    new EtymologicalConnection(generateId(), 'w142', 'w143', 'semantic', 0.75, 'work and trabajar same concept, different roots'),
    new EtymologicalConnection(generateId(), 'w144', 'w145', 'semantic', 0.75, 'speak and hablar same concept, different roots'),
    new EtymologicalConnection(generateId(), 'w146', 'w147', 'semantic', 0.75, 'think and pensar same concept, different roots'),

    // Work-related connections - English
    new EtymologicalConnection(generateId(), 'w142', 'w148', 'derivative', 0.95, 'worker from work'),
    new EtymologicalConnection(generateId(), 'w142', 'w149', 'semantic', 0.90, 'workplace relates to work'),
    new EtymologicalConnection(generateId(), 'w142', 'w150', 'semantic', 0.85, 'job is a type of work'),

    // Work-related connections - Spanish
    new EtymologicalConnection(generateId(), 'w143', 'w151', 'derivative', 0.95, 'trabajador from trabajar'),
    new EtymologicalConnection(generateId(), 'w143', 'w152', 'derivative', 0.95, 'trabajo from trabajar'),
    new EtymologicalConnection(generateId(), 'w152', 'w153', 'semantic', 0.85, 'empleo is a type of trabajo'),

    // PHRASE-TO-PHRASE CONNECTIONS (Cross-language)
    // Greeting phrases
    new EtymologicalConnection(generateId(), 'w160', 'w161', 'semantic', 0.95, 'good morning and buenos días are equivalent greetings'),
    new EtymologicalConnection(generateId(), 'w162', 'w163', 'semantic', 0.95, 'good night and buenas noches are equivalent farewells'),
    new EtymologicalConnection(generateId(), 'w164', 'w165', 'semantic', 0.90, 'thank you and gracias express same gratitude'),
    new EtymologicalConnection(generateId(), 'w166', 'w167', 'semantic', 0.90, 'please and por favor are polite request forms'),

    // Compound word connections - family
    new EtymologicalConnection(generateId(), 'w170', 'w174', 'semantic', 0.90, 'grandfather and abuelo refer to same family relation'),
    new EtymologicalConnection(generateId(), 'w171', 'w175', 'semantic', 0.90, 'grandmother and abuela refer to same family relation'),
    new EtymologicalConnection(generateId(), 'w60', 'w170', 'semantic', 0.85, 'father is part of grandfather concept'),
    new EtymologicalConnection(generateId(), 'w67', 'w174', 'semantic', 0.85, 'padre is part of abuelo concept'),
    new EtymologicalConnection(generateId(), 'w7', 'w171', 'semantic', 0.85, 'mother is part of grandmother concept'),
    new EtymologicalConnection(generateId(), 'w8', 'w175', 'semantic', 0.85, 'madre is part of abuela concept'),

    // House room connections
    new EtymologicalConnection(generateId(), 'w172', 'w176', 'semantic', 0.90, 'bedroom and dormitorio are same type of room'),
    new EtymologicalConnection(generateId(), 'w173', 'w177', 'semantic', 0.90, 'bathroom and baño are same type of room'),
    new EtymologicalConnection(generateId(), 'w80', 'w172', 'semantic', 0.85, 'bedroom is part of house'),
    new EtymologicalConnection(generateId(), 'w81', 'w176', 'semantic', 0.85, 'dormitorio is part of casa'),

    // COLOR CONNECTIONS (Cross-language semantic)
    new EtymologicalConnection(generateId(), 'w180', 'w181', 'semantic', 0.95, 'red and rojo refer to same color'),
    new EtymologicalConnection(generateId(), 'w182', 'w183', 'semantic', 0.95, 'blue and azul refer to same color'),
    new EtymologicalConnection(generateId(), 'w184', 'w185', 'semantic', 0.95, 'green and verde refer to same color'),

    // Color semantic connections to nature
    new EtymologicalConnection(generateId(), 'w180', 'w19', 'semantic', 0.80, 'red is color of fire'),
    new EtymologicalConnection(generateId(), 'w181', 'w20', 'semantic', 0.80, 'rojo is color of fuego'),
    new EtymologicalConnection(generateId(), 'w182', 'w122', 'semantic', 0.80, 'blue is color of sky'),
    new EtymologicalConnection(generateId(), 'w183', 'w123', 'semantic', 0.80, 'azul is color of cielo'),

    // BODY PARTS CONNECTIONS
    // Cross-language semantic connections
    new EtymologicalConnection(generateId(), 'w190', 'w191', 'semantic', 0.95, 'hand and mano refer to same body part'),
    new EtymologicalConnection(generateId(), 'w192', 'w193', 'semantic', 0.95, 'foot and pie refer to same body part'),
    new EtymologicalConnection(generateId(), 'w194', 'w195', 'semantic', 0.95, 'head and cabeza refer to same body part'),

    // Latin etymological connections for body parts
    new EtymologicalConnection(generateId(), 'w210', 'w191', 'derivative', 0.95, 'mano from Latin manus'),
    new EtymologicalConnection(generateId(), 'w210', 'w190', 'borrowing', 0.70, 'English manual, manuscript from Latin manus'),
    new EtymologicalConnection(generateId(), 'w211', 'w193', 'derivative', 0.85, 'pie from Latin pes/pedis'),
    new EtymologicalConnection(generateId(), 'w212', 'w195', 'derivative', 0.90, 'cabeza from Latin caput via evolution'),

    // NUMBER CONNECTIONS
    // Cross-language semantic connections
    new EtymologicalConnection(generateId(), 'w200', 'w201', 'semantic', 0.95, 'one and uno refer to same number'),
    new EtymologicalConnection(generateId(), 'w202', 'w203', 'semantic', 0.95, 'two and dos refer to same number'),
    new EtymologicalConnection(generateId(), 'w204', 'w205', 'semantic', 0.95, 'three and tres refer to same number'),

    // Latin etymological connections for numbers
    new EtymologicalConnection(generateId(), 'w213', 'w201', 'derivative', 0.95, 'uno from Latin unus'),
    new EtymologicalConnection(generateId(), 'w214', 'w203', 'derivative', 0.90, 'dos from Latin duo'),
    new EtymologicalConnection(generateId(), 'w215', 'w205', 'derivative', 0.95, 'tres from Latin tres'),

    // English number cognates and borrowings
    new EtymologicalConnection(generateId(), 'w213', 'w200', 'cognate', 0.80, 'one and unus from Proto-Indo-European *óynos'),
    new EtymologicalConnection(generateId(), 'w214', 'w202', 'cognate', 0.80, 'two and duo from Proto-Indo-European *dwóh₁'),
    new EtymologicalConnection(generateId(), 'w215', 'w204', 'cognate', 0.85, 'three and tres from Proto-Indo-European *tréyes'),

    // PHRASE COMPONENT CONNECTIONS
    // "Good morning" components
    new EtymologicalConnection(generateId(), 'w160', 'w161', 'calque', 0.85, 'good morning is calque of buenos días structure'),

    // CROSS-LINGUISTIC BORROWINGS
    new EtymologicalConnection(generateId(), 'w2', 'w6', 'derivative', 0.95, 'agua directly from aqua'),
    new EtymologicalConnection(generateId(), 'w8', 'w12', 'derivative', 0.95, 'madre directly from mater'),
    new EtymologicalConnection(generateId(), 'w86', 'w89', 'cognate', 0.95, 'domestic and doméstico from Latin domesticus'),
    new EtymologicalConnection(generateId(), 'w87', 'w90', 'cognate', 0.95, 'domicile and domicilio from Latin domicilium')
  ];

  // Add connections to graph
  connections.forEach(connection => graph.addConnection(connection));

  return graph;
}

module.exports = { createSampleData };