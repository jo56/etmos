const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');
// Using only real etymology sources from Wiktionary and Dictionary API

const languageMapping = require('./services/languageMapping');

// Development cache-busting mechanism
function getEtymologyService() {
  // Always clear cache in development to pick up changes immediately
  delete require.cache[require.resolve('./services/etymologyService')];
  delete require.cache[require.resolve('./services/wiktionaryAPI')];
  // Removed universal engine - using only real sources
  return require('./services/etymologyService');
}

// Use cache-busted service
const etymologyService = getEtymologyService();

// Using only verified etymology sources - no synthetic data generation

const app = express();
const port = process.env.PORT || 54330;

// Enhanced cache for faster response times
const graphCache = new NodeCache({
  stdTTL: 1800, // 30 minutes default
  checkperiod: 600, // Check for expired keys every 10 minutes
  useClones: false, // Better performance
  maxKeys: 10000 // Limit cache size
});

// Quick response cache for immediate feedback
const quickCache = new NodeCache({
  stdTTL: 300, // 5 minutes for quick responses
  checkperiod: 60, // Check every minute
  useClones: false,
  maxKeys: 1000
});

// Helper function to intelligently select connections with randomization and PIE prioritization
function selectConnectionsWithRandomization(connections, maxCount, prioritizePieRoots = true) {
  if (connections.length <= maxCount) {
    return connections;
  }

  // Separate PIE roots and other connections
  const pieRoots = prioritizePieRoots ? connections.filter(conn =>
    conn.word.text.startsWith('*') ||
    conn.word.language === 'ine-pro' ||
    conn.word.language.includes('pro')
  ) : [];

  const nonPieConnections = prioritizePieRoots ? connections.filter(conn =>
    !conn.word.text.startsWith('*') &&
    conn.word.language !== 'ine-pro' &&
    !conn.word.language.includes('pro')
  ) : connections;

  const selected = [];

  // Include up to 3 PIE roots, randomizing them if there are more available
  if (prioritizePieRoots && pieRoots.length > 0) {
    const maxPieConnections = 3;
    const pieToInclude = Math.min(pieRoots.length, maxPieConnections, maxCount);

    if (pieRoots.length <= pieToInclude) {
      // Include all PIE roots if we have 3 or fewer
      selected.push(...pieRoots);
    } else {
      // Randomize PIE roots selection to get exactly 3
      const shuffledPieRoots = [...pieRoots];
      for (let i = shuffledPieRoots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPieRoots[i], shuffledPieRoots[j]] = [shuffledPieRoots[j], shuffledPieRoots[i]];
      }
      selected.push(...shuffledPieRoots.slice(0, pieToInclude));
    }
  }

  // Fill remaining slots with randomized selection from non-PIE connections
  const remainingSlots = maxCount - selected.length;
  if (remainingSlots > 0 && nonPieConnections.length > 0) {
    // Shuffle the non-PIE connections for randomization
    const shuffled = [...nonPieConnections];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Take the needed amount from shuffled connections
    selected.push(...shuffled.slice(0, remainingSlots));
  }

  return selected;
}

// Helper function to find cross-node connections based on word matching
function findCrossNodeConnections(expandingNode, existingNodes, existingEdges) {
  const crossConnections = [];
  const expandingWord = expandingNode.data.word;

  // Get words from the expanding node's description/notes
  const expandingWords = extractWordsFromDescription(expandingWord);

  existingNodes.forEach(existingNode => {
    if (existingNode.id === expandingNode.id) return; // Skip self

    const existingWord = existingNode.data.word;
    const existingWords = extractWordsFromDescription(existingWord);

    // Check if they share common words (pass language info for cognate detection)
    const sharedWords = findSharedWords(expandingWords, existingWords, expandingWord.language, existingWord.language);

    if (sharedWords.length > 0) {
      // Additional validation: check if the shared words make linguistic sense
      if (isValidCrossConnection(expandingWord, existingWord, sharedWords)) {
        // Check if they're not already connected
        const edgeKey1 = `edge_${expandingNode.id}_${existingNode.id}`;
        const edgeKey2 = `edge_${existingNode.id}_${expandingNode.id}`;

        const alreadyConnected = existingEdges.some(edge =>
          edge.id === edgeKey1 || edge.id === edgeKey2 ||
          (edge.source === expandingNode.id && edge.target === existingNode.id) ||
          (edge.source === existingNode.id && edge.target === expandingNode.id)
        );

        if (!alreadyConnected) {
          crossConnections.push({
            id: edgeKey1,
            source: expandingNode.id,
            target: existingNode.id,
            data: {
              connection: {
                id: edgeKey1,
                sourceWordId: expandingNode.id,
                targetWordId: existingNode.id,
                relationshipType: 'shared_description',
                confidence: calculateCrossConnectionConfidence(expandingWord, existingWord, sharedWords),
                notes: `Shared etymological elements: ${sharedWords.join(', ')}`,
                origin: 'cross_node_analysis',
                sharedRoot: sharedWords[0]
              }
            }
          });
        }
      }
    }
  });

  return crossConnections;
}

// Helper function to extract meaningful words from word descriptions/etymology
function extractWordsFromDescription(word) {
  const words = new Set();

  // Add the word itself (clean it first, but check for validity first)
  if (!isReconstructedForm(word.text)) {
    const cleanedWord = cleanWordText(word.text);
    if (cleanedWord.length > 2) {
      words.add(cleanedWord);
    }
  }

  // Extract from etymology if available - be more selective
  if (word.etymology) {
    const etymologyWords = word.etymology.toLowerCase()
      .split(/[\s,;:.!?()\[\]"'*<>]+/)
      .filter(w => !isReconstructedForm(w) && isValidEtymologyWord(w)) // Check BEFORE cleaning
      .map(w => cleanWordText(w))
      .filter(w => w.length > 3 && !isStopWord(w));
    etymologyWords.forEach(w => words.add(w));
  }

  // Extract from meaning if available - be more selective
  if (word.meaning) {
    const meaningWords = word.meaning.toLowerCase()
      .split(/[\s,;:.!?()\[\]"'*<>]+/)
      .filter(w => !isReconstructedForm(w) && isValidMeaningWord(w)) // Check BEFORE cleaning
      .map(w => cleanWordText(w))
      .filter(w => w.length > 3 && !isStopWord(w));
    meaningWords.forEach(w => words.add(w));
  }

  return Array.from(words);
}

// Helper function to clean words of linguistic notation
function cleanWordText(word) {
  return word
    .toLowerCase()
    .replace(/^\*/, '') // Remove reconstruction asterisks
    .replace(/^-/, '') // Remove prefix hyphens
    .replace(/-$/, '') // Remove suffix hyphens
    .replace(/[0-9]/g, '') // Remove numbers
    .replace(/[^\w]/g, '') // Remove special chars except letters
    .trim();
}

// Helper function to check if a word is a reconstructed form or linguistic notation
function isReconstructedForm(word) {
  if (typeof word !== 'string') return true;
  const trimmed = word.trim();
  return trimmed.startsWith('*') ||
         trimmed.startsWith('-') ||
         trimmed.endsWith('-') ||
         /^\*.*-$/.test(trimmed) || // Forms like "*paewr-"
         trimmed.length < 3;
}

// Helper function to validate etymology words
function isValidEtymologyWord(word) {
  if (typeof word !== 'string') return false;
  const trimmed = word.trim();

  // Skip very short words, reconstructed forms, and linguistic notation
  if (trimmed.length < 3) return false;
  if (trimmed.startsWith('*')) return false;
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) return false;
  if (/^[a-z]{1,2}$/.test(trimmed)) return false; // Skip single/double letters
  if (/^\d/.test(trimmed)) return false; // Skip words starting with numbers

  // Skip linguistic notation and proto-forms
  if (/^(proto|pie|ine)$/.test(trimmed.toLowerCase())) return false;
  if (trimmed.includes('*')) return false; // Any form with asterisk

  return true;
}

// Helper function to validate meaning words
function isValidMeaningWord(word) {
  if (typeof word !== 'string') return false;
  const trimmed = word.trim().toLowerCase();

  // Skip very short words and common linguistic terms
  if (trimmed.length < 3) return false;

  // Expanded set of linguistic terms to skip
  const linguisticTerms = new Set([
    'see', 'also', 'from', 'via', 'related', 'compare', 'cognate', 'akin',
    'perhaps', 'possibly', 'literally', 'originally', 'meaning', 'sense',
    'thus', 'hence', 'therefore', 'probably', 'likely', 'uncertain',
    'variant', 'form', 'root', 'stem', 'base'
  ]);

  return !linguisticTerms.has(trimmed);
}

// Enhanced function to find shared words with better cognate detection
function findSharedWords(words1, words2, lang1, lang2) {
  const sharedWords = [];

  // Direct matches (cleaned)
  const directMatches = words1.filter(word => words2.includes(word) && word.length > 3);
  sharedWords.push(...directMatches);

  // Cognate detection for different languages
  if (lang1 !== lang2) {
    const cognates = findCognates(words1, words2, lang1, lang2);
    sharedWords.push(...cognates);
  }

  return [...new Set(sharedWords)]; // Remove duplicates
}

// Helper function to detect cognates between different languages
function findCognates(words1, words2, lang1, lang2) {
  const cognates = [];

  // Common Indo-European cognate patterns
  const cognatePatterns = getCognatePatterns(lang1, lang2);

  for (const word1 of words1) {
    for (const word2 of words2) {
      if (areCognates(word1, word2, cognatePatterns)) {
        cognates.push(word1);
        break;
      }
    }
  }

  return cognates;
}

// Helper function to check if two words are cognates
function areCognates(word1, word2, patterns) {
  if (word1.length < 4 || word2.length < 4) return false;

  // Check for common cognate patterns
  for (const pattern of patterns) {
    if (pattern.test(word1, word2)) {
      return true;
    }
  }

  // Check for similar word structure (same length ±1, similar beginning/ending)
  if (Math.abs(word1.length - word2.length) <= 1) {
    const similarity = calculateSimilarity(word1, word2);
    return similarity >= 0.6; // 70% similarity threshold for cognates
  }

  return false;
}

// Helper function to get cognate patterns for language pairs
function getCognatePatterns(lang1, lang2) {
  const patterns = [];

  // Common Indo-European patterns
  if (['en', 'de', 'nl'].includes(lang1) && ['en', 'de', 'nl'].includes(lang2)) {
    // Germanic language patterns
    patterns.push({
      test: (w1, w2) => w1.replace(/th/g, 'd') === w2 || w2.replace(/th/g, 'd') === w1 // th/d correspondence
    });
    patterns.push({
      test: (w1, w2) => w1.replace(/f/g, 'p') === w2 || w2.replace(/f/g, 'p') === w1 // f/p correspondence
    });
  }

  if (['en', 'fr', 'es', 'it'].includes(lang1) && ['en', 'fr', 'es', 'it'].includes(lang2)) {
    // Romance/Germanic patterns
    patterns.push({
      test: (w1, w2) => w1.replace(/qu/g, 'c') === w2 || w2.replace(/qu/g, 'c') === w1
    });
  }

  return patterns;
}

// Helper function to calculate string similarity
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Helper function to calculate edit distance (Levenshtein distance)
function getEditDistance(str1, str2) {
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

// Helper function to check if a word is a stop word
function isStopWord(word) {
  const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over', 'this', 'that', 'these', 'those', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can']);
  return stopWords.has(word.toLowerCase());
}

// Enhanced validation for cross-node connections
function isValidCrossConnection(word1, word2, sharedWords) {
  // Don't create cross-connections for semantically unrelated basic concepts
  const basicConcepts = {
    elements: ['fire', 'water', 'earth', 'air', 'wind'],
    colors: ['red', 'blue', 'green', 'yellow', 'black', 'white', 'brown'],
    numbers: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
  };

  const word1Lower = word1.text.toLowerCase();
  const word2Lower = word2.text.toLowerCase();

  // Prevent connections between different basic concept categories
  for (const [category1, concepts1] of Object.entries(basicConcepts)) {
    for (const [category2, concepts2] of Object.entries(basicConcepts)) {
      if (category1 !== category2) {
        if (concepts1.includes(word1Lower) && concepts2.includes(word2Lower)) {
          console.log(`Blocking cross-connection between ${word1Lower} (${category1}) and ${word2Lower} (${category2})`);
          return false;
        }
      }
    }
  }

  // Check if shared words are meaningful (not just stop words or tiny fragments)
  const meaningfulSharedWords = sharedWords.filter(word =>
    word.length >= 4 &&
    !isStopWord(word) &&
    !isReconstructedForm(word) &&
    word.match(/^[a-z]+$/) // Only letters, no special chars
  );

  if (meaningfulSharedWords.length === 0) {
    console.log(`Blocking cross-connection: no meaningful shared words between ${word1.text} and ${word2.text}`);
    return false;
  }

  return true;
}

// Calculate confidence score for cross-connections
function calculateCrossConnectionConfidence(word1, word2, sharedWords) {
  let confidence = 0.5; // Base confidence

  // Boost confidence for same language
  if (word1.language === word2.language) {
    confidence += 0.1;
  }

  // Boost confidence for multiple meaningful shared words
  const meaningfulSharedWords = sharedWords.filter(word =>
    word.length >= 4 && !isStopWord(word)
  );

  confidence += Math.min(0.3, meaningfulSharedWords.length * 0.1);

  // Cap confidence for cross-connections (they're always less certain)
  return Math.min(0.8, confidence);
}

app.use(cors());
app.use(express.json());

// API Routes

// Search/discover etymological connections for a word
app.get('/api/etymology/search', async (req, res) => {
  const { word, language } = req.query;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  try {
    console.log(`Searching etymology for: "${word}" (language: ${language || 'any'})`);

    const etymologyData = await getEtymologyService().findEtymologicalConnections(word, language);

    // Convert to graph format
    const nodes = [];
    const edges = [];

    // Add the source word as a node
    nodes.push({
      id: etymologyData.sourceWord.id,
      data: {
        word: etymologyData.sourceWord,
        expanded: false,
        isSource: true
      }
    });

    // Add connected words as nodes and create edges
    etymologyData.connections.forEach(connection => {
      // Add connected word as node
      nodes.push({
        id: connection.word.id,
        data: {
          word: connection.word,
          expanded: false,
          isSource: false
        }
      });

      // Create edge between source and connected word
      const edgeId = `edge_${etymologyData.sourceWord.id}_${connection.word.id}`;
      edges.push({
        id: edgeId,
        source: etymologyData.sourceWord.id,
        target: connection.word.id,
        data: {
          connection: {
            id: edgeId,
            sourceWordId: etymologyData.sourceWord.id,
            targetWordId: connection.word.id,
            relationshipType: connection.relationship.type,
            confidence: connection.relationship.confidence,
            notes: connection.relationship.notes,
            origin: connection.relationship.origin,
            sharedRoot: connection.relationship.sharedRoot
          }
        }
      });
    });

    // Filter edges based on our connection rules
    const filteredEdges = filterConnectionsByRules(edges, nodes);

    const result = {
      sourceWord: etymologyData.sourceWord,
      nodes,
      edges: filteredEdges,
      center: etymologyData.sourceWord.id,
      totalConnections: etymologyData.connections.length
    };

    res.json(result);

  } catch (error) {
    console.error('Error searching etymology:', error);
    res.status(500).json({ error: 'Failed to search etymology' });
  }
});

// Expand connections for a specific word in the graph
app.post('/api/etymology/expand', async (req, res) => {
  const { word, language, existingNodes, maxConnections = 6 } = req.body;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  try {
    console.log(`Expanding etymology for: "${word}" (language: ${language || 'any'}) with max ${maxConnections} connections`);

    // Get fresh etymology data without caching to enable randomization
    const etymologyService = getEtymologyService();
    const etymologyData = await etymologyService.findEtymologicalConnections(word, language, true);

    // Apply randomization and connection limiting
    const selectedConnections = selectConnectionsWithRandomization(etymologyData.connections, maxConnections, true);

    // IMPROVED: Create a map of existing nodes for efficient lookup
    const existingNodesMap = new Map();
    const existingNodeIds = new Set();
    if (existingNodes && Array.isArray(existingNodes)) {
      existingNodes.forEach(node => {
        existingNodeIds.add(node.id);
        if (node.data && node.data.word) {
          const key = `${node.data.word.text.toLowerCase()}_${node.data.word.language.toLowerCase()}`;
          existingNodesMap.set(key, node);
        }
      });
    }

    const newNodes = [];
    const newEdges = [];

    // Find the source word in existing nodes or create it
    let sourceNodeId = null;
    const sourceKey = `${word.toLowerCase()}_${language.toLowerCase()}`;
    const existingSourceNode = existingNodesMap.get(sourceKey);

    if (existingSourceNode) {
      sourceNodeId = existingSourceNode.id;
    } else {
      sourceNodeId = etymologyData.sourceWord.id;
      newNodes.push({
        id: sourceNodeId,
        data: {
          word: etymologyData.sourceWord,
          expanded: true,
          isSource: false
        }
      });
    }

    // IMPROVED: Add new connected words as nodes and create edges, linking to existing nodes when possible
    selectedConnections.forEach(connection => {
      const connectionKey = `${connection.word.text.toLowerCase()}_${connection.word.language.toLowerCase()}`;
      const existingNode = existingNodesMap.get(connectionKey);

      let targetNodeId;
      if (existingNode) {
        // Link to existing node
        targetNodeId = existingNode.id;
        console.log(`Linking to existing node: ${connection.word.text} (${existingNode.id})`);
      } else {
        // Create new node only if it doesn't exist by text+language
        if (!existingNodeIds.has(connection.word.id)) {
          targetNodeId = connection.word.id;
          newNodes.push({
            id: connection.word.id,
            data: {
              word: connection.word,
              expanded: false,
              isSource: false
            }
          });
        } else {
          targetNodeId = connection.word.id;
        }
      }

      // Create edge between source and connected word (always create new edge)
      const edgeId = `edge_${sourceNodeId}_${targetNodeId}`;
      newEdges.push({
        id: edgeId,
        source: sourceNodeId,
        target: targetNodeId,
        data: {
          connection: {
            id: edgeId,
            sourceWordId: sourceNodeId,
            targetWordId: targetNodeId,
            relationshipType: connection.relationship.type,
            confidence: connection.relationship.confidence,
            notes: connection.relationship.notes,
            origin: connection.relationship.origin,
            sharedRoot: connection.relationship.sharedRoot
          }
        }
      });
    });

    // Filter edges based on our connection rules
    const allNodes = [...(existingNodes || []), ...newNodes];
    let filteredEdges = filterConnectionsByRules(newEdges, allNodes);

    // ENHANCED: Find cross-node connections based on word matching in descriptions
    if (existingNodes && existingNodes.length > 0) {
      // Create a temporary node object for the expanding node
      const expandingNodeObj = {
        id: sourceNodeId,
        data: {
          word: etymologyData.sourceWord
        }
      };

      // Find cross-connections with existing nodes
      const existingEdges = []; // We don't have access to existing edges here, but that's OK for now
      const crossConnections = findCrossNodeConnections(expandingNodeObj, existingNodes, existingEdges);

      if (crossConnections.length > 0) {
        console.log(`Found ${crossConnections.length} cross-node connections for expanding word`);
        filteredEdges = [...filteredEdges, ...crossConnections];
      }
    }

    // Count how many connections link to existing nodes vs new nodes
    const linksToExisting = selectedConnections.filter(connection => {
      const connectionKey = `${connection.word.text.toLowerCase()}_${connection.word.language.toLowerCase()}`;
      return existingNodesMap.has(connectionKey);
    }).length;

    console.log(`Expanded "${word}" with ${selectedConnections.length} connections (requested max ${maxConnections}), ${linksToExisting} linking to existing nodes`);

    const result = {
      expandedWordId: sourceNodeId,
      newNodes,
      newEdges: filteredEdges,
      totalNewConnections: etymologyData.connections.length,
      linksToExisting: linksToExisting,
      newNodeCount: newNodes.length,
      crossConnections: filteredEdges.length - filterConnectionsByRules(newEdges, allNodes).length
    };

    res.json(result);

  } catch (error) {
    console.error('Error expanding etymology:', error);
    res.status(500).json({ error: 'Failed to expand etymology' });
  }
});

// Get initial connections for a source word (NEW ENDPOINT)
app.post('/api/etymology/initial', async (req, res) => {
  const { word, language, maxNodes = 5 } = req.body;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  // Create cache key for initial connections
  const initialCacheKey = `initial_${word.toLowerCase()}_${language}_${maxNodes}`;

  // Check cache first
  const cached = graphCache.get(initialCacheKey);
  if (cached) {
    console.log(`Cache hit for initial connections: ${word}`);
    return res.json(cached);
  }

  try {
    console.log(`Building initial graph for: "${word}" (${language}) with ${maxNodes} max nodes`);

    const etymologyData = await getEtymologyService().findEtymologicalConnections(word, language);

    // Cache the source word for ID lookup
    cacheWordForId(etymologyData.sourceWord.id, etymologyData.sourceWord.text, etymologyData.sourceWord.language);

    // Create source node
    const sourceNode = {
      id: etymologyData.sourceWord.id,
      data: {
        word: etymologyData.sourceWord,
        expanded: false,
        isSource: true,
        neighborCount: 0
      },
      position: { x: 0, y: 0 }
    };

    // Simply select the best connections with randomization and PIE prioritization
    const selectedConnections = selectConnectionsWithRandomization(etymologyData.connections, maxNodes, true);

    // Using only real etymology sources - quality over quantity with PIE prioritization
    const pieCount = selectedConnections.filter(conn =>
      conn.word.text.startsWith('*') ||
      conn.word.language === 'ine-pro' ||
      conn.word.language.includes('pro')
    ).length;
    console.log(`Initial graph: Found ${selectedConnections.length} connections (requested ${maxNodes}) from ${etymologyData.connections.length} total available.`);
    if (pieCount > 0) {
      console.log(`  - Including ${pieCount} PIE/proto-language roots (prioritized)`);
    }



    // Cache all connected words for ID lookup
    selectedConnections.forEach(conn => {
      cacheWordForId(conn.word.id, conn.word.text, conn.word.language);
    });

    // Create neighbor nodes
    const neighbors = selectedConnections.map(conn => ({
      id: conn.word.id,
      data: {
        word: conn.word,
        expanded: false,
        isSource: false,
        neighborCount: 0
      },
      position: { x: 0, y: 0 }
    }));

    // Create connections/edges
    const connections = selectedConnections.map(conn => ({
      id: `edge_${sourceNode.id}_${conn.word.id}`,
      source: sourceNode.id,
      target: conn.word.id,
      data: {
        connection: {
          id: `edge_${sourceNode.id}_${conn.word.id}`,
          sourceWordId: sourceNode.id,
          targetWordId: conn.word.id,
          relationshipType: conn.relationship.type,
          confidence: conn.relationship.confidence,
          notes: conn.relationship.notes
        }
      }
    }));

    const initialResult = {
      sourceNode,
      neighbors,
      connections,
      totalAvailable: etymologyData.connections.length,
      totalSelected: selectedConnections.length,
      duplicatesFiltered: etymologyData.connections.length - selectedConnections.length
    };

    // Cache the initial result for faster future responses
    graphCache.set(initialCacheKey, initialResult);
    console.log(`Cached initial connections for: ${word}`);

    res.json(initialResult);

  } catch (error) {
    console.error('Error building initial graph:', error);
    res.status(500).json({ error: 'Failed to build initial graph' });
  }
});

// Get neighbors for node expansion (NEW ENDPOINT)
app.post('/api/etymology/neighbors', async (req, res) => {
  const { wordId, maxNodes = 8, excludeIds = [], currentNeighborCount = 0, maxNeighbors = 10, existingNodes = [] } = req.body;

  if (!wordId) {
    return res.status(400).json({ error: 'WordId parameter is required' });
  }

  // Create cache key for all connections (not dependent on maxNodes)
  const allConnectionsCacheKey = `all_connections_${wordId}`;

  // Create cache key for final result (includes display parameters)
  const resultCacheKey = `neighbors_${wordId}_${maxNodes}_${currentNeighborCount}_${maxNeighbors}_${JSON.stringify(excludeIds.sort())}`;

  // Check quick cache first for complete result
  const cachedResult = quickCache.get(resultCacheKey);
  if (cachedResult) {
    console.log(`Quick cache hit for neighbors result: ${wordId}`);
    return res.json(cachedResult);
  }

  try {
    // Check if node already has max neighbors (use configured max neighbors)
    if (currentNeighborCount >= maxNeighbors) {
      console.log(`Node ${wordId} already has maximum neighbors (${currentNeighborCount}/${maxNeighbors})`);
      return res.json({
        neighbors: [],
        connections: [],
        totalAvailable: 0,
        totalSelected: 0,
        duplicatesFiltered: 0,
        note: `Node already has maximum neighbors (${maxNeighbors})`,
        restrictionReason: 'max_neighbors_reached'
      });
    }

    // For this demo, we need to find the word by its ID
    // In a real implementation, you'd have a proper database lookup
    const wordText = extractWordFromId(wordId);
    const wordLanguage = extractLanguageFromId(wordId);

    if (!wordText || wordText === 'unknown') {
      // Generate connections using Universal Etymology Engine
      console.log(`No cached word found for ID: ${wordId}, using Universal Etymology Engine`);

      // Try to extract base word from fallback ID
      let baseWord = wordText;
      if (wordId.startsWith('fallback_')) {
        const originalId = wordId.replace('fallback_', '');
        baseWord = extractWordFromCachedOrId(originalId);
      }

      if (!baseWord || baseWord === 'unknown') {
        console.log('Cannot extract word from ID, returning empty result');
        return res.json({
          neighbors: [],
          connections: [],
          totalAvailable: 0,
          totalSelected: 0,
          duplicatesFiltered: 0,
          note: 'No valid word found for universal engine'
        });
      }

      // Using only real etymology sources
      console.log('Using only verified Wiktionary and Dictionary API sources');
      return res.json({
        neighbors: [],
        connections: [],
        totalAvailable: 0,
        totalSelected: 0,
        duplicatesFiltered: 0,
        note: 'Real sources only - no synthetic data'
      });
    }

    try {
      console.log(`Getting neighbors for word ID: ${wordId} (${wordText}, ${wordLanguage})`);

      // Check if we have all connections cached for this word
      let etymologyData = quickCache.get(allConnectionsCacheKey);
      if (etymologyData) {
        console.log(`Using cached all connections for: ${wordText}`);
      } else {
        console.log(`Fetching and caching all connections for: ${wordText}`);
        etymologyData = await getEtymologyService().findEtymologicalConnections(wordText, wordLanguage);

        // Cache all connections for future use (with longer TTL for better performance)
        if (etymologyData && etymologyData.connections) {
          quickCache.set(allConnectionsCacheKey, etymologyData, 3600); // Cache for 1 hour
          console.log(`Cached ${etymologyData.connections.length} total connections for: ${wordText}`);
        }
      }

      // Check if no etymological connections found
      if (!etymologyData.connections || etymologyData.connections.length === 0) {
        console.log(`No etymological connections found for "${wordText}"`);
        return res.json({
          neighbors: [],
          connections: [],
          totalAvailable: 0,
          totalSelected: 0,
          duplicatesFiltered: 0,
          note: 'No other etymological connections found',
          restrictionReason: 'no_connections_found'
        });
      }

      // IMPROVED: Create a map of existing nodes for efficient lookup
      const existingNodesMap = new Map();
      if (existingNodes && Array.isArray(existingNodes)) {
        existingNodes.forEach(node => {
          if (node.data && node.data.word) {
            const key = `${node.data.word.text.toLowerCase()}_${node.data.word.language.toLowerCase()}`;
            existingNodesMap.set(key, node);
          }
        });
      }

      // Filter out already existing nodes but keep all available etymological connections
      const excludeIdSet = new Set(excludeIds);

      // IMPROVED: Check for existing nodes by text+language, not just by ID
      const availableConnections = etymologyData.connections.filter(conn => {
        // Skip if already excluded by ID
        if (excludeIdSet.has(conn.word.id)) {
          return false;
        }

        // IMPROVED: Also check if this word already exists in the graph by text+language
        const existingKey = `${conn.word.text.toLowerCase()}_${conn.word.language.toLowerCase()}`;
        if (existingNodesMap.has(existingKey)) {
          console.log(`Skipping duplicate word: ${conn.word.text} (${conn.word.language}) - already exists in graph`);
          return false;
        }

        return true;
      });

      // Check if all existing connections are already in the graph
      if (availableConnections.length === 0) {
        console.log(`All etymological connections for "${wordText}" are already in the graph`);
        return res.json({
          neighbors: [],
          connections: [],
          totalAvailable: etymologyData.connections.length,
          totalSelected: 0,
          duplicatesFiltered: etymologyData.connections.length,
          note: 'All existing connections are already in the graph',
          restrictionReason: 'all_connections_exist'
        });
      }

      // IMPROVED: Filter out connections that are not truly etymological
      const validatedConnections = availableConnections.filter(conn => {
        return validateEtymologicalConnection(conn, wordText, wordLanguage);
      });

      if (validatedConnections.length === 0) {
        console.log(`No valid etymological connections found for "${wordText}" after filtering`);
        return res.json({
          neighbors: [],
          connections: [],
          totalAvailable: etymologyData.connections.length,
          totalSelected: 0,
          duplicatesFiltered: etymologyData.connections.length,
          note: 'No valid etymological connections found after filtering',
          restrictionReason: 'no_valid_connections'
        });
      }

      // Simply select the best connections with randomization and PIE prioritization
      // Only limit based on maxNeighbors, not expansion request size
      const remainingNeighborSlots = maxNeighbors - currentNeighborCount;

      const selectedConnections = selectConnectionsWithRandomization(validatedConnections, remainingNeighborSlots, true);

      // Report what we found - prioritize quality over quantity with PIE prioritization
      const pieCount = selectedConnections.filter(conn =>
        conn.word.text.startsWith('*') ||
        conn.word.language === 'ine-pro' ||
        conn.word.language.includes('pro')
      ).length;
      console.log(`Expansion: Found ${selectedConnections.length} connections for "${wordText}" (slots available: ${remainingNeighborSlots}) from ${etymologyData.connections.length} total available.`);
      if (pieCount > 0) {
        console.log(`  - Including ${pieCount} PIE/proto-language roots (prioritized)`);
      }

      // IMPROVED: Check for existing nodes again and link to them instead of creating duplicates
      const neighbors = [];
      const connections = [];

      selectedConnections.forEach(conn => {
        const existingKey = `${conn.word.text.toLowerCase()}_${conn.word.language.toLowerCase()}`;
        const existingNode = existingNodesMap.get(existingKey);

        let targetNodeId;
        if (existingNode) {
          // Link to existing node
          targetNodeId = existingNode.id;
          console.log(`Linking to existing node: ${conn.word.text} (${existingNode.id})`);
        } else {
          // Create new node
          targetNodeId = conn.word.id;

          // Cache word for ID lookup
          cacheWordForId(conn.word.id, conn.word.text, conn.word.language);

          neighbors.push({
            id: conn.word.id,
            data: {
              word: conn.word,
              expanded: false,
              isSource: false,
              neighborCount: 0
            },
            position: { x: 0, y: 0 }
          });
        }

        // Create connection (always create new connection edge)
        connections.push({
          id: `edge_${wordId}_${targetNodeId}`,
          source: wordId,
          target: targetNodeId,
          data: {
            connection: {
              id: `edge_${wordId}_${targetNodeId}`,
              sourceWordId: wordId,
              targetWordId: targetNodeId,
              relationshipType: conn.relationship.type,
              confidence: conn.relationship.confidence,
              notes: conn.relationship.notes
            }
          }
        });
      });

      // ENHANCED: Find cross-node connections for the expanding node
      let additionalConnections = [];
      if (existingNodes && existingNodes.length > 0) {
        // Find the expanding node by wordId - first try to get it from existing nodes
        let expandingNode = existingNodes.find(node => node.id === wordId);

        // If not found in existing nodes, try to reconstruct it from the cached word info
        if (!expandingNode) {
          const wordText = extractWordFromCachedOrId(wordId);
          const wordLanguage = extractLanguageFromId(wordId);
          if (wordText && wordText !== 'unknown') {
            expandingNode = {
              id: wordId,
              data: {
                word: {
                  id: wordId,
                  text: wordText,
                  language: wordLanguage,
                  // Add any etymology/meaning from the cache if available
                }
              }
            };
          }
        }

        if (expandingNode) {
          // Find cross-connections with other existing nodes
          const existingEdges = []; // We don't have access to existing edges here, but the function handles this
          const crossConnections = findCrossNodeConnections(expandingNode, existingNodes, existingEdges);

          if (crossConnections.length > 0) {
            console.log(`Found ${crossConnections.length} cross-node connections for neighbor expansion`);
            additionalConnections = crossConnections;
          }
        }
      }

      const result = {
        neighbors,
        connections: [...connections, ...additionalConnections],
        totalAvailable: etymologyData.connections.length,
        totalSelected: selectedConnections.length,
        duplicatesFiltered: etymologyData.connections.length - selectedConnections.length,
        linksToExisting: selectedConnections.length - neighbors.length,
        crossConnections: additionalConnections.length
      };

      // Cache the result for faster future responses
      quickCache.set(resultCacheKey, result);
      console.log(`Cached neighbors result for: ${wordId}`);

      res.json(result);

    } catch (error) {
      console.error('Error getting neighbors:', error);
      res.status(500).json({ error: 'Failed to get neighbors' });
    }
  } catch (error) {
    console.error('Outer error getting neighbors:', error);
    res.status(500).json({ error: 'Failed to get neighbors' });
  }
});;

// Get word details
app.get('/api/words/:wordText', async (req, res) => {
  const { wordText } = req.params;
  const { language } = req.query;

  try {
    const etymologyData = await getEtymologyService().findEtymologicalConnections(wordText, language);

    res.json({
      word: etymologyData.sourceWord,
      connections: etymologyData.connections.map(conn => ({
        connection: {
          relationshipType: conn.relationship.type,
          confidence: conn.relationship.confidence,
          notes: conn.relationship.notes,
          origin: conn.relationship.origin,
          sharedRoot: conn.relationship.sharedRoot
        },
        relatedWord: conn.word
      }))
    });

  } catch (error) {
    console.error('Error getting word details:', error);
    res.status(500).json({ error: 'Failed to get word details' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  const stats = getCacheStats();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    type: 'universal_etymology_service',
    cacheStats: {
      etymologyCache: Object.keys(getEtymologyService().cache?.keys || {}).length,
      wordIdCache: stats.totalWords,
      supportedLanguages: stats.languages,
      graphCache: 0 // Disabled for development
    },
    configuration: {
      universalAlgorithm: true,
      modularConnectionTypes: true,
      dynamicLanguageFamilies: true,
      confidenceBasedScoring: true,
      phoneticSimilarity: true,
      soundChangePatterns: true,
      multiLanguageSupport: true
    },
    connectionTypes: ['cognate', 'borrowing', 'derivation', 'semantic_shift'],
    languageFamilies: ['romance', 'germanic', 'slavic', 'celtic', 'greek', 'indo_iranian', 'proto_indo_european', 'proto_germanic', 'proto_italic'],
    algorithm: 'Real Etymology Sources Only (Wiktionary + Dictionary API)'
  });
});

// Debug endpoint for cache inspection
app.get('/api/debug/cache', (req, res) => {
  const stats = getCacheStats();

  // Sample of cached words (limit to 10 for readability)
  const sampleWords = [...wordIdCache.entries()].slice(0, 10).map(([id, info]) => ({
    id,
    text: info.text,
    language: info.language
  }));

  res.json({
    stats,
    sampleWords,
    totalCached: wordIdCache.size
  });
});

// Test endpoint for shared root functionality
app.get('/api/test-shared-root', (req, res) => {
  const testResult = getEtymologyService().extractSharedRoot('water', 'Wasser', 'From Proto-Germanic *watōr', 'Proto-Germanic *watōr');
  res.json({
    testResult,
    hasMethod: typeof getEtymologyService().extractSharedRoot === 'function'
  });
});

// Helper function to filter connections based on our rules
function filterConnectionsByRules(edges, nodes) {
  return edges.filter(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return false;

    const sameLanguage = sourceNode.data.word.language === targetNode.data.word.language;

    if (!sameLanguage) {
      // Always include cross-language connections
      return true;
    } else {
      // For same-language connections, only include etymological relationships
      const etymologicalTypes = ['cognate', 'derivative', 'compound', 'diminutive'];
      return etymologicalTypes.includes(edge.data.connection.relationshipType);
    }
  });
}

// IMPROVED: Enhanced validation function to check if a connection is genuinely etymological
function validateEtymologicalConnection(connection, sourceWord, sourceLanguage) {
  if (!connection || !connection.word || !connection.relationship) {
    return false;
  }

  const targetWord = connection.word.text;
  const targetLanguage = connection.word.language;
  const relationship = connection.relationship;

  // Reject connections with 'unknown' language
  if (targetLanguage.toLowerCase() === 'unknown' || sourceLanguage.toLowerCase() === 'unknown') {
    console.log(`Rejected unknown language connection: ${targetWord} (${targetLanguage})`);
    return false;
  }

  // Reject connections with malformed language codes (containing dashes, numbers, or too short)
  if (/[-\d]/.test(targetLanguage) || /[-\d]/.test(sourceLanguage) ||
      targetLanguage.length <= 1 || sourceLanguage.length <= 1) {
    console.log(`Rejected malformed language code: ${targetWord} (${targetLanguage}) or ${sourceWord} (${sourceLanguage})`);
    return false;
  }

  // Reject very low confidence connections
  if (relationship.confidence < 0.6) {
    console.log(`Rejected low confidence connection: ${targetWord} (confidence: ${relationship.confidence})`);
    return false;
  }

  // Reject connections between unrelated language families that are unlikely to be cognates
  if (!areLanguageFamiliesRelated(sourceLanguage, targetLanguage)) {
    // Only allow if it's a high-confidence borrowing or if confidence is very high
    if (relationship.type !== 'borrowing' && relationship.confidence < 0.9) {
      console.log(`Rejected unrelated language family connection: ${sourceLanguage} -> ${targetLanguage}`);
      return false;
    }
  }

  // Reject words that are clearly modern compound formations
  if (isModernCompoundFormation(targetWord, sourceWord)) {
    console.log(`Rejected modern compound formation: ${targetWord}`);
    return false;
  }

  // Reject connections where the words are semantically unrelated in suspicious ways
  if (areSemanticallyUnrelated(sourceWord, targetWord)) {
    console.log(`Rejected semantically unrelated words: ${sourceWord} -> ${targetWord}`);
    return false;
  }

  // Reject obvious false cognates (words that look similar but aren't related)
  if (isFalseCognate(sourceWord, targetWord, sourceLanguage, targetLanguage, relationship)) {
    console.log(`Rejected false cognate: ${sourceWord} (${sourceLanguage}) -> ${targetWord} (${targetLanguage})`);
    return false;
  }

  return true;
}

// Check if two language families are etymologically related
function areLanguageFamiliesRelated(lang1, lang2) {
  return languageMapping.areLanguagesRelated(lang1, lang2);
}

// Check if a word is a modern compound formation
function isModernCompoundFormation(word, sourceWord) {
  const modernPrefixes = ['cyber', 'meta', 'hyper', 'ultra', 'mega', 'giga', 'nano', 'micro'];
  const modernSuffixes = ['tech', 'bot', 'net', 'web', 'app', 'soft', 'ware', 'cast'];

  for (const prefix of modernPrefixes) {
    if (word.toLowerCase().startsWith(prefix) || sourceWord.toLowerCase().startsWith(prefix)) {
      return true;
    }
  }

  for (const suffix of modernSuffixes) {
    if (word.toLowerCase().endsWith(suffix) || sourceWord.toLowerCase().endsWith(suffix)) {
      return true;
    }
  }

  return false;
}

// Check if words are semantically unrelated in suspicious ways
function areSemanticallyUnrelated(word1, word2) {
  // Define semantic categories that should not be etymologically related
  const semanticCategories = {
    elements: ['fire', 'water', 'earth', 'air', 'wind'],
    colors: ['red', 'blue', 'green', 'yellow', 'black', 'white'],
    numbers: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
    bodyParts: ['hand', 'foot', 'head', 'eye', 'ear', 'nose', 'mouth'],
    animals: ['cat', 'dog', 'horse', 'cow', 'sheep', 'pig', 'bird', 'fish']
  };

  const word1Lower = word1.toLowerCase();
  const word2Lower = word2.toLowerCase();

  // Check if words are in different basic semantic categories
  for (const [category, words] of Object.entries(semanticCategories)) {
    const word1InCategory = words.includes(word1Lower);
    const word2InCategory = words.includes(word2Lower);

    // If one word is in category but other isn't, and they're not clearly related, reject
    if (word1InCategory !== word2InCategory) {
      // Allow some exceptions for clearly related concepts
      if ((word1Lower === 'water' && word2Lower.includes('aqua')) ||
          (word1Lower === 'fire' && word2Lower.includes('igni')) ||
          (word1Lower === 'earth' && word2Lower.includes('terr'))) {
        continue;
      }
      return true;
    }
  }

  // Check for specific problematic pairs we've seen
  const problematicPairs = [
    ['water', 'fire'],
    ['water', 'punjab'],
    ['fire', 'water'],
    ['test', 'forest'],
    ['book', 'forest']
  ];

  for (const [word1Prob, word2Prob] of problematicPairs) {
    if ((word1Lower === word1Prob && word2Lower === word2Prob) ||
        (word1Lower === word2Prob && word2Lower === word1Prob)) {
      return true;
    }
  }

  return false;
}

// Check for false cognates (words that look similar but aren't actually related)
function isFalseCognate(word1, word2, lang1, lang2, relationship) {
  // If confidence is very low and words look completely different, likely false
  if (relationship.confidence < 0.7) {
    const word1Clean = word1.toLowerCase().replace(/[^a-z]/g, '');
    const word2Clean = word2.toLowerCase().replace(/[^a-z]/g, '');

    // Calculate simple character overlap
    const commonChars = new Set([...word1Clean].filter(char => word2Clean.includes(char)));
    const similarityRatio = commonChars.size / Math.max(word1Clean.length, word2Clean.length);

    if (similarityRatio < 0.3) {
      console.log(`False cognate check: ${word1} vs ${word2}, similarity: ${similarityRatio.toFixed(2)}`);
      return true;
    }
  }

  // Check for known false cognates
  const knownFalseCognates = [
    ['dog', 'god'], // English words, not related
    ['bad', 'bath'], // Different etymologies
    ['have', 'habere'], // Actually these ARE related, so don't reject
  ];

  const word1Lower = word1.toLowerCase();
  const word2Lower = word2.toLowerCase();

  for (const [false1, false2] of knownFalseCognates) {
    if ((word1Lower === false1 && word2Lower === false2) ||
        (word1Lower === false2 && word2Lower === false1)) {
      return true;
    }
  }

  return false;
}

// Enhanced dynamic word ID management
const wordIdCache = new Map();
const reverseWordCache = new Map(); // text_language -> wordId

function cacheWordForId(wordId, wordText, language) {
  const wordInfo = { text: wordText, language: language };
  wordIdCache.set(wordId, wordInfo);

  // Also cache reverse lookup
  const reverseKey = `${wordText.toLowerCase()}_${language.toLowerCase()}`;
  reverseWordCache.set(reverseKey, wordId);
}

function extractWordFromId(wordId) {
  const cached = wordIdCache.get(wordId);
  if (cached) {
    return cached.text;
  }

  // Enhanced fallback: try to find by searching all cached entries
  for (const [id, info] of wordIdCache.entries()) {
    if (id === wordId) {
      return info.text;
    }
  }

  // Ultimate fallback: try to extract from ID pattern if it follows a readable format
  const idPattern = /^w[_\d]+_(.+)$/;
  const match = wordId.match(idPattern);
  if (match) {
    console.log(`Attempting ID pattern extraction for ${wordId}: ${match[1]}`);
    return match[1];
  }

  // Try UUID-based pattern
  const uuidPattern = /^w_[a-f0-9-]+$/;
  if (uuidPattern.test(wordId)) {
    console.warn(`UUID-based word ID found but no cache entry: ${wordId}. Creating fallback.`);
    return 'unknown'; // Will trigger morphological generation
  }

  console.warn(`Word not found in cache for ID: ${wordId}. This may indicate a missing cache entry.`);
  return null;
}

// Enhanced word extraction that combines cache and pattern matching
function extractWordFromCachedOrId(wordId) {
  // First try the cache
  const cached = wordIdCache.get(wordId);
  if (cached && cached.text) {
    return cached.text;
  }

  // Try pattern extraction
  const patterns = [
    /^w[_\d]+_(.+)$/, // w12345_word
    /^w_[a-f0-9-]+$/, // UUID format
    /^(.+)_\w{2}$/, // word_en format
  ];

  for (const pattern of patterns) {
    const match = wordId.match(pattern);
    if (match && match[1] && match[1] !== 'unknown') {
      console.log(`Extracted word "${match[1]}" from ID pattern: ${wordId}`);
      return match[1];
    }
  }

  // Last resort: try to find any meaningful text in the ID
  const cleanId = wordId.replace(/^w[_\d]*_?/, '').replace(/_[a-z]{2,5}$/, '');
  if (cleanId && cleanId.length > 2 && /^[a-zA-Z]+$/.test(cleanId)) {
    console.log(`Extracted clean word "${cleanId}" from ID: ${wordId}`);
    return cleanId;
  }

  return 'unknown';
}

function extractLanguageFromId(wordId) {
  const cached = wordIdCache.get(wordId);
  if (cached) {
    return cached.language;
  }

  // Enhanced fallback: try to find by searching all cached entries
  for (const [id, info] of wordIdCache.entries()) {
    if (id === wordId) {
      return info.language;
    }
  }

  // For UUID-based IDs, default to English but log for monitoring
  const uuidPattern = /^w_[a-f0-9-]+$/;
  if (uuidPattern.test(wordId)) {
    console.log(`UUID-based word ID found, defaulting to English: ${wordId}`);
    return 'en';
  }

  console.warn(`Language not found in cache for ID: ${wordId}. Defaulting to English.`);
  return 'en';
}

function findOrCreateWordId(wordText, language) {
  const reverseKey = `${wordText.toLowerCase()}_${language.toLowerCase()}`;
  const existingId = reverseWordCache.get(reverseKey);

  if (existingId) {
    return existingId;
  }

  // Create new ID and cache it
  const newId = generateId();
  cacheWordForId(newId, wordText, language);
  return newId;
}

// Get all cached words (for debugging/monitoring)
function getCacheStats() {
  return {
    totalWords: wordIdCache.size,
    reverseEntries: reverseWordCache.size,
    languages: [...new Set([...wordIdCache.values()].map(w => w.language))]
  };
}

// Dynamic morphological analysis for any word
async function generateMorphologicalConnections(wordText, wordLanguage, count, existingConnections) {
  const connections = [];
  const existingWords = new Set(existingConnections.map(c => `${c.word.text.toLowerCase()}_${c.word.language}`));

  // Analyze word for common morphological patterns
  const morphComponents = analyzeMorphology(wordText, wordLanguage);

  for (const component of morphComponents) {
    if (connections.length >= count) break;

    // Try to find related words through each morphological component
    const relatedWords = await findRelatedWordsByComponent(component, wordLanguage);

    for (const related of relatedWords) {
      if (connections.length >= count) break;

      const wordKey = `${related.text.toLowerCase()}_${related.language}`;
      if (!existingWords.has(wordKey) && !isSameWordDerivative(wordText, related.text, wordLanguage, related.language)) {
        connections.push({
          word: {
            id: generateId(),
            text: related.text,
            language: related.language,
            partOfSpeech: related.partOfSpeech || 'unknown',
            definition: related.definition || `Related through morphological component: ${component.component}`
          },
          relationship: {
            type: component.type,
            confidence: 0.85,
            notes: `Morphological relationship through ${component.component} (${component.meaning})`,
            sharedRoot: component.component
          }
        });
        existingWords.add(wordKey);
      }
    }
  }

  return connections;
}

// Analyze morphological components of a word
function analyzeMorphology(word, language) {
  const components = [];
  const normalized = word.toLowerCase();

  // Common prefixes with meanings
  const prefixes = {
    're': { meaning: 'again, back', type: 'morphological_prefix' },
    'un': { meaning: 'not, opposite', type: 'morphological_prefix' },
    'pre': { meaning: 'before', type: 'morphological_prefix' },
    'dis': { meaning: 'apart, away', type: 'morphological_prefix' },
    'mis': { meaning: 'wrong, bad', type: 'morphological_prefix' },
    'over': { meaning: 'above, excessive', type: 'morphological_prefix' },
    'under': { meaning: 'below, insufficient', type: 'morphological_prefix' },
    'out': { meaning: 'beyond, external', type: 'morphological_prefix' },
    'anti': { meaning: 'against', type: 'morphological_prefix' },
    'co': { meaning: 'together, with', type: 'morphological_prefix' },
    'counter': { meaning: 'against', type: 'morphological_prefix' },
    'inter': { meaning: 'between', type: 'morphological_prefix' },
    'super': { meaning: 'above, beyond', type: 'morphological_prefix' },
    'sub': { meaning: 'under, below', type: 'morphological_prefix' },
    'trans': { meaning: 'across, through', type: 'morphological_prefix' },
    'multi': { meaning: 'many', type: 'morphological_prefix' },
    'micro': { meaning: 'small', type: 'morphological_prefix' },
    'macro': { meaning: 'large', type: 'morphological_prefix' },
    'auto': { meaning: 'self', type: 'morphological_prefix' },
    'bio': { meaning: 'life', type: 'morphological_prefix' },
    'geo': { meaning: 'earth', type: 'morphological_prefix' },
    'photo': { meaning: 'light', type: 'morphological_prefix' },
    'tele': { meaning: 'distant', type: 'morphological_prefix' }
  };

  // Common suffixes with meanings
  const suffixes = {
    'tion': { meaning: 'action, result', type: 'morphological_suffix' },
    'sion': { meaning: 'action, result', type: 'morphological_suffix' },
    'ment': { meaning: 'action, result', type: 'morphological_suffix' },
    'ness': { meaning: 'state, quality', type: 'morphological_suffix' },
    'ful': { meaning: 'full of', type: 'morphological_suffix' },
    'less': { meaning: 'without', type: 'morphological_suffix' },
    'able': { meaning: 'capable of', type: 'morphological_suffix' },
    'ible': { meaning: 'capable of', type: 'morphological_suffix' },
    'ly': { meaning: 'in manner of', type: 'morphological_suffix' },
    'er': { meaning: 'one who, more', type: 'morphological_suffix' },
    'or': { meaning: 'one who', type: 'morphological_suffix' },
    'ist': { meaning: 'one who practices', type: 'morphological_suffix' },
    'ism': { meaning: 'doctrine, practice', type: 'morphological_suffix' },
    'ity': { meaning: 'quality, state', type: 'morphological_suffix' },
    'ous': { meaning: 'full of', type: 'morphological_suffix' },
    'ive': { meaning: 'having nature of', type: 'morphological_suffix' },
    'age': { meaning: 'action, result', type: 'morphological_suffix' },
    'ship': { meaning: 'state, skill', type: 'morphological_suffix' },
    'hood': { meaning: 'state, condition', type: 'morphological_suffix' },
    'ward': { meaning: 'direction', type: 'morphological_suffix' },
    'graph': { meaning: 'writing, recording', type: 'morphological_suffix' },
    'scope': { meaning: 'viewing, observing', type: 'morphological_suffix' },
    'phone': { meaning: 'sound, voice', type: 'morphological_suffix' },
    'meter': { meaning: 'measure', type: 'morphological_suffix' }
  };

  // Check for prefixes
  for (const [prefix, info] of Object.entries(prefixes)) {
    if (normalized.startsWith(prefix) && normalized.length > prefix.length + 2) {
      components.push({
        component: prefix,
        meaning: info.meaning,
        type: info.type,
        position: 'prefix'
      });
    }
  }

  // Check for suffixes
  for (const [suffix, info] of Object.entries(suffixes)) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length + 2) {
      components.push({
        component: suffix,
        meaning: info.meaning,
        type: info.type,
        position: 'suffix'
      });
    }
  }

  // If it's a compound word, try to identify root components
  if (components.length === 0 && normalized.length > 6) {
    const compound = analyzeCompoundWord(normalized);
    if (compound.length > 0) {
      components.push(...compound);
    }
  }

  // If no components found yet, treat the word itself as a root component
  if (components.length === 0) {
    components.push({
      component: normalized,
      meaning: `root word: ${normalized}`,
      type: 'root_word',
      position: 'root'
    });
  }

  return components;
}

// Find related words by morphological component
async function findRelatedWordsByComponent(component, targetLanguage) {
  const relatedWords = [];

  // This would ideally query a morphological database
  // For now, we'll generate some common patterns
  const commonWords = generateCommonWordsByComponent(component, targetLanguage);

  // Try to get actual definitions from the dictionary API for these words
  for (const word of commonWords) {
    try {
      const dictionaryAPI = require('./services/dictionaryAPI');
      const entry = await dictionaryAPI.fetchEntry(word, targetLanguage);
      if (entry) {
        relatedWords.push({
          text: word,
          language: targetLanguage,
          partOfSpeech: dictionaryAPI.extractPrimaryPartOfSpeech(entry) || 'unknown',
          definition: dictionaryAPI.extractPrimaryDefinition(entry) || `Word containing ${component.component}`
        });
      } else {
        // If word not found in dictionary, still include it for compound words
        relatedWords.push({
          text: word,
          language: targetLanguage,
          partOfSpeech: 'compound',
          definition: `Compound word containing: ${component.component}`
        });
      }
    } catch (error) {
      // If API fails, still include with basic info
      relatedWords.push({
        text: word,
        language: targetLanguage,
        partOfSpeech: 'unknown',
        definition: `Word containing morphological component: ${component.component}`
      });
    }
  }

  return relatedWords.slice(0, 8); // Increased limit to ensure we can find enough neighbors
}

// Generate common words containing a morphological component
function generateCommonWordsByComponent(component, language) {
  const componentWords = {
    // Prefixes
    'photo': ['photograph', 'photography', 'photon', 'photographic'],
    'tele': ['telephone', 'television', 'telegraph', 'telescope'],
    'micro': ['microscope', 'microphone', 'microbe', 'microwave'],
    'auto': ['automatic', 'automobile', 'autonomy', 'autopilot'],
    'bio': ['biology', 'biography', 'biodiversity', 'biochemistry'],
    'geo': ['geography', 'geology', 'geometry', 'geopolitics'],
    'multi': ['multiple', 'multiply', 'multimedia', 'multitask'],
    'super': ['superhero', 'supernatural', 'supervisor', 'superior'],
    'inter': ['international', 'internet', 'interview', 'interact'],
    'trans': ['transport', 'translate', 'transfer', 'transform'],
    'anti': ['antibiotic', 'antisocial', 'antique', 'anticipate'],
    'over': ['overcome', 'overflow', 'overlook', 'overhead'],
    'under': ['understand', 'underground', 'underwater', 'underline'],
    'pre': ['prepare', 'predict', 'prevent', 'previous'],
    'un': ['unable', 'unknown', 'unusual', 'unlimited'],
    're': ['return', 'repeat', 'remember', 'recent'],

    // Suffixes
    'graph': ['photograph', 'biography', 'geography', 'telegraph'],
    'phone': ['telephone', 'microphone', 'saxophone', 'headphone'],
    'scope': ['microscope', 'telescope', 'horoscope', 'kaleidoscope'],
    'meter': ['thermometer', 'diameter', 'kilometer', 'parameter'],
    'tion': ['action', 'nation', 'creation', 'education'],
    'ment': ['movement', 'development', 'agreement', 'government'],
    'ness': ['happiness', 'darkness', 'kindness', 'weakness'],
    'able': ['comfortable', 'reasonable', 'available'],
    'ful': ['helpful', 'beautiful', 'wonderful', 'successful'],
    'less': ['homeless', 'hopeless', 'endless', 'wireless'],
    'ly': ['quickly', 'easily', 'really', 'finally'],
    'er': ['teacher', 'player', 'computer'],
    'ism': ['tourism', 'journalism', 'capitalism', 'optimism'],
    'ist': ['artist', 'scientist', 'journalist', 'tourist'],

    // True compound words from different roots - avoid derivatives
    'test': ['retest', 'pretest'], // Only include clear prefixed forms that aren't derivatives
    'book': ['handbook', 'textbook', 'notebook', 'bookmark', 'bookcase'],
    'work': ['homework', 'network', 'workbook', 'workshop', 'artwork'],
    'fire': ['fireplace', 'campfire', 'wildfire', 'gunfire', 'firework'],
    'water': ['waterfall', 'underwater', 'watermelon', 'waterproof'],
    'house': ['greenhouse', 'warehouse', 'household', 'housekeeper'],
    'time': ['sometime', 'timeline', 'overtime', 'pastime'],
    'light': ['daylight', 'moonlight', 'lighthouse', 'lightning'],
    'life': ['lifestyle', 'wildlife', 'lifetime'],
    'hand': ['handbook', 'handmade', 'handwriting', 'handheld', 'handshake'],
    'heart': ['heartbeat', 'heartbreak', 'sweetheart'],
    'mind': ['mastermind', 'mindset'],
    'love': ['lovebird'],
    'play': ['playground'],
    'walk': ['walkway', 'sidewalk', 'catwalk', 'moonwalk']
  };

  const words = componentWords[component.component];

  if (words && words.length > 0) {
    return words;
  }

  // Fallback: generate some basic morphological variations for root words
  if (component.type === 'root_word') {
    return generateBasicMorphologicalVariations(component.component, language);
  }

  return [];
}

// Generate basic morphological variations for words not in our explicit mappings
function generateBasicMorphologicalVariations(word, language) {
  const variations = [];

  // Only generate for real English words, avoid synthetic/weird words
  if (language === 'en' && word.length >= 3 && !word.includes('*') && !word.includes('-')) {
    // Add safe compound words only for common bases
    const commonBases = ['test', 'work', 'book', 'time', 'water', 'fire'];
    if (commonBases.includes(word)) {
      variations.push(`self${word}`); // selftest, selfwork, etc.
    }
  }

  return variations.slice(0, 2); // Very limited
}

// Generate fallback connections for nodes that don't have cached word info
async function generateFallbackConnections(wordId, language, maxNodes) {
  const neighbors = [];
  const connections = [];

  console.log(`Searching for authentic etymological connections for word ID: ${wordId}`);

  // Try to extract meaningful word info from the ID
  let baseWord = extractWordFromCachedOrId(wordId);

  // If we can't extract a word from a fallback ID, try to get it from the cache first
  if (!baseWord || baseWord === 'unknown') {
    // For fallback IDs, try to extract from the original ID
    if (wordId.startsWith('fallback_')) {
      const originalId = wordId.replace('fallback_', '');
      baseWord = extractWordFromCachedOrId(originalId);
      console.log(`Extracted word from original ID: "${baseWord}"`);
    }

    // If still no word, return empty - no synthetic data
    if (!baseWord || baseWord === 'unknown') {
      console.log('Cannot extract word from ID, returning empty result to avoid synthetic data');
      return { neighbors: [], connections: [] };
    }
  }

  console.log(`Searching for legitimate connections for "${baseWord}" (${language})`);

  let connectionCount = 0;

  // DISABLED: Cognate service generates synthetic data - using only verified sources
  console.log('Cognate service disabled - using only Wiktionary and Dictionary API sources');

  /*
  // PRIORITY 1: Real cognate service - only legitimate linguistic cognates
  try {
    const cognateService = require('./services/cognateService');
    const cognateLanguages = languageMapping.getCognateTargets(language, 50);
    const cognates = await cognateService.findCognates(baseWord, language, cognateLanguages);

    // Add ONLY authentic cognates found by the service
    for (const cognate of cognates) {
      const neighborId = generateId();
      cacheWordForId(neighborId, cognate.word, cognate.language);

      neighbors.push({
        id: neighborId,
        data: {
          word: {
            id: neighborId,
            text: cognate.word,
            language: cognate.language,
            partOfSpeech: 'cognate',
            definition: `${cognateService.getLanguageName(cognate.language)} cognate: ${cognate.notes || cognate.concept || 'related word'}`
          },
          expanded: false,
          isSource: false,
          neighborCount: 0
        },
        position: { x: 0, y: 0 }
      });

      connections.push({
        id: `edge_${wordId}_${neighborId}`,
        source: wordId,
        target: neighborId,
        data: {
          connection: {
            id: `edge_${wordId}_${neighborId}`,
            sourceWordId: wordId,
            targetWordId: neighborId,
            relationshipType: 'cognate',
            confidence: cognate.confidence || 0.85,
            notes: cognate.notes || `Cross-language cognate`,
            sharedRoot: cognate.concept
          }
        }
      });

      connectionCount++;
    }

    console.log(`Added ${connectionCount} authentic cognates from service`);
  } catch (error) {
    console.log(`Cognate lookup failed for "${baseWord}": ${error.message}`);
  }
  */

  // PRIORITY 2: Authentic etymology data from Wiktionary
  try {
    const etymologyService = getEtymologyService();
    const etymData = await etymologyService.findEtymologicalConnections(baseWord, language);

    // Add ONLY authentic etymological connections found in Wiktionary
    for (const conn of etymData.connections) {
      const neighborId = generateId();
      cacheWordForId(neighborId, conn.word.text, conn.word.language);

      neighbors.push({
        id: neighborId,
        data: {
          word: {
            id: neighborId,
            text: conn.word.text,
            language: conn.word.language,
            partOfSpeech: conn.word.partOfSpeech || 'related',
            definition: conn.word.definition || `Etymologically related to "${baseWord}"`
          },
          expanded: false,
          isSource: false,
          neighborCount: 0
        },
          position: { x: 0, y: 0 }
        });

        connections.push({
          id: `edge_${wordId}_${neighborId}`,
          source: wordId,
          target: neighborId,
          data: {
            connection: {
              id: `edge_${wordId}_${neighborId}`,
              sourceWordId: wordId,
              targetWordId: neighborId,
              relationshipType: conn.relationship.type,
              confidence: conn.relationship.confidence || 0.8,
              notes: conn.relationship.notes || `Etymological relationship`,
              sharedRoot: conn.relationship.sharedRoot
            }
          }
        });

        connectionCount++;
      }

      console.log(`Added ${etymData.connections.length} authentic etymology connections`);
    } catch (error) {
      console.log(`Etymology lookup failed for "${baseWord}": ${error.message}`);
    }

  // PRIORITY 3: If we have few connections, try to find more authentic related words
  if (connectionCount < maxNodes && connectionCount > 0) {
    console.log(`Found ${connectionCount} connections, looking for more authentic related words...`);

    try {
      // Try searching for related forms of the base word
      const relatedForms = [
        baseWord + 's',    // plural form
        baseWord + 'e',    // alternative ending
        baseWord + 'a',    // feminine form
        baseWord + 'o',    // masculine form
        baseWord.slice(0, -1), // remove last letter
        baseWord.slice(0, -2) + 'a', // alternative ending
      ].filter(form => form !== baseWord && form.length > 1);

      for (const relatedForm of relatedForms.slice(0, 3)) { // Try max 3 variations
        if (connectionCount >= maxNodes) break;

        try {
          const etymologyService = getEtymologyService();
          const relatedData = await etymologyService.findEtymologicalConnections(relatedForm, language);

          // Add a few high-confidence connections from related forms
          for (const conn of relatedData.connections.slice(0, 2)) {
            if (connectionCount >= maxNodes) break;

            const neighborId = generateId();
            cacheWordForId(neighborId, conn.word.text, conn.word.language);

            neighbors.push({
              id: neighborId,
              data: {
                word: {
                  id: neighborId,
                  text: conn.word.text,
                  language: conn.word.language,
                  partOfSpeech: conn.word.partOfSpeech || 'related',
                  definition: conn.word.definition || `Related to "${baseWord}"`
                },
                expanded: false,
                isSource: false,
                neighborCount: 0
              },
              position: { x: 0, y: 0 }
            });

            connections.push({
              id: `edge_${wordId}_${neighborId}`,
              source: wordId,
              target: neighborId,
              data: {
                connection: {
                  id: `edge_${wordId}_${neighborId}`,
                  sourceWordId: wordId,
                  targetWordId: neighborId,
                  relationshipType: 'related_form',
                  confidence: (conn.relationship.confidence || 0.7) * 0.8,
                  notes: `Related via "${relatedForm}" form`,
                  sharedRoot: conn.relationship.sharedRoot
                }
              }
            });

            connectionCount++;
          }
        } catch (relatedError) {
          // Silently continue to next related form
        }
      }

      if (connectionCount > 0) {
        console.log(`Added ${connectionCount - (maxNodes - (maxNodes - connectionCount))} connections via related forms`);
      }
    } catch (error) {
      console.log(`Related forms lookup failed: ${error.message}`);
    }
  }

  // Return authentic connections found - no synthetic data
  if (connectionCount === 0) {
    console.log(`No authentic etymological connections found for "${baseWord}" - returning empty result`);
  } else {
    console.log(`Found ${connectionCount} authentic connections for "${baseWord}"`);
  }

  console.log(`Returning ${connectionCount} authentic connections: ${neighbors.map(n => n.data.word.text + '(' + n.data.word.language + ')').join(', ')}`);
  return { neighbors, connections };
}

// Analyze compound words
function analyzeCompoundWord(word) {
  const components = [];

  // Common compound patterns
  const commonRoots = [
    'book', 'house', 'work', 'time', 'water', 'fire', 'light', 'dark',
    'hand', 'foot', 'head', 'heart', 'mind', 'body', 'life', 'world',
    'man', 'woman', 'child', 'family', 'friend', 'home', 'school',
    'car', 'road', 'way', 'place', 'side', 'end', 'part', 'word',
    'line', 'right', 'left', 'high', 'low', 'long', 'short', 'big', 'small'
  ];

  for (const root of commonRoots) {
    if (word.includes(root) && word !== root) {
      components.push({
        component: root,
        meaning: `root word: ${root}`,
        type: 'compound_component',
        position: word.indexOf(root) === 0 ? 'prefix' : 'suffix'
      });
    }
  }

  return components;
}

// Generate cognate connections using the cognate service
async function generateCognateConnections(wordText, wordLanguage, count, existingConnections) {
  const connections = [];
  const existingWords = new Set(existingConnections.map(c => `${c.word.text.toLowerCase()}_${c.word.language}`));

  // DISABLED: Cognate service generates synthetic data
  console.log('Cognate service disabled - using only verified sources');
  return connections.slice(0, count);
}
  /*
  try {
    const cognateService = require('./services/cognateService');
    const cognates = await cognateService.findCognates(wordText, wordLanguage, ['en', 'es', 'fr', 'de', 'it', 'pt', 'la', 'gr', 'ru']);

    for (const cognate of cognates) {
      if (connections.length >= count) break;

      const wordKey = `${cognate.word.toLowerCase()}_${cognate.language}`;
      if (!existingWords.has(wordKey)) {
        connections.push({
          word: {
            id: generateId(),
            text: cognate.word,
            language: cognate.language,
            partOfSpeech: 'unknown',
            definition: `${cognate.language.toUpperCase()} cognate of "${wordText}"`
          },
          relationship: {
            type: 'cognate',
            confidence: cognate.confidence,
            notes: cognate.notes || `Cross-language cognate`,
            sharedRoot: cognate.concept || null
          }
        });
        existingWords.add(wordKey);
      }
    }
  } catch (error) {
    console.error(`Error generating cognate connections: ${error.message}`);
  }

  return connections;
}

// This function is no longer used - removed synthetic data generation

// This function is no longer used - removed synthetic data generation

// Enhanced function to check if a word is just a trivial derivative of another
function isSameWordDerivative(sourceText, targetText, sourceLang, targetLang) {
  const source = sourceText.toLowerCase().trim();
  const target = targetText.toLowerCase().trim();

  // Skip if words are identical
  if (source === target) {
    return true;
  }

  // For cross-language connections, check if one is clearly a derivative of the other
  if (sourceLang !== targetLang) {
    return isCrossLanguageDerivative(source, target, sourceLang, targetLang);
  }

  // Focus on basic inflections that are clearly derivatives (reduced filtering)
  const basicInflections = [
    // Only basic verb inflections and plurals
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
    // Handle spelling changes (e.g., "try" -> "tries", "hope" -> "hoped")
    if (suffix === 'ies' && source.endsWith('y') && target === source.slice(0, -1) + 'ies') {
      return true;
    }
    if (suffix === 'ed' && source.endsWith('e') && target === source + 'd') {
      return true;
    }
    if (suffix === 'ing' && source.endsWith('e') && target === source.slice(0, -1) + 'ing') {
      return true;
    }
    // Handle consonant doubling (e.g., "run" -> "running")
    if ((suffix === 'ing' || suffix === 'ed') && source.length >= 3) {
      const lastChar = source.slice(-1);
      const secondLastChar = source.slice(-2, -1);
      if (target === source + lastChar + suffix && 'bcdfghjklmnpqrstvwxz'.includes(lastChar) && 'aeiou'.includes(secondLastChar)) {
        return true;
      }
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
    // Handle hyphenated versions
    if (target === prefix + '-' + source || source === prefix + '-' + target) {
      return true;
    }
  }

  // Check for very similar words (edit distance of 1-2 for short words)
  if (source.length <= 4 && target.length <= 4) {
    const editDistance = getEditDistance(source, target);
    if (editDistance <= 1) {
      return true;
    }
  }

  return false;
}

// Simple edit distance calculation for very similar words
function getEditDistance(str1, str2) {
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

// Check if a word from one language is a derivative of a word from another language
function isCrossLanguageDerivative(source, target, sourceLang, targetLang) {
  // Common cross-language derivational patterns
  const crossLangPatterns = {
    // English to other languages
    'en_to_es': [
      { from: /tion$/, to: 'ción', example: 'action → acción' },
      { from: /ty$/, to: 'dad', example: 'quality → calidad' },
      { from: /ble$/, to: 'ble', example: 'possible → posible' },
      { from: /ic$/, to: 'ico', example: 'basic → básico' }
    ],
    'en_to_fr': [
      { from: /tion$/, to: 'tion', example: 'action → action' },
      { from: /ty$/, to: 'té', example: 'quality → qualité' },
      { from: /ble$/, to: 'ble', example: 'possible → possible' },
      { from: /ic$/, to: 'ique', example: 'basic → basique' }
    ],
    'en_to_de': [
      { from: /tion$/, to: 'ung', example: 'action → Handlung' },
      { from: /ty$/, to: 'ität', example: 'quality → Qualität' },
      { from: /ic$/, to: 'isch', example: 'basic → grundlegend' }
    ],
    'en_to_it': [
      { from: /tion$/, to: 'zione', example: 'action → azione' },
      { from: /ty$/, to: 'tà', example: 'quality → qualità' },
      { from: /ble$/, to: 'bile', example: 'possible → possibile' }
    ]
  };

  // Language-specific verb suffix patterns that indicate derivatives
  const verbSuffixPatterns = {
    'fr': ['er', 'ir', 're'], // French infinitives: tester, finir, prendre
    'es': ['ar', 'er', 'ir'], // Spanish infinitives: testar, comer, vivir
    'it': ['are', 'ere', 'ire'], // Italian infinitives: testare, credere, finire
    'de': ['en', 'ern', 'ieren'], // German infinitives: testen, ändern, studieren
    'pt': ['ar', 'er', 'ir'] // Portuguese infinitives: testar, comer, partir
  };

  // Check if the target word is clearly a verbal derivative
  if (verbSuffixPatterns[targetLang]) {
    for (const suffix of verbSuffixPatterns[targetLang]) {
      if (target.endsWith(suffix)) {
        // Remove the suffix and check similarity to source
        const targetRoot = target.slice(0, -suffix.length);
        if (targetRoot.length >= 3 && isWordSimilar(source, targetRoot)) {
          return true;
        }
      }
    }
  }

  // Check the reverse (if source is a derivative of target)
  if (verbSuffixPatterns[sourceLang]) {
    for (const suffix of verbSuffixPatterns[sourceLang]) {
      if (source.endsWith(suffix)) {
        const sourceRoot = source.slice(0, -suffix.length);
        if (sourceRoot.length >= 3 && isWordSimilar(target, sourceRoot)) {
          return true;
        }
      }
    }
  }

  // Check cross-language derivational patterns
  const patternKey = `${sourceLang}_to_${targetLang}`;
  const reversePatternKey = `${targetLang}_to_${sourceLang}`;

  const patterns = crossLangPatterns[patternKey] || [];
  const reversePatterns = crossLangPatterns[reversePatternKey] || [];

  // Check if target matches a pattern applied to source
  for (const pattern of patterns) {
    if (source.match(pattern.from)) {
      const expectedTarget = source.replace(pattern.from, pattern.to);
      if (expectedTarget === target) {
        return true;
      }
    }
  }

  // Check reverse
  for (const pattern of reversePatterns) {
    if (target.match(pattern.from)) {
      const expectedSource = target.replace(pattern.from, pattern.to);
      if (expectedSource === source) {
        return true;
      }
    }
  }

  return false;
}

// Helper function to check if two words are similar (for detecting root relationships)
function isWordSimilar(word1, word2) {
  if (word1 === word2) return true;
  if (Math.abs(word1.length - word2.length) > 2) return false;

  // Simple similarity check based on common characters
  const minLength = Math.min(word1.length, word2.length);
  let commonChars = 0;

  for (let i = 0; i < minLength; i++) {
    if (word1[i] === word2[i]) {
      commonChars++;
    }
  }

  // Consider similar if 80% or more characters match at the beginning
  return (commonChars / minLength) >= 0.8;
}

// Apply historical sound changes between languages
function applyHistoricalSoundChanges(word, sourceLang, targetLang) {
  let result = word;

  if (sourceLang === 'en' && ['es', 'fr', 'it', 'pt'].includes(targetLang)) {
    if (targetLang === 'es') {
      result = word.replace(/tion$/, 'ción').replace(/ty$/, 'dad').replace(/ph/, 'f');
    } else if (targetLang === 'fr') {
      result = word.replace(/tion$/, 'tion').replace(/ty$/, 'té').replace(/ch/, 'ch');
    } else if (targetLang === 'it') {
      result = word.replace(/tion$/, 'zione').replace(/ty$/, 'tà').replace(/ph/, 'f');
    } else if (targetLang === 'pt') {
      result = word.replace(/tion$/, 'ção').replace(/ty$/, 'dade');
    }
  } else if (sourceLang === 'en' && targetLang === 'de') {
    result = word.charAt(0).toUpperCase() + word.slice(1);
    if (word.endsWith('tion')) result = result.replace(/tion$/, 'ung');
  }

  return result;
}

function generateId() {
  return 'w' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

// Clear cache endpoint
app.post('/api/cache/clear', (req, res) => {
  // graphCache.flushAll(); // Disabled for development
  res.json({ message: 'Cache cleared successfully', timestamp: new Date().toISOString() });
});
*/

app.listen(port, () => {
  console.log(`Dynamic Etymology Mapping server running on port ${port}`);
  console.log('Using on-demand etymology lookup service');
});