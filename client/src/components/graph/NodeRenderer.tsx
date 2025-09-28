import * as d3 from 'd3';
import type { ThemeName } from '../../App';
import type { D3Node, Word } from '../../types';

export const renderNodes = (
  containerRef: React.MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>,
  nodes: D3Node[],
  _theme: ThemeName,
  _currentTheme: any,
  onNodeClick?: (word: Word) => void,
  onNodeHover?: (word: Word | null) => void,
  onMouseMove?: (event: MouseEvent) => void
) => {
  if (!containerRef.current) return null;

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
      const nodeGroup = d3.select(event.currentTarget);
      const mainShape = nodeGroup.select('polygon');
      if (!mainShape.empty()) {
        mainShape.transition()
          .duration(100)
          .attr('stroke-width', '4')
          .transition()
          .duration(100)
          .attr('stroke-width', d.isSource ? '2' : d.expanded ? '2' : '1.5');
      }
      if (onNodeClick) {
        onNodeClick(d.word);
      }
    })
    .on('mouseenter', (event, d) => {
      if (onNodeHover) {
        onNodeHover(d.word);
      }
      if (onMouseMove) {
        onMouseMove(event as MouseEvent);
      }
    })
    .on('mousemove', (event) => {
      if (onMouseMove) {
        onMouseMove(event as MouseEvent);
      }
    })
    .on('mouseleave', () => {
      if (onNodeHover) {
        onNodeHover(null);
      }
    });

  // Render node shapes
  newNodes.each(function(d) {
    const group = d3.select(this);
    const radius = d.radius;

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

    const points: string[] = [];
    const sides = 8;
    const cornerRadius = radius * 0.15;

    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
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

    const textGroup = group.append('g').attr('class', 'node-text');

    textGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', '#1f2937')
      .style('font-family', 'Inter, sans-serif')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text(d.word.text);

    textGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .style('font-size', '10px')
      .style('font-weight', '400')
      .style('fill', '#6b7280')
      .style('font-family', 'Inter, sans-serif')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text(`(${d.word.language || 'unknown'})`);
  });

  newNodes.transition()
    .duration(300)
    .style('opacity', 1);

  const allNodeGroups = newNodes.merge(nodeSelection);

  return allNodeGroups;
};
