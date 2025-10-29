import NodeCache from 'node-cache';
import { logError } from '../utils/logger';

const cache = new NodeCache({ stdTTL: 7200 });

interface LanguageReference {
  language: string;
  word: string;
}

interface Word {
  text: string;
  language: string;
  partOfSpeech: string;
  definition: string;
}

interface Connection {
  word: Word;
  relationship: {
    type: string;
    confidence: number;
    notes: string;
  };
}

interface EtymologyData {
  sourceWord: Word;
  connections: Connection[];
}

interface WiktionaryParseResponse {
  error?: unknown;
  parse?: {
    wikitext?: {
      '*': string;
    };
  };
}

class WiktionaryAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = 'https://en.wiktionary.org/w/api.php';
  }

  async fetchWiktionaryData(word: string, language: string = 'en'): Promise<EtymologyData | null> {
    const cacheKey = `wiktionary_${word}_${language}`;
    const cached = cache.get<EtymologyData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams({
        action: 'parse',
        page: word,
        prop: 'wikitext',
        format: 'json'
      });

      const response = await fetch(`${this.baseURL}?${params}`);
      const data = await response.json() as WiktionaryParseResponse;

      if (!response.ok || data.error) {
        return null;
      }

      const wikitext = data.parse?.wikitext?.['*'];
      if (!wikitext) {
        return null;
      }

      const etymologyData = this.parseEtymology(wikitext, word, language);
      cache.set(cacheKey, etymologyData);
      return etymologyData;

    } catch (error) {
      logError(`Error fetching Wiktionary data for "${word}"`, error, {
        word,
        language
      });
      return null;
    }
  }

  private parseEtymology(wikitext: string, word: string, language: string): EtymologyData {
    const result: EtymologyData = {
      sourceWord: {
        text: word,
        language: language,
        partOfSpeech: 'unknown',
        definition: 'Definition not available'
      },
      connections: []
    };

    try {
      if (!wikitext || wikitext.length < 10) {
        return result;
      }

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

      if (!etymologyText) {
        etymologyText = wikitext;
      }

      const definitionMatch = wikitext.match(/# (.+?)(?:\n|$)/);
      if (definitionMatch) {
        result.sourceWord.definition = definitionMatch[1].replace(/\[\[([^\]]+)\]\]/g, '$1');
      }

      const posMatch = wikitext.match(/===(.+?)===\n.*?# /s);
      if (posMatch && posMatch[1] !== 'Etymology') {
        result.sourceWord.partOfSpeech = posMatch[1].toLowerCase();
      }

      const cognateConnections = this.extractCognates(etymologyText, language);
      const derivativeConnections = this.extractDerivatives(wikitext, word, language);
      const compoundConnections = this.extractCompounds(wikitext, word, language);

      result.connections = [
        ...cognateConnections,
        ...derivativeConnections,
        ...compoundConnections
      ];

    } catch (error) {
      logError('Error parsing etymology', error, { word, language });
    }

    return result;
  }

  private extractCognates(etymologyText: string, sourceLanguage: string): Connection[] {
    const connections: Connection[] = [];

    const languageRefs = this.parseLanguageReferences(etymologyText);

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

    const cognatePatterns = [
      /cognate with (.+?)(?:\.|,|\n|$)/gi,
      /compare (.+?)(?:\.|,|\n|$)/gi,
      /related to (.+?)(?:\.|,|\n|$)/gi,
      /from (.+?)(?:\.|,|\n|$)/gi,
      /borrowed from (.+?)(?:\.|,|\n|$)/gi,
      /inherited from (.+?)(?:\.|,|\n|$)/gi
    ];

    cognatePatterns.forEach(pattern => {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(etymologyText)) !== null) {
        const currentMatch = match;
        const cognateText = currentMatch[1];

        const extraCognates = this.parseLanguageReferences(cognateText);
        extraCognates.forEach(cognate => {
          if (cognate.language !== sourceLanguage) {
            const exists = connections.some(conn =>
              conn.word.text === cognate.word && conn.word.language === cognate.language
            );

            if (!exists) {
              connections.push({
                word: {
                  text: cognate.word,
                  language: cognate.language,
                  partOfSpeech: 'unknown',
                  definition: `${this.getLanguageName(cognate.language)} cognate through ${currentMatch[0].split(' ')[0]}`
                },
                relationship: {
                  type: 'cognate',
                  confidence: 0.85,
                  notes: `Cognate relationship: ${currentMatch[0].split(' ')[0]}`
                }
              });
            }
          }
        });
      }
    });

    return connections;
  }

  private extractDerivatives(wikitext: string, sourceWord: string, language: string): Connection[] {
    const connections: Connection[] = [];

    const derivedMatch = wikitext.match(/===Derived terms===\n(.*?)(?=\n===|\n==|\n\[\[Category|\n$)/s);
    if (derivedMatch) {
      const derivedText = derivedMatch[1];

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

  private extractCompounds(wikitext: string, sourceWord: string, language: string): Connection[] {
    const connections: Connection[] = [];

    const derivedMatch = wikitext.match(/===Derived terms===\n(.*?)(?=\n===|\n==|\n\[\[Category|\n$)/s);
    if (derivedMatch) {
      const derivedText = derivedMatch[1];

      const compoundTerms = derivedText.match(/\[\[([^\]]+)\]\]/g);
      if (compoundTerms) {
        compoundTerms.forEach(term => {
          const cleanTerm = term.replace(/\[\[|\]\]/g, '').split('|')[0];
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

  private parseLanguageReferences(text: string): LanguageReference[] {
    const results: LanguageReference[] = [];

    const languagePatterns = [
      /\{\{cog\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{cognate\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{der\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{inh\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{bor\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{cal\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{lbor\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{m\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{mention\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{l\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{link\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{term\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{t\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{t\+\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{etyl\|([^|}]+)\|[^|}]*\|([^|}]+)[\|}]/g,
      /\{\{etyl\|([^|}]+)\}\}\s*\[\[([^\]]+)\]\]/g,
      /\{\{af\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{prefix\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{suffix\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g,
      /\{\{compound\|[^|}]+\|([^|}]+)\|([^|}]+)[\|}]/g,
    ];

    languagePatterns.forEach(pattern => {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        if (match.length >= 3) {
          const language = this.normalizeLanguageCode(match[1]);
          let word = match[2];

          word = word.replace(/\|.*$/, '')
                     .replace(/\[\[([^\]]+)\]\]/g, '$1')
                     .replace(/\{\{[^}]+\}\}/g, '')
                     .trim();

          if (language && word && word.length > 1 && !word.includes('{{') && !word.includes('}}')) {
            results.push({ language, word });
          }
        }
      }
    });

    const wikiLinkPattern = /\[\[([^:\]]+):([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = wikiLinkPattern.exec(text)) !== null) {
      const language = this.normalizeLanguageCode(match[1]);
      const word = match[2].split('|')[0].trim();
      if (language && word && word.length > 1) {
        results.push({ language, word });
      }
    }

    return results;
  }

  private normalizeLanguageCode(code: string): string {
    const languageMap: { [key: string]: string } = {
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
      'enm': 'enm',
      'ang': 'ang',
      'fro': 'fro',
      'frm': 'frm',
      'xno': 'xno',
      'gmh': 'gmh',
      'goh': 'goh',
      'osx': 'osx',
      'odt': 'odt',
      'dum': 'dum',
      'non': 'non',
      'got': 'got',
      'sla-pro': 'sla-pro',
      'ine-pro': 'ine-pro',
      'gem-pro': 'gem-pro',
      'gmw-pro': 'gmw-pro',
      'itc-pro': 'itc-pro',
      'cel-pro': 'cel-pro',
      'gml': 'gml',
      'ml': 'ml',
      'VL': 'la',
      'LL': 'la',
      'roa-opt': 'pt',
      'roa-oit': 'it',
      'pro': 'pro',
      'ca': 'ca', 'cat': 'ca',
      'ro': 'ro', 'rum': 'ro',
      'gl': 'gl', 'glg': 'gl',
      'ga': 'ga', 'gle': 'ga',
      'gd': 'gd', 'gla': 'gd',
      'cy': 'cy', 'wel': 'cy',
      'br': 'br', 'bre': 'br',
      'kw': 'kw', 'cor': 'kw',
      'uk': 'uk', 'ukr': 'uk',
      'be': 'be', 'bel': 'be',
      'bg': 'bg', 'bul': 'bg',
      'mk': 'mk', 'mac': 'mk',
      'sr': 'sr', 'srp': 'sr',
      'hr': 'hr', 'hrv': 'hr',
      'bs': 'bs', 'bos': 'bs',
      'sk': 'sk', 'slo': 'sk',
      'sl': 'sl', 'slv': 'sl',
      'eu': 'eu', 'baq': 'eu',
      'mt': 'mt', 'mlt': 'mt',
      'sq': 'sq', 'alb': 'sq',
      'lv': 'lv', 'lav': 'lv',
      'lt': 'lt', 'lit': 'lt',
      'et': 'et', 'est': 'et',
    };

    const normalized = code.toLowerCase().trim();
    return languageMap[normalized] || normalized;
  }

  private getLanguageName(code: string): string {
    const names: { [key: string]: string } = {
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
      'ine-pro': 'Proto-Indo-European',
      'gem-pro': 'Proto-Germanic',
      'gmw-pro': 'Proto-West-Germanic',
      'itc-pro': 'Proto-Italic',
      'cel-pro': 'Proto-Celtic',
      'sla-pro': 'Proto-Slavic',
      'roa-opt': 'Old Portuguese',
      'roa-oit': 'Old Italian',
      'pro': 'Old Occitan',
      'ca': 'Catalan',
      'ro': 'Romanian',
      'gl': 'Galician',
      'ga': 'Irish',
      'gd': 'Scottish Gaelic',
      'cy': 'Welsh',
      'br': 'Breton',
      'kw': 'Cornish',
      'uk': 'Ukrainian',
      'be': 'Belarusian',
      'bg': 'Bulgarian',
      'mk': 'Macedonian',
      'sr': 'Serbian',
      'hr': 'Croatian',
      'bs': 'Bosnian',
      'sk': 'Slovak',
      'sl': 'Slovenian',
      'eu': 'Basque',
      'mt': 'Maltese',
      'sq': 'Albanian',
      'lv': 'Latvian',
      'lt': 'Lithuanian',
      'et': 'Estonian',
      'gml': 'Middle Low German',
      'unknown': 'Unknown'
    };

    const normalized = (code || '').toLowerCase().replace(/\.$/, '');
    return names[normalized] || names[code] || (code ? code.charAt(0).toUpperCase() + code.slice(1) : 'Unknown');
  }
}

export default new WiktionaryAPI();
