import * as d3 from 'd3';

export const createThemeGradients = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
  const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');

  // Clear existing gradients and filters to prevent conflicts
  defs.selectAll(null).remove();

  // Source node gradient
  const sourceGradient = defs.append('radialGradient')
    .attr('id', 'sourceGradient')
    .attr('cx', '30%')
    .attr('cy', '30%');
  sourceGradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#ffffff')
    .attr('stop-opacity', 0.9);
  sourceGradient.append('stop')
    .attr('offset', '70%')
    .attr('stop-color', '#f87171')
    .attr('stop-opacity', 0.8);
  sourceGradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#dc2626')
    .attr('stop-opacity', 0.9);

  // Expanded node gradient
  const expandedGradient = defs.append('radialGradient')
    .attr('id', 'expandedGradient')
    .attr('cx', '30%')
    .attr('cy', '30%');
  expandedGradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#ffffff')
    .attr('stop-opacity', 0.8);
  expandedGradient.append('stop')
    .attr('offset', '70%')
    .attr('stop-color', '#fb923c')
    .attr('stop-opacity', 0.7);
  expandedGradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#ea580c')
    .attr('stop-opacity', 0.8);

  // Default node gradient
  const defaultGradient = defs.append('radialGradient')
    .attr('id', 'defaultGradient')
    .attr('cx', '30%')
    .attr('cy', '30%');
  defaultGradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#ffffff')
    .attr('stop-opacity', 0.9);
  defaultGradient.append('stop')
    .attr('offset', '70%')
    .attr('stop-color', '#fbbf24')
    .attr('stop-opacity', 0.6);
  defaultGradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#d97706')
    .attr('stop-opacity', 0.7);

  // Add theme-specific filters and effects
  const glowFilter = defs.append('filter')
    .attr('id', 'glow')
    .attr('x', '-50%')
    .attr('y', '-50%')
    .attr('width', '200%')
    .attr('height', '200%');
  glowFilter.append('feGaussianBlur')
    .attr('stdDeviation', '3')
    .attr('result', 'coloredBlur');
  const feMerge = glowFilter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Origami shadow filter
  const origamiShadow = defs.append('filter')
    .attr('id', 'origamiShadow');
  origamiShadow.append('feDropShadow')
    .attr('dx', '2')
    .attr('dy', '4')
    .attr('stdDeviation', '2')
    .attr('flood-color', 'rgba(239, 68, 68, 0.3)');
  origamiShadow.append('feDropShadow')
    .attr('dx', '-1')
    .attr('dy', '-2')
    .attr('stdDeviation', '1')
    .attr('flood-color', 'rgba(255, 255, 255, 0.8)');

  // Expanded origami shadow
  const origamiShadowExpanded = defs.append('filter')
    .attr('id', 'origamiShadowExpanded');
  origamiShadowExpanded.append('feDropShadow')
    .attr('dx', '1.5')
    .attr('dy', '3')
    .attr('stdDeviation', '1.5')
    .attr('flood-color', 'rgba(249, 115, 22, 0.25)');
  origamiShadowExpanded.append('feDropShadow')
    .attr('dx', '-0.8')
    .attr('dy', '-1.5')
    .attr('stdDeviation', '1')
    .attr('flood-color', 'rgba(255, 255, 255, 0.7)');

  // Default origami shadow
  const origamiShadowDefault = defs.append('filter')
    .attr('id', 'origamiShadowDefault');
  origamiShadowDefault.append('feDropShadow')
    .attr('dx', '1')
    .attr('dy', '2')
    .attr('stdDeviation', '1')
    .attr('flood-color', 'rgba(245, 158, 11, 0.2)');
  origamiShadowDefault.append('feDropShadow')
    .attr('dx', '-0.5')
    .attr('dy', '-1')
    .attr('stdDeviation', '0.5')
    .attr('flood-color', 'rgba(255, 255, 255, 0.6)');
};