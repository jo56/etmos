const NodeCache = require('node-cache');

// Cache for 2 hours to avoid repeated requests
const cache = new NodeCache({ stdTTL: 7200 });

class EtymonlineAPI {
  constructor() {
    this.baseURL = 'https://www.etymonline.com/word';
    // Cross-reference database for shared etymological origins
    this.etymologyDatabase = new Map(); // key: etymological form, value: array of words sharing it
    this.processedWords = new Set(); // Track words we've already processed
  }

  async fetchEtymologyData(word, language = 'en') {
    const cacheKey = `etymonline_${word}_${language}`;
    let cached = cache.get(cacheKey);
    if (cached) {
      console.log(`Using cached data for "${word}"`);
      return cached;
    }

    try {
      // Handle PIE roots and special etymological forms
      let url;
      if (word.startsWith('*')) {
        // PIE roots use the asterisk in the URL
        url = `${this.baseURL}/${encodeURIComponent(word)}`;
      } else {
        url = `${this.baseURL}/${word}`;
      }
      console.log(`Fetching etymology from: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        console.log(`Etymonline returned ${response.status} for word: ${word}`);
        return null;
      }

      const html = await response.text();
      const etymologyData = this.parseEtymologyHTML(html, word, language);

      // Update cross-reference database
      this.updateEtymologyDatabase(word, etymologyData);

      // Enhance connections with cross-references
      const enhancedData = this.enhanceWithCrossReferences(etymologyData, word);

      cache.set(cacheKey, enhancedData);
      return enhancedData;

    } catch (error) {
      console.error(`Error fetching etymonline data for "${word}":`, error.message);
      return null;
    }
  }

  parseEtymologyHTML(html, word, language) {
    const connections = [];

    try {
      // FIXED: Only extract etymology sections that are actually for the requested word
      // Look for the specific word's etymology section, not all prose sections
      // First get all prose sections, then filter for the target word
      const allSections = html.match(/<section[^>]*class="[^"]*prose-lg[^"]*"[^>]*>[\s\S]*?<\/section>/gi);
      const etymologyMatches = [];

      if (allSections) {
        for (const section of allSections) {
          const sectionText = section.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (this.isRelevantEtymologySection(sectionText, word)) {
            etymologyMatches.push(section);
          }
        }
      }

      if (!etymologyMatches || etymologyMatches.length === 0) {
        console.log(`No etymology section found for: ${word}`);
        return { connections: [] };
      }

      console.log(`Found ${etymologyMatches.length} etymology sections for: ${word}`);

      // Parse etymology sections - but only those that start with the target word
      for (const section of etymologyMatches) {
        // Additional validation: make sure this section is actually about our word
        const sectionText = section.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (this.isRelevantEtymologySection(sectionText, word)) {
          const etymology = this.extractEtymologyFromSection(section, word, language);
          connections.push(...etymology);
        }
      }

      // Extract related words
      const relatedWords = this.extractRelatedWords(html, word, language);
      connections.push(...relatedWords);

      console.log(`Found ${connections.length} etymological connections for "${word}"`);
      return { connections };

    } catch (error) {
      console.error(`Error parsing etymonline HTML for "${word}":`, error.message);
      return { connections: [] };
    }
  }

  extractEtymologyFromSection(sectionHTML, sourceWord, sourceLanguage) {
    const connections = [];

    try {
      // Remove HTML tags but preserve structure for analysis
      const text = sectionHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      console.log(`Analyzing text: ${text.substring(0, 300)}...`);

      const validEtymologies = new Set(); // Track found etymologies to avoid duplicates

      // PRIORITIZE: Extract italicized and hyperlinked words first
      const markedWords = this.extractMarkedWords(sectionHTML, text, sourceWord);
      for (const markedWord of markedWords) {
        const etymologyKey = `${markedWord.word.language}:${markedWord.word.text}`;
        if (!validEtymologies.has(etymologyKey)) {
          connections.push(markedWord);
          validEtymologies.add(etymologyKey);
          console.log(`Found marked word: ${markedWord.word.language} "${markedWord.word.text}" -> "${sourceWord}" (${markedWord.relationship.notes})`);
        }
      }

      // ENHANCED: Check for shortened word relationships first
      const shortenedWordConnections = this.detectShortenedWordRelationships(text, sourceWord);
      if (shortenedWordConnections.length > 0) {
        connections.push(...shortenedWordConnections);
        console.log(`Found ${shortenedWordConnections.length} shortened word relationships for "${sourceWord}"`);
      }

      // SPECIAL: Always extract PIE derivatives for PIE roots (regardless of other connections found)
      if (sourceWord.startsWith('*')) {
        console.log(`Extracting derivatives for PIE root "${sourceWord}"...`);
        const pieDerivatives = this.extractPIERootDerivatives(text, sourceWord);
        connections.push(...pieDerivatives);
        console.log(`Found ${pieDerivatives.length} PIE derivatives from this section`);
      }

      // FALLBACK: Only if no marked words or shortened relationships found, use text patterns for explicit etymologies
      if (connections.length === 0) {
        console.log(`No marked words found for "${sourceWord}", falling back to text pattern extraction...`);

        // Only look for the most authoritative patterns (not PIE roots, handled above)
        if (!sourceWord.startsWith('*')) {
          // Only look for the most authoritative patterns
          const highConfidencePatterns = [
          // PIE roots (most authoritative) - improved to capture hyphens and special characters
          /from\s+PIE\s+(?:root\s+)?([*\w\u00C0-\u017F\u0100-\u017F\u1E00-\u1EFF\u1F00-\u1FFF\u0370-\u03FF\u0400-\u04FF₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi,

          // Additional PIE root patterns
          /PIE\s+root\s+([*\w\u00C0-\u017F\u0100-\u017F\u1E00-\u1EFF\u1F00-\u1FFF\u0370-\u03FF\u0400-\u04FF₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi,
          /PIE\s+([*\w\u00C0-\u017F\u0100-\u017F\u1E00-\u1EFF\u1F00-\u1FFF\u0370-\u03FF\u0400-\u04FF₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi,

          // Proto-language forms with explicit "from" statements - improved character class
          /from\s+(Proto-[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+([*\w\u00C0-\u017F\u0100-\u017F\u1E00-\u1EFF\u1F00-\u1FFF\u0370-\u03FF\u0400-\u04FF₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/gi
        ];

        for (const pattern of highConfidencePatterns) {
          let match;
          pattern.lastIndex = 0;

          while ((match = pattern.exec(text)) !== null) {
            let languageName, etymologicalWord, isPIE = false;

            // Handle PIE pattern specially
            if (match[0].toLowerCase().includes('pie')) {
              languageName = 'Proto-Indo-European';
              etymologicalWord = match[1].trim();
              isPIE = true;
            } else if (match[1] && match[2]) {
              languageName = match[1].trim();
              etymologicalWord = match[2].trim();
            } else {
              continue; // Skip invalid matches
            }

            // Validate the etymological word
            if (!this.isValidEtymologicalWord(etymologicalWord, sourceWord)) {
              continue;
            }

            // Create unique key to avoid duplicates
            const etymologyKey = `${languageName}:${etymologicalWord}`;
            if (validEtymologies.has(etymologyKey)) {
              continue;
            }
            validEtymologies.add(etymologyKey);

            // Analyze context to confirm this is a true etymological relationship
            const contextValidation = this.validateEtymologicalContext(text, match.index, languageName, etymologicalWord);

            if (!contextValidation.isValid) {
              console.log(`Rejected etymology ${etymologyKey}: ${contextValidation.reason}`);
              continue;
            }

            const languageCode = this.mapLanguageNameToCode(languageName);
            const sharedRoot = this.extractSharedRoot(text, languageName, etymologicalWord);
            const relationshipType = this.determineRelationshipType(languageName, etymologicalWord, text);

            const connection = {
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
                origin: sharedRoot || `${languageName} ${etymologicalWord}`,
                sharedRoot: sharedRoot,
                etymologyContext: match[0] // Store the original match for reference
              }
            };

            connections.push(connection);
            console.log(`Found fallback etymology: ${languageName} "${etymologicalWord}" -> "${sourceWord}"`);
          }
        }
        } // Close non-PIE root block
      } // Close connections.length === 0 block

    } catch (error) {
      console.error(`Error extracting etymology from section:`, error.message);
    }

    return connections;
  }

  // Validate that a word is a legitimate etymological form
  isValidEtymologicalWord(word, sourceWord) {
    if (!word || word.length < 2) return false;
    if (word === sourceWord) return false;

    // Should contain linguistic characters (including asterisks for reconstructed forms) - improved regex
    if (!/^[*]?[\w\u00C0-\u017F\u0100-\u017F\u1E00-\u1EFF\u1F00-\u1FFF\u0370-\u03FF\u0400-\u04FF₀-₉ʰₑʷβɟḱĝʷʲʼ-]+[.]?$/.test(word)) {
      return false;
    }

    // Reject common English words that are unlikely to be etymology
    const commonWords = ['the', 'and', 'from', 'with', 'also', 'see', 'probably', 'perhaps', 'meaning', 'word', 'form', 'root', 'base'];
    if (commonWords.includes(word.toLowerCase())) return false;

    // IMPROVED: Reject words that are clearly modern or technical terms
    if (this.isModernTechnicalTerm(word)) {
      return false;
    }

    // IMPROVED: Reject words that are semantically incompatible with the source
    if (this.areSemanticallySuspicious(word, sourceWord)) {
      return false;
    }

    // Reject standalone morphological components (prefixes/suffixes) unless they're reconstructed forms
    if (!word.startsWith('*') && this.isMorphologicalComponent(word, sourceWord)) {
      return false;
    }

    return true;
  }

  // Check if a word is a modern technical term
  isModernTechnicalTerm(word) {
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

  // Check if two words are semantically suspicious to be etymologically related
  areSemanticallySuspicious(word, sourceWord) {
    const wordLower = word.toLowerCase();
    const sourceLower = sourceWord.toLowerCase();

    // Define basic semantic categories that shouldn't cross-connect
    const basicElements = ['fire', 'water', 'earth', 'air', 'wind'];
    const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white'];
    const numbers = ['one', 'two', 'three', 'four', 'five'];

    const wordIsElement = basicElements.includes(wordLower);
    const sourceIsElement = basicElements.includes(sourceLower);
    const wordIsColor = colors.includes(wordLower);
    const sourceIsColor = colors.includes(sourceLower);
    const wordIsNumber = numbers.includes(wordLower);
    const sourceIsNumber = numbers.includes(sourceLower);

    // Suspicious cross-category connections
    if ((wordIsElement && sourceIsColor) || (wordIsColor && sourceIsElement)) {
      return true;
    }
    if ((wordIsElement && sourceIsNumber) || (wordIsNumber && sourceIsElement)) {
      return true;
    }

    // Specific suspicious pairs - BUT allow legitimate PIE root connections
    const suspiciousPairs = [
      ['water', 'fire'], ['fire', 'water'],
      ['water', 'punjab'], ['punjab', 'water'],
      ['test', 'forest'], ['forest', 'test']
    ];

    // Don't block PIE roots or legitimate etymological forms
    if (wordLower.startsWith('*') || sourceLower.startsWith('*')) {
      return false; // Allow PIE root connections
    }

    for (const [susp1, susp2] of suspiciousPairs) {
      if ((wordLower === susp1 && sourceLower === susp2) || (wordLower === susp2 && sourceLower === susp1)) {
        return true;
      }
    }

    return false;
  }

  // Check if a word is likely a morphological component (prefix/suffix) rather than a true etymological origin
  isMorphologicalComponent(word, sourceWord) {
    const cleanWord = word.toLowerCase().replace(/[-_]/g, '');

    // Common English prefixes that form compound words
    const commonPrefixes = [
      'pre', 're', 'un', 'dis', 'mis', 'over', 'under', 'out', 'up', 'in', 'on',
      'ex', 'de', 'anti', 'pro', 'co', 'inter', 'intra', 'trans', 'sub', 'super',
      'semi', 'multi', 'mega', 'micro', 'mini', 'auto', 'self', 'non', 'post',
      'fore', 'counter', 'cross', 'ultra', 'hyper', 'vice', 'quasi'
    ];

    // Common English suffixes
    const commonSuffixes = [
      'ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ness', 'ment', 'ful',
      'less', 'able', 'ible', 'ward', 'wise', 'like', 'ship', 'hood', 'dom',
      'age', 'ance', 'ence', 'ity', 'ous', 'ious', 'al', 'ic', 'ical'
    ];

    // Check if the word is a common prefix or suffix
    if (commonPrefixes.includes(cleanWord) || commonSuffixes.includes(cleanWord)) {
      return true;
    }

    // Check if sourceWord appears to be a compound word containing this component
    if (sourceWord && sourceWord.toLowerCase().includes(cleanWord)) {
      // Additional context: if the source word contains this component as a clear morphological part
      const sourceClean = sourceWord.toLowerCase().replace(/[-_]/g, '');

      // Check if it's a prefix (word appears at start of source)
      if (sourceClean.startsWith(cleanWord) && sourceClean.length > cleanWord.length + 1) {
        return true;
      }

      // Check if it's a suffix (word appears at end of source)
      if (sourceClean.endsWith(cleanWord) && sourceClean.length > cleanWord.length + 1) {
        return true;
      }

      // Check for hyphenated compounds (like "re-test")
      const hyphenatedPattern = new RegExp(`\\b${cleanWord}-\\w+|\\w+-${cleanWord}\\b`, 'i');
      if (hyphenatedPattern.test(sourceWord)) {
        return true;
      }
    }

    return false;
  }

  // Validate that a language name is legitimate
  isValidLanguageName(languageName) {
    if (!languageName || languageName.length < 3) return false;

    // Must start with capital letter
    if (!/^[A-Z]/.test(languageName)) return false;

    // Reject obvious non-language terms
    const invalidTerms = ['See', 'Also', 'From', 'Word', 'Root', 'Meaning', 'Definition'];
    if (invalidTerms.includes(languageName)) return false;

    return true;
  }

  // Validate the context around an etymology to ensure it's genuine
  validateEtymologicalContext(text, matchIndex, languageName, etymologicalWord) {
    const contextSize = 100;
    const startIndex = Math.max(0, matchIndex - contextSize);
    const endIndex = Math.min(text.length, matchIndex + contextSize);
    const context = text.substring(startIndex, endIndex).toLowerCase();

    // Strong positive indicators
    const positiveIndicators = [
      'from', 'etymology', 'origin', 'source', 'cognate', 'related to',
      'derives from', 'borrowed from', 'descended from', 'comes from',
      'via', 'through', 'root', 'stem', 'base'
    ];

    // Negative indicators that suggest this isn't etymology
    const negativeIndicators = [
      'meaning', 'definition', 'sense of', 'used to mean', 'refers to',
      'example', 'instance', 'such as', 'including', 'like',
      'compare', 'contrast', 'difference', 'similar'
    ];

    // Morphological analysis indicators (suggests this is about word formation, not etymology)
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

    // Special handling for Proto- languages (more authoritative)
    if (languageName.startsWith('Proto-')) {
      positiveScore += 2;
    }

    // Special handling for PIE (most authoritative)
    if (languageName === 'Proto-Indo-European' || languageName.toLowerCase().includes('pie')) {
      positiveScore += 3;
      // PIE roots are almost always valid etymology - lower threshold
      if (etymologicalWord.startsWith('*')) {
        positiveScore += 2;
      }
    }

    // If we detect morphological analysis context, treat it as non-etymological
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

  // Extract etymologically relevant words - prioritize underlined text and strictly filter hyperlinks
  extractMarkedWords(sectionHTML, text, sourceWord) {
    const markedWords = [];
    const seenWords = new Set(); // Track duplicates by language:word combination

    try {
      // PRIORITY 1: Extract underlined words (most relevant for etymology)
      const underlinedWords = this.extractUnderlinedEtymologies(sectionHTML, text, sourceWord);
      for (const word of underlinedWords) {
        const key = `${word.word.language}:${word.word.text}`;
        if (!seenWords.has(key)) {
          markedWords.push(word);
          seenWords.add(key);
        }
      }
      console.log(`Found ${underlinedWords.length} underlined etymological words`);

      // PRIORITY 2: Extract italicized words
      const italicizedWords = this.extractItalicizedEtymologies(sectionHTML, text, sourceWord);
      for (const word of italicizedWords) {
        const key = `${word.word.language}:${word.word.text}`;
        if (!seenWords.has(key)) {
          markedWords.push(word);
          seenWords.add(key);
        }
      }
      console.log(`Found ${italicizedWords.length} italicized etymological words`);

      // PRIORITY 3: Extract hyperlinked words (but with strict etymological context filtering)
      const hyperlinkedWords = this.extractContextualHyperlinkedEtymologies(sectionHTML, text, sourceWord);
      for (const word of hyperlinkedWords) {
        const key = `${word.word.language}:${word.word.text}`;
        if (!seenWords.has(key)) {
          markedWords.push(word);
          seenWords.add(key);
        } else {
          console.log(`Skipped duplicate entry: ${word.word.language} "${word.word.text}"`);
        }
      }
      console.log(`Found ${hyperlinkedWords.length} contextually relevant hyperlinked words`);

    } catch (error) {
      console.error('Error extracting marked words:', error.message);
    }

    return markedWords;
  }

  // Extract underlined words that are etymologically relevant
  extractUnderlinedEtymologies(sectionHTML, text, sourceWord) {
    const etymologies = [];

    try {
      // Look for underlined text patterns (without hyperlinks)
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

          // Skip if same as source word or invalid
          if (underlinedWord === sourceWord || !this.isValidEtymologicalWord(underlinedWord, sourceWord)) {
            continue;
          }

          // Find context around this underlined word
          const wordIndex = text.indexOf(underlinedWord);
          if (wordIndex === -1) continue;

          const contextBefore = text.substring(Math.max(0, wordIndex - 80), wordIndex);
          const contextAfter = text.substring(wordIndex, Math.min(text.length, wordIndex + 80));
          const fullContext = contextBefore + contextAfter;

          // Determine language from context
          const languageInfo = this.extractLanguageFromContext(contextBefore, underlinedWord);

          // Validate etymological context (underlined words get priority)
          const validation = this.validateEtymologicalContext(fullContext, 50, languageInfo.languageName, underlinedWord);

          if (validation.isValid) {
            const relationshipType = this.determineRelationshipType(languageInfo.languageName, underlinedWord, fullContext);

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
                confidence: Math.min(validation.confidence + 0.1, 0.95), // Boost confidence for underlined words
                notes: `Underlined etymology: ${validation.notes}`,
                origin: `${languageInfo.languageName} ${underlinedWord}`,
                priority: 'high'
              }
            });

            console.log(`Found underlined etymological word: ${languageInfo.languageName} "${underlinedWord}" -> "${sourceWord}"`);
          }
        }
      }
    } catch (error) {
      console.error('Error extracting underlined etymologies:', error.message);
    }

    return etymologies;
  }

  // Extract hyperlinked words with enhanced pattern recognition for related words
  extractContextualHyperlinkedEtymologies(sectionHTML, text, sourceWord) {
    const etymologies = [];

    try {
      // Look for links to other etymonline word entries
      const linkPattern = /<a[^>]*href="\/word\/([^"]+)"[^>]*>([^<]+)<\/a>/g;
      let match;

      while ((match = linkPattern.exec(sectionHTML)) !== null) {
        const linkedWordSlug = match[1].trim();
        const linkedWordText = match[2].trim();

        // Skip if it's the same as source word
        if (linkedWordText === sourceWord || linkedWordSlug === sourceWord) continue;

        // Validate that this is a legitimate etymological word
        if (!this.isValidEtymologicalWord(linkedWordText, sourceWord)) continue;

        // Find the context of this hyperlinked word in the plain text
        const wordIndex = text.indexOf(linkedWordText);
        if (wordIndex === -1) continue;

        // Get wider context for better analysis
        const contextBefore = text.substring(Math.max(0, wordIndex - 200), wordIndex);
        const contextAfter = text.substring(wordIndex, Math.min(text.length, wordIndex + 200));
        const fullContext = contextBefore + contextAfter;

        // ENHANCED: Look for related word patterns that indicate cognates/relatives
        const relatedWordPatterns = [
          // Pattern: "Old Frisian erthe, Old Saxon ertha, Middle Dutch eerde, Dutch aarde"
          /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+[^\s,;]+(?:\s*,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+[^\s,;]+)*/gi,
          // Pattern: "compare/cf. Old Frisian word"
          /(?:compare|cf\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+[^\s,;]+/gi,
          // Pattern: "related to Old Norse word"
          /related\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+[^\s,;]+/gi
        ];

        let isRelatedWord = false;
        let detectedLanguage = 'English';
        let relationshipNotes = '';

        // Check for related word patterns in the context
        for (const pattern of relatedWordPatterns) {
          const relatedMatches = [...fullContext.matchAll(pattern)];
          for (const relatedMatch of relatedMatches) {
            if (relatedMatch[0].includes(linkedWordText)) {
              isRelatedWord = true;
              // Extract language from the match
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

        // STRICT FILTERING: Only allow hyperlinked words that appear in explicit etymological statements OR are identified as related words
        let isInEtymologicalContext;
        if (isRelatedWord) {
          // If identified as related word, be more lenient with context validation
          isInEtymologicalContext = {
            isValid: true,
            confidence: 0.8,
            reason: 'Identified as related word in etymology listing'
          };
        } else {
          isInEtymologicalContext = this.isInStrictEtymologicalContext(fullContext, linkedWordText, wordIndex - Math.max(0, wordIndex - 200));
        }

        if (!isInEtymologicalContext.isValid) {
          console.log(`Rejected hyperlinked word "${linkedWordText}": ${isInEtymologicalContext.reason}`);
          continue;
        }

        // Extract language information from context (use detected language if available)
        let languageInfo;
        if (isRelatedWord && detectedLanguage !== 'English') {
          languageInfo = {
            languageName: detectedLanguage,
            languageCode: this.mapLanguageNameToCode(detectedLanguage)
          };
        } else {
          languageInfo = this.extractLanguageFromContext(contextBefore, linkedWordText);
        }

        // Override language detection for PIE roots - they should always be classified as Proto-Indo-European
        if (linkedWordText.startsWith('*')) {
          languageInfo = {
            languageName: 'Proto-Indo-European',
            languageCode: 'ine-pro'
          };
        }

        // Additional validation for etymological context
        const validation = this.validateEtymologicalContext(fullContext, 50, languageInfo.languageName, linkedWordText);

        if (validation.isValid || isRelatedWord) {
          const relationshipType = this.determineRelationshipType(languageInfo.languageName, linkedWordText, fullContext);
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

          console.log(`Found ${isRelatedWord ? 'related' : 'contextually valid hyperlinked'} word: ${languageInfo.languageName} "${linkedWordText}" -> "${sourceWord}" (confidence: ${finalConfidence.toFixed(2)})`);
        } else {
          console.log(`Rejected hyperlinked word "${linkedWordText}": Failed context validation (${validation.notes})`);
        }
      }

      // Also look for links to roots and special etymology pages (like PIE roots) - these are more reliable
      const rootLinkPattern = /<a[^>]*href="\/word\/(\*[^"]+)"[^>]*>([^<]+)<\/a>/g;
      let rootMatch;

      while ((rootMatch = rootLinkPattern.exec(sectionHTML)) !== null) {
        const rootSlug = rootMatch[1].trim();
        const rootText = rootMatch[2].trim();

        // Skip if same as source
        if (rootText === sourceWord) continue;

        // Skip if we already found this root through other extraction methods
        if (etymologies.some(etym => etym.word.text === rootText && etym.word.language === 'ine-pro')) {
          console.log(`Skipped duplicate PIE root: "${rootText}" (already found)`);
          continue;
        }

        // PIE roots are generally reliable, but still validate context
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
              confidence: 0.95, // Very high confidence for linked roots
              notes: `Hyperlinked PIE root: ${validation.notes}`,
              origin: `Proto-Indo-European ${rootText}`,
              sharedRoot: rootText,
              etymologyContext: `Hyperlinked to /word/${rootSlug}`,
              priority: 'high'
            }
          });

          console.log(`Found hyperlinked PIE root: "${rootText}" -> "${sourceWord}"`);
        }
      }

    } catch (error) {
      console.error('Error extracting hyperlinked etymologies:', error.message);
    }

    return etymologies;
  }

  // Extract italicized words that appear in etymological contexts
  extractItalicizedEtymologies(sectionHTML, text, sourceWord) {
    const etymologies = [];

    try {
      // Look for various italic patterns
      const italicPatterns = [
        /<i[^>]*>([^<]+)<\/i>/g,
        /<em[^>]*>([^<]+)<\/em>/g,
        // Sometimes etymonline uses span with italic styles
        /<span[^>]*style="[^"]*italic[^"]*"[^>]*>([^<]+)<\/span>/g
      ];

      for (const pattern of italicPatterns) {
        let match;
        pattern.lastIndex = 0;

        while ((match = pattern.exec(sectionHTML)) !== null) {
          const italicWord = match[1].trim();

          if (!this.isValidEtymologicalWord(italicWord, sourceWord)) continue;

          // Find the context of this italic word in the plain text
          const wordIndex = text.indexOf(italicWord);
          if (wordIndex === -1) continue;

          // Look for language context
          const contextBefore = text.substring(Math.max(0, wordIndex - 80), wordIndex);
          const contextAfter = text.substring(wordIndex, Math.min(text.length, wordIndex + 80));

          // Try to identify the language from context
          const languageMatch = contextBefore.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+$/);

          if (languageMatch) {
            const languageName = languageMatch[1].trim();

            if (!this.isValidLanguageName(languageName)) continue;

            // Validate this is in an etymological context
            const fullContext = contextBefore + contextAfter;
            const validation = this.validateEtymologicalContext(fullContext, 40, languageName, italicWord);

            if (validation.isValid) {
              const languageCode = this.mapLanguageNameToCode(languageName);
              const relationshipType = this.determineRelationshipType(languageName, italicWord, fullContext);

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
                  confidence: validation.confidence * 0.9, // Slightly lower confidence for italic extraction
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
      console.error('Error extracting italicized etymologies:', error.message);
    }

    return etymologies;
  }

  extractRelatedWords(html, sourceWord, sourceLanguage) {
    const connections = [];

    try {
      // DISABLED: Related words section often contains contextual mentions rather than true etymological relationships
      // The "related words" section on etymonline frequently includes words that merely mention the source word
      // in their definitions, creating false bidirectional relationships (like water<->Punjab)

      console.log(`Skipping related words section for "${sourceWord}" - using only etymological extraction methods`);

      // If needed in the future, could implement stricter filtering here:
      // 1. Check if related word's etymology actually connects to source word
      // 2. Validate etymological relationship direction
      // 3. Filter out words that only mention source word in usage examples

    } catch (error) {
      console.error(`Error in extractRelatedWords:`, error.message);
    }

    return connections;
  }

  mapLanguageNameToCode(languageName) {
    const languageMap = {
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

  extractSharedRoot(text, languageName, relatedWord) {
    // Look for Proto- forms first (highest priority) - improved pattern
    const protoPattern = /\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+/g;
    const protoMatches = text.match(protoPattern);

    if (protoMatches && protoMatches.length > 0) {
      // Find the most relevant proto-form based on context
      for (const protoForm of protoMatches) {
        const protoIndex = text.indexOf(protoForm);
        const wordIndex = text.indexOf(relatedWord);
        // If proto-form appears near the related word (within 100 characters)
        if (Math.abs(protoIndex - wordIndex) < 100) {
          return protoForm;
        }
      }
      // Return the first proto-form if none are close
      return protoMatches[0];
    }

    // Look for PIE roots - improved patterns
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

    // Look for "from [Language] [word]" patterns
    const fromPattern = new RegExp(`from\\s+${languageName}\\s+([*\\w\\u00C0-\\u017F\\u0100-\\u017F\\u1E00-\\u1EFF]+)`, 'i');
    const fromMatch = text.match(fromPattern);
    if (fromMatch) {
      return `${languageName} ${fromMatch[1]}`;
    }

    // Look for root patterns like "*wed-" mentioned in the text - improved
    const rootPatterns = [
      /root\s+\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+/g,
      /\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+\s+root/g,
      /\*[a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+(?=\s|$|,|;)/g // Standalone PIE roots
    ];

    for (const rootPattern of rootPatterns) {
      const rootMatch = text.match(rootPattern);
      if (rootMatch) {
        // Extract just the root form, cleaning up "root" text
        const cleanRoot = rootMatch[0].replace(/\broot\s+/gi, '').replace(/\s+root\b/gi, '').trim();
        if (cleanRoot.startsWith('*')) {
          return cleanRoot;
        }
      }
    }

    return null;
  }

  determineRelationshipType(languageName, relatedWord, context = '') {
    // Determine relationship type based on language patterns
    if (languageName.includes('Proto-')) {
      return 'etymology';
    }

    const langLower = languageName.toLowerCase();
    const contextLower = context.toLowerCase();

    // Check for explicit borrowing indicators in context
    if (contextLower.includes('from ' + langLower) ||
        contextLower.includes('borrowed from ' + langLower) ||
        contextLower.includes('via ' + langLower)) {
      return 'borrowing';
    }

    // Use the comprehensive language mapping service instead of hardcoded lists
    const languageMapping = require('./languageMapping');

    try {
      const sourceLanguageCode = 'en'; // Assuming English as source
      const targetLanguageCode = this.mapLanguageNameToCode(languageName);

      // Check if languages are from the same family using the language mapping service
      const areRelated = languageMapping.areLanguagesRelated(sourceLanguageCode, targetLanguageCode);

      if (!areRelated) {
        // Different language families = borrowing
        return 'borrowing';
      }

      // Same language family - determine specific cognate type based on family structure
      const sourceFamily = languageMapping.getLanguageFamily(sourceLanguageCode);
      const targetFamily = languageMapping.getLanguageFamily(targetLanguageCode);

      // Create cognate type based on the most specific shared family level
      const sharedFamily = this.findSharedFamilyLevel(sourceFamily, targetFamily);

      if (sharedFamily) {
        // Convert family name to cognate type (e.g., 'germanic' -> 'cognate_germanic')
        const cognateType = 'cognate_' + sharedFamily.replace(/-/g, '_');
        return cognateType;
      }

      // Fallback to generic cognate if same top-level family
      if (sourceFamily[0] === targetFamily[0]) {
        return 'cognate_' + sourceFamily[0].replace(/-/g, '_');
      }

      return 'cognate';

    } catch (error) {
      console.log(`Error determining relationship type for ${languageName}: ${error.message}`);

      // Fallback: check for proto-languages
      if (langLower.includes('proto-') || langLower.includes('pie') || langLower === 'proto-indo-european') {
        return 'cognate_ancient';
      }

      // If we can't determine the family relationship, assume borrowing for safety
      // This prevents false cognate classifications
      return 'borrowing';
    }
  }

  // Helper method to find the most specific shared family level
  findSharedFamilyLevel(family1, family2) {
    // Find the deepest level where both families share a classification
    for (let i = Math.min(family1.length, family2.length) - 1; i >= 0; i--) {
      if (family1[i] === family2[i]) {
        return family1[i];
      }
    }
    return null;
  }

  // Extract language information from context around a word
  extractLanguageFromContext(contextBefore, word) {
    // Special handling for PIE roots (asterisk prefix) - ALWAYS classify as PIE
    if (word.startsWith('*')) {
      // PIE roots are reconstructed forms, always classify as Proto-Indo-European
      return { languageName: 'Proto-Indo-European', languageCode: 'ine-pro' };
    }

    // Look for explicit language patterns in context
    const languagePatterns = [
      // Match patterns like "Old English wæter" or "Latin testum"
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+[\w*æœøþðɸβɟḱĝʷʲʼ-]+\s*$/,
      // Match patterns like "from Proto-Germanic"
      /from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/,
      // Match patterns like "Proto-Germanic *watr-"
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+\*[\w-]+\s*$/
    ];

    let languageName = 'English'; // Default
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

  // Strict validation that a word appears in genuine etymological context (not just mentioned)
  isInStrictEtymologicalContext(context, word, wordIndex) {
    // Define patterns that indicate genuine etymological relationships
    const etymologicalPatterns = [
      // Direct derivation patterns
      /from\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+[\w*æœøþðɸβɟḱĝʷʲʼ-]+/i,
      /\b(from|via|through)\s+[A-Z]/i,

      // Proto-language patterns
      /Proto-[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*\*[\w-]+/i,
      /PIE\s+\*[\w-]+/i,

      // Explicit etymological statements
      /\b(derives?|derived|comes?)\s+from/i,
      /\b(ancestor|origin|root)\b/i,
      /\b(cognate|related)\s+to/i,

      // Language source patterns
      /\b(Old|Middle|Ancient|Proto-)\s*[A-Z][a-z]+/i
    ];

    // Patterns that indicate NON-etymological contexts (usage examples, definitions)
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

    // Get context around the word (±50 characters)
    const wordContext = context.substring(Math.max(0, wordIndex - 50), Math.min(context.length, wordIndex + 50));

    // Check if context contains non-etymological patterns first
    for (const pattern of nonEtymologicalPatterns) {
      if (pattern.test(wordContext)) {
        return {
          isValid: false,
          confidence: 0.1,
          reason: `Word appears in non-etymological context: ${pattern.source}`
        };
      }
    }

    // Check if context contains etymological patterns
    let etymologicalScore = 0;
    let matchedPatterns = [];

    for (const pattern of etymologicalPatterns) {
      if (pattern.test(wordContext)) {
        etymologicalScore += 1;
        matchedPatterns.push(pattern.source);
      }
    }

    // Additional scoring for specific indicators
    if (wordContext.includes('from ')) etymologicalScore += 0.5;
    if (wordContext.includes('*')) etymologicalScore += 0.3; // Reconstructed forms
    if (wordContext.match(/\b(c\.|circa|about)\s+\d/)) etymologicalScore += 0.2; // Dates

    const confidence = Math.min(etymologicalScore / 2, 1.0); // Normalize to 0-1

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

  // Escape special regex characters
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Check if an etymology section is actually relevant to the target word
  isRelevantEtymologySection(sectionText, targetWord) {
    // Clean up HTML entities and normalize text
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

    // Special handling for PIE roots
    if (targetWord.startsWith('*')) {
      const rootWithoutAsterisk = targetLower.replace('*', '');

      // PIE roots can appear in various forms
      const piePatterns = [
        targetLower,                                    // *wed-
        rootWithoutAsterisk,                           // wed-
        `${targetLower} (`,                           // *wed- (1)
        `${rootWithoutAsterisk} (`,                   // wed- (1)
        `pie root ${targetLower}`,                    // PIE root *wed-
        `pie root ${rootWithoutAsterisk}`,            // PIE root wed-
        `root ${targetLower}`,                        // root *wed-
        `root ${rootWithoutAsterisk}`,                // root wed-
        `proto-indo-european ${targetLower}`,         // Proto-Indo-European *wed-
        `proto-indo-european ${rootWithoutAsterisk}`  // Proto-Indo-European wed-
      ];

      // Be more permissive - if ANY of these patterns appear anywhere in the section, consider it relevant
      for (const pattern of piePatterns) {
        if (sectionLower.includes(pattern)) {
          console.log(`Found PIE root pattern "${pattern}" in section for "${targetWord}"`);
          return true;
        }
      }

      // Also check if the section prominently features the root (case-insensitive and flexible)
      const rootMatches = [
        // Pattern: *wed-( or wed-(
        new RegExp(`\\*?${this.escapeRegex(rootWithoutAsterisk)}\\s*\\(`, 'i'),
        // Pattern: "*wed-" or "wed-" at word boundaries
        new RegExp(`\\b\\*?${this.escapeRegex(rootWithoutAsterisk)}\\b`, 'i'),
        // Pattern: root mentioned with common prefixes/suffixes
        new RegExp(`\\b(?:pie|proto|root|etymology)\\s+\\*?${this.escapeRegex(rootWithoutAsterisk)}`, 'i')
      ];

      for (const pattern of rootMatches) {
        if (pattern.test(sectionLower)) {
          console.log(`Found PIE root regex match for "${targetWord}" in section`);
          return true;
        }
      }

      console.log(`No PIE root patterns found for "${targetWord}" in section: ${firstTenWords}`);
      return false;
    }

    // For regular words, check if the section starts with our target word (or very close to the beginning)
    if (firstTenWords.includes(targetLower)) {
      return true;
    }

    // Allow for variants with punctuation (test, test., test (n.), etc.)
    const variants = [
      targetLower,
      targetLower + '.',
      targetLower + ' (',
      targetLower + ','
    ];

    return variants.some(variant => firstTenWords.includes(variant));
  }

  // Detect if this word is a shortened form of another word
  detectShortenedWordRelationships(text, sourceWord) {
    const connections = [];

    try {
      // Patterns to detect shortened word relationships
      const shorteningPatterns = [
        // "shortening of [word]"
        /(?:shortening|abbreviation|short)\s+of\s+([a-zA-Z]+)/gi,

        // "shortened from [word]"
        /shortened\s+from\s+([a-zA-Z]+)/gi,

        // "short for [word]"
        /short\s+for\s+([a-zA-Z]+)/gi,

        // "clipped from [word]"
        /(?:clipped|clipping)\s+(?:from|of)\s+([a-zA-Z]+)/gi,

        // "truncation of [word]"
        /truncation\s+of\s+([a-zA-Z]+)/gi,

        // "from [word], shortened"
        /from\s+([a-zA-Z]+)[^.]*shortened/gi
      ];

      for (const pattern of shorteningPatterns) {
        let match;
        pattern.lastIndex = 0;

        while ((match = pattern.exec(text)) !== null) {
          const fullWord = match[1].trim().toLowerCase();

          // Skip if it matches the source word itself
          if (fullWord === sourceWord.toLowerCase()) continue;

          // Validate that this looks like a real word
          if (!this.isValidEtymologicalWord(fullWord, sourceWord)) continue;

          console.log(`Detected shortened relationship: "${sourceWord}" is shortened from "${fullWord}"`);

          const connection = {
            word: {
              id: this.generateId(),
              text: fullWord,
              language: 'en', // Assume English for shortened forms
              partOfSpeech: 'full_form',
              definition: `Full form of "${sourceWord}"`
            },
            relationship: {
              type: 'shortened_from',
              confidence: 0.9, // High confidence for explicit shortening statements
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
      console.error('Error detecting shortened word relationships:', error.message);
    }

    return connections;
  }

  // Extract derivatives from PIE root pages
  extractPIERootDerivatives(text, pieRoot) {
    const derivatives = [];

    try {
      console.log(`Extracting derivatives for PIE root ${pieRoot}...`);

      // Look for explicit derivative patterns that are more precise
      const derivativePatterns = [
        // Pattern: "It forms all or part of: word1, word2, word3" - improved to handle longer lists
        /It\s+(?:forms|might\s+form)\s+all\s+or\s+part\s+of:\s*([^]*?)(?:\n\s*It\s|\n\s*Etymology|\n\s*From|\n\s*Related|\n\s*See|\n\s*Also\s|\n\s*Entries|\n\s*$|$)/gi,

        // Pattern: "source also of word1, word2, word3" - more generous capture
        /source\s+also\s+of\s+([^]*?)(?:\n\s*It\s|\n\s*Etymology|\n\s*From|\n\s*Related|\n\s*See|\n\s*Also\s|\n\s*Entries|\n\s*$|$)/gi,

        // Pattern: "cognate with word1, word2" - more generous capture
        /cognate\s+with\s+([^]*?)(?:\n\s*It\s|\n\s*Etymology|\n\s*From|\n\s*Related|\n\s*See|\n\s*Also\s|\n\s*Entries|\n\s*$|$)/gi,

        // Pattern: "related to word1, word2" - more generous capture
        /related\s+to\s+([^]*?)(?:\n\s*It\s|\n\s*Etymology|\n\s*From|\n\s*Related|\n\s*See|\n\s*Also\s|\n\s*Entries|\n\s*$|$)/gi
      ];

      // Track unique words to avoid duplicates
      const foundWords = new Set();

      for (const pattern of derivativePatterns) {
        let match;
        pattern.lastIndex = 0;

        while ((match = pattern.exec(text)) !== null) {
          console.log(`Found derivative pattern: ${match[0]}`);

          if (match[1]) {
            // Split the derivative list and clean up
            const wordList = match[1];

            // Split by common delimiters and clean each word - improved to handle more patterns
            const words = wordList.split(/[,;]+/)
              .map(word => {
                // Remove parentheses like "(n.1)", quotes, and extra whitespace
                return word.replace(/\s*\([^)]*\)\s*/g, '').replace(/["']/g, '').replace(/\s+/g, ' ').trim();
              })
              .filter(word => {
                // More permissive filtering to catch all valid derivatives
                if (word.length < 2) return false;
                if (!/^[a-zA-Z][a-zA-Z-]*[a-zA-Z]?$/.test(word)) return false;
                if (this.isCommonWord(word)) return false;
                if (word === pieRoot.replace('*', '')) return false;

                // Don't filter out words that are just short but valid (like "wed", "woo", "vow")
                return true;
              });

            for (const word of words) {
              const cleanWord = word.toLowerCase().trim();
              if (cleanWord && !foundWords.has(cleanWord)) {
                foundWords.add(cleanWord);

                // Try to determine language based on context
                let language = 'en'; // Default to English
                let wordText = cleanWord;

                // Create derivative connection
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

                console.log(`Found PIE derivative: ${wordText} <- ${pieRoot}`);
              }
            }
          }
        }
      }

      console.log(`Extracted ${derivatives.length} derivatives for ${pieRoot}`);

    } catch (error) {
      console.error(`Error extracting PIE root derivatives for ${pieRoot}:`, error.message);
    }

    return derivatives;
  }

  // Check if a word is too common to be a meaningful derivative
  isCommonWord(word) {
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

  generateId() {
    return 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  // Update the etymology database with new etymological connections
  updateEtymologyDatabase(sourceWord, etymologyData) {
    if (!etymologyData || !etymologyData.connections) return;

    this.processedWords.add(sourceWord);

    // Track shortened form relationships for reverse lookup
    if (!this.shortenedFormsDatabase) {
      this.shortenedFormsDatabase = new Map();
    }

    for (const connection of etymologyData.connections) {
      const { word: etimWord, relationship } = connection;

      // ENHANCED: Track shortened form relationships
      if (relationship.type === 'shortened_from') {
        // sourceWord is shortened from etimWord.text
        if (!this.shortenedFormsDatabase.has(etimWord.text.toLowerCase())) {
          this.shortenedFormsDatabase.set(etimWord.text.toLowerCase(), []);
        }
        const shortenedForms = this.shortenedFormsDatabase.get(etimWord.text.toLowerCase());
        if (!shortenedForms.some(form => form.word === sourceWord)) {
          shortenedForms.push({
            word: sourceWord,
            confidence: relationship.confidence,
            notes: relationship.notes
          });
          console.log(`Tracked shortened form relationship: ${etimWord.text} -> ${sourceWord}`);
        }
      }

      // FIXED: Also use origin as fallback for shared root
      const sharedRoot = relationship.sharedRoot || relationship.origin || etimWord.text;
      if (!etimWord || !etimWord.text || !sharedRoot) continue;

      // Create database key from shared root or origin
      const etymologyKey = this.normalizeEtymologyKey(sharedRoot);

      if (!this.etymologyDatabase.has(etymologyKey)) {
        this.etymologyDatabase.set(etymologyKey, []);
      }

      const wordEntry = {
        word: sourceWord,
        language: 'en', // Assuming source is English for now
        etymologicalForm: etimWord.text,
        etymologicalLanguage: etimWord.language,
        relationshipType: relationship.type,
        confidence: relationship.confidence,
        notes: relationship.notes,
        sharedRoot: sharedRoot
      };

      // Add to database if not already present
      const existingEntries = this.etymologyDatabase.get(etymologyKey);
      if (!existingEntries.some(entry => entry.word === sourceWord)) {
        existingEntries.push(wordEntry);
        console.log(`Added to etymology database: ${etymologyKey} -> ${sourceWord}`);
      }
    }
  }

  // Normalize etymology keys for consistent cross-referencing
  normalizeEtymologyKey(etymologyString) {
    if (!etymologyString) return '';

    let normalized = etymologyString.trim();

    // FIXED: Better handling of PIE roots and etymological forms
    // Extract just the etymological form, preserving asterisks for reconstructed forms
    const pieRootMatch = normalized.match(/\*([a-zA-Z₀-₉ʰₑʷβɟḱĝʷʲʼ-]+)/);
    if (pieRootMatch) {
      // Keep the asterisk for PIE roots - it's important for identification
      return '*' + pieRootMatch[1].toLowerCase();
    }

    // Remove language prefixes but keep the etymological form
    normalized = normalized
      .replace(/^(Proto-Indo-European|PIE)\s+/i, '')
      .replace(/^(Proto-[A-Za-z-]+|Old [A-Za-z]+|Middle [A-Za-z]+|Ancient [A-Za-z]+|[A-Za-z]+)\s+/i, '')
      .trim()
      .toLowerCase();

    // Handle reconstructed forms - preserve the asterisk
    if (normalized.startsWith('*')) {
      return normalized;
    }

    // Remove trailing punctuation but preserve meaningful characters
    normalized = normalized.replace(/[.,;:!?]+$/, '');

    return normalized;
  }

  // IMPROVED: Enhanced cross-references with better validation
  enhanceWithCrossReferences(etymologyData, sourceWord) {
    if (!etymologyData || !etymologyData.connections) return etymologyData;

    const enhanced = { ...etymologyData };
    enhanced.crossReferences = [];
    const addedConnections = []; // Track additional connections we add

    for (const connection of etymologyData.connections) {
      const { relationship } = connection;

      const sharedRoot = relationship.sharedRoot || relationship.origin;
      if (!sharedRoot) continue;

      const etymologyKey = this.normalizeEtymologyKey(sharedRoot);
      const relatedWords = this.etymologyDatabase.get(etymologyKey);

      if (relatedWords && relatedWords.length > 1) {
        // Find words with the same etymological origin (excluding current word)
        const potentialCognates = relatedWords
          .filter(entry => entry.word !== sourceWord)
          .map(entry => ({
            word: entry.word,
            language: entry.language,
            etymologicalForm: entry.etymologicalForm,
            relationshipType: 'cognate_cross_reference',
            sharedRoot: sharedRoot,
            confidence: Math.min(0.75, entry.confidence), // Reduced confidence for cross-references
            notes: `Shares etymology ${sharedRoot} with ${sourceWord}`
          }));

        // IMPROVED: Filter cognates to remove suspicious connections
        const validCognates = potentialCognates.filter(cognate => {
          // Don't add cross-references to semantically suspicious pairs
          if (this.areSemanticallySuspicious(cognate.word, sourceWord)) {
            console.log(`Rejected cross-reference cognate: ${sourceWord} -> ${cognate.word} (semantically suspicious)`);
            return false;
          }

          // Require higher confidence for cross-references
          if (cognate.confidence < 0.65) {
            console.log(`Rejected cross-reference cognate: ${sourceWord} -> ${cognate.word} (low confidence: ${cognate.confidence})`);
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

          // ENHANCED: Add only the highest confidence cognates as actual connections (more conservative)
          const topCognates = validCognates
            .filter(cognate => cognate.confidence > 0.75) // Higher threshold
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 2); // Reduced to top 2 to avoid clutter

          for (const cognate of topCognates) {
            // Additional validation before adding bidirectional connection
            if (this.isValidCrossReferenceConnection(sourceWord, cognate.word, sharedRoot)) {
              const bidirectionalConnection = {
                word: {
                  id: this.generateId(),
                  text: cognate.word,
                  language: cognate.language,
                  partOfSpeech: 'cognate',
                  definition: `Related to "${sourceWord}" through shared root "${sharedRoot}"`
                },
                relationship: {
                  type: 'etymological_cognate',
                  confidence: Math.min(cognate.confidence * 0.9, 0.85), // Reduced confidence for cross-refs
                  notes: cognate.notes,
                  origin: sharedRoot,
                  sharedRoot: sharedRoot,
                  isFromCrossReference: true
                }
              };
              addedConnections.push(bidirectionalConnection);
            } else {
              console.log(`Rejected bidirectional connection: ${sourceWord} -> ${cognate.word} (failed validation)`);
            }
          }
        }
      }
    }

    // ENHANCED: Also check for reverse shortened form connections (only if valid)
    if (this.shortenedFormsDatabase && this.shortenedFormsDatabase.has(sourceWord.toLowerCase())) {
      const shortenedForms = this.shortenedFormsDatabase.get(sourceWord.toLowerCase());

      for (const shortenedForm of shortenedForms) {
        // Validate shortened form connection
        if (shortenedForm.confidence > 0.8 && !this.areSemanticallySuspicious(shortenedForm.word, sourceWord)) {
          const reverseConnection = {
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
          console.log(`Added reverse shortened form connection: ${sourceWord} -> ${shortenedForm.word}`);
        }
      }
    }

    // Add the cross-reference connections to the main connections list
    enhanced.connections = [...(enhanced.connections || []), ...addedConnections];

    console.log(`Found ${enhanced.crossReferences.length} cross-reference groups for "${sourceWord}"`);
    console.log(`Added ${addedConnections.length} bidirectional connections (improved filtering)`);
    return enhanced;
  }

  // Validate cross-reference connections
  isValidCrossReferenceConnection(sourceWord, targetWord, sharedRoot) {
    // Basic validation
    if (!sourceWord || !targetWord || !sharedRoot) {
      return false;
    }

    // Don't create cross-references for identical words
    if (sourceWord.toLowerCase() === targetWord.toLowerCase()) {
      return false;
    }

    // Check for semantic compatibility
    if (this.areSemanticallySuspicious(sourceWord, targetWord)) {
      return false;
    }

    // Ensure the shared root is substantial (not just a single character or very short)
    const cleanRoot = this.normalizeEtymologyKey(sharedRoot);
    if (cleanRoot.length < 3) {
      return false;
    }

    // Don't create cross-references for very common/generic roots that might be coincidental
    const genericRoots = ['*er', '*ed', '*in', '*on', '*an', '*el', 'the', 'and', 'from'];
    if (genericRoots.includes(cleanRoot.toLowerCase())) {
      return false;
    }

    return true;
  }

  // Public method to find all words sharing etymological origins with a given word
  async findEtymologicalCognates(word, minConfidence = 0.7) {
    // First, make sure we have data for this word
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

  // Get statistics about the etymology database
  getEtymologyDatabaseStats() {
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

  // Clear all caches for consistent behavior after restarts
  clearAllCaches() {
    cache.flushAll();
    this.etymologyDatabase.clear();
    this.processedWords.clear();
    if (this.shortenedFormsDatabase) {
      this.shortenedFormsDatabase.clear();
    }
    console.log('All etymonline caches cleared');
  }

  // Clear cache for a specific word
  clearWordCache(word, language = 'en') {
    const cacheKey = `etymonline_${word}_${language}`;
    cache.del(cacheKey);
    console.log(`Cache cleared for "${word}" (${language})`);
  }
}

module.exports = new EtymonlineAPI();