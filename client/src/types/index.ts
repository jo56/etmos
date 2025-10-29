import * as d3 from 'd3';

export interface Word {
  id: string;
  text: string;
  language: string;
  partOfSpeech?: string;
  definition?: string;
  created?: string;
}

export interface EtymologicalConnection {
  id: string;
  sourceWordId: string;
  targetWordId: string;
  relationshipType: 'cognate' | 'borrowing' | 'calque' | 'derivative' | 'semantic' | 'phonetic';
  confidence: number;
  notes?: string;
  created?: string;
}

export interface GraphNode {
  id: string;
  data: {
    word: Word;
    expanded: boolean;
    isSource: boolean;
    neighborCount: number;
    expanding?: boolean; // For immediate UI feedback
  };
  position: {
    x: number;
    y: number;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  data: {
    connection: EtymologicalConnection;
  };
}

export interface GraphSettings {
  maxNeighbors: number;
}

export interface GraphState {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  sourceWordId: string | null;
  settings: GraphSettings;
}

// D3-specific types for graph rendering
export interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  word: Word;
  isSource: boolean;
  expanded: boolean;
  expanding?: boolean; // For immediate UI feedback
  width: number;
  height: number;
  radius: number; // Keep radius for collision detection (max of width/height / 2)
  color: string;
  fx?: number | null;
  fy?: number | null;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  id: string;
  source: string | D3Node;
  target: string | D3Node;
  relationshipType: string;
  confidence: number;
  notes: string;
  origin: string;
  sharedRoot?: string;
}