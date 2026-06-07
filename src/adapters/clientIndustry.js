import {buildComponentModels} from "../core/index.js";
import {
  createDetailRows,
  getDisplayInfo as getModelDisplayInfo,
} from "../detail/detail.js";

export const DEFAULT_MAX_SLICE_NODES = 300;

export function normalizeClientIndustryInput(input = {}, options = {}) {
  const config = {
    ...(input.config || input.componentOptions || {}),
    remove_isolated: String(options.removeIsolated ?? input.config?.remove_isolated ?? input.componentOptions?.remove_isolated ?? "0"),
  };

  return {
    normalized: true,
    slices: input.slices || input.sliceDefinitions || [],
    hierarchy: input.hierarchy || input.sliceHierarchy || [],
    entities: input.entities || input.nodes || [],
    relations: input.relations || input.edges || [],
    config,
    displayInfo: input.displayInfo || {},
    original: input,
  };
}

export function buildClientIndustryModels(input = {}, options = {}) {
  const raw = normalizeClientIndustryInput(input, options);
  const model = buildComponentModels(raw, {
    sliceThreshold: options.sliceThreshold ?? 0,
    tree: {useHierarchy: true, ...(options.tree || {})},
    ...(options.model || {}),
  });

  return {
    ...model,
    clientRaw: raw,
    displayInfo: model.displayInfo || raw.displayInfo,
  };
}

export function getNodeSliceWeight(node = {}, sliceId) {
  const key = String(sliceId);
  const weights = node.sliceWeights || node.weights || {};
  if (Object.prototype.hasOwnProperty.call(weights, key)) return Number(weights[key]) || 0;
  return String(node.primarySliceId) === key ? 1 : 0;
}

function buildDegree(edges = []) {
  const degree = new Map();
  edges.forEach(edge => {
    degree.set(String(edge.source), (degree.get(String(edge.source)) || 0) + 1);
    degree.set(String(edge.target), (degree.get(String(edge.target)) || 0) + 1);
  });
  return degree;
}

function scoreNodeForSlice(node, sliceId, degree) {
  const weight = getNodeSliceWeight(node, sliceId);
  const primaryBonus = String(node.primarySliceId) === String(sliceId) ? 1 : 0;
  const impact = Number(node.impact ?? node.value ?? 0) || 0;
  return primaryBonus * 1000000000
    + weight * 1000000
    + Math.log1p(Math.max(0, impact)) * 1000
    + (degree.get(String(node.id)) || 0);
}

export function capScrollModelBySliceWeights(model, sliceId, maxNodes = DEFAULT_MAX_SLICE_NODES) {
  const key = String(sliceId || model.slices?.[0]?.id || "");
  const source = model.scrollBySliceId[key] || model.scrollBySliceId[String(model.slices?.[0]?.id)];
  if (!source) return null;

  const graph = source.graph || {};
  const entityById = new Map(model.entities.map(entity => [String(entity.id), entity]));
  const sliceNodes = [...(graph.nodes || graph.entities || [])];
  const sliceNodeIds = new Set(sliceNodes.map(node => String(node.id)));
  const incidentEdges = model.relations.filter(edge =>
    sliceNodeIds.has(String(edge.source)) || sliceNodeIds.has(String(edge.target))
  );
  const candidateIds = new Set(sliceNodeIds);
  incidentEdges.forEach(edge => {
    candidateIds.add(String(edge.source));
    candidateIds.add(String(edge.target));
  });
  const allNodes = [...candidateIds].map(id => entityById.get(id)).filter(Boolean);
  const cap = Math.max(0, Number(maxNodes) || 0);
  const degree = buildDegree(incidentEdges);
  const nodes = cap > 0 && allNodes.length > cap
    ? allNodes
      .map(node => ({node, score: scoreNodeForSlice(node, key, degree)}))
      .sort((a, b) => b.score - a.score || String(a.node.id).localeCompare(String(b.node.id)))
      .slice(0, cap)
      .map(item => item.node)
    : allNodes;
  const nodeIds = new Set(nodes.map(node => String(node.id)));
  const edges = incidentEdges.filter(edge =>
    nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target))
  );
  const selectedEdgeIds = new Set(edges.map(edge => String(edge.id)));
  const contextEdges = incidentEdges.filter(edge =>
    !selectedEdgeIds.has(String(edge.id))
    && (nodeIds.has(String(edge.source)) || nodeIds.has(String(edge.target)))
  );

  return {
    ...source,
    graph: {
      ...graph,
      nodes,
      entities: nodes,
      edges,
      relations: edges,
      contextEdges,
      stats: {
        ...(graph.stats || {}),
        originalNodeCount: allNodes.length,
        originalSliceNodeCount: sliceNodes.length,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        contextEdgeCount: contextEdges.length,
        maxNodes: cap || null,
      },
    },
  };
}

export function getDisplayInfo(model, item = {}) {
  return getModelDisplayInfo(model, item);
}

export function detailRows(model, item = {}, context = {}) {
  return createDetailRows(model, item, context);
}
