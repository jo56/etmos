class Language {
  constructor(code, name, family = null) {
    this.code = code; // ISO 639-1 code (e.g., 'en', 'es', 'fr')
    this.name = name; // Full language name
    this.family = family; // Language family (e.g., 'Indo-European')
  }
}

class Word {
  constructor(id, text, language, partOfSpeech = null, definition = null) {
    this.id = id;
    this.text = text; // The actual word/phrase
    this.language = language; // Language code
    this.partOfSpeech = partOfSpeech; // noun, verb, adjective, etc.
    this.definition = definition;
    this.created = new Date();
  }
}

class EtymologicalConnection {
  constructor(id, sourceWordId, targetWordId, relationshipType, confidence = 1.0, notes = null) {
    this.id = id;
    this.sourceWordId = sourceWordId;
    this.targetWordId = targetWordId;
    this.relationshipType = relationshipType; // 'cognate', 'borrowing', 'calque', 'derivative', etc.
    this.confidence = confidence; // 0.0 to 1.0 confidence score
    this.notes = notes;
    this.created = new Date();
  }
}

class GraphNode {
  constructor(word, x = 0, y = 0) {
    this.id = word.id;
    this.word = word;
    this.x = x;
    this.y = y;
    this.connections = []; // Array of connection IDs
    this.expanded = false; // Whether this node has been expanded to show connections
  }
}

class GraphEdge {
  constructor(connection, source, target) {
    this.id = connection.id;
    this.connection = connection;
    this.source = source; // Node ID
    this.target = target; // Node ID
  }
}

class LanguageGraph {
  constructor() {
    this.nodes = new Map(); // Map of node ID to GraphNode
    this.edges = new Map(); // Map of edge ID to GraphEdge
    this.words = new Map(); // Map of word ID to Word
    this.connections = new Map(); // Map of connection ID to EtymologicalConnection
    this.languages = new Map(); // Map of language code to Language
  }

  addWord(word) {
    this.words.set(word.id, word);
    if (!this.nodes.has(word.id)) {
      const node = new GraphNode(word);
      this.nodes.set(word.id, node);
    }
    return word;
  }

  addConnection(connection) {
    this.connections.set(connection.id, connection);
    const edge = new GraphEdge(connection, connection.sourceWordId, connection.targetWordId);
    this.edges.set(connection.id, edge);

    // Update node connections
    const sourceNode = this.nodes.get(connection.sourceWordId);
    const targetNode = this.nodes.get(connection.targetWordId);

    if (sourceNode && !sourceNode.connections.includes(connection.id)) {
      sourceNode.connections.push(connection.id);
    }
    if (targetNode && !targetNode.connections.includes(connection.id)) {
      targetNode.connections.push(connection.id);
    }

    return connection;
  }

  getConnectedWords(wordId) {
    const node = this.nodes.get(wordId);
    if (!node) return [];

    const connectedWords = [];
    for (const connectionId of node.connections) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        const otherWordId = connection.sourceWordId === wordId
          ? connection.targetWordId
          : connection.sourceWordId;
        const otherWord = this.words.get(otherWordId);
        if (otherWord) {
          connectedWords.push({
            word: otherWord,
            connection: connection
          });
        }
      }
    }
    return connectedWords;
  }

  expandNode(wordId) {
    const node = this.nodes.get(wordId);
    if (node) {
      node.expanded = true;
    }
    return this.getConnectedWords(wordId);
  }

  // Get subgraph around a specific word within N degrees
  getSubgraph(wordId, degrees = 2) {
    const visited = new Set();
    const queue = [{id: wordId, degree: 0}];
    const subgraphNodes = new Map();
    const subgraphEdges = new Map();

    while (queue.length > 0) {
      const {id, degree} = queue.shift();

      if (visited.has(id) || degree > degrees) continue;
      visited.add(id);

      const node = this.nodes.get(id);
      if (node) {
        subgraphNodes.set(id, node);

        for (const connectionId of node.connections) {
          const edge = this.edges.get(connectionId);
          if (edge && !subgraphEdges.has(connectionId)) {
            subgraphEdges.set(connectionId, edge);

            const otherId = edge.source === id ? edge.target : edge.source;
            if (!visited.has(otherId) && degree < degrees) {
              queue.push({id: otherId, degree: degree + 1});
            }
          }
        }
      }
    }

    return {
      nodes: Array.from(subgraphNodes.values()),
      edges: Array.from(subgraphEdges.values())
    };
  }
}

module.exports = {
  Language,
  Word,
  EtymologicalConnection,
  GraphNode,
  GraphEdge,
  LanguageGraph
};