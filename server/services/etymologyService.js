const { randomUUID } = require('crypto');
const NodeCache = require('node-cache');

const wiktionaryAPI = require('./wiktionaryAPI');
const dictionaryAPI = require('./dictionaryAPI');
const etymonlineAPI = require('./etymonlineAPI');
const cognateService = require('./cognateService');

const cache = new NodeCache({ stdTTL: 3600 });

class EtymologyService {
  async findEtymologicalConnections(word, language = 'en', bypassCache = false) {
    const normalizedWord = (word || '').trim();
    if (!normalizedWord) {
      throw new Error('Word parameter is required');
    }

    const normalizedLanguage = (language || 'en').toLowerCase();
    const cacheKey = `${normalizedLanguage}:${normalizedWord.toLowerCase()}`;

    if (!bypassCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
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

    const wiktionaryData = wiktionaryResult.status === 'fulfilled' ? wiktionaryResult.value : null;
    const dictionaryData = dictionaryResult.status === 'fulfilled' ? dictionaryResult.value : null;
    const etymonlineData = etymonlineResult.status === 'fulfilled' ? etymonlineResult.value : null;

    const sourceWord = this.buildSourceWord(normalizedWord, normalizedLanguage, wiktionaryData, dictionaryData);

    const connections = [];

    // PRIORITY 1: Add etymonline connections first (highest quality)
    if (etymonlineData && Array.isArray(etymonlineData.connections)) {
      console.log(`Adding ${etymonlineData.connections.length} HIGH-PRIORITY connections from etymonline`);
      for (const connection of etymonlineData.connections) {
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
    if (wiktionaryData && Array.isArray(wiktionaryData.connections)) {
      for (const connection of wiktionaryData.connections) {
        const normalizedConnection = this.normalizeConnection(sourceWord, connection);
        if (normalizedConnection) {
          normalizedConnection.relationship.priority = 'medium';
          normalizedConnection.relationship.source = 'wiktionary';
          connections.push(normalizedConnection);
        }
      }
    }

    // PRIORITY 3: Add dictionary API connections
    if (dictionaryData && typeof dictionaryData.origin === 'string' && dictionaryData.origin.trim().length > 0) {
      const originConnections = this.connectionsFromOrigin(dictionaryData.origin, sourceWord);
      originConnections.forEach(conn => {
        conn.relationship.priority = 'low';
        conn.relationship.source = 'dictionary-api';
      });
      connections.push(...originConnections);
    }

    // RE-ENABLED: Add cognate connections with improved filtering
    try {
      const languages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'la', 'gr', 'ru', 'pl', 'nl', 'da', 'sv', 'no'];
      const cognates = await cognateService.findCognates(normalizedWord, normalizedLanguage, languages);

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
        const cognateConnections = validCognates.map(cognate => ({
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
            origin: cognate.semanticField ? `${cognate.concept} (${cognate.semanticField})` : null,
            sharedRoot: cognate.concept || null,
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

    // Add enhanced etymological connections through recursive expansion (temporarily disabled)
    // try {
    //   const recursiveConnections = await this.findRecursiveEtymologicalConnections(normalizedWord, normalizedLanguage, 1);
    //   connections.push(...recursiveConnections);
    // } catch (error) {
    //   console.error(`Recursive etymological lookup failed for "${normalizedWord}":`, error);
    // }

    // Filter out trivial same-language derivatives before deduplication
    const filtered = connections.filter(connection => {
      return !this.isTrivialDerivative(sourceWord.text, connection.word.text, sourceWord.language, connection.word.language);
    });

    const deduplicated = this.deduplicateConnections(sourceWord, filtered);

    // Sort connections by priority and confidence (etymonline first)
    deduplicated.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const aPriority = priorityOrder[a.relationship.priority] || 0;
      const bPriority = priorityOrder[b.relationship.priority] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      // If same priority, sort by confidence
      const aConfidence = a.relationship.confidence || 0;
      const bConfidence = b.relationship.confidence || 0;
      return bConfidence - aConfidence;
    });

    const result = {
      sourceWord,
      connections: deduplicated
    };

    cache.set(cacheKey, result);
    return result;
  }

  async expandFromWord(wordText, language) {
    return this.findEtymologicalConnections(wordText, language);
  }

  async findRecursiveEtymologicalConnections(word, language, depth = 1, visited = new Set()) {
    if (depth <= 0 || visited.has(`${word}_${language}`)) {
      return [];
    }

    visited.add(`${word}_${language}`);
    const connections = [];

    try {
      // Get basic etymological data for this word
      const [wiktionaryResult, dictionaryResult] = await Promise.allSettled([
        require('./wiktionaryAPI').fetchWiktionaryData(word, language),
        require('./dictionaryAPI').fetchEntry(word, language)
      ]);

      const wiktionaryData = wiktionaryResult.status === 'fulfilled' ? wiktionaryResult.value : null;
      const dictionaryData = dictionaryResult.status === 'fulfilled' ? dictionaryResult.value : null;

      // Extract direct etymological ancestors from origin text
      if (dictionaryData && dictionaryData.origin) {
        const ancestors = this.extractEtymologicalAncestors(dictionaryData.origin);

        for (const ancestor of ancestors) {
          if (!visited.has(`${ancestor.word}_${ancestor.language}`)) {
            connections.push({
              word: {
                id: this.generateId(),
                text: ancestor.word,
                language: ancestor.language,
                partOfSpeech: 'ancestor',
                definition: `Etymological ancestor of "${word}"`
              },
              relationship: {
                type: 'ancestor',
                confidence: 0.8,
                notes: `Direct etymological ancestor from ${ancestor.sourceName}`,
                origin: ancestor.sourceName,
                sharedRoot: ancestor.word
              }
            });
          }
        }
      }

      // For certain high-value languages, do one level of recursive expansion
      if (depth > 0 && ['en', 'la', 'gr', 'sa', 'de', 'fr'].includes(language)) {
        const basicData = await this.findEtymologicalConnections(word, language);

        for (const connection of basicData.connections.slice(0, 3)) { // Limit to avoid explosion
          if (!visited.has(`${connection.word.text}_${connection.word.language}`)) {
            const subConnections = await this.findRecursiveEtymologicalConnections(
              connection.word.text,
              connection.word.language,
              depth - 1,
              visited
            );

            // Add the sub-connections but mark them as indirect
            for (const subConn of subConnections.slice(0, 2)) {
              connections.push({
                ...subConn,
                relationship: {
                  ...subConn.relationship,
                  type: 'indirect_' + subConn.relationship.type,
                  confidence: Math.max(0.3, (subConn.relationship.confidence || 0.5) * 0.7),
                  notes: `Indirect connection via "${connection.word.text}" (${connection.word.language})`
                }
              });
            }
          }
        }
      }

    } catch (error) {
      console.error(`Recursive etymology lookup failed for "${word}" (${language}):`, error);
    }

    return connections;
  }

  extractEtymologicalAncestors(originText) {
    const ancestors = [];

    if (typeof originText !== 'string') {
      return ancestors;
    }

    // Enhanced patterns for finding etymological ancestors - improved PIE detection
    const ancestorPatterns = [
      // Proto-languages with reconstructed forms - improved character class
      { regex: /(Proto-[A-Za-z-]+)\s+(\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi, langExtractor: (match) => this.getLanguageCodeFromName(match[1]) },

      // PIE forms - multiple patterns for better detection
      { regex: /(PIE|Proto-Indo-European)\s+(?:root\s+)?(\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi, langExtractor: () => 'ine-pro' },
      { regex: /from\s+(PIE|Proto-Indo-European)\s+(\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi, langExtractor: () => 'ine-pro' },
      { regex: /(\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)\s+root/gi, langExtractor: () => 'ine-pro' },

      // Historical language forms
      { regex: /(Old|Middle|Ancient)\s+([A-Za-z]+)\s+([a-zA-Z-]+)/gi, langExtractor: (match) => this.getLanguageCodeFromName(`${match[1]} ${match[2]}`) },

      // Latin forms
      { regex: /Latin\s+([a-zA-Z-]+)/gi, langExtractor: () => 'la' },

      // Greek forms
      { regex: /(Ancient\s+)?Greek\s+([a-zA-Zα-ωΑ-Ω-]+)/gi, langExtractor: () => 'grc' },

      // Sanskrit forms
      { regex: /Sanskrit\s+([a-zA-Z-]+)/gi, langExtractor: () => 'sa' },

      // Germanic forms
      { regex: /(Proto-)?Germanic\s+(\*?[a-zA-Z-]+)/gi, langExtractor: () => 'gem-pro' }
    ];

    for (const pattern of ancestorPatterns) {
      let match;
      while ((match = pattern.regex.exec(originText)) !== null) {
        const language = pattern.langExtractor(match);
        let word = match[match.length - 1]; // Last capture group is usually the word

        if (word && word.length > 1) {
          // Clean up the word
          word = word.replace(/[.,;:]+$/, '').trim();

          if (word.length > 1) {
            ancestors.push({
              word: word,
              language: language,
              sourceName: match[0].trim()
            });
          }
        }
      }
    }

    return ancestors;
  }

  buildSourceWord(word, language, wiktionaryData, dictionaryData) {
    const base = {
      id: this.generateId(),
      text: word,
      language,
      partOfSpeech: 'unknown',
      definition: `Definition for "${word}" not available`
    };

    if (wiktionaryData && wiktionaryData.sourceWord) {
      base.id = wiktionaryData.sourceWord.id || base.id;
      base.text = wiktionaryData.sourceWord.text || base.text;
      base.language = wiktionaryData.sourceWord.language || base.language;
      base.partOfSpeech = wiktionaryData.sourceWord.partOfSpeech || base.partOfSpeech;
      base.definition = wiktionaryData.sourceWord.definition || base.definition;
    }

    if (dictionaryData) {
      const dictionaryDefinition = dictionaryAPI.extractPrimaryDefinition(dictionaryData);
      const dictionaryPartOfSpeech = dictionaryAPI.extractPrimaryPartOfSpeech(dictionaryData);

      if (dictionaryDefinition) {
        base.definition = dictionaryDefinition;
      }

      if (dictionaryPartOfSpeech) {
        base.partOfSpeech = dictionaryPartOfSpeech;
      }

      if (dictionaryData.origin) {
        base.origin = dictionaryData.origin;
      }

      if (dictionaryData.phonetics && dictionaryData.phonetics.length > 0) {
        base.phonetics = dictionaryData.phonetics;
      }
    }

    return base;
  }

  normalizeConnection(sourceWord, connection) {
    if (!connection || !connection.word) {
      return null;
    }

    const targetText = typeof connection.word.text === 'string' ? connection.word.text.trim() : '';
    if (!targetText) {
      return null;
    }

    const targetWord = {
      id: connection.word.id || this.generateId(),
      text: targetText,
      language: (connection.word.language || sourceWord.language || 'und').toLowerCase(),
      partOfSpeech: connection.word.partOfSpeech || 'unknown',
      definition: connection.word.definition || `Related to "${sourceWord.text}"`
    };

    const relationship = {
      type: connection.relationship && connection.relationship.type ? connection.relationship.type : 'related',
      confidence: typeof connection.relationship?.confidence === 'number' ? connection.relationship.confidence : 0.5,
      origin: connection.relationship?.origin || null,
      notes: connection.relationship?.notes || null,
      sharedRoot: connection.relationship?.sharedRoot || null
    };

    const sharedRoot = this.inferSharedRoot(sourceWord, targetWord, relationship);
    relationship.sharedRoot = sharedRoot;
    relationship.notes = this.ensureRootInNotes(relationship.notes, sharedRoot);
    relationship.origin = relationship.origin || sharedRoot;

    return { word: targetWord, relationship };
  }

  inferSharedRoot(sourceWord, targetWord, relationship) {
    const candidates = [];

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

  extractSharedRoot(...texts) {
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

  ensureRootInNotes(notes, sharedRoot) {
    if (!sharedRoot) {
      return notes || null;
    }

    const trimmedRoot = sharedRoot.trim();
    if (trimmedRoot.length === 0) {
      return notes || null;
    }

    if (typeof notes === 'string' && notes.toLowerCase().includes(trimmedRoot.toLowerCase())) {
      return notes;
    }

    if (!notes) {
      return `Shared etymological element: ${trimmedRoot}`;
    }

    return `${notes} (shared root: ${trimmedRoot})`;
  }

  connectionsFromOrigin(originText, sourceWord) {
    const segments = this.parseOriginText(originText);
    const connections = [];

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

  parseOriginText(originText) {
    const results = [];

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

  deduplicateConnections(sourceWord, connections) {
    const seen = new Map();
    const result = [];

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
      if (comparisonText === sourceWord.text.toLowerCase() && comparisonLang === (sourceWord.language || '').toLowerCase()) {
        continue;
      }

      // IMPROVED: Enhanced validation of the connection before considering it
      if (!this.isValidEtymologicalConnection(connection, sourceWord)) {
        console.log(`Skipping invalid connection: ${comparisonText} (${comparisonLang})`);
        continue;
      }

      const key = `${comparisonText}_${comparisonLang}`;
      if (!seen.has(key)) {
        seen.set(key, connection);
        result.push(connection);
        continue;
      }

      const existing = seen.get(key);
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

  // IMPROVED: Enhanced validation for etymological connections
  isValidEtymologicalConnection(connection, sourceWord) {
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

  // Get priority score for source and relationship type
  getPriorityScore(source, relationshipType) {
    const sourcePriority = {
      'etymonline.com': 3,
      'wiktionary': 2,
      'dictionary-api': 1
    };

    const typePriority = {
      'etymology': 3,
      'cognate': 2,
      'ancestor': 2,
      'borrowing': 1,
      'related': 0
    };

    return (sourcePriority[source] || 0) + (typePriority[relationshipType] || 0);
  }

  // Check if two words are semantically unrelated
  areSemanticallyUnrelated(word1, word2) {
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

  // Check language compatibility for etymological relationships
  areLanguageCompatible(lang1, lang2, relationshipType) {
    // Proto-languages can connect to anything
    if (lang1.includes('pro') || lang2.includes('pro') || lang1 === 'ine-pro' || lang2 === 'ine-pro') {
      return true;
    }

    // PIE relationships are always valid
    if (relationshipType === 'etymology' || relationshipType === 'pie_root') {
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
    if (relationshipType === 'borrowing' || relationshipType === 'loan') {
      return true;
    }

    return false;
  }

  // Check for suspicious cognate patterns
  isSuspiciousCognate(word1, word2, lang1, lang2) {
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

  getLanguageCodeFromName(name) {
    const normalized = name.toLowerCase();
    const mapping = [
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

  getLanguageDisplay(code) {
    const normalized = (code || '').toLowerCase();
    const names = {
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

    return names[normalized] || names[code] || code.toUpperCase();
  }

  generateId() {
    try {
      return `w_${randomUUID()}`;
    } catch (error) {
      return `w${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  // Check if a word is just a trivial derivative of another (same as server function)
  isTrivialDerivative(sourceText, targetText, sourceLang, targetLang) {
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

  // Validate cognate connections to prevent false cognates
  isValidCognateConnection(sourceWord, cognateWord, sourceLang, cognateLang) {
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
}

module.exports = new EtymologyService();
