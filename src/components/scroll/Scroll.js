import {formatValue} from "../../core/format.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function resolveElement(container) {
  if (typeof container === "string") return document.querySelector(container);
  return container;
}

function ensureElementId(element, prefix = "gp-scroll") {
  if (element.id) return element.id;
  element.id = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  return element.id;
}

function getPrismVizApi(options = {}) {
  return options.legacyLayeredApi || options.legacyApi || globalThis.d3?.prismViz || null;
}

function isLegacyScrollModel(data = {}) {
  const graph = data?.graph || data?.scrollModel?.graph || data?.legacyModel?.graph;
  return Boolean(graph && !Array.isArray(graph.contextEdges));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stringId(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    return stringId(value.id ?? value.sliceId ?? "");
  }
  return String(value);
}

function hasKnownSlice(sliceById, sliceId) {
  const key = stringId(sliceId);
  return key && (sliceById.size === 0 || sliceById.has(key));
}

function primarySliceIdFromNode(node = {}) {
  const direct = stringId(node.primarySliceId ?? node.sliceId);
  if (direct) return direct;
  const weights = node.sliceWeights || {};
  return Object.entries(weights)
    .map(([sliceId, weight]) => [stringId(sliceId), toNumber(weight, 0)])
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function legacyContextEdgesToArray(contextEdges, nodeById, activeSliceId) {
  if (!contextEdges || typeof contextEdges !== "object" || Array.isArray(contextEdges)) return [];
  const rows = [];
  Object.entries(contextEdges).forEach(([key, value]) => {
    const edgeList = Array.isArray(value) ? value : asArray(value?.edges);
    const keyText = String(key);
    const isInbound = keyText.startsWith("l");
    const yearMatch = keyText.match(/[lr](\d{4})/);
    edgeList.forEach((edge, index) => {
      const source = stringId(edge.source);
      const target = stringId(edge.target);
      const sourceNode = nodeById.get(source);
      const targetNode = nodeById.get(target);
      const direction = isInbound ? "in" : "out";
      const sourceSliceId = primarySliceIdFromNode(sourceNode || edge.sourceEntity || {})
        || stringId(edge.sourceSliceId ?? edge.source_slice);
      const targetSliceId = primarySliceIdFromNode(targetNode || edge.targetEntity || {})
        || stringId(edge.targetSliceId ?? edge.target_slice);
      const contextSliceId = direction === "in"
        ? sourceSliceId
        : targetSliceId;
      if (!contextSliceId || contextSliceId === activeSliceId) return;
      rows.push({
        ...edge,
        id: edge.id || edge.name || `${keyText}:${index}`,
        source,
        target,
        direction,
        contextSliceId,
        sourceSliceId,
        targetSliceId,
        year: yearMatch ? Number(yearMatch[1]) : (direction === "in" ? targetNode?.time : sourceNode?.time),
        contextKey: keyText,
      });
    });
  });
  return rows;
}

function getColor(sliceId, colorMap = {}, fallback = "#9ab") {
  const value = colorMap[stringId(sliceId)];
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.color === "string") return value.color;
  return fallback;
}

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({r, g, b}) {
  return `#${[r, g, b].map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function mixColors(a, b, amount = 0.5) {
  const first = hexToRgb(a);
  const second = hexToRgb(b);
  if (!first || !second) return a || b || "#9ab";
  return rgbToHex({
    r: first.r * (1 - amount) + second.r * amount,
    g: first.g * (1 - amount) + second.g * amount,
    b: first.b * (1 - amount) + second.b * amount,
  });
}

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) element.setAttribute(key, value);
  });
  return element;
}

function setText(element, value) {
  element.textContent = value == null ? "" : String(value);
  return element;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nodeDisplayName(node = {}) {
  return stringId(node.label || node.name || node.title || node.id);
}

function edgeDisplayName(edge = {}) {
  const source = nodeDisplayName(edge.sourceNode || edge.sourceEntity || {label: edge.sourceName, id: edge.source});
  const target = nodeDisplayName(edge.targetNode || edge.targetEntity || {label: edge.targetName, id: edge.target});
  return `${source} -> ${target}`;
}

function nodeTooltipHtml(node = {}) {
  return `<strong>${escapeHtml(nodeDisplayName(node))}</strong>`;
}

function edgeTooltipHtml(edge = {}) {
  return `<strong>${escapeHtml(edgeDisplayName(edge))}</strong>`;
}

function normalizeScrollData(data = {}, options = {}) {
  const graph = data.graph || data;
  const slice = data.slice || graph.slice || {};
  const colorMap = data.colorMap || options.colorMap || {};
  const slices = asArray(data.slices || options.slices).map(sliceItem => ({
    id: stringId(sliceItem.id),
    name: sliceItem.name || sliceItem.shortName || stringId(sliceItem.id),
    shortName: sliceItem.shortName || sliceItem.name || stringId(sliceItem.id),
    color: typeof sliceItem.color === "string" ? sliceItem.color : getColor(sliceItem.id, colorMap),
    raw: sliceItem,
  }));
  const sliceById = new Map(slices.map(sliceItem => [stringId(sliceItem.id), sliceItem]));

  const nodes = asArray(graph.nodes || graph.entities).map(node => {
    const id = stringId(node.id);
    const primarySliceId = primarySliceIdFromNode(node);
    const sliceWeights = node.sliceWeights && typeof node.sliceWeights === "object" && !Array.isArray(node.sliceWeights)
      ? {...node.sliceWeights}
      : {};
    if (primarySliceId && !Object.prototype.hasOwnProperty.call(sliceWeights, primarySliceId)) {
      sliceWeights[primarySliceId] = 1;
    }
    return {
      id,
      label: node.label || node.name || id,
      time: toOptionalNumber(node.time ?? node.layer),
      primarySliceId,
      sliceWeights,
      impact: toNumber(node.impact ?? node.value, 0),
      importance: toNumber(node.importance ?? 0, 0),
      raw: node,
    };
  }).filter(node => node.id);

  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const edges = asArray(graph.edges || graph.relations).map(edge => ({
    id: edge.id || edge.name || `${edge.source}->${edge.target}`,
    source: stringId(edge.source),
    target: stringId(edge.target),
    weight: toNumber(edge.weight ?? edge.prob ?? edge.value, 1),
    label: edge.label || edge.name || `${edge.source}->${edge.target}`,
    relationCount: toNumber(edge.relationCount ?? edge.meta?.relationCount ?? edge.relations?.length, 1),
    relations: edge.relations,
    meta: edge.meta,
    type: edge.type || edge.relationType,
    raw: edge,
  })).filter(edge => nodeById.has(edge.source) && nodeById.has(edge.target));

  const activeSliceId = stringId(slice.id ?? graph.sliceId ?? options.sliceId ?? nodes[0]?.primarySliceId);
  const rawContextEdges = Array.isArray(graph.contextEdges)
    ? graph.contextEdges
    : legacyContextEdgesToArray(graph.contextEdges, nodeById, activeSliceId);
  const contextEdges = asArray(rawContextEdges).map(edge => {
    const source = stringId(edge.source);
    const target = stringId(edge.target);
    const sourceNode = nodeById.get(source);
    const targetNode = nodeById.get(target);
    const direction = edge.direction || (sourceNode ? "out" : "in");
    const activeNode = direction === "out" ? sourceNode : targetNode;
    const contextSliceId = direction === "out"
      ? stringId(edge.targetSliceId ?? edge.target_slice)
      : stringId(edge.sourceSliceId ?? edge.source_slice);

    return {
      id: edge.id || edge.name || `${source}->${target}`,
      source,
      target,
      direction,
      contextSliceId,
      year: toOptionalNumber(edge.year ?? activeNode?.time),
      weight: toNumber(edge.weight ?? edge.prob ?? 1, 1),
      raw: edge,
    };
  }).filter(edge =>
    edge.year != null
    && hasKnownSlice(sliceById, edge.contextSliceId)
    && edge.contextSliceId !== activeSliceId
  );

  const activeSlice = {
    id: activeSliceId,
    name: slice.name || slice.shortName || sliceById.get(activeSliceId)?.name || activeSliceId,
    shortName: slice.shortName || slice.name || sliceById.get(activeSliceId)?.shortName || activeSliceId,
    color: typeof slice.color === "string" ? slice.color : getColor(activeSliceId, colorMap),
    raw: slice,
  };

  return {
    slice: activeSlice,
    nodes,
    edges,
    contextEdges,
    slices,
    sliceById,
    colorMap,
    stats: graph.stats || {},
  };
}

function extent(values, fallback = [1990, 2024]) {
  const finiteValues = values.map(value => Number(value)).filter(Number.isFinite);
  if (finiteValues.length === 0) return fallback;
  return [Math.min(...finiteValues), Math.max(...finiteValues)];
}

function uniqueSortedYears(minYear, maxYear) {
  const start = Math.floor(minYear);
  const end = Math.ceil(maxYear);
  return Array.from({length: Math.max(1, end - start + 1)}, (_, index) => start + index);
}

function stableHash(value) {
  let hash = 0;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function scaleLinear(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return value => r0 + ((value - d0) / span) * (r1 - r0);
}

function isFreeGraphLayout(layoutMode) {
  return ["free", "free-layout", "free-graph", "force", "force-graph", "graph"].includes(String(layoutMode || "").toLowerCase());
}

function isTimeLayeredLayout(layoutMode) {
  return ["layered-time", "layered", "layered-scroll", "time", "timeline", "year"].includes(String(layoutMode || "").toLowerCase());
}

function hexagonPoints(cx, cy, radiusX, radiusY = radiusX) {
  const x = toNumber(cx, 0);
  const y = toNumber(cy, 0);
  const rx = Math.max(0.001, Math.abs(toNumber(radiusX, 4)));
  const ry = Math.max(0.001, Math.abs(toNumber(radiusY, rx)));
  return [
    [x + rx, y],
    [x + rx / 2, y + ry],
    [x - rx / 2, y + ry],
    [x - rx, y],
    [x - rx / 2, y - ry],
    [x + rx / 2, y - ry],
  ].map(point => point.join(",")).join(" ");
}

function edgePath(source, target) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const sameRow = Math.abs(dy) < 4;
  if (sameRow) {
    const bend = Math.max(38, Math.abs(dx) * 0.18);
    return `M ${source.x} ${source.y} C ${source.x + dx * 0.25} ${source.y - bend}, ${target.x - dx * 0.25} ${target.y - bend}, ${target.x} ${target.y}`;
  }
  const curve = Math.max(42, Math.min(180, Math.abs(dx) * 0.35));
  return `M ${source.x} ${source.y} C ${source.x + curve} ${source.y + dy * 0.35}, ${target.x - curve} ${target.y - dy * 0.35}, ${target.x} ${target.y}`;
}

function freeEdgePath(source, target) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const bend = Math.min(28, distance * 0.08);
  const normalX = -dy / distance * bend;
  const normalY = dx / distance * bend;
  return `M ${source.x} ${source.y} Q ${(source.x + target.x) / 2 + normalX} ${(source.y + target.y) / 2 + normalY} ${target.x} ${target.y}`;
}

function edgeProbability(edge = {}) {
  return toNumber(edge.weight ?? edge.prob ?? edge.value, 0.55);
}

function originalEdgeOpacity(edge = {}, minOpacity = 0.2) {
  const opacity = clamp((edgeProbability(edge) - 0.3) / (0.8 - 0.3), 0, 1);
  return minOpacity + (0.8 - minOpacity) * opacity;
}

function originalEdgeWidth(edge = {}, minWidth = 1, maxWidth = 4) {
  const opacity = clamp((edgeProbability(edge) - 0.3) / (0.8 - 0.3), 0, 1);
  return minWidth + opacity * (maxWidth - minWidth);
}

function originalNodeTextSize(node = {}) {
  const impact = toNumber(node.impact ?? node.value, 0);
  const base = impact < 50 ? 30 : (impact < 100 ? 40 : 50);
  return Math.sqrt(base) * 7;
}

function originalNodeRadius(node = {}, options = {}) {
  return clamp(
    originalNodeTextSize(node) * toNumber(options.freeGraphNodeRadiusScale, 0.52),
    toNumber(options.freeGraphMinNodeRadius, 10),
    toNumber(options.freeGraphMaxNodeRadius, 30)
  );
}

function edgeHitWidth(options = {}) {
  return toNumber(options.freeGraphEdgeHitWidth, 14);
}

function appendEdgeHitTarget(parent, visiblePath, options = {}) {
  const hitPath = visiblePath.cloneNode(false);
  hitPath.classList.add("gp-scroll-edge-hit");
  hitPath.removeAttribute("id");
  hitPath.removeAttribute("data-edge-id");
  hitPath.removeAttribute("marker-end");
  hitPath.setAttribute("fill", "none");
  hitPath.setAttribute("stroke", "#000000");
  hitPath.setAttribute("stroke-opacity", "0.001");
  hitPath.setAttribute("stroke-width", String(edgeHitWidth(options)));
  hitPath.setAttribute("pointer-events", "stroke");
  hitPath.style.setProperty("--gp-scroll-edge-hit-width", String(edgeHitWidth(options)));
  parent.appendChild(hitPath);
  return hitPath;
}

function prependNodeHitTarget(parent, radius, options = {}) {
  const hitStrokeWidth = toNumber(options.freeGraphNodeHitStrokeWidth, 14);
  const hitRadius = Math.max(
    toNumber(radius, 0) + toNumber(options.freeGraphNodeHitPadding, 8),
    toNumber(options.freeGraphNodeHitRadius, 18)
  );
  const hitCircle = createSvgElement("circle", {
    class: "gp-scroll-node-hit",
    cx: 0,
    cy: 0,
    r: hitRadius,
  });
  hitCircle.style.setProperty("--gp-scroll-node-hit-width", String(hitStrokeWidth));
  parent.insertBefore(hitCircle, parent.firstChild);
  return hitCircle;
}

function contextEdgePath(edge, layout) {
  const isInflow = edge.direction === "in";
  const sideX = isInflow ? layout.viewport.x : layout.viewport.x + layout.viewport.width;
  const sideY = layout.yScale(edge.year);
  const node = edge.activeNode;
  const start = isInflow ? {x: sideX, y: sideY} : node;
  const end = isInflow ? node : {x: sideX, y: sideY};
  const dx = end.x - start.x;
  const c1x = start.x + dx * 0.42;
  const c2x = start.x + dx * 0.76;
  const wobble = ((stableHash(edge.id || `${edge.source}->${edge.target}`) % 9) - 4) * 4.5;
  const lift = (isInflow ? -1 : 1) * (18 + (stableHash(edge.contextSliceId) % 20));
  return `M ${start.x} ${start.y} C ${c1x} ${start.y + lift + wobble}, ${c2x} ${end.y - lift * 0.45 - wobble}, ${end.x} ${end.y}`;
}

function smoothVerticalPath(points) {
  if (points.length === 0) return "";
  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midY = (previous.y + current.y) / 2;
    commands.push(`C ${previous.x} ${midY}, ${current.x} ${midY}, ${current.x} ${current.y}`);
  }
  return commands.join(" ");
}

function streamAreaPath(outerPoints, innerPoints) {
  const outer = smoothVerticalPath(outerPoints);
  const inner = smoothVerticalPath([...innerPoints].reverse());
  if (!outer || !inner) return "";
  return `${outer} L ${innerPoints[innerPoints.length - 1].x} ${innerPoints[innerPoints.length - 1].y} ${inner.replace(/^M /, "L ")} Z`;
}

function buildContext(contextEdges, years, direction, activeSliceId, sliceById) {
  const context = {};
  contextEdges
    .filter(edge => edge.direction === direction)
    .forEach(edge => {
      const sliceId = edge.contextSliceId;
      if (!hasKnownSlice(sliceById, sliceId) || sliceId === stringId(activeSliceId)) return;
      if (!context[sliceId]) {
        context[sliceId] = {total: 0, edges: []};
        years.forEach(year => { context[sliceId][year] = 0; });
      }
      if (context[sliceId][edge.year] === undefined) context[sliceId][edge.year] = 0;
      context[sliceId][edge.year] += 1;
      context[sliceId].total += 1;
      context[sliceId].edges.push(edge);
    });
  return context;
}

function buildSegments(items, getSliceId, colorMap, sliceById) {
  const totals = new Map();
  items.forEach(item => {
    const sliceId = stringId(getSliceId(item));
    if (!hasKnownSlice(sliceById, sliceId)) return;
    totals.set(sliceId, (totals.get(sliceId) || 0) + 1);
  });
  const rows = [...totals.entries()]
    .map(([sliceId, count]) => ({
      sliceId,
      count,
      label: sliceById.get(sliceId)?.shortName || sliceById.get(sliceId)?.name || sliceId,
      color: getColor(sliceId, colorMap),
      items: items.filter(item => stringId(getSliceId(item)) === sliceId),
    }))
    .sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, item) => sum + item.count, 0);
  return {rows, total};
}

function edgeSegmentWeight(edge = {}) {
  return Math.max(1, toNumber(edge.relationCount ?? edge.meta?.relationCount ?? edge.relations?.length, 1));
}

function buildWeightedSegments(items, getSliceId, getWeight, colorMap, sliceById) {
  const rows = new Map();
  items.forEach(item => {
    const sliceId = stringId(getSliceId(item));
    if (!hasKnownSlice(sliceById, sliceId)) return;
    if (!rows.has(sliceId)) {
      rows.set(sliceId, {
        sliceId,
        count: 0,
        label: sliceById.get(sliceId)?.shortName || sliceById.get(sliceId)?.name || sliceId,
        color: getColor(sliceId, colorMap),
        items: [],
      });
    }
    const row = rows.get(sliceId);
    row.count += Math.max(0, toNumber(getWeight(item), 1));
    row.items.push(item);
  });
  const sortedRows = [...rows.values()]
    .filter(row => row.count > 0)
    .sort((a, b) => b.count - a.count || String(a.sliceId).localeCompare(String(b.sliceId)));
  const total = sortedRows.reduce((sum, item) => sum + item.count, 0);
  return {rows: sortedRows, total};
}

function buildContextSegments(contextEdges, direction, activeSliceId, colorMap, sliceById) {
  const rows = new Map();
  contextEdges
    .filter(edge => edge.direction === direction)
    .forEach(edge => {
      const sliceId = stringId(edge.contextSliceId);
      if (!hasKnownSlice(sliceById, sliceId) || sliceId === stringId(activeSliceId)) return;
      if (!rows.has(sliceId)) {
        rows.set(sliceId, {
          sliceId,
          count: 0,
          label: sliceById.get(sliceId)?.shortName || sliceById.get(sliceId)?.name || sliceId,
          color: getColor(sliceId, colorMap),
          edges: [],
        });
      }
      rows.get(sliceId).count += 1;
      rows.get(sliceId).edges.push(edge);
    });
  const sortedRows = [...rows.values()].sort((a, b) =>
    direction === "in"
      ? a.count - b.count || String(a.sliceId).localeCompare(String(b.sliceId))
      : b.count - a.count || String(a.sliceId).localeCompare(String(b.sliceId))
  );
  const total = sortedRows.reduce((sum, item) => sum + item.count, 0);
  return {rows: sortedRows, total};
}

function buildLegacyCombinedContextSegments(combinedContextEdges, model = {}) {
  if (!combinedContextEdges || typeof combinedContextEdges !== "object") return null;
  const incomingRows = new Map();
  const outgoingRows = new Map();

  function addRow(rows, sliceId, count, combinedEdge, direction) {
    const key = stringId(sliceId);
    const value = Math.max(0, toNumber(count, 0));
    const isLegacyUnknownSlice = key === "null" || key === "undefined";
    if (!value || (!hasKnownSlice(model.sliceById, key) && !isLegacyUnknownSlice)) return;
    if (!rows.has(key)) {
      rows.set(key, {
        sliceId: key,
        count: 0,
        label: model.sliceById.get(key)?.shortName || model.sliceById.get(key)?.name || key,
        color: getColor(key, model.colorMap),
        edges: [],
      });
    }
    const row = rows.get(key);
    row.count += value;
    asArray(combinedEdge.edges).forEach(edge => row.edges.push({
      ...edge,
      direction,
      contextSliceId: key,
      combinedContextEdge: combinedEdge.name,
    }));
  }

  Object.entries(combinedContextEdges).forEach(([key, combinedEdge = {}]) => {
    const edgeName = combinedEdge.name || key;
    const direction = String(edgeName).startsWith("l") ? "in" : "out";
    const rows = direction === "in" ? incomingRows : outgoingRows;
    const topicEntries = Object.entries(combinedEdge.topics || {}).filter(([, count]) => toNumber(count, 0) > 0);
    if (topicEntries.length > 0) {
      topicEntries.forEach(([sliceId, count]) => addRow(rows, sliceId, count, combinedEdge, direction));
      return;
    }
    asArray(combinedEdge.edges).forEach(edge => {
      const sliceId = direction === "in"
        ? edge.sourceSliceId ?? edge.source_slice
        : edge.targetSliceId ?? edge.target_slice;
      addRow(rows, sliceId, 1, {...combinedEdge, edges: [edge]}, direction);
    });
  });

  const incoming = [...incomingRows.values()].filter(row => row.count > 0);
  const outgoing = [...outgoingRows.values()].filter(row => row.count > 0);
  return {
    incoming: {
      rows: incoming,
      total: incoming.reduce((sum, row) => sum + row.count, 0),
    },
    outgoing: {
      rows: outgoing,
      total: outgoing.reduce((sum, row) => sum + row.count, 0),
    },
  };
}

function buildFreeGraphFlowSegments(edges = [], model = {}) {
  const activeSliceId = stringId(model.slice?.id);
  const legacyCombinedSegments = buildLegacyCombinedContextSegments(model.legacyCombinedContextEdges, model);
  if (legacyCombinedSegments && (legacyCombinedSegments.incoming.total > 0 || legacyCombinedSegments.outgoing.total > 0)) {
    return legacyCombinedSegments;
  }
  const contextEdges = asArray(model.contextEdges);
  if (contextEdges.length > 0) {
    return {
      incoming: buildContextSegments(contextEdges, "in", activeSliceId, model.colorMap, model.sliceById),
      outgoing: buildContextSegments(contextEdges, "out", activeSliceId, model.colorMap, model.sliceById),
    };
  }
  const incomingEdges = edges.filter(edge =>
    stringId(edge.targetNode?.primarySliceId) === activeSliceId
    && stringId(edge.sourceNode?.primarySliceId) !== activeSliceId
  );
  const outgoingEdges = edges.filter(edge =>
    stringId(edge.sourceNode?.primarySliceId) === activeSliceId
    && stringId(edge.targetNode?.primarySliceId) !== activeSliceId
  );
  const sourceSegments = buildWeightedSegments(
    incomingEdges,
    edge => edge.sourceNode?.primarySliceId,
    edgeSegmentWeight,
    model.colorMap,
    model.sliceById
  );
  const targetSegments = buildWeightedSegments(
    outgoingEdges,
    edge => edge.targetNode?.primarySliceId,
    edgeSegmentWeight,
    model.colorMap,
    model.sliceById
  );
  return {
    incoming: sourceSegments,
    outgoing: targetSegments,
  };
}

function computeLegacyXPositions(nodes, edges, viewport, options = {}) {
  const xById = new Map();
  const anchorById = new Map();
  const nodesByYear = new Map();
  const minX = viewport.x + 22;
  const maxX = viewport.x + viewport.width - 22;

  nodes.forEach(node => {
    const year = Math.round(toNumber(node.time, 0));
    if (!nodesByYear.has(year)) nodesByYear.set(year, []);
    nodesByYear.get(year).push(node);
  });

  [...nodesByYear.values()].forEach(bucket => {
    bucket.sort((a, b) => b.impact - a.impact || stableHash(a.id) - stableHash(b.id));
    bucket.forEach((node, index) => {
      const hashRatio = (stableHash(node.id) % 1000) / 1000;
      const bucketRatio = (index + 1) / (bucket.length + 1);
      const anchorRatio = bucket.length <= 2
        ? 0.22 + hashRatio * 0.56
        : bucketRatio * 0.72 + hashRatio * 0.28;
      const anchor = minX + (maxX - minX) * anchorRatio;
      xById.set(node.id, anchor);
      anchorById.set(node.id, anchor);
    });
  });

  const nodeIds = new Set(nodes.map(node => node.id));
  const layoutEdges = edges
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .slice(0, toNumber(options.layoutEdgeLimit, 520));
  const iterations = toNumber(options.layoutIterations, 90);
  const attraction = toNumber(options.edgeAttraction, 0.035);
  const anchorStrength = toNumber(options.anchorStrength, 0.018);
  const minGap = toNumber(options.minSameYearGap, 14);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const delta = new Map(nodes.map(node => [node.id, 0]));

    layoutEdges.forEach(edge => {
      const sourceX = xById.get(edge.source);
      const targetX = xById.get(edge.target);
      if (sourceX == null || targetX == null) return;
      const midpoint = (sourceX + targetX) / 2;
      const weight = clamp(edge.weight || 1, 0.2, 2.4);
      delta.set(edge.source, delta.get(edge.source) + (midpoint - sourceX) * attraction * weight);
      delta.set(edge.target, delta.get(edge.target) + (midpoint - targetX) * attraction * weight);
    });

    nodes.forEach(node => {
      const current = xById.get(node.id);
      const anchor = anchorById.get(node.id);
      delta.set(node.id, delta.get(node.id) + (anchor - current) * anchorStrength);
    });

    nodes.forEach(node => {
      xById.set(node.id, clamp(xById.get(node.id) + delta.get(node.id), minX, maxX));
    });

    [...nodesByYear.values()].forEach(bucket => {
      const sorted = [...bucket].sort((a, b) => xById.get(a.id) - xById.get(b.id));
      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        const distance = xById.get(current.id) - xById.get(previous.id);
        if (distance >= minGap) continue;
        const shift = (minGap - distance) / 2;
        xById.set(previous.id, clamp(xById.get(previous.id) - shift, minX, maxX));
        xById.set(current.id, clamp(xById.get(current.id) + shift, minX, maxX));
      }
    });
  }

  return xById;
}

function allocateLayerCounts(total, layerCount, exponent = 1.18) {
  if (layerCount <= 0) return [];
  const weights = Array.from({length: layerCount}, (_, index) => Math.pow(index + 1, exponent));
  const counts = Array(layerCount).fill(total >= layerCount ? 1 : 0);
  let remaining = Math.max(0, total - counts.reduce((sum, value) => sum + value, 0));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
  const raw = weights.map(weight => weight / weightTotal * remaining);
  raw.forEach((value, index) => {
    const add = Math.floor(value);
    counts[index] += add;
    remaining -= add;
  });
  raw
    .map((value, index) => ({index, fraction: value - Math.floor(value)}))
    .sort((a, b) => b.fraction - a.fraction || b.index - a.index)
    .forEach(({index}) => {
      if (remaining <= 0) return;
      counts[index] += 1;
      remaining -= 1;
    });
  return counts;
}

function buildFreeGraphTopology(nodes, edges, options = {}) {
  const nodeIds = new Set(nodes.map(node => node.id));
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const adjacency = new Map(nodes.map(node => [node.id, []]));
  const outgoing = new Map(nodes.map(node => [node.id, []]));
  const incoming = new Map(nodes.map(node => [node.id, []]));
  const undirected = new Map(nodes.map(node => [node.id, new Set()]));
  const degree = new Map(nodes.map(node => [node.id, 0]));
  const layoutEdges = edges
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target)
    .slice(0, toNumber(options.freeGraphLayoutEdgeLimit, 720));

  layoutEdges.forEach(edge => {
    adjacency.get(edge.source)?.push(edge.target);
    outgoing.get(edge.source)?.push(edge.target);
    incoming.get(edge.target)?.push(edge.source);
    undirected.get(edge.source)?.add(edge.target);
    undirected.get(edge.target)?.add(edge.source);
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  });

  return {nodeIds, nodeById, adjacency, outgoing, incoming, undirected, degree, layoutEdges};
}

function freeGraphConnectedComponents(nodes, topology) {
  const seen = new Set();
  const components = [];
  nodes.forEach(node => {
    if (seen.has(node.id)) return;
    const stack = [node.id];
    const ids = [];
    seen.add(node.id);
    while (stack.length > 0) {
      const id = stack.pop();
      ids.push(id);
      topology.undirected.get(id)?.forEach(nextId => {
        if (seen.has(nextId)) return;
        seen.add(nextId);
        stack.push(nextId);
      });
    }
    components.push(ids.map(id => topology.nodeById.get(id)).filter(Boolean));
  });
  const componentKey = component => Math.min(...component.map(node => stableHash(node.id)));
  return components.sort((a, b) => b.length - a.length || componentKey(a) - componentKey(b));
}

function freeGraphComponentDepths(component, topology) {
  const componentIds = new Set(component.map(node => node.id));
  const localIndegree = new Map(component.map(node => [node.id, 0]));
  component.forEach(node => {
    topology.incoming.get(node.id)?.forEach(parentId => {
      if (componentIds.has(parentId)) localIndegree.set(node.id, (localIndegree.get(node.id) || 0) + 1);
    });
  });

  const layerById = new Map(component.map(node => [node.id, 0]));
  const queue = component
    .filter(node => (localIndegree.get(node.id) || 0) === 0)
    .sort((a, b) =>
      (topology.degree.get(b.id) || 0) - (topology.degree.get(a.id) || 0)
      || b.impact - a.impact
      || stableHash(a.id) - stableHash(b.id)
    )
    .map(node => node.id);
  const visited = new Set();

  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    topology.adjacency.get(id)?.forEach(targetId => {
      if (!componentIds.has(targetId)) return;
      layerById.set(targetId, Math.max(layerById.get(targetId) || 0, (layerById.get(id) || 0) + 1));
      localIndegree.set(targetId, (localIndegree.get(targetId) || 0) - 1);
      if ((localIndegree.get(targetId) || 0) === 0) queue.push(targetId);
    });
    queue.sort((a, b) => (layerById.get(a) || 0) - (layerById.get(b) || 0) || a.localeCompare(b));
  }

  if (visited.size < component.length) {
    const root = [...component].sort((a, b) =>
      (topology.degree.get(b.id) || 0) - (topology.degree.get(a.id) || 0)
      || b.impact - a.impact
      || a.id.localeCompare(b.id)
    )[0];
    const depth = new Map([[root.id, 0]]);
    const bfs = [root.id];
    while (bfs.length > 0) {
      const id = bfs.shift();
      topology.undirected.get(id)?.forEach(nextId => {
        if (!componentIds.has(nextId) || depth.has(nextId)) return;
        depth.set(nextId, (depth.get(id) || 0) + 1);
        bfs.push(nextId);
      });
    }
    component.forEach(node => {
      if (!visited.has(node.id)) layerById.set(node.id, depth.get(node.id) || 0);
    });
  }

  return {
    layerById,
    maxDepth: Math.max(1, ...layerById.values()),
  };
}

function interleaveFreeGraphIsolated(connectedItems, isolatedItems) {
  const ordered = [...connectedItems];
  isolatedItems
    .sort((a, b) => stableHash(a.node.id) - stableHash(b.node.id))
    .forEach(item => {
      const slot = ordered.length === 0 ? 0 : stableHash(`slot:${item.node.id}`) % (ordered.length + 1);
      ordered.splice(slot, 0, item);
    });
  return ordered;
}

function computeFreeGraphLayerPlan(nodes, edges, options = {}) {
  const orderedNodes = [...nodes].sort((a, b) =>
    stableHash(a.id) - stableHash(b.id)
    || a.id.localeCompare(b.id)
  );
  const topology = buildFreeGraphTopology(orderedNodes, edges, options);
  const components = freeGraphConnectedComponents(orderedNodes, topology);
  const connectedComponentsOnly = components.filter(component =>
    component.some(node => (topology.degree.get(node.id) || 0) > 0)
  );
  const isolatedNodes = orderedNodes.filter(node => (topology.degree.get(node.id) || 0) === 0);
  const nodeCount = Math.max(1, orderedNodes.length);
  const targetLayers = toNumber(options.freeGraphTargetLayers, 20);
  const minNodesPerLayer = Math.max(1, toNumber(options.freeGraphMinNodesPerLayer, 2));
  const densityLayers = Math.round(Math.sqrt(nodeCount) * toNumber(options.freeGraphLayerDensity, 1.8));
  const targetBiasedLayers = Math.min(targetLayers, Math.ceil(nodeCount / minNodesPerLayer));
  const layerCount = clamp(
    Math.min(targetLayers, Math.max(1, densityLayers, targetBiasedLayers)),
    Math.min(3, orderedNodes.length),
    nodeCount
  );
  const layers = Array.from({length: layerCount}, () => []);
  const layerById = new Map();
  const totalCaps = allocateLayerCounts(orderedNodes.length, layerCount, toNumber(options.freeGraphTotalLayerExponent, 1.25));
  const connectedCount = connectedComponentsOnly.reduce((sum, component) => sum + component.length, 0);
  const connectedCaps = allocateLayerCounts(connectedCount, layerCount, toNumber(options.freeGraphConnectedLayerExponent, 1.08));
  const connectedEntries = [];

  connectedComponentsOnly.forEach((component, componentIndex) => {
    const {layerById: depthById, maxDepth} = freeGraphComponentDepths(component, topology);
    component.forEach(node => {
      connectedEntries.push({
        node,
        isolated: false,
        componentIndex,
        degree: topology.degree.get(node.id) || 0,
        depthRatio: (depthById.get(node.id) || 0) / Math.max(1, maxDepth),
        originalOrder: 0,
      });
    });
  });
  connectedEntries.sort((a, b) =>
    a.depthRatio - b.depthRatio
    || a.componentIndex - b.componentIndex
    || b.degree - a.degree
    || b.node.impact - a.node.impact
    || stableHash(a.node.id) - stableHash(b.node.id)
  );

  let cursor = 0;
  for (let layer = 0; layer < layerCount; layer += 1) {
    const capacity = connectedCaps[layer] || 0;
    for (let index = 0; index < capacity && cursor < connectedEntries.length; index += 1) {
      const item = connectedEntries[cursor];
      layers[layer].push(item);
      layerById.set(item.node.id, layer);
      cursor += 1;
    }
  }
  while (cursor < connectedEntries.length) {
    const item = connectedEntries[cursor];
    layers[layerCount - 1].push(item);
    layerById.set(item.node.id, layerCount - 1);
    cursor += 1;
  }

  const isolatedEntries = isolatedNodes
    .sort((a, b) => stableHash(a.id) - stableHash(b.id))
    .map(node => ({
      node,
      isolated: true,
      componentIndex: -1,
      degree: 0,
      depthRatio: null,
      originalOrder: 0,
    }));
  let isolatedCursor = 0;
  for (let layer = 0; layer < layerCount; layer += 1) {
    const targetTotal = totalCaps[layer] || layers[layer].length;
    const capacity = Math.max(0, targetTotal - layers[layer].length);
    const isolatedForLayer = isolatedEntries.slice(isolatedCursor, isolatedCursor + capacity);
    isolatedCursor += isolatedForLayer.length;
    layers[layer] = interleaveFreeGraphIsolated(layers[layer], isolatedForLayer);
    isolatedForLayer.forEach(item => layerById.set(item.node.id, layer));
  }
  let layer = layerCount - 1;
  while (isolatedCursor < isolatedEntries.length) {
    const item = isolatedEntries[isolatedCursor];
    layers[layer] = interleaveFreeGraphIsolated(layers[layer], [item]);
    layerById.set(item.node.id, layer);
    isolatedCursor += 1;
    layer = layer <= 0 ? layerCount - 1 : layer - 1;
  }

  layers.forEach(bucket => {
    bucket.forEach((item, index) => {
      item.originalOrder = index;
    });
  });

  return {
    topology,
    layers,
    layerById,
    layerCount,
    connectedCount,
    isolatedCount: isolatedNodes.length,
  };
}

function computeLayeredGraphPositions(nodes, edges, viewport, options = {}) {
  const plan = options.freeGraphLayerPlan || computeFreeGraphLayerPlan(nodes, edges, options);
  const {layers, topology} = plan;
  const points = new Map();
  const positionInLayer = new Map();
  const orderedLayers = Array.from({length: plan.layerCount}, (_, index) => index);
  layers.forEach(bucket => {
    bucket.forEach((item, index) => positionInLayer.set(item.node.id, index));
  });

  for (let pass = 0; pass < 3; pass += 1) {
    orderedLayers.forEach(layer => {
      const bucket = layers[layer] || [];
      bucket.sort((a, b) => {
        const aIncoming = topology.incoming.get(a.node.id) || [];
        const bIncoming = topology.incoming.get(b.node.id) || [];
        const aOutgoing = topology.outgoing.get(a.node.id) || [];
        const bOutgoing = topology.outgoing.get(b.node.id) || [];
        const linkedA = [...aIncoming, ...aOutgoing];
        const linkedB = [...bIncoming, ...bOutgoing];
        const meanA = linkedA.length > 0
          ? linkedA.reduce((sum, id) => sum + (positionInLayer.get(id) ?? a.originalOrder), 0) / linkedA.length
          : a.originalOrder;
        const meanB = linkedB.length > 0
          ? linkedB.reduce((sum, id) => sum + (positionInLayer.get(id) ?? b.originalOrder), 0) / linkedB.length
          : b.originalOrder;
        return meanA - meanB
          || a.componentIndex - b.componentIndex
          || (topology.degree.get(b.node.id) || 0) - (topology.degree.get(a.node.id) || 0)
          || a.originalOrder - b.originalOrder
          || a.node.id.localeCompare(b.node.id);
      });
      bucket.forEach((item, index) => positionInLayer.set(item.node.id, index));
    });
  }

  const xPadding = toNumber(options.freeGraphLayerPaddingX, 38);
  const yPadding = toNumber(options.freeGraphLayerPaddingY, 38);
  const minX = viewport.x + xPadding;
  const maxX = viewport.x + viewport.width - xPadding;
  const centerWidth = Math.max(1, maxX - minX);
  const xById = new Map();
  const anchorById = new Map();
  const minGap = toNumber(options.freeGraphMinSameLayerGap, 15);
  orderedLayers.forEach(layer => {
    const bucket = layers[layer] || [];
    bucket.forEach(({node}, index) => {
      const ratio = (index + 1) / (bucket.length + 1);
      const hashRatio = (stableHash(node.id) % 1000) / 1000;
      const branch = (hashRatio - 0.5) * Math.min(24, centerWidth / Math.max(7, bucket.length + 1));
      const anchor = clamp(minX + (maxX - minX) * ratio + branch, minX, maxX);
      xById.set(node.id, anchor);
      anchorById.set(node.id, anchor);
    });
  });

  const attraction = toNumber(options.freeGraphEdgeAttraction, 0.038);
  const anchorStrength = toNumber(options.freeGraphAnchorStrength, 0.018);
  const iterations = toNumber(options.freeGraphLayoutIterations, 100);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const delta = new Map([...xById.keys()].map(id => [id, 0]));
    topology.layoutEdges.forEach(edge => {
      if (!xById.has(edge.source) || !xById.has(edge.target)) return;
      const sourceX = xById.get(edge.source);
      const targetX = xById.get(edge.target);
      const midpoint = (sourceX + targetX) / 2;
      const weight = clamp(edgeProbability(edge), 0.2, 2.4);
      delta.set(edge.source, delta.get(edge.source) + (midpoint - sourceX) * attraction * weight);
      delta.set(edge.target, delta.get(edge.target) + (midpoint - targetX) * attraction * weight);
    });
    xById.forEach((current, id) => {
      delta.set(id, delta.get(id) + ((anchorById.get(id) || current) - current) * anchorStrength);
    });
    xById.forEach((current, id) => {
      xById.set(id, clamp(current + (delta.get(id) || 0), minX, maxX));
    });
    orderedLayers.forEach(layer => {
      const sorted = [...(layers[layer] || [])].sort((a, b) => (xById.get(a.node.id) || 0) - (xById.get(b.node.id) || 0));
      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1].node.id;
        const current = sorted[index].node.id;
        const distance = (xById.get(current) || 0) - (xById.get(previous) || 0);
        if (distance >= minGap) continue;
        const shift = (minGap - distance) / 2;
        xById.set(previous, clamp((xById.get(previous) || minX) - shift, minX, maxX));
        xById.set(current, clamp((xById.get(current) || maxX) + shift, minX, maxX));
      }
    });
  }

  const layerGap = (viewport.height - yPadding * 2) / Math.max(1, plan.layerCount - 1);
  orderedLayers.forEach(layer => {
    const bucket = layers[layer] || [];
    const yBase = viewport.y + yPadding + layerGap * layer;
    bucket.forEach(({node, componentIndex, isolated}) => {
      const yJitter = (((stableHash(`${node.id}:y`) % 1000) / 999) - 0.5) * Math.min(layerGap * 0.12, 5);
      points.set(node.id, {
        x: clamp(xById.get(node.id) || (viewport.x + viewport.width / 2), viewport.x + 22, viewport.x + viewport.width - 22),
        y: clamp(yBase + yJitter + (isolated ? 0 : (componentIndex % 2 ? 1.2 : -1.2)), viewport.y + 22, viewport.y + viewport.height - 22),
      });
    });
  });

  return points;
}

function escapeDotString(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\n/g, "\\n");
}

let graphvizInstancePromise = null;

function getGraphvizInstance() {
  const Viz = globalThis.Viz;
  if (!Viz || typeof Viz.instance !== "function") return null;
  if (!graphvizInstancePromise) graphvizInstancePromise = Viz.instance();
  return graphvizInstancePromise;
}

function buildFreeGraphDot(layout, model, options = {}) {
  const graphWidthInches = Math.max(5, layout.viewport.width / 96);
  const graphHeightInches = Math.max(3, layout.viewport.height / 96);
  const layerPlan = layout.virtualLayerPlan || computeFreeGraphLayerPlan(layout.nodes, layout.edges, options);
  const realEdgeKeys = new Set(layout.edges.map(edge => `${edge.source}->${edge.target}`));
  const lines = [
    "digraph G {",
    "graph [rankdir=TB, bgcolor=\"transparent\", margin=0, pad=0, outputorder=edgesfirst, splines=true, overlap=false, ordering=out]",
    `size="${graphWidthInches},${graphHeightInches}"`,
    "ratio=\"fill\"",
    "nodesep=0.18",
    "ranksep=0.38",
    "node [shape=hexagon, regular=true, style=filled, fixedsize=false, margin=0.012, fontname=\"Arial\", fontsize=15, color=\"transparent\", penwidth=0]",
    "edge [arrowsize=0.22, color=\"#111111\", penwidth=1]",
  ];

  for (let layer = 0; layer < layerPlan.layerCount; layer += 1) {
    lines.push(`"__rank_${layer}" [label="", shape=point, style=invis, width=0.01, height=0.01]`);
  }

  layout.nodes.forEach(node => {
    const fill = node.color || getColor(node.primarySliceId, model.colorMap, model.slice.color);
    const label = formatValue(node.impact, {precision: 0});
    const fontSize = node.labelSize || clamp(originalNodeTextSize(node) * toNumber(options.freeGraphNodeLabelScale, 0.55), 10, 30);
    lines.push(`"${escapeDotString(node.id)}" [label="${escapeDotString(label)}", fillcolor="${fill}", fontsize=${fontSize}, tooltip="${escapeDotString(node.label)}"]`);
  });

  layerPlan.layers.forEach((bucket, layer) => {
    const ids = bucket.map(item => `"${escapeDotString(item.node.id)}"`);
    lines.push(`{ rank=same "__rank_${layer}" ${ids.join(" ")} }`);
    for (let index = 0; index < bucket.length - 1; index += 1) {
      const source = bucket[index].node.id;
      const target = bucket[index + 1].node.id;
      if (realEdgeKeys.has(`${source}->${target}`)) continue;
      lines.push(`"${escapeDotString(source)}" -> "${escapeDotString(target)}" [style=invis, weight=80, constraint=false]`);
    }
  });
  for (let layer = 0; layer < layerPlan.layerCount - 1; layer += 1) {
    lines.push(`"__rank_${layer}" -> "__rank_${layer + 1}" [style=invis, weight=1000]`);
  }

  layout.edges.forEach(edge => {
    lines.push(`"${escapeDotString(edge.source)}" -> "${escapeDotString(edge.target)}" [weight=${Math.max(1, Math.round(clamp(edgeProbability(edge), 0.2, 1) * 8))}]`);
  });
  lines.push("}");
  return lines.join("\n");
}

function clearScrollSelection(root) {
  root.querySelectorAll(".is-selected, .is-related").forEach(node => {
    node.classList.remove("is-selected", "is-related");
  });
}

function highlightScrollSelection(root, context = {}) {
  clearScrollSelection(root);
  const type = context.type;
  const selectedNodeId = type === "node" ? stringId(context.node?.id) : "";
  const selectedEdge = type === "edge" ? context.edge : null;
  const selectedSource = stringId(selectedEdge?.source);
  const selectedTarget = stringId(selectedEdge?.target);

  root.querySelectorAll("[data-node-id]").forEach(node => {
    const id = node.dataset.nodeId;
    if (id === selectedNodeId || id === selectedSource || id === selectedTarget) {
      node.classList.add(id === selectedNodeId ? "is-selected" : "is-related");
    }
  });

  root.querySelectorAll("[data-edge-id]").forEach(edge => {
    const source = edge.dataset.source;
    const target = edge.dataset.target;
    const edgeMatches = selectedEdge && source === selectedSource && target === selectedTarget;
    const nodeMatches = selectedNodeId && (source === selectedNodeId || target === selectedNodeId);
    if (edgeMatches || nodeMatches) {
      edge.classList.add(edgeMatches ? "is-selected" : "is-related");
      if (selectedNodeId) {
        root.querySelectorAll("[data-node-id]").forEach(node => {
          if (node.dataset.nodeId === source || node.dataset.nodeId === target) node.classList.add("is-related");
        });
      }
    }
  });
}

function layoutScroll(model, options = {}) {
  const width = toNumber(options.width, 1280);
  const height = toNumber(options.height, 820);
  const padding = {
    top: 122,
    right: 158,
    bottom: 126,
    left: 158,
  };
  const layoutMode = options.layoutMode || "legacy";
  const freeGraph = isFreeGraphLayout(layoutMode);
  let viewport = {
    x: padding.left,
    y: padding.top,
    width: width - padding.left - padding.right,
    height: height - padding.top - padding.bottom,
  };
  if (freeGraph) {
    const baseWidth = width - padding.left - padding.right;
    const baseHeight = height - padding.top - padding.bottom;
    const freeWidth = Math.min(baseWidth, baseHeight * toNumber(options.freeGraphAspect, 1.18));
    viewport = {
      x: (width - freeWidth) / 2,
      y: padding.top,
      width: freeWidth,
      height: baseHeight,
    };
  }
  const allYears = [
    ...model.nodes.map(node => node.time),
    ...model.contextEdges.map(edge => edge.year),
  ];
  let [minYear, maxYear] = extent(allYears, [1990, 2024]);
  minYear = Math.floor(minYear);
  maxYear = Math.ceil(maxYear);
  if (minYear === maxYear) {
    minYear -= 1;
    maxYear += 1;
  }
  const years = uniqueSortedYears(minYear, maxYear);
  const yScale = scaleLinear([minYear, maxYear], [viewport.y + 28, viewport.y + viewport.height - 28]);
  const sliceIds = model.slices.length > 0
    ? model.slices.map(slice => slice.id)
    : [...new Set(model.nodes.map(node => node.primarySliceId))];
  const sliceIndex = new Map(sliceIds.map((sliceId, index) => [sliceId, index]));
  const bandWidth = viewport.width / Math.max(1, sliceIds.length);
  const nodesByYearAndSlice = new Map();
  const nodesByYear = new Map();
  const nodeIds = new Set(model.nodes.map(node => node.id));
  const baseOrderedNodes = freeGraph
    ? [...model.nodes].sort((a, b) =>
      stableHash(a.id) - stableHash(b.id)
      || a.id.localeCompare(b.id)
    )
    : [...model.nodes].sort((a, b) =>
      toNumber(a.time, 0) - toNumber(b.time, 0)
      || (sliceIndex.get(a.primarySliceId) ?? 999) - (sliceIndex.get(b.primarySliceId) ?? 999)
      || b.impact - a.impact
      || a.id.localeCompare(b.id)
    );
  const graphLayoutX = layoutMode === "legacy"
    ? computeLegacyXPositions(
      baseOrderedNodes,
      model.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)).sort((a, b) => b.weight - a.weight),
      viewport,
      options
    )
    : null;
  const freeGraphLayerPlan = freeGraph ? computeFreeGraphLayerPlan(baseOrderedNodes, model.edges, options) : null;
  const freeGraphPositions = freeGraph
    ? computeLayeredGraphPositions(baseOrderedNodes, model.edges, viewport, {...options, freeGraphLayerPlan})
    : null;

  const orderedNodes = baseOrderedNodes;
  orderedNodes.forEach(node => {
    const year = Math.round(toNumber(node.time, 0));
    if (!nodesByYear.has(year)) nodesByYear.set(year, []);
    nodesByYear.get(year).push(node);
  });

  const laidOutNodes = orderedNodes.map(node => {
    const year = Math.round(toNumber(node.time, 0));
    const sliceId = sliceIndex.has(node.primarySliceId) ? node.primarySliceId : model.slice.id;
    const key = `${year}:${sliceId}`;
    const indexInBucket = nodesByYearAndSlice.get(key) || 0;
    nodesByYearAndSlice.set(key, indexInBucket + 1);
    const yearBucket = nodesByYear.get(year) || [node];
    const indexInYear = yearBucket.findIndex(item => item.id === node.id);
    const slicePosition = sliceIndex.has(sliceId) ? sliceIndex.get(sliceId) : sliceIndex.get(model.slice.id) || 0;
    const sliceAnchor = viewport.x + bandWidth * slicePosition + bandWidth / 2;
    const spreadAnchor = viewport.x + viewport.width * ((indexInYear + 1) / (yearBucket.length + 1));
    const useSliceColumns = layoutMode === "slice-columns";
    const useEvenYearSpread = layoutMode === "year-spread";
    const freePoint = freeGraphPositions?.get(node.id);
    const xAnchor = freeGraph && freePoint
      ? freePoint.x
      : (useSliceColumns
      ? sliceAnchor
      : (layoutMode === "legacy"
        ? graphLayoutX.get(node.id)
        : (useEvenYearSpread || !graphLayoutX ? (yearBucket.length <= 3 ? sliceAnchor * 0.42 + spreadAnchor * 0.58 : spreadAnchor) : graphLayoutX.get(node.id))));
    const bucketOffset = freeGraph ? 0 : (useSliceColumns ? ((indexInBucket % 7) - 3) * Math.min(18, bandWidth * 0.08) : 0);
    const rowOffset = freeGraph
      ? 0
      : (useSliceColumns
      ? (Math.floor(indexInBucket / 7) % 3 - 1) * 11
      : ((indexInYear % 3) - 1) * 5.5);
    const jitter = freeGraph ? 0 : (stableHash(node.id) % 17) - 8;
    const x = xAnchor + bucketOffset + (layoutMode === "legacy" ? jitter * 0.25 : jitter);
    const y = freeGraph && freePoint ? freePoint.y : yScale(toNumber(node.time, minYear)) + rowOffset;
    const activeColor = model.slice.color || getColor(model.slice.id, model.colorMap);
    const ownColor = getColor(node.primarySliceId, model.colorMap, activeColor);
    const isAccentSlice = stringId(node.primarySliceId) && stringId(node.primarySliceId) !== stringId(model.slice.id);
    const color = freeGraph ? activeColor : mixColors(ownColor, activeColor, node.primarySliceId === model.slice.id ? 0.15 : 0.45);
    const impact = Math.max(0, node.impact);
    const radius = freeGraph
      ? originalNodeRadius(node, options)
      : clamp(Math.sqrt(impact + 4) * toNumber(options.nodeScale, 0.58), 4.5, toNumber(options.maxNodeRadius, 13));

    return {
      ...node,
      x: clamp(x, viewport.x + 20, viewport.x + viewport.width - 20),
      y: clamp(y, viewport.y + 18, viewport.y + viewport.height - 18),
      radius,
      labelSize: freeGraph ? clamp(originalNodeTextSize(node) * toNumber(options.freeGraphNodeLabelScale, 0.55), 10, 30) : null,
      color,
      ringColor: freeGraph && isAccentSlice ? ownColor : "transparent",
      ringWidth: freeGraph && isAccentSlice ? clamp(radius * 0.42, 3.2, 8) : 0,
    };
  });

  const nodeById = new Map(laidOutNodes.map(node => [node.id, node]));
  const maxEdges = toNumber(options.maxEdges, 260);
  const laidOutEdges = [...model.edges]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxEdges)
    .map(edge => ({
      ...edge,
      sourceNode: nodeById.get(edge.source),
      targetNode: nodeById.get(edge.target),
    }))
    .filter(edge => edge.sourceNode && edge.targetNode);
  const contextEdges = [...model.contextEdges]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, toNumber(options.maxContextEdges, 420))
    .map(edge => {
      const activeNode = edge.direction === "in"
        ? nodeById.get(edge.target) || nodeById.get(edge.source)
        : nodeById.get(edge.source) || nodeById.get(edge.target);
      return {
        ...edge,
        activeNode,
      };
    })
    .filter(edge => edge.activeNode);

  const nodeSegments = buildSegments(laidOutNodes, node => node.primarySliceId || model.slice.id, model.colorMap, model.sliceById);
  const edgeSegments = buildSegments(laidOutEdges, edge => {
    const sourceSlice = edge.sourceNode?.primarySliceId;
    const targetSlice = edge.targetNode?.primarySliceId;
    return sourceSlice === model.slice.id ? targetSlice : sourceSlice || targetSlice;
  }, model.colorMap, model.sliceById);
  const inSegments = buildContextSegments(contextEdges, "in", model.slice.id, model.colorMap, model.sliceById);
  const outSegments = buildContextSegments(contextEdges, "out", model.slice.id, model.colorMap, model.sliceById);
  const freeGraphFlowSegments = buildFreeGraphFlowSegments(laidOutEdges, model);
  const topSegments = freeGraph
    ? (freeGraphFlowSegments.incoming.total > 0 ? freeGraphFlowSegments.incoming : nodeSegments)
    : (inSegments.total > 0 ? inSegments : nodeSegments);
  const bottomSegments = freeGraph
    ? (freeGraphFlowSegments.outgoing.total > 0 ? freeGraphFlowSegments.outgoing : edgeSegments)
    : (outSegments.total > 0 ? outSegments : edgeSegments);
  const leftContext = buildContext(model.contextEdges, years, "in", model.slice.id, model.sliceById);
  const rightContext = buildContext(model.contextEdges, years, "out", model.slice.id, model.sliceById);

  return {
    width,
    height,
    viewport,
    freeGraph,
    minYear,
    maxYear,
    years,
    yScale,
    nodes: laidOutNodes,
    edges: laidOutEdges,
    contextEdges,
    topSegments,
    bottomSegments,
    leftContext,
    rightContext,
    virtualLayerPlan: freeGraphLayerPlan,
    virtualLayers: freeGraphLayerPlan?.layers || [],
    layerCount: freeGraphLayerPlan?.layerCount || 0,
  };
}

function showTooltip(tooltip, html, x, y) {
  tooltip.innerHTML = html;
  tooltip.style.left = `${x + 12}px`;
  tooltip.style.top = `${y + 12}px`;
  tooltip.classList.add("is-visible");
}

function hideTooltip(tooltip) {
  tooltip.classList.remove("is-visible");
}

function cleanupLegacyD3Tips() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".d3-tip").forEach(node => node.remove());
}

function tooltipLine(label, value) {
  if (value === undefined || value === null || value === "") return "";
  return `<div><strong>${label}</strong> ${formatValue(value)}</div>`;
}

function directionLabel(direction) {
  return direction === "in" || direction === "left" || direction === "top" || direction === "l" ? "Influx" : "Efflux";
}

function clearContextSliceHighlight(svg) {
  svg.querySelectorAll(".gp-scroll-context-edge.is-context-highlight").forEach(edge => {
    edge.classList.remove("is-context-highlight");
  });
}

function highlightContextSlice(svg, sliceId, direction) {
  clearContextSliceHighlight(svg);
  const normalizedDirection = direction === "left" || direction === "top" ? "in" : direction === "right" || direction === "bottom" ? "out" : direction;
  svg.querySelectorAll(".gp-scroll-context-edge").forEach(edge => {
    if (edge.dataset.contextSliceId === stringId(sliceId) && (!normalizedDirection || edge.dataset.direction === normalizedDirection)) {
      edge.classList.add("is-context-highlight");
    }
  });
}

function drawScrollBar(group, layout, segments, options = {}) {
  const {x, y, width, height, placement} = options;
  const total = Math.max(1, segments.total);
  let cursor = x;

  const track = createSvgElement("rect", {
    class: "gp-scroll-bar-track",
    x,
    y,
    width,
    height,
    rx: 3,
  });
  group.appendChild(track);

  let defs = group.querySelector("defs");
  if (!defs) {
    defs = createSvgElement("defs");
    group.appendChild(defs);
  }

  segments.rows.forEach((segment, index) => {
    const segmentWidth = width * (segment.count / total);
    const gradientId = `${options.gradientPrefix || "gp-scroll-bar"}-${placement}-${index}`;
    const gradient = createSvgElement("linearGradient", {
      id: gradientId,
      x1: "0%",
      x2: "0%",
      y1: "0%",
      y2: "100%",
    });
    [
      ["0%", segment.color],
      ["50%", "#ffffff"],
      ["100%", segment.color],
    ].forEach(([offset, color]) => {
      gradient.appendChild(createSvgElement("stop", {
        offset,
        "stop-color": color,
        "stop-opacity": 1,
      }));
    });
    defs.appendChild(gradient);

    const rect = createSvgElement("rect", {
      class: `gp-scroll-bar-segment segment-${placement}`,
      x: cursor,
      y,
      width: Math.max(1, segmentWidth),
      height,
      fill: `url(#${gradientId})`,
    });
    rect.dataset.sliceId = segment.sliceId;
    rect.dataset.placement = placement;
    const title = createSvgElement("title");
    title.textContent = `${directionLabel(placement)} ${segment.label}: ${segment.count}`;
    rect.appendChild(title);
    if (options.tooltip) {
      const dirLabel = directionLabel(placement);
      const tooltipHtml = `<span>${dirLabel} ${escapeHtml(segment.label)}: ${formatValue(segment.count, options)}</span>`;
      rect.addEventListener("mouseenter", event => {
        rect.classList.add("is-active");
        showTooltip(options.tooltip, tooltipHtml, event.clientX, event.clientY);
        highlightContextSlice(rect.ownerSVGElement, segment.sliceId, placement);
        if (typeof options.onSegmentHover === "function") {
          options.onSegmentHover(segment, {placement});
        }
      });
      rect.addEventListener("mousemove", event => {
        showTooltip(options.tooltip, tooltipHtml, event.clientX, event.clientY);
      });
      rect.addEventListener("mouseleave", () => {
        rect.classList.remove("is-active");
        clearContextSliceHighlight(rect.ownerSVGElement);
        hideTooltip(options.tooltip);
        if (typeof options.onSegmentHover === "function") options.onSegmentHover(null, {placement});
      });
      rect.addEventListener("click", event => {
        event.stopPropagation();
        rect.classList.add("is-active");
        if (typeof options.onSegmentSelect === "function") {
          options.onSegmentSelect(segment, {placement, direction: placement === "top" ? "in" : "out"});
        } else if (typeof options.onSelect === "function") {
          options.onSelect(segment, {type: "segment", segment, placement, direction: placement === "top" ? "in" : "out"});
        }
      });
    }
    group.appendChild(rect);

    if (segmentWidth > 28) {
      const count = createSvgElement("text", {
        class: "gp-scroll-bar-count",
        x: cursor + segmentWidth / 2,
        y: y + height / 2 + 5,
        "text-anchor": "middle",
      });
      setText(count, segment.count);
      group.appendChild(count);
    }

    cursor += segmentWidth;
  });

  const handleHeight = height * 2.2;
  const handleWidth = height * 0.68;
  const wingWidth = height * 2.9;
  const centerY = y + height / 2;
  const leftWing = createSvgElement("path", {
    class: "gp-scroll-handle-wing",
    d: `M ${x - handleWidth} ${centerY - handleHeight * 0.25}
        C ${x - wingWidth} ${centerY - handleHeight * 0.46}, ${x - wingWidth} ${centerY + handleHeight * 0.46}, ${x - handleWidth} ${centerY + handleHeight * 0.25}
        Z`,
  });
  const rightWing = createSvgElement("path", {
    class: "gp-scroll-handle-wing",
    d: `M ${x + width + handleWidth} ${centerY - handleHeight * 0.25}
        C ${x + width + wingWidth} ${centerY - handleHeight * 0.46}, ${x + width + wingWidth} ${centerY + handleHeight * 0.46}, ${x + width + handleWidth} ${centerY + handleHeight * 0.25}
        Z`,
  });
  const leftHandle = createSvgElement("rect", {
    class: "gp-scroll-handle-core",
    x: x - handleWidth,
    y: centerY - handleHeight / 2,
    width: handleWidth,
    height: handleHeight,
    rx: 4,
  });
  const rightHandle = createSvgElement("rect", {
    class: "gp-scroll-handle-core",
    x: x + width,
    y: centerY - handleHeight / 2,
    width: handleWidth,
    height: handleHeight,
    rx: 4,
  });
  group.appendChild(leftWing);
  group.appendChild(rightWing);
  group.appendChild(leftHandle);
  group.appendChild(rightHandle);
}

function cssClassToken(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function appendLegacyLinearGradient(defs, id, stops, attrs = {}) {
  const gradient = createSvgElement("linearGradient", {
    id,
    x1: attrs.x1 || "0%",
    x2: attrs.x2 || "0%",
    y1: attrs.y1 || "0%",
    y2: attrs.y2 || "100%",
  });
  stops.forEach(stop => {
    gradient.appendChild(createSvgElement("stop", {
      offset: stop.offset,
      style: `stop-color:${stop.color};stop-opacity:${stop.opacity ?? 1}`,
    }));
  });
  defs.appendChild(gradient);
  return gradient;
}

function legacyScrollbarRows(segments = {}, dir = "l") {
  const rows = asArray(segments.rows)
    .filter(row => toNumber(row.count, 0) > 0)
    .sort((a, b) =>
      toNumber(b.count, 0) - toNumber(a.count, 0)
      || stringId(a.sliceId).localeCompare(stringId(b.sliceId))
    );
  return dir === "l" ? rows.reverse() : rows;
}

function drawLegacyStyleScrollBar(group, segments, options = {}) {
  const dir = options.dir || (options.placement === "bottom" ? "r" : "l");
  const rows = legacyScrollbarRows(segments, dir);
  if (rows.length === 0) return;

  const x = toNumber(options.x, 0);
  const y = toNumber(options.y, 0);
  const width = Math.max(1, toNumber(options.width, 1));
  const height = Math.max(1, toNumber(options.height, 1));
  const baseHeight = Math.max(height, toNumber(options.baseHeight, height));
  const totalSize = rows.reduce((sum, row) => sum + toNumber(row.count, 0), 0) || 1;
  const gradientPrefix = options.gradientPrefix || `gp-legacy-scrollbar-${Math.random().toString(36).slice(2, 8)}`;
  let defs = group.querySelector("defs");
  if (!defs) {
    defs = createSvgElement("defs");
    group.appendChild(defs);
  }

  const segmentPositions = [];
  const segmentWidths = [];
  let startX = 0;
  rows.forEach((row, index) => {
    const segmentWidth = width * toNumber(row.count, 0) / totalSize;
    segmentPositions[index] = startX;
    segmentWidths[index] = segmentWidth;
    startX += segmentWidth;
    const color = row.color || getColor(row.sliceId, options.colorMap, "#9ab");
    appendLegacyLinearGradient(defs, `${gradientPrefix}-segment-${dir}-${index}`, [
      {offset: "0%", color},
      {offset: "50%", color: "white"},
      {offset: "100%", color},
    ]);
  });

  appendLegacyLinearGradient(defs, `${gradientPrefix}-leftBar`, [
    {offset: "0%", color: "#8B4513"},
    {offset: "25%", color: "#A0522D"},
    {offset: "50%", color: "#CD853F"},
    {offset: "75%", color: "#A0522D"},
    {offset: "100%", color: "#8B4513"},
  ], {x1: "0%", x2: "100%", y1: "0%", y2: "0%"});
  appendLegacyLinearGradient(defs, `${gradientPrefix}-rightBar`, [
    {offset: "0%", color: "#8B4513"},
    {offset: "25%", color: "#A0522D"},
    {offset: "50%", color: "#CD853F"},
    {offset: "75%", color: "#A0522D"},
    {offset: "100%", color: "#8B4513"},
  ], {x1: "0%", x2: "100%", y1: "0%", y2: "0%"});

  rows.forEach((row, index) => {
    const segmentX = x + segmentPositions[index];
    const segmentWidth = Math.max(0.5, segmentWidths[index]);
    const rect = createSvgElement("rect", {
      class: `scroll-segment${dir} scroll-segment${dir}T${cssClassToken(row.sliceId)} gp-scroll-legacy-axis-segment`,
      x: segmentX,
      y,
      width: segmentWidth,
      height,
      fill: `url(#${gradientPrefix}-segment-${dir}-${index})`,
      opacity: 1,
    });
    rect.dataset.sliceId = row.sliceId;
    rect.dataset.placement = options.placement || (dir === "l" ? "top" : "bottom");
    rect.dataset.direction = dir === "l" ? "in" : "out";
    rect.appendChild(setText(createSvgElement("title"), `${row.label || row.sliceId}: ${row.count}`));

    const tooltipHtml = `<span>${directionLabel(dir)} ${escapeHtml(row.label || row.sliceId)}: ${formatValue(row.count)}</span>`;
    rect.addEventListener("mouseenter", event => {
      rect.setAttribute("opacity", "0.8");
      if (options.tooltip) showTooltip(options.tooltip, tooltipHtml, event.clientX, event.clientY);
      highlightContextSlice(rect.ownerSVGElement, row.sliceId, rect.dataset.direction);
      if (typeof options.onSegmentHover === "function") options.onSegmentHover(row, {placement: rect.dataset.placement, direction: rect.dataset.direction});
    });
    rect.addEventListener("mousemove", event => {
      if (options.tooltip) showTooltip(options.tooltip, tooltipHtml, event.clientX, event.clientY);
    });
    rect.addEventListener("mouseleave", () => {
      rect.setAttribute("opacity", "1");
      clearContextSliceHighlight(rect.ownerSVGElement);
      if (options.tooltip) hideTooltip(options.tooltip);
      if (typeof options.onSegmentHover === "function") options.onSegmentHover(null, {placement: rect.dataset.placement, direction: rect.dataset.direction});
    });
    rect.addEventListener("click", event => {
      event.stopPropagation();
      const context = {
        placement: rect.dataset.placement,
        direction: rect.dataset.direction,
      };
      if (typeof options.onSegmentSelect === "function") {
        options.onSegmentSelect(row, context);
      } else if (typeof options.onSelect === "function") {
        options.onSelect(row, {type: "segment", segment: row, ...context});
      }
    });
    group.appendChild(rect);
  });

  rows.forEach((row, index) => {
    const count = createSvgElement("text", {
      class: `scroll-count${dir} gp-scroll-legacy-axis-count`,
      x: x + segmentPositions[index] + segmentWidths[index] / 2,
      y: y + height / 2,
      "text-anchor": "middle",
      "alignment-baseline": "middle",
      "font-family": "Archivo Narrow",
      "font-size": height,
      opacity: 0.7,
      fill: "black",
      dy: 5,
      "pointer-events": "none",
    });
    setText(count, toNumber(row.count, 0) === 1 ? "" : row.count);
    group.appendChild(count);
  });

  rows.forEach((row, index) => {
    if (toNumber(row.count, 0) <= totalSize / 15) return;
    const labelX = x + segmentPositions[index] + segmentWidths[index] / 2;
    const labelY = y + height / 2 + (dir === "l" ? -height : height) * 1.5;
    const label = createSvgElement("text", {
      class: `scroll-label${dir} gp-scroll-legacy-axis-label`,
      x: labelX,
      y: labelY,
      transform: `rotate(${dir === "l" ? -15 : 15}, ${labelX}, ${y + height / 2 + (dir === "l" ? -height : height)})`,
      "text-anchor": "middle",
      "alignment-baseline": "middle",
      "font-family": "Archivo Narrow",
      "font-size": height,
      opacity: 0.7,
      fill: "black",
      dy: 5,
      "pointer-events": "none",
      style: "display: none",
    });
    setText(label, row.label || row.sliceId);
    group.appendChild(label);
  });

  const barWidth = width / 5;
  const endBarWidth = barWidth / 5;
  const endBarHeight = baseHeight * 2;
  const triangleHeight = baseHeight * 1.5;
  const radius = triangleHeight / 3;
  const rectRadius = Math.min(10, Math.max(4, baseHeight * 0.22));
  const centerHeight = y + height / 2;

  group.appendChild(createSvgElement("path", {
    class: "gp-scroll-legacy-axis-handle gp-scroll-legacy-axis-handle-left",
    d: `
      M${0},${centerHeight - triangleHeight / 2 + radius}
      A${radius},${radius} 0 0 1 ${radius},${centerHeight - triangleHeight / 2}
      L${barWidth},${centerHeight}
      L${radius},${centerHeight + triangleHeight / 2}
      A${radius},${radius} 0 0 1 ${0},${centerHeight + triangleHeight / 2 - radius}
      Z
    `,
    fill: `url(#${gradientPrefix}-leftBar)`,
    transform: `translate(${x - barWidth}, 0)`,
  }));
  group.appendChild(createSvgElement("path", {
    class: "gp-scroll-legacy-axis-handle gp-scroll-legacy-axis-handle-right",
    d: `
      M${width},${centerHeight - triangleHeight / 2 + radius}
      A${radius},${radius} 0 0 0 ${width - radius},${centerHeight - triangleHeight / 2}
      L${width - barWidth},${centerHeight}
      L${width - radius},${centerHeight + triangleHeight / 2}
      A${radius},${radius} 0 0 0 ${width},${centerHeight + triangleHeight / 2 - radius}
      Z
    `,
    fill: `url(#${gradientPrefix}-rightBar)`,
    transform: `translate(${x + barWidth}, 0)`,
  }));
  group.appendChild(createSvgElement("rect", {
    class: "gp-scroll-legacy-axis-handle gp-scroll-legacy-axis-endbar-left",
    x: x - endBarWidth,
    y: centerHeight - endBarHeight / 2,
    width: endBarWidth,
    height: endBarHeight,
    rx: rectRadius,
    ry: rectRadius,
    fill: `url(#${gradientPrefix}-leftBar)`,
  }));
  group.appendChild(createSvgElement("rect", {
    class: "gp-scroll-legacy-axis-handle gp-scroll-legacy-axis-endbar-left-slim",
    x: x - endBarWidth - endBarWidth / 4,
    y: centerHeight - baseHeight / 2,
    width: endBarWidth / 4,
    height: baseHeight,
    rx: rectRadius,
    ry: rectRadius,
    fill: `url(#${gradientPrefix}-leftBar)`,
  }));
  group.appendChild(createSvgElement("rect", {
    class: "gp-scroll-legacy-axis-handle gp-scroll-legacy-axis-endbar-right",
    x: x + width,
    y: centerHeight - endBarHeight / 2,
    width: endBarWidth,
    height: endBarHeight,
    rx: rectRadius,
    ry: rectRadius,
    fill: `url(#${gradientPrefix}-rightBar)`,
  }));
  group.appendChild(createSvgElement("rect", {
    class: "gp-scroll-legacy-axis-handle gp-scroll-legacy-axis-endbar-right-slim",
    x: x + width + endBarWidth,
    y: centerHeight - baseHeight / 2,
    width: endBarWidth / 4,
    height: baseHeight,
    rx: rectRadius,
    ry: rectRadius,
    fill: `url(#${gradientPrefix}-rightBar)`,
  }));
}

function drawFreeGraphFallbackBars(group, layout, model, tooltip, options = {}) {
  const nodeSegments = buildSegments(layout.nodes, node => node.primarySliceId || model.slice.id, model.colorMap, model.sliceById);
  const edgeSegments = buildSegments(layout.edges, edge => {
    const sourceSlice = edge.sourceNode?.primarySliceId;
    const targetSlice = edge.targetNode?.primarySliceId;
    return sourceSlice === model.slice.id ? targetSlice : sourceSlice || targetSlice;
  }, model.colorMap, model.sliceById);
  const flowSegments = buildFreeGraphFlowSegments(layout.edges, model);
  if (nodeSegments.total === 0 && edgeSegments.total === 0 && flowSegments.incoming.total === 0 && flowSegments.outgoing.total === 0) return;

  const bars = createSvgElement("g", {class: "gp-scroll-bars gp-scroll-free-fallback-bars gp-scroll-legacy-axis-bars"});
  const legacyBaseHeight = Math.cbrt(layout.viewport.width * layout.viewport.height) / 2;
  const defaultBarHeight = clamp(legacyBaseHeight, 16, 64);
  const defaultBarGap = clamp(defaultBarHeight * 0.45, 12, 28);
  const barHeight = toNumber(options.scrollBarHeight, defaultBarHeight);
  const barGap = toNumber(options.scrollBarGap, defaultBarGap);
  const axisWidth = layout.viewport.width;
  const topSegments = flowSegments.incoming.total > 0 ? flowSegments.incoming : nodeSegments;
  const bottomSegments = flowSegments.outgoing.total > 0 ? flowSegments.outgoing : edgeSegments;
  drawLegacyStyleScrollBar(bars, topSegments, {
    x: layout.viewport.x,
    y: layout.viewport.y - barGap - barHeight,
    width: axisWidth,
    height: barHeight,
    baseHeight: barHeight,
    placement: "top",
    dir: "l",
    gradientPrefix: `gp-scroll-free-legacy-axis-${Math.random().toString(36).slice(2, 8)}`,
    tooltip,
    colorMap: model.colorMap,
    onSegmentHover: options.onSegmentHover,
    onSegmentSelect: options.onSegmentSelect,
    onSelect: options.onSelect,
  });
  drawLegacyStyleScrollBar(bars, bottomSegments, {
    x: layout.viewport.x,
    y: layout.viewport.y + layout.viewport.height + barGap,
    width: axisWidth,
    height: barHeight,
    baseHeight: barHeight,
    placement: "bottom",
    dir: "r",
    gradientPrefix: `gp-scroll-free-legacy-axis-${Math.random().toString(36).slice(2, 8)}`,
    tooltip,
    colorMap: model.colorMap,
    onSegmentHover: options.onSegmentHover,
    onSegmentSelect: options.onSegmentSelect,
    onSelect: options.onSelect,
  });
  group.appendChild(bars);
}

function drawFreeGraphFallbackFrame(group, layout) {
  const frame = createSvgElement("g", {class: "gp-scroll-frame gp-scroll-free-fallback-frame"});
  frame.appendChild(createSvgElement("rect", {
    class: "gp-scroll-sheet gp-scroll-free-fallback-sheet",
    x: layout.viewport.x,
    y: layout.viewport.y,
    width: layout.viewport.width,
    height: layout.viewport.height,
    "vector-effect": "non-scaling-stroke",
  }));
  group.appendChild(frame);
}

function fitSvgViewBoxToBBox(svg, bbox, options = {}) {
  if (!svg || !bbox || bbox.width <= 0 || bbox.height <= 0) return;
  const marginX = Math.max(36, bbox.width * toNumber(options.freeGraphFallbackViewBoxMarginXRatio, 0.035));
  const marginY = Math.max(30, bbox.height * toNumber(options.freeGraphFallbackViewBoxMarginYRatio, 0.045));
  svg.setAttribute(
    "viewBox",
    `${bbox.x - marginX} ${bbox.y - marginY} ${bbox.width + marginX * 2} ${bbox.height + marginY * 2}`
  );
}

function fitFallbackFreeGraphViewBox(svg, overlay, options = {}) {
  if (!svg || !overlay) return;
  const bars = overlay.querySelector(".gp-scroll-free-fallback-bars");
  const target = bars || overlay;
  try {
    fitSvgViewBoxToBBox(svg, target.getBBox(), options);
  } catch {
    // getBBox can fail while Graphviz is replacing nested SVG content.
  }
}

function drawStream(group, context, layout, model, dir, tooltip, options = {}) {
  const keys = Object.entries(context)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([sliceId]) => sliceId);
  if (keys.length === 0) return;

  const maxTotalAtYear = Math.max(1, ...layout.years.map(year =>
    keys.reduce((sum, key) => sum + (context[key][year] || 0), 0)
  ));
  const maxWidth = Math.min(180, layout.viewport.width * 0.22);
  const sideX = dir === "left" ? layout.viewport.x : layout.viewport.x + layout.viewport.width;
  const sign = dir === "left" ? -1 : 1;
  const baselineByYear = Object.fromEntries(layout.years.map(year => [year, 0]));

  keys.forEach(sliceId => {
    const outerPoints = [];
    const innerPoints = [];
    layout.years.forEach(year => {
      const value = context[sliceId][year] || 0;
      const innerValue = baselineByYear[year];
      const outerValue = innerValue + value;
      const innerX = sideX + sign * (innerValue / maxTotalAtYear) * maxWidth;
      const outerX = sideX + sign * (outerValue / maxTotalAtYear) * maxWidth;
      const y = layout.yScale(year);
      innerPoints.push({x: innerX, y});
      outerPoints.push({x: outerX, y});
      baselineByYear[year] = outerValue;
    });

    const path = createSvgElement("path", {
      class: `gp-scroll-stream gp-scroll-stream-${dir}`,
      d: streamAreaPath(outerPoints, innerPoints),
      fill: getColor(sliceId, model.colorMap),
    });
    path.dataset.sliceId = sliceId;
    path.dataset.direction = dir === "left" ? "in" : "out";
    const sliceName = model.sliceById.get(sliceId)?.shortName || model.sliceById.get(sliceId)?.name || sliceId;
    const title = createSvgElement("title");
    title.textContent = `${directionLabel(dir)} ${sliceName}: ${context[sliceId].total}`;
    path.appendChild(title);
    path.addEventListener("mouseenter", event => {
      path.classList.add("is-active");
      highlightContextSlice(path.ownerSVGElement, sliceId, dir);
      showTooltip(tooltip, `<strong>${sliceName}</strong>${tooltipLine(directionLabel(dir), context[sliceId].total)}`, event.clientX, event.clientY);
      if (typeof options.onStreamHover === "function") options.onStreamHover({sliceId, direction: dir, total: context[sliceId].total, context: context[sliceId]});
    });
    path.addEventListener("mousemove", event => {
      showTooltip(tooltip, `<strong>${sliceName}</strong>${tooltipLine(directionLabel(dir), context[sliceId].total)}`, event.clientX, event.clientY);
    });
    path.addEventListener("mouseleave", () => {
      path.classList.remove("is-active");
      clearContextSliceHighlight(path.ownerSVGElement);
      hideTooltip(tooltip);
      if (typeof options.onStreamHover === "function") options.onStreamHover(null);
    });
    path.addEventListener("click", event => {
      event.stopPropagation();
      if (typeof options.onStreamSelect === "function") {
        options.onStreamSelect({
          sliceId,
          label: sliceName,
          count: context[sliceId].total,
          edges: context[sliceId].edges || [],
        }, {direction: dir === "left" ? "in" : "out"});
      } else if (typeof options.onSelect === "function") {
        options.onSelect({
          sliceId,
          label: sliceName,
          count: context[sliceId].total,
          edges: context[sliceId].edges || [],
        }, {type: "stream", direction: dir === "left" ? "in" : "out"});
      }
    });
    group.appendChild(path);
  });
}

function installGraphvizFreeGraph(content, fallbackGroups, layout, model, options, tooltip) {
  const instancePromise = getGraphvizInstance();
  if (!instancePromise) return false;

  const placeholder = createSvgElement("g", {class: "gp-scroll-graphviz-placeholder"});
  content.appendChild(placeholder);
  const nodeById = new Map(layout.nodes.map(node => [String(node.id), node]));
  const edgeByKey = new Map(layout.edges.map(edge => [`${edge.source}->${edge.target}`, edge]));
  const dot = buildFreeGraphDot(layout, model, options);

  instancePromise
    .then(viz => Promise.resolve(viz.renderSVGElement(dot)))
    .then(graphSvg => {
      if (!content.isConnected || !placeholder.isConnected) return;
      graphSvg.removeAttribute("width");
      graphSvg.removeAttribute("height");
      graphSvg.setAttribute("class", "gp-scroll-graphviz-svg");
      graphSvg.setAttribute("x", layout.viewport.x);
      graphSvg.setAttribute("y", layout.viewport.y);
      graphSvg.setAttribute("width", layout.viewport.width);
      graphSvg.setAttribute("height", layout.viewport.height);
      graphSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      graphSvg.setAttribute("overflow", "hidden");
      graphSvg.style.overflow = "hidden";
      graphSvg.querySelectorAll("g.graph > polygon").forEach(node => {
        const fill = String(node.getAttribute("fill") || "").toLowerCase();
        if (fill === "white" || fill === "#ffffff") node.remove();
      });

      graphSvg.querySelectorAll("g.node").forEach(nodeGroup => {
        const titleNode = nodeGroup.querySelector("title");
        const nodeId = titleNode?.textContent;
        const node = nodeById.get(String(nodeId));
        if (!node) {
          nodeGroup.remove();
          return;
        }
        titleNode?.remove();
        nodeGroup.classList.add("gp-scroll-node", `slice-${node.primarySliceId}`);
        nodeGroup.dataset.nodeId = node.id;
        nodeGroup.style.cursor = "pointer";
        prependNodeHitTarget(nodeGroup, node.radius, options);
        nodeGroup.querySelectorAll("polygon, ellipse, rect").forEach(shape => {
          shape.setAttribute("fill", node.color);
          shape.setAttribute("stroke", node.ringColor || "transparent");
          shape.setAttribute("stroke-width", String(node.ringWidth || 0));
          shape.style.stroke = node.ringColor || "transparent";
          shape.style.strokeWidth = String(node.ringWidth || 0);
          shape.style.paintOrder = "stroke fill markers";
          shape.style.strokeLinejoin = "round";
        });
        nodeGroup.querySelectorAll("text").forEach(text => {
          text.setAttribute("fill", "#111111");
          text.setAttribute("font-family", "Arial, sans-serif");
          text.setAttribute("font-weight", "700");
        });
        nodeGroup.addEventListener("mouseenter", event => {
          nodeGroup.classList.add("is-active");
          showTooltip(tooltip, nodeTooltipHtml(node), event.clientX, event.clientY);
          if (typeof options.onNodeHover === "function") options.onNodeHover(node.raw || node);
        });
        nodeGroup.addEventListener("mousemove", event => {
          showTooltip(tooltip, nodeTooltipHtml(node), event.clientX, event.clientY);
        });
        nodeGroup.addEventListener("mouseleave", () => {
          nodeGroup.classList.remove("is-active");
          hideTooltip(tooltip);
          if (typeof options.onNodeHover === "function") options.onNodeHover(null);
        });
        nodeGroup.addEventListener("click", event => {
          event.stopPropagation();
          highlightScrollSelection(graphSvg, {type: "node", node});
          if (typeof options.onSelect === "function") options.onSelect(node.raw || node, {type: "node", node});
        });
      });

      graphSvg.querySelectorAll("g.edge").forEach(edgeGroup => {
        const titleNode = edgeGroup.querySelector("title");
        const key = titleNode?.textContent?.replace(/\s/g, "");
        const edge = edgeByKey.get(String(key));
        if (!edge) {
          edgeGroup.remove();
          return;
        }
        titleNode?.remove();
        edgeGroup.classList.add("gp-scroll-edge-group");
        edgeGroup.dataset.edgeId = edge.id;
        edgeGroup.dataset.source = edge.source;
        edgeGroup.dataset.target = edge.target;
        edgeGroup.style.cursor = "pointer";
        edgeGroup.querySelectorAll("path").forEach(path => {
          path.classList.add("gp-scroll-edge");
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "#111111");
          path.setAttribute("stroke-opacity", String(originalEdgeOpacity(edge)));
          path.setAttribute("stroke-width", String(originalEdgeWidth(edge)));
          appendEdgeHitTarget(edgeGroup, path, options);
        });
        edgeGroup.querySelectorAll("polygon").forEach(polygon => {
          polygon.setAttribute("fill", "#111111");
          polygon.setAttribute("fill-opacity", String(originalEdgeOpacity(edge)));
          polygon.setAttribute("stroke", "transparent");
        });
        edgeGroup.addEventListener("mouseenter", event => {
          edgeGroup.classList.add("is-active");
          showTooltip(tooltip, edgeTooltipHtml(edge), event.clientX, event.clientY);
          if (typeof options.onEdgeHover === "function") options.onEdgeHover(edge.raw || edge);
        });
        edgeGroup.addEventListener("mousemove", event => {
          showTooltip(tooltip, edgeTooltipHtml(edge), event.clientX, event.clientY);
        });
        edgeGroup.addEventListener("mouseleave", () => {
          edgeGroup.classList.remove("is-active");
          hideTooltip(tooltip);
          if (typeof options.onEdgeHover === "function") options.onEdgeHover(null);
        });
        edgeGroup.addEventListener("click", event => {
          event.stopPropagation();
          highlightScrollSelection(graphSvg, {type: "edge", edge});
          if (typeof options.onSelect === "function") options.onSelect(edge.raw || edge, {type: "edge", edge});
        });
      });

      fallbackGroups.forEach(group => group.remove());
      placeholder.replaceWith(graphSvg);
      if (options.fitFreeGraphFallbackViewBox) {
        fitFallbackFreeGraphViewBox(graphSvg.ownerSVGElement, content, options);
      }
    })
    .catch(error => {
      placeholder.dataset.graphvizFailed = String(error?.message || error || true);
    });

  return true;
}

function installPanZoom(svg, contentGroup) {
  let state = {scale: 1, x: 0, y: 0};
  let drag = null;

  function applyTransform() {
    contentGroup.setAttribute("transform", `translate(${state.x} ${state.y}) scale(${state.scale})`);
  }

  svg.addEventListener("wheel", event => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 1.12 : 0.9;
    state.scale = clamp(state.scale * delta, 0.55, 3.2);
    applyTransform();
  }, {passive: false});

  svg.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    drag = {x: event.clientX, y: event.clientY, startX: state.x, startY: state.y};
    svg.setPointerCapture(event.pointerId);
    svg.classList.add("is-dragging");
  });

  svg.addEventListener("pointermove", event => {
    if (!drag) return;
    state.x = drag.startX + event.clientX - drag.x;
    state.y = drag.startY + event.clientY - drag.y;
    applyTransform();
  });

  svg.addEventListener("pointerup", event => {
    drag = null;
    svg.releasePointerCapture(event.pointerId);
    svg.classList.remove("is-dragging");
  });

  svg.addEventListener("pointercancel", () => {
    drag = null;
    svg.classList.remove("is-dragging");
  });

  return {
    reset() {
      state = {scale: 1, x: 0, y: 0};
      applyTransform();
    },
  };
}

function renderSvg(element, model, options = {}) {
  const layout = layoutScroll(model, options);
  element.classList.toggle("is-free-graph", layout.freeGraph);
  const tooltip = document.createElement("div");
  tooltip.className = "gp-scroll-tooltip";

  const svg = createSvgElement("svg", {
    class: "gp-scroll-svg",
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    role: "img",
    "aria-label": `${model.slice.name} scroll graph`,
  });
  const content = createSvgElement("g", {class: "gp-scroll-content"});
  svg.appendChild(content);

  const defs = createSvgElement("defs");
  defs.innerHTML = `
    <linearGradient id="gp-scroll-handle-gradient" x1="0%" x2="100%" y1="0%" y2="0%">
      <stop offset="0%" stop-color="#8B4513"/>
      <stop offset="50%" stop-color="#CD853F"/>
      <stop offset="100%" stop-color="#8B4513"/>
    </linearGradient>
  `;
  content.appendChild(defs);

  const streams = createSvgElement("g", {class: "gp-scroll-streams"});
  if (!layout.freeGraph && options.showStreams !== false) {
    drawStream(streams, layout.leftContext, layout, model, "left", tooltip, options);
    drawStream(streams, layout.rightContext, layout, model, "right", tooltip, options);
  }
  content.appendChild(streams);

  const bars = createSvgElement("g", {class: "gp-scroll-bars"});
  const barHeight = toNumber(options.scrollBarHeight, 16);
  const barGap = toNumber(options.scrollBarGap, 38);
  const topBarY = layout.viewport.y - barGap - barHeight;
  const bottomBarY = layout.viewport.y + layout.viewport.height + barGap;
  drawScrollBar(bars, layout, layout.topSegments, {
    x: layout.viewport.x,
    y: topBarY,
    width: layout.viewport.width,
    height: barHeight,
    placement: "top",
    gradientPrefix: `gp-scroll-bar-${Math.random().toString(36).slice(2, 8)}`,
    tooltip,
    onSegmentHover: options.onSegmentHover,
    onSegmentSelect: options.onSegmentSelect,
    onSelect: options.onSelect,
  });
  drawScrollBar(bars, layout, layout.bottomSegments, {
    x: layout.viewport.x,
    y: bottomBarY,
    width: layout.viewport.width,
    height: barHeight,
    placement: "bottom",
    gradientPrefix: `gp-scroll-bar-${Math.random().toString(36).slice(2, 8)}`,
    tooltip,
    onSegmentHover: options.onSegmentHover,
    onSegmentSelect: options.onSegmentSelect,
    onSelect: options.onSelect,
  });
  content.appendChild(bars);

  const frame = createSvgElement("g", {class: "gp-scroll-frame"});
  frame.appendChild(createSvgElement("rect", {
    class: "gp-scroll-sheet",
    x: layout.viewport.x,
    y: layout.viewport.y,
    width: layout.viewport.width,
    height: layout.viewport.height,
  }));
  if (!layout.freeGraph) {
    layout.years.forEach(year => {
      const y = layout.yScale(year);
      const isTick = year % toNumber(options.layerGridStep, 2) === 0;
      frame.appendChild(createSvgElement("line", {
        class: isTick ? "gp-scroll-year-line is-tick" : "gp-scroll-year-line",
        x1: layout.viewport.x,
        y1: y,
        x2: layout.viewport.x + layout.viewport.width,
        y2: y,
      }));
      if (isTick) {
        frame.appendChild(setText(createSvgElement("text", {
          class: "gp-scroll-year-label",
          x: layout.viewport.x + layout.viewport.width + 22,
          y: y + 5,
        }), year));
      }
    });
  }
  frame.appendChild(setText(createSvgElement("text", {
    class: "gp-scroll-inner-title",
    x: layout.viewport.x + layout.viewport.width / 2,
    y: layout.viewport.y + 24,
    "text-anchor": "middle",
  }), model.slice.name));
  content.appendChild(frame);

  const contextEdgeGroup = createSvgElement("g", {class: "gp-scroll-context-edges"});
  if (!layout.freeGraph && options.showContextEdges !== false) layout.contextEdges.forEach(edge => {
    const path = createSvgElement("path", {
      class: `gp-scroll-context-edge ${edge.direction === "in" ? "is-inflow" : "is-outflow"}`,
      d: contextEdgePath(edge, layout),
      "stroke-width": clamp(0.65 + edge.weight * 1.7, 0.65, 2.4),
    });
    path.dataset.contextSliceId = edge.contextSliceId;
    path.dataset.direction = edge.direction;
    const sliceName = model.sliceById.get(edge.contextSliceId)?.shortName
      || model.sliceById.get(edge.contextSliceId)?.name
      || edge.contextSliceId;
    const title = createSvgElement("title");
    title.textContent = `${sliceName} ${edge.direction === "in" ? "->" : "<-"} ${edge.activeNode.label}: ${formatValue(edge.weight)}`;
    path.appendChild(title);
    path.addEventListener("mouseenter", event => {
      path.classList.add("is-active");
      showTooltip(
        tooltip,
        `<strong>${sliceName}</strong><br>${edge.activeNode.label}${tooltipLine("year", edge.year)}${tooltipLine("weight", edge.weight)}`,
        event.clientX,
        event.clientY
      );
      if (typeof options.onContextEdgeHover === "function") options.onContextEdgeHover(edge.raw || edge);
    });
    path.addEventListener("mousemove", event => {
      showTooltip(
        tooltip,
        `<strong>${sliceName}</strong><br>${edge.activeNode.label}${tooltipLine("year", edge.year)}${tooltipLine("weight", edge.weight)}`,
        event.clientX,
        event.clientY
      );
    });
    path.addEventListener("mouseleave", () => {
      path.classList.remove("is-active");
      hideTooltip(tooltip);
      if (typeof options.onContextEdgeHover === "function") options.onContextEdgeHover(null);
    });
    contextEdgeGroup.appendChild(path);
  });
  content.appendChild(contextEdgeGroup);

  const edgeGroup = createSvgElement("g", {class: "gp-scroll-edges"});
  layout.edges.forEach(edge => {
    const path = createSvgElement("path", {
      class: "gp-scroll-edge",
      d: layout.freeGraph ? freeEdgePath(edge.sourceNode, edge.targetNode) : edgePath(edge.sourceNode, edge.targetNode),
      stroke: layout.freeGraph ? "#111111" : null,
      "stroke-opacity": layout.freeGraph ? originalEdgeOpacity(edge) : null,
      "stroke-width": layout.freeGraph ? originalEdgeWidth(edge) : clamp(0.7 + edge.weight * 4, 0.7, 3.6),
    });
    path.dataset.edgeId = edge.id;
    path.dataset.source = edge.source;
    path.dataset.target = edge.target;
    if (!layout.freeGraph) {
      const title = createSvgElement("title");
      title.textContent = `${edge.sourceNode.label} -> ${edge.targetNode.label}: ${formatValue(edge.weight)}`;
      path.appendChild(title);
    }
    function handleEnter(event) {
      path.classList.add("is-active");
      showTooltip(tooltip, edgeTooltipHtml(edge), event.clientX, event.clientY);
      if (typeof options.onEdgeHover === "function") options.onEdgeHover(edge.raw || edge);
    }
    function handleMove(event) {
      showTooltip(tooltip, edgeTooltipHtml(edge), event.clientX, event.clientY);
    }
    function handleLeave() {
      path.classList.remove("is-active");
      hideTooltip(tooltip);
      if (typeof options.onEdgeHover === "function") options.onEdgeHover(null);
    }
    function handleClick() {
      highlightScrollSelection(svg, {type: "edge", edge});
      if (typeof options.onSelect === "function") options.onSelect(edge.raw || edge, {type: "edge", edge});
    }
    path.addEventListener("mouseenter", handleEnter);
    path.addEventListener("mousemove", handleMove);
    path.addEventListener("mouseleave", handleLeave);
    path.addEventListener("click", handleClick);
    edgeGroup.appendChild(path);
    if (layout.freeGraph) {
      const hitPath = appendEdgeHitTarget(edgeGroup, path, options);
      hitPath.addEventListener("mouseenter", handleEnter);
      hitPath.addEventListener("mousemove", handleMove);
      hitPath.addEventListener("mouseleave", handleLeave);
      hitPath.addEventListener("click", event => {
        event.stopPropagation();
        handleClick();
      });
    }
  });
  content.appendChild(edgeGroup);

  const nodeGroup = createSvgElement("g", {class: "gp-scroll-nodes"});
  layout.nodes.forEach(node => {
    const group = createSvgElement("g", {
      class: `gp-scroll-node slice-${node.primarySliceId}`,
      transform: `translate(${node.x} ${node.y})`,
    });
    group.dataset.nodeId = node.id;
    const polygon = createSvgElement("polygon", {
      points: hexagonPoints(0, 0, node.radius, layout.freeGraph ? node.radius : node.radius * 0.86),
      fill: node.color,
      stroke: node.ringColor || "transparent",
      "stroke-width": node.ringWidth || 0,
      style: layout.freeGraph ? `stroke: ${node.ringColor || "transparent"}; stroke-width: ${node.ringWidth || 0}px; paint-order: stroke fill markers; stroke-linejoin: round;` : null,
    });
    const label = createSvgElement("text", {
      class: "gp-scroll-node-label",
      y: layout.freeGraph ? node.radius * 0.34 : 3.8,
      "text-anchor": "middle",
      "font-size": layout.freeGraph ? node.labelSize : null,
      style: layout.freeGraph ? `font-size: ${node.labelSize}px` : null,
    });
    setText(label, formatValue(node.impact, {precision: 0}));
    if (layout.freeGraph) prependNodeHitTarget(group, node.radius, options);
    group.appendChild(polygon);
    group.appendChild(label);
    if (!layout.freeGraph) {
      const title = createSvgElement("title");
      title.textContent = node.label;
      group.appendChild(title);
    }
    group.addEventListener("mouseenter", event => {
      group.classList.add("is-active");
      showTooltip(tooltip, nodeTooltipHtml(node), event.clientX, event.clientY);
      if (typeof options.onNodeHover === "function") options.onNodeHover(node.raw || node);
    });
    group.addEventListener("mousemove", event => {
      showTooltip(tooltip, nodeTooltipHtml(node), event.clientX, event.clientY);
    });
    group.addEventListener("mouseleave", () => {
      group.classList.remove("is-active");
      hideTooltip(tooltip);
      if (typeof options.onNodeHover === "function") options.onNodeHover(null);
    });
    group.addEventListener("click", () => {
      highlightScrollSelection(svg, {type: "node", node});
      if (typeof options.onSelect === "function") options.onSelect(node.raw || node, {type: "node", node});
    });
    nodeGroup.appendChild(group);
  });
  content.appendChild(nodeGroup);

  if (layout.freeGraph && options.freeGraphEngine === "graphviz") {
    installGraphvizFreeGraph(content, [edgeGroup, nodeGroup], layout, model, options, tooltip);
  }

  const zoom = options.enableZoom === false ? null : installPanZoom(svg, content);

  element.appendChild(svg);
  element.appendChild(tooltip);

  return {
    model,
    layout,
    svg,
    resetView: () => zoom?.reset(),
  };
}

function legacyGraphViewport(graph, options = {}) {
  const bbox = graph?.bbox || graph?.g?.node?.()?.getBBox?.();
  if (!bbox) return null;
  const marginX = Math.max(28, bbox.width * toNumber(options.freeGraphLegacyMarginXRatio, 0.045));
  const marginY = Math.max(34, bbox.height * toNumber(options.freeGraphLegacyMarginYRatio, 0.055));
  let x = bbox.x + marginX;
  let y = bbox.y + marginY;
  let width = Math.max(1, bbox.width - marginX * 2);
  let height = Math.max(1, bbox.height - marginY * 2);

  if (options.constrainFreeGraphViewportAspect) {
    const targetAspect = toNumber(options.freeGraphAspect, 1.45);
    const aspect = width / Math.max(1, height);
    if (targetAspect > 0 && aspect < targetAspect * 0.72) {
      const nextHeight = width / targetAspect;
      y += (height - nextHeight) / 2;
      height = nextHeight;
    } else if (targetAspect > 0 && aspect > targetAspect * 1.45) {
      const nextWidth = height * targetAspect;
      x += (width - nextWidth) / 2;
      width = nextWidth;
    }
  }

  return {
    x,
    y,
    width,
    height,
  };
}

function buildFreeGraphOverlayLayout(model, graph, options = {}) {
  const viewport = legacyGraphViewport(graph, options);
  if (!viewport) return null;
  const layoutOptions = {
    ...options,
    freeGraphLayerPaddingX: toNumber(options.freeGraphLayerPaddingX, Math.max(36, viewport.width * 0.035)),
    freeGraphLayerPaddingY: toNumber(options.freeGraphLayerPaddingY, Math.max(34, viewport.height * 0.045)),
  };
  const virtualLayerPlan = computeFreeGraphLayerPlan(model.nodes, model.edges, layoutOptions);
  const positions = computeLayeredGraphPositions(model.nodes, model.edges, viewport, {
    ...layoutOptions,
    freeGraphLayerPlan: virtualLayerPlan,
  });
  const activeColor = model.slice.color || getColor(model.slice.id, model.colorMap);
  const nodes = model.nodes.map(node => {
    const position = positions.get(node.id) || {
      x: viewport.x + viewport.width / 2,
      y: viewport.y + viewport.height / 2,
    };
    const ownColor = getColor(node.primarySliceId, model.colorMap, activeColor);
    const isAccentSlice = stringId(node.primarySliceId) && stringId(node.primarySliceId) !== stringId(model.slice.id);
    const radius = originalNodeRadius(node, options);
    return {
      ...node,
      x: clamp(position.x, viewport.x + 18, viewport.x + viewport.width - 18),
      y: clamp(position.y, viewport.y + 18, viewport.y + viewport.height - 18),
      radius,
      labelSize: clamp(originalNodeTextSize(node) * toNumber(options.freeGraphNodeLabelScale, 0.55), 10, 30),
      color: activeColor,
      ringColor: isAccentSlice ? ownColor : "transparent",
      ringWidth: isAccentSlice ? clamp(radius * 0.42, 3.2, 8) : 0,
    };
  });
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const edges = [...model.edges]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, toNumber(options.maxEdges, 260))
    .map(edge => ({
      ...edge,
      sourceNode: nodeById.get(edge.source),
      targetNode: nodeById.get(edge.target),
    }))
    .filter(edge => edge.sourceNode && edge.targetNode);

  return {
    viewport,
    nodes,
    edges,
    freeGraph: true,
    virtualLayerPlan,
    virtualLayers: virtualLayerPlan.layers,
    layerCount: virtualLayerPlan.layerCount,
  };
}

function hideLegacyFreeGraphContent(element) {
  element.querySelectorAll(".entity-node, .text1, .myArea, .egroup-context, .tick").forEach(node => {
    node.style.display = "none";
  });
  element.querySelectorAll(".egroup").forEach(group => {
    group.style.display = "none";
  });
}

function hideLegacyFreeGraphChrome(mainGroup) {
  if (!mainGroup) return;
  [...mainGroup.children].forEach(child => {
    child.style.display = "none";
  });
}

function renderFreeGraphOverlay(element, model, graph, options = {}) {
  const svg = element.querySelector("svg");
  const hasLegacyBars = Boolean(element.querySelector(".scroll-segmentl, .scroll-segmentr"));
  const useUnifiedChrome = options.freeGraphChrome === "unified";
  const shouldDrawFallbackChrome = useUnifiedChrome || !hasLegacyBars;
  const layout = buildFreeGraphOverlayLayout(model, graph, {
    ...options,
    constrainFreeGraphViewportAspect: options.constrainFreeGraphViewportAspect ?? shouldDrawFallbackChrome,
  });
  const mainGroup = graph?.g?.node?.() || svg?.querySelector("#maingroup");
  if (!layout || !svg || !mainGroup) return null;

  const tooltip = element.querySelector(".gp-scroll-tooltip") || document.createElement("div");
  if (!tooltip.isConnected) {
    tooltip.className = "gp-scroll-tooltip";
    element.appendChild(tooltip);
  }

  const overlay = createSvgElement("g", {class: "gp-scroll-free-overlay"});
  const shouldFitFallbackChrome = Boolean(options.reuseLegacyChrome) && shouldDrawFallbackChrome;
  if (useUnifiedChrome) {
    hideLegacyFreeGraphChrome(mainGroup);
  }
  if (shouldDrawFallbackChrome) {
    element.querySelectorAll("#background").forEach(node => {
      node.style.display = "none";
    });
    drawFreeGraphFallbackFrame(overlay, layout);
    drawFreeGraphFallbackBars(overlay, layout, model, tooltip, options);
  }
  const edgeGroup = createSvgElement("g", {class: "gp-scroll-edges"});
  layout.edges.forEach(edge => {
    const path = createSvgElement("path", {
      class: "gp-scroll-edge",
      d: freeEdgePath(edge.sourceNode, edge.targetNode),
      stroke: "#111111",
      "stroke-opacity": originalEdgeOpacity(edge),
      "stroke-width": originalEdgeWidth(edge),
    });
    path.dataset.edgeId = edge.id;
    path.dataset.source = edge.source;
    path.dataset.target = edge.target;
    function handleEnter(event) {
      path.classList.add("is-active");
      showTooltip(tooltip, edgeTooltipHtml(edge), event.clientX, event.clientY);
      if (typeof options.onEdgeHover === "function") options.onEdgeHover(edge.raw || edge);
    }
    function handleMove(event) {
      showTooltip(tooltip, edgeTooltipHtml(edge), event.clientX, event.clientY);
    }
    function handleLeave() {
      path.classList.remove("is-active");
      hideTooltip(tooltip);
      if (typeof options.onEdgeHover === "function") options.onEdgeHover(null);
    }
    function handleClick(event) {
      event.stopPropagation();
      highlightScrollSelection(svg, {type: "edge", edge});
      if (typeof options.onSelect === "function") options.onSelect(edge.raw || edge, {type: "edge", edge});
    }
    path.addEventListener("mouseenter", handleEnter);
    path.addEventListener("mousemove", handleMove);
    path.addEventListener("mouseleave", handleLeave);
    path.addEventListener("click", handleClick);
    edgeGroup.appendChild(path);
    const hitPath = appendEdgeHitTarget(edgeGroup, path, options);
    hitPath.addEventListener("mouseenter", handleEnter);
    hitPath.addEventListener("mousemove", handleMove);
    hitPath.addEventListener("mouseleave", handleLeave);
    hitPath.addEventListener("click", handleClick);
  });
  overlay.appendChild(edgeGroup);

  const nodeGroup = createSvgElement("g", {class: "gp-scroll-nodes"});
  layout.nodes.forEach(node => {
    const group = createSvgElement("g", {
      class: `gp-scroll-node slice-${node.primarySliceId}`,
      transform: `translate(${node.x} ${node.y})`,
    });
    group.dataset.nodeId = node.id;
    prependNodeHitTarget(group, node.radius, options);
    group.appendChild(createSvgElement("polygon", {
      points: hexagonPoints(0, 0, node.radius, node.radius),
      fill: node.color,
      stroke: node.ringColor || "transparent",
      "stroke-width": node.ringWidth || 0,
      style: `stroke: ${node.ringColor || "transparent"}; stroke-width: ${node.ringWidth || 0}px; paint-order: stroke fill markers; stroke-linejoin: round;`,
    }));
    group.appendChild(setText(createSvgElement("text", {
      class: "gp-scroll-node-label",
      y: node.radius * 0.34,
      "text-anchor": "middle",
      "font-size": node.labelSize,
      style: `font-size: ${node.labelSize}px`,
    }), formatValue(node.impact, {precision: 0})));
    group.addEventListener("mouseenter", event => {
      group.classList.add("is-active");
      showTooltip(tooltip, nodeTooltipHtml(node), event.clientX, event.clientY);
      if (typeof options.onNodeHover === "function") options.onNodeHover(node.raw || node);
    });
    group.addEventListener("mousemove", event => {
      showTooltip(tooltip, nodeTooltipHtml(node), event.clientX, event.clientY);
    });
    group.addEventListener("mouseleave", () => {
      group.classList.remove("is-active");
      hideTooltip(tooltip);
      if (typeof options.onNodeHover === "function") options.onNodeHover(null);
    });
    group.addEventListener("click", event => {
      event.stopPropagation();
      highlightScrollSelection(svg, {type: "node", node});
      if (typeof options.onSelect === "function") options.onSelect(node.raw || node, {type: "node", node});
    });
    nodeGroup.appendChild(group);
  });
  overlay.appendChild(nodeGroup);
  mainGroup.appendChild(overlay);
  if (shouldFitFallbackChrome) {
    fitFallbackFreeGraphViewBox(svg, overlay, options);
  }
  if (layout.freeGraph && options.freeGraphEngine === "graphviz") {
    installGraphvizFreeGraph(overlay, [edgeGroup, nodeGroup], layout, model, {
      ...options,
      fitFreeGraphFallbackViewBox: shouldFitFallbackChrome,
    }, tooltip);
  }

  return {
    layout,
    overlay,
    svg,
  };
}

function renderLegacyChromeFreeGraph(element, data, options = {}) {
  const useUnifiedChrome = options.freeGraphChrome === "unified";
  const chromeInput = options.legacyChromeModel || options.chromeModel || data;
  const chromeModel = buildTimeLayeredGraph(chromeInput, {
    ...options,
    layoutMode: options.legacyChromeLayoutMode || "layered-time",
    scrollRenderer: options.legacyChromeRenderer || "layered-scroll",
  }) || chromeInput;
  if (!isLegacyScrollModel(chromeModel)) return null;
  const legacyResult = renderPrismVizSvg(element, chromeModel, {
    ...options,
    layoutMode: options.legacyChromeLayoutMode || "layered-time",
    scrollRenderer: options.legacyChromeRenderer || "layered-scroll",
    withContext: useUnifiedChrome ? true : options.withContext !== false,
    showStreams: useUnifiedChrome ? false : options.showStreams !== false,
    showContextBars: true,
    activateVisType: options.activateVisType,
    restoreState: options.restoreState,
  });
  if (!legacyResult?.graph) return null;

  const model = normalizeScrollData(data, options);
  const chromeContextModel = normalizeScrollData(chromeModel, options);
  if (chromeContextModel.contextEdges.length > 0) {
    model.contextEdges = chromeContextModel.contextEdges;
  }
  model.legacyCombinedContextEdges = legacyResult.graph?.combinedContextEdges || null;
  hideLegacyFreeGraphContent(element);
  const overlayResult = renderFreeGraphOverlay(element, model, legacyResult.graph, options);
  if (!overlayResult) return null;

  element.classList.add("is-free-graph", "gp-scroll-legacy-free");
  return {
    ...legacyResult,
    ...overlayResult,
    model,
    legacyChrome: true,
  };
}

function buildTimeLayeredGraph(data, options = {}) {
  const scrollModel = data?.legacyModel || data?.scrollModel || data;
  if (isLegacyScrollModel(scrollModel)) return scrollModel;

  const api = getPrismVizApi(options);
  if (typeof api?.buildScrollModelFromComponentModel === "function") {
    return api.buildScrollModelFromComponentModel(data, options);
  }

  return null;
}

function getLegacySliceMap(scrollModel, options = {}) {
  const slices = asArray(options.slices || scrollModel?.slices || scrollModel?.scroll?.slices);
  return new Map(slices.map(slice => [stringId(slice.id ?? slice.sliceId), slice]));
}

function getLegacySliceLabel(sliceMap, sliceId) {
  const slice = sliceMap.get(stringId(sliceId));
  return slice?.shortName || slice?.name || stringId(sliceId);
}

function getLegacyClassSliceId(element, prefix) {
  return [...element.classList]
    .find(className => className.startsWith(prefix))
    ?.slice(prefix.length) || "";
}

function legacySelectorById(id) {
  const value = stringId(id);
  return value.indexOf("->") ? `e${value.replace("->", "_")}` : `n${value}`;
}

function buildLegacySegmentMeta(element, scrollModel, options = {}) {
  const sliceMap = getLegacySliceMap(scrollModel, options);
  const meta = new Map();
  ["l", "r"].forEach(dir => {
    const segments = [...element.querySelectorAll(`.scroll-segment${dir}`)];
    const counts = [...element.querySelectorAll(`.scroll-count${dir}`)];
    segments.forEach((segment, index) => {
      const sliceId = getLegacyClassSliceId(segment, `scroll-segment${dir}T`);
      if (!sliceId) return;
      const countText = counts[index]?.textContent?.trim();
      const count = toNumber(countText, 1);
      meta.set(`${dir}:${sliceId}`, {
        sliceId,
        label: getLegacySliceLabel(sliceMap, sliceId),
        count,
        dir,
        direction: dir === "l" ? "in" : "out",
      });
    });
  });
  return meta;
}

function buildLegacyContextEdgeMeta(scrollModel = {}) {
  const graph = scrollModel?.graph || {};
  const nodeById = new Map(asArray(graph.nodes).map(node => [stringId(node.id), node]));
  const activeSliceId = stringId(scrollModel?.slice?.id ?? graph.slice?.id ?? graph.sliceId);
  const edgeIdsByKey = new Map();

  legacyContextEdgesToArray(graph.contextEdges, nodeById, activeSliceId).forEach(edge => {
    const contextSliceId = stringId(edge.contextSliceId);
    const year = Math.round(toNumber(edge.year, 0));
    const activeNodeId = edge.direction === "in" ? stringId(edge.target) : stringId(edge.source);
    if (!contextSliceId || !year || !activeNodeId) return;

    const key = `${edge.direction}:${contextSliceId}`;
    if (!edgeIdsByKey.has(key)) edgeIdsByKey.set(key, new Set());
    const ids = edgeIdsByKey.get(key);
    if (edge.contextKey) ids.add(legacySelectorById(edge.contextKey));
    if (edge.direction === "in") {
      ids.add(`el${year}_${activeNodeId}`);
      ids.add(`e${activeNodeId}_l${year}`);
    } else {
      ids.add(`er${year}_${activeNodeId}`);
      ids.add(`e${activeNodeId}_r${year}`);
    }
  });

  return edgeIdsByKey;
}

function postProcessLegacyScroll(element, scrollModel, options = {}) {
  element.querySelectorAll(".scroll-labell, .scroll-labelr").forEach(node => {
    node.style.display = "none";
  });

  const tooltip = document.createElement("div");
  tooltip.className = "gp-scroll-tooltip";
  element.appendChild(tooltip);
  const segmentMeta = buildLegacySegmentMeta(element, scrollModel, options);
  const contextEdgeMeta = buildLegacyContextEdgeMeta(scrollModel);
  const graph = scrollModel?.graph || {};
  const nodeById = new Map(asArray(graph.nodes).map(node => [stringId(node.id), node]));
  const edgeByName = new Map(asArray(graph.edges).map(edge => [stringId(edge.name || `${edge.source}->${edge.target}`), edge]));
  const contextEdgeByKey = new Map();
  Object.entries(graph.contextEdges || {}).forEach(([key, value]) => {
    const rows = Array.isArray(value) ? value : asArray(value?.edges);
    if (rows.length > 0) contextEdgeByKey.set(stringId(key), rows);
  });

  function clearLegacyContextHighlight() {
    element.querySelectorAll(".gp-legacy-context-highlight").forEach(node => {
      node.classList.remove("gp-legacy-context-highlight");
    });
  }

  function highlightLegacyContext(meta) {
    clearLegacyContextHighlight();
    if (!meta) return;
    const ids = contextEdgeMeta.get(`${meta.direction}:${meta.sliceId}`);
    if (!ids || ids.size === 0) return;
    element.querySelectorAll(".epath").forEach(path => {
      if (!ids.has(path.id)) return;
      path.classList.add("gp-legacy-context-highlight");
      path.closest(".egroup-context")?.classList.add("gp-legacy-context-highlight");
    });
  }

  function dismissLegacyFloatingUi() {
    hideTooltip(tooltip);
    clearLegacyContextHighlight();
    element.querySelectorAll(".gp-legacy-flux-active").forEach(node => {
      node.classList.remove("gp-legacy-flux-active");
    });
    document.querySelectorAll(".d3-tip").forEach(node => {
      node.style.opacity = "0";
      node.style.removeProperty("display");
    });
    const d3Api = globalThis.d3;
    d3Api?.selectAll?.(".entityIcon, .egroup-context-slice").remove();
    d3Api?.selectAll?.(".myArea").style("opacity", 1).style("stroke", "none");
    d3Api?.selectAll?.(".scroll-segmentl, .scroll-segmentr").style("opacity", 1);
  }

  function bindLegacyFlux(elementNode, meta, type) {
    if (!meta || elementNode.dataset.gpFluxBound === "true") return;
    elementNode.dataset.gpFluxBound = "true";
    const html = `<span>${directionLabel(meta.dir)} ${escapeHtml(meta.label)}: ${formatValue(meta.count)}</span>`;
    elementNode.addEventListener("mouseenter", event => {
      elementNode.classList.add("gp-legacy-flux-active");
      highlightLegacyContext(meta);
      showTooltip(tooltip, html, event.clientX, event.clientY);
    });
    elementNode.addEventListener("mousemove", event => {
      showTooltip(tooltip, html, event.clientX, event.clientY);
    });
    elementNode.addEventListener("mouseleave", () => {
      elementNode.classList.remove("gp-legacy-flux-active");
      clearLegacyContextHighlight();
      hideTooltip(tooltip);
    });
    elementNode.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      dismissLegacyFloatingUi();
      const payload = {
        type,
        sliceId: meta.sliceId,
        label: meta.label,
        count: meta.count,
        direction: meta.direction,
      };
      if (type === "stream" && typeof options.onStreamSelect === "function") options.onStreamSelect(payload, payload);
      if (type === "segment" && typeof options.onSegmentSelect === "function") options.onSegmentSelect(payload, payload);
      if (
        typeof options.onSelect === "function"
        && !(type === "stream" && typeof options.onStreamSelect === "function")
        && !(type === "segment" && typeof options.onSegmentSelect === "function")
      ) {
        options.onSelect(payload, {type, ...payload});
      }
    }, {capture: true});
  }

  element.querySelectorAll(".entity-node").forEach(nodeElement => {
    const datum = nodeElement.__data__;
    const node = datum || nodeById.get(stringId(nodeElement.id));
    if (!node || nodeElement.dataset.gpListBound === "true") return;
    nodeElement.dataset.gpListBound = "true";
    nodeElement.addEventListener("click", () => {
      if (typeof options.onSelect === "function") options.onSelect(node, {type: "node", node});
    });
  });

  element.querySelectorAll(".egroup").forEach(edgeElement => {
    const datum = edgeElement.__data__;
    const edge = datum || edgeByName.get(edgeElement.querySelector("path")?.id);
    if (!edge || edgeElement.dataset.gpListBound === "true") return;
    edgeElement.dataset.gpListBound = "true";
    edgeElement.addEventListener("click", () => {
      if (typeof options.onSelect === "function") options.onSelect(edge, {type: "edge", edge});
    });
  });

  element.querySelectorAll(".egroup-context").forEach(edgeElement => {
    const contextKey = stringId(edgeElement.__data__);
    const edgeRows = contextEdgeByKey.get(contextKey) || [];
    const edge = edgeRows[0];
    if (!edge || edgeElement.dataset.gpListBound === "true") return;
    edgeElement.dataset.gpListBound = "true";
    edgeElement.addEventListener("click", () => {
      if (typeof options.onSelect !== "function") return;
      const detailEdge = {
        ...edge,
        sourceNode: nodeById.get(stringId(edge.source)) || null,
        targetNode: nodeById.get(stringId(edge.target)) || null,
        contextKey,
        contextEdges: edgeRows,
      };
      options.onSelect(detailEdge.raw || detailEdge, {type: "edge", edge: detailEdge});
    }, {capture: true});
  });

  element.querySelectorAll(".scroll-segmentl, .scroll-segmentr").forEach(segment => {
    const dir = segment.classList.contains("scroll-segmentl") ? "l" : "r";
    const sliceId = getLegacyClassSliceId(segment, `scroll-segment${dir}T`);
    bindLegacyFlux(segment, segmentMeta.get(`${dir}:${sliceId}`), "segment");
  });

  element.querySelectorAll(".myAreal, .myArear").forEach(stream => {
    const dir = stream.classList.contains("myAreal") ? "l" : "r";
    const sliceId = getLegacyClassSliceId(stream, `myArea${dir}T`);
    bindLegacyFlux(stream, segmentMeta.get(`${dir}:${sliceId}`), "stream");
  });
}

function renderPrismVizSvg(element, data, options = {}) {
  const api = getPrismVizApi(options);
  if (!api?.renderScrollPanel) return null;

  const scrollModel = buildTimeLayeredGraph(data, options);
  if (!scrollModel?.graph) return null;

  element.innerHTML = "";
  element.classList.add("gp-scroll", "gp-scroll-prismviz");
  const elementId = ensureElementId(element, "gp-scroll-prismviz");
  const legacyOptions = {
    withContext: options.withContext !== false,
    showStreams: options.showStreams !== false,
    showContextBars: options.showContextBars !== false,
    layoutMode: options.layoutMode || scrollModel.layoutMode || "layered-time",
    scrollRenderer: options.scrollRenderer || scrollModel.scrollRenderer || "layered-scroll",
    activateVisType: options.activateVisType === true,
    restoreState: options.restoreState === true,
    allowFullsize: options.allowFullsize !== false,
    ...(options.legacyOptions || {}),
  };
  const graph = api.renderScrollPanel(elementId, scrollModel, legacyOptions);
  const svg = element.querySelector("svg");
  postProcessLegacyScroll(element, scrollModel, options);

  return {
    model: scrollModel,
    graph,
    svg,
    legacy: true,
    resetView() {},
  };
}

function createScrollInteractionApi(element) {
  function highlightContextSlice(sliceId, direction = null) {
    const activeId = stringId(sliceId);
    element.querySelectorAll(".gp-scroll-context-edge.is-context-highlight").forEach(edge => {
      edge.classList.remove("is-context-highlight");
    });
    element.querySelectorAll(".gp-scroll-context-edge").forEach(edge => {
      const matchesSlice = edge.dataset.sliceId === activeId
        || edge.dataset.sourceSliceId === activeId
        || edge.dataset.targetSliceId === activeId;
      const matchesDirection = !direction || edge.dataset.direction === direction;
      edge.classList.toggle("is-context-highlight", matchesSlice && matchesDirection);
    });
    element.querySelectorAll(".gp-scroll-bar-segment").forEach(segment => {
      segment.classList.toggle("is-coordinator-active", segment.dataset.sliceId === activeId);
    });
  }

  return {
    clearHighlight() {
      clearScrollSelection(element);
      element.querySelectorAll(".is-context-highlight, .is-coordinator-active").forEach(node => {
        node.classList.remove("is-context-highlight", "is-coordinator-active");
      });
    },
    highlightEntity(entityId) {
      highlightScrollSelection(element, {type: "node", node: {id: entityId}});
    },
    highlightRelation(relation = {}) {
      highlightScrollSelection(element, {
        type: "edge",
        edge: {
          id: relation.id || relation.relationId,
          source: relation.source || relation.sourceId,
          target: relation.target || relation.targetId,
        },
      });
    },
    highlightContextSlice,
  };
}

export function renderScroll(container, data, options = {}) {
  const element = resolveElement(container);
  if (!element) throw new Error("Scroll container not found.");
  cleanupLegacyD3Tips();
  element.innerHTML = "";
  element.classList.add("gp-scroll");

  const requestedLayoutMode = options.layoutMode || data?.layoutMode || data?.scroll?.layoutMode;
  const freeGraphRequested = isFreeGraphLayout(requestedLayoutMode);
  if (freeGraphRequested && options.reuseLegacyChrome !== false) {
    const legacyFreeResult = renderLegacyChromeFreeGraph(element, data, options);
    if (legacyFreeResult) {
      return {
        ...legacyFreeResult,
        ...createScrollInteractionApi(element),
        update(nextData, nextOptions = {}) {
          return renderScroll(element, nextData, {...options, ...nextOptions});
        },
        destroy() {
          element.innerHTML = "";
          element.classList.remove("gp-scroll", "gp-scroll-prismviz", "is-free-graph", "gp-scroll-legacy-free");
        },
      };
    }
  }

  const preferLegacy = options.engine !== "svg" && options.preferLegacy !== false;
  if (preferLegacy && (isLegacyScrollModel(data) || isTimeLayeredLayout(requestedLayoutMode))) {
    const legacyResult = renderPrismVizSvg(element, data, options);
    if (legacyResult) {
      return {
        ...legacyResult,
        ...createScrollInteractionApi(element),
        update(nextData, nextOptions = {}) {
          return renderScroll(element, nextData, {...options, ...nextOptions});
        },
        destroy() {
          element.innerHTML = "";
          element.classList.remove("gp-scroll", "gp-scroll-prismviz");
          element.classList.remove("is-free-graph");
        },
      };
    }
  }

  const model = normalizeScrollData(data, options);
  const result = renderSvg(element, model, options);

  return {
    ...result,
    ...createScrollInteractionApi(element),
    update(nextData, nextOptions = {}) {
      return renderScroll(element, nextData, {...options, ...nextOptions});
    },
    destroy() {
      element.innerHTML = "";
      element.classList.remove("gp-scroll");
      element.classList.remove("is-free-graph");
    },
  };
}

export const Scroll = {
  render: renderScroll,
};
