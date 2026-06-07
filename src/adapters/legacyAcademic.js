import {parseCsv} from "../core/normalize.js";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "");
}

function toStringOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function toNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lower)) return true;
    if (["false", "0", "no", "n"].includes(lower)) return false;
  }
  return fallback;
}

function normalizeSliceWeights(value, primarySliceId = null, topK = 3) {
  let weights = {};
  if (isPlainObject(value)) {
    weights = Object.fromEntries(
      Object.entries(value).map(([id, weight]) => [String(id), toNumber(weight, 0)])
    );
  } else if (primarySliceId != null) {
    weights = {[String(primarySliceId)]: 1};
  }

  const limited = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .reduce((result, [id, weight]) => {
      result[id] = weight;
      return result;
    }, {});

  if (primarySliceId != null && !Object.prototype.hasOwnProperty.call(limited, String(primarySliceId))) {
    limited[String(primarySliceId)] = toNumber(weights[String(primarySliceId)], 1);
  }
  return limited;
}

function normalizeLegacyEntity(raw = {}, options = {}) {
  const id = toStringOrNull(firstDefined(raw.id, raw.paperID, raw.entityId));
  const primarySliceId = toStringOrNull(firstDefined(raw.primarySliceId, raw.sliceId, raw.topic));
  const sliceWeights = normalizeSliceWeights(
    firstDefined(raw.sliceWeights, raw.topicDist),
    primarySliceId,
    options.sliceWeightTopK ?? 3
  );
  const time = firstDefined(raw.time, raw.year, raw.layer);
  const source = firstDefined(raw.source, raw.venue, raw.venu);
  const description = firstDefined(raw.description, raw.abstract);
  const contributors = firstDefined(raw.contributors, raw.authors);

  return {
    id,
    label: firstDefined(raw.label, raw.name, raw.title, id),
    primarySliceId,
    sliceWeights,
    time,
    layer: firstDefined(raw.layer, time),
    importance: toNumber(firstDefined(raw.importance, raw.isKeyPaper, raw.prob), 0),
    impact: toNumber(firstDefined(raw.impact, raw.citationCount, raw.value), 0),
    type: firstDefined(raw.type, raw.entityType),
    description,
    isSpecial: toBoolean(firstDefined(raw.isSpecial, raw.survey), false),
    meta: {
      contributors,
      source,
      referenceCount: raw.referenceCount,
      tags: raw.keywords,
      ...(raw.meta || {}),
    },
    original: raw,
  };
}

function normalizeLegacyRelation(raw = {}, index = 0) {
  const source = toStringOrNull(firstDefined(raw.source, raw.from, raw.src));
  const target = toStringOrNull(firstDefined(raw.target, raw.to, raw.dst));
  return {
    id: toStringOrNull(firstDefined(raw.id, raw.relationId, raw.edgeId))
      || (source != null && target != null ? `${source}->${target}` : `relation-${index}`),
    source,
    target,
    weight: toNumber(firstDefined(raw.weight, raw.extends_prob, raw.prob, raw.value), 1),
    type: firstDefined(raw.type, raw.relationType),
    label: firstDefined(raw.label, raw.name, raw.type),
    description: firstDefined(raw.description, raw.citation_context),
    meta: {
      ...(raw.meta || {}),
    },
    original: raw,
  };
}

function normalizeLegacySlices(fields = {}, fieldMeta = {}, sourceSlices = []) {
  const slices = [];
  if (Array.isArray(sourceSlices) && sourceSlices.length > 0) {
    sourceSlices.forEach(raw => {
      const id = toStringOrNull(firstDefined(raw.id, raw.sliceId, raw.Topic));
      if (id == null) return;
      const meta = fieldMeta[id] || {};
      slices.push({
        id,
        name: firstDefined(raw.name, raw.label, raw.Name, fields[id], id),
        shortName: firstDefined(raw.shortName, meta.shortName, raw.name, fields[id], id),
        chordName: firstDefined(raw.chordName, meta.chordName, raw.shortName, raw.name, fields[id], id),
        fullName: firstDefined(raw.fullName, meta.fullName, raw.name, fields[id], id),
        color: firstDefined(raw.color, meta.color),
        size: toNumber(firstDefined(raw.size, raw.count, raw.Count, meta.matchingPaperCount), 0),
        meta: {
          ...meta,
          ...(raw.meta || {}),
        },
        original: raw,
      });
    });
  } else {
    Object.entries(fields || {}).forEach(([id, name]) => {
      const meta = fieldMeta[String(id)] || {};
      slices.push({
        id: String(id),
        name,
        shortName: firstDefined(meta.shortName, name),
        chordName: firstDefined(meta.chordName, meta.shortName, name),
        fullName: firstDefined(meta.fullName, name),
        color: meta.color,
        size: toNumber(meta.matchingPaperCount, 0),
        meta,
      });
    });
  }
  return slices.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, {numeric: true}));
}

function normalizeLegacyHierarchyRows(rows = []) {
  const sourceRows = typeof rows === "string" ? parseCsv(rows) : rows;
  return (Array.isArray(sourceRows) ? sourceRows : [])
    .map(row => {
      const id = toStringOrNull(firstDefined(row.id, row.Topic, row.sliceId));
      const parentId = toStringOrNull(firstDefined(row.parentId, row.parentTopic, row.parent, "-1"));
      const level = toNumber(firstDefined(row.level, row.Level), 0);
      const nodeType = firstDefined(row.nodeType, row.type, row.kind);
      return {
        id,
        parentId,
        level,
        name: firstDefined(row.name, row.Name, row.label, id),
        type: String(nodeType || "").toLowerCase() === "topic" ? "slice" : firstDefined(row.type, row.kind, "slice"),
        selectable: toBoolean(firstDefined(row.selectable, row.isLeaf), false)
          || String(nodeType || "").toLowerCase() === "topic",
        count: toNumber(firstDefined(row.count, row.Count), 0),
        meta: {...row},
        original: row,
      };
    })
    .filter(row => row.id != null);
}

function normalizeLegacyConfig(config = {}) {
  return {
    entityThreshold: toNumber(firstDefined(config.entityThreshold, config.node_prob), 0),
    relationThreshold: toNumber(firstDefined(config.relationThreshold, config.edge_prob), 0),
    sliceThreshold: toNumber(firstDefined(config.sliceThreshold, config.topic_prob), 0),
    removeSpecial: String(firstDefined(config.removeSpecial, config.remove_survey, "0")),
    removeIsolated: String(firstDefined(config.removeIsolated, config.remove_isolated, "0")),
    sliceWeightTopK: toNumber(firstDefined(config.sliceWeightTopK, config.topicTopK), 3),
  };
}

export function normalizeLegacyAcademicInput(input = {}, options = {}) {
  const data = input.data || input.sourceData || input;
  const config = normalizeLegacyConfig({
    ...(input.config || {}),
    ...(options.config || {}),
  });
  const normalizeOptions = {
    ...options,
    sliceWeightTopK: config.sliceWeightTopK,
  };
  const entities = (data.nodes || input.nodes || input.entities || [])
    .map(entity => normalizeLegacyEntity(entity, normalizeOptions))
    .filter(entity => entity.id != null);
  const relations = (data.edges || input.edges || input.relations || [])
    .map((relation, index) => normalizeLegacyRelation(relation, index))
    .filter(relation => relation.source != null && relation.target != null);
  const slices = normalizeLegacySlices(
    input.fields || input.sliceDictionary || {},
    input.fieldMeta || input.sliceMeta || {},
    input.slices || input.sliceDefinitions || []
  );
  const hierarchy = normalizeLegacyHierarchyRows(input.hierarchy || input.sliceHierarchy || []);

  return {
    normalized: true,
    config,
    labels: {
      entity: "Entity",
      relation: "Relation",
      slice: "Slice",
      ...(input.labels || {}),
    },
    slices,
    hierarchy,
    entities,
    relations,
    displayInfo: input.displayInfo || {},
    componentOptions: input.componentOptions || {},
    original: input,
  };
}

export const normalizeLegacyInput = normalizeLegacyAcademicInput;
