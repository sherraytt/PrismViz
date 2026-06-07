import {
  getContextRelations,
  getEntity,
  getEntityRelations,
  getRelation,
  getSlice,
  getSliceRelations,
  stringId,
} from "./selectors.js";

export function getDisplayInfo(model = {}, item = {}, options = {}) {
  if (typeof options.getDisplayInfo === "function") return options.getDisplayInfo(model, item);
  if (item?.displayInfo) return item.displayInfo;
  const display = model.displayInfo || {};
  const ids = [item?.id, item?.sliceId, item?.rawSlice?.id]
    .map(stringId)
    .filter(Boolean);
  for (const id of ids) {
    const directDisplayInfo = display.entityInfoById?.[id]
      || display.relationInfoById?.[id]
      || display.sliceInfoById?.[id];
    if (directDisplayInfo) return directDisplayInfo;
  }

  const relationDisplayInfos = Array.isArray(item?.relationIds)
    ? item.relationIds.map(key => display.relationInfoById?.[stringId(key)]).filter(Boolean)
    : [];
  if (relationDisplayInfos.length > 0) return relationDisplayInfos[0];

  const childRelations = Array.isArray(item?.relations)
    ? item.relations
    : [];
  for (const relation of childRelations) {
    const childInfo = display.relationInfoById?.[stringId(relation?.id)];
    if (childInfo) return childInfo;
  }

  return null;
}

function labelOf(model, item = {}, options = {}) {
  const displayInfo = getDisplayInfo(model, item, options);
  return displayInfo?.title
    || item.label
    || item.name
    || item.shortName
    || item.title
    || item.id
    || item.sliceId
    || "";
}

function compact(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => hasContent(item))
  );
}

function hasContent(item) {
  if (item === undefined || item === null || item === "") return false;
  if (Array.isArray(item)) return item.length > 0;
  if (item && typeof item === "object" && item.constructor === Object) {
    return Object.keys(item).length > 0;
  }
  return true;
}

function cleanSection(value = {}, omittedKeys = []) {
  const omitted = new Set(omittedKeys.map(stringId));
  return compact(Object.fromEntries(
    Object.entries(value || {}).filter(([key, item]) => !omitted.has(stringId(key)) && hasContent(item))
  ));
}

function hasOwnEntries(value = {}) {
  return Object.keys(cleanSection(value)).length > 0;
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "");
}

function labelWithId(label, id) {
  const text = stringId(label);
  const key = stringId(id);
  if (!key) return text;
  if (!text || text === key) return key;
  return `${text} (${key})`;
}

function sliceLabel(model = {}, sliceId, options = {}) {
  const slice = getSlice(model, sliceId);
  return slice ? labelOf(model, slice, options) : stringId(sliceId);
}

function entityIdOf(entity = {}) {
  return stringId(entity.id ?? entity.entityId);
}

function relationIdOf(relation = {}) {
  return stringId(relation.id ?? relation.relationId ?? relation.pairKey);
}

function relationDisplayInfo(model = {}, relation = {}, options = {}) {
  const direct = getDisplayInfo(model, relation, options);
  if (direct) return direct;
  const display = model.displayInfo || {};
  const ids = [
    relation.id,
    relation.relationId,
    relation.pairKey,
    ...(Array.isArray(relation.relationIds) ? relation.relationIds : []),
  ].map(stringId).filter(Boolean);
  for (const id of ids) {
    const info = display.relationInfoById?.[id];
    if (info) return info;
  }
  return null;
}

function normalizeRelationMeta(relation = {}) {
  return {
    relationCount: Number.isFinite(relation.relationCount) ? relation.relationCount : (Array.isArray(relation.relationIds) ? relation.relationIds.length : 1),
    types: Array.isArray(relation.types) && relation.types.length > 0
      ? relation.types
      : [relation.type || relation.relationType || "unknown"],
    typeCounts: relation.typeCounts || {[(relation.type || relation.relationType || "unknown")]: relation.relationCount || 1},
    relationIds: Array.isArray(relation.relationIds) ? relation.relationIds : [relation.id],
    relations: Array.isArray(relation.relations) ? relation.relations : [],
  };
}

function inferDetailType(item = {}, context = {}) {
  const contextType = stringId(context.type);
  if (contextType === "node") return "entity";
  if (contextType === "edge") return "relation";
  if (contextType === "segment" || contextType === "stream") return "contextSlice";
  if (contextType) return contextType;
  if (item.source != null && item.target != null) return "relation";
  if (item.rawSlice || item.sliceId || modelSliceLike(item)) return "slice";
  return "entity";
}

function modelSliceLike(item = {}) {
  return item.size != null && item.id != null && (item.shortName != null || item.chordName != null);
}

function treeDetail(model = {}, item = {}, options = {}) {
  const slice = item.rawSlice || getSlice(model, item.sliceId || item.id);
  if (slice) {
    return {
      ...createDetailFormatter(model, options).slice(slice),
      treeNodeId: item.id,
      treeLevel: item.level,
      treeType: item.type,
      count: item.count,
    };
  }
  const displayInfo = getDisplayInfo(model, item, options);
  return compact({
    type: "tree",
    id: item.id,
    name: labelOf(model, item, options),
    level: item.level,
    treeType: item.type,
    count: item.count,
    slice: item.sliceId ? sliceLabel(model, item.sliceId, options) : undefined,
    metrics: cleanSection(displayInfo?.metrics),
    attributes: cleanSection(displayInfo?.attributes),
  });
}

export function createDetailFormatter(model = {}, options = {}) {
  function overview(state = {}) {
    return compact({
      type: "overview",
      dataset: state.dataset || options.dataset,
      activeSliceId: state.activeSliceId,
      sliceCount: model.slices?.length,
      entityCount: model.metrics?.entityCount || model.entities?.length,
      relationCount: model.metrics?.relationCount || model.relations?.length,
      scrollLayoutMode: state.scrollLayoutMode,
      prismFaceLayoutMode: state.prismFaceLayoutMode,
      filters: state.filters,
    });
  }

  function sliceDetail(sliceOrId, context = {}) {
    const slice = typeof sliceOrId === "object" ? sliceOrId : getSlice(model, sliceOrId);
    if (!slice) return overview(context.state);
    const graph = model.prism?.sliceGraphs?.[stringId(slice.id)] || model.scrollBySliceId?.[stringId(slice.id)]?.graph || {};
    const outbound = (model.slices || []).flatMap(target => getSliceRelations(model, slice.id, target.id));
    const inbound = (model.slices || []).flatMap(source => getSliceRelations(model, source.id, slice.id));
    const displayInfo = getDisplayInfo(model, slice, options);
    return compact({
      type: "slice",
      id: slice.id,
      name: labelOf(model, slice, options),
      shortName: slice.shortName,
      size: slice.size,
      nodeCount: graph.nodes?.length || graph.entities?.length,
      internalEdgeCount: graph.edges?.length || graph.relations?.length,
      inboundCount: inbound.length,
      outboundCount: outbound.length,
      metrics: cleanSection(displayInfo?.metrics),
      attributes: cleanSection(displayInfo?.attributes),
    });
  }

  function entityDetail(entityOrId) {
    const entity = typeof entityOrId === "object" ? entityOrId : getEntity(model, entityOrId);
    if (!entity) return null;
    const displayInfo = getDisplayInfo(model, entity, options);
    const attributes = cleanSection(displayInfo?.attributes || {}, [
      "contributors",
      "description",
      "primarySliceId",
      "source",
      "time",
      "year",
      "成立年份",
      "年份",
    ]);
    const rawMeta = entity.meta || {};
    const source = firstDefined(attributes.source, rawMeta.source, rawMeta.venue, entity.source, entity.venue, entity.venu);
    const contributors = firstDefined(attributes.contributors, rawMeta.contributors, rawMeta.authors, entity.authors);
    const description = firstDefined(
      displayInfo?.description,
      displayInfo?.attributes?.description,
      entity.description,
      entity.abstract,
      rawMeta.description
    );
    const primarySliceId = firstDefined(entity.primarySliceId, entity.topic, displayInfo?.attributes?.primarySliceId);
    const displayMetrics = cleanSection(displayInfo?.metrics);
    const fallbackMetrics = cleanSection({
      impact: entity.impact,
      importance: entity.importance,
      referenceCount: rawMeta.referenceCount,
    });
    return compact({
      type: "entity",
      id: entityIdOf(entity),
      name: labelOf(model, entity, options),
      subtitle: displayInfo?.subtitle,
      slice: primarySliceId ? sliceLabel(model, primarySliceId, options) : undefined,
      time: firstDefined(entity.time, entity.layer, entity.year, displayInfo?.attributes?.time),
      source,
      contributors,
      metrics: hasOwnEntries(displayMetrics) ? displayMetrics : fallbackMetrics,
      attributes,
      description,
    });
  }

  function relationDetail(relationOrId, context = {}) {
    const relation = typeof relationOrId === "object"
      ? relationOrId
      : getRelation(model, relationOrId);
    if (!relation) return null;
    const source = getEntity(model, relation.source);
    const target = getEntity(model, relation.target);
    const displayInfo = relationDisplayInfo(model, relation, options);
    const relationMeta = normalizeRelationMeta(relation);
    const sourceLabel = source ? labelOf(model, source, options) : (relation.sourceName || relation.source);
    const targetLabel = target ? labelOf(model, target, options) : (relation.targetName || relation.target);
    const description = firstDefined(
      displayInfo?.description,
      displayInfo?.attributes?.description,
      relation.description,
      relation.citation_context,
      relation.raw?.description,
      relation.raw?.citation_context
    );
    return compact({
      type: "relation",
      id: relationIdOf(relation),
      title: displayInfo?.title,
      subtitle: displayInfo?.subtitle,
      source: labelWithId(sourceLabel, relation.source),
      target: labelWithId(targetLabel, relation.target),
      sourceSlice: sliceLabel(model, relation.sourceSliceId || source?.primarySliceId || context.sourceSliceId, options),
      targetSlice: sliceLabel(model, relation.targetSliceId || target?.primarySliceId || context.targetSliceId, options),
      relationType: relation.relationType || relation.type,
      relationCount: relationMeta.relationCount > 1 ? relationMeta.relationCount : undefined,
      weight: firstDefined(relation.weight, relation.extends_prob),
      time: relation.time || relation.layer,
      metrics: cleanSection(displayInfo?.metrics, ["weight"]),
      attributes: cleanSection(displayInfo?.attributes, [
        "description",
        "source",
        "target",
        "sourceSlice",
        "targetSlice",
        "sourceSliceId",
        "targetSliceId",
        "type",
        "relationType",
        "weight",
      ]),
      description,
    });
  }

  function contextSliceDetail(context = {}, state = {}) {
    const activeSliceId = context.activeSliceId || state.activeSliceId;
    const contextSliceId = context.sliceId || context.contextSliceId;
    const relations = context.edges || getContextRelations(model, activeSliceId, contextSliceId, context.direction);
    const contextSlice = getSlice(model, contextSliceId);
    const activeSlice = getSlice(model, activeSliceId);
    return compact({
      type: "contextSlice",
      activeSliceId,
      activeSlice: activeSlice ? labelOf(model, activeSlice, options) : activeSliceId,
      contextSliceId,
      contextSlice: contextSlice ? labelOf(model, contextSlice, options) : contextSliceId,
      direction: context.direction || null,
      count: context.count ?? relations.length,
      totalRelatedRelations: relations.length,
    });
  }

  return {
    overview,
    slice: sliceDetail,
    entity: entityDetail,
    relation: relationDetail,
    contextSlice: contextSliceDetail,
    tree: item => treeDetail(model, item, options),
  };
}

export function createDetailRows(model = {}, item = {}, context = {}, options = {}) {
  const formatter = createDetailFormatter(model, options);
  const type = inferDetailType(item, context);
  if (type === "relation") return formatter.relation(item, context) || formatter.overview(context.state);
  if (type === "slice") return formatter.slice(item.rawSlice || item.sliceId || item.id, context) || formatter.overview(context.state);
  if (type === "contextSlice") return formatter.contextSlice(item, context.state);
  if (type === "tree") return formatter.tree(item);
  if (type === "overview") return formatter.overview(context.state || item);
  return formatter.entity(item.raw || item) || formatter.tree(item) || formatter.overview(context.state);
}
