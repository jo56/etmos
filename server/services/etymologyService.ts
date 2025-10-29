import { randomUUID } from 'crypto';
import NodeCache from 'node-cache';
import { Word, Connection, EtymologyData, WiktionaryData, DictionaryApiData, EtymonlineData } from '../types';
import { normalizeLanguageCode, getLanguageName } from '../../shared/constants/languages';
import { getRomanceRoot, getGermanicRoot, areRootsRelated } from '../../shared/utils/etymologyUtils';
import { ETYMOLOGY_SERVICE_CACHE_CONFIG } from '../config/cache';
import { logger } from '../utils/logger';

import wiktionaryAPI from './wiktionaryAPI';
import dictionaryAPI from './dictionaryAPI';
import etymonlineAPI from './etymonlineAPI';
import cognateService from './cognateService';

const cache = new NodeCache(ETYMOLOGY_SERVICE_CACHE_CONFIG);

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
        logger.debug(`Using cached etymology data for "${normalizedWord}"`);
        return cached;
      }
    }

    const [wiktionaryResult, dictionaryResult, etymonlineResult] = await Promise.allSettled([
      wiktionaryAPI.fetchWiktionaryData(normalizedWord, normalizedLanguage),
      dictionaryAPI.fetchEntry(normalizedWord, normalizedLanguage),
      etymonlineAPI.fetchEtymologyData(normalizedWord, normalizedLanguage)
    ]);

    if (wiktionaryResult.status === 'rejected') {
      logger.warn(`Wiktionary lookup failed for "${normalizedWord}":`, wiktionaryResult.reason);
    }
    if (dictionaryResult.status === 'rejected') {
      logger.warn(`Dictionary lookup failed for "${normalizedWord}":`, dictionaryResult.reason);
    }
    if (etymonlineResult.status === 'rejected') {
      logger.warn(`Etymonline lookup failed for "${normalizedWord}":`, etymonlineResult.reason);
    }

    const wiktionaryData = wiktionaryResult.status === 'fulfilled' ? wiktionaryResult.value : null;
    const dictionaryData = dictionaryResult.status === 'fulfilled' ? dictionaryResult.value : null;
    const etymonlineData = etymonlineResult.status === 'fulfilled' ? etymonlineResult.value : null;

    const sourceWord = this.buildSourceWord(normalizedWord, normalizedLanguage, wiktionaryData as any, dictionaryData as any);

    const connections: NormalizedConnection[] = [];

    // PRIORITY 1: Add etymonline connections first (highest quality)
    if (etymonlineData && Array.isArray((etymonlineData as any).connections)) {
      logger.debug(`Adding ${(etymonlineData as any).connections.length} HIGH-PRIORITY connections from etymonline`);
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
        logger.debug(`Adding ${validCognates.length} validated cognates for "${normalizedWord}"`);
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
        logger.debug(`No valid cognates found for "${normalizedWord}" after filtering`);
      }
    } catch (error) {
      logger.warn({ error }, `Cognate lookup failed for "${normalizedWord}"`);
    }

    // Filter out trivial same-language derivatives before deduplication
    const filtered = connections.filter(connection => {
      return !this.isTrivialDerivative(sourceWord.text, connection.word.text, sourceWord.language, connection.word.language);
    });

    // Enhanced deduplication with priority preservation and similarity grouping
    const deduplicated = this.deduplicateConnections(filtered, sourceWord);

    // Sort connections by priority and confidence (etymonline first)
    deduplicated.sort((a, b) => {
      const priorityOrder: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 };
      const aPriority = priorityOrder[a.relationship.priority || ''] || 0;
      const bPriority = priorityOrder[b.relationship.priority || ''] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      // If same priority, sort by confidence
      const aConfidence = a.relationship.confidence || 0;
      const bConfidence = b.relationship.confidence || 0;
      return bConfidence - aConfidence;
    });

    const result: EtymologyData = {
      sourceWord,
      connections: deduplicated.map(conn => ({
        word: conn.word,
        type: conn.relationship.type,
        confidence: conn.relationship.confidence,
        source: conn.relationship.source || 'unknown',
        notes: conn.relationship.notes
      }))
    };

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

    const targetText = typeof connection.word.text === 'string' ? connection.word.text.trim() : '';
    if (!targetText) {
      return null;
    }

    const targetWord: Word = {
      id: connection.word.id || this.generateId(),
      text: targetText,
      language: (connection.word.language || sourceWord.language || 'und').toLowerCase(),
      partOfSpeech: connection.word.partOfSpeech || 'unknown',
      definition: connection.word.definition || `Related to "${sourceWord.text}"`
    };

    const relationship = {
      type: connection.relationship && connection.relationship.type ? connection.relationship.type : 'related',
      confidence: typeof connection.relationship?.confidence === 'number' ? connection.relationship.confidence : 0.5,
      origin: connection.relationship?.origin || undefined,
      notes: connection.relationship?.notes || undefined,
      sharedRoot: connection.relationship?.sharedRoot || undefined
    };

    const sharedRoot = this.inferSharedRoot(sourceWord, targetWord, relationship);
    relationship.sharedRoot = sharedRoot;
    relationship.notes = this.ensureRootInNotes(relationship.notes, sharedRoot);
    relationship.origin = relationship.origin || sharedRoot;

    return { word: targetWord, relationship };
  }

  connectionsFromOrigin(originText: string, sourceWord: Word): NormalizedConnection[] {
    const segments = this.parseOriginText(originText);
    const connections: NormalizedConnection[] = [];

    for (const segment of segments) {
      const sharedRoot = segment.sharedRoot;
      connections.push({
        word: {
          id: this.generateId(),
          text: segment.word,
          language: segment.languageCode,
          partOfSpeech: 'root',
          definition: `${segment.languageName} form related to "${sourceWord.text}"`
        },
        relationship: {
          type: segment.type,
          confidence: 0.6,
          origin: sharedRoot,
          notes: `Derived from ${sharedRoot}`,
          sharedRoot
        }
      });
    }

    return connections;
  }

  private isValidEtymologicalConnection(connection: NormalizedConnection, sourceWord: Word): boolean {
    if (!connection.word || !connection.relationship) {
      return false;
    }

    // Reject very low confidence connections (but be more lenient for PIE roots)
    const minConfidence = connection.word.text.startsWith('*') ? 0.4 : 0.5;
    if (connection.relationship.confidence < minConfidence) {
      return false;
    }

    // PIE roots and proto-language forms get special treatment
    if (connection.word.text.startsWith('*') || connection.word.language === 'ine-pro' ||
        connection.word.language.includes('pro')) {
      return true; // PIE and proto forms are usually legitimate
    }

    // Check for semantic relatedness (but allow PIE connections)
    if (this.areSemanticallyUnrelated(sourceWord.text, connection.word.text)) {
      return false;
    }

    // Check for language family compatibility
    if (!this.areLanguageCompatible(sourceWord.language, connection.word.language, connection.relationship.type)) {
      return false;
    }

    // Check for common false cognate patterns
    if (this.isSuspiciousCognate(sourceWord.text, connection.word.text, sourceWord.language, connection.word.language)) {
      return false;
    }

    return true;
  }

  private deduplicateConnections(connections: NormalizedConnection[], sourceWord?: Word): NormalizedConnection[] {
    const seen = new Map<string, NormalizedConnection>();
    const result: NormalizedConnection[] = [];

    for (const connection of connections) {
      if (!connection || !connection.word || !connection.word.text) {
        continue;
      }

      const comparisonText = connection.word.text.toLowerCase();
      let comparisonLang = (connection.word.language || 'und').toLowerCase();

      // FIXED: PIE roots (words starting with *) should always be classified as ine-pro
      if (comparisonText.startsWith('*')) {
        comparisonLang = 'ine-pro';
        connection.word.language = 'ine-pro'; // Fix the language in place
      }

      // Skip self-references
      if (sourceWord && comparisonText === sourceWord.text.toLowerCase() && comparisonLang === (sourceWord.language || '').toLowerCase()) {
        continue;
      }

      // IMPROVED: Enhanced validation of the connection before considering it
      if (sourceWord && !this.isValidEtymologicalConnection(connection, sourceWord)) {
        logger.debug(`Skipping invalid connection: ${comparisonText} (${comparisonLang})`);
        continue;
      }

      const key = `${comparisonText}_${comparisonLang}`;

      if (!seen.has(key)) {
        seen.set(key, connection);
        result.push(connection);
        continue;
      }

      const existing = seen.get(key)!;
      const existingConfidence = existing.relationship?.confidence ?? 0;
      const newConfidence = connection.relationship?.confidence ?? 0;

      // IMPROVED: Consider source priority and relationship type in deduplication
      const existingPriority = this.getPriorityScore(existing.relationship?.source, existing.relationship?.type);
      const newPriority = this.getPriorityScore(connection.relationship?.source, connection.relationship?.type);

      // Replace if new connection has higher priority OR (same priority AND higher confidence)
      if (newPriority > existingPriority || (newPriority === existingPriority && newConfidence > existingConfidence)) {
        seen.set(key, connection);
        const index = result.indexOf(existing);
        if (index >= 0) {
          result[index] = connection;
        }
      }
    }

    return result;
  }

  private isTrivialDerivative(sourceText: string, targetText: string, sourceLang: string, targetLang: string): boolean {
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

    // Focus on basic inflections that are clearly derivatives (reduced filtering)
    const basicInflections = [
      'ing', 'ed', 's', 'es', 'ies', 'er', 'est'
    ];

    // Keep some derivational suffixes but be more selective
    const clearDerivatives = [
      'ly', 'ness', 'ment' // Only the most obvious derivatives
    ];

    // Only filter very basic negative prefixes
    const basicPrefixes = [
      'un', 'dis', 'non' // Only the most basic negation prefixes
    ];

    // Check for basic inflections only
    for (const suffix of basicInflections) {
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

    // Check for clear derivational patterns
    for (const suffix of clearDerivatives) {
      if (target === source + suffix) {
        return true;
      }
    }

    // Check reverse for basic inflections
    for (const suffix of basicInflections) {
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

    // Check reverse for clear derivatives
    for (const suffix of clearDerivatives) {
      if (source === target + suffix) {
        return true;
      }
    }

    // Check basic prefixes only
    for (const prefix of basicPrefixes) {
      if (target === prefix + source || source === prefix + target) {
        return true;
      }
    }

    return false;
  }

  private isValidCognateConnection(sourceWord: string, cognateWord: string, sourceLang: string, cognateLang: string): boolean {
    // Basic sanity checks
    if (!sourceWord || !cognateWord || !sourceLang || !cognateLang) return false;
    if (sourceLang === cognateLang) return false; // Cognates should be cross-linguistic

    const sourceLower = sourceWord.toLowerCase();
    const cognateLower = cognateWord.toLowerCase();

    // Don't connect completely dissimilar words
    if (Math.abs(sourceLower.length - cognateLower.length) > 4) return false;

    // Check for at least some phonetic similarity
    const commonChars = new Set([...sourceLower].filter(char => cognateLower.includes(char)));
    const similarity = commonChars.size / Math.max(sourceLower.length, cognateLower.length);

    if (similarity < 0.25) return false; // At least 25% shared characters

    // Language family compatibility check
    return this.areLanguageCompatible(sourceLang, cognateLang, 'cognate');
  }

  private areLanguageCompatible(lang1: string, lang2: string, connectionType: string): boolean {
    // Proto-languages can connect to anything
    if (lang1.includes('pro') || lang2.includes('pro') || lang1 === 'ine-pro' || lang2 === 'ine-pro') {
      return true;
    }

    // PIE relationships are always valid
    if (connectionType === 'etymology' || connectionType === 'pie_root') {
      return true;
    }

    // Same language family groups
    const indoEuropean = ['en', 'de', 'nl', 'sv', 'da', 'no', 'fr', 'es', 'it', 'pt', 'ro', 'la', 'grc', 'gr', 'ru', 'pl', 'cs', 'ga', 'cy', 'sa'];
    const semitic = ['ar', 'he', 'am'];
    const sino = ['zh', 'ja', 'ko'];

    const lang1IE = indoEuropean.includes(lang1);
    const lang2IE = indoEuropean.includes(lang2);
    const lang1Sem = semitic.includes(lang1);
    const lang2Sem = semitic.includes(lang2);
    const lang1Sino = sino.includes(lang1);
    const lang2Sino = sino.includes(lang2);

    // Same family is always compatible
    if ((lang1IE && lang2IE) || (lang1Sem && lang2Sem) || (lang1Sino && lang2Sino)) {
      return true;
    }

    // Cross-family connections should be borrowings or very high confidence
    if (connectionType === 'borrowing' || connectionType === 'loan') {
      return true;
    }

    return false;
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
    return normalizeLanguageCode(languageInput);
  }

  private getLanguageDisplay(code: string): string {
    return getLanguageName(code);
  }

  private generateId(): string {
    try {
      return `w_${randomUUID()}`;
    } catch (error) {
      return `w${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  inferSharedRoot(sourceWord: Word, targetWord: Word, relationship: any): string {
    const candidates: string[] = [];

    if (relationship.sharedRoot) {
      candidates.push(relationship.sharedRoot);
    }
    if (relationship.origin) {
      candidates.push(relationship.origin);
    }
    if (relationship.notes) {
      candidates.push(relationship.notes);
    }

    candidates.push(`${sourceWord.text} ${targetWord.text}`);

    const extracted = this.extractSharedRoot(...candidates);
    if (extracted) {
      return extracted;
    }

    if (relationship.type === 'derivative' || relationship.type === 'compound') {
      return sourceWord.text;
    }

    if (targetWord.text.startsWith('*')) {
      return targetWord.text;
    }

    if (relationship.type === 'cognate' && targetWord.language !== sourceWord.language) {
      const display = this.getLanguageDisplay(targetWord.language);
      return `${display} ${targetWord.text}`;
    }

    return targetWord.text;
  }

  extractSharedRoot(...texts: string[]): string | null {
    const rootPatterns = [
      /(?:from|borrowed from|via)\s+([A-Z][A-Za-z\s-]+?\s+[\*\-A-Za-z]+)/i,
      /(?:cognate with|related to)\s+([A-Z][A-Za-z\s-]+?\s+[\*\-A-Za-z]+)/i,
      /(Proto-[A-Za-z-]+\s+\*[-A-Za-z0-9]+)/i,
      /(PIE\s+\*[-A-Za-z0-9]+)/i,
      /(\*[-A-Za-z0-9]+)/,
      /(Old\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[A-Za-z]+)/,
      /(Latin\s+[A-Za-z]+)/,
      /(Greek\s+[A-Za-z]+)/,
      /(Sanskrit\s+[A-Za-z]+)/,
      /(Germanic\s+\*?[-A-Za-z0-9]+)/i
    ];

    for (const text of texts) {
      if (typeof text !== 'string' || text.trim().length === 0) {
        continue;
      }

      for (const pattern of rootPatterns) {
        const match = text.match(pattern);
        if (match) {
          const value = (match[1] || match[0]).trim().replace(/^[^A-Za-z\*]+/, '').replace(/[.,;:]+$/, '');
          if (value.length > 0) {
            return value;
          }
        }
      }
    }

    return null;
  }

  ensureRootInNotes(notes: string | undefined, sharedRoot: string): string | undefined {
    if (!sharedRoot) {
      return notes || undefined;
    }

    const trimmedRoot = sharedRoot.trim();
    if (trimmedRoot.length === 0) {
      return notes || undefined;
    }

    if (typeof notes === 'string' && notes.toLowerCase().includes(trimmedRoot.toLowerCase())) {
      return notes;
    }

    if (!notes) {
      return `Shared etymological element: ${trimmedRoot}`;
    }

    return `${notes} (shared root: ${trimmedRoot})`;
  }

  parseOriginText(originText: string): Array<{ type: string; languageName: string; languageCode: string; word: string; sharedRoot: string }> {
    const results: Array<{ type: string; languageName: string; languageCode: string; word: string; sharedRoot: string }> = [];

    if (typeof originText !== 'string') {
      return results;
    }

    const normalized = originText.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return results;
    }

    const originPatterns = [
      { type: 'ancestor', regex: /(?:from|borrowed from|via)\s+([A-Z][A-Za-z\s-]+?)\s+(?:the\s+)?(?:word\s+)?["']?([\*\-A-Za-z]+)["']?/gi },
      { type: 'cognate', regex: /related to\s+([A-Z][A-Za-z\s-]+?)\s+(?:the\s+)?(?:word\s+)?["']?([\*\-A-Za-z]+)["']?/gi }
    ];

    for (const { type, regex } of originPatterns) {
      let match;
      while ((match = regex.exec(normalized)) !== null) {
        const languageName = match[1].trim();
        const rootWord = match[2].trim().replace(/[.,;:]+$/, '');
        if (!languageName || !rootWord) {
          continue;
        }

        const languageCode = this.getLanguageCodeFromName(languageName);
        const sharedRoot = `${languageName} ${rootWord}`;

        results.push({
          type,
          languageName,
          languageCode,
          word: rootWord,
          sharedRoot
        });
      }
    }

    return results;
  }

  getPriorityScore(source: string | undefined, relationshipType: string | undefined): number {
    const sourcePriority: Record<string, number> = {
      'etymonline.com': 3,
      'wiktionary': 2,
      'dictionary-api': 1
    };

    const typePriority: Record<string, number> = {
      'etymology': 3,
      'cognate': 2,
      'ancestor': 2,
      'borrowing': 1,
      'related': 0
    };

    return (sourcePriority[source || ''] || 0) + (typePriority[relationshipType || ''] || 0);
  }

  areSemanticallyUnrelated(word1: string, word2: string): boolean {
    const word1Lower = word1.toLowerCase();
    const word2Lower = word2.toLowerCase();

    // Don't apply semantic filtering to PIE roots or proto-forms
    if (word1.startsWith('*') || word2.startsWith('*')) {
      return false; // PIE roots can connect to anything
    }

    // Don't filter proto-language connections
    if (word1Lower.includes('proto') || word2Lower.includes('proto')) {
      return false;
    }

    // Define basic semantic categories
    const basicElements = ['fire', 'water', 'earth', 'air', 'wind'];
    const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'brown', 'purple', 'orange', 'pink'];
    const numbers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

    // Check if words are in conflicting basic categories
    const word1IsElement = basicElements.includes(word1Lower);
    const word2IsElement = basicElements.includes(word2Lower);
    const word1IsColor = colors.includes(word1Lower);
    const word2IsColor = colors.includes(word2Lower);
    const word1IsNumber = numbers.includes(word1Lower);
    const word2IsNumber = numbers.includes(word2Lower);

    // Reject cross-category connections unless they make etymological sense
    if ((word1IsElement && word2IsColor) || (word1IsColor && word2IsElement)) {
      return true;
    }
    if ((word1IsElement && word2IsNumber) || (word1IsNumber && word2IsElement)) {
      return true;
    }
    if ((word1IsColor && word2IsNumber) || (word1IsNumber && word2IsColor)) {
      return true;
    }

    // Specific problematic pairs - BUT allow legitimate PIE connections
    const problematicPairs = [
      ['water', 'fire'],
      ['fire', 'water'],
      ['water', 'punjab'],
      ['punjab', 'water']
    ];

    // Don't block connections involving PIE roots or etymological forms
    if (word1.startsWith('*') || word2.startsWith('*')) {
      return false; // Allow PIE root connections
    }

    // Don't block if one word is clearly an etymological ancestor
    if (word1.toLowerCase().includes('proto') || word2.toLowerCase().includes('proto')) {
      return false; // Allow proto-language connections
    }

    for (const [prob1, prob2] of problematicPairs) {
      if ((word1Lower === prob1 && word2Lower === prob2) || (word1Lower === prob2 && word2Lower === prob1)) {
        return true;
      }
    }

    return false;
  }

  isSuspiciousCognate(word1: string, word2: string, lang1: string, lang2: string): boolean {
    const word1Clean = word1.toLowerCase().replace(/[^a-z]/g, '');
    const word2Clean = word2.toLowerCase().replace(/[^a-z]/g, '');

    // If words are completely different and not in same language family, suspicious
    if (lang1 !== lang2) {
      const commonChars = new Set([...word1Clean].filter(char => word2Clean.includes(char)));
      const similarity = commonChars.size / Math.max(word1Clean.length, word2Clean.length);

      if (similarity < 0.2 && Math.abs(word1Clean.length - word2Clean.length) > 3) {
        return true;
      }
    }

    return false;
  }

  getLanguageCodeFromName(name: string): string {
    const normalized = name.toLowerCase();
    const mapping: [string, string][] = [
      ['proto-indo-european', 'ine-pro'],
      ['proto-germanic', 'gem-pro'],
      ['proto', 'proto'],
      ['old english', 'en'],
      ['middle english', 'en'],
      ['old french', 'fr'],
      ['middle french', 'fr'],
      ['latin', 'la'],
      ['greek', 'gr'],
      ['ancient greek', 'gr'],
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

  isCrossLanguageDerivative(source: string, target: string, sourceLang: string, targetLang: string): boolean {
    // Romance language patterns - similar roots with language-specific endings
    const romanceLanguages = ['es', 'fr', 'it', 'pt', 'ca', 'ro'];
    const isSourceRomance = romanceLanguages.includes(sourceLang);
    const isTargetRomance = romanceLanguages.includes(targetLang);

    if (isSourceRomance && isTargetRomance) {
      // Remove common Romance endings to find root
      const sourceRoot = getRomanceRoot(source);
      const targetRoot = getRomanceRoot(target);

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
          if (areRootsRelated(sourceBase, targetBase)) {
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
      const sourceRoot = getGermanicRoot(source);
      const targetRoot = getGermanicRoot(target);

      if (sourceRoot === targetRoot && sourceRoot.length >= 3) {
        return true;
      }
    }

    return false;
  }

  // Clear all caches for consistent behavior
  clearAllCaches(): void {
    cache.flushAll();
    // Also clear etymonline API caches
    if (etymonlineAPI && typeof etymonlineAPI.clearAllCaches === 'function') {
      etymonlineAPI.clearAllCaches();
    }
    logger.info('All etymology service caches cleared');
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

    logger.info(`Cache cleared for "${normalizedWord}" (${normalizedLanguage})`);
  }
}

export default new EtymologyService();