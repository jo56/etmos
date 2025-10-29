/**
 * Cache configuration constants for the server
 */

/**
 * Graph cache configuration
 * Used for caching full etymology graphs
 */
export const GRAPH_CACHE_CONFIG = {
  /** Cache TTL in seconds (30 minutes) */
  stdTTL: 1800,
  /** Check for expired keys every 10 minutes */
  checkperiod: 600,
  /** Better performance by avoiding deep cloning */
  useClones: false,
  /** Maximum number of cached graph entries */
  maxKeys: 10000
} as const;

/**
 * Quick response cache configuration
 * Used for immediate feedback and lightweight operations
 */
export const QUICK_CACHE_CONFIG = {
  /** Cache TTL in seconds (5 minutes) */
  stdTTL: 300,
  /** Check for expired keys every minute */
  checkperiod: 60,
  /** Better performance by avoiding deep cloning */
  useClones: false,
  /** Maximum number of cached quick response entries */
  maxKeys: 1000
} as const;

/**
 * Etymology service cache configuration
 * Used for caching individual etymology lookups
 */
export const ETYMOLOGY_SERVICE_CACHE_CONFIG = {
  /** Cache TTL in seconds (1 hour) */
  stdTTL: 3600
} as const;
