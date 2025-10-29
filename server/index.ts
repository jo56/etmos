import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import rateLimit from '@fastify/rate-limit';
import NodeCache from 'node-cache';
import {
  SearchQueryParams,
  InitialRequestBody,
  NeighborsRequestBody,
  GraphNode,
  GraphEdge,
  Connection
} from './types';
import { GRAPH_CACHE_CONFIG, QUICK_CACHE_CONFIG } from './config/cache';
import { logger } from './utils/logger';
import etymologyService from './services/etymologyService';

const port = Number(process.env.PORT) || 54330;

// Enhanced cache for faster response times
const graphCache = new NodeCache(GRAPH_CACHE_CONFIG);

// Quick response cache for immediate feedback
const quickCache = new NodeCache(QUICK_CACHE_CONFIG);

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

// Create Fastify instance
const fastify: FastifyInstance = Fastify({
  logger: process.env.NODE_ENV === 'production' ? {
    level: 'warn' // Less verbose logging in production
  } : true,
  trustProxy: true, // Important for Railway/behind proxies - enables proper IP detection for rate limiting
  requestIdLogLabel: 'reqId',
  disableRequestLogging: process.env.NODE_ENV === 'production', // Reduce log noise in prod
  connectionTimeout: 30000, // 30 second connection timeout
  keepAliveTimeout: 65000, // 65 seconds (must be > load balancer timeout)
  requestTimeout: 25000 // 25 second request timeout to prevent hanging requests
});

// Register rate limiting - prevents API abuse
fastify.register(rateLimit, {
  max: 100, // 100 requests
  timeWindow: '15 minutes', // per 15 minutes
  errorResponseBuilder: () => ({
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.'
  })
});

// Register CORS plugin - restrict to frontend origin
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:3000']; // Development fallback

fastify.register(cors, {
  origin: allowedOrigins
});

// Register form body parser
fastify.register(formbody);

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  // Log error details for debugging
  logger.error({
    error: error.message,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    url: request.url,
    method: request.method
  }, 'Request error');

  // Don't leak error details in production
  if (error.statusCode && error.statusCode < 500) {
    reply.status(error.statusCode).send({
      error: error.message
    });
  } else {
    reply.status(500).send({
      error: 'Internal server error'
    });
  }
});

// API Routes

// Search/discover etymological connections for a word
fastify.get('/api/etymology/search', async (request: FastifyRequest<{ Querystring: SearchQueryParams }>, reply: FastifyReply) => {
  const { word, language } = request.query;

  if (!word) {
    return reply.code(400).send({ error: 'Word parameter is required' });
  }

  // Validate word length to prevent abuse
  if (word.length > 100) {
    return reply.code(400).send({ error: 'Word parameter is too long (max 100 characters)' });
  }

  try {
    logger.info(`Searching etymology for: "${word}" (language: ${language || 'any'})`);

    const etymologyData = await etymologyService.findEtymologicalConnections(word, language);

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
    logger.error({ error }, 'Error in etymology search');
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Get initial etymology data for a word (used for fresh starts)
fastify.post('/api/etymology/initial', async (request: FastifyRequest<{ Body: InitialRequestBody }>, reply: FastifyReply) => {
  const { word, language = 'en', maxConnections = 12 } = request.body;

  if (!word) {
    return reply.code(400).send({ error: 'Word parameter is required' });
  }

  // Validate word length to prevent abuse
  if (word.length > 100) {
    return reply.code(400).send({ error: 'Word parameter is too long (max 100 characters)' });
  }

  // Validate and cap maxConnections to prevent DoS
  const safeMaxConnections = Math.min(Math.max(1, maxConnections), 50);

  try {
    logger.info(`Getting initial etymology data for: "${word}" (${language})`);

    const etymologyData = await etymologyService.findEtymologicalConnections(word, language);

    // Select connections with enhanced randomization
    const selectedConnections = selectConnectionsWithRandomization(etymologyData.connections, safeMaxConnections, true);

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
    logger.error({ error }, 'Error getting initial etymology data');
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

  // Validate word length to prevent abuse
  if (word.length > 100) {
    return reply.code(400).send({ error: 'Word parameter is too long (max 100 characters)' });
  }

  // Validate and cap parameters to prevent DoS
  const safeMaxNodes = Math.min(Math.max(1, maxNodes), 20);
  const safeMaxNeighbors = Math.min(Math.max(1, maxNeighbors), 50);
  const safeCurrentNeighborCount = Math.max(0, currentNeighborCount);

  // Validate excludeIds is an array and limit its size
  const safeExcludeIds = Array.isArray(excludeIds) ? excludeIds.slice(0, 100) : [];

  try {
    logger.info(`Finding neighbors for: "${word}" (${language}) with wordId: ${wordId}`);

    // Quick cache check - include all factors that affect the result
    const sortedExcludeIds = [...safeExcludeIds].sort().join(',');
    const effectiveMaxNodes = Math.min(safeMaxNodes, safeMaxNeighbors - safeCurrentNeighborCount);
    const cacheKey = `neighbors:${language}:${word.toLowerCase()}:${effectiveMaxNodes}:${safeCurrentNeighborCount}:${sortedExcludeIds}`;
    const cached = quickCache.get(cacheKey);
    if (cached) {
      logger.debug('Using cached neighbors result');
      return reply.send(cached);
    }

    const etymologyData = await etymologyService.findEtymologicalConnections(word, language);

    // Select connections with randomization, excluding already shown nodes
    const availableConnections = etymologyData.connections.filter((conn: Connection) =>
      !safeExcludeIds.includes(conn.word.id)
    );

    const selectedConnections = selectConnectionsWithRandomization(
      availableConnections,
      Math.min(safeMaxNodes, safeMaxNeighbors - safeCurrentNeighborCount),
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
    logger.error({ error }, 'Error finding neighbors');
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
    const etymologyData = await etymologyService.findEtymologicalConnections(wordText, 'en');
    reply.send({
      word: etymologyData.sourceWord,
      connections: etymologyData.connections.slice(0, 5) // Limit to 5 for details view
    });
  } catch (error) {
    logger.error({ error }, 'Error getting word details');
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

// Debug cache endpoint - only available in development
fastify.get('/api/debug/cache', async (request: FastifyRequest, reply: FastifyReply) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (!isDevelopment) {
    return reply.code(404).send({ error: 'Not found' });
  }

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


// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  try {
    await fastify.close();
    logger.info('Server closed successfully');
    process.exit(0);
  } catch (err) {
    logger.error({ error: err }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
});

// Start server
const start = async (): Promise<void> => {
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    logger.info(`Dynamic Etymology Mapping server running on port ${port}`);
    logger.info('Using on-demand etymology lookup service');
    logger.info('Framework: Fastify with TypeScript');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();