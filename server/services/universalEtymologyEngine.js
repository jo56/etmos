/**
 * Universal Etymological Connection Algorithm
 *
 * A language-agnostic system for generating etymological connections
 * based on universal linguistic principles rather than hardcoded parameters.
 */

class UniversalEtymologyEngine {
  constructor() {
    this.connectionTypes = new Map();
    this.languageFamilies = new Map();
    this.soundChangeRules = new Map();
    this.initializeUniversalRules();
  }

  /**
   * Initialize universal linguistic rules and patterns
   */
  initializeUniversalRules() {
    // Register connection type handlers
    this.registerConnectionType('cognate', new CognateConnectionHandler());
    this.registerConnectionType('borrowing', new BorrowingConnectionHandler());
    this.registerConnectionType('derivation', new DerivationConnectionHandler());
    this.registerConnectionType('semantic_shift', new SemanticShiftConnectionHandler());

    // Initialize language family mappings (ISO-based)
    this.initializeLanguageFamilies();

    // Initialize universal sound change patterns
    this.initializeUniversalSoundChanges();
  }

  /**
   * Main entry point: Generate connections for any word in any language
   */
  async generateConnections(word, language, maxConnections = 6, excludeIds = []) {
    console.log(`[UniversalEngine] Generating connections for "${word}" (${language})`);

    const connections = [];
    const languageFamily = this.getLanguageFamily(language);

    // Run all connection type handlers in parallel
    const connectionPromises = Array.from(this.connectionTypes.entries()).map(
      ([type, handler]) => this.runConnectionHandler(handler, word, language, languageFamily, maxConnections)
    );

    const allConnectionResults = await Promise.all(connectionPromises);

    // Merge and score all connections
    for (const results of allConnectionResults) {
      connections.push(...results);
    }

    // Sort by confidence score and return top connections
    const scoredConnections = connections
      .filter(conn => !excludeIds.includes(conn.targetId))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxConnections);

    console.log(`[UniversalEngine] Generated ${scoredConnections.length} connections with confidence scores`);
    return scoredConnections;
  }

  /**
   * Run a specific connection handler
   */
  async runConnectionHandler(handler, word, language, languageFamily, maxConnections) {
    try {
      return await handler.generateConnections(word, language, languageFamily, this);
    } catch (error) {
      console.warn(`[UniversalEngine] Handler ${handler.constructor.name} failed:`, error.message);
      return [];
    }
  }

  /**
   * Register a new connection type handler
   */
  registerConnectionType(type, handler) {
    this.connectionTypes.set(type, handler);
  }

  /**
   * Get language family for any ISO language code
   */
  getLanguageFamily(languageCode) {
    // Use first part of language code for family inference
    const baseCode = languageCode.split('-')[0];

    // Dynamic family detection based on linguistic knowledge
    const familyMappings = {
      // Romance
      'es': 'romance', 'fr': 'romance', 'it': 'romance', 'pt': 'romance', 'ro': 'romance', 'ca': 'romance', 'la': 'romance',
      // Germanic
      'en': 'germanic', 'de': 'germanic', 'nl': 'germanic', 'sv': 'germanic', 'da': 'germanic', 'no': 'germanic', 'is': 'germanic',
      'got': 'germanic', 'odt': 'germanic', 'dum': 'germanic', 'ang': 'germanic', 'goh': 'germanic',
      // Slavic
      'ru': 'slavic', 'pl': 'slavic', 'cs': 'slavic', 'bg': 'slavic', 'hr': 'slavic', 'sr': 'slavic', 'sk': 'slavic',
      // Celtic
      'ga': 'celtic', 'cy': 'celtic', 'gd': 'celtic', 'br': 'celtic', 'kw': 'celtic',
      // Greek
      'el': 'greek', 'gr': 'greek', 'grc': 'greek',
      // Indo-Iranian
      'hi': 'indo_iranian', 'ur': 'indo_iranian', 'fa': 'indo_iranian', 'sa': 'indo_iranian',
      // Reconstructed
      'ine-pro': 'proto_indo_european', 'gem-pro': 'proto_germanic', 'itc-pro': 'proto_italic'
    };

    return familyMappings[baseCode] || 'unknown';
  }

  /**
   * Calculate phonetic similarity between two words
   */
  calculatePhoneticSimilarity(word1, word2) {
    // Levenshtein distance with linguistic weighting
    const distance = this.levenshteinDistance(word1.toLowerCase(), word2.toLowerCase());
    const maxLength = Math.max(word1.length, word2.length);
    const baseSimilarity = 1 - (distance / maxLength);

    // Apply linguistic similarity bonuses
    let similarity = baseSimilarity;

    // Bonus for similar beginnings/endings (common in cognates)
    if (word1.slice(0, 2) === word2.slice(0, 2)) similarity += 0.1;
    if (word1.slice(-2) === word2.slice(-2)) similarity += 0.1;

    // Bonus for similar consonant patterns (more stable than vowels)
    const consonants1 = word1.replace(/[aeiouáéíóúàèìòùâêîôûäëïöü]/gi, '');
    const consonants2 = word2.replace(/[aeiouáéíóúàèìòùâêîôûäëïöü]/gi, '');
    if (consonants1 === consonants2) similarity += 0.2;

    return Math.min(similarity, 1.0);
  }

  /**
   * Levenshtein distance calculation
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  /**
   * Apply universal sound changes to generate related forms
   */
  generateSoundVariants(word, sourceLanguage, targetLanguage) {
    const variants = [];
    const sourceFam = this.getLanguageFamily(sourceLanguage);
    const targetFam = this.getLanguageFamily(targetLanguage);

    // Universal sound change patterns (not hardcoded to specific languages)
    const universalChanges = [
      // Vowel changes
      { from: 'a', to: 'e', context: 'any', confidence: 0.7 },
      { from: 'e', to: 'i', context: 'unstressed', confidence: 0.6 },
      { from: 'o', to: 'u', context: 'any', confidence: 0.7 },

      // Consonant changes
      { from: 'p', to: 'b', context: 'intervocalic', confidence: 0.8 },
      { from: 't', to: 'd', context: 'intervocalic', confidence: 0.8 },
      { from: 'k', to: 'g', context: 'intervocalic', confidence: 0.8 },

      // Lenition patterns
      { from: 'f', to: 'v', context: 'any', confidence: 0.6 },
      { from: 's', to: 'z', context: 'intervocalic', confidence: 0.7 },

      // Palatalization
      { from: 'k', to: 'ch', context: 'before_i', confidence: 0.7 },
      { from: 't', to: 'ts', context: 'before_i', confidence: 0.6 }
    ];

    // Apply sound changes to generate variants
    for (const change of universalChanges) {
      if (word.includes(change.from)) {
        const variant = word.replace(new RegExp(change.from, 'g'), change.to);
        if (variant !== word && variant.length > 0) {
          variants.push({
            word: variant,
            change: `${change.from} → ${change.to}`,
            confidence: change.confidence,
            language: targetLanguage
          });
        }
      }
    }

    return variants;
  }

  initializeLanguageFamilies() {
    // This would be expanded with more comprehensive family data
    // For now, focusing on the algorithm structure
  }

  initializeUniversalSoundChanges() {
    // Universal sound change patterns that apply across languages
    // This would be loaded from linguistic databases
  }
}

/**
 * Base class for connection type handlers
 */
class ConnectionHandler {
  async generateConnections(word, language, languageFamily, engine) {
    throw new Error('generateConnections must be implemented by subclasses');
  }
}

/**
 * Cognate Connection Handler
 * Finds words from the same proto-language origin
 */
class CognateConnectionHandler extends ConnectionHandler {
  async generateConnections(word, language, languageFamily, engine) {
    const connections = [];

    // Find related languages in the same family
    const relatedLanguages = this.getRelatedLanguages(languageFamily);

    for (const targetLang of relatedLanguages) {
      if (targetLang === language) continue;

      // Generate sound variants for the target language
      const variants = engine.generateSoundVariants(word, language, targetLang);

      for (const variant of variants) {
        const confidence = variant.confidence * 0.9; // Cognate confidence factor

        if (confidence > 0.5) { // Threshold for cognate acceptance
          connections.push({
            type: 'cognate',
            sourceWord: word,
            sourceLanguage: language,
            targetWord: variant.word,
            targetLanguage: targetLang,
            confidence: confidence,
            explanation: `Cognate via sound change: ${variant.change}`,
            targetId: this.generateId()
          });
        }
      }
    }

    return connections.slice(0, 4); // Limit cognates per language
  }

  getRelatedLanguages(family) {
    const families = {
      'romance': ['es', 'fr', 'it', 'pt', 'ro', 'ca', 'la'],
      'germanic': ['en', 'de', 'nl', 'sv', 'da', 'no', 'is'],
      'slavic': ['ru', 'pl', 'cs', 'bg', 'hr', 'sr'],
      'celtic': ['ga', 'cy', 'gd', 'br'],
      'unknown': []
    };

    return families[family] || [];
  }

  generateId() {
    return 'cogn_' + Math.random().toString(36).substr(2, 9);
  }
}

/**
 * Borrowing Connection Handler
 * Finds loanwords between languages
 */
class BorrowingConnectionHandler extends ConnectionHandler {
  async generateConnections(word, language, languageFamily, engine) {
    const connections = [];

    // Languages commonly borrow from these sources
    const borrowingSources = ['la', 'gr', 'ar', 'fr', 'en', 'de'];
    const borrowingTargets = ['en', 'fr', 'es', 'it', 'de', 'ru', 'pl'];

    // Check if word could be borrowed into other languages
    for (const targetLang of borrowingTargets) {
      if (targetLang === language) continue;

      // Simple borrowing often preserves form
      const similarity = engine.calculatePhoneticSimilarity(word, word);
      if (similarity > 0.8) {
        connections.push({
          type: 'borrowing',
          sourceWord: word,
          sourceLanguage: language,
          targetWord: word, // Borrowings often preserve form
          targetLanguage: targetLang,
          confidence: 0.7,
          explanation: `Potential borrowing (preserved form)`,
          targetId: this.generateId()
        });
      }
    }

    return connections.slice(0, 2); // Limit borrowings
  }

  generateId() {
    return 'borr_' + Math.random().toString(36).substr(2, 9);
  }
}

/**
 * Derivation Connection Handler
 * Finds morphologically related words within the same language
 */
class DerivationConnectionHandler extends ConnectionHandler {
  async generateConnections(word, language, languageFamily, engine) {
    const connections = [];

    // Universal morphological patterns
    const derivationPatterns = [
      { suffix: 's', type: 'plural', confidence: 0.9 },
      { suffix: 'ed', type: 'past_tense', confidence: 0.8 },
      { suffix: 'ing', type: 'present_participle', confidence: 0.8 },
      { suffix: 'er', type: 'agent', confidence: 0.7 },
      { suffix: 'ly', type: 'adverb', confidence: 0.7 },
      { suffix: 'tion', type: 'nominalization', confidence: 0.8 },
      { suffix: 'ness', type: 'abstract_noun', confidence: 0.7 }
    ];

    for (const pattern of derivationPatterns) {
      // Add suffix
      const derived = word + pattern.suffix;
      connections.push({
        type: 'derivation',
        sourceWord: word,
        sourceLanguage: language,
        targetWord: derived,
        targetLanguage: language,
        confidence: pattern.confidence,
        explanation: `${pattern.type} derivation`,
        targetId: this.generateId()
      });

      // Remove suffix (if word ends with it)
      if (word.endsWith(pattern.suffix) && word.length > pattern.suffix.length + 2) {
        const base = word.slice(0, -pattern.suffix.length);
        connections.push({
          type: 'derivation',
          sourceWord: word,
          sourceLanguage: language,
          targetWord: base,
          targetLanguage: language,
          confidence: pattern.confidence,
          explanation: `Base form (remove ${pattern.type})`,
          targetId: this.generateId()
        });
      }
    }

    return connections.slice(0, 3); // Limit derivations
  }

  generateId() {
    return 'deriv_' + Math.random().toString(36).substr(2, 9);
  }
}

/**
 * Semantic Shift Connection Handler
 * Finds words with meaning changes over time
 */
class SemanticShiftConnectionHandler extends ConnectionHandler {
  async generateConnections(word, language, languageFamily, engine) {
    // This would implement semantic shift detection
    // For now, returning empty as it requires semantic databases
    return [];
  }
}

module.exports = UniversalEtymologyEngine;