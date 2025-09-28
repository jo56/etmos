import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, Word, D3Node, D3Link } from '../types';
import type { ThemeName } from '../App';
import { themes } from './ThemeSelector';
import { getEdgeStyle } from '../utils/edgeUtils';

interface LanguageGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (word: Word) => void;
  centerNode?: string;
  theme?: ThemeName;
  fullPage?: boolean;
}


// Function to wrap text into multiple lines that fit within a circle
const wrapTextForCircle = (text: string, fontSize: number, maxRadius: number): string[] => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.visibility = 'hidden';
  svg.style.top = '-9999px';
  document.body.appendChild(svg);

  try {
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('font-size', fontSize.toString());
    textEl.setAttribute('font-weight', 'bold');
    textEl.setAttribute('font-family', 'Inter, sans-serif');
    svg.appendChild(textEl);

    // Calculate max width that fits in circle properly
    // For a circle, inscribed rectangle width = radius * sqrt(2) for square
    // But for multiple lines, we need to be more conservative
    // Use ~70% of diameter to ensure text stays well within circle bounds
    const maxWidth = maxRadius * 1.4;

    // Split text into words
    const words = text.split(/[\s-]/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      textEl.textContent = testLine;
      const width = textEl.getBBox().width;

      if (width <= maxWidth || !currentLine) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  } finally {
    document.body.removeChild(svg);
  }
};

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
const getLanguageColor = (language: string): string => {
  const colors: { [key: string]: string } = {
    // Germanic Languages
    'en': '#2196F3',    // English - Blue
    'de': '#4CAF50',    // German - Green
    'nl': '#FFC107',    // Dutch - Amber
    'da': '#00BCD4',    // Danish - Cyan
    'sv': '#009688',    // Swedish - Teal
    'no': '#3F51B5',    // Norwegian - Indigo
    'is': '#673AB7',    // Icelandic - Deep Purple
    'got': '#9C27B0',   // Gothic - Purple

    // Romance Languages
    'es': '#FF5722',    // Spanish - Red-Orange
    'fr': '#9C27B0',    // French - Purple
    'it': '#FF9800',    // Italian - Orange
    'pt': '#E91E63',    // Portuguese - Pink
    'ro': '#8BC34A',    // Romanian - Light Green
    'ca': '#CDDC39',    // Catalan - Lime
    'la': '#795548',    // Latin - Brown

    // Slavic Languages
    'ru': '#F44336',    // Russian - Red
    'pl': '#E91E63',    // Polish - Pink
    'cs': '#9C27B0',    // Czech - Purple
    'sk': '#673AB7',    // Slovak - Deep Purple
    'bg': '#3F51B5',    // Bulgarian - Indigo
    'hr': '#2196F3',    // Croatian - Blue
    'sr': '#00BCD4',    // Serbian - Cyan
    'uk': '#009688',    // Ukrainian - Teal

    // Celtic Languages
    'ga': '#4CAF50',    // Irish - Green
    'gd': '#8BC34A',    // Scottish Gaelic - Light Green
    'cy': '#CDDC39',    // Welsh - Lime
    'br': '#FFEB3B',    // Breton - Yellow
    'kw': '#FFC107',    // Cornish - Amber

    // Greek
    'gr': '#607D8B',    // Modern Greek - Blue-Grey
    'grc': '#455A64',   // Ancient Greek - Dark Blue-Grey

    // Other Indo-European
    'hi': '#FF5722',    // Hindi - Red-Orange
    'bn': '#E91E63',    // Bengali - Pink
    'fa': '#9C27B0',    // Persian - Purple
    'ku': '#673AB7',    // Kurdish - Deep Purple
    'hy': '#3F51B5',    // Armenian - Indigo
    'sq': '#2196F3',    // Albanian - Blue
    'lt': '#00BCD4',    // Lithuanian - Cyan
    'lv': '#009688',    // Latvian - Teal

    // Finno-Ugric
    'fi': '#4CAF50',    // Finnish - Green
    'et': '#8BC34A',    // Estonian - Light Green
    'hu': '#CDDC39',    // Hungarian - Lime

    // Semitic
    'ar': '#FF5722',    // Arabic - Red-Orange
    'he': '#E91E63',    // Hebrew - Pink
    'am': '#9C27B0',    // Amharic - Purple

    // Sino-Tibetan
    'zh': '#F44336',    // Chinese - Red
    'bo': '#E91E63',    // Tibetan - Pink
    'my': '#9C27B0',    // Burmese - Purple

    // Japanese & Korean
    'ja': '#FF5722',    // Japanese - Red-Orange
    'ko': '#E91E63',    // Korean - Pink

    // Turkic
    'tr': '#9C27B0',    // Turkish - Purple
    'az': '#673AB7',    // Azerbaijani - Deep Purple
    'kk': '#3F51B5',    // Kazakh - Indigo
    'ky': '#2196F3',    // Kyrgyz - Blue
    'uz': '#00BCD4',    // Uzbek - Cyan

    // Baltic (deduplicated entries removed - already defined above)

    // Caucasian
    'ka': '#795548',    // Georgian - Brown

    // African
    'sw': '#FF5722',    // Swahili - Red-Orange

    // Native American
    'oj': '#9C27B0',    // Ojibwe - Purple

    // Historical/Reconstructed
    'pie': '#424242',   // Proto-Indo-European - Dark Grey
    'ine-pro': '#424242', // Proto-Indo-European - Dark Grey
    'pgm': '#616161',   // Proto-Germanic - Grey
    'gem-pro': '#616161', // Proto-Germanic - Grey
    'gmw-pro': '#757575', // Proto-West-Germanic - Light Grey
    'itc': '#757575',   // Proto-Italic - Light Grey
    'cel': '#9E9E9E',   // Proto-Celtic - Very Light Grey

    // Historical Germanic
    'goh': '#6B7B4F',   // Old High German - Olive
    'gmh': '#7A8A5F',   // Middle High German - Light Olive
    'gml': '#89996F',   // Middle Low German - Pale Olive
    'odt': '#98A87F',   // Old Dutch - Moss Green
    'dum': '#A7B78F',   // Middle Dutch - Light Moss
    'ofs': '#B6C69F',   // Old Frisian - Pale Moss
    'ang': '#C5D5AF',   // Old English - Very Pale Moss
    'enm': '#D4E4BF',   // Middle English - Almost White Green
    'non': '#8A6B9C',   // Old Norse - Purple-Grey
    // Gothic already defined above

    // Historical Romance
    // Latin already defined above
    'la-cla': '#8B4513', // Classical Latin
    'la-vul': '#A0522D', // Vulgar Latin - Sienna
    'la-ecc': '#CD853F', // Ecclesiastical Latin - Peru
    'la-med': '#DEB887', // Medieval Latin - Burlywood
    'ml': '#DEB887',    // Medieval Latin
    'ML': '#DEB887',    // Medieval Latin
    'ml.': '#DEB887',   // Medieval Latin
    'ML.': '#DEB887',   // Medieval Latin
    'fro': '#BC8F8F',   // Old French - Rosy Brown
    'frm': '#CD919E',   // Middle French - Light Coral
    'pro': '#DA70D6',   // Old Occitan - Orchid
    'osp': '#FA8072',   // Old Spanish - Salmon
    'roa-opt': '#FFA07A', // Old Portuguese - Light Salmon
    'sla': '#B22222',   // Slavic - Fire Brick

    // Historical Slavic
    'cu': '#B22222',    // Church Slavonic - Fire Brick
    'orv': '#CD5C5C',   // Old East Slavic - Indian Red
    'zlw-ocs': '#DC143C', // Old Czech - Crimson
    'zlw-opl': '#FF6347', // Old Polish - Tomato
    'sla-pro': '#8B0000', // Proto-Slavic - Dark Red

    // Historical Celtic
    'mga': '#228B22',   // Middle Irish - Forest Green
    'sga': '#32CD32',   // Old Irish - Lime Green
    'owl': '#9ACD32',   // Old Welsh - Yellow Green
    'cnx': '#ADFF2F',   // Middle Cornish - Green Yellow
    'cel-bry-pro': '#7FFF00', // Proto-Brythonic - Chartreuse
    'cel-gau': '#98FB98', // Gaulish - Pale Green

    // Historical Greek
    // Ancient Greek already defined above
    'gmy': '#6495ED',   // Mycenaean Greek - Cornflower Blue
    'grk-pro': '#778899', // Proto-Greek - Light Slate Grey

    // Sanskrit and Indo-Iranian
    'sa': '#FF8C00',    // Sanskrit - Dark Orange
    'pal': '#FFA500',   // Middle Persian - Orange
    'ae': '#FFB347',    // Avestan - Peach
    'peo': '#FFCCCB',   // Old Persian - Light Pink
    'iir-pro': '#FF7F50', // Proto-Indo-Iranian - Coral
    'inc-pro': '#FF6347', // Proto-Indo-Aryan - Tomato
    'ira-pro': '#FF4500', // Proto-Iranian - Orange Red

    // Other Proto-Languages
    'ine-bsl-pro': '#4B0082', // Proto-Balto-Slavic - Indigo
    'bat-pro': '#483D8B', // Proto-Baltic - Dark Slate Blue
    'urj-pro': '#6A5ACD', // Proto-Uralic - Slate Blue
    'fiu-fin-pro': '#7B68EE', // Proto-Finnic - Medium Slate Blue
    'sem-pro': '#9370DB', // Proto-Semitic - Medium Purple
    'ccs-pro': '#8B008B', // Proto-Kartvelian - Dark Magenta

    'unknown': '#9E9E9E' // Unknown - Grey
  };
  return colors[language] || colors['unknown'];
};

// Language name mapping
const getLanguageName = (code: string): string => {
  const names: { [key: string]: string } = {
    // Germanic Languages
    'en': 'English',
    'de': 'German',
    'nl': 'Dutch',
    'da': 'Danish',
    'sv': 'Swedish',
    'no': 'Norwegian',
    'is': 'Icelandic',
    'got': 'Gothic',

    // Romance Languages
    'es': 'Spanish',
    'fr': 'French',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ro': 'Romanian',
    'ca': 'Catalan',
    'la': 'Latin',

    // Slavic Languages
    'ru': 'Russian',
    'pl': 'Polish',
    'cs': 'Czech',
    'sk': 'Slovak',
    'bg': 'Bulgarian',
    'hr': 'Croatian',
    'sr': 'Serbian',
    'uk': 'Ukrainian',

    // Celtic Languages
    'ga': 'Irish',
    'gd': 'Scottish Gaelic',
    'cy': 'Welsh',
    'br': 'Breton',
    'kw': 'Cornish',

    // Greek
    'gr': 'Greek',
    'grc': 'Ancient Greek',

    // Other Indo-European
    'hi': 'Hindi',
    'bn': 'Bengali',
    'fa': 'Persian',
    'ku': 'Kurdish',
    'hy': 'Armenian',
    'sq': 'Albanian',
    'lt': 'Lithuanian',
    'lv': 'Latvian',

    // Finno-Ugric
    'fi': 'Finnish',
    'et': 'Estonian',
    'hu': 'Hungarian',

    // Semitic
    'ar': 'Arabic',
    'he': 'Hebrew',
    'am': 'Amharic',

    // Sino-Tibetan
    'zh': 'Chinese',
    'bo': 'Tibetan',
    'my': 'Burmese',

    // Japanese & Korean
    'ja': 'Japanese',
    'ko': 'Korean',

    // Turkic
    'tr': 'Turkish',
    'az': 'Azerbaijani',
    'kk': 'Kazakh',
    'ky': 'Kyrgyz',
    'uz': 'Uzbek',

    // Baltic (deduplicated entries removed - already defined above)

    // Caucasian
    'ka': 'Georgian',

    // African
    'sw': 'Swahili',

    // Native American
    'oj': 'Ojibwe',

    // Historical/Reconstructed
    'pie': 'Proto-Indo-European',
    'ine-pro': 'Proto-Indo-European',
    'pgm': 'Proto-Germanic',
    'gem-pro': 'Proto-Germanic',
    'gmw-pro': 'Proto-West-Germanic',
    'itc': 'Proto-Italic',
    'cel': 'Proto-Celtic',

    // Historical Germanic
    'goh': 'Old High German',
    'gmh': 'Middle High German',
    'gml': 'Middle Low German',
    'odt': 'Old Dutch',
    'dum': 'Middle Dutch',
    'ofs': 'Old Frisian',
    'ang': 'Old English',
    'enm': 'Middle English',
    'non': 'Old Norse',
    // Gothic already defined above

    // Historical Romance
    // Latin already defined above
    'la-cla': 'Classical Latin',
    'la-vul': 'Vulgar Latin',
    'la-ecc': 'Ecclesiastical Latin',
    'la-med': 'Medieval Latin',
    'ml': 'Medieval Latin',
    'ML': 'Medieval Latin',
    'ml.': 'Medieval Latin',
    'ML.': 'Medieval Latin',
    'fro': 'Old French',
    'frm': 'Middle French',
    'pro': 'Old Occitan',
    'osp': 'Old Spanish',
    'roa-opt': 'Old Portuguese',
    'sla': 'Slavic',

    // Historical Slavic
    'cu': 'Church Slavonic',
    'orv': 'Old East Slavic',
    'zlw-ocs': 'Old Czech',
    'zlw-opl': 'Old Polish',
    'sla-pro': 'Proto-Slavic',

    // Historical Celtic
    'mga': 'Middle Irish',
    'sga': 'Old Irish',
    'owl': 'Old Welsh',
    'cnx': 'Middle Cornish',
    'cel-bry-pro': 'Proto-Brythonic',
    'cel-gau': 'Gaulish',

    // Historical Greek
    // Ancient Greek already defined above
    'gmy': 'Mycenaean Greek',
    'grk-pro': 'Proto-Greek',

    // Sanskrit and Indo-Iranian
    'sa': 'Sanskrit',
    'pal': 'Middle Persian',
    'ae': 'Avestan',
    'peo': 'Old Persian',
    'iir-pro': 'Proto-Indo-Iranian',
    'inc-pro': 'Proto-Indo-Aryan',
    'ira-pro': 'Proto-Iranian',

    // Other Proto-Languages
    'ine-bsl-pro': 'Proto-Balto-Slavic',
    'bat-pro': 'Proto-Baltic',
    'urj-pro': 'Proto-Uralic',
    'fiu-fin-pro': 'Proto-Finnic',
    'sem-pro': 'Proto-Semitic',
    'ccs-pro': 'Proto-Kartvelian',

    'unknown': 'Unknown'
  };
  return names[code] || code.toUpperCase();
};

// Get edge styling based on relationship type and show origin


const LanguageGraph: React.FC<LanguageGraphProps> = ({ nodes, edges, onNodeClick, centerNode, theme = 'minimalist', fullPage = false }) => {
  const currentTheme = themes[theme];
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const containerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]); // Track all timeouts for cleanup
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [hoveredWord, setHoveredWord] = useState<Word | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
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
        notes: edge.data?.connection?.notes || 'Related words',
        origin: edge.data?.connection?.origin || 'common origin',
        sharedRoot: edge.data?.connection?.sharedRoot
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
      svg.selectAll('*').remove();
      svg.attr('width', dimensions.width).attr('height', dimensions.height);

      // Create theme gradients and filters
      createThemeGradients(svg);

      containerRef.current = svg.append('g');

      // Initialize simulation with ultra-smooth, stable forces for minimal jitter
      simulationRef.current = d3.forceSimulation<D3Node, D3Link>()
        .force('link', d3.forceLink<D3Node, D3Link>().id(d => d.id).distance(180).strength(0.2))
        .force('charge', d3.forceManyBody().strength(-300).distanceMax(400))
        .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.005))
        .force('collision', d3.forceCollide().radius(d => d.radius + 20).strength(0.8))
        .force('x', d3.forceX(dimensions.width / 2).strength(0.005))
        .force('y', d3.forceY(dimensions.height / 2).strength(0.005))
        .alpha(0.3)
        .alphaDecay(0.02)
        .velocityDecay(0.8);  // Higher velocity decay for maximum smoothness
    }

    if (!simulationRef.current || !containerRef.current) return;

    // Enhanced position stability for existing nodes
    const existingNodeIds = new Set();
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
    linkForce.initialize(d3Data.nodes);

    // Update links
    const links = containerRef.current.selectAll<SVGLineElement, D3Link>('.link')
      .data(d3Data.links, d => d.id);


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
        case 'neural':
          // Synaptic connections with signal pulses
          const neuralPath = group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('stroke-dasharray', '8,4')
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter);

          // Add moving signal pulse
          group.append('circle')
            .attr('r', 3)
            .attr('fill', edgeStyle.stroke)
            .style('animation', 'neuralPulse 2s linear infinite');
          break;

        case 'circuit':
          // Circuit board traces with right angles
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter);
          break;

        case 'botanical':
          // Organic vine-like curves
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth * 1.5)
            .attr('stroke-linecap', 'round')
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter);

          // Add leaves along the path
          group.append('path')
            .attr('d', 'M-3,-6 Q0,-3 3,-6 Q0,0 -3,-6')
            .attr('fill', edgeStyle.stroke)
            .attr('opacity', 0.6);
          break;

        case 'steampunk':
          // Mechanical linkages with gears
          const steamPath = group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('stroke-dasharray', '10,5')
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter);

          // Add small gear at midpoint
          group.append('circle')
            .attr('r', 4)
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', 1);
          break;

        case 'crystalline':
          // Prismatic light beams
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter)
            .style('animation', 'crystallineShimmer 4s ease-in-out infinite');
          break;

        case 'cosmic':
          // Energy beams with particle effects
          const cosmicPath = group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter);

          // Add energy particles
          for (let i = 0; i < 3; i++) {
            group.append('circle')
              .attr('r', 1.5)
              .attr('fill', edgeStyle.stroke)
              .attr('opacity', 0.8)
              .style('animation', `cosmicParticle ${2 + i}s linear infinite`);
          }
          break;

        case 'watercolor':
          // Flowing paint strokes
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth * 2)
            .attr('stroke-linecap', 'round')
            .attr('opacity', edgeStyle.opacity * 0.7)
            .attr('filter', edgeStyle.filter);
          break;

        case 'holographic':
          // Wireframe connections with data packets
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('stroke-dasharray', '6,4')
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter)
            .style('animation', 'holographicFlow 2s linear infinite');

          // Data packet
          group.append('rect')
            .attr('width', 6)
            .attr('height', 3)
            .attr('fill', edgeStyle.stroke)
            .attr('opacity', 0.8);
          break;

        case 'molecular':
          // Covalent bonds
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth * 1.5)
            .attr('stroke-linecap', 'round')
            .attr('opacity', edgeStyle.opacity);
          break;

        case 'ethereal':
          // Flowing energy streams
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter)
            .style('animation', 'etherealFlow 6s ease-in-out infinite');
          break;

        case 'cyberpunk':
          // Digital data streams
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('stroke-dasharray', '5,5')
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter)
            .style('animation', 'cyberpunkFlow 1.5s linear infinite');
          break;

        case 'origami':
          // Folded paper creases
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('stroke-dasharray', '0,8,4,8')
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter);
          break;

        case 'medieval':
          // Rope and chain links
          const medievalPath = group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth * 1.2)
            .attr('stroke-linecap', 'round')
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter);
          break;

        case 'manuscript':
          // Ornate calligraphy flourishes
          group.append('path')
            .attr('fill', 'none')
            .attr('stroke', edgeStyle.stroke)
            .attr('stroke-width', edgeStyle.strokeWidth)
            .attr('stroke-linecap', 'round')
            .attr('opacity', edgeStyle.opacity)
            .attr('filter', edgeStyle.filter);
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
      .on('mouseenter', function(event, d) {
        // Highlight the edge line
        d3.select(this.closest('.link')).selectAll('line, path')
          .transition()
          .duration(200)
          .attr('stroke-width', getEdgeStyle(d.relationshipType).width + 2)
          .attr('stroke-opacity', 1);
      })
      .on('mouseleave', function(event, d) {
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
        case 'cyberpunk':
          // Hexagonal nodes with neon glow
          group.append('polygon')
            .attr('points', () => {
              const size = d.isSource ? 30 : d.expanded ? 24 : 20;
              const points = [];
              for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = size * Math.cos(angle);
                const y = size * Math.sin(angle);
                points.push(`${x},${y}`);
              }
              return points.join(' ');
            })
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter);
          break;

        case 'crystalline':
          // Diamond/crystal shapes
          group.append('polygon')
            .attr('points', () => {
              const size = d.isSource ? 35 : d.expanded ? 28 : 22;
              return `0,-${size} ${size * 0.7},0 0,${size} -${size * 0.7},0`;
            })
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter)
            .attr('transform', `rotate(${Math.random() * 360})`);
          break;

        case 'steampunk':
          // Gear-shaped nodes
          group.append('path')
            .attr('d', () => {
              const outerRadius = d.isSource ? 30 : d.expanded ? 24 : 20;
              const innerRadius = outerRadius * 0.6;
              const teeth = 12;
              let path = '';

              for (let i = 0; i < teeth * 2; i++) {
                const angle = (i * Math.PI) / teeth;
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);

                if (i === 0) path += `M ${x} ${y}`;
                else path += ` L ${x} ${y}`;
              }
              path += ' Z';
              return path;
            })
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter);
          break;

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

        case 'molecular':
          // Electron orbit visualization
          const molecularGroup = group.append('g');

          // Central nucleus
          molecularGroup.append('circle')
            .attr('r', d.isSource ? 12 : d.expanded ? 10 : 8)
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth);

          // Electron orbits
          const orbits = d.isSource ? 3 : d.expanded ? 2 : 1;
          for (let i = 0; i < orbits; i++) {
            const orbitRadius = (d.isSource ? 25 : d.expanded ? 20 : 16) + (i * 8);
            molecularGroup.append('circle')
              .attr('r', orbitRadius)
              .attr('fill', 'none')
              .attr('stroke', nodeStyle.stroke)
              .attr('stroke-width', 1)
              .attr('opacity', 0.3);

            // Electrons
            molecularGroup.append('circle')
              .attr('cx', orbitRadius)
              .attr('cy', 0)
              .attr('r', 2)
              .attr('fill', nodeStyle.stroke)
              .style('animation', `molecularSpin ${2 + i}s linear infinite`)
              .style('transform-origin', '0 0');
          }
          break;

        case 'circuit':
          // Circuit board rectangles with connection points
          const circuitSize = d.isSource ? 40 : d.expanded ? 32 : 26;
          const circuitGroup = group.append('g');

          // Main chip
          circuitGroup.append('rect')
            .attr('width', circuitSize)
            .attr('height', circuitSize * 0.6)
            .attr('x', -circuitSize / 2)
            .attr('y', -circuitSize * 0.3)
            .attr('rx', 3)
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth);

          // Connection pins
          for (let i = 0; i < 6; i++) {
            circuitGroup.append('rect')
              .attr('width', 3)
              .attr('height', 8)
              .attr('x', -circuitSize / 2 + (i * circuitSize / 5) + 2)
              .attr('y', circuitSize * 0.3)
              .attr('fill', nodeStyle.stroke);
          }
          break;

        case 'neural':
          // Synaptic nodes with connections
          const neuralGroup = group.append('g');
          const neuralRadius = d.isSource ? 16 : d.expanded ? 13 : 10;

          // Main body
          neuralGroup.append('circle')
            .attr('r', neuralRadius)
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter);

          // Dendrites
          const dendrites = d.isSource ? 8 : d.expanded ? 6 : 4;
          for (let i = 0; i < dendrites; i++) {
            const angle = (i * 2 * Math.PI) / dendrites;
            const length = neuralRadius + 10;
            neuralGroup.append('line')
              .attr('x1', neuralRadius * Math.cos(angle))
              .attr('y1', neuralRadius * Math.sin(angle))
              .attr('x2', length * Math.cos(angle))
              .attr('y2', length * Math.sin(angle))
              .attr('stroke', nodeStyle.stroke)
              .attr('stroke-width', 2)
              .attr('opacity', 0.7);
          }
          break;

        case 'botanical':
          // Leaf shapes
          group.append('path')
            .attr('d', () => {
              const size = d.isSource ? 30 : d.expanded ? 24 : 20;
              return `M 0,-${size} Q ${size * 0.6},-${size * 0.3} ${size * 0.3},${size * 0.3} Q 0,${size * 0.6} -${size * 0.3},${size * 0.3} Q -${size * 0.6},-${size * 0.3} 0,-${size}`;
            })
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter);
          break;

        case 'cosmic':
          // Star/nova shapes
          group.append('path')
            .attr('d', () => {
              const outerRadius = d.isSource ? 28 : d.expanded ? 22 : 18;
              const innerRadius = outerRadius * 0.4;
              const points = 8;
              let path = '';

              for (let i = 0; i < points * 2; i++) {
                const angle = (i * Math.PI) / points;
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const x = radius * Math.cos(angle - Math.PI / 2);
                const y = radius * Math.sin(angle - Math.PI / 2);

                if (i === 0) path += `M ${x} ${y}`;
                else path += ` L ${x} ${y}`;
              }
              path += ' Z';
              return path;
            })
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter);
          break;

        case 'holographic':
          // Wireframe boxes
          const holoSize = d.isSource ? 30 : d.expanded ? 24 : 20;
          const holoGroup = group.append('g');

          // Front face
          holoGroup.append('rect')
            .attr('width', holoSize)
            .attr('height', holoSize)
            .attr('x', -holoSize / 2)
            .attr('y', -holoSize / 2)
            .attr('fill', 'none')
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('stroke-dasharray', '4,2');

          // Back face (shifted)
          holoGroup.append('rect')
            .attr('width', holoSize)
            .attr('height', holoSize)
            .attr('x', -holoSize / 2 + 6)
            .attr('y', -holoSize / 2 - 6)
            .attr('fill', 'none')
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,4')
            .attr('opacity', 0.5);

          // Connection lines
          const corners = [
            [-holoSize/2, -holoSize/2], [holoSize/2, -holoSize/2],
            [holoSize/2, holoSize/2], [-holoSize/2, holoSize/2]
          ];
          corners.forEach(([x, y]) => {
            holoGroup.append('line')
              .attr('x1', x)
              .attr('y1', y)
              .attr('x2', x + 6)
              .attr('y2', y - 6)
              .attr('stroke', nodeStyle.stroke)
              .attr('stroke-width', 1)
              .attr('opacity', 0.3);
          });
          break;

        case 'ethereal':
          // Flowing organic shapes
          group.append('path')
            .attr('d', () => {
              const size = d.isSource ? 30 : d.expanded ? 24 : 20;
              return `M 0,-${size} C ${size * 0.8},-${size * 0.8} ${size * 0.8},${size * 0.8} 0,${size} C -${size * 0.8},${size * 0.8} -${size * 0.8},-${size * 0.8} 0,-${size}`;
            })
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter)
            .style('animation', 'etherealFloat 4s ease-in-out infinite');
          break;

        case 'watercolor':
          // Irregular blob shapes
          group.append('path')
            .attr('d', () => {
              const size = d.isSource ? 30 : d.expanded ? 24 : 20;
              const irregularity = 0.3;
              let path = '';
              const points = 8;

              for (let i = 0; i <= points; i++) {
                const angle = (i * 2 * Math.PI) / points;
                const radius = size * (1 + Math.random() * irregularity - irregularity / 2);
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);

                if (i === 0) path += `M ${x} ${y}`;
                else path += ` Q ${x} ${y}`;
              }
              return path + ' Z';
            })
            .attr('fill', nodeStyle.fill)
            .attr('stroke', 'none')
            .attr('filter', nodeStyle.filter);
          break;

        case 'medieval':
          // Shield shapes
          group.append('path')
            .attr('d', () => {
              const size = d.isSource ? 30 : d.expanded ? 24 : 20;
              return `M 0,-${size} L ${size * 0.6},-${size * 0.7} L ${size * 0.6},${size * 0.3} Q ${size * 0.6},${size} 0,${size} Q -${size * 0.6},${size} -${size * 0.6},${size * 0.3} L -${size * 0.6},-${size * 0.7} Z`;
            })
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter);
          break;

        case 'manuscript':
          // Ornate scroll shapes
          group.append('path')
            .attr('d', () => {
              const size = d.isSource ? 32 : d.expanded ? 26 : 21;
              return `M -${size * 0.8},-${size * 0.4} Q -${size},-${size * 0.6} -${size * 0.6},-${size * 0.6} L ${size * 0.6},-${size * 0.6} Q ${size},-${size * 0.6} ${size * 0.8},-${size * 0.4} L ${size * 0.8},${size * 0.4} Q ${size},${size * 0.6} ${size * 0.6},${size * 0.6} L -${size * 0.6},${size * 0.6} Q -${size},${size * 0.6} -${size * 0.8},${size * 0.4} Z`;
            })
            .attr('fill', nodeStyle.fill)
            .attr('stroke', nodeStyle.stroke)
            .attr('stroke-width', nodeStyle.strokeWidth)
            .attr('filter', nodeStyle.filter);
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

    // Helper function to check if two line segments intersect
    const lineSegmentsIntersect = (x1: number, y1: number, x2: number, y2: number,
                                  x3: number, y3: number, x4: number, y4: number) => {
      const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(denom) < 1e-10) return false; // Lines are parallel

      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
      const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

      return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    };

    // Helper function to check if a position would cause overlap or edge crossings
    const isPositionClear = (x: number, y: number, radius: number, excludeNode?: D3Node, centerNode?: D3Node) => {
      const minDistance = radius * 2 + 25; // Minimum distance between node centers

      // Check for node overlaps
      const hasNodeOverlap = d3Data.nodes.some(node => {
        if (node === excludeNode || node === centerNode) return false;
        if (node.x === undefined || node.y === undefined) return false;
        const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
        return distance < minDistance;
      });

      if (hasNodeOverlap) return false;

      // Check for edge crossings if we have a center node
      if (centerNode && centerNode.x !== undefined && centerNode.y !== undefined) {
        const hasEdgeCrossing = d3Data.links.some(link => {
          const source = link.source as D3Node;
          const target = link.target as D3Node;

          if (!source.x || !source.y || !target.x || !target.y) return false;
          if (source === centerNode || target === centerNode) return false; // Skip edges connected to center
          if (source === excludeNode || target === excludeNode) return false; // Skip edges connected to new node

          // Check if the new edge from center to new position crosses existing edge
          return lineSegmentsIntersect(
            centerNode.x, centerNode.y, x, y,
            source.x, source.y, target.x, target.y
          );
        });

        if (hasEdgeCrossing) return false;
      }

      return true;
    };

    // Helper function to find a clear position around a center point
    const findClearPosition = (centerX: number, centerY: number, preferredRadius: number, nodeRadius: number, centerNode?: D3Node, maxAttempts = 20) => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const radius = preferredRadius + (attempt * 30); // Spiral outward if needed
        const anglesPerRing = Math.max(8, attempt + 4); // More angles for outer rings
        const angles = Array.from({ length: anglesPerRing }, (_, i) => (i * Math.PI * 2) / anglesPerRing);

        for (const angle of angles) {
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);

          // Check bounds
          if (x < nodeRadius + 10 || x > dimensions.width - nodeRadius - 10 ||
              y < nodeRadius + 10 || y > dimensions.height - nodeRadius - 10) {
            continue;
          }

          if (isPositionClear(x, y, nodeRadius, undefined, centerNode)) {
            return { x, y };
          }
        }
      }

      // Fallback: return a position even if not perfectly clear
      return {
        x: Math.max(nodeRadius + 10, Math.min(dimensions.width - nodeRadius - 10, centerX + preferredRadius)),
        y: Math.max(nodeRadius + 10, Math.min(dimensions.height - nodeRadius - 10, centerY))
      };
    };

    // Position new nodes in a circle around the clicked node if we can identify it
    const newNodes = newNodeGroups.data();
    if (newNodes.length > 0) {
      // Find the center node (recently clicked node that these connect to)
      const centerNode = d3Data.nodes.find(n => existingNodeIds.has(n.id) &&
        d3Data.links.some(link =>
          (link.source.id === n.id && newNodes.some(newNode => link.target.id === newNode.id)) ||
          (link.target.id === n.id && newNodes.some(newNode => link.source.id === newNode.id))
        )
      );

      if (centerNode && centerNode.x !== undefined && centerNode.y !== undefined) {
        // Adaptive spacing based on graph density for better sequential expansions
        const existingNodeCount = d3Data.nodes.length - newNodes.length;
        const densityFactor = Math.max(1, existingNodeCount / 10); // Adjust spacing for dense graphs
        const baseRadius = 200 + (densityFactor * 50); // Increase spacing for dense graphs
        const layers = Math.ceil(newNodes.length / 6); // 6 nodes per layer for better spacing

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

    // Create drag behavior with better click/drag distinction
    let isDragging = false;

    const drag = d3.drag<SVGGElement, D3Node>()
      .on('start', function(event, d) {
        isDragging = false; // Reset at start

        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0.1).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', function(event, d) {
        isDragging = true; // Mark as dragging once drag event fires

        // Update position during drag
        d.fx = event.x;
        d.fy = event.y;

        // No bounds constraint during drag - let user drag anywhere
        // d.fx and d.fy are set by drag behavior automatically

        // Visual feedback - find the main shape and enhance it
        const nodeGroup = d3.select(this);
        const mainShape = nodeGroup.select('rect, polygon, path, circle');
        if (!mainShape.empty()) {
          mainShape.attr('stroke-width',
            parseFloat(mainShape.attr('stroke-width') || '2') + 2);
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
      .on('mouseenter', function(event, d) {
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
      .on('mouseleave', function(event, d) {

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
        // Prevent click during drag or if default is prevented
        if (event.defaultPrevented || isDragging) {
          console.log('Click prevented - dragging:', isDragging, 'defaultPrevented:', event.defaultPrevented);
          return;
        }

        event.stopPropagation();
        setSelectedWord(d.word);

        console.log('Node clicked:', d.word.text, 'expanded:', d.expanded, 'isSource:', d.isSource);

        // Always trigger onNodeClick - let App.tsx handle the expansion logic
        // Don't check expanded state here as it might be stale

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
          console.log('Calling onNodeClick for:', d.word.text);
          onNodeClick(d.word);
        }
      });

    // Clear selection when clicking background
    svg.on('click', () => {
      setSelectedWord(null);
      setHoveredWord(null);
    });

    // Ultra-smooth tick handler with position interpolation and minimal jitter
    simulationRef.current.on('tick', () => {
      // Apply advanced position smoothing and boundary constraints
      d3Data.nodes.forEach(d => {
        if (d.x !== undefined && d.y !== undefined) {
          // Store previous position for interpolation
          const prevX = d.px || d.x;
          const prevY = d.py || d.y;

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
          d.px = d.x;
          d.py = d.y;
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
          case 'neural':
          case 'circuit':
          case 'botanical':
          case 'steampunk':
          case 'crystalline':
          case 'cosmic':
          case 'watercolor':
          case 'holographic':
          case 'molecular':
          case 'ethereal':
          case 'cyberpunk':
          case 'origami':
          case 'medieval':
          case 'manuscript':
            // Use curved paths for organic/complex themes
            const path = group.select('path');
            if (!path.empty()) {
              // Ensure coordinates are valid numbers
              const sx = Number(source.x) || 0;
              const sy = Number(source.y) || 0;
              const tx = Number(target.x) || 0;
              const ty = Number(target.y) || 0;

              const midX = (sx + tx) / 2;
              const midY = (sy + ty) / 2;
              const dx = tx - sx;
              const dy = ty - sy;
              const dr = Math.sqrt(dx * dx + dy * dy) * 0.3;

              // Create curved path for organic themes
              if (theme === 'botanical' || theme === 'ethereal' || theme === 'watercolor') {
                path.attr('d', `M ${sx} ${sy} Q ${midX + dr} ${midY - dr} ${tx} ${ty}`);
              }
              // Circuit board right angles
              else if (theme === 'circuit') {
                path.attr('d', `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ty} L ${tx} ${ty}`);
              }
              // Straight paths for tech themes including origami
              else {
                path.attr('d', `M ${sx} ${sy} L ${tx} ${ty}`);
              }
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
    defs.selectAll('*').remove();

    if (theme === 'ethereal') {
      // Source node gradient
      const sourceGradient = defs.append('radialGradient')
        .attr('id', 'etherealGradientSource')
        .attr('cx', '30%')
        .attr('cy', '30%');
      sourceGradient.append('stop').attr('offset', '0%').attr('stop-color', '#a855f7');
      sourceGradient.append('stop').attr('offset', '70%').attr('stop-color', '#7c3aed');
      sourceGradient.append('stop').attr('offset', '100%').attr('stop-color', '#5b21b6');

      // Expanded node gradient
      const expandedGradient = defs.append('radialGradient')
        .attr('id', 'etherealGradientExpanded')
        .attr('cx', '30%')
        .attr('cy', '30%');
      expandedGradient.append('stop').attr('offset', '0%').attr('stop-color', '#22d3ee');
      expandedGradient.append('stop').attr('offset', '70%').attr('stop-color', '#06b6d4');
      expandedGradient.append('stop').attr('offset', '100%').attr('stop-color', '#0891b2');

      // Default node gradient
      const defaultGradient = defs.append('radialGradient')
        .attr('id', 'etherealGradientDefault')
        .attr('cx', '30%')
        .attr('cy', '30%');
      defaultGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f0abfc');
      defaultGradient.append('stop').attr('offset', '70%').attr('stop-color', '#e879f9');
      defaultGradient.append('stop').attr('offset', '100%').attr('stop-color', '#d946ef');

      // Edge gradient
      const edgeGradient = defs.append('linearGradient')
        .attr('id', 'etherealEdgeGradient');
      edgeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#7c3aed');
      edgeGradient.append('stop').attr('offset', '50%').attr('stop-color', '#e879f9');
      edgeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4');
    } else if (theme === 'cosmic') {
      // Source node gradient
      const sourceGradient = defs.append('radialGradient')
        .attr('id', 'cosmicGradientSource')
        .attr('cx', '30%')
        .attr('cy', '30%');
      sourceGradient.append('stop').attr('offset', '0%').attr('stop-color', '#fde047');
      sourceGradient.append('stop').attr('offset', '70%').attr('stop-color', '#fbbf24');
      sourceGradient.append('stop').attr('offset', '100%').attr('stop-color', '#f59e0b');

      // Expanded node gradient
      const expandedGradient = defs.append('radialGradient')
        .attr('id', 'cosmicGradientExpanded')
        .attr('cx', '30%')
        .attr('cy', '30%');
      expandedGradient.append('stop').attr('offset', '0%').attr('stop-color', '#fb923c');
      expandedGradient.append('stop').attr('offset', '70%').attr('stop-color', '#f59e0b');
      expandedGradient.append('stop').attr('offset', '100%').attr('stop-color', '#ea580c');

      // Default node gradient
      const defaultGradient = defs.append('radialGradient')
        .attr('id', 'cosmicGradientDefault')
        .attr('cx', '30%')
        .attr('cy', '30%');
      defaultGradient.append('stop').attr('offset', '0%').attr('stop-color', '#fbbf24');
      defaultGradient.append('stop').attr('offset', '70%').attr('stop-color', '#d97706');
      defaultGradient.append('stop').attr('offset', '100%').attr('stop-color', '#92400e');

      // Edge gradient
      const edgeGradient = defs.append('linearGradient')
        .attr('id', 'cosmicEdgeGradient');
      edgeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#fbbf24');
      edgeGradient.append('stop').attr('offset', '50%').attr('stop-color', '#f59e0b');
      edgeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#d97706');
    } else if (theme === 'crystalline') {
      // Crystalline gradients with prismatic effects
      const sourceGradient = defs.append('radialGradient')
        .attr('id', 'crystallineGradientSource')
        .attr('cx', '30%')
        .attr('cy', '30%');
      sourceGradient.append('stop').attr('offset', '0%').attr('stop-color', '#6366f1');
      sourceGradient.append('stop').attr('offset', '50%').attr('stop-color', '#4f46e5');
      sourceGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3730a3');

      const expandedGradient = defs.append('radialGradient')
        .attr('id', 'crystallineGradientExpanded')
        .attr('cx', '30%')
        .attr('cy', '30%');
      expandedGradient.append('stop').attr('offset', '0%').attr('stop-color', '#a855f7');
      expandedGradient.append('stop').attr('offset', '50%').attr('stop-color', '#9333ea');
      expandedGradient.append('stop').attr('offset', '100%').attr('stop-color', '#7c3aed');

      const defaultGradient = defs.append('radialGradient')
        .attr('id', 'crystallineGradientDefault')
        .attr('cx', '30%')
        .attr('cy', '30%');
      defaultGradient.append('stop').attr('offset', '0%').attr('stop-color', '#60a5fa');
      defaultGradient.append('stop').attr('offset', '50%').attr('stop-color', '#3b82f6');
      defaultGradient.append('stop').attr('offset', '100%').attr('stop-color', '#1d4ed8');

      const edgeGradient = defs.append('linearGradient')
        .attr('id', 'crystallineEdgeGradient');
      edgeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#4f46e5');
      edgeGradient.append('stop').attr('offset', '50%').attr('stop-color', '#9333ea');
      edgeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6');
    } else if (theme === 'watercolor') {
      // Watercolor gradients with soft transitions
      const sourceGradient = defs.append('radialGradient')
        .attr('id', 'watercolorGradientSource')
        .attr('cx', '40%')
        .attr('cy', '40%');
      sourceGradient.append('stop').attr('offset', '0%').attr('stop-color', '#fb923c').attr('stop-opacity', '0.9');
      sourceGradient.append('stop').attr('offset', '60%').attr('stop-color', '#f97316').attr('stop-opacity', '0.7');
      sourceGradient.append('stop').attr('offset', '100%').attr('stop-color', '#ea580c').attr('stop-opacity', '0.5');

      const expandedGradient = defs.append('radialGradient')
        .attr('id', 'watercolorGradientExpanded')
        .attr('cx', '40%')
        .attr('cy', '40%');
      expandedGradient.append('stop').attr('offset', '0%').attr('stop-color', '#c084fc').attr('stop-opacity', '0.8');
      expandedGradient.append('stop').attr('offset', '60%').attr('stop-color', '#a855f7').attr('stop-opacity', '0.6');
      expandedGradient.append('stop').attr('offset', '100%').attr('stop-color', '#9333ea').attr('stop-opacity', '0.4');

      const defaultGradient = defs.append('radialGradient')
        .attr('id', 'watercolorGradientDefault')
        .attr('cx', '40%')
        .attr('cy', '40%');
      defaultGradient.append('stop').attr('offset', '0%').attr('stop-color', '#4ade80').attr('stop-opacity', '0.8');
      defaultGradient.append('stop').attr('offset', '60%').attr('stop-color', '#22c55e').attr('stop-opacity', '0.6');
      defaultGradient.append('stop').attr('offset', '100%').attr('stop-color', '#16a34a').attr('stop-opacity', '0.4');

      const flowGradient = defs.append('linearGradient')
        .attr('id', 'watercolorFlowGradient');
      flowGradient.append('stop').attr('offset', '0%').attr('stop-color', '#fb923c').attr('stop-opacity', '0.7');
      flowGradient.append('stop').attr('offset', '50%').attr('stop-color', '#a855f7').attr('stop-opacity', '0.5');
      flowGradient.append('stop').attr('offset', '100%').attr('stop-color', '#22c55e').attr('stop-opacity', '0.3');

      // Watercolor blur filter
      const watercolorBlur = defs.append('filter')
        .attr('id', 'watercolorBlur')
        .attr('x', '-20%')
        .attr('y', '-20%')
        .attr('width', '140%')
        .attr('height', '140%');

      watercolorBlur.append('feGaussianBlur')
        .attr('stdDeviation', '2')
        .attr('result', 'blur');

      watercolorBlur.append('feOffset')
        .attr('in', 'blur')
        .attr('dx', '1')
        .attr('dy', '1')
        .attr('result', 'offset');

      const watercolorMerge = watercolorBlur.append('feMerge');
      watercolorMerge.append('feMergeNode').attr('in', 'offset');
      watercolorMerge.append('feMergeNode').attr('in', 'SourceGraphic');

      // Edge blur filter
      const edgeBlur = defs.append('filter')
        .attr('id', 'watercolorEdgeBlur')
        .attr('x', '-10%')
        .attr('y', '-10%')
        .attr('width', '120%')
        .attr('height', '120%');

      edgeBlur.append('feGaussianBlur')
        .attr('stdDeviation', '1.5')
        .attr('result', 'edgeBlur');

      const edgeMerge = edgeBlur.append('feMerge');
      edgeMerge.append('feMergeNode').attr('in', 'edgeBlur');
      edgeMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    } else if (theme === 'liquid_metal') {
      // Liquid metal gradients with metallic reflections
      const sourceGradient = defs.append('radialGradient')
        .attr('id', 'metalGradientSource')
        .attr('cx', '30%')
        .attr('cy', '20%');
      sourceGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f1f5f9');
      sourceGradient.append('stop').attr('offset', '30%').attr('stop-color', '#cbd5e1');
      sourceGradient.append('stop').attr('offset', '70%').attr('stop-color', '#64748b');
      sourceGradient.append('stop').attr('offset', '100%').attr('stop-color', '#334155');

      const expandedGradient = defs.append('radialGradient')
        .attr('id', 'metalGradientExpanded')
        .attr('cx', '30%')
        .attr('cy', '20%');
      expandedGradient.append('stop').attr('offset', '0%').attr('stop-color', '#e2e8f0');
      expandedGradient.append('stop').attr('offset', '30%').attr('stop-color', '#94a3b8');
      expandedGradient.append('stop').attr('offset', '70%').attr('stop-color', '#475569');
      expandedGradient.append('stop').attr('offset', '100%').attr('stop-color', '#1e293b');

      const defaultGradient = defs.append('radialGradient')
        .attr('id', 'metalGradientDefault')
        .attr('cx', '30%')
        .attr('cy', '20%');
      defaultGradient.append('stop').attr('offset', '0%').attr('stop-color', '#cbd5e1');
      defaultGradient.append('stop').attr('offset', '30%').attr('stop-color', '#64748b');
      defaultGradient.append('stop').attr('offset', '70%').attr('stop-color', '#334155');
      defaultGradient.append('stop').attr('offset', '100%').attr('stop-color', '#0f172a');

      const flowGradient = defs.append('linearGradient')
        .attr('id', 'liquidMetalFlow');
      flowGradient.append('stop').attr('offset', '0%').attr('stop-color', '#94a3b8');
      flowGradient.append('stop').attr('offset', '50%').attr('stop-color', '#64748b');
      flowGradient.append('stop').attr('offset', '100%').attr('stop-color', '#475569');
    } else if (theme === 'aurora_borealis') {
      // Aurora borealis gradients with ethereal waves
      const sourceGradient = defs.append('radialGradient')
        .attr('id', 'auroraGradientSource')
        .attr('cx', '50%')
        .attr('cy', '30%');
      sourceGradient.append('stop').attr('offset', '0%').attr('stop-color', '#4ade80');
      sourceGradient.append('stop').attr('offset', '40%').attr('stop-color', '#22c55e');
      sourceGradient.append('stop').attr('offset', '70%').attr('stop-color', '#a855f7');
      sourceGradient.append('stop').attr('offset', '100%').attr('stop-color', '#7c3aed');

      const expandedGradient = defs.append('radialGradient')
        .attr('id', 'auroraGradientExpanded')
        .attr('cx', '50%')
        .attr('cy', '30%');
      expandedGradient.append('stop').attr('offset', '0%').attr('stop-color', '#c084fc');
      expandedGradient.append('stop').attr('offset', '40%').attr('stop-color', '#a855f7');
      expandedGradient.append('stop').attr('offset', '70%').attr('stop-color', '#22d3ee');
      expandedGradient.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4');

      const defaultGradient = defs.append('radialGradient')
        .attr('id', 'auroraGradientDefault')
        .attr('cx', '50%')
        .attr('cy', '30%');
      defaultGradient.append('stop').attr('offset', '0%').attr('stop-color', '#22d3ee');
      defaultGradient.append('stop').attr('offset', '40%').attr('stop-color', '#06b6d4');
      defaultGradient.append('stop').attr('offset', '70%').attr('stop-color', '#60a5fa');
      defaultGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6');

      const flowGradient = defs.append('linearGradient')
        .attr('id', 'auroraFlowGradient');
      flowGradient.append('stop').attr('offset', '0%').attr('stop-color', '#22c55e').attr('stop-opacity', '0.8');
      flowGradient.append('stop').attr('offset', '33%').attr('stop-color', '#a855f7').attr('stop-opacity', '0.6');
      flowGradient.append('stop').attr('offset', '66%').attr('stop-color', '#06b6d4').attr('stop-opacity', '0.6');
      flowGradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', '0.8');
    } else if (theme === 'neon_cityscape') {
      // Neon gradients with vibrant urban colors
      const neonGradient = defs.append('linearGradient')
        .attr('id', 'neonGradient');
      neonGradient.append('stop').attr('offset', '0%').attr('stop-color', '#ec4899');
      neonGradient.append('stop').attr('offset', '33%').attr('stop-color', '#10b981');
      neonGradient.append('stop').attr('offset', '66%').attr('stop-color', '#06b6d4');
      neonGradient.append('stop').attr('offset', '100%').attr('stop-color', '#ec4899');
    }

    // Create glowing filter for ethereal theme
    if (theme === 'ethereal') {
      const filter = defs.append('filter')
        .attr('id', 'etherealGlow')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');

      filter.append('feGaussianBlur')
        .attr('stdDeviation', '3')
        .attr('result', 'coloredBlur');

      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'coloredBlur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    }
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
        {theme === 'ethereal' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-purple-400 rounded-full opacity-30"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `etherealFloat ${3 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`
                }}
              />
            ))}
          </div>
        )}

        {theme === 'cyberpunk' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(0, 255, 127, 0.2) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0, 255, 127, 0.2) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px'
              }}
            />
          </div>
        )}

        {theme === 'cosmic' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 100 }).map((_, i) => (
              <div
                key={i}
                className="absolute bg-yellow-400 rounded-full"
                style={{
                  width: `${1 + Math.random() * 3}px`,
                  height: `${1 + Math.random() * 3}px`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `cosmicTwinkle ${2 + Math.random() * 6}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`
                }}
              />
            ))}
          </div>
        )}

        {theme === 'neural' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: '3px',
                  height: '3px',
                  backgroundColor: '#60a5fa',
                  borderRadius: '50%',
                  boxShadow: '0 0 10px #60a5fa',
                  animation: `neuralPulse ${2 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`
                }}
              />
            ))}
            {/* Neural network lines */}
            <svg className="absolute inset-0 w-full h-full opacity-20">
              {Array.from({ length: 15 }).map((_, i) => (
                <line
                  key={i}
                  x1={`${Math.random() * 100}%`}
                  y1={`${Math.random() * 100}%`}
                  x2={`${Math.random() * 100}%`}
                  y2={`${Math.random() * 100}%`}
                  stroke="#60a5fa"
                  strokeWidth="0.5"
                  strokeDasharray="4,4"
                  style={{
                    animation: `neuralFlow ${3 + Math.random() * 2}s linear infinite`,
                    animationDelay: `${Math.random() * 2}s`
                  }}
                />
              ))}
            </svg>
          </div>
        )}

        {theme === 'circuit' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(34, 211, 238, 0.3) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(34, 211, 238, 0.3) 1px, transparent 1px),
                  linear-gradient(rgba(59, 130, 246, 0.2) 2px, transparent 2px),
                  linear-gradient(90deg, rgba(59, 130, 246, 0.2) 2px, transparent 2px)
                `,
                backgroundSize: '20px 20px, 20px 20px, 60px 60px, 60px 60px'
              }}
            />
            {/* Circuit traces */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute bg-cyan-400 opacity-30"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${20 + Math.random() * 40}px`,
                  height: '2px',
                  animation: `circuitFlow ${2 + Math.random() * 3}s linear infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                  boxShadow: '0 0 6px #22d3ee'
                }}
              />
            ))}
          </div>
        )}

        {theme === 'crystalline' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${6 + Math.random() * 8}px`,
                  height: `${6 + Math.random() * 8}px`,
                  background: 'linear-gradient(45deg, #4f46e5, #9333ea, #3b82f6)',
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                  animation: `crystallineRotate ${8 + Math.random() * 8}s linear infinite`,
                  animationDelay: `${Math.random() * 4}s`,
                  opacity: 0.4,
                  filter: 'drop-shadow(0 0 8px rgba(79, 70, 229, 0.6))'
                }}
              />
            ))}
          </div>
        )}

        {theme === 'watercolor' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${20 + Math.random() * 40}px`,
                  height: `${20 + Math.random() * 40}px`,
                  background: `radial-gradient(circle, ${
                    ['rgba(251, 146, 60, 0.2)', 'rgba(139, 92, 246, 0.2)', 'rgba(34, 197, 94, 0.2)'][Math.floor(Math.random() * 3)]
                  } 0%, transparent 70%)`,
                  animation: `watercolorFlow ${4 + Math.random() * 6}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`,
                  filter: 'blur(2px)'
                }}
              />
            ))}
          </div>
        )}

        {theme === 'steampunk' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full border-2 opacity-20"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${15 + Math.random() * 25}px`,
                  height: `${15 + Math.random() * 25}px`,
                  borderColor: '#ca8a04',
                  animation: `steampunkRotate ${10 + Math.random() * 10}s linear infinite`,
                  animationDelay: `${Math.random() * 5}s`,
                  background: 'conic-gradient(from 0deg, transparent 0deg, #ca8a04 45deg, transparent 90deg, #ca8a04 135deg, transparent 180deg, #ca8a04 225deg, transparent 270deg, #ca8a04 315deg, transparent 360deg)'
                }}
              />
            ))}
            {/* Steam particles */}
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={`steam-${i}`}
                className="absolute bg-amber-200 rounded-full opacity-10"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '100%',
                  width: `${2 + Math.random() * 4}px`,
                  height: `${2 + Math.random() * 4}px`,
                  animation: `etherealFloat ${3 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`
                }}
              />
            ))}
          </div>
        )}

        {theme === 'holographic' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Matrix rain effect */}
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                className="absolute opacity-30"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-10px',
                  width: '2px',
                  height: `${50 + Math.random() * 100}px`,
                  background: 'linear-gradient(180deg, transparent 0%, #00ff7f 50%, transparent 100%)',
                  animation: `fadeIn ${2 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`
                }}
              />
            ))}
            {/* Holographic scan lines */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: 'linear-gradient(180deg, transparent 48%, rgba(0, 255, 127, 0.8) 49%, rgba(0, 255, 127, 0.8) 51%, transparent 52%)',
                backgroundSize: '100% 4px',
                animation: 'holographicFlow 3s linear infinite'
              }}
            />
          </div>
        )}

        {theme === 'manuscript' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Ink spots */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full opacity-10"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${5 + Math.random() * 15}px`,
                  height: `${5 + Math.random() * 15}px`,
                  backgroundColor: '#8b4513',
                  animation: `manuscriptInk ${4 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`,
                  filter: 'blur(1px)'
                }}
              />
            ))}
            {/* Parchment texture */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 20% 30%, rgba(139, 69, 19, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 80% 70%, rgba(160, 82, 45, 0.1) 0%, transparent 50%)
                `
              }}
            />
          </div>
        )}

        {theme === 'molecular' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${8 + Math.random() * 12}px`,
                  height: `${8 + Math.random() * 12}px`,
                  backgroundColor: ['#3b82f6', '#ef4444', '#22c55e', '#fbbf24'][Math.floor(Math.random() * 4)],
                  borderRadius: '50%',
                  opacity: 0.3,
                  animation: `molecularOrbit ${10 + Math.random() * 10}s linear infinite`,
                  animationDelay: `${Math.random() * 5}s`,
                  boxShadow: '0 0 8px currentColor'
                }}
              />
            ))}
            {/* Molecular bonds */}
            <svg className="absolute inset-0 w-full h-full opacity-20">
              {Array.from({ length: 10 }).map((_, i) => (
                <line
                  key={i}
                  x1={`${Math.random() * 100}%`}
                  y1={`${Math.random() * 100}%`}
                  x2={`${Math.random() * 100}%`}
                  y2={`${Math.random() * 100}%`}
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              ))}
            </svg>
          </div>
        )}

        {/* New Advanced Themes */}
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

        {theme === 'neon_cityscape' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Neon signs */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 90}%`,
                  top: `${Math.random() * 90}%`,
                  width: `${30 + Math.random() * 50}px`,
                  height: `${10 + Math.random() * 20}px`,
                  background: ['#ec4899', '#10b981', '#06b6d4'][i % 3],
                  borderRadius: '5px',
                  filter: `drop-shadow(0 0 ${10 + Math.random() * 20}px currentColor)`,
                  animation: `neonFlicker ${2 + Math.random() * 3}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                  opacity: 0.6
                }}
              />
            ))}
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(16, 185, 129, 0.3) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(16, 185, 129, 0.3) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px'
              }}
            />
          </div>
        )}

        {theme === 'ancient_constellation' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Stars */}
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${2 + Math.random() * 4}px`,
                  height: `${2 + Math.random() * 4}px`,
                  backgroundColor: '#ffd700',
                  filter: 'drop-shadow(0 0 8px #ffd700)',
                  animation: `starTwinkle ${2 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`,
                  opacity: 0.8
                }}
              />
            ))}
          </div>
        )}

        {theme === 'liquid_metal' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Flowing metal droplets */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  width: `${10 + Math.random() * 20}px`,
                  height: `${10 + Math.random() * 20}px`,
                  background: 'radial-gradient(circle at 30% 30%, #f1f5f9, #64748b)',
                  filter: 'drop-shadow(2px 2px 6px rgba(15, 23, 42, 0.5))',
                  animation: `liquidRipple ${4 + Math.random() * 3}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                  opacity: 0.7
                }}
              />
            ))}
          </div>
        )}

        {theme === 'paper_cutout' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Paper layers */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${Math.random() * 90}%`,
                  top: `${Math.random() * 90}%`,
                  width: `${40 + Math.random() * 60}px`,
                  height: `${40 + Math.random() * 60}px`,
                  background: ['#dc2626', '#ea580c', '#ca8a04'][i % 3],
                  borderRadius: '8px',
                  filter: `drop-shadow(${2 + i * 2}px ${3 + i * 2}px ${6 + i * 3}px rgba(0,0,0,0.2))`,
                  transform: `translateZ(${i * 5}px) rotate(${Math.random() * 20 - 10}deg)`,
                  opacity: 0.8 - i * 0.1
                }}
              />
            ))}
          </div>
        )}

        {theme === 'aurora_borealis' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Aurora waves */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: '-10%',
                  top: `${20 + i * 15}%`,
                  width: '120%',
                  height: `${30 + Math.random() * 20}px`,
                  background: `linear-gradient(90deg,
                    transparent 0%,
                    rgba(34, 197, 94, 0.3) 25%,
                    rgba(168, 85, 247, 0.3) 50%,
                    rgba(6, 182, 212, 0.3) 75%,
                    transparent 100%)`,
                  filter: 'blur(15px)',
                  animation: `auroraWave ${8 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${i * 1.5}s`,
                  transform: `skewY(${Math.random() * 4 - 2}deg)`
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