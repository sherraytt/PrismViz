export function stringId(value) {
  return value == null ? "" : String(value);
}

export function getDefaultSliceId(model = {}) {
  return stringId(model.slices?.[0]?.id) || null;
}

export function getSlice(model = {}, sliceId) {
  const key = stringId(sliceId);
  return (model.slices || []).find(slice => stringId(slice.id) === key) || null;
}

export function getEntity(model = {}, entityId) {
  const key = stringId(entityId);
  return (model.entities || []).find(entity => stringId(entity.id) === key) || null;
}

export function getRelation(model = {}, relationId) {
  const key = stringId(relationId);
  if (!key) return null;

  const relations = model.relations || [];
  const byId = relations.find(relation => stringId(relation.id) === key);
  if (byId) return byId;

  const byPair = relations.find(relation => stringId(relation.pairKey) === key);
  if (byPair) return byPair;

  const byAggregationSource = relations.find(relation => relation.relationIds?.includes(key));
  if (byAggregationSource) return byAggregationSource;

  if (key.includes("->")) {
    const [source, target] = key.split("->");
    return getRelationByPair(model, source, target);
  }

  return null;
}

export function getRelationByPair(model = {}, sourceId, targetId) {
  const source = stringId(sourceId);
  const target = stringId(targetId);
  return (model.relations || []).find(relation =>
    stringId(relation.source) === source && stringId(relation.target) === target
  ) || null;
}

export function getScrollModel(model = {}, sliceId, options = {}) {
  if (typeof options.resolveScrollModel === "function") {
    return options.resolveScrollModel(model, sliceId, options);
  }
  const key = stringId(sliceId) || getDefaultSliceId(model);
  return model.scrollBySliceId?.[key] || null;
}

export function getEntityRelations(model = {}, entityId) {
  const key = stringId(entityId);
  return (model.relations || []).filter(relation =>
    stringId(relation.source) === key || stringId(relation.target) === key
  );
}

function entitySliceId(model, entityId) {
  return stringId(getEntity(model, entityId)?.primarySliceId);
}

export function getSliceRelations(model = {}, sourceSliceId, targetSliceId) {
  const sourceKey = stringId(sourceSliceId);
  const targetKey = stringId(targetSliceId);
  if (!sourceKey || !targetKey) return [];
  return (model.relations || []).filter(relation => {
    const source = stringId(relation.sourceSliceId) || entitySliceId(model, relation.source);
    const target = stringId(relation.targetSliceId) || entitySliceId(model, relation.target);
    return source === sourceKey && target === targetKey;
  });
}

export function getContextRelations(model = {}, activeSliceId, contextSliceId, direction = null) {
  const activeKey = stringId(activeSliceId);
  const contextKey = stringId(contextSliceId);
  const graph = model.scrollBySliceId?.[activeKey]?.graph;
  const contextEdges = graph?.contextEdges || [];
  if (contextEdges.length > 0) {
    return contextEdges.filter(edge => {
      const source = stringId(edge.sourceSliceId) || entitySliceId(model, edge.source);
      const target = stringId(edge.targetSliceId) || entitySliceId(model, edge.target);
      const matchesContext = source === contextKey || target === contextKey;
      const matchesDirection = !direction
        || direction === edge.direction
        || (direction === "top" && target === activeKey)
        || (direction === "bottom" && source === activeKey)
        || (direction === "in" && target === activeKey)
        || (direction === "out" && source === activeKey);
      return matchesContext && matchesDirection;
    });
  }
  return [
    ...getSliceRelations(model, activeKey, contextKey),
    ...getSliceRelations(model, contextKey, activeKey),
  ];
}
