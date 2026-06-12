import {buildReferenceModels, detailRows as referenceDetailRows} from "../../src/adapters/reference.js";
import {
  buildClientModels,
  capScrollModelBySliceWeights,
  detailRows as clientDetailRows,
} from "../../src/adapters/client.js";
import {renderTree} from "../../src/components/tree/Tree.js";
import {renderChord} from "../../src/components/chord/Chord.js";
import {renderPrism, renderPrismSliceTags} from "../../src/components/prism/Prism.js";
import {renderScroll} from "../../src/components/scroll/Scroll.js";
import {legacyLayeredScroll} from "../../src/components/scroll/legacyLayeredScroll.js";
import {renderList} from "../../src/components/list/List.js";
import {createInteractionCoordinator} from "../../src/interaction/index.js";

const ALL_COMPONENTS = ["tree", "chord", "prism", "scroll"];

function stringId(value) {
  if (value == null) return "";
  return String(value);
}

function hasComponent(components, name) {
  return components.has(name);
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

async function loadInput(baseUrl) {
  const [slices, hierarchy, entities, relations, config, displayInfo] = await Promise.all([
    loadJson(`${baseUrl}/slice_definitions.json`),
    loadJson(`${baseUrl}/slice_hierarchy.json`),
    loadJson(`${baseUrl}/entities.json`),
    loadJson(`${baseUrl}/relations.json`),
    loadJson(`${baseUrl}/component_options.json`),
    loadJson(`${baseUrl}/display_info.json`),
  ]);
  return {normalized: true, slices, hierarchy, entities, relations, config, displayInfo};
}

function buildModels(dataset, input) {
  return dataset === "client"
    ? buildClientModels(input)
    : buildReferenceModels(input);
}

function detailFormatter(dataset) {
  return dataset === "client" ? clientDetailRows : referenceDetailRows;
}

function resolveElements(root = document) {
  return {
    header: root.querySelector(".interaction-header"),
    main: root.querySelector(".interaction-main"),
    left: root.querySelector(".interaction-left"),
    title: root.querySelector("#interaction-title"),
    status: root.querySelector("#interaction-status"),
    treeCard: root.querySelector("#tree-card"),
    treeBody: root.querySelector("#tree-body"),
    chordCard: root.querySelector("#chord-card"),
    chordBody: root.querySelector("#chord-body"),
    centerTitle: root.querySelector("#center-title"),
    prismView: root.querySelector("#prism-view"),
    prismBody: root.querySelector("#prism-body"),
    scrollView: root.querySelector("#scroll-view"),
    scrollBody: root.querySelector("#scroll-body"),
    sliceTags: root.querySelector("#slice-tags"),
    detailTitle: root.querySelector("#detail-title"),
    detailDefault: root.querySelector("#detail-default"),
    detailBody: root.querySelector("#detail-body"),
  };
}

function createOption(value, label, selected = false) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  option.selected = Boolean(selected);
  return option;
}

function appendControl(controls, labelText, control) {
  const label = document.createElement("label");
  label.append(labelText, control);
  controls.appendChild(label);
  return control;
}

function layoutToScrollMode(value) {
  const mode = String(value || "").toLowerCase();
  return mode === "free" || mode === "free-graph" || mode === "free-layout"
    ? "free-layout"
    : "layered-time";
}

function layoutToPrismFace(value) {
  return layoutToScrollMode(value) === "free-layout" ? "free" : "time";
}

function syncLayoutState(state, value, dataset) {
  const layoutMode = dataset === "client" ? "free-layout" : layoutToScrollMode(value);
  state.layoutMode = layoutMode;
  state.prismFaceLayout = layoutToPrismFace(layoutMode);
  state.scrollLayoutMode = layoutMode;
}

function setupPanelVisibility(elements, components) {
  const showTree = hasComponent(components, "tree");
  const showChord = hasComponent(components, "chord");
  const leftCount = Number(showTree) + Number(showChord);

  elements.treeCard?.classList.toggle("is-hidden", !showTree);
  elements.chordCard?.classList.toggle("is-hidden", !showChord);
  elements.left?.classList.toggle("has-one-panel", leftCount === 1);
  elements.left?.classList.toggle("is-hidden", leftCount === 0);
  elements.main?.classList.toggle("no-left", leftCount === 0);
}

function createInteractionControls(elements, dataset, components, state, actions) {
  if (!elements.header) return {};
  const controls = document.createElement("div");
  controls.className = "interaction-controls";

  const refs = {};
  if (hasComponent(components, "prism")) {
    refs.prismWidthMode = appendControl(controls, "Face Width", document.createElement("select"));
    refs.prismWidthMode.append(
      createOption("weighted", "original weighted", state.prismWidthMode === "weighted"),
      createOption("equal", "equal width", state.prismWidthMode === "equal")
    );
    refs.prismWidthMode.addEventListener("change", event => {
      state.prismWidthMode = event.target.value;
      actions.renderPrism?.();
    });
  }

  if (hasComponent(components, "prism") || hasComponent(components, "scroll")) {
    refs.layout = appendControl(controls, "Layout", document.createElement("select"));
    if (dataset === "client") {
      refs.layout.append(createOption("free-layout", "free graph", true));
      refs.layout.disabled = true;
    } else {
      refs.layout.append(
        createOption("layered-time", "time layered", state.layoutMode === "layered-time"),
        createOption("free-layout", "free graph", state.layoutMode === "free-layout")
      );
    }
    refs.layout.addEventListener("change", event => {
      syncLayoutState(state, event.target.value, dataset);
      actions.renderPrism?.();
      actions.renderScroll?.();
    });
  }

  if (hasComponent(components, "prism")) {
    refs.rotationSpeed = appendControl(controls, "Rotation", document.createElement("select"));
    refs.rotationSpeed.append(
      createOption("22.5", "1x", state.prismSpeed === 22.5),
      createOption("45", "2x", state.prismSpeed === 45),
      createOption("67.5", "3x", state.prismSpeed === 67.5)
    );
    refs.rotationSpeed.addEventListener("change", event => {
      state.prismSpeed = Number(event.target.value) || 22.5;
      state.prismPaused = false;
      actions.updatePrismRotation?.();
    });

    refs.rotationToggle = document.createElement("button");
    refs.rotationToggle.type = "button";
    refs.rotationToggle.addEventListener("click", () => {
      state.prismPaused = !state.prismPaused;
      actions.updatePrismRotation?.();
    });
    controls.appendChild(refs.rotationToggle);
  }

  if (hasComponent(components, "scroll")) {
    refs.removeIsolated = appendControl(controls, "Remove isolated", document.createElement("select"));
    refs.removeIsolated.append(
      createOption("0", "keep", state.removeIsolated === "0"),
      createOption("1", "remove", state.removeIsolated === "1")
    );
    refs.removeIsolated.addEventListener("change", event => {
      state.removeIsolated = event.target.value;
      actions.renderScroll?.();
    });
  }

  if (controls.childElementCount > 0) {
    elements.header.insertBefore(controls, elements.status || null);
  }
  return refs;
}

function fillPlaceholder(element, label) {
  if (!element) return;
  element.innerHTML = `<div class="interaction-placeholder">${label}</div>`;
}

function setHidden(element, hidden) {
  if (!element) return;
  element.classList.toggle("is-hidden", Boolean(hidden));
}

function isRelationPayload(item = {}) {
  return Boolean(
    item?.sourceSliceId
    || item?.targetSliceId
    || item?.source?.slice
    || item?.target?.slice
    || (item?.source && item?.target && !item?.primarySliceId)
  );
}

function relationSourceSliceId(item = {}) {
  return stringId(item.sourceSliceId || item.sourceSlice || item.source?.slice?.id || item.source?.sliceId || item.source?.primarySliceId);
}

function normalizePalette(model) {
  return (model.slices || []).map(slice => ({
    ...slice,
    id: stringId(slice.id),
    name: slice.name || slice.shortName || slice.id,
    shortName: slice.shortName || slice.name || slice.id,
    color: model.colorMap?.[stringId(slice.id)] || slice.color,
  }));
}

async function initializeLegacyRuntime(model, state = {}) {
  if (!globalThis.Viz?.instance || !globalThis.VizContext?.instance) return;
  const [viz, vizContext] = await Promise.all([
    globalThis.Viz.instance(),
    globalThis.VizContext.instance(),
  ]);
  const removeIsolated = state.removeIsolated ?? "0";
  legacyLayeredScroll.initialize({
    data: model,
    fields: model.slices,
    config: {
      ...model.config,
      remove_isolated: removeIsolated,
      removeIsolated,
      layoutMode: "layered-time",
      scrollRenderer: "layered-scroll",
      showStreams: true,
      showContextBars: true,
    },
    viz,
    vizContext,
    layerGridStep: 2,
  });
}

function scrollModelFor(dataset, model, sliceId) {
  const key = stringId(sliceId || model.slices?.[0]?.id);
  const source = dataset === "client"
    ? capScrollModelBySliceWeights(model, key, 0)
    : model.scrollBySliceId?.[key];
  if (!source) return null;
  return {
    ...source,
    slices: normalizePalette(model),
    colorMap: model.colorMap,
    componentModels: model,
  };
}

function scrollOptionsFor(dataset, model, scrollModel, state = {}, userOptions = {}) {
  const isClient = dataset === "client";
  const layoutSelection = isClient ? "free-layout" : (state.layoutMode || state.scrollLayoutMode || "layered-time");
  const isFreeGraph = layoutSelection === "free-layout" || layoutSelection === "free-graph";
  const layoutMode = isFreeGraph ? "free-graph" : "layered-time";
  const removeIsolated = state.removeIsolated ?? model.config?.remove_isolated ?? "0";
  return {
    engine: isFreeGraph ? "svg" : "prismviz",
    layoutMode,
    scrollRenderer: isFreeGraph ? "graph" : "layered-scroll",
    layerGridStep: 2,
    withContext: true,
    showStreams: true,
    showContextEdges: !isFreeGraph,
    reuseLegacyChrome: isFreeGraph,
    freeGraphChrome: "unified",
    legacyChromeModel: isFreeGraph ? scrollModel : null,
    legacyLayeredApi: legacyLayeredScroll,
    componentModels: model,
    config: {
      ...model.config,
      remove_isolated: removeIsolated,
      removeIsolated,
    },
    slices: normalizePalette(model),
    colorMap: model.colorMap,
    freeGraphEngine: "graphviz",
    freeGraphTimeRanks: false,
    freeGraphTargetLayers: 20,
    freeGraphLayerDensity: 1.8,
    freeGraphAspect: 1.45,
    activateVisType: false,
    restoreState: false,
    ...userOptions,
  };
}

function prismOptionsFor(model, state = {}, userOptions = {}) {
  return {
    widthMode: state.prismWidthMode || "weighted",
    rotationSpeed: state.prismPaused ? 0 : (state.prismSpeed || 22.5),
    rotationX: state.prismRotationX ?? -25,
    rotationY: state.prismRotationY ?? -34,
    translationX: state.prismTranslationX ?? 0,
    translationY: state.prismTranslationY ?? -28,
    scale: state.prismScale ?? 1,
    minScale: 0.62,
    maxScale: 4.8,
    maxFaceNodes: 150,
    maxFreeFaceNodes: 96,
    maxFaceEdges: 170,
    capArcThickness: 26,
    nodeShape: "hexagon",
    tagFontSize: 14,
    tagMaxWidth: 180,
    tagMinWidth: 72,
    faceTitleFontSize: 18,
    faceGraphLayoutMode: layoutToPrismFace(state.layoutMode || state.prismFaceLayout || "layered-time"),
    useGraphvizLayout: true,
    autoRotate: !state.prismPaused,
    rotateOnTagClick: true,
    showTags: true,
    showCaps: true,
    colorMap: model.colorMap,
    ...userOptions,
  };
}

function detailTitleFor(context = {}, item = {}) {
  if (context.type === "node") return "Node Detail";
  if (context.type === "edge") return "Edge Detail";
  if (context.type === "segment") return "Scroll Segment";
  if (context.type === "stream") return "Stream Detail";
  if (context.type === "relation" || isRelationPayload(item)) return "Relation Detail";
  if (context.type === "tree") return "Tree Detail";
  return "Slice Detail";
}

export async function initInteractionDemo(config = {}) {
  const dataset = config.dataset === "client" ? "client" : "reference";
  const components = new Set((config.components || []).map(name => String(name).toLowerCase()));
  const root = typeof config.root === "string"
    ? document.querySelector(config.root)
    : (config.root || document);
  const elements = resolveElements(root);

  if (elements.title) elements.title.textContent = config.title || "Interaction Demo";
  const input = await loadInput(config.dataBaseUrl || "../../data");
  const model = buildModels(dataset, input);
  const toDetailRows = detailFormatter(dataset);
  const palette = normalizePalette(model);
  let activeSliceId = stringId(config.initialSliceId || model.slices?.[0]?.id);
  let currentView = hasComponent(components, "prism") ? "prism" : (hasComponent(components, "scroll") ? "scroll" : "none");
  const demoState = {
    layoutMode: dataset === "client" ? "free-layout" : "layered-time",
    prismWidthMode: "weighted",
    prismFaceLayout: dataset === "client" ? "free" : "time",
    prismPaused: false,
    prismSpeed: 22.5,
    prismRotationX: -25,
    prismRotationY: -34,
    prismTranslationX: 0,
    prismTranslationY: -28,
    prismScale: 1,
    scrollLayoutMode: dataset === "client" ? "free-layout" : "layered-time",
    removeIsolated: "0",
  };
  let treeInstance = null;
  let chordInstance = null;
  let prismInstance = null;
  let scrollInstance = null;
  let tagInstance = null;
  let controlRefs = {};

  setupPanelVisibility(elements, components);
  await initializeLegacyRuntime(model, demoState);

  const detailInstance = renderList(elements.detailBody, {
    hint: "点击左侧或中间组件查看详情",
    dataset,
    components: [...components].join(" + "),
    note: "List 只显示详情，不参与组件间联动",
  }, {mode: "json", numberPrecision: 4});

  function updateStatus(state = null) {
    if (!elements.status) return;
    const active = state?.activeSliceId || activeSliceId || "-";
    const view = state?.mainView || currentView || "-";
    elements.status.textContent = `view: ${view} · active slice: ${active}`;
  }

  function showDetail(title, item = {}, context = {}) {
    if (elements.detailTitle) elements.detailTitle.textContent = title || detailTitleFor(context, item);
    if (elements.detailDefault) elements.detailDefault.hidden = true;
    if (elements.detailBody) elements.detailBody.hidden = false;
    detailInstance.update(toDetailRows(model, item, context), {mode: "json", numberPrecision: 4});
  }

  function showMainView(view) {
    if (!hasComponent(components, "prism") && view === "prism") view = hasComponent(components, "scroll") ? "scroll" : "none";
    if (!hasComponent(components, "scroll") && view === "scroll") view = hasComponent(components, "prism") ? "prism" : "none";
    currentView = view;
    setHidden(elements.prismView, !(view === "prism" || view === "none"));
    setHidden(elements.scrollView, view !== "scroll");
    setHidden(elements.sliceTags, !(hasComponent(components, "scroll") && view === "scroll"));
    if (elements.centerTitle) {
      elements.centerTitle.textContent = view === "scroll"
        ? "Scroll"
        : (view === "prism" ? "Prism" : "Main View");
    }
    updateStatus(coordinator?.getState?.());
  }

  function syncPrismStateFromInstance() {
    const next = prismInstance?.controller?.getState?.();
    if (!next) return;
    demoState.prismRotationX = next.rotationX;
    demoState.prismRotationY = next.rotationY;
    demoState.prismTranslationX = next.translationX;
    demoState.prismTranslationY = next.translationY;
    demoState.prismScale = next.scale;
    if (next.rotationSpeed > 0) demoState.prismSpeed = next.rotationSpeed;
  }

  function syncRotationControls() {
    const toggle = controlRefs.rotationToggle;
    if (!toggle) return;
    toggle.classList.toggle("is-active", demoState.prismPaused);
    toggle.textContent = demoState.prismPaused ? "▶" : "⏸";
    toggle.setAttribute("aria-label", demoState.prismPaused ? "Resume rotation" : "Pause rotation");
    if (controlRefs.rotationSpeed) controlRefs.rotationSpeed.value = String(demoState.prismSpeed || 22.5);
  }

  function updatePrismRotation() {
    prismInstance?.controller?.setRotationSpeed?.(demoState.prismPaused ? 0 : demoState.prismSpeed);
    prismInstance?.controller?.setAutoRotate?.(!demoState.prismPaused);
    syncRotationControls();
  }

  function resumePrismRotation() {
    if (!hasComponent(components, "prism")) return;
    demoState.prismPaused = false;
    updatePrismRotation();
  }

  function renderPrismPanel() {
    if (!hasComponent(components, "prism") || !elements.prismBody) return null;
    syncPrismStateFromInstance();
    prismInstance?.destroy?.();
    prismInstance = renderPrism(elements.prismBody, model.prism, prismOptionsFor(model, demoState, {
      onActiveSliceChange: slice => {
        if (slice) coordinator.focusSlice(slice, {source: "prism"});
        else coordinator.focusSlice(null, {source: "prism"});
      },
      onTagClick: slice => {
        showDetail("Slice Detail", slice, {type: "slice", source: "prism-tag"});
        coordinator.selectSlice(slice, {source: "prism", skipPrism: true});
        resumePrismRotation();
      },
    }));
    coordinator.register("prism", prismInstance);
    syncRotationControls();
    return prismInstance;
  }

  function renderSliceTags() {
    if (!hasComponent(components, "scroll") || !elements.sliceTags) return;
    tagInstance?.destroy?.();
    tagInstance = renderPrismSliceTags(elements.sliceTags, palette, {
      activeSliceId,
      balanceTagRows: true,
      tagFontSize: 14,
      colorMap: model.colorMap,
    }, {
      onSelect: slice => {
        const nextSliceId = stringId(slice.id);
        if (currentView === "scroll" && nextSliceId === activeSliceId && hasComponent(components, "prism")) {
          coordinator.setMainView("prism", {source: "slice-tags"});
          resumePrismRotation();
          return;
        }
        showDetail("Slice Detail", slice, {type: "slice", source: "slice-tags"});
        coordinator.selectSlice(nextSliceId, {source: "slice-tags"});
      },
    });
  }

  function renderScrollForSlice(sliceId, extra = {}) {
    if (!hasComponent(components, "scroll") || !elements.scrollBody) return null;
    const scrollModel = extra.scrollData || scrollModelFor(dataset, model, sliceId);
    if (!scrollModel) {
      fillPlaceholder(elements.scrollBody, "当前 slice 没有可渲染的 Scroll 数据");
      return null;
    }
    scrollInstance?.destroy?.();
    activeSliceId = stringId(sliceId || scrollModel.slice?.id || activeSliceId);
    tagInstance?.setActiveSlice?.(activeSliceId);
    scrollInstance = renderScroll(elements.scrollBody, scrollModel, coordinator.optionsFor("scroll", scrollOptionsFor(dataset, model, scrollModel, demoState, {
      onSelect: (item, context = {}) => {
        showDetail(detailTitleFor(context, item), context.edge || item, context);
      },
      onSegmentSelect: (item, context = {}) => {
        showDetail("Scroll Segment", item, {type: "segment", activeSliceId, ...context});
      },
      onStreamSelect: (item, context = {}) => {
        showDetail("Stream Detail", item, {type: "stream", activeSliceId, ...context});
      },
    })));
    coordinator.register("scroll", scrollInstance);
    return scrollInstance;
  }

  const coordinator = createInteractionCoordinator({
    model,
    initialSliceId: activeSliceId,
    getScrollData: sliceId => scrollModelFor(dataset, model, sliceId),
    onScrollSliceChange: hasComponent(components, "scroll")
      ? (sliceId, info = {}) => {
        showMainView("scroll");
        renderScrollForSlice(sliceId, info);
      }
      : null,
    onViewChange: view => showMainView(view),
    onStateChange: state => updateStatus(state),
  });
  if (currentView === "scroll") {
    coordinator.setMainView("scroll", {source: "demo-init", event: "view:init"});
  }

  controlRefs = createInteractionControls(elements, dataset, components, demoState, {
    renderPrism: renderPrismPanel,
    renderScroll: () => {
      if (hasComponent(components, "scroll") && currentView === "scroll") renderScrollForSlice(activeSliceId);
    },
    updatePrismRotation,
  });
  syncRotationControls();

  ALL_COMPONENTS.forEach(name => {
    if (!hasComponent(components, name) && (name === "prism" || name === "scroll")) {
      fillPlaceholder(elements[`${name}Body`], `${name} 未调用`);
    }
  });

  if (hasComponent(components, "tree")) {
    treeInstance = renderTree(elements.treeBody, model.tree, {
      maxLevel: 2,
      showCount: true,
      internalSelection: false,
      onSelect: item => {
        showDetail("Tree Detail", item, {type: "tree"});
        coordinator.selectSlice(item, {source: "tree"});
      },
    });
    coordinator.register("tree", treeInstance);
  }

  if (hasComponent(components, "chord")) {
    chordInstance = renderChord(elements.chordBody, model.chord, {
      mode: "chord",
      onSelect: item => {
        const relationPayload = isRelationPayload(item);
        const sourceSliceId = relationPayload ? relationSourceSliceId(item) : "";
        if (relationPayload && sourceSliceId) activeSliceId = sourceSliceId;
        if (relationPayload) coordinator.selectRelation(item, {source: "chord"});
        else coordinator.selectSlice(item, {source: "chord"});
        showDetail(detailTitleFor({type: relationPayload ? "relation" : "slice"}, item), item, {
          type: relationPayload ? "relation" : "slice",
          source: "chord",
        });
      },
    });
    coordinator.register("chord", chordInstance);
  }

  if (hasComponent(components, "prism")) {
    renderPrismPanel();
  } else {
    setHidden(elements.prismView, true);
  }

  if (hasComponent(components, "scroll")) {
    renderSliceTags();
    if (currentView === "scroll") {
      showMainView("scroll");
      renderScrollForSlice(activeSliceId);
    }
  } else {
    setHidden(elements.scrollView, true);
    setHidden(elements.sliceTags, true);
  }

  if (!hasComponent(components, "prism") && !hasComponent(components, "scroll")) {
    fillPlaceholder(elements.prismBody, "此两两 demo 不包含 Prism 或 Scroll");
    setHidden(elements.prismView, false);
  }

  showMainView(currentView);
  if (currentView === "scroll" && hasComponent(components, "scroll")) {
    coordinator.focusSlice(activeSliceId, {source: "demo-init"});
  }
  updateStatus(coordinator.getState());

  return {
    model,
    coordinator,
    instances: {
      tree: treeInstance,
      chord: chordInstance,
      prism: prismInstance,
      scroll: scrollInstance,
      tags: tagInstance,
      detail: detailInstance,
    },
  };
}

export default initInteractionDemo;
