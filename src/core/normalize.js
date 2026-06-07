const DEFAULT_CONFIG = {
  entityThreshold: 0,
  relationThreshold: 0,
  sliceThreshold: 0,
  removeSpecial: "0",
  removeIsolated: "0",
  sliceWeightTopK: 3,
};

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

function toNumberOrDefault(value, fallback = 0) {
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

function getByPath(object, path) {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .reduce((current, part) => (current == null ? undefined : current[part]), object);
}

function getMappedValue(object, fieldMap = {}, key, fallbacks = []) {
  const spec = fieldMap[key];
  const paths = Array.isArray(spec) ? spec : [spec, ...fallbacks];
  for (const path of paths) {
    const value = getByPath(object, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function normalizeSliceWeights(value, primarySliceId = null) {
  if (Array.isArray(value)) {
    return value.reduce((result, item) => {
      if (Array.isArray(item)) {
        const [id, weight] = item;
        if (id !== undefined && id !== null) result[String(id)] = toNumberOrDefault(weight, 0);
        return result;
      }
      if (isPlainObject(item)) {
        const id = firstDefined(item.id, item.sliceId, item.key);
        if (id !== undefined && id !== null) {
          result[String(id)] = toNumberOrDefault(firstDefined(item.weight, item.value, item.prob), 0);
        }
      }
      return result;
    }, {});
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([id, weight]) => [String(id), toNumberOrDefault(weight, 0)])
    );
  }

  if (primarySliceId !== undefined && primarySliceId !== null && primarySliceId !== "") {
    return {[String(primarySliceId)]: 1};
  }

  return {};
}

function limitSliceWeights(sliceWeights = {}, topK = 3, primarySliceId = null) {
  const entries = Object.entries(sliceWeights)
    .map(([id, weight]) => [String(id), toNumberOrDefault(weight, 0)])
    .sort((a, b) => b[1] - a[1]);
  const limited = entries.slice(0, topK).reduce((result, [id, weight]) => {
    result[id] = weight;
    return result;
  }, {});

  if (primarySliceId !== undefined && primarySliceId !== null && primarySliceId !== "") {
    const key = String(primarySliceId);
    if (!Object.prototype.hasOwnProperty.call(limited, key)) {
      limited[key] = toNumberOrDefault(sliceWeights[key], 1);
    }
  }

  return limited;
}

function normalizeMeta(raw = {}, excludedKeys = []) {
  const excluded = new Set(excludedKeys);
  return Object.entries(raw).reduce((result, [key, value]) => {
    if (!excluded.has(key)) result[key] = value;
    return result;
  }, {});
}

export function parseCsv(text = "") {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some(cell => cell !== "")) rows.push(row);
  if (rows.length === 0) return [];

  const [headers, ...body] = rows;
  return body.map(cells => headers.reduce((result, header, index) => {
    result[header] = cells[index] ?? "";
    return result;
  }, {}));
}

export function normalizeEntity(rawEntity = {}, options = {}) {
  const fieldMap = options.fieldMap?.entity || options.entityFieldMap || {};
  const id = toStringOrNull(getMappedValue(rawEntity, fieldMap, "id", ["id", "entityId"]));
  const primarySliceId = toStringOrNull(getMappedValue(rawEntity, fieldMap, "primarySliceId", [
    "primarySliceId",
    "sliceId",
  ]));
  const rawSliceWeights = getMappedValue(rawEntity, fieldMap, "sliceWeights", [
    "sliceWeights",
    "weights",
  ]);
  const sliceWeights = limitSliceWeights(
    normalizeSliceWeights(rawSliceWeights, primarySliceId),
    options.sliceWeightTopK ?? DEFAULT_CONFIG.sliceWeightTopK,
    primarySliceId
  );
  const label = firstDefined(getMappedValue(rawEntity, fieldMap, "label", [
    "label",
    "name",
    "title",
  ]), id);
  const time = firstDefined(getMappedValue(rawEntity, fieldMap, "time", [
    "time",
    "layer",
  ]), null);
  const importance = toNumberOrDefault(getMappedValue(rawEntity, fieldMap, "importance", [
    "importance",
    "score",
    "prob",
  ]), 0);
  const impact = toNumberOrDefault(getMappedValue(rawEntity, fieldMap, "impact", [
    "impact",
    "value",
  ]), 0);

  return {
    id,
    label,
    primarySliceId,
    sliceWeights,
    time,
    layer: firstDefined(rawEntity.layer, rawEntity.rank, time),
    importance,
    impact,
    type: firstDefined(rawEntity.type, rawEntity.node_type, rawEntity.entityType),
    description: rawEntity.description,
    isSpecial: toBoolean(rawEntity.isSpecial, false),
    meta: {
      ...normalizeMeta(rawEntity, []),
      ...(rawEntity.meta || {}),
    },
    original: rawEntity,
  };
}

export function normalizeRelation(rawRelation = {}, options = {}) {
  const fieldMap = options.fieldMap?.relation || options.relationFieldMap || {};
  const source = toStringOrNull(getMappedValue(rawRelation, fieldMap, "source", ["source", "from", "src"]));
  const target = toStringOrNull(getMappedValue(rawRelation, fieldMap, "target", ["target", "to", "dst"]));
  const id = toStringOrNull(getMappedValue(rawRelation, fieldMap, "id", ["id", "relationId", "edgeId"]))
    || (source != null && target != null ? `${source}->${target}` : null);
  const weight = toNumberOrDefault(getMappedValue(rawRelation, fieldMap, "weight", [
    "weight",
    "prob",
    "value",
  ]), 1);

  return {
    id,
    source,
    target,
    weight,
    type: firstDefined(rawRelation.type, rawRelation.relation_type, rawRelation.relationType),
    label: firstDefined(rawRelation.label, rawRelation.name, rawRelation.type),
    description: rawRelation.description,
    meta: {
      ...normalizeMeta(rawRelation, []),
      ...(rawRelation.meta || {}),
    },
    original: rawRelation,
  };
}

export function normalizeSlices(input = {}, options = {}) {
  const fields = input.fields || input.sliceDictionary || {};
  const fieldMeta = input.fieldMeta || input.sliceMeta || {};
  const sourceSlices = input.slices || input.sliceDefinitions || input.componentData?.sliceDefinitions || [];
  const entitySlices = new Set();

  (input.entities || []).forEach(entity => {
    if (entity.primarySliceId != null) entitySlices.add(String(entity.primarySliceId));
    Object.keys(entity.sliceWeights || {}).forEach(id => entitySlices.add(String(id)));
  });

  const slices = [];
  if (Array.isArray(sourceSlices) && sourceSlices.length > 0) {
    sourceSlices.forEach(rawSlice => {
      const id = toStringOrNull(firstDefined(rawSlice.id, rawSlice.sliceId));
      if (id == null) return;
      const meta = fieldMeta[id] || {};
      slices.push({
        id,
        name: firstDefined(rawSlice.name, rawSlice.label, rawSlice.Name, fields[id], id),
        shortName: firstDefined(rawSlice.shortName, meta.shortName, rawSlice.name, fields[id], id),
        chordName: firstDefined(rawSlice.chordName, meta.chordName, rawSlice.shortName, rawSlice.name, fields[id], id),
        fullName: firstDefined(rawSlice.fullName, meta.fullName, rawSlice.name, fields[id], id),
        color: firstDefined(rawSlice.color, meta.color),
        size: toNumberOrDefault(firstDefined(rawSlice.size, rawSlice.count, rawSlice.Count), 0),
        meta: {...meta, ...(rawSlice.meta || {})},
        original: rawSlice,
      });
    });
  } else if (isPlainObject(fields) && Object.keys(fields).length > 0) {
    Object.entries(fields).forEach(([id, name]) => {
      const meta = fieldMeta[String(id)] || {};
      slices.push({
        id: String(id),
        name,
        shortName: firstDefined(meta.shortName, name),
        chordName: firstDefined(meta.chordName, meta.shortName, name),
        fullName: firstDefined(meta.fullName, name),
        color: meta.color,
        size: toNumberOrDefault(firstDefined(meta.size, meta.count), 0),
        meta,
      });
    });
  } else {
    entitySlices.forEach(id => {
      slices.push({
        id,
        name: id,
        shortName: id,
        chordName: id,
        fullName: id,
        size: 0,
        meta: {},
      });
    });
  }

  return slices.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, {numeric: true}));
}

export function normalizeHierarchyRows(rows = [], options = {}) {
  const sourceRows = typeof rows === "string" ? parseCsv(rows) : rows;
  const maxLevel = options.maxLevel;

  return (Array.isArray(sourceRows) ? sourceRows : [])
    .map(row => {
      const id = toStringOrNull(firstDefined(row.id, row.sliceId));
      const level = toNumberOrDefault(firstDefined(row.level, row.Level), 0);
      return {
        id,
        parentId: toStringOrNull(firstDefined(row.parentId, row.parent, "-1")),
        level,
        name: firstDefined(row.name, row.Name, row.label, id),
        type: firstDefined(row.type, row.nodeType, row.kind, "slice"),
        selectable: toBoolean(firstDefined(row.selectable, row.isLeaf), false),
        count: toNumberOrDefault(firstDefined(row.count, row.Count), 0),
        meta: {...row},
        original: row,
      };
    })
    .filter(row => row.id != null)
    .filter(row => maxLevel == null || row.level <= maxLevel);
}

export function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...(config || {}),
    entityThreshold: toNumberOrDefault(
      firstDefined(config.entityThreshold, config.nodeThreshold),
      DEFAULT_CONFIG.entityThreshold
    ),
    relationThreshold: toNumberOrDefault(
      firstDefined(config.relationThreshold, config.edgeThreshold),
      DEFAULT_CONFIG.relationThreshold
    ),
    sliceThreshold: toNumberOrDefault(config.sliceThreshold, DEFAULT_CONFIG.sliceThreshold),
    removeSpecial: String(firstDefined(config.removeSpecial, config.remove_special, DEFAULT_CONFIG.removeSpecial)),
    removeIsolated: String(firstDefined(config.removeIsolated, config.remove_isolated, DEFAULT_CONFIG.removeIsolated)),
  };
}

export function normalizeInput(rawInput = {}, options = {}) {
  const raw = rawInput || {};
  const componentData = raw.componentData || {};
  const data = raw.data || raw.sourceData || raw;
  const config = normalizeConfig({
    ...(raw.config || raw.componentOptions || {}),
    ...(options.config || {}),
  });
  const normalizeOptions = {
    ...options,
    sliceWeightTopK: options.sliceWeightTopK ?? config.sliceWeightTopK,
  };

  const rawEntities = raw.entities
    || raw.entityDefinitions
    || componentData.entities
    || componentData.entityDefinitions
    || data.entities
    || data.nodes
    || [];
  const entities = rawEntities
    .map(entity => normalizeEntity(entity, normalizeOptions))
    .filter(entity => entity.id != null);

  const rawRelations = raw.relations
    || raw.relationDefinitions
    || componentData.relations
    || componentData.relationDefinitions
    || data.relations
    || data.edges
    || [];
  const relations = rawRelations
    .map((relation, index) => {
      const normalized = normalizeRelation(relation, normalizeOptions);
      return {
        ...normalized,
        id: normalized.id || `relation-${index}`,
      };
    })
    .filter(relation => relation.source != null && relation.target != null);

  const slices = normalizeSlices({
    ...raw,
    fields: raw.fields || raw.sliceDictionary || options.fields || {},
    fieldMeta: raw.fieldMeta || raw.sliceMeta || options.fieldMeta || {},
    slices: raw.slices || raw.sliceDefinitions || componentData.sliceDefinitions,
    entities,
  }, normalizeOptions);

  const hierarchySource = raw.hierarchy
    || raw.sliceHierarchy
    || raw.treeRows
    || componentData.sliceHierarchy
    || options.hierarchy
    || [];
  const hierarchy = normalizeHierarchyRows(hierarchySource, options.tree || {});

  return {
    normalized: true,
    config,
    labels: raw.labels || raw.componentOptions?.labels || {},
    slices,
    hierarchy,
    entities,
    relations,
    displayInfo: raw.displayInfo || {},
    componentOptions: raw.componentOptions || {},
    original: raw,
  };
}

export const normalizeData = normalizeInput;
