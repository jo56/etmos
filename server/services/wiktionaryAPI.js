const NodeCache = require('node-cache');

// Cache for 2 hours to avoid repeated API calls
const cache = new NodeCache({ stdTTL: 7200 });

class WiktionaryAPI {
  constructor() {
    this.baseURL = 'https://en.wiktionary.org/w/api.php';
  }

  async fetchWiktionaryData(word, language = 'en') {
    // TEMPORARILY DISABLE CACHE FOR DEVELOPMENT
    // const cacheKey = `wiktionary_${word}_${language}`;
    // let cached = cache.get(cacheKey);
    // if (cached) {
    //   return cached;
    // }

    try {
      const params = new URLSearchParams({
        action: 'parse',
        page: word,
        prop: 'wikitext',
        format: 'json'
      });

      const response = await fetch(`${this.baseURL}?${params}`);
      const data = await response.json();

      if (data.error) {
        return null;
      }

      const wikitext = data.parse?.wikitext?.['*'];
      if (!wikitext) {
        return null;
      }

      const etymologyData = this.parseEtymology(wikitext, word, language);
      // TEMPORARILY DISABLE CACHE FOR DEVELOPMENT
      // cache.set(cacheKey, etymologyData);
      return etymologyData;

    } catch (error) {
      console.error(`Error fetching Wiktionary data for "${word}":`, error);
      return null;
    }
  }

  parseEtymology(wikitext, word, language) {
    const result = {
      sourceWord: {
        text: word,
        language: language,
        partOfSpeech: 'unknown',
        definition: 'Definition not available'
      },
      connections: []
    };

    try {
      // Check if we have wikitext
      if (!wikitext || wikitext.length < 10) {
        return result;
      }

      // More flexible etymology section extraction
      const etymologyPatterns = [
        /===Etymology===\s*\n(.*?)(?=\n===|\n==|\n\[\[Category|\n$)/s,
        /==Etymology==\s*\n(.*?)(?=\n===|\n==|\n\[\[Category|\n$)/s,
        /====Etymology====\s*\n(.*?)(?=\n===|\n==|\n\[\[Category|\n$)/s
      ];

      let etymologyText = '';
      for (const pattern of etymologyPatterns) {
        const match = wikitext.match(pattern);
        if (match) {
          etymologyText = match[1];
          break;
        }
      }

      // If no dedicated etymology section, search the entire text for etymology templates
      if (!etymologyText) {
        console.log(`No etymology section for "${word}", searching full text for templates`);
        etymologyText = wikitext;
      }

      // Extract definition
      const definitionMatch = wikitext.match(/# (.+?)(?:\n|$)/);
      if (definitionMatch) {
        result.sourceWord.definition = definitionMatch[1].replace(/\[\[([^\]]+)\]\]/g, '$1');
      }

      // Extract part of speech
      const posMatch = wikitext.match(/===(.+?)===\n.*?# /s);
      if (posMatch && posMatch[1] !== 'Etymology') {
        result.sourceWord.partOfSpeech = posMatch[1].toLowerCase();
      }

      // Parse cognates and related words from the etymology text
      const cognateConnections = this.extractCognates(etymologyText, language);
      const derivativeConnections = this.extractDerivatives(wikitext, word, language);
      const compoundConnections = this.extractCompounds(wikitext, word, language);

      console.log(`Etymology parsing for "${word}":`, {
        cognates: cognateConnections.length,
        derivatives: derivativeConnections.length,
        compounds: compoundConnections.length,
        hasEtymologySection: etymologyText !== wikitext
      });

      result.connections = [
        ...cognateConnections,
        ...derivativeConnections,
        ...compoundConnections
      ];

    } catch (error) {
      console.error('Error parsing etymology:', error);
    }

    return result;
  }

  extractCognates(etymologyText, sourceLanguage) {
    const connections = [];

    // Direct template extraction - look for all Wiktionary language templates
    const languageRefs = this.parseLanguageReferences(etymologyText);
    console.log(`Found ${languageRefs.length} language references in etymology`);

    languageRefs.forEach(ref => {
      if (ref.language !== sourceLanguage && ref.word.length > 1) {
        connections.push({
          word: {
            text: ref.word,
            language: ref.language,
            partOfSpeech: 'unknown',
            definition: `${this.getLanguageName(ref.language)} etymological connection`
          },
          relationship: {
            type: 'cognate',
            confidence: 0.80,
            notes: `Etymological connection from Wiktionary`
          }
        });
      }
    });

    // Look for additional cognate patterns in text
    const cognatePatterns = [
      /cognate with (.+?)(?:\.|,|\n|$)/gi,
      /compare (.+?)(?:\.|,|\n|$)/gi,
      /related to (.+?)(?:\.|,|\n|$)/gi,
      /from (.+?)(?:\.|,|\n|$)/gi,
      /borrowed from (.+?)(?:\.|,|\n|$)/gi,
      /inherited from (.+?)(?:\.|,|\n|$)/gi
    ];

    cognatePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(etymologyText)) !== null) {
        const cognateText = match[1];

        // Extract individual cognates from this match
        const extraCognates = this.parseLanguageReferences(cognateText);
        extraCognates.forEach(cognate => {
          if (cognate.language !== sourceLanguage) {
            // Check if we already have this word
            const exists = connections.some(conn =>
              conn.word.text === cognate.word && conn.word.language === cognate.language
            );

            if (!exists) {
              connections.push({
                word: {
                  text: cognate.word,
                  language: cognate.language,
                  partOfSpeech: 'unknown',
                  definition: `${this.getLanguageName(cognate.language)} cognate through ${match[0].split(' ')[0]}`
                },
                relationship: {
                  type: 'cognate',
                  confidence: 0.85,
                  notes: `Cognate relationship: ${match[0].split(' ')[0]}`
                }
              });
            }
          }
        });
      }
    });

    return connections;
  }

  extractDerivatives(wikitext, sourceWord, language) {
    const connections = [];

    // Look for derived terms section
    const derivedMatch = wikitext.match(/===Derived terms===\n(.*?)(?=\n===|\n==|\n\[\[Category|\n$)/s);
    if (derivedMatch) {
      const derivedText = derivedMatch[1];

      // Extract words in double brackets
      const derivedTerms = derivedText.match(/\[\[([^\]]+)\]\]/g);
      if (derivedTerms) {
        derivedTerms.forEach(term => {
          const cleanTerm = term.replace(/\[\[|\]\]/g, '').split('|')[0];
          if (cleanTerm.includes(sourceWord.toLowerCase()) || sourceWord.toLowerCase().includes(cleanTerm)) {
            connections.push({
              word: {
                text: cleanTerm,
                language: language,
                partOfSpeech: 'unknown',
                definition: `${this.getLanguageName(language)} word derived from "${sourceWord}"`
              },
              relationship: {
                type: 'derivative',
                confidence: 0.90,
                notes: `Derivative of ${sourceWord}`
              }
            });
          }
        });
      }
    }

    return connections;
  }

  extractCompounds(wikitext, sourceWord, language) {
    const connections = [];

    // Look for compound words in derived terms
    const derivedMatch = wikitext.match(/===Derived terms===\n(.*?)(?=\n===|\n==|\n\[\[Category|\n$)/s);
    if (derivedMatch) {
      const derivedText = derivedMatch[1];

      const compoundTerms = derivedText.match(/\[\[([^\]]+)\]\]/g);
      if (compoundTerms) {
        compoundTerms.forEach(term => {
          const cleanTerm = term.replace(/\[\[|\]\]/g, '').split('|')[0];
          // Check if it's a compound (contains source word + another word)
          if (cleanTerm.includes(sourceWord.toLowerCase()) && cleanTerm.length > sourceWord.length + 2) {
            connections.push({
              word: {
                text: cleanTerm,
                language: language,
                partOfSpeech: 'unknown',
                definition: `${this.getLanguageName(language)} compound word containing "${sourceWord}"`
              },
              relationship: {
                type: 'compound',
                confidence: 0.85,
                notes: `Compound word: ${cleanTerm}`
              }
            });
          }
        });
      }
    }

    return connections;
  }

  parseLanguageReferences(text) {
    const results = [];

    // Enhanced patterns for ALL Wiktionary templates that reference other languages
    const languagePatterns = [
      // Etymology templates
      /\{\{cog\|([^|}]+)\|([^|}]+)[\|}]/g,        // {{cog|language|word}}
      /\{\{cognate\|([^|}]+)\|([^|}]+)[\|}]/g,    // {{cognate|language|word}}
      /\{\{der\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g, // {{der|target|source_lang|word}}
      /\{\{inh\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g, // {{inh|target|source_lang|word}}
      /\{\{bor\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g, // {{bor|target|source_lang|word}}
      /\{\{cal\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g, // {{cal|target|source_lang|word}} (calque)
      /\{\{lbor\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g, // {{lbor|target|source_lang|word}} (learned borrowing)

      // Mention templates
      /\{\{m\|([^|}]+)\|([^|}]+)[\|}]/g,          // {{m|language|word}}
      /\{\{mention\|([^|}]+)\|([^|}]+)[\|}]/g,    // {{mention|language|word}}
      /\{\{l\|([^|}]+)\|([^|}]+)[\|}]/g,          // {{l|language|word}}
      /\{\{link\|([^|}]+)\|([^|}]+)[\|}]/g,       // {{link|language|word}}

      // Term templates
      /\{\{term\|([^|}]+)\|([^|}]+)[\|}]/g,       // {{term|language|word}}
      /\{\{t\|([^|}]+)\|([^|}]+)[\|}]/g,          // {{t|language|word}}
      /\{\{t\+\|([^|}]+)\|([^|}]+)[\|}]/g,        // {{t+|language|word}}

      // Etymology-specific
      /\{\{etyl\|([^|}]+)\|[^|}]*\|([^|}]+)[\|}]/g, // {{etyl|source_lang|target|word}}
      /\{\{etyl\|([^|}]+)\}\}\s*\[\[([^\]]+)\]\]/g,  // {{etyl|lang}} [[word]]

      // Prefix/affix templates that reference other languages
      /\{\{af\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g,  // {{af|lang|prefix|word}}
      /\{\{prefix\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g, // {{prefix|lang|prefix|word}}
      /\{\{suffix\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g, // {{suffix|lang|word|suffix}}

      // Compound templates
      /\{\{compound\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g, // {{compound|lang|word1|word2}}
    ];

    languagePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.length >= 3) {
          const language = this.normalizeLanguageCode(match[1]);
          let word = match[2];

          // Clean up the word
          word = word.replace(/\|.*$/, '') // Remove extra parameters
                     .replace(/\[\[([^\]]+)\]\]/g, '$1') // Remove wiki links
                     .replace(/\{\{[^}]+\}\}/g, '') // Remove nested templates
                     .trim();

          if (language && word && word.length > 1 && !word.includes('{{') && !word.includes('}}')) {
            results.push({ language, word });
          }
        }
      }
    });

    // Also look for simple wiki-linked words with language indicators
    const wikiLinkPattern = /\[\[([^:\]]+):([^\]]+)\]\]/g;
    let match;
    while ((match = wikiLinkPattern.exec(text)) !== null) {
      const language = this.normalizeLanguageCode(match[1]);
      const word = match[2].split('|')[0].trim();
      if (language && word && word.length > 1) {
        results.push({ language, word });
      }
    }

    console.log(`Extracted ${results.length} language references from text`);
    return results;
  }

  normalizeLanguageCode(code) {
    const languageMap = {
      // Modern languages
      'de': 'de', 'ger': 'de', 'german': 'de',
      'fr': 'fr', 'fre': 'fr', 'french': 'fr',
      'es': 'es', 'spa': 'es', 'spanish': 'es',
      'it': 'it', 'ita': 'it', 'italian': 'it',
      'pt': 'pt', 'por': 'pt', 'portuguese': 'pt',
      'nl': 'nl', 'dut': 'nl', 'dutch': 'nl',
      'la': 'la', 'lat': 'la', 'latin': 'la',
      'grc': 'gr', 'greek': 'gr', 'el': 'gr',
      'en': 'en', 'eng': 'en', 'english': 'en',
      'ru': 'ru', 'rus': 'ru', 'russian': 'ru',
      'pl': 'pl', 'pol': 'pl', 'polish': 'pl',
      'cs': 'cs', 'cze': 'cs', 'czech': 'cs',
      'da': 'da', 'danish': 'da',
      'sv': 'sv', 'swe': 'sv', 'swedish': 'sv',
      'no': 'no', 'nor': 'no', 'norwegian': 'no',
      'is': 'is', 'isl': 'is', 'icelandic': 'is',
      'fi': 'fi', 'fin': 'fi', 'finnish': 'fi',
      'hu': 'hu', 'hun': 'hu', 'hungarian': 'hu',
      'tr': 'tr', 'tur': 'tr', 'turkish': 'tr',
      'ar': 'ar', 'ara': 'ar', 'arabic': 'ar',
      'he': 'he', 'heb': 'he', 'hebrew': 'he',
      'hi': 'hi', 'hin': 'hi', 'hindi': 'hi',
      'sa': 'sa', 'san': 'sa', 'sanskrit': 'sa',
      'zh': 'zh', 'chi': 'zh', 'chinese': 'zh',
      'ja': 'ja', 'jpn': 'ja', 'japanese': 'ja',
      'ko': 'ko', 'kor': 'ko', 'korean': 'ko',

      // Historical languages and variants
      'enm': 'enm', // Middle English
      'ang': 'ang', // Old English
      'fro': 'fro', // Old French
      'frm': 'frm', // Middle French
      'xno': 'xno', // Anglo-Norman
      'gmh': 'gmh', // Middle High German
      'goh': 'goh', // Old High German
      'osx': 'osx', // Old Saxon
      'odt': 'odt', // Old Dutch
      'dum': 'dum', // Middle Dutch
      'non': 'non', // Old Norse
      'got': 'got', // Gothic
      'sla-pro': 'sla-pro', // Proto-Slavic
      'ine-pro': 'ine-pro', // Proto-Indo-European
      'gem-pro': 'gem-pro', // Proto-Germanic
      'gmw-pro': 'gmw-pro', // Proto-West-Germanic
      'itc-pro': 'itc-pro', // Proto-Italic
      'cel-pro': 'cel-pro', // Proto-Celtic
      'gml': 'gml', // Middle Low German
      'ml': 'ml', // Medieval Latin
      'VL': 'la', // Vulgar Latin -> Latin
      'LL': 'la', // Late Latin -> Latin

      // Romance language variants
      'roa-opt': 'pt', // Old Portuguese
      'roa-oit': 'it', // Old Italian
      'pro': 'pro', // Old Occitan
      'ca': 'ca', 'cat': 'ca', // Catalan
      'ro': 'ro', 'rum': 'ro', // Romanian
      'gl': 'gl', 'glg': 'gl', // Galician

      // Celtic languages
      'ga': 'ga', 'gle': 'ga', // Irish
      'gd': 'gd', 'gla': 'gd', // Scottish Gaelic
      'cy': 'cy', 'wel': 'cy', // Welsh
      'br': 'br', 'bre': 'br', // Breton
      'kw': 'kw', 'cor': 'kw', // Cornish

      // Slavic languages
      'uk': 'uk', 'ukr': 'uk', // Ukrainian
      'be': 'be', 'bel': 'be', // Belarusian
      'bg': 'bg', 'bul': 'bg', // Bulgarian
      'mk': 'mk', 'mac': 'mk', // Macedonian
      'sr': 'sr', 'srp': 'sr', // Serbian
      'hr': 'hr', 'hrv': 'hr', // Croatian
      'bs': 'bs', 'bos': 'bs', // Bosnian
      'sk': 'sk', 'slo': 'sk', // Slovak
      'sl': 'sl', 'slv': 'sl', // Slovenian

      // Others
      'eu': 'eu', 'baq': 'eu', // Basque
      'mt': 'mt', 'mlt': 'mt', // Maltese
      'sq': 'sq', 'alb': 'sq', // Albanian
      'lv': 'lv', 'lav': 'lv', // Latvian
      'lt': 'lt', 'lit': 'lt', // Lithuanian
      'et': 'et', 'est': 'et', // Estonian
    };

    const normalized = code.toLowerCase().trim();
    return languageMap[normalized] || normalized;
  }

  getLanguageName(code) {
    const names = {
      // Modern languages
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'nl': 'Dutch',
      'la': 'Latin',
      'gr': 'Greek',
      'el': 'Greek',
      'grc': 'Ancient Greek',
      'ru': 'Russian',
      'pl': 'Polish',
      'cs': 'Czech',
      'da': 'Danish',
      'sv': 'Swedish',
      'no': 'Norwegian',
      'is': 'Icelandic',
      'fi': 'Finnish',
      'hu': 'Hungarian',
      'tr': 'Turkish',
      'ar': 'Arabic',
      'he': 'Hebrew',
      'hi': 'Hindi',
      'sa': 'Sanskrit',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',

      // Historical and variant languages
      'enm': 'Middle English',
      'ang': 'Old English',
      'fro': 'Old French',
      'frm': 'Middle French',
      'xno': 'Anglo-Norman',
      'gmh': 'Middle High German',
      'goh': 'Old High German',
      'osx': 'Old Saxon',
      'odt': 'Old Dutch',
      'dum': 'Middle Dutch',
      'non': 'Old Norse',
      'got': 'Gothic',
      'ml': 'Medieval Latin',
      'ML': 'Medieval Latin',
      'ml.': 'Medieval Latin',
      'ML.': 'Medieval Latin',
      'VL': 'Vulgar Latin',
      'LL': 'Late Latin',

      // Proto-languages
      'ine-pro': 'Proto-Indo-European',
      'gem-pro': 'Proto-Germanic',
      'gmw-pro': 'Proto-West-Germanic',
      'itc-pro': 'Proto-Italic',
      'cel-pro': 'Proto-Celtic',
      'sla-pro': 'Proto-Slavic',

      // Romance languages
      'roa-opt': 'Old Portuguese',
      'roa-oit': 'Old Italian',
      'pro': 'Old Occitan',
      'ca': 'Catalan',
      'ro': 'Romanian',
      'gl': 'Galician',

      // Celtic languages
      'ga': 'Irish',
      'gd': 'Scottish Gaelic',
      'cy': 'Welsh',
      'br': 'Breton',
      'kw': 'Cornish',

      // Slavic languages
      'uk': 'Ukrainian',
      'be': 'Belarusian',
      'bg': 'Bulgarian',
      'mk': 'Macedonian',
      'sr': 'Serbian',
      'hr': 'Croatian',
      'bs': 'Bosnian',
      'sk': 'Slovak',
      'sl': 'Slovenian',

      // Other languages
      'eu': 'Basque',
      'mt': 'Maltese',
      'sq': 'Albanian',
      'lv': 'Latvian',
      'lt': 'Lithuanian',
      'et': 'Estonian',
      'gml': 'Middle Low German',

      // Common abbreviations and variants
      'unknown': 'Unknown'
    };

    const normalized = (code || '').toLowerCase().replace(/\.$/, ''); // Remove trailing period
    return names[normalized] || names[code] || (code ? code.charAt(0).toUpperCase() + code.slice(1) : 'Unknown');
  }
}

module.exports = new WiktionaryAPI();