import * as d3 from 'd3';
import type { ThemeName } from '../../App';
import type { D3Link } from '../../types';
import { getEdgeStyle } from '../../utils/edgeUtils';

export const renderEdges = (
  containerRef: React.MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>,
  links: D3Link[],
  theme: ThemeName,
  currentTheme: any
) => {
  if (!containerRef.current) return { allLinks: null, allLinkLabels: null, allLabelBgs: null };

  // Update links
  const linkSelection = containerRef.current.selectAll<SVGLineElement, D3Link>('.link')
    .data(links, d => d.id);

  linkSelection.exit()
    .transition()
    .duration(300)
    .style('opacity', 0)
    .remove();

  // Theme-specific edge rendering
  const newLinks = linkSelection.enter().append('g').attr('class', 'link');

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

  const allLinks = newLinks.merge(linkSelection);

  // Edge text labels removed - keeping only the visual connection lines

  return { allLinks, allLinkLabels: null, allLabelBgs: null };
};