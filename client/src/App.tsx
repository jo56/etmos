import { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LanguageGraph from './components/LanguageGraph';
import SearchBar from './components/SearchBar';
import FloatingSettings from './components/FloatingSettings';
import { apiService } from './services/api';
import type { Word, GraphState, GraphSettings } from './types';
import { logger } from './utils/logger';
import './styles/themes.css';

export type ThemeName = 'minimalist' | 'origami' | 'bauhaus' | 'swiss' | 'brutalist' | 'art_deco' | 'constructivist' | 'memphis' | 'japanese' | 'scandinavian' | 'modernist' | 'deconstructivist';

export interface Theme {
  name: ThemeName;
  displayName: string;
  description: string;
  background: string;
  nodeStyles: {
    source: any;
    expanded: any;
    default: any;
  };
  edgeStyles: any;
  fontFamily: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
  };
}

const queryClient = new QueryClient();

function LanguageMappingApp() {
  const [sourceWord, setSourceWord] = useState<string>('');
  const [sourceLanguage, setSourceLanguage] = useState<string>('');
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('origami');
  const [showInitialScreen, setShowInitialScreen] = useState<boolean>(true);
  const [graphState, setGraphState] = useState<GraphState>({
    nodes: new Map(),
    edges: new Map(),
    sourceWordId: null,
    settings: {
      maxNeighbors: 10
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'info' | 'warning' | 'error';
    visible: boolean;
  } | null>(null);

  const queryClientInstance = useQueryClient();

  // Helper function to show notifications with different durations
  const showNotification = (message: string, type: 'info' | 'warning' | 'error' = 'info', duration: number = 3000) => {
    setNotification({ message, type, visible: true });
    setTimeout(() => {
      setNotification(prev => prev ? { ...prev, visible: false } : null);
      setTimeout(() => setNotification(null), 300); // Allow fade out animation
    }, duration);
  };

  // Helper function to create word key for duplicate detection
  const createWordKey = (text: string, language: string) => {
    return `${text.toLowerCase()}_${language.toLowerCase()}`;
  };

  // Helper function to check if word already exists
  const wordExists = (text: string, language: string, currentNodes: Map<string, any>) => {
    const targetKey = createWordKey(text, language);
    for (const node of currentNodes.values()) {
      const nodeKey = createWordKey(node.data.word.text, node.data.word.language);
      if (nodeKey === targetKey) {
        return true;
      }
    }
    return false;
  };

  // Helper function to check if a word is malformed/corrupted
  const isMalformedWord = (text: string, language: string) => {
    // Filter out obviously corrupted words
    if (text.length < 2) return true;

    // Check for repeated characters that suggest corruption
    if (/(.)\1{2,}/.test(text)) return true; // 3+ repeated chars like "testss"

    // Check for impossible consonant clusters in known languages
    if (language === 'en' && /[bcdfghjklmnpqrstvwxyz]{4,}/.test(text)) return true;
    if (language === 'de' && /[bcdfghjklmnpqrstvwxyz]{5,}/.test(text)) return true;

    // Check for words that are just character fragments
    if (text.length < 4 && /^[bcdfghjklmnpqrstvwxyz]+$/.test(text)) return true;

    // Specific corrupted words we've seen (expanding list)
    const knownCorrupted = [
      'desd', 'desds', 'tesd', 'tesds', 'desded', 'testeds', 'testeded',
      'tesded', 'testesed', 'tesdeds', 'tesdsd', 'desdeds'
    ];
    if (knownCorrupted.includes(text.toLowerCase())) return true;

    // Check for impossible endings in different languages
    if (language === 'de' && text.endsWith('sd')) return true; // German doesn't end in 'sd'
    if (language === 'es' && text.endsWith('sd')) return true; // Spanish doesn't end in 'sd'
    if (language === 'fr' && text.endsWith('sd')) return true; // French doesn't end in 'sd'

    // Check for double past tense patterns (common corruption)
    if (language === 'en' && /ed.*ed$/.test(text)) return true; // like "testeded"

    // Check for double plural patterns
    if (language === 'en' && /s.*s$/.test(text) && text.length > 6) return true; // like "testss"

    // Filter out words that are clearly malformed derivations
    if (language === 'en') {
      // Double suffixes are usually incorrect
      if (text.includes('eded') || text.includes('inging') || text.includes('eded')) return true;

      // Invalid suffix combinations
      if (text.endsWith('eds') && !['beds', 'reds', 'feds', 'weds'].includes(text.toLowerCase())) return true;
    }

    // Check for degraded words that mix morphemes incorrectly
    if (text.toLowerCase().includes('tesd') || text.toLowerCase().includes('desd')) return true;

    return false;
  };

  // Helper function to check for self-referential loops
  const wouldCreateLoop = (expandingNodeId: string, newNeighbors: any[], currentNodes: Map<string, any>) => {
    const expandingNode = currentNodes.get(expandingNodeId);
    if (!expandingNode) return false;

    const expandingWordKey = createWordKey(expandingNode.data.word.text, expandingNode.data.word.language);

    // Only check if any new neighbor is the exact same word as the expanding node
    // This prevents true self-referential loops like test -> test
    for (const neighbor of newNeighbors) {
      const neighborKey = createWordKey(neighbor.data.word.text, neighbor.data.word.language);
      if (neighborKey === expandingWordKey) {
        logger.debug('Prevented self-referential loop:', expandingNode.data.word.text, '->', neighbor.data.word.text);
        return true;
      }
    }

    return false;
  };

  // Initial word search and graph creation
  const initialGraphQuery = useQuery({
    queryKey: ['initialGraph', sourceWord, sourceLanguage, graphState.settings.maxNeighbors],
    queryFn: () => sourceWord && sourceLanguage ?
      apiService.getInitialConnections(
        sourceWord,
        sourceLanguage,
        graphState.settings.maxNeighbors
      ) : null,
    enabled: !!sourceWord && !!sourceLanguage,
  });

  // Node expansion mutation
  const expandNodeMutation = useMutation({
    mutationFn: async ({ wordId }: { wordId: string }) => {
      const excludeIds = Array.from(graphState.nodes.keys());
      const node = graphState.nodes.get(wordId);
      if (!node) throw new Error('Node not found');

      // Count current neighbors (connected nodes) for this specific node
      const currentNeighborCount = Array.from(graphState.edges.values()).filter(edge =>
        edge.source === wordId || edge.target === wordId
      ).length;

      logger.debug('API call: expanding node', wordId, 'excluding', excludeIds.length, 'existing nodes', 'current neighbors:', currentNeighborCount);

      const result = await apiService.getNeighbors(
        wordId,
        graphState.settings.maxNeighbors * 5, // Request 5x more than maxNeighbors to allow for filtering
        excludeIds,
        currentNeighborCount, // Pass current neighbor count to backend
        graphState.settings.maxNeighbors, // Pass current maxNeighbors setting
        node.data.word.text, // Pass word text
        node.data.word.language // Pass word language
      );

      logger.debug('API response:', result);
      return result;
    },
    retry: 2, // Retry failed expansions up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
    onSuccess: (data, variables) => {
      logger.debug('API returned data:', {
        neighbors: data.neighbors?.length || 0,
        connections: data.connections?.length || 0,
        note: data.note || 'none',
        restrictionReason: data.restrictionReason || 'none'
      });

      setError(null);

      // Handle backend restriction responses
      if (data.restrictionReason) {
        setGraphState(prev => {
          const newNodes = new Map(prev.nodes);
          const expandingNode = newNodes.get(variables.wordId);
          if (expandingNode) {
            newNodes.set(variables.wordId, {
              ...expandingNode,
              data: {
                ...expandingNode.data,
                expanding: false, // Clear expanding flag
                // Don't mark as expanded since no new nodes were added
                neighborCount: expandingNode.data.neighborCount || 0
              }
            });
          }

          // Show appropriate notification based on restriction reason
          if (data.restrictionReason === 'max_neighbors_reached') {
            showNotification(
              `Node already has maximum neighbors (${graphState.settings.maxNeighbors})`,
              'warning'
            );
          } else if (data.restrictionReason === 'no_connections_found') {
            showNotification(
              `No other etymological connections found`,
              'info'
            );
          } else if (data.restrictionReason === 'all_connections_exist') {
            showNotification(
              `All existing connections are already in the graph`,
              'info'
            );
          }

          return {
            ...prev,
            nodes: newNodes
          };
        });
        return;
      }

      setGraphState(prev => {
        const newNodes = new Map(prev.nodes);
        const newEdges = new Map(prev.edges);
        let addedCount = 0;
        let duplicateCount = 0;
        // Check for self-referential loops before processing
        if (wouldCreateLoop(variables.wordId, data.neighbors || [], newNodes)) {
          logger.debug('Expansion blocked: would create self-referential loop');

          // Clear expanding flag but don't mark as expanded since we blocked it
          const expandingNode = newNodes.get(variables.wordId);
          if (expandingNode) {
            newNodes.set(variables.wordId, {
              ...expandingNode,
              data: {
                ...expandingNode.data,
                expanding: false, // Clear expanding flag
                // Don't mark as expanded since we blocked the expansion
                neighborCount: 0
              }
            });
          }

          showNotification(
            `Expansion blocked to prevent self-referential loops`,
            'warning'
          );

          return {
            ...prev,
            nodes: newNodes,
            edges: newEdges
          };
        }

        // Add new nodes (filter duplicates and malformed words)
        data.neighbors?.forEach((nodeData: any) => {
          const word = nodeData.data.word;

          if (isMalformedWord(word.text, word.language)) {
            logger.debug('Filtered malformed word:', word.text, '(' + word.language + ')');
            duplicateCount++; // Count as duplicate to track filtering
            return;
          }

          if (!wordExists(word.text, word.language, newNodes)) {
            newNodes.set(nodeData.id, {
              ...nodeData,
              data: {
                ...nodeData.data,
                expanded: false,
                isSource: false,
                neighborCount: 0
              }
            });
            addedCount++;
          } else {
            duplicateCount++;
          }
        });

        // Add new edges (only for nodes that were actually added)
        data.connections?.forEach((edgeData: any) => {
          if (newNodes.has(edgeData.source) && newNodes.has(edgeData.target)) {
            newEdges.set(edgeData.id, edgeData);
          }
        });

        // Update the node - only mark as expanded if we actually added neighbors
        const expandingNode = newNodes.get(variables.wordId);
        if (expandingNode) {
          newNodes.set(variables.wordId, {
            ...expandingNode,
            data: {
              ...expandingNode.data,
              expanded: addedCount > 0, // Only mark as expanded if we actually added neighbors
              expanding: false, // Clear the expanding flag
              neighborCount: addedCount
            }
          });
        }

        logger.debug('Node expansion completed:', {
          nodesAdded: addedCount,
          duplicatesSkipped: duplicateCount,
          totalNodes: newNodes.size,
          totalEdges: newEdges.size
        });

        // Show appropriate notifications
        if (addedCount === 0 && duplicateCount === 0) {
          const expandedWord = expandingNode?.data.word;
          if (expandedWord) {
            showNotification(
              `No etymological connections found for "${expandedWord.text}" (${expandedWord.language})`,
              'info'
            );
          }
        } else if (addedCount === 0 && duplicateCount > 0) {
          const expandedWord = expandingNode?.data.word;
          if (expandedWord) {
            showNotification(
              `All connections for "${expandedWord.text}" already exist in the graph`,
              'info'
            );
          }
        }

        return {
          ...prev,
          nodes: newNodes,
          edges: newEdges
        };
      });
    },
    onError: (error, variables) => {
      logger.error('Node expansion failed:', error, 'for node:', variables.wordId);
      setError(`Failed to expand node. ${error.message || 'Please try again.'}`);

      // On error, clear expanding flag but don't mark as expanded so user can retry
      setGraphState(prev => {
        const newNodes = new Map(prev.nodes);
        const failedNode = newNodes.get(variables.wordId);
        if (failedNode) {
          newNodes.set(variables.wordId, {
            ...failedNode,
            data: {
              ...failedNode.data,
              expanding: false, // Clear the expanding flag
              // Don't mark as expanded so user can retry the expansion
              neighborCount: 0 // No neighbors added due to error
            }
          });
        }
        return { ...prev, nodes: newNodes };
      });

      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    },
  });

  // Track if initial graph has been loaded to prevent re-initialization
  const initialGraphLoadedRef = useRef(false);

  // Update graph when initial data loads
  useEffect(() => {
    if (initialGraphQuery.data && !initialGraphLoadedRef.current) {
      initialGraphLoadedRef.current = true;
      // Build new graph data first, then set all at once to prevent flashing
      const nodes = new Map();
      const edges = new Map();

      // Add source node
      nodes.set(initialGraphQuery.data.sourceNode.id, {
        ...initialGraphQuery.data.sourceNode,
        data: {
          ...initialGraphQuery.data.sourceNode.data,
          expanded: false,
          isSource: true,
          neighborCount: initialGraphQuery.data.neighbors.length
        }
      });

      // Add neighbor nodes (filter duplicates)
      let addedNeighbors = 0;
      let duplicateNeighbors = 0;

      initialGraphQuery.data.neighbors.forEach((node: any) => {
        const word = node.data.word;

        if (isMalformedWord(word.text, word.language)) {
          logger.debug('Filtered malformed word in initial graph:', word.text, '(' + word.language + ')');
          duplicateNeighbors++; // Count as duplicate to track filtering
          return;
        }

        if (!wordExists(word.text, word.language, nodes)) {
          nodes.set(node.id, {
            ...node,
            data: {
              ...node.data,
              expanded: false,
              isSource: false,
              neighborCount: 0
            }
          });
          addedNeighbors++;
        } else {
          duplicateNeighbors++;
        }
      });

      // Add edges (only for nodes that were actually added)
      initialGraphQuery.data.connections.forEach((edge: any) => {
        if (nodes.has(edge.source) && nodes.has(edge.target)) {
          edges.set(edge.id, edge);
        }
      });

      setGraphState(prev => ({
        ...prev,
        nodes,
        edges,
        sourceWordId: initialGraphQuery.data.sourceNode.id
      }));

      logger.debug('Initial graph loaded:', {
        totalNodes: nodes.size,
        totalEdges: edges.size,
        neighborsAdded: addedNeighbors,
        duplicatesSkipped: duplicateNeighbors,
        serverDuplicatesFiltered: initialGraphQuery.data.duplicatesFiltered || 0
      });
    }
  }, [initialGraphQuery.data]);

  const handleWordSearch = (word: string, language: string = 'en') => {
    const normalizedWord = word.toLowerCase().trim();
    const currentWord = sourceWord.toLowerCase().trim();

    // Check if we're searching for the same word as current graph
    if (normalizedWord === currentWord && language === sourceLanguage && !showInitialScreen) {
      // Reload the current graph with current settings
      logger.debug(`Reloading graph for "${word}" with current max neighbors: ${graphState.settings.maxNeighbors}`);
      showNotification(
        `Reloading "${word}" with max neighbors: ${graphState.settings.maxNeighbors}`,
        'info'
      );

      // Clear the current graph
      setGraphState({
        nodes: new Map(),
        edges: new Map(),
        sourceWordId: null,
        settings: graphState.settings // Keep current settings
      });

      // Reset the loading flag to trigger new fetch
      initialGraphLoadedRef.current = false;

      // Force re-query by invalidating and immediately refetching
      queryClientInstance.invalidateQueries({ queryKey: ['initialGraph', word, language, graphState.settings.maxNeighbors] });
      queryClientInstance.refetchQueries({ queryKey: ['initialGraph', word, language, graphState.settings.maxNeighbors] });
    } else {
      // Normal new search behavior
      initialGraphLoadedRef.current = false; // Reset for new search
      setSourceWord(word);
      setSourceLanguage(language);
      setShowInitialScreen(false); // Switch to graph view
    }
  };

  const handleNodeClick = (word: Word) => {
    const node = graphState.nodes.get(word.id);
    if (!node) {
      logger.warn('Node not found in graph state:', word.id, word.text);
      return;
    }

    logger.debug('Node clicked:', {
      wordId: word.id,
      wordText: word.text,
      language: word.language,
      isExpanded: node.data.expanded,
      isSource: node.data.isSource,
      isExpanding: node.data.expanding,
      mutationLoading: expandNodeMutation.isPending
    });

    // Allow clicks even if a different mutation is in progress, but prevent multiple expansions of the same node
    if (node.data.expanding) {
      logger.debug('This specific node is already expanding, skipping click');
      showNotification(
        `"${word.text}" is already expanding, please wait...`,
        'info',
        2000
      );
      return;
    }

    // Prevent expansion of nodes that are themselves malformed
    if (isMalformedWord(word.text, word.language)) {
      logger.debug('Preventing expansion of malformed word:', word.text);
      showNotification(
        `Cannot expand corrupted word "${word.text}"`,
        'warning'
      );
      return;
    }

    // If node is not expanded and not currently expanding, expand it
    if (!node.data.expanded && !node.data.expanding) {
      logger.debug('Expanding node:', word.text, word.language, 'with ID:', word.id);

      // Mark node as expanding to prevent double-clicks (but not expanded yet)
      setGraphState(prev => {
        const newNodes = new Map(prev.nodes);
        const targetNode = newNodes.get(word.id);
        if (targetNode) {
          logger.debug('Marking node as expanding:', word.id);
          newNodes.set(word.id, {
            ...targetNode,
            data: {
              ...targetNode.data,
              expanding: true // Add expanding flag for visual feedback, but don't mark as expanded yet
            }
          });
        } else {
          logger.warn('Target node not found for marking as expanding:', word.id);
        }
        return { ...prev, nodes: newNodes };
      });

      // Start the expansion mutation
      expandNodeMutation.mutate({ wordId: word.id });
    } else if (node.data.expanding) {
      logger.debug('Node already expanding:', word.text);
      // Visual feedback only - no notification needed
    } else if (node.data.expanded) {
      logger.debug('Node already expanded:', word.text);
      showNotification(
        `"${word.text}" has already been expanded to its maximum connections`,
        'info'
      );
    }

    // Find connections from existing graph data
    Array.from(graphState.edges.values())
      .filter(edge => edge.source === word.id || edge.target === word.id)
      .map(edge => {
        const isSource = edge.source === word.id;
        const relatedNodeId = isSource ? edge.target : edge.source;
        const relatedNode = graphState.nodes.get(relatedNodeId);

        return {
          connection: edge.data.connection,
          relatedWord: relatedNode?.data.word
        };
      })
      .filter(conn => conn.relatedWord);

  };

  const updateSettings = (newSettings: Partial<GraphSettings>) => {
    const oldMaxNeighbors = graphState.settings.maxNeighbors;
    setGraphState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));

    // If maxNeighbors changed and we have a current word, trigger reload
    if (newSettings.maxNeighbors !== undefined &&
        newSettings.maxNeighbors !== oldMaxNeighbors &&
        sourceWord &&
        sourceLanguage &&
        !showInitialScreen) {

      logger.debug(`Max neighbors changed from ${oldMaxNeighbors} to ${newSettings.maxNeighbors}, reloading graph`);
      showNotification(
        `Reloading "${sourceWord}" with ${newSettings.maxNeighbors} max neighbors`,
        'info'
      );

      // Use setTimeout to ensure the state update has been processed
      setTimeout(() => {
        // Clear the current graph
        setGraphState(prev => ({
          nodes: new Map(),
          edges: new Map(),
          sourceWordId: null,
          settings: prev.settings // Keep the updated settings
        }));
  
        // Reset the loading flag to trigger new fetch
        initialGraphLoadedRef.current = false;

        // Force re-query with new settings
        queryClientInstance.invalidateQueries({ queryKey: ['initialGraph', sourceWord, sourceLanguage, newSettings.maxNeighbors] });
        queryClientInstance.refetchQueries({ queryKey: ['initialGraph', sourceWord, sourceLanguage, newSettings.maxNeighbors] });
      }, 0);
    }
  };

  const clearGraph = () => {
    initialGraphLoadedRef.current = false; // Reset for new search
    setGraphState({
      nodes: new Map(),
      edges: new Map(),
      sourceWordId: null,
      settings: graphState.settings
    });
    setSourceWord('');
    setSourceLanguage('');
    setShowInitialScreen(true); // Return to initial screen
  };

  // Convert Map to Array for component props
  const graphNodes = Array.from(graphState.nodes.values());
  const graphEdges = Array.from(graphState.edges.values());

  if (showInitialScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center relative" style={{
        background: 'conic-gradient(from 0deg at 50% 50%, rgba(255, 182, 193, 0.1) 0deg, rgba(255, 218, 185, 0.1) 72deg, rgba(255, 255, 255, 0.05) 144deg, rgba(240, 248, 255, 0.1) 216deg, rgba(255, 192, 203, 0.1) 288deg, rgba(255, 182, 193, 0.1) 360deg), linear-gradient(135deg, #fefefe 0%, #f9fafb 50%, #f3f4f6 100%)',
        fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic Pro', sans-serif"
      }}>
        {/* Animated origami-style nodes */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
          <defs>
            <filter id="origamiShadow">
              <feDropShadow dx="2" dy="4" stdDeviation="2" floodColor="rgba(239, 68, 68, 0.3)"/>
              <feDropShadow dx="-1" dy="-2" stdDeviation="1" floodColor="rgba(255, 255, 255, 0.8)"/>
            </filter>
            <filter id="origamiShadowExpanded">
              <feDropShadow dx="1.5" dy="3" stdDeviation="1.5" floodColor="rgba(249, 115, 22, 0.25)"/>
              <feDropShadow dx="-0.8" dy="-1.5" stdDeviation="1" floodColor="rgba(255, 255, 255, 0.7)"/>
            </filter>
            <filter id="origamiShadowDefault">
              <feDropShadow dx="1" dy="2" stdDeviation="1" floodColor="rgba(245, 158, 11, 0.2)"/>
              <feDropShadow dx="-0.5" dy="-1" stdDeviation="0.5" floodColor="rgba(255, 255, 255, 0.6)"/>
            </filter>
          </defs>

          {/* Source-style origami node */}
          <polygon
            points="15,8 85,8 100,20 100,80 85,92 15,92 0,80 0,20"
            transform="translate(-20, -6)"
            fill="#f87171"
            stroke="#ef4444"
            strokeWidth="2"
            filter="url(#origamiShadow)"
            opacity="0.8"
            style={{ transformOrigin: 'center', transform: 'perspective(100px) rotateX(15deg) rotateY(-10deg)' }}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-20,-6; -20,4; -20,-6"
              dur="8s"
              repeatCount="indefinite"
            />
          </polygon>

          {/* Expanded-style origami node */}
          <polygon
            points="12,0 68,0 80,12 80,68 68,80 12,80 0,68 0,12"
            transform="translate(130, 10)"
            fill="#fb923c"
            stroke="#f97316"
            strokeWidth="2"
            filter="url(#origamiShadowExpanded)"
            opacity="0.6"
            style={{ transformOrigin: 'center', transform: 'perspective(80px) rotateX(12deg) rotateY(-8deg)' }}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="130,10; 120,10; 130,10"
              dur="10s"
              repeatCount="indefinite"
            />
          </polygon>

          {/* Default-style origami node */}
          <polygon
            points="8,0 72,0 80,8 80,72 72,80 8,80 0,72 0,8"
            transform="translate(0, 120)"
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="1.5"
            filter="url(#origamiShadowDefault)"
            opacity="0.4"
            style={{ transformOrigin: 'center', transform: 'perspective(60px) rotateX(10deg) rotateY(-6deg)' }}
          >
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1; 1.2; 1"
              dur="6s"
              repeatCount="indefinite"
            />
          </polygon>

          {/* Another default origami node */}
          <polygon
            points="6,0 54,0 60,6 60,54 54,60 6,60 0,54 0,6"
            transform="translate(150, 120)"
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="1.5"
            filter="url(#origamiShadowDefault)"
            opacity="0.3"
            style={{ transformOrigin: 'center', transform: 'perspective(60px) rotateX(10deg) rotateY(-6deg)' }}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="150,120; 150,110; 150,120"
              dur="12s"
              repeatCount="indefinite"
            />
          </polygon>

          {/* Connecting lines with origami style */}
          <line
            x1="15%"
            y1="20%"
            x2="85%"
            y2="25%"
            stroke="#fb923c"
            strokeWidth="3"
            opacity="0.3"
            strokeLinecap="round"
            strokeDasharray="0,8,4,8"
            filter="drop-shadow(1px 2px 3px rgba(251, 146, 60, 0.2))"
          >
            <animate attributeName="stroke-dashoffset" values="0;20;0" dur="4s" repeatCount="indefinite"/>
          </line>
        </svg>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-[60vh]" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem' }}>
          <div className="text-center space-y-3 mb-16">
            <h1 className="text-7xl md:text-8xl font-light" style={{
              color: '#374151',
              fontWeight: 300,
              letterSpacing: '-0.02em',
              lineHeight: '0.9'
            }}>
              etmos
            </h1>
            <p className="text-xl font-light" style={{ color: '#6b7280' }}>
              interactive etymology visualization
            </p>
          </div>

          <div className="w-full mb-12">
            <SearchBar
              onSearch={handleWordSearch}
              isLoading={initialGraphQuery.isLoading}
            />
          </div>

          <div className="text-center">
            <p className="font-light mb-6 text-sm" style={{ color: '#9ca3af' }}>try exploring with:</p>
            <div className="flex flex-wrap justify-center gap-6">
              <button
                onClick={() => handleWordSearch('water', 'en')}
                className="px-6 py-2 transition-colors font-light border-b border-transparent hover:border-orange-300"
                style={{
                  color: '#6b7280',
                  filter: 'drop-shadow(1px 2px 4px rgba(251, 146, 60, 0.1))'
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#374151'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#6b7280'}
              >
                water
              </button>
              <button
                onClick={() => handleWordSearch('earth', 'en')}
                className="px-6 py-2 transition-colors font-light border-b border-transparent hover:border-orange-300"
                style={{
                  color: '#6b7280',
                  filter: 'drop-shadow(1px 2px 4px rgba(251, 146, 60, 0.1))'
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#374151'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#6b7280'}
              >
                earth
              </button>
              <button
                onClick={() => handleWordSearch('fire', 'en')}
                className="px-6 py-2 transition-colors font-light border-b border-transparent hover:border-orange-300"
                style={{
                  color: '#6b7280',
                  filter: 'drop-shadow(1px 2px 4px rgba(251, 146, 60, 0.1))'
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.color = '#374151'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.color = '#6b7280'}
              >
                fire
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Full-screen graph visualization as backdrop */}
      <div className="absolute inset-0 w-full h-full z-10">
        <LanguageGraph
          nodes={graphNodes}
          edges={graphEdges}
          onNodeClick={handleNodeClick}
          centerNode={graphState.sourceWordId || undefined}
          theme={currentTheme}
          fullPage={true}
        />
      </div>

      {/* Video game style save indicator */}
      {(initialGraphQuery.isLoading || expandNodeMutation.isPending || Array.from(graphState.nodes.values()).some(node => node.data.expanding)) && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          pointerEvents: 'none'
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" className="opacity-80">
            {/* Outer ring */}
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="rgba(55, 65, 81, 0.3)"
              strokeWidth="2"
            />
            {/* Animated progress ring */}
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="#374151"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="88"
              strokeDashoffset="88"
              transform="rotate(-90 16 16)"
            >
              <animate
                attributeName="stroke-dashoffset"
                values="88;0;88"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Inner pulsing dot */}
            <circle
              cx="16"
              cy="16"
              r="4"
              fill="#374151"
            >
              <animate
                attributeName="r"
                values="3;5;3"
                dur="1s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.6;1;0.6"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </div>
      )}

      {/* Floating Settings Panel */}
      <FloatingSettings
        sourceWord={sourceWord}
        sourceLanguage={sourceLanguage}
        graphState={graphState}
        updateSettings={updateSettings}
        onNewSearch={handleWordSearch}
        onClearGraph={clearGraph}
        onThemeChange={setCurrentTheme}
        currentTheme={currentTheme}
        isLoading={initialGraphQuery.isLoading || expandNodeMutation.isPending}
        nodeCount={graphNodes.length}
        edgeCount={graphEdges.length}
      />


      {/* Error overlay */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg">
            {error}
          </div>
        </div>
      )}

      {/* Graceful origami-themed notification popup */}
      {notification && (
        <div
          className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ease-out ${
            notification.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
          }`}
        >
          <div
            className={`px-6 py-3 rounded-2xl backdrop-blur-md border text-sm text-center shadow-xl ${
              notification.type === 'info' ? 'bg-white/95 text-gray-700 border-orange-200' :
              notification.type === 'warning' ? 'bg-amber-50/95 text-amber-800 border-amber-300' :
              'bg-red-50/95 text-red-800 border-red-300'
            }`}
            style={{
              boxShadow: '2px 4px 12px rgba(239, 68, 68, 0.15), -1px -2px 6px rgba(255, 255, 255, 0.8)',
              fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic Pro', sans-serif",
              transform: 'scale(0.7)',
              width: '400px',
              height: '60px',
              overflow: 'hidden'
            }}
          >
            <div className="flex items-center justify-center space-x-2 h-full">
              {notification.type === 'info' && (
                <svg style={{width: '128px', height: '128px', flexShrink: 0}} className="text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {notification.type === 'warning' && (
                <svg style={{width: '128px', height: '128px', flexShrink: 0}} className="text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg style={{width: '128px', height: '128px', flexShrink: 0}} className="text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span style={{fontSize: '18px', fontWeight: '600', lineHeight: '1.1'}}>{notification.message}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageMappingApp />
    </QueryClientProvider>
  );
}

export default App
