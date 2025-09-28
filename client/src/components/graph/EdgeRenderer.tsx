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
  const linkSelection = containerRef.current.selectAll<SVGGElement, D3Link>('.link')
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

      case 'bauhaus':
        // Clean geometric lines
        group.append('path')
          .attr('fill', 'none')
          .attr('stroke', edgeStyle.stroke)
          .attr('stroke-width', edgeStyle.strokeWidth)
          .attr('opacity', edgeStyle.opacity)
          .attr('filter', edgeStyle.filter);
        break;

      case 'swiss':
        // Precise grid-based connections
        group.append('path')
          .attr('fill', 'none')
          .attr('stroke', edgeStyle.stroke)
          .attr('stroke-width', edgeStyle.strokeWidth)
          .attr('opacity', edgeStyle.opacity);
        break;

      case 'brutalist':
        // Bold concrete-like connections
        group.append('path')
          .attr('fill', 'none')
          .attr('stroke', edgeStyle.stroke)
          .attr('stroke-width', edgeStyle.strokeWidth * 1.5)
          .attr('opacity', edgeStyle.opacity);
        break;

      case 'art_deco':
        // Decorative stepped lines
        group.append('path')
          .attr('fill', 'none')
          .attr('stroke', edgeStyle.stroke)
          .attr('stroke-width', edgeStyle.strokeWidth)
          .attr('stroke-dasharray', '8,4')
          .attr('opacity', edgeStyle.opacity);
        break;

      case 'constructivist':
        // Angular geometric connections
        group.append('path')
          .attr('fill', 'none')
          .attr('stroke', edgeStyle.stroke)
          .attr('stroke-width', edgeStyle.strokeWidth)
          .attr('opacity', edgeStyle.opacity);
        break;

      case 'memphis':
        // Playful squiggly lines
        group.append('path')
          .attr('fill', 'none')
          .attr('stroke', edgeStyle.stroke)
          .attr('stroke-width', edgeStyle.strokeWidth)
          .attr('stroke-dasharray', '6,6')
          .attr('opacity', edgeStyle.opacity);
        break;

      case 'japanese':
        // Minimal zen lines
        group.append('path')
          .attr('fill', 'none')
          .attr('stroke', edgeStyle.stroke)
          .attr('stroke-width', edgeStyle.strokeWidth)
          .attr('stroke-linecap', 'round')
          .attr('opacity', edgeStyle.opacity);
        break;

      case 'scandinavian':
        // Clean natural connections
        group.append('path')
          .attr('fill', 'none')
          .attr('stroke', edgeStyle.stroke)
          .attr('stroke-width', edgeStyle.strokeWidth)
          .attr('opacity', edgeStyle.opacity);
        break;

      case 'modernist':
        // Function-focused lines
        group.append('path')
          .attr('fill', 'none')
          .attr('stroke', edgeStyle.stroke)
          .attr('stroke-width', edgeStyle.strokeWidth)
          .attr('opacity', edgeStyle.opacity);
        break;

      case 'deconstructivist':
        // Fragmented angular connections
        group.append('path')
          .attr('fill', 'none')
          .attr('stroke', edgeStyle.stroke)
          .attr('stroke-width', edgeStyle.strokeWidth)
          .attr('stroke-dasharray', '4,8,2,8')
          .attr('opacity', edgeStyle.opacity);
        break;

      case 'minimalist':
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