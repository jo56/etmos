const NodeCache = require('node-cache');

// Cache cognate lookups for 4 hours
const cache = new NodeCache({ stdTTL: 14400 });

class CognateService {
  constructor() {
    // Sound change patterns between language families
    this.soundChangeRules = {
      // Germanic to Romance sound changes
      'germanic_to_romance': [
        { from: /^h([aeiou])/, to: '$1', example: 'haus → casa' },
        { from: /k([aeiou])/, to: 'c$1', example: 'kin → cognate' },
        { from: /w([aeiou])/, to: 'v$1', example: 'water → aqua' },
        { from: /^f/, to: 'p', example: 'father → pater' },
        { from: /th/, to: 't', example: 'three → tres' }
      ],

      // Romance language variations
      'latin_variations': [
        { from: /ct/, to: 'tt', lang: 'it', example: 'factum → fatto' },
        { from: /ct/, to: 'ch', lang: 'es', example: 'factum → hecho' },
        { from: /ct/, to: 'it', lang: 'fr', example: 'factum → fait' },
        { from: /^p/, to: '', lang: 'fr', example: 'pater → père' },
        { from: /^f/, to: 'h', lang: 'es', example: 'farina → harina' }
      ],

      // Indo-European root connections
      'indo_european': [
        { from: /^p/, to: 'f', family: 'germanic', example: 'pater → father' },
        { from: /^d/, to: 't', family: 'germanic', example: 'decem → ten' },
        { from: /^g/, to: 'k', family: 'germanic', example: 'genus → kin' }
      ]
    };

    // Known cognate groups organized by semantic fields
    this.cognateGroups = {
      'family_relations': {
        'mother': {
          'en': ['mother'],
          'de': ['mutter'],
          'es': ['madre'],
          'fr': ['mère'],
          'it': ['madre'],
          'la': ['mater'],
          'ru': ['мать'],
          'gr': ['μητέρα']
        },
        'father': {
          'en': ['father'],
          'de': ['vater'],
          'es': ['padre'],
          'fr': ['père'],
          'it': ['padre'],
          'la': ['pater'],
          'ru': ['отец'],
          'gr': ['πατέρας']
        },
        'brother': {
          'en': ['brother'],
          'de': ['bruder'],
          'es': ['hermano'],
          'fr': ['frère'],
          'it': ['fratello'],
          'la': ['frater'],
          'ru': ['брат'],
          'gr': ['αδελφός']
        }
      },

      'numbers': {
        'one': {
          'en': ['one'],
          'de': ['ein', 'eins'],
          'es': ['uno'],
          'fr': ['un'],
          'it': ['uno'],
          'la': ['unus'],
          'ru': ['один'],
          'gr': ['ένα']
        },
        'two': {
          'en': ['two'],
          'de': ['zwei'],
          'es': ['dos'],
          'fr': ['deux'],
          'it': ['due'],
          'la': ['duo'],
          'ru': ['два'],
          'gr': ['δύο']
        },
        'three': {
          'en': ['three'],
          'de': ['drei'],
          'es': ['tres'],
          'fr': ['trois'],
          'it': ['tre'],
          'la': ['tres'],
          'ru': ['три'],
          'gr': ['τρία']
        }
      },

      'body_parts': {
        'heart': {
          'en': ['heart'],
          'de': ['herz'],
          'es': ['corazón'],
          'fr': ['cœur'],
          'it': ['cuore'],
          'la': ['cor'],
          'ru': ['сердце'],
          'gr': ['καρδιά']
        },
        'head': {
          'en': ['head'],
          'de': ['kopf', 'haupt'],
          'es': ['cabeza'],
          'fr': ['tête'],
          'it': ['testa'],
          'la': ['caput'],
          'ru': ['голова'],
          'gr': ['κεφάλι']
        }
      },

      'basic_concepts': {
        'water': {
          'en': ['water'],
          'de': ['wasser'],
          'es': ['agua'],
          'fr': ['eau'],
          'it': ['acqua'],
          'la': ['aqua'],
          'ru': ['вода'],
          'gr': ['νερό']
        },
        'fire': {
          'en': ['fire'],
          'de': ['feuer'],
          'es': ['fuego'],
          'fr': ['feu'],
          'it': ['fuoco'],
          'la': ['ignis'],
          'ru': ['огонь'],
          'gr': ['φωτιά']
        },
        'house': {
          'en': ['house'],
          'de': ['haus'],
          'es': ['casa'],
          'fr': ['maison'],
          'it': ['casa'],
          'la': ['domus'],
          'ru': ['дом'],
          'gr': ['σπίτι']
        }
      }
    };
  }

  async findCognates(word, sourceLanguage, targetLanguages = ['en', 'es', 'fr', 'de', 'it']) {
    const cacheKey = `cognates_${word}_${sourceLanguage}_${targetLanguages.join('_')}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const cognates = [];
    const normalizedWord = word.toLowerCase().trim();

    // Look for direct cognates in our database
    const directCognates = this.findDirectCognates(normalizedWord, sourceLanguage, targetLanguages);
    cognates.push(...directCognates);

    // Apply sound change rules to find potential cognates
    const soundChangeCognates = this.applySoundChangeRules(normalizedWord, sourceLanguage, targetLanguages);
    cognates.push(...soundChangeCognates);

    // Deduplicate and sort by confidence
    const uniqueCognates = this.deduplicateCognates(cognates);
    const sortedCognates = uniqueCognates.sort((a, b) => b.confidence - a.confidence);

    cache.set(cacheKey, sortedCognates);
    return sortedCognates;
  }

  findDirectCognates(word, sourceLanguage, targetLanguages) {
    const cognates = [];

    // Search through all semantic fields
    for (const [fieldName, concepts] of Object.entries(this.cognateGroups)) {
      for (const [conceptName, languageMap] of Object.entries(concepts)) {

        // Check if the word exists in the source language for this concept
        const sourceWords = languageMap[sourceLanguage] || [];
        const wordMatches = sourceWords.some(w => w.toLowerCase() === word.toLowerCase());

        if (wordMatches) {
          // Find cognates in target languages
          for (const targetLang of targetLanguages) {
            if (targetLang !== sourceLanguage && languageMap[targetLang]) {
              for (const cognateWord of languageMap[targetLang]) {
                // Filter out derivatives before adding cognates
                if (!this.isDerivative(word, cognateWord, sourceLanguage, targetLang)) {
                  cognates.push({
                    word: cognateWord,
                    language: targetLang,
                    confidence: 0.95,
                    relationship: 'cognate',
                    semanticField: fieldName,
                    concept: conceptName,
                    notes: `Direct cognate through ${conceptName} concept`
                  });
                }
              }
            }
          }
        }
      }
    }

    return cognates;
  }

  applySoundChangeRules(word, sourceLanguage, targetLanguages) {
    const cognates = [];
    const languageFamilies = this.getLanguageFamily(sourceLanguage);

    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLanguage) continue;

      const targetFamilies = this.getLanguageFamily(targetLang);

      // Apply appropriate sound change rules
      for (const family of languageFamilies) {
        for (const targetFamily of targetFamilies) {
          const ruleKey = `${family}_to_${targetFamily}`;
          const rules = this.soundChangeRules[ruleKey] || this.soundChangeRules[family] || [];

          for (const rule of rules) {
            if (rule.lang && rule.lang !== targetLang) continue;

            if (word.match(rule.from)) {
              const transformedWord = word.replace(rule.from, rule.to);
              if (transformedWord !== word && transformedWord.length > 1) {
                cognates.push({
                  word: transformedWord,
                  language: targetLang,
                  confidence: 0.75,
                  relationship: 'cognate',
                  soundChange: rule.example,
                  notes: `Potential cognate via sound change: ${rule.example}`
                });
              }
            }
          }
        }
      }
    }

    return cognates;
  }

  getLanguageFamily(languageCode) {
    const families = {
      'en': ['germanic', 'indo_european'],
      'de': ['germanic', 'indo_european'],
      'nl': ['germanic', 'indo_european'],
      'da': ['germanic', 'indo_european'],
      'sv': ['germanic', 'indo_european'],
      'no': ['germanic', 'indo_european'],

      'es': ['romance', 'indo_european'],
      'fr': ['romance', 'indo_european'],
      'it': ['romance', 'indo_european'],
      'pt': ['romance', 'indo_european'],
      'ro': ['romance', 'indo_european'],
      'ca': ['romance', 'indo_european'],

      'la': ['latin', 'indo_european'],
      'gr': ['hellenic', 'indo_european'],
      'ru': ['slavic', 'indo_european'],
      'pl': ['slavic', 'indo_european'],
      'cs': ['slavic', 'indo_european'],

      'ar': ['semitic'],
      'he': ['semitic'],
      'hi': ['indo_aryan', 'indo_european'],
      'sa': ['indo_aryan', 'indo_european']
    };

    return families[languageCode] || ['unknown'];
  }

  deduplicateCognates(cognates) {
    const seen = new Map();
    const unique = [];

    for (const cognate of cognates) {
      const key = `${cognate.word.toLowerCase()}_${cognate.language}`;

      if (!seen.has(key)) {
        seen.set(key, cognate);
        unique.push(cognate);
      } else {
        // Keep the one with higher confidence
        const existing = seen.get(key);
        if (cognate.confidence > existing.confidence) {
          const index = unique.indexOf(existing);
          if (index >= 0) {
            unique[index] = cognate;
            seen.set(key, cognate);
          }
        }
      }
    }

    return unique;
  }

  // Get language name for display
  getLanguageName(code) {
    const names = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'nl': 'Dutch',
      'la': 'Latin',
      'gr': 'Greek',
      'ru': 'Russian',
      'pl': 'Polish',
      'cs': 'Czech',
      'ar': 'Arabic',
      'he': 'Hebrew',
      'hi': 'Hindi',
      'sa': 'Sanskrit'
    };

    return names[code] || code.toUpperCase();
  }

  // Check if one word is a derivative of another (same logic as EtymologyService)
  isDerivative(sourceText, targetText, sourceLang, targetLang) {
    const source = sourceText.toLowerCase().trim();
    const target = targetText.toLowerCase().trim();

    // Skip if words are identical
    if (source === target) {
      return true;
    }

    // For cross-language connections, check if one is clearly a derivative of the other
    if (sourceLang !== targetLang) {
      return this.isCrossLanguageDerivative(source, target, sourceLang, targetLang);
    }

    // All derivational suffixes that should be filtered as derivatives
    const derivationalSuffixes = [
      'ing', 'ed', 's', 'es', 'ies', 'er', 'est', 'ly', 'ie', 'y',
      'ness', 'ment', 'tion', 'sion', 'ful', 'less', 'able', 'ible',
      'ist', 'ian', 'ism', 'ity', 'hood', 'ship', 'ward', 'wise', 'like',
      'ify', 'ize', 'ise', 'ate', 'age', 'dom', 'ory', 'ous', 'ive', 'ant', 'ent',
      'al', 'ic', 'ous', 'eous', 'ious', 'ary', 'ery', 'ory', 'ure', 'ade'
    ];

    // Derivational prefixes that should be filtered
    const derivationalPrefixes = [
      're', 'un', 'pre', 'dis', 'mis', 'over', 'under', 'out', 'up', 'in', 'im', 'il', 'ir',
      'non', 'anti', 'de', 'ex', 'sub', 'super', 'inter', 'trans', 'semi', 'multi', 'co'
    ];

    // Check if target is source + any derivational suffix
    for (const suffix of derivationalSuffixes) {
      if (target === source + suffix) {
        return true;
      }
      // Handle spelling changes
      if (suffix === 'ies' && source.endsWith('y') && target === source.slice(0, -1) + 'ies') {
        return true;
      }
      if (suffix === 'ed' && source.endsWith('e') && target === source + 'd') {
        return true;
      }
      if (suffix === 'ing' && source.endsWith('e') && target === source.slice(0, -1) + 'ing') {
        return true;
      }
    }

    // Check if source is target + any derivational suffix (reverse)
    for (const suffix of derivationalSuffixes) {
      if (source === target + suffix) {
        return true;
      }
      if (suffix === 'ies' && target.endsWith('y') && source === target.slice(0, -1) + 'ies') {
        return true;
      }
      if (suffix === 'ed' && target.endsWith('e') && source === target + 'd') {
        return true;
      }
      if (suffix === 'ing' && target.endsWith('e') && source === target.slice(0, -1) + 'ing') {
        return true;
      }
    }

    // Check derivational prefixes
    for (const prefix of derivationalPrefixes) {
      if (target === prefix + source || source === prefix + target) {
        return true;
      }
    }

    return false;
  }

  // Check if words are cross-language derivatives (e.g., English "nation" vs Spanish "nación")
  isCrossLanguageDerivative(source, target, sourceLang, targetLang) {
    // Romance language patterns - similar roots with language-specific endings
    const romanceLanguages = ['es', 'fr', 'it', 'pt', 'ca', 'ro'];
    const isSourceRomance = romanceLanguages.includes(sourceLang);
    const isTargetRomance = romanceLanguages.includes(targetLang);

    if (isSourceRomance && isTargetRomance) {
      // Remove common Romance endings to find root
      const sourceRoot = this.getRomanceRoot(source);
      const targetRoot = this.getRomanceRoot(target);

      if (sourceRoot === targetRoot && sourceRoot.length >= 3) {
        return true;
      }
    }

    // English/Germanic to Romance patterns
    if ((sourceLang === 'en' || sourceLang === 'de') && isTargetRomance) {
      // Common Latin-derived patterns
      const patterns = [
        { en: /tion$/, romance: /ción$|tion$|zione$/ },
        { en: /sion$/, romance: /sión$|sion$|sione$/ },
        { en: /ity$/, romance: /idad$|ité$|ità$/ },
        { en: /ous$/, romance: /oso$|eux$|oso$/ },
        { en: /ic$/, romance: /ico$|ique$|ico$/ },
        { en: /al$/, romance: /al$|al$|ale$/ }
      ];

      for (const pattern of patterns) {
        if (source.match(pattern.en) && target.match(pattern.romance)) {
          const sourceBase = source.replace(pattern.en, '');
          const targetBase = target.replace(pattern.romance, '');
          if (this.areRootsRelated(sourceBase, targetBase)) {
            return true;
          }
        }
      }
    }

    // Germanic language patterns
    const germanicLanguages = ['en', 'de', 'nl', 'da', 'sv', 'no'];
    const isSourceGermanic = germanicLanguages.includes(sourceLang);
    const isTargetGermanic = germanicLanguages.includes(targetLang);

    if (isSourceGermanic && isTargetGermanic) {
      // Remove Germanic endings
      const sourceRoot = this.getGermanicRoot(source);
      const targetRoot = this.getGermanicRoot(target);

      if (sourceRoot === targetRoot && sourceRoot.length >= 3) {
        return true;
      }
    }

    return false;
  }

  getRomanceRoot(word) {
    // Remove common Romance language endings
    const endings = [
      'ción', 'sión', 'tion', 'sion', 'zione', 'sione', 'ção', 'são',
      'idad', 'ité', 'ità', 'idade', 'tate', 'dad',
      'oso', 'osa', 'eux', 'euse', 'oso', 'osa',
      'ico', 'ica', 'ique', 'ico', 'ica',
      'al', 'ale', 'ar', 'er', 'ir', 'are', 'ere', 'ire'
    ];

    for (const ending of endings) {
      if (word.endsWith(ending) && word.length > ending.length + 2) {
        return word.slice(0, -ending.length);
      }
    }
    return word;
  }

  getGermanicRoot(word) {
    // Remove common Germanic endings
    const endings = [
      'ing', 'ed', 'er', 'est', 'ly', 'ness', 'ment',
      'en', 'an', 'ung', 'heit', 'keit', 'lich', 'isch'
    ];

    for (const ending of endings) {
      if (word.endsWith(ending) && word.length > ending.length + 2) {
        return word.slice(0, -ending.length);
      }
    }
    return word;
  }

  areRootsRelated(root1, root2) {
    // Simple similarity check for roots
    if (root1 === root2) return true;
    if (Math.abs(root1.length - root2.length) > 2) return false;

    // Check for similar roots with minor spelling differences
    const maxDiff = Math.floor(Math.min(root1.length, root2.length) / 3);
    let differences = 0;

    for (let i = 0; i < Math.min(root1.length, root2.length); i++) {
      if (root1[i] !== root2[i]) {
        differences++;
        if (differences > maxDiff) return false;
      }
    }

    return differences <= maxDiff;
  }
}

module.exports = new CognateService();