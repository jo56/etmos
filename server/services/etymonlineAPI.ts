import NodeCache from 'node-cache';
import { logError } from '../utils/logger';

const cache = new NodeCache({ stdTTL: 7200 });

interface EtymologyConnection {
  word: {
    id: string;
    text: string;
    language: string;
    partOfSpeech: string;
    definition: string;
  };
  relationship: {
    type: string;
    confidence: number;
    notes: string;
    origin?: string;
    sharedRoot?: string;
    etymologyContext?: string;
    soundChange?: string;
    semanticField?: string;
    concept?: string;
    priority?: string;
    isRelatedWord?: boolean;
    isFromCrossReference?: boolean;
    isFromShortenedDatabase?: boolean;
    shorteningContext?: string;
    derivativeContext?: string;
  };
}

interface EtymologyData {
  connections: EtymologyConnection[];
  crossReferences?: Array<{
    sharedRoot: string;
    cognateWords: any[];
    totalCognates: number;
  }>;
}

interface WordEntry {
  word: string;
  language: string;
  etymologicalForm: string;
  etymologicalLanguage: string;
  relationshipType: string;
  confidence: number;
  notes: string;
  sharedRoot: string;
}

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  reason?: string;
  notes?: string;
}

class EtymonlineAPI {
  private baseURL: string;
  private etymologyDatabase: Map<string, WordEntry[]>;
  private processedWords: Set<string>;
  private shortenedFormsDatabase?: Map<string, Array<{ word: string; confidence: number; notes: string }>>;

  constructor() {
    this.baseURL = 'https://www.etymonline.com/word';
    this.etymologyDatabase = new Map();
    this.processedWords = new Set();
  }

  async fetchEtymologyData(word: string, language: string = 'en'): Promise<EtymologyData | null> {
    const cacheKey = `etymonline_${word}_${language}`;
    const cached = cache.get<EtymologyData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let url: string;
      if (word.startsWith('*')) {
        url = `${this.baseURL}/${encodeURIComponent(word)}`;
      } else {
        url = `${this.baseURL}/${word}`;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      const etymologyData = this.parseEtymologyHTML(html, word, language);

      this.updateEtymologyDatabase(word, etymologyData);

      const enhancedData = this.enhanceWithCrossReferences(etymologyData, word);

      cache.set(cacheKey, enhancedData);
      return enhancedData;

    } catch (error) {
      logError(`Error fetching etymonline data for "${word}"`, error, {
        word,
        language
      });
      return null;
    }
  }

  private parseEtymologyHTML(html: string, word: string, language: string): EtymologyData {
    const connections: EtymologyConnection[] = [];

    try {
      const allSections = html.match(/<section[^>]*class="[^"]*prose-lg[^"]*"[^>]*>[\s\S]*?<\/section>/gi);
      const etymologyMatches: string[] = [];

      if (allSections) {
        for (const section of allSections) {
          const sectionText = section.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (this.isRelevantEtymologySection(sectionText, word)) {
            etymologyMatches.push(section);
          }
        }
      }

      if (!etymologyMatches || etymologyMatches.length === 0) {
        return { connections: [] };
      }

      for (const section of etymologyMatches) {
        const sectionText = section.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (this.isRelevantEtymologySection(sectionText, word)) {
          const etymology = this.extractEtymologyFromSection(section, word, language);
          connections.push(...etymology);
        }
      }

      const relatedWords = this.extractRelatedWords(html, word, language);
      connections.push(...relatedWords);

      return { connections };

    } catch (error) {
      logError(`Error parsing etymonline HTML for "${word}"`, error, {
        word,
        language
      });
      return { connections: [] };
    }
  }

  private extractEtymologyFromSection(sectionHTML: string, sourceWord: string, sourceLanguage: string): EtymologyConnection[] {
    const connections: EtymologyConnection[] = [];

    try {
      const text = sectionHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      const validEtymologies = new Set<string>();

      const markedWords = this.extractMarkedWords(sectionHTML, text, sourceWord);
      for (const markedWord of markedWords) {
        const etymologyKey = `${markedWord.word.language}:${markedWord.word.text}`;
        if (!validEtymologies.has(etymologyKey)) {
          connections.push(markedWord);
          validEtymologies.add(etymologyKey);
        }
      }

      const shortenedWordConnections = this.detectShortenedWordRelationships(text, sourceWord);
      if (shortenedWordConnections.length > 0) {
        connections.push(...shortenedWordConnections);
      }

      if (sourceWord.startsWith('*')) {
        const pieDerivatives = this.extractPIERootDerivatives(text, sourceWord);
        connections.push(...pieDerivatives);
      }

      if (connections.length === 0) {
        if (!sourceWord.startsWith('*')) {
          const highConfidencePatterns = [
            /from\s+PIE\s+(?:root\s+)?([*\w\u00C0-\u017F\u0100-\u017F\u1E00-\u1EFF\u1F00-\u1FFF\u0370-\u03FF\u0400-\u04FF₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi,
            /PIE\s+root\s+([*\w\u00C0-\u017F\u0100-\u017F\u1E00-\u1EFF\u1F00-\u1FFF\u0370-\u03FF\u0400-\u04FF₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi,
            /PIE\s+([*\w\u00C0-\u017F\u0100-\u017F\u1E00-\u1EFF\u1F00-\u1FFF\u0370-\u03FF\u0400-\u04FF₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi,
            /from\s+(Proto-[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+([*\w\u00C0-\u017F\u0100-\u017F\u1E00-\u1EFF\u1F00-\u1FFF\u0370-\u03FF\u0400-\u04FF₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi
          ];

          for (const pattern of highConfidencePatterns) {
            let match;
            pattern.lastIndex = 0;

            while ((match = pattern.exec(text)) !== null) {
              let languageName: string;
              let etymologicalWord: string;
              let isPIE = false;

              if (match[0].toLowerCase().includes('pie')) {
                languageName = 'Proto-Indo-European';
                etymologicalWord = match[1].trim();
                isPIE = true;
              } else if (match[1] && match[2]) {
                languageName = match[1].trim();
                etymologicalWord = match[2].trim();
              } else {
                continue;
              }

              if (!this.isValidEtymologicalWord(etymologicalWord, sourceWord)) {
                continue;
              }

              const etymologyKey = `${languageName}:${etymologicalWord}`;
              if (validEtymologies.has(etymologyKey)) {
                continue;
              }
              validEtymologies.add(etymologyKey);

              const contextValidation = this.validateEtymologicalContext(text, match.index, languageName, etymologicalWord);

              if (!contextValidation.isValid) {
                continue;
              }

              const languageCode = this.mapLanguageNameToCode(languageName);
              const sharedRoot = this.extractSharedRoot(text, languageName, etymologicalWord);
              const relationshipType = this.determineRelationshipType(languageName, etymologicalWord);

              const connection: EtymologyConnection = {
                word: {
                  id: this.generateId(),
                  text: etymologicalWord,
                  language: languageCode,
                  partOfSpeech: 'unknown',
                  definition: `${languageName} ${isPIE ? 'root' : 'origin'} of "${sourceWord}"`
                },
                relationship: {
                  type: relationshipType,
                  confidence: contextValidation.confidence,
                  notes: `Fallback pattern extraction: ${contextValidation.notes}`,
                  origin: sharedRoot ?? `${languageName} ${etymologicalWord}`,
                  sharedRoot: sharedRoot ?? undefined,
                  etymologyContext: match[0]
                }
              };

              connections.push(connection);
            }
          }
        }
      }

    } catch (error) {
      logError('Error extracting etymology from section', error, {
        sourceWord,
        sourceLanguage
      });
    }

    return connections;
  }

  private isValidEtymologicalWord(word: string, sourceWord: string): boolean {
    if (!word || word.length < 2) return false;
    if (word === sourceWord) return false;

    if (!/^[*]?[\w\u00C0-\u017F\u0100-\u017F\u1E00-\u1EFF\u1F00-\u1FFF\u0370-\u03FF\u0400-\u04FF₀-₉ʰₑʷβɟḱĝʷʲʼ-]+[.]?$/.test(word)) {
      return false;
    }

    const commonWords = ['the', 'and', 'from', 'with', 'also', 'see', 'probably', 'perhaps', 'meaning', 'word', 'form', 'root', 'base'];
    if (commonWords.includes(word.toLowerCase())) return false;

    if (this.isModernTechnicalTerm(word)) {
      return false;
    }

    if (this.areSemanticallySuspicious(word, sourceWord)) {
      return false;
    }

    if (!word.startsWith('*') && this.isMorphologicalComponent(word, sourceWord)) {
      return false;
    }

    return true;
  }

  private isModernTechnicalTerm(word: string): boolean {
    const modernPrefixes = ['cyber', 'nano', 'micro', 'mega', 'giga', 'meta', 'hyper', 'ultra'];
    const modernSuffixes = ['tech', 'net', 'web', 'app', 'bot', 'soft', 'ware'];
    const modernWords = ['internet', 'computer', 'digital', 'online', 'software', 'hardware', 'website', 'email'];

    const wordLower = word.toLowerCase();

    if (modernWords.includes(wordLower)) {
      return true;
    }

    for (const prefix of modernPrefixes) {
      if (wordLower.startsWith(prefix)) {
        return true;
      }
    }

    for (const suffix of modernSuffixes) {
      if (wordLower.endsWith(suffix)) {
        return true;
      }
    }

    return false;
  }

  private areSemanticallySuspicious(word: string, sourceWord: string): boolean {
    const wordLower = word.toLowerCase();
    const sourceLower = sourceWord.toLowerCase();

    const basicElements = ['fire', 'water', 'earth', 'air', 'wind'];
    const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white'];
    const numbers = ['one', 'two', 'three', 'four', 'five'];

    const wordIsElement = basicElements.includes(wordLower);
    const sourceIsElement = basicElements.includes(sourceLower);
    const wordIsColor = colors.includes(wordLower);
    const sourceIsColor = colors.includes(sourceLower);
    const wordIsNumber = numbers.includes(wordLower);
    const sourceIsNumber = numbers.includes(sourceLower);

    if ((wordIsElement && sourceIsColor) || (wordIsColor && sourceIsElement)) {
      return true;
    }
    if ((wordIsElement && sourceIsNumber) || (wordIsNumber && sourceIsElement)) {
      return true;
    }

    const suspiciousPairs = [
      ['water', 'fire'], ['fire', 'water'],
      ['water', 'punjab'], ['punjab', 'water'],
      ['test', 'forest'], ['forest', 'test']
    ];

    if (wordLower.startsWith('*') || sourceLower.startsWith('*')) {
      return false;
    }

    for (const [susp1, susp2] of suspiciousPairs) {
      if ((wordLower === susp1 && sourceLower === susp2) || (wordLower === susp2 && sourceLower === susp1)) {
        return true;
      }
    }

    return false;
  }

  private isMorphologicalComponent(word: string, sourceWord: string): boolean {
    const cleanWord = word.toLowerCase().replace(/[-_]/g, '');

    const commonPrefixes = [
      'pre', 're', 'un', 'dis', 'mis', 'over', 'under', 'out', 'up', 'in', 'on',
      'ex', 'de', 'anti', 'pro', 'co', 'inter', 'intra', 'trans', 'sub', 'super',
      'semi', 'multi', 'mega', 'micro', 'mini', 'auto', 'self', 'non', 'post',
      'fore', 'counter', 'cross', 'ultra', 'hyper', 'vice', 'quasi'
    ];

    const commonSuffixes = [
      'ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ness', 'ment', 'ful',
      'less', 'able', 'ible', 'ward', 'wise', 'like', 'ship', 'hood', 'dom',
      'age', 'ance', 'ence', 'ity', 'ous', 'ious', 'al', 'ic', 'ical'
    ];

    if (commonPrefixes.includes(cleanWord) || commonSuffixes.includes(cleanWord)) {
      return true;
    }

    if (sourceWord && sourceWord.toLowerCase().includes(cleanWord)) {
      const sourceClean = sourceWord.toLowerCase().replace(/[-_]/g, '');

      if (sourceClean.startsWith(cleanWord) && sourceClean.length > cleanWord.length + 1) {
        return true;
      }

      if (sourceClean.endsWith(cleanWord) && sourceClean.length > cleanWord.length + 1) {
        return true;
      }

      const hyphenatedPattern = new RegExp(`\\b${cleanWord}-\\w+|\\w+-${cleanWord}\\b`, 'i');
      if (hyphenatedPattern.test(sourceWord)) {
        return true;
      }
    }

    return false;
  }

  private isValidLanguageName(languageName: string): boolean {
    if (!languageName || languageName.length < 3) return false;

    if (!/^[A-Z]/.test(languageName)) return false;

    const invalidTerms = ['See', 'Also', 'From', 'Word', 'Root', 'Meaning', 'Definition'];
    if (invalidTerms.includes(languageName)) return false;

    return true;
  }

  private validateEtymologicalContext(text: string, matchIndex: number, languageName: string, etymologicalWord: string): ValidationResult {
    const contextSize = 100;
    const startIndex = Math.max(0, matchIndex - contextSize);
    const endIndex = Math.min(text.length, matchIndex + contextSize);
    const context = text.substring(startIndex, endIndex).toLowerCase();

    const positiveIndicators = [
      'from', 'etymology', 'origin', 'source', 'cognate', 'related to',
      'derives from', 'borrowed from', 'descended from', 'comes from',
      'via', 'through', 'root', 'stem', 'base'
    ];

    const negativeIndicators = [
      'meaning', 'definition', 'sense of', 'used to mean', 'refers to',
      'example', 'instance', 'such as', 'including', 'like',
      'compare', 'contrast', 'difference', 'similar'
    ];

    const morphologicalIndicators = [
      'prefix', 'suffix', 'compound', 'formed from', 'made up of',
      'consists of', 'combination of', 'composed of', 'compound word',
      'word formation', 'morphology', 'affix', 'element'
    ];

    let positiveScore = 0;
    let negativeScore = 0;
    let morphologicalScore = 0;

    for (const indicator of positiveIndicators) {
      if (context.includes(indicator)) positiveScore++;
    }

    for (const indicator of negativeIndicators) {
      if (context.includes(indicator)) negativeScore++;
    }

    for (const indicator of morphologicalIndicators) {
      if (context.includes(indicator)) morphologicalScore++;
    }

    if (languageName.startsWith('Proto-')) {
      positiveScore += 2;
    }

    if (languageName === 'Proto-Indo-European' || languageName.toLowerCase().includes('pie')) {
      positiveScore += 3;
      if (etymologicalWord.startsWith('*')) {
        positiveScore += 2;
      }
    }

    if (morphologicalScore > 0) {
      return {
        isValid: false,
        confidence: 0,
        reason: `Morphological analysis context detected (score: morphological:${morphologicalScore})`
      };
    }

    const confidence = Math.min(0.95, 0.6 + (positiveScore * 0.1) - (negativeScore * 0.05));

    if (positiveScore > negativeScore && confidence > 0.7) {
      return {
        isValid: true,
        confidence: confidence,
        notes: `Etymological context confirmed (score: +${positiveScore}/-${negativeScore})`
      };
    } else if (positiveScore > 0 && negativeScore === 0) {
      return {
        isValid: true,
        confidence: Math.max(0.6, confidence),
        notes: `Weak etymological context (score: +${positiveScore}/-${negativeScore})`
      };
    } else {
      return {
        isValid: false,
        confidence: 0,
        reason: `Insufficient etymological context (score: +${positiveScore}/-${negativeScore})`
      };
    }
  }

  private extractMarkedWords(sectionHTML: string, text: string, sourceWord: string): EtymologyConnection[] {
    const markedWords: EtymologyConnection[] = [];
    const seenWords = new Set<string>();

    try {
      const underlinedWords = this.extractUnderlinedEtymologies(sectionHTML, text, sourceWord);
      for (const word of underlinedWords) {
        const key = `${word.word.language}:${word.word.text}`;
        if (!seenWords.has(key)) {
          markedWords.push(word);
          seenWords.add(key);
        }
      }

      const italicizedWords = this.extractItalicizedEtymologies(sectionHTML, text, sourceWord);
      for (const word of italicizedWords) {
        const key = `${word.word.language}:${word.word.text}`;
        if (!seenWords.has(key)) {
          markedWords.push(word);
          seenWords.add(key);
        }
      }

      const hyperlinkedWords = this.extractContextualHyperlinkedEtymologies(sectionHTML, text, sourceWord);
      for (const word of hyperlinkedWords) {
        const key = `${word.word.language}:${word.word.text}`;
        if (!seenWords.has(key)) {
          markedWords.push(word);
          seenWords.add(key);
        }
      }

    } catch (error) {
      logError('Error extracting marked words', error, { sourceWord });
    }

    return markedWords;
  }

  private extractUnderlinedEtymologies(sectionHTML: string, text: string, sourceWord: string): EtymologyConnection[] {
    const etymologies: EtymologyConnection[] = [];

    try {
      const underlinePatterns = [
        /<u[^>]*>([^<]+)<\/u>/g,
        /<span[^>]*style="[^"]*underline[^"]*"[^>]*>([^<]+)<\/span>/g,
        /<span[^>]*class="[^"]*underline[^"]*"[^>]*>([^<]+)<\/span>/g
      ];

      for (const pattern of underlinePatterns) {
        let match;
        pattern.lastIndex = 0;

        while ((match = pattern.exec(sectionHTML)) !== null) {
          const underlinedWord = match[1].trim();

          if (underlinedWord === sourceWord || !this.isValidEtymologicalWord(underlinedWord, sourceWord)) {
            continue;
          }

          const wordIndex = text.indexOf(underlinedWord);
          if (wordIndex === -1) continue;

          const contextBefore = text.substring(Math.max(0, wordIndex - 80), wordIndex);
          const contextAfter = text.substring(wordIndex, Math.min(text.length, wordIndex + 80));
          const fullContext = contextBefore + contextAfter;

          const languageInfo = this.extractLanguageFromContext(contextBefore, underlinedWord);

          const validation = this.validateEtymologicalContext(fullContext, 50, languageInfo.languageName, underlinedWord);

          if (validation.isValid) {
            const relationshipType = this.determineRelationshipType(languageInfo.languageName, underlinedWord);

            etymologies.push({
              word: {
                id: this.generateId(),
                text: underlinedWord,
                language: languageInfo.languageCode,
                partOfSpeech: 'unknown',
                definition: `${languageInfo.languageName} etymological form of "${sourceWord}"`
              },
              relationship: {
                type: relationshipType,
                confidence: Math.min(validation.confidence + 0.1, 0.95),
                notes: `Underlined etymology: ${validation.notes}`,
                origin: `${languageInfo.languageName} ${underlinedWord}`,
                priority: 'high'
              }
            });
          }
        }
      }
    } catch (error) {
      logError('Error extracting underlined etymologies', error, { sourceWord });
    }

    return etymologies;
  }

  private extractContextualHyperlinkedEtymologies(sectionHTML: string, text: string, sourceWord: string): EtymologyConnection[] {
    const etymologies: EtymologyConnection[] = [];

    try {
      const linkPattern = /<a[^>]*href="\/word\/([^"]+)"[^>]*>([^<]+)<\/a>/g;
      let match;

      while ((match = linkPattern.exec(sectionHTML)) !== null) {
        const linkedWordSlug = match[1].trim();
        const linkedWordText = match[2].trim();

        if (linkedWordText === sourceWord || linkedWordSlug === sourceWord) continue;

        if (!this.isValidEtymologicalWord(linkedWordText, sourceWord)) continue;

        const wordIndex = text.indexOf(linkedWordText);
        if (wordIndex === -1) continue;

        const contextBefore = text.substring(Math.max(0, wordIndex - 200), wordIndex);
        const contextAfter = text.substring(wordIndex, Math.min(text.length, wordIndex + 200));
        const fullContext = contextBefore + contextAfter;

        const relatedWordPatterns = [
          /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+[^\s,;]+(?:\s*,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+[^\s,;]+)*/gi,
          /(?:compare|cf\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+[^\s,;]+/gi,
          /related\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+[^\s,;]+/gi
        ];

        let isRelatedWord = false;
        let detectedLanguage = 'English';
        let relationshipNotes = '';

        for (const pattern of relatedWordPatterns) {
          const relatedMatches = [...fullContext.matchAll(pattern)];
          for (const relatedMatch of relatedMatches) {
            if (relatedMatch[0].includes(linkedWordText)) {
              isRelatedWord = true;
              const langMatch = relatedMatch[0].match(new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\s+${this.escapeRegex(linkedWordText)}`, 'i'));
              if (langMatch) {
                detectedLanguage = langMatch[1].trim();
                relationshipNotes = `Related word mentioned in etymology: ${relatedMatch[0].trim()}`;
              }
              break;
            }
          }
          if (isRelatedWord) break;
        }

        let isInEtymologicalContext: ValidationResult;
        if (isRelatedWord) {
          isInEtymologicalContext = {
            isValid: true,
            confidence: 0.8,
            reason: 'Identified as related word in etymology listing'
          };
        } else {
          isInEtymologicalContext = this.isInStrictEtymologicalContext(fullContext, linkedWordText, wordIndex - Math.max(0, wordIndex - 200));
        }

        if (!isInEtymologicalContext.isValid) {
          continue;
        }

        let languageInfo: { languageName: string; languageCode: string };
        if (isRelatedWord && detectedLanguage !== 'English') {
          languageInfo = {
            languageName: detectedLanguage,
            languageCode: this.mapLanguageNameToCode(detectedLanguage)
          };
        } else {
          languageInfo = this.extractLanguageFromContext(contextBefore, linkedWordText);
        }

        if (linkedWordText.startsWith('*')) {
          languageInfo = {
            languageName: 'Proto-Indo-European',
            languageCode: 'ine-pro'
          };
        }

        const validation = this.validateEtymologicalContext(fullContext, 50, languageInfo.languageName, linkedWordText);

        if (validation.isValid || isRelatedWord) {
          const relationshipType = this.determineRelationshipType(languageInfo.languageName, linkedWordText);
          const baseConfidence = isRelatedWord ? 0.85 : validation.confidence;
          const finalConfidence = Math.min(baseConfidence * isInEtymologicalContext.confidence * 0.9, 0.95);

          etymologies.push({
            word: {
              id: this.generateId(),
              text: linkedWordText,
              language: languageInfo.languageCode,
              partOfSpeech: 'unknown',
              definition: `${languageInfo.languageName} ${isRelatedWord ? 'cognate' : 'etymological ancestor'} of "${sourceWord}"`
            },
            relationship: {
              type: relationshipType,
              confidence: finalConfidence,
              notes: relationshipNotes || `Contextually validated hyperlink: ${validation.notes}`,
              origin: `${languageInfo.languageName} ${linkedWordText}`,
              etymologyContext: `Hyperlinked to /word/${linkedWordSlug}`,
              priority: isRelatedWord ? 'high' : 'medium',
              isRelatedWord: isRelatedWord
            }
          });
        }
      }

      const rootLinkPattern = /<a[^>]*href="\/word\/(\*[^"]+)"[^>]*>([^<]+)<\/a>/g;
      let rootMatch;

      while ((rootMatch = rootLinkPattern.exec(sectionHTML)) !== null) {
        const rootSlug = rootMatch[1].trim();
        const rootText = rootMatch[2].trim();

        if (rootText === sourceWord) continue;

        if (etymologies.some(etym => etym.word.text === rootText && etym.word.language === 'ine-pro')) {
          continue;
        }

        const rootContext = text.substring(Math.max(0, text.indexOf(rootText) - 100), Math.min(text.length, text.indexOf(rootText) + 100));
        const validation = this.validateEtymologicalContext(rootContext, text.indexOf(rootText) - Math.max(0, text.indexOf(rootText) - 100), 'Proto-Indo-European', rootText);

        if (validation.isValid) {
          etymologies.push({
            word: {
              id: this.generateId(),
              text: rootText,
              language: 'ine-pro',
              partOfSpeech: 'root',
              definition: `Proto-Indo-European root of "${sourceWord}"`
            },
            relationship: {
              type: 'etymology',
              confidence: 0.95,
              notes: `Hyperlinked PIE root: ${validation.notes}`,
              origin: `Proto-Indo-European ${rootText}`,
              sharedRoot: rootText,
              etymologyContext: `Hyperlinked to /word/${rootSlug}`,
              priority: 'high'
            }
          });
        }
      }

    } catch (error) {
      logError('Error extracting hyperlinked etymologies', error, { sourceWord });
    }

    return etymologies;
  }

  private extractItalicizedEtymologies(sectionHTML: string, text: string, sourceWord: string): EtymologyConnection[] {
    const etymologies: EtymologyConnection[] = [];

    try {
      const italicPatterns = [
        /<i[^>]*>([^<]+)<\/i>/g,
        /<em[^>]*>([^<]+)<\/em>/g,
        /<span[^>]*style="[^"]*italic[^"]*"[^>]*>([^<]+)<\/span>/g
      ];

      for (const pattern of italicPatterns) {
        let match;
        pattern.lastIndex = 0;

        while ((match = pattern.exec(sectionHTML)) !== null) {
          const italicWord = match[1].trim();

          if (!this.isValidEtymologicalWord(italicWord, sourceWord)) continue;

          const wordIndex = text.indexOf(italicWord);
          if (wordIndex === -1) continue;

          const contextBefore = text.substring(Math.max(0, wordIndex - 80), wordIndex);
          const contextAfter = text.substring(wordIndex, Math.min(text.length, wordIndex + 80));

          const languageMatch = contextBefore.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+$/);

          if (languageMatch) {
            const languageName = languageMatch[1].trim();

            if (!this.isValidLanguageName(languageName)) continue;

            const fullContext = contextBefore + contextAfter;
            const validation = this.validateEtymologicalContext(fullContext, 40, languageName, italicWord);

            if (validation.isValid) {
              const languageCode = this.mapLanguageNameToCode(languageName);
              const relationshipType = this.determineRelationshipType(languageName, italicWord);

              etymologies.push({
                word: {
                  id: this.generateId(),
                  text: italicWord,
                  language: languageCode,
                  partOfSpeech: 'unknown',
                  definition: `${languageName} origin of "${sourceWord}" (from italics)`
                },
                relationship: {
                  type: relationshipType,
                  confidence: validation.confidence * 0.9,
                  notes: `Italicized etymology: ${validation.notes}`,
                  origin: `${languageName} ${italicWord}`,
                  etymologyContext: `Italicized form in ${languageName} context`
                }
              });
            }
          }
        }
      }
    } catch (error) {
      logError('Error extracting italicized etymologies', error, { sourceWord });
    }

    return etymologies;
  }

  private extractRelatedWords(html: string, sourceWord: string, sourceLanguage: string): EtymologyConnection[] {
    return [];
  }

  private mapLanguageNameToCode(languageName: string): string {
    const languageMap: { [key: string]: string } = {
      'Old French': 'fro',
      'Middle French': 'frm',
      'French': 'fr',
      'Latin': 'la',
      'Old English': 'ang',
      'Middle English': 'enm',
      'English': 'en',
      'Greek': 'grc',
      'Ancient Greek': 'grc',
      'German': 'de',
      'Old German': 'goh',
      'Old High German': 'goh',
      'Middle High German': 'gmh',
      'Proto-Germanic': 'gem-pro',
      'Germanic': 'gem',
      'Italian': 'it',
      'Spanish': 'es',
      'Portuguese': 'pt',
      'Dutch': 'nl',
      'Middle Dutch': 'dum',
      'Old Dutch': 'odt',
      'Old Frisian': 'ofs',
      'Frisian': 'fy',
      'West Frisian': 'fy',
      'Old Saxon': 'osx',
      'Saxon': 'nds',
      'Old Norse': 'non',
      'Norse': 'non',
      'Icelandic': 'is',
      'Gothic': 'got',
      'Proto-Indo-European': 'ine-pro',
      'Indo-European': 'ine',
      'Sanskrit': 'sa',
      'Hebrew': 'he',
      'Arabic': 'ar',
      'Slavonic': 'cu',
      'Old Church Slavonic': 'cu',
      'Russian': 'ru',
      'Polish': 'pl',
      'Czech': 'cs',
      'Lithuanian': 'lt',
      'Latvian': 'lv',
      'Welsh': 'cy',
      'Irish': 'ga',
      'Old Irish': 'sga',
      'Scottish Gaelic': 'gd',
      'Breton': 'br'
    };

    return languageMap[languageName] || languageName.toLowerCase().substring(0, 2);
  }

  private extractSharedRoot(text: string, languageName: string, relatedWord: string): string | null {
    const protoPattern = /\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+/g;
    const protoMatches = text.match(protoPattern);

    if (protoMatches && protoMatches.length > 0) {
      for (const protoForm of protoMatches) {
        const protoIndex = text.indexOf(protoForm);
        const wordIndex = text.indexOf(relatedWord);
        if (Math.abs(protoIndex - wordIndex) < 100) {
          return protoForm;
        }
      }
      return protoMatches[0];
    }

    const piePatterns = [
      /PIE\s+\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+/g,
      /PIE\s+root\s+\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+/g,
      /from\s+PIE\s+\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+/g,
      /Proto-Indo-European\s+\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+/g
    ];

    for (const piePattern of piePatterns) {
      const pieMatch = text.match(piePattern);
      if (pieMatch) {
        return pieMatch[0];
      }
    }

    const fromPattern = new RegExp(`from\\s+${languageName}\\s+([*\\w\\u00C0-\\u017F\\u0100-\\u017F\\u1E00-\\u1EFF]+)`, 'i');
    const fromMatch = text.match(fromPattern);
    if (fromMatch) {
      return `${languageName} ${fromMatch[1]}`;
    }

    const rootPatterns = [
      /root\s+\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+/g,
      /\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+\s+root/g,
      /\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+(?=\s|$|,|;)/g
    ];

    for (const rootPattern of rootPatterns) {
      const rootMatch = text.match(rootPattern);
      if (rootMatch) {
        const cleanRoot = rootMatch[0].replace(/\broot\s+/gi, '').replace(/\s+root\b/gi, '').trim();
        if (cleanRoot.startsWith('*')) {
          return cleanRoot;
        }
      }
    }

    return null;
  }

  private determineRelationshipType(languageName: string, relatedWord: string): string {
    if (languageName.includes('Proto-')) {
      return 'etymology';
    }

    const langLower = languageName.toLowerCase();

    if (['old english', 'old saxon', 'old frisian', 'old high german', 'old norse', 'gothic', 'proto-germanic'].includes(langLower)) {
      return 'cognate_germanic';
    }

    if (['latin', 'old french', 'middle french', 'proto-romance'].includes(langLower)) {
      return 'cognate_romance';
    }

    if (['old church slavonic', 'proto-slavic', 'russian', 'polish', 'czech'].includes(langLower)) {
      return 'cognate_slavic';
    }

    if (['old irish', 'welsh', 'breton', 'proto-celtic'].includes(langLower)) {
      return 'cognate_celtic';
    }

    if (['ancient greek', 'sanskrit', 'proto-indo-european', 'pie'].includes(langLower)) {
      return 'cognate_ancient';
    }

    return 'cognate';
  }

  private extractLanguageFromContext(contextBefore: string, word: string): { languageName: string; languageCode: string } {
    if (word.startsWith('*')) {
      return { languageName: 'Proto-Indo-European', languageCode: 'ine-pro' };
    }

    const languagePatterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+[\w*æœøþðɸβɟḱĝʷʲʼ-]+\s*$/,
      /from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+\*[\w-]+\s*$/
    ];

    let languageName = 'English';
    let languageCode = 'en';

    for (const pattern of languagePatterns) {
      const match = contextBefore.match(pattern);
      if (match && match[1]) {
        const detectedLanguage = match[1].trim();
        if (this.isValidLanguageName(detectedLanguage)) {
          languageName = detectedLanguage;
          languageCode = this.mapLanguageNameToCode(languageName);
          break;
        }
      }
    }

    return { languageName, languageCode };
  }

  private isInStrictEtymologicalContext(context: string, word: string, wordIndex: number): ValidationResult {
    const etymologicalPatterns = [
      /from\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+[\w*æœøþðɸβɟḱĝʷʲʼ-]+/i,
      /\b(from|via|through)\s+[A-Z]/i,
      /Proto-[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*\*[\w-]+/i,
      /PIE\s+\*[\w-]+/i,
      /\b(derives?|derived|comes?)\s+from/i,
      /\b(ancestor|origin|root)\b/i,
      /\b(cognate|related)\s+to/i,
      /\b(Old|Middle|Ancient|Proto-)\s*[A-Z][a-z]+/i
    ];

    const nonEtymologicalPatterns = [
      /\bin\s+(the\s+)?sense\s+of/i,
      /\bis\s+used\s+(in|for)/i,
      /\bmeaning\s+["']/i,
      /\bexample\s+of/i,
      /\bsuch\s+as/i,
      /\bincluding/i,
      /\brefers?\s+to/i,
      /\bdescribes?/i,
      /\bis\s+a\s+(type|kind|form)\s+of/i,
      /\bknown\s+as/i,
      /\bcalled/i
    ];

    const wordContext = context.substring(Math.max(0, wordIndex - 50), Math.min(context.length, wordIndex + 50));

    for (const pattern of nonEtymologicalPatterns) {
      if (pattern.test(wordContext)) {
        return {
          isValid: false,
          confidence: 0.1,
          reason: `Word appears in non-etymological context: ${pattern.source}`
        };
      }
    }

    let etymologicalScore = 0;
    const matchedPatterns: string[] = [];

    for (const pattern of etymologicalPatterns) {
      if (pattern.test(wordContext)) {
        etymologicalScore += 1;
        matchedPatterns.push(pattern.source);
      }
    }

    if (wordContext.includes('from ')) etymologicalScore += 0.5;
    if (wordContext.includes('*')) etymologicalScore += 0.3;
    if (wordContext.match(/\b(c\.|circa|about)\s+\d/)) etymologicalScore += 0.2;

    const confidence = Math.min(etymologicalScore / 2, 1.0);

    if (etymologicalScore >= 1) {
      return {
        isValid: true,
        confidence: confidence,
        reason: `Found etymological context patterns: ${matchedPatterns.join(', ')}`
      };
    } else {
      return {
        isValid: false,
        confidence: confidence,
        reason: `Insufficient etymological indicators (score: ${etymologicalScore})`
      };
    }
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isRelevantEtymologySection(sectionText: string, targetWord: string): boolean {
    const cleanSectionText = sectionText
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const firstTenWords = cleanSectionText.split(/\s+/).slice(0, 10).join(' ').toLowerCase();
    const targetLower = targetWord.toLowerCase();
    const sectionLower = cleanSectionText.toLowerCase();

    if (targetWord.startsWith('*')) {
      const rootWithoutAsterisk = targetLower.replace('*', '');

      const piePatterns = [
        targetLower,
        rootWithoutAsterisk,
        `${targetLower} (`,
        `${rootWithoutAsterisk} (`,
        `pie root ${targetLower}`,
        `pie root ${rootWithoutAsterisk}`,
        `root ${targetLower}`,
        `root ${rootWithoutAsterisk}`,
        `proto-indo-european ${targetLower}`,
        `proto-indo-european ${rootWithoutAsterisk}`
      ];

      for (const pattern of piePatterns) {
        if (sectionLower.includes(pattern)) {
          return true;
        }
      }

      const rootMatches = [
        new RegExp(`\\*?${this.escapeRegex(rootWithoutAsterisk)}\\s*\\(`, 'i'),
        new RegExp(`\\b\\*?${this.escapeRegex(rootWithoutAsterisk)}\\b`, 'i'),
        new RegExp(`\\b(?:pie|proto|root|etymology)\\s+\\*?${this.escapeRegex(rootWithoutAsterisk)}`, 'i')
      ];

      for (const pattern of rootMatches) {
        if (pattern.test(sectionLower)) {
          return true;
        }
      }

      return false;
    }

    if (firstTenWords.includes(targetLower)) {
      return true;
    }

    const variants = [
      targetLower,
      targetLower + '.',
      targetLower + ' (',
      targetLower + ','
    ];

    return variants.some(variant => firstTenWords.includes(variant));
  }

  private detectShortenedWordRelationships(text: string, sourceWord: string): EtymologyConnection[] {
    const connections: EtymologyConnection[] = [];

    try {
      const shorteningPatterns = [
        /(?:shortening|abbreviation|short)\s+of\s+([a-zA-Z]+)/gi,
        /shortened\s+from\s+([a-zA-Z]+)/gi,
        /short\s+for\s+([a-zA-Z]+)/gi,
        /(?:clipped|clipping)\s+(?:from|of)\s+([a-zA-Z]+)/gi,
        /truncation\s+of\s+([a-zA-Z]+)/gi,
        /from\s+([a-zA-Z]+)[^.]*shortened/gi
      ];

      for (const pattern of shorteningPatterns) {
        let match;
        pattern.lastIndex = 0;

        while ((match = pattern.exec(text)) !== null) {
          const fullWord = match[1].trim().toLowerCase();

          if (fullWord === sourceWord.toLowerCase()) continue;

          if (!this.isValidEtymologicalWord(fullWord, sourceWord)) continue;

          const connection: EtymologyConnection = {
            word: {
              id: this.generateId(),
              text: fullWord,
              language: 'en',
              partOfSpeech: 'full_form',
              definition: `Full form of "${sourceWord}"`
            },
            relationship: {
              type: 'shortened_from',
              confidence: 0.9,
              notes: `"${sourceWord}" is a shortening of "${fullWord}"`,
              origin: `Full form: ${fullWord}`,
              sharedRoot: fullWord,
              shorteningContext: match[0].trim()
            }
          };

          connections.push(connection);
        }
      }

    } catch (error) {
      logError('Error detecting shortened word relationships', error, { sourceWord });
    }

    return connections;
  }

  private extractPIERootDerivatives(text: string, pieRoot: string): EtymologyConnection[] {
    const derivatives: EtymologyConnection[] = [];

    try {
      const derivativePatterns = [
        /It\s+(?:forms|might\s+form)\s+all\s+or\s+part\s+of:\s*([^]*?)(?:\n\s*It\s|\n\s*Etymology|\n\s*From|\n\s*Related|\n\s*See|\n\s*Also\s|\n\s*Entries|\n\s*$|$)/gi,
        /source\s+also\s+of\s+([^]*?)(?:\n\s*It\s|\n\s*Etymology|\n\s*From|\n\s*Related|\n\s*See|\n\s*Also\s|\n\s*Entries|\n\s*$|$)/gi,
        /cognate\s+with\s+([^]*?)(?:\n\s*It\s|\n\s*Etymology|\n\s*From|\n\s*Related|\n\s*See|\n\s*Also\s|\n\s*Entries|\n\s*$|$)/gi,
        /related\s+to\s+([^]*?)(?:\n\s*It\s|\n\s*Etymology|\n\s*From|\n\s*Related|\n\s*See|\n\s*Also\s|\n\s*Entries|\n\s*$|$)/gi
      ];

      const foundWords = new Set<string>();

      for (const pattern of derivativePatterns) {
        let match;
        pattern.lastIndex = 0;

        while ((match = pattern.exec(text)) !== null) {
          if (match[1]) {
            const wordList = match[1];

            const words = wordList.split(/[,;]+/)
              .map(word => {
                return word.replace(/\s*\([^)]*\)\s*/g, '').replace(/["']/g, '').replace(/\s+/g, ' ').trim();
              })
              .filter(word => {
                if (word.length < 2) return false;
                if (!/^[a-zA-Z][a-zA-Z-]*[a-zA-Z]?$/.test(word)) return false;
                if (this.isCommonWord(word)) return false;
                if (word === pieRoot.replace('*', '')) return false;

                return true;
              });

            for (const word of words) {
              const cleanWord = word.toLowerCase().trim();
              if (cleanWord && !foundWords.has(cleanWord)) {
                foundWords.add(cleanWord);

                const language = 'en';
                const wordText = cleanWord;

                derivatives.push({
                  word: {
                    id: this.generateId(),
                    text: wordText,
                    language: language,
                    partOfSpeech: 'unknown',
                    definition: `Derivative of PIE root ${pieRoot}`
                  },
                  relationship: {
                    type: 'pie_derivative',
                    confidence: 0.85,
                    notes: `Derived from PIE root ${pieRoot}`,
                    origin: pieRoot,
                    sharedRoot: pieRoot,
                    derivativeContext: match[0].trim()
                  }
                });
              }
            }
          }
        }
      }

    } catch (error) {
      logError('Error extracting PIE root derivatives', error, { pieRoot });
    }

    return derivatives;
  }

  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'also', 'see', 'all', 'any', 'some', 'many', 'more', 'most', 'much',
      'such', 'same', 'other', 'than', 'only', 'very', 'well', 'old', 'new', 'first',
      'last', 'long', 'great', 'little', 'own', 'way', 'use', 'man', 'day', 'get',
      'has', 'had', 'his', 'her', 'she', 'him', 'not', 'now', 'how', 'may', 'say',
      'each', 'which', 'their', 'time', 'will', 'about', 'out', 'up', 'them', 'make',
      'can', 'like', 'into', 'year', 'your', 'come', 'could', 'now', 'over', 'think'
    ];

    return commonWords.includes(word.toLowerCase());
  }

  private generateId(): string {
    return 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  private updateEtymologyDatabase(sourceWord: string, etymologyData: EtymologyData): void {
    if (!etymologyData || !etymologyData.connections) return;

    this.processedWords.add(sourceWord);

    if (!this.shortenedFormsDatabase) {
      this.shortenedFormsDatabase = new Map();
    }

    for (const connection of etymologyData.connections) {
      const { word: etimWord, relationship } = connection;

      if (relationship.type === 'shortened_from') {
        if (!this.shortenedFormsDatabase.has(etimWord.text.toLowerCase())) {
          this.shortenedFormsDatabase.set(etimWord.text.toLowerCase(), []);
        }
        const shortenedForms = this.shortenedFormsDatabase.get(etimWord.text.toLowerCase())!;
        if (!shortenedForms.some(form => form.word === sourceWord)) {
          shortenedForms.push({
            word: sourceWord,
            confidence: relationship.confidence,
            notes: relationship.notes
          });
        }
      }

      const sharedRoot = relationship.sharedRoot || relationship.origin || etimWord.text;
      if (!etimWord || !etimWord.text || !sharedRoot) continue;

      const etymologyKey = this.normalizeEtymologyKey(sharedRoot);

      if (!this.etymologyDatabase.has(etymologyKey)) {
        this.etymologyDatabase.set(etymologyKey, []);
      }

      const wordEntry: WordEntry = {
        word: sourceWord,
        language: 'en',
        etymologicalForm: etimWord.text,
        etymologicalLanguage: etimWord.language,
        relationshipType: relationship.type,
        confidence: relationship.confidence,
        notes: relationship.notes,
        sharedRoot: sharedRoot
      };

      const existingEntries = this.etymologyDatabase.get(etymologyKey)!;
      if (!existingEntries.some(entry => entry.word === sourceWord)) {
        existingEntries.push(wordEntry);
      }
    }
  }

  private normalizeEtymologyKey(etymologyString: string): string {
    if (!etymologyString) return '';

    let normalized = etymologyString.trim();

    const pieRootMatch = normalized.match(/\*([a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/);
    if (pieRootMatch) {
      return '*' + pieRootMatch[1].toLowerCase();
    }

    normalized = normalized
      .replace(/^(Proto-Indo-European|PIE)\s+/i, '')
      .replace(/^(Proto-[A-Za-z-]+|Old [A-Za-z]+|Middle [A-Za-z]+|Ancient [A-Za-z]+|[A-Za-z]+)\s+/i, '')
      .trim()
      .toLowerCase();

    if (normalized.startsWith('*')) {
      return normalized;
    }

    normalized = normalized.replace(/[.,;:!?]+$/, '');

    return normalized;
  }

  private enhanceWithCrossReferences(etymologyData: EtymologyData, sourceWord: string): EtymologyData {
    if (!etymologyData || !etymologyData.connections) return etymologyData;

    const enhanced = { ...etymologyData };
    enhanced.crossReferences = [];
    const addedConnections: EtymologyConnection[] = [];

    for (const connection of etymologyData.connections) {
      const { relationship } = connection;

      const sharedRoot = relationship.sharedRoot || relationship.origin;
      if (!sharedRoot) continue;

      const etymologyKey = this.normalizeEtymologyKey(sharedRoot);
      const relatedWords = this.etymologyDatabase.get(etymologyKey);

      if (relatedWords && relatedWords.length > 1) {
        const potentialCognates = relatedWords
          .filter(entry => entry.word !== sourceWord)
          .map(entry => ({
            word: entry.word,
            language: entry.language,
            etymologicalForm: entry.etymologicalForm,
            relationshipType: 'cognate_cross_reference',
            sharedRoot: sharedRoot,
            confidence: Math.min(0.75, entry.confidence),
            notes: `Shares etymology ${sharedRoot} with ${sourceWord}`
          }));

        const validCognates = potentialCognates.filter(cognate => {
          if (this.areSemanticallySuspicious(cognate.word, sourceWord)) {
            return false;
          }

          if (cognate.confidence < 0.65) {
            return false;
          }

          return true;
        });

        if (validCognates.length > 0) {
          enhanced.crossReferences.push({
            sharedRoot: sharedRoot,
            cognateWords: validCognates,
            totalCognates: validCognates.length
          });

          const topCognates = validCognates
            .filter(cognate => cognate.confidence > 0.75)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 2);

          for (const cognate of topCognates) {
            if (this.isValidCrossReferenceConnection(sourceWord, cognate.word, sharedRoot)) {
              const bidirectionalConnection: EtymologyConnection = {
                word: {
                  id: this.generateId(),
                  text: cognate.word,
                  language: cognate.language,
                  partOfSpeech: 'cognate',
                  definition: `Related to "${sourceWord}" through shared root "${sharedRoot}"`
                },
                relationship: {
                  type: 'etymological_cognate',
                  confidence: Math.min(cognate.confidence * 0.9, 0.85),
                  notes: cognate.notes,
                  origin: sharedRoot,
                  sharedRoot: sharedRoot,
                  isFromCrossReference: true
                }
              };
              addedConnections.push(bidirectionalConnection);
            }
          }
        }
      }
    }

    if (this.shortenedFormsDatabase && this.shortenedFormsDatabase.has(sourceWord.toLowerCase())) {
      const shortenedForms = this.shortenedFormsDatabase.get(sourceWord.toLowerCase())!;

      for (const shortenedForm of shortenedForms) {
        if (shortenedForm.confidence > 0.8 && !this.areSemanticallySuspicious(shortenedForm.word, sourceWord)) {
          const reverseConnection: EtymologyConnection = {
            word: {
              id: this.generateId(),
              text: shortenedForm.word,
              language: 'en',
              partOfSpeech: 'shortened_form',
              definition: `Shortened form of "${sourceWord}"`
            },
            relationship: {
              type: 'shortened_to',
              confidence: Math.min(shortenedForm.confidence, 0.9),
              notes: `"${shortenedForm.word}" is a shortened form of "${sourceWord}"`,
              origin: `Shortened form: ${shortenedForm.word}`,
              sharedRoot: sourceWord,
              isFromShortenedDatabase: true
            }
          };
          addedConnections.push(reverseConnection);
        }
      }
    }

    enhanced.connections = [...(enhanced.connections || []), ...addedConnections];

    return enhanced;
  }

  private isValidCrossReferenceConnection(sourceWord: string, targetWord: string, sharedRoot: string): boolean {
    if (!sourceWord || !targetWord || !sharedRoot) {
      return false;
    }

    if (sourceWord.toLowerCase() === targetWord.toLowerCase()) {
      return false;
    }

    if (this.areSemanticallySuspicious(sourceWord, targetWord)) {
      return false;
    }

    const cleanRoot = this.normalizeEtymologyKey(sharedRoot);
    if (cleanRoot.length < 3) {
      return false;
    }

    const genericRoots = ['*er', '*ed', '*in', '*on', '*an', '*el', 'the', 'and', 'from'];
    if (genericRoots.includes(cleanRoot.toLowerCase())) {
      return false;
    }

    return true;
  }

  async findEtymologicalCognates(word: string, minConfidence: number = 0.7): Promise<any[]> {
    const wordData = await this.fetchEtymologyData(word);
    if (!wordData || !wordData.connections) return [];

    const cognateGroups = [];

    for (const connection of wordData.connections) {
      const { relationship } = connection;

      if (!relationship.sharedRoot || relationship.confidence < minConfidence) continue;

      const etymologyKey = this.normalizeEtymologyKey(relationship.sharedRoot);
      const relatedWords = this.etymologyDatabase.get(etymologyKey);

      if (relatedWords && relatedWords.length > 1) {
        const cognates = relatedWords
          .filter(entry => entry.word !== word && entry.confidence >= minConfidence)
          .sort((a, b) => b.confidence - a.confidence);

        if (cognates.length > 0) {
          cognateGroups.push({
            sharedRoot: relationship.sharedRoot,
            etymologyKey: etymologyKey,
            cognates: cognates,
            sourceConnection: relationship
          });
        }
      }
    }

    return cognateGroups;
  }

  getEtymologyDatabaseStats(): any {
    const totalEtymologies = this.etymologyDatabase.size;
    const totalWords = this.processedWords.size;
    const cognateGroups = Array.from(this.etymologyDatabase.entries())
      .filter(([key, words]) => words.length > 1)
      .length;

    return {
      totalEtymologicalOrigins: totalEtymologies,
      totalProcessedWords: totalWords,
      cognateGroups: cognateGroups,
      averageWordsPerOrigin: totalWords / Math.max(1, totalEtymologies)
    };
  }

  clearAllCaches(): void {
    cache.flushAll();
    this.etymologyDatabase.clear();
    this.processedWords.clear();
    if (this.shortenedFormsDatabase) {
      this.shortenedFormsDatabase.clear();
    }
  }

  clearWordCache(word: string, language: string = 'en'): void {
    const cacheKey = `etymonline_${word}_${language}`;
    cache.del(cacheKey);
  }
}

export default new EtymonlineAPI();
