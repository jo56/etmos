/**
 * Shared language constants for ETMOS
 * Centralizes language codes, colors, and names used across client and server
 */

/**
 * Language color mappings for visualization
 * Returns hex color codes for each language code
 */
export const LANGUAGE_COLORS: Record<string, string> = {
  // Germanic Languages
  'en': '#2196F3',    // English - Blue
  'de': '#4CAF50',    // German - Green
  'nl': '#FFC107',    // Dutch - Amber
  'da': '#00BCD4',    // Danish - Cyan
  'sv': '#009688',    // Swedish - Teal
  'no': '#3F51B5',    // Norwegian - Indigo
  'is': '#673AB7',    // Icelandic - Deep Purple
  'got': '#9C27B0',   // Gothic - Purple

  // Romance Languages
  'es': '#FF5722',    // Spanish - Red-Orange
  'fr': '#9C27B0',    // French - Purple
  'it': '#FF9800',    // Italian - Orange
  'pt': '#E91E63',    // Portuguese - Pink
  'ro': '#8BC34A',    // Romanian - Light Green
  'ca': '#CDDC39',    // Catalan - Lime
  'la': '#795548',    // Latin - Brown

  // Slavic Languages
  'ru': '#F44336',    // Russian - Red
  'pl': '#E91E63',    // Polish - Pink
  'cs': '#9C27B0',    // Czech - Purple
  'sk': '#673AB7',    // Slovak - Deep Purple
  'bg': '#3F51B5',    // Bulgarian - Indigo
  'hr': '#2196F3',    // Croatian - Blue
  'sr': '#00BCD4',    // Serbian - Cyan
  'uk': '#009688',    // Ukrainian - Teal

  // Celtic Languages
  'ga': '#4CAF50',    // Irish - Green
  'gd': '#8BC34A',    // Scottish Gaelic - Light Green
  'cy': '#CDDC39',    // Welsh - Lime
  'br': '#FFEB3B',    // Breton - Yellow
  'kw': '#FFC107',    // Cornish - Amber

  // Greek
  'gr': '#607D8B',    // Modern Greek - Blue-Grey
  'grc': '#455A64',   // Ancient Greek - Dark Blue-Grey

  // Other Indo-European
  'hi': '#FF5722',    // Hindi - Red-Orange
  'bn': '#E91E63',    // Bengali - Pink
  'fa': '#9C27B0',    // Persian - Purple
  'ku': '#673AB7',    // Kurdish - Deep Purple
  'hy': '#3F51B5',    // Armenian - Indigo
  'sq': '#2196F3',    // Albanian - Blue
  'lt': '#00BCD4',    // Lithuanian - Cyan
  'lv': '#009688',    // Latvian - Teal

  // Finno-Ugric
  'fi': '#4CAF50',    // Finnish - Green
  'et': '#8BC34A',    // Estonian - Light Green
  'hu': '#CDDC39',    // Hungarian - Lime

  // Semitic
  'ar': '#FF5722',    // Arabic - Red-Orange
  'he': '#E91E63',    // Hebrew - Pink
  'am': '#9C27B0',    // Amharic - Purple

  // Sino-Tibetan
  'zh': '#F44336',    // Chinese - Red
  'bo': '#E91E63',    // Tibetan - Pink
  'my': '#9C27B0',    // Burmese - Purple

  // Japanese & Korean
  'ja': '#FF5722',    // Japanese - Red-Orange
  'ko': '#E91E63',    // Korean - Pink

  // Turkic
  'tr': '#9C27B0',    // Turkish - Purple
  'az': '#673AB7',    // Azerbaijani - Deep Purple
  'kk': '#3F51B5',    // Kazakh - Indigo
  'ky': '#2196F3',    // Kyrgyz - Blue
  'uz': '#00BCD4',    // Uzbek - Cyan

  // Caucasian
  'ka': '#795548',    // Georgian - Brown

  // African
  'sw': '#FF5722',    // Swahili - Red-Orange

  // Native American
  'oj': '#9C27B0',    // Ojibwe - Purple

  // Historical/Reconstructed
  'pie': '#424242',   // Proto-Indo-European - Dark Grey
  'ine-pro': '#424242', // Proto-Indo-European - Dark Grey
  'pgm': '#616161',   // Proto-Germanic - Grey
  'gem-pro': '#616161', // Proto-Germanic - Grey
  'gmw-pro': '#757575', // Proto-West-Germanic - Light Grey
  'itc': '#757575',   // Proto-Italic - Light Grey
  'cel': '#9E9E9E',   // Proto-Celtic - Very Light Grey

  // Historical Germanic
  'goh': '#6B7B4F',   // Old High German - Olive
  'gmh': '#7A8A5F',   // Middle High German - Light Olive
  'gml': '#89996F',   // Middle Low German - Pale Olive
  'odt': '#98A87F',   // Old Dutch - Moss Green
  'dum': '#A7B78F',   // Middle Dutch - Light Moss
  'ofs': '#B6C69F',   // Old Frisian - Pale Moss
  'ang': '#C5D5AF',   // Old English - Very Pale Moss
  'enm': '#D4E4BF',   // Middle English - Almost White Green
  'non': '#8A6B9C',   // Old Norse - Purple-Grey

  // Historical Romance
  'la-cla': '#8B4513', // Classical Latin
  'la-vul': '#A0522D', // Vulgar Latin - Sienna
  'la-ecc': '#CD853F', // Ecclesiastical Latin - Peru
  'la-med': '#DEB887', // Medieval Latin - Burlywood
  'ml': '#DEB887',    // Medieval Latin
  'ML': '#DEB887',    // Medieval Latin
  'ml.': '#DEB887',   // Medieval Latin
  'ML.': '#DEB887',   // Medieval Latin
  'fro': '#BC8F8F',   // Old French - Rosy Brown
  'frm': '#CD919E',   // Middle French - Light Coral
  'pro': '#DA70D6',   // Old Occitan - Orchid
  'osp': '#FA8072',   // Old Spanish - Salmon
  'roa-opt': '#FFA07A', // Old Portuguese - Light Salmon
  'sla': '#B22222',   // Slavic - Fire Brick

  // Historical Slavic
  'cu': '#B22222',    // Church Slavonic - Fire Brick
  'orv': '#CD5C5C',   // Old East Slavic - Indian Red
  'zlw-ocs': '#DC143C', // Old Czech - Crimson
  'zlw-opl': '#FF6347', // Old Polish - Tomato
  'sla-pro': '#8B0000', // Proto-Slavic - Dark Red

  // Historical Celtic
  'mga': '#228B22',   // Middle Irish - Forest Green
  'sga': '#32CD32',   // Old Irish - Lime Green
  'owl': '#9ACD32',   // Old Welsh - Yellow Green
  'cnx': '#ADFF2F',   // Middle Cornish - Green Yellow
  'cel-bry-pro': '#7FFF00', // Proto-Brythonic - Chartreuse
  'cel-gau': '#98FB98', // Gaulish - Pale Green

  // Historical Greek
  'gmy': '#6495ED',   // Mycenaean Greek - Cornflower Blue
  'grk-pro': '#778899', // Proto-Greek - Light Slate Grey

  // Sanskrit and Indo-Iranian
  'sa': '#FF8C00',    // Sanskrit - Dark Orange
  'pal': '#FFA500',   // Middle Persian - Orange
  'ae': '#FFB347',    // Avestan - Peach
  'peo': '#FFCCCB',   // Old Persian - Light Pink
  'iir-pro': '#FF7F50', // Proto-Indo-Iranian - Coral
  'inc-pro': '#FF6347', // Proto-Indo-Aryan - Tomato
  'ira-pro': '#FF4500', // Proto-Iranian - Orange Red

  // Other Proto-Languages
  'ine-bsl-pro': '#4B0082', // Proto-Balto-Slavic - Indigo
  'bat-pro': '#483D8B', // Proto-Baltic - Dark Slate Blue
  'urj-pro': '#6A5ACD', // Proto-Uralic - Slate Blue
  'fiu-fin-pro': '#7B68EE', // Proto-Finnic - Medium Slate Blue
  'sem-pro': '#9370DB', // Proto-Semitic - Medium Purple
  'ccs-pro': '#8B008B', // Proto-Kartvelian - Dark Magenta

  'unknown': '#9E9E9E', // Unknown - Grey
  'und': '#9E9E9E',     // Undetermined - Grey
  'proto': '#424242'    // Generic proto language - Dark Grey
};

/**
 * Language name mappings
 * Returns human-readable names for language codes
 */
export const LANGUAGE_NAMES: Record<string, string> = {
  // Germanic Languages
  'en': 'English',
  'de': 'German',
  'nl': 'Dutch',
  'da': 'Danish',
  'sv': 'Swedish',
  'no': 'Norwegian',
  'is': 'Icelandic',
  'got': 'Gothic',

  // Romance Languages
  'es': 'Spanish',
  'fr': 'French',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ro': 'Romanian',
  'ca': 'Catalan',
  'la': 'Latin',

  // Slavic Languages
  'ru': 'Russian',
  'pl': 'Polish',
  'cs': 'Czech',
  'sk': 'Slovak',
  'bg': 'Bulgarian',
  'hr': 'Croatian',
  'sr': 'Serbian',
  'uk': 'Ukrainian',

  // Celtic Languages
  'ga': 'Irish',
  'gd': 'Scottish Gaelic',
  'cy': 'Welsh',
  'br': 'Breton',
  'kw': 'Cornish',

  // Greek
  'gr': 'Greek',
  'grc': 'Ancient Greek',

  // Other Indo-European
  'hi': 'Hindi',
  'bn': 'Bengali',
  'fa': 'Persian',
  'ku': 'Kurdish',
  'hy': 'Armenian',
  'sq': 'Albanian',
  'lt': 'Lithuanian',
  'lv': 'Latvian',

  // Finno-Ugric
  'fi': 'Finnish',
  'et': 'Estonian',
  'hu': 'Hungarian',

  // Semitic
  'ar': 'Arabic',
  'he': 'Hebrew',
  'am': 'Amharic',

  // Sino-Tibetan
  'zh': 'Chinese',
  'bo': 'Tibetan',
  'my': 'Burmese',

  // Japanese & Korean
  'ja': 'Japanese',
  'ko': 'Korean',

  // Turkic
  'tr': 'Turkish',
  'az': 'Azerbaijani',
  'kk': 'Kazakh',
  'ky': 'Kyrgyz',
  'uz': 'Uzbek',

  // Caucasian
  'ka': 'Georgian',

  // African
  'sw': 'Swahili',

  // Native American
  'oj': 'Ojibwe',

  // Historical/Reconstructed
  'pie': 'Proto-Indo-European',
  'ine-pro': 'Proto-Indo-European',
  'pgm': 'Proto-Germanic',
  'gem-pro': 'Proto-Germanic',
  'gmw-pro': 'Proto-West-Germanic',
  'itc': 'Proto-Italic',
  'cel': 'Proto-Celtic',

  // Historical Germanic
  'goh': 'Old High German',
  'gmh': 'Middle High German',
  'gml': 'Middle Low German',
  'odt': 'Old Dutch',
  'dum': 'Middle Dutch',
  'ofs': 'Old Frisian',
  'ang': 'Old English',
  'enm': 'Middle English',
  'non': 'Old Norse',

  // Historical Romance
  'la-cla': 'Classical Latin',
  'la-vul': 'Vulgar Latin',
  'la-ecc': 'Ecclesiastical Latin',
  'la-med': 'Medieval Latin',
  'ml': 'Medieval Latin',
  'ML': 'Medieval Latin',
  'ml.': 'Medieval Latin',
  'ML.': 'Medieval Latin',
  'fro': 'Old French',
  'frm': 'Middle French',
  'pro': 'Old Occitan',
  'osp': 'Old Spanish',
  'roa-opt': 'Old Portuguese',
  'sla': 'Slavic',

  // Historical Slavic
  'cu': 'Church Slavonic',
  'orv': 'Old East Slavic',
  'zlw-ocs': 'Old Czech',
  'zlw-opl': 'Old Polish',
  'sla-pro': 'Proto-Slavic',

  // Historical Celtic
  'mga': 'Middle Irish',
  'sga': 'Old Irish',
  'owl': 'Old Welsh',
  'cnx': 'Middle Cornish',
  'cel-bry-pro': 'Proto-Brythonic',
  'cel-gau': 'Gaulish',

  // Historical Greek
  'gmy': 'Mycenaean Greek',
  'grk-pro': 'Proto-Greek',

  // Sanskrit and Indo-Iranian
  'sa': 'Sanskrit',
  'pal': 'Middle Persian',
  'ae': 'Avestan',
  'peo': 'Old Persian',
  'iir-pro': 'Proto-Indo-Iranian',
  'inc-pro': 'Proto-Indo-Aryan',
  'ira-pro': 'Proto-Iranian',

  // Other Proto-Languages
  'ine-bsl-pro': 'Proto-Balto-Slavic',
  'bat-pro': 'Proto-Baltic',
  'urj-pro': 'Proto-Uralic',
  'fiu-fin-pro': 'Proto-Finnic',
  'sem-pro': 'Proto-Semitic',
  'ccs-pro': 'Proto-Kartvelian',

  'unknown': 'Unknown',
  'und': 'Unknown',
  'proto': 'Proto Language'
};

/**
 * Language name to code normalization mappings
 * Used for converting natural language inputs to standard codes
 */
export const LANGUAGE_NAME_TO_CODE: ReadonlyArray<[string, string]> = [
  ['latin', 'la'],
  ['greek', 'gr'],
  ['proto-indo-european', 'ine-pro'],
  ['proto-germanic', 'gem-pro'],
  ['old english', 'en'],
  ['middle english', 'en'],
  ['anglo-norman', 'fr'],
  ['old french', 'fr'],
  ['middle french', 'fr'],
  ['vulgar latin', 'la'],
  ['classical latin', 'la'],
  ['sanskrit', 'sa'],
  ['old norse', 'non'],
  ['old high german', 'de'],
  ['middle high german', 'de'],
  ['german', 'de'],
  ['dutch', 'nl'],
  ['spanish', 'es'],
  ['italian', 'it'],
  ['portuguese', 'pt'],
  ['english', 'en'],
  ['french', 'fr'],
  ['celtic', 'cel'],
  ['arabic', 'ar']
];

/**
 * Helper function to get language color with fallback
 */
export function getLanguageColor(languageCode: string): string {
  return LANGUAGE_COLORS[languageCode] || LANGUAGE_COLORS['unknown'];
}

/**
 * Helper function to get language name with fallback
 */
export function getLanguageName(languageCode: string): string {
  return LANGUAGE_NAMES[languageCode] || languageCode.toUpperCase();
}

/**
 * Helper function to normalize language name to code
 */
export function normalizeLanguageCode(languageInput: string): string {
  const normalized = (languageInput || '').toLowerCase().trim();

  for (const [prefix, code] of LANGUAGE_NAME_TO_CODE) {
    if (normalized.startsWith(prefix)) {
      return code;
    }
  }

  if (normalized.includes('proto')) {
    return 'proto';
  }

  return 'und';
}
