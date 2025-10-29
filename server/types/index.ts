export interface Word {
  id: string;
  text: string;
  language: string;
  definition?: string;
  phonetic?: string;
  etymologies?: string[];
  partOfSpeech?: string;
}

export interface Connection {
  word: Word;
  type: string;
  confidence: number;
  source: string;
  notes?: string;
}

export interface EtymologyData {
  sourceWord: Word;
  connections: Connection[];
}

export interface GraphNode {
  id: string;
  data: {
    word: Word;
    expanded: boolean;
    isSource: boolean;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  data: {
    connection: Connection;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// API Request/Response types
export interface SearchQueryParams {
  word: string;
  language?: string;
}

export interface InitialRequestBody {
  word: string;
  language?: string;
  maxConnections?: number;
}

export interface NeighborsRequestBody {
  wordId: string;
  word?: string;
  language?: string;
  maxNodes?: number;
  excludeIds?: string[];
  currentNeighborCount?: number;
  maxNeighbors?: number;
}

// External API data types
export interface WiktionaryData {
  word: string;
  language: string;
  definitions?: string[];
  etymologies?: string[];
  pronunciations?: string[];
  partOfSpeech?: string;
}

export interface DictionaryApiData {
  word: string;
  phonetic?: string;
  meanings?: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
    }>;
  }>;
}

export interface EtymonlineData {
  word: string;
  etymology?: string;
  definition?: string;
}

// Cache types
export interface CacheOptions {
  stdTTL?: number;
  checkperiod?: number;
  useClones?: boolean;
  maxKeys?: number;
}