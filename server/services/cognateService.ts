import NodeCache from 'node-cache';
import { logger } from '../utils/logger';
import { getLanguageName } from '../../shared/constants/languages';
import { getRomanceRoot, getGermanicRoot, areRootsRelated } from '../../shared/utils/etymologyUtils';

const cache = new NodeCache({ stdTTL: 14400 });

interface SoundChangeRule {
  from: RegExp;
  to: string;
  example: string;
  lang?: string;
  family?: string;
}

interface SoundChangeRules {
  [key: string]: SoundChangeRule[];
}

interface LanguageMap {
  [languageCode: string]: string[];
}

interface Concept {
  [conceptName: string]: LanguageMap;
}

interface CognateGroups {
  [fieldName: string]: Concept;
}

interface Cognate {
  word: string;
  language: string;
  confidence: number;
  relationship: string;
  semanticField?: string;
  concept?: string;
  soundChange?: string;
  notes?: string;
}

class CognateService {
  private soundChangeRules: SoundChangeRules;
  private cognateGroups: CognateGroups;

  constructor() {
    this.soundChangeRules = {
      germanic_to_romance: [
        { from: /^h([aeiou])/, to: '$1', example: 'haus → casa' },
        { from: /k([aeiou])/, to: 'c$1', example: 'kin → cognate' },
        { from: /w([aeiou])/, to: 'v$1', example: 'water → aqua' },
        { from: /^f/, to: 'p', example: 'father → pater' },
        { from: /th/, to: 't', example: 'three → tres' }
      ],

      latin_variations: [
        { from: /ct/, to: 'tt', lang: 'it', example: 'factum → fatto' },
        { from: /ct/, to: 'ch', lang: 'es', example: 'factum → hecho' },
        { from: /ct/, to: 'it', lang: 'fr', example: 'factum → fait' },
        { from: /^p/, to: '', lang: 'fr', example: 'pater → père' },
        { from: /^f/, to: 'h', lang: 'es', example: 'farina → harina' }
      ],

      indo_european: [
        { from: /^p/, to: 'f', family: 'germanic', example: 'pater → father' },
        { from: /^d/, to: 't', family: 'germanic', example: 'decem → ten' },
        { from: /^g/, to: 'k', family: 'germanic', example: 'genus → kin' }
      ]
    };

    this.cognateGroups = {
      family_relations: {
        mother: {
          en: ['mother'],
          de: ['mutter'],
          es: ['madre'],
          fr: ['mère'],
          it: ['madre'],
          la: ['mater'],
          ru: ['мать'],
          gr: ['μητέρα']
        },
        father: {
          en: ['father'],
          de: ['vater'],
          es: ['padre'],
          fr: ['père'],
          it: ['padre'],
          la: ['pater'],
          ru: ['отец'],
          gr: ['πατέρας']
        },
        brother: {
          en: ['brother'],
          de: ['bruder'],
          es: ['hermano'],
          fr: ['frère'],
          it: ['fratello'],
          la: ['frater'],
          ru: ['брат'],
          gr: ['αδελφός']
        }
      },

      numbers: {
        one: {
          en: ['one'],
          de: ['ein', 'eins'],
          es: ['uno'],
          fr: ['un'],
          it: ['uno'],
          la: ['unus'],
          ru: ['один'],
          gr: ['ένα']
        },
        two: {
          en: ['two'],
          de: ['zwei'],
          es: ['dos'],
          fr: ['deux'],
          it: ['due'],
          la: ['duo'],
          ru: ['два'],
          gr: ['δύο']
        },
        three: {
          en: ['three'],
          de: ['drei'],
          es: ['tres'],
          fr: ['trois'],
          it: ['tre'],
          la: ['tres'],
          ru: ['три'],
          gr: ['τρία']
        }
      },

      body_parts: {
        heart: {
          en: ['heart'],
          de: ['herz'],
          es: ['corazón'],
          fr: ['cœur'],
          it: ['cuore'],
          la: ['cor'],
          ru: ['сердце'],
          gr: ['καρδιά']
        },
        head: {
          en: ['head'],
          de: ['kopf', 'haupt'],
          es: ['cabeza'],
          fr: ['tête'],
          it: ['testa'],
          la: ['caput'],
          ru: ['голова'],
          gr: ['κεφάλι']
        }
      },

      basic_concepts: {
        water: {
          en: ['water'],
          de: ['wasser'],
          es: ['agua'],
          fr: ['eau'],
          it: ['acqua'],
          la: ['aqua'],
          ru: ['вода'],
          gr: ['νερό']
        },
        fire: {
          en: ['fire'],
          de: ['feuer'],
          es: ['fuego'],
          fr: ['feu'],
          it: ['fuoco'],
          la: ['ignis'],
          ru: ['огонь'],
          gr: ['φωτιά']
        },
        house: {
          en: ['house'],
          de: ['haus'],
          es: ['casa'],
          fr: ['maison'],
          it: ['casa'],
          la: ['domus'],
          ru: ['дом'],
          gr: ['σπίτι']
        }
      }
    };
  }

  async findCognates(
    word: string,
    sourceLanguage: string,
    targetLanguages: string[] = ['en', 'es', 'fr', 'de', 'it']
  ): Promise<Cognate[]> {
    const cacheKey = `cognates_${word}_${sourceLanguage}_${targetLanguages.join('_')}`;
    const cached = cache.get<Cognate[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const cognates: Cognate[] = [];
    const normalizedWord = word.toLowerCase().trim();

    const directCognates = this.findDirectCognates(normalizedWord, sourceLanguage, targetLanguages);
    cognates.push(...directCognates);

    const soundChangeCognates = this.applySoundChangeRules(normalizedWord, sourceLanguage, targetLanguages);
    cognates.push(...soundChangeCognates);

    const uniqueCognates = this.deduplicateCognates(cognates);
    const sortedCognates = uniqueCognates.sort((a, b) => b.confidence - a.confidence);

    cache.set(cacheKey, sortedCognates);
    return sortedCognates;
  }

  private findDirectCognates(word: string, sourceLanguage: string, targetLanguages: string[]): Cognate[] {
    const cognates: Cognate[] = [];

    for (const [fieldName, concepts] of Object.entries(this.cognateGroups)) {
      for (const [conceptName, languageMap] of Object.entries(concepts)) {
        const sourceWords = languageMap[sourceLanguage] || [];
        const wordMatches = sourceWords.some(w => w.toLowerCase() === word.toLowerCase());

        if (wordMatches) {
          for (const targetLang of targetLanguages) {
            if (targetLang !== sourceLanguage && languageMap[targetLang]) {
              for (const cognateWord of languageMap[targetLang]) {
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

  private applySoundChangeRules(word: string, sourceLanguage: string, targetLanguages: string[]): Cognate[] {
    const cognates: Cognate[] = [];
    const languageFamilies = this.getLanguageFamily(sourceLanguage);

    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLanguage) continue;

      const targetFamilies = this.getLanguageFamily(targetLang);

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

  private getLanguageFamily(languageCode: string): string[] {
    const families: { [key: string]: string[] } = {
      en: ['germanic', 'indo_european'],
      de: ['germanic', 'indo_european'],
      nl: ['germanic', 'indo_european'],
      da: ['germanic', 'indo_european'],
      sv: ['germanic', 'indo_european'],
      no: ['germanic', 'indo_european'],

      es: ['romance', 'indo_european'],
      fr: ['romance', 'indo_european'],
      it: ['romance', 'indo_european'],
      pt: ['romance', 'indo_european'],
      ro: ['romance', 'indo_european'],
      ca: ['romance', 'indo_european'],

      la: ['latin', 'indo_european'],
      gr: ['hellenic', 'indo_european'],
      ru: ['slavic', 'indo_european'],
      pl: ['slavic', 'indo_european'],
      cs: ['slavic', 'indo_european'],

      ar: ['semitic'],
      he: ['semitic'],
      hi: ['indo_aryan', 'indo_european'],
      sa: ['indo_aryan', 'indo_european']
    };

    return families[languageCode] || ['unknown'];
  }

  private deduplicateCognates(cognates: Cognate[]): Cognate[] {
    const seen = new Map<string, Cognate>();
    const unique: Cognate[] = [];

    for (const cognate of cognates) {
      const key = `${cognate.word.toLowerCase()}_${cognate.language}`;

      if (!seen.has(key)) {
        seen.set(key, cognate);
        unique.push(cognate);
      } else {
        const existing = seen.get(key);
        if (existing && cognate.confidence > existing.confidence) {
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

  getLanguageName(code: string): string {
    return getLanguageName(code);
  }

  private isDerivative(sourceText: string, targetText: string, sourceLang: string, targetLang: string): boolean {
    const source = sourceText.toLowerCase().trim();
    const target = targetText.toLowerCase().trim();

    if (source === target) {
      return true;
    }

    if (sourceLang !== targetLang) {
      return this.isCrossLanguageDerivative(source, target, sourceLang, targetLang);
    }

    const derivationalSuffixes = [
      'ing', 'ed', 's', 'es', 'ies', 'er', 'est', 'ly', 'ie', 'y',
      'ness', 'ment', 'tion', 'sion', 'ful', 'less', 'able', 'ible',
      'ist', 'ian', 'ism', 'ity', 'hood', 'ship', 'ward', 'wise', 'like',
      'ify', 'ize', 'ise', 'ate', 'age', 'dom', 'ory', 'ous', 'ive', 'ant', 'ent',
      'al', 'ic', 'ous', 'eous', 'ious', 'ary', 'ery', 'ory', 'ure', 'ade'
    ];

    const derivationalPrefixes = [
      're', 'un', 'pre', 'dis', 'mis', 'over', 'under', 'out', 'up', 'in', 'im', 'il', 'ir',
      'non', 'anti', 'de', 'ex', 'sub', 'super', 'inter', 'trans', 'semi', 'multi', 'co'
    ];

    for (const suffix of derivationalSuffixes) {
      if (target === source + suffix) {
        return true;
      }
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

    for (const prefix of derivationalPrefixes) {
      if (target === prefix + source || source === prefix + target) {
        return true;
      }
    }

    return false;
  }

  private isCrossLanguageDerivative(source: string, target: string, sourceLang: string, targetLang: string): boolean {
    const romanceLanguages = ['es', 'fr', 'it', 'pt', 'ca', 'ro'];
    const isSourceRomance = romanceLanguages.includes(sourceLang);
    const isTargetRomance = romanceLanguages.includes(targetLang);

    if (isSourceRomance && isTargetRomance) {
      const sourceRoot = getRomanceRoot(source);
      const targetRoot = getRomanceRoot(target);

      if (sourceRoot === targetRoot && sourceRoot.length >= 3) {
        return true;
      }
    }

    if ((sourceLang === 'en' || sourceLang === 'de') && isTargetRomance) {
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
          if (areRootsRelated(sourceBase, targetBase)) {
            return true;
          }
        }
      }
    }

    const germanicLanguages = ['en', 'de', 'nl', 'da', 'sv', 'no'];
    const isSourceGermanic = germanicLanguages.includes(sourceLang);
    const isTargetGermanic = germanicLanguages.includes(targetLang);

    if (isSourceGermanic && isTargetGermanic) {
      const sourceRoot = getGermanicRoot(source);
      const targetRoot = getGermanicRoot(target);

      if (sourceRoot === targetRoot && sourceRoot.length >= 3) {
        return true;
      }
    }

    return false;
  }
}

export default new CognateService();
