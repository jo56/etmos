import * as d3 from 'd3';
import type { ThemeName } from '../../App';
import type { D3Node, Word } from '../../types';

export const renderNodes = (
  containerRef: React.MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>,
  nodes: D3Node[],
  theme: ThemeName,
  currentTheme: any,
  onNodeClick?: (word: Word) => void,
  onNodeHover?: (word: Word | null) => void,
  onMouseMove?: (event: MouseEvent) => void
) => {
  if (!containerRef.current) return null;

  // Update nodes
  const nodeSelection = containerRef.current.selectAll<SVGGElement, D3Node>('.node')
    .data(nodes, d => d.id);

  nodeSelection.exit()
    .transition()
    .duration(300)
    .style('opacity', 0)
    .remove();

  const newNodes = nodeSelection.enter()
    .append('g')
    .attr('class', 'node')
    .style('cursor', 'pointer')
    .style('opacity', 0);

  // Add interaction handlers
  newNodes
    .on('click', (event, d) => {
      // IMMEDIATE VISUAL FEEDBACK: Add click animation
      const nodeGroup = d3.select(event.currentTarget);
      const mainShape = nodeGroup.select('polygon');
      if (!mainShape.empty()) {
        // Quick pulse effect to show click was registered
        mainShape.transition()
          .duration(100)
          .attr('stroke-width', '4')
          .transition()
          .duration(100)
          .attr('stroke-width', d.isSource ? '2' : d.expanded ? '2' : '1.5');
      }

      if (onNodeClick) {
        // Fix: Pass d.word, not the entire d object
        onNodeClick(d.word);
      }
    })
    .on('mouseenter', (event, d) => {
      if (onNodeHover) {
         // Fix: Pass d.word, not the entire d object
        onNodeHover(d.word);
      }
      if (onMouseMove) {
        onMouseMove(event as MouseEvent);
      }
    })
    .on('mousemove', (event) => { // d is not used here
      if (onMouseMove) {
        onMouseMove(event as MouseEvent);
      }
    })
    .on('mouseleave', () => {
      if (onNodeHover) {
        onNodeHover(null);
      }
    });

  // Render node shapes based on theme
  newNodes.each(function(d) {
    const group = d3.select(this);
    const radius = d.radius;

    // Get appropriate style based on node type
    let fillGradient, strokeColor, strokeWidth, filter;
    if (d.isSource) {
      fillGradient = 'url(#sourceGradient)';
      strokeColor = '#ef4444';
      strokeWidth = 2;
      filter = 'url(#origamiShadow)';
    } else if (d.expanded) {
      fillGradient = 'url(#expandedGradient)';
      strokeColor = '#f97316';
      strokeWidth = 2;
      filter = 'url(#origamiShadowExpanded)';
    } else {
      fillGradient = 'url(#defaultGradient)';
      strokeColor = '#f59e0b';
      strokeWidth = 1.5;
      filter = 'url(#origamiShadowDefault)';
    }

    // Create origami-style polygon shape
    const points = [];
    const sides = 8; // octagon for origami style
    const cornerRadius = radius * 0.15; // corner cut size

    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;

      // Create beveled corners by slightly adjusting radius for alternate points
      const adjustedRadius = (i % 2 === 0) ? radius : radius - cornerRadius;
      const adjX = Math.cos(angle) * adjustedRadius;
      const adjY = Math.sin(angle) * adjustedRadius;

      points.push(`${adjX},${adjY}`);
    }

    group.append('polygon')
      .attr('points', points.join(' '))
      .attr('fill', fillGradient)
      .attr('stroke', strokeColor)
      .attr('stroke-width', strokeWidth)
      .attr('filter', filter)
      .style('transform-origin', 'center')
      .style('transform', 'perspective(100px) rotateX(15deg) rotateY(-10deg)');

    // Add expanding indicator
    if (d.expanding) {
      group.append('circle')
        .attr('r', radius + 5)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,3')
        .attr('opacity', 0.7)
        .style('animation', 'spin 1s linear infinite');
    }


  newNodes.transition()
    .duration(300)
    .style('opacity', 1);

  const allNodeGroups = newNodes.merge(nodeSelection);

  return allNodeGroups;
};