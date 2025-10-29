import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import NodeCache from 'node-cache';
import {
  SearchQueryParams,
  ExpandRequestBody,
  InitialRequestBody,
  NeighborsRequestBody,
  GraphNode,
  GraphEdge,
  Connection
} from './types';

// Using only real etymology sources from Wiktionary and Dictionary API

// Development cache-busting mechanism
function getEtymologyService() {
  // Always clear cache in development to pick up changes immediately
  delete require.cache[require.resolve('./services/etymologyService')];
  delete require.cache[require.resolve('./services/wiktionaryAPI')];
  // Removed universal engine - using only real sources
  const service = require('./services/etymologyService');
  return service.default || service;
}

// Use cache-busted service
const etymologyService = getEtymologyService();

const port = Number(process.env.PORT) || 54330;

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
function selectConnectionsWithRandomization(connections: Connection[], maxCount: number, prioritizePieRoots: boolean = true): Connection[] {
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

  const selected: Connection[] = [];

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
function findCrossNodeConnections(expandingNode: GraphNode, existingNodes: GraphNode[], existingEdges: GraphEdge[]): any[] {
  const crossConnections: any[] = [];
  const expandingWord = expandingNode.data.word;

  // Check each existing node for potential cross-connections
  for (const existingNode of existingNodes) {
    // Skip if it's the same node
    if (existingNode.id === expandingNode.id) continue;

    const existingWord = existingNode.data.word;

    // Check if there's already a direct connection between these nodes
    const hasDirectConnection = existingEdges.some(edge =>
      (edge.source === expandingNode.id && edge.target === existingNode.id) ||
      (edge.source === existingNode.id && edge.target === expandingNode.id)
    );

    if (hasDirectConnection) continue;

    // Look for potential connections based on various criteria
    const connectionType = determineConnectionType(expandingWord, existingWord);

    if (connectionType) {
      crossConnections.push({
        sourceNodeId: expandingNode.id,
        targetNodeId: existingNode.id,
        connection: {
          word: existingWord,
          type: connectionType.type,
          confidence: connectionType.confidence,
          source: 'cross-analysis',
          notes: connectionType.notes
        }
      });
    }
  }

  return crossConnections;
}

// Helper function to determine if two words should be connected
function determineConnectionType(word1: any, word2: any): { type: string; confidence: number; notes: string } | null {
  // Check for exact text match in different languages (cognates)
  if (word1.text.toLowerCase() === word2.text.toLowerCase() && word1.language !== word2.language) {
    return {
      type: 'cognate',
      confidence: 0.9,
      notes: `Identical forms in ${word1.language} and ${word2.language}`
    };
  }

  // Check for similar spelling (potential cognates or borrowings)
  const similarity = calculateStringSimilarity(word1.text.toLowerCase(), word2.text.toLowerCase());
  if (similarity > 0.7 && word1.language !== word2.language) {
    const confidence = Math.min(0.8, similarity * 0.9);
    return {
      type: similarity > 0.85 ? 'cognate' : 'borrowing',
      confidence,
      notes: `High similarity between ${word1.language} "${word1.text}" and ${word2.language} "${word2.text}"`
    };
  }

  // Check for root sharing (both from proto-languages)
  if ((word1.language.includes('pro') || word1.text.startsWith('*')) &&
      (word2.language.includes('pro') || word2.text.startsWith('*'))) {
    const rootSimilarity = calculateStringSimilarity(
      word1.text.replace(/^\*/, ''),
      word2.text.replace(/^\*/, '')
    );
    if (rootSimilarity > 0.6) {
      return {
        type: 'shared-root',
        confidence: Math.min(0.7, rootSimilarity * 0.8),
        notes: `Potential shared proto-root between "${word1.text}" and "${word2.text}"`
      };
    }
  }

  return null;
}

// Helper function to calculate string similarity
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Levenshtein distance implementation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

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

// Helper function to calculate cross-connection confidence
function calculateCrossConnectionConfidence(word1: any, word2: any, connectionType: string): number {
  let confidence = 0.5; // Base confidence

  // Boost for exact matches
  if (word1.text.toLowerCase() === word2.text.toLowerCase()) {
    confidence += 0.3;
  }

  // Boost for similar languages
  if (areLanguagesRelated(word1.language, word2.language)) {
    confidence += 0.2;
  }

  // Boost for proto-language connections
  if (word1.language.includes('pro') || word2.language.includes('pro')) {
    confidence += 0.1;
  }

  // Cap confidence for cross-connections (they're always less certain)
  return Math.min(0.8, confidence);
}

// Helper function to check if languages are related
function areLanguagesRelated(lang1: string, lang2: string): boolean {
  const indoEuropean = ['en', 'es', 'fr', 'de', 'it', 'pt', 'la', 'gr', 'ru', 'pl', 'nl', 'da', 'sv', 'no'];
  return indoEuropean.includes(lang1) && indoEuropean.includes(lang2);
}

// Create Fastify instance
const fastify: FastifyInstance = Fastify({
  logger: true
});

// Register CORS plugin
fastify.register(cors);

// Register form body parser
fastify.register(formbody);

// API Routes

// Search/discover etymological connections for a word
fastify.get('/api/etymology/search', async (request: FastifyRequest<{ Querystring: SearchQueryParams }>, reply: FastifyReply) => {
  const { word, language } = request.query;

  if (!word) {
    return reply.code(400).send({ error: 'Word parameter is required' });
  }

  try {
    console.log(`Searching etymology for: "${word}" (language: ${language || 'any'})`);

    const etymologyData = await getEtymologyService().findEtymologicalConnections(word, language);

    // Convert to graph format
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

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
    etymologyData.connections.forEach((connection: Connection) => {
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
      edges.push({
        id: `${etymologyData.sourceWord.id}-${connection.word.id}`,
        source: etymologyData.sourceWord.id,
        target: connection.word.id,
        type: connection.type,
        data: {
          connection: connection
        }
      });
    });

    reply.send({
      nodes,
      edges,
      sourceWord: etymologyData.sourceWord
    });
  } catch (error) {
    console.error('Error in etymology search:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Expand a specific node to show its connections
fastify.post('/api/etymology/expand', async (request: FastifyRequest<{ Body: ExpandRequestBody }>, reply: FastifyReply) => {
  const { wordId, wordText, language, existingNodes, existingEdges, maxConnections = 8 } = request.body;

  if (!wordId || !wordText || !language) {
    return reply.code(400).send({ error: 'wordId, wordText, and language are required' });
  }

  try {
    console.log(`Expanding node: "${wordText}" (${language})`);

    const etymologyData = await getEtymologyService().findEtymologicalConnections(wordText, language);

    // Find the expanding node
    const expandingNode = existingNodes.find((node: GraphNode) => node.id === wordId);
    if (!expandingNode) {
      return reply.code(404).send({ error: 'Node not found in existing nodes' });
    }

    // Select connections with randomization and PIE prioritization
    const selectedConnections = selectConnectionsWithRandomization(etymologyData.connections, maxConnections, true);

    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];

    // Add new nodes and edges for selected connections
    selectedConnections.forEach((connection: Connection) => {
      // Check if this node already exists
      const existingNode = existingNodes.find((node: GraphNode) =>
        node.data.word.text.toLowerCase() === connection.word.text.toLowerCase() &&
        node.data.word.language === connection.word.language
      );

      let targetNodeId: string;

      if (!existingNode) {
        // Create new node
        targetNodeId = connection.word.id;
        newNodes.push({
          id: targetNodeId,
          data: {
            word: connection.word,
            expanded: false,
            isSource: false
          }
        });
      } else {
        // Use existing node
        targetNodeId = existingNode.id;
      }

      // Create edge
      const edgeId = `${wordId}-${targetNodeId}`;

      // Check if edge already exists
      const existingEdge = existingEdges.find((edge: GraphEdge) => edge.id === edgeId);
      if (!existingEdge) {
        newEdges.push({
          id: edgeId,
          source: wordId,
          target: targetNodeId,
          type: connection.type,
          data: {
            connection: connection
          }
        });
      }
    });

    // Find cross-node connections
    const crossConnections = findCrossNodeConnections(expandingNode, existingNodes, existingEdges);

    // Add cross-connection edges
    crossConnections.forEach(crossConn => {
      const edgeId = `${crossConn.sourceNodeId}-${crossConn.targetNodeId}`;

      // Check if edge already exists
      const existingEdge = [...existingEdges, ...newEdges].find((edge: GraphEdge) => edge.id === edgeId);
      if (!existingEdge) {
        newEdges.push({
          id: edgeId,
          source: crossConn.sourceNodeId,
          target: crossConn.targetNodeId,
          type: crossConn.connection.type,
          data: {
            connection: crossConn.connection
          }
        });
      }
    });

    reply.send({
      newNodes,
      newEdges,
      expandedNodeId: wordId,
      crossConnections: crossConnections.length
    });

  } catch (error) {
    console.error('Error expanding node:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Get initial etymology data for a word (used for fresh starts)
fastify.post('/api/etymology/initial', async (request: FastifyRequest<{ Body: InitialRequestBody }>, reply: FastifyReply) => {
  const { word, language = 'en', maxConnections = 12 } = request.body;

  if (!word) {
    return reply.code(400).send({ error: 'Word parameter is required' });
  }

  try {
    console.log(`Getting initial etymology data for: "${word}" (${language})`);

    const etymologyData = await getEtymologyService().findEtymologicalConnections(word, language);

    // Select connections with enhanced randomization
    const selectedConnections = selectConnectionsWithRandomization(etymologyData.connections, maxConnections, true);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Add the source word as a node
    const sourceNode: GraphNode = {
      id: etymologyData.sourceWord.id,
      data: {
        word: etymologyData.sourceWord,
        expanded: true,
        isSource: true
      }
    };
    nodes.push(sourceNode);

    // Add connected words as nodes and create edges
    selectedConnections.forEach((connection: Connection) => {
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
      edges.push({
        id: `${etymologyData.sourceWord.id}-${connection.word.id}`,
        source: etymologyData.sourceWord.id,
        target: connection.word.id,
        type: connection.type,
        data: {
          connection: connection
        }
      });
    });

    // Transform response to match client expectations
    const responseSourceNode = nodes.find(node => node.data.isSource);
    const neighbors = nodes.filter(node => !node.data.isSource);
    const connections = edges;

    reply.send({
      sourceNode: responseSourceNode,
      neighbors,
      connections,
      totalAvailable: etymologyData.connections.length,
      // Legacy format for backward compatibility
      nodes,
      edges,
      sourceWord: etymologyData.sourceWord,
      totalConnections: etymologyData.connections.length,
      selectedConnections: selectedConnections.length
    });

  } catch (error) {
    console.error('Error getting initial etymology data:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Get neighboring words (similar to expand but for getting related words)
fastify.post('/api/etymology/neighbors', async (request: FastifyRequest<{ Body: NeighborsRequestBody }>, reply: FastifyReply) => {
  const { wordId, word, language = 'en', maxNodes = 8, excludeIds = [], currentNeighborCount = 0, maxNeighbors = 10 } = request.body;

  if (!wordId) {
    return reply.code(400).send({ error: 'WordId parameter is required' });
  }

  if (!word) {
    return reply.code(400).send({ error: 'Word text is required for neighbors lookup' });
  }

  try {
    console.log(`Finding neighbors for: "${word}" (${language}) with wordId: ${wordId}`);

    // Quick cache check - include all factors that affect the result
    const sortedExcludeIds = [...excludeIds].sort().join(',');
    const effectiveMaxNodes = Math.min(maxNodes, maxNeighbors - currentNeighborCount);
    const cacheKey = `neighbors:${language}:${word.toLowerCase()}:${effectiveMaxNodes}:${currentNeighborCount}:${sortedExcludeIds}`;
    const cached = quickCache.get(cacheKey);
    if (cached) {
      console.log('Using cached neighbors result');
      return reply.send(cached);
    }

    const etymologyData = await getEtymologyService().findEtymologicalConnections(word, language);

    // Select connections with randomization, excluding already shown nodes
    const availableConnections = etymologyData.connections.filter((conn: Connection) =>
      !excludeIds.includes(conn.word.id)
    );

    const selectedConnections = selectConnectionsWithRandomization(
      availableConnections,
      Math.min(maxNodes, maxNeighbors - currentNeighborCount),
      false
    );

    // Transform to the format the client expects
    const neighbors = selectedConnections.map(conn => ({
      id: conn.word.id,
      data: {
        word: conn.word,
        expanded: false,
        isSource: false
      }
    }));

    const connections = selectedConnections.map(conn => ({
      id: `${wordId}-${conn.word.id}`,
      source: wordId,
      target: conn.word.id,
      type: conn.type,
      data: {
        connection: conn
      }
    }));

    const result = {
      neighbors,
      connections,
      totalAvailable: etymologyData.connections.length,
      returned: selectedConnections.length,
      excludedCount: excludeIds.length
    };

    // Cache the result
    quickCache.set(cacheKey, result);

    reply.send(result);

  } catch (error) {
    console.error('Error finding neighbors:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Get details for a specific word
fastify.get('/api/words/:wordText', async (request: FastifyRequest<{ Params: { wordText: string } }>, reply: FastifyReply) => {
  const { wordText } = request.params;

  if (!wordText) {
    return reply.code(400).send({ error: 'Word text is required' });
  }

  try {
    const etymologyData = await getEtymologyService().findEtymologicalConnections(wordText, 'en');
    reply.send({
      word: etymologyData.sourceWord,
      connections: etymologyData.connections.slice(0, 5) // Limit to 5 for details view
    });
  } catch (error) {
    console.error('Error getting word details:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Health check endpoint
fastify.get('/api/health', async (request: FastifyRequest, reply: FastifyReply) => {
  reply.send({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
    framework: 'fastify',
    language: 'typescript'
  });
});

// Debug cache endpoint
fastify.get('/api/debug/cache', async (request: FastifyRequest, reply: FastifyReply) => {
  reply.send({
    graphCache: {
      keys: graphCache.keys().length,
      stats: graphCache.getStats()
    },
    quickCache: {
      keys: quickCache.keys().length,
      stats: quickCache.getStats()
    }
  });
});

// Test shared root endpoint
fastify.get('/api/test-shared-root', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const testWords = [
      { text: 'mother', language: 'en' },
      { text: 'mutter', language: 'de' },
      { text: 'mère', language: 'fr' }
    ];

    const results = [];
    for (const word of testWords) {
      const etymologyData = await getEtymologyService().findEtymologicalConnections(word.text, word.language);
      results.push({
        word: word.text,
        language: word.language,
        connections: etymologyData.connections.slice(0, 3)
      });
    }

    reply.send({
      testResults: results,
      message: 'Shared root test completed'
    });
  } catch (error) {
    console.error('Error in shared root test:', error);
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Start server
const start = async (): Promise<void> => {
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Dynamic Etymology Mapping server running on port ${port}`);
    console.log('Using on-demand etymology lookup service');
    console.log('Framework: Fastify with TypeScript');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();