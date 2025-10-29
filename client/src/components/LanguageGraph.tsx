import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, Word, D3Node, D3Link } from '../types';
import type { ThemeName } from '../App';
import { themes } from './ThemeSelector';
import { getEdgeStyle } from '../utils/edgeUtils';
import { getLanguageColor, getLanguageName } from '../../../shared/constants/languages';
import {
  LINK_FORCE_CONFIG,
  CHARGE_FORCE_CONFIG,
  CENTER_FORCE_CONFIG,
  COLLISION_FORCE_CONFIG,
  POSITION_FORCE_CONFIG,
  SIMULATION_BEHAVIOR_CONFIG
} from '../config/simulation';
import { logger } from '../utils/logger';

interface LanguageGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (word: Word) => void;
  centerNode?: string;
  theme?: ThemeName;
  fullPage?: boolean;
}



// Function to calculate required node dimensions for pill shape
const calculateNodeDimensions = (word: Word, isSource: boolean): { width: number; height: number } => {
  // Large, readable font sizes
  const wordFontSize = isSource ? 18 : 16;
  const langFontSize = 14;

  const languageName = getLanguageName(word.language);
  const wordText = word.text;
  const langText = `(${languageName})`;

  // Create temporary SVG to measure text accurately
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.visibility = 'hidden';
  svg.style.top = '-9999px';
  document.body.appendChild(svg);

  try {
    // Measure word text
    const wordTextEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    wordTextEl.setAttribute('font-size', wordFontSize.toString());
    wordTextEl.setAttribute('font-weight', '500');
    wordTextEl.setAttribute('font-family', 'Inter, sans-serif');
    wordTextEl.textContent = wordText;
    svg.appendChild(wordTextEl);

    // Measure language text
    const langTextEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    langTextEl.setAttribute('font-size', langFontSize.toString());
    langTextEl.setAttribute('font-weight', '400');
    langTextEl.setAttribute('font-family', 'Inter, sans-serif');
    langTextEl.textContent = langText;
    svg.appendChild(langTextEl);

    // Get actual text dimensions
    const wordWidth = wordTextEl.getBBox().width;
    const langWidth = langTextEl.getBBox().width;
    const wordHeight = wordTextEl.getBBox().height;
    const langHeight = langTextEl.getBBox().height;

    // Calculate pill dimensions
    const maxWidth = Math.max(wordWidth, langWidth);
    const totalHeight = wordHeight + langHeight + 8; // 8px spacing between lines

    // Add generous padding for pill shape
    const paddingX = 24; // Horizontal padding
    const paddingY = 16; // Vertical padding

    const width = maxWidth + paddingX * 2;
    const height = Math.max(totalHeight + paddingY * 2, isSource ? 60 : 50); // Minimum height

    return {
      width: Math.min(width, 200), // Cap maximum width
      height: Math.min(height, 80)  // Cap maximum height
    };

  } finally {
    document.body.removeChild(svg);
  }
};

// Function to calculate luminance of a color and return appropriate text color
const getTextColorForBackground = (backgroundColor: string): string => {
  // Convert hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return '#000000'; // fallback to black

  // Calculate relative luminance using WCAG formula
  const getLuminance = (r: number, g: number, b: number) => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

  // Use a more conservative threshold based on WCAG AA standards
  // Luminance of 0.18 roughly corresponds to gray #757575
  // For colors darker than this, use white text; for lighter colors, use black text
  return luminance < 0.18 ? '#ffffff' : '#000000';
};

// Language color mapping

// Get edge styling based on relationship type and show origin


const LanguageGraph: React.FC<LanguageGraphProps> = ({ nodes, edges, onNodeClick, theme = 'minimalist', fullPage = false }) => {
  const currentTheme = themes[theme];
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const containerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const timeoutRefs = useRef<number[]>([]); // Track all timeouts for cleanup
  const clickTimeoutRef = useRef<Map<string, number>>(new Map()); // Track click debouncing per node
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [d3Data, setD3Data] = useState<{ nodes: D3Node[], links: D3Link[] }>({ nodes: [], links: [] });

  // Function to smoothly center the view on a specific node
  const centerOnNode = useCallback((nodeId: string) => {
    if (!simulationRef.current || !containerRef.current) return;

    const node = d3Data.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const dx = centerX - (node.x || 0);
    const dy = centerY - (node.y || 0);

    containerRef.current
      .transition()
      .duration(300)
      .ease(d3.easeQuadInOut)
      .attr('transform', `translate(${dx}, ${dy})`);
  }, [d3Data.nodes, dimensions]);

  useEffect(() => {
    const updateDimensions = () => {
      if (fullPage) {
        // Use full viewport dimensions
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      } else if (svgRef.current?.parentElement) {
        const rect = svgRef.current.parentElement.getBoundingClientRect();
        setDimensions({
          width: Math.max(rect.width, 400),
          height: Math.max(rect.height, 500)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [fullPage]);

  // Convert props to D3 data format
  useEffect(() => {
    const d3Nodes: D3Node[] = nodes.map((node, index) => {
      const nodeDimensions = calculateNodeDimensions(node.data.word, node.data.isSource);

      // Initialize nodes in a loose circle around the center to prevent flashing
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const angle = (index * (2 * Math.PI)) / nodes.length;
      const radius = Math.min(dimensions.width, dimensions.height) * 0.3; // Start in a smaller circle

      return {
        id: node.id,
        word: node.data.word,
        isSource: node.data.isSource,
        expanded: node.data.expanded,
        width: nodeDimensions.width,
        height: nodeDimensions.height,
        radius: Math.max(nodeDimensions.width, nodeDimensions.height) / 2, // For collision detection
        color: getLanguageColor(node.data.word.language),
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    const d3Links: D3Link[] = edges.map(edge => {
      // Validate that source and target nodes exist
      const sourceExists = d3Nodes.find(n => n.id === edge.source);
      const targetExists = d3Nodes.find(n => n.id === edge.target);
      if (!sourceExists || !targetExists) {
        console.warn('Skipping edge with missing node:', edge.source, '->', edge.target);
        return null;
      }

      return {
        id: edge.id,
        source: edge.source, // Pass as string ID - D3 will convert to node reference
        target: edge.target, // Pass as string ID - D3 will convert to node reference
        relationshipType: edge.data?.connection?.relationshipType || 'related',
        confidence: edge.data?.connection?.confidence || 0.5,
        notes: edge.data?.connection?.notes || 'Related words'
      };
    }).filter(Boolean) as D3Link[];

    setD3Data({ nodes: d3Nodes, links: d3Links });
  }, [nodes, edges, dimensions]);

  // Initialize or update the D3 simulation
  useEffect(() => {
    if (!svgRef.current || d3Data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);

    // Initialize SVG and container on first run
    if (!containerRef.current) {
      svg.selectAll(null).remove();
      svg.attr('width', dimensions.width).attr('height', dimensions.height);

      // Create theme gradients and filters
      createThemeGradients(svg);

      containerRef.current = svg.append('g');

      // Initialize simulation with ultra-smooth, stable forces for minimal jitter
      simulationRef.current = d3.forceSimulation<D3Node, D3Link>()
        .force('link', d3.forceLink<D3Node, D3Link>().id(d => d.id).distance(LINK_FORCE_CONFIG.distance).strength(LINK_FORCE_CONFIG.strength))
        .force('charge', d3.forceManyBody().strength(CHARGE_FORCE_CONFIG.strength).distanceMax(CHARGE_FORCE_CONFIG.distanceMax))
        .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(CENTER_FORCE_CONFIG.strength))
        .force('collision', d3.forceCollide().radius((d: any) => d.radius + COLLISION_FORCE_CONFIG.radiusPadding).strength(COLLISION_FORCE_CONFIG.strength))
        .force('x', d3.forceX(dimensions.width / 2).strength(POSITION_FORCE_CONFIG.xStrength))
        .force('y', d3.forceY(dimensions.height / 2).strength(POSITION_FORCE_CONFIG.yStrength))
        .alpha(0.3)
        .alphaDecay(0.02)
        .velocityDecay(0.8);  // Higher velocity decay for maximum smoothness
    }

    if (!simulationRef.current || !containerRef.current) return;

    // Enhanced position stability for existing nodes
    const existingNodeIds = new Set<string>();
    d3Data.nodes.forEach(node => {
      const existingNode = simulationRef.current!.nodes().find(n => n.id === node.id);
      if (existingNode && existingNode.x !== undefined && existingNode.y !== undefined) {
        // Use existing positions as starting points with damping
        node.x = existingNode.x;
        node.y = existingNode.y;
        // Adaptive velocity damping based on previous velocity magnitude
        const prevVelocity = Math.sqrt((existingNode.vx || 0) ** 2 + (existingNode.vy || 0) ** 2);
        const dampingFactor = prevVelocity > 1 ? 0.5 : 0.8; // Stronger damping for fast-moving nodes

        node.vx = (existingNode.vx || 0) * dampingFactor;
        node.vy = (existingNode.vy || 0) * dampingFactor;
        existingNodeIds.add(node.id);
      }
    });

    // Update simulation data - ensure links have proper source/target references
    simulationRef.current.nodes(d3Data.nodes);
    const linkForce = simulationRef.current.force('link') as d3.ForceLink<D3Node, D3Link>;

    linkForce.links(d3Data.links);

    // Force D3 to resolve source/target node references immediately
    linkForce.initialize(d3Data.nodes, simulationRef.current.randomSource());

    // Update links
    const links = containerRef.current.selectAll<SVGGElement, D3Link>('.link')
      .data(d3Data.links, (d: D3Link) => d.id);


    links.exit()
      .transition()
      .duration(300)
      .style('opacity', 0)
      .remove();

    // Theme-specific edge rendering - COMPLETELY DIFFERENT EDGE STYLES PER THEME
    const newLinks = links.enter().append('g').attr('class', 'link');

    newLinks.each(function(d) {
      const group = d3.select(this);
      const edgeStyle = currentTheme.edgeStyles;



      switch(theme) {









        case 'origami':
          // Folded paper creases
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('stroke-dasharray', '0,8,4,8')
            .attr('opacity', edgeStyle.opacity);
          break;



        default:
          group.append('line')
            .attr('stroke', getEdgeStyle(d.relationshipType).color)
            .attr('stroke-width', getEdgeStyle(d.relationshipType).width)
            .attr('stroke-dasharray', getEdgeStyle(d.relationshipType).dash)
            .attr('opacity', 0.8);
      }
    }).style('opacity', 0);

    newLinks.transition()
      .duration(300)
      .style('opacity', 1);

    const allLinks = newLinks.merge(links);


    // Add hover effects to links (visual only, no tooltips)
    allLinks
      .on('mouseenter', function(_, d) {
        // Highlight the edge line
        d3.select(this.closest('.link')).selectAll('line, path')
          .transition()
          .duration(200)
          .attr('stroke-width', getEdgeStyle(d.relationshipType).width + 2)
          .attr('stroke-opacity', 1);
      })
      .on('mouseleave', function(_, d) {
        d3.select(this.closest('.link')).selectAll('line, path')
          .transition()
          .duration(200)
          .attr('stroke-width', getEdgeStyle(d.relationshipType).width)
          .attr('stroke-opacity', 0.8);
      });


    // Update nodes
    const nodeGroups = containerRef.current.selectAll<SVGGElement, D3Node>('.node')
      .data(d3Data.nodes, d => d.id);

    nodeGroups.exit()
      .transition()
      .duration(300)
      .style('opacity', 0)
      .remove();

    const newNodeGroups = nodeGroups.enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .style('opacity', 0);

    // Theme-specific node shape rendering - COMPLETELY DIFFERENT SHAPES PER THEME
    newNodeGroups.each(function(d) {
      const group = d3.select(this);
      const nodeStyle = d.isSource ? currentTheme.nodeStyles.source :
                       d.expanded ? currentTheme.nodeStyles.expanded :
                       currentTheme.nodeStyles.default;

      switch(theme) {



        case 'origami':
          // Folded paper polygons
          group.append('polygon')
            .attr('points', () => {
              const size = d.isSource ? 32 : d.expanded ? 26 : 21;
              return `0,-${size} ${size * 0.8},-${size * 0.3} ${size * 0.5},${size * 0.7} -${size * 0.5},${size * 0.7} -${size * 0.8},-${size * 0.3}`;
            })
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter)
            .style('transform-origin', 'center')
            .style('transform', `perspective(100px) rotateX(15deg) rotateY(-10deg)`);
          break;







        default:
          // Minimalist rounded rectangles - keep these clean and simple
          group.append('rect')
            .attr('width', d.width)
            .attr('height', d.height)
            .attr('x', -d.width / 2)
            .attr('y', -d.height / 2)
            .attr('rx', 25)
            .attr('ry', 25)
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter);
      }
    });

    // Add text to new nodes with theme styling
    newNodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => d.isSource ? '18px' : '16px')
      .attr('font-weight', '500')
      .attr('fill', d => theme === 'origami' ? '#374151' : getTextColorForBackground(d.color))
      .attr('stroke', d => {
        if (theme === 'origami') {
          return 'rgba(255,255,255,0.5)'; // Light outline for dark text on paper
        }
        const textColor = getTextColorForBackground(d.color);
        // Provide subtle outline for better text definition
        if (textColor === '#ffffff') {
          return 'rgba(0,0,0,0.7)'; // Black outline for white text
        } else {
          return theme === 'minimalist' ? 'transparent' : 'rgba(255,255,255,0.5)';
        }
      })
      .attr('stroke-width', d => {
        if (theme === 'origami') {
          return 0.8; // Consistent outline for origami theme
        }
        const textColor = getTextColorForBackground(d.color);
        // Consistent stroke width since text now fits within nodes
        return textColor === '#ffffff' || theme !== 'minimalist' ? 0.8 : 0;
      })
      .attr('paint-order', 'stroke')
      .style('font-family', currentTheme.fontFamily)
      .each(function(d) {
        const text = d3.select(this);
        const languageName = getLanguageName(d.word.language);

        // Large, readable text layout for pill shapes
        text.append('tspan')
          .attr('x', 0)
          .attr('dy', '-0.3em')
          .attr('font-size', d.isSource ? '18px' : '16px')
          .attr('font-weight', '500')
          .attr('letter-spacing', '0.01em')
          .text(d.word.text);

        text.append('tspan')
          .attr('x', 0)
          .attr('dy', '1.2em')
          .attr('font-size', '14px')
          .attr('font-weight', '400')
          .attr('opacity', '0.85')
          .attr('letter-spacing', '0.005em')
          .text(`(${languageName})`);
      });


    // Helper function to check if a position would cause overlap or edge crossings


    // Position new nodes in a circle around the clicked node if we can identify it
    const newNodes = newNodeGroups.data();
    if (newNodes.length > 0) {
      // Find the center node (recently clicked node that these connect to)
      const centerNode = d3Data.nodes.find(n => existingNodeIds.has(n.id) &&
        d3Data.links.some(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return (sourceId === n.id && newNodes.some(newNode => targetId === newNode.id)) ||
                 (targetId === n.id && newNodes.some(newNode => sourceId === newNode.id));
        })
      );

      if (centerNode && centerNode.x !== undefined && centerNode.y !== undefined) {
        // Adaptive spacing based on graph density for better sequential expansions
        const existingNodeCount = d3Data.nodes.length - newNodes.length;
        const densityFactor = Math.max(1, existingNodeCount / 10); // Adjust spacing for dense graphs
        const baseRadius = 200 + (densityFactor * 50); // Increase spacing for dense graphs

        // Arrange new nodes in multiple concentric circles with improved spacing
        newNodes.forEach((newNode, i) => {
          const layer = Math.floor(i / 6); // 6 nodes per layer
          const positionInLayer = i % 6;
          const layerRadius = baseRadius + (layer * 150); // 150px between layers for less overlap
          const angle = (positionInLayer * Math.PI * 2) / 6;

          // Reduced jitter for more predictable placement in dense graphs
          const radiusJitter = layerRadius + (Math.random() - 0.5) * 40;
          const angleJitter = angle + (Math.random() - 0.5) * 0.2;

          const x = centerNode.x! + radiusJitter * Math.cos(angleJitter);
          const y = centerNode.y! + radiusJitter * Math.sin(angleJitter);

          // Apply position directly - let D3 simulation handle bounds naturally
          newNode.x = x;
          newNode.y = y;

          // Add initial velocity towards spreading out
          const spreadDirection = Math.atan2(y - centerNode.y!, x - centerNode.x!);
          newNode.vx = Math.cos(spreadDirection) * 2;
          newNode.vy = Math.sin(spreadDirection) * 2;
        });
      } else {
        // Fallback: spread nodes in a large spiral pattern
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2;

        newNodes.forEach((newNode, i) => {
          // Spiral pattern for maximum spread
          const angle = i * 0.5; // Spiral angle
          const radius = 100 + (i * 40); // Increasing radius

          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          // Apply position directly - let D3 simulation handle positioning naturally
          newNode.x = x;
          newNode.y = y;
          // Add outward velocity
          newNode.vx = (Math.random() - 0.5) * 4;
          newNode.vy = (Math.random() - 0.5) * 4;
        });
      }
    }

    // Animate new nodes appearing
    newNodeGroups.transition()
      .duration(500)
      .style('opacity', 1);

    // Animation handled per shape type, skip generic animation for complex shapes

    const allNodeGroups = newNodeGroups.merge(nodeGroups);

    // Create drag behavior with improved click/drag distinction
    let dragStartTime = 0;
    let dragDistance = 0;
    let dragStartPosition = { x: 0, y: 0 };

    const drag = d3.drag<SVGGElement, D3Node>()
      .on('start', function(event, d) {
        dragStartTime = Date.now();
        dragDistance = 0;
        dragStartPosition = { x: event.x, y: event.y };

        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0.1).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', function(event, d) {
        // Calculate drag distance to better distinguish drag from click
        const deltaX = event.x - dragStartPosition.x;
        const deltaY = event.y - dragStartPosition.y;
        dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Update position during drag
        d.fx = event.x;
        d.fy = event.y;

        // Visual feedback only if we've moved a significant distance
        if (dragDistance > 5) {
          const nodeGroup = d3.select(this);
          const mainShape = nodeGroup.select('rect, polygon, path, circle');
          if (!mainShape.empty()) {
            mainShape.attr('stroke-width',
              parseFloat(mainShape.attr('stroke-width') || '2') + 2);
          }
        }
      })
      .on('end', function(event, d) {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0);
        }

        // Keep the node reasonably stable after drag
        d.fx = d.x;
        d.fy = d.y;

        // Release after a short time for minor adjustments
        setTimeout(() => {
          if (simulationRef.current) {
            delete d.fx;
            delete d.fy;
            simulationRef.current.alpha(0.02).restart();
          }
        }, 1000);

        // Return to normal visual state
        const nodeGroup = d3.select(this);
        const mainShape = nodeGroup.select('rect, polygon, path, circle');
        if (!mainShape.empty()) {
          const originalStrokeWidth = d.isSource ?
            (currentTheme.nodeStyles.source.strokeWidth || 3) :
            d.expanded ?
            (currentTheme.nodeStyles.expanded.strokeWidth || 2) :
            (currentTheme.nodeStyles.default.strokeWidth || 1.5);

          mainShape.transition()
            .duration(150)
            .attr('stroke-width', originalStrokeWidth);
        }
      });

    // Add smooth hover and click effects with drag
    allNodeGroups
      .call(drag) // Enable dragging on all nodes
      .on('mouseenter', function(_, _d) {
        // Smooth hover animation with theme-aware hover color
        const nodeGroup = d3.select(this);
        const mainShape = nodeGroup.select('rect, polygon, path, circle');
        if (!mainShape.empty()) {
          mainShape.transition()
            .duration(200)
            .ease(d3.easeQuadOut)
            .attr('fill', currentTheme.colors.accent)
            .attr('stroke-width',
              parseFloat(mainShape.attr('stroke-width') || '2') + 1);
        }
      })
      .on('mouseleave', function(_, d) {

        // Smooth return to original state with language colors
        const nodeGroup = d3.select(this);
        const mainShape = nodeGroup.select('rect, polygon, path, circle');
        if (!mainShape.empty()) {
          const originalStrokeWidth = d.isSource ?
            (currentTheme.nodeStyles.source.strokeWidth || 3) :
            d.expanded ?
            (currentTheme.nodeStyles.expanded.strokeWidth || 2) :
            (currentTheme.nodeStyles.default.strokeWidth || 1.5);

          const originalFill = d.isSource ?
            currentTheme.nodeStyles.source.fill :
            d.expanded ?
            currentTheme.nodeStyles.expanded.fill :
            currentTheme.nodeStyles.default.fill;

          mainShape.transition()
            .duration(200)
            .ease(d3.easeQuadOut)
            .attr('fill', originalFill || d.color)
            .attr('stroke-width', originalStrokeWidth);
        }
      })
      .on('click', function(event, d) {
        // Improved click detection with proper drag handling
        const dragDuration = Date.now() - dragStartTime;
        const wasDragged = dragDistance > 5 || dragDuration > 200; // More than 5px movement or 200ms duration

        if (event.defaultPrevented || wasDragged) {
          logger.debug('Click prevented - wasDragged:', wasDragged, 'distance:', dragDistance, 'duration:', dragDuration);
          return;
        }

        event.stopPropagation();

        // Debounce rapid clicks per node
        const now = Date.now();
        const lastClickTime = clickTimeoutRef.current.get(d.id) || 0;
        const timeSinceLastClick = now - lastClickTime;

        if (timeSinceLastClick < 300) { // 300ms debounce
          logger.debug('Click debounced for node:', d.word.text, 'timeSince:', timeSinceLastClick);
          return;
        }

        clickTimeoutRef.current.set(d.id, now);

        logger.debug('Node clicked:', d.word.text, 'expanded:', d.expanded, 'isSource:', d.isSource);

        // Gentle click animation for all shape types
        const nodeGroup = d3.select(this);
        const mainShape = nodeGroup.select('rect, polygon, path, circle');
        if (!mainShape.empty()) {
          mainShape.transition()
            .duration(200)
            .ease(d3.easeElasticOut.amplitude(1).period(0.3))
            .attr('transform', 'scale(1.05)')
            .transition()
            .duration(150)
            .attr('transform', 'scale(1)');
        }

        // Always call onNodeClick - let the parent component decide what to do
        if (onNodeClick) {
          logger.debug('Calling onNodeClick for:', d.word.text);
          onNodeClick(d.word);
        }
      });

    // Clear selection when clicking background
    svg.on('click', () => {
    });

    // Ultra-smooth tick handler with position interpolation and minimal jitter
    simulationRef.current.on('tick', () => {
      // Apply advanced position smoothing and boundary constraints
      d3Data.nodes.forEach(d => {
        if (d.x !== undefined && d.y !== undefined) {
          // Store previous position for interpolation
          const prevX = (d as any).px || d.x;
          const prevY = (d as any).py || d.y;

          // Apply strong velocity damping for maximum smoothness
          if (d.vx !== undefined) d.vx *= 0.85;
          if (d.vy !== undefined) d.vy *= 0.85;

          // Position interpolation for ultra-smooth movement
          const interpolationFactor = 0.15;
          d.x = prevX + (d.x - prevX) * interpolationFactor;
          d.y = prevY + (d.y - prevY) * interpolationFactor;

          // Allow nodes to move freely - no artificial bounds constraints
          // The simulation forces will naturally keep nodes reasonably positioned

          // Store current position as previous for next frame
          (d as any).px = d.x;
          (d as any).py = d.y;
        }
      });

      // Update link positions for theme-specific edge rendering
      allLinks.each(function(d) {
        const group = d3.select(this);
        const source = d.source as D3Node;
        const target = d.target as D3Node;

        if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return;

        // Update based on theme - different themes need different positioning
        switch(theme) {
          case 'origami':
            // Use curved paths for organic/complex themes
            const path = group.select('path');
            if (!path.empty()) {
              // Ensure coordinates are valid numbers
              const sx = Number(source.x) || 0;
              const sy = Number(source.y) || 0;
              const tx = Number(target.x) || 0;
              const ty = Number(target.y) || 0;


              // Default straight paths for all themes
              path.attr('d', `M ${sx} ${sy} L ${tx} ${ty}`);
            }

            // Position any additional elements like particles, gears, etc.
            const particles = group.selectAll('circle');
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            particles.attr('cx', midX).attr('cy', midY);

            const rects = group.selectAll('rect');
            rects.attr('x', midX - 3).attr('y', midY - 1.5);
            break;

          default:
            // Update both line and path elements for all themes
            const line = group.select('line');
            const pathElement = group.select('path');

            // Ensure coordinates are valid numbers
            const sx = Number(source.x) || 0;
            const sy = Number(source.y) || 0;
            const tx = Number(target.x) || 0;
            const ty = Number(target.y) || 0;

            // Update line elements (simple themes)
            if (!line.empty()) {
              line
                .attr('x1', sx)
                .attr('y1', sy)
                .attr('x2', tx)
                .attr('y2', ty);
            }

            // Update path elements (complex themes)
            if (!pathElement.empty()) {
              pathElement.attr('d', `M ${sx} ${sy} L ${tx} ${ty}`);
            }
        }
      });



      // Update node positions
      allNodeGroups
        .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Add zoom behavior only once
    if (!svg.property('__zoom_added__')) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 3])
        .on('zoom', (event) => {
          if (containerRef.current) {
            containerRef.current.attr('transform', event.transform);
          }
        });

      svg.call(zoom);
      svg.property('__zoom_added__', true);
    }

    // Clear any existing timeouts to prevent conflicts
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current = [];

    // Ultra-gentle simulation restart for maximum smoothness
    if (newNodes.length > 0) {
      // Start with very low energy for new nodes
      simulationRef.current.alpha(0.1).restart();

      // Faster energy reduction for quicker settling
      const timeout1 = setTimeout(() => {
        if (simulationRef.current) {
          simulationRef.current.alpha(0.05); // Very low energy for stability
        }
      }, 2000);
      timeoutRefs.current.push(timeout1);

      const timeout2 = setTimeout(() => {
        if (simulationRef.current) {
          simulationRef.current.alpha(0.02); // Minimal movement
        }
      }, 5000);
      timeoutRefs.current.push(timeout2);

      // Stop simulation completely after longer settling period
      const timeout3 = setTimeout(() => {
        if (simulationRef.current) {
          simulationRef.current.alpha(0);
        }
      }, 10000);
      timeoutRefs.current.push(timeout3);
    } else {
      // For updates without new nodes, use extremely minimal energy
      simulationRef.current.alpha(0.01);
    }

  }, [d3Data, dimensions, onNodeClick, centerOnNode]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      // Clear all timeouts
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];

      // Clear click timeouts
      if (clickTimeoutRef.current) {
        clickTimeoutRef.current.clear();
      }

      // Stop simulation
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, []);

  // Create gradients and filters for the current theme
  const createThemeGradients = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');

    // Clear existing gradients
    defs.selectAll(null).remove();


  };

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes etherealFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes cyberpunkPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes cosmicTwinkle {
          0%, 100% { opacity: 0.8; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.3); }
        }
        @keyframes neuralPulse {
          0%, 100% {
            filter: drop-shadow(0 0 15px currentColor) drop-shadow(0 0 30px currentColor);
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 25px currentColor) drop-shadow(0 0 50px currentColor);
            transform: scale(1.05);
          }
        }
        @keyframes neuralFlow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 24; }
        }
        @keyframes circuitFlow {
          0% { stroke-dashoffset: 0; opacity: 0.9; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: 20; opacity: 0.9; }
        }
        @keyframes crystallineRotate {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(90deg) scale(1.02); }
          50% { transform: rotate(180deg) scale(1); }
          75% { transform: rotate(270deg) scale(1.02); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes crystallineShimmer {
          0%, 100% { opacity: 0.8; filter: hue-rotate(0deg); }
          25% { opacity: 1; filter: hue-rotate(90deg); }
          50% { opacity: 0.9; filter: hue-rotate(180deg); }
          75% { opacity: 1; filter: hue-rotate(270deg); }
        }
        @keyframes watercolorFlow {
          0%, 100% {
            stroke-width: 3;
            opacity: 0.6;
            filter: blur(0.5px);
          }
          33% {
            stroke-width: 5;
            opacity: 0.8;
            filter: blur(1px);
          }
          66% {
            stroke-width: 4;
            opacity: 0.7;
            filter: blur(0.8px);
          }
        }
        @keyframes steampunkRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes steampunkFlow {
          0% { stroke-dashoffset: 0; opacity: 0.8; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: 30; opacity: 0.8; }
        }
        @keyframes holographicPulse {
          0%, 100% {
            opacity: 0.8;
            stroke-width: 1.5;
            filter: drop-shadow(0 0 10px currentColor);
          }
          33% {
            opacity: 1;
            stroke-width: 2;
            filter: drop-shadow(0 0 20px currentColor) drop-shadow(0 0 40px currentColor);
          }
          66% {
            opacity: 0.6;
            stroke-width: 1;
            filter: drop-shadow(0 0 15px currentColor);
          }
        }
        @keyframes holographicFlow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 24; }
        }
        @keyframes manuscriptInk {
          0%, 100% { filter: drop-shadow(1px 1px 3px rgba(139, 69, 19, 0.4)); }
          50% { filter: drop-shadow(2px 2px 6px rgba(139, 69, 19, 0.6)); }
        }
        @keyframes molecularOrbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .neural-node {
          animation: neuralPulse 2s ease-in-out infinite;
        }
        .circuit-trace {
          animation: circuitFlow 2s linear infinite;
        }
        .crystalline-prism {
          animation: crystallineRotate 8s linear infinite;
        }
        .watercolor-blob {
          animation: watercolorFlow 6s ease-in-out infinite;
        }
        .steampunk-gear {
          animation: steampunkRotate 10s linear infinite;
        }
        .holographic-outline {
          animation: holographicPulse 3s ease-in-out infinite;
        }
        .manuscript-scroll {
          animation: manuscriptInk 4s ease-in-out infinite;
        }
        .molecular-atom {
          animation: molecularOrbit 12s linear infinite;
        }
      `}</style>

      <div style={{
        width: fullPage ? '100vw' : '100%',
        height: fullPage ? '100vh' : '100%',
        minHeight: fullPage ? '100vh' : '500px',
        position: fullPage ? 'fixed' : 'relative',
        top: fullPage ? 0 : 'auto',
        left: fullPage ? 0 : 'auto',
        background: currentTheme.background,
        overflow: 'hidden',
        fontFamily: currentTheme.fontFamily,
        zIndex: fullPage ? 1 : 'auto'
      }}>

        <svg
          ref={svgRef}
          style={{
            width: fullPage ? '100vw' : '100%',
            height: fullPage ? '100vh' : '100%',
            display: 'block'
          }}
        />

        {/* Animated background elements for themes */}





        {theme === 'origami' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute opacity-10"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${20 + Math.random() * 40}px`,
                  height: `${20 + Math.random() * 40}px`,
                  background: 'linear-gradient(45deg, #fb923c, #f97316)',
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  transform: `rotate(${Math.random() * 360}deg) perspective(100px) rotateX(${Math.random() * 30}deg)`,
                  animation: `origamiFold ${6 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`,
                  filter: 'drop-shadow(2px 2px 4px rgba(251, 146, 60, 0.3))'
                }}
              />
            ))}
          </div>
        )}



      </div>
    </>
  );
};

export default LanguageGraph;