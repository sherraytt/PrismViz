import {normalizeInput} from "./normalize.js";
import {applySliceColors, getSliceColor} from "./colors.js";

function isEmpty(value) {
  return value === undefined || value === null || value === "";
}

function toNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function getConfigValue(config = {}, key, fallback) {
  return config[key] === undefined ? fallback : config[key];
}

function hasSlice(entity, sliceId, threshold = 0) {
  if (!entity || isEmpty(sliceId)) return false;
  const key = String(sliceId);
  if (!isEmpty(entity.primarySliceId) && String(entity.primarySliceId) === key) return true;
  if (!Object.prototype.hasOwnProperty.call(entity.sliceWeights || {}, key)) return false;
  return toNumber(entity.sliceWeights?.[key], 0) >= threshold;
}

function getSliceCandidates(entity, activeSliceIds, threshold = 0) {
  if (!entity) return [];
  const candidates = new Set();
  if (!isEmpty(entity.primarySliceId)) candidates.add(String(entity.primarySliceId));
  Object.entries(entity.sliceWeights || {}).forEach(([sliceId, weight]) => {
    if (toNumber(weight, 0) >= threshold) candidates.add(String(sliceId));
  });
  return [...candidates].filter(sliceId => activeSliceIds.has(sliceId));
}

function sortBySizeDesc(a, b) {
  return toNumber(b.size, 0) - toNumber(a.size, 0);
}

function buildEntityDegreeMap(entities = [], relations = []) {
  const degree = Object.fromEntries(entities.map(entity => [String(entity.id), 0]));
  relations.forEach(relation => {
    if (Object.prototype.hasOwnProperty.call(degree, String(relation.source))) degree[String(relation.source)] += 1;
    if (Object.prototype.hasOwnProperty.call(degree, String(relation.target))) degree[String(relation.target)] += 1;
  });
  return degree;
}

function getRelationType(relation = {}) {
  return String(relation.relationType || relation.type || "unknown");
}

function normalizeRelationTypesForPair(relations = []) {
  const types = [];
  const typeCounts = {};
  const seenType = new Set();
  relations.forEach(relation => {
    const type = getRelationType(relation);
    if (!seenType.has(type)) {
      seenType.add(type);
      types.push(type);
    }
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  return {types, typeCounts};
}

function resolveRelationDisplayInfo(relation = {}, relationInfoById = {}) {
  const direct = relation?.displayInfo;
  if (direct) return direct;
  const relationId = String(relation.id);
  return relationInfoById?.[relationId] || null;
}

function getRelationVisualWeight(relation = {}) {
  return toNumber(relation.visualWeight, toNumber(relation.weight, 0));
}

function getRelationWeightStrategy(relations = [], options = {}) {
  const strategy = options.relationWeightAggregation || "max";
  const values = relations
    .map(relation => getRelationVisualWeight(relation))
    .filter(value => Number.isFinite(value));
  if (strategy === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (strategy === "first" || values.length === 0) return values[0] || 0;
  return Math.max(...values);
}

export function aggregateRelationsByPair(relations = [], options = {}) {
  const relationOrder = [];
  const grouped = new Map();
  const relationDisplayInfoById = options.relationDisplayInfoById || {};

  relations.forEach(relation => {
    const source = String(relation.source);
    const target = String(relation.target);
    if (isEmpty(source) || isEmpty(target)) return;
    const pairKey = `${source}->${target}`;
    if (!grouped.has(pairKey)) {
      grouped.set(pairKey, []);
      relationOrder.push(pairKey);
    }
    grouped.get(pairKey).push(relation);
  });

  return relationOrder.map(pairKey => {
    const groupedRelations = grouped.get(pairKey) || [];
    if (groupedRelations.length === 0) return null;

    const sample = groupedRelations[0] || {};
    const source = String(sample.source);
    const target = String(sample.target);
    const {types, typeCounts} = normalizeRelationTypesForPair(groupedRelations);
    const relationIds = groupedRelations.map(relation => String(relation.id || `raw:${pairKey}`));
    const relationsPayload = groupedRelations.map(relation => {
      const relationDisplayInfo = resolveRelationDisplayInfo(relation, relationDisplayInfoById);
      return {
        ...relation,
        source: String(relation.source),
        target: String(relation.target),
        type: getRelationType(relation),
        relationType: relation.relationType,
        id: String(relation.id || `raw:${pairKey}`),
        time: relation.time,
        weight: getRelationVisualWeight(relation),
        displayInfo: relationDisplayInfo || null,
      };
    });
    const times = [...new Set(groupedRelations
      .map(relation => relation.time)
      .filter(value => !isEmpty(value))
      .map(value => String(value)))];
    const displayInfo = relationsPayload.find(relation => relation.displayInfo != null)?.displayInfo || null;
    const relationVisualWeight = groupedRelations.length > 1
      ? getRelationWeightStrategy(groupedRelations, options)
      : getRelationVisualWeight(sample);
    const relationCount = groupedRelations.length;

    return {
      ...sample,
      id: relationCount > 1 ? `agg:${pairKey}` : String(sample.id || `rel_${pairKey}`),
      pairKey,
      source,
      target,
      weight: relationVisualWeight,
      relationCount,
      type: types.length > 1 ? "multiple" : types[0],
      types,
      typeCounts,
      relationIds,
      relations: relationsPayload,
      displayInfo,
      displayInfos: relationsPayload.map(relation => relation.displayInfo).filter(Boolean),
      times,
      time: times.length === 1 ? times[0] : null,
      meta: {
        ...(sample.meta || {}),
        aggregated: relationCount > 1,
        relationCount,
        types,
      },
    };
  }).filter(Boolean);
}

export function filterEntitiesAndRelations(input, options = {}) {
  const config = input.config || {};
  const entityThreshold = toNumber(getConfigValue(config, "entityThreshold", 0), 0);
  const relationThreshold = toNumber(getConfigValue(config, "relationThreshold", 0), 0);
  const removeSpecial = String(getConfigValue(config, "removeSpecial", "0")) === "1";
  const isolatedMode = String(getConfigValue(config, "removeIsolated", getConfigValue(config, "remove_isolated", "0")));

  let entities = input.entities
    .filter(entity => toNumber(entity.importance, 0) >= entityThreshold)
    .filter(entity => !removeSpecial || !entity.isSpecial);
  const entityIdSet = new Set(entities.map(entity => String(entity.id)));
  let relations = input.relations
    .filter(relation => toNumber(relation.weight, 0) >= relationThreshold)
    .filter(relation => entityIdSet.has(String(relation.source)) && entityIdSet.has(String(relation.target)));

  if (isolatedMode === "1" || isolatedMode === "2") {
    const degree = buildEntityDegreeMap(entities, relations);
    entities = entities.filter(entity => {
      const connected = degree[String(entity.id)] > 0;
      if (isolatedMode === "1") return connected;
      return connected || toNumber(entity.impact, 0) >= toNumber(options.partialIsolatedImpact, 50);
    });
    const nextEntityIdSet = new Set(entities.map(entity => String(entity.id)));
    relations = relations.filter(relation =>
      nextEntityIdSet.has(String(relation.source)) && nextEntityIdSet.has(String(relation.target))
    );
  }

  return {entities, relations};
}

export function buildActiveSlices(slices = [], entities = [], options = {}) {
  const threshold = toNumber(options.sliceThreshold, 0);
  const sliceMap = new Map(slices.map(slice => [String(slice.id), {...slice, size: 0, relationSize: 0}]));

  entities.forEach(entity => {
    const counted = new Set();
    if (!isEmpty(entity.primarySliceId)) counted.add(String(entity.primarySliceId));
    Object.entries(entity.sliceWeights || {}).forEach(([sliceId, weight]) => {
      if (toNumber(weight, 0) >= threshold) counted.add(String(sliceId));
    });
    counted.forEach(sliceId => {
      if (!sliceMap.has(sliceId)) {
        sliceMap.set(sliceId, {
          id: sliceId,
          name: sliceId,
          shortName: sliceId,
          chordName: sliceId,
          fullName: sliceId,
          size: 0,
          meta: {},
        });
      }
      sliceMap.get(sliceId).size += 1;
    });
  });

  let activeSlices = [...sliceMap.values()].filter(slice => toNumber(slice.size, 0) > 0);
  activeSlices.sort(sortBySizeDesc);

  const explicitMinSize = options.minSliceSize ?? options.sliceMinSize;
  if (explicitMinSize !== undefined) {
    activeSlices = activeSlices.filter(slice => slice.size >= toNumber(explicitMinSize, 0));
  } else if (options.legacySliceFilter !== false && activeSlices.length > 10) {
    const eleventhSize = toNumber(activeSlices[10]?.size, 0);
    const minSize = Math.max(5, eleventhSize);
    activeSlices = activeSlices.filter(slice => slice.size >= minSize);
  }

  if (options.maxSlices != null) {
    activeSlices = activeSlices.slice(0, toNumber(options.maxSlices, activeSlices.length));
  }

  return activeSlices;
}

export function buildSliceRelationMatrix(entities = [], relations = [], slices = [], options = {}) {
  const threshold = toNumber(options.sliceThreshold, 0);
  const activeSliceIds = new Set(slices.map(slice => String(slice.id)));
  const sliceIndex = new Map(slices.map((slice, index) => [String(slice.id), index]));
  const entityById = new Map(entities.map(entity => [String(entity.id), entity]));
  const matrix = slices.map(() => slices.map(() => 0));

  function addRelation(sourceSliceId, targetSliceId, weight = 1) {
    if (isEmpty(sourceSliceId) || isEmpty(targetSliceId)) return;
    const sourceKey = String(sourceSliceId);
    const targetKey = String(targetSliceId);
    if (sourceKey === targetKey) return;
    if (!sliceIndex.has(sourceKey) || !sliceIndex.has(targetKey)) return;
    matrix[sliceIndex.get(sourceKey)][sliceIndex.get(targetKey)] += weight;
  }

  relations.forEach(relation => {
    const sourceEntity = entityById.get(String(relation.source));
    const targetEntity = entityById.get(String(relation.target));
    if (!sourceEntity || !targetEntity) return;

    const sourceCandidates = getSliceCandidates(sourceEntity, activeSliceIds, threshold);
    const targetCandidates = getSliceCandidates(targetEntity, activeSliceIds, threshold);
    const targetCandidateSet = new Set(targetCandidates);
    const sourceOnly = sourceCandidates.filter(sliceId => !targetCandidateSet.has(sliceId));
    const sourceCandidateSet = new Set(sourceCandidates);
    const targetOnly = targetCandidates.filter(sliceId => !sourceCandidateSet.has(sliceId));
    const relationWeight = options.weightedRelations ? toNumber(relation.weight, 1) : 1;

    const targetPrimary = String(targetEntity.primarySliceId ?? "");
    const sourcePrimary = String(sourceEntity.primarySliceId ?? "");
    const relationPairs = new Set();
    const addRelationOnce = (sourceSliceId, targetSliceId) => {
      const key = `${sourceSliceId}->${targetSliceId}`;
      if (relationPairs.has(key)) return;
      relationPairs.add(key);
      addRelation(sourceSliceId, targetSliceId, relationWeight);
    };

    sourceOnly.forEach(sourceSliceId => addRelationOnce(sourceSliceId, targetPrimary));
    targetOnly.forEach(targetSliceId => addRelationOnce(sourcePrimary, targetSliceId));

    if (sourceOnly.length === 0 && targetOnly.length === 0) {
      addRelationOnce(sourcePrimary, targetPrimary);
    }
  });

  return matrix;
}

export function buildSliceGraphs(entities = [], relations = [], slices = [], options = {}) {
  const threshold = toNumber(options.sliceThreshold, 0);
  const entityById = new Map(entities.map(entity => [String(entity.id), entity]));
  const sliceGraphs = {};

  slices.forEach(slice => {
    const sliceId = String(slice.id);
    const nodes = entities.filter(entity => hasSlice(entity, sliceId, threshold));
    const nodeIds = new Set(nodes.map(node => String(node.id)));
    const edges = relations.filter(relation =>
      nodeIds.has(String(relation.source)) && nodeIds.has(String(relation.target))
    );
    const edgeIds = new Set(edges.map(edge => String(edge.id)));
    const contextEdges = relations
      .filter(relation => !edgeIds.has(String(relation.id)))
      .filter(relation => nodeIds.has(String(relation.source)) || nodeIds.has(String(relation.target)))
      .map(relation => {
        const sourceEntity = entityById.get(String(relation.source));
        const targetEntity = entityById.get(String(relation.target));
        return {
          ...relation,
          sourceSliceId: sourceEntity?.primarySliceId ?? null,
          targetSliceId: targetEntity?.primarySliceId ?? null,
          direction: nodeIds.has(String(relation.source)) ? "out" : "in",
        };
      });
    const sliceStats = nodes.reduce((result, entity) => {
      const primarySliceId = entity.primarySliceId == null ? "unknown" : String(entity.primarySliceId);
      result[primarySliceId] = (result[primarySliceId] || 0) + 1;
      return result;
    }, {});

    sliceGraphs[sliceId] = {
      sliceId,
      slice,
      nodes,
      entities: nodes,
      edges,
      relations: edges,
      contextEdges,
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        contextEdgeCount: contextEdges.length,
        sliceStats,
      },
      layout: {},
    };
  });

  return sliceGraphs;
}

function buildFlatSliceTreeRows(slices = []) {
  return slices.map(slice => ({
    id: slice.id,
    parentId: "-1",
    level: 0,
    name: slice.name,
    type: "slice",
    selectable: true,
    count: slice.size,
    color: slice.color,
    meta: slice.meta || {},
    rawSlice: slice,
  }));
}

function normalizeTreeParentId(parentId) {
  return parentId == null ? "-1" : String(parentId);
}

function buildTreeChildrenIndex(rows = []) {
  const childrenByParent = new Map();
  rows.forEach(row => {
    const parentId = normalizeTreeParentId(row.parentId);
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(String(row.id));
  });
  return childrenByParent;
}

function resolveTreeRowSlice(row = {}, sliceById = new Map()) {
  const candidates = [
    row.sliceId,
    row.rawSlice?.id,
    row.id,
  ].filter(value => !isEmpty(value)).map(String);
  for (const candidate of candidates) {
    if (sliceById.has(candidate)) return sliceById.get(candidate);
  }
  return null;
}

function countTreeSliceNodes(slice = {}, sliceGraphs = {}) {
  const graph = sliceGraphs[String(slice.id)] || {};
  return graph.nodes?.length
    ?? graph.entities?.length
    ?? slice.size
    ?? undefined;
}

function computeTreeRowCount(row = {}, context = {}, memo = new Map()) {
  const key = String(row.id);
  if (memo.has(key)) return memo.get(key);

  if (!isEmpty(row.count)) {
    const count = row.count;
    memo.set(key, count);
    return count;
  }

  const slice = resolveTreeRowSlice(row, context.sliceById);
  if (slice) {
    const count = countTreeSliceNodes(slice, context.sliceGraphs);
    memo.set(key, count);
    return count;
  }

  let total = 0;
  let hasChildCount = false;
  (context.childrenByParent.get(key) || []).forEach(childId => {
    const child = context.rowById.get(childId);
    if (!child) return;
    const childCount = computeTreeRowCount(child, context, memo);
    if (childCount == null || childCount === "") return;
    total += toNumber(childCount, 0);
    hasChildCount = true;
  });

  const count = hasChildCount ? total : row.size;
  memo.set(key, count);
  return count;
}

function enrichTreeRows(rows = [], slices = [], options = {}) {
  const sliceById = new Map(slices.map(slice => [String(slice.id), slice]));
  const displayInfoBySliceId = options.displayInfo?.sliceInfoById || {};
  const normalizedRows = rows.map(row => ({
    ...row,
    id: String(row.id),
    parentId: normalizeTreeParentId(row.parentId),
    level: Number.isFinite(Number(row.level)) ? Number(row.level) : 0,
  }));
  const childrenByParent = buildTreeChildrenIndex(normalizedRows);
  const rowById = new Map(normalizedRows.map(row => [String(row.id), row]));
  const context = {
    sliceById,
    sliceGraphs: options.sliceGraphs || {},
    childrenByParent,
    rowById,
  };

  return normalizedRows.map(row => {
    const slice = resolveTreeRowSlice(row, sliceById);
    const sliceId = row.sliceId || slice?.id;
    const displayInfo = row.displayInfo
      || displayInfoBySliceId[String(sliceId || row.id)]
      || null;
    const selectable = row.selectable === undefined
      ? Boolean(slice)
      : Boolean(row.selectable);

    return {
      ...row,
      name: row.name || row.label || row.shortName || displayInfo?.title || slice?.name || String(row.id),
      selectable,
      count: computeTreeRowCount(row, context),
      color: row.color || slice?.color,
      sliceId,
      type: row.type || (slice ? "slice" : (row.level <= 0 ? "root" : "group")),
      meta: {
        ...(row.meta || {}),
        ...(slice?.meta || {}),
      },
      displayInfo,
      rawSlice: row.rawSlice || slice || null,
    };
  });
}

function valueFromPath(object = {}, path = "") {
  return String(path)
    .split(".")
    .reduce((current, part) => (current == null ? undefined : current[part]), object);
}

function splitGroupValues(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (value == null || value === "") return [];
  return String(value)
    .split(/[,;，；]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function buildGroupedSliceTreeRows(slices = [], options = {}, entities = []) {
  const groupBy = options.groupBy;
  if (!groupBy) return buildFlatSliceTreeRows(slices);

  const rootId = options.rootId || "overview";
  const unknownGroup = options.unknownGroupLabel || "Ungrouped";
  const threshold = toNumber(options.sliceThreshold, 0);
  const activeSliceIds = new Set(slices.map(slice => String(slice.id)));
  const sliceById = new Map(slices.map(slice => [String(slice.id), slice]));
  const groupMap = new Map();

  function ensureGroup(groupName) {
    const id = `group:${groupName}`;
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, {
        id,
        name: groupName,
        entityIds: new Set(),
        sliceCounts: new Map(),
      });
    }
    return groupMap.get(groupName);
  }

  entities.forEach(entity => {
    const groups = splitGroupValues(valueFromPath(entity, groupBy));
    const groupNames = groups.length > 0 ? groups : [unknownGroup];
    const sliceIds = getSliceCandidates(entity, activeSliceIds, threshold);
    groupNames.forEach(groupName => {
      const group = ensureGroup(groupName);
      group.entityIds.add(String(entity.id));
      sliceIds.forEach(sliceId => {
        group.sliceCounts.set(sliceId, (group.sliceCounts.get(sliceId) || 0) + 1);
      });
    });
  });

  const rows = [{
    id: rootId,
    parentId: "-1",
    level: 0,
    name: options.rootLabel || "overview",
    type: "root",
    selectable: false,
    count: entities.length,
  }];

  [...groupMap.values()]
    .sort((a, b) => b.entityIds.size - a.entityIds.size || a.name.localeCompare(b.name))
    .forEach(group => {
      rows.push({
        id: group.id,
        parentId: rootId,
        level: 1,
        name: group.name,
        type: "group",
        selectable: false,
        count: group.entityIds.size,
      });

      [...group.sliceCounts.entries()]
        .map(([sliceId, count]) => ({slice: sliceById.get(sliceId), sliceId, count}))
        .filter(item => item.slice)
        .sort((a, b) => b.count - a.count || toNumber(b.slice.size, 0) - toNumber(a.slice.size, 0))
        .forEach(({slice, sliceId, count}) => {
          rows.push({
            id: `${group.id}:slice:${sliceId}`,
            parentId: group.id,
            level: 2,
            name: slice.name,
            type: "slice",
            selectable: true,
            count,
            color: slice.color,
            sliceId,
            group: group.name,
            meta: slice.meta || {},
            rawSlice: slice,
          });
        });
    });

  return rows;
}

export function buildTreeModel(hierarchy = [], slices = [], options = {}, entities = []) {
  const useHierarchy = options.useHierarchy === true || (options.useHierarchy !== false && hierarchy.length > 0);
  const useFlatSlices = options.flat === true || options.mode === "flat";
  const rows = useHierarchy && hierarchy.length > 0
    ? hierarchy
    : (useFlatSlices || !options.groupBy
      ? buildFlatSliceTreeRows(slices)
      : buildGroupedSliceTreeRows(slices, options, entities));

  const enrichedRows = enrichTreeRows(rows, slices, options);
  return {hierarchy: enrichedRows, rows: enrichedRows};
}

export function buildListModel(entities = [], options = {}) {
  const limit = options.limit ?? null;
  const displayInfoByEntityId = options.displayInfo?.entityInfoById || {};
  const colorMap = options.colorMap || {};
  const items = [...entities]
    .sort((a, b) => toNumber(b.impact, 0) - toNumber(a.impact, 0))
    .map(entity => {
      const entityId = String(entity.id);
      const displayInfo = displayInfoByEntityId[entityId] || entity.displayInfo || null;
      return {
        id: entity.id,
        title: displayInfo?.title || entity.label || entity.name || entity.id,
        subtitle: displayInfo?.subtitle || [entity.primarySliceId, entity.time].filter(value => !isEmpty(value)).join(" · "),
        value: entity.impact,
        color: entity.color || displayInfo?.color || colorMap[String(entity.primarySliceId)],
        colorKey: entity.primarySliceId,
        displayInfo,
        meta: entity.meta || {},
        raw: entity,
      };
    });

  return {
    items: limit == null ? items : items.slice(0, toNumber(limit, items.length)),
    total: items.length,
  };
}

export function buildComponentModels(rawInput = {}, options = {}) {
  const normalized = rawInput.normalized === true
    ? rawInput
    : normalizeInput(rawInput, options);
  const config = {...(normalized.config || {}), ...(options.config || {})};
  const sliceThreshold = toNumber(options.sliceThreshold ?? config.sliceThreshold, 0);
  const {entities, relations} = filterEntitiesAndRelations({
    ...normalized,
    config,
  }, options.filters || {});
  const aggregatedRelations = options.aggregateRelations === false
    ? relations
    : aggregateRelationsByPair(relations, {
      ...options,
      relationDisplayInfoById: normalized.displayInfo?.relationInfoById || {},
    });
  const activeSlicesWithoutColors = buildActiveSlices(normalized.slices, entities, {
    ...options,
    sliceThreshold,
  });
  const {slices, colorMap} = applySliceColors(activeSlicesWithoutColors, {
    palette: options.palette,
    colorMap: options.colorMap,
  });
  const matrix = buildSliceRelationMatrix(entities, aggregatedRelations, slices, {
    ...options,
    sliceThreshold,
  });
  const sliceGraphs = buildSliceGraphs(entities, aggregatedRelations, slices, {
    ...options,
    sliceThreshold,
  });
  const tree = buildTreeModel(normalized.hierarchy, slices, {
    sliceThreshold,
    displayInfo: normalized.displayInfo,
    sliceGraphs,
    ...(options.tree || {}),
  }, entities);
  const chord = {slices, matrix, sliceRelationMatrix: matrix};
  const prism = {
    slices,
    sliceGraphs,
    chord,
    colorMap,
  };
  const scrollBySliceId = Object.fromEntries(
    slices.map(slice => [String(slice.id), {
      slice,
      graph: sliceGraphs[String(slice.id)],
      slices,
      colorMap,
    }])
  );
  const list = buildListModel(entities, {
    ...(options.list || {}),
    displayInfo: normalized.displayInfo,
    colorMap,
  });

  return {
    input: normalized,
    config,
    displayInfo: normalized.displayInfo,
    metrics: {
      originalEntityCount: normalized.entities.length,
      originalRelationCount: normalized.relations.length,
      entityCount: entities.length,
      filteredRelationCount: relations.length,
      relationCount: aggregatedRelations.length,
      sliceCount: slices.length,
    },
    entities,
    relations: aggregatedRelations,
    slices,
    colorMap,
    tree,
    chord,
    prism,
    scrollBySliceId,
    list,
    getSliceColor: sliceId => getSliceColor(sliceId, colorMap),
  };
}

export const buildModels = buildComponentModels;
