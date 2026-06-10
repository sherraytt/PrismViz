const COMPONENT_NAMES = new Set(["tree", "chord", "prism", "scroll"]);

function stringId(value) {
  if (value == null) return null;
  const id = String(value);
  return id ? id : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function callMaybe(fn, ...args) {
  if (typeof fn === "function") return fn(...args);
  return undefined;
}

function normalizeComponentName(componentName) {
  const name = String(componentName || "").toLowerCase();
  if (!COMPONENT_NAMES.has(name)) {
    throw new Error(`Unknown interaction component: ${componentName}`);
  }
  return name;
}

function collectSliceIds(model = {}) {
  const ids = new Set();
  const add = value => {
    const id = stringId(value);
    if (id) ids.add(id);
  };

  asArray(model.slices).forEach(slice => add(slice?.id));
  asArray(model.prism?.slices).forEach(slice => add(slice?.id));
  asArray(model.chord?.slices).forEach(slice => add(slice?.id));
  Object.keys(model.scrollBySliceId || {}).forEach(add);
  asArray(model.tree?.rows).forEach(row => {
    add(row?.id);
    add(row?.sliceId);
    add(row?.primarySliceId);
  });

  return ids;
}

function normalizeDirection(value) {
  const direction = String(value || "").toLowerCase();
  if (["left", "l", "top", "in", "incoming", "source"].includes(direction)) return "in";
  if (["right", "r", "bottom", "out", "outgoing", "target"].includes(direction)) return "out";
  return null;
}

function mergeCallbacks(userOptions = {}, coordinatorCallbacks = {}) {
  const merged = {...userOptions};
  Object.entries(coordinatorCallbacks).forEach(([key, coordinatorCallback]) => {
    const userCallback = userOptions?.[key];
    if (typeof coordinatorCallback === "function" && typeof userCallback === "function") {
      merged[key] = (...args) => {
        coordinatorCallback(...args);
        userCallback(...args);
      };
    } else if (typeof coordinatorCallback === "function") {
      merged[key] = coordinatorCallback;
    }
  });
  return merged;
}

function relationTitle(relation) {
  return relation?.title || relation?.name || relation?.label || relation?.id || null;
}

export function createInteractionCoordinator(options = {}) {
  const model = options.model || {};
  const sliceIds = collectSliceIds(model);
  const instances = new Map();
  let destroyed = false;
  let selectedContext = null;
  let hoveredContext = null;

  const state = {
    activeSliceId: null,
    focusedSliceId: null,
    hoveredSliceId: null,
    activeRelation: null,
    hoveredRelation: null,
    activeContextSliceId: null,
    activeContextDirection: null,
    mainView: "prism",
    source: null,
  };

  function isKnownSliceId(sliceId) {
    const id = stringId(sliceId);
    return Boolean(id && (sliceIds.size === 0 || sliceIds.has(id)));
  }

  function normalizeSliceId(sliceOrId) {
    if (sliceOrId == null) return null;
    if (typeof sliceOrId !== "object") {
      const id = stringId(sliceOrId);
      return isKnownSliceId(id) ? id : null;
    }

    const candidates = [
      sliceOrId.id,
      sliceOrId.sliceId,
      sliceOrId.primarySliceId,
      sliceOrId.sourceSliceId,
      sliceOrId.targetSliceId,
      sliceOrId.slice?.id,
      sliceOrId.raw?.id,
      sliceOrId.raw?.sliceId,
      sliceOrId.raw?.primarySliceId,
    ];
    for (const candidate of candidates) {
      const id = stringId(candidate);
      if (isKnownSliceId(id)) return id;
    }
    return null;
  }

  function normalizeRelation(relation) {
    if (!relation || typeof relation !== "object") return null;

    const sourceSliceId = normalizeSliceId(
      relation.sourceSliceId
      ?? relation.sourceSlice
      ?? relation.source?.slice
      ?? relation.source?.sliceId
      ?? relation.source?.primarySliceId
      ?? relation.source
    );
    const targetSliceId = normalizeSliceId(
      relation.targetSliceId
      ?? relation.targetSlice
      ?? relation.target?.slice
      ?? relation.target?.sliceId
      ?? relation.target?.primarySliceId
      ?? relation.target
    );

    if (!sourceSliceId || !targetSliceId) return null;
    return {
      id: stringId(relation.id) || `${sourceSliceId}->${targetSliceId}`,
      title: relationTitle(relation),
      sourceSliceId,
      targetSliceId,
      raw: relation,
    };
  }

  function normalizeContext(context, meta = {}) {
    if (!context || typeof context !== "object") return null;
    const sliceId = normalizeSliceId(context.sliceId ?? context.id ?? context.contextSliceId);
    if (!sliceId) return null;

    const direction = normalizeDirection(
      meta.direction
      ?? context.direction
      ?? meta.placement
      ?? context.placement
    );
    const activeSliceId = state.activeSliceId || state.focusedSliceId || normalizeSliceId(options.initialSliceId);
    const sourceSliceId = normalizeSliceId(context.sourceSliceId)
      || (direction === "out" ? activeSliceId : sliceId);
    const targetSliceId = normalizeSliceId(context.targetSliceId)
      || (direction === "in" ? activeSliceId : sliceId);

    return {
      sliceId,
      direction,
      sourceSliceId,
      targetSliceId,
      raw: context,
    };
  }

  function getState() {
    const context = hoveredContext || selectedContext;
    return {
      ...state,
      activeContextSliceId: context?.sliceId || null,
      activeContextDirection: context?.direction || null,
      activeRelation: state.activeRelation ? {...state.activeRelation} : null,
      hoveredRelation: state.hoveredRelation ? {...state.hoveredRelation} : null,
    };
  }

  function setMainView(nextView, meta = {}) {
    if (!nextView || state.mainView === nextView) return;
    state.mainView = nextView;
    callMaybe(options.onViewChange, nextView, getState(), meta);
  }

  function callInstance(componentName, methodName, ...args) {
    const instance = instances.get(componentName);
    const method = instance?.[methodName];
    if (typeof method === "function") method.apply(instance, args);
  }

  function relationToContext(relation) {
    const activeSliceId = state.activeSliceId || state.focusedSliceId;
    if (!relation || !activeSliceId) return null;
    if (relation.sourceSliceId === activeSliceId) {
      return {sliceId: relation.targetSliceId, direction: "out"};
    }
    if (relation.targetSliceId === activeSliceId) {
      return {sliceId: relation.sourceSliceId, direction: "in"};
    }
    return null;
  }

  function contextAsRelation(context) {
    if (context?.sourceSliceId && context?.targetSliceId) {
      return {
        id: `${context.sourceSliceId}->${context.targetSliceId}`,
        sourceSliceId: context.sourceSliceId,
        targetSliceId: context.targetSliceId,
        raw: context.raw,
      };
    }
    return null;
  }

  function visualRelation() {
    const hoveredContextRelation = contextAsRelation(hoveredContext);
    if (hoveredContextRelation) return hoveredContextRelation;
    if (state.hoveredRelation) return state.hoveredRelation;
    const selectedContextRelation = contextAsRelation(selectedContext);
    if (selectedContextRelation) return selectedContextRelation;
    return state.hoveredRelation || state.activeRelation;
  }

  function syncContextState() {
    const context = hoveredContext || selectedContext;
    state.activeContextSliceId = context?.sliceId || null;
    state.activeContextDirection = context?.direction || null;
  }

  function applyTreeState(displaySliceId, relation) {
    if (relation?.sourceSliceId && relation?.targetSliceId) {
      callInstance("tree", "setActive", [relation.sourceSliceId, relation.targetSliceId]);
    } else if (displaySliceId) {
      callInstance("tree", "setActive", displaySliceId);
    } else {
      callInstance("tree", "clearActive");
    }
  }

  function applyChordState(displaySliceId, relation) {
    callInstance("chord", "clearHighlight");
    if (state.activeSliceId) callInstance("chord", "setActiveSlice", state.activeSliceId);
    if (!state.activeSliceId && state.focusedSliceId) callInstance("chord", "highlightSlice", state.focusedSliceId);
    if (displaySliceId && displaySliceId !== state.activeSliceId) callInstance("chord", "highlightSlice", displaySliceId);
    if (state.activeRelation) {
      callInstance("chord", "highlightRelation", state.activeRelation.sourceSliceId, state.activeRelation.targetSliceId);
    }
    if (relation) callInstance("chord", "highlightRelation", relation.sourceSliceId, relation.targetSliceId);
  }

  function applyPrismState(displaySliceId) {
    callInstance("prism", "clearHighlight");
    if (state.activeSliceId) {
      callInstance("prism", "setActiveSlice", state.activeSliceId);
    } else if (displaySliceId) {
      callInstance("prism", "highlightSlice", displaySliceId);
    }
  }

  function applyScrollState(relation) {
    callInstance("scroll", "clearHighlight");
    const context = hoveredContext || selectedContext || relationToContext(relation);
    if (context?.sliceId) {
      callInstance("scroll", "highlightContextSlice", context.sliceId, context.direction);
    }
  }

  function applyState(meta = {}) {
    if (destroyed) return;
    syncContextState();
    const relation = visualRelation();
    const displaySliceId = state.hoveredSliceId || state.activeSliceId || state.focusedSliceId;
    applyTreeState(displaySliceId, relation);
    applyChordState(displaySliceId, relation);
    applyPrismState(displaySliceId);
    applyScrollState(relation);
    callMaybe(options.onStateChange, getState(), meta);
  }

  function focusSlice(sliceOrId, meta = {}) {
    if (destroyed) return null;
    state.focusedSliceId = normalizeSliceId(sliceOrId);
    state.source = meta.source || null;
    applyState({...meta, event: "slice:focus"});
    return state.focusedSliceId;
  }

  function hoverSlice(sliceOrId, meta = {}) {
    if (destroyed) return null;
    const sliceId = normalizeSliceId(sliceOrId);
    if (!sliceId) return clearTransient(meta);
    state.hoveredSliceId = sliceId;
    state.hoveredRelation = null;
    hoveredContext = null;
    state.source = meta.source || null;
    applyState({...meta, event: "slice:hover"});
    return sliceId;
  }

  function selectSlice(sliceOrId, meta = {}) {
    if (destroyed) return null;
    const sliceId = normalizeSliceId(sliceOrId);
    if (!sliceId) return null;
    state.activeSliceId = sliceId;
    state.focusedSliceId = sliceId;
    state.hoveredSliceId = null;
    state.activeRelation = null;
    state.hoveredRelation = null;
    selectedContext = null;
    hoveredContext = null;
    state.source = meta.source || null;

    if (instances.has("scroll") || typeof options.onScrollSliceChange === "function") {
      setMainView("scroll", {...meta, event: "view:change"});
      const scrollData = callMaybe(options.getScrollData, sliceId, {model, state: getState(), source: state.source})
        ?? model.scrollBySliceId?.[sliceId]
        ?? null;
      callMaybe(options.onScrollSliceChange, sliceId, {
        scrollData,
        source: state.source,
        state: getState(),
      });
    }

    applyState({...meta, event: "slice:select"});
    return sliceId;
  }

  function hoverRelation(relation, meta = {}) {
    if (destroyed) return null;
    const normalized = normalizeRelation(relation);
    if (!normalized) return clearTransient(meta);
    state.hoveredRelation = normalized;
    state.hoveredSliceId = null;
    hoveredContext = null;
    state.source = meta.source || null;
    applyState({...meta, event: "relation:hover"});
    return normalized;
  }

  function selectRelation(relation, meta = {}) {
    if (destroyed) return null;
    const normalized = normalizeRelation(relation);
    if (!normalized) return null;
    state.activeRelation = normalized;
    state.hoveredRelation = null;
    state.hoveredSliceId = null;
    selectedContext = null;
    hoveredContext = null;
    state.source = meta.source || null;
    applyState({...meta, event: "relation:select"});
    return normalized;
  }

  function hoverContext(context, meta = {}) {
    if (destroyed) return null;
    const normalized = normalizeContext(context, meta);
    if (!normalized) return clearTransient(meta);
    hoveredContext = normalized;
    state.hoveredSliceId = null;
    state.hoveredRelation = null;
    state.source = meta.source || null;
    applyState({...meta, event: "context:hover"});
    return normalized;
  }

  function selectContext(context, meta = {}) {
    if (destroyed) return null;
    const normalized = normalizeContext(context, meta);
    if (!normalized) return null;
    selectedContext = normalized;
    hoveredContext = null;
    state.activeRelation = contextAsRelation(normalized);
    state.source = meta.source || null;
    applyState({...meta, event: "context:select"});
    return normalized;
  }

  function clearTransient(meta = {}) {
    if (destroyed) return null;
    state.hoveredSliceId = null;
    state.hoveredRelation = null;
    hoveredContext = null;
    state.source = meta.source || null;
    applyState({...meta, event: "transient:clear"});
    return null;
  }

  function optionsFor(componentName, userOptions = {}) {
    if (destroyed) return {...userOptions};
    const name = normalizeComponentName(componentName);
    if (name === "tree") {
      return mergeCallbacks(userOptions, {
        onSelect: item => selectSlice(item, {source: "tree"}),
        onHover: item => (item ? hoverSlice(item, {source: "tree"}) : clearTransient({source: "tree"})),
      });
    }
    if (name === "chord") {
      return mergeCallbacks(userOptions, {
        onSelect: payload => {
          const relation = normalizeRelation(payload);
          if (relation) selectRelation(relation, {source: "chord"});
          else selectSlice(payload, {source: "chord"});
        },
        onSliceHover: payload => (payload ? hoverSlice(payload, {source: "chord"}) : clearTransient({source: "chord"})),
        onRelationHover: payload => (payload ? hoverRelation(payload, {source: "chord"}) : clearTransient({source: "chord"})),
      });
    }
    if (name === "prism") {
      return mergeCallbacks(userOptions, {
        onActiveSliceChange: slice => (slice ? focusSlice(slice, {source: "prism"}) : focusSlice(null, {source: "prism"})),
        onTagClick: slice => selectSlice(slice, {source: "prism"}),
        onTagHover: slice => (slice ? hoverSlice(slice, {source: "prism"}) : clearTransient({source: "prism"})),
      });
    }
    return mergeCallbacks(userOptions, {
      onSegmentHover: (segment, context = {}) => (
        segment ? hoverContext(segment, {source: "scroll", ...context}) : clearTransient({source: "scroll", ...context})
      ),
      onStreamHover: stream => (stream ? hoverContext(stream, {source: "scroll"}) : clearTransient({source: "scroll"})),
      onSegmentSelect: (segment, context = {}) => selectContext(segment, {source: "scroll", ...context}),
      onStreamSelect: (stream, context = {}) => selectContext(stream, {source: "scroll", ...context}),
    });
  }

  function register(componentName, instance) {
    if (destroyed) return api;
    const name = normalizeComponentName(componentName);
    if (instance == null) instances.delete(name);
    else instances.set(name, instance);
    applyState({source: "coordinator", event: "component:register", component: name});
    return api;
  }

  function unregister(componentName) {
    if (destroyed) return api;
    const name = normalizeComponentName(componentName);
    instances.delete(name);
    return api;
  }

  function destroy() {
    destroyed = true;
    instances.clear();
    selectedContext = null;
    hoveredContext = null;
    state.activeSliceId = null;
    state.focusedSliceId = null;
    state.hoveredSliceId = null;
    state.activeRelation = null;
    state.hoveredRelation = null;
    state.activeContextSliceId = null;
    state.activeContextDirection = null;
    state.source = null;
  }

  const api = {
    optionsFor,
    register,
    unregister,
    focusSlice,
    selectSlice,
    hoverSlice,
    hoverRelation,
    selectRelation,
    hoverContext,
    selectContext,
    clearTransient,
    getState,
    destroy,
  };

  const initialSliceId = normalizeSliceId(options.initialSliceId);
  if (initialSliceId) {
    state.activeSliceId = initialSliceId;
    state.focusedSliceId = initialSliceId;
  }

  return api;
}

export default createInteractionCoordinator;
