const SVG_NS = "http://www.w3.org/2000/svg";
const DEFAULT_ROTATION_DEGREES_PER_SECOND = 22.5;
const DEFAULT_MIN_SCALE = 0.62;
const DEFAULT_MAX_SCALE = 4.8;
const ORIGINAL_MAX_EDGE_OPACITY = 0.8;
let graphvizInstancePromise = null;

function resolveElement(container) {
  if (typeof container === "string") return document.querySelector(container);
  return container;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stringId(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function toNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) element.setAttribute(key, value);
  });
  return element;
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

function degToRad(angle) {
  return angle * Math.PI / 180;
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

function rgbaFromHex(hex, alpha = 1) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex || `rgba(153, 170, 187, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function colorForSlice(sliceId, colorMap = {}, fallback = "#9ab") {
  return colorMap[stringId(sliceId)] || fallback;
}

function splitLabel(label = "") {
  const text = String(label || "");
  if (text.length <= 7) return [text];
  const midpoint = Math.ceil(text.length / 2);
  return [text.slice(0, midpoint), text.slice(midpoint)];
}

function escapeDotString(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\n/g, "\\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getGraphvizInstance() {
  const Viz = globalThis.Viz;
  if (!Viz || typeof Viz.instance !== "function") return null;
  if (!graphvizInstancePromise) graphvizInstancePromise = Viz.instance();
  return graphvizInstancePromise;
}

function normalizeMatrix(matrix = [], sliceCount = 0) {
  return Array.from({length: sliceCount}, (_, rowIndex) =>
    Array.from({length: sliceCount}, (_, columnIndex) => toNumber(matrix[rowIndex]?.[columnIndex], 0))
  );
}

function sumRows(matrix = []) {
  return matrix.map(row => row.reduce((sum, value) => sum + toNumber(value, 0), 0));
}

function sumColumns(matrix = []) {
  return matrix.map((_, columnIndex) =>
    matrix.reduce((sum, row) => sum + toNumber(row[columnIndex], 0), 0)
  );
}

function adjustWeightsLikeOriginal(weights = []) {
  if (weights.length === 0) return [];
  const normalized = weights.map(weight => Math.max(0, toNumber(weight, 0)));
  const total = normalized.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return normalized.map(() => 1);

  const minimalRatio = 1 / normalized.length / 2;
  const satisfiesCondition = alpha => {
    const nextWeights = normalized.map(weight => weight + alpha);
    const nextTotal = nextWeights.reduce((sum, value) => sum + value, 0);
    return nextWeights.every(weight => (weight / nextTotal) > minimalRatio);
  };

  let left = 0;
  let right = Math.max(1000, Math.max(...normalized) * normalized.length);
  while (!satisfiesCondition(right)) right *= 2;
  for (let index = 0; index < 60; index += 1) {
    const mid = (left + right) / 2;
    if (satisfiesCondition(mid)) right = mid;
    else left = mid;
  }

  return normalized.map(weight => weight + left);
}

function normalizePrismData(data = {}, options = {}) {
  const colorMap = data.colorMap || options.colorMap || {};
  const rawSlices = asArray(data.slices || data.chord?.slices || options.slices);
  const slices = rawSlices.map(slice => {
    const id = stringId(slice.id);
    return {
      id,
      name: slice.name || slice.shortName || id,
      shortName: slice.shortName || slice.name || id,
      chordName: slice.chordName || slice.shortName || slice.name || id,
      size: toNumber(slice.size ?? slice.count, 0),
      color: slice.color || colorForSlice(id, colorMap),
      raw: slice,
    };
  });

  const matrix = normalizeMatrix(
    data.chord?.matrix || data.chord?.sliceRelationMatrix || data.matrix || data.sliceRelationMatrix,
    slices.length
  );
  const sliceGraphs = data.sliceGraphs || data.graphs || {};

  return {
    slices,
    matrix,
    sliceGraphs,
    colorMap,
    chord: {
      slices,
      matrix,
      sliceRelationMatrix: matrix,
    },
  };
}

function resolveWeights(model, options = {}) {
  const widthMode = options.widthMode || options.faceWidthMode || "weighted";
  if (widthMode === "equal") {
    return {
      mode: "equal",
      source: "equal",
      weights: model.slices.map(() => 1),
    };
  }

  const outdegree = sumRows(model.matrix);
  const indegree = sumColumns(model.matrix);
  const relationWeights = outdegree.map((value, index) => {
    if (options.weightSource === "relationTotal") return value + indegree[index];
    if (options.weightSource === "size") return toNumber(model.slices[index]?.size, 0);
    return value;
  });
  const hasRelationWeight = relationWeights.some(value => value > 0);
  const baseWeights = hasRelationWeight
    ? relationWeights
    : model.slices.map(slice => Math.max(1, toNumber(slice.size, 1)));

  return {
    mode: "weighted",
    source: hasRelationWeight ? (options.weightSource || "relationOut") : "size",
    weights: adjustWeightsLikeOriginal(baseWeights),
    rawWeights: baseWeights,
  };
}

function buildPrismGeometry(model, options = {}) {
  const radius = toNumber(options.radius, 270);
  const height = toNumber(options.prismHeight, 470);
  const startAngle = toNumber(options.startAngle, 0);
  const weightInfo = resolveWeights(model, options);
  const totalWeight = weightInfo.weights.reduce((sum, value) => sum + value, 0) || 1;
  let currentAngle = startAngle;

  const faces = model.slices.map((slice, index) => {
    const angleSize = weightInfo.weights[index] / totalWeight * 360;
    const start = currentAngle;
    currentAngle += angleSize / 2;
    const theta = weightInfo.weights[index] / totalWeight * 2 * Math.PI;
    const width = 2 * radius * Math.sin(theta / 2);
    const distance = radius * Math.cos(theta / 2);
    const face = {
      slice,
      index,
      width,
      height,
      distance,
      angle: currentAngle,
      startAngle: start,
      endAngle: start + angleSize,
      weight: weightInfo.weights[index],
      rawWeight: weightInfo.rawWeights?.[index] ?? weightInfo.weights[index],
    };
    currentAngle += angleSize / 2;
    return face;
  });

  return {
    radius,
    height,
    capSize: toNumber(options.capSize, radius * 2.02),
    weightInfo,
    faces,
  };
}

function resolvePrismLayoutOptions(element, options = {}) {
  const rect = element.getBoundingClientRect();
  const containerWidth = Math.max(1, rect.width || element.clientWidth || toNumber(options.stageWidth, 960));
  const containerHeight = Math.max(1, rect.height || element.clientHeight || toNumber(options.stageHeight ?? options.height, 660));
  const stageHeight = toNumber(options.stageHeight ?? options.height, Math.max(containerHeight, 660));
  const tagReserve = options.showTags === false ? 0 : toNumber(options.tagReserveHeight, 92);
  const visualHeight = Math.max(260, stageHeight - tagReserve);
  const autoRadius = clamp(Math.min(containerWidth * 0.2, visualHeight * 0.43), 160, 320);
  const autoPrismHeight = clamp(visualHeight * 0.68, 280, 520);
  const radius = options.radius == null ? autoRadius : toNumber(options.radius, autoRadius);
  const prismHeight = options.prismHeight == null ? autoPrismHeight : toNumber(options.prismHeight, autoPrismHeight);
  const capArcThickness = options.capArcThickness == null
    ? clamp(radius * 0.095, 20, 34)
    : toNumber(options.capArcThickness, 24);

  return {
    ...options,
    stageHeight,
    radius,
    prismHeight,
    capArcThickness,
    capSize: options.capSize == null ? radius * 2.02 : toNumber(options.capSize, radius * 2.02),
  };
}

function getGraphForSlice(sliceGraphs = {}, sliceId) {
  return sliceGraphs[stringId(sliceId)] || sliceGraphs[sliceId] || {};
}

function normalizeGraph(graph = {}) {
  const nodes = asArray(graph.nodes || graph.entities);
  const nodeIds = new Set(nodes.map(node => stringId(node.id)));
  const edges = asArray(graph.edges || graph.relations)
    .map(edge => ({
      ...edge,
      source: stringId(edge.source),
      target: stringId(edge.target),
    }))
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return {nodes, edges};
}

function entityImpact(entity) {
  return toNumber(entity.impact ?? entity.value, 0);
}

function entityYear(entity) {
  return toNumber(entity.time ?? entity.layer, null);
}

function nodeShapeName(shape = "hexagon") {
  if (shape === "circle") return "ellipse";
  if (shape === "square" || shape === "rect" || shape === "box") return "box";
  return "hexagon";
}

function prepareMiniGraph(graph, options = {}) {
  const layoutMode = options.faceGraphLayoutMode || options.faceLayoutMode || "time";
  const useFreeLayout = layoutMode === "free" || layoutMode === "topology";
  const degree = new Map(graph.nodes.map(node => [stringId(node.id), 0]));
  graph.edges.forEach(edge => {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  });
  const maxNodes = useFreeLayout
    ? Math.min(toNumber(options.maxFaceNodes, 140), toNumber(options.maxFreeFaceNodes, 96))
    : toNumber(options.maxFaceNodes, 140);
  const maxEdges = toNumber(options.maxFaceEdges, 180);
  const selectedNodes = [...graph.nodes]
    .sort((a, b) => {
      if (!useFreeLayout) return entityImpact(b) - entityImpact(a);
      const aDegree = degree.get(stringId(a.id)) || 0;
      const bDegree = degree.get(stringId(b.id)) || 0;
      return (bDegree > 0) - (aDegree > 0)
        || bDegree - aDegree
        || entityImpact(b) - entityImpact(a)
        || stableHash(a.id) - stableHash(b.id);
    })
    .slice(0, maxNodes);
  const selectedIds = new Set(selectedNodes.map(node => stringId(node.id)));
  const impactById = new Map(selectedNodes.map(node => [stringId(node.id), entityImpact(node)]));
  const degreeById = new Map(selectedNodes.map(node => [stringId(node.id), degree.get(stringId(node.id)) || 0]));
  const selectedEdges = graph.edges
    .filter(edge => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .sort((a, b) => {
      const scoreA = (impactById.get(a.source) || 0)
        + (impactById.get(a.target) || 0)
        + (degreeById.get(a.source) || 0) * 18
        + (degreeById.get(a.target) || 0) * 18
        + edgeProbability(a) * 120;
      const scoreB = (impactById.get(b.source) || 0)
        + (impactById.get(b.target) || 0)
        + (degreeById.get(b.source) || 0) * 18
        + (degreeById.get(b.target) || 0) * 18
        + edgeProbability(b) * 120;
      return scoreB - scoreA;
    })
    .slice(0, maxEdges);

  return {selectedNodes, selectedEdges};
}

function edgeProbability(edge) {
  return toNumber(edge.weight ?? edge.prob ?? edge.value, 0.55);
}

function edgeOpacity(edge) {
  const opacity = clamp((edgeProbability(edge) - 0.3) / (0.8 - 0.3), 0, 1);
  return 0.2 + (ORIGINAL_MAX_EDGE_OPACITY - 0.2) * opacity;
}

function edgeWidth(edge) {
  const opacity = clamp((edgeProbability(edge) - 0.3) / (0.8 - 0.3), 0, 1);
  return 1 + opacity * 3;
}

function edgeLayoutWeight(edge) {
  return Math.max(1, Math.round(clamp(edgeProbability(edge), 0.2, 1) * 8));
}

function originalNodeFontSize(node) {
  const impact = entityImpact(node);
  if (impact < 50) return 15;
  if (impact < 100) return 20;
  return 25;
}

function originalNodeTextSize(node) {
  const impact = entityImpact(node);
  const base = impact < 50 ? 30 : (impact < 100 ? 40 : 50);
  return Math.sqrt(base) * 7;
}

function miniNodeLabelSize(node, options = {}) {
  return clamp(originalNodeTextSize(node) * toNumber(options.faceGraphNodeScale, 0.15), 6, 13);
}

function miniNodeRadius(node, options = {}) {
  return clamp(miniNodeLabelSize(node, options) * 0.82, 4.8, 11.2);
}

function hexagonPoints(cx, cy, radiusX, radiusY = radiusX) {
  return [
    [cx + radiusX, cy],
    [cx + radiusX / 2, cy + radiusY],
    [cx - radiusX / 2, cy + radiusY],
    [cx - radiusX, cy],
    [cx - radiusX / 2, cy - radiusY],
    [cx + radiusX / 2, cy - radiusY],
  ].map(point => point.join(",")).join(" ");
}

function miniEdgePath(source, target) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dy) < 8) {
    const lift = Math.max(12, Math.min(34, Math.abs(dx) * 0.18));
    return `M ${source.x} ${source.y} C ${source.x + dx * 0.25} ${source.y - lift}, ${target.x - dx * 0.25} ${target.y - lift}, ${target.x} ${target.y}`;
  }
  const midY = source.y + dy * 0.52;
  return `M ${source.x} ${source.y} C ${source.x} ${midY}, ${target.x} ${midY}, ${target.x} ${target.y}`;
}

function createMiniGraphPoint(node, face, model, options = {}) {
  return {
    node,
    radius: miniNodeRadius(node, options),
    labelSize: miniNodeLabelSize(node, options),
    color: options.faceGraphColorMode === "node"
      ? colorForSlice(node.primarySliceId ?? node.sliceId ?? face.slice.id, model.colorMap, face.slice.color)
      : face.slice.color || colorForSlice(face.slice.id, model.colorMap),
  };
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

function buildMiniGraphTopology(nodes, edges) {
  const nodeIds = new Set(nodes.map(node => stringId(node.id)));
  const nodeById = new Map(nodes.map(node => [stringId(node.id), node]));
  const adjacency = new Map(nodes.map(node => [stringId(node.id), []]));
  const outgoing = new Map(nodes.map(node => [stringId(node.id), []]));
  const incoming = new Map(nodes.map(node => [stringId(node.id), []]));
  const undirected = new Map(nodes.map(node => [stringId(node.id), new Set()]));
  const degree = new Map(nodes.map(node => [stringId(node.id), 0]));
  const layoutEdges = edges.filter(edge =>
    nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target
  );

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

function miniConnectedComponents(nodes, topology) {
  const components = [];
  const seen = new Set();
  nodes.forEach(node => {
    const rootId = stringId(node.id);
    if (seen.has(rootId)) return;
    const stack = [rootId];
    const component = [];
    seen.add(rootId);
    while (stack.length > 0) {
      const id = stack.pop();
      const item = topology.nodeById.get(id);
      if (item) component.push(item);
      topology.undirected.get(id)?.forEach(nextId => {
        if (seen.has(nextId)) return;
        seen.add(nextId);
        stack.push(nextId);
      });
    }
    components.push(component);
  });
  return components.sort((a, b) => b.length - a.length || stableHash(a[0]?.id) - stableHash(b[0]?.id));
}

function miniComponentDepths(component, topology) {
  const componentIds = new Set(component.map(node => stringId(node.id)));
  const localIndegree = new Map(component.map(node => [stringId(node.id), 0]));
  component.forEach(node => {
    topology.incoming.get(stringId(node.id))?.forEach(parentId => {
      if (componentIds.has(parentId)) {
        localIndegree.set(stringId(node.id), (localIndegree.get(stringId(node.id)) || 0) + 1);
      }
    });
  });

  const layerById = new Map(component.map(node => [stringId(node.id), 0]));
  const queue = component
    .filter(node => (localIndegree.get(stringId(node.id)) || 0) === 0)
    .sort((a, b) =>
      (topology.degree.get(stringId(b.id)) || 0) - (topology.degree.get(stringId(a.id)) || 0)
      || entityImpact(b) - entityImpact(a)
      || stableHash(a.id) - stableHash(b.id)
    )
    .map(node => stringId(node.id));
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
      (topology.degree.get(stringId(b.id)) || 0) - (topology.degree.get(stringId(a.id)) || 0)
      || entityImpact(b) - entityImpact(a)
      || stringId(a.id).localeCompare(stringId(b.id))
    )[0];
    const depth = new Map([[stringId(root.id), 0]]);
    const bfs = [stringId(root.id)];
    while (bfs.length > 0) {
      const id = bfs.shift();
      topology.undirected.get(id)?.forEach(nextId => {
        if (!componentIds.has(nextId) || depth.has(nextId)) return;
        depth.set(nextId, (depth.get(id) || 0) + 1);
        bfs.push(nextId);
      });
    }
    component.forEach(node => {
      const id = stringId(node.id);
      if (!visited.has(id)) layerById.set(id, depth.get(id) || 0);
    });
  }

  return {
    layerById,
    maxDepth: Math.max(1, ...layerById.values()),
  };
}

function interleaveIsolatedNodes(connectedItems, isolatedItems) {
  const ordered = [...connectedItems];
  isolatedItems
    .sort((a, b) => stableHash(a.node.id) - stableHash(b.node.id))
    .forEach(item => {
      const slot = ordered.length === 0
        ? 0
        : stableHash(`slot:${item.node.id}`) % (ordered.length + 1);
      ordered.splice(slot, 0, item);
    });
  return ordered;
}

function computeMiniVirtualLayers(nodes, edges, options = {}) {
  const topology = buildMiniGraphTopology(nodes, edges);
  const components = miniConnectedComponents(nodes, topology);
  const connected = components.filter(component =>
    component.some(node => (topology.degree.get(stringId(node.id)) || 0) > 0)
  );
  const isolatedNodes = nodes.filter(node => (topology.degree.get(stringId(node.id)) || 0) === 0);
  const density = toNumber(options.faceFreeGraphLayerDensity, 1.42);
  const layerCount = clamp(
    Math.round(Math.sqrt(Math.max(1, nodes.length)) * density),
    Math.min(3, Math.max(1, nodes.length)),
    toNumber(options.faceFreeGraphMaxLayers, 16)
  );
  const totalCaps = allocateLayerCounts(nodes.length, layerCount, 1.25);
  const connectedCount = connected.reduce((sum, component) => sum + component.length, 0);
  const connectedCaps = allocateLayerCounts(connectedCount, layerCount, 1.1);
  const layers = Array.from({length: layerCount}, () => []);
  const layerById = new Map();

  const connectedEntries = [];
  connected.forEach((component, componentIndex) => {
    const {layerById: depthById, maxDepth} = miniComponentDepths(component, topology);
    component.forEach(node => {
      const id = stringId(node.id);
      connectedEntries.push({
        node,
        isolated: false,
        componentIndex,
        depthRatio: (depthById.get(id) || 0) / Math.max(1, maxDepth),
        degree: topology.degree.get(id) || 0,
      });
    });
  });
  connectedEntries.sort((a, b) =>
    a.depthRatio - b.depthRatio
    || a.componentIndex - b.componentIndex
    || b.degree - a.degree
    || entityImpact(b.node) - entityImpact(a.node)
    || stableHash(a.node.id) - stableHash(b.node.id)
  );

  let cursor = 0;
  for (let layer = 0; layer < layerCount; layer += 1) {
    const capacity = connectedCaps[layer] || 0;
    for (let index = 0; index < capacity && cursor < connectedEntries.length; index += 1) {
      layers[layer].push(connectedEntries[cursor]);
      layerById.set(stringId(connectedEntries[cursor].node.id), layer);
      cursor += 1;
    }
  }
  while (cursor < connectedEntries.length) {
    const layer = layerCount - 1;
    layers[layer].push(connectedEntries[cursor]);
    layerById.set(stringId(connectedEntries[cursor].node.id), layer);
    cursor += 1;
  }

  const isolatedEntries = isolatedNodes
    .sort((a, b) => stableHash(a.id) - stableHash(b.id))
    .map(node => ({
      node,
      isolated: true,
      componentIndex: -1,
      depthRatio: null,
      degree: 0,
    }));
  let isolatedCursor = 0;
  for (let layer = 0; layer < layerCount; layer += 1) {
    const targetTotal = totalCaps[layer] || layers[layer].length;
    const capacity = Math.max(0, targetTotal - layers[layer].length);
    const isolatedForLayer = isolatedEntries.slice(isolatedCursor, isolatedCursor + capacity);
    isolatedCursor += isolatedForLayer.length;
    layers[layer] = interleaveIsolatedNodes(layers[layer], isolatedForLayer);
    isolatedForLayer.forEach(item => layerById.set(stringId(item.node.id), layer));
  }
  let lowerLayer = layerCount - 1;
  while (isolatedCursor < isolatedEntries.length) {
    const item = isolatedEntries[isolatedCursor];
    layers[lowerLayer] = interleaveIsolatedNodes(layers[lowerLayer], [item]);
    layerById.set(stringId(item.node.id), lowerLayer);
    isolatedCursor += 1;
    lowerLayer = lowerLayer <= 0 ? layerCount - 1 : lowerLayer - 1;
  }

  return {layers, layerById, layerCount, topology};
}

function computeMiniFreeGraphLayout(nodes, edges, face, model, box, options = {}) {
  const points = new Map();
  const {layers, layerCount} = computeMiniVirtualLayers(nodes, edges, options);
  const yTop = box.graphTop + 12;
  const yHeight = Math.max(40, box.graphHeight - 24);
  const layerGap = yHeight / Math.max(1, layerCount - 1);

  layers.forEach((bucket, layer) => {
    bucket.forEach((item, index) => {
      const node = item.node;
      const id = stringId(node.id);
      const point = createMiniGraphPoint(node, face, model, options);
      const ratio = (index + 1) / (bucket.length + 1);
      const jitterX = (((stableHash(`${id}:x`) % 1000) / 999) - 0.5) * Math.min(10, box.graphWidth / Math.max(8, bucket.length + 1));
      const jitterY = (((stableHash(`${id}:y`) % 1000) / 999) - 0.5) * Math.min(5, layerGap * 0.18);
      points.set(id, {
        ...point,
        x: clamp(box.paddingX + box.graphWidth * ratio + jitterX, box.paddingX + 6, box.paddingX + box.graphWidth - 6),
        y: clamp(yTop + layerGap * layer + jitterY, box.graphTop + 8, box.graphTop + box.graphHeight - 8),
      });
    });
  });

  return points;
}

function buildMiniGraphDot(nodes, edges, face, graphWidth, graphHeight, options = {}) {
  const layoutMode = options.faceGraphLayoutMode || options.faceLayoutMode || "time";
  const useFreeLayout = layoutMode === "free" || layoutMode === "topology";
  const useTimeLayout = !useFreeLayout && options.faceGraphTimeRanks !== false;
  const freeLayers = useFreeLayout ? computeMiniVirtualLayers(nodes, edges, options) : null;
  const years = useTimeLayout ? nodes.map(entityYear).filter(Number.isFinite) : [];
  const minYear = years.length ? Math.min(...years) : 1990;
  const maxYear = years.length ? Math.max(...years) : 2024;
  const yearBuckets = new Map();
  if (useTimeLayout) {
    nodes.forEach(node => {
      const year = Number.isFinite(entityYear(node)) ? entityYear(node) : minYear;
      if (!yearBuckets.has(year)) yearBuckets.set(year, []);
      yearBuckets.get(year).push(node);
    });
  }

  const graphWidthInches = Math.max(1.2, graphWidth / 72);
  const graphHeightInches = Math.max(1.2, graphHeight / 72);
  const shape = nodeShapeName(options.nodeShape || "hexagon");
  const lines = [
    "digraph G {",
    "graph [rankdir=TB, outputorder=edgesfirst, bgcolor=\"transparent\", ordering=out]",
    `size="${graphWidthInches},${graphHeightInches}"`,
    "ratio=\"fill\"",
    "margin=0",
    "pad=0",
    "splines=true",
    `ranksep=${useTimeLayout ? "0.42" : "0.34"}`,
    `nodesep=${useTimeLayout ? "0.12" : "0.16"}`,
    `node [shape=${shape}, regular=true, style=filled, fixedsize=false, margin=0.012, fontname="Arial", fontsize=15, color="transparent", penwidth=0]`,
    "edge [arrowsize=0.22, color=\"#111111\", penwidth=1]",
  ];

  if (useTimeLayout) {
    for (let year = minYear; year <= maxYear; year += 1) {
      lines.push(`"year${year}" [label="", shape=point, style=invis, width=0.01, height=0.01]`);
    }
  } else if (useFreeLayout) {
    for (let layer = 0; layer < freeLayers.layerCount; layer += 1) {
      lines.push(`"__rank_${layer}" [label="", shape=point, style=invis, width=0.01, height=0.01]`);
    }
  }

  nodes.forEach(node => {
    const label = String(Math.round(entityImpact(node) || 0));
    const fontSize = originalNodeFontSize(node);
    lines.push(`"${escapeDotString(node.id)}" [label="${escapeDotString(label)}", fontsize=${fontSize}]`);
  });

  if (useTimeLayout) {
    [...yearBuckets.keys()].sort((a, b) => a - b).forEach(year => {
      const ids = yearBuckets.get(year)
        .sort((a, b) => entityImpact(b) - entityImpact(a))
        .map(node => `"${escapeDotString(node.id)}"`);
      lines.push(`{ rank=same "year${year}" ${ids.join(" ")} }`);
    });

    for (let year = minYear; year < maxYear; year += 1) {
      lines.push(`"year${year}" -> "year${year + 1}" [style=invis, weight=1000]`);
    }
  } else if (useFreeLayout) {
    freeLayers.layers.forEach((bucket, layer) => {
      const ids = bucket.map(item => `"${escapeDotString(item.node.id)}"`);
      lines.push(`{ rank=same "__rank_${layer}" ${ids.join(" ")} }`);
    });
    for (let layer = 0; layer < freeLayers.layerCount - 1; layer += 1) {
      lines.push(`"__rank_${layer}" -> "__rank_${layer + 1}" [style=invis, weight=1000]`);
    }
  }

  edges.forEach(edge => {
    lines.push(`"${escapeDotString(edge.source)}" -> "${escapeDotString(edge.target)}" [weight=${edgeLayoutWeight(edge)}]`);
  });
  lines.push("}");
  return lines.join("\n");
}

function stripGraphvizChrome(graphSvg) {
  graphSvg.removeAttribute("width");
  graphSvg.removeAttribute("height");
  graphSvg.querySelectorAll("g.graph > polygon").forEach(node => {
    const fill = String(node.getAttribute("fill") || "").toLowerCase();
    const stroke = String(node.getAttribute("stroke") || "").toLowerCase();
    if (fill === "white" || fill === "#ffffff" || stroke === "transparent") node.remove();
  });
}

function tintGraphvizSvg(graphSvg, face, model, edgesByKey, options = {}) {
  const baseColor = face.slice.color || colorForSlice(face.slice.id, model.colorMap);
  graphSvg.classList.add("gp-prism-face-graph", "gp-prism-face-graphviz");
  graphSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  graphSvg.querySelectorAll("g.node").forEach(nodeGroup => {
    const title = nodeGroup.querySelector("title")?.textContent;
    if (String(title || "").startsWith("year") || String(title || "").startsWith("__rank_")) {
      nodeGroup.remove();
      return;
    }
    const sourceNode = title
      ? asArray(getGraphForSlice(model.sliceGraphs, face.slice.id).nodes || getGraphForSlice(model.sliceGraphs, face.slice.id).entities)
        .find(node => stringId(node.id) === stringId(title))
      : null;
    const color = options.faceGraphColorMode === "node" && sourceNode
      ? colorForSlice(sourceNode.primarySliceId ?? sourceNode.sliceId ?? face.slice.id, model.colorMap, baseColor)
      : baseColor;
    nodeGroup.querySelectorAll("ellipse, polygon, rect").forEach(shape => {
      shape.setAttribute("fill", color);
      shape.setAttribute("fill-opacity", "1");
      shape.setAttribute("stroke", "none");
      shape.setAttribute("stroke-width", "0");
    });
    nodeGroup.querySelectorAll("text").forEach(text => {
      text.setAttribute("fill", "#000000");
      text.setAttribute("font-family", "Archivo Narrow, Arial Narrow, Arial, sans-serif");
      text.setAttribute("font-weight", "700");
      text.setAttribute("font-size", String(Math.max(12, toNumber(text.getAttribute("font-size"), 12))));
      text.setAttribute("stroke", "none");
    });
  });

  graphSvg.querySelectorAll("g.edge").forEach(edgeGroup => {
    const key = edgeGroup.querySelector("title")?.textContent?.replace(/:w|:e/g, "");
    if (String(key || "").includes("year") || String(key || "").includes("__rank_")) {
      edgeGroup.remove();
      return;
    }
    const edge = edgesByKey.get(key);
    if (!edge) {
      edgeGroup.remove();
      return;
    }
    edgeGroup.querySelectorAll("path").forEach(path => {
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#000000");
      path.setAttribute("stroke-opacity", String(edgeOpacity(edge)));
      path.setAttribute("stroke-width", String(edgeWidth(edge)));
    });
    edgeGroup.querySelectorAll("polygon").forEach(polygon => {
      polygon.setAttribute("fill", "#000000");
      polygon.setAttribute("fill-opacity", String(edgeOpacity(edge)));
      polygon.setAttribute("stroke", "none");
    });
  });
}

function renderGraphvizMiniGraph(svg, placeholder, face, model, graphData, box, options = {}) {
  const instancePromise = getGraphvizInstance();
  if (!instancePromise) return false;

  const {selectedNodes, selectedEdges} = graphData;
  const dot = buildMiniGraphDot(selectedNodes, selectedEdges, face, box.graphWidth, box.graphHeight, options);
  const edgesByKey = new Map(selectedEdges.map(edge => [`${edge.source}->${edge.target}`, edge]));

  instancePromise
    .then(viz => Promise.resolve(viz.renderSVGElement(dot)))
    .then(graphSvg => {
      if (!svg.isConnected || !placeholder.isConnected) return;
      stripGraphvizChrome(graphSvg);
      tintGraphvizSvg(graphSvg, face, model, edgesByKey, options);
      graphSvg.setAttribute("x", box.paddingX);
      graphSvg.setAttribute("y", box.graphTop);
      graphSvg.setAttribute("width", box.graphWidth);
      graphSvg.setAttribute("height", box.graphHeight);
      placeholder.replaceWith(graphSvg);
    })
    .catch(() => {
      placeholder.dataset.graphvizFailed = "true";
    });

  return true;
}

function createMiniGraphFallbackGroup(face, model, graphData, box, options = {}) {
  const {selectedNodes, selectedEdges} = graphData;
  const selectedIds = new Set(selectedNodes.map(node => stringId(node.id)));
  const layoutMode = options.faceGraphLayoutMode || options.faceLayoutMode || "time";
  const useTimeLayout = layoutMode !== "free" && layoutMode !== "topology" && options.faceGraphTimeRanks !== false;
  const years = useTimeLayout ? selectedNodes.map(entityYear).filter(Number.isFinite) : [];
  const minYear = years.length ? Math.min(...years) : 1990;
  const maxYear = years.length ? Math.max(...years) : 2024;
  const yScale = scaleLinear([minYear, maxYear], [box.graphTop + 24, box.graphTop + box.graphHeight - 20]);
  const layout = new Map();
  const nodesByBucket = new Map();
  const linked = new Map();

  selectedNodes.forEach(node => {
    if (useTimeLayout) {
      const yearKey = Number.isFinite(entityYear(node)) ? String(entityYear(node)) : "unknown";
      if (!nodesByBucket.has(yearKey)) nodesByBucket.set(yearKey, []);
      nodesByBucket.get(yearKey).push(node);
    }
    linked.set(stringId(node.id), []);
  });
  selectedEdges.forEach(edge => {
    linked.get(edge.source)?.push(edge.target);
    linked.get(edge.target)?.push(edge.source);
  });

  if (!useTimeLayout) {
    computeMiniFreeGraphLayout(selectedNodes, selectedEdges, face, model, box, options)
      .forEach((point, id) => layout.set(id, point));
  } else {
    [...nodesByBucket.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .forEach(([bucketKey, nodesInBucket], bucketIndex, buckets) => {
        const ordered = [...nodesInBucket].sort((a, b) => {
          const linkedA = linked.get(stringId(a.id)) || [];
          const linkedB = linked.get(stringId(b.id)) || [];
          const meanA = linkedA.reduce((sum, id) => sum + stableHash(id), 0) / Math.max(1, linkedA.length);
          const meanB = linkedB.reduce((sum, id) => sum + stableHash(id), 0) / Math.max(1, linkedB.length);
          return meanA - meanB || entityImpact(b) - entityImpact(a);
        });
        ordered.forEach((node, index) => {
          const id = stringId(node.id);
          const hash = stableHash(id);
          const lane = (index + 1) / (ordered.length + 1);
          const jitter = ((hash % 17) - 8) * Math.min(1.5, box.graphWidth / 240);
          const x = box.paddingX + box.graphWidth * (0.08 + lane * 0.84) + jitter;
          const y = Number.isFinite(entityYear(node))
            ? yScale(entityYear(node)) + ((hash >> 5) % 9 - 4) * 0.8
            : box.graphTop + box.graphHeight * (0.08 + (buckets.length === 1 ? 0.5 : bucketIndex / Math.max(1, buckets.length - 1)) * 0.84);
          layout.set(id, {
            ...createMiniGraphPoint(node, face, model, options),
            x,
            y: clamp(y, box.graphTop + 12, box.graphTop + box.graphHeight - 10),
          });
        });
      });
  }

  const group = createSvgElement("g", {
    class: "gp-prism-face-graph",
    "clip-path": `url(#${box.clipId})`,
  });

  selectedEdges.forEach(edge => {
    if (!selectedIds.has(edge.source) || !selectedIds.has(edge.target)) return;
    const source = layout.get(edge.source);
    const target = layout.get(edge.target);
    if (!source || !target) return;
    const path = createSvgElement("path", {
      class: "gp-prism-face-edge",
      d: miniEdgePath(source, target),
      stroke: "#000000",
      "stroke-opacity": edgeOpacity(edge),
      "stroke-width": edgeWidth(edge),
    });
    group.appendChild(path);
  });

  layout.forEach(point => {
    if ((options.nodeShape || "hexagon") === "circle") {
      group.appendChild(createSvgElement("circle", {
        class: "gp-prism-face-node",
        cx: point.x,
        cy: point.y,
        r: point.radius,
        fill: point.color,
      }));
      return;
    }

    group.appendChild(createSvgElement("polygon", {
      class: "gp-prism-face-node",
      points: hexagonPoints(point.x, point.y, point.radius, point.radius),
      fill: point.color,
    }));
    const label = createSvgElement("text", {
      class: "gp-prism-face-node-label",
      x: point.x,
      y: point.y + point.radius * 0.34,
      "text-anchor": "middle",
      "font-size": point.labelSize,
    });
    label.textContent = String(Math.round(entityImpact(point.node) || 0));
    group.appendChild(label);
  });

  return group;
}

function renderMiniGraph(svg, face, model, options = {}) {
  const graph = normalizeGraph(getGraphForSlice(model.sliceGraphs, face.slice.id));
  if (graph.nodes.length === 0) return;

  const graphTop = toNumber(options.faceGraphTop, Math.min(104, face.height * 0.2));
  const paddingX = Math.max(8, face.width * 0.06);
  const graphHeight = Math.max(92, face.height - graphTop - 26);
  const graphWidth = Math.max(44, face.width - paddingX * 2);
  const graphData = prepareMiniGraph(graph, options);
  const clipId = `gp-prism-clip-${face.slice.id}-${face.index}`;
  const defs = createSvgElement("defs");
  const clip = createSvgElement("clipPath", {id: clipId});
  clip.appendChild(createSvgElement("rect", {
    x: paddingX * 0.35,
    y: graphTop,
    width: face.width - paddingX * 0.7,
    height: graphHeight,
    rx: 2,
  }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  const box = {graphTop, paddingX, graphHeight, graphWidth, clipId};
  const fallback = createMiniGraphFallbackGroup(face, model, graphData, box, options);
  svg.appendChild(fallback);
  const layoutMode = options.faceGraphLayoutMode || options.faceLayoutMode || "time";
  const useGraphvizLayout = options.useGraphvizLayout !== false && layoutMode !== "manual";
  if (useGraphvizLayout) {
    renderGraphvizMiniGraph(svg, fallback, face, model, graphData, box, options);
  }
}

function renderFace(object, face, model, options = {}) {
  const baseColor = face.slice.color || colorForSlice(face.slice.id, model.colorMap);
  const fillColor = mixColors(baseColor, "#ffffff", 0.86);
  const renderScale = clamp(toNumber(options.faceRenderScale, 3), 1, 4);
  const faceNode = document.createElement("div");
  faceNode.className = "gp-prism-face";
  faceNode.dataset.sliceId = face.slice.id;
  faceNode.style.width = `${face.width}px`;
  faceNode.style.height = `${face.height}px`;
  faceNode.style.left = `${-face.width / 2}px`;
  faceNode.style.top = `${-face.height / 2}px`;
  faceNode.style.transform = `rotateY(${face.angle}deg) translateZ(${face.distance}px)`;

  const hiResLayer = document.createElement("div");
  hiResLayer.className = "gp-prism-face-hires";
  hiResLayer.style.width = `${face.width * renderScale}px`;
  hiResLayer.style.height = `${face.height * renderScale}px`;
  hiResLayer.style.transform = `scale(${1 / renderScale})`;

  const svg = createSvgElement("svg", {
    class: "gp-prism-face-svg",
    viewBox: `0 0 ${face.width} ${face.height}`,
    role: "img",
    "aria-label": `${face.slice.name} prism face`,
  });

  const rect = createSvgElement("rect", {
    class: "gp-prism-face-rect",
    x: 0,
    y: 0,
    width: face.width,
    height: face.height,
    fill: fillColor,
    stroke: baseColor,
  });
  svg.appendChild(rect);

  const label = createSvgElement("text", {
    class: "gp-prism-face-label",
    x: face.width / 2,
    y: Math.min(50, face.height * 0.115),
    "text-anchor": "middle",
    "dominant-baseline": "middle",
    "font-size": clamp(toNumber(options.faceTitleFontSize, 18), 13, 24),
  });
  const fontSize = toNumber(label.getAttribute("font-size"), 14);
  splitLabel(face.slice.shortName || face.slice.name).forEach((line, index) => {
    const tspan = createSvgElement("tspan", {
      x: face.width / 2,
      dy: index === 0 ? 0 : "1.16em",
    });
    const estimatedLength = Array.from(String(line)).length * fontSize * 0.95;
    if (estimatedLength > face.width * 0.76) {
      tspan.setAttribute("textLength", face.width * 0.76);
      tspan.setAttribute("lengthAdjust", "spacingAndGlyphs");
    }
    tspan.textContent = line;
    label.appendChild(tspan);
  });
  svg.appendChild(label);

  renderMiniGraph(svg, face, model, options);
  hiResLayer.appendChild(svg);
  faceNode.appendChild(hiResLayer);
  object.appendChild(faceNode);
}

function capPoint(angleDeg, radius) {
  const rad = degToRad(angleDeg);
  return {
    x: Math.sin(rad) * radius,
    y: Math.cos(rad) * radius,
  };
}

function normalizeVector(x, y) {
  const length = Math.sqrt(x * x + y * y) || 1;
  return {x: x / length, y: y / length};
}

function buildStraightCapBands(geometry, outerRadius, bandThickness) {
  return geometry.faces.map(face => {
    const outerStart = capPoint(face.startAngle, outerRadius);
    const outerEnd = capPoint(face.endAngle, outerRadius);
    const mid = {
      x: (outerStart.x + outerEnd.x) / 2,
      y: (outerStart.y + outerEnd.y) / 2,
    };
    const inward = normalizeVector(-mid.x, -mid.y);
    const innerStart = {
      x: outerStart.x + inward.x * bandThickness,
      y: outerStart.y + inward.y * bandThickness,
    };
    const innerEnd = {
      x: outerEnd.x + inward.x * bandThickness,
      y: outerEnd.y + inward.y * bandThickness,
    };
    return {
      face,
      outerStart,
      outerEnd,
      innerStart,
      innerEnd,
      startAngle: face.startAngle,
      endAngle: face.endAngle,
      cursorStart: face.startAngle,
      cursorEnd: face.endAngle,
    };
  });
}

function pointOnLine(start, end, ratio) {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

function pointOnBand(band, angle) {
  const ratio = clamp((angle - band.startAngle) / Math.max(0.001, band.endAngle - band.startAngle), 0, 1);
  return pointOnLine(band.innerStart, band.innerEnd, ratio);
}

function pointsToString(points) {
  return points.map(point => `${point.x},${point.y}`).join(" ");
}

function ribbonPath(sourceStart, sourceEnd, targetStart, targetEnd, radius, bands = null, sourceIndex = 0, targetIndex = 0) {
  const sourceBand = bands?.[sourceIndex];
  const targetBand = bands?.[targetIndex];
  const sourceA = sourceBand ? pointOnBand(sourceBand, sourceStart) : capPoint(sourceStart, radius);
  const sourceB = sourceBand ? pointOnBand(sourceBand, sourceEnd) : capPoint(sourceEnd, radius);
  const targetA = targetBand ? pointOnBand(targetBand, targetStart) : capPoint(targetStart, radius);
  const targetB = targetBand ? pointOnBand(targetBand, targetEnd) : capPoint(targetEnd, radius);
  return [
    `M ${sourceA.x} ${sourceA.y}`,
    `L ${sourceB.x} ${sourceB.y}`,
    `Q 0 0 ${targetA.x} ${targetA.y}`,
    `L ${targetB.x} ${targetB.y}`,
    `Q 0 0 ${sourceA.x} ${sourceA.y}`,
    "Z",
  ].join(" ");
}

function renderCapRibbons(svg, parent, model, geometry, innerRadius, options = {}, clipId = null, bands = null) {
  const matrix = model.matrix;
  const cursors = geometry.faces.map(face => ({
    start: face.startAngle,
    end: face.endAngle,
  }));
  const rowSums = sumRows(matrix);
  const defs = createSvgElement("defs");
  const group = createSvgElement("g", {
    class: "gp-prism-cap-ribbons",
    "clip-path": clipId ? `url(#${clipId})` : undefined,
  });

  for (let sourceIndex = 0; sourceIndex < matrix.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < matrix.length; targetIndex += 1) {
      const forward = toNumber(matrix[sourceIndex]?.[targetIndex], 0);
      const backward = toNumber(matrix[targetIndex]?.[sourceIndex], 0);
      if (forward <= 0 && backward <= 0) continue;

      const sourceFace = geometry.faces[sourceIndex];
      const targetFace = geometry.faces[targetIndex];
      const sourceAvailable = Math.max(1, sourceFace.endAngle - sourceFace.startAngle);
      const targetAvailable = Math.max(1, targetFace.endAngle - targetFace.startAngle);
      const sourceSpan = clamp(sourceAvailable * (forward / Math.max(rowSums[sourceIndex], 1)), forward > 0 ? 1.2 : 0.8, sourceAvailable * 0.42);
      const targetSpan = clamp(targetAvailable * (backward / Math.max(rowSums[targetIndex], 1)), backward > 0 ? 1.2 : 0.8, targetAvailable * 0.42);
      const sourceStart = cursors[sourceIndex].start;
      const sourceEnd = Math.min(sourceStart + sourceSpan, sourceFace.endAngle);
      const targetEnd = cursors[targetIndex].end;
      const targetStart = Math.max(targetEnd - targetSpan, targetFace.startAngle);
      cursors[sourceIndex].start = sourceEnd;
      cursors[targetIndex].end = targetStart;

      const gradientId = `gp-prism-cap-gradient-${sourceIndex}-${targetIndex}`;
      const sourcePoint = bands ? pointOnBand(bands[sourceIndex], (sourceStart + sourceEnd) / 2) : capPoint((sourceStart + sourceEnd) / 2, innerRadius);
      const targetPoint = bands ? pointOnBand(bands[targetIndex], (targetStart + targetEnd) / 2) : capPoint((targetStart + targetEnd) / 2, innerRadius);
      const gradient = createSvgElement("linearGradient", {
        id: gradientId,
        gradientUnits: "userSpaceOnUse",
        x1: sourcePoint.x,
        y1: sourcePoint.y,
        x2: targetPoint.x,
        y2: targetPoint.y,
      });
      const sourceColor = model.slices[sourceIndex]?.color || "#9ab";
      const targetColor = model.slices[targetIndex]?.color || "#9ab";
      const start = createSvgElement("stop", {"offset": "0%", "stop-color": sourceColor});
      const end = createSvgElement("stop", {"offset": "100%", "stop-color": targetColor});
      gradient.appendChild(start);
      gradient.appendChild(end);
      defs.appendChild(gradient);

      group.appendChild(createSvgElement("path", {
        class: "gp-prism-cap-ribbon",
        d: ribbonPath(sourceStart, sourceEnd, targetStart, targetEnd, innerRadius - 5, bands, sourceIndex, targetIndex),
        fill: `url(#${gradientId})`,
      }));
    }
  }

  svg.appendChild(defs);
  parent.appendChild(group);
}

function renderCap(object, model, geometry, options = {}, side = "top") {
  if (options.showCaps === false) return null;

  const cap = document.createElement("div");
  cap.className = `gp-prism-cap gp-prism-cap-${side}`;
  cap.style.width = `${geometry.capSize}px`;
  cap.style.height = `${geometry.capSize}px`;
  cap.style.left = `${-geometry.capSize / 2}px`;
  cap.style.top = `${-geometry.capSize / 2}px`;
  const translateY = side === "top" ? -geometry.height / 2 : geometry.height / 2;
  cap.style.transform = `translateY(${translateY}px) rotateX(90deg) rotateZ(${toNumber(options.capRotationZ, 0)}deg)`;

  const outerRadius = geometry.radius;
  const innerRadius = Math.max(10, outerRadius - toNumber(options.capArcThickness, 24));
  const useStraightCap = side === "top" && options.capStyle !== "radial";
  const straightBands = useStraightCap
    ? buildStraightCapBands(geometry, outerRadius, toNumber(options.capArcThickness, 24))
    : null;
  const svg = createSvgElement("svg", {
    class: "gp-prism-cap-svg",
    viewBox: `${-geometry.capSize / 2} ${-geometry.capSize / 2} ${geometry.capSize} ${geometry.capSize}`,
    role: "img",
    "aria-label": `${side} prism cap`,
  });

  const outerPoints = geometry.faces.flatMap(face => [
    capPoint(face.startAngle, outerRadius),
    capPoint(face.endAngle, outerRadius),
  ]);
  const clipId = `gp-prism-cap-clip-${side}-${Math.random().toString(36).slice(2, 9)}`;
  const defs = createSvgElement("defs");
  const clipPath = createSvgElement("clipPath", {id: clipId});
  clipPath.appendChild(createSvgElement("polygon", {points: pointsToString(outerPoints)}));
  defs.appendChild(clipPath);
  svg.appendChild(defs);

  svg.appendChild(createSvgElement("polygon", {
    class: "gp-prism-cap-fill",
    points: pointsToString(outerPoints),
  }));

  const contentGroup = createSvgElement("g", {
    class: "gp-prism-cap-content",
    "clip-path": `url(#${clipId})`,
  });
  svg.appendChild(contentGroup);

  if (side === "bottom") {
    geometry.faces.forEach(face => {
      const color = face.slice.color || colorForSlice(face.slice.id, model.colorMap);
      contentGroup.appendChild(createSvgElement("polygon", {
        class: "gp-prism-cap-wedge",
        points: pointsToString([
          {x: 0, y: 0},
          capPoint(face.startAngle, outerRadius),
          capPoint(face.endAngle, outerRadius),
        ]),
        fill: mixColors(color, "#ffffff", 0.58),
        stroke: rgbaFromHex(color, 0.28),
      }));
    });
  }

  if (side === "top" && options.showCapRibbons !== false) {
    renderCapRibbons(svg, contentGroup, model, geometry, innerRadius, options, clipId, straightBands);
  }

  const arcGroup = createSvgElement("g", {class: "gp-prism-cap-arcs"});
  geometry.faces.forEach(face => {
    const color = face.slice.color || colorForSlice(face.slice.id, model.colorMap);
    const band = straightBands?.[face.index];
    const points = band
      ? [band.innerStart, band.innerEnd, band.outerEnd, band.outerStart]
      : [
        capPoint(face.startAngle, innerRadius),
        capPoint(face.endAngle, innerRadius),
        capPoint(face.endAngle, outerRadius),
        capPoint(face.startAngle, outerRadius),
      ];
    const polygon = createSvgElement("polygon", {
      class: "gp-prism-cap-arc",
      points: pointsToString(points),
      fill: mixColors(color, "#ffffff", side === "top" ? 0.22 : 0.3),
      stroke: color,
    });
    arcGroup.appendChild(polygon);
  });
  contentGroup.appendChild(arcGroup);

  cap.appendChild(svg);
  object.appendChild(cap);

  return {
    destroy() {
      cap.remove();
    },
  };
}

function tagLabel(slice) {
  return slice.shortName || slice.name || slice.id;
}

function renderTags(element, model, geometry, options = {}, handlers = {}) {
  if (options.showTags === false) return;

  const row = document.createElement("div");
  row.className = "gp-prism-tags";
  row.classList.toggle("is-single-row", model.slices.length <= 6);
  if (model.slices.length > 8 && options.balanceTagRows !== false) {
    row.classList.add("is-balanced");
    row.style.gridTemplateColumns = `repeat(${Math.ceil(model.slices.length / 2)}, max-content)`;
  }
  const tooltip = document.createElement("div");
  tooltip.className = "gp-prism-tag-tooltip";
  tooltip.hidden = true;

  const tagFontSize = clamp(toNumber(options.tagFontSize, model.slices.length <= 6 ? 17 : 14), 12, 20);
  const tagMinWidth = toNumber(options.tagMinWidth, 66);
  const tagMaxWidth = options.tagMaxWidth === false || options.tagMaxWidth === "none"
    ? Infinity
    : toNumber(options.tagMaxWidth, model.slices.length <= 6 ? 220 : 156);

  model.slices.forEach((slice, index) => {
    const tag = document.createElement("button");
    tag.type = "button";
    tag.className = "gp-prism-tag";
    tag.dataset.sliceId = slice.id;
    const label = tagLabel(slice);
    const labelWidth = Array.from(String(label)).length * tagFontSize * 0.78 + 20;
    const resolvedWidth = Math.max(tagMinWidth, Math.min(labelWidth, tagMaxWidth));
    tag.style.background = mixColors(slice.color, "#ffffff", 0.34);
    tag.style.borderColor = slice.color;
    tag.style.flexBasis = Number.isFinite(resolvedWidth) ? `${resolvedWidth}px` : "auto";
    tag.style.maxWidth = Number.isFinite(tagMaxWidth) ? `${tagMaxWidth}px` : "none";
    tag.style.fontSize = `${tagFontSize}px`;
    if (options.tagWrap === true) tag.style.whiteSpace = "normal";
    tag.textContent = label;

    tag.addEventListener("mouseenter", event => {
      tooltip.innerHTML = `<strong>${escapeHtml(slice.name || label)}</strong><span>${escapeHtml(toNumber(slice.size, 0))} entities</span>`;
      tooltip.hidden = false;
      moveTagTooltip(element, tooltip, event);
      if (typeof options.onTagHover === "function") options.onTagHover(slice.raw || slice);
    });
    tag.addEventListener("mousemove", event => moveTagTooltip(element, tooltip, event));
    tag.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
      if (typeof options.onTagHover === "function") options.onTagHover(null);
    });
    tag.addEventListener("click", event => {
      event.preventDefault();
      if (options.rotateOnTagClick === true) handlers.rotateToFace?.(index);
      if (typeof options.onTagClick === "function") options.onTagClick(slice.raw || slice, {index});
    });

    row.appendChild(tag);
  });

  element.appendChild(row);
  element.appendChild(tooltip);
}

export function renderPrismSliceTags(container, slices = [], options = {}, handlers = {}) {
  const element = resolveElement(container);
  if (!element) {
    throw new Error("Prism tag container not found.");
  }

  const colorMap = options.colorMap || {};
  const model = {
    slices: asArray(slices).map(slice => {
      const id = stringId(slice.id);
      return {
        id,
        name: slice.name || slice.shortName || id,
        shortName: slice.shortName || slice.name || id,
        size: toNumber(slice.size ?? slice.count, 0),
        color: slice.color || colorForSlice(id, colorMap),
        raw: slice,
      };
    }),
  };

  element.innerHTML = "";
  renderTags(element, model, {faces: []}, {
    ...options,
    showTags: true,
    rotateOnTagClick: false,
    onTagClick: (slice, context) => {
      handlers.onSelect?.(slice, context);
      handlers.onTagClick?.(slice, context);
    },
    onTagHover: slice => {
      handlers.onHover?.(slice);
      handlers.onTagHover?.(slice);
    },
  }, handlers);

  function setActiveSlice(sliceId) {
    const activeId = stringId(sliceId);
    element.querySelectorAll(".gp-prism-tag").forEach(tag => {
      tag.classList.toggle("is-active", tag.dataset.sliceId === activeId);
    });
  }

  setActiveSlice(options.activeSliceId);

  return {
    element,
    setActiveSlice,
    destroy() {
      element.innerHTML = "";
    },
  };
}

function moveTagTooltip(container, tooltip, event) {
  const rect = container.getBoundingClientRect();
  tooltip.style.left = `${event.clientX - rect.left + 12}px`;
  tooltip.style.top = `${event.clientY - rect.top - 42}px`;
}

function createPrismController(element, object, geometry, options = {}) {
  const state = {
    rotationX: toNumber(options.rotationX, -25),
    rotationY: toNumber(options.rotationY, -34),
    translationX: toNumber(options.translationX, 0),
    translationY: toNumber(options.translationY, -28),
    scale: toNumber(options.scale, 1),
    minScale: toNumber(options.minScale, DEFAULT_MIN_SCALE),
    maxScale: toNumber(options.maxScale, DEFAULT_MAX_SCALE),
    dragging: false,
    activeIndex: -2,
    autoRotate: options.autoRotate !== false,
    rotationSpeed: toNumber(options.rotationSpeed, DEFAULT_ROTATION_DEGREES_PER_SECOND),
    animationFrame: null,
    rotateToFrame: null,
    restoreAutoRotate: null,
    lastTime: 0,
    lastPointerX: 0,
    lastPointerY: 0,
  };

  function applyTransform() {
    object.style.transform = `scale(${state.scale}) translate(${state.translationX}px, ${state.translationY}px) rotateX(${state.rotationX}deg) rotateY(${state.rotationY}deg)`;
    syncActiveFace();
  }

  function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function activeFaceIndex() {
    if (Math.abs(state.rotationX) > 80) return -1;
    const activeAngle = normalizeAngle(720 - state.rotationY);
    return geometry.faces.findIndex(face => activeAngle >= face.startAngle && activeAngle <= face.endAngle);
  }

  function syncActiveFace() {
    const nextIndex = activeFaceIndex();
    if (nextIndex === state.activeIndex) return;
    state.activeIndex = nextIndex;
    geometry.faces.forEach((face, index) => {
      const active = index === nextIndex;
      element.querySelectorAll(".gp-prism-face").forEach(node => {
        if (node.dataset.sliceId !== face.slice.id) return;
        node.classList.toggle("is-active", active);
      });
      element.querySelectorAll(".gp-prism-tag").forEach(node => {
        if (node.dataset.sliceId !== face.slice.id) return;
        node.classList.toggle("is-active", active);
      });
    });
    if (typeof options.onActiveSliceChange === "function") {
      const face = geometry.faces[nextIndex];
      options.onActiveSliceChange(face ? (face.slice.raw || face.slice) : null, {index: nextIndex});
    }
  }

  function tick(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    const elapsedSeconds = Math.min((timestamp - state.lastTime) / 1000, 0.08);
    state.lastTime = timestamp;
    if (state.autoRotate && !state.dragging && state.rotationSpeed !== 0 && state.rotateToFrame == null) {
      state.rotationY = (state.rotationY - state.rotationSpeed * elapsedSeconds) % 360;
      applyTransform();
    }
    state.animationFrame = requestAnimationFrame(tick);
  }

  function start() {
    applyTransform();
    if (state.autoRotate && state.animationFrame == null) {
      state.animationFrame = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (state.animationFrame != null) cancelAnimationFrame(state.animationFrame);
    if (state.rotateToFrame != null) cancelAnimationFrame(state.rotateToFrame);
    state.animationFrame = null;
    state.rotateToFrame = null;
  }

  function rotateToFace(index) {
    const face = geometry.faces[index];
    if (!face) return;
    const restoreAutoRotate = state.rotateToFrame != null && state.restoreAutoRotate != null
      ? state.restoreAutoRotate
      : state.autoRotate;
    state.restoreAutoRotate = restoreAutoRotate;
    state.autoRotate = false;
    if (state.rotateToFrame != null) cancelAnimationFrame(state.rotateToFrame);

    let targetAngle = 360 - (face.startAngle + face.endAngle) / 2;
    const startAngle = state.rotationY;
    if (targetAngle - startAngle > 180) targetAngle -= 360;
    else if (startAngle - targetAngle > 180) targetAngle += 360;

    const duration = toNumber(options.rotateToDuration, 700);
    const startTime = performance.now();
    const easeInOut = value => (value < 0.5 ? 2 * value * value : -1 + (4 - 2 * value) * value);
    const animate = currentTime => {
      const progress = clamp((currentTime - startTime) / duration, 0, 1);
      state.rotationY = startAngle + (targetAngle - startAngle) * easeInOut(progress);
      applyTransform();
      if (progress < 1) {
        state.rotateToFrame = requestAnimationFrame(animate);
      } else {
        state.rotateToFrame = null;
        state.autoRotate = Boolean(state.restoreAutoRotate);
        state.restoreAutoRotate = null;
        state.lastTime = 0;
        if (state.autoRotate && state.animationFrame == null) start();
      }
    };
    state.rotateToFrame = requestAnimationFrame(animate);
  }

  function onWheel(event) {
    if (options.enableWheel === false) return;
    event.preventDefault();
    const deltaY = clamp(event.deltaY, -180, 180);
    state.scale *= 0.5 ** (deltaY / 1000);
    state.scale = clamp(state.scale, state.minScale, state.maxScale);
    applyTransform();
  }

  function onPointerDown(event) {
    if (options.enableDrag === false) return;
    if (event.button !== 0) return;
    if (event.target.closest?.(".gp-prism-tag")) return;
    event.preventDefault();
    state.dragging = true;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    element.classList.add("is-dragging");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(event) {
    if (!state.dragging) return;
    const deltaX = event.clientX - state.lastPointerX;
    const deltaY = event.clientY - state.lastPointerY;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    state.rotationY += deltaX / 5;
    state.rotationX = clamp(state.rotationX - deltaY / 5, -80, 80);
    applyTransform();
  }

  function onPointerUp() {
    state.dragging = false;
    element.classList.remove("is-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  element.addEventListener("wheel", onWheel, {passive: false});
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("contextmenu", onContextMenu);

  return {
    state,
    start,
    stop,
    rotateToFace,
    setRotationSpeed(speed) {
      state.rotationSpeed = toNumber(speed, state.rotationSpeed);
    },
    setAutoRotate(value) {
      const nextValue = Boolean(value);
      if (state.rotateToFrame != null) {
        state.restoreAutoRotate = nextValue;
      } else {
        state.autoRotate = nextValue;
      }
      state.lastTime = 0;
      if (nextValue) start();
    },
    isAutoRotate() {
      const desiredAutoRotate = state.rotateToFrame != null && state.restoreAutoRotate != null
        ? state.restoreAutoRotate
        : state.autoRotate;
      return desiredAutoRotate && state.rotationSpeed !== 0;
    },
    getState() {
      const desiredAutoRotate = state.rotateToFrame != null && state.restoreAutoRotate != null
        ? state.restoreAutoRotate
        : state.autoRotate;
      return {
        rotationX: state.rotationX,
        rotationY: state.rotationY,
        translationX: state.translationX,
        translationY: state.translationY,
        scale: state.scale,
        autoRotate: desiredAutoRotate,
        rotationSpeed: state.rotationSpeed,
      };
    },
    setScale(value) {
      state.scale = clamp(toNumber(value, state.scale), state.minScale, state.maxScale);
      applyTransform();
    },
    destroy() {
      stop();
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("contextmenu", onContextMenu);
    },
  };
}

export function renderPrism(container, data = {}, options = {}) {
  const element = resolveElement(container);
  if (!element) {
    throw new Error("Prism container not found.");
  }

  const model = normalizePrismData(data, options);
  const layoutOptions = resolvePrismLayoutOptions(element, options);
  const geometry = buildPrismGeometry(model, layoutOptions);
  const stageHeight = layoutOptions.stageHeight;
  const capInstances = [];

  element.innerHTML = "";
  element.classList.add("gp-prism");
  element.style.minHeight = `${stageHeight}px`;

  const viewport = document.createElement("div");
  viewport.className = "gp-prism-viewport";

  const object = document.createElement("div");
  object.className = "gp-prism-object";
  viewport.appendChild(object);

  geometry.faces.forEach(face => renderFace(object, face, model, layoutOptions));
  const topCap = renderCap(object, model, geometry, layoutOptions, "top");
  const bottomCap = renderCap(object, model, geometry, layoutOptions, "bottom");
  if (topCap) capInstances.push(topCap);
  if (bottomCap) capInstances.push(bottomCap);

  element.appendChild(viewport);
  const controller = createPrismController(element, object, geometry, layoutOptions);
  renderTags(element, model, geometry, layoutOptions, controller);
  controller.start();

  function faceIndexForSlice(sliceId) {
    return geometry.faces.findIndex(face => stringId(face.slice.id) === stringId(sliceId));
  }

  function setActiveSlice(sliceId, setOptions = {}) {
    const activeId = stringId(sliceId);
    element.querySelectorAll(".gp-prism-face, .gp-prism-tag").forEach(node => {
      node.classList.toggle("is-active", node.dataset.sliceId === activeId);
    });
    if (setOptions.rotate !== false) rotateToSlice(activeId);
  }

  function rotateToSlice(sliceId) {
    const index = faceIndexForSlice(sliceId);
    if (index >= 0) controller.rotateToFace(index);
  }

  function highlightSlice(sliceId) {
    const activeId = stringId(sliceId);
    element.querySelectorAll(".gp-prism-face, .gp-prism-tag").forEach(node => {
      node.classList.toggle("is-coordinator-active", node.dataset.sliceId === activeId);
    });
  }

  function clearHighlight() {
    element.querySelectorAll(".gp-prism-face.is-coordinator-active, .gp-prism-tag.is-coordinator-active").forEach(node => {
      node.classList.remove("is-coordinator-active");
    });
  }

  return {
    model,
    geometry,
    controller,
    setActiveSlice,
    rotateToSlice,
    highlightSlice,
    clearHighlight,
    update(nextData, nextOptions = {}) {
      return renderPrism(element, nextData, {...options, ...nextOptions});
    },
    destroy() {
      controller.destroy();
      capInstances.forEach(instance => instance.destroy?.());
      element.innerHTML = "";
      element.classList.remove("gp-prism");
      element.classList.remove("is-dragging");
      element.style.minHeight = "";
    },
  };
}

export const Prism = {
  render: renderPrism,
  renderSliceTags: renderPrismSliceTags,
};
