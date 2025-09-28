import { randomUUID } from 'crypto';
import NodeCache from 'node-cache';
import { Word, Connection, EtymologyData, WiktionaryData, DictionaryApiData, EtymonlineData } from '../types';

const wiktionaryAPI = require('./wiktionaryAPI');
const dictionaryAPI = require('./dictionaryAPI');
const etymonlineAPI = require('./etymonlineAPI');
const cognateService = require('./cognateService');

const cache = new NodeCache({ stdTTL: 3600 });

interface NormalizedConnection {
  word: Word;
  relationship: {
    type: string;
    confidence: number;
    notes?: string;
    origin?: string;
    sharedRoot?: string;
    priority?: string;
    source?: string;
  };
}

interface CognateResult {
  word: string;
  language: string;
  confidence: number;
  semanticField?: string;
  concept?: string;
  notes?: string;
}

class EtymologyService {
  async findEtymologicalConnections(word: string, language: string = 'en', bypassCache: boolean = false): Promise<EtymologyData> {
    const normalizedWord = (word || '').trim();
    if (!normalizedWord) {
      throw new Error('Word parameter is required');
    }

    const normalizedLanguage = (language || 'en').toLowerCase();
    const cacheKey = `${normalizedLanguage}:${normalizedWord.toLowerCase()}`;

    if (!bypassCache) {
      const cached = cache.get<EtymologyData>(cacheKey);
      if (cached) {
        console.log(`Using cached etymology data for "${normalizedWord}"`);
        return cached;
      }
    }

    const [wiktionaryResult, dictionaryResult, etymonlineResult] = await Promise.allSettled([
      wiktionaryAPI.fetchWiktionaryData(normalizedWord, normalizedLanguage),
      dictionaryAPI.fetchEntry(normalizedWord, normalizedLanguage),
      etymonlineAPI.fetchEtymologyData(normalizedWord, normalizedLanguage)
    ]);

    if (wiktionaryResult.status === 'rejected') {
      console.error(`Wiktionary lookup failed for "${normalizedWord}":`, wiktionaryResult.reason);
    }
    if (dictionaryResult.status === 'rejected') {
      console.error(`Dictionary lookup failed for "${normalizedWord}":`, dictionaryResult.reason);
    }
    if (etymonlineResult.status === 'rejected') {
      console.error(`Etymonline lookup failed for "${normalizedWord}":`, etymonlineResult.reason);
    }

    const wiktionaryData: WiktionaryData | null = wiktionaryResult.status === 'fulfilled' ? wiktionaryResult.value : null;
    const dictionaryData: DictionaryApiData | null = dictionaryResult.status === 'fulfilled' ? dictionaryResult.value : null;
    const etymonlineData: EtymonlineData | null = etymonlineResult.status === 'fulfilled' ? etymonlineResult.value : null;

    const sourceWord = this.buildSourceWord(normalizedWord, normalizedLanguage, wiktionaryData, dictionaryData);

    const connections: NormalizedConnection[] = [];

    // PRIORITY 1: Add etymonline connections first (highest quality)
    if (etymonlineData && Array.isArray((etymonlineData as any).connections)) {
      console.log(`Adding ${(etymonlineData as any).connections.length} HIGH-PRIORITY connections from etymonline`);
      for (const connection of (etymonlineData as any).connections) {
        const normalizedConnection = this.normalizeConnection(sourceWord, connection);
        if (normalizedConnection) {
          // Boost confidence for etymonline data
          if (normalizedConnection.relationship.confidence) {
            normalizedConnection.relationship.confidence = Math.min(
              normalizedConnection.relationship.confidence + 0.1,
              0.95
            );
          }
          normalizedConnection.relationship.priority = 'high';
          normalizedConnection.relationship.source = 'etymonline.com';
          connections.push(normalizedConnection);
        }
      }
    }

    // PRIORITY 2: Add wiktionary connections
    if (wiktionaryData && Array.isArray((wiktionaryData as any).connections)) {
      for (const connection of (wiktionaryData as any).connections) {
        const normalizedConnection = this.normalizeConnection(sourceWord, connection);
        if (normalizedConnection) {
          normalizedConnection.relationship.priority = 'medium';
          normalizedConnection.relationship.source = 'wiktionary';
          connections.push(normalizedConnection);
        }
      }
    }

    // PRIORITY 3: Add dictionary API connections
    if (dictionaryData && typeof (dictionaryData as any).origin === 'string' && (dictionaryData as any).origin.trim().length > 0) {
      const originConnections = this.connectionsFromOrigin((dictionaryData as any).origin, sourceWord);
      originConnections.forEach(conn => {
        conn.relationship.priority = 'low';
        conn.relationship.source = 'dictionary-api';
      });
      connections.push(...originConnections);
    }

    // RE-ENABLED: Add cognate connections with improved filtering
    try {
      const languages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'la', 'gr', 'ru', 'pl', 'nl', 'da', 'sv', 'no'];
      const cognates: CognateResult[] = await cognateService.findCognates(normalizedWord, normalizedLanguage, languages);

      // Apply enhanced filtering to cognate results
      const validCognates = cognates.filter(cognate => {
        // Only include high-confidence direct cognates
        if (cognate.confidence < 0.85) return false;

        // Only include cognates from known semantic fields (not synthetic sound changes)
        if (!cognate.semanticField || !cognate.concept) return false;

        // Validate the cognate makes linguistic sense
        return this.isValidCognateConnection(normalizedWord, cognate.word, normalizedLanguage, cognate.language);
      });

      if (validCognates.length > 0) {
        console.log(`Adding ${validCognates.length} validated cognates for "${normalizedWord}"`);
        const cognateConnections: NormalizedConnection[] = validCognates.map(cognate => ({
          word: {
            id: this.generateId(),
            text: cognate.word,
            language: cognate.language,
            partOfSpeech: 'unknown',
            definition: `${cognateService.getLanguageName(cognate.language)} cognate of "${normalizedWord}"`
          },
          relationship: {
            type: 'cognate',
            confidence: cognate.confidence,
            notes: cognate.notes,
            origin: cognate.semanticField ? `${cognate.concept} (${cognate.semanticField})` : undefined,
            sharedRoot: cognate.concept || undefined,
            priority: 'medium'
          }
        }));

        connections.push(...cognateConnections);
      } else {
        console.log(`No valid cognates found for "${normalizedWord}" after filtering`);
      }
    } catch (error) {
      console.error(`Cognate lookup failed for "${normalizedWord}":`, error);
    }

    // Filter out trivial same-language derivatives before deduplication
    const filtered = connections.filter(connection => {
      return !this.isTrivialDerivative(sourceWord.text, connection.word.text, sourceWord.language, connection.word.language);
    });

    // Enhanced deduplication with priority preservation and similarity grouping
    const deduplicatedConnections = this.deduplicateConnections(filtered);

    const result: EtymologyData = {
      sourceWord,
      connections: deduplicatedConnections.map(conn => ({
        word: conn.word,
        type: conn.relationship.type,
        confidence: conn.relationship.confidence,
        source: conn.relationship.source || 'unknown',
        notes: conn.relationship.notes
      }))
    };

    console.log(`Found ${result.connections.length} connections for "${normalizedWord}" (${normalizedLanguage})`);

    if (!bypassCache) {
      cache.set(cacheKey, result);
    }

    return result;
  }

  buildSourceWord(word: string, language: string, wiktionaryData?: WiktionaryData | null, dictionaryData?: DictionaryApiData | null): Word {
    return {
      id: this.generateId(),
      text: word,
      language: language,
      definition: this.extractDefinition(wiktionaryData, dictionaryData),
      phonetic: this.extractPhonetic(wiktionaryData, dictionaryData),
      etymologies: this.extractEtymologies(wiktionaryData),
      partOfSpeech: this.extractPartOfSpeech(wiktionaryData, dictionaryData)
    };
  }

  normalizeConnection(sourceWord: Word, connection: any): NormalizedConnection | null {
    if (!connection || !connection.word) {
      return null;
    }

    try {
      const word: Word = {
        id: connection.word.id || this.generateId(),
        text: (connection.word.text || connection.word.word || '').toString().trim(),
        language: this.normalizeLanguageCode(connection.word.language || connection.language || 'und'),
        definition: connection.word.definition || undefined,
        phonetic: connection.word.phonetic || undefined,
        partOfSpeech: connection.word.partOfSpeech || 'unknown'
      };

      if (!word.text) {
        return null;
      }

      return {
        word,
        relationship: {
          type: connection.relationship?.type || connection.type || 'related',
          confidence: Math.max(0.1, Math.min(1.0, Number(connection.relationship?.confidence || connection.confidence || 0.5))),
          notes: connection.relationship?.notes || connection.notes || undefined,
          origin: connection.relationship?.origin || connection.origin || undefined,
          sharedRoot: connection.relationship?.sharedRoot || connection.sharedRoot || undefined
        }
      };
    } catch (error) {
      console.error('Error normalizing connection:', error);
      return null;
    }
  }

  connectionsFromOrigin(origin: string, sourceWord: Word): NormalizedConnection[] {
    const connections: NormalizedConnection[] = [];
    const originText = origin.toLowerCase();

    // Extract language/word patterns from origin text
    const patterns = [
      /from\s+(\w+)\s+[""']([^""']+)[""']/gi,
      /(\w+)\s+[""']([^""']+)[""']/gi,
      /from\s+(\w+)\s+(\w+)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(originText)) !== null) {
        const [, lang, word] = match;
        if (word && word.length > 1) {
          connections.push({
            word: {
              id: this.generateId(),
              text: word.trim(),
              language: this.normalizeLanguageCode(lang),
              partOfSpeech: 'unknown',
              definition: `From ${this.getLanguageDisplay(this.normalizeLanguageCode(lang))}`
            },
            relationship: {
              type: 'derivation',
              confidence: 0.6,
              notes: `Derived from ${lang}`,
              origin: origin
            }
          });
        }
      }
    }

    return connections;
  }

  private deduplicateConnections(connections: NormalizedConnection[]): NormalizedConnection[] {
    const seen = new Map<string, NormalizedConnection>();

    for (const connection of connections) {
      const key = `${connection.word.text.toLowerCase()}:${connection.word.language}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, connection);
      } else {
        // Keep the connection with higher confidence
        if (connection.relationship.confidence > existing.relationship.confidence) {
          seen.set(key, connection);
        }
      }
    }

    return Array.from(seen.values());
  }

  private isTrivialDerivative(sourceWord: string, targetWord: string, sourceLang: string, targetLang: string): boolean {
    if (sourceLang !== targetLang) return false;

    const source = sourceWord.toLowerCase();
    const target = targetWord.toLowerCase();

    // Simple suffixes that don't add meaningful etymological value
    const trivialSuffixes = ['s', 'es', 'ed', 'ing', 'er', 'est', 'ly'];

    for (const suffix of trivialSuffixes) {
      if (target === source + suffix || source === target + suffix) {
        return true;
      }
    }

    return false;
  }

  private isValidCognateConnection(sourceWord: string, cognateWord: string, sourceLang: string, cognateLang: string): boolean {
    if (sourceLang === cognateLang) return false;

    const sourceLower = sourceWord.toLowerCase();
    const cognateLower = cognateWord.toLowerCase();

    if (Math.abs(sourceLower.length - cognateLower.length) > 4) return false;

    const commonChars = new Set([...sourceLower].filter(char => cognateLower.includes(char)));
    const similarity = commonChars.size / Math.max(sourceLower.length, cognateLower.length);

    if (similarity < 0.25) return false;

    return this.areLanguageCompatible(sourceLang, cognateLang, 'cognate');
  }

  private areLanguageCompatible(lang1: string, lang2: string, connectionType: string): boolean {
    // Simple compatibility check - in a real implementation this would be more sophisticated
    const indoEuropean = ['en', 'es', 'fr', 'de', 'it', 'pt', 'la', 'gr', 'ru', 'pl', 'nl', 'da', 'sv', 'no'];

    if (connectionType === 'cognate') {
      return indoEuropean.includes(lang1) && indoEuropean.includes(lang2);
    }

    return true;
  }

  private extractDefinition(wiktionaryData?: WiktionaryData | null, dictionaryData?: DictionaryApiData | null): string | undefined {
    if (wiktionaryData?.definitions && wiktionaryData.definitions.length > 0) {
      return wiktionaryData.definitions[0];
    }
    if (dictionaryData?.meanings && dictionaryData.meanings.length > 0 &&
        dictionaryData.meanings[0].definitions && dictionaryData.meanings[0].definitions.length > 0) {
      return dictionaryData.meanings[0].definitions[0].definition;
    }
    return undefined;
  }

  private extractPhonetic(wiktionaryData?: WiktionaryData | null, dictionaryData?: DictionaryApiData | null): string | undefined {
    if (dictionaryData?.phonetic) {
      return dictionaryData.phonetic;
    }
    if (wiktionaryData?.pronunciations && wiktionaryData.pronunciations.length > 0) {
      return wiktionaryData.pronunciations[0];
    }
    return undefined;
  }

  private extractEtymologies(wiktionaryData?: WiktionaryData | null): string[] | undefined {
    return wiktionaryData?.etymologies;
  }

  private extractPartOfSpeech(wiktionaryData?: WiktionaryData | null, dictionaryData?: DictionaryApiData | null): string | undefined {
    if (wiktionaryData?.partOfSpeech) {
      return wiktionaryData.partOfSpeech;
    }
    if (dictionaryData?.meanings && dictionaryData.meanings.length > 0) {
      return dictionaryData.meanings[0].partOfSpeech;
    }
    return 'unknown';
  }

  private normalizeLanguageCode(languageInput: string): string {
    const normalized = (languageInput || '').toLowerCase().trim();

    const mapping: [string, string][] = [
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

    for (const [prefix, code] of mapping) {
      if (normalized.startsWith(prefix)) {
        return code;
      }
    }

    if (normalized.includes('proto')) {
      return 'proto';
    }

    return 'und';
  }

  private getLanguageDisplay(code: string): string {
    const normalized = (code || '').toLowerCase();
    const names: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      nl: 'Dutch',
      la: 'Latin',
      gr: 'Greek',
      sa: 'Sanskrit',
      non: 'Old Norse',
      'gem-pro': 'Proto-Germanic',
      'ine-pro': 'Proto-Indo-European',
      proto: 'Proto Language',
      cel: 'Celtic',
      ar: 'Arabic',
      und: 'Unknown'
    };

    return names[normalized] || code;
  }

  private generateId(): string {
    return randomUUID();
  }

  // Clear all caches for consistent behavior
  clearAllCaches(): void {
    cache.flushAll();
    // Also clear etymonline API caches
    if (etymonlineAPI && typeof etymonlineAPI.clearAllCaches === 'function') {
      etymonlineAPI.clearAllCaches();
    }
    console.log('All etymology service caches cleared');
  }

  // Clear cache for a specific word
  clearWordCache(word: string, language: string = 'en'): void {
    const normalizedWord = word.trim();
    const normalizedLanguage = language.toLowerCase();
    const cacheKey = `${normalizedLanguage}:${normalizedWord.toLowerCase()}`;

    cache.del(cacheKey);

    // Also clear etymonline API cache for this word
    if (etymonlineAPI && typeof etymonlineAPI.clearWordCache === 'function') {
      etymonlineAPI.clearWordCache(normalizedWord, normalizedLanguage);
    }

    console.log(`Cache cleared for "${normalizedWord}" (${normalizedLanguage})`);
  }
}

export default new EtymologyService();